// Game modes M01..M31 (spec section 13). A mode is this data row plus a small behaviour object that S13
// registers with Modes.register(id, ...); a row without a behaviour is listed but not yet playable.
// goal: the one-line goal text (Play screen summary, the match start banner, pause > Rules); no number of another field in it.
// goalDetail: the rules the goal line leaves out, shown under it in pause > Rules; {key} = that mode param of the match.
// teams: 0 free-for-all, 1 everyone on one side (PvE), 2 two teams. sizeDefault: total participants (player + bots).
// scoreBy: what decides the leader - kills | objective | tickets | rounds | survival | pve.
// rounds: { winsNeeded, limit (max rounds), live (s, 0 = none), freeze (s), switchAt (rounds before the side switch), endDelay (s) }.
// respawn: normal (ruleset respawn timers) | round (only at round start) | none.
// useButton: the mode needs Use held (plant, defuse, arm, loot swap, chamber buttons), so the touch USE button shows (INP-004).
// rules: ruleset defaults set at the first build stage (MOV-001); a bundle that writes the same field wins.
// params: numbers read by the mode behaviour (params.pickups: false = no map pickups, a pickup key = only that pickup's spots; params.fixedSides: the mode sets the sides itself, so auto-balance never moves anyone); params.economy names an economy the mode brings itself (it wins over
// rules.economy, because every bundle writes an economy).
// variantOf / variant (P4-02): the menus list 15 modes. A row with variantOf names its parent mode and plays as a variant of it;
// variant is the short label of the choice (a parent row has one too: its own default variant). Every row keeps its id and code, so saves,
// share codes, maps, the ladder and the daily seed need no migration.
// Times are seconds; values marked T in the spec are tunable starting values.

const MODE_SCORING = { kill: 1, suicide: -1, teamKill: -1, capture: 5, return: 1, plant: 2, defuse: 2, hold: 1 };
const BOMB_ROUNDS = { winsNeeded: 7, limit: 13, live: 100, freeze: 15, switchAt: 6, endDelay: 5 };
const BOMB_PARAMS = { plantTime: 4, fuse: 40, defuseTime: 7, defuseCheckpoint: 3.5, defuseRange: 1.5, blastRadius: 15 };
const CAPTURE_PARAMS = { captureTime: 8, captureStack: 0.5, captureMax: 2 };
const NO_KILL_SCORING = { kill: 0, suicide: 0, teamKill: 0 };   // modes that score only by their own rule (relic time, ladder tier, ...)
// M16 weapon ladder (ECP06): one weapon per tier, kill to climb; the last tier is the melee weapon. 12 tiers: eight bots
// finish inside the 10-minute limit on every tested seed (14 tiers took 7.5-11 minutes, 18 always ran out). A custom
// params.tiers plays the first tiers - 1 plus the melee tier.
const GUNGAME_LADDER = ['vanguard', 'ratchet', 'wasp', 'hornet', 'needlethorn', 'scattergun', 'hookjaw', 'shardcaster', 'kestrel', 'lancet', 'heron', 'maul'];

// M17 Blight: one in infectedPerPlayers starts infected on infectedArea square metres of walkable floor, more on a bigger
// one (13f outbreakSize). blight-01: at 450 HP Spire's 2 infected won all 6 test matches and at 340 Gantry's humans won 5 of 6.
// Once infected bots planned the ledges their leap clears (14c), 375 HP on 3500 m2 won all 8 on Spire and 2 of 8 on Gantry:
// 335 HP on 3000 m2 (Gantry 4 infected, Spire still 2) wins 4 of 8 on each. Leaping at full speed from a gap's run-up (14c)
// made that 5 of 8 on Spire and Spire's 11-bot probe ended in 178 s: 320 HP wins 6 of 8 on Spire, 4 of 8 on Gantry (325-340
// went 5-7 of 8 on Spire: the split is noisy, the probe needs 320-325).
const BLIGHT_PARAMS = { fixedSides: true, infectedPerPlayers: 6, infectedArea: 3000, infectAfter: 20, infectedHealth: 320, leapSpeed: 8, leapLift: 3 };

