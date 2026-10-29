// ==== S13 ECONOMY / LOADOUTS ====
// Economy presets ECP01..ECP07 (spec section 12): credits per actor, round payouts with the loss ladder, kill / plant /
// defuse rewards, buy time and buy zone, Economy.buy, the wave shop; loadouts (classes and perks, heroes, ability kits)
// saved in Save.data.loadouts. The one loss-bonus rule (ECO-001, MIS-010): every team has a loss counter; a lost or drawn
// round adds 1, a won round sets it to 0, the side switch resets it. A loss pays lossLadder[min(counter, length) - 1].

const SPAWN_ROOM_RADIUS = 8;             // ECP05: heroes may be switched this close to the last spawn point
const CUSTOM_CLASS_MAX = 10;             // ECP04: 6 preset classes + 10 custom
const CUSTOM_CLASS_PREFIX = 'class-';
const BUY_REASON_TEXT = {
  ok: 'Bought', noEconomy: 'Nothing to buy here', dead: 'You are down', closed: 'Buy time is over', zone: 'Go back to the buy zone',
  unknown: 'Not sold here', owned: 'Already carried', limit: 'Carry limit reached', money: 'Not enough credits', unavailable: 'Not available yet',
  side: 'Not sold to your side',
};
const BUY_RESULT = { ok: false, reason: '', price: 0, item: '' };
const VEST_ITEM = CAT.buyItems.find((item) => item.kind === 'armor');   // a helmet over a full vest costs the rest of the price

