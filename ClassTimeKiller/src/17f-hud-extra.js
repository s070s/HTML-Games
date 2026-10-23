// ==== S17 HUD: MINIMAP, COMPASS, AWARENESS, BARKS AND SCREEN EFFECTS ====
// Radar-style minimap (UI-003/UI-006), compass strip, the stealth awareness meter above enemy heads (UI-014), bot bark chat lines
// (BOT-100, ACC-002 subtitles), scope enemy health (H04), and the full-screen effects: flash (G-blind, ACC-005 safe), suppression (X44).
// The Hardcore HUD (X36, rules.fx.noHud) is handled by Hud itself (17a); the motion tracker (X35, rules.fx.radar) is read here.
// Everything draws through the pen of 17a into the existing layers (no allocation per frame). Contracts: docs/api/hud-play.md.

const HUD_MAP_RANGE = 40;                    // metres from the centre to the edge of the minimap
const HUD_MAP_SIZE = 116, HUD_MAP_SIZE_COMPACT = 86;   // design pixels (times the HUD unit)
const HUD_MAP_BLIP_SECONDS = 2;              // UI-006: an enemy that fired a loud shot shows for 2 s
const HUD_MAP_SHOT_NOISE = 20;               // metres of shot noise: quieter (suppressed) weapons stay off the map
const HUD_MAP_ALPHA = 0.55;
const HUD_TRACKER_MIN_SPEED = 1.5;           // m/s: the motion tracker ignores anything slower (a crouch-walk stays hidden)
const HUD_TRACKER_RANGE = 25;                // metres when the mutator names none
const HUD_TRACKER_OBSERVERS = 16;            // the player and this many living teammates share the tracker
const HUD_COMPASS_HALF_ARC = Math.PI / 2;    // the strip shows 90 degrees to each side
const HUD_COMPASS_EDGE_SHARE = 0.9;           // marks closer to the strip's end than this are drawn (none are cut by the panel edge)
const HUD_COMPASS_WIDTH = 300, HUD_COMPASS_TOP = 104;
const HUD_COMPASS_MARKS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
const HUD_AWARE_RANGE = 45, HUD_AWARE_MAX = 10, HUD_AWARE_MIN = 0.02;
const HUD_BARK_SLOTS = 6, HUD_BARK_SHOWN = 4, HUD_BARK_SECONDS = 6, HUD_BARK_FADE = 0.5;
const HUD_BARK_TAUNT = 'killTaunt';
const HUD_SCOPE_INFO_RANGE = 120;
const HUD_BLIND_SECONDS_MIN = 0.02;
const HUD_SUPPRESS_BANDS = 5, HUD_SUPPRESS_COLOR = 0x3a4048;
const HUD_JAM_BARS = 5;
const HUD_MOVE_TOP = 70, HUD_MOVE_ROW = 18, HUD_MOVE_WIDTH = 110, HUD_MOVE_BAR = 6;   // design pixels: the meter rows under the crosshair
const HUD_MOVE_PIP = 10, HUD_MOVE_PIP_GAP = 16;
const HUD_LOW_AIR = 0.35;                    // share of the breath left that warns (about 4 of the 12 s)
const HUD_BREATH_COLOR = 0x0a2a4a, HUD_BREATH_ALPHA = 0.55;

hudAddElement({ id: 'minimap', label: 'Minimap' });
hudAddElement({ id: 'compass', label: 'Compass', fallback: false });
hudAddElement({ id: 'awareness', label: 'Enemy awareness meters' });
hudAddElement({ id: 'barks', label: 'Bot chat lines (subtitles)', category: 'accessibility' });
hudAddElement({ id: 'movement', label: 'Breath, stamina and dash meters' });

