// ==== S18 UI: SETTINGS COMPLETION (ARC-021, MIS-008, ACC-007) ====
// 18b generates the tabs from Settings.definitions; this file adds the group headings, "Reset all settings", a save that is flushed when the
// page hides (a debounced save alone can lose the last change), and the assist sliders: the DIF-002 difficulty fields as the player's own
// settings (the Gameplay tab) and as a reusable row builder for custom matches (Ui.difficultyRows).

// Heading of a settings row: the first prefix that matches wins, so specific keys come before their family. '' = no heading.
const SETTING_GROUPS = [
  ['video.fov', 'View'], ['video.viewmodel', 'View'], ['video.headBob', 'View'], ['video.shake', 'View'], ['video.fovKick', 'View'],
  ['video.', 'Picture and speed'],
  ['controls.mouse', 'Mouse'], ['controls.rawMouse', 'Mouse'], ['controls.invertY', 'Mouse'], ['controls.adsMultiplier', 'Mouse'],
  ['controls.pad.', 'Gamepad'], ['controls.touch.', 'Touch'], ['controls.toggle.', 'Hold or toggle'], ['controls.', 'Feedback'],
  ['audio.mono', 'Sound'], ['audio.hrtf', 'Sound'], ['audio.speech', 'Sound'], ['audio.', 'Volume'],
  ['assist.', 'Assist sliders (used when switched on)'], ['difficulty.', 'Bots'], ['gameplay.chatter', 'Bots'], ['gameplay.taunts', 'Bots'], ['gameplay.', 'Movement and aiming aids'],
  ['hud.element.captions', 'Captions and sound cues'], ['hud.element.soundRing', 'Captions and sound cues'], ['hud.element.barks', 'Captions and sound cues'], ['hud.caption', 'Captions and sound cues'],
  ['hud.crosshair.', 'Crosshair'], ['hud.scopeOverlay', 'Crosshair'], ['hud.element.', 'Show or hide parts of the HUD'], ['hud.teamShapes', 'Vision and interface'], ['hud.', 'Layout and look'],
  ['accessibility.colorBlind', 'Vision and interface'], ['accessibility.highContrast', 'Vision and interface'], ['ui.scale', 'Vision and interface'],
  ['accessibility.', 'Motion and flashes'], ['progress.', 'Progress'],
];
Ui.settingGroup = function settingGroup(key) {
  const found = SETTING_GROUPS.find((entry) => key.startsWith(entry[0]));
  return found ? found[1] : '';
};

// ---- Reset all, and saving before the page goes away ----
function editableSettingKeys() {
  const keys = [];
  for (const [id] of SETTINGS_TABS) keys.push(...settingKeys(id));
  return keys;
}
Ui.settingsFooter.push((refresh) => Ui.button('Reset all settings', () => Ui.confirm({
  title: 'Reset all settings?', text: 'Every setting on every tab returns to its default. Key bindings and your progress stay.', yes: 'Reset',
  onYes: () => { resetSettingKeys(editableSettingKeys()); refresh(); },
}), 'danger'));

// ---- Save export and import (ARC-020, PLT-007): the whole save as text to copy or as a file; paste or load one back ----
const SAVE_FILE_NAME = 'classtimekiller-save.json';
const SaveTransfer = {
  reload: () => window.location.reload(),   // every section reads the imported save from a fresh start; tests replace it
  // Imports the text and restarts; returns '' on success, else the reason shown to the player.
  importText(text) {
    try {
      Save.importText(text);
    } catch (error) {
      return 'That is not a ClassTimeKiller save (' + (error && error.message || error) + ').';
    }
    this.reload();
    return '';
  },
  download() {
    const url = URL.createObjectURL(new Blob([Save.exportText()], { type: 'application/json' }));
    const link = makeElement('a');
    link.href = url; link.download = SAVE_FILE_NAME;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },
  readFile(file, area) { file.text().then((text) => { area.value = text; }).catch(() => Ui.toast('That file could not be read.')); },
};
Ui.register('saveTransfer', {
  build(root) {
    screenHeader(root, 'Save data');
    root.appendChild(makeElement('p', 'ui-note', 'Export shows your settings, bindings and progress as text to copy, or saves them as a file. '
      + 'Import replaces them with a save you exported before, then the game restarts.'));
    const area = makeElement('textarea', 'ui-code');
    area.spellcheck = false;
    const picker = makeElement('input');
    picker.type = 'file'; picker.accept = '.json,application/json,text/plain'; picker.hidden = true;
    picker.addEventListener('change', () => { if (picker.files[0]) SaveTransfer.readFile(picker.files[0], area); });
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(Ui.button('Export', () => { area.value = Save.exportText(); area.select(); }));
    foot.appendChild(Ui.button('Download file', () => SaveTransfer.download()));
    foot.appendChild(Ui.button('Load file', () => picker.click()));
    foot.appendChild(Ui.button('Import', () => Ui.confirm({
      title: 'Import this save?', text: 'Your current settings, bindings and progress are replaced.', yes: 'Import',
      onYes: () => { const problem = SaveTransfer.importText(area.value); if (problem) Ui.toast(problem); },
    }), 'danger'));
    root.appendChild(area);
    root.appendChild(picker);
    root.appendChild(foot);
  },
});
Ui.settingsExtras.developer = [(container) => {
  const foot = makeElement('div', 'ui-foot');
  foot.appendChild(Ui.button('Export or import save', () => Ui.open('saveTransfer')));
  container.appendChild(foot);
}];

