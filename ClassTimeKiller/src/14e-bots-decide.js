// Bot decisions (BOT-002, BOT-013, BOT-020, BOT-021, BOT-041, BOT-080): utility goals scored at 2 Hz (staggered), each
// 0..1 and weighted by traits; the best wins with 10% hysteresis. Goals: attack, chase, retreat, collect items, play the
// mode objective, camp (time-limited, never in sight of enemy spawns), investigate sounds, follow orders, roam.
// Objective planners are registered per map objective kind, so every mode with that kind is played (flags, points, hills,
// bomb sites, the shrinking safe area and ring); the add-on modes are played from their goal hints (Modes.goalFor: relays,
// the convoy, relics, the flame, the curse beacon), royale loot is collected and royale squads keep together and use
// their respawn beacon. The chosen goal becomes a state, a destination for 14c and an action (hold, use).

// SQUAD: a follower keeps with its squad leader (BOT-052; scored by 14f).
const GOAL = { NONE: 0, ROAM: 1, ATTACK: 2, CHASE: 3, RETREAT: 4, COLLECT: 5, OBJECTIVE: 6, CAMP: 7, INVESTIGATE: 8, ORDER: 9, REVIVE: 10, SQUAD: 11 };
const GOAL_NAMES = Object.keys(GOAL).map((name) => name.toLowerCase());
const GOAL_COUNT = GOAL_NAMES.length;
const GOAL_STATES = [BOT_STATE.ROAM, BOT_STATE.ROAM, BOT_STATE.ENGAGE, BOT_STATE.CHASE, BOT_STATE.RETREAT, BOT_STATE.COLLECT,
  BOT_STATE.OBJECTIVE, BOT_STATE.CAMP, BOT_STATE.INVESTIGATE, BOT_STATE.FOLLOW, BOT_STATE.REVIVE, BOT_STATE.FOLLOW];
const ACTION = { MOVE: 0, HOLD: 1, USE: 2 };
const GOAL_HYSTERESIS = 1.1;            // BOT-020: a new goal must beat the current one by 10%
const GOAL_RETRY_SECONDS = 5;           // a goal whose path failed is not chosen again for this long
const GOAL_HURRY = 0.05;                // s: an urgent event brings the next decision this close
const ROAM_SCORE = 0.12;
const ATTACK_BASE = 0.55, ATTACK_GAIN = 0.4;
const ATTACK_RANGE_SHARE = 0.8, ATTACK_MIN_RADIUS = 1.5;   // an attack walks to 80% of the weapon range (a melee weapon: of its reach)
const CHASE_BASE = 0.35, CHASE_GAIN = 0.4;
const SEARCH_AFTER = 2;                 // s: a chase on older memory than this is the Search state (BOT-002)
const SEARCH_SPOTS = 2;                 // nearby spots a search looks at past the last known position...
const SEARCH_HOPS = 4;                  // ...each a random walk of this many nav links (nodes are 2 m apart) from the last one
const FLANK_MIN_DISTANCE = 12;          // m: a flanking tier goes round by a flank hint only for a target at least this far...
const FLANK_DETOUR = 1.6;               // ...when the way over the hint is at most this many times the straight way
const FLANK_REACHED = 2;                // m: at the hint, the chase goes on straight to the target
const FLANK_REST = 20;                  // s between two flanks of one bot
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
const REVIVE_BASE = 0.7, REVIVE_GAIN = 0.25;   // BOT-071: a downed teammate outranks objectives when it is safe
const REVIVE_SEARCH = 40;               // m: downed teammates farther away are left to others
const REVIVE_SAFE_DISTANCE = 10;        // m: no enemy the bot sees this close to the downed ally (smoke hides them)
const REVIVE_STAND = 1;                 // m: the bot kneels this close (Damage revives within 1.5 m)
const BEACON_URGENCY = 0.95;            // M20: a squad with a member out and a beacon use left goes to hold Use at its beacon
const SQUAD_KEEP = 12;                  // m: a royale squadmate farther than this from its squad leader goes back to it...
const SQUAD_FOLLOW_URGENCY = 0.8;       // ...with this urgency at twice that distance or more (less nearer)...
const SQUAD_FIGHT_KEEP = 24;            // ...but a bot with a target stays in its fight up to this far (objectives outrank chases)
const SPREAD_FRACTION = 0.5;            // bots spread inside a zone up to this share of its radius
const GOLDEN_ANGLE = 2.399963;          // rad: bots sent to one spot stand around it at id x this angle (no two ids line up)
const HOLD_LOOK_SPEED = 0.6;            // rad/s a holding bot sweeps its view
const SAFE_AREA_MARGIN = 0.7;
const GOAL_DISTANCE_SCALE = 60;         // m: an objective's urgency halves at this distance (goal hints)
const GOAL_TOUCH_RADIUS = 0.8;          // m: touch a carriable or stand on a spot
const LOOT_RARITY_VALUE = 0.25;         // royale loot: each rarity step adds this share to a weapon's value
const HOLD_ARRIVED = 1;                 // m beyond the goal radius that still counts as holding the spot
const MUTATOR_RISK_MIN = 0.7, MUTATOR_RISK_MAX = 1.3;   // MUT-003: damage dealt / taken mutators scale aggression
const CARRY_URGENCY = 1.15;             // a flag carry outranks every fight: the carrier shoots on the run, never stops to duel
const PUSH_URGENCY = 1.05;              // raiders on a push shoot on the run too (a fight only wins with high aggression)
const FLAG_CHASE_RANGE = 30;            // m: raiders chase their own stolen flag only this close; farther, defenders do it
const LOOT_HEALTH_ITEM = { group: 'health' }, LOOT_AMMO_ITEM = { group: 'ammo' };   // royale heals and ammo valued like pickups
const FALLBACK_FAVORITE = 'lancet';

