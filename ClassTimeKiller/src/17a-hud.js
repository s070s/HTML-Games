// ==== S17 HUD: CORE AND PLAYER STATUS ====
// The HUD is WebGL quads only (REN-005): four HudBatch layers (back, world, main, front), one draw call each. Drawers register with
// Hud.register(layer, id, element, draw(pen, layout, seconds)); `element` names a toggle in HUD_ELEMENTS ('' = always on), so every
// element can be hidden (UI-015). 17b = crosshair and combat feedback, 17c = match header, kill feed, banners, 17d = world markers and
// accessibility captions, 17e = killcam. This file: settings, layout (scale, opacity, safe areas, compact phone layout), the pen,
// world -> screen projection, and the status panels (health, ammo, weapon bar, gadgets, abilities, money, powerups).
// Contracts: docs/api/hud-play.md.

const HUD_LAYERS = [['back', 10], ['world', 20], ['main', 30], ['front', 40]];
const HUD_SCALE_MIN = 50, HUD_SCALE_MAX = 150;           // percent
const HUD_OPACITY_MIN = 30;                              // percent
const HUD_DESIGN_WIDTH = 1100, HUD_DESIGN_HEIGHT = 620;  // screen size where the unit is 1 (text never drops under 14 px at 100%)
const HUD_UNIT_MIN = 0.9, HUD_UNIT_MAX = 1.5;
const HUD_COMPACT_HEIGHT = 520;                          // 'auto' compact layout below this height and on touch
const HUD_MARGIN = 14;
const HUD_TEXT_SMALL = 14;                               // ACC-008: nothing smaller than 14 px at 100% scale
const HUD_FLASHES_PER_SECOND = 3;                        // ACC-005 photosensitivity cap
const HUD_PHOTOSENSITIVE_ALPHA = 0.5;                    // strongest full-screen flash in photosensitivity mode
const HUD_REDUCED_FLASH = 0.5;                           // reduce motion: flashes at half strength
const HUD_NUMBER_CACHE = 1000;
const HUD_LARGE_NUMBER_LIMIT = 256;                      // larger values drawn lately (a core of 5000 makes one string per new value)
const HUD_LABEL_REFRESH_SECONDS = 1;
const HUD_LOW_AMMO = 0.25;
const HUD_PULSE_HZ = 2;                                  // slow pulses only: well under the flash cap
const HUD_MAX_ABILITY_SLOTS = 4;
const HUD_MAX_POWERUP_CHIPS = 4;
const HUD_MAX_WEAPON_SLOTS = 9;
const HUD_BAR_GAP = 4, HUD_BAR_WIDTH = 50, HUD_BAR_TOUCH_WIDTH = 42, HUD_BAR_TOUCH_HEIGHT = 34;   // design pixels (phones: boxes sized for a thumb)
const HUD_MONEY_ECONOMIES = ['roundBuy', 'waveShop'];    // rulesets whose economy is money based (others show money only when non-zero)
const HUD_TEAM_SHAPES = ['circle', 'triangle', 'square', 'diamond'];
const HUD_FREE_FOR_ALL_COLOR = 0xdde3ea;

const HUD_COLOR = {
  text: 0xffffff, dim: 0xa7b3c0, panel: 0x070b10, track: 0x10161d, health: 0x58d66b, healthLow: 0xff5448,
  armor: 0x5ba8ff, shield: 0x46d9e6, warn: 0xffb347, bad: 0xff5448, good: 0x58d66b, gold: 0xf2c94c, black: 0x000000,
};
// ACC-001: colour-blind palettes replace the red/green pairs and the team colours of the HUD (shapes differ as well).
// Health is near white in every palette: the blue/cyan armor and shield bars never share its hue (the bars keep their own colours).
const HUD_PALETTE_HEALTH = 0xf0f0f0;
const HUD_PALETTES = {
  off: null,
  protanopia: { good: 0x4aa3ff, bad: 0xffb000, health: HUD_PALETTE_HEALTH, healthLow: 0xffb000, teams: [0x3d8bff, 0xffb000] },
  deuteranopia: { good: 0x4aa3ff, bad: 0xffb000, health: HUD_PALETTE_HEALTH, healthLow: 0xffb000, teams: [0x3d8bff, 0xffb000] },
  tritanopia: { good: 0x4fe0d0, bad: 0xff4f7b, health: HUD_PALETTE_HEALTH, healthLow: 0xff4f7b, teams: [0x4fe0d0, 0xff4f7b] },
};

// One row per hideable element: setting hud.element.<id>. Accessibility aids are off until the player asks for them.
const HUD_ELEMENTS = [
  { id: 'crosshair', label: 'Crosshair' },
  { id: 'hitMarkers', label: 'Hit and kill markers' },
  { id: 'damageNumbers', label: 'Damage numbers', fallback: false },
  { id: 'vitals', label: 'Health, armor and shield bars' },
  { id: 'ammo', label: 'Ammo' },
  { id: 'weapons', label: 'Weapon bar' },
  { id: 'gadgets', label: 'Grenades and gadgets' },
  { id: 'abilities', label: 'Abilities and meter' },
  { id: 'money', label: 'Money' },
  { id: 'powerups', label: 'Active powerups' },
  { id: 'itemTimers', label: 'Item respawn timers', fallback: false },
  { id: 'damageArcs', label: 'Damage direction arcs' },
  { id: 'vignette', label: 'Low health vignette' },
  { id: 'header', label: 'Score, timer and round' },
  { id: 'killFeed', label: 'Kill feed' },
  { id: 'markers', label: 'Objective and ping markers' },
  { id: 'nameTags', label: 'Teammate name tags' },
  { id: 'banners', label: 'Announcer banners' },
  { id: 'respawnText', label: 'Respawn and spectate text' },
  { id: 'captions', label: 'Sound captions', fallback: false, category: 'accessibility' },
  { id: 'soundRing', label: 'Visual sound ring', fallback: false, category: 'accessibility' },
];

const HUD_SETTINGS = [
  { key: 'hud.show', fallback: true, label: 'Show HUD', category: 'hud' },
  { key: 'hud.scale', fallback: 100, label: 'HUD scale (%)', category: 'hud', min: HUD_SCALE_MIN, max: HUD_SCALE_MAX, step: 5 },
  { key: 'hud.opacity', fallback: 100, label: 'HUD opacity (%)', category: 'hud', min: HUD_OPACITY_MIN, max: 100, step: 5 },
  { key: 'hud.compact', fallback: 'auto', label: 'Compact HUD (phones)', category: 'hud', options: ['auto', 'on', 'off'], optionLabels: ['Auto', 'On', 'Off'] },
  { key: 'hud.teamShapes', fallback: true, label: 'Team shapes next to team colours', category: 'accessibility' },
];

