// Bot decisions (BOT-002, BOT-013, BOT-020, BOT-021, BOT-041, BOT-080): utility goals scored at 2 Hz (staggered), each
// 0..1 and weighted by traits; the best wins with 10% hysteresis. Goals: attack, chase, retreat, collect items, play the
// mode objective, camp (time-limited, never in sight of enemy spawns), investigate sounds, follow orders, roam.
// Objective planners are registered per map objective kind, so every mode with that kind is played (flags, points, hills,
// bomb sites, the shrinking safe area). The chosen goal becomes a state, a destination for 14c and an action (hold, use).

const GOAL = { NONE: 0, ROAM: 1, ATTACK: 2, CHASE: 3, RETREAT: 4, COLLECT: 5, OBJECTIVE: 6, CAMP: 7, INVESTIGATE: 8, ORDER: 9 };
const GOAL_NAMES = Object.keys(GOAL).map((name) => name.toLowerCase());
const GOAL_COUNT = GOAL_NAMES.length;
const GOAL_STATES = [BOT_STATE.ROAM, BOT_STATE.ROAM, BOT_STATE.ENGAGE, BOT_STATE.CHASE, BOT_STATE.RETREAT, BOT_STATE.COLLECT,
  BOT_STATE.OBJECTIVE, BOT_STATE.CAMP, BOT_STATE.INVESTIGATE, BOT_STATE.FOLLOW];
const ACTION = { MOVE: 0, HOLD: 1, USE: 2 };
const GOAL_HYSTERESIS = 1.1;            // BOT-020: a new goal must beat the current one by 10%
const GOAL_RETRY_SECONDS = 5;           // a goal whose path failed is not chosen again for this long
const GOAL_HURRY = 0.05;                // s: an urgent event brings the next decision this close
const ROAM_SCORE = 0.12;
const ATTACK_BASE = 0.55, ATTACK_GAIN = 0.4;
const CHASE_BASE = 0.35, CHASE_GAIN = 0.4;
const RETREAT_BASE = 0.5, RETREAT_GAIN = 0.4, RETREAT_THRESHOLD = 0.5;   // BOT-021: retreat below 0.5, attack/chase above
const AGGRESSION_HEALTH = 0.6, AGGRESSION_ARMOR = 40, AGGRESSION_HEIGHT = 6, AGGRESSION_POWERUP = 0.7;
const AGGRESSION_WEAPON_FLOOR = 0.55;   // any armed bot is willing to fight; strong weapons push it higher (BOT-021 table)
const RETREAT_COVER_RANGE = 15, RETREAT_AWAY = 10;
const COLLECT_BASE = 0.2, COLLECT_GAIN = 0.6, COLLECT_MAX = 0.9, COLLECT_DISTANCE = 15;
const ITEM_VALUES = { health: 1.2, armor: 0.7, weapon: 0.8, ammo: 0.5, power: 0.6 };
const ITEM_POWER_FOCUS = 0.4;
const ITEM_REVISIT = 20;                // s before a bot goes back to a spot it already took (unless its timer says it is up)
const ITEM_EARLY_MIN = 1, ITEM_EARLY_MAX = 3;   // BOT-013: timed pickups arrive 1-3 s early
const ITEM_TIMER_FOCUS = 0.5;
const ITEM_TOUCH = 1.0;
const ITEM_LOW_AMMO = 0.25;
const MAX_BOT_ITEMS = 128;
const OBJECTIVE_BASE = 0.6, OBJECTIVE_GAIN = 0.35;
const CAMP_BASE = 0.25, CAMP_GAIN = 0.4, CAMP_WEAPON = 0.7, CAMP_MIN_TRAIT = 0.5, CAMP_COOLDOWN = 60;
const CAMP_SECONDS = 120, CAMP_TRAIT_SECONDS = 180;   // spec T07: camp duration 120 + 180 x camper s
const CAMP_SPAWN_SIGHT = 50;            // BOT-041: camp spots must not see enemy spawns within this range
const INVESTIGATE_BASE = 0.25, INVESTIGATE_GAIN = 0.3, INVESTIGATE_SECONDS = 4;
const ORDER_BASE = 0.6, ORDER_GAIN = 0.35;
const SPREAD_FRACTION = 0.5;            // bots spread inside a zone up to this share of its radius
const HOLD_LOOK_SPEED = 0.6;            // rad/s a holding bot sweeps its view
const SAFE_AREA_MARGIN = 0.7;
const FALLBACK_FAVORITE = 'lancet';

