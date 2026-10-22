// ==== S12 ABILITIES: EFFECTS ====
// One generic effect per effect kind (Abilities.effects), reused by many CAT.abilities rows: blink, buff, grapple, rewind,
// glide, beacon, pulse, sight, drone, tracker, fence, timebend, push, link, mesmer, possess, frenzy, revive, bolt, swarm,
// decoy, telekinesis, gates, rift, rally, zone, and the four suit weaves. Timed self and team effects are Buffs; placed
// effects are AbilityZones (a pooled struct of arrays). Damage always goes through Damage.apply, knockback through 'impulse'.

const BUFF = { SPEED: 0, SLOW: 1, DAMAGE: 2, RATE: 3, INVULNERABLE: 4, INVISIBLE: 5, REGEN: 6, TOUCH_KILL: 7, NO_FIRE: 8, ENERGY_REGEN: 9, MELEE: 10, GRAVITY: 11, RATE_SLOW: 12 };
const BUFF_COUNT = 13;
const BUFF_ENTRIES = 3;                  // overlapping buffs of one kind kept apart (see Buffs)
const BUFF_STRIDE = BUFF_COUNT * BUFF_ENTRIES;
const BUFF_NEUTRAL = [1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1];
const BUFF_LOWEST_WINS = [false, true, false, false, false, false, false, false, false, false, false, true, true];   // slows: the strongest (lowest) applies
const TICK_BUFF = TICK_SECONDS * 2;      // refreshed every step by a running toggle or zone
const WRATH_FACTOR = 1000;               // A34: any hit kills a non-boss
const TOUCH_KILL_RADIUS = 1.2;
const BLINK_BACKOFF = 0.5;               // blink end points step back this far until the capsule fits
const BLINK_TRIES = 12;
const LEDGE_LIFT = 1.2;                  // A05 ledge grab: a blocked arrival may land this much higher
const FLOOR_SNAP = 3;                    // arrivals settle onto a floor up to this far below
const LIFT_OFF_SPEED = 0.5;              // driving a grounded actor upward needs this much vertical speed to leave the floor
const REWIND_SAMPLE = 0.1;               // A09 history: one sample per 0.1 s
const REWIND_SAMPLES = 31;               // 3 s plus the current sample
const FOOTPRINT_RING = 40;               // prints kept per actor: 8 s at a base sprint (a speed-buffed sprint loses its oldest prints sooner)
const FOOTPRINT_COUNT = MAX_ACTORS * FOOTPRINT_RING;
const FOOTPRINT_MIN_LOUDNESS = 0.5;      // a crouch-walk (0.25) or a Quietstep step (0) leaves no print
const FOOTPRINT_SIZE = 0.18;
const ZONE_CAP = 48;
const ZONE_KINDS = ['lift', 'smoke', 'heal', 'dome', 'wall', 'strike', 'slow', 'drone', 'swarm', 'beacon', 'fence', 'rift', 'swap', 'decoy', 'lure', 'puppet'];
const ZONE_KIND = {};
ZONE_KINDS.forEach((name, index) => { ZONE_KIND[name.toUpperCase()] = index; });
const DOT_INTERVAL = 0.5;
const FENCE_REACH = 0.6;                 // an actor this close to a fence segment touches it
const FENCE_HEIGHT = 2;
const SIGHT_INTERVAL = 0.25;
const DECOY_HEALTH = 1;
const UNLIMITED_RANGE = 1e9;
const HOSTILE_TO_ALL = -1;             // A24: a team of -1 is everyone's enemy (Actors.isEnemy)
const PUPPET_DRIVE_ORDER = 19;         // A23: after every brain (10, 11) and nav (15), before abilities (20) and movement (30)
const PUPPET_RESTORE_ORDER = 89;       // ...and the caster's own input fields come back after every system read them

const effectHit = makeHit();
const effectActorHit = makeActorHit();
const effectDirection = Vec.make();
const effectTrace = makeTrace();
const effectIds = new Int8Array(MAX_ACTORS);
const telefragRequest = { target: 0, source: -1, amount: 1000, kind: 'telefrag', element: 'kinetic', x: 0, y: 0, z: 0 };
const teleportEvent = { id: 0, x: 0, y: 0, z: 0 };

// ---- Buffs: timed per-actor modifiers (speed, slow, damage, fire rate, invulnerable, invisible, regen ...) ----
// Each kind keeps BUFF_ENTRIES overlapping entries with their own value and end time, so a strong short buff never
// stretches to the end of a weak long one; get() reads the strongest live entry.
const Buffs = {
  value: new Float32Array(MAX_ACTORS * BUFF_STRIDE),
  until: new Float64Array(MAX_ACTORS * BUFF_STRIDE),
  invisibleSet: new Uint8Array(MAX_ACTORS),   // this section set ACTOR_FLAG.INVISIBLE (so only then is it cleared here)
  first(id, kind) { return id * BUFF_STRIDE + kind * BUFF_ENTRIES; },
  // The same value extends its own entry; a new value takes a free entry, or the one that ends first.
  add(id, kind, value, seconds) {
    const first = this.first(id, kind), now = Sim.time, until = now + seconds, stored = Math.fround(value);
    let slot = first;
    for (let entry = first; entry < first + BUFF_ENTRIES; entry++) {
      if (this.until[entry] > now && this.value[entry] === stored) { this.until[entry] = Math.max(this.until[entry], until); return; }
      if (this.until[entry] < this.until[slot]) slot = entry;
    }
    this.value[slot] = stored;
    this.until[slot] = until;
  },
  get(id, kind) {
    const first = this.first(id, kind), now = Sim.time, lowestWins = BUFF_LOWEST_WINS[kind];
    let best = BUFF_NEUTRAL[kind], found = false;
    for (let entry = first; entry < first + BUFF_ENTRIES; entry++) {
      if (this.until[entry] <= now) continue;
      const value = this.value[entry];
      if (!found || (lowestWins ? value < best : value > best)) { best = value; found = true; }
    }
    return best;
  },
  has(id, kind) { return this.remaining(id, kind) > 0; },
  cancel(id, kind) { const first = this.first(id, kind); this.until.fill(0, first, first + BUFF_ENTRIES); },
  // Seconds until the last entry of the kind ends.
  remaining(id, kind) {
    const first = this.first(id, kind);
    let last = 0;
    for (let entry = first; entry < first + BUFF_ENTRIES; entry++) last = Math.max(last, this.until[entry]);
    return Math.max(0, last - Sim.time);
  },
  clear(id) {
    this.until.fill(0, id * BUFF_STRIDE, (id + 1) * BUFF_STRIDE);
    this.applyActor(id, 0);
  },
  // Writes the buffs into the hooks other sections read; runs after every ability and zone stepped.
  apply() {
    for (let id = 0; id < Actors.count; id++) if (Actors.kind[id] !== ACTOR_KIND.NONE) this.applyActor(id, TICK_SECONDS);
  },
  applyActor(id, dt) {
    this.applyScales(id);
    // G08: a frozen actor's cloak drops while the freeze lasts (the buff itself keeps running).
    this.applyInvisible(id, this.has(id, BUFF.INVISIBLE) && Actors.alive[id] === 1 && !Damage.hasStatus(id, 'freeze'));
    if (!Actors.alive[id] || dt <= 0) return;
    RallyShield.expire(id);
    if (this.has(id, BUFF.NO_FIRE)) Weapons.nextShot[id] = Math.max(Weapons.nextShot[id], this.remaining(id, BUFF.NO_FIRE));
    if (this.has(id, BUFF.REGEN)) healActor(id, this.get(id, BUFF.REGEN) * dt, -1);
    if (this.has(id, BUFF.TOUCH_KILL)) touchKill(id);
  },
  // The single writer of Move.statusSpeedScale, Move.gravityScale and Weapons.rateScale: buffs times the powerup factors (12b calls this
  // whenever its set changes, so a pickup or expiry takes effect in the same step).
  applyScales(id) {
    Move.statusSpeedScale[id] = this.get(id, BUFF.SPEED) * this.get(id, BUFF.SLOW) * Powerups.speedScale[id];
    Weapons.rateScale[id] = this.get(id, BUFF.RATE) * this.get(id, BUFF.RATE_SLOW) * Powerups.rateScale[id];   // boosts and slows stack
    Move.gravityScale[id] = this.get(id, BUFF.GRAVITY);
  },
  applyInvisible(id, wanted) {
    if (wanted) { if (!(Actors.flags[id] & ACTOR_FLAG.INVISIBLE)) { Actors.flags[id] |= ACTOR_FLAG.INVISIBLE; this.invisibleSet[id] = 1; } return; }
    if (!this.invisibleSet[id]) return;
    Actors.flags[id] &= ~ACTOR_FLAG.INVISIBLE;
    this.invisibleSet[id] = 0;
  },
};

function healActor(id, amount, healer) {
  const before = Actors.health[id];
  Damage.regenerate(id, amount, Actors.maxHealth[id]);
  if (healer >= 0 && healer !== id) Meters.addHealing(healer, Actors.health[id] - before);
}
// A34: enemies touching the wrathful actor die (lethal 'crush' damage credited to it).
function touchKill(id) {
  for (let other = 0; other < Actors.count; other++) {
    if (!Actors.alive[other] || !Actors.isEnemy(id, other) || isBoss(other)) continue;
    if (distanceSquared3(Actors.x[id], Actors.y[id], Actors.z[id], Actors.x[other], Actors.y[other], Actors.z[other]) > TOUCH_KILL_RADIUS * TOUCH_KILL_RADIUS) continue;
    const info = Damage.info();
    info.amount = 1; info.kind = 'crush'; info.weapon = 'wrath';
    Damage.apply(id, other, info);
  }
}
function isBoss(id) { const profile = Actors.profile[id]; return !!profile && profile.boss === true; }

