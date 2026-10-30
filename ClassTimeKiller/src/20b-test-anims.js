// Self-tests for P6-02 / P6-03 / P6-04 (group 'anims'): the reload sets map to all 38 weapons, every reload animation ends on the step the rounds are
// added, partial / empty / shell-by-shell / cancelled reloads, the melee contact and end times per melee weapon and the quick melee, the layer
// priority and blends (no pop across swap, reload, melee, ADS and sprint for any weapon), the swap split, the third-person action layer and that
// the per-frame layers allocate nothing. DebugApi.animDemo(weapon, what, fraction, options) puts one frame of an animation on screen for a screenshot:
//   node tools/selftest.mjs --no-selftest --eval "document.getElementById('overlay').style.display='none'; __CTK.animDemo('vanguard', 'reload', 0.4)" --screenshot reload.png

// The reload set every weapon plays (Appendix C "P6-01", Weapon map); '' = the weapon never reloads.
const ANIM_TEST_SETS = {
  maul: '', tanto: '', bulwark: '', warden: 'R1', verdict: 'R2', hush: 'R1', sparklock: 'R8', wasp: 'R3', hornet: 'R3', needlethorn: 'R8', vanguard: 'R3', ratchet: 'R3',
  coilcaster: 'R8', scattergun: 'R5', hookjaw: 'R6', shardcaster: 'R7', lancet: 'R8', heron: 'R4', kestrel: 'R3', stakedriver: 'R9', talonbow: 'R10', hailstorm: 'R11',
  linker: 'R8', ramjet: 'R13', pitcher: 'R7', gloop: 'R12', kindler: 'R12', ember: 'R8', stormlash: 'R8', starthrower: 'R8', accelerator: 'R8', fusionmortar: 'R14',
  lifter: '', twingate: '', auger: 'R14', razorwind: '', daybreak: 'R8', halcyon: 'R14',
};
// The reload seconds of the same table (a class value unless the row overrides it): proof that the animation work changed no reload time
// (P8-04 O2 then gave the Shardcaster 2 s for its whole 10-round magazine; the animation phases are fractions of the live time).
const ANIM_TEST_RELOAD_SECONDS = { warden: 1.4, verdict: 1.4, hush: 1.4, sparklock: 1.4, wasp: 1.8, hornet: 1.8, needlethorn: 1.8, vanguard: 2.2, ratchet: 2.2, coilcaster: 2, scattergun: 0.5,
  hookjaw: 0.8, shardcaster: 2, lancet: 2.4, heron: 3.6, kestrel: 2.4, stakedriver: 2.4, talonbow: 0.5, hailstorm: 4, linker: 2, ramjet: 2.5, pitcher: 2.5, gloop: 2.5, kindler: 4,
  ember: 2, stormlash: 2, starthrower: 2, accelerator: 2, fusionmortar: 2.5, auger: 2.5, daybreak: 3, halcyon: 3 };
// The phase end fractions of every set as Appendix C lists them: [partial, empty]; an empty list = the same as the partial one.
const ANIM_TEST_PHASES = {
  R1: [[0.12, 0.28, 0.50, 0.68, 1], [0.10, 0.24, 0.44, 0.60, 0.78, 1]], R2: [[0.10, 0.30, 0.50, 0.70, 0.82, 1]], R3: [[0.12, 0.30, 0.50, 0.68, 1], [0.10, 0.25, 0.42, 0.58, 0.80, 1]],
  R4: [[0.10, 0.20, 0.34, 0.52, 0.66, 0.78, 1]], R6: [[0.15, 0.30, 0.45, 0.70, 0.82, 1]], R7: [[0.15, 0.32, 0.50, 0.70, 0.82, 1]], R8: [[0.12, 0.35, 0.50, 0.66, 0.86, 1]],
  R9: [[0.12, 0.28, 0.46, 0.64, 1], [0.10, 0.24, 0.40, 0.56, 0.80, 1]], R10: [[0.35, 0.75, 1]], R11: [[0.10, 0.20, 0.35, 0.55, 0.70, 0.80, 0.88, 1]],
  R12: [[0.10, 0.20, 0.35, 0.55, 0.72, 0.82, 0.92, 1]], R13: [[0.12, 0.22, 0.32, 0.52, 0.72, 0.82, 1]], R14: [[0.12, 0.24, 0.46, 0.66, 0.78, 0.92, 1]],
};
const ANIM_TEST_SHELL_PHASES = { first: [0.25, 0.85, 1], middle: [0.35, 0.85, 1], last: [0.30, 0.65, 1], only: [0.20, 0.60, 1], emptyFirst: [0.20, 0.60, 0.85, 1], emptyLast: [0.20, 0.60, 0.80, 1] };
// The strike cycles of Appendix C "P6-03": seconds from the hit tick until the weapon may act again.
const ANIM_TEST_MELEE_CYCLES = { maulPrimary: 0.4, maulAlt: 1 / 1.5, tantoPrimary: 0.4, tantoAlt: 1, bulwarkBash: 1 / 1.5, quick: 1 / 1.2 };
const ANIM_FRAME = 1 / 60;
const ANIM_STEPS_PER_FRAME = TICK_RATE / 60;
const ANIM_MAX_POSITION_JUMP = 0.1;      // metres a frame may move the weapon pivot (a swap alone lowers it 0.04 m a frame at the fastest equip time; the contact frame of a melee strike is a smear by design)
const ANIM_MAX_ANGLE_JUMP = 0.35;        // radians per frame
const ANIM_MAX_PART_JUMP = 0.1;          // model units per frame for a moving part
const ANIM_MAX_PART_ANGLE_JUMP = 0.5;    // radians per frame for a part that turns (a 60 degree lid closes in the 0.05 s a strike gives a cancelled reload: 0.41 a frame)

// A running test match with the player as actor `id` carrying `keys` (the last one drawn) and the view pipeline ready for fillViewModel.
function animTestStart(keys) {
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0);
  Weapons.setLoadout(id, keys);
  keys.forEach((key) => { const slot = Weapons.slotIndex(id, CAT.weapons.byId(key).index); Weapons.reserve[slot] = 500; });
  Game.playerId = id;
  Render.viewModel = (out) => Weapons.viewModel(out);
  ViewAction.restart();
  Object.assign(Render.camera, { x: 0, y: STAND_EYE, z: 0, yaw: 0, pitch: 0, roll: 0 });
  return id;
}
function animTestFinish() { Game.playerId = -1; animTestSprint.on = false; ViewAction.restart(); TestArena.finish(); }
// One rendered frame of the local player's view model (the Render.viewModel hook, then the layers): returns the viewModelState.
function animTestFrame(seconds) {
  ViewState.overridden = false;
  readViewModel();
  fillViewModel(seconds === undefined ? ANIM_FRAME : seconds);
  return viewModelState;
}
// Runs `frames` frames of 60 Hz rendering, each after two sim steps with the buttons held; `each(state, frame)` may inspect the frame.
function animTestRun(id, frames, buttons, each) {
  for (let frame = 0; frame < frames; frame++) {
    Game.playerId = -1;
    Actors.buttons[id] = buttons;
    Sim.run(ANIM_STEPS_PER_FRAME);
    if (animTestSprint.on) Actors.flags[id] |= ACTOR_FLAG.SPRINTING;
    Game.playerId = id;
    const state = animTestFrame();
    if (each) each(state, frame);
  }
}
const animTestSeconds = (seconds) => Math.ceil(seconds * 60);
// Weapons.viewModel into the one record the game gives it, as a copy of the fields a test reads (a fresh object per call would make the hook polymorphic).
const animTestSnap = { reload: 0, reloadSet: -1, reloadEmpty: 0, reloadFirst: 1, reloadLast: 0, charge: 0, chargeFraction: 0 };
function animTestView() {
  Weapons.viewModel(viewModelState);
  for (const key in animTestSnap) animTestSnap[key] = viewModelState[key];
  return animTestSnap;
}
const animTestSprint = { on: false };   // the movement step clears the sprint flag, so a test sets it again after every step
function animTestStep(id, buttons) {
  Game.playerId = -1;
  Actors.buttons[id] = buttons; Sim.step(); Actors.buttons[id] = 0;
  Game.playerId = id;
}
// The weapon pivot offsets of the frame (base pose plus layers) and the role part moves, as one record for comparing frames.
const animTestPose = new Float64Array(POSE_FLOATS + 3);
function animTestSnapshot(state) {
  const base = poseWeapon(viewWeaponModel(state).pose, state), layers = ViewAction.pose, main = ViewAction.main;
  animTestPose[0] = base.x + layers[0]; animTestPose[1] = base.y + layers[1]; animTestPose[2] = base.z + layers[2];
  animTestPose[3] = base.pitch + layers[3]; animTestPose[4] = layers[4]; animTestPose[5] = layers[5];
  let moved = 0, turned = 0, hidden = 0;   // only parts that are drawn count: a fetched magazine is hidden (and back in its seat when the reload is cancelled) wherever its numbers are
  for (let role = 1; role < MODEL_ROLES.length; role++) {
    const o = role * MODEL_ROLE_MOVE_FLOATS;
    if (main[o + 5] === 0) { moved += Math.abs(main[o]) + Math.abs(main[o + 1]) + Math.abs(main[o + 2]); turned += Math.abs(main[o + 3]) + Math.abs(main[o + 4]); }
    else hidden |= 1 << role;
  }
  animTestPose[POSE_FLOATS] = moved; animTestPose[POSE_FLOATS + 1] = hidden; animTestPose[POSE_FLOATS + 2] = turned;
  return animTestPose;
}
const animTestIsZero = (values) => Array.from(values).every((value) => Math.abs(value) < 1e-9);
// A reload sample of `phases` at a fraction (the sampling functions take a record, not floats: PERF-006).
function animTestSample(runtime, phases, empty, fraction, sample, clickAt) {
  sample.scalars[S_FRACTION] = fraction; sample.empty = empty ? 1 : 0; sample.scalars[S_CLICK] = clickAt === undefined ? NO_CLICK : clickAt; sample.partVector.fill(0);
  sampleReload(runtime, phases, sample);
  return sample;
}
function animTestShell(runtime, fraction, first, last, empty, sample) {
  sample.scalars[S_FRACTION] = fraction; sample.first = first ? 1 : 0; sample.last = last ? 1 : 0; sample.empty = empty ? 1 : 0;
  sampleShell(runtime, sample);
  return sample;
}

