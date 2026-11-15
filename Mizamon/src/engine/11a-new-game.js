// ---- Gender, name, professor, starter (new game) ------------------------------------------------------------------------
function GenderLayer() { this.opaque = true; this.cursor = 0; this.frame = 0; }
GenderLayer.prototype.update = function () {
  this.frame++;
  if (Input.pressed.left || Input.pressed.right) { this.cursor = 1 - this.cursor; Sound.sfx('move'); }
  if (Input.pressed.a) { Sound.sfx('confirm'); closeLayer(this, this.cursor === 0 ? 'm' : 'f'); }
};
GenderLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(T('gender.title'), 120, 10, COLOR.white, 'center');
  const labels = ['gender.m', 'gender.f'];
  const looks = ['playerM', 'playerF'];
  for (let i = 0; i < 2; i++) {
    const x = 28 + i * 100;
    ctx.fillStyle = i === this.cursor ? COLOR.gold : '#34447a';
    ctx.fillRect(x, 28, 84, 100);
    ctx.fillStyle = '#10142e'; ctx.fillRect(x + 2, 30, 80, 96);
    const frame = i === this.cursor && !OPT.reduceMotion ? ((this.frame >> 4) % 2 === 0 ? 1 : 2) : 0;
    ctx.drawImage(charSheet(looks[i]), frame * 16, 0, 16, 16, x + 18, 44, 48, 48);
    drawText(T(labels[i]), x + 42, 104, i === this.cursor ? COLOR.gold : COLOR.white, 'center');
  }
  drawText(T('ui.pressA'), 120, 142, '#b8c4e8', 'center');
};
const NAME_PAGES = [
  ['ΑΒΓΔΕΖΗΘ', 'ΙΚΛΜΝΞΟΠ', 'ΡΣΤΥΦΧΨΩ'],
  ['ABCDEFGH', 'IJKLMNOP', 'QRSTUVWX', 'YZ.-0123'],
];
function NameLayer(defaultName) {
  this.opaque = true;
  this.name = defaultName;
  this.page = 0;
  this.row = 3;
  this.col = 2;
  this.frame = 0;
}
NameLayer.prototype.rows = function () { return NAME_PAGES[this.page].length + 1; }; // the last row holds the buttons
NameLayer.prototype.onKey = function (event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key === 'Backspace') { this.name = this.name.slice(0, -1); return true; }
  if (event.key === 'Enter') { this.finish(); return true; }
  if (event.key.length === 1 && /[A-Za-zΑ-Ωα-ωάέήίόύώΐΰ0-9.\- ]/.test(event.key)) {
    if (this.name.length < NAME_MAX) this.name += event.key.toLocaleUpperCase('el').replace(/[ΆΈΉΊΌΎΏ]/g, function (c) { return 'ΑΕΗΙΟΥΩ'['ΆΈΉΊΌΎΏ'.indexOf(c)]; });
    return true;
  }
  return false; // arrows and the rest go to the normal input
};
NameLayer.prototype.finish = function () {
  const trimmed = this.name.trim();
  if (trimmed.length === 0) { Sound.sfx('error'); return; }
  Sound.sfx('confirm');
  closeLayer(this, trimmed);
};
NameLayer.prototype.update = function () {
  this.frame++;
  const pageRows = NAME_PAGES[this.page].length;
  if (Input.repeat.up) { this.row = (this.row + this.rows() - 1) % this.rows(); Sound.sfx('move'); }
  if (Input.repeat.down) { this.row = (this.row + 1) % this.rows(); Sound.sfx('move'); }
  const cols = this.row === pageRows ? 3 : 8;
  if (this.col >= cols) this.col = cols - 1;
  if (Input.repeat.left) { this.col = (this.col + cols - 1) % cols; Sound.sfx('move'); }
  if (Input.repeat.right) { this.col = (this.col + 1) % cols; Sound.sfx('move'); }
  if (Input.pressed.b) { this.name = this.name.slice(0, -1); Sound.sfx('back'); }
  if (!Input.pressed.a) return;
  if (this.row < pageRows) {
    const letter = NAME_PAGES[this.page][this.row][this.col];
    if (letter && this.name.length < NAME_MAX) { this.name += letter; Sound.sfx('confirm'); } else Sound.sfx('error');
  } else if (this.col === 0) { this.page = 1 - this.page; this.row = Math.min(this.row, this.rows() - 1); Sound.sfx('confirm'); }
  else if (this.col === 1) { this.name = this.name.slice(0, -1); Sound.sfx('back'); }
  else this.finish();
};
NameLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(T('name.title'), 120, 8, COLOR.white, 'center');
  drawPanel(60, 22, 120, 20);
  ctx.font = 'bold 12px "Segoe UI", Verdana, sans-serif';
  drawText(this.name + (blinkShows(this.frame, 4, OPT.flashesOff) && this.name.length < NAME_MAX ? '_' : ''), 120, 26, COLOR.ink, 'center');
  ctx.font = FONT;
  const page = NAME_PAGES[this.page];
  for (let r = 0; r < page.length; r++) {
    for (let c = 0; c < 8; c++) {
      const selected = this.row === r && this.col === c;
      ctx.fillStyle = selected ? COLOR.gold : '#34447a';
      ctx.fillRect(24 + c * 24, 50 + r * 15, 22, 13);
      drawText(page[r][c] || '', 35 + c * 24, 52 + r * 15, selected ? COLOR.ink : COLOR.white, 'center');
    }
  }
  const buttons = [T('name.switch'), T('name.del'), T('name.ok')];
  const controlRow = page.length;
  for (let c = 0; c < 3; c++) {
    const selected = this.row === controlRow && this.col === c;
    ctx.fillStyle = selected ? COLOR.gold : '#34447a';
    ctx.fillRect(40 + c * 54, 50 + controlRow * 15 + 4, 50, 13);
    drawText(buttons[c], 65 + c * 54, 50 + controlRow * 15 + 6, selected ? COLOR.ink : COLOR.white, 'center');
  }
  drawText(T('name.hint'), 120, 146, '#b8c4e8', 'center');
};
function BackdropLayer(kind) { this.opaque = true; this.kind = kind; this.frame = 0; }
BackdropLayer.prototype.update = function () { this.frame++; };
BackdropLayer.prototype.draw = function () {
  ctx.fillStyle = '#2a3560'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = '#c99b64'; ctx.fillRect(0, 100, SCREEN_W, 60);
  ctx.fillStyle = '#6b4a2a'; ctx.fillRect(0, 98, SCREEN_W, 3);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#d8452f', '#2f8a5a', '#f4b942', '#3a6ea5'][i % 4]; ctx.fillRect(14 + i * 38, 24, 8, 30); ctx.fillRect(24 + i * 38, 30, 8, 24); }
  ctx.fillStyle = '#6b4a2a'; ctx.fillRect(0, 56, SCREEN_W, 3);
  const bob = OPT.reduceMotion ? 0 : (this.frame >> 4) % 2;
  ctx.drawImage(charSheet('prof'), 0, 0, 16, 16, 72, 36 + bob, 96, 96);
};
function StarterLayer() { this.opaque = true; this.cursor = 0; this.frame = 0; this.refreshInfo(); }
StarterLayer.prototype.refreshInfo = function () {
  const species = SPECIES[STARTERS[this.cursor]];
  this.abilityName = T('ab.' + species.ab);
  this.abilityLines = wrapText(T('abd.' + species.ab), 200);
};
StarterLayer.prototype.update = function () {
  this.frame++;
  if (Input.repeat.left) { this.cursor = (this.cursor + 2) % 3; Sound.sfx('move'); this.refreshInfo(); }
  if (Input.repeat.right) { this.cursor = (this.cursor + 1) % 3; Sound.sfx('move'); this.refreshInfo(); }
  if (Input.pressed.a) { Sound.sfx('confirm'); closeLayer(this, STARTERS[this.cursor]); }
};
StarterLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  drawText(T('starter.title'), 120, 6, COLOR.white, 'center');
  for (let i = 0; i < 3; i++) {
    const x = 10 + i * 76;
    const selected = i === this.cursor;
    ctx.fillStyle = selected ? COLOR.gold : '#34447a'; ctx.fillRect(x, 20, 68, 76);
    ctx.fillStyle = '#10142e'; ctx.fillRect(x + 2, 22, 64, 72);
    const bob = selected && !OPT.reduceMotion ? ((this.frame >> 4) % 2) : 0;
    drawSprite(creatureSprite(STARTERS[i]), x + 2, 26 + bob, 2, false);
    drawText(speciesName(STARTERS[i]), x + 34, 84, selected ? COLOR.gold : COLOR.white, 'center');
  }
  drawPanel(4, 100, 232, 56);
  const species = SPECIES[STARTERS[this.cursor]];
  drawTypeTag(species.t, 10, 106);
  drawText(this.abilityName, 70, 106, COLOR.red);
  let y = 118;
  for (const line of this.abilityLines) { drawText(line, 10, y, COLOR.ink); y += 10; }
};

