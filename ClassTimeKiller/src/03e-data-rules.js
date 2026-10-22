// Rule bundles RS01..RS12 (MOV-001, spec section 6.1). A bundle names one preset per area; Rules.build (S13)
// applies only the fields a bundle row writes on top of the mode defaults, so a bundle never undoes a mode rule
// it does not mention (for example the lives of Last Standing).
// moveOverrides: fields laid over the movement preset row (RS02 adds one extra jump and the wall dodge).

const RULESET_ROWS = [
  { id: 'classic', code: 'RS01', name: 'Arena Classic', move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'arenaSet', meter: 'none' },
  { id: 'tourney', code: 'RS02', name: 'Arena Tournament', move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'arenaSet', meter: 'adrenaline', moveOverrides: { extraJumps: 1, wallDodge: true } },
  { id: 'tactical', code: 'RS03', name: 'Tactical Breach', move: 'tactical', health: 'tactical', economy: 'roundBuy', precision: 'tactical', weaponSet: 'tacticalSet', meter: 'none' },
  { id: 'modern', code: 'RS04', name: 'Modern Ops', move: 'modern', health: 'regen', economy: 'classes', precision: 'standard', weaponSet: 'militarySet', meter: 'streak' },
  { id: 'pilot', code: 'RS05', name: 'Pilot Rush', move: 'agile', health: 'regen', economy: 'classes', precision: 'standard', weaponSet: 'militarySet', meter: 'boost' },
  { id: 'vanguard', code: 'RS06', name: 'Shield Wars', move: 'vanguard', health: 'shield', economy: 'pickups', precision: 'standard', weaponSet: 'sandboxSet', meter: 'none' },
  { id: 'ravager', code: 'RS07', name: 'Ravager', move: 'ravager', health: 'ravager', economy: 'pickups', precision: 'standard', weaponSet: 'ravagerSet', meter: 'none' },
  { id: 'knight', code: 'RS08', name: 'Iron Bulwark', move: 'knight', health: 'ravager', economy: 'pickups', precision: 'standard', weaponSet: 'knightSet', meter: 'none' },
  // Heroes move and arm per hero (hero rows override move and loadout); the bundle keeps a neutral fallback.
  { id: 'heroes', code: 'RS09', name: 'Hero Squad', move: 'modern', health: 'hero', economy: 'heroKits', precision: 'hero', weaponSet: '', meter: 'ultimate' },
  { id: 'royale', code: 'RS10', name: 'Last Ring', move: 'agile', health: 'loot', economy: 'loot', precision: 'standard', weaponSet: 'lootSet', meter: 'none' },
  { id: 'suit', code: 'RS11', name: 'Weave Suit', move: 'modern', health: 'suit', economy: 'pickups', precision: 'standard', weaponSet: 'militarySet', meter: 'energy' },
  { id: 'frame', code: 'RS12', name: 'Frame Runner', move: 'parkour', health: 'shield', economy: 'classes', precision: 'standard', weaponSet: 'exoticSet', meter: 'energy' },
];

// Ruleset schema (spec section 4). Defaults are what a match uses when neither the mode nor the bundle sets a field.
Data.define('rulesets', {
  id: REQUIRED, code: '', name: REQUIRED, move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'arenaSet',
  meter: 'none', friendlyFire: 0, selfDamage: 0.5, knockback: 1, gravityScale: 1, respawn: { delay: 2, forced: 10, protect: 2, wave: 0 },
  lives: 0, itemRespawnScale: 1, weaponStay: false, dropOnDeath: 'held', mutators: [], moveOverrides: {},
}, RULESET_ROWS);
