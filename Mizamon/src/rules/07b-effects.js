// ---- Small effects ---------------------------------------------------------------
function loseHp(battle, sideIndex, amount) {
  const mon = activeMon(battle, sideIndex);
  mon.hp = Math.max(0, mon.hp - amount);
  emitHp(battle, sideIndex);
}
function gainHp(battle, sideIndex, amount) {
  const mon = activeMon(battle, sideIndex);
  if (mon.hp <= 0 || amount <= 0) return 0;
  const before = mon.hp;
  mon.hp = Math.min(maxHp(mon), mon.hp + amount);
  emitHp(battle, sideIndex);
  return mon.hp - before;
}
function changeStage(battle, sideIndex, stat, amount) {
  const mon = activeMon(battle, sideIndex);
  const before = mon.bt.stage[stat];
  const after = Math.max(-6, Math.min(6, before + amount));
  mon.bt.stage[stat] = after;
  if (after === before) logMsg(battle, amount > 0 ? 'b.stage.max' : 'b.stage.min', { mon: monRef(battle, sideIndex), stat: stat });
  else logMsg(battle, amount > 0 ? 'b.stage.up' : 'b.stage.down', { mon: monRef(battle, sideIndex), stat: stat, n: Math.abs(amount) });
}
function setStatus(battle, sideIndex, statusId, sourceSide, immediate) {
  const mon = activeMon(battle, sideIndex);
  if (mon.hp <= 0 || mon.status) return false;
  const ability = abilityOf(mon);
  if (ability === 'asy' && (statusId === 'inv' || statusId === 'sca')) { logMsg(battle, 'b.immune', { mon: monRef(battle, sideIndex) }); return false; }
  if (ability === 'syn' && statusId === 'str') { logMsg(battle, 'b.immune', { mon: monRef(battle, sideIndex) }); return false; }
  if (ability === 'bur' && !immediate && sourceSide !== sideIndex && !mon.bt.pending) { // red tape: starts one turn later
    mon.bt.pending = { id: statusId, delay: 1 };
    logMsg(battle, 'b.bureau', { mon: monRef(battle, sideIndex) });
    return true;
  }
  mon.status = { id: statusId, turns: STATUSES[statusId].turns };
  emit(battle, { k: 'status', side: sideIndex, status: statusId });
  logMsg(battle, 'b.st.' + statusId, { mon: monRef(battle, sideIndex) });
  return true;
}
function clearStatus(battle, sideIndex) {
  const mon = activeMon(battle, sideIndex);
  mon.status = null;
  emit(battle, { k: 'status', side: sideIndex, status: null });
}

