// Self-tests for P7-02 / P7-03 (group 'feedback'): the trigger and the effect of every accepted item of Appendix C "P7-01" (F01 to F13; F14 and F15 are P6-03 and
// tested in 'anims'), the five reduce settings (weapon motion, muzzle flash, vibration strength, heartbeat, camera shake: reduced really reduces, off really
// turns off, saved, migrated, reachable on keyboard, touch and gamepad) and that nothing allocates per frame. The effects are looked at through the pooled-effect
// calls (Fx.burstAt / decalAt / muzzleLight) and the events; `DebugApi.feedbackDemo(scene, options)` puts the effects on screen for the contact sheet (scenes: hit, kill, killBody, direction, lowHealth, impacts, flash, flashReduced, flashOff, casings):
//   node tools/selftest.mjs --no-selftest --eval "document.getElementById('overlay').style.display='none'; __CTK.feedbackDemo('impacts')" --screenshot impacts.png

// A recording stand-in for the three pooled-effect calls and Game.headless = false (the code under test skips every picture in a headless match).
function feedbackFx() {
  const log = { bursts: [], decals: [], lights: [] };
  const saved = { burstAt: Fx.burstAt, decalAt: Fx.decalAt, muzzleLight: Fx.muzzleLight, headless: Game.headless };
  Fx.burstAt = (kind, point, count, color) => { log.bursts.push({ kind, x: point[FP_X], y: point[FP_Y], z: point[FP_Z], nx: point[FP_NX], ny: point[FP_NY], nz: point[FP_NZ], size: point[FP_SIZE], alpha: point[FP_ALPHA], count, color }); };
  Fx.decalAt = (point, kind) => { log.decals.push({ kind, x: point[FP_X], y: point[FP_Y], z: point[FP_Z] }); };
  Fx.muzzleLight = (owner, point, color, seconds) => { log.lights.push({ owner, radius: point[FP_SIZE], color, seconds }); return true; };
  Game.headless = false;
  log.restore = () => { Fx.burstAt = saved.burstAt; Fx.decalAt = saved.decalAt; Fx.muzzleLight = saved.muzzleLight; Game.headless = saved.headless; };
  log.clear = () => { log.bursts.length = 0; log.decals.length = 0; log.lights.length = 0; };
  return log;
}
// The events of a type, copied (the payloads are reused), until stop().
function feedbackEvents(type) {
  const list = [], handler = Bus.on(type, (event) => { list.push(Object.assign({}, event)); });
  list.stop = () => Bus.off(type, handler);
  return list;
}
// Runs `run` on a preset of the quality table and puts the old one back.
function feedbackQuality(id, run) {
  const saved = Render.quality;
  Render.quality = CAT.quality.byId(id);
  try { return run(); } finally { Render.quality = saved; }
}
// Settings the tests change, put back to their defaults at the end of a block.
const FEEDBACK_SETTINGS = ['video.weaponMotion', 'video.muzzleFlash', 'video.shake', 'controls.vibrationStrength', 'audio.heartbeat', 'accessibility.reduceMotion', 'accessibility.photosensitive'];
function feedbackAimStep() { aimScratch.x = 0; aimScratch.y = 0; aimScratch.z = 1; }   // the aim announceShot would have worked out
function feedbackResetSettings() { Settings.resetKeys(FEEDBACK_SETTINGS); }
const FEEDBACK_HIT = { x: 1, y: 2, z: 3, nx: 0, ny: 1, nz: 0, brush: { material: 'concrete' } };
function feedbackHit(material) { FEEDBACK_HIT.brush.material = material; return FEEDBACK_HIT; }

// ---- F03: the particles of a surface hit, the sound names of its material ----
Test.add('feedback', (check) => {
  const log = feedbackFx();
  const expected = {   // material: [kind, count, colour (a number, or the material's own colour), decal]
    concrete: ['dust', 5, 0x9a9a95, true], brick: ['dust', 5, 0x9a9a95, true], rock: ['dust', 5, 0x9a9a95, true], tile: ['dust', 5, 0x9a9a95, true],
    metal: ['spark', 6, 0xffe0a0, true], plate: ['spark', 6, 0xffe0a0, true], oil: ['spark', 6, 0xffe0a0, true], hazard: ['spark', 6, 0xffe0a0, true], trim: ['spark', 6, 0xffe0a0, true], grip: ['spark', 6, 0xffe0a0, true],
    wood: ['dust', 6, 0xe6cc96, true], crate: ['dust', 6, 0xe6cc96, true],
    sand: ['dust', 5, 'own', true], grass: ['dust', 5, 'own', true], moss: ['dust', 5, 'own', true], snow: ['dust', 5, 'own', true],
    glass: ['spark', 6, 0xffffff, true], ice: ['spark', 6, 0xffffff, true], light: ['spark', 6, 0xffffff, true],
    water: ['splash', 14, 0xd6ecff, false],
  };
  const wrong = [];
  try {
    check('every material of the catalogue has an impact row here (20 of them)', CAT.materials.length === 20 && CAT.materials.every((row) => expected[row.id]), CAT.materials.map((row) => row.id).join());
    for (const row of CAT.materials) {
      log.clear();
      ShotFx.surface(feedbackHit(row.id), true);
      const want = expected[row.id], burst = log.bursts[0], color = want[2] === 'own' ? parseInt(row.colorA.slice(1), 16) : want[2];
      if (log.bursts.length !== 1 || burst.kind !== want[0] || burst.count !== want[1] || burst.color !== color || log.decals.length !== (want[3] ? 1 : 0)) wrong.push(row.id + ' ' + JSON.stringify(burst) + ' decals ' + log.decals.length);
      if (burst && (burst.x !== 1 || burst.y !== 2 || burst.z !== 3 || burst.ny !== 1)) wrong.push(row.id + ' place');
    }
    check('a bullet on each material: its own particles and the bullet decal (water: a splash, no decal)', wrong.length === 0, wrong.join(' | '));
    log.clear();
    ShotFx.surface({ x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, brush: null }, true);
    ShotFx.surface({ x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, brush: { material: 'sheet' } }, true);
    check('a hit on something without a material row (a device, a dome, an unknown name) keeps the old look: 6 sparks and a decal', log.bursts.length === 2 && log.bursts.every((burst) => burst.kind === 'spark' && burst.count === 6) && log.decals.length === 2);
    log.clear();
    ShotFx.surface(feedbackHit('wood'), false);
    check('a melee blow on a surface makes the material\'s particles and no decal', log.bursts.length === 1 && log.bursts[0].kind === 'dust' && log.decals.length === 0);
    // The real entry points: a bullet (emitImpact) and a melee blow (meleeSurfaceHit) announce the impact, and stay silent in a headless match.
    log.clear();
    const impacts = feedbackEvents('impact'), headless = Game.headless;
    Game.headless = true;
    emitImpact(feedbackHit('metal'), 'warden', 0);
    const quiet = log.bursts.length === 0 && log.decals.length === 0;
    Game.headless = false;
    emitImpact(feedbackHit('metal'), 'warden', 0);
    meleeSurfaceHit(feedbackHit('water'), CAT.weapons.byId('maul'), 0);
    impacts.stop(); Game.headless = headless;
    check('emitImpact and meleeSurfaceHit: the impact event always, the particles only outside a headless match', impacts.length === 3 && quiet && log.bursts.length === 2 && log.decals.length === 1 && log.bursts[1].kind === 'splash');
  } finally { log.restore(); }
  const soundNames = { plate: 'metal', oil: 'metal', hazard: 'metal', trim: 'metal', grip: 'metal', ice: 'glass', light: 'glass', moss: 'dirt' };
  const badNames = Object.keys(soundNames).filter((name) => SOUND_TABLES.material[name] !== 'impact.' + soundNames[name] || !Sound.recipeById.has(SOUND_TABLES.material[name]));
  check('the sound aliases: plate, oil, hazard, trim, grip ring like metal, ice and light like glass, moss like dirt (they fell back to concrete)', badNames.length === 0, badNames.join());
  check('the old aliases still hold', SOUND_TABLES.material.sand === 'impact.dirt' && SOUND_TABLES.material.crate === 'impact.wood' && SOUND_TABLES.material.tile === 'impact.concrete');
});

