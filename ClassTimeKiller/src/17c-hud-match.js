// ==== S17 HUD: MATCH STATE ====
// Header per mode from Modes.hudState() (team scores, free-for-all rank and leader, timer, rounds, objective chips), the kill feed
// with weapon and headshot icons drawn from shapes, announcer and medal banners (UI-012), and the respawn / spectate text.

const HUD_FEED_SLOTS = 8, HUD_FEED_SECONDS = 6, HUD_FEED_FADE = 0.5, HUD_FEED_ROWS = 5, HUD_FEED_ROWS_COMPACT = 3;
const HUD_BANNER_SLOTS = 4, HUD_BANNER_SECONDS = 2.6, HUD_BANNER_SECONDS_LONG = 3.4, HUD_BANNER_FADE = 0.5, HUD_BANNER_SHOWN = 3;
const HUD_BANNER_QUEUE = 1.2;   // s: on a phone a new banner waits this long after the start of the last one (one line, each in turn)
const HUD_BANNER_PRIORITY_LONG = 2;
const HUD_MAX_OBJECTIVE_CHIPS = 6;
const HUD_FALLBACK_NAME = 'Player';
const HUD_CAMEL_BREAK = /([a-z])([A-Z])/g;
const HUD_FEED_FIT_WIDTH = 170;   // design pixels: the kill feed room the auto-fit (17a) keeps right of the score panel (touch names are cut to the room left)
const HUD_FEED_ICON = 34, HUD_FEED_HEAD = 16, HUD_FEED_PAD = 6;   // design pixels: weapon icon, headshot icon and padding widths in a row

// ---- Kill feed: a ring of the last HUD_FEED_SLOTS kills, oldest first when drawn ----
const HudFeed = {
  killer: new Array(HUD_FEED_SLOTS).fill(''), victim: new Array(HUD_FEED_SLOTS).fill(''), weaponClass: new Array(HUD_FEED_SLOTS).fill(''),
  killerCut: new Array(HUD_FEED_SLOTS).fill(''), victimCut: new Array(HUD_FEED_SLOTS).fill(''),   // touch: the names cut to fit (hudFeedCutNames)
  cutKey: new Float64Array(HUD_FEED_SLOTS),   // the room, text size and floor the cut names were made for (0: not yet)
  killerColor: new Uint32Array(HUD_FEED_SLOTS), victimColor: new Uint32Array(HUD_FEED_SLOTS), flags: new Uint8Array(HUD_FEED_SLOTS),
  at: new Float64Array(HUD_FEED_SLOTS).fill(-1000), next: 0, count: 0,
  FLAG_HEAD: 1, FLAG_MINE: 2, FLAG_SELF: 4, FLAG_WORLD: 8,

  reset() { this.at.fill(-1000); this.next = 0; this.count = 0; },
  add(event) {
    const slot = this.next, killer = event.killer, victim = event.victim;
    this.next = (slot + 1) % HUD_FEED_SLOTS;
    if (this.count < HUD_FEED_SLOTS) this.count++;
    const world = killer < 0, own = killer === victim;
    const weapon = CAT.weapons.byId(event.weapon);
    this.killer[slot] = world ? '' : Actors.name[killer] || HUD_FALLBACK_NAME;
    this.victim[slot] = Actors.name[victim] || HUD_FALLBACK_NAME;
    this.weaponClass[slot] = weapon ? weapon.class : ''; this.cutKey[slot] = 0;
    this.killerColor[slot] = world ? 0 : Hud.actorColor(killer);
    this.victimColor[slot] = Hud.actorColor(victim);
    this.flags[slot] = (event.zone === 'head' ? this.FLAG_HEAD : 0) | (killer === Game.playerId || victim === Game.playerId ? this.FLAG_MINE : 0)
      | (own ? this.FLAG_SELF : 0) | (world ? this.FLAG_WORLD : 0);
    this.at[slot] = Hud.time;
  },
  // Slot of the n-th live entry counting from the oldest (n = 0); -1 past the end. Entries expire after HUD_FEED_SECONDS.
  slotAt(n, now) {
    let seen = 0;
    for (let k = this.count; k >= 1; k--) {
      const slot = (this.next - k + HUD_FEED_SLOTS) % HUD_FEED_SLOTS;
      if (now - this.at[slot] >= HUD_FEED_SECONDS) continue;
      if (seen === n) return slot;
      seen++;
    }
    return -1;
  },
  liveCount(now) {
    let live = 0;
    for (let k = 0; k < this.count; k++) if (now - this.at[(this.next - 1 - k + HUD_FEED_SLOTS) % HUD_FEED_SLOTS] < HUD_FEED_SECONDS) live++;
    return live;
  },
};

