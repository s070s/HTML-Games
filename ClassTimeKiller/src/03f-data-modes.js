// Game modes M01..M30 (spec section 13). A mode is this data row plus a small behaviour object that S13
// registers with Modes.register(id, ...); a row without a behaviour is listed but not yet playable.
// teams: 0 free-for-all, 1 everyone on one side (PvE), 2 two teams. sizeDefault: total participants (player + bots).
// scoreBy: what decides the leader - kills | objective | tickets | rounds | survival | pve.
// rounds: { winsNeeded, limit (max rounds), live (s, 0 = none), freeze (s), switchAt (rounds before the side switch), endDelay (s) }.
// respawn: normal (ruleset respawn timers) | round (only at round start) | none.
// useButton: the mode needs Use held (plant, defuse, arm, loot swap, chamber buttons), so the touch USE button shows (INP-004).
// rules: ruleset defaults set at the first build stage (MOV-001); a bundle that writes the same field wins.
// params: numbers read by the mode behaviour (params.pickups: false = no map pickups, a pickup key = only that pickup's spots); params.economy names an economy the mode brings itself (it wins over
// rules.economy, because every bundle writes an economy).
// Times are seconds; values marked T in the spec are tunable starting values.

const MODE_SCORING = { kill: 1, suicide: -1, teamKill: -1, capture: 5, return: 1, plant: 2, defuse: 2, hold: 1 };
const BOMB_ROUNDS = { winsNeeded: 7, limit: 13, live: 100, freeze: 15, switchAt: 6, endDelay: 5 };
const BOMB_PARAMS = { plantTime: 4, fuse: 40, defuseTime: 7, defuseCheckpoint: 3.5, defuseRange: 1.5, blastRadius: 15 };
const CAPTURE_PARAMS = { captureTime: 8, captureStack: 0.5, captureMax: 2 };
const NO_KILL_SCORING = { kill: 0, suicide: 0, teamKill: 0 };   // modes that score only by their own rule (relic time, ladder tier, ...)
// M16 weapon ladder (ECP06): one weapon per tier, kill to climb; the last tier is the melee weapon. params.tiers plays
// the first tiers - 1 weapons plus the melee tier.
const GUNGAME_LADDER = ['tempest', 'vanguard', 'ratchet', 'pulsecarbine', 'wasp', 'hornet', 'riptide', 'scattergun', 'hookjaw', 'shardcaster',
  'kestrel', 'lancet', 'heron', 'ramjet', 'ember', 'verdict', 'warden', 'maul'];