for (const row of HUD_SETTINGS) {
  Settings.define(row.key, row.fallback, { label: row.label, category: row.category, min: row.min, max: row.max, step: row.step, options: row.options, optionLabels: row.optionLabels });
}
function defineHudElementSetting(row) {
  Settings.define('hud.element.' + row.id, row.fallback === undefined ? true : row.fallback, { label: row.label, category: row.category || 'hud' });
}
HUD_ELEMENTS.forEach(defineHudElementSetting);
// Later HUD files (17f) add their own hideable elements here, so the toggle, the cache and the settings screen follow.
function hudAddElement(row) {
  HUD_ELEMENTS.push(row);
  defineHudElementSetting(row);
}
// Hardcore HUD (X36, rules.fx.noHud) hides every element except these: aiming, earned feedback and accessibility aids stay.
const HUD_HARDCORE_KEEP = ['crosshair', 'hitMarkers', 'respawnText', 'captions', 'soundRing'];

// ---- Cached strings: numbers and times are drawn every frame, so their text is built once (zero allocation per frame) ----
const hudNumberText = Array.from({ length: HUD_NUMBER_CACHE }, (unused, index) => String(index));
const hudCountText = Array.from({ length: 100 }, (unused, index) => 'x' + index);
const hudTimeText = [];
const HUD_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const hudLargeNumberText = new Map();

function hudNumber(value) {
  const whole = Math.ceil(value);
  return whole >= 0 && whole < HUD_NUMBER_CACHE ? hudNumberText[whole] : hudLargeNumber(whole);
}
// A steady large value (core health, a contract score, range damage) is built once, not every frame; the map empties when full.
function hudLargeNumber(whole) {
  let text = hudLargeNumberText.get(whole);
  if (text !== undefined) return text;
  if (hudLargeNumberText.size >= HUD_LARGE_NUMBER_LIMIT) hudLargeNumberText.clear();
  text = String(whole);
  hudLargeNumberText.set(whole, text);
  return text;
}
function hudCount(value) { return value >= 0 && value < 100 ? hudCountText[value] : 'x' + value; }
function hudTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  let text = hudTimeText[whole];
  if (text === undefined) {
    const rest = whole % 60;
    text = Math.floor(whole / 60) + ':' + (rest < 10 ? '0' : '') + rest;
    hudTimeText[whole] = text;
  }
  return text;
}

// ---- The HUD object ----
const hudProjection = { x: 0, y: 0, depth: 0, distance: 0, onScreen: false, dirX: 0, dirY: 0 };
const hudFlashTimes = new Float64Array(HUD_FLASHES_PER_SECOND).fill(-1000);
const hudKeyLabels = new Map();

const Hud = {
  shown: true, replaying: false, scale: 1, opacity: 1, compactSetting: 'auto', teamShapes: true, reduceMotionSetting: 'auto', paletteId: 'off',
  noHud: false,                     // X36 Hardcore HUD in the running match
  photosensitive: false,            // ACC-005: screen flashes darken instead of brightening
  elements: {},                     // element id -> bool (cache of the hud.element.* settings)
  time: 0,                          // UI clock in seconds: advances every frame except while paused
  frameSeconds: 0,                  // length of the last frame (the killcam clock follows it)
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  colors: { good: HUD_COLOR.good, bad: HUD_COLOR.bad, health: HUD_COLOR.health, healthLow: HUD_COLOR.healthLow, teams: [0x3d8bff, 0xff4d4d] },
  layout: { width: 1, height: 1, unit: 1, margin: HUD_MARGIN, left: 0, right: 0, top: 0, bottom: 0, centerX: 0, centerY: 0, compact: false, touch: false,
    barWidth: 0, barHeight: 0, barGap: 0, vitalsHeight: 0, ammoRight: 0, ammoHeight: 0, abilityY: 0, powerupY: 0, gadgetY: 0, moneyY: 0, weaponBarY: 0 },
  drawers: { back: [], world: [], main: [], front: [] },
  stats: { quads: 0 },
  crosshairOverride: null,          // fn(weaponRow, out): per-weapon crosshair fields (17b fills it)
  project(x, y, z, out) { return hudProject(x, y, z, out || hudProjection); },

  // Registers a drawer. element: a HUD_ELEMENTS id whose toggle hides it, or '' for always on.
  // keepInHardcore: true for effects that are gameplay (flash, suppression) and must stay when the Hardcore HUD hides the rest.
  register(layer, id, element, draw, keepInHardcore) {
    this.drawers[layer].push({ id, element, draw, failed: false, quads: 0, hardcoreKeep: keepInHardcore === true || HUD_HARDCORE_KEEP.includes(element) });
  },
  enabled(element) { return this.elements[element] !== false; },
  visible() { return this.shown && Game.state === 'playing' && !!Game.match; },
  reduceMotion() {
    if (this.reduceMotionSetting === 'on') return true;
    return this.reduceMotionSetting === 'auto' && hudSystemReduceMotion;
  },
  // ACC-005: at most three screen flashes per second; the caller skips its flash when this says no.
  flashAllowed() {
    let oldest = 0;
    for (let i = 1; i < hudFlashTimes.length; i++) if (hudFlashTimes[i] < hudFlashTimes[oldest]) oldest = i;
    if (this.time - hudFlashTimes[oldest] < 1) return false;
    hudFlashTimes[oldest] = this.time;
    return true;
  },
  resetFlashes() { hudFlashTimes.fill(-1000); },
  // How a full-screen flash is drawn (ACC-005): photosensitivity darkens it instead of brightening and caps its strength; reduce motion halves it.
  flashColor(color) { return this.photosensitive ? HUD_COLOR.black : color; },
  flashAlpha(alpha) { return this.photosensitive ? Math.min(alpha, HUD_PHOTOSENSITIVE_ALPHA) : this.reduceMotion() ? alpha * HUD_REDUCED_FLASH : alpha; },
  teamColor(team) { return team < 0 ? HUD_FREE_FOR_ALL_COLOR : this.colors.teams[this.colorSlot(team) % this.colors.teams.length]; },
  // M20 squads: the player's own squad always has the first team colour and every other squad the second.
  colorSlot(team) { return Modes.squads.count > 0 ? (team === Actors.team[Game.playerId] ? 0 : 1) : team; },
  actorColor(id) { return Actors.team[id] >= 0 ? this.teamColor(Actors.team[id]) : this.colors.teams[id % this.colors.teams.length]; },
  teamShape(team) { return team < 0 ? 'circle' : HUD_TEAM_SHAPES[team % HUD_TEAM_SHAPES.length]; },
  // Display text of an input action for the device in use ('' = none bound); refreshed once a second.
  keyLabel(actionId) {
    let entry = hudKeyLabels.get(actionId);
    if (entry && this.time - entry.at < HUD_LABEL_REFRESH_SECONDS) return entry.text;
    if (!entry) { entry = { text: '', at: 0 }; hudKeyLabels.set(actionId, entry); }
    entry.text = Input.device === 'touch' ? '' : hudBoundLabel(actionId, Input.device);
    entry.at = this.time;
    return entry.text;
  },

  applySettings() {
    this.shown = Settings.get('hud.show');
    this.scale = Settings.get('hud.scale') / 100;
    this.opacity = Settings.get('hud.opacity') / 100;
    HudBatch.alphaScale = this.opacity;   // applied once per drawing call in setHudPaint (07f)
    this.compactSetting = Settings.get('hud.compact');
    this.teamShapes = Settings.get('hud.teamShapes');
    this.reduceMotionSetting = Settings.get('accessibility.reduceMotion');
    this.paletteId = Settings.get('accessibility.colorBlind');
    this.photosensitive = Settings.get('accessibility.photosensitive');
    this.noHud = !!(Game.match && Game.match.rules && Game.match.rules.fx && Game.match.rules.fx.noHud);
    for (const row of HUD_ELEMENTS) this.elements[row.id] = Settings.get('hud.element.' + row.id);
    this.refreshColors();
  },
  refreshColors() {
    const palette = HUD_PALETTES[this.paletteId], colors = this.colors;
    colors.good = palette ? palette.good : HUD_COLOR.good;
    colors.bad = palette ? palette.bad : HUD_COLOR.bad;
    colors.health = palette ? palette.health : HUD_COLOR.health;
    colors.healthLow = palette ? palette.healthLow : HUD_COLOR.healthLow;
    colors.teams.length = 0;
    const base = CAT.teamColors;
    for (let i = 0; i < base.length; i++) colors.teams.push(palette && palette.teams[i] !== undefined ? palette.teams[i] : colorNumber(base[i].color));
  },

  // Moves the UI clock and recomputes the layout for a screen size. Called once per frame by the first layer.
  beginFrame(seconds, width, height) {
    this.frameSeconds = seconds;
    if (!Game.paused) this.time += seconds;
    updateHudLayout(this.layout, width, height);
  },
  // Draws every drawer of a layer. A drawer that throws is logged once and switched off; the others keep running.
  drawLayer(layer, pen, seconds) {
    const list = this.drawers[layer], active = this.visible() && !(this.replaying && layer !== 'front');   // a replay shows only the front layer: the camera is not yours
    for (let i = 0; i < list.length; i++) {
      const drawer = list[i];
      drawer.quads = 0;
      if (!active || drawer.failed || (drawer.element && !this.elements[drawer.element]) || (this.noHud && !drawer.hardcoreKeep)) continue;
      const before = HudBatch.quads;
      try { drawer.draw(pen, this.layout, seconds); } catch (error) { drawer.failed = true; ErrorLog.add('hud ' + drawer.id, error); }
      drawer.quads = HudBatch.quads - before;
    }
  },
  // Quads drawn by the drawers of an element during the last frame (self-test: hidden elements draw nothing).
  quadsOf(element) {
    let total = 0;
    for (const layer in this.drawers) for (const drawer of this.drawers[layer]) if (drawer.element === element) total += drawer.quads;
    return total;
  },
};