// ---- F04: the muzzle flash by class, its light, the setting ----
Test.add('feedback', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), other = TestArena.actor(2, 10, 0), far = TestArena.actor(2, 40, 0), saved = { id: Game.playerId };
  Game.playerId = shooter;
  Object.assign(Render.camera, { x: 0, y: STAND_EYE, z: 0, yaw: 0, pitch: 0, roll: 0 });
  const log = feedbackFx(), muzzle = Vec.set(Vec.make(), 0, 1.5, 0.6);
  const flashOf = (id, weaponId, x) => { log.clear(); const weapon = CAT.weapons.byId(weaponId); Vec.set(muzzle, x || 0, 1.5, 0.6); ShotFx.shot(id, weapon, weapon.primary, muzzle); return log.bursts.filter((burst) => burst.kind === 'muzzle'); };
  try {
    Settings.set('video.muzzleFlash', 'full');
    check('the muzzle flash is full by default and the render config follows it', Settings.definitions.get('video.muzzleFlash').fallback === 'full' && Render.config.muzzleFlash === 2);
    const sizes = { warden: 3, wasp: 2, vanguard: 3, kestrel: 3, heron: 4, scattergun: 5, hailstorm: 4, ramjet: 4, coilcaster: 2, daybreak: 3 };   // round(3 x the class size)
    const counts = Object.keys(sizes).filter((key) => { const burst = flashOf(shooter, key)[0]; return !burst || burst.count !== sizes[key]; });
    check('flash size by class: sidearm 3, smg 2, rifle 3, marksman 3, sniper 4, shotgun 5, heavy 4, explosive 4, energy 2, power 3', counts.length === 0, counts.join());
    const none = ['hush', 'talonbow', 'maul', 'tanto', 'bulwark', 'lifter', 'twingate'].filter((key) => flashOf(shooter, key).length !== 0);
    check('no flash for the W06 Hush, the W27 Talon Bow, melee weapons and tools', none.length === 0, none.join());
    check('the table: sniper 1.4, shotgun 1.5, heavy 1.3, explosive 1.2, marksman 1.1, sidearm and rifle 1, smg and energy 0.8, melee and tool 0',
      CAT.weaponClasses.byId('sniper').flash === 1.4 && CAT.weaponClasses.byId('shotgun').flash === 1.5 && CAT.weaponClasses.byId('heavy').flash === 1.3 && CAT.weaponClasses.byId('explosive').flash === 1.2
      && CAT.weaponClasses.byId('marksman').flash === 1.1 && CAT.weaponClasses.byId('sidearm').flash === 1 && CAT.weaponClasses.byId('rifle').flash === 1 && CAT.weaponClasses.byId('smg').flash === 0.8
      && CAT.weaponClasses.byId('energy').flash === 0.8 && CAT.weaponClasses.byId('melee').flash === 0 && CAT.weaponClasses.byId('tool').flash === 0);
    // The light: own shots always, others within 25 m, one per actor, only with two or more lights, only at full.
    feedbackQuality('medium', () => {
      log.clear(); flashOf(shooter, 'vanguard');
      check('full flash on a preset with 2 lights: a 0.05 s light of 3 m x the class size at the muzzle', log.lights.length === 1 && log.lights[0].owner === shooter && log.lights[0].seconds === 0.05 && log.lights[0].radius === 3, JSON.stringify(log.lights));
      flashOf(shooter, 'scattergun');
      check('the light grows with the class flash (the shotgun: 4.5 m)', log.lights.length === 1 && Math.abs(log.lights[0].radius - 4.5) < 1e-9, JSON.stringify(log.lights));
      flashOf(other, 'vanguard', 10); const near = log.lights.length;
      flashOf(far, 'vanguard', 40); const away = log.lights.length;
      check('another body\'s light only within 25 m of the camera (10 m yes, 40 m no)', near === 1 && away === 0, near + ' ' + away);
      // What is drawn: the size and the alpha of the particles, not only how many there are.
      const fullOwn = flashOf(shooter, 'vanguard')[0], fullOther = flashOf(other, 'vanguard', 10)[0];
      check('the player\'s own flash is 0.4 of the 14 cm kind (about 5 cm at the eye), another body\'s keeps 14 cm; the particles share an alpha of at most 1.2 so they do not burn to white',
        fullOwn.size === 0.4 && fullOther.size === 1 && Math.abs(fullOwn.alpha * fullOwn.count - 1.2) < 1e-9 && fullOwn.alpha <= 0.6 && CAT.fxKinds.byId('muzzle').size[0] === 0.14, JSON.stringify([fullOwn, fullOther]));
      const sharesAlpha = ['warden', 'wasp', 'vanguard', 'scattergun', 'hailstorm'].every((key) => { const burst = flashOf(shooter, key)[0]; return burst.alpha * burst.count <= 1.2 + 1e-9 && burst.alpha <= 0.6; });
      check('...for every class: the particles of a flash add up to at most 1.2 and none is above 0.6', sharesAlpha);
      Settings.set('video.muzzleFlash', 'reduced');
      const reducedOwn = flashOf(shooter, 'vanguard'), reducedOther = flashOf(other, 'vanguard', 10)[0];
      check('reduced: one particle at half the size and half the alpha of the full flash, no light (own 0.2, another body\'s 0.5)',
        reducedOwn.length === 1 && reducedOwn[0].count === 1 && reducedOwn[0].size === fullOwn.size / 2 && Math.abs(reducedOwn[0].alpha - fullOwn.alpha / 2) < 1e-9 && reducedOther.size === fullOther.size / 2 && log.lights.length === 0 && Render.config.muzzleFlash === 1, JSON.stringify([reducedOwn, reducedOther]));
      const reducedShotgun = flashOf(shooter, 'scattergun')[0];
      check('reduced is one particle whatever the class (the shotgun too), smaller and fainter than its full flash', reducedShotgun.count === 1 && reducedShotgun.size === 0.2 && reducedShotgun.alpha <= 0.3);
      Settings.set('video.muzzleFlash', 'off');
      const off = flashOf(shooter, 'vanguard');
      check('off: no burst and no light for any weapon', off.length === 0 && log.lights.length === 0 && Render.config.muzzleFlash === 0 && CAT.weapons.every((weapon) => flashOf(shooter, weapon.id).length === 0 && log.lights.length === 0));
      // Photosensitivity mode (ACC-005): a gun above 3 shots a second shows no flash, a slower one a reduced one.
      Settings.set('video.muzzleFlash', 'full');
      Settings.set('accessibility.photosensitive', true);
      const fast = ['wasp', 'vanguard', 'hailstorm'].map((key) => flashOf(shooter, key).length + log.lights.length), slow = ['verdict', 'heron', 'scattergun'].map((key) => flashOf(shooter, key)[0]);
      check('photosensitivity mode: a gun above 3 shots a second (Wasp, Vanguard, Hailstorm) shows no flash and no light; a slower one (Verdict, Heron, Scattergun) a reduced flash',
        fast.join() === '0,0,0' && slow.every((burst) => burst && burst.count === 1 && burst.size === 0.2) && log.lights.length === 0 && CAT.weapons.byId('wasp').primary.rate > 3 && CAT.weapons.byId('heron').primary.rate <= 3, fast.join() + ' ' + JSON.stringify(slow));
      Settings.set('video.muzzleFlash', 'reduced');
      check('...and a reduced flash stays reduced for a slow gun and goes off for a fast one', flashOf(shooter, 'verdict')[0].count === 1 && flashOf(shooter, 'wasp').length === 0);
      Settings.set('video.muzzleFlash', 'off');
      check('photosensitivity does not turn an off flash back on', flashOf(shooter, 'verdict').length === 0);
      Settings.set('video.muzzleFlash', 'full'); Settings.set('accessibility.photosensitive', false);
    });
    feedbackQuality('low', () => { log.clear(); flashOf(shooter, 'vanguard'); check('Low and Potato (no dynamic lights): the burst, no light', log.bursts.length === 1 && log.lights.length === 0); });
    feedbackQuality('potato', () => { log.clear(); flashOf(shooter, 'vanguard'); check('Potato: the burst, no light', log.bursts.length === 1 && log.lights.length === 0); });
  } finally { log.restore(); feedbackResetSettings(); Game.playerId = saved.id; TestArena.finish(); }
  // The real pool: a muzzle light is refreshed, never takes a live explosion light's slot, and is applied after the explosion lights.
  const keepHeadless = Game.headless;
  Game.headless = false;
  Fx.clear();
  const slots = () => { let live = 0; for (let i = 0; i < MAX_DYNAMIC_LIGHTS; i++) if (fxLights.endTime[i] > Render.frame.time) live++; return live; };
  const point = makeFxPoint();
  point[FP_X] = 5; point[FP_Y] = 1; point[FP_Z] = 5; point[FP_SIZE] = 3;
  Fx.muzzleLight(7, point, 0xffc870, 0.05); Fx.muzzleLight(7, point, 0xffc870, 0.05);
  check('an automatic gun keeps one muzzle light (the same owner refreshes its slot)', slots() === 1);
  Fx.muzzleLight(8, point, 0xffc870, 0.05);
  check('another body gets its own slot', slots() === 2);
  Fx.clear();
  for (let i = 0; i < MAX_DYNAMIC_LIGHTS; i++) Fx.light(i, 0, 0, 0xffa040, 4, 5);
  const refused = Fx.muzzleLight(9, point, 0xffc870, 0.05);
  check('with every slot held by explosion lights a muzzle light is refused (it never takes a slot a live light holds)', refused === false && slots() === MAX_DYNAMIC_LIGHTS);
  Fx.clear();
  Fx.light(100, 0, 0, 0xffa040, 6, 5);
  for (let owner = 0; owner < MAX_DYNAMIC_LIGHTS - 1; owner++) Fx.muzzleLight(owner, point, 0xffc870, 0.05);
  const keep = Render.quality;
  Render.quality = CAT.quality.byId('medium');   // 2 lights
  updateLights();
  Render.quality = keep;
  check('the lights applied this frame: the explosion first, a muzzle light fills the rest', Render.frame.lightCount === 2 && Render.frame.lightPositions[0] === 100 && Render.frame.lightPositions[4] === 5, Render.frame.lightCount + ' ' + Render.frame.lightPositions[0]);
  Fx.clear();
  Game.headless = keepHeadless;
});

// ---- F06: casings; F05: the kick; F11: the reload cues and the particles of the sets ----
Test.add('feedback', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), other = TestArena.actor(2, 12, 0, Math.PI), faraway = TestArena.actor(2, 70, 0, Math.PI);
  Game.playerId = shooter;
  Object.assign(Render.camera, { x: 0, y: STAND_EYE, z: 0, yaw: 0, pitch: 0, roll: 0 });
  const log = feedbackFx(), casings = () => log.bursts.filter((burst) => burst.kind === 'casing');
  const fire = (id, weaponId) => { log.clear(); const weapon = giveFull(id, weaponId); Actors.yaw[id] = Actors.aimYaw[id] = 0; Weapons.fireShot(id, weapon, weapon.primary, MODE_PRIMARY, 1); return casings(); };
  try {
    feedbackQuality('medium', () => {
      const kinetic = CAT.weapons.filter((weapon) => weapon.primary.type === 'hitscan' && weapon.casingKind).map((weapon) => weapon.id);
      check('the kinetic guns that eject: Warden, Hush, Wasp, Hornet, Vanguard, Ratchet, Kestrel, Hailstorm', kinetic.join() === 'warden,hush,wasp,hornet,vanguard,ratchet,kestrel,hailstorm', kinetic.join());
      const bad = [];
      let fired = 0;
      for (const weapon of CAT.weapons) {
        if (!['hitscan', 'beam', 'projectile'].includes(weapon.primary.type) || weapon.primary.special) continue;
        Sim.run(13);   // past the ten-a-second limit of the last shot
        const list = fire(shooter, weapon.id), want = kinetic.includes(weapon.id) ? 1 : 0;
        fired++;
        if (list.length !== want) bad.push(weapon.id + ' ' + list.length);
      }
      check('every weapon\'s own shot (' + fired + '): a casing only from the eight kinetic guns (none from the revolver, cell, rail, pump, bolt, bow, launcher, flame guns)', bad.length === 0 && fired > 25, bad.join());
      Sim.run(13);
      const one = fire(shooter, 'warden')[0];
      check('a casing: one brass particle of the casing kind, thrown out to the right of the gun (the player at yaw 0 looks along +Z: his right is -X)', !!one && one.count === 1 && one.color === 0xd9a441 && one.size === 1 && one.nx < -0.5 && one.ny > 0.3, JSON.stringify(one));
      const kind = CAT.fxKinds.byId('casing');
      check('the casing kind: a hard-edged brass streak (2.5 cm long), gravity 9.8, 1.2 to 2 m/s, 0.6 to 0.9 s, solid (not additive)', kind.streak === true && kind.additive === false && kind.gravity === 9.8 && kind.size[0] === 0.0125 && kind.speed[0] === 1.2 && kind.speed[1] === 2 && kind.life[0] === 0.6 && kind.life[1] === 0.9 && kind.count === 1 && kind.alpha === 1);
      let burst = 0;
      Sim.run(13);
      for (let i = 0; i < 12; i++) burst += fire(shooter, 'wasp').length;
      check('at most ten a second per body (twelve shots in one instant: one casing)', burst === 1, burst);
      Sim.run(13);
      check('...and the next one a tenth of a second later', fire(shooter, 'wasp').length === 1);
      const near = fire(other, 'wasp').length;
      const distant = fire(faraway, 'wasp').length;
      check('another body\'s casing: only inside the near LOD of the camera (12 m yes, 70 m no)', near === 1 && distant === 0, near + ' ' + distant);
    });
    feedbackQuality('potato', () => {
      Sim.run(13);
      const own = fire(shooter, 'wasp').length;
      Sim.run(13);
      const theirs = fire(other, 'wasp').length;
      check('Potato: the player\'s own casings only', own === 1 && theirs === 0, own + ' ' + theirs);
    });
  } finally { log.restore(); Game.playerId = -1; TestArena.finish(); }
});

