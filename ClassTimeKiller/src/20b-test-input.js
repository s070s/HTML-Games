// Self-tests for S05 input: action table, bindings, keyboard + mouse, latch and buffer, pause rules, gamepad, aim assist, touch.

DebugApi.input = Input;
DebugApi.touch = TouchInput;
DebugApi.pad = PadInput;

const TEST_FRAME = 1 / 60;
const INP_DEFAULT_BINDINGS = {   // INP-003
  'Key:KeyW': 'forward', 'Key:KeyS': 'back', 'Key:KeyA': 'left', 'Key:KeyD': 'right', 'Key:Space': 'jump', 'Key:ControlLeft': 'crouch',
  'Key:ShiftLeft': 'sprint', 'Mouse:0': 'fire', 'Mouse:2': 'alt', 'Key:KeyR': 'reload', 'Key:KeyE': 'use', 'Key:KeyQ': 'ability1',
  'Key:KeyF': 'ability2', 'Key:KeyX': 'ultimate', 'Key:KeyG': 'grenade', 'Key:KeyV': 'melee', 'Key:KeyC': 'gadget', 'Key:KeyZ': 'ping',
  'Key:Digit1': 'slot1', 'Key:Digit9': 'slot9', 'Wheel:down': 'nextWeapon', 'Wheel:up': 'prevWeapon', 'Key:Tab': 'scoreboard',
  'Key:Escape': 'pause', 'Key:KeyT': 'comm', 'Key:F10': 'perfHud', 'Key:F9': 'botDebug',
};

// A running match with one player actor, like a mode would set up; every input test starts here.
function startInputMatch() {
  Ui.closeAll();
  Game.start({});
  const id = Actors.create(ACTOR_KIND.PLAYER, 0, 'tester');
  Actors.alive[id] = 1;
  Game.playerId = id;
  Input.clearAll();
  Input.device = 'kbm'; Input.uiOpen = false; Input.locked = false; Input.lockRefused = false; Input.resumePending = false; Input.capture = null;
  Input.aimAssistTarget = null; Input.autoFireTarget = false;
  Input.seenButtons = 0; Input.writtenButtons = 0; Input.writtenTick = -1; Input.aim.playerId = -1;
  PadInput.previous.fill(0); PadInput.connected = 0; PadInput.reset();
  TouchInput.reset();
  Input.loadBindings();
  Input.refreshConfig();
  TouchInput.syncVisible();   // a layer left visible by a touch test would clear the next inputs when it hides
  return id;
}
function setInputSetting(key, value) { Settings.set(key, value); Input.refreshConfig(); }
function keyEvent(code, down) { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true })); }
function tapKey(code) { keyEvent(code, true); keyEvent(code, false); }
function mouseButton(button, down) { window.dispatchEvent(new PointerEvent(down ? 'pointerdown' : 'pointerup', { pointerType: 'mouse', button, bubbles: true, cancelable: true })); }
function mouseMove(movementX, movementY) { window.dispatchEvent(new MouseEvent('mousemove', { movementX, movementY, bubbles: true })); }
function stepAndFrame() { Sim.step(); Input.frame(TEST_FRAME); }
// Counts sim steps whose buttons went down for `bit` over `frames` frame+step cycles.
function countEdges(id, bit, frames) {
  let edges = 0;
  for (let i = 0; i < frames; i++) { Input.frame(TEST_FRAME); Sim.step(); if (Actors.pressed[id] & bit) edges++; }
  return edges;
}
function fakePad(id) {
  return { id: id || 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)', index: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: PAD_BUTTON_COUNT }, () => ({ pressed: false, value: 0 })) };
}
function padButton(pad, index, down) { pad.buttons[index].pressed = down; pad.buttons[index].value = down ? 1 : 0; }
const REAL_ACTIVE_PAD = PadInput.activePad;
const PAD_LOOK_TEST_FRAMES = 15;
// Makes Input.frame poll this fake pad, like a connected controller would be.
function usePad(pad) { PadInput.connected = 1; PadInput.activePad = () => pad; }
function releasePad() { PadInput.activePad = REAL_ACTIVE_PAD; PadInput.connected = 0; PadInput.previous.fill(0); }
// Hold or release an action without going through a device (devices change Input.device).
function holdAction(actionId, down) { if (down) Input.pressAction(Input.actionIndex[actionId]); else Input.releaseAction(Input.actionIndex[actionId]); }

Test.add('input', (check) => {
  const ids = new Set(ACTION_ROWS.map((row) => row.id));
  check('actions: unique ids', ids.size === ACTION_ROWS.length);
  const kinds = ACTION_ROWS.map((row) => (row.button ? 1 : 0) + (row.axis ? 1 : 0) + (row.slot ? 1 : 0) + (row.event ? 1 : 0));
  check('actions: every row does exactly one thing', kinds.every((count) => count === 1));
  const bits = ACTION_ROWS.filter((row) => row.button).map((row) => row.button);
  check('actions: button bits are distinct BTN values', new Set(bits).size === bits.length && bits.every((bit) => Object.values(BTN).includes(bit)));
  Input.loadBindings();
  for (const binding in INP_DEFAULT_BINDINGS) {
    const list = Input.bindingMap.get(binding);
    check('INP-003 default ' + binding, !!list && list.some((index) => ACTION_ROWS[index].id === INP_DEFAULT_BINDINGS[binding]));
  }
  check('actions: the defaults have no conflicts', Input.allConflicts().length === 0, Input.allConflicts().join(','));
  check('actions: hold/toggle for crouch, sprint, aim, walk (INP-002)', ['crouch', 'sprint', 'alt', 'walk'].every((id) => Settings.definitions.has('controls.toggle.' + id)));
  check('actions: jump and fire are buffered', ACTION_ROWS.filter((row) => row.buffered).map((row) => row.id).join() === 'jump,fire');
  check('settings: every input setting is read by the layer', Input.settingRows.every((row) => Settings.readCounts.get(row.key) > 0));
  check('settings: input keys live in the controls category', Input.settingRows.every((row) => Settings.definitions.get(row.key).category === 'controls'));
  check('labels: keys, mouse, wheel', Input.bindingLabel('Key:KeyW') === 'W' && Input.bindingLabel('Mouse:2') === 'Right Mouse' && Input.bindingLabel('Wheel:up') === 'Wheel Up' && Input.bindingLabel('Key:Digit4') === '4' && Input.bindingLabel('') === 'Unbound');
});