const goalPlan = { score: 0, x: 0, y: 0, z: 0, radius: 1, action: ACTION.MOVE, target: -1 };
const bestPlan = { score: 0, x: 0, y: 0, z: 0, radius: 1, action: ACTION.MOVE, target: -1, goal: GOAL.NONE };
const decideScratch = Vec.make();
const powerupList = [];
const timerList = [];
const objectiveList = [], baseList = [];

const BotDecide = {
  goal: new Uint8Array(MAX_ACTORS), goalScore: new Float32Array(MAX_ACTORS), goalSince: new Float64Array(MAX_ACTORS),
  goalX: new Float32Array(MAX_ACTORS), goalY: new Float32Array(MAX_ACTORS), goalZ: new Float32Array(MAX_ACTORS),
  goalRadius: new Float32Array(MAX_ACTORS), goalAction: new Uint8Array(MAX_ACTORS), goalTarget: new Int16Array(MAX_ACTORS),
  failedUntil: new Float64Array(MAX_ACTORS * GOAL_COUNT),
  scores: new Float32Array(MAX_ACTORS * GOAL_COUNT),       // last scores (F9 view)
  noGoalTime: new Float32Array(MAX_ACTORS), longestNoGoal: new Float32Array(MAX_ACTORS),
  campUntil: new Float64Array(MAX_ACTORS), campCooldown: new Float64Array(MAX_ACTORS),
  roamNode: new Int32Array(MAX_ACTORS).fill(-1),
  items: [], itemNode: new Int32Array(MAX_BOT_ITEMS), itemReadyAt: new Float64Array(MAX_BOT_ITEMS),
  itemVisited: new Float64Array(MAX_ACTORS * MAX_BOT_ITEMS).fill(-1e9),
  campSpots: [], timersAt: -1,
  planners: {},          // objective kind -> fn(id, plan, now) -> bool (BOT-080 mode brains)

  reset(id) {
    this.goal[id] = GOAL.NONE; this.goalScore[id] = 0; this.goalSince[id] = Sim.time; this.noGoalTime[id] = 0;
    this.failedUntil.fill(0, id * GOAL_COUNT, (id + 1) * GOAL_COUNT);
    this.roamNode[id] = -1;
    this.campUntil[id] = 0; this.campCooldown[id] = 0;
  },
  registerPlanner(kind, plan) { this.planners[kind] = plan; },
  hurry(id, now) { Bots.nextDecide[id] = Math.min(Bots.nextDecide[id], now + GOAL_HURRY); },
  // A goal whose path failed rests for 5 s; roaming just picks another spot.
  goalFailed(id, now) {
    if (this.goal[id] === GOAL.ROAM) this.roamNode[id] = -1;
    else this.failedUntil[id * GOAL_COUNT + this.goal[id]] = now + GOAL_RETRY_SECONDS;
    this.goal[id] = GOAL.NONE;
    this.goalScore[id] = 0;
    this.hurry(id, now);
  },

  // ---- Match items and camp spots (once per match) ----
  onMatchStart(match) {
    this.items.length = 0;
    this.campSpots.length = 0;
    this.itemVisited.fill(-1e9);
    this.itemReadyAt.fill(0);
    const map = World.map, mode = match.rules ? match.rules.mode : '';
    if (!map) return;
    for (const entry of map.items || []) if (this.items.length < MAX_BOT_ITEMS && servesMode(entry, mode)) this.addItem(entry);
    for (const hint of map.navHints || []) if (BOT_CAMP_HINTS.includes(hint.kind)) this.campSpots.push(this.makeCampSpot(hint, map, mode));
  },
  addItem(entry) {
    const index = this.items.length;
    this.items.push({ index, x: entry.x, y: entry.y, z: entry.z, key: entry.item, group: entry.group, weapon: CAT.weapons.byId(entry.item) });
    this.itemNode[index] = Nav.nearestNode(entry.x, entry.y, entry.z);
  },
  // BOT-041: a spot is safe for a side when no spawn of the other side (any spawn in free-for-all) is in sight within 50 m.
  makeCampSpot(hint, map, mode) {
    const spot = { x: hint.x, y: hint.y, z: hint.z, safe: [true, true, true] };
    for (const spawn of map.spawns || []) {
      if (!servesMode(spawn, mode) || Math.hypot(spawn.x - hint.x, spawn.z - hint.z) > CAMP_SPAWN_SIGHT) continue;
      if (!World.lineClear(hint.x, hint.y + SPAWN_EYE_HEIGHT, hint.z, spawn.x, spawn.y + SPAWN_EYE_HEIGHT, spawn.z)) continue;
      const side = typeof spawn.team === 'number' ? spawn.team : NO_TEAM;
      spot.safe[2] = false;                  // free-for-all: every spawn is an enemy spawn
      if (side !== 0) spot.safe[0] = false;  // a spawn of the other team, or of anyone
      if (side !== 1) spot.safe[1] = false;
    }
    return spot;
  },
  // Items.timers lists respawning spots (S12); read at most twice a second for every bot.
  refreshTimers(now) {
    if (now - this.timersAt < BOT_DECIDE_INTERVAL) return;
    this.timersAt = now;
    this.itemReadyAt.fill(0);
    const count = Items.timers(timerList);
    for (let t = 0; t < count; t++) {
      const index = this.itemAt(timerList[t].x, timerList[t].y, timerList[t].z);
      if (index >= 0) this.itemReadyAt[index] = now + timerList[t].remaining;
    }
  },
  // The item spot at a position (pickups and timers report positions), or -1.
  itemAt(x, y, z) {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (Math.hypot(item.x - x, item.z - z) < ITEM_TOUCH && Math.abs(item.y - y) < ITEM_TOUCH * 2) return i;
    }
    return -1;
  },
  onPickup(event) {
    if (event.id < 0 || event.id >= MAX_ACTORS) return;
    const index = this.itemAt(event.x, event.y, event.z);
    if (index >= 0) this.itemVisited[event.id * MAX_BOT_ITEMS + index] = Sim.time;
  },

  // ---- Decision (2 Hz) ----
  decide(id, now) {
    Bots.nextDecide[id] = now + BOT_DECIDE_INTERVAL;
    this.refreshTimers(now);
    bestPlan.score = 0; bestPlan.goal = GOAL.NONE;
    const current = this.goal[id];
    let currentScore = 0;
    for (let goal = 1; goal < GOAL_COUNT; goal++) {
      const score = this.evaluate(id, goal, now);
      this.scores[id * GOAL_COUNT + goal] = score;
      if (goal === current) currentScore = score;
      if (score > bestPlan.score) copyPlan(bestPlan, goalPlan, goal, score);
    }
    if (bestPlan.goal === GOAL.NONE) holdHere(id);   // nothing wanted (or everything failed): hold and look around
    if (current !== GOAL.NONE && bestPlan.goal !== current && currentScore > 0 && bestPlan.score < currentScore * GOAL_HYSTERESIS) {
      this.evaluate(id, current, now);   // keep the current goal, with its plan refreshed (moving targets)
      copyPlan(bestPlan, goalPlan, current, currentScore);
    }
    this.apply(id, now);
  },
  evaluate(id, goal, now) {
    goalPlan.score = 0; goalPlan.radius = 1; goalPlan.action = ACTION.MOVE; goalPlan.target = -1;
    if (now < this.failedUntil[id * GOAL_COUNT + goal]) return 0;
    const scorer = GOAL_SCORERS[goal];
    return scorer ? scorer(id, goalPlan, now) : 0;
  },
  apply(id, now) {
    const plan = bestPlan;
    if (plan.goal !== this.goal[id]) { this.goalSince[id] = now; if (plan.goal === GOAL.CAMP) this.campUntil[id] = now + CAMP_SECONDS + CAMP_TRAIT_SECONDS * Bots.trait(id, TRAIT.camper); }
    if (this.goal[id] === GOAL.CAMP && plan.goal !== GOAL.CAMP) this.campCooldown[id] = now + CAMP_COOLDOWN;
    this.goal[id] = plan.goal; this.goalScore[id] = plan.score;
    this.goalX[id] = plan.x; this.goalY[id] = plan.y; this.goalZ[id] = plan.z;
    this.goalRadius[id] = plan.radius; this.goalAction[id] = plan.action; this.goalTarget[id] = plan.target;
    Bots.setState(id, GOAL_STATES[plan.goal]);
    if (plan.goal === GOAL.NONE) { BotMove.stop(id); return; }
    BotMove.goTo(id, plan.x, plan.y, plan.z, plan.radius);
  },

  // ---- Execution per tick: hold and use actions, arrivals, the no-goal clock (soak check) ----
  act(id, dt, now) {
    const goal = this.goal[id];
    if (goal === GOAL.NONE) { this.noGoalTime[id] += dt; this.longestNoGoal[id] = Math.max(this.longestNoGoal[id], this.noGoalTime[id]); return; }
    this.noGoalTime[id] = 0;
    if (BotMove.failed(id)) { this.goalFailed(id, now); return; }
    const near = Math.hypot(this.goalX[id] - Actors.x[id], this.goalZ[id] - Actors.z[id]) <= this.goalRadius[id] + 0.3;
    if (this.goalAction[id] === ACTION.USE && near) { Bots.wish(id, 0, 0, 0); Bots.press(id, BTN.USE); return; }
    if (!BotMove.arrived(id) && !near) return;
    this.arrive(id, goal, dt, now);
  },
  arrive(id, goal, dt, now) {
    if (goal === GOAL.COLLECT) this.markVisited(id, this.goalTarget[id], now);
    if (goal === GOAL.CHASE) this.searched(id);
    if (goal === GOAL.ROAM) this.roamNode[id] = -1;
    if (goal === GOAL.COLLECT || goal === GOAL.CHASE || goal === GOAL.ROAM || goal === GOAL.INVESTIGATE) { this.hurry(id, now); return; }
    if (BotCombat.target[id] < 0) Bots.lookYaw[id] = wrapAngle(Actors.aimYaw[id] + HOLD_LOOK_SPEED * dt * 10);   // hold: sweep the view
  },
  markVisited(id, item, now) {
    if (item >= 0 && item < this.items.length) this.itemVisited[id * MAX_BOT_ITEMS + item] = now;
    BotTeam.bark(id, 'itemGrab', now);
  },
  // Reached the last known position and nothing there: the memory entry is used up (BOT-002 Search ends).
  searched(id) {
    const target = this.goalTarget[id];
    if (target >= 0 && !BotSense.sees(id, target)) BotSense.knownAt[BotSense.pair(id, target)] = -1e9;
  },
  carriesObjective(actor) {
    const list = Modes.objectives;
    for (let i = 0; i < list.length; i++) if (list[i].carrier === actor) return true;
    return false;
  },
  contested(id) {
    const index = this.goalTarget[id], list = Modes.objectives;
    return index >= 0 && index < list.length && list[index].contested;
  },
  favoriteWeapon(id) {
    const row = Bots.profile[id];
    if (!row || !row.favorite) return '';
    if (row.favorite !== BOT_FAVORITE_PLAYER) return row.favorite;
    return BotCombat.mostUsedPlayerWeapon() || FALLBACK_FAVORITE;
  },

  // ---- BOT-021 aggression: 0 when hurt or far below the enemy, 0.7 with a powerup, else the weapon value x trait x difficulty ----
  aggression(id, target) {
    const lowHealth = Actors.health[id] < Actors.maxHealth[id] * AGGRESSION_HEALTH && Actors.armor[id] < AGGRESSION_ARMOR;
    if (lowHealth || (target >= 0 && Actors.y[target] - Actors.y[id] >= AGGRESSION_HEIGHT)) return 0;
    if (Items.activePowerups(id, powerupList) > 0) return AGGRESSION_POWERUP;
    const weapon = Weapons.currentWeapon(id), value = weapon ? Math.max(AGGRESSION_WEAPON_FLOOR, weapon.botPref.value) : 0;
    return clamp(value * (0.5 + Bots.trait(id, TRAIT.aggression)) * (0.5 + Bots.currentSkill().aggression), 0, 1);
  },
};

