// ==== S07 RENDER: WEAPON ANIMATION (P6-02, P6-03, P6-04) ====
// Plays the reload sets and melee strikes of 03b-data-animations as layers over the weapon pose. It READS sim state only (the
// Render.viewModel record for the local player's first-person weapon, Render.actorAction for every body) and never writes it:
// reload times, damage times, recoil and equip times are the sim's. Every phase is a fraction of the reload or melee cycle in
// progress, so attachments and perks scale it, and the last phase ends at fraction 1 = the step the rounds are added (reload) or
// the moment the weapon may act again (melee).
//
// First person (07e fillViewModel): ViewAction.update(state, model, seconds) sums the layers into offsets for the weapon pivot and
// moves of the weapon's role parts (magazine, slide, bolt...). Priority (P6-04, a higher layer sets the weight of every lower one
// to 0 with a blend; no layer ever snaps): swap > reload > melee > block > charge or action cycle > sprint; ADS, kick, bob and sway
// are the base pose (07e poseWeapon) and the hit knock rides on top. Every offset is 0 in the idle hold pose, so the muzzle maths
// (11e) and the 2 mm view-model probe stay valid. Third person (07c animateActor): computeActorAction fills ActorAction, pitches and
// offsets of the arms, gun, torso and head, for near and far bodies; never for killcam replay bodies or distant ones.
//
// PERF-006: nothing here allocates per frame. Typed arrays and records made at load hold every float, and the functions of the sampling
// chain take records (a ReloadSample, a MeleeSample, the Render.viewModel or Render.actorAction record), never a computed float: a float
// argument to a function V8 does not inline is boxed on the heap on every call.

const POSE_FLOATS = 6;                   // x y z (metres), pitch yaw roll (radians): the offsets of one layer
const KEY_FLOATS = 7;                    // a pose and the work envelope (1 = at the work pose, 0 = at the hold pose)
const ROLE_FLOATS_TOTAL = MODEL_ROLES.length * MODEL_ROLE_MOVE_FLOATS;
const REACH_RAMP = 0.4;                  // share of a 'reach' phase the weapon takes to come to the work pose
const TP_KEYS = ['gun', 'gunDrop', 'torso', 'armLWork', 'armLFetch', 'armRJerk', 'armRFetch'];   // third person numbers of a set, degrees (gunDrop metres)
const HAND_AWAY_OFFSET = [-0.1, -0.35, -0.2];   // where the off-hand waits, below and behind the work point (model units; off screen)
const SHELL_NAMES = ['first', 'middle', 'last', 'only', 'emptyFirst', 'emptyLast'];
const SHELL_FIRST = 0, SHELL_MIDDLE = 1, SHELL_LAST = 2, SHELL_ONLY = 3, SHELL_EMPTY_FIRST = 4, SHELL_EMPTY_LAST = 5;
const RELOAD_KIND = {};
RELOAD_PHASE_KINDS.forEach((name, index) => { RELOAD_KIND[name] = index; });
const PART_MODE = {};
RELOAD_PART_MODES.forEach((name, index) => { PART_MODE[name] = index; });
const NO_CLICK = 2;                      // a fraction past the end of any reload: the spare never leaves on a click

const isRampUp = (kind) => kind === RELOAD_KIND.lower || kind === RELOAD_KIND.enter || kind === RELOAD_KIND.reach;
const isRampDown = (kind) => kind === RELOAD_KIND.raise || kind === RELOAD_KIND.exit;
const isFetchKind = (kind) => kind === RELOAD_KIND.fetch || kind === RELOAD_KIND.reach;
const isSeatKind = (kind) => kind === RELOAD_KIND.in || kind === RELOAD_KIND.insert || kind === RELOAD_KIND.port;
const isRackKind = (kind) => kind === RELOAD_KIND.rack || kind === RELOAD_KIND.close || kind === RELOAD_KIND.prime;

// ---- Load-time compile: the catalogue rows into typed arrays ----
const NO_POSE_RADIANS = new Float32Array(POSE_FLOATS);
const ZERO = new Float32Array(1);   // a zero that is a float: a ternary of 0 and a float is a mixed number the engine may box
const poseFromDegrees = (vector) => Float32Array.of(vector[0], vector[1], vector[2], vector[3] * DEG, vector[4] * DEG, vector[5] * DEG);
const lastIndexOfKind = (kinds, wanted) => { for (let i = kinds.length - 1; i >= 0; i--) if (wanted.includes(kinds[i])) return i; return -1; };
const firstIndexOfKind = (kinds, wanted) => kinds.findIndex((kind) => wanted.includes(kind));

// The phases of one reload variant: end fractions, kinds, and the weapon pose at the END of each phase (the work pose, a row's
// own key for that kind, or the hold pose for the last phase), plus the indexes the part motions need.
function compilePhases(list, row) {
  const count = list.length, ends = new Float32Array(count), kinds = new Uint8Array(count), keys = new Float32Array(count * KEY_FLOATS);
  list.forEach(([name, end], index) => {
    ends[index] = end; kinds[index] = RELOAD_KIND[name];
    const down = isRampDown(kinds[index]);
    keys.set(down ? NO_POSE_RADIANS : poseFromDegrees(row.keys[name] || row.work), index * KEY_FLOATS);
    keys[index * KEY_FLOATS + POSE_FLOATS] = down ? 0 : 1;
  });
  const names = list.map(([name]) => RELOAD_KIND[name]);
  const rack = [RELOAD_KIND.rack], close = [RELOAD_KIND.close], prime = [RELOAD_KIND.prime];
  const closeIndex = [lastIndexOfKind(names, close), lastIndexOfKind(names, rack), lastIndexOfKind(names, prime)].find((index) => index >= 0);
  const inIndex = lastIndexOfKind(names, [RELOAD_KIND.in, RELOAD_KIND.insert, RELOAD_KIND.port]);
  return { count, ends, kinds, keys, raisedStart: !isRampUp(kinds[0]),
    outIndex: firstIndexOfKind(names, [RELOAD_KIND.out]), fetchIndex: firstIndexOfKind(names, [RELOAD_KIND.fetch, RELOAD_KIND.reach]), inIndex,
    openIndex: Math.max(0, firstIndexOfKind(names, [RELOAD_KIND.open])), closeIndex: closeIndex === undefined ? count - 2 : closeIndex,
    rackIndex: firstIndexOfKind(names, rack), glowUpIndex: Math.max(lastIndexOfKind(names, prime), lastIndexOfKind(names, rack)),
    glowDownIndex: Math.max(0, firstIndexOfKind(names, [RELOAD_KIND.out, RELOAD_KIND.open])),
    joltIndex: closeIndex !== undefined && names[closeIndex] !== RELOAD_KIND.prime ? closeIndex : inIndex };
}

function compilePart(part) {
  if (!part) return null;
  const turn = part.turn || [0, 0, 0];
  return { role: MODEL_ROLES.indexOf(part.role), mode: PART_MODE[part.mode], move: Float32Array.from(part.move || [0, 0, 0]), out: Float32Array.of(part.out || 0),
    turn: Float32Array.of(turn[0] * DEG, turn[1] * DEG, turn[2] * DEG), lock: Float32Array.of((part.lock || 0) * DEG), holdBack: part.holdBack === true, hidden: part.hidden === true };
}

function compileReload(row) {
  const runtime = { row, work: poseFromDegrees(row.work), well: Float32Array.from(row.about || row.seat, (value) => value * VIEWMODEL_SCALE), seat: Float32Array.from(row.seat), belt: Float32Array.from(row.belt), rack: Float32Array.from(row.rack),
    spare: Float32Array.from(row.spare), jolt: Float32Array.from(row.jolt), part: compilePart(row.part), second: compilePart(row.second), glow: row.glow,
    tp: Float32Array.from(TP_KEYS, (key) => (row.tp[key] || 0) * (key === 'gunDrop' ? 1 : DEG)), cycle: row.cycle, bow: row.bow ? compilePart({ role: row.bow.role, mode: 'pulse', move: row.bow.move, turn: [0, 0, row.bow.cant] }) : null, partial: null, empty: null, shell: false,
    shellPhases: null, clicks: null };
  if (row.shell) {
    runtime.shell = true;
    runtime.shellPhases = SHELL_NAMES.map((name) => compilePhases(row.shell[name], row));
    runtime.clicks = Float32Array.from(SHELL_NAMES, (name) => row.shell.click[name]);
  } else {
    runtime.partial = compilePhases(row.partial, row);
    runtime.empty = row.empty ? compilePhases(row.empty, row) : runtime.partial;
  }
  return runtime;
}
const RELOAD_RUNTIME = CAT.reloadAnims.map(compileReload);

