// ==== S17 HUD: PVE MODES AND OPERATIONS ====
// PvE status from Modes.hud.pve (PVE_HUD, docs/api/pve.md; UI-003, NPC-008): wave and phase, enemies left, the core health and
// shield, retries and the Guardian Plate offer (DIF-004), the boss bar with its phase (PveBoss.hud), the stealth meter, carried
// motes, the Test Chambers timer with the medal limits and the hint (MAP-030), and the Firing Range drill stats. Operations show
// both teams' tickets under the header. Numbers and times come from the cached strings of 17a: no allocation per frame.

const HUD_PVE_TOP = 104;                 // design units below the top edge: under the header and its objective chips
const HUD_PVE_COMPASS_SHIFT = 30;        // the compass strip, when shown, sits at the same height
const HUD_PVE_WIDTH = 300, HUD_PVE_ROW = 20, HUD_PVE_PAD = 10, HUD_PVE_BAR = 9;
const HUD_PVE_BOSS_WIDTH = 420;
const HUD_PVE_SIDE_WIDTH = 220, HUD_PVE_SIDE_TOP = 150, HUD_PVE_SIDE_ROW = 19;   // right-hand tables under the kill feed
const HUD_PVE_TIME_COLUMN = 0.45, HUD_PVE_STEPS_COLUMN = 0.72;                   // right edges of the medal table columns (share of its width)
const HUD_PVE_HINT_RISE = 46, HUD_PVE_PROMPT_RISE = 78;                         // above the weapon bar line
const HUD_PVE_LOW_CORE = 0.25;
const HUD_PVE_STATE_TEXT = { shop: 'NEXT WAVE', fight: 'ENEMIES', extract: 'EXTRACT' };
const HUD_PVE_MEDAL_STARS = ['★★★', '★★', '★'];
const HUD_PVE_MEDAL_COLORS = [0xf2c94c, 0xc9d3dd, 0xd08a4a];                    // gold, silver, bronze
const HUD_PVE_MEDAL_NAMES = { gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', '': 'NO MEDAL' };
const HUD_PVE_AWARENESS_TEXT = ['UNSEEN', 'SUSPICIOUS', 'SEARCHING', 'ALERT'];  // by AWARENESS state (14h)
const HUD_PVE_GUARDIAN_CHOICE = 'GUARDIAN PLATE OFFERED: OPEN THE PAUSE MENU TO WEAR OR REFUSE IT';
const HUD_PVE_GUARDIAN_READY = 'GUARDIAN PLATE READY FOR THE CHECKPOINT RETRY';
const HUD_PVE_NONE = '-';

hudAddElement({ id: 'pve', label: 'PvE status (waves, core, boss, chambers, range)' });

// Which status rows each PvE mode shows under the header (a new PvE mode adds a row here).
const HUD_PVE_PANELS = {
  horde: ['wave'], endless: ['wave'], bank: ['motes'], fiends: ['enemies'], contract: ['stealth'], attrition: [], range: [], puzzle: ['chamber'],
};

// ---- Small text helpers: a dim label and a value next to it ----
// Left aligned: label at x, value after it. Returns the x after the value.
function hudPveStat(pen, x, y, unit, label, value, color) {
  const labelWidth = pen.text(label, x, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'left');
  return x + labelWidth + 6 * unit + pen.text(value, x + labelWidth + 6 * unit, y, 17 * unit, color, 'left');
}
// Right aligned: value ends at right, label before it.
function hudPveStatRight(pen, right, y, unit, label, value, color) {
  const valueWidth = pen.text(value, right, y, 17 * unit, color, 'right');
  pen.text(label, right - valueWidth - 6 * unit, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'right');
}
// "/ total" after a left aligned stat (no string is built per frame).
function hudPveTotal(pen, x, y, unit, total) {
  const slashWidth = pen.text('/', x + 4 * unit, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'left');
  pen.text(hudNumber(total), x + 8 * unit + slashWidth, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'left');
}
// "a / b" right aligned at right.
function hudPveFraction(pen, right, y, size, part, whole, color) {
  const wholeWidth = pen.text(hudNumber(whole), right, y, size, HUD_COLOR.dim, 'right');
  const slashWidth = pen.text(' / ', right - wholeWidth, y, size, HUD_COLOR.dim, 'right');
  pen.text(hudNumber(part), right - wholeWidth - slashWidth, y, size, color, 'right');
}
// One label / value row of a right-hand table.
function hudPveTableRow(pen, left, width, y, unit, label, value, color) {
  pen.text(label, left + 8 * unit, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'left');
  pen.text(value, left + width - 8 * unit, y, HUD_TEXT_SMALL * unit, color, 'right');
}

function hudPveTop(layout) {
  return layout.top + (HUD_PVE_TOP + (Hud.elements.compass ? HUD_PVE_COMPASS_SHIFT : 0)) * layout.unit;
}
function hudPveLeft(layout) { return layout.centerX - HUD_PVE_WIDTH * layout.unit / 2; }
function hudPveRight(layout) { return layout.centerX + HUD_PVE_WIDTH * layout.unit / 2; }

// ---- Status rows; each draws its panel from y and returns the y under it ----
// M21 / M22: wave (of the total), the phase on the right, the core bar with its shield, retries and the plate.
function hudPveWaveRow(pen, layout, pve, y) {
  const unit = layout.unit, left = hudPveLeft(layout), right = hudPveRight(layout), height = (HUD_PVE_ROW * 3 + 6) * unit;
  pen.panel(left, y, right - left, height, 0.5);
  const lineY = y + HUD_PVE_ROW * 0.6 * unit, x = hudPveStat(pen, left + HUD_PVE_PAD * unit, lineY, unit, 'WAVE', hudNumber(pve.wave), HUD_COLOR.text);
  if (pve.waves > 0) hudPveTotal(pen, x, lineY, unit, pve.waves);
  const counting = pve.state === 'fight';
  hudPveStatRight(pen, right - HUD_PVE_PAD * unit, lineY, unit, HUD_PVE_STATE_TEXT[pve.state] || '', counting ? hudNumber(pve.enemiesLeft) : hudTime(pve.stateTimeLeft),
    counting ? HUD_COLOR.text : pve.state === 'extract' ? Hud.colors.good : HUD_COLOR.warn);
  hudPveCoreBar(pen, layout, pve, y + HUD_PVE_ROW * 1.5 * unit);
  const noteY = y + HUD_PVE_ROW * 2.55 * unit;
  if (pve.retriesLeft > 0) hudPveStat(pen, left + HUD_PVE_PAD * unit, noteY, unit, 'RETRIES', hudNumber(pve.retriesLeft), HUD_COLOR.text);
  if (pve.guardian) pen.text('GUARDIAN PLATE', right - HUD_PVE_PAD * unit, noteY, HUD_TEXT_SMALL * unit, HUD_COLOR.gold, 'right');
  return y + height + 6 * unit;
}
function hudPveCoreBar(pen, layout, pve, y) {
  const unit = layout.unit, left = hudPveLeft(layout) + HUD_PVE_PAD * unit, right = hudPveRight(layout) - HUD_PVE_PAD * unit;
  const fraction = pve.coreMax > 0 ? pve.coreHealth / pve.coreMax : 0, barLeft = left + 46 * unit, barRight = right - 52 * unit;
  pen.text('CORE', left, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'left');
  pen.bar(barLeft, y - HUD_PVE_BAR * unit / 2, barRight - barLeft, HUD_PVE_BAR * unit, fraction, fraction < HUD_PVE_LOW_CORE ? Hud.colors.bad : Hud.colors.health);
  if (pve.coreShield > 0) pen.bar(barLeft, y - HUD_PVE_BAR * unit / 2 - 4 * unit, barRight - barLeft, 3 * unit, pve.coreMax > 0 ? pve.coreShield / pve.coreMax : 1, HUD_COLOR.shield);
  pen.text(hudNumber(pve.coreHealth), right, y, HUD_TEXT_SMALL * unit, HUD_COLOR.text, 'right');
}

// M23: carried motes of the most a carrier holds, enemies of your side on the right.
function hudPveMotesRow(pen, layout, pve, y) {
  const unit = layout.unit, left = hudPveLeft(layout), right = hudPveRight(layout), height = HUD_PVE_ROW * 1.3 * unit, lineY = y + height / 2;
  pen.panel(left, y, right - left, height, 0.5);
  const x = hudPveStat(pen, left + HUD_PVE_PAD * unit, lineY, unit, 'MOTES', hudNumber(pve.carried), pve.carried >= PVE_BANK.carryMax ? HUD_COLOR.gold : HUD_COLOR.text);
  hudPveTotal(pen, x, lineY, unit, PVE_BANK.carryMax);
  hudPveStatRight(pen, right - HUD_PVE_PAD * unit, lineY, unit, 'ENEMIES', hudNumber(pve.enemiesLeft), HUD_COLOR.text);
  return y + height + 6 * unit;
}

// NPC-008: the remaining enemy count.
function hudPveEnemiesRow(pen, layout, pve, y) {
  const unit = layout.unit, height = HUD_PVE_ROW * 1.3 * unit, width = 150 * unit, left = layout.centerX - width / 2;
  pen.panel(left, y, width, height, 0.5);
  hudPveStatRight(pen, left + width - HUD_PVE_PAD * unit, y + height / 2, unit, 'ENEMIES', hudNumber(pve.enemiesLeft), HUD_COLOR.text);
  return y + height + 6 * unit;
}

// M28 stealth contract: the most aware guard's meter and state, alarms, the score so far and the relic.
function hudPveAwarenessState(value) {
  if (value >= 1) return AWARENESS.ALERT;
  if (value >= PVE_CONTRACT.suspicious) return AWARENESS.SEARCHING;
  return value >= PVE_CONTRACT.unaware ? AWARENESS.SUSPICIOUS : AWARENESS.UNAWARE;
}
function hudPveStealthRow(pen, layout, pve, y) {
  const unit = layout.unit, left = hudPveLeft(layout), right = hudPveRight(layout), height = (HUD_PVE_ROW * 2 + 6) * unit;
  const color = hudAwarenessColor(pve.awareness), lineY = y + HUD_PVE_ROW * 0.6 * unit;
  pen.panel(left, y, right - left, height, 0.5);
  pen.text(HUD_PVE_AWARENESS_TEXT[hudPveAwarenessState(pve.awareness)], left + HUD_PVE_PAD * unit, lineY, HUD_TEXT_SMALL * unit, color, 'left');
  pen.bar(left + 110 * unit, lineY - HUD_PVE_BAR * unit / 2, right - left - 120 * unit, HUD_PVE_BAR * unit, pve.awareness, color);
  const noteY = y + HUD_PVE_ROW * 1.55 * unit;
  hudPveStat(pen, left + HUD_PVE_PAD * unit, noteY, unit, 'ALARMS', hudNumber(pve.alarms), pve.alarms > 0 ? Hud.colors.bad : HUD_COLOR.text);
  hudPveStat(pen, layout.centerX - 40 * unit, noteY, unit, 'SCORE', hudNumber(pve.score), HUD_COLOR.text);
  pen.text(pve.relic ? 'RELIC TAKEN' : 'FIND THE RELIC', right - HUD_PVE_PAD * unit, noteY, HUD_TEXT_SMALL * unit, pve.relic ? HUD_COLOR.gold : HUD_COLOR.dim, 'right');
  return y + height + 6 * unit;
}

// M31 Test Chambers: chamber of the total, the timer in the colour of the medal it still earns, the exit lock, steps, portals.
function hudPveChamberTier(pve) {
  const row = PVE_CHAMBERS[pve.chamber - 1];
  return row ? chamberMedal(row, pve.chamberTime, pve.steps, pve.portals) : -1;
}
function hudPveChamberRow(pen, layout, pve, y) {
  const unit = layout.unit, left = hudPveLeft(layout), right = hudPveRight(layout), height = (HUD_PVE_ROW * 2 + 6) * unit, tier = hudPveChamberTier(pve);
  pen.panel(left, y, right - left, height, 0.5);
  const lineY = y + HUD_PVE_ROW * 0.6 * unit, x = hudPveStat(pen, left + HUD_PVE_PAD * unit, lineY, unit, 'CHAMBER', hudNumber(pve.chamber), HUD_COLOR.text);
  hudPveTotal(pen, x, lineY, unit, pve.chambers);
  pen.text(hudTime(pve.chamberTime), right - HUD_PVE_PAD * unit, lineY, 20 * unit, tier >= 0 ? HUD_PVE_MEDAL_COLORS[tier] : HUD_COLOR.dim, 'right');
  const noteY = y + HUD_PVE_ROW * 1.55 * unit;
  pen.text(pve.solved ? 'EXIT OPEN' : 'EXIT LOCKED', left + HUD_PVE_PAD * unit, noteY, HUD_TEXT_SMALL * unit, pve.solved ? Hud.colors.good : Hud.colors.bad, 'left');
  hudPveStat(pen, layout.centerX - 46 * unit, noteY, unit, 'STEPS', hudNumber(pve.steps), HUD_COLOR.text);
  hudPveStatRight(pen, right - HUD_PVE_PAD * unit, noteY, unit, 'GATES', hudNumber(pve.portals), HUD_COLOR.text);
  return y + height + 6 * unit;
}

const HUD_PVE_ROWS = { wave: hudPveWaveRow, motes: hudPveMotesRow, enemies: hudPveEnemiesRow, stealth: hudPveStealthRow, chamber: hudPveChamberRow };

// ---- Boss bar (E13): name, health, phase pips, and the broken weak point ----
function hudPveBossBar(pen, layout, boss, y) {
  if (!boss || !boss.active) return y;
  const unit = layout.unit, width = HUD_PVE_BOSS_WIDTH * unit, left = layout.centerX - width / 2, barY = y + 22 * unit;
  pen.label(boss.name, left, y + 8 * unit, 16 * unit, HUD_COLOR.text, 'left');
  hudPveFraction(pen, left + width, y + 8 * unit, HUD_TEXT_SMALL * unit, boss.phase, boss.phases, HUD_COLOR.warn);
  pen.text('PHASE', left + width - 52 * unit, y + 8 * unit, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'right');
  pen.bar(left, barY, width, 12 * unit, boss.health, Hud.colors.bad);
  for (let phase = 1; phase < boss.phases; phase++) pen.rect(left + width * (1 - phase / boss.phases), barY, 2 * unit, 12 * unit, HUD_COLOR.black, 0.8);
  if (boss.weakDisabled) pen.label('WEAK POINT BROKEN', layout.centerX, barY + 24 * unit, HUD_TEXT_SMALL * unit, HUD_COLOR.gold, 'center');
  return barY + 34 * unit;
}

// ---- Right-hand tables: chamber medal limits and the range drill stats ----
function hudPveSideTop(layout) { return layout.top + HUD_PVE_SIDE_TOP * layout.unit; }

function hudPveChamberTable(pen, layout, pve) {
  const row = PVE_CHAMBERS[pve.chamber - 1];
  if (!row) return;
  const unit = layout.unit, width = HUD_PVE_SIDE_WIDTH * unit, left = layout.right - width, top = hudPveSideTop(layout), rowHeight = HUD_PVE_SIDE_ROW * unit;
  const current = hudPveChamberTier(pve), tiers = HUD_PVE_MEDAL_STARS.length;
  pen.panel(left, top, width, rowHeight * (tiers + 3.4), 0.5);
  hudPveTableHeader(pen, left, width, top + rowHeight * 0.6, unit);
  for (let tier = 0; tier < tiers; tier++) {
    const y = top + rowHeight * (tier + 1.6), alpha = tier === current ? 1 : 0.55;
    if (tier === current) pen.rect(left, y - rowHeight / 2, 3 * unit, rowHeight, HUD_PVE_MEDAL_COLORS[tier]);
    pen.text(HUD_PVE_MEDAL_STARS[tier], left + 8 * unit, y, HUD_TEXT_SMALL * unit, HUD_PVE_MEDAL_COLORS[tier], 'left', alpha);
    pen.text(hudTime(row.par.time[tier]), left + width * HUD_PVE_TIME_COLUMN, y, HUD_TEXT_SMALL * unit, HUD_COLOR.text, 'right', alpha);
    pen.text(hudNumber(row.par.steps[tier]), left + width * HUD_PVE_STEPS_COLUMN, y, HUD_TEXT_SMALL * unit, HUD_COLOR.text, 'right', alpha);
    pen.text(hudNumber(row.par.portals[tier]), left + width - 8 * unit, y, HUD_TEXT_SMALL * unit, HUD_COLOR.text, 'right', alpha);
  }
  const footY = top + rowHeight * (tiers + 1.7);
  hudPveTableRow(pen, left, width, footY, unit, 'STARS', hudNumber(pve.stars), HUD_COLOR.gold);
  if (pve.chamber > 1) hudPveTableRow(pen, left, width, footY + rowHeight, unit, 'LAST MEDAL', HUD_PVE_MEDAL_NAMES[pve.medal], HUD_COLOR.gold);
}
function hudPveTableHeader(pen, left, width, y, unit) {
  pen.text('MEDAL', left + 8 * unit, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'left');
  pen.text('TIME', left + width * HUD_PVE_TIME_COLUMN, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'right');
  pen.text('STEPS', left + width * HUD_PVE_STEPS_COLUMN, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'right');
  pen.text('GATES', left + width - 8 * unit, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'right');
}

// M30: shot statistics and the running drill (kills of the drill, its clock, the best time).
function hudPveRangeTable(pen, layout, pve) {
  const unit = layout.unit, width = HUD_PVE_SIDE_WIDTH * unit, left = layout.right - width, top = hudPveSideTop(layout), rowHeight = HUD_PVE_SIDE_ROW * unit;
  pen.panel(left, top, width, rowHeight * 10.4, 0.5);
  let y = top + rowHeight * 0.6;
  pen.text('FIRING RANGE', left + 8 * unit, y, HUD_TEXT_SMALL * unit, HUD_COLOR.gold, 'left');
  y += rowHeight;
  hudPveTableRow(pen, left, width, y, unit, 'SHOTS', hudNumber(pve.shots), HUD_COLOR.text); y += rowHeight;
  hudPveTableRow(pen, left, width, y, unit, 'HITS', hudNumber(pve.hits), HUD_COLOR.text); y += rowHeight;
  hudPveTableRow(pen, left, width, y, unit, 'ACCURACY %', hudNumber(Math.floor(pve.accuracy * 100)), HUD_COLOR.text); y += rowHeight;
  hudPveTableRow(pen, left, width, y, unit, 'HEADSHOTS', hudNumber(pve.headshots), HUD_COLOR.text); y += rowHeight;
  hudPveTableRow(pen, left, width, y, unit, 'DAMAGE', hudNumber(pve.damage), HUD_COLOR.text); y += rowHeight;
  pen.text('DRILL KILLS', left + 8 * unit, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'left');
  hudPveFraction(pen, left + width - 8 * unit, y, HUD_TEXT_SMALL * unit, pve.drillKills, pve.drillTargets, HUD_COLOR.text); y += rowHeight;
  hudPveTableRow(pen, left, width, y, unit, 'DRILL TIME', hudTime(pve.stateTimeLeft), HUD_COLOR.warn); y += rowHeight;
  hudPveTableRow(pen, left, width, y, unit, 'BEST DRILL', pve.drillBest > 0 ? hudTime(pve.drillBest) : HUD_PVE_NONE, HUD_COLOR.gold); y += rowHeight;
  hudPveTableRow(pen, left, width, y, unit, 'DRILLS DONE', hudNumber(pve.drills), HUD_COLOR.text);
}

// ---- Bottom centre: the chamber hint and the Guardian Plate prompt ----
function hudPveCentreNote(pen, layout, text, rise, color) {
  const unit = layout.unit, size = 16 * unit, y = layout.weaponBarY - rise * unit, width = HudBatch.measure(text, size) + 24 * unit;
  pen.panel(layout.centerX - width / 2, y - 14 * unit, width, 28 * unit, 0.6);
  pen.text(text, layout.centerX, y, size, color, 'center');
}
// DIF-004: the choice is the player's when the PvE section takes the answer (18o, pause menu row), else the plate is automatic.
function hudPveGuardianText(pve) {
  if (pve.guardianAccepted || typeof Pve.answerGuardian !== 'function') return HUD_PVE_GUARDIAN_READY;
  return HUD_PVE_GUARDIAN_CHOICE;
}

function hudDrawPve(pen, layout) {
  const pve = Modes.hud.pve;
  if (!pve || !pve.active) return;
  const rows = HUD_PVE_PANELS[pve.mode] || [];
  let y = hudPveTop(layout);
  for (let i = 0; i < rows.length; i++) y = HUD_PVE_ROWS[rows[i]](pen, layout, pve, y);
  hudPveBossBar(pen, layout, pve.boss, y);
  if (pve.mode === 'range') hudPveRangeTable(pen, layout, pve);
  if (pve.mode === 'puzzle') hudPveChamberTable(pen, layout, pve);
  if (pve.hint) hudPveCentreNote(pen, layout, pve.hint, HUD_PVE_HINT_RISE, HUD_COLOR.text);
  if (pve.guardianOffer) hudPveCentreNote(pen, layout, hudPveGuardianText(pve), HUD_PVE_PROMPT_RISE, HUD_COLOR.gold);
}

// ---- Operations: both teams' tickets under the team scores (low tickets in the warning colour) ----
function hudDrawTickets(pen, layout) {
  if (!OperationRun.active || !Modes.hudState().active) return;
  const unit = layout.unit, y = layout.top + 54 * unit, gap = 44 * unit;
  pen.text('TICKETS', layout.centerX, y, HUD_TEXT_SMALL * unit, HUD_COLOR.dim, 'center');
  for (let team = 0; team < TEAM_COUNT; team++) {
    const low = OperationRun.tickets[team] <= OPERATION_WARN_TICKETS, x = team === 0 ? layout.centerX - gap : layout.centerX + gap;
    pen.text(hudNumber(OperationRun.tickets[team]), x, y, 17 * unit, low ? Hud.colors.bad : Hud.teamColor(team), team === 0 ? 'right' : 'left');
  }
}

Hud.register('main', 'pve', 'pve', hudDrawPve);
Hud.register('main', 'tickets', 'header', hudDrawTickets);
