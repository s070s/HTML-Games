// Mode framework (MODE-001..MODE-004): participants and teams, spawn selection (MAP-010/011), respawn timers and
// spawn protection, kill scoring, the match clock with score/time limits and sudden death, the round system,
// generic objectives (capture zones, carriable objects) and the results record Game.match.results.
// A mode = its CAT.modes row + a behaviour registered with Modes.register(id, { start, step, onKill, onScore,
// onRound, livesOver, isOver, score }); hooks a behaviour leaves out use DEFAULT_BEHAVIOUR (deathmatch rules from the row).
// Winner values: a team index in team modes, an actor id otherwise, DRAW (-1) for a draw.

const NO_TEAM = -1;
const DRAW = -1;
const NOT_OVER = -2;                   // isOver(): the match goes on
const TEAM_COUNT = 2;
const TEAM_NAMES = ['Blue', 'Red'];
const LIVES_UNLIMITED = -1;
const TIME_EPSILON = 1e-6;             // sim times are sums of 1/120 s steps: compare with a little slack
const OVERTIME_SECONDS = 180;          // MODE-001: sudden death lasts at most 3 minutes, then the match is a draw
const TIME_WARNINGS = [300, 60, 30, 10];
const SPAWN_ENEMY_RADIUS = 12;         // MAP-010: reject a spawn with an enemy this close
const SPAWN_SIGHT_RADIUS = 25;         // MAP-010: ... or with an enemy in line of sight within this range
const SPAWN_CAPSULE_RADIUS = 0.8;      // two capsule radii (DATA-003): closer means spawning inside an actor
const SPAWN_CAPSULE_HEIGHT = 1.8;
const SPAWN_EYE_HEIGHT = 1.62;
const SPAWN_ENEMY_CAP = 60;            // enemies farther than this add no more preference
const SPAWN_TEAMMATE_WEIGHT = 0.5;     // team modes prefer spawns near teammates (MAP-010)
const SPAWN_DEATH_WEIGHT = 0.25;       // and away from the place of the last death
const SPAWN_DEATH_CAP = 40;
const SPAWN_JITTER = 2;                // seeded metres of noise so equally good spawns rotate
const OWNED_SPAWN_OFFSET = 3;          // spawns at owned points (conquest) stand this far from the centre
const RESPAWN_BUTTONS = BTN.FIRE | BTN.JUMP | BTN.USE;
const SPAWN_CLEARED_FLAGS = ACTOR_FLAG.PROTECTED | ACTOR_FLAG.FROZEN;   // the flags S13 owns
const TOUCH_RADIUS = 1.2;              // carriable pickup and base touch distance (horizontal metres)
const TOUCH_HEIGHT = 2.2;
const ZONE_BELOW = 1;                  // capture zones are cylinders from 1 m below to 3 m above their centre
const ZONE_ABOVE = 3;
const DEFAULT_OBJECTIVE_RADIUS = 3;
const OBJECTIVE_RADIUS = { point: 5, hill: 6, bombsite: 4, flag: 1, flagBase: 2, relic: 1, core: 3, bank: 2, extract: 4, payloadPath: 4 };
const OBJECTIVE_COMPANIONS = { flag: 'flagBase' };        // kinds created together with the mode's objective kind
const CARRIABLE_KINDS = ['flag', 'relic', 'bomb'];
const NEAR_ANY = 0, NEAR_TEAM = 1, NEAR_ENEMY = 2;       // findActorNear relation filters
const PHASE = { IDLE: 'idle', FREEZE: 'freeze', LIVE: 'live', ROUND_END: 'roundEnd', ENDED: 'ended' };
const TEAM_COLORS = [[0.25, 0.55, 1], [1, 0.35, 0.25], [0.85, 0.85, 0.85]];  // blue, red, neutral
const NEUTRAL_COLOR = 2;
const LETTER_A_CODE = 65;              // objective letters A, B, C... (the HUD shows the same ones)
const MARKER_GLOW = 0.6;

const DEFAULT_BEHAVIOUR = {
  limits: ['score', 'time'],
  start() {},
  step() { if (Modes.rules.rounds) Modes.checkTeamWipe(); },
  onKill() {},
  onScore() {},
  // phase: 'start' | 'live' | 'end' | 'timeout'; for 'timeout' the return value is the round winner.
  onRound(phase) { return phase === 'timeout' ? Modes.aliveLeaderTeam() : DRAW; },
  livesOver() { return Modes.livesWinner(); },
  isOver(now) { return Modes.standardIsOver(now); },
  score(index) { return Modes.competitorScore(index); },
};

const spawnRating = { safe: true, occupied: false, nearestEnemy: 0, nearestMate: 0, score: 0 };
const spawnChoice = { x: 0, y: 0, z: 0, yaw: 0 };
const spawnPayload = { id: -1 };
const scorePayload = { id: -1, team: NO_TEAM, points: 0, reason: '' };
const announcePayload = { text: '', kind: '', priority: 0 };
const roundPayload = { round: 0, phase: '', winner: DRAW, reason: '', attackers: 0 };
const blastPayload = { x: 0, y: 0, z: 0, radius: 0, owner: -1, source: 'bomb', element: 'kinetic' };