// ---- Shared state ----
const HudExtra = {
  radarMode: 'off', radarRange: HUD_TRACKER_RANGE,
  revealIndex: CAT.statusEffects.byId('reveal').index,
  blipAt: new Float64Array(MAX_ACTORS).fill(-1000), blipX: new Float32Array(MAX_ACTORS), blipZ: new Float32Array(MAX_ACTORS),
  observers: new Int8Array(HUD_TRACKER_OBSERVERS), observerCount: 0,
  barkText: new Array(HUD_BARK_SLOTS).fill(''), barkName: new Array(HUD_BARK_SLOTS).fill(''), barkLabel: new Array(HUD_BARK_SLOTS).fill(''), barkTeam: new Int8Array(HUD_BARK_SLOTS),
  barkAt: new Float64Array(HUD_BARK_SLOTS).fill(-1000), barkNext: 0,
  blindWas: 0, blindBright: false,
  map: { cx: 0, cy: 0, half: 0, scale: 0, unit: 1 },
  scopeHit: makeActorHit(), scopeWall: makeHit(),

  reset() {
    this.blipAt.fill(-1000); this.barkAt.fill(-1000); this.barkNext = 0; this.blindWas = 0; this.blindBright = false;
  },
  // X35: the mutator's motion tracker settings from the running match.
  readRules() {
    const fx = Game.match && Game.match.rules ? Game.match.rules.fx : null, radar = fx ? fx.radar : null;
    this.radarMode = radar && radar.mode ? radar.mode : 'off';
    this.radarRange = radar && radar.range > 0 ? radar.range : HUD_TRACKER_RANGE;
  },
  addBark(event) {
    const slot = this.barkNext;
    this.barkNext = (slot + 1) % HUD_BARK_SLOTS;
    this.barkText[slot] = event.text; this.barkName[slot] = Actors.name[event.id] || ''; this.barkLabel[slot] = this.barkName[slot] + ': '; this.barkTeam[slot] = event.team; this.barkAt[slot] = Hud.time;
  },
};

// ---- Events ----
Bus.on('match.start', () => { HudExtra.reset(); HudExtra.readRules(); });
Bus.on('match.stop', () => HudExtra.reset());

// A loud enemy shot marks the shooter on the minimap for two seconds (UI-006); quiet (suppressed) weapons do not.
Bus.on('sound', (event) => {
  const player = Game.playerId, source = event.source;
  if (player < 0) return;
  if (event.kind === 'shot' && source >= 0 && event.radius >= HUD_MAP_SHOT_NOISE && Actors.isEnemy(player, source)) {
    HudExtra.blipAt[source] = Hud.time; HudExtra.blipX[source] = event.x; HudExtra.blipZ[source] = event.z;
  }
});

// Bark chat lines: your side's barks and the enemy kill taunts. The text doubles as the subtitle of the radio blip (ACC-002).
Bus.on('bark', (event) => {
  const player = Game.playerId;
  if (player < 0) return;
  const mine = Actors.team[player] >= 0 && event.team === Actors.team[player];
  if (!mine && event.category !== HUD_BARK_TAUNT) return;
  if (Hud.layout.phone) HudBanners.add((Actors.name[event.id] || '') + ': ' + event.text, 'bark', 0, false);
  else HudExtra.addBark(event);
});
// Announcer text is also a subtitle when captions are on.
Bus.on('announce', (event) => { if (Hud.elements.captions && event.text) HudCaptions.addCaption(event.text); });

// ---- Minimap and tracker ----
// The world point (x, z) to place is in hudShapeAt[0] and [1]; it becomes the map point there. False when it is off the map
// and not clipped to the edge. The point goes through the scratch: float arguments were boxed per dot (PERF-006).
function hudMapPlace(map, clip) {
  const camera = Render.camera, dx = hudShapeAt[0] - camera.x, dz = hudShapeAt[1] - camera.z;
  const sideways = (-dx * Math.cos(camera.yaw) + dz * Math.sin(camera.yaw)) * map.scale;     // right of the player = right on the map
  const ahead = -(dx * Math.sin(camera.yaw) + dz * Math.cos(camera.yaw)) * map.scale;        // ahead of the player = up on the map
  const inside = Math.abs(sideways) <= map.half && Math.abs(ahead) <= map.half;
  if (!inside && !clip) return false;
  const pull = inside ? 1 : map.half / Math.max(Math.abs(sideways), Math.abs(ahead));
  hudShapeAt[0] = map.cx + sideways * pull; hudShapeAt[1] = map.cy + ahead * pull;   // the next dot's place (17a)
  return true;
}