const HUD_HEADER_WIDTH = 320;   // units: the score, clock and round panel at the top centre
// Header rows (centre lines in units below the HUD top): the line under the clock ("FIRST TO 25", GET READY) and free-for-all
// lives, which reach past the panel's edge on small screens (the text floor), then round pips, control meters and objective
// chips (lower under pips) with their note line (bomb timer, flag state).
const HUD_LIMIT_Y = 37, HUD_LIVES_Y = 41, HUD_PIPS_Y = 56, HUD_METERS_Y = 68, HUD_CHIPS_Y = 74, HUD_CHIPS_Y_ROUNDS = 92, HUD_CHIP_NOTE = 22;

// The score panel's box (hudBoxAt form: x, y, width, height): one source for the drawing, the touch buttons and the tests.
function hudHeaderBox(layout, box) {
  const unit = layout.unit, width = HUD_HEADER_WIDTH * unit;
  box[0] = layout.centerX - width / 2; box[1] = layout.top; box[2] = width; box[3] = 44 * unit;   // 44 units: behind the score and the clock
  return box;
}

function hudDrawHeadIcon(pen, x, y, size, alpha) {
  pen.ring(x, y, size * 0.4, Math.max(1.5, size * 0.14), HUD_COLOR.gold, alpha);
  pen.rect(x - size * 0.09, y - size * 0.09, size * 0.18, size * 0.18, HUD_COLOR.gold, alpha);
}

// One kill feed row, `row` rows down from the top right. The numbers go through the pen's scratch forms (PERF-006).
function hudDrawFeedRow(pen, layout, slot, row) {
  const feed = HudFeed, unit = layout.unit, size = 15 * unit, iconWidth = HUD_FEED_ICON * unit, flags = feed.flags[slot];
  const remaining = HUD_FEED_SECONDS - (Hud.time - feed.at[slot]), alpha = remaining < HUD_FEED_FADE ? remaining / HUD_FEED_FADE : 1;
  const world = (flags & feed.FLAG_WORLD) !== 0, self = (flags & feed.FLAG_SELF) !== 0, text = hudTextAt, box = hudBoxAt, shape = hudShapeAt;
  const cut = layout.touch && layout.width > layout.height;   // landscape touch: beside the score panel (portrait has no room there)
  if (cut) hudFeedCutNames(layout, slot, size);
  const killer = cut ? feed.killerCut[slot] : feed.killer[slot], victim = cut ? feed.victimCut[slot] : feed.victim[slot];
  text[2] = size;
  HudPen.measureAt(String(victim));
  const victimWidth = text[3];
  let killerWidth = 0;
  if (!world && !self) { HudPen.measureAt(String(killer)); killerWidth = text[3]; }
  const headWidth = flags & feed.FLAG_HEAD ? HUD_FEED_HEAD * unit : 0, pad = HUD_FEED_PAD * unit;
  const width = pad * 2 + victimWidth + killerWidth + iconWidth + headWidth + (killerWidth ? pad : 0);
  const left = layout.right - width, mid = layout.top + 11 * unit + row * 25 * unit;
  box[0] = left; box[1] = mid - 11 * unit; box[2] = width; box[3] = 22 * unit;
  pen.panelAt(0.5 * alpha);
  box[2] = 3 * unit;
  if (flags & feed.FLAG_MINE) pen.rectAt(HUD_COLOR.gold, alpha);
  let x = left + pad;
  text[1] = mid;
  if (killerWidth) { text[0] = x; pen.textAt(killer, feed.killerColor[slot], 'left', alpha); x += killerWidth + pad; }
  shape[0] = text[0] = x + iconWidth / 2; shape[1] = mid; shape[2] = iconWidth / 2;
  if (feed.weaponClass[slot]) pen.weaponIconAt(feed.weaponClass[slot], HUD_COLOR.text, alpha);
  else pen.textAt('×', HUD_COLOR.dim, 'center', alpha);
  x += iconWidth;
  if (headWidth) { hudDrawHeadIcon(pen, x + headWidth / 2, mid, headWidth, alpha); x += headWidth; }
  text[0] = x;
  pen.textAt(victim, feed.victimColor[slot], 'left', alpha);
}
// Touch: the names of a feed entry cut with an ellipsis so the row fits right of the score panel (a short name gives its spare
// room to the other); made again only when that room, the text size or its floor changes, not per frame.
function hudFeedCutNames(layout, slot, size) {
  const feed = HudFeed, unit = layout.unit, free = layout.right - layout.centerX - (HUD_HEADER_WIDTH / 2 + HUD_FIT_GAP) * unit;
  const room = free - (HUD_FEED_ICON + HUD_FEED_HEAD + 3 * HUD_FEED_PAD) * unit, half = room / 2, key = room * 1000 + size + Hud.textFloor / 1000;
  if (feed.cutKey[slot] === key) return;
  feed.cutKey[slot] = key;
  const killer = feed.flags[slot] & feed.FLAG_SELF ? '' : feed.killer[slot];   // a self kill draws no killer: the victim takes the room
  const victim = feed.victim[slot], killerWidth = HudPen.measure(killer, size), victimWidth = HudPen.measure(victim, size);
  const killerRoom = victimWidth <= half ? room - victimWidth : Math.max(half, room - killerWidth);
  feed.killerCut[slot] = hudCutText(killer, size, killerRoom);
  feed.victimCut[slot] = hudCutText(victim, size, room - Math.min(killerWidth, killerRoom));
}
// The text, or its longest start with an ellipsis that is at most `room` pixels wide at a size.
function hudCutText(text, size, room) {
  if (HudPen.measure(text, size) <= room) return text;
  let length = text.length - 1;
  while (length > 0 && HudPen.measure(text.slice(0, length).trimEnd() + '…', size) > room) length--;
  return text.slice(0, length).trimEnd() + '…';
}

