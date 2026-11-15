// ---- Bag -------------------------------------------------------------------------------------------------------------------------
// options.battle: pick an item for the battle (returns the item id) instead of using it.
function BagLayer(options) {
  this.opaque = true;
  this.battle = !!(options && options.battle);
  this.cursor = 0;
  this.refresh();
}
BagLayer.prototype.refresh = function () {
  this.entries = ITEM_IDS.filter(function (id) { return (G.bag[id] || 0) > 0; });
  this.cursor = Math.min(this.cursor, Math.max(0, this.entries.length - 1));
  this.descLines = this.entries.length > 0 ? wrapText(T('itemd.' + this.entries[this.cursor]), 214) : [];
};
BagLayer.prototype.update = function () {
  if (this.lastMoney !== G.money) { this.lastMoney = G.money; this.moneyText = T('ui.money', { n: G.money }); }
  const count = this.entries.length;
  if (Input.pressed.b) { Sound.sfx('back'); closeLayer(this, null); return; }
  if (count === 0) return;
  if (Input.repeat.up) { this.cursor = (this.cursor + count - 1) % count; this.refresh(); Sound.sfx('move'); }
  if (Input.repeat.down) { this.cursor = (this.cursor + 1) % count; this.refresh(); Sound.sfx('move'); }
  if (Input.pressed.a) {
    const itemId = this.entries[this.cursor];
    Sound.sfx('confirm');
    if (this.battle) { closeLayer(this, itemId); return; }
    this.useOutside(itemId);
  }
};
BagLayer.prototype.useOutside = async function (itemId) {
  if (this.busy) return;
  this.busy = true;
  const item = ITEMS[itemId];
  if (item.kind === 'recruit') await say('bag.battleOnly');
  else {
    const target = await openLayer(new PartyLayer({ mode: 'choose', canChoose: function (index) { return canUseItemOn(G.party[index], itemId); } }));
    if (target >= 0) {
      const mon = G.party[target];
      applyItemToMon(mon, itemId);
      G.bag[itemId]--;
      Sound.sfx('heal');
      await say('bag.used', { item: T('item.' + itemId), mon: speciesName(mon.sp) });
    }
  }
  this.busy = false;
  this.refresh();
};
BagLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(T('menu.bag'), 8, 4, COLOR.white);
  drawText(this.moneyText, 232, 4, COLOR.gold, 'right');
  drawPanel(4, 16, 232, 100);
  if (this.entries.length === 0) drawText(T('bag.empty'), 120, 60, COLOR.gray, 'center');
  for (let i = 0; i < this.entries.length; i++) {
    const id = this.entries[i];
    if (i === this.cursor) { ctx.fillStyle = COLOR.red; ctx.fillRect(10, 24 + i * 12, 3, 6); }
    drawText(T('item.' + id), 18, 22 + i * 12, COLOR.ink);
    drawText('x' + G.bag[id], 226, 22 + i * 12, COLOR.ink, 'right');
  }
  drawPanel(4, 120, 232, 36);
  for (let i = 0; i < this.descLines.length; i++) drawText(this.descLines[i], 10, 126 + i * 10, COLOR.ink);
};