const Economy = {
  credits: new Int32Array(MAX_ACTORS),
  lossCount: new Int8Array(TEAM_COUNT),
  swapped: false,                  // the half the money belongs to (Modes.swapped when it was set)
  match: null,                     // the Game.match the state belongs to
  buyUntil: new Float64Array(MAX_ACTORS),                        // end of the actor's buy time: from the round start in round modes, else its spawn
  shopOpen: false,
  shopOpenings: 0,                 // times the shop opened, never reset (buyWindow)
  spawnX: new Float32Array(MAX_ACTORS), spawnZ: new Float32Array(MAX_ACTORS),
  died: new Uint8Array(MAX_ACTORS),                              // died since the last spawn (survivors keep their gear)
  kept: new Uint8Array(MAX_ACTORS * WEAPON_COUNT),               // weapons a survivor carried at the round end
  keptMagazine: new Int16Array(MAX_ACTORS * WEAPON_COUNT), keptReserve: new Int16Array(MAX_ACTORS * WEAPON_COUNT),   // ... with their ammo
  keptHeld: new Int16Array(MAX_ACTORS).fill(-1),                 // ... the one in its hand
  keptGadgets: new Uint8Array(MAX_ACTORS * GADGET_COUNT),        // ... and its grenade and gadget uses
  keptArmor: new Float32Array(MAX_ACTORS), keptHelmet: new Uint8Array(MAX_ACTORS),
  bought: new Uint8Array(MAX_ACTORS * CAT.buyItems.length),      // purchases per item this life (limits)
  perkKeys: Array.from({ length: MAX_ACTORS }, () => new Set()),   // perk ids and perk flags of the actor's class
  cancels: Array.from({ length: MAX_ACTORS }, () => new Set()),    // victim perks the actor's perks switch off
  dealt: new Float32Array(MAX_ACTORS).fill(1), taken: new Float32Array(MAX_ACTORS).fill(1),
  grants: {},       // buy item kind -> fn(id, item) -> bool; 'gadget' and 'grant' hand over to S12 (end of this file)
  catalogueList: [],
  hud: { money: 0, nextRoundMoney: 0, canBuy: false, buyTimeLeft: 0 },

  preset() { return CAT.economy.byId(Abilities.economyKey()) || CAT.economy[0]; },
  usesMoney() { return this.preset().money; },
  // The mode arms everyone itself (MODE_ARMING_PARAMS: the weapon ladder, roulette): no class or kit loadouts then.
  modeArmsEveryone() {
    const params = currentRules().params;
    return !!params && MODE_ARMING_PARAMS.some((key) => params[key]);
  },
  usesLoadouts() { return !this.modeArmsEveryone() && this.preset().loadout !== 'none'; },
  // Class loadouts are handed out at spawn (onSpawn); a hero or kit economy has none.
  usesClasses() { return this.usesLoadouts() && this.preset().loadout === 'classes'; },
  money(id) { return id >= 0 && id < MAX_ACTORS ? this.credits[id] : 0; },
  setMoney(id, amount) {
    const max = this.preset().maxMoney;
    this.credits[id] = Math.max(0, max > 0 ? Math.min(max, amount) : amount);
  },
  addMoney(id, amount) { if (id >= 0 && Actors.kind[id] !== ACTOR_KIND.NONE) this.setMoney(id, this.credits[id] + amount); },

  // ---- Match state ----
  ensureMatch() {
    if (this.match === Game.match) return;
    this.match = Game.match;
    this.buyUntil.fill(0);
    this.shopOpen = false;
    this.died.fill(0);
    this.startHalf();
  },
  // Start of the match and of each half (ECP02: start money each half, unspent money otherwise carries over).
  startHalf() {
    const preset = this.preset();
    this.swapped = Modes.swapped;
    this.lossCount.fill(0);
    for (let id = 0; id < MAX_ACTORS; id++) this.dropKept(id);
    for (let id = 0; id < MAX_ACTORS; id++) this.credits[id] = preset.money ? preset.startMoney : 0;
  },
  checkHalf() {
    this.ensureMatch();
    if (this.preset().halfReset && Modes.swapped !== this.swapped) this.startHalf();
  },
  onRound(event) {
    this.checkHalf();
    if (event.phase === 'start') this.startBuyTime();
    else if (event.phase === 'end') this.payRound(event.winner);
  },
  startBuyTime() { this.buyUntil.fill(Sim.time + this.preset().buyTime); },
  payRound(winner) {
    const preset = this.preset();
    if (!preset.money) return;
    for (let team = 0; team < TEAM_COUNT; team++) {
      const won = team === winner;
      this.lossCount[team] = won ? 0 : this.lossCount[team] + 1;
      const reward = won ? preset.winReward : this.lossBonus(team);
      for (let id = 0; id < Actors.count; id++) if (Modes.participant[id] && Actors.team[id] === team) this.addMoney(id, reward);
    }
    for (let id = 0; id < Actors.count; id++) this.keepGear(id);
  },
  lossBonus(team) { return ladderValue(this.preset().lossLadder, this.lossCount[team]); },
  // ECP02 survivors keep their gear: what a living actor carries at the round end comes back at its next spawn.
  keepGear(id) {
    const alive = Actors.alive[id] === 1;
    this.keptArmor[id] = alive ? Actors.armor[id] : 0;
    this.keptHelmet[id] = alive ? Damage.helmet[id] : 0;
    this.keptHeld[id] = alive ? Weapons.current[id] : -1;
    for (let w = 0; w < WEAPON_COUNT; w++) {
      const slot = Weapons.slotIndex(id, w), index = id * WEAPON_COUNT + w;
      this.kept[index] = alive ? Weapons.owned[slot] : 0;
      this.keptMagazine[index] = Weapons.magazine[slot]; this.keptReserve[index] = Weapons.reserve[slot];
    }
    for (let row = 0; row < GADGET_COUNT; row++) this.keptGadgets[id * GADGET_COUNT + row] = alive ? Gadgets.count[id * GADGET_COUNT + row] : 0;
  },

  // ---- Spawns: positions for the buy zone, kept gear, class loadouts and perks ----
  onSpawn(id) {
    this.checkHalf();
    this.spawnX[id] = Actors.x[id]; this.spawnZ[id] = Actors.z[id];
    this.bought.fill(0, id * CAT.buyItems.length, (id + 1) * CAT.buyItems.length);
    if (!currentRules().rounds) this.buyUntil[id] = Sim.time + this.preset().buyTime;
    if (this.usesClasses()) this.applyClass(id, Loadouts.classFor(id));
    else this.clearPerks(id);
    this.applyBodyModel(id);
    if (this.died[id] || !this.preset().keepOnSurvive) this.dropKept(id);
    else this.restoreKept(id);
    this.died[id] = 0;
  },
  // The body model (03s actorModels) of this life: the hero (12e set it on this spawn), else the class, else the
  // ruleset's own model, else the default body.
  applyBodyModel(id) {
    const hero = Abilities.hero[id];
    if (hero) ActorModels.set(id, 'hero', hero.id);
    else if (this.usesClasses()) ActorModels.set(id, 'class', classModelId(Loadouts.classFor(id)));
    else ActorModels.set(id, 'ruleset', currentRules().id);
  },
  dropKept(id) {
    this.kept.fill(0, id * WEAPON_COUNT, (id + 1) * WEAPON_COUNT);
    this.keptGadgets.fill(0, id * GADGET_COUNT, (id + 1) * GADGET_COUNT);
    this.keptHeld[id] = -1; this.keptArmor[id] = 0; this.keptHelmet[id] = 0;
  },
  // Runs after the start loadout and kit (S11, S12 spawn listeners): only what is missing comes back, so nothing is doubled.
  restoreKept(id) {
    for (let w = 0; w < WEAPON_COUNT; w++) {
      const slot = Weapons.slotIndex(id, w), index = id * WEAPON_COUNT + w;
      if (!this.kept[index] || Weapons.owned[slot]) continue;
      Weapons.give(id, CAT.weapons[w].id, 0);
      Weapons.magazine[slot] = this.keptMagazine[index]; Weapons.reserve[slot] = this.keptReserve[index];   // its ammo as it was, no free refill
    }
    const held = this.keptHeld[id];
    if (held >= 0 && Weapons.owned[Weapons.slotIndex(id, held)]) Weapons.current[id] = held;
    for (let row = 0; row < GADGET_COUNT; row++) {
      const missing = this.keptGadgets[id * GADGET_COUNT + row] - Gadgets.count[id * GADGET_COUNT + row];
      if (missing > 0) Gadgets.give(id, CAT.gadgets[row].id, missing);
    }
    if (this.keptArmor[id] > 0) Actors.armor[id] = Math.max(Actors.armor[id], this.keptArmor[id]);
    if (this.keptHelmet[id]) Damage.helmet[id] = 1;
  },
  // ECP04: the class weapons (melee of the set kept), perk stats before the weapons so reserves include Bandolier.
  applyClass(id, row) {
    this.applyPerks(id, row.perks);
    const melee = Loadouts.setStart(id).filter((key) => CAT.weapons.byId(key).class === 'melee');
    Weapons.setLoadout(id, melee.concat([row.secondary, row.primary]));
    Gadgets.clearGrenades(id);
    this.grant(id, 'gadget', row.lethal);
    this.grant(id, 'gadget', row.tactical);
    if (!CAT.abilities.byId(row.fieldUpgrade)) this.grant(id, 'gadget', row.fieldUpgrade);
  },
  applyPerks(id, keys) {
    this.clearPerks(id);
    for (const key of keys) {
      const perk = CAT.perks.byId(key);
      if (!perk) continue;
      for (const stat in perk.stats) Weapons.statScale[id * WEAPON_STAT_COUNT + STAT[stat.toUpperCase()]] *= perk.stats[stat];
      this.dealt[id] *= perk.dealt; this.taken[id] *= perk.taken;
      this.perkKeys[id].add(perk.id);
      if (perk.flag) this.perkKeys[id].add(perk.flag);
      if (perk.cancels) this.cancels[id].add(perk.cancels);
    }
    Meters.streakDiscount[id] = this.hasPerk(id, 'hardline') ? CAT.perks.byId('hardline').value : 0;
    Abilities.rechargeScale[id] = this.hasPerk(id, 'tuneUp') ? CAT.perks.byId('tuneup').value : 1;
    Move.staminaScale[id] = this.hasPerk(id, 'marathon') ? CAT.perks.byId('marathon').value : 1;
    Move.footstepScale[id] = this.hasPerk(id, 'quiet') ? 0 : 1;
  },
  // Undoes the perk stats this section wrote (attachments multiply on top and are untouched).
  clearPerks(id) {
    for (const perk of CAT.perks) {
      if (!this.hasPerk(id, perk.id)) continue;
      for (const stat in perk.stats) Weapons.statScale[id * WEAPON_STAT_COUNT + STAT[stat.toUpperCase()]] /= perk.stats[stat];
    }
    this.resetPerks(id);
  },
  // A new actor: S11 already reset its stat scales, so only the perk state is cleared.
  resetPerks(id) {
    this.perkKeys[id].clear(); this.cancels[id].clear(); this.dealt[id] = 1; this.taken[id] = 1;
    Meters.streakDiscount[id] = 0; Abilities.rechargeScale[id] = 1;
    Move.staminaScale[id] = Move.footstepScale[id] = 1;
  },
  resetActor(id) {
    const preset = this.preset();
    this.resetPerks(id);
    this.credits[id] = preset.money ? preset.startMoney : 0;
    this.died[id] = 0;
    this.dropKept(id);
    if (Actors.kind[id] === ACTOR_KIND.PLAYER) Loadouts.applyTo(id);
  },
  hasPerk(id, key) { return this.perkKeys[id].has(key); },
  grant(id, kind, key) {
    const handler = this.grants[kind];
    return !!key && !!handler && handler(id, { kind, key, amount: 0 });
  },

  // ---- Rewards ----
  onKill(event) {
    this.died[event.victim] = 1;
    const killer = event.killer, preset = this.preset();
    if (!preset.money || killer < 0 || killer === event.victim || !Actors.isEnemy(killer, event.victim)) return;
    this.addMoney(killer, this.killReward(event, preset));
    if (this.hasPerk(killer, 'scavenger')) scavengeAmmo(killer);
  },
  // ECP02: the preset's kill reward plus the weapon's class bonus (WPN prices table) for weapon kills; the wave shop pays by enemy.
  killReward(event, preset) {
    const profile = Actors.profile[event.victim];
    if (preset.buy === 'shop') return clamp(profile && profile.cash ? profile.cash : preset.killReward, preset.killRewardRange[0], preset.killRewardRange[1]);
    const weapon = CAT.weapons.byId(event.weapon);
    return preset.killReward + (weapon ? weapon.killReward : 0);
  },
  onScore(event) {
    const preset = this.preset();
    if (!preset.money || event.id < 0) return;
    if (event.reason === 'plant') this.payTeam(Actors.team[event.id], preset.plantReward);
    else if (event.reason === 'defuse') this.addMoney(event.id, preset.defuseReward);
  },
  payTeam(team, amount) {
    for (let id = 0; id < Actors.count; id++) if (Actors.kind[id] !== ACTOR_KIND.NONE && Actors.team[id] === team) this.addMoney(id, amount);
  },
  // ECP07: called by the PvE director at a wave's end (team members get the wave bonus, + flawless when nobody died).
  awardWave(team, flawless) {
    const preset = this.preset();
    this.payTeam(team, preset.waveBonus + (flawless ? preset.flawlessBonus : 0));
  },
  setShopOpen(open) {
    if (open && !this.shopOpen) this.shopOpenings++;
    this.shopOpen = !!open;
  },
  // A number that names the actor's current buy window (its buy time end, or the shop opening), so a buyer can tell a new
  // window from the one it already shopped in even when the gap between the two is shorter than its check interval.
  buyWindow(id) { return this.preset().buy === 'round' ? this.buyUntil[id] : this.shopOpenings; },

  // ---- Buying ----
  // '' when the actor may buy right now, else the reason (BUY_REASON_TEXT key).
  buyBlock(id) {
    const preset = this.preset();
    if (!preset.money || preset.buy === 'none') return 'noEconomy';
    if (id < 0 || !Actors.alive[id]) return 'dead';
    if (preset.buy === 'round' && Sim.time >= this.buyUntil[id] - TIME_EPSILON) return 'closed';
    if (preset.buy === 'shop' && !this.shopOpen) return 'closed';
    if (preset.buyZone > 0 && length2(Actors.x[id] - this.spawnX[id], Actors.z[id] - this.spawnZ[id]) > preset.buyZone) return 'zone';
    return '';
  },
  canBuy(id) { return this.buyBlock(id) === ''; },
  buyTimeLeft(id) { return this.preset().buy === 'round' && id >= 0 ? Math.max(0, this.buyUntil[id] - Sim.time) : 0; },
  // The items on sale to actor id (left out: the player) in this match: the buy / shop rows that can be granted (armor first),
  // then priced weapons of the set; only what the actor's side may buy (sideAllows, shared with the bot buyer).
  catalogue(id) {
    const list = this.catalogueList, preset = this.preset(), buyer = id === undefined ? Game.playerId : id;
    list.length = 0;
    if (!preset.money) return list;
    for (const item of CAT.buyItems) if (item.buy === preset.buy && this.canGrant(item) && this.sideAllows(buyer, item)) list.push(item);
    if (preset.buy !== 'round') return list;
    for (const key of currentWeaponSet().weapons) if (CAT.weapons.byId(key).price > 0 && this.sideAllows(buyer, weaponItem(key))) list.push(weaponItem(key));
    return list;
  },
  // A mode that arms everyone (the ladder, roulette) sells no weapons; params.attackerBuys lists the item kinds the attacking side
  // may buy (M27 Ghost Ops: armor and grenades, its attacker loadout is fixed).
  sideAllows(id, item) {
    if (item.kind === 'weapon' && this.modeArmsEveryone()) return false;
    const params = currentRules().params, kinds = params && params.attackerBuys;
    return !kinds || !(id >= 0) || Actors.team[id] !== Modes.attackingTeam() || kinds.includes(item.kind);
  },
  canGrant(item) {
    if (item.kind === 'grant') return Items.canGrantBuy(item.key);
    return item.kind === 'armor' || item.kind === 'helmet' || item.kind === 'ammo' || !!this.grants[item.kind];
  },
  findItem(id, itemId) { return this.catalogue(id).find((item) => item.id === itemId) || null; },
  // What an item costs the actor: a helmet over a full vest costs only the helmet.
  priceFor(id, item) {
    if (item.kind !== 'helmet' || Actors.armor[id] < item.amount) return item.price;
    return item.price - VEST_ITEM.price;
  },
  // P3-01: the one-tap quick buy of the round-buy rulesets is the loadout primary.
  quickBuy(id) { return this.buy(id, Loadouts.pickedKey('primary')); },
  // Economy.buy(id, itemId) -> shared { ok, reason, price, item }: time, zone, item, carry limits and money are checked in that order.
  buy(id, itemId) {
    const result = BUY_RESULT;
    result.ok = false; result.price = 0; result.item = itemId;
    result.reason = this.buyBlock(id);
    if (result.reason) return result;
    const item = this.findItem(id, itemId);
    if (!item) { result.reason = 'unknown'; return result; }
    result.price = this.priceFor(id, item);
    result.reason = this.limitReason(id, item) || (this.credits[id] < result.price ? 'money' : '');
    if (result.reason) return result;
    if (!this.deliver(id, item)) { result.reason = 'unavailable'; return result; }
    this.credits[id] -= result.price;
    if (item.index >= 0) this.bought[id * CAT.buyItems.length + item.index]++;
    result.ok = true; result.reason = 'ok';
    return result;
  },
  limitReason(id, item) {
    if (!this.sideAllows(id, item)) return 'side';
    if (item.kind === 'weapon') return Weapons.has(id, item.key) ? 'owned' : '';
    if (item.kind === 'armor' || item.kind === 'helmet') return Actors.armor[id] >= item.amount && (item.kind === 'armor' || Damage.helmet[id]) ? 'owned' : '';
    const base = id * CAT.buyItems.length;
    if (this.bought[base + item.index] >= item.limit) return 'limit';
    if (!item.group) return '';
    let inGroup = 0;
    for (const other of CAT.buyItems) if (other.group === item.group) inGroup += this.bought[base + other.index];
    return inGroup >= item.groupLimit ? 'limit' : '';
  },
  deliver(id, item) {
    if (item.kind === 'weapon') return this.deliverWeapon(id, item.key);
    if (item.kind === 'armor' || item.kind === 'helmet') {
      Actors.armor[id] = Math.max(Actors.armor[id], item.amount);
      Actors.maxArmor[id] = Math.max(Actors.maxArmor[id], item.amount);
      if (item.kind === 'helmet') Damage.helmet[id] = 1;
      return true;
    }
    if (item.kind === 'ammo') { refillAmmo(id); return true; }
    const handler = this.grants[item.kind];
    return !!handler && handler(id, item);
  },
  // A bought weapon replaces the held one at the carry limit and comes into the hand (keepGear keeps it for a survivor).
  deliverWeapon(id, key) {
    if (!Weapons.give(id, key, 0)) return false;
    Weapons.requestSwitch(id, CAT.weapons.byId(key).index);
    return true;
  },
  // Next-round money for the HUD (ECO-001): what the actor has for sure next round (a loss from here pays the bonus).
  nextRoundMoney(id) {
    const preset = this.preset();
    if (!preset.money || id < 0) return 0;
    const rounds = Modes.rules && Modes.rules.rounds;
    if (rounds && preset.halfReset && rounds.switchAt > 0 && Modes.round === rounds.switchAt) return preset.startMoney;
    if (!rounds || Modes.phase === PHASE.ROUND_END) return this.credits[id];
    const team = Actors.team[id];
    const bonus = team >= 0 && team < TEAM_COUNT ? ladderValue(preset.lossLadder, this.lossCount[team] + 1) : 0;
    return preset.maxMoney > 0 ? Math.min(preset.maxMoney, this.credits[id] + bonus) : this.credits[id] + bonus;
  },
  // Fills out { money, nextRoundMoney, canBuy, buyTimeLeft } for the HUD.
  hudState(id, out) {
    const target = out || this.hud;
    target.money = this.money(id);
    target.nextRoundMoney = this.nextRoundMoney(id);
    target.canBuy = id >= 0 && this.canBuy(id);
    target.buyTimeLeft = this.buyTimeLeft(id);
    return target;
  },
};

