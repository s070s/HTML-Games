// S08 add-on: map trigger volumes (MOV-019, MOV-020). map.triggers = [{ kind, min: [x,y,z], max: [x,y,z], ...fields }]:
//   jumppad    { target: [x,y,z], peak: 2 }   launch so the arc tops out `peak` m above the higher of feet and target, lands on target
//   teleporter { exit: [x,y,z], yaw: 0 }      exit feet position and facing (degrees); speed magnitude kept; telefrags occupants
//   ladder     {}                             climbing volume (S10 moves at the ladder speed)
//   water      {}                             swim volume; its top is the surface; head under -> drown timer
//   hazard     { damage: 10, element: 'fire' }  damage per second while touching
//   killzone   {}                             kills on touch (a hazard with lethal damage)
// S10 calls World.touchTriggers(id, gravity) once per actor step after moving it; the returned bits say which media it is in.
// Rows with a bad box (min/max not 3 numbers each, min above max), a bad target/exit or peak <= 0 are logged and skipped.

// WATER: deep enough to swim; WADING: touching any water (the swimmer's water-exit reach applies).
const TRIGGER_MEDIUM = { WATER: 1, LADDER: 2, HEAD_UNDER: 4, MOVED: 8, WADING: 16 };
const AIR_SECONDS = 12;                 // MOV-019: breath under water before drowning
const DROWN_START_DAMAGE = 2;           // HP per second when the air runs out...
const DROWN_DAMAGE_RISE = 2;            // ...rising this much every second...
const DROWN_MAX_DAMAGE = 15;            // ...up to this
const DROWN_INTERVAL = 1;               // seconds between drown damage requests
const HAZARD_INTERVAL = 0.5;            // seconds between hazard damage requests
const LETHAL_DAMAGE = 100000;
const JUMPPAD_REARM = 0.3;              // seconds before the same actor can be launched again
const MIN_PAD_GRAVITY = 0.5;            // m/s^2 floor so a zero-gravity mutator still gives a finite arc
const MIN_PAD_FLIGHT = 0.1;             // seconds: a launch never divides by a zero flight time
const JUMPPAD_PEAK = 2;                 // default metres the arc rises above the higher of feet and target
const FALL_OUT_DEPTH = 30;              // metres below the lowest brush that count as falling out of the world
const TELEFRAG_REACH = 0.8;             // two capsules (radius 0.40 each) overlap when closer than this
const SWIM_DEPTH_FRACTION = 0.5;        // swimming once the water reaches the capsule's middle

// fields: defaults (Data.normalize); points: fields that must be [x, y, z]; valid(trigger): extra row check.
const TRIGGER_KINDS = {
  jumppad: { fields: { target: REQUIRED, peak: JUMPPAD_PEAK }, points: ['target'], valid: (pad) => pad.peak > 0, touch: touchJumpPad },
  teleporter: { fields: { exit: REQUIRED, yaw: 0 }, points: ['exit'], touch: touchTeleporter },
  ladder: { fields: {}, touch: () => TRIGGER_MEDIUM.LADDER },
  water: { fields: {}, touch: touchWater },
  hazard: { fields: { damage: 10, element: 'fire' }, touch: touchHazard },
  killzone: { fields: { damage: LETHAL_DAMAGE, element: 'none' }, touch: touchHazard },
};

const TriggerState = {
  air: new Float32Array(MAX_ACTORS).fill(AIR_SECONDS),
  drownClock: new Float32Array(MAX_ACTORS),
  drownCount: new Uint8Array(MAX_ACTORS),
  hazardClock: new Float32Array(MAX_ACTORS),
  padClock: new Float32Array(MAX_ACTORS),
  touchedHazard: false,
  reset(id) {
    this.air[id] = AIR_SECONDS; this.drownClock[id] = 0; this.drownCount[id] = 0; this.hazardClock[id] = 0; this.padClock[id] = 0;
  },
};

const damageRequest = { target: 0, source: 0, amount: 0, kind: 'hazard', element: 'none', x: 0, y: 0, z: 0 };
const triggerEvent = { id: 0, kind: '', index: 0, x: 0, y: 0, z: 0 };
const fallOutTrigger = { kind: 'killzone', index: -1, damage: LETHAL_DAMAGE, element: 'none' };

World.triggers = [];

World.addPart({
  load(map) { World.triggers = (map.triggers || []).map(makeTrigger).filter((trigger) => trigger !== null); },
  clear() { World.triggers = []; },
});