const Modes = {
  behaviours: new Map(),
  rules: null, mode: null, behaviour: DEFAULT_BEHAVIOUR,
  active: false,          // a match with participants is running and not over
  phase: PHASE.IDLE,
  startTime: 0,           // Sim.time when the match clock started
  overtime: false,
  timeBonus: 0,           // seconds a behaviour added to the time limit (payload checkpoints)
  endReason: '',
  warningIndex: 0,
  leader: -1, leaderScore: 0, runnerUpScore: 0, announcedLeader: -1,
  competitorsAtStart: 0,
  round: 0, roundStart: 0, roundEndsAt: Infinity, phaseEndsAt: 0, swapped: false, roundWinner: DRAW, roundReason: '',
  timeoutReason: 'time',  // round-clock end reason; a behaviour may change it (bomb: the fuse runs on the round clock)
  participant: new Uint8Array(MAX_ACTORS), queued: new Uint8Array(MAX_ACTORS),
  kills: new Int32Array(MAX_ACTORS), deaths: new Int32Array(MAX_ACTORS), assists: new Int32Array(MAX_ACTORS), suicides: new Int32Array(MAX_ACTORS),
  score: new Float32Array(MAX_ACTORS), objective: new Float32Array(MAX_ACTORS),
  streak: new Int16Array(MAX_ACTORS), bestStreak: new Int16Array(MAX_ACTORS), lives: new Int16Array(MAX_ACTORS),
  respawnAt: new Float64Array(MAX_ACTORS), forcedAt: new Float64Array(MAX_ACTORS), protectUntil: new Float64Array(MAX_ACTORS),
  deathX: new Float32Array(MAX_ACTORS), deathZ: new Float32Array(MAX_ACTORS), hasDied: new Uint8Array(MAX_ACTORS),
  teamScore: new Float64Array(TEAM_COUNT), teamRounds: new Int16Array(TEAM_COUNT), teamMeter: new Float64Array(TEAM_COUNT),
  objectives: [],
  spawnPoints: [],
  hud: { active: false, mode: '', phase: '', timeLeft: 0, overtime: false, round: 0, roundsToWin: 0, scoreLimit: 0, teams: 0,
    leader: -1, leaderScore: 0, playerId: -1, playerScore: 0, playerRank: 0, playerLives: LIVES_UNLIMITED, respawnIn: 0,
    attackers: 0, teamScores: null, teamRounds: null, teamMeter: null, objectives: null, zoneX: 0, zoneZ: 0, zoneRadius: 0 },

  // behaviour.limits: the limits its isOver honours ('score', 'time'); a behaviour with its own isOver honours none unless it lists them.
  register(id, behaviour) {
    const limits = behaviour.isOver ? [] : DEFAULT_BEHAVIOUR.limits;
    this.behaviours.set(id, Object.assign({}, DEFAULT_BEHAVIOUR, { limits }, behaviour));
  },
  isPlayable(id) { return this.behaviours.has(id); },
  // Whether a score or time limit (custom match editor) ends this mode: round modes end by rounds only.
  honoursLimit(modeId, limit) {
    const mode = CAT.modes.byId(modeId), behaviour = this.behaviours.get(modeId);
    return !!mode && !!behaviour && !mode.rounds && behaviour.limits.includes(limit);
  },
  // MODE-002: the bot list that fills every slot of a mode (the UI passes it as setup.bots).
  defaultBots(modeId, withPlayer) {
    const mode = CAT.modes.byId(modeId);
    const count = mode ? Math.max(0, mode.sizeDefault - (withPlayer ? 1 : 0)) : 0;
    return Array.from({ length: Math.min(count, Quality.current().bots) }, () => ({}));
  },

  // ---- Match lifecycle ----
  start(match) {
    this.resetMatch();
    this.rules = match.rules;
    this.mode = CAT.modes.byId(match.rules.mode);
    this.behaviour = this.behaviours.get(this.mode.id) || DEFAULT_BEHAVIOUR;
    match.handicap = new Float32Array(MAX_ACTORS).fill(HANDICAP_MAX);
    match.results = null;
    this.buildObjectives(World.map);
    this.addParticipants(match.setup, match);
    if (!this.countParticipants()) return;    // no participants: other sections drive this match by hand
    this.buildSpawnPoints(World.map);
    this.balanceTeams();
    this.startTime = Sim.time;
    this.active = true;
    this.competitorsAtStart = this.countStanding();
    this.skipWarnings();
    this.behaviour.start();
    if (this.rules.rounds) this.startRound(Sim.time);
    else this.beginOpenPlay();
  },
  resetMatch() {
    this.active = false; this.phase = PHASE.IDLE; this.overtime = false; this.timeBonus = 0; this.endReason = '';
    this.leader = -1; this.announcedLeader = -1; this.leaderScore = 0; this.runnerUpScore = 0;
    this.round = 0; this.swapped = false; this.roundEndsAt = Infinity; this.roundWinner = DRAW;
    this.teamScore.fill(0); this.teamRounds.fill(0); this.teamMeter.fill(0);
    this.objectives.length = 0; this.spawnPoints.length = 0;
    this.hud.zoneRadius = 0;
  },
  stop() { this.resetMatch(); this.rules = null; this.mode = null; this.behaviour = DEFAULT_BEHAVIOUR; },
  beginOpenPlay() {
    this.phase = PHASE.LIVE;
    for (let id = 0; id < Actors.count; id++) if (this.isActive(id)) this.spawnActor(id);
  },
  step(dt) {
    if (!this.active) return;
    const now = Sim.time;
    this.stepRespawns(now);
    this.stepProtection(now);
    if (this.rules.rounds) this.stepRounds(now);
    if (this.phase === PHASE.LIVE) this.behaviour.step(dt, now);
    if (!this.active) return;
    this.updateLeader();
    this.stepWarnings(now);
    const winner = this.endResult(now);
    if (winner !== NOT_OVER) this.finish(winner);
  },
  // Lives (rules.lives: M15, X32, the editor) end every mode without rounds; a behaviour may hold that end (livesOver).
  endResult(now) {
    const survivor = this.rules.lives > 0 && !this.rules.rounds ? this.behaviour.livesOver() : NOT_OVER;
    return survivor !== NOT_OVER ? survivor : this.behaviour.isOver(now);
  },
  finish(winner) {
    if (!this.active) return;
    this.active = false;
    this.phase = PHASE.ENDED;
    Game.match.results = this.buildResults(winner);
    Game.end(winner);
  },

  // ---- Participants and teams ----
  addParticipants(setup, match) {
    if (setup.player) this.addPlayer(setup.player, match);
    const bots = setup.bots || [];
    const cap = Math.min(bots.length, Quality.current().bots);   // PERF-009 bot cap per quality preset
    for (let index = 0; index < cap; index++) this.addBot(bots[index] || {}, index, match);
    this.queueExtraPlayers();
  },
  addPlayer(player, match) {
    const id = this.addParticipant(ACTOR_KIND.PLAYER, this.requestedTeam(player.team), player.name || 'You', player.profile || null);
    Game.playerId = id;
    if (id >= 0) match.handicap[id] = this.rules.handicap.player;
  },
  // bot: { profile (bots catalogue key or row), team, tier, name, dummy (true: a practice dummy, M30) }
  addBot(bot, index, match) {
    const row = typeof bot.profile === 'string' ? (CAT.bots ? CAT.bots.byId(bot.profile) : null) : bot.profile;
    const name = bot.name || (row && row.name) || 'Bot ' + (index + 1);
    const kind = bot.dummy ? ACTOR_KIND.DUMMY : ACTOR_KIND.BOT;
    const id = this.addParticipant(kind, this.requestedTeam(bot.team), name, row || null);
    if (id >= 0) match.handicap[id] = this.rules.handicap.bots[index] || HANDICAP_MAX;
  },
  addParticipant(kind, team, name, profile) {
    const id = Actors.create(kind, team, name, profile);
    if (id < 0) return -1;
    this.participant[id] = 1;
    this.lives[id] = this.startLives();
    return id;
  },
  startLives() { return this.rules.lives > 0 ? this.rules.lives : LIVES_UNLIMITED; },
  requestedTeam(team) {
    if (this.rules.teams === 0) return NO_TEAM;
    if (this.rules.teams === 1) return 0;
    if (team === 0 || team === 1) return team;
    return this.teamSize(0) <= this.teamSize(1) ? 0 : 1;
  },
  // Modes with params.activePlayers (duel) let only that many play; the rest wait in the queue.
  queueExtraPlayers() {
    const limit = this.rules.params.activePlayers;
    if (!limit) return;
    let seen = 0;
    for (let id = 0; id < Actors.count; id++) {
      if (!this.participant[id]) continue;
      seen++;
      if (seen > limit) this.queued[id] = 1;
    }
  },
  // Auto-balance: moves bots (never the player) until the team sizes differ by at most one (setup.balance === false: a custom team split
  // stays; params.fixedSides: the mode sets the sides itself, M17 M26).
  balanceTeams() {
    if (this.rules.teams !== TEAM_COUNT || this.rules.params.fixedSides || (Game.match && Game.match.setup && Game.match.setup.balance === false)) return;
    for (let moves = 0; moves < MAX_ACTORS; moves++) {
      const difference = this.teamSize(0) - this.teamSize(1);
      if (Math.abs(difference) <= 1) return;
      const bot = this.lastBotOf(difference > 0 ? 0 : 1);
      if (bot < 0) return;
      Actors.team[bot] = 1 - Actors.team[bot];
    }
  },
  teamSize(team) {
    let size = 0;
    for (let id = 0; id < Actors.count; id++) if (this.isActive(id) && Actors.team[id] === team) size++;
    return size;
  },
  lastBotOf(team) {
    for (let id = Actors.count - 1; id >= 0; id--) {
      if (this.isActive(id) && Actors.team[id] === team && Actors.kind[id] !== ACTOR_KIND.PLAYER) return id;
    }
    return -1;
  },
  isActive(id) { return this.participant[id] === 1 && this.queued[id] === 0; },
  // Living and not downed (HP-007): only such actors capture, contest, push, plant, defuse or take objectives.
  actsOnObjectives(id) { return Actors.alive[id] === 1 && (Actors.flags[id] & ACTOR_FLAG.DOWNED) === 0; },
  countParticipants() {
    let count = 0;
    for (let id = 0; id < Actors.count; id++) if (this.participant[id]) count++;
    return count;
  },
  // Participants that are in play (not waiting in the queue); countParticipants also counts the queued.
  countActive() {
    let count = 0;
    for (let id = 0; id < Actors.count; id++) if (this.isActive(id)) count++;
    return count;
  },
  resetActor(id) {
    this.participant[id] = 0; this.queued[id] = 0; this.hasDied[id] = 0;
    this.kills[id] = 0; this.deaths[id] = 0; this.assists[id] = 0; this.suicides[id] = 0;
    this.score[id] = 0; this.objective[id] = 0; this.streak[id] = 0; this.bestStreak[id] = 0; this.lives[id] = LIVES_UNLIMITED;
    this.respawnAt[id] = Infinity; this.forcedAt[id] = Infinity; this.protectUntil[id] = 0;
  },
  onRemove(id) {
    this.dropCarried(id);
    this.participant[id] = 0;
  },
  // Side 0 attacks in round modes; the side switch swaps it. The mapping is its own inverse (team <-> side).
  sideOf(team) { return team < 0 || !this.swapped ? team : 1 - team; },
  attackingTeam() { return this.sideOf(0); },

  // ---- Spawning (MAP-010/011, spawning contract in docs/ARCHITECTURE.md) ----
  buildSpawnPoints(map) {
    const spawns = map && map.spawns ? map.spawns : [];
    for (const spawn of spawns) {
      if (spawn.modes && spawn.modes.length && !spawn.modes.includes(this.mode.id)) continue;
      const team = typeof spawn.team === 'number' ? spawn.team : NO_TEAM;
      this.spawnPoints.push({ x: spawn.x, y: spawn.y, z: spawn.z, yaw: (spawn.yaw || 0) * DEG, team, objective: null });
    }
    if (!this.rules.params.spawnAtOwned) return;
    for (const objective of this.objectives) {
      this.spawnPoints.push({ x: objective.x + OWNED_SPAWN_OFFSET, y: objective.y, z: objective.z, yaw: 0, team: NO_TEAM, objective });
    }
  },
  spawnActor(id) {
    const point = this.pickSpawn(id, spawnChoice);
    Actors.x[id] = Actors.prevX[id] = point.x; Actors.y[id] = Actors.prevY[id] = point.y; Actors.z[id] = Actors.prevZ[id] = point.z;
    Actors.yaw[id] = Actors.prevYaw[id] = Actors.aimYaw[id] = point.yaw;
    Actors.pitch[id] = Actors.prevPitch[id] = Actors.aimPitch[id] = 0;
    Actors.vx[id] = Actors.vy[id] = Actors.vz[id] = 0;
    Actors.flags[id] &= ~SPAWN_CLEARED_FLAGS;   // other sections reset their own flags on actor.spawn
    Actors.alive[id] = 1;
    Actors.spawnCount[id]++;
    this.respawnAt[id] = Infinity;
    this.forcedAt[id] = Infinity;
    this.protect(id);
    spawnPayload.id = id;
    Bus.emit('actor.spawn', spawnPayload);
  },
  // Best safe spawn of the actor's side; then any safe-or-not free spawn; then the world origin.
  pickSpawn(id, out) {
    if (this.chooseSpawn(id, true, out) || this.chooseSpawn(id, false, out)) return out;
    out.x = 0; out.y = 0; out.z = 0; out.yaw = 0;
    return out;
  },
  chooseSpawn(id, sameSide, out) {
    let best = null, bestScore = -Infinity, bestSafe = false;
    for (let i = 0; i < this.spawnPoints.length; i++) {
      const point = this.spawnPoints[i];
      if (!this.spawnUsable(point, id, sameSide)) continue;
      this.rateSpawn(id, point);
      if (spawnRating.occupied) continue;
      const better = spawnRating.safe !== bestSafe ? spawnRating.safe : spawnRating.score > bestScore;
      if (!better) continue;
      best = point; bestScore = spawnRating.score; bestSafe = spawnRating.safe;
    }
    if (!best) return false;
    out.x = best.x; out.y = best.y; out.z = best.z; out.yaw = best.yaw;
    return true;
  },
  spawnUsable(point, id, sameSide) {
    const team = Actors.team[id];
    if (point.objective) return team >= 0 && point.objective.owner === team;
    if (!sameSide || this.rules.teams !== TEAM_COUNT || point.team < 0) return true;
    return point.team === this.sideOf(team);
  },
  rateSpawn(id, point) {
    spawnRating.safe = true; spawnRating.occupied = false;
    spawnRating.nearestEnemy = SPAWN_ENEMY_CAP; spawnRating.nearestMate = Infinity;
    for (let other = 0; other < Actors.count; other++) {
      if (other !== id && Actors.alive[other]) this.rateAgainst(id, other, point);
    }
    let score = spawnRating.nearestEnemy + Rng.rules.next() * SPAWN_JITTER;
    if (this.rules.teams > 0 && spawnRating.nearestMate < Infinity) score -= spawnRating.nearestMate * SPAWN_TEAMMATE_WEIGHT;
    if (this.hasDied[id]) score += Math.min(SPAWN_DEATH_CAP, Math.hypot(point.x - this.deathX[id], point.z - this.deathZ[id])) * SPAWN_DEATH_WEIGHT;
    spawnRating.score = score;
  },
  rateAgainst(id, other, point) {
    const dx = Actors.x[other] - point.x, dy = Actors.y[other] - point.y, dz = Actors.z[other] - point.z;
    const flat = Math.hypot(dx, dz);
    if (flat < SPAWN_CAPSULE_RADIUS && Math.abs(dy) < SPAWN_CAPSULE_HEIGHT) spawnRating.occupied = true;
    if (!Actors.isEnemy(id, other)) { spawnRating.nearestMate = Math.min(spawnRating.nearestMate, flat); return; }
    const distance = Math.hypot(flat, dy);
    spawnRating.nearestEnemy = Math.min(spawnRating.nearestEnemy, distance);
    if (distance < SPAWN_ENEMY_RADIUS) { spawnRating.safe = false; return; }
    if (distance >= SPAWN_SIGHT_RADIUS) return;
    if (World.lineClear(Actors.x[other], Actors.eyeY(other), Actors.z[other], point.x, point.y + SPAWN_EYE_HEIGHT, point.z)) spawnRating.safe = false;
  },
  protect(id) {
    const seconds = this.rules.respawn.protect;
    if (seconds <= 0) return;
    Actors.flags[id] |= ACTOR_FLAG.PROTECTED;
    this.protectUntil[id] = Sim.time + seconds;
  },
  endProtection(id) { if (id >= 0 && id < MAX_ACTORS) Actors.flags[id] &= ~ACTOR_FLAG.PROTECTED; },   // MAP-010: ends on fire
  stepProtection(now) {
    for (let id = 0; id < Actors.count; id++) {
      if ((Actors.flags[id] & ACTOR_FLAG.PROTECTED) && now + TIME_EPSILON >= this.protectUntil[id]) this.endProtection(id);
    }
  },

  // ---- Death, respawn and scoring ----
  onKill(event) {
    if (!this.active) return;
    const victim = event.victim, killer = event.killer, now = Sim.time;
    this.recordDeath(victim);
    this.creditKill(victim, killer, event.assister);
    this.behaviour.onKill(victim, killer, event);
    if (victim >= 0 && this.participant[victim]) this.scheduleRespawn(victim, now);
  },
  recordDeath(victim) {
    if (!(victim >= 0) || !this.participant[victim]) return;
    this.deaths[victim]++;
    this.streak[victim] = 0;
    this.hasDied[victim] = 1;
    this.deathX[victim] = Actors.x[victim];
    this.deathZ[victim] = Actors.z[victim];
    if (this.lives[victim] > 0) this.lives[victim]--;
    this.dropCarried(victim);
  },
  creditKill(victim, killer, assister) {
    const scoring = this.rules.scoring;
    if (!(killer >= 0) || killer === victim) {
      if (victim >= 0) this.suicides[victim]++;
      this.awardKillPoints(victim, scoring.suicide, 'suicide');
      return;
    }
    if (assister >= 0 && assister !== killer) this.assists[assister]++;
    if (!Actors.isEnemy(killer, victim)) { this.awardKillPoints(killer, scoring.teamKill, 'teamKill'); return; }
    this.kills[killer]++;
    this.streak[killer]++;
    if (this.streak[killer] > this.bestStreak[killer]) this.bestStreak[killer] = this.streak[killer];
    this.awardKillPoints(killer, scoring.kill, 'kill');
  },
  // In kill-scored team modes the team score moves with its members' kill points.
  awardKillPoints(id, points, reason) {
    if (!(id >= 0) || !this.participant[id]) return;
    this.awardPlayer(id, points, reason);
    if (this.rules.scoreBy === 'kills' && this.rules.teams === TEAM_COUNT && Actors.team[id] >= 0) this.awardTeam(Actors.team[id], points, reason);
  },
  awardPlayer(id, points, reason) {
    this.score[id] += points;
    this.emitScore(id, Actors.team[id], points, reason);
  },
  awardTeam(team, points, reason) {
    this.teamScore[team] += points;
    this.emitScore(-1, team, points, reason);
  },
  // Objective credit for one actor: the objective counter plus rules.scoring[reason] scoreboard points.
  creditObjective(id, reason) {
    if (!(id >= 0)) return;
    this.objective[id]++;
    this.awardPlayer(id, this.rules.scoring[reason] || 0, reason);
  },
  emitScore(id, team, points, reason) {
    scorePayload.id = id; scorePayload.team = team; scorePayload.points = points; scorePayload.reason = reason;
    Bus.emit('score', scorePayload);
    this.behaviour.onScore(id, team, points, reason);
  },
  scheduleRespawn(id, now) {
    if (this.rules.respawnMode !== 'normal' || this.lives[id] === 0 || this.queued[id]) return;
    const timers = this.rules.respawn;
    let ready = now + timers.delay;
    if (timers.wave > 0) ready = this.startTime + Math.ceil((ready - this.startTime - TIME_EPSILON) / timers.wave) * timers.wave;
    this.respawnAt[id] = ready;
    this.forcedAt[id] = Math.max(ready, now + timers.forced);
  },
  // Bots respawn when ready; the player respawns on a button press after the delay, or at the forced time.
  stepRespawns(now) {
    for (let id = 0; id < Actors.count; id++) {
      if (!this.participant[id] || Actors.alive[id] || now + TIME_EPSILON < this.respawnAt[id]) continue;
      if (this.waitsForPress(id, now)) continue;
      this.spawnActor(id);
    }
  },
  waitsForPress(id, now) {
    return Actors.kind[id] === ACTOR_KIND.PLAYER && now + TIME_EPSILON < this.forcedAt[id] && (Actors.pressed[id] & RESPAWN_BUTTONS) === 0;
  },

  // ---- Leader, limits and the match clock ----
  competitorCount() { return this.rules.teams === TEAM_COUNT ? TEAM_COUNT : Actors.count; },
  isCompetitor(index) { return this.rules.teams === TEAM_COUNT || this.isActive(index); },
  competitorScore(index) {
    if (this.rules.teams !== TEAM_COUNT) return this.score[index];
    return this.rules.rounds ? this.teamRounds[index] : this.teamScore[index];
  },
  competitorName(index) { return this.rules.teams === TEAM_COUNT ? TEAM_NAMES[index] : Actors.name[index]; },
  updateLeader() {
    let best = -1, bestScore = -Infinity, second = -Infinity;
    const count = this.competitorCount();
    for (let index = 0; index < count; index++) {
      if (!this.isCompetitor(index)) continue;
      const value = this.behaviour.score(index);
      if (value > bestScore) { second = bestScore; bestScore = value; best = index; } else if (value > second) second = value;
    }
    this.leaderScore = bestScore;
    this.runnerUpScore = second;
    this.leader = bestScore > second ? best : -1;
    this.announceLeader();
  },
  announceLeader() {
    if (this.leader < 0 || this.leader === this.announcedLeader || this.leaderScore <= 0) return;
    this.announcedLeader = this.leader;
    this.announce(this.competitorName(this.leader) + ' takes the lead', 'lead', 1);
  },
  standardIsOver(now) {
    if (this.rules.rounds) return NOT_OVER;
    const limit = this.rules.scoreLimit;
    if (limit > 0 && this.leader >= 0 && this.leaderScore >= limit) return this.over(this.leader, 'score');
    return this.timeResult(now);
  },
  // Time limit: the leader wins; a tie goes to sudden death (MODE-001) unless the mode's tiebreak is 'draw'.
  timeResult(now) {
    if (this.rules.timeLimit <= 0) return NOT_OVER;
    const limit = this.rules.timeLimit + this.timeBonus;
    const elapsed = now - this.startTime;
    if (elapsed + TIME_EPSILON < limit) return NOT_OVER;
    if (this.leader >= 0) return this.over(this.leader, this.overtime ? 'overtime' : 'time');
    if (this.rules.tiebreak === 'draw' || elapsed + TIME_EPSILON >= limit + OVERTIME_SECONDS) return this.over(DRAW, 'draw');
    this.enterOvertime();
    return NOT_OVER;
  },
  enterOvertime() {
    if (this.overtime) return;
    this.overtime = true;
    this.announce('Sudden death', 'overtime', 3);
  },
  over(winner, reason) { this.endReason = reason; return winner; },
  // Lives (rules.lives, M15, X32): the match ends when one competitor (or none) is still standing. Co-op (teams 1) has no rival.
  livesWinner() {
    if (this.rules.lives <= 0 || this.rules.teams === 1 || this.competitorsAtStart < 2) return NOT_OVER;
    let standing = 0, last = DRAW;
    const count = this.competitorCount();
    for (let index = 0; index < count; index++) {
      if (this.isCompetitor(index) && this.competitorStanding(index)) { standing++; last = index; }
    }
    return standing > 1 ? NOT_OVER : this.over(standing === 1 ? last : DRAW, 'eliminated');
  },
  competitorStanding(index) {
    if (this.rules.teams !== TEAM_COUNT) return this.participantStanding(index);
    for (let id = 0; id < Actors.count; id++) if (Actors.team[id] === index && this.participantStanding(id)) return true;
    return false;
  },
  participantStanding(id) { return this.isActive(id) && (Actors.alive[id] === 1 || this.lives[id] !== 0); },
  countStanding() {
    let standing = 0;
    const count = this.competitorCount();
    for (let index = 0; index < count; index++) if (this.isCompetitor(index) && this.competitorStanding(index)) standing++;
    return standing;
  },
  skipWarnings() {
    this.warningIndex = 0;
    while (this.warningIndex < TIME_WARNINGS.length && TIME_WARNINGS[this.warningIndex] >= this.rules.timeLimit) this.warningIndex++;
  },
  // The warnings count the time the behaviour added (timeBonus); a bonus re-arms the warnings it pushed back.
  stepWarnings(now) {
    if (this.rules.timeLimit <= 0 || this.rules.rounds) return;
    const left = this.rules.timeLimit + this.timeBonus - (now - this.startTime);
    while (this.warningIndex > 0 && TIME_WARNINGS[this.warningIndex - 1] < left - TIME_EPSILON) this.warningIndex--;
    if (this.warningIndex >= TIME_WARNINGS.length) return;
    const threshold = TIME_WARNINGS[this.warningIndex];
    if (left > threshold + TIME_EPSILON) return;
    this.warningIndex++;
    this.announce(formatTimeWarning(threshold), 'time', 2);
  },
  announce(text, kind, priority) {
    announcePayload.text = text; announcePayload.kind = kind; announcePayload.priority = priority;
    Bus.emit('announce', announcePayload);
  },

  // ---- Round system (rules.rounds) ----
  startRound(now) {
    const rounds = this.rules.rounds;
    this.round++;
    this.roundWinner = DRAW;
    this.roundEndsAt = Infinity;
    this.balanceTeams();
    this.resetObjectives();
    // Survivors of the last round must not block or unsafe the new spawns: rate only against actors placed this round.
    for (let id = 0; id < Actors.count; id++) if (this.isActive(id)) Actors.alive[id] = 0;
    for (let id = 0; id < Actors.count; id++) this.prepareForRound(id);
    this.phase = rounds.freeze > 0 ? PHASE.FREEZE : PHASE.LIVE;
    this.phaseEndsAt = now + rounds.freeze;
    this.behaviour.onRound('start');
    this.emitRound('start');
    this.announce('Round ' + this.round, 'round', 2);
    if (rounds.freeze <= 0) this.goLive(now);
  },
  prepareForRound(id) {
    if (!this.isActive(id)) return;
    this.lives[id] = this.startLives();
    this.spawnActor(id);
    if (this.rules.rounds.freeze > 0) Actors.flags[id] |= ACTOR_FLAG.FROZEN;   // freeze / buy time: S10 holds frozen actors
  },
  goLive(now) {
    const live = this.rules.rounds.live;
    this.phase = PHASE.LIVE;
    this.roundStart = now;
    this.roundEndsAt = live > 0 ? now + live : Infinity;
    this.timeoutReason = 'time';
    for (let id = 0; id < Actors.count; id++) Actors.flags[id] &= ~ACTOR_FLAG.FROZEN;
    this.behaviour.onRound('live');
    this.emitRound('live');
  },
  stepRounds(now) {
    if (this.phase === PHASE.FREEZE && now + TIME_EPSILON >= this.phaseEndsAt) this.goLive(now);
    else if (this.phase === PHASE.LIVE && now + TIME_EPSILON >= this.roundEndsAt) this.endRound(this.behaviour.onRound('timeout'), this.timeoutReason);
    else if (this.phase === PHASE.ROUND_END && now + TIME_EPSILON >= this.phaseEndsAt) this.nextRound(now);
  },
  // Called by behaviours (and the round clock); winner is a team index or DRAW.
  endRound(winner, reason) {
    if (this.phase !== PHASE.LIVE) return;
    this.roundWinner = winner;
    this.roundReason = reason;
    if (winner >= 0) this.teamRounds[winner]++;
    this.phase = PHASE.ROUND_END;
    this.phaseEndsAt = Sim.time + this.rules.rounds.endDelay;
    this.behaviour.onRound('end');
    this.emitRound('end');
    this.announce(winner >= 0 ? TEAM_NAMES[winner] + ' wins the round' : 'Round draw', 'round', 2);
    const matchWinner = this.roundsMatchWinner();
    if (matchWinner !== NOT_OVER) this.finish(matchWinner);
  },
  nextRound(now) {
    const switchAt = this.rules.rounds.switchAt;
    if (switchAt > 0 && this.round === switchAt) this.switchSides();
    this.startRound(now);
  },
  // First to winsNeeded wins; after the last round the side with more round wins, else a draw.
  roundsMatchWinner() {
    const rounds = this.rules.rounds;
    for (let team = 0; team < TEAM_COUNT; team++) if (this.teamRounds[team] >= rounds.winsNeeded) return this.over(team, 'rounds');
    if (this.round < rounds.limit) return NOT_OVER;
    return this.over(leadingTeam(this.teamRounds[0] - this.teamRounds[1]), 'rounds');
  },
  switchSides() {
    this.swapped = !this.swapped;
    this.announce('Switching sides', 'round', 2);
  },
  emitRound(phase) {
    roundPayload.round = this.round; roundPayload.phase = phase; roundPayload.winner = this.roundWinner;
    roundPayload.reason = phase === 'end' ? this.roundReason : ''; roundPayload.attackers = this.attackingTeam();
    Bus.emit('round', roundPayload);
  },
  teamAliveCount(team) {
    let alive = 0;
    for (let id = 0; id < Actors.count; id++) if (this.isActive(id) && Actors.team[id] === team && Actors.alive[id]) alive++;
    return alive;
  },
  checkTeamWipe() {
    const firstWiped = this.teamAliveCount(0) === 0, secondWiped = this.teamAliveCount(1) === 0;
    if (!firstWiped && !secondWiped) return;
    this.endRound(firstWiped && secondWiped ? DRAW : firstWiped ? 1 : 0, 'eliminated');
  },
  aliveLeaderTeam() { return leadingTeam(this.teamAliveCount(0) - this.teamAliveCount(1)); },

  // ---- Objectives: runtime entities from map.objectives (MODE-004 finite-state, read by bots and the HUD) ----
  buildObjectives(map) {
    const kind = this.rules.objective;
    if (!map || !map.objectives || kind === 'none') return;
    const companion = OBJECTIVE_COMPANIONS[kind];
    for (const source of map.objectives) if ((source.kind === kind || source.kind === companion) && mapServesMode(source, this.mode.id)) this.addObjective(source);
  },
  addObjective(source) {
    const objective = makeObjective(source, this.objectives.length);
    this.objectives.push(objective);
    return objective;
  },
  findObjectives(kind, out) {
    out.length = 0;
    for (const objective of this.objectives) if (objective.kind === kind) out.push(objective);
    return out;
  },
  resetObjectives() {
    for (const objective of this.objectives) {
      this.returnHome(objective);
      objective.owner = NO_TEAM; objective.capturingTeam = NO_TEAM; objective.progress = 0;
      objective.contested = false; objective.timer = 0; objective.holdTime = 0; objective.planter = -1; objective.detonateAt = Infinity;
    }
  },
  // Capture zones: counts standing (alive, not downed) team participants inside; contested when both teams are in.
  countInside(objective) {
    objective.inside[0] = 0; objective.inside[1] = 0;
    for (let id = 0; id < Actors.count; id++) {
      const team = Actors.team[id];
      if (this.actsOnObjectives(id) && this.participant[id] && team >= 0 && this.inZone(objective, id)) objective.inside[team]++;
    }
    objective.contested = objective.inside[0] > 0 && objective.inside[1] > 0;
  },
  inZone(objective, id) {
    const dy = Actors.y[id] - objective.y;
    return dy > -ZONE_BELOW && dy < ZONE_ABOVE && Math.hypot(Actors.x[id] - objective.x, Actors.z[id] - objective.z) <= objective.radius;
  },
  // The team alone in the zone, or NO_TEAM when it is empty or contested.
  zoneHolder(objective) {
    this.countInside(objective);
    if (objective.contested) return NO_TEAM;
    if (objective.inside[0] > 0) return 0;
    return objective.inside[1] > 0 ? 1 : NO_TEAM;
  },
  // Generic capture meter (0..1 over params.captureTime, faster with more capturers up to params.captureMax).
  // An enemy's partial progress is undone first; empty or owner-held zones decay back to 0. Returns true on capture.
  updateCapture(objective, dt, params) {
    const holder = this.zoneHolder(objective);
    if (objective.contested) return false;
    const rate = dt / params.captureTime;
    if (holder === NO_TEAM || holder === objective.owner || (objective.capturingTeam !== holder && objective.progress > 0)) {
      objective.progress = Math.max(0, objective.progress - rate);
      if (objective.progress === 0) objective.capturingTeam = NO_TEAM;
      return false;
    }
    objective.capturingTeam = holder;
    objective.progress += rate * Math.min(params.captureMax || 1, 1 + (objective.inside[holder] - 1) * (params.captureStack || 0));
    if (objective.progress + TIME_EPSILON < 1) return false;
    this.captureZone(objective, holder);
    return true;
  },
  captureZone(objective, team) {
    objective.owner = team; objective.progress = 0; objective.capturingTeam = NO_TEAM;
    for (let id = 0; id < Actors.count; id++) {
      if (this.actsOnObjectives(id) && this.participant[id] && Actors.team[id] === team && this.inZone(objective, id)) this.creditObjective(id, 'capture');
    }
    this.announce(TEAM_NAMES[team] + ' captured ' + this.objectiveLabel(objective), 'capture', 2);
  },
  // The HUD letter of list[index] (0 = A): its place among the active objectives of its kind before it.
  objectiveLetter(list, index) {
    let letter = 0;
    for (let i = 0; i < index; i++) if (list[i].kind === list[index].kind && list[i].active) letter++;
    return letter;
  },
  // What players read and hear for an objective: the map's name for it, else 'point' and the letter the HUD shows.
  objectiveLabel(objective) {
    return objective.name || 'point ' + String.fromCharCode(LETTER_A_CODE + this.objectiveLetter(this.objectives, objective.index));
  },
  // First standing participant near a point whose team relates to `team` as asked (NEAR_ANY / NEAR_TEAM / NEAR_ENEMY).
  // With `buttons` (a BTN mask) only an actor holding one of those buttons counts; actors with any of `skipFlags`
  // (an ACTOR_FLAG mask, e.g. PROTECTED) are passed over, so they never hide an actor behind them.
  findActorNear(x, y, z, radius, team, relation, buttons, skipFlags) {
    for (let id = 0; id < Actors.count; id++) {
      if (!this.actsOnObjectives(id) || !this.isActive(id) || !relationMatches(Actors.team[id], team, relation)) continue;
      if (buttons && (Actors.buttons[id] & buttons) === 0) continue;
      if (skipFlags && (Actors.flags[id] & skipFlags) !== 0) continue;
      if (withinTouch(id, x, y, z, radius)) return id;
    }
    return -1;
  },
  findToucher(objective, relation, skipFlags) {
    return this.findActorNear(objective.x, objective.y, objective.z, TOUCH_RADIUS, objective.team, relation, 0, skipFlags);
  },
  carrierNear(objective, x, y, z) { return objective.carrier >= 0 && withinTouch(objective.carrier, x, y, z, TOUCH_RADIUS); },
  zoneContaining(zones, id) {
    for (let i = 0; i < zones.length; i++) if (this.inZone(zones[i], id)) return zones[i];
    return null;
  },
  pickUp(objective, id) {
    objective.state = 'carried';
    objective.carrier = id;
    this.followCarrier(objective);
  },
  followCarrier(objective) {
    const id = objective.carrier;
    if (id < 0) return;
    objective.x = Actors.x[id]; objective.y = Actors.y[id]; objective.z = Actors.z[id];
  },
  drop(objective) {
    this.followCarrier(objective);
    objective.state = 'dropped';
    objective.carrier = -1;
    objective.droppedAt = Sim.time;
  },
  returnHome(objective) {
    objective.state = 'home';
    objective.carrier = -1;
    objective.x = objective.homeX; objective.y = objective.homeY; objective.z = objective.homeZ;
  },
  returnDue(objective, now, seconds) { return objective.state === 'dropped' && seconds > 0 && now + TIME_EPSILON >= objective.droppedAt + seconds; },
  dropCarried(id) {
    for (const objective of this.objectives) if (objective.carrier === id) this.drop(objective);
  },

  // ---- Charge timers (bomb M13, ghostops M27, rush M08): params plantTime, fuse, defuseTime, defuseCheckpoint,
  // defuseRange. objective.timer holds the plant progress while carried, then the defuse progress once planted ----
  // The carrier holding USE inside one of the sites for plantTime plants the charge. Returns true on the plant.
  stepPlant(charge, sites, dt, params) {
    const carrier = charge.carrier;
    const planting = carrier >= 0 && holdsUse(carrier) && this.zoneContaining(sites, carrier) !== null;
    if (!this.advanceUse(charge, planting, dt, params.plantTime, 0)) return false;
    this.plantCharge(charge, carrier, params.fuse);
    return true;
  },
  // Plants at the charge's position (rush arms a relay in place); in a live round the fuse replaces the round clock.
  plantCharge(charge, id, fuse) {
    if (charge.carrier >= 0) this.drop(charge);
    charge.state = 'planted'; charge.planter = id; charge.timer = 0; charge.detonateAt = Sim.time + fuse;
    if (this.rules.rounds && this.phase === PHASE.LIVE) { this.roundEndsAt = charge.detonateAt; this.timeoutReason = 'detonated'; }
    this.creditObjective(id, 'plant');
    this.announce('Charge planted', 'bomb', 3);
  },
  // Any living member of `team` holding USE within defuseRange defuses in defuseTime. Returns the defuser or -1.
  stepDefuse(charge, team, dt, params) {
    const defuser = this.findActorNear(charge.x, charge.y, charge.z, params.defuseRange, team, NEAR_TEAM, BTN.USE);
    if (!this.advanceUse(charge, defuser >= 0, dt, params.defuseTime, params.defuseCheckpoint)) return -1;
    charge.state = 'defused';
    this.creditObjective(defuser, 'defuse');
    this.announce('Charge defused', 'bomb', 3);
    return defuser;
  },
  detonateCharge(charge, radius) {
    charge.state = 'detonated';
    blastPayload.x = charge.x; blastPayload.y = charge.y; blastPayload.z = charge.z;
    blastPayload.radius = radius; blastPayload.owner = charge.planter;
    Bus.emit('explosion', blastPayload);
    this.announce('Charge detonated', 'bomb', 3);
  },
  // Hold-USE progress in objective.timer: grows while in use; an interruption keeps `checkpoint` s once passed
  // (0 = start over). Returns true when `seconds` are reached.
  advanceUse(objective, using, dt, seconds, checkpoint) {
    if (!using) {
      objective.timer = checkpoint > 0 && objective.timer + TIME_EPSILON >= checkpoint ? checkpoint : 0;
      return false;
    }
    objective.timer += dt;
    return objective.timer + TIME_EPSILON >= seconds;
  },

  // ---- HUD, results, markers ----
  // One reused object (no allocation per call); teamScores/teamRounds/teamMeter/objectives are live references.
  hudState() {
    const hud = this.hud, rules = this.rules, id = Game.playerId, now = Sim.time;
    hud.active = this.active; hud.mode = this.mode ? this.mode.id : ''; hud.phase = this.phase; hud.round = this.round;
    hud.timeLeft = rules ? this.timeLeft(now) : 0; hud.overtime = this.overtime;
    hud.teams = rules ? rules.teams : 0; hud.scoreLimit = rules ? rules.scoreLimit : 0;
    hud.roundsToWin = rules && rules.rounds ? rules.rounds.winsNeeded : 0;
    hud.leader = this.leader; hud.leaderScore = this.leaderScore === -Infinity ? 0 : this.leaderScore;
    hud.playerId = id; hud.playerScore = id >= 0 ? this.score[id] : 0; hud.playerRank = id >= 0 ? this.rankOf(id) : 0;
    hud.playerLives = id >= 0 ? this.lives[id] : LIVES_UNLIMITED; hud.respawnIn = this.respawnIn(id, now);
    hud.attackers = this.attackingTeam();
    hud.teamScores = this.teamScore; hud.teamRounds = this.teamRounds; hud.teamMeter = this.teamMeter; hud.objectives = this.objectives;
    return hud;
  },
  timeLeft(now) {
    if (this.rules.rounds) return Math.max(0, this.roundClockEnd() - now);
    const limit = this.rules.timeLimit;
    if (limit <= 0) return 0;
    return Math.max(0, limit + this.timeBonus + (this.overtime ? OVERTIME_SECONDS : 0) - (now - this.startTime));
  },
  roundClockEnd() {
    if (this.phase === PHASE.LIVE) return this.roundEndsAt === Infinity ? 0 : this.roundEndsAt;
    return this.phase === PHASE.FREEZE || this.phase === PHASE.ROUND_END ? this.phaseEndsAt : 0;
  },
  rankOf(id) {
    const value = this.rankValue(id);
    let rank = 1;
    for (let other = 0; other < Actors.count; other++) if (this.isActive(other) && this.rankValue(other) > value) rank++;
    return rank;
  },
  // Free-for-all ranks like the leader (behaviour.score: lives first in LMS); team modes rank by personal score.
  rankValue(id) { return this.rules.teams === TEAM_COUNT ? this.score[id] : this.behaviour.score(id); },
  // Seconds until the actor may respawn; 0 when alive or none pending, -1 when no respawn will come.
  respawnIn(id, now) {
    if (id < 0 || Actors.alive[id]) return 0;
    if (this.respawnAt[id] === Infinity) return -1;
    return Math.max(0, this.respawnAt[id] - now);
  },
  buildResults(winner) {
    const teams = this.rules.teams === TEAM_COUNT, players = [];
    for (let id = 0; id < Actors.count; id++) if (this.participant[id]) players.push(this.playerResult(id));
    players.sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
    return { mode: this.mode.id, ruleset: this.rules.id, winner, draw: winner === DRAW, reason: this.endReason,
      winnerTeam: teams && winner >= 0 ? winner : NO_TEAM, winnerId: !teams && winner >= 0 ? winner : -1,
      duration: Sim.time - this.startTime, rounds: this.round, players,
      teams: teams ? [this.teamResult(0, players), this.teamResult(1, players)] : [], queue: this.queueAfter(winner) };
  },
  playerResult(id) {
    return { id, name: Actors.name[id], kind: Actors.kind[id], team: Actors.team[id], kills: this.kills[id], deaths: this.deaths[id],
      assists: this.assists[id], suicides: this.suicides[id], score: this.score[id], objective: this.objective[id],
      bestStreak: this.bestStreak[id], lives: this.lives[id], queued: this.queued[id] === 1 };
  },
  teamResult(team, players) {
    const members = players.filter((player) => player.team === team);
    const total = (field) => members.reduce((sum, player) => sum + player[field], 0);
    return { team, name: TEAM_NAMES[team], score: this.teamScore[team], rounds: this.teamRounds[team], kills: total('kills'), deaths: total('deaths'), objective: total('objective') };
  },
  // Winner-stays queue (duel): next match is the winner against the first queued participant.
  queueAfter(winner) {
    if (!this.rules.params.queue) return [];
    const queue = winner >= 0 && this.rules.teams !== TEAM_COUNT ? [Actors.name[winner]] : [];
    for (let id = 0; id < Actors.count; id++) if (this.participant[id] && this.queued[id]) queue.push(Actors.name[id]);
    return queue;
  },
  draw(batch) {
    for (let i = 0; i < this.objectives.length; i++) drawObjective(batch, this.objectives[i]);
  },
};

