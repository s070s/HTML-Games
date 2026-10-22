// ==== S17 HUD: MATCH STATE ====
// Header per mode from Modes.hudState() (team scores, free-for-all rank and leader, timer, rounds, objective chips), the kill feed
// with weapon and headshot icons drawn from shapes, announcer and medal banners (UI-012), and the respawn / spectate text.

const HUD_FEED_SLOTS = 8, HUD_FEED_SECONDS = 6, HUD_FEED_FADE = 0.5, HUD_FEED_ROWS = 5, HUD_FEED_ROWS_COMPACT = 3;
const HUD_BANNER_SLOTS = 4, HUD_BANNER_SECONDS = 2.6, HUD_BANNER_SECONDS_LONG = 3.4, HUD_BANNER_FADE = 0.5, HUD_BANNER_SHOWN = 3;
const HUD_BANNER_DUPLICATE_SECONDS = 1;
const HUD_BANNER_PRIORITY_LONG = 2;
const HUD_MAX_OBJECTIVE_CHIPS = 6;
const HUD_FALLBACK_NAME = 'Player';
const HUD_CAMEL_BREAK = /([a-z])([A-Z])/g;

// ---- Kill feed: a ring of the last HUD_FEED_SLOTS kills, oldest first when drawn ----
const HudFeed = {
  killer: new Array(HUD_FEED_SLOTS).fill(''), victim: new Array(HUD_FEED_SLOTS).fill(''), weaponClass: new Array(HUD_FEED_SLOTS).fill(''),
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
    this.weaponClass[slot] = weapon ? weapon.class : '';
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

function hudDrawHeadIcon(pen, x, y, size, alpha) {
  pen.ring(x, y, size * 0.4, Math.max(1.5, size * 0.14), HUD_COLOR.gold, alpha);
  pen.rect(x - size * 0.09, y - size * 0.09, size * 0.18, size * 0.18, HUD_COLOR.gold, alpha);
}

function hudDrawFeedRow(pen, layout, slot, right, y, alpha) {
  const feed = HudFeed, unit = layout.unit, size = 15 * unit, iconWidth = 34 * unit, flags = feed.flags[slot];
  const world = (flags & feed.FLAG_WORLD) !== 0, self = (flags & feed.FLAG_SELF) !== 0;
  const victimWidth = HudBatch.measure(feed.victim[slot], size), killerWidth = world || self ? 0 : HudBatch.measure(feed.killer[slot], size);
  const headWidth = flags & feed.FLAG_HEAD ? 16 * unit : 0, pad = 6 * unit;
  const width = pad * 2 + victimWidth + killerWidth + iconWidth + headWidth + (killerWidth ? pad : 0);
  const left = right - width, mid = y;
  pen.panel(left, mid - 11 * unit, width, 22 * unit, 0.5 * alpha);
  if (flags & feed.FLAG_MINE) pen.rect(left, mid - 11 * unit, 3 * unit, 22 * unit, HUD_COLOR.gold, alpha);
  let x = left + pad;
  if (killerWidth) { pen.text(feed.killer[slot], x, mid, size, feed.killerColor[slot], 'left', alpha); x += killerWidth + pad; }
  if (feed.weaponClass[slot]) pen.weaponIcon(feed.weaponClass[slot], x + iconWidth / 2, mid, iconWidth, HUD_COLOR.text, alpha);
  else pen.text('×', x + iconWidth / 2, mid, size, HUD_COLOR.dim, 'center', alpha);
  x += iconWidth;
  if (headWidth) { hudDrawHeadIcon(pen, x + headWidth / 2, mid, headWidth, alpha); x += headWidth; }
  pen.text(feed.victim[slot], x, mid, size, feed.victimColor[slot], 'left', alpha);
}

function hudDrawKillFeed(pen, layout) {
  const now = Hud.time, maxRows = layout.compact ? HUD_FEED_ROWS_COMPACT : HUD_FEED_ROWS, live = HudFeed.liveCount(now);
  const first = Math.max(0, live - maxRows), rowHeight = 25 * layout.unit;
  for (let n = first; n < live; n++) {
    const slot = HudFeed.slotAt(n, now), age = now - HudFeed.at[slot], remaining = HUD_FEED_SECONDS - age;
    hudDrawFeedRow(pen, layout, slot, layout.right, layout.top + 11 * layout.unit + (n - first) * rowHeight, remaining < HUD_FEED_FADE ? remaining / HUD_FEED_FADE : 1);
  }
}

Bus.on('kill', (event) => HudFeed.add(event));

// ---- Banners: announcer text and your own medals, newest on top ----
const HudBanners = {
  text: new Array(HUD_BANNER_SLOTS).fill(''), kind: new Array(HUD_BANNER_SLOTS).fill(''), priority: new Uint8Array(HUD_BANNER_SLOTS),
  medal: new Uint8Array(HUD_BANNER_SLOTS), at: new Float64Array(HUD_BANNER_SLOTS).fill(-1000), next: 0,

  reset() { this.at.fill(-1000); this.next = 0; },
  add(text, kind, priority, medal) {
    for (let i = 0; i < HUD_BANNER_SLOTS; i++) if (this.text[i] === text && Hud.time - this.at[i] < HUD_BANNER_DUPLICATE_SECONDS) return;
    const slot = this.next;
    this.next = (slot + 1) % HUD_BANNER_SLOTS;
    this.text[slot] = text; this.kind[slot] = kind; this.priority[slot] = priority; this.medal[slot] = medal ? 1 : 0; this.at[slot] = Hud.time;
  },
  seconds(slot) { return this.priority[slot] >= HUD_BANNER_PRIORITY_LONG || this.medal[slot] ? HUD_BANNER_SECONDS_LONG : HUD_BANNER_SECONDS; },
};

// "doubleKill" -> "Double Kill" when the medals catalogue (15.6) has no row yet.
function hudMedalTitle(medal) {
  const row = CAT.medals ? CAT.medals.byId(medal) : null;
  if (row) return row.name;
  const spaced = String(medal).replace(HUD_CAMEL_BREAK, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

Bus.on('announce', (event) => HudBanners.add(event.text, event.kind, event.priority, false));
Bus.on('medal', (event) => { if (event.id === Game.playerId && event.id >= 0) HudBanners.add(hudMedalTitle(event.medal), 'medal', HUD_BANNER_PRIORITY_LONG, true); });

function hudDrawBanners(pen, layout) {
  const b = HudBanners, now = Hud.time, unit = layout.unit;
  let shown = 0, y = layout.height * 0.22;
  for (let k = 1; k <= HUD_BANNER_SLOTS && shown < HUD_BANNER_SHOWN; k++) {
    const slot = (b.next - k + HUD_BANNER_SLOTS) % HUD_BANNER_SLOTS, age = now - b.at[slot], life = b.seconds(slot);
    if (age >= life) continue;
    const alpha = Math.min(1, age / 0.15, (life - age) / HUD_BANNER_FADE);
    const size = (b.medal[slot] ? 30 : b.priority[slot] >= HUD_BANNER_PRIORITY_LONG ? 26 : 20) * unit;
    if (b.medal[slot]) {
      const width = HudBatch.measure(b.text[slot], size);
      pen.label('★', layout.centerX - width / 2 - size * 0.9, y, size, HUD_COLOR.gold, 'center', alpha);
      pen.label('★', layout.centerX + width / 2 + size * 0.9, y, size, HUD_COLOR.gold, 'center', alpha);
    }
    pen.label(b.text[slot], layout.centerX, y, size, b.medal[slot] ? HUD_COLOR.gold : HUD_COLOR.text, 'center', alpha);
    y += size * 1.35;
    shown++;
  }
}

// ---- Header ----
const hudObjectiveText = { planted: 'BOMB', dropped: 'DROPPED', carried: 'TAKEN' };

function hudDrawTeamScore(pen, layout, team, x, align, score) {
  const unit = layout.unit, color = Hud.teamColor(team), mine = Actors.team[Game.playerId] === team;
  const y = layout.top + 17 * unit;
  pen.shape(Hud.teamShapes ? Hud.teamShape(team) : 'square', align === 'left' ? x + 12 * unit : x - 12 * unit, y, 14 * unit, color);
  pen.text(hudNumber(score), align === 'left' ? x + 26 * unit : x - 26 * unit, y, 26 * unit, HUD_COLOR.text, align);
  if (mine) pen.rect(align === 'left' ? x : x - 74 * unit, layout.top + 34 * unit, 74 * unit, 3 * unit, color, 1);
}

function hudDrawTime(pen, layout, state) {
  const unit = layout.unit, x = layout.centerX, y = layout.top + 15 * unit;
  if (state.overtime) pen.text('OVERTIME', x, y + 21 * unit, 14 * unit, Hud.colors.bad, 'center');
  if (state.timeLeft > 0) {
    const urgent = state.timeLeft <= 30;
    pen.text(hudTime(state.timeLeft), x, y, 24 * unit, urgent ? Hud.colors.bad : HUD_COLOR.text, 'center');
  }
  if (state.phase === 'freeze') pen.text('GET READY', x, y + 22 * unit, 14 * unit, HUD_COLOR.warn, 'center');
  else if (state.phase === 'roundEnd') pen.text('ROUND OVER', x, y + 22 * unit, 14 * unit, HUD_COLOR.warn, 'center');
  else if (state.scoreLimit > 0 && state.roundsToWin === 0 && !state.overtime) hudDrawScoreLimit(pen, layout, state.scoreLimit, y + 22 * unit);
}

// "FIRST TO 25" under the clock: the label ends and the number starts at the centre line.
function hudDrawScoreLimit(pen, layout, limit, y) {
  const unit = layout.unit;
  pen.text('FIRST TO', layout.centerX - 3 * unit, y, 14 * unit, HUD_COLOR.dim, 'right');
  pen.text(hudNumber(limit), layout.centerX + 3 * unit, y, 14 * unit, HUD_COLOR.dim, 'left');
}

function hudDrawRoundPips(pen, layout, state) {
  const unit = layout.unit, y = layout.top + 56 * unit, wins = Math.max(state.roundsToWin, 1);
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
    pen.text(hudCount(state.playerLives), x - 132 * unit, y + 24 * unit, 14 * unit, Hud.colors.bad, 'left');
    pen.shape('square', x - 144 * unit, y + 24 * unit, 9 * unit, Hud.colors.bad);
  }
}

function hudDrawControlMeters(pen, layout, state) {
  const unit = layout.unit, y = layout.top + 68 * unit, width = 110 * unit;
  pen.bar(layout.centerX - width - 8 * unit, y, width, 6 * unit, state.teamMeter[0], Hud.teamColor(0));
  pen.bar(layout.centerX + 8 * unit, y, width, 6 * unit, state.teamMeter[1], Hud.teamColor(1));
}

// Objective chips under the header: letter + owner colour + capture arc, flags as team-shaped markers.
function hudObjectiveLetter(list, index) {
  let letter = 0;
  for (let i = 0; i < index; i++) if (list[i].kind === list[index].kind && list[i].active) letter++;
  return letter;
}
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
  if (objective.state === 'planted') pen.text(hudTime(objective.detonateAt - Sim.time), x, y + 22 * unit, 14 * unit, Hud.colors.bad, 'center');
  else if (note && objective.kind === 'flag') pen.text(note, x, y + 22 * unit, 14 * unit, HUD_COLOR.warn, 'center');
}
function hudDrawObjectiveChips(pen, layout, state) {
  const list = state.objectives;
  if (!list || !list.length) return;
  const unit = layout.unit, spacing = 36 * unit, y = layout.top + (state.roundsToWin > 0 ? 92 : 74) * unit;
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

function hudDrawHeader(pen, layout) {
  const state = Modes.hudState();
  if (!state.active && state.phase !== 'ended') return;
  const unit = layout.unit, width = 320 * unit, left = layout.centerX - width / 2;
  pen.panel(left, layout.top, width, 44 * unit, 0.5);
  if (state.teams === 2) {
    hudDrawTeamScore(pen, layout, 0, left + 4 * unit, 'left', state.teamScores[0]);
    hudDrawTeamScore(pen, layout, 1, left + width - 4 * unit, 'right', state.teamScores[1]);
  } else hudDrawFreeForAllScore(pen, layout, state);
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

Hud.register('main', 'header', 'header', hudDrawHeader);
Hud.register('main', 'killFeed', 'killFeed', hudDrawKillFeed);
Hud.register('front', 'banners', 'banners', hudDrawBanners);
Hud.register('front', 'respawnText', 'respawnText', hudDrawRespawnText);
