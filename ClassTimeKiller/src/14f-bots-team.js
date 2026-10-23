// Bot team play (BOT-050, BOT-051, BOT-060..BOT-062, BOT-100): a commander per team hands out roles every 15 s (attack, defend, escort by
// the mode's objective kind, BOT_ROLE_SPLITS); the player's pings and comm wheel callouts (COMM_CALLOUTS, wheel in 17g) are
// orders that the nearest team bots (the whole team for follow / hold / regroup; only the aimed bot when the wheel addressed one)
// acknowledge and follow (acknowledged within 0.5-1.5 s; the nearest team bot answers an enemy ping the same way); replies
// (Dibs / No / On my way) are information only; bots ping enemies they spot (shared memory for the team, at most once per 4 s per bot) and talk in short text
// barks (BOT-100 limits: 5 s per bot, 1.5 s per team; chatter setting off / minimal / normal, taunts option).
// Grenade tokens keep a team from throwing more than one every 3 s; attack and flank tokens (BOT-053, BOT_TOKENS) limit
// how many bots close in on one target and flank at once. Squads (BOT-052, BOT_SQUAD): followers keep with their leader.
// Flag raids: attackers gather at a rally point and push together (BOT_FLAG_PUSH). BotEconomy buys in buy times and wave shops.

const ROLE = { FREELANCE: 0, ATTACK: 1, DEFEND: 2, ESCORT: 3 };
const ROLE_NAMES = Object.keys(ROLE).map((name) => name.toLowerCase());
const COMMANDER_INTERVAL = 15;
const ENEMY_PING_INTERVAL = 4;
const ITEM_PING_INTERVAL = 4;           // s between a bot's item pings (Dibs on the item it goes for)
const OBJECTIVE_PING_INTERVAL = 8;      // s between a team's objective pings (a bot marks the objective it plays on a mode call-out)
const ITEM_PING_RADIUS = 2;             // a move ping this close to an item spot is a ping on the item: the taker calls Dibs
const OBJECTIVE_ANNOUNCES = new Set(['capture', 'bomb', 'flag', 'objective']);   // announce kinds the objective bark answers
const BARK_BOT_INTERVAL = 5, BARK_TEAM_INTERVAL = 1.5;
const GRENADE_TOKEN_INTERVAL = 3;
const TEAM_SLOTS = MAX_ACTORS + 1;      // index 0 = no team, then the teams (M20 squads use team indices up to the actor count)
const ORDER_ACK_MIN = 0.5, ORDER_ACK_MAX = 1.5;   // BOT-051: an order is acknowledged within 0.5-1.5 s
const ORDER_SECONDS = { go: 30, attack: 30, defend: 45, follow: 60, cover: 45 };
const ORDER_TAKERS = 2;                 // the nearest bots of the team answer a move order
const ORDER_RADIUS = 2.5;
const FOLLOW_RADIUS = 3;                // a following bot keeps this close to the one it follows
const COVER_RADIUS = 4;                 // a covering bot holds this close to the one it covers, watching around them
// BOT-061/062 comm wheel callouts, clockwise from the top. id = the ping kind; at: 'aim' (the aimed spot or enemy), 'self'
// (the caller's feet) or 'reply' (answers the newest teammate ping, at its spot); order = what the takers do ('' = information
// only; 'hold' = defend where each taker stands); team = every team bot takes it; seconds = how long the HUD marker stays (17d).
const COMM_CALLOUTS = [
  { id: 'attack', label: 'Attack', at: 'aim', order: 'attack', seconds: 8 },
  { id: 'defend', label: 'Defend', at: 'aim', order: 'defend', seconds: 8 },
  { id: 'cover', label: 'Cover me', at: 'self', order: 'cover', seconds: 5 },
  { id: 'follow', label: 'Follow me', at: 'self', order: 'follow', team: true, seconds: 5 },
  { id: 'hold', label: 'Hold position', at: 'self', order: 'hold', team: true, seconds: 5 },
  { id: 'regroup', label: 'Regroup', at: 'self', order: 'go', team: true, seconds: 6 },
  { id: 'onMyWay', label: 'On my way', at: 'reply', order: '', seconds: 4 },
  { id: 'dibs', label: 'Dibs', at: 'reply', order: '', seconds: 4 },
  { id: 'no', label: 'No', at: 'reply', order: '', seconds: 4 },
  { id: 'danger', label: 'Danger', at: 'aim', order: '', seconds: 8 },
  { id: 'enemy', label: 'Enemy', at: 'aim', order: '', seconds: 5 },
  { id: 'go', label: 'Go here', at: 'aim', order: 'go', seconds: 8 },
];
const COMM_CALLOUT_BY_KIND = new Map(COMM_CALLOUTS.map((row) => [row.id, row]));
const PING_RANGE = 120;
const PING_AIM_COS = Math.cos(4 * DEG);  // an enemy this close to the aim line is the ping's target
const HELP_HEALTH = 0.5, HELP_RECENT = 0.15;
const CHATTER_LEVELS = ['off', 'minimal', 'normal'];
const PUSH_CHECK_INTERVAL = 0.5;
const SQUAD_BASE = 0.2, SQUAD_GAIN = 0.2;   // keeping with the leader beats roaming; by teamwork
const SQUAD_REGROUP = 0.25;              // a broken-off follower adds this (still below fights, objectives and orders)

