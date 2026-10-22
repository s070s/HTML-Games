// ==== S17 HUD: WORLD MARKERS AND ACCESSIBILITY AIDS ====
// Objective / flag / ping markers projected to the screen with distance, off-screen arrows at the edge, teammate name tags with
// team shapes (UI-013, ACC-001), item respawn timers, sound captions (ACC-002), the visual sound ring (ACC-003) and the HP-007
// downed cues (teammate markers, bleed-out time, hold-Use hint, revive ring).
// The projection itself is Hud.project (17a); positions are read from live state each frame, nothing is allocated.

const HUD_MARKER_SHAPES = { flag: 'triangle', flagBase: 'square', point: 'circle', hill: 'circle', bombsite: 'circle', relic: 'diamond', core: 'diamond', extract: 'triangle', bank: 'square' };
const HUD_LETTER_KINDS = ['point', 'hill', 'bombsite'];
const HUD_MARKER_HEIGHT = 2.4;            // metres above the objective centre
const HUD_MARKER_MARGIN = 30;             // keeps arrows and icons off the screen edge
const HUD_MARKER_MAX = 14;
const HUD_PING_SLOTS = 8, HUD_PING_SECONDS = 6;
const HUD_TAG_RANGE = 60, HUD_TAG_MAX = 12, HUD_TAG_HEIGHT_ABOVE = 0.35;
const HUD_ITEM_TIMER_RANGE = 40, HUD_ITEM_TIMER_MAX = 12;
const HUD_ARROW_TIP = 11, HUD_ARROW_BASE = 7, HUD_ARROW_WIDTH = 8;
const HUD_CAPTION_SLOTS = 5, HUD_CAPTION_SECONDS = 2.5, HUD_CAPTION_FADE = 0.5, HUD_CAPTION_SHOWN = 4, HUD_CAPTION_DUPLICATE_SECONDS = 0.6;
const HUD_SOUND_SLOTS = 10, HUD_SOUND_SECONDS = 1.4, HUD_SOUND_RADIUS = 92, HUD_SOUND_MIN_DISTANCE = 1;
// ACC-003 sound icons per caption kind (the AUDIO_CAPTION_KINDS of S06): a shape and a colour name each, so kinds differ by shape too.
const HUD_SOUND_ICONS = {
  footstep: { shape: 'circle', color: HUD_COLOR.text }, gunfire: { shape: 'triangle', color: HUD_COLOR.bad }, explosion: { shape: 'diamond', color: HUD_COLOR.warn },
  item: { shape: 'square', color: HUD_COLOR.good }, voice: { shape: 'circle', color: HUD_COLOR.shield }, alert: { shape: 'triangle', color: HUD_COLOR.gold },
};
const HUD_SOUND_FALLBACK = HUD_SOUND_ICONS.alert;

Settings.define('hud.captionSize', 16, { label: 'Caption text size', category: 'accessibility', min: 14, max: 28, step: 2 });
Settings.define('hud.captionBackground', true, { label: 'Caption background', category: 'accessibility' });
const HudAccess = { captionSize: 16, captionBackground: true };
function hudReadAccessSettings() {
  HudAccess.captionSize = Settings.get('hud.captionSize');
  HudAccess.captionBackground = Settings.get('hud.captionBackground');
}
Bus.on('boot', hudReadAccessSettings);
Bus.on('match.start', hudReadAccessSettings);
Bus.on('setting', (key) => { if (key === 'hud.captionSize' || key === 'hud.captionBackground') hudReadAccessSettings(); });

// ---- Markers on screen or on the edge ----
const hudEdge = { x: 0, y: 0, dx: 0, dy: 0 };