Test.add('input', (check) => {
  const id = startInputMatch();
  keyEvent('KeyW', true); Input.frame(TEST_FRAME);
  check('keyboard: W moves forward (+1)', Actors.moveZ[id] === 1 && Actors.moveX[id] === 0);
  keyEvent('KeyD', true); Input.frame(TEST_FRAME);
  check('keyboard: W+D is a normalized diagonal', Test.near(Math.hypot(Actors.moveX[id], Actors.moveZ[id]), 1, 1e-5) && Actors.moveX[id] > 0.7);
  keyEvent('KeyS', true); Input.frame(TEST_FRAME);
  check('keyboard: opposite keys cancel', Actors.moveZ[id] === 0 && Actors.moveX[id] === 1);
  keyEvent('KeyW', false); keyEvent('KeyS', false); keyEvent('KeyD', false); keyEvent('KeyA', true); Input.frame(TEST_FRAME);
  check('keyboard: A strafes left (-1)', Actors.moveX[id] === -1 && Actors.moveZ[id] === 0);
  keyEvent('KeyA', false);
  keyEvent('Space', true); keyEvent('ShiftLeft', true); mouseButton(0, true); mouseButton(2, true); Input.frame(TEST_FRAME);
  check('keyboard + mouse: jump, sprint, fire, alt bits', Actors.buttons[id] === (BTN.JUMP | BTN.SPRINT | BTN.FIRE | BTN.ALT), Actors.buttons[id]);
  keyEvent('Space', false); keyEvent('ShiftLeft', false); mouseButton(0, false); mouseButton(2, false); stepAndFrame(); stepAndFrame();
  check('keyboard + mouse: releasing clears every bit', Actors.buttons[id] === 0, Actors.buttons[id]);
  keyEvent('KeyW', true); keyEvent('KeyW', true);
  const repeat = new KeyboardEvent('keydown', { code: 'KeyW', repeat: true, bubbles: true }); window.dispatchEvent(repeat); keyEvent('KeyW', false);
  check('keyboard: auto-repeat events do not stack presses', Input.holdCount[Input.actionIndex.forward] === 1 || Input.holdCount[Input.actionIndex.forward] === 0);
  Input.clearAll();
  const down = new KeyboardEvent('keydown', { code: 'Tab', cancelable: true, bubbles: true });
  window.dispatchEvent(down);
  check('keyboard: a bound key stops the browser default (Tab)', down.defaultPrevented);
  Input.clearAll();
  Input.uiOpen = true;
  const menuTab = new KeyboardEvent('keydown', { code: 'Tab', cancelable: true, bubbles: true });
  window.dispatchEvent(menuTab);
  check('keyboard: game actions are ignored while a menu is open', !Input.effective[Input.actionIndex.scoreboard]);
  Input.uiOpen = false;
});

Test.add('input', (check) => {
  const id = startInputMatch();
  tapKey('Space'); Input.frame(TEST_FRAME);
  check('latch: a tap shorter than a frame still reaches the sim (INP-009)', (Actors.buttons[id] & BTN.JUMP) !== 0);
  Input.frame(TEST_FRAME);
  check('latch: the press stays until a sim step ran', (Actors.buttons[id] & BTN.JUMP) !== 0);
  Sim.step();
  check('latch: the step sees the press as a new edge', (Actors.pressed[id] & BTN.JUMP) !== 0);
  Input.frame(TEST_FRAME);
  check('latch: cleared after the step consumed it', (Actors.buttons[id] & BTN.JUMP) === 0);

  startInputMatch();
  tapKey('Space'); Input.frame(TEST_FRAME); Sim.step();
  tapKey('Space');
  let edges = 1;
  for (let i = 0; i < 4; i++) { Input.frame(TEST_FRAME); Sim.step(); if (Actors.pressed[id] & BTN.JUMP) edges++; }
  check('latch: a second tap right after the first still makes its own edge', edges === 2, edges);

  startInputMatch();
  tapKey('Space'); Input.frame(TEST_FRAME); Sim.step();
  tapKey('Space'); Input.frame(0.2);
  const stale = countEdges(id, BTN.JUMP, 4);
  check('buffer: a deferred press older than 0.10 s is dropped', stale === 0, stale);

  startInputMatch();
  check('buffer: constant is 0.10 s of sim ticks', INPUT_BUFFER_SECONDS === 0.10 && INPUT_BUFFER_TICKS === 12);
  tapKey('Space');
  check('buffer: a jump press is buffered right away', Input.buffered('jump'));
  Sim.run(INPUT_BUFFER_TICKS);
  check('buffer: still valid at 0.10 s', Input.buffered('jump'));
  Sim.run(1);
  check('buffer: expired after 0.10 s', !Input.buffered('jump'));
  tapKey('Space'); Input.consumeBuffered('jump');
  check('buffer: a consumed press is gone', !Input.buffered('jump'));

  startInputMatch();
  tapKey('Digit3'); Input.frame(TEST_FRAME);
  check('slots: key 3 requests weapon slot 3', Actors.slotRequest[id] === 3);
  stepAndFrame();
  check('slots: the request is cleared after the step', Actors.slotRequest[id] === 0);

  startInputMatch();
  for (let i = 0; i < 3; i++) window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
  check('wheel: one weapon switch per notch, none skipped (LT-L-027)', countEdges(id, BTN.NEXT_WEAPON, 8) === 3);
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }));
  check('wheel: scrolling up is the previous weapon', countEdges(id, BTN.PREV_WEAPON, 3) === 1);
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true }));
  check('wheel: a tiny trackpad delta is not a notch', countEdges(id, BTN.NEXT_WEAPON, 3) === 0);
});

Test.add('input', (check) => {
  const id = startInputMatch();
  setInputSetting('controls.toggle.crouch', 'toggle');
  keyEvent('ControlLeft', true); keyEvent('ControlLeft', false); Input.frame(TEST_FRAME);
  check('toggle: one press turns crouch on and it stays on', (Actors.buttons[id] & BTN.CROUCH) !== 0);
  stepAndFrame();
  check('toggle: still on after the key was released', (Actors.buttons[id] & BTN.CROUCH) !== 0);
  keyEvent('ControlLeft', true); keyEvent('ControlLeft', false); stepAndFrame(); stepAndFrame();
  check('toggle: the second press turns it off', (Actors.buttons[id] & BTN.CROUCH) === 0);
  setInputSetting('controls.toggle.crouch', 'hold');
  keyEvent('ControlLeft', true); Input.frame(TEST_FRAME);
  const held = (Actors.buttons[id] & BTN.CROUCH) !== 0;
  keyEvent('ControlLeft', false); stepAndFrame(); stepAndFrame();
  check('hold: crouch follows the key (10 of 10 presses in LT-M-007 rely on this)', held && (Actors.buttons[id] & BTN.CROUCH) === 0);
  setInputSetting('controls.toggle.alt', 'toggle');
  mouseButton(2, true); mouseButton(2, false); stepAndFrame();
  check('toggle: aim can be toggled too', (Actors.buttons[id] & BTN.ALT) !== 0);
  Input.clearAll();
  check('toggle: clearAll drops a toggled action', !Input.isHeld('alt'));
});

