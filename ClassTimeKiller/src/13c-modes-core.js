// Core versus mode behaviours on the S13 framework. M01 ffa, M02 tdm and M03 duel run on the default hooks
// (limits and scoring come from their rows); M04/M05 carry flags; M06, M07, M09 and M12 use capture zones;
// M13 plants and defuses a charge in rounds; M14 is elimination rounds with a shrinking safe area; M15 counts lives.

const LMS_LIFE_WEIGHT = 1000;        // Last Standing ranks by lives left first, then by score
const HAZARD_INTERVAL = 1;           // the elimination safe area hurts once per second
const SAFE_AREA_FALLBACK_RADIUS = 50;

const hazardRequest = { target: -1, source: -1, amount: 0, kind: 'hazard', element: 'kinetic', x: 0, y: 0, z: 0 };
const blastPayload = { x: 0, y: 0, z: 0, radius: 0, owner: -1, source: 'bomb', element: 'kinetic' };

Modes.register('ffa', {});
Modes.register('tdm', {});
Modes.register('duel', {});

Modes.register('lms', {
  score(index) { return Math.max(0, Modes.lives[index]) * LMS_LIFE_WEIGHT + Modes.score[index]; },
});

// ---- M04 Flag Raid and M05 Lone Flag: params.neutral picks the one-flag rules ----
const FLAG_BEHAVIOUR = {
  flags: [], bases: [],
  start() {
    Modes.findObjectives('flag', this.flags);
    Modes.findObjectives('flagBase', this.bases);
  },
  step(dt, now) {
    for (let i = 0; i < this.flags.length; i++) this.stepFlag(this.flags[i], now);
  },
  stepFlag(flag, now) {
    if (flag.state === 'carried') { Modes.followCarrier(flag); this.tryCapture(flag); return; }
    if (Modes.returnDue(flag, now, Modes.rules.params.returnTime)) { this.sendHome(flag, -1); return; }
    const taker = Modes.findToucher(flag, NEAR_ENEMY);
    if (taker >= 0) { Modes.pickUp(flag, taker); Modes.announce(Actors.name[taker] + ' has the flag', 'flag', 2); return; }
    if (flag.state !== 'dropped' || flag.team < 0) return;
    const returner = Modes.findToucher(flag, NEAR_TEAM);       // touching your own dropped flag returns it
    if (returner >= 0) this.sendHome(flag, returner);
  },
  sendHome(flag, returner) {
    Modes.returnHome(flag);
    if (returner >= 0) Modes.creditObjective(returner, 'return');
    Modes.announce('Flag returned', 'flag', 2);
  },
  // Flag Raid: bring the enemy flag to your own flag, which must be home (params.homeRequired).
  // Lone Flag: bring the neutral flag to the enemy base.
  tryCapture(flag) {
    const carrier = flag.carrier, team = Actors.team[carrier];
    const target = Modes.rules.params.neutral ? teamObjective(this.bases, 1 - team) : teamObjective(this.flags, team);
    if (!target || !Modes.carrierNear(flag, target.homeX, target.homeY, target.homeZ)) return;
    if (Modes.rules.params.homeRequired && target.kind === 'flag' && target.state !== 'home') return;
    Modes.creditObjective(carrier, 'capture');
    Modes.awardTeam(team, 1, 'capture');
    Modes.returnHome(flag);
    Modes.announce(TEAM_NAMES[team] + ' scores', 'flag', 3);
  },
};
Modes.register('ctf', FLAG_BEHAVIOUR);
Modes.register('oneflag', FLAG_BEHAVIOUR);

// ---- M06 Holdfast: +tickPoints per held point every tickInterval seconds ----
Modes.register('dom', {
  points: [], tickTimer: 0,
  start() { Modes.findObjectives('point', this.points); this.tickTimer = 0; },
  step(dt) {
    const params = Modes.rules.params;
    captureAll(this.points, dt, params);
    this.tickTimer += dt;
    if (this.tickTimer + TIME_EPSILON < params.tickInterval) return;
    this.tickTimer -= params.tickInterval;
    for (let i = 0; i < this.points.length; i++) if (this.points[i].owner >= 0) Modes.awardTeam(this.points[i].owner, params.tickPoints, 'hold');
  },
});

