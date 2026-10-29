// ==== S12 ABILITIES (framework) ====
// Ability slots ability1 / ability2 / ultimate / passive per actor (ABL-001), bound to BTN.ABILITY1 / ABILITY2 / ULTIMATE.
// Activation types and resources come from CAT.abilities rows (ABL-002); effects are generic kinds in 12f, meters in 12g.
// Sim system 'abilities' (order 20). Slots are reset on actor.spawn and cleared on death and at match end / stop.
// Hero kits (RS09): the hero's pools (Damage.poolOverride), weapons, movement preset and passive. API: docs/api/abilities-economy.md.

const ABILITY_SLOT_NAMES = ['ability1', 'ability2', 'ultimate', 'passive'];
const ABILITY_SLOT_COUNT = ABILITY_SLOT_NAMES.length;
const SLOT = { ABILITY1: 0, ABILITY2: 1, ULTIMATE: 2, PASSIVE: 3 };
const SLOT_BUTTONS = [BTN.ABILITY1, BTN.ABILITY2, BTN.ULTIMATE, 0];
const NO_ABILITY = -1;
const KIT_SLOT_EMPTY = 'none';          // a loadout choice that leaves the slot empty (ECP04 gadget field upgrades)
const OPEN_ENDED = -1;                    // activeTime of toggles and holds: they run until turned off
const DEFAULT_INTERRUPT = Object.freeze({ damage: false, stun: true, fire: false });
const REWARD_QUEUE_SIZE = 3;               // a streak or boost meter has three rewards at most
const ABILITY_STUN_FLAGS = ACTOR_FLAG.FROZEN | ACTOR_FLAG.DOWNED;
const ATTACK_CATEGORIES = ['offense', 'control'];   // refused while Gadgets.attackLocked (Phase Slip)
const HUD_SLOT_COUNT = 3;                  // the passive slot is not drawn as a button
const ABILITY_CAST_EVENT = { id: 0, ability: '', slot: '' };
const ABILITY_END_EVENT = { id: 0, ability: '', slot: '', reason: '' };

function makeHudSlot() { return { id: '', name: '', key: '', ready: false, cooldown: 0, charges: 0, active: false, remaining: 0, color: 0xffffff }; }

