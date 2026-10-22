// ==== S18 UI ====
// DOM menu framework: screen stack, focus navigation for keyboard, gamepad and touch (INP-010), toasts, confirm dialog, control builders.
// Screens register by name: Ui.register(name, { build(root, params), onOpen, onClose, onBack, noBack, passthrough }).
// 18b holds the screens, 18c the performance overlay. Contracts: docs/api/input-ui.md.

const UI_TOAST_MS = 2600;
const UI_MAX_TOASTS = 4;
const UI_FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';
const UI_DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const UI_KEY_COMMANDS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const UI_SIDE_WEIGHT = 2;               // sideways offset counts double when picking the next focus target
const UI_SETTINGS = [
  { key: 'ui.scale', fallback: 1, label: 'UI scale', category: 'accessibility', min: 0.75, max: 1.5, step: 0.05 },
  { key: 'developer.perfHud', fallback: false, label: 'Performance overlay (F10)', category: 'developer' },
  { key: 'developer.botDebug', fallback: false, label: 'Bot debug view (F9)', category: 'developer' },
];

const UI_CSS = '.ui-screen { color-scheme: dark; position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; color: var(--ui-text);'
  + ' padding: calc(16px + var(--safe-top)) calc(20px + var(--safe-right)) calc(16px + var(--safe-bottom)) calc(20px + var(--safe-left));'
  + ' background: radial-gradient(ellipse at 20% 0%, #1b2736 0%, #0b0f14 70%); overflow: hidden; }'
  + '.ui-screen.behind { display: none; } #overlay > .ui-screen.passthrough { background: none; pointer-events: none; } .passthrough > * { pointer-events: auto; }'
  + '.ui-title { font-size: 2em; font-weight: 800; letter-spacing: 0.04em; margin: 0; } .ui-sub { color: var(--ui-dim); margin: 2px 0 14px; }'
  + '.ui-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; } .ui-head .ui-title { font-size: 1.5em; flex: 1; }'
  + '.ui-button { font: inherit; color: var(--ui-text); background: var(--ui-panel); border: 1px solid var(--ui-line); border-radius: 8px; padding: 0.6em 1.1em;'
  + ' min-height: 44px; text-align: left; cursor: pointer; touch-action: manipulation; }'
  + '.ui-button:hover { border-color: var(--ui-accent); } .ui-button.primary { background: var(--ui-accent); color: #1a1205; font-weight: 700; border-color: var(--ui-accent); }'
  + '.ui-button[disabled] { opacity: 0.45; cursor: default; } .ui-button.danger { border-color: var(--ui-bad); }'
  + '.ui-button:focus, .ui-slider input:focus, .ui-tab:focus { outline: 3px solid var(--ui-accent); outline-offset: 2px; }'
  + '.ui-menu { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; max-width: 760px; }'
  + '.ui-menu .ui-button { font-size: 1.1em; } .ui-tag { color: var(--ui-dim); font-size: 0.875em; margin-left: 8px; }'
  + '.ui-scroll { flex: 1; overflow-y: auto; touch-action: pan-y; padding-right: 4px; min-height: 0; }'
  + '.ui-row { display: flex; align-items: center; gap: 12px; padding: 6px 12px; background: var(--ui-panel); border: 1px solid transparent; border-radius: 8px; margin-bottom: 6px; min-height: 48px; }'
  + '.ui-row.conflict { border-color: var(--ui-bad); } .ui-label { flex: 1; } .ui-group { color: var(--ui-accent); font-weight: 700; margin: 12px 0 6px; }'
  + '.ui-slider { display: flex; align-items: center; gap: 10px; width: min(52%, 340px); } .ui-slider input { flex: 1; accent-color: var(--ui-accent); min-height: 32px; }'
  + '.ui-value { min-width: 4.8em; text-align: right; color: var(--ui-dim); font-variant-numeric: tabular-nums; }'
  + '.ui-cycle { min-width: 9em; text-align: center; } .ui-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }'
  + '.ui-tab.active { background: var(--ui-accent); color: #1a1205; font-weight: 700; } .ui-note { color: var(--ui-dim); margin: 0 0 10px; line-height: 1.45; }'
  + '.ui-foot { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; } .ui-slot { min-width: 8em; text-align: center; padding: 0.4em 0.7em; min-height: 40px; }'
  + '.ui-panel { background: var(--ui-bg); border: 1px solid var(--ui-line); border-radius: 12px; padding: 14px; margin: auto; width: min(560px, 100%); }'
  + '.ui-dialog { justify-content: center; align-items: center; background: rgba(5, 8, 12, 0.7); } .ui-result { white-space: pre-wrap; font: 14px/1.45 ui-monospace, Consolas, monospace; color: var(--ui-dim); }'
  + '#overlay > .ui-toasts { position: fixed; top: calc(10px + var(--safe-top)); left: 50%; transform: translateX(-50%); z-index: 50; display: flex; flex-direction: column; gap: 6px; align-items: center; pointer-events: none; }'
  + '.ui-toast { background: var(--ui-bg); border: 1px solid var(--ui-line); padding: 8px 14px; border-radius: 8px; animation: ui-toast-in 0.18s ease-out; }'
  + '@keyframes ui-toast-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }'
  + '@media (max-height: 520px) { .ui-screen { padding-top: calc(8px + var(--safe-top)); padding-bottom: calc(8px + var(--safe-bottom)); } .ui-title { font-size: 1.5em; } .ui-sub { margin-bottom: 8px; } .ui-row { min-height: 40px; margin-bottom: 4px; } }'
  + '@media (prefers-reduced-motion: reduce) { .ui-toast { animation: none; } }';