// A dot at the world point (x, z) in hudShapeAt[0] and [1] (hudMapPlace), drawn through the pen's shape scratch.
function hudMapDot(pen, map, shape, size, color, alpha, clip) {
  if (!hudMapPlace(map, clip)) return;
  hudShapeAt[2] = size * map.unit / 2;
  pen.shapeAt(shape, color, alpha);
}

function hudCollectObservers(player) {
  const list = HudExtra.observers;
  let count = 0;
  list[count++] = player;
  if (HudExtra.radarMode === 'team' && Actors.team[player] >= 0) {
    for (let id = 0; id < Actors.count && count < HUD_TRACKER_OBSERVERS; id++) {
      if (Actors.isAlly(player, id) && Actors.alive[id]) list[count++] = id;
    }
  }
  HudExtra.observerCount = count;
}

// X35: a moving, standing-or-walking actor inside the range of any observer.
function hudTracked(id) {
  if (HudExtra.radarMode === 'off') return false;
  if (length2(Actors.vx[id], Actors.vz[id]) < HUD_TRACKER_MIN_SPEED || (Actors.flags[id] & (ACTOR_FLAG.CROUCHED | ACTOR_FLAG.PRONE))) return false;
  const rangeSquared = HudExtra.radarRange * HudExtra.radarRange;
  for (let i = 0; i < HudExtra.observerCount; i++) {
    const observer = HudExtra.observers[i];
    if (distanceSquared3(Actors.x[id], 0, Actors.z[id], Actors.x[observer], 0, Actors.z[observer]) <= rangeSquared) return true;
  }
  return false;
}

function hudMapEnemies(pen, map, player) {
  hudCollectObservers(player);
  const reveal = HudExtra.revealIndex, bad = Hud.colors.bad;
  for (let id = 0; id < Actors.count; id++) {
    if (id === player || !Actors.alive[id] || !Actors.isEnemy(player, id)) continue;
    const ghost = Abilities.hiddenFromPulse !== null && Abilities.hiddenFromPulse(id);   // ECP04 Ghost perk: no tracker or shot blips
    hudShapeAt[0] = Actors.x[id]; hudShapeAt[1] = Actors.z[id];
    if (Damage.statusTime[id * STATUS_COUNT + reveal] > 0 || (!ghost && hudTracked(id))) { hudMapDot(pen, map, 'circle', 7, bad, 1, true); continue; }
    if (ghost) continue;
    const age = Hud.time - HudExtra.blipAt[id];
    hudShapeAt[0] = HudExtra.blipX[id]; hudShapeAt[1] = HudExtra.blipZ[id];
    if (age < HUD_MAP_BLIP_SECONDS) hudMapDot(pen, map, 'circle', 7, bad, 1 - age / HUD_MAP_BLIP_SECONDS * 0.6, true);
  }
}

function hudMapAllies(pen, map, player) {
  const team = Actors.team[player];
  if (team < 0) return;
  for (let id = 0; id < Actors.count; id++) {
    if (id === player || !Actors.alive[id] || Actors.team[id] !== team) continue;
    hudShapeAt[0] = Actors.x[id]; hudShapeAt[1] = Actors.z[id];
    hudMapDot(pen, map, Hud.teamShapes ? Hud.teamShape(team) : 'circle', 8, Hud.teamColor(team), 1, false);
  }
}

