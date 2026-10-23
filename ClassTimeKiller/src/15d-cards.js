// ==== S15 PROGRESSION: CARDS ====
// Cards C01..C24 (spec 15 card table, MIS-035): run modifiers the player places before a match. 3 active slots (each card used
// once per level for 30 s) and 2 passive slots (the whole level); placing costs Marks, removing refunds half of what was paid.
// Cards apply in PvE matches, and in versus only with X48 (rules.fx.cards) and only rows marked `versus`. The 'handicap' rule
// stage writes rules.cards = { ids, fx } (fx: the soul numbers S12 reads for the player: soulLife, soulMagnet, wrathAt, soulHeal);
// the effects run through the existing systems (Buffs damage / invulnerable / speed / slow / rate, Damage.addReducer and
// Damage.regenerate, 'pickup', 'weapon.fire', 'damage'). Each card unlocks by its own play-style condition over one finished
// PvE level (RunLog metrics).

const CARD_BRITTLE_EXTRA = 1;              // a brittle hit deals the target's whole pool plus this
const CARD_NO_HOLDER = -1;
const CARD_PATRON = 'freecards';           // C17 Patron (the id older saves keep)
const CARD_CONTRACT_FX = ['soulLife', 'wrathAt', 'soulMagnet', 'soulHeal'];   // soul multipliers / numbers copied into rules.cards.fx
const CARD_KIND = {};
['takenScale', 'worldSlow', 'activeSeconds', 'startHealth', 'ammoPickup', 'speed', 'damage', 'rate', 'activeUses', 'marks',
  'invulnerable', 'baseHealth', 'placementScale', 'lastBreath', 'discord', 'noAmmoUse', 'brittleFoes', 'regen', 'lifesteal']
  .concat(CARD_CONTRACT_FX).forEach((kind, index) => { CARD_KIND[kind] = index; });
const CARD_KIND_COUNT = Object.keys(CARD_KIND).length;
const CARD_COMPARE = {
  '==': (a, b) => a === b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '<': (a, b) => a < b, '>': (a, b) => a > b,
};

// ---- Owned cards, slots and Marks (Save.data.progression.cards) ----
const Cards = {
  record() { return Progress.profile().cards; },
  marks() { return this.record().marks; },
  isUnlocked(id) { return Progress.unlockAll() || this.record().unlocked[id] === true; },
  equipped(type) { return this.record()[type]; },
  equippedIds() { return this.record().active.concat(this.record().passive).map((entry) => entry.id); },
  isEquipped(id) { return this.equippedIds().includes(id); },
  // C17 Patron placed: every card costs its price x the Patron's factor (Marks keep a use).
  priceOf(row) { return this.isEquipped(CARD_PATRON) ? Math.round(row.cost * CAT.cards.byId(CARD_PATRON).effect.value) : row.cost; },
  // '' when the card can be placed, else the reason shown to the player.
  equipProblem(id) {
    const row = CAT.cards.byId(id);
    if (!row) return 'Unknown card.';
    if (!this.isUnlocked(id)) return row.unlock.text;
    if (this.isEquipped(id)) return 'Already placed.';
    if (this.equipped(row.type).length >= CARD_SLOTS[row.type]) return 'No free ' + row.type + ' slot.';
    if (this.marks() < this.priceOf(row)) return 'Needs ' + this.priceOf(row) + ' Marks.';
    return '';
  },
  equip(id) {
    if (this.equipProblem(id)) return false;
    const row = CAT.cards.byId(id), paid = this.priceOf(row);
    this.record().marks -= paid;
    this.equipped(row.type).push({ id, paid });
    Save.scheduleSave();
    return true;
  },
  // Removing refunds half of what the card cost when it was placed.
  unequip(id) {
    const row = CAT.cards.byId(id), list = row ? this.equipped(row.type) : [], index = list.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    this.record().marks += Math.floor(list[index].paid * CARD_REFUND);
    list.splice(index, 1);
    if (id === CARD_PATRON) this.chargeCheapPlacements();
    Save.scheduleSave();
    return true;
  },
  // Patron is gone: the cards it placed cheaper now pay the rest of their price; one the Marks cannot cover is taken off (no refund).
  chargeCheapPlacements() {
    for (const type of Object.keys(CARD_SLOTS)) {
      this.record()[type] = this.equipped(type).filter((entry) => {   // in the order they were placed
        const owed = CAT.cards.byId(entry.id).cost - entry.paid;
        if (owed <= 0) return true;
        if (this.marks() < owed) return false;
        this.record().marks -= owed;
        entry.paid += owed;
        return true;
      });
    }
  },
  addMarks(amount) { this.record().marks += Math.max(0, Math.round(amount)); Save.scheduleSave(); },
  // The cards a match runs with: setup.cards (tests, a run that names them) or the placed ones; PvE always, versus only with X48.
  forMatch(rules, setup) {
    if (!setup.player) return [];
    const versus = rules.family === 'versus';
    if (versus && !(rules.fx && rules.fx.cards)) return [];
    const ids = Array.isArray(setup.cards) ? setup.cards : this.equippedIds();
    return ids.filter((id) => { const row = CAT.cards.byId(id); return !!row && (!versus || row.versus); });
  },
  matchFx(ids) {
    const fx = {};
    for (const id of ids) {
      const effect = CAT.cards.byId(id).effect;
      if (CARD_CONTRACT_FX.includes(effect.kind)) fx[effect.kind] = effect.value;
    }
    return fx;
  },
  // Card unlocks after a won PvE level: each locked card whose condition holds.
  unlockFromRun(match, metrics, award) {
    if (!metrics.pveFinished) return;
    for (const row of CAT.cards) {
      if (this.record().unlocked[row.id] || !cardConditionMet(row.unlock, metrics)) continue;
      this.record().unlocked[row.id] = true;
      award.lines.push('Card unlocked: ' + row.name);
    }
  },
};

