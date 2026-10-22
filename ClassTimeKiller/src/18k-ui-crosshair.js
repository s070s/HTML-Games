// ==== S18 UI: CROSSHAIR EDITOR AND VIEW SETTINGS (UI-004, UI-016, ACC-005) ====
// The crosshair editor screen with a live preview (a HudBatch layer drawn only while the editor is open), per-weapon overrides through
// Hud.setCrosshairOverride, and the view settings: weapon offset, shake and FOV kick sliders (FOV, weapon FOV and bob live in 07a).
// ViewFx turns explosions, hits, landings and dashes into camera shake and FOV kick through Render.viewEffect; reduce motion and the
// sliders scale it through Render.motion. Contracts: docs/api/accessibility.md.

const VIEW_SHAKE_DECAY = 1.6;                 // trauma lost per second
const VIEW_SHAKE_ANGLE = 0.045;               // radians of yaw and pitch shake at full trauma
const VIEW_SHAKE_ROLL = 0.035;
const VIEW_SHAKE_HZ = [31, 37, 23];
const VIEW_KICK_DECAY = 24;                   // degrees of FOV kick lost per second
const VIEW_KICK_MAX = 12;
const VIEW_FOV_MAX = 130;
const VIEW_EXPLOSION_REACH = 3;               // trauma reaches this many blast radii from the centre
const VIEW_EXPLOSION_TRAUMA = 0.8;
const VIEW_DAMAGE_TRAUMA = 0.12, VIEW_DAMAGE_TRAUMA_PER_HP = 0.003, VIEW_DAMAGE_TRAUMA_MAX = 0.4;
const VIEW_LAND_MIN_SPEED = 6, VIEW_LAND_TRAUMA_PER_SPEED = 0.04, VIEW_LAND_TRAUMA_MAX = 0.35;
const VIEW_DASH_KICK = 6;
const VIEW_IMPULSE_KICK_PER_SPEED = 0.4;
const VIEW_OFFSET_CM = 10;                    // weapon offset sliders: +- this many centimetres

const VIEW_SETTINGS = [
  { key: 'video.shake', fallback: 100, label: 'Camera shake (%)', min: 0, max: 100, step: 5 },
  { key: 'video.fovKick', fallback: 100, label: 'FOV kick on dashes and launches (%)', min: 0, max: 100, step: 5 },
  { key: 'video.viewmodelX', fallback: 0, label: 'Weapon position: sideways (cm)', min: -VIEW_OFFSET_CM, max: VIEW_OFFSET_CM, step: 1 },
  { key: 'video.viewmodelY', fallback: 0, label: 'Weapon position: height (cm)', min: -VIEW_OFFSET_CM, max: VIEW_OFFSET_CM, step: 1 },
  { key: 'video.viewmodelZ', fallback: 0, label: 'Weapon position: distance (cm)', min: -VIEW_OFFSET_CM, max: VIEW_OFFSET_CM, step: 1 },
];
for (const row of VIEW_SETTINGS) Settings.define(row.key, row.fallback, { label: row.label, category: 'video', min: row.min, max: row.max, step: row.step });

const ViewFx = {
  trauma: 0, kick: 0, clock: 0,
  shakeSlider: 1, kickSlider: 1,

  readSettings() {
    this.shakeSlider = Settings.get('video.shake') / 100;
    this.kickSlider = Settings.get('video.fovKick') / 100;
    const offset = Render.config.viewmodelOffset;
    offset[0] = Settings.get('video.viewmodelX') / 100; offset[1] = Settings.get('video.viewmodelY') / 100; offset[2] = Settings.get('video.viewmodelZ') / 100;
    this.applyMotion();
  },
  // Reduce motion (ACC-005) silences all three; the sliders scale shake and FOV kick in between.
  applyMotion() {
    const calm = Hud.reduceMotion();
    Render.motion.bob = calm ? 0 : 1;
    Render.motion.shake = calm ? 0 : this.shakeSlider;
    Render.motion.fovKick = calm ? 0 : this.kickSlider;
  },
  addTrauma(amount) { this.trauma = Math.min(1, this.trauma + amount); },
  addKick(degrees) { this.kick = Math.min(VIEW_KICK_MAX, this.kick + degrees); },
  reset() { this.trauma = 0; this.kick = 0; },
  // Runs inside the camera update (Render.viewEffect) after the camera followed the player.
  apply(camera, seconds) {
    if (this.trauma <= 0 && this.kick <= 0) return;
    this.clock += seconds;
    const motion = Render.motion;
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - seconds * VIEW_SHAKE_DECAY);
      const strength = this.trauma * this.trauma * motion.shake, hz = VIEW_SHAKE_HZ;
      camera.yaw += Math.sin(this.clock * hz[0]) * strength * VIEW_SHAKE_ANGLE;
      camera.pitch = clamp(camera.pitch + Math.sin(this.clock * hz[1] + 1) * strength * VIEW_SHAKE_ANGLE, -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
      camera.roll += Math.sin(this.clock * hz[2] + 2) * strength * VIEW_SHAKE_ROLL;
    }
    if (this.kick > 0) {
      this.kick = Math.max(0, this.kick - seconds * VIEW_KICK_DECAY);
      camera.fov = Math.min(VIEW_FOV_MAX, camera.fov + this.kick * motion.fovKick);
    }
  },
};
Render.viewEffect = (camera, seconds) => ViewFx.apply(camera, seconds);

