// ==== S18 UI: FORGE (MAP EDITOR SCREENS) ====
// The editor screen (a pass-through layer over the 3D view: top bar, tool palette, properties of the selection, status line and the touch buttons)
// and the dialogs it opens: menu, new map, my maps, validation, codes, test-play, map settings, modes. Every screen is built from the Forge model
// (16x-forge.js) and the tools (16x-forge-tools.js); all three devices reach the same commands. Contract: docs/api/forge.md.

const FORGE_PANEL_MIN_WIDTH = 760;          // narrower or lower screens start with the side panels hidden
const FORGE_PANEL_MIN_HEIGHT = 440;
const FORGE_STATUS_SECONDS = 0.2;           // how often the cursor text is refreshed
const FORGE_BUDGET_WARNING = 0.9;           // the budget counter turns amber past this share
const FORGE_LIGHT_COLORS = [[0xffd9a0, 'Warm'], [0xffffff, 'White'], [0x9fc8ff, 'Cool'], [0xff9060, 'Red']];
const FORGE_CODE_PREFIX = 'CTKMAP';
const FORGE_CODE_PATTERN = new RegExp(String.raw`^${FORGE_CODE_PREFIX}(\d+)-([0-9a-f]{8})-([A-Za-z0-9_-]+)$`);   // prefix, version, check value, payload
const FORGE_CODE_MAX_CHARS = 60000;        // a longer text is refused before anything is decoded
const FORGE_CODE_MAX_BYTES = 262144;       // the unpacked JSON may not be larger than this
const FORGE_PLAY_SEED_RANGE = 99999;
const FORGE_KIND_CHANGE_TURNS = 1;         // a trigger whose kind is changed in the panel gets its far end towards +x
// Parts of the editor screen a change of the model has to redraw (see ForgeUi.mark).
const FORGE_PART_TOP = 1, FORGE_PART_PALETTE = 2, FORGE_PART_PROPERTIES = 4, FORGE_PART_DIALOG = 8;
const FORGE_PARTS_BY_CHANGE = { map: 15, edit: FORGE_PART_TOP | FORGE_PART_PROPERTIES | FORGE_PART_DIALOG, selection: FORGE_PART_PROPERTIES | FORGE_PART_DIALOG,
  tool: FORGE_PART_TOP | FORGE_PART_PALETTE | FORGE_PART_DIALOG, saved: FORGE_PART_TOP, problems: 0 };
const FORGE_HELP = {
  kbm: 'WASD fly, E / Q up and down, hold right mouse to look, click to place, wheel to turn, G grab, Del delete, F snap, Ctrl+Z / Ctrl+Y undo and redo.',
  gamepad: 'Sticks fly and look, RT / LT up and down, A place, B delete, X turn, Y grab, LB / RB option, D-pad up / down tool, D-pad left snap, View undo, Start menu.',
  touch: 'Drag to move the cursor, two fingers to look, the buttons fly the camera. Place puts the object at the cursor.',
};
// On-screen buttons for touch (INP: all three devices). hold: a camera move while pressed; command: one action per tap.
const FORGE_TOUCH_MOVES = [['Fwd', 'forward'], ['Back', 'back'], ['Left', 'left'], ['Right', 'right'], ['Up', 'up'], ['Down', 'down'],
  ['Turn L', 'turnLeft'], ['Turn R', 'turnRight'], ['Look up', 'lookUp'], ['Look dn', 'lookDown']];
const FORGE_TOUCH_ACTIONS = [['Place', 'primary', 'primary'], ['Delete', 'secondary', 'danger'], ['Turn', 'rotate', ''], ['Grab', 'grab', ''], ['Undo', 'undo', ''], ['Redo', 'redo', '']];