Data.define('modes', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, teams: 0, sizeDefault: 8, scoreLimit: 0, timeLimit: 600, scoreBy: 'kills',
  rounds: null, respawn: 'normal', rules: {}, objective: 'none', params: {}, scoring: {}, tiebreak: 'suddenDeath', ruleset: 'classic',
  family: 'versus', useButton: false,
}, [
  { id: 'ffa', code: 'M01', name: 'Frenzy', teams: 0, sizeDefault: 8, scoreLimit: 25, timeLimit: 600, rules: { respawn: { delay: 2, forced: 10 } } },
  { id: 'tdm', code: 'M02', name: 'Team Clash', teams: 2, sizeDefault: 8, scoreLimit: 50, timeLimit: 600, rules: { friendlyFire: 0 } },
  { id: 'duel', code: 'M03', name: 'Duel', teams: 0, sizeDefault: 2, scoreLimit: 0, timeLimit: 600, params: { activePlayers: 2, queue: 'winnerStays' } },
  { id: 'ctf', code: 'M04', name: 'Flag Raid', teams: 2, sizeDefault: 10, scoreLimit: 3, timeLimit: 900, scoreBy: 'objective', objective: 'flag', params: { returnTime: 20, homeRequired: true, neutral: false } },
  { id: 'oneflag', code: 'M05', name: 'Lone Flag', teams: 2, sizeDefault: 8, scoreLimit: 5, timeLimit: 900, scoreBy: 'objective', objective: 'flag', params: { returnTime: 20, homeRequired: false, neutral: true } },
  { id: 'dom', code: 'M06', name: 'Holdfast', teams: 2, sizeDefault: 8, scoreLimit: 200, timeLimit: 600, scoreBy: 'objective', objective: 'point', params: Object.assign({ tickInterval: 2, tickPoints: 1 }, CAPTURE_PARAMS), ruleset: 'modern' },
  { id: 'conquest', code: 'M07', name: 'Frontline', teams: 2, sizeDefault: 16, scoreLimit: 0, timeLimit: 1200, scoreBy: 'tickets', objective: 'point', params: Object.assign({ tickets: 150, deathCost: 1, bleedHeld: 2, bleedInterval: 3, spawnAtOwned: true }, CAPTURE_PARAMS), ruleset: 'modern' },
  { id: 'rush', code: 'M08', name: 'Breach Assault', useButton: true, teams: 2, sizeDefault: 16, timeLimit: 0, scoreBy: 'tickets', objective: 'bombsite', params: Object.assign({}, BOMB_PARAMS, { tickets: 75, stages: 3, perStage: 2, fuse: 30, defuseTime: 5, defuseCheckpoint: 0 }), ruleset: 'modern' },
  { id: 'hardpoint', code: 'M09', name: 'Hotpoint', teams: 2, sizeDefault: 8, scoreLimit: 150, timeLimit: 600, scoreBy: 'objective', objective: 'hill', params: { moveInterval: 60, holdRate: 1 }, ruleset: 'modern' },
  { id: 'oddball', code: 'M10', name: 'Relic Run', teams: 0, sizeDefault: 8, scoreLimit: 100, timeLimit: 600, scoreBy: 'objective', objective: 'relic', params: { holdRate: 1, carrierMeleeOnly: true, returnTime: 30 }, scoring: NO_KILL_SCORING },
  { id: 'payload', code: 'M11', name: 'Convoy', teams: 2, sizeDefault: 10, timeLimit: 240, scoreBy: 'objective', objective: 'payloadPath', params: { speed: 1.2, maxSpeed: 1.8, pushStack: 0.25, rollbackAfter: 10, rollbackSpeed: 0.5, checkpoints: 3, checkpointTime: 120 }, ruleset: 'heroes' },
  { id: 'control', code: 'M12', name: 'Uplink', teams: 2, sizeDefault: 10, timeLimit: 0, scoreBy: 'rounds', objective: 'point', rounds: { winsNeeded: 2, limit: 3, live: 0, freeze: 5, switchAt: 0, endDelay: 5 }, params: Object.assign({}, CAPTURE_PARAMS, { captureTime: 10, progressTime: 100, overtimeAt: 0.99 }), ruleset: 'heroes' },
  { id: 'bomb', code: 'M13', name: 'Detonate', useButton: true, teams: 2, sizeDefault: 10, timeLimit: 0, scoreBy: 'rounds', objective: 'bombsite', rounds: BOMB_ROUNDS, respawn: 'round', params: BOMB_PARAMS, tiebreak: 'draw', ruleset: 'tactical' },
  { id: 'elim', code: 'M14', name: 'Last Squad', teams: 2, sizeDefault: 8, timeLimit: 0, scoreBy: 'rounds', rounds: { winsNeeded: 5, limit: 9, live: 90, freeze: 5, switchAt: 0, endDelay: 4 }, respawn: 'round', params: { shrinkTime: 30, shrinkMinRadius: 5, zoneDamage: 5 }, tiebreak: 'draw', ruleset: 'modern' },
  { id: 'lms', code: 'M15', name: 'Last Standing', teams: 0, sizeDefault: 8, timeLimit: 600, scoreBy: 'survival', rules: { lives: 3 }, params: { startArmor: 100, allWeapons: true, maxAmmo: true, pickups: 'springboots' } },
  { id: 'gungame', code: 'M16', name: 'Arms Ladder', teams: 0, sizeDefault: 8, timeLimit: 600, scoreBy: 'objective', params: { economy: 'ladder', tiers: 18, meleeDemotes: true, ladder: GUNGAME_LADDER }, scoring: NO_KILL_SCORING },
  { id: 'infection', code: 'M17', name: 'Blight', teams: 2, sizeDefault: 12, timeLimit: 300, scoreBy: 'survival', params: { infectedPerPlayers: 6, infectAfter: 20, infectedHealth: 300, leapSpeed: 8, leapLift: 3 } },
  { id: 'juggernaut', code: 'M18', name: 'Colossus', teams: 0, sizeDefault: 8, scoreLimit: 15, timeLimit: 600, scoreBy: 'objective', params: { healthMult: 3, damageMult: 1.5 }, scoring: NO_KILL_SCORING },
  { id: 'cursetag', code: 'M19', name: 'Curse Tag', teams: 0, sizeDefault: 8, scoreLimit: 20, timeLimit: 600, params: { cursedHealth: 50, meleeOnly: true, passOnTag: false, beaconRadius: 2 }, scoring: NO_KILL_SCORING },
  { id: 'royale', code: 'M20', name: 'Last Ring', useButton: true, teams: 0, sizeDefault: 18, timeLimit: 0, scoreBy: 'survival', respawn: 'none', params: { squadSize: 3, ringWait: [30, 25, 25, 20, 15, 10], ringShrink: [30, 25, 20, 20, 15, 15], ringDamage: [2, 4, 8, 12, 16, 20], squadBeacons: 1,
    ringScale: [0.65, 0.45, 0.3, 0.18, 0.08, 0], rarityWeights: [45, 28, 15, 9, 3], pickups: false, shieldByRarity: [50, 75, 100, 125, 125] }, ruleset: 'royale' },
  { id: 'horde', code: 'M21', name: 'Siege Waves', teams: 1, sizeDefault: 4, timeLimit: 0, scoreBy: 'pve', params: { economy: 'waveShop', coreHealth: 5000, waves: 10, miniBossWave: 5, bossWave: 10, retries: 2, souls: true }, family: 'pve', ruleset: 'modern' },
  { id: 'endless', code: 'M22', name: 'Endless Hold', teams: 1, sizeDefault: 4, timeLimit: 0, scoreBy: 'pve', params: { scalePerWave: 0.08, scaleCap: 4, extractEvery: 5, souls: true }, family: 'pve', ruleset: 'modern' },
  { id: 'bank', code: 'M23', name: 'Mote Rush', teams: 2, sizeDefault: 8, timeLimit: 0, scoreBy: 'objective', objective: 'bank', params: { blockerAt: [5, 10, 15], invasionAt: 50, bossAt: 100 }, family: 'pve', ruleset: 'modern' },
  { id: 'bearer', code: 'M24', name: 'Flame Bearer', teams: 0, sizeDefault: 8, scoreLimit: 120, timeLimit: 600, scoreBy: 'objective', params: { holdRate: 1, damageMult: 3, returnTime: 30 } },
  { id: 'roulette', code: 'M25', name: 'Roulette Arms', teams: 0, sizeDefault: 8, scoreLimit: 25, timeLimit: 600, params: { rotateEvery: 30, infiniteAmmo: true, pickups: false } },
  { id: 'fiends', code: 'M26', name: 'Ravager vs Fiends', teams: 2, sizeDefault: 3, timeLimit: 0, scoreBy: 'rounds', respawn: 'round', rounds: { winsNeeded: 3, limit: 5, live: 0, freeze: 5, switchAt: 0, endDelay: 5 }, params: { ravagerHealth: 175, ravagerArmor: 125, reviveTime: 20 }, ruleset: 'ravager' },
  { id: 'ghostops', code: 'M27', name: 'Ghost Ops', useButton: true, teams: 2, sizeDefault: 10, timeLimit: 0, scoreBy: 'rounds', objective: 'bombsite', rounds: BOMB_ROUNDS, respawn: 'round', params: Object.assign({ cloakWhenStill: true, attackerLoadout: ['tanto', 'warden'], stillSpeed: 0.5, revealTime: 1 }, BOMB_PARAMS), tiebreak: 'draw', ruleset: 'tactical' },
  { id: 'contract', code: 'M28', name: 'Silent Contract', teams: 1, sizeDefault: 1, timeLimit: 0, scoreBy: 'pve', params: { stealth: true, ghostBonus: true, noKillBonus: true }, family: 'solo', ruleset: 'modern' },
  { id: 'attrition', code: 'M29', name: 'Attrition', teams: 2, sizeDefault: 8, scoreLimit: 300, timeLimit: 900, params: { fodderPoints: 1, heavyPoints: 3, botPoints: 5 }, scoring: { kill: 5 }, family: 'pve', ruleset: 'pilot' },
  { id: 'range', code: 'M30', name: 'Firing Range', teams: 0, sizeDefault: 1, timeLimit: 0, scoreBy: 'pve', family: 'solo' },
  { id: 'puzzle', code: 'M31', name: 'Test Chambers', useButton: true, teams: 0, sizeDefault: 1, timeLimit: 0, scoreBy: 'pve', family: 'solo', ruleset: 'modern' },
]);