const MELEE_RUNTIME = CAT.meleeAnims.map((row) => ({ row, strike: poseFromDegrees(row.strike), through: poseFromDegrees(row.through), cocked: poseFromDegrees(row.cocked),
  block: row.block ? poseFromDegrees(row.block) : null, arms: Float32Array.from(row.tp.arms || [0, 0, 0], (value) => value * DEG), torso: Float32Array.of((row.tp.torso || 0) * DEG),
  gunPitch: Float32Array.of(((row.tp.gun || [0, 0])[0]) * DEG), gunForward: Float32Array.of((row.tp.gun || [0, 0])[1]), oneHand: row.tp.oneHand === true,
  follow: Float32Array.of(row.follow, row.recover, row.wind) }));
const MELEE_FOLLOW = 0, MELEE_RECOVER = 1, MELEE_WIND = 2;   // indexes into MELEE_RUNTIME[].follow

// ---- Samplers: a reload or strike at one fraction, into a record (no allocation) ----
// The caller sets scalars[S_FRACTION] and [S_CLICK], empty (0 / 1), first, last (0 / 1) on the sample and, for a magazine-like part, partVector.
function ReloadSample() {
  this.empty = 0; this.first = 1; this.last = 0;
  this.key = new Float32Array(KEY_FLOATS);       // the weapon pose offsets and the work envelope
  this.hand = new Float32Array(3);               // the off-hand, in model units
  this.partVector = new Float32Array(3);         // where the magazine leaves along
  this.spareD = new Float32Array(3);             // the spare magazine's displacement from its seat
  this.amount = new Float32Array(2);             // moving part 0 / 1 along its move and turn, 0..1
  this.hidden = new Uint8Array(2);               // that part is out of the weapon (fetched) and not drawn
  this.roll = new Float32Array(2);               // extra roll of the part (the drum's twist)
  this.scalars = new Float32Array(SCALARS);      // fraction of the reload, the fraction the spare leaves on a click, phase u, spare roll, glow share, fetch and jerk amounts
  this.scalars[S_CLICK] = NO_CLICK;
  this.index = 0; this.kind = 0; this.spareOn = 0;
}
const SCALARS = 7, S_U = 0, S_SPARE_ROLL = 1, S_GLOW = 2, S_FETCH = 3, S_JERK = 4, S_FRACTION = 5, S_CLICK = 6;
const phaseState = { index: 0, u: new Float32Array(1) };

function locatePhase(phases, sample) {
  let index = 0;
  const fraction = sample.scalars[S_FRACTION];
  while (index < phases.count - 1 && fraction >= phases.ends[index]) index++;
  const start = index > 0 ? phases.ends[index - 1] : 0, span = phases.ends[index] - start;
  phaseState.u[0] = 1;
  if (span > 0) phaseState.u[0] = clamp((fraction - start) / span, 0, 1);
  phaseState.index = index;
}

function sampleReload(runtime, phases, out) {
  locatePhase(phases, out);
  const index = phaseState.index, kind = phases.kinds[index], scalars = out.scalars;
  out.index = index; out.kind = kind; scalars[S_U] = phaseState.u[0];
  sampleWeaponPose(runtime, phases, out);
  sampleHand(runtime, out);
  out.amount[0] = out.amount[1] = 0; out.hidden[0] = out.hidden[1] = 0; out.roll[0] = out.roll[1] = 0;
  if (runtime.part) samplePart(runtime.part, phases, out, 0);
  if (runtime.second) samplePart(runtime.second, phases, out, 1);
  out.spareOn = ((isFetchKind(kind) && scalars[S_U] >= 0.5) || isSeatKind(kind)) && scalars[S_FRACTION] < scalars[S_CLICK] ? 1 : 0;
  scalars[S_SPARE_ROLL] = runtime.part && runtime.part.mode === PART_MODE.mag && isSeatKind(kind) ? runtime.part.lock[0] : 0;
  for (let k = 0; k < 3; k++) out.spareD[k] = out.hand[k] - runtime.seat[k];
  scalars[S_GLOW] = 1;
  if (runtime.glow) sampleGlow(phases, out);
}

// The weapon pose: from the pose at the end of the previous phase to the one at the end of this phase (the start of a middle shell
// is already at the work pose; a set that starts with a lowering starts at the hold pose).
function sampleWeaponPose(runtime, phases, out) {
  const index = out.index, keys = phases.keys, to = index * KEY_FLOATS, key = out.key, u = out.scalars[S_U];
  let along = u;   // how far this phase has carried the pose from its start to its end; a 'reach' phase gets there in its first REACH_RAMP
  if (out.kind === RELOAD_KIND.reach) along = Math.min(1, u / REACH_RAMP);
  const amount = along * along * (3 - 2 * along);
  for (let k = 0; k < KEY_FLOATS; k++) {
    const start = index > 0 ? keys[to - KEY_FLOATS + k] : phases.raisedStart ? keys[to + k] : NO_POSE_RADIANS[k % POSE_FLOATS];
    key[k] = start + (keys[to + k] - start) * amount;
  }
  if (index !== phases.joltIndex) return;
  const bump = Math.sin(Math.PI * u);
  key[1] += runtime.jolt[0] * bump; key[2] += runtime.jolt[1] * bump;
}

// The work pose tilts the gun ABOUT its magazine well (the seat point, in view metres from the pivot), not about the grip: the well keeps the place
// the pose's x y z give it while the muzzle rises and turns in and the back end drops away from the eye. Adds well - R * well to the pose's offsets,
// R = yaw * pitch * roll as the renderer turns the model (view space: x right, y up, z forward; + yaw turns left, + pitch raises the muzzle).
function tiltAboutWell(well, key) {
  const x = well[0], y = well[1], z = well[2], cr = Math.cos(key[5]), sr = Math.sin(key[5]), cp = Math.cos(key[3]), sp = Math.sin(key[3]), cy = Math.cos(key[4]), sy = Math.sin(key[4]);
  const x1 = x * cr + y * sr, y1 = -x * sr + y * cr, y2 = y1 * cp + z * sp, z2 = -y1 * sp + z * cp;
  key[0] += x - (x1 * cy - z2 * sy); key[1] += y - y2; key[2] += z - (x1 * sy + z2 * cy);
}

// Where the off-hand is: away, to the work point (the seat), out with the old magazine, to the belt and back with the spare, to the rack
// point and back, away. fetch / jerk = how far toward the belt / the rack it is (third person arms follow them).
function sampleHand(runtime, out) {
  const seat = runtime.seat, belt = runtime.belt, rack = runtime.rack, hand = out.hand, move = out.partVector, kind = out.kind, scalars = out.scalars, u = scalars[S_U];
  // The eased progress of the whole phase, and of its first or second half; the maths is written out here (no easing or lerp helper calls):
  // a helper V8 does not inline would box its float arguments and results on every call.
  const whole = u * u * (3 - 2 * u), outward = u < 0.5, half = outward ? u * 2 : u * 2 - 1, eased = half * half * (3 - 2 * half), there = outward ? eased : 1 - eased;
  for (let k = 0; k < 3; k++) {
    const away = seat[k] + HAND_AWAY_OFFSET[k], moved = seat[k] + move[k];
    if (kind === RELOAD_KIND.lower || kind === RELOAD_KIND.enter) hand[k] = away + (seat[k] - away) * whole;
    else if (kind === RELOAD_KIND.reach) hand[k] = outward ? away + (belt[k] - away) * eased : belt[k] + (moved - belt[k]) * eased;
    else if (kind === RELOAD_KIND.fetch) hand[k] = outward ? moved + (belt[k] - moved) * eased : belt[k] + (moved - belt[k]) * eased;
    else if (kind === RELOAD_KIND.out) hand[k] = seat[k] + move[k] * whole;
    else if (isSeatKind(kind)) hand[k] = seat[k] + move[k] * (1 - whole);
    else if (isRackKind(kind)) hand[k] = outward ? seat[k] + (rack[k] - seat[k]) * eased : rack[k] + (seat[k] - rack[k]) * eased;
    else if (isRampDown(kind)) hand[k] = seat[k] + (away - seat[k]) * whole;
    else hand[k] = seat[k];
  }
  scalars[S_FETCH] = ZERO[0]; scalars[S_JERK] = ZERO[0];
  if (isFetchKind(kind)) scalars[S_FETCH] = there;
  if (isRackKind(kind)) scalars[S_JERK] = there;
}

