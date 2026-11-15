// ---- Summary ---------------------------------------------------------------------------------------------------------------------
function SummaryLayer(index) { this.opaque = true; this.index = index; this.moveCursor = 0; this.refresh(); }
SummaryLayer.prototype.refresh = function () {
  const mon = G.party[this.index];
  const species = SPECIES[mon.sp];
  this.mon = mon;
  this.statLines = STAT_KEYS.map(function (key) { return [T('stat.' + key), String(statOf(mon, key))]; });
  this.abilityName = T('ab.' + species.ab);
  this.abilityLines = wrapText(T('abd.' + species.ab), 100, FONT_SMALL).slice(0, 2); // only two lines fit
  this.hpText = mon.hp + '/' + maxHp(mon);
  this.xpNeeded = mon.lv >= MAX_LEVEL ? 0 : xpForLevel(mon.lv + 1) - mon.xp;
  this.xpFraction = mon.lv >= MAX_LEVEL ? 1 : (mon.xp - xpForLevel(mon.lv)) / (xpForLevel(mon.lv + 1) - xpForLevel(mon.lv));
  this.xpText = T('ui.nextLevel', { n: this.xpNeeded });
  this.moveCursor = Math.min(this.moveCursor, mon.moves.length - 1);
  this.refreshMove();
};
SummaryLayer.prototype.refreshMove = function () {
  const moveId = this.mon.moves[this.moveCursor];
  this.moveInfo = moveInfoLine(moveId);
  this.moveDescription = wrapText(T('move.' + moveId), 118, FONT_SMALL);
};
SummaryLayer.prototype.update = function () {
  if (Input.pressed.b || Input.pressed.a) { Sound.sfx('back'); closeLayer(this); return; }
  if (Input.repeat.up) { this.moveCursor = (this.moveCursor + this.mon.moves.length - 1) % this.mon.moves.length; this.refreshMove(); Sound.sfx('move'); }
  if (Input.repeat.down) { this.moveCursor = (this.moveCursor + 1) % this.mon.moves.length; this.refreshMove(); Sound.sfx('move'); }
  if (Input.repeat.left) { this.index = (this.index + G.party.length - 1) % G.party.length; this.refresh(); Sound.sfx('move'); }
  if (Input.repeat.right) { this.index = (this.index + 1) % G.party.length; this.refresh(); Sound.sfx('move'); }
};
SummaryLayer.prototype.draw = function () {
  const mon = this.mon;
  const species = SPECIES[mon.sp];
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawPanel(4, 4, 100, 152);
  drawText(species.n, 10, 9, COLOR.ink);
  drawText(T('ui.lv') + mon.lv, 98, 9, COLOR.ink, 'right');
  drawTypeTag(species.t, 10, 20);
  ctx.fillStyle = '#dfe8f8'; ctx.fillRect(14, 34, 80, 62);
  drawSprite(creatureSprite(mon.sp), 22, 34, 2, false);
  drawBar(12, 101, 84, 4, mon.hp / maxHp(mon));
  drawText(this.hpText, 98, 107, COLOR.ink, 'right');
  drawBar(12, 119, 84, 3, this.xpFraction);
  ctx.font = FONT_SMALL;
  drawText(this.xpText, 98, 124, COLOR.gray, 'right');
  ctx.font = FONT;
  drawText(this.abilityName, 10, 131, COLOR.red);
  ctx.font = FONT_SMALL;
  let y = 141;
  for (const line of this.abilityLines) { drawText(line, 10, y, COLOR.ink); y += 8; }
  ctx.font = FONT;
  drawPanel(108, 4, 128, 152);
  for (let i = 0; i < this.statLines.length; i++) {
    drawText(this.statLines[i][0], 114, 9 + i * 10, COLOR.ink);
    drawText(this.statLines[i][1], 230, 9 + i * 10, COLOR.ink, 'right');
  }
  ctx.fillStyle = COLOR.paperDark; ctx.fillRect(112, 72, 120, 1);
  for (let i = 0; i < mon.moves.length; i++) {
    const move = MOVES[mon.moves[i]];
    if (i === this.moveCursor) { ctx.fillStyle = COLOR.red; ctx.fillRect(112, 78 + i * 10, 3, 6); }
    drawText(move.n, 118, 76 + i * 10, COLOR.ink);
    ctx.fillStyle = TYPE_COLORS[move.t]; ctx.fillRect(226, 77 + i * 10, 6, 6);
    if (OPT.typeMarks) drawTypeMark(move.t, 226, 77 + i * 10, '#ffffff');
  }
  ctx.fillStyle = COLOR.paperDark; ctx.fillRect(112, 118, 120, 1);
  ctx.font = FONT_SMALL;
  drawText(this.moveInfo, 114, 121, COLOR.red);
  for (let i = 0; i < Math.min(3, this.moveDescription.length); i++) drawText(this.moveDescription[i], 114, 130 + i * 8, COLOR.ink);
  ctx.font = FONT;
};

