// ==== S05 INPUT: TOUCH (INP-004, INP-005, INP-006) ====
// DOM overlay: floating left stick (push > 90% sprints), look drag on the rest of the screen, one round button per control row.
// Every finger is tracked by pointer id in a fixed slot pool, so any number of simultaneous touches stay separate.
// Layouts live in Save.data.touchLayouts[presetId][controlId] = { x, y, scale, opacity, hidden } (only changed keys are stored).

const TOUCH_SLOT_COUNT = 10;
const TOUCH_STICK_RADIUS = 56;          // css px of finger travel for a full push, at control scale 1
const TOUCH_STICK_DEADZONE = 0.12;
const TOUCH_SPRINT_ON = 0.9;            // INP-004
const TOUCH_SPRINT_OFF = 0.8;           // hysteresis so the sprint does not flicker at the edge
const TOUCH_MOVE_ZONE = 0.42;           // a touch starting left of this share of the screen width begins the stick
const TOUCH_RADIANS_PER_PIXEL = 0.003;  // look at sensitivity 1.0
const TOUCH_ACCEL_SPEED = 2;            // px per ms that earns the full acceleration gain
const TOUCH_MIN_EVENT_MS = 4;
const TOUCH_TAP_MS = 220;               // tap-to-fire: a short, still touch on the look area
const TOUCH_TAP_SLOP = 12;              // px
const TOUCH_FOUR_FINGER_MS = 300;       // four fingers down within this time toggle the performance HUD (ARC-040)
const TOUCH_SCALE_MIN = 0.5, TOUCH_SCALE_MAX = 2;          // INP-005
const TOUCH_OPACITY_MIN = 0.2, TOUCH_OPACITY_MAX = 1;
const TOUCH_DEFAULT_OPACITY = 0.7;
const ROLE_NONE = 0, ROLE_STICK = 1, ROLE_LOOK = 2, ROLE_BUTTON = 3, ROLE_DRAG = 4;
// Rotation axes of a phone held in each screen orientation: which device axes point screen-up and screen-right.
const GYRO_AXES = {
  0: { upX: 0, upY: 1, rightX: 1, rightY: 0 }, 90: { upX: 1, upY: 0, rightX: 0, rightY: -1 },
  180: { upX: 0, upY: -1, rightX: -1, rightY: 0 }, 270: { upX: -1, upY: 0, rightX: 0, rightY: 1 },
};