// ---- Shared helpers: aim, enemies, motion ----
function aimRay(id) { return Vec.fromAngles(effectDirection, Actors.yaw[id], Actors.pitch[id]); }
// Distance to the first wall along the view (or maxDistance); leaves the hit in effectHit.
function aimDistance(id, maxDistance) {
  aimRay(id);
  const blocked = World.raycast(Actors.x[id], Actors.eyeY(id), Actors.z[id], effectDirection.x, effectDirection.y, effectDirection.z, maxDistance, effectHit);
  return blocked ? effectHit.distance : maxDistance;
}
// The enemy nearest the crosshair inside the aim cone and range (the shared nearestSeenEnemy picker ordered by 1 - cos to the aim
// line, cone 11a AIM_ASSIST_CONE_DEG): a cloaked enemy or one behind smoke is no target.
const AIM_DEFAULT_COS = Math.cos(AIM_ASSIST_CONE_DEG * DEG);
const AIM_ORDER_LIMIT = 2;              // the largest 1 - cos (straight behind): the real range is checked in accept
let aimMinCos = AIM_DEFAULT_COS, aimRange = 0;
const AIM_TARGET_RULE = {
  skip(who, id) { return !Actors.alive[id] || !Actors.isEnemy(who, id) || (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) !== 0; },
  point(id, out) { Hitbox.point(id, ZONE.BODY, out); },
  distance(dx, dy, dz) {
    const length = length3(dx, dy, dz);
    return length < 1e-3 ? AIM_ORDER_LIMIT : 1 - (dx * effectDirection.x + dy * effectDirection.y + dz * effectDirection.z) / length;
  },
  accept(who, id, dx, dy, dz, offAxis) { return 1 - offAxis >= aimMinCos && length3(dx, dy, dz) <= aimRange; },
  blocked(x, y, z, point) { return Smoke.lineBlocked(x, y, z, point.x, point.y, point.z); },
};
function aimTarget(id, range, coneDeg) {
  aimRay(id);
  aimMinCos = coneDeg ? Math.cos(coneDeg * DEG) : AIM_DEFAULT_COS;
  aimRange = range;
  return nearestSeenEnemy(id, Actors.x[id], Actors.eyeY(id), Actors.z[id], AIM_ORDER_LIMIT, AIM_TARGET_RULE);
}
// Enemies of id within radius of a point (nearest first is not needed by any caller); returns the count in effectIds.
function enemiesNear(id, x, y, z, radius, includeGhosts) {
  let count = 0;
  for (let other = 0; other < Actors.count; other++) {
    if (!Actors.alive[other] || !Actors.isEnemy(id, other)) continue;
    if (!includeGhosts && Abilities.hiddenFromPulse && Abilities.hiddenFromPulse(other)) continue;
    if (distanceSquared3(x, y, z, Actors.x[other], Actors.y[other], Actors.z[other]) <= radius * radius) effectIds[count++] = other;
  }
  return count;
}
function alliesOf(id, other) { return other === id || (Actors.team[id] >= 0 && Actors.team[other] === Actors.team[id]); }
function revealEnemies(id, x, y, z, radius, seconds) {
  const count = enemiesNear(id, x, y, z, radius, false);
  for (let k = 0; k < count; k++) Damage.addStatus(effectIds[k], 'reveal', id, seconds, 1);
  return count;
}
// S10 multiplies impulses by rules.knockback; self-propelled ability motion must not change with that ruleset factor.
function driveActor(id, vx, vy, vz) {
  const knockback = currentRules().knockback === undefined ? 1 : currentRules().knockback;
  if (!Move.isGrounded(id) || knockback <= 0) { Actors.vx[id] = vx; Actors.vy[id] = vy; Actors.vz[id] = vz; return; }
  const lift = Math.max(vy, LIFT_OFF_SPEED);
  emitImpulse(id, (vx - Actors.vx[id]) / knockback, (lift - Actors.vy[id]) / knockback, (vz - Actors.vz[id]) / knockback);
}
// G08: a Rime Bomb freeze stops every teleport (blink, rewind, beacon, rift).
function canTeleport(id) { return !Damage.hasStatus(id, 'freeze'); }
// Rows with balance.dropsObjective (A12) announce the move: S13 drops the objective the actor carries.
function moveActorTo(id, x, y, z, row) {
  Actors.x[id] = Actors.prevX[id] = x; Actors.y[id] = Actors.prevY[id] = y; Actors.z[id] = Actors.prevZ[id] = z;
  if (!row.balance.dropsObjective) return;
  teleportEvent.id = id; teleportEvent.x = x; teleportEvent.y = y; teleportEvent.z = z;
  Bus.emit('ability.teleport', teleportEvent);
}
// A free standing spot below the point (x, probeY, z): onto the floor under it (or hanging at the point minus the eye
// height), stepped back toward (fromX, fromZ) until the capsule fits.
function findArrival(id, fromX, fromZ, x, probeY, z, out) {
  const length = Math.hypot(x - fromX, z - fromZ) || 1;
  for (let attempt = 0; attempt < BLINK_TRIES; attempt++) {
    const back = Math.min(1, attempt * BLINK_BACKOFF / length);
    const px = lerp(x, fromX, back), pz = lerp(z, fromZ, back);
    const floor = World.floorBelow(px, probeY, pz, FLOOR_SNAP + STAND_HEIGHT);
    const feet = Number.isNaN(floor) ? probeY - Actors.eye[id] : floor;
    if (World.capsuleFits(px, feet, pz, ACTOR_RADIUS, Actors.height[id])) return Vec.set(out, px, feet, pz);
  }
  return null;
}

// ---- Placed effects: AbilityZones (pooled; the oldest is recycled when full) ----
const AbilityZones = {
  alive: new Uint8Array(ZONE_CAP), kind: new Uint8Array(ZONE_CAP), owner: new Int8Array(ZONE_CAP).fill(-1), team: new Int8Array(ZONE_CAP),
  ability: new Int16Array(ZONE_CAP), persist: new Uint8Array(ZONE_CAP), target: new Int8Array(ZONE_CAP).fill(-1), other: new Int8Array(ZONE_CAP).fill(-1),
  x: new Float32Array(ZONE_CAP), y: new Float32Array(ZONE_CAP), z: new Float32Array(ZONE_CAP),
  x2: new Float32Array(ZONE_CAP), y2: new Float32Array(ZONE_CAP), z2: new Float32Array(ZONE_CAP),
  yaw: new Float32Array(ZONE_CAP), radius: new Float32Array(ZONE_CAP), height: new Float32Array(ZONE_CAP),
  timeLeft: new Float32Array(ZONE_CAP), timer: new Float32Array(ZONE_CAP), value: new Float32Array(ZONE_CAP), born: new Float64Array(ZONE_CAP),
  rearm: new Float64Array(MAX_ACTORS),   // fences and rifts: an actor is affected again only after this Sim.time
  behaviours: [],                        // ZONE_KIND index -> { step(zone, dt) -> false removes, remove(zone) }
  count: 0,

  add(kind, id, row, x, y, z, seconds) {
    const slot = this.freeSlot();
    this.alive[slot] = 1; this.kind[slot] = kind; this.owner[slot] = id; this.team[slot] = Actors.team[id]; this.ability[slot] = row ? row.index : -1;
    this.persist[slot] = row && row.params.persist ? 1 : 0; this.target[slot] = -1; this.other[slot] = -1;
    this.x[slot] = this.x2[slot] = x; this.y[slot] = this.y2[slot] = y; this.z[slot] = this.z2[slot] = z;
    this.yaw[slot] = Actors.yaw[id]; this.radius[slot] = row ? row.params.radius || 0 : 0; this.height[slot] = row ? row.params.height || 0 : 0;
    this.timeLeft[slot] = seconds; this.timer[slot] = 0; this.value[slot] = 0; this.born[slot] = Sim.time;
    this.count++;
    return slot;
  },
  freeSlot() {
    let oldest = 0;
    for (let zone = 0; zone < ZONE_CAP; zone++) {
      if (!this.alive[zone]) return zone;
      if (this.born[zone] < this.born[oldest]) oldest = zone;
    }
    this.remove(oldest);
    return oldest;
  },
  remove(zone) {
    if (!this.alive[zone]) return;
    const behaviour = this.behaviours[this.kind[zone]];
    if (behaviour && behaviour.remove) behaviour.remove(zone);
    this.alive[zone] = 0;
    this.count--;
  },
  find(kind, owner) {
    for (let zone = 0; zone < ZONE_CAP; zone++) if (this.alive[zone] && this.kind[zone] === kind && this.owner[zone] === owner) return zone;
    return -1;
  },
  // On death the owner's zones go, except the deployed ones (persist); match end and spawn-time cleanups take all.
  removeOwned(id, keepPersistent) {
    for (let zone = 0; zone < ZONE_CAP; zone++) if (this.alive[zone] && this.owner[zone] === id && !(keepPersistent && this.persist[zone])) this.remove(zone);
  },
  clear() { for (let zone = 0; zone < ZONE_CAP; zone++) this.remove(zone); this.rearm.fill(0); },
  step(dt) {
    for (let zone = 0; zone < ZONE_CAP; zone++) {
      if (!this.alive[zone] || this.born[zone] === Sim.time) continue;   // a zone placed this step starts working next step
      const behaviour = this.behaviours[this.kind[zone]];
      if (behaviour.step && behaviour.step(zone, dt) === false) { this.remove(zone); continue; }
      this.timeLeft[zone] -= dt;
      if (this.timeLeft[zone] <= TICK_EPSILON) this.remove(zone);
    }
  },
  inside(zone, id) {
    const dy = Actors.y[id] - this.y[zone];
    if (this.height[zone] > 0 && (dy < -1 || dy > this.height[zone])) return false;
    return Math.hypot(Actors.x[id] - this.x[zone], Actors.z[id] - this.z[zone]) <= this.radius[zone];
  },
  insideSphere(zone, x, y, pointZ) { return distanceSquared3(x, y, pointZ, this.x[zone], this.y[zone], this.z[zone]) <= this.radius[zone] * this.radius[zone]; },
};

