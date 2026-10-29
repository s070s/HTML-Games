// Self-tests for P2-03 (group 'muzzle'): every weapon model has a muzzle, the muzzle of the view model and of a held weapon match the
// drawn model, projectiles start there and fly to the point under the crosshair, tracers leave the barrel, a wall in front never lets
// a shot through.

DebugApi.muzzle = Muzzle;
DebugApi.weaponModels = WeaponModels;

const MUZZLE_TEST_TOLERANCE = 2e-3;
const MUZZLE_TEST_WALL = { shape: 'box', min: [-5, 0, 0.3], max: [5, 40, 0.5] };   // 0.3 m in front of the eye, closer than any muzzle
const MUZZLE_TEST_PROBE_PART = { offset: [0.03, 0.02, 0.4], size: [0.001, 0.001, 0.001], tint: 'dark' };

// A model of one tiny part at a known place: its muzzle is that place, and where it is drawn shows where the code puts the muzzle.
function muzzleTestProbeModel(pose) {
  return Models.compile([{ id: 'probe', parts: [MUZZLE_TEST_PROBE_PART] }], null, () => ({ color: -1, accent: '', glow: '', pose })).byId.probe;
}
// The weapon whose model a test swaps for the probe (restored by the caller).
function muzzleTestWeapon(id) { return CAT.weapons.byId(id); }
// Where the first instance of a batch sits (the probe's one part): the shape with a count, its x y z.
function muzzleTestFirstInstance(batch, out) {
  for (let shape = 0; shape < SHAPES.length; shape++) {
    if (!batch.counts[shape]) continue;
    const o = shape * batch.capacity * INSTANCE_FLOATS;
    return Vec.set(out, batch.data[o], batch.data[o + 1], batch.data[o + 2]);
  }
  return null;
}
function muzzleTestAim(id, yaw, pitch) {
  Actors.yaw[id] = Actors.prevYaw[id] = Actors.aimYaw[id] = yaw;
  Actors.pitch[id] = Actors.prevPitch[id] = Actors.aimPitch[id] = pitch;
}
function muzzleTestDirection(id) { return Vec.fromAngles(Vec.make(), Actors.yaw[id], Actors.pitch[id]); }
// The shooter's eye as a vector.
function muzzleTestEye(id) { return Vec.set(Vec.make(), Actors.x[id], Actors.eyeY(id), Actors.z[id]); }
function muzzleTestDistance(a, b) { return length3(a.x - b.x, a.y - b.y, a.z - b.z); }

Test.add('muzzle', (check) => {
  const problems = [];
  for (const weapon of CAT.weapons) {
    const model = WeaponModels.weapon[weapon.index], muzzle = model && model.muzzle;
    if (!muzzle || muzzle.length !== 3 || !muzzle.every(Number.isFinite)) { problems.push(weapon.id + ': no muzzle'); continue; }
    if (weapon.class === 'melee') continue;
    if (muzzle[2] < 0.15 || muzzle[2] > 0.7 || Math.abs(muzzle[0]) > 0.1 || Math.abs(muzzle[1]) > 0.15) problems.push(weapon.id + ': muzzle ' + Array.from(muzzle).join(','));
  }
  check('every weapon model has a muzzle in front of its grip (the 38 weapons, melee included)', CAT.weapons.length === 38 && problems.length === 0, problems.join('; '));
  const rifleMuzzle = WeaponModels.byId.vanguard.muzzle;
  check('the muzzle is the front end of the barrel (a rifle: its barrel part, centre 0.3 and 0.2 long, ends at 0.4)', rifleMuzzle[0] === 0 && Math.abs(rifleMuzzle[1] - 0.01) < 1e-6 && Math.abs(rifleMuzzle[2] - 0.4) < 1e-6, Array.from(rifleMuzzle).join());
  const own = Models.compile([{ id: 'own', parts: [MUZZLE_TEST_PROBE_PART], muzzle: [0.1, -0.05, 0.9] }], null).byId.own;
  check('a row\'s own muzzle wins over the measured one', own.muzzle[0] === Math.fround(0.1) && own.muzzle[1] === Math.fround(-0.05) && own.muzzle[2] === Math.fround(0.9));
  const twin = Models.compile([{ id: 'twin', parts: [{ offset: [0.03, 0.02, 0.3], size: [0.01, 0.01, 0.2], mirror: true }, { offset: [0, 0, 0], size: [0.1, 0.1, 0.2] }] }], null).byId.twin;
  check('twin barrels share one muzzle between them', Math.abs(twin.muzzle[0]) < 1e-6 && Math.abs(twin.muzzle[1] - 0.02) < 1e-6 && Math.abs(twin.muzzle[2] - 0.4) < 1e-6, Array.from(twin.muzzle).join());
});