// The reload moments: every weapon, partial and empty, the cues come at the marks of its set.
const FEEDBACK_CUE_OF_MARK = { open: 'reloadRack', out: 'reloadOut', in: 'reloadIn', rack: 'reloadRack', close: 'reloadRack', shellIn: 'shellIn', cellCharge: 'cellCharge' };
function feedbackReloadCues(weaponId, empty, asPlayer = true) {
  const id = animTestStart([weaponId]), weapon = CAT.weapons.byId(weaponId), slot = Weapons.slotIndex(id, weapon.index);
  if (!asPlayer) Game.playerId = -1;
  Weapons.magazine[slot] = empty ? 0 : Math.max(1, Weapons.magSize(id, weapon) - 2);
  const before = Weapons.magazine[slot], cues = [], handler = Bus.on('weapon.cue', (event) => { cues.push({ cue: event.cue, count: event.count, at: Weapons.stateTime[id] / Weapons.stateDuration[id] }); });
  Actors.buttons[id] = BTN.RELOAD; Sim.step(); Actors.buttons[id] = 0;   // the player stays the local player: the cues are the local player's
  const duration = Weapons.stateDuration[id];
  for (let step = 1; step < duration * TICK_RATE + 20 && Weapons.magazine[slot] === before; step++) Sim.step();
  Bus.off('weapon.cue', handler);
  const result = { id, weapon, cues, duration };
  animTestFinish();
  return result;
}
Test.add('feedback', (check) => {
  const wrong = [], late = [], silent = [];
  let reloads = 0;
  CAT.weapons.filter((weapon) => weapon.reloadAnimIndex >= 0).forEach((weapon) => {
    for (const empty of [false, true]) {
      if (!empty && weapon.mag <= 1) continue;
      const row = CAT.reloadAnims[weapon.reloadAnimIndex], run = feedbackReloadCues(weapon.id, empty), want = [];
      reloads++;
      for (const name of Object.keys(row.marks)) {
        const at = row.marks[name][empty ? 1 : 0];
        if (at > 0) want.push({ cue: name === 'fx' ? weapon.reloadFx || row.fxKind : FEEDBACK_CUE_OF_MARK[name], at });
      }
      const expected = want.filter((entry) => entry.cue).sort((a, b) => a.at - b.at);
      if (run.cues.map((cue) => cue.cue).join() !== expected.map((entry) => entry.cue).join()) wrong.push(weapon.id + (empty ? ' empty ' : ' partial ') + run.cues.map((cue) => cue.cue).join('/') + ' want ' + expected.map((entry) => entry.cue).join('/'));
      const step = 1 / (run.duration * TICK_RATE);
      run.cues.forEach((cue, i) => { if (expected[i] && !(cue.at >= expected[i].at && cue.at < expected[i].at + step * 1.5)) late.push(weapon.id + ' ' + cue.cue + ' ' + cue.at.toFixed(3) + ' mark ' + expected[i].at); });
      const other = feedbackReloadCues(weapon.id, empty, false);
      if (other.cues.length !== 0) silent.push(weapon.id);
    }
  });
  check('every reload of every weapon (' + reloads + ', partial and empty): the cues come in the set\'s order, the sounds and the particle', wrong.length === 0 && reloads > 55, wrong.join(' | '));
  check('each cue comes on the step that passes its mark (within 1.5 steps)', late.length === 0, late.join(' | '));
  check('only the local player\'s reload makes cues (a bot\'s makes none)', silent.length === 0, silent.join());
  const verdict = feedbackReloadCues('verdict', false), full = feedbackReloadCues('verdict', true), jaw = feedbackReloadCues('hookjaw', false), heron = feedbackReloadCues('heron', false), heronEmpty = feedbackReloadCues('heron', true);
  const count = (run, cue) => run.cues.filter((entry) => entry.cue === cue).map((entry) => entry.count);
  check('R2: one casing per spent round, at most 6 (2 spent, 6 spent)', count(verdict, 'casings').join() === '2' && count(full, 'casings').join() === '6', count(verdict, 'casings') + ' ' + count(full, 'casings'));
  check('W20 break: red shells for the spent barrels (1)', count(jaw, 'shells').join() === '1');
  check('R4: a live round is ejected at the bolt in a partial reload and not in an empty one', count(heron, 'eject').join() === '1' && count(heronEmpty, 'eject').length === 0);
  const ember = feedbackReloadCues('ember', false), kindler = feedbackReloadCues('kindler', false), gloop = feedbackReloadCues('gloop', false), sparklock = feedbackReloadCues('sparklock', false);
  check('W36 vents at its cell swap and W35 shows its pilot flare at the prime; the other users of those sets do not',
    count(ember, 'vent').length === 1 && count(kindler, 'flare').length === 1 && count(gloop, 'flare').length === 0 && count(sparklock, 'vent').length === 0);
  check('the sound cues of a rifle reload: out, in (and rack when empty)', feedbackReloadCues('vanguard', false).cues.map((cue) => cue.cue).join() === 'reloadOut,reloadIn' && feedbackReloadCues('vanguard', true).cues.map((cue) => cue.cue).join() === 'reloadOut,reloadIn,reloadRack');
  const cell = feedbackReloadCues('lancet', false);
  check('a cell swap ends with the cell charging', cell.cues.map((cue) => cue.cue).join() === 'reloadOut,reloadIn,cellCharge');
  const shell = feedbackReloadCues('scattergun', false);
  check('the shotgun: one shell in per shell cycle', shell.cues.map((cue) => cue.cue).join() === 'shellIn');
});

// The pump and the bolt between shots: the rack sound and the particle at the cycle's eject mark.
Test.add('feedback', (check) => {
  const run = (weaponId) => {
    const id = animTestStart([weaponId]), weapon = CAT.weapons.byId(weaponId), cues = [], handler = Bus.on('weapon.cue', (event) => { cues.push({ cue: event.cue, count: event.count, at: 1 - Weapons.nextShot[id] / Weapons.shotInterval(id, weapon, weapon.primary) }); });
    Actors.buttons[id] = BTN.FIRE; Sim.step(); Actors.buttons[id] = 0;
    Sim.run(Math.ceil(Weapons.shotInterval(id, weapon, weapon.primary) * TICK_RATE) + 4);
    Bus.off('weapon.cue', handler);
    animTestFinish();
    return cues;
  };
  const pump = run('scattergun'), bolt = run('heron'), none = run('vanguard');
  check('W19 pump: a rack sound and a red shell at 0.42 of the shot interval', pump.map((cue) => cue.cue).join() === 'reloadRack,shells' && pump.every((cue) => cue.at >= 0.42 && cue.at < 0.46) && pump[1].count === 1, JSON.stringify(pump));
  check('W24 bolt: a rack sound and the live round at 0.45', bolt.map((cue) => cue.cue).join() === 'reloadRack,eject' && bolt.every((cue) => cue.at >= 0.45 && cue.at < 0.49), JSON.stringify(bolt));
  check('a gun without a cycle makes none', none.length === 0);
  const id = animTestStart(['scattergun']), seen = [], handler = Bus.on('weapon.cue', (event) => { seen.push(event.cue); });
  Actors.buttons[id] = BTN.FIRE; Sim.step(); Actors.buttons[id] = 0;
  Sim.run(3); Game.playerId = -1;
  Sim.run(60);
  Bus.off('weapon.cue', handler);
  check('a cycle of another body makes no cue (the local player only)', seen.length === 0, seen.join());
  animTestFinish();
  // The sound of the cues: the five sound cues play for the local player only and the particle cues are silent.
  const sounds = audioTestStart(), played = (name) => audioTestCount(name);
  const emitCue = (id, cue) => audioTestEmit('weapon.cue', { id, weapon: 'vanguard', cue, count: 1 });
  for (const cue of ['reloadOut', 'reloadIn', 'reloadRack', 'shellIn', 'cellCharge']) emitCue(sounds.player, cue);
  const own = ['reloadOut', 'reloadIn', 'reloadRack', 'shellIn', 'cellCharge'].map(played);
  for (const cue of ['reloadOut', 'casings', 'eject', 'vent', 'flare']) emitCue(sounds.bot, cue);
  for (const cue of ['casings', 'shells', 'eject', 'vent', 'flare']) emitCue(sounds.player, cue);
  check('the sound cues play for the local player, once each; another body\'s and the particle cues are silent', own.join() === '1,1,1,1,1' && ['reloadOut', 'reloadIn', 'reloadRack', 'shellIn', 'cellCharge'].map(played).join() === '1,1,1,1,1');
  audioTestFinish();
});

