// ==== S03 DATA: WEAPONS ====
// Weapon classes, recoil patterns, projectiles P01..P20, fire modes, weapons W01..W46 (38 rows: W08, W11, W14, W16, W18, W22, W29 and W33 are retired, P3-03) and weapon sets (spec §8, WPN-006).
// Fire modes are written inline in each weapon row and normalized into their own catalogue `fireModes` (id '<weapon>.primary').
// Beams are continuous hitscan: `damage` is per tick and `rate` is ticks per second (8 x 20 = 160 dps).

Data.define('weaponClasses', {
  // P7: flash = muzzle flash size (0 = none), casing = what a shot ejects ('brass' or ''), tail = how long a distant shot rings (06b, F07), thirdKick = degrees the held gun of a body pitches up per shot.
  id: REQUIRED, flash: 1, casing: '', tail: 1, thirdKick: 3, name: REQUIRED, slot: REQUIRED, tier: 'special', precision: false, pistol: false, firstShotExact: false,
  ttk: null, equipTime: 0.4, reload: 2, ammoType: '', color: 0x888888, reloadAnim: '', meleeAnim: '',
}, [
  { id: 'melee', flash: 0, thirdKick: 0, name: 'Melee', slot: 1, tier: 'none', ttk: [0.3, 1.5], reload: 0, color: 0x9aa3ad },
  { id: 'sidearm', flash: 1, casing: 'brass', thirdKick: 3, name: 'Sidearm', slot: 2, tier: 'primary', precision: true, pistol: true, firstShotExact: true, ttk: [0.3, 1.5], equipTime: 0.3, reload: 1.4, ammoType: 'light', color: 0x6b7c8f, reloadAnim: 'R1', meleeAnim: 'bashSidearm' },
  { id: 'smg', flash: 0.8, casing: 'brass', thirdKick: 2, name: 'SMG', slot: 3, tier: 'primary', ttk: [0.3, 1.2], equipTime: 0.35, reload: 1.8, ammoType: 'light', color: 0x56708a, reloadAnim: 'R3', meleeAnim: 'bashLong' },
  { id: 'shotgun', flash: 1.5, thirdKick: 6, name: 'Shotgun', slot: 4, tier: 'special', ttk: [0, 1], equipTime: 0.5, reload: 0.5, ammoType: 'shells', color: 0x8a6a4a, reloadAnim: 'R5', meleeAnim: 'bashLong' },
  { id: 'rifle', flash: 1, casing: 'brass', thirdKick: 3, name: 'Rifle', slot: 5, tier: 'primary', precision: true, firstShotExact: true, ttk: [0.15, 0.8], equipTime: 0.45, reload: 2.2, ammoType: 'heavy', color: 0x5d6b4f, reloadAnim: 'R3', meleeAnim: 'bashLong' },
  { id: 'marksman', flash: 1.1, casing: 'brass', thirdKick: 4, name: 'Marksman', slot: 6, tier: 'special', precision: true, firstShotExact: true, ttk: [0, 1.2], equipTime: 0.5, reload: 2.4, ammoType: 'heavy', color: 0x6f6450, reloadAnim: 'R3', meleeAnim: 'bashLong' },
  { id: 'sniper', flash: 1.4, tail: 1.6, thirdKick: 6, name: 'Sniper', slot: 6, tier: 'special', precision: true, ttk: [0, 0.5], equipTime: 0.6, reload: 3, ammoType: 'heavy', color: 0x4f5a66, reloadAnim: 'R4', meleeAnim: 'bashLong' },
  { id: 'energy', flash: 0.8, thirdKick: 2, name: 'Energy', slot: 7, tier: 'special', ttk: [0.15, 1.6], equipTime: 0.45, reload: 2, ammoType: 'cells', color: 0x3fa7c9, reloadAnim: 'R8', meleeAnim: 'bashLong' },
  { id: 'heavy', flash: 1.3, casing: 'brass', tail: 1.3, thirdKick: 3, name: 'Heavy', slot: 8, tier: 'heavy', ttk: [0.3, 1.8], equipTime: 0.7, reload: 4, ammoType: 'heavy', color: 0x7a5040, reloadAnim: 'R11', meleeAnim: 'bashHeavy' },
  { id: 'explosive', flash: 1.2, tail: 1.4, thirdKick: 6, name: 'Explosive', slot: 8, tier: 'heavy', ttk: [0, 1.2], equipTime: 0.6, reload: 2.5, ammoType: 'rockets', color: 0x9b4b34, reloadAnim: 'R13', meleeAnim: 'bashHeavy' },
  { id: 'exotic', flash: 1, thirdKick: 3, name: 'Exotic', slot: 9, tier: 'heavy', ttk: [0, 2.5], equipTime: 0.5, reload: 2.5, ammoType: 'special', color: 0x8d5bb0, reloadAnim: 'R14', meleeAnim: 'bashHeavy' },
  { id: 'power', flash: 1, tail: 1.5, thirdKick: 5, name: 'Power', slot: 9, tier: 'heavy', ttk: [0, 0.5], equipTime: 0.8, reload: 3, ammoType: 'special', color: 0xe0b84a, reloadAnim: 'R8', meleeAnim: 'bashHeavy' },
  { id: 'tool', flash: 0, thirdKick: 0, name: 'Tool', slot: 9, tier: 'none', reload: 0, color: 0x4ab08d, meleeAnim: 'bashHeavy' },
]);