// The first-person muzzle is where the view model draws the model's muzzle (hold pose, ADS pose and between).
Test.add('muzzle', (check) => {
  TestArena.start();
  const shooter = TestArena.actor(1, 0, 0), weapon = muzzleTestWeapon('vanguard'), saved = { model: WeaponModels.weapon[weapon.index], player: Game.playerId, camera: Object.assign({}, Render.camera), bob: Render.motion.bob, phase: ViewState.bobPhase, offset: Render.config.viewmodelOffset };
  const probe = muzzleTestProbeModel(CAT.viewModels.byId('rifle')), drawn = Vec.make();
  WeaponModels.weapon[weapon.index] = probe;
  Game.playerId = shooter;
  Render.motion.bob = 0; ViewState.bobPhase = 0; Render.config.viewmodelOffset = [0, 0, 0];
  const state = { ads: 0, kick: 0, reload: 0, swap: 0 };
  for (const [ads, yaw, pitch] of [[0, 0, 0], [1, 0.8, 0.3], [0.5, -2.2, -0.4]]) {
    muzzleTestAim(shooter, yaw, pitch);
    Weapons.ads[shooter] = state.ads = ads;
    Object.assign(Render.camera, { x: Actors.x[shooter], y: Actors.eyeY(shooter), z: Actors.z[shooter], yaw, pitch, roll: 0 });
    viewModelBatch.clear();
    addWeaponModel(probe, poseWeapon(probe.pose, state), HAND_RIGHT);
    Muzzle.locate(shooter, weapon);
    const found = muzzleTestFirstInstance(viewModelBatch, drawn);
    check('first person: the view model draws the muzzle where the code puts it (ads ' + ads + ', yaw ' + yaw + ', pitch ' + pitch + ')', found && muzzleTestDistance(drawn, Muzzle.point) < MUZZLE_TEST_TOLERANCE, found && JSON.stringify(drawn) + ' vs ' + JSON.stringify(Muzzle.point));
  }
  muzzleTestAim(shooter, 0, 0);
  Weapons.ads[shooter] = 0;
  Muzzle.locate(shooter, weapon);
  const hold = probe.pose.hold, hip = muzzleTestEye(shooter);
  check('first person at the hip: right of the centre, below the eye, ahead of it', Muzzle.point.x < hip.x && Muzzle.point.y < hip.y && Muzzle.point.z > hip.z + 0.4 && Test.near(hip.x - Muzzle.point.x, hold[0] + 0.03 * VIEWMODEL_SCALE, MUZZLE_TEST_TOLERANCE));
  Weapons.ads[shooter] = 1;
  Muzzle.locate(shooter, weapon);
  check('first person aiming down the sights: the muzzle is on the centre line', Math.abs(hip.x - Muzzle.point.x - 0.03 * VIEWMODEL_SCALE) < MUZZLE_TEST_TOLERANCE && Muzzle.point.y < hip.y);
  Weapons.ads[shooter] = 0;
  WeaponModels.weapon[weapon.index] = saved.model;
  Game.playerId = saved.player;
  Object.assign(Render.camera, saved.camera);
  Render.motion.bob = saved.bob; ViewState.bobPhase = saved.phase; Render.config.viewmodelOffset = saved.offset;
  TestArena.finish();
});

// The muzzle of a weapon an actor holds is where the body draws the model's muzzle (aim, crouch).
Test.add('muzzle', (check) => {
  TestArena.start();
  const shooter = TestArena.actor(1, 3, -2), weapon = muzzleTestWeapon('vanguard'), saved = WeaponModels.weapon[weapon.index];
  const probe = muzzleTestProbeModel(CAT.viewModels.byId('rifle')), drawn = Vec.make();
  WeaponModels.weapon[weapon.index] = probe;
  for (const [yaw, pitch, height] of [[0, 0, STAND_HEIGHT], [1.1, 0.5, STAND_HEIGHT], [-2.5, -0.6, CROUCH_HEIGHT], [0.4, 0, PRONE_HEIGHT]]) {
    muzzleTestAim(shooter, yaw, pitch);
    Actors.height[shooter] = height;
    const pose = readActorPosition(shooter, 1), style = readActorStyle(shooter);
    animateActor(shooter, pose, 0, LOD.near);
    actorBatch.clear();
    drawHeldWeapon(probe, pose, style, LOD.near);
    Muzzle.locate(shooter, weapon);
    const found = muzzleTestFirstInstance(actorBatch, drawn);
    check('third person: the held model draws the muzzle where the code puts it (yaw ' + yaw + ', pitch ' + pitch + ', height ' + height + ')', found && muzzleTestDistance(drawn, Muzzle.point) < MUZZLE_TEST_TOLERANCE, found && JSON.stringify(drawn) + ' vs ' + JSON.stringify(Muzzle.point));
  }
  muzzleTestAim(shooter, 0, 0);
  Actors.height[shooter] = STAND_HEIGHT;
  Muzzle.locate(shooter, weapon);
  const eye = muzzleTestEye(shooter);
  check('third person: right of the view line, below the eye, ahead of it', Muzzle.point.x < eye.x - 0.1 && Muzzle.point.y < eye.y && Muzzle.point.z > eye.z + 0.5, JSON.stringify(Muzzle.point) + ' eye ' + JSON.stringify(eye));
  WeaponModels.weapon[weapon.index] = saved;
  actorBatch.clear();
  TestArena.finish();
});