Settings.define('gameplay.chatter', 'normal', { label: 'Bot chatter', category: 'gameplay', options: CHATTER_LEVELS });
Settings.define('gameplay.taunts', true, { label: 'Bot taunts', category: 'gameplay' });

const pingPayload = { id: -1, kind: '', x: 0, y: 0, z: 0, target: -1, to: -1 };   // to = the one bot addressed (-1 = the squad)
const barkPayload = { id: -1, team: NO_TEAM, category: '', text: '' };
const pingHit = { distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null };
const rankList = [];
const takerList = [];
const squadOpen = new Int16Array(ROLE_NAMES.length), squadSize = new Uint8Array(ROLE_NAMES.length);   // per role while squads form
const aimDirection = { x: 0, y: 0, z: 0 };

const BotTeam = {
  role: new Uint8Array(MAX_ACTORS),
  orderKind: new Array(MAX_ACTORS).fill(''), orderUntil: new Float64Array(MAX_ACTORS),
  orderX: new Float32Array(MAX_ACTORS), orderY: new Float32Array(MAX_ACTORS), orderZ: new Float32Array(MAX_ACTORS),
  orderSource: new Int16Array(MAX_ACTORS).fill(-1),   // who gave the order (a follow order tracks them)
  orderGivenAt: new Float64Array(MAX_ACTORS), ackAt: new Float64Array(MAX_ACTORS), answeredAt: new Float64Array(MAX_ACTORS),
  ackCategory: new Array(MAX_ACTORS).fill('orderAck'),   // the reply bark due at ackAt
  enemyPingAt: new Float64Array(MAX_ACTORS).fill(-1e9), itemPingAt: new Float64Array(MAX_ACTORS).fill(-1e9), barkAt: new Float64Array(MAX_ACTORS).fill(-1e9),
  teamBarkAt: new Float64Array(TEAM_SLOTS).fill(-1e9), objectivePingAt: new Float64Array(TEAM_COUNT).fill(-1e9),
  grenadeAt: new Float64Array(TEAM_SLOTS + MAX_ACTORS).fill(-1e9),
  // BOT-053 tokens: BOT_TOKENS.attackers slots per target, one flank slot per team (free-for-all: per bot); holder -1 = free.
  attackHolder: new Int16Array(MAX_ACTORS * BOT_TOKENS.attackers).fill(-1), attackUntil: new Float64Array(MAX_ACTORS * BOT_TOKENS.attackers),
  flankHolder: new Int16Array(TEAM_SLOTS + MAX_ACTORS).fill(-1), flankUntil: new Float64Array(TEAM_SLOTS + MAX_ACTORS),
  squadLeader: new Int16Array(MAX_ACTORS).fill(-1),   // BOT-052: the bot's squad leader (itself when it leads), -1 = no squad
  lowBarked: new Uint8Array(MAX_ACTORS),
  // Flag raids per team: the rally point (rallyNode -1 = none), the push window, the first wait at the rally.
  rallyNode: new Int32Array(TEAM_COUNT).fill(-1), rallyX: new Float32Array(TEAM_COUNT), rallyY: new Float32Array(TEAM_COUNT), rallyZ: new Float32Array(TEAM_COUNT),
  pushUntil: new Float64Array(TEAM_COUNT), waitSince: new Float64Array(TEAM_COUNT).fill(-1), pushCheckAt: 0,
  commanderAt: 0,
  chatter: 'normal', taunts: true,
  stats: { barks: 0, pings: 0, orders: 0 },

  onMatchStart() {
    this.commanderAt = 0;
    this.role.fill(ROLE.FREELANCE);
    this.orderUntil.fill(0);
    this.ackAt.fill(0);
    this.enemyPingAt.fill(-1e9); this.itemPingAt.fill(-1e9);
    this.barkAt.fill(-1e9);
    this.teamBarkAt.fill(-1e9); this.objectivePingAt.fill(-1e9);
    this.grenadeAt.fill(-1e9);
    this.pushUntil.fill(0); this.waitSince.fill(-1); this.pushCheckAt = 0;
    for (let team = 0; team < TEAM_COUNT; team++) this.placeRally(team);
  },
  // On the way from the team's own flag to the enemy's: a nav node BOT_FLAG_PUSH.rallyShare of the way (two-flag modes only).
  placeRally(team) {
    this.rallyNode[team] = -1;
    const flags = Modes.active && Modes.rules.objective === 'flag' && !Modes.rules.params.neutral ? Modes.objectives : null;
    const own = flags ? flags.find((o) => o.kind === 'flag' && o.team === team) : null, enemy = flags ? flags.find((o) => o.kind === 'flag' && o.team === 1 - team) : null;
    if (!own || !enemy) return;
    const share = BOT_FLAG_PUSH.rallyShare;
    const node = Nav.nearestNode(lerp(own.homeX, enemy.homeX, share), lerp(own.homeY, enemy.homeY, share), lerp(own.homeZ, enemy.homeZ, share));
    if (node < 0) return;
    this.rallyNode[team] = node;
    this.rallyX[team] = Nav.nodeX[node]; this.rallyY[team] = Nav.nodeY[node]; this.rallyZ[team] = Nav.nodeZ[node];
  },
  hasRally(team) { return team >= 0 && team < TEAM_COUNT && this.rallyNode[team] >= 0; },
  pushing(team) { return team >= 0 && team < TEAM_COUNT && Sim.time < this.pushUntil[team]; },
  // Twice a second: a team whose raiders gathered (or waited long enough) at the rally point pushes for BOT_FLAG_PUSH.seconds.
  updatePushes(now) {
    if (now < this.pushCheckAt) return;
    this.pushCheckAt = now + PUSH_CHECK_INTERVAL;
    for (let team = 0; team < TEAM_COUNT; team++) if (this.rallyNode[team] >= 0 && now >= this.pushUntil[team]) this.checkPush(team, now);
  },
  checkPush(team, now) {
    let raiders = 0, gathered = 0;
    for (let id = 0; id < Actors.count; id++) {
      if (!Bots.isBot(id) || Actors.team[id] !== team || (this.role[id] !== ROLE.ATTACK && this.role[id] !== ROLE.ESCORT)) continue;
      raiders++;
      if (length2(Actors.x[id] - this.rallyX[team], Actors.z[id] - this.rallyZ[team]) <= BOT_FLAG_PUSH.radius) gathered++;
    }
    if (gathered > 0 && this.waitSince[team] < 0) this.waitSince[team] = now;
    const waited = this.waitSince[team] >= 0 && now - this.waitSince[team] >= BOT_FLAG_PUSH.wait;
    if (raiders === 0 || (gathered < Math.min(BOT_FLAG_PUSH.minimum, raiders) && !waited)) return;
    this.pushUntil[team] = now + BOT_FLAG_PUSH.seconds;
    this.waitSince[team] = -1;
  },
  onSpawn(id) { this.lowBarked[id] = 0; },

  // ---- Once per tick: the commander (the player's ping button and comm wheel are read by 17g) ----
  step(now) {
    if (now >= this.commanderAt) { this.commanderAt = now + COMMANDER_INTERVAL; this.assignRoles(); }
    this.updatePushes(now);
  },
  assignRoles() {
    this.squadLeader.fill(-1);
    for (let team = 0; team < TEAM_COUNT; team++) this.assignTeam(team, roleSplitKey(team));
    for (let id = 0; id < Actors.count; id++) if (Bots.active[id] && Actors.team[id] < 0) this.role[id] = ROLE.FREELANCE;
  },
  // The bots with the most teamwork take the support roles (defend, escort); the others attack.
  assignTeam(team, key) {
    const splits = BOT_ROLE_SPLITS[key] || BOT_ROLE_SPLITS.none;
    rankList.length = 0;
    for (let id = 0; id < Actors.count; id++) if (Bots.active[id] && Actors.team[id] === team) rankList.push(id);
    if (!rankList.length) return;
    rankList.sort((a, b) => Bots.trait(b, TRAIT.teamwork) - Bots.trait(a, TRAIT.teamwork) || a - b);
    const defenders = Math.round(rankList.length * (splits.defend || 0)), escorts = Math.round(rankList.length * (splits.escort || 0));
    for (let rank = 0; rank < rankList.length; rank++) {
      const id = rankList[rank];
      this.role[id] = rank < defenders ? ROLE.DEFEND : rank < defenders + escorts ? ROLE.ESCORT : ROLE.ATTACK;
    }
    if (Modes.rules && Modes.rules.family !== 'pve' && Modes.squads.count === 0) this.formSquads();   // M20 has its own squads (13g, 14e)
  },
  // BOT-052: in rank order (most teamwork first) the bots of one role fill squads of BOT_SQUAD.size; the first one leads.
  formSquads() {
    squadOpen.fill(-1); squadSize.fill(0);
    for (let rank = 0; rank < rankList.length; rank++) {
      const id = rankList[rank], role = this.role[id];
      if (squadOpen[role] < 0 || squadSize[role] >= BOT_SQUAD.size) { squadOpen[role] = id; squadSize[role] = 0; }
      this.squadLeader[id] = squadOpen[role];
      squadSize[role]++;
    }
  },
  // A fallen leader hands its squad to the next follower (BOT-052: followers regroup in versus); the leader rejoins as one.
  passLead(victim) {
    if (this.squadLeader[victim] !== victim) return;
    let heir = -1;
    for (let id = 0; id < Actors.count; id++) {
      if (id === victim || this.squadLeader[id] !== victim) continue;
      if (heir < 0) heir = id;
      this.squadLeader[id] = heir;
    }
    this.squadLeader[victim] = heir;
  },
  // A follower's SQUAD goal plan: the leader's live position; broken off (farther than BOT_SQUAD.regroup) it regroups.
  // A bot with a target fights first (no squad goal, so a regroup never drops a chase).
  squadPlan(id, plan) {
    const leader = this.liveLeader(id);
    if (BotCombat.target[id] >= 0 || leader < 0) return 0;
    setPlan(plan, Actors.x[leader], Actors.y[leader], Actors.z[leader], BOT_SQUAD.keep, ACTION.MOVE, leader);
    const keep = SQUAD_BASE + SQUAD_GAIN * Bots.trait(id, TRAIT.teamwork);
    return length2(Actors.x[leader] - Actors.x[id], Actors.z[leader] - Actors.z[id]) > BOT_SQUAD.regroup ? keep + SQUAD_REGROUP : keep;
  },
  // The living team leader a follower keeps with, or -1 (no squad, or the bot leads).
  liveLeader(id) {
    const leader = this.squadLeader[id];
    if (leader < 0 || leader === id || !Actors.alive[leader] || (Actors.flags[leader] & ACTOR_FLAG.DOWNED) || Actors.team[leader] !== Actors.team[id]) return -1;
    return leader;
  },
  // BOT-052: a follower detours (items, sounds) at most BOT_SQUAD.regroup m from its leader.
  beyondSquad(id, x, z) {
    const leader = this.liveLeader(id);
    return leader >= 0 && length2(x - Actors.x[leader], z - Actors.z[leader]) > BOT_SQUAD.regroup;
  },
  // The objective (index) the follower's leader plays, or -1.
  leaderObjective(id) {
    const leader = this.liveLeader(id);
    return leader >= 0 && BotDecide.goal[leader] === GOAL.OBJECTIVE ? BotDecide.goalTarget[leader] : -1;
  },

  // ---- Per bot after its decision: delayed acknowledgements and situational barks ----
  updateBot(id, now) {
    if (this.ackAt[id] > 0 && now >= this.ackAt[id]) this.answer(id, now);
    const health = Actors.health[id] / Math.max(1, Actors.maxHealth[id]);
    if (health < LOW_HEALTH_FRACTION && !this.lowBarked[id] && this.bark(id, 'lowHealth', now)) this.lowBarked[id] = 1;
    if (health < HELP_HEALTH && now - BotSense.attackedAt[id] < HELP_RECENT) this.bark(id, 'needHelp', now);
    if (this.orderUntil[id] > now && BotDecide.goal[id] === GOAL.ORDER && this.answeredAt[id] < this.orderGivenAt[id]) this.answeredAt[id] = now;
  },

  answer(id, now) {
    this.ackAt[id] = 0;
    this.bark(id, this.ackCategory[id], now);
    if (this.ackCategory[id] === 'dibs') this.emitPing(id, 'dibs', this.orderX[id], this.orderY[id], this.orderZ[id], -1, this.orderSource[id]);
  },
  // A newly chosen objective goal on a point or hill: "Taking the point" (role bots only).
  onObjectiveGoal(id, target, now) {
    const objective = target >= 0 ? Modes.objectives[target] : null;
    if (objective && (objective.kind === 'point' || objective.kind === 'hill') && this.role[id] !== ROLE.FREELANCE) this.bark(id, 'takingPoint', now);
  },
  // A newly chosen item: a team bot pings it (Dibs) so the team leaves it, at most every ITEM_PING_INTERVAL s.
  onItemGoal(id, x, y, z, now) {
    if (Actors.team[id] < 0 || now - this.itemPingAt[id] < ITEM_PING_INTERVAL) return;
    this.itemPingAt[id] = now;
    this.emitPing(id, 'dibs', x, y, z, -1, -1);
  },
  // Mode call-outs (capture, bomb, flag): the bots playing the objective call it out (the bark limits keep it to one or so),
  // and per team the one nearest its objective pings it (BOT-061).
  onAnnounce(event) {
    if (!OBJECTIVE_ANNOUNCES.has(event.kind)) return;
    const now = Sim.time;
    for (let id = 0; id < Actors.count; id++) if (Bots.active[id] && BotDecide.goal[id] === GOAL.OBJECTIVE) this.bark(id, 'objective', now);
    for (let team = 0; team < TEAM_COUNT; team++) if (now - this.objectivePingAt[team] >= OBJECTIVE_PING_INTERVAL) this.pingObjective(team, now);
  },
  // Attack or defend (spotKind) at the objective, never from inside the 'ping' handler (pingPayload is shared).
  pingObjective(team, now) {
    let pinger = -1, nearest = Infinity;
    for (let id = 0; id < Actors.count; id++) {
      const objective = Bots.active[id] && Actors.team[id] === team && BotDecide.goal[id] === GOAL.OBJECTIVE ? Modes.objectives[BotDecide.goalTarget[id]] : null;
      const distance = objective ? length2(objective.x - Actors.x[id], objective.z - Actors.z[id]) : Infinity;
      if (distance < nearest) { nearest = distance; pinger = id; }
    }
    if (pinger < 0) return;
    const objective = Modes.objectives[BotDecide.goalTarget[pinger]];
    this.objectivePingAt[team] = now;
    this.emitPing(pinger, spotKind(pinger, objective.x, objective.z), objective.x, objective.y, objective.z, -1, -1);
  },

  // ---- Orders (BOT-051): the decision layer asks for the bot's current order as a goal plan ----
  orderPlan(id, plan, now) {
    if (this.orderUntil[id] <= now) return false;
    const kind = this.orderKind[id];
    if (kind === 'follow') return this.followPlan(id, plan, FOLLOW_RADIUS, ACTION.MOVE);
    if (kind === 'cover') return this.followPlan(id, plan, COVER_RADIUS, ACTION.HOLD);
    if (kind === 'go' && length2(this.orderX[id] - Actors.x[id], this.orderZ[id] - Actors.z[id]) < ORDER_RADIUS) { this.orderUntil[id] = 0; return false; }
    setPlan(plan, this.orderX[id], this.orderY[id], this.orderZ[id], ORDER_RADIUS, kind === 'defend' ? ACTION.HOLD : ACTION.MOVE, -1);
    return true;
  },
  // Follow and cover: the live position of the one who gave the order; the order ends when they die.
  followPlan(id, plan, radius, action) {
    const leader = this.orderSource[id];
    if (leader < 0 || !Actors.alive[leader]) { this.orderUntil[id] = 0; return false; }
    setPlan(plan, Actors.x[leader], Actors.y[leader], Actors.z[leader], radius, action, -1);
    return true;
  },
  give(id, kind, x, y, z, now, source) {
    this.orderKind[id] = kind;
    this.orderSource[id] = source;
    this.orderX[id] = x; this.orderY[id] = y; this.orderZ[id] = z;
    this.orderGivenAt[id] = now;
    this.orderUntil[id] = now + ORDER_SECONDS[kind];
    this.queueReply(id, 'orderAck', now);
    this.stats.orders++;
    BotDecide.hurry(id, now);
  },

  // ---- Pings: enemy pings share memory with the team; move pings from a person are orders ----
  onPing(event) {
    const pinger = event.id;
    if (pinger < 0 || pinger >= MAX_ACTORS) return;
    const team = Actors.team[pinger], now = Sim.time;
    const enemyPing = event.kind === 'enemy' || event.kind === 'danger';
    if (enemyPing) this.shareEnemy(pinger, team, event, now);
    if (Bots.active[pinger] || team < 0) return;
    const callout = COMM_CALLOUT_BY_KIND.get(event.kind);
    if (callout && callout.at === 'reply') return;   // Dibs / No / On my way: shown on the HUD, nobody is ordered
    if (this.isAddressed(pinger, team, event.to)) { takerList.length = 0; takerList.push(event.to); }
    else this.chooseTakers(pinger, team, event.x, event.z, !!callout && callout.team === true);
    if (enemyPing) { if (takerList.length > 0) this.queueReply(takerList[0], 'pingReply', now); return; }
    const order = callout && callout.order ? callout.order : 'go';   // a ping kind with no order of its own moves the takers there
    for (let i = 0; i < takerList.length; i++) this.giveOrder(takerList[i], order, event, now);
    // A move ping on an item spot: the first taker calls Dibs on it (said and pinged at ackAt, never inside this handler:
    // pingPayload is shared).
    if (order === 'go' && takerList.length > 0 && BotDecide.itemNear(event.x, event.y, event.z, ITEM_PING_RADIUS) >= 0) this.queueReply(takerList[0], 'dibs', now);
  },
  giveOrder(id, order, event, now) {
    if (order === 'hold') this.give(id, 'defend', Actors.x[id], Actors.y[id], Actors.z[id], now, event.id);
    else this.give(id, order, event.x, event.y, event.z, now, event.id);
  },
  queueReply(id, category, now) {
    this.ackCategory[id] = category;
    this.ackAt[id] = now + Rng.fx.range(ORDER_ACK_MIN, ORDER_ACK_MAX);
  },
  shareEnemy(pinger, team, event, now) {
    if (event.target < 0) return;
    for (let id = 0; id < Actors.count; id++) {
      if (id === pinger || !Bots.isBot(id) || (team >= 0 && Actors.team[id] !== team) || (team < 0 && id !== pinger)) continue;
      BotSense.share(id, event.target, event.x, event.y, event.z, now);
    }
  },
  // The wheel was opened on one team bot: only that bot takes the callout (else the squad does).
  isAddressed(pinger, team, to) { return to >= 0 && to < MAX_ACTORS && to !== pinger && Bots.isBot(to) && Actors.alive[to] && Actors.team[to] === team; },
  // The ORDER_TAKERS living team bots nearest the pinged spot (every one of them for a whole-team callout).
  chooseTakers(pinger, team, x, z, wholeTeam) {
    takerList.length = 0;
    for (let id = 0; id < Actors.count; id++) if (id !== pinger && Bots.isBot(id) && Actors.team[id] === team) takerList.push(id);
    if (wholeTeam) return;
    takerList.sort((a, b) => length2(Actors.x[a] - x, Actors.z[a] - z) - length2(Actors.x[b] - x, Actors.z[b] - z));
    if (takerList.length > ORDER_TAKERS) takerList.length = ORDER_TAKERS;
  },
  // A bot that newly sees an enemy pings it for the team (BOT-061) and calls it out.
  onSpotted(bot, other, now) {
    if (Actors.team[bot] < 0 || now - this.enemyPingAt[bot] < ENEMY_PING_INTERVAL) return;
    this.enemyPingAt[bot] = now;
    this.emitPing(bot, 'enemy', Actors.x[other], Actors.y[other], Actors.z[other], other, -1);
    this.bark(bot, 'spotted', now);
  },
  emitPing(id, kind, x, y, z, target, to) {
    pingPayload.id = id; pingPayload.kind = kind; pingPayload.x = x; pingPayload.y = y; pingPayload.z = z; pingPayload.target = target; pingPayload.to = to;
    this.stats.pings++;
    Bus.emit('ping', pingPayload);
  },
  // The player's ping button: an enemy near the aim line, else the aimed spot as an attack / defend / go order.
  playerPing(player) { this.aimPing(player, '', -1); },
  // A comm wheel callout (index into COMM_CALLOUTS) from a living player, to one team bot or the squad (to -1).
  callout(player, index, to) {
    const row = COMM_CALLOUTS[index];
    if (!row || player < 0 || !Actors.alive[player]) return;
    if (row.at === 'aim') this.aimPing(player, row.id, to);
    else this.emitPing(player, row.id, Actors.x[player], Actors.y[player], Actors.z[player], -1, to);   // a reply with nothing to answer is said here too
  },
  // A reply callout answering the ping that `to` sent at x, y, z.
  reply(player, index, to, x, y, z) {
    const row = COMM_CALLOUTS[index];
    if (!row || row.at !== 'reply' || player < 0 || !Actors.alive[player]) return;
    this.emitPing(player, row.id, x, y, z, -1, to);
  },
  // The team bot the player aims at (the comm wheel addresses it), or -1 for the squad.
  addressee(player) {
    const direction = aimDirectionOf(player);
    return aimedActor(player, direction.x, direction.y, direction.z, false);
  },
  // kind '' = by what is aimed at (enemy, else spotKind); 'enemy' still tags an aimed enemy; any other kind marks the aimed spot.
  aimPing(player, kind, to) {
    const direction = aimDirectionOf(player), dx = direction.x, dy = direction.y, dz = direction.z, eyeY = Actors.eyeY(player);
    const enemy = kind === '' || kind === 'enemy' ? aimedActor(player, dx, dy, dz, true) : -1;
    if (enemy >= 0) { this.emitPing(player, 'enemy', Actors.x[enemy], Actors.y[enemy], Actors.z[enemy], enemy, to); return; }
    const distance = World.raycast(Actors.x[player], eyeY, Actors.z[player], dx, dy, dz, PING_RANGE, pingHit) ? pingHit.distance : PING_RANGE;
    const x = Actors.x[player] + dx * distance, y = eyeY + dy * distance, z = Actors.z[player] + dz * distance;
    this.emitPing(player, kind || spotKind(player, x, z), x, y, z, -1, to);
  },

  // ---- Barks (BOT-100) ----
  bark(id, category, now) {
    const row = BOT_BARKS[category];
    if (!row || !this.mayBark(id, row, now)) return false;
    const profile = Bots.profile[id], chance = BOT_CHAT_CHANCE[profile ? profile.chat : 'normal'] || BOT_CHAT_CHANCE.normal;
    const slot = Actors.team[id] + 1;
    this.barkAt[id] = now;
    if (!row.reply && !Rng.fx.chance(chance)) return false;
    this.teamBarkAt[slot] = now;
    barkPayload.id = id; barkPayload.team = Actors.team[id]; barkPayload.category = category; barkPayload.text = Rng.fx.pick(row.lines);
    this.stats.barks++;
    Bus.emit('bark', barkPayload);
    return true;
  },
  mayBark(id, row, now) {
    if (this.chatter === 'off' || (this.chatter === 'minimal' && !row.minimal) || (row.taunt && !this.taunts)) return false;
    if (row.reply) return true;
    return now - this.barkAt[id] >= BARK_BOT_INTERVAL && now - this.teamBarkAt[Actors.team[id] + 1] >= BARK_TEAM_INTERVAL;
  },
  onKill(event) {
    const now = Sim.time;
    if (event.victim >= 0 && event.victim < MAX_ACTORS) this.passLead(event.victim);
    if (event.victim >= 0 && Bots.active[event.victim]) { this.barkAt[event.victim] = -1e9; this.bark(event.victim, 'death', now); }
    if (event.killer >= 0 && event.killer !== event.victim && Bots.isBot(event.killer)) this.bark(event.killer, 'killTaunt', now);
  },
  // One grenade per team every 3 s (free-for-all bots each have their own clock).
  takeGrenadeToken(id, now) {
    const slot = tokenSlot(id);
    if (now - this.grenadeAt[slot] < GRENADE_TOKEN_INTERVAL) return false;
    this.grenadeAt[slot] = now;
    return true;
  },
  // BOT-053: one of the BOT_TOKENS.attackers slots of the target (the bot's own one first, so it never holds two).
  takeAttackToken(id, target, now) {
    const first = target * BOT_TOKENS.attackers, last = first + BOT_TOKENS.attackers;
    for (let slot = first; slot < last; slot++) if (this.attackHolder[slot] === id) return claimToken(this.attackHolder, this.attackUntil, slot, id, GOAL.ATTACK, now);
    for (let slot = first; slot < last; slot++) if (claimToken(this.attackHolder, this.attackUntil, slot, id, GOAL.ATTACK, now)) return true;
    return false;
  },
  takeFlankToken(id, now) { return claimToken(this.flankHolder, this.flankUntil, tokenSlot(id), id, GOAL.CHASE, now); },
  readSettings(key) {
    if (key === 'gameplay.chatter') this.chatter = Settings.get(key);
    if (key === 'gameplay.taunts') this.taunts = !!Settings.get(key);
  },
};

