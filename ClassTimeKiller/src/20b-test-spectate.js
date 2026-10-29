// Self-tests for P2-01 (group 'spectate'): a dead player who cannot respawn (and a match without a player) can follow the living
// players and cycle through them, switch to a free camera, hear from the view, and it all ends at a respawn or the end of the match.

DebugApi.spectate = Spectate;

const SPECTATE_TEST_STEP = 1 / 60;
const SPECTATE_TEST_FLOOR = { shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] };
const SPECTATE_TEAM_MODES = ['bomb', 'elim', 'ghostops'];
// Modes whose player cannot respawn once killed: id, bot teams, and what the test does first (lms: one life left).
const SPECTATE_NO_RESPAWN = [
  { mode: 'bomb', teams: [0, 0, 1, 1] }, { mode: 'elim', teams: [0, 0, 1, 1] }, { mode: 'ghostops', teams: [0, 0, 1, 1] },
  { mode: 'royale', teams: [-1, -1, -1] }, { mode: 'lms', teams: [-1, -1, -1], lastLife: true }, { mode: 'fiends', teams: [1, 1] },
];

function spectateTestMap(mode, extra) {
  const spawns = SPECTATE_TEAM_MODES.includes(mode) || mode === 'tdm' || mode === 'fiends' ? TEAM_SPAWNS : FFA_SPAWNS;
  return modesTestMap(Object.assign(mode === 'bomb' || mode === 'ghostops' ? { spawns, objectives: BOMB_MAP.objectives } : { spawns }, extra));
}

// Starts the mode with the player (team 0, when it has teams) and one bot per entry of teams, bots of the kind a spectator can follow.
function spectateTestStart(mode, teams, extra, withPlayer) {
  const options = SPECTATE_TEAM_MODES.concat(['fiends']).includes(mode) ? { modeOptions: { rounds: { freeze: 1, endDelay: 1, live: 60, winsNeeded: 3 } } } : {};
  World.load(spectateTestMap(mode, extra));
  Game.start(Object.assign({ mode, seed: 1, bots: teams.map((team) => ({ dummy: true, team })) }, withPlayer === false ? {} : { player: { name: 'Me', team: teams.includes(-1) ? -1 : 0 } }, options));
  Sim.run(TICK_RATE * 2);
  const ids = [];
  for (let id = 0; id < Actors.count; id++) {
    if (id === Game.playerId || !Modes.participant[id]) continue;
    Actors.kind[id] = ACTOR_KIND.BOT;
    Modes.endProtection(id);
    ids.push(id);
  }
  return ids;
}
function spectateTestPlace(id, x, z, yaw) {
  Actors.place(id, x, 0, z);
  Actors.yaw[id] = Actors.prevYaw[id] = Actors.aimYaw[id] = yaw || 0;
  Actors.pitch[id] = Actors.prevPitch[id] = 0;
}
function spectateTestPress(action) {
  const index = Input.actionIndex[action];
  Input.pressAction(index);
  Input.releaseAction(index);
}
function spectateTestFrame(seconds) { Input.frame(seconds === undefined ? SPECTATE_TEST_STEP : seconds); }
function spectateTestCamera() {
  const camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 1, fov: 90 };
  Render.view.alpha = 1;
  Hud.frameSeconds = 0;
  return Render.cameraOverride(camera) ? camera : null;
}
// Kills the player without a replay and runs one input frame.
function spectateTestKill(killer) {
  Killcam.enabled = false;
  killActor(Game.playerId, killer);
  spectateTestFrame();
}
function spectateTestEnd(savedKillcam) {
  Spectate.stop();
  Input.clearAll();
  Killcam.enabled = savedKillcam;
  endModeTest();
}