// Where the arrow for a point off the screen sits: on the rectangle inset by the margin, along the direction from the centre.
function hudEdgeArrowPosition(layout, projection) {
  const margin = HUD_MARKER_MARGIN * layout.unit, halfW = layout.centerX - margin, halfH = layout.centerY - margin;
  let dx = projection.dirX, dy = projection.dirY;
  if (projection.depth <= 0) dy *= 0.3;                       // behind us: the side matters, not the height
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) { dx = 0; dy = 1; } else { dx /= length; dy /= length; }
  const scale = Math.min(Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity);
  hudEdge.x = layout.centerX + dx * scale; hudEdge.y = layout.centerY + dy * scale; hudEdge.dx = dx; hudEdge.dy = dy;
  return hudEdge;
}

function hudDrawEdgeArrow(pen, layout, projection, color, distance) {
  const unit = layout.unit, edge = hudEdgeArrowPosition(layout, projection);
  const tipX = edge.x + edge.dx * HUD_ARROW_TIP * unit, tipY = edge.y + edge.dy * HUD_ARROW_TIP * unit;
  const baseX = edge.x - edge.dx * HUD_ARROW_BASE * unit, baseY = edge.y - edge.dy * HUD_ARROW_BASE * unit;
  const sideX = -edge.dy * HUD_ARROW_WIDTH * unit, sideY = edge.dx * HUD_ARROW_WIDTH * unit;
  pen.triangle(tipX, tipY, baseX + sideX, baseY + sideY, baseX - sideX, baseY - sideY, color, 1);
  pen.label(hudNumber(distance), edge.x - edge.dx * 24 * unit, edge.y - edge.dy * 24 * unit, HUD_TEXT_SMALL * unit, HUD_COLOR.text, 'center');
}

// One marker: on-screen icon with distance below it, or an arrow on the edge. `letter` is -1 for none.
function hudDrawMarker(pen, layout, x, y, z, shape, color, letter, distanceHint) {
  const unit = layout.unit, onScreen = Hud.project(x, y, z), projection = hudProjection;
  if (!onScreen) { hudDrawEdgeArrow(pen, layout, projection, color, projection.distance); return; }
  const margin = HUD_MARKER_MARGIN * unit;
  const px = clamp(projection.x, margin, layout.width - margin), py = clamp(projection.y, margin, layout.height - margin);
  const size = 22 * unit;
  pen.shape(shape, px, py, size, color, 0.95);
  if (letter >= 0) pen.text(HUD_LETTERS[letter], px, py, 15 * unit, HUD_COLOR.black, 'center');
  if (distanceHint !== false) pen.label(hudNumber(projection.distance), px, py + size * 0.95, HUD_TEXT_SMALL * unit, HUD_COLOR.text, 'center');
}

function hudObjectiveColor(objective) {
  if (objective.kind === 'flag' || objective.kind === 'flagBase') return Hud.teamColor(objective.team);
  return objective.owner >= 0 ? Hud.teamColor(objective.owner) : HUD_COLOR.dim;
}

function hudDrawObjectiveMarkers(pen, layout) {
  const list = Modes.objectives;
  let drawn = 0;
  for (let i = 0; i < list.length && drawn < HUD_MARKER_MAX; i++) {
    const objective = list[i], shape = HUD_MARKER_SHAPES[objective.kind];
    if (!objective.active || !shape) continue;
    const letter = HUD_LETTER_KINDS.includes(objective.kind) ? hudObjectiveLetter(list, i) : -1;
    hudDrawMarker(pen, layout, objective.x, objective.y + HUD_MARKER_HEIGHT, objective.z, shape, hudObjectiveColor(objective), letter, true);
    drawn++;
  }
}

// ---- Pings (a ring of the last HUD_PING_SLOTS; teammates' and your own) ----
const HudPings = {
  source: new Int16Array(HUD_PING_SLOTS).fill(-1), kind: new Array(HUD_PING_SLOTS).fill(''),
  x: new Float32Array(HUD_PING_SLOTS), y: new Float32Array(HUD_PING_SLOTS), z: new Float32Array(HUD_PING_SLOTS), at: new Float64Array(HUD_PING_SLOTS).fill(-1000), next: 0,
  reset() { this.source.fill(-1); this.at.fill(-1000); this.next = 0; },
  add(event) {
    const slot = this.next;
    this.next = (slot + 1) % HUD_PING_SLOTS;
    this.source[slot] = event.id; this.kind[slot] = event.kind;
    this.x[slot] = event.x; this.y[slot] = event.y; this.z[slot] = event.z; this.at[slot] = Hud.time;
  },
};
Bus.on('ping', (event) => HudPings.add(event));