Data.define('modes', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, goal: '', goalDetail: '', teams: 0, sizeDefault: 8, scoreLimit: 0, timeLimit: 600, scoreBy: 'kills',
  rounds: null, respawn: 'normal', rules: {}, objective: 'none', params: {}, scoring: {}, tiebreak: 'suddenDeath', ruleset: 'classic',
  family: 'versus', useButton: false, variantOf: '', variant: '',
}, [
  { id: 'ffa', code: 'M01', name: 'Frenzy', variant: 'Classic', goal: 'Every kill scores. Reach the limit first.', scoreLimit: 25, rules: { respawn: { delay: 2, forced: 10 } } },
  { id: 'tdm', code: 'M02', name: 'Team Clash', variant: 'Classic', goal: 'Kills score for your team.', teams: 2, scoreLimit: 50, rules: { friendlyFire: 0 } },
  { id: 'duel', code: 'M03', name: 'Duel', variantOf: 'ffa', variant: 'Duel 1v1', goal: 'One on one; the winner stays on.', sizeDefault: 2, params: { activePlayers: 2, queue: 'winnerStays' } },
  { id: 'ctf', code: 'M04', name: 'Flag Raid', variant: 'Two flags', goal: 'Take the enemy flag home while yours is there.', teams: 2, sizeDefault: 10, scoreLimit: 3, timeLimit: 900, scoreBy: 'objective', objective: 'flag', params: { returnTime: 20, homeRequired: true, neutral: false } },
  { id: 'oneflag', code: 'M05', name: 'Lone Flag', variantOf: 'ctf', variant: 'One flag (Lone Flag)', goal: 'Carry the flag into the enemy base.', teams: 2, scoreLimit: 5, timeLimit: 900, scoreBy: 'objective', objective: 'flag', params: { returnTime: 20, homeRequired: false, neutral: true } },
  { id: 'dom', code: 'M06', name: 'Holdfast', variant: 'Three points', goal: 'Hold points: each one held scores.', teams: 2, scoreLimit: 200, scoreBy: 'objective', objective: 'point', params: Object.assign({ tickInterval: 2, tickPoints: 1 }, CAPTURE_PARAMS), ruleset: 'modern' },
  { id: 'conquest', code: 'M07', name: 'Frontline', variantOf: 'dom', variant: 'Tickets (Frontline)', goal: 'Hold points and stay alive to drain enemy tickets.', teams: 2, sizeDefault: 16, timeLimit: 1200, scoreBy: 'tickets', objective: 'point', params: Object.assign({ tickets: 150, deathCost: 1, bleedHeld: 2, bleedInterval: 3, spawnAtOwned: true }, CAPTURE_PARAMS), ruleset: 'modern' },
  { id: 'rush', code: 'M08', name: 'Breach Assault', variantOf: 'bomb', variant: 'Stages and tickets (Breach Assault)', goal: 'Attackers arm relays with Use; defenders stop them.', useButton: true, teams: 2, sizeDefault: 16, timeLimit: 0, scoreBy: 'tickets', objective: 'bombsite', params: Object.assign({}, BOMB_PARAMS, { tickets: 75, deathCost: 1, stages: 3, perStage: 2, fuse: 30, defuseTime: 5, defuseCheckpoint: 0 }), ruleset: 'modern' },
  { id: 'hardpoint', code: 'M09', name: 'Hotpoint', variantOf: 'dom', variant: 'Moving hill (Hotpoint)', goal: 'Hold the moving hill to score.', teams: 2, scoreLimit: 150, scoreBy: 'objective', objective: 'hill', params: { moveInterval: 60, holdRate: 1 }, ruleset: 'modern' },
  { id: 'oddball', code: 'M10', name: 'Relic Run', variant: 'Relic', goal: 'Hold the relic to score; its carrier uses melee.', scoreLimit: 100, scoreBy: 'objective', objective: 'relic', params: { holdRate: 1, carrierMeleeOnly: true, returnTime: 30 }, scoring: NO_KILL_SCORING },
  { id: 'payload', code: 'M11', name: 'Convoy', goal: 'Attackers push the convoy; defenders hold it.', teams: 2, sizeDefault: 10, timeLimit: 240, scoreBy: 'objective', objective: 'payloadPath', params: { speed: 1.2, maxSpeed: 1.8, pushStack: 0.25, rollbackAfter: 10, rollbackSpeed: 0.5, checkpoints: 3, checkpointTime: 120 }, ruleset: 'heroes' },
  { id: 'control', code: 'M12', name: 'Uplink', variantOf: 'dom', variant: 'Uplink rounds', goal: 'Capture the uplink to win the round.', teams: 2, sizeDefault: 10, timeLimit: 0, scoreBy: 'rounds', objective: 'point', rounds: { winsNeeded: 2, limit: 3, live: 240, freeze: 5, switchAt: 0, endDelay: 5 }, params: Object.assign({}, CAPTURE_PARAMS, { captureTime: 10, progressTime: 100, overtimeAt: 0.99 }), ruleset: 'heroes' },
  { id: 'bomb', code: 'M13', name: 'Detonate', variant: 'Classic', goal: 'Attackers plant with Use; defenders defuse.', useButton: true, teams: 2, sizeDefault: 10, timeLimit: 0, scoreBy: 'rounds', objective: 'bombsite', rounds: BOMB_ROUNDS, respawn: 'round', params: BOMB_PARAMS, tiebreak: 'draw', ruleset: 'tactical' },
  { id: 'elim', code: 'M14', name: 'Last Squad', variantOf: 'tdm', variant: 'One-life rounds (Last Squad)', goal: 'One life per round. Wipe out the other team.', teams: 2, timeLimit: 0, scoreBy: 'rounds', rounds: { winsNeeded: 5, limit: 9, live: 90, freeze: 5, switchAt: 0, endDelay: 4 }, respawn: 'round', params: { shrinkTime: 30, shrinkMinRadius: 5, zoneDamage: 5 }, tiebreak: 'draw', ruleset: 'modern' },
  { id: 'lms', code: 'M15', name: 'Last Standing', variantOf: 'ffa', variant: 'Lives (Last Standing)', goal: 'Limited lives. Be the last one standing.', scoreBy: 'survival', rules: { lives: 3 }, params: { startArmor: 100, allWeapons: true, maxAmmo: true, pickups: 'springboots' } },
  { id: 'gungame', code: 'M16', name: 'Arms Ladder', variantOf: 'ffa', variant: 'Arms Ladder', goal: 'Each kill gives the next gun; win with melee.', goalDetail: 'A melee kill also sets the victim one gun back on the ladder.', scoreBy: 'objective', params: { economy: 'ladder', meleeDemotes: true, ladder: GUNGAME_LADDER }, scoring: NO_KILL_SCORING },
  { id: 'infection', code: 'M17', name: 'Blight', goal: 'Humans outlast the clock; a human who dies joins the Blight.',
    goalDetail: 'The Blight breaks out after {infectAfter} s: its members are tough, melee only and leap when they jump.', teams: 2, sizeDefault: 12, timeLimit: 300, scoreBy: 'survival', params: BLIGHT_PARAMS },
  { id: 'juggernaut', code: 'M18', name: 'Colossus', variantOf: 'oddball', variant: 'Colossus', goal: 'Kill the Colossus to become it; only it scores.', goalDetail: 'The first kill makes the first Colossus: it is tougher and hits harder.', scoreLimit: 15, scoreBy: 'objective', params: { healthMult: 3, damageMult: 1.5 }, scoring: NO_KILL_SCORING },
  { id: 'cursetag', code: 'M19', name: 'Curse Tag', variantOf: 'oddball', variant: 'Curse (Curse Tag)', goal: 'Kill the cursed; the cursed passes the curse on at the beacon.', goalDetail: 'The cursed is weak and fights with melee only.', scoreLimit: 20, params: { cursedHealth: 50, meleeOnly: true, passOnTag: false, beaconRadius: 2 }, scoring: NO_KILL_SCORING },
  { id: 'royale', code: 'M20', name: 'Last Ring', goal: 'Loot, stay in the ring, be the last standing.', goalDetail: 'The last squad standing wins. Hold Use to swap a gun for the one on the ground.', useButton: true, sizeDefault: 18, timeLimit: 0, scoreBy: 'survival', respawn: 'none', params: { squadSize: 3, ringWait: [30, 25, 25, 20, 15, 10], ringShrink: [30, 25, 20, 20, 15, 15], ringDamage: [2, 4, 8, 12, 16, 20], squadBeacons: 1,
    ringScale: [0.65, 0.45, 0.3, 0.18, 0.08, 0], rarityWeights: [45, 28, 15, 9, 3], pickups: false, shieldByRarity: [50, 75, 100, 125, 125] }, ruleset: 'royale' },
  { id: 'horde', code: 'M21', name: 'Siege Waves', variant: 'Ten waves', goal: 'Defend the core; shop between waves.', teams: 1, sizeDefault: 4, timeLimit: 0, scoreBy: 'pve', params: { economy: 'waveShop', coreHealth: 5000, retries: 2, souls: true }, family: 'pve', ruleset: 'modern' },
  { id: 'endless', code: 'M22', name: 'Endless Hold', variantOf: 'horde', variant: 'Endless (Endless Hold)', goal: 'Survive harder waves; extract to keep your score.', goalDetail: 'Defend the core; reach the extract zone when it opens.', teams: 1, sizeDefault: 4, timeLimit: 0, scoreBy: 'pve', params: { economy: 'waveShop', coreHealth: 5000, scalePerWave: 0.08, scaleCap: 4, extractEvery: 5, souls: true }, family: 'pve', ruleset: 'modern' },
  { id: 'bank', code: 'M23', name: 'Mote Rush', goal: 'Bank the motes of fallen foes; invade the rivals.', teams: 2, timeLimit: 0, scoreBy: 'objective', objective: 'bank', params: { blockerAt: [5, 10, 15], invasionAt: 75, bossAt: 250 }, family: 'pve', ruleset: 'modern' },
  { id: 'bearer', code: 'M24', name: 'Flame Bearer', variantOf: 'oddball', variant: 'Flame (Flame Bearer)', goal: 'Hold the flame to score and hit harder.', goalDetail: 'Kill the bearer to take the flame.', scoreLimit: 120, scoreBy: 'objective', params: { holdRate: 1, damageMult: 3, returnTime: 30 } },
  { id: 'roulette', code: 'M25', name: 'Roulette Arms', variantOf: 'ffa', variant: 'Roulette', goal: 'Everyone shares one random, changing gun.', goalDetail: 'The gun changes every {rotateEvery} s. Every kill scores.', scoreLimit: 25, params: { rotateEvery: 30, infiniteAmmo: true, pickups: false } },
  { id: 'fiends', code: 'M26', name: 'Ravager vs Fiends', goal: 'One Ravager against the Fiends.', goalDetail: 'Wipe the other side out to win a round. A downed Fiend stands up while a partner lives.', teams: 2, sizeDefault: 3, timeLimit: 0, scoreBy: 'rounds', respawn: 'round', rounds: { winsNeeded: 3, limit: 5, live: 180, freeze: 5, switchAt: 0, endDelay: 5 }, params: { fixedSides: true, ravagerHealth: 175, ravagerArmor: 125, reviveTime: 20 }, ruleset: 'ravager' },
  { id: 'ghostops', code: 'M27', name: 'Ghost Ops', variantOf: 'bomb', variant: 'Ghost attackers (Ghost Ops)', goal: 'Cloaked attackers plant; defenders stop them.', useButton: true, teams: 2, sizeDefault: 10, timeLimit: 0, scoreBy: 'rounds', objective: 'bombsite', rounds: BOMB_ROUNDS, respawn: 'round', params: Object.assign({ cloakWhenStill: true, attackerLoadout: ['tanto', 'warden'], attackerBuys: ['armor', 'helmet', 'gadget'], stillSpeed: 0.5, revealTime: 1 }, BOMB_PARAMS), tiebreak: 'draw', ruleset: 'tactical' },
  { id: 'contract', code: 'M28', name: 'Silent Contract', goal: 'Reach the target unseen; fewer kills pay more.', goalDetail: 'Take the relic and reach the extract. Alarms and kills cost points.', teams: 1, sizeDefault: 1, timeLimit: 0, scoreBy: 'pve', params: { stealth: true, ghostBonus: true, noKillBonus: true }, family: 'solo', ruleset: 'modern' },
  { id: 'attrition', code: 'M29', name: 'Attrition', variantOf: 'tdm', variant: 'Minions (Attrition)', goal: 'Kill the rival squad and the fodder.', goalDetail: 'Minions march on each base: kills of minions and players count toward the limit.', teams: 2, scoreLimit: 300, timeLimit: 900, params: { fodderPoints: 1, heavyPoints: 3, botPoints: 5 }, scoring: { kill: 5 }, family: 'pve', ruleset: 'pilot' },
  { id: 'range', code: 'M30', name: 'Firing Range', goal: 'Free practice: shoot targets for timed drills.', goalDetail: 'Your first shot starts the drill clock, and the next shot after a drill starts a new one. Pause > Quit to menu leaves.', sizeDefault: 1, timeLimit: 0, scoreBy: 'pve', family: 'solo' },
  { id: 'puzzle', code: 'M31', name: 'Test Chambers', goal: 'Press buttons with Use to open each chamber.', goalDetail: 'Plates and the cube open doors too: solve a chamber to reach the next.', useButton: true, sizeDefault: 1, timeLimit: 0, scoreBy: 'pve', family: 'solo', ruleset: 'modern' },
]);

