// Self-tests for S18 UI shell and screens: stack, focus navigation, toasts, settings, rebinding, menus, pause, help, layout editor, perf overlay.

DebugApi.ui = Ui;
Ui.selfTestRunner = (options) => Test.run(options);   // Help > Run self-test

const UI_OPEN_BUDGET_MS = 1000;   // UI-001: no screen takes longer than 1 s to open

// UI tests need the DOM menus, which are off in headless runs: switch them on for one block and restore afterwards.
// uiEnter() returns the function that undoes it (and drops the screens the tests registered, all named test*).
function uiEnter() {
  const savedHeadless = Game.headless, savedCanLock = Input.canLock;
  Game.headless = false;
  Input.canLock = () => false;
  Ui.closeAll();
  Input.uiOpen = false;
  return () => {
    Ui.closeAll();
    for (const name of Array.from(Ui.screens.keys())) if (name.startsWith('test')) Ui.screens.delete(name);
    Input.canLock = savedCanLock;
    Game.headless = savedHeadless;
    Input.uiOpen = false;
    Input.clearAll();
  };
}
function uiWith(run) {
  const leave = uiEnter();
  try { return run(); } finally { leave(); }
}
function uiWait(milliseconds) { return new Promise((done) => setTimeout(done, milliseconds)); }
function uiKey(code, shift) { window.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey: !!shift, bubbles: true, cancelable: true })); }
function uiMenuCommand(command) { Bus.emit('input.menu', { command }); }
function uiScreenText(name) { return Ui.root.querySelector('.ui-' + name).textContent; }
function uiClickButton(root, text) {
  const button = Array.from(root.querySelectorAll('button')).find((item) => item.textContent.startsWith(text));
  if (button) button.click();
  return !!button;
}
function uiOpenTestScreen(name, labels, clicks) {
  Ui.register(name, {
    build(root) { labels.forEach((label, index) => root.appendChild(Ui.button(label, () => clicks.push(label + index)))); },
  });
  return Ui.open(name);
}

Test.add('ui', (check) => uiWith(() => {
  const log = [];
  Ui.register('testA', { build(root) { root.appendChild(Ui.button('A1', () => {})); }, onOpen() { log.push('openA'); }, onClose() { log.push('closeA'); } });
  Ui.register('testB', { build(root) { root.appendChild(Ui.button('B1', () => {})); }, onOpen() { log.push('openB'); }, onClose() { log.push('closeB'); } });
  check('stack: open adds a screen and tells the input layer', Ui.open('testA') && Ui.current() === 'testA' && Input.uiOpen && Ui.root.querySelector('.ui-testA'));
  const focusedA = document.activeElement;
  Ui.open('testB');
  check('stack: a second screen hides the first', Ui.stack.length === 2 && Ui.stack[0].element.classList.contains('behind') && Ui.current() === 'testB');
  check('stack: focus lands inside the new screen', Ui.top().element.contains(document.activeElement));
  Ui.back();
  check('stack: back closes the top screen and shows the one below', Ui.current() === 'testA' && !Ui.stack[0].element.classList.contains('behind') && log.join() === 'openA,openB,closeB');
  check('stack: back restores the focus', document.activeElement === focusedA);
  Ui.replace('testB');
  check('stack: replace swaps the top screen', Ui.stack.length === 1 && Ui.current() === 'testB');
  Ui.back();
  check('stack: the last back leaves no screen and releases the game input', Ui.stack.length === 0 && !Input.uiOpen && !Ui.back());
  Ui.toastBox.replaceChildren();
  const toastBefore = 0;
  check('stack: an unknown screen shows "Coming soon" instead of failing', !Ui.open('doesNotExist') && Ui.lastToast === 'Coming soon' && Ui.toastBox.children.length === toastBefore + 1);
  Ui.register('testBroken', { build() { throw new Error('screen blew up'); } });
  let opened = true;
  const logged = Test.expectErrors(() => { opened = Ui.open('testBroken'); });
  check('stack: a screen that throws is logged and removed, the UI survives', logged === 1 && !opened && Ui.stack.length === 0 && !Input.uiOpen);
  Ui.register('testSticky', { noBack: true, build(root) { root.appendChild(Ui.button('S', () => {})); } });
  Ui.open('testSticky');
  check('stack: a top-level screen ignores back', !Ui.back() && Ui.current() === 'testSticky');
  Ui.closeAll();
  const handled = [];
  Ui.register('testHandler', { onBack() { handled.push('back'); return true; }, build(root) { root.appendChild(Ui.button('H', () => {})); } });
  Ui.open('testHandler'); Ui.back();
  check('stack: a screen can handle back itself', handled.length === 1 && Ui.current() === 'testHandler');
  Ui.closeAll();
  let confirmed = 0;
  Ui.confirm({ title: 'Sure?', text: 'Really?', yes: 'Do it', onYes: () => { confirmed++; } });
  check('confirm: the dialog focuses the safe answer', document.activeElement.textContent === 'Cancel' && uiScreenText('confirm').includes('Really?'));
  uiClickButton(Ui.top().element, 'Cancel');
  check('confirm: Cancel closes without acting', confirmed === 0 && Ui.stack.length === 0);
  Ui.confirm({ title: 'Sure?', text: 'Really?', yes: 'Do it', onYes: () => { confirmed++; } });
  uiClickButton(Ui.top().element, 'Do it');
  check('confirm: the yes button acts once and closes', confirmed === 1 && Ui.stack.length === 0);
  const clicks = [];
  const listener = Bus.on('ui.click', (payload) => clicks.push(payload.kind));
  Ui.register('testClicker', { build(root) { root.appendChild(Ui.button('C', () => {})); } });
  Ui.open('testClicker');
  uiClickButton(Ui.top().element, 'C'); Ui.back();
  Bus.off('ui.click', listener);
  check('events: buttons and back emit ui.click for the sound hook', clicks.join() === 'accept,back', clicks.join());
}));

