// Bot team play (BOT-050, BOT-051, BOT-060..BOT-062, BOT-100): a commander per team hands out roles every 15 s (attack, defend, escort by
// the mode's objective kind, BOT_ROLE_SPLITS); the player's pings and comm wheel callouts (COMM_CALLOUTS, wheel in 17g) are
// orders that the nearest team bots (the whole team for follow / hold / regroup) acknowledge and
// follow (acknowledged within 0.5-1.5 s; the nearest team bot answers an enemy ping the same way); bots ping enemies they spot (shared memory for the team, at most once per 4 s per bot) and talk in short text
// barks (BOT-100 limits: 5 s per bot, 1.5 s per team; chatter setting off / minimal / normal, taunts option).
// Grenade tokens keep a team from throwing more than one every 3 s. Flag raids: attackers gather at a rally point and push
// together (BOT_FLAG_PUSH).

const ROLE = { FREELANCE: 0, ATTACK: 1, DEFEND: 2, ESCORT: 3 };
const ROLE_NAMES = Object.keys(ROLE).map((name) => name.toLowerCase());
const COMMANDER_INTERVAL = 15;
const ENEMY_PING_INTERVAL = 4;
const BARK_BOT_INTERVAL = 5, BARK_TEAM_INTERVAL = 1.5;
const GRENADE_TOKEN_INTERVAL = 3;
const TEAM_SLOTS = TEAM_COUNT + 1;      // index 0 = no team, then the teams
const ORDER_ACK_MIN = 0.5, ORDER_ACK_MAX = 1.5;   // BOT-051: an order is acknowledged within 0.5-1.5 s
const ORDER_SECONDS = { go: 30, attack: 30, defend: 45, follow: 60 };
const ORDER_TAKERS = 2;                 // the nearest bots of the team answer a move order
const ORDER_RADIUS = 2.5;
const FOLLOW_RADIUS = 3;                // a following bot keeps this close to the one it follows
// BOT-061/062 comm wheel callouts, clockwise from the top. id = the ping kind; at: 'aim' (the aimed spot or enemy) or 'self'
// (the caller's feet); order = what the takers do ('' = information only; 'hold' = defend where each taker stands); team = every team bot takes it.
const COMM_CALLOUTS = [
  { id: 'attack', label: 'Attack', at: 'aim', order: 'attack' },
  { id: 'defend', label: 'Defend', at: 'aim', order: 'defend' },
  { id: 'follow', label: 'Follow me', at: 'self', order: 'follow', team: true },
  { id: 'hold', label: 'Hold position', at: 'self', order: 'hold', team: true },
  { id: 'regroup', label: 'Regroup', at: 'self', order: 'go', team: true },
  { id: 'danger', label: 'Danger', at: 'aim', order: '' },
  { id: 'enemy', label: 'Enemy', at: 'aim', order: '' },
  { id: 'go', label: 'Go here', at: 'aim', order: 'go' },
];
const COMM_CALLOUT_BY_KIND = new Map(COMM_CALLOUTS.map((row) => [row.id, row]));
const PING_RANGE = 120;
const PING_AIM_COS = Math.cos(4 * DEG);  // an enemy this close to the aim line is the ping's target
const HELP_HEALTH = 0.5, HELP_RECENT = 0.15;
const CHATTER_LEVELS = ['off', 'minimal', 'normal'];
const PUSH_CHECK_INTERVAL = 0.5;

Settings.define('gameplay.chatter', 'normal', { label: 'Bot chatter', category: 'gameplay', options: CHATTER_LEVELS });
Settings.define('gameplay.taunts', true, { label: 'Bot taunts', category: 'gameplay' });

const pingPayload = { id: -1, kind: '', x: 0, y: 0, z: 0, target: -1 };
const barkPayload = { id: -1, team: NO_TEAM, category: '', text: '' };
const pingHit = { distance: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, brush: null };
const rankList = [];
const takerList = [];

