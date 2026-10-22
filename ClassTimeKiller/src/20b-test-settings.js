// Self-tests for the settings screens and the wiring check (group 'settings', plan step 16.5): every Settings.define key is written
// (by a settings control or a named internal writer) and read (Settings.readCounts), values round-trip through the save, reset to
// the defaults, the debounced save writes once, and the assist sliders reach the match setup.

const SETTINGS_TEST_TABS = SETTINGS_TABS.map(([id]) => id);
// Keys with no control on purpose: the code that writes them is named here, the test proves they are read like any other.
const SETTINGS_INTERNAL_WRITERS = { 'video.autoQuality': 'the renderer benchmark (07e)', 'difficulty.tierShift': 'adaptive difficulty (14a)', 'custom.draft': 'the custom match editor draft (18g)' };
const SETTINGS_SAVE_WAIT_MS = SAVE_DEBOUNCE_MS + 200;

// A valid value different from the default, so a round trip proves something.
function settingTestValue(definition) {
  if (definition.options) return definition.options[(definition.options.indexOf(definition.fallback) + 1) % definition.options.length];
  if (typeof definition.fallback === 'boolean') return !definition.fallback;
  if (definition.min === undefined) return typeof definition.fallback === 'number' ? definition.fallback + 1 : 'changed';
  const span = definition.max - definition.min, step = definition.step || span / 100;
  const target = definition.fallback + span / 2 > definition.max ? definition.fallback - span / 2 : definition.fallback + span / 2;
  return clamp(Math.round(target / step) * step, definition.min, definition.max);
}
function settingTestSame(a, b) { return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b; }

// Reads every setting the way a session does: each owner re-reads on its 'setting' event, a match starts and steps, and the few settings
// read only where they apply (a held grenade, the speech voice, the saved custom draft, the adaptive tier) go through that path once.
function settingTestExerciseReads() {
  Settings.readCounts.clear();
  Settings.applyAll();
  Input.refreshConfig();                                  // the input frame does this before every look sample
  Settings.set('assist.enabled', true);
  Settings.set('difficulty.adaptive', true);
  Game.start(PlayFlow.buildSetup(PlayFlow.normalize({ bots: 2 }), () => 0.5));
  Sim.run(10);
  const id = Game.playerId;
  Gadgets.holdStart[id] = 0;
  Gadgets.holdRow[id] = CAT.gadgets.find((row) => row.cook).index;
  Gadgets.drawPreview({ mesh: () => 0 });
  Gadgets.holdStart[id] = Gadgets.holdRow[id] = -1;
  Difficulty.tierShift();
  Tips.show();
  CustomMatch.load();
  Sound.forceActive = true;
  Sound.speak('test');
  Sound.forceActive = false;
  Game.stop();
}