// Every mode without a respawn: the dead player follows, cycles, flies and ends at the respawn.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled;
  for (const row of SPECTATE_NO_RESPAWN) {
    const mode = row.mode, bots = spectateTestStart(mode, row.teams);
    const player = Game.playerId;
    if (row.lastLife) Modes.lives[player] = 1;
    check(mode + ': the player is alive and not spectating', player >= 0 && Actors.alive[player] === 1 && !Spectate.active && !Spectate.wanted());
    spectateTestKill(bots[0]);
    check(mode + ': no respawn will come', Modes.respawnIn(player, Sim.time) === -1, Modes.respawnIn(player, Sim.time));
    check(mode + ': the spectator starts and follows a living player', Spectate.active && !Spectate.free && Spectate.target >= 0 && Actors.alive[Spectate.target] === 1 && Spectate.target !== player, Spectate.target);
    check(mode + ': the camera is the spectator\'s', spectateTestCamera() !== null && Input.spectating);
    const first = Spectate.target;
    spectateTestPress('fire');
    spectateTestFrame();
    const second = Spectate.target;
    spectateTestPress('alt');
    spectateTestFrame();
    check(mode + ': Fire follows the next player and Alt goes back', Spectate.count > 1 ? second !== first && Spectate.target === first : true, first + ' ' + second + ' ' + Spectate.target);
    spectateTestPress('reload');
    spectateTestFrame();
    check(mode + ': Reload switches to the free camera', Spectate.free && Spectate.target < 0 && spectateTestCamera() !== null);
    const before = Vec.copy(Vec.make(), Spectate.fly);
    Input.pressAction(Input.actionIndex.forward);
    spectateTestFrame(0.25);
    Input.releaseAction(Input.actionIndex.forward);
    check(mode + ': the free camera flies', distanceSquared3(before.x, before.y, before.z, Spectate.fly.x, Spectate.fly.y, Spectate.fly.z) > 1);
    spectateTestPress('reload');
    spectateTestFrame();
    check(mode + ': Reload follows a player again', !Spectate.free && Spectate.target >= 0);
    spectateTestPress('fire');
    spectateTestFrame();
    Modes.spawnActor(player);
    check(mode + ': a respawn ends it (camera and flags back)', !Spectate.active && !Input.spectating && spectateTestCamera() === null && !TouchInput.flags.spectate);
    spectateTestEnd(savedKillcam);
  }
});

// Modes that respawn the player are left alone.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled;
  for (const [mode, teams] of [['tdm', [0, 1, 0, 1]], ['ffa', [-1, -1, -1]], ['dom', [0, 1]]]) {
    const bots = spectateTestStart(mode, teams);
    spectateTestKill(bots[0]);
    check(mode + ': a player who respawns is not a spectator', Modes.respawnIn(Game.playerId, Sim.time) >= 0 && !Spectate.active && spectateTestCamera() === null);
    spectateTestEnd(savedKillcam);
  }
  const savedPlayer = Game.playerId;
  check('no match: nothing to spectate', savedPlayer < 0 || !Spectate.wanted());
});

// Who can be followed: teammates first, everybody once none is left, never dummies, PvE enemies or the dead.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled;
  const bots = spectateTestStart('elim', [0, 0, 1, 1]);
  const [mateA, mateB, foeA, foeB] = bots, player = Game.playerId;
  [[mateA, -6], [mateB, 6], [foeA, -20], [foeB, 20]].forEach(([id, x]) => spectateTestPlace(id, x, 10, 0));
  Actors.kind[foeB] = ACTOR_KIND.DUMMY;
  spectateTestKill(foeA);
  const list = () => Array.from(Spectate.targets.subarray(0, Spectate.count));
  check('team mode: the cycle holds the living teammates only', list().join() === [mateA, mateB].join() && Spectate.target === mateA, list().join() + ' target ' + Spectate.target);
  check('the nearest teammate to the death point is followed first', Spectate.target === Spectate.nearest(Actors.x[player], Actors.y[player], Actors.z[player]));
  spectateTestPress('nextWeapon');
  spectateTestFrame();
  check('the next-weapon control also picks the next player', Spectate.target === mateB);
  spectateTestPress('prevWeapon');
  spectateTestFrame();
  check('the previous-weapon control goes back', Spectate.target === mateA);
  spectateTestPress('alt');
  spectateTestFrame();
  check('the cycle wraps around', Spectate.target === mateB);
  Actors.alive[mateB] = 0;
  spectateTestFrame();
  check('a followed player who dies hands the view to the next one', Spectate.target === mateA && list().join() === String(mateA));
  Actors.alive[mateA] = 0;
  spectateTestFrame();
  check('with no teammate left everybody living can be followed (not the dummy)', list().join() === String(foeA) && Spectate.target === foeA && !Spectate.free, list().join());
  Actors.alive[foeA] = 0;
  spectateTestFrame();
  check('with nobody left to follow the camera is free', Spectate.free && Spectate.count === 0 && spectateTestCamera() !== null);
  spectateTestPress('fire');
  spectateTestFrame();
  check('Fire with nobody to follow keeps the free camera', Spectate.free);
  Actors.alive[mateA] = 1;
  spectateTestPress('fire');
  spectateTestFrame();
  check('Fire in the free camera follows the nearest player', !Spectate.free && Spectate.target === mateA);
  spectateTestEnd(savedKillcam);
});

