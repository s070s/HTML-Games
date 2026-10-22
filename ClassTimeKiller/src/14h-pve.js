// ==== S14 PVE: ENEMY FRAMEWORK ====
// PvE enemies (NPC-001..NPC-008) are ACTOR_KIND.ENEMY actors made from CAT.enemies rows. They reuse the bot layers: the
// view cone, range and line-of-sight ray of the bot perception (14b, BotSense.viewClass / lineOpen / memory), the path
// following and stuck recovery of the bot navigation (14c, BotMove) and the bot motor (14a, look spring + move axes), but
// think with a cheaper brain: a priority list at 4 Hz (flee > dodge grenade > cover when hurt > attack > pursue > idle).
// Attacks run windup (the tell, >= 0.4 s, green = parryable, red = unblockable) -> active -> recover; attack tokens limit
// how many enemies attack one target at once (NPC-005, rules.botSkill.attackers). The director spawns from a finite
// queue out of sight >= 18 m from players, capped per quality preset (PERF-009 Quality.current().enemies), relaxes after
// intensity peaks and removes corpses. 14i holds the behaviour kinds and attack kinds, 14j the PvE modes, 14k the boss.
// Difficulty (DIF-002) read here: playerDamage (damage to the player side), enemyDamage (damage to enemies), parry
// (parry window), projectileSpeed, resourceYield (drop chance; 12a reads it for spot respawns), attackers; 14j reads lives /
// checkpoints, 14a gameSpeed.
// API: docs/api/pve.md.

const ENEMY_TEAM = 1;                     // co-op modes: the players are team 0, the enemies team 1
const BEAST_TEAM = NO_TEAM;               // neutral beasts (E14, X50) are enemies of everybody
const PVE_CORE_TARGET = -2;               // Pve.target value: the mode's core objective
const PVE_MAX_ATTACKS = 4;
const PVE_MIN_TELL = 0.4;                 // NPC-002: every attack telegraphs at least 0.4 s
const PVE_TELL_COLORS = { parry: 0x40ff60, unblockable: 0xff2020, normal: 0xffa030 };
const PVE_CORPSE_SECONDS = 3;             // a dead enemy lies this long, then its actor slot is freed
const PVE_UNSEEN_PENALTY = 15;            // metres added to a remembered (not seen) target when choosing the nearest
const PVE_ATTACKER_BONUS = 6;             // metres taken off the actor that hurt the enemy last
const PVE_FACING_COS = 0.3;               // melee hits need the target roughly in front
const PVE_MELEE_SLACK = 0.5;              // metres of reach past the attack range while the blow lands
const PVE_MOVE_BASE = 'modern';           // movement preset the enemy presets start from (speed per row)
const PVE_TIER_BASE = 'skilled';          // bot tier row the enemy tiers start from (fov / turn / reaction per row)
const PVE_FLEE_DISTANCE = 10;
const PVE_WANDER_RADIUS = 1.5;
const PVE_STILL_FILL = 0.6, PVE_CROUCH_FILL = 0.7;   // BOT-005: still or crouched targets fill the meter slower
const PVE_NOISE_AWARENESS = 0.35;         // a heard noise makes an unaware guard suspicious
const PVE_DECAY_RATE = 0.5;               // awareness per second once unseen for SENSE_AWARE_DECAY_AFTER
const PVE_STAGGER_DAMAGE = 1.5;           // a staggered (wall-stunned) enemy takes x1.5
const PVE_DODGE_PROJECTILES = ['grenade', 'mine', 'rocket'];
const PVE_GOAL = { IDLE: 0, PURSUE: 1, ATTACK: 2, FLEE: 3, DODGE: 4, COVER: 5, OBJECTIVE: 6, LURE: 7, SEARCH: 8, PATROL: 9, FALLBACK: 10 };
const ATTACK_PHASE = { IDLE: 0, WINDUP: 1, ACTIVE: 2, RECOVER: 3 };
const AWARENESS = { UNAWARE: 0, SUSPICIOUS: 1, SEARCHING: 2, ALERT: 3 };
const STAGGER_CAUSE = { DAMAGE: 'damage', PARRY: 'parry', WALL: 'wall' };   // unstoppable champions ignore DAMAGE staggers
const PVE_TELL_SOUNDS = { parry: 'abilityCast', unblockable: 'pingDanger', normal: 'grenadeTick' };
const PVE_SHIELD_COLOR = 0xa0d0ff;        // shell colour of a shield without an element
const PVE_CHAMPION_RING = 1.4;            // ring diameter at size 1 under a champion
const PVE_SHELL_HEIGHTS = [0.45, 1.05, 1.55];   // shield rings around the body at size 1
const PART_TINTS = { body: 0, dark: 1, glow: 2, weak: 3, eye: 4 };
const ENEMY_ATTACK_DEFAULTS = {
  id: '', kind: 'melee', damage: 0, range: [0, 2], tell: PVE_MIN_TELL, cooldown: 1, recover: 0.3, parry: false, unblockable: false, shots: 1, gap: 0.1,
  spreadDeg: 0, radius: 0, weapon: '', splashScale: 1, fanDeg: 0, element: 'kinetic', seconds: 0, knockdown: 0, summon: null, limit: 0, searchSeconds: 0,
};
const PROJECTILE_DODGE_TYPES = PVE_DODGE_PROJECTILES.map((key) => CAT.projectiles.byId(key).index);

// ---- Per-row data derived once at load (tier for perception, movement preset, colours) ----
CAT.enemies.forEach((row, index) => prepareEnemyRow(row, index));
function prepareEnemyRow(row, index) {
  row.index = index;
  row.attackRows = row.attacks.map((attack) => Object.assign({}, ENEMY_ATTACK_DEFAULTS, attack));
  row.tier = Object.assign({}, CAT.botTiers.byId(PVE_TIER_BASE), { speed: 1, fov: row.fov, turn: row.turn, reaction: row.reaction, jumps: false });
  row.move = Object.assign({}, CAT.movement.byId(PVE_MOVE_BASE), { groundSpeed: row.speed, sprintSpeed: 0, tacSprintSpeed: 0, extraJumps: 0, slideEntry: 0 });
  row.alertness = clamp((row.sight - SENSE_RANGE_BASE) / SENSE_RANGE_ALERT, 0, 1);   // BotSense range = 25 + 75 x alertness
  row.colors = new Float32Array(15);
  const darker = ((row.color >> 1) & 0x7f7f7f) | 0x101010;
  [row.color, darker, row.glow, row.glow, 0xfff0c0].forEach((color, slot) => writeColor(row.colors, slot * 3, color));
  // Weapons whose projectiles a MELEE / ALT press inside the parry window reflects (green projectile tells).
  row.parryWeapons = row.attackRows.filter((attack) => attack.kind === 'projectile' && attack.parry).map((attack) => CAT.weapons.byId(attack.weapon).index);
}
// Champion glow and element shield colours as floats (drawing reads them every frame).
const PVE_CHAMPION_COLORS = new Float32Array(PVE_CHAMPIONS.length * 3);
PVE_CHAMPIONS.forEach((champion, index) => writeColor(PVE_CHAMPION_COLORS, index * 3, champion.glow));
const PVE_SHIELD_COLORS = new Float32Array((CAT.elements.length + 1) * 3);   // slot 0: no element (Damage.shieldElement 0)
writeColor(PVE_SHIELD_COLORS, 0, PVE_SHIELD_COLOR);
CAT.elements.forEach((element, index) => writeColor(PVE_SHIELD_COLORS, (index + 1) * 3, element.color));

const pveScratch = Vec.make();
const pveAim = Vec.make();
const pveHit = makeActorHit();
const pveWallHit = makeHit();
const pveSpawnPayload = { id: -1 };
const pveEventPayload = { id: -1, attack: '', kind: '', seconds: 0, color: 0, target: -1 };
const pvePartPoint = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };   // an enemy part offset, rotated in place (drawEnemy)
const pvePartInstance = makeShapeInstance();
const pveQueueOptions = { team: ENEMY_TEAM, side: NO_TEAM, huntTeam: NO_TEAM, scale: 1, champion: -1, wave: 0, summoner: -1 };