Test.add('settings', (check) => {
  const keys = Array.from(Settings.definitions.keys());
  check('settings: there are many settings, every one with a label and a known category', keys.length > 90 && keys.every((key) => Settings.definitions.get(key).label && SETTINGS_TEST_TABS.includes(Settings.definitions.get(key).category)), keys.length);
  check('settings: every default lies inside its own range and options', keys.every((key) => {
    const definition = Settings.definitions.get(key);
    if (definition.options) return definition.options.includes(definition.fallback);
    return definition.min === undefined || (definition.fallback >= definition.min && definition.fallback <= definition.max && definition.min < definition.max);
  }));
  const internal = keys.filter((key) => !isEditableSetting(Settings.definitions.get(key)));
  check('settings: the only keys without a control are the named internal ones', internal.length === Object.keys(SETTINGS_INTERNAL_WRITERS).length && internal.every((key) => SETTINGS_INTERNAL_WRITERS[key]), internal.join());

  // ---- Written: every editable key has a control in its tab ----
  const leave = uiEnter();
  try {
    let missing = [];
    for (const [id] of SETTINGS_TABS) {
      if (!settingKeys(id).length) continue;
      Ui.open('settings', { tab: id });
      const labels = new Set(Array.from(Ui.top().element.querySelectorAll('.ui-scroll .ui-row .ui-label')).map((label) => label.textContent));
      missing = missing.concat(settingKeys(id).filter((key) => !labels.has(Settings.definitions.get(key).label)));
      Ui.closeAll();
    }
    check('settings: every editable setting has a control on its tab (it can be written)', missing.length === 0, missing.join());
    check('settings: every editable setting has a group heading outside the developer tab', keys.every((key) => {
      const definition = Settings.definitions.get(key);
      return !isEditableSetting(definition) || definition.category === 'developer' || Ui.settingGroup(key) !== '';
    }));
  } finally { leave(); }

  // ---- Read: every key is read by its owner after a session of events ----
  settingTestExerciseReads();
  const lazy = keys.filter((key) => !Settings.readCounts.get(key));
  check('settings: every setting is read by its owner (no one-ended settings)', lazy.length === 0, lazy.join());

  // ---- Round trip: set, read back, event, save, reload, reset ----
  const events = [];
  const listener = (key) => events.push(key);
  Bus.on('setting', listener);
  let wrongSet = [], wrongSave = [], wrongReload = [];
  for (const key of keys) {
    const definition = Settings.definitions.get(key), value = settingTestValue(definition);
    events.length = 0;
    Settings.set(key, value);
    if (!settingTestSame(Settings.get(key), value) || !events.includes(key)) wrongSet.push(key);
    if (!settingTestSame(Save.data.settings[key], value)) wrongSave.push(key);
  }
  Save.saveNow();
  const exported = Save.exportText();
  Save.data = Save.emptySave();
  Save.importText(exported);
  for (const key of keys) if (!settingTestSame(Settings.get(key), settingTestValue(Settings.definitions.get(key)))) wrongReload.push(key);
  Bus.off('setting', listener);
  check('settings round trip: every key can be set, announces itself and reads back', wrongSet.length === 0, wrongSet.join());
  check('settings round trip: every key is stored in the save', wrongSave.length === 0, wrongSave.join());
  check('settings round trip: an exported and imported save restores every key', wrongReload.length === 0, wrongReload.join());
  Save.data = null;
  Save.load();
  check('settings round trip: a reload from storage restores the values', settingTestSame(Settings.get('hud.scale'), settingTestValue(Settings.definitions.get('hud.scale'))));
  Save.data = Save.emptySave();
});

Test.add('settings', (check) => {
  // ---- Reset to defaults (tab and everything) ----
  for (const key of Settings.definitions.keys()) Settings.set(key, settingTestValue(Settings.definitions.get(key)));
  resetSettingKeys(settingKeys('hud'));
  check('reset: a tab returns to its defaults and leaves the other tabs alone', settingKeys('hud').every((key) => settingTestSame(Settings.get(key), Settings.definitions.get(key).fallback))
    && !settingTestSame(Settings.get('video.fov'), Settings.definitions.get('video.fov').fallback));
  resetSettingKeys(editableSettingKeys());
  check('reset: all settings return to their defaults', editableSettingKeys().every((key) => settingTestSame(Settings.get(key), Settings.definitions.get(key).fallback)));
  check('reset: the saved values are gone, not just overwritten', editableSettingKeys().every((key) => Save.data.settings[key] === undefined));

  const leave = uiEnter();
  try {
    Settings.set('video.fov', 100);
    Ui.open('settings');
    check('reset all: the settings screen has the button', uiClickButton(Ui.top().element, 'Reset all settings') && Ui.current() === 'confirm');
    uiClickButton(Ui.top().element, 'Reset');
    check('reset all: confirming resets every setting', Settings.get('video.fov') === Settings.definitions.get('video.fov').fallback && Ui.current() === 'settings');
  } finally { leave(); }

  // ---- Settings screens: a control changes its setting and the screen is the same one the key lives on ----
  const leaveAgain = uiEnter();
  try {
    Ui.open('settings', { tab: 'accessibility' });
    const row = Array.from(Ui.top().element.querySelectorAll('.ui-row')).find((item) => item.querySelector('.ui-label').textContent === Settings.definitions.get('accessibility.highContrast').label);
    row.querySelector('button').click();
    check('screen: a toggle on the accessibility tab writes its setting', Settings.get('accessibility.highContrast') === true);
    const sliderRow = Array.from(Ui.top().element.querySelectorAll('.ui-row')).find((item) => item.querySelector('.ui-label').textContent === Settings.definitions.get('accessibility.particles').label);
    const input = sliderRow.querySelector('input');
    input.value = 50; input.dispatchEvent(new Event('input'));
    check('screen: a slider writes its setting', Settings.get('accessibility.particles') === 50);
    Ui.closeAll();
  } finally { leaveAgain(); }
});