function hudDrawKillFeed(pen, layout) {
  const now = Hud.time, maxRows = layout.compact ? HUD_FEED_ROWS_COMPACT : HUD_FEED_ROWS, live = HudFeed.liveCount(now);
  const first = Math.max(0, live - maxRows);
  for (let n = first; n < live; n++) hudDrawFeedRow(pen, layout, HudFeed.slotAt(n, now), n - first);
}

Bus.on('kill', (event) => HudFeed.add(event));

// ---- Banners: announcer text and your own medals, newest on top ----
const HudBanners = {
  text: new Array(HUD_BANNER_SLOTS).fill(''), kind: new Array(HUD_BANNER_SLOTS).fill(''), priority: new Uint8Array(HUD_BANNER_SLOTS),
  medal: new Uint8Array(HUD_BANNER_SLOTS), at: new Float64Array(HUD_BANNER_SLOTS).fill(-1000), next: 0,
  free: true, top: 0,   // the last drawn stack: clear of the touch buttons (false: no free place, at the usual top) and its first line's y

  reset() { this.at.fill(-1000); this.next = 0; },
  add(text, kind, priority, medal) {
    for (let i = 0; i < HUD_BANNER_SLOTS; i++) {
      if (this.ends(i) > Hud.time && this.text[i] === text) { this.at[i] = Math.max(this.at[i], this.queueStart(i)); return; }   // a repeat restarts it (on a phone after the others): never twice at once
    }
    const slot = Hud.layout.phone ? this.phoneSlot(priority) : this.next;
    if (slot < 0) return;
    this.next = (slot + 1) % HUD_BANNER_SLOTS;
    this.text[slot] = text; this.kind[slot] = kind; this.priority[slot] = priority; this.medal[slot] = medal ? 1 : 0; this.at[slot] = this.queueStart(slot);
  },
  // When a banner in this slot starts: now, and on a phone HUD_BANNER_QUEUE after the latest start of the other banners still to show.
  queueStart(skip) {
    let start = Hud.time;
    if (Hud.layout.phone) for (let i = 0; i < HUD_BANNER_SLOTS; i++) if (i !== skip && this.ends(i) > Hud.time) start = Math.max(start, this.at[i] + HUD_BANNER_QUEUE);
    return start;
  },
  // Phones: the ring slot for a new banner of this priority, -1 to drop it. Rule: take a slot whose banner has ended or has started
  // and is no longer the one on the line (it cannot come back); with none, the lowest-priority banner goes (the oldest of equals:
  // the one on the line before any that still waits), and a new banner below even that one is dropped. Medals carry HUD_BANNER_PRIORITY_LONG, so a medal or a long banner is never lost to a lower one.
  phoneSlot(newPriority) {
    let victim = -1;
    const shown = this.newest();
    for (let i = 0; i < HUD_BANNER_SLOTS; i++) {
      if (this.ends(i) <= Hud.time || (i !== shown && this.at[i] <= Hud.time)) return i;
      if (victim < 0 || this.priority[i] < this.priority[victim] || (this.priority[i] === this.priority[victim] && this.at[i] < this.at[victim])) victim = i;
    }
    return newPriority < this.priority[victim] ? -1 : victim;
  },
  ends(slot) { return this.at[slot] + this.seconds(slot); },
  // Phones: true while a new banner would wait its turn; a chat line is then dropped, never queued ahead of a game banner.
  busy() { for (let i = 0; i < HUD_BANNER_SLOTS; i++) if (this.at[i] + HUD_BANNER_QUEUE > Hud.time) return true; return false; },
  seconds(slot) { return this.priority[slot] >= HUD_BANNER_PRIORITY_LONG || this.medal[slot] ? HUD_BANNER_SECONDS_LONG : HUD_BANNER_SECONDS; },
  live(slot) { return Hud.time >= this.at[slot] && Hud.time < this.ends(slot); },   // a queued banner (at in the future) is not shown yet
  alpha(slot) { const age = Hud.time - this.at[slot]; return Math.min(1, age / 0.15, (this.seconds(slot) - age) / HUD_BANNER_FADE); },
  // The newest banner still shown, -1 none: the latest start (a phone's slots are not taken in ring order), the higher slot on a tie.
  newest() {
    let newest = -1;
    for (let slot = 0; slot < HUD_BANNER_SLOTS; slot++) if (this.live(slot) && (newest < 0 || this.at[slot] >= this.at[newest])) newest = slot;
    return newest;
  },
};
// Phones: the newest banner alone, small and on one line, takes the panel line under the clock ("FIRST TO", GET READY) for its
// life, so nothing is drawn between the header rows and the crosshair (objective rows reach the aim zone there: no room for a strip).
function hudPhoneBanner(layout) { return layout.phone ? HudBanners.newest() : -1; }