const FORGE_CSS = '.ui-forge { padding: 0; background: none; } .ui-forge > * { pointer-events: auto; }'
  + '.fg-top { position: absolute; top: 0; left: 0; right: 0; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: calc(6px + var(--safe-top)) calc(8px + var(--safe-right)) 6px calc(8px + var(--safe-left));'
  + ' background: linear-gradient(rgba(5, 8, 12, 0.85), rgba(5, 8, 12, 0)); pointer-events: none; } .fg-top > * { pointer-events: auto; }'
  + '.fg-top .ui-button, .fg-panel .ui-button, .fg-touch .ui-button { min-height: 36px; padding: 0.25em 0.65em; font-size: 0.9em; text-align: center; }'
  + '.fg-budget { padding: 0.25em 0.6em; border-radius: 8px; background: var(--ui-bg); border: 1px solid var(--ui-line); font-variant-numeric: tabular-nums; } .fg-budget.warn { border-color: var(--ui-accent); } .fg-budget.full { border-color: var(--ui-bad); }'
  + '.fg-panel { position: absolute; top: calc(52px + var(--safe-top)); bottom: calc(46px + var(--safe-bottom)); width: min(210px, 34vw); overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 6px;'
  + ' background: var(--ui-bg); border: 1px solid var(--ui-line); border-radius: 10px; touch-action: pan-y; }'
  + '.fg-panel > * { flex-shrink: 0; } .fg-left { left: calc(8px + var(--safe-left)); } .fg-right { right: calc(8px + var(--safe-right)); width: min(250px, 38vw); }'
  + '.fg-panel .ui-row { flex-direction: column; align-items: stretch; min-height: 34px; padding: 4px 6px; margin: 0; gap: 2px; } .fg-panel .ui-label { min-width: 0; font-size: 0.85em; }'
  + '.fg-panel .ui-cycle { min-width: 6em; } .fg-panel .ui-group { margin: 6px 0 2px; font-size: 0.85em; } .fg-panel .ui-note { margin: 0; font-size: 0.8em; }'
  + '.fg-step { display: flex; align-items: center; gap: 4px; } .fg-step .ui-button { min-width: 36px; padding: 0.25em 0.4em; } .fg-step .ui-value { flex: 1; min-width: 3em; text-align: center; } .fg-panel .ui-cycle { width: 100%; }'
  + '.fg-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; } .fg-name { background: var(--ui-panel); color: var(--ui-text); border: 1px solid var(--ui-line); border-radius: 8px; padding: 6px; font: inherit; min-width: 0; width: 100%; }'
  + '.fg-status { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px calc(10px + var(--safe-right)) calc(6px + var(--safe-bottom)) calc(10px + var(--safe-left)); pointer-events: none;'
  + ' background: linear-gradient(rgba(5, 8, 12, 0), rgba(5, 8, 12, 0.85)); font-size: 0.8em; color: var(--ui-dim); } .fg-status b { color: var(--ui-text); font-weight: 600; }'
  + '.fg-touch { position: absolute; left: 0; right: 0; bottom: calc(38px + var(--safe-bottom)); display: none; justify-content: space-between; align-items: flex-end; padding: 0 calc(10px + var(--safe-right)) 0 calc(10px + var(--safe-left)); pointer-events: none; }'
  + '.fg-touch.show { display: flex; } .fg-touch > * { pointer-events: auto; } .fg-pad { display: grid; gap: 4px; }'
  + '.fg-moves { grid-template-columns: repeat(5, minmax(52px, 1fr)); width: min(330px, 56vw); } .fg-acts { grid-template-columns: repeat(3, minmax(52px, 1fr)); width: min(200px, 34vw); }'
  + '.fg-touch .ui-button { min-height: 42px; min-width: 0; padding: 0.2em; font-size: 0.78em; opacity: 0.88; touch-action: none; } .ui-forge.fg-nopanels .fg-panel { display: none; }'
  + '@media (max-width: 600px) { .fg-touch { flex-direction: column; align-items: stretch; gap: 6px; } .fg-moves, .fg-acts { width: auto; } .fg-acts { grid-template-columns: repeat(6, 1fr); } }'
  + '.fg-problem { display: block; width: 100%; margin-bottom: 4px; } .fg-code { width: 100%; min-height: 9em; background: var(--ui-panel); color: var(--ui-text); border: 1px solid var(--ui-line); border-radius: 8px; padding: 8px; font: 12px/1.4 ui-monospace, Consolas, monospace; }'
  + '.fg-maprow { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; } .fg-maprow .fg-name { flex: 1; min-width: 8em; } .fg-error { color: var(--ui-bad); }'
  + '@media (pointer: coarse) { .fg-top .ui-button, .fg-panel .ui-button { min-height: 44px; } } @media (max-width: 720px) { .fg-panel { width: min(170px, 36vw); } }';

