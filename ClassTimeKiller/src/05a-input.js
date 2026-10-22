// ==== S05 INPUT ====
// One action table (INP-002/003), a binding layer for keyboard, mouse, wheel and gamepad, keyboard + mouse look with pointer lock,
// per-frame sampling into the local player's Actors input fields (INP-009), aim assist (INP-008) and the pause rules (PLT-006).
// 05b adds the touch controls, 05c the gamepad. Devices only call Input.pressAction / releaseAction / addLook / analog.
// Contracts: docs/api/input-ui.md. Look convention: yaw increases to the LEFT (DATA-002), so looking right lowers yaw.

const INPUT_BUFFER_SECONDS = 0.10;                                      // INP-009: jump and fire presses stay valid this long
const INPUT_BUFFER_TICKS = Math.round(INPUT_BUFFER_SECONDS * TICK_RATE);
const MAX_LOOK_PITCH = 89 * DEG;
const MOUSE_DEGREES_PER_COUNT = 0.05;       // at sensitivity 1.0
const WHEEL_NOTCH = 100;                    // wheel delta units that count as one notch
const WHEEL_LINE_UNITS = 33;                // browsers that report lines instead of pixels
const WHEEL_PAGE_UNITS = 800;
const MAX_QUEUED_PULSES = 8;
const NO_BINDING = '';
const NEVER_PRESSED = -1000000;               // lastPressTick value far outside the buffer window
const BINDING_SLOTS = ['kbm', 'kbm', 'pad'];   // per action: two keyboard/mouse slots and one gamepad slot
const AIM_ASSIST = { coneRadians: 3 * DEG, slowdown: 0.40, magnetismRadiansPerSecond: 1.5 * DEG };   // INP-008
// INP-007 vibration: damage strength = amount / damageFull; blasts reach blastReach x their radius (fading with distance);
// own fire with a weapon of a heavy class gives a short fixed buzz.
const RUMBLE = { damageFull: 100, damageMs: 160, blastReach: 2, blastMs: 240, fireStrength: 0.35, fireMs: 70,
  heavyClasses: ['heavy', 'explosive', 'power', 'shotgun', 'sniper'] };

// ---- DOM helpers (S05 is the earliest section that builds DOM; touch controls and the UI share them) ----
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
// A typing target: its keys belong to the field, so game bindings and menu navigation leave them alone (INP-010).
function isTextField(element) {
  if (!element) return false;
  return element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && element.type === 'text');
}
function injectStyle(id, css) {
  let style = document.getElementById(id);
  if (!style) { style = document.createElement('style'); style.id = id; document.head.appendChild(style); }
  style.textContent = css;
}

