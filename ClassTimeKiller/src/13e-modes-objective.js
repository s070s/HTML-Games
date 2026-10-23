// Objective versus modes on the S13 framework (13b): M08 Breach Assault (staged relays, attacker tickets), M10 Relic Run (carry
// time scores), M11 Convoy (a cart on the map path), M27 Ghost Ops (bomb rounds with cloaked attackers).
// The first part holds what the party (13f) and royale (13g) files share: actor roles, goal hints for bots, extra HUD fields,
// held loadouts and the behaviour hooks onSpawn(id) / onDamage(event) / onFire(shot) / onJump(event) the framework does not call
// (onSpawn runs from 13h, after the mutator spawn values, so a role's health builds on them).

const ACTOR_ROLE = { NONE: 0, CARRIER: 1, COLOSSUS: 2, CURSED: 3, INFECTED: 4, BEARER: 5, GHOST: 6 };
const ACTOR_ROLE_NAMES = ['', 'carrier', 'colossus', 'cursed', 'infected', 'bearer', 'ghost'];
// Marker colour above a marked actor; null = no marker (carried prizes draw themselves, ghosts must stay hidden).
const ACTOR_ROLE_MARKERS = [null, null, [1, 0.3, 0.1], [0.65, 0.2, 0.95], null, null, null];
const ROLE_MARKER_HEIGHT = 2.3;
const ROLE_MARKER_SIZE = 0.3;
const FALLBACK_MELEE = 'maul';
// Goal hints for bots (BOT-080) on objective.goals: team modes index them by side (0 attackers, 1 defenders); free-for-all
// modes hold [goal of the actor with the mode's role, goal of everyone else]. Modes.goalFor(objective, id) resolves them.
const OBJECTIVE_GOALS = Object.freeze({
  arm: Object.freeze(['arm', 'defend']), armed: Object.freeze(['guard', 'disarm']), escort: Object.freeze(['escort', 'stop']),
  prize: Object.freeze(['hold', 'take']), beacon: Object.freeze(['reach', '']),
});
// Mode-specific HUD fields laid over Modes.hud (docs/api/rules-modes.md "Add-on modes"); reset when a match is set up.
const MODE_HUD_EXTRAS = {
  role: '', special: -1, ladderTier: 0, ladderTiers: 0, weapon: '', rotateIn: 0, stage: 0, stages: 0,
  payloadProgress: 0, payloadCheckpoint: 0, payloadCheckpoints: 0, payloadState: '', survivors: 0, infected: 0,
  ringPhase: 0, ringPhases: 0, ringState: '', ringTimeLeft: 0, ringDamage: 0, ringNextX: 0, ringNextZ: 0, ringNextRadius: 0, aliveCount: 0,
};
const TICKETS_PER_DEATH = 1;
const CART_SIZE = [1.6, 1.2, 2.4];
const CART_LIFT = 0.6;
const prizeScratch = [];
const spotScratch = { x: 0, y: 0, z: 0 };

Object.assign(Modes.hud, MODE_HUD_EXTRAS);
Object.assign(Modes, {
  actorRole: new Uint8Array(MAX_ACTORS),   // ACTOR_ROLE per actor id (bots and the HUD read it)
  meleeHit: new Uint8Array(MAX_ACTORS),    // 1 when the last damage the actor took was a melee hit (melee kills)
  setRole(id, role) {
    this.actorRole[id] = role;
    if (id === Game.playerId) this.hud.role = ACTOR_ROLE_NAMES[role];
  },
  goalFor(objective, id) {
    const goals = objective.goals;
    if (!goals || !objective.active || !this.rules) return '';
    if (this.rules.teams === TEAM_COUNT) return goals[this.sideOf(Actors.team[id])] || '';
    return goals[this.actorRole[id] !== ACTOR_ROLE.NONE ? 0 : 1];
  },
});

function resetModeExtras() {
  Object.assign(Modes.hud, MODE_HUD_EXTRAS);
  Modes.actorRole.fill(ACTOR_ROLE.NONE);
  Modes.meleeHit.fill(0);
  modeCloakSet.fill(0);
}