// Loss ladder: count 1 pays the first step, counts past the end pay the last step, 0 pays nothing.
function ladderValue(ladder, count) {
  if (count <= 0 || !ladder.length) return 0;
  return ladder[Math.min(count, ladder.length) - 1];
}
// Buy entries for priced weapons, made once per weapon and reused (the catalogue is rebuilt while the menu is open).
const WEAPON_BUY_ITEMS = new Map();
function weaponItem(key) {
  if (WEAPON_BUY_ITEMS.has(key)) return WEAPON_BUY_ITEMS.get(key);
  const weapon = CAT.weapons.byId(key);
  const item = { id: key, name: weapon.name, kind: 'weapon', key, price: weapon.price, amount: 0, limit: 1, group: '', index: -1, weaponClass: weapon.class };
  WEAPON_BUY_ITEMS.set(key, item);
  return item;
}
function refillAmmo(id) {
  for (let w = 0; w < WEAPON_COUNT; w++) {
    const weapon = CAT.weapons[w];
    if (Weapons.has(id, weapon.id)) Weapons.addAmmo(id, weapon.ammoType, Weapons.maxReserve(id, weapon));
  }
}
// Scavenger perk: a kill refills part of the held weapon's pickup ammo.
function scavengeAmmo(id) {
  const weapon = Weapons.currentWeapon(id);
  if (weapon && weapon.ammoType) Weapons.addAmmo(id, weapon.ammoType, Math.ceil(weapon.pickupAmmo * CAT.perks.byId('scavenger').value));
}

