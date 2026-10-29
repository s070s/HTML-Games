// ==== S18 UI: SETTINGS COMPLETION (ARC-021, MIS-008, ACC-007) ====
// 18b generates the tabs from Settings.definitions; this file adds the group headings, "Reset all settings", a save that is flushed when the
// page hides (a debounced save alone can lose the last change), and the assist sliders: the DIF-002 difficulty fields as the player's own
// settings (the Gameplay tab) and as a reusable row builder for custom matches (Ui.difficultyRows).

// [heading, key prefixes...]: the first match wins, so specific keys come before their family. '' = no heading.
const SETTING_GROUPS = [
  ['View', 'video.fov', 'video.viewmodel', 'video.headBob', 'video.shake', 'video.weaponMotion', 'video.muzzleFlash'], ['Picture and speed', 'video.'],
  ['Mouse', 'controls.mouse', 'controls.rawMouse', 'controls.invertY', 'controls.adsMultiplier'], ['Gamepad', 'controls.pad.'], ['Touch', 'controls.touch.'],
  ['Hold or toggle', 'controls.toggle.'], ['Feedback', 'controls.'], ['Sound', 'audio.mono', 'audio.hrtf', 'audio.speech', 'audio.heartbeat'], ['Volume', 'audio.'],
  ['Assist sliders (used when switched on)', 'assist.'], ['Bots', 'difficulty.', 'gameplay.chatter', 'gameplay.taunts'], ['Movement and aiming aids', 'gameplay.'],
  ['Captions and sound cues', 'hud.element.captions', 'hud.element.soundRing', 'hud.element.barks', 'hud.caption'], ['Crosshair', 'hud.crosshair.', 'hud.scopeOverlay'],
  ['Show or hide parts of the HUD', 'hud.element.'], ['Vision and interface', 'hud.teamShapes', 'accessibility.colorBlind', 'accessibility.highContrast', 'ui.scale'],
  ['Layout and look', 'hud.'], ['Motion and flashes', 'accessibility.'], ['Progress', 'progress.'],
];
Ui.settingGroup = function settingGroup(key) {
  const found = SETTING_GROUPS.find((group) => group.some((prefix, index) => index > 0 && key.startsWith(prefix)));
  return found ? found[0] : '';
};

// ---- Reset all, and saving before the page goes away ----
function editableSettingKeys() {
  const keys = [];
  for (const [id] of SETTINGS_TABS) keys.push(...settingKeys(id));
  return keys;
}
Ui.settingsFooter.push((refresh) => Ui.button('Reset all settings', () => Ui.confirm({
  title: 'Reset all settings?', text: 'Every setting on every tab returns to its default. Key bindings and your progress stay.', yes: 'Reset',
  onYes: () => { Settings.resetKeys(editableSettingKeys()); refresh(); },
}), 'danger'));

// ---- Save export and import (ARC-020, PLT-007): the whole save as text to copy or as a file; paste or load one back ----
const SAVE_FILE_NAME = 'classtimekiller-save.json';
const SAVE_URL_LIFETIME_MS = 10000;   // Safari / iOS drop a download whose blob URL is revoked right after the click
const SaveTransfer = {
  reload: () => window.location.reload(),   // every section reads the imported save from a fresh start; tests replace it
  // Imports the text and restarts; returns '' on success, else the reason shown to the player (nothing changed then, no restart).
  importText(text) {
    let written = false;
    try {
      written = Save.importText(text);
    } catch (error) {
      return 'That is not a ClassTimeKiller save (' + (error && error.message || error) + ').';
    }
    if (!written) return Save.notice || SAVE_BLOCKED;
    this.reload();
    return '';
  },
  download() {
    const url = URL.createObjectURL(new Blob([Save.exportText()], { type: 'application/json' }));
    const link = makeElement('a');
    link.href = url; link.download = SAVE_FILE_NAME;
    document.body.appendChild(link);   // some browsers ignore a click on a detached link
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), SAVE_URL_LIFETIME_MS);
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
    // iOS selects only this way.
    const exportToBox = () => { area.value = Save.exportText(); area.select(); area.setSelectionRange(0, area.value.length); };
    foot.appendChild(Ui.button('Export', exportToBox));
    foot.appendChild(Ui.button('Copy', () => { if (!area.value) exportToBox(); copyText(area.value, area); }));
    foot.appendChild(Ui.button('Download file', () => SaveTransfer.download()));
    foot.appendChild(Ui.button('Load file', () => picker.click()));
    const importConfirmed = (text) => { const problem = SaveTransfer.importText(text); if (problem) Ui.toast(problem); };
    foot.appendChild(Ui.button('Import', () => Ui.confirm({
      title: 'Import this save?', text: 'Your current settings, bindings and progress are replaced. They are kept as the backup.', yes: 'Import',
      onYes: () => importConfirmed(area.value),
    }), 'danger'));
    root.appendChild(area);
    root.appendChild(picker);
    root.appendChild(foot);
    // R-039: the replaced or unreadable save can be shown and put back.
    const backup = Save.backupText();
    if (backup === null) return;
    const backupFoot = makeElement('div', 'ui-foot');
    backupFoot.appendChild(Ui.button('Export backup', () => { area.value = backup; }));
    backupFoot.appendChild(Ui.button('Restore backup', () => Ui.confirm({
      title: 'Restore the backup?', text: 'Your current save becomes the backup.', yes: 'Restore',
      onYes: () => importConfirmed(backup),
    }), 'danger'));
    root.appendChild(backupFoot);
  },
});
// Under every tab: on iPhone a backup is the safe way to keep progress (R-008).
Ui.settingsFooter.push(() => Ui.button('Back up or restore save', () => Ui.open('saveTransfer')));