// The chase camera: behind and above, with the followed player's aim, pulled in by a wall, glided to a new target.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled;
  const wall = { shape: 'box', min: [-5, 0, 7], max: [5, 6, 7.4] };
  const bots = spectateTestStart('elim', [0, 0, 1], { brushes: [SPECTATE_TEST_FLOOR, wall] });
  bots.forEach((id, index) => spectateTestPlace(id, 20 + index * 12, 10, 0));
  spectateTestKill(bots[2]);
  Spectate.snap = true;
  let camera = spectateTestCamera();
  const target = Spectate.target, eye = Actors.y[target] + Actors.eye[target];
  check('follow: the camera sits behind the player and above their eye, with their aim', camera && Test.near(camera.x, Actors.x[target], 0.01) && Test.near(camera.z, Actors.z[target] - SPECTATE_FOLLOW_DISTANCE, 0.05)
    && Test.near(camera.y, eye + SPECTATE_FOLLOW_LIFT, 0.05) && Test.near(camera.yaw, 0, 1e-6) && camera.roll === 0, JSON.stringify(camera));
  Actors.yaw[target] = Actors.prevYaw[target] = Math.PI / 2;
  Actors.pitch[target] = Actors.prevPitch[target] = 1.2;
  Spectate.snap = true;
  camera = spectateTestCamera();
  check('follow: the camera looks where they look (yaw) and the tilt is capped', Test.near(camera.yaw, Math.PI / 2, 1e-6) && Test.near(camera.pitch, SPECTATE_FOLLOW_MAX_PITCH, 1e-6) && camera.x < Actors.x[target] - 1);
  Actors.yaw[target] = Actors.prevYaw[target] = 0;
  Actors.pitch[target] = Actors.prevPitch[target] = 0;
  spectateTestPlace(target, 0, 8, 0);   // the wall (z 7 to 7.4) stands 0.6 m behind its back
  Spectate.snap = true;
  camera = spectateTestCamera();
  check('follow: a wall behind the player pulls the camera in front of it', camera.z > 7.4 && camera.z < Actors.z[target] - SPECTATE_MIN_DISTANCE + 0.01, camera.z);
  const other = bots.find((id) => id !== target);
  spectateTestPlace(other, 12, 10, 0);
  spectateTestPlace(target, 0, 10, 0);
  Spectate.snap = true;
  const before = spectateTestCamera();
  Hud.frameSeconds = SPECTATE_TEST_STEP;
  Spectate.follow(other);
  const next = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 90 };
  Render.cameraOverride(next);
  check('follow: a new target is glided to, not jumped to', next.x > before.x + 0.5 && next.x < Actors.x[other] - 3, next.x + ' from ' + before.x);
  for (let frame = 0; frame < 120; frame++) Render.cameraOverride(next);
  check('follow: and reached after a moment', Test.near(next.x, Actors.x[other], 0.1) && Test.near(next.z, Actors.z[other] - SPECTATE_FOLLOW_DISTANCE, 0.1), next.x + ' ' + next.z);
  spectateTestPlace(other, 90, 10, 0);
  Render.cameraOverride(next);
  check('follow: a target far away (a respawn across the map) is jumped to', Test.near(next.x, 90, 0.1));
  spectateTestEnd(savedKillcam);
});