// WPN-004: per-weapon spray patterns. The 30-entry pitch/yaw kick arrays are generated once from these parameters
// (shape 'climb' straight up, 'zigzag' up then left/right every 4 shots, 'sweep' slow sideways wave).
Data.define('recoil', {
  id: REQUIRED, pitch: 0, yaw: 0, shape: 'climb', climbShots: 8, jitter: 0, bloom: 0, bloomMax: 0, recover: 8, recoverDelay: 0.25, pattern: null,
}, [
  { id: 'none' },
  { id: 'pistol', pitch: 0.6, yaw: 0.15, shape: 'climb', jitter: 0.1, bloom: 0.15, bloomMax: 1.2 },
  { id: 'pistolHeavy', pitch: 2.2, yaw: 0.5, shape: 'climb', jitter: 0.3, bloom: 0.6, bloomMax: 2.5, recover: 7 },
  { id: 'smg', pitch: 0.35, yaw: 0.35, shape: 'sweep', climbShots: 6, jitter: 0.12, bloom: 0.08, bloomMax: 1.5 },
  { id: 'rifle', pitch: 0.45, yaw: 0.4, shape: 'zigzag', climbShots: 9, jitter: 0.08, bloom: 0.05, bloomMax: 1 },
  { id: 'rifleHeavy', pitch: 0.7, yaw: 0.55, shape: 'zigzag', climbShots: 10, jitter: 0.1, bloom: 0.07, bloomMax: 1.4 },
  { id: 'burst', pitch: 0.5, yaw: 0.2, shape: 'climb', climbShots: 3, jitter: 0.06, bloom: 0.05, bloomMax: 0.6 },
  { id: 'marksman', pitch: 1.4, yaw: 0.3, shape: 'climb', jitter: 0.15, bloom: 0.3, bloomMax: 1.2 },
  { id: 'sniper', pitch: 3, yaw: 0.4, shape: 'climb', jitter: 0.2, recover: 6 },
  { id: 'shotgun', pitch: 2.5, yaw: 0.6, shape: 'climb', jitter: 0.4, recover: 9 },
  { id: 'lmg', pitch: 0.3, yaw: 0.45, shape: 'sweep', climbShots: 12, jitter: 0.1, bloom: 0.03, bloomMax: 1.2 },
  { id: 'minigun', pitch: 0.12, yaw: 0.25, shape: 'sweep', climbShots: 20, jitter: 0.12, bloom: 0.02, bloomMax: 2 },
  { id: 'launcher', pitch: 2, yaw: 0.2, shape: 'climb', jitter: 0.2 },
  { id: 'energy', pitch: 0.25, yaw: 0.1, shape: 'sweep', jitter: 0.05, bloom: 0.03, bloomMax: 0.8 },
]);

const RECOIL_PATTERN_LENGTH = 30;          // WPN-004: 30 entries, looped
const RECOIL_LATE_PITCH = 0.35;            // vertical kick share once the climb part of the pattern is over
// Builds the fixed [pitch0, yaw0, pitch1, yaw1, ...] kick table (degrees) for one recoil row.
function buildRecoilPattern(row) {
  const pattern = new Float32Array(RECOIL_PATTERN_LENGTH * 2);
  for (let shot = 0; shot < RECOIL_PATTERN_LENGTH; shot++) {
    const climbing = shot < row.climbShots;
    pattern[shot * 2] = row.pitch * (climbing ? 1 : RECOIL_LATE_PITCH);
    pattern[shot * 2 + 1] = row.yaw * recoilYawShape(row.shape, shot, climbing);
  }
  return pattern;
}
function recoilYawShape(shape, shot, climbing) {
  if (shape === 'zigzag') return climbing ? 0.15 : (Math.floor(shot / 4) % 2) * 2 - 1;
  if (shape === 'sweep') return Math.sin(shot * 0.25);
  return Math.sin(shot * 0.35) * (shot / RECOIL_PATTERN_LENGTH);
}
CAT.recoil.forEach((row) => { row.pattern = buildRecoilPattern(row); });

// Projectiles (spec §8 table P01..P16; P17..P20 added for the drill, blade and Daybreak orb exotics; P19, the dark orb of the retired W18, is not reused).
// onHit: 'explode' (direct + splash), 'damage', 'pin' (damage; a wall within 1.5 m behind the victim pins it: status 'pinned'), 'puddle' (damage area), 'pull' (hook), 'drill'.
// bounces: -1 = bounce until the fuse ends, 0 = act on first contact. bounce = speed kept per bounce.
// incoming: the local player hears a whistle and sees a caption when one closes in (AUD-005, S11 Projectiles.warnIncoming).
// arm (here or on the fire mode): metres flown before it can explode; a contact sooner is a dud (WPN-011).
const EXPLOSIVE_ALT_ARM = 6;   // WPN-011: explosive alt fires arm at 6 m
Data.define('projectiles', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, speed: REQUIRED, gravity: 0, life: REQUIRED, radius: REQUIRED, bounce: 0, bounces: 0,
  fuse: 0, stick: false, stickActor: false, homing: 0, drag: 0, arm: 0, onHit: 'damage', poolSize: 16, roll: false, ownerSafe: false,
  comboTarget: false, parryable: false, pierce: false, returning: false, incoming: false, color: 0xffcc66, scale: 1, index: 0,
}, [
  { id: 'rocket', code: 'P01', name: 'Rocket', speed: 30, life: 8, radius: 0.15, onHit: 'explode', poolSize: 32, incoming: true, color: 0xff8a3d },
  { id: 'grenade', code: 'P02', name: 'Grenade', speed: 22, gravity: 20, life: 2.5, fuse: 2.5, radius: 0.1, bounce: 0.5, bounces: -1, onHit: 'explode', poolSize: 24, color: 0x6a8f3a },
  { id: 'mine', code: 'P03', name: 'Sticky mine', speed: 20, gravity: 20, life: 30, radius: 0.1, stick: true, stickActor: true, onHit: 'explode', poolSize: 16, color: 0xd04040 },
  { id: 'plasma', code: 'P04', name: 'Plasma bolt', speed: 60, life: 3, radius: 0.1, onHit: 'explode', poolSize: 64, parryable: true, color: 0x55e0ff },
  { id: 'shard', code: 'P05', name: 'Shard', speed: 45, gravity: 6, life: 2, radius: 0.05, bounce: 0.8, bounces: 2, onHit: 'damage', poolSize: 96, color: 0xffd27a },
  { id: 'orb', code: 'P06', name: 'Energy orb', speed: 12, life: 6, radius: 0.4, onHit: 'explode', poolSize: 16, comboTarget: true, parryable: true, color: 0x9c7bff, scale: 0.6 },
  { id: 'stake', code: 'P07', name: 'Stake', speed: 60, gravity: 4, life: 4, radius: 0.06, onHit: 'pin', poolSize: 16, color: 0xb08a5a },
  { id: 'arrow', code: 'P08', name: 'Arrow', speed: 55, gravity: 9, life: 6, radius: 0.05, onHit: 'damage', poolSize: 16, color: 0xd8d0b0 },
  { id: 'needle', code: 'P09', name: 'Needle', speed: 35, life: 2, radius: 0.05, homing: 35, stickActor: true, onHit: 'damage', poolSize: 64, color: 0xff6ad5 },
  { id: 'goo', code: 'P10', name: 'Goo blob', speed: 28, gravity: 15, life: 8, radius: 0.2, stick: true, onHit: 'puddle', poolSize: 48, color: 0x7fe04a },
  { id: 'disc', code: 'P11', name: 'Disc', speed: 35, life: 3, radius: 0.15, bounce: 1, bounces: 2, onHit: 'damage', poolSize: 32, color: 0xc8f0ff },
  { id: 'fusion', code: 'P12', name: 'Fusion orb', speed: 6, gravity: 20, life: 2, fuse: 2, radius: 0.5, roll: true, ownerSafe: true, onHit: 'explode', poolSize: 4, color: 0xffee88, scale: 0.8 },
  { id: 'warhead', code: 'P13', name: 'Warhead', speed: 14, life: 15, radius: 0.5, onHit: 'explode', poolSize: 2, incoming: true, color: 0xf0f0f0 },
  { id: 'contact', code: 'P14', name: 'Contact grenade', speed: 30, gravity: 15, life: 5, radius: 0.1, arm: EXPLOSIVE_ALT_ARM, onHit: 'explode', poolSize: 8, color: 0x8faa44 },
  { id: 'missile', code: 'P15', name: 'Missile', speed: 28, life: 6, radius: 0.12, homing: 120, onHit: 'explode', poolSize: 16, incoming: true, color: 0xffa060 },
  { id: 'hook', code: 'P16', name: 'Hook', speed: 60, life: 0.4, radius: 0.2, onHit: 'pull', poolSize: 8, color: 0x909090 },
  { id: 'drill', code: 'P17', name: 'Drill', speed: 20, life: 6, radius: 0.08, homing: 90, onHit: 'drill', poolSize: 8, color: 0xc0c0c0 },
  { id: 'blade', code: 'P18', name: 'Blade', speed: 30, life: 1.2, radius: 0.25, pierce: true, returning: true, onHit: 'damage', poolSize: 8, color: 0xe8e8ff },
  { id: 'sunorb', code: 'P20', name: 'Daybreak orb', speed: 18, life: 6, radius: 0.5, onHit: 'explode', poolSize: 4, color: 0xffd98a, scale: 0.7 },
  // X41 Ballistics: a hitscan pellet flown as a projectile; gravity and drag come from rules.fx.ballistics, the life from the mode's range.
  { id: 'bullet', code: 'P21', name: 'Bullet', speed: 320, life: 1, radius: 0.02, onHit: 'damage', poolSize: 128, color: 0xfff0b0, scale: 0.3 },
]);