Test.add('input', (check) => {
  const id = startInputMatch();
  Input.locked = true;
  mouseMove(100, 0); Input.frame(TEST_FRAME);
  check('mouse: moving right turns right (yaw falls, 0.05 deg per count)', Test.near(Actors.aimYaw[id], -5 * DEG, 1e-5), Actors.aimYaw[id] / DEG);
  mouseMove(0, -100); Input.frame(TEST_FRAME);
  check('mouse: moving up looks up', Test.near(Actors.aimPitch[id], 5 * DEG, 1e-5), Actors.aimPitch[id] / DEG);
  mouseMove(0, -1000000); Input.frame(TEST_FRAME);
  check('mouse: pitch clamps at +89 degrees', Test.near(Actors.aimPitch[id], 89 * DEG, 1e-6));
  mouseMove(0, 1000000); Input.frame(TEST_FRAME);
  check('mouse: pitch clamps at -89 degrees', Test.near(Actors.aimPitch[id], -89 * DEG, 1e-6));
  startInputMatch(); Input.locked = true;
  setInputSetting('controls.mouseSensitivity', 2);
  mouseMove(100, 0); Input.frame(TEST_FRAME);
  check('mouse: look is linear in sensitivity (LT-H-067)', Test.near(Actors.aimYaw[id], -10 * DEG, 1e-5));
  setInputSetting('controls.mouseSensitivity', 1);
  setInputSetting('controls.invertY', true);
  mouseMove(0, -100); Input.frame(TEST_FRAME);
  check('mouse: invert flips the vertical direction', Test.near(Actors.aimPitch[id], -5 * DEG, 1e-5));
  setInputSetting('controls.invertY', false);
  startInputMatch(); Input.locked = true;
  mouseButton(2, true); mouseMove(100, 0); Input.frame(TEST_FRAME);
  check('mouse: aiming applies the sensitivity multiplier (0.8)', Test.near(Actors.aimYaw[id], -4 * DEG, 1e-5), Actors.aimYaw[id] / DEG);
  holdAction('alt', false);
  Input.locked = false;
  const before = Actors.aimYaw[id];
  mouseMove(500, 0); Input.frame(TEST_FRAME);
  check('mouse: movement is ignored without pointer lock', Actors.aimYaw[id] === before);
  check('mouse: cm per 360 at 800 DPI, sensitivity 1', Test.near(Input.cmPer360(1, 800), 22.86, 0.01), Input.cmPer360(1, 800));
  check('mouse: cm per 360 halves when sensitivity doubles', Test.near(Input.cmPer360(2, 800) * 2, Input.cmPer360(1, 800), 1e-9));
  Actors.yaw[id] = 1.25; Actors.spawnCount[id]++;
  Input.frame(TEST_FRAME);
  check('aim: a new spawn resets the view to the actor facing', Test.near(Actors.aimYaw[id], 1.25, 1e-5));
  const paused = startInputMatch();
  Game.pause('menu');
  Actors.moveZ[paused] = 0; keyEvent('KeyW', true); Input.frame(TEST_FRAME);
  check('frame: nothing is written while paused', Actors.moveZ[paused] === 0);
  Game.resume();
});

Test.add('input', (check) => {
  let id = startInputMatch();
  const conflicts = Input.setBinding('fire', 0, 'Key:KeyJ');
  check('rebind: setBinding returns no conflicts for a free key', Array.isArray(conflicts) && conflicts.length === 0);
  check('rebind: saved in Save.data.bindings', Save.data.bindings.fire[0] === 'Key:KeyJ');
  keyEvent('KeyJ', true); Input.frame(TEST_FRAME);
  check('rebind: the new key fires', (Actors.buttons[id] & BTN.FIRE) !== 0);
  keyEvent('KeyJ', false); stepAndFrame();
  mouseButton(0, true); Input.frame(TEST_FRAME);
  check('rebind: the old binding no longer fires', (Actors.buttons[id] & BTN.FIRE) === 0);
  mouseButton(0, false);
  Save.data = JSON.parse(JSON.stringify(Save.data));
  Input.loadBindings();
  check('rebind: survives a reload of the save', Input.getBinding('fire', 0) === 'Key:KeyJ');
  const shared = Input.setBinding('reload', 0, 'Key:KeyJ');
  check('rebind: a shared binding is flagged on both actions', shared.join() === 'fire' && Input.conflictsOf('fire').join() === 'reload' && Input.allConflicts().length === 2);
  Input.resetBindings('reload');
  Input.resetBindings('fire');
  check('rebind: reset restores the defaults and removes the saved entry', Input.getBinding('fire', 0) === 'Mouse:0' && Save.data.bindings.fire === undefined && Input.allConflicts().length === 0);
  check('rebind: a pad button cannot go on a keyboard slot', Input.setBinding('jump', 0, 'Pad:3') === null && Input.getBinding('jump', 0) === 'Key:Space');
  check('rebind: wheel and mouse buttons are accepted (INP-002)', Input.setBinding('jump', 1, 'Wheel:up').join() === 'prevWeapon' && Input.setBinding('melee', 1, 'Mouse:3').length === 0);
  Input.resetBindings();
  check('rebind: reset all clears every saved binding', Object.keys(Save.data.bindings).length === 0);
  let captured = 'none';
  Input.captureNext('kbm', (binding) => { captured = binding; });
  keyEvent('KeyP', true); keyEvent('KeyP', false);
  check('capture: the next key goes to the rebinding screen, not to an action', captured === 'Key:KeyP' && Input.capture === null);
  Input.captureNext('kbm', (binding) => { captured = binding; });
  keyEvent('Escape', true); keyEvent('Escape', false);
  check('capture: Esc cancels', captured === null && Game.paused === false);
  Input.captureNext('kbm', (binding) => { captured = binding; });
  keyEvent('Backspace', true); keyEvent('Backspace', false);
  check('capture: Backspace clears the slot', captured === '');
  Input.captureNext('kbm', (binding) => { captured = binding; });
  mouseButton(4, true); mouseButton(4, false);
  check('capture: mouse buttons can be captured', captured === 'Mouse:4');
  Input.captureNext('pad', (binding) => { captured = binding; });
  keyEvent('KeyP', true); keyEvent('KeyP', false);
  check('capture: a key does not satisfy a controller capture', captured === 'Mouse:4' && Input.capture !== null);
  Input.cancelCapture();
  id = startInputMatch();
  check('labels: glyphs follow the pad family (LT-H-066)', Input.bindingLabel('Pad:7') === 'RT');
  Input.padStyle = 'playstation';
  check('labels: playstation glyphs', Input.bindingLabel('Pad:7') === 'R2' && Input.bindingLabel('Pad:0') === 'Cross');
  Input.padStyle = 'xbox';
});

