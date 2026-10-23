// Rule bundles RS01..RS12 (MOV-001, spec section 6.1). A bundle names one preset per area; Rules.build (S13)
// applies only the fields a bundle row writes on top of the mode defaults, so a bundle never undoes a mode rule
// it does not mention (for example the lives of Last Standing).
// moveOverrides: fields laid over the movement preset row (RS02 adds one extra jump and the wall dodge).
// downed: in team matches a teammate at 0 HP goes down (HP-007) instead of dying while an ally still stands (squad rulesets).
// items: false removes the map's pickups. editor: the custom match editor's own settings of a saved preset (mode, map, bots, limits); the build ignores it.
// knockback: the hitscan rulesets push a quarter as far, so a few SMG hits never shove a target out of the spray (R-097);
// arena, tournament, Ravager and Iron Bulwark keep the full arena push.
const HITSCAN_KNOCKBACK = 0.25;
// hitKnockback scales only the push a hit gives another actor (S11), not own blasts, leaps or ability motion. Hero Squad hits push
// half as far: a hero pool (200-650) soaks two to six times the damage of a 100 HP body, so at full push a duel near an open
// edge shoved the target off before it went down (hazard-01: 57-65% of Skyward Yard kills were falls; 19% now).
const HERO_KNOCKBACK = 0.5;

const RULESET_ROWS = [
  { id: 'classic', code: 'RS01', name: 'Arena Classic', move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'arenaSet', meter: 'none' },
  { id: 'tourney', code: 'RS02', name: 'Arena Tournament', move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'arenaSet', meter: 'adrenaline', moveOverrides: { extraJumps: 1, wallDodge: true } },
  { id: 'tactical', code: 'RS03', name: 'Tactical Breach', move: 'tactical', health: 'tactical', economy: 'roundBuy', precision: 'tactical', weaponSet: 'tacticalSet', meter: 'none', knockback: HITSCAN_KNOCKBACK },
  { id: 'modern', code: 'RS04', name: 'Modern Ops', move: 'modern', health: 'regen', economy: 'classes', precision: 'standard', weaponSet: 'militarySet', meter: 'streak', knockback: HITSCAN_KNOCKBACK, downed: true },
  { id: 'pilot', code: 'RS05', name: 'Pilot Rush', move: 'agile', health: 'regen', economy: 'classes', precision: 'standard', weaponSet: 'militarySet', meter: 'boost', knockback: HITSCAN_KNOCKBACK, downed: true },
  { id: 'vanguard', code: 'RS06', name: 'Shield Wars', move: 'vanguard', health: 'shield', economy: 'pickups', precision: 'standard', weaponSet: 'sandboxSet', meter: 'none' },
  { id: 'ravager', code: 'RS07', name: 'Ravager', move: 'ravager', health: 'ravager', economy: 'pickups', precision: 'standard', weaponSet: 'ravagerSet', meter: 'none' },
  { id: 'knight', code: 'RS08', name: 'Iron Bulwark', move: 'knight', health: 'ravager', economy: 'pickups', precision: 'standard', weaponSet: 'knightSet', meter: 'none' },
  // Heroes move and arm per hero (hero rows override move and loadout); the bundle keeps a neutral fallback.
  { id: 'heroes', code: 'RS09', name: 'Hero Squad', move: 'modern', health: 'hero', economy: 'heroKits', precision: 'hero', weaponSet: '', meter: 'ultimate', downed: true, hitKnockback: HERO_KNOCKBACK },
  { id: 'royale', code: 'RS10', name: 'Last Ring', move: 'agile', health: 'loot', economy: 'loot', precision: 'standard', weaponSet: 'lootSet', meter: 'none', knockback: HITSCAN_KNOCKBACK },
  { id: 'suit', code: 'RS11', name: 'Weave Suit', move: 'modern', health: 'suit', economy: 'pickups', precision: 'standard', weaponSet: 'militarySet', meter: 'energy', knockback: HITSCAN_KNOCKBACK },
  { id: 'frame', code: 'RS12', name: 'Frame Runner', move: 'parkour', health: 'shield', economy: 'classes', precision: 'standard', weaponSet: 'exoticSet', meter: 'energy', downed: true },
];

// Ruleset schema (spec section 4). Defaults are what a match uses when neither the mode nor the bundle sets a field.
Data.define('rulesets', {
  id: REQUIRED, code: '', name: REQUIRED, move: 'arena', health: 'stack', economy: 'pickups', precision: 'arena', weaponSet: 'arenaSet',
  meter: 'none', friendlyFire: 0, selfDamage: 0.5, knockback: 1, hitKnockback: 1, gravityScale: 1, respawn: { delay: 2, forced: 10, protect: 2, wave: 0 },
  lives: 0, itemRespawnScale: 1, weaponStay: false, dropOnDeath: 'held', mutators: [], moveOverrides: {}, items: true, downed: false, editor: null,
}, RULESET_ROWS);