function zoneRow(zone) { return CAT.abilities[AbilityZones.ability[zone]]; }
// Applies fn(zone, actorId) to every live actor inside the zone that is an ally (allies true) or an enemy of the owner.
function forZoneActors(zone, allies, fn) {
  const owner = AbilityZones.owner[zone];
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || !AbilityZones.inside(zone, id)) continue;
    if (alliesOf(owner, id) === allies) fn(zone, id);
  }
}
function liftActor(zone, id) {
  if (Actors.y[id] - AbilityZones.y[zone] >= AbilityZones.height[zone]) return;
  const speed = zoneRow(zone).params.speed;
  driveActor(id, Actors.vx[id], speed, Actors.vz[id]);
}
function healInZone(zone, id) { healActor(id, zoneRow(zone).params.rate * TICK_SECONDS, AbilityZones.owner[zone]); }
// ABL-004 time slow: movement and fire rate both run at the zone's factor.
function slowInZone(zone, id) {
  Buffs.add(id, BUFF.SLOW, AbilityZones.value[zone], TICK_BUFF);
  Buffs.add(id, BUFF.RATE_SLOW, AbilityZones.value[zone], TICK_BUFF);
}
// The strike lands after its delay: one blast through Damage.explode (no falloff inside the marked circle).
function strikeStep(zone, dt) {
  if (AbilityZones.timeLeft[zone] > dt + TICK_EPSILON) return true;
  const row = zoneRow(zone), blast = Damage.blast();
  blast.x = AbilityZones.x[zone]; blast.y = AbilityZones.y[zone] + 0.5; blast.z = AbilityZones.z[zone]; blast.owner = AbilityZones.owner[zone];
  blast.radius = row.params.radius; blast.damage = row.params.damage; blast.weapon = row.id; blast.element = 'thermal';
  Damage.explode(blast);
  return false;
}
// Swarm and other damage over time attached to a target: ticks through Damage.apply as 'dot'.
function swarmStep(zone, dt) {
  const target = AbilityZones.target[zone];
  if (target < 0 || !Actors.alive[target]) return false;
  AbilityZones.x[zone] = Actors.x[target]; AbilityZones.y[zone] = Actors.y[target]; AbilityZones.z[zone] = Actors.z[target];
  AbilityZones.timer[zone] += dt;
  if (AbilityZones.timer[zone] < DOT_INTERVAL - TICK_EPSILON) return true;
  AbilityZones.timer[zone] -= DOT_INTERVAL;
  const info = Damage.info();
  info.amount = AbilityZones.value[zone] * DOT_INTERVAL; info.kind = 'dot'; info.weapon = zoneRow(zone).id; info.element = 'toxin';
  info.x = Actors.x[target]; info.y = Actors.y[target] + 1; info.z = Actors.z[target];
  Damage.apply(AbilityZones.owner[zone], target, info);
  return true;
}
// A field that follows its owner (A19 versus) or covers everything (A19 single player, radius UNLIMITED_RANGE).
function slowFieldStep(zone) {
  const owner = AbilityZones.owner[zone];
  if (!Actors.alive[owner]) return false;
  AbilityZones.x[zone] = Actors.x[owner]; AbilityZones.y[zone] = Actors.y[owner]; AbilityZones.z[zone] = Actors.z[owner];
  forZoneActors(zone, false, slowInZone);
  return true;
}
function fenceStep(zone) {
  const partner = AbilityZones.other[zone];
  if (partner < 0 || !AbilityZones.alive[partner]) return true;
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || !Actors.isEnemy(AbilityZones.owner[zone], id) || AbilityZones.rearm[id] > Sim.time) continue;
    if (touchesSegment(id, AbilityZones.x[zone], AbilityZones.y[zone], AbilityZones.z[zone], AbilityZones.x[partner], AbilityZones.z[partner])) zapFence(zone, id);
  }
  return true;
}
function touchesSegment(id, ax, ay, az, bx, bz) {
  const dy = Actors.y[id] - ay;
  if (dy < -1 || dy > FENCE_HEIGHT) return false;
  const sx = bx - ax, sz = bz - az, length = sx * sx + sz * sz;
  const t = length > 0 ? clamp(((Actors.x[id] - ax) * sx + (Actors.z[id] - az) * sz) / length, 0, 1) : 0;
  return Math.hypot(Actors.x[id] - (ax + sx * t), Actors.z[id] - (az + sz * t)) <= FENCE_REACH;
}
function zapFence(zone, id) {
  const row = zoneRow(zone), info = Damage.info();
  info.amount = row.params.damage; info.kind = 'hit'; info.weapon = row.id; info.element = 'arc';
  info.x = Actors.x[id]; info.y = Actors.y[id] + 1; info.z = Actors.z[id];
  Damage.apply(AbilityZones.owner[zone], id, info);
  Buffs.add(id, BUFF.SLOW, row.params.slow, row.params.slowSeconds);
  AbilityZones.rearm[id] = Sim.time + row.params.rearm;
}
function riftStep(zone) {
  const exit = AbilityZones.other[zone], row = zoneRow(zone);
  if (exit < 0 || !AbilityZones.alive[exit]) return false;
  for (let id = 0; id < Actors.count; id++) {
    if (!Actors.alive[id] || !alliesOf(AbilityZones.owner[zone], id) || AbilityZones.rearm[id] > Sim.time || !AbilityZones.inside(zone, id)) continue;
    if (!canTeleport(id)) continue;
    moveActorTo(id, AbilityZones.x[exit], AbilityZones.y[exit], AbilityZones.z[exit], row);
    AbilityZones.rearm[id] = Sim.time + row.params.rearm;
  }
  return true;
}
// Possession and frenzy swap the target's team for a while; the original team comes back when the zone goes.
function restoreTeam(zone) {
  const target = AbilityZones.target[zone];
  if (target >= 0 && Actors.kind[target] !== ACTOR_KIND.NONE) Actors.team[target] = AbilityZones.value[zone];
}
// A23: the puppet zone lasts while caster and puppet live; when it goes (timer, a death, a hit on the caster) the puppet
// returns to its side and to its own brain.
function puppetZoneStep(zone) { return Actors.alive[AbilityZones.owner[zone]] === 1 && Actors.alive[AbilityZones.target[zone]] === 1; }
function removePuppet(zone) {
  restoreTeam(zone);
  PuppetState.unlink(AbilityZones.owner[zone], zone);
}
function droneStep(zone, dt) {
  const owner = AbilityZones.owner[zone], row = zoneRow(zone);
  Vec.fromAngles(effectDirection, Actors.yaw[owner], Actors.pitch[owner]);
  const step = row.params.speed * dt;
  if (!World.raycast(AbilityZones.x[zone], AbilityZones.y[zone], AbilityZones.z[zone], effectDirection.x, effectDirection.y, effectDirection.z, step + 0.3, effectHit)) {
    AbilityZones.x[zone] += effectDirection.x * step; AbilityZones.y[zone] += effectDirection.y * step; AbilityZones.z[zone] += effectDirection.z * step;
  }
  revealEnemies(owner, AbilityZones.x[zone], AbilityZones.y[zone], AbilityZones.z[zone], row.params.reveal, SIGHT_INTERVAL);
  return true;
}
function decoyStep(zone) {
  const decoy = AbilityZones.target[zone];
  if (decoy < 0 || !Actors.alive[decoy]) return false;
  Actors.moveX[decoy] = AbilityZones.x2[zone]; Actors.moveZ[decoy] = AbilityZones.z2[zone]; Actors.aimYaw[decoy] = AbilityZones.yaw[zone];
  return true;
}
function removeDecoy(zone) {
  const decoy = AbilityZones.target[zone];
  AbilityZones.target[zone] = -1;
  if (decoy >= 0 && DecoyState.zone[decoy] === zone) { DecoyState.zone[decoy] = -1; Actors.remove(decoy); }
}
function lureStep(zone) {
  for (let k = 0; k < 2; k++) {
    const victim = k === 0 ? AbilityZones.target[zone] : AbilityZones.other[zone];
    if (victim >= 0 && Damage.hasStatus(victim, 'sleep')) Actors.aimYaw[victim] = Math.atan2(AbilityZones.x[zone] - Actors.x[victim], AbilityZones.z[zone] - Actors.z[victim]);
  }
  return true;
}

