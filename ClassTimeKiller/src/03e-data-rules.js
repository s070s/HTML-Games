// Rule bundles RS01..RS12 (MOV-001, spec section 6.1). A bundle names one preset per area; Rules.build (S13)
// applies only the fields a bundle row writes on top of the mode defaults, so a bundle never undoes a mode rule
// it does not mention (for example the lives of Last Standing).
// moveOverrides: fields laid over the movement preset row (RS02 adds one extra jump and the wall dodge).
// downed: in team matches a teammate at 0 HP goes down (HP-007) instead of dying while an ally still stands (squad rulesets).
// items: false removes the map's pickups. editor: the custom match editor's own settings of a saved preset (mode, map, bots, limits); the build ignores it.
// knockback: the hitscan rulesets push a quarter as far, so a few SMG hits never shove a target out of the spray (R-097);
// arena, tournament, Ravager and Iron Bulwark keep the full arena push.
// weaponSet (P3-01): every ruleset arms from the whole roster ('fullSet'); the themed sets are presets of the weapon-set mutator X10 and
// the custom editor, no longer ruleset locks. Last Ring (RS10) uses 'lootSet', the same pool with rarity; heroes carry their own guns.
// melee: the melee weapon the ruleset spawns with when the player has not picked another (the start melee of its former weapon set).
// carry: most guns held besides melee (null = the weapon set's own, 0 there = one of every gun); the buy and class rulesets keep 2.
// ammoTiers: true = primary-tier reserves never run out (null = the set's own). abilities (P3-01): 'none' = no abilities (a mutator X46
// can switch the loadout on), 'kit' = the ruleset's own kit (hero kits, Weave Suit, the class field upgrade), 'loadout' = the player picks
// an ability and an ultimate (ability kit 'loadout', or the ruleset's own picks as in Frame Runner). Those rulesets run the 'ultimate' meter
// (RS06, RS07, RS08, RS10), the meter that pays an ultimate; with meter 'none' an ultimate would cost nothing.
const HITSCAN_KNOCKBACK = 0.25;
// hitKnockback scales only the push a hit gives another actor (S11), not own blasts, leaps or ability motion. Hero Squad hits push
// half as far: a hero pool (200-650) soaks two to six times the damage of a 100 HP body, so at full push a duel near an open
// edge shoved the target off before it went down (hazard-01: 57-65% of Skyward Yard kills were falls; 19% now).
const HERO_KNOCKBACK = 0.5;

const RULESET_ROWS = [
  { id: 'classic', code: 'RS01', name: 'Arena Classic', move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'fullSet', melee: 'maul', meter: 'none', abilities: 'none' },
  { id: 'tourney', code: 'RS02', name: 'Arena Tournament', move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'fullSet', melee: 'maul', meter: 'adrenaline', abilities: 'none', moveOverrides: { extraJumps: 1, wallDodge: true } },
  { id: 'tactical', code: 'RS03', name: 'Tactical Breach', move: 'tactical', health: 'tactical', economy: 'roundBuy', precision: 'tactical', weaponSet: 'fullSet', melee: 'tanto', carry: 2, meter: 'none', abilities: 'none', knockback: HITSCAN_KNOCKBACK },
  { id: 'modern', code: 'RS04', name: 'Modern Ops', move: 'modern', health: 'regen', economy: 'classes', precision: 'standard', weaponSet: 'fullSet', melee: 'tanto', carry: 2, meter: 'streak', abilities: 'kit', knockback: HITSCAN_KNOCKBACK, downed: true },
  { id: 'pilot', code: 'RS05', name: 'Pilot Rush', move: 'agile', health: 'regen', economy: 'classes', precision: 'standard', weaponSet: 'fullSet', melee: 'tanto', carry: 2, meter: 'boost', abilities: 'kit', knockback: HITSCAN_KNOCKBACK, downed: true },
  { id: 'vanguard', code: 'RS06', name: 'Shield Wars', move: 'vanguard', health: 'shield', economy: 'pickups', precision: 'standard', weaponSet: 'fullSet', melee: 'tanto', meter: 'ultimate', abilities: 'loadout' },
  { id: 'ravager', code: 'RS07', name: 'Ravager', move: 'ravager', health: 'ravager', economy: 'pickups', precision: 'standard', weaponSet: 'fullSet', melee: 'maul', meter: 'ultimate', abilities: 'loadout' },
  { id: 'knight', code: 'RS08', name: 'Iron Bulwark', move: 'knight', health: 'ravager', economy: 'pickups', precision: 'standard', weaponSet: 'fullSet', melee: 'bulwark', meter: 'ultimate', abilities: 'loadout' },
  // Heroes move and arm per hero (hero rows override move and loadout); the bundle keeps a neutral fallback.
  { id: 'heroes', code: 'RS09', name: 'Hero Squad', move: 'modern', health: 'hero', economy: 'heroKits', precision: 'hero', weaponSet: '', meter: 'ultimate', abilities: 'kit', downed: true, hitKnockback: HERO_KNOCKBACK },
  { id: 'royale', code: 'RS10', name: 'Last Ring', move: 'agile', health: 'loot', economy: 'loot', precision: 'standard', weaponSet: 'lootSet', meter: 'ultimate', abilities: 'loadout', knockback: HITSCAN_KNOCKBACK },
  { id: 'suit', code: 'RS11', name: 'Weave Suit', move: 'modern', health: 'suit', economy: 'pickups', precision: 'standard', weaponSet: 'fullSet', melee: 'tanto', meter: 'energy', abilities: 'kit', knockback: HITSCAN_KNOCKBACK },
  { id: 'frame', code: 'RS12', name: 'Frame Runner', move: 'parkour', health: 'shield', economy: 'classes', precision: 'standard', weaponSet: 'fullSet', melee: 'tanto', ammoTiers: true, meter: 'energy', abilities: 'loadout', downed: true },
];

// Ruleset schema (spec section 4). Defaults are what a match uses when neither the mode nor the bundle sets a field.
Data.define('rulesets', {
  id: REQUIRED, code: '', name: REQUIRED, move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'fullSet',
  melee: '', carry: null, ammoTiers: null, abilities: 'none', meter: 'none', friendlyFire: 0, selfDamage: 0.5, knockback: 1, hitKnockback: 1, gravityScale: 1, respawn: { delay: 2, forced: 10, protect: 2, wave: 0 },
  lives: 0, itemRespawnScale: 1, weaponStay: false, dropOnDeath: 'held', mutators: [], moveOverrides: {}, items: true, downed: false, editor: null,
}, RULESET_ROWS);
