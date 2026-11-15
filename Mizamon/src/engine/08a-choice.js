// ---- Choice menu (small list that returns the chosen index, or -1 for back) --------------------------------------------------
// items: array of strings or { label, disabled }. options: x, y, w, cancel (default true), start.
function ChoiceLayer(items, options) {
  const o = options || {};
  this.opaque = false;
  this.items = items.map(function (item) { return typeof item === 'string' ? { label: item } : item; });
  this.x = o.x === undefined ? 150 : o.x;
  this.y = o.y === undefined ? 70 : o.y;
  this.w = o.w || 84;
  this.cancel = o.cancel !== false;
  this.cursor = o.start || 0;
  this.title = o.title || null;
  this.onMove = o.onMove || null;
  this.rowHeight = 12;
  this.h = this.items.length * this.rowHeight + 8 + (this.title ? 12 : 0);
  if (o.bottom !== undefined) this.y = o.bottom - this.h;
}
ChoiceLayer.prototype.update = function () {
  const count = this.items.length;
  if (Input.repeat.up) { this.cursor = (this.cursor + count - 1) % count; Sound.sfx('move'); if (this.onMove) this.onMove(this.cursor); }
  if (Input.repeat.down) { this.cursor = (this.cursor + 1) % count; Sound.sfx('move'); if (this.onMove) this.onMove(this.cursor); }
  if (Input.pressed.a) {
    if (this.items[this.cursor].disabled) { Sound.sfx('error'); return; }
    Sound.sfx('confirm');
    closeLayer(this, this.cursor);
  } else if (Input.pressed.b && this.cancel) { Sound.sfx('back'); closeLayer(this, -1); }
};
ChoiceLayer.prototype.draw = function () {
  drawPanel(this.x, this.y, this.w, this.h);
  ctx.font = FONT;
  let top = this.y + 5;
  if (this.title) { drawText(this.title, this.x + 6, top, COLOR.red); top += 12; }
  for (let i = 0; i < this.items.length; i++) {
    const item = this.items[i];
    const color = item.disabled ? COLOR.gray : COLOR.ink;
    if (i === this.cursor) { ctx.fillStyle = COLOR.red; ctx.fillRect(this.x + 5, top + i * this.rowHeight + 2, 3, 5); }
    drawText(item.label, this.x + 11, top + i * this.rowHeight, color);
  }
};
function choose(items, options) { return openLayer(new ChoiceLayer(items, options)); }
async function askYesNo(key, vars) {
  const prompt = new DialogLayer(T(key, vars));
  prompt.waitForChoice = true;
  pushLayer(prompt);
  while (prompt.box.isTyping()) await nextFrame();
  const answer = await choose([T('ui.yes'), T('ui.no')], { x: 170, bottom: DIALOG_BOX.y - 2, w: 64, start: 0 });
  closeLayer(prompt);
  return answer === 0;
}