function makeObjective(source, index) {
  const kind = source.kind, x = source.x || 0, y = source.y || 0, z = source.z || 0;
  return { index, id: source.id || kind + index, name: source.name || '', kind, team: typeof source.team === 'number' ? source.team : NO_TEAM,
    x, y, z, homeX: x, homeY: y, homeZ: z, radius: source.radius || OBJECTIVE_RADIUS[kind] || DEFAULT_OBJECTIVE_RADIUS,
    owner: NO_TEAM, capturingTeam: NO_TEAM, progress: 0, contested: false, inside: new Int16Array(TEAM_COUNT), active: true,
    state: 'home', carrier: -1, droppedAt: 0, timer: 0, holdTime: 0, planter: -1, detonateAt: Infinity, path: source.path || null,
    stage: source.stage || 0, checkpoints: source.checkpoints || null, goals: null };
}

// The touch rule (TOUCH_HEIGHT window, flat radius) for a point kept in coordinate arrays at `index`: the one form, used
// as is by callers that test many points per step (13g loot and beacons), since float arguments are boxed (PERF-006).
function withinTouchAt(id, xs, ys, zs, index, radius) {
  if (Math.abs(Actors.y[id] - ys[index]) > TOUCH_HEIGHT) return false;
  const dx = Actors.x[id] - xs[index], dz = Actors.z[id] - zs[index];
  return dx * dx + dz * dz <= radius * radius;
}
const touchPointX = new Float64Array(1), touchPointY = new Float64Array(1), touchPointZ = new Float64Array(1);
function withinTouch(id, x, y, z, radius) {
  touchPointX[0] = x; touchPointY[0] = y; touchPointZ[0] = z;
  return withinTouchAt(id, touchPointX, touchPointY, touchPointZ, 0, radius);
}