// The fields of the selected object per list, beyond position and size. cycle: choose a value; step: +/- a number; text: a name.
const forgeTeamField = { label: 'Team', kind: 'cycle', values: () => [-1, 0, 1], texts: forgeTeamTexts, get: (o) => o.team, set: (o, v) => { o.team = v; } };
const FORGE_FIELDS = {
  brushes: [{ label: 'Material', kind: 'cycle', values: () => MapRules.materials, get: (o) => o.material, set: (o, v) => { o.material = v; } }],
  spawns: [forgeTeamField],
  items: [{ label: 'Item', kind: 'cycle', values: forgeAllItemKeys, texts: (values) => values.map(forgeItemName), get: (o) => o.item, set: (o, v) => { o.item = v; o.group = MapRules.groupOf(v); } }],
  objectives: [
    { label: 'Kind', kind: 'cycle', values: () => MapRules.objectiveKinds, get: (o) => o.kind, set: forgeSetObjectiveKind },
    forgeTeamField,
    { label: 'Stage', kind: 'cycle', values: () => [0, 1, 2, 3], texts: (values) => values.map((v) => (v ? String(v) : 'none')), get: (o) => o.stage || 0, show: (o) => o.kind === 'bombsite',
      set: (o, v) => { if (v) o.stage = v; else delete o.stage; } },
  ],
  zones: [{ label: 'Name', kind: 'text', get: (o) => o.name, set: (o, v) => { o.name = forgeNameOf(v) || o.name; } }],
  triggers: [
    { label: 'Kind', kind: 'cycle', values: () => MapRules.triggerKinds, get: (o) => o.kind, set: (o, v) => forgeTriggerDefaults(o, v, FORGE_KIND_CHANGE_TURNS) },
    { label: 'Peak', kind: 'step', step: 0.5, get: (o) => o.peak, apply: (o, d) => { o.peak = Math.max(0.5, o.peak + d); }, show: (o) => o.kind === 'jumppad' },
    { label: 'Damage', kind: 'step', step: 5, get: (o) => o.damage, apply: (o, d) => { o.damage = Math.max(5, o.damage + d); }, show: (o) => o.kind === 'hazard' },
    { label: 'Element', kind: 'cycle', values: () => MapRules.elements, get: (o) => o.element, set: (o, v) => { o.element = v; }, show: (o) => o.kind === 'hazard' },
    { label: 'Exit yaw', kind: 'step', step: 45, get: (o) => o.yaw, apply: (o, d) => { o.yaw = forgeWrapDegrees(o.yaw + d); }, show: (o) => o.kind === 'teleporter' },
  ].concat(['X', 'Y', 'Z'].map((name, axis) => ({ label: 'Far end ' + name, kind: 'step', step: 0.5, get: (o) => (o.target || o.exit)[axis],
    apply: (o, d) => { (o.target || o.exit)[axis] += d; }, show: (o) => !!(o.target || o.exit) }))),
  lights: [{ label: 'Colour', kind: 'cycle', values: () => FORGE_LIGHT_COLORS.map((row) => row[0]), texts: () => FORGE_LIGHT_COLORS.map((row) => row[1]), get: (o) => o.color, set: (o, v) => { o.color = v; } }],
  navHints: [{ label: 'Kind', kind: 'cycle', values: () => MapRules.hintKinds, get: (o) => o.kind, set: (o, v) => { o.kind = v; } }],
};
function forgeSetObjectiveKind(objective, kind) {
  objective.kind = kind;
  if (kind === 'payloadPath' && !(objective.path && objective.path.length)) objective.path = [[objective.x, objective.y, objective.z]];
}

