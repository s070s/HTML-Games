// ---- Shop -----------------------------------------------------------------------------------------------------------------------------------
function ShopLayer(stock) { this.opaque = true; this.cursor = 0; this.message = ''; this.stock = stock || SHOP_STOCK; this.refresh(); }
ShopLayer.prototype.refresh = function () {
  this.descLines = wrapText(T('itemd.' + this.stock[this.cursor]), 214);
};
ShopLayer.prototype.update = function () {
  if (this.lastMoney !== G.money) { this.lastMoney = G.money; this.moneyText = T('ui.money', { n: G.money }); }
  const count = this.stock.length;
  if (Input.pressed.b) { Sound.sfx('back'); closeLayer(this); return; }
  if (Input.repeat.up) { this.cursor = (this.cursor + count - 1) % count; this.message = ''; this.refresh(); Sound.sfx('move'); }
  if (Input.repeat.down) { this.cursor = (this.cursor + 1) % count; this.message = ''; this.refresh(); Sound.sfx('move'); }
  if (!Input.pressed.a) return;
  const itemId = this.stock[this.cursor];
  if (G.money < ITEMS[itemId].price) { Sound.sfx('error'); this.message = T('shop.poor'); return; }
  G.money -= ITEMS[itemId].price;
  G.bag[itemId] = (G.bag[itemId] || 0) + 1;
  Sound.sfx('buy');
  this.message = T('shop.bought', { item: T('item.' + itemId) });
};
const SHOP_NAME_MAX_W = 116; // the item name starts at x 18 and the count column ends at x 150 ("x99" is about 16 px wide)
ShopLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(T('shop.title'), 8, 4, COLOR.white);
  drawText(this.moneyText, 232, 4, COLOR.gold, 'right');
  drawPanel(4, 16, 232, 103); // room for ten items (the Δυτικά kiosks), 10 px a row
  for (let i = 0; i < this.stock.length; i++) {
    const id = this.stock[i];
    if (i === this.cursor) { ctx.fillStyle = COLOR.red; ctx.fillRect(10, 21 + i * 10, 3, 6); }
    drawText(T('item.' + id), 18, 19 + i * 10, COLOR.ink);
    drawText('x' + (G.bag[id] || 0), 150, 19 + i * 10, COLOR.gray, 'right');
    drawText(String(ITEMS[id].price), 226, 19 + i * 10, COLOR.ink, 'right');
  }
  drawPanel(4, 120, 232, 36);
  for (let i = 0; i < this.descLines.length; i++) drawText(this.descLines[i], 10, 125 + i * 9, COLOR.ink);
  drawText(this.message, 10, 144, COLOR.red);
};