const DecoyState = { zone: new Int8Array(MAX_ACTORS).fill(-1) };   // actor id -> zone of the decoy it is (-1 = a real actor)
// A40: the surplus a rally gave each actor and when it ends. One pool on purpose: a later rally moves the end of the whole pool,
// and at the end the full rally amount comes off what surplus is left (damage counts against other surplus first).
const RallyShield = {
  amount: new Float32Array(MAX_ACTORS), until: new Float64Array(MAX_ACTORS),
  expire(id) {
    if (this.amount[id] <= 0 || Sim.time < this.until[id]) return;
    Damage.surplus[id] = Math.max(0, Damage.surplus[id] - this.amount[id]);
    this.amount[id] = 0;
  },
};
const LinkState = { partner: new Int8Array(MAX_ACTORS).fill(-1), until: new Float64Array(MAX_ACTORS), sharing: false };
// A23 Puppet Jump: system 'puppet' (PUPPET_DRIVE_ORDER) hands the caster's input to the puppet and leaves the caster's body
// still; 'puppetRestore' (PUPPET_RESTORE_ORDER) gives the caster's input fields back, so a step without a fresh input write
// (two sim steps in one frame) drives the puppet the same way again. S14 PvE skips the brain of a driven enemy (master >= 0).
const PuppetState = {
  puppet: new Int8Array(MAX_ACTORS).fill(-1),   // caster -> the actor it drives
  master: new Int8Array(MAX_ACTORS).fill(-1),   // driven actor -> its caster
  zone: new Int8Array(MAX_ACTORS).fill(-1),     // caster -> its puppet zone
  moveX: new Float32Array(MAX_ACTORS), moveZ: new Float32Array(MAX_ACTORS), aimYaw: new Float32Array(MAX_ACTORS), aimPitch: new Float32Array(MAX_ACTORS),
  buttons: new Uint32Array(MAX_ACTORS),
  drivenTick: new Int32Array(MAX_ACTORS).fill(-1),   // caster -> the Sim.tick its input last went to the puppet
  count: 0,                                     // puppets driven now: both systems skip their loop at 0
  // Only a player drives: a bot's brain aims and walks from its own body, so its puppet keeps its own PvE brain (a plain swap).
  canDrive(id) { return Actors.kind[id] === ACTOR_KIND.PLAYER; },
  link(caster, puppet, zone) {
    this.puppet[caster] = puppet; this.master[puppet] = caster; this.zone[caster] = zone; this.drivenTick[caster] = -1;
    this.count++;
  },
  // Control that ends after 'puppet' ran this step gives the caster's input back now: 'puppetRestore' skips an unlinked caster,
  // and a zeroed FIRE would count as a fresh press on the next step.
  unlink(caster, zone) {
    if (caster < 0 || this.zone[caster] !== zone) return;
    if (this.drivenTick[caster] === Sim.tick) this.giveBack(caster);
    this.master[this.puppet[caster]] = -1; this.puppet[caster] = -1; this.zone[caster] = -1; this.drivenTick[caster] = -1;
    this.count--;
  },
  // Ends the caster's puppet early (the ability's end: a hit on the caster, a stun, death, match end).
  release(caster) { if (this.zone[caster] >= 0) AbilityZones.remove(this.zone[caster]); },
  drive() {
    if (!this.count) return;
    for (let caster = 0; caster < Actors.count; caster++) if (this.puppet[caster] >= 0) this.driveOne(caster, this.puppet[caster]);
  },
  driveOne(caster, puppet) {
    this.moveX[caster] = Actors.moveX[caster]; this.moveZ[caster] = Actors.moveZ[caster]; this.buttons[caster] = Actors.buttons[caster];
    this.aimYaw[caster] = Actors.aimYaw[caster]; this.aimPitch[caster] = Actors.aimPitch[caster];
    Actors.moveX[puppet] = Actors.moveX[caster]; Actors.moveZ[puppet] = Actors.moveZ[caster];
    Actors.aimYaw[puppet] = Actors.aimYaw[caster]; Actors.aimPitch[puppet] = Actors.aimPitch[caster];
    Actors.buttons[puppet] = Actors.buttons[caster]; Actors.pressed[puppet] = Actors.pressed[caster];
    Actors.moveX[caster] = Actors.moveZ[caster] = 0; Actors.buttons[caster] = Actors.pressed[caster] = 0;
    Actors.aimYaw[caster] = Actors.yaw[caster]; Actors.aimPitch[caster] = Actors.pitch[caster];
    this.drivenTick[caster] = Sim.tick;
  },
  restore() {
    if (!this.count) return;
    for (let caster = 0; caster < Actors.count; caster++) if (this.puppet[caster] >= 0 && this.drivenTick[caster] === Sim.tick) this.giveBack(caster);   // linked after the drive (cast tick): nothing was taken
  },
  giveBack(caster) {
    Actors.moveX[caster] = this.moveX[caster]; Actors.moveZ[caster] = this.moveZ[caster]; Actors.buttons[caster] = this.buttons[caster];
    Actors.aimYaw[caster] = this.aimYaw[caster]; Actors.aimPitch[caster] = this.aimPitch[caster];
  },
  // Render.cameraOverride: the local player's camera rides the interpolated eyes of the puppet it drives (the frame alpha in
  // Render.view, as followPlayer), looking along the player's aim.
  placeCamera(camera) {
    const player = Game.playerId, puppet = player >= 0 ? this.puppet[player] : -1;
    if (puppet < 0) return false;
    const alpha = Render.view.alpha;
    camera.x = lerp(Actors.prevX[puppet], Actors.x[puppet], alpha);
    camera.y = lerp(Actors.prevY[puppet], Actors.y[puppet], alpha) + Actors.eye[puppet];
    camera.z = lerp(Actors.prevZ[puppet], Actors.z[puppet], alpha);
    camera.yaw = Actors.aimYaw[player]; camera.pitch = Actors.aimPitch[player]; camera.roll = 0;
    return true;
  },
};
const RewindHistory = {
  x: new Float32Array(MAX_ACTORS * REWIND_SAMPLES), y: new Float32Array(MAX_ACTORS * REWIND_SAMPLES), z: new Float32Array(MAX_ACTORS * REWIND_SAMPLES),
  health: new Float32Array(MAX_ACTORS * REWIND_SAMPLES), armor: new Float32Array(MAX_ACTORS * REWIND_SAMPLES), shield: new Float32Array(MAX_ACTORS * REWIND_SAMPLES),
  head: new Uint8Array(MAX_ACTORS), filled: new Uint8Array(MAX_ACTORS), clock: 0,
  reset(id) { this.head[id] = 0; this.filled[id] = 0; },
  record() {
    this.clock += TICK_SECONDS;
    if (this.clock < REWIND_SAMPLE - TICK_EPSILON) return;
    this.clock -= REWIND_SAMPLE;
    for (let id = 0; id < Actors.count; id++) if (Actors.alive[id]) this.sample(id);
  },
  sample(id) {
    const head = (this.head[id] + 1) % REWIND_SAMPLES, i = id * REWIND_SAMPLES + head;
    this.x[i] = Actors.x[id]; this.y[i] = Actors.y[id]; this.z[i] = Actors.z[id];
    this.health[i] = Actors.health[id]; this.armor[i] = Actors.armor[id]; this.shield[i] = Actors.shield[id];
    this.head[id] = head;
    this.filled[id] = Math.min(REWIND_SAMPLES, this.filled[id] + 1);
  },
  // Sample index of `seconds` ago (or the oldest kept), or -1 with no history.
  past(id, seconds) {
    if (!this.filled[id]) return -1;
    const back = Math.min(this.filled[id] - 1, Math.round(seconds / REWIND_SAMPLE));
    return id * REWIND_SAMPLES + (this.head[id] - back + REWIND_SAMPLES) % REWIND_SAMPLES;
  },
};
// A16: one ring of prints per actor (actor * FOOTPRINT_RING + k), kept only for enemies of someone who has Tracker Sense.
const Footprints = {
  x: new Float32Array(FOOTPRINT_COUNT), y: new Float32Array(FOOTPRINT_COUNT), z: new Float32Array(FOOTPRINT_COUNT),
  owner: new Int8Array(FOOTPRINT_COUNT).fill(-1), time: new Float64Array(FOOTPRINT_COUNT).fill(-1e9), next: new Uint8Array(MAX_ACTORS),
  add(id, loudness) {
    if (loudness < FOOTPRINT_MIN_LOUDNESS || !this.tracked(id)) return;
    const i = id * FOOTPRINT_RING + this.next[id];
    this.x[i] = Actors.x[id]; this.y[i] = Actors.y[id]; this.z[i] = Actors.z[id]; this.owner[i] = id; this.time[i] = Sim.time;
    this.next[id] = (this.next[id] + 1) % FOOTPRINT_RING;
  },
  // True when a living actor with Tracker Sense has this one as an enemy.
  tracked(id) {
    for (let viewer = 0; viewer < Actors.count; viewer++) {
      if (Actors.alive[viewer] && Abilities.slotOf(viewer, 'tracker') >= 0 && Actors.isEnemy(viewer, id)) return true;
    }
    return false;
  },
  clear() { this.time.fill(-1e9); this.owner.fill(-1); this.next.fill(0); },
};

AbilityZones.behaviours[ZONE_KIND.LIFT] = { step(zone) { forZoneActors(zone, true, liftActor); return true; } };
AbilityZones.behaviours[ZONE_KIND.SMOKE] = {};
AbilityZones.behaviours[ZONE_KIND.HEAL] = { step(zone) { forZoneActors(zone, true, healInZone); return true; } };
AbilityZones.behaviours[ZONE_KIND.DOME] = {};
AbilityZones.behaviours[ZONE_KIND.WALL] = {};
AbilityZones.behaviours[ZONE_KIND.STRIKE] = { step: strikeStep };
AbilityZones.behaviours[ZONE_KIND.SLOW] = { step: slowFieldStep };
AbilityZones.behaviours[ZONE_KIND.DRONE] = { step: droneStep };
AbilityZones.behaviours[ZONE_KIND.SWARM] = { step: swarmStep };
AbilityZones.behaviours[ZONE_KIND.BEACON] = {};
AbilityZones.behaviours[ZONE_KIND.FENCE] = { step: fenceStep };
AbilityZones.behaviours[ZONE_KIND.RIFT] = { step: riftStep };
AbilityZones.behaviours[ZONE_KIND.SWAP] = { remove: restoreTeam };
AbilityZones.behaviours[ZONE_KIND.DECOY] = { step: decoyStep, remove: removeDecoy };
AbilityZones.behaviours[ZONE_KIND.LURE] = { step: lureStep };
AbilityZones.behaviours[ZONE_KIND.PUPPET] = { step: puppetZoneStep, remove: removePuppet };

