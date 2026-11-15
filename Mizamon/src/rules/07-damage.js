// ---- Damage, recruit odds, rewards (formulas documented in REFERENCE-mizamon.md) ----------
function abilityOf(mon) {
  if (!mon || (mon.bt && mon.bt.noAbility > 0)) return null;
  return SPECIES[mon.sp].ab;
}
// What an ability or a status does is a kind (data/abilities/, data/statuses/): the rules ask for the numbers of a kind, never for an id.
// abilityParams: the numbers of the creature's ability when it is of that kind (null otherwise, and while the ability is ignored).
function abilityParams(mon, kind) {
  const id = abilityOf(mon);
  return id !== null && ABILITIES[id].kind === kind ? ABILITIES[id].params : null;
}
// statusParams: the same for the status a creature has.
function statusParams(mon, kind) {
  return mon.status && STATUSES[mon.status.id].kind === kind ? STATUSES[mon.status.id].params : null;
}
// Whether the creature's ability keeps the status off it (the same answer for the rules and for the AI).
function abilityBlocksStatus(mon, statusId) {
  const shield = abilityParams(mon, 'statusShield');
  if (shield && shield.statuses.includes(statusId)) return true;
  const strike = abilityParams(mon, 'critStrike');
  return !!strike && strike.status === statusId;
}
function stageMultiplier(stage) { return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage); }
function accuracyMultiplier(stage) { return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage); }
function effectiveStat(mon, key) {
  let value = statOf(mon, key) * stageMultiplier(mon.bt ? mon.bt.stage[key] : 0);
  const weakened = statusParams(mon, 'weaken');
  if ((key === 'atk' || key === 'rat') && weakened) value *= weakened.attackMult;
  return Math.max(1, Math.floor(value));
}
function abilityPowerMultiplier(attacker, move, options) {
  let multiplier = 1;
  const lowPower = abilityParams(attacker, 'powerWhenLow');
  if (lowPower && attacker.hp <= maxHp(attacker) * lowPower.hpShare) multiplier *= lowPower.mult;
  const rhetoricPower = abilityParams(attacker, 'rhetoricPower');
  if (rhetoricPower && move.c === 'r') multiplier *= rhetoricPower.mult;
  const allyPower = abilityParams(attacker, 'powerWhenAllyFallen');
  if (allyPower && options.allyFallen) multiplier *= allyPower.mult;
  return multiplier;
}
// Pure damage number. options: power (override), crit (bool), roll (0.85..1), allyFallen.
function computeDamage(attacker, defender, move, options) {
  const o = options || {};
  const rhetoric = move.c === 'r';
  const attackStat = effectiveStat(attacker, rhetoric ? 'rat' : 'atk');
  const defenceStat = effectiveStat(defender, rhetoric ? 'rde' : 'def');
  const power = (o.power !== undefined ? o.power : move.p) * abilityPowerMultiplier(attacker, move, o);
  const base = Math.floor(power * attackStat / defenceStat * (attacker.lv + 4) / DAMAGE_DIVISOR);
  const stab = SPECIES[attacker.sp].t === move.t ? STAB_MULT : 1;
  const effectiveness = typeMultiplier(move.t, SPECIES[defender.sp].t);
  const crit = o.crit ? CRIT_MULT : 1;
  const roll = o.roll !== undefined ? o.roll : 1;
  return { damage: Math.max(1, Math.floor(base * stab * effectiveness * crit * roll)), effectiveness: effectiveness, stab: stab, crit: !!o.crit };
}
function recruitChance(foe, itemId) {
  const species = SPECIES[foe.sp];
  const item = ITEMS[itemId];
  if (!species.rec || !item || item.kind !== 'recruit') return 0;
  const hpFactor = 1 + 1.5 * (1 - foe.hp / maxHp(foe)); // x1 at full HP, x2.5 at 0
  const statusFactor = foe.status ? STATUSES[foe.status.id].recruitMult : 1;
  const levelFactor = Math.max(0.5, 1 - foe.lv * 0.015);
  const chance = species.rec / 150 * hpFactor * statusFactor * item.mult * levelFactor;
  return Math.min(0.95, Math.max(0.03, chance));
}
function xpReward(foeMon, isTrainer) {
  const levelScale = Math.max(1, foeMon.lv / XP_SCALE_FROM); // 1 up to level 13, so every fight of the first route pays what it always paid
  return Math.max(1, Math.floor(SPECIES[foeMon.sp].xp * foeMon.lv / XP_DIVISOR * (isTrainer ? TRAINER_XP_BONUS : 1) * levelScale));
}
function canUseItemOn(mon, itemId) {
  const item = ITEMS[itemId];
  if (!item || mon.hp <= 0) return false;
  if (item.kind === 'heal') return mon.hp < maxHp(mon) || (!!item.cures && !!mon.status);
  if (item.kind === 'cure') return !!mon.status;
  return false;
}
// Applies a healing item to a creature (inside or outside a battle). Returns the HP healed.
function applyItemToMon(mon, itemId) {
  const item = ITEMS[itemId];
  const before = mon.hp;
  if (item.kind === 'heal') mon.hp = Math.min(maxHp(mon), mon.hp + item.amount);
  if (item.kind === 'cure' || item.cures) mon.status = null;
  if (mon.bt && item.accDown) mon.bt.stage.acc = Math.max(-6, mon.bt.stage.acc - 1);
  return mon.hp - before;
}

