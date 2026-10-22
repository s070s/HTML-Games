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
const HUD_PVE_SIDE_ROW_COMPACT = 17;                                             // compact HUD (phones, short screens): shorter rows
const HUD_PVE_TOUCH_CROSS_GAP = 40;      // touch: the side tables end this far left of the crosshair (the right side holds the buttons)
const HUD_PVE_TOUCH_NOTE_RISE = 20;      // touch: the notes rise above the ammo panel, which sits bottom centre-left (17a ammoRight)
const HUD_PVE_TOUCH_NOTE_RIGHT = 0.55;   // touch: notes end left of this share of the width (the default right-hand buttons start past it)
const HUD_PVE_NOTE_SIZE = 16, HUD_PVE_NOTE_PAD = 24, HUD_PVE_NOTE_HALF = 14;   // design units: note text size, side padding, half the panel height
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
const HUD_PVE_GUARDIAN_CHOICE_TOUCH = 'GUARDIAN PLATE: PAUSE TO CHOOSE', HUD_PVE_GUARDIAN_READY_TOUCH = 'GUARDIAN PLATE READY';   // phones: short, clear of the buttons
const HUD_PVE_NONE = '-';

hudAddElement({ id: 'pve', label: 'PvE status (waves, core, boss, chambers, range)' });

// Which status rows each PvE mode shows under the header (a new PvE mode adds a row here).
const HUD_PVE_PANELS = {
  horde: ['wave'], endless: ['wave'], bank: ['motes'], fiends: ['enemies'], contract: ['stealth'], attrition: ['enemies'], range: [], puzzle: ['chamber'],
};

// ---- Small text helpers: a dim label and a value next to it, from x, y in hudTextAt (17a's scratch forms: the drawer runs
// once per frame in the middle compiler tier, which boxes every float argument and return of a call it does not inline) ----
// Left aligned: label at x, value after it. Leaves the x after the value in hudTextAt[0].
function hudPveStat(pen, layout, label, value, color) {
  const text = hudTextAt, unit = layout.unit;
  text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt(label, HUD_COLOR.dim, 'left');
  text[0] = text[0] + text[3] + 6 * unit; text[2] = 17 * unit;
  pen.textAt(value, color, 'left');
  text[0] = text[0] + text[3];
}
// Right aligned: value ends at x, label before it.
function hudPveStatRight(pen, layout, label, value, color) {
  const text = hudTextAt, unit = layout.unit;
  text[2] = 17 * unit;
  pen.textAt(value, color, 'right');
  text[0] = text[0] - text[3] - 6 * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt(label, HUD_COLOR.dim, 'right');
}
// "/ total" after a left aligned stat that ends at x (no string is built per frame).
function hudPveTotal(pen, layout, total) {
  const text = hudTextAt, x = text[0], unit = layout.unit;
  text[0] = x + 4 * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt('/', HUD_COLOR.dim, 'left');
  text[0] = x + 8 * unit + text[3];
  pen.textAt(hudNumber(total), HUD_COLOR.dim, 'left');
}
// "a / b" right aligned at x, in the size already in hudTextAt[2].
function hudPveFraction(pen, part, whole, color) {
  const text = hudTextAt, right = text[0];
  pen.textAt(hudNumber(whole), HUD_COLOR.dim, 'right');
  const wholeWidth = text[3];
  text[0] = right - wholeWidth;
  pen.textAt(' / ', HUD_COLOR.dim, 'right');
  text[0] = right - wholeWidth - text[3];
  pen.textAt(hudNumber(part), color, 'right');
}
// One label / value row at y (hudTextAt[1]) of the right-hand table between the edges in hudPveAt.
function hudPveTableRow(pen, layout, label, value, color) {
  const text = hudTextAt, unit = layout.unit, left = hudPveAt[1], width = hudPveAt[2] - left;
  text[0] = left + 8 * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt(label, HUD_COLOR.dim, 'left');
  text[0] = left + width - 8 * unit;
  pen.textAt(value, color, 'right');
}