// The free camera: moves along the look direction, Jump / Crouch go up and down, Sprint is faster, the map bounds hold, the look turns it.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled;
  const bots = spectateTestStart('elim', [0, 0, 1, 1]);
  spectateTestKill(bots[3]);
  spectateTestPress('reload');
  spectateTestFrame();
  const fly = Spectate.fly, start = Vec.copy(Vec.make(), fly);
  Input.setAim(0, 0);
  Input.pressAction(Input.actionIndex.forward);
  spectateTestFrame(0.5);
  check('free: forward flies along the look direction at the free speed', Test.near(fly.z - start.z, SPECTATE_FREE_SPEED * 0.5, 0.01) && Test.near(fly.x, start.x, 0.01) && Test.near(fly.y, start.y, 0.01), JSON.stringify(fly));
  Input.releaseAction(Input.actionIndex.forward);
  Input.pressAction(Input.actionIndex.right);
  const rightBefore = Vec.copy(Vec.make(), fly);
  spectateTestFrame(0.5);
  Input.releaseAction(Input.actionIndex.right);
  check('free: strafing right goes to the right of the view (yaw 0: -x)', Test.near(rightBefore.x - fly.x, SPECTATE_FREE_SPEED * 0.5, 0.01) && Test.near(fly.z, rightBefore.z, 0.01));
  Input.setAim(0, Math.PI / 4);
  const pitched = Vec.copy(Vec.make(), fly);
  Input.pressAction(Input.actionIndex.forward);
  spectateTestFrame(0.2);
  Input.releaseAction(Input.actionIndex.forward);
  check('free: looking up and moving forward flies up', fly.y - pitched.y > 1 && fly.z > pitched.z);
  const level = Vec.copy(Vec.make(), fly);
  Input.pressAction(Input.actionIndex.jump);
  spectateTestFrame(0.2);
  Input.releaseAction(Input.actionIndex.jump);
  Input.pressAction(Input.actionIndex.crouch);
  spectateTestFrame(0.1);
  Input.releaseAction(Input.actionIndex.crouch);
  check('free: Jump goes up and Crouch down', Test.near(fly.y - level.y, SPECTATE_FREE_SPEED * 0.1, 0.01), fly.y - level.y);
  Input.setAim(0, 0);
  const slow = Vec.copy(Vec.make(), fly);
  Input.pressAction(Input.actionIndex.sprint);
  Input.pressAction(Input.actionIndex.forward);
  spectateTestFrame(0.1);
  Input.releaseAction(Input.actionIndex.forward);
  Input.releaseAction(Input.actionIndex.sprint);
  check('free: Sprint flies faster', Test.near(fly.z - slow.z, SPECTATE_FREE_SPEED * SPECTATE_FREE_SPRINT * 0.1, 0.01));
  Input.pressAction(Input.actionIndex.forward);
  for (let frame = 0; frame < 120; frame++) spectateTestFrame(0.1);
  Input.releaseAction(Input.actionIndex.forward);
  check('free: the camera stays inside the map bounds', fly.z <= World.boundsMax.z + SPECTATE_BOUNDS_MARGIN + 1e-6 && fly.y >= World.boundsMin.y && fly.y <= World.boundsMax.y + SPECTATE_CEILING, JSON.stringify(fly));
  Input.addLook(0.3, 0.2, false);
  spectateTestFrame();
  const camera = spectateTestCamera();
  check('free: the look turns the view (mouse to the right lowers the yaw)', camera.yaw < -0.2 && camera.x === fly.x && camera.y === fly.y && camera.z === fly.z);
  spectateTestEnd(savedKillcam);
});