// Layout presets: the same control rows, mirrored for left-handed play or scaled down for small phones. Edits are saved per preset.
const TOUCH_PRESETS = [
  { id: 'standard', label: 'Standard', mirror: false, scale: 1 },
  { id: 'compact', label: 'Compact', mirror: false, scale: 0.8 },
  { id: 'mirrored', label: 'Left-handed', mirror: true, scale: 1 },
];
// Control rows: x, y = centre as a share of the screen, size in css px, action = Input action id, setting = config flag that shows it,
// need = TouchInput.needs key whose fn() must be true to show it (USE only in modes that need Use held, COMM once a comm wheel exists).
const TOUCH_CONTROLS = [
  { id: 'stick', label: 'Move stick', face: '', x: 0.14, y: 0.72, size: 120 },
  { id: 'fire', label: 'Fire', face: 'FIRE', action: 'fire', x: 0.91, y: 0.58, size: 84 },
  { id: 'aim', label: 'Aim', face: 'AIM', action: 'alt', x: 0.80, y: 0.40, size: 60 },
  { id: 'jump', label: 'Jump', face: 'JUMP', action: 'jump', x: 0.82, y: 0.82, size: 64 },
  { id: 'crouch', label: 'Crouch', face: 'CROUCH', action: 'crouch', x: 0.70, y: 0.88, size: 50 },
  { id: 'reload', label: 'Reload', face: 'RELOAD', action: 'reload', x: 0.94, y: 0.34, size: 50 },
  { id: 'swap', label: 'Swap weapon', face: 'SWAP', action: 'nextWeapon', x: 0.70, y: 0.20, size: 46 },
  { id: 'grenade', label: 'Grenade', face: 'NADE', action: 'grenade', x: 0.60, y: 0.88, size: 46 },
  { id: 'ability1', label: 'Ability 1', face: 'A1', action: 'ability1', x: 0.08, y: 0.14, size: 46 },
  { id: 'ability2', label: 'Ability 2', face: 'A2', action: 'ability2', x: 0.17, y: 0.14, size: 46 },
  { id: 'ultimate', label: 'Ultimate', face: 'ULT', action: 'ultimate', x: 0.26, y: 0.14, size: 46 },
  { id: 'ping', label: 'Ping', face: 'PING', action: 'ping', x: 0.58, y: 0.07, size: 40 },
  { id: 'scoreboard', label: 'Scoreboard', face: 'TAB', action: 'scoreboard', x: 0.42, y: 0.07, size: 40 },
  { id: 'pause', label: 'Pause', face: 'II', action: 'pause', x: 0.50, y: 0.07, size: 40 },
  { id: 'fireLeft', label: 'Fire (left side)', face: 'FIRE', action: 'fire', x: 0.30, y: 0.62, size: 70, setting: 'touchLeftFire' },
  { id: 'use', label: 'Use / interact', face: 'USE', action: 'use', x: 0.70, y: 0.64, size: 54, need: 'use' },
  { id: 'melee', label: 'Melee', face: 'MELEE', action: 'melee', x: 0.82, y: 0.22, size: 46 },
  { id: 'gadget', label: 'Gadget', face: 'GADGET', action: 'gadget', x: 0.35, y: 0.14, size: 46 },
  { id: 'comm', label: 'Comm wheel', face: 'COMM', action: 'comm', x: 0.66, y: 0.07, size: 40, need: 'comm' },
];
const TOUCH_SETTINGS = [
  { key: 'controls.touch.sensitivity', field: 'touchSensitivity', fallback: 1, label: 'Touch look sensitivity', min: 0.2, max: 3, step: 0.05 },
  { key: 'controls.touch.acceleration', field: 'touchAccel', fallback: 0.3, label: 'Touch look acceleration', min: 0, max: 1, step: 0.05 },
  { key: 'controls.touch.autoFire', field: 'touchAutoFire', fallback: true, label: 'Auto-fire when the crosshair is on an enemy' },
  { key: 'controls.touch.tapToFire', field: 'touchTapFire', fallback: false, label: 'Tap the look area to fire' },
  { key: 'controls.touch.leftFire', field: 'touchLeftFire', fallback: false, label: 'Second fire button on the left' },
  { key: 'controls.touch.aimAssist', field: 'touchAimAssist', fallback: 70, label: 'Touch aim assist', min: 0, max: 100, step: 5 },
  { key: 'controls.touch.gyro', field: 'touchGyro', fallback: 'off', label: 'Gyro aim', options: ['off', 'aiming', 'always'], optionLabels: ['Off', 'While aiming', 'Always'] },
  { key: 'controls.touch.gyroSensitivity', field: 'touchGyroSens', fallback: 1, label: 'Gyro sensitivity', min: 0.2, max: 3, step: 0.05 },
  { key: 'controls.touch.layout', field: 'touchLayout', fallback: 'standard', label: 'Touch layout preset', options: TOUCH_PRESETS.map((preset) => preset.id), optionLabels: TOUCH_PRESETS.map((preset) => preset.label) },
  { key: 'controls.touch.show', field: 'touchShow', fallback: 'auto', label: 'Touch controls', options: ['auto', 'on', 'off'], optionLabels: ['When touching', 'Always', 'Never'] },
];

// Phone gyro to look rates (rad/s): turn right is a negative spin about the screen-up axis, look down a negative spin about screen-right (a top edge tipping toward you looks up).
function gyroToLook(rotationRate, angle, out) {
  const axes = GYRO_AXES[angle] || GYRO_AXES[0];
  const spinX = rotationRate.beta || 0, spinY = rotationRate.gamma || 0;
  out.right = -(spinX * axes.upX + spinY * axes.upY) * DEG;
  out.down = -(spinX * axes.rightX + spinY * axes.rightY) * DEG;
  return out;
}

// INP-004: the USE button shows only while the running mode needs Use held (mode row useButton).
function useButtonNeeded() {
  const mode = Game.match && Game.match.rules ? CAT.modes.byId(Game.match.rules.mode) : null;
  return !!mode && mode.useButton;
}

