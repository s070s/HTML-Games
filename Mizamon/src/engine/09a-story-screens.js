// ---- Small story screens: ticket, badge, credits -------------------------------------------------------------------
function TicketLayer() { this.opaque = false; this.frame = 0; }
TicketLayer.prototype.update = function () {
  this.frame++;
  if (this.frame > 150 || (this.frame > 20 && Input.pressed.a)) closeLayer(this);
};
TicketLayer.prototype.draw = function () {
  ctx.fillStyle = 'rgba(10,10,30,0.7)'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawPanel(60, 30, 120, 70);
  ctx.font = FONT;
  drawText(T('kep.sign'), 120, 38, COLOR.red, 'center');
  drawText(T('kep.yourNumber'), 120, 52, COLOR.ink, 'center');
  ctx.font = 'bold 20px "Courier New", monospace';
  drawText('9.999', 120, 62, COLOR.ink, 'center');
  ctx.font = FONT;
  const serving = 3 + Math.floor(this.frame / 60);
  drawText(T('kep.serving', { n: serving }), 120, 86, COLOR.gray, 'center');
};
// The hospital "examination": a heart-monitor line sweeps across a dark screen while three beeps play.
// With Reduced motion the line is drawn whole and does not scroll or flash.
const MONITOR_FRAMES = 72;
const MONITOR_PULSE = [0, 0, 0, 0, -1, -2, -1, 0, 0, 0, 3, -14, 9, 0, 0, 0, -1, -3, -4, -3, -1, 0, 0, 0, 0, 0, 0, 0]; // one heartbeat: pixel offsets from the middle
const MONITOR_BOX = { x: 38, y: 52, w: 164, h: 48 };
function MonitorLayer() { this.opaque = false; this.frame = 0; }
MonitorLayer.prototype.onEnter = function () { Sound.sfx(SOUNDS.hospital); };
MonitorLayer.prototype.update = function () {
  this.frame++;
  if (this.frame >= MONITOR_FRAMES) closeLayer(this);
};
MonitorLayer.prototype.draw = function () {
  ctx.fillStyle = 'rgba(10,10,30,0.7)'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawPanel(30, 30, 180, 80);
  ctx.font = FONT;
  drawText(T('hosp.monitor'), 120, 38, COLOR.ink, 'center');
  ctx.fillStyle = '#0e2a1c'; ctx.fillRect(MONITOR_BOX.x, MONITOR_BOX.y, MONITOR_BOX.w, MONITOR_BOX.h);
  const still = OPT.reduceMotion;
  const scroll = still ? 0 : this.frame * 2;
  const reach = still ? MONITOR_BOX.w : Math.min(MONITOR_BOX.w, Math.round(this.frame / MONITOR_FRAMES * MONITOR_BOX.w * 1.2));
  ctx.fillStyle = blinkShows(this.frame, 3, still || OPT.flashesOff) ? '#4fe08a' : '#b8ffd0'; // the line changes colour four times a second, unless Flashes off
  const middle = MONITOR_BOX.y + MONITOR_BOX.h / 2;
  let previousY = middle;
  for (let x = 0; x < reach; x++) {
    const y = middle + MONITOR_PULSE[(x + scroll) % MONITOR_PULSE.length];
    ctx.fillRect(MONITOR_BOX.x + x, Math.min(y, previousY), 1, Math.abs(y - previousY) + 1);
    previousY = y;
  }
  ctx.font = FONT_SMALL;
  drawText(T('hosp.monitorNote'), 120, 102, COLOR.gray, 'center');
  ctx.font = FONT;
};
// The badge card; the texts and the ribbon colour come from the boss' victory data (the first badge keeps the red ribbon).
function BadgeLayer(titleKey, subKey, ribbon) { this.opaque = false; this.frame = 0; this.titleKey = titleKey || 'badge.title'; this.subKey = subKey || 'badge.sub'; this.ribbon = ribbon || '#c0392b'; this.ribbonDark = shadeColor(this.ribbon, 0.6); }
BadgeLayer.prototype.update = function () {
  this.frame++;
  if (this.frame > 60 && Input.pressed.a) closeLayer(this);
};
BadgeLayer.prototype.draw = function () {
  ctx.fillStyle = 'rgba(10,10,30,0.8)'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const bob = OPT.reduceMotion ? 0 : Math.sin(this.frame / 12) * 2;
  const cx = 120;
  const cy = 62 + bob;
  ctx.fillStyle = this.ribbon; ctx.fillRect(cx - 14, cy + 6, 8, 22); ctx.fillRect(cx + 6, cy + 6, 8, 22); // ribbon
  ctx.fillStyle = this.ribbonDark; ctx.fillRect(cx - 14, cy + 22, 8, 2); ctx.fillRect(cx + 6, cy + 22, 8, 2);
  ctx.fillStyle = '#8a6a10'; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4c430'; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a5fc4'; ctx.fillRect(cx - 8, cy - 3, 16, 11); // envelope
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 3); ctx.lineTo(cx, cy + 4); ctx.lineTo(cx + 8, cy - 3); ctx.lineTo(cx + 8, cy - 2); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 8, cy - 2); ctx.fill();
  ctx.fillStyle = '#f4c430'; ctx.fillRect(cx - 5, cy - 8, 10, 4); ctx.fillRect(cx - 5, cy - 11, 2, 3); ctx.fillRect(cx - 1, cy - 11, 2, 3); ctx.fillRect(cx + 3, cy - 11, 2, 3); // crown
  ctx.font = FONT;
  drawText(T(this.titleKey), 120, 100, COLOR.gold, 'center');
  drawText(T(this.subKey), 120, 112, COLOR.white, 'center');
};
// The short card after the first boss: "Chapter 1 complete".
function ChapterLayer() { this.opaque = true; this.frame = 0; }
ChapterLayer.prototype.onEnter = function () { Sound.play(MUSIC.title); };
ChapterLayer.prototype.update = function () {
  this.frame++;
  if (this.frame > 240 || (this.frame > 60 && (Input.pressed.a || Input.pressed.b))) closeLayer(this);
};
ChapterLayer.prototype.draw = function () {
  ctx.fillStyle = '#0c1030'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = COLOR.gold; ctx.fillRect(60, 66, 120, 1); ctx.fillRect(60, 92, 120, 1);
  ctx.font = FONT;
  drawText(T('chapter.title'), 120, 72, COLOR.gold, 'center');
  drawText(T('chapter.sub'), 120, 82, COLOR.white, 'center');
};
// The roll moves half a pixel a frame, a line is 14 px apart. The screen closes when the last line is 20 px from the top (SCREEN_H / 2 - CREDITS_HOLD_FRAMES / 2,
// whatever the line count), so it is fully on screen for about 250 frames before the roll ends (MZ-WORLD-02g fix round).
const CREDITS_LINE_FRAMES = 28;
const CREDITS_HOLD_FRAMES = 120;
function creditsLineY(frame, lineIndex) { return SCREEN_H - frame * 0.5 + lineIndex * 14; }
function creditsEndFrame(lineCount) { return (lineCount - 1) * CREDITS_LINE_FRAMES + SCREEN_H + CREDITS_HOLD_FRAMES; }
function CreditsLayer() { this.opaque = true; this.frame = 0; this.lines = null; }
CreditsLayer.prototype.onEnter = function () {
  Sound.play(MUSIC.title);
  this.lines = T('credits.text').split('\n');
};
CreditsLayer.prototype.update = function () {
  this.frame += Input.down.a ? 3 : 1;
  if (this.frame > creditsEndFrame(this.lines.length) || (this.frame > 90 && Input.pressed.menu)) closeLayer(this);
};
CreditsLayer.prototype.draw = function () {
  ctx.fillStyle = '#0c1030'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.font = FONT;
  for (let i = 0; i < this.lines.length; i++) {
    const y = creditsLineY(this.frame, i);
    if (y < -12 || y > SCREEN_H) continue;
    const line = this.lines[i];
    drawText(line, 120, y, i === 0 ? COLOR.gold : COLOR.white, 'center');
  }
};

