// ==== S03 DATA: ABILITIES, HERO KITS, ABILITY KITS ====
// Abilities A01..A40 (spec section 10) plus the meter rewards (AX rows), hero kits H01..H08 and the ability kits that
// rulesets, classes and the X46 mutator hand out. Each row names one generic effect kind (S12 12f) and its params;
// numbers are the spec's tunables. Times in seconds, distances in metres, energy on the 0..100 bar.
// activation: instant | toggle (on/off, drains costPerSecond) | hold (active while held) | channel (runs `duration`,
//   interrupted per `interrupt`) | passive (always on) | ult (fires by itself once its resource is full).
// resource: cooldown | charges (each recharges in `cooldown`) | energy (`cost` per use, `costPerSecond` while active)
//   | ultimate (`ultCost` meter points) | fuel (`duration` seconds, refills on the ground) | souls (`cost` souls) | none.
// interrupt: { damage, stun, fire }: what ends an active ability (null = the default: stuns end it, damage does not).
// modes: any | versus | pve | solo (rules.family the ability may be used in). balance: limits for blink-style power
//   (Appendix B mistakes): lineOfSight (the target point must be visible), fireDelay (weapons lowered after use), noCarrier
//   (not usable while carrying an objective), dropsObjective (a carried objective drops when it moves the user).
// botUse (BOT-066, for the bots section): { when, range [min, max] m, chance 0..1 per decision }. when: enemyVisible |
//   enemyClose | underFire | lowHealth | allyLow | allyDowned | escape | moving | always | groupedEnemies.

const ABILITY_SCHEMA = {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, category: REQUIRED, activation: REQUIRED, resource: 'cooldown',
  cost: 0, costPerSecond: 0, cooldown: 0, charges: 0, duration: 0, range: 0, ultCost: 0,
  effect: REQUIRED, params: {}, group: '', modes: 'any', interrupt: null, botUse: REQUIRED, balance: {}, color: 0xffffff, index: 0,
};