// The phone banner line fits the gap between the two team underlines (they end 82 units either side of the centre line, 6 units
// of air kept), so it never crosses an underline or the panel edge: a longer text is cut short with an ellipsis (the size stays at
// the 14 px floor). Cached per text and width: the cut is made once, not every frame.
const HUD_BANNER_PHONE_WIDTH = 152;   // units
let hudFitSource = '', hudFitText = '', hudFitWidth = -1, hudFitFloor = -1;
function hudFitPhoneBanner(text, size, width) {
  if (text === hudFitSource && width === hudFitWidth && Hud.textFloor === hudFitFloor) return hudFitText;
  hudFitSource = text; hudFitWidth = width; hudFitFloor = Hud.textFloor;
  hudFitText = hudCutText(text, size, width);
  return hudFitText;
}

// "doubleKill" -> "Double Kill" when the medals catalogue (15.6) has no row yet.
function hudMedalTitle(medal) {
  const row = CAT.medals ? CAT.medals.byId(medal) : null;
  if (row) return row.name;
  const spaced = String(medal).replace(HUD_CAMEL_BREAK, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

Bus.on('announce', (event) => HudBanners.add(event.text, event.kind, event.priority, false));
Bus.on('medal', (event) => { if (event.id === Game.playerId && event.id >= 0) HudBanners.add(hudMedalTitle(event.medal), 'medal', HUD_BANNER_PRIORITY_LONG, true); });

// ---- Banners and touch buttons (touch-01): the stack of shown banners moves down as one block to the first place where no
// shown touch button meets a line, while its last line stays above the aim zone (05b TouchInput.aim: never onto the
// crosshair). With no such place it stays where it always was, translucent buttons over the text: never hidden.
const HUD_BANNER_STEP = 2;            // px between the places tried
const HUD_BANNER_OVERHANG = 0.25;     // of the text size: an end glyph's atlas cell reaches past the measured width
const hudBannerSlot = new Int8Array(HUD_BANNER_SHOWN), hudBannerSize = new Float64Array(HUD_BANNER_SHOWN), hudBannerHalf = new Float64Array(HUD_BANNER_SHOWN);
function hudBannerLineFree(layout, y, half, size) {
  const reach = hudLabelReach(size), wide = half + reach - hudTextHalf(size) + size * HUD_BANNER_OVERHANG;
  for (let i = 0; i < TOUCH_CONTROLS.length; i++) {
    const place = TouchInput.places[TOUCH_CONTROLS[i].id];
    if (place.shown && Math.abs(place.x - layout.centerX) < wide + place.radius && Math.abs(place.y - y) < reach + place.radius) return false;
  }
  return true;
}
function hudBannersFreeAt(layout, top, count) {
  let y = top;
  for (let i = 0; i < count; i++) {
    if (!hudBannerLineFree(layout, y, hudBannerHalf[i], hudBannerSize[i])) return false;
    y += hudBannerSize[i] * 1.35;
  }
  return true;
}
// The first line's y for count collected banners: the usual top, or lower where the lines are clear of the touch buttons.
function hudBannersTop(layout, count) {
  const top = layout.height * 0.22, b = HudBanners;
  b.free = true;
  if (!TouchInput.shown || hudBannersFreeAt(layout, top, count)) return top;
  let height = 0;
  for (let i = 0; i < count; i++) height += hudBannerSize[i] * 1.35;
  const lastSize = hudBannerSize[count - 1], lowest = TouchInput.aim.y - TouchInput.aim.radius - hudLabelReach(lastSize) - height + lastSize * 1.35;
  for (let y = top + HUD_BANNER_STEP; y <= lowest; y += HUD_BANNER_STEP) if (hudBannersFreeAt(layout, y, count)) return y;
  b.free = false;
  return top;
}
function hudDrawBanners(pen, layout) {
  const b = HudBanners, unit = layout.unit, phone = hudPhoneBanner(layout);
  if (phone >= 0) { const size = HUD_TEXT_SMALL * unit; pen.text(hudFitPhoneBanner(b.text[phone], size, HUD_BANNER_PHONE_WIDTH * unit), layout.centerX, layout.top + HUD_LIMIT_Y * unit, size, b.medal[phone] ? HUD_COLOR.gold : HUD_COLOR.text, 'center', b.alpha(phone)); return; }
  let count = 0;
  for (let k = 1; k <= HUD_BANNER_SLOTS && count < HUD_BANNER_SHOWN; k++) {
    const slot = (b.next - k + HUD_BANNER_SLOTS) % HUD_BANNER_SLOTS;
    if (!b.live(slot)) continue;
    const size = (b.medal[slot] ? 30 : b.priority[slot] >= HUD_BANNER_PRIORITY_LONG ? 26 : 20) * unit;
    hudBannerSlot[count] = slot; hudBannerSize[count] = size;
    hudBannerHalf[count] = HudPen.measure(b.text[slot], size) / 2 + (b.medal[slot] ? size * 1.4 : 0);   // the stars reach 1.4 sizes past the text
    count++;
  }
  if (count === 0) return;
  let y = b.top = hudBannersTop(layout, count);
  for (let i = 0; i < count; i++) {
    const slot = hudBannerSlot[i], size = hudBannerSize[i];
    const alpha = b.alpha(slot), textHalf = hudBannerHalf[i] - (b.medal[slot] ? size * 1.4 : 0);
    if (b.medal[slot]) {
      pen.label('★', layout.centerX - textHalf - size * 0.9, y, size, HUD_COLOR.gold, 'center', alpha);
      pen.label('★', layout.centerX + textHalf + size * 0.9, y, size, HUD_COLOR.gold, 'center', alpha);
    }
    pen.label(b.text[slot], layout.centerX, y, size, b.medal[slot] ? HUD_COLOR.gold : HUD_COLOR.text, 'center', alpha);
    y += size * 1.35;
  }
}

// ---- Header ----
const hudObjectiveText = { planted: 'BOMB', dropped: 'DROPPED', carried: 'TAKEN' };

// The team's score at the left or right end of the header panel (the side by team: no x as a float argument, PERF-006).
function hudDrawTeamScore(pen, layout, team, score) {
  const unit = layout.unit, color = Hud.teamColor(team), mine = Actors.team[Game.playerId] === team, left = team === 0;
  const edge = layout.centerX + (left ? -1 : 1) * (HUD_HEADER_WIDTH / 2 - 4) * unit, side = left ? 1 : -1, y = layout.top + 17 * unit;
  const shape = hudShapeAt, text = hudTextAt, box = hudBoxAt;
  shape[0] = edge + side * 12 * unit; shape[1] = y; shape[2] = 7 * unit;
  pen.shapeAt(Hud.teamShapes ? Hud.teamShape(team) : 'square', color);
  text[0] = edge + side * 26 * unit; text[1] = y; text[2] = 26 * unit;
  pen.textAt(hudNumber(score), HUD_COLOR.text, left ? 'left' : 'right');
  box[0] = left ? edge : edge - 74 * unit; box[1] = layout.top + 34 * unit; box[2] = 74 * unit; box[3] = 3 * unit;
  if (mine) pen.rectAt(color, 1);
}

function hudDrawTime(pen, layout, state) {
  const unit = layout.unit, x = layout.centerX, y = layout.top + 15 * unit, text = hudTextAt;   // the text scratch (PERF-006)
  text[0] = x; text[1] = y + 21 * unit; text[2] = 14 * unit;
  if (state.overtime) pen.textAt('OVERTIME', Hud.colors.bad, 'center');
  text[1] = y; text[2] = 24 * unit;
  if (state.timeLeft > 0) pen.textAt(hudTime(state.timeLeft), state.timeLeft <= 30 ? Hud.colors.bad : HUD_COLOR.text, 'center');
  text[1] = layout.top + HUD_LIMIT_Y * unit; text[2] = 14 * unit;
  if (hudPhoneBanner(layout) >= 0) return;   // a phone banner has this line for now
  if (state.phase === 'freeze') pen.textAt('GET READY', HUD_COLOR.warn, 'center');
  else if (state.phase === 'roundEnd') pen.textAt('ROUND OVER', HUD_COLOR.warn, 'center');
  else if (state.scoreLimit > 0 && state.roundsToWin === 0 && !state.overtime) hudDrawScoreLimit(pen, layout, state.scoreLimit);
}

// "FIRST TO 25" under the clock (on the line hudDrawTime set): the label ends and the number starts at the centre line.
function hudDrawScoreLimit(pen, layout, limit) {
  const unit = layout.unit, text = hudTextAt;
  text[0] = layout.centerX - 3 * unit;
  pen.textAt('FIRST TO', HUD_COLOR.dim, 'right');
  text[0] = layout.centerX + 3 * unit;
  pen.textAt(hudNumber(limit), HUD_COLOR.dim, 'left');
}

function hudDrawRoundPips(pen, layout, state) {
  const unit = layout.unit, y = layout.top + HUD_PIPS_Y * unit, wins = Math.max(state.roundsToWin, 1);
  pen.text('ROUND', layout.centerX, y, 14 * unit, HUD_COLOR.dim, 'center');
  pen.text(hudNumber(state.round), layout.centerX + 40 * unit, y, 14 * unit, HUD_COLOR.text, 'left');
  for (let team = 0; team < 2; team++) {
    const side = team === 0 ? -1 : 1;
    for (let pip = 0; pip < wins; pip++) {
      const x = layout.centerX + side * (66 + pip * 12) * unit;
      pen.shape(pip < state.teamRounds[team] ? 'square' : 'diamond', x, y, 8 * unit, pip < state.teamRounds[team] ? Hud.teamColor(team) : HUD_COLOR.dim, 0.9);
    }
  }
}

function hudDrawFreeForAllScore(pen, layout, state) {
  const unit = layout.unit, y = layout.top + 17 * unit, x = layout.centerX;
  pen.text('#', x - 144 * unit, y, 22 * unit, HUD_COLOR.dim, 'left');
  pen.text(hudNumber(state.playerRank), x - 132 * unit, y, 26 * unit, HUD_COLOR.text, 'left');
  pen.text(hudNumber(state.playerScore), x - 78 * unit, y, 22 * unit, Hud.actorColor(Math.max(0, state.playerId)), 'right');
  if (state.leader >= 0 && state.leader !== state.playerId) {
    pen.text(hudNumber(state.leaderScore), x + 120 * unit, y, 22 * unit, HUD_COLOR.dim, 'left');
    pen.shape('diamond', x + 106 * unit, y, 10 * unit, HUD_COLOR.gold);
  }
  if (state.playerLives >= 0) {
    const livesY = layout.top + HUD_LIVES_Y * unit;
    pen.text(hudCount(state.playerLives), x - 132 * unit, livesY, 14 * unit, Hud.colors.bad, 'left');
    pen.shape('square', x - 144 * unit, livesY, 9 * unit, Hud.colors.bad);
  }
}

function hudDrawControlMeters(pen, layout, state) {
  const unit = layout.unit, y = layout.top + HUD_METERS_Y * unit, width = 110 * unit;
  pen.bar(layout.centerX - width - 8 * unit, y, width, 6 * unit, state.teamMeter[0], Hud.teamColor(0));
  pen.bar(layout.centerX + 8 * unit, y, width, 6 * unit, state.teamMeter[1], Hud.teamColor(1));
}

// Objective chips under the header: letter + owner colour + capture arc, flags as team-shaped markers.
function hudObjectiveLetter(list, index) { return Modes.objectiveLetter(list, index); }
function hudDrawObjectiveChip(pen, layout, objective, letter, x, y) {
  const unit = layout.unit, owner = objective.owner;
  const color = objective.kind === 'flag' ? Hud.teamColor(objective.team) : Hud.teamColor(owner);
  const capturing = objective.capturingTeam >= 0 && objective.progress > 0;
  if (objective.kind === 'flag' || objective.kind === 'relic') pen.shape(objective.kind === 'flag' ? 'triangle' : 'diamond', x, y, 20 * unit, color);
  else {
    pen.octagon(x, y, 12 * unit, owner >= 0 ? color : HUD_COLOR.track, owner >= 0 ? 1 : 0.8);
    pen.text(HUD_LETTERS[letter], x, y, 16 * unit, owner >= 0 ? HUD_COLOR.black : HUD_COLOR.text, 'center');
  }
  if (capturing) pen.ring(x, y, 15 * unit, 3 * unit, Hud.teamColor(objective.capturingTeam), 1, 0, Math.PI * 2 * objective.progress);
  if (objective.contested) pen.ring(x, y, 18 * unit, 2 * unit, HUD_COLOR.warn, 0.9);
  const note = hudObjectiveText[objective.state];
  if (objective.state === 'planted') pen.text(hudTime(objective.detonateAt - Sim.time), x, y + HUD_CHIP_NOTE * unit, 14 * unit, Hud.colors.bad, 'center');
  else if (note && objective.kind === 'flag') pen.text(note, x, y + HUD_CHIP_NOTE * unit, 14 * unit, HUD_COLOR.warn, 'center');
}
function hudDrawObjectiveChips(pen, layout, state) {
  const list = state.objectives;
  if (!list || !list.length) return;
  const unit = layout.unit, spacing = 36 * unit, y = layout.top + (state.roundsToWin > 0 ? HUD_CHIPS_Y_ROUNDS : HUD_CHIPS_Y) * unit;
  let count = 0;
  for (let i = 0; i < list.length && count < HUD_MAX_OBJECTIVE_CHIPS; i++) if (list[i].active && list[i].kind !== 'payloadPath' && list[i].kind !== 'flagBase') count++;
  let x = layout.centerX - (count - 1) * spacing / 2, drawn = 0;
  for (let i = 0; i < list.length && drawn < HUD_MAX_OBJECTIVE_CHIPS; i++) {
    const objective = list[i];
    if (!objective.active || objective.kind === 'payloadPath' || objective.kind === 'flagBase') continue;
    hudDrawObjectiveChip(pen, layout, objective, hudObjectiveLetter(list, i), x, y);
    x += spacing;
    drawn++;
  }
}

function hudSoloMode(modeId) {
  const mode = CAT.modes.byId(modeId);
  return !!mode && mode.family === 'solo';
}
function hudDrawHeader(pen, layout) {
  const state = Modes.hudState();
  if (!state.active && state.phase !== 'ended') return;
  hudHeaderBox(layout, hudBoxAt);
  pen.panelAt(0.5);
  if (state.teams === 2) {
    hudDrawTeamScore(pen, layout, 0, state.teamScores[0]);
    hudDrawTeamScore(pen, layout, 1, state.teamScores[1]);
  } else if (!hudSoloMode(state.mode)) hudDrawFreeForAllScore(pen, layout, state);   // a solo run (range, chambers) has nobody to rank against
  hudDrawTime(pen, layout, state);
  if (state.roundsToWin > 0) hudDrawRoundPips(pen, layout, state);
  if (state.mode === 'control') hudDrawControlMeters(pen, layout, state);
  hudDrawObjectiveChips(pen, layout, state);
}

// ---- Respawn countdown, elimination and spectate text ----
function hudDrawRespawnText(pen, layout) {
  const unit = layout.unit, id = Game.playerId, x = layout.centerX, y = layout.height * 0.68;
  if (id < 0) { pen.label('SPECTATING', x, layout.height * 0.82, 22 * unit, HUD_COLOR.text, 'center'); return; }
  if (Actors.alive[id] || Killcam.playing) return;
  const wait = Modes.hudState().respawnIn;
  if (wait > 0) {
    pen.label('RESPAWN IN', x, y, 18 * unit, HUD_COLOR.dim, 'center');
    pen.label(hudNumber(wait), x, y + 36 * unit, 44 * unit, HUD_COLOR.text, 'center');
  } else if (wait === 0) {
    const key = Hud.keyLabel('fire');
    pen.label(key || 'TAP FIRE', x, y, 30 * unit, HUD_COLOR.text, 'center');
    pen.label('TO RESPAWN', x, y + 30 * unit, 16 * unit, HUD_COLOR.dim, 'center');
  } else pen.label('ELIMINATED', x, y, 30 * unit, Hud.colors.bad, 'center');
}

Bus.on('match.start', () => { HudFeed.reset(); HudBanners.reset(); });
Bus.on('match.stop', () => { HudFeed.reset(); HudBanners.reset(); });

// Touch buttons give way to the score panel and the rows under it (05b keepClear, touch-01), on the screen size they are
// placed for. The rows: one area from the HUD top down to the lowest row the drawers place for the mode (the chip row's note
// line in modes with objectives: chips and notes come and go) and out to the widest. Widths in units, as the drawers place
// them: the "FIRST TO" line (or GET READY), free-for-all lives to 150 on the left, round pips from 66 by 12, control meters
// 8 + 110, objective chips 36 apart with an 18 ring. A button beside the rows keeps its place, as on the panel's sides.
function hudClearHeaderRows(layout, state) {
  const unit = layout.unit, chips = state.objectives ? Math.min(state.objectives.length, HUD_MAX_OBJECTIVE_CHIPS) : 0;
  let line = HUD_LIMIT_Y, right = HudPen.measure('FIRST TO', HUD_TEXT_SMALL * unit) / unit + 3, left = 0;
  if (state.playerLives >= 0 && state.teams !== 2) { line = HUD_LIVES_Y; left = 150; }
  if (state.roundsToWin > 0) { line = HUD_PIPS_Y; right = Math.max(right, 62 + 12 * state.roundsToWin); }
  if (state.mode === 'control') { line = HUD_METERS_Y; right = Math.max(right, 118); }
  if (chips) { line = (state.roundsToWin > 0 ? HUD_CHIPS_Y_ROUNDS : HUD_CHIPS_Y) + HUD_CHIP_NOTE; right = Math.max(right, 18 * chips + 18); }
  TouchInput.addClear(layout.centerX - Math.max(left, right) * unit, layout.top, layout.centerX + right * unit, layout.top + line * unit + hudTextHalf(HUD_TEXT_SMALL * unit));
}
const hudHeaderClearLayout = {};
TouchInput.keepClear.push((width, height) => {
  const layout = hudHeaderClearLayout, box = hudBoxAt;   // the drawing's scratch box: placing never runs inside a draw
  updateHudLayout(layout, width, height);
  hudHeaderBox(layout, box);
  TouchInput.addClear(box[0], box[1], box[0] + box[2], box[1] + box[3]);
  if (Modes.active && Modes.rules) hudClearHeaderRows(layout, Modes.hudState());
});
// A finger on the score panel holds the scoreboard (05b panelAt), as TAB does: the panel box on this screen.
TouchInput.panelAt = (x, y) => {
  const layout = hudHeaderClearLayout, box = hudBoxAt;
  if (!Hud.visible() || Hud.noHud) return false;
  updateHudLayout(layout, window.innerWidth, window.innerHeight);
  hudHeaderBox(layout, box);
  return x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3];
};
// The phone auto-fit (17a): the score panel's half width and lowest row (a chip note), and a kill feed row (names cut to fit).
Object.assign(Hud.fit, { topCentre: HUD_HEADER_WIDTH / 2, topDepth: HUD_CHIPS_Y_ROUNDS + HUD_CHIP_NOTE + HUD_TEXT_SMALL, topRight: HUD_FEED_FIT_WIDTH });

Hud.register('main', 'header', 'header', hudDrawHeader);
Hud.register('main', 'killFeed', 'killFeed', hudDrawKillFeed);
Hud.register('front', 'banners', 'banners', hudDrawBanners);
Hud.register('front', 'respawnText', 'respawnText', hudDrawRespawnText);
