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
const OPEN_ENDED = -1;                    // activeTime of toggles and holds: they run until turned off
const DEFAULT_INTERRUPT = Object.freeze({ damage: false, stun: true, fire: false });
const ABILITY_STUN_FLAGS = ACTOR_FLAG.FROZEN | ACTOR_FLAG.DOWNED;
const HUD_SLOT_COUNT = 3;                  // the passive slot is not drawn as a button
const ABILITY_CAST_EVENT = { id: 0, ability: '', slot: '' };
const ABILITY_END_EVENT = { id: 0, ability: '', slot: '', reason: '' };

function makeHudSlot() { return { id: '', name: '', key: '', ready: false, cooldown: 0, charges: 0, active: false, remaining: 0, color: 0xffffff }; }

const Abilities = {
  slotAbility: new Int16Array(MAX_ACTORS * ABILITY_SLOT_COUNT).fill(NO_ABILITY),
  cooldown: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT),     // seconds until ready (charges: until the next charge)
  charges: new Uint8Array(MAX_ACTORS * ABILITY_SLOT_COUNT),
  active: new Uint8Array(MAX_ACTORS * ABILITY_SLOT_COUNT),
  activeTime: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT),   // seconds left of the active window (OPEN_ENDED for toggles/holds)
  elapsed: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT),      // seconds since the cast
  fuel: new Float32Array(MAX_ACTORS * ABILITY_SLOT_COUNT),         // 'fuel' resource seconds left
  reward: new Uint8Array(MAX_ACTORS),                              // streak / boost reward loaded into the ultimate slot
  suppressedUntil: new Float64Array(MAX_ACTORS),                   // G20 null pulse: no abilities until this Sim.time
  rechargeScale: new Float32Array(MAX_ACTORS).fill(1),             // cooldown speed (Tune Up perk writes it)
  hero: new Array(MAX_ACTORS).fill(null),                          // hero row of this life (hero rulesets)
  choices: new Array(MAX_ACTORS).fill(null),                       // loadout choice { hero, ability1, ability2, ultimate } or null
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
  economyKey() { const rules = currentRules(); return (rules.params && rules.params.economy) || rules.economy || ''; },
  usesHeroes() { return this.economyKey() === 'heroKits'; },
  // The hero chosen for the actor (loadout choice, bot profile, or a role spread by actor id), cached per life.
  pickHero(id) {
    const choice = this.choices[id], profile = Actors.profile[id];
    const wanted = (choice && choice.hero) || (profile && profile.hero) || '';
    return CAT.heroes.byId(wanted) || CAT.heroes[id % CAT.heroes.length];
  },
  heroOf(id) { return this.usesHeroes() ? this.hero[id] || this.pickHero(id) : null; },
  kitOf(id) {
    if (this.usesHeroes()) return this.heroOf(id);
    const rules = currentRules();
    for (const kit of CAT.abilityKits) if (kitMatches(kit, rules)) return kit;
    return null;
  },
  setChoice(id, choice) { this.choices[id] = choice ? Object.assign({}, choice) : null; },
  // The ability id for one slot: an allowed loadout choice, else the kit default.
  kitAbility(id, kit, slotName) {
    const choice = this.choices[id], wanted = choice ? choice[slotName] : '';
    const allowed = kit.choices && kit.choices[slotName];
    if (wanted && allowed && allowed.includes(wanted)) return wanted;
    return kit[slotName] || '';
  },
  assignSlots(id) {
    const kit = this.kitOf(id);
    for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) {
      const key = kit ? this.kitAbility(id, kit, ABILITY_SLOT_NAMES[slot]) : '';
      const row = key ? CAT.abilities.byId(key) : null;
      this.setSlot(id, slot, row);
    }
    if (kit && kit.passive && kit.passive.kind === 'ability') this.setSlot(id, SLOT.PASSIVE, CAT.abilities.byId(kit.passive.ability));
    Meters.fillSlots(id);
  },
  setSlot(id, slot, row) {
    const i = this.index(id, slot);
    this.slotAbility[i] = row ? row.index : NO_ABILITY;
    this.cooldown[i] = 0; this.active[i] = 0; this.activeTime[i] = 0; this.elapsed[i] = 0;
    this.charges[i] = row ? Math.max(1, row.charges) : 0;
    this.fuel[i] = row ? row.duration : 0;
    if (row && row.activation === 'passive') this.active[i] = 1;
  },

  // ---- Life cycle ----
  onSpawn(id) {
    this.endAll(id, 'spawn');
    this.reward[id] = 0;
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
  },
  // Respawn-in-place kit change (hero switch in the spawn room): pools, weapons, movement and slots of the new hero.
  refreshKit(id) {
    Damage.resetHealth(id);
    this.onSpawn(id);
  },
  endAll(id, reason) {
    for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot++) if (this.active[this.index(id, slot)]) this.end(id, slot, reason);
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
      if (this.active[i]) this.stepActive(id, slot, row, dt);
      else if (!stunned) this.readInput(id, slot, row);
    }
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
  // One charge at a time refills in row.cooldown seconds (spec "3 charges, 3 s each").
  rechargeCharge(i, row, dt) {
    if (this.charges[i] >= row.charges || row.cooldown <= 0) return;
    this.cooldown[i] -= dt;
    if (this.cooldown[i] > TICK_EPSILON) return;
    this.charges[i]++;
    this.cooldown[i] = this.charges[i] < row.charges ? this.cooldown[i] + row.cooldown : 0;
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
      if (row.activation === 'toggle' || row.activation === 'channel') this.end(id, slot, 'cancel');
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
    if (this.active[this.index(id, SLOT.ULTIMATE)]) this.end(id, SLOT.ULTIMATE, 'replace');
    this.setSlot(id, SLOT.ULTIMATE, row);
    if (!this.effects[row.effect].cast(id, row, SLOT.ULTIMATE)) return false;
    this.begin(id, SLOT.ULTIMATE, row);
    return true;
  },
  // Streak / boost rewards load the ultimate slot for one use.
  grantReward(id, abilityId) {
    const row = CAT.abilities.byId(abilityId);
    if (!row) return false;
    if (this.active[this.index(id, SLOT.ULTIMATE)]) this.end(id, SLOT.ULTIMATE, 'replace');
    this.setSlot(id, SLOT.ULTIMATE, row);
    this.reward[id] = 1;
    return true;
  },
  usable(id, row) {
    if (Sim.time < this.suppressedUntil[id] || !Actors.alive[id]) return false;
    if (Actors.flags[id] & ABILITY_STUN_FLAGS) return false;
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
      case 'souls': return Meters.souls[id] >= row.cost;
      default: return true;
    }
  },
  pay(id, slot, row) {
    const i = this.index(id, slot);
    if (slot === SLOT.ULTIMATE && this.reward[id]) { this.reward[id] = 0; return; }
    if (slot === SLOT.ULTIMATE && Meters.paysUltimate()) { Meters.spendPoints(id, ultimateCost(id, row)); return; }
    if (row.resource === 'cooldown') this.cooldown[i] = row.cooldown;
    else if (row.resource === 'charges') this.spendCharge(i, row);
    else if (row.resource === 'energy') Meters.spendEnergy(id, row.cost);
    else if (row.resource === 'ultimate') Meters.spendPoints(id, ultimateCost(id, row));
    else if (row.resource === 'souls') Meters.souls[id] = 0;
  },
  spendCharge(i, row) {
    if (this.charges[i] >= row.charges) this.cooldown[i] = row.cooldown;
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
    if (slot !== SLOT.ULTIMATE || Meters.paysUltimate() || this.reward[id]) return;
    const row = this.row(id, slot);
    if (row && row.category === 'reward') this.setSlot(id, slot, null);
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
  // Fills out { slots: [{ id, name, key, ready, cooldown 0..1, charges, active, remaining, color }], meter: { kind, value 0..1, ready } }.
  hudState(id, out) {
    out.slots.length = 0;
    for (let slot = 0; slot < HUD_SLOT_COUNT; slot++) {
      const row = id >= 0 ? this.row(id, slot) : null;
      if (row) out.slots.push(this.fillHudSlot(this.hudSlots[slot], id, slot, row));
    }
    return Meters.hudState(id, out.meter);
  },
  fillHudSlot(hud, id, slot, row) {
    const i = this.index(id, slot);
    hud.id = row.id; hud.name = row.name; hud.key = ABILITY_SLOT_NAMES[slot]; hud.color = row.color;
    hud.ready = this.ready(id, slot); hud.active = this.active[i] === 1;
    hud.charges = row.resource === 'charges' ? this.charges[i] : 0;
    hud.cooldown = row.cooldown > 0 && this.cooldown[i] > 0 ? this.cooldown[i] / row.cooldown : 0;
    if (row.resource === 'ultimate' || slot === SLOT.ULTIMATE) hud.cooldown = hud.ready ? 0 : 1 - Meters.fraction(id);
    hud.remaining = hud.active && this.activeTime[i] !== OPEN_ENDED ? this.activeTime[i] : 0;   // ABL-005 visible timer
    return hud;
  },
};

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
  return false;
}
// rules.family of the match: versus / pve / solo (no match = versus).
function matchFamily() { return currentRules().family || 'versus'; }
function modeAllows(modes) { return modes === matchFamily(); }
function ultimateCost(id, row) { return Meters.ultimateCost(row); }

// Hero pools (HPP05): health / armor / shield per hero instead of the preset's.
Damage.poolOverride = (id, out) => {
  const hero = Abilities.usesHeroes() ? Abilities.hero[id] || Abilities.pickHero(id) : null;
  if (!hero) return;
  out.health = hero.health; out.armor = hero.armor; out.shield = hero.shield;
};

Sim.addSystem('abilities', 20, (dt) => Abilities.step(dt));
Bus.on('actor.create', (id) => { Abilities.choices[id] = null; Abilities.hero[id] = null; Abilities.heroMove[id] = 0; Abilities.rechargeScale[id] = 1; Abilities.onSpawn(id); });
Bus.on('actor.spawn', (event) => Abilities.onSpawn(event.id));
Bus.on('kill', (event) => Abilities.clearActor(event.victim, 'death'));
Bus.on('damage', (event) => { if (event.amount > 0 && event.source !== event.target) Abilities.interrupt(event.target, 'damage'); });
Bus.on('weapon.fire', (event) => Abilities.interrupt(event.id, 'fire'));
Bus.on('match.end', () => Abilities.clearMatch());
Bus.on('match.stop', () => Abilities.clearMatch());
Bus.on('match.start', () => AbilityZones.clear());