// The token slot of a bot's team (free-for-all bots each have their own).
function tokenSlot(id) { return Actors.team[id] >= 0 ? Actors.team[id] : TEAM_SLOTS + id; }

// A token is free when its holder let BOT_TOKENS.hold pass without renewing it, died, or no longer plays `goal`.
function claimToken(holders, until, slot, id, goal, now) {
  const holder = holders[slot];
  if (holder >= 0 && holder !== id && now < until[slot] && Actors.alive[holder] && BotDecide.goal[holder] === goal) return false;
  holders[slot] = id;
  until[slot] = now + BOT_TOKENS.hold;
  return true;
}

// The BOT_ROLE_SPLITS row for a team: the mode's objective kind; flags: 'flagTaken' while a team-mate carries the enemy flag.
function roleSplitKey(team) {
  const objective = Modes.rules ? Modes.rules.objective : 'none';
  if (objective !== 'flag') return objective;
  const list = Modes.objectives;
  for (let i = 0; i < list.length; i++) if (list[i].kind === 'flag' && list[i].team === 1 - team && list[i].carrier >= 0) return 'flagTaken';
  return objective;
}
// The unit view direction of the player's aim, in the shared aimDirection record.
function aimDirectionOf(player) {
  const yaw = Actors.aimYaw[player], pitch = Actors.aimPitch[player];
  aimDirection.x = Math.sin(yaw) * Math.cos(pitch); aimDirection.y = Math.sin(pitch); aimDirection.z = Math.cos(yaw) * Math.cos(pitch);
  return aimDirection;
}
// Who a ping or the comm wheel can point at: an enemy (enemies true) or a bot of the player's team.
function aimCandidate(player, id, enemies) {
  if (enemies) return Actors.isEnemy(player, id);
  return Bots.isBot(id) && Actors.team[id] >= 0 && Actors.team[id] === Actors.team[player];
}
// The living candidate nearest the aim line (within PING_AIM_COS) and in sight, or -1.
function aimedActor(player, dx, dy, dz, enemies) {
  let best = -1, bestCos = PING_AIM_COS;
  const eyeY = Actors.eyeY(player);
  for (let id = 0; id < Actors.count; id++) {
    if (id === player || !Actors.alive[id] || !aimCandidate(player, id, enemies)) continue;
    const ox = Actors.x[id] - Actors.x[player], oy = Actors.eyeY(id) - eyeY, oz = Actors.z[id] - Actors.z[player];
    const distance = length3(ox, oy, oz);
    if (distance < 1e-3 || distance > PING_RANGE) continue;
    const cosine = (ox * dx + oy * dy + oz * dz) / distance;
    if (cosine > bestCos && World.lineClear(Actors.x[player], eyeY, Actors.z[player], Actors.x[id], Actors.eyeY(id), Actors.z[id])) { bestCos = cosine; best = id; }
  }
  return best;
}