// One moving part: 'mag' leaves in `out`, is gone while it is fetched and comes back in `in`; 'latch' opens in the open phase (else the
// first) and shuts in the close phase; 'pulse' goes back and forth in the rack phase (`holdBack`: an empty reload starts with it back).
function samplePart(part, phases, sample, slot) {
  const index = sample.index, u = sample.scalars[S_U], eased = u * u * (3 - 2 * u), amounts = sample.amount, lock = part.lock[0];
  if (part.mode === PART_MODE.mag) {
    if (index === phases.outIndex) amounts[slot] = eased;
    const gone = (phases.fetchIndex >= 0 && index >= phases.fetchIndex && index <= phases.inIndex) || (part.hidden && index <= phases.inIndex);
    sample.hidden[slot] = gone ? 1 : 0;
    if (lock !== 0 && !gone && index > phases.inIndex) {
      if (index === phases.rackIndex) sample.roll[slot] = lock * (1 - eased);
      else if (index < phases.rackIndex) sample.roll[slot] = lock;
    }
  } else if (part.mode === PART_MODE.latch) {
    if (index < phases.openIndex || index > phases.closeIndex) return;
    if (index === phases.openIndex && index !== phases.closeIndex) amounts[slot] = eased;
    else if (index === phases.closeIndex) amounts[slot] = 1 - eased;
    else amounts[slot] = 1;
  } else if (part.holdBack && sample.empty === 1) {
    if (phases.rackIndex < 0 || index < phases.rackIndex) amounts[slot] = 1;
    else if (index === phases.rackIndex) { const back = Math.min(1, u / 0.6); amounts[slot] = 1 - back * back * (3 - 2 * back); }
  } else if (index === phases.rackIndex) {
    if (u < 0.55) amounts[slot] = u / 0.55;
    else amounts[slot] = 1 - (u - 0.55) / 0.45;
  }
}

// The glow parts dim to 20 % (0 % after an empty magazine) while the cell is out and charge back to 100 % in the last rack or prime.
function sampleGlow(phases, sample) {
  const down = phases.glowDownIndex, up = phases.glowUpIndex, index = sample.index, u = sample.scalars[S_U], scalars = sample.scalars, eased = u * u * (3 - 2 * u);
  let base = 0.2;
  if (sample.empty === 1) base = ZERO[0];
  if (index < down) scalars[S_GLOW] = 1;
  else if (index === down) scalars[S_GLOW] = 1 - (1 - base) * eased;
  else if (index < up) scalars[S_GLOW] = base;
  else if (index === up) scalars[S_GLOW] = base + (1 - base) * eased;
  else scalars[S_GLOW] = 1;
}

// Shell by shell: the cycle this shell plays is the first, a middle, the last or the only one; an empty magazine's first shell goes
// in through the port and the pump works (R5). sample.first / last / empty (0 / 1) pick it.
function shellVariant(first, last, empty) {
  if (empty && first) return last ? SHELL_EMPTY_LAST : SHELL_EMPTY_FIRST;
  if (first) return last ? SHELL_ONLY : SHELL_FIRST;
  return last ? SHELL_LAST : SHELL_MIDDLE;
}
function sampleShell(runtime, sample) {
  const variant = shellVariant(sample.first === 1, sample.last === 1, sample.empty === 1);
  sample.scalars[S_CLICK] = runtime.clicks[variant];
  sampleReload(runtime, runtime.shellPhases[variant], sample);
}
// The phases a reload of the weapon in `record` (the Render.viewModel or Render.actorAction record) plays.
function sampleReloadOf(runtime, record, sample) {
  sample.scalars[S_FRACTION] = record.reload; sample.scalars[S_CLICK] = NO_CLICK; sample.empty = record.reloadEmpty; sample.first = record.reloadFirst; sample.last = record.reloadLast;
  if (runtime.shell) sampleShell(runtime, sample);
  else sampleReload(runtime, record.reloadEmpty === 1 ? runtime.empty : runtime.partial, sample);
}

// The action cycle between shots: piecewise linear keyframes of [fraction, move, turn] into cycleAmounts (move, turn).
const cycleAmounts = new Float32Array(2);
function sampleCycle(cycle, record) {
  const keys = cycle.keys;
  cycleAmounts[0] = cycleAmounts[1] = 0;
  for (let i = 1; i < keys.length; i++) {
    if (record.cycle > keys[i][0]) continue;
    const before = keys[i - 1], after = keys[i], t = (record.cycle - before[0]) / (after[0] - before[0]);
    cycleAmounts[0] = before[1] + (after[1] - before[1]) * t; cycleAmounts[1] = before[2] + (after[2] - before[2]) * t;
    return;
  }
}

// ---- Melee: contact pose on the first frame after the hit tick, follow-through, recovery to the guard by the end of the cycle ----
// The caller sets age (seconds since the hit tick), cycle, stop (seconds the contact pose holds: hit-stop, the follow-through then
// runs faster so the cycle still ends at `cycle`), wind (how far the held trigger has wound the weapon up, 0..1) and sign (-1 mirrors).
function MeleeSample() {
  this.values = new Float32Array(MELEE_VALUES);   // the inputs (age, cycle, stop, wind, sign) and the weights of the three poses and how far through the cycle (0..1, after the hit-stop)
  this.pose = new Float32Array(POSE_FLOATS);
}
const MELEE_VALUES = 9, M_AGE = 0, M_CYCLE = 1, M_STOP = 2, M_WIND = 3, M_SIGN = 4, M_CONTACT = 5, M_THROUGH = 6, M_COCKED = 7, M_FRACTION = 8;
const MELEE_STAGES = new Float32Array(3);
function sampleMelee(runtime, out) {
  const row = runtime.follow, values = out.values, stages = MELEE_STAGES;
  let fraction = 0;
  if (values[M_AGE] > values[M_STOP]) fraction = Math.min(1, (values[M_AGE] - values[M_STOP]) / Math.max(values[M_CYCLE] - values[M_STOP], 1e-6));
  stages[0] = stages[1] = 0;
  if (fraction < row[MELEE_FOLLOW]) {
    const along = fraction / row[MELEE_FOLLOW], eased = along * along * (3 - 2 * along);
    stages[0] = 1 - eased; stages[1] = eased;
  } else if (fraction < row[MELEE_RECOVER]) {
    const along = (fraction - row[MELEE_FOLLOW]) / (row[MELEE_RECOVER] - row[MELEE_FOLLOW]);
    stages[1] = 1 - along * along * (3 - 2 * along);
  }
  const open = 1 - values[M_WIND];
  values[M_FRACTION] = fraction; values[M_CONTACT] = stages[0] * open; values[M_THROUGH] = stages[1] * open; values[M_COCKED] = values[M_WIND];
  for (let k = 0; k < POSE_FLOATS; k++) {
    let pose = runtime.strike[k] * values[M_CONTACT] + runtime.through[k] * values[M_THROUGH] + runtime.cocked[k] * values[M_COCKED];
    if (k === 4 || k === 5) pose *= values[M_SIGN];   // a backhand turns and rolls the other way, from the same place on the screen
    out.pose[k] = pose;
  }
}
// The wind-up the held trigger asks for at this point of the cycle (an auto weapon's cocked pose before the next strike) into windTarget[0];
// `record` is the Render.viewModel or Render.actorAction record.
const windTarget = new Float32Array(1);
function aimWind(runtime, record) {
  const fraction = clamp(record.meleeAge / record.meleeCycle, 0, 1), start = runtime.follow[MELEE_WIND];
  windTarget[0] = ZERO[0];
  if (record.fireHeld !== 1 || fraction < start) return;
  const along = (fraction - start) / (1 - start);
  windTarget[0] = along * along * (3 - 2 * along);
}