// The label of an action's first bound key for a device ('Unbound' when none).
function hudBoundLabel(actionId, device) {
  const first = device === 'gamepad' ? 2 : 0, last = device === 'gamepad' ? 2 : 1;
  for (let slot = first; slot <= last; slot++) if (Input.getBinding(actionId, slot)) return Input.bindingLabel(Input.getBinding(actionId, slot));
  return Input.bindingLabel(Input.getBinding(actionId, first));
}

// ---- Layout: unit = design scale x the player's HUD scale; anchors for the stacks around the screen ----
function hudReadSafeInsets() {
  const probe = makeElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe), insets = Hud.insets;
  insets.top = parseFloat(style.paddingTop) || 0; insets.right = parseFloat(style.paddingRight) || 0;
  insets.bottom = parseFloat(style.paddingBottom) || 0; insets.left = parseFloat(style.paddingLeft) || 0;
  probe.remove();
}

function updateHudLayout(layout, width, height) {
  const insets = Hud.insets, touch = Input.device === 'touch';
  layout.width = width; layout.height = height; layout.touch = touch;
  layout.compact = Hud.compactSetting === 'on' || (Hud.compactSetting === 'auto' && (touch || height < HUD_COMPACT_HEIGHT));
  const unit = clamp(Math.min(width / HUD_DESIGN_WIDTH, height / HUD_DESIGN_HEIGHT), HUD_UNIT_MIN, HUD_UNIT_MAX) * Hud.scale;
  const margin = HUD_MARGIN * unit, compact = layout.compact;
  layout.unit = unit; layout.margin = margin;
  layout.left = insets.left + margin; layout.right = width - insets.right - margin;
  layout.top = insets.top + margin; layout.bottom = height - insets.bottom - margin;
  layout.centerX = width / 2; layout.centerY = height / 2;
  layout.barWidth = (compact ? 150 : 230) * unit; layout.barHeight = (compact ? 15 : 20) * unit; layout.barGap = (compact ? 3 : 5) * unit;
  layout.vitalsHeight = 3 * (layout.barHeight + layout.barGap);
  layout.abilityY = layout.bottom - layout.vitalsHeight - 28 * unit;
  layout.powerupY = layout.abilityY - 52 * unit;
  // Phones keep the button side free: the ammo panel sits bottom centre-left, centre-right in the left-handed touch preset.
  layout.ammoWidth = (compact ? 132 : 176) * unit; layout.ammoHeight = (compact ? 58 : 66) * unit;
  const centreGap = 6 * unit;
  layout.ammoRight = !touch ? layout.right : TouchInput.preset().mirror ? width * 0.5 + centreGap + layout.ammoWidth : width * 0.5 - centreGap;
  layout.gadgetY = layout.bottom - (compact ? 56 : 84) * unit;
  layout.moneyY = layout.gadgetY - (touch ? 34 + HUD_BAR_TOUCH_HEIGHT + HUD_BAR_GAP : 34) * unit;   // phones: above the weapon bar
  layout.weaponBarY = touch ? layout.bottom - layout.ammoHeight - HUD_BAR_GAP * unit : layout.bottom - 12 * unit;   // phones: the bar sits on the ammo panel
}

