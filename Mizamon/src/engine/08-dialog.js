// ---- Dialog layer ------------------------------------------------------------------------------------------------------------
const DIALOG_BOX = { x: 4, y: 112, w: 232, h: 44 };
function DialogLayer(text) {
  this.opaque = false;
  this.box = new TextBox(DIALOG_BOX.w - 20, 3);
  this.box.setText(text);
  this.blink = 0;
}
DialogLayer.prototype.update = function () {
  this.box.update();
  this.blink++;
  if (Input.pressed.a || Input.pressed.b) {
    if (this.waitForChoice) { if (this.box.isTyping()) this.box.advance(); return; }
    if (this.box.advance()) { Sound.sfx('confirm'); closeLayer(this); }
  }
};
DialogLayer.prototype.draw = function () {
  drawPanel(DIALOG_BOX.x, DIALOG_BOX.y, DIALOG_BOX.w, DIALOG_BOX.h);
  ctx.font = FONT;
  this.box.draw(DIALOG_BOX.x + 10, DIALOG_BOX.y + 7, 11, COLOR.ink);
  if (!this.box.isTyping() && blinkShows(this.blink, 4, OPT.flashesOff)) {
    ctx.fillStyle = COLOR.red;
    ctx.fillRect(DIALOG_BOX.x + DIALOG_BOX.w - 14, DIALOG_BOX.y + DIALOG_BOX.h - 12, 6, 2);
    ctx.fillRect(DIALOG_BOX.x + DIALOG_BOX.w - 13, DIALOG_BOX.y + DIALOG_BOX.h - 10, 4, 2);
    ctx.fillRect(DIALOG_BOX.x + DIALOG_BOX.w - 12, DIALOG_BOX.y + DIALOG_BOX.h - 8, 2, 2);
  }
};
function say(textOrKey, vars) {
  const text = vars === undefined && STRINGS[textOrKey] === undefined ? textOrKey : T(textOrKey, vars);
  return openLayer(new DialogLayer(text));
}
async function sayAll(keys, vars) { for (const key of keys) await say(key, vars); }

