// ==== S05 INPUT: TOUCH (INP-004, INP-005, INP-006) ====
// DOM overlay: floating left stick (push > 90% sprints), look drag on the rest of the screen, one round button per control row.
// Every finger is tracked by pointer id in a fixed slot pool, so any number of simultaneous touches stay separate.
// Layouts live in Save.data.touchLayouts[presetId][controlId] = { x, y, scale, opacity, hidden } (only changed keys are stored).

const TOUCH_SLOT_COUNT = 10;
const TOUCH_NO_LAYOUT = Object.freeze({});   // a control the player never moved: read per frame while the comm wheel is open, so no new {}
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
const TOUCH_HOLD_MS = 350;              // a button held this long on release does its holdAction (SWAP: previous weapon)
const TOUCH_GYRO_WAIT_MS = 1000;        // no devicemotion event this long after the permission: the sensor is unavailable
const TOUCH_GYRO_KEY = 'controls.touch.gyro', TOUCH_GYRO_MESSAGE = 'Gyro needs HTTPS and motion permission', TOUCH_GYRO_NOTE = ' (needs HTTPS and motion permission)';
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
// need = TouchInput.needs key whose fn() must be true to show it (USE only in modes that need Use held, COMM once a comm wheel exists,
// A1/A2/ULT/GADGET/NADE/HEAL/PRONE only while the player has what they use);
// a need with no fn reads a match flag that later sections set with TouchInput.setFlag (the card button only in matches
// with active cards); 'grenadeCycle' (12c) shows the grenade type button while the player carries two thrown types or more;
// 'breath' (11a flag) shows the hold-breath button (the Walk action) while the player's scope sways (W24).
// holdAction = what a press held TOUCH_HOLD_MS does on release instead of action; mirrorAt = its place in the left-handed preset where
// a plain mirror would cover the minimap or the vitals. Default places keep clear of the phone HUD (hudui test).
// face = the button text: 14 px (ACC-008) and no wider than the button, so long words are short ones (DUCK, LOAD, TOOL).
const TOUCH_CONTROLS = [
  { id: 'stick', label: 'Move stick', face: '', x: 0.14, y: 0.56, size: 120 },
  { id: 'fire', label: 'Fire', face: 'FIRE', action: 'fire', x: 0.91, y: 0.58, size: 84 },
  { id: 'aim', label: 'Aim', face: 'AIM', action: 'alt', x: 0.80, y: 0.40, size: 60 },
  { id: 'jump', label: 'Jump', face: 'JUMP', action: 'jump', x: 0.82, y: 0.82, size: 64, mirrorAt: [0.20, 0.72] },
  { id: 'crouch', label: 'Crouch', face: 'DUCK', action: 'crouch', x: 0.70, y: 0.88, size: 50 },
  { id: 'prone', label: 'Prone', face: 'LIE', action: 'prone', x: 0.53, y: 0.88, size: 36, need: 'prone' },
  { id: 'reload', label: 'Reload', face: 'LOAD', action: 'reload', x: 0.94, y: 0.34, size: 50 },
  { id: 'breath', label: 'Hold breath', face: 'HOLD', action: 'walk', x: 0.70, y: 0.42, size: 46, need: 'breath' },
  { id: 'swap', label: 'Swap weapon (hold: previous)', face: 'SWAP', action: 'nextWeapon', holdAction: 'prevWeapon', x: 0.76, y: 0.21, size: 46, mirrorAt: [0.28, 0.30] },
  { id: 'grenade', label: 'Grenade', face: 'NADE', action: 'grenade', x: 0.60, y: 0.88, size: 46, need: 'grenade' },
  { id: 'heal', label: 'Use heal', face: 'HEAL', action: 'heal', x: 0.94, y: 0.16, size: 42, need: 'heal', mirrorAt: [0.17, 0.10] },
  { id: 'grenadeNext', label: 'Next grenade type', face: 'TYPE', action: 'grenadeNext', x: 0.60, y: 0.74, size: 36, need: 'grenadeCycle' },
  { id: 'ability1', label: 'Ability 1', face: 'A1', action: 'ability1', x: 0.08, y: 0.32, size: 44, need: 'ability1' },
  { id: 'ability2', label: 'Ability 2', face: 'A2', action: 'ability2', x: 0.17, y: 0.32, size: 44, need: 'ability2' },
  { id: 'ultimate', label: 'Ultimate', face: 'ULT', action: 'ultimate', x: 0.26, y: 0.32, size: 44, need: 'ultimate' },
  { id: 'ping', label: 'Ping', face: 'PING', action: 'ping', x: 0.58, y: 0.20, size: 40 },
  { id: 'scoreboard', label: 'Scoreboard', face: 'TAB', action: 'scoreboard', x: 0.42, y: 0.20, size: 40 },
  { id: 'pause', label: 'Pause', face: 'II', action: 'pause', x: 0.50, y: 0.20, size: 40 },
  { id: 'cards', label: 'Use a card', face: 'CARD', action: 'cards', x: 0.34, y: 0.20, size: 40, need: 'cards' },
  { id: 'fireLeft', label: 'Fire (left side)', face: 'FIRE', action: 'fire', x: 0.30, y: 0.62, size: 70, setting: 'touchLeftFire' },
  { id: 'use', label: 'Use / interact', face: 'USE', action: 'use', x: 0.70, y: 0.64, size: 54, need: 'use' },
  { id: 'melee', label: 'Melee', face: 'MELEE', action: 'melee', x: 0.86, y: 0.22, size: 46, mirrorAt: [0.20, 0.22] },
  { id: 'gadget', label: 'Gadget', face: 'TOOL', action: 'gadget', x: 0.35, y: 0.32, size: 44, need: 'gadget' },
  { id: 'comm', label: 'Comm wheel', face: 'CHAT', action: 'comm', x: 0.66, y: 0.20, size: 40, need: 'comm' },
];
const TOUCH_SETTINGS = [
  { key: 'controls.touch.sensitivity', field: 'touchSensitivity', fallback: 1, label: 'Touch look sensitivity', min: 0.2, max: 3, step: 0.05 },
  { key: 'controls.touch.acceleration', field: 'touchAccel', fallback: 0.3, label: 'Touch look acceleration', min: 0, max: 1, step: 0.05 },
  { key: 'controls.touch.autoFire', field: 'touchAutoFire', fallback: true, label: 'Auto-fire when the crosshair is on an enemy' },
  { key: 'controls.touch.tapToFire', field: 'touchTapFire', fallback: false, label: 'Tap the look area to fire' },
  { key: 'controls.touch.leftFire', field: 'touchLeftFire', fallback: false, label: 'Second fire button on the left' },
  { key: 'controls.touch.aimAssist', field: 'touchAimAssist', fallback: 70, label: 'Touch aim assist', min: 0, max: 100, step: 5 },
  { key: TOUCH_GYRO_KEY, field: 'touchGyro', fallback: 'off', label: 'Gyro aim', options: ['off', 'aiming', 'always'], optionLabels: ['Off', 'While aiming', 'Always'] },
  { key: 'controls.touch.gyroSensitivity', field: 'touchGyroSens', fallback: 1, label: 'Gyro sensitivity', min: 0.2, max: 3, step: 0.05 },
  { key: 'controls.touch.layout', field: 'touchLayout', fallback: 'standard', label: 'Touch layout preset', options: TOUCH_PRESETS.map((preset) => preset.id), optionLabels: TOUCH_PRESETS.map((preset) => preset.label) },
  { key: 'controls.touch.show', field: 'touchShow', fallback: 'auto', label: 'Touch controls', options: ['auto', 'on', 'off'], optionLabels: ['When touching', 'Always', 'Never'] },
];