// World point -> screen pixels with the render camera (same maths as the renderer: Hor+ FOV at 16:9, yaw/pitch, no roll).
// Returns true when the point is in front of the camera and inside the screen; out.dirX/dirY point towards it either way.
function hudProject(x, y, z, out) {
  const camera = Render.camera, layout = Hud.layout;
  const dx = x - camera.x, dy = y - camera.y, dz = z - camera.z;
  const sinYaw = Math.sin(camera.yaw), cosYaw = Math.cos(camera.yaw), sinPitch = Math.sin(camera.pitch), cosPitch = Math.cos(camera.pitch);
  const depth = dx * sinYaw * cosPitch + dy * sinPitch + dz * cosYaw * cosPitch;
  const right = -dx * cosYaw + dz * sinYaw;
  const up = -dx * sinYaw * sinPitch + dy * cosPitch - dz * cosYaw * sinPitch;
  const tanHalf = Math.tan(verticalFov(camera.fov) / 2), aspect = layout.width / layout.height;
  out.depth = depth; out.distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  out.dirX = right; out.dirY = -up;
  const scale = depth > 0.001 ? 1 / (depth * tanHalf) : 0;
  const ndcX = right * scale / aspect, ndcY = up * scale;
  out.x = (ndcX * 0.5 + 0.5) * layout.width; out.y = (0.5 - ndcY * 0.5) * layout.height;
  out.onScreen = depth > 0.001 && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1;
  return out.onScreen;
}

// ---- The pen: HudBatch calls (the HUD opacity is applied by HudBatch.alphaScale), plus small shapes and bars ----
const HUD_WEAPON_ICONS = {   // rectangles [x, y, width, height] inside a 28 x 12 box
  melee: [[2, 5, 20, 2], [22, 3, 4, 6]], sidearm: [[8, 2, 14, 4], [8, 6, 5, 6]], smg: [[4, 3, 18, 4], [12, 7, 4, 5], [0, 3, 4, 3]],
  shotgun: [[0, 3, 7, 4], [7, 3, 21, 2], [10, 6, 10, 2]], rifle: [[0, 3, 6, 4], [6, 3, 18, 3], [24, 4, 4, 1], [10, 6, 4, 5]],
  marksman: [[0, 3, 6, 4], [6, 3, 18, 2], [24, 4, 4, 1], [12, 1, 6, 2]], sniper: [[0, 3, 7, 4], [7, 4, 21, 1], [11, 1, 8, 3]],
  energy: [[4, 2, 18, 6], [22, 3, 5, 4], [8, 8, 4, 3]], heavy: [[0, 3, 6, 5], [6, 2, 16, 6], [22, 4, 6, 2]],
  explosive: [[2, 2, 22, 6], [24, 3, 4, 4], [8, 8, 4, 3]], exotic: [[3, 2, 8, 8], [11, 4, 14, 4], [25, 3, 3, 6]],
  power: [[2, 3, 24, 6], [10, 0, 8, 3]], tool: [[4, 5, 20, 2], [2, 3, 6, 6]],
};
const HUD_ICON_WIDTH = 28, HUD_ICON_HEIGHT = 12;
const HUD_FALLBACK_ICON = HUD_WEAPON_ICONS.rifle;
const HUD_SHADOW_OFFSET = 1;
const HUD_SHADOW_ALPHA = 0.7;
const HUD_BAR_TRACK_ALPHA = 0.6;
const HUD_OCTAGON_SQUARE = 0.75, HUD_OCTAGON_TIP = 1.08;   // a disc's two squares: half-side and tip distance per radius

// x, y and half size of the next pen shape (HudPen.shapeAt). The shape helpers read it instead of taking float arguments,
// which are boxed per call where the call is not inlined (PERF-006: map dots, markers and pips are drawn every frame).
const hudShapeAt = new Float64Array(3);
// x, y, width, height of the next pen rectangle, panel or bar, and a bar's filled share (HudPen.rectAt, panelAt, barAt).
const hudBoxAt = new Float64Array(5);
const HUD_PANEL_ALPHA = 0.5;
// A square around hudShapeAt with half-width hudShapeAt[2], in the paint already set.
function pushHudSquare() {
  const at = hudShapeAt, corners = hudCorners;
  corners[0] = at[0] - at[2]; corners[1] = at[1] - at[2]; corners[2] = at[0] + at[2]; corners[3] = at[1] + at[2];
  pushHudBox();
}
// A diamond around hudShapeAt with its tips hudShapeAt[2] away, in the paint already set.
function pushHudDiamond() {
  const at = hudShapeAt, corners = hudCorners, x = at[0], y = at[1], tip = at[2];
  corners[0] = x; corners[1] = y - tip; corners[2] = x + tip; corners[3] = y; corners[4] = x; corners[5] = y + tip; corners[6] = x - tip; corners[7] = y;
  pushHudSolid();
}