const goalPlan = { score: 0, x: 0, y: 0, z: 0, radius: 1, action: ACTION.MOVE, target: -1 };
const bestPlan = { score: 0, x: 0, y: 0, z: 0, radius: 1, action: ACTION.MOVE, target: -1, goal: GOAL.NONE };
const decideScratch = Vec.make();
const threatPoint = Vec.make();
const powerupList = [];
const timerList = [];
const objectiveList = [], baseList = [];
const safeCircle = { x: 0, z: 0, radius: 0 };

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
  flankSpots: [], flankSpot: new Int16Array(MAX_ACTORS).fill(-1), flankedAt: new Float64Array(MAX_ACTORS).fill(-1e9),
  searchLeft: new Uint8Array(MAX_ACTORS),                  // BOT-002: nearby spots a chase still looks at past the last known one
  chokeSpots: [],        // map choke hints an attacking bot smokes (14d chokeToSmoke)
  lootNode: new Int32Array(LOOT_MAX).fill(-1),             // nav node of each royale loot spot (Modes.loot)
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
    this.flankSpots.length = 0;
    this.chokeSpots.length = 0;
    this.itemVisited.fill(-1e9);
    this.itemReadyAt.fill(0);
    this.timersAt = -1;   // Sim.time starts again at 0: read the item timers at once
    const map = World.map, mode = match.rules ? match.rules.mode : '';
    if (!map) return;
    for (const entry of map.items || []) if (this.items.length < MAX_BOT_ITEMS && mapServesMode(entry, mode)) this.addItem(entry);
    for (const hint of map.navHints || []) if (BOT_CAMP_HINTS.includes(hint.kind)) this.campSpots.push(this.makeCampSpot(hint, map, mode));
    for (const hint of map.navHints || []) if (hint.kind === BOT_FLANK_HINT) this.flankSpots.push({ x: hint.x, y: hint.y, z: hint.z });
    for (const hint of map.navHints || []) if (hint.kind === BOT_CHOKE_HINT) this.chokeSpots.push({ x: hint.x, y: hint.y, z: hint.z });
    const loot = Modes.loot;
    for (let spot = 0; spot < loot.count; spot++) this.lootNode[spot] = Nav.nearestNode(loot.x[spot], loot.y[spot], loot.z[spot]);
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
      if (!mapServesMode(spawn, mode) || length2(spawn.x - hint.x, spawn.z - hint.z) > CAMP_SPAWN_SIGHT) continue;
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
      if (length2(item.x - x, item.z - z) < ITEM_TOUCH && Math.abs(item.y - y) < ITEM_TOUCH * 2) return i;
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
    BotSense.noticeMarked(id, now);
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
    if (plan.goal === GOAL.CHASE && this.goal[id] !== GOAL.CHASE) this.searchLeft[id] = SEARCH_SPOTS;
    if (plan.goal !== this.goal[id]) { this.goalSince[id] = now; if (plan.goal === GOAL.CAMP) this.campUntil[id] = now + CAMP_SECONDS + CAMP_TRAIT_SECONDS * Bots.trait(id, TRAIT.camper); }
    if (this.goal[id] === GOAL.CAMP && plan.goal !== GOAL.CAMP) this.campCooldown[id] = now + CAMP_COOLDOWN;
    this.goal[id] = plan.goal; this.goalScore[id] = plan.score;
    this.goalX[id] = plan.x; this.goalY[id] = plan.y; this.goalZ[id] = plan.z;
    this.goalRadius[id] = plan.radius; this.goalAction[id] = plan.action; this.goalTarget[id] = plan.target;
    Bots.setState(id, this.goalState(id, plan, now));
    if (plan.goal === GOAL.NONE) { BotMove.stop(id); return; }
    BotMove.goTo(id, plan.x, plan.y, plan.z, plan.radius);
  },

  // BOT-002: a chase whose memory of the target is older than SEARCH_AFTER seconds is a Search (the target may have moved on).
  goalState(id, plan, now) {
    if (Actors.flags[id] & ACTOR_FLAG.DOWNED) return BOT_STATE.DOWNED;
    if (plan.goal !== GOAL.CHASE || plan.target < 0) return GOAL_STATES[plan.goal];
    return now - BotSense.knownAt[BotSense.pair(id, plan.target)] > SEARCH_AFTER ? BOT_STATE.SEARCH : BOT_STATE.CHASE;
  },

  // ---- Execution per tick: hold and use actions, arrivals, the no-goal clock (soak check) ----
  act(id, dt, now) {
    const goal = this.goal[id];
    if (goal === GOAL.NONE) { this.noGoalTime[id] += dt; this.longestNoGoal[id] = Math.max(this.longestNoGoal[id], this.noGoalTime[id]); return; }
    this.noGoalTime[id] = 0;
    if (BotMove.failed(id) && !BotCombat.weaponJumpPending(id, now)) { this.goalFailed(id, now); return; }   // a ledge goal may be jumped to
    const near = this.nearGoal(id, goal);
    if (this.goalAction[id] === ACTION.USE && near) { Bots.wish(id, 0, 0, 0); Bots.press(id, BTN.USE); return; }
    if (!BotMove.arrived(id) && !near) return;
    this.arrive(id, goal, dt, now);
  },
  // BOT-071: a reviver keeps holding Use while Damage's own revive search still reaches the ally, wherever it planned to kneel.
  nearGoal(id, goal) {
    if (goal === GOAL.REVIVE) return Damage.nearestDownedAlly(id, REVIVE_REACH) >= 0;
    return length2(this.goalX[id] - Actors.x[id], this.goalZ[id] - Actors.z[id]) <= this.goalRadius[id] + 0.3;
  },
  arrive(id, goal, dt, now) {
    if (goal === GOAL.CHASE && this.flankSpot[id] >= 0) { this.flankedAt[id] = now; this.flankSpot[id] = -1; this.hurry(id, now); return; }
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
  // Reached the last known position and nothing there (BOT-002 Search): the bot's guess moves on to SEARCH_SPOTS nearby
  // spots in turn, then the memory entry is used up and the bot roams. The goal and path move to each spot at once: the
  // old arrival would otherwise call this again on the next ticks and skip every spot unvisited.
  searched(id) {
    const target = this.goalTarget[id];
    if (target < 0 || BotSense.sees(id, target)) return;
    const pair = BotSense.pair(id, target);
    const node = this.searchLeft[id] > 0 ? searchWalk(Nav.nearestNode(BotSense.knownX[pair], BotSense.knownY[pair], BotSense.knownZ[pair])) : -1;
    if (node < 0) { BotSense.knownAt[pair] = -1e9; return; }
    this.searchLeft[id]--;
    const x = Nav.nodeX[node], y = Nav.nodeY[node], z = Nav.nodeZ[node];
    BotSense.knownX[pair] = x; BotSense.knownY[pair] = y; BotSense.knownZ[pair] = z;
    this.goalX[id] = x; this.goalY[id] = y; this.goalZ[id] = z;
    BotMove.stop(id);   // a fresh path now, past the repath throttle (at most SEARCH_SPOTS times a chase)
    BotMove.goTo(id, x, y, z, this.goalRadius[id]);
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
  // The bot stands at the spot its goal holds (defend, camp, objective hold): placed gadgets go down here.
  holding(id) {
    if (this.goalAction[id] !== ACTION.HOLD || this.goal[id] === GOAL.NONE) return false;
    return length2(this.goalX[id] - Actors.x[id], this.goalZ[id] - Actors.z[id]) <= this.goalRadius[id] + HOLD_ARRIVED;
  },
  favoriteWeapon(id) {
    const row = Bots.profile[id];
    if (!row || !row.favorite) return '';
    if (row.favorite !== BOT_FAVORITE_PLAYER) return row.favorite;
    return BotCombat.mostUsedPlayerWeapon() || FALLBACK_FAVORITE;
  },

  // ---- BOT-021 aggression: 0 when hurt or far below the enemy, 0.7 with a powerup, else the weapon value x trait x difficulty ----
  // The enemy's height is where the bot believes it is (BOT-040).
  aggression(id, target) {
    const lowHealth = Actors.health[id] < Actors.maxHealth[id] * AGGRESSION_HEALTH && Actors.armor[id] < AGGRESSION_ARMOR;
    if (lowHealth || (target >= 0 && BotSense.perceivedPosition(id, target, threatPoint).y - Actors.y[id] >= AGGRESSION_HEIGHT)) return 0;
    if (Items.activePowerups(id, powerupList) > 0) return AGGRESSION_POWERUP;
    const weapon = Weapons.currentWeapon(id), value = weapon ? Math.max(AGGRESSION_WEAPON_FLOOR, weapon.botPref.value) : 0;
    return clamp(value * (0.5 + Bots.trait(id, TRAIT.aggression)) * (0.5 + Bots.currentSkill().aggression) * mutatorRisk(), 0, 1);
  },
};

// BOT-071: no enemy the bot can see within REVIVE_SAFE_DISTANCE of the downed ally (BotSense.sees fails through smoke).
function reviveSafe(id, ally) {
  for (let enemy = 0; enemy < Actors.count; enemy++) {
    if (!Actors.alive[enemy] || !Actors.isEnemy(id, enemy) || !BotSense.sees(id, enemy)) continue;
    if (length2(Actors.x[enemy] - Actors.x[ally], Actors.z[enemy] - Actors.z[ally]) < REVIVE_SAFE_DISTANCE) return false;
  }
  return true;
}

// MUT-003: hitting harder than one is hit (damage dealt / taken mutators) makes fights worth more, and the reverse.
function mutatorRisk() {
  const fx = Mutators.fx;
  if (!fx) return 1;
  const dealt = fx.damageOut === undefined ? 1 : fx.damageOut, taken = fx.damageIn === undefined ? 1 : fx.damageIn;
  return clamp(Math.sqrt(dealt / Math.max(taken, 1e-3)), MUTATOR_RISK_MIN, MUTATOR_RISK_MAX);
}

// A tier with `flanks` (BT5+) chases a far target round the side: the flank hint nearer the target than the bot whose way
// (bot -> hint -> target) is shortest and at most FLANK_DETOUR x the straight way; -1 = straight on. One flank per FLANK_REST s.
function flankSpot(id, targetX, targetZ, now) {
  if (!Bots.tier(id).flanks || now - BotDecide.flankedAt[id] < FLANK_REST) return -1;
  const x = Actors.x[id], z = Actors.z[id], direct = length2(targetX - x, targetZ - z), spots = BotDecide.flankSpots;
  if (direct < FLANK_MIN_DISTANCE) return -1;
  let best = -1, bestWay = direct * FLANK_DETOUR;
  for (let i = 0; i < spots.length; i++) {
    const toTarget = length2(targetX - spots[i].x, targetZ - spots[i].z), fromBot = length2(spots[i].x - x, spots[i].z - z);
    if (toTarget >= direct || fromBot <= FLANK_REACHED || fromBot + toTarget >= bestWay) continue;
    best = i; bestWay = fromBot + toTarget;
  }
  return best >= 0 && BotTeam.takeFlankToken(id, now) ? best : -1;   // BOT-053: one flanker per team at a time
}

// BOT-002 Search: a spot the lost target may have gone on to, SEARCH_HOPS random links from `from` (never a jump pad or
// teleporter node); -1 when the walk leads nowhere new.
function searchWalk(from) {
  let node = from;
  for (let hop = 0; hop < SEARCH_HOPS && node >= 0; hop++) {
    const first = Nav.linkStart[node], count = Nav.linkStart[node + 1] - first;
    if (count <= 0) break;
    const next = Nav.linkTarget[first + Math.floor(Rng.bots.next() * count)];
    if (Nav.nodeFlags[next] & NAV_NODE.TRIGGER) break;
    node = next;
  }
  return node === from ? -1 : node;
}

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
GOAL_SCORERS[GOAL.ATTACK] = (id, plan, now) => {
  const target = BotCombat.target[id];
  if (target < 0 || !BotSense.sees(id, target)) return 0;
  const aggression = BotDecide.aggression(id, target);
  if (aggression < RETREAT_THRESHOLD) return 0;
  // BOT-053: only attack token holders close in; the others fight from where they stand, coming no nearer than the
  // weapon's range (a melee weapon must close in).
  const weapon = Weapons.currentWeapon(id), closest = attackRadius(weapon);
  const closeIn = (weapon && weapon.class === 'melee') || BotTeam.takeAttackToken(id, target, now);
  const distance = length2(Actors.x[target] - Actors.x[id], Actors.z[target] - Actors.z[id]);
  const radius = closeIn ? closest : clamp(distance, closest, weapon ? weapon.botPref.range[1] : closest);
  setPlan(plan, Actors.x[target], Actors.y[target], Actors.z[target], radius, ACTION.MOVE, target);
  return ATTACK_BASE + ATTACK_GAIN * aggression;
};
// A melee weapon closes inside its reach (a 1.5 m stop left an out-of-ammo bot swinging 2 m short of a cornered enemy).
function attackRadius(weapon) {
  if (weapon && weapon.class === 'melee') return weapon.primary.reach * ATTACK_RANGE_SHARE;
  return Math.max(ATTACK_MIN_RADIUS, weapon ? weapon.botPref.range[1] * ATTACK_RANGE_SHARE : DEFAULT_ENGAGE_DISTANCE);
}
GOAL_SCORERS[GOAL.CHASE] = (id, plan, now) => {
  const target = BotCombat.target[id];
  if (target < 0 || BotSense.sees(id, target) || !BotSense.knows(id, target, now)) return 0;
  const aggression = BotDecide.aggression(id, target);
  if (aggression < RETREAT_THRESHOLD) return 0;
  const pair = BotSense.pair(id, target), freshness = 1 - (now - BotSense.knownAt[pair]) / SENSE_MEMORY;
  const flank = flankSpot(id, BotSense.knownX[pair], BotSense.knownZ[pair], now), spot = BotDecide.flankSpots[flank];
  BotDecide.flankSpot[id] = flank;
  if (spot) setPlan(plan, spot.x, spot.y, spot.z, FLANK_REACHED, ACTION.MOVE, target);
  else setPlan(plan, BotSense.knownX[pair], BotSense.knownY[pair], BotSense.knownZ[pair], 1.5, ACTION.MOVE, target);
  return CHASE_BASE + CHASE_GAIN * aggression * freshness;
};
GOAL_SCORERS[GOAL.RETREAT] = (id, plan, now) => {
  const threat = retreatThreat(id, now);
  if (threat < 0) return 0;
  const aggression = BotDecide.aggression(id, threat);
  if (aggression >= RETREAT_THRESHOLD) return 0;
  retreatSpot(id, threat, plan);
  return Math.min(0.95, RETREAT_BASE + RETREAT_GAIN * (RETREAT_THRESHOLD - aggression) * 2 * (0.5 + Bots.trait(id, TRAIT.selfPreservation)));
};
GOAL_SCORERS[GOAL.COLLECT] = (id, plan, now) => {
  if (Modes.loot.count > 0) return collectScore(id, bestLoot(id, plan));   // royale: the rolled loot spots instead of map pickups
  const item = bestItem(id, now);
  if (item < 0) return 0;
  const entry = BotDecide.items[item];
  setPlan(plan, entry.x, entry.y, entry.z, ITEM_TOUCH * 0.6, ACTION.MOVE, item);
  return collectScore(id, decideScratch.x);
};
GOAL_SCORERS[GOAL.OBJECTIVE] = (id, plan, now) => {
  if (!Modes.active || Modes.phase !== PHASE.LIVE) return 0;
  plan.score = 0;
  if (!planObjective(id, plan, now)) return 0;
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
// BOT-071: walk to the nearest downed teammate and hold Use next to it (Damage revives after 5 s), when it is safe.
GOAL_SCORERS[GOAL.REVIVE] = (id, plan) => {
  if (!Damage.downedCount || (Actors.flags[id] & ACTOR_FLAG.DOWNED)) return 0;
  const ally = Damage.nearestDownedAlly(id, REVIVE_SEARCH);
  if (ally < 0 || !reviveSafe(id, ally)) return 0;
  setPlan(plan, Actors.x[ally], Actors.y[ally], Actors.z[ally], REVIVE_STAND, ACTION.USE, ally);
  const distance = length2(Actors.x[ally] - Actors.x[id], Actors.z[ally] - Actors.z[id]);
  return REVIVE_BASE + REVIVE_GAIN * Bots.trait(id, TRAIT.teamwork) * (1 - distance / REVIVE_SEARCH);
};

function collectScore(id, value) {
  return value > 0 ? Math.min(COLLECT_MAX, COLLECT_BASE + COLLECT_GAIN * value * (0.5 + Bots.trait(id, TRAIT.itemFocus))) : 0;
}

// The safe area first while it hurts, then the M20 squad (beacon, stay together), then the planner of the mode's
// objective kind, then the mode's goal hints.
function planObjective(id, plan, now) {
  if (Modes.hud.zoneRadius > 0 && BotDecide.planners.safeArea(id, plan, now)) return true;
  if (Modes.squads.count > 0 && planSquad(id, plan)) return true;
  const planner = BotDecide.planners[Modes.rules.objective];
  if (planner && planner(id, plan, now)) return true;
  return planGoals(id, plan);
}

// What a bot retreats from: its target while in sight, else the enemy that hit it in the last 3 s; -1 = nothing.
function retreatThreat(id, now) {
  const target = BotCombat.target[id];
  if (target >= 0 && BotSense.sees(id, target)) return target;
  const attacker = BotSense.attacker[id];
  return attacker >= 0 && now - BotSense.attackedAt[id] < TARGET_REVENGE_SECONDS ? attacker : -1;
}

// Health item when hurt and one is reachable, else cover from the threat, else a node away from it. The threat is
// where the bot believes it is (in sight: there; else its remembered place, from the hit's direction).
function retreatSpot(id, threat, plan) {
  const hurt = Actors.health[id] < Actors.maxHealth[id] * AGGRESSION_HEALTH;
  const health = hurt ? bestItem(id, Sim.time, 'health') : -1;
  if (health >= 0) { const item = BotDecide.items[health]; setPlan(plan, item.x, item.y, item.z, ITEM_TOUCH * 0.6, ACTION.MOVE, health); return; }
  BotSense.perceivedPosition(id, threat, threatPoint);
  const tx = threatPoint.x, tz = threatPoint.z;
  const cover = Nav.nearestCover(Actors.x[id], Actors.y[id], Actors.z[id], tx, threatPoint.y + SPAWN_EYE_HEIGHT, tz, RETREAT_COVER_RANGE);
  if (cover >= 0) { const node = Nav.coverNode[cover]; setPlan(plan, Nav.nodeX[node], Nav.nodeY[node], Nav.nodeZ[node], 0.8, ACTION.HOLD, threat); return; }
  const dx = Actors.x[id] - tx, dz = Actors.z[id] - tz, length = length2(dx, dz) || 1;
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
    const distance = length3(item.x - Actors.x[id], item.y - Actors.y[id], item.z - Actors.z[id]);
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

// Royale loot (Modes.loot): the best untaken, reachable spot by what it gives this bot / travel; fills the plan, returns the value.
function bestLoot(id, plan) {
  const loot = Modes.loot, botNode = Nav.nearestNode(Actors.x[id], Actors.y[id], Actors.z[id]);
  let best = -1, bestScore = 0;
  for (let spot = 0; spot < loot.count; spot++) {
    if (loot.taken[spot] || BotDecide.lootNode[spot] < 0 || !Nav.reachable(botNode, BotDecide.lootNode[spot])) continue;
    const value = lootValue(id, spot);
    if (value <= 0) continue;
    const score = value / (1 + length2(loot.x[spot] - Actors.x[id], loot.z[spot] - Actors.z[id]) / COLLECT_DISTANCE);
    if (score > bestScore) { bestScore = score; best = spot; }
  }
  // USE: a full inventory swaps a weapon only while USE is held (13g); USE does nothing at the other spots.
  if (best >= 0) setPlan(plan, loot.x[best], loot.y[best], loot.z[best], ITEM_TOUCH * 0.6, ACTION.USE, -1);
  return bestScore;
}

function lootValue(id, spot) {
  const loot = Modes.loot, group = loot.group[spot];
  if (group === LOOT_GROUP.WEAPON) {
    const weapon = loot.weapon[spot] >= 0 ? CAT.weapons[loot.weapon[spot]] : null;
    if (weapon && Weapons.has(id, weapon.id)) return 0;
    return ITEM_VALUES.weapon * (weapon ? weapon.botPref.value : 0.5) * (1 + LOOT_RARITY_VALUE * loot.rarity[spot]);
  }
  if (group === LOOT_GROUP.ARMOR) return Actors.shield[id] < Modes.rules.params.shieldByRarity[loot.rarity[spot]] ? ITEM_VALUES.armor : 0;
  return itemValue(id, group === LOOT_GROUP.HEALTH ? LOOT_HEALTH_ITEM : LOOT_AMMO_ITEM);
}

function campSpot(id) {
  const side = Actors.team[id] < 0 ? 2 : Actors.team[id];
  let best = null, bestDistance = Infinity;
  for (const spot of BotDecide.campSpots) {
    if (!spot.safe[side]) continue;
    const distance = length2(spot.x - Actors.x[id], spot.z - Actors.z[id]);
    if (distance < bestDistance) { bestDistance = distance; best = spot; }
  }
  return best;
}

// ---- Objective planners (BOT-080): plan.score 0..1 is the objective's urgency for this bot ----
// A bot's place in a zone: spread around the centre by id so a team does not stack on one spot.
function zoneSpot(id, objective, plan, action) { spreadSpot(id, objective, SPREAD_FRACTION, plan, action); }

// The spot inside `share` of the objective's radius (golden angle spread by id), so a crowd does not jam one point.
function spreadSpot(id, objective, share, plan, action) {
  const angle = id * GOLDEN_ANGLE, offset = objective.radius * share * ((id % 3) + 1) / 3;
  const radius = Math.max(GOAL_TOUCH_RADIUS, objective.radius * share);
  setPlan(plan, objective.x + Math.sin(angle) * offset, objective.y, objective.z + Math.cos(angle) * offset, radius, action, objective.index);
}

function planZones(id, plan, kind, now) {
  const team = Actors.team[id], defender = BotTeam.role[id] === ROLE.DEFEND;
  let best = null, bestScore = 0;
  for (const objective of Modes.objectives) {
    if (objective.kind !== kind || !objective.active) continue;
    const threatened = objective.contested || (objective.capturingTeam >= 0 && objective.capturingTeam !== team);
    const value = objective.owner !== team || team < 0 ? 1 : threatened ? 0.9 : defender ? 0.6 : 0.25;
    const score = value / (1 + length2(objective.x - Actors.x[id], objective.z - Actors.z[id]) / 40);
    if (score > bestScore) { bestScore = score; best = objective; }
  }
  if (!best) return false;
  zoneSpot(id, best, plan, ACTION.HOLD);
  plan.score = clamp(bestScore * 1.5, 0, 1);
  if (BotTeam.role[id] !== ROLE.FREELANCE && now - Bots.stateSince[id] < 0.6) BotTeam.bark(id, 'takingPoint', now);
  return true;
}

// Flags (ctf, oneflag): the carrier runs home; a taken own flag is chased, a dropped one returned; attackers and escorts
// escort a team-mate's carry and, while the enemy flag is home, gather at the team's rally point and push together.
function planFlags(id, plan) {
  const team = Actors.team[id];
  if (team < 0) return false;
  Modes.findObjectives('flag', objectiveList);
  Modes.findObjectives('flagBase', baseList);
  const neutral = Modes.rules.params.neutral, own = neutral ? null : teamObjective(objectiveList, team);
  const enemy = neutral ? teamObjective(objectiveList, NO_TEAM) : teamObjective(objectiveList, 1 - team);
  if (!enemy) return false;
  if (enemy.carrier === id) return planCapture(id, plan, own, neutral ? teamObjective(baseList, 1 - team) : own);
  const role = BotTeam.role[id], defender = role === ROLE.DEFEND;
  if (own && own.state === 'carried' && (defender || nearby(id, own, FLAG_CHASE_RANGE))) return planTarget(plan, own, defender ? 0.95 : 0.75, 1.2, ACTION.MOVE);
  if (own && own.state === 'dropped') return planTarget(plan, own, 0.9, 0.8, ACTION.MOVE);
  if (enemy.state === 'carried' && !Actors.isEnemy(id, enemy.carrier)) return planTarget(plan, enemy, defender ? 0.3 : 0.85, 4, ACTION.MOVE);
  if (defender && own) return planHome(id, plan, own, 0.7);
  if (enemy.state === 'home' && !BotTeam.pushing(team) && BotTeam.hasRally(team) && !pastRally(id, own, team)) return planRally(id, plan, team);
  return planTarget(plan, enemy, BotTeam.pushing(team) ? PUSH_URGENCY : 0.8, 0.8, ACTION.MOVE);
}

function nearby(id, objective, range) { return length2(objective.x - Actors.x[id], objective.z - Actors.z[id]) < range; }

function planCapture(id, plan, own, destination) {
  if (!destination) return false;
  setPlan(plan, destination.homeX, destination.homeY, destination.homeZ, 0.8, ACTION.MOVE, destination.index);
  plan.score = CARRY_URGENCY;
  return true;
}

// A raider already farther from its own flag than the rally point (plus the gather radius) keeps going: a push that ran
// out while it fought at the enemy base does not send it back.
function pastRally(id, own, team) {
  if (!own) return false;
  const rallyDistance = length2(BotTeam.rallyX[team] - own.homeX, BotTeam.rallyZ[team] - own.homeZ);
  return length2(Actors.x[id] - own.homeX, Actors.z[id] - own.homeZ) > rallyDistance + BOT_FLAG_PUSH.radius;
}

// The rally is a meeting place, not a held spot (ACTION.MOVE: no mines, turrets or channels go down there).
function planRally(id, plan, team) {
  const angle = id * GOLDEN_ANGLE, spread = BOT_FLAG_PUSH.radius * SPREAD_FRACTION;
  setPlan(plan, BotTeam.rallyX[team] + Math.sin(angle) * spread, BotTeam.rallyY[team], BotTeam.rallyZ[team] + Math.cos(angle) * spread, 2, ACTION.MOVE, -1);
  plan.score = 0.75;
  return true;
}

function planTarget(plan, objective, score, radius, action) {
  setPlan(plan, objective.x, objective.y, objective.z, radius, action, objective.index);
  plan.score = score;
  return true;
}

function planHome(id, plan, objective, score) {
  const angle = id * GOLDEN_ANGLE;
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
    const distance = length2(list[i].x - x, list[i].z - z);
    if (distance < bestDistance) { bestDistance = distance; best = list[i]; }
  }
  return best;
}

// Elimination safe area (M14) and the royale ring (M20): get inside before it hurts. With a ring coming, the circle
// that matters is the next one (the ring shrinks onto it).
function planSafeArea(id, plan) {
  if (insideSafeArea(Actors.x[id], Actors.z[id])) return false;
  setPlan(plan, safeCircle.x, Actors.y[id], safeCircle.z, safeCircle.radius * 0.5, ACTION.MOVE, -1);
  plan.score = 1;
  return true;
}

// A spot inside the safe area (with its margin), or anywhere while there is none; fills safeCircle.
function insideSafeArea(x, z) {
  if (Modes.hud.zoneRadius <= 0) return true;
  safeCircleNow(safeCircle);
  return length2(x - safeCircle.x, z - safeCircle.z) <= safeCircle.radius * SAFE_AREA_MARGIN;
}

// M20 squads (Modes.squads, 13g): with a squadmate out and a beacon use left, every standing member goes to hold Use at
// the squad's beacon (unless the ring has left it outside: the ring wins); else it stays near the squad leader.
function planSquad(id, plan) {
  const squads = Modes.squads, squad = Actors.team[id];
  if (squad < 0 || squad >= squads.count || isDowned(id)) return false;
  if (squads.dead[squad] === 0 || squads.beaconUses[squad] === 0 || !insideSafeArea(squads.beaconX[squad], squads.beaconZ[squad])) return followSquad(id, squad, plan);
  setPlan(plan, squads.beaconX[squad], squads.beaconY[squad], squads.beaconZ[squad], GOAL_TOUCH_RADIUS, ACTION.USE, -1);
  plan.score = BEACON_URGENCY;
  return true;
}

// Farther than SQUAD_KEEP m from the leader: back to it, more urgently the farther it is. Any objective plan scores
// OBJECTIVE_BASE or more and so beats every chase: a bot with a target leaves its fight only past SQUAD_FIGHT_KEEP m.
function followSquad(id, squad, plan) {
  const leader = squadLeader(squad);
  if (leader < 0 || leader === id) return false;
  const distance = length2(Actors.x[leader] - Actors.x[id], Actors.z[leader] - Actors.z[id]);
  if (distance <= (BotCombat.target[id] >= 0 ? SQUAD_FIGHT_KEEP : SQUAD_KEEP)) return false;
  setPlan(plan, Actors.x[leader], Actors.y[leader], Actors.z[leader], SQUAD_KEEP * SPREAD_FRACTION, ACTION.MOVE, -1);
  plan.score = SQUAD_FOLLOW_URGENCY * Math.min(1, (distance - SQUAD_KEEP) / SQUAD_KEEP);
  return true;
}

// The player when standing in the squad, else its lowest standing id; -1 = nobody standing.
function squadLeader(squad) {
  const player = Game.playerId;
  if (player >= 0 && Actors.team[player] === squad && Actors.alive[player] && !isDowned(player)) return player;
  for (let id = 0; id < Actors.count; id++) {
    if (Actors.team[id] === squad && Actors.alive[id] && !isDowned(id) && Modes.isActive(id)) return id;
  }
  return -1;
}

function safeCircleNow(out) {
  const hud = Modes.hud, next = hud.ringPhases > 0 && hud.ringNextRadius > 0;
  out.x = next ? hud.ringNextX : hud.zoneX;
  out.z = next ? hud.ringNextZ : hud.zoneZ;
  out.radius = next ? hud.ringNextRadius : hud.zoneRadius;
  return out;
}

// Mode goal hints (BOT-080, Modes.goalFor -> BOT_OBJECTIVE_VERBS): the most urgent objective, by distance, that names
// something for this bot to do (arm or disarm a relay, escort or stop the convoy, take or keep a prize, reach a beacon).
function planGoals(id, plan) {
  const objectives = Modes.objectives;
  let best = null, bestVerb = null, bestScore = 0;
  for (let i = 0; i < objectives.length; i++) {
    const verb = BOT_OBJECTIVE_VERBS[Modes.goalFor(objectives[i], id)], objective = objectives[i];
    if (!verb) continue;
    const score = verb.urgency / (1 + length2(objective.x - Actors.x[id], objective.z - Actors.z[id]) / GOAL_DISTANCE_SCALE);
    if (score > bestScore) { bestScore = score; best = objective; bestVerb = verb; }
  }
  if (!best) return false;
  planVerb(id, plan, best, bestVerb);
  plan.score = bestVerb.urgency;
  return true;
}

function planVerb(id, plan, objective, verb) {
  if (verb.action === 'keep') { keepAway(id, plan); plan.target = objective.index; return; }
  if (verb.action === 'hold') { zoneSpot(id, objective, plan, ACTION.HOLD); return; }
  spreadSpot(id, objective, verb.share, plan, verb.action === 'use' ? ACTION.USE : ACTION.MOVE);
}

// A prize scores while held: keep away from the enemy the bot fights or was hit by (cover, or away), else hold still.
function keepAway(id, plan) {
  const threat = BotCombat.target[id] >= 0 ? BotCombat.target[id] : retreatThreat(id, Sim.time);
  if (threat >= 0) { retreatSpot(id, threat, plan); return; }
  setPlan(plan, Actors.x[id], Actors.y[id], Actors.z[id], 1, ACTION.HOLD, -1);
}

BotDecide.registerPlanner('point', (id, plan, now) => planZones(id, plan, 'point', now));
BotDecide.registerPlanner('hill', (id, plan, now) => planZones(id, plan, 'hill', now));
BotDecide.registerPlanner('flag', (id, plan) => planFlags(id, plan));
BotDecide.registerPlanner('bombsite', (id, plan) => planBomb(id, plan));
BotDecide.registerPlanner('safeArea', (id, plan) => planSafeArea(id, plan));

Bus.on('match.start', (match) => BotDecide.onMatchStart(match));
Bus.on('pickup', (event) => BotDecide.onPickup(event));
