// ==== S03 DATA: ITEMS AND POWERUPS ====
// Pickups I01..I17 and powerups PU01..PU20 (spec section 11, PWR-001..PWR-003). Map item keys (docs/api/maps.md) are the
// row ids: plain pickups use the map contract keys (healthvial ... ammocache), powerups the spec backtick keys.

// effect (generic handlers in 12a): 'health' (+amount up to the cap), 'armor' (+amount up to the cap), 'ammoType' (the held
// weapon's ammo type, weapon-sized), 'ammoAll' (every owned weapon + amount x its max ammo), 'weapon' (the rules of weapon
// spots), 'helmet' / 'vest' (bought), 'consume' (loot consumable carried up to `stack`, used over `useTime`).
// cap: the HP / armor the item fills to; overheal: the cap may pass the normal maximum (up to the preset's overheal cap).
// restores ('consume'): 'health' | 'shield' | 'overflow' (health first, the rest into the shield); amount 0 = to full.
Data.define('items', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, group: REQUIRED, effect: REQUIRED, amount: 0, cap: 0, overheal: false,
  respawn: 0, respawnTeams: 0, respawnPower: 0, useTime: 0, stack: 0, restores: '', shape: 'box', size: 0.5, color: 0xffffff, index: 0,
}, [
  { id: 'healthvial', code: 'I01', name: 'Health Vial', group: 'health', effect: 'health', amount: 5, cap: 200, overheal: true, respawn: 35, shape: 'cylinder', size: 0.3, color: 0x7dffa8 },
  { id: 'healthpack', code: 'I02', name: 'Health Pack', group: 'health', effect: 'health', amount: 25, cap: 100, respawn: 35, size: 0.5, color: 0x3fd870 },
  { id: 'healthcrate', code: 'I03', name: 'Health Crate', group: 'health', effect: 'health', amount: 50, cap: 100, respawn: 35, size: 0.7, color: 0x2fc060 },
  { id: 'megacell', code: 'I04', name: 'Mega Cell', group: 'health', effect: 'health', amount: 100, cap: 200, overheal: true, respawn: 35, shape: 'sphere', size: 0.8, color: 0x40a0ff },
  { id: 'armorshard', code: 'I05', name: 'Armor Shard', group: 'armor', effect: 'armor', amount: 5, cap: 200, respawn: 25, shape: 'cone', size: 0.3, color: 0xffd060 },
  { id: 'lightplate', code: 'I06', name: 'Light Plate', group: 'armor', effect: 'armor', amount: 50, cap: 200, respawn: 25, shape: 'wedge', size: 0.6, color: 0x9ad04a },
  { id: 'heavyplate', code: 'I07', name: 'Heavy Plate', group: 'armor', effect: 'armor', amount: 100, cap: 200, respawn: 25, shape: 'wedge', size: 0.8, color: 0xff6a3a },
  { id: 'ammobox', code: 'I08', name: 'Ammo Box', group: 'ammo', effect: 'ammoType', respawn: 25, size: 0.45, color: 0xc8b070 },
  { id: 'ammocache', code: 'I09', name: 'Ammo Cache', group: 'ammo', effect: 'ammoAll', amount: 0.5, respawn: 40, size: 0.7, color: 0xa89050 },
  // Weapon spots (WPN-009): 5 s in free-for-all, 30 s in team modes, power weapons 120 s (announced 10 s before); x itemRespawnScale.
  { id: 'weaponpad', code: 'I10', name: 'Weapon Pad', group: 'weapon', effect: 'weapon', respawn: 5, respawnTeams: 30, respawnPower: 120, shape: 'ring', size: 1.2, color: 0x8090a0 },
  { id: 'helmet', code: 'I11', name: 'Helmet', group: 'tactical', effect: 'helmet', amount: 1, cap: 1, color: 0x6a7a5a },
  { id: 'vest', code: 'I12', name: 'Vest', group: 'tactical', effect: 'vest', amount: 100, cap: 100, color: 0x5a6a4a },
  { id: 'patch', code: 'I13', name: 'Patch', group: 'loot', effect: 'consume', restores: 'health', amount: 15, cap: 75, useTime: 3, stack: 10, size: 0.3, color: 0xf0f0f0 },
  { id: 'medkit', code: 'I14', name: 'Med Kit', group: 'loot', effect: 'consume', restores: 'health', useTime: 8, stack: 3, size: 0.5, color: 0xff4040 },
  { id: 'cell', code: 'I15', name: 'Cell', group: 'loot', effect: 'consume', restores: 'shield', amount: 25, useTime: 2.5, stack: 6, shape: 'cylinder', size: 0.3, color: 0x40c0ff },
  { id: 'battery', code: 'I16', name: 'Battery', group: 'loot', effect: 'consume', restores: 'shield', useTime: 5, stack: 3, shape: 'cylinder', size: 0.5, color: 0x2080ff },
  { id: 'fizzcan', code: 'I17', name: 'Fizz Can', group: 'loot', effect: 'consume', restores: 'overflow', amount: 75, useTime: 2, stack: 2, shape: 'cylinder', size: 0.35, color: 0x60ffd0 },
]);