// ---- Loadouts (Save.data.loadouts): classes, the hero, ability kit choices, the pickup loadout; applied to the local player ----
// P3-01: the weapon slots draw from the whole roster. A primary is any gun that is not a sidearm; the map power weapons (pads only)
// and the tools (their modes and abilities) are never picked.
const PICKUP_GUN_EXCLUDED = ['melee', 'sidearm', 'tool', 'power'];
const PICKUP_SLOTS = ['melee', 'primary', 'secondary', 'lethal', 'tactical', 'device'];
const PICKUP_SLOT_LABELS = { melee: 'Melee', primary: 'Primary', secondary: 'Secondary', lethal: 'Lethal', tactical: 'Tactical', device: 'Device' };
const FULL_SET_ID = 'fullSet';
const BOT_PRIMARY_MIN_MAG = 4;           // a bot does not spawn with a one-round launcher as its only gun
const BOT_MAP_FIGHT_SHARE = 0.25;        // a typical fight is this share of the map's long side...
const BOT_MAP_FIGHT_RANGE = [8, 60];     // ...within these metres
const BOT_STYLE_FIGHT_SCALE = { camper: 1.6, accurate: 1.4, aggressive: 0.6, jumpy: 0.7, flanker: 0.7, vengeful: 0.8 };   // the bot's role moves the distance it likes to fight at
// The keys that may fill a loadout slot: guns by class, gadgets by their row slot.
function pickupSlotOptions(slot) {
  if (slot === 'melee') return CAT.weapons.filter((row) => row.class === 'melee').map((row) => row.id);
  if (slot === 'secondary') return CAT.weapons.filter((row) => row.class === 'sidearm').map((row) => row.id);
  if (slot === 'primary') return CAT.weapons.filter((row) => !PICKUP_GUN_EXCLUDED.includes(row.class)).map((row) => row.id);
  return CAT.gadgets.filter((row) => row.slot === slot).map((row) => row.id);
}
// A bot's spawn guns [melee, secondary, primary]: its profile favourite when it fits a slot, else a gun whose range suits the map,
// drawn from a stream of its own (the shared streams stay as they were, and a seeded match repeats).
function botSpawnKeys(id) {
  const favorite = CAT.weapons.byId(BotDecide.favoriteWeapon(id)), keys = [Loadouts.meleeFor(id), DEFAULT_PICKUP_LOADOUT.secondary, ''];
  if (favorite && pickupSlotOptions('primary').includes(favorite.id)) keys[2] = favorite.id;
  else if (favorite && favorite.class === 'sidearm') keys[1] = favorite.id;
  if (!keys[2]) keys[2] = botPrimaryForMap(id);
  return keys;
}
// A bot's lethal, tactical and device (and its ability and ultimate) by their botUse rules: each option weighs its chance of use (an
// effect no rule covers, or a tier flag the bot lacks, weighs nothing), and the pick comes from a hash stream of the actor's own.
function botWeightedPick(id, label, keys, weightOf) {
  let total = 0;
  for (const key of keys) total += weightOf(key);
  if (total <= 0) return keys[0];
  let roll = makeRandom(hashString(label + ':' + Rng.seed + ':' + id)).next() * total;
  for (const key of keys) {
    roll -= weightOf(key);
    if (roll < 0) return key;
  }
  return keys[keys.length - 1];
}
function botGadgetWeight(id, key) {
  const effect = CAT.gadgets.byId(key).effect, use = BOT_GADGET_USE[effect];
  if (effect === 'barrier') return 0;   // a wall the nav graph does not know: a bot's own barrier would block its paths
  return !use || (use.tierFlag && !Bots.tier(id)[use.tierFlag]) ? 0 : use.chance;
}
function botAbilityWeight(key) {
  const use = CAT.abilities.byId(key).botUse;
  return use && use.chance > 0 ? use.chance : 0;
}
// The distance a bot expects to fight at: a share of the map's long side, scaled by the bot's style.
function botFightDistance(id) {
  const side = Math.max(World.boundsMax.x - World.boundsMin.x, World.boundsMax.z - World.boundsMin.z);
  const profile = Bots.profile[id];
  return clamp(side * BOT_MAP_FIGHT_SHARE * ((profile && BOT_STYLE_FIGHT_SCALE[profile.style]) || 1), BOT_MAP_FIGHT_RANGE[0], BOT_MAP_FIGHT_RANGE[1]);
}
// A gun a bot may carry or buy as its main gun: not an exotic or a one-round launcher, and its range band holds the bot's fight distance.
function botGunFits(id, weapon) {
  const distance = botFightDistance(id);
  return weapon.class !== 'exotic' && weapon.mag >= BOT_PRIMARY_MIN_MAG && weapon.botPref.range[0] <= distance && distance <= weapon.botPref.range[1];
}
function botPrimaryForMap(id) {
  const guns = pickupSlotOptions('primary').map((key) => CAT.weapons.byId(key)).filter((weapon) => weapon.class !== 'exotic' && weapon.mag >= BOT_PRIMARY_MIN_MAG);
  const fitting = guns.filter((weapon) => botGunFits(id, weapon));
  const pool = fitting.length ? fitting : guns;
  return makeRandom(hashString('spawn:' + Rng.seed + ':' + id)).pick(pool).id;
}

