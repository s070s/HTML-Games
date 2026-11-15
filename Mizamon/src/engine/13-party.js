// ---- Party ---------------------------------------------------------------------------------------------------------------------
// options: mode 'view' | 'choose' | 'switch'; activeIndex (cannot be chosen in switch mode); forced; canChoose(index) -> bool;
// titleKey (a strings key for the heading instead of the default one).
function PartyLayer(options) {
  const o = options || {};
  this.opaque = true;
  this.titleKey = o.titleKey || null;
  this.mode = o.mode || 'view';
  this.activeIndex = o.activeIndex === undefined ? -1 : o.activeIndex;
  this.forced = !!o.forced;
  this.canChoose = o.canChoose || null;
  this.cursor = o.start || 0;
  this.swapFrom = -1;
  if (this.mode === 'switch') { // start on the first creature that can actually go in
    const first = G.party.findIndex(function (mon, index) { return mon.hp > 0 && index !== o.activeIndex; });
    if (first >= 0) this.cursor = first;
  }
  this.refresh();
}
PartyLayer.prototype.refresh = function () {
  this.rows = G.party.map(function (mon) {
    return { name: speciesName(mon.sp), level: T('ui.lv') + mon.lv, hp: mon.hp + '/' + maxHp(mon), fraction: mon.hp / maxHp(mon), fainted: mon.hp <= 0 };
  });
  this.title = T(this.titleKey || (this.mode === 'switch' ? 'party.pickSwitch' : (this.mode === 'choose' ? 'party.pickTarget' : 'party.title')));
};
PartyLayer.prototype.update = function () {
  const count = G.party.length;
  if (Input.repeat.up) { this.cursor = (this.cursor + count - 1) % count; Sound.sfx('move'); }
  if (Input.repeat.down) { this.cursor = (this.cursor + 1) % count; Sound.sfx('move'); }
  if (Input.pressed.b) {
    if (this.swapFrom >= 0) { this.swapFrom = -1; Sound.sfx('back'); return; }
    if (this.forced) { Sound.sfx('error'); return; }
    Sound.sfx('back'); closeLayer(this, -1); return;
  }
  if (!Input.pressed.a) return;
  if (this.mode !== 'view') {
    const mon = G.party[this.cursor];
    const blocked = (this.mode === 'switch' && (mon.hp <= 0 || this.cursor === this.activeIndex)) || (this.canChoose && !this.canChoose(this.cursor));
    if (blocked) { Sound.sfx('error'); return; }
    Sound.sfx('confirm'); closeLayer(this, this.cursor); return;
  }
  Sound.sfx('confirm');
  this.runViewAction(this.cursor);
};
PartyLayer.prototype.runViewAction = async function (index) {
  if (this.swapFrom >= 0) {
    const from = this.swapFrom;
    this.swapFrom = -1;
    const held = G.party[from];
    G.party[from] = G.party[index];
    G.party[index] = held;
    this.refresh();
    return;
  }
  this.busy = true;
  const choice = await choose([T('party.summary'), T('party.move'), T('ui.cancel')], { x: 150, y: 40, w: 84 });
  if (choice === 0) await openLayer(new SummaryLayer(index));
  if (choice === 1 && G.party.length > 1) this.swapFrom = index;
  this.busy = false;
  this.refresh();
};
PartyLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(this.title, 8, 4, COLOR.white);
  for (let i = 0; i < this.rows.length; i++) {
    const row = this.rows[i];
    const y = 16 + i * 23;
    const selected = i === this.cursor;
    drawPanel(4, y, 232, 22);
    if (selected) { ctx.fillStyle = COLOR.gold; ctx.fillRect(4, y + 2, 3, 18); }
    if (i === this.swapFrom) { ctx.fillStyle = COLOR.red; ctx.fillRect(4, y + 2, 3, 18); }
    drawCreatureIcon(G.party[i].sp, 10, y + 3, 16);
    drawText(row.name, 30, y + 3, row.fainted ? COLOR.gray : COLOR.ink);
    drawText(row.level, 30, y + 12, COLOR.ink);
    drawBar(100, y + 9, 70, 4, row.fraction);
    drawText(row.hp, 176, y + 7, COLOR.ink);
    if (G.party[i].status) drawStatusTag(G.party[i].status.id, 100, y + 14);
    if (i === this.activeIndex) drawText(T('party.active'), 228, y + 3, COLOR.red, 'right');
  }
};

