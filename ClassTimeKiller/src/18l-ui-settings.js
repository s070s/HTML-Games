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
  ['accessibility.', 'Motion and flashes'],
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

function flushSave() { if (Save.data) Save.saveNow(); }
Bus.on('boot', () => {
  if (Game.headless) return;
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
});
Bus.on('game.pause', flushSave);

// ---- Assist sliders (ACC-007, DIF-002) ----
// One row per DIFFICULTY_SLIDERS field: its label, the neutral value ("Regular" preset) and the slider step. Switched on, the values
// replace the chosen preset's sliders in matches started from Quick Match and the Play screen; nothing else changes (no penalty).
const ASSIST_ROWS = {
  gameSpeed: { label: 'Game speed (x)', fallback: 1, step: 0.05 },
  parry: { label: 'Parry window (seconds)', fallback: 0.3, step: 0.05 },
  playerDamage: { label: 'Damage you deal to enemies (x)', fallback: 1, step: 0.25 },
  enemyDamage: { label: 'Damage enemies deal to you (x)', fallback: 1, step: 0.25 },
  aimAssist: { label: 'Aim assist floor (%)', fallback: 0, step: 5 },
  reactionScale: { label: 'Bot reaction time (x)', fallback: 1, step: 0.1 },
  aimErrorScale: { label: 'Bot aim error (x)', fallback: 1, step: 0.1 },
  aggression: { label: 'Bot aggression (0 to 1)', fallback: 0.5, step: 0.05 },
  attackers: { label: 'Bots attacking at once', fallback: 3, step: 1 },
  projectileSpeed: { label: 'Enemy projectile speed (x)', fallback: 1, step: 0.05 },
  resourceYield: { label: 'Pickup yield (x)', fallback: 1, step: 0.1 },
  lives: { label: 'Lives (0 = unlimited)', fallback: 0, step: 1 },
  checkpointHeal: { label: 'Checkpoint healing (0 to 1)', fallback: 0.5, step: 0.05 },
};
Settings.define('assist.enabled', false, { label: 'Use my assist sliders in matches', category: 'gameplay' });
for (const slider of DIFFICULTY_SLIDERS) {
  const row = ASSIST_ROWS[slider.field];
  Settings.define('assist.' + slider.field, row.fallback, { label: row.label, category: 'gameplay', min: slider.min, max: slider.max, step: row.step });
}

const DifficultyAssist = {
  enabled() { return Settings.get('assist.enabled'); },
  // { field: value } for every DIFFICULTY_SLIDERS field, read from the settings.
  values() {
    const values = {};
    for (const slider of DIFFICULTY_SLIDERS) values[slider.field] = Settings.get('assist.' + slider.field);
    return values;
  },
  // setup.difficulty for the setup: the chosen preset plus the player's sliders when switched on.
  apply(setup) {
    if (!this.enabled()) return;
    const preset = typeof setup.difficulty === 'string' ? setup.difficulty : setup.difficulty && setup.difficulty.preset;
    setup.difficulty = Object.assign({ preset: preset || PLAY_DEFAULT_DIFFICULTY }, this.values());
  },
};
PlayFlow.setupHooks.push((setup) => DifficultyAssist.apply(setup));

// Slider rows for a plain object of { field: value } (custom matches); onChange(field, value) runs after every change.
Ui.difficultyRows = function difficultyRows(container, values, onChange) {
  for (const slider of DIFFICULTY_SLIDERS) {
    const definition = Settings.definitions.get('assist.' + slider.field);
    const value = typeof values[slider.field] === 'number' ? values[slider.field] : definition.fallback;
    container.appendChild(Ui.row(definition.label, valueControl(definition, value, (next) => { values[slider.field] = next; onChange(slider.field, next); })));
  }
};

// Game speed is the one assist field that has no owner of its own: it scales the simulation clock like the Game Speed mutator.
Bus.on('match.start', (match) => {
  const skill = match.rules && match.rules.botSkill;
  if (skill && skill.gameSpeed && skill.gameSpeed !== 1) Sim.timeScale *= skill.gameSpeed;
});