function hudMapObjectives(pen, map) {
  const list = Modes.objectives;
  for (let i = 0; i < list.length; i++) {
    const objective = list[i], shape = HUD_MARKER_SHAPES[objective.kind];
    if (!objective.active || !shape) continue;
    hudShapeAt[0] = objective.x; hudShapeAt[1] = objective.z;
    hudMapDot(pen, map, shape, 10, hudObjectiveColor(objective), 1, true);
  }
}

function hudMapPings(pen, map, player) {
  const p = HudPings;
  for (let i = 0; i < HUD_PING_SLOTS; i++) {
    if (!p.live(i)) continue;   // each kind's own marker life (17d)
    if (p.source[i] !== player && Actors.isEnemy(player, p.source[i])) continue;
    p.follow(i);   // also with the world markers hidden (17d)
    hudShapeAt[0] = p.x[i]; hudShapeAt[1] = p.z[i];
    hudMapDot(pen, map, 'diamond', 9, hudPingColor(p.kind[i]), 1, true);
  }
}

// The hidden map: a jammer (G18) covers the player, so the panel shows moving noise bars instead of positions.
function hudDrawMapJammed(pen, map) {
  const unit = map.unit;
  for (let i = 0; i < HUD_JAM_BARS; i++) {
    const phase = (Hud.time * 0.7 + i / HUD_JAM_BARS) % 1;
    pen.rect(map.cx - map.half, map.cy - map.half + phase * map.half * 2, map.half * 2, 3 * unit, HUD_COLOR.dim, 0.35);
  }
  pen.text('JAMMED', map.cx, map.cy, HUD_TEXT_SMALL * unit, Hud.colors.bad, 'center');
}

function hudDrawMinimap(pen, layout) {
  const player = Game.playerId;
  if (!hudLocalAlive()) return;
  const unit = layout.unit, size = (layout.compact ? HUD_MAP_SIZE_COMPACT : HUD_MAP_SIZE) * unit, half = size / 2, map = HudExtra.map;
  map.cx = layout.left + half; map.cy = layout.top + half; map.half = half; map.unit = unit;
  map.scale = half / Math.max(HUD_MAP_RANGE, HudExtra.radarMode === 'off' ? 0 : HudExtra.radarRange);
  const box = hudBoxAt;   // the pen's scratch forms: no float arguments (PERF-006)
  box[0] = map.cx - half; box[1] = map.cy - half; box[2] = size; box[3] = size;
  pen.panelAt(HUD_MAP_ALPHA);
  box[1] = map.cy - 0.5; box[3] = 1;
  pen.rectAt(HUD_COLOR.dim, 0.25);   // the cross through the centre
  box[0] = map.cx - 0.5; box[1] = map.cy - half; box[2] = 1; box[3] = size;
  pen.rectAt(HUD_COLOR.dim, 0.25);
  if (Gadgets.jammed(player)) { hudDrawMapJammed(pen, map); return; }
  hudMapObjectives(pen, map);
  hudMapPings(pen, map, player);
  hudMapAllies(pen, map, player);
  hudMapEnemies(pen, map, player);
  const corners = hudCorners;   // the player: a triangle pointing ahead, straight into the corner scratch
  corners[0] = map.cx; corners[1] = map.cy - 7 * unit; corners[2] = map.cx + 5 * unit; corners[3] = corners[5] = corners[7] = map.cy + 5 * unit;
  corners[4] = corners[6] = map.cx - 5 * unit;
  setHudPaint(HUD_COLOR.text, 1);
  pushHudSolid();
}

// ---- Compass: heading strip with the eight directions and the objective bearings ----
function hudCompassX(layout, relative, width) { return layout.centerX + relative / HUD_COMPASS_HALF_ARC * width / 2; }