const Abilities = {
  slotAbility: new Int16Array(MAX_ACTORS * ABILITY_SLOT_COUNT).fill(NO_ABILITY),
  cooldown: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT),     // seconds until ready (charges: until the next charge)
  slotCooldown: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT), // the slot's full cooldown: the row's, or the kit's override
  charges: new Uint8Array(MAX_ACTORS * ABILITY_SLOT_COUNT),
  active: new Uint8Array(MAX_ACTORS * ABILITY_SLOT_COUNT),
  activeTime: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT),   // seconds left of the active window (OPEN_ENDED for toggles/holds)
  elapsed: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT),      // seconds since the cast
  fuel: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT),         // 'fuel' resource seconds left
  reward: new Uint8Array(MAX_ACTORS),                              // streak / boost reward loaded into the ultimate slot, not used yet
  rewardLoaded: new Uint8Array(MAX_ACTORS),                        // the ultimate slot holds a reward until it has run
  rewardQueue: new Int16Array(MAX_ACTORS * REWARD_QUEUE_SIZE),     // rewards earned while one is loaded, in order (row indexes)
  rewardsWaiting: new Uint8Array(MAX_ACTORS),
  suppressedUntil: new Float64Array(MAX_ACTORS),                   // G20 null pulse: no abilities until this Sim.time
  rechargeScale: new Float32Array(MAX_ACTORS).fill(1),             // cooldown speed (Tune Up perk writes it)
  hero: new Array(MAX_ACTORS).fill(null),                          // hero row of this life (hero rulesets)
  choices: new Array(MAX_ACTORS).fill(null),                       // loadout choice { hero, ability1, ability2, ultimate } or null
  drawn: new Array(MAX_ACTORS).fill(null),                         // hero drawn for an actor without a choice, kept for the match
  drawnTeam: new Int8Array(MAX_ACTORS),                            // the team that hero was drawn for (auto-balance may move a bot)
  heroMove: new Uint8Array(MAX_ACTORS),                            // this section set Move.setPreset for the actor
  effects: {},      // effect kind -> { cast(id, row, slot) -> bool, step(id, row, slot, dt) -> false ends, end(id, row, slot, reason), drain(id, row) }
  passives: {},     // hero passive kind -> { step(id, passive, dt) }
  carrierCheck: null,   // fn(id) -> true while the actor carries an objective (S13 fills it; balance flag noCarrier)
  hudSlots: [makeHudSlot(), makeHudSlot(), makeHudSlot()],

  index(id, slot) { return id * ABILITY_SLOT_COUNT + slot; },
  row(id, slot) {
    const ability = this.slotAbility[this.index(id, slot)];
    return ability === NO_ABILITY ? null : CAT.abilities[ability];
  },
  slotOf(id, abilityId) {
    for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) {
      const row = this.row(id, slot);
      if (row && row.id === abilityId) return slot;
    }
    return -1;
  },
  isActive(id, abilityId) {
    const slot = this.slotOf(id, abilityId);
    return slot >= 0 && this.active[this.index(id, slot)] === 1;
  },
  interruptRule(row) { return row.interrupt || DEFAULT_INTERRUPT; },

  // ---- Kits: which abilities an actor gets this life ----
  economyKey(rules) { const built = rules || currentRules(); return (built.params && built.params.economy) || built.economy || ''; },
  usesHeroes() { return this.economyKey() === 'heroKits'; },
  // The hero chosen for the actor (loadout choice or bot profile), else the one drawn for it once per match; cached per life.
  pickHero(id) {
    const mirrored = this.mirroredHero(id);
    if (mirrored) return mirrored;
    const wanted = this.wantedHero(id) || this.keptDraw(id);
    if (wanted) return wanted;
    this.drawnTeam[id] = Actors.team[id];
    return (this.drawn[id] = this.drawHero(id));
  },
  // The hero drawn for the actor while it is still on the team it was drawn for, else null.
  keptDraw(id) { return this.drawnTeam[id] === Actors.team[id] ? this.drawn[id] : null; },
  wantedHero(id) {
    const choice = this.choices[id], profile = Actors.profile[id];
    return CAT.heroes.byId((choice && choice.hero) || (profile && profile.hero) || '');
  },
  // balance-01: a seeded draw per team (so every match fields new line-ups): a role the team lacks first, then a hero no
  // teammate plays (the player's own pick included), then any once all are taken.
  drawHero(id) {
    const taken = this.teamHeroes(id);
    const missingRole = CAT.heroes.filter((hero) => !taken.some((other) => other.role === hero.role));
    const unused = CAT.heroes.filter((hero) => !taken.includes(hero));
    const pool = missingRole.length ? missingRole : unused.length ? unused : CAT.heroes;
    return makeRandom(hashString('hero:' + Rng.seed + ':' + id)).pick(pool);
  },
  teamHeroes(id) {
    const heroes = [];
    for (let other = 0; other < Actors.count; other++) {
      if (other === id || Actors.kind[other] === ACTOR_KIND.NONE || Actors.team[other] !== Actors.team[id]) continue;
      const hero = this.wantedHero(other) || this.keptDraw(other);
      if (hero) heroes.push(hero);
    }
    return heroes;
  },
  // X40 Mirror Match: bots play the local player's hero (13h copies the loadout the same way).
  mirroredHero(id) {
    const fx = currentRules().fx, player = Game.playerId;
    if (!fx || !fx.mirror || player < 0 || player === id || Actors.kind[id] === ACTOR_KIND.PLAYER) return null;
    return this.hero[player] || this.pickHero(player);
  },
  // X46 Powers for All (13h 'power.pick' at every spawn): the drawn ability fills the first slot for this life.
  onPowerPick(event) {
    const row = CAT.abilities.byId(event.ability);
    if (row && Actors.alive[event.id]) this.setSlot(event.id, SLOT.ABILITY1, row);
  },
  heroOf(id) { return this.usesHeroes() ? this.hero[id] || this.pickHero(id) : null; },
  kitOf(id) {
    if (this.usesHeroes()) return this.heroOf(id);
    const rules = currentRules();
    for (const kit of CAT.abilityKits) if (kitMatches(kit, rules)) return kit;
    return null;
  },
  botChoice: null,   // fn(id, kit, slotName) -> the ability a bot takes for a kit slot, or '' (13d: by botUse rules)
  setChoice(id, choice) { this.choices[id] = choice ? Object.assign({}, choice) : null; },
  // The ability id for one slot: an allowed loadout choice, nothing for KIT_SLOT_EMPTY, else the kit default.
  kitAbility(id, kit, slotName) {
    const choice = this.choices[id], wanted = choice ? choice[slotName] : this.botChoice ? this.botChoice(id, kit, slotName) : '';
    if (wanted === KIT_SLOT_EMPTY) return '';
    const allowed = kit.choices && kit.choices[slotName];
    if (wanted && allowed && allowed.includes(wanted)) return wanted;
    return kit[slotName] || '';
  },
  assignSlots(id) {
    for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) this.assignKitSlot(id, slot);
    const kit = this.kitOf(id);
    if (kit && kit.passive && kit.passive.kind === 'ability') this.setSlot(id, SLOT.PASSIVE, CAT.abilities.byId(kit.passive.ability));
    Meters.fillSlots(id);
  },
  // The kit's ability for one slot (or none), with the kit's cooldown override for that slot. A soul mode
  // (rules.params.souls: M21, M22) puts A34 Wrath Form in an ultimate slot the kit leaves empty (ABL-005).
  assignKitSlot(id, slot) {
    const kit = this.kitOf(id), slotName = ABILITY_SLOT_NAMES[slot];
    const key = (kit ? this.kitAbility(id, kit, slotName) : '') || soulUltimate(slot);
    this.setSlot(id, slot, key ? CAT.abilities.byId(key) : null);
    const override = kit && kit.cooldowns ? kit.cooldowns[slotName] : 0;
    if (override > 0 && key) this.slotCooldown[this.index(id, slot)] = override;
  },
  setSlot(id, slot, row) {
    const i = this.index(id, slot);
    this.slotAbility[i] = row ? row.index : NO_ABILITY;
    this.slotCooldown[i] = row ? row.cooldown : 0;
    this.cooldown[i] = 0; this.active[i] = 0; this.activeTime[i] = 0; this.elapsed[i] = 0;
    this.charges[i] = row ? Math.max(1, row.charges) : 0;
    this.fuel[i] = row ? row.duration : 0;
    if (row && row.activation === 'passive') this.active[i] = 1;
  },

  // ---- Life cycle ----
  onSpawn(id) {
    this.endAll(id, 'spawn');
    this.reward[id] = 0; this.rewardLoaded[id] = 0; this.rewardsWaiting[id] = 0;
    this.suppressedUntil[id] = 0;
    this.hero[id] = this.usesHeroes() ? this.pickHero(id) : null;
    this.applyHero(id);
    this.assignSlots(id);
  },
  // Hero weapons and movement (the start loadout S11 gave on actor.spawn is replaced).
  applyHero(id) {
    const hero = this.hero[id];
    if (!hero) { if (this.heroMove[id]) Move.setPreset(id, null); this.heroMove[id] = 0; return; }
    Move.setPreset(id, hero.move);
    this.heroMove[id] = 1;
    Weapons.setLoadout(id, hero.weapons);
    Gadgets.equipHero(id, hero);
  },
  // Respawn-in-place kit change (hero switch in the spawn room): pools, weapons, movement, gadgets and slots of the new
  // hero. The gadget kit starts over as on a spawn, so the old hero's gadget never stays behind.
  refreshKit(id) {
    Damage.resetHealth(id);
    Gadgets.equip(id);
    this.onSpawn(id);
  },
  endAll(id, reason) {
    for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) if (this.active[this.index(id, slot)]) this.end(id, slot, reason);
  },
  // Ends the running offense and control abilities (an actor whose attacks just became locked, e.g. a human turned infected).
  endAttacks(id, reason) {
    for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) {
      const row = this.row(id, slot);
      if (row && ATTACK_CATEGORIES.includes(row.category) && this.active[this.index(id, slot)]) this.end(id, slot, reason);
    }
  },
  clearActor(id, reason) {
    this.endAll(id, reason);
    AbilityZones.removeOwned(id, reason === 'death');
    Buffs.clear(id);
  },
  clearMatch() {
    for (let id = 0; id < Actors.count; id++) this.clearActor(id, 'match');
    AbilityZones.clear();
  },

  // ---- Per step ----
  step(dt) {
    for (let id = 0; id < Actors.count; id++) {
      if (Actors.kind[id] === ACTOR_KIND.NONE || !Actors.alive[id]) continue;
      this.stepActor(id, dt);
    }
    AbilityZones.step(dt);
    Buffs.apply();
  },
  stepActor(id, dt) {
    const stunned = (Actors.flags[id] & ABILITY_STUN_FLAGS) !== 0;
    for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) {
      const row = this.row(id, slot);
      if (!row) continue;
      this.recharge(id, slot, row, dt);
      const i = this.index(id, slot);
      if (this.active[i] && stunned && row.activation !== 'passive' && this.interruptRule(row).stun) { this.end(id, slot, 'stun'); continue; }
      if (this.active[i] && this.pressedAgain(id, slot, row)) { this.tryActivate(id, slot); continue; }   // the same press must not recast
      if (this.active[i]) this.stepActive(id, slot, row, dt);
      else if (!stunned) this.readInput(id, slot, row);
    }
  },
  // A second press of the slot button while a toggle runs turns it off, while a channel runs cancels it.
  pressedAgain(id, slot, row) {
    const button = SLOT_BUTTONS[slot];
    return isCancellable(row) && button !== 0 && (Actors.pressed[id] & button) !== 0;
  },
  readInput(id, slot, row) {
    if (row.activation === 'ult') { if (this.canAfford(id, slot, row)) this.tryActivate(id, slot); return; }
    const button = SLOT_BUTTONS[slot];
    if (button && (Actors.pressed[id] & button)) this.tryActivate(id, slot);
  },
  recharge(id, slot, row, dt) {
    const i = this.index(id, slot), scale = this.rechargeScale[id];
    if (row.resource === 'fuel') { if (!this.active[i] && Move.isGrounded(id)) this.fuel[i] = row.duration; return; }
    if (row.resource === 'charges') { this.rechargeCharge(i, row, dt * scale); return; }
    if (this.cooldown[i] > 0) this.cooldown[i] = Math.max(0, this.cooldown[i] - dt * scale);
  },
  // One charge at a time refills in the slot cooldown (spec "3 charges, 3 s each").
  rechargeCharge(i, row, dt) {
    if (this.charges[i] >= row.charges || this.slotCooldown[i] <= 0) return;
    this.cooldown[i] -= dt;
    if (this.cooldown[i] > TICK_EPSILON) return;
    this.charges[i]++;
    this.cooldown[i] = this.charges[i] < row.charges ? this.cooldown[i] + this.slotCooldown[i] : 0;
  },
  stepActive(id, slot, row, dt) {
    const i = this.index(id, slot), effect = this.effects[row.effect];
    this.elapsed[i] += dt;
    if (row.activation === 'passive') { if (effect.step) effect.step(id, row, slot, dt); return; }
    if (row.activation === 'hold' && !(Actors.buttons[id] & SLOT_BUTTONS[slot])) { this.end(id, slot, 'release'); return; }
    if (!this.drain(id, slot, row, effect, dt)) { this.end(id, slot, 'empty'); return; }
    if (effect.step && effect.step(id, row, slot, dt) === false) { this.end(id, slot, 'done'); return; }
    if (this.activeTime[i] === OPEN_ENDED || !this.active[i]) return;
    this.activeTime[i] -= dt;
    if (this.activeTime[i] <= TICK_EPSILON) this.end(id, slot, 'done');
  },
  // Energy per second while active (effects may change the rate, e.g. only while sprinting) and the fuel tank.
  drain(id, slot, row, effect, dt) {
    const i = this.index(id, slot);
    if (row.resource === 'fuel') { this.fuel[i] -= dt; return this.fuel[i] > 0; }
    if (row.resource !== 'energy') return true;
    const perSecond = effect.drain ? effect.drain(id, row) : row.costPerSecond;
    return perSecond <= 0 || Meters.spendEnergy(id, perSecond * dt);
  },

  // ---- Activation ----
  // A press: turns a running toggle off or cancels a channel; otherwise checks use rules and resources, then casts.
  tryActivate(id, slot) {
    const row = this.row(id, slot), i = this.index(id, slot);
    if (!row) return false;
    if (this.active[i]) {
      if (isCancellable(row)) this.end(id, slot, 'cancel');
      return false;
    }
    if (!this.usable(id, row) || !this.canAfford(id, slot, row)) return false;
    const effect = this.effects[row.effect];
    if (!effect || !effect.cast(id, row, slot)) return false;   // no valid target: nothing is spent
    this.pay(id, slot, row);
    this.begin(id, slot, row);
    return true;
  },
  // Casts a row from the ultimate slot without a press (adrenaline combos): the meter already paid.
  forceCast(id, abilityId) {
    const row = CAT.abilities.byId(abilityId);
    if (!row || !Actors.alive[id] || !this.usable(id, row)) return false;
    this.replaceUltimate(id, row);
    if (!this.effects[row.effect].cast(id, row, SLOT.ULTIMATE)) return false;
    this.begin(id, SLOT.ULTIMATE, row);
    return true;
  },
  // Streak / boost rewards load the ultimate slot for one use; a soul mode keeps that slot for Wrath Form, so none load there.
  grantReward(id, abilityId) {
    const row = CAT.abilities.byId(abilityId);
    if (!row || soulUltimate(SLOT.ULTIMATE)) return false;
    if (!this.rewardLoaded[id]) { this.loadReward(id, row); return true; }
    if (this.rewardsWaiting[id] >= REWARD_QUEUE_SIZE) return false;   // never replaces the loaded one
    this.rewardQueue[id * REWARD_QUEUE_SIZE + this.rewardsWaiting[id]++] = row.index;
    return true;
  },
  loadReward(id, row) {
    this.replaceUltimate(id, row);
    this.reward[id] = 1; this.rewardLoaded[id] = 1;
  },
  // Puts a row in the ultimate slot, ending the one still running there.
  replaceUltimate(id, row) {
    if (this.active[this.index(id, SLOT.ULTIMATE)]) this.end(id, SLOT.ULTIMATE, 'replace');
    this.setSlot(id, SLOT.ULTIMATE, row);
  },
  takeQueuedReward(id) {
    const first = id * REWARD_QUEUE_SIZE, taken = this.rewardQueue[first];
    this.rewardsWaiting[id]--;
    for (let i = 0; i < this.rewardsWaiting[id]; i++) this.rewardQueue[first + i] = this.rewardQueue[first + i + 1];
    return taken;
  },
  usable(id, row) {
    if (Sim.time < this.suppressedUntil[id] || !Actors.alive[id]) return false;
    if (Actors.flags[id] & ABILITY_STUN_FLAGS) return false;
    if (ATTACK_CATEGORIES.includes(row.category) && Gadgets.attackLocked(id)) return false;
    if (row.modes !== 'any' && !modeAllows(row.modes)) return false;
    return !(row.balance.noCarrier && this.carrierCheck && this.carrierCheck(id));
  },
  // ABL-002 resources. The ultimate slot pays with the match meter (ultimate / adrenaline points) or a loaded reward.
  canAfford(id, slot, row) {
    const i = this.index(id, slot);
    if (slot === SLOT.ULTIMATE && this.reward[id]) return true;
    if (slot === SLOT.ULTIMATE && Meters.paysUltimate()) return Meters.points[id] >= ultimateCost(id, row);
    switch (row.resource) {
      case 'cooldown': return this.cooldown[i] <= 0;
      case 'charges': return this.charges[i] > 0;
      case 'energy': return Meters.energy[id] >= Math.max(row.cost, TICK_EPSILON);
      case 'ultimate': return Meters.points[id] >= ultimateCost(id, row);
      case 'fuel': return this.fuel[i] > 0;
      case 'souls': return Powerups.souls[id] >= soulCardFx(id, 'wrathAt', row.cost);   // C09 Dark Pact lowers the cost
      default: return true;
    }
  },
  pay(id, slot, row) {
    const i = this.index(id, slot);
    if (slot === SLOT.ULTIMATE && this.reward[id]) { this.reward[id] = 0; return; }
    if (slot === SLOT.ULTIMATE && Meters.paysUltimate()) { Meters.spendPoints(id, ultimateCost(id, row)); return; }
    if (row.resource === 'cooldown') this.cooldown[i] = this.slotCooldown[i];
    else if (row.resource === 'charges') this.spendCharge(i, row);
    else if (row.resource === 'energy') Meters.spendEnergy(id, row.cost);
    else if (row.resource === 'ultimate') Meters.spendPoints(id, ultimateCost(id, row));
    else if (row.resource === 'souls') Powerups.souls[id] = 0;
  },
  spendCharge(i, row) {
    if (this.charges[i] >= row.charges) this.cooldown[i] = this.slotCooldown[i];
    this.charges[i]--;
  },
  begin(id, slot, row) {
    const i = this.index(id, slot);
    emitAbilityEvent('ability.cast', ABILITY_CAST_EVENT, id, row, slot, '');
    if (row.group) this.endGroup(id, slot, row.group);
    this.elapsed[i] = 0;
    const lasting = row.activation === 'toggle' || row.activation === 'hold' || row.duration > 0;
    if (!lasting) { emitAbilityEvent('ability.end', ABILITY_END_EVENT, id, row, slot, 'done'); this.afterUse(id, slot); return; }
    this.active[i] = 1;
    this.activeTime[i] = row.activation === 'toggle' || row.activation === 'hold' ? OPEN_ENDED : row.duration;
  },
  endGroup(id, slot, group) {
    for (let other = 0; other < ABILITY_SLOT_COUNT; other++) {
      const row = this.row(id, other);
      if (other !== slot && row && row.group === group && this.active[this.index(id, other)]) this.end(id, other, 'group');
    }
  },
  end(id, slot, reason) {
    const i = this.index(id, slot), row = this.row(id, slot);
    if (!row || !this.active[i]) return;
    this.active[i] = 0;
    const effect = this.effects[row.effect];
    if (effect && effect.end) effect.end(id, row, slot, reason);
    emitAbilityEvent('ability.end', ABILITY_END_EVENT, id, row, slot, reason);
    if (row.activation === 'passive' && reason !== 'death' && reason !== 'match' && reason !== 'spawn') this.active[i] = 1;
    this.afterUse(id, slot);
  },
  // A reward ultimate is one use: the slot returns to the kit's ultimate (or empties) once it has run.
  afterUse(id, slot) {
    if (slot !== SLOT.ULTIMATE || !this.rewardLoaded[id] || this.reward[id]) return;
    this.rewardLoaded[id] = 0;
    if (this.rewardsWaiting[id] > 0) this.loadReward(id, CAT.abilities[this.takeQueuedReward(id)]);
    else this.assignKitSlot(id, slot);
  },
  // Ends the abilities the rule names: 'damage' (channels) or 'fire' (cloak).
  interrupt(id, cause) {
    for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) {
      const row = this.row(id, slot);
      if (row && this.active[this.index(id, slot)] && this.interruptRule(row)[cause]) this.end(id, slot, cause);
    }
  },
  suppress(id, seconds) {
    this.suppressedUntil[id] = Math.max(this.suppressedUntil[id], Sim.time + seconds);
    this.endAll(id, 'suppressed');
  },

  // ---- Reading ----
  ready(id, slot) {
    const row = this.row(id, slot);
    return !!row && !this.active[this.index(id, slot)] && this.usable(id, row) && this.canAfford(id, slot, row);
  },
  // A press now does something: the slot is ready, or it is running (a toggle, hold or channel the press ends). The touch buttons show on this.
  hasButton(id, slot) {
    const row = this.row(id, slot);
    return !!row && row.activation !== 'passive' && row.activation !== 'ult';
  },
  pressable(id, slot) {
    const row = this.row(id, slot);
    if (!this.hasButton(id, slot)) return false;
    return (this.active[this.index(id, slot)] === 1 && (isCancellable(row) || row.activation === 'hold')) || this.ready(id, slot);
  },
  // Fills out { slots: [{ id, name, key, ready, cooldown 0..1, charges, active, remaining, color }], meter: { kind, value 0..1, ready } }.
  // The slots array is filled in place (no per-frame allocation); its length changes only with the slot count.
  hudState(id, out) {
    let count = 0;
    for (let slot = 0; slot < HUD_SLOT_COUNT; slot++) {
      const row = id >= 0 ? this.row(id, slot) : null;
      if (row) out.slots[count++] = this.fillHudSlot(this.hudSlots[slot], id, slot, row);
    }
    if (out.slots.length !== count) out.slots.length = count;
    Meters.hudState(id, out.meter);
    return out;
  },
  fillHudSlot(hud, id, slot, row) {
    const i = this.index(id, slot);
    hud.id = row.id; hud.name = row.name; hud.key = ABILITY_SLOT_NAMES[slot]; hud.color = row.color;
    hud.ready = this.ready(id, slot); hud.active = this.active[i] === 1;
    hud.charges = row.resource === 'charges' ? this.charges[i] : 0;
    hud.cooldown = this.slotCooldown[i] > 0 && this.cooldown[i] > 0 ? this.cooldown[i] / this.slotCooldown[i] : 0;
    if (row.resource === 'ultimate' || slot === SLOT.ULTIMATE) hud.cooldown = hud.ready ? 0 : 1 - Meters.fraction(id);
    hud.remaining = hud.active && this.activeTime[i] !== OPEN_ENDED ? this.activeTime[i] : 0;   // ABL-005 visible timer
    return hud;
  },
};

