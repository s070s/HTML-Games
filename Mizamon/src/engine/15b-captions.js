// ---- Captions: what every screen says to the large-text bar ---------------------------------------------------------------------
// caption() returns the text being read on the screen (null: nothing new, the bar keeps what it shows). The bar reads the top screen.
// Never a second place that holds a text: every caption is built from the same strings and values the screen draws.
function joinCaption(parts) { return parts.filter(function (part) { return part; }).join('. '); }
// The whole text of a caption, as the bar shows it: a plain string, or { context, text } (a question or a title, then the chosen row).
// The context (the question, or who is fighting) ends in a full stop before the row unless it already ends in a mark, so a screen reader pauses between them.
function captionLead(context) { return /[.?!;:…»]$/.test(context) ? context + ' ' : context + '. '; }
function captionString(caption) { if (typeof caption === 'string') return caption; if (caption.parts) return caption.parts.map(function (part) { return part.text; }).join(' '); return captionLead(caption.context) + caption.text; }
DialogLayer.prototype.caption = function () { return this.box.pageText(); };
ChoiceLayer.prototype.caption = function () {
  const below = layers[layers.indexOf(this) - 1];
  const question = below instanceof DialogLayer ? below.box.pageText() : (this.title || ''); // a yes or no question: the question first
  const label = this.items[this.cursor].label;
  return question ? { context: question, text: label } : label;
};
OverworldLayer.prototype.caption = function () { return T(this.map.name); };
TicketLayer.prototype.caption = function () { return joinCaption([T('kep.sign'), T('kep.yourNumber') + ' 9.999']); };
MonitorLayer.prototype.caption = function () { return T('hosp.monitor'); };
BadgeLayer.prototype.caption = function () { return joinCaption([T(this.titleKey), T(this.subKey)]); };
ChapterLayer.prototype.caption = function () { return joinCaption([T('chapter.title'), T('chapter.sub')]); };
// Only the line that has just come in (the one nearest the line y = CREDITS_CAPTION_Y, from above) is captioned: the bar rewrites its text only when it changes,
// so each line is read once instead of the whole page again at every new line.
const CREDITS_CAPTION_Y = 110;
const CREDITS_CAPTION_TOP = 30;
CreditsLayer.prototype.caption = function () {
  let newest = null;
  let newestY = -Infinity;
  if (!this.lines) return null;
  for (let i = 0; i < this.lines.length; i++) {
    const y = creditsLineY(this.frame, i);
    if (this.lines[i] && y >= CREDITS_CAPTION_TOP && y <= CREDITS_CAPTION_Y && y > newestY) { newest = this.lines[i]; newestY = y; }
  }
  return newest;
};
NoticeLayer.prototype.caption = function () { return { parts: [{ text: lookupString('notice.line1', 'el'), lang: 'el' }, { text: lookupString('notice.line2', 'en'), lang: 'en' }] }; };
TitleLayer.prototype.caption = function () { return joinCaption(['MIZAMON', T('title.sub')]); };
GenderLayer.prototype.caption = function () { return { context: T('gender.title'), text: T(this.cursor === 0 ? 'gender.m' : 'gender.f') }; };
NameLayer.prototype.caption = function () {
  const pageRows = NAME_PAGES[this.page].length;
  const key = this.row < pageRows ? (NAME_PAGES[this.page][this.row][this.col] || '') : [T('name.switch'), T('name.del'), T('name.ok')][this.col];
  return { context: T('name.title'), text: this.name + (key ? ' [' + key + ']' : '') };
};
BackdropLayer.prototype.caption = function () { return null; };
StarterLayer.prototype.caption = function () {
  const species = SPECIES[STARTERS[this.cursor]];
  return joinCaption([species.n, T('type.' + species.t), this.abilityName + ': ' + this.abilityLines.join(' ')]);
};
MapLayer.prototype.caption = function () {
  if (!this.lines) return T('map.title');
  return (this.sheet ? this.lines : this.lines.slice(0, 2)).join('. '); // the last line of the plain view is the key hint
};
PartyLayer.prototype.caption = function () {
  const mon = G.party[this.cursor];
  const row = this.rows[this.cursor];
  return joinCaption([this.title, row.name, row.level, row.hp, mon.status ? statusLabel(mon.status.id) : '', this.cursor === this.activeIndex ? T('party.active') : '']);
};
ArchiveLayer.prototype.caption = function () {
  const row = this.rows[this.cursor];
  return row ? joinCaption([this.title, row.name, row.level, row.hp, T('type.' + row.type)]) : this.title;
};
SummaryLayer.prototype.caption = function () {
  const mon = this.mon;
  return joinCaption([speciesName(mon.sp), T('ui.lv') + mon.lv, T('type.' + SPECIES[mon.sp].t), this.hpText, MOVES[mon.moves[this.moveCursor]].n + ': ' + this.moveInfo, this.moveDescription.join(' ')]);
};
BagLayer.prototype.caption = function () {
  if (this.entries.length === 0) return T('bag.empty');
  const id = this.entries[this.cursor];
  return T('item.' + id) + ' x' + G.bag[id] + '. ' + this.descLines.join(' ');
};
DossierLayer.prototype.caption = function () {
  if (!this.seen) return joinCaption([this.caseText, T('dossier.unknown')]);
  return joinCaption([this.caseText, SPECIES[this.id].n, T(this.got ? 'dossier.got' : 'dossier.seen'), T('sp.' + this.id)]);
};
OptionsLayer.prototype.caption = function () {
  const label = T(OPTIONS_ROWS[this.cursor]);
  return this.cursor < OPTIONS_ACCESS_ROW ? label + ': ' + this.rowValue(this.cursor) : label;
};
AccessibilityLayer.prototype.caption = function () {
  const row = ACCESS_ROWS[this.cursor];
  if (!row) return T('ui.back');
  return T(row.label) + ': ' + this.rowValue(row) + '. ' + this.descLines.join(' ');
};
ShopLayer.prototype.caption = function () {
  const id = this.stock[this.cursor];
  return joinCaption([T('item.' + id) + ' ' + ITEMS[id].price, this.descLines.join(' '), this.message]);
};
EvolveLayer.prototype.caption = function () {
  return T(this.frame > 80 ? 'evolve.done' : 'evolve.start', { from: speciesName(this.fromId), to: speciesName(this.targetId) });
};
// Who is fighting, as the two poll panels show it: name and level of each side, and the HP numbers of the player's side only (the foe's are not drawn).
BattleLayer.prototype.sidesCaption = function () {
  const sides = [];
  for (let side = 0; side < this.views.length; side++) {
    const view = this.views[side];
    if (view.visible) sides.push([view.name, view.lvText, side === 0 ? view.hpText : ''].filter(function (part) { return part; }).join(' '));
  }
  return joinCaption(sides);
};
BattleLayer.prototype.caption = function () {
  if (this.mode === 'text') return this.box.pageText();
  if (this.mode === 'root') return { context: joinCaption([this.sidesCaption(), this.rootPrompt.join(' ')]), text: T(ROOT_LABELS[this.rootCursor]) };
  if (this.mode === 'moves') return { context: this.sidesCaption(), text: MOVES[activeMon(this.battle, 0).moves[this.moveCursor]].n + ': ' + T('type.' + this.moveType) + ', ' + this.moveInfo };
  return null;
};