const HudPen = {
  // The arguments pass through unchanged: a float computed here would be boxed on its way to HudBatch (PERF-006).
  rect(x, y, w, h, color, alpha) { HudBatch.rect(x, y, w, h, color, alpha); },
  line(x1, y1, x2, y2, thickness, color, alpha) { HudBatch.line(x1, y1, x2, y2, thickness, color, alpha); },
  ring(x, y, radius, thickness, color, alpha, start, end) { HudBatch.ring(x, y, radius, thickness, color, alpha, start, end); },
  text(string, x, y, size, color, align, alpha) { return HudBatch.text(string, x, y, size, color, align, alpha); },
  // Text with a one-pixel shadow: readable on any background (world markers, banners).
  label(string, x, y, size, color, align, alpha) {
    const at = hudTextAt;
    at[0] = x; at[1] = y; at[2] = size;
    this.labelAt(string, color, align, alpha);
    return at[3];
  },
  // label() at hudTextAt: the shadow is drawn from the same scratch, moved by the shadow offset and back.
  labelAt(string, color, align, alpha) {
    const at = hudTextAt, x = at[0], y = at[1], shade = HUD_SHADOW_OFFSET * Math.max(1, at[2] / 16);
    at[0] = x + shade; at[1] = y + shade;
    HudBatch.textAt(string, HUD_COLOR.black, align, (alpha === undefined ? 1 : alpha) * HUD_SHADOW_ALPHA);
    at[0] = x; at[1] = y;
    HudBatch.textAt(string, color, align, alpha);
  },
  // Dark backing panel behind a group of text.
  panel(x, y, w, h, alpha) { this.rect(x, y, w, h, HUD_COLOR.panel, alpha === undefined ? HUD_PANEL_ALPHA : alpha); },
  // Horizontal bar: dark track, coloured fill of `fraction` (0..1).
  bar(x, y, w, h, fraction, color, alpha) {
    const at = hudBoxAt;
    at[0] = x; at[1] = y; at[2] = w; at[3] = h; at[4] = fraction;
    this.barAt(color, alpha);
  },
  // Filled triangle: a quad with two equal corners.
  triangle(x0, y0, x1, y1, x2, y2, color, alpha) { this.quad(x0, y0, x1, y1, x2, y2, x2, y2, color, alpha); },
  // Corners straight into the HUD scratch (07f hudCorners): fourteen float arguments to a quad call were boxed per shape (PERF-006).
  quad(x0, y0, x1, y1, x2, y2, x3, y3, color, alpha) {
    const corners = hudCorners;
    corners[0] = x0; corners[1] = y0; corners[2] = x1; corners[3] = y1; corners[4] = x2; corners[5] = y2; corners[6] = x3; corners[7] = y3;
    setHudPaint(color, alpha);
    pushHudSolid();
  },
  // Team and marker icons that differ by shape, not only by colour (ACC-001). size = width in pixels.
  shape(kind, x, y, size, color, alpha) {
    const at = hudShapeAt;
    at[0] = x; at[1] = y; at[2] = size / 2;
    this.shapeAt(kind, color, alpha);
  },
  // shape() at hudShapeAt (x, y, half size): the form for drawers that place many shapes (no float arguments).
  // 'circle' (and any other kind) is a disc from two squares, one turned 45 degrees: two quads instead of a 48-segment ring.
  shapeAt(kind, color, alpha) {
    const at = hudShapeAt, half = at[2];
    setHudPaint(color, alpha);
    if (kind === 'square') { pushHudSquare(); return; }
    if (kind === 'diamond') { pushHudDiamond(); return; }
    if (kind === 'triangle') {
      const corners = hudCorners;
      corners[0] = at[0]; corners[1] = at[1] - half; corners[2] = at[0] + half; corners[3] = at[1] + half;
      corners[4] = corners[6] = at[0] - half; corners[5] = corners[7] = at[1] + half;
      pushHudSolid();
      return;
    }
    at[2] = half * HUD_OCTAGON_SQUARE; pushHudSquare();
    at[2] = half * HUD_OCTAGON_TIP; pushHudDiamond();
    at[2] = half;
  },
  octagon(x, y, radius, color, alpha) { this.shape('circle', x, y, radius * 2, color, alpha); },
  // ---- Scratch forms (PERF-006): the drawer fills hudBoxAt, hudShapeAt, hudTextAt (07f) or hudRingAt (07f) and passes only
  // the colour, align and alpha. The once-per-frame drawers run in the middle compiler tier for most of a match, which boxes
  // every float argument of a call it does not inline (3-4 per pen call).
  rectAt(color, alpha) {
    const at = hudBoxAt, corners = hudCorners;
    corners[0] = at[0]; corners[1] = at[1]; corners[2] = at[0] + at[2]; corners[3] = at[1] + at[3];
    setHudPaint(color, alpha);
    pushHudBox();
  },
  panelAt(alpha) { this.rectAt(HUD_COLOR.panel, alpha === undefined ? HUD_PANEL_ALPHA : alpha); },
  // A bar at hudBoxAt: the dark track, then the fill of share hudBoxAt[4] (0..1).
  barAt(color, alpha) {
    const at = hudBoxAt, width = at[2];
    this.rectAt(HUD_COLOR.track, HUD_BAR_TRACK_ALPHA * (alpha === undefined ? 1 : alpha));
    at[2] = width * Math.min(1, Math.max(0, at[4]));
    if (at[2] > 0) this.rectAt(color, alpha);
    at[2] = width;
  },
  textAt(string, color, align, alpha) { HudBatch.textAt(string, color, align, alpha); },
  ringAt(color, alpha) { HudBatch.ringAt(color, alpha); },
  weaponIcon(weaponClass, x, y, width, color, alpha) {
    const at = hudShapeAt;
    at[0] = x; at[1] = y; at[2] = width / 2;
    this.weaponIconAt(weaponClass, color, alpha);
  },
  // weaponIcon() centred on hudShapeAt, hudShapeAt[2] * 2 wide.
  weaponIconAt(weaponClass, color, alpha) {
    const at = hudShapeAt, width = at[2] * 2, parts = HUD_WEAPON_ICONS[weaponClass] || HUD_FALLBACK_ICON, scale = width / HUD_ICON_WIDTH;
    const left = at[0] - width / 2, top = at[1] - (HUD_ICON_HEIGHT * scale) / 2, corners = hudCorners;
    setHudPaint(color, alpha);
    for (let i = 0; i < parts.length; i++) {   // each part straight into the corner scratch (no four floats per pen.rect call)
      const part = parts[i];
      corners[0] = left + part[0] * scale; corners[1] = top + part[1] * scale;
      corners[2] = corners[0] + part[2] * scale; corners[3] = corners[1] + part[3] * scale;
      pushHudBox();
    }
  },
};
Hud.pen = HudPen;

// ---- Layers: one HudBatch layer (one draw call) per entry of HUD_LAYERS ----
function registerHudLayers() {
  HUD_LAYERS.forEach(([name, order], index) => {
    HudBatch.addLayer('hud.' + name, order, (batch, seconds) => {
      if (index === 0) Hud.beginFrame(seconds, batch.width, batch.height);
      Hud.drawLayer(name, HudPen, seconds);
      if (index === HUD_LAYERS.length - 1) Hud.stats.quads = batch.quads;
    });
  });
}
registerHudLayers();

// The system's reduce-motion preference is read once and kept current by the media query (no query object per frame).
let hudSystemReduceMotion = false;
// A change while the game runs is announced like the setting itself, so every owner (HUD, menus, view effects) re-reads reduce motion.
function hudSetSystemMotion(reduce) {
  hudSystemReduceMotion = reduce;
  Bus.emit('setting', 'accessibility.reduceMotion');
}
function hudWatchSystemMotion() {
  if (!window.matchMedia) return;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  hudSystemReduceMotion = query.matches;
  query.addEventListener('change', (event) => hudSetSystemMotion(event.matches));
}

Bus.on('boot', () => {
  if (Game.headless) return;
  hudReadSafeInsets();
  hudWatchSystemMotion();
  window.addEventListener('resize', hudReadSafeInsets);
  window.addEventListener('orientationchange', hudReadSafeInsets);
});
Bus.on('setting', (key) => { if (typeof key === 'string' && (key.startsWith('hud.') || key.startsWith('accessibility.'))) Hud.applySettings(); });
Bus.on('boot', () => Hud.applySettings());
Bus.on('match.start', () => { Hud.applySettings(); Hud.resetFlashes(); });