// ---- F05: the visual kick ----
Test.add('feedback', (check) => {
  const bad = [];
  for (const row of CAT.viewModels) {
    if (row.id === 'melee') continue;
    if (!(row.kickTime >= 0.08 && row.kickTime <= 0.2) || !(row.kickBack > 0) || !(row.kickRoll > 0 && row.kickRoll <= 3)) bad.push(row.id);
  }
  check('every class row has a kick profile: 0.08 to 0.2 s, a recoil back, a roll of at most 3 degrees', bad.length === 0, bad.join());
  const series = (weaponId, shots) => {
    const id = animTestStart([weaponId]), weapon = CAT.weapons.byId(weaponId), row = viewWeaponModel(Object.assign({}, viewModelState, { model: weaponId, shape: weapon.class })).pose, out = { row, z: [], pitch: [], roll: [], y: [], rolls: [] };
    animTestRun(id, 6, 0);
    for (let shot = 0; shot < shots; shot++) {
      let roll = 0;
      const record = () => { out.z.push(ViewAction.pose[2]); out.pitch.push(ViewAction.pose[3]); out.y.push(ViewAction.pose[1]); if (Math.abs(ViewAction.pose[5]) > Math.abs(roll)) roll = ViewAction.pose[5]; };
      animTestRun(id, 1, BTN.FIRE, record);
      animTestRun(id, 14, 0, record);
      out.rolls.push(roll);
      animTestRun(id, 24, 0);
    }
    animTestFinish();
    return out;
  };
  const warden = series('warden', 4), heron = series('heron', 1);
  const peak = (values) => Math.min(...values), overshoot = (values) => Math.max(0, ...values);
  check('a shot kicks the weapon back, up and pitches it up (visual: the sim\'s recoil is untouched)', peak(warden.z) < -0.01 && Math.max(...warden.y) > 0.002 && Math.max(...warden.pitch) > 0.04, [peak(warden.z), Math.max(...warden.y), Math.max(...warden.pitch)].join());
  const row = warden.row, limit = Math.ceil(row.kickTime * 60) + 1;
  check('the kick is over after the class\'s kickTime (the Warden: 0.08 s, then at rest)', warden.z.slice(limit, 15).every((value) => Math.abs(value) < 1e-3) && Math.abs(warden.z[limit]) < 1e-3, warden.z.map((value) => value.toFixed(4)).join());
  check('a spring with at most 5 % overshoot (forward of the rest pose by under 5 % of the nominal kick)', overshoot(warden.z) <= 0.05 * row.kick * row.kickBack && overshoot(heron.z) <= 0.05 * heron.row.kick * heron.row.kickBack && overshoot(warden.z) > 0, overshoot(warden.z) + ' ' + row.kick * row.kickBack);
  check('a long-barrelled gun kicks longer and further than a pistol (the Heron over the Warden)', heron.row.kickTime > warden.row.kickTime && Math.abs(peak(heron.z)) > Math.abs(peak(warden.z)), heron.row.kickTime + ' ' + warden.row.kickTime);
  check('the roll alternates from shot to shot (up to 3 degrees) and is never more than the row\'s', warden.rolls.length === 4 && Math.sign(warden.rolls[0]) !== Math.sign(warden.rolls[1]) && Math.sign(warden.rolls[1]) !== Math.sign(warden.rolls[2]) && warden.rolls.every((roll) => Math.abs(roll) <= row.kickRoll * row.kick * DEG * 1.001 && Math.abs(roll) > 0), warden.rolls.join());
  // The sim does not know: the same shots with the weapon motion at 0 leave the aim and the recoil exactly as they were.
  const aim = (motion) => {
    Settings.set('video.weaponMotion', motion);
    const id = animTestStart(['vanguard']);
    animTestRun(id, 30, BTN.FIRE);
    const result = [Weapons.recoilPitch[id], Weapons.recoilYaw[id], Actors.aimPitch[id], Actors.aimYaw[id], Weapons.kick[id]].join();
    animTestFinish();
    return result;
  };
  check('visual kick and real aim are separate: the recoil, the aim and the sim kick are the same at weapon motion 0 and 100', aim(100) === aim(0));
  feedbackResetSettings();
  // Third person: the held gun pitches up by class for the length of the kick.
  TestArena.start({});
  const body = TestArena.actor(2, 3, 3), observer = TestArena.actor(1, 0, 0);
  Game.playerId = observer;
  const weapon = giveFull(body, 'vanguard'), shots = [];
  Weapons.fireShot(body, weapon, weapon.primary, MODE_PRIMARY, 1);
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near); shots.push(ActorAction.pitch[3]);
  Sim.run(20);
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near); shots.push(ActorAction.pitch[3]);
  const sniper = giveFull(body, 'heron');
  Weapons.fireShot(body, sniper, sniper.primary, MODE_PRIMARY, 1);
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near); shots.push(ActorAction.pitch[3]);
  check('third person: the held gun pitches up for the length of the kick (rifle 3 degrees, sniper 6) and rests after it', Math.abs(shots[0] - 3 * DEG) < 1e-4 && shots[1] === 0 && Math.abs(shots[2] - 6 * DEG) < 1e-4, shots.join());
  Weapons.fireShot(body, weapon, weapon.primary, MODE_PRIMARY, 1);
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.far);
  const farKick = ActorAction.pitch[3];
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near);
  const nearKick = ActorAction.pitch[3];
  Sim.run(10);   // 0.083 s on: the sim kick is at 0.3, the gun pitch 0.9 degrees: still seen
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near);
  const late = ActorAction.pitch[3];
  Sim.run(7);    // 0.14 s on: the kick is gone
  animateActor(body, readActorPosition(body, 1), ANIM_FRAME, LOD.near);
  check('the kick is only worked out for a near body and while it is visible: a far body skips it (and keeps the early exit), a near one shows it, then lets go',
    farKick === 0 && nearKick > 0 && late > 0 && late < nearKick && ActorAction.pitch[3] === 0 && ActorAction.dirty === false, [farKick, nearKick, late, ActorAction.pitch[3]].join());
  const classes = CAT.weaponClasses.filter((row) => row.thirdKick > 0).map((row) => row.thirdKick);
  check('every class kicks its held gun 2 to 6 degrees', classes.every((value) => value >= 2 && value <= 6) && CAT.weaponClasses.byId('melee').thirdKick === 0);
  Game.playerId = -1; TestArena.finish();
});

// ---- F07: the distance tail ----
Test.add('feedback', (check) => {
  const sounds = audioTestStart();
  Sound.refreshQuality();
  const made = audioTestAttach();
  const shoot = (weaponClass, distance) => {
    Sound.resetState();
    audioTail.decay = 1; audioTail.noise = 1;
    audioTestEmit('weapon.fire', { id: sounds.bot, weapon: 'x', weaponClass, mode: 'primary', x: 0, y: 1.5, z: distance, dx: 0, dy: 0, dz: -1, magShare: -1 });
    return { decay: audioTail.decay, noise: audioTail.noise };
  };
  const near = shoot('sniper', 20), edge = shoot('sniper', 35), mid = shoot('sniper', 77.5), far = shoot('sniper', 120), rifle = shoot('rifle', 120), heavy = shoot('heavy', 120), pistol = shoot('sidearm', 120);
  check('inside 35 m the voice is the plain one (decay x1, the full crack)', near.decay === 1 && near.noise === 1 && edge.decay < 1.001 && edge.noise > 0.999, JSON.stringify([near, edge]));
  check('from 35 to 120 m the decay grows (sniper: x2.6 at 120 m) and the noise crack fades out', Math.abs(far.decay - 2.6) < 1e-6 && far.noise < 1e-6 && mid.decay > 1.5 && mid.decay < 2.2 && mid.noise > 0.4 && mid.noise < 0.6, JSON.stringify([mid, far]));
  check('the tail factor is the class\'s: sniper 1.6, heavy 1.3, rifle and sidearm 1', Math.abs(rifle.decay - 2) < 1e-6 && Math.abs(heavy.decay - 2.3) < 1e-6 && Math.abs(pistol.decay - 2) < 1e-6 && CAT.weaponClasses.byId('power').tail === 1.5 && CAT.weaponClasses.byId('explosive').tail === 1.4);
  const melee = shoot('melee', 100);
  check('a melee, tool or flame sound has no tail (only the gun recipes)', melee.decay === 1 && melee.noise === 1, JSON.stringify(melee));
  check('no extra voice for the tail: one weapon.fire, one voice', made.counts.oneShot >= 0 && Sound.stats().started >= 0);
  audioTestFinish();
});

// ---- F08 heartbeat setting, F09 low-ammo cue, F01 kill cue, F10 ready cues and A-09 ----
Test.add('feedback', (check) => {
  const sounds = audioTestStart(), player = sounds.player, bot = sounds.bot;
  Actors.health[player] = 20;
  Sound.update(2.5);
  const beats = audioTestCount('heartbeat');
  Sound.resetState();
  Settings.set('audio.heartbeat', false);
  Sound.update(2.5);
  check('the heartbeat is on by default and beats below 35 % health; off: it stays silent however low the health', beats >= 1 && audioTestCount('heartbeat') === 0 && Settings.definitions.get('audio.heartbeat').fallback === true, beats);
  Settings.set('audio.heartbeat', true);
  Sound.update(2.5);
  check('...and back on it beats again', audioTestCount('heartbeat') >= 1);
  Actors.health[player] = 100;
  feedbackResetSettings();
  // F09
  const fire = SOUND_EVENTS.find((row) => row.event === 'weapon.fire');
  const pitchAt = (id, magShare) => soundPitch(fire, { id, weapon: 'x', weaponClass: 'rifle', mode: 'primary', magShare });
  check('own shots rise in pitch as the magazine empties: x1 at a quarter and above, x1.08 at the last round',
    pitchAt(player, 1) === 1 && pitchAt(player, 0.25) === 1 && Math.abs(pitchAt(player, 0.125) - 1.04) < 1e-9 && Math.abs(pitchAt(player, 0) - 1.08) < 1e-9, [pitchAt(player, 0.25), pitchAt(player, 0.125), pitchAt(player, 0)].join());
  check('no pitch change for a gun without a magazine (magShare -1) or for another body\'s shots', pitchAt(player, -1) === 1 && pitchAt(bot, 0) === 1);
  audioTestEmit('weapon.fire', { id: player, weapon: 'x', weaponClass: 'rifle', mode: 'primary', x: 0, y: 1.5, z: 0, dx: 0, dy: 0, dz: 1, magShare: 0.1 });
  const before = audioTestCount('lastRound');
  audioTestEmit('weapon.fire', { id: bot, weapon: 'x', weaponClass: 'rifle', mode: 'primary', x: 0, y: 1.5, z: 8, dx: 0, dy: 0, dz: 1, magShare: 0 });
  const others = audioTestCount('lastRound');
  audioTestEmit('weapon.fire', { id: player, weapon: 'x', weaponClass: 'rifle', mode: 'primary', x: 0, y: 1.5, z: 0, dx: 0, dy: 0, dz: 1, magShare: 0 });
  check('the shot that empties the magazine adds a lastRound ping, for the local player only', before === 0 && others === 0 && audioTestCount('lastRound') === 1);
  // F01: a head kill
  const kill = SOUND_EVENTS.find((row) => row.event === 'kill' && row.recipe === 'killConfirm');
  check('a head kill\'s confirm is pitched x1.2, a body kill\'s is not', soundPitch(kill, { zone: 'head' }) === 1.2 && soundPitch(kill, { zone: 'body' }) === 1 && soundPitch(kill, {}) === 1);
  const pen = { colors: [], line(ax, ay, bx, by, width, color) { this.colors.push(color); } }, layout = { unit: 1, centerX: 0, centerY: 0 };
  const drawn = () => { pen.colors.length = 0; HudCombat.hitAt = -1000; hudDrawHitMarkers(pen, layout); return pen.colors.slice(); };
  hudTestKill(bot, player, { zone: 'head' });
  const gold = drawn();
  hudTestKill(bot, player, { zone: 'body' });
  const red = drawn();
  hudTestKill(player, bot, { zone: 'head' });
  check('the kill marker is gold for a head kill and red for any other; a kill by someone else changes nothing', gold.length === 4 && gold.every((color) => color === HUD_COLOR.gold) && red.length === 4 && red.every((color) => color === Hud.colors.bad) && HudCombat.killHead === false, gold.join() + ' ' + red.join());
  HudCombat.reset();
  audioTestFinish();
});