function holdHere(id) {
  setPlan(goalPlan, Actors.x[id], Actors.y[id], Actors.z[id], 1, ACTION.HOLD, -1);
  copyPlan(bestPlan, goalPlan, GOAL.ROAM, ROAM_SCORE);
}

function copyPlan(out, plan, goal, score) {
  out.score = score; out.goal = goal; out.x = plan.x; out.y = plan.y; out.z = plan.z;
  out.radius = plan.radius; out.action = plan.action; out.target = plan.target;
}

function setPlan(plan, x, y, z, radius, action, target) {
  plan.x = x; plan.y = y; plan.z = z; plan.radius = radius; plan.action = action; plan.target = target;
}

// Map entries without a modes list serve every mode (same rule as the map catalogue).
function servesMode(entry, mode) { return !entry.modes || !entry.modes.length || entry.modes.includes(mode); }

// ---- Goal scorers: each returns 0..1 and fills the plan (destination, radius, action, target) ----
const GOAL_SCORERS = [];
GOAL_SCORERS[GOAL.ROAM] = (id, plan) => {
  let node = BotDecide.roamNode[id];
  if (node < 0 || node >= Nav.nodeCount) node = Nav.randomReachableNode(Nav.nearestNode(Actors.x[id], Actors.y[id], Actors.z[id]), Rng.bots);
  if (node < 0) { setPlan(plan, Actors.x[id], Actors.y[id], Actors.z[id], 1, ACTION.HOLD, -1); return ROAM_SCORE; }
  BotDecide.roamNode[id] = node;
  setPlan(plan, Nav.nodeX[node], Nav.nodeY[node], Nav.nodeZ[node], 1, ACTION.MOVE, -1);
  return ROAM_SCORE;
};
GOAL_SCORERS[GOAL.ATTACK] = (id, plan) => {
  const target = BotCombat.target[id];
  if (target < 0 || !BotSense.sees(id, target)) return 0;
  const aggression = BotDecide.aggression(id, target);
  if (aggression < RETREAT_THRESHOLD) return 0;
  const weapon = Weapons.currentWeapon(id), reach = weapon ? weapon.botPref.range[1] * 0.8 : DEFAULT_ENGAGE_DISTANCE;
  setPlan(plan, Actors.x[target], Actors.y[target], Actors.z[target], Math.max(1.5, reach), ACTION.MOVE, target);
  return ATTACK_BASE + ATTACK_GAIN * aggression;
};
GOAL_SCORERS[GOAL.CHASE] = (id, plan, now) => {
  const target = BotCombat.target[id];
  if (target < 0 || BotSense.sees(id, target) || !BotSense.knows(id, target, now)) return 0;
  const aggression = BotDecide.aggression(id, target);
  if (aggression < RETREAT_THRESHOLD) return 0;
  const pair = BotSense.pair(id, target), freshness = 1 - (now - BotSense.knownAt[pair]) / SENSE_MEMORY;
  setPlan(plan, BotSense.knownX[pair], BotSense.knownY[pair], BotSense.knownZ[pair], 1.5, ACTION.MOVE, target);
  return CHASE_BASE + CHASE_GAIN * aggression * freshness;
};
GOAL_SCORERS[GOAL.RETREAT] = (id, plan, now) => {
  const target = BotCombat.target[id];
  const threatened = target >= 0 && (BotSense.sees(id, target) || now - BotSense.attackedAt[id] < TARGET_REVENGE_SECONDS);
  if (!threatened) return 0;
  const aggression = BotDecide.aggression(id, target);
  if (aggression >= RETREAT_THRESHOLD) return 0;
  retreatSpot(id, target, plan);
  return Math.min(0.95, RETREAT_BASE + RETREAT_GAIN * (RETREAT_THRESHOLD - aggression) * 2 * (0.5 + Bots.trait(id, TRAIT.selfPreservation)));
};
GOAL_SCORERS[GOAL.COLLECT] = (id, plan, now) => {
  const item = bestItem(id, now);
  if (item < 0) return 0;
  const entry = BotDecide.items[item];
  setPlan(plan, entry.x, entry.y, entry.z, ITEM_TOUCH * 0.6, ACTION.MOVE, item);
  return Math.min(COLLECT_MAX, COLLECT_BASE + COLLECT_GAIN * decideScratch.x * (0.5 + Bots.trait(id, TRAIT.itemFocus)));
};
GOAL_SCORERS[GOAL.OBJECTIVE] = (id, plan, now) => {
  if (!Modes.active || Modes.phase !== PHASE.LIVE) return 0;
  const planner = BotDecide.planners[Modes.hud.zoneRadius > 0 ? 'safeArea' : Modes.rules.objective];
  if (!planner) return 0;
  plan.score = 0;
  if (!planner(id, plan, now)) return 0;
  return OBJECTIVE_BASE + OBJECTIVE_GAIN * plan.score;
};
GOAL_SCORERS[GOAL.CAMP] = (id, plan, now) => {
  const camper = Bots.trait(id, TRAIT.camper), weapon = Weapons.currentWeapon(id);
  if (camper <= CAMP_MIN_TRAIT || !weapon || weapon.botPref.value < CAMP_WEAPON || now < BotDecide.campCooldown[id]) return 0;
  if (BotDecide.goal[id] === GOAL.CAMP && now > BotDecide.campUntil[id]) { BotDecide.campCooldown[id] = now + CAMP_COOLDOWN; return 0; }
  const spot = campSpot(id);
  if (!spot) return 0;
  setPlan(plan, spot.x, spot.y, spot.z, 1, ACTION.HOLD, -1);
  return CAMP_BASE + CAMP_GAIN * (camper - CAMP_MIN_TRAIT) * 2;
};
GOAL_SCORERS[GOAL.INVESTIGATE] = (id, plan, now) => {
  if (BotCombat.target[id] >= 0 || now - BotSense.heardAt[id] > INVESTIGATE_SECONDS) return 0;
  setPlan(plan, BotSense.heardX[id], BotSense.heardY[id], BotSense.heardZ[id], 2, ACTION.MOVE, -1);
  return INVESTIGATE_BASE + INVESTIGATE_GAIN * Bots.trait(id, TRAIT.alertness);
};
GOAL_SCORERS[GOAL.ORDER] = (id, plan, now) => {
  if (!BotTeam.orderPlan(id, plan, now)) return 0;
  return ORDER_BASE + ORDER_GAIN * Bots.trait(id, TRAIT.teamwork);
};