Test.add('ui', (check) => uiWith(() => {
  Ui.register('testTyping', {
    build(root) {
      const field = makeElement('input');
      field.type = 'text';
      root.appendChild(field);
      root.appendChild(makeElement('textarea'));
      root.appendChild(Ui.button('After', () => {}));
    },
  });
  Ui.open('testTyping');
  const element = Ui.top().element, field = element.querySelector('input'), area = element.querySelector('textarea');
  const keyIn = (target, code) => target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  field.focus(); keyIn(field, 'ArrowDown');
  check('typing: arrows inside a text field move the caret, not the menu focus (INP-010)', document.activeElement === field);
  area.focus(); keyIn(area, 'ArrowUp');
  check('typing: the same inside a textarea', document.activeElement === area);
  check('typing: a textarea can take the menu focus', Array.from(element.querySelectorAll(UI_FOCUSABLE)).includes(area));
  field.focus(); keyIn(field, 'Escape');
  check('typing: Esc in a text field still goes back', Ui.current() !== 'testTyping');
}));

Test.add('ui', (check) => uiWith(() => {
  const clicks = [];
  uiOpenTestScreen('testNav', ['First', 'Second', 'Third'], clicks);
  const buttons = Array.from(Ui.top().element.querySelectorAll('button'));
  check('focus: the first control is focused on open (INP-010)', document.activeElement === buttons[0]);
  uiKey('ArrowDown');
  check('keyboard: arrow down moves focus down', document.activeElement === buttons[1]);
  uiKey('ArrowDown'); uiKey('ArrowDown');
  check('keyboard: no wrap past the last control', document.activeElement === buttons[2]);
  uiKey('ArrowUp');
  check('keyboard: arrow up moves focus up', document.activeElement === buttons[1]);
  uiKey('Tab');
  check('keyboard: Tab goes to the next control', document.activeElement === buttons[2]);
  uiKey('Tab');
  check('keyboard: Tab wraps around', document.activeElement === buttons[0]);
  uiKey('Tab', true);
  check('keyboard: Shift+Tab goes back and wraps', document.activeElement === buttons[2]);
  const moves = [];
  const listener = Bus.on('ui.click', (payload) => moves.push(payload.kind));
  uiMenuCommand('up');
  check('gamepad: the d-pad moves focus and emits a move sound', document.activeElement === buttons[1] && moves.join() === 'move');
  uiMenuCommand('next');
  uiMenuCommand('accept');
  Bus.off('ui.click', listener);
  check('gamepad: accept presses the focused button', clicks.join() === 'Third2', clicks.join());
  uiMenuCommand('back');
  check('gamepad: back closes the screen', Ui.stack.length === 0);
  Ui.register('testAdjust', {
    build(root) {
      root.appendChild(Ui.cycle(['a', 'b', 'c'], ['Alpha', 'Beta', 'Gamma'], 'a', (value) => clicks.push(value)));
      root.appendChild(Ui.slider({ min: 0, max: 10, step: 1, value: 5, format: (value) => 'v' + value }, (value) => clicks.push(value)));
    },
  });
  clicks.length = 0;
  Ui.open('testAdjust');
  uiKey('ArrowRight'); uiKey('ArrowRight'); uiKey('ArrowLeft');
  check('keyboard: left and right change a cycle value', clicks.join() === 'b,c,b', clicks.join());
  uiKey('ArrowDown'); uiMenuCommand('right'); uiMenuCommand('right'); uiMenuCommand('left');
  const slider = Ui.top().element.querySelector('input');
  check('gamepad: left and right change a slider', slider.value === '6' && clicks.slice(3).join() === '6,7,6', clicks.join());
  check('slider: the value label follows', Ui.top().element.querySelector('.ui-value').textContent === 'v6');
  uiKey('Escape');
  check('keyboard: Esc goes back', Ui.stack.length === 0);
}));

