// ---- Battle screen ----------------------------------------------------------------------------------------
// The rules (createBattle, playTurn) produce events; this layer plays them back.
// Layout (decision recorded in REFERENCE section 1): a television debate, not a two-panel RPG screen.
//   - the two fighters stand on podiums that face each other at the same height (player left, foe right);
//   - a poll panel (the "δημοσκόπηση" bar, the creature's HP) hangs above each podium;
//   - the four commands are a row of tabs between the podiums and the bottom;
//   - every message runs in a news-ticker strip along the bottom edge.
// textPad = the text margin inside the panel (name left, level right); nameGap = the least free space between the two texts (0 = they may touch, never overlap), which the selfTest checks for every creature.
const POLL_PANEL = { y: 3, w: 112, h: 30, leftX: 4, rightX: 124, textPad: 5, nameGap: 1 }; // 5 px inside the border keeps the longest names (Δημοσιοϋπαλληλάκι, `dimosio`, at level 50) one pixel clear of the level text
const CREATURE_Y = 32;
const PODIUM = { y: 94, w: 88, h: 10, leftX: 14, rightX: 138 };
const COMMAND_ROW = { x: 4, y: 106, w: 232, h: 13, tabW: 58 };
const TICKER = { y: 121, h: 39, tagW: 44, textX: 50, textW: 184, lineHeight: 11 };
const NEWS_NAVY = '#10163a';
const TAB_BLUE = '#26346e';
const AUTO_ADVANCE_FRAMES = [80, 50, 24];
const ROOT_LABELS = ['battle.fight', 'battle.bag', 'battle.mizamon', 'battle.run'];
let envelopeSprite = null;
function getEnvelopeSprite() {
  if (envelopeSprite) return envelopeSprite;
  const p = makePen(16, 12);
  p.rect(0, 0, 16, 12, '#f3ead2'); p.rect(0, 0, 16, 1, '#b8a97c'); p.rect(0, 11, 16, 1, '#b8a97c'); p.rect(0, 0, 1, 12, '#b8a97c'); p.rect(15, 0, 1, 12, '#b8a97c');
  p.line(0, 0, 8, 7, '#b8a97c'); p.line(15, 0, 8, 7, '#b8a97c'); p.ell(8, 7, 2, 2, '#c0392b');
  p.rect(2, 9, 12, 1, '#6fbf73');
  envelopeSprite = p.canvas;
  return envelopeSprite;
}
// The mark of a boosted creature (a boss' creature, or the legend's encounter (11.16), with mon.boost; section 11.12): how far left of the panel's right text edge a small arrow is drawn, 0 = no mark.
// Measured once when the creature is sent out, never per frame.
function boostMarkOffset(mon, lvText) {
  if (!mon.boost) return 0;
  ctx.font = FONT;
  return Math.ceil(ctx.measureText(lvText).width) + BOOST_MARK_W + 3;
}
const BOOST_MARK_W = 5;
function drawBoostMark(x, y) {
  ctx.fillStyle = COLOR.red;
  ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 5, 1);
}
function newBattleView() {
  return { sp: null, visible: false, name: '', lvText: '', boostMark: 0, hpText: '', shown: 0, target: 0, max: 1, lastShown: -1, status: null, dx: 0, dy: 0, alpha: 1, scale: 1, hidden: false };
}
function BattleLayer(battle, trainer, theme) {
  this.opaque = true;
  this.battle = battle;
  this.trainer = trainer;
  this.theme = theme;
  this.views = [newBattleView(), newBattleView()];
  this.mode = 'idle';
  this.box = new TextBox(TICKER.textW, 3);
  this.hold = 0;
  this.textResolve = null;
  this.fx = null;
  this.rootCursor = 0;
  this.moveCursor = 0;
  this.rootPrompt = [];
  this.moveInfo = '';
  this.trainerLook = trainer ? trainer.look : null;
  this.tick = 0;
  this.thrown = null;
}
BattleLayer.prototype.update = function () {
  this.tick++;
  this.box.update();
  for (const view of this.views) {
    if (view.shown < view.target) view.shown = Math.min(view.target, view.shown + Math.max(0.6, view.max / 45));
    else if (view.shown > view.target) view.shown = Math.max(view.target, view.shown - Math.max(0.6, view.max / 45));
    const whole = Math.round(view.shown);
    if (whole !== view.lastShown) { view.lastShown = whole; view.hpText = whole + '/' + view.max; }
  }
  if (this.fx) {
    this.fx.t++;
    this.applyFx();
    if (this.fx.t >= this.fx.dur) { const done = this.fx.resolve; this.finishFx(); if (done) done(); }
  }
  if (this.mode === 'text') this.updateText();
  else if (this.mode === 'root') this.updateRoot();
  else if (this.mode === 'moves') this.updateMoves();
};
BattleLayer.prototype.updateText = function () {
  if (this.box.isTyping()) { if (Input.pressed.a || Input.pressed.b) this.box.advance(); return; }
  this.hold++;
  if (Input.pressed.a || Input.pressed.b || this.hold > AUTO_ADVANCE_FRAMES[OPT.textSpeed]) {
    if (this.box.hasMorePages()) { this.box.advance(); this.hold = 0; return; }
    this.mode = 'idle';
    const resolve = this.textResolve;
    this.textResolve = null;
    if (resolve) resolve();
  }
};
BattleLayer.prototype.showText = function (text) {
  this.mode = 'text';
  this.hold = 0;
  this.box.setText(text);
  const layer = this;
  return new Promise(function (resolve) { layer.textResolve = resolve; });
};
// ---- effects (short animations that finish before the next event is played) ----
BattleLayer.prototype.startFx = function (kind, side, duration) {
  const layer = this;
  if (OPT.reduceMotion && (kind === 'attack' || kind === 'hit')) duration = Math.min(duration, 6);
  if (OPT.reduceMotion && kind === 'faint') duration = 1; // the creature just disappears
  return new Promise(function (resolve) { layer.fx = { kind: kind, side: side, t: 0, dur: Math.max(1, duration), resolve: resolve }; });
};
BattleLayer.prototype.applyFx = function () {
  const fx = this.fx;
  const view = this.views[fx.side];
  const progress = fx.t / fx.dur;
  if (fx.kind === 'attack') view.dx = OPT.reduceMotion ? 0 : Math.sin(progress * Math.PI) * 12 * (fx.side === 0 ? 1 : -1);
  else if (fx.kind === 'hit') {
    const look = hitLook(fx.t, OPT.flashesOff, OPT.reduceMotion);
    view.dx = look.dx;
    view.alpha = look.alpha;
  } else if (fx.kind === 'faint') {
    view.dy = OPT.reduceMotion ? 0 : progress * 36;
    view.alpha = OPT.reduceMotion ? 1 : 1 - progress;
  }
  else if (fx.kind === 'enter') { view.alpha = progress; view.dx = (1 - progress) * (fx.side === 0 ? -30 : 30); }
};
BattleLayer.prototype.finishFx = function () {
  const fx = this.fx;
  const view = this.views[fx.side];
  if (fx.kind === 'faint') { view.visible = false; view.alpha = 1; view.dy = 0; }
  else { view.dx = 0; view.dy = 0; view.alpha = 1; }
  this.fx = null;
};
BattleLayer.prototype.waitUntil = async function (condition, maxFrames) {
  for (let i = 0; i < maxFrames && !condition(); i++) await nextFrame();
};
// ---- menus ----
BattleLayer.prototype.updateRoot = function () {
  // The four tabs sit in one row: left/up goes to the previous tab, right/down to the next (wrapping).
  const step = (Input.repeat.right || Input.repeat.down ? 1 : 0) - (Input.repeat.left || Input.repeat.up ? 1 : 0);
  if (step !== 0) { this.rootCursor = (this.rootCursor + step + ROOT_LABELS.length) % ROOT_LABELS.length; Sound.sfx('move'); }
  if (Input.pressed.a) { Sound.sfx('confirm'); const resolve = this.menuResolve; this.mode = 'idle'; this.menuResolve = null; resolve(this.rootCursor); }
};
BattleLayer.prototype.updateMoves = function () {
  const mon = activeMon(this.battle, 0);
  const count = mon.moves.length;
  let cursor = this.moveCursor; // the moves are a vertical list in the ticker strip
  if (Input.repeat.up && cursor > 0) cursor--;
  if (Input.repeat.down && cursor + 1 < count) cursor++;
  if (cursor !== this.moveCursor) { this.moveCursor = cursor; Sound.sfx('move'); this.refreshMoveInfo(); }
  if (Input.pressed.a || Input.pressed.b) {
    const resolve = this.menuResolve;
    this.mode = 'idle';
    this.menuResolve = null;
    if (Input.pressed.a) { Sound.sfx('confirm'); resolve(mon.moves[this.moveCursor]); } else { Sound.sfx('back'); resolve(null); }
  }
};
BattleLayer.prototype.refreshMoveInfo = function () {
  const moveId = activeMon(this.battle, 0).moves[this.moveCursor];
  this.moveInfo = moveInfoLine(moveId);
  this.moveType = MOVES[moveId].t;
};
BattleLayer.prototype.askRoot = function () {
  const layer = this;
  const mon = activeMon(this.battle, 0);
  this.rootPrompt = wrapText(T('battle.prompt', { name: speciesName(mon.sp) }), TICKER.textW);
  this.mode = 'root';
  return new Promise(function (resolve) { layer.menuResolve = resolve; });
};
BattleLayer.prototype.askMove = function () {
  const layer = this;
  this.moveCursor = 0;
  this.refreshMoveInfo();
  this.mode = 'moves';
  return new Promise(function (resolve) { layer.menuResolve = resolve; });
};
// ---- the main loop ----
BattleLayer.prototype.askAction = async function () {
  const battle = this.battle;
  for (;;) {
    const choice = await this.askRoot();
    const mon = activeMon(battle, 0);
    if (choice === 0) {
      const moveId = await this.askMove();
      if (moveId) return { t: 'move', id: moveId };
    } else if (choice === 1) {
      const itemId = await openLayer(new BagLayer({ battle: true }));
      if (!itemId) continue;
      if (ITEMS[itemId].kind === 'recruit') return { t: 'recruit', id: itemId };
      const target = await openLayer(new PartyLayer({ mode: 'choose', canChoose: function (index) { return canUseItemOn(G.party[index], itemId); } }));
      if (target >= 0) return { t: 'item', id: itemId, target: target };
    } else if (choice === 2) {
      if (mon.bt.trap > 0) { await this.showText(T('b.trapped', { mon: speciesName(mon.sp) })); continue; }
      const index = await openLayer(new PartyLayer({ mode: 'switch', activeIndex: battle.sides[0].active }));
      if (index >= 0) return { t: 'switch', idx: index };
    } else {
      if (battle.kind !== 'wild') { await this.showText(T('b.run.trainer')); continue; }
      return { t: 'run' };
    }
  }
};
BattleLayer.prototype.run = async function () {
  const battle = this.battle;
  await this.playEvents(battle.events);
  while (!battle.over) {
    if (battle.phase === 'forced') {
      const index = await openLayer(new PartyLayer({ mode: 'switch', forced: true, activeIndex: -1 }));
      await this.playEvents(playForcedSwitch(battle, index));
      continue;
    }
    const action = await this.askAction();
    await this.playEvents(playTurn(battle, action));
  }
  return this.finish();
};
BattleLayer.prototype.finish = async function () {
  const battle = this.battle;
  let result = 'win';
  if (battle.ran) result = 'ran';
  else if (battle.winner === 1) result = 'lose';
  if (result === 'win') {
    if (battle.kind === 'trainer') {
      const prize = prizeFor(battle, this.trainer);
      G.money += prize;
      await this.showText(T('b.prize', { n: prize }));
    }
    if (battle.moneyDelta !== 0) {
      G.money = Math.max(0, G.money + battle.moneyDelta);
      await this.showText(T(battle.moneyDelta > 0 ? 'b.moneyGain' : 'b.moneyLoss', { n: Math.abs(battle.moneyDelta) }));
    }
  }
  endBattle(battle);
  return result;
};
BattleLayer.prototype.playEvents = async function (events) {
  const battle = this.battle;
  for (const ev of events) {
    const view = ev.side !== undefined ? this.views[ev.side] : null;
    if (ev.k === 'msg') await this.showText(eventText(ev, OPT.lang, G.player.gender, battle.kind));
    else if (ev.k === 'seen') G.dex.seen[ev.sp] = true;
    else if (ev.k === 'recruited') { G.dex.seen[ev.sp] = true; G.dex.got[ev.sp] = true; }
    else if (ev.k === 'send') {
      view.sp = ev.sp; view.name = speciesName(ev.sp); view.max = ev.max; view.shown = ev.hp; view.target = ev.hp; view.lastShown = -1;
      view.status = ev.status; view.visible = true; view.hidden = false; view.lvText = T('ui.lv') + battle.sides[ev.side].party[battle.sides[ev.side].active].lv;
      view.boostMark = boostMarkOffset(battle.sides[ev.side].party[battle.sides[ev.side].active], view.lvText);
      if (ev.side === 1) this.trainerLook = null;
      await this.startFx('enter', ev.side, OPT.reduceMotion ? 1 : 16);
    } else if (ev.k === 'hp') {
      view.max = ev.max; view.target = ev.hp; view.lastShown = -1;
      await this.waitUntil(function () { return view.shown === view.target; }, 100);
    } else if (ev.k === 'status') view.status = ev.status;
    else if (ev.k === 'anim') {
      if (ev.kind === 'attack') { Sound.sfx('attack'); await this.startFx('attack', ev.side, 14); }
      else {
        Sound.sfx(ev.eff > 1 ? 'super' : (ev.eff < 1 ? 'weak' : 'hit'));
        await this.startFx('hit', ev.side, 16);
      }
    } else if (ev.k === 'faint') { Sound.sfx('faint'); await this.startFx('faint', ev.side, 30); }
    else if (ev.k === 'xp') await this.showText(T('b.xp', { mon: speciesName(G.party[ev.idx].sp), n: ev.amount }));
    else if (ev.k === 'lvl') {
      const mon = G.party[ev.idx];
      Sound.sfx('levelup');
      if (ev.active) { const mine = this.views[0]; mine.lvText = T('ui.lv') + ev.lv; mine.max = ev.max; mine.target = ev.hp; mine.lastShown = -1; }
      await this.showText(T('b.lvl', { mon: speciesName(mon.sp), n: ev.lv }));
    } else if (ev.k === 'learned') await this.showText(T('b.learned', { mon: speciesName(G.party[ev.idx].sp), move: MOVES[ev.move].n }));
    else if (ev.k === 'learnPrompt') {
      const mon = G.party[ev.idx];
      mon.pend = mon.pend.filter(function (id) { return id !== ev.move; });
      await offerLearnMove(mon, ev.move);
    } else if (ev.k === 'recruit') await this.playRecruit(ev);
  }
};
BattleLayer.prototype.playRecruit = async function (ev) {
  const foeView = this.views[1];
  this.thrown = { t: 0, x: 0, y: 0, wobble: 0 };
  Sound.sfx('throw');
  for (let t = 0; t <= 24; t++) { this.thrown.t = t / 24; await nextFrame(); }
  foeView.hidden = true;
  for (let i = 0; i < ev.shakes; i++) {
    Sound.sfx('shake');
    for (let t = 0; t < 22; t++) { this.thrown.wobble = OPT.reduceMotion || OPT.flashesOff ? 0 : Math.sin(t / 22 * Math.PI * 4) * 3; await nextFrame(); }
    this.thrown.wobble = 0;
    await waitFrames(8);
  }
  if (ev.ok) Sound.sfx('recruit');
  else { foeView.hidden = false; Sound.sfx('error'); }
  this.thrown = null;
  if (ev.ok) { foeView.visible = false; await waitFrames(20); }
};
// ---- drawing ----
const battleSkyCache = {}; // one gradient per theme, made on first use (not every frame)
const BATTLE_THEMES = {
  studio: { top: '#3a1a5a', bottom: '#7a3a8a', ground: '#4a2a5a', edge: '#5a3a6a' },
  sea: { top: '#8ac8f0', bottom: '#d8eefc', ground: '#2a78c8', edge: '#8ccaf2' },
  grass: { top: '#8ec8f0', bottom: '#dff3d8', ground: '#6cba58', edge: '#8ad070' },
};
BattleLayer.prototype.drawBackground = function () {
  const colors = BATTLE_THEMES[this.theme] || BATTLE_THEMES.grass;
  if (!battleSkyCache[this.theme]) {
    const sky = ctx.createLinearGradient(0, 0, 0, 112);
    sky.addColorStop(0, colors.top);
    sky.addColorStop(1, colors.bottom);
    battleSkyCache[this.theme] = sky;
  }
  ctx.fillStyle = battleSkyCache[this.theme]; ctx.fillRect(0, 0, SCREEN_W, 112);
  ctx.fillStyle = colors.ground; ctx.fillRect(0, 70, SCREEN_W, 90);
  ctx.fillStyle = colors.edge; ctx.fillRect(0, 70, SCREEN_W, 2);
  if (this.theme === 'studio') { ctx.fillStyle = '#d8452f'; for (let x = 0; x < SCREEN_W; x += 40) ctx.fillRect(x, 0, 6, 70); }
};
// A wooden podium; x is its left edge.
function drawPodium(x) {
  ctx.fillStyle = COLOR.border; ctx.fillRect(x - 1, PODIUM.y - 1, PODIUM.w + 2, PODIUM.h + 2);
  ctx.fillStyle = '#b98a52'; ctx.fillRect(x, PODIUM.y, PODIUM.w, 3);
  ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x + 2, PODIUM.y + 3, PODIUM.w - 4, PODIUM.h - 3);
  ctx.fillStyle = COLOR.gold; ctx.fillRect(x + PODIUM.w / 2 - 8, PODIUM.y + 5, 16, 3);
}
BattleLayer.prototype.drawView = function (view, x, y, flip) {
  if (!view.visible || view.hidden) return;
  ctx.globalAlpha = Math.max(0, Math.min(1, view.alpha));
  drawSprite(creatureSprite(view.sp), x + view.dx, y + view.dy, 2, flip);
  ctx.globalAlpha = 1;
};
// The poll panel above a podium: name, level, the poll bar (HP) and, for the player's side, the numbers.
BattleLayer.prototype.drawPollPanel = function (view, x, showHp) {
  if (!view.visible) return;
  const w = POLL_PANEL.w;
  const y = POLL_PANEL.y;
  drawPanel(x, y, w, POLL_PANEL.h);
  drawText(view.name, x + POLL_PANEL.textPad, y + 4, COLOR.ink);
  drawText(view.lvText, x + w - POLL_PANEL.textPad, y + 4, COLOR.ink, 'right');
  if (view.boostMark > 0) drawBoostMark(x + w - POLL_PANEL.textPad - view.boostMark, y + 5);
  ctx.font = FONT_SMALL;
  drawText(T('battle.poll'), x + POLL_PANEL.textPad, y + 15, COLOR.red);
  ctx.font = FONT;
  drawBar(x + 40, y + 15, w - 50, 5, view.shown / view.max);
  if (showHp) drawText(view.hpText, x + w - POLL_PANEL.textPad, y + 21, COLOR.ink, 'right');
  if (view.status) drawStatusTag(view.status, x + POLL_PANEL.textPad, y + 21);
};
// The four command tabs. They are dimmed while a message plays, bright when the player chooses.
BattleLayer.prototype.drawCommandRow = function () {
  const active = this.mode === 'root';
  ctx.globalAlpha = active ? 1 : 0.45;
  for (let i = 0; i < ROOT_LABELS.length; i++) {
    const x = COMMAND_ROW.x + i * COMMAND_ROW.tabW;
    const selected = active && i === this.rootCursor;
    ctx.fillStyle = COLOR.border; ctx.fillRect(x, COMMAND_ROW.y, COMMAND_ROW.tabW - 2, COMMAND_ROW.h);
    ctx.fillStyle = selected ? COLOR.gold : TAB_BLUE; ctx.fillRect(x + 1, COMMAND_ROW.y + 1, COMMAND_ROW.tabW - 4, COMMAND_ROW.h - 2);
    drawText(T(ROOT_LABELS[i]), x + (COMMAND_ROW.tabW - 2) / 2, COMMAND_ROW.y + 3, selected ? COLOR.ink : COLOR.white, 'center');
  }
  ctx.globalAlpha = 1;
};
// The news-ticker strip along the bottom: a red NEWS tag on the left, the text on a navy band.
BattleLayer.prototype.drawTicker = function () {
  ctx.fillStyle = NEWS_NAVY; ctx.fillRect(0, TICKER.y, SCREEN_W, TICKER.h);
  ctx.fillStyle = COLOR.red; ctx.fillRect(0, TICKER.y, SCREEN_W, 2);
  ctx.fillStyle = COLOR.red; ctx.fillRect(0, TICKER.y + 2, TICKER.tagW, TICKER.h - 2);
  ctx.font = FONT_SMALL;
  drawText(T('battle.news'), TICKER.tagW / 2, TICKER.y + 7, COLOR.white, 'center');
  ctx.fillStyle = COLOR.gold; ctx.fillRect(6, TICKER.y + 17, TICKER.tagW - 12, 2);
  ctx.font = FONT;
  if (this.mode === 'root') {
    for (let i = 0; i < this.rootPrompt.length; i++) drawText(this.rootPrompt[i], TICKER.textX, TICKER.y + 5 + i * TICKER.lineHeight, COLOR.white);
  } else if (this.mode === 'moves') {
    const mon = activeMon(this.battle, 0);
    for (let i = 0; i < mon.moves.length; i++) {
      const rowY = TICKER.y + 3 + i * 9;
      if (i === this.moveCursor) { ctx.fillStyle = COLOR.gold; ctx.fillRect(TICKER.textX, rowY + 1, 3, 6); }
      drawText(MOVES[mon.moves[i]].n, TICKER.textX + 7, rowY, i === this.moveCursor ? COLOR.gold : COLOR.white);
    }
  } else if (this.mode === 'text') {
    this.box.draw(TICKER.textX, TICKER.y + 5, TICKER.lineHeight, COLOR.white);
  }
};
// While the player picks a move, the command row shows that move's type and numbers instead of the tabs.
BattleLayer.prototype.drawMoveInfo = function () {
  ctx.fillStyle = TAB_BLUE; ctx.fillRect(COMMAND_ROW.x, COMMAND_ROW.y, COMMAND_ROW.w, COMMAND_ROW.h);
  const tagWidth = drawTypeTag(this.moveType, COMMAND_ROW.x + 2, COMMAND_ROW.y + 2);
  ctx.font = FONT_SMALL;
  drawText(this.moveInfo, COMMAND_ROW.x + tagWidth + 8, COMMAND_ROW.y + 3, COLOR.white);
  ctx.font = FONT;
};
BattleLayer.prototype.draw = function () {
  ctx.font = FONT;
  this.drawBackground();
  drawPodium(PODIUM.leftX);
  drawPodium(PODIUM.rightX);
  if (this.trainerLook && !this.views[1].visible) ctx.drawImage(charSheet(this.trainerLook), 0, 0, 16, 16, 158, 48, 48, 48);
  this.drawView(this.views[1], 150, CREATURE_Y, false);
  this.drawView(this.views[0], 26, CREATURE_Y, true);
  this.drawPollPanel(this.views[0], POLL_PANEL.leftX, true);
  this.drawPollPanel(this.views[1], POLL_PANEL.rightX, false);
  if (this.thrown) {
    const t = this.thrown.t;
    const x = 70 + (172 - 70) * t + this.thrown.wobble;
    const y = 70 + (52 - 70) * t - Math.sin(t * Math.PI) * 24;
    ctx.drawImage(getEnvelopeSprite(), Math.round(x), Math.round(y));
  }
  if (this.mode === 'moves') this.drawMoveInfo();
  else this.drawCommandRow();
  this.drawTicker();
};

// The real weekday decides Θεία Χάρη's Sunday double heal. selfTest pins it (false) so its fights end the same way on every day of the week.
let sundayPinned = null;
function isSundayToday() { return sundayPinned === null ? new Date().getDay() === 0 : sundayPinned; }