// Pause, hide and app switch write only a waiting change (one switch fires all three, R-163).
function flushSave() { if (Save.data && Save.dirty) Save.saveNow(); }
// Takes another tab's newer save while this one has no change (else its next write does, R-001).
function adoptOtherTabSave() { if (Save.data && !Save.dirty) Save.adoptNewer(); }
Bus.on('boot', () => {
  if (Game.headless) return;
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); else adoptOtherTabSave(); });
  window.addEventListener('storage', (event) => { if (event.key === SAVE_KEY) adoptOtherTabSave(); });
  // Back from the page cache.
  window.addEventListener('pageshow', (event) => { if (event.persisted) adoptOtherTabSave(); });
});
Bus.on('game.pause', flushSave);

// ---- Assist sliders (ACC-007, DIF-002) ----
// One row per DIFFICULTY_SLIDERS field: its label, the neutral value ("Regular" preset) and the slider step.
//   live  - a section reads rules.botSkill.<field>, so the slider changes the match (custom match rows, Ui.difficultyRows).
//   assist - the player may set it as a personal assist (the Gameplay tab). Switched on, only the assists the player moved away from
//            their neutral value replace the chosen preset's field; everything else keeps the preset (no penalty).
// Every field has its reader now (bots 14a, the PvE section 14h-14j for damage, parry, projectiles, pickups, lives and checkpoints);
// a row with live false would get no slider, so a future field without a reader shows nothing that does nothing.
const ASSIST_ROWS = {
  gameSpeed: { label: 'Game speed (x)', fallback: 1, step: 0.05, live: true, assist: true },
  aimAssist: { label: 'Aim assist floor (%, touch and gamepad)', fallback: 0, step: 5, live: true, assist: true },
  reactionScale: { label: 'Bot reaction time (x)', fallback: 1, step: 0.1, live: true, assist: false },
  aimErrorScale: { label: 'Bot aim error (x)', fallback: 1, step: 0.1, live: true, assist: false },
  aggression: { label: 'Bot aggression (0 to 1)', fallback: 0.5, step: 0.05, live: true, assist: false },
  attackers: { label: 'Bots attacking at once', fallback: 3, step: 1, live: true, assist: false },
  parry: { label: 'Parry window (seconds)', fallback: 0.3, step: 0.05, live: true, assist: true },
  // playerDamage scales the hits the player takes from PvE enemies, enemyDamage the hits PvE enemies take (14h).
  playerDamage: { label: 'Damage enemies deal to you (x)', fallback: 1, step: 0.25, live: true, assist: true },
  enemyDamage: { label: 'Damage you deal to enemies (x)', fallback: 1, step: 0.25, live: true, assist: true },
  projectileSpeed: { label: 'Enemy projectile speed (x)', fallback: 1, step: 0.05, live: true, assist: false },
  resourceYield: { label: 'Pickup yield (x)', fallback: 1, step: 0.1, live: true, assist: false },
  lives: { label: 'Lives (0 = unlimited)', fallback: 0, step: 1, live: true, assist: false },
  checkpointHeal: { label: 'Checkpoint healing (0 to 1)', fallback: 0.5, step: 0.05, live: true, assist: false },
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
  // Restart and Play again start the same setup again, so the choice before any assist is kept in setup.baseDifficulty
  // and every run rebuilds from it: assists switched off or moved back to neutral since then come off.
  apply(setup) {
    if (!('baseDifficulty' in setup)) setup.baseDifficulty = setup.difficulty;
    const base = setup.baseDifficulty;
    if (!this.enabled()) { setup.difficulty = base; return; }
    const preset = typeof base === 'string' ? base : base && base.preset;
    const previous = base && typeof base === 'object' ? base : null;
    setup.difficulty = Object.assign({ preset: preset || PLAY_DEFAULT_DIFFICULTY }, previous, this.values());
  },
};
Game.setupHooks.push((setup) => DifficultyAssist.apply(setup));

// Slider rows for a plain object of { field: value } (custom matches); onChange(field, value) runs after every change.
Ui.difficultyRows = function difficultyRows(container, values, onChange) {
  for (const [field, definition] of ASSIST_DEFINITIONS) {
    const value = typeof values[field] === 'number' ? values[field] : definition.fallback;
    container.appendChild(Ui.row(definition.label, valueControl(definition, value, (next) => { values[field] = next; onChange(field, next); })));
  }
};

// Game speed rides on rules.fx.timeScale (the Game Speed mutator's field), multiplied in by the difficulty stage in 14a (every mode).