// Projectiles start at the muzzle and fly to the point under the crosshair; lobbed ones keep the eye direction.
Test.add('muzzle', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-5, 0, 40], max: [5, 6, 41] }]);
  const shooter = TestArena.actor(1, 0, 0), straight = muzzleTestWeapon('needlethorn'), lobbed = muzzleTestWeapon('pitcher');
  check('the test weapons: one flies straight, one is lobbed', CAT.projectiles.byId(straight.primary.projectile).gravity === 0 && CAT.projectiles.byId(lobbed.primary.projectile).gravity > 0);
  const spawn = (weapon) => {
    Projectiles.clear();
    const direction = muzzleTestDirection(shooter), i = Projectiles.spawnFromWeapon(shooter, weapon, weapon.primary, 0, direction, 10, 1, 0, -1);
    return { i, speed: length3(Projectiles.vx[i], Projectiles.vy[i], Projectiles.vz[i]), start: Vec.set(Vec.make(), Projectiles.x[i], Projectiles.y[i], Projectiles.z[i]),
      dir: Vec.set(Vec.make(), Projectiles.vx[i], Projectiles.vy[i], Projectiles.vz[i]) };
  };
  // Where the path crosses the plane z = z0.
  const pathAt = (shot, z0) => { const t = (z0 - shot.start.z) / shot.dir.z; return Vec.set(Vec.make(), shot.start.x + shot.dir.x * t, shot.start.y + shot.dir.y * t, z0); };
  muzzleTestAim(shooter, 0, 0);
  const eye = muzzleTestEye(shooter);
  let shot = spawn(straight);
  Muzzle.locate(shooter, straight);
  check('a projectile starts at the muzzle, off the eye line', muzzleTestDistance(shot.start, Muzzle.point) < 1e-4 && muzzleTestDistance(shot.start, eye) > 0.4 && Math.abs(shot.start.x - eye.x) > 0.1, JSON.stringify(shot.start));
  const wallPoint = pathAt(shot, 40);
  check('and flies to the wall under the crosshair (40 m), at full speed', Math.abs(wallPoint.x - eye.x) < 0.01 && Math.abs(wallPoint.y - eye.y) < 0.01 && Test.near(shot.speed, CAT.projectiles.byId(straight.primary.projectile).speed, 1e-3), JSON.stringify(wallPoint));
  muzzleTestAim(shooter, 0.4, 0.1);
  shot = spawn(straight);
  const aim = muzzleTestDirection(shooter), aimPoint = Vec.set(Vec.make(), eye.x + aim.x * MUZZLE_CONVERGE_RANGE, eye.y + aim.y * MUZZLE_CONVERGE_RANGE, eye.z + aim.z * MUZZLE_CONVERGE_RANGE);
  const toAim = Vec.normalize(Vec.make(), Vec.set(Vec.make(), aimPoint.x - shot.start.x, aimPoint.y - shot.start.y, aimPoint.z - shot.start.z));
  check('with nothing ahead it aims at a point ' + MUZZLE_CONVERGE_RANGE + ' m down the view line', muzzleTestDistance(Vec.normalize(Vec.make(), shot.dir), toAim) < 1e-5 && Vec.dot(Vec.normalize(Vec.make(), shot.dir), aim) > 0.9999);
  const target = TestArena.sponge(2, 0, 12);
  muzzleTestAim(shooter, 0, 0);
  TestArena.aimAt(shooter, target);
  shot = spawn(straight);
  const mid = pathAt(shot, Actors.z[target]);
  Hitbox.point(target, ZONE.BODY, pointScratch);
  check('an actor under the crosshair is the point aimed at (it is hit)', Math.abs(mid.x - pointScratch.x) < 0.1 && Math.abs(mid.y - pointScratch.y) < 0.1, JSON.stringify(mid) + ' vs ' + JSON.stringify(pointScratch));
  Projectiles.clear();
  const health = Actors.health[target];
  Weapons.setLoadout(shooter, ['needlethorn']);
  Weapons.magazine[Weapons.slotIndex(shooter, straight.index)] = 100;
  TestArena.aimAt(shooter, target);
  TestArena.hold(shooter, BTN.FIRE, 0.5);
  Sim.run(TICK_RATE);
  check('fired for real, the shots from the muzzle hit what the crosshair is on', Actors.health[target] < health, health + ' -> ' + Actors.health[target]);
  muzzleTestAim(shooter, 0.3, 0.2);
  shot = spawn(lobbed);
  const heading = Vec.normalize(Vec.make(), shot.dir), expected = muzzleTestDirection(shooter);
  check('a lobbed projectile (gravity) keeps the eye direction, from the muzzle', muzzleTestDistance(heading, expected) < 1e-4 && muzzleTestDistance(shot.start, eye) > 0.4);
  const close = TestArena.sponge(2, 0, 1.1);
  TestArena.aimAt(shooter, close);
  shot = spawn(straight);
  const closeEye = muzzleTestEye(shooter);
  check('a player at arm\'s length: the shot leaves the eye, along the view line', muzzleTestDistance(shot.start, closeEye) < 1e-6, JSON.stringify(shot.start));
  Projectiles.clear();
  Actors.buttons[shooter] = 0;
  const closeHealth = Actors.health[close];
  TestArena.hold(shooter, BTN.FIRE, 0.2);
  check('and it is hit', Actors.health[close] < closeHealth, closeHealth + ' -> ' + Actors.health[close]);
  TestArena.finish();
});