const BotTeam = {
  role: new Uint8Array(MAX_ACTORS),
  orderKind: new Array(MAX_ACTORS).fill(''), orderUntil: new Float64Array(MAX_ACTORS),
  orderX: new Float32Array(MAX_ACTORS), orderY: new Float32Array(MAX_ACTORS), orderZ: new Float32Array(MAX_ACTORS),
  orderSource: new Int16Array(MAX_ACTORS).fill(-1),   // who gave the order (a follow order tracks them)
  orderGivenAt: new Float64Array(MAX_ACTORS), ackAt: new Float64Array(MAX_ACTORS), answeredAt: new Float64Array(MAX_ACTORS),
  ackCategory: new Array(MAX_ACTORS).fill('orderAck'),   // the reply bark due at ackAt
  enemyPingAt: new Float64Array(MAX_ACTORS).fill(-1e9), barkAt: new Float64Array(MAX_ACTORS).fill(-1e9),
  teamBarkAt: new Float64Array(TEAM_SLOTS).fill(-1e9),
  grenadeAt: new Float64Array(TEAM_SLOTS + MAX_ACTORS).fill(-1e9),
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
    this.enemyPingAt.fill(-1e9);
    this.barkAt.fill(-1e9);
    this.teamBarkAt.fill(-1e9);
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
      if (Math.hypot(Actors.x[id] - this.rallyX[team], Actors.z[id] - this.rallyZ[team]) <= BOT_FLAG_PUSH.radius) gathered++;
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
  },

  // ---- Per bot after its decision: delayed acknowledgements and situational barks ----
  updateBot(id, now) {
    if (this.ackAt[id] > 0 && now >= this.ackAt[id]) { this.ackAt[id] = 0; this.bark(id, this.ackCategory[id], now); }
    const health = Actors.health[id] / Math.max(1, Actors.maxHealth[id]);
    if (health < LOW_HEALTH_FRACTION && !this.lowBarked[id] && this.bark(id, 'lowHealth', now)) this.lowBarked[id] = 1;
    if (health < HELP_HEALTH && now - BotSense.attackedAt[id] < HELP_RECENT) this.bark(id, 'needHelp', now);
    if (this.orderUntil[id] > now && BotDecide.goal[id] === GOAL.ORDER && this.answeredAt[id] < this.orderGivenAt[id]) this.answeredAt[id] = now;
  },

  // ---- Orders (BOT-051): the decision layer asks for the bot's current order as a goal plan ----
  orderPlan(id, plan, now) {
    if (this.orderUntil[id] <= now) return false;
    const kind = this.orderKind[id];
    if (kind === 'follow') return this.followPlan(id, plan);
    if (kind === 'go' && Math.hypot(this.orderX[id] - Actors.x[id], this.orderZ[id] - Actors.z[id]) < ORDER_RADIUS) { this.orderUntil[id] = 0; return false; }
    setPlan(plan, this.orderX[id], this.orderY[id], this.orderZ[id], ORDER_RADIUS, kind === 'defend' ? ACTION.HOLD : ACTION.MOVE, -1);
    return true;
  },
  // Follow: the live position of the one who gave the order; the order ends when they die.
  followPlan(id, plan) {
    const leader = this.orderSource[id];
    if (leader < 0 || !Actors.alive[leader]) { this.orderUntil[id] = 0; return false; }
    setPlan(plan, Actors.x[leader], Actors.y[leader], Actors.z[leader], FOLLOW_RADIUS, ACTION.MOVE, -1);
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
    this.chooseTakers(pinger, team, event.x, event.z, !!callout && callout.team === true);
    if (enemyPing) { if (takerList.length > 0) this.queueReply(takerList[0], 'pingReply', now); return; }
    const order = callout && callout.order ? callout.order : 'go';   // a ping kind with no order of its own moves the takers there
    for (let i = 0; i < takerList.length; i++) this.giveOrder(takerList[i], order, event, now);
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
  // The ORDER_TAKERS living team bots nearest the pinged spot (every one of them for a whole-team callout).
  chooseTakers(pinger, team, x, z, wholeTeam) {
    takerList.length = 0;
    for (let id = 0; id < Actors.count; id++) if (id !== pinger && Bots.isBot(id) && Actors.team[id] === team) takerList.push(id);
    if (wholeTeam) return;
    takerList.sort((a, b) => Math.hypot(Actors.x[a] - x, Actors.z[a] - z) - Math.hypot(Actors.x[b] - x, Actors.z[b] - z));
    if (takerList.length > ORDER_TAKERS) takerList.length = ORDER_TAKERS;
  },
  // A bot that newly sees an enemy pings it for the team (BOT-061) and calls it out.
  onSpotted(bot, other, now) {
    if (Actors.team[bot] < 0 || now - this.enemyPingAt[bot] < ENEMY_PING_INTERVAL) return;
    this.enemyPingAt[bot] = now;
    this.emitPing(bot, 'enemy', Actors.x[other], Actors.y[other], Actors.z[other], other);
    this.bark(bot, 'spotted', now);
  },
  emitPing(id, kind, x, y, z, target) {
    pingPayload.id = id; pingPayload.kind = kind; pingPayload.x = x; pingPayload.y = y; pingPayload.z = z; pingPayload.target = target;
    this.stats.pings++;
    Bus.emit('ping', pingPayload);
  },
  // The player's ping button: an enemy near the aim line, else the aimed spot as an attack / defend / go order.
  playerPing(player) { this.aimPing(player, ''); },
  // A comm wheel callout (index into COMM_CALLOUTS) from a living player.
  callout(player, index) {
    const row = COMM_CALLOUTS[index];
    if (!row || player < 0 || !Actors.alive[player]) return;
    if (row.at === 'self') this.emitPing(player, row.id, Actors.x[player], Actors.y[player], Actors.z[player], -1);
    else this.aimPing(player, row.id);
  },
  // kind '' = by what is aimed at (enemy, else spotKind); 'enemy' still tags an aimed enemy; any other kind marks the aimed spot.
  aimPing(player, kind) {
    const yaw = Actors.aimYaw[player], pitch = Actors.aimPitch[player], eyeY = Actors.eyeY(player);
    const dx = Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(yaw) * Math.cos(pitch);
    const enemy = kind === '' || kind === 'enemy' ? aimedEnemy(player, dx, dy, dz) : -1;
    if (enemy >= 0) { this.emitPing(player, 'enemy', Actors.x[enemy], Actors.y[enemy], Actors.z[enemy], enemy); return; }
    const distance = World.raycast(Actors.x[player], eyeY, Actors.z[player], dx, dy, dz, PING_RANGE, pingHit) ? pingHit.distance : PING_RANGE;
    const x = Actors.x[player] + dx * distance, y = eyeY + dy * distance, z = Actors.z[player] + dz * distance;
    this.emitPing(player, kind || spotKind(player, x, z), x, y, z, -1);
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
    if (event.victim >= 0 && Bots.active[event.victim]) { this.barkAt[event.victim] = -1e9; this.bark(event.victim, 'death', now); }
    if (event.killer >= 0 && event.killer !== event.victim && Bots.isBot(event.killer)) this.bark(event.killer, 'killTaunt', now);
  },
  // One grenade per team every 3 s (free-for-all bots each have their own clock).
  takeGrenadeToken(id, now) {
    const slot = Actors.team[id] >= 0 ? Actors.team[id] : TEAM_SLOTS + id;
    if (now - this.grenadeAt[slot] < GRENADE_TOKEN_INTERVAL) return false;
    this.grenadeAt[slot] = now;
    return true;
  },
  readSettings(key) {
    if (key === 'gameplay.chatter') this.chatter = Settings.get(key);
    if (key === 'gameplay.taunts') this.taunts = !!Settings.get(key);
  },
};