function hudPingColor(kind) {
  if (kind === 'enemy') return Hud.colors.bad;
  return kind === 'danger' ? HUD_COLOR.warn : Hud.colors.good;
}
function hudDrawPingMarkers(pen, layout) {
  const p = HudPings, player = Game.playerId;
  for (let i = 0; i < HUD_PING_SLOTS; i++) {
    const age = Hud.time - p.at[i], source = p.source[i];
    if (age >= HUD_PING_SECONDS || source < 0) continue;
    if (source !== player && (player < 0 || Actors.isEnemy(player, source))) continue;      // only your side's pings
    hudDrawMarker(pen, layout, p.x[i], p.y[i] + 0.5, p.z[i], p.kind[i] === 'enemy' ? 'triangle' : 'diamond', hudPingColor(p.kind[i]), -1, true);
    if (Hud.project(p.x[i], p.y[i] + 0.5, p.z[i])) pen.label(Actors.name[source], hudProjection.x, hudProjection.y - 18 * layout.unit, HUD_TEXT_SMALL * layout.unit, HUD_COLOR.dim, 'center');
  }
}

function hudDrawMarkers(pen, layout) {
  hudDrawObjectiveMarkers(pen, layout);
  hudDrawPingMarkers(pen, layout);
}

// ---- Teammate name tags with a team shape beside the name (never enemies: no wall hacks) ----
function hudDrawNameTags(pen, layout) {
  const player = Game.playerId;
  if (player < 0 || Actors.team[player] < 0) return;
  const unit = layout.unit, team = Actors.team[player], rangeSquared = HUD_TAG_RANGE * HUD_TAG_RANGE;
  let drawn = 0;
  for (let id = 0; id < Actors.count && drawn < HUD_TAG_MAX; id++) {
    if (id === player || !Actors.alive[id] || Actors.team[id] !== team) continue;
    if (distanceSquared3(Actors.x[id], Actors.y[id], Actors.z[id], Actors.x[player], Actors.y[player], Actors.z[player]) > rangeSquared) continue;
    if (!Hud.project(Actors.x[id], Actors.y[id] + Actors.height[id] + HUD_TAG_HEIGHT_ABOVE, Actors.z[id])) continue;
    const x = hudProjection.x, y = hudProjection.y, width = HudBatch.measure(Actors.name[id], HUD_TEXT_SMALL * unit);
    if (Hud.teamShapes) pen.shape(Hud.teamShape(team), x - width / 2 - 9 * unit, y, 11 * unit, Hud.teamColor(team));
    pen.label(Actors.name[id], x + (Hud.teamShapes ? 4 * unit : 0), y, HUD_TEXT_SMALL * unit, Hud.teamColor(team), 'center');
    drawn++;
  }
}

// ---- Item respawn timers (Items.timers) ----
const hudItemTimers = [];
function hudDrawItemTimers(pen, layout) {
  const count = Math.min(Items.timers(hudItemTimers), HUD_ITEM_TIMER_MAX), player = Game.playerId, unit = layout.unit;
  for (let i = 0; i < count; i++) {
    const timer = hudItemTimers[i];
    if (player >= 0 && distanceSquared3(timer.x, timer.y, timer.z, Actors.x[player], Actors.y[player], Actors.z[player]) > HUD_ITEM_TIMER_RANGE * HUD_ITEM_TIMER_RANGE) continue;
    if (!Hud.project(timer.x, timer.y + 0.8, timer.z)) continue;
    pen.shape('square', hudProjection.x, hudProjection.y, 8 * unit, HUD_COLOR.dim, 0.9);
    pen.label(hudNumber(timer.remaining), hudProjection.x, hudProjection.y - 14 * unit, HUD_TEXT_SMALL * unit, HUD_COLOR.text, 'center');
  }
}

