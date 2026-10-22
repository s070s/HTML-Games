// ==== S17 HUD: COMBAT FEEDBACK ====
// Crosshair editor (UI-004: style, size, gap, thickness, outline, colour, dot, spread-aware, per-weapon override), scope overlay,
// hit and kill markers (UI-005), damage numbers stacked per target, damage direction arcs and the low-health vignette.
// Everything is drawn through the pen of 17a; events write into fixed typed-array rings (no allocation per frame).

const HUD_CROSSHAIR_STYLES = ['cross', 'dot', 'circle', 'tee', 'chevron'];
const HUD_CROSSHAIR_COLORS = { white: 0xffffff, green: 0x58f070, cyan: 0x46e6f0, yellow: 0xfff04a, red: 0xff4d4d, magenta: 0xff5cf0 };
const HUD_CROSSHAIR_COLOR_NAMES = Object.keys(HUD_CROSSHAIR_COLORS);
const HUD_CROSSHAIR_FIELDS = ['style', 'size', 'gap', 'thickness', 'outline', 'color', 'dot', 'dynamic', 'hidden'];
const HUD_CROSSHAIR_SETTINGS = [
  { key: 'hud.crosshair.style', fallback: 'cross', label: 'Crosshair style', options: HUD_CROSSHAIR_STYLES, optionLabels: ['Cross', 'Dot', 'Circle', 'T', 'Chevron'] },
  { key: 'hud.crosshair.size', fallback: 9, label: 'Crosshair size', min: 2, max: 30, step: 1 },
  { key: 'hud.crosshair.gap', fallback: 4, label: 'Crosshair gap', min: 0, max: 16, step: 1 },
  { key: 'hud.crosshair.thickness', fallback: 2, label: 'Crosshair thickness', min: 1, max: 6, step: 1 },
  { key: 'hud.crosshair.outline', fallback: true, label: 'Crosshair outline' },
  { key: 'hud.crosshair.color', fallback: 'white', label: 'Crosshair colour', options: HUD_CROSSHAIR_COLOR_NAMES, optionLabels: ['White', 'Green', 'Cyan', 'Yellow', 'Red', 'Magenta'] },
  { key: 'hud.crosshair.dot', fallback: false, label: 'Crosshair centre dot' },
  { key: 'hud.crosshair.dynamic', fallback: true, label: 'Crosshair grows with weapon spread' },
  { key: 'hud.scopeOverlay', fallback: true, label: 'Scope overlay when zoomed in' },
];
for (const row of HUD_CROSSHAIR_SETTINGS) {
  Settings.define(row.key, row.fallback, { label: row.label, category: 'hud', min: row.min, max: row.max, step: row.step, options: row.options, optionLabels: row.optionLabels });
}

// Weapon classes with their own default crosshair (data, UI-004 per-weapon override); a player override is laid over these.
const HUD_CLASS_CROSSHAIRS = {
  melee: { hidden: true },
  shotgun: { style: 'circle', size: 14, gap: 6 },
  explosive: { style: 'circle', size: 10, gap: 5 },
  sniper: { style: 'dot', dynamic: false },
  marksman: { style: 'tee', dynamic: false },
};
const HUD_SCOPE_ZOOM_MIN = 2.5;           // weapons zooming at least this much show the scope overlay
const HUD_SCOPE_RADIUS = 0.42;            // of the screen height
const HUD_SPREAD_MAX_PIXELS = 160;
const HUD_SPREAD_RISE = 30, HUD_SPREAD_FALL = 10;   // 1/s smoothing of the dynamic gap
const HUD_OUTLINE_ALPHA = 0.6;

const HUD_HIT_SECONDS = 0.22, HUD_KILL_SECONDS = 0.5;
const HUD_HIT_GAP = 7, HUD_HIT_LENGTH = 8, HUD_KILL_GAP = 9, HUD_KILL_LENGTH = 13;
const HUD_HIT_KINDS = ['hit', 'melee', 'beam', 'splash'];   // damage kinds that count as a hit on a target (not burning, falling)

