// ==== S03 DATA: PVE ENEMIES, WAVES, CHAMBERS, RANGE ====
// PvE enemies E01..E14 (spec section 17) plus the R01..R03 firing range targets, the wave tables of the PvE modes, the
// director numbers (NPC-005..NPC-008, PERF-009), champion tags (NPC-004), the twelve MP11 puzzle chambers (MAP-030) and
// the firing range stations (M30). S14 Pve (14h..14k) reads every number from here. API: docs/api/pve.md.
//
// Enemy row fields: brain = behaviour kind (14i: one generic function per kind), health / shield / shieldElement (HP-006
// coloured shield), speed (m/s top speed; cruise = share of it used while not charging), size (hit volumes and body x),
// fodder (HP-005 shatter, fodderKill weapons), heavy (attrition points), leader (NPC-003 morale), cash (ECP07 kill
// reward), cost (director budget), sight / fov / turn / reaction (perception), keepRange [min, max] metres, headScale (head
// hit sphere radius x this, on top of the size: big weak-point heads), attacks (see
// ENEMY_ATTACK_DEFAULTS in 14h), weakPoint { kind: 'back'|'air'|'head'|'core', mult }, frontShield { arcDeg, factor },
// group (spawned as a swarm of N), drop / meleeDrop (pickup keys), answers (NPC-002 / MIS-032: 2+ ways to beat it),
// parts [[shape, x, y, z, sx, sy, sz, tint, aim]] = the silhouette in metres at size 1 (tint 'body' | 'dark' | 'glow' | 'weak' |
// 'eye'; aim 1 = pitches with the view), color / glow (0xRRGGBB). The silhouette sits on the S08 hit volumes (an upright
// stack at size 1: legs cylinder 0.05..0.85 m r 0.22, torso 0.85..1.45 m r 0.3, head sphere at 1.66 m r 0.14 x headScale):
// every 'weak' part centre lies inside a volume, every other part centre within PVE_PART_SLACK of one (self-test).