// The blocked-muzzle rule: a wall between the eye and the muzzle means the shot leaves the eye; nothing gets through it.
Test.add('muzzle', (check) => {
  TestArena.start({}, [MUZZLE_TEST_WALL]);
  const shooter = TestArena.sponge(1, 0, 0), behind = TestArena.sponge(2, 0, 14), rocket = muzzleTestWeapon('ramjet'), rifle = muzzleTestWeapon('vanguard');
  muzzleTestAim(shooter, 0, 0);
  const eye = muzzleTestEye(shooter), direction = muzzleTestDirection(shooter);
  Muzzle.locate(shooter, rocket);
  check('the wall is between the eye and the muzzle', Muzzle.point.z > 0.5 && !Muzzle.reachable(shooter));
  let launch = Muzzle.launch(shooter, rocket, direction, true);
  check('launch: from the eye, along the view line, when the muzzle is not reachable', launch.x === eye.x && launch.y === eye.y && launch.z === eye.z && launch.dx === direction.x && launch.dy === direction.y && launch.dz === direction.z);
  Projectiles.clear();
  const i = Projectiles.spawnFromWeapon(shooter, rocket, rocket.primary, 0, direction, 10, 1, 0, -1);
  check('a projectile spawns at the eye, not past the wall', Test.near(Projectiles.z[i], eye.z, 1e-6) && Projectiles.z[i] < 0.3);
  let farthest = 0;
  for (let step = 0; step < TICK_RATE; step++) {
    Sim.step();
    for (let p = 0; p < PROJECTILE_CAP; p++) if (Projectiles.state[p] !== PROJECTILE_STATE.FREE) farthest = Math.max(farthest, Projectiles.z[p]);
  }
  check('and it is stopped by the wall in front of it', farthest < 0.31 && Actors.health[behind] === 100000, 'reached z ' + farthest);
  Weapons.setLoadout(shooter, ['ramjet']);
  Weapons.magazine[Weapons.slotIndex(shooter, rocket.index)] = 50;
  Projectiles.clear();
  TestArena.place(shooter, 0, 0);   // the first blast pushed it
  TestArena.hold(shooter, BTN.FIRE, 0.4);
  farthest = 0;
  for (let step = 0; step < TICK_RATE; step++) {
    Sim.step();
    for (let p = 0; p < PROJECTILE_CAP; p++) if (Projectiles.state[p] !== PROJECTILE_STATE.FREE) farthest = Math.max(farthest, Projectiles.z[p]);
  }
  check('fired for real at a wall in front: nothing passes it', farthest < 0.31 && Actors.health[behind] === 100000, 'reached z ' + farthest);
  Weapons.setLoadout(shooter, ['vanguard']);
  Weapons.magazine[Weapons.slotIndex(shooter, rifle.index)] = 100;
  TestArena.place(shooter, 0, 0);
  TestArena.hold(shooter, BTN.FIRE, 0.4);
  check('a hitscan shot is stopped by the wall too', Actors.health[behind] === 100000);
  TestArena.finish();
});