// ---- Effect kinds ----
const placeAt = Vec.make();
// zone: params.zone names the zone; strike and smoke land at the aimed point, walls stand in front, the rest at the feet.
function castZone(id, row) {
  const kind = ZONE_KIND[row.params.zone.toUpperCase()];
  const at = zonePlacement(id, row, placeAt);
  const seconds = row.params.zone === 'strike' ? row.params.delay : row.duration;
  const zone = AbilityZones.add(kind, id, row, at.x, at.y, at.z, seconds);
  if (row.params.zone === 'wall' || row.params.zone === 'smoke') { AbilityZones.radius[zone] = row.params.width / 2; AbilityZones.height[zone] = row.params.height; }
  if (row.params.zone === 'smoke') Smoke.add(at.x, at.y, at.z, row.params.width, row.params.height, seconds, AbilityZones.yaw[zone]);   // real smoke: blocks sight
  return true;
}
// The floor under the aimed point within range (or the point itself when there is no floor below it).
function aimedFloor(id, range, out) {
  const distance = Math.max(0, aimDistance(id, range) - 0.1);
  const x = Actors.x[id] + effectDirection.x * distance, y = Actors.eyeY(id) + effectDirection.y * distance, z = Actors.z[id] + effectDirection.z * distance;
  const floor = World.floorBelow(x, y + 0.1, z, range + STAND_HEIGHT);
  return Vec.set(out, x, Number.isNaN(floor) ? y : floor, z);
}
function zonePlacement(id, row, out) {
  const placement = row.params.zone;
  if (placement === 'strike' || placement === 'smoke') return aimedFloor(id, row.range, out);
  if (placement === 'wall') {
    const distance = row.params.distance;
    return Vec.set(out, Actors.x[id] + Math.sin(Actors.yaw[id]) * distance, Actors.y[id], Actors.z[id] + Math.cos(Actors.yaw[id]) * distance);
  }
  return Vec.set(out, Actors.x[id], Actors.y[id], Actors.z[id]);
}
// blink: aim (A05: to the aimed point, line of sight by construction) or input direction (A08: a 7 m dash).
function castBlink(id, row) {
  if (!canTeleport(id)) return false;
  const fromX = Actors.x[id], fromY = Actors.y[id], fromZ = Actors.z[id];
  let x = fromX, y = fromY, z = fromZ;
  if (row.params.direction === 'aim') {
    const distance = Math.max(0, aimDistance(id, row.range) - ACTOR_RADIUS);
    x = fromX + effectDirection.x * distance; z = fromZ + effectDirection.z * distance; y = Actors.eyeY(id) + effectDirection.y * distance;
  } else {
    inputDirection(id, effectDirection);
    World.sweepCapsule(fromX, fromY + STEP_HEIGHT, fromZ, fromX + effectDirection.x * row.range, fromY + STEP_HEIGHT, fromZ + effectDirection.z * row.range, ACTOR_RADIUS, Actors.height[id] - STEP_HEIGHT, effectTrace);
    x = lerp(fromX, fromX + effectDirection.x * row.range, effectTrace.fraction); z = lerp(fromZ, fromZ + effectDirection.z * row.range, effectTrace.fraction); y = fromY + STEP_HEIGHT;
  }
  const arrival = findArrival(id, fromX, fromZ, x, y, z, placeAt) || (row.params.ledgeGrab ? findArrival(id, fromX, fromZ, x, y + LEDGE_LIFT, z, placeAt) : null);
  if (!arrival) return false;
  moveActorTo(id, arrival.x, arrival.y, arrival.z, row);
  if (row.balance.fireDelay) Buffs.add(id, BUFF.NO_FIRE, row.balance.fireDelay, row.balance.fireDelay);
  return true;
}
// Horizontal direction of the movement input (forward when there is none).
function inputDirection(id, out) {
  let forward = Actors.moveZ[id], strafe = Actors.moveX[id];
  if (Math.abs(forward) + Math.abs(strafe) < 0.1) forward = 1;
  const yaw = Actors.yaw[id], length = Math.hypot(forward, strafe);
  return Vec.set(out, (Math.sin(yaw) * forward - Math.cos(yaw) * strafe) / length, 0, (Math.cos(yaw) * forward + Math.sin(yaw) * strafe) / length);
}
// buff: every param of the row becomes a timed buff of row.duration.
function castBuff(id, row) {
  const p = row.params, seconds = row.duration;
  if (p.speed) Buffs.add(id, BUFF.SPEED, p.speed, seconds);
  if (p.damage) Buffs.add(id, BUFF.DAMAGE, p.damage, seconds);
  if (p.rate) Buffs.add(id, BUFF.RATE, p.rate, seconds);
  if (p.regen) Buffs.add(id, BUFF.REGEN, p.regen, seconds);
  if (p.invulnerable) Buffs.add(id, BUFF.INVULNERABLE, 1, seconds);
  if (p.invisible) Buffs.add(id, BUFF.INVISIBLE, 1, seconds);
  if (p.noFire) Buffs.add(id, BUFF.NO_FIRE, seconds, seconds);
  if (p.touchKill) Buffs.add(id, BUFF.TOUCH_KILL, 1, seconds);
  return true;
}
const GrappleState = { target: new Int8Array(MAX_ACTORS).fill(-1), x: new Float32Array(MAX_ACTORS), y: new Float32Array(MAX_ACTORS), z: new Float32Array(MAX_ACTORS) };
// grapple: hooks an enemy (pulled to the user) or geometry (the user is pulled) within range; nothing hit = no cast.
function castGrapple(id, row) {
  const wall = aimDistance(id, row.range), eyeY = Actors.eyeY(id);
  const enemy = World.raycastActors(Actors.x[id], eyeY, Actors.z[id], effectDirection.x, effectDirection.y, effectDirection.z, wall, id, effectActorHit);
  GrappleState.target[id] = enemy >= 0 && Actors.isEnemy(id, enemy) ? enemy : -1;
  if (GrappleState.target[id] < 0 && wall >= row.range) return false;
  GrappleState.x[id] = Actors.x[id] + effectDirection.x * wall; GrappleState.y[id] = eyeY + effectDirection.y * wall - Actors.eye[id]; GrappleState.z[id] = Actors.z[id] + effectDirection.z * wall;
  return true;
}
function stepGrapple(id, row) {
  const target = GrappleState.target[id], mover = target >= 0 ? target : id;
  if (target >= 0 && !Actors.alive[target]) return false;
  const toX = target >= 0 ? Actors.x[id] : GrappleState.x[id], toY = target >= 0 ? Actors.y[id] : GrappleState.y[id], toZ = target >= 0 ? Actors.z[id] : GrappleState.z[id];
  const dx = toX - Actors.x[mover], dy = toY - Actors.y[mover], dz = toZ - Actors.z[mover], distance = Math.hypot(dx, dy, dz);
  if (distance <= row.params.arrive) return false;
  const speed = row.params.pullSpeed / distance;
  driveActor(mover, dx * speed, dy * speed, dz * speed);
  return true;
}
// rewind: back to the position and pools of `seconds` ago (or the oldest sample of this life).
function castRewind(id, row) {
  const i = RewindHistory.past(id, row.params.seconds);
  if (i < 0 || !canTeleport(id)) return false;
  moveActorTo(id, RewindHistory.x[i], RewindHistory.y[i], RewindHistory.z[i], row);
  Actors.vx[id] = Actors.vy[id] = Actors.vz[id] = 0;
  Actors.health[id] = Math.max(1, RewindHistory.health[i]); Actors.armor[id] = RewindHistory.armor[i]; Actors.shield[id] = RewindHistory.shield[i];
  RewindHistory.reset(id);
  return true;
}
// glide: while held in the air, the actor's gravity is scaled to params.gravity (Move.gravityScale through Buffs).
function stepGlide(id, row) {
  if (!Move.isGrounded(id)) Buffs.add(id, BUFF.GRAVITY, row.params.gravity, TICK_BUFF);
  return true;
}
// beacon: first use throws the beacon to the aimed floor; the next use teleports there (telefrags whoever stands on it).
function castBeacon(id, row) {
  const existing = AbilityZones.find(ZONE_KIND.BEACON, id);
  if (existing >= 0) { if (!canTeleport(id)) return false; teleportToBeacon(id, existing, row); return true; }
  const at = aimedFloor(id, row.range, placeAt);
  AbilityZones.add(ZONE_KIND.BEACON, id, row, at.x, at.y, at.z, 3600);
  return true;
}
function teleportToBeacon(id, zone, row) {
  const x = AbilityZones.x[zone], y = AbilityZones.y[zone], beaconZ = AbilityZones.z[zone];
  AbilityZones.remove(zone);
  for (let other = 0; other < Actors.count; other++) {
    if (other === id || !Actors.alive[other] || Math.hypot(Actors.x[other] - x, Actors.z[other] - beaconZ) > ACTOR_RADIUS * 2 || Math.abs(Actors.y[other] - y) > STAND_HEIGHT) continue;
    telefragRequest.target = other; telefragRequest.source = id; telefragRequest.x = x; telefragRequest.y = y; telefragRequest.z = beaconZ;
    Bus.emit('damage.request', telefragRequest);
  }
  moveActorTo(id, x, y, beaconZ, row);
}
const PulseState = { done: new Uint8Array(MAX_ACTORS * ABILITY_SLOT_COUNT) };
function castPulse(id, row, slot) { PulseState.done[Abilities.index(id, slot)] = 0; return true; }
// pulse: params.pulses reveals, params.interval apart, the first at once; global pulses reach the whole map.
function stepPulse(id, row, slot) {
  const i = Abilities.index(id, slot), due = Math.floor(Abilities.elapsed[i] / row.params.interval + TICK_EPSILON) + 1;
  if (PulseState.done[i] >= Math.min(due, row.params.pulses)) return true;
  PulseState.done[i]++;
  revealEnemies(id, Actors.x[id], Actors.y[id], Actors.z[id], row.params.global ? UNLIMITED_RANGE : row.range, row.params.reveal);
  return true;
}
function stepSight(id, row, slot) {
  const i = Abilities.index(id, slot);
  if (Abilities.elapsed[i] % SIGHT_INTERVAL > TICK_SECONDS) return true;
  revealEnemies(id, Actors.x[id], Actors.y[id], Actors.z[id], row.range, SIGHT_INTERVAL + TICK_SECONDS);
  return true;
}
// drone: a piloted scout flies along the pilot's view; the pilot stands still and cannot fire; it ends in an EMP.
function castDrone(id, row) {
  AbilityZones.add(ZONE_KIND.DRONE, id, row, Actors.x[id], Actors.eyeY(id), Actors.z[id], row.duration + 1);
  return true;
}
function stepDrone(id, row) {
  Buffs.add(id, BUFF.SLOW, 0, TICK_BUFF);
  Buffs.add(id, BUFF.NO_FIRE, TICK_BUFF, TICK_BUFF);
  return AbilityZones.find(ZONE_KIND.DRONE, id) >= 0;
}
function endDrone(id, row) {
  const zone = AbilityZones.find(ZONE_KIND.DRONE, id);
  if (zone < 0) return;
  const x = AbilityZones.x[zone], y = AbilityZones.y[zone], z = AbilityZones.z[zone], seconds = row.params.empSeconds;
  const count = enemiesNear(id, x, y, z, row.params.empRadius, true);
  // The one EMP path (G20): shields stop recharging, abilities and gadgets are held, devices in the radius switch off.
  for (let k = 0; k < count; k++) { Damage.addStatus(effectIds[k], 'stun', id, seconds, 1); Gadgets.suppress(effectIds[k], seconds); }
  Gadgets.empDevices(id, x, y, z, row.params.empRadius, seconds);
  AbilityZones.remove(zone);
}
// fence: each use plants a node; a node links to the owner's newest node within params.link metres.
function castFence(id, row) {
  const at = aimedFloor(id, row.range, placeAt);
  const previous = newestZone(ZONE_KIND.FENCE, id);
  const zone = AbilityZones.add(ZONE_KIND.FENCE, id, row, at.x, at.y, at.z, row.params.life);
  if (previous >= 0 && Math.hypot(AbilityZones.x[previous] - at.x, AbilityZones.z[previous] - at.z) <= row.params.link) AbilityZones.other[zone] = previous;
  return true;
}
function newestZone(kind, owner) {
  let newest = -1;
  for (let zone = 0; zone < ZONE_CAP; zone++) if (AbilityZones.alive[zone] && AbilityZones.kind[zone] === kind && AbilityZones.owner[zone] === owner && (newest < 0 || AbilityZones.born[zone] >= AbilityZones.born[newest])) newest = zone;
  return newest;
}
// timebend (ABL-004): versus = a slow field around the user; single player / PvE = the whole world except the user.
function castTimebend(id, row) {
  const zone = AbilityZones.add(ZONE_KIND.SLOW, id, row, Actors.x[id], Actors.y[id], Actors.z[id], row.duration);
  AbilityZones.radius[zone] = matchFamily() === 'versus' ? row.params.radius : UNLIMITED_RANGE;
  AbilityZones.value[zone] = row.params.scale;
  return true;
}
// push: enemies in the cone are knocked back; enemy projectiles in it turn around and become the user's.
function castPush(id, row) {
  aimRay(id);
  const cos = Math.cos(row.params.angle * DEG), eyeY = Actors.eyeY(id);
  const count = World.actorsInCone(Actors.x[id], eyeY, Actors.z[id], effectDirection.x, effectDirection.y, effectDirection.z, cos, row.range, id, effectIds);
  for (let k = 0; k < count; k++) {
    const other = effectIds[k];
    if (Actors.isEnemy(id, other)) emitImpulse(other, effectDirection.x * row.params.speed, Math.max(0.3, effectDirection.y) * row.params.speed, effectDirection.z * row.params.speed);
  }
  if (row.params.deflect) deflectProjectiles(id, eyeY, cos, row.range);
  return true;
}
function deflectProjectiles(id, eyeY, cos, range) {
  for (let i = 0; i < PROJECTILE_CAP; i++) {
    if (Projectiles.state[i] !== PROJECTILE_STATE.FLYING || !Actors.isEnemy(id, Projectiles.owner[i])) continue;
    const dx = Projectiles.x[i] - Actors.x[id], dy = Projectiles.y[i] - eyeY, dz = Projectiles.z[i] - Actors.z[id], distance = Math.hypot(dx, dy, dz);
    if (distance > range || distance < 1e-3 || (dx * effectDirection.x + dy * effectDirection.y + dz * effectDirection.z) / distance < cos) continue;
    Projectiles.vx[i] = -Projectiles.vx[i]; Projectiles.vy[i] = -Projectiles.vy[i]; Projectiles.vz[i] = -Projectiles.vz[i];
    Projectiles.owner[i] = id;
  }
}
// link: the aimed enemy and its nearest teammate within params.radius share damage for the duration.
function castLink(id, row) {
  const first = aimTarget(id, row.range);
  if (first < 0) return false;
  const count = enemiesNear(id, Actors.x[first], Actors.y[first], Actors.z[first], row.params.radius, true);
  let second = -1;
  for (let k = 0; k < count; k++) if (effectIds[k] !== first && (second < 0 || closer(first, effectIds[k], second))) second = effectIds[k];
  if (second < 0) return false;
  const until = Sim.time + row.duration;
  LinkState.partner[first] = second; LinkState.partner[second] = first; LinkState.until[first] = LinkState.until[second] = until;
  return true;
}
function closer(from, a, b) {
  return distanceSquared3(Actors.x[from], Actors.y[from], Actors.z[from], Actors.x[a], Actors.y[a], Actors.z[a])
    < distanceSquared3(Actors.x[from], Actors.y[from], Actors.z[from], Actors.x[b], Actors.y[b], Actors.z[b]);
}
// mesmer: up to params.targets visible enemies within range fall into a stare (sleep: damage wakes them) facing the lure.
function castMesmer(id, row) {
  const count = enemiesNear(id, Actors.x[id], Actors.y[id], Actors.z[id], row.range, true);
  const zone = AbilityZones.add(ZONE_KIND.LURE, id, row, Actors.x[id] + Math.sin(Actors.yaw[id]) * 2, Actors.y[id], Actors.z[id] + Math.cos(Actors.yaw[id]) * 2, row.duration);
  let taken = 0;
  for (let k = 0; k < count && taken < row.params.targets; k++) {
    const victim = effectIds[k];
    if (!World.lineClear(Actors.x[id], Actors.eyeY(id), Actors.z[id], Actors.x[victim], Actors.eyeY(victim), Actors.z[victim])) continue;
    Damage.addStatus(victim, 'sleep', id, row.duration, 1);
    if (taken === 0) AbilityZones.target[zone] = victim; else AbilityZones.other[zone] = victim;
    taken++;
  }
  if (!taken) AbilityZones.remove(zone);
  return taken > 0;
}
// possess (A23, fodder and beasts) and frenzy (A24): the target changes side for the duration (frenzy: hostile to all).
// A23 from a player also gives the caster the puppet's controls and view (PuppetState) until the zone goes.
function castTeamSwap(id, row, newTeam) {
  const target = aimTarget(id, row.range), possess = row.effect === 'possess', drive = possess && PuppetState.canDrive(id);
  if (target < 0 || (possess && (!isFodderOrBeast(target) || PuppetState.master[target] >= 0))) return false;
  const zone = AbilityZones.add(drive ? ZONE_KIND.PUPPET : ZONE_KIND.SWAP, id, row, Actors.x[target], Actors.y[target], Actors.z[target], row.duration);
  AbilityZones.target[zone] = target; AbilityZones.value[zone] = Actors.team[target];
  Actors.team[target] = newTeam;
  if (drive) PuppetState.link(id, target, zone);
  return true;
}
function isFodderOrBeast(id) {
  const profile = Actors.profile[id];
  return isFodder(id) || (Actors.kind[id] === ACTOR_KIND.ENEMY && !!profile && profile.beast === true);
}
function castRevive(id, row) {
  const ally = Damage.nearestDownedAlly(id, row.range);
  return ally >= 0 && Damage.revive(ally);
}
// bolt: the aimed enemy takes params.damage of params.element and the status (stacks; seconds 0 = the status default).
// With no enemy in the cone the status reaches the floor patch aimed at (12h: A29 shocks a wet patch, A30 lights oil).
function castBolt(id, row) {
  const target = aimTarget(id, row.range);
  if (target < 0) return FloorSurfaces.boltFloor(id, row);
  const p = row.params, info = Damage.info();
  info.amount = p.damage; info.kind = 'hit'; info.weapon = row.id; info.element = p.element; info.zone = 'body';
  info.x = Actors.x[target]; info.y = Actors.y[target] + 1; info.z = Actors.z[target];
  info.dx = info.x - Actors.x[id]; info.dy = 0; info.dz = info.z - Actors.z[id];
  Damage.apply(id, target, info);
  if (p.status) Damage.addStatus(target, p.status, id, p.seconds, p.stacks);
  return true;
}
// swarm: the aimed enemy (or the nearest params.targets enemies anywhere, global) carries a damaging cloud.
function castSwarm(id, row) {
  if (!row.params.global) return attachSwarm(id, row, aimTarget(id, row.range));
  const count = enemiesNear(id, Actors.x[id], Actors.y[id], Actors.z[id], UNLIMITED_RANGE, true);
  let attached = 0;
  for (let k = 0; k < count && attached < row.params.targets; k++) if (attachSwarm(id, row, effectIds[k])) attached++;
  return attached > 0;
}
function attachSwarm(id, row, target) {
  if (target < 0) return false;
  const zone = AbilityZones.add(ZONE_KIND.SWARM, id, row, Actors.x[target], Actors.y[target], Actors.z[target], row.duration);
  AbilityZones.target[zone] = target; AbilityZones.value[zone] = row.params.dps; AbilityZones.radius[zone] = 1;
  if (isFodder(target)) emitPanic(target, id, row.duration);   // A32: a swarmed fodder enemy panics (S14 PvE makes it flee)
  return true;
}
const PANIC_EVENT = { id: -1, source: -1, seconds: 0 };
function emitPanic(target, source, seconds) {
  PANIC_EVENT.id = target; PANIC_EVENT.source = source; PANIC_EVENT.seconds = seconds;
  Bus.emit('ability.panic', PANIC_EVENT);
}
// decoy: a one-hit double on the user's team keeps the user's last movement input for the duration.
function castDecoy(id, row) {
  const decoy = Actors.create(ACTOR_KIND.DUMMY, Actors.team[id], Actors.name[id], Actors.profile[id]);
  if (decoy < 0) return false;
  Actors.x[decoy] = Actors.prevX[decoy] = Actors.x[id]; Actors.y[decoy] = Actors.prevY[decoy] = Actors.y[id]; Actors.z[decoy] = Actors.prevZ[decoy] = Actors.z[id];
  Actors.yaw[decoy] = Actors.aimYaw[decoy] = Actors.yaw[id]; Actors.alive[decoy] = 1; Actors.health[decoy] = DECOY_HEALTH;
  const zone = AbilityZones.add(ZONE_KIND.DECOY, id, row, Actors.x[id], Actors.y[id], Actors.z[id], row.duration);
  AbilityZones.target[zone] = decoy; AbilityZones.yaw[zone] = Actors.yaw[id];
  AbilityZones.x2[zone] = Actors.moveX[id]; AbilityZones.z2[zone] = Math.abs(Actors.moveX[id]) + Math.abs(Actors.moveZ[id]) > 0.1 ? Actors.moveZ[id] : 1;
  DecoyState.zone[decoy] = zone;
  return true;
}
// telekinesis (A35): the lifter's pull on press and its punt on release, without the weapon in a slot.
function lifterTool(id, row, toolName, modeName) {
  const weapon = CAT.weapons.byId(row.params.weapon);
  Weapons.tools[weapon[modeName].tool || toolName](id, weapon, weapon[modeName]);
}
const GateState = { next: new Uint8Array(MAX_ACTORS) };
function castGate(id, row) {
  const weapon = CAT.weapons.byId(row.params.weapon), gate = GateState.next[id];
  WeaponSpecialState.placeGate(id, gate === 0 ? weapon.primary : weapon.alt, gate);
  GateState.next[id] = 1 - gate;
  return true;
}
// rift: linked gates at the user's feet and the aimed floor point; allies (or the user alone in free-for-all) pass through.
function castRift(id, row) {
  const at = aimedFloor(id, row.range, placeAt);
  const entry = AbilityZones.add(ZONE_KIND.RIFT, id, row, Actors.x[id], Actors.y[id], Actors.z[id], row.duration);
  const exit = AbilityZones.add(ZONE_KIND.RIFT, id, row, at.x, at.y, at.z, row.duration);
  AbilityZones.other[entry] = exit; AbilityZones.other[exit] = entry;
  AbilityZones.rearm[id] = Sim.time + row.params.rearm;
  return true;
}
// rally: every living ally (the user alone without a team) gains surplus shield (inside the PU07 cap, lost again with the speed)
// and speed for the duration.
function castRally(id, row) {
  const cap = CAT.powerups.byId('surplus').instant.surplusCap;
  for (let other = 0; other < Actors.count; other++) {
    if (!Actors.alive[other] || !alliesOf(id, other)) continue;
    const granted = Math.min(row.params.surplus, Math.max(0, cap - Damage.surplus[other]));
    Damage.surplus[other] += granted;
    RallyShield.amount[other] += granted; RallyShield.until[other] = Sim.time + row.duration;
    Buffs.add(other, BUFF.SPEED, row.params.speed, row.duration);
  }
  return true;
}