function cardConditionMet(unlock, metrics) {
  const value = metrics[unlock.metric];
  if (typeof value !== 'number' || value === PROGRESS_NOT_REACHED) return false;
  if (unlock.minKills !== undefined && metrics.kills < unlock.minKills) return false;
  if (unlock.deaths !== undefined && metrics.deaths !== unlock.deaths) return false;
  if (unlock.hard && !metrics.hard) return false;
  return CARD_COMPARE[unlock.op](value, unlock.value);
}

// ---- The running match: who holds cards, passive values, active slots ----
const CardRun = {
  holder: CARD_NO_HOLDER,
  has: new Uint8Array(CARD_KIND_COUNT),          // passive or active card of the kind is in the match
  value: new Float32Array(CARD_KIND_COUNT),
  rate: new Float32Array(CARD_KIND_COUNT),         // the row's per-second rate (C23 Mending)
  activeUntil: new Float64Array(CARD_KIND_COUNT),   // Sim.time the last active effect of the kind ends (0 = off)
  slots: [],                                      // active cards: { id, kind, usesLeft, endsAt } (built on match.start only)
  discordTeam: new Int8Array(MAX_ACTORS),
  discordSet: new Uint8Array(MAX_ACTORS),
  lastBreathUsed: false,

  reset() {
    this.holder = CARD_NO_HOLDER;
    this.has.fill(0); this.value.fill(0); this.rate.fill(0); this.activeUntil.fill(0);
    this.slots = [];
    this.discordSet.fill(0);
    this.lastBreathUsed = false;
  },
  onStart(match) {
    this.reset();
    const cards = match.rules && match.rules.cards;
    if (!cards || !cards.ids.length || Game.playerId < 0) return;
    this.holder = Game.playerId;
    for (const id of cards.ids) this.load(CAT.cards.byId(id));
    const uses = this.has[CARD_KIND.activeUses] ? this.value[CARD_KIND.activeUses] : 1;
    for (const slot of this.slots) slot.usesLeft = uses;
    if (Actors.alive[this.holder]) applySpawnCards(this.holder);   // S13 spawned everyone in its match.start listener, before this one
  },
  load(row) {
    const kind = CARD_KIND[row.effect.kind];
    if (row.type === 'active') { this.slots.push({ id: row.id, kind, usesLeft: 1, endsAt: 0 }); return; }
    this.has[kind] = 1;
    this.value[kind] = row.effect.value;
    this.rate[kind] = row.effect.rate || 0;
  },
  active(kind) { return this.activeUntil[kind] > Sim.time; },
  holds(kind, id) { return id === this.holder && id >= 0 && (this.has[kind] === 1 || this.active(kind)); },
  activeSeconds() { return CARD_ACTIVE_SECONDS + (this.has[CARD_KIND.activeSeconds] ? this.value[CARD_KIND.activeSeconds] : 0); },
  // Uses an active card in a slot. Returns false when the slot is empty, used up, running, or the holder is dead.
  activate(slotIndex) {
    const slot = this.slots[slotIndex], id = this.holder;
    if (!slot || slot.usesLeft <= 0 || slot.endsAt > Sim.time || id < 0 || !Actors.alive[id]) return false;
    const row = CAT.cards.byId(slot.id), seconds = row.effect.kind === 'discord' ? row.effect.value : this.activeSeconds();
    slot.usesLeft--;
    slot.endsAt = Sim.time + seconds;
    this.activeUntil[slot.kind] = Math.max(this.activeUntil[slot.kind], slot.endsAt);
    this.value[slot.kind] = row.effect.value;
    CARD_STARTS[row.effect.kind](id, row.effect.value, seconds);
    return true;
  },
  // C23 Mending: HP regrows to the card's cap at its rate (the shared regeneration path).
  step(dt) {
    const id = this.holder;
    if (id < 0) return;
    this.endDiscord();
    if (!Actors.alive[id] || !this.has[CARD_KIND.regen]) return;
    Damage.regenerate(id, this.rate[CARD_KIND.regen] * dt, this.value[CARD_KIND.regen]);
  },
  endDiscord() {
    if (this.active(CARD_KIND.discord)) return;
    for (let id = 0; id < Actors.count; id++) {
      if (!this.discordSet[id]) continue;
      Actors.team[id] = this.discordTeam[id];
      this.discordSet[id] = 0;
    }
  },
};