// ---- The action table (ARC: one table only). Bindings are strings: 'Key:KeyW', 'Mouse:0', 'Wheel:up', 'Pad:7'. ----
// button = BTN bit written to Actors.buttons; axis/sign = digital move axis; slot = weapon slot request; event = no sim effect, emits 'input.action'.
// toggle = hold/toggle setting exists (INP-002); buffered = press buffered 0.10 s (INP-009); always = also works while a menu is open.
const ACTION_ROWS = [
  { id: 'forward', label: 'Move forward', group: 'Movement', axis: 'moveZ', sign: 1, kbm: ['Key:KeyW'] },
  { id: 'back', label: 'Move back', group: 'Movement', axis: 'moveZ', sign: -1, kbm: ['Key:KeyS'] },
  { id: 'left', label: 'Strafe left', group: 'Movement', axis: 'moveX', sign: -1, kbm: ['Key:KeyA'] },
  { id: 'right', label: 'Strafe right', group: 'Movement', axis: 'moveX', sign: 1, kbm: ['Key:KeyD'] },
  { id: 'jump', label: 'Jump', group: 'Movement', button: BTN.JUMP, buffered: true, kbm: ['Key:Space'], pad: 'Pad:0' },
  { id: 'crouch', label: 'Crouch / slide', group: 'Movement', button: BTN.CROUCH, toggle: true, kbm: ['Key:ControlLeft'], pad: 'Pad:1' },
  { id: 'sprint', label: 'Sprint', group: 'Movement', button: BTN.SPRINT, toggle: true, kbm: ['Key:ShiftLeft'], pad: 'Pad:10' },
  { id: 'walk', label: 'Walk', group: 'Movement', button: BTN.WALK, toggle: true, kbm: ['Key:AltLeft'], pad: 'Pad:8+1' },
  { id: 'prone', label: 'Prone', group: 'Movement', button: BTN.PRONE, toggle: true },
  { id: 'fire', label: 'Fire', group: 'Combat', button: BTN.FIRE, buffered: true, toggle: true, kbm: ['Mouse:0'], pad: 'Pad:7' },
  { id: 'alt', label: 'Aim / alt fire', group: 'Combat', button: BTN.ALT, toggle: true, kbm: ['Mouse:2'], pad: 'Pad:6' },
  { id: 'reload', label: 'Reload', group: 'Combat', button: BTN.RELOAD, kbm: ['Key:KeyR'], pad: 'Pad:2' },
  { id: 'use', label: 'Use / interact', group: 'Combat', button: BTN.USE, toggle: true, kbm: ['Key:KeyE'], pad: 'Pad:13' },
  { id: 'melee', label: 'Melee', group: 'Combat', button: BTN.MELEE, kbm: ['Key:KeyV'], pad: 'Pad:11' },
  { id: 'grenade', label: 'Grenade', group: 'Combat', button: BTN.GRENADE, kbm: ['Key:KeyG'], pad: 'Pad:4' },
  { id: 'grenadeNext', label: 'Next grenade type', group: 'Combat', button: BTN.CYCLE_GRENADE, kbm: ['Key:KeyN'] },
  { id: 'gadget', label: 'Gadget', group: 'Combat', button: BTN.GADGET, kbm: ['Key:KeyC'], pad: 'Pad:8+2' },
  { id: 'heal', label: 'Use heal / shield item', group: 'Combat', button: BTN.HEAL, kbm: ['Key:KeyH'], pad: 'Pad:8+0' },
  { id: 'ability1', label: 'Ability 1', group: 'Abilities', button: BTN.ABILITY1, kbm: ['Key:KeyQ'], pad: 'Pad:5' },
  { id: 'ability2', label: 'Ability 2', group: 'Abilities', button: BTN.ABILITY2, kbm: ['Key:KeyF'], pad: 'Pad:14' },
  { id: 'ultimate', label: 'Ultimate', group: 'Abilities', button: BTN.ULTIMATE, kbm: ['Key:KeyX'], pad: 'Pad:12' },
  { id: 'ping', label: 'Ping (hold = wheel)', group: 'Abilities', button: BTN.PING, kbm: ['Key:KeyZ'], pad: 'Pad:15' },
  { id: 'nextWeapon', label: 'Next weapon', group: 'Weapons', button: BTN.NEXT_WEAPON, kbm: ['Wheel:down'], pad: 'Pad:3' },
  { id: 'prevWeapon', label: 'Previous weapon', group: 'Weapons', button: BTN.PREV_WEAPON, kbm: ['Wheel:up'] },
  { id: 'slot1', label: 'Weapon slot 1', group: 'Weapons', slot: 1, kbm: ['Key:Digit1'] },
  { id: 'slot2', label: 'Weapon slot 2', group: 'Weapons', slot: 2, kbm: ['Key:Digit2'] },
  { id: 'slot3', label: 'Weapon slot 3', group: 'Weapons', slot: 3, kbm: ['Key:Digit3'] },
  { id: 'slot4', label: 'Weapon slot 4', group: 'Weapons', slot: 4, kbm: ['Key:Digit4'] },
  { id: 'slot5', label: 'Weapon slot 5', group: 'Weapons', slot: 5, kbm: ['Key:Digit5'] },
  { id: 'slot6', label: 'Weapon slot 6', group: 'Weapons', slot: 6, kbm: ['Key:Digit6'] },
  { id: 'slot7', label: 'Weapon slot 7', group: 'Weapons', slot: 7, kbm: ['Key:Digit7'] },
  { id: 'slot8', label: 'Weapon slot 8', group: 'Weapons', slot: 8, kbm: ['Key:Digit8'] },
  { id: 'slot9', label: 'Weapon slot 9', group: 'Weapons', slot: 9, kbm: ['Key:Digit9'] },
  { id: 'scoreboard', label: 'Scoreboard', group: 'Interface', event: true, toggle: true, kbm: ['Key:Tab'], pad: 'Pad:8' },
  { id: 'pause', label: 'Pause', group: 'Interface', event: true, kbm: ['Key:Escape'], pad: 'Pad:9' },
  { id: 'comm', label: 'Comm wheel', group: 'Interface', event: true, kbm: ['Key:KeyT'], pad: 'Pad:8+3' },
  { id: 'buyMenu', label: 'Buy menu / loadout', group: 'Interface', event: true, kbm: ['Key:KeyB'] },
  { id: 'cards', label: 'Use a card', group: 'Interface', event: true, kbm: ['Key:KeyY'], pad: 'Pad:16' },
  { id: 'perfHud', label: 'Performance HUD', group: 'Interface', event: true, always: true, kbm: ['Key:F10'] },
  { id: 'botDebug', label: 'Bot debug view', group: 'Interface', event: true, always: true, kbm: ['Key:F9'] },
];
const ACTION_COUNT = ACTION_ROWS.length;