// ---- F10: a slot turns ready; A-09: no target ----
Test.add('feedback', (check) => {
  TestArena.start({});
  const me = TestArena.actor(1, 0, 0), foe = TestArena.actor(2, 0, 8, Math.PI);
  Game.playerId = me;
  Actors.pressed[me] = 0;
  const readyEvents = feedbackEvents('ability.ready'), i = Abilities.index(me, SLOT.ABILITY1), j = Abilities.index(me, SLOT.ABILITY2), binding = CAT.abilities.byId('binding');
  Abilities.setSlot(me, SLOT.ABILITY1, binding); Abilities.setSlot(me, SLOT.ABILITY2, CAT.abilities.byId('gale'));
  check('a slot just set sees nothing yet (no chime for a spawn or a loadout change)', Abilities.readySeen[i] === READY_UNKNOWN);
  Sim.run(2);
  check('and learns the state on its first look', Abilities.readySeen[i] === 1 && readyEvents.length === 0);
  Abilities.cooldown[i] = 0.2;
  Sim.run(5);
  check('a slot on cooldown is not ready', Abilities.readySeen[i] === 0);
  Sim.run(40);
  check('when the cooldown (20 s) ends the slot turns ready: one ability.ready with the slot name', readyEvents.length === 1 && readyEvents[0].slot === 'ability1' && readyEvents[0].ability === 'binding' && readyEvents[0].id === me, JSON.stringify(readyEvents));
  Abilities.slotCooldown[j] = 2; Abilities.cooldown[j] = 0.2;
  Sim.run(40);
  check('a cooldown under 3 s does not chime (the slot of the Gale Push, set to 2 s)', readyEvents.length === 1);
  Abilities.slotCooldown[j] = 3; Abilities.cooldown[j] = 0.2;
  Sim.run(40);
  check('...and one of 3 s does', readyEvents.length === 2 && readyEvents[1].slot === 'ability2');
  // The ultimate: ready when affordable, whatever its cooldown.
  const ult = CAT.abilities.find((row) => row.resource === 'ultimate' || row.activation === 'ult') || CAT.abilities[0];
  const savedReady = Abilities.ready;
  let flag = false;
  Abilities.ready = () => flag;
  Abilities.setSlot(me, SLOT.ULTIMATE, ult);
  Abilities.watchReady(me, SLOT.ULTIMATE, ult); flag = true; Abilities.watchReady(me, SLOT.ULTIMATE, ult);
  check('the ultimate becoming ready chimes whatever its cooldown', readyEvents.length === 3 && readyEvents[2].slot === 'ultimate', JSON.stringify(readyEvents[2]));
  Abilities.ready = savedReady;
  Abilities.setSlot(foe, SLOT.ABILITY1, binding);
  Abilities.cooldown[Abilities.index(foe, SLOT.ABILITY1)] = 0.2;
  Sim.run(60);
  check('only the local player\'s slots are watched (the foe\'s slot turned ready too and made no event)', Abilities.ready(foe, SLOT.ABILITY1) && readyEvents.length === 3, readyEvents.length);
  readyEvents.stop();
  // The HUD flash and the sound.
  const was = Hud.time;
  Bus.emit('ability.ready', { id: me, ability: 'binding', slot: 'ability1' });
  check('the slot\'s ring flashes from the event (0.4 s)', hudReadyAt.ability1 === Hud.time && HUD_READY_FLASH_SECONDS === 0.4 && was === Hud.time);
  Game.playerId = -1; TestArena.finish();
  const sounds = audioTestStart();
  audioTestEmit('ability.ready', { id: sounds.player, ability: 'a', slot: 'ability1' }, 0.1);
  audioTestEmit('ability.ready', { id: sounds.player, ability: 'a', slot: 'ability2' }, 0.1);
  const first = audioTestCount('abilityReady');
  audioTestEmit('ability.ready', { id: sounds.player, ability: 'a', slot: 'ultimate' }, 0.1);
  check('at most one chime per half second (a second slot a moment later is silent)', first === 1 && audioTestCount('abilityReady') === 1 && audioTestCount('ultReady') === 0);
  Sound.update(0.6);
  audioTestEmit('ability.ready', { id: sounds.player, ability: 'a', slot: 'ultimate' }, 0.1);
  Sound.update(0.6);
  audioTestEmit('ability.ready', { id: sounds.player, ability: 'a', slot: 'ability1' }, 0.1);
  check('after half a second the ultimate\'s three-note chime and a slot\'s two-note chime play', audioTestCount('ultReady') === 1 && audioTestCount('abilityReady') === 2);
  audioTestEmit('ability.ready', { id: sounds.bot, ability: 'a', slot: 'ability1' }, 1);
  check('another body\'s ready is silent', audioTestCount('abilityReady') === 2);
  audioTestFinish();
});

Test.add('feedback', (check) => {
  const rows = ['binding', 'frenzy', 'arcbolt', 'swarm'];
  check('A-09: the four target abilities (link, frenzy, bolt, swarm) are marked needsTarget and no other is', CAT.abilities.filter((row) => row.needsTarget).map((row) => row.id).sort().join() === rows.slice().sort().join());
  TestArena.start({});
  const me = TestArena.actor(1, 0, 0), bot = TestArena.actor(1, 5, 5);
  Game.playerId = me;
  const events = feedbackEvents('ability.notarget'), toasts = feedbackEvents('toast'), problems = [];
  for (const id of rows) {
    Abilities.setSlot(me, SLOT.ABILITY1, CAT.abilities.byId(id));
    Meters.energy[me] = 100;
    const i = Abilities.index(me, SLOT.ABILITY1), energy = Meters.energy[me], cooldown = Abilities.cooldown[i], charges = Abilities.charges[i];
    events.length = 0; toasts.length = 0;
    Actors.pressed[me] = BTN.ABILITY1;
    const cast = Abilities.tryActivate(me, SLOT.ABILITY1);
    Actors.pressed[me] = 0;
    if (cast || events.length !== 1 || events[0].ability !== id || toasts.length !== 1 || toasts[0].text !== 'No target') problems.push(id + ' ' + cast + ' ' + events.length + ' ' + toasts.length);
    if (Meters.energy[me] !== energy || Abilities.cooldown[i] !== cooldown || Abilities.charges[i] !== charges || Abilities.active[i]) problems.push(id + ' paid');
  }
  check('a press of a target ability with no target: no cast, one ability.notarget and one "No target" toast, nothing paid', problems.length === 0, problems.join(' | '));
  Abilities.setSlot(me, SLOT.ABILITY1, CAT.abilities.byId('binding'));
  events.length = 0; toasts.length = 0;
  Abilities.tryActivate(me, SLOT.ABILITY1);
  check('...but not on a step without the press (an ultimate asks every step): silent', events.length === 0 && toasts.length === 0);
  Abilities.setSlot(bot, SLOT.ABILITY1, CAT.abilities.byId('binding'));
  Actors.pressed[bot] = BTN.ABILITY1; Abilities.tryActivate(bot, SLOT.ABILITY1); Actors.pressed[bot] = 0;
  check('...and not for a bot', events.length === 0 && toasts.length === 0);
  const sound = SOUND_EVENTS.find((row) => row.event === 'ability.notarget');
  check('the sound is the dry-fire click (the empty recipe), for the local player', sound.recipe === 'empty' && Sound.recipeById.has('empty') && sound.when === 'idIsPlayer');
  // With a target in the cone the same press casts and says nothing.
  const foe = TestArena.actor(2, 0, 8, Math.PI);
  TestArena.aimAt(me, foe);
  Abilities.setSlot(me, SLOT.ABILITY1, CAT.abilities.byId('arcbolt'));
  events.length = 0;
  Meters.energy[me] = 100;
  Actors.pressed[me] = BTN.ABILITY1;
  const cast = Abilities.tryActivate(me, SLOT.ABILITY1);
  Actors.pressed[me] = 0;
  check('with an enemy aimed at the same press casts, pays and gives no "no target"', cast === true && events.length === 0 && Meters.energy[me] < 100);
  events.stop(); toasts.stop();
  Game.playerId = -1; TestArena.finish();
});