// Hitscan results are the eye ray's: damage lands where the eye ray hits, with or without the visual muzzle.
Test.add('muzzle', (check) => {
  TestArena.start();
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 15), rifle = muzzleTestWeapon('vanguard');
  const hits = [];
  const handler = Bus.on('damage', (event) => { if (event.source === shooter) hits.push([event.x, event.y, event.z]); });
  Weapons.setLoadout(shooter, ['vanguard']);
  Weapons.magazine[Weapons.slotIndex(shooter, rifle.index)] = 100;
  TestArena.aimAt(shooter, target, ZONE.HEAD);
  const aim = muzzleTestDirection(shooter), eye = muzzleTestEye(shooter);
  TestArena.hold(shooter, BTN.FIRE, 0.02);
  Bus.off('damage', handler);
  const offLine = hits.slice(0, 1).map(([x, y, z]) => { const t = (z - eye.z) / aim.z; return length3(x - (eye.x + aim.x * t), y - (eye.y + aim.y * t), 0); });
  check('hitscan damage lands on the eye ray (not on a line from the muzzle)', hits.length > 0 && offLine.every((value) => value < 0.01), offLine.join());
  TestArena.finish();
});

// Tracers and muzzle flashes leave the barrel: every weapon, both modes, from the muzzle to where the eye ray stopped.
Test.add('muzzle', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-8, 0, 30], max: [8, 8, 31] }]);
  const shooter = TestArena.actor(1, 0, 0), saved = { headless: Game.headless, tracer: Fx.tracer, burstAt: Fx.burstAt };
  const tracers = [], bursts = [];
  Fx.tracer = (ax, ay, az, bx, by, bz) => { tracers.push({ a: Vec.set(Vec.make(), ax, ay, az), b: Vec.set(Vec.make(), bx, by, bz) }); };
  Fx.burstAt = (kind, point) => { if (kind === 'muzzle') bursts.push(Vec.set(Vec.make(), point[FP_X], point[FP_Y], point[FP_Z])); };   // the flash is Fx.burstAt since P7 (11f ShotFx.flash)
  Game.headless = false;
  Settings.set('video.muzzleFlash', 'full');   // an earlier test may have left it reduced or off
  const problems = [], flashProblems = [], startProblems = [];
  let shots = 0, tracerShots = 0, projectileShots = 0;
  try {
    for (const weapon of CAT.weapons) {
      if (weapon.class === 'melee') continue;
      giveFull(shooter, weapon.id);
      for (const [modeIndex, mode] of [[0, weapon.primary], [1, weapon.alt]]) {
        if (!['hitscan', 'beam', 'projectile'].includes(mode.type) || mode.special) continue;
        muzzleTestAim(shooter, 0, 0);
        Projectiles.clear();
        tracers.length = 0; bursts.length = 0;
        const before = Projectiles.nextSerial;
        Weapons.fireShot(shooter, weapon, mode, modeIndex, 1);
        shots++;
        const eye = muzzleTestEye(shooter), name = mode.id;
        Muzzle.locate(shooter, weapon);
        const muzzle = Vec.copy(Vec.make(), Muzzle.point);
        const ahead = Vec.copy(Vec.make(), bursts.length ? bursts[0] : muzzle), aim = Vec.make();
        Vec.fromAngles(aim, Actors.yaw[shooter], Actors.pitch[shooter]);
        ahead.x -= aim.x * MUZZLE_FORWARD; ahead.y -= aim.y * MUZZLE_FORWARD; ahead.z -= aim.z * MUZZLE_FORWARD;   // the flash starts MUZZLE_FORWARD past the muzzle (11f)
        if (bursts.length !== (weapon.muzzleFlash > 0 ? 1 : 0) || (bursts.length && muzzleTestDistance(ahead, muzzle) > MUZZLE_TEST_TOLERANCE)) flashProblems.push(name);   // a gun with flash 0 (W06, W27, tools) has none
        if (mode.type === 'projectile') {
          const slot = Array.from(Projectiles.serial).findIndex((serial, p) => serial === before && Projectiles.state[p] !== PROJECTILE_STATE.FREE);
          if (slot < 0) { startProblems.push(name + ': no projectile'); continue; }
          projectileShots++;
          const start = Vec.set(Vec.make(), Projectiles.x[slot], Projectiles.y[slot], Projectiles.z[slot]);
          if (muzzleTestDistance(start, muzzle) > MUZZLE_TEST_TOLERANCE || muzzleTestDistance(start, eye) < 0.25) startProblems.push(name + ' starts ' + JSON.stringify(start));
          continue;
        }
        if (mode.tracer === false) { if (tracers.length) problems.push(name + ': a tracer for a silent shot'); continue; }   // W06 Hush draws none
        if (!tracers.length) { problems.push(name + ': no tracer'); continue; }
        tracerShots++;
        const tracer = tracers[0], reach = muzzleTestDistance(tracer.b, eye);
        if (muzzleTestDistance(tracer.a, muzzle) > MUZZLE_TEST_TOLERANCE || muzzleTestDistance(tracer.a, eye) < 0.25) problems.push(name + ' starts ' + JSON.stringify(tracer.a));
        if (reach < 1 || tracer.b.z - eye.z < reach * 0.95) problems.push(name + ' ends ' + JSON.stringify(tracer.b));   // on the eye ray: ahead, within the spread
      }
    }
  } finally { Game.headless = saved.headless; Fx.tracer = saved.tracer; Fx.burstAt = saved.burstAt; Settings.resetKeys(['video.muzzleFlash']); }
  check('every hitscan, beam and projectile mode fires (' + shots + ' modes)', shots >= 45 && tracerShots >= 20 && projectileShots >= 20, shots + ' ' + tracerShots + ' ' + projectileShots);
  check('every tracer starts at the weapon\'s muzzle, away from the eye, and ends where the eye ray stopped (the wall at 30 m)', problems.length === 0, problems.slice(0, 4).join('; '));
  check('every projectile starts at the muzzle, away from the eye', startProblems.length === 0, startProblems.slice(0, 4).join('; '));
  check('every shot\'s muzzle flash is at the muzzle', flashProblems.length === 0, flashProblems.slice(0, 4).join('; '));
  TestArena.finish();
});