function hudDrawCompass(pen, layout) {
  if (!hudLocalAlive()) return;
  const unit = layout.unit, width = HUD_COMPASS_WIDTH * unit, y = layout.top + HUD_COMPASS_TOP * unit, yaw = Render.camera.yaw;
  pen.panel(layout.centerX - width / 2, y - 11 * unit, width, 22 * unit, 0.35);
  for (let i = 0; i < HUD_COMPASS_MARKS.length; i++) {
    const relative = wrapAngle(HUD_COMPASS_MARKS[i][1] * DEG + yaw);   // north is +Z, east is -X: the heading is the negated yaw
    if (Math.abs(relative) > HUD_COMPASS_HALF_ARC * HUD_COMPASS_EDGE_SHARE) continue;
    const label = HUD_COMPASS_MARKS[i][0], x = hudCompassX(layout, relative, width);
    pen.text(label, x, y, (label.length === 1 ? HUD_TEXT_SMALL : 12) * unit, label === 'N' ? Hud.colors.bad : HUD_COLOR.text, 'center', label.length === 1 ? 1 : 0.7);
  }
  const list = Modes.objectives;
  for (let i = 0; i < list.length; i++) {
    const objective = list[i], shape = HUD_MARKER_SHAPES[objective.kind], relative = hudBearingTo(objective.x, objective.z);
    if (!objective.active || !shape || Math.abs(relative) > HUD_COMPASS_HALF_ARC * HUD_COMPASS_EDGE_SHARE) continue;
    pen.shape(shape, hudCompassX(layout, relative, width), y + 15 * unit, 9 * unit, hudObjectiveColor(objective), 1);
  }
  pen.rect(layout.centerX - 0.5, y - 14 * unit, 1, 5 * unit, HUD_COLOR.text, 0.9);
}

// ---- Stealth awareness (UI-014): fill = how aware the enemy is of you, white -> amber -> red ----
function hudMixColor(from, to, amount) {
  const r = (from >> 16 & 255) + ((to >> 16 & 255) - (from >> 16 & 255)) * amount, g = (from >> 8 & 255) + ((to >> 8 & 255) - (from >> 8 & 255)) * amount;
  const b = (from & 255) + ((to & 255) - (from & 255)) * amount;
  return (r << 16) | (g << 8) | b;
}
function hudAwarenessColor(amount) {
  return amount < 0.5 ? hudMixColor(HUD_COLOR.text, HUD_COLOR.warn, amount * 2) : hudMixColor(HUD_COLOR.warn, Hud.colors.bad, (amount - 0.5) * 2);
}

// BOT-005 / UI-014: only PvE matches (everyone on one side) and stealth modes (the ruleset's mode cloaks players that stand still) show it.
function hudAwarenessMatch() {
  const rules = Game.match && Game.match.rules;
  if (!rules) return false;
  return rules.teams === 1 || !!(rules.params && rules.params.cloakWhenStill);
}

function hudDrawAwareness(pen, layout) {
  const player = Game.playerId;
  if (player < 0 || !Actors.alive[player] || !hudAwarenessMatch()) return;
  const unit = layout.unit, camera = Render.camera, rangeSquared = HUD_AWARE_RANGE * HUD_AWARE_RANGE;
  let drawn = 0;
  for (let id = 0; id < Actors.count && drawn < HUD_AWARE_MAX; id++) {
    if (Actors.kind[id] !== ACTOR_KIND.BOT || !Actors.alive[id] || !Actors.isEnemy(player, id)) continue;
    const amount = BotSense.awareness[BotSense.pair(id, player)];
    if (amount < HUD_AWARE_MIN || distanceSquared3(Actors.x[id], 0, Actors.z[id], Actors.x[player], 0, Actors.z[player]) > rangeSquared) continue;
    const headY = Actors.y[id] + Actors.height[id] + 0.35;
    if (!Hud.project(Actors.x[id], headY, Actors.z[id])) continue;
    if (!World.lineClear(camera.x, camera.y, camera.z, Actors.x[id], headY, Actors.z[id])) continue;   // never shows through walls
    const width = 34 * unit, height = 5 * unit, x = hudProjection.x - width / 2, y = hudProjection.y - height;
    pen.bar(x, y, width, height, amount, hudAwarenessColor(amount), 1);
    if (amount >= 1) pen.label('!', hudProjection.x, y - 9 * unit, 16 * unit, Hud.colors.bad, 'center');
    drawn++;
  }
}