const Loadouts = {
  // Declared in Save.emptySave, so migrate repairs a field of the wrong kind.
  store() { return Save.data.loadouts; },
  lastError: '',
  classes() { return CAT.classes.concat(this.store().classes.custom); },
  classById(id) { return this.classes().find((row) => row.id === id) || null; },
  selectedClass() { return this.classById(this.store().classes.selected) || CAT.classes[0]; },
  // ---- The pickup loadout (P3-05, P3-07): what the player spawns with where the map hands out guns on the whole roster ----
  pickup() { return this.store().pickup; },
  // The match arms from the saved loadout: the whole roster, map pickups, and no mode that hands out every gun itself.
  usesPickupLoadout() {
    return currentRules().weaponSet === FULL_SET_ID && Abilities.economyKey() === 'pickups' && !Economy.modeArmsEveryone();
  },
  pickupOptions(slot) { return pickupSlotOptions(slot); },
  // The saved key of a slot; a key that no longer fits (an edited save) gives the default.
  pickedKey(slot) {
    const key = this.pickup()[slot];
    return pickupSlotOptions(slot).includes(key) ? key : DEFAULT_PICKUP_LOADOUT[slot];
  },
  setPickup(slot, key) {
    if (!PICKUP_SLOTS.includes(slot) || !pickupSlotOptions(slot).includes(key)) return false;
    this.pickup()[slot] = key;
    Save.scheduleSave();
    return true;
  },
  resetPickup() {
    Object.assign(this.pickup(), DEFAULT_PICKUP_LOADOUT);
    Save.scheduleSave();
  },
  // The melee weapon an actor spawns with: the player's loadout pick where the pickup loadout is used or the player changed it from
  // the factory default, else the ruleset's own default melee (its former set's start melee), else the full roster's.
  meleeFor(id) {
    const rules = currentRules();
    if (id >= 0 && Actors.kind[id] === ACTOR_KIND.PLAYER && (this.usesPickupLoadout() || this.pickup().melee !== DEFAULT_PICKUP_LOADOUT.melee)) return this.pickedKey('melee');
    return rules.melee || DEFAULT_PICKUP_LOADOUT.melee;
  },
  // The start guns of the weapon set with the melee of meleeFor in place of the full roster's (id -1: the ruleset's default).
  setStart(id) {
    const set = currentWeaponSet();
    if (set.id !== FULL_SET_ID) return set.start;
    const melee = this.meleeFor(id);
    return set.start.map((key) => (CAT.weapons.byId(key).class === 'melee' ? melee : key));
  },
  // The weapon keys an actor spawns with, the drawn one last: the saved loadout for the player and a built one for each bot where
  // the match uses the pickup loadout, else the weapon set's own start guns.
  startKeys(id) {
    const kind = Actors.kind[id];
    if ((kind !== ACTOR_KIND.PLAYER && kind !== ACTOR_KIND.BOT) || !this.usesPickupLoadout()) return this.setStart(id);
    if (kind === ACTOR_KIND.BOT) return botSpawnKeys(id);
    return [this.pickedKey('melee'), this.pickedKey('secondary'), this.pickedKey('primary')];
  },
  // The gadgets of the pickup loadout (the saved picks for the player, picks by botUse rules for a bot), or null.
  gear(id) {
    const kind = Actors.kind[id];
    if ((kind !== ACTOR_KIND.PLAYER && kind !== ACTOR_KIND.BOT) || !this.usesPickupLoadout()) return null;
    if (kind === ACTOR_KIND.PLAYER) return { lethal: this.pickedKey('lethal'), tactical: this.pickedKey('tactical'), device: this.pickedKey('device') };
    const pick = (slot) => botWeightedPick(id, slot, pickupSlotOptions(slot), (key) => botGadgetWeight(id, key));
    return { lethal: pick('lethal'), tactical: pick('tactical'), device: pick('device') };
  },
  // The ability a bot takes for a slot of the 'loadout' kit ('' = the kit default): by botUse chance, from the bot's own hash stream.
  botAbility(id, kit, slotName) {
    if (Actors.kind[id] !== ACTOR_KIND.BOT || kit.id !== 'loadout' || !kit.choices[slotName]) return '';
    return botWeightedPick(id, slotName, kit.choices[slotName], botAbilityWeight);
  },
  // Why this match does not hand out a weapon from the loadout ('' = it does). The loadout screen shows the reason instead of hiding the row.
  restriction(key) {
    const weapon = CAT.weapons.byId(key);
    if (!weapon) return '';
    if (Economy.modeArmsEveryone()) return 'This mode hands out every weapon itself';
    if (Abilities.usesHeroes()) return 'Heroes carry their own weapons';
    if (!currentWeaponSet().weapons.includes(weapon.id)) return 'Not in this match\'s weapon list';
    if (weapon.class === 'power') return 'Power weapons come from map pads';
    return weapon.class === 'tool' ? 'Tools come with their mode or ability' : '';
  },
  // Players use their selected class, bots a preset class spread by actor id.
  classFor(id) { return Actors.kind[id] === ACTOR_KIND.PLAYER ? this.selectedClass() : CAT.classes[id % CAT.classes.length]; },
  selectClass(id) {
    if (!this.classById(id)) return false;
    this.store().classes.selected = id;
    this.changed();
    return true;
  },
  // Stores a custom class (new id class-N, or the same id replaced); null with lastError when it breaks a rule.
  saveClass(row) {
    const problem = classProblem(row);
    if (problem) { this.lastError = problem; return null; }
    const custom = this.store().classes.custom, existing = custom.findIndex((entry) => entry.id === row.id);
    if (existing < 0 && custom.length >= CUSTOM_CLASS_MAX) { this.lastError = 'You can keep up to ' + CUSTOM_CLASS_MAX + ' custom classes.'; return null; }
    const stored = { id: existing >= 0 ? custom[existing].id : this.nextClassId(), name: String(row.name || 'Custom').slice(0, 24), primary: row.primary,
      secondary: row.secondary, lethal: row.lethal || '', tactical: row.tactical || '', perks: row.perks.slice(), fieldUpgrade: row.fieldUpgrade || 'echopulse' };
    if (existing >= 0) custom[existing] = stored; else custom.push(stored);
    this.lastError = '';
    this.changed();
    return stored;
  },
  removeClass(id) {
    const custom = this.store().classes.custom, index = custom.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    custom.splice(index, 1);
    if (this.store().classes.selected === id) this.store().classes.selected = CAT.classes[0].id;
    this.changed();
    return true;
  },
  nextClassId() {
    let highest = 0;
    for (const row of this.store().classes.custom) highest = Math.max(highest, Number(String(row.id).slice(CUSTOM_CLASS_PREFIX.length)) || 0);
    return CUSTOM_CLASS_PREFIX + (highest + 1);
  },
  hero() { return CAT.heroes.byId(this.store().heroes.hero) || CAT.heroes[0]; },
  setHero(heroId) {
    if (!CAT.heroes.byId(heroId)) return false;
    this.store().heroes.hero = heroId;
    this.changed();
    return true;
  },
  kitChoice(kitId) { return this.store().kits[kitId] || {}; },
  setKitChoice(kitId, slotName, abilityId) {
    const kit = CAT.abilityKits.byId(kitId), allowed = kit && kit.choices[slotName];
    if (!allowed || !allowed.includes(abilityId)) return false;
    const kits = this.store().kits;
    kits[kitId] = Object.assign({}, kits[kitId], { [slotName]: abilityId });
    this.changed();
    return true;
  },
  // The Abilities choice for the player's actor: the hero, plus the slots of the kit this match hands out (the class
  // loadout kit takes its field upgrade from the selected class).
  choice(id) {
    const merged = { hero: this.hero().id };
    const kit = Abilities.usesHeroes() ? null : Abilities.kitOf(id);
    if (!kit) return merged;
    if (kit.id === 'classes') { merged.ability1 = classFieldAbility(this.selectedClass()); return merged; }
    return Object.assign(merged, this.kitChoice(kit.id));
  },
  applyTo(id) { Abilities.setChoice(id, this.choice(id)); },
  changed() {
    Save.scheduleSave();
    if (Game.playerId >= 0) this.applyTo(Game.playerId);
  },
};