// The y of the next status row, then the left and right edge of the rows being drawn (the status rows, then a side table):
// the rows read and advance it instead of taking and returning a float y (PERF-006).
const hudPveAt = new Float64Array(3);
// The status rows' first y and edges, into hudPveAt.
function hudPvePlaceRows(layout) {
  const at = hudPveAt, half = HUD_PVE_WIDTH * layout.unit / 2;
  at[0] = layout.top + (HUD_PVE_TOP + (Hud.elements.compass ? HUD_PVE_COMPASS_SHIFT : 0)) * layout.unit;
  at[1] = layout.centerX - half; at[2] = layout.centerX + half;
}
// A status row's panel, `height` pixels from the row's y across the rows' edges (hudBoxAt).
function hudPveRowPanel(pen, height) {
  const at = hudPveAt, box = hudBoxAt;
  box[0] = at[1]; box[1] = at[0]; box[2] = at[2] - at[1]; box[3] = height;
  pen.panelAt(0.5);
}

// ---- Status rows; each draws its panel from the y in hudPveAt[0] and moves it under the panel ----
// M21 / M22: wave (of the total), the phase on the right, the core bar with its shield, retries and the plate.
function hudPveWaveRow(pen, layout, pve) {
  const at = hudPveAt, text = hudTextAt, unit = layout.unit, y = at[0], left = at[1], right = at[2], height = (HUD_PVE_ROW * 3 + 6) * unit;
  hudPveRowPanel(pen, height);
  const lineY = y + HUD_PVE_ROW * 0.6 * unit;
  text[0] = left + HUD_PVE_PAD * unit; text[1] = lineY;
  hudPveStat(pen, layout, 'WAVE', hudNumber(pve.wave), HUD_COLOR.text);
  if (pve.waves > 0) hudPveTotal(pen, layout, pve.waves);
  const counting = pve.state === 'fight';
  text[0] = right - HUD_PVE_PAD * unit;
  hudPveStatRight(pen, layout, HUD_PVE_STATE_TEXT[pve.state] || '', counting ? hudNumber(pve.enemiesLeft) : hudTime(pve.stateTimeLeft),
    counting ? HUD_COLOR.text : pve.state === 'extract' ? Hud.colors.good : HUD_COLOR.warn);
  hudPveCoreBar(pen, layout, pve);
  text[1] = y + HUD_PVE_ROW * 2.55 * unit;
  text[0] = left + HUD_PVE_PAD * unit;
  if (pve.retriesLeft > 0) hudPveStat(pen, layout, 'RETRIES', hudNumber(pve.retriesLeft), HUD_COLOR.text);
  text[0] = right - HUD_PVE_PAD * unit; text[2] = HUD_TEXT_SMALL * unit;
  if (pve.guardian) pen.textAt('GUARDIAN PLATE', HUD_COLOR.gold, 'right');
  at[0] = y + height + 6 * unit;
}
// The core bar, its shield above it and the core health, in the wave row (at 1.5 rows down).
function hudPveCoreBar(pen, layout, pve) {
  const at = hudPveAt, box = hudBoxAt, text = hudTextAt, unit = layout.unit, y = at[0] + HUD_PVE_ROW * 1.5 * unit;
  const left = at[1] + HUD_PVE_PAD * unit, right = at[2] - HUD_PVE_PAD * unit;
  const fraction = pve.coreMax > 0 ? pve.coreHealth / pve.coreMax : 0, barLeft = left + 46 * unit, barRight = right - 52 * unit;
  text[0] = left; text[1] = y; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt('CORE', HUD_COLOR.dim, 'left');
  box[0] = barLeft; box[1] = y - HUD_PVE_BAR * unit / 2; box[2] = barRight - barLeft; box[3] = HUD_PVE_BAR * unit; box[4] = fraction;
  pen.barAt(fraction < HUD_PVE_LOW_CORE ? Hud.colors.bad : Hud.colors.health);
  box[1] = y - HUD_PVE_BAR * unit / 2 - 4 * unit; box[3] = 3 * unit; box[4] = pve.coreMax > 0 ? pve.coreShield / pve.coreMax : 1;
  if (pve.coreShield > 0) pen.barAt(HUD_COLOR.shield);
  text[0] = right;
  pen.textAt(hudNumber(pve.coreHealth), HUD_COLOR.text, 'right');
}

// M23: carried motes of the most a carrier holds, enemies of your side on the right.
function hudPveMotesRow(pen, layout, pve) {
  const at = hudPveAt, text = hudTextAt, unit = layout.unit, y = at[0], height = HUD_PVE_ROW * 1.3 * unit;
  hudPveRowPanel(pen, height);
  text[0] = at[1] + HUD_PVE_PAD * unit; text[1] = y + height / 2;
  hudPveStat(pen, layout, 'MOTES', hudNumber(pve.carried), pve.carried >= PVE_BANK.carryMax ? HUD_COLOR.gold : HUD_COLOR.text);
  hudPveTotal(pen, layout, PVE_BANK.carryMax);
  text[0] = at[2] - HUD_PVE_PAD * unit;
  hudPveStatRight(pen, layout, 'ENEMIES', hudNumber(pve.enemiesLeft), HUD_COLOR.text);
  at[0] = y + height + 6 * unit;
}