Test.add('input', (check) => {
  const id = startInputMatch();
  window.dispatchEvent(new Event('blur'));
  check('pause: window blur pauses (PLT-006)', Game.paused && Game.pauseReason === 'blur');
  Game.resume();
  const hidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  delete document.hidden;
  check('pause: hidden tab pauses', Game.paused && Game.pauseReason === 'hidden' && !hidden);
  Game.resume();
  Input.setLocked(true); Input.setLocked(false);
  check('pause: pointer lock loss pauses', Game.paused && Game.pauseReason === 'pointerlock');
  Game.resume();
  keyEvent('KeyW', true); Input.frame(TEST_FRAME);
  window.dispatchEvent(new Event('blur')); Game.resume(); Input.frame(TEST_FRAME);
  check('pause: held keys are released on blur (nothing sticks)', Actors.moveZ[id] === 0);
  keyEvent('KeyW', false);
  tapKey('Escape');
  check('pause: Esc pauses a running match', Game.paused && Game.pauseReason === 'menu');
  Game.resume();
  Game.stop();
  window.dispatchEvent(new Event('blur'));
  check('pause: blur outside a match does nothing', !Game.paused);
});

Test.add('input', (check) => {
  startInputMatch();
  const requests = [], realCanLock = Input.canLock, realRequestLock = Input.requestLock;
  Input.canLock = () => true;
  Input.requestLock = () => { requests.push(1); };
  Game.pause('pointerlock');
  Input.requestResume();
  check('lock: Resume asks for the lock first and stays paused', requests.length === 1 && Game.paused && Input.resumePending);
  Input.setLocked(true);
  check('lock: granted -> the game resumes', !Game.paused && !Input.resumePending);
  Input.locked = false;
  Game.pause('pointerlock');
  Input.requestResume();
  Input.onLockRefused();
  check('lock: refused -> still paused, "Click to resume" shown', Game.paused && Input.lockRefused && Input.prompt.textContent === 'Click to resume' && Input.promptShown);
  mouseButton(0, true); mouseButton(0, false);
  check('lock: the next click asks for the lock again', requests.length === 3 && Input.resumePending);
  Input.setLocked(true);
  check('lock: then resumes and hides the prompt', !Game.paused && !Input.promptShown);
  check('lock: a click that locks never fires the weapon', !Input.isHeld('fire'));
  Input.setLocked(false);
  Game.resume();
  Input.lockRefused = false; Input.syncPrompt();
  check('lock: an unlocked running match shows "Click to play"', Input.promptShown && Input.prompt.textContent === 'Click to play');
  Input.canLock = realCanLock;
  Input.requestLock = realRequestLock;
  Input.syncPrompt();
  check('lock: no prompt in headless runs', !Input.promptShown);
  const calls = [];
  Input.canvas = { requestPointerLock: (options) => { calls.push(options); } };
  Input.requestPlainLock();
  Input.onLockPromiseRejected({ name: 'NotSupportedError' });
  check('lock: raw input unsupported falls back silently to a plain lock', calls.length === 2 && calls[1] === undefined && !Input.lockRefused);
  Input.onLockPromiseRejected({ name: 'SecurityError' });
  check('lock: any other rejection counts as a refusal', Input.lockRefused === Game.paused);
  Input.canvas = document.getElementById('view');
  Input.lockRefused = false;
  Input.resumePending = false;
});

Test.add('input', (check) => {
  startInputMatch();
  keyEvent('KeyW', true); keyEvent('KeyW', false);
  check('device: keyboard sets kbm', Input.device === 'kbm');
  window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 77, bubbles: true }));
  check('device: a touch sets touch', Input.device === 'touch');
  PadInput.poll(fakePad(), TEST_FRAME);
  const pad = fakePad(); padButton(pad, 0, true); PadInput.poll(pad, TEST_FRAME);
  check('device: a pad press sets gamepad', Input.device === 'gamepad');
  const events = [];
  const listener = Bus.on('input.device', (payload) => events.push(payload.device));
  keyEvent('KeyW', true); keyEvent('KeyW', false);
  Bus.off('input.device', listener);
  check('device: a change emits input.device once', events.join() === 'kbm');
});

Test.add('input', (check) => {
  const id = startInputMatch();
  const pad = fakePad();
  usePad(pad);
  padButton(pad, 7, true); padButton(pad, 0, true); Input.frame(TEST_FRAME);
  check('pad: RT fires, A jumps (standard mapping)', Actors.buttons[id] === (BTN.FIRE | BTN.JUMP), Actors.buttons[id]);
  releasePad();
  const trigger = fakePad();
  trigger.buttons[6] = { pressed: false, value: 0.8 };
  usePad(trigger); Input.frame(TEST_FRAME);
  check('pad: analog triggers count by value', Input.holdCount[Input.actionIndex.alt] === 1);
  releasePad();
  startInputMatch();
  const stick = fakePad();
  usePad(stick);
  stick.axes[0] = 0.05; stick.axes[1] = -0.05; Input.frame(TEST_FRAME);
  check('pad: inside the inner deadzone nothing moves (0.1)', Actors.moveX[id] === 0 && Actors.moveZ[id] === 0);
  stick.axes[0] = 1; stick.axes[1] = -1; Input.frame(TEST_FRAME);
  check('pad: past the outer deadzone is full deflection (0.95)', Test.near(Math.hypot(Actors.moveX[id], Actors.moveZ[id]), 1, 1e-6) && Actors.moveX[id] > 0.7);
  stick.axes[0] = 0; stick.axes[1] = -1; Input.frame(TEST_FRAME);
  check('pad: left stick up walks forward (+1)', Test.near(Actors.moveZ[id], 1, 1e-6) && Actors.moveX[id] === 0, Actors.moveZ[id]);
  releasePad();
  const half = PadInput.shapeStick(0.525, 0, PAD_CURVES.classic);
  check('pad: classic curve squares the rescaled deflection', Test.near(half.magnitude, 0.25, 1e-6), half.magnitude);
  const linear = PadInput.shapeStick(0.525, 0, PAD_CURVES.linear);
  check('pad: linear curve keeps it', Test.near(linear.magnitude, 0.5, 1e-6));
  const dynamic = PadInput.shapeStick(0.525, 0, PAD_CURVES.dynamic);
  check('pad: dynamic curve sits between classic and linear', dynamic.magnitude > 0.25 && dynamic.magnitude < 0.5, dynamic.magnitude);
  setInputSetting('controls.pad.innerDeadzone', 0.3);
  check('pad: the inner deadzone is a setting', PadInput.shapeStick(0.25, 0, PAD_CURVES.linear).magnitude === 0);
  setInputSetting('controls.pad.innerDeadzone', 0.1);

  startInputMatch();
  setInputSetting('controls.pad.curve', 'linear');
  const look = fakePad(); look.axes[2] = 1;
  usePad(look);
  for (let i = 0; i < PAD_LOOK_TEST_FRAMES; i++) Input.frame(TEST_FRAME);
  check('pad: right stick turns at 200 deg/s per unit sensitivity X', Test.near(Actors.aimYaw[id], -50 * DEG, 1e-4), Actors.aimYaw[id] / DEG);
  startInputMatch();
  usePad(look); look.axes[2] = 0; look.axes[3] = 1;
  for (let i = 0; i < PAD_LOOK_TEST_FRAMES; i++) Input.frame(TEST_FRAME);
  check('pad: stick down looks down at sensitivity Y 0.8', Test.near(Actors.aimPitch[id], -40 * DEG, 1e-4), Actors.aimPitch[id] / DEG);
  startInputMatch();
  usePad(look); setInputSetting('controls.pad.invertY', true); setInputSetting('controls.pad.sensY', 1);
  for (let i = 0; i < PAD_LOOK_TEST_FRAMES; i++) Input.frame(TEST_FRAME);
  check('pad: invert Y and separate Y sensitivity', Test.near(Actors.aimPitch[id], 50 * DEG, 1e-4), Actors.aimPitch[id] / DEG);
  setInputSetting('controls.pad.invertY', false);
  setInputSetting('controls.pad.curve', 'dynamic');
  PadInput.turboSeconds = 0;
  look.axes[2] = 1; look.axes[3] = 0;
  for (let i = 0; i < 60; i++) Input.frame(TEST_FRAME);
  check('pad: the dynamic curve speeds up when the stick is held at the edge', PadInput.turboSeconds > PAD_TURBO_SECONDS * 0.9);
  releasePad();
  setInputSetting('controls.pad.curve', 'classic');
});