// ---- Player status panels ----
function hudLocalAlive() { return Game.playerId >= 0 && Actors.alive[Game.playerId] === 1; }

// One bar of the health stack, `row` bars up from the bottom. It reads the player's value and maximum from the stat arrays
// and draws through the pen's scratch forms: the drawers pass no float to a call (PERF-006).
function hudDrawVitalBar(pen, layout, row, values, maximums, color, glyph) {
  const id = Game.playerId, value = values[id], maximum = maximums[id];
  const unit = layout.unit, width = layout.barWidth, height = layout.barHeight, x = layout.left;
  const top = layout.bottom - height - row * (height + layout.barGap), fraction = maximum > 0 ? value / maximum : 0;
  const pulse = fraction < LOW_HEALTH_FRACTION && glyph === '♥' && !Hud.reduceMotion() ? 0.78 + 0.22 * Math.sin(Hud.time * Math.PI * 2 * HUD_PULSE_HZ) : 1;
  const box = hudBoxAt, text = hudTextAt;
  box[0] = x; box[1] = top; box[2] = width; box[3] = height; box[4] = fraction;
  pen.barAt(color, pulse);
  if (value > maximum && maximum > 0) { box[3] = Math.max(2, unit * 2); pen.rectAt(HUD_COLOR.gold, 1); }   // overheal
  text[0] = x + 6 * unit; text[1] = top + height / 2; text[2] = height * 0.78;
  pen.textAt(glyph, HUD_COLOR.text, 'left', 0.9);
  text[0] = x + width - 6 * unit;
  pen.textAt(hudNumber(value), HUD_COLOR.text, 'right');
}

function hudDrawVitals(pen, layout) {
  const id = Game.playerId;
  if (!hudLocalAlive()) return;
  const fraction = Actors.maxHealth[id] > 0 ? Actors.health[id] / Actors.maxHealth[id] : 1;
  let row = 0;
  hudDrawVitalBar(pen, layout, row++, Actors.health, Actors.maxHealth, fraction < LOW_HEALTH_FRACTION ? Hud.colors.healthLow : Hud.colors.health, '♥');
  if (Actors.maxArmor[id] > 0 || Actors.armor[id] > 0) hudDrawVitalBar(pen, layout, row++, Actors.armor, Actors.maxArmor, HUD_COLOR.armor, '▲');
  if (Actors.maxShield[id] > 0 || Actors.shield[id] > 0) hudDrawVitalBar(pen, layout, row, Actors.shield, Actors.maxShield, HUD_COLOR.shield, '●');
}

const hudReloadState = { active: false, progress: 0 };
function hudReadReload(id) {
  const reloading = Weapons.state[id] === WEAPON_STATE.RELOAD && Weapons.stateDuration[id] > 0;
  hudReloadState.active = reloading;
  hudReloadState.progress = reloading ? Weapons.stateTime[id] / Weapons.stateDuration[id] : 0;
  return hudReloadState;
}

// The warning under the magazine: reloading, empty, or running low. Returns the text and colour through hudAmmoWarning.
const hudAmmoWarning = { text: '', color: HUD_COLOR.warn };
function hudReadAmmoWarning(id, weapon, ammo, reload) {
  const warning = hudAmmoWarning;
  warning.text = ''; warning.color = HUD_COLOR.warn;
  if (reload.active) { warning.text = 'RELOADING'; return warning; }
  if (ammo.infinite) return warning;
  if (ammo.magazine === 0 && ammo.reserve === 0) { warning.text = 'NO AMMO'; warning.color = Hud.colors.bad; return warning; }
  if (ammo.magazine === 0) { warning.text = 'RELOAD'; warning.color = Hud.colors.bad; return warning; }
  if (ammo.magazine <= Math.max(1, Weapons.magSize(id, weapon) * HUD_LOW_AMMO)) warning.text = 'LOW AMMO';
  return warning;
}

function hudDrawAmmo(pen, layout) {
  const id = Game.playerId;
  if (!hudLocalAlive()) return;
  const weapon = Weapons.currentWeapon(id), ammo = Weapons.ammo(id);
  if (!weapon || !ammo) return;
  const unit = layout.unit, compact = layout.compact;
  const width = layout.ammoWidth, height = layout.ammoHeight, right = layout.ammoRight, left = right - width, top = layout.bottom - height;
  const box = hudBoxAt, text = hudTextAt;   // the pen's scratch forms: no float arguments (PERF-006)
  box[0] = left; box[1] = top; box[2] = width; box[3] = height;
  pen.panelAt();
  text[0] = left + 8 * unit; text[1] = top + HUD_TEXT_SMALL * unit; text[2] = 14 * unit;
  pen.textAt(weapon.name, HUD_COLOR.dim, 'left');
  if (weapon.mag === 0) return;
  const reload = hudReadReload(id), warning = hudReadAmmoWarning(id, weapon, ammo, reload);
  const blink = warning.text && !reload.active && !Hud.reduceMotion() ? 0.65 + 0.35 * Math.sin(Hud.time * Math.PI * 2 * HUD_PULSE_HZ) : 1;
  const lowColor = warning.text && !reload.active ? warning.color : HUD_COLOR.text;
  text[1] = top + height * 0.64; text[2] = (compact ? 28 : 38) * unit;
  pen.textAt(hudNumber(ammo.magazine), lowColor, 'left', blink);
  text[0] = right - 8 * unit; text[1] = top + height * 0.7; text[2] = (ammo.infinite ? 16 : 18) * unit;
  pen.textAt(ammo.infinite ? 'INF' : hudNumber(ammo.reserve), HUD_COLOR.dim, 'right');
  text[1] = top + HUD_TEXT_SMALL * unit; text[2] = HUD_TEXT_SMALL * unit;
  if (warning.text) pen.textAt(warning.text, warning.color, 'right', blink);
  box[1] = top + height - 4 * unit; box[3] = 4 * unit; box[4] = reload.progress;
  if (reload.active) pen.barAt(HUD_COLOR.warn);
}

// Owned weapons ordered by slot (then catalogue order) into a reused array; returns the count.
const hudOwned = new Int16Array(WEAPON_COUNT);
function hudCollectOwnedWeapons(id) {
  let count = 0;
  for (let index = 0; index < WEAPON_COUNT; index++) {
    if (!Weapons.owned[Weapons.slotIndex(id, index)]) continue;
    let place = count++;
    while (place > 0 && CAT.weapons[hudOwned[place - 1]].slot > CAT.weapons[index].slot) { hudOwned[place] = hudOwned[place - 1]; place--; }
    hudOwned[place] = index;
  }
  return count;
}