// Health item when hurt and one is reachable, else cover from the threat, else a node away from it.
function retreatSpot(id, threat, plan) {
  const hurt = Actors.health[id] < Actors.maxHealth[id] * AGGRESSION_HEALTH;
  const health = hurt ? bestItem(id, Sim.time, 'health') : -1;
  if (health >= 0) { const item = BotDecide.items[health]; setPlan(plan, item.x, item.y, item.z, ITEM_TOUCH * 0.6, ACTION.MOVE, health); return; }
  const tx = threat >= 0 ? Actors.x[threat] : Actors.x[id], tz = threat >= 0 ? Actors.z[threat] : Actors.z[id];
  const cover = Nav.nearestCover(Actors.x[id], Actors.y[id], Actors.z[id], tx, threat >= 0 ? Actors.eyeY(threat) : Actors.y[id], tz, RETREAT_COVER_RANGE);
  if (cover >= 0) { const node = Nav.coverNode[cover]; setPlan(plan, Nav.nodeX[node], Nav.nodeY[node], Nav.nodeZ[node], 0.8, ACTION.HOLD, threat); return; }
  const dx = Actors.x[id] - tx, dz = Actors.z[id] - tz, length = Math.hypot(dx, dz) || 1;
  setPlan(plan, Actors.x[id] + dx / length * RETREAT_AWAY, Actors.y[id], Actors.z[id] + dz / length * RETREAT_AWAY, 2, ACTION.MOVE, threat);
}