// First person: the tracer and the flash start at the view model's barrel tip as drawn (its own field of view); a blocked muzzle falls back to the eye.
Test.add('muzzle', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-8, 0, 30], max: [8, 8, 31] }]);
  const shooter = TestArena.actor(1, 0, 0), weapon = muzzleTestWeapon('vanguard'), saved = { headless: Game.headless, tracer: Fx.tracer, player: Game.playerId, fov: Render.camera.fov, view: Render.config.viewmodelFov };
  const tracers = [];
  Fx.tracer = (ax, ay, az, bx, by, bz) => { tracers.push(Vec.set(Vec.make(), ax, ay, az)); };
  Game.headless = false; Game.playerId = shooter;
  Render.camera.fov = 100; Render.config.viewmodelFov = 60;
  try {
    giveFull(shooter, weapon.id);
    muzzleTestAim(shooter, 0, 0);
    Weapons.ads[shooter] = 0;
    const eye = muzzleTestEye(shooter), ratio = Math.tan(verticalFov(100) / 2) / Math.tan(verticalFov(60) / 2);
    Weapons.fireShot(shooter, weapon, weapon.primary, 0, 1);
    Muzzle.locate(shooter, weapon);
    const right = eye.x - Muzzle.point.x, up = Muzzle.point.y - eye.y;
    check('first person: the tracer starts where the barrel tip is drawn (offsets scaled by the two fields of view)', tracers.length === 1 && Test.near(eye.x - tracers[0].x, right * ratio, MUZZLE_TEST_TOLERANCE) && Test.near(tracers[0].y - eye.y, up * ratio, MUZZLE_TEST_TOLERANCE)
      && Test.near(tracers[0].z, Muzzle.point.z, MUZZLE_TEST_TOLERANCE) && ratio > 1.3, JSON.stringify(tracers[0]) + ' ratio ' + ratio);
    check('the simulation does not depend on the field of view', Muzzle.fovRatio === 1 && Muzzle.launch(shooter, weapon, muzzleTestDirection(shooter), true).x === Muzzle.point.x);
  } finally { Game.headless = saved.headless; Fx.tracer = saved.tracer; Game.playerId = saved.player; Render.camera.fov = saved.fov; Render.config.viewmodelFov = saved.view; }
  TestArena.finish();
  TestArena.start({}, [MUZZLE_TEST_WALL]);
  const blocked = TestArena.actor(1, 0, 0), eye = muzzleTestEye(blocked);
  Game.headless = false;
  Fx.tracer = (ax, ay, az) => { tracers.push(Vec.set(Vec.make(), ax, ay, az)); };
  tracers.length = 0;
  try {
    giveFull(blocked, weapon.id);
    muzzleTestAim(blocked, 0, 0);
    Weapons.fireShot(blocked, weapon, weapon.primary, 0, 1);
  } finally { Game.headless = saved.headless; Fx.tracer = saved.tracer; }
  check('a blocked muzzle: the tracer starts at the eye', tracers.length === 1 && muzzleTestDistance(tracers[0], eye) < 1e-6);
  TestArena.finish();
});

// X41 Ballistics: a bullet starts at the muzzle and converges on the crosshair point, so centre hits stay centre hits.
Test.add('muzzle', (check) => {
  TestArena.start({ fx: { ballistics: { gravity: 9.8, drag: 0 } } }, [{ shape: 'box', min: [-8, 0, 30], max: [8, 8, 31] }]);
  const shooter = TestArena.actor(1, 0, 0), rifle = muzzleTestWeapon('vanguard');
  muzzleTestAim(shooter, 0, 0);
  const eye = muzzleTestEye(shooter), direction = muzzleTestDirection(shooter);
  Projectiles.clear();
  const i = Projectiles.spawnBallistic(shooter, rifle, rifle.primary, 0, direction, 10, Weapons.ballistics());
  const start = Vec.set(Vec.make(), Projectiles.x[i], Projectiles.y[i], Projectiles.z[i]);
  Muzzle.locate(shooter, rifle);
  const t = (30 - start.z) / Projectiles.vz[i], dropped = 0.5 * 9.8 * t * t;   // the line to the point, and how far gravity pulls it below on the way
  check('a ballistic bullet starts at the muzzle', muzzleTestDistance(start, Muzzle.point) < 1e-4 && Math.abs(start.x - eye.x) > 0.1);
  check('and crosses the wall under the crosshair (30 m), the drop aside', Math.abs(start.x + Projectiles.vx[i] * t - eye.x) < 0.01 && Math.abs(start.y + Projectiles.vy[i] * t - eye.y) < 0.01 && dropped < 0.06);
  TestArena.finish();
});