const MOUSE_LABELS = ['Left Mouse', 'Middle Mouse', 'Right Mouse', 'Mouse 4', 'Mouse 5'];
const KEY_LABELS = {
  Space: 'Space', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
  AltLeft: 'Left Alt', AltRight: 'Right Alt', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', CapsLock: 'Caps Lock',
};
// Glyph names per controller family (LT-H-066: prompts follow the connected pad). Index = standard-mapping button number.
const PAD_GLYPHS = {
  letters: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'],
  shapes: ['Cross', 'Circle', 'Square', 'Triangle', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'PS'],
  generic: ['Button 1', 'Button 2', 'Button 3', 'Button 4', 'L1', 'R1', 'L2', 'R2', 'Select', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'],
};

const HOLD_TOGGLE_OPTIONS = ['hold', 'toggle'];
const KBM_SETTINGS = [
  { key: 'controls.mouseSensitivity', field: 'mouseSensitivity', fallback: 1, label: 'Mouse sensitivity', min: 0.1, max: 10, step: 0.05 },
  { key: 'controls.mouseDpi', field: 'mouseDpi', fallback: 800, label: 'Mouse DPI (for cm per 360)', min: 100, max: 32000, step: 50 },
  { key: 'controls.rawMouse', field: 'rawMouse', fallback: true, label: 'Raw mouse input (no OS acceleration)' },
  { key: 'controls.invertY', field: 'invertY', fallback: false, label: 'Invert look Y (mouse and touch)' },
  { key: 'controls.adsMultiplier', field: 'adsMultiplier', fallback: 0.8, label: 'Aim sensitivity multiplier', min: 0.1, max: 2, step: 0.05 },
  { key: 'controls.vibration', field: 'vibration', fallback: true, label: 'Vibration (controller and phone)' },
];
// INP-002 hold/toggle: one setting per action row that has toggle: true.
const TOGGLE_SETTINGS = ACTION_ROWS.filter((row) => row.toggle).map((row) => ({
  key: 'controls.toggle.' + row.id, field: 'toggle.' + row.id, fallback: 'hold', label: row.label + ': hold or toggle',
  options: HOLD_TOGGLE_OPTIONS, optionLabels: ['Hold', 'Toggle'],
}));

const Input = {
  aimAssistTarget: null,   // fn(id, out) -> bool; out {x,y,z} gets the nearest valid hitbox point (INP-008). Filled by later sections.
  aimAssistFilters: [],    // fn(id, point) -> false refuses the found point (S12: never through smoke); later sections push
  aimAssistOverride: null, // fn() -> 0..100 aim assist floor for this match (the device slider is raised to it), -1 = no floor (S11: difficulty)
  resumeBlocked: null,     // fn() -> true while the pause menu's Resume must wait (S07: the graphics context is lost, PLT-005)
  actions: ACTION_ROWS,    // the single action table
  device: 'kbm',           // last used device: 'kbm' | 'touch' | 'gamepad' (MOV-018 assists, INP-008 aim assist)
  autoFire: true,          // touch option (INP-006); later sections read it
  autoFireTarget: false,   // set each frame by updateAssist: the crosshair is on the aim assist target (a visible enemy)
  padStyle: 'letters',     // glyph family of the active pad: 'letters' (A B X Y), 'shapes' (cross, circle...) or 'generic'
  uiOpen: false,           // set by the UI: a menu is open, game actions are ignored
  locked: false,           // pointer lock held
  lockRefused: false,      // the browser refused the last lock request (needs a click)
  resumePending: false,
  capture: null,           // { device, callback } while the rebinding screen waits for a press
  config: {},              // cached settings, filled from settingRows
  settingRows: [],
  settingsDirty: true,
  sources: [],             // { init(), frame(seconds), reset?(), applyConfig?(config) } - touch and gamepad register here
  actionIndex: {},
  bound: [],               // per action: [kbm0, kbm1, pad0]
  bindingsSource: null,
  bindingMap: new Map(),   // binding string -> [action index]
  holdCount: new Uint8Array(ACTION_COUNT),
  toggled: new Uint8Array(ACTION_COUNT),
  effective: new Uint8Array(ACTION_COUNT),
  toggleMode: new Uint8Array(ACTION_COUNT),
  queued: new Uint8Array(ACTION_COUNT),
  lastPressTick: new Int32Array(ACTION_COUNT).fill(NEVER_PRESSED),
  buttonActions: [], axisActions: [], buttonBits: new Uint32Array(ACTION_COUNT),
  queuedTotal: 0,
  pendingButtons: 0, pendingSlot: 0, pendingAge: 0, latchedButtons: 0, latchedSlot: 0,
  writtenButtons: 0, seenButtons: 0, writtenTick: -1,
  wheelAccumulator: 0,
  analog: { moveX: 0, moveZ: 0 },
  look: { mouseX: 0, mouseY: 0, assistedX: 0, assistedY: 0 },   // radians this frame, +x = right, +y = down
  aim: { yaw: 0, pitch: 0, playerId: -1, spawnCount: -1 },
  assist: { active: false, slowdown: 1, error: 0 },
  assistPoint: { x: 0, y: 0, z: 0 },
  canvas: null, prompt: null, promptShown: false, started: false,
  actionEvent: { action: '', down: false },
  deviceEvent: { device: 'kbm' },

  // ---- Settings: every source declares its rows once; the same rows define and read the settings ----
  addSettings(rows) {
    for (const row of rows) {
      Settings.define(row.key, row.fallback, { label: row.label, category: row.category || 'controls', min: row.min, max: row.max, step: row.step, options: row.options, optionLabels: row.optionLabels });
      this.settingRows.push(row);
    }
  },
  refreshConfig() {
    this.settingsDirty = false;
    for (const row of this.settingRows) this.config[row.field] = Settings.get(row.key);
    for (let i = 0; i < ACTION_COUNT; i++) this.toggleMode[i] = this.config['toggle.' + ACTION_ROWS[i].id] === 'toggle' ? 1 : 0;
    this.autoFire = !!this.config.touchAutoFire;
    for (const source of this.sources) if (source.applyConfig) source.applyConfig(this.config);
  },
  // Hand movement for a full turn, in centimetres, at a sensitivity and mouse DPI (INP-001).
  cmPer360(sensitivity, dpi) { return 360 / (sensitivity * MOUSE_DEGREES_PER_COUNT) / dpi * 2.54; },

  // ---- Bindings (INP-002) ----
  defaultsOf(row) { return [row.kbm && row.kbm[0] || NO_BINDING, row.kbm && row.kbm[1] || NO_BINDING, row.pad || NO_BINDING]; },
  bindingDevice(binding) { return binding.startsWith('Pad:') ? 'pad' : 'kbm'; },
  loadBindings() {
    const saved = Save.data ? Save.data.bindings : {};
    this.bindingsSource = saved;
    this.bound.length = 0;
    for (let i = 0; i < ACTION_COUNT; i++) {
      const slots = this.defaultsOf(ACTION_ROWS[i]);
      const stored = saved[ACTION_ROWS[i].id];
      if (Array.isArray(stored)) for (let s = 0; s < BINDING_SLOTS.length; s++) if (typeof stored[s] === 'string' && this.slotAccepts(s, stored[s])) slots[s] = stored[s];
      this.bound.push(slots);
    }
    this.rebuildMap();
  },
  slotAccepts(slot, binding) { return binding === NO_BINDING || this.bindingDevice(binding) === BINDING_SLOTS[slot]; },
  rebuildMap() {
    this.bindingMap.clear();
    for (let i = 0; i < ACTION_COUNT; i++) {
      for (const binding of this.bound[i]) {
        if (binding === NO_BINDING) continue;
        if (!this.bindingMap.has(binding)) this.bindingMap.set(binding, []);
        this.bindingMap.get(binding).push(i);
      }
    }
    this.clearAll();
  },
  getBinding(actionId, slot) { return this.bound[this.actionIndex[actionId]][slot]; },
  // Returns the ids of other actions that now share the binding (conflict flag), or null when the binding was refused.
  setBinding(actionId, slot, binding) {
    const index = this.actionIndex[actionId];
    if (index === undefined || !this.slotAccepts(slot, binding)) return null;
    this.bound[index][slot] = binding;
    this.persistBinding(index);
    this.rebuildMap();
    return this.conflictsOf(actionId);
  },
  persistBinding(index) {
    const row = ACTION_ROWS[index];
    const isDefault = this.bound[index].join('|') === this.defaultsOf(row).join('|');
    if (isDefault) delete Save.data.bindings[row.id]; else Save.data.bindings[row.id] = this.bound[index].slice();
    Save.scheduleSave();
  },
  resetBindings(actionId) {
    for (let i = 0; i < ACTION_COUNT; i++) {
      if (actionId && ACTION_ROWS[i].id !== actionId) continue;
      this.bound[i] = this.defaultsOf(ACTION_ROWS[i]);
      this.persistBinding(i);
    }
    this.rebuildMap();
  },
  conflictsOf(actionId) {
    const index = this.actionIndex[actionId], others = [];
    for (const binding of this.bound[index]) {
      if (binding === NO_BINDING) continue;
      for (const other of this.bindingMap.get(binding)) if (other !== index && !others.includes(ACTION_ROWS[other].id)) others.push(ACTION_ROWS[other].id);
    }
    return others;
  },
  allConflicts() { return ACTION_ROWS.filter((row) => this.conflictsOf(row.id).length > 0).map((row) => row.id); },
  bindingLabel(binding) {
    if (binding === NO_BINDING) return 'Unbound';
    const kind = binding.slice(0, binding.indexOf(':')), name = binding.slice(binding.indexOf(':') + 1);
    if (kind === 'Mouse') return MOUSE_LABELS[+name] || 'Mouse ' + (+name + 1);
    if (kind === 'Wheel') return 'Wheel ' + (name === 'up' ? 'Up' : 'Down');
    if (kind === 'Pad') return name.split('+').map((button) => PAD_GLYPHS[this.padStyle][+button] || 'Button ' + button).join(' + ');   // 'Pad:8+2' = View + X
    return KEY_LABELS[name] || name.replace(/^Key|^Digit/, '');
  },
  // The rebinding screen waits for the next press of a device kind ('kbm' or 'pad'); callback(binding) gets it.
  // Esc cancels (callback(null) on any device), Backspace clears a keyboard/mouse slot (callback('')).
  captureNext(device, callback) { this.capture = { device, callback }; },
  cancelCapture() { this.capture = null; },
  deliverCapture(binding) {
    const capture = this.capture;
    if (!capture) return false;
    const cancel = binding === 'Key:Escape';
    if (!cancel && this.bindingDevice(binding) !== capture.device) return false;
    this.capture = null;
    capture.callback(cancel ? null : binding === 'Key:Backspace' ? NO_BINDING : binding);
    return true;
  },

  // ---- Action state ----
  isHeld(actionId) { return this.effective[this.actionIndex[actionId]] === 1; },
  isToggleMode(actionId) { return this.toggleMode[this.actionIndex[actionId]] === 1; },
  // A toggled action whose effect ended by other means (the scoreboard closed with its Close button) starts from off again.
  resetToggle(actionId) {
    const index = this.actionIndex[actionId];
    if (!this.toggleMode[index]) return;
    this.toggled[index] = 0;
    this.effective[index] = 0;
  },
  // True when the action was pressed within the last 0.10 s of simulation time (jump before landing, fire during a cooldown).
  buffered(actionId) { return Sim.tick - this.lastPressTick[this.actionIndex[actionId]] <= INPUT_BUFFER_TICKS; },
  consumeBuffered(actionId) { this.lastPressTick[this.actionIndex[actionId]] = NEVER_PRESSED; },
  // Only rows flagged buffered keep a press time, so buffered() is false for every other action.
  markPressed(index) { if (ACTION_ROWS[index].buffered) this.lastPressTick[index] = Sim.tick; },
  pressAction(index) {
    this.holdCount[index]++;
    if (this.holdCount[index] === 1) this.risingEdge(index);
  },
  releaseAction(index) {
    if (this.holdCount[index] === 0) return;
    this.holdCount[index]--;
    if (this.holdCount[index] === 0) this.fallingEdge(index);
  },
  pulseAction(index) { this.pressAction(index); this.releaseAction(index); },
  risingEdge(index) {
    const row = ACTION_ROWS[index];
    this.markPressed(index);
    if (this.toggleMode[index]) { this.toggled[index] ^= 1; this.effective[index] = this.toggled[index]; } else this.effective[index] = 1;
    if (!this.effective[index]) { if (row.event) this.emitAction(row.id, false); return; }   // a toggled-off event row reports its release here
    if (row.button) this.pendingButtons |= row.button;
    if (row.slot) this.pendingSlot = row.slot;
    if (row.event) this.emitAction(row.id, true);
  },
  fallingEdge(index) {
    if (this.toggleMode[index]) return;
    this.effective[index] = 0;
    if (ACTION_ROWS[index].event) this.emitAction(ACTION_ROWS[index].id, false);
  },
  emitAction(id, down) {
    if (id === 'pause' && down && Game.state === 'playing') Game.pause('menu');
    this.actionEvent.action = id;
    this.actionEvent.down = down;
    Bus.emit('input.action', this.actionEvent);
  },
  // A toggled event action that is on (the scoreboard overlay) must hear its own second press although a screen is open: that press turns it off.
  releasesToggle(index) { return ACTION_ROWS[index].event === true && this.toggleMode[index] === 1 && this.effective[index] === 1; },
  // Returns true when at least one action took the binding (callers then stop the browser's default).
  bindingDown(binding) {
    const list = this.bindingMap.get(binding);
    if (!list) return false;
    let handled = false;
    for (let i = 0; i < list.length; i++) {
      if (this.uiOpen && !ACTION_ROWS[list[i]].always && !this.releasesToggle(list[i])) continue;
      this.pressAction(list[i]);
      handled = true;
    }
    return handled;
  },
  bindingUp(binding) {
    const list = this.bindingMap.get(binding);
    if (list) for (let i = 0; i < list.length; i++) this.releaseAction(list[i]);
  },
  // Wheel notches: one weapon per notch even when several arrive inside one frame (queued, LT-L-027).
  bindingPulse(binding) {
    const list = this.bindingMap.get(binding);
    if (!list || this.uiOpen) return;
    for (let i = 0; i < list.length; i++) {
      const index = list[i];
      if (!ACTION_ROWS[index].button) { this.pulseAction(index); continue; }
      this.markPressed(index);
      if (this.queued[index] < MAX_QUEUED_PULSES) { this.queued[index]++; this.queuedTotal++; }
    }
  },
  // Drops every held, latched and queued input (focus loss, pause, rebinding, disconnect): nothing may stay stuck.
  clearAll() {
    this.holdCount.fill(0); this.toggled.fill(0); this.effective.fill(0); this.queued.fill(0);
    this.queuedTotal = 0; this.pendingButtons = 0; this.pendingSlot = 0; this.pendingAge = 0;
    this.latchedButtons = 0; this.latchedSlot = 0; this.wheelAccumulator = 0;
    this.lastPressTick.fill(NEVER_PRESSED);   // Sim.tick restarts at 0 in a new match; an old press must not look recent
    this.look.mouseX = this.look.mouseY = this.look.assistedX = this.look.assistedY = 0;
    for (const source of this.sources) if (source.reset) source.reset();
  },
  // Devices add look in radians: x positive = right, y positive = down (callers apply their own invert).
  addLook(dx, dy, assisted) {
    if (assisted) { this.look.assistedX += dx; this.look.assistedY += dy; } else { this.look.mouseX += dx; this.look.mouseY += dy; }
  },
  setDevice(name) {
    if (this.device === name) return;
    this.device = name;
    this.deviceEvent.device = name;
    Bus.emit('input.device', this.deviceEvent);
  },

  // ---- Keyboard, mouse, wheel ----
  onKeyDown(event) {
    if (isTextField(event.target)) return;
    this.setDevice('kbm');
    const binding = 'Key:' + event.code;
    if (event.repeat) { if (this.bindingMap.has(binding) && !this.uiOpen) event.preventDefault(); return; }
    if (this.deliverCapture(binding)) { event.preventDefault(); return; }
    if (this.bindingDown(binding)) event.preventDefault();
  },
  onKeyUp(event) { this.bindingUp('Key:' + event.code); },
  onPointerDown(event) {
    if (event.pointerType !== 'mouse') { this.setDevice('touch'); return; }
    this.setDevice('kbm');
    const binding = 'Mouse:' + event.button;
    if (this.deliverCapture(binding)) { event.preventDefault(); return; }
    if (this.uiOpen) return;
    if (Game.state === 'playing' && this.needsLock()) { this.resumePending = Game.paused; this.requestLock(); return; }
    if (this.bindingDown(binding)) event.preventDefault();
  },
  onPointerUp(event) { if (event.pointerType === 'mouse') this.bindingUp('Mouse:' + event.button); },
  onMouseMove(event) {
    if (!this.locked) return;
    this.setDevice('kbm');
    const scale = this.config.mouseSensitivity * MOUSE_DEGREES_PER_COUNT * DEG;
    this.addLook(event.movementX * scale, event.movementY * scale * (this.config.invertY ? -1 : 1), false);
  },
  onWheel(event) {
    if (!this.capture && (this.uiOpen || Game.state !== 'playing')) return;   // a rebinding capture may take the wheel inside menus
    event.preventDefault();
    this.setDevice('kbm');
    const unit = event.deltaMode === 1 ? WHEEL_LINE_UNITS : event.deltaMode === 2 ? WHEEL_PAGE_UNITS : 1;
    this.wheelAccumulator += event.deltaY * unit;
    while (Math.abs(this.wheelAccumulator) >= WHEEL_NOTCH) {
      const direction = this.wheelAccumulator < 0 ? 'up' : 'down';
      this.wheelAccumulator -= Math.sign(this.wheelAccumulator) * WHEEL_NOTCH;
      const binding = 'Wheel:' + direction;
      if (!this.deliverCapture(binding)) this.bindingPulse(binding);
    }
  },

  // ---- Pointer lock (INP-001) and the pause rules (PLT-006) ----
  canLock() { return !Game.headless && !!this.canvas && !!this.canvas.requestPointerLock; },
  needsLock() { return this.canLock() && this.device === 'kbm' && !this.locked; },
  requestLock() {
    const options = this.config.rawMouse ? { unadjustedMovement: true } : undefined;
    try {
      const result = this.canvas.requestPointerLock(options);
      if (result && result.catch) result.catch((error) => this.onLockPromiseRejected(error));
    } catch (error) { this.requestPlainLock(); }
  },
  requestPlainLock() {
    try { this.canvas.requestPointerLock(); } catch (error) { this.onLockRefused(); }
  },
  // Raw input not supported: silent fallback to the normal lock. Any other rejection is a refusal (about 1 s after Esc).
  onLockPromiseRejected(error) {
    if (error && error.name === 'NotSupportedError') this.requestPlainLock(); else this.onLockRefused();
  },
  exitLock() {
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (error) { /* already unlocked */ }
  },
  setLocked(locked) {
    const wasLocked = this.locked;
    this.locked = locked;
    if (locked) {
      this.lockRefused = false;
      this.look.mouseX = this.look.mouseY = 0;
      if (this.resumePending) this.finishResume();
    } else if (wasLocked && Game.state === 'playing') this.autoPause('pointerlock');
    this.syncPrompt();
  },
  onLockRefused() {
    const resuming = this.resumePending;
    this.lockRefused = resuming || Game.paused;
    this.resumePending = false;
    if (resuming && Game.paused) Bus.emit('input.relock', null);   // only a refused Resume drops the menu for the click prompt
    this.syncPrompt();
  },
  finishResume() {
    this.resumePending = false;
    this.lockRefused = false;
    Game.resume();
  },
  // The pause menu's Resume: lock first (needs the click), resume once the lock is granted. Refused while a blocker holds (PLT-005).
  requestResume() {
    if (this.resumeBlocked && this.resumeBlocked()) return;
    if (!this.needsLock()) { this.finishResume(); return; }
    this.resumePending = true;
    this.requestLock();
  },
  autoPause(reason) {
    this.clearAll();
    Game.pause(reason);
  },
  // "Click to play" / "Click to resume": shown while a match runs on kbm without the lock.
  syncPrompt() {
    if (!this.prompt) return;
    const wanted = Game.state === 'playing' && !this.uiOpen && this.needsLock();
    if (wanted === this.promptShown) return;
    this.promptShown = wanted;
    this.prompt.classList.toggle('show', wanted);
    this.prompt.textContent = this.lockRefused ? 'Click to resume' : 'Click to play';
  },
  // strength 0..1 (clamped), milliseconds >= 0. The phone motor has no strength, so a weaker rumble is a shorter buzz.
  rumble(strength, milliseconds) {
    if (!this.config.vibration) return;
    const level = clamp(+strength || 0, 0, 1), duration = Math.max(+milliseconds || 0, 0);
    if (level === 0 || duration === 0) return;
    if (this.device === 'gamepad') PadInput.rumble(level, duration);
    else if (this.device === 'touch' && navigator.vibrate) navigator.vibrate(Math.max(1, Math.round(duration * level)));
  },
  // INP-007 vibration sources: damage to the local player, blasts near them and their own heavy fire.
  rumbleDamage(event) {
    if (event.target === Game.playerId && event.amount > 0) this.rumble(event.amount / RUMBLE.damageFull, RUMBLE.damageMs);
  },
  rumbleBlast(event) {
    const id = Game.playerId;
    if (id < 0 || !Actors.alive[id]) return;
    const reach = event.radius * RUMBLE.blastReach;
    const distance = Math.hypot(event.x - Actors.x[id], event.y - Actors.eyeY(id), event.z - Actors.z[id]);
    if (distance < reach) this.rumble(1 - distance / reach, RUMBLE.blastMs);
  },
  rumbleFire(event) {
    if (event.id === Game.playerId && event.mode !== 'melee' && RUMBLE.heavyClasses.includes(event.weaponClass)) this.rumble(RUMBLE.fireStrength, RUMBLE.fireMs);
  },

  // ---- Per-frame sampling (Loop 'input' phase) ----
  frame(seconds) {
    if (this.bindingsSource !== Save.data.bindings) this.loadBindings();
    if (this.settingsDirty) this.refreshConfig();
    this.analog.moveX = this.analog.moveZ = 0;
    for (let i = 0; i < this.sources.length; i++) this.sources[i].frame(seconds);
    this.syncPrompt();
    const id = Game.playerId;
    if (id < 0 || !Game.isRunning()) { this.discardFrame(); return; }
    this.syncAim(id);
    this.applyLook(id, seconds);
    this.writeActor(id, seconds);
  },
  discardFrame() {
    this.look.mouseX = this.look.mouseY = this.look.assistedX = this.look.assistedY = 0;
    this.pendingButtons = 0; this.pendingSlot = 0; this.queued.fill(0); this.queuedTotal = 0;
    this.autoFireTarget = false;
  },
  // Turns the local player's view (S08 teleporter exits, MOV-019): writeActor would otherwise put the old angles back.
  setAim(yaw, pitch) { this.aim.yaw = yaw; this.aim.pitch = pitch; },
  // A new spawn or a new player actor resets the view angles to the actor's facing.
  syncAim(id) {
    const aim = this.aim;
    if (aim.playerId === id && aim.spawnCount === Actors.spawnCount[id]) return;
    aim.playerId = id; aim.spawnCount = Actors.spawnCount[id];
    aim.yaw = Actors.yaw[id]; aim.pitch = Actors.pitch[id];
  },
  applyLook(id, seconds) {
    const look = this.look, aim = this.aim;
    const scale = this.effective[this.actionIndex.alt] ? this.config.adsMultiplier : 1;
    const slowdown = this.updateAssist(id, seconds);
    const yaw = (look.mouseX + look.assistedX * slowdown) * scale;
    const pitch = (look.mouseY + look.assistedY * slowdown) * scale;
    aim.yaw = wrapAngle(aim.yaw - yaw);
    aim.pitch = clamp(aim.pitch - pitch, -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
    look.mouseX = look.mouseY = look.assistedX = look.assistedY = 0;
  },
  // The device slider, raised to the difficulty's aim assist floor (rules.botSkill.aimAssist 0-100, -1 = no floor). Never for the mouse.
  assistStrength() {
    if (this.device !== 'touch' && this.device !== 'gamepad') return 0;
    const slider = this.device === 'touch' ? this.config.touchAimAssist : this.config.padAimAssist;
    const floor = this.aimAssistOverride ? this.aimAssistOverride() : -1;   // S11 fills it from rules.botSkill.aimAssist
    return Math.max(slider, floor) / 100;
  },
  // The aim assist target point into out, when the hook finds one and no filter refuses it.
  findAssistTarget(id, out) {
    if (!this.aimAssistTarget || !this.aimAssistTarget(id, out)) return false;
    for (let i = 0; i < this.aimAssistFilters.length; i++) if (!this.aimAssistFilters[i](id, out)) return false;
    return true;
  },
  // INP-008: slow the look inside a 3 degree cone and pull toward the target (no snap). Returns the look multiplier.
  // The same single target search sets autoFireTarget (INP-006): the crosshair is within the target's torso width.
  updateAssist(id, seconds) {
    const assist = this.assist, strength = this.assistStrength(), autoFire = this.autoFire && this.device === 'touch';
    assist.active = false; assist.slowdown = 1; assist.error = 0;
    this.autoFireTarget = false;
    if ((!strength && !autoFire) || !this.findAssistTarget(id, this.assistPoint)) return 1;
    const point = this.assistPoint, aim = this.aim;
    const dx = point.x - Actors.x[id], dy = point.y - Actors.eyeY(id), dz = point.z - Actors.z[id];
    const errorYaw = wrapAngle(Math.atan2(dx, dz) - aim.yaw);
    const errorPitch = Math.atan2(dy, Math.hypot(dx, dz)) - aim.pitch;
    const error = Math.hypot(errorYaw * Math.cos(aim.pitch), errorPitch);
    assist.error = error;
    if (autoFire) this.autoFireTarget = error < Math.atan2(TORSO_RADIUS, Math.hypot(dx, dy, dz));
    if (!strength || error > AIM_ASSIST.coneRadians) return 1;
    assist.active = true;
    assist.slowdown = 1 - AIM_ASSIST.slowdown * strength;
    const lookActive = this.look.assistedX !== 0 || this.look.assistedY !== 0;
    if (!lookActive && !this.effective[this.actionIndex.fire] && !this.effective[this.actionIndex.alt]) return assist.slowdown;
    const pull = Math.min(error, AIM_ASSIST.magnetismRadiansPerSecond * strength * seconds) / (error || 1);
    aim.yaw = wrapAngle(aim.yaw + errorYaw * pull);
    aim.pitch = clamp(aim.pitch + errorPitch * pull, -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
    return assist.slowdown;
  },
  writeActor(id, seconds) {
    this.advanceLatch(seconds);
    let x = this.analog.moveX, z = this.analog.moveZ;
    for (let i = 0; i < this.axisActions.length; i++) {
      const row = ACTION_ROWS[this.axisActions[i]];
      if (!this.effective[this.axisActions[i]]) continue;
      if (row.axis === 'moveX') x += row.sign; else z += row.sign;
    }
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    let buttons = this.latchedButtons;
    for (let i = 0; i < this.buttonActions.length; i++) { const index = this.buttonActions[i]; if (this.effective[index]) buttons |= this.buttonBits[index]; }
    if (this.autoFire && this.autoFireTarget && this.device === 'touch') buttons |= BTN.FIRE;
    this.writtenButtons = buttons;
    this.writtenTick = Sim.tick;
    Actors.moveX[id] = x; Actors.moveZ[id] = z;
    Actors.aimYaw[id] = this.aim.yaw; Actors.aimPitch[id] = this.aim.pitch;
    Actors.buttons[id] = buttons; Actors.slotRequest[id] = this.latchedSlot;
  },
  // INP-009: a press stays in the written buttons until a sim step has consumed it. A press that arrives while the
  // sim last saw the same bit high waits (up to 0.10 s) for a step that sees it low, so every tap still makes an edge.
  advanceLatch(seconds) {
    if (Sim.tick !== this.writtenTick) { this.seenButtons = this.writtenButtons; this.latchedButtons = 0; this.latchedSlot = 0; }
    if (this.queuedTotal) this.releaseQueue();
    const fresh = this.pendingButtons & ~this.seenButtons;
    this.latchedButtons |= fresh;
    this.pendingButtons &= ~fresh;
    this.pendingAge = this.pendingButtons ? this.pendingAge + seconds : 0;
    if (this.pendingAge > INPUT_BUFFER_SECONDS) { this.pendingButtons = 0; this.pendingAge = 0; }
    if (this.pendingSlot) { this.latchedSlot = this.pendingSlot; this.pendingSlot = 0; }
  },
  releaseQueue() {
    for (let i = 0; i < this.buttonActions.length; i++) {
      const index = this.buttonActions[i], bit = this.buttonBits[index];
      if (!this.queued[index] || ((this.pendingButtons | this.latchedButtons) & bit)) continue;
      this.queued[index]--; this.queuedTotal--;
      this.pendingButtons |= bit;
    }
  },

  // ---- Start-up (boot event): listeners, frame hook, sources ----
  init() {
    if (this.started) return;
    this.started = true;
    this.canvas = document.getElementById('view');
    this.prompt = makeElement('div', 'lock-prompt');
    document.getElementById('overlay').appendChild(this.prompt);
    injectStyle('input-style', '.lock-prompt { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(5, 8, 12, 0.55); '
      + 'color: var(--ui-text); font-size: 1.6em; letter-spacing: 0.05em; z-index: 30; } .lock-prompt.show { display: flex; }');
    this.loadBindings();
    this.refreshConfig();
    this.attachListeners();
    for (const source of this.sources) source.init();
    Loop.onFrame('input', (seconds) => this.frame(seconds));
  },
  attachListeners() {
    const on = (target, type, handler, options) => target.addEventListener(type, handler, options);
    on(window, 'keydown', (event) => this.onKeyDown(event));
    on(window, 'keyup', (event) => this.onKeyUp(event));
    on(window, 'pointerdown', (event) => this.onPointerDown(event), true);
    on(window, 'pointerup', (event) => this.onPointerUp(event), true);
    on(window, 'pointercancel', (event) => this.onPointerUp(event), true);
    on(window, 'mousemove', (event) => this.onMouseMove(event));
    on(window, 'wheel', (event) => this.onWheel(event), { passive: false });
    on(window, 'contextmenu', (event) => event.preventDefault());
    on(window, 'blur', () => this.autoPause('blur'));
    on(document, 'visibilitychange', () => { if (document.hidden) this.autoPause('hidden'); });
    on(document, 'pointerlockchange', () => this.setLocked(document.pointerLockElement === this.canvas));
    on(document, 'pointerlockerror', () => this.onLockRefused());
  },
};

ACTION_ROWS.forEach((row, index) => {
  Input.actionIndex[row.id] = index;
  if (row.button) { Input.buttonActions.push(index); Input.buttonBits[index] = row.button; }
  if (row.axis) Input.axisActions.push(index);
});
Input.addSettings(KBM_SETTINGS);
Input.addSettings(TOGGLE_SETTINGS);

Bus.on('boot', () => Input.init());
Bus.on('setting', () => { Input.settingsDirty = true; });
Bus.on('damage', (event) => Input.rumbleDamage(event));
Bus.on('explosion', (event) => Input.rumbleBlast(event));
Bus.on('weapon.fire', (event) => Input.rumbleFire(event));
Bus.on('game.pause', () => { Input.clearAll(); Input.exitLock(); });
Bus.on('match.start', () => {
  Input.clearAll();
  Input.aim.playerId = -1;
  if (Input.needsLock()) Input.requestLock();   // works when the match starts inside the click that asked for it
});
Bus.on('match.stop', () => { Input.clearAll(); Input.exitLock(); Input.resumePending = false; Input.lockRefused = false; Input.syncPrompt(); });