const HUD_NUMBER_SLOTS = 8, HUD_NUMBER_SECONDS = 0.9, HUD_NUMBER_STACK_SECONDS = 0.7, HUD_NUMBER_RISE = 46;
const HUD_ARC_SLOTS = 6, HUD_ARC_SECONDS = 1.4, HUD_ARC_RADIUS = 112, HUD_ARC_HALF_WIDTH = 0.3, HUD_ARC_THICKNESS = 9;
const HUD_VIGNETTE_STRENGTH = 0.55;
const HUD_VIGNETTE_LAYERS = 5;
const HUD_VIGNETTE_EDGE = 0.18;           // of the shorter screen side
const HUD_HIT_FLASH = { seconds: 0.35, alpha: 0.16 };

// ---- State (rings of typed arrays) ----
const HudCombat = {
  hitAt: -1000, hitHead: false, killAt: -1000, flashAt: -1000,
  numberTarget: new Int16Array(HUD_NUMBER_SLOTS).fill(-1), numberAmount: new Float32Array(HUD_NUMBER_SLOTS), numberAt: new Float64Array(HUD_NUMBER_SLOTS).fill(-1000),
  numberX: new Float32Array(HUD_NUMBER_SLOTS), numberY: new Float32Array(HUD_NUMBER_SLOTS), numberZ: new Float32Array(HUD_NUMBER_SLOTS),
  numberHead: new Uint8Array(HUD_NUMBER_SLOTS), numberNext: 0,
  arcAt: new Float64Array(HUD_ARC_SLOTS).fill(-1000), arcX: new Float32Array(HUD_ARC_SLOTS), arcZ: new Float32Array(HUD_ARC_SLOTS),
  arcSource: new Int16Array(HUD_ARC_SLOTS).fill(-1), arcNext: 0,
  spread: 0,
  base: { style: 'cross', size: 9, gap: 4, thickness: 2, outline: true, color: 'white', dot: false, dynamic: true, hidden: false },
  live: { style: 'cross', size: 9, gap: 4, thickness: 2, outline: true, color: 'white', dot: false, dynamic: true, hidden: false },

  reset() {
    this.hitAt = this.killAt = this.flashAt = -1000;
    this.numberAt.fill(-1000); this.numberTarget.fill(-1); this.arcAt.fill(-1000); this.arcSource.fill(-1);
    this.spread = 0;
  },
  readSettings() {
    const base = this.base;
    base.style = Settings.get('hud.crosshair.style'); base.size = Settings.get('hud.crosshair.size'); base.gap = Settings.get('hud.crosshair.gap');
    base.thickness = Settings.get('hud.crosshair.thickness'); base.outline = Settings.get('hud.crosshair.outline'); base.color = Settings.get('hud.crosshair.color');
    base.dot = Settings.get('hud.crosshair.dot'); base.dynamic = Settings.get('hud.crosshair.dynamic');
    base.hidden = false;
    this.scopeOverlay = Settings.get('hud.scopeOverlay');
  },
  scopeOverlay: true,
};

// The default per-weapon hook: the class table, then the player's own override for this weapon (Save.data.crosshairs[weaponId]).
function hudDefaultCrosshairOverride(weapon, out) {
  hudApplyCrosshairFields(out, HUD_CLASS_CROSSHAIRS[weapon.class]);
  hudApplyCrosshairFields(out, Save.data && Save.data.crosshairs ? Save.data.crosshairs[weapon.id] : null);
}
function hudApplyCrosshairFields(out, fields) {
  if (!fields) return;
  for (let i = 0; i < HUD_CROSSHAIR_FIELDS.length; i++) {
    const field = HUD_CROSSHAIR_FIELDS[i];
    if (fields[field] !== undefined) out[field] = fields[field];
  }
}
Hud.crosshairOverride = hudDefaultCrosshairOverride;

