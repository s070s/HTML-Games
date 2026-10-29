// ==== S18 UI: SCREENS ====
// Main menu (UI-001), pause menu (UI-002), settings generated from Settings.definitions (ARC-021), key rebinding (INP-002),
// touch layout editor (INP-005) and Help with the self-test button (ARC-030). Later sections register their own screens by name
// ('ladder', 'play', 'custom', 'range', 'results', ...): the main menu lists them as soon as they exist.

// UI-001 / PRG-005 / P4-03. Solo (the PvE modes, 18o) is a Career entry and the generated map a Custom > Map tab entry, so the list stays short.
const MAIN_MENU_ENTRIES = [
  { label: 'Quick Match', primary: true, event: 'ui.quickMatch' },
  { label: 'Play', screen: 'play' },         // mode cards, All modes, Shuffle, Match setup (18r)
  { label: 'Career', screen: 'career' },     // ladder, challenges, operations, daily, cards, profile, solo (18j)
  { label: 'Custom', screen: 'custom' },
  { label: 'Range', event: 'ui.range' },     // starts the Firing Range (18j careerOpenRange)
  { label: 'Map editor', screen: 'mapEditor' },
  { label: 'Settings', screen: 'settings' },
  { label: 'Help', screen: 'help' },
];
const PAUSE_REASONS = {
  menu: '', pointerlock: '', blur: 'Paused: the window lost focus.', hidden: 'Paused: the tab was hidden.',
  controller: 'Controller disconnected. Reconnect it, or keep playing with keyboard or touch.',
  graphics: 'Paused: the graphics were reset. The game goes on by itself once they are restored.',
};
const SETTINGS_TABS = [
  ['video', 'Video'], ['controls', 'Controls'], ['audio', 'Audio'], ['gameplay', 'Gameplay'],
  ['hud', 'HUD'], ['accessibility', 'Accessibility'], ['developer', 'Developer'],
];
const SELF_TEST_FAILURES_SHOWN = 8;
const TOUCH_EDITOR_HINT = 'Layout editor: drag a control to move it, tap it to edit it.';
// The editor panel stays small so the controls around it can still be reached; the player docks it left, centre or right.
const MENUS_CSS = '.ui-editor { width: min(360px, 48vw); max-height: 100%; overflow: hidden auto; padding: 8px; } .ui-editor .ui-row { min-height: 36px; padding: 2px 8px; margin-bottom: 3px; }'
  + '.ui-editor .ui-button { min-height: 36px; } .ui-editor .ui-note { margin-bottom: 6px; } .ui-editor .ui-slider { width: 58%; } .ui-editor .ui-cycle { min-width: 7em; } .ui-editor .ui-label { min-width: 0; } .ui-editor .ui-value { min-width: 3em; }'
  + '.ui-touchLayout[data-dock="left"] .ui-panel { margin: auto auto auto 0; } .ui-touchLayout[data-dock="right"] .ui-panel { margin: auto 0 auto auto; }'
  + '@media (max-height: 520px) { .ui-main .ui-menu, .ui-solo .ui-menu { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; } .ui-main .ui-menu .ui-button { font-size: 1em; } }';

// The title row (Back + title) and, under it, the breadcrumb of the screens open (P4-03). crumb: the screen's name in the breadcrumb
// when it differs from its title.
function screenHeader(root, title, onBack, crumb) {
  const head = makeElement('div', 'ui-head');
  head.appendChild(Ui.button('Back', onBack || (() => Ui.back())));
  head.appendChild(makeElement('h1', 'ui-title', title));
  root.appendChild(head);
  const entry = Ui.stack.find((item) => item.element === root);
  if (entry) {
    entry.crumb = crumb || title;
    root.appendChild(Ui.crumbBar(entry));
  }
  return head;
}

// LB / RB (the pad's 'prev' / 'next' menu commands) switch tabs on a screen with tabs. tabButtons: id -> button, the active one has
// the 'active' class; select(id) makes a tab active. The focus follows to the new tab's button, so repeated presses keep going.
function screenTabs(root, tabButtons, select) {
  const ids = Array.from(tabButtons.keys());
  root.tabStep = (direction) => {
    const current = ids.findIndex((id) => tabButtons.get(id).classList.contains('active'));
    const next = ids[(current + direction + ids.length) % ids.length];
    select(next);
    tabButtons.get(next).focus();
    Ui.emitClick('move');
  };
}

