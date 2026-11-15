// ---- Accessibility (MZ-A11Y-01): large text, type marks, flashes off, hold to repeat, one-hand touch controls ------------------------------------
// Each row: the option it changes, its label, the strings of its values (a flag is On/Off). The description of the chosen row is 'acc.d.' + option.
const ACCESS_ROWS = [
  { option: 'largeText', label: 'acc.largeText', values: 'acc.large', count: LARGE_TEXT_FACTORS.length },
  { option: 'typeMarks', label: 'acc.marks' },
  { option: 'flashesOff', label: 'acc.flashes' },
  { option: 'holdRepeat', label: 'acc.repeat', values: 'acc.repeat', count: HOLD_REPEAT_LEVELS.length },
  { option: 'touchHand', label: 'acc.hand', values: 'acc.hand', count: TOUCH_HANDS },
];
function AccessibilityLayer() { this.opaque = true; this.cursor = 0; this.refresh(); }
AccessibilityLayer.prototype.refresh = function () {
  const row = ACCESS_ROWS[this.cursor];
  this.descLines = row ? wrapText(T('acc.d.' + row.option), 214, FONT_SMALL) : [];
};
AccessibilityLayer.prototype.rowValue = function (row) {
  const value = OPT[row.option];
  return row.values ? T(row.values + value) : T(value ? 'ui.on' : 'ui.off');
};
AccessibilityLayer.prototype.change = function (direction) {
  const row = ACCESS_ROWS[this.cursor];
  if (!row) return;
  OPT[row.option] = row.values ? (OPT[row.option] + row.count + direction) % row.count : !OPT[row.option];
  saveOptions();
  if (row.option === 'largeText' || row.option === 'touchHand') resizeScreen(); // the bar and the buttons change the layout
  Sound.sfx('move');
};
AccessibilityLayer.prototype.update = function () {
  const rows = ACCESS_ROWS.length + 1; // the options and Back
  if (Input.pressed.b) { Sound.sfx('back'); closeLayer(this); return; }
  if (Input.repeat.up) { this.cursor = (this.cursor + rows - 1) % rows; this.refresh(); Sound.sfx('move'); }
  if (Input.repeat.down) { this.cursor = (this.cursor + 1) % rows; this.refresh(); Sound.sfx('move'); }
  if (Input.pressed.left) this.change(-1);
  if (Input.pressed.right) this.change(1);
  if (Input.pressed.a) { if (this.cursor === ACCESS_ROWS.length) { Sound.sfx('back'); closeLayer(this); } else this.change(1); }
};
AccessibilityLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(T('acc.title'), TEXT_EDGE_MARGIN + 1, 5, COLOR.white); // one pixel inside the margin: a capital's overhang (the A of Accessibility) reaches back past its x
  ctx.font = FONT_SMALL;
  drawText(T('opt.hint'), SCREEN_W - TEXT_EDGE_MARGIN - 1, 6, '#b8c4e8', 'right');
  ctx.font = FONT;
  drawPanel(4, 17, 232, 94);
  for (let i = 0; i <= ACCESS_ROWS.length; i++) {
    const y = 23 + i * 15;
    if (i === this.cursor) { ctx.fillStyle = COLOR.red; ctx.fillRect(10, y + 1, 3, 6); }
    if (i === ACCESS_ROWS.length) { drawText(T('ui.back'), 18, y, COLOR.ink); continue; }
    drawText(T(ACCESS_ROWS[i].label), 18, y, COLOR.ink);
    drawText('< ' + this.rowValue(ACCESS_ROWS[i]) + ' >', 228, y, COLOR.blue, 'right');
  }
  drawPanel(4, 114, 232, 42);
  ctx.font = FONT_SMALL;
  for (let i = 0; i < Math.min(3, this.descLines.length); i++) drawText(this.descLines[i], 10, 120 + i * 10, COLOR.ink);
  ctx.font = FONT;
};

