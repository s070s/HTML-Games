// ==== S03 DATA: ECONOMY, METERS, PERKS, CLASSES, BUY ITEMS ====
// Economy presets ECP01..ECP07 (spec section 12), the six meters of rules.meter (ECO-003, ABL-002), the ECP04 perks and
// preset classes, and the buy / shop items. S13 Economy (13d) and S12 Meters (12g) read these rows; values are spec tunables.

// money: the preset uses credits. buy: 'round' (buy time after each round start, inside the buy zone) | 'shop' (while the
// shop is open) | 'none'. lossLadder: the one documented loss-bonus rule (13d): consecutive losses n pay ladder[min(n, length) - 1].
// killReward: the base credits of every kill (ECP02 "kill 200 + class reward bonus"); a weapon kill adds the weapon's
// killReward (the WPN prices table: SMG 600, shotgun 900, rifle 300, sniper 100, melee 1500). fieldUpgrades: ECP04 choices
// (gadget keys the items section grants, or ability ids of the classes ability kit).
Data.define('economy', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, money: false, buy: 'none', startMoney: 0, maxMoney: 0, winReward: 0, lossLadder: [],
  killReward: 0, killRewardRange: [0, 0], plantReward: 0, defuseReward: 0, buyTime: 0, buyZone: 0, carryOver: true, halfReset: true,
  waveBonus: 0, flawlessBonus: 0, keepOnSurvive: true, fieldUpgrades: [], slots: 0, rarities: [], ammoTypes: [], ladder: [], weaponStay: false, loadout: 'none',
}, [
  { id: 'pickups', code: 'ECP01', name: 'Map Pickups', weaponStay: true },
  { id: 'roundBuy', code: 'ECP02', name: 'Round Buy', money: true, buy: 'round', startMoney: 800, maxMoney: 9000, winReward: 3000, lossLadder: [1900, 2400, 2900],
    killReward: 200, plantReward: 300, defuseReward: 300, buyTime: 15, buyZone: 8 },
  { id: 'loot', code: 'ECP03', name: 'Loot Rarity', slots: 5, rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'], ammoTypes: ['light', 'heavy', 'shells', 'cells', 'rockets'] },
  { id: 'classes', code: 'ECP04', name: 'Classes and Perks', loadout: 'classes', fieldUpgrades: ['echopulse', 'cover', 'trophy', 'ammobox', 'beacon'] },
  { id: 'heroKits', code: 'ECP05', name: 'Hero Kits', loadout: 'heroes' },
  // Gun game order (M16, 18 tiers): one fixed weapon per tier, the last tier is the melee finisher.
  { id: 'ladder', code: 'ECP06', name: 'Weapon Ladder', ladder: ['warden', 'verdict', 'wasp', 'hornet', 'riptide', 'scattergun', 'shardcaster', 'vanguard', 'tempest',
    'ratchet', 'longshot', 'kestrel', 'heron', 'anvil', 'linker', 'ramjet', 'lancet', 'maul'] },
  { id: 'waveShop', code: 'ECP07', name: 'Wave Shop', money: true, buy: 'shop', killReward: 50, killRewardRange: [10, 100], waveBonus: 700, flawlessBonus: 100, keepOnSurvive: false, halfReset: false },
]);

// rules.meter kinds. max: the meter's full value; passive: points per second; perScore: points per scoreboard point;
// perDamage: points per HP of damage (or healing) dealt; resetOnDeath: streak meters restart each life; cost: what an
// ultimate-slot ability without its own ultCost takes (ultimate, adrenaline); an ultCost above max costs the full meter.
// energy row (ABL-002 bar outside HPP08 suits): passive = regen per second, regenDelay = seconds after the last spend
// before it regenerates (a draining toggle spends every step, so it never regenerates while on), perOrb = kill orb energy.
// rewards: [{ at (meter value), ability }] (streak / boost); combos: [{ taps (F B L R = move direction taps), ability }] (adrenaline).
Data.define('meters', {
  id: REQUIRED, name: REQUIRED, max: 0, cost: 0, passive: 0, perScore: 0, perDamage: 0, perKill: 0, perSpree: 0, spreeKills: 5, perCapture: 0, perOrb: 0,
  regenDelay: 0, resetOnDeath: false, rewards: [], combos: [],
}, [
  { id: 'none', name: 'None' },
  // ECO-003: score-based rewards (MIS-015: never kill-based); kills are worth 100 meter points per scoreboard point.
  { id: 'streak', name: 'Streak', max: 800, perScore: 100, resetOnDeath: true,
    rewards: [{ at: 300, ability: 'seerpulse' }, { at: 500, ability: 'orbital' }, { at: 800, ability: 'picketswarm' }] },
  { id: 'boost', name: 'Boost', max: 100, passive: 0.5, perScore: 4, rewards: [{ at: 50, ability: 'ampedrounds' }, { at: 80, ability: 'picketswarm' }] },
  { id: 'adrenaline', name: 'Adrenaline', max: 100, cost: 100, perKill: 5, perSpree: 10, perCapture: 25,
    combos: [{ taps: 'FFFF', ability: 'surgecombo' }, { taps: 'BBBB', ability: 'boostercombo' }, { taps: 'LLRR', ability: 'veilcombo' }, { taps: 'FFBB', ability: 'berserkcombo' }] },
  { id: 'ultimate', name: 'Ultimate', max: 2000, cost: 1500, passive: 5, perDamage: 1 },
  { id: 'energy', name: 'Energy', max: 100, passive: 5, regenDelay: 1, perOrb: 25 },
]);