// ---- First person: the layers ----
const LAYER = { RELOAD: 0, MELEE: 1, BLOCK: 2, CHARGE: 3, CYCLE: 4, SPRINT: 5, COUNT: 6 };
// Seconds a layer takes to come in and to go out (render time); 0 = at once (its own pose starts and ends at zero). The reload's and the
// melee's way out depends on what took over (the P6-04 priority table) and is set per frame.
const LAYER_RISE = Float32Array.of(0, 0, 0.1, 0, 0, 0.15);
const LAYER_FALL = Float32Array.of(RELOAD_FADE_FIRE, 0.05, 0.15, 0, 0, 0.12);
const SPRINT_POSE = Float32Array.of(0, -0.04, 0, -15 * DEG, 0, -25 * DEG);   // lowered 4 cm, pitched down 15 degrees and canted inward 25
const DIP_POSE = poseFromDegrees(QUICK_MELEE_HELD_DIP);
const WIND_SECONDS = 0.08;           // render seconds the wind-up follows the held trigger by (a released trigger does not snap the pose back)
const CHARGE_RAISE_END = 0.6;        // the charged weapon is overhead by this share of the charge; the rest only tightens
const CHARGE_TREMBLE = 0.002;        // metres of tremble at full charge (off with reduce motion)
const CHARGE_TREMBLE_HZ = 60;
const REFLECT_FLASH_SECONDS = 0.15;  // the shield rim flashes this long after a reflected shot
const BLOCK_PARRY_GLOW = 0.45, BLOCK_REFLECT_GLOW = 0.9;
const KNOCK_RISE_SECONDS = 0.05, KNOCK_RECOVER_SECONDS = 0.2;   // the hit knock of the view model (P6-03)
const KNOCK_METRES_MIN = 0.02, KNOCK_METRES_MAX = 0.04, KNOCK_PITCH = 4 * DEG, KNOCK_FULL_DAMAGE = 50;
const KNOCK_KINDS = new Set(['hit', 'melee', 'beam', 'splash']);
const SCOPE_BOB_METRES = 0.003;      // W24 scoped: the bolt cycle shows only this much scope bob
const SPARE_PALETTE = MODEL_PALETTE_INDEX.steel;
const HAFT_HAND = Float32Array.of(-0.05, -0.06, 0);   // the off-hand on the haft of a two-handed melee weapon (model units)

const L_SECONDS = 0, L_WIND = 1, L_CLOCK = 2, L_KNOCK_AGE = 3, L_KNOCK_METRES = 4, L_KNOCK_PITCH = 5, L_CHARGE = 6, L_KICK_AGE = 7, L_KICK_PREV = 8, L_KICK_ROLL = 9, L_MOTION = 10, L_COUNT = 11;
// ViewLayers.scalars: frame seconds, melee wind-up, clock, hit knock age, size and pitch, the charge shown by a gun, seconds since the last shot's kick began, the
// sim kick of the last frame (a rise is a new shot), the roll of that kick (signed, it alternates), this frame's weapon motion share (P7-03)
const KICK_NEW_SHOT = 0.3;           // the sim kick rising by this much in a frame is a new shot
const KICK_DAMPING = 3, KICK_FREQUENCY = 2.3;   // the kick spring exp(-3 u) cos(2.3 u) over the class's kickTime: it crosses zero at u = 0.68 and overshoots by 3.3 % (5 % is the limit)
const KICK_RAISE = 0.012, KICK_PITCH = 6 * DEG;   // metres up and radians of muzzle-up pitch at a kick of 1 x the class's `kick` (the P2 values)
const LAYER_MOTION = Uint8Array.of(1, 1, 0, 0, 1, 1);   // the layers the weapon motion setting scales: reload, melee, cycle, sprint (not the block and the charge: they show what the weapon is doing)
const layerScale = new Float32Array(LAYER.COUNT);
const DETONATE_JOLT_SECONDS = 0.1, DETONATE_JOLT_METRES = 0.01;   // the thumb jolt of a detonate press during a reload (W40, W43)
const CHARGE_SHOWN_SECONDS = 0.08;   // render seconds the drawn bow string and glow follow the charge by (a release snaps them back over this)
const CHARGE_GLOW_FLOOR = 0.3;       // a charging gun's glow parts start this bright and swell to full
const ViewLayers = {
  weight: new Float32Array(LAYER.COUNT),                       // 0..1 per layer
  value: new Float32Array(LAYER.COUNT * POSE_FLOATS),          // the offsets each layer last had while it was on (it blends out from them)
  reloadMoves: new Float32Array(ROLE_FLOATS_TOTAL),            // the role part moves of the reload layer, likewise
  cycleMoves: new Float32Array(ROLE_FLOATS_TOTAL),
  scalars: new Float32Array(L_COUNT),                          // the state below, as floats
};
const meleeStamp = new Float64Array(2);                        // Sim.time of [the strike the wind-up belongs to, the strike a reload or swap took over (it never comes back)]
const ViewAction = {
  pose: new Float32Array(POSE_FLOATS),        // the layers summed: the offsets of the weapon in hand
  striker: new Float32Array(POSE_FLOATS),     // a quick melee by another owned melee weapon: that weapon's strike, drawn in the off-hand
  main: new Float32Array(ROLE_FLOATS_TOTAL),  // role part moves of the weapon in hand
  spare: new Float32Array(ROLE_FLOATS_TOTAL), // ... of the spare drawn a second time
  values: new Float32Array(4),                // glow share, emissive floor, off-hand weight, striker weight
  hand: new Float32Array(3),                  // the off-hand, in model units
  lastHand: new Float32Array(3),              // ... where the reload layer last had it (it goes down with the weapon when the reload is cancelled)
  spareOn: 0, spareRole: 0, handKind: 0, strikerAnim: -1, strikerWeapon: -1, reloadSet: -1,
};
const VA = { GLOW: 0, EMISSIVE: 1, HAND: 2, STRIKER: 3 };
const HAND_KIND = { NONE: 0, RELOAD: 1, HAFT: 2 };
const reloadSample = new ReloadSample(), meleeSample = new MeleeSample();
meleeStamp[0] = -1; meleeStamp[1] = -1e9;

// The Render.viewModel record gets these fields on top of the 07e ones; readViewModel resets them every frame.
function resetViewModelAnimation(state) {
  state.reloadSet = -1; state.reloadEmpty = 0; state.reloadFirst = 1; state.reloadLast = 0; state.swapping = 0;
  state.meleeAge = -1; state.meleeCycle = 0; state.meleeKind = 0; state.meleeStriker = -1; state.meleeAnim = -1; state.meleeHit = 0; state.meleeCount = 0; state.meleeAt = -1e9;
  state.weaponIndex = -1; state.fireHeld = 0; state.chargeFraction = 0; state.blocking = 0; state.parry = 0; state.blockPool = 1; state.reflectAge = 1e9;
  state.sprinting = 0; state.cycle = -1; state.joltAge = 99;
}

// Moves a layer's weight toward 1 (on) or 0 (off) by this frame's seconds over its rise / fall time; 0 seconds = at once.
function stepLayerWeight(layer, on) {
  const weight = ViewLayers.weight, step = ViewLayers.scalars[L_SECONDS], rise = LAYER_RISE[layer], fall = LAYER_FALL[layer];
  const current = weight[layer];
  if (on) {
    if (rise > 0) weight[layer] = Math.min(1, current + step / rise);
    else weight[layer] = 1;
  } else if (fall > 0) weight[layer] = Math.max(0, current - step / fall);
  else weight[layer] = 0;
}

// The direction a magazine-like role part leaves its weapon along (model units, into the vector): the part's own `move`, else `out` units
// away from the middle of the gun through the middle of the role's parts (down for a magazine, sideways for a side cell).
function partDirection(model, part, vector) {
  vector[0] = part.move[0]; vector[1] = part.move[1]; vector[2] = part.move[2];
  if (vector[0] !== 0 || vector[1] !== 0 || vector[2] !== 0 || part.out[0] === 0) return;
  let x = 0, y = 0, found = 0;
  for (let i = 0; i < model.count; i++) if (model.roles[i] === part.role) { x += model.data[i * MODEL_PART_FLOATS]; y += model.data[i * MODEL_PART_FLOATS + 1]; found++; }
  const length = found ? length2(x, y) : 0;
  if (length < 0.01) { vector[1] = -part.out[0]; return; }
  vector[0] = x / length * part.out[0]; vector[1] = y / length * part.out[0];
}