const ABILITY_ROWS = [
  // ---- Suit weaves: one energy bar, one weave on at a time (group) ----
  { id: 'bulwark', code: 'A01', name: 'Bulwark Weave', category: 'suit', activation: 'toggle', resource: 'energy', effect: 'suitArmor', group: 'weave',
    params: { regenScale: 2 }, botUse: { when: 'underFire', range: [0, 60], chance: 0.8 }, color: 0x4aa8ff },
  { id: 'overdrive', code: 'A02', name: 'Overdrive Weave', category: 'suit', activation: 'toggle', resource: 'energy', costPerSecond: 20, effect: 'suitSpeed', group: 'weave',
    params: { speed: 1.5, sprintOnly: true }, botUse: { when: 'escape', range: [0, 60], chance: 0.5 }, color: 0xffd34a },
  { id: 'colossusweave', code: 'A03', name: 'Colossus Weave', category: 'suit', activation: 'toggle', resource: 'energy', effect: 'suitStrength', group: 'weave',
    params: { jumpHeight: 1.8, melee: 2, steady: 0.5, useCost: 15, throwReach: 2, throwSpeed: 14, throwLift: 4 }, botUse: { when: 'enemyClose', range: [0, 6], chance: 0.5 }, color: 0xff6a3a },
  { id: 'phantasm', code: 'A04', name: 'Phantasm Weave', category: 'suit', activation: 'toggle', resource: 'energy', costPerSecond: 8, effect: 'cloak', group: 'weave',
    params: { stillCostPerSecond: 2, stillSpeed: 0.2 }, interrupt: { damage: false, stun: true, fire: true }, 
    botUse: { when: 'escape', range: [0, 60], chance: 0.4 }, color: 0x9be7ff },
  // ---- Mobility ----
  { id: 'shadowstep', code: 'A05', name: 'Shadow Step', category: 'mobility', activation: 'instant', resource: 'energy', cost: 20, range: 10, effect: 'blink',
    params: { direction: 'aim', ledgeGrab: true, upgradedRange: 15 }, balance: { lineOfSight: true, fireDelay: 0.3, noCarrier: true },
    botUse: { when: 'enemyVisible', range: [12, 40], chance: 0.3 }, color: 0x7a5cff },
  { id: 'phaseslip', code: 'A06', name: 'Phase Slip', category: 'mobility', activation: 'instant', cooldown: 12, duration: 2, effect: 'buff',
    params: { invulnerable: true, noFire: true }, botUse: { when: 'lowHealth', range: [0, 40], chance: 0.7 }, color: 0xb0a0ff },
  { id: 'grapnel', code: 'A07', name: 'Grapnel', category: 'mobility', activation: 'instant', cooldown: 10, duration: 2, range: 30, effect: 'grapple',
    params: { pullSpeed: 18, arrive: 1.5 }, botUse: { when: 'moving', range: [8, 30], chance: 0.2 }, color: 0xc8c8c8 },
  { id: 'surge', code: 'A08', name: 'Surge Dash', category: 'mobility', activation: 'instant', resource: 'charges', charges: 3, cooldown: 3, range: 7, effect: 'blink',
    params: { direction: 'input' }, botUse: { when: 'underFire', range: [0, 30], chance: 0.4 }, color: 0x6fd8ff },
  { id: 'rewind', code: 'A09', name: 'Rewind Anchor', category: 'mobility', activation: 'instant', cooldown: 15, effect: 'rewind',
    params: { seconds: 3 }, botUse: { when: 'lowHealth', range: [0, 60], chance: 0.8 }, color: 0x6fd8ff },
  { id: 'updraft', code: 'A10', name: 'Updraft', category: 'mobility', activation: 'instant', cooldown: 20, duration: 5, range: 10, effect: 'zone',
    params: { zone: 'lift', radius: 2.5, height: 10, speed: 7, allies: true }, botUse: { when: 'escape', range: [0, 60], chance: 0.3 }, color: 0x9fd8ff },
  { id: 'glidepack', code: 'A11', name: 'Glidepack', category: 'mobility', activation: 'hold', resource: 'fuel', duration: 3, effect: 'glide',
    params: { gravity: 0.1 }, botUse: { when: 'moving', range: [0, 60], chance: 0.2 }, color: 0xd0e0ff },
  { id: 'relocator', code: 'A12', name: 'Relocator', category: 'mobility', activation: 'instant', resource: 'charges', charges: 6, cooldown: 1, range: 25, effect: 'beacon',
    params: { telefrag: true }, balance: { dropsObjective: true }, botUse: { when: 'escape', range: [0, 25], chance: 0.3 }, color: 0x7affc8 },
  // ---- Recon ----
  { id: 'echopulse', code: 'A13', name: 'Echo Pulse', category: 'recon', activation: 'instant', cooldown: 20, duration: 3, range: 15, effect: 'pulse',
    params: { pulses: 3, interval: 1, reveal: 1 }, botUse: { when: 'always', range: [0, 15], chance: 0.3 }, color: 0xffd040 },
  { id: 'huntersight', code: 'A14', name: 'Hunter Sight', category: 'recon', activation: 'toggle', resource: 'energy', costPerSecond: 5, range: 30, effect: 'sight',
    params: { reveal: 0.25 }, botUse: { when: 'always', range: [0, 30], chance: 0.2 }, color: 0xffb040 },
  { id: 'scoutdrone', code: 'A15', name: 'Scout Drone', category: 'recon', activation: 'channel', cooldown: 40, duration: 20, effect: 'drone',
    params: { speed: 8, reveal: 10, empRadius: 5, empSeconds: 2 }, interrupt: { damage: true, stun: true, fire: false }, 
    botUse: { when: 'always', range: [0, 60], chance: 0.1 }, color: 0xffd040 },
  { id: 'tracker', code: 'A16', name: 'Tracker Sense', category: 'recon', activation: 'passive', resource: 'none', range: 30, effect: 'tracker',
    params: { seconds: 8 }, botUse: { when: 'always', range: [0, 30], chance: 1 }, color: 0xffd040 },
  // ---- Control ----
  { id: 'veil', code: 'A17', name: 'Veil Curtain', category: 'control', activation: 'instant', resource: 'charges', charges: 2, cooldown: 30, duration: 15, range: 20, effect: 'zone',
    params: { zone: 'smoke', width: 12, height: 3 }, botUse: { when: 'underFire', range: [0, 20], chance: 0.5 }, color: 0xb8c0c8 },
  { id: 'fence', code: 'A18', name: 'Static Fence', category: 'control', activation: 'instant', resource: 'charges', charges: 4, cooldown: 15, range: 12, effect: 'fence',
    params: { damage: 20, slow: 0.4, slowSeconds: 1.5, link: 12, life: 60, rearm: 1 }, botUse: { when: 'always', range: [0, 12], chance: 0.3 }, color: 0x7ad8ff },
  { id: 'timebend', code: 'A19', name: 'Time Bend', category: 'control', activation: 'instant', resource: 'energy', cost: 60, duration: 6, effect: 'timebend',
    params: { scale: 0.25, radius: 8 }, botUse: { when: 'groupedEnemies', range: [0, 8], chance: 0.6 }, color: 0xc0a0ff },
  { id: 'gale', code: 'A20', name: 'Gale Push', category: 'control', activation: 'instant', cooldown: 8, range: 8, effect: 'push',
    params: { angle: 30, speed: 20, deflect: true }, botUse: { when: 'enemyClose', range: [0, 8], chance: 0.6 }, color: 0xe0f0ff },
  { id: 'binding', code: 'A21', name: 'Binding Link', category: 'control', activation: 'instant', cooldown: 20, duration: 8, range: 30, effect: 'link',
    params: { radius: 8 }, botUse: { when: 'groupedEnemies', range: [0, 30], chance: 0.5 }, color: 0xff60c0 },
  { id: 'mesmer', code: 'A22', name: 'Mesmer Lure', category: 'control', activation: 'instant', cooldown: 25, duration: 6, range: 15, effect: 'mesmer',
    params: { targets: 2 }, botUse: { when: 'groupedEnemies', range: [0, 15], chance: 0.5 }, color: 0xff80ff },
  { id: 'puppet', code: 'A23', name: 'Puppet Jump', category: 'control', activation: 'instant', cooldown: 40, duration: 10, range: 20, effect: 'possess', modes: 'pve',
    params: {}, interrupt: { damage: true, stun: true, fire: false }, botUse: { when: 'enemyVisible', range: [0, 20], chance: 0.3 }, color: 0xa040ff },
  { id: 'frenzy', code: 'A24', name: 'Frenzy Hex', category: 'control', activation: 'instant', cooldown: 30, duration: 8, range: 30, effect: 'frenzy',
    params: {}, botUse: { when: 'groupedEnemies', range: [0, 30], chance: 0.5 }, color: 0xff4040 },
  // ---- Sustain ----
  { id: 'mender', code: 'A25', name: 'Mender Drone', category: 'sustain', activation: 'instant', cooldown: 30, duration: 8, effect: 'zone',
    params: { zone: 'heal', radius: 6, rate: 20, allies: true, persist: true }, botUse: { when: 'allyLow', range: [0, 6], chance: 0.8 }, color: 0x60ff90 },
  { id: 'aegisdome', code: 'A26', name: 'Aegis Dome', category: 'sustain', activation: 'instant', cooldown: 30, duration: 12, effect: 'zone',
    params: { zone: 'dome', radius: 5, persist: true }, botUse: { when: 'underFire', range: [0, 60], chance: 0.7 }, color: 0x80c0ff },
  { id: 'secondwind', code: 'A27', name: 'Second Wind', category: 'sustain', activation: 'instant', cooldown: 60, range: 10, effect: 'revive',
    params: {}, botUse: { when: 'allyDowned', range: [0, 10], chance: 1 }, color: 0x60ff90 },
  { id: 'ampwall', code: 'A28', name: 'Amp Wall', category: 'sustain', activation: 'instant', cooldown: 20, duration: 15, effect: 'zone',
    params: { zone: 'wall', width: 4, height: 2, distance: 1.5, amp: 1.25, persist: true }, botUse: { when: 'underFire', range: [0, 60], chance: 0.6 }, color: 0x60c0ff },
  // ---- Offense ----
  { id: 'arcbolt', code: 'A29', name: 'Arc Bolt', category: 'offense', activation: 'instant', resource: 'energy', cost: 25, range: 30, effect: 'bolt',
    params: { damage: 30, element: 'arc', status: 'shock', seconds: 1, stacks: 1 }, botUse: { when: 'enemyVisible', range: [0, 30], chance: 0.5 }, color: 0xfff27a },
  { id: 'ignite', code: 'A30', name: 'Ignite', category: 'offense', activation: 'instant', resource: 'energy', cost: 25, range: 30, effect: 'bolt',
    params: { damage: 10, element: 'thermal', status: 'burn', seconds: 0, stacks: 1 }, botUse: { when: 'enemyVisible', range: [0, 30], chance: 0.5 }, color: 0xff7a2a },
  { id: 'frostlance', code: 'A31', name: 'Frost Lance', category: 'offense', activation: 'instant', resource: 'energy', cost: 30, range: 30, effect: 'bolt',
    params: { damage: 10, element: 'cryo', status: 'chill', seconds: 0, stacks: 3 }, botUse: { when: 'enemyClose', range: [0, 20], chance: 0.5 }, color: 0x9fd8ff },
  { id: 'swarm', code: 'A32', name: 'Swarm Cloud', category: 'offense', activation: 'instant', cooldown: 25, duration: 6, range: 30, effect: 'swarm',
    params: { dps: 8, targets: 1 }, botUse: { when: 'enemyVisible', range: [0, 30], chance: 0.5 }, color: 0x90a040 },
  { id: 'holodouble', code: 'A33', name: 'Holo Double', category: 'offense', activation: 'instant', cooldown: 15, duration: 8, effect: 'decoy',
    params: {}, botUse: { when: 'enemyVisible', range: [10, 60], chance: 0.3 }, color: 0x80e0ff },
  // ---- Ultimates and the rest ----
  { id: 'wrath', code: 'A34', name: 'Wrath Form', category: 'ultimate', activation: 'ult', resource: 'souls', cost: 66, duration: 8, effect: 'buff',
    params: { invulnerable: true, touchKill: true, homing: 6 }, botUse: { when: 'always', range: [0, 60], chance: 1 }, color: 0xff2020 },
  { id: 'lifterpower', code: 'A35', name: 'Graviton Grip', category: 'physics', activation: 'hold', resource: 'energy', costPerSecond: 10, effect: 'telekinesis',
    params: { weapon: 'lifter' }, botUse: { when: 'enemyClose', range: [0, 12], chance: 0.2 }, color: 0xffa040 },
  { id: 'gatepair', code: 'A36', name: 'Gate Pair', category: 'portal', activation: 'instant', resource: 'none', charges: 2, effect: 'gates', modes: 'solo',
    params: { weapon: 'twingate' }, botUse: { when: 'always', range: [0, 0], chance: 0 }, color: 0xff9030 },
  { id: 'overcore', code: 'A37', name: 'Overcore', category: 'ultimate', activation: 'instant', resource: 'ultimate', ultCost: 1500, duration: 10, effect: 'buff',
    params: { damage: 2, rate: 1.2 }, botUse: { when: 'enemyVisible', range: [0, 40], chance: 0.8 }, color: 0xff5030 },
  { id: 'orbital', code: 'A38', name: 'Orbital Lance', category: 'ultimate', activation: 'instant', resource: 'ultimate', ultCost: 1800, range: 60, effect: 'zone',
    params: { zone: 'strike', radius: 8, delay: 2, damage: 250, persist: true }, botUse: { when: 'groupedEnemies', range: [5, 60], chance: 0.8 }, color: 0xff3030 },
  { id: 'rift', code: 'A39', name: 'Rift Gate', category: 'ultimate', activation: 'instant', resource: 'ultimate', ultCost: 1500, duration: 15, range: 60, effect: 'rift',
    params: { radius: 1.2, rearm: 1, persist: true }, botUse: { when: 'escape', range: [0, 60], chance: 0.4 }, color: 0xb040ff },
  { id: 'rally', code: 'A40', name: 'Rally Cry', category: 'ultimate', activation: 'instant', resource: 'ultimate', ultCost: 1200, duration: 8, effect: 'rally',
    params: { surplus: 50, speed: 1.2 }, botUse: { when: 'enemyVisible', range: [0, 40], chance: 0.7 }, color: 0xffe060 },
  // ---- Meter rewards (ECO-003) and the global pulse of H08 (ultimate cost when used as an ultimate) ----
  { id: 'seerpulse', code: 'AX1', name: 'Seer Pulse', category: 'reward', activation: 'instant', resource: 'ultimate', ultCost: 1500, duration: 4.5, effect: 'pulse',
    params: { pulses: 3, interval: 1.5, reveal: 1.5, global: true }, botUse: { when: 'always', range: [0, 0], chance: 1 }, color: 0xffd040 },
  { id: 'picketswarm', code: 'AX2', name: 'Picket Swarm', category: 'reward', activation: 'instant', resource: 'ultimate', ultCost: 1500, duration: 6, effect: 'swarm',
    params: { dps: 12, targets: 3, global: true }, botUse: { when: 'always', range: [0, 0], chance: 1 }, color: 0x90a040 },
  { id: 'surgecombo', code: 'AX3', name: 'Speed Rush', category: 'reward', activation: 'instant', resource: 'ultimate', ultCost: 100, duration: 20, effect: 'buff',
    params: { speed: 1.4 }, botUse: { when: 'moving', range: [0, 60], chance: 1 }, color: 0x60c0ff },
  { id: 'boostercombo', code: 'AX4', name: 'Booster', category: 'reward', activation: 'instant', resource: 'ultimate', ultCost: 100, duration: 20, effect: 'buff',
    params: { regen: 5 }, botUse: { when: 'lowHealth', range: [0, 60], chance: 1 }, color: 0x60ff90 },
  { id: 'veilcombo', code: 'AX5', name: 'Veil', category: 'reward', activation: 'instant', resource: 'ultimate', ultCost: 100, duration: 20, effect: 'buff',
    params: { invisible: true }, botUse: { when: 'escape', range: [0, 60], chance: 1 }, color: 0x9be7ff },
  { id: 'berserkcombo', code: 'AX6', name: 'Berserk', category: 'reward', activation: 'instant', resource: 'ultimate', ultCost: 100, duration: 20, effect: 'buff',
    params: { rate: 1.5 }, botUse: { when: 'enemyVisible', range: [0, 40], chance: 1 }, color: 0xff5030 },
  { id: 'ampedrounds', code: 'AX7', name: 'Amped Rounds', category: 'reward', activation: 'instant', resource: 'ultimate', ultCost: 500, duration: 30, effect: 'buff',
    params: { damage: 1.25 }, botUse: { when: 'enemyVisible', range: [0, 40], chance: 1 }, color: 0xff9030 },
];