// Best item spot: value of what it gives this bot / travel, only reachable spots that are (or will be by arrival) up.
// The value lands in decideScratch.x. group: only that group (retreat to health).
function bestItem(id, now, group) {
  const items = BotDecide.items, botNode = Nav.nearestNode(Actors.x[id], Actors.y[id], Actors.z[id]);
  let best = -1, bestScore = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if ((group && item.group !== group) || BotDecide.itemNode[i] < 0 || !Nav.reachable(botNode, BotDecide.itemNode[i])) continue;
    const value = itemValue(id, item);
    if (value <= 0) continue;
    const distance = Math.hypot(item.x - Actors.x[id], item.y - Actors.y[id], item.z - Actors.z[id]);
    if (!itemAvailable(id, i, distance, now)) continue;
    const score = value / (1 + distance / COLLECT_DISTANCE);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  decideScratch.x = bestScore;
  return best;
}

function itemValue(id, item) {
  const base = ITEM_VALUES[item.group] || 0;
  if (item.group === 'health') return Actors.health[id] < Actors.maxHealth[id] ? base * (1 - Actors.health[id] / Actors.maxHealth[id]) * 2 : 0;
  if (item.group === 'armor') { const cap = Actors.maxArmor[id] || 100; return Actors.armor[id] < cap ? base * (1 - Actors.armor[id] / cap) : 0; }
  if (item.group === 'power') return base + ITEM_POWER_FOCUS * Bots.trait(id, TRAIT.itemFocus);
  if (item.weapon) return weaponItemValue(id, item.weapon, base);
  if (item.group === 'ammo') { const ammo = Weapons.ammo(id); return ammo && !ammo.infinite && ammo.reserve < Weapons.maxReserve(id, Weapons.currentWeapon(id)) * ITEM_LOW_AMMO ? base : 0; }
  return 0;
}