// One moving part's pose into a role-move array: x y z, pitch, roll (the hide flag is set by the caller). A part that leaves along a
// computed direction (a magazine, a cell) moves by the sample's partVector, the others by their own move.
function writeReloadPart(moves, part, sample, slot) {
  const o = part.role * MODEL_ROLE_MOVE_FLOATS, amount = sample.amount[slot];
  if (part.mode === PART_MODE.mag) {
    moves[o] += sample.partVector[0] * amount; moves[o + 1] += sample.partVector[1] * amount; moves[o + 2] += sample.partVector[2] * amount;
  } else {
    moves[o] += part.move[0] * amount; moves[o + 1] += part.move[1] * amount; moves[o + 2] += part.move[2] * amount;
    moves[o + 3] += part.turn[0] * amount; moves[o + 4] += part.turn[2] * amount;
  }
  moves[o + 4] += sample.roll[slot];
  if (sample.hidden[slot]) moves[o + 5] = 1;
}
// The role move arrays of the reload layer for the sample: both parts, with the hide flag of a fetched magazine.
function writeReloadMoves(moves, runtime, sample) {
  moves.fill(0);
  if (runtime.part) writeReloadPart(moves, runtime.part, sample, 0);
  if (runtime.second) writeReloadPart(moves, runtime.second, sample, 1);
}

ViewAction.clear = function () {
  this.pose.fill(0); this.striker.fill(0); this.main.fill(0); this.spare.fill(0); this.values.fill(0);
  this.values[VA.GLOW] = 1;
  this.spareOn = 0; this.handKind = HAND_KIND.NONE; this.strikerAnim = -1; this.strikerWeapon = -1; this.reloadSet = -1;
};

// One frame of layers for the weapon in hand (state = the Render.viewModel record, model = its compiled model).
ViewAction.update = function (state, model, seconds) {
  const layers = ViewLayers, weight = layers.weight, value = layers.value, scalars = layers.scalars;
  this.clear();
  scalars[L_SECONDS] = seconds;
  if (!(scalars[L_SECONDS] > 0)) scalars[L_SECONDS] = 0;   // no frame time (a test fills the view model without one): the layers hold
  scalars[L_CLOCK] += scalars[L_SECONDS]; scalars[L_KNOCK_AGE] += scalars[L_SECONDS];
  scalars[L_MOTION] = 1;
  if (Render.motion.weapon !== undefined) scalars[L_MOTION] = Render.motion.weapon;   // the weapon motion setting (P7-03; reduce motion caps it at 40 %)
  for (let layer = 0; layer < LAYER.COUNT; layer++) { if (LAYER_MOTION[layer] === 1) layerScale[layer] = scalars[L_MOTION]; else layerScale[layer] = 1; }
  const adsScale = 1 - clamp(state.ads, 0, 1), swapping = state.swapping === 1, reloadOn = state.reloadSet >= 0 && !swapping;
  const striking = state.meleeAge >= 0 && state.meleeAnim >= 0;
  if (striking && (reloadOn || swapping)) meleeStamp[1] = state.meleeAt;
  const meleeOn = striking && !reloadOn && !swapping && meleeStamp[1] !== state.meleeAt;
  const weaponRow = CAT.weapons[state.weaponIndex] || null;
  const blockRow = weaponRow && weaponRow.meleeAnimIndex >= 0 ? MELEE_RUNTIME[weaponRow.meleeAnimIndex] : null;
  const chargeRow = weaponRow && weaponRow.meleeAltIndex >= 0 ? MELEE_RUNTIME[weaponRow.meleeAltIndex] : null;
  const blockOn = state.blocking === 1 && !!blockRow && !!blockRow.block && !reloadOn && !swapping && !meleeOn;
  const chargeOn = state.chargeFraction > 0 && !!chargeRow && chargeRow.row.charge && !reloadOn && !swapping && !meleeOn;
  const cycleRow = weaponRow && weaponRow.reloadAnimIndex >= 0 ? RELOAD_RUNTIME[weaponRow.reloadAnimIndex] : null;
  const cycleOn = state.cycle >= 0 && !!cycleRow && !!cycleRow.cycle && !reloadOn && !swapping && !meleeOn;
  const sprintOn = state.sprinting === 1 && !reloadOn && !swapping && !meleeOn && !blockOn && !chargeOn && state.cycle < 0;
  this.reloadLayer(state, model, reloadOn, swapping, meleeOn);
  this.meleeLayer(state, meleeOn, reloadOn, swapping);
  stepLayerWeight(LAYER.BLOCK, blockOn);
  stepLayerWeight(LAYER.CHARGE, chargeOn);
  stepLayerWeight(LAYER.CYCLE, cycleOn);
  stepLayerWeight(LAYER.SPRINT, sprintOn);
  if (blockOn) this.blockLayer(state, blockRow);
  if (chargeOn) this.chargeLayer(state, chargeRow);
  if (cycleOn) this.cycleLayer(state, cycleRow);
  if (sprintOn) value.set(SPRINT_POSE, LAYER.SPRINT * POSE_FLOATS);
  for (let layer = 0; layer < LAYER.COUNT; layer++) {
    const share = weight[layer] * (layer === LAYER.CYCLE ? 1 : adsScale) * layerScale[layer];
    if (share === 0) continue;
    for (let k = 0; k < POSE_FLOATS; k++) this.pose[k] += value[layer * POSE_FLOATS + k] * share;
  }
  // The role moves: the reload's fade out with its weight (a cancelled reload's magazine slides back into its seat), the cycle's stay as they are.
  const reloadShare = weight[LAYER.RELOAD] * adsScale, cycleShare = weight[LAYER.CYCLE];
  for (let i = 0; i < ROLE_FLOATS_TOTAL; i++) {
    const hideSlot = i % MODEL_ROLE_MOVE_FLOATS === 5;
    this.main[i] = hideSlot ? (reloadOn ? layers.reloadMoves[i] : 0) : layers.reloadMoves[i] * reloadShare + layers.cycleMoves[i] * cycleShare;
  }
  if (this.handKind === HAND_KIND.RELOAD) this.values[VA.HAND] = weight[LAYER.RELOAD] * adsScale;
  this.chargeEffects(state, weaponRow, adsScale);
  if (state.joltAge < DETONATE_JOLT_SECONDS) this.pose[2] -= DETONATE_JOLT_METRES * Math.sin(Math.PI * state.joltAge / DETONATE_JOLT_SECONDS) * scalars[L_MOTION];
  if (scalars[L_KNOCK_AGE] < KNOCK_RISE_SECONDS + KNOCK_RECOVER_SECONDS) this.applyKnock();
  this.kickLayer(state, model);
};

// P7 F05: the recoil of the view model. A shot (the sim kick rising) starts a spring that lasts the class's `kickTime`: the gun goes back, up and pitches up, with a
// little roll that alternates from shot to shot. Visual only: the camera recoil (WPN-004) is the sim's. Scaled by the weapon motion setting.
ViewAction.kickLayer = function (state, model) {
  const scalars = ViewLayers.scalars, row = model.pose;
  if (state.kick > scalars[L_KICK_PREV] + KICK_NEW_SHOT) {
    scalars[L_KICK_AGE] = 0;
    const roll = 0.5 + 0.5 * Rng.fx.next();
    if (scalars[L_KICK_ROLL] > 0) scalars[L_KICK_ROLL] = -roll; else scalars[L_KICK_ROLL] = roll;
  }
  scalars[L_KICK_PREV] = state.kick;
  scalars[L_KICK_AGE] += scalars[L_SECONDS];
  const along = scalars[L_KICK_AGE] / row.kickTime;
  if (!(along < 1)) return;
  const amount = Math.exp(-KICK_DAMPING * along) * Math.cos(KICK_FREQUENCY * along) * row.kick * scalars[L_MOTION], pose = this.pose;
  pose[1] += amount * KICK_RAISE; pose[2] -= amount * row.kickBack; pose[3] += amount * KICK_PITCH; pose[5] += amount * row.kickRoll * DEG * scalars[L_KICK_ROLL];
};