// ---- M07 Frontline: team score = tickets; -deathCost per death; a team holding <= bleedHeld points
// and fewer than the enemy loses one ticket every bleedInterval seconds; owned points are spawn points ----
Modes.register('conquest', {
  points: [], bleedTimer: 0,
  start() {
    Modes.findObjectives('point', this.points);
    this.bleedTimer = 0;
    Modes.teamScore.fill(Modes.rules.params.tickets);
  },
  step(dt) {
    const params = Modes.rules.params;
    captureAll(this.points, dt, params);
    this.bleedTimer += dt;
    if (this.bleedTimer + TIME_EPSILON < params.bleedInterval) return;
    this.bleedTimer -= params.bleedInterval;
    const blueHeld = ownedCount(this.points, 0), redHeld = ownedCount(this.points, 1);
    bleedTickets(0, blueHeld, redHeld, params);
    bleedTickets(1, redHeld, blueHeld, params);
  },
  onKill(victim) {
    if (victim >= 0 && Modes.participant[victim] && Actors.team[victim] >= 0) spendTickets(Actors.team[victim], Modes.rules.params.deathCost, 'death');
  },
  isOver(now) {
    for (let team = 0; team < TEAM_COUNT; team++) if (Modes.teamScore[team] <= 0) return Modes.over(1 - team, 'tickets');
    return Modes.standardIsOver(now);
  },
});

// ---- M09 Hotpoint: one active hill, moving every moveInterval seconds in map order; holdRate points/s uncontested ----
Modes.register('hardpoint', {
  hills: [], activeIndex: -1, holder: NO_TEAM,
  start() {
    Modes.findObjectives('hill', this.hills);
    this.activeIndex = -1;
    this.holder = NO_TEAM;
  },
  step(dt, now) {
    if (!this.hills.length) return;
    this.rotate(now);
    const hill = this.hills[this.activeIndex];
    const holder = Modes.zoneHolder(hill);
    hill.owner = holder;
    if (holder !== this.holder) { this.holder = holder; hill.holdTime = 0; }
    if (holder < 0) return;
    hill.holdTime += dt;
    const secondsPerPoint = 1 / Modes.rules.params.holdRate;
    if (hill.holdTime + TIME_EPSILON < secondsPerPoint) return;
    hill.holdTime -= secondsPerPoint;
    Modes.awardTeam(holder, 1, 'hold');
  },
  rotate(now) {
    const index = Math.floor((now - Modes.startTime + TIME_EPSILON) / Modes.rules.params.moveInterval) % this.hills.length;
    if (index === this.activeIndex) return;
    this.activeIndex = index;
    this.holder = NO_TEAM;
    for (let i = 0; i < this.hills.length; i++) {
      const hill = this.hills[i];
      hill.active = i === index; hill.owner = NO_TEAM; hill.holdTime = 0;
    }
    Modes.announce('Hotpoint at ' + this.hills[index].id, 'objective', 2);
  },
});

// ---- M12 Uplink: capture the point, then the owner's meter (teamMeter) fills over progressTime while no enemy
// is on it; 100% wins the round, best of 3. An enemy on the point at >= overtimeAt keeps the round in overtime ----
Modes.register('control', {
  point: null,
  start() { this.point = Modes.objectives.find((objective) => objective.kind === 'point') || null; },
  onRound(phase) {
    if (phase === 'start') { Modes.teamMeter.fill(0); Modes.overtime = false; }
    return phase === 'timeout' ? meterLeader() : DRAW;
  },
  step(dt) {
    const point = this.point, params = Modes.rules.params;
    if (!point) return;
    Modes.updateCapture(point, dt, params);
    const owner = point.owner;
    if (owner < 0) return;
    const enemyInside = point.inside[1 - owner] > 0;
    Modes.overtime = enemyInside && Modes.teamMeter[owner] + TIME_EPSILON >= params.overtimeAt;
    if (enemyInside) return;
    Modes.teamMeter[owner] = Math.min(1, Modes.teamMeter[owner] + dt / params.progressTime);
    if (Modes.teamMeter[owner] + TIME_EPSILON >= 1) Modes.endRound(owner, 'objective');
  },
});

