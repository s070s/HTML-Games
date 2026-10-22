// Core versus mode behaviours on the S13 framework. M01 ffa, M02 tdm and M03 duel run on the default hooks
// (limits and scoring come from their rows); M04/M05 carry flags; M06, M07, M09 and M12 use capture zones;
// M13 plants and defuses a charge in rounds; M14 is elimination rounds with a shrinking safe area; M15 counts lives.

const LMS_LIFE_WEIGHT = 1000;        // Last Standing ranks by lives left first, then by score
const SAFE_AREA_HURT_INTERVAL = 1;           // the elimination safe area hurts once per second
const SAFE_AREA_FALLBACK_RADIUS = 50;

const hazardRequest = { target: -1, source: -1, amount: 0, kind: 'hazard', element: 'kinetic', x: 0, y: 0, z: 0 };
const safeAreaScratch = { x: 0, z: 0, radius: 0 };

Modes.register('ffa', {});
Modes.register('tdm', {});
Modes.register('duel', {});

Modes.register('lms', {
  score(index) { return Math.max(0, Modes.lives[index]) * LMS_LIFE_WEIGHT + Modes.score[index]; },
  // M15: every spawn brings the whole weapon set (params.allWeapons) at full reserve (params.maxAmmo) and params.startArmor.
  onSpawn(id) {
    const params = Modes.rules.params;
    if (params.allWeapons) giveWholeSet(id, params.maxAmmo);
    if (params.startArmor) Actors.armor[id] = Math.max(Actors.armor[id], params.startArmor);
  },
});
function giveWholeSet(id, fullReserve) {
  Weapons.setLoadout(id, currentWeaponSet().weapons);
  if (!fullReserve) return;
  for (let w = 0; w < WEAPON_COUNT; w++) if (Weapons.owned[Weapons.slotIndex(id, w)]) Weapons.addWeaponAmmo(id, CAT.weapons[w], Weapons.maxReserve(id, CAT.weapons[w]));
}

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

// ---- M07 Frontline: team score = tickets; -deathCost per death; a team holding fewer points than the other team AND
// <= bleedHeld points loses one ticket every bleedInterval seconds (so nobody bleeds at 0-0); owned points are spawn points ----
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
    for (let team = 0; team < TEAM_COUNT; team++) {
      const held = ownedCount(this.points, team);
      if (held < ownedCount(this.points, 1 - team) && held <= params.bleedHeld) spendTickets(team, 1, 'bleed');
    }
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

// ---- M12 Uplink: capture the point, then the owner's meter (teamMeter) fills over progressTime while they own it;
// 100% wins the round, best of 3. While an enemy is on the point the meter stops at overtimeAt (overtime) ----
Modes.register('control', {
  point: null,
  start() { this.point = Modes.objectives.find((objective) => objective.kind === 'point') || null; },
  onRound(phase) {
    if (phase === 'start') { Modes.teamMeter.fill(0); Modes.overtime = false; }
    return phase === 'timeout' ? leadingTeam(Modes.teamMeter[0] - Modes.teamMeter[1]) : DRAW;
  },
  step(dt) {
    const point = this.point, params = Modes.rules.params;
    if (!point) return;
    Modes.updateCapture(point, dt, params);
    const owner = point.owner;
    Modes.overtime = false;
    if (owner < 0) return;
    const enemyInside = point.inside[1 - owner] > 0;
    const meter = Modes.teamMeter[owner], filled = meter + dt / params.progressTime;
    Modes.teamMeter[owner] = enemyInside ? Math.max(meter, Math.min(filled, params.overtimeAt)) : Math.min(1, filled);
    Modes.overtime = enemyInside && Modes.teamMeter[owner] + TIME_EPSILON >= params.overtimeAt;
    if (!enemyInside && Modes.teamMeter[owner] + TIME_EPSILON >= 1) Modes.endRound(owner, 'objective');
  },
});

