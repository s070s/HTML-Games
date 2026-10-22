// ==== S18 UI: FORGE (MAP EDITOR SCREENS) ====
// The editor screen (a pass-through layer over the 3D view: top bar, tool palette, properties of the selection, status line and the touch buttons)
// and the dialogs it opens: menu, new map, my maps, validation, codes, test-play, map settings, modes. Every screen is built from the Forge model
// (16x-forge.js) and the tools (16x-forge-tools.js); all three devices reach the same commands. Contract: docs/api/forge.md.

const FORGE_PANEL_MIN_WIDTH = 760;          // narrower or lower screens start with the side panels hidden
const FORGE_PANEL_MIN_HEIGHT = 440;
const FORGE_STATUS_SECONDS = 0.2;           // how often the cursor text is refreshed
const FORGE_BUDGET_WARNING = 0.9;           // the budget counter turns amber past this share
const FORGE_LIGHT_COLORS = [[0xffd9a0, 'Warm'], [0xffffff, 'White'], [0x9fc8ff, 'Cool'], [0xff9060, 'Red']];
const FORGE_ELEMENT_NAMES = ['thermal', 'kinetic', 'cryo', 'arc', 'toxin', 'void'];
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
    { label: 'Kind', kind: 'cycle', values: () => MapRules.triggerKinds, get: (o) => o.kind, set: forgeSetTriggerKind },
    { label: 'Peak', kind: 'step', step: 0.5, get: (o) => o.peak, apply: (o, d) => { o.peak = Math.max(0.5, o.peak + d); }, show: (o) => o.kind === 'jumppad' },
    { label: 'Damage', kind: 'step', step: 5, get: (o) => o.damage, apply: (o, d) => { o.damage = Math.max(5, o.damage + d); }, show: (o) => o.kind === 'hazard' },
    { label: 'Element', kind: 'cycle', values: () => FORGE_ELEMENT_NAMES, get: (o) => o.element, set: (o, v) => { o.element = v; }, show: (o) => o.kind === 'hazard' },
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
// Jump pads and teleporters carry their far end; the other kinds carry none of it.
function forgeSetTriggerKind(trigger, kind) {
  for (const key of ['target', 'peak', 'exit', 'yaw', 'damage', 'element']) delete trigger[key];
  trigger.kind = kind;
  const far = [(trigger.min[0] + trigger.max[0]) / 2 + 6, trigger.min[1], (trigger.min[2] + trigger.max[2]) / 2];
  if (kind === 'jumppad') { trigger.target = far; trigger.peak = 3; }
  if (kind === 'teleporter') { trigger.exit = far; trigger.yaw = 90; }
  if (kind === 'hazard') { trigger.damage = 15; trigger.element = 'thermal'; }
}