// Start effects of active cards; the timed ones ride on the ability Buffs (S12: the strongest live damage buff wins, so
// Twin Fury during Rage keeps x4 until Rage ends, and the actor glow shows them).
function isCardOpponent(holder, id) { return id !== holder && Actors.alive[id] === 1 && Actors.isEnemy(holder, id); }
const CARD_STARTS = {
  takenScale() {}, brittleFoes() {}, noAmmoUse() {},
  damage(id, value, seconds) { Buffs.add(id, BUFF.DAMAGE, value, seconds); },
  invulnerable(id, value, seconds) { Buffs.add(id, BUFF.INVULNERABLE, 1, seconds); },
  speed(id, value, seconds) { Buffs.add(id, BUFF.SPEED, value, seconds); },
  rate(id, value, seconds) { Buffs.add(id, BUFF.RATE, value, seconds); },
  // "The world x0.5": every opponent moves and fires at the card's factor while it runs.
  worldSlow(id, value, seconds) {
    for (let other = 0; other < Actors.count; other++) {
      if (!isCardOpponent(id, other)) continue;
      Buffs.add(other, BUFF.SLOW, value, seconds);
      Buffs.add(other, BUFF.RATE_SLOW, value, seconds);
    }
  },
  // PvE enemies turn on each other: their team becomes "hostile to all" (A24 rule) until the card ends.
  discord(id) {
    for (let other = 0; other < Actors.count; other++) {
      if (Actors.kind[other] !== ACTOR_KIND.ENEMY || !isCardOpponent(id, other) || CardRun.discordSet[other]) continue;
      CardRun.discordTeam[other] = Actors.team[other];
      CardRun.discordSet[other] = 1;
      Actors.team[other] = HOSTILE_TO_ALL;
    }
  },
};