// ---- M13 Detonate: side 0 attacks; a random attacker carries the charge. Planting, the fuse on the round clock and
// defusing are the framework charge timers (Modes.stepPlant / stepDefuse). Economy listens to 'round' and 'score' ----
Modes.register('bomb', {
  sites: [], charge: null,
  start() {
    Modes.findObjectives('bombsite', this.sites);
    this.charge = Modes.addObjective({ id: 'charge', kind: 'bomb' });
  },
  onRound(phase) {
    if (phase === 'start') this.giveCharge();
    if (phase !== 'timeout') return DRAW;
    if (this.charge.state !== 'planted') return defendingTeam();
    Modes.detonateCharge(this.charge, Modes.rules.params.blastRadius);
    return Modes.attackingTeam();
  },
  giveCharge() {
    const carrier = randomAliveMember(Modes.attackingTeam(), -1);
    if (carrier >= 0) Modes.pickUp(this.charge, carrier);
  },
  step(dt) {
    if (this.charge.state === 'planted') { this.stepPlanted(dt); return; }
    this.stepCarried();
    if (!Modes.stepPlant(this.charge, this.sites, dt, Modes.rules.params)) Modes.checkTeamWipe();
  },
  stepCarried() {
    const charge = this.charge;
    if (charge.state === 'carried') { Modes.followCarrier(charge); return; }
    const taker = Modes.findActorNear(charge.x, charge.y, charge.z, TOUCH_RADIUS, Modes.attackingTeam(), NEAR_TEAM);
    if (taker >= 0) Modes.pickUp(charge, taker);
  },
  // After the plant only the defenders can lose by a wipe: dead attackers do not stop the fuse.
  stepPlanted(dt) {
    if (Modes.stepDefuse(this.charge, defendingTeam(), dt, Modes.rules.params) >= 0) { Modes.endRound(defendingTeam(), 'defused'); return; }
    if (Modes.teamAliveCount(defendingTeam()) === 0) Modes.endRound(Modes.attackingTeam(), 'eliminated');
  },
});

// ---- M14 Last Squad: one life per round; in the last shrinkTime seconds the safe area shrinks from the map's
// half-diagonal to shrinkMinRadius and actors outside take zoneDamage per second (damage.request) ----
Modes.register('elim', {
  hazardTimer: 0, centerX: 0, centerZ: 0, fullRadius: SAFE_AREA_FALLBACK_RADIUS,
  start() {
    const area = worldSafeArea(safeAreaScratch);
    this.centerX = area.x; this.centerZ = area.z; this.fullRadius = area.radius;
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
    if (this.hazardTimer + TIME_EPSILON < SAFE_AREA_HURT_INTERVAL) return;
    this.hazardTimer -= SAFE_AREA_HURT_INTERVAL;
    for (let id = 0; id < Actors.count; id++) {
      if (Actors.alive[id] && Modes.isActive(id) && Math.hypot(Actors.x[id] - this.centerX, Actors.z[id] - this.centerZ) > radius) requestHazard(id, params.zoneDamage * SAFE_AREA_HURT_INTERVAL);
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

function spendTickets(team, amount, reason) {
  Modes.awardTeam(team, -Math.min(amount, Math.max(0, Modes.teamScore[team])), reason);
}

function defendingTeam() { return 1 - Modes.attackingTeam(); }

// A random living participant on `team` (NO_TEAM = any team) other than `except` (Rng.rules), or -1.
function randomAliveMember(team, except) {
  let count = 0;
  for (let id = 0; id < Actors.count; id++) if (isAliveMember(id, team, except)) count++;
  if (!count) return -1;
  let pick = Rng.rules.int(0, count - 1);
  for (let id = 0; id < Actors.count; id++) {
    if (!isAliveMember(id, team, except)) continue;
    if (pick === 0) return id;
    pick--;
  }
  return -1;
}

function isAliveMember(id, team, except) {
  return id !== except && Actors.alive[id] === 1 && Modes.isActive(id) && (team === NO_TEAM || Actors.team[id] === team);
}

// The world's centre and half-diagonal (a radius that covers the whole map) into out.x/z/radius: safe areas and rings.
function worldSafeArea(out) {
  const low = World.boundsMin, high = World.boundsMax;
  const known = Number.isFinite(low.x) && Number.isFinite(high.x);
  out.x = known ? (low.x + high.x) / 2 : 0;
  out.z = known ? (low.z + high.z) / 2 : 0;
  out.radius = known ? Math.hypot(high.x - low.x, high.z - low.z) / 2 : SAFE_AREA_FALLBACK_RADIUS;
  return out;
}

function requestHazard(id, amount) {
  hazardRequest.target = id; hazardRequest.amount = amount;
  hazardRequest.x = Actors.x[id]; hazardRequest.y = Actors.y[id]; hazardRequest.z = Actors.z[id];
  Bus.emit('damage.request', hazardRequest);
}