// ---- Variants and the Play menu (P4-02, P4-03) ----
// The menus list the parent modes; a Variant choice picks the row. The parent comes first in its list.
function modeParentId(modeId) {
  const row = CAT.modes.byId(modeId);
  return row && row.variantOf ? row.variantOf : modeId;
}
function modeVariantIds(parentId) {
  return [parentId].concat(CAT.modes.filter((row) => row.variantOf === parentId).map((row) => row.id));
}
function modeMenuRows() { return CAT.modes.filter((row) => !row.variantOf); }
// "<mode> - <variant>" for a variant row, the plain name for any other row (an unknown id gives itself).
function modeLabel(modeId) {
  const row = CAT.modes.byId(modeId);
  if (!row) return modeId;
  return row.variantOf ? CAT.modes.byId(row.variantOf).name + ' - ' + row.variant : row.name;
}

// The curated cards at the top of Play, in menu order. mode: the row the card starts (Arms Ladder is a variant row of Frenzy);
// map: its map id; roundWins: rounds to win when it differs from the mode's own (-1 or absent = the mode's). Everything else is the
// mode's row: players (sizeDefault), limits, ruleset. Difficulty is the remembered one, length Standard, team Automatic.
// 5 rounds instead of Detonate's 7 keeps a match near 15 minutes; 7 stays reachable under Advanced.
const MODE_CARDS = [
  { id: 'frenzy', name: 'Frenzy', mode: 'ffa', map: 'spire' },
  { id: 'teamclash', name: 'Team Clash', mode: 'tdm', map: 'skyyard' },
  { id: 'holdfast', name: 'Holdfast', mode: 'dom', map: 'twinkeeps' },
  { id: 'flagraid', name: 'Flag Raid', mode: 'ctf', map: 'twinkeeps' },
  { id: 'detonate', name: 'Detonate', mode: 'bomb', map: 'dustline', roundWins: 5 },
  { id: 'armsladder', name: 'Arms Ladder', mode: 'gungame', map: 'gantry' },
  { id: 'lastring', name: 'Last Ring', mode: 'royale', map: 'isle' },
  { id: 'siegewaves', name: 'Siege Waves', mode: 'horde', map: 'cistern' },
];
// The All modes screen: the 15 menu modes in three groups.
const MODE_GROUPS = [
  { name: 'Versus', modes: ['ffa', 'tdm', 'ctf', 'dom', 'bomb', 'payload'] },
  { name: 'Party', modes: ['oddball', 'infection', 'royale', 'bank', 'fiends'] },
  { name: 'Co-op and solo', modes: ['horde', 'contract', 'range', 'puzzle'] },
];