const Pve = {
  active: false,            // PvE machinery runs (a PvE mode, wildlife, or a test that spawned enemies)
  stealth: false,           // BOT-005 awareness meters gate combat (M28)
  row: new Int16Array(MAX_ACTORS).fill(-1),
  goal: new Uint8Array(MAX_ACTORS), nextThink: new Float64Array(MAX_ACTORS), goalUntil: new Float64Array(MAX_ACTORS),
  target: new Int8Array(MAX_ACTORS).fill(-1), huntTeam: new Int8Array(MAX_ACTORS).fill(NO_TEAM), side: new Int8Array(MAX_ACTORS).fill(NO_TEAM),
  attack: new Int8Array(MAX_ACTORS).fill(-1), phase: new Uint8Array(MAX_ACTORS), phaseEndsAt: new Float64Array(MAX_ACTORS),
  attackTarget: new Int8Array(MAX_ACTORS).fill(-1), shotsLeft: new Uint8Array(MAX_ACTORS), nextShotAt: new Float64Array(MAX_ACTORS),
  tellStart: new Float64Array(MAX_ACTORS), hitDone: new Uint8Array(MAX_ACTORS),
  aimX: new Float32Array(MAX_ACTORS), aimY: new Float32Array(MAX_ACTORS), aimZ: new Float32Array(MAX_ACTORS),
  cooldown: new Float64Array(MAX_ACTORS * PVE_MAX_ATTACKS),
  brokenUntil: new Float64Array(MAX_ACTORS), staggerUntil: new Float64Array(MAX_ACTORS), revealedUntil: new Float64Array(MAX_ACTORS),
  coverUntil: new Float64Array(MAX_ACTORS), coverTaken: new Uint8Array(MAX_ACTORS), lureUntil: new Float64Array(MAX_ACTORS), lureX: new Float32Array(MAX_ACTORS), lureZ: new Float32Array(MAX_ACTORS),
  awareness: new Float32Array(MAX_ACTORS), alarmed: new Uint8Array(MAX_ACTORS), lastThink: new Float64Array(MAX_ACTORS),
  noKnockback: new Uint8Array(MAX_ACTORS),            // unstoppable champions: damage never pushes them
  damageScale: new Float32Array(MAX_ACTORS).fill(1), champion: new Int8Array(MAX_ACTORS).fill(-1), wave: new Int16Array(MAX_ACTORS),
  homeX: new Float32Array(MAX_ACTORS), homeY: new Float32Array(MAX_ACTORS), homeZ: new Float32Array(MAX_ACTORS), homeYaw: new Float32Array(MAX_ACTORS),
  goalX: new Float32Array(MAX_ACTORS), goalY: new Float32Array(MAX_ACTORS), goalZ: new Float32Array(MAX_ACTORS),   // where cover / objective / lure / patrol lead
  diedAt: new Float64Array(MAX_ACTORS), summoner: new Int8Array(MAX_ACTORS).fill(-1), meleeKill: new Uint8Array(MAX_ACTORS),
  weakPool: new Float32Array(MAX_ACTORS), disabledUntil: new Float64Array(MAX_ACTORS),
  parryAt: new Float64Array(MAX_ACTORS).fill(-1e9),   // any actor: last MELEE / ALT press (the parry window counts from it)
  guardian: new Uint8Array(MAX_ACTORS),               // DIF-004 Guardian Plate (damage taken x0.5) for a participant
  raysLeft: 0,
  intensity: 0, peakAt: -1e9,
  encounterSpawned: 0,      // enemies spawned since the mode's last beginEncounter (NPC-007 fallback share)
  spawnPoints: [],          // { x, y, z, yaw, side } director spawn points (filled by the mode)
  queue: { row: new Int16Array(256), champion: new Int8Array(256), side: new Int8Array(256), scale: new Float32Array(256), wave: new Int16Array(256), head: 0, count: 0 },
  core: { active: false, x: 0, y: 0, z: 0, health: 0, max: 0, shield: 0, destroyedAt: -1 },
  wildlife: 0, nextBeastAt: 0,
  objectiveFor: null,       // fn(id, out) -> true when the mode gives an idle enemy somewhere to go (14j)
  stats: { spawned: 0, killed: 0, maxAlive: 0, thinks: 0, rays: 0, attacks: 0, parries: 0 },

  rowOf(id) { const index = this.row[id]; return index >= 0 ? CAT.enemies[index] : null; },
  isEnemy(id) { return Actors.kind[id] === ACTOR_KIND.ENEMY && this.row[id] >= 0; },
  cap() { return Math.min(Quality.current().enemies, MAX_ACTORS); },
  skill() { return Game.match && Game.match.rules && Game.match.rules.botSkill ? Game.match.rules.botSkill : Bots.currentSkill(); },
  aliveCount(side) {
    let alive = 0;
    for (let id = 0; id < Actors.count; id++) if (this.isEnemy(id) && Actors.alive[id] && (side === undefined || this.side[id] === side)) alive++;
    return alive;
  },
  // A living enemy that counts for a mode (range targets and neutral beasts do not).
  isHostile(id) {
    const row = this.rowOf(id);
    return row !== null && Actors.alive[id] === 1 && !row.beast && !row.target;
  },
  hostileCount(side) {
    let alive = 0;
    for (let id = 0; id < Actors.count; id++) if (this.isHostile(id) && (side === undefined || this.side[id] === side)) alive++;
    return alive;
  },

  // ---- Match lifecycle ----
  reset() {
    this.active = false; this.stealth = false; this.intensity = 0; this.peakAt = -1e9;
    this.spawnPoints.length = 0; this.queue.head = 0; this.queue.count = 0; this.encounterSpawned = 0;
    this.core.active = false; this.core.destroyedAt = -1; this.wildlife = 0; this.objectiveFor = null;
    this.guardian.fill(0); this.parryAt.fill(-1e9);
    BotSense.reservedRays = 0;
    for (const key in this.stats) this.stats[key] = 0;
  },
  onMatchStart() {
    const fx = Mutators.fx;
    this.wildlife = fx && fx.wildlife > 0 ? fx.wildlife : 0;
    this.nextBeastAt = Sim.time;
    if (this.wildlife > 0) this.active = true;
  },
  onCreate(id) {
    this.row[id] = -1; this.target[id] = -1; this.attack[id] = -1; this.phase[id] = ATTACK_PHASE.IDLE; this.goal[id] = PVE_GOAL.IDLE;
    this.huntTeam[id] = NO_TEAM; this.side[id] = NO_TEAM; this.champion[id] = -1; this.summoner[id] = -1; this.damageScale[id] = 1;
    this.awareness[id] = 0; this.alarmed[id] = 0; this.guardian[id] = 0; this.parryAt[id] = -1e9; this.weakPool[id] = 0; this.disabledUntil[id] = 0;
    this.hitDone[id] = 0; this.noKnockback[id] = 0; this.coverTaken[id] = 0;
    this.cooldown.fill(0, id * PVE_MAX_ATTACKS, (id + 1) * PVE_MAX_ATTACKS);
    // Timers are absolute sim times and the sim clock restarts per match: clear them all.
    this.brokenUntil[id] = this.staggerUntil[id] = this.revealedUntil[id] = this.coverUntil[id] = this.lureUntil[id] = 0;
    this.nextThink[id] = this.goalUntil[id] = this.phaseEndsAt[id] = this.diedAt[id] = 0;
  },

  // ---- Spawning (ARCHITECTURE spawning contract: position, alive, actor.spawn; then the enemy body overrides S11's pools) ----
  // options: { team, side, huntTeam, scale (health and damage), champion (PVE_CHAMPIONS index), wave, summoner }. Returns the id or -1.
  spawnEnemy(key, x, y, z, yaw, options) {
    const row = typeof key === 'string' ? CAT.enemies.byId(key) : key;
    if (!row) { ErrorLog.add('pve', 'unknown enemy ' + key); return -1; }
    if (this.aliveCount() >= this.cap()) return -1;
    const settings = options || {};
    const team = settings.team === undefined ? (row.beast ? BEAST_TEAM : ENEMY_TEAM) : settings.team;
    const id = Actors.create(ACTOR_KIND.ENEMY, team, row.name, row);
    if (id < 0) return -1;
    this.active = true;
    this.row[id] = row.index;
    this.side[id] = settings.side === undefined ? NO_TEAM : settings.side;
    this.huntTeam[id] = settings.huntTeam === undefined ? NO_TEAM : settings.huntTeam;
    this.damageScale[id] = settings.scale || 1;
    this.champion[id] = settings.champion === undefined ? -1 : settings.champion;
    this.wave[id] = settings.wave || 0;
    this.summoner[id] = settings.summoner === undefined ? -1 : settings.summoner;
    this.place(id, x, y, z, yaw);
    pveSpawnPayload.id = id;
    Bus.emit('actor.spawn', pveSpawnPayload);
    this.setupBody(id, row);
    this.stats.spawned++;
    this.encounterSpawned++;
    this.stats.maxAlive = Math.max(this.stats.maxAlive, this.aliveCount());
    return id;
  },
  place(id, x, y, z, yaw) {
    relocateActor(id, x, y, z, yaw);
    Actors.pitch[id] = Actors.prevPitch[id] = Actors.aimPitch[id] = 0;
    Actors.alive[id] = 1;
    Actors.spawnCount[id]++;
    this.homeX[id] = x; this.homeY[id] = y; this.homeZ[id] = z; this.homeYaw[id] = yaw;
    this.setGoalPoint(id, x, y, z);
  },
  // After every section reset its state on actor.spawn: the row's pools, size, movement preset, perception tier, no weapons.
  setupBody(id, row) {
    const champion = this.champion[id] >= 0 ? PVE_CHAMPIONS[this.champion[id]] : null;
    const health = row.health * this.damageScale[id] * (champion && champion.healthMult ? champion.healthMult : 1);
    Actors.health[id] = Actors.maxHealth[id] = health;
    Actors.armor[id] = Actors.maxArmor[id] = 0;
    Actors.shield[id] = Actors.maxShield[id] = row.shield + (champion && champion.shield ? champion.shield : 0);
    const element = CAT.elements.byId(champion && champion.shield ? championElement(row) : row.shieldElement);
    Damage.shieldElement[id] = element ? CAT.elements.indexOf(element) + 1 : 0;   // element rows carry no index field
    Damage.noRegen[id] = 1;
    Weapons.clear(id);
    Move.presetOverride[id] = row.move;
    Hitbox.sizeScale[id] = row.size;
    Hitbox.headScale[id] = row.headScale * (Mutators.fx && Mutators.fx.headScale ? Mutators.fx.headScale : 1);   // the row's head (weak point) size, X14 on top
    this.noKnockback[id] = champion && champion.noKnockback ? 1 : 0;
    if (row.cloaked) Actors.flags[id] |= ACTOR_FLAG.INVISIBLE;
    this.weakPool[id] = row.weakPoint && row.weakPoint.pool ? row.weakPoint.pool : 0;
    this.setupBrain(id, row);
  },
  setupBrain(id, row) {
    Bots.tierRow[id] = row.tier;
    Bots.traits.fill(BOT_TRAIT_NEUTRAL, id * TRAIT_COUNT, (id + 1) * TRAIT_COUNT);
    Bots.traits[id * TRAIT_COUNT + TRAIT.alertness] = row.alertness;
    Bots.lookYaw[id] = Bots.lastLookYaw[id] = Actors.yaw[id];
    Bots.lookPitch[id] = Bots.lastLookPitch[id] = 0;
    Bots.yawVelocity[id] = Bots.pitchVelocity[id] = 0;
    Bots.lastPerceive[id] = Sim.time;
    BotSense.resetBot(id);
    BotSense.alert[id] = this.stealth ? 0 : 1;
    BotCombat.target[id] = -1;
    BotMove.reset(id);
    BotMove.configure(id);
    this.goal[id] = PVE_GOAL.IDLE; this.target[id] = -1; this.attack[id] = -1; this.phase[id] = ATTACK_PHASE.IDLE;
    this.nextThink[id] = Sim.time + (id % 8) / 8 * PVE_DIRECTOR.thinkInterval;   // stagger the 4 Hz brains
    this.lastThink[id] = Sim.time;
  },
  // Frees every enemy slot (wave retry, round start).
  clearEnemies(filter) {
    for (let id = Actors.count - 1; id >= 0; id--) if (this.isEnemy(id) && (!filter || filter(id))) Actors.remove(id);
    if (!filter) { this.queue.head = 0; this.queue.count = 0; }
  },

  // ---- The director queue (NPC-008: finite budgets, PERF-009 caps) ----
  enqueue(key, side, scale, champion, wave) {
    const queue = this.queue, row = CAT.enemies.byId(key);
    if (!row || queue.count >= queue.row.length) return false;
    const slot = (queue.head + queue.count) % queue.row.length;
    queue.row[slot] = row.index; queue.side[slot] = side; queue.scale[slot] = scale || 1;
    queue.champion[slot] = champion === undefined ? -1 : champion; queue.wave[slot] = wave || 0;
    queue.count++;
    this.active = true;
    return true;
  },
  // Queued enemies (swarm rows count every member) of a side, or of all sides.
  pending(side) {
    const queue = this.queue;
    let count = 0;
    for (let k = 0; k < queue.count; k++) {
      const slot = (queue.head + k) % queue.row.length;
      if (side === undefined || queue.side[slot] === side) count += CAT.enemies[queue.row[slot]].group;
    }
    return count;
  },
  // Spawns queued enemies while there is room: out of sight and >= 18 m from the players; a group row brings its swarm.
  serveQueue(now) {
    if (now < this.peakAt + PVE_DIRECTOR.relaxSeconds) return;   // NPC-007: relax after an intensity peak
    for (let spawned = 0; spawned < PVE_DIRECTOR.spawnPerTick && this.queue.count > 0; spawned++) {
      const queue = this.queue, slot = queue.head;
      const row = CAT.enemies[queue.row[slot]];
      if (this.aliveCount() + row.group > this.cap()) return;
      if (!this.spawnQueued(row, queue.side[slot], queue.scale[slot], queue.champion[slot], queue.wave[slot])) return;
      queue.head = (queue.head + 1) % queue.row.length;
      queue.count--;
    }
  },
  // False (the entry stays queued) when not even the first member found a free actor slot (corpses hold slots 3 s).
  spawnQueued(row, side, scale, champion, wave) {
    const point = this.pickSpawn(side, pveScratch);
    if (!point) return false;
    const options = pveQueueOptions;
    options.team = this.teamForSide(side); options.side = side; options.huntTeam = this.huntFor(side);
    options.scale = scale; options.champion = champion; options.wave = wave; options.summoner = -1;
    return this.spawnGroup(row, point.x, point.y, point.z, point.yaw, options) > 0;
  },
  // A row's whole group (a swarm) in a spiral around x, z; returns how many members spawned.
  spawnGroup(row, x, y, z, yaw, options) {
    let spawned = 0;
    for (let member = 0; member < row.group; member++) {
      const angle = member * 2.4, radius = member === 0 ? 0 : PVE_DIRECTOR.spawnSpacing * Math.sqrt(member);
      if (this.spawnEnemy(row, x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius, yaw, options) >= 0) spawned++;
      else if (member === 0) return 0;
    }
    return spawned;
  },
  // Side -1 = the co-op enemy side; sides 0 / 1 = the PvE of that team (bank) or that team's own minions (attrition).
  sideTeam: null,           // fn(side) -> team (14j sets it per mode), else ENEMY_TEAM
  sideHunt: null,           // fn(side) -> the team those enemies hunt (-1 any)
  teamForSide(side) { return this.sideTeam ? this.sideTeam(side) : ENEMY_TEAM; },
  huntFor(side) { return this.sideHunt ? this.sideHunt(side) : NO_TEAM; },
  // Best director spawn point of the side: >= spawnMinDistance from every foe and out of the players' sight; else the farthest.
  pickSpawn(side, out) {
    let best = null, bestScore = -Infinity;
    for (const point of this.spawnPoints) {
      if (point.side !== side && !(side < 0 && point.side < 0)) continue;
      const score = this.spawnScore(point, side);
      if (score > bestScore) { bestScore = score; best = point; }
    }
    if (!best) return this.findBeastSpot(out) ? out : null;   // no point for the side: a reachable node away from the players
    out.x = best.x + Rng.pve.range(-PVE_DIRECTOR.spawnSpacing, PVE_DIRECTOR.spawnSpacing); out.y = best.y;
    out.z = best.z + Rng.pve.range(-PVE_DIRECTOR.spawnSpacing, PVE_DIRECTOR.spawnSpacing); out.yaw = best.yaw;
    return out;
  },
  spawnScore(point, side) {
    let nearest = Infinity, seen = false;
    const hunted = this.huntFor(side);
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || !Modes.participant[id] || (hunted >= 0 && Actors.team[id] !== hunted)) continue;
      const distance = Math.hypot(Actors.x[id] - point.x, Actors.z[id] - point.z);
      nearest = Math.min(nearest, distance);
      if (distance < SENSE_RANGE_BASE + SENSE_RANGE_ALERT && World.lineClear(Actors.x[id], Actors.eyeY(id), Actors.z[id], point.x, point.y + STAND_HEIGHT * 0.8, point.z)) seen = true;
    }
    const safe = nearest >= PVE_DIRECTOR.spawnMinDistance && !seen;
    return (safe ? 1000 : 0) + Math.min(nearest, 200) + Rng.pve.next();
  },

  // ---- Brains (system 'pveBrains', order 11: after the bot brains, before nav and movement) ----
  stepBrains(dt) {
    if (!this.active || (Game.match && Game.match.ended)) return;
    const now = Sim.time;
    this.raysLeft = PVE_DIRECTOR.raysPerTick;
    BotSense.reservedRays = PVE_DIRECTOR.raysPerTick;   // BOT-091: the enemies' rays come out of the bots' per-tick budget
    for (let id = 0; id < Actors.count; id++) {
      if (!this.isEnemy(id) || !Actors.alive[id]) continue;
      this.stepEnemy(id, dt, now);
    }
  },
  stepEnemy(id, dt, now) {
    const row = this.rowOf(id), brain = PveBrains[row.brain];
    Bots.buttonsWanted[id] = 0;
    if (brain.always) brain.always(id, row, now);   // runs even while stunned (boss phase thresholds)
    if (this.stunned(id, now)) { this.cancelAttack(id); Bots.wish(id, 0, 0, 0); Bots.motor(id, dt); return; }
    if (now + TIME_EPSILON >= this.nextThink[id]) this.think(id, row, brain, now);
    this.stepAttack(id, row, now);
    if (brain.step) brain.step(id, row, dt, now);
    if (!Actors.alive[id]) return;   // an attack can end its own enemy (the bomber)
    this.updateCloak(id, row, now);
    PveMove.run(id, row, dt, now, brain);
    Bots.motor(id, dt);
  },
  stunned(id, now) { return (Actors.flags[id] & ACTOR_FLAG.FROZEN) !== 0 || now < this.staggerUntil[id]; },
  think(id, row, brain, now) {
    this.stats.thinks++;
    this.nextThink[id] = now + PVE_DIRECTOR.thinkInterval;
    this.perceive(id, row, now);
    this.lastThink[id] = now;
    if (Damage.hasStatus(id, 'shock')) this.revealedUntil[id] = now + PVE_DIRECTOR.searchSeconds;
    PveMove.updateApproach(id, row, brain, now);
    if (this.phase[id] !== ATTACK_PHASE.IDLE) return;
    if (brain.decide && brain.decide(id, row, now)) return;
    this.decide(id, row, now);
  },
  // Every tick: a cloaked enemy shows for its whole attack (tell, blow, recovery: NPC-002) and while revealed.
  updateCloak(id, row, now) {
    if (!row.cloaked) return;
    const hidden = now >= this.revealedUntil[id] && this.phase[id] === ATTACK_PHASE.IDLE;
    if (hidden) Actors.flags[id] |= ACTOR_FLAG.INVISIBLE; else Actors.flags[id] &= ~ACTOR_FLAG.INVISIBLE;
  },

  // ---- Perception: the bot view cone and line-of-sight ray (14b) with the enemy's own ray budget ----
  // Foes: hostile actors (a huntTeam narrows them to that team); beasts fight everybody but beasts; enemies ignore beasts
  // unless hurt by one, never fight their own side, and fight other hostile enemies only without a huntTeam (M29 minions).
  isFoe(id, other) {
    if (other === id || !Actors.alive[other] || Actors.kind[other] === ACTOR_KIND.NONE) return false;
    if (Actors.flags[other] & ACTOR_FLAG.PROTECTED) return false;   // BOT-040: spawn-protected actors are ignored, as by bots
    const row = this.rowOf(id), otherRow = this.rowOf(other);
    if (row.beast) return !(otherRow && otherRow.beast);
    if (otherRow) return this.enemyIsFoe(id, other, otherRow);
    if (!Actors.isEnemy(id, other)) return false;
    return this.huntTeam[id] < 0 || Actors.team[other] === this.huntTeam[id];
  },
  enemyIsFoe(id, other, otherRow) {
    if (otherRow.beast) return Damage.lastAttacker[id] === other;
    if (otherRow.target || (this.side[id] === this.side[other] && Actors.team[id] === Actors.team[other])) return false;
    return this.huntTeam[id] < 0 && Actors.isEnemy(id, other);
  },
  perceive(id, row, now) {
    let best = -1, bestScore = Infinity;
    const lastAttacker = Damage.lastAttacker[id];
    for (let other = 0; other < Actors.count; other++) {
      if (!this.isFoe(id, other)) continue;
      const seen = this.look(id, other, now), pair = BotSense.pair(id, other);
      if (!seen && now - BotSense.knownAt[pair] > PVE_DIRECTOR.memorySeconds) continue;
      BotSense.perceivedPosition(id, other, pveScratch);
      let score = Math.hypot(pveScratch.x - Actors.x[id], pveScratch.z - Actors.z[id]) + (seen ? 0 : PVE_UNSEEN_PENALTY);
      if (other === lastAttacker) score -= PVE_ATTACKER_BONUS;
      if (score < bestScore) { bestScore = score; best = other; }
    }
    if (best !== this.target[id]) this.coverTaken[id] = 0;   // a new sighting: cover may be taken once more
    this.target[id] = best;
    if (this.stealth) this.updateAwareness(id, best, now);
  },
  // One pair: cone and range (BotSense.viewClass), then one ray (BotSense.lineOpen: walls and smoke) from the enemy budget.
  look(id, other, now) {
    const pair = BotSense.pair(id, other);
    if (BotSense.viewClass(id, other) === 0) { BotSense.lose(pair, now); return false; }
    if (this.raysLeft <= 0) return BotSense.visible[pair] === 1;   // out of rays this tick: keep the last answer
    this.raysLeft--;
    this.stats.rays++;
    if (!BotSense.lineOpen(id, other, pair)) { BotSense.lose(pair, now); return false; }
    if (!BotSense.visible[pair]) BotSense.reactAt[pair] = now + this.reactionSeconds(id);
    BotSense.visible[pair] = 1;
    BotSense.remember(pair, SENSE.SEEN, Actors.x[other], Actors.y[other], Actors.z[other], now);
    BotSense.seenAt[pair] = now;
    if (!this.stealth) BotSense.alert[id] = 1;
    return true;
  },
  reactionSeconds(id) { return Math.max(SENSE_REACTION_FLOOR, Bots.tier(id).reaction / 1000 * Bots.reactionScale()); },
  // BOT-005 meter: fills while the target is seen (0.6 s near .. 2.5 s far; slower when it stands still or crouches), decays
  // after 6 s unseen. Thresholds: suspicious 0.3, searching 0.6, alert 1 (combat, alarm, nearby guards alerted).
  updateAwareness(id, target, now) {
    const elapsed = now - this.lastThink[id];
    if (target >= 0 && BotSense.sees(id, target)) this.fillAwareness(id, target, elapsed);
    else if (target < 0 || now - BotSense.seenAt[BotSense.pair(id, target)] > SENSE_AWARE_DECAY_AFTER) this.awareness[id] = Math.max(0, this.awareness[id] - PVE_DECAY_RATE * elapsed);
    BotSense.alert[id] = this.awareness[id];
    if (this.awareness[id] >= 1 && !this.alarmed[id]) this.raiseAlarm(id, target, now);
    if (this.awareness[id] < PVE_CONTRACT.unaware) this.alarmed[id] = 0;
  },
  fillAwareness(id, target, elapsed) {
    const distance = Math.hypot(Actors.x[target] - Actors.x[id], Actors.z[target] - Actors.z[id]);
    let seconds = lerp(SENSE_FILL_NEAR, SENSE_FILL_FAR, clamp(distance / BotSense.viewRange(id), 0, 1));
    if (Math.hypot(Actors.vx[target], Actors.vz[target]) < SENSE_STILL_SPEED) seconds /= PVE_STILL_FILL;
    if (Actors.flags[target] & ACTOR_FLAG.CROUCHED) seconds /= PVE_CROUCH_FILL;
    this.awareness[id] = Math.min(1, this.awareness[id] + elapsed / seconds);
  },
  raiseAlarm(id, target, now) {
    this.alarmed[id] = 1;
    Bus.emit('pve.alarm', pveEvent(id, '', '', 0, 0, target));
    for (let other = 0; other < Actors.count; other++) {
      if (other === id || !this.isEnemy(other) || !Actors.alive[other] || this.awareness[other] >= 1) continue;
      if (Math.hypot(Actors.x[other] - Actors.x[id], Actors.z[other] - Actors.z[id]) > PVE_CONTRACT.alertRadius) continue;
      this.awareness[other] = 1;
      this.alarmed[other] = 1;
      if (target >= 0) BotSense.remember(BotSense.pair(other, target), SENSE.PINGED, Actors.x[target], Actors.y[target], Actors.z[target], now);
    }
  },
  awarenessState(id) {
    const value = this.awareness[id];
    if (value >= 1) return AWARENESS.ALERT;
    if (value >= PVE_CONTRACT.suspicious) return AWARENESS.SEARCHING;
    return value >= PVE_CONTRACT.unaware ? AWARENESS.SUSPICIOUS : AWARENESS.UNAWARE;
  },
  engaged(id) { return !this.stealth || this.awareness[id] >= 1; },
  // Hearing: noises within the radius (60% of it through walls is not checked: cheap brains hear in a sphere).
  hear(event) {
    if (!this.active) return;
    const now = Sim.time;
    for (let id = 0; id < Actors.count; id++) {
      if (!this.isEnemy(id) || !Actors.alive[id] || id === event.source || (event.source >= 0 && !this.isFoe(id, event.source))) continue;
      const distance = Math.hypot(event.x - Actors.x[id], event.y - Actors.y[id], event.z - Actors.z[id]);
      if (distance > event.radius * PVE_DIRECTOR.hearingShare) continue;
      if (event.source >= 0) BotSense.remember(BotSense.pair(id, event.source), SENSE.HEARD, event.x, event.y, event.z, now);
      if (this.stealth) this.awareness[id] = Math.max(this.awareness[id], PVE_NOISE_AWARENESS);
    }
  },

  // ---- Decisions (NPC-001 priority list) ----
  setGoal(id, goal, seconds) {
    if (this.goal[id] === goal && !seconds) return;   // keeps a running patrol timer
    this.goal[id] = goal; this.goalUntil[id] = Sim.time + (seconds || 0);
  },
  setGoalPoint(id, x, y, z) { this.goalX[id] = x; this.goalY[id] = y; this.goalZ[id] = z; },
  decide(id, row, now) {
    if (this.shouldFlee(id, row, now)) { this.setGoal(id, PVE_GOAL.FLEE); return; }
    if (this.dodgeThreat(id)) { this.setGoal(id, PVE_GOAL.DODGE, PVE_DIRECTOR.thinkInterval); return; }
    if (this.shouldFallBack(row)) { this.setGoalPoint(id, this.homeX[id], this.homeY[id], this.homeZ[id]); this.setGoal(id, PVE_GOAL.FALLBACK); return; }
    if (this.goal[id] === PVE_GOAL.COVER && now < this.coverUntil[id]) return;
    if (this.wantsCover(id, row, now)) { this.setGoal(id, PVE_GOAL.COVER); return; }
    if (this.tryAttack(id, row, now)) return;
    if (this.lureActive(id, row, now)) { this.setGoalPoint(id, this.lureX[id], Actors.y[id], this.lureZ[id]); this.setGoal(id, PVE_GOAL.LURE); return; }
    if (this.target[id] >= 0 && this.engaged(id)) { this.setGoal(id, PVE_GOAL.PURSUE); return; }
    if (this.target[id] >= 0 && this.stealth && this.awarenessState(id) >= AWARENESS.SEARCHING) { this.setGoal(id, PVE_GOAL.SEARCH); return; }
    if (this.objectiveFor && this.objectiveFor(id, pveScratch)) { this.setGoalPoint(id, pveScratch.x, pveScratch.y, pveScratch.z); this.setGoal(id, PVE_GOAL.OBJECTIVE); return; }
    this.setGoal(id, PVE_GOAL.IDLE);
  },
  // NPC-003: broken morale (a leader died nearby) or fodder outnumbered by the foes near it.
  shouldFlee(id, row, now) {
    if (row.boss || row.target) return false;
    if (this.lastStand()) return false;
    if (now < this.brokenUntil[id]) return row.fodder;
    return row.flees && this.target[id] >= 0 && this.outnumbered(id);
  },
  // NPC-008 last stand: nothing left to spawn and only a quarter of the peak alive (at least one) - the rest fight to the end.
  lastStand() {
    return this.queue.count === 0 && this.hostileCount() <= Math.max(1, Math.round(this.stats.maxAlive * PVE_DIRECTOR.lastStand));
  },
  // NPC-007 fallback: the encounter lost 75% of what it spawned while reinforcements are still queued - the survivors
  // pull back to where they spawned and regroup with them (the boss, turrets and range targets hold).
  shouldFallBack(row) {
    if (row.boss || row.target || row.speed <= 0 || row.beast || this.queue.count === 0) return false;
    if (this.encounterSpawned < PVE_DIRECTOR.fallbackMinimum) return false;
    return this.hostileCount() <= this.encounterSpawned * (1 - PVE_DIRECTOR.fallbackLosses);
  },
  // A mode starts an encounter (a wave): the fallback share counts from here.
  beginEncounter() { this.encounterSpawned = 0; },
  outnumbered(id) {
    let foes = 0, friends = 0;
    for (let other = 0; other < Actors.count; other++) {
      if (!Actors.alive[other] || other === id) continue;
      if (Math.hypot(Actors.x[other] - Actors.x[id], Actors.z[other] - Actors.z[id]) > PVE_DIRECTOR.moraleRadius) continue;
      if (this.isEnemy(other) && !Actors.isEnemy(id, other)) friends++;
      else if (this.isFoe(id, other)) foes++;
    }
    return foes >= (friends + 1) * PVE_DIRECTOR.outnumbered;
  },
  // A live grenade, mine or rocket of a foe close by: step aside (aimX/Z = the threat).
  dodgeThreat(id) {
    if (this.rowOf(id).speed <= 0) return false;
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (!Projectiles.state[i] || !PROJECTILE_DODGE_TYPES.includes(Projectiles.type[i])) continue;
      const owner = Projectiles.owner[i];
      if (owner < 0 || owner === id || !Actors.isEnemy(id, owner)) continue;
      if (Math.hypot(Projectiles.x[i] - Actors.x[id], Projectiles.z[i] - Actors.z[id]) > PVE_DIRECTOR.dodgeRadius) continue;
      this.setGoalPoint(id, Projectiles.x[i], Projectiles.y[i], Projectiles.z[i]);
      return true;
    }
    return false;
  },
  // A hurt enemy takes cover once per target sighting (never forever: NPC-007 waves must end), and never in a last stand.
  wantsCover(id, row, now) {
    const target = this.target[id];
    if (!row.takesCover || target < 0 || this.coverTaken[id] || Actors.health[id] > Actors.maxHealth[id] * PVE_DIRECTOR.coverHealth) return false;
    if (this.lastStand()) return false;
    BotSense.perceivedPosition(id, target, pveScratch);
    const cover = Nav.nearestCover(Actors.x[id], Actors.y[id], Actors.z[id], pveScratch.x, pveScratch.y + STAND_HEIGHT, pveScratch.z, 15);
    if (cover < 0) return false;
    Nav.nodePosition(Nav.coverNode[cover], pveScratch);
    this.setGoalPoint(id, pveScratch.x, pveScratch.y, pveScratch.z);
    this.coverUntil[id] = now + PVE_DIRECTOR.coverSeconds;
    this.coverTaken[id] = 1;
    return true;
  },
  lureActive(id, row, now) { return row.beast && now < this.lureUntil[id]; },

  // ---- Attacks: windup (tell) -> active -> recover; tokens (NPC-005) ----
  tryAttack(id, row, now) {
    const target = this.attackTargetFor(id, now);
    if (target === -1) return false;
    if (target !== PVE_CORE_TARGET && !row.boss && this.attackersOn(target) >= Bots.maxAttackers()) return false;
    const distance = this.distanceTo(id, target);
    const index = this.pickAttack(id, row, distance, now);
    if (index < 0) return false;
    this.startAttack(id, index, target, now);
    return true;
  },
  // The target an attack may start on: a seen foe whose reaction time passed (engaged), else the core when in reach.
  attackTargetFor(id, now) {
    const target = this.target[id];
    if (target >= 0 && this.engaged(id) && BotSense.sees(id, target) && now >= BotSense.reactAt[BotSense.pair(id, target)]) return target;
    if (this.core.active && this.core.health > 0 && this.distanceTo(id, PVE_CORE_TARGET) <= this.coreReach(id)) return PVE_CORE_TARGET;
    return -1;
  },
  coreReach(id) {
    let reach = 0;
    for (const attack of this.rowOf(id).attackRows) if (attack.damage > 0) reach = Math.max(reach, attack.range[1]);
    return Math.min(reach, PVE_WAVE_RULES.coreAttackRange + PVE_WAVE_RULES.coreRadius + 20);
  },
  distanceTo(id, target) {
    if (target === PVE_CORE_TARGET) return Math.max(0, Math.hypot(this.core.x - Actors.x[id], this.core.z - Actors.z[id]) - PVE_WAVE_RULES.coreRadius);
    return Math.hypot(Actors.x[target] - Actors.x[id], Actors.y[target] - Actors.y[id], Actors.z[target] - Actors.z[id]);
  },
  attackersOn(target) {
    let count = 0;
    for (let id = 0; id < Actors.count; id++) if (this.phase[id] !== ATTACK_PHASE.IDLE && this.phase[id] !== ATTACK_PHASE.RECOVER && this.attackTarget[id] === target && this.isEnemy(id)) count++;
    return count;
  },
  // First attack of the row (row order = priority) in range, off cooldown and allowed by the brain (boss phases).
  // NPC-008: in a last stand the minimum ranges go (a cornered leaper pounces on a foe 2 m away instead of standing there).
  pickAttack(id, row, distance, now) {
    const brain = PveBrains[row.brain];
    for (let index = 0; index < row.attackRows.length; index++) {
      const attack = row.attackRows[index];
      if ((distance < attack.range[0] && !this.lastStand()) || distance > attack.range[1] || now < this.cooldown[id * PVE_MAX_ATTACKS + index]) continue;
      if (brain.allows && !brain.allows(id, attack, now)) continue;
      return index;
    }
    return -1;
  },
  startAttack(id, index, target, now) {
    const attack = this.rowOf(id).attackRows[index], tell = Math.max(PVE_MIN_TELL, attack.tell);
    this.attack[id] = index; this.attackTarget[id] = target; this.phase[id] = ATTACK_PHASE.WINDUP;
    this.tellStart[id] = now; this.phaseEndsAt[id] = now + tell; this.hitDone[id] = 0;
    this.cooldown[id * PVE_MAX_ATTACKS + index] = now + tell + attack.cooldown;
    this.setGoal(id, PVE_GOAL.ATTACK);
    this.aimAt(id, target);
    this.stats.attacks++;
    Bus.emit('pve.tell', pveEvent(id, attack.id, attack.kind, tell, tellColor(attack), target));
  },
  // The attacked point (a target's chest, or the core) into aimX/Y/Z.
  aimAt(id, target) {
    if (target === PVE_CORE_TARGET) { this.aimX[id] = this.core.x; this.aimY[id] = this.core.y + 1; this.aimZ[id] = this.core.z; return; }
    if (target < 0) return;
    Hitbox.point(target, ZONE.BODY, pveScratch);
    this.aimX[id] = pveScratch.x; this.aimY[id] = pveScratch.y; this.aimZ[id] = pveScratch.z;
  },
  stepAttack(id, row, now) {
    const phase = this.phase[id];
    if (phase === ATTACK_PHASE.IDLE) return;
    const attack = row.attackRows[this.attack[id]], kind = PveAttacks[attack.kind];
    if (phase === ATTACK_PHASE.WINDUP) {
      if (kind.track !== false && now + kind.lockSeconds < this.phaseEndsAt[id]) this.aimAt(id, this.attackTarget[id]);
      if (now + TIME_EPSILON < this.phaseEndsAt[id]) return;
      this.phase[id] = ATTACK_PHASE.ACTIVE;
      this.shotsLeft[id] = attack.shots; this.nextShotAt[id] = now;
      kind.begin(id, attack, now);
      return;
    }
    if (phase === ATTACK_PHASE.ACTIVE) {
      if (!kind.step(id, attack, now)) return;
      this.phase[id] = ATTACK_PHASE.RECOVER;
      this.phaseEndsAt[id] = now + attack.recover;
      return;
    }
    if (now + TIME_EPSILON >= this.phaseEndsAt[id]) this.endAttack(id);
  },
  endAttack(id) {
    this.phase[id] = ATTACK_PHASE.IDLE;
    this.attack[id] = -1;
    this.attackTarget[id] = -1;
    if (this.goal[id] === PVE_GOAL.ATTACK) this.goal[id] = PVE_GOAL.PURSUE;
    this.nextThink[id] = Math.min(this.nextThink[id], Sim.time);
  },
  cancelAttack(id) { if (this.phase[id] !== ATTACK_PHASE.IDLE) this.endAttack(id); },
  // The attack's own target is still a valid victim (alive, an actor or the standing core).
  targetValid(id) {
    const target = this.attackTarget[id];
    if (target === PVE_CORE_TARGET) return this.core.active && this.core.health > 0;
    return target >= 0 && Actors.alive[target] === 1;
  },
  // A parryable blow is parried when the target pressed MELEE or ALT within the difficulty's parry window (DIF-002).
  parried(id, target, attack) {
    if (!attack.parry || target < 0 || Sim.time - this.parryAt[target] > this.skill().parry) return false;
    this.stagger(id, PVE_DIRECTOR.staggerSeconds, STAGGER_CAUSE.PARRY);
    this.stats.parries++;
    Bus.emit('pve.parry', pveEvent(id, attack.id, attack.kind, 0, PVE_TELL_COLORS.parry, target));
    return true;
  },
  // cause: STAGGER_CAUSE (default PARRY = a forced stagger). Bosses never stagger; unstoppable champions only by parries and walls.
  stagger(id, seconds, cause) {
    if (this.rowOf(id).boss || (cause === STAGGER_CAUSE.DAMAGE && this.noKnockback[id])) return;
    this.staggerUntil[id] = Math.max(this.staggerUntil[id], Sim.time + seconds);
    this.cancelAttack(id);
  },
  // S11 parry hook (WeaponSpecialState.parryHooks): a projectile of a green (parryable) enemy attack is reflected when its
  // target pressed MELEE or ALT within the difficulty parry window and faces it - with any weapon, not only a block weapon.
  parryProjectile(target, projectile) {
    const owner = Projectiles.owner[projectile];
    if (owner < 0 || !this.isEnemy(owner) || !this.rowOf(owner).parryWeapons.includes(Projectiles.weapon[projectile])) return false;
    if (Sim.time - this.parryAt[target] > this.skill().parry) return false;
    if (!comesFromFront(target, Projectiles.vx[projectile], Projectiles.vz[projectile], PARRY_ARC_COS)) return false;
    this.stats.parries++;
    Bus.emit('pve.parry', pveEvent(owner, 'projectile', 'projectile', 0, PVE_TELL_COLORS.parry, target));
    return true;
  },
  // Damage from an enemy attack to an actor or the core (the single path for every attack kind).
  hitTarget(id, target, attack, amount, kind, zone) {
    if (target === PVE_CORE_TARGET) { this.damageCore(amount * this.damageScale[id] * this.skill().playerDamage, id); return amount; }
    if (target < 0 || !Actors.alive[target]) return 0;
    const info = Damage.info();
    info.amount = amount; info.kind = kind || 'hit'; info.zone = zone || 'body'; info.weapon = attack.id; info.element = attack.element;
    info.distance = this.distanceTo(id, target); info.knockback = 1;
    Hitbox.point(target, ZONE.BODY, pveScratch);
    const length = Math.max(1e-6, Math.hypot(pveScratch.x - Actors.x[id], pveScratch.y - Actors.eyeY(id), pveScratch.z - Actors.z[id]));
    info.x = pveScratch.x; info.y = pveScratch.y; info.z = pveScratch.z;
    info.dx = (pveScratch.x - Actors.x[id]) / length; info.dy = (pveScratch.y - Actors.eyeY(id)) / length; info.dz = (pveScratch.z - Actors.z[id]) / length;
    return Damage.apply(id, target, info);
  },
  // A hitscan shot from the enemy's eye toward aimX/Y/Z with spread: walls first, then actor hit volumes (ARC-014).
  shoot(id, attack, spreadDeg) {
    const ex = Actors.x[id], ey = Actors.eyeY(id), ez = Actors.z[id];
    Vec.set(pveAim, this.aimX[id] - ex, this.aimY[id] - ey, this.aimZ[id] - ez);
    const distance = Vec.length(pveAim);
    if (distance < 1e-6) return -1;
    const spread = spreadDeg * DEG;
    const yaw = Math.atan2(pveAim.x, pveAim.z) + Rng.pve.gauss() * spread, pitch = Math.atan2(pveAim.y, Math.hypot(pveAim.x, pveAim.z)) + Rng.pve.gauss() * spread;
    Vec.fromAngles(pveAim, yaw, pitch);
    const range = attack.range[1] + 5;
    const wall = World.raycast(ex, ey, ez, pveAim.x, pveAim.y, pveAim.z, range, pveWallHit) ? pveWallHit.distance : range;
    if (!Game.headless) Fx.tracer(ex, ey, ez, ex + pveAim.x * wall, ey + pveAim.y * wall, ez + pveAim.z * wall, tellColor(attack));
    if (this.attackTarget[id] === PVE_CORE_TARGET) return wall + 0.5 >= distance - PVE_WAVE_RULES.coreRadius ? this.hitTarget(id, PVE_CORE_TARGET, attack, attack.damage) : 0;
    const victim = World.raycastActors(ex, ey, ez, pveAim.x, pveAim.y, pveAim.z, wall, id, pveHit);
    if (victim < 0 || Smoke.lineBlocked(ex, ey, ez, pveHit.x, pveHit.y, pveHit.z)) return -1;
    return this.hitTarget(id, victim, attack, attack.damage, 'hit', pveHit.zone);
  },

  // ---- The core (M21 / M22): enemies with nothing else to do march to it and attack it ----
  setCore(x, y, z, health) {
    const core = this.core;
    core.active = true; core.x = x; core.y = y; core.z = z; core.health = core.max = health; core.shield = 0; core.destroyedAt = -1;
  },
  damageCore(amount, source) {
    const core = this.core;
    if (!core.active || core.health <= 0) return;
    const absorbed = Math.min(core.shield, amount);
    core.shield -= absorbed;
    core.health = Math.max(0, core.health - (amount - absorbed));
    if (core.health <= 0) { core.destroyedAt = Sim.time; Bus.emit('pve.core', pveEvent(source, '', 'destroyed', 0, 0, -1)); }
  },

  // ---- Damage hooks: difficulty sliders, weak points, the front shield, staggers ----
  attackerScale(source, target) {
    if (source < 0 || source === target || !Game.match) return 1;
    const sourceEnemy = this.isEnemy(source), targetEnemy = this.isEnemy(target);
    if (sourceEnemy && !targetEnemy) return this.skill().playerDamage * this.damageScale[source] * (this.guardian[target] ? PVE_DIRECTOR.guardianTaken : 1);
    if (targetEnemy && !sourceEnemy) return this.skill().enemyDamage;
    return 1;
  },
  reduceDamage(source, target, amount, info) {
    if (!this.isEnemy(target)) return amount;
    const row = this.rowOf(target);
    if (this.noKnockback[target]) info.knockback = 0;   // unstoppable: the hit lands, the push does not (Damage.knockback reads it after the reducers)
    let scaled = amount * weakPointFactor(row, target, info);
    if (row.frontShield && info.kind !== 'splash' && this.shieldBlocks(target, row.frontShield, info)) scaled *= row.frontShield.factor;
    if (Sim.time < this.staggerUntil[target] && row.brain === 'charger') scaled *= PVE_STAGGER_DAMAGE;
    const brain = PveBrains[row.brain];
    return brain.reduce ? brain.reduce(target, scaled, info) : scaled;
  },
  // The phalanx shield blocks shots from inside its front arc, except while the spear thrusts (and `lowered` s after).
  shieldBlocks(target, shield, info) {
    const lowered = this.phase[target] !== ATTACK_PHASE.IDLE || Sim.time < this.phaseEndsAt[target] + shield.lowered;
    if (lowered) return false;
    const yaw = Actors.yaw[target], length = Math.hypot(info.dx, info.dz) || 1;
    const along = (Math.sin(yaw) * info.dx + Math.cos(yaw) * info.dz) / length;   // -1 = the shot travels against the facing (from the front)
    return along < -Math.cos(shield.arcDeg * DEG / 2);
  },
  onDamage(event) {
    const target = event.target, source = event.source;
    if (source >= 0 && this.isEnemy(source) && Modes.participant[target]) this.addIntensity(event.amount);
    if (!this.isEnemy(target) || source < 0 || source === target) return;
    const now = Sim.time;
    BotSense.remember(BotSense.pair(target, source), SENSE.HURT, Actors.x[source], Actors.y[source], Actors.z[source], now);
    if (this.stealth) this.awareness[target] = 1;
    this.meleeKill[target] = event.kind === 'melee' ? 1 : 0;
    if (event.amount >= Actors.maxHealth[target] * PVE_DIRECTOR.staggerHitShare) this.stagger(target, PVE_DIRECTOR.staggerSeconds, STAGGER_CAUSE.DAMAGE);
    this.nextThink[target] = Math.min(this.nextThink[target], now);
  },
  addIntensity(amount) {
    this.intensity = Math.min(PVE_DIRECTOR.intensityPeak, this.intensity + amount * PVE_DIRECTOR.intensityPerDamage);
    if (this.intensity >= PVE_DIRECTOR.intensityPeak) { this.peakAt = Sim.time; this.intensity = 0; }
  },
  // Kills: finisher and saw drops, resource drops (resourceYield), morale breaks (NPC-003), the corpse timer.
  onKill(event) {
    const victim = event.victim;
    if (!this.isEnemy(victim)) return;
    const row = this.rowOf(victim), now = Sim.time;
    this.diedAt[victim] = now;
    this.cancelAttack(victim);
    this.stats.killed++;
    if (row.brain === 'bomber' && !this.hitDone[victim]) PveAttacks.explode.blast(victim, row.attackRows[0]);
    this.dropLoot(victim, row, event, now);
    if (row.leader) this.breakMorale(victim, now);
  },
  dropLoot(victim, row, event, now) {
    const x = Actors.x[victim], y = Actors.y[victim] + 0.3, z = Actors.z[victim];
    const melee = this.meleeKill[victim] === 1;
    if (melee && now < this.staggerUntil[victim]) Items.drop('healthpack', x, y, z, 0, -1);   // NPC-006 finisher on a staggered enemy
    else if (melee && row.meleeDrop) Items.drop(row.meleeDrop, x, y, z, 0, -1);
    else if (row.drop && Rng.pve.next() < row.dropChance * this.skill().resourceYield) Items.drop(row.drop, x, y, z, 0, -1);
  },
  breakMorale(leader, now) {
    for (let id = 0; id < Actors.count; id++) {
      if (!this.isEnemy(id) || !Actors.alive[id] || Actors.team[id] !== Actors.team[leader] || this.rowOf(id).boss) continue;
      if (Math.hypot(Actors.x[id] - Actors.x[leader], Actors.z[id] - Actors.z[leader]) > PVE_DIRECTOR.moraleRadius) continue;
      this.brokenUntil[id] = now + Rng.pve.range(PVE_DIRECTOR.brokenSeconds[0], PVE_DIRECTOR.brokenSeconds[1]);
      this.nextThink[id] = now;
    }
  },
  // ability.panic (A32 swarm on fodder): the enemy's morale breaks for the swarm's duration.
  panic(event) {
    if (!this.isEnemy(event.id) || !Actors.alive[event.id]) return;
    this.brokenUntil[event.id] = Math.max(this.brokenUntil[event.id], Sim.time + event.seconds);
    this.nextThink[event.id] = Sim.time;
  },
  // Lure (X50 flares): thermal or flash blasts pull the beasts within lureRadius for lureSeconds.
  onExplosion(event) {
    if (!this.active || (event.element !== PVE_DIRECTOR.lureElement && !PVE_DIRECTOR.lureSources.includes(event.source))) return;
    for (let id = 0; id < Actors.count; id++) {
      const row = this.rowOf(id);
      if (!row || !row.beast || !Actors.alive[id] || Math.hypot(event.x - Actors.x[id], event.z - Actors.z[id]) > PVE_DIRECTOR.lureRadius) continue;
      this.lureUntil[id] = Sim.time + PVE_DIRECTOR.lureSeconds;
      this.lureX[id] = event.x; this.lureZ[id] = event.z;
      this.nextThink[id] = Sim.time;
    }
  },
  noteButtons() {
    for (let id = 0; id < Actors.count; id++) if (Actors.pressed[id] & (BTN.MELEE | BTN.ALT)) this.parryAt[id] = Sim.time;
  },

  // ---- The director system (order 80) ----
  stepDirector() {
    this.noteButtons();
    if (!this.active || (Game.match && Game.match.ended)) return;
    const now = Sim.time;
    this.serveQueue(now);
    this.removeCorpses(now);
    this.stepChampions(TICK_SECONDS);
    if (this.wildlife > 0) this.keepWildlife(now);
    this.intensity = Math.max(0, this.intensity - PVE_DIRECTOR.intensityDecay * TICK_SECONDS);
  },
  removeCorpses(now) {
    for (let id = Actors.count - 1; id >= 0; id--) {
      if (this.isEnemy(id) && !Actors.alive[id] && now - this.diedAt[id] >= PVE_CORPSE_SECONDS) Actors.remove(id);
    }
  },
  // NPC-004 champion regen: barrier refills its shield unless stunned, overload regrows health unless shocked.
  stepChampions(dt) {
    for (let id = 0; id < Actors.count; id++) {
      if (!this.isEnemy(id) || !Actors.alive[id] || this.champion[id] < 0) continue;
      const champion = PVE_CHAMPIONS[this.champion[id]];
      if (champion.shieldRegen && !(Actors.flags[id] & ACTOR_FLAG.FROZEN)) Actors.shield[id] = Math.min(Actors.maxShield[id], Actors.shield[id] + champion.shieldRegen * dt);
      if (champion.healthRegen && !Damage.hasStatus(id, 'shock')) Actors.health[id] = Math.min(Actors.maxHealth[id], Actors.health[id] + champion.healthRegen * dt);
    }
  },
  // X50: keeps rules.fx.wildlife beasts alive, each placed on a random reachable node >= 18 m from every participant.
  keepWildlife(now) {
    if (now < this.nextBeastAt || this.countBeasts() >= this.wildlife) return;
    this.nextBeastAt = now + 1;
    if (!this.findBeastSpot(pveScratch)) return;
    const spawned = this.spawnEnemy('beast', pveScratch.x, pveScratch.y, pveScratch.z, Rng.pve.range(-Math.PI, Math.PI)) >= 0;
    if (spawned && this.countBeasts() >= this.wildlife) this.nextBeastAt = now + PVE_DIRECTOR.respawnBeastSeconds;   // the pack is full: wait
  },
  countBeasts() {
    let count = 0;
    for (let id = 0; id < Actors.count; id++) { const row = this.rowOf(id); if (row && row.beast && Actors.alive[id]) count++; }
    return count;
  },
  findBeastSpot(out) {
    out.yaw = Rng.pve.range(-Math.PI, Math.PI);
    if (Nav.nodeCount <= 0) return false;
    const start = Nav.nearestNode(Actors.x[0], Actors.y[0], Actors.z[0]);
    for (let attempt = 0; attempt < 8; attempt++) {
      const node = Nav.randomReachableNode(start >= 0 ? start : 0, Rng.pve);
      if (node < 0) continue;
      Nav.nodePosition(node, out);
      if (this.farFromParticipants(out.x, out.z, PVE_DIRECTOR.spawnMinDistance)) return true;
    }
    return false;
  },
  farFromParticipants(x, z, distance) {
    for (let id = 0; id < Actors.count; id++) if (Actors.alive[id] && Modes.participant[id] && Math.hypot(Actors.x[id] - x, Actors.z[id] - z) < distance) return false;
    return true;
  },

  // ---- Drawing: procedural parts per row (instanced shapes in the props batch), tells, damage states, awareness ----
  draw(batch) {
    if (!this.active) return;
    const now = Sim.time;
    for (let id = 0; id < Actors.count; id++) {
      if (!this.isEnemy(id) || !Actors.alive[id] || (Actors.flags[id] & ACTOR_FLAG.INVISIBLE)) continue;
      this.drawEnemy(batch, id, now);
    }
  },
  drawEnemy(batch, id, now) {
    const row = this.rowOf(id), size = row.size, yaw = Actors.yaw[id], pitch = Actors.pitch[id];
    const tell = this.tellGlow(id, row, now), health = Actors.health[id] / Math.max(1, Actors.maxHealth[id]);
    const shade = health < 1 / 3 ? 0.55 : health < 2 / 3 ? 0.8 : 1;   // NPC-006 damage states at 66 / 33 %
    const staggered = now < this.staggerUntil[id] && Math.floor(now * 8) % 2 === 0;
    // Parts rotate in place and go through one instance record (batch.meshFrom): float arguments would be boxed (PERF-006).
    const point = pvePartPoint, instance = pvePartInstance;
    for (const part of row.parts) {
      const tint = PART_TINTS[part[7]] || 0, colors = row.colors, glow = tint >= PART_TINTS.glow;
      point.x = part[1] * size; point.y = part[2] * size; point.z = part[3] * size; point.yaw = yaw; point.pitch = part[8] ? pitch : 0;
      rotateInPlace(point);
      const r = tell.amount > 0 ? tell.r : colors[tint * 3] * (glow ? 1 : shade), g = tell.amount > 0 ? tell.g : colors[tint * 3 + 1] * (glow ? 1 : shade);
      const b = tell.amount > 0 ? tell.b : colors[tint * 3 + 2] * (glow ? 1 : shade);
      instance.x = Actors.x[id] + point.x; instance.y = Actors.y[id] + point.y; instance.z = Actors.z[id] + point.z; instance.yaw = yaw; instance.pitch = part[8] ? pitch : 0;
      instance.sx = part[4] * size; instance.sy = part[5] * size; instance.sz = part[6] * size;
      instance.r = glow || tell.amount === 0 ? r : lerp(colors[tint * 3], r, tell.amount); instance.g = g; instance.b = b;
      instance.emissive = staggered ? 1 : Math.max(glow ? 0.8 : 0, tell.amount);
      batch.meshFrom(part[0], instance);
    }
    if (this.stealth) drawAwareness(batch, id, row, this.awarenessState(id));
    if (this.champion[id] >= 0) drawChampionRing(batch, id, size, this.champion[id]);
    if (Actors.shield[id] > 0) drawShieldShell(batch, id, size, Damage.shieldElement[id], Actors.shield[id] / Math.max(1, Actors.maxShield[id]));
    const brain = PveBrains[row.brain];
    if (brain.draw) brain.draw(batch, id, row, now);
    const attack = this.phase[id] === ATTACK_PHASE.WINDUP ? row.attackRows[this.attack[id]] : null;
    if (attack && PveAttacks[attack.kind].drawTell) PveAttacks[attack.kind].drawTell(batch, id, attack, tell.progress);
  },
  // The tell: the windup glows in the attack colour, pulsing faster as the blow nears (shared scratch, no allocation).
  tellGlow(id, row, now) {
    const glow = pveTellGlow;
    glow.amount = 0;
    if (this.phase[id] !== ATTACK_PHASE.WINDUP) return glow;
    const attack = row.attackRows[this.attack[id]], length = Math.max(1e-6, this.phaseEndsAt[id] - this.tellStart[id]);
    const progress = clamp((now - this.tellStart[id]) / length, 0, 1);
    glow.progress = progress;
    writeColor(pveTellColor, 0, tellColor(attack));
    glow.r = pveTellColor[0]; glow.g = pveTellColor[1]; glow.b = pveTellColor[2];
    glow.amount = 0.45 + 0.55 * Math.abs(Math.sin(progress * progress * 12));
    return glow;
  },
};
const pveTellGlow = { amount: 0, progress: 0, r: 0, g: 0, b: 0 };
const pveTellColor = new Float32Array(3);

