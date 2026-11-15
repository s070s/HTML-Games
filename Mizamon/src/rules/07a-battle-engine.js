// ---- Battle engine -------------------------------------------------------------
// The engine changes the battle state and returns a list of events. The screen plays the
// events back (text, HP bars, animations); the tests and the balance script just read them.
// Side 0 is the player, side 1 the opponent.

function freshVolatile() {
  return {
    stage: { atk: 0, def: 0, rat: 0, rde: 0, spe: 0, acc: 0 },
    decoy: false, gag: 0, trap: 0, skip: 0, recharge: 0, lobby: false, blockStatus: 0,
    noAbility: 0, lastHeal: 0, viral: false, moved: false, broken: 0, pending: null, lastMove: null,
  };
}
function newSide(party, isPlayer, trainerId, items) {
  return { party: party, active: 0, isPlayer: isPlayer, trainer: trainerId || null, items: items ? items.slice() : [], fallen: {}, part: [] };
}
function activeMon(battle, sideIndex) { return battle.sides[sideIndex].party[battle.sides[sideIndex].active]; }
function logMsg(battle, key, vars) { battle.events.push({ k: 'msg', key: key, v: vars || {} }); }
function emit(battle, event) { battle.events.push(event); }
function monRef(battle, sideIndex) { return { sp: activeMon(battle, sideIndex).sp, side: sideIndex }; }
function emitHp(battle, sideIndex) {
  const mon = activeMon(battle, sideIndex);
  emit(battle, { k: 'hp', side: sideIndex, hp: mon.hp, max: maxHp(mon) });
}

// options: kind 'wild' | 'trainer'; trainerId; foeItems; bag (the player's item counts);
// sunday (Θεία Χάρη doubles); recruitable (trainer creature may be recruited, TV battle);
// recruitOnly (the one item that works); foeName; archive (the player's hospital archive: a recruit with a full team goes there).
function createBattle(playerParty, foeParty, rng, options) {
  const o = options || {};
  const battle = {
    rng: rng, kind: o.kind || 'wild', opts: o, events: [], over: false, winner: null, ran: false, recruited: [],
    phase: 'choose', turn: 0, runAttempts: 0, moneyDelta: 0, bag: o.bag || {}, sunday: !!o.sunday,
    sides: [newSide(playerParty, true, null, null), newSide(foeParty, false, o.trainerId, o.foeItems)],
  };
  for (const side of battle.sides) for (const mon of side.party) { mon.once = {}; mon.bt = undefined; }
  battle.sides[0].active = Math.max(0, playerParty.findIndex(monIsAlive));
  battle.sides[1].active = 0;
  if (battle.kind === 'trainer') logMsg(battle, 'b.trainer', { trainer: o.foeName || '?' });
  enterMon(battle, 1, 0, true);
  enterMon(battle, 0, battle.sides[0].active, true);
  return battle;
}
function enterMon(battle, sideIndex, index, announce) {
  const side = battle.sides[sideIndex];
  side.active = index;
  const mon = side.party[index];
  mon.bt = freshVolatile();
  if (sideIndex === 0) {
    if (!side.part.includes(index)) side.part.push(index);
  } else {
    battle.sides[0].part = [battle.sides[0].active];
    emit(battle, { k: 'seen', sp: mon.sp });
  }
  emit(battle, { k: 'send', side: sideIndex, sp: mon.sp, hp: mon.hp, max: maxHp(mon), status: mon.status ? mon.status.id : null });
  if (announce) {
    if (sideIndex === 1) {
      if (battle.kind === 'wild') logMsg(battle, 'b.wild', { mon: monRef(battle, 1) });
      else logMsg(battle, 'b.foesend', { trainer: battle.opts.foeName || '?', mon: monRef(battle, 1) });
    } else logMsg(battle, 'b.go', { mon: monRef(battle, 0) });
  }
}

