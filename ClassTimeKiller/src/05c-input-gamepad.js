// ==== S05 INPUT: GAMEPAD (INP-007) ====
// Standard-mapping pads: button bindings through Input.bindingDown/Up, sticks through Input.analog and Input.addLook,
// menu navigation through the 'input.menu' event, vibration through PadInput.rumble. Polled once per frame, only while a pad is connected.

const PAD_BUTTON_COUNT = 17;
const PAD_PRESS_THRESHOLD = 0.5;            // analog triggers count as pressed past this
const PAD_LOOK_DEGREES_PER_SECOND = 200;    // full stick deflection at sensitivity 1.0
const PAD_TURBO_EDGE = 0.95;                // 'dynamic' curve: holding the stick this far out speeds the turn up
const PAD_TURBO_SECONDS = 0.5;              // time to reach the full turbo gain
const PAD_TURBO_GAIN = 0.5;
const PAD_MENU_STICK_THRESHOLD = 0.6;
const PAD_MENU_REPEAT_FIRST = 0.35;         // seconds before a held direction repeats in menus
const PAD_MENU_REPEAT = 0.12;
const PAD_BINDINGS = Array.from({ length: PAD_BUTTON_COUNT }, (unused, index) => 'Pad:' + index);   // built once: no string concat per press
// INP-007 second layer: while View (Share / Select) is held, a button with a chord binding 'Pad:8+<button>' uses it instead
// (every one of the 16 standard buttons already has a default action).
const PAD_MODIFIER = 8;
const PAD_CAPTURE_START = 9;                // rebinding: tap binds Start, hold PAD_CAPTURE_CANCEL_HOLD cancels, View + Start clears
const PAD_CAPTURE_CANCEL_HOLD = 1;          // s
const PAD_DEVICE_SWITCH_CHANGE = 0.3;       // a stick takes the device after moving this far from its rest (drift does not)
const PAD_MODIFIER_HOLD = 0.25;             // s View must be held alone before its own action (the scoreboard) goes down: a chord may follow
const PAD_CHORD_BINDINGS = PAD_BINDINGS.map((unused, index) => 'Pad:' + PAD_MODIFIER + '+' + index);
const PAD_DIRECTION_BUTTONS = [12, 13, 14, 15];                 // d-pad up, down, left, right
const PAD_DIRECTION_NAMES = ['up', 'down', 'left', 'right'];
const PAD_MENU_ACTIONS = { 0: 'accept', 1: 'back', 9: 'back', 4: 'prev', 5: 'next' };
const PAD_CURVES = {                          // response curves over the rescaled deflection 0..1
  linear: (deflection) => deflection,
  classic: (deflection) => deflection * deflection,
  dynamic: (deflection) => deflection * (0.4 + 0.6 * deflection),
};
const PAD_SETTINGS = [
  { key: 'controls.pad.innerDeadzone', field: 'padInner', fallback: 0.1, label: 'Stick inner deadzone', min: 0, max: 0.5, step: 0.01 },
  { key: 'controls.pad.outerDeadzone', field: 'padOuter', fallback: 0.95, label: 'Stick outer deadzone', min: 0.6, max: 1, step: 0.01 },
  { key: 'controls.pad.curve', field: 'padCurve', fallback: 'classic', label: 'Look response curve', options: ['linear', 'classic', 'dynamic'], optionLabels: ['Linear', 'Classic', 'Dynamic'] },
  { key: 'controls.pad.sensX', field: 'padSensX', fallback: 1, label: 'Look sensitivity X', min: 0.2, max: 3, step: 0.05 },
  { key: 'controls.pad.sensY', field: 'padSensY', fallback: 0.8, label: 'Look sensitivity Y', min: 0.2, max: 3, step: 0.05 },
  { key: 'controls.pad.invertY', field: 'padInvertY', fallback: false, label: 'Invert controller look Y' },
  { key: 'controls.pad.aimAssist', field: 'padAimAssist', fallback: 60, label: 'Controller aim assist', min: 0, max: 100, step: 5 },
];