// The view-model record of a weapon in one animation at one fraction (what: reload, melee, sprint, block; settings: empty, first, last, ads, anim,
// kind, striker, count, parry), as Render.viewModel would fill it.
function animTestShowState(out, weapon, what, fraction, settings) {
  out.visible = true; out.shape = weapon.class; out.model = weapon.id; out.color = weapon.family.color; resetViewModelAnimation(out);
  out.weaponIndex = weapon.index; out.ads = settings.ads || 0;
  if (what === 'reload') { out.reloadSet = weapon.reloadAnimIndex; out.reload = fraction; out.reloadEmpty = settings.empty ? 1 : 0; out.reloadFirst = settings.first === false ? 0 : 1; out.reloadLast = settings.last ? 1 : 0; }
  if (what === 'melee') {
    out.meleeAnim = settings.anim === undefined ? weapon.meleeAnimIndex : settings.anim; out.meleeCycle = 0.4; out.meleeAge = fraction * 0.4; out.meleeAt = 5;
    out.meleeKind = settings.kind || 1; out.meleeStriker = settings.striker === undefined ? weapon.index : settings.striker; out.meleeCount = settings.count || 0;
    out.meleeHit = settings.hit ? 1 : 0;
  }
  if (what === 'sprint') out.sprinting = 1;
  if (what === 'block') { out.blocking = 1; out.parry = settings.parry ? 1 : 0; }
  return out;
}

DebugApi.animDemo = (weaponId, what, fraction, options) => {
  const weapon = CAT.weapons.byId(weaponId), settings = options || {};
  DebugApi.renderDemo('foundry', weaponId, settings.quality || 'high');
  Render.viewModel = (out) => animTestShowState(out, weapon, what, fraction, settings);
  ViewAction.restart();
  Render.drawFrame(1 / 60, 1);
  Render.drawFrame(1 / 60, 1);
  return { weapon: weaponId, what, fraction, instances: viewModelBatch.counts.reduce((a, b) => a + b, 0) };
};

// ---- How much of the screen the view model takes and how close it comes to the eye ----
// The view model is drawn at its own field of view on a 16:9 screen; the camera sits at the origin looking along +z. Each part is a box of its
// instance size (every shape fits inside it), turned like the shader turns it (roll about its own Z, then pitch, then yaw); the projected
// corners of every part are filled into a 64 x 36 grid and the share of the grid they cover is the share of the screen. The nearest point
// is the closest part corner to the eye. A corner nearer than the near plane of the view-model pass is clipped.
const ANIM_COVER_COLUMNS = 64, ANIM_COVER_ROWS = 36;
const ANIM_COVER_MAX_SHARE = 0.30;       // one view model may cover at most this share of a 16:9 screen on any frame of a reload or a strike
const ANIM_COVER_MIN_DISTANCE = 0.12;    // metres: its nearest corner stays this far from the eye (the idle weapons' nearest corner is about 0.2; the view-model near plane is 0.01)
const animCoverGrid = new Uint8Array(ANIM_COVER_COLUMNS * ANIM_COVER_ROWS);
const animCoverCorner = new Float64Array(16);
function animTestCorners(d, o) {
  const roll = d[o + 15], cr = Math.cos(roll), sr = Math.sin(roll), pitch = d[o + 7], cp = Math.cos(pitch), sp = Math.sin(pitch), yaw = d[o + 3], cy = Math.cos(yaw), sy = Math.sin(yaw);
  const points = [];
  for (let corner = 0; corner < 8; corner++) {
    const lx = (corner & 1 ? 0.5 : -0.5) * d[o + 4], ly = (corner & 2 ? 0.5 : -0.5) * d[o + 5], lz = (corner & 4 ? 0.5 : -0.5) * d[o + 6];
    const rx = lx * cr - ly * sr, ry = lx * sr + ly * cr;
    const py = ry * cp + lz * sp, pz = -ry * sp + lz * cp;
    points.push([d[o] + rx * cy + pz * sy, d[o + 1] + py, d[o + 2] - rx * sy + pz * cy]);
  }
  return points;
}
function animTestHull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of sorted.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
// The screen share and the nearest distance of what viewModelBatch holds now (camera at the origin, yaw and pitch 0).
function animTestCover() {
  const tanY = Math.tan(verticalFov(Render.config.viewmodelFov) / 2), tanX = tanY * 16 / 9;
  animCoverGrid.fill(0);
  let nearest = Infinity;
  for (let shape = 0; shape < SHAPES.length; shape++) {
    for (let i = 0; i < viewModelBatch.counts[shape]; i++) {
      const points = animTestCorners(viewModelBatch.data, (shape * viewModelBatch.capacity + i) * INSTANCE_FLOATS), projected = [];
      for (const p of points) {
        nearest = Math.min(nearest, length3(p[0], p[1], p[2]));
        if (p[2] > VIEWMODEL_NEAR) projected.push([-p[0] / p[2] / tanX, p[1] / p[2] / tanY]);   // view right = world -x
      }
      if (projected.length < 3) continue;
      const hull = animTestHull(projected);
      for (let row = 0; row < ANIM_COVER_ROWS; row++) {
        for (let column = 0; column < ANIM_COVER_COLUMNS; column++) {
          const x = (column + 0.5) / ANIM_COVER_COLUMNS * 2 - 1, y = 1 - (row + 0.5) / ANIM_COVER_ROWS * 2;
          let inside = true;
          for (let k = 0; k < hull.length && inside; k++) {
            const a = hull[k], b = hull[(k + 1) % hull.length];
            if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) inside = false;
          }
          if (inside) animCoverGrid[row * ANIM_COVER_COLUMNS + column] = 1;
        }
      }
    }
  }
  let covered = 0;
  for (let i = 0; i < animCoverGrid.length; i++) covered += animCoverGrid[i];
  return { share: covered / animCoverGrid.length, nearest };
}
// One frame of the weapon in an animation at a fraction, laid out at the origin with no bob, and its screen share and nearest point.
function animTestCoverAt(weapon, what, fraction, settings) {
  const saved = { camera: Object.assign({}, Render.camera), bob: Render.motion.bob, phase: ViewState.bobPhase, offset: Render.config.viewmodelOffset, state: Object.assign({}, viewModelState) };
  Object.assign(Render.camera, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 });
  Render.motion.bob = 0; ViewState.bobPhase = 0; Render.config.viewmodelOffset = [0, 0, 0];
  animTestShowState(viewModelState, weapon, what, fraction, settings || {});
  viewModelState.kick = 0; viewModelState.swap = 0; viewModelState.zoom = 1;
  ViewAction.restart();
  fillViewModel(ANIM_FRAME);
  const result = animTestCover();
  Object.assign(Render.camera, saved.camera); Render.motion.bob = saved.bob; ViewState.bobPhase = saved.phase; Render.config.viewmodelOffset = saved.offset;
  Object.assign(viewModelState, saved.state);
  viewModelBatch.clear();
  return result;
}
// Every frame of the sweep: [weapon, what, fraction, share, nearest] of the worst share and the nearest point per weapon and animation.
DebugApi.animCover = (weaponIds) => {
  const rows = [];
  const ids = weaponIds || CAT.weapons.map((weapon) => weapon.id);
  for (const id of ids) {
    const weapon = CAT.weapons.byId(id), runs = [['idle', 0, {}]];
    if (weapon.reloadAnimIndex >= 0) {
      const shells = CAT.reloadAnims[weapon.reloadAnimIndex].shell !== null;
      for (let f = 0; f <= 1.0001; f += 0.05) {
        runs.push(['reload', f, {}], ['reload', f, { empty: true }]);
        if (shells) runs.push(['reload', f, { first: false, last: false }], ['reload', f, { first: false, last: true }], ['reload', f, { empty: true, last: true }]);
      }
    }
    if (weapon.meleeAnimIndex >= 0) {
      const anims = [weapon.meleeAnimIndex, weapon.meleeAltIndex];
      for (const anim of anims) for (let f = 0; f <= 1.0001; f += 0.05) { runs.push(['melee', f, { anim }], ['melee', f, { anim, hit: true }]); }
    }
    let worst = { share: 0, nearest: Infinity, share_at: '', near_at: '' };
    for (const [what, fraction, settings] of runs) {
      const cover = animTestCoverAt(weapon, what, fraction, settings), label = what + ' ' + fraction.toFixed(2) + ' ' + JSON.stringify(settings);
      if (cover.share > worst.share) { worst.share = cover.share; worst.share_at = label; }
      if (cover.nearest < worst.nearest) { worst.nearest = cover.nearest; worst.near_at = label; }
    }
    rows.push([id, worst.share.toFixed(3), worst.share_at, worst.nearest.toFixed(3), worst.near_at]);
  }
  return rows;
};

// ---- Data: the sets, the mapping of all 38 weapons, the phases ----
Test.add('anims', (check) => {
  check('14 reload sets R1..R14 and the melee rows (maul, maulAlt, tanto, tantoAlt, bulwark and three gun bashes)', CAT.reloadAnims.map((row) => row.id).join() === 'R1,R2,R3,R4,R5,R6,R7,R8,R9,R10,R11,R12,R13,R14'
    && CAT.meleeAnims.map((row) => row.id).join() === 'maul,maulAlt,tanto,tantoAlt,bulwark,bashSidearm,bashLong,bashHeavy');
  const wrong = CAT.weapons.filter((weapon) => (weapon.reloadAnimIndex >= 0 ? CAT.reloadAnims[weapon.reloadAnimIndex].id : '') !== ANIM_TEST_SETS[weapon.id]);
  check('the reload set of all 38 weapons is the one of Appendix C', CAT.weapons.length === 38 && Object.keys(ANIM_TEST_SETS).length === 38 && wrong.length === 0, wrong.map((weapon) => weapon.id).join());
  const never = CAT.weapons.filter((weapon) => weapon.reloadAnimIndex < 0).map((weapon) => weapon.code).join();
  check('six weapons never reload and have no set: W01, W02, W03, W41, W42, W44', never === 'W01,W02,W03,W41,W42,W44', never);
  check('every set is used by at least one weapon', CAT.reloadAnims.every((row) => CAT.weapons.some((weapon) => weapon.reloadAnimIndex === row.index)));
  const seconds = CAT.weapons.filter((weapon) => ANIM_TEST_RELOAD_SECONDS[weapon.id] !== weapon.reload && weapon.mag > 0);
  check('no reload time changed: every weapon keeps the reload seconds of the table (the animation reads them, never writes)', seconds.length === 0, seconds.map((weapon) => weapon.id + ' ' + weapon.reload).join());
  const bash = CAT.weapons.filter((weapon) => weapon.class !== 'melee' && !CAT.meleeAnims[weapon.meleeAnimIndex].classes.includes(weapon.class));
  check('the quick melee of every gun has the bash of its class (pistol whip, butt-stroke, shoulder shove)', bash.length === 0, bash.map((weapon) => weapon.id).join());
  const own = ['maul', 'tanto', 'bulwark'].map((id) => CAT.weapons.byId(id)).map((weapon) => CAT.meleeAnims[weapon.meleeAnimIndex].id + '/' + CAT.meleeAnims[weapon.meleeAltIndex].id).join();
  check('the three melee weapons have their own strikes (the alt falls back to the primary one: W03 alt blocks)', own === 'maul/maulAlt,tanto/tantoAlt,bulwark/bulwark', own);
});