Data.define('enemies', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, role: REQUIRED, brain: REQUIRED, health: REQUIRED, speed: REQUIRED,
  shield: 0, shieldElement: '', cruise: 1, size: 1, fodder: false, heavy: false, leader: false, beast: false, boss: false, target: false,
  cash: 20, cost: 1, sight: 45, fov: 140, turn: 260, reaction: 450, keepRange: [0, 2], headScale: 1, massFactor: 1, flees: false, takesCover: false,
  cloaked: false, blink: null, heal: null, weakPoint: null, frontShield: null, group: 1, drop: '', dropChance: 0.15, meleeDrop: '',
  phases: null, endlessFrom: 1, attacks: [], answers: [], parts: [], color: 0x888888, glow: 0xffd040,
  index: 0, attackRows: null, tier: null, move: null, alertness: 0, colors: null, parryWeapons: null,   // derived once at load by 14h
}, [
  { id: 'husk', code: 'E01', name: 'Husk', role: 'fodder melee', brain: 'melee', health: 60, speed: 5.5, fodder: true, flees: true, cash: 10, cost: 1,
    reaction: 550, meleeDrop: 'ammobox', drop: 'healthvial', color: 0x7d8a5a, glow: 0xc8ff60,
    attacks: [{ id: 'claw', kind: 'melee', damage: 15, range: [0, 1.7], tell: 0.45, cooldown: 1.2, parry: true }],
    answers: ['any weapon', 'melee (saw kills drop ammo)', 'splash on the crowd'],
    parts: [['capsule', 0, 0.75, 0, 0.55, 1.3, 0.45, 'body'], ['sphere', 0, 1.55, 0.12, 0.34, 0.34, 0.34, 'dark'], ['box', 0.32, 1.05, 0.3, 0.12, 0.12, 0.6, 'dark'],
      ['box', -0.32, 1.05, 0.3, 0.12, 0.12, 0.6, 'dark'], ['sphere', 0, 1.6, 0.27, 0.12, 0.06, 0.06, 'eye']] },
  { id: 'gunner', code: 'E02', name: 'Gunner', role: 'fodder ranged', brain: 'ranged', health: 80, speed: 4.5, fodder: true, takesCover: true, cash: 20, cost: 2,
    keepRange: [8, 24], drop: 'ammobox', color: 0x5a6f8c, glow: 0xffa040,
    attacks: [{ id: 'rifle', kind: 'burst', damage: 8, shots: 3, gap: 0.12, range: [0, 35], tell: 0.4, cooldown: 1.6, spreadDeg: 3 }],
    answers: ['headshots x2', 'flank its cover', 'grenades'],
    parts: [['capsule', 0, 0.85, 0, 0.6, 1.45, 0.5, 'body'], ['sphere', 0, 1.62, 0, 0.3, 0.3, 0.3, 'weak'], ['box', 0.18, 1.2, 0.45, 0.1, 0.12, 0.8, 'dark', 1],
      ['box', 0, 1.15, -0.3, 0.45, 0.5, 0.2, 'dark']] },
  { id: 'brute', code: 'E03', name: 'Brute', role: 'heavy', brain: 'heavy', health: 600, speed: 3.5, heavy: true, leader: true, size: 1.35, massFactor: 4,
    cash: 80, cost: 8, keepRange: [6, 22], endlessFrom: 3, weakPoint: { kind: 'back', mult: 2 }, drop: 'armorshard', dropChance: 0.5, color: 0x8c4a32, glow: 0xff6020,
    attacks: [{ id: 'rockets', kind: 'projectile', weapon: 'ramjet', damage: 50, splashScale: 0.4, range: [5, 40], tell: 0.7, cooldown: 3 },
      { id: 'stomp', kind: 'slam', damage: 40, radius: 4, range: [0, 3.5], tell: 0.7, cooldown: 4, unblockable: true }],
    answers: ['back vents x2', 'sustained fire from range', 'splash'],
    parts: [['box', 0, 0.95, 0.05, 1.1, 1.2, 0.6, 'body'], ['box', 0, 1.62, 0.05, 0.5, 0.36, 0.45, 'dark'], ['cylinder', 0, 1.3, -0.27, 0.45, 0.3, 0.2, 'weak'],
      ['box', 0.65, 1.25, 0.2, 0.3, 0.3, 0.9, 'dark', 1], ['box', -0.65, 1.25, 0.2, 0.3, 0.3, 0.9, 'dark', 1], ['box', 0.2, 0.3, 0, 0.3, 0.6, 0.4, 'dark'],
      ['box', -0.2, 0.3, 0, 0.3, 0.6, 0.4, 'dark']] },
  { id: 'phalanx', code: 'E04', name: 'Phalanx', role: 'shielded', brain: 'shielded', health: 250, speed: 4, cash: 40, cost: 4, endlessFrom: 2,
    frontShield: { arcDeg: 120, factor: 0.1, lowered: 0.8 }, color: 0x6a5a8c, glow: 0x80c0ff,
    attacks: [{ id: 'spear', kind: 'melee', damage: 30, range: [0, 2.6], tell: 0.6, cooldown: 2, parry: true }],
    answers: ['flank the shield', 'shoot while the spear thrusts', 'splash behind it'],
    parts: [['capsule', 0, 0.85, 0, 0.55, 1.45, 0.45, 'body'], ['sphere', 0, 1.6, 0, 0.3, 0.3, 0.3, 'dark'], ['box', 0, 1.0, 0.45, 0.9, 1.4, 0.08, 'glow'],
      ['cylinder', 0.35, 1.2, 0.55, 0.06, 1.8, 0.06, 'dark', 1]] },
  { id: 'stalker', code: 'E05', name: 'Stalker', role: 'flanker', brain: 'stalker', health: 150, speed: 7, cloaked: true, cash: 40, cost: 4, endlessFrom: 4,
    blink: { range: 8, cooldown: 5, tell: 0.4 }, color: 0x3a4a4a, glow: 0x60ffe0,
    attacks: [{ id: 'blade', kind: 'melee', damage: 25, range: [0, 1.8], tell: 0.4, cooldown: 1.4, parry: true }],
    answers: ['track the blink arc', 'shock reveals it', 'splash where it lands'],
    parts: [['capsule', 0, 0.9, 0, 0.45, 1.6, 0.4, 'body'], ['cone', 0, 1.75, 0, 0.3, 0.4, 0.3, 'dark'], ['box', 0.35, 1.0, 0.35, 0.05, 0.08, 0.9, 'glow', 1],
      ['box', -0.35, 1.0, 0.35, 0.05, 0.08, 0.9, 'glow', 1]] },
  { id: 'longeye', code: 'E06', name: 'Longeye', role: 'sniper', brain: 'sniper', health: 100, speed: 4, sight: 90, fov: 90, cash: 50, cost: 4, endlessFrom: 4,
    keepRange: [18, 60], takesCover: true, color: 0x4a5a3a, glow: 0xff2020,
    attacks: [{ id: 'longshot', kind: 'laser', damage: 70, range: [10, 90], tell: 1.5, cooldown: 4, unblockable: true }],
    answers: ['break line of sight during the laser', 'smoke', 'close in: 100 HP'],
    parts: [['capsule', 0, 0.85, 0, 0.5, 1.5, 0.45, 'body'], ['sphere', 0, 1.62, 0, 0.28, 0.28, 0.28, 'dark'], ['box', 0.15, 1.3, 0.7, 0.08, 0.1, 1.4, 'dark', 1],
      ['sphere', 0.15, 1.42, 0.35, 0.1, 0.1, 0.1, 'eye', 1]] },
  { id: 'mite', code: 'E07', name: 'Mite Swarm', role: 'swarmer', brain: 'melee', health: 15, speed: 8, size: 0.45, fodder: true, group: 8, cash: 10, cost: 0.5,
    reaction: 300, endlessFrom: 2, dropChance: 0.03, drop: 'ammobox', color: 0x8c7a3a, glow: 0xffe060,
    attacks: [{ id: 'bite', kind: 'melee', damage: 5, range: [0, 1.3], tell: 0.4, cooldown: 0.8, parry: true }],
    answers: ['splash', 'any weapon (15 HP)', 'melee'],
    parts: [['sphere', 0, 1.0, 0, 1.1, 1.0, 1.2, 'body'], ['sphere', 0, 1.6, 0.12, 0.45, 0.4, 0.45, 'dark'], ['box', 0, 0.45, 0, 1.3, 0.12, 0.2, 'dark'],
      ['box', 0, 0.45, 0, 0.2, 0.12, 1.1, 'dark'], ['sphere', 0.12, 1.68, 0.32, 0.12, 0.12, 0.12, 'eye'], ['sphere', -0.12, 1.68, 0.32, 0.12, 0.12, 0.12, 'eye']] },
  { id: 'bomber', code: 'E08', name: 'Volt Bomber', role: 'suicide', brain: 'bomber', health: 40, speed: 7.5, cash: 30, cost: 2, endlessFrom: 3, reaction: 350,
    dropChance: 0, color: 0x3a6a8c, glow: 0x60d0ff,
    attacks: [{ id: 'detonate', kind: 'explode', damage: 60, radius: 3, range: [0, 2.5], tell: 0.5, cooldown: 1, unblockable: true, element: 'arc' }],
    answers: ['shoot it at range', 'its blast chains into its allies', 'sidestep during the beep'],
    parts: [['sphere', 0, 0.9, 0, 0.8, 1.0, 0.8, 'body'], ['sphere', 0, 1.0, 0, 0.6, 0.6, 0.6, 'glow'], ['cylinder', 0, 0.3, 0, 0.3, 0.6, 0.3, 'dark']] },
  { id: 'warden', code: 'E09', name: 'Mender Warden', role: 'support', brain: 'support', health: 200, speed: 4, leader: true, cash: 60, cost: 5, endlessFrom: 5,
    keepRange: [10, 20], heal: { rate: 20, radius: 10 }, drop: 'healthpack', dropChance: 0.6, color: 0x8ca04a, glow: 0x60ff90,
    attacks: [], answers: ['kill it first', 'any weapon (200 HP)', 'splash the group it heals'],
    parts: [['capsule', 0, 0.9, 0, 0.6, 1.6, 0.5, 'body'], ['sphere', 0, 1.7, 0, 0.32, 0.32, 0.32, 'dark'], ['ring', 0, 2.15, 0, 0.7, 0.08, 0.7, 'glow'],
      ['cylinder', 0.4, 1.0, 0.1, 0.06, 2.0, 0.06, 'dark']] },
  { id: 'charger', code: 'E10', name: 'Ramhorn', role: 'charger', brain: 'charger', health: 400, speed: 9, cruise: 0.45, keepRange: [8, 20], heavy: true, size: 1.25, massFactor: 3,
    cash: 60, cost: 6, endlessFrom: 5, color: 0x6a3a3a, glow: 0xff4040,
    attacks: [{ id: 'charge', kind: 'charge', damage: 50, range: [5, 25], tell: 0.8, cooldown: 5, unblockable: true, seconds: 1.6, knockdown: 1.2 }],
    answers: ['sidestep the charge', 'stagger it into a wall (x1.5)', 'splash while it recovers'],
    parts: [['box', 0, 1.12, 0, 0.8, 0.9, 0.6, 'body'], ['box', 0, 1.62, 0.08, 0.42, 0.4, 0.48, 'dark'], ['cone', 0.28, 1.86, 0.2, 0.14, 0.45, 0.14, 'glow', 1],
      ['cone', -0.28, 1.86, 0.2, 0.14, 0.45, 0.14, 'glow', 1], ['box', 0.18, 0.42, 0, 0.26, 0.8, 0.3, 'dark'], ['box', -0.18, 0.42, 0, 0.26, 0.8, 0.3, 'dark'],
      ['box', 0.5, 1.15, 0.05, 0.25, 0.6, 0.3, 'dark'], ['box', -0.5, 1.15, 0.05, 0.25, 0.6, 0.3, 'dark']] },
  { id: 'turret', code: 'E11', name: 'Sentinel Turret', role: 'static', brain: 'turret', health: 150, speed: 0, cash: 40, cost: 4, endlessFrom: 3, turn: 120, fov: 120,
    sight: 50, massFactor: 50, dropChance: 0, color: 0xc0c0c8, glow: 0xff3030,
    attacks: [{ id: 'sweep', kind: 'burst', damage: 12, shots: 10, gap: 0.2, range: [0, 45], tell: 0.6, cooldown: 1.2, spreadDeg: 2, searchSeconds: 3 }],
    answers: ['knock it over with an explosion', 'EMP or shock', 'flank it (slow turn)'],
    parts: [['cylinder', 0, 0.4, 0, 0.7, 0.8, 0.7, 'dark'], ['sphere', 0, 1.15, 0, 0.8, 0.8, 0.8, 'body'], ['box', 0, 1.15, 0.55, 0.2, 0.2, 0.6, 'dark', 1],
      ['sphere', 0, 1.25, 0.38, 0.16, 0.16, 0.16, 'eye', 1]] },
  { id: 'leaper', code: 'E12', name: 'Leaper', role: 'flanker', brain: 'leaper', health: 120, speed: 6, keepRange: [5, 10], cash: 30, cost: 3, endlessFrom: 2, size: 0.8,
    weakPoint: { kind: 'air', mult: 2 }, color: 0x7a5a2a, glow: 0xffb040,
    attacks: [{ id: 'pounce', kind: 'pounce', damage: 30, range: [4, 12], tell: 0.5, cooldown: 3, radius: 1.8 }],
    answers: ['shoot it mid-air (x2)', 'sidestep the pounce', 'any weapon (120 HP)'],
    parts: [['sphere', 0, 1.05, 0, 0.85, 0.85, 1.0, 'body'], ['sphere', 0, 1.6, 0.12, 0.45, 0.4, 0.45, 'dark'], ['box', 0.3, 0.45, -0.1, 0.2, 0.8, 0.5, 'dark'],
      ['box', -0.3, 0.45, -0.1, 0.2, 0.8, 0.5, 'dark'], ['sphere', 0, 1.66, 0.33, 0.2, 0.08, 0.08, 'eye']] },
  { id: 'overlord', code: 'E13', name: 'Overlord', role: 'boss', brain: 'boss', health: 6000, speed: 3, boss: true, size: 2.2, headScale: 1.6, massFactor: 40, cash: 100, cost: 0,
    sight: 80, fov: 200, reaction: 300, keepRange: [4, 25], weakPoint: { kind: 'core', mult: 2, pool: 600, seconds: 8 }, dropChance: 1, drop: 'healthpack',
    endlessFrom: 999, color: 0x5a2a5a, glow: 0xff60ff,
    // Phases by health share (NPC-006 / spec E13): slam, then the green parryable barrage (an odd fan: the middle bolt flies at
    // the target, the outer ones punish a sidestep into them), then summons E01 / E07.
    phases: [{ until: 0.66, attacks: ['slam'] }, { until: 0.33, attacks: ['barrage', 'slam'] }, { until: 0, attacks: ['summon', 'barrage', 'slam'] }],
    attacks: [{ id: 'slam', kind: 'slam', damage: 50, radius: 6, range: [0, 6], tell: 0.9, cooldown: 3.5, unblockable: true },
      { id: 'barrage', kind: 'projectile', weapon: 'linker', damage: 15, shots: 7, gap: 0.12, fanDeg: 30, range: [6, 50], tell: 0.6, cooldown: 4, parry: true },
      { id: 'summon', kind: 'summon', summon: ['husk', 'husk', 'mite'], range: [0, 80], tell: 1.0, cooldown: 12, limit: 12 }],
    answers: ['break the glowing core to disable its attack', 'parry the green barrage', 'kill the summons for health'],
    parts: [['cylinder', 0, 0.95, 0, 0.6, 1.0, 0.6, 'body'], ['cylinder', 0, 0.42, 0, 0.44, 0.84, 0.44, 'dark'], ['box', 0.55, 1.1, 0.1, 0.3, 0.3, 0.8, 'dark', 1],
      ['box', -0.55, 1.1, 0.1, 0.3, 0.3, 0.8, 'dark', 1], ['sphere', 0, 1.66, 0, 0.448, 0.448, 0.448, 'weak'], ['cone', 0, 1.98, -0.05, 0.4, 0.25, 0.3, 'dark']] },
  { id: 'beast', code: 'E14', name: 'Wild Strider', role: 'neutral beast', brain: 'beast', health: 300, speed: 8, beast: true, size: 1.3, headScale: 1.3, massFactor: 3, cash: 50,
    cost: 6, sight: 40, endlessFrom: 999, drop: 'healthpack', dropChance: 0.4, color: 0x6a7a3a, glow: 0xffd040,
    attacks: [{ id: 'bite', kind: 'melee', damage: 40, range: [0, 2.2], tell: 0.5, cooldown: 1.6, parry: true }],
    answers: ['lure it with a flare', 'any weapon (300 HP)', 'let it hunt your enemies'],
    parts: [['sphere', 0, 1.12, 0, 0.7, 0.6, 1.0, 'body'], ['cylinder', 0.12, 0.45, 0, 0.12, 0.85, 0.12, 'dark'], ['cylinder', -0.12, 0.45, 0, 0.12, 0.85, 0.12, 'dark'],
      ['box', 0, 1.45, 0.22, 0.15, 0.5, 0.15, 'dark'], ['box', 0, 1.66, 0.1, 0.3, 0.25, 0.42, 'dark', 1], ['box', 0, 1.2, -0.55, 0.12, 0.12, 0.5, 'dark'],
      ['sphere', 0, 1.72, 0.26, 0.18, 0.08, 0.08, 'eye', 1]] },
  // Firing range targets (M30): they stand, strafe or shoot back; stations set their shield level.
  { id: 'target', code: 'R01', name: 'Target Dummy', role: 'range target', brain: 'dummy', health: 150, speed: 0, target: true, cash: 0, cost: 0, dropChance: 0,
    massFactor: 50, color: 0xd8c8a8, glow: 0xffffff, attacks: [], answers: ['any weapon', 'headshots'],
    parts: [['capsule', 0, 0.85, 0, 0.6, 1.5, 0.45, 'body'], ['sphere', 0, 1.62, 0, 0.3, 0.3, 0.3, 'weak'], ['cylinder', 0, 0.05, 0, 0.8, 0.1, 0.8, 'dark']] },
  { id: 'strafer', code: 'R02', name: 'Strafe Dummy', role: 'range target', brain: 'dummy', health: 150, speed: 4, target: true, cash: 0, cost: 0, dropChance: 0,
    keepRange: [3, 3], color: 0xc8b088, glow: 0xffffff, attacks: [], answers: ['track it', 'lead the strafe'],
    parts: [['capsule', 0, 0.85, 0, 0.6, 1.5, 0.45, 'body'], ['sphere', 0, 1.62, 0, 0.3, 0.3, 0.3, 'weak'], ['box', 0, 1.1, -0.3, 0.5, 0.2, 0.1, 'glow']] },
  { id: 'fireback', code: 'R03', name: 'Return Fire Dummy', role: 'range target', brain: 'dummy', health: 150, speed: 0, target: true, cash: 0, cost: 0,
    dropChance: 0, massFactor: 50, reaction: 600, color: 0xb88868, glow: 0xff8040,
    attacks: [{ id: 'pellet', kind: 'burst', damage: 4, shots: 3, gap: 0.2, range: [0, 60], tell: 0.6, cooldown: 2.5, spreadDeg: 4 }],
    answers: ['strafe while it fires', 'kill it before the tell ends'],
    parts: [['capsule', 0, 0.85, 0, 0.6, 1.5, 0.45, 'body'], ['sphere', 0, 1.62, 0, 0.3, 0.3, 0.3, 'weak'], ['box', 0.2, 1.2, 0.4, 0.1, 0.1, 0.6, 'dark', 1]] },
]);

