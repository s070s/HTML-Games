// ---- Drawing helpers ------------------------------------------------------------------------------------
// A line that must stay clear of the picture's edges (TEXT_EDGE_MARGIN each side) is drawn in the normal font, or in the small one when the normal one is too wide
// (the font that the browser really uses decides: a wider fallback font makes the line wider).
const TEXT_EDGE_MARGIN = 8;
function fontForWidth(text, normalFont, smallFont) {
  ctx.font = normalFont;
  return ctx.measureText(text).width <= SCREEN_W - 2 * TEXT_EDGE_MARGIN ? normalFont : smallFont;
}
function drawText(text, x, y, color, align) {
  ctx.fillStyle = color || COLOR.ink;
  ctx.textAlign = align || 'left';
  ctx.fillText(text, x, y);
}
function drawPanel(x, y, w, h) {
  ctx.fillStyle = COLOR.border; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLOR.paperDark; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = COLOR.paper; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = COLOR.border; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + w - 1, y, 1, 1); ctx.fillRect(x, y + h - 1, 1, 1); ctx.fillRect(x + w - 1, y + h - 1, 1, 1);
}
function drawBar(x, y, w, h, fraction) {
  ctx.fillStyle = COLOR.border; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = COLOR.hpBack; ctx.fillRect(x, y, w, h);
  const clamped = Math.max(0, Math.min(1, fraction));
  ctx.fillStyle = clamped > 0.5 ? COLOR.hpGreen : (clamped > 0.2 ? COLOR.hpYellow : COLOR.hpRed);
  ctx.fillRect(x, y, Math.round(w * clamped), h);
}
function drawSprite(image, x, y, scale, flip) {
  const w = image.width * scale;
  const h = image.height * scale;
  if (flip) {
    ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(image, 0, 0, w, h); ctx.restore();
  } else ctx.drawImage(image, x, y, w, h);
}
// The shape of a type (Type marks option), one pixel at a time; left and top are whole pixels.
function drawTypeMark(typeId, left, top, color) {
  const mask = TYPE_MARKS[typeId];
  ctx.fillStyle = color;
  for (let row = 0; row < TYPE_MARK_SIZE; row++) {
    for (let column = 0; column < TYPE_MARK_SIZE; column++) if (mask[row][column] === '#') ctx.fillRect(left + column, top + row, 1, 1);
  }
}
function drawTypeTag(typeId, x, y) {
  ctx.font = FONT_SMALL;
  const label = T('type.' + typeId);
  const markSpace = OPT.typeMarks ? TYPE_MARK_SIZE + 2 : 0;
  const width = Math.ceil(ctx.measureText(label).width) + 6 + markSpace;
  ctx.fillStyle = COLOR.border; ctx.fillRect(x, y, width, 10);
  ctx.fillStyle = TYPE_COLORS[typeId]; ctx.fillRect(x + 1, y + 1, width - 2, 8);
  if (OPT.typeMarks) drawTypeMark(typeId, x + 3, y + 2, '#ffffff');
  drawText(label, x + 3 + markSpace, y + 1, '#ffffff');
  ctx.font = FONT;
  return width;
}
function wrapText(text, maxWidth, font) {
  ctx.font = font || FONT;
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line === '' ? word : line + ' ' + word;
      if (line !== '' && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