Test.add('anims', (check) => {
  const problems = [];
  const ends = (phases) => Array.from(phases.ends).map((end) => Math.round(end * 100) / 100);
  CAT.reloadAnims.forEach((row, index) => {
    const runtime = RELOAD_RUNTIME[index];
    if (row.shell) {
      SHELL_NAMES.forEach((name, variant) => { if (ends(runtime.shellPhases[variant]).join() !== ANIM_TEST_SHELL_PHASES[name].join()) problems.push('R5 ' + name + ' ' + ends(runtime.shellPhases[variant])); });
      return;
    }
    const expected = ANIM_TEST_PHASES[row.id];
    if (ends(runtime.partial).join() !== expected[0].join()) problems.push(row.id + ' partial ' + ends(runtime.partial));
    if (ends(runtime.empty).join() !== (expected[1] || expected[0]).join()) problems.push(row.id + ' empty ' + ends(runtime.empty));
  });
  check('every set has the phase fractions of Appendix C (partial and empty; the five shell cycles)', problems.length === 0, problems.join('; '));
  const unordered = [];
  RELOAD_RUNTIME.forEach((runtime) => {
    const variants = runtime.shell ? runtime.shellPhases : [runtime.partial, runtime.empty];
    variants.forEach((phases) => {
      const last = phases.kinds[phases.count - 1], increasing = Array.from(phases.ends).every((end, index) => index === 0 || end > phases.ends[index - 1]);
      if (phases.ends[phases.count - 1] !== 1 || !(last === RELOAD_KIND.raise || last === RELOAD_KIND.exit || last === RELOAD_KIND.hold) || !increasing) unordered.push(runtime.row.id);
    });
  });
  check('the last phase of every variant ends at fraction 1.0 (the refill step) and the fractions rise', unordered.length === 0, unordered.join());
  const roles = [];
  CAT.reloadAnims.forEach((row, index) => {
    const parts = [RELOAD_RUNTIME[index].part, RELOAD_RUNTIME[index].second].filter(Boolean);
    parts.forEach((part) => { if (part.role <= 0 || part.mode === undefined) roles.push(row.id + ' role/mode'); });
    const users = CAT.weapons.filter((weapon) => weapon.reloadAnimIndex === index);
    const magazine = RELOAD_RUNTIME[index].part;
    if (magazine && magazine.mode === PART_MODE.mag && !users.some((weapon) => modelHasRole(WeaponModels.weapon[weapon.index], magazine.role))) roles.push(row.id + ' no model has its ' + MODEL_ROLES[magazine.role]);
  });
  check('every set\'s magazine-like part is a role that some weapon of the set has (the others draw the spare box of the set)', roles.length === 0, roles.join());
  let unknown = '';
  try { Models.compile([{ id: 'bad', parts: [{ offset: [0, 0, 0], size: [0.1, 0.1, 0.1], role: 'nope' }] }], null); } catch (error) { unknown = error.message; }
  check('a model part with an unknown role is refused at compile time', unknown.includes('unknown role'), unknown);
});

// ---- P6-02: the animation end is the refill step ----
// A reload from `magazine` rounds with the RELOAD button: the step the magazine changes, the fractions the view saw, and the sim facts.
function animTestReload(weaponId, magazine, attachment) {
  const id = animTestStart([weaponId]), weapon = CAT.weapons.byId(weaponId), slot = Weapons.slotIndex(id, weapon.index);
  if (attachment) Weapons.attach(id, weaponId, attachment);
  Weapons.magazine[slot] = magazine === 'empty' ? 0 : Math.max(1, Weapons.magSize(id, weapon) - 2);
  const before = Weapons.magazine[slot], result = { weapon, id, started: false, refillStep: -1, lastFraction: 0, fractionAtRefill: 0, setBefore: -1, setAfter: -1, duration: 0, empty: 0 };
  animTestStep(id, BTN.RELOAD);
  result.started = Weapons.state[id] === WEAPON_STATE.RELOAD;
  result.duration = Weapons.stateDuration[id]; result.empty = Weapons.reloadEmpty[id];
  for (let step = 1; step < result.duration * TICK_RATE + 20; step++) {
    const view = animTestView();
    result.lastFraction = view.reload; result.setBefore = view.reloadSet;
    animTestStep(id, 0);
    if (Weapons.magazine[slot] !== before) {
      const after = animTestView();
      result.refillStep = step; result.setAfter = after.reloadSet; result.fractionAtRefill = Weapons.stateTime[id] / Weapons.stateDuration[id];
      break;
    }
  }
  animTestFinish();
  return result;
}
Test.add('anims', (check) => {
  const late = [], early = [], broken = [];
  CAT.weapons.filter((weapon) => weapon.reloadAnimIndex >= 0 && !weapon.reloadShell).forEach((weapon) => {
    ['partial', 'empty'].forEach((kind) => {
      if (kind === 'partial' && weapon.mag <= 1) return;   // a one-round magazine is either full or empty
      const run = animTestReload(weapon.id, kind === 'empty' ? 'empty' : 'partial');
      if (!run.started || run.refillStep < 0) { broken.push(weapon.id + ' ' + kind); return; }
      // The animation plays until the step the rounds are added: before it the view says "reloading" below fraction 1, at it the reload is over.
      if (!(run.lastFraction < 1) || run.setBefore !== weapon.reloadAnimIndex) early.push(weapon.id + ' ' + kind + ' ' + run.lastFraction);
      if (run.setAfter !== -1 || run.fractionAtRefill < 1 - 1e-6) late.push(weapon.id + ' ' + kind + ' ' + run.fractionAtRefill);
      if (Math.abs(run.duration - weapon.reload) > 1e-6 || run.empty !== (kind === 'empty' ? 1 : 0)) broken.push(weapon.id + ' ' + kind + ' duration ' + run.duration);
    });
  });
  check('every weapon (32 with a magazine, partial and empty): the reload runs and the rounds are added', broken.length === 0, broken.join());
  check('the animation is still playing on the step before the refill (fraction below 1)', early.length === 0, early.join());
  check('the animation ends on the very step the rounds are added (fraction reaches 1, no reload set after it)', late.length === 0, late.join());
  const quick = animTestReload('vanguard', 'empty', 'quickMag'), slow = animTestReload('vanguard', 'empty', 'extendedMag');
  check('attachments scale the animation with the reload: quickMag x0.75 and extendedMag x1.15 still end on the refill step',
    Test.near(quick.duration, 2.2 * 0.75, 1e-5) && Test.near(slow.duration, 2.2 * 1.15, 1e-5) && quick.fractionAtRefill >= 1 - 1e-6 && slow.fractionAtRefill >= 1 - 1e-6 && quick.setAfter === -1 && slow.setAfter === -1,
    [quick.duration, slow.duration]);
  const shown = [];
  CAT.reloadAnims.forEach((row, index) => {
    const runtime = RELOAD_RUNTIME[index], sample = new ReloadSample();
    (runtime.shell ? runtime.shellPhases : [runtime.partial, runtime.empty]).forEach((phases) => {
      animTestSample(runtime, phases, false, 1, sample);
      const atHold = Array.from(sample.key).slice(0, POSE_FLOATS).every((value) => Math.abs(value) < 1e-5) || phases.kinds[phases.count - 1] === RELOAD_KIND.hold;
      if (!atHold || sample.hidden[0] || sample.hidden[1] || sample.spareOn || sample.scalars[S_GLOW] !== 1 || sample.amount[0] || sample.amount[1]) shown.push(row.id);
    });
  });
  check('at fraction 1 every set is back at the hold pose: parts seated, spare gone, glow full', shown.length === 0, shown.join());
});

// ---- Partial, empty ----
Test.add('anims', (check) => {
  const partial = animTestReload('warden', 'partial'), empty = animTestReload('warden', 'empty');
  check('a partial and an empty reload take the same time and the HUD count changes at fraction 1.0 (the sim has no chamber step)', partial.duration === empty.duration && partial.empty === 0 && empty.empty === 1
    && partial.fractionAtRefill >= 1 && empty.fractionAtRefill >= 1);
  const runtime = RELOAD_RUNTIME[CAT.reloadAnims.byId('R1').index], sample = new ReloadSample();
  animTestSample(runtime, runtime.empty, true, 0.05, sample);
  const slideBack = sample.amount[1];
  animTestSample(runtime, runtime.partial, false, 0.05, sample);
  check('R1 the slide stays back through an empty reload (magazine 0) and not through a partial one; it snaps forward in RACK', slideBack === 1 && sample.amount[1] === 0);
  animTestSample(runtime, runtime.empty, true, 0.70, sample);
  const racking = sample.kind === RELOAD_KIND.rack && sample.amount[1] < 1 && sample.amount[1] > 0;
  animTestSample(runtime, runtime.empty, true, 0.7799, sample);
  check('R1 empty: the RACK phase 0.60-0.78 runs the slide forward', racking && sample.amount[1] === 0);
  const cell = RELOAD_RUNTIME[CAT.reloadAnims.byId('R8').index], low = new ReloadSample(), dark = new ReloadSample();
  animTestSample(cell, cell.partial, false, 0.40, low);
  animTestSample(cell, cell.empty, true, 0.40, dark);
  animTestSample(cell, cell.partial, false, 0.78, sample);
  check('R8 the glow parts dim to 20 % with the cell out (0 % after an empty magazine) and charge back up in RACK', Test.near(low.scalars[S_GLOW], 0.2, 1e-6) && dark.scalars[S_GLOW] === 0 && sample.scalars[S_GLOW] > 0.2 && sample.scalars[S_GLOW] < 1);
  const rows = ['R1', 'R3', 'R9'].map((id) => CAT.reloadAnims.byId(id)), racks = rows.map((row, index) => (RELOAD_RUNTIME[row.index].partial.rackIndex < 0 && RELOAD_RUNTIME[row.index].empty.rackIndex >= 0));
  check('R1, R3 and R9 chamber a round only after an empty magazine (the extra RACK phase fits in the same total time)', racks.every(Boolean));
});

