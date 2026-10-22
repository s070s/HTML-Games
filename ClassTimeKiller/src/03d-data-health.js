// ==== S03 DATA: HEALTH, PRECISION, STATUS EFFECTS ====
// Health presets HPP01..HPP09 (spec §7), precision profiles (HP-002 zone multipliers),
// status effects (HP-005), elements (HP-006) and damage kinds (what each damage.request kind bypasses).

// armorMode: 'absorb' (armor takes armorAbsorb of each hit, rounded up), 'tactical' (HPP04 armorPen split),
// 'flat' (HPP05: -armorFlat per hit, at most armorFlatMax of the hit, not on beams/DoT), 'none'.
// regenSteps > 1: health regenerates only up to the next step (HPP03 thirds). shieldIgnoresZone: head multiplier only on health.
Data.define('health', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, health: 100, maxHealth: 100, overhealCap: 100, overhealDecay: 0,
  armor: 0, armorCap: 0, armorDecayAbove: 0, armorDecay: 0, armorMode: 'none', armorAbsorb: 0, armorFlat: 0, armorFlatMax: 0, helmet: false,
  shield: 0, shieldCap: 0, shieldDelay: 0, shieldRate: 0, shieldIgnoresZone: false,
  regenDelay: 0, regenRate: 0, regenSteps: 1, roleRegen: null, energy: null, downed: false, limbs: false,
}, [
  { id: 'stack', code: 'HPP01', name: 'Arena Stack', overhealCap: 200, overhealDecay: 1, armorCap: 200, armorDecayAbove: 100, armorDecay: 1, armorMode: 'absorb', armorAbsorb: 2 / 3 },
  { id: 'regen', code: 'HPP02', name: 'Regenerating', regenDelay: 5, regenRate: 25 },
  { id: 'shield', code: 'HPP03', name: 'Shield over Health', health: 50, maxHealth: 50, overhealCap: 50, shield: 70, shieldCap: 70, shieldDelay: 5, shieldRate: 17.5, shieldIgnoresZone: true, regenDelay: 8, regenRate: 25, regenSteps: 3 },
  { id: 'tactical', code: 'HPP04', name: 'Tactical One-Life', armorCap: 100, armorMode: 'tactical', helmet: false },
  { id: 'hero', code: 'HPP05', name: 'Hero Pools', health: 200, maxHealth: 200, overhealCap: 200, armorMode: 'flat', armorFlat: 5, armorFlatMax: 0.5, shieldDelay: 3, shieldRate: 30, roleRegen: { role: 'support', delay: 1.5, rate: 15 } },
  { id: 'loot', code: 'HPP06', name: 'Loot Shields', shieldCap: 125, downed: true },
  { id: 'ravager', code: 'HPP07', name: 'Ravager Triangle', overhealCap: 200, armorCap: 150, armorMode: 'absorb', armorAbsorb: 0.5 },
  { id: 'suit', code: 'HPP08', name: 'Weave Suit', regenDelay: 6, regenRate: 20, energy: { max: 100, rate: 25, delay: 2 } },
  { id: 'limb', code: 'HPP09', name: 'Locational', limbs: true },
]);

// HP-002 precision profiles (hit zone multipliers). Movement inaccuracy (MOV-025) is the movement preset's table (S10 Move.inaccuracy).
Data.define('precision', {
  id: REQUIRED, name: REQUIRED, head: 0, pistolHead: 0, precisionHead: 0, stomach: 1, legs: 0, arenaHead: false,
}, [
  { id: 'arena', name: 'Arena', head: 1, legs: 1, arenaHead: true },
  { id: 'standard', name: 'Standard' },
  { id: 'tactical', name: 'Tactical', head: 4, pistolHead: 3.9, stomach: 1.25, legs: 0.75 },
  { id: 'hero', name: 'Hero', head: 1, precisionHead: 2, legs: 1 },
]);