function makeTrigger(source, index) {
  const kind = TRIGGER_KINDS[source.kind];
  if (!kind) return rejectTrigger('unknown trigger kind ' + source.kind, index);
  if (!validBox(source.min, source.max)) return rejectTrigger('bad min/max box', index);
  const trigger = Data.normalize(kind.fields, source);
  if (kind.points && !kind.points.every((field) => isPoint(trigger[field]))) return rejectTrigger('bad ' + kind.points.join('/') + ' point', index);
  if (kind.valid && !kind.valid(trigger)) return rejectTrigger('bad ' + source.kind + ' fields', index);
  trigger.kind = source.kind; trigger.index = index; trigger.handler = kind.touch;
  trigger.minX = source.min[0]; trigger.minY = source.min[1]; trigger.minZ = source.min[2];
  trigger.maxX = source.max[0]; trigger.maxY = source.max[1]; trigger.maxZ = source.max[2];
  return trigger;
}

function rejectTrigger(problem, index) {
  ErrorLog.add('world.triggers', problem + ' at trigger ' + index);
  return null;
}

const isPoint = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const validBox = (min, max) => isPoint(min) && isPoint(max) && min.every((value, axis) => value <= max[axis]);

// Applies every trigger the actor's capsule touches; returns TRIGGER_MEDIUM bits. gravity: the actor's m/s^2 (jump pad arcs).
World.touchTriggers = function touchTriggers(id, gravity) {
  const x = Actors.x[id], y = Actors.y[id], z = Actors.z[id], top = y + Actors.height[id];
  let medium = 0;
  TriggerState.touchedHazard = false;
  TriggerState.padClock[id] = Math.max(0, TriggerState.padClock[id] - TICK_SECONDS);
  for (let i = 0; i < World.triggers.length; i++) {
    const t = World.triggers[i];
    if (x + ACTOR_RADIUS < t.minX || x - ACTOR_RADIUS > t.maxX || z + ACTOR_RADIUS < t.minZ || z - ACTOR_RADIUS > t.maxZ) continue;
    if (top < t.minY || y > t.maxY) continue;
    medium |= t.handler(id, t, gravity);
    if (medium & TRIGGER_MEDIUM.MOVED) break; // teleported: the old position's other triggers no longer apply
  }
  if (Number.isFinite(World.boundsMin.y) && y < World.boundsMin.y - FALL_OUT_DEPTH) touchHazard(id, fallOutTrigger, gravity);
  if (!TriggerState.touchedHazard) TriggerState.hazardClock[id] = 0;
  updateBreath(id, (medium & TRIGGER_MEDIUM.HEAD_UNDER) !== 0);
  return medium;
};

function emitTrigger(id, trigger) {
  triggerEvent.id = id; triggerEvent.kind = trigger.kind; triggerEvent.index = trigger.index;
  triggerEvent.x = Actors.x[id]; triggerEvent.y = Actors.y[id]; triggerEvent.z = Actors.z[id];
  Bus.emit('world.trigger', triggerEvent);
}

// The one 'damage.request' emitter of S08 and S10 (falls, triggers, bodies); the point defaults to the target's feet.
function requestDamage(target, source, amount, kind, element) {
  requestDamageAt(target, source, amount, kind, element, Actors.x[target], Actors.y[target], Actors.z[target]);
}

function requestDamageAt(target, source, amount, kind, element, x, y, z) {
  damageRequest.target = target; damageRequest.source = source; damageRequest.amount = amount;
  damageRequest.kind = kind; damageRequest.element = element; damageRequest.x = x; damageRequest.y = y; damageRequest.z = z;
  Bus.emit('damage.request', damageRequest);
}

const padArc = { upSpeed: 0, time: 0 };

// Ballistic jump pad arc (MOV-019 designer height): up to `peak` m above the higher of the start and the target, then
// down onto the target, for this gravity. Fills and returns padArc { upSpeed, time }. S09 times its pad links with it.
World.padArc = function padArcFor(pad, startY, gravity) {
  const g = Math.max(MIN_PAD_GRAVITY, gravity), target = pad.target, peak = pad.peak === undefined ? JUMPPAD_PEAK : pad.peak;
  const peakY = Math.max(startY, target[1]) + peak;
  padArc.upSpeed = Math.sqrt(2 * g * (peakY - startY));
  padArc.time = Math.max(MIN_PAD_FLIGHT, padArc.upSpeed / g + Math.sqrt(2 * (peakY - target[1]) / g));
  return padArc;
};