Test.add('input', (check) => {
  const id = startInputMatch();
  const pad = fakePad('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)');
  PadInput.poll(pad, TEST_FRAME);
  check('pad: a playstation pad is detected by its id', Input.padStyle === 'playstation');
  PadInput.poll(fakePad(), TEST_FRAME);
  check('pad: hot-plugging another pad changes the glyph family', Input.padStyle === 'xbox');
  const menu = [];
  const listener = Bus.on('input.menu', (payload) => menu.push(payload.command));
  Input.uiOpen = true;
  const nav = fakePad();
  padButton(nav, 13, true); PadInput.poll(nav, TEST_FRAME);
  PadInput.poll(nav, 0.4); PadInput.poll(nav, 0.13); PadInput.poll(nav, 0.13);
  check('pad menu: d-pad down navigates, then repeats while held', menu.join() === 'down,down,down,down', menu.join());
  padButton(nav, 13, false); PadInput.poll(nav, TEST_FRAME);
  menu.length = 0;
  padButton(nav, 0, true); padButton(nav, 1, true); PadInput.poll(nav, TEST_FRAME);
  check('pad menu: A accepts, B goes back', menu.join() === 'accept,back', menu.join());
  padButton(nav, 0, false); padButton(nav, 1, false); PadInput.poll(nav, TEST_FRAME);
  menu.length = 0;
  nav.axes[0] = 1; PadInput.poll(nav, TEST_FRAME);
  check('pad menu: the left stick navigates too (INP-010)', menu.join() === 'right');
  nav.axes[0] = 0; PadInput.poll(nav, TEST_FRAME);
  Input.uiOpen = false; Bus.off('input.menu', listener);
  startInputMatch();
  const held = fakePad(); padButton(held, 7, true); PadInput.poll(held, TEST_FRAME); Input.frame(TEST_FRAME);
  Input.device = 'gamepad';
  PadInput.connected = 1;
  PadInput.onDisconnected();
  check('pad: unplugging mid-match pauses with the controller reason (LT-C-012)', Game.paused && Game.pauseReason === 'controller');
  Game.resume(); Input.frame(TEST_FRAME);
  check('pad: nothing stays pressed after the unplug', Actors.buttons[id] === 0 && Input.holdCount[Input.actionIndex.fire] === 0);
  const effects = [];
  const original = PadInput.activePad;
  PadInput.activePad = () => ({ vibrationActuator: { playEffect: (type, options) => effects.push(options) } });
  Input.device = 'gamepad';
  Input.rumble(0.5, 120);
  setInputSetting('controls.vibration', false);
  Input.rumble(0.5, 120);
  PadInput.activePad = original;
  check('rumble: plays on the pad, and the option turns it off (LT-L-026)', effects.length === 1 && effects[0].duration === 120 && effects[0].strongMagnitude === 0.5);
  setInputSetting('controls.vibration', true);
});

Test.add('input', (check) => {
  const id = startInputMatch();
  Actors.x[id] = 0; Actors.y[id] = 0; Actors.z[id] = 0;
  let allow = true, targetYawDegrees = 0;
  Input.aimAssistTarget = (actor, out) => {
    if (!allow) return false;
    out.x = Math.sin(targetYawDegrees * DEG) * 10; out.y = Actors.eyeY(actor); out.z = Math.cos(targetYawDegrees * DEG) * 10;
    return true;
  };
  Input.device = 'gamepad';
  Input.addLook(1 * DEG, 0, true); Input.frame(TEST_FRAME);
  check('assist: slowdown inside the cone is 40% at full strength, scaled by 60%', Input.assist.active && Test.near(Input.assist.slowdown, 0.76, 1e-6), Input.assist.slowdown);
  check('assist: the slowed look turns 0.76 degrees', Test.near(Actors.aimYaw[id], -0.76 * DEG, 1e-5), Actors.aimYaw[id] / DEG);
  startInputMatch(); Input.aimAssistTarget = null; Input.device = 'gamepad';
  Input.aimAssistTarget = (actor, out) => { out.x = Math.sin(5 * DEG) * 10; out.y = Actors.eyeY(actor); out.z = Math.cos(5 * DEG) * 10; return true; };
  Input.addLook(1 * DEG, 0, true); Input.frame(TEST_FRAME);
  check('assist: nothing outside the 3 degree cone', !Input.assist.active && Input.assist.slowdown === 1 && Test.near(Actors.aimYaw[id], -1 * DEG, 1e-5));
  startInputMatch(); Input.device = 'touch'; targetYawDegrees = 0; allow = true;
  Input.aimAssistTarget = (actor, out) => { out.x = 0; out.y = Actors.eyeY(actor); out.z = 10; return true; };
  Input.addLook(1 * DEG, 0, true); Input.frame(TEST_FRAME);
  check('assist: touch strength defaults to 70%', Test.near(Input.assist.slowdown, 0.72, 1e-6));
  startInputMatch(); Input.device = 'kbm';
  Input.aimAssistTarget = (actor, out) => { out.x = 0; out.y = Actors.eyeY(actor); out.z = 10; return true; };
  Input.addLook(1 * DEG, 0, false); Input.frame(TEST_FRAME);
  check('assist: never active with the mouse (INP-008)', !Input.assist.active && Test.near(Actors.aimYaw[id], -1 * DEG, 1e-5), Input.assist.active + ' ' + Actors.aimYaw[id] / DEG + ' ' + Input.device);
  startInputMatch(); Input.device = 'gamepad'; setInputSetting('controls.pad.aimAssist', 0);
  Input.aimAssistTarget = (actor, out) => { out.x = 0; out.y = Actors.eyeY(actor); out.z = 10; return true; };
  Input.frame(TEST_FRAME);
  check('assist: strength 0 turns it off', !Input.assist.active);
  setInputSetting('controls.pad.aimAssist', 100);
  allow = false;
  Input.aimAssistTarget = (actor, out) => allow && !!(out.z = 10);
  Input.frame(TEST_FRAME);
  check('assist: a target the hook refuses (smoke, cloak) gives no assist', !Input.assist.active);
  setInputSetting('controls.pad.aimAssist', 60);

  startInputMatch(); Input.device = 'gamepad';
  Input.aimAssistTarget = (actor, out) => { out.x = Math.sin(2 * DEG) * 10; out.y = Actors.eyeY(actor); out.z = Math.cos(2 * DEG) * 10; return true; };
  Input.frame(TEST_FRAME);
  check('assist: magnetism needs look input, fire or aim', Test.near(Actors.aimYaw[id], 0, 1e-9));
  holdAction('alt', true);
  for (let i = 0; i < 60; i++) Input.frame(TEST_FRAME);
  holdAction('alt', false);
  check('assist: magnetism pulls at most 1.5 deg/s x strength (0.9 deg in 1 s)', Test.near(Actors.aimYaw[id], 0.9 * DEG, 0.02 * DEG), Actors.aimYaw[id] / DEG);
  startInputMatch(); Input.device = 'gamepad';
  Input.aimAssistTarget = (actor, out) => { out.x = Math.sin(0.1 * DEG) * 10; out.y = Actors.eyeY(actor); out.z = Math.cos(0.1 * DEG) * 10; return true; };
  holdAction('alt', true); Input.frame(5); holdAction('alt', false);
  check('assist: no snap, the pull never overshoots the target', Test.near(Actors.aimYaw[id], 0.1 * DEG, 1e-6), Actors.aimYaw[id] / DEG);
  Input.aimAssistTarget = null;
});