// ---- Shell by shell (W19) ----
Test.add('anims', (check) => {
  const cases = [[0, ['emptyFirst', 'middle', 'middle', 'middle', 'middle', 'last']], [5, ['only']], [4, ['first', 'last']], [2, ['first', 'middle', 'middle', 'last']]];
  const results = [];
  cases.forEach(([loaded, expected]) => {
    const id = animTestStart(['scattergun']), weapon = CAT.weapons.byId('scattergun'), slot = Weapons.slotIndex(id, weapon.index), played = [];
    Weapons.magazine[slot] = loaded;
    animTestStep(id, BTN.RELOAD);
    let previous = 2;
    for (let step = 0; step < 6 * 0.5 * TICK_RATE + 60 && Weapons.magazine[slot] < 6; step++) {
      const view = animTestView();
      if (view.reloadSet >= 0) {
        if (view.reload < previous) played.push(SHELL_NAMES[shellVariant(view.reloadFirst === 1, view.reloadLast === 1, view.reloadEmpty === 1)]);   // a new shell cycle starts when the fraction wraps
        previous = view.reload;
      }
      animTestStep(id, 0);
    }
    results.push([loaded, played.join(), expected.join(), Weapons.magazine[slot]]);
    animTestFinish();
  });
  check('W19 plays the right cycle for each shell: first, middle, last, only, and the empty first shell through the port', results.every((row) => row[1] === row[2] && row[3] === 6), JSON.stringify(results));
  const runtime = RELOAD_RUNTIME[CAT.reloadAnims.byId('R5').index], from = new ReloadSample(), to = new ReloadSample();
  animTestShell(runtime, 0.9999, true, false, false, from);
  animTestShell(runtime, 0, false, false, false, to);
  const gap = Array.from(from.key).reduce((worst, value, index) => Math.max(worst, Math.abs(value - to.key[index])), 0);
  animTestShell(runtime, 0.9999, false, false, false, from);
  const gapMiddle = Array.from(from.key).reduce((worst, value, index) => Math.max(worst, Math.abs(value - to.key[index])), 0);
  check('the pose at the end of one shell is the pose at the start of the next (no pop in a chain)', gap < 1e-3 && gapMiddle < 1e-3, [gap, gapMiddle]);
  const click = runtime.row.shell.click, late = Object.keys(click).filter((name) => !(click[name] > 0 && click[name] < 1));
  check('every shell cycle has a click inside it', late.length === 0 && Object.keys(click).length === 6 && runtime.clicks.length === 6);
  // FIRE interrupts a shell reload with a round loaded: the sim returns to IDLE, the pose blends out in 0.06 s of render time.
  const id = animTestStart(['scattergun']), weapon = CAT.weapons.byId('scattergun'), slot = Weapons.slotIndex(id, weapon.index);
  Weapons.magazine[slot] = 3;
  animTestStep(id, BTN.RELOAD);
  animTestRun(id, 12, 0);
  const reloading = viewModelState.reloadSet >= 0 && ViewLayers.weight[LAYER.RELOAD] === 1;
  animTestStep(id, BTN.FIRE);
  const weights = [];
  animTestRun(id, 6, 0, () => weights.push(ViewLayers.weight[LAYER.RELOAD]));
  check('a FIRE press ends the shell reload and the pose blends out in 0.06 s (the shot is the sim\'s next step)', reloading && Weapons.state[id] === WEAPON_STATE.IDLE && weights[0] > 0 && weights[0] < 1
    && weights[3] === 0 && Test.near(weights[0], 1 - 1 / 60 / RELOAD_FADE_FIRE, 0.1), weights.join());
  animTestFinish();
});

// ---- Cancel ----
Test.add('anims', (check) => {
  const id = animTestStart(['warden', 'vanguard']), weapon = CAT.weapons.byId('vanguard'), slot = Weapons.slotIndex(id, weapon.index);
  Weapons.magazine[slot] = 4;
  animTestStep(id, BTN.RELOAD);
  animTestRun(id, 70, 0);
  const mid = viewModelState.reload > 0.3 && viewModelState.reloadSet >= 0;
  animTestStep(id, BTN.FIRE);
  check('FIRE does not cancel a magazine reload (the press is ignored)', mid && Weapons.state[id] === WEAPON_STATE.RELOAD);
  animTestSprint.on = true;
  animTestRun(id, 6, 0);
  check('sprint does not cancel a reload and its pose waits for the reload end', Weapons.state[id] === WEAPON_STATE.RELOAD && ViewLayers.weight[LAYER.SPRINT] === 0);
  const before = Weapons.magazine[slot];
  animTestStep(id, BTN.PREV_WEAPON);
  const cancelled = Weapons.state[id] === WEAPON_STATE.SWAP && Weapons.magazine[slot] === before;
  const weights = [];
  animTestRun(id, 8, 0, () => weights.push(ViewLayers.weight[LAYER.RELOAD]));
  check('a swap cancels the reload in the sim (the magazine gets nothing) and the reload pose blends out in 0.1 s under the lowering', cancelled && weights[0] < 1 && weights[0] > 0.5 && weights[6] === 0 && Weapons.magazine[slot] === before, weights.join());
  const hidden = Array.from({ length: MODEL_ROLES.length }, (unused, role) => ViewAction.main[role * MODEL_ROLE_MOVE_FLOATS + 5]).some((flag) => flag !== 0);
  check('the moving part is back in its seat (not hidden) and the spare is gone once the reload is cancelled', !hidden && ViewAction.spareOn === 0);
  animTestFinish();
  const second = animTestStart(['warden', 'vanguard']), slot2 = Weapons.slotIndex(second, weapon.index);
  Weapons.magazine[slot2] = 4;
  animTestStep(second, BTN.RELOAD);
  animTestRun(second, 40, 0);
  animTestStep(second, BTN.MELEE);
  const melee = Weapons.state[second] === WEAPON_STATE.IDLE && Weapons.magazine[slot2] === 4 && Weapons.nextShot[second] > 0;
  const fades = [];
  animTestRun(second, 5, 0, () => fades.push(ViewLayers.weight[LAYER.RELOAD]));
  check('a quick melee ends the reload (the sim) and the reload pose blends out in 0.05 s under the strike', melee && fades[0] > 0 && fades[0] < 1 && fades[3] === 0, fades.join());
  animTestFinish();
});

// ---- Melee: the contact pose and the end ----
// Steps once with the button down (the strike is decided in that step), returns what the view sees on the first frame afterwards.
function animTestStrike(id, buttons, target) {
  let damageTime = -1;
  const handler = Bus.on('damage', (event) => { if (event.source === id) damageTime = Sim.time; });
  animTestStep(id, buttons);
  const hitTime = Sim.time - TICK_SECONDS;
  Bus.off('damage', handler);
  const state = animTestFrame();
  return { hitTime, damageTime, state, anim: state.meleeAnim, contact: meleeSample.values[M_CONTACT], fraction: meleeSample.values[M_FRACTION], weight: ViewLayers.weight[LAYER.MELEE], cycle: Weapons.meleeCycle[id], kind: Weapons.meleeKind[id], interval: Weapons.nextShot[id], target };
}
// Frames (one sim step each) from the strike until the animation is over and until the weapon may act again: they must be the same step.
function animTestEnd(id) {
  let ended = -1, ready = -1;
  for (let step = 1; step < 400 && (ended < 0 || ready < 0); step++) {
    animTestStep(id, 0);
    if (ended < 0 && !Weapons.meleeActive(id)) ended = step;
    if (ready < 0 && Weapons.nextShot[id] <= 1e-6) ready = step;
  }
  return { ended, ready };
}
Test.add('anims', (check) => {
  const rows = [];
  const cases = [['maul', BTN.FIRE, 'maulPrimary', 'maul'], ['tanto', BTN.FIRE, 'tantoPrimary', 'tanto'], ['bulwark', BTN.FIRE, 'bulwarkBash', 'bulwark'], ['warden', BTN.MELEE, 'quick', 'bashSidearm'],
    ['vanguard', BTN.MELEE, 'quick', 'bashLong'], ['hailstorm', BTN.MELEE, 'quick', 'bashHeavy']];
  cases.forEach(([key, button, name, anim]) => {
    [true, false].forEach((withTarget) => {
      const id = animTestStart([key]);
      const victim = withTarget ? TestArena.actor(2, 0, 1.0, Math.PI) : -1;
      Actors.health[victim] = victim >= 0 ? 100000 : 0;
      if (victim >= 0) Actors.maxHealth[victim] = 100000;
      const strike = animTestStrike(id, button, victim);
      const end = animTestEnd(id);
      rows.push({ key, name, withTarget, strike, end, anim, expected: ANIM_TEST_MELEE_CYCLES[name], hit: Weapons.meleeHit[id] });
      animTestFinish();
    });
  });
  const wrongTime = rows.filter((row) => Math.abs(row.strike.cycle - row.expected) > 1e-6 || Math.abs(row.strike.interval - row.expected) > 2 * TICK_SECONDS);
  check('the cycle T of every strike is the cooldown the sim adds (maul 0.4, maul alt 0.667, tanto 0.4 / 1.0, bash 0.667, quick melee 0.833)', wrongTime.length === 0, wrongTime.map((row) => row.key + ' ' + row.strike.cycle).join());
  const wrongHit = rows.filter((row) => row.withTarget && row.strike.damageTime !== row.strike.hitTime);
  check('the strike\'s hit tick (Weapons.meleeAt) is the step the damage happens: there is no wind-up before damage', wrongHit.length === 0 && rows.filter((row) => row.withTarget).every((row) => row.hit === 1), wrongHit.map((row) => row.key).join());
  const notContact = rows.filter((row) => !(row.strike.contact > 0.95 && row.strike.weight === 1 && CAT.meleeAnims[row.strike.anim].id === row.anim));
  check('the contact pose is drawn on the first frame after the hit tick, at full weight, from the strike row of the weapon or class', notContact.length === 0, notContact.map((row) => row.key + ' ' + row.strike.contact).join());
  const wrongEnd = rows.filter((row) => row.end.ended < 0 || Math.abs(row.end.ended - row.end.ready) > 1);
  check('follow-through and recovery end exactly when the weapon can act again (the same step, every strike)', wrongEnd.length === 0, wrongEnd.map((row) => row.key + ' ' + row.end.ended + '/' + row.end.ready).join());
  const stopped = rows.filter((row) => row.withTarget && row.strike.fraction !== 0);
  check('a melee hit holds the contact pose for the 0.03 s hit-stop (a miss does not)', stopped.length === 0 && rows.filter((row) => !row.withTarget).every((row) => row.strike.fraction > 0));
});