// Powerups (PU01..PU20). Timed rows last `duration` s; persistent rows (runes, the bearer flame) last until death; pool rows
// stay while their pool lasts (surplus shield, belt, boot jumps). `mods` are read by generic code in 12b while the powerup
// is active; `instant` applies once on pickup. stacking: 'add' (time adds up to maxDuration), 'refresh' (back to full),
// 'rune' (one rune at a time: a rune holder cannot take another). drops: carried on death, dropped with the time left (PWR-003).
// unique: one in the match (its spot waits while someone holds it or a dropped copy lies around). mapItem: placed by maps.
//
// mods: damage (dealt x), melee (melee dealt x), fodderMelee (melee kills fodder), taken (received x), immune [damage kinds],
// invulnerable, speed, rate (fire rate x), invisible (bots perceive at `perception` of their range), regen [rate, upTo, ...],
// flight (m/s), surplusDecay (/s), lifesteal (fraction healed), reveal (enemies of the holder get 'reveal'), jumpScale
// (jump height x) + noFall, maxHealthScale, maxArmorScale, noArmor, ammoRegen (fraction of max ammo per second).
// instant: surplus (surplus shield, cap surplusCap), belt (absorbing armor up to beltTotal with the armor), healTo, heal,
// soul (+souls), vital (max HP +amount up to vitalHealthCap, then max armor up to vitalArmorCap).
// pool: 'surplus' | 'belt' | 'jumps' (count `charges`): the powerup ends when the pool is spent.
Data.define('powerups', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, duration: 0, maxDuration: 0, persistent: false, respawn: 120, stacking: 'add',
  mods: {}, instant: {}, pool: '', charges: 0, drops: true, unique: false, mapItem: true, announce: true, campaign: false,
  color: 0xffffff, shape: 'sphere', size: 0.7, index: 0,
}, [
  { id: 'fury', code: 'PU01', name: 'Fury Core', duration: 30, maxDuration: 60, mods: { damage: 3 }, color: 0xb040ff },
  { id: 'warding', code: 'PU02', name: 'Warding Shell', duration: 30, maxDuration: 60, mods: { taken: 0.5, immune: ['splash', 'fall', 'hazard'] }, color: 0xffd040 },
  { id: 'quickening', code: 'PU03', name: 'Quickening', duration: 30, maxDuration: 60, mods: { speed: 1.3, rate: 1.3 }, color: 0xff8030 },
  { id: 'ghostveil', code: 'PU04', name: 'Ghostveil', duration: 30, maxDuration: 60, mods: { invisible: true, perception: 0.25 }, color: 0xc0e8ff },
  { id: 'renewal', code: 'PU05', name: 'Renewal', duration: 30, maxDuration: 60, mods: { regen: [15, 110, 5, 200] }, color: 0xff4060 },
  { id: 'skyward', code: 'PU06', name: 'Skyward', duration: 30, maxDuration: 60, mods: { flight: 8, noFall: true }, color: 0x80ffe0 },
  { id: 'surplus', code: 'PU07', name: 'Surplus Orb', respawn: 90, stacking: 'refresh', pool: 'surplus', instant: { surplus: 100, surplusCap: 100 }, mods: { surplusDecay: 2 }, drops: false, color: 0x40e0ff },
  { id: 'aegisbelt', code: 'PU08', name: 'Aegis Belt', respawn: 55, stacking: 'refresh', pool: 'belt', instant: { belt: 100, beltTotal: 200 }, drops: false, shape: 'ring', color: 0xffe080 },
  { id: 'berserk', code: 'PU09', name: 'Berserk Fist', duration: 20, maxDuration: 40, mods: { melee: 4, fodderMelee: true }, instant: { healTo: 100 }, color: 0xff2020 },
  { id: 'sigil', code: 'PU10', name: 'Invulnerability Sigil', duration: 10, maxDuration: 20, respawn: 180, mods: { invulnerable: true }, color: 0xffffff },
  { id: 'bottomless', code: 'PU11', name: 'Bottomless', duration: 30, maxDuration: 60, mods: { freeAmmo: true }, color: 0xffa020 },
  { id: 'vampfang', code: 'PU12', name: 'Vampire Fang', duration: 30, maxDuration: 60, mods: { lifesteal: 0.3 }, color: 0x900030 },
  { id: 'seer', code: 'PU13', name: 'Seer Orb', duration: 15, maxDuration: 30, respawn: 90, mods: { reveal: true }, color: 0x40ff80 },
  { id: 'springboots', code: 'PU14', name: 'Spring Boots', respawn: 60, stacking: 'refresh', pool: 'jumps', charges: 3, mods: { jumpScale: 2, noFall: true }, drops: false, shape: 'box', color: 0x60ff60 },
  { id: 'guardianrune', code: 'PU15', name: 'Guardian Rune', persistent: true, respawn: 60, stacking: 'rune', mods: { maxHealthScale: 2, maxArmorScale: 2, speed: 0.9 }, drops: false, shape: 'cone', color: 0x4060ff },
  { id: 'scoutrune', code: 'PU16', name: 'Scout Rune', persistent: true, respawn: 60, stacking: 'rune', mods: { speed: 1.25, rate: 1.2, noArmor: true }, drops: false, shape: 'cone', color: 0x40ffff },
  { id: 'ammorune', code: 'PU17', name: 'Ammo Rune', persistent: true, respawn: 60, stacking: 'rune', mods: { ammoRegen: 0.05 }, drops: false, shape: 'cone', color: 0xffc040 },
  { id: 'soul', code: 'PU18', name: 'Soul Shard', respawn: 0, instant: { heal: 1, soul: 1 }, drops: false, mapItem: false, announce: false, size: 0.3, color: 0xa0ffd0 },
  { id: 'lightbearer', code: 'PU19', name: 'Bearer Flame', persistent: true, respawn: 30, mods: { damage: 3 }, unique: true, color: 0xfff0a0 },
  { id: 'vitalshard', code: 'PU20', name: 'Vital Shard', respawn: 0, instant: { vital: 25, vitalHealthCap: 200, vitalArmorCap: 150 }, drops: false, mapItem: false, campaign: true, shape: 'box', color: 0xff60c0 },
]);

// PWR-001 timing rules shared by items and powerups (seconds).
const ITEM_TIMING = {
  firstPowerSpawn: 45,          // power items first appear 45 +/- 15 s after the start
  firstPowerSpread: 15,
  droppedSeconds: 30,           // dropped items vanish after 30 s
  droppedPowerupMinimum: 5,     // PWR-003: a dropped powerup keeps its time left, at least 5 s
  powerWarning: 10,             // PWR-002: announcement 10 s before a power item respawns
};