// Director (NPC-005..NPC-008): wave spawns out of sight >= 18 m from players, intensity rises with player damage and relaxes
// 8 s after the peak; with the queue empty and at most lastStand x the peak alive left, nobody flees (last stand); with
// enemies still queued and fallbackLosses of the encounter's spawns dead, the rest fall back to their spawn and regroup
// (still firing at a foe they see within fallbackFightRange m).
// guardianDeaths participant deaths in one wave offer the DIF-004 Guardian Plate (damage taken x guardianTaken). Brains decide at 4 Hz.
const PVE_DIRECTOR = {
  thinkInterval: 0.25, spawnMinDistance: 18, spawnSpacing: 1.2, spawnPerTick: 2, intensityPerDamage: 0.01, intensityPeak: 1,
  relaxSeconds: 8, intensityDecay: 0.1, lastStand: 0.25, raysPerTick: 24, hearingShare: 0.6,
  budgetScaleBase: 0.6, budgetScaleAggression: 0.8, budgetPerExtraPlayer: 0.25, playersBaseline: 4,
  moraleRadius: 20, brokenSeconds: [3, 6], outnumbered: 2, coverHealth: 0.4, coverSeconds: 3, dodgeRadius: 4,
  memorySeconds: 10, searchSeconds: 6, staggerSeconds: 1.2, staggerHitShare: 0.25, guardianTaken: 0.5, guardianDeaths: 3,
  fallbackLosses: 0.75, fallbackMinimum: 4, fallbackFightRange: 12,
  respawnBeastSeconds: 30, lureSeconds: 6, lureRadius: 30, lureSources: ['flash', 'incendiary'], lureElement: 'thermal',
};