// Inside an objective zone: defend it when the player's team owns it (or it is the team's flag), else attack it.
function spotKind(player, x, z) {
  const team = Actors.team[player];
  for (const objective of Modes.objectives) {
    if (length2(objective.x - x, objective.z - z) > Math.max(objective.radius, ORDER_RADIUS)) continue;
    return objective.owner === team || objective.team === team ? 'defend' : 'attack';
  }
  return 'go';
}

GOAL_SCORERS[GOAL.SQUAD] = (id, plan) => BotTeam.squadPlan(id, plan);

// ---- Bot shopping (BOT-001: decided in the brain, bought through Economy.buy like the player's buy menu) ----
// One pass per buy window (round buy time in the buy zone, an open wave shop), by BOT_BUY. The items, prices and limits
// are the match catalogue's (Economy.catalogue / limitReason), so every mode rule on what a side may buy holds for bots.
const BOT_BUY_CHECK = 0.5;              // s between the checks for an open buy window
const BotEconomy = {
  checkAt: new Float64Array(MAX_ACTORS),
  shoppedWindow: new Float64Array(MAX_ACTORS),   // the Economy.buyWindow the bot last shopped in (one pass per window)

  update(id, now) {
    if (now < this.checkAt[id]) return;
    this.checkAt[id] = now + BOT_BUY_CHECK;
    if (!Economy.usesMoney() || !Economy.canBuy(id)) return;
    const buyWindow = Economy.buyWindow(id);
    if (this.shoppedWindow[id] === buyWindow) return;
    this.shoppedWindow[id] = buyWindow;
    this.shop(id);
  },
  shop(id) {
    if (Economy.preset().buy === 'round') {
      if (Economy.money(id) < BOT_BUY.ecoMoney * (0.75 + 0.5 * Bots.trait(id, TRAIT.selfPreservation))) return;   // an eco round
      this.buyBest(id, gunWorth);
      this.buyBest(id, armourWorth);
      if (Bots.tier(id).gadgets) this.buyBest(id, grenadeWorth);
      return;
    }
    if (anyGunLow(id)) this.buyBest(id, ammoWorth);
    if (Bots.tier(id).gadgets) this.buyBest(id, placedGadgetWorth);
  },
  // Buys the catalogue item `worth` values most (0 = not wanted) that the bot may buy now and can pay for.
  buyBest(id, worth) {
    const list = Economy.catalogue(), money = Economy.money(id);
    let best = null, bestValue = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (Economy.priceFor(id, item) > money || Economy.limitReason(id, item)) continue;   // the player's price (a helmet over a vest costs less)
      const value = worth(id, item, money);
      if (value > bestValue) { bestValue = value; best = item; }
    }
    return best !== null && Economy.buy(id, best.id).ok;
  },
};