function flushSave() { if (Save.data) Save.saveNow(); }
Bus.on('boot', () => {
  if (Game.headless) return;
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
});
Bus.on('game.pause', flushSave);

// ---- Assist sliders (ACC-007, DIF-002) ----
// One row per DIFFICULTY_SLIDERS field: its label, the neutral value ("Regular" preset) and the slider step.
//   live  - a section reads rules.botSkill.<field>, so the slider changes the match (custom match rows, Ui.difficultyRows).
//   assist - the player may set it as a personal assist (the Gameplay tab). Switched on, only the assists the player moved away from
//            their neutral value replace the chosen preset's field; everything else keeps the preset (no penalty).
// The fields with live false are carried in rules.botSkill but nobody reads them yet (the PvE section owns damage, lives and checkpoints,
// the weapons section the parry window): they get no slider until their reader exists, so no slider is shown that does nothing.
const ASSIST_ROWS = {
  gameSpeed: { label: 'Game speed (x)', fallback: 1, step: 0.05, live: true, assist: true },
  aimAssist: { label: 'Aim assist floor (%, touch and gamepad)', fallback: 0, step: 5, live: true, assist: true },
  reactionScale: { label: 'Bot reaction time (x)', fallback: 1, step: 0.1, live: true, assist: false },
  aimErrorScale: { label: 'Bot aim error (x)', fallback: 1, step: 0.1, live: true, assist: false },
  aggression: { label: 'Bot aggression (0 to 1)', fallback: 0.5, step: 0.05, live: true, assist: false },
  attackers: { label: 'Bots attacking at once', fallback: 3, step: 1, live: true, assist: false },
  parry: { label: 'Parry window (seconds)', fallback: 0.3, step: 0.05, live: false, assist: true },
  playerDamage: { label: 'Damage you deal to enemies (x)', fallback: 1, step: 0.25, live: false, assist: true },
  enemyDamage: { label: 'Damage enemies deal to you (x)', fallback: 1, step: 0.25, live: false, assist: true },
  projectileSpeed: { label: 'Enemy projectile speed (x)', fallback: 1, step: 0.05, live: false, assist: false },
  resourceYield: { label: 'Pickup yield (x)', fallback: 1, step: 0.1, live: false, assist: false },
  lives: { label: 'Lives (0 = unlimited)', fallback: 0, step: 1, live: false, assist: false },
  checkpointHeal: { label: 'Checkpoint healing (0 to 1)', fallback: 0.5, step: 0.05, live: false, assist: false },
};
// field -> settings-style definition ({ label, fallback, min, max, step }) of every slider that has a reader.
const ASSIST_DEFINITIONS = new Map();
for (const slider of DIFFICULTY_SLIDERS) {
  const row = ASSIST_ROWS[slider.field];
  if (row.live) ASSIST_DEFINITIONS.set(slider.field, { label: row.label, fallback: row.fallback, min: slider.min, max: slider.max, step: row.step });
}
Settings.define('assist.enabled', false, { label: 'Use my assist sliders in matches', category: 'gameplay' });
for (const [field, definition] of ASSIST_DEFINITIONS) {
  if (ASSIST_ROWS[field].assist) Settings.define('assist.' + field, definition.fallback, Object.assign({ category: 'gameplay' }, definition));
}

const DifficultyAssist = {
  enabled() { return Settings.get('assist.enabled'); },
  // { field: value } of every assist the player has set away from its neutral value (reading the settings).
  values() {
    const values = {};
    for (const [field, definition] of ASSIST_DEFINITIONS) {
      if (!ASSIST_ROWS[field].assist) continue;
      const value = Settings.get('assist.' + field);
      if (value !== definition.fallback) values[field] = value;
    }
    return values;
  },
  // setup.difficulty for the setup: the chosen preset plus the player's changed assists when switched on.
  apply(setup) {
    if (!this.enabled()) return;
    const preset = typeof setup.difficulty === 'string' ? setup.difficulty : setup.difficulty && setup.difficulty.preset;
    const previous = setup.difficulty && typeof setup.difficulty === 'object' ? setup.difficulty : null;
    setup.difficulty = Object.assign({ preset: preset || PLAY_DEFAULT_DIFFICULTY }, previous, this.values());
  },
};
PlayFlow.setupHooks.push((setup) => DifficultyAssist.apply(setup));

// Slider rows for a plain object of { field: value } (custom matches); onChange(field, value) runs after every change.
Ui.difficultyRows = function difficultyRows(container, values, onChange) {
  for (const [field, definition] of ASSIST_DEFINITIONS) {
    const value = typeof values[field] === 'number' ? values[field] : definition.fallback;
    container.appendChild(Ui.row(definition.label, valueControl(definition, value, (next) => { values[field] = next; onChange(field, next); })));
  }
};

// Game speed rides on rules.fx.timeScale (the Game Speed mutator's field), multiplied in by the difficulty stage in 14a (PvE only).