// The alt strikes: W01's charged slam and W02's thrust, and a quick melee by another owned melee weapon.
Test.add('anims', (check) => {
  let id = animTestStart(['maul']);
  animTestRun(id, 48, BTN.ALT);   // 0.8 s of the 1.2 s charge
  const charged = viewModelState.chargeFraction, raised = ViewLayers.weight[LAYER.CHARGE] === 1 && ViewAction.pose[1] > 0.05;
  animTestStep(id, 0);
  const strike = animTestFrame();
  check('W01 alt: the hold raises the maul by the charge fraction (0.8 s of 1.2 s = 0.667); on release the slam starts at once (T 0.667 s)', Test.near(charged, 0.8 / 1.2, 0.03) && raised
    && strike.meleeKind === MELEE_KIND.ALT && Test.near(Weapons.meleeCycle[id], 1 / 1.5, 1e-6) && ViewLayers.weight[LAYER.CHARGE] === 0 && ViewLayers.weight[LAYER.MELEE] === 1, [charged, Weapons.meleeCycle[id]]);
  const end = animTestEnd(id);
  check('W01 alt: the slam ends the step the maul may act again', end.ended > 0 && Math.abs(end.ended - end.ready) <= 1, end.ended + '/' + end.ready);
  animTestFinish();
  id = animTestStart(['tanto']);
  animTestStep(id, BTN.ALT);
  const thrust = animTestFrame();
  const thrustEnd = animTestEnd(id);
  check('W02 alt: a thrust (the tanto alt row) with a cycle of 1.0 s that ends when the blade may act again', CAT.meleeAnims[thrust.meleeAnim].id === 'tantoAlt' && Test.near(Weapons.meleeCycle[id], 1, 1e-6) && Math.abs(thrustEnd.ended - thrustEnd.ready) <= 1);
  animTestFinish();
  // Quick melee with another owned melee weapon: that weapon strikes from the off-hand, the gun in hand dips out of the way.
  id = animTestStart(['maul', 'vanguard']);
  animTestStep(id, BTN.MELEE);
  const off = animTestFrame();
  check('a quick melee by an owned melee weapon draws it in the off-hand (its primary strike) and dips the gun in hand', off.meleeKind === MELEE_KIND.QUICK && ViewAction.strikerWeapon === CAT.weapons.byId('maul').index
    && ViewAction.values[VA.STRIKER] === 1 && Math.abs(ViewAction.pose[1]) > 0 && CAT.meleeAnims[off.meleeAnim].id === 'maul');
  animTestRun(id, 70, 0);
  check('...and the striker is gone and the gun is back at the hold pose when the cycle ends', ViewAction.strikerWeapon === -1 && animTestIsZero(ViewAction.pose));
  animTestFinish();
  id = animTestStart(['vanguard', 'maul']);
  animTestStep(id, BTN.MELEE);
  const held = animTestFrame();
  check('a quick melee with the striker in hand plays its own primary strike (no second model)', held.meleeKind === MELEE_KIND.QUICK && held.meleeStriker === held.weaponIndex && ViewAction.strikerWeapon === -1);
  animTestFinish();
  id = animTestStart(['maul']);
  animTestStep(id, BTN.FIRE);
  const firstCount = animTestFrame().meleeCount, firstSign = ViewAction.pose[4];
  animTestEnd(id);
  animTestStep(id, BTN.FIRE);
  const secondCount = animTestFrame().meleeCount;
  check('repeated chops of the maul alternate forehand and backhand (yaw and roll mirror, from the same place on the screen)', secondCount === firstCount + 1 && Math.sign(firstSign) === -Math.sign(ViewAction.pose[4]) && firstSign !== 0, [firstSign, ViewAction.pose[4]]);
  animTestFinish();
});

// Block and parry (W03), the wind-up of a held trigger.
Test.add('anims', (check) => {
  const id = animTestStart(['bulwark']);
  animTestRun(id, 3, BTN.ALT);
  const rising = ViewLayers.weight[LAYER.BLOCK] > 0 && ViewLayers.weight[LAYER.BLOCK] < 1;
  animTestRun(id, 10, BTN.ALT);
  const up = ViewLayers.weight[LAYER.BLOCK] === 1 && viewModelState.blocking === 1 && ViewAction.pose[0] < -0.1;
  check('W03 block: the shield comes to the middle over 0.1 s while blocking and the off-hand is not drawn', rising && up);
  animTestRun(id, 4, 0);
  animTestStep(id, BTN.ALT);   // a fresh press opens the parry window
  const parry = animTestFrame();
  check('the rim glows during the parry window and flashes on a reflect', parry.parry === 1 && Test.near(ViewAction.values[VA.EMISSIVE], BLOCK_PARRY_GLOW, 1e-6));
  WeaponSpecialState.reflectAt[id] = Sim.time;
  animTestFrame();
  check('a reflect flashes the rim for 0.15 s', Test.near(ViewAction.values[VA.EMISSIVE], BLOCK_REFLECT_GLOW, 1e-6));
  animTestRun(id, 12, 0);
  check('the shield lowers over 0.15 s when the block ends', ViewLayers.weight[LAYER.BLOCK] === 0);
  animTestFinish();
  const hold = animTestStart(['tanto']);
  const winds = [];
  animTestStep(hold, BTN.FIRE);
  animTestRun(hold, animTestSeconds(0.39), BTN.FIRE, () => winds.push(ViewLayers.scalars[L_WIND]));
  check('a held trigger winds the tanto up to the cocked pose over the last 0.8-1.0 of the cycle, never before', winds[2] === 0 && Math.max(...winds) > 0.5 && winds.every((wind) => wind >= 0 && wind <= 1), winds.slice(-4).join());
  animTestFinish();
});

// ---- Normalized charge ----
Test.add('anims', (check) => {
  const id = animTestStart(['talonbow']);
  animTestRun(id, 21, BTN.FIRE);
  const view = animTestView();
  check('Render.viewModel charge is in seconds and chargeFraction is it over the mode\'s charge time (W27 0.55 s)', Test.near(view.charge, 0.35, 0.03) && Test.near(view.chargeFraction, view.charge / 0.55, 1e-6) && view.chargeFraction > 0.5 && view.chargeFraction < 0.75, [view.charge, view.chargeFraction]);
  animTestFinish();
});

// ---- Charges and the detonate jolt ----
Test.add('anims', (check) => {
  const string = MODEL_ROLES.indexOf('string') * MODEL_ROLE_MOVE_FLOATS;
  let id = animTestStart(['talonbow']);
  animTestRun(id, 21, BTN.FIRE);
  const drawn = ViewAction.main[string + 2], cant = ViewAction.pose[5];
  animTestRun(id, 3, 0);
  const released = ViewAction.main[string + 2];
  animTestRun(id, 8, 0);
  check('W27: the string is drawn back by the charge fraction while the bow cants 5 degrees, and the release lets it go within 0.1 s', drawn < -0.03 && cant > 0.02 && Math.abs(released) < Math.abs(drawn) && ViewAction.main[string + 2] === 0 && ViewAction.pose[5] === 0, [drawn, cant, released]);
  animTestFinish();
  id = animTestStart(['accelerator']);
  animTestRun(id, 30, BTN.FIRE);
  const glow = ViewAction.values[VA.GLOW];
  animTestRun(id, 10, 0);
  check('W39: the glow parts swell from 30 % with the charge and are back to full after the shot', glow > CHARGE_GLOW_FLOOR && glow < 1 && ViewAction.values[VA.GLOW] === 1, [glow, ViewAction.values[VA.GLOW]]);
  animTestFinish();
  id = animTestStart(['fusionmortar']);
  Weapons.magazine[Weapons.slotIndex(id, CAT.weapons.byId('fusionmortar').index)] = 0;
  animTestStep(id, BTN.RELOAD);
  animTestRun(id, 30, 0);
  const before = ViewAction.pose[2];
  animTestStep(id, BTN.ALT);
  animTestRun(id, 3, BTN.ALT);
  const state = viewModelState, jolt = ViewAction.pose[2] - before;
  check('W40: a detonate press during the reload adds a 1 cm jolt and the reload motion goes on', state.reloadSet >= 0 && state.joltAge < 0.1 && jolt < -0.002 && jolt > -0.03, [state.reloadSet, state.joltAge, jolt]);
  animTestFinish();
});