ViewAction.reloadLayer = function (state, model, reloadOn, swapping, meleeOn) {
  const layers = ViewLayers;
  LAYER_FALL[LAYER.RELOAD] = swapping ? RELOAD_FADE_SWAP : meleeOn ? RELOAD_FADE_MELEE : RELOAD_FADE_FIRE;
  stepLayerWeight(LAYER.RELOAD, reloadOn);
  if (!reloadOn) {
    if (layers.weight[LAYER.RELOAD] > 0) { this.handKind = HAND_KIND.RELOAD; this.hand.set(this.lastHand); }   // fading out: the off-hand goes down with the weapon, the spare is gone
    return;
  }
  const runtime = RELOAD_RUNTIME[state.reloadSet], sample = reloadSample, part = runtime.part;
  sample.partVector.fill(0);
  if (part && part.mode === PART_MODE.mag) partDirection(model, part, sample.partVector);
  sampleReloadOf(runtime, state, sample);
  tiltAboutWell(runtime.well, sample.key);
  for (let k = 0; k < POSE_FLOATS; k++) layers.value[LAYER.RELOAD * POSE_FLOATS + k] = sample.key[k];
  writeReloadMoves(layers.reloadMoves, runtime, sample);
  this.reloadSet = state.reloadSet;
  this.handKind = HAND_KIND.RELOAD;
  this.hand.set(sample.hand); this.lastHand.set(sample.hand);
  this.values[VA.GLOW] = sample.scalars[S_GLOW];
  this.spareOn = sample.spareOn;
  this.spareRole = part && part.mode === PART_MODE.mag ? part.role : 0;
};

// A strike: the contact pose on the first frame after the hit tick, then the follow-through and recovery; a quick melee with another
// owned melee weapon draws that weapon in the off-hand and dips the gun in hand out of its way.
ViewAction.meleeLayer = function (state, meleeOn, reloadOn, swapping) {
  const layers = ViewLayers, runtime = meleeOn ? MELEE_RUNTIME[state.meleeAnim] : null, scalars = layers.scalars;
  LAYER_FALL[LAYER.MELEE] = reloadOn ? MELEE_FADE_RELOAD : swapping ? RELOAD_FADE_SWAP : 0.05;
  stepLayerWeight(LAYER.MELEE, meleeOn);
  if (!meleeOn) return;
  if (meleeStamp[0] !== state.meleeAt) { meleeStamp[0] = state.meleeAt; scalars[L_WIND] = 0; }
  const rate = scalars[L_SECONDS] / WIND_SECONDS, sample = meleeSample, values = sample.values;
  aimWind(runtime, state);
  scalars[L_WIND] += clamp(windTarget[0] - scalars[L_WIND], -rate, rate);
  values[M_AGE] = state.meleeAge; values[M_CYCLE] = state.meleeCycle; values[M_STOP] = state.meleeHit === 1 ? MELEE_HIT_STOP : 0; values[M_WIND] = scalars[L_WIND];
  values[M_SIGN] = runtime.row.alternate && (state.meleeCount & 1) === 0 ? -1 : 1;
  sampleMelee(runtime, sample);
  const fromOffHand = state.meleeKind === MELEE_KIND.QUICK && state.meleeStriker !== state.weaponIndex;
  if (fromOffHand) {
    // The gun in hand dips out of the way for as long as the strike lasts; the striker's own pose is the strike (mirrored by the left hand).
    const rise = Math.min(1, values[M_FRACTION] / 0.15), settle = clamp((values[M_FRACTION] - 0.8) / 0.2, 0, 1);
    const dip = rise * rise * (3 - 2 * rise) * (1 - settle * settle * (3 - 2 * settle));
    for (let k = 0; k < POSE_FLOATS; k++) { layers.value[LAYER.MELEE * POSE_FLOATS + k] = DIP_POSE[k] * dip; this.striker[k] = sample.pose[k]; }
    this.strikerAnim = state.meleeAnim; this.strikerWeapon = state.meleeStriker;
    this.values[VA.STRIKER] = layers.weight[LAYER.MELEE];
    return;
  }
  for (let k = 0; k < POSE_FLOATS; k++) layers.value[LAYER.MELEE * POSE_FLOATS + k] = sample.pose[k];
  if (runtime.row.twoHand) { this.handKind = HAND_KIND.HAFT; this.hand.set(HAFT_HAND); this.values[VA.HAND] = layers.weight[LAYER.MELEE]; }
};

// W03: the shield comes to the middle of the screen while blocking; the rim glows in the parry window and flashes on a reflect.
ViewAction.blockLayer = function (state, runtime) {
  const o = LAYER.BLOCK * POSE_FLOATS, value = ViewLayers.value;
  value.set(runtime.block, o);
  const flash = state.reflectAge >= 0 && state.reflectAge < REFLECT_FLASH_SECONDS;
  this.values[VA.EMISSIVE] = flash ? BLOCK_REFLECT_GLOW : state.parry === 1 ? BLOCK_PARRY_GLOW : 0;
  if (flash) value[o + 2] -= 0.01;   // a 1 cm jolt back
  if (state.blockPool <= 0) value[o + 1] -= 0.04;   // an empty pool sags the shield
};

// W01 alt: the maul comes overhead as the charge builds (up to CHARGE_RAISE_END of it), then only tightens; a full charge trembles.
ViewAction.chargeLayer = function (state, runtime) {
  const fraction = state.chargeFraction, along = Math.min(1, fraction / CHARGE_RAISE_END), raise = along * along * (3 - 2 * along), tighten = clamp((fraction - CHARGE_RAISE_END) / (1 - CHARGE_RAISE_END), 0, 1);
  const o = LAYER.CHARGE * POSE_FLOATS, value = ViewLayers.value;
  for (let k = 0; k < POSE_FLOATS; k++) value[o + k] = runtime.cocked[k] * raise;
  value[o + 1] += 0.02 * tighten;
  if (fraction >= 0.999 && Render.motion.shake > 0) value[o] += Math.sin(ViewLayers.scalars[L_CLOCK] * CHARGE_TREMBLE_HZ) * CHARGE_TREMBLE;
};

// W19 pump, W24 bolt: the part moves with the share of the shot interval gone; scoped, only a small scope bob.
ViewAction.cycleLayer = function (state, runtime) {
  const moves = ViewLayers.cycleMoves, cycle = runtime.cycle, part = runtime.second && runtime.second.role === MODEL_ROLES.indexOf(cycle.role) ? runtime.second : runtime.part;
  const o = LAYER.CYCLE * POSE_FLOATS, value = ViewLayers.value;
  moves.fill(0);
  value.fill(0, o, o + POSE_FLOATS);
  if (state.ads > 0.5) { value[o + 1] = Math.sin(Math.PI * state.cycle) * SCOPE_BOB_METRES; return; }
  sampleCycle(cycle, state);
  const m = part.role * MODEL_ROLE_MOVE_FLOATS;
  moves[m] += part.move[0] * cycleAmounts[0]; moves[m + 1] += part.move[1] * cycleAmounts[0]; moves[m + 2] += part.move[2] * cycleAmounts[0];
  moves[m + 3] += part.turn[0] * cycleAmounts[1]; moves[m + 4] += part.turn[2] * cycleAmounts[1];
};

// A gun that charges (not the maul, which has its own layer): its glow parts swell with the charge (W34 alt, W39, W45 alt) and the W27 bow draws
// its string back by the charge fraction while the bow cants 5 degrees. The drawn charge follows the real one over CHARGE_SHOWN_SECONDS.
const chargeShownTarget = new Float32Array(1);
ViewAction.chargeEffects = function (state, weaponRow, adsScale) {
  const scalars = ViewLayers.scalars, rate = scalars[L_SECONDS] / CHARGE_SHOWN_SECONDS, charging = state.chargeFraction > 0 && !!weaponRow && weaponRow.class !== 'melee';
  chargeShownTarget[0] = ZERO[0];
  if (charging) chargeShownTarget[0] = state.chargeFraction;
  scalars[L_CHARGE] += clamp(chargeShownTarget[0] - scalars[L_CHARGE], -rate, rate);
  const shown = scalars[L_CHARGE];
  if (shown <= 0 || !weaponRow) return;
  if (this.reloadSet < 0) this.values[VA.GLOW] = CHARGE_GLOW_FLOOR + (1 - CHARGE_GLOW_FLOOR) * shown;
  const bow = weaponRow.reloadAnimIndex >= 0 ? RELOAD_RUNTIME[weaponRow.reloadAnimIndex].bow : null;
  if (!bow) return;
  const o = bow.role * MODEL_ROLE_MOVE_FLOATS;
  this.main[o] += bow.move[0] * shown; this.main[o + 1] += bow.move[1] * shown; this.main[o + 2] += bow.move[2] * shown;
  this.pose[5] += bow.turn[2] * shown * adsScale;
};