function weaponItemValue(id, weapon, base) {
  if (Weapons.has(id, weapon.id)) return 0;
  return base * weapon.botPref.value + (BotDecide.favoriteWeapon(id) === weapon.id ? FAVORITE_BONUS : 0);
}

// Up now, or (BOT-013, item-timing bots) up by the time the bot gets there, arriving 1-3 s early. Spots the bot took
// itself recently count as gone unless the items section says they are back.
function itemAvailable(id, index, distance, now) {
  const readyAt = BotDecide.itemReadyAt[index];
  if (readyAt > now) {
    const timing = Bots.tier(id).itemTiming && Bots.trait(id, TRAIT.itemFocus) > ITEM_TIMER_FOCUS;
    const travel = distance / Math.max(1, BotMove.options[id].moveSpeed);
    return timing && readyAt - now <= travel + Rng.bots.range(ITEM_EARLY_MIN, ITEM_EARLY_MAX);
  }
  return now - BotDecide.itemVisited[id * MAX_BOT_ITEMS + index] > ITEM_REVISIT || readyAt > 0;
}

function campSpot(id) {
  const side = Actors.team[id] < 0 ? 2 : Actors.team[id];
  let best = null, bestDistance = Infinity;
  for (const spot of BotDecide.campSpots) {
    if (!spot.safe[side]) continue;
    const distance = Math.hypot(spot.x - Actors.x[id], spot.z - Actors.z[id]);
    if (distance < bestDistance) { bestDistance = distance; best = spot; }
  }
  return best;
}