// A gun (not a melee weapon) worth BOT_BUY.upgrade more than the best one the bot owns, by botPref and the favourite.
function gunWorth(id, item) {
  if (item.kind !== 'weapon' || item.weaponClass === 'melee') return 0;
  const value = BotCombat.weaponValue(id, CAT.weapons.byId(item.key), 1);
  return value >= bestOwnedGun(id) + BOT_BUY.upgrade ? value : 0;
}
function bestOwnedGun(id) {
  let best = 0;
  for (let index = 0; index < WEAPON_COUNT; index++) {
    const weapon = CAT.weapons[index];
    if (weapon.class !== 'melee' && Weapons.owned[Weapons.slotIndex(id, index)]) best = Math.max(best, BotCombat.weaponValue(id, weapon, 1));
  }
  return best;
}
// The best armour on sale (the dearer row protects more: vest and helmet over the vest).
function armourWorth(id, item) { return item.kind === 'armor' || item.kind === 'helmet' ? item.price : 0; }
// The cheapest grenade (a pass buys one item per worth; Economy.limitReason holds the grenade group limit).
function grenadeWorth(id, item) { return item.kind === 'gadget' && item.group === 'grenade' ? 1 / item.price : 0; }
function ammoWorth(id, item) { return item.kind === 'ammo' ? 1 : 0; }
// Wave shop: a placed gadget (barrier, turret) while BOT_BUY.shopKeep credits stay for the next refill.
function placedGadgetWorth(id, item, money) { return item.kind === 'gadget' && money - item.price >= BOT_BUY.shopKeep ? item.price : 0; }
// Any gun the bot carries that runs low (BotCombat.gunLow).
function anyGunLow(id) {
  for (let index = 0; index < WEAPON_COUNT; index++) if (Weapons.owned[Weapons.slotIndex(id, index)] && BotCombat.gunLow(id, index)) return true;
  return false;
}

// A fresh start every match, so the same seed plays the same match: at match setup every typed array of the bot modules
// (14a..14f: clocks, aim noise, scan order, paths, plans) goes back to its load-time contents. Copies taken once, at load.
const BOT_FRESH_STATE = [Bots, BotSense, BotMove, BotCombat, BotDecide, BotTeam, BotEconomy].flatMap((module) =>
  Object.values(module).filter((value) => ArrayBuffer.isView(value)).map((array) => ({ array, initial: array.slice() })));

Bus.on('match.setup', () => { for (const entry of BOT_FRESH_STATE) entry.array.set(entry.initial); });
Bus.on('match.start', () => BotTeam.onMatchStart());
Bus.on('nav.ready', () => { for (let team = 0; team < TEAM_COUNT; team++) BotTeam.placeRally(team); });   // a sliced build finished after match start
Bus.on('actor.spawn', (event) => BotTeam.onSpawn(event.id));
Bus.on('ping', (event) => BotTeam.onPing(event));
Bus.on('kill', (event) => BotTeam.onKill(event));
Bus.on('announce', (event) => BotTeam.onAnnounce(event));
Bus.on('setting', (key) => BotTeam.readSettings(key));