// Mode params that mean the mode hands out every weapon itself, so no class or kit loadout applies.
const MODE_ARMING_PARAMS = ['ladder', 'rotateEvery'];
// A class field upgrade that is an ability fills the ability slot; a gadget one (granted by applyClass) leaves it empty.
function classFieldAbility(row) { return CAT.abilities.byId(row.fieldUpgrade) ? row.fieldUpgrade : KIT_SLOT_EMPTY; }
// A custom class wears the model of the first preset class with the same primary weapon class (else, also for an unknown
// weapon, the default body: '' matches no model row).
function classModelId(row) {
  if (CAT.classes.byId(row.id)) return row.id;
  const primary = CAT.weapons.byId(row.primary);
  if (!primary) return '';
  const preset = CAT.classes.find((entry) => CAT.weapons.byId(entry.primary).class === primary.class);
  return preset ? preset.id : '';
}
// The class weapons a slot may hold (the custom class editor's choices): a sidearm as the secondary, any other gun as the primary.
function classWeaponOptions(slot) { return pickupSlotOptions(slot); }
// The ECP04 rules for a custom class: class weapons (classWeaponOptions), one perk of each tier, a field upgrade of the preset list.
function classProblem(row) {
  if (!row || !classWeaponOptions('primary').includes(row.primary)) return 'Pick a primary gun that is not a sidearm.';
  if (!classWeaponOptions('secondary').includes(row.secondary)) return 'The secondary must be a sidearm.';
  if (row.fieldUpgrade && !CAT.economy.byId('classes').fieldUpgrades.includes(row.fieldUpgrade)) return 'Pick a field upgrade from the list.';
  if (!Array.isArray(row.perks) || row.perks.length !== 3) return 'Pick three perks.';
  for (let tier = 1; tier <= 3; tier++) {
    const perk = CAT.perks.byId(row.perks[tier - 1]);
    if (!perk || perk.tier !== tier) return 'Pick one perk of each tier.';
  }
  return '';
}