Bus.on('boot', () => ViewFx.readSettings());
Bus.on('match.start', () => { ViewFx.reset(); ViewFx.readSettings(); });
Bus.on('setting', (key) => { if (typeof key === 'string' && (key.startsWith('video.') || key.startsWith('accessibility.'))) ViewFx.readSettings(); });
Bus.on('explosion', (event) => {
  const player = Game.playerId;
  if (player < 0) return;
  const reach = Math.max(event.radius, 1) * VIEW_EXPLOSION_REACH, distance = Math.sqrt(distanceSquared3(event.x, event.y, event.z, Actors.x[player], Actors.y[player], Actors.z[player]));
  if (distance < reach) ViewFx.addTrauma((1 - distance / reach) * VIEW_EXPLOSION_TRAUMA);
});
Bus.on('damage', (event) => {
  if (event.target !== Game.playerId || event.amount <= 0) return;
  ViewFx.addTrauma(Math.min(VIEW_DAMAGE_TRAUMA_MAX, VIEW_DAMAGE_TRAUMA + event.amount * VIEW_DAMAGE_TRAUMA_PER_HP));
});
Bus.on('move.land', (event) => {
  if (event.id === Game.playerId && event.speed > VIEW_LAND_MIN_SPEED) ViewFx.addTrauma(Math.min(VIEW_LAND_TRAUMA_MAX, (event.speed - VIEW_LAND_MIN_SPEED) * VIEW_LAND_TRAUMA_PER_SPEED));
});
Bus.on('move.dash', (event) => { if (event.id === Game.playerId) ViewFx.addKick(VIEW_DASH_KICK); });
Bus.on('impulse', (event) => { if (event.id === Game.playerId) ViewFx.addKick(Math.hypot(event.x, event.y, event.z) * VIEW_IMPULSE_KICK_PER_SPEED); });

// ---- Crosshair editor ----
const CROSSHAIR_PREVIEW = { x: 0.74, y: 0.5, width: 300, height: 220, spreadMax: 30 };   // centre as a share of the screen; design pixels
const CROSSHAIR_STRIPES = [0xdfe5ec, 0x6f7782, 0x2a2f37, 0xa63d3d];                    // light, grey, dark and red bands: the crosshair must read on each
const CROSSHAIR_FIELD_ROWS = HUD_CROSSHAIR_SETTINGS.filter((row) => row.key.startsWith('hud.crosshair.')).map((row) => ({ field: row.key.split('.').pop(), key: row.key }));

const CrosshairEditor = {
  open: false,
  target: '',                    // '' = the default crosshair, else a weapon id whose override is being edited
  spread: 0,                     // preview spread in pixels
  layout: { unit: 1, centerX: 0, centerY: 0 },

  weapon() { return this.target ? CAT.weapons.byId(this.target) : null; },
  // The values shown for the target: the default settings, laid over by the class table and the player's override for a weapon.
  current() { return Hud.crosshairFor(this.weapon()); },
  write(field, value) {
    if (!this.target) { Settings.set('hud.crosshair.' + field, value); return; }
    const saved = Save.data.crosshairs && Save.data.crosshairs[this.target] ? Save.data.crosshairs[this.target] : {};
    Hud.setCrosshairOverride(this.target, Object.assign({}, saved, { [field]: value }));
  },
  hasOverride() { return !!(this.target && Save.data.crosshairs && Save.data.crosshairs[this.target]); },
  clearOverride() { if (this.target) Hud.setCrosshairOverride(this.target, null); },
  // Back to the factory crosshair: default settings and every weapon override.
  resetAll() {
    Settings.resetKeys(CROSSHAIR_FIELD_ROWS.map((row) => row.key));
    Save.data.crosshairs = {};
    Save.scheduleSave();
  },
  weaponOptions() {
    const ids = [''], labels = ['All weapons (default)'];
    for (const weapon of CAT.weapons) { ids.push(weapon.id); labels.push(weapon.name); }
    return { ids, labels };
  },
};

