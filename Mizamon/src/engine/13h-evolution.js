// ---- Evolution and move learning ------------------------------------------------------------------------------------------------------------
function EvolveLayer(mon, targetId) {
  this.opaque = true; this.mon = mon; this.targetId = targetId; this.frame = 0; this.fromId = mon.sp;
}
EvolveLayer.prototype.update = function () {
  this.frame++;
  if (this.frame > 150) closeLayer(this);
};
EvolveLayer.prototype.draw = function () {
  ctx.fillStyle = '#1b2a5a'; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const showNew = this.frame > 80;
  const flash = evolveGlows(this.frame, OPT.flashesOff, OPT.reduceMotion);
  const image = creatureSprite(showNew ? this.targetId : this.fromId);
  if (flash) {
    ctx.save(); ctx.filter = 'brightness(0) invert(1)'; drawSprite(image, 88, 40, 2, false); ctx.restore();
  } else drawSprite(image, 88, 40, 2, false);
  ctx.font = FONT;
  drawText(T(showNew ? 'evolve.done' : 'evolve.start', { from: speciesName(this.fromId), to: speciesName(this.targetId) }), 120, 118, COLOR.white, 'center');
};
async function runEvolutions() {
  for (const mon of G.party) {
    const target = evolutionFor(mon);
    if (!target) continue;
    Sound.play(null);
    await openLayer(new EvolveLayer(mon, target));
    evolveMon(mon);
    G.dex.seen[mon.sp] = true; G.dex.got[mon.sp] = true;
    Sound.sfx(SOUNDS.levelup);
  }
}
async function offerLearnMove(mon, moveId) {
  const name = speciesName(mon.sp);
  const moveName = MOVES[moveId].n;
  if (!(await askYesNo('learn.ask', { mon: name, move: moveName }))) { await say('learn.skip', { mon: name, move: moveName }); return; }
  const labels = mon.moves.map(function (id) { return MOVES[id].n; }).concat([T('ui.cancel')]);
  const choice = await choose(labels, { x: 120, bottom: DIALOG_BOX.y - 2, w: 116, start: 0, title: T('learn.forget') });
  if (choice < 0 || choice >= mon.moves.length) { await say('learn.skip', { mon: name, move: moveName }); return; }
  const forgotten = MOVES[mon.moves[choice]].n;
  mon.moves[choice] = moveId;
  await say('learn.done', { mon: name, move: moveName, old: forgotten });
}