// ---- The view model never swallows the screen or comes to the eye ----
Test.add('anims', (check) => {
  const worst = { share: 0, nearest: Infinity, shareAt: '', nearAt: '' }, bad = [];
  const at = (weapon, what, fraction, settings) => {
    const cover = animTestCoverAt(weapon, what, fraction, settings), label = weapon.id + ' ' + what + ' ' + fraction.toFixed(1) + ' ' + JSON.stringify(settings);
    if (cover.share > worst.share) { worst.share = cover.share; worst.shareAt = label; }
    if (cover.nearest < worst.nearest) { worst.nearest = cover.nearest; worst.nearAt = label; }
    if (cover.share > ANIM_COVER_MAX_SHARE || cover.nearest < ANIM_COVER_MIN_DISTANCE) bad.push(label);
  };
  let frames = 0;
  CAT.weapons.forEach((weapon) => {
    at(weapon, 'idle', 0, {});
    for (let step = 0; step <= 10; step++) {
      const fraction = step / 10;
      if (weapon.reloadAnimIndex >= 0) {
        at(weapon, 'reload', fraction, {}); at(weapon, 'reload', fraction, { empty: true }); frames += 2;
        if (CAT.reloadAnims[weapon.reloadAnimIndex].shell) { at(weapon, 'reload', fraction, { first: false, last: false }); at(weapon, 'reload', fraction, { first: false, last: true }); at(weapon, 'reload', fraction, { empty: true, last: true }); frames += 3; }
      }
      for (const anim of new Set([weapon.meleeAnimIndex, weapon.meleeAltIndex])) {
        if (anim < 0) continue;
        at(weapon, 'melee', fraction, { anim }); at(weapon, 'melee', fraction, { anim, hit: true, count: 1 }); at(weapon, 'melee', fraction, { anim, count: 2 }); frames += 3;
      }
    }
  });
  check('every frame of every reload (partial, empty, shell cycles) and every strike (primary, alt, quick, backhand) of all 38 weapons keeps the view model under ' + Math.round(ANIM_COVER_MAX_SHARE * 100) + ' % of a 16:9 screen and its nearest corner at least ' + ANIM_COVER_MIN_DISTANCE + ' m from the eye (' + frames + ' frames)',
    bad.length === 0 && frames > 1000, 'worst share ' + worst.share.toFixed(3) + ' ' + worst.shareAt + '; nearest ' + worst.nearest.toFixed(3) + ' ' + worst.nearAt + (bad.length ? '; over: ' + bad.slice(0, 4).join(' | ') : ''));
  const idle = CAT.weapons.every((weapon) => animTestCoverAt(weapon, 'idle', 0, {}).nearest >= ANIM_COVER_MIN_DISTANCE);
  check('the limits hold for the idle hold pose too (the measure sees the weapons: the largest idle share is more than 10 %)', idle && CAT.weapons.some((weapon) => animTestCoverAt(weapon, 'idle', 0, {}).share > 0.1));
});

// ---- P6-04: swap split, priority, ADS weighting, idle zero ----
Test.add('anims', (check) => {
  const id = animTestStart(['warden', 'vanguard']), vanguard = CAT.weapons.byId('vanguard'), warden = CAT.weapons.byId('warden');
  animTestStep(id, BTN.PREV_WEAPON);
  const duration = Weapons.stateDuration[id], levels = [], shown = [];
  for (let step = 0; step < duration * TICK_RATE; step++) {
    const look = Weapons.swapLook(id);
    levels.push(look.level); shown.push(look.shown);
    animTestStep(id, 0);
    if (Weapons.state[id] !== WEAPON_STATE.SWAP) break;
  }
  const peak = levels.indexOf(Math.max(...levels)) / TICK_RATE / duration;
  check('the swap lowers the weapon in hand for 35 % of the swap time and raises the pending one for 65 % (equip time unchanged)', Test.near(peak, SWAP_LOWER_SHARE, 0.04) && Math.max(...levels) > 0.9
    && levels[0] < 0.1 && levels[levels.length - 1] < 0.05 && Test.near(duration, warden.equipTime, 1e-6), [peak, duration]);
  const oldSteps = shown.filter((index) => index === vanguard.index).length;
  check('the old weapon is drawn while it lowers and the new one after (Render.heldWeapon, the same split in third person)', shown[0] === vanguard.index && shown[shown.length - 1] === warden.index
    && Math.abs(oldSteps - duration * TICK_RATE * SWAP_LOWER_SHARE) <= 2, [oldSteps, shown.length]);
  check('the sim switch is at the end of the equip time as before (current becomes pending)', Weapons.current[id] === warden.index && Weapons.state[id] === WEAPON_STATE.IDLE);
  // A swap changed mid-way carries on from the weapon and level drawn: no second lowering, no jump.
  animTestStep(id, BTN.NEXT_WEAPON);
  Sim.run(Math.round(duration * TICK_RATE * 0.2));
  const before = Weapons.swapLook(id), level = before.level, wasShown = before.shown;
  animTestStep(id, BTN.PREV_WEAPON);
  const after = Weapons.swapLook(id);
  check('a swap changed during the lowering keeps the weapon and the lowered level it was at', after.shown === wasShown && Math.abs(after.level - level) < 0.1, [level, after.level]);
  Sim.run(Math.round(Weapons.stateDuration[id] * TICK_RATE * 0.8));
  const raising = Weapons.swapLook(id), raisedLevel = raising.level, raisedShown = raising.shown;
  animTestStep(id, BTN.NEXT_WEAPON);
  const retarget = Weapons.swapLook(id);
  check('a swap changed during the raise starts from the weapon and level drawn then (it lowers from there)', retarget.shown === raisedShown && Math.abs(retarget.level - raisedLevel) < 0.1, [raisedLevel, retarget.level]);
  animTestFinish();
});

Test.add('anims', (check) => {
  const problems = [];
  CAT.weapons.forEach((weapon) => {
    const id = animTestStart([weapon.id]);
    const state = animTestFrame();
    const body = TestArena.actor(2, 3, 3);
    Weapons.setLoadout(body, [weapon.id]);
    const pose = readActorPosition(body, 1);
    animateActor(body, pose, ANIM_FRAME, LOD.near);
    const idle = state.visible && animTestIsZero(ViewAction.pose) && animTestIsZero(ViewAction.main) && animTestIsZero(ActorAction.pitch) && animTestIsZero(ActorAction.y) && animTestIsZero(ActorAction.z)
      && ViewAction.values[VA.GLOW] === 1 && ViewAction.values[VA.EMISSIVE] === 0 && ViewAction.strikerWeapon === -1 && !ViewAction.spareOn;
    if (!idle) problems.push(weapon.id);
    animTestFinish();
  });
  check('every offset of every layer is zero in the idle hold pose of all 38 weapons, first and third person (the muzzle maths and the 2 mm probe stay valid)', problems.length === 0, problems.join());
  const id = animTestStart(['vanguard']), state = viewModelState;
  Weapons.magazine[Weapons.slotIndex(id, CAT.weapons.byId('vanguard').index)] = 3;
  animTestStep(id, BTN.RELOAD);
  animTestRun(id, 40, 0);
  const lowered = Math.abs(ViewAction.pose[1]) + Math.abs(ViewAction.pose[3]);
  state.ads = 1;
  ViewAction.update(state, viewWeaponModel(state), 0);
  const aimed = Math.abs(ViewAction.pose[1]) + Math.abs(ViewAction.pose[3]);
  check('the reload runs at the hip: its offsets are weighted by 1 - ads, so the ADS fall never shows a reload through the sights', lowered > 0.05 && aimed < 1e-9, [lowered, aimed]);
  animTestFinish();
  const sprinter = animTestStart(['vanguard']);
  animTestSprint.on = true;
  animTestRun(sprinter, 4, 0);
  const rising = ViewLayers.weight[LAYER.SPRINT];
  animTestRun(sprinter, 10, 0);
  const full = ViewLayers.weight[LAYER.SPRINT], lowerBy = ViewAction.pose[1];
  animTestSprint.on = false;
  animTestRun(sprinter, 2, 0);
  const falling = ViewLayers.weight[LAYER.SPRINT];
  animTestRun(sprinter, 8, 0);
  check('the sprint pose (4 cm lower, canted, pitched down) comes in over 0.15 s and goes out over 0.12 s', rising > 0 && rising < 1 && full === 1 && Test.near(lowerBy, -0.04, 1e-6) && falling > 0 && falling < 1 && ViewLayers.weight[LAYER.SPRINT] === 0, [rising, full, falling]);
  animTestFinish();
  const strikeWhileSprinting = animTestStart(['warden']);
  animTestSprint.on = true;
  animTestRun(strikeWhileSprinting, 14, 0);
  animTestStep(strikeWhileSprinting, BTN.MELEE);
  animTestFrame();
  check('a quick melee while sprinting is allowed and the strike overrides the sprint pose (the sprint returns after it)', ViewLayers.weight[LAYER.MELEE] === 1 && ViewLayers.weight[LAYER.SPRINT] < 1);
  animTestFinish();
});