// ---- Main menu ----
Ui.register('main', {
  noBack: true,
  build(root) {
    root.appendChild(makeElement('h1', 'ui-title', 'ClassTimeKiller'));
    root.appendChild(makeElement('p', 'ui-sub', 'Arena shooter against bots - offline'));
    const menu = makeElement('div', 'ui-menu');
    for (const entry of MAIN_MENU_ENTRIES) {
      const missing = !!entry.screen && !Ui.screens.has(entry.screen);
      const button = Ui.button(entry.label, () => (entry.event ? Bus.emit(entry.event, null) : Ui.open(entry.screen)), entry.primary ? 'primary' : '');
      if (missing) { button.disabled = true; button.appendChild(makeElement('span', 'ui-tag', 'coming soon')); }
      if (entry.primary) button.dataset.autofocus = '1';
      menu.appendChild(button);
    }
    root.appendChild(menu);
  },
});

// ---- Pause menu: Esc / Start / touch pause; Esc again resumes ----
Ui.register('pause', {
  noBack: true,
  onBack() { Input.requestResume(); return true; },
  build(root, params) {
    root.appendChild(makeElement('h1', 'ui-title', 'Paused'));
    root.appendChild(makeElement('p', 'ui-sub', PAUSE_REASONS[params && params.reason] || ' '));
    const menu = makeElement('div', 'ui-menu');
    const resume = Ui.button('Resume', () => Input.requestResume(), 'primary');
    resume.dataset.autofocus = '1';
    menu.appendChild(resume);
    if (Game.match) menu.appendChild(Ui.button('Restart', () => Ui.confirm({ title: 'Restart match?', text: 'The current match is lost.', yes: 'Restart', onYes: restartMatch })));
    for (const entry of Ui.pauseEntries) if (Ui.screens.has(entry.screen) && (!entry.when || entry.when())) menu.appendChild(Ui.button(entry.label, () => Ui.open(entry.screen)));
    menu.appendChild(Ui.button('Settings', () => Ui.open('settings')));
    menu.appendChild(Ui.button('Quit to menu', () => Ui.confirm({ title: 'Quit to menu?', text: 'The current match is lost.', yes: 'Quit', onYes: () => Game.stop() }), 'danger'));
    root.appendChild(menu);
  },
});

// A career match (ladder, challenge, operation, daily) is rebuilt by its structure (S15), like Play again on the results screen.
function restartMatch() {
  if (!Game.match) return null;
  return Game.start(Progress.retrySetup(Game.match.setup) || Game.match.setup);
}

