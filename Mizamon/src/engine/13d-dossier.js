// ---- Dossier (the fake police file) ----------------------------------------------------------------------------------------------------
function DossierLayer() {
  this.opaque = true;
  this.cursor = 0;
  this.scroll = 0;
  this.refresh();
}
DossierLayer.prototype.refresh = function () {
  const id = DEX_ORDER[this.cursor];
  this.id = id;
  this.seen = !!G.dex.seen[id];
  this.got = !!G.dex.got[id];
  this.fileLines = this.seen ? wrapText(T('sp.' + id), 134, FONT_SMALL) : [];
  this.abilityLines = this.seen ? wrapText(T('ab.' + SPECIES[id].ab), 100) : [];
  let seenCount = 0;
  let gotCount = 0;
  for (const speciesId of DEX_ORDER) { if (G.dex.seen[speciesId]) seenCount++; if (G.dex.got[speciesId]) gotCount++; }
  this.counts = T('dossier.counts', { seen: seenCount, got: gotCount, total: DEX_ORDER.length });
  this.caseText = T('dossier.case', { n: String(this.cursor + 1).padStart(3, '0') });
};
DossierLayer.prototype.update = function () {
  const count = DEX_ORDER.length;
  if (Input.pressed.b) { Sound.sfx('back'); closeLayer(this); return; }
  if (Input.repeat.up) { this.cursor = (this.cursor + count - 1) % count; Sound.sfx('move'); this.refresh(); }
  if (Input.repeat.down) { this.cursor = (this.cursor + 1) % count; Sound.sfx('move'); this.refresh(); }
  if (this.cursor < this.scroll) this.scroll = this.cursor;
  if (this.cursor > this.scroll + 8) this.scroll = this.cursor - 8;
};
DossierLayer.prototype.draw = function () {
  ctx.fillStyle = '#2a2f3a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(T('dossier.title'), 6, 3, COLOR.gold);
  ctx.font = FONT_SMALL;
  drawText(this.counts, 234, 4, COLOR.white, 'right');
  ctx.font = FONT;
  drawPanel(4, 14, 84, 142);
  for (let row = 0; row < 9; row++) {
    const index = this.scroll + row;
    if (index >= DEX_ORDER.length) break;
    const id = DEX_ORDER[index];
    const y = 18 + row * 15;
    if (index === this.cursor) { ctx.fillStyle = COLOR.gold; ctx.fillRect(7, y - 1, 78, 14); }
    const known = G.dex.seen[id];
    drawText(String(index + 1).padStart(2, '0'), 10, y + 2, COLOR.gray);
    ctx.font = FONT_SMALL;
    drawText(known ? SPECIES[id].n : '???', 24, y + 3, COLOR.ink);
    ctx.font = FONT;
    if (G.dex.got[id]) { ctx.fillStyle = COLOR.red; ctx.fillRect(80, y + 3, 4, 4); }
  }
  // the file page
  ctx.fillStyle = '#efe6cc'; ctx.fillRect(92, 14, 144, 142);
  ctx.fillStyle = '#c8bc98'; ctx.fillRect(92, 14, 144, 12);
  ctx.font = FONT_FILE;
  drawText(this.caseText, 97, 17, COLOR.ink);
  if (!this.seen) { ctx.font = FONT; drawText(T('dossier.unknown'), 164, 80, COLOR.gray, 'center'); return; }
  const species = SPECIES[this.id];
  ctx.fillStyle = '#d4dbe8'; ctx.fillRect(97, 30, 40, 40);
  ctx.fillStyle = '#9aa6bc'; for (let y = 36; y < 70; y += 8) ctx.fillRect(97, y, 6, 1); // the height ruler of the mugshot
  drawSprite(creatureSprite(this.id), 101, 33, 1.1, false);
  ctx.font = FONT;
  drawText(species.n, 142, 31, COLOR.ink);
  drawTypeTag(species.t, 142, 42);
  ctx.font = FONT_FILE;
  drawText(T('dossier.status'), 142, 55, COLOR.gray);
  drawText(T(this.got ? 'dossier.got' : 'dossier.seen'), 142, 63, this.got ? COLOR.red : COLOR.ink);
  ctx.font = FONT_SMALL;
  drawText(T('dossier.ability') + ': ' + this.abilityLines[0], 97, 74, COLOR.ink);
  for (let i = 0; i < this.fileLines.length; i++) drawText(this.fileLines[i], 97, 86 + i * 8, COLOR.ink);
  ctx.save();
  ctx.translate(196, 140);
  ctx.rotate(-0.2);
  ctx.strokeStyle = COLOR.red; ctx.lineWidth = 1;
  ctx.strokeRect(-36, -7, 72, 14);
  ctx.font = FONT_SMALL;
  drawText(T('dossier.stamp'), 0, -4, COLOR.red, 'center');
  ctx.restore();
  ctx.font = FONT;
};