// A match without a local player: the spectator follows from the first frame, looks with the mouse and flies.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled;
  const bots = spectateTestStart('tdm', [0, 1, 0, 1], {}, false);
  check('no player: the match has none', Game.playerId < 0 && bots.length === 4);
  spectateTestFrame();
  check('no player: the spectator follows a bot at once', Spectate.active && !Spectate.free && bots.includes(Spectate.target) && spectateTestCamera() !== null);
  const first = Spectate.indexOfTarget(Spectate.target);
  spectateTestPress('fire');
  spectateTestFrame();
  check('no player: Fire follows the next bot', Spectate.count === 4 && Spectate.indexOfTarget(Spectate.target) === (first + 1) % 4);
  spectateTestPress('reload');
  spectateTestFrame();
  Input.addLook(-0.4, 0, false);
  spectateTestFrame();
  check('no player: the free camera turns with the mouse', Spectate.free && Test.near(Input.aim.yaw, wrapAngle(Spectate.view.yaw + 0.4), 0.05) && Input.spectating, Input.aim.yaw + ' ' + Spectate.view.yaw);
  Input.pressAction(Input.actionIndex.forward);
  const start = Vec.copy(Vec.make(), Spectate.fly);
  spectateTestFrame(0.2);
  Input.releaseAction(Input.actionIndex.forward);
  check('no player: and flies', distanceSquared3(start.x, start.y, start.z, Spectate.fly.x, Spectate.fly.y, Spectate.fly.z) > 1);
  Game.end(0);
  check('the end of the match ends it', !Spectate.active && !Input.spectating && spectateTestCamera() === null);
  spectateTestEnd(savedKillcam);
});

// The killcam plays first and hands over; presses that skip it are not a switch; the audio listener rides the view.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled;
  const bots = spectateTestStart('elim', [0, 0, 1, 1]);
  bots.forEach((id, index) => spectateTestPlace(id, index * 8 - 12, 10, 0));
  Killcam.enabled = true;
  Sim.run(KILLCAM_STEP_TICKS * 20);
  killActor(Game.playerId, bots[3]);
  check('killcam: the replay starts for a kill by another player', Killcam.playing);
  spectateTestFrame();
  check('killcam: the spectator is ready under it', Spectate.active && !TouchInput.flags.spectate);
  const camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 90 }, killerEye = Killcam.sample(bots[3], Killcam.startTime).x;
  Render.view.alpha = 1; Hud.frameSeconds = 0;
  check('killcam: its camera is used while it plays', Render.cameraOverride(camera) && Test.near(camera.x, killerEye, 0.5) && Killcam.playing);
  const target = Spectate.target;
  spectateTestPress('fire');
  spectateTestFrame();
  check('killcam: a press that skips the replay does not change the player followed', Spectate.target === target);
  Hud.frameSeconds = KILLCAM_SECONDS + 1;
  Killcam.clock = 0;
  const handed = Render.cameraOverride(camera);
  check('killcam: when the replay ends the spectator camera takes over in the same frame', handed && !Killcam.playing && Spectate.placed && Test.near(camera.z, Actors.z[Spectate.target] - SPECTATE_FOLLOW_DISTANCE, 0.5), camera.z);
  const out = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  check('audio: the listener is the spectator\'s view', Sound.listenerSource(out) === true && out.x === camera.x && out.y === camera.y && out.z === camera.z && out.yaw === camera.yaw && out.pitch === camera.pitch);
  Spectate.stop();
  check('audio: afterwards the listener is the player\'s again', Sound.listenerSource(out) === false);
  spectateTestEnd(savedKillcam);
});