// ---- Suit weaves (HPP08 energy bar) ----
function stepSuitArmor(id) { Buffs.add(id, BUFF.ENERGY_REGEN, CAT.abilities.byId('bulwark').params.regenScale, TICK_BUFF); return true; }
// A02 works (speed and drain) only while sprinting when params.sprintOnly is set.
function overdriveWorking(id, row) { return !row.params.sprintOnly || (Actors.flags[id] & ACTOR_FLAG.SPRINTING) !== 0; }
function drainSuitSpeed(id, row) { return overdriveWorking(id, row) ? row.costPerSecond : 0; }
function stepSuitSpeed(id, row) { if (overdriveWorking(id, row)) Buffs.add(id, BUFF.SPEED, row.params.speed, TICK_BUFF); return true; }
function stepSuitStrength(id, row) { Buffs.add(id, BUFF.MELEE, row.params.melee, TICK_BUFF); return true; }
function drainCloak(id, row) { return Move.horizontalSpeed(id) > row.params.stillSpeed ? row.costPerSecond : row.params.stillCostPerSecond; }
function stepCloak(id) { Buffs.add(id, BUFF.INVISIBLE, 1, TICK_BUFF); return true; }
function endCloak(id, row, slot, reason) {
  if (reason === 'fire') Meters.energy[id] = 0;   // A04: firing empties the bar
  Buffs.cancel(id, BUFF.INVISIBLE);
  Buffs.applyInvisible(id, false);
}
// A03 strength jump (height x params.jumpHeight, so velocity x its square root) and melee, each paid params.useCost;
// steadier aim is free while the weave is on.
function strengthJump(event) {
  const row = CAT.abilities.byId('colossusweave');
  if (!Abilities.isActive(event.id, row.id) || !Meters.spendEnergy(event.id, row.params.useCost)) return;
  Actors.vy[event.id] *= Math.sqrt(row.params.jumpHeight);
}
function strengthShot(event) {
  const row = CAT.abilities.byId('colossusweave');
  if (!Abilities.isActive(event.id, row.id)) return;
  if (event.mode === 'melee' || event.weaponClass === 'melee') { if (Meters.spendEnergy(event.id, row.params.useCost)) strengthThrow(event.id, row.params); return; }
  Weapons.recoilPitch[event.id] *= row.params.steady; Weapons.recoilYaw[event.id] *= row.params.steady;
}
// A03 throw: a paid melee swing hurls the enemy in front (a bot, a PvE enemy) along the view; with none in reach it throws
// the prop or debris piece in front instead (S08 PropLift, the W41 Lifter's mass limit and impact damage).
function strengthThrow(id, params) {
  Vec.fromAngles(specialScratch, Actors.yaw[id], Actors.pitch[id]);
  const target = actorInFront(id, params.throwReach), speed = params.throwSpeed;
  if (target >= 0 && Actors.isEnemy(id, target)) {
    emitImpulse(target, specialScratch.x * speed, specialScratch.y * speed + params.throwLift, specialScratch.z * speed);
    return;
  }
  const lift = WeaponSpecialState.propHook;
  const body = lift ? lift.grab(id, Actors.x[id], Actors.eyeY(id), Actors.z[id], specialScratch.x, specialScratch.y, specialScratch.z, params.throwReach, LIFTER_MAX_MASS) : -1;
  if (body >= 0) lift.launch(body, specialScratch.x * speed, specialScratch.y * speed + params.throwLift, specialScratch.z * speed, LIFTER_DAMAGE_PER_MASS_SPEED, LIFTER_DAMAGE_CAP);
}