// Calls an optional add-on hook of the running behaviour.
function callBehaviour(hook, argument) {
  const behaviour = Modes.behaviour;
  if (Modes.active && behaviour[hook]) behaviour[hook](argument);
}

// The melee weapon of the match's weapon set (from its start loadout), for melee-only roles.
function meleeWeaponKey() {
  const start = currentWeaponSet().start;
  for (let i = 0; i < start.length; i++) {
    const weapon = CAT.weapons.byId(start[i]);
    if (weapon && weapon.class === 'melee') return weapon.id;
  }
  return FALLBACK_MELEE;
}

// Keeps an actor on a fixed loadout: drawing anything else (a pickup, a buy) puts the loadout back.
function holdLoadout(id, keys) {
  const weapon = Weapons.currentWeapon(id);
  if (weapon && keys.indexOf(weapon.id) >= 0) return;
  Weapons.setLoadout(id, keys);
}

// Health and its cap together (roles with their own pool: colossus, infected, cursed).
function setVitality(id, health) {
  Actors.maxHealth[id] = health;
  Actors.health[id] = health;
}

// The spawn point nearest the middle of the world: a standing spot for objectives a mode brings itself.
function centralSpot(out) {
  const area = worldSafeArea(safeAreaScratch), centreX = area.x, centreZ = area.z;
  out.x = centreX; out.y = 0; out.z = centreZ;
  let best = Infinity;
  for (const point of Modes.spawnPoints) {
    const distance = Math.hypot(point.x - centreX, point.z - centreZ);
    if (distance >= best) continue;
    best = distance; out.x = point.x; out.y = point.y; out.z = point.z;
  }
  return out;
}

function wasMeleeKill(victim) { return victim >= 0 && Modes.meleeHit[victim] === 1; }

// ACTOR_FLAG.INVISIBLE belongs to whoever set it: a mode cloak never clears a powerup or ability cloak.
const modeCloakSet = new Uint8Array(MAX_ACTORS);
function setCloak(id, cloaked) {
  if (cloaked) {
    if (!(Actors.flags[id] & ACTOR_FLAG.INVISIBLE)) { Actors.flags[id] |= ACTOR_FLAG.INVISIBLE; modeCloakSet[id] = 1; }
    return;
  }
  if (!modeCloakSet[id]) return;
  Actors.flags[id] &= ~ACTOR_FLAG.INVISIBLE;
  modeCloakSet[id] = 0;
}