// ---- Touch ----
function touchPointer(type, target, pointerId, x, y) {
  target.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
}
const TOUCH_LEFT_X = 200, TOUCH_RIGHT_X = 900;   // inside the move zone / the look zone of the 1280 px test window

Test.add('input', (check) => {
  const id = startInputMatch();
  Input.setDevice('touch');
  const zone = TouchInput.zone;
  touchPointer('pointerdown', zone, 1, TOUCH_LEFT_X, 500);
  touchPointer('pointermove', zone, 1, TOUCH_LEFT_X + TOUCH_STICK_RADIUS, 500);
  Input.frame(TEST_FRAME);
  check('touch: the layer shows while a match runs on touch', TouchInput.shown && TouchInput.layer.classList.contains('show'));
  check('touch: a full push right strafes right', Test.near(Actors.moveX[id], 1, 1e-6) && Actors.moveZ[id] === 0, Actors.moveX[id]);
  touchPointer('pointermove', zone, 1, TOUCH_LEFT_X, 500 - TOUCH_STICK_RADIUS * 0.5);
  Input.frame(TEST_FRAME);
  check('touch: pushing up walks forward, scaled past the deadzone', Actors.moveZ[id] > 0.3 && Actors.moveZ[id] < 0.5 && Test.near(Actors.moveX[id], 0, 1e-6), Actors.moveZ[id]);
  touchPointer('pointermove', zone, 1, TOUCH_LEFT_X, 500 - TOUCH_STICK_RADIUS * 0.85);
  stepAndFrame(); stepAndFrame();
  check('touch: 85% push does not sprint', (Actors.buttons[id] & BTN.SPRINT) === 0);
  touchPointer('pointermove', zone, 1, TOUCH_LEFT_X, 500 - TOUCH_STICK_RADIUS * 0.95);
  Input.frame(TEST_FRAME);
  check('touch: pushing past 90% sprints (INP-004)', (Actors.buttons[id] & BTN.SPRINT) !== 0);
  touchPointer('pointermove', zone, 1, TOUCH_LEFT_X, 500 - TOUCH_STICK_RADIUS * 0.85);
  Input.frame(TEST_FRAME);
  check('touch: sprint holds until the push falls under 80%', (Actors.buttons[id] & BTN.SPRINT) !== 0);
  touchPointer('pointermove', zone, 1, TOUCH_LEFT_X, 500 - TOUCH_STICK_RADIUS * 0.7);
  stepAndFrame(); stepAndFrame();
  check('touch: sprint ends below 80%', (Actors.buttons[id] & BTN.SPRINT) === 0);
  touchPointer('pointerup', zone, 1, TOUCH_LEFT_X, 500);
  Input.frame(TEST_FRAME);
  check('touch: lifting the finger stops the walk', Actors.moveX[id] === 0 && Actors.moveZ[id] === 0 && TouchInput.activeCount === 0);
  check('touch: the layer blocks scrolling, zoom and selection', getComputedStyle(TouchInput.layer).touchAction === 'none' && getComputedStyle(document.body).userSelect === 'none');
});

Test.add('input', (check) => {
  const id = startInputMatch();
  Input.setDevice('touch');
  setInputSetting('controls.touch.acceleration', 0);
  const zone = TouchInput.zone, fire = TouchInput.elements.fire, jump = TouchInput.elements.jump;
  touchPointer('pointerdown', zone, 11, TOUCH_LEFT_X, 500);
  touchPointer('pointermove', zone, 11, TOUCH_LEFT_X + TOUCH_STICK_RADIUS, 500);
  touchPointer('pointerdown', fire, 12, 1100, 400);
  touchPointer('pointerdown', zone, 13, TOUCH_RIGHT_X, 300);
  touchPointer('pointerdown', jump, 14, 1000, 600);
  touchPointer('pointermove', zone, 13, TOUCH_RIGHT_X + 100, 300);
  Input.frame(TEST_FRAME);
  check('multi-touch: stick + fire + look + jump with four fingers', Actors.moveX[id] === 1 && (Actors.buttons[id] & (BTN.FIRE | BTN.JUMP)) === (BTN.FIRE | BTN.JUMP) && TouchInput.activeCount === 4);
  check('multi-touch: only the look finger turns the view (3 mrad per px)', Test.near(Actors.aimYaw[id], -0.3, 1e-4), Actors.aimYaw[id]);
  touchPointer('pointermove', fire, 12, 1110, 410);
  touchPointer('pointerup', fire, 12, 1110, 410);
  stepAndFrame(); stepAndFrame();
  check('multi-touch: lifting one finger releases only its control', (Actors.buttons[id] & BTN.FIRE) === 0 && (Actors.buttons[id] & BTN.JUMP) !== 0 && Actors.moveX[id] === 1);
  touchPointer('pointerup', zone, 11, TOUCH_LEFT_X, 500);
  touchPointer('pointerup', jump, 14, 1000, 600);
  touchPointer('pointerup', zone, 13, TOUCH_RIGHT_X, 300);
  stepAndFrame(); stepAndFrame();
  check('multi-touch: everything released, no slot leaks', Actors.buttons[id] === 0 && Actors.moveX[id] === 0 && TouchInput.activeCount === 0 && TouchInput.slots.every((slot) => slot.pointerId === -1));
  for (let pointer = 20; pointer < 20 + TOUCH_SLOT_COUNT + 2; pointer++) touchPointer('pointerdown', zone, pointer, TOUCH_RIGHT_X, 300);
  check('multi-touch: more fingers than slots are ignored safely', TouchInput.activeCount === TOUCH_SLOT_COUNT);
  for (let pointer = 20; pointer < 20 + TOUCH_SLOT_COUNT + 2; pointer++) touchPointer('pointerup', zone, pointer, TOUCH_RIGHT_X, 300);
  check('multi-touch: all slots free again', TouchInput.activeCount === 0);
  let perfToggles = 0;
  const listener = Bus.on('input.action', (event) => { if (event.action === 'perfHud' && event.down) perfToggles++; });
  for (let pointer = 40; pointer < 43; pointer++) touchPointer('pointerdown', zone, pointer, TOUCH_RIGHT_X + pointer, 300);
  const threeFingers = perfToggles;
  touchPointer('pointerdown', zone, 43, TOUCH_RIGHT_X, 300);
  const fourFingers = perfToggles;
  for (let pointer = 40; pointer < 44; pointer++) touchPointer('pointerup', zone, pointer, TOUCH_RIGHT_X, 300);
  Bus.off('input.action', listener);
  Input.clearAll();
  check('touch: a four-finger tap toggles the performance HUD, three do not (ARC-040)', threeFingers === 0 && fourFingers === 1);
  setInputSetting('controls.touch.acceleration', 0.3);
});