const Ui = {
  screens: new Map(),
  stack: [],                  // open screens, last = on top: { name, screen, element, params, returnFocus }
  root: null,
  toastBox: null,
  botDebug: false,            // F9 / Options > Developer: later sections draw their bot overlay while true
  perfVisible: false,
  selfTestRunner: null,       // set by S20: async (options) => { total, failed, results[] }
  lastSelfTest: null,
  pauseEntries: [],           // { label, screen } rows later sections add to the pause menu (rules panel)
  settingsExtras: {},         // category -> [fn(container)] extra nodes at the top of a settings tab
  settingsFooter: [],         // fn(refresh) -> button: extra buttons under the settings tabs (18l: reset all)
  settingGroup: () => '',     // fn(key) -> heading title of a settings row ('' = none); 18l fills it
  lastToast: '',
  noticeShown: false,
  clickEvent: { kind: '' },
  nameCount: 0,               // numbers the ids that tie a row's label to its control

  register(name, screen) { this.screens.set(name, screen); },
  top() { return this.stack.length ? this.stack[this.stack.length - 1] : null; },
  current() { return this.stack.length ? this.top().name : ''; },
  isOpen(name) { return this.stack.some((entry) => entry.name === name); },
  open(name, params) {
    const screen = this.screens.get(name);
    if (!screen) { this.toast('Coming soon'); return false; }
    const previous = this.top();
    if (previous) { previous.returnFocus = document.activeElement; if (!screen.overlay) previous.element.classList.add('behind'); }
    const element = makeElement('div', 'ui-screen ui-' + name + (screen.passthrough ? ' passthrough' : ''));
    const entry = { name, screen, element, params, returnFocus: null };
    this.root.appendChild(element);
    this.stack.push(entry);
    Input.uiOpen = true;
    try {
      screen.build(element, params);
      if (screen.onOpen) screen.onOpen(element, params);
    } catch (error) {
      ErrorLog.add('ui ' + name, error);
      this.pop();
      this.toast('That screen could not open');
      return false;
    }
    this.focusFirst(entry);
    return true;
  },
  // Back / Esc / B: the screen may handle it (pause menu resumes), top-level screens ignore it, others close.
  back() {
    const entry = this.top();
    if (!entry) return false;
    if (entry.screen.onBack && entry.screen.onBack(entry.element)) return true;
    if (entry.screen.noBack) return false;
    this.emitClick('back');
    this.pop();
    return true;
  },
  pop() {
    const entry = this.stack.pop();
    if (!entry) return;
    if (entry.screen.onClose) entry.screen.onClose(entry.element);
    entry.element.remove();
    Input.uiOpen = this.stack.length > 0;
    const below = this.top();
    if (!below) return;
    below.element.classList.remove('behind');
    const target = below.returnFocus && below.element.contains(below.returnFocus) ? below.returnFocus : null;
    if (target) target.focus(); else this.focusFirst(below);
  },
  replace(name, params) { this.pop(); return this.open(name, params); },
  closeAll() { while (this.stack.length) this.pop(); },

  // ---- Focus navigation (keyboard arrows, gamepad d-pad / stick, touch taps) ----
  focusables(element) { return Array.from(element.querySelectorAll(UI_FOCUSABLE)).filter((item) => item.offsetParent !== null); },
  focusFirst(entry) {
    const target = entry.element.querySelector('[data-autofocus]') || this.focusables(entry.element)[0];
    if (target) target.focus();
  },
  // Runs build() that refills a container and puts the focus back on the control at the same position, so a screen that redraws itself
  // after a change (a mode choice that adds rows) never drops the keyboard or gamepad user's place.
  rebuild(container, build) {
    const index = this.focusables(container).indexOf(document.activeElement);
    build();
    const target = index >= 0 ? this.focusables(container)[index] : null;
    if (target) target.focus();
  },
  navigate(command) {
    const entry = this.top();
    if (!entry) return;
    const items = this.focusables(entry.element), index = items.indexOf(document.activeElement);
    if (!items.length) return;
    if (index < 0) { items[0].focus(); return; }
    const current = items[index];
    if ((command === 'left' || command === 'right') && current._adjust) { current._adjust(command === 'right' ? 1 : -1); return; }
    const sequential = command === 'next' || command === 'prev';
    const target = sequential ? items[(index + (command === 'next' ? 1 : items.length - 1)) % items.length] : this.nearest(items, current, UI_DIRECTIONS[command]);
    if (!target || target === current) return;
    target.focus();
    target.scrollIntoView({ block: 'nearest' });
    this.emitClick('move');
  },
  // The focusable closest in a direction; sideways offset counts double so columns stay columns.
  nearest(items, from, direction) {
    const origin = from.getBoundingClientRect();
    const originX = origin.left + origin.width / 2, originY = origin.top + origin.height / 2;
    let best = null, bestScore = Infinity;
    for (const item of items) {
      if (item === from) continue;
      const box = item.getBoundingClientRect();
      const dx = box.left + box.width / 2 - originX, dy = box.top + box.height / 2 - originY;
      const along = dx * direction.x + dy * direction.y;
      if (along <= 1) continue;
      const score = along + Math.abs(dx * direction.y - dy * direction.x) * UI_SIDE_WEIGHT;
      if (score < bestScore) { best = item; bestScore = score; }
    }
    return best;
  },
  activate() {
    const entry = this.top();
    if (entry && entry.element.contains(document.activeElement)) document.activeElement.click();
  },
  onMenuCommand(command) {
    if (!this.stack.length) return;
    const screen = this.top().screen;
    if (screen.onCommand && screen.onCommand(command)) return;     // a screen that reads the pad itself (the map editor) takes the command
    if (command === 'accept') this.activate(); else if (command === 'back') this.back(); else this.navigate(command);
  },
  onKeyDown(event) {
    if (!this.stack.length || event.defaultPrevented) return;
    if (event.code === 'Escape') this.back();
    else if (event.code === 'Tab') this.navigate(event.shiftKey ? 'prev' : 'next');
    else if (UI_KEY_COMMANDS[event.code]) this.navigate(UI_KEY_COMMANDS[event.code]);
    else return;
    event.preventDefault();
  },

  // ---- Toasts and sound hook ----
  toast(text) {
    this.lastToast = text;
    if (!this.toastBox) return;
    const item = makeElement('div', 'ui-toast', text);
    this.toastBox.appendChild(item);
    while (this.toastBox.children.length > UI_MAX_TOASTS) this.toastBox.firstChild.remove();
    setTimeout(() => item.remove(), UI_TOAST_MS);
  },
  emitClick(kind) { this.clickEvent.kind = kind; Bus.emit('ui.click', this.clickEvent); },

  // ---- Control builders: every returned element has setValue(value); cycle / slider also answer _adjust(direction) for pad and arrows ----
  button(text, onClick, className) {
    const button = makeElement('button', 'ui-button' + (className ? ' ' + className : ''), text);
    button.type = 'button';
    button.addEventListener('click', (event) => { this.emitClick('accept'); onClick(event); });
    return button;
  },
  row(label, control) {
    const row = makeElement('div', 'ui-row');
    const text = makeElement('span', 'ui-label', label), named = control.input || control;   // sliders keep their input in .input
    text.id = 'ui-label-' + (++this.nameCount);
    named.id = named.id || 'ui-control-' + this.nameCount;
    // Screen readers read the row label and the control's own value ("Mono audio On"); a slider is named by the label alone.
    named.setAttribute('aria-labelledby', named.tagName === 'INPUT' ? text.id : text.id + ' ' + named.id);
    row.appendChild(text);
    row.appendChild(control);
    return row;
  },
  // options: array of values, labels: display strings; onChange(value) fires on every change.
  cycle(options, labels, value, onChange) {
    const button = makeElement('button', 'ui-button ui-cycle');
    button.type = 'button';
    let index = Math.max(0, options.indexOf(value));
    const show = () => { button.textContent = labels[index]; };
    const step = (direction) => { index = (index + direction + options.length) % options.length; show(); onChange(options[index]); };
    button.addEventListener('click', () => { this.emitClick('toggle'); step(1); });
    button._adjust = step;
    button.setValue = (next) => { index = Math.max(0, options.indexOf(next)); show(); };
    show();
    return button;
  },
  toggle(value, onChange) { return this.cycle([false, true], ['Off', 'On'], value, onChange); },
  slider(config, onChange) {
    const wrap = makeElement('div', 'ui-slider'), input = makeElement('input'), label = makeElement('span', 'ui-value');
    input.type = 'range'; input.min = config.min; input.max = config.max; input.step = config.step; input.value = config.value;
    const show = () => { label.textContent = config.format(+input.value); };
    input.addEventListener('input', () => { show(); onChange(+input.value); });
    input._adjust = (direction) => { if (direction > 0) input.stepUp(); else input.stepDown(); input.dispatchEvent(new Event('input')); };
    wrap.setValue = (next) => { input.value = next; show(); };
    wrap.input = input;
    wrap.appendChild(input); wrap.appendChild(label);
    show();
    return wrap;
  },
  // Yes / No dialog on top of the current screen. options: { title, text, yes, no, onYes }.
  confirm(options) { return this.open('confirm', options); },

  // ---- Start-up ----
  init() {
    this.root = document.getElementById('overlay');
    injectStyle('ui-style', UI_CSS);
    this.toastBox = makeElement('div', 'ui-toasts');
    this.root.appendChild(this.toastBox);
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    this.applySettings();
  },
  applySettings() {
    document.documentElement.style.setProperty('--ui-scale', String(Settings.get('ui.scale')));
    this.perfVisible = Settings.get('developer.perfHud');
    this.botDebug = Settings.get('developer.botDebug');
  },
};

Ui.register('confirm', {
  overlay: true,          // the screen below stays visible behind the dialog
  build(root, options) {
    root.classList.add('ui-dialog');
    const panel = makeElement('div', 'ui-panel');
    panel.appendChild(makeElement('h2', 'ui-title', options.title));
    panel.appendChild(makeElement('p', 'ui-note', options.text));
    const foot = makeElement('div', 'ui-foot');
    const no = Ui.button(options.no || 'Cancel', () => Ui.back());
    no.dataset.autofocus = '1';
    foot.appendChild(no);
    foot.appendChild(Ui.button(options.yes || 'OK', () => { Ui.back(); options.onYes(); }, 'primary'));
    panel.appendChild(foot);
    root.appendChild(panel);
  },
});

for (const row of UI_SETTINGS) {
  Settings.define(row.key, row.fallback, { label: row.label, category: row.category, min: row.min, max: row.max, step: row.step });
}
Bus.on('boot', () => Ui.init());
Bus.on('setting', () => { if (Ui.root) Ui.applySettings(); });
Bus.on('toast', (payload) => Ui.toast(payload.text));
Bus.on('input.menu', (payload) => Ui.onMenuCommand(payload.command));