// ---- M13 Detonate: side 0 attacks. A carrier holding USE inside a site for plantTime plants; the fuse then
// replaces the round clock. Defenders holding USE within defuseRange defuse in defuseTime; an interrupted
// defuse keeps defuseCheckpoint seconds once passed. Economy listens to the 'round' and 'score' events ----
Modes.register('bomb', {
  sites: [], bomb: null, planted: false, planter: -1, plantProgress: 0, defuseProgress: 0,
  start() {
    Modes.findObjectives('bombsite', this.sites);
    this.bomb = Modes.addObjective({ id: 'charge', kind: 'bomb' });
  },
  onRound(phase) {
    if (phase === 'start') this.resetRound();
    if (phase !== 'timeout') return DRAW;
    if (!this.planted) return defendingTeam();
    this.detonate();
    return Modes.attackingTeam();
  },
  resetRound() {
    this.planted = false; this.planter = -1; this.plantProgress = 0; this.defuseProgress = 0;
    const carrier = randomAliveMember(Modes.attackingTeam());
    if (carrier >= 0) Modes.pickUp(this.bomb, carrier);
  },
  step(dt) {
    if (this.planted) { this.stepPlanted(dt); return; }
    this.stepCarried();
    this.stepPlant(dt);
    if (!this.planted) Modes.checkTeamWipe();
  },
  stepCarried() {
    const bomb = this.bomb;
    if (bomb.state === 'carried') { Modes.followCarrier(bomb); return; }
    const taker = Modes.findActorNear(bomb.x, bomb.y, bomb.z, TOUCH_RADIUS, Modes.attackingTeam(), NEAR_TEAM);
    if (taker >= 0) Modes.pickUp(bomb, taker);
  },
  stepPlant(dt) {
    const carrier = this.bomb.carrier;
    const planting = carrier >= 0 && holdsUse(carrier) && this.siteOf(carrier) !== null;
    this.plantProgress = planting ? this.plantProgress + dt : 0;
    if (planting && this.plantProgress + TIME_EPSILON >= Modes.rules.params.plantTime) this.plant(carrier);
  },
  siteOf(id) {
    for (let i = 0; i < this.sites.length; i++) if (Modes.inZone(this.sites[i], id)) return this.sites[i];
    return null;
  },
  plant(id) {
    this.planted = true;
    this.planter = id;
    Modes.drop(this.bomb);
    this.bomb.state = 'planted';
    Modes.roundEndsAt = Sim.time + Modes.rules.params.fuse;
    Modes.timeoutReason = 'detonated';
    Modes.creditObjective(id, 'plant');
    Modes.announce('Charge planted', 'bomb', 3);
  },
  stepPlanted(dt) {
    this.stepDefuse(dt);
    if (Modes.phase === PHASE.LIVE && Modes.teamAliveCount(defendingTeam()) === 0) Modes.endRound(Modes.attackingTeam(), 'eliminated');
  },
  stepDefuse(dt) {
    const params = Modes.rules.params, bomb = this.bomb;
    const defuser = Modes.findActorNear(bomb.x, bomb.y, bomb.z, params.defuseRange, defendingTeam(), NEAR_TEAM);
    if (defuser < 0 || !holdsUse(defuser)) {
      this.defuseProgress = this.defuseProgress + TIME_EPSILON >= params.defuseCheckpoint ? params.defuseCheckpoint : 0;
      return;
    }
    this.defuseProgress += dt;
    if (this.defuseProgress + TIME_EPSILON < params.defuseTime) return;
    Modes.creditObjective(defuser, 'defuse');
    Modes.announce('Charge defused', 'bomb', 3);
    Modes.endRound(defendingTeam(), 'defused');
  },
  detonate() {
    const bomb = this.bomb;
    blastPayload.x = bomb.x; blastPayload.y = bomb.y; blastPayload.z = bomb.z;
    blastPayload.radius = Modes.rules.params.blastRadius; blastPayload.owner = this.planter;
    Bus.emit('explosion', blastPayload);
    Modes.announce('Charge detonated', 'bomb', 3);
  },
});