const ForgeUi = {
  root: null, top: null, left: null, right: null, status: null, touch: null, cursorText: null,
  undoButton: null, redoButton: null, snapButton: null, panelsButton: null, touchButton: null, budget: null, nameTag: null,   // the top bar, built once and updated in place
  dialogRefresh: null,                  // fn() of the open dialog that mirrors the panels (the tool and object dialog)
  pending: 0,                           // FORGE_PART_* bits waiting for the next frame
  shownSnap: -1,                        // the snap step the properties panel was built for (its buttons move by it)
  touchShown: false, panelsShown: true, statusTimer: 0, shownX: NaN, shownY: NaN, shownZ: NaN, shownValid: false,

  // ---- small builders ----
  stepper(label, valueText, onMinus, onPlus) {
    const wrap = makeElement('div', 'fg-step');
    wrap.appendChild(Ui.button('-', onMinus));
    wrap.appendChild(makeElement('span', 'ui-value', valueText));
    wrap.appendChild(Ui.button('+', onPlus));
    return Ui.row(label, wrap);
  },
  nameInput(value, onChange) {
    const input = makeElement('input', 'fg-name');
    input.type = 'text'; input.value = value; input.maxLength = FORGE_NAME_MAX;
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
    if (!Forge.dirty) { leave(); return; }
    Ui.confirm({ title: 'Leave the editor?', text: 'The map has changes that were not saved.', yes: 'Leave', onYes: leave });
  },

  // ---- the editor screen ----
  build(root) {
    this.root = root;
    root.classList.add('ui-forge');
    this.top = makeElement('div', 'fg-top');
    this.left = makeElement('div', 'fg-panel fg-left');
    this.right = makeElement('div', 'fg-panel fg-right');
    this.status = makeElement('div', 'fg-status');
    this.touch = this.buildTouch();
    for (const part of [this.top, this.left, this.right, this.status, this.touch]) root.appendChild(part);
    this.touchShown = Input.device === 'touch' || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    this.panelsShown = window.innerWidth >= FORGE_PANEL_MIN_WIDTH && window.innerHeight >= FORGE_PANEL_MIN_HEIGHT;   // a phone starts with the view free
    this.buildTop();
    this.pending = 0;
    this.redraw(FORGE_PARTS_BY_CHANGE.map);
    this.buildStatus();
  },
  // A change of the model (Bus 'forge.changed') marks the parts of the screen it touches; flush redraws them once per frame.
  mark(what) {
    if (!this.root) return;
    this.pending |= FORGE_PARTS_BY_CHANGE[what] || 0;
    if (what === 'tool' && ForgeTools.snapIndex !== this.shownSnap) this.pending |= FORGE_PART_PROPERTIES;
  },
  flush() {
    const parts = this.pending;
    this.pending = 0;
    if (parts && this.root && this.root.isConnected) this.redraw(parts);
  },
  redraw(parts) {
    if (parts & FORGE_PART_TOP) this.updateTop();
    if (parts & FORGE_PART_PALETTE) this.rebuild(this.left, (panel) => this.fillPalette(panel));
    if (parts & FORGE_PART_PROPERTIES) this.rebuild(this.right, (panel) => this.fillProperties(panel));
    if ((parts & FORGE_PART_DIALOG) && this.dialogRefresh) this.dialogRefresh();
  },
  // The top bar keeps its buttons: only their texts and states change.
  buildTop() {
    const top = this.top, tools = ForgeTools;
    top.appendChild(Ui.button('Menu', () => Ui.open('forgeMenu'), 'primary'));
    this.undoButton = Ui.button('Undo', () => tools.command('undo'));
    this.redoButton = Ui.button('Redo', () => tools.command('redo'));
    this.snapButton = Ui.button('', () => tools.command('snap'));
    this.panelsButton = Ui.button('', () => { this.panelsShown = !this.panelsShown; this.updateTop(); });
    this.touchButton = Ui.button('', () => { this.touchShown = !this.touchShown; this.updateTop(); });
    for (const button of [this.undoButton, this.redoButton, this.snapButton]) top.appendChild(button);
    top.appendChild(Ui.button('Check', () => Ui.open('forgeCheck')));
    top.appendChild(Ui.button('Test play', () => Ui.open('forgePlay')));
    top.appendChild(this.panelsButton); top.appendChild(this.touchButton);
    this.budget = makeElement('span', 'fg-budget');
    this.nameTag = makeElement('span', 'fg-budget');
    top.appendChild(this.budget); top.appendChild(this.nameTag);
  },
  updateTop() {
    this.undoButton.disabled = !Forge.canUndo();
    this.redoButton.disabled = !Forge.canRedo();
    this.snapButton.textContent = 'Snap ' + ForgeTools.snap() + ' m';
    this.panelsButton.textContent = this.panelsShown ? 'Hide panels' : 'Panels';
    this.touchButton.textContent = this.touchShown ? 'Hide buttons' : 'Touch buttons';
    const share = Forge.count() / FORGE_BUDGET;
    this.budget.className = 'fg-budget' + (share >= 1 ? ' full' : share >= FORGE_BUDGET_WARNING ? ' warn' : '');
    this.budget.textContent = 'Objects ' + Forge.count() + ' / ' + FORGE_BUDGET;
    this.nameTag.textContent = Forge.map.name + (Forge.dirty ? ' *' : '');
    this.touch.classList.toggle('show', this.touchShown);
    this.root.classList.toggle('fg-nopanels', !this.panelsShown);
  },
  fillPalette(panel) {
    panel.appendChild(makeElement('div', 'ui-group', 'Tools'));
    for (const tool of FORGE_TOOLS) {
      const button = Ui.button(tool.label, () => ForgeTools.setTool(tool.id), ForgeTools.tool === tool.id ? 'primary' : '');
      panel.appendChild(button);
    }
    this.fillToolOptions(panel);
    panel.appendChild(makeElement('div', 'ui-group', 'View'));
    const level = this.stepper('Level', this.fixed(ForgeTools.elevation) + ' m', () => ForgeTools.command('levelDown'), () => ForgeTools.command('levelUp'));
    panel.appendChild(level);
    panel.appendChild(Ui.row('Zones', Ui.toggle(ForgeTools.view.zones, (on) => { ForgeTools.view.zones = on; Forge.announce('tool'); })));
    panel.appendChild(Ui.row('Triggers', Ui.toggle(ForgeTools.view.triggers, (on) => { ForgeTools.view.triggers = on; Forge.announce('tool'); })));
  },
  fillToolOptions(panel) {
    const tools = ForgeTools, tool = tools.toolRow();
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
    const object = Forge.selected(), list = Forge.selection.list;
    this.shownSnap = ForgeTools.snapIndex;
    if (!object) {
      panel.appendChild(makeElement('div', 'ui-group', 'Nothing selected'));
      panel.appendChild(makeElement('p', 'ui-note', Forge.countsText()));
      return;
    }
    panel.appendChild(makeElement('div', 'ui-group', FORGE_KINDS[list].label + ' #' + Forge.selection.index));
    for (const field of FORGE_FIELDS[list]) if (!field.show || field.show(object)) panel.appendChild(this.fieldRow(field, object));
    this.buildSizeRows(panel, list, object);
    this.buildMoveRows(panel);
    this.buildObjectButtons(panel, object);
  },
  fieldRow(field, object) {
    const edit = (change) => Forge.editSelected(change);
    if (field.kind === 'text') return Ui.row(field.label, this.nameInput(field.get(object), (value) => edit((copy) => field.set(copy, value))));
    if (field.kind === 'step') {
      return this.stepper(field.label, this.fixed(field.get(object)), () => edit((copy) => field.apply(copy, -field.step)), () => edit((copy) => field.apply(copy, field.step)));
    }
    const values = field.values(), texts = field.texts ? field.texts(values) : values.map(String);
    return Ui.row(field.label, Ui.cycle(values, texts, field.get(object), (value) => edit((copy) => field.set(copy, value))));
  },
  buildSizeRows(panel, list, object) {
    const step = ForgeTools.snap();
    if (FORGE_KINDS[list].box) {
      ['Width', 'Height', 'Depth'].forEach((name, axis) => panel.appendChild(this.stepper(name, this.fixed(object.max[axis] - object.min[axis]) + ' m',
        () => Forge.resizeSelected(axis, -step), () => Forge.resizeSelected(axis, step))));
    } else if (list === 'objectives' || list === 'lights') {
      panel.appendChild(this.stepper('Radius', this.fixed(object.radius) + ' m', () => Forge.resizeSelected(0, -step), () => Forge.resizeSelected(0, step)));
    }
  },
  buildMoveRows(panel) {
    const step = ForgeTools.snap(), grid = makeElement('div', 'fg-grid');
    for (const [name, dx, dy, dz] of [['West', -1, 0, 0], ['East', 1, 0, 0], ['Down', 0, -1, 0], ['Up', 0, 1, 0], ['South', 0, 0, -1], ['North', 0, 0, 1]]) {
      grid.appendChild(Ui.button(name, () => Forge.nudgeSelected(dx * step, dy * step, dz * step)));
    }
    panel.appendChild(makeElement('div', 'ui-group', 'Move ' + step + ' m'));
    panel.appendChild(grid);
  },
  buildObjectButtons(panel, object) {
    const grid = makeElement('div', 'fg-grid');
    grid.appendChild(Ui.button('Grab', () => ForgeTools.command('grab')));
    grid.appendChild(Ui.button('Turn', () => Forge.turnSelected()));
    grid.appendChild(Ui.button('Copy', () => ForgeTools.command('duplicate')));
    grid.appendChild(Ui.button('Look at', () => ForgeTools.focusSelected()));
    panel.appendChild(grid);
    panel.appendChild(Ui.button('Delete', () => Forge.deleteSelected(), 'danger'));
    if (object.kind === 'payloadPath') {
      panel.appendChild(Ui.button('Add path point at cursor', () => ForgeTools.addPathPoint()));
      panel.appendChild(makeElement('p', 'ui-note', 'Path points: ' + object.path.length + ' (the payload needs 4 or more).'));
    }
  },
  buildStatus() {
    this.status.replaceChildren();
    this.cursorText = makeElement('b', '', '');
    this.status.appendChild(this.cursorText);
    this.status.appendChild(document.createTextNode('  ' + FORGE_HELP[Input.device]));
    this.shownX = NaN;
  },
  // Cursor position, refreshed a few times a second while the screen is open.
  updateStatus(seconds) {
    this.statusTimer -= seconds;
    if (this.statusTimer > 0 || !this.cursorText || !this.cursorText.isConnected) return;
    this.statusTimer = FORGE_STATUS_SECONDS;
    const cursor = ForgeTools.cursor;
    if (cursor.valid === this.shownValid && cursor.x === this.shownX && cursor.y === this.shownY && cursor.z === this.shownZ) return;
    this.shownValid = cursor.valid; this.shownX = cursor.x; this.shownY = cursor.y; this.shownZ = cursor.z;
    this.cursorText.textContent = cursor.valid ? 'x ' + this.fixed(cursor.x) + '  y ' + this.fixed(cursor.y) + '  z ' + this.fixed(cursor.z) : 'no surface';
  },
  buildTouch() {
    const wrap = makeElement('div', 'fg-touch'), moves = makeElement('div', 'fg-pad fg-moves'), actions = makeElement('div', 'fg-pad fg-acts');
    for (const [label, hold] of FORGE_TOUCH_MOVES) moves.appendChild(this.holdButton(label, hold));
    for (const [label, command, style] of FORGE_TOUCH_ACTIONS) actions.appendChild(Ui.button(label, () => ForgeTools.command(command), style));
    wrap.appendChild(moves); wrap.appendChild(actions);
    return wrap;
  },
  // A button that acts while a finger is on it (fly, turn, look).
  holdButton(label, hold) {
    const button = makeElement('button', 'ui-button', label);
    button.type = 'button';
    const release = () => ForgeTools.setHold(hold, false);
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      try { button.setPointerCapture(event.pointerId); } catch (error) { /* a pointer that is not active (synthetic event): the release events still arrive */ }
      ForgeTools.setHold(hold, true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
    return button;
  },
};

Ui.register('forge', {
  passthrough: true,
  build(root) { Forge.ensureMap(); ForgeUi.build(root); },
  onOpen() {
    ForgeTools.attach();
    ForgeTools.menuRequest = () => Ui.open('forgeMenu');
  },
  onClose() {
    ForgeTools.detach();
    ForgeTools.menuRequest = null;
    ForgeUi.root = null;
  },
  // Esc: let go of what is held or selected first; otherwise open the menu.
  onBack() {
    if (!ForgeTools.command('cancel')) Ui.open('forgeMenu');
    return true;
  },
  // The pad drives the editor itself (ForgeTools.readPad): the menu commands it also produces are not for the panels.
  onCommand() { return true; },
});
Bus.on('forge.changed', (change) => ForgeUi.mark(change.what));
Bus.on('input.device', () => { if (Ui.isOpen('forge')) ForgeUi.buildStatus(); });
Bus.on('boot', () => Loop.onFrame('ui', (seconds) => { if (ForgeUi.root) { ForgeUi.flush(); ForgeUi.updateStatus(seconds); } }));
// The editing keys, mouse and pad act only while the editor itself is on top, not while a dialog (menu, list, confirm) is open over it.
ForgeTools.dialogOpen = () => { const top = Ui.current(); return top !== '' && top !== 'forge'; };

// ---- Test-play (MAP-014): a match on the edited map; the editor comes back when it stops ----
const ForgePlay = {
  returning: false,                     // a test match is running: the editor comes back when it stops
  returnDue: false,                     // a match stopped while returning: settle decides whether it was the last one
  testPlay(modeId) {
    if (!ForgeTools.playableModes().includes(modeId)) return Forge.refuse('This map has no objectives or spawns for that mode.') >= 0;
    const setup = CustomMatch.setup(CustomMatch.validate({ mode: modeId }).draft, Math.floor(performance.now()) % FORGE_PLAY_SEED_RANGE);
    setup.map = Forge.toMap();
    this.returning = true;
    ForgeTools.detach();
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
    if (Game.headless) ForgeTools.attach(); else Ui.open('forge');
  },
};
// This listener runs after the main menu opened, so the editor ends up on top.
Bus.on('match.stop', () => ForgePlay.onMatchStop());

// ---- Share codes: the whole map as one line of text (copy and paste only) ----
const ForgeShare = {
  exportCode(map) {
    const payload = CustomCodec.toBase64Url(CustomCodec.compress(new TextEncoder().encode(JSON.stringify(Forge.compact(map || Forge.map)))));
    return FORGE_CODE_PREFIX + FORGE_CODE_VERSION + '-' + CustomCodec.checksum(payload) + '-' + payload;
  },
  // text -> { map } or { error } with a message for the player. Nothing is changed.
  decodeCode(text) {
    const clean = String(text || '').replace(/\s+/g, '');
    if (clean.length > FORGE_CODE_MAX_CHARS) return { error: 'The code is too long to be a map code.' };
    const parts = FORGE_CODE_PATTERN.exec(clean);
    if (!parts) return { error: 'This is not a ClassTimeKiller map code.' };
    if (Number(parts[1]) > FORGE_CODE_VERSION) return { error: 'This code was made by a newer version of the game.' };
    if (CustomCodec.checksum(parts[3]) !== parts[2]) return { error: 'The code is damaged: it does not match its check value. Copy it again.' };
    try {
      const bytes = CustomCodec.expand(CustomCodec.fromBase64Url(parts[3]), FORGE_CODE_MAX_BYTES);
      return Forge.expand(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    } catch (error) {
      return { error: 'The code could not be read.' };
    }
  },
  importCode(text) {
    const result = this.decodeCode(text);
    if (result.error) return result;
    result.map.id = FORGE_DRAFT_ID;
    Forge.reset(result.map, '');
    return result;
  },
};

// ---- Dialog builders ----
function forgeDialog(root, title, backTo) {
  screenHeader(root, title, backTo);
  const body = makeElement('div', 'ui-scroll');
  root.appendChild(body);
  return body;
}
const forgeListRow = (label, buttons) => {
  const row = makeElement('div', 'ui-row');
  row.appendChild(makeElement('span', 'ui-label', label));
  for (const button of buttons) row.appendChild(button);
  return row;
};
const forgeKilobytes = (bytes) => (bytes / 1024).toFixed(1) + ' KB';
// Closes dialogs until the editor screen is on top again.
function forgeBackToEditor() { while (Ui.current() && Ui.current() !== 'forge') Ui.pop(); }

// Saves the map; one that offers no mode yet gets the modes it is ready for, and the player is told which modes matches will not offer yet.
function forgeSave(asNew) {
  if (!Forge.map.modes.length) Forge.setModes(Forge.suggestModes());
  if (!(asNew ? Forge.saveAsNew() : Forge.saveCurrent())) return false;
  Ui.toast(forgeSavedText());
  return true;
}
function forgeSavedText() {
  const ready = Forge.readyModes(Forge.map).length;
  if (!ready) return 'Saved. No mode is complete yet: add spawns and objectives to play it in matches.';
  return ready < Forge.map.modes.length ? 'Saved. Some modes still lack spawns or objectives, so matches do not offer this map for them.' : 'Saved';
}

// ---- Menu ----
Ui.register('forgeMenu', {
  build(root) {
    const body = forgeDialog(root, 'Map editor');
    const items = makeElement('div', 'ui-menu');
    const add = (label, action, style) => items.appendChild(Ui.button(label, action, style));
    add('Resume editing', () => Ui.back(), 'primary');
    add('Test play', () => Ui.open('forgePlay'));
    add('Tool and object options', () => Ui.open('forgeObject'));
    add('Check the map', () => Ui.open('forgeCheck'));
    add('Save', () => forgeSave(false));
    add('Save as a new map', () => forgeSave(true));
    add('My maps (' + Forge.saved().length + ' / ' + FORGE_MAX_MAPS + ')', () => Ui.open('forgeMaps'));
    add('New map', () => Ui.open('forgeNew'));
    add('Map settings', () => Ui.open('forgeSettings'));
    add('Share code', () => Ui.open('forgeCode'));
    add('Exit editor', () => ForgeUi.exit(), 'danger');
    body.appendChild(items);
    body.appendChild(makeElement('p', 'ui-note', Forge.map.name + (Forge.dirty ? ' (not saved)' : ' (saved)') + ' - ' + Forge.count() + ' of ' + FORGE_BUDGET + ' objects.'));
  },
});

// ---- The tool options and the properties of the selection as a dialog: the pad and the keyboard reach every control here ----
Ui.register('forgeObject', {
  build(root) {
    const body = forgeDialog(root, 'Tool and selection');
    const render = () => ForgeUi.rebuild(body, (panel) => { ForgeUi.fillToolOptions(panel); ForgeUi.fillProperties(panel); });
    ForgeUi.dialogRefresh = render;
    render();
  },
  onClose() { ForgeUi.dialogRefresh = null; },
});

// ---- New map: empty, a template or a copy of a built-in map ----
Ui.register('forgeNew', {
  build(root) {
    const body = forgeDialog(root, 'New map');
    const start = (source) => {
      const begin = () => { if (!Forge.newFrom(source).error) forgeBackToEditor(); };
      if (Forge.dirty) Ui.confirm({ title: 'Discard changes?', text: 'The map has changes that were not saved.', yes: 'Discard', onYes: begin }); else begin();
    };
    body.appendChild(makeElement('div', 'ui-group', 'Start'));
    body.appendChild(Ui.button('Empty map (a floor)', () => start({ kind: 'empty' })));
    body.appendChild(makeElement('div', 'ui-group', 'Templates'));
    for (const template of FORGE_TEMPLATES) body.appendChild(forgeListRow(template.name + ' - ' + template.blurb, [Ui.button('Use', () => start({ kind: 'template', id: template.id }))]));
    body.appendChild(makeElement('div', 'ui-group', 'Copy of a built-in map'));
    for (const row of CAT.maps) body.appendChild(forgeListRow(row.code + ' ' + row.name, [Ui.button('Copy', () => start({ kind: 'builtin', id: row.id }))]));
  },
});

// ---- My maps: open, rename, delete; shows how much space is used ----
Ui.register('forgeMaps', {
  build(root) {
    const body = forgeDialog(root, 'My maps');
    const render = () => {
      body.replaceChildren();
      body.appendChild(makeElement('p', 'ui-note', Forge.saved().length + ' of ' + FORGE_MAX_MAPS + ' maps. Saved maps use ' + forgeKilobytes(Forge.usedBytes()) + '; about '
        + forgeKilobytes(Math.max(0, Forge.freeBytes())) + ' are free. Saved maps with a mode also appear in Custom match.'));
      if (!Forge.saved().length) body.appendChild(makeElement('p', 'ui-note', 'No saved maps yet. Use Save in the menu.'));
      for (const entry of Forge.saved()) body.appendChild(this.row(entry, render));
    };
    render();
  },
  row(entry, render) {
    const row = makeElement('div', 'ui-row fg-maprow');
    let name = entry.name;
    row.appendChild(ForgeUi.nameInput(entry.name, (value) => { name = value; }));
    row.appendChild(makeElement('span', 'ui-tag', forgeKilobytes(entry.bytes) + (entry.modes.length ? '' : ' - no mode')));
    row.appendChild(Ui.button('Rename', () => { Forge.renameSaved(entry.id, name); render(); }));
    row.appendChild(Ui.button('Open', () => {
      const open = () => { if (Forge.loadSaved(entry.id)) forgeBackToEditor(); };
      if (Forge.dirty) Ui.confirm({ title: 'Discard changes?', text: 'The map being edited has changes that were not saved.', yes: 'Open', onYes: open }); else open();
    }, 'primary'));
    row.appendChild(Ui.button('Delete', () => Ui.confirm({ title: 'Delete ' + entry.name + '?', text: 'The saved map is removed for good.', yes: 'Delete', onYes: () => { Forge.deleteSaved(entry.id); render(); } }), 'danger'));
    return row;
  },
});

// ---- Validation: the list of problems; each one jumps to the object ----
Ui.register('forgeCheck', {
  build(root) {
    const body = forgeDialog(root, 'Check the map');
    const render = () => {
      body.replaceChildren();
      const problems = Forge.validate();
      body.appendChild(makeElement('p', 'ui-note', problems.length ? problems.length + ' problem(s). Tap one to look at it.' : 'No problems: the map passes every rule.'));
      for (const problem of problems) body.appendChild(this.problemButton(problem));
      const foot = makeElement('div', 'ui-foot');
      foot.appendChild(Ui.button('Check again', render));
      foot.appendChild(Ui.button('Add callout zones', () => { Ui.toast(Forge.addZoneGrid() + ' zones added'); render(); }));
      foot.appendChild(Ui.button('Add lights', () => { Ui.toast(Forge.addZoneLights() + ' lights added'); render(); }));
      foot.appendChild(Ui.button('Suggest modes', () => { Forge.setModes(Forge.suggestModes()); Ui.toast('Modes: ' + (Forge.map.modes.join(', ') || 'none')); render(); }));
      body.appendChild(foot);
    };
    body.appendChild(makeElement('p', 'ui-note', 'Checking the map...'));
    setTimeout(() => { if (body.isConnected) render(); }, 0);    // the screen opens first (UI-001): the check can take a second on a slow phone
  },
  problemButton(problem) {
    const button = Ui.button(problem, () => {
      const target = Forge.locate(problem);
      if (!target) { Ui.toast('This problem has no place on the map'); return; }
      forgeBackToEditor();
      if (target.list) Forge.select(target.list, target.index);
      ForgeTools.focusOn(target.x, target.y, target.z);
    }, 'fg-problem');
    return button;
  },
});

// ---- Share codes ----
Ui.register('forgeCode', {
  build(root) {
    const body = forgeDialog(root, 'Share code');
    body.appendChild(makeElement('p', 'ui-note', 'Make a code to copy and send, or paste a code you received and press Import. The code holds the whole map.'));
    const area = makeElement('textarea', 'fg-code');
    area.spellcheck = false;
    const message = makeElement('p', 'ui-note', '');
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(Ui.button('Make code', () => { area.value = ForgeShare.exportCode(); message.textContent = area.value.length + ' characters. Select all and copy.'; area.select(); }));
    foot.appendChild(Ui.button('Import', () => {
      const run = () => {
        const result = ForgeShare.importCode(area.value);
        message.textContent = result.error || '';
        message.className = result.error ? 'ui-note fg-error' : 'ui-note';
        if (!result.error) forgeBackToEditor();
      };
      if (Forge.dirty) Ui.confirm({ title: 'Replace the map?', text: 'The map being edited has changes that were not saved.', yes: 'Import', onYes: run }); else run();
    }, 'primary'));
    body.appendChild(area); body.appendChild(message); body.appendChild(foot);
  },
});

// ---- Test-play: modes the map has objectives for ----
Ui.register('forgePlay', {
  build(root) {
    const body = forgeDialog(root, 'Test play');
    const modes = ForgeTools.playableModes();
    body.appendChild(makeElement('p', 'ui-note', modes.length ? 'Pick a mode. You play against bots on this map and come back here when you quit.'
      : 'This map needs spawns first (and the objectives of the mode: flags, points, bomb sites...).'));
    for (const mode of modes) body.appendChild(Ui.button(CAT.modes.byId(mode).name, () => ForgePlay.testPlay(mode)));
  },
});

// ---- Map settings ----
// The usual sizes, plus the map's own when it is another one (a copy of a built-in map), so a row never shows a size the map does not have.
const forgeChoices = (list, current) => (list.includes(current) ? list : list.concat(current).sort((a, b) => a - b));
function forgeSizeRow(label, axis, usual) {
  const values = forgeChoices(usual, Forge.map.size[axis]);
  return Ui.row(label, Ui.cycle(values, values.map((n) => n + ' m'), Forge.map.size[axis], (value) => {
    const size = Forge.map.size.slice();
    size[axis] = value;
    Forge.setSize(size[0], size[1], size[2]);
  }));
}
Ui.register('forgeSettings', {
  build(root) {
    const body = forgeDialog(root, 'Map settings');
    const map = Forge.map, themes = MapRules.themes.map((id) => CAT.themes.byId(id).name);
    body.appendChild(Ui.row('Name', ForgeUi.nameInput(map.name, (value) => Forge.rename(value))));
    body.appendChild(Ui.row('Theme', Ui.cycle(MapRules.themes, themes, map.theme, (value) => Forge.setTheme(value))));
    body.appendChild(forgeSizeRow('Width', 0, FORGE_SIZES));
    body.appendChild(forgeSizeRow('Depth', 2, FORGE_SIZES));
    body.appendChild(forgeSizeRow('Height', 1, FORGE_HEIGHTS));
    const categories = Object.keys(MapRules.sightLimits);
    body.appendChild(Ui.row('Sightline class', Ui.cycle(categories, categories, map.category, (value) => Forge.setCategory(value))));
    body.appendChild(Ui.row('Modes', Ui.button(map.modes.length + ' chosen', () => Ui.open('forgeModes'))));
  },
});

Ui.register('forgeModes', {
  build(root) {
    const body = forgeDialog(root, 'Modes of this map');
    body.appendChild(makeElement('p', 'ui-note', 'The modes the map is offered for. A mode that still lacks something is listed under its name; the check finds the same gaps.'));
    const map = Forge.toMap();
    for (const mode of Object.keys(MapRules.modes)) {
      if (!CAT.modes.byId(mode)) continue;
      const needs = Forge.modeNeeds(map, mode), label = CAT.modes.byId(mode).name + (needs ? ' - needs ' + needs : '');
      body.appendChild(Ui.row(label, Ui.toggle(Forge.map.modes.includes(mode), (on) => {
        const modes = Forge.map.modes.filter((id) => id !== mode);
        Forge.setModes(on ? modes.concat(mode) : modes);
      })));
    }
  },
});

Bus.on('boot', () => injectStyle('forge-style', FORGE_CSS));