function touchJumpPad(id, pad, actorGravity) {
  if (TriggerState.padClock[id] > 0) return 0;
  const target = pad.target, arc = World.padArc(pad, Actors.y[id], actorGravity);
  Actors.vx[id] = (target[0] - Actors.x[id]) / arc.time;
  Actors.vy[id] = arc.upSpeed;
  Actors.vz[id] = (target[2] - Actors.z[id]) / arc.time;
  TriggerState.padClock[id] = JUMPPAD_REARM;
  emitTrigger(id, pad);
  return 0;
}

// Moves the actor to the exit facing the exit yaw; horizontal speed turns with it (magnitude kept). Telefrag: every
// other live capsule at the exit gets a lethal 'telefrag' damage request credited to the arriving actor (MOV-020).
function touchTeleporter(id, teleporter) {
  const yaw = teleporter.yaw * DEG, exit = teleporter.exit;
  const horizontalSpeed = Math.hypot(Actors.vx[id], Actors.vz[id]);
  Actors.x[id] = Actors.prevX[id] = exit[0]; Actors.y[id] = Actors.prevY[id] = exit[1]; Actors.z[id] = Actors.prevZ[id] = exit[2];
  Actors.yaw[id] = Actors.prevYaw[id] = Actors.aimYaw[id] = yaw;
  Actors.vx[id] = Math.sin(yaw) * horizontalSpeed; Actors.vz[id] = Math.cos(yaw) * horizontalSpeed;
  telefragAt(id);
  emitTrigger(id, teleporter);
  return TRIGGER_MEDIUM.MOVED;
}

function telefragAt(arriver) {
  const x = Actors.x[arriver], y = Actors.y[arriver], z = Actors.z[arriver], top = y + Actors.height[arriver];
  for (let other = 0; other < Actors.count; other++) {
    if (other === arriver || !Actors.alive[other]) continue;
    if ((Actors.x[other] - x) ** 2 + (Actors.z[other] - z) ** 2 >= TELEFRAG_REACH * TELEFRAG_REACH) continue;
    if (Actors.y[other] > top || Actors.y[other] + Actors.height[other] < y) continue;
    requestDamage(other, arriver, LETHAL_DAMAGE, 'telefrag', 'none');
  }
}

function touchWater(id, water) {
  let medium = TRIGGER_MEDIUM.WADING;
  if (Actors.y[id] + Actors.height[id] * SWIM_DEPTH_FRACTION < water.maxY) medium |= TRIGGER_MEDIUM.WATER;
  if (Actors.y[id] + Actors.eye[id] < water.maxY) medium |= TRIGGER_MEDIUM.HEAD_UNDER;
  return medium;
}

// Hazards and kill zones: damage every HAZARD_INTERVAL while touching, the first tick on contact.
function touchHazard(id, hazard) {
  if (TriggerState.touchedHazard) return 0; // overlapping hazards hurt once per interval, not once each
  TriggerState.touchedHazard = true;
  TriggerState.hazardClock[id] -= TICK_SECONDS;
  if (TriggerState.hazardClock[id] > 0) return 0;
  TriggerState.hazardClock[id] = HAZARD_INTERVAL;
  const amount = hazard.damage >= LETHAL_DAMAGE ? LETHAL_DAMAGE : hazard.damage * HAZARD_INTERVAL;
  requestDamage(id, -1, amount, 'hazard', hazard.element);
  return 0;
}

// MOV-019: 12 s of air, then 2 HP/s rising by 2 every second up to 15 HP/s; breathing refills the air at once.
function updateBreath(id, headUnder) {
  if (!headUnder) { TriggerState.air[id] = AIR_SECONDS; TriggerState.drownClock[id] = 0; TriggerState.drownCount[id] = 0; return; }
  if (TriggerState.air[id] > 0) { TriggerState.air[id] = Math.max(0, TriggerState.air[id] - TICK_SECONDS); return; }
  TriggerState.drownClock[id] += TICK_SECONDS;
  if (TriggerState.drownClock[id] < DROWN_INTERVAL) return;
  TriggerState.drownClock[id] -= DROWN_INTERVAL;
  const amount = Math.min(DROWN_MAX_DAMAGE, DROWN_START_DAMAGE + DROWN_DAMAGE_RISE * TriggerState.drownCount[id]);
  TriggerState.drownCount[id]++;
  requestDamage(id, -1, amount, 'drown', 'none');
}

World.airLeft = (id) => TriggerState.air[id];

Bus.on('actor.create', (id) => TriggerState.reset(id));
Bus.on('actor.spawn', (event) => TriggerState.reset(event.id));