// NPC-004 champion tags: barrier (shield refills unless stunned), unstoppable (no knockback, needs a stagger), overload
// (health regrows unless shocked). The director tags heavies from championFromWave on with the given chance.
const PVE_CHAMPIONS = [
  { id: 'barrier', shield: 150, shieldRegen: 30, glow: 0x60a0ff },
  { id: 'unstoppable', healthMult: 1.3, noKnockback: true, glow: 0xffa020 },
  { id: 'overload', healthRegen: 15, glow: 0xffff60 },
];
const PVE_CHAMPION_RULES = { fromWave: 3, chance: 0.35, elements: ['thermal', 'cryo', 'arc', 'toxin', 'void'], shieldElementChance: 0.3 };

// M21 Siege Waves: 10 waves (mini-boss wave 5, boss wave 10). budget = director points spent on `mix` weights; extra = fixed
// spawns at the wave start (champion: tag). Endless (M22) builds its waves from endlessWave below.
const PVE_HORDE_WAVES = [
  { budget: 10, mix: { husk: 3, gunner: 1 } },
  { budget: 14, mix: { husk: 3, gunner: 2, mite: 1 } },
  { budget: 18, mix: { husk: 2, gunner: 2, bomber: 1, phalanx: 1 } },
  { budget: 22, mix: { gunner: 2, phalanx: 1, stalker: 1, mite: 1, leaper: 1 } },
  { budget: 18, mix: { husk: 2, gunner: 2, leaper: 1 }, extra: [{ enemy: 'brute', champion: 'unstoppable' }] },
  { budget: 28, mix: { husk: 2, gunner: 2, longeye: 1, warden: 1, charger: 1 } },
  { budget: 32, mix: { gunner: 2, phalanx: 1, stalker: 1, bomber: 1, turret: 1, mite: 1 } },
  { budget: 36, mix: { gunner: 2, brute: 1, warden: 1, leaper: 1, longeye: 1 } },
  { budget: 42, mix: { husk: 1, gunner: 2, brute: 1, charger: 1, stalker: 1, bomber: 1 } },
  { budget: 20, mix: { husk: 2, gunner: 1, mite: 1 }, extra: [{ enemy: 'overlord' }] },
];
const PVE_ENDLESS = { baseBudget: 10, budgetPerWave: 4, weights: { husk: 3, gunner: 3, mite: 1, phalanx: 1, leaper: 1, bomber: 1, brute: 1, turret: 1,
  stalker: 1, longeye: 1, warden: 1, charger: 1 }, bossEvery: 10, boss: 'brute', extractSeconds: 20 };