// ---- Objective planners (BOT-080): plan.score 0..1 is the objective's urgency for this bot ----
// A bot's place in a zone: spread around the centre by id so a team does not stack on one spot.
function zoneSpot(id, objective, plan, action) {
  const angle = id * 2.399963, offset = objective.radius * SPREAD_FRACTION * ((id % 3) + 1) / 3;   // golden angle spread
  setPlan(plan, objective.x + Math.sin(angle) * offset, objective.y, objective.z + Math.cos(angle) * offset, objective.radius * SPREAD_FRACTION, action, objective.index);
}

function planZones(id, plan, kind, now) {
  const team = Actors.team[id], defender = BotTeam.role[id] === ROLE.DEFEND;
  let best = null, bestScore = 0;
  for (const objective of Modes.objectives) {
    if (objective.kind !== kind || !objective.active) continue;
    const threatened = objective.contested || (objective.capturingTeam >= 0 && objective.capturingTeam !== team);
    const value = objective.owner !== team || team < 0 ? 1 : threatened ? 0.9 : defender ? 0.6 : 0.25;
    const score = value / (1 + Math.hypot(objective.x - Actors.x[id], objective.z - Actors.z[id]) / 40);
    if (score > bestScore) { bestScore = score; best = objective; }
  }
  if (!best) return false;
  zoneSpot(id, best, plan, ACTION.HOLD);
  plan.score = clamp(bestScore * 1.5, 0, 1);
  if (BotTeam.role[id] !== ROLE.FREELANCE && now - Bots.stateSince[id] < 0.6) BotTeam.bark(id, 'takingPoint', now);
  return true;
}

function teamFlag(list, team) {
  for (let i = 0; i < list.length; i++) if (list[i].team === team) return list[i];
  return null;
}

function planFlags(id, plan) {
  const team = Actors.team[id];
  if (team < 0) return false;
  Modes.findObjectives('flag', objectiveList);
  Modes.findObjectives('flagBase', baseList);
  const neutral = Modes.rules.params.neutral, own = neutral ? null : teamFlag(objectiveList, team);
  const enemy = neutral ? teamFlag(objectiveList, NO_TEAM) : teamFlag(objectiveList, 1 - team);
  if (!enemy) return false;
  if (enemy.carrier === id) return planCapture(id, plan, own, neutral ? teamFlag(baseList, 1 - team) : own);
  const role = BotTeam.role[id];
  if (own && own.state === 'carried') return planTarget(plan, own, role === ROLE.ATTACK ? 0.75 : 0.95, 1.2, ACTION.MOVE);
  if (own && own.state === 'dropped') return planTarget(plan, own, 0.9, 0.8, ACTION.MOVE);
  if (enemy.state === 'carried' && !Actors.isEnemy(id, enemy.carrier)) return planTarget(plan, enemy, role === ROLE.ESCORT ? 0.85 : role === ROLE.DEFEND ? 0.3 : 0.6, 4, ACTION.MOVE);
  if (role === ROLE.DEFEND && own) return planHome(id, plan, own, 0.7);
  return planTarget(plan, enemy, 0.8, 0.8, ACTION.MOVE);
}