Data.define('abilities', ABILITY_SCHEMA, ABILITY_ROWS);
CAT.abilities.forEach((row, index) => { row.index = index; });

// Hero kits (RS09). health/armor/shield are the hero pools (HPP05); weapons: the loadout (the last key is drawn);
// move: the hero's movement preset; passive: { kind, ... } handled by S12 (knockbackResist, killHaste, shieldRegen, ability,
// flag: read by other sections through Abilities.passiveFlag); regen: the HPP05 support role regen S11 gives the support role;
// gadget: the gadget slot the items section fills (G09, G19); slots: ability ids per slot ('' = none).
Data.define('heroes', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, role: REQUIRED, health: REQUIRED, armor: 0, shield: 0, weapons: REQUIRED, move: 'modern',
  passive: { kind: 'none' }, gadget: '', ability1: '', ability2: '', ultimate: '', color: 0xffffff,
}, [
  { id: 'bastide', code: 'H01', name: 'Bastide', role: 'tank', health: 400, armor: 150, weapons: ['bulwark', 'scattergun'], move: 'knight',
    passive: { kind: 'knockbackResist', value: 0.3 }, ability1: 'aegisdome', ultimate: 'orbital', color: 0x5a7fbf },
  { id: 'moraine', code: 'H02', name: 'Moraine', role: 'tank', health: 350, shield: 200, weapons: ['hailstorm'], move: 'vanguard',
    passive: { kind: 'shieldRegen', delay: 1.5, rate: 30 }, ability1: 'grapnel', ability2: 'ampwall', ultimate: 'rally', color: 0x4fa08a },
  { id: 'quill', code: 'H03', name: 'Quill', role: 'damage', health: 200, weapons: ['tempest'], move: 'agile',
    passive: { kind: 'killHaste', speed: 1.25, seconds: 2.5 }, ability1: 'surge', ability2: 'rewind', ultimate: 'overcore', color: 0xe0a030 },
  { id: 'tessaly', code: 'H04', name: 'Tessaly', role: 'damage', health: 200, weapons: ['heron'], move: 'agile',
    passive: { kind: 'flag', flag: 'scopeInfo' }, ability1: 'glidepack', ability2: 'echopulse', ultimate: 'rift', color: 0x9a5fd0 },
  { id: 'brask', code: 'H05', name: 'Brask', role: 'damage', health: 225, weapons: ['pitcher'], move: 'modern',
    passive: { kind: 'flag', flag: 'extraGrenade' }, gadget: 'singularity', ability1: 'fence', ultimate: 'orbital', color: 0xd06030 },
  { id: 'lark', code: 'H06', name: 'Lark', role: 'support', health: 200, weapons: ['linker'], move: 'agile',
    passive: { kind: 'regen' }, ability1: 'mender', ability2: 'secondwind', ultimate: 'rally', color: 0x60d080 },
  { id: 'mirelle', code: 'H07', name: 'Mirelle', role: 'support', health: 225, weapons: ['needlethorn'], move: 'modern',
    passive: { kind: 'flag', flag: 'smokeVision' }, ability1: 'veil', ability2: 'mesmer', ultimate: 'timebend', color: 0x8080e0 },
  { id: 'tamsin', code: 'H08', name: 'Tamsin', role: 'initiator', health: 200, weapons: ['longshot'], move: 'agile',
    passive: { kind: 'ability', ability: 'tracker' }, gadget: 'dart', ability1: 'scoutdrone', ultimate: 'seerpulse', color: 0xc0c040 },
]);