Test.add('ui', (check) => uiWith(() => {
  Ui.toast('Hello there');
  check('toast: appears with the text', Ui.toastBox.lastChild.textContent === 'Hello there' && Ui.lastToast === 'Hello there');
  Bus.emit('toast', { text: 'From the bus' });
  check('toast: the toast event shows one too', Ui.toastBox.lastChild.textContent === 'From the bus');
  for (let i = 0; i < 8; i++) Ui.toast('spam ' + i);
  check('toast: at most four stay on screen', Ui.toastBox.children.length === UI_MAX_TOASTS);
  check('toast: the box never blocks taps', getComputedStyle(Ui.toastBox).pointerEvents === 'none');
  Ui.toastBox.replaceChildren();
}));

Test.add('ui', (check) => uiWith(() => {
  const names = Array.from(Ui.screens.keys()).filter((name) => !name.startsWith('test'));
  const params = { confirm: { title: 'T', text: 'x', onYes: () => {} }, pause: { reason: 'menu' } };
  for (const name of names) {
    const started = performance.now();
    const opened = Ui.open(name, params[name]);
    const elapsed = performance.now() - started;
    check('screen ' + name + ': opens in under 1 s (UI-001)', opened && elapsed < UI_OPEN_BUDGET_MS, elapsed.toFixed(1) + ' ms');
    const items = Ui.focusables(Ui.top().element);
    check('screen ' + name + ': has focusable controls and one has focus', items.length > 0 && Ui.top().element.contains(document.activeElement));
    const reached = new Set();
    for (let i = 0; i < items.length; i++) { reached.add(document.activeElement); uiMenuCommand('next'); }
    check('screen ' + name + ': every control is reachable with next/prev alone', reached.size === items.length || items.length <= 1 || !!Ui.top().screen.onCommand, reached.size + ' of ' + items.length);
    check('screen ' + name + ': can be left (back, or a top-level screen)', Ui.top().screen.noBack === true || !!Ui.top().screen.onBack || Ui.back());
    Ui.closeAll();
    check('screen ' + name + ': closes cleanly', Ui.stack.length === 0 && !Input.uiOpen && !Ui.root.querySelector('.ui-' + name));
  }
}));

Test.add('ui', (check) => uiWith(() => {
  Ui.open('settings', { tab: 'nonsense' });
  check('settings: an unknown tab falls back to the first one', Ui.current() === 'settings' && !!Ui.top().element.querySelector('.ui-tab.active'));
  Ui.closeAll();
  Settings.set('controls.touch.gyro', 'always'); Settings.set('controls.touch.gyroSensitivity', 2);
  const announced = [];
  const listener = Bus.on('setting', (key) => announced.push(key));
  Settings.resetKeys(['controls.touch.gyro']);
  Bus.off('setting', listener);
  check('settings: a key reset touches only that key and announces it once', Settings.get('controls.touch.gyro') === 'off' && Settings.get('controls.touch.gyroSensitivity') === 2 && announced.join() === 'controls.touch.gyro', announced.join());
  Settings.resetKeys(['controls.touch.gyro']);
  Ui.open('settings', { tab: 'controls' });
  const root = Ui.top().element;
  const keys = settingKeys('controls');
  const rows = root.querySelectorAll('.ui-scroll .ui-row');
  check('settings: one row for every controls setting (generated)', rows.length === keys.length, rows.length + ' rows, ' + keys.length + ' settings');
  check('settings: labels come from the definitions', Array.from(rows).every((row, index) => row.querySelector('.ui-label').textContent === Settings.definitions.get(keys[index]).label));
  for (const [category] of SETTINGS_TABS) {
    if (!settingKeys(category).length) continue;
    uiClickButton(root, SETTINGS_TABS.find((tab) => tab[0] === category)[1]);
    check('settings: tab ' + category + ' shows all its settings', root.querySelectorAll('.ui-scroll .ui-row').length === settingKeys(category).length + (category === 'accessibility' ? Access.mirroredCount() : 0));
  }
  uiClickButton(root, 'Controls');
  const sensitivityRow = Array.from(root.querySelectorAll('.ui-row')).find((row) => row.textContent.startsWith('Mouse sensitivity'));
  const slider = sensitivityRow.querySelector('input');
  slider.value = 3; slider.dispatchEvent(new Event('input'));
  check('settings: a slider applies instantly and saves (ARC-021)', Settings.get('controls.mouseSensitivity') === 3 && Save.data.settings['controls.mouseSensitivity'] === 3);
  check('settings: the cm per 360 note follows the slider', document.querySelector('.ui-cm360').textContent.includes(Input.cmPer360(3, 800).toFixed(1)));
  const toggleRow = Array.from(root.querySelectorAll('.ui-row')).find((row) => row.textContent.startsWith('Invert look Y'));
  toggleRow.querySelector('button').click();
  check('settings: a toggle applies instantly', Settings.get('controls.invertY') === true);
  const cycleRow = Array.from(root.querySelectorAll('.ui-row')).find((row) => row.textContent.startsWith('Crouch'));
  cycleRow.querySelector('button').click();
  check('settings: a select cycles its options', Settings.get('controls.toggle.crouch') === 'toggle' && cycleRow.querySelector('button').textContent === 'Toggle');
  uiClickButton(root, 'Reset this tab');
  check('settings: reset asks first', Ui.current() === 'confirm' && Settings.get('controls.invertY') === true);
  uiClickButton(Ui.top().element, 'Reset');
  check('settings: reset restores the tab defaults', Settings.get('controls.invertY') === false && Settings.get('controls.mouseSensitivity') === 1 && Settings.get('controls.toggle.crouch') === 'hold');
  check('settings: the tab redraws after a reset', root.querySelector('.ui-scroll input').value === '1');
  Settings.set('ui.scale', 1.25);
  check('settings: UI scale applies at once', document.documentElement.style.getPropertyValue('--ui-scale') === '1.25');
  Settings.resetKeys(['ui.scale']);
  check('settings: UI scale reset', document.documentElement.style.getPropertyValue('--ui-scale') === '1');
  check('settings: developer tab holds the perf and bot overlays', settingKeys('developer').includes('developer.perfHud') && settingKeys('developer').includes('developer.botDebug'));
}));