// FireMode schema (spec §4). type: hitscan | projectile | beam | melee | cone | lock | zoom | toggle | block | detonate | tool.
// trigger: auto | semi | burst | charge | release. Optional objects: falloff [startM, endM, minFactor], splash {r, dmg, minFactor},
// charge {time, min, max, levels, target 'damage'|'pellets'|'multiplier', speed [min,max], ammo [..]}, status {id, seconds, stacks},
// cone {range, angle}, chain {targets, radius}, lock {time, targets, coneDeg, range}, toggle {damageMult, rateMult, recoilMult,
// speedMult, frontResist, status}, block {pool, regen, parryWindow, arcDeg}, launch {height, selfDamage},
// combo {damage, radius, ammo}, stickCombo {count, damage, radius}, split {projectile, count, damage}, puddle {radius, damage, seconds, status},
// aura {radius, damage, interval}, laser {damage, interval}. repair: HP/s a shot gives a friendly device instead of damage (W30 beam).
// zoomMax: a second scope step; next/previous weapon flips to it while fully scoped (W24 4x/8x).
// breath: seconds a held breath (the Walk action) steadies a swaying scope; above 0 the scope sways while aimed (W24 4 s).
// tracer: false draws no tracer line for a hitscan shot (W06 Hush, the silent pistol).
const FIRE_MODE_SCHEMA = {
  id: REQUIRED, type: REQUIRED, trigger: 'auto', damage: 0, rate: 1, pellets: 1, spreadDeg: 0, moveSpread: 1, adsSpreadMult: 0.4,
  recoil: 'none', falloff: null, headMult: 2, legMult: 0.75, armorPen: 0.75, pierce: 0, penetration: '', range: 200,
  projectile: '', speed: 0, life: 0, bounces: -2, splash: null, charge: null, ammoPerShot: 1, ammo: 'mag', heat: 0, heatDamage: 0,
  element: 'kinetic', status: null, statusRange: 0, burst: 0, burstGap: 0.06, spinUp: 0, reach: 0, backstab: 0, cone: null, chain: null,
  lock: null, toggle: null, block: null, launch: null, combo: null, stickCombo: null, split: null, puddle: null, aura: null, laser: null,
  cooldown: 0, maxActive: 0, activeRule: 'recycle', detonateOnRelease: false, guided: false, alwaysHead: false, knockback: 1,
  fodderKill: false, allyLink: 0, repair: 0, special: '', tool: '', zoom: 1, zoomMax: 0, breath: 0, noise: -1, arm: 0, weapon: '', family: null, tracer: true,
};

const WEAPON_SCHEMA = {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, class: REQUIRED, slot: 0, moveMult: 1, adsMoveMult: 0.7, equipTime: 0, readyTime: 0.15,
  flash: -1, casing: '', reloadFx: '', muzzleFlash: 0, casingKind: '', reload: 0, reloadShell: false, reloadAnim: '', meleeAnim: '', meleeAnimAlt: '', reloadAnimIndex: -1, meleeAnimIndex: -1, meleeAltIndex: -1, primary: REQUIRED, alt: REQUIRED, ammoType: '', mag: 0, reserve: 0, maxAmmo: 0, pickupAmmo: 0, altAmmo: 0,
  price: 0, killReward: 300, rarityScale: true, dualWield: false, noise: 60, botPref: { range: [5, 30], value: 0.5 }, botSpawn: 1, index: 0, family: null,
};

