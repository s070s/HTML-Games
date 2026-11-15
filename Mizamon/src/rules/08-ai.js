// ---- Opponent AI ---------------------------------------------------------------------
// Scores each move (expected damage as a share of the foe's HP, plus small values for
// status moves), adds seeded noise, and sometimes picks at random.
const USELESS_MOVE_SCORE = 0; // below even a 1-damage hit, so a pointless move is only picked when nothing else is left
function scoreMove(battle, sideIndex, moveId) {
  const user = activeMon(battle, sideIndex);
  const foe = activeMon(battle, 1 - sideIndex);
  const move = MOVES[moveId];
  const accuracy = move.sure ? 1 : Math.min(1, move.a / 100 * accuracyMultiplier(user.bt.stage.acc));
  const userFraction = user.hp / maxHp(user);
  let score = 0;
  if (move.p > 0 || move.rand || move.fracDmg) {
    const power = move.rand ? 75 : move.p;
    const damage = move.fracDmg ? Math.floor(maxHp(foe) * move.fracDmg) : computeDamage(user, foe, move, { power: power, roll: 0.925 }).damage * (move.hits || 1);
    score = Math.min(1, damage / Math.max(1, foe.hp)) * 100 * accuracy;
    if (damage >= foe.hp) score += 30 + (move.prio || 0) * 10;
    if (move.recharge) score -= 15;
    if (move.selfHurt) score -= 10;
    if (move.foeSt && !foe.status) score += 6;
  } else {
    score = 8;
    if (move.heal) score = userFraction < 0.35 && !user.bt.lastHeal ? 45 : (userFraction >= 1 ? USELESS_MOVE_SCORE : 2);
    if (move.healBoth) score = userFraction < 0.3 ? 25 : 2;
    if (move.foeSt) score = foe.status ? 2 : (foe.hp / maxHp(foe) > 0.5 ? 26 : 10);
    if (move.foeSt && abilityOf(foe) === 'asy' && move.foeSt[0] !== 'str') score = 1;
    for (const change of move.stg || []) {
      const stageNow = (change[0] === 'self' ? user : foe).bt.stage[change[1]];
      if (change[0] === 'self' && change[2] > 0) {
        // Setup that is already at +2 or more is not worth a turn (it kept two status-only fighters stalling).
        score = stageNow >= 2 ? USELESS_MOVE_SCORE : Math.max(score, stageNow >= 1 ? 3 : 24 - 8 * stageNow);
      }
      if (change[0] === 'foe' && change[2] < 0) score = Math.max(score, stageNow > -1 ? 18 : 3);
    }
    if (move.foeSkip && user.bt.lastMove === moveId) score = USELESS_MOVE_SCORE; // skipping the foe turn after turn is a stalemate
    if (move.decoy && !user.bt.decoy) score = 7;
    if (move.lobby && !user.bt.lobby) score = 6;
    if (move.cureSelf && user.status) score = 30;
  }
  return score;
}
function chooseAction(battle, sideIndex) {
  const side = battle.sides[sideIndex];
  const user = activeMon(battle, sideIndex);
  const rng = battle.rng;
  if (side.items.length > 0 && user.hp / maxHp(user) < 0.35 && rng() < 0.7) {
    const itemId = side.items.shift();
    return { t: 'item', id: itemId, target: side.active };
  }
  let best = null;
  let bestScore = -1e9;
  const worthPlaying = []; // the random pick below never takes a pointless move (it could lock a battle forever)
  for (const moveId of user.moves) {
    const score = scoreMove(battle, sideIndex, moveId);
    const noisy = score * (0.85 + 0.3 * rng());
    if (score > USELESS_MOVE_SCORE) worthPlaying.push(moveId);
    if (noisy > bestScore) { bestScore = noisy; best = moveId; }
  }
  if (rng() < 0.12 && worthPlaying.length > 0) best = pickOne(rng, worthPlaying); // sometimes the opponent just does something
  return { t: 'move', id: best };
}
// Best creature to send in against the current opponent (type matchup score).
function chooseReplacement(battle, sideIndex) {
  const side = battle.sides[sideIndex];
  const foe = activeMon(battle, 1 - sideIndex);
  let bestIndex = -1;
  let bestScore = -1e9;
  side.party.forEach(function (mon, index) {
    if (!monIsAlive(mon)) return;
    let score = 0;
    for (const moveId of mon.moves) {
      const move = MOVES[moveId];
      if (move.p > 0) score = Math.max(score, move.p * typeMultiplier(move.t, SPECIES[foe.sp].t) * (SPECIES[mon.sp].t === move.t ? 1.5 : 1));
    }
    score += mon.lv + mon.hp / maxHp(mon) * 10 - typeMultiplier(SPECIES[foe.sp].t, SPECIES[mon.sp].t) * 8;
    if (score > bestScore) { bestScore = score; bestIndex = index; }
  });
  return bestIndex;
}