// The preview layer: draws the crosshair at the right of the editor over four contrast bands, using the same drawing code as the HUD.
function crosshairPreviewDraw(batch) {
  if (!CrosshairEditor.open) return;
  const unit = clamp(Math.min(batch.width / HUD_DESIGN_WIDTH, batch.height / HUD_DESIGN_HEIGHT), HUD_UNIT_MIN, HUD_UNIT_MAX) * Hud.scale;
  const c = CROSSHAIR_PREVIEW, layout = CrosshairEditor.layout, width = c.width * unit, height = c.height * unit;
  layout.unit = unit; layout.centerX = batch.width * c.x; layout.centerY = batch.height * c.y;
  const left = layout.centerX - width / 2, top = layout.centerY - height / 2, band = height / CROSSHAIR_STRIPES.length;
  for (let i = 0; i < CROSSHAIR_STRIPES.length; i++) HudPen.rect(left, top + i * band, width, band, CROSSHAIR_STRIPES[i], 1);
  hudDrawCrosshairShape(HudPen, layout, CrosshairEditor.current(), CrosshairEditor.spread * unit);
}
HudBatch.addLayer('hud.preview', 50, crosshairPreviewDraw);

function crosshairRow(row) {
  const definition = Settings.definitions.get(row.key);
  return Ui.row(definition.label, valueControl(definition, CrosshairEditor.current()[row.field], (next) => CrosshairEditor.write(row.field, next)));
}

function buildCrosshairRows(rows, refresh) {
  rows.replaceChildren();
  const weapons = CrosshairEditor.weaponOptions();
  rows.appendChild(Ui.row('Edit crosshair for', Ui.cycle(weapons.ids, weapons.labels, CrosshairEditor.target, (value) => { CrosshairEditor.target = value; refresh(); })));
  for (const row of CROSSHAIR_FIELD_ROWS) rows.appendChild(crosshairRow(row));
  const scope = Settings.definitions.get('hud.scopeOverlay');
  rows.appendChild(Ui.row(scope.label, settingControl('hud.scopeOverlay', scope)));
  rows.appendChild(Ui.row('Preview spread (pixels)', Ui.slider({ min: 0, max: CROSSHAIR_PREVIEW.spreadMax, step: 1, value: CrosshairEditor.spread, format: String }, (value) => { CrosshairEditor.spread = value; })));
}

Ui.register('crosshair', {
  passthrough: true,
  build(root) {
    root.dataset.dock = 'left';
    const panel = makeElement('div', 'ui-panel ui-editor'), rows = makeElement('div', 'ui-crosshair-rows');
    const note = makeElement('p', 'ui-note', 'The preview on the right uses the same drawing as the game. A weapon override is kept separately and wins over the default.');
    const refresh = () => {
      Ui.rebuild(rows, () => buildCrosshairRows(rows, refresh));
      remove.disabled = !CrosshairEditor.hasOverride();
    };
    const remove = Ui.button('Remove weapon override', () => { CrosshairEditor.clearOverride(); refresh(); });
    const reset = Ui.button('Reset crosshair', () => Ui.confirm({ title: 'Reset the crosshair?', text: 'The default crosshair and every weapon override return to the factory look.', yes: 'Reset', onYes: () => { CrosshairEditor.resetAll(); refresh(); } }));
    const done = Ui.button('Done', () => Ui.back(), 'primary');
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(remove); foot.appendChild(reset); foot.appendChild(done);
    panel.appendChild(makeElement('h1', 'ui-title', 'Crosshair'));
    panel.appendChild(note); panel.appendChild(rows); panel.appendChild(foot);
    root.appendChild(panel);
    refresh();
    rows.querySelector('button').dataset.autofocus = '1';   // the weapon choice takes the focus first
  },
  onOpen() { CrosshairEditor.open = true; },
  onClose() { CrosshairEditor.open = false; CrosshairEditor.target = ''; },
});

// The HUD tab links to the editor; the pause menu offers it too.
Ui.settingsExtras.hud = [(container) => {
  const foot = makeElement('div', 'ui-foot');
  foot.appendChild(Ui.button('Crosshair editor', () => Ui.open('crosshair')));
  container.appendChild(foot);
}];
const CROSSHAIR_PAUSE_ENTRY = { label: 'Crosshair', screen: 'crosshair' };
Bus.on('match.start', () => setPauseEntry(CROSSHAIR_PAUSE_ENTRY, true));   // re-added every match: a test run may have emptied the list
Bus.on('boot', () => injectStyle('ui-crosshair-style', '.ui-crosshair .ui-panel { margin: auto auto auto 0; } .ui-crosshair .ui-editor { width: min(420px, 52vw); }'));