// ECP04 perks, one per tier. stats: Weapons.statScale multipliers (S11 STAT names in lower case); dealt / taken: bullet
// damage factors (hitscan weapon hits); cancels: a perk of the victim this perk switches off; flag: read by other sections.
Data.define('perks', {
  id: REQUIRED, name: REQUIRED, tier: REQUIRED, text: REQUIRED, stats: {}, dealt: 1, taken: 1, cancels: '', flag: '', value: 0,
}, [
  { id: 'scavenger', name: 'Scavenger', tier: 1, text: 'Ammo from every kill', flag: 'scavenger', value: 0.5 },
  { id: 'bandolier', name: 'Bandolier', tier: 1, text: '+50% reserve ammo', stats: { reserve: 1.5 } },
  { id: 'hardline', name: 'Hardline', tier: 1, text: 'Streak rewards cost 100 points less', flag: 'hardline', value: 100 },
  { id: 'tuneup', name: 'Tune Up', tier: 1, text: 'Field upgrade recharges 50% faster', flag: 'tuneUp', value: 1.5 },
  { id: 'hardened', name: 'Hardened', tier: 2, text: '-20% bullet damage taken', taken: 0.8 },
  { id: 'stopping', name: 'Stopping', tier: 2, text: '+20% bullet damage, cancels Hardened', dealt: 1.2, cancels: 'hardened' },
  { id: 'ghost', name: 'Ghost', tier: 2, text: 'Hidden from pulses and the minimap', flag: 'ghost' },
  { id: 'quickhands', name: 'Quickhands', tier: 2, text: 'Reload 1.5x faster', stats: { reload: 1 / 1.5 } },
  { id: 'marathon', name: 'Marathon', tier: 3, text: 'Sprint twice as long', flag: 'marathon', value: 2 },
  { id: 'steady', name: 'Steady', tier: 3, text: '-30% hip-fire spread', stats: { spread: 0.7 } },
  { id: 'quietstep', name: 'Quietstep', tier: 3, text: 'Silent footsteps', flag: 'quiet' },
  { id: 'laststand', name: 'Last Stand', tier: 3, text: 'Pistol while downed (team modes)', flag: 'lastStand' },
]);

// ECP04: 6 preset classes (custom ones are saved per player, up to 10). lethal / tactical / fieldUpgrade: gadget keys the
// items section grants, or an ability id for the field upgrade slot.
Data.define('classes', {
  id: REQUIRED, name: REQUIRED, primary: REQUIRED, secondary: REQUIRED, lethal: '', tactical: '', perks: REQUIRED, fieldUpgrade: 'echopulse',
}, [
  { id: 'assault', name: 'Assault', primary: 'tempest', secondary: 'warden', lethal: 'frag', tactical: 'flash', perks: ['scavenger', 'stopping', 'marathon'] },
  { id: 'rifleman', name: 'Rifleman', primary: 'vanguard', secondary: 'verdict', lethal: 'frag', tactical: 'smoke', perks: ['bandolier', 'hardened', 'steady'] },
  { id: 'scout', name: 'Scout', primary: 'wasp', secondary: 'warden', lethal: 'sticky', tactical: 'flash', perks: ['hardline', 'ghost', 'quietstep'] },
  { id: 'breacher', name: 'Breacher', primary: 'scattergun', secondary: 'warden', lethal: 'frag', tactical: 'cryo', perks: ['scavenger', 'quickhands', 'marathon'] },
  { id: 'marksman', name: 'Marksman', primary: 'longshot', secondary: 'verdict', lethal: 'claymore', tactical: 'smoke', perks: ['bandolier', 'ghost', 'steady'] },
  { id: 'support', name: 'Support', primary: 'anvil', secondary: 'warden', lethal: 'frag', tactical: 'smoke', perks: ['tuneup', 'hardened', 'laststand'] },
]);

// Buy menu (roundBuy) equipment and wave shop items. Weapons of the match weapon set with a price are listed by 13d itself.
// kind: armor | helmet (HPP04 vest / vest + helmet) | gadget (granted by the items section) | ammo (refill every weapon) | grant
// (a handler another section registers). limit: per life; group: shared limit with groupLimit (GAD-001: 4 grenades in all).
Data.define('buyItems', {
  id: REQUIRED, name: REQUIRED, kind: REQUIRED, key: '', price: REQUIRED, amount: 0, limit: 1, group: '', groupLimit: 0, buy: 'round', index: -1,
}, [
  { id: 'vest', name: 'Vest', kind: 'armor', price: 650, amount: 100 },
  { id: 'vesthelmet', name: 'Vest and Helmet', kind: 'helmet', price: 1000, amount: 100 },
  { id: 'buyFrag', name: 'Frag Charge', kind: 'gadget', key: 'frag', price: 300, group: 'grenade', groupLimit: 4 },
  { id: 'buySmoke', name: 'Veil Canister', kind: 'gadget', key: 'smoke', price: 300, group: 'grenade', groupLimit: 4 },
  { id: 'buyFlash', name: 'Glare Shell', kind: 'gadget', key: 'flash', price: 200, limit: 2, group: 'grenade', groupLimit: 4 },
  { id: 'buyFire', name: 'Cinder Jar', kind: 'gadget', key: 'incendiary', price: 500, group: 'grenade', groupLimit: 4 },
  { id: 'ampAmmo', name: 'Amp Ammo', kind: 'ammo', price: 100, limit: 99, buy: 'shop' },
  { id: 'barrier', name: 'Barrier', kind: 'gadget', key: 'cover', price: 400, limit: 3, buy: 'shop' },
  { id: 'turret', name: 'Turret', kind: 'gadget', key: 'sentry', price: 1200, limit: 2, buy: 'shop' },
  { id: 'coreShield', name: 'Core Shield', kind: 'grant', key: 'coreShield', price: 1200, limit: 1, buy: 'shop' },
]);
CAT.buyItems.forEach((item, index) => { item.index = index; });