// NPC-004: a barrier champion's shield may carry an element (x1.5 for the matching element, x0.75 for others).
function championElement(row) {
  const rules = PVE_CHAMPION_RULES;
  return Rng.pve.next() < rules.shieldElementChance ? Rng.pve.pick(rules.elements) : row.shieldElement;
}

// Green = parryable, red = unblockable, orange = the rest (NPC-002).
function tellColor(attack) {
  if (attack.parry) return PVE_TELL_COLORS.parry;
  return attack.unblockable ? PVE_TELL_COLORS.unblockable : PVE_TELL_COLORS.normal;
}

// Moves an actor to a point with no interpolation from the old one and no velocity (spawns, blinks, chamber moves).
function relocateActor(id, x, y, z, yaw) {
  Actors.x[id] = Actors.prevX[id] = x; Actors.y[id] = Actors.prevY[id] = y; Actors.z[id] = Actors.prevZ[id] = z;
  Actors.yaw[id] = Actors.prevYaw[id] = Actors.aimYaw[id] = yaw;
  Actors.vx[id] = Actors.vy[id] = Actors.vz[id] = 0;
}

// One reused payload for the pve.* events (listeners copy what they keep).
function pveEvent(id, attack, kind, seconds, color, target) {
  const event = pveEventPayload;
  event.id = id; event.attack = attack; event.kind = kind; event.seconds = seconds; event.color = color; event.target = target;
  return event;
}