// NPC-008: the remaining enemy count.
function hudPveEnemiesRow(pen, layout, pve) {
  const at = hudPveAt, box = hudBoxAt, text = hudTextAt, unit = layout.unit, y = at[0], height = HUD_PVE_ROW * 1.3 * unit, width = 150 * unit, left = layout.centerX - width / 2;
  box[0] = left; box[1] = y; box[2] = width; box[3] = height;
  pen.panelAt(0.5);
  text[0] = left + width - HUD_PVE_PAD * unit; text[1] = y + height / 2;
  hudPveStatRight(pen, layout, 'ENEMIES', hudNumber(pve.enemiesLeft), HUD_COLOR.text);
  at[0] = y + height + 6 * unit;
}

// M28 stealth contract: the most aware guard's meter and state, alarms, the score so far and the relic.
// The state label is the PvE section's own rule (Pve.awarenessState) for the most aware living guard, so the thresholds live in 14h only.
function hudPveMostAwareState() {
  let most = -1;
  for (let id = 0; id < Actors.count; id++) {
    if (!Pve.isEnemy(id) || !Actors.alive[id]) continue;
    if (most < 0 || Pve.awareness[id] > Pve.awareness[most]) most = id;
  }
  return most < 0 ? AWARENESS.UNAWARE : Pve.awarenessState(most);
}
function hudPveStealthRow(pen, layout, pve) {
  const at = hudPveAt, box = hudBoxAt, text = hudTextAt, unit = layout.unit, y = at[0], left = at[1], right = at[2], height = (HUD_PVE_ROW * 2 + 6) * unit;
  const color = hudAwarenessColor(pve.awareness), lineY = y + HUD_PVE_ROW * 0.6 * unit;
  hudPveRowPanel(pen, height);
  text[0] = left + HUD_PVE_PAD * unit; text[1] = lineY; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt(HUD_PVE_AWARENESS_TEXT[hudPveMostAwareState()], color, 'left');
  box[0] = left + 110 * unit; box[1] = lineY - HUD_PVE_BAR * unit / 2; box[2] = right - left - 120 * unit; box[3] = HUD_PVE_BAR * unit; box[4] = pve.awareness;
  pen.barAt(color);
  text[0] = left + HUD_PVE_PAD * unit; text[1] = y + HUD_PVE_ROW * 1.55 * unit;
  hudPveStat(pen, layout, 'ALARMS', hudNumber(pve.alarms), pve.alarms > 0 ? Hud.colors.bad : HUD_COLOR.text);
  text[0] = layout.centerX - 40 * unit;
  hudPveStat(pen, layout, 'SCORE', hudNumber(pve.score), HUD_COLOR.text);
  text[0] = right - HUD_PVE_PAD * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt(pve.relic ? 'RELIC TAKEN' : 'FIND THE RELIC', pve.relic ? HUD_COLOR.gold : HUD_COLOR.dim, 'right');
  at[0] = y + height + 6 * unit;
}

// M31 Test Chambers: chamber of the total, the timer in the colour of the medal it still earns, the exit lock, steps, portals.
function hudPveChamberTier(pve) {
  const row = PVE_CHAMBERS[pve.chamber - 1];
  return row ? chamberMedal(row, pve.chamberTime, pve.steps, pve.portals) : -1;
}
function hudPveChamberRow(pen, layout, pve) {
  const at = hudPveAt, text = hudTextAt, unit = layout.unit, y = at[0], left = at[1], right = at[2], height = (HUD_PVE_ROW * 2 + 6) * unit, tier = hudPveChamberTier(pve);
  hudPveRowPanel(pen, height);
  text[0] = left + HUD_PVE_PAD * unit; text[1] = y + HUD_PVE_ROW * 0.6 * unit;
  hudPveStat(pen, layout, 'CHAMBER', hudNumber(pve.chamber), HUD_COLOR.text);
  hudPveTotal(pen, layout, pve.chambers);
  text[0] = right - HUD_PVE_PAD * unit; text[2] = 20 * unit;
  pen.textAt(hudTime(pve.chamberTime), tier >= 0 ? HUD_PVE_MEDAL_COLORS[tier] : HUD_COLOR.dim, 'right');
  text[0] = left + HUD_PVE_PAD * unit; text[1] = y + HUD_PVE_ROW * 1.55 * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt(pve.solved ? 'EXIT OPEN' : 'EXIT LOCKED', pve.solved ? Hud.colors.good : Hud.colors.bad, 'left');
  text[0] = layout.centerX - 46 * unit;
  hudPveStat(pen, layout, 'STEPS', hudNumber(pve.steps), HUD_COLOR.text);
  text[0] = right - HUD_PVE_PAD * unit;
  hudPveStatRight(pen, layout, 'GATES', hudNumber(pve.portals), HUD_COLOR.text);
  at[0] = y + height + 6 * unit;
}