// Between waves (ECP07 wave shop): shop time, the wave bonus is paid by Economy.awardWave; the core shield bought there.
// A wave down to huntLeft enemies with nothing left to spawn pings their places to the co-op bots every huntPingSeconds.
const PVE_WAVE_RULES = { shopSeconds: 20, firstWaveDelay: 5, coreShield: 1000, coreRadius: 3, coreAttackRange: 2.5, huntLeft: 3, huntPingSeconds: 2 };

// M23 Mote Rush: motes per kill (fodder 1, heavy / leader 3), carried at most 15. The deposit sizes, the invasion step and the
// boss threshold are the mode row's params (blockerAt [5, 10, 15], invasionAt 50, bossAt 100); blockers[k] is the enemy a
// deposit of blockerAt[k] or more sends to the other side. Each side keeps fodderAlive fodder (topped up every fillSeconds).
const PVE_BANK = { motesFodder: 1, motesHeavy: 3, carryMax: 15, blockers: ['gunner', 'phalanx', 'brute'], invader: 'charger', invaderChampion: 'barrier',
  boss: 'overlord', bossHealthShare: 0.25, fodderAlive: 6, fillSeconds: 0.5, fodder: ['husk', 'husk', 'gunner', 'mite'], bankRadius: 2,
  botBankAt: 5 };   // a bot carrying this many motes heads for its bank (more urgently the more it carries)