// The way from the muzzle to the aim point is checked too: a pillar edge the eye ray clears sends the shot out of the eye.
Test.add('muzzle', (check) => {
  const wall = { shape: 'box', min: [-8, 0, 20], max: [8, 8, 21] }, pillar = { shape: 'box', min: [-1, 0, 1], max: [-0.03, 5, 1.4] };
  TestArena.start({}, [wall]);
  let shooter = TestArena.actor(1, 0, 0), rocket = muzzleTestWeapon('ramjet');
  muzzleTestAim(shooter, 0, 0);
  const eye = muzzleTestEye(shooter), direction = muzzleTestDirection(shooter);
  let launch = Muzzle.launch(shooter, rocket, direction, true);
  check('no pillar: the shot leaves the muzzle', Muzzle.usable && Math.abs(launch.x - eye.x) > 0.1);
  TestArena.finish();
  TestArena.start({}, [wall, pillar]);
  shooter = TestArena.actor(1, 0, 0);
  muzzleTestAim(shooter, 0, 0);
  launch = Muzzle.launch(shooter, rocket, direction, true);
  check('the eye ray and the eye-to-muzzle line are clear of the pillar', World.lineClear(eye.x, eye.y, eye.z, eye.x, eye.y, 19) && Muzzle.usable);
  check('a pillar edge on the muzzle-to-aim-point line: the shot leaves the eye', launch.x === eye.x && launch.y === eye.y && launch.z === eye.z && launch.dx === direction.x && launch.dz === direction.z);
  const lobbed = Muzzle.launch(shooter, muzzleTestWeapon('pitcher'), direction, false);
  check('a lobbed shot checks its first metres too', lobbed.x === eye.x && lobbed.z === eye.z);
  TestArena.finish();
});

// One trigger pull works its muzzle out once: every pellet, the tracer and the flash share it.
Test.add('muzzle', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-8, 0, 30], max: [8, 8, 31] }]);
  const shooter = TestArena.actor(1, 0, 0), saved = { locate: Muzzle.locate, headless: Game.headless, tracer: Fx.tracer, burst: Fx.burst };
  let located = 0;
  Muzzle.locate = function (id, weapon) { located++; return saved.locate.call(this, id, weapon); };
  Fx.tracer = () => {}; Fx.burst = () => {};
  try {
    for (const [key, drawn] of [['shardcaster', false], ['scattergun', true]]) {
      const weapon = giveFull(shooter, key);
      muzzleTestAim(shooter, 0, 0);
      Projectiles.clear();
      Game.headless = !drawn;
      located = 0;
      Weapons.fireShot(shooter, weapon, weapon.primary, 0, 1);
      check(key + ': one shot, ' + (drawn ? 'drawn (the simulated and the drawn muzzle)' : 'simulated (every pellet)') + ': ' + (drawn ? 2 : 1) + ' muzzle placements', located === (drawn ? 2 : 1), located);
    }
  } finally { Muzzle.locate = saved.locate; Game.headless = saved.headless; Fx.tracer = saved.tracer; Fx.burst = saved.burst; }
  TestArena.finish();
});