// ---- M08 Breach Assault: attackers (side 0) arm relays (USE held plantTime s in the relay zone), the fuse runs, defenders
// disarm them (defuseTime, the progress is lost on interruption) and the relay can be armed again. Both relays of a stage
// destroyed opens the next stage; the last stage destroyed wins. Each attacker death costs a ticket; at 0 tickets with no
// relay armed the defenders win. Defenders have unlimited tickets ----
Modes.register('rush', {
  limits: ['time'],
  relays: [], stage: 0, lastStage: 0, destroyed: 0,
  start() {
    const params = Modes.rules.params;
    Modes.findObjectives('bombsite', this.relays);
    numberStages(this.relays, params.perStage);
    this.lastStage = Math.min(params.stages, highestStage(this.relays));
    this.destroyed = 0;
    this.stage = 0;
    Modes.teamScore[Modes.attackingTeam()] = params.tickets;
    Modes.hud.stages = this.lastStage;
    this.openStage(this.lastStage > 0 ? 1 : 0);
  },
  openStage(stage) {
    this.stage = stage;
    Modes.hud.stage = stage;
    for (let i = 0; i < this.relays.length; i++) {
      const relay = this.relays[i];
      relay.active = relay.stage === stage;
      relay.goals = relay.active ? OBJECTIVE_GOALS.arm : null;
    }
    if (stage > 1) Modes.announce('Stage ' + stage, 'objective', 2);
  },
  step(dt, now) {
    if (this.stage < 1 || this.stage > this.lastStage) return;
    const params = Modes.rules.params;
    let standing = 0;
    for (let i = 0; i < this.relays.length; i++) {
      const relay = this.relays[i];
      if (!relay.active) continue;
      this.stepRelay(relay, dt, now, params);
      if (relay.state !== 'detonated') standing++;
    }
    if (standing > 0) return;
    if (this.stage < this.lastStage) this.openStage(this.stage + 1);
    else this.stage++;   // past the last stage: isOver hands the attackers the win, no stage to announce
  },
  stepRelay(relay, dt, now, params) {
    if (relay.state === 'detonated') return;
    if (relay.state === 'planted') { this.stepArmed(relay, dt, now, params); return; }
    const armer = Modes.findActorNear(relay.x, relay.y, relay.z, relay.radius, Modes.attackingTeam(), NEAR_TEAM, BTN.USE);
    if (!Modes.advanceUse(relay, armer >= 0, dt, params.plantTime, 0)) return;
    Modes.plantCharge(relay, armer, params.fuse);
    relay.goals = OBJECTIVE_GOALS.armed;
  },
  stepArmed(relay, dt, now, params) {
    if (now + TIME_EPSILON >= relay.detonateAt) {
      Modes.detonateCharge(relay, params.blastRadius);
      relay.goals = null;
      this.destroyed++;
      return;
    }
    if (Modes.stepDefuse(relay, defendingTeam(), dt, params) < 0) return;
    relay.state = 'home'; relay.timer = 0; relay.planter = -1; relay.detonateAt = Infinity;   // a disarmed relay can be armed again
    relay.goals = OBJECTIVE_GOALS.arm;
  },
  onKill(victim) {
    if (victim >= 0 && Modes.participant[victim] && Actors.team[victim] === Modes.attackingTeam()) spendTickets(Actors.team[victim], TICKETS_PER_DEATH, 'death');
  },
  anyArmed() {
    for (let i = 0; i < this.relays.length; i++) if (this.relays[i].active && this.relays[i].state === 'planted') return true;
    return false;
  },
  // Attackers out of lives count like 0 tickets: an armed relay still goes off first.
  livesOver() { return this.anyArmed() ? NOT_OVER : Modes.livesWinner(); },
  isOver(now) {
    const attackers = Modes.attackingTeam();
    if (this.lastStage > 0 && this.stage > this.lastStage) return Modes.over(attackers, 'objective');
    if (Modes.teamScore[attackers] <= 0 && !this.anyArmed()) return Modes.over(1 - attackers, 'tickets');
    const limit = Modes.rules.timeLimit;
    if (limit > 0 && now - Modes.startTime + TIME_EPSILON >= limit) return Modes.over(1 - attackers, 'time');
    return NOT_OVER;
  },
  score(team) { return team === Modes.attackingTeam() ? this.destroyed : 0; },
});

// Relays without a map stage are numbered in map order, perStage to a stage.
function numberStages(relays, perStage) {
  for (let i = 0; i < relays.length; i++) if (!relays[i].stage) relays[i].stage = Math.floor(i / Math.max(1, perStage)) + 1;
}

function highestStage(relays) {
  let highest = 0;
  for (let i = 0; i < relays.length; i++) highest = Math.max(highest, relays[i].stage);
  return highest;
}