// Controls: presses are counted even when shorter than a frame or toggled; touch shows only the spectator buttons, relabelled.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled, savedToggle = Input.toggleMode[Input.actionIndex.fire];
  const bots = spectateTestStart('elim', [0, 0, 1, 1]);
  const fire = Input.actionIndex.fire, before = Input.presses[fire];
  Input.pressAction(fire); Input.releaseAction(fire);
  Input.pressAction(fire); Input.releaseAction(fire);
  check('input: two taps inside one frame are two presses', Input.presses[fire] - before === 2);
  Input.toggleMode[fire] = 1;
  const toggled = Input.presses[fire];
  Input.pressAction(fire); Input.releaseAction(fire);
  Input.pressAction(fire); Input.releaseAction(fire);
  check('input: with Fire set to toggle every press still counts', Input.presses[fire] - toggled === 2);
  Input.toggleMode[fire] = savedToggle;
  Input.clearAll();
  spectateTestKill(bots[3]);
  Spectate.refreshTargets();
  const hadLayer = !!TouchInput.layer;
  if (hadLayer) {
    const shown = (id) => TouchInput.places[id].shown, face = (id) => TouchInput.elements[id].textContent;
    check('touch: while spectating only the spectator buttons show, with their own text', TouchInput.flags.spectate === true && shown('fire') && shown('aim') && shown('reload') && shown('pause') && shown('stick')
      && face('fire') === 'NEXT' && face('aim') === 'PREV' && face('reload') === 'VIEW');
    check('touch: the combat and utility buttons give way', !shown('jump') && !shown('crouch') && !shown('swap') && !shown('melee') && !shown('ping') && !shown('fireLeft'));
    spectateTestPress('reload');
    spectateTestFrame();
    check('touch: the free camera also shows UP and DOWN', Spectate.free && shown('jump') && shown('crouch') && face('jump') === 'UP' && face('crouch') === 'DOWN');
    TouchInput.setButton(TouchInput.controlById.reload, true);
    TouchInput.setButton(TouchInput.controlById.reload, false);
    spectateTestFrame();
    check('touch: the VIEW button switches back to following', !Spectate.free && !shown('jump'));
    TouchInput.setButton(TouchInput.controlById.fire, true);
    TouchInput.setButton(TouchInput.controlById.fire, false);
    const target = Spectate.target;
    spectateTestFrame();
    check('touch: the NEXT button follows the next player', Spectate.target !== target);
  }
  Spectate.stop();
  if (hadLayer) check('touch: the normal buttons and texts are back', TouchInput.places.jump.shown && TouchInput.elements.fire.textContent === 'FIRE' && TouchInput.elements.aim.textContent === 'ALT' && TouchInput.elements.reload.textContent === 'LOAD');
  spectateTestEnd(savedKillcam);
});

// The HUD: SPECTATING with the followed name and place in the cycle, the keys (not on touch), FREE CAMERA.
Test.add('spectate', (check) => hudTestWith(() => {
  const savedKillcam = Killcam.enabled;
  const bots = spectateTestStart('elim', [0, 0, 1, 1]);
  spectateTestKill(bots[3]);
  Input.device = 'kbm';
  Hud.time += 2;   // the key labels refresh once a second
  hudTestFrame();
  const texts = hudTestTexts('front', 'spectate'), name = Actors.name[Spectate.target] || HUD_FALLBACK_NAME;
  check('hud: SPECTATING, the player followed with 1/2, the keys', texts[0] === 'SPECTATING' && texts[1] === name + '  1/2' && texts[2].includes('next') && texts[2].includes('previous') && texts[2].includes('free camera'), texts.join(' | '));
  check('hud: the respawn text layer draws it and the setting hides it', Hud.quadsOf('respawnText') > 0);
  Settings.set('hud.element.respawnText', false);
  hudTestFrame();
  check('hud: hidden with the respawn text element', Hud.quadsOf('respawnText') === 0);
  Settings.set('hud.element.respawnText', true);
  spectateTestPress('reload');
  spectateTestFrame();
  const free = hudTestTexts('front', 'spectate');
  check('hud: FREE CAMERA with its keys', free[0] === 'FREE CAMERA' && free.length === 2 && free[1].includes('follow'), free.join(' | '));
  Input.device = 'touch';
  Hud.time += 2;
  check('hud: on touch no key line (the buttons say it)', hudTestTexts('front', 'spectate').length === 1);
  Input.device = 'kbm';
  Spectate.stop();
  check('hud: nothing once the spectator ends', hudTestTexts('front', 'spectate').length === 0);
  spectateTestEnd(savedKillcam);
}));