// M26 Ravager vs Fiends: each fiend summons fodder every summonEvery s (at most summonAlive alive per fiend).
const PVE_FIENDS = { summonEvery: 8, summonAlive: 4, summon: ['husk', 'husk', 'gunner'] };
// M29 Attrition: AI minions per team, heavies by chance.
const PVE_ATTRITION = { minionsPerTeam: 6, heavyChance: 0.15, fodder: ['husk', 'gunner'], heavy: ['brute', 'charger'], respawnSeconds: 4 };
// M28 Silent Contract (stealth on MP12): guards stand at the enemy spawns; score = base - time - alarms - kills + bonuses.
const PVE_CONTRACT = { guard: 'gunner', guardsMax: 10, alertRadius: 15, base: 1000, perSecond: 2, perAlarm: 150, perKill: 50, ghostBonus: 500,
  noKillBonus: 300, patrolSeconds: [6, 12], unaware: 0.3, suspicious: 0.6 };

// M30 Firing Range: station kinds cycle over the map's 'dummy' hints; shield levels by station; respawn after a kill.
const PVE_RANGE = { kinds: ['target', 'strafer', 'fireback'], shieldLevels: [0, 0, 50, 100], respawnSeconds: 2,
  strafeSpan: 3, drillTargets: 10, drillSeconds: 30 };