// ---- Settings: one tab per category, rows generated from Settings.definitions ----
function formatSettingValue(value, definition) {
  const step = definition.step || 1, decimals = (String(step).split('.')[1] || '').length;
  return value.toFixed(decimals) + (definition.max === 100 && definition.min === 0 ? '%' : '');
}
// Internal values (a string without options, such as the benchmark result) have no control and stay out of the tabs.
function isEditableSetting(definition) {
  return !!definition.options || typeof definition.fallback === 'boolean' || (typeof definition.fallback === 'number' && definition.min !== undefined);
}
// The control for one value of a settings row: a cycle for options, a toggle for booleans, else a slider. apply(next) gets every change.
function valueControl(definition, value, apply) {
  if (definition.options) return Ui.cycle(definition.options, definition.optionLabels || definition.options.map(String), value, apply);
  if (typeof definition.fallback === 'boolean') return Ui.toggle(value, apply);
  const step = definition.step || (definition.max - definition.min) / 100;
  return Ui.slider({ min: definition.min, max: definition.max, step, value, format: (shown) => formatSettingValue(shown, definition) }, apply);
}
function settingControl(key, definition) { return valueControl(definition, Settings.get(key), (next) => Settings.set(key, next)); }
function settingKeys(category) {
  const keys = [];
  for (const [key, definition] of Settings.definitions) if (definition.category === category && isEditableSetting(definition)) keys.push(key);
  return keys;
}
// The tab's keys by group title in first-seen order ('' = no heading); Ui.settingGroup (18l) names the group of a key.
function groupedSettingKeys(category) {
  const groups = new Map();
  for (const key of settingKeys(category)) {
    const title = Ui.settingGroup(key);
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(key);
  }
  return groups;
}
function renderSettingsTab(list, category) {
  list.replaceChildren();
  for (const addExtra of Ui.settingsExtras[category] || []) addExtra(list);
  for (const [title, keys] of groupedSettingKeys(category)) {
    if (title) list.appendChild(makeElement('div', 'ui-group', title));
    for (const key of keys) {
      const definition = Settings.definitions.get(key);
      list.appendChild(Ui.row(definition.label || key, settingControl(key, definition)));
    }
  }
  for (const addExtra of Ui.settingsExtras[category + ':after'] || []) addExtra(list);   // extras that belong below the generated rows
}
Ui.register('settings', {
  build(root, params) {
    screenHeader(root, 'Settings');
    const categories = SETTINGS_TABS.filter(([id]) => settingKeys(id).length > 0 || Ui.settingsExtras[id]);
    const tabs = makeElement('div', 'ui-tabs'), list = makeElement('div', 'ui-scroll');
    const requested = params && params.tab;
    let active = categories.some(([id]) => id === requested) ? requested : categories[0][0];   // an unknown tab opens the first one
    const tabButtons = new Map();
    const render = () => {
      for (const [id, button] of tabButtons) button.classList.toggle('active', id === active);
      renderSettingsTab(list, active);
    };
    for (const [id, label] of categories) {
      const button = Ui.button(label, () => { active = id; render(); }, 'ui-tab');
      tabButtons.set(id, button);
      tabs.appendChild(button);
    }
    screenTabs(root, tabButtons, (id) => { active = id; render(); });
    const reset = Ui.button('Reset this tab', () => Ui.confirm({
      title: 'Reset this tab?', text: 'All settings on this tab return to their defaults.', yes: 'Reset',
      onYes: () => { Settings.resetKeys(settingKeys(active)); render(); },
    }));
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(reset);
    for (const addButton of Ui.settingsFooter) foot.appendChild(addButton(() => render()));
    root.appendChild(tabs); root.appendChild(list); root.appendChild(foot);
    render();
    tabButtons.get(active).dataset.autofocus = '1';
  },
});

// ---- Controls tab extras: cm/360, controller status, links to the rebinding and layout screens ----
function refreshCentimetres() {
  for (const note of document.querySelectorAll('.ui-cm360')) {
    const centimetres = Input.cmPer360(Settings.get('controls.mouseSensitivity'), Settings.get('controls.mouseDpi'));
    note.textContent = 'A full 360 turn takes ' + centimetres.toFixed(1) + ' cm of mouse movement at ' + Settings.get('controls.mouseDpi') + ' DPI.';
  }
}
Ui.settingsExtras.controls = [
  (container) => {
    container.appendChild(makeElement('p', 'ui-note ui-cm360'));
    container.appendChild(makeElement('p', 'ui-note', PadInput.connected ? 'Controller connected (' + Input.padStyle + ' buttons).' : 'No controller detected: press a button on it.'));
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(Ui.button('Key and button bindings', () => Ui.open('bindings')));
    foot.appendChild(Ui.button('Edit touch layout', () => Ui.open('touchLayout')));
    container.appendChild(foot);
    refreshCentimetres();
  },
];
Bus.on('setting', refreshCentimetres);