// ---- M10 Relic Run and M24 Flame Bearer: one carriable prize (kind 'relic'); touching it picks it up, the holder earns
// rules.scoring.hold every 1/holdRate seconds; it drops on death and returns home after returnTime s on the ground.
// prizeId names the prize when the map has none (it then lies at the most central spawn point) ----
function makePrizeBehaviour(prizeId, role, meleeParam, label) {
  return {
    prize: null, holder: -1, meleeLoadout: null,
    start() {
      Modes.findObjectives('relic', prizeScratch);
      this.prize = prizeScratch.length ? prizeScratch[0] : addPrize(prizeId);
      prizeScratch.length = 0;
      this.prize.goals = OBJECTIVE_GOALS.prize;
      this.holder = -1;
      this.meleeLoadout = [meleeWeaponKey()];
    },
    step(dt, now) {
      const prize = this.prize, params = Modes.rules.params;
      if (prize.state === 'carried') { this.stepHeld(prize, dt, params); return; }
      this.setHolder(-1);
      if (Modes.returnDue(prize, now, params.returnTime)) { Modes.returnHome(prize); Modes.announce('The ' + label + ' returned', 'objective', 1); return; }
      // Spawn protection keeps an actor who respawns on the prize from taking it at once (nor blocking anyone else).
      const taker = Modes.findToucher(prize, NEAR_ANY, ACTOR_FLAG.PROTECTED);
      if (taker < 0) return;
      Modes.pickUp(prize, taker);
      prize.holdTime = 0;
      this.setHolder(taker);
      Modes.announce(Actors.name[taker] + ' has the ' + label, 'objective', 2);
    },
    stepHeld(prize, dt, params) {
      const holder = prize.carrier;
      Modes.followCarrier(prize);
      if (params[meleeParam]) holdLoadout(holder, this.meleeLoadout);
      if (intervalDue(prize, 'holdTime', dt, 1 / params.holdRate)) Modes.creditObjective(holder, 'hold');
    },
    setHolder(id) {
      if (id === this.holder) return;
      if (this.holder >= 0) Modes.setRole(this.holder, ACTOR_ROLE.NONE);
      this.holder = id;
      if (id >= 0) Modes.setRole(id, role);
      Modes.hud.special = id;
    },
  };
}

function addPrize(id) {
  const spot = centralSpot(spotScratch);
  return Modes.addObjective({ id, kind: 'relic', x: spot.x, y: spot.y, z: spot.z });
}

Modes.register('oddball', makePrizeBehaviour('relic', ACTOR_ROLE.CARRIER, 'carrierMeleeOnly', 'relic'));

// ---- M11 Convoy: the cart (the map's payloadPath objective, team 0 attacks) rolls along objective.path at `speed` m/s
// with attackers near and no defender near (each extra attacker +pushStack, up to maxSpeed); after rollbackAfter s
// without an attacker it rolls back at rollbackSpeed, never behind the last checkpoint. objective.checkpoints are path
// indices (else params.checkpoints evenly spaced; the last is the end). Each checkpoint before the end adds
// checkpointTime s to the clock (Modes.timeBonus). At the time limit an attacker at the cart means overtime (max 180 s) ----
Modes.register('payload', {
  limits: ['time'],
  cart: null, lengths: null, marks: null, total: 0, distance: 0, reached: 0, lastPushed: 0,
  start() {
    this.distance = 0; this.reached = 0; this.total = 0; this.marks = null; this.lengths = null; this.lastPushed = Sim.time;
    const path = this.findPath();
    if (!path) return;
    this.lengths = pathLengths(path);
    this.total = this.lengths[this.lengths.length - 1];
    this.marks = checkpointDistances(this.cart.checkpoints, this.lengths, Modes.rules.params.checkpoints);
    this.cart.goals = OBJECTIVE_GOALS.escort;
    this.placeCart();
    Modes.hud.payloadCheckpoints = this.marks.length;
    Modes.hud.payloadState = 'idle';
  },
  findPath() {
    Modes.findObjectives('payloadPath', prizeScratch);
    const cart = prizeScratch.length ? prizeScratch[0] : null;
    prizeScratch.length = 0;
    this.cart = cart && cart.path && cart.path.length > 1 ? cart : null;
    return this.cart ? this.cart.path : null;
  },
  step(dt, now) {
    const cart = this.cart;
    if (!cart) return;
    const params = Modes.rules.params, attackers = Modes.attackingTeam();
    Modes.countInside(cart);
    const pushers = cart.inside[attackers], blockers = cart.inside[1 - attackers];
    if (pushers > 0) this.lastPushed = now;
    if (pushers > 0 && blockers === 0) this.roll(Math.min(params.maxSpeed, params.speed * (1 + (pushers - 1) * params.pushStack)) * dt, 'moving');
    else if (pushers > 0) Modes.hud.payloadState = 'contested';
    else if (now - this.lastPushed + TIME_EPSILON >= params.rollbackAfter) this.roll(-params.rollbackSpeed * dt, 'rollback');
    else Modes.hud.payloadState = 'idle';
    this.passCheckpoints(attackers, params);
    Modes.hud.payloadProgress = this.total > 0 ? this.distance / this.total : 0;
  },
  roll(metres, state) {
    const floor = this.reached > 0 ? this.marks[this.reached - 1] : 0;
    this.distance = clamp(this.distance + metres, floor, this.total);
    Modes.hud.payloadState = state;
    this.placeCart();
  },
  placeCart() { pointOnPath(this.cart.path, this.lengths, this.distance, this.cart); },
  passCheckpoints(attackers, params) {
    while (this.reached < this.marks.length && this.distance + TIME_EPSILON >= this.marks[this.reached]) {
      this.reached++;
      Modes.hud.payloadCheckpoint = this.reached;
      Modes.awardTeam(attackers, 1, 'checkpoint');
      this.creditPushers(attackers);
      if (this.reached === this.marks.length) return;
      Modes.timeBonus += params.checkpointTime;
      Modes.announce('Checkpoint reached', 'objective', 2);
    }
  },
  creditPushers(attackers) {
    for (let id = 0; id < Actors.count; id++) {
      if (Modes.actsOnObjectives(id) && Modes.isActive(id) && Actors.team[id] === attackers && Modes.inZone(this.cart, id)) Modes.creditObjective(id, 'capture');
    }
  },
  isOver(now) {
    if (!this.cart) return Modes.standardIsOver(now);
    const attackers = Modes.attackingTeam(), limit = Modes.rules.timeLimit;
    if (this.reached >= this.marks.length) return Modes.over(attackers, 'objective');
    if (limit <= 0) return NOT_OVER;
    const pastEnd = now - Modes.startTime + TIME_EPSILON - (limit + Modes.timeBonus);
    if (pastEnd < 0) return NOT_OVER;
    if (this.cart.inside[attackers] > 0 && pastEnd < OVERTIME_SECONDS) { Modes.enterOvertime(); return NOT_OVER; }
    return Modes.over(1 - attackers, Modes.overtime ? 'overtime' : 'time');
  },
  score(team) { return team === Modes.attackingTeam() ? this.reached : 0; },
});