// ---- Bark chat lines under the minimap ----
function hudDrawBarks(pen, layout) {
  const c = HudExtra, unit = layout.unit, size = HUD_TEXT_SMALL * unit, line = size * 1.5;
  let y = Hud.elements.minimap ? layout.top + ((layout.compact ? HUD_MAP_SIZE_COMPACT : HUD_MAP_SIZE) + 18) * unit : layout.top + size;
  for (let k = HUD_BARK_SHOWN; k >= 1; k--) {   // the newest few, oldest first
    const slot = (c.barkNext - k + HUD_BARK_SLOTS) % HUD_BARK_SLOTS, age = Hud.time - c.barkAt[slot];
    if (age >= HUD_BARK_SECONDS) continue;
    const alpha = Math.min(1, (HUD_BARK_SECONDS - age) / HUD_BARK_FADE), text = hudTextAt;   // the text scratch (PERF-006)
    text[0] = layout.left; text[1] = y; text[2] = size;
    pen.labelAt(c.barkLabel[slot], c.barkTeam[slot] >= 0 ? Hud.teamColor(c.barkTeam[slot]) : HUD_COLOR.warn, 'left', alpha);
    text[0] = layout.left + text[3];   // the line goes on after the name
    pen.labelAt(c.barkText[slot], HUD_COLOR.text, 'left', alpha);
    y += line;
  }
}

// ---- H04 scope info: while scoped, the enemy under the crosshair shows its health ----
function hudDrawScopeInfo(pen, layout) {
  const id = Game.playerId;
  if (!hudLocalAlive() || !Abilities.passiveFlag(id, 'scopeInfo') || hudScopeAmount(id, Weapons.currentWeapon(id) || HUD_NO_WEAPON) <= 0) return;
  const camera = Render.camera, cosPitch = Math.cos(camera.pitch), dx = Math.sin(camera.yaw) * cosPitch, dy = Math.sin(camera.pitch), dz = Math.cos(camera.yaw) * cosPitch;
  const target = World.raycastActors(camera.x, camera.y, camera.z, dx, dy, dz, HUD_SCOPE_INFO_RANGE, id, HudExtra.scopeHit);
  if (target < 0 || !Actors.isEnemy(id, target)) return;
  const wall = World.raycast(camera.x, camera.y, camera.z, dx, dy, dz, HudExtra.scopeHit.distance, HudExtra.scopeWall);
  if (wall) return;
  const unit = layout.unit, x = layout.centerX + 70 * unit, y = layout.centerY, width = 110 * unit;
  pen.panel(x - 6 * unit, y - 20 * unit, width + 12 * unit, 42 * unit, 0.6);
  pen.text(Actors.name[target], x, y - 10 * unit, HUD_TEXT_SMALL * unit, HUD_COLOR.text, 'left');
  pen.bar(x, y + 6 * unit, width, 8 * unit, Actors.health[target] / Math.max(Actors.maxHealth[target], 1), Hud.colors.health, 1);
}
const HUD_NO_WEAPON = { alt: null };