// ECP05: a hero switch takes effect at once inside the spawn room (near the last spawn point), else at the next spawn.
Economy.switchHero = function switchHero(id, heroId) {
  if (!CAT.heroes.byId(heroId)) return 'unknown';
  Abilities.setChoice(id, Object.assign({}, Abilities.choices[id], { hero: heroId }));
  if (!Abilities.usesHeroes() || !Actors.alive[id]) return 'next';
  if (length2(Actors.x[id] - Economy.spawnX[id], Actors.z[id] - Economy.spawnZ[id]) > SPAWN_ROOM_RADIUS) return 'next';
  Abilities.refreshKit(id);
  Economy.applyBodyModel(id);
  return 'now';
};

// Perk damage (ECP04): Stopping on bullet hits dealt, Hardened on bullet hits taken unless the attacker's perks cancel it.
function isBulletHit(info) { return info.kind === 'hit' && !!info.mode && info.mode.type === 'hitscan'; }
Damage.addAttackerScale((source, target, info) => (source >= 0 && isBulletHit(info) ? Economy.dealt[source] : 1));
function damageTakenCancelled(source, target) {
  if (source < 0) return false;
  for (let i = 0; i < CAT.perks.length; i++) {
    const perk = CAT.perks[i];
    if (perk.taken !== 1 && Economy.hasPerk(target, perk.id) && Economy.cancels[source].has(perk.id)) return true;
  }
  return false;
}
Damage.addReducer((source, target, amount, info) => {
  if (!isBulletHit(info) || Economy.taken[target] === 1 || damageTakenCancelled(source, target)) return amount;
  return amount * Economy.taken[target];
});
// S12 cannot call S13: the objective and perk checks it asks for are wired here.
Abilities.carrierCheck = (id) => {
  for (let i = 0; i < Modes.objectives.length; i++) if (Modes.objectives[i].carrier === id) return true;
  return false;
};
Abilities.hiddenFromPulse = (id) => Economy.hasPerk(id, 'ghost');
Damage.downedWeapon = (id) => (Economy.hasPerk(id, 'lastStand') ? CAT.perks.byId('laststand').weapon : '');   // ECP04 Last Stand
Damage.downHooks.push((id) => Modes.dropCarried(id));   // HP-007: a downed carrier acts on no objective, so it drops it
// Buy rows and class slots of kind 'gadget' (grenades, ECP04 field upgrades G13/G22/G23/G24 with their row cooldown as the
// 60-120 s recharge) and 'grant' (wave shop extras such as the core shield: Items.grantEffects) are delivered by S12.
Economy.grants.gadget = (id, item) => Gadgets.give(id, item.key, item.amount || 1) > 0;
Economy.grants.grant = (id, item) => Items.grantBuy(id, item);

Weapons.startKeys = (id) => Loadouts.startKeys(id);        // S11 <- S13: the spawn guns follow the loadout
Gadgets.loadoutGear = (id) => Loadouts.gear(id);
Abilities.botChoice = (id, kit, slotName) => Loadouts.botAbility(id, kit, slotName);

Bus.on('match.start', () => Economy.ensureMatch());
Bus.on('match.stop', () => { Economy.match = null; Economy.credits.fill(0); });
Bus.on('round', (event) => Economy.onRound(event));
Bus.on('actor.create', (id) => Economy.resetActor(id));
Bus.on('actor.spawn', (event) => Economy.onSpawn(event.id));
Bus.on('kill', (event) => Economy.onKill(event));
Bus.on('score', (event) => Economy.onScore(event));
Bus.on('ability.teleport', (event) => Modes.dropCarried(event.id));   // A12 (balance.dropsObjective): a carried flag drops on use