// ---- Captions and the sound ring: both fed by the 'caption' events of S06 ----
const HudCaptions = {
  text: new Array(HUD_CAPTION_SLOTS).fill(''), at: new Float64Array(HUD_CAPTION_SLOTS).fill(-1000), next: 0,
  soundX: new Float32Array(HUD_SOUND_SLOTS), soundZ: new Float32Array(HUD_SOUND_SLOTS), soundKind: new Array(HUD_SOUND_SLOTS).fill(''),
  soundAt: new Float64Array(HUD_SOUND_SLOTS).fill(-1000), soundNext: 0,

  reset() { this.at.fill(-1000); this.soundAt.fill(-1000); this.next = 0; this.soundNext = 0; },
  addCaption(text) {
    for (let i = 0; i < HUD_CAPTION_SLOTS; i++) if (this.text[i] === text && Hud.time - this.at[i] < HUD_CAPTION_DUPLICATE_SECONDS) { this.at[i] = Hud.time; return; }
    const slot = this.next;
    this.next = (slot + 1) % HUD_CAPTION_SLOTS;
    this.text[slot] = text; this.at[slot] = Hud.time;
  },
  addSound(event) {
    const slot = this.soundNext;
    this.soundNext = (slot + 1) % HUD_SOUND_SLOTS;
    this.soundX[slot] = event.x; this.soundZ[slot] = event.z; this.soundKind[slot] = event.kind; this.soundAt[slot] = Hud.time;
  },
};
Bus.on('caption', (event) => {
  if (event.text) HudCaptions.addCaption(event.text);
  HudCaptions.addSound(event);
});

function hudDrawCaptions(pen, layout) {
  const c = HudCaptions, unit = layout.unit, size = HudAccess.captionSize * unit;
  let shown = 0, y = layout.weaponBarY - (layout.compact ? 40 : 56) * unit;
  for (let k = 1; k <= HUD_CAPTION_SLOTS && shown < HUD_CAPTION_SHOWN; k++) {
    const slot = (c.next - k + HUD_CAPTION_SLOTS) % HUD_CAPTION_SLOTS, age = Hud.time - c.at[slot];
    if (age >= HUD_CAPTION_SECONDS) continue;
    const alpha = Math.min(1, (HUD_CAPTION_SECONDS - age) / HUD_CAPTION_FADE);
    if (HudAccess.captionBackground) {
      const width = HudBatch.measure(c.text[slot], size) + 16 * unit;
      pen.rect(layout.centerX - width / 2, y - size * 0.75, width, size * 1.5, HUD_COLOR.black, 0.6 * alpha);
    }
    pen.text(c.text[slot], layout.centerX, y, size, HUD_COLOR.text, 'center', alpha);
    y -= size * 1.7;
    shown++;
  }
}

function hudDrawSoundRing(pen, layout) {
  const c = HudCaptions, unit = layout.unit, player = Game.playerId;
  for (let i = 0; i < HUD_SOUND_SLOTS; i++) {
    const age = Hud.time - c.soundAt[i];
    if (age >= HUD_SOUND_SECONDS) continue;
    if (player >= 0 && Math.hypot(c.soundX[i] - Render.camera.x, c.soundZ[i] - Render.camera.z) < HUD_SOUND_MIN_DISTANCE) continue;
    const angle = hudBearingTo(c.soundX[i], c.soundZ[i]), icon = HUD_SOUND_ICONS[c.soundKind[i]] || HUD_SOUND_FALLBACK;
    const x = layout.centerX + Math.sin(angle) * HUD_SOUND_RADIUS * unit, y = layout.centerY - Math.cos(angle) * HUD_SOUND_RADIUS * unit;
    pen.shape(icon.shape, x, y, 16 * unit, icon.color, 1 - age / HUD_SOUND_SECONDS);
  }
}

