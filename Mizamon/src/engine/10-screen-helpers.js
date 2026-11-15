// ---- Helpers shared by the screens ------------------------------------------------------------------
function speciesName(speciesId) { return SPECIES[speciesId].n; }
function drawCreatureIcon(speciesId, x, y, size) {
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(creatureSprite(speciesId), x, y, size, size);
  ctx.imageSmoothingEnabled = false;
}
function statusLabel(statusId) { return T('st.' + statusId); }
function drawStatusTag(statusId, x, y) {
  ctx.font = FONT_SMALL;
  const label = T('st.' + statusId + '.short');
  const width = Math.ceil(ctx.measureText(label).width) + 4;
  ctx.fillStyle = COLOR.border; ctx.fillRect(x, y, width, 9);
  ctx.fillStyle = statusId === 'sca' ? '#a83a8a' : (statusId === 'str' ? '#c07a1a' : (statusId === 'bri' ? '#2f7a5a' : '#4a6aa8'));
  ctx.fillRect(x + 1, y + 1, width - 2, 7);
  drawText(label, x + 2, y + 1, '#fff');
  ctx.font = FONT;
  return width;
}
function moveInfoLine(moveId) {
  const move = MOVES[moveId];
  const power = move.rand ? '1-150' : (move.p > 0 ? String(move.p) : (move.fracDmg ? '*' : '-'));
  return T('ui.power') + ' ' + power + '  ' + T('ui.acc') + ' ' + (move.sure ? '-' : move.a) + '  ' + T('cat.' + move.c);
}