// Fills hudBoxAt with weapon bar entry `index` of `count`: bottom centre, on a phone centred on the ammo panel (slot buttons).
function hudPlaceWeaponBox(layout, count, index) {
  const unit = layout.unit, box = hudBoxAt, width = (layout.touch ? HUD_BAR_TOUCH_WIDTH : HUD_BAR_WIDTH) * unit, gap = HUD_BAR_GAP * unit;
  const centre = layout.touch ? layout.ammoRight - layout.ammoWidth / 2 : layout.centerX;
  box[2] = width; box[3] = (layout.touch ? HUD_BAR_TOUCH_HEIGHT : 26) * unit;
  box[0] = centre - (count * (width + gap) - gap) / 2 + index * (width + gap);
  box[1] = layout.weaponBarY - box[3];
}

function hudDrawWeaponBar(pen, layout) {
  const id = Game.playerId;
  if (!hudLocalAlive() || (layout.compact && !layout.touch)) return;
  const count = Math.min(hudCollectOwnedWeapons(id), HUD_MAX_WEAPON_SLOTS);
  if (count < 2) return;
  const unit = layout.unit;
  const selected = Weapons.state[id] === WEAPON_STATE.SWAP ? Weapons.pending[id] : Weapons.current[id];
  const box = hudBoxAt, shape = hudShapeAt, text = hudTextAt;   // the pen's scratch forms: no float arguments (PERF-006)
  for (let i = 0; i < count; i++) {
    const weapon = CAT.weapons[hudOwned[i]], isSelected = hudOwned[i] === selected;
    hudPlaceWeaponBox(layout, count, i);
    const x = box[0], top = box[1], boxWidth = box[2], boxHeight = box[3];
    pen.panelAt(isSelected ? 0.8 : 0.45);
    shape[0] = x + boxWidth / 2; shape[1] = top + boxHeight / 2 + 2 * unit; shape[2] = boxWidth * 0.62 / 2;
    pen.weaponIconAt(weapon.class, isSelected ? HUD_COLOR.text : HUD_COLOR.dim);
    text[0] = x + 4 * unit; text[1] = top + 8 * unit; text[2] = HUD_TEXT_SMALL * unit;
    pen.textAt(hudNumber(weapon.slot), HUD_COLOR.dim, 'left');
    box[1] = top + boxHeight - 3 * unit; box[3] = 3 * unit;
    if (isSelected) pen.rectAt(HUD_COLOR.gold);
  }
}

// The weapon slot (1..9) of the bar box under a touch at (x, y), else 0.
function hudWeaponSlotAt(x, y) {
  const layout = Hud.layout, id = Game.playerId, box = hudBoxAt;
  if (!layout.touch || !Hud.visible() || Hud.noHud || !Hud.elements.weapons || !hudLocalAlive()) return 0;
  const count = Math.min(hudCollectOwnedWeapons(id), HUD_MAX_WEAPON_SLOTS);
  if (count < 2) return 0;
  for (let i = 0; i < count; i++) {
    hudPlaceWeaponBox(layout, count, i);
    if (x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3]) return CAT.weapons[hudOwned[i]].slot;
  }
  return 0;
}
TouchInput.weaponSlotAt = hudWeaponSlotAt;

// Cooldown / charge ring around a point: dim track, bright remaining arc (remaining 0 = ready = full bright ring).
function hudDrawCooldownRing(pen, x, y, radius, thickness, remaining, color) {
  const at = hudRingAt;
  at[0] = x; at[1] = y; at[2] = radius; at[3] = thickness;
  hudDrawCooldownRingAt(pen, remaining, color);
}
// The cooldown ring at hudRingAt (07f: x, y, radius and thickness set by the caller; the angles are set here).
function hudDrawCooldownRingAt(pen, remaining, color) {
  const at = hudRingAt;
  at[4] = 0; at[5] = Math.PI * 2;
  if (remaining <= 0) { pen.ringAt(color, 1); return; }       // ready: one full ring, no track under it
  pen.ringAt(HUD_COLOR.track, 0.8);
  at[5] = Math.PI * 2 * (1 - Math.min(1, Math.max(0, remaining)));
  pen.ringAt(HUD_COLOR.dim, 0.7);
}

const hudGadgetState = { grenade: '', grenadeCount: 0, gadget: '', gadgetCount: 0, gadgetCooldown: 0 };
function hudDrawGadgets(pen, layout) {
  if (!hudLocalAlive()) return;
  const state = Gadgets.hudState(Game.playerId, hudGadgetState), unit = layout.unit;
  let slot = 0;   // icons from the right, 74 units apart (a slot index: x as a float argument would be boxed, PERF-006)
  if (state.gadget || state.gadgetCount > 0) {
    hudPlaceGadgetSlot(layout, slot++, 11);
    hudDrawCooldownRingAt(pen, state.gadgetCooldown, Hud.colors.good);
    pen.shapeAt('diamond', HUD_COLOR.text);
    pen.textAt(hudCount(state.gadgetCount), HUD_COLOR.text, 'right');
  }
  if (state.grenade || state.grenadeCount > 0) {
    hudPlaceGadgetSlot(layout, slot++, 13);
    hudTextAt[0] += 8 * unit;   // the grenade count sits closer to its disc
    pen.shapeAt('circle', state.grenadeCount > 0 ? HUD_COLOR.text : HUD_COLOR.dim);
    pen.textAt(hudCount(state.grenadeCount), HUD_COLOR.text, 'right');
  }
  hudDrawConsumables(pen, layout, slot);
}
// Fills the scratch arrays for gadget slot `slot`: its ring, its icon (`iconSize` units wide) and its count to the left.
function hudPlaceGadgetSlot(layout, slot, iconSize) {
  const unit = layout.unit, x = layout.ammoRight - (14 + slot * 74) * unit, y = layout.gadgetY;
  hudRingAt[0] = x; hudRingAt[1] = y; hudRingAt[2] = 14 * unit; hudRingAt[3] = 3 * unit;
  hudShapeAt[0] = x; hudShapeAt[1] = y; hudShapeAt[2] = iconSize * unit / 2;
  hudTextAt[0] = x - 22 * unit; hudTextAt[1] = y; hudTextAt[2] = 15 * unit;
}
// Carried loot consumables (I13..I17) with the heal key; a ring fills while one is in use.
function hudDrawConsumables(pen, layout, slot) {
  const count = Items.consumableCount(Game.playerId), progress = Items.useProgress(Game.playerId);
  if (count <= 0 && progress < 0) return;
  hudPlaceGadgetSlot(layout, slot, 11);
  if (progress >= 0) hudDrawCooldownRingAt(pen, 1 - progress, Hud.colors.good);
  pen.shapeAt('square', HUD_COLOR.text);
  pen.textAt(hudCount(count), HUD_COLOR.text, 'right');
  const text = hudTextAt, unit = layout.unit;
  text[0] = hudShapeAt[0]; text[1] = layout.gadgetY + 22 * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt(Hud.keyLabel('heal'), HUD_COLOR.dim, 'center');
}