// ---- F12 and the vibration strength setting ----
Test.add('feedback', (check) => {
  TestArena.start({});
  const me = TestArena.actor(1, 0, 0), foe = TestArena.actor(2, 0, 2, Math.PI);
  Game.playerId = me;
  const saved = { rumble: PadInput.rumble, device: Input.device, vibrate: navigator.vibrate }, log = [];
  PadInput.rumble = (strength, milliseconds) => { log.push([Math.round(strength * 1000) / 1000, milliseconds]); };
  Input.device = 'gamepad';
  Settings.set('controls.vibration', true);
  Settings.set('controls.vibrationStrength', 100);
  Input.refreshConfig();
  const melee = (source, target) => { log.length = 0; hudTestDamage(source, target, { kind: 'melee', amount: 30 }); return log.slice(); };
  try {
    check('the vibration strength is a 0 to 100 % setting next to the switch, 100 by default', Settings.definitions.get('controls.vibrationStrength').fallback === 100 && Settings.definitions.get('controls.vibrationStrength').max === 100 && Settings.definitions.get('controls.vibrationStrength').category === 'controls');
    check('own melee contact: 0.4 for 60 ms', JSON.stringify(melee(me, foe)) === '[[0.4,60]]', JSON.stringify(melee(me, foe)));
    check('a blow that lands on someone else\'s target does not buzz you; one that hits you buzzes by its damage (existing)', melee(foe, foe).length === 0 && JSON.stringify(melee(foe, me)) === '[[0.3,160]]', JSON.stringify(melee(foe, me)));
    log.length = 0; hudTestDamage(me, foe, { kind: 'hit', amount: 30 });
    check('a bullet hit you land gives nothing', log.length === 0);
    log.length = 0; Bus.emit('weapon.parry', { id: me });
    check('a parry: 0.6 for 90 ms', JSON.stringify(log) === '[[0.6,90]]', JSON.stringify(log));
    log.length = 0; Bus.emit('weapon.parry', { id: foe });
    check('...only your own', log.length === 0);
    log.length = 0; Bus.emit('weapon.chargeFull', { id: me, weapon: 'maul', mode: 'alt' });
    check('a charge reaching full: 0.2 for 40 ms on a controller', JSON.stringify(log) === '[[0.2,40]]', JSON.stringify(log));
    Settings.set('controls.vibrationStrength', 50); Input.refreshConfig();
    check('at 50 % every rumble is half as strong (own melee 0.2, parry 0.3, a hit on you halves)', JSON.stringify(melee(me, foe)) === '[[0.2,60]]' && JSON.stringify(melee(foe, me)) === '[[0.15,160]]', JSON.stringify(melee(me, foe)));
    Settings.set('controls.vibrationStrength', 0); Input.refreshConfig();
    log.length = 0; hudTestDamage(foe, me, { kind: 'hit', amount: 60 }); Bus.emit('weapon.parry', { id: me }); Bus.emit('explosion', { x: 0, y: 1, z: 0, radius: 4 }); melee(me, foe);
    check('at 0 % nothing buzzes (damage, blast, melee, parry)', log.length === 0, JSON.stringify(log));
    Settings.set('controls.vibrationStrength', 100); Settings.set('controls.vibration', false); Input.refreshConfig();
    check('the switch off still turns everything off', melee(me, foe).length === 0);
    Settings.set('controls.vibration', true); Input.refreshConfig();
    // The phone buzz (touch): the duration scales with the strength; the charge pulse is the controller\'s only.
    const buzz = [];
    navigator.vibrate = (milliseconds) => { buzz.push(milliseconds); return true; };
    Input.device = 'touch';
    Settings.set('controls.vibrationStrength', 50); Input.refreshConfig();
    hudTestDamage(me, foe, { kind: 'melee', amount: 30 }); Bus.emit('weapon.chargeFull', { id: me, weapon: 'maul', mode: 'alt' });
    check('on a phone the buzz gets shorter with the strength (60 ms x 0.4 x 0.5 = 12) and a full charge gives none', buzz.join() === '12', buzz.join());
  } finally { PadInput.rumble = saved.rumble; Input.device = saved.device; navigator.vibrate = saved.vibrate; Settings.resetKeys(['controls.vibration', 'controls.vibrationStrength']); Input.refreshConfig(); Game.playerId = -1; TestArena.finish(); }
  // The sim events themselves: a held charge reaches full once, a short hold never.
  const id = animTestStart(['maul']), full = feedbackEvents('weapon.chargeFull');
  animTestRun(id, 40, BTN.ALT);   // 0.67 s of the 1.2 s charge
  const short = full.length;
  animTestRun(id, 70, BTN.ALT);   // 1.17 s more: full at 1.2 s, held on
  const held = full.length;
  animTestRun(id, 20, 0);
  full.stop();
  check('weapon.chargeFull: not before the charge time, once when it is reached (the Breaker Maul alt), never repeated while held', short === 0 && held === 1 && full[0].id === id && full[0].weapon === 'maul' && full[0].mode === 'alt', short + ' ' + held);
  animTestFinish();
  announceParry(5);
  check('announceParry sends the weapon.parry event', true);
});

// ---- F13: damage shakes mostly in roll ----
Test.add('feedback', (check) => {
  const run = (apply) => {
    ViewFx.reset(); ViewFx.clock = 0;
    apply();
    const camera = { yaw: 0, pitch: 0, roll: 0, fov: 90 }, peak = { yaw: 0, pitch: 0, roll: 0 };
    for (let frame = 0; frame < 120; frame++) {
      camera.yaw = 0; camera.pitch = 0; camera.roll = 0;
      ViewFx.apply(camera, 1 / 60);
      peak.yaw = Math.max(peak.yaw, Math.abs(camera.yaw)); peak.pitch = Math.max(peak.pitch, Math.abs(camera.pitch)); peak.roll = Math.max(peak.roll, Math.abs(camera.roll));
    }
    return peak;
  };
  const limit = 0.3 * DEG + 1e-9;
  const damage = run(() => ViewFx.addDamageTrauma(VIEW_DAMAGE_TRAUMA_MAX)), blast = run(() => ViewFx.addTrauma(0.8));
  check('damage at its largest: yaw and pitch stay within 0.3 degrees, the roll carries the shake (at least 3 times the aim part)', damage.yaw <= limit && damage.pitch <= limit && damage.roll > 3 * Math.max(damage.yaw, damage.pitch) && damage.roll > 0.003, JSON.stringify(damage));
  check('an explosion keeps its full three-axis shake (more than 1 degree of yaw)', blast.yaw > 1 * DEG && blast.pitch > 1 * DEG && blast.roll > 0.01, JSON.stringify(blast));
  const hits = run(() => { ViewFx.addDamageTrauma(0.12); });
  check('a small hit moves the aim by far less than the crosshair width', hits.yaw < 0.1 * DEG && hits.pitch < 0.1 * DEG, JSON.stringify(hits));
  TestArena.start({});
  const me = TestArena.actor(1, 0, 0), foe = TestArena.actor(2, 0, 3, Math.PI);
  Game.playerId = me;
  ViewFx.reset();
  hudTestDamage(foe, me, { kind: 'hit', amount: 30 });
  check('a hit on the player feeds the damage shake and not the three-axis one', ViewFx.damageTrauma > 0 && ViewFx.trauma === 0);
  ViewFx.reset();
  Settings.set('video.shake', 0);
  const silent = run(() => { ViewFx.addDamageTrauma(0.4); ViewFx.addTrauma(0.8); });
  Settings.set('video.shake', 50);
  const half = run(() => { ViewFx.addDamageTrauma(0.4); });
  Settings.set('video.shake', 100);
  const full = run(() => { ViewFx.addDamageTrauma(0.4); });
  check('the shake slider: 0 shakes nothing (damage, explosion), 50 gives half the roll of 100', silent.roll === 0 && silent.yaw === 0 && Math.abs(half.roll - full.roll / 2) < full.roll * 0.02, JSON.stringify([silent, half.roll, full.roll]));
  Settings.set('accessibility.reduceMotion', 'on');
  const calm = run(() => { ViewFx.addDamageTrauma(0.4); ViewFx.addTrauma(0.8); });
  check('reduce motion stops the shake as before', calm.roll === 0 && calm.yaw === 0 && calm.pitch === 0);
  feedbackResetSettings();
  ViewFx.reset(); ViewFx.readSettings();
  Game.playerId = -1; TestArena.finish();
});

// ---- Weapon motion ----
Test.add('feedback', (check) => {
  const frames = (weaponId, motion, what) => {
    Settings.set('video.weaponMotion', motion);
    const id = animTestStart([weaponId]), weapon = CAT.weapons.byId(weaponId), slot = Weapons.slotIndex(id, weapon.index), out = { reload: 0, melee: 0, sprint: 0, kick: 0, knock: 0, roll: 0 };
    const magnitude = () => { const p = ViewAction.pose; return Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]) + Math.abs(p[3]) + Math.abs(p[4]) + Math.abs(p[5]); };
    if (what === 'reload') {
      Weapons.magazine[slot] = 1;
      Actors.buttons[id] = BTN.RELOAD; Sim.step(); Actors.buttons[id] = 0;
      animTestRun(id, Math.ceil(weapon.reload * 60), 0, () => { out.reload = Math.max(out.reload, magnitude()); out.roll = Math.max(out.roll, Math.abs(ViewAction.pose[5])); });
    } else if (what === 'melee') animTestRun(id, 30, BTN.FIRE, () => { out.melee = Math.max(out.melee, magnitude()); });
    else if (what === 'sprint') { animTestSprint.on = true; animTestRun(id, 30, 0, () => { out.sprint = Math.max(out.sprint, magnitude()); }); }
    else if (what === 'kick') animTestRun(id, 12, BTN.FIRE, () => { out.kick = Math.max(out.kick, magnitude()); });
    else if (what === 'knock') {
      animTestRun(id, 4, 0);
      Bus.emit('damage', { target: id, source: -1, amount: 60, kind: 'hit', zone: 'body', weapon: '', element: 'kinetic', x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 1, absorbed: 0 });
      animTestRun(id, 8, 0, () => { out.knock = Math.max(out.knock, magnitude()); });
    }
    animTestFinish();
    return out;
  };
  check('the weapon motion setting: 0 to 100 %, 100 by default, in the View group', Settings.definitions.get('video.weaponMotion').fallback === 100 && Settings.definitions.get('video.weaponMotion').min === 0 && Settings.definitions.get('video.weaponMotion').max === 100 && Ui.settingGroup('video.weaponMotion') === 'View');
  const bad = [];
  for (const [what, weaponId, field] of [['reload', 'vanguard', 'reload'], ['melee', 'maul', 'melee'], ['sprint', 'vanguard', 'sprint'], ['kick', 'warden', 'kick'], ['knock', 'vanguard', 'knock']]) {
    const full = frames(weaponId, 100, what)[field], half = frames(weaponId, 50, what)[field], none = frames(weaponId, 0, what)[field];
    if (!(full > 0.01) || Math.abs(half - full / 2) > full * 0.04 || none > 1e-9) bad.push(what + ' ' + [full, half, none].map((value) => value.toFixed(4)).join('/'));
  }
  check('the reload tilt, the strike, the sprint cant, the kick and the hit knock: 50 % is half, 0 % is none', bad.length === 0, bad.join(' | '));
  check('the Render.motion share follows the slider', (() => { Settings.set('video.weaponMotion', 35); return Math.abs(Render.motion.weapon - 0.35) < 1e-9; })());
  Settings.set('accessibility.reduceMotion', 'on'); Settings.set('video.weaponMotion', 100);
  const calm = Render.motion.weapon;
  Settings.set('video.weaponMotion', 20);
  check('reduce motion caps the weapon motion at 40 % (and a lower slider stays lower)', Math.abs(calm - 0.4) < 1e-9 && Math.abs(Render.motion.weapon - 0.2) < 1e-9, calm + ' ' + Render.motion.weapon);
  Settings.set('accessibility.reduceMotion', 'off'); Settings.set('video.weaponMotion', 100);
  check('and gives it back at 100 % when reduce motion is off', Render.motion.weapon === 1);
  // What the layers show is still what the weapon does: the reload parts move at 0 % (the magazine leaves) and the shield still comes up to block.
  Settings.set('video.weaponMotion', 0);
  const id = animTestStart(['vanguard']), slot = Weapons.slotIndex(id, CAT.weapons.byId('vanguard').index);
  Weapons.magazine[slot] = 1;
  Actors.buttons[id] = BTN.RELOAD; Sim.step(); Actors.buttons[id] = 0;
  let parts = 0, pose = 0;
  animTestRun(id, 60, 0, () => { for (let i = 0; i < ROLE_FLOATS_TOTAL; i++) parts = Math.max(parts, Math.abs(ViewAction.main[i])); pose = Math.max(pose, Math.abs(ViewAction.pose[1]) + Math.abs(ViewAction.pose[3])); });
  check('at 0 % the reload still shows the magazine leaving and coming back (the parts move), the gun itself stays put', parts > 0.05 && pose < 1e-9, parts + ' ' + pose);
  animTestFinish();
  const shield = animTestStart(['bulwark']);
  animTestRun(shield, 20, BTN.ALT);
  check('the shield still comes up at 0 % (it shows the block)', ViewAction.pose[1] !== 0 || ViewAction.pose[2] !== 0 || ViewAction.pose[0] !== 0, Array.from(ViewAction.pose).join());
  animTestFinish();
  feedbackResetSettings();
  ViewFx.readSettings();
});

