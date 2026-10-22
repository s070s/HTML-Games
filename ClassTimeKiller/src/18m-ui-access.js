// ==== S18 UI: ACCESSIBILITY (ACC-001..ACC-008) ====
// The shared accessibility settings live here once: the HUD (17a) reads colour-blind palette, reduce motion and photosensitivity, the
// renderer (07a/07c/07d) gets high-contrast outlines, the team palette and the particle share through the fields it exposes, and the
// view effects (18k) read reduce motion through Hud.reduceMotion(). Captions, the sound ring and team shapes are HUD elements (17d, 17f).
// This file also builds the Accessibility tab: every hold action, aim assist, volume and caption control in one place (same settings
// as the other tabs, mirrored rows, never a second copy of a value). Contracts: docs/api/accessibility.md.

const ACCESS_PALETTES = ['off', 'protanopia', 'deuteranopia', 'tritanopia'];
const ACCESS_PARTICLES_MIN = 25;         // percent: even the lowest setting keeps some effects so hits stay readable
const ACCESS_HOLD_ACTIONS = ACTION_ROWS.filter((row) => row.toggle).map((row) => row.id);
const ACCESS_AIM_ASSIST_KEYS = ['controls.pad.aimAssist', 'controls.touch.aimAssist', 'controls.touch.autoFire'];
const ACCESS_VOLUME_KEYS = ['audio.master', 'audio.sfx', 'audio.ui', 'audio.announcer', 'audio.music'];

const ACCESS_SETTINGS = [
  { key: 'accessibility.colorBlind', fallback: 'off', label: 'Colour-blind palette (HUD and teams)', options: ACCESS_PALETTES,
    optionLabels: ['Off', 'Protanopia', 'Deuteranopia', 'Tritanopia'] },
  { key: 'accessibility.highContrast', fallback: false, label: 'High-contrast enemy outlines' },
  { key: 'accessibility.reduceMotion', fallback: 'auto', label: 'Reduce motion (shake, bob, FOV kick, pulses, flashes)', options: ['auto', 'on', 'off'],
    optionLabels: ['Follow the system', 'On', 'Off'] },
  { key: 'accessibility.photosensitive', fallback: false, label: 'Photosensitivity mode (flashes darken the screen, 3 per second at most)' },
  { key: 'accessibility.particles', fallback: 100, label: 'Particle intensity (%)', min: ACCESS_PARTICLES_MIN, max: 100, step: 5 },
];
for (const row of ACCESS_SETTINGS) {
  Settings.define(row.key, row.fallback, { label: row.label, category: 'accessibility', min: row.min, max: row.max, step: row.step, options: row.options, optionLabels: row.optionLabels });
}

const Access = {
  // Pushes the settings into the fields the renderer reads (Render.config.*, Render.teamPalette).
  apply() {
    const config = Render.config;
    config.highContrast = Settings.get('accessibility.highContrast');
    config.particleScale = Settings.get('accessibility.particles') / 100;
    Render.teamPalette = Hud.paletteId === 'off' ? null : Hud.colors.teams;
  },
  // Rows for a list of existing settings, with a heading: the same settings as their home tab (ACC-004, ACC-006).
  addMirroredRows(container, title, keys) {
    container.appendChild(makeElement('div', 'ui-group', title));
    for (const key of keys) {
      const definition = Settings.definitions.get(key);
      if (definition && isEditableSetting(definition)) container.appendChild(Ui.row(definition.label || key, settingControl(key, definition)));
    }
  },
  holdKeys() { return ACCESS_HOLD_ACTIONS.map((id) => 'controls.toggle.' + id); },
  mirroredCount() { return this.holdKeys().length + ACCESS_AIM_ASSIST_KEYS.length + ACCESS_VOLUME_KEYS.length; },
};

Bus.on('boot', () => Access.apply());
Bus.on('match.start', () => Access.apply());
Bus.on('setting', (key) => { if (typeof key === 'string' && key.startsWith('accessibility.')) Access.apply(); });

// The tab starts with the controls people look for here (other tabs' settings); the accessibility settings themselves follow, grouped by 18l.
Ui.settingsExtras.accessibility = [
  (container) => Access.addMirroredRows(container, 'Hold or toggle', Access.holdKeys()),
  (container) => Access.addMirroredRows(container, 'Aim assist', ACCESS_AIM_ASSIST_KEYS),
  (container) => Access.addMirroredRows(container, 'Volume and audio', ACCESS_VOLUME_KEYS),
];