Test.add('ui', (check) => uiWith(() => {
  Ui.open('bindings');
  const root = Ui.top().element;
  const rows = root.querySelectorAll('.ui-scroll .ui-row');
  check('bindings: one row for every action', rows.length === ACTION_ROWS.length);
  check('bindings: three slots and a reset per row', Array.from(rows).every((row) => row.querySelectorAll('button').length === BINDING_SLOTS.length + 1));
  const slotButton = (actionId, slot) => root.querySelector('[data-key="' + actionId + ':' + slot + '"]');
  check('bindings: shows the current binding names', slotButton('fire', 0).textContent === 'Left Mouse' && slotButton('jump', 0).textContent === 'Space' && slotButton('fire', 2).textContent === 'RT');
  slotButton('reload', 0).click();
  check('bindings: clicking a slot waits for a key', Input.capture && Input.capture.device === 'kbm' && slotButton('reload', 0).textContent.startsWith('Press'));
  uiKey('KeyJ');
  check('bindings: the pressed key is bound and saved', Input.getBinding('reload', 0) === 'Key:KeyJ' && slotButton('reload', 0).textContent === 'J' && Save.data.bindings.reload[0] === 'Key:KeyJ');
  check('bindings: focus stays on the edited slot', document.activeElement === slotButton('reload', 0));
  slotButton('melee', 0).click();
  uiKey('KeyJ');
  const marked = Array.from(root.querySelectorAll('.ui-row.conflict'));
  check('bindings: both rows sharing a key are flagged red', marked.length === 2 && marked.every((row) => row.textContent.includes('shares a key')));
  slotButton('melee', 0).click();
  uiKey('Escape');
  check('bindings: Esc cancels the capture and keeps the screen', Input.capture === null && Ui.current() === 'bindings' && Input.getBinding('melee', 0) === 'Key:KeyJ');
  slotButton('melee', 0).click();
  uiKey('Backspace');
  check('bindings: Backspace clears a slot', Input.getBinding('melee', 0) === '' && slotButton('melee', 0).textContent === 'Unbound');
  slotButton('use', 0).click();
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  check('bindings: the wheel can be bound', Input.getBinding('use', 0) === 'Wheel:up');
  slotButton('use', 1).click();
  window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', button: 3, bubbles: true, cancelable: true }));
  check('bindings: extra mouse buttons can be bound', Input.getBinding('use', 1) === 'Mouse:3');
  slotButton('use', 2).click();
  check('bindings: the pad slot waits for a controller button', Input.capture && Input.capture.device === 'pad');
  PadInput.onButton(5, true); PadInput.onButton(5, false);
  check('bindings: a controller button is bound', Input.getBinding('use', 2) === 'Pad:5' && slotButton('use', 2).textContent === 'RB');
  root.querySelector('[data-key="reload:0"]').parentElement.lastChild.click();
  check('bindings: the row reset restores the default', Input.getBinding('reload', 0) === 'Key:KeyR' && Save.data.bindings.reload === undefined);
  slotButton('melee', 1).click();
  Ui.back();
  check('bindings: leaving the screen cancels a pending capture', Input.capture === null);
  Input.resetBindings();
}));