const WEAPON_ROWS = [
  // R-183: bots prefer the Warden over closing in with the 1.6 m Maul (they still swing it when caught up close).
  { id: 'maul', code: 'W01', name: 'Breaker Maul', class: 'melee', meleeAnim: 'maul', meleeAnimAlt: 'maulAlt', price: 0, killReward: 1500, noise: 25, botPref: { range: [0, 2], value: 0.1 },
    primary: { type: 'melee', damage: 50, rate: 2.5, reach: 1.6 },
    alt: { type: 'melee', trigger: 'charge', rate: 1.5, reach: 1.8, charge: { time: 1.2, min: 30, max: 120 }, launch: { height: 4.5, selfDamage: 10 } } },
  { id: 'tanto', code: 'W02', name: 'Edge Tanto', class: 'melee', meleeAnim: 'tanto', meleeAnimAlt: 'tantoAlt', killReward: 1500, noise: 0, botPref: { range: [0, 2], value: 0.25 },
    primary: { type: 'melee', damage: 35, rate: 2.5, reach: 1.2 },
    alt: { type: 'melee', trigger: 'semi', damage: 65, rate: 1, reach: 1.2, backstab: 150 } },
  { id: 'bulwark', code: 'W03', name: 'Bulwark Shield-Saw', class: 'melee', meleeAnim: 'bulwark', moveMult: 0.9, killReward: 1500, noise: 30, botPref: { range: [0, 3], value: 0.4 },
    primary: { type: 'melee', damage: 40, rate: 1.5, reach: 1.8, status: { id: 'stun', seconds: 0.3 } },
    alt: { type: 'block', block: { pool: 150, regen: 25, parryWindow: 0.2, arcDeg: 120 } } },
  { id: 'warden', code: 'W04', name: 'Warden Pistol', class: 'sidearm', mag: 12, reserve: 48, price: 0, dualWield: true, noise: 45, botPref: { range: [2, 25], value: 0.35 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 30, rate: 4.5, spreadDeg: 0.5, recoil: 'pistol', falloff: [20, 40, 0.7] },
    alt: { type: 'hitscan', trigger: 'burst', damage: 25, rate: 1.6, burst: 3, spreadDeg: 1.4, recoil: 'burst', falloff: [10, 25, 0.6] } },   // R-095: burst = faster close kills (4 hits in 0.67 s), semi = the accurate range option (0.75 s)
  { id: 'verdict', casing: 'none', code: 'W05', name: 'Verdict Magnum', class: 'sidearm', reloadAnim: 'R2', mag: 6, reserve: 24, price: 700, noise: 70, botPref: { range: [5, 40], value: 0.45 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 55, rate: 2.2, spreadDeg: 0.3, recoil: 'pistolHeavy', falloff: [25, 50, 0.75], penetration: 'med' },
    alt: { type: 'zoom', zoom: 2 } },
  // P3-03 (numbers are proposals for P8): the silent precision pistol. 40 damage at 2.5 a second (three hits, 0.8 s), head x2.5 so a
  // headshot kills, a long falloff and no tracer; noise 6 and the sleep dart stay its niche. It no longer shadows the Warden's rapid fire.
  { id: 'hush', flash: 0, code: 'W06', name: 'Hush Pistol', class: 'sidearm', mag: 10, reserve: 40, altAmmo: 6, price: 500, noise: 6, botPref: { range: [8, 35], value: 0.35 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 40, rate: 2.5, spreadDeg: 0.15, headMult: 2.5, tracer: false, recoil: 'pistol', falloff: [25, 55, 0.7] },
    alt: { type: 'hitscan', trigger: 'semi', damage: 0, rate: 1, ammo: 'alt', status: { id: 'sleep', seconds: 8 } } },
  { id: 'sparklock', casing: 'none', code: 'W07', name: 'Sparklock Pistol', class: 'sidearm', reloadAnim: 'R8', price: 600, mag: 24, reserve: 72, noise: 40, botPref: { range: [2, 20], value: 0.4 },
    primary: { type: 'lock', damage: 12, rate: 8, lock: { time: 0.4, targets: 3, coneDeg: 12, range: 20 }, recoil: 'energy' },
    alt: { type: 'hitscan', damage: 12, rate: 8, spreadDeg: 1.5, recoil: 'pistol' } },
  { id: 'wasp', code: 'W09', name: 'Wasp SMG', class: 'smg', mag: 30, reserve: 120, price: 1200, killReward: 600, botPref: { range: [0, 15], value: 0.55 },
    primary: { type: 'hitscan', damage: 18, rate: 13, spreadDeg: 0.8, recoil: 'smg', falloff: [10, 25, 0.6] },
    alt: { type: 'toggle', toggle: { damageMult: 0.85, status: { id: 'slow', seconds: 1 } } } },   // P3-04: the hollow-point toggle of the retired Riptide PDW (W11) replaces the plain zoom
  { id: 'hornet', code: 'W10', name: 'Hornet Carbine', class: 'smg', moveMult: 0.97, mag: 45, reserve: 180, altAmmo: 3, price: 1400, killReward: 600, botPref: { range: [0, 20], value: 0.55 },
    primary: { type: 'hitscan', damage: 15, rate: 12, spreadDeg: 0.9, recoil: 'smg', falloff: [12, 28, 0.6] },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'contact', damage: 0, rate: 1, ammo: 'alt', splash: { r: 3.5, dmg: 80 }, recoil: 'launcher' } },
  // R-088: needles home at 35 deg/s (P09), burst at 9 for 40, spread 1.5 deg and fall off past 12 m: a close and mid-range harasser, not a 35 m laser.
  { id: 'needlethorn', casing: 'none', code: 'W12', name: 'Needlethorn', class: 'smg', reloadAnim: 'R8', price: 1500, mag: 30, reserve: 90, noise: 40, botPref: { range: [3, 22], value: 0.5 },
    primary: { type: 'projectile', projectile: 'needle', damage: 9, rate: 10, spreadDeg: 1.5, falloff: [12, 28, 0.6], stickCombo: { count: 9, damage: 40, radius: 2 }, element: 'void' },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'needle', damage: 9, rate: 1.25, pellets: 5, spreadDeg: 5, ammoPerShot: 5, falloff: [12, 28, 0.6], stickCombo: { count: 9, damage: 40, radius: 2 }, element: 'void' } },
  { id: 'vanguard', code: 'W13', name: 'Vanguard Rifle', class: 'rifle', moveMult: 0.92, mag: 25, reserve: 75, price: 2700, botPref: { range: [5, 60], value: 0.75 },
    primary: { type: 'hitscan', damage: 34, rate: 9, spreadDeg: 0.25, recoil: 'rifleHeavy', falloff: [35, 60, 0.75], penetration: 'med' },
    alt: { type: 'zoom', zoom: 1.3 } },
  { id: 'ratchet', code: 'W15', name: 'Ratchet Burst', class: 'rifle', moveMult: 0.93, mag: 24, reserve: 96, price: 2400, botPref: { range: [8, 50], value: 0.65 },
    primary: { type: 'hitscan', trigger: 'burst', damage: 32, rate: 3, burst: 3, spreadDeg: 0.3, recoil: 'burst', penetration: 'med' },
    alt: { type: 'zoom', zoom: 1.8 } },
  { id: 'coilcaster', code: 'W17', name: 'Coilcaster', class: 'energy', price: 2200, moveMult: 0.93, mag: 20, reserve: 50, botPref: { range: [8, 60], value: 0.7 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 50, rate: 1.6, recoil: 'energy', element: 'arc', combo: { damage: 200, radius: 4, ammo: 3 } },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'orb', damage: 0, rate: 1.4, splash: { r: 1.5, dmg: 55 }, element: 'arc' } },
  // R-087: 12 x 10 = 120 one-shots inside about 8 m (falloff takes it below 100 past that); the 55 slug is the range option.
  { id: 'scattergun', code: 'W19', name: 'Scattergun', class: 'shotgun', moveMult: 0.95, reloadShell: true, mag: 6, reserve: 30, price: 1100, killReward: 900, noise: 80, botPref: { range: [0, 10], value: 0.7 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 10, pellets: 12, rate: 1.1, spreadDeg: 5, moveSpread: 0.3, adsSpreadMult: 1, recoil: 'shotgun', falloff: [8, 20, 0.4] },
    alt: { type: 'hitscan', trigger: 'semi', damage: 55, rate: 1.1, spreadDeg: 0.3, recoil: 'shotgun', falloff: [20, 45, 0.6], zoom: 1.2 } },
  // 20 x 8 = 160 point blank and full damage to 8 m (30% left at 18 m): the two-shell burst has to win the fights it gets into.
  { id: 'hookjaw', code: 'W20', name: 'Hookjaw', class: 'shotgun', reloadAnim: 'R6', reload: 0.8, mag: 2, reserve: 24, price: 1800, killReward: 900, noise: 85, botPref: { range: [0, 8], value: 0.8 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 9, pellets: 20, rate: 1.2, spreadDeg: 6, moveSpread: 0.3, recoil: 'shotgun', falloff: [8, 18, 0.3], ammoPerShot: 2 },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'hook', rate: 2, ammo: 'none', cooldown: 6, range: 25 } },
  { id: 'shardcaster', code: 'W21', name: 'Shardcaster', class: 'shotgun', reloadAnim: 'R7', reload: 2, moveMult: 0.92, mag: 10, reserve: 40, price: 1600, killReward: 900, noise: 75, botPref: { range: [0, 15], value: 0.75 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'shard', damage: 12, pellets: 9, rate: 1.2, spreadDeg: 6, moveSpread: 0.3, recoil: 'shotgun' },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'grenade', speed: 20, bounces: 0, damage: 100, rate: 0.9, split: { projectile: 'shard', count: 6, damage: 12 }, arm: EXPLOSIVE_ALT_ARM, recoil: 'launcher' } },
  { id: 'lancet', casing: 'none', code: 'W23', name: 'Lancet Rail', class: 'marksman', reloadAnim: 'R8', price: 3500, moveMult: 0.92, mag: 10, reserve: 30, noise: 90, botPref: { range: [10, 90], value: 0.85 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 100, rate: 0.67, moveSpread: 0, pierce: 4, recoil: 'marksman', element: 'arc' },
    alt: { type: 'zoom', zoom: 2.5 } },
  { id: 'heron', casing: 'none', code: 'W24', name: 'Heron Sniper', class: 'sniper', moveMult: 0.85, adsMoveMult: 0.5, reload: 3.6, mag: 5, reserve: 20, price: 4700, killReward: 100, noise: 110, botPref: { range: [25, 140], value: 0.85 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 115, rate: 0.67, spreadDeg: 2, adsSpreadMult: 0, headMult: 2.5, alwaysHead: true, recoil: 'sniper', penetration: 'high' },
    alt: { type: 'zoom', zoom: 4, zoomMax: 8, breath: 4 } },
  { id: 'kestrel', code: 'W25', name: 'Kestrel DMR', class: 'marksman', moveMult: 0.9, mag: 15, reserve: 45, price: 1800, botPref: { range: [10, 80], value: 0.7 },
    primary: { type: 'hitscan', trigger: 'semi', damage: 60, rate: 3, spreadDeg: 0.2, recoil: 'marksman', penetration: 'med' },
    alt: { type: 'zoom', zoom: 3 } },
  { id: 'stakedriver', casing: 'none', code: 'W26', name: 'Stakedriver', class: 'marksman', reloadAnim: 'R9', price: 2000, moveMult: 0.9, mag: 12, reserve: 36, altAmmo: 6, botPref: { range: [10, 60], value: 0.7 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'stake', damage: 100, rate: 1.2, recoil: 'marksman' },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'stake', damage: 70, rate: 1, ammo: 'alt', recoil: 'marksman', status: { id: 'burn', seconds: 4 }, element: 'thermal' } },   // P3-03: the incendiary stake (burns on any hit, any range; 6 alt rounds; numbers for P8) replaces the lob grenade
  // A 0.55 s draw from 50 to 110 (P8-04: was 0.7 s at 1.5 a second): a quick shot still hurts, a full draw one-shots a 100 HP body (noise 0 is the stealth niche).
  { id: 'talonbow', casing: 'none', flash: 0, code: 'W27', name: 'Talon Bow', class: 'marksman', reloadAnim: 'R10', price: 1500, mag: 1, reserve: 18, altAmmo: 6, noise: 0, reload: 0.5, botPref: { range: [8, 60], value: 0.6 },
    primary: { type: 'projectile', trigger: 'charge', projectile: 'arrow', rate: 1.8, charge: { time: 0.55, min: 50, max: 110, speed: [40, 70] } },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'arrow', speed: 55, damage: 0, rate: 1, ammo: 'alt', splash: { r: 2.5, dmg: 80 }, arm: EXPLOSIVE_ALT_ARM, noise: 60 } },
  // R-091: 0.2 s spin-up, 1.1 deg spread and 15 damage: the 18 rps hose (270 dps, 405 rooted); the spin-up and 0.75 move speed are the cost.
  // P3-03: high penetration from the retired Anvil LMG (W29).
  { id: 'hailstorm', code: 'W28', name: 'Hailstorm', class: 'heavy', price: 4000, moveMult: 0.75, mag: 150, reserve: 300, noise: 90, botPref: { range: [3, 35], value: 0.75 },
    primary: { type: 'hitscan', damage: 15, rate: 18, spinUp: 0.2, spreadDeg: 1.1, moveSpread: 1.5, recoil: 'minigun', penetration: 'high' },
    alt: { type: 'toggle', toggle: { rateMult: 1.5, frontResist: 0.3, speedMult: 0 } } },
  { id: 'linker', code: 'W30', name: 'Linker', class: 'energy', price: 1800, mag: 70, reserve: 140, noise: 50, botPref: { range: [3, 30], value: 0.6 },
    primary: { type: 'projectile', projectile: 'plasma', speed: 40, damage: 24, rate: 6, recoil: 'energy', element: 'arc' },
    alt: { type: 'beam', damage: 5, rate: 20, range: 30, allyLink: 1.5, repair: 60, element: 'arc' } },
  // R-086: direct 90 and splash 80 never kill 100 HP alone (two hits do), rate 1.0 and mag 4; the alt locks on for 1.2 s and sends 4 homing missiles.
  { id: 'ramjet', code: 'W31', name: 'Ramjet Launcher', class: 'explosive', price: 3200, moveMult: 0.88, mag: 4, reserve: 20, noise: 90, botPref: { range: [4, 40], value: 0.85 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'rocket', damage: 90, rate: 1, splash: { r: 3.5, dmg: 80 }, recoil: 'launcher', element: 'thermal' },
    alt: { type: 'lock', trigger: 'release', projectile: 'missile', damage: 35, pellets: 4, rate: 1, spreadDeg: 6, ammoPerShot: 2, splash: { r: 1.5, dmg: 10 }, lock: { time: 1.2, targets: 1, coneDeg: 10, range: 80 }, element: 'thermal' } },   // P3-03: the lock-on homing volley of the retired Kingfisher Pod (W33); 2 of the 4 rockets per volley (P8: magazine size)
  // A 4.5 m grenade blast forgives a near miss on fast movers; the 2.5 s fuse and the lob stay its drawback.
  { id: 'pitcher', code: 'W32', name: 'Pitcher Launcher', class: 'explosive', reloadAnim: 'R7', price: 2600, moveMult: 0.9, mag: 6, reserve: 24, noise: 70, botPref: { range: [5, 30], value: 0.65 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'grenade', damage: 0, rate: 1.5, splash: { r: 4.5, dmg: 100 }, recoil: 'launcher' },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'mine', damage: 0, rate: 2, splash: { r: 4, dmg: 100 }, maxActive: 4, detonateOnRelease: true, recoil: 'launcher' } },
  // R-092: the goo flies at 28 m/s (P10) and its puddle burns 5 per tick: a zoning gun that can finish what stands in it.
  { id: 'gloop', code: 'W34', name: 'Gloop Gun', class: 'explosive', reloadAnim: 'R12', price: 2000, mag: 25, reserve: 75, noise: 35, botPref: { range: [2, 18], value: 0.55 },
    primary: { type: 'projectile', projectile: 'goo', damage: 22, rate: 4, spreadDeg: 1.5, puddle: { radius: 1.5, damage: 5, seconds: 3 }, element: 'toxin' },
    alt: { type: 'projectile', trigger: 'charge', projectile: 'goo', rate: 0.8, ammoPerShot: 5, charge: { time: 2, min: 20, max: 150 }, split: { projectile: 'goo', count: 3, damage: 20 }, puddle: { radius: 2, damage: 2.5, seconds: 3 }, element: 'toxin' } },
  // R-092: 10 per tick (100 dps plus burn) beats an SMG inside its 9 m cone and nowhere else.
  { id: 'kindler', casing: 'none', reloadFx: 'flare', code: 'W35', name: 'Kindler', class: 'heavy', reloadAnim: 'R12', price: 2400, moveMult: 0.85, mag: 100, reserve: 200, noise: 40, botPref: { range: [0, 9], value: 0.6 },
    primary: { type: 'cone', damage: 9, rate: 10, cone: { range: 9, angle: 30 }, status: { id: 'burn', seconds: 4 }, element: 'thermal' },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'goo', damage: 10, rate: 1, ammoPerShot: 10, puddle: { radius: 2.5, damage: 5, seconds: 6, status: { id: 'burn', seconds: 4 } }, element: 'thermal', special: 'airblast' } },
  // R-093: 16 + 10 splash at 10 rps; the stored heat vents when it stops firing (R-186), so the heat blast is earned right before use.
  { id: 'ember', reloadFx: 'vent', code: 'W36', name: 'Ember Repeater', class: 'energy', price: 2400, moveMult: 0.92, mag: 50, reserve: 200, noise: 55, botPref: { range: [3, 30], value: 0.75 },
    primary: { type: 'projectile', projectile: 'plasma', damage: 16, rate: 10, splash: { r: 0.6, dmg: 10 }, heat: 4, recoil: 'energy', element: 'thermal' },
    alt: { type: 'cone', trigger: 'semi', rate: 1, ammoPerShot: 0, heatDamage: 120, cone: { range: 6, angle: 50 }, element: 'thermal' } },
  { id: 'stormlash', code: 'W37', name: 'Stormlash', class: 'energy', price: 2800, mag: 100, reserve: 200, noise: 50, botPref: { range: [2, 24], value: 0.75 },
    primary: { type: 'beam', damage: 8, rate: 20, range: 24, element: 'arc' },
    alt: { type: 'hitscan', trigger: 'semi', damage: 30, rate: 1.5, ammoPerShot: 5, range: 30, chain: { targets: 3, radius: 6 }, element: 'arc' } },
  { id: 'starthrower', code: 'W38', name: 'Starthrower', class: 'energy', price: 2200, mag: 50, reserve: 150, noise: 45, botPref: { range: [3, 30], value: 0.6 },
    primary: { type: 'projectile', projectile: 'disc', damage: 18, rate: 8, spreadDeg: 0.6, recoil: 'energy' },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'disc', bounces: 0, damage: 0, rate: 2, ammoPerShot: 3, splash: { r: 1.8, dmg: 50 }, arm: EXPLOSIVE_ALT_ARM } },
  { id: 'accelerator', code: 'W39', name: 'Accelerator', class: 'energy', price: 2600, mag: 20, reserve: 60, noise: 70, botPref: { range: [5, 50], value: 0.65 },
    primary: { type: 'hitscan', trigger: 'charge', rate: 1.2, charge: { time: 0.9, levels: [50, 100, 160], ammo: [2, 4, 8] }, recoil: 'energy', element: 'void' },
    alt: { type: 'cone', trigger: 'semi', damage: 60, rate: 0.7, ammoPerShot: 4, cone: { range: 6, angle: 360 }, knockback: 4, element: 'void' } },   // R-095: a real get-off-me ring
  { id: 'fusionmortar', code: 'W40', name: 'Fusion Mortar', class: 'explosive', reloadAnim: 'R14', price: 4500, moveMult: 0.85, mag: 1, reserve: 1, maxAmmo: 1, noise: 90, botPref: { range: [8, 30], value: 0.6 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'fusion', damage: 0, rate: 0.5, splash: { r: 6, dmg: 300 }, element: 'void' },
    alt: { type: 'detonate', projectile: 'fusion' } },
  { id: 'lifter', code: 'W41', name: 'Graviton Lifter', class: 'tool', noise: 20, botPref: { range: [0, 6], value: 0.2 },
    primary: { type: 'tool', trigger: 'semi', tool: 'lifterPunt', rate: 1.5, range: 6 },
    alt: { type: 'tool', tool: 'lifterPull', rate: 10, range: 8 } },
  { id: 'twingate', code: 'W42', name: 'Twin-Gate Projector', class: 'tool', noise: 10, botPref: { range: [0, 0], value: 0 },
    primary: { type: 'tool', trigger: 'semi', tool: 'gateDawn', rate: 2, range: 60 },
    alt: { type: 'tool', trigger: 'semi', tool: 'gateDusk', rate: 2, range: 60 } },
  // R-089: two 90 drills per kill (no single drill empties a 120 shield pool) homing at 90 deg/s (P17); fodderKill stays the PvE niche.
  { id: 'auger', code: 'W43', name: 'Skull Auger', class: 'exotic', price: 3500, mag: 3, reserve: 9, noise: 60, botPref: { range: [3, 20], value: 0.7 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'drill', damage: 90, rate: 0.8, fodderKill: true },
    alt: { type: 'detonate', projectile: 'drill' } },
  { id: 'razorwind', code: 'W44', name: 'Razorwind', class: 'exotic', price: 2000, noise: 30, botPref: { range: [2, 18], value: 0.55 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'blade', damage: 52, rate: 1.7, ammo: 'none', maxActive: 1, activeRule: 'block' },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'blade', damage: 45, rate: 2, ammo: 'none', maxActive: 1, activeRule: 'block', special: 'lodgeBlade', laser: { damage: 15, interval: 0.25 } } },
  { id: 'daybreak', code: 'W45', name: 'Daybreak Projector', class: 'power', moveMult: 0.85, mag: 4, reserve: 0, rarityScale: false, noise: 120, botPref: { range: [6, 60], value: 1 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'sunorb', speed: 18, damage: 150, rate: 0.5, splash: { r: 6, dmg: 150 }, aura: { radius: 8, damage: 7.5, interval: 0.25 }, element: 'void' },
    alt: { type: 'projectile', trigger: 'charge', projectile: 'sunorb', speed: 18, damage: 150, rate: 0.5, splash: { r: 6, dmg: 150 }, aura: { radius: 8, damage: 7.5, interval: 0.25 }, charge: { time: 2, levels: [1, 1.5], target: 'multiplier' }, element: 'void' } },
  { id: 'halcyon', code: 'W46', name: 'Halcyon Warhead', class: 'power', reloadAnim: 'R14', moveMult: 0.8, mag: 1, reserve: 0, rarityScale: false, noise: 130, botPref: { range: [20, 120], value: 1 },
    primary: { type: 'projectile', trigger: 'semi', projectile: 'warhead', damage: 0, rate: 0.3, splash: { r: 12, dmg: 300, minFactor: 0.1 }, element: 'thermal' },
    alt: { type: 'projectile', trigger: 'semi', projectile: 'warhead', damage: 0, rate: 0.3, guided: true, splash: { r: 12, dmg: 300, minFactor: 0.1 }, element: 'thermal' } },
];

