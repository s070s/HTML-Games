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
  stick: { x: 0, y: 0, magnitude: 0 },    // scratch output of shapeStick
  menuDirection: '',
  menuTimer: 0,
  turboSeconds: 0,
  padId: '',
  menuEvent: { command: '' },
  toastEvent: { text: '' },

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
    this.say('Controller connected');
  },
  onDisconnected() {
    this.connected = Math.max(0, this.connected - 1);
    this.previous.fill(0);
    this.reset();
    Input.clearAll();
    if (Input.device !== 'gamepad' || Game.state !== 'playing') return;
    this.say('Controller disconnected');
    Input.autoPause('controller');
  },
  say(text) { this.toastEvent.text = text; Bus.emit('toast', this.toastEvent); },
  reset() { this.menuDirection = ''; this.turboSeconds = 0; },
  detectStyle(pad) {
    if (pad.id === this.padId) return;
    this.padId = pad.id;
    const id = String(pad.id).toLowerCase();
    if (/054c/.test(id)) Input.padStyle = 'shapes';          // the pad's USB vendor id decides the glyph family
    else if (/045e|xinput/.test(id)) Input.padStyle = 'letters';
    else Input.padStyle = 'generic';
  },
  activePad() {
    const pads = this.listPads();
    if (pads[this.index]) return pads[this.index];
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
    for (let i = 0; i < PAD_BUTTON_COUNT; i++) {
      const button = pad.buttons[i];
      const down = !!button && (button.pressed || button.value > PAD_PRESS_THRESHOLD);
      if (down === (this.previous[i] === 1)) continue;
      this.previous[i] = down ? 1 : 0;
      this.onButton(i, down);
    }
    this.readSticks(pad, seconds);
    this.updateMenuRepeat(pad, seconds);
  },
  onButton(index, down) {
    const binding = PAD_BINDINGS[index];
    if (!down) { Input.bindingUp(binding); return; }
    Input.setDevice('gamepad');
    if (Input.deliverCapture(binding)) return;
    if (Input.uiOpen && PAD_MENU_ACTIONS[index]) { this.emitMenu(PAD_MENU_ACTIONS[index]); return; }   // the menu may close: the press must not also act in the game
    Input.bindingDown(binding);
  },
  emitMenu(command) { this.menuEvent.command = command; Bus.emit('input.menu', this.menuEvent); },
  // Radial deadzones then a response curve. Writes this.stick {x, y, magnitude}; magnitude 0 inside the inner deadzone.
  shapeStick(x, y, curve) {
    const out = this.stick, config = Input.config, length = Math.hypot(x, y);
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
    const active = left.magnitude > 0 || right.magnitude > 0;
    if (active) Input.setDevice('gamepad');
    this.turboSeconds = config.padCurve === 'dynamic' && Math.hypot(rawX, rawY) > PAD_TURBO_EDGE ? this.turboSeconds + seconds : 0;
    const turbo = 1 + PAD_TURBO_GAIN * clamp(this.turboSeconds / PAD_TURBO_SECONDS, 0, 1);
    const radiansPerSecond = PAD_LOOK_DEGREES_PER_SECOND * DEG * turbo * seconds;
    Input.addLook(right.x * config.padSensX * radiansPerSecond, right.y * config.padSensY * radiansPerSecond * (config.padInvertY ? -1 : 1), true);
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
