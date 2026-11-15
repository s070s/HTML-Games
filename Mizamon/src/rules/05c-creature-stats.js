// ---- Creatures: stats, experience, moves ------------------------------------------
// mon.boost (a boss' creatures, or the legend's encounter (11.16); section 11.12): a multiplier on the species' base stats, so a weak species can still be a boss' wall at a level where levels count for little.
function statOf(mon, key) {
  const base = SPECIES[mon.sp].base[STAT_INDEX[key]] * (mon.boost || 1);
  if (key === 'hp') return Math.floor(base * mon.lv / 20) + mon.lv + 10;
  return Math.floor(base * mon.lv / 25) + 5;
}
function maxHp(mon) { return statOf(mon, 'hp'); }
function xpForLevel(level) { return Math.floor(0.6 * level * level * level); } // total xp needed to reach a level
function levelFromXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}
// The moves a species knows at a level: at most MOVES_MAX. When there are more, the creature keeps
// its basic attack (the first damaging move of its own type) plus the newest moves.
function movesAtLevel(speciesId, level) {
  const known = [];
  for (const entry of SPECIES[speciesId].learn) {
    if (entry[0] <= level && !known.includes(entry[1])) known.push(entry[1]);
  }
  if (known.length <= MOVES_MAX) return known;
  const ownType = SPECIES[speciesId].t;
  const basic = known.find(function (id) { return MOVES[id].p > 0 && MOVES[id].t === ownType; });
  if (!basic) return known.slice(-MOVES_MAX);
  const others = known.filter(function (id) { return id !== basic; });
  return [basic].concat(others.slice(-(MOVES_MAX - 1)));
}
function makeMon(speciesId, level, boost) {
  const mon = { sp: speciesId, lv: level, xp: xpForLevel(level), moves: movesAtLevel(speciesId, level), pend: [], hp: 1, status: null };
  if (boost && boost !== 1) mon.boost = boost;
  mon.hp = maxHp(mon);
  return mon;
}
function cloneMon(mon) {
  const copy = { sp: mon.sp, lv: mon.lv, xp: mon.xp, moves: mon.moves.slice(), pend: mon.pend.slice(), hp: mon.hp, status: null };
  if (mon.boost) copy.boost = mon.boost;
  return copy;
}
function healMon(mon) { mon.hp = maxHp(mon); mon.status = null; }
function monIsAlive(mon) { return mon.hp > 0 && !mon.removed; }
function partyHasAlive(party) { return party.some(monIsAlive); }