// ---- HP-007 downed: teammates down (marker), the local player's bleed-out, the hold-Use hint and the revive ring ----
const HUD_DOWNED_MARKER_HEIGHT = 1.2;     // metres above a downed teammate's feet
const HUD_REVIVE_HINT_RANGE = 4;          // metres: the hold-Use hint shows this close to a downed teammate

function hudDrawDownedAllies(pen, layout) {
  const player = Game.playerId;
  if (!Damage.downedCount || player < 0 || Actors.team[player] < 0) return;   // no scan while nobody is down
  for (let id = 0; id < Actors.count; id++) {
    if (id === player || !Actors.alive[id] || !(Actors.flags[id] & ACTOR_FLAG.DOWNED) || Actors.team[id] !== Actors.team[player]) continue;
    hudDrawMarker(pen, layout, Actors.x[id], Actors.y[id] + HUD_DOWNED_MARKER_HEIGHT, Actors.z[id], 'diamond', HUD_COLOR.warn, -1, true);
  }
}
// The teammate reviving `id` (Damage.reviving), or -1.
function hudReviverOf(id) {
  for (let other = 0; other < Actors.count; other++) if (Damage.reviving[other] === id) return other;
  return -1;
}
function hudDrawReviveRing(pen, layout, reviver, y) {
  const unit = layout.unit;
  hudDrawCooldownRing(pen, layout.centerX, y, 22 * unit, 4 * unit, 1 - Damage.reviveProgress[reviver] / REVIVE_SECONDS, Hud.colors.good);
}
function hudDrawDownedState(pen, layout) {
  const player = Game.playerId;
  if (player < 0 || !Actors.alive[player] || !Damage.downedCount) return;
  const unit = layout.unit, x = layout.centerX, y = layout.height * 0.68;
  if (Actors.flags[player] & ACTOR_FLAG.DOWNED) {
    pen.label('DOWNED', x, y, 30 * unit, Hud.colors.bad, 'center');
    pen.label('BLEEDING OUT', x, y + 30 * unit, 16 * unit, HUD_COLOR.dim, 'center');
    pen.label(hudTime(Damage.downedTime[player]), x, y + 56 * unit, 22 * unit, HUD_COLOR.text, 'center');
    const reviver = hudReviverOf(player);
    if (reviver >= 0) hudDrawReviveRing(pen, layout, reviver, y - 44 * unit);
    return;
  }
  if (Damage.reviving[player] >= 0) {
    hudDrawReviveRing(pen, layout, player, y);
    pen.label('REVIVING', x, y + 36 * unit, 16 * unit, HUD_COLOR.dim, 'center');
    return;
  }
  if (Damage.nearestDownedAlly(player, HUD_REVIVE_HINT_RANGE) < 0) return;
  pen.label(Hud.keyLabel('use') || 'HOLD USE', x, y, 24 * unit, HUD_COLOR.text, 'center');
  pen.label('HOLD TO REVIVE', x, y + 28 * unit, 16 * unit, HUD_COLOR.dim, 'center');
}

Bus.on('match.start', () => { HudPings.reset(); HudCaptions.reset(); });
Bus.on('match.stop', () => { HudPings.reset(); HudCaptions.reset(); });

Hud.register('world', 'markers', 'markers', hudDrawMarkers);
Hud.register('world', 'nameTags', 'nameTags', hudDrawNameTags);
Hud.register('world', 'itemTimers', 'itemTimers', hudDrawItemTimers);
Hud.register('main', 'soundRing', 'soundRing', hudDrawSoundRing);
Hud.register('main', 'captions', 'captions', hudDrawCaptions);
Hud.register('world', 'downedAllies', 'markers', hudDrawDownedAllies);
Hud.register('front', 'downed', 'respawnText', hudDrawDownedState);