// Fire, Alt and Crouch set to Toggle: the spectator's presses leave nothing latched, and the free camera does not sink or slow down.
Test.add('spectate', (check) => {
  const savedKillcam = Killcam.enabled, names = ['fire', 'alt', 'crouch', 'sprint'], index = Input.actionIndex;
  const savedModes = names.map((name) => Input.toggleMode[index[name]]), savedAds = Input.config.adsMultiplier;
  names.forEach((name) => { Input.toggleMode[index[name]] = 1; });
  const bots = spectateTestStart('elim', [0, 0, 1, 1]);
  const player = Game.playerId;
  Input.pressAction(index.alt); Input.releaseAction(index.alt);   // latched on before the player dies
  check('toggle: Alt is latched on while alive', Input.effective[index.alt] === 1);
  spectateTestKill(bots[3]);
  check('toggle: the spectator starts with nothing latched', names.every((name) => Input.effective[index[name]] === 0 && Input.toggled[index[name]] === 0));
  spectateTestPress('fire');
  spectateTestPress('alt');
  spectateTestFrame();
  check('toggle: odd NEXT / PREV presses latch Fire and Alt (the setting)', Input.effective[index.fire] === 1 && Input.effective[index.alt] === 1);
  Input.config.adsMultiplier = 0.5;
  spectateTestPress('reload');
  spectateTestFrame();
  const before = Input.aim.yaw;
  Input.addLook(0.2, 0, false);
  spectateTestFrame();
  check('toggle: a latched Alt does not slow the free camera\'s look', Test.near(wrapAngle(before - Input.aim.yaw), 0.2, 1e-6), wrapAngle(before - Input.aim.yaw));
  spectateTestPress('crouch');
  spectateTestFrame();
  Modes.spawnActor(player);
  check('toggle: the respawn ends with Fire, Alt and Crouch off', !Spectate.active && names.every((name) => Input.effective[index[name]] === 0 && Input.toggled[index[name]] === 0));
  Input.config.adsMultiplier = savedAds;
  names.forEach((name, i) => { Input.toggleMode[index[name]] = savedModes[i]; });
  spectateTestEnd(savedKillcam);
});

// A tap on the look area is a tap-to-fire press only while playing; spectating, Fire is NEXT.
Test.add('spectate', (check) => {
  if (!TouchInput.layer) return;
  const fire = Input.actionIndex.fire, saved = Input.config.touchTapFire, width = window.innerWidth;
  const tap = (pointerId) => {
    const down = { pointerId, clientX: width * 0.8, clientY: 200, timeStamp: 10, preventDefault() {} };
    TouchInput.onDown(down, TouchInput.zone);
    TouchInput.onUp({ pointerId, clientX: width * 0.8, clientY: 200, timeStamp: 60 });
  };
  Input.config.touchTapFire = true;
  let before = Input.presses[fire];
  tap(901);
  check('tap-to-fire: a tap on the view fires while playing', Input.presses[fire] - before === 1);
  TouchInput.flags.spectate = true;
  before = Input.presses[fire];
  tap(902);
  check('tap-to-fire: and does not press Fire (NEXT) while spectating', Input.presses[fire] === before);
  TouchInput.flags.spectate = false;
  Input.config.touchTapFire = saved;
  Input.clearAll();
});

// The HUD strings are made again only when what they say changes.
Test.add('spectate', (check) => hudTestWith(() => {
  const savedKillcam = Killcam.enabled;
  const bots = spectateTestStart('elim', [0, 0, 1, 1]);
  spectateTestKill(bots[3]);
  Input.device = 'kbm';
  Hud.time += 50;   // the key labels refresh once a second: older ones (another device) are dropped
  const first = Spectate.subject(), firstHint = Spectate.hint();
  Spectate.text.subject = 'KEPT'; Spectate.text.hint = 'KEPT HINT';
  check('hud: the same player and keys reuse the strings', Spectate.subject() === 'KEPT' && Spectate.hint() === 'KEPT HINT' && first.length > 0 && firstHint.length > 0);
  spectateTestPress('fire');
  spectateTestFrame();
  check('hud: another player rebuilds the name line', Spectate.subject() !== 'KEPT');
  Spectate.text.hint = 'KEPT HINT';
  spectateTestPress('reload');
  spectateTestFrame();
  check('hud: the free camera rebuilds the keys line', Spectate.hint() !== 'KEPT HINT');
  spectateTestEnd(savedKillcam);
}));