// Player override for one weapon (fields from HUD_CROSSHAIR_FIELDS); null removes it. Saved with the game.
Hud.setCrosshairOverride = function setCrosshairOverride(weaponId, fields) {
  if (!Save.data.crosshairs) Save.data.crosshairs = {};
  if (fields) Save.data.crosshairs[weaponId] = Object.assign({}, fields); else delete Save.data.crosshairs[weaponId];
  Save.scheduleSave();
};
Hud.crosshairFor = function crosshairFor(weapon) {
  const live = HudCombat.live;
  hudApplyCrosshairFields(live, HudCombat.base);
  if (weapon && Hud.crosshairOverride) Hud.crosshairOverride(weapon, live);
  return live;
};

// Pixels the shot cone covers at the crosshair: tan(spread) against the vertical FOV.
function hudCrosshairSpread(id, weapon, layout) {
  const mode = weapon.primary;
  if (!mode) return 0;
  const degrees = Weapons.spreadDegrees(id, weapon, mode);
  const halfFov = verticalFov(Render.camera.fov) / 2;
  return Math.min(HUD_SPREAD_MAX_PIXELS * layout.unit, Math.tan(degrees * DEG) / Math.tan(halfFov) * layout.height / 2);
}

// ---- Crosshair drawing ----
const hudArms = new Float32Array(4 * 4);   // up to four [x, y, width, height] arms of cross, T and dot styles
function hudSetArm(index, x, y, width, height) {
  hudArms[index * 4] = x; hudArms[index * 4 + 1] = y; hudArms[index * 4 + 2] = width; hudArms[index * 4 + 3] = height;
}
function hudFillArms(style, cx, cy, size, gap, thickness) {
  const half = thickness / 2;
  if (style === 'dot') { const dot = Math.max(thickness * 1.5, 3); hudSetArm(0, cx - dot / 2, cy - dot / 2, dot, dot); return 1; }
  hudSetArm(0, cx - half, cy + gap, thickness, size);
  hudSetArm(1, cx - gap - size, cy - half, size, thickness);
  hudSetArm(2, cx + gap, cy - half, size, thickness);
  if (style === 'tee') return 3;
  hudSetArm(3, cx - half, cy - gap - size, thickness, size);
  return 4;
}
// The arms go straight into the HUD corner scratch (07f): four float arguments per arm to pen.rect were boxed (PERF-006).
function hudDrawArms(pen, count, color, alpha, grow) {
  const corners = hudCorners;
  setHudPaint(color, alpha);
  for (let i = 0; i < count; i++) {
    corners[0] = hudArms[i * 4] - grow; corners[1] = hudArms[i * 4 + 1] - grow;
    corners[2] = corners[0] + hudArms[i * 4 + 2] + grow * 2; corners[3] = corners[1] + hudArms[i * 4 + 3] + grow * 2;
    pushHudBox();
  }
}

function hudDrawCrosshairShape(pen, layout, cross, gap) {
  const unit = layout.unit, cx = layout.centerX, cy = layout.centerY, color = HUD_CROSSHAIR_COLORS[cross.color] || HUD_COLOR.text;
  const size = cross.size * unit, thickness = Math.max(1, cross.thickness * unit), line = gap + cross.gap * unit;
  if (cross.style === 'circle') {
    const radius = line + size * 0.5;
    if (cross.outline) pen.ring(cx, cy, radius, thickness + 2, HUD_COLOR.black, HUD_OUTLINE_ALPHA);
    pen.ring(cx, cy, radius, thickness, color, 1);
  } else if (cross.style === 'chevron') {
    hudDrawChevron(pen, cx, cy, size, line, thickness, color, cross.outline);
  } else {
    const count = hudFillArms(cross.style, cx, cy, size, line, thickness);
    if (cross.outline) hudDrawArms(pen, count, HUD_COLOR.black, HUD_OUTLINE_ALPHA, 1);
    hudDrawArms(pen, count, color, 1, 0);
  }
  if (!cross.dot) return;
  const dot = Math.max(thickness, 2);
  if (cross.outline) pen.rect(cx - dot / 2 - 1, cy - dot / 2 - 1, dot + 2, dot + 2, HUD_COLOR.black, HUD_OUTLINE_ALPHA);
  pen.rect(cx - dot / 2, cy - dot / 2, dot, dot, color, 1);
}