// Ability kits outside hero rulesets (ABL-001): which ruleset, economy or mutator hands them out, the default slots and
// the abilities a loadout may pick per slot (choices; [] = fixed). A kit applies when its `match` test passes, first row first.
// cooldowns: { slotName: seconds } replaces the row cooldown in this kit (ECP04 field upgrades recharge in 60-120 s).
// match: { ruleset } bundle id | { mutator } mutator id | { economy } economy key.
Data.define('abilityKits', {
  id: REQUIRED, name: REQUIRED, match: REQUIRED, ability1: '', ability2: '', ultimate: '', passive: '', choices: {}, cooldowns: {},
}, [
  { id: 'powers', name: 'Powers for All', match: { mutator: 'powers' }, ability1: 'shadowstep',
    choices: { ability1: ['shadowstep', 'phaseslip', 'grapnel', 'surge', 'rewind', 'updraft', 'glidepack', 'relocator', 'echopulse', 'huntersight', 'scoutdrone',
      'tracker', 'veil', 'fence', 'timebend', 'gale', 'binding', 'mesmer', 'puppet', 'frenzy', 'mender', 'aegisdome', 'secondwind', 'ampwall', 'arcbolt',
      'ignite', 'frostlance', 'swarm', 'holodouble'] } },
  { id: 'suit', name: 'Weave Suit', match: { ruleset: 'suit' }, ability1: 'bulwark', ability2: 'phantasm', ultimate: 'overdrive',
    choices: { ability1: ['bulwark', 'colossusweave'], ability2: ['phantasm', 'colossusweave'], ultimate: ['overdrive', 'colossusweave'] } },
  { id: 'frame', name: 'Frame Runner', match: { ruleset: 'frame' }, ability1: 'shadowstep', ability2: 'arcbolt', ultimate: 'timebend',
    choices: { ability1: ['shadowstep', 'surge', 'glidepack', 'phaseslip'], ability2: ['arcbolt', 'ignite', 'frostlance', 'gale'], ultimate: ['timebend', 'huntersight', 'lifterpower'] } },
  // ECP04 field upgrade slot: Echo Pulse is the one ability field upgrade (G13, G22, G23, G24 come from the items section;
  // a class with a gadget field upgrade leaves this slot empty).
  { id: 'classes', name: 'Class Loadout', match: { economy: 'classes' }, ability1: 'echopulse', choices: { ability1: ['echopulse'] }, cooldowns: { ability1: 90 } },
]);