// ---- HP-005 status combos (Damage.statusHooks): wet + Shock stuns everyone in that water, Shock chains once, Burn melts ice ----
// (floor patches of wet floor and oil react in 12h FloorSurfaces)
const WET_SHOCK_RADIUS = 8;              // wading actors this close to a shocked wet target share its water
const SHOCK_CHAIN_RADIUS = 4;            // a Shock jumps once to the source's nearest enemy this close to the target
const ComboState = { spreading: false, freeze: CAT.statusEffects.byId('freeze').index, chill: CAT.statusEffects.byId('chill').index };
function isWet(id) { return (Motion.medium[id] & TRIGGER_MEDIUM.WADING) !== 0; }
function statusCombo(id, row, source, seconds) {
  if (ComboState.spreading) return;   // statuses a combo hands out never combo again
  ComboState.spreading = true;
  try {
    if (row.id === 'shock') { shockWater(id, source, seconds); chainShock(id, source, seconds); }
    if (row.id === 'burn') meltIce(id, source);
  } finally { ComboState.spreading = false; }
}
function shockWater(id, source, seconds) {
  if (!isWet(id)) return;
  for (let other = 0; other < Actors.count; other++) {
    if (other === id || !Actors.alive[other] || !isWet(other)) continue;
    if (distanceSquared3(Actors.x[id], Actors.y[id], Actors.z[id], Actors.x[other], Actors.y[other], Actors.z[other]) <= WET_SHOCK_RADIUS * WET_SHOCK_RADIUS) Damage.addStatus(other, 'shock', source, seconds, 1);
  }
}
function chainShock(id, source, seconds) {
  if (source < 0) return;
  const next = nearestChainTarget(source, id, SHOCK_CHAIN_RADIUS, id < 32 ? 1 << id : 0, id >= 32 ? 1 << (id - 32) : 0);
  if (next >= 0) Damage.addStatus(next, 'shock', source, seconds, 1);
}
// A30 Ignite (and any Burn) thaws a chilled or frozen target; a thawed Freeze leaves its ice as a wet patch (12h).
const THAW_SURFACE = 'wet';
function meltIce(id, source) {
  if (Damage.hasStatus(id, 'freeze')) { Damage.clearStatus(id, ComboState.freeze); FloorSurfaces.spillUnder(id, THAW_SURFACE, source); }
  if (Damage.hasStatus(id, 'chill')) Damage.clearStatus(id, ComboState.chill);
}
Damage.statusHooks.push(statusCombo);
Object.assign(Abilities.effects, {
  zone: { cast: castZone },
  blink: { cast: castBlink },
  buff: { cast: castBuff },
  grapple: { cast: castGrapple, step: stepGrapple },
  rewind: { cast: castRewind },
  glide: { cast: () => true, step: stepGlide },
  beacon: { cast: castBeacon },
  pulse: { cast: castPulse, step: stepPulse },
  sight: { cast: () => true, step: stepSight },
  drone: { cast: castDrone, step: stepDrone, end: endDrone },
  tracker: { cast: () => true },
  fence: { cast: castFence },
  timebend: { cast: castTimebend },
  push: { cast: castPush },
  link: { cast: castLink },
  mesmer: { cast: castMesmer },
  possess: { cast: (id, row) => castTeamSwap(id, row, Actors.team[id]), step: (id) => !PuppetState.canDrive(id) || PuppetState.puppet[id] >= 0, end: (id) => PuppetState.release(id) },
  frenzy: { cast: (id, row) => castTeamSwap(id, row, HOSTILE_TO_ALL) },
  revive: { cast: castRevive },
  bolt: { cast: castBolt },
  swarm: { cast: castSwarm },
  decoy: { cast: castDecoy },
  telekinesis: { cast(id, row) { lifterTool(id, row, 'lifterPull', 'alt'); return true; }, end(id, row) { lifterTool(id, row, 'lifterPunt', 'primary'); } },
  gates: { cast: castGate },
  rift: { cast: castRift },
  rally: { cast: castRally },
  suitArmor: { cast: () => true, step: stepSuitArmor },
  suitSpeed: { cast: () => true, step: stepSuitSpeed, drain: drainSuitSpeed },
  suitStrength: { cast: () => true, step: stepSuitStrength },
  cloak: { cast: () => true, step: stepCloak, drain: drainCloak, end: endCloak },
});

// ---- Hero passives (kinds other than an ability in the passive slot) ----
// The support regen (H06, H07) is the HPP05 role regen of S11 (Damage.roleOf below); shieldRegen (H02) adds its own
// shield recharge on top of the preset one.
Object.assign(Abilities.passives, {
  shieldRegen: { step: stepShieldRegen },
});
function stepShieldRegen(id, passive, dt) {
  if (Sim.time - Damage.lastDamageTime[id] < passive.delay || Damage.shieldRegenBlocked(id)) return;
  Actors.shield[id] = Math.min(Actors.maxShield[id], Actors.shield[id] + passive.rate * dt);
}
function heroPassive(id, kind) {
  const hero = Abilities.hero[id];
  return hero && hero.passive.kind === kind ? hero.passive : null;
}
function stepHeroPassives(dt) {
  for (let id = 0; id < Actors.count; id++) {
    const hero = Abilities.hero[id];
    if (!hero || !Actors.alive[id]) continue;
    const handler = Abilities.passives[hero.passive.kind];
    if (handler) handler.step(id, hero.passive, dt);
  }
}
Abilities.passiveFlag = (id, flag) => { const passive = heroPassive(id, 'flag'); return !!passive && passive.flag === flag; };
Abilities.hiddenFromPulse = null;   // fn(id) -> true for actors pulses skip (S13 fills it: Ghost perk)
// HPP05 role regen reads the role of this life: the hero's role in hero rulesets, else the bot profile's.
Damage.roleOf = (id) => {
  const hero = Abilities.hero[id], profile = Actors.profile[id];
  if (hero) return hero.role;
  return profile && profile.role ? profile.role : '';
};