const hudAbilityState = { slots: [], meter: { kind: 'none', value: 0, ready: false } };
function hudDrawAbilities(pen, layout) {
  if (!hudLocalAlive()) return;
  const state = Abilities.hudState(Game.playerId, hudAbilityState), unit = layout.unit, radius = 17 * unit;
  const slotCount = Math.min(state.slots.length, HUD_MAX_ABILITY_SLOTS);
  const ring = hudRingAt, text = hudTextAt;   // the pen's scratch forms: no float arguments (PERF-006)
  for (let i = 0; i < slotCount; i++) {
    const slot = state.slots[i], x = layout.left + radius + i * (radius * 2 + 16 * unit), y = layout.abilityY;
    ring[0] = x; ring[1] = y; ring[2] = radius; ring[3] = 4 * unit;
    hudDrawCooldownRingAt(pen, slot.ready ? 0 : slot.cooldown, slot.active ? HUD_COLOR.gold : Hud.colors.good);
    text[0] = x; text[1] = y; text[2] = HUD_TEXT_SMALL * unit;
    pen.textAt(slot.name, slot.ready ? HUD_COLOR.text : HUD_COLOR.dim, 'center');
    text[1] = y + radius + 10 * unit;
    pen.textAt(Hud.keyLabel(slot.key), HUD_COLOR.dim, 'center');   // slots are packed (empty ones skipped): the key comes with the slot
    text[0] = x + radius; text[1] = y - radius;
    if (slot.charges > 1) pen.textAt(hudNumber(slot.charges), HUD_COLOR.gold, 'center');
  }
  if (state.meter.kind !== 'none') hudDrawMeter(pen, layout, state.meter, slotCount);
}

function hudDrawMeter(pen, layout, meter, slotCount) {
  const unit = layout.unit, width = 150 * unit, height = 9 * unit;
  const x = layout.left + (slotCount ? slotCount * (34 + 16) * unit + 8 * unit : 0), y = layout.abilityY - height / 2;
  const box = hudBoxAt, text = hudTextAt;
  box[0] = x; box[1] = y; box[2] = width; box[3] = height; box[4] = meter.value;
  pen.barAt(meter.ready ? HUD_COLOR.gold : Hud.colors.good);
  text[1] = y - HUD_TEXT_SMALL * unit; text[2] = HUD_TEXT_SMALL * unit;
  if (meter.ready) {
    text[0] = x + width / 2;
    pen.textAt('READY', HUD_COLOR.gold, 'center');
    return;
  }
  text[0] = x + width - 14 * unit;
  pen.textAt(hudNumber(meter.value * 100), HUD_COLOR.dim, 'right');
  text[0] = x + width - HUD_TEXT_SMALL * unit;
  pen.textAt('%', HUD_COLOR.dim, 'left');
}

const hudMoneyState = { money: 0, nextRoundMoney: 0, canBuy: false, buyTimeLeft: 0 };
function hudDrawMoney(pen, layout) {
  if (!hudLocalAlive()) return;
  const state = Economy.hudState(Game.playerId, hudMoneyState), rules = Game.match.rules;
  const usesMoney = !!rules && HUD_MONEY_ECONOMIES.includes(rules.economy);
  if (!usesMoney && state.money <= 0 && state.nextRoundMoney <= 0 && !state.canBuy) return;
  const unit = layout.unit, right = layout.ammoRight, width = 150 * unit, height = 30 * unit, left = right - width, top = layout.moneyY - height / 2;
  const box = hudBoxAt, text = hudTextAt;   // the pen's scratch forms: no float arguments (PERF-006)
  box[0] = left; box[1] = top; box[2] = width; box[3] = height;
  pen.panelAt();
  text[0] = left + 8 * unit; text[1] = top + height / 2; text[2] = 20 * unit;
  pen.textAt('$', HUD_COLOR.gold, 'left');
  text[0] = right - 8 * unit;
  pen.textAt(hudNumber(state.money), HUD_COLOR.text, 'right');
  text[0] = left - 8 * unit; text[2] = 16 * unit;
  if (state.canBuy) pen.textAt(hudTime(state.buyTimeLeft), HUD_COLOR.warn, 'right');
}

const hudPowerups = [];
function hudDrawPowerups(pen, layout) {
  if (!hudLocalAlive()) return;
  const count = Math.min(Items.activePowerups(Game.playerId, hudPowerups), HUD_MAX_POWERUP_CHIPS), unit = layout.unit;
  const box = hudBoxAt, shape = hudShapeAt, text = hudTextAt;   // the pen's scratch forms: no float arguments (PERF-006)
  for (let i = 0; i < count; i++) {
    const powerup = hudPowerups[i], y = layout.powerupY - i * 22 * unit, x = layout.left;
    const color = colorNumber(powerup.color || HUD_COLOR.gold), share = powerup.remaining / Math.max(powerup.duration, 0.001);
    box[0] = x; box[1] = y - 9 * unit; box[2] = 150 * unit; box[3] = 18 * unit;
    pen.panelAt(0.5);
    shape[0] = x + 9 * unit; shape[1] = y; shape[2] = 9 * unit / 2;
    pen.shapeAt('square', color);
    text[0] = x + 20 * unit; text[1] = y; text[2] = HUD_TEXT_SMALL * unit;
    pen.textAt(powerup.name, HUD_COLOR.text, 'left');
    text[0] = x + 144 * unit;
    pen.textAt(hudNumber(powerup.remaining), HUD_COLOR.dim, 'right');
    box[1] = y + 8 * unit; box[2] = 150 * unit * Math.min(1, Math.max(0, share)); box[3] = 2 * unit;
    pen.rectAt(color, 0.9);
  }
}

Hud.register('main', 'vitals', 'vitals', hudDrawVitals);
Hud.register('main', 'ammo', 'ammo', hudDrawAmmo);
Hud.register('main', 'weapons', 'weapons', hudDrawWeaponBar);
Hud.register('main', 'gadgets', 'gadgets', hudDrawGadgets);
Hud.register('main', 'abilities', 'abilities', hudDrawAbilities);
Hud.register('main', 'money', 'money', hudDrawMoney);
Hud.register('main', 'powerups', 'powerups', hudDrawPowerups);
