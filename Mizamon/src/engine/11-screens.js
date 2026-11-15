// ---- Notice, title ---------------------------------------------------------------------------------------
function NoticeLayer() { this.opaque = true; this.frame = 0; this.lines = null; }
NoticeLayer.prototype.onEnter = function () {
  Sound.play(MUSIC.title);
  this.greek = wrapText(lookupString('notice.line1', 'el'), 200);
  this.english = wrapText(lookupString('notice.line2', 'en'), 200);
};
NoticeLayer.prototype.update = function () {
  this.frame++;
  if (this.frame > 20 && (Input.pressed.a || Input.pressed.b)) { Sound.sfx(SOUNDS.confirm); closeLayer(this); }
};
NoticeLayer.prototype.draw = function () {
  ctx.fillStyle = '#10142e'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = 'bold 14px "Segoe UI", Verdana, sans-serif';
  drawText(T('title.satire'), 120, 12, COLOR.gold, 'center');
  ctx.font = FONT;
  let y = 40;
  for (const line of this.greek) { drawText(line, 120, y, COLOR.white, 'center'); y += 12; }
  y += 10;
  for (const line of this.english) { drawText(line, 120, y, '#b8c4e8', 'center'); y += 12; }
  if (blinkShows(this.frame, 5, OPT.flashesOff) && this.frame > 20) drawText(T('ui.pressA'), 120, 142, COLOR.gold, 'center');
};
function TitleLayer() { this.opaque = true; this.frame = 0; }
TitleLayer.prototype.update = function () { this.frame++; };
const TITLE_CREATURE_IDS = DATA.game.titleCreatures; // the creatures of the title screen (data/game.json)
let titleSky = null; // made once, on the first frame
TitleLayer.prototype.draw = function () {
  if (!titleSky) {
    titleSky = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    titleSky.addColorStop(0, '#1b3a7a'); titleSky.addColorStop(0.6, '#4a8ad0'); titleSky.addColorStop(1, '#f0d8a0');
  }
  ctx.fillStyle = titleSky; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = '#2a78c8'; ctx.fillRect(0, 98, SCREEN_W, 62);
  ctx.fillStyle = '#8ccaf2'; for (let x = 0; x < SCREEN_W; x += 24) ctx.fillRect((x + (this.frame >> 3)) % SCREEN_W, 150 + (x % 3) * 3, 10, 1);
  ctx.fillStyle = '#e8e0cc'; ctx.fillRect(0, 94, SCREEN_W, 4);
  const ids = TITLE_CREATURE_IDS;
  for (let i = 0; i < ids.length; i++) {
    const bob = OPT.reduceMotion ? 0 : Math.round(Math.sin((this.frame + i * 17) / 10) * 2);
    drawSprite(creatureSprite(ids[i]), 6 + i * 38, 60 + bob, 1.2, i % 2 === 1);
  }
  ctx.font = 'bold 30px "Segoe UI", Verdana, sans-serif';
  drawText('MIZAMON', 121, 13, '#14142a', 'center');
  drawText('MIZAMON', 120, 11, COLOR.gold, 'center');
  ctx.font = fontForWidth(T('title.sub'), FONT, FONT_SMALL);
  drawText(T('title.sub'), 120, 46, COLOR.white, 'center');
  ctx.font = FONT;
};

