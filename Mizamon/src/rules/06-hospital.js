// ---- Hospital: heal visit and the Αρχείο Ασθενών (creature archive) ---------------------------------
// The whole team is healed (HP and status). A VIP visit also spends one Φακελάκι, but only when the bag has one:
// the envelope is never required. Returns true when the VIP service was used.
function hospitalHeal(party, bag, wantsVip) {
  const vip = !!wantsVip && (bag.fakelaki || 0) > 0;
  if (vip) bag.fakelaki -= 1;
  for (const mon of party) healMon(mon);
  return vip;
}
// A team member can go to the archive only when the archive has room and another team member is still able to fight.
function canDeposit(party, archive, index) {
  if (!party[index] || archive.length >= ARCHIVE_MAX) return false;
  return party.some(function (mon, other) { return other !== index && monIsAlive(mon); });
}
function depositMon(party, archive, index) {
  if (!canDeposit(party, archive, index)) return false;
  archive.push(party.splice(index, 1)[0]);
  return true;
}
function canWithdraw(party, archive, index) { return !!archive[index] && party.length < PARTY_MAX; }
function withdrawMon(party, archive, index) {
  if (!canWithdraw(party, archive, index)) return false;
  party.push(archive.splice(index, 1)[0]);
  return true;
}
// Adds experience. Returns the list of level-ups; each says which moves were learned
// at once and which wait for a replace prompt (mon.pend).
function gainXp(mon, amount) {
  const result = [];
  mon.xp += amount;
  while (mon.lv < MAX_LEVEL && mon.xp >= xpForLevel(mon.lv + 1)) {
    const hpBefore = maxHp(mon);
    mon.lv += 1;
    if (mon.hp > 0) mon.hp += maxHp(mon) - hpBefore;
    const entry = { lv: mon.lv, learned: [], pending: [] };
    for (const learnEntry of SPECIES[mon.sp].learn) {
      if (learnEntry[0] !== mon.lv || mon.moves.includes(learnEntry[1])) continue;
      if (mon.moves.length < MOVES_MAX) { mon.moves.push(learnEntry[1]); entry.learned.push(learnEntry[1]); }
      else { mon.pend.push(learnEntry[1]); entry.pending.push(learnEntry[1]); }
    }
    result.push(entry);
  }
  return result;
}
function evolutionFor(mon) {
  const evo = SPECIES[mon.sp].evo;
  return evo && mon.lv >= evo.lv ? evo.to : null;
}
function evolveMon(mon) {
  const target = evolutionFor(mon);
  if (!target) return false;
  const hpBefore = maxHp(mon);
  mon.sp = target;
  if (mon.hp > 0) mon.hp += maxHp(mon) - hpBefore;
  return true;
}

