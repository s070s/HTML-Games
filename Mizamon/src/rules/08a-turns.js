// ---- Turn resolution -------------------------------------------------------------------
function checkFaints(battle) {
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = battle.sides[sideIndex];
    const mon = side.party[side.active];
    if (mon.hp > 0 || mon.bt.fainted) continue;
    mon.bt.fainted = true;
    if (mon.removed) continue; // recruited: no faint, no experience
    emit(battle, { k: 'faint', side: sideIndex });
    logMsg(battle, 'b.fainted', { mon: { sp: mon.sp, side: sideIndex } });
    const type = SPECIES[mon.sp].t;
    side.fallen[type] = (side.fallen[type] || 0) + 1;
    if (sideIndex === 1) awardXp(battle, mon);
  }
  const playerAlive = partyHasAlive(battle.sides[0].party);
  const foeAlive = partyHasAlive(battle.sides[1].party);
  if (!playerAlive || !foeAlive) {
    battle.over = true;
    battle.winner = playerAlive ? 0 : 1;
  }
}
function awardXp(battle, foeMon) {
  const total = xpReward(foeMon, battle.kind === 'trainer');
  const party = battle.sides[0].party;
  const participants = battle.sides[0].part.filter(function (index) { return monIsAlive(party[index]); });
  if (participants.length === 0) return;
  const share = Math.max(1, Math.floor(total / participants.length));
  for (const index of participants) {
    const mon = party[index];
    emit(battle, { k: 'xp', idx: index, amount: share });
    const levelUps = gainXp(mon, share);
    for (const levelUp of levelUps) {
      emit(battle, { k: 'lvl', idx: index, lv: levelUp.lv, hp: mon.hp, max: maxHp(mon), active: index === battle.sides[0].active });
      for (const moveId of levelUp.learned) emit(battle, { k: 'learned', idx: index, move: moveId });
      for (const moveId of levelUp.pending) emit(battle, { k: 'learnPrompt', idx: index, move: moveId });
    }
  }
}
function endOfTurn(battle) {
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const mon = activeMon(battle, sideIndex);
    if (mon.hp <= 0) continue;
    const ref = monRef(battle, sideIndex);
    if (mon.status && mon.status.id === 'sca') {
      loseHp(battle, sideIndex, Math.max(1, Math.floor(maxHp(mon) / 8)));
      logMsg(battle, 'b.sca.hurt', { mon: ref });
    }
    if (mon.hp > 0 && abilityOf(mon) === 'gra' && mon.hp < maxHp(mon)) {
      gainHp(battle, sideIndex, Math.max(1, Math.floor(maxHp(mon) / 16) * (battle.sunday ? 2 : 1)));
      logMsg(battle, 'b.grace', { mon: ref });
    }
    if (mon.hp > 0 && mon.bt.broken > 0) {
      mon.bt.broken--;
      if (mon.bt.broken === 0) { loseHp(battle, sideIndex, Math.max(1, Math.floor(maxHp(mon) / 8))); logMsg(battle, 'b.promise', { mon: ref }); }
    }
    if (mon.hp > 0 && abilityOf(mon) === 'bah') {
      const stat = pickOne(battle.rng, STAGE_KEYS.slice(0, 5));
      if (mon.bt.stage[stat] < 6) changeStage(battle, sideIndex, stat, 1);
    }
    if (mon.hp > 0 && mon.status && STATUSES[mon.status.id].turns > 0) {
      mon.status.turns--;
      if (mon.status.turns <= 0) {
        const endedId = mon.status.id;
        clearStatus(battle, sideIndex);
        logMsg(battle, 'b.stend.' + endedId, { mon: ref });
      }
    }
    if (mon.hp > 0 && mon.bt.pending) {
      if (mon.bt.pending.delay > 0) mon.bt.pending.delay--;
      else { const pendingId = mon.bt.pending.id; mon.bt.pending = null; setStatus(battle, sideIndex, pendingId, 1 - sideIndex, true); }
    }
    for (const key of ['gag', 'trap', 'noAbility', 'lastHeal']) if (mon.bt[key] > 0) mon.bt[key]--;
  }
  if (battle.turn >= OVERTIME_TURN) {
    logMsg(battle, 'b.overtime', {});
    const turnsOver = battle.turn - OVERTIME_TURN + 1;
    for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
      const mon = activeMon(battle, sideIndex);
      if (mon.hp > 0) loseHp(battle, sideIndex, Math.max(1, Math.floor(maxHp(mon) * OVERTIME_STEP * turnsOver)));
    }
  }
  checkFaints(battle);
}
// Moves the next opponent creature in, or asks the player to pick one.
function afterTurn(battle) {
  if (battle.over) { battle.phase = 'over'; emit(battle, { k: 'over', winner: battle.winner, ran: battle.ran }); return; }
  const foeSide = battle.sides[1];
  if (activeMon(battle, 1).hp <= 0) {
    const next = foeSide.party.findIndex(monIsAlive);
    enterMon(battle, 1, next, true);
  }
  battle.phase = activeMon(battle, 0).hp <= 0 ? 'forced' : 'choose';
}
// action: { t: 'move', id } | { t: 'switch', idx } | { t: 'item', id, target } | { t: 'recruit', id } | { t: 'run' }
function playTurn(battle, playerAction) {
  battle.events = [];
  battle.turn++;
  const picks = [{ side: 0, action: playerAction }, { side: 1, action: chooseAction(battle, 1) }];
  const free = picks.filter(function (p) { return p.action.t !== 'move'; });
  const moves = picks.filter(function (p) { return p.action.t === 'move'; });
  for (const p of moves) { p.prio = movePriority(battle, p.side, p.action.id); p.spe = moveSpeed(battle, p.side); p.tie = battle.rng(); }
  moves.sort(function (a, b) { return (b.prio - a.prio) || (b.spe - a.spe) || (b.tie - a.tie); });
  for (const p of free.concat(moves)) {
    if (battle.over) break;
    const mon = activeMon(battle, p.side);
    if (mon.hp <= 0) continue;
    const action = p.action;
    if (action.t === 'move') useMove(battle, p.side, action.id);
    else if (action.t === 'switch') switchTo(battle, p.side, action.idx, false);
    else if (action.t === 'item') useItemAction(battle, p.side, action.id, action.target);
    else if (action.t === 'recruit') useItemAction(battle, p.side, action.id);
    else if (action.t === 'run') doRun(battle);
    checkFaints(battle);
  }
  if (!battle.over) endOfTurn(battle);
  afterTurn(battle);
  return battle.events;
}
// After the player's creature fainted: send the chosen one in (no opponent action).
function playForcedSwitch(battle, index) {
  battle.events = [];
  switchTo(battle, 0, index, true);
  battle.phase = 'choose';
  return battle.events;
}
function legalSwitchIndexes(battle, sideIndex) {
  const side = battle.sides[sideIndex];
  return side.party.map(function (mon, index) { return index; }).filter(function (index) { return index !== side.active && monIsAlive(side.party[index]); });
}
function endBattle(battle) {
  for (const side of battle.sides) {
    for (const mon of side.party) { mon.bt = undefined; mon.once = undefined; mon.status = null; delete mon.removed; }
  }
}
function prizeFor(battle, trainerDef) {
  const team = battle.sides[1].party;
  let prize = team[team.length - 1].lv * PRIZE_PER_LEVEL + (trainerDef && trainerDef.bonus ? trainerDef.bonus : 0);
  const lead = battle.sides[0].party[battle.sides[0].active];
  if (lead && abilityOf(lead) === 'afo') prize = Math.floor(prize * 1.5); // Αφορολόγητο: earns +50 % money
  return prize;
}
// Plays a whole battle with the AI on both sides (balance script and tests).
// Returns { winner, turns, checksum }.
function simulateBattle(partyA, partyB, rng, options) {
  const o = options || {};
  const battle = createBattle(partyA.map(cloneMon), partyB.map(cloneMon), rng, {
    kind: o.kind || 'trainer', foeItems: o.foeItems, foeName: 'sim', bag: {}, trainerId: 'sim',
  });
  battle.sides[0].items = o.playerItems ? o.playerItems.slice() : [];
  let checksum = 0;
  let guard = 0;
  while (!battle.over && guard++ < 400) {
    let action;
    if (battle.phase === 'forced') {
      const events = playForcedSwitch(battle, chooseReplacement(battle, 0));
      checksum = (checksum + hashString(JSON.stringify(events))) >>> 0;
      continue;
    }
    action = chooseAction(battle, 0);
    if (action.t === 'item') { battle.bag[action.id] = 1; }
    const events = playTurn(battle, action);
    checksum = (checksum + hashString(JSON.stringify(events))) >>> 0;
  }
  return { winner: battle.over ? battle.winner : 1, turns: battle.turn, checksum: checksum, battle: battle };
}