// ---- Hooks ----
Rules.addModifier('handicap', (rules, setup) => {
  const ids = Cards.forMatch(rules, setup);
  rules.cards = { ids, fx: Cards.matchFx(ids) };
});
Damage.addReducer((source, target, amount) => {
  if (CardRun.holds(CARD_KIND.brittleFoes, source) && isCardOpponent(source, target) && !isBoss(target)) {
    return Math.max(amount, Actors.health[target] + Actors.armor[target] + Actors.shield[target] + CARD_BRITTLE_EXTRA);
  }
  if (target !== CardRun.holder || target < 0) return amount;
  const scaled = CardRun.active(CARD_KIND.takenScale) ? amount * CardRun.value[CARD_KIND.takenScale] : amount;
  return cardLastBreath(target, scaled);
});
// C18: the first hit that would kill leaves the holder at the card's HP instead.
function cardLastBreath(target, amount) {
  if (!CardRun.has[CARD_KIND.lastBreath] || CardRun.lastBreathUsed) return amount;
  if (amount < Actors.health[target] + Actors.armor[target] + Actors.shield[target]) return amount;
  CardRun.lastBreathUsed = true;
  Actors.health[target] = CardRun.value[CARD_KIND.lastBreath];
  return 0;
}
// C05 / C16: spawn health (after S11 reset the pools on actor.spawn).
function applySpawnCards(id) {
  if (id !== CardRun.holder || id < 0) return;
  if (CardRun.has[CARD_KIND.baseHealth]) { Actors.maxHealth[id] = CardRun.value[CARD_KIND.baseHealth]; Actors.health[id] = Actors.maxHealth[id]; }
  if (CardRun.has[CARD_KIND.startHealth]) Actors.health[id] = Math.max(Actors.health[id], CardRun.value[CARD_KIND.startHealth]);
}
// C06: an ammo pickup is granted once more (Items.grant does not emit 'pickup', so this never repeats).
function cardAmmoPickup(event) {
  if (event.group !== 'ammo' || !CardRun.holds(CARD_KIND.ammoPickup, event.id)) return;
  for (let extra = 1; extra < CardRun.value[CARD_KIND.ammoPickup]; extra++) Items.grant(event.id, event.item);
}
// C21: the shot's rounds come back at once (ammo is spent before 'weapon.fire').
function cardFire(event) {
  if (!CardRun.holds(CARD_KIND.noAmmoUse, event.id)) return;
  const weapon = Weapons.currentWeapon(event.id);
  if (!weapon || !weapon.mag) return;
  const slot = Weapons.slotIndex(event.id, weapon.index);
  if (event.mode === 'alt') Weapons.altAmmo[slot] = weapon.altAmmo; else Weapons.magazine[slot] = Weapons.magSize(event.id, weapon);
}
// C24: a share of the damage dealt heals the holder (up to max health).
function cardDamage(event) {
  if (CardRun.holds(CARD_KIND.lifesteal, event.source)) Damage.lifesteal(event, CardRun.value[CARD_KIND.lifesteal]);
}
// Marks: PvE enemy kills and crates (Greed doubles them); added to the profile when the match is counted.
function cardKill(event) {
  if (event.killer !== Game.playerId || event.killer < 0 || Actors.kind[event.victim] !== ACTOR_KIND.ENEMY) return;
  RunLog.marks += MARKS_RULES.perKill * (CardRun.has[CARD_KIND.marks] ? CardRun.value[CARD_KIND.marks] : 1);
}
function cardCrate(event) {
  if (event.id !== Game.playerId || event.id < 0) return;
  RunLog.marks += MARKS_RULES.perCrate * (CardRun.has[CARD_KIND.marks] ? CardRun.value[CARD_KIND.marks] : 1);
}

Progress.addFinisher((match, metrics, award) => {
  if (RunLog.marks > 0) { Cards.addMarks(RunLog.marks); award.lines.push('Marks earned: ' + RunLog.marks); }
  Cards.unlockFromRun(match, metrics, award);
});
Sim.addSystem('cards', 25, (dt) => CardRun.step(dt));
Bus.on('match.start', (match) => CardRun.onStart(match));
Bus.on('match.stop', () => { CardRun.endDiscord(); CardRun.reset(); });
Bus.on('actor.spawn', (event) => applySpawnCards(event.id));
Bus.on('pickup', cardAmmoPickup);
Bus.on('weapon.fire', cardFire);
Bus.on('damage', cardDamage);
Bus.on('kill', cardKill);
Bus.on('pve.crate', cardCrate);