// MP11 Test Chambers (MAP-030): one concept each, heavy hints early, fading later. Element positions are metres from the room
// centre (the map zone 'Chamber <Name>'). lock: what opens the exit's fizzle grid: 'none', 'button', 'plate' (a cube on it),
// 'relay' (shot), 'all' (every element). par = [gold, silver, bronze] limits for time (s), steps (footsteps), portals (W42).
const PVE_CHAMBERS = [
  { id: 'chamber1', zone: 'Chamber One', concept: 'ramp', hint: 'Walk up the ramp to the exit pad.', lock: 'none', elements: [],
    par: { time: [8, 14, 30], steps: [14, 24, 50], portals: [0, 2, 6] } },
  { id: 'chamber2', zone: 'Chamber Two', concept: 'stairs + button', hint: 'Press USE on the button to lower the exit grid.', lock: 'button',
    elements: [{ kind: 'button', at: [-7, 0, 6] }], par: { time: [12, 20, 40], steps: [22, 36, 70], portals: [0, 2, 6] } },
  { id: 'chamber3', zone: 'Chamber Three', concept: 'ladder + cube', hint: 'Carry the cube (USE) onto the plate, then climb.', lock: 'plate',
    elements: [{ kind: 'cube', at: [-6, 0, 6] }, { kind: 'plate', at: [6, 0, 7] }], par: { time: [18, 30, 60], steps: [34, 54, 100], portals: [0, 2, 6] } },
  { id: 'chamber4', zone: 'Chamber Four', concept: 'launch plate', hint: 'Button first, then ride the launch plate.', lock: 'button',
    elements: [{ kind: 'button', at: [-6, 0, 6] }], par: { time: [12, 20, 40], steps: [20, 34, 70], portals: [0, 2, 6] } },
  { id: 'chamber5', zone: 'Chamber Five', concept: 'teleporter + relay', hint: 'Shoot the relay.', lock: 'relay',
    elements: [{ kind: 'relay', at: [-8, 1.5, 7] }], par: { time: [10, 18, 36], steps: [16, 28, 60], portals: [0, 2, 6] } },
  { id: 'chamber6', zone: 'Chamber Six', concept: 'bridge + cube', hint: 'Carry the cube over the acid.', lock: 'plate',
    elements: [{ kind: 'cube', at: [-7, 0, 5] }, { kind: 'plate', at: [7, 0, 6] }], par: { time: [18, 30, 60], steps: [34, 54, 100], portals: [0, 2, 6] } },
  { id: 'chamber7', zone: 'Chamber Seven', concept: 'slick floor', hint: 'Ice: plan your stops.', lock: 'button',
    elements: [{ kind: 'button', at: [2.2, 0, 7.4] }], par: { time: [14, 24, 48], steps: [26, 42, 80], portals: [0, 2, 6] } },
  { id: 'chamber8', zone: 'Chamber Eight', concept: 'fizzle grid', hint: 'Grids close your gates.', lock: 'plate',
    elements: [{ kind: 'cube', at: [6, 0, 6] }, { kind: 'plate', at: [1, 4, 6] }, { kind: 'fizzle', at: [-5, 0, -5], size: [0.4, 3, 4], clears: 'gates' }],
    par: { time: [20, 34, 66], steps: [36, 58, 110], portals: [0, 2, 6] } },
  { id: 'chamber9', zone: 'Chamber Nine', concept: 'twin plates + relay', hint: 'Relay, then two launches.', lock: 'relay',
    elements: [{ kind: 'relay', at: [-8, 2, -7] }], par: { time: [14, 24, 48], steps: [18, 30, 64], portals: [0, 2, 6] } },
  { id: 'chamber10', zone: 'Chamber Ten', concept: 'bridge over a kill zone', hint: '', lock: 'button',
    elements: [{ kind: 'button', at: [8.5, 0, -6] }], par: { time: [18, 30, 60], steps: [30, 50, 96], portals: [0, 2, 6] } },
  { id: 'chamber11', zone: 'Chamber Eleven', concept: 'twin gates', hint: '', lock: 'none', elements: [],
    par: { time: [10, 22, 44], steps: [16, 40, 80], portals: [2, 4, 8] } },
  { id: 'chamber12', zone: 'Chamber Twelve', concept: 'everything', hint: '', lock: 'all',
    elements: [{ kind: 'button', at: [-7, 0, 6] }, { kind: 'relay', at: [8, 3, -8] }], par: { time: [22, 36, 70], steps: [34, 56, 110], portals: [0, 2, 6] } },
];
const PVE_CHAMBER_RULES = { useRadius: 1.5, plateRadius: 0.9, relayRadius: 0.6, relayRange: 60, cubeSize: 0.6, carryAhead: 1.1, loadout: ['twingate'],
  medals: ['gold', 'silver', 'bronze'] };