function hudDrawChevron(pen, cx, cy, size, gap, thickness, color, outline) {
  const top = cy + gap, rise = size * 0.7;
  if (outline) {
    pen.line(cx - size, top + rise, cx, top, thickness + 2, HUD_COLOR.black, HUD_OUTLINE_ALPHA);
    pen.line(cx + size, top + rise, cx, top, thickness + 2, HUD_COLOR.black, HUD_OUTLINE_ALPHA);
  }
  pen.line(cx - size, top + rise, cx, top, thickness, color, 1);
  pen.line(cx + size, top + rise, cx, top, thickness, color, 1);
}

function hudScopeAmount(id, weapon) {
  if (!HudCombat.scopeOverlay || !weapon.alt || weapon.alt.zoom < HUD_SCOPE_ZOOM_MIN) return 0;
  return clamp((Weapons.ads[id] - 0.5) * 2, 0, 1);
}

function hudDrawCrosshair(pen, layout, seconds) {
  const id = Game.playerId;
  if (!hudLocalAlive()) return;
  const weapon = Weapons.currentWeapon(id);
  if (!weapon) return;
  if (hudScopeAmount(id, weapon) > 0) return;       // the scope overlay replaces the crosshair
  const cross = Hud.crosshairFor(weapon);
  if (cross.hidden) return;
  const target = cross.dynamic ? hudCrosshairSpread(id, weapon, layout) : 0, rate = target > HudCombat.spread ? HUD_SPREAD_RISE : HUD_SPREAD_FALL;
  HudCombat.spread += (target - HudCombat.spread) * Math.min(1, seconds * rate);
  hudDrawCrosshairShape(pen, layout, cross, HudCombat.spread);
}

// Scope overlay: everything outside a circle goes dark (one thick ring), thin lines through the centre.
function hudDrawScope(pen, layout) {
  const id = Game.playerId;
  if (!hudLocalAlive()) return;
  const weapon = Weapons.currentWeapon(id);
  const amount = weapon ? hudScopeAmount(id, weapon) : 0;
  if (amount <= 0) return;
  const cx = layout.centerX, cy = layout.centerY, inner = layout.height * HUD_SCOPE_RADIUS;
  const outer = length2(layout.width, layout.height) / 2 * 1.02;
  pen.ring(cx, cy, (inner + outer) / 2, outer - inner, HUD_COLOR.black, 0.94 * amount);
  pen.rect(cx - inner, cy - 0.5, inner * 2, 1, HUD_COLOR.black, 0.85 * amount);
  pen.rect(cx - 0.5, cy - inner, 1, inner * 2, HUD_COLOR.black, 0.85 * amount);
  pen.rect(cx - 1.5, cy - 1.5, 3, 3, HUD_COLOR.bad, amount);
}

// ---- Hit and kill markers ----
function hudDrawMarkerTicks(pen, cx, cy, gap, length, thickness, color, alpha) {
  for (let i = 0; i < 4; i++) {
    const dx = i & 1 ? 1 : -1, dy = i & 2 ? 1 : -1;
    pen.line(cx + dx * gap, cy + dy * gap, cx + dx * (gap + length), cy + dy * (gap + length), thickness, color, alpha);
  }
}
function hudDrawHitMarkers(pen, layout) {
  const age = Hud.time - HudCombat.hitAt, killAge = Hud.time - HudCombat.killAt, unit = layout.unit, cx = layout.centerX, cy = layout.centerY;
  if (age < HUD_HIT_SECONDS) {
    const head = HudCombat.hitHead;
    hudDrawMarkerTicks(pen, cx, cy, HUD_HIT_GAP * unit, (head ? 1.4 : 1) * HUD_HIT_LENGTH * unit, 2 * unit, head ? HUD_COLOR.gold : HUD_COLOR.text, 1 - age / HUD_HIT_SECONDS);
  }
  if (killAge < HUD_KILL_SECONDS) hudDrawMarkerTicks(pen, cx, cy, HUD_KILL_GAP * unit, HUD_KILL_LENGTH * unit, 3 * unit, Hud.colors.bad, 1 - killAge / HUD_KILL_SECONDS);
}