// Quick melee (MELEE button) when the actor carries no melee weapon.
const QUICK_MELEE_MODE = { id: 'quick.melee', type: 'melee', trigger: 'semi', damage: 30, rate: 1.2, reach: 1.4 };
const MODE_NAMES = ['primary', 'alt'];

Data.define('fireModes', FIRE_MODE_SCHEMA, WEAPON_ROWS.flatMap((row) => MODE_NAMES.map((name) => Object.assign({}, row[name], { id: row.id + '.' + name })))
  .concat([QUICK_MELEE_MODE]));
Data.define('weapons', WEAPON_SCHEMA, WEAPON_ROWS);
CAT.weapons.forEach((weapon, index) => linkWeapon(weapon, index));

// Fills the derived fields: class defaults, normalized fire modes, index for per-actor typed arrays.
function linkWeapon(weapon, index) {
  const family = CAT.weaponClasses.byId(weapon.class);
  weapon.index = index;
  weapon.family = family;
  weapon.slot = weapon.slot || family.slot;
  weapon.equipTime = weapon.equipTime || family.equipTime;
  weapon.reload = weapon.reload || family.reload;
  linkWeaponAnims(weapon, family);
  weapon.muzzleFlash = weapon.flash >= 0 ? weapon.flash : family.flash;   // P7: a row's own flash (W06, W27: 0) wins over the class's
  weapon.casingKind = weapon.casing === 'none' ? '' : weapon.casing || family.casing;
  weapon.ammoType = weapon.ammoType || family.ammoType;
  weapon.maxAmmo = weapon.maxAmmo || weapon.reserve * 2;
  weapon.pickupAmmo = weapon.pickupAmmo || weapon.mag;
  weapon.primary = CAT.fireModes.byId(weapon.id + '.primary');
  weapon.alt = CAT.fireModes.byId(weapon.id + '.alt');
  weapon.primary.weapon = weapon.alt.weapon = weapon.id;
  weapon.primary.family = weapon.alt.family = family;
}