// Cumulative lengths along a [[x, y, z], ...] path: lengths[i] = metres from the start to point i.
function pathLengths(path) {
  const lengths = new Float64Array(path.length);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    lengths[i] = lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return lengths;
}

// Writes the point `distance` metres along the path into out.x/y/z.
function pointOnPath(path, lengths, distance, out) {
  let segment = 1;
  while (segment < path.length - 1 && lengths[segment] < distance) segment++;
  const a = path[segment - 1], b = path[segment], span = lengths[segment] - lengths[segment - 1];
  const t = span > 0 ? clamp((distance - lengths[segment - 1]) / span, 0, 1) : 0;
  out.x = lerp(a[0], b[0], t); out.y = lerp(a[1], b[1], t); out.z = lerp(a[2], b[2], t);
  return out;
}

// Checkpoint distances in path order; the last one is always the end of the path.
function checkpointDistances(indices, lengths, count) {
  const total = lengths[lengths.length - 1], marks = [];
  if (indices && indices.length) {
    for (const index of indices) marks.push(lengths[clamp(index, 0, lengths.length - 1)]);
  } else {
    for (let k = 1; k <= Math.max(1, count); k++) marks.push(total * k / Math.max(1, count));
  }
  marks.sort((a, b) => a - b);
  if (marks[marks.length - 1] < total) marks.push(total);
  return Float64Array.from(marks);
}

