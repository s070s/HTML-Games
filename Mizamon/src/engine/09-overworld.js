// ---- Overworld ---------------------------------------------------------------------------------------
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MOVE_FRAMES = 10;
const SHEET_ROW = { down: 0, up: 1, left: 2, right: 2 };

function OverworldLayer() {
  this.opaque = true;
  this.busy = false;
  this.tick = 0;
  this.move = null;
  this.lastDir = 'down';
  this.exclaim = null;
  this.popup = 0;
  this.npcs = [];
  this.tempNpcs = [];
  this.npcList = [];
  this.npcListFlagCount = -1;
  this.npcListFlags = null;
  this.npcListStale = true;
  this.stepAnim = 0;
}
OverworldLayer.prototype.loadMap = function (mapId, x, y, dir) {
  this.mapId = mapId;
  this.map = MAPS[mapId];
  this.px = x;
  this.py = y;
  this.dir = dir || 'down';
  this.move = null;
  this.tempNpcs = [];
  this.npcs = this.map.npcs.map(function (def) { return { def: def, x: def.x, y: def.y, face: def.face, walk: null }; });
  this.npcListStale = true;
  G.player.map = mapId; G.player.x = x; G.player.y = y; G.player.dir = this.dir;
  worldVisit(G.world, mapId, G.flags);
  this.popup = 120;
  Sound.play(this.map.music);
};
OverworldLayer.prototype.onEnter = function () { this.loadMap(G.player.map, G.player.x, G.player.y, G.player.dir); this.popup = 0; };
// The visible NPCs are listed again only when a story flag was added or the NPCs of the map changed
// (flags are only ever added), so the per-frame calls do not allocate.
OverworldLayer.prototype.visibleNpcs = function () {
  let flagCount = 0;
  for (const name in G.flags) if (G.flags[name]) flagCount++;
  if (this.npcListStale || flagCount !== this.npcListFlagCount || G.flags !== this.npcListFlags) {
    this.npcList = [];
    for (const npc of this.npcs) if (npcVisible(npc.def, G.flags)) this.npcList.push(npc);
    for (const npc of this.tempNpcs) this.npcList.push(npc);
    this.npcListFlagCount = flagCount;
    this.npcListFlags = G.flags;
    this.npcListStale = false;
  }
  return this.npcList;
};
OverworldLayer.prototype.npcAt = function (x, y) {
  for (const npc of this.visibleNpcs()) if (npc.x === x && npc.y === y) return npc;
  return null;
};
OverworldLayer.prototype.canWalk = function (x, y) {
  if (tileDef(this.map, x, y).solid) return false;
  if (this.npcAt(x, y)) return false;
  const warp = findWarp(this.map, x, y);
  if (warp && !warpOpen(warp, G.flags)) return false;
  return true;
};
OverworldLayer.prototype.runScript = async function (script) {
  this.busy = true;
  try { await script(); } catch (error) { console.error('Mizamon script error', error); }
  this.busy = false;
};
OverworldLayer.prototype.update = function () {
  this.tick++;
  if (this.popup > 0) this.popup--;
  this.backgroundUpdate();
  if (this.busy) return;
  if (this.move) { this.advanceMove(); return; }
  if (Input.pressed.menu) { this.runScript(openPauseMenu.bind(null, this)); return; }
  if (Input.pressed.map) { this.runScript(openMapScreen); return; }
  if (Input.pressed.a) { this.runScript(this.interact.bind(this)); return; }
  for (const name of ['up', 'down', 'left', 'right']) if (Input.pressed[name]) this.lastDir = name;
  let wanted = Input.down[this.lastDir] ? this.lastDir : null;
  if (!wanted) for (const name of ['up', 'down', 'left', 'right']) if (Input.down[name]) wanted = name;
  if (wanted) this.tryMove(wanted);
};
OverworldLayer.prototype.backgroundUpdate = function () {
  for (const npc of this.visibleNpcs()) {
    if (!npc.walk) continue;
    npc.walk.t += 1 / MOVE_FRAMES;
    if (npc.walk.t >= 1) {
      npc.x += npc.walk.dx; npc.y += npc.walk.dy;
      const done = npc.walk.done;
      npc.walk = null;
      if (done) done();
    }
  }
};
OverworldLayer.prototype.tryMove = function (dir) {
  this.dir = dir;
  G.player.dir = dir;
  const target = DIRS[dir];
  const nx = this.px + target[0];
  const ny = this.py + target[1];
  if (!this.canWalk(nx, ny)) {
    if (Input.pressed[dir]) Sound.sfx('bump');
    return;
  }
  this.move = { dx: target[0], dy: target[1], t: 0 };
};
OverworldLayer.prototype.advanceMove = function () {
  this.move.t += 1 / MOVE_FRAMES;
  if (this.move.t < 1) return;
  this.px += this.move.dx;
  this.py += this.move.dy;
  this.move = null;
  this.stepAnim++;
  G.player.x = this.px; G.player.y = this.py;
  G.steps++;
  this.runScript(this.onArrive.bind(this));
};
OverworldLayer.prototype.onArrive = async function () {
  const warp = findWarp(this.map, this.px, this.py);
  if (warp && warpOpen(warp, G.flags)) { await this.useWarp(warp); return; }
  if (await this.checkTriggers()) return;
  const encounter = rollEncounter(G.rng, this.map, this.px, this.py);
  if (encounter) { await this.wildEncounter(encounter); return; }
  await this.checkTrainerSight();
};
OverworldLayer.prototype.checkTriggers = async function () {
  for (const trigger of this.map.triggers || []) {
    if (trigger.x === this.px && trigger.y === this.py && !G.flags[trigger.flag]) { await this.runEvent(trigger.event); return true; }
  }
  return false;
};
OverworldLayer.prototype.useWarp = async function (warp) {
  Sound.sfx('door');
  await Fade.start(1, 10);
  this.loadMap(warp.to, warp.tx, warp.ty, this.dir);
  await waitFrames(2);
  await Fade.start(0, 10);
  if (await this.checkTriggers()) return;
  await this.checkTrainerSight();
};
OverworldLayer.prototype.teleport = async function (spot) {
  await Fade.start(1, 12);
  this.loadMap(spot.map, spot.x, spot.y, spot.dir || 'up');
  await waitFrames(2);
  await Fade.start(0, 12);
};
// Walks a non-player character one tile; resolves when the step is finished.
OverworldLayer.prototype.walkNpc = function (npc, dir) {
  npc.face = dir;
  return new Promise(function (resolve) { npc.walk = { dx: DIRS[dir][0], dy: DIRS[dir][1], t: 0, done: resolve }; });
};
OverworldLayer.prototype.showExclaim = async function (npc) {
  this.exclaim = npc;
  Sound.sfx('alert');
  await waitFrames(36);
  this.exclaim = null;
};
OverworldLayer.prototype.checkTrainerSight = async function () {
  for (const npc of this.visibleNpcs()) {
    const def = npc.def;
    if (def.kind !== 'trainer' || !def.sight || G.flags['t_' + def.trainer]) continue;
    if (!this.seesPlayer(npc)) continue;
    await this.challenge(npc, true);
    return;
  }
};
OverworldLayer.prototype.seesPlayer = function (npc) {
  const direction = DIRS[npc.face];
  for (let distance = 1; distance <= npc.def.sight; distance++) {
    const x = npc.x + direction[0] * distance;
    const y = npc.y + direction[1] * distance;
    if (x === this.px && y === this.py) return true;
    if (tileDef(this.map, x, y).solid || this.npcAt(x, y)) return false;
  }
  return false;
};
OverworldLayer.prototype.interact = async function () {
  const facing = DIRS[this.dir];
  const fx = this.px + facing[0];
  const fy = this.py + facing[1];
  let npc = this.npcAt(fx, fy);
  if (!npc && tileDef(this.map, fx, fy).counter) npc = this.npcAt(fx + facing[0], fy + facing[1]);
  if (npc) { npc.face = OPPOSITE[this.dir]; await this.talkTo(npc); return; }
  const action = this.map.actions ? this.map.actions[fx + ',' + fy] : null;
  if (action === 'archive') { await this.useArchive(); return; }
  const signKey = this.map.signs[fx + ',' + fy];
  if (signKey) { await say(signKey); return; }
  const warp = findWarp(this.map, fx, fy);
  if (warp && !warpOpen(warp, G.flags)) await say(warp.lockedText);
};
OverworldLayer.prototype.talkTo = async function (npc) {
  const def = npc.def;
  if (def.kind === 'talk') await say(def.text);
  else if (def.kind === 'prof') await this.talkProfessor();
  else if (def.kind === 'heal') await this.healAtHospital(npc);
  else if (def.kind === 'kep') await this.talkKep();
  else if (def.kind === 'shop') await this.shopTalk();
  else if (def.kind === 'save') await this.cafeTalk();
  else if (def.kind === 'legend') await this.legendEncounter(npc);
  else if (def.kind === 'trainer' || def.kind === 'boss') {
    if (G.flags['t_' + def.trainer]) {
      await say('tr.' + def.trainer + '.after');
      const victory = TRAINERS[def.trainer].victory;
      if (victory && victory.credits && !G.flags.ending) await this.finale(); // the last fight was won but the credits never finished: they roll now
    } else await this.challenge(npc, false);
  }
};
OverworldLayer.prototype.talkProfessor = async function () {
  if (G.flags.credits) await say('npc.prof.3');
  else if (G.flags.badge) await say('npc.prof.2');
  else if (G.flags.rival1) await say('npc.prof.1b');
  else await say('npc.prof.1');
};
// The ΚΕΠ keeps its queue joke but heals nothing any more: the hospital does.
OverworldLayer.prototype.talkKep = async function () {
  await say('kep.hello');
  await say('kep.ticket', { n: '9.999' });
  await openLayer(new TicketLayer());
  await say('kep.comeBack');
};
// The receptionist: "free, in 3 to 5 years" ... and then it happens at once. With a Φακελάκι in the bag she also offers the VIP service.
// The doctor of the Βουλή lobby (MZ-WORLD-02g) is the same desk with texts of its own (healKeys) and no VIP service: a state doctor takes no envelope.
OverworldLayer.prototype.healAtHospital = async function (npc) {
  const own = npc && npc.def.healKeys ? npc.def.healKeys : null;
  await say(own ? own.hello : 'hosp.hello');
  await say(own ? own.free : 'hosp.free');
  const wantsVip = !own && (G.bag.fakelaki || 0) > 0 && await askYesNo('hosp.vipAsk');
  await say(own ? own.atOnce : (wantsVip ? 'hosp.vipTaken' : 'hosp.atOnce'));
  await openLayer(new MonitorLayer());
  const vip = hospitalHeal(G.party, G.bag, wantsVip);
  G.lastHeal = Object.assign({}, HOSPITAL_SPOT, { map: this.mapId }); // the hospital of this town (or the lobby of the Βουλή) becomes the return point
  await say(own ? own.done : (vip ? 'hosp.doneVip' : 'hosp.done'));
};
// The Αρχείο Ασθενών terminal: deposit, withdraw, list.
OverworldLayer.prototype.useArchive = async function () {
  await say('arch.hello');
  let start = 0;
  for (;;) {
    const choice = await choose([T('arch.deposit'), T('arch.withdraw'), T('arch.list'), T('menu.close')],
      { x: 120, y: 40, w: 112, start: start, title: T('arch.count', { n: G.archive.length, max: ARCHIVE_MAX }) });
    if (choice === -1 || choice === 3) return;
    start = choice;
    if (choice === 0) await this.archiveDeposit();
    else if (choice === 1) await this.archiveWithdraw();
    else if (G.archive.length === 0) await say('arch.empty');
    else await openLayer(new ArchiveLayer({ mode: 'view' }));
  }
};
OverworldLayer.prototype.archiveDeposit = async function () {
  if (G.archive.length >= ARCHIVE_MAX) { await say('arch.full'); return; }
  const candidates = G.party.filter(function (mon, index) { return canDeposit(G.party, G.archive, index); });
  if (candidates.length === 0) { await say('arch.lastOne'); return; }
  const index = await openLayer(new PartyLayer({ mode: 'choose', titleKey: 'arch.pickDeposit', canChoose: function (i) { return canDeposit(G.party, G.archive, i); } }));
  if (index < 0) return;
  const name = speciesName(G.party[index].sp);
  depositMon(G.party, G.archive, index);
  Sound.sfx('confirm');
  await say('arch.deposited', { mon: name, n: G.archive.length });
};
OverworldLayer.prototype.archiveWithdraw = async function () {
  if (G.archive.length === 0) { await say('arch.empty'); return; }
  if (G.party.length >= PARTY_MAX) { await say('arch.teamFull'); return; }
  const index = await openLayer(new ArchiveLayer({ mode: 'withdraw' }));
  if (index < 0) return;
  const name = speciesName(G.archive[index].sp);
  withdrawMon(G.party, G.archive, index);
  Sound.sfx('confirm');
  await say('arch.withdrawn', { mon: name });
};
OverworldLayer.prototype.shopTalk = async function () {
  await say('shop.hello');
  await openLayer(new ShopLayer(shopStockOf(this.map)));
  await say('shop.bye');
};
OverworldLayer.prototype.cafeTalk = async function () {
  await say(this.map.cafeHello || 'cafe.hello'); // the café of Παλαιό Φάληρο has its own greeting
  if (await askYesNo('cafe.ask')) {
    const stored = writeSave();
    Sound.sfx('heal');
    await say(stored ? 'cafe.saved' : 'cafe.savedMemory');
  } else await say('cafe.bye');
};
OverworldLayer.prototype.wildEncounter = async function (encounter) {
  const foe = makeMon(encounter.sp, encounter.lv);
  const result = await runBattle({ kind: 'wild', foeParty: [foe] });
  await this.afterBattle(result, null);
};
// A fixed encounter (MZ-WORLD-02f): one creature that stands on a map and is met by talking to it. Beating or recruiting it sets the flag that hides it (the battle
// result is 'win' in both cases); running away or losing leaves it standing, so it can be met again. No random roll, no per-frame work.
OverworldLayer.prototype.legendEncounter = async function (npc) {
  const def = npc.def;
  await say('legend.' + def.species + '.intro');
  const result = await runBattle({ kind: 'wild', foeParty: [makeMon(def.species, def.level, def.boost)] });
  await this.afterBattle(result, null);
  if (result !== 'win') return;
  G.flags[def.hideFlag] = true;
  await say('legend.' + def.species + '.gone');
};
OverworldLayer.prototype.challenge = async function (npc, fromSight) {
  const trainerId = npc.def.trainer;
  const trainer = TRAINERS[trainerId];
  const walked = []; // the steps the trainer took toward the player, so they can walk back afterwards
  if (fromSight) {
    await this.showExclaim(npc);
    let guard = 0;
    while (guard++ < 8 && Math.abs(npc.x - this.px) + Math.abs(npc.y - this.py) > 1) { walked.push(npc.face); await this.walkNpc(npc, npc.face); }
  }
  await say('tr.' + trainerId + '.intro');
  const result = await runBattle({ kind: 'trainer', trainerId: trainerId, foeParty: buildTrainerTeam(trainerId, G.starter) });
  await this.afterBattle(result, trainerId);
  if (result === 'win') {
    G.flags['t_' + trainerId] = true;
    await say('tr.' + trainerId + '.win');
    if (trainer.boss) await this.bossVictory(trainerId);
  }
  if (result !== 'lose' && npcVisible(npc.def, G.flags)) {
    for (let i = walked.length - 1; i >= 0; i--) await this.walkNpc(npc, OPPOSITE[walked[i]]);
    npc.face = npc.def.face;
  }
};
OverworldLayer.prototype.afterBattle = async function (result, trainerId) {
  if (result === 'lose') { await this.blackout(); return; }
  await runEvolutions();
};
OverworldLayer.prototype.blackout = async function () {
  await say('blackout.text');
  G.money = Math.floor(G.money * BLACKOUT_MONEY_KEEP);
  hospitalHeal(G.party, G.bag, false);
  await this.teleport(G.lastHeal);
  await say('blackout.hospital');
};
// What follows a won boss fight: the line, the badge flag, the badge card, the line after it. Only the first boss also shows the chapter card
// and sets the flag credits (the studio opens on it); only the last one (the Βουλή) rolls the credits and sets the flag ending.
OverworldLayer.prototype.bossVictory = async function (trainerId) {
  const victory = TRAINERS[trainerId].victory;
  await say(victory.win2);
  G.flags[victory.flag] = true;
  Sound.sfx('levelup');
  await openLayer(new BadgeLayer(victory.title, victory.sub, victory.ribbon));
  await say(victory.win3);
  Sound.play(this.map.music);
  if (victory.credits) { await this.finale(); return; }
  if (!victory.chapterCard) return;
  await openLayer(new ChapterLayer()); // the full credits roll plays after the Βουλή (MZ-WORLD-02g)
  G.flags.credits = true; // the flag keeps its name: the studio opens on it, as in the old saves
  Sound.play(this.map.music);
  await say('credits.after');
};
// The end of the game (MZ-WORLD-02g, section 11.5): the full credits roll, then the flag ending is set, the plenary hall empties (its people carry hideFlag ending, the legend showFlag ending)
// and the player stands on the roof, where the café counter can save the game with its ending.
OverworldLayer.prototype.finale = async function () {
  await openLayer(new CreditsLayer());
  G.flags.ending = true;
  await this.teleport({ map: 'parliament_roof', x: 4, y: 6, dir: 'up' });
  await say('ending.roof');
};
OverworldLayer.prototype.runEvent = async function (eventId) {
  if (eventId === 'rival1') {
    G.flags.rival1 = true;
    const rival = { def: { look: 'rival', kind: 'tmp' }, x: 3, y: 9, face: 'up', walk: null };
    this.tempNpcs.push(rival);
    this.npcListStale = true;
    Sound.sfx('alert');
    await this.walkNpc(rival, 'up');
    await sayAll(['rival1.intro1', 'rival1.intro2']);
    const result = await runBattle({ kind: 'trainer', trainerId: 'rival1', foeParty: buildTrainerTeam('rival1', G.starter) });
    if (result === 'ran') { this.tempNpcs = []; this.npcListStale = true; return; } // the battle broke: the fight does not count
    G.flags.t_rival1 = true;
    if (result === 'lose') { await say('rival1.win'); await this.afterBattle('lose', 'rival1'); }
    else { await say('rival1.lose'); await runEvolutions(); }
    if (result !== 'lose') {
      await this.walkNpc(rival, 'right');
      for (let i = 0; i < 6; i++) await this.walkNpc(rival, 'right');
    }
    this.tempNpcs = [];
    this.npcListStale = true;
  }
};
OverworldLayer.prototype.draw = function () {
  ctx.font = FONT;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const map = this.map;
  let offsetX = this.move ? this.move.dx * this.move.t * TILE : 0;
  let offsetY = this.move ? this.move.dy * this.move.t * TILE : 0;
  const playerX = this.px * TILE + offsetX;
  const playerY = this.py * TILE + offsetY;
  let camX = Math.round(playerX + TILE / 2 - SCREEN_W / 2);
  let camY = Math.round(playerY + TILE / 2 - SCREEN_H / 2);
  if (map.w * TILE <= SCREEN_W) camX = -Math.floor((SCREEN_W - map.w * TILE) / 2);
  else camX = Math.max(0, Math.min(map.w * TILE - SCREEN_W, camX));
  if (map.h * TILE <= SCREEN_H) camY = -Math.floor((SCREEN_H - map.h * TILE) / 2);
  else camY = Math.max(0, Math.min(map.h * TILE - SCREEN_H, camY));
  const firstX = Math.max(0, Math.floor(camX / TILE));
  const lastX = Math.min(map.w - 1, Math.floor((camX + SCREEN_W) / TILE));
  const firstY = Math.max(0, Math.floor(camY / TILE));
  const lastY = Math.min(map.h - 1, Math.floor((camY + SCREEN_H) / TILE));
  const waterFrame = waterFrames[(this.tick >> 5) & 1];
  for (let y = firstY; y <= lastY; y++) {
    const row = map.rows[y];
    for (let x = firstX; x <= lastX; x++) {
      const char = row[x];
      ctx.drawImage(char === '~' ? waterFrame : tileSprites[char], x * TILE - camX, y * TILE - camY);
    }
  }
  const npcs = this.visibleNpcs();
  for (const npc of npcs) if (npc.y <= this.py) this.drawNpc(npc, camX, camY);
  this.drawPlayer(playerX - camX, playerY - camY);
  for (const npc of npcs) if (npc.y > this.py) this.drawNpc(npc, camX, camY);
  if (this.exclaim) {
    const npc = this.exclaim;
    const ex = npc.x * TILE - camX + 5;
    const ey = npc.y * TILE - camY - 11;
    ctx.fillStyle = COLOR.border; ctx.fillRect(ex - 1, ey - 1, 8, 12);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ex, ey, 6, 10);
    ctx.fillStyle = COLOR.red; ctx.fillRect(ex + 2, ey + 1, 2, 5); ctx.fillRect(ex + 2, ey + 7, 2, 2);
  }
  if (this.popup > 0) {
    const label = T(map.name);
    const width = Math.ceil(ctx.measureText(label).width) + 14;
    drawPanel(Math.floor((SCREEN_W - width) / 2), 4, width, 16);
    drawText(label, SCREEN_W / 2, 8, COLOR.ink, 'center');
  }
};
OverworldLayer.prototype.drawNpc = function (npc, camX, camY) {
  let x = npc.x * TILE;
  let y = npc.y * TILE;
  let frame = 0;
  if (npc.walk) { x += npc.walk.dx * npc.walk.t * TILE; y += npc.walk.dy * npc.walk.t * TILE; frame = npc.walk.t < 0.5 ? 1 : 2; }
  this.blit(charSheet(npc.def.look), npc.face, frame, x - camX, y - camY);
};
OverworldLayer.prototype.drawPlayer = function (x, y) {
  const sheet = charSheet(G.player.gender === 'f' ? 'playerF' : 'playerM');
  const frame = this.move ? (this.move.t < 0.5 ? 1 : 2) : 0;
  this.blit(sheet, this.dir, frame, x, y);
};
OverworldLayer.prototype.blit = function (sheet, dir, frame, x, y) {
  const row = SHEET_ROW[dir];
  const drawX = Math.round(x);
  const drawY = Math.round(y);
  if (dir === 'right') {
    ctx.save(); ctx.translate(drawX + TILE, drawY); ctx.scale(-1, 1);
    ctx.drawImage(sheet, frame * TILE, row * TILE, TILE, TILE, 0, 0, TILE, TILE);
    ctx.restore();
  } else ctx.drawImage(sheet, frame * TILE, row * TILE, TILE, TILE, drawX, drawY, TILE, TILE);
};

