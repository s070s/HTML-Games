// ---- Input: keyboard, gamepad, touch --------------------------------------------------------------------------
const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'menu', 'map'];
const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', Enter: 'a', Space: 'a', KeyX: 'b', Escape: 'b', Backspace: 'b', KeyM: 'menu', Tab: 'menu', KeyQ: 'map',
};
function padButtonOn(buttons, index) { return !!(buttons[index] && buttons[index].pressed); }
const Input = {
  down: {}, previous: {}, pressed: {}, repeat: {}, heldFrames: {}, keys: {}, pad: {}, touch: {}, injected: {}, padConnected: 0,
  poll: function () {
    if (this.padConnected > 0) this.readGamepad();
    for (let i = 0; i < BUTTONS.length; i++) {
      const name = BUTTONS[i];
      const current = !!(this.keys[name] || this.pad[name] || this.touch[name] || this.injected[name] > 0);
      this.pressed[name] = current && !this.previous[name];
      this.heldFrames[name] = current ? (this.heldFrames[name] || 0) + 1 : 0;
      this.repeat[name] = this.pressed[name] || repeatFires(OPT.holdRepeat, this.heldFrames[name]);
      this.down[name] = current;
      this.previous[name] = current;
      if (this.injected[name] > 0) this.injected[name]--;
    }
  },
  readGamepad: function () {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < BUTTONS.length; i++) this.pad[BUTTONS[i]] = false; // reuse the object: no allocation per frame
    for (const pad of pads) {
      if (!pad) continue;
      const axisX = pad.axes[0] || 0;
      const axisY = pad.axes[1] || 0;
      const buttons = pad.buttons;
      if (padButtonOn(buttons, 12) || axisY < -0.5) this.pad.up = true;
      if (padButtonOn(buttons, 13) || axisY > 0.5) this.pad.down = true;
      if (padButtonOn(buttons, 14) || axisX < -0.5) this.pad.left = true;
      if (padButtonOn(buttons, 15) || axisX > 0.5) this.pad.right = true;
      if (padButtonOn(buttons, 0)) this.pad.a = true;
      if (padButtonOn(buttons, 1)) this.pad.b = true;
      if (padButtonOn(buttons, 9) || padButtonOn(buttons, 3)) this.pad.menu = true;
      if (padButtonOn(buttons, 8)) this.pad.map = true; // Select / Back
    }
  },
  inject: function (name, frames) { this.injected[name] = frames || 2; },
  clear: function () { this.keys = {}; this.pad = {}; this.touch = {}; this.injected = {}; this.previous = {}; },
};
window.addEventListener('keydown', function (event) {
  Sound.unlock();
  const top = layers[layers.length - 1];
  if (top && top.onKey && top.onKey(event)) { event.preventDefault(); return; }
  if (event.code === 'KeyN') { OPT.sound = !OPT.sound; Sound.applyMute(); saveOptions(); return; }
  const name = KEY_MAP[event.code];
  if (!name) return;
  event.preventDefault();
  Input.keys[name] = true;
});
window.addEventListener('keyup', function (event) {
  const name = KEY_MAP[event.code];
  if (name) Input.keys[name] = false;
});
window.addEventListener('blur', function () { Input.keys = {}; Input.touch = {}; });
window.addEventListener('gamepadconnected', function () { Input.padConnected++; });
window.addEventListener('gamepaddisconnected', function () { Input.padConnected = Math.max(0, Input.padConnected - 1); Input.pad = {}; });
function bindTouchButtons() {
  for (const element of touchPad.querySelectorAll('[data-btn]')) {
    const name = element.getAttribute('data-btn');
    const press = function (event) { event.preventDefault(); Sound.unlock(); Input.touch[name] = true; element.classList.add('on'); };
    const release = function (event) { event.preventDefault(); Input.touch[name] = false; element.classList.remove('on'); };
    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('pointerleave', release);
    element.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  }
}