// The BOT_ROLE_SPLITS row for a team: the mode's objective kind; flags: 'flagTaken' while a team-mate carries the enemy flag.
function roleSplitKey(team) {
  const objective = Modes.rules ? Modes.rules.objective : 'none';
  if (objective !== 'flag') return objective;
  const list = Modes.objectives;
  for (let i = 0; i < list.length; i++) if (list[i].kind === 'flag' && list[i].team === 1 - team && list[i].carrier >= 0) return 'flagTaken';
  return objective;
}
function aimedEnemy(player, dx, dy, dz) {
  let best = -1, bestCos = PING_AIM_COS;
  const eyeY = Actors.eyeY(player);
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || !Actors.isEnemy(player, id)) continue;
    const ox = Actors.x[id] - Actors.x[player], oy = Actors.eyeY(id) - eyeY, oz = Actors.z[id] - Actors.z[player];
    const distance = Math.hypot(ox, oy, oz);
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
    if (Math.hypot(objective.x - x, objective.z - z) > Math.max(objective.radius, ORDER_RADIUS)) continue;
    return objective.owner === team || objective.team === team ? 'defend' : 'attack';
  }
  return 'go';
}

// A fresh start every match, so the same seed plays the same match: at match setup every typed array of the bot modules
// (14a..14f: clocks, aim noise, scan order, paths, plans) goes back to its load-time contents. Copies taken once, at load.
const BOT_FRESH_STATE = [Bots, BotSense, BotMove, BotCombat, BotDecide, BotTeam].flatMap((module) =>
  Object.values(module).filter((value) => ArrayBuffer.isView(value)).map((array) => ({ array, initial: array.slice() })));

Bus.on('match.setup', () => { for (const entry of BOT_FRESH_STATE) entry.array.set(entry.initial); });
Bus.on('match.start', () => BotTeam.onMatchStart());
Bus.on('actor.spawn', (event) => BotTeam.onSpawn(event.id));
Bus.on('ping', (event) => BotTeam.onPing(event));
Bus.on('kill', (event) => BotTeam.onKill(event));
Bus.on('setting', (key) => BotTeam.readSettings(key));