// ---- M27 Ghost Ops: the bomb rounds of M13 (13c) with a twist: attackers carry only attackerLoadout (melee + pistol) and
// are cloaked (ACTOR_FLAG.INVISIBLE) while still (speed <= stillSpeed) and for revealTime s after firing they are not;
// their footsteps still sound (S06) and a carried charge hides with its carrier (13b drawObjective). Bots read arm / defend
// on the sites until the plant, then guard / disarm on the charge ----
const BOMB_BEHAVIOUR = Modes.behaviours.get('bomb');
const ghostRevealUntil = new Float64Array(MAX_ACTORS);
Modes.register('ghostops', Object.assign({}, BOMB_BEHAVIOUR, {
  sites: [], charge: null,
  onRound(phase) {
    const result = BOMB_BEHAVIOUR.onRound.call(this, phase);
    if (phase === 'start') this.assignGhosts();
    return result;
  },
  assignGhosts() {
    const attackers = Modes.attackingTeam();
    ghostRevealUntil.fill(0);
    for (let id = 0; id < Actors.count; id++) {
      if (!Modes.isActive(id)) continue;
      Modes.setRole(id, Actors.team[id] === attackers ? ACTOR_ROLE.GHOST : ACTOR_ROLE.NONE);
      setCloak(id, false);
    }
  },
  onSpawn(id) {
    setCloak(id, false);
    if (Actors.team[id] === Modes.attackingTeam()) Weapons.setLoadout(id, Modes.rules.params.attackerLoadout);
  },
  onFire(shot) {
    if (shot.id < 0 || Actors.team[shot.id] !== Modes.attackingTeam()) return;
    ghostRevealUntil[shot.id] = Sim.time + Modes.rules.params.revealTime;
    setCloak(shot.id, false);
  },
  step(dt, now) {
    BOMB_BEHAVIOUR.step.call(this, dt, now);
    this.updateGoals();
    this.stepGhosts(now);
  },
  updateGoals() {
    const planted = this.charge.state === 'planted';
    this.charge.goals = planted ? OBJECTIVE_GOALS.armed : null;
    for (let i = 0; i < this.sites.length; i++) this.sites[i].goals = planted ? null : OBJECTIVE_GOALS.arm;
  },
  stepGhosts(now) {
    const params = Modes.rules.params, attackers = Modes.attackingTeam();
    for (let id = 0; id < Actors.count; id++) {
      if (!Modes.isActive(id) || !Actors.alive[id] || Actors.team[id] !== attackers) continue;
      holdLoadout(id, params.attackerLoadout);
      const still = Move.horizontalSpeed(id) <= params.stillSpeed && Math.abs(Actors.vy[id]) <= params.stillSpeed;
      setCloak(id, params.cloakWhenStill && still && now + TIME_EPSILON >= ghostRevealUntil[id]);
    }
  },
}));

// Role markers above marked actors and the convoy cart (the framework skips payloadPath objectives).
function drawModeExtras(batch) {
  if (!Modes.active) return;
  for (let id = 0; id < Actors.count; id++) {
    const color = ACTOR_ROLE_MARKERS[Modes.actorRole[id]];
    if (!color || !Actors.alive[id]) continue;
    batch.mesh('sphere', Actors.x[id], Actors.y[id] + ROLE_MARKER_HEIGHT, Actors.z[id], 0, 0, ROLE_MARKER_SIZE, ROLE_MARKER_SIZE, ROLE_MARKER_SIZE, color[0], color[1], color[2], MARKER_GLOW);
  }
  for (let i = 0; i < Modes.objectives.length; i++) {
    const cart = Modes.objectives[i];
    if (cart.kind !== 'payloadPath' || !cart.path) continue;
    const color = teamMarkerColor(cart.contested ? NO_TEAM : 0);
    batch.mesh('box', cart.x, cart.y + CART_LIFT, cart.z, 0, 0, CART_SIZE[0], CART_SIZE[1], CART_SIZE[2], color[0], color[1], color[2], MARKER_GLOW);
  }
}

Bus.on('match.setup', resetModeExtras);
Bus.on('match.stop', resetModeExtras);
Bus.on('actor.create', (id) => { Modes.actorRole[id] = ACTOR_ROLE.NONE; Modes.meleeHit[id] = 0; modeCloakSet[id] = 0; });
Bus.on('damage', (event) => {
  Modes.meleeHit[event.target] = event.kind === 'melee' ? 1 : 0;
  callBehaviour('onDamage', event);
});
Bus.on('weapon.fire', (shot) => callBehaviour('onFire', shot));
Bus.on('move.jump', (event) => callBehaviour('onJump', event));
Render.addSource('modeExtras', drawModeExtras);