Test.add('ui', (check) => uiWith(() => {
  Ui.open('main');
  const root = Ui.top().element;
  const buttons = Array.from(root.querySelectorAll('.ui-menu button'));
  check('main menu: lists the UI-001 entries in order', buttons.map((button) => button.firstChild.textContent).join() === 'Quick Match,Career,Play,Solo,Custom,Range,Generated map,Map editor,Settings,Help');
  check('main menu: Quick Match is first, focused and primary', buttons[0].classList.contains('primary') && document.activeElement === buttons[0]);
  check('main menu: screens that do not exist yet are disabled, not broken', MAIN_MENU_ENTRIES.every((entry, index) => buttons[index].disabled === (!!entry.screen && !Ui.screens.has(entry.screen))) && buttons.every((button) => !button.disabled));
  let quick = 0;
  const listener = Bus.on('ui.quickMatch', () => { quick++; });
  const realQuickMatch = PlayFlow.quickMatch;
  PlayFlow.quickMatch = () => null;   // the real handler (18d) would start a match: the 'play' group tests that
  buttons[0].click();
  PlayFlow.quickMatch = realQuickMatch;
  Bus.off('ui.quickMatch', listener);
  check('main menu: Quick Match emits ui.quickMatch (one action to start)', quick === 1);
  const range = buttons.find((button) => button.firstChild.textContent === 'Range');
  const rangeEnabled = !range.disabled;
  range.click();
  check('main menu: Range is enabled and starts the Firing Range (PRG-008)', rangeEnabled && Game.match && Game.match.setup.mode === CAREER_RANGE_MODE, String(Game.match && Game.match.setup.mode));
  Game.stop();
  Ui.closeAll(); Ui.open('main');
  check('main menu: back does nothing here', !Ui.back() && Ui.current() === 'main');
  const realCareer = Ui.screens.get('career');
  Ui.screens.delete('career');
  Ui.closeAll(); Ui.open('main');
  check('main menu: an entry without its screen is disabled', Array.from(Ui.top().element.querySelectorAll('.ui-menu button'))[1].disabled);
  Ui.register('career', { build(root2) { root2.appendChild(Ui.button('Later', () => {})); } });
  Ui.closeAll(); Ui.open('main');
  check('main menu: a screen registered later turns its entry on', !Array.from(Ui.top().element.querySelectorAll('.ui-menu button'))[1].disabled);
  uiClickButton(Ui.top().element, 'Career');
  check('main menu: the entry opens its screen', Ui.current() === 'career');
  Ui.register('career', realCareer);
  Ui.closeAll(); Ui.open('main');
  uiClickButton(Ui.top().element, 'Settings');
  check('main menu: Settings opens the settings screen', Ui.current() === 'settings');
  Ui.back();
  uiClickButton(Ui.top().element, 'Help');
  check('main menu: Help opens the help screen', Ui.current() === 'help');
  Ui.closeAll();
  Save.notice = 'Storage is blocked: settings and progress will not be kept.';
  Ui.noticeShown = false;
  Progress.profile().rangeOffered = true;   // the first-start Firing Range offer (18j) would sit on top of the menu
  Bus.emit('ready', null);
  const toasts = Ui.toastBox.children.length;
  check('main menu: ready opens it and shows the save notice once', Ui.current() === 'main' && Ui.lastToast === Save.notice);
  Ui.closeAll();
  Bus.emit('ready', null);
  check('main menu: the save notice is not repeated', Ui.toastBox.children.length === toasts);
  Save.notice = '';
  Ui.toastBox.replaceChildren();
  Game.headless = true;
  Ui.closeAll();
  Bus.emit('ready', null);
  check('main menu: headless runs open no DOM menu', Ui.stack.length === 0);
}));