// Phone gyro to look rates (rad/s): turn right is a negative spin about the screen-up axis, look down a negative spin about screen-right (a top edge tipping toward you looks up).
function gyroToLook(rotationRate, angle, out) {
  const axes = GYRO_AXES[((angle % 360) + 360) % 360] || GYRO_AXES[0];   // old iOS reports -90 for landscape-right
  const spinX = rotationRate.beta || 0, spinY = rotationRate.gamma || 0;
  out.right = -(spinX * axes.upX + spinY * axes.upY) * DEG;
  out.down = -(spinX * axes.rightX + spinY * axes.rightY) * DEG;
  return out;
}

// INP-004: the USE button shows only while Use can act: the running mode needs Use held (mode row useButton),
// or a later section's fn in TouchInput.useNeeds is true (S11 revive in downed rulesets, S10 skimmer board on large maps).
function useButtonNeeded() {
  if (!Game.match || !Game.match.rules) return false;
  const mode = CAT.modes.byId(Game.match.rules.mode);
  if (mode && mode.useButton) return true;
  for (let index = 0; index < TouchInput.useNeeds.length; index++) if (TouchInput.useNeeds[index]()) return true;
  return false;
}

// Needs of the buttons that show only while the player has what they use; read once a frame by syncNeeds, at play time only.
function touchHasAbility(slot) { return Game.playerId >= 0 && Abilities.row(Game.playerId, slot) !== null; }
function touchHasHeal() {
  const economy = CAT.economy.byId(currentRules().economy);
  return Game.playerId >= 0 && (Items.consumableCount(Game.playerId) > 0 || (!!economy && economy.slots > 0));   // loot rulesets carry consumables
}