function holdsUse(id) { return (Actors.buttons[id] & BTN.USE) !== 0; }

// The team ahead by `difference` (team 0 minus team 1), or DRAW when level.
function leadingTeam(difference) { return difference === 0 ? DRAW : difference > 0 ? 0 : 1; }

function relationMatches(actorTeam, team, relation) {
  if (relation === NEAR_TEAM) return actorTeam === team;
  if (relation === NEAR_ENEMY) return team < 0 || actorTeam !== team;
  return true;
}

function carriedByInvisible(objective) {
  return objective.state === 'carried' && objective.carrier >= 0 && (Actors.flags[objective.carrier] & ACTOR_FLAG.INVISIBLE) !== 0;
}

function formatTimeWarning(seconds) {
  if (seconds < 60) return seconds + ' seconds remaining';
  const minutes = seconds / 60;
  return minutes + (minutes === 1 ? ' minute remaining' : ' minutes remaining');
}

// Markers: zones as rings in the owner's colour, carriables as small shapes (above the carrier's head when carried).
function drawObjective(batch, objective) {
  if (!objective.active || objective.kind === 'payloadPath') return;
  const carriable = CARRIABLE_KINDS.includes(objective.kind);
  if (carriable && carriedByInvisible(objective)) return;   // a carried prize hides with its cloaked carrier (M27)
  const team = carriable || objective.kind === 'flagBase' ? objective.team : objective.owner;
  const color = TEAM_COLORS[team === 0 || team === 1 ? team : NEUTRAL_COLOR];
  if (!carriable) {
    batch.mesh('ring', objective.x, objective.y + 0.05, objective.z, 0, 0, objective.radius, 1, objective.radius, color[0], color[1], color[2], MARKER_GLOW);
    return;
  }
  const lift = objective.state === 'carried' ? 2.1 : 0;
  batch.mesh(objective.kind === 'flag' ? 'cylinder' : 'box', objective.x, objective.y + lift + 0.6, objective.z, 0, 0, 0.12, 1.2, 0.12, color[0], color[1], color[2], MARKER_GLOW);
}

Bus.on('match.start', (match) => Modes.start(match));
Bus.on('match.stop', () => Modes.stop());
Bus.on('actor.create', (id) => Modes.resetActor(id));
// MOV-001 handicap: what an actor deals to an opponent follows its own factor (setup.player / setup.bots[].handicap, X22 for the player).
Damage.addAttackerScale((source, target) => (source >= 0 && source !== target && Game.match && Game.match.handicap ? Game.match.handicap[source] : 1));
Bus.on('actor.remove', (id) => Modes.onRemove(id));
Bus.on('kill', (event) => Modes.onKill(event));
Bus.on('weapon.fire', (shot) => Modes.endProtection(shot.id));
Sim.addSystem('rules', 70, (dt) => Modes.step(dt));
Render.addSource('objectives', (batch) => Modes.draw(batch));
