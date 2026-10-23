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
const HUD_PING_SLOTS = 12, HUD_PING_PER_ACTOR = 3;   // a source's fourth live ping replaces its oldest
const HUD_PING_SECONDS = 6;               // marker life of a ping kind with no COMM_CALLOUTS row (the rows carry their own `seconds`)
const HUD_PING_SIGHT_INTERVAL = 0.2;      // s between the line-of-sight checks that let an enemy ping follow its target
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
  const length = length2(dx, dy);
  if (length < 1e-6) { dx = 0; dy = 1; } else { dx /= length; dy /= length; }
  const scale = Math.min(Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity);
  hudEdge.x = layout.centerX + dx * scale; hudEdge.y = layout.centerY + dy * scale; hudEdge.dx = dx; hudEdge.dy = dy;
  return hudEdge;
}

// The arrow and the distance of the projection (hudProjection) off the screen. The arrow's corners go straight into the
// HUD scratch and the text through the pen's *At forms (17a): no float arguments (PERF-006).
function hudDrawEdgeArrow(pen, layout, projection, color) {
  const unit = layout.unit, edge = hudEdgeArrowPosition(layout, projection), corners = hudCorners, text = hudTextAt;
  const tipX = edge.x + edge.dx * HUD_ARROW_TIP * unit, tipY = edge.y + edge.dy * HUD_ARROW_TIP * unit;
  const baseX = edge.x - edge.dx * HUD_ARROW_BASE * unit, baseY = edge.y - edge.dy * HUD_ARROW_BASE * unit;
  const sideX = -edge.dy * HUD_ARROW_WIDTH * unit, sideY = edge.dx * HUD_ARROW_WIDTH * unit;
  corners[0] = tipX; corners[1] = tipY; corners[2] = baseX + sideX; corners[3] = baseY + sideY;
  corners[4] = corners[6] = baseX - sideX; corners[5] = corners[7] = baseY - sideY;   // a triangle: a quad with two equal corners
  setHudPaint(color, 1);
  pushHudSolid();
  text[0] = edge.x - edge.dx * 24 * unit; text[1] = edge.y - edge.dy * 24 * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.labelAt(hudNumber(projection.distance), HUD_COLOR.text, 'center');
}