// ---- Damage numbers: one number per target that keeps adding while the hits keep coming ----
function hudShowDamageNumber(target, amount, head, x, y, z) {
  const c = HudCombat;
  let slot = -1;
  for (let i = 0; i < HUD_NUMBER_SLOTS; i++) if (c.numberTarget[i] === target && Hud.time - c.numberAt[i] < HUD_NUMBER_STACK_SECONDS) { slot = i; break; }
  if (slot < 0) { slot = c.numberNext; c.numberNext = (c.numberNext + 1) % HUD_NUMBER_SLOTS; c.numberAmount[slot] = 0; c.numberHead[slot] = 0; }
  c.numberTarget[slot] = target; c.numberAmount[slot] += amount; c.numberAt[slot] = Hud.time;
  c.numberX[slot] = x; c.numberY[slot] = y; c.numberZ[slot] = z;
  if (head) c.numberHead[slot] = 1;
}
function hudDrawDamageNumbers(pen, layout) {
  const c = HudCombat, unit = layout.unit;
  for (let i = 0; i < HUD_NUMBER_SLOTS; i++) {
    const age = Hud.time - c.numberAt[i];
    if (age >= HUD_NUMBER_SECONDS || c.numberTarget[i] < 0) continue;
    if (!Hud.project(c.numberX[i], c.numberY[i], c.numberZ[i])) continue;
    const rise = HUD_NUMBER_RISE * unit * (age / HUD_NUMBER_SECONDS);
    pen.label(hudNumber(c.numberAmount[i]), hudProjection.x, hudProjection.y - rise, (c.numberHead[i] ? 22 : 18) * unit, c.numberHead[i] ? HUD_COLOR.gold : HUD_COLOR.text, 'center', 1 - age / HUD_NUMBER_SECONDS);
  }
}

// ---- Damage direction arcs ----
function hudNoteIncomingDamage(source, x, z) {
  const c = HudCombat, slot = c.arcNext;
  c.arcNext = (slot + 1) % HUD_ARC_SLOTS;
  c.arcAt[slot] = Hud.time; c.arcX[slot] = x; c.arcZ[slot] = z; c.arcSource[slot] = source;
}
// Clockwise angle from straight ahead (0 = top of the screen) towards a world point.
function hudBearingTo(x, z) {
  const camera = Render.camera, dx = x - camera.x, dz = z - camera.z;
  return Math.atan2(-dx * Math.cos(camera.yaw) + dz * Math.sin(camera.yaw), dx * Math.sin(camera.yaw) + dz * Math.cos(camera.yaw));
}
function hudDrawDamageArcs(pen, layout) {
  const c = HudCombat, unit = layout.unit;
  for (let i = 0; i < HUD_ARC_SLOTS; i++) {
    const age = Hud.time - c.arcAt[i];
    if (age >= HUD_ARC_SECONDS) continue;
    const source = c.arcSource[i], live = source >= 0 && Actors.alive[source] === 1;
    const angle = hudBearingTo(live ? Actors.x[source] : c.arcX[i], live ? Actors.z[source] : c.arcZ[i]);
    pen.ring(layout.centerX, layout.centerY, HUD_ARC_RADIUS * unit, HUD_ARC_THICKNESS * unit, Hud.colors.bad, 1 - age / HUD_ARC_SECONDS, angle - HUD_ARC_HALF_WIDTH, angle + HUD_ARC_HALF_WIDTH);
  }
}

