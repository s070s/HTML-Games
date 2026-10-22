// Bot perception and memory (BOT-003..BOT-007, BOT-040, BOT-091): a view cone per tier, line-of-sight rays from a shared
// budget (<= 96 per tick, combat pairs first, then round-robin), hearing from 'sound' events, damage direction from
// 'damage' events, pinged enemies from teammates, and a short memory of last known positions. Nothing else feeds a bot:
// a bot never reacts to an actor it did not see, hear, feel or get pinged about (no wallhack at any tier).

const SENSE = { NONE: 0, SEEN: 1, HEARD: 2, HURT: 3, PINGED: 4 };
const SENSE_RANGE_BASE = 25;            // BOT-003: vision range 25 + 75 x alertness metres
const SENSE_RANGE_ALERT = 75;
const SENSE_CROUCH = 0.7, SENSE_PRONE = 0.4, SENSE_STILL = 0.6, SENSE_CLOAK = 0.25;   // BOT-003 visibility factors
const SENSE_STILL_SPEED = 0.5;          // m/s: slower counts as standing still
const SENSE_UP_UNAWARE = 20 * DEG;      // BOT-005: the vertical cone reaches 20 deg up unaware, 60 deg alerted
const SENSE_UP_ALERT = 60 * DEG;
const SENSE_DOWN = 60 * DEG;
const SENSE_ALERTED = 0.6;              // alert meter from which the bot counts as alerted
const SENSE_CENTRAL = 0.6;              // inside 60% of the half field of view: seen at once; outside: peripheral (slower)
const SENSE_FILL_NEAR = 0.6, SENSE_FILL_FAR = 2.5;   // BOT-005: seconds for the peripheral meter to fill, near to far
const SENSE_AWARE_DECAY_AFTER = 6;      // BOT-005: the meter decays after 6 s unseen...
const SENSE_AWARE_DECAY_RATE = 0.5;     // ...at this many units per second
const SENSE_MEMORY = 10;                // BOT-007: last known positions decay after 10 s
const SENSE_RAYS_PER_TICK = 96;         // BOT-091: vision and hearing rays together, per tick
const SENSE_HEARING_RESERVE = 16;       // of those, vision leaves this many for sounds behind walls (out of budget = not heard)
const SENSE_HEARING_BASE = 0.5;         // radius x (0.5 + hearing trait): a neutral trait hears the full radius
const SENSE_WALL_FACTOR = 0.6;          // BOT-004: through walls the radius shrinks to 60%
const SENSE_HEAR_ERROR = 0.15;          // BOT-004: heard position uncertain by 15% of the distance
const SENSE_HURT_ERROR = 0.25;          // a hit tells the direction, the distance only roughly
const SENSE_REACTION_FLOOR = 0.15;      // BOT-006: never faster than 150 ms
const SENSE_REACTION_JITTER = 0.2;      // +-20% seeded jitter
const SENSE_REACQUIRE = 0.5;            // re-acquiring a target lost less than 2 s ago takes half the reaction time
const SENSE_REACQUIRE_WINDOW = 2;
const SENSE_FAST_REACTION = 0.7, SENSE_SLOW_REACTION = 1.3;   // reaction trait 1 .. 0 scales the tier reaction time
const SENSE_HURT_ALERT = 1;
const SENSE_MINE_RANGE = 8;             // m: an enemy placed gadget (mine) is noticed this close, in sight (its glint, GAD-003)
const SENSE_GRENADE_DANGER = 6;         // m: an enemy grenade heard landing this close is run from...
const SENSE_GRENADE_FLEE = 1.5;         // ...for this many seconds
const PAIR_COUNT = MAX_ACTORS * MAX_ACTORS;

const senseTarget = Vec.make();