Test.add('settings', async (check) => {
  // ---- Debounced save (ARC-021, MIS-008): a burst of changes is one write, and a flush writes at once ----
  const inner = makeMemoryStorage(false), counted = { writes: 0, getItem: (key) => inner.getItem(key), setItem(key, value) { this.writes++; inner.setItem(key, value); }, removeItem: (key) => inner.removeItem(key) };
  Save.storage = counted;
  for (let value = 60; value < 70; value++) Settings.set('video.fov', value);
  check('save: a burst of changes writes nothing yet', counted.writes === 0);
  await uiWait(SETTINGS_SAVE_WAIT_MS);
  check('save: the burst becomes one write after the debounce', counted.writes === 1, counted.writes);
  check('save: the written record holds the last value', JSON.parse(inner.getItem(SAVE_KEY)).settings['video.fov'] === 69);
  Settings.set('video.fov', 75);
  flushSave();
  check('save: flushSave writes at once (page hide, pause)', counted.writes === 2 && JSON.parse(inner.getItem(SAVE_KEY)).settings['video.fov'] === 75);
  await uiWait(SETTINGS_SAVE_WAIT_MS);
  check('save: the flushed change does not write a second time later', counted.writes >= 2);
  const broken = makeMemoryStorage(true);
  Save.storage = broken; Save.storageWorks = true; Save.notice = '';
  Settings.set('video.fov', 80);
  check('save: blocked storage never stops the game from changing settings', Settings.get('video.fov') === 80 && flushSave() === undefined);
  Save.storageWorks = true; Save.notice = '';
});

Test.add('settings', (check) => {
  // ---- Assist sliders (ACC-007, DIF-002) ----
  check('assist: one setting per DIFFICULTY_SLIDERS field, range from the slider row', DIFFICULTY_SLIDERS.every((slider) => {
    const definition = Settings.definitions.get('assist.' + slider.field);
    return definition && definition.min === slider.min && definition.max === slider.max && definition.fallback >= slider.min && definition.fallback <= slider.max;
  }));
  const setup = { difficulty: 'skilled' };
  DifficultyAssist.apply(setup);
  check('assist: switched off, the setup keeps the chosen preset', setup.difficulty === 'skilled');
  Settings.set('assist.enabled', true);
  Settings.set('assist.gameSpeed', 0.7);
  Settings.set('assist.playerDamage', 9);
  const built = PlayFlow.buildSetup(PlayFlow.normalize({ difficulty: 'skilled', bots: 2 }), () => 0.5);
  check('assist: switched on, the sliders ride on the preset', built.difficulty.preset === 'skilled' && built.difficulty.gameSpeed === 0.7);
  Game.start(built);
  check('assist: the bots section clamps and carries the values', Game.match.rules.botSkill.gameSpeed === 0.7 && Game.match.rules.botSkill.playerDamage === 4 && Game.match.rules.botSkill.preset === 'skilled');
  check('assist: game speed scales the simulation clock', Test.near(Sim.timeScale, 0.7, 1e-9), Sim.timeScale);
  Game.stop();
  check('assist: the next match starts at normal speed again', (Game.start({ mode: 'ffa', seed: 1 }), Test.near(Sim.timeScale, 1, 1e-9)));
  Game.stop();
  const values = {}, changes = [];
  const container = makeElement('div');
  Ui.difficultyRows(container, values, (field, value) => changes.push(field + '=' + value));
  check('assist: the custom match builder makes one row per field', container.querySelectorAll('.ui-row').length === DIFFICULTY_SLIDERS.length);
  const input = container.querySelector('input');
  input.value = 1.2; input.dispatchEvent(new Event('input'));
  check('assist: a builder row writes into the given object', values.reactionScale !== undefined && changes.length === 1, changes.join());
});