// ---- Movement meter under the crosshair: breath (MOV-019) and the preset's stamina, glide and charges, each only while used ----
// Rows appear while a resource is below full: breath under water, sprint stamina, glide time, dash and tactical-sprint charges.
// Low air turns the label to a blinking LOW AIR, an empty breath to DROWNING, and the screen edges darken (steady under reduce motion).
const hudMoveMeters = { air: 1, stamina: 1, glide: 1, dash: 0, dashMax: 0, tac: 0, tacMax: 0, rows: 0 };   // the last frame's values (self-test)
function hudDrawMovement(pen, layout) {
  const meters = hudMoveMeters;
  meters.rows = 0;
  if (!hudLocalAlive()) return;
  Move.meters(Game.playerId, meters);
  if (meters.air < 1) hudMoveBar(pen, layout, 'air', meters.air <= 0 ? 'DROWNING' : meters.air < HUD_LOW_AIR ? 'LOW AIR' : 'AIR');
  if (meters.stamina < 1) hudMoveBar(pen, layout, 'stamina', 'STAMINA');
  if (meters.glide < 1) hudMoveBar(pen, layout, 'glide', 'GLIDE');
  if (meters.dash < meters.dashMax) hudMovePips(pen, layout, 'dash', 'dashMax', 'DASH');
  if (meters.tac < meters.tacMax) hudMovePips(pen, layout, 'tac', 'tacMax', 'SPRINT');
}

// The next row's centre line (rows stack downward from under the crosshair); the label sits right-aligned before the bar.
function hudMoveRowY(pen, layout, label, color) {
  const unit = layout.unit, y = layout.centerY + (HUD_MOVE_TOP + hudMoveMeters.rows++ * HUD_MOVE_ROW) * unit, text = hudTextAt;
  text[0] = layout.centerX - (HUD_MOVE_WIDTH / 2 + 6) * unit; text[1] = y; text[2] = HUD_TEXT_SMALL * unit;
  pen.labelAt(label, color, 'right');
  return y;
}

// A bar of the share in hudMoveMeters[field] (fields, not float arguments: PERF-006). Low air blinks in the warning colour.
function hudMoveBar(pen, layout, field, label) {
  const share = hudMoveMeters[field], unit = layout.unit, warning = field === 'air' && share < HUD_LOW_AIR;
  const color = share <= 0 ? Hud.colors.bad : warning ? HUD_COLOR.warn : field === 'air' ? HUD_COLOR.shield : HUD_COLOR.text;
  const y = hudMoveRowY(pen, layout, label, color), box = hudBoxAt;
  box[0] = layout.centerX - HUD_MOVE_WIDTH / 2 * unit; box[1] = y - HUD_MOVE_BAR / 2 * unit; box[2] = HUD_MOVE_WIDTH * unit; box[3] = HUD_MOVE_BAR * unit; box[4] = share;
  pen.barAt(color, warning && !Hud.reduceMotion() ? 0.6 + 0.4 * Math.sin(Hud.time * Math.PI * 2 * HUD_PULSE_HZ) : 1);
}

// One square per charge of hudMoveMeters[field] (out of [maxField]): bright when ready, dim while recharging.
function hudMovePips(pen, layout, field, maxField, label) {
  const unit = layout.unit, ready = Math.floor(hudMoveMeters[field]), maximum = hudMoveMeters[maxField], shape = hudShapeAt;
  const y = hudMoveRowY(pen, layout, label, HUD_COLOR.text);
  for (let i = 0; i < maximum; i++) {
    shape[0] = layout.centerX + (i * HUD_MOVE_PIP_GAP - HUD_MOVE_WIDTH / 2 + HUD_MOVE_PIP / 2) * unit; shape[1] = y; shape[2] = HUD_MOVE_PIP / 2 * unit;
    pen.shapeAt('square', i < ready ? HUD_COLOR.gold : HUD_COLOR.dim, i < ready ? 1 : 0.4);
  }
}

// Low air darkens the screen edges, more as the breath runs out (the vignette of the movement element).
function hudDrawBreathVignette(pen, layout) {
  if (!hudLocalAlive()) return;
  const air = Move.airShare(Game.playerId);
  if (air >= HUD_LOW_AIR) return;
  const strength = (1 - air / HUD_LOW_AIR) * HUD_BREATH_ALPHA, width = layout.width, height = layout.height, edge = Math.min(width, height) * 0.18;
  pen.rect(0, 0, width, height, HUD_BREATH_COLOR, strength * 0.4);
  pen.rect(0, 0, width, edge, HUD_BREATH_COLOR, strength);
  pen.rect(0, height - edge, width, edge, HUD_BREATH_COLOR, strength);
  pen.rect(0, edge, edge, height - edge * 2, HUD_BREATH_COLOR, strength);
  pen.rect(width - edge, edge, edge, height - edge * 2, HUD_BREATH_COLOR, strength);
}