// ---- Key and button rebinding ----
function bindingRowLabel(row, conflicts) {
  return row.label + (conflicts.length ? ' - shares a key with ' + conflicts.map((id) => ACTION_ROWS[Input.actionIndex[id]].label).join(', ') : '');
}
function renderBindings(list, focusKey) {
  list.replaceChildren();
  let group = '';
  for (const row of ACTION_ROWS) {
    if (row.group !== group) { group = row.group; list.appendChild(makeElement('div', 'ui-group', group)); }
    list.appendChild(bindingRow(row, list));
  }
  const focused = list.querySelector('[data-key="' + focusKey + '"]');
  if (focused) focused.focus();
}
function bindingRow(row, list) {
  const conflicts = Input.conflictsOf(row.id);
  const element = makeElement('div', 'ui-row' + (conflicts.length ? ' conflict' : ''));
  element.appendChild(makeElement('span', 'ui-label', bindingRowLabel(row, conflicts)));
  for (let slot = 0; slot < BINDING_SLOTS.length; slot++) {
    const key = row.id + ':' + slot;
    const button = Ui.button(Input.bindingLabel(Input.getBinding(row.id, slot)), () => {
      button.textContent = slot === 2 ? 'Press a button...' : 'Press a key, click or scroll...';
      Input.captureNext(BINDING_SLOTS[slot], (binding) => {
        if (binding !== null) Input.setBinding(row.id, slot, binding);
        renderBindings(list, key);
      });
    }, 'ui-slot');
    button.dataset.key = key;
    element.appendChild(button);
  }
  element.appendChild(Ui.button('Reset', () => { Input.resetBindings(row.id); renderBindings(list, row.id + ':0'); }, 'ui-slot'));
  return element;
}
Ui.register('bindings', {
  build(root) {
    screenHeader(root, 'Key and button bindings');
    root.appendChild(makeElement('p', 'ui-note', 'Click a slot, then press a key, mouse button, scroll the wheel or press a controller button. Esc cancels, Backspace clears. On a controller, View + a button binds a chord, holding Start cancels and View + Start clears. A red row shares a binding with another action.'));
    const list = makeElement('div', 'ui-scroll');
    root.appendChild(list);
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(Ui.button('Reset all bindings', () => Ui.confirm({
      title: 'Reset all bindings?', text: 'Every action returns to its default key and button.', yes: 'Reset', onYes: () => { Input.resetBindings(); renderBindings(list, ''); },
    })));
    root.appendChild(foot);
    renderBindings(list, '');
  },
  onClose() { Input.cancelCapture(); },
});

// ---- Touch layout editor: the real controls become draggable, this panel edits the selected one ----
Ui.register('touchLayout', {
  passthrough: true,
  build(root) {
    const panel = makeElement('div', 'ui-panel ui-editor');
    const info = makeElement('p', 'ui-note', TOUCH_EDITOR_HINT);
    const edits = [];
    const bind = (label, control, read) => { panel.appendChild(Ui.row(label, control)); edits.push(() => control.setValue(read())); };
    const selected = () => TouchInput.selected;
    const scale = Ui.slider({ min: TOUCH_SCALE_MIN, max: TOUCH_SCALE_MAX, step: 0.05, value: 1, format: (value) => Math.round(value * 100) + '%' }, (value) => selected() && TouchInput.setProperty(selected(), 'scale', value));
    const opacity = Ui.slider({ min: TOUCH_OPACITY_MIN, max: TOUCH_OPACITY_MAX, step: 0.05, value: 1, format: (value) => Math.round(value * 100) + '%' }, (value) => selected() && TouchInput.setProperty(selected(), 'opacity', value));
    const hidden = Ui.toggle(false, (value) => selected() && TouchInput.setProperty(selected(), 'hidden', value));
    const preset = Ui.cycle(TOUCH_PRESETS.map((item) => item.id), TOUCH_PRESETS.map((item) => item.label), Settings.get('controls.touch.layout'), (value) => { Settings.set('controls.touch.layout', value); Input.refreshConfig(); TouchInput.select(TouchInput.selected); });
    panel.appendChild(info);
    panel.appendChild(Ui.row('Preset', preset));
    panel.appendChild(Ui.row('Panel position', Ui.cycle(['center', 'left', 'right'], ['Center', 'Left', 'Right'], 'center', (side) => { root.dataset.dock = side; })));
    bind('Size', scale, () => TouchInput.getProperty(selected(), 'scale'));
    bind('Opacity', opacity, () => TouchInput.getProperty(selected(), 'opacity'));
    bind('Hidden', hidden, () => TouchInput.getProperty(selected(), 'hidden'));
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(Ui.button('Reset layout', () => TouchInput.resetLayout()));
    const done = Ui.button('Done', () => Ui.back(), 'primary');
    done.dataset.autofocus = '1';
    foot.appendChild(done);
    panel.appendChild(foot);
    root.appendChild(panel);
    TouchInput.onSelect = (controlId) => {
      info.textContent = controlId ? 'Editing: ' + TouchInput.controlById[controlId].label : TOUCH_EDITOR_HINT;
      if (controlId) for (const refresh of edits) refresh();
    };
  },
  onOpen() { TouchInput.setEditing(true); },
  onClose() { TouchInput.setEditing(false); TouchInput.onSelect = null; },
});