// HP-005 status effects (one stack table). dps ticks every tickSeconds; speed multiplies movement; stun blocks moving and firing.
// stacksTo + becomes: reaching that many stacks turns the effect into another one (3 Chill = Freeze).
Data.define('statusEffects', {
  id: REQUIRED, name: REQUIRED, seconds: REQUIRED, dps: 0, tickSeconds: 0.5, speed: 1, stun: false, maxStacks: 1, stacksTo: 0, becomes: '',
  bypassArmor: false, bypassShield: false, wakeOnDamage: false, shatter: 0, element: 'kinetic', fx: '', color: 0xffffff, index: 0,
}, [
  { id: 'burn', name: 'Burn', seconds: 4, dps: 10, element: 'thermal', fx: 'fire', color: 0xff7a2a },
  { id: 'chill', name: 'Chill', seconds: 4, speed: 0.6, maxStacks: 3, stacksTo: 3, becomes: 'freeze', element: 'cryo', fx: 'frost', color: 0x9fd8ff },
  { id: 'freeze', name: 'Freeze', seconds: 3, speed: 0, stun: true, shatter: 3, element: 'cryo', fx: 'frost', color: 0xd8f4ff },
  { id: 'shock', name: 'Shock', seconds: 0.5, speed: 0, stun: true, element: 'arc', fx: 'shock', color: 0xfff27a },
  { id: 'bleed', name: 'Bleed', seconds: 6, dps: 5, bypassArmor: true, fx: 'blood', color: 0xc02020 },
  { id: 'toxin', name: 'Toxin', seconds: 5, dps: 6, bypassShield: true, element: 'toxin', fx: 'smoke', color: 0x7fe04a },
  { id: 'blind', name: 'Blind', seconds: 3.5, color: 0xffffff },
  { id: 'sleep', name: 'Sleep', seconds: 8, speed: 0, stun: true, wakeOnDamage: true, color: 0x8080ff },
  { id: 'slow', name: 'Slowed', seconds: 1, speed: 0.8, color: 0x6080a0 },
  { id: 'reveal', name: 'Revealed', seconds: 5, color: 0xffd040 },
]);

// HP-006 elements; matching element vs a coloured PvE shield x1.5, other elements x0.75 (NPC-004).
const ELEMENT_MATCH_FACTOR = 1.5;
const ELEMENT_MISMATCH_FACTOR = 0.75;
Data.define('elements', { id: REQUIRED, name: REQUIRED, color: 0xffffff, fx: 'spark' }, [
  { id: 'kinetic', name: 'Kinetic', color: 0xd0d0d0, fx: 'spark' },
  { id: 'thermal', name: 'Thermal', color: 0xff7a2a, fx: 'fire' },
  { id: 'cryo', name: 'Cryo', color: 0x9fd8ff, fx: 'frost' },
  { id: 'arc', name: 'Arc', color: 0xfff27a, fx: 'shock' },
  { id: 'toxin', name: 'Toxin', color: 0x7fe04a, fx: 'smoke' },
  { id: 'void', name: 'Void', color: 0x9c7bff, fx: 'energy' },
]);

// Damage kinds: weapon hits plus the damage.request kinds (fall/hazard/telefrag/crush/drown) other sections send.
// selfScale: own damage of this kind is scaled by rules.selfDamage (HP-003 own splash and the burns it leaves).
Data.define('damageKinds', {
  id: REQUIRED, bypassShield: false, bypassArmor: false, lethal: false, flatArmor: true, selfScale: false, friendly: true,
}, [
  { id: 'hit' }, { id: 'melee' }, { id: 'splash', selfScale: true }, { id: 'beam', flatArmor: false }, { id: 'dot', flatArmor: false, selfScale: true },
  { id: 'self', friendly: false }, { id: 'fall', bypassShield: true, bypassArmor: true, flatArmor: false, friendly: false },
  { id: 'hazard', flatArmor: false, friendly: false }, { id: 'drown', bypassArmor: true, flatArmor: false, friendly: false },
  { id: 'telefrag', lethal: true, bypassShield: true, bypassArmor: true, friendly: false },
  { id: 'crush', lethal: true, bypassShield: true, bypassArmor: true, friendly: false },
]);