Test.add('input', (check) => {
  const id = startInputMatch();
  Input.setDevice('touch');
  const zone = TouchInput.zone;
  setInputSetting('controls.touch.acceleration', 0);
  touchPointer('pointerdown', zone, 1, TOUCH_RIGHT_X, 300);
  touchPointer('pointermove', zone, 1, TOUCH_RIGHT_X + 10, 300 + 10);
  Input.frame(TEST_FRAME);
  check('touch look: pixels turn the view, down looks down', Test.near(Actors.aimYaw[id], -0.03, 1e-5) && Test.near(Actors.aimPitch[id], -0.03, 1e-5), Actors.aimYaw[id]);
  setInputSetting('controls.touch.sensitivity', 2);
  touchPointer('pointermove', zone, 1, TOUCH_RIGHT_X + 20, 300 + 10);
  Input.frame(TEST_FRAME);
  check('touch look: sensitivity scales it', Test.near(Actors.aimYaw[id], -0.03 - 0.06, 1e-5), Actors.aimYaw[id]);
  setInputSetting('controls.touch.sensitivity', 1);
  setInputSetting('controls.touch.acceleration', 1);
  const before = Actors.aimYaw[id];
  touchPointer('pointermove', zone, 1, TOUCH_RIGHT_X + 120, 300 + 10);
  Input.frame(TEST_FRAME);
  check('touch look: acceleration makes fast swipes turn further', Math.abs(Actors.aimYaw[id] - before) > 100 * TOUCH_RADIANS_PER_PIXEL * 1.5, Actors.aimYaw[id] - before);
  touchPointer('pointerup', zone, 1, TOUCH_RIGHT_X + 120, 310);
  setInputSetting('controls.touch.acceleration', 0.3);

  startInputMatch(); Input.setDevice('touch');
  touchPointer('pointerdown', zone, 2, TOUCH_RIGHT_X, 300); touchPointer('pointerup', zone, 2, TOUCH_RIGHT_X, 300); Input.frame(TEST_FRAME);
  check('touch: a tap does nothing unless tap-to-fire is on', (Actors.buttons[id] & BTN.FIRE) === 0);
  setInputSetting('controls.touch.tapToFire', true);
  touchPointer('pointerdown', zone, 3, TOUCH_RIGHT_X, 300); touchPointer('pointerup', zone, 3, TOUCH_RIGHT_X, 300); Input.frame(TEST_FRAME);
  check('touch: tap-to-fire fires on a short still touch', (Actors.buttons[id] & BTN.FIRE) !== 0);
  stepAndFrame();
  touchPointer('pointerdown', zone, 4, TOUCH_RIGHT_X, 300); touchPointer('pointermove', zone, 4, TOUCH_RIGHT_X + 60, 300); touchPointer('pointerup', zone, 4, TOUCH_RIGHT_X + 60, 300);
  Input.frame(TEST_FRAME);
  check('touch: a drag is not a tap', (Actors.buttons[id] & BTN.FIRE) === 0);
  setInputSetting('controls.touch.tapToFire', false);

  startInputMatch(); Input.setDevice('touch');
  Input.autoFireTarget = true; Input.frame(TEST_FRAME);
  check('touch: auto-fire presses fire while the crosshair is on an enemy', Input.autoFire && (Actors.buttons[id] & BTN.FIRE) !== 0);
  Input.autoFireTarget = false; stepAndFrame(); stepAndFrame();
  check('touch: auto-fire stops when the crosshair leaves', (Actors.buttons[id] & BTN.FIRE) === 0);
  setInputSetting('controls.touch.autoFire', false);
  Input.autoFireTarget = true; Input.frame(TEST_FRAME);
  check('touch: auto-fire can be turned off', !Input.autoFire && (Actors.buttons[id] & BTN.FIRE) === 0);
  setInputSetting('controls.touch.autoFire', true);
  Input.autoFireTarget = false;
  Input.setDevice('kbm'); Input.autoFireTarget = true; Input.frame(TEST_FRAME);
  check('touch: auto-fire never acts for other devices', (Actors.buttons[id] & BTN.FIRE) === 0);
  Input.autoFireTarget = false;
});