const BotSense = {
  visible: new Uint8Array(PAIR_COUNT),
  source: new Uint8Array(PAIR_COUNT),
  seenAt: new Float64Array(PAIR_COUNT).fill(-1e9),
  knownAt: new Float64Array(PAIR_COUNT).fill(-1e9),
  sightStart: new Float64Array(PAIR_COUNT), lostAt: new Float64Array(PAIR_COUNT).fill(-1e9),
  reactAt: new Float64Array(PAIR_COUNT),
  knownX: new Float32Array(PAIR_COUNT), knownY: new Float32Array(PAIR_COUNT), knownZ: new Float32Array(PAIR_COUNT),
  knownVX: new Float32Array(PAIR_COUNT), knownVZ: new Float32Array(PAIR_COUNT),
  awareness: new Float32Array(PAIR_COUNT),
  checkedTick: new Int32Array(PAIR_COUNT).fill(-1),
  rayPart: new Uint8Array(PAIR_COUNT),      // alternates the ray end between chest and head (peeking heads count)
  alert: new Float32Array(MAX_ACTORS),      // BOT-005 awareness meter of the bot as a whole (0..1)
  cursor: new Uint8Array(MAX_ACTORS),       // round-robin start of the next scan
  heardAt: new Float64Array(MAX_ACTORS).fill(-1e9), heardX: new Float32Array(MAX_ACTORS), heardY: new Float32Array(MAX_ACTORS), heardZ: new Float32Array(MAX_ACTORS),
  attacker: new Int8Array(MAX_ACTORS).fill(-1), attackedAt: new Float64Array(MAX_ACTORS).fill(-1e9),
  mine: new Int8Array(MAX_ACTORS).fill(-1),  // nearest enemy placed gadget in sight (Devices index), -1 none
  dangerUntil: new Float64Array(MAX_ACTORS), dangerX: new Float32Array(MAX_ACTORS), dangerZ: new Float32Array(MAX_ACTORS),
  raysLeft: 0,
  reservedRays: 0,          // rays per tick a later section takes out of the BOT-091 budget (S15 PvE enemies while they run)
  // raysThisTick counts from one vision pass to the next, so the sounds of a tick (heard after the pass) count with it.
  stats: { rays: 0, raysThisTick: 0, maxRaysPerTick: 0, deferred: 0, heard: 0, hearingRays: 0 },

  pair(bot, other) { return bot * MAX_ACTORS + other; },
  sees(bot, other) { return this.visible[bot * MAX_ACTORS + other] === 1; },
  knows(bot, other, now) { return now - this.knownAt[bot * MAX_ACTORS + other] < SENSE_MEMORY; },
  alerted(bot) { return this.alert[bot] >= SENSE_ALERTED; },
  // Where the bot believes another actor is (BOT-040): the live position while in sight, else the remembered one.
  perceivedPosition(bot, other, out) {
    if (this.sees(bot, other)) { out.x = Actors.x[other]; out.y = Actors.y[other]; out.z = Actors.z[other]; return out; }
    const pair = bot * MAX_ACTORS + other;
    out.x = this.knownX[pair]; out.y = this.knownY[pair]; out.z = this.knownZ[pair];
    return out;
  },
  resetBot(bot) {
    const start = bot * MAX_ACTORS, end = start + MAX_ACTORS;
    this.visible.fill(0, start, end); this.source.fill(0, start, end); this.awareness.fill(0, start, end);
    this.seenAt.fill(-1e9, start, end); this.knownAt.fill(-1e9, start, end); this.lostAt.fill(-1e9, start, end);
    this.alert[bot] = 0; this.heardAt[bot] = -1e9; this.attacker[bot] = -1; this.attackedAt[bot] = -1e9;
    this.mine[bot] = -1; this.dangerUntil[bot] = 0;
  },
  // An actor that dies or leaves is no longer seen by anybody (its memory entries fade normally).
  forgetActor(other) {
    for (let bot = 0; bot < MAX_ACTORS; bot++) this.visible[bot * MAX_ACTORS + other] = 0;
  },

  // ---- Vision (once per tick from the 'botThink' system) ----
  serve(now) {
    this.closeRayCount();
    this.raysLeft = SENSE_RAYS_PER_TICK - this.reservedRays;
    for (let bot = 0; bot < Actors.count; bot++) {
      const target = BotCombat.target[bot];
      if (Bots.perceiveDue[bot] && Bots.isBot(bot) && target >= 0) this.look(bot, target, now);   // combat pairs first
    }
    for (let bot = 0; bot < Actors.count; bot++) {
      if (Bots.perceiveDue[bot] && Bots.isBot(bot)) this.scan(bot, now);
    }
    this.stats.maxRaysPerTick = Math.max(this.stats.maxRaysPerTick, this.stats.raysThisTick);
  },
  closeRayCount() {
    this.stats.maxRaysPerTick = Math.max(this.stats.maxRaysPerTick, this.stats.raysThisTick);
    this.stats.raysThisTick = 0;
  },
  spendRay() {
    this.raysLeft--;
    this.stats.rays++; this.stats.raysThisTick++;
  },
  // Checks every other actor from the bot's cursor on; stops (and resumes next tick) when the ray budget is spent.
  scan(bot, now) {
    const count = Actors.count;
    for (let step = 0; step < count; step++) {
      const other = (this.cursor[bot] + step) % count;
      if (this.checkedTick[this.pair(bot, other)] === Sim.tick) continue;
      if (!this.look(bot, other, now)) { this.cursor[bot] = other; this.stats.deferred++; return; }
    }
    this.cursor[bot] = 0;
    this.finishScan(bot, now);
  },
  // One pair: cheap tests first, then (budget allowing) the ray. Returns false only when the budget ran out.
  look(bot, other, now) {
    const pair = this.pair(bot, other);
    this.checkedTick[pair] = Sim.tick;
    if (!this.canSee(bot, other)) { this.lose(pair, now); return true; }
    const view = this.viewClass(bot, other);
    if (view === 0) { this.lose(pair, now); return true; }
    if (this.raysLeft <= SENSE_HEARING_RESERVE) { this.checkedTick[pair] = -1; return false; }
    this.spendRay();
    if (!this.lineOpen(bot, other, pair)) { this.lose(pair, now); return true; }
    this.perceive(bot, other, pair, view, now);
    return true;
  },
  canSee(bot, other) {
    return other !== bot && Actors.alive[other] === 1 && Actors.kind[other] !== ACTOR_KIND.NONE && Actors.isEnemy(bot, other);
  },
  // 0 = outside the cone or range, 1 = peripheral, 2 = central.
  viewClass(bot, other) {
    const dx = Actors.x[other] - Actors.x[bot], dz = Actors.z[other] - Actors.z[bot];
    const dy = Actors.y[other] + Actors.height[other] * 0.6 - Actors.eyeY(bot);
    const flat = Math.hypot(dx, dz), distance = Math.hypot(flat, dy);
    if (distance > this.range(bot, other)) return 0;
    if (distance < 1) return 2;
    const yaw = Actors.yaw[bot];
    const cosine = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / Math.max(flat, 1e-6);
    const halfFov = Bots.tier(bot).fov * DEG / 2;
    if (flat > 0.5 && cosine < Math.cos(halfFov)) return 0;
    const elevation = Math.atan2(dy, flat) - Actors.pitch[bot];
    if (elevation > (this.alerted(bot) ? SENSE_UP_ALERT : SENSE_UP_UNAWARE) || elevation < -SENSE_DOWN) return 0;
    return cosine >= Math.cos(halfFov * SENSE_CENTRAL) ? 2 : 1;
  },
  // BOT-003 range = (25 + 75 x alertness) x stance x movement x cloak. Light levels are not modelled (factor 1).
  range(bot, other) {
    let factor = 1;
    const flags = Actors.flags[other];
    if (flags & ACTOR_FLAG.PRONE) factor *= SENSE_PRONE;
    else if (flags & ACTOR_FLAG.CROUCHED) factor *= SENSE_CROUCH;
    if (Math.hypot(Actors.vx[other], Actors.vz[other]) < SENSE_STILL_SPEED) factor *= SENSE_STILL;
    factor *= Math.min(Items.perceptionScale(other), flags & ACTOR_FLAG.INVISIBLE ? SENSE_CLOAK : 1);   // PU04 cloak, cloaking abilities
    return this.viewRange(bot) * factor;
  },
  // The range against a standing, moving, visible actor (the F9 view draws it as the cone's length).
  viewRange(bot) { return SENSE_RANGE_BASE + SENSE_RANGE_ALERT * Bots.trait(bot, TRAIT.alertness); },
  // Eye to chest or head (alternating per check); walls and smoke (factor 0) block.
  lineOpen(bot, other, pair) {
    this.rayPart[pair] ^= 1;
    Hitbox.point(other, this.rayPart[pair] ? ZONE.HEAD : ZONE.BODY, senseTarget);
    const ex = Actors.x[bot], ey = Actors.eyeY(bot), ez = Actors.z[bot];
    if (!World.lineClear(ex, ey, ez, senseTarget.x, senseTarget.y, senseTarget.z)) return false;
    return !Smoke.lineBlocked(ex, ey, ez, senseTarget.x, senseTarget.y, senseTarget.z, bot);   // H07 smokeVision sees through
  },
  // In view with a clear line: central vision sees at once, peripheral vision fills the meter first (BOT-005).
  perceive(bot, other, pair, view, now) {
    if (view === 1 && this.visible[pair] === 0) {
      const distance = Math.hypot(Actors.x[other] - Actors.x[bot], Actors.z[other] - Actors.z[bot]);
      const fill = lerp(SENSE_FILL_NEAR, SENSE_FILL_FAR, clamp(distance / this.range(bot, other), 0, 1)) / (0.5 + Bots.trait(bot, TRAIT.alertness));
      this.awareness[pair] = Math.min(1, this.awareness[pair] + (now - Bots.lastPerceive[bot] + BOT_PERCEIVE_NORMAL * 0.5) / fill);
      if (this.awareness[pair] < 1) return;
    }
    this.awareness[pair] = 1;
    if (this.visible[pair] === 0) this.acquire(bot, other, pair, now);
    this.visible[pair] = 1;
    this.remember(pair, SENSE.SEEN, Actors.x[other], Actors.y[other], Actors.z[other], now);
    this.knownVX[pair] = Actors.vx[other]; this.knownVZ[pair] = Actors.vz[other];
    this.seenAt[pair] = now;
    this.alert[bot] = 1;
  },
  // A new sighting: BOT-006 reaction time (tier x trait x difficulty, +-20% jitter, floor 150 ms; half on re-acquire).
  acquire(bot, other, pair, now) {
    const reacquire = now - this.lostAt[pair] < SENSE_REACQUIRE_WINDOW;
    let seconds = Bots.tier(bot).reaction / 1000 * lerp(SENSE_SLOW_REACTION, SENSE_FAST_REACTION, Bots.trait(bot, TRAIT.reaction)) * Bots.reactionScale();
    seconds *= 1 + Rng.bots.range(-SENSE_REACTION_JITTER, SENSE_REACTION_JITTER);
    if (reacquire) seconds *= SENSE_REACQUIRE;
    this.reactAt[pair] = now + Math.max(SENSE_REACTION_FLOOR, seconds);
    this.sightStart[pair] = now;
    BotTeam.onSpotted(bot, other, now);
  },
  lose(pair, now) {
    if (this.visible[pair]) this.lostAt[pair] = now;
    this.visible[pair] = 0;
    if (now - this.seenAt[pair] > SENSE_AWARE_DECAY_AFTER) this.awareness[pair] = Math.max(0, this.awareness[pair] - SENSE_AWARE_DECAY_RATE * BOT_PERCEIVE_NORMAL);
  },
  remember(pair, how, x, y, z, now) {
    this.knownX[pair] = x; this.knownY[pair] = y; this.knownZ[pair] = z;
    this.knownAt[pair] = now;
    this.source[pair] = how;
  },
  finishScan(bot, now) {
    this.mine[bot] = Devices.count > 0 ? this.nearestMine(bot) : -1;
    const quiet = now - this.attackedAt[bot] > SENSE_AWARE_DECAY_AFTER && now - this.heardAt[bot] > SENSE_AWARE_DECAY_AFTER;
    if (quiet && BotCombat.target[bot] < 0) this.alert[bot] = Math.max(0, this.alert[bot] - SENSE_AWARE_DECAY_RATE * (now - Bots.lastPerceive[bot]));
    Bots.schedulePerception(bot, now);
  },

  // Enemy placed gadgets show only as a glint in sight within 8 m (Gadgets.visibleTo); each check is one budgeted ray.
  nearestMine(bot) {
    let best = -1, bestDistance = SENSE_MINE_RANGE;
    for (let device = 0; device < DEVICE_CAP; device++) {
      if (!Devices.active[device] || CAT.gadgets[Devices.row[device]].kind !== 'placed' || Devices.friendOf(device, bot)) continue;
      const distance = Math.hypot(Devices.x[device] - Actors.x[bot], Devices.z[device] - Actors.z[bot]);
      if (distance >= bestDistance || this.raysLeft <= 0) continue;
      this.spendRay();
      if (Gadgets.visibleTo(device, bot)) { best = device; bestDistance = distance; }
    }
    return best;
  },
  // Actors in a hunted role (Colossus, cursed, prize carriers) carry a marker everyone sees: their place is known.
  noticeMarked(bot, now) {
    for (let other = 0; other < Actors.count; other++) {
      if (!huntedRole(other) || !this.canSee(bot, other) || this.visible[this.pair(bot, other)]) continue;
      this.remember(this.pair(bot, other), SENSE.PINGED, Actors.x[other], Actors.y[other], Actors.z[other], now);
    }
  },

  // ---- Hearing (BOT-004): every 'sound' event within radius x hearing trait; through walls x0.6 ----
  hear(event) {
    if (!Bots.anyActive) return;
    const now = Sim.time;
    for (let bot = 0; bot < Actors.count; bot++) {
      if (!Bots.isBot(bot) || bot === event.source) continue;
      if (event.source >= 0 && !Actors.isEnemy(bot, event.source)) continue;
      this.hearOne(bot, event, now);
    }
  },
  hearOne(bot, event, now) {
    const ex = Actors.x[bot], ey = Actors.eyeY(bot), ez = Actors.z[bot];
    const distance = Math.hypot(event.x - ex, event.y - ey, event.z - ez);
    const radius = event.radius * (SENSE_HEARING_BASE + Bots.trait(bot, TRAIT.hearing));
    if (distance > radius) return;
    if (distance > radius * SENSE_WALL_FACTOR && !this.hearingLineOpen(ex, ey, ez, event)) return;
    const error = distance * SENSE_HEAR_ERROR;
    const x = event.x + Rng.bots.gauss() * error, y = event.y, z = event.z + Rng.bots.gauss() * error;
    this.heardAt[bot] = now; this.heardX[bot] = x; this.heardY[bot] = y; this.heardZ[bot] = z;
    this.alert[bot] = Math.max(this.alert[bot], SENSE_ALERTED);
    this.stats.heard++;
    if (event.kind === 'grenade' && distance < SENSE_GRENADE_DANGER && BOT_FLEE_EFFECTS.includes(event.effect)) this.noteDanger(bot, x, z, now);
    const source = event.source;
    if (source < 0 || source >= MAX_ACTORS) return;
    const pair = this.pair(bot, source);
    if (!this.visible[pair]) this.remember(pair, SENSE.HEARD, x, y, z, now);
  },
  noteDanger(bot, x, z, now) {
    this.dangerX[bot] = x; this.dangerZ[bot] = z;
    this.dangerUntil[bot] = now + SENSE_GRENADE_FLEE;
  },
  hearingLineOpen(ex, ey, ez, event) {
    if (this.raysLeft <= 0) return false;
    this.spendRay();
    this.stats.hearingRays++;
    return World.lineClear(ex, ey, ez, event.x, event.y, event.z);
  },

  // ---- Damage awareness: the hit's direction, the distance roughly (like a damage indicator) ----
  hurt(event) {
    const bot = event.target, source = event.source;
    if (bot < 0 || !Bots.isBot(bot) || source < 0 || source === bot || source >= MAX_ACTORS || !Actors.isEnemy(bot, source)) return;
    const now = Sim.time;
    this.attacker[bot] = source;
    this.attackedAt[bot] = now;
    this.alert[bot] = SENSE_HURT_ALERT;
    const pair = this.pair(bot, source);
    if (!this.visible[pair]) this.rememberHit(bot, source, pair, event, now);
    Bots.nextPerceive[bot] = Math.min(Bots.nextPerceive[bot], now);
    BotDecide.hurry(bot, now);
  },
  rememberHit(bot, source, pair, event, now) {
    const flat = Math.hypot(event.dx, event.dz);
    const distance = Math.hypot(Actors.x[source] - Actors.x[bot], Actors.z[source] - Actors.z[bot]) * (1 + Rng.bots.gauss() * SENSE_HURT_ERROR);
    const directionX = flat > 1e-6 ? -event.dx / flat : 0, directionZ = flat > 1e-6 ? -event.dz / flat : 0;
    this.remember(pair, SENSE.HURT, Actors.x[bot] + directionX * distance, Actors.y[bot], Actors.z[bot] + directionZ * distance, now);
  },

  // A teammate's ping (BOT-061): the enemy enters memory as seen at that place (no line of sight: no shots from it).
  share(bot, other, x, y, z, now) {
    if (other < 0 || other >= MAX_ACTORS || !Actors.isEnemy(bot, other)) return;
    const pair = this.pair(bot, other);
    if (!this.visible[pair]) this.remember(pair, SENSE.PINGED, x, y, z, now);
  },
};

Bus.on('sound', (event) => BotSense.hear(event));
Bus.on('damage', (event) => BotSense.hurt(event));
Bus.on('kill', (event) => { if (event.victim >= 0 && event.victim < MAX_ACTORS) BotSense.forgetActor(event.victim); });
Bus.on('actor.remove', (id) => BotSense.forgetActor(id));