Test.add('ui', (check) => uiWith(() => {
  Game.start({ mode: 'ffa' });
  const first = Game.match;
  Game.pause('menu');
  check('pause: pausing opens the pause menu (UI-002)', Game.paused && Ui.current() === 'pause');
  const labels = Array.from(Ui.top().element.querySelectorAll('.ui-menu button')).map((button) => button.textContent);
  const core = ['Resume', 'Restart', 'Settings', 'Quit to menu'];   // later sections may add rows (Ui.pauseEntries) between them
  check('pause: resume, restart, settings and quit are there', labels.filter((label) => core.includes(label)).join() === core.join(), labels.join());
  Ui.pauseEntries.push({ label: 'Rules', screen: 'testRules' });
  Ui.register('testRules', { build(root) { root.appendChild(Ui.button('R', () => {})); } });
  Game.resume(); Game.pause('menu');
  check('pause: later sections add rows through Ui.pauseEntries (rules panel hook)', Array.from(Ui.top().element.querySelectorAll('.ui-menu button')).some((button) => button.textContent === 'Rules'));
  Ui.pauseEntries.length = 0; Ui.screens.delete('testRules');
  uiClickButton(Ui.top().element, 'Resume');
  check('pause: Resume resumes and closes the menu', !Game.paused && Ui.stack.length === 0);
  Game.pause('blur');
  check('pause: the reason is explained', uiScreenText('pause').includes('lost focus'));
  uiKey('Escape');
  check('pause: Esc resumes (LT-C-039)', !Game.paused && Ui.stack.length === 0);
  Game.pause('menu');
  uiMenuCommand('back');
  check('pause: the gamepad back button resumes', !Game.paused);
  Game.pause('controller');
  check('pause: a lost controller is explained', uiScreenText('pause').includes('Controller disconnected'));
  Game.resume();
  PadInput.onButton(9, true); PadInput.onButton(9, false);
  check('pause: the pad Start button pauses a running match', Game.paused && Ui.current() === 'pause');
  PadInput.onButton(9, true); PadInput.onButton(9, false);
  check('pause: Start again resumes and does not pause again', !Game.paused && Input.holdCount[Input.actionIndex.pause] === 0);
  Game.pause('menu');
  PadInput.onButton(0, true); PadInput.onButton(0, false);
  check('pause: A presses Resume and does not also jump', !Game.paused && Input.pendingButtons === 0 && Input.holdCount[Input.actionIndex.jump] === 0);
  Game.pause('controller');
  uiClickButton(Ui.top().element, 'Settings');
  check('pause: Settings opens on top of the pause menu', Ui.current() === 'settings' && Game.paused);
  Ui.back();
  check('pause: back returns to the pause menu', Ui.current() === 'pause');
  uiClickButton(Ui.top().element, 'Restart');
  uiClickButton(Ui.top().element, 'Restart');
  check('pause: Restart starts the same setup again', Game.match !== first && Game.match.setup === first.setup && !Game.paused && Ui.stack.length === 0);
  Game.pause('menu');
  uiClickButton(Ui.top().element, 'Quit');
  check('pause: Quit asks before leaving', Ui.current() === 'confirm' && Game.state === 'playing');
  uiClickButton(Ui.top().element, 'Quit');
  check('pause: Quit returns to the main menu', Game.state === 'menu' && Ui.current() === 'main' && !Game.match);
  Game.start({});
  Game.pause('menu');
  Bus.emit('input.relock', null);
  check('pause: a refused re-lock leaves only the click prompt', Game.paused && Ui.stack.length === 0);
  Game.resume();
  Game.stop();
  Game.start({});
  Ui.closeAll();
  Game.headless = true;
  Game.pause('menu');
  check('pause: headless pauses open no menu', Game.paused && Ui.stack.length === 0);
  Game.headless = false;
  Game.resume();
  Game.stop();
  Ui.closeAll();
}));

Test.add('ui', async (check) => {
  const leave = uiEnter();
  const savedRunner = Ui.selfTestRunner, savedResult = Ui.lastSelfTest;
  try {
    Ui.selfTestRunner = null;
    Ui.open('help');
    check('help: the self-test button is off when no runner exists', Array.from(Ui.top().element.querySelectorAll('button')).find((button) => button.textContent === 'Run self-test').disabled);
    Ui.closeAll();
    Ui.selfTestRunner = async (options) => ({ total: 5, failed: 1, groups: 2, results: [{ ok: true }, { ok: false, group: 'demo', name: 'broken check', detail: 'was 1' }], headless: options.headless });
    Ui.open('help');
    const text = uiScreenText('help');
    check('help: shows how to play and the current controls', text.includes('Quick Match') && text.includes('Fire: Left Mouse / RT') && text.includes('Jump: Space / A'));
    uiClickButton(Ui.top().element, 'Run self-test');
    await uiWait(20);
    const output = Ui.top().element.querySelectorAll('.ui-result')[1];
    check('help: running the self-test shows the result and the failures', output.textContent.startsWith('FAILED 1 of 5 checks') && output.textContent.includes('demo / broken check :: was 1'), output.textContent);
    check('help: the self-test runs headless so the live game is untouched', Ui.lastSelfTest.headless === true);
    check('help: a passing run says so', selfTestSummary({ total: 9, failed: 0, groups: 3, results: [] }) === 'All 9 checks passed (3 groups)');
    const many = { total: 30, failed: 12, groups: 1, results: Array.from({ length: 12 }, () => ({ ok: false, group: 'g', name: 'n', detail: '' })) };
    check('help: a long failure list is cut', selfTestSummary(many).split('\n').length === SELF_TEST_FAILURES_SHOWN + 2 && selfTestSummary(many).endsWith('... and 4 more'));
    Ui.closeAll();
    Ui.selfTestRunner = async () => { throw new Error('runner crashed'); };
    Ui.open('help');
    const errorsBefore = ErrorLog.entries.length;
    const ran = uiClickButton(Ui.top().element, 'Run self-test');
    await uiWait(20);
    check('help: a crashing self-test is shown as a failure', ran && Ui.lastSelfTest.failed === 1 && ErrorLog.entries.length === errorsBefore + 1);
    ErrorLog.entries.length = errorsBefore;
  } finally {
    Ui.selfTestRunner = savedRunner; Ui.lastSelfTest = savedResult;
    leave();
  }
  check('help: the real runner is the Test section hook', typeof Ui.selfTestRunner === 'function');
});