// ---- M14 Last Squad: one life per round; in the last shrinkTime seconds the safe area shrinks from the map's
// half-diagonal to shrinkMinRadius and actors outside take zoneDamage per second (damage.request) ----
Modes.register('elim', {
  hazardTimer: 0, centerX: 0, centerZ: 0, fullRadius: SAFE_AREA_FALLBACK_RADIUS,
  start() {
    const low = World.boundsMin, high = World.boundsMax;
    const known = Number.isFinite(low.x) && Number.isFinite(high.x);
    this.centerX = known ? (low.x + high.x) / 2 : 0;
    this.centerZ = known ? (low.z + high.z) / 2 : 0;
    this.fullRadius = known ? Math.hypot(high.x - low.x, high.z - low.z) / 2 : SAFE_AREA_FALLBACK_RADIUS;
  },
  onRound(phase) {
    if (phase === 'start') { Modes.hud.zoneRadius = 0; this.hazardTimer = 0; }
    return phase === 'timeout' ? Modes.aliveLeaderTeam() : DRAW;
  },
  step(dt, now) {
    Modes.checkTeamWipe();
    if (Modes.phase === PHASE.LIVE) this.stepSafeArea(dt, now);
  },
  stepSafeArea(dt, now) {
    const params = Modes.rules.params, remaining = Modes.roundEndsAt - now;
    if (remaining > params.shrinkTime) return;
    const radius = lerp(this.fullRadius, params.shrinkMinRadius, 1 - clamp(remaining / params.shrinkTime, 0, 1));
    Modes.hud.zoneX = this.centerX; Modes.hud.zoneZ = this.centerZ; Modes.hud.zoneRadius = radius;
    this.hazardTimer += dt;
    if (this.hazardTimer + TIME_EPSILON < HAZARD_INTERVAL) return;
    this.hazardTimer -= HAZARD_INTERVAL;
    for (let id = 0; id < Actors.count; id++) {
      if (Actors.alive[id] && Modes.isActive(id) && Math.hypot(Actors.x[id] - this.centerX, Actors.z[id] - this.centerZ) > radius) requestHazard(id, params.zoneDamage * HAZARD_INTERVAL);
    }
  },
});

function teamObjective(list, team) {
  for (let i = 0; i < list.length; i++) if (list[i].team === team) return list[i];
  return null;
}

function captureAll(points, dt, params) {
  for (let i = 0; i < points.length; i++) Modes.updateCapture(points[i], dt, params);
}

function ownedCount(points, team) {
  let owned = 0;
  for (let i = 0; i < points.length; i++) if (points[i].owner === team) owned++;
  return owned;
}

function bleedTickets(team, held, enemyHeld, params) {
  if (held <= params.bleedHeld && held < enemyHeld) spendTickets(team, 1, 'bleed');
}

function spendTickets(team, amount, reason) {
  Modes.awardTeam(team, -Math.min(amount, Math.max(0, Modes.teamScore[team])), reason);
}

function meterLeader() {
  const lead = Modes.teamMeter[0] - Modes.teamMeter[1];
  return lead === 0 ? DRAW : lead > 0 ? 0 : 1;
}

function defendingTeam() { return 1 - Modes.attackingTeam(); }

function holdsUse(id) { return (Actors.buttons[id] & BTN.USE) !== 0; }

function randomAliveMember(team) {
  const alive = Modes.teamAliveCount(team);
  if (!alive) return -1;
  let pick = Rng.rules.int(0, alive - 1);
  for (let id = 0; id < Actors.count; id++) {
    if (!Modes.isActive(id) || Actors.team[id] !== team || !Actors.alive[id]) continue;
    if (pick === 0) return id;
    pick--;
  }
  return -1;
}

function requestHazard(id, amount) {
  hazardRequest.target = id; hazardRequest.amount = amount;
  hazardRequest.x = Actors.x[id]; hazardRequest.y = Actors.y[id]; hazardRequest.z = Actors.z[id];
  Bus.emit('damage.request', hazardRequest);
}