// ---- Full-screen effects: flash (blind) and suppression blur ----
// A blind starts as a bright flash only when the 3-per-second cap allows it and photosensitivity is off; otherwise it fades in dark.
function hudDrawBlind(pen, layout) {
  const id = Game.playerId;
  if (id < 0 || !Actors.alive[id]) return;
  const amount = Gadgets.blindAmount(id), c = HudExtra;
  if (amount > HUD_BLIND_SECONDS_MIN && c.blindWas <= HUD_BLIND_SECONDS_MIN) c.blindBright = Hud.flashAllowed();
  c.blindWas = amount;
  if (amount <= HUD_BLIND_SECONDS_MIN) return;
  const color = c.blindBright ? Hud.flashColor(HUD_COLOR.text) : HUD_COLOR.black;
  pen.rect(0, 0, layout.width, layout.height, color, Hud.flashAlpha(c.blindBright ? amount : amount * 0.8));
}

// X44: shots passing close blur the view. Quads cannot blur, so the screen edges fill with grey haze bands (steady under reduce motion).
function hudDrawSuppression(pen, layout) {
  const id = Game.playerId;
  if (id < 0 || !Actors.alive[id]) return;
  const amount = Mutators.suppression(id);
  if (amount <= 0) return;
  const wobble = Hud.reduceMotion() ? 1 : 0.9 + 0.1 * Math.sin(Hud.time * Math.PI * 2 * HUD_PULSE_HZ), width = layout.width, height = layout.height;
  const edge = Math.min(width, height) * 0.3, strength = amount * 0.5 * wobble / HUD_SUPPRESS_BANDS;
  pen.rect(0, 0, width, height, HUD_SUPPRESS_COLOR, amount * 0.18);
  for (let i = 0; i < HUD_SUPPRESS_BANDS; i++) {
    const band = edge * (HUD_SUPPRESS_BANDS - i) / HUD_SUPPRESS_BANDS;
    pen.rect(0, 0, width, band, HUD_SUPPRESS_COLOR, strength);
    pen.rect(0, height - band, width, band, HUD_SUPPRESS_COLOR, strength);
    pen.rect(0, band, band, height - band * 2, HUD_SUPPRESS_COLOR, strength);
    pen.rect(width - band, band, band, height - band * 2, HUD_SUPPRESS_COLOR, strength);
  }
}

Hud.register('main', 'minimap', 'minimap', hudDrawMinimap);
// Touch buttons give way to the minimap at the top left (05b keepClear, touch-01), as hudDrawMinimap sizes it.
const hudMinimapClearLayout = {};
TouchInput.keepClear.push((width, height) => {
  const layout = hudMinimapClearLayout;
  updateHudLayout(layout, width, height);
  const size = (layout.compact ? HUD_MAP_SIZE_COMPACT : HUD_MAP_SIZE) * layout.unit;
  if (Hud.elements.minimap) TouchInput.addClear(layout.left, layout.top, layout.left + size, layout.top + size);
});
Hud.register('main', 'compass', 'compass', hudDrawCompass);
Hud.register('world', 'awareness', 'awareness', hudDrawAwareness);
Hud.register('main', 'barks', 'barks', hudDrawBarks);
Hud.register('main', 'scopeInfo', 'crosshair', hudDrawScopeInfo);
Hud.register('main', 'movement', 'movement', hudDrawMovement);
Hud.register('back', 'breath', 'movement', hudDrawBreathVignette);
Hud.register('back', 'suppression', '', hudDrawSuppression, true);
Hud.register('front', 'blind', '', hudDrawBlind, true);