// P6: the reload set (none for a weapon without a magazine: it never reloads) and the melee strikes (a weapon's own row, else its class's) as
// catalogue indexes; -1 = none. Visual only (07g): no sim code reads them.
function linkWeaponAnims(weapon, family) {
  const reloadId = weapon.mag > 0 ? weapon.reloadAnim || family.reloadAnim : '';
  const strike = CAT.meleeAnims.byId(weapon.meleeAnim || family.meleeAnim), alt = CAT.meleeAnims.byId(weapon.meleeAnimAlt);
  weapon.reloadAnimIndex = reloadId ? CAT.reloadAnims.byId(reloadId).index : -1;
  weapon.meleeAnimIndex = strike ? strike.index : -1;
  weapon.meleeAltIndex = alt ? alt.index : weapon.meleeAnimIndex;
}

// WPN-008 loot rarity: damage factor and extra magazine fraction per rarity index (common .. legendary).
const WEAPON_RARITY_DAMAGE = [1, 1.05, 1.1, 1.16, 1.22];
const WEAPON_RARITY_MAG = [0, 0, 0.1, 0.2, 0.3];

// Step 5.4 attachment slots: each attachment multiplies stat rows of the weapon it is fitted to (1 = unchanged).
// Modifiers are multiplicative only, so stacked attachments stay bounded. reload and equip scale durations (< 1 is faster).
const ATTACHMENT_SLOTS = ['barrel', 'magazine', 'underbarrel', 'stock'];
const WEAPON_STATS = ['damage', 'spread', 'recoil', 'reload', 'mag', 'reserve', 'equip', 'move'];
Data.define('attachments', {
  id: REQUIRED, name: REQUIRED, slot: REQUIRED, damage: 1, spread: 1, recoil: 1, reload: 1, mag: 1, reserve: 1, equip: 1, move: 1, index: 0,
}, [
  { id: 'longBarrel', name: 'Long Barrel', slot: 'barrel', damage: 1.05, spread: 0.85, equip: 1.1, move: 0.97 },
  { id: 'shortBarrel', name: 'Short Barrel', slot: 'barrel', spread: 1.15, equip: 0.85, move: 1.03 },
  { id: 'extendedMag', name: 'Extended Magazine', slot: 'magazine', mag: 1.3, reload: 1.15 },
  { id: 'quickMag', name: 'Quick Magazine', slot: 'magazine', reload: 0.75, mag: 0.9 },
  { id: 'ammoPouch', name: 'Ammo Pouch', slot: 'magazine', reserve: 1.5, move: 0.98 },
  { id: 'foreGrip', name: 'Fore Grip', slot: 'underbarrel', recoil: 0.8, equip: 1.05 },
  { id: 'laserSight', name: 'Laser Sight', slot: 'underbarrel', spread: 0.8 },
  { id: 'heavyStock', name: 'Heavy Stock', slot: 'stock', recoil: 0.85, spread: 0.9, move: 0.95 },
  { id: 'lightStock', name: 'Light Stock', slot: 'stock', equip: 0.8, move: 1.04, recoil: 1.1 },
]);