Test.add('ui', (check) => uiWith(() => {
  Ui.open('settings');
  Ui.open('touchLayout');
  check('layout editor: opening it makes the touch controls editable', TouchInput.editing && TouchInput.layer.classList.contains('editing') && Ui.top().element.classList.contains('passthrough'));
  check('layout editor: the screen lets touches through to the controls', getComputedStyle(Ui.top().element).pointerEvents === 'none');
  TouchInput.select('jump');
  const sliders = Ui.top().element.querySelectorAll('.ui-slider input');
  check('layout editor: selecting a control loads its values', sliders[0].value === String(TouchInput.getProperty('jump', 'scale')) && Ui.top().element.querySelector('.ui-note').textContent === 'Editing: Jump');
  sliders[0].value = 1.5; sliders[0].dispatchEvent(new Event('input'));
  sliders[1].value = 0.4; sliders[1].dispatchEvent(new Event('input'));
  check('layout editor: size and opacity sliders edit the selected control', TouchInput.getProperty('jump', 'scale') === 1.5 && TouchInput.getProperty('jump', 'opacity') === 0.4 && Save.data.touchLayouts.standard.jump.scale === 1.5);
  Array.from(Ui.top().element.querySelectorAll('.ui-row')).find((row) => row.textContent.startsWith('Hidden')).querySelector('button').click();
  check('layout editor: the hide toggle hides the control', TouchInput.getProperty('jump', 'hidden') === true && TouchInput.elements.jump.classList.contains('ghost'));
  Array.from(Ui.top().element.querySelectorAll('.ui-row')).find((row) => row.textContent.startsWith('Preset')).querySelector('button').click();
  check('layout editor: the preset button switches the layout preset', Settings.get('controls.touch.layout') === 'compact');
  check('layout editor: switching the preset refreshes the shown values', sliders[0].value === String(TouchInput.getProperty('jump', 'scale')) && sliders[0].value !== '1.5');
  Array.from(Ui.top().element.querySelectorAll('.ui-row')).find((row) => row.textContent.startsWith('Panel position')).querySelector('button').click();
  check('layout editor: the panel can be docked away from the controls', Ui.top().element.dataset.dock === 'left');
  Settings.resetKeys(['controls.touch.layout']); Input.refreshConfig();
  uiClickButton(Ui.top().element, 'Reset layout');
  check('layout editor: reset restores the defaults', TouchInput.getProperty('jump', 'scale') === TOUCH_PRESETS[0].scale && !TouchInput.getProperty('jump', 'hidden'));
  uiClickButton(Ui.top().element, 'Done');
  check('layout editor: Done leaves the editor and returns to settings', !TouchInput.editing && !TouchInput.layer.classList.contains('editing') && Ui.current() === 'settings');
  check('layout editor: reachable from the controls tab', (() => { Ui.back(); Ui.open('settings', { tab: 'controls' }); return uiClickButton(Ui.top().element, 'Edit touch layout') && Ui.current() === 'touchLayout'; })());
}));