// The weapon in hand knocked by a hit on the player: 2 to 4 cm down and pitched down, 0.05 s in, 0.2 s out.
ViewAction.applyKnock = function () {
  const scalars = ViewLayers.scalars, age = scalars[L_KNOCK_AGE];
  const amount = age < KNOCK_RISE_SECONDS ? age / KNOCK_RISE_SECONDS : Math.max(0, 1 - (age - KNOCK_RISE_SECONDS) / KNOCK_RECOVER_SECONDS);
  this.pose[1] -= scalars[L_KNOCK_METRES] * amount * scalars[L_MOTION]; this.pose[3] -= scalars[L_KNOCK_PITCH] * amount * scalars[L_MOTION];
};
Bus.on('damage', (event) => {
  if (event.target !== Game.playerId || !(event.amount > 0) || !KNOCK_KINDS.has(event.kind)) return;
  const share = Math.min(1, event.amount / KNOCK_FULL_DAMAGE), scalars = ViewLayers.scalars;
  scalars[L_KNOCK_AGE] = 0; scalars[L_KNOCK_METRES] = lerp(KNOCK_METRES_MIN, KNOCK_METRES_MAX, share); scalars[L_KNOCK_PITCH] = KNOCK_PITCH * lerp(0.5, 1, share);
});
Bus.on('match.start', () => ViewAction.restart());
Bus.on('match.stop', () => ViewAction.restart());
Bus.on('actor.spawn', (event) => { if (event.id === Game.playerId) ViewAction.restart(); });
ViewAction.restart = function () {
  ViewLayers.weight.fill(0); ViewLayers.value.fill(0); ViewLayers.reloadMoves.fill(0); ViewLayers.cycleMoves.fill(0); ViewLayers.scalars.fill(0);
  ViewLayers.scalars[L_KNOCK_AGE] = 99; ViewLayers.scalars[L_KICK_AGE] = 99; ViewLayers.scalars[L_MOTION] = 1;
  meleeStamp[0] = -1; meleeStamp[1] = -1e9;
};

// ---- Draw helpers for the extras of the view model (07e): the spare magazine and the off-hand ----
const spareShape = makeLooseShape(), handShape = makeLooseShape(), forearmShape = makeLooseShape();
const FOREARM_LENGTH_FROM_HAND = 0.4, FOREARM_WIDTH = 0.05, HAND_SIZE = [0.06, 0.05, 0.085];
const forearmDirection = new Float32Array(3);

// The spare of a set whose weapon model has no part for the role (or whose part is not a magazine): a plain box of the set's size.
function drawProceduralSpare(batch, pose, runtime, sample) {
  const loose = spareShape, size = runtime.spare;
  loose.shape = 'box'; loose.x = sample.hand[0]; loose.y = sample.hand[1]; loose.z = sample.hand[2];
  loose.sx = size[0]; loose.sy = size[1]; loose.sz = size[2]; loose.yaw = 0; loose.pitch = 0; loose.roll = pose.roll;
  loose.r = MODEL_PALETTE_RGB[SPARE_PALETTE * 4]; loose.g = MODEL_PALETTE_RGB[SPARE_PALETTE * 4 + 1]; loose.b = MODEL_PALETTE_RGB[SPARE_PALETTE * 4 + 2]; loose.emissive = 0;
  Models.drawLoose(batch, pose, loose);
}

// The off-hand: a hand box at `hand` and, in a reload, a forearm capsule running back and down from it (the model's frame; turned by the
// pose's roll so it follows the weapon). A hand on a swung haft has no forearm drawn: it would turn with the weapon. tint = the clothing colour.
function drawOffHand(batch, pose, hand, tint, withForearm) {
  const forearm = forearmShape, box = handShape, direction = forearmDirection;
  box.shape = 'box'; box.x = hand[0]; box.y = hand[1]; box.z = hand[2]; box.sx = HAND_SIZE[0]; box.sy = HAND_SIZE[1]; box.sz = HAND_SIZE[2];
  box.yaw = 0; box.pitch = 0; box.roll = pose.roll; box.r = tint[0]; box.g = tint[1]; box.b = tint[2]; box.emissive = 0;
  Models.drawLoose(batch, pose, box);
  if (!withForearm) return;
  // The forearm leaves the wrist toward the elbow (down, back and left in the model's frame), a capsule along its Y axis.
  direction[0] = -0.35; direction[1] = -0.9; direction[2] = -0.1;
  const length = length3(direction[0], direction[1], direction[2]);
  const reach = FOREARM_LENGTH_FROM_HAND / length;
  forearm.shape = 'capsule'; forearm.x = hand[0] + direction[0] * reach / 2; forearm.y = hand[1] + direction[1] * reach / 2; forearm.z = hand[2] + direction[2] * reach / 2;
  forearm.sx = FOREARM_WIDTH; forearm.sy = FOREARM_LENGTH_FROM_HAND; forearm.sz = FOREARM_WIDTH;
  // The capsule's Y axis along (wrist - elbow) in shape space: x mirrored, then rolled with the weapon.
  const dx = -direction[0] * pose.mirror / length, dy = -direction[1] / length, dz = -direction[2] / length, cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
  const rolledX = dx * cr - dy * sr, rolledY = dx * sr + dy * cr;
  forearm.pitch = Math.asin(clamp(rolledY, -1, 1)) - Math.PI / 2; forearm.yaw = Math.atan2(rolledX, dz) * pose.mirror; forearm.roll = 0;
  forearm.r = tint[0]; forearm.g = tint[1]; forearm.b = tint[2]; forearm.emissive = 0;
  Models.drawLoose(batch, pose, forearm);
}

// ---- Third person: ActorAction, the pitches and offsets the body parts take (07c placeActorPart reads it) ----
const ACTION_SLOTS = 6;      // 0 none, 1 armL, 2 armR, 3 gun, 4 torso, 5 head (03b actorParts `action`)
const ACTION_FLOATS = ACTION_SLOTS * 3;
const ACTION_FADE_SECONDS = 0.1;       // a cancelled reload or strike lets go of the body this long
const STAGGER_ARMS = -30 * DEG, STAGGER_GUN = -20 * DEG, STAGGER_SECONDS = 0.1;
const SWAP_GUN_DROP = -0.18, SWAP_GUN_PITCH = -35 * DEG, SWAP_ARM = -20 * DEG;
const KICK_VISIBLE = 0.2;   // degrees of gun pitch a body's shot kick must still have to be worked out (an early exit for the rest of its 0.12 s)
const FLINCH_RISE = 0.05, FLINCH_RECOVER = 0.25, FLINCH_RECOVER_HEAVY = 0.35;
const FLINCH_MELEE = 12 * DEG, FLINCH_HEAVY = 18 * DEG, FLINCH_SPLASH = 10 * DEG, FLINCH_BULLET_MAX = 6 * DEG, FLINCH_BULLET_DAMAGE = 40, FLINCH_HEAVY_DAMAGE = 84;
const FLINCH_KINDS = new Set(['hit', 'melee', 'beam', 'splash']);
const ActorAction = {
  pitch: new Float32Array(ACTION_SLOTS), y: new Float32Array(ACTION_SLOTS), z: new Float32Array(ACTION_SLOTS),   // per slot; slot 0 stays 0
  roleMove: new Float32Array(ROLE_FLOATS_TOTAL), moving: false,   // the held weapon's role parts (near bodies on presets with model detail)
  dirty: false,   // the slots hold something this frame: a quiet body leaves them alone (they are zero) instead of clearing them again
  weight: new Float32Array(MAX_ACTORS), frozen: new Float32Array(MAX_ACTORS * ACTION_FLOATS),
  stagger: new Float32Array(MAX_ACTORS),
  flinchAge: new Float32Array(MAX_ACTORS).fill(99), flinchAmount: new Float32Array(MAX_ACTORS), flinchRecover: new Float32Array(MAX_ACTORS),
};
// The Render.actorAction record (11a Weapons.actorAction fills it): the fields share their names with the Render.viewModel record.
const actionState = { kind: 0, kick: 0, kickDeg: 0, swap: 0, reloadSet: -1, reload: 0, reloadEmpty: 0, reloadFirst: 1, reloadLast: 0, meleeAnim: -1, meleeAge: 0, meleeCycle: 0, meleeCount: 0, fireHeld: 0, meleeStriker: -1, weaponIndex: -1, blocking: 0 };
const tpReload = new ReloadSample(), tpMelee = new MeleeSample();
const TP_ACTION = { NONE: 0, RELOAD: 1, MELEE: 2, SWAP: 3 };

