// ---- Actions -----------------------------------------------------------------------
function moveSpeed(battle, sideIndex) { return effectiveStat(activeMon(battle, sideIndex), 'spe'); }
function movePriority(battle, sideIndex, moveId) {
  const mon = activeMon(battle, sideIndex);
  let priority = MOVES[moveId].prio || 0;
  const firstMove = abilityParams(mon, 'firstMovePriority'); // Επιτελικό Κράτος: the first move goes first
  if (firstMove && !mon.bt.moved) priority += firstMove.priority;
  return priority;
}
function moveHitsFoe(move) {
  return move.p > 0 || !!move.rand || !!move.fracDmg || !!move.foeSt || !!move.bothSt || !!move.foeSkip || !!move.trap ||
    !!move.noAbility || !!move.gag || !!move.blockStatus || (move.stg || []).some(function (s) { return s[0] === 'foe'; });
}
function canAct(battle, sideIndex) {
  const mon = activeMon(battle, sideIndex);
  const volatile = mon.bt;
  if (volatile.recharge > 0) { volatile.recharge--; logMsg(battle, 'b.recharge', { mon: monRef(battle, sideIndex) }); return false; }
  if (volatile.skip > 0) { volatile.skip--; logMsg(battle, 'b.skip', { mon: monRef(battle, sideIndex) }); return false; }
  const idle = statusParams(mon, 'idle');
  if (idle && battle.rng() < idle.chance) { logMsg(battle, 'b.str.idle', { mon: monRef(battle, sideIndex) }); return false; }
  const pocket = statusParams(mon, 'pocket');
  if (pocket && battle.rng() < pocket.chance) {
    logMsg(battle, 'b.bri.pocket', { mon: monRef(battle, sideIndex) });
    gainHp(battle, 1 - sideIndex, Math.max(1, Math.floor(maxHp(activeMon(battle, 1 - sideIndex)) / pocket.divisor)));
    return false;
  }
  return true;
}
function applyDamage(battle, attackerSide, defenderSide, move, rawPower) {
  const attacker = activeMon(battle, attackerSide);
  const defender = activeMon(battle, defenderSide);
  const rng = battle.rng;
  const dodge = abilityParams(defender, 'ignoreHigherLevel');
  if (dodge && attacker.lv > defender.lv && rng() < dodge.chance) {
    logMsg(battle, 'b.vys', { mon: monRef(battle, defenderSide) });
    return 0;
  }
  if (defender.bt.decoy) {
    defender.bt.decoy = false;
    logMsg(battle, 'b.decoy', { mon: monRef(battle, defenderSide) });
    return 0;
  }
  const crit = rng() < CRIT_CHANCE;
  const roll = (85 + Math.floor(rng() * 16)) / 100;
  const allyFallen = (battle.sides[attackerSide].fallen[SPECIES[attacker.sp].t] || 0) > 0;
  const result = computeDamage(attacker, defender, move, { power: rawPower, crit: crit, roll: roll, allyFallen: allyFallen });
  let damage = result.damage;
  const survive = abilityParams(defender, 'surviveKo');
  if (survive && damage >= defender.hp && !defender.once.survived) {
    defender.once.survived = true;
    damage = Math.max(0, defender.hp - survive.leaveHp);
    logMsg(battle, 'b.survive', { mon: monRef(battle, defenderSide) });
  }
  loseHp(battle, defenderSide, damage);
  emit(battle, { k: 'anim', kind: 'hit', side: defenderSide, eff: result.effectiveness });
  if (crit) logMsg(battle, 'b.crit', {});
  if (result.effectiveness > 1) logMsg(battle, 'b.super', {});
  else if (result.effectiveness < 1) logMsg(battle, 'b.resist', {});
  const unionRep = abilityParams(defender, 'critStrike');
  if (crit && unionRep && !attacker.status && !abilityParams(attacker, 'critStrike')) {
    setStatus(battle, attackerSide, unionRep.status, defenderSide); // union rep: a critical hit starts a strike
  }
  return damage;
}
function useMove(battle, sideIndex, moveId) {
  const foeSide = 1 - sideIndex;
  const user = activeMon(battle, sideIndex);
  const foe = activeMon(battle, foeSide);
  const move = MOVES[moveId];
  const rng = battle.rng;
  if (!canAct(battle, sideIndex)) return;
  user.bt.moved = true;
  user.bt.lastMove = moveId;
  logMsg(battle, 'b.used', { mon: monRef(battle, sideIndex), move: moveId });
  emit(battle, { k: 'anim', kind: 'attack', side: sideIndex });
  if (move.c === 'r' && user.bt.gag > 0) { logMsg(battle, 'b.gagged', {}); return; }
  if (move.c === 's' && user.bt.blockStatus > 0) { user.bt.blockStatus = 0; logMsg(battle, 'b.blocked', {}); return; }
  if (foe.bt.lobby && move.t === 'pol' && moveHitsFoe(move)) { foe.bt.lobby = false; logMsg(battle, 'b.lobby', { mon: monRef(battle, foeSide) }); return; }
  if (moveHitsFoe(move) && !move.sure) {
    const chance = move.a / 100 * accuracyMultiplier(user.bt.stage.acc);
    if (rng() >= chance) { logMsg(battle, 'b.miss', { mon: monRef(battle, sideIndex) }); return; }
  }
  // Self effects that do not need a target
  if (move.cureSelf && user.status) clearStatus(battle, sideIndex);
  if (move.decoy) { user.bt.decoy = true; logMsg(battle, 'b.decoyset', { mon: monRef(battle, sideIndex) }); }
  if (move.lobby) { user.bt.lobby = true; logMsg(battle, 'b.lobbyset', { mon: monRef(battle, sideIndex) }); }
  if (move.heal) {
    const healed = gainHp(battle, sideIndex, Math.floor(maxHp(user) * move.heal));
    if (healed > 0) logMsg(battle, 'b.heal', { mon: monRef(battle, sideIndex) });
    user.bt.lastHeal = 2;
    if (move.promise) user.bt.broken = 2; // the campaign promise is broken a turn later
    if (move.team) healBench(battle, sideIndex, move.heal);
  }
  if (move.healBoth) {
    gainHp(battle, sideIndex, Math.floor(maxHp(user) * move.healBoth));
    gainHp(battle, foeSide, Math.floor(maxHp(foe) * move.healBoth));
    logMsg(battle, 'b.winefree', {});
  }
  if (move.money) battle.moneyDelta += (sideIndex === 0 ? 1 : -1) * (move.fracDmg ? Math.max(1, Math.floor(maxHp(foe) * move.fracDmg)) : 60);
  // Damage
  let damageDealt = 0;
  if (move.fracDmg) {
    damageDealt = Math.max(1, Math.floor(maxHp(foe) * move.fracDmg));
    loseHp(battle, foeSide, damageDealt);
    emit(battle, { k: 'anim', kind: 'hit', side: foeSide, eff: 1 });
  } else if (move.p > 0 || move.rand) {
    let hits = move.hits || 1;
    if (user.bt.viral) { hits *= user.bt.viral; user.bt.viral = false; logMsg(battle, 'b.viral', { mon: monRef(battle, sideIndex) }); }
    const power = move.rand ? randInt(rng, move.rand[0], move.rand[1]) : move.p;
    for (let hit = 0; hit < hits && foe.hp > 0; hit++) damageDealt += applyDamage(battle, sideIndex, foeSide, move, power);
    if (hits > 1) logMsg(battle, 'b.hits', { n: hits });
  }
  if (damageDealt > 0) {
    if (move.drain) { gainHp(battle, sideIndex, Math.max(1, Math.floor(damageDealt * move.drain))); logMsg(battle, 'b.drain', { mon: monRef(battle, sideIndex) }); }
    if (move.recoil) { loseHp(battle, sideIndex, Math.max(1, Math.floor(damageDealt * move.recoil))); logMsg(battle, 'b.recoil', { mon: monRef(battle, sideIndex) }); }
  }
  if (move.selfHurt) { loseHp(battle, sideIndex, Math.floor(maxHp(user) * move.selfHurt)); logMsg(battle, 'b.recoil', { mon: monRef(battle, sideIndex) }); }
  if (foe.hp > 0) {
    if (move.foeSt && rng() * 100 < move.foeSt[1]) setStatus(battle, foeSide, move.foeSt[0], sideIndex);
    if (move.bothSt) { setStatus(battle, foeSide, move.bothSt, sideIndex); setStatus(battle, sideIndex, move.bothSt, foeSide); }
    if (move.foeSkip) foe.bt.skip = move.foeSkip;
    if (move.trap) { foe.bt.trap = move.trap; logMsg(battle, 'b.trap', { mon: monRef(battle, foeSide) }); }
    if (move.noAbility) { foe.bt.noAbility = move.noAbility; logMsg(battle, 'b.noability', { mon: monRef(battle, foeSide) }); }
    if (move.gag) { foe.bt.gag = move.gag; logMsg(battle, 'b.gag', { mon: monRef(battle, foeSide) }); }
    if (move.blockStatus) foe.bt.blockStatus = 1;
  }
  for (const change of move.stg || []) {
    const targetSide = change[0] === 'self' ? sideIndex : foeSide;
    if (activeMon(battle, targetSide).hp <= 0) continue;
    if (change[3] >= 100 || rng() * 100 < change[3]) changeStage(battle, targetSide, change[1], change[2]);
  }
  if (move.recharge) user.bt.recharge = 1;
  const viral = abilityParams(user, 'multiHitAfterKo');
  if (foe.hp <= 0 && viral) user.bt.viral = viral.hitsMult; // the next damaging move hits this many times as often
}
function healBench(battle, sideIndex, fraction) {
  const side = battle.sides[sideIndex];
  side.party.forEach(function (mon, index) {
    if (index === side.active || !monIsAlive(mon)) return;
    mon.hp = Math.min(maxHp(mon), mon.hp + Math.floor(maxHp(mon) * fraction));
  });
}
function switchTo(battle, sideIndex, index, forced) {
  const side = battle.sides[sideIndex];
  const old = side.party[side.active];
  if (old.hp > 0) {
    if (statusParams(old, 'hurt')) old.status = null; // the news cycle moves on
    logMsg(battle, 'b.back', { mon: monRef(battle, sideIndex) });
  }
  const favour = old.hp > 0 ? abilityParams(old, 'favourOnSwitch') : null;
  enterMon(battle, sideIndex, index, true);
  if (favour) { // Ρουσφέτι: the next ally gets a favour
    const healed = gainHp(battle, sideIndex, Math.floor(maxHp(activeMon(battle, sideIndex)) / favour.divisor));
    if (healed > 0) logMsg(battle, 'b.rousfeti', { mon: monRef(battle, sideIndex) });
  }
  return forced;
}
function useItemAction(battle, sideIndex, itemId, targetIndex) {
  const side = battle.sides[sideIndex];
  const item = ITEMS[itemId];
  if (sideIndex === 0) {
    if (!battle.bag[itemId] || battle.bag[itemId] < 1) return;
  }
  const target = side.party[targetIndex === undefined ? side.active : targetIndex];
  if (item.kind === 'recruit') { doRecruit(battle, itemId); return; }
  if (!canUseItemOn(target, itemId)) { logMsg(battle, 'b.noeffect', {}); return; }
  if (sideIndex === 0) battle.bag[itemId] -= 1;
  const isActive = target === activeMon(battle, sideIndex);
  const healed = applyItemToMon(target, itemId);
  logMsg(battle, 'b.item', { item: itemId, mon: { sp: target.sp, side: sideIndex }, n: healed });
  if (isActive) { emitHp(battle, sideIndex); emit(battle, { k: 'status', side: sideIndex, status: target.status ? target.status.id : null }); }
}
function doRecruit(battle, itemId) {
  const foe = activeMon(battle, 1);
  if (battle.kind !== 'wild' && !battle.opts.recruitable) { logMsg(battle, 'b.rec.trainer', {}); return; }
  if (battle.opts.recruitOnly && battle.opts.recruitOnly !== itemId) { logMsg(battle, 'b.rec.small', { mon: monRef(battle, 1) }); return; }
  // A full team sends the recruit to the hospital archive (battle.opts.archive); only a full archive refuses.
  const teamFull = battle.sides[0].party.length >= PARTY_MAX;
  const archive = battle.opts.archive;
  if (teamFull && !(archive && archive.length < ARCHIVE_MAX)) { logMsg(battle, 'b.rec.full', {}); return; }
  if (!SPECIES[foe.sp].rec) { logMsg(battle, 'b.rec.never', { mon: monRef(battle, 1) }); return; }
  battle.bag[itemId] -= 1;
  const chance = recruitChance(foe, itemId);
  const success = battle.rng() < chance;
  const shakes = success ? 3 : randInt(battle.rng, 0, 2);
  logMsg(battle, 'b.rec.throw', { item: itemId, mon: monRef(battle, 1) });
  emit(battle, { k: 'recruit', shakes: shakes, ok: success });
  if (success) {
    const recruit = cloneMon(foe);
    recruit.status = null;
    delete recruit.boost; // a boost belongs to the fight (a boss' creature or the legend), a recruited creature has plain stats
    recruit.hp = Math.min(recruit.hp, maxHp(recruit));
    if (teamFull) archive.push(recruit); else battle.sides[0].party.push(recruit);
    battle.recruited.push(recruit);
    emit(battle, { k: 'recruited', sp: foe.sp });
    logMsg(battle, 'b.rec.ok', { mon: monRef(battle, 1) });
    if (teamFull) logMsg(battle, 'b.rec.archived', { mon: monRef(battle, 1) });
    foe.removed = true;
    foe.hp = 0;
  } else {
    logMsg(battle, 'b.rec.out' + shakes, { mon: monRef(battle, 1) });
  }
}
function doRun(battle) {
  if (battle.kind !== 'wild') { logMsg(battle, 'b.run.trainer', {}); return; }
  if (activeMon(battle, 0).bt.trap > 0) { logMsg(battle, 'b.run.trapped', {}); return; }
  battle.runAttempts++;
  const mine = effectiveStat(activeMon(battle, 0), 'spe');
  const theirs = effectiveStat(activeMon(battle, 1), 'spe');
  const chance = Math.min(1, Math.max(0.3, 0.4 + 0.5 * mine / (mine + theirs) + 0.15 * battle.runAttempts));
  if (battle.rng() < chance) { battle.over = true; battle.ran = true; battle.winner = null; logMsg(battle, 'b.run.ok', {}); }
  else logMsg(battle, 'b.run.fail', {});
}