const TouchInput = {
  layer: null, zone: null, live: null, knob: null,
  elements: {},                    // control id -> DOM node
  controlById: {},
  slots: [],                       // fixed pool of finger records
  activeCount: 0, gestureStart: 0, gestureFired: false,
  stick: { slot: null, originX: 0, originY: 0, x: 0, y: 0, sprinting: false },
  editing: false, selected: null, onSelect: null,
  flags: {},                       // match flags read by the TOUCH_CONTROLS 'need' rows that have no needs fn (setFlag)
  shown: false,
  currentPreset: TOUCH_PRESETS[0],
  gyro: { right: 0, down: 0, attached: false, asked: false, unavailable: false, events: 0, timer: 0 },
  needed: [], needBits: 0,         // the need keys of the controls and their last answers (syncNeeds)
  weaponSlotAt: null,              // fn(clientX, clientY) -> weapon slot 1..9 under that point, else 0 (17a weapon bar)
  buttonLook: null,                // fn(control) -> true: that held button's finger also turns the look (17g comm wheel)
  layoutScratch: { x: 0, y: 0, scale: 1, opacity: 1, hidden: false },
  // control.need -> fn() true shows that button. 'comm' stays null until a later section adds the comm wheel and fills it.
  needs: {
    use: () => useButtonNeeded(), comm: null,
    ability1: () => touchHasAbility(SLOT.ABILITY1), ability2: () => touchHasAbility(SLOT.ABILITY2), ultimate: () => touchHasAbility(SLOT.ULTIMATE),
    gadget: () => Game.playerId >= 0 && Gadgets.gadget[Game.playerId] >= 0,
    grenade: () => Game.playerId >= 0 && Gadgets.thrownTotal(Game.playerId) > 0,
    heal: touchHasHeal,
    prone: () => Game.playerId >= 0 && Move.preset(Game.playerId).proneMult > 0,
  },
  useNeeds: [],                    // fn() true -> Use can act outside the mode row (filled by S10, S11)
  stickSprints: null,              // fn() -> false: a full stick push must not press sprint (S10: presets where sprint walks)

  init() {
    this.onMotion = (event) => { this.gyro.events++; if (event.rotationRate) gyroToLook(event.rotationRate, this.screenAngle(), this.gyro); };
    this.buildLayer();
    for (let i = 0; i < TOUCH_SLOT_COUNT; i++) this.slots.push({ pointerId: -1, role: ROLE_NONE, control: null, startX: 0, startY: 0, lastX: 0, lastY: 0, startTime: 0, lastTime: 0, moved: false, weaponSlot: 0 });
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
      if (control.need && !this.needed.includes(control.need)) this.needed.push(control.need);
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
    slot.weaponSlot = control || !this.weaponSlotAt ? 0 : this.weaponSlotAt(event.clientX, event.clientY);   // picked on a still tap (onUp)
    if (control && control.action) this.beginButton(slot, control);
    else if (control) this.beginStick(slot, event, control);
    else if (this.inMoveZone(event.clientX) && !this.stick.slot) this.beginStick(slot, event, null);
    else slot.role = ROLE_LOOK;
  },
  // The floating stick starts on the left, on the right in the left-handed preset.
  inMoveZone(clientX) {
    const share = clientX / window.innerWidth;
    return this.preset().mirror ? share > 1 - TOUCH_MOVE_ZONE : share < TOUCH_MOVE_ZONE;
  },
  onMove(event) {
    const slot = this.findSlot(event.pointerId);
    if (!slot) return;
    if (slot.role === ROLE_STICK) this.moveStick(event);
    else if (slot.role === ROLE_LOOK) this.moveLook(slot, event);
    else if (slot.role === ROLE_DRAG) this.dragControl(slot.control, event);
    else if (slot.role === ROLE_BUTTON && this.buttonLook && this.buttonLook(slot.control)) this.moveLook(slot, event);
    slot.lastX = event.clientX; slot.lastY = event.clientY; slot.lastTime = event.timeStamp;
    if (Math.hypot(event.clientX - slot.startX, event.clientY - slot.startY) > TOUCH_TAP_SLOP) slot.moved = true;
  },
  onUp(event) {
    const slot = this.findSlot(event.pointerId);
    if (!slot) return;
    const tap = !slot.moved && event.timeStamp - slot.startTime < TOUCH_TAP_MS;
    if (slot.role === ROLE_STICK) this.endStick();
    else if (slot.role === ROLE_BUTTON) this.endButton(slot, event);
    if (tap && slot.weaponSlot) Input.pulseAction(Input.actionIndex['slot' + slot.weaponSlot]);   // a still tap on the weapon bar picks that slot
    else if (tap && slot.role === ROLE_LOOK && Input.config.touchTapFire) Input.pulseAction(Input.actionIndex.fire);
    this.freeSlot(slot);
    if (Input.config.touchGyro !== 'off') this.requestGyro();
  },

  // ---- Buttons ----
  beginButton(slot, control) {
    slot.role = ROLE_BUTTON; slot.control = control;
    if (control.holdAction) this.elements[control.id].classList.add('down');   // acts on release: a tap or a hold
    else this.setButton(control, true);
  },
  endButton(slot, event) {
    const control = slot.control;
    if (!control.holdAction) { this.setButton(control, false); return; }
    const held = event.timeStamp - slot.startTime >= TOUCH_HOLD_MS;
    this.elements[control.id].classList.remove('down');
    Input.pulseAction(Input.actionIndex[held ? control.holdAction : control.action]);
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

  // ---- Gyro aim (INP-006): ask once while the setting is on; a refusal, a page that is not https or no sensor data says so once ----
  syncGyro(mode) {
    if (mode !== 'off') { this.requestGyro(); return; }
    window.removeEventListener('devicemotion', this.onMotion);
    const gyro = this.gyro;
    clearTimeout(gyro.timer);
    gyro.attached = gyro.asked = gyro.unavailable = false;
    gyro.right = gyro.down = 0;
    this.markGyroRow('');
  },
  requestGyro() {
    const gyro = this.gyro, motion = window.DeviceMotionEvent;
    if (gyro.attached || gyro.asked || gyro.unavailable) return;
    if (!motion || !window.isSecureContext) { this.failGyro(); return; }
    gyro.asked = true;
    if (typeof motion.requestPermission !== 'function') { this.attachGyro(); return; }
    motion.requestPermission().then((state) => { if (state === 'granted') this.attachGyro(); else this.failGyro(); })
      .catch(() => { gyro.asked = false; /* needs a tap: retried on the next touch */ });
  },
  attachGyro() {
    const gyro = this.gyro;
    gyro.attached = true; gyro.events = 0;
    window.addEventListener('devicemotion', this.onMotion);
    clearTimeout(gyro.timer);   // one sensor wait at a time: an older one must not judge this attach
    gyro.timer = setTimeout(() => { if (gyro.attached && gyro.events === 0) this.failGyro(); }, TOUCH_GYRO_WAIT_MS);
  },
  failGyro() {
    window.removeEventListener('devicemotion', this.onMotion);
    this.gyro.attached = false; this.gyro.unavailable = true;
    this.markGyroRow(TOUCH_GYRO_NOTE);
    emitToast(TOUCH_GYRO_MESSAGE);
  },
  markGyroRow(note) {
    const definition = Settings.definitions.get(TOUCH_GYRO_KEY);
    definition.label = TOUCH_SETTINGS.find((row) => row.key === TOUCH_GYRO_KEY).label + note;
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
    this.syncNeeds();
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
    this.syncGyro(config.touchGyro);
  },

  // ---- Layout (INP-005) ----
  preset() { return this.currentPreset; },
  savedLayout(controlId) {
    const layouts = Save.data.touchLayouts[this.preset().id];
    return layouts && layouts[controlId] ? layouts[controlId] : null;
  },
  // Fills out {x, y, scale, opacity, hidden}: the preset default overlaid with the player's saved changes.
  layoutOf(controlId, out) {
    const control = this.controlById[controlId], preset = this.preset(), saved = this.savedLayout(controlId) || TOUCH_NO_LAYOUT;
    const spot = preset.mirror && control.mirrorAt;
    out.x = saved.x !== undefined ? saved.x : spot ? spot[0] : preset.mirror ? 1 - control.x : control.x;
    out.y = saved.y !== undefined ? saved.y : spot ? spot[1] : control.y;
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
  // Records the need answers it shows, so syncNeeds re-applies on the next change whoever applied last.
  applyAll() {
    this.needBits = this.needBitsNow();
    for (const control of TOUCH_CONTROLS) this.applyControl(control);
  },
  // A need with a function asks it; one without reads its match flag (setFlag).
  needMet(need) { const check = this.needs[need]; return check ? !!check() : !!this.flags[need]; },
  needBitsNow() {
    let bits = 0;
    for (let i = 0; i < this.needed.length; i++) if (this.needMet(this.needed[i])) bits |= 1 << i;
    return bits;
  },
  // Re-applies the layout when a button's need changed since it was last applied (a new match included).
  syncNeeds() { if (this.needBitsNow() !== this.needBits) this.applyAll(); },
  // Shows or hides the controls of a match flag (called on a change only, never per frame).
  setFlag(name, on) {
    if (!!this.flags[name] === !!on) return;
    this.flags[name] = !!on;
    if (this.layer) this.applyAll();
  },
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
  + ' background: rgba(255, 255, 255, 0.14); border: 2px solid rgba(255, 255, 255, 0.5); color: #fff; font: 700 0.875em/1 var(--ui-font); }'   // 14 px faces (ACC-008)
  + '.tc.down { background: rgba(255, 181, 71, 0.55); border-color: var(--ui-accent); } .tc.off { display: none; }'
  + '.tc-stick { background: rgba(255, 255, 255, 0.06); border-style: dashed; }'
  + '.tc-live { position: fixed; left: 0; top: 0; display: none; border-radius: 50%; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.5); pointer-events: none; }'
  + '.tc-live.show { display: block; } .tc-knob { position: absolute; left: 30%; top: 30%; width: 40%; height: 40%; border-radius: 50%; background: rgba(255, 255, 255, 0.55); }'
  + '.tc-layer.editing .tc { outline: 2px dashed rgba(255, 181, 71, 0.8); cursor: grab; } .tc-layer.editing .tc.ghost { display: flex; opacity: 0.3; }'
  + '.tc-layer.editing .tc.selected { outline-style: solid; background: rgba(255, 181, 71, 0.3); }';

Input.sources.push(TouchInput);
Input.addSettings(TOUCH_SETTINGS);
Bus.on('setting', (key) => { if (key === TOUCH_GYRO_KEY && TouchInput.layer) TouchInput.syncGyro(Settings.get(key)); });   // inside the tap that changed it: iOS asks only then