// ---- Damage hooks ----
Damage.addAttackerScale((source, target, info) => {
  if (source < 0) return 1;
  let scale = Buffs.get(source, BUFF.DAMAGE);
  if (info.kind === 'melee') scale *= Buffs.get(source, BUFF.MELEE);
  if (Buffs.has(source, BUFF.TOUCH_KILL) && !isBoss(target)) scale *= WRATH_FACTOR;
  return scale * ampWallFactor(source, target);
});
Weapons.rayBlockers.push(domeBlockDistance);
Damage.addReducer((source, target, amount, info) => {
  if (DecoyState.zone[target] >= 0) { AbilityZones.remove(DecoyState.zone[target]); return 0; }   // a double vanishes on the first hit
  if (Buffs.has(target, BUFF.INVULNERABLE)) return 0;
  if (source >= 0 && source !== target && info.kind !== 'dot' && shotBlocked(source, target)) return 0;
  const passive = heroPassive(target, 'knockbackResist');
  if (passive) info.knockback *= 1 - passive.value;
  return bulwarkAbsorb(target, amount);
});
// A01: damage drains the energy bar 1:1 before anything else.
function bulwarkAbsorb(target, amount) {
  if (!Abilities.isActive(target, 'bulwark')) return amount;
  const absorbed = Math.min(Meters.energy[target], amount);
  Meters.spendEnergy(target, absorbed);
  return amount - absorbed;
}
// Domes stop shots that cross their surface; amp walls stop shots from the front.
function shotBlocked(source, target) {
  for (let zone = 0; zone < ZONE_CAP; zone++) {
    if (!AbilityZones.alive[zone]) continue;
    if (AbilityZones.kind[zone] === ZONE_KIND.DOME && domeSeparates(zone, source, target)) return true;
    if (AbilityZones.kind[zone] === ZONE_KIND.WALL && wallCrossing(zone, source, target) > 0 && Actors.isEnemy(AbilityZones.owner[zone], source)) return true;
  }
  return false;
}
// Weapons.rayBlockers: A26 domes stop bullets where the ray crosses their surface, from outside or from inside.
function domeBlockDistance(ox, oy, oz, dx, dy, dz, maxDistance) {
  let best = -1;
  for (let zone = 0; zone < ZONE_CAP; zone++) {
    if (!AbilityZones.alive[zone] || AbilityZones.kind[zone] !== ZONE_KIND.DOME) continue;
    const distance = raySphereSurface(ox, oy, oz, dx, dy, dz, AbilityZones.x[zone], AbilityZones.y[zone], AbilityZones.z[zone], AbilityZones.radius[zone]);
    if (distance >= 0 && distance <= maxDistance && (best < 0 || distance < best)) best = distance;
  }
  return best;
}
// Distance to a sphere's surface along a unit ray: the entry point from outside, the exit point from inside; -1 when missed.
function raySphereSurface(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius) {
  const px = ox - cx, py = oy - cy, pz = oz - cz;
  const b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - radius * radius;
  if (c > 0) return raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius);
  return -b + Math.sqrt(b * b - c);
}
function domeSeparates(zone, source, target) {
  const sourceInside = AbilityZones.insideSphere(zone, Actors.x[source], Actors.eyeY(source), Actors.z[source]);
  return sourceInside !== AbilityZones.insideSphere(zone, Actors.x[target], Actors.y[target] + 1, Actors.z[target]);
}
// +1: the shot crosses the wall from its front (incoming), -1: from behind (outgoing), 0: misses the wall.
function wallCrossing(zone, source, target) {
  const nx = Math.sin(AbilityZones.yaw[zone]), nz = Math.cos(AbilityZones.yaw[zone]), cx = AbilityZones.x[zone], cz = AbilityZones.z[zone];
  const front = (Actors.x[source] - cx) * nx + (Actors.z[source] - cz) * nz, back = (Actors.x[target] - cx) * nx + (Actors.z[target] - cz) * nz;
  if (front * back >= 0) return 0;
  const t = front / (front - back), x = lerp(Actors.x[source], Actors.x[target], t), crossZ = lerp(Actors.z[source], Actors.z[target], t);
  const y = lerp(Actors.eyeY(source), Actors.y[target] + 1, t) - AbilityZones.y[zone];
  const lateral = Math.abs((x - cx) * nz - (crossZ - cz) * nx);
  if (lateral > AbilityZones.radius[zone] || y < 0 || y > AbilityZones.height[zone]) return 0;
  return front > 0 ? 1 : -1;
}
function ampWallFactor(source, target) {
  for (let zone = 0; zone < ZONE_CAP; zone++) {
    if (!AbilityZones.alive[zone] || AbilityZones.kind[zone] !== ZONE_KIND.WALL || !alliesOf(AbilityZones.owner[zone], source)) continue;
    if (wallCrossing(zone, source, target) < 0) return zoneRow(zone).params.amp;
  }
  return 1;
}
// A21: damage to one linked enemy is dealt to its partner too (once, not echoed back).
function shareLinkedDamage(event) {
  const partner = LinkState.partner[event.target];
  if (LinkState.sharing || partner < 0 || LinkState.until[event.target] <= Sim.time || !Actors.alive[partner] || event.amount <= 0) return;
  LinkState.sharing = true;
  const info = Damage.info();
  info.amount = event.amount; info.kind = 'dot'; info.weapon = 'binding'; info.element = event.element;
  info.x = Actors.x[partner]; info.y = Actors.y[partner] + 1; info.z = Actors.z[partner];
  Damage.apply(event.source, partner, info);
  LinkState.sharing = false;
}
function onAbilityKill(event) {
  const passive = event.killer >= 0 ? heroPassive(event.killer, 'killHaste') : null;
  if (passive && event.killer !== event.victim) Buffs.add(event.killer, BUFF.SPEED, passive.speed, passive.seconds);
  LinkState.partner[event.victim] = -1;
}

// ---- Drawing: zones, beacons, fences, the tracker's footprints (render only, never in headless runs) ----
function drawZone(batch, zone) {
  const kind = AbilityZones.kind[zone], row = AbilityZones.ability[zone] >= 0 ? zoneRow(zone) : null;
  const color = row ? row.color : 0xffffff, r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
  const x = AbilityZones.x[zone], y = AbilityZones.y[zone], zoneZ = AbilityZones.z[zone], radius = Math.min(AbilityZones.radius[zone], 60);
  if (kind === ZONE_KIND.DOME) batch.mesh('sphere', x, y, zoneZ, 0, 0, radius * 2, radius * 2, radius * 2, r, g, b, 0.3);
  else if (kind === ZONE_KIND.WALL) batch.mesh('box', x, y + AbilityZones.height[zone] / 2, zoneZ, AbilityZones.yaw[zone], 0, radius * 2, AbilityZones.height[zone], 0.2, r, g, b, 0.2);
  else if (kind === ZONE_KIND.STRIKE) batch.mesh('ring', x, y + 0.05, zoneZ, 0, 0, radius * 2, 0.05, radius * 2, 1, 0.2, 0.2, 1);
  else if (kind === ZONE_KIND.FENCE || kind === ZONE_KIND.BEACON || kind === ZONE_KIND.DRONE) batch.mesh('sphere', x, y + 0.3, zoneZ, 0, 0, 0.3, 0.3, 0.3, r, g, b, 0.8);
  else if (radius > 0 && radius < 60) batch.mesh('ring', x, y + 0.05, zoneZ, 0, 0, radius * 2, 0.05, radius * 2, r, g, b, 0.6);
}
// A16: enemy footprints of the last params.seconds are visible to a viewer with Tracker Sense.
function footprintVisible(viewer, i) {
  const owner = Footprints.owner[i];
  if (owner < 0 || viewer < 0 || Abilities.slotOf(viewer, 'tracker') < 0) return false;
  return Sim.time - Footprints.time[i] <= CAT.abilities.byId('tracker').params.seconds && Actors.isEnemy(viewer, owner);
}
function drawFootprints(batch) {
  const viewer = Game.playerId;
  if (viewer < 0 || Abilities.slotOf(viewer, 'tracker') < 0) return;
  for (let i = 0; i < FOOTPRINT_COUNT; i++) {
    if (!footprintVisible(viewer, i)) continue;
    batch.mesh('cylinder', Footprints.x[i], Footprints.y[i] + 0.02, Footprints.z[i], 0, 0, FOOTPRINT_SIZE, 0.02, FOOTPRINT_SIZE, 1, 0.8, 0.2, 0.8);
  }
}
function abilityStyle(id, out) {
  if (Game.playerId >= 0 && PuppetState.master[id] === Game.playerId) out.visible = false;   // A23: the camera is inside it
  if (Buffs.has(id, BUFF.TOUCH_KILL)) { out.r = 1; out.g = 0.15; out.b = 0.1; out.emissive = 0.8; out.scale = 1.15; }
  else if (Buffs.has(id, BUFF.INVULNERABLE)) { out.emissive = Math.max(out.emissive, 0.6); }
  else if (Buffs.has(id, BUFF.DAMAGE)) { out.r = Math.min(1, out.r + 0.3); out.emissive = Math.max(out.emissive, 0.4); }
}

Render.addActorStyle(abilityStyle);
Render.addSource('abilities', (batch) => {
  for (let zone = 0; zone < ZONE_CAP; zone++) if (AbilityZones.alive[zone]) drawZone(batch, zone);
  drawFootprints(batch);
});
Sim.addSystem('abilityHistory', 21, () => { RewindHistory.record(); stepHeroPassives(TICK_SECONDS); });
Sim.addSystem('puppet', PUPPET_DRIVE_ORDER, () => PuppetState.drive());
Sim.addSystem('puppetRestore', PUPPET_RESTORE_ORDER, () => PuppetState.restore());
Render.cameraOverride = (camera) => PuppetState.placeCamera(camera);   // the first owner: 16x and 17e chain after it
Input.aimAssistFilters.push((id) => PuppetState.puppet[id] < 0);   // no assist from the caster's still body while it drives
Bus.on('actor.spawn', (event) => { RallyShield.amount[event.id] = 0; RewindHistory.reset(event.id); GrappleState.target[event.id] = -1; LinkState.partner[event.id] = -1; });
Bus.on('actor.create', (id) => { RallyShield.amount[id] = 0; RewindHistory.reset(id); DecoyState.zone[id] = -1; LinkState.partner[id] = -1; Buffs.clear(id); });
Bus.on('actor.remove', (id) => { if (DecoyState.zone[id] >= 0) { AbilityZones.target[DecoyState.zone[id]] = -1; DecoyState.zone[id] = -1; } });
Bus.on('move.step', (event) => Footprints.add(event.id, event.loudness));
Bus.on('move.jump', strengthJump);
Bus.on('weapon.fire', strengthShot);
Bus.on('damage', shareLinkedDamage);
Bus.on('kill', onAbilityKill);
Bus.on('match.stop', () => Footprints.clear());
Gadgets.attackLocks.push((id) => Buffs.has(id, BUFF.NO_FIRE));