// ---- P6-04: no pop across swap, reload, melee, ADS and sprint for every weapon ----
Test.add('anims', (check) => {
  const worst = { position: 0, angle: 0, part: 0, partAngle: 0, where: '' }, nonFinite = [];
  CAT.weapons.forEach((weapon) => {
    const other = weapon.id === 'warden' ? 'vanguard' : 'warden';
    const id = animTestStart([other, weapon.id]);
    const slot = Weapons.slotIndex(id, weapon.index), size = Weapons.magSize(id, weapon), previous = new Float64Array(POSE_FLOATS + 3);
    let have = false, label = 'start', lastMelee = -1, frames = 0;
    const watch = (state) => {
      const pose = animTestSnapshot(state);
      frames++;
      if (!Array.from(pose).every(Number.isFinite)) nonFinite.push(weapon.id + ' ' + label);
      const smear = state.meleeAt !== lastMelee && state.meleeAge >= 0;   // the contact frame of a strike is a smear by design
      lastMelee = state.meleeAt;
      if (have && !smear) {
        const position = Math.max(Math.abs(pose[0] - previous[0]), Math.abs(pose[1] - previous[1]), Math.abs(pose[2] - previous[2]));
        const angle = Math.max(Math.abs(pose[3] - previous[3]), Math.abs(pose[4] - previous[4]), Math.abs(pose[5] - previous[5]));
        const part = pose[POSE_FLOATS + 1] === previous[POSE_FLOATS + 1] ? Math.abs(pose[POSE_FLOATS] - previous[POSE_FLOATS]) : 0;   // a part dropping out of the weapon or back into it changes what is drawn: that is the phase, not a pop
        if (position > worst.position) { worst.position = position; worst.where = weapon.id + ' ' + label + ' position'; }
        if (angle > worst.angle) { worst.angle = angle; worst.where = weapon.id + ' ' + label + ' angle'; }
        const partAngle = pose[POSE_FLOATS + 1] === previous[POSE_FLOATS + 1] ? Math.abs(pose[POSE_FLOATS + 2] - previous[POSE_FLOATS + 2]) : 0;
        if (part > worst.part) { worst.part = part; worst.where = weapon.id + ' ' + label + ' part'; }
        if (partAngle > worst.partAngle) { worst.partAngle = partAngle; worst.where = weapon.id + ' ' + label + ' part angle'; }
      }
      previous.set(pose); have = true;
    };
    const run = (name, frames, buttons) => { label = name; animTestRun(id, frames, buttons, watch); };
    run('settle', 4, 0);
    animTestStep(id, BTN.NEXT_WEAPON); run('swap out', animTestSeconds(0.8), 0);
    animTestStep(id, BTN.PREV_WEAPON); run('swap in', animTestSeconds(0.9), 0);
    if (weapon.reloadAnimIndex >= 0) {
      Weapons.magazine[slot] = Math.max(0, size - 3); animTestStep(id, BTN.RELOAD); run('partial reload', animTestSeconds(weapon.reload * 1.2 + 0.3), 0);
      Weapons.magazine[slot] = 0; animTestStep(id, BTN.RELOAD); run('empty reload', animTestSeconds(weapon.reload * 1.2 + 0.3), 0);
      Weapons.magazine[slot] = 0; animTestStep(id, BTN.RELOAD); run('reload before swap', animTestSeconds(weapon.reload * 0.4), 0);
      animTestStep(id, BTN.NEXT_WEAPON); run('reload cancelled by swap', animTestSeconds(0.9), 0);
      animTestStep(id, BTN.PREV_WEAPON); run('swap back', animTestSeconds(0.9), 0);
      Weapons.magazine[slot] = 0; animTestStep(id, BTN.RELOAD); run('reload before melee', animTestSeconds(weapon.reload * 0.5), 0);
      animTestStep(id, BTN.MELEE); run('reload cancelled by melee', animTestSeconds(1.3), 0);
      Weapons.magazine[slot] = 0; animTestStep(id, BTN.RELOAD); animTestSprint.on = true;
      run('sprint during reload', animTestSeconds(weapon.reload * 1.2 + 0.4), 0);
      animTestSprint.on = false; run('sprint over', animTestSeconds(0.4), 0);
    }
    animTestStep(id, BTN.MELEE); run('quick melee', animTestSeconds(1.3), 0);
    if (weapon.class === 'melee') {
      run('melee primary', animTestSeconds(1.5), BTN.FIRE);
      run('melee alt hold', animTestSeconds(0.9), BTN.ALT); run('melee alt end', animTestSeconds(1.5), 0);
    }
    if (weapon.alt.type === 'zoom' || weapon.alt.zoom > 1) { run('ads in', animTestSeconds(0.5), BTN.ALT); run('ads out', animTestSeconds(0.5), 0); }
    animTestSprint.on = true; run('sprint', animTestSeconds(0.6), 0);
    animTestSprint.on = false; run('sprint end', animTestSeconds(0.6), 0);
    if (weapon.mag > 0 && weapon.primary.type !== 'melee') { run('fire', animTestSeconds(0.5), BTN.FIRE); run('after fire', animTestSeconds(0.8), 0); }
    animTestFinish();
  });
  check('every pose number of every weapon in every transition is finite', nonFinite.length === 0, nonFinite.slice(0, 5).join());
  check('no pop in the weapon position across swap, reload, melee, ADS and sprint for all 38 weapons (per frame at 60 fps, the contact frame of a strike excepted)',
    worst.position <= ANIM_MAX_POSITION_JUMP, worst.position.toFixed(4) + ' ' + worst.where);
  check('no pop in the weapon angles (pitch, yaw, roll) across the same transitions', worst.angle <= ANIM_MAX_ANGLE_JUMP, worst.angle.toFixed(4) + ' ' + worst.where);
  check('no pop in the moving parts (magazine, slide, bolt, pump, lid...) across the same transitions', worst.part <= ANIM_MAX_PART_JUMP && worst.partAngle <= ANIM_MAX_PART_ANGLE_JUMP, worst.part.toFixed(4) + ' ' + worst.partAngle.toFixed(4) + ' ' + worst.where);
}, { slow: false });

// ---- Third person: the action layer ----
Test.add('anims', (check) => {
  const id = animTestStart(['warden']), body = TestArena.actor(2, 2, 2), weapon = CAT.weapons.byId('vanguard'), slot = Weapons.slotIndex(body, weapon.index);
  Weapons.setLoadout(body, ['vanguard']);
  Weapons.magazine[slot] = 3; Weapons.reserve[slot] = 100;
  Settings.set('video.quality', 'medium');
  Actors.buttons[body] = BTN.RELOAD; Sim.step(); Actors.buttons[body] = 0;
  Sim.run(Math.round(0.4 * 2.2 * TICK_RATE));
  const pose = readActorPosition(body, 1);
  animateActor(body, pose, ANIM_FRAME, LOD.near);
  const gun = ActorAction.pitch[3], arm = ActorAction.pitch[1], moved = ActorAction.moving, hold = Array.from(ActorAction.roleMove).some((value) => value !== 0);
  check('third person, reload: the gun pitches, the left arm goes to the belt and the model\'s magazine detaches (near bodies on presets with model detail)', gun < -0.1 && arm < -0.1 && moved && hold, [gun, arm, moved]);
  animateActor(body, pose, ANIM_FRAME, LOD.far);
  check('the far LOD keeps the arm and gun pitch but not the detached part', ActorAction.pitch[3] < -0.1 && !ActorAction.moving);
  animateActor(body, pose, ANIM_FRAME, LOD.distant);
  check('distant bodies get no action layer', animTestIsZero(ActorAction.pitch) && animTestIsZero(ActorAction.y));
  pose.recorded = true;
  animateActor(body, pose, ANIM_FRAME, LOD.near);
  check('killcam replay bodies (pose.recorded) get no action layer', animTestIsZero(ActorAction.pitch) && animTestIsZero(ActorAction.z));
  pose.recorded = false;
  Settings.set('video.quality', 'potato');
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near);
  check('Potato (no model detail) keeps the arm and gun pitch and never detaches a part', ActorAction.pitch[3] < -0.1 && !ActorAction.moving);
  Settings.set('video.quality', 'medium');
  Sim.run(TICK_RATE * 3);
  for (let i = 0; i < 12; i++) animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near);
  check('when the reload ends the body lets go within 0.1 s', animTestIsZero(ActorAction.pitch) && animTestIsZero(ActorAction.y));
  // Melee: the arm and torso swing from the hit tick to the end of the cycle.
  Weapons.setLoadout(body, ['maul']);
  Actors.buttons[body] = BTN.FIRE; Sim.step(); Actors.buttons[body] = 0;
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near);
  const swing = Math.abs(ActorAction.pitch[2]) + Math.abs(ActorAction.pitch[4]);
  Sim.run(Math.round(0.45 * TICK_RATE));
  for (let i = 0; i < 12; i++) animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near);
  check('third person, melee: the arms and torso swing at the hit tick and are back at the guard when the cycle ends', swing > 0.2 && animTestIsZero(ActorAction.pitch), swing);
  // Swap: the gun lowers and rises with the swap level.
  Weapons.setLoadout(body, ['warden', 'vanguard']);
  Weapons.requestSwitch(body, CAT.weapons.byId('warden').index);
  Sim.run(Math.round(Weapons.stateDuration[body] * SWAP_LOWER_SHARE * 0.85 * TICK_RATE));   // just before the lowering ends: the old weapon is still the one drawn
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near);
  check('third person, swap: the gun drops while the old weapon lowers', ActorAction.y[3] < -0.1 && Render.heldWeapon(body) === CAT.weapons.byId('vanguard').index, [ActorAction.y[3], Render.heldWeapon(body)]);
  animTestFinish();
});

Test.add('anims', (check) => {
  animTestStart(['warden']);
  const body = TestArena.actor(2, 2, 2);
  Actors.yaw[body] = 0;
  const flinch = (amount, kind, dz, weapon) => {
    ActorAction.flinchAge[body] = 99;
    Bus.emit('damage', { target: body, source: 0, amount, kind, weapon: weapon || 'warden', dx: 0, dy: 0, dz });
    const rising = [];
    for (let i = 0; i < 4; i++) { animateActor(body, readActorPosition(body, 1), 0.0125, LOD.near); rising.push(ActorAction.pitch[4]); }
    return Math.max(...rising.map(Math.abs)) * Math.sign(rising[rising.length - 1]);
  };
  const settle = () => { for (let i = 0; i < 40; i++) animateActor(body, readActorPosition(body, 1), 0.05, LOD.near); };
  const front = flinch(30, 'hit', -1);
  settle();
  const behind = flinch(30, 'hit', 1);
  settle();
  const melee = flinch(35, 'melee', -1, 'tanto');
  settle();
  const heavy = flinch(150, 'melee', -1, 'tanto');
  settle();
  const blast = flinch(60, 'splash', -1);
  settle();
  const bullet = flinch(100, 'hit', -1);
  settle();
  check('a hit body flinches: leaning back from a front hit and forward from behind', front > 0 && behind < 0, [front, behind]);
  check('the flinch sizes: melee 12 degrees, a backstab or charged maul 18, a bullet at most 6, a blast 10', Test.near(melee, 12 * DEG * 0.9, 0.04) && heavy > melee && Math.abs(bullet) <= 6 * DEG + 1e-6 && Test.near(Math.abs(blast), 10 * DEG * 0.9, 0.05), [melee, heavy, bullet, blast]);
  check('the flinch is over within 0.3 s (0.05 in, 0.25 out)', Math.abs(ActorAction.pitch[4]) < 1e-9);
  Actors.flags[body] |= ACTOR_FLAG.FROZEN;
  for (let i = 0; i < 10; i++) animateActor(body, readActorPosition(body, 1), 0.02, LOD.near);
  const staggered = ActorAction.pitch[1] < -0.4 && ActorAction.pitch[2] < -0.4 && ActorAction.pitch[3] < -0.3;
  Actors.flags[body] &= ~ACTOR_FLAG.FROZEN;
  for (let i = 0; i < 10; i++) animateActor(body, readActorPosition(body, 1), 0.02, LOD.near);
  check('a stunned body staggers (arms down 30 degrees, gun down 20) for as long as the flag lasts', staggered && ActorAction.pitch[1] === 0 && ActorAction.pitch[3] === 0);
  const player = Game.playerId;
  animTestFrame();
  ViewLayers.scalars[L_KNOCK_AGE] = 99;
  Bus.emit('damage', { target: player, source: body, amount: 50, kind: 'hit', weapon: 'warden', dx: 0, dy: 0, dz: 1 });
  ViewAction.update(viewModelState, viewWeaponModel(viewModelState), 0.05);
  check('the local player hit: the weapon is knocked 2 to 4 cm down and pitched down, 0.05 s in', Test.near(ViewAction.pose[1], -0.04, 1e-6) && Test.near(ViewAction.pose[3], -4 * DEG, 1e-6), Array.from(ViewAction.pose).join());
  for (let i = 0; i < 6; i++) ViewAction.update(viewModelState, viewWeaponModel(viewModelState), 0.05);
  check('...and it recovers within 0.2 s more', animTestIsZero(ViewAction.pose));
  animTestFinish();
});