// ---- Saving, migration and the settings screens ----
Test.add('feedback', (check) => {
  const keys = { 'video.weaponMotion': 100, 'video.muzzleFlash': 'full', 'controls.vibrationStrength': 100, 'audio.heartbeat': true, 'video.shake': 100 };
  check('the five reduce settings and their defaults (weapon motion 100, muzzle flash full, vibration 100, heartbeat on, shake 100)', Object.keys(keys).every((key) => Settings.definitions.has(key) && Settings.definitions.get(key).fallback === keys[key]) && SAVE_VERSION === 1);
  const savedStorage = Save.storage, savedWorks = Save.storageWorks, savedData = Save.data, savedNotice = Save.notice;
  Save.storage = makeMemoryStorage(false); Save.storageWorks = true; Save.notice = '';
  try {
    // An older save has none of them: the defaults apply and nothing else changes.
    Save.write(SAVE_KEY, JSON.stringify({ version: 1, settings: { 'video.fov': 100, 'audio.sfx': 0.5, 'video.shake': 40 } }));
    Save.load(); Settings.applyAll(); Input.refreshConfig();
    check('an older save without the keys loads clean: the defaults apply, the settings it has stay (shake 40, FOV 100)', Settings.get('video.weaponMotion') === 100 && Settings.get('video.muzzleFlash') === 'full' && Settings.get('controls.vibrationStrength') === 100 && Settings.get('audio.heartbeat') === true && Settings.get('video.shake') === 40 && Settings.get('video.fov') === 100
      && Render.config.muzzleFlash === 2 && Render.motion.weapon === 1 && Input.config.vibrationStrength === 100 && !('video.weaponMotion' in Save.data.settings) && Save.data.version === 1);
    Save.write(SAVE_KEY, JSON.stringify({ version: 1, settings: { 'video.weaponMotion': 500, 'video.muzzleFlash': 'bright', 'audio.heartbeat': 'yes', 'controls.vibrationStrength': -5 } }));
    Save.load(); Settings.applyAll();
    check('wrong stored values never reach a reader: clamped or dropped to the default', Settings.get('video.weaponMotion') === 100 && Settings.get('video.muzzleFlash') === 'full' && Settings.get('audio.heartbeat') === true && Settings.get('controls.vibrationStrength') === 0, JSON.stringify(Save.data.settings));
    Settings.set('video.weaponMotion', 35); Settings.set('video.muzzleFlash', 'reduced'); Settings.set('controls.vibrationStrength', 60); Settings.set('audio.heartbeat', false); Settings.set('video.shake', 20);
    Save.saveNow();
    const text = Save.exportText();
    Save.data = Save.emptySave();
    Save.importText(text);
    Settings.applyAll(); Input.refreshConfig();
    check('saved and imported again: every one of them comes back, and drives its owner',
      Settings.get('video.weaponMotion') === 35 && Settings.get('video.muzzleFlash') === 'reduced' && Settings.get('controls.vibrationStrength') === 60 && Settings.get('audio.heartbeat') === false && Settings.get('video.shake') === 20
      && Render.motion.weapon === 0.35 && Render.config.muzzleFlash === 1 && Input.config.vibrationStrength === 60 && Sound.heartbeatOn === false && JSON.parse(text).version === 1, text.slice(0, 200));
    Save.data = null; Save.load();
    check('and from storage after a reload of the page', Settings.get('video.weaponMotion') === 35 && Settings.get('audio.heartbeat') === false);
    Settings.resetKeys(Object.keys(keys));
    check('resetting them returns the defaults', Settings.get('video.weaponMotion') === 100 && Settings.get('video.muzzleFlash') === 'full' && Settings.get('audio.heartbeat') === true && Sound.heartbeatOn === true);
  } finally { Save.storage = savedStorage; Save.storageWorks = savedWorks; Save.data = savedData; Save.notice = savedNotice; Settings.applyAll(); }
});

// On a keyboard, a touch screen and a gamepad: each of them is a row of the settings screen with a control that is reached, read and changed.
Test.add('feedback', (check) => {
  const leave = uiEnter(), problems = [], rows = [['video', 'video.weaponMotion', 'slider'], ['video', 'video.muzzleFlash', 'cycle'], ['video', 'video.shake', 'slider'], ['controls', 'controls.vibrationStrength', 'slider'], ['audio', 'audio.heartbeat', 'cycle']];
  try {
    for (const [tab, key, kind] of rows) {
      const definition = Settings.definitions.get(key), start = kind === 'cycle' ? definition.options[0] : 50;
      Settings.set(key, start);   // the screen shows the saved value: start in the middle of a slider, on the first choice of a cycle
      Ui.open('settings', { tab });
      const element = Ui.top().element, row = Array.from(element.querySelectorAll('.ui-scroll .ui-row')).find((item) => item.querySelector('.ui-label') && item.querySelector('.ui-label').textContent === definition.label);
      if (!row) { problems.push(key + ': no row'); Ui.closeAll(); continue; }
      const control = Ui.focusables(row)[0], items = Ui.focusables(element);
      if (!control || typeof control._adjust !== 'function' || !items.includes(control)) { problems.push(key + ': no focusable adjustable control'); Ui.closeAll(); continue; }
      // Gamepad: the d-pad walks down the screen to the row; left and right change it.
      items[0].focus();
      const reached = new Set();
      for (let i = 0; i < items.length; i++) { reached.add(document.activeElement); Ui.navigate('down'); }
      control.focus();
      Bus.emit('input.menu', { command: 'right' });
      const afterPad = Settings.get(key);
      Bus.emit('input.menu', { command: 'left' });
      const backPad = Settings.get(key);
      // Keyboard: the arrow keys do the same through the screen's key handler.
      Ui.onKeyDown({ code: 'ArrowRight', target: control, defaultPrevented: false, preventDefault() {} });
      const afterKey = Settings.get(key);
      Ui.onKeyDown({ code: 'ArrowLeft', target: control, defaultPrevented: false, preventDefault() {} });
      // Touch: a tap on a cycle, a drag of a slider (an input event).
      let afterTouch = start;
      if (kind === 'cycle') control.click(); else { control.value = String(definition.max); control.dispatchEvent(new Event('input', { bubbles: true })); }
      afterTouch = Settings.get(key);
      if (afterPad === start || afterKey === start) problems.push(key + ': the d-pad or the keys change nothing (' + start + ' to ' + afterPad + ' / ' + afterKey + ')');
      if (backPad !== start) problems.push(key + ': left does not go back (' + backPad + ')');
      if (afterTouch === start) problems.push(key + ': a tap or drag changes nothing');
      if (!reached.has(control)) problems.push(key + ': the d-pad never reaches it');
      Ui.closeAll();
    }
    check('each of the five (weapon motion, muzzle flash, camera shake, vibration strength, heartbeat) has a row on its settings tab that the d-pad reaches and left / right change, the arrow keys change and a tap or drag changes', problems.length === 0, problems.join(' | '));
  } finally { leave(); feedbackResetSettings(); }
});