function planCapture(id, plan, own, destination) {
  if (!destination) return false;
  setPlan(plan, destination.homeX, destination.homeY, destination.homeZ, 0.8, ACTION.MOVE, destination.index);
  plan.score = 1;
  return true;
}

function planTarget(plan, objective, score, radius, action) {
  setPlan(plan, objective.x, objective.y, objective.z, radius, action, objective.index);
  plan.score = score;
  return true;
}

function planHome(id, plan, objective, score) {
  const angle = id * 2.399963;
  setPlan(plan, objective.homeX + Math.sin(angle) * 4, objective.homeY, objective.homeZ + Math.cos(angle) * 4, 2, ACTION.HOLD, objective.index);
  plan.score = score;
  return true;
}

function planBomb(id, plan) {
  const team = Actors.team[id];
  let charge = null;
  for (const objective of Modes.objectives) if (objective.kind === 'bomb') charge = objective;
  if (!charge || team < 0) return false;
  Modes.findObjectives('bombsite', objectiveList);
  const attacking = team === Modes.attackingTeam(), params = Modes.rules.params;
  if (attacking) return planAttackCharge(id, plan, charge);
  if (charge.state === 'planted') return planTarget(plan, charge, 1, params.defuseRange * 0.6, ACTION.USE);
  const site = objectiveList[id % Math.max(1, objectiveList.length)];
  if (!site) return false;
  zoneSpot(id, site, plan, ACTION.HOLD);
  plan.score = 0.7;
  return true;
}

function planAttackCharge(id, plan, charge) {
  if (charge.state === 'planted') return planTarget(plan, charge, 0.7, 5, ACTION.HOLD);
  if (charge.state === 'dropped' || charge.state === 'home') return planTarget(plan, charge, 0.9, 0.8, ACTION.MOVE);
  const site = nearestObjective(objectiveList, charge.x, charge.z);
  if (!site) return false;
  if (charge.carrier !== id) return planTarget(plan, BotTeam.role[id] === ROLE.ESCORT ? charge : site, 0.7, 4, ACTION.MOVE);
  setPlan(plan, site.x, site.y, site.z, site.radius * 0.4, ACTION.USE, site.index);
  plan.score = 1;
  return true;
}

function nearestObjective(list, x, z) {
  let best = null, bestDistance = Infinity;
  for (let i = 0; i < list.length; i++) {
    const distance = Math.hypot(list[i].x - x, list[i].z - z);
    if (distance < bestDistance) { bestDistance = distance; best = list[i]; }
  }
  return best;
}

// Elimination safe area (M14): get inside before the ring hurts.
function planSafeArea(id, plan) {
  const hud = Modes.hud, outside = Math.hypot(Actors.x[id] - hud.zoneX, Actors.z[id] - hud.zoneZ) > hud.zoneRadius * SAFE_AREA_MARGIN;
  if (!outside) return false;
  setPlan(plan, hud.zoneX, Actors.y[id], hud.zoneZ, hud.zoneRadius * 0.5, ACTION.MOVE, -1);
  plan.score = 1;
  return true;
}

BotDecide.registerPlanner('point', (id, plan, now) => planZones(id, plan, 'point', now));
BotDecide.registerPlanner('hill', (id, plan, now) => planZones(id, plan, 'hill', now));
BotDecide.registerPlanner('flag', (id, plan) => planFlags(id, plan));
BotDecide.registerPlanner('bombsite', (id, plan) => planBomb(id, plan));
BotDecide.registerPlanner('safeArea', (id, plan) => planSafeArea(id, plan));

Bus.on('match.start', (match) => BotDecide.onMatchStart(match));
Bus.on('pickup', (event) => BotDecide.onPickup(event));