// WPN-006 weapon sets. carry = max weapons held besides melee and tools (0 = full arsenal, one of each);
// start = spawn loadout; ammoTiers (WPN-007): primary-tier reserves are infinite.
// P3-01: the rulesets use fullSet (the whole roster); the themed sets below stay as presets of the weapon-set mutator X10 and the custom editor.
// Loot (RS10) uses lootSet, the same pool with rarity: every gun except the melee weapons, the map power weapons and the tools.
const LOOT_GUN_IDS = WEAPON_ROWS.filter((row) => row.class !== 'melee' && row.class !== 'power' && row.class !== 'tool').map((row) => row.id);
Data.define('weaponSets', {
  id: REQUIRED, name: REQUIRED, weapons: REQUIRED, start: REQUIRED, carry: 0, ammoTiers: false, rarity: false, power: [],
}, [
  { id: 'arenaSet', name: 'Arena', weapons: ['maul', 'warden', 'scattergun', 'shardcaster', 'lancet', 'linker', 'ramjet', 'pitcher', 'ember', 'stormlash', 'daybreak'], start: ['maul', 'warden'], power: ['daybreak'] },
  { id: 'tacticalSet', name: 'Tactical', weapons: ['tanto', 'warden', 'verdict', 'hush', 'wasp', 'vanguard', 'scattergun', 'heron', 'kestrel', 'hailstorm'], start: ['tanto', 'warden'], carry: 2 },
  { id: 'militarySet', name: 'Military', weapons: ['tanto', 'warden', 'verdict', 'wasp', 'hornet', 'vanguard', 'ratchet', 'scattergun', 'heron', 'kestrel', 'hailstorm', 'ramjet'], start: ['tanto', 'warden', 'hornet'], carry: 2 },   // R-094: a mid-pack spawn gun, so the Vanguard and the other pickups are upgrades
  { id: 'sandboxSet', name: 'Sandbox', weapons: ['tanto', 'verdict', 'needlethorn', 'ratchet', 'kestrel', 'coilcaster', 'hornet', 'lancet', 'heron', 'ramjet', 'pitcher', 'kindler'], start: ['tanto', 'ratchet', 'verdict'], carry: 2 },
  { id: 'ravagerSet', name: 'Ravager', weapons: ['maul', 'scattergun', 'hookjaw', 'stakedriver', 'hailstorm', 'ramjet', 'ember', 'accelerator', 'razorwind', 'daybreak'], start: ['maul', 'scattergun'], power: ['daybreak'] },
  { id: 'knightSet', name: 'Knight', weapons: ['bulwark', 'scattergun', 'hookjaw', 'stakedriver', 'gloop', 'ember', 'starthrower', 'fusionmortar'], start: ['bulwark', 'scattergun'] },
  { id: 'lootSet', name: 'Loot', weapons: ['tanto'].concat(LOOT_GUN_IDS), start: ['tanto'], carry: 5, rarity: true },
  { id: 'exoticSet', name: 'Exotic', weapons: ['sparklock', 'needlethorn', 'talonbow', 'gloop', 'stormlash', 'starthrower', 'accelerator', 'auger', 'razorwind'], start: ['tanto', 'sparklock'], ammoTiers: true },
  { id: 'fullSet', name: 'Full roster', weapons: WEAPON_ROWS.map((row) => row.id), start: ['maul', 'warden'], power: ['daybreak', 'halcyon'] },
  // Reserved row: S13 (13h) fills it for a match that uses a weapon list (mutators X08/X09/X10, custom match); empty outside such a match.
  { id: 'matchSet', name: 'Match list', weapons: ['maul'], start: ['maul'] },
]);