// ---- Help pieces: the self-test run and the controls list (the Help screen itself is in 18n) ----
function selfTestSummary(result) {
  if (!result) return '';
  const skipped = result.skipped ? ', ' + result.skipped + ' skipped' : '';
  const lines = [result.failed ? 'FAILED ' + result.failed + ' of ' + result.total + ' checks' + skipped : 'All ' + result.passed + ' checks passed' + skipped + ' (' + result.groups + ' groups)'];
  const failures = result.results.filter((item) => !item.ok);
  for (const item of failures.slice(0, SELF_TEST_FAILURES_SHOWN)) lines.push(item.group + ' / ' + item.name + (item.detail ? ' :: ' + item.detail : ''));
  if (failures.length > SELF_TEST_FAILURES_SHOWN) lines.push('... and ' + (failures.length - SELF_TEST_FAILURES_SHOWN) + ' more');
  return lines.join('\n');
}
async function runSelfTest(output, button) {
  button.disabled = true;
  output.textContent = 'Running...';
  try {
    Ui.lastSelfTest = await Ui.selfTestRunner({ headless: true });
  } catch (error) {
    ErrorLog.add('self-test', error);
    Ui.lastSelfTest = { total: 0, failed: 1, groups: 0, results: [{ ok: false, group: 'runner', name: 'self-test crashed', detail: String(error) }] };
  }
  if (!output.isConnected) { Ui.closeAll(); Ui.open('main'); Ui.open('help'); return; }   // the tests reset the UI
  button.disabled = false;
  output.textContent = selfTestSummary(Ui.lastSelfTest);
}
function touchControlsSummary() {
  const lines = [];
  for (const control of TOUCH_CONTROLS) if (control.face) lines.push(control.face + ': ' + control.label);
  lines.push('Hold the score panel at the top: Scoreboard');
  lines.push('Tap a weapon box above the ammo panel to take that slot.');
  lines.push('Buttons you cannot use stay hidden. Settings > Controls > Edit touch layout moves them.');
  return lines.join('\n');
}
function controlsSummary() {
  if (Input.device === 'touch') return touchControlsSummary();
  const lines = [];
  for (const row of ACTION_ROWS) {
    const labels = Input.bound[Input.actionIndex[row.id]].filter(Boolean).map((binding) => Input.bindingLabel(binding));
    if (labels.length && !row.slot) lines.push(row.label + ': ' + labels.join(' / '));
  }
  return lines.join('\n');
}
// ---- Menu flow: which screen shows for each game state ----
Bus.on('ready', () => {
  if (Game.headless) return;
  Ui.open('main');
  if (Save.notice && !Ui.noticeShown) { Ui.noticeShown = true; Ui.toast(Save.notice); }
});
Bus.on('game.pause', (reason) => {
  if (Game.headless) return;
  Ui.closeAll();
  Ui.open('pause', { reason });
});
Bus.on('game.resume', () => Ui.closeAll());
Bus.on('input.relock', () => Ui.closeAll());   // the browser refused the re-lock: only the "Click to resume" prompt stays
Bus.on('match.start', () => Ui.closeAll());
Bus.on('match.stop', () => {
  Ui.closeAll();
  if (!Game.headless) Ui.open('main');
});
Bus.on('match.end', () => {
  if (!Game.headless && Ui.screens.has('results')) Ui.open('results', Game.match);
});

Bus.on('boot', () => injectStyle('ui-menus-style', MENUS_CSS));