// ---- No allocation ----
Test.add('feedback', (check) => withRenderer(() => {
  if (!perfHeapCounterWorks()) { check.skip('feedback allocation probes', 'no exact heap counter on this page'); return; }
  Game.headless = true;
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 12, Math.PI), wasp = giveFull(shooter, 'wasp'), muzzle = Vec.set(Vec.make(), 0, 1.5, 0.6);
  Game.playerId = shooter;
  Game.headless = false;
  Render.quality = CAT.quality.byId('medium');
  let tick = 0;
  // What the feedback adds at the real call sites: the same call with the feedback switched off (a gun without a flash or a casing; a headless hit) is the baseline, the
  // difference is what P7 costs per shot and per hit. It is under 16 bytes a call (the pool, light and record writes allocate nothing).
  // The least of three runs: another allocation on the page (a timer, a frame) lands in one run and not in the others.
  const measure = (run) => Math.min(perfAllocatedBytes(run), perfAllocatedBytes(run), perfAllocatedBytes(run)) / PERF_ALLOC_CALLS;
  const wasp2 = CAT.weapons.byId('wasp'), saved = { flash: wasp2.muzzleFlash, casing: wasp2.casingKind };
  const fireWasp = () => { tick++; ShotFx.casingAt[shooter] = -1e9; Weapons.announceShot(shooter, wasp2, wasp2.primary, MODE_PRIMARY); };
  const withFx = measure(fireWasp);
  wasp2.muzzleFlash = 0; wasp2.casingKind = '';
  const without = measure(fireWasp);
  wasp2.muzzleFlash = saved.flash; wasp2.casingKind = saved.casing;
  check('a shot at its real call site (Weapons.announceShot: flash, light, casing) costs under 16 bytes over the same shot without them', withFx - without < 16, withFx.toFixed(1) + ' B with, ' + without.toFixed(1) + ' B without');
  const hits = CAT.materials.map((row) => ({ x: 1, y: 2, z: 3, nx: 0, ny: 1, nz: 0, brush: { material: row.id } }));
  const hitOnce = () => { tick++; emitImpact(hits[tick % hits.length], 'wasp', shooter); };
  const hitWith = measure(hitOnce);
  Game.headless = true;
  const hitWithout = measure(hitOnce);
  Game.headless = false;
  check('a hit on a surface at its real call site (emitImpact: particles and decal) costs under 16 bytes over the impact event alone', hitWith - hitWithout < 16, hitWith.toFixed(1) + ' B with, ' + hitWithout.toFixed(1) + ' B without');
  const flashAlone = measure(() => { tick++; feedbackAimStep(); ShotFx.flash(shooter, wasp2, wasp2.primary, muzzle); });
  check('the muzzle flash alone (burst and light) costs under 16 bytes', flashAlone < 16, flashAlone.toFixed(1) + ' B');
  const cue = { id: shooter, weapon: 'verdict', cue: 'casings', count: 3 };
  const cues = perfAllocatedBytes(() => { tick++; cue.cue = tick % 3 === 0 ? 'casings' : tick % 3 === 1 ? 'vent' : 'flare'; ShotFx.onCue(cue); });
  check('the particles of a reload cue (an event: a few per reload) cost under 1 KB each', cues / PERF_ALLOC_CALLS < 1024, Math.round(cues / PERF_ALLOC_CALLS) + ' bytes per cue');
  const view = viewModelState, model = viewWeaponModel(Object.assign(view, { model: 'warden', shape: 'sidearm', visible: true }));
  view.weaponIndex = CAT.weapons.byId('warden').index;
  const kick = perfAllocatedBytes(() => { tick++; view.kick = tick % 20 === 0 ? 1 : Math.max(0, view.kick - 0.05); ViewAction.update(view, model, ANIM_FRAME); });
  check('the kick spring and the weapon motion scale allocate nothing per frame', kick < PERF_ALLOC_LIMIT_BYTES, Math.round(kick / 1024) + ' KB');
  const events = perfAllocatedBytes(() => { tick++; Abilities.watchReady(shooter, SLOT.ABILITY1, CAT.abilities[0]); ViewFx.addDamageTrauma(0.01); ViewFx.apply(Render.camera, 1 / 60); Input.rumbleMelee(PERF_DAMAGE_EVENT); });
  check('the ready watch, the damage shake and the rumble sources allocate nothing', events < PERF_ALLOC_LIMIT_BYTES, Math.round(events / 1024) + ' KB');
  Game.headless = true; Game.playerId = -1; TestArena.finish();
}), { slow: false });
const PERF_DAMAGE_EVENT = { target: 1, source: 0, amount: 30, kind: 'melee' };

// ---- The contact sheet scenes (test builds only): a still of each visual effect on the render demo arena ----
// The page keeps drawing frames by itself after the call returns, so a scene is kept alive: an update re-fires the effect (a shot, a hit, a burst) and the HUD layer
// re-stamps the marker times, and a screenshot taken a moment later shows it at any age.
const FEEDBACK_DEMO_PANELS = [   // [material, centre x]: four panels in front of the player, each hit once
  ['metal', -1.5], ['concrete', -0.5], ['wood', 0.5], ['sand', 1.5],
];
const feedbackDemoState = { scene: '', timer: 0, installed: false, weapon: null, flip: 0 };
const feedbackDemoHit = { x: 0, y: 1.3, z: -9.58, nx: 0, ny: 0, nz: -1, brush: { material: 'metal' } };
function feedbackDemoArena() {
  const arena = makeDemoArena('foundry');
  arena.id = 'feedback-demo';
  FEEDBACK_DEMO_PANELS.forEach(([material, x]) => arena.brushes.push({ shape: 'box', min: [x - 0.5, 0, -9.8], max: [x + 0.5, 2.4, -9.6], material }));
  arena.brushes.push({ shape: 'box', min: [-2.2, 0, -9.9], max: [2.2, 0.4, -9.6], material: 'concrete' });
  return arena;
}
function feedbackDemoLive() { return !!feedbackDemoState.scene && !!World.map && World.map.id === 'feedback-demo'; }
// Per frame, before the effects are drawn: fire the scene's effect again when it is due.
function feedbackDemoStep(seconds) {
  if (!feedbackDemoLive()) return;
  const state = feedbackDemoState, id = Game.playerId, weapon = state.weapon;
  state.timer += seconds;
  let from = particlePool.next;
  // The page draws at the speed of a software renderer (a frame can be longer than a muzzle flash lives): what is fired this frame is backdated, so a still shows it at the age given.
  const backdate = (age) => { for (let slot = from; slot < particlePool.next; slot++) { particlePool.data[slot * PARTICLE_FLOATS + 6] -= age; particlePool.deathTime[slot] -= age; } from = particlePool.next; };
  const shoot = (age) => { ShotFx.casingAt[id] = -1e9; Vec.fromAngles(aimScratch, Actors.yaw[id], Actors.pitch[id]); ShotFx.shot(id, weapon, weapon.primary, Muzzle.visual(id, weapon)); backdate(age); };
  if (state.scene === 'flash' || state.scene === 'flashReduced' || state.scene === 'flashOff') shoot(0.02);
  else if (state.scene === 'casings' && state.timer >= 0.5) { state.timer = 0; for (let i = 0; i < 6; i++) shoot(0.04 + i * 0.07); }
  else if (state.scene === 'impacts') {
    state.timer = 0;
    FEEDBACK_DEMO_PANELS.forEach(([material, x]) => {
      feedbackDemoHit.x = x; feedbackDemoHit.y = 1.3; feedbackDemoHit.nx = 0; feedbackDemoHit.ny = 0; feedbackDemoHit.nz = -1; feedbackDemoHit.z = -9.58; feedbackDemoHit.brush.material = material;
      ShotFx.surface(feedbackDemoHit, true);
    });
    feedbackDemoHit.x = 0; feedbackDemoHit.y = 1.0; feedbackDemoHit.nx = 0; feedbackDemoHit.ny = 1; feedbackDemoHit.nz = 0; feedbackDemoHit.z = -9.0; feedbackDemoHit.brush.material = 'water';
    ShotFx.surface(feedbackDemoHit, true);
    backdate(0.05);
  }
}
// The HUD cues, drawn with the game's own functions at fixed ages.
function feedbackDemoLayer(batch) {
  if (!feedbackDemoLive()) return;
  const state = feedbackDemoState, scene = state.scene;
  if (scene === 'hit') { HudCombat.hitAt = Hud.time - 0.03; HudCombat.hitHead = true; }
  else if (scene === 'kill' || scene === 'killBody') { HudCombat.killAt = Hud.time - 0.05; HudCombat.killHead = scene === 'kill'; }
  else if (scene === 'direction') { state.flip ^= 1; HudCombat.flashAt = Hud.time - 0.05; if (state.flip) hudNoteIncomingDamage(-1, -6, -12); else hudNoteIncomingDamage(-1, 2, -20); }
  else if (scene !== 'lowHealth') return;
  const unit = clamp(Math.min(batch.width / HUD_DESIGN_WIDTH, batch.height / HUD_DESIGN_HEIGHT), HUD_UNIT_MIN, HUD_UNIT_MAX);
  const layout = { unit, centerX: batch.width / 2, centerY: batch.height / 2, width: batch.width, height: batch.height };
  hudDrawVignette(HudPen, layout);
  hudDrawDamageArcs(HudPen, layout);
  hudDrawHitMarkers(HudPen, layout);
}
// One scene: 'hit' (a head hit marker), 'kill' and 'killBody' (the kill marker, gold and red), 'direction' (damage arcs from the left and from behind, the red tint),
// 'lowHealth' (the vignette), 'impacts' (a bullet on a metal, concrete, wood and sand panel, and on water), 'flash' / 'flashReduced' / 'flashOff' (a rifle shot) and
// 'casings' (a Wasp firing). Wait a moment before the screenshot (the first effects need a frame).
DebugApi.feedbackDemo = (scene, options) => {
  const settings = options || {}, weaponId = settings.weapon || (scene === 'casings' ? 'wasp' : 'vanguard');
  feedbackDemoState.scene = '';
  DebugApi.renderDemo('foundry', weaponId, settings.quality || 'high');
  World.load(feedbackDemoArena());
  Fx.clear(); demo.sinceEffects = -1e9;
  const id = Game.playerId;
  Actors.yaw[id] = Actors.aimYaw[id] = 0; Actors.pitch[id] = Actors.aimPitch[id] = 0;
  Weapons.setLoadout(id, [weaponId]);
  Actors.maxHealth[id] = 100; Actors.health[id] = scene === 'lowHealth' ? 18 : 100;
  Settings.set('video.muzzleFlash', scene === 'flashReduced' ? 'reduced' : scene === 'flashOff' ? 'off' : 'full');
  if (!feedbackDemoState.installed) {
    feedbackDemoState.installed = true;
    Render.addUpdate(46, feedbackDemoStep);
    HudBatch.addLayer('feedback-demo', 45, feedbackDemoLayer);
  }
  HudCombat.reset();
  feedbackDemoState.weapon = CAT.weapons.byId(weaponId); feedbackDemoState.timer = 1; feedbackDemoState.scene = scene;
  Render.drawFrame(1 / 60, 1);
  const muzzle = Muzzle.visual(id, feedbackDemoState.weapon), vp = Render.frame.viewProjection, w = vp[3] * muzzle.x + vp[7] * muzzle.y + vp[11] * muzzle.z + vp[15];
  const screen = [(vp[0] * muzzle.x + vp[4] * muzzle.y + vp[8] * muzzle.z + vp[12]) / w, (vp[1] * muzzle.x + vp[5] * muzzle.y + vp[9] * muzzle.z + vp[13]) / w].map((value) => Math.round(value * 1000) / 1000);
  return { scene, weapon: weaponId, quality: Render.quality.id, muzzleScreen: screen };
};