Test.add('input', (check) => {
  startInputMatch();
  check('layout: control ids are unique and every action exists', new Set(TOUCH_CONTROLS.map((control) => control.id)).size === TOUCH_CONTROLS.length && TOUCH_CONTROLS.every((control) => !control.action || Input.actionIndex[control.action] !== undefined));
  check('layout: every default position is on screen in every preset', TOUCH_PRESETS.every((preset) => TOUCH_CONTROLS.every((control) => {
    const x = preset.mirror ? 1 - control.x : control.x;
    return x > 0 && x < 1 && control.y > 0 && control.y < 1;
  })));
  check('layout: all spec buttons exist (INP-004)', ['fire', 'aim', 'jump', 'crouch', 'reload', 'swap', 'grenade', 'ability1', 'ability2', 'ultimate', 'ping', 'scoreboard', 'pause', 'fireLeft'].every((name) => !!TouchInput.controlById[name]));
  const start = { x: TouchInput.getProperty('fire', 'x'), scale: TouchInput.getProperty('fire', 'scale'), opacity: TouchInput.getProperty('fire', 'opacity') };
  TouchInput.setProperty('fire', 'scale', 5);
  check('layout: size clamps at 200%', TouchInput.getProperty('fire', 'scale') === TOUCH_SCALE_MAX);
  TouchInput.setProperty('fire', 'scale', 0.1);
  check('layout: size clamps at 50%', TouchInput.getProperty('fire', 'scale') === TOUCH_SCALE_MIN);
  TouchInput.setProperty('fire', 'opacity', 0.01);
  check('layout: opacity clamps at 20%', TouchInput.getProperty('fire', 'opacity') === TOUCH_OPACITY_MIN);
  TouchInput.setProperty('fire', 'opacity', 5);
  check('layout: opacity clamps at 100%', TouchInput.getProperty('fire', 'opacity') === TOUCH_OPACITY_MAX);
  TouchInput.setProperty('fire', 'scale', 2);
  TouchInput.setProperty('fire', 'position', { x: 5, y: -3 });
  const edge = (TouchInput.controlById.fire.size * 2 / 2) / window.innerWidth;
  check('layout: a control can never leave the screen (LT-H-063)', Test.near(TouchInput.getProperty('fire', 'x'), 1 - edge, 1e-9) && TouchInput.getProperty('fire', 'y') > 0);
  const saved = Save.data.touchLayouts.standard.fire;
  check('layout: saved per preset in Save.data.touchLayouts', saved.scale === 2 && saved.opacity === TOUCH_OPACITY_MAX && !Save.data.touchLayouts.compact);
  Save.data = JSON.parse(JSON.stringify(Save.data));
  check('layout: identical after a reload of the save', TouchInput.getProperty('fire', 'scale') === 2 && Test.near(TouchInput.getProperty('fire', 'x'), 1 - edge, 1e-9));
  setInputSetting('controls.touch.layout', 'compact');
  check('layout: another preset has its own layout', TouchInput.getProperty('fire', 'scale') === 0.8 && TouchInput.getProperty('fire', 'x') === TouchInput.controlById.fire.x);
  setInputSetting('controls.touch.layout', 'mirrored');
  check('layout: the left-handed preset mirrors the controls', Test.near(TouchInput.getProperty('fire', 'x'), 1 - TouchInput.controlById.fire.x, 1e-9));
  setInputSetting('controls.touch.layout', 'standard');
  TouchInput.setProperty('jump', 'hidden', true);
  check('layout: a hidden control is removed from play', TouchInput.elements.jump.classList.contains('off'));
  TouchInput.setEditing(true);
  check('layout: a hidden control shows as a ghost in the editor', TouchInput.elements.jump.classList.contains('ghost') && !TouchInput.elements.jump.classList.contains('off'));
  TouchInput.setEditing(false);
  TouchInput.resetLayout();
  check('layout: reset restores every default (LT-H-064)', TouchInput.getProperty('fire', 'scale') === start.scale && TouchInput.getProperty('fire', 'x') === start.x && TouchInput.getProperty('fire', 'opacity') === start.opacity && !TouchInput.getProperty('jump', 'hidden'));
  setInputSetting('controls.touch.leftFire', true);
  check('layout: the optional left fire button follows its setting', !TouchInput.elements.fireLeft.classList.contains('off'));
  setInputSetting('controls.touch.leftFire', false);
  TouchInput.applyAll();
  check('layout: left fire is off by default', TouchInput.elements.fireLeft.classList.contains('off'));
});

Test.add('input', (check) => {
  const id = startInputMatch();
  Input.setDevice('touch');
  TouchInput.setEditing(true);
  Input.frame(TEST_FRAME);
  const jump = TouchInput.elements.jump;
  touchPointer('pointerdown', jump, 1, 640, 400);
  check('editor: touching a control selects it and presses nothing', TouchInput.selected === 'jump' && Input.holdCount[Input.actionIndex.jump] === 0);
  touchPointer('pointermove', jump, 1, 640, 400);
  touchPointer('pointerup', jump, 1, 640, 400);
  const rect = TouchInput.layer.getBoundingClientRect();
  check('editor: dragging moves the control and saves it', Test.near(TouchInput.getProperty('jump', 'x'), (640 - rect.left) / rect.width, 1e-6) && !!Save.data.touchLayouts.standard.jump);
  touchPointer('pointerdown', TouchInput.zone, 2, 300, 300);
  check('editor: touching empty space deselects', TouchInput.selected === null);
  touchPointer('pointerup', TouchInput.zone, 2, 300, 300);
  TouchInput.setEditing(false);
  TouchInput.resetLayout();
  const out = { right: 0, down: 0 };
  gyroToLook({ beta: 30, gamma: 0 }, 90, out);
  check('gyro: landscape turn about the screen-up axis is a yaw (turn left is negative about up)', Test.near(out.right, -30 * DEG, 1e-9) && Test.near(out.down, 0, 1e-9));
  gyroToLook({ beta: 10, gamma: 20 }, 0, out);
  check('gyro: portrait maps gamma to yaw and beta to pitch', Test.near(out.right, -20 * DEG, 1e-9) && Test.near(out.down, 10 * DEG, 1e-9));
  gyroToLook({ beta: 0, gamma: 10 }, 90, out);
  check('gyro: the screen-right axis flips with orientation', Test.near(out.down, -10 * DEG, 1e-9));
  gyroToLook({ beta: 5, gamma: 5 }, 45, out);
  check('gyro: an unknown angle falls back to portrait', Test.near(out.right, -5 * DEG, 1e-9));
  setInputSetting('controls.touch.gyro', 'always');
  TouchInput.gyro.attached = true; TouchInput.gyro.right = 0.5; TouchInput.gyro.down = 0;
  Input.frame(1);
  check('gyro: always mode adds the rotation rate to the look', Test.near(Actors.aimYaw[id], -0.5, 1e-6), Actors.aimYaw[id]);
  setInputSetting('controls.touch.gyro', 'aiming');
  TouchInput.gyro.right = 0.5;
  const before = Actors.aimYaw[id];
  Input.frame(1);
  check('gyro: aiming mode waits for the aim button', Actors.aimYaw[id] === before);
  holdAction('alt', true); Input.frame(1); holdAction('alt', false);
  check('gyro: aiming mode turns while aiming', Actors.aimYaw[id] < before - 0.3);
  setInputSetting('controls.touch.gyro', 'off');
  TouchInput.gyro.attached = false; TouchInput.gyro.right = 0;
});

Test.add('input', (check) => {
  const id = startInputMatch();
  keyEvent('KeyW', true);
  const started = performance.now();
  for (let i = 0; i < 2000; i++) { Input.frame(TEST_FRAME); if (i % 3 === 0) Sim.step(); }
  const perFrame = (performance.now() - started) / 2000;
  const kept = Actors.moveZ[id] === 1;
  keyEvent('KeyW', false);
  check('perf: a frame of input sampling costs far below the 0.4 ms budget', perFrame < 0.1, perFrame.toFixed(4) + ' ms');
  check('perf: sampling kept the player input valid', kept);
  Game.pause('menu');
  const sources = Input.sources.length;
  check('structure: touch and gamepad register as sources', sources === 2);
  Game.resume();
});