const HUD_PVE_ROWS = { wave: hudPveWaveRow, motes: hudPveMotesRow, enemies: hudPveEnemiesRow, stealth: hudPveStealthRow, chamber: hudPveChamberRow };

// ---- Boss bar (E13): name, health, phase pips, and the broken weak point ----
function hudPveBossBar(pen, layout, boss) {
  if (!boss || !boss.active) return;
  const at = hudPveAt, box = hudBoxAt, text = hudTextAt, unit = layout.unit, width = HUD_PVE_BOSS_WIDTH * unit, left = layout.centerX - width / 2;
  const y = at[0], barY = y + 22 * unit;
  text[0] = left; text[1] = y + 8 * unit; text[2] = 16 * unit;
  pen.labelAt(boss.name, HUD_COLOR.text, 'left');
  text[0] = left + width; text[2] = HUD_TEXT_SMALL * unit;
  hudPveFraction(pen, boss.phase, boss.phases, HUD_COLOR.warn);
  text[0] = left + width - 52 * unit;
  pen.textAt('PHASE', HUD_COLOR.dim, 'right');
  box[0] = left; box[1] = barY; box[2] = width; box[3] = 12 * unit; box[4] = boss.health;
  pen.barAt(Hud.colors.bad);
  box[2] = 2 * unit;
  for (let phase = 1; phase < boss.phases; phase++) {
    box[0] = left + width * (1 - phase / boss.phases);
    pen.rectAt(HUD_COLOR.black, 0.8);
  }
  text[0] = layout.centerX; text[1] = barY + 24 * unit; text[2] = HUD_TEXT_SMALL * unit;
  if (boss.weakDisabled) pen.labelAt('WEAK POINT BROKEN', HUD_COLOR.gold, 'center');
  at[0] = barY + 34 * unit;
}

// ---- Right-hand tables: chamber medal limits and the range drill stats ----
// Under the kill feed at the right edge; on phones the right side holds the touch buttons, so the tables sit under the
// status rows (statusBottom) and end left of the crosshair.
function hudPveSideLeft(layout, width) { return layout.touch ? layout.centerX - HUD_PVE_TOUCH_CROSS_GAP * layout.unit - width : layout.right - width; }
function hudPveSideTop(layout, statusBottom) { return layout.touch ? statusBottom : layout.top + HUD_PVE_SIDE_TOP * layout.unit; }
function hudPveSideRow(layout) { return (layout.compact ? HUD_PVE_SIDE_ROW_COMPACT : HUD_PVE_SIDE_ROW) * layout.unit; }

