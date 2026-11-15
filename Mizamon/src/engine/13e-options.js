// ---- Options ------------------------------------------------------------------------------------------------------------------------------
const OPTIONS_ROWS = ['opt.lang', 'opt.sound', 'opt.speed', 'opt.motion', 'opt.access', 'ui.back']; // the label of every row; the last one closes the screen
const OPTIONS_ACCESS_ROW = 4; // opens the Accessibility screen
function OptionsLayer() { this.opaque = true; this.cursor = 0; }
OptionsLayer.prototype.rowValue = function (index) {
  if (index === 0) return OPT.lang === 'el' ? 'Ελληνικά' : 'English';
  if (index === 1) return T(OPT.sound ? 'ui.on' : 'ui.off');
  if (index === 2) return T('opt.speed' + OPT.textSpeed);
  if (index === 3) return T(OPT.reduceMotion ? 'ui.on' : 'ui.off');
  return '';
};
OptionsLayer.prototype.change = function (direction) {
  if (this.cursor === 0) OPT.lang = OPT.lang === 'el' ? 'en' : 'el';
  else if (this.cursor === 1) { OPT.sound = !OPT.sound; Sound.applyMute(); }
  else if (this.cursor === 2) OPT.textSpeed = (OPT.textSpeed + 3 + direction) % 3;
  else if (this.cursor === 3) OPT.reduceMotion = !OPT.reduceMotion;
  else return;
  saveOptions();
  Sound.sfx(SOUNDS.move);
};
OptionsLayer.prototype.update = function () {
  if (Input.pressed.b) { Sound.sfx(SOUNDS.back); closeLayer(this); return; }
  const rows = OPTIONS_ROWS.length;
  if (Input.repeat.up) { this.cursor = (this.cursor + rows - 1) % rows; Sound.sfx(SOUNDS.move); }
  if (Input.repeat.down) { this.cursor = (this.cursor + 1) % rows; Sound.sfx(SOUNDS.move); }
  if (Input.pressed.left) this.change(-1);
  if (Input.pressed.right) this.change(1);
  if (!Input.pressed.a) return;
  if (this.cursor === rows - 1) { Sound.sfx(SOUNDS.back); closeLayer(this); }
  else if (this.cursor === OPTIONS_ACCESS_ROW) { Sound.sfx(SOUNDS.confirm); pushLayer(new AccessibilityLayer()); }
  else this.change(1);
};

OptionsLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(T('menu.options'), 8, 6, COLOR.white);
  drawPanel(8, 20, 224, 100);
  for (let i = 0; i < OPTIONS_ROWS.length; i++) {
    const y = 26 + i * 15;
    if (i === this.cursor) { ctx.fillStyle = COLOR.red; ctx.fillRect(14, y + 1, 3, 6); }
    drawText(T(OPTIONS_ROWS[i]), 22, y, COLOR.ink);
    if (i < OPTIONS_ACCESS_ROW) drawText('< ' + this.rowValue(i) + ' >', 224, y, COLOR.blue, 'right');
    else if (i === OPTIONS_ACCESS_ROW) drawText('>', 224, y, COLOR.blue, 'right');
  }
  drawText(T('opt.hint'), 120, 130, '#b8c4e8', 'center');
};