// ---- Low-health vignette and the short red hit tint (never white; tint limited by the ACC-005 flash cap) ----
function hudDrawVignette(pen, layout) {
  const id = Game.playerId;
  if (!hudLocalAlive()) return;
  const width = layout.width, height = layout.height;
  const fraction = Actors.maxHealth[id] > 0 ? Actors.health[id] / Actors.maxHealth[id] : 1;
  const flashAge = Hud.time - HudCombat.flashAt;
  if (flashAge < HUD_HIT_FLASH.seconds) pen.rect(0, 0, width, height, Hud.flashColor(Hud.colors.bad), Hud.flashAlpha(HUD_HIT_FLASH.alpha * (1 - flashAge / HUD_HIT_FLASH.seconds)));
  if (fraction >= LOW_HEALTH_FRACTION) return;
  const pulse = Hud.reduceMotion() ? 1 : 0.85 + 0.15 * Math.sin(Hud.time * Math.PI * 2 * HUD_PULSE_HZ);
  const strength = (LOW_HEALTH_FRACTION - fraction) / LOW_HEALTH_FRACTION * HUD_VIGNETTE_STRENGTH * pulse / HUD_VIGNETTE_LAYERS;
  const edge = Math.min(width, height) * HUD_VIGNETTE_EDGE;
  for (let i = 0; i < HUD_VIGNETTE_LAYERS; i++) {
    const band = edge * (HUD_VIGNETTE_LAYERS - i) / HUD_VIGNETTE_LAYERS;
    pen.rect(0, 0, width, band, HUD_COLOR.healthLow, strength);
    pen.rect(0, height - band, width, band, HUD_COLOR.healthLow, strength);
    pen.rect(0, band, band, height - band * 2, HUD_COLOR.healthLow, strength);
    pen.rect(width - band, band, band, height - band * 2, HUD_COLOR.healthLow, strength);
  }
}

// ---- Events ----
Bus.on('damage', (event) => {
  const player = Game.playerId;
  if (player < 0) return;
  if (event.target === player && event.source !== player && event.amount > 0) hudOnPlayerDamaged(event);
  if (event.source !== player || event.target === player || !HUD_HIT_KINDS.includes(event.kind)) return;
  HudCombat.hitAt = Hud.time;
  HudCombat.hitHead = event.zone === 'head';
  const target = event.target;
  const fromEvent = event.x !== 0 || event.y !== 0 || event.z !== 0;
  hudShowDamageNumber(target, event.amount, HudCombat.hitHead, fromEvent ? event.x : Actors.x[target], fromEvent ? event.y : Actors.y[target] + Actors.height[target], fromEvent ? event.z : Actors.z[target]);
});
function hudOnPlayerDamaged(event) {
  const source = event.source;
  if (Hud.flashAllowed() && !Hud.reduceMotion()) HudCombat.flashAt = Hud.time;
  if (source >= 0) hudNoteIncomingDamage(source, Actors.x[source], Actors.z[source]);
  else if (event.dx !== 0 || event.dz !== 0) hudNoteIncomingDamage(-1, event.x - event.dx * 10, event.z - event.dz * 10);
}
Bus.on('kill', (event) => {
  if (event.killer === Game.playerId && event.victim !== event.killer && Game.playerId >= 0) HudCombat.killAt = Hud.time;
});
Bus.on('match.start', () => { HudCombat.reset(); HudCombat.readSettings(); });
Bus.on('actor.spawn', (event) => { if (event.id === Game.playerId) HudCombat.spread = 0; });
Bus.on('setting', (key) => { if (typeof key === 'string' && key.startsWith('hud.')) HudCombat.readSettings(); });
Bus.on('boot', () => HudCombat.readSettings());

Hud.register('back', 'scope', 'crosshair', hudDrawScope);
Hud.register('back', 'vignette', 'vignette', hudDrawVignette);
Hud.register('back', 'damageArcs', 'damageArcs', hudDrawDamageArcs);
Hud.register('world', 'damageNumbers', 'damageNumbers', hudDrawDamageNumbers);
Hud.register('main', 'crosshair', 'crosshair', hudDrawCrosshair);
Hud.register('main', 'hitMarkers', 'hitMarkers', hudDrawHitMarkers);