const PadInput = {
  connected: 0,
  index: -1,                          // pad the player last used
  previous: new Uint8Array(PAD_BUTTON_COUNT),
  chorded: new Uint8Array(PAD_BUTTON_COUNT),   // 1 = this held button went down as a chord, so its release lets go of the chord
  modifierWait: -1,                   // s View has been held while its own action waits for a chord or PAD_MODIFIER_HOLD, -1 = not waiting
  modifierActed: 0,                   // 1 = View's own action is down (held alone past PAD_MODIFIER_HOLD)
  stick: { x: 0, y: 0, magnitude: 0 },    // scratch output of shapeStick
  menuDirection: '',
  menuTimer: 0,
  turboSeconds: 0,
  padId: '',
  unsupportedId: '',                  // last pad without the standard mapping that was reported
  captureView: false,                 // rebinding: View is down, waiting for a second button
  captureStartHeld: -1,               // rebinding: s Start has been held, -1 = up
  restingSticks: new Float32Array(4), // axes 0-3 while the pad had the device
  menuEvent: { command: '' },

  init() {
    window.addEventListener('gamepadconnected', (event) => this.onConnected(event.gamepad));
    window.addEventListener('gamepaddisconnected', () => this.onDisconnected());
    this.connected = this.listPads().filter(Boolean).length;
  },
  listPads() { return navigator.getGamepads ? navigator.getGamepads() : []; },
  onConnected(pad) {
    this.connected++;
    this.index = pad.index;
    this.detectStyle(pad);
    emitToast('Controller connected');
  },
  onDisconnected() {
    this.connected = Math.max(0, this.connected - 1);
    this.previous.fill(0);
    this.reset();
    Input.clearAll();
    if (Input.device !== 'gamepad' || Game.state !== 'playing') return;
    emitToast('Controller disconnected');
    Input.autoPause('controller');
  },
  reset() {
    this.menuDirection = ''; this.turboSeconds = 0; this.chorded.fill(0); this.modifierWait = -1; this.modifierActed = 0;
    this.captureView = false; this.captureStartHeld = -1;
  },
  detectStyle(pad) {
    if (pad.id === this.padId) return;
    this.padId = pad.id;
    const id = String(pad.id).toLowerCase();
    if (/054c|dualsense|dualshock|playstation|ps[345]/.test(id)) Input.padStyle = 'shapes';   // Chrome shows the USB vendor id, Safari the product name
    else if (/045e|xinput|xbox/.test(id)) Input.padStyle = 'letters';
    else Input.padStyle = 'generic';
  },
  standardLayout(pad) { return pad.mapping === undefined || pad.mapping === 'standard'; },   // test pads have no mapping field
  // The pad onConnected chose, unless it lacks the standard layout and another pad has it (a second odd device never silences the real pad).
  activePad() {
    const pads = this.listPads(), chosen = pads[this.index];
    if (chosen && this.standardLayout(chosen)) return chosen;
    for (let i = 0; i < pads.length; i++) if (pads[i] && this.standardLayout(pads[i])) { this.index = i; return pads[i]; }
    if (chosen) return chosen;
    for (let i = 0; i < pads.length; i++) if (pads[i]) { this.index = i; return pads[i]; }
    return null;
  },
  frame(seconds) {
    if (!this.connected) return;
    const pad = this.activePad();
    if (pad) this.poll(pad, seconds);
  },
  // pad: a Gamepad (or a plain object with buttons[{pressed,value}] and axes[]) - tests feed fake pads here.
  poll(pad, seconds) {
    this.detectStyle(pad);
    if (!this.standardLayout(pad)) { this.reportUnsupported(pad); return; }   // other layouts have triggers on the stick axes
    this.updateCapture(seconds);
    this.pollButton(pad, PAD_MODIFIER);   // first: View going down in this same poll still chords the buttons after it
    for (let i = 0; i < PAD_BUTTON_COUNT; i++) if (i !== PAD_MODIFIER) this.pollButton(pad, i);
    this.updateModifier(seconds);
    this.readSticks(pad, seconds);
    this.updateMenuRepeat(pad, seconds);
  },
  reportUnsupported(pad) {
    if (pad.id === this.unsupportedId) return;
    this.unsupportedId = pad.id;
    emitToast('This controller has no standard layout here and is ignored');
  },
  pollButton(pad, index) {
    const button = pad.buttons[index];
    const down = !!button && (button.pressed || button.value > PAD_PRESS_THRESHOLD);
    if (down === (this.previous[index] === 1)) return;
    this.previous[index] = down ? 1 : 0;
    this.onButton(index, down);
  },
  onButton(index, down) {
    if (Input.capture && Input.capture.device === 'pad') { this.captureButton(index, down); return; }
    if (!down) { this.releaseButton(index); return; }
    Input.setDevice('gamepad');
    const binding = this.layerBinding(index);
    if (Input.deliverCapture(binding)) return;
    if (Input.uiOpen && PAD_MENU_ACTIONS[index]) { this.emitMenu(PAD_MENU_ACTIONS[index]); return; }   // the menu may close: the press must not also act in the game
    if (index === PAD_MODIFIER) { this.modifierWait = 0; return; }   // its own action waits: a chord must never also open the scoreboard
    if (binding === PAD_CHORD_BINDINGS[index]) this.startChord(index);
    Input.bindingDown(binding);
  },
  // Rebinding: View waits for a second button ('Pad:8+1') and binds itself when let go alone; Start tapped binds, held cancels;
  // View + Start clears. Nothing reaches the game.
  captureButton(index, down) {
    Input.setDevice('gamepad');
    if (index === PAD_MODIFIER) {
      if (!down && this.captureView) Input.deliverCapture(PAD_BINDINGS[PAD_MODIFIER]);
      this.captureView = down;
      return;
    }
    if (this.previous[PAD_MODIFIER]) {
      if (!down) return;
      this.captureView = false;
      Input.deliverCapture(index === PAD_CAPTURE_START ? CAPTURE_CLEAR : PAD_CHORD_BINDINGS[index]);
      return;
    }
    if (index === PAD_CAPTURE_START) {
      const tapped = !down && this.captureStartHeld >= 0;
      this.captureStartHeld = down ? 0 : -1;
      if (tapped) Input.deliverCapture(PAD_BINDINGS[index]);
      return;
    }
    if (down) Input.deliverCapture(PAD_BINDINGS[index]);
  },
  updateCapture(seconds) {
    if (this.captureStartHeld < 0) return;
    this.captureStartHeld += seconds;
    if (this.captureStartHeld < PAD_CAPTURE_CANCEL_HOLD) return;
    this.captureStartHeld = -1;
    Input.deliverCapture(CAPTURE_CANCEL);
  },
  // The chord takes over: View's own action never fires for this hold (and lets go if it was already down).
  startChord(index) {
    this.chorded[index] = 1;
    this.modifierWait = -1;
    if (!this.modifierActed) return;
    this.modifierActed = 0;
    Input.bindingUp(PAD_BINDINGS[PAD_MODIFIER]);
  },
  // View held alone past PAD_MODIFIER_HOLD: its own action goes down (a held scoreboard); a toggled one waits for the release.
  updateModifier(seconds) {
    if (this.modifierWait < 0) return;
    this.modifierWait += seconds;
    if (this.modifierWait < PAD_MODIFIER_HOLD || this.modifierToggles()) return;
    this.modifierWait = -1;
    this.modifierActed = 1;
    Input.bindingDown(PAD_BINDINGS[PAD_MODIFIER]);
  },
  modifierToggles() {
    const list = Input.bindingMap.get(PAD_BINDINGS[PAD_MODIFIER]);
    if (!list) return false;
    for (let i = 0; i < list.length; i++) if (Input.toggleMode[list[i]]) return true;
    return false;
  },
  // View let go: with no chord it was a tap, so its own action fires now (a toggled scoreboard flips); else it lets go.
  releaseModifier() {
    const modifier = PAD_BINDINGS[PAD_MODIFIER], tapped = this.modifierWait >= 0;
    this.modifierWait = -1;
    if (tapped) { Input.bindingDown(modifier); Input.bindingUp(modifier); return; }
    if (!this.modifierActed) return;
    this.modifierActed = 0;
    Input.bindingUp(modifier);
  },
  // With the modifier held, a button that has a chord binding uses it (View + X = gadget); otherwise its own binding.
  layerBinding(index) {
    if (index === PAD_MODIFIER || !this.previous[PAD_MODIFIER]) return PAD_BINDINGS[index];
    return Input.bindingMap.has(PAD_CHORD_BINDINGS[index]) ? PAD_CHORD_BINDINGS[index] : PAD_BINDINGS[index];
  },
  releaseButton(index) {
    if (index === PAD_MODIFIER) { this.releaseModifier(); return; }
    if (!this.chorded[index]) { Input.bindingUp(PAD_BINDINGS[index]); return; }
    this.chorded[index] = 0;
    Input.bindingUp(PAD_CHORD_BINDINGS[index]);
  },
  emitMenu(command) { this.menuEvent.command = command; Bus.emit('input.menu', this.menuEvent); },
  // Radial deadzones then a response curve. Writes this.stick {x, y, magnitude}; magnitude 0 inside the inner deadzone.
  shapeStick(x, y, curve) {
    const out = this.stick, config = Input.config, length = length2(x, y);
    out.x = out.y = out.magnitude = 0;
    if (length <= config.padInner) return out;
    const deflection = clamp((length - config.padInner) / (config.padOuter - config.padInner), 0, 1);
    const response = curve(deflection);
    out.x = x / length * response; out.y = y / length * response; out.magnitude = response;
    return out;
  },
  readSticks(pad, seconds) {
    const axes = pad.axes, config = Input.config;
    const left = this.shapeStick(axes[0] || 0, axes[1] || 0, PAD_CURVES.linear);
    Input.analog.moveX += left.x;
    Input.analog.moveZ -= left.y;
    const rawX = axes[2] || 0, rawY = axes[3] || 0;
    const right = this.shapeStick(rawX, rawY, PAD_CURVES[config.padCurve] || PAD_CURVES.classic);
    this.claimDevice(axes, left.magnitude > 0 || right.magnitude > 0);
    this.turboSeconds = config.padCurve === 'dynamic' && length2(rawX, rawY) > PAD_TURBO_EDGE ? this.turboSeconds + seconds : 0;
    const turbo = 1 + PAD_TURBO_GAIN * clamp(this.turboSeconds / PAD_TURBO_SECONDS, 0, 1);
    const radiansPerSecond = PAD_LOOK_DEGREES_PER_SECOND * DEG * turbo * seconds;
    Input.addLook(right.x * config.padSensX * radiansPerSecond, right.y * config.padSensY * radiansPerSecond * (config.padInvertY ? -1 : 1), true);
  },
  // A stick takes the device only by moving away from its rest, so drift never fights touch or the mouse; a let-go stick is a new rest.
  claimDevice(axes, active) {
    const resting = this.restingSticks, own = Input.device === 'gamepad';
    let change = 0;
    for (let i = 0; i < resting.length; i++) {
      const value = axes[i] || 0;
      change = Math.max(change, Math.abs(value - resting[i]));
      if (own || !active) resting[i] = value;
    }
    if (!own && active && change > PAD_DEVICE_SWITCH_CHANGE) Input.setDevice('gamepad');
  },
  // Menu direction from the d-pad or left stick, repeating while held (INP-010).
  updateMenuRepeat(pad, seconds) {
    let direction = '';
    for (let i = 0; i < PAD_DIRECTION_BUTTONS.length; i++) if (this.previous[PAD_DIRECTION_BUTTONS[i]]) direction = PAD_DIRECTION_NAMES[i];
    if (!direction) direction = this.stickDirection(pad.axes[0] || 0, pad.axes[1] || 0);
    if (direction !== this.menuDirection) {
      this.menuDirection = direction;
      this.menuTimer = PAD_MENU_REPEAT_FIRST;
      if (direction && Input.uiOpen) this.emitMenu(direction);
      return;
    }
    if (!direction) return;
    this.menuTimer -= seconds;
    if (this.menuTimer > 0) return;
    this.menuTimer = PAD_MENU_REPEAT;
    if (Input.uiOpen) this.emitMenu(direction);
  },
  stickDirection(x, y) {
    if (Math.max(Math.abs(x), Math.abs(y)) < PAD_MENU_STICK_THRESHOLD) return '';
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
    return y > 0 ? 'down' : 'up';
  },
  rumble(strength, milliseconds) {
    const pad = this.activePad();
    if (!pad || !pad.vibrationActuator) return;
    try {
      const played = pad.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, duration: milliseconds, weakMagnitude: strength, strongMagnitude: strength });
      if (played && played.catch) played.catch(() => { /* actuator refused: vibration is optional */ });
    } catch (error) { /* actuator refused: vibration is optional */ }
  },
};

Input.sources.push(PadInput);
Input.addSettings(PAD_SETTINGS);