// One marker: on-screen icon with distance below it, or an arrow on the edge. `letter` is -1 for none.
function hudDrawMarker(pen, layout, x, y, z, shape, color, letter, distanceHint) {
  const unit = layout.unit, onScreen = Hud.project(x, y, z), projection = hudProjection;
  if (!onScreen) { hudDrawEdgeArrow(pen, layout, projection, color); return; }
  const margin = HUD_MARKER_MARGIN * unit, at = hudShapeAt, text = hudTextAt;
  // Math.min / max instead of clamp: clamp's float result is boxed where the call is not inlined.
  const px = Math.min(Math.max(projection.x, margin), layout.width - margin), py = Math.min(Math.max(projection.y, margin), layout.height - margin);
  const size = 22 * unit;
  at[0] = px; at[1] = py; at[2] = size / 2;
  pen.shapeAt(shape, color, 0.95);
  text[0] = px; text[1] = py; text[2] = 15 * unit;
  if (letter >= 0) pen.textAt(HUD_LETTERS[letter], HUD_COLOR.black, 'center');
  text[1] = py + size * 0.95; text[2] = HUD_TEXT_SMALL * unit;
  if (distanceHint !== false) pen.labelAt(hudNumber(projection.distance), HUD_COLOR.text, 'center');
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

// ---- Pings (HUD_PING_SLOTS live ones, at most HUD_PING_PER_ACTOR per source; teammates' and your own) ----
// Each kind lives its COMM_CALLOUTS row's `seconds`; an enemy ping rides on its target while the pinger still sees it.
const hudPingSight = makeLine();
const HudPings = {
  source: new Int16Array(HUD_PING_SLOTS).fill(-1), kind: new Array(HUD_PING_SLOTS).fill(''), reply: new Array(HUD_PING_SLOTS).fill(''),
  target: new Int16Array(HUD_PING_SLOTS).fill(-1), seen: new Uint8Array(HUD_PING_SLOTS), sightAt: new Float64Array(HUD_PING_SLOTS),
  x: new Float32Array(HUD_PING_SLOTS), y: new Float32Array(HUD_PING_SLOTS), z: new Float32Array(HUD_PING_SLOTS),
  order: new Float64Array(HUD_PING_SLOTS), until: new Float64Array(HUD_PING_SLOTS).fill(-1000), added: 0,   // order = when added, counted (Hud.time can stand still)
  reset() { this.source.fill(-1); this.target.fill(-1); this.order.fill(0); this.until.fill(-1000); this.added = 0; },
  live(slot) { return this.source[slot] >= 0 && Hud.time < this.until[slot]; },
  // The other side's pings are never drawn, so they never take a slot from your own side's markers.
  add(event) {
    const player = Game.playerId;
    if (player >= 0 && event.id !== player && Actors.isEnemy(player, event.id)) return;
    this.capSource(event.id);
    const slot = this.freeSlot(), row = COMM_CALLOUT_BY_KIND.get(event.kind);
    this.source[slot] = event.id; this.kind[slot] = event.kind; this.reply[slot] = row && row.at === 'reply' ? row.label : '';
    this.target[slot] = event.target >= 0 ? event.target : -1; this.seen[slot] = 1; this.sightAt[slot] = Hud.time + HUD_PING_SIGHT_INTERVAL;
    this.x[slot] = event.x; this.y[slot] = event.y; this.z[slot] = event.z;
    this.order[slot] = ++this.added; this.until[slot] = Hud.time + (row ? row.seconds : HUD_PING_SECONDS);
  },
  // A source with HUD_PING_PER_ACTOR live pings loses its oldest one.
  capSource(source) {
    let count = 0, oldest = -1;
    for (let i = 0; i < HUD_PING_SLOTS; i++) {
      if (this.source[i] !== source || !this.live(i)) continue;
      count++;
      if (oldest < 0 || this.order[i] < this.order[oldest]) oldest = i;
    }
    if (count >= HUD_PING_PER_ACTOR) this.until[oldest] = -1000;
  },
  // An expired slot, else the oldest ping.
  freeSlot() {
    let oldest = 0;
    for (let i = 0; i < HUD_PING_SLOTS; i++) {
      if (!this.live(i)) return i;
      if (this.order[i] < this.order[oldest]) oldest = i;
    }
    return oldest;
  },
  // The newest live ping of the player's side (not the player's own, not a reply): what a comm wheel reply answers, or -1.
  newestToAnswer(player) {
    let best = -1;
    for (let i = 0; i < HUD_PING_SLOTS; i++) {
      const source = this.source[i];
      if (!this.live(i) || source === player || this.reply[i] || Actors.isEnemy(player, source)) continue;
      if (best < 0 || this.order[i] > this.order[best]) best = i;
    }
    return best;
  },
  // An enemy ping follows its target while the pinger sees it (checked every HUD_PING_SIGHT_INTERVAL); out of sight it stays put.
  // Every view that draws pings calls it (world markers, minimap), so a hidden one never freezes the other.
  follow(slot) {
    const target = this.target[slot], source = this.source[slot];
    if (target < 0 || !Actors.alive[target] || !Actors.alive[source]) return;
    if (Hud.time >= this.sightAt[slot]) { this.sightAt[slot] = Hud.time + HUD_PING_SIGHT_INTERVAL; this.seen[slot] = hudSees(source, target) ? 1 : 0; }
    if (!this.seen[slot]) return;
    this.x[slot] = Actors.x[target]; this.y[slot] = Actors.y[target]; this.z[slot] = Actors.z[target];
  },
};
Bus.on('ping', (event) => HudPings.add(event));

function hudSees(viewer, target) {
  const line = hudPingSight;
  line.ax = Actors.x[viewer]; line.ay = Actors.eyeY(viewer); line.az = Actors.z[viewer];
  line.bx = Actors.x[target]; line.by = Actors.eyeY(target); line.bz = Actors.z[target];
  return World.lineClearOf(line);
}

function hudPingShape(kind, reply) {
  if (kind === 'enemy') return 'triangle';
  return reply ? 'circle' : 'diamond';
}
function hudPingColor(kind) {
  if (kind === 'enemy') return Hud.colors.bad;
  return kind === 'danger' ? HUD_COLOR.warn : Hud.colors.good;
}
function hudDrawPingMarkers(pen, layout) {
  const p = HudPings, player = Game.playerId, text = hudTextAt;
  for (let i = 0; i < HUD_PING_SLOTS; i++) {
    const source = p.source[i];
    if (!p.live(i)) continue;
    if (source !== player && (player < 0 || Actors.isEnemy(player, source))) continue;      // only your side's pings
    p.follow(i);
    hudDrawMarker(pen, layout, p.x[i], p.y[i] + 0.5, p.z[i], hudPingShape(p.kind[i], p.reply[i]), hudPingColor(p.kind[i]), -1, true);
    if (!Hud.project(p.x[i], p.y[i] + 0.5, p.z[i])) continue;
    text[0] = hudProjection.x; text[1] = hudProjection.y - 18 * layout.unit; text[2] = HUD_TEXT_SMALL * layout.unit;
    pen.labelAt(Actors.name[source], HUD_COLOR.dim, 'center');
    text[1] = hudProjection.y - 32 * layout.unit;
    if (p.reply[i]) pen.labelAt(p.reply[i], Hud.colors.good, 'center');
  }
}

// The last enemies of a PvE wave (pveHunted, 14j): a red triangle and the distance, so a cloaked or distant one can be found.
function hudDrawPveMarkers(pen, layout) {
  for (let i = 0; i < pveHunted.length; i++) {
    const id = pveHunted[i];
    if (!Actors.alive[id] || !Pve.isHostile(id)) continue;
    hudDrawMarker(pen, layout, Actors.x[id], Actors.y[id] + Actors.height[id] + HUD_TAG_HEIGHT_ABOVE, Actors.z[id], 'triangle', Hud.colors.bad, -1, true);
  }
}

function hudDrawMarkers(pen, layout) {
  hudDrawObjectiveMarkers(pen, layout);
  hudDrawPingMarkers(pen, layout);
  hudDrawPveMarkers(pen, layout);
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
    const x = hudProjection.x, y = hudProjection.y, at = hudShapeAt, text = hudTextAt;
    text[2] = HUD_TEXT_SMALL * unit;
    HudBatch.measureAt(Actors.name[id]);
    at[0] = x - text[3] / 2 - 9 * unit; at[1] = y; at[2] = 11 * unit / 2;
    if (Hud.teamShapes) pen.shapeAt(Hud.teamShape(team), Hud.teamColor(team));
    text[0] = x + (Hud.teamShapes ? 4 * unit : 0); text[1] = y;
    pen.labelAt(Actors.name[id], Hud.teamColor(team), 'center');
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
    const at = hudShapeAt, text = hudTextAt;
    at[0] = hudProjection.x; at[1] = hudProjection.y; at[2] = 8 * unit / 2;
    pen.shapeAt('square', HUD_COLOR.dim, 0.9);
    text[0] = hudProjection.x; text[1] = hudProjection.y - 14 * unit; text[2] = HUD_TEXT_SMALL * unit;
    pen.labelAt(hudNumber(timer.remaining), HUD_COLOR.text, 'center');
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
  const c = HudCaptions, unit = layout.unit, size = HudAccess.captionSize * unit, box = hudBoxAt, text = hudTextAt;
  let shown = 0, y = layout.weaponBarY - (layout.compact ? 40 : 56) * unit;
  for (let k = 1; k <= HUD_CAPTION_SLOTS && shown < HUD_CAPTION_SHOWN; k++) {
    const slot = (c.next - k + HUD_CAPTION_SLOTS) % HUD_CAPTION_SLOTS, age = Hud.time - c.at[slot];
    if (age >= HUD_CAPTION_SECONDS) continue;
    const alpha = Math.min(1, (HUD_CAPTION_SECONDS - age) / HUD_CAPTION_FADE);
    text[0] = layout.centerX; text[1] = y; text[2] = size;
    if (HudAccess.captionBackground) {
      HudBatch.measureAt(c.text[slot]);
      const width = text[3] + 16 * unit;
      box[0] = layout.centerX - width / 2; box[1] = y - size * 0.75; box[2] = width; box[3] = size * 1.5;
      pen.rectAt(HUD_COLOR.black, 0.6 * alpha);
    }
    pen.textAt(c.text[slot], HUD_COLOR.text, 'center', alpha);
    y -= size * 1.7;
    shown++;
  }
}

function hudDrawSoundRing(pen, layout) {
  const c = HudCaptions, unit = layout.unit, player = Game.playerId;
  for (let i = 0; i < HUD_SOUND_SLOTS; i++) {
    const age = Hud.time - c.soundAt[i];
    if (age >= HUD_SOUND_SECONDS) continue;
    if (player >= 0 && length2(c.soundX[i] - Render.camera.x, c.soundZ[i] - Render.camera.z) < HUD_SOUND_MIN_DISTANCE) continue;
    const angle = hudBearingTo(c.soundX[i], c.soundZ[i]), icon = HUD_SOUND_ICONS[c.soundKind[i]] || HUD_SOUND_FALLBACK;
    const at = hudShapeAt;
    at[0] = layout.centerX + Math.sin(angle) * HUD_SOUND_RADIUS * unit; at[1] = layout.centerY - Math.cos(angle) * HUD_SOUND_RADIUS * unit; at[2] = 16 * unit / 2;
    pen.shapeAt(icon.shape, icon.color, 1 - age / HUD_SOUND_SECONDS);
  }
}

// ---- HP-007 downed: teammates down (marker), the local player's bleed-out, the hold-Use hint and the revive ring ----
const HUD_DOWNED_MARKER_HEIGHT = 1.2;     // metres above a downed teammate's feet
const HUD_REVIVE_HINT_RANGE = 4;          // metres: the hold-Use hint shows this close to a downed teammate

function hudDrawDownedAllies(pen, layout) {
  const player = Game.playerId;
  if (!Damage.downedCount || player < 0 || Actors.team[player] < 0) return;   // no scan while nobody is down
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.isAlly(player, id) || !Actors.alive[id] || !(Actors.flags[id] & ACTOR_FLAG.DOWNED)) continue;
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
