// ---- Αρχείο Ασθενών: the archived creatures, six rows at a time ---------------------------------------------------------------
// options: mode 'view' (browse, B closes) | 'withdraw' (A picks the creature to bring back; the layer returns its index, or -1).
const ARCHIVE_ROWS = 6;
function ArchiveLayer(options) {
  this.opaque = true;
  this.mode = options && options.mode === 'withdraw' ? 'withdraw' : 'view';
  this.cursor = 0;
  this.top = 0;
  this.refresh();
}
ArchiveLayer.prototype.refresh = function () {
  this.rows = G.archive.map(function (mon) {
    return { name: speciesName(mon.sp), level: T('ui.lv') + mon.lv, hp: mon.hp + '/' + maxHp(mon), fraction: mon.hp / maxHp(mon), type: SPECIES[mon.sp].t };
  });
  this.title = T(this.mode === 'withdraw' ? 'arch.pickWithdraw' : 'arch.listTitle', { n: G.archive.length, max: ARCHIVE_MAX });
  this.position = (this.cursor + 1) + '/' + G.archive.length;
};
ArchiveLayer.prototype.moveCursor = function (target) {
  this.cursor = target;
  if (this.cursor < this.top) this.top = this.cursor;
  if (this.cursor >= this.top + ARCHIVE_ROWS) this.top = this.cursor - ARCHIVE_ROWS + 1;
  this.refresh();
  Sound.sfx('move');
};
ArchiveLayer.prototype.update = function () {
  const count = G.archive.length;
  if (Input.repeat.up) this.moveCursor((this.cursor + count - 1) % count);
  if (Input.repeat.down) this.moveCursor((this.cursor + 1) % count);
  if (Input.repeat.left) this.moveCursor(Math.max(0, this.cursor - ARCHIVE_ROWS));
  if (Input.repeat.right) this.moveCursor(Math.min(count - 1, this.cursor + ARCHIVE_ROWS));
  if (Input.pressed.b) { Sound.sfx('back'); closeLayer(this, -1); return; }
  if (Input.pressed.a && this.mode === 'withdraw') { Sound.sfx('confirm'); closeLayer(this, this.cursor); }
};
ArchiveLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(this.title, 8, 4, COLOR.white);
  drawText(this.position, 232, 4, COLOR.white, 'right');
  for (let slot = 0; slot < ARCHIVE_ROWS; slot++) {
    const index = this.top + slot;
    if (index >= this.rows.length) break;
    const row = this.rows[index];
    const y = 16 + slot * 23;
    drawPanel(4, y, 232, 22);
    if (index === this.cursor) { ctx.fillStyle = COLOR.gold; ctx.fillRect(4, y + 2, 3, 18); }
    drawCreatureIcon(G.archive[index].sp, 10, y + 3, 16);
    drawText(row.name, 30, y + 3, COLOR.ink);
    drawText(row.level, 30, y + 12, COLOR.ink);
    drawTypeTag(row.type, 100, y + 3);
    drawBar(100, y + 16, 70, 3, row.fraction);
    drawText(row.hp, 176, y + 7, COLOR.ink);
  }
};