// Toggles and channels end on a second press of their button (tryActivate on an active slot).
function isCancellable(row) { return row.activation === 'toggle' || row.activation === 'channel'; }
function emitAbilityEvent(type, payload, id, row, slot, reason) {
  payload.id = id; payload.ability = row.id; payload.slot = ABILITY_SLOT_NAMES[slot];
  if (type === 'ability.end') payload.reason = reason;
  Bus.emit(type, payload);
}
function kitMatches(kit, rules) {
  const match = kit.match;
  if (match.ruleset) return rules.id === match.ruleset;
  if (match.economy) return Abilities.economyKey() === match.economy;
  if (match.mutator) return !!rules.mutators && rules.mutators.some((entry) => entry.id === match.mutator);
  if (match.abilities) return rules.abilities === match.abilities;
  return false;
}
// rules.family of the match: versus / pve / solo (no match = versus).
function matchFamily() { return currentRules().family || 'versus'; }
function modeAllows(modes) { return modes === matchFamily(); }
// The automatic ultimate of a soul mode: Wrath Form casts itself once the collected PU18 souls pay for it.
function soulUltimate(slot) {
  const params = currentRules().params;
  return slot === SLOT.ULTIMATE && params && params.souls ? SOUL_ULTIMATE : '';
}
function ultimateCost(id, row) { return Meters.ultimateCost(row); }