// Weak points: 'back' vents (a shot travelling along the facing), 'air' (leaper off the ground), 'core' (14k boss head pool).
function weakPointFactor(row, target, info) {
  const weak = row.weakPoint;
  if (!weak || info.kind === 'dot') return 1;
  if (weak.kind === 'air') return Actors.flags[target] & ACTOR_FLAG.ON_GROUND ? 1 : weak.mult;
  if (weak.kind !== 'back') return 1;
  const yaw = Actors.yaw[target], length = Math.hypot(info.dx, info.dz) || 1;
  return (Math.sin(yaw) * info.dx + Math.cos(yaw) * info.dz) / length > Math.cos(60 * DEG) ? weak.mult : 1;
}

// BOT-005 indicator above a stealth guard's head (UI-014): grey unaware, yellow suspicious, orange searching, red alert.
const AWARENESS_COLORS = [[0.6, 0.6, 0.6], [1, 0.9, 0.2], [1, 0.55, 0.1], [1, 0.15, 0.1]];
function drawAwareness(batch, id, row, state) {
  const color = AWARENESS_COLORS[state];
  const fill = Math.max(0.15, Pve.awareness[id]);
  batch.mesh('box', Actors.x[id], Actors.y[id] + STAND_HEIGHT * row.size + 0.45, Actors.z[id], Actors.yaw[id], 0, 0.12, 0.35 * fill, 0.12, color[0], color[1], color[2], 0.9);
}