ActorAction.clear = function () {
  this.pitch.fill(0); this.y.fill(0); this.z.fill(0);
  if (this.moving) { this.roleMove.fill(0); this.moving = false; }
  this.dirty = false;
};
function saveActorAction(id) {
  const frozen = ActorAction.frozen, o = id * ACTION_FLOATS;
  frozen.set(ActorAction.pitch, o); frozen.set(ActorAction.y, o + ACTION_SLOTS); frozen.set(ActorAction.z, o + ACTION_SLOTS * 2);
}
// The frozen action of the body, scaled by its weight (ActorAction.weight[id]): a cancelled reload or strike lets go over ACTION_FADE_SECONDS.
function loadActorAction(id) {
  const frozen = ActorAction.frozen, o = id * ACTION_FLOATS, weight = ActorAction.weight;
  for (let slot = 1; slot < ACTION_SLOTS; slot++) {
    ActorAction.pitch[slot] = frozen[o + slot] * weight[id]; ActorAction.y[slot] = frozen[o + ACTION_SLOTS + slot] * weight[id]; ActorAction.z[slot] = frozen[o + ACTION_SLOTS * 2 + slot] * weight[id];
  }
}

// The action layer of one body this frame (animateActor calls it): reload, melee strike or swap from Render.actorAction, then the
// stagger of a stunned body and the flinch of a hit one. Killcam replay bodies and distant ones get nothing.
function computeActorAction(id, pose, seconds, lod) {
  const action = ActorAction, state = actionState;
  if (pose.recorded || lod === LOD.distant) {
    if (action.dirty) action.clear();
    action.weight[id] = 0; action.stagger[id] = 0;
    return;
  }
  state.kind = TP_ACTION.NONE;
  if (Render.actorAction) Render.actorAction(id, state);
  const stunned = (Actors.flags[id] & ACTOR_FLAG.FROZEN) !== 0;
  const kicking = lod === LOD.near && state.kick * state.kickDeg > KICK_VISIBLE;   // only a near body's kick is seen, and only while it is big enough to be
  if (state.kind === TP_ACTION.NONE && !stunned && !kicking && action.weight[id] === 0 && action.stagger[id] === 0 && action.flinchAge[id] >= FLINCH_RISE + action.flinchRecover[id]) {
    if (action.dirty) action.clear();   // most bodies most frames: nothing to do
    return;
  }
  action.clear();
  action.dirty = true;
  if (kicking) action.pitch[3] = state.kickDeg * DEG * state.kick;   // P7 F05: the held gun pitches up for the length of the shot's kick (the sim's 0.12 s)
  if (state.kind !== TP_ACTION.NONE) {
    playActorAction(id, state, lod);
    action.weight[id] = 1;
    saveActorAction(id);
  } else if (action.weight[id] > 0) {
    action.weight[id] = Math.max(0, action.weight[id] - seconds / ACTION_FADE_SECONDS);
    loadActorAction(id);
  }
  const direction = stunned ? 1 : -1;   // the sign as an integer: a ternary of a float and its negation boxes the float
  action.stagger[id] = clamp(action.stagger[id] + seconds * direction / STAGGER_SECONDS, 0, 1);
  if (action.stagger[id] > 0) {
    action.pitch[1] += STAGGER_ARMS * action.stagger[id]; action.pitch[2] += STAGGER_ARMS * action.stagger[id]; action.pitch[3] += STAGGER_GUN * action.stagger[id];
  }
  action.flinchAge[id] += seconds;
  const age = action.flinchAge[id], recover = action.flinchRecover[id];
  if (age < FLINCH_RISE + recover) {
    const amount = action.flinchAmount[id] * (age < FLINCH_RISE ? age / FLINCH_RISE : 1 - (age - FLINCH_RISE) / recover);
    action.pitch[4] += amount; action.pitch[5] += amount;
  }
}

function playActorAction(id, state, lod) {
  const action = ActorAction;
  if (state.kind === TP_ACTION.SWAP) {
    action.y[3] += SWAP_GUN_DROP * state.swap; action.pitch[3] += SWAP_GUN_PITCH * state.swap; action.pitch[1] += SWAP_ARM * state.swap;
    return;
  }
  if (state.kind === TP_ACTION.RELOAD) playReloadAction(id, state, lod);
  else playMeleeAction(state);
}

function playReloadAction(id, state, lod) {
  const runtime = RELOAD_RUNTIME[state.reloadSet], sample = tpReload, tp = runtime.tp, action = ActorAction;
  sample.partVector.fill(0);
  const model = lod === LOD.near && Render.quality.modelDetail ? heldWeaponModel(id) : null, part = runtime.part;
  if (model && part && part.mode === PART_MODE.mag) partDirection(model, part, sample.partVector);
  sampleReloadOf(runtime, state, sample);
  const work = sample.key[POSE_FLOATS], fetch = sample.scalars[S_FETCH], jerk = sample.scalars[S_JERK];
  action.pitch[3] += tp[0] * work; action.y[3] += tp[1] * work; action.pitch[4] += tp[2] * work;
  action.pitch[1] += tp[3] * work + tp[4] * fetch; action.pitch[2] += tp[5] * jerk + tp[6] * fetch;
  if (!model || !part) return;
  writeReloadMoves(action.roleMove, runtime, sample);
  action.moving = true;
}

function playMeleeAction(state) {
  const runtime = MELEE_RUNTIME[state.meleeAnim], sample = tpMelee, action = ActorAction, values = sample.values;
  if (!runtime) return;
  aimWind(runtime, state);
  values[M_AGE] = state.meleeAge; values[M_CYCLE] = state.meleeCycle; values[M_STOP] = 0; values[M_WIND] = windTarget[0]; values[M_SIGN] = 1;
  sampleMelee(runtime, sample);
  const arms = runtime.arms, contact = values[M_CONTACT], through = values[M_THROUGH], armAmount = arms[1] * contact + arms[2] * through + arms[0] * values[M_COCKED];
  action.pitch[2] += armAmount;
  if (!runtime.oneHand) action.pitch[1] += armAmount;
  action.pitch[4] += runtime.torso[0] * (contact + through * 0.5);
  action.pitch[3] += runtime.gunPitch[0] * (contact + through) - runtime.gunPitch[0] * values[M_COCKED] * 0.5;
  action.z[3] += runtime.gunForward[0] * (contact + through * 0.5);
}

// A hit body flinches (torso and head pitch away from the hit relative to where it faces): 0.05 s in, 0.25 s out. Melee 12 degrees,
// a heavy blow (a backstab, a charged maul, the shield bash) 18 and slower, a bullet or beam up to 6 by its damage, a blast 10.
Bus.on('damage', (event) => {
  const target = event.target;
  if (target < 0 || !(event.amount > 0) || !FLINCH_KINDS.has(event.kind)) return;
  const action = ActorAction, heavy = event.kind === 'melee' && (event.amount >= FLINCH_HEAVY_DAMAGE || event.weapon === 'bulwark');
  let size = FLINCH_BULLET_MAX * Math.min(1, event.amount / FLINCH_BULLET_DAMAGE);
  if (event.kind === 'melee') size = heavy ? FLINCH_HEAVY : FLINCH_MELEE;
  else if (event.kind === 'splash') size = FLINCH_SPLASH;
  const facing = Actors.yaw[target], fromFront = event.dx * Math.sin(facing) + event.dz * Math.cos(facing) < 0;
  action.flinchAge[target] = 0; action.flinchAmount[target] = fromFront ? size : -size; action.flinchRecover[target] = heavy ? FLINCH_RECOVER_HEAVY : FLINCH_RECOVER;
});
Bus.on('actor.create', (id) => { ActorAction.weight[id] = 0; ActorAction.stagger[id] = 0; ActorAction.flinchAge[id] = 99; });