// Hero pools (HPP05): health / armor / shield per hero instead of the preset's.
Damage.poolOverride = (id, out) => {
  const hero = Abilities.usesHeroes() ? Abilities.pickHero(id) : null;   // runs before this life's onSpawn: read the choice itself
  if (!hero) return;
  out.health = hero.health; out.armor = hero.armor; out.shield = hero.shield;
};

// balance-04: a HERO_KILL_LIMIT_MODES mode in a hero ruleset counts to HERO_KILL_LIMIT_SCALE of its score limit, unless
// the match sets its own (custom editor, Play length, soaks). Runs after the mutators, which may change the economy.
function heroKillLimit(rules, setup) {
  const ownLimit = setup.modeOptions && setup.modeOptions.scoreLimit !== undefined;
  if (ownLimit || Abilities.economyKey(rules) !== 'heroKits' || !HERO_KILL_LIMIT_MODES.includes(rules.mode) || rules.scoreLimit <= 0) return;
  rules.scoreLimit = Math.ceil(rules.scoreLimit * HERO_KILL_LIMIT_SCALE);
}

Bus.on('boot', () => Rules.addModifier('mutators', heroKillLimit));   // Rules (13a) loads after this file
Sim.addSystem('abilities', 20, (dt) => Abilities.step(dt));
Bus.on('actor.create', (id) => { Abilities.choices[id] = null; Abilities.drawn[id] = null; Abilities.hero[id] = null; Abilities.heroMove[id] = 0; Abilities.rechargeScale[id] = 1; Abilities.onSpawn(id); });
Bus.on('actor.spawn', (event) => Abilities.onSpawn(event.id));
Bus.on('power.pick', (event) => Abilities.onPowerPick(event));
Bus.on('kill', (event) => Abilities.clearActor(event.victim, 'death'));
Bus.on('damage', (event) => { if (event.amount > 0 && event.source !== event.target) Abilities.interrupt(event.target, 'damage'); });
Bus.on('weapon.fire', (event) => Abilities.interrupt(event.id, 'fire'));
Bus.on('match.end', () => Abilities.clearMatch());
Bus.on('match.stop', () => Abilities.clearMatch());
Bus.on('match.start', () => AbilityZones.clear());
Bus.on('round', (event) => { if (event.phase === 'start') AbilityZones.clear(); });
// The touch ability buttons (P5-01): A1 and A2 stay on screen while the kit has a pressable ability in the slot and are dimmed
// (TouchInput.ready: a tap does nothing) while it cannot be used now (cooldown, stun, suppression, no energy, carrying the flag); ULT shows
// only once it is ready. The HUD rings keep showing the cooldowns; a passive or automatic ('ult': Wrath Form casts itself) row has nothing to press.
for (const [need, slot] of [['ability1', SLOT.ABILITY1], ['ability2', SLOT.ABILITY2]]) {
  TouchInput.needs[need] = () => Game.playerId >= 0 && Abilities.hasButton(Game.playerId, slot);
  TouchInput.ready[need] = () => Abilities.pressable(Game.playerId, slot);
}
TouchInput.needs.ultimate = () => Game.playerId >= 0 && Abilities.pressable(Game.playerId, SLOT.ULTIMATE);