// NPC-004 champion tag: a ring in the tag's colour under its feet (barrier blue, unstoppable orange, overload yellow).
function drawChampionRing(batch, id, size, champion) {
  const colors = PVE_CHAMPION_COLORS, slot = champion * 3, diameter = PVE_CHAMPION_RING * size;
  batch.mesh('ring', Actors.x[id], Actors.y[id] + 0.06, Actors.z[id], 0, 0, diameter, 0.1, diameter, colors[slot], colors[slot + 1], colors[slot + 2], 1);
}
// NPC-004 / HP-006 coloured shield: rings around the body in the element colour, glowing with the shield left.
function drawShieldShell(batch, id, size, element, share) {
  const colors = PVE_SHIELD_COLORS, slot = element * 3, diameter = TORSO_RADIUS * 2.6 * size, glow = 0.4 + 0.6 * share;
  for (const height of PVE_SHELL_HEIGHTS) {
    batch.mesh('ring', Actors.x[id], Actors.y[id] + height * size, Actors.z[id], 0, 0, diameter, 0.06, diameter, colors[slot], colors[slot + 1], colors[slot + 2], glow);
  }
}
// NPC-002 tells are also heard: a positional cue per tell colour (green, red, orange).
function playTellSound(event) {
  if (Game.headless || event.id < 0) return;
  const kind = event.color === PVE_TELL_COLORS.parry ? 'parry' : event.color === PVE_TELL_COLORS.unblockable ? 'unblockable' : 'normal';
  Sound.play(PVE_TELL_SOUNDS[kind], Actors.x[event.id], Actors.eyeY(event.id), Actors.z[event.id], event.id);
}

Damage.addAttackerScale((source, target) => Pve.attackerScale(source, target));
WeaponSpecialState.parryHooks.push((target, projectile) => Pve.parryProjectile(target, projectile));
Damage.addReducer((source, target, amount, info) => Pve.reduceDamage(source, target, amount, info));
Render.addActorStyle((id, style) => { if (Actors.kind[id] === ACTOR_KIND.ENEMY) style.visible = false; });   // drawn by the 'pve' source
Render.addSource('pve', (batch) => Pve.draw(batch));
Bus.on('match.setup', () => Pve.reset());
Bus.on('match.start', () => Pve.onMatchStart());
Bus.on('match.stop', () => Pve.reset());
Bus.on('actor.create', (id) => Pve.onCreate(id));
Bus.on('damage', (event) => Pve.onDamage(event));
Bus.on('kill', (event) => Pve.onKill(event));
Bus.on('sound', (event) => Pve.hear(event));
Bus.on('explosion', (event) => Pve.onExplosion(event));
Bus.on('ability.panic', (event) => Pve.panic(event));
Bus.on('pve.tell', playTellSound);
Sim.addSystem('pveBrains', 11, (dt) => Pve.stepBrains(dt));
Sim.addSystem('pve', 80, () => Pve.stepDirector());