// What only the picture knows: the player's view model offset, the second pistol, the body scale; the simulation stays as it is.
Test.add('muzzle', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-8, 0, 30], max: [8, 8, 31] }]);
  const shooter = TestArena.actor(1, 0, 0), weapon = muzzleTestWeapon('warden'), saved = { headless: Game.headless, tracer: Fx.tracer, burst: Fx.burst, player: Game.playerId, fov: Render.camera.fov, view: Render.config.viewmodelFov, offset: Render.config.viewmodelOffset, style: Render.actorStyle };
  const tracers = [];
  Fx.tracer = (ax, ay, az) => { tracers.push(Vec.set(Vec.make(), ax, ay, az)); };
  Fx.burst = () => {};
  Game.headless = false;
  Render.camera.fov = 100; Render.config.viewmodelFov = 60;
  const ratio = Math.tan(verticalFov(100) / 2) / Math.tan(verticalFov(60) / 2);
  const shoot = () => { muzzleTestAim(shooter, 0, 0); Weapons.ads[shooter] = 0; tracers.length = 0; Weapons.fireShot(shooter, weapon, weapon.primary, 0, 1); return tracers[0]; };
  try {
    giveFull(shooter, weapon.id);
    Game.playerId = shooter;
    const eye = muzzleTestEye(shooter);
    Muzzle.locate(shooter, weapon);
    const right = eye.x - Muzzle.point.x, up = Muzzle.point.y - eye.y, forward = Muzzle.point.z - eye.z, simulated = Vec.copy(Vec.make(), Muzzle.point);
    Render.config.viewmodelOffset = [0.05, -0.03, 0.1];
    let tracer = shoot();
    check('the view model offset setting moves the drawn muzzle (right, up, forward)', Test.near(eye.x - tracer.x, (right - 0.05) * ratio, MUZZLE_TEST_TOLERANCE) && Test.near(tracer.y - eye.y, (up - 0.03) * ratio, MUZZLE_TEST_TOLERANCE) && Test.near(tracer.z - eye.z, forward + 0.1, MUZZLE_TEST_TOLERANCE), JSON.stringify(tracer));
    Muzzle.locate(shooter, weapon);
    check('and not the simulated one', muzzleTestDistance(Muzzle.point, simulated) < 1e-6 && muzzleTestDistance(Muzzle.start, simulated) < 1e-6);
    Render.config.viewmodelOffset = [0, 0, 0];
    Weapons.dual[Weapons.slotIndex(shooter, weapon.index)] = 1;
    Weapons.recoilShot[shooter] = 0;
    const rightGun = shoot();
    Weapons.recoilShot[shooter] = 1;
    const leftGun = shoot();
    check('a pair of pistols: the shots alternate between the right and the left gun', Test.near(eye.x - rightGun.x, right * ratio, MUZZLE_TEST_TOLERANCE) && Test.near(leftGun.x - eye.x, right * ratio, MUZZLE_TEST_TOLERANCE), rightGun.x + ' ' + leftGun.x);
    Weapons.dual[Weapons.slotIndex(shooter, weapon.index)] = 0;
    Game.playerId = saved.player;
    Render.actorStyle = null;
    const feet = Vec.set(Vec.make(), Actors.x[shooter], Actors.y[shooter], Actors.z[shooter]);
    const plain = Vec.copy(Vec.make(), shoot());
    Render.actorStyle = (id, out) => { out.scale = 2; };
    tracer = shoot();
    check('a held weapon follows the body scale (twice the size: twice as far from the feet)', Test.near(tracer.x - feet.x, 2 * (plain.x - feet.x), MUZZLE_TEST_TOLERANCE) && Test.near(tracer.y - feet.y, 2 * (plain.y - feet.y), MUZZLE_TEST_TOLERANCE) && Test.near(tracer.z - feet.z, 2 * (plain.z - feet.z), MUZZLE_TEST_TOLERANCE), JSON.stringify(plain) + ' ' + JSON.stringify(tracer));
    Muzzle.locate(shooter, weapon);
    check('and the simulated muzzle ignores it', muzzleTestDistance(Muzzle.point, Muzzle.start) < 1e-6);
  } finally { Game.headless = saved.headless; Fx.tracer = saved.tracer; Fx.burst = saved.burst; Game.playerId = saved.player; Render.camera.fov = saved.fov; Render.config.viewmodelFov = saved.view; Render.config.viewmodelOffset = saved.offset; Render.actorStyle = saved.style; }
  TestArena.finish();
});

// A target at point-blank range: the tracer starts at the eye, it does not run backwards from a muzzle behind the target.
Test.add('muzzle', (check) => {
  TestArena.start();
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 0.6), weapon = muzzleTestWeapon('vanguard'), saved = { headless: Game.headless, tracer: Fx.tracer, burst: Fx.burst };
  const tracers = [];
  Fx.tracer = (ax, ay, az, bx, by, bz) => { tracers.push({ a: Vec.set(Vec.make(), ax, ay, az), b: Vec.set(Vec.make(), bx, by, bz) }); };
  Fx.burst = () => {};
  Game.headless = false;
  try {
    giveFull(shooter, weapon.id);
    TestArena.aimAt(shooter, target);
    Weapons.fireShot(shooter, weapon, weapon.primary, 0, 1);
    const eye = muzzleTestEye(shooter), tracer = tracers[0];
    check('point-blank: the tracer starts at the eye and runs forward to the target', tracer && muzzleTestDistance(tracer.a, eye) < 1e-6 && muzzleTestDistance(tracer.b, eye) > 0.1 && Actors.health[target] < 100000, JSON.stringify(tracer));
  } finally { Game.headless = saved.headless; Fx.tracer = saved.tracer; Fx.burst = saved.burst; }
  TestArena.finish();
});