Test.add('ui', (check) => uiWith(() => {
  const botId = Actors.create(ACTOR_KIND.BOT, 1, 'counted'), playerId = Actors.create(ACTOR_KIND.PLAYER, 0, 'counted');
  Actors.alive[botId] = 1; Actors.alive[playerId] = 1;
  const counts = PerfOverlay.countActors();
  check('perf HUD: counts bots apart from all actors (PERF-012)', counts.actors === 2 && counts.bots === 1, counts.actors + '/' + counts.bots);
  Projectiles.spawn(CAT.projectiles.byId('grenade'), botId, CAT.weapons.byId('pitcher').index, 0, 0, 1.6, 5, 0, 0, 0, 0);
  Perf.publishCounters();
  check('perf HUD: the projectiles counter is the live projectile count (PERF-012)', Perf.counters.projectiles === 1 && Projectiles.active === 1, Perf.counters.projectiles);
  Projectiles.clear(); Perf.publishCounters();
  Actors.remove(botId); Actors.remove(playerId);
  check('perf HUD: the AI cost is the sum of the ai, bot and PvE brain systems', Test.near(PerfOverlay.aiMilliseconds({ aiThink: 1, botMove: 0.5, pveBrains: 0.25, pve: 4, render: 9 }), 1.75, 1e-9));
  const lines = PerfOverlay.format(Perf.stats());
  const text = lines.join('\n');
  check('perf HUD: shows fps, frame percentiles, sim, render, draw calls, scale, actors, heap, device (PERF-012)',
    ['fps', 'p50', 'p95', 'p99', 'sim p95', 'render', 'hud', 'draw calls', 'triangles', 'render scale', 'actors', 'bots', 'ai ', 'projectiles', 'particles', 'heap', 'device'].every((word) => text.includes(word)), text);
  Test.expectErrors(() => { ErrorLog.add('perf test', new Error('visible in the HUD')); check('perf HUD: the error tail is listed (ARC-041)', PerfOverlay.format(Perf.stats()).join('\n').includes('visible in the HUD')); });
  check('perf HUD: no errors reads "errors: none"', (() => { const saved = ErrorLog.entries.splice(0); const none = PerfOverlay.format(Perf.stats()).join('\n').includes('errors: none'); ErrorLog.entries.push(...saved); return none; })());
  Settings.set('developer.perfHud', false);
  PerfOverlay.shown = false; PerfOverlay.lastUpdate = 0;
  PerfOverlay.frame();
  check('perf HUD: hidden means no work and no DOM', !PerfOverlay.element.classList.contains('show') && PerfOverlay.lastUpdate === 0 && getComputedStyle(PerfOverlay.element).display === 'none');
  inputTapKey('F10');
  check('perf HUD: F10 turns it on and saves the setting', Ui.perfVisible && Settings.get('developer.perfHud') === true && Save.data.settings['developer.perfHud'] === true);
  PerfOverlay.frame();
  check('perf HUD: shows and fills the panel', PerfOverlay.element.classList.contains('show') && PerfOverlay.element.textContent.includes('fps') && getComputedStyle(PerfOverlay.element).display === 'block');
  PerfOverlay.element.textContent = 'marker';
  PerfOverlay.frame();
  check('perf HUD: refreshes only 4 times a second', PerfOverlay.element.textContent === 'marker');
  PerfOverlay.lastUpdate = performance.now() - PERF_REFRESH_MS - 1;
  PerfOverlay.frame();
  check('perf HUD: refreshes after 250 ms', PerfOverlay.element.textContent !== 'marker');
  check('perf HUD: never blocks taps', getComputedStyle(PerfOverlay.element).pointerEvents === 'none');
  const slow = Perf.stats(); slow.fps = 30;
  PerfOverlay.render(slow);
  check('perf HUD: turns red under 60 fps', PerfOverlay.element.classList.contains('slow'));
  slow.fps = 120; PerfOverlay.render(slow);
  check('perf HUD: normal colour at 120 fps', !PerfOverlay.element.classList.contains('slow'));
  Ui.open('settings');
  inputTapKey('F10');
  check('perf HUD: F10 works while a menu is open and turns it off', !Ui.perfVisible);
  inputTapKey('F9');
  check('perf HUD: F9 sets Ui.botDebug for later sections', Ui.botDebug === true && Settings.get('developer.botDebug') === true);
  inputTapKey('F9');
  check('perf HUD: F9 again clears it', Ui.botDebug === false);
  PerfOverlay.frame();
  check('perf HUD: hides again', !PerfOverlay.element.classList.contains('show'));
  Ui.toastBox.replaceChildren();
}));

Test.add('ui', (check) => uiWith(() => {
  const styles = document.getElementById('ui-style').textContent;
  check('layout: screens keep clear of notches with the safe-area insets (UI-015)', styles.includes('var(--safe-top)') && styles.includes('var(--safe-left)') && styles.includes('var(--safe-right)') && styles.includes('var(--safe-bottom)'));
  Ui.open('main');
  const screen = Ui.top().element;
  check('layout: a screen fills the view and pads for the notch', getComputedStyle(screen).position === 'fixed' && screen.getBoundingClientRect().width === window.innerWidth);
  check('layout: text is at least 14 px at scale 1 (ACC-008)', parseFloat(getComputedStyle(screen.querySelector('.ui-button')).fontSize) >= 14);
  check('layout: buttons are touch sized', screen.querySelector('.ui-button').getBoundingClientRect().height >= 44);
  check('layout: focus is always drawn (ACC-008)', styles.includes('.ui-button:focus'));
  check('layout: the overlay root passes taps to the game when empty', getComputedStyle(document.getElementById('overlay')).pointerEvents === 'none');
  check('layout: motion can be reduced', styles.includes('prefers-reduced-motion'));
}));