// Par times from the HUD block (PVE_HUD.parTime, set on entering the chamber); steps and gates from the chamber row.
// The side table's edges into hudPveAt[1] and [2], under the status rows that end at hudPveAt[0]; its panel's left, top and
// width into hudBoxAt (the table sets the height and draws it).
function hudPvePlaceTable(layout) {
  const at = hudPveAt, box = hudBoxAt, width = HUD_PVE_SIDE_WIDTH * layout.unit, left = hudPveSideLeft(layout, width);
  box[0] = left; box[1] = hudPveSideTop(layout, at[0]); box[2] = width;
  at[1] = left; at[2] = left + width;
}
function hudPveChamberTable(pen, layout, pve) {
  const row = PVE_CHAMBERS[pve.chamber - 1];
  if (!row || !pve.parTime) return;
  const current = hudPveChamberTier(pve), tiers = HUD_PVE_MEDAL_STARS.length;
  hudPvePlaceTable(layout);
  const box = hudBoxAt, text = hudTextAt, unit = layout.unit, left = hudPveAt[1], width = hudPveAt[2] - left, top = box[1], rowHeight = hudPveSideRow(layout);
  box[3] = rowHeight * (tiers + 3.4);
  pen.panelAt(0.5);
  text[1] = top + rowHeight * 0.6;
  hudPveTableHeader(pen, layout);
  for (let tier = 0; tier < tiers; tier++) {
    const y = top + rowHeight * (tier + 1.6), alpha = tier === current ? 1 : 0.55;
    box[0] = left; box[1] = y - rowHeight / 2; box[2] = 3 * unit; box[3] = rowHeight;
    if (tier === current) pen.rectAt(HUD_PVE_MEDAL_COLORS[tier]);
    text[0] = left + 8 * unit; text[1] = y; text[2] = HUD_TEXT_SMALL * unit;
    pen.textAt(HUD_PVE_MEDAL_STARS[tier], HUD_PVE_MEDAL_COLORS[tier], 'left', alpha);
    text[0] = left + width * HUD_PVE_TIME_COLUMN;
    pen.textAt(hudTime(pve.parTime[tier]), HUD_COLOR.text, 'right', alpha);
    text[0] = left + width * HUD_PVE_STEPS_COLUMN;
    pen.textAt(hudNumber(row.par.steps[tier]), HUD_COLOR.text, 'right', alpha);
    text[0] = left + width - 8 * unit;
    pen.textAt(hudNumber(row.par.portals[tier]), HUD_COLOR.text, 'right', alpha);
  }
  text[1] = top + rowHeight * (tiers + 1.7);
  hudPveTableRow(pen, layout, 'STARS', hudNumber(pve.stars), HUD_COLOR.gold);
  text[1] = text[1] + rowHeight;
  if (pve.chamber > 1) hudPveTableRow(pen, layout, 'LAST MEDAL', HUD_PVE_MEDAL_NAMES[pve.medal], HUD_COLOR.gold);
}
// The medal table's column titles at y (hudTextAt[1]).
function hudPveTableHeader(pen, layout) {
  const text = hudTextAt, unit = layout.unit, left = hudPveAt[1], width = hudPveAt[2] - left;
  text[0] = left + 8 * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt('MEDAL', HUD_COLOR.dim, 'left');
  text[0] = left + width * HUD_PVE_TIME_COLUMN;
  pen.textAt('TIME', HUD_COLOR.dim, 'right');
  text[0] = left + width * HUD_PVE_STEPS_COLUMN;
  pen.textAt('STEPS', HUD_COLOR.dim, 'right');
  text[0] = left + width - 8 * unit;
  pen.textAt('GATES', HUD_COLOR.dim, 'right');
}

// M30: shot statistics, every target down, and the running drill (kills of the drill, its clock, the best time).
function hudPveRangeTable(pen, layout, pve) {
  hudPvePlaceTable(layout);
  const box = hudBoxAt, text = hudTextAt, unit = layout.unit, left = hudPveAt[1], width = hudPveAt[2] - left, rowHeight = hudPveSideRow(layout);
  box[3] = rowHeight * 11.4;
  pen.panelAt(0.5);
  text[0] = left + 8 * unit; text[1] = box[1] + rowHeight * 0.6; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt('FIRING RANGE', HUD_COLOR.gold, 'left');
  text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'SHOTS', hudNumber(pve.shots), HUD_COLOR.text); text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'HITS', hudNumber(pve.hits), HUD_COLOR.text); text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'ACCURACY %', hudNumber(Math.floor(pve.accuracy * 100)), HUD_COLOR.text); text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'HEADSHOTS', hudNumber(pve.headshots), HUD_COLOR.text); text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'DAMAGE', hudNumber(pve.damage), HUD_COLOR.text); text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'KILLS', hudNumber(pve.kills), HUD_COLOR.text); text[1] = text[1] + rowHeight;
  text[0] = left + 8 * unit;
  pen.textAt('DRILL KILLS', HUD_COLOR.dim, 'left');
  text[0] = left + width - 8 * unit;
  hudPveFraction(pen, pve.drillKills, pve.drillTargets, HUD_COLOR.text); text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'DRILL TIME', hudTime(pve.stateTimeLeft), HUD_COLOR.warn); text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'BEST DRILL', pve.drillBest > 0 ? hudTime(pve.drillBest) : HUD_PVE_NONE, HUD_COLOR.gold); text[1] = text[1] + rowHeight;
  hudPveTableRow(pen, layout, 'DRILLS DONE', hudNumber(pve.drills), HUD_COLOR.text);
}