const ForgeUi = {
  root: null, top: null, left: null, right: null, status: null, touch: null, budget: null, cursorText: null,
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
    this.refresh();
  },
  refresh() {
    if (!this.root || !this.root.isConnected) return;
    this.buildTop();
    this.buildPalette();
    this.buildProperties();
    this.buildStatus();
    this.touch.classList.toggle('show', this.touchShown);
    this.root.classList.toggle('fg-nopanels', !this.panelsShown);
  },
  buildTop() {
    const top = this.top, tools = ForgeTools;
    top.replaceChildren();
    top.appendChild(Ui.button('Menu', () => Ui.open('forgeMenu'), 'primary'));
    const undo = Ui.button('Undo', () => tools.command('undo')), redo = Ui.button('Redo', () => tools.command('redo'));
    undo.disabled = !Forge.canUndo(); redo.disabled = !Forge.canRedo();
    top.appendChild(undo); top.appendChild(redo);
    top.appendChild(Ui.button('Snap ' + tools.snap() + ' m', () => tools.command('snap')));
    top.appendChild(Ui.button('Check', () => Ui.open('forgeCheck')));
    top.appendChild(Ui.button('Test play', () => Ui.open('forgePlay')));
    top.appendChild(Ui.button(this.panelsShown ? 'Hide panels' : 'Panels', () => { this.panelsShown = !this.panelsShown; this.refresh(); }));
    top.appendChild(Ui.button(this.touchShown ? 'Hide buttons' : 'Touch buttons', () => { this.touchShown = !this.touchShown; this.refresh(); }));
    const share = Forge.count() / FORGE_BUDGET;
    this.budget = makeElement('span', 'fg-budget' + (share >= 1 ? ' full' : share >= FORGE_BUDGET_WARNING ? ' warn' : ''), 'Objects ' + Forge.count() + ' / ' + FORGE_BUDGET);
    top.appendChild(this.budget);
    top.appendChild(makeElement('span', 'fg-budget', Forge.map.name + (Forge.dirty ? ' *' : '')));
  },
  buildPalette() {
    const panel = this.left;
    panel.replaceChildren();
    panel.appendChild(makeElement('div', 'ui-group', 'Tools'));
    for (const tool of FORGE_TOOLS) {
      const button = Ui.button(tool.label, () => ForgeTools.setTool(tool.id), ForgeTools.tool === tool.id ? 'primary' : '');
      panel.appendChild(button);
    }
    this.buildToolOptions(panel);
    panel.appendChild(makeElement('div', 'ui-group', 'View'));
    const level = this.stepper('Level', this.fixed(ForgeTools.elevation) + ' m', () => ForgeTools.command('levelDown'), () => ForgeTools.command('levelUp'));
    panel.appendChild(level);
    panel.appendChild(Ui.row('Zones', Ui.toggle(ForgeTools.view.zones, (on) => { ForgeTools.view.zones = on; Forge.announce('tool'); })));
    panel.appendChild(Ui.row('Triggers', Ui.toggle(ForgeTools.view.triggers, (on) => { ForgeTools.view.triggers = on; Forge.announce('tool'); })));
  },
  buildToolOptions(panel) {
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
  buildProperties() {
    const panel = this.right, object = Forge.selected(), list = Forge.selection.list;
    panel.replaceChildren();
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
    this.status.appendChild(document.createTextNode('  ' + FORGE_HELP[Input.device] + (Forge.message ? '  ' + Forge.message : '')));
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
Bus.on('forge.changed', () => ForgeUi.refresh());
Bus.on('input.device', () => { if (Ui.isOpen('forge')) ForgeUi.buildStatus(); });
Bus.on('boot', () => Loop.onFrame('ui', (seconds) => { if (ForgeUi.root) ForgeUi.updateStatus(seconds); }));
// After a test match the editor comes back (this listener runs after the main menu opened, so the editor is on top).
Bus.on('match.stop', () => ForgeTools.afterPlay());

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

// ---- Menu ----
Ui.register('forgeMenu', {
  build(root) {
    const body = forgeDialog(root, 'Map editor');
    const items = makeElement('div', 'ui-menu');
    const add = (label, action, style) => items.appendChild(Ui.button(label, action, style));
    add('Resume editing', () => Ui.back(), 'primary');
    add('Test play', () => Ui.open('forgePlay'));
    add('Check the map', () => Ui.open('forgeCheck'));
    add('Save', () => { if (Forge.saveCurrent()) Ui.toast('Saved'); });
    add('Save as a new map', () => { if (Forge.saveAsNew()) Ui.toast('Saved as a new map'); });
    add('My maps (' + Forge.saved().length + ' / ' + FORGE_MAX_MAPS + ')', () => Ui.open('forgeMaps'));
    add('New map', () => Ui.open('forgeNew'));
    add('Map settings', () => Ui.open('forgeSettings'));
    add('Share code', () => Ui.open('forgeCode'));
    add('Exit editor', () => ForgeUi.exit(), 'danger');
    body.appendChild(items);
    body.appendChild(makeElement('p', 'ui-note', Forge.map.name + (Forge.dirty ? ' (not saved)' : ' (saved)') + ' - ' + Forge.count() + ' of ' + FORGE_BUDGET + ' objects.'));
  },
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
    render();
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
    foot.appendChild(Ui.button('Make code', () => { area.value = Forge.exportCode(); message.textContent = area.value.length + ' characters. Select all and copy.'; area.select(); }));
    foot.appendChild(Ui.button('Import', () => {
      const run = () => {
        const result = Forge.importCode(area.value);
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
    for (const mode of modes) body.appendChild(Ui.button(CAT.modes.byId(mode).name, () => ForgeTools.testPlay(mode)));
  },
});

// ---- Map settings ----
Ui.register('forgeSettings', {
  build(root) {
    const body = forgeDialog(root, 'Map settings');
    const map = Forge.map, themes = MapRules.themes.map((id) => CAT.themes.byId(id).name);
    body.appendChild(Ui.row('Name', ForgeUi.nameInput(map.name, (value) => Forge.rename(value))));
    body.appendChild(Ui.row('Theme', Ui.cycle(MapRules.themes, themes, map.theme, (value) => Forge.setTheme(value))));
    body.appendChild(Ui.row('Width and depth', Ui.cycle(FORGE_SIZES, FORGE_SIZES.map((n) => n + ' m'), map.size[0], (value) => Forge.setSize(value, Forge.map.size[1]))));
    body.appendChild(Ui.row('Height', Ui.cycle(FORGE_HEIGHTS, FORGE_HEIGHTS.map((n) => n + ' m'), map.size[1], (value) => Forge.setSize(Forge.map.size[0], value))));
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