const TouchInput = {
  layer: null, zone: null, live: null, knob: null,
  elements: {},                    // control id -> DOM node
  controlById: {},
  slots: [],                       // fixed pool of finger records
  activeCount: 0, gestureStart: 0, gestureFired: false,
  stick: { slot: null, originX: 0, originY: 0, x: 0, y: 0, sprinting: false },
  editing: false, selected: null, onSelect: null,
  shown: false,
  currentPreset: TOUCH_PRESETS[0],
  gyro: { right: 0, down: 0, attached: false },
  layoutScratch: { x: 0, y: 0, scale: 1, opacity: 1, hidden: false },
  // control.need -> fn() true shows that button. 'comm' stays null until a later section adds the comm wheel and fills it.
  needs: { use: () => useButtonNeeded(), comm: null },
  stickSprints: null,              // fn() -> false: a full stick push must not press sprint (S10: presets where sprint walks)

  init() {
    this.buildLayer();
    for (let i = 0; i < TOUCH_SLOT_COUNT; i++) this.slots.push({ pointerId: -1, role: ROLE_NONE, control: null, startX: 0, startY: 0, lastX: 0, lastY: 0, startTime: 0, lastTime: 0, moved: false });
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) Input.setDevice('touch');
    document.addEventListener('gesturestart', (event) => event.preventDefault());
    this.applyAll();
  },
  buildLayer() {
    injectStyle('touch-style', TOUCH_CSS);
    this.layer = makeElement('div', 'tc-layer');
    this.zone = makeElement('div', 'tc-zone');
    this.live = makeElement('div', 'tc-live');
    this.knob = makeElement('div', 'tc-knob');
    this.live.appendChild(this.knob);
    this.layer.appendChild(this.zone);
    this.layer.appendChild(this.live);
    for (const control of TOUCH_CONTROLS) {
      const element = makeElement('div', control.id === 'stick' ? 'tc tc-stick' : 'tc', control.face);
      element.dataset.control = control.id;
      this.elements[control.id] = element;
      this.controlById[control.id] = control;
      this.layer.appendChild(element);
    }
    for (const target of [this.zone].concat(Object.values(this.elements))) this.listen(target);
    this.layer.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
    this.layer.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    document.getElementById('overlay').appendChild(this.layer);
  },
  listen(target) {
    target.addEventListener('pointerdown', (event) => this.onDown(event, target));
    target.addEventListener('pointermove', (event) => this.onMove(event, target));
    target.addEventListener('pointerup', (event) => this.onUp(event, target));
    target.addEventListener('pointercancel', (event) => this.onUp(event, target));
  },

  // ---- Finger slots ----
  findSlot(pointerId) {
    for (let i = 0; i < TOUCH_SLOT_COUNT; i++) if (this.slots[i].pointerId === pointerId) return this.slots[i];
    return null;
  },
  takeSlot(event) {
    const slot = this.findSlot(-1);
    if (!slot) return null;
    slot.pointerId = event.pointerId; slot.role = ROLE_NONE; slot.control = null; slot.moved = false;
    slot.startX = slot.lastX = event.clientX; slot.startY = slot.lastY = event.clientY;
    slot.startTime = slot.lastTime = event.timeStamp;
    this.activeCount++;
    return slot;
  },
  freeSlot(slot) { slot.pointerId = -1; slot.role = ROLE_NONE; slot.control = null; this.activeCount--; },
  noteFinger(event) {
    if (this.activeCount === 1) { this.gestureStart = event.timeStamp; this.gestureFired = false; }
    if (this.activeCount !== 4 || this.gestureFired || event.timeStamp - this.gestureStart > TOUCH_FOUR_FINGER_MS) return;
    this.gestureFired = true;
    Input.emitAction('perfHud', true);
    Input.emitAction('botDebug', true);   // ARC-040: on touch both debug views toggle from the same tap
  },

  // ---- Pointer events: one set of handlers for the look zone and every button ----
  onDown(event, target) {
    const slot = this.takeSlot(event);
    if (!slot) return;
    event.preventDefault();
    try { target.setPointerCapture(event.pointerId); } catch (error) { /* synthetic or already released pointer */ }
    Input.setDevice('touch');
    this.noteFinger(event);
    const control = target === this.zone ? null : this.controlById[target.dataset.control];
    if (this.editing) { this.beginEdit(slot, control); return; }
    if (control && control.action) this.beginButton(slot, control);
    else if (control) this.beginStick(slot, event, control);
    else if (event.clientX < window.innerWidth * TOUCH_MOVE_ZONE && !this.stick.slot) this.beginStick(slot, event, null);
    else slot.role = ROLE_LOOK;
  },
  onMove(event) {
    const slot = this.findSlot(event.pointerId);
    if (!slot) return;
    if (slot.role === ROLE_STICK) this.moveStick(event);
    else if (slot.role === ROLE_LOOK) this.moveLook(slot, event);
    else if (slot.role === ROLE_DRAG) this.dragControl(slot.control, event);
    slot.lastX = event.clientX; slot.lastY = event.clientY; slot.lastTime = event.timeStamp;
    if (Math.hypot(event.clientX - slot.startX, event.clientY - slot.startY) > TOUCH_TAP_SLOP) slot.moved = true;
  },
  onUp(event) {
    const slot = this.findSlot(event.pointerId);
    if (!slot) return;
    if (slot.role === ROLE_STICK) this.endStick();
    else if (slot.role === ROLE_BUTTON) this.setButton(slot.control, false);
    else if (slot.role === ROLE_LOOK && this.isTap(slot, event)) Input.pulseAction(Input.actionIndex.fire);
    this.freeSlot(slot);
    if (!this.gyro.attached && Input.config.touchGyro !== 'off') this.requestGyro();
  },
  isTap(slot, event) { return Input.config.touchTapFire && !slot.moved && event.timeStamp - slot.startTime < TOUCH_TAP_MS; },

  // ---- Buttons ----
  beginButton(slot, control) {
    slot.role = ROLE_BUTTON; slot.control = control;
    this.setButton(control, true);
  },
  setButton(control, down) {
    const index = Input.actionIndex[control.action];
    this.elements[control.id].classList.toggle('down', down);
    if (down) Input.pressAction(index); else Input.releaseAction(index);   // last: a pause press resets this module
  },

  // ---- Floating stick (INP-004) ----
  beginStick(slot, event, control) {
    const stick = this.stick, size = this.layoutOf('stick', this.layoutScratch).scale * TOUCH_CONTROLS[0].size;
    slot.role = ROLE_STICK;
    stick.slot = slot;
    stick.originX = control ? this.elements.stick.getBoundingClientRect().left + size / 2 : event.clientX;
    stick.originY = control ? this.elements.stick.getBoundingClientRect().top + size / 2 : event.clientY;
    this.live.style.width = this.live.style.height = size + 'px';
    this.live.style.transform = 'translate(' + (stick.originX - size / 2) + 'px,' + (stick.originY - size / 2) + 'px)';
    this.live.classList.add('show');
    this.moveStick(event);
  },
  moveStick(event) {
    const stick = this.stick, radius = TOUCH_STICK_RADIUS * this.layoutOf('stick', this.layoutScratch).scale;
    const dx = event.clientX - stick.originX, dy = event.clientY - stick.originY;
    const length = Math.hypot(dx, dy) || 1;
    const push = Math.min(length, radius) / radius;
    const scaled = push < TOUCH_STICK_DEADZONE ? 0 : (push - TOUCH_STICK_DEADZONE) / (1 - TOUCH_STICK_DEADZONE);
    stick.x = dx / length * scaled;
    stick.y = dy / length * scaled;
    this.knob.style.transform = 'translate(' + (dx / length * Math.min(length, radius)) + 'px,' + (dy / length * Math.min(length, radius)) + 'px)';
    this.updateSprint(push);
  },
  updateSprint(push) {
    const stick = this.stick, index = Input.actionIndex.sprint;
    if (!stick.sprinting && push > TOUCH_SPRINT_ON && (!this.stickSprints || this.stickSprints())) { stick.sprinting = true; Input.pressAction(index); }
    else if (stick.sprinting && push < TOUCH_SPRINT_OFF) { stick.sprinting = false; Input.releaseAction(index); }
  },
  endStick() {
    const stick = this.stick;
    this.updateSprint(0);
    stick.slot = null; stick.x = stick.y = 0;
    this.live.classList.remove('show');
    this.knob.style.transform = '';
  },

  // ---- Look drag with acceleration (INP-006) ----
  moveLook(slot, event) {
    const config = Input.config;
    const dx = event.clientX - slot.lastX, dy = event.clientY - slot.lastY;
    const speed = Math.hypot(dx, dy) / Math.max(event.timeStamp - slot.lastTime, TOUCH_MIN_EVENT_MS);
    const gain = 1 + config.touchAccel * clamp(speed / TOUCH_ACCEL_SPEED, 0, 2);
    const scale = TOUCH_RADIANS_PER_PIXEL * config.touchSensitivity * gain;
    Input.addLook(dx * scale, dy * scale * (config.invertY ? -1 : 1), true);
  },

  // ---- Gyro aim (INP-006): request permission on iOS, then add the rotation rate while enabled ----
  requestGyro() {
    const motion = window.DeviceMotionEvent;
    if (this.gyro.attached || !motion) return;
    if (typeof motion.requestPermission !== 'function') { this.attachGyro(); return; }
    motion.requestPermission().then((state) => { if (state === 'granted') this.attachGyro(); }).catch(() => { /* needs a tap: retried on the next touch */ });
  },
  attachGyro() {
    this.gyro.attached = true;
    window.addEventListener('devicemotion', (event) => { if (event.rotationRate) gyroToLook(event.rotationRate, this.screenAngle(), this.gyro); });
  },
  screenAngle() { return window.screen.orientation ? window.screen.orientation.angle : (window.orientation || 0); },
  gyroEnabled() {
    const mode = Input.config.touchGyro;
    return mode === 'always' || (mode === 'aiming' && Input.effective[Input.actionIndex.alt] === 1);
  },

  // ---- Frame ----
  frame(seconds) {
    this.syncVisible();
    if (!this.shown) return;
    Input.analog.moveX += this.stick.x;
    Input.analog.moveZ -= this.stick.y;
    if (!this.gyro.attached || !this.gyroEnabled()) return;
    const sensitivity = Input.config.touchGyroSens * seconds;
    Input.addLook(this.gyro.right * sensitivity, this.gyro.down * sensitivity * (Input.config.invertY ? -1 : 1), true);
  },
  shouldShow() {
    if (this.editing) return true;
    if (Game.state !== 'playing' || Game.paused || Input.uiOpen) return false;
    const mode = Input.config.touchShow;
    return mode === 'on' || (mode === 'auto' && Input.device === 'touch');
  },
  syncVisible() {
    const wanted = this.shouldShow();
    if (wanted === this.shown) return;
    this.shown = wanted;
    this.layer.classList.toggle('show', wanted);
    if (!wanted) Input.clearAll();
  },
  reset() {
    for (const slot of this.slots) { slot.pointerId = -1; slot.role = ROLE_NONE; slot.control = null; }
    this.activeCount = 0;
    this.stick.slot = null; this.stick.x = this.stick.y = 0; this.stick.sprinting = false;
    if (!this.layer) return;
    this.live.classList.remove('show');
    for (const element of Object.values(this.elements)) element.classList.remove('down');
  },
  applyConfig(config) {
    this.currentPreset = TOUCH_PRESETS.find((preset) => preset.id === config.touchLayout) || TOUCH_PRESETS[0];   // looked up once, not on every touch move
    if (!this.layer) return;
    this.applyAll();
    if (config.touchGyro !== 'off') this.requestGyro();
  },

  // ---- Layout (INP-005) ----
  preset() { return this.currentPreset; },
  savedLayout(controlId) {
    const layouts = Save.data.touchLayouts[this.preset().id];
    return layouts && layouts[controlId] ? layouts[controlId] : null;
  },
  // Fills out {x, y, scale, opacity, hidden}: the preset default overlaid with the player's saved changes.
  layoutOf(controlId, out) {
    const control = this.controlById[controlId], preset = this.preset(), saved = this.savedLayout(controlId) || {};
    out.x = saved.x !== undefined ? saved.x : (preset.mirror ? 1 - control.x : control.x);
    out.y = saved.y !== undefined ? saved.y : control.y;
    out.scale = saved.scale !== undefined ? saved.scale : preset.scale;
    out.opacity = saved.opacity !== undefined ? saved.opacity : TOUCH_DEFAULT_OPACITY;
    out.hidden = !!saved.hidden;
    return out;
  },
  // A control can never leave the screen: the centre stays half its size inside every edge.
  clampPosition(controlId, out) {
    const control = this.controlById[controlId], half = control.size * out.scale / 2;
    const halfX = Math.min(0.5, half / window.innerWidth), halfY = Math.min(0.5, half / window.innerHeight);
    out.x = clamp(out.x, halfX, 1 - halfX);
    out.y = clamp(out.y, halfY, 1 - halfY);
    return out;
  },
  setProperty(controlId, key, value) {
    const layouts = Save.data.touchLayouts;
    const preset = layouts[this.preset().id] || (layouts[this.preset().id] = {});
    const saved = preset[controlId] || (preset[controlId] = {});
    const merged = this.layoutOf(controlId, this.layoutScratch);
    if (key === 'scale') merged.scale = clamp(value, TOUCH_SCALE_MIN, TOUCH_SCALE_MAX);
    else if (key === 'opacity') merged.opacity = clamp(value, TOUCH_OPACITY_MIN, TOUCH_OPACITY_MAX);
    else if (key === 'hidden') merged.hidden = !!value;
    else if (key === 'position') { merged.x = value.x; merged.y = value.y; }
    this.clampPosition(controlId, merged);
    Object.assign(saved, { x: merged.x, y: merged.y, scale: merged.scale, opacity: merged.opacity, hidden: merged.hidden });
    Save.scheduleSave();
    this.applyControl(this.controlById[controlId]);
  },
  getProperty(controlId, key) { return this.layoutOf(controlId, this.layoutScratch)[key]; },
  resetLayout() {
    delete Save.data.touchLayouts[this.preset().id];
    Save.scheduleSave();
    this.applyAll();
  },
  applyAll() { for (const control of TOUCH_CONTROLS) this.applyControl(control); },
  needMet(need) { const check = this.needs[need]; return !!check && !!check(); },
  applyControl(control) {
    const element = this.elements[control.id], layout = this.layoutOf(control.id, this.layoutScratch);
    const optionOff = (control.setting && !Input.config[control.setting]) || (control.need && !this.needMet(control.need));
    const size = control.size * layout.scale;
    element.style.left = layout.x * 100 + '%';
    element.style.top = layout.y * 100 + '%';
    element.style.width = element.style.height = size + 'px';
    element.style.opacity = layout.hidden || optionOff ? '' : layout.opacity;
    element.classList.toggle('off', (layout.hidden || !!optionOff) && !this.editing);
    element.classList.toggle('ghost', (layout.hidden || !!optionOff) && this.editing);
    element.classList.toggle('selected', this.editing && this.selected === control.id);
  },

  // ---- Layout editor (the screen lives in the UI section) ----
  setEditing(editing) {
    this.editing = editing;
    this.layer.classList.toggle('editing', editing);
    this.select(null);
    this.applyAll();
  },
  select(controlId) {
    this.selected = controlId;
    this.applyAll();
    if (this.onSelect) this.onSelect(controlId);
  },
  beginEdit(slot, control) {
    if (!control) { this.select(null); return; }
    slot.role = ROLE_DRAG; slot.control = control;
    this.select(control.id);
  },
  dragControl(control, event) {
    const rect = this.layer.getBoundingClientRect();
    this.setProperty(control.id, 'position', { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  },
};

const TOUCH_CSS = '.tc-layer { position: fixed; left: var(--safe-left); right: var(--safe-right); top: var(--safe-top); bottom: var(--safe-bottom); display: none; z-index: 5; touch-action: none; }'
  + '.tc-layer.show { display: block; } .tc-zone { position: absolute; inset: 0; touch-action: none; }'
  + '.tc { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; display: flex; align-items: center; justify-content: center; touch-action: none;'
  + ' background: rgba(255, 255, 255, 0.14); border: 2px solid rgba(255, 255, 255, 0.5); color: #fff; font: 700 0.62em var(--ui-font); letter-spacing: 0.04em; }'
  + '.tc.down { background: rgba(255, 181, 71, 0.55); border-color: var(--ui-accent); } .tc.off { display: none; }'
  + '.tc-stick { background: rgba(255, 255, 255, 0.06); border-style: dashed; }'
  + '.tc-live { position: fixed; left: 0; top: 0; display: none; border-radius: 50%; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.5); pointer-events: none; }'
  + '.tc-live.show { display: block; } .tc-knob { position: absolute; left: 30%; top: 30%; width: 40%; height: 40%; border-radius: 50%; background: rgba(255, 255, 255, 0.55); }'
  + '.tc-layer.editing .tc { outline: 2px dashed rgba(255, 181, 71, 0.8); cursor: grab; } .tc-layer.editing .tc.ghost { display: flex; opacity: 0.3; }'
  + '.tc-layer.editing .tc.selected { outline-style: solid; background: rgba(255, 181, 71, 0.3); }';

Input.sources.push(TouchInput);
Input.addSettings(TOUCH_SETTINGS);
Bus.on('setting', (key) => { if (key === 'controls.touch.gyro' && TouchInput.layer) TouchInput.requestGyro(); });
Bus.on('match.start', () => { if (TouchInput.layer) TouchInput.applyAll(); });   // need-gated buttons follow the new mode