// ---- Bottom centre: the chamber hint and the Guardian Plate prompt ----
// On phones they rise above the ammo panel, centred on it (17a ammoRight, ammoWidth), never past the left margin.
function hudPveNoteY(layout, rise) { return layout.weaponBarY - (rise + (layout.touch ? HUD_PVE_TOUCH_NOTE_RISE : 0)) * layout.unit; }
function hudPveNoteX(layout, width) {
  if (!layout.touch) return layout.centerX;
  const centre = Math.min(layout.ammoRight - layout.ammoWidth / 2, layout.width * HUD_PVE_TOUCH_NOTE_RIGHT - width / 2);
  return Math.max(layout.left + width / 2, centre);
}
// The note's panel on screen (centre x, y and width): one source for the drawing and the phone layout test.
const hudPveNoteBox = { x: 0, y: 0, width: 0 };
function hudPveNoteRect(layout, text, rise) {
  hudTextAt[2] = HUD_PVE_NOTE_SIZE * layout.unit;
  HudBatch.measureAt(text);
  const width = hudTextAt[3] + HUD_PVE_NOTE_PAD * layout.unit;
  hudPveNoteBox.width = width; hudPveNoteBox.x = hudPveNoteX(layout, width); hudPveNoteBox.y = hudPveNoteY(layout, rise);
  return hudPveNoteBox;
}
function hudPveCentreNote(pen, layout, string, rise, color) {
  const unit = layout.unit, note = hudPveNoteRect(layout, string, rise), box = hudBoxAt, text = hudTextAt;
  box[0] = note.x - note.width / 2; box[1] = note.y - HUD_PVE_NOTE_HALF * unit; box[2] = note.width; box[3] = HUD_PVE_NOTE_HALF * 2 * unit;
  pen.panelAt(0.6);
  text[0] = note.x; text[1] = note.y; text[2] = HUD_PVE_NOTE_SIZE * unit;
  pen.textAt(string, color, 'center');
}
// DIF-004: the choice is the player's (18o, pause menu row) until they accept the plate. Phones get the short text.
function hudPveGuardianText(pve, touch) {
  if (pve.guardianAccepted) return touch ? HUD_PVE_GUARDIAN_READY_TOUCH : HUD_PVE_GUARDIAN_READY;
  return touch ? HUD_PVE_GUARDIAN_CHOICE_TOUCH : HUD_PVE_GUARDIAN_CHOICE;
}

function hudDrawPve(pen, layout) {
  const pve = Modes.hud.pve;
  if (!pve || !pve.active) return;
  const rows = HUD_PVE_PANELS[pve.mode] || [];
  hudPvePlaceRows(layout);
  for (let i = 0; i < rows.length; i++) HUD_PVE_ROWS[rows[i]](pen, layout, pve);
  hudPveBossBar(pen, layout, pve.boss);
  if (pve.mode === 'range') hudPveRangeTable(pen, layout, pve);
  if (pve.mode === 'puzzle') hudPveChamberTable(pen, layout, pve);
  if (pve.hint) hudPveCentreNote(pen, layout, pve.hint, HUD_PVE_HINT_RISE, HUD_COLOR.text);
  if (pve.guardianOffer) hudPveCentreNote(pen, layout, hudPveGuardianText(pve, layout.touch), HUD_PVE_PROMPT_RISE, HUD_COLOR.gold);
}

// ---- Operations: both teams' tickets under the team scores (low tickets in the warning colour) ----
function hudDrawTickets(pen, layout) {
  if (!OperationRun.active || !Modes.hudState().active) return;
  const unit = layout.unit, gap = 44 * unit, text = hudTextAt;
  text[0] = layout.centerX; text[1] = layout.top + 54 * unit; text[2] = HUD_TEXT_SMALL * unit;
  pen.textAt('TICKETS', HUD_COLOR.dim, 'center');
  text[2] = 17 * unit;
  for (let team = 0; team < TEAM_COUNT; team++) {
    const low = OperationRun.tickets[team] <= OPERATION_WARN_TICKETS;
    text[0] = team === 0 ? layout.centerX - gap : layout.centerX + gap;
    pen.textAt(hudNumber(OperationRun.tickets[team]), low ? Hud.colors.bad : Hud.teamColor(team), team === 0 ? 'right' : 'left');
  }
}

Hud.register('main', 'pve', 'pve', hudDrawPve);
Hud.register('main', 'tickets', 'header', hudDrawTickets);