// ---- The extras of the view model: spare magazine, off-hand, striker ----
Test.add('anims', (check) => {
  const id = animTestStart(['vanguard']);
  Weapons.magazine[Weapons.slotIndex(id, CAT.weapons.byId('vanguard').index)] = 4;
  const idleCount = (() => { animTestFrame(); return viewModelBatch.counts.reduce((a, b) => a + b, 0); })();
  animTestStep(id, BTN.RELOAD);
  let most = 0;
  animTestRun(id, animTestSeconds(2.2), 0, () => { most = Math.max(most, viewModelBatch.counts.reduce((a, b) => a + b, 0)); });
  check('a reload draws at most 3 more instances than the idle weapon (the spare magazine, the hand and the forearm)', most > idleCount && most <= idleCount + 3, [idleCount, most]);
  animTestFinish();
  const plain = animTestStart(['maul']);
  animTestStep(plain, BTN.FIRE);
  animTestFrame();
  const withHand = viewModelBatch.counts.reduce((a, b) => a + b, 0);
  animTestEnd(plain);
  animTestFrame();
  check('a two-handed melee draws the off-hand on the haft during the strike only', withHand === viewModelBatch.counts.reduce((a, b) => a + b, 0) + 1);
  animTestFinish();
  const dual = animTestStart(['warden']);
  Weapons.give(dual, 'warden', 0);
  const slot = Weapons.slotIndex(dual, CAT.weapons.byId('warden').index);
  Weapons.magazine[slot] = 2;
  animTestFrame();
  const pair = viewModelBatch.counts.reduce((a, b) => a + b, 0);
  animTestStep(dual, BTN.RELOAD);
  animTestRun(dual, 40, 0);
  const handless = viewModelState.dual && ViewAction.handKind === HAND_KIND.RELOAD;
  check('W04 pistols: both guns reload at once with a spare each and no off-hand (both hands are full)', viewModelState.dual && pair > 0 && handless && viewModelBatch.counts.reduce((a, b) => a + b, 0) <= pair * 2 + 2, [pair, handless]);
  animTestFinish();
});

// ---- weapon.fire carries the magazine share left after the shot ----
Test.add('anims', (check) => {
  let id = animTestStart(['warden']);
  const shares = [];
  const handler = Bus.on('weapon.fire', (event) => { shares.push(event.magShare); });
  animTestStep(id, BTN.FIRE);
  const size = Weapons.magSize(id, CAT.weapons.byId('warden'));
  animTestFinish();
  id = animTestStart(['maul']);
  animTestStep(id, BTN.FIRE);
  Bus.off('weapon.fire', handler);
  check('weapon.fire carries magShare: the share of the magazine left after the shot, -1 for a weapon without one', shares.length === 2 && Test.near(shares[0], (size - 1) / size, 1e-6) && shares[1] === -1, shares.join());
  animTestFinish();
});

// ---- Melee on a surface: the impact event, the dust, the floor slam shake ----
Test.add('anims', (check) => {
  const id = animTestStart(['maul']);
  const wall = { shape: 'box', min: [-5, 0, 1.2], max: [5, 5, 1.6] };
  World.load({ id: 'anim-test', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }, wall] });
  let impacts = 0, event = null;
  const handler = Bus.on('impact', (payload) => { impacts++; event = Object.assign({}, payload); });
  animTestStep(id, BTN.FIRE);
  Bus.off('impact', handler);
  check('a melee swing that meets a wall within reach emits an impact at the wall (the sound and the dust; nothing in the sim listens)', impacts === 1 && event.weapon === 'maul' && event.owner === id && event.nz < -0.5, JSON.stringify(event));
  const free = animTestStart(['maul']);
  World.load({ id: 'anim-test-open', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }] });
  impacts = 0;
  const again = Bus.on('impact', () => { impacts++; });
  animTestStep(free, BTN.FIRE);
  Bus.off('impact', again);
  check('a swing into open air emits no impact', impacts === 0 && free >= 0);
  animTestFinish();
  const slammer = animTestStart(['maul']);
  Actors.pitch[slammer] = Actors.aimPitch[slammer] = -70 * DEG;
  let floorHit = null;
  const slam = Bus.on('impact', (payload) => { floorHit = Object.assign({}, payload); });
  Game.playerId = -1;
  Actors.buttons[slammer] = BTN.ALT; Sim.run(Math.round(1.3 * TICK_RATE)); Actors.buttons[slammer] = 0; Sim.run(2);
  Bus.off('impact', slam);
  check('the charged maul slam on the floor emits an impact on the floor (ny up)', floorHit !== null && floorHit.weapon === 'maul' && floorHit.ny > 0.6 && Weapons.meleeKind[slammer] === MELEE_KIND.ALT, JSON.stringify(floorHit));
  Game.playerId = slammer;
  ViewFx.trauma = 0;
  Bus.emit('impact', floorHit);
  const slamTrauma = ViewFx.trauma;
  Weapons.meleeKind[slammer] = MELEE_KIND.PRIMARY; ViewFx.trauma = 0;
  Bus.emit('impact', floorHit);
  check('the camera takes 0.15 trauma from the slam of the player (not from a plain chop, not from a body)', Test.near(slamTrauma, VIEW_SLAM_TRAUMA, 1e-6) && ViewFx.trauma === 0, [slamTrauma, ViewFx.trauma]);
  animTestFinish();
});

// ---- PERF-006: the layers allocate nothing per frame ----
Test.add('anims', (check) => withRenderer(() => {
  if (!perfHeapCounterWorks()) { check.skip('animation allocation probes', 'no exact heap counter on this page'); return; }
  Game.headless = true;   // the match starts as in the weapons tests, then renders (as render-01 does)
  const id = animTestStart(['vanguard']), state = viewModelState, model = viewWeaponModel(state), weapon = CAT.weapons.byId('vanguard');
  Game.headless = false;
  state.weaponIndex = weapon.index;
  let tick = 0;
  const reload = () => {
    tick++;
    state.reloadSet = (tick >> 7) % CAT.reloadAnims.length; state.reload = (tick % 128) / 128; state.reloadEmpty = (tick >> 3) & 1; state.reloadFirst = (tick >> 2) & 1; state.reloadLast = (tick >> 1) & 1;
    ViewAction.update(state, model, ANIM_FRAME);
  };
  const reloadBytes = perfAllocatedBytes(reload);
  check('the first-person layers (ViewAction.update through every reload set) allocate nothing', reloadBytes < PERF_ALLOC_LIMIT_BYTES, Math.round(reloadBytes / 1024) + ' KB over ' + PERF_ALLOC_CALLS + ' frames');
  state.reloadSet = -1;
  const strike = () => {
    tick++;
    state.meleeAnim = tick % CAT.meleeAnims.length; state.meleeCycle = 0.4; state.meleeAge = (tick % 40) / 100; state.meleeAt = tick >> 6; state.meleeKind = 1 + (tick & 1); state.meleeStriker = weapon.index;
    state.weaponIndex = weapon.index; state.fireHeld = tick & 1; state.meleeHit = (tick >> 1) & 1; state.meleeCount = tick >> 5;
    ViewAction.update(state, model, ANIM_FRAME);
  };
  const strikeBytes = perfAllocatedBytes(strike);
  check('the melee, block, charge, cycle and sprint layers allocate nothing', strikeBytes < PERF_ALLOC_LIMIT_BYTES, Math.round(strikeBytes / 1024) + ' KB');
  animTestFinish();
}), { slow: false });

// A whole frame of the real hook in a reload (fresh state: the probes above write the view-model record by hand).
Test.add('anims', (check) => withRenderer(() => {
  if (!perfHeapCounterWorks()) { check.skip('animation allocation probes', 'no exact heap counter on this page'); return; }
  Game.headless = true;
  const id = animTestStart(['vanguard']), weapon = CAT.weapons.byId('vanguard');
  Game.headless = false;
  Weapons.magazine[Weapons.slotIndex(id, weapon.index)] = 1;
  animTestStep(id, BTN.RELOAD);
  Sim.run(75);
  animTestFrame();
  const frameBytes = perfAllocatedBytes(() => { animTestFrame(); });
  check('a whole frame of the view model (hook, layers, parts, spare, off-hand) allocates nothing', frameBytes < PERF_ALLOC_LIMIT_BYTES, Math.round(frameBytes / 1024) + ' KB');
  animTestFinish();
}), { slow: false });

Test.add('anims', (check) => withRenderer(() => {
  if (!perfHeapCounterWorks()) { check.skip('animation allocation probes', 'no exact heap counter on this page'); return; }
  const weapon = CAT.weapons.byId('vanguard');
  Game.headless = true;
  animTestStart(['vanguard']);
  const body = TestArena.actor(2, 2, 2);
  Weapons.setLoadout(body, ['vanguard']);
  Weapons.magazine[Weapons.slotIndex(body, weapon.index)] = 2;
  Game.headless = false;
  Actors.buttons[body] = BTN.RELOAD; Sim.step(); Actors.buttons[body] = 0; Sim.run(80);
  const bodyBytes = perfAllocatedBytes(() => { animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near); });
  check('the third-person action layer (reload, flinch, stagger) allocates nothing per body and frame', bodyBytes < PERF_ALLOC_LIMIT_BYTES, Math.round(bodyBytes / 1024) + ' KB');
  animTestFinish();
}), { slow: false });
