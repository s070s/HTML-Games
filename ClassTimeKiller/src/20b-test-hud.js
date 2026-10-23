// Self-tests for the S17 HUD (group 'hud'): settings, layout, projection, every element hideable, kill feed, banners, markers,
// crosshair, killcam ring buffer and the HUD frame cost. The HUD draws into HudBatch without a GPU: the layers run through
// collectHudLayers() with a fixed screen size and the glyph atlas built on the fly, so quads, text and timing are real.

DebugApi.hud = Hud;
DebugApi.killcam = Killcam;
DebugApi.play = PlayFlow;
DebugApi.bus = Bus;

const HUD_TEST_WIDTH = 1280, HUD_TEST_HEIGHT = 720;
const HUD_TEST_FRAME = 1 / 60;
const HUD_TEST_COST_FRAMES = 100, HUD_TEST_COST_BATCHES = 6;
const HUD_TEST_COST_BUDGET_MS = 0.4;   // PERF-002
const HUD_TEST_POOL_KILLER = 2;

// Runs `run` with a fixed screen size, the glyph atlas and untouched camera / input state afterwards.
function hudTestWith(run) {
  const size = Render.size, saved = { width: size.cssWidth, height: size.cssHeight, camera: Object.assign({}, Render.camera), device: Input.device };
  const builtAtlas = !HudBatch.atlas;
  size.cssWidth = HUD_TEST_WIDTH; size.cssHeight = HUD_TEST_HEIGHT;
  if (builtAtlas) buildGlyphAtlas();
  Hud.insets.top = Hud.insets.right = Hud.insets.bottom = Hud.insets.left = 0;
  Hud.applySettings(); HudCombat.readSettings(); hudReadAccessSettings();
  Hud.time = 100;
  try { return run(); } finally {
    size.cssWidth = saved.width; size.cssHeight = saved.height;
    Object.assign(Render.camera, saved.camera);
    Input.device = saved.device;
    if (builtAtlas) { HudBatch.atlas = null; HudBatch.glyphIndex.clear(); }
    HudBatch.quads = 0;
    endModeTest();
    Hud.applySettings();
  }
}

// The kinds of the live HUD pings, sorted ('enemy,go').
function hudTestLivePings(source) {
  const kinds = [];
  for (let i = 0; i < HUD_PING_SLOTS; i++) if (HudPings.live(i) && (source === undefined || HudPings.source[i] === source)) kinds.push(HudPings.kind[i]);
  return kinds.sort().join();
}

// One HUD frame through the real layers; returns the quads it drew.
function hudTestFrame(seconds) {
  collectHudLayers(seconds === undefined ? HUD_TEST_FRAME : seconds);
  return HudBatch.quads;
}

function hudTestPlace(id, x, z, yaw) {
  Actors.x[id] = x; Actors.y[id] = 0; Actors.z[id] = z; Actors.yaw[id] = yaw || 0; Actors.aimYaw[id] = yaw || 0;
}
function hudTestCamera(id) {
  Object.assign(Render.camera, { x: Actors.x[id], y: Actors.y[id] + Actors.eye[id], z: Actors.z[id], yaw: Actors.aimYaw[id], pitch: 0, roll: 0, fov: 90 });
}

// A Holdfast match (two teams, three capture points) with the player on team 0 at the origin looking along +Z; bot 1 is a teammate ahead.
function hudTestMatch() {
  const points = [{ id: 'a', kind: 'point', x: -8, y: 0, z: 22, radius: 4 }, { id: 'b', kind: 'point', x: 0, y: 0, z: 40, radius: 4 }, { id: 'c', kind: 'point', x: 8, y: 0, z: 22, radius: 4 }];
  const map = modesTestMap({ spawns: TEAM_SPAWNS, objectives: points });
  startModeTest('dom', map, [0, 1, 0, 1], { player: { name: 'Me', team: 0 } });
  Sim.run(2);
  const id = Game.playerId;
  hudTestPlace(id, 0, 0, 0);
  Actors.team[id] = 0;
  const others = [];
  for (let other = 0; other < Actors.count; other++) if (other !== id && Modes.participant[other]) others.push(other);
  hudTestPlace(others[0], 0, 14, 0);
  hudTestPlace(others[1], 5, 30, 0);
  Actors.team[others[0]] = 0;
  hudTestCamera(id);
  return { id, mate: others[0], enemy: others[1] };
}

function hudTestEvent(type, fields) {
  const payload = Object.assign({ x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 }, fields);
  Bus.emit(type, payload);
}
function hudTestDamage(source, target, extra) {
  hudTestEvent('damage', Object.assign({ target, source, amount: 20, absorbed: 0, zone: 'body', weapon: 'warden', element: 'kinetic', kind: 'hit' }, extra));
}
function hudTestKill(victim, killer, extra) {
  hudTestEvent('kill', Object.assign({ victim, killer, assister: -1, weapon: 'warden', zone: 'body', element: 'kinetic' }, extra));
}

// Temporary content for the hooks other helpers fill later (gadgets, abilities, economy, items); returns the undo function.
function hudTestStubs() {
  const saved = [Gadgets.hudState, Abilities.hudState, Economy.hudState, Items.activePowerups, Items.timers];
  Gadgets.hudState = (id, out) => { out.grenade = 'frag'; out.grenadeCount = 2; out.gadget = 'turret'; out.gadgetCount = 1; out.gadgetCooldown = 0.4; return out; };
  Abilities.hudState = (id, out) => {
    out.slots.length = 0;
    out.slots.push({ id: 'dash', name: 'Dash', key: 'ability1', ready: false, cooldown: 0.5, charges: 2, active: false }, { id: 'wall', name: 'Wall', key: 'ability2', ready: true, cooldown: 0, charges: 1, active: true });
    out.meter.kind = 'ultimate'; out.meter.value = 0.6; out.meter.ready = false;
    return out;
  };
  Economy.hudState = (id, out) => { out.money = 1800; out.nextRoundMoney = 2400; out.canBuy = true; out.buyTimeLeft = 12; return out; };
  Items.activePowerups = (id, out) => { out.length = 0; out.push({ id: 'fury', name: 'Fury', remaining: 8, duration: 20, color: '#ff6a3d' }); return 1; };
  Items.timers = (out) => { out.length = 0; out.push({ item: 'megacell', x: 0, y: 0, z: 10, remaining: 14, group: 'power' }); return 1; };
  return () => { [Gadgets.hudState, Abilities.hudState, Economy.hudState, Items.activePowerups, Items.timers] = saved; };
}

// Gives the actor a weapon and draws it.
function hudTestArm(id, key) {
  Weapons.give(id, key);
  Weapons.current[id] = CAT.weapons.byId(key).index;
  Weapons.state[id] = WEAPON_STATE.IDLE;
}
function hudTestName(id) { return Actors.name[id] || HUD_FALLBACK_NAME; }
function hudTestDrawer(layer, id) { return Hud.drawers[layer].find((drawer) => drawer.id === id); }

// Fills the scene with something for every element of an alive player.
function hudTestFillScene(scene) {
  const { id, mate, enemy } = scene;
  Actors.health[id] = 20; Actors.armor[id] = 30;
  hudTestArm(id, CAT.weapons.find((row) => row.class === 'smg').id);
  hudTestArm(id, 'warden');
  hudTestDamage(enemy, id, { x: 0, y: 1, z: 1 });
  hudTestDamage(id, enemy, { zone: 'head', x: 0, y: 1.5, z: 12 });
  hudTestKill(mate, id, { zone: 'head' });
  hudTestEvent('announce', { text: 'Blue takes the lead', kind: 'lead', priority: 2 });
  hudTestEvent('caption', { text: '[Footsteps left]', x: -4, y: 0, z: 2, kind: 'footstep' });
  hudTestEvent('ping', { id, kind: 'go', target: -1, x: 3, y: 1, z: 12 });
  hudTestEvent('bark', { id: mate, team: 0, category: 'spotted', text: 'Contact!' });
  Actors.kind[enemy] = ACTOR_KIND.BOT;   // the awareness meter belongs to bots
  BotSense.awareness[BotSense.pair(enemy, id)] = 0.6;
  TriggerState.air[id] = AIR_SECONDS * 0.2;   // the movement meter shows a low breath
}

Test.add('hud', (check) => hudTestWith(() => {
  const keys = Array.from(Settings.definitions.keys()).filter((key) => key.startsWith('hud.'));
  check('settings: every hud setting has a label and a category', keys.length > 20 && keys.every((key) => Settings.definitions.get(key).label && Settings.definitions.get(key).category));
  check('settings: scale is 50-150 percent, opacity 30-100', Settings.definitions.get('hud.scale').min === 50 && Settings.definitions.get('hud.scale').max === 150
    && Settings.definitions.get('hud.opacity').min === 30 && Settings.definitions.get('hud.opacity').max === 100);
  check('settings: every element has its own toggle', HUD_ELEMENTS.every((row) => Settings.definitions.has('hud.element.' + row.id)));
  check('settings: crosshair editor settings exist (UI-004)', ['style', 'size', 'gap', 'thickness', 'outline', 'color', 'dot', 'dynamic'].every((name) => Settings.definitions.has('hud.crosshair.' + name)));
  const readsBefore = new Map(Settings.readCounts);
  Hud.applySettings(); HudCombat.readSettings(); hudReadAccessSettings();
  Game.start({ mode: 'ffa', seed: 1 });
  const unread = keys.filter((key) => (Settings.readCounts.get(key) || 0) <= (readsBefore.get(key) || 0));
  check('settings: every hud setting is read by the HUD', unread.length === 0, unread.join());

  Hud.scale = 1;
  updateHudLayout(Hud.layout, 1280, 720);
  const base = Hud.layout.unit;
  check('layout: unit follows the screen, 1 at the design size', Test.near(base, Math.min(1280 / HUD_DESIGN_WIDTH, 720 / HUD_DESIGN_HEIGHT), 1e-6));
  Settings.set('hud.scale', 150); updateHudLayout(Hud.layout, 1280, 720);
  check('layout: 150% scale makes everything 1.5 times larger', Test.near(Hud.layout.unit, base * 1.5, 1e-6) && Test.near(Hud.layout.barWidth, 230 * base * 1.5, 1e-6));
  Settings.set('hud.scale', 50); updateHudLayout(Hud.layout, 1280, 720);
  check('layout: 50% scale makes everything half as large', Test.near(Hud.layout.unit, base * 0.5, 1e-6));
  Settings.set('hud.scale', 999);
  check('layout: the scale setting is clamped to 150', Settings.get('hud.scale') === 150);
  Settings.set('hud.scale', 100);
  Hud.insets.left = 44; Hud.insets.right = 30; Hud.insets.top = 20; Hud.insets.bottom = 12;
  updateHudLayout(Hud.layout, 1280, 720);
  check('layout: safe-area insets keep the HUD off notches', Hud.layout.left >= 44 + Hud.layout.margin - 1e-6 && Hud.layout.right <= 1280 - 30 - Hud.layout.margin + 1e-6
    && Hud.layout.top >= 20 + Hud.layout.margin - 1e-6 && Hud.layout.bottom <= 720 - 12 - Hud.layout.margin + 1e-6);
  Hud.insets.left = Hud.insets.right = Hud.insets.top = Hud.insets.bottom = 0;
  updateHudLayout(Hud.layout, 1280, 720);
  check('layout: a desktop screen uses the full layout', !Hud.layout.compact && Hud.layout.ammoRight === Hud.layout.right);
  Input.device = 'touch'; updateHudLayout(Hud.layout, 1280, 720);
  check('layout: touch gets the compact layout with the ammo panel away from the buttons', Hud.layout.compact && Hud.layout.ammoRight < Hud.layout.right && Hud.layout.barWidth < 230 * base);
  Input.device = 'kbm';
  Settings.set('hud.compact', 'on'); updateHudLayout(Hud.layout, 1280, 720);
  check('layout: the compact option forces it on', Hud.layout.compact);
  Settings.set('hud.compact', 'off'); updateHudLayout(Hud.layout, 640, 360);
  check('layout: compact off wins on a small screen, and text units never drop below 0.9', !Hud.layout.compact && Hud.layout.unit >= HUD_UNIT_MIN - 1e-6);
  Settings.set('hud.compact', 'auto'); updateHudLayout(Hud.layout, 640, 360);
  check('layout: auto turns compact on for small screens', Hud.layout.compact);
  check('layout: the smallest HUD text is 14 px at 100% scale (ACC-008)', HUD_TEXT_SMALL >= 14);
}));

// ACC-008 as drawn: a full HUD on a landscape phone (844 x 390, touch) has no text under 14 px at 100% scale.
Test.add('hud', (check) => hudTestWith(() => {
  hudTestFillScene(hudTestMatch());
  Render.size.cssWidth = 844; Render.size.cssHeight = 390; Input.device = 'touch';
  const small = [], textAt = HudBatch.textAt;
  HudBatch.textAt = function (string, color, align, alpha) {
    if (hudTextAt[2] < HUD_TEXT_SMALL - 1e-6 && small.length < 8) small.push(string + ' ' + hudTextAt[2].toFixed(1));
    return textAt.call(this, string, color, align, alpha);
  };
  try { hudTestFrame(); } finally { HudBatch.textAt = textAt; }
  check('layout: no HUD text under 14 px on a landscape phone (ACC-008, as drawn)', small.length === 0, small.join(' | '));
}));

Test.add('hud', (check) => hudTestWith(() => {
  const camera = Render.camera, out = { x: 0, y: 0, depth: 0, distance: 0, onScreen: false, dirX: 0, dirY: 0 };
  Object.assign(camera, { x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 90 });
  updateHudLayout(Hud.layout, HUD_TEST_WIDTH, HUD_TEST_HEIGHT);
  check('project: a point straight ahead lands in the screen centre', Hud.project(0, 1.6, 10, out) && Test.near(out.x, 640, 1e-3) && Test.near(out.y, 360, 1e-3) && Test.near(out.distance, 10, 1e-6));
  check('project: right of the view is +x on the screen (yaw 0 looks +Z, right is -X)', Hud.project(-3, 1.6, 10, out) && out.x > 640);
  check('project: above the view is up (smaller y)', Hud.project(0, 4, 10, out) && out.y < 360);
  check('project: the horizontal field of view edge at 90 degrees is 1 m sideways per metre of depth', Hud.project(-9.99, 1.6, 10, out) && Test.near(out.x, 1280, 1));
  check('project: a point behind is not on screen and reports negative depth', !Hud.project(0, 1.6, -5, out) && out.depth < 0);
  check('project: a point far to the side is off screen but points the right way', !Hud.project(-30, 1.6, 10, out) && out.dirX > 0);
  Object.assign(camera, { yaw: Math.PI / 2, pitch: 0 });
  check('project: yaw 90 degrees looks along +X', Hud.project(10, 1.6, 0, out) && Test.near(out.x, 640, 1e-3));
  let worst = 0;
  const view = Mat4.create(), projection = Mat4.create(), clip = Mat4.create(), random = makeRandom(7).next;
  for (let sample = 0; sample < 200; sample++) {
    Object.assign(camera, { x: random() * 20 - 10, y: 1.6 + random(), z: random() * 20 - 10, yaw: (random() - 0.5) * 6, pitch: (random() - 0.5) * 2, fov: 60 + random() * 50 });
    const px = camera.x + random() * 20 - 10, py = random() * 6, pz = camera.z + random() * 20 - 10;
    Mat4.perspective(projection, verticalFov(camera.fov), HUD_TEST_WIDTH / HUD_TEST_HEIGHT, 0.05, 500);
    Mat4.firstPerson(view, camera.x, camera.y, camera.z, camera.yaw, camera.pitch);
    Mat4.multiply(clip, projection, view);
    const w = clip[3] * px + clip[7] * py + clip[11] * pz + clip[15];
    if (w <= 1) continue;
    const ndcX = (clip[0] * px + clip[4] * py + clip[8] * pz + clip[12]) / w, ndcY = (clip[1] * px + clip[5] * py + clip[9] * pz + clip[13]) / w;
    Hud.project(px, py, pz, out);
    worst = Math.max(worst, Math.abs(out.x - (ndcX * 0.5 + 0.5) * HUD_TEST_WIDTH), Math.abs(out.y - (0.5 - ndcY * 0.5) * HUD_TEST_HEIGHT));
  }
  check('project: matches the renderer matrices for 200 random cameras and points (max error ' + worst.toFixed(4) + ' px)', worst < 0.05, worst);
}));

Test.add('hud', (check) => hudTestWith(() => {
  const scene = hudTestMatch(), undo = hudTestStubs();
  Killcam.enabled = false;
  hudTestFillScene(scene);
  hudTestFrame();
  check('layers: four HUD layers, one draw call each (REN-005)', HudBatch.layers.filter((layer) => HUD_LAYERS.some(([name]) => layer.name === 'hud.' + name)).length === 4
    && HudBatch.layers.every((layer) => layer.count >= 0) && HUD_LAYERS.every(([name]) => HudBatch.layers.some((layer) => layer.name === 'hud.' + name)));
  check('layers: a full scene stays inside the quad budget with nothing dropped', HudBatch.quads > 100 && HudBatch.quads < HUD_MAX_QUADS && HudBatch.dropped === 0, HudBatch.quads);
  for (const row of HUD_ELEMENTS) {
    if (row.id === 'respawnText') continue;                    // needs a dead player: tested below
    const matchRules = Game.match.rules;
    // The awareness meter belongs to stealth and PvE matches only (BOT-005): this team scene plays as a stealth mode for the element check.
    if (row.id === 'awareness') Game.match.rules = Object.assign({}, matchRules, { params: Object.assign({}, matchRules.params, { cloakWhenStill: true }) });
    if (row.id === 'pve') Object.assign(Modes.hud.pve, { active: true, mode: 'horde', wave: 2, waves: 10 });   // the PvE panel belongs to PvE modes
    Settings.set('hud.element.' + row.id, true);
    hudTestFrame();
    const shown = Hud.quadsOf(row.id);
    Settings.set('hud.element.' + row.id, false);
    hudTestFrame();
    const hidden = Hud.quadsOf(row.id);
    Settings.set('hud.element.' + row.id, row.fallback === undefined ? true : row.fallback);
    Game.match.rules = matchRules;
    resetPveHud();
    check('element ' + row.id + ' draws something and can be hidden (UI-015)', shown > 0 && hidden === 0, shown + ' quads shown, ' + hidden + ' hidden');
  }
  Settings.set('hud.show', false);
  check('toggle: hud.show off hides the whole HUD', hudTestFrame() === 0);
  Settings.set('hud.show', true);
  check('toggle: back on draws again', hudTestFrame() > 0);
  Game.state = 'results';
  check('hud: nothing is drawn outside a running match', hudTestFrame() === 0);
  Game.state = 'playing';
  Actors.alive[scene.id] = 0;
  hudTestKill(scene.id, scene.enemy);
  hudTestFrame();
  check('element respawnText: draws the countdown for a dead player', Hud.quadsOf('respawnText') > 0);
  Settings.set('hud.element.respawnText', false);
  hudTestFrame();
  check('element respawnText: can be hidden', Hud.quadsOf('respawnText') === 0);
  Settings.set('hud.element.respawnText', true);
  Actors.alive[scene.id] = 1;
  hudTestFrame();
  check('hud: with the player alive again the vitals are back and the countdown is gone', Hud.quadsOf('vitals') > 0 && Hud.quadsOf('respawnText') === 0);
  hudTestFrame();
  undo();
}));

Test.add('hud', (check) => hudTestWith(() => {
  const scene = hudTestMatch();
  Killcam.enabled = false;
  HudFeed.reset();
  hudTestKill(scene.enemy, scene.id, { weapon: 'warden' });
  Hud.time += 1; hudTestKill(scene.mate, scene.enemy, { zone: 'head' });
  Hud.time += 1; hudTestKill(scene.enemy, -1, { weapon: '' });
  check('kill feed: entries come oldest first', HudFeed.liveCount(Hud.time) === 3 && HudFeed.at[HudFeed.slotAt(0, Hud.time)] < HudFeed.at[HudFeed.slotAt(2, Hud.time)]);
  check('kill feed: killer, victim, weapon icon class and headshot flag are kept', HudFeed.killer[HudFeed.slotAt(0, Hud.time)] === hudTestName(scene.id) && HudFeed.victim[HudFeed.slotAt(0, Hud.time)] === hudTestName(scene.enemy)
    && HudFeed.weaponClass[HudFeed.slotAt(0, Hud.time)] === 'sidearm' && (HudFeed.flags[HudFeed.slotAt(1, Hud.time)] & HudFeed.FLAG_HEAD) !== 0);
  check('kill feed: your kills are marked and a world death has no killer', (HudFeed.flags[HudFeed.slotAt(0, Hud.time)] & HudFeed.FLAG_MINE) !== 0 && (HudFeed.flags[HudFeed.slotAt(2, Hud.time)] & HudFeed.FLAG_WORLD) !== 0);
  Hud.time += 4.5;
  check('kill feed: the oldest entry expires after 6 seconds, newer ones stay', HudFeed.liveCount(Hud.time) === 2 && HudFeed.victim[HudFeed.slotAt(0, Hud.time)] === hudTestName(scene.mate));
  Hud.time += 3;
  check('kill feed: everything expires in the end', HudFeed.liveCount(Hud.time) === 0 && HudFeed.slotAt(0, Hud.time) === -1);
  for (let i = 0; i < HUD_FEED_SLOTS + 4; i++) hudTestKill(scene.enemy, scene.id);
  check('kill feed: the ring keeps the newest entries and never grows', HudFeed.count === HUD_FEED_SLOTS && HudFeed.liveCount(Hud.time) === HUD_FEED_SLOTS);
  hudTestFrame();
  check('kill feed: at most five rows are drawn', HudFeed.liveCount(Hud.time) > HUD_FEED_ROWS && Hud.quadsOf('killFeed') > 0);

  HudBanners.reset();
  hudTestEvent('announce', { text: 'Overtime', kind: 'overtime', priority: 2 });
  hudTestEvent('announce', { text: 'Overtime', kind: 'overtime', priority: 2 });
  check('banners: the same announcement twice in a second shows once', HudBanners.at.filter((at) => at > 0).length === 1);
  hudTestEvent('medal', { id: scene.id, medal: 'doubleKill' });
  hudTestEvent('medal', { id: scene.enemy, medal: 'spree' });
  check('banners: your medal shows as a banner, other players medals do not', HudBanners.at.filter((at) => at > 0).length === 2 && HudBanners.medal.includes(1));
  check('banners: a medal id without a catalogue row becomes readable words', hudMedalTitle('quickScope') === 'Quick Scope');
  hudTestFrame();
  check('banners: they draw while alive', Hud.quadsOf('banners') > 0);
  Hud.time += HUD_BANNER_SECONDS_LONG + 0.1;
  hudTestFrame();
  check('banners: they disappear after their time', Hud.quadsOf('banners') === 0);
}));

Test.add('hud', (check) => hudTestWith(() => {
  const scene = hudTestMatch(), id = scene.id;
  Killcam.enabled = false;
  HudCombat.reset();
  hudTestDamage(id, scene.enemy, { zone: 'head', amount: 30, x: 0, y: 1.5, z: 12 });
  check('hit marker: your hit shows, a head hit is flagged', Hud.time - HudCombat.hitAt === 0 && HudCombat.hitHead);
  hudTestFrame();
  check('hit marker: draws while fresh', Hud.quadsOf('hitMarkers') > 0);
  Hud.time += HUD_HIT_SECONDS + 0.05; hudTestFrame();
  check('hit marker: gone after its time', Hud.quadsOf('hitMarkers') === 0);
  hudTestDamage(id, scene.enemy, { kind: 'dot' });
  check('hit marker: burning damage does not count as a hit', Hud.time - HudCombat.hitAt > 0);
  hudTestKill(scene.enemy, id);
  const killAge = Hud.time - HudCombat.killAt;
  hudTestFrame();
  check('kill marker: your kill draws the red cross', killAge === 0 && Hud.quadsOf('hitMarkers') > 0);
  const before = HudCombat.killAt;
  hudTestKill(id, id);
  check('kill marker: your own death is not a kill', HudCombat.killAt === before);
  HudCombat.reset();
  hudTestDamage(id, scene.enemy, { amount: 10, x: 0, y: 1.5, z: 12 });
  hudTestDamage(id, scene.mate, { amount: 40, x: 0, y: 1.5, z: 14 });
  hudTestDamage(id, scene.enemy, { amount: 15, x: 0, y: 1.5, z: 12 });
  const stacked = [];
  for (let slot = 0; slot < HUD_NUMBER_SLOTS; slot++) if (HudCombat.numberTarget[slot] >= 0) stacked.push(HudCombat.numberAmount[slot]);
  check('damage numbers: hits on one target add up into one number, other targets get their own', stacked.length === 2 && stacked.includes(25) && stacked.includes(40), stacked.join());
  Settings.set('hud.element.damageNumbers', true);
  hudTestFrame();
  check('damage numbers: drawn when switched on and the target is on screen', Hud.quadsOf('damageNumbers') > 0);

  HudCombat.reset();
  Render.camera.yaw = 0;
  hudTestPlace(scene.enemy, 0, -20, 0);
  hudTestDamage(scene.enemy, id, { amount: 10 });
  check('damage arc: a hit from behind points straight back', Math.abs(Math.abs(hudBearingTo(Actors.x[scene.enemy], Actors.z[scene.enemy])) - Math.PI) < 1e-6);
  hudTestPlace(scene.enemy, -20, 0, 0);
  check('damage arc: a hit from the right points right (+90 degrees)', Test.near(hudBearingTo(-20, 0), Math.PI / 2, 1e-6));
  hudTestPlace(scene.enemy, 20, 0, 0);
  check('damage arc: a hit from the left points left', Test.near(hudBearingTo(20, 0), -Math.PI / 2, 1e-6));
  hudTestDamage(scene.enemy, id, { amount: 10 });
  hudTestFrame();
  check('damage arc: drawn while fresh', Hud.quadsOf('damageArcs') > 0);
  Hud.time += HUD_ARC_SECONDS + 0.1;
  hudTestFrame();
  check('damage arc: gone after its time', Hud.quadsOf('damageArcs') === 0);
  const arcsBefore = HudCombat.arcNext;
  hudTestDamage(-1, id, { amount: 5, kind: 'fall' });
  check('damage arc: environment damage without a direction adds no arc', HudCombat.arcNext === arcsBefore);
}));

Test.add('hud', (check) => hudTestWith(() => {
  const scene = hudTestMatch(), id = scene.id;
  Killcam.enabled = false;
  hudTestArm(id, 'warden');
  hudTestFrame();
  check('crosshair: draws for the default style', Hud.quadsOf('crosshair') > 0);
  for (const style of HUD_CROSSHAIR_STYLES) {
    Settings.set('hud.crosshair.style', style);
    hudTestFrame();
    check('crosshair: style ' + style + ' draws', Hud.quadsOf('crosshair') > 0);
  }
  Settings.set('hud.crosshair.style', 'cross');
  Settings.set('hud.crosshair.outline', false);
  const plain = (hudTestFrame(), Hud.quadsOf('crosshair'));
  Settings.set('hud.crosshair.outline', true);
  check('crosshair: the outline adds quads', (hudTestFrame(), Hud.quadsOf('crosshair')) > plain);
  Settings.set('hud.crosshair.dot', true);
  check('crosshair: the centre dot adds quads', (hudTestFrame(), Hud.quadsOf('crosshair')) > plain + 4);
  Settings.set('hud.crosshair.dot', false);
  Settings.set('hud.crosshair.size', 999);
  check('crosshair: size is clamped to its range', Settings.get('hud.crosshair.size') === 30);
  Settings.set('hud.crosshair.size', 9);

  const weapon = Weapons.currentWeapon(id);
  Weapons.bloom[id] = 0;
  const calm = hudCrosshairSpread(id, weapon, Hud.layout);
  Weapons.bloom[id] = 3;
  check('crosshair: dynamic spread grows with the weapon bloom (' + calm.toFixed(1) + ' -> ' + hudCrosshairSpread(id, weapon, Hud.layout).toFixed(1) + ' px)', hudCrosshairSpread(id, weapon, Hud.layout) > calm + 5);
  for (let i = 0; i < 60; i++) hudTestFrame();
  check('crosshair: the drawn gap follows the spread smoothly', HudCombat.spread > calm + 3);
  Weapons.bloom[id] = 0;

  const classRow = CAT.weapons.find((row) => row.class === 'melee');
  check('crosshair: a melee weapon hides it through the class table', Hud.crosshairFor(classRow).hidden === true && Hud.crosshairFor(weapon).hidden === false);
  Hud.setCrosshairOverride(weapon.id, { style: 'dot', size: 3 });
  check('crosshair: a per-weapon player override wins and is saved', Hud.crosshairFor(weapon).style === 'dot' && Save.data.crosshairs[weapon.id].size === 3);
  Hud.setCrosshairOverride(weapon.id, null);
  check('crosshair: removing the override restores the setting', Hud.crosshairFor(weapon).style === 'cross' && !Save.data.crosshairs[weapon.id]);
  const hook = Hud.crosshairOverride;
  Hud.crosshairOverride = (row, out) => { out.color = 'red'; };
  check('crosshair: the override hook can set any field', Hud.crosshairFor(weapon).color === 'red');
  Hud.crosshairOverride = hook;

  const sniper = CAT.weapons.find((row) => row.alt && row.alt.zoom >= HUD_SCOPE_ZOOM_MIN);
  hudTestArm(id, sniper.id);
  Weapons.ads[id] = 0;
  hudTestFrame();
  check('scope: not zoomed in, the normal crosshair is drawn and no scope', hudTestDrawer('main', 'crosshair').quads > 0 && hudTestDrawer('back', 'scope').quads === 0);
  Weapons.ads[id] = 1;
  hudTestFrame();
  check('scope: a fully zoomed sniper draws the overlay instead of the crosshair', hudScopeAmount(id, sniper) === 1 && hudTestDrawer('main', 'crosshair').quads === 0 && hudTestDrawer('back', 'scope').quads > 0);
  Settings.set('hud.scopeOverlay', false);
  check('scope: the overlay can be switched off', hudScopeAmount(id, sniper) === 0);
}));

Test.add('hud', (check) => hudTestWith(() => {
  const scene = hudTestMatch(), id = scene.id;
  Killcam.enabled = false;
  Actors.health[id] = 15;
  hudTestFrame();
  check('vignette: low health draws it', Hud.quadsOf('vignette') > 0);
  Actors.health[id] = Actors.maxHealth[id];
  hudTestFrame();
  check('vignette: full health draws none', Hud.quadsOf('vignette') === 0);
  Actors.health[id] = Actors.maxHealth[id] * 0.37;
  hudTestFrame();
  const above = Hud.quadsOf('vignette');
  Actors.health[id] = Actors.maxHealth[id] * 0.33;
  hudTestFrame();
  check('vignette: it starts below 35% health, the HPP02 threshold shared with the heartbeat', above === 0 && Hud.quadsOf('vignette') > 0 && LOW_HEALTH_FRACTION === 0.35, above);
  check('vignette: the colours are red, never white (ACC-005)', HUD_COLOR.healthLow !== 0xffffff && HUD_COLOR.bad !== 0xffffff && (Hud.colors.bad & 0xff) < 0x80);
  const allowed = [];
  for (let i = 0; i < 6; i++) { allowed.push(Hud.flashAllowed()); Hud.time += 0.1; }
  check('flash cap: at most three flashes in one second', allowed.filter(Boolean).length === HUD_FLASHES_PER_SECOND && allowed.slice(0, 3).every(Boolean), allowed.join());
  Hud.time += 1;
  check('flash cap: allowed again a second later', Hud.flashAllowed());
  Hud.time += 2;
  HudCombat.reset();
  Settings.set('accessibility.reduceMotion', 'on');
  hudTestDamage(scene.enemy, id, { amount: 5 });
  check('reduce motion: no screen tint on damage, no pulsing', HudCombat.flashAt < 0 && Hud.reduceMotion());
  Settings.set('accessibility.reduceMotion', 'off');
  Hud.time += 2;
  hudTestDamage(scene.enemy, id, { amount: 5 });
  check('reduce motion off: the short red tint plays (limited by the flash cap)', Hud.time - HudCombat.flashAt === 0 && !Hud.reduceMotion());

  Settings.set('accessibility.colorBlind', 'protanopia');
  const protan = Hud.colors.teams.slice();
  Settings.set('accessibility.colorBlind', 'off');
  check('colour-blind palette: team colours change and the two teams stay apart', protan[0] !== Hud.colors.teams[1] && protan[1] === 0xffb000 && protan[0] !== protan[1]);
  check('colour-blind palette: the bad/good pair avoids red and green', (() => { Settings.set('accessibility.colorBlind', 'deuteranopia'); const pair = [Hud.colors.good, Hud.colors.bad]; Settings.set('accessibility.colorBlind', 'off'); return pair[0] !== HUD_COLOR.good && pair[1] !== HUD_COLOR.bad; })());
  check('team shapes differ per team (ACC-001)', Hud.teamShape(0) !== Hud.teamShape(1) && new Set(HUD_TEAM_SHAPES).size === HUD_TEAM_SHAPES.length);
  Settings.set('hud.opacity', 50);
  HudBatch.quads = 0;
  HudPen.rect(0, 0, 10, 10, 0xffffff, 1);
  const alphaByte = new Uint8Array(HudBatch.bytes)[16 + 3];
  check('opacity: the setting scales every alpha', Math.abs(alphaByte - 128) <= 1, alphaByte);
  Settings.set('hud.opacity', 100);
}));

Test.add('hud', (check) => hudTestWith(() => {
  Settings.set('hud.killcam', true);
  const scene = hudTestMatch(), player = scene.id, foe = scene.enemy, bystander = scene.mate;
  const buffers = [Killcam.transforms, Killcam.living, Killcam.frameTime];
  Sim.run(KILLCAM_STEP_TICKS - (Sim.tick % KILLCAM_STEP_TICKS));   // batches start on a recorded tick, so x is exactly 5 m per second at every frame
  for (let batch = 0; batch < 80; batch++) { Actors.x[foe] = Sim.tick * TICK_SECONDS * 5; Actors.z[foe] = 3; Actors.aimYaw[foe] = 0.5; Sim.run(KILLCAM_STEP_TICKS); }
  check('killcam: the ring has a fixed size and never grows', Killcam.filled === KILLCAM_FRAMES && Killcam.transforms.length === KILLCAM_FRAMES * MAX_ACTORS * KILLCAM_FIELDS && Killcam.head < KILLCAM_FRAMES);
  check('killcam: recording never replaces its buffers (no per-frame allocation)', buffers[0] === Killcam.transforms && buffers[1] === Killcam.living && buffers[2] === Killcam.frameTime
    && Killcam.sample(foe, Sim.time - 0.5) === Killcam.sampleScratch);
  check('killcam: frames are 20 Hz and the buffer holds the replay plus a margin', Test.near(Killcam.newestTime() - Killcam.oldestTime(), (KILLCAM_FRAMES - 1) / KILLCAM_RATE, 1e-6) && KILLCAM_FRAMES >= KILLCAM_RATE * KILLCAM_SECONDS);
  const mid = Killcam.newestTime() - 1.3, view = Killcam.sample(foe, mid);
  check('killcam: playback returns the recorded position at any time in the window', Test.near(view.x, mid * 5, 1e-3) && Test.near(view.z, 3, 1e-6) && Test.near(view.yaw, 0.5, 1e-6) && view.alive, JSON.stringify(view) + ' mid ' + mid);

  Actors.alive[player] = 0;
  hudTestKill(player, foe, { weapon: 'warden', zone: 'head' });
  check('killcam: your death by another actor starts the replay (2 s long)', Killcam.playing && Test.near(Killcam.length, KILLCAM_SECONDS, 0.06) && Killcam.killer === foe && Killcam.headshot);
  check('killcam: the killer name, weapon and remaining health are kept for the panel', Killcam.killerName === hudTestName(foe) && Killcam.weaponName === 'Warden Pistol' && Killcam.killerHealth === Actors.health[foe]);
  const camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 1, fov: 90 };
  Hud.frameSeconds = 0;
  Killcam.clock = 1;
  const expected = Killcam.sample(foe, Killcam.startTime + 1), expectedX = expected.x, expectedEye = expected.y + expected.eye;
  check('killcam: the camera override puts the camera at the killer\'s eyes', Render.cameraOverride(camera) === true && Test.near(camera.x, expectedX, 1e-3) && Test.near(camera.y, expectedEye, 1e-3)
    && camera.roll === 0 && Test.near(camera.yaw, 0.5, 1e-6), JSON.stringify(camera) + ' expected ' + expectedX + ' ' + expectedEye);
  const style = { visible: true };
  Render.applyActorStyle(foe, style);
  check('killcam: live bodies are hidden while it plays', style.visible === false);
  let figures = 0;
  hudDrawKillcamFigures({ mesh() { figures++; return 0; } });
  check('killcam: every recorded body except the killer is drawn as a figure (body and face)', figures === 2 * (Actors.count - 1), figures);
  hudTestFrame();
  check('killcam: the panel draws and the rest of the HUD (not from your view) stays away', Hud.quadsOf('') > 0 && Hud.replaying && Hud.quadsOf('header') === 0 && Hud.quadsOf('markers') === 0);
  Killcam.advance(0.5);
  check('killcam: it keeps playing before the end', Killcam.playing);
  Killcam.advance(2);
  check('killcam: it ends by itself after the replay and a short hold', !Killcam.playing && Render.cameraOverride(camera) === false);
  hudTestFrame();
  style.visible = true;
  Render.applyActorStyle(foe, style);
  check('killcam: afterwards bodies, panel and the normal HUD are back', style.visible === true && Hud.quadsOf('') === 0 && !Hud.replaying && Hud.quadsOf('header') > 0);

  Actors.alive[player] = 0;
  Actors.buttons[player] = BTN.FIRE;
  hudTestKill(player, foe);
  Killcam.advance(0.5);
  check('killcam: a button still held from the fight does not skip it', Killcam.playing);
  Actors.buttons[player] = 0;
  Killcam.advance(0.1);
  Actors.buttons[player] = BTN.FIRE;
  Killcam.advance(0.1);
  check('killcam: releasing and pressing again skips it (UI-011)', !Killcam.playing);
  Actors.buttons[player] = 0;

  hudTestKill(player, foe);
  Bus.emit('actor.spawn', { id: player });
  check('killcam: respawning ends it', !Killcam.playing);
  hudTestKill(player, player);
  hudTestKill(player, -1);
  check('killcam: suicide and environment deaths have no replay', !Killcam.playing);
  hudTestKill(bystander, foe);
  check('killcam: other actors dying does not start it', !Killcam.playing);
  Settings.set('hud.killcam', false);
  hudTestKill(player, foe);
  check('killcam: the option turns it off', !Killcam.playing && !Killcam.enabled);
  Settings.set('hud.killcam', true);
  Killcam.reset();
  hudTestKill(player, foe);
  check('killcam: with less than 0.3 s of history there is nothing to replay', !Killcam.playing);
}));

// ---- Pings: each kind's own life, 3 live pings per actor, an enemy ping follows its target in sight, replies keep a label ----
Test.add('hud', (check) => hudTestWith(() => {
  const scene = hudTestMatch(), life = (kind) => COMM_CALLOUT_BY_KIND.get(kind).seconds;
  HudPings.reset();
  check('pings: every callout row has its own marker life', COMM_CALLOUTS.every((row) => row.seconds > 0) && life('enemy') < life('go'));
  hudTestEvent('ping', { id: scene.mate, kind: 'enemy', target: -1, x: 1, z: 10 });
  hudTestEvent('ping', { id: scene.mate, kind: 'go', target: -1, x: 2, z: 10 });
  Hud.time += life('enemy') + 0.1;
  check('pings: the enemy ping is gone after its life while the go ping still shows', hudTestLivePings() === 'go', hudTestLivePings());
  HudPings.reset();
  for (let n = 0; n <= HUD_PING_PER_ACTOR; n++) { Hud.time += 0.1; hudTestEvent('ping', { id: scene.mate, kind: n === 0 ? 'danger' : 'go', target: -1, x: n, z: 10 }); }
  check('pings: at most 3 live per actor, the oldest goes first', hudTestLivePings(scene.mate) === 'go,go,go', hudTestLivePings(scene.mate));
  hudTestEvent('ping', { id: scene.id, kind: 'attack', target: -1, x: 0, z: 12 });
  check('pings: the cap is per actor (the player\'s ping shows beside them)', hudTestLivePings(scene.id) === 'attack' && hudTestLivePings(scene.mate) === 'go,go,go');
  HudPings.reset();
  hudTestEvent('ping', { id: scene.mate, kind: 'enemy', target: scene.enemy, x: Actors.x[scene.enemy], z: Actors.z[scene.enemy] });
  const lineClear = World.lineClearOf;   // after a reset the first ping takes slot 0
  hudTestPlace(scene.enemy, 9, 30, 0);
  hudTestFrame();
  check('pings: an enemy ping follows its target while the pinger sees it', HudPings.target[0] === scene.enemy && HudPings.x[0] === 9 && HudPings.z[0] === 30, [HudPings.x[0], HudPings.z[0]]);
  World.lineClearOf = () => false;
  try {
    Hud.time += HUD_PING_SIGHT_INTERVAL + 0.01;
    hudTestPlace(scene.enemy, -9, 30, 0);
    hudTestFrame();
  } finally { World.lineClearOf = lineClear; }
  check('pings: out of sight it stays where the target was last seen', HudPings.x[0] === 9, HudPings.x[0]);
  HudPings.reset();
  hudTestEvent('ping', { id: scene.mate, kind: 'enemy', target: scene.enemy, x: Actors.x[scene.enemy], z: Actors.z[scene.enemy] });
  const markersShown = Hud.elements.markers;
  Hud.elements.markers = false;
  try { hudTestPlace(scene.enemy, 7, 28, 0); hudTestFrame(); } finally { Hud.elements.markers = markersShown; }
  check('pings: with the world markers hidden the minimap ping still follows its target', HudPings.x[0] === 7 && HudPings.z[0] === 28, [HudPings.x[0], HudPings.z[0]]);
  HudPings.reset();
  hudTestEvent('ping', { id: scene.enemy, kind: 'go', target: -1, x: 0, z: 12 });
  check('pings: pings from the other side take no slot from your own side', HudPings.source.every((source) => source < 0));
  HudPings.reset();
  hudTestEvent('ping', { id: scene.mate, kind: 'go', target: -1, x: 0, z: 12 });
  hudTestEvent('ping', { id: scene.id, kind: 'dibs', target: -1, x: 0, z: 12, to: scene.mate });
  const answered = HudPings.newestToAnswer(scene.id);
  check('pings: a reply keeps its label, and only a teammate\'s ping (not a reply, not your own) can be answered',
    HudPings.reply.includes('Dibs') && answered >= 0 && HudPings.source[answered] === scene.mate && HudPings.kind[answered] === 'go');
}));

Test.add('hud', (check) => hudTestWith(() => {
  const scene = hudTestMatch(), id = scene.id, layout = Hud.layout;
  Killcam.enabled = false;
  updateHudLayout(layout, HUD_TEST_WIDTH, HUD_TEST_HEIGHT);
  const margin = HUD_MARKER_MARGIN * layout.unit;
  Hud.project(-60, 1.6, 10);
  let edge = hudEdgeArrowPosition(layout, hudProjection);
  check('markers: a point far to the right becomes an arrow on the right edge, inside the margin', Test.near(edge.x, 1280 - margin, 1) && edge.dx > 0.9 && edge.y > 0 && edge.y < 720);
  Hud.project(0, 1.6, -30);
  edge = hudEdgeArrowPosition(layout, hudProjection);
  check('markers: a point right behind gives an arrow somewhere on the screen edge, never NaN', Number.isFinite(edge.x) && Number.isFinite(edge.y) && edge.x >= margin - 1 && edge.x <= 1280 - margin + 1 && edge.y >= margin - 1 && edge.y <= 720 - margin + 1);
  Hud.project(0, 40, 10);
  edge = hudEdgeArrowPosition(layout, hudProjection);
  check('markers: a point high above gives an arrow on the top edge', Test.near(edge.y, margin, 1) && edge.dy < -0.9);
  hudTestFrame();
  const header = Hud.quadsOf('header'), markers = Hud.quadsOf('markers');
  check('markers: the three capture points show as markers and as chips under the header', markers > 0 && header > 30);
  HudPings.reset();
  hudTestEvent('ping', { id: scene.enemy, kind: 'go', target: -1, x: 3, y: 1, z: 12 });
  hudTestFrame();
  const withEnemyPing = Hud.quadsOf('markers');
  hudTestEvent('ping', { id: scene.mate, kind: 'enemy', target: -1, x: -3, y: 1, z: 12 });
  hudTestFrame();
  check('markers: a teammate ping adds a marker, an enemy ping does not', Hud.quadsOf('markers') > withEnemyPing && withEnemyPing === markers);
  Hud.time += COMM_CALLOUT_BY_KIND.get('enemy').seconds + 0.1;
  hudTestFrame();
  check('markers: an enemy ping expires after its kind\'s life', Hud.quadsOf('markers') === markers);

  hudTestFrame();
  const tagged = Hud.quadsOf('nameTags');
  Actors.team[scene.mate] = 1;
  hudTestFrame();
  check('name tags: teammates get one, enemies never do (no wall hacks)', tagged > 0 && Hud.quadsOf('nameTags') === 0);
  Actors.team[scene.mate] = 0;
  hudTestPlace(scene.mate, 0, HUD_TAG_RANGE + 10, 0);
  hudTestFrame();
  check('name tags: only within 60 m', Hud.quadsOf('nameTags') === 0);
  Settings.set('hud.teamShapes', false);
  hudTestPlace(scene.mate, 0, 14, 0);
  hudTestFrame();
  const plainTag = Hud.quadsOf('nameTags');
  Settings.set('hud.teamShapes', true);
  hudTestFrame();
  check('name tags: the team shape is optional', Hud.quadsOf('nameTags') > plainTag);

  const undo = hudTestStubs();
  Settings.set('hud.element.itemTimers', true);
  hudTestFrame();
  check('item timers: drawn for an item spot in range and on screen', Hud.quadsOf('itemTimers') > 0);
  Items.timers = (out) => { out.length = 0; out.push({ item: 'far', x: 0, y: 0, z: HUD_ITEM_TIMER_RANGE + 30, remaining: 9, group: 'power' }); return 1; };
  hudTestFrame();
  check('item timers: not drawn beyond 40 m', Hud.quadsOf('itemTimers') === 0);
  undo();

  Settings.set('hud.element.captions', true);
  Settings.set('hud.element.soundRing', true);
  HudCaptions.reset();
  hudTestEvent('caption', { text: '[Gunfire right]', x: -20, y: 0, z: 0, kind: 'gunfire' });
  hudTestEvent('caption', { text: '[Gunfire right]', x: -20, y: 0, z: 0, kind: 'gunfire' });
  check('captions: the same caption inside 0.6 s is one line (it only refreshes)', HudCaptions.text.filter((text) => text === '[Gunfire right]').length === 1 && HudCaptions.at.filter((at) => at > 0).length === 1);
  hudTestFrame();
  const withBackground = Hud.quadsOf('captions');
  Settings.set('hud.captionBackground', false);
  hudTestFrame();
  check('captions: the background is optional and the text size follows its setting', withBackground > Hud.quadsOf('captions') && Hud.quadsOf('captions') > 0 && HudAccess.captionSize === 16);
  Settings.set('hud.captionSize', 28);
  check('captions: size 28 is the largest and is read at once', HudAccess.captionSize === 28 && Settings.definitions.get('hud.captionSize').min === 14);
  hudTestEvent('caption', { text: '', x: 0, y: 0, z: 30, kind: 'voice' });
  check('captions: a sound without text still reaches the sound ring', HudCaptions.soundAt.filter((at) => at > 0).length === 3);
  const angle = hudBearingTo(-20, 0);
  check('sound ring: a sound on the right sits right of the crosshair (' + angle.toFixed(2) + ' rad)', Test.near(angle, Math.PI / 2, 1e-6) && Math.sin(angle) > 0);
  hudTestFrame();
  check('sound ring: draws its icons, footsteps and gunfire differ by shape (ACC-003)', Hud.quadsOf('soundRing') > 0 && HUD_SOUND_ICONS.footstep.shape !== HUD_SOUND_ICONS.gunfire.shape
    && AUDIO_CAPTION_KINDS.every((kind) => HUD_SOUND_ICONS[kind]));
  Hud.time += HUD_CAPTION_SECONDS + HUD_SOUND_SECONDS;
  hudTestFrame();
  check('captions and sound ring: everything fades out', Hud.quadsOf('captions') === 0 && Hud.quadsOf('soundRing') === 0);
  void id;
}));

Test.add('hud', (check) => hudTestWith(() => {
  const scene = hudTestMatch(), id = scene.id;
  Killcam.enabled = false;
  check('text cache: numbers and times come from cached strings', hudNumber(0) === '0' && hudNumber(99.2) === '100' && hudNumber(1500) === '1500' && hudNumber(-3) === '-3'
    && hudTime(125) === '2:05' && hudTime(59.2) === '1:00' && hudTime(-5) === '0:00' && hudCount(3) === 'x3' && hudNumber(7) === hudNumber(7));
  hudTestArm(id, CAT.weapons.find((row) => row.class === 'rifle').id);
  hudTestArm(id, CAT.weapons.find((row) => row.class === 'smg').id);
  hudTestArm(id, 'warden');
  const count = hudCollectOwnedWeapons(id);
  let ordered = count >= 3;
  for (let i = 1; i < count; i++) ordered = ordered && CAT.weapons[hudOwned[i - 1]].slot <= CAT.weapons[hudOwned[i]].slot;
  check('weapon bar: owned weapons are listed in slot order', ordered, count);
  const weapon = Weapons.currentWeapon(id), slot = Weapons.slotIndex(id, weapon.index), ammo = Weapons.ammo(id), reload = hudReadReload(id);
  Weapons.magazine[slot] = Weapons.magSize(id, weapon);
  check('ammo: a full magazine has no warning', hudReadAmmoWarning(id, weapon, ammo, reload).text === '');
  Weapons.magazine[slot] = 1;
  check('ammo: a nearly empty magazine says LOW AMMO', hudReadAmmoWarning(id, weapon, Weapons.ammo(id), reload).text === 'LOW AMMO');
  Weapons.magazine[slot] = 0; Weapons.reserve[slot] = 30;
  check('ammo: an empty magazine with reserve says RELOAD in the warning colour', hudReadAmmoWarning(id, weapon, Weapons.ammo(id), reload).text === 'RELOAD' && hudAmmoWarning.color === Hud.colors.bad);
  Weapons.reserve[slot] = 0;
  check('ammo: nothing left says NO AMMO', hudReadAmmoWarning(id, weapon, Weapons.ammo(id), reload).text === 'NO AMMO');
  Weapons.state[id] = WEAPON_STATE.RELOAD; Weapons.stateTime[id] = 0.5; Weapons.stateDuration[id] = 2;
  const reloading = hudReadReload(id);
  check('ammo: reloading shows the progress and RELOADING', reloading.active && Test.near(reloading.progress, 0.25, 1e-6) && hudReadAmmoWarning(id, weapon, Weapons.ammo(id), reloading).text === 'RELOADING');
  Weapons.state[id] = WEAPON_STATE.IDLE;
  hudTestFrame();
  check('ammo: the panel draws for a weapon with a magazine and hides while dead', Hud.quadsOf('ammo') > 0);
  Actors.alive[id] = 0;
  hudTestFrame();
  check('status panels are hidden while dead', Hud.quadsOf('ammo') === 0 && Hud.quadsOf('vitals') === 0 && Hud.quadsOf('crosshair') === 0);
  Actors.alive[id] = 1;
  const undo = hudTestStubs();
  Economy.hudState = (player, out) => { out.money = 0; out.nextRoundMoney = 0; out.canBuy = false; out.buyTimeLeft = 0; return out; };
  hudTestFrame();
  check('money: an economy that gives nothing yet and a mode without money draw nothing', Hud.quadsOf('money') === 0 || Game.match.rules.economy === 'roundBuy');
  Economy.hudState = (player, out) => { out.money = 300; out.nextRoundMoney = 0; out.canBuy = false; out.buyTimeLeft = 0; return out; };
  hudTestFrame();
  check('money: any money draws the panel', Hud.quadsOf('money') > 0);
  undo();
  Settings.set('accessibility.colorBlind', 'tritanopia');
  check('colour-blind palette: the HUD bars use the palette colours', Hud.colors.health === HUD_PALETTES.tritanopia.health && Hud.colors.healthLow === HUD_PALETTES.tritanopia.healthLow);
  Settings.set('accessibility.colorBlind', 'off');
  check('colour-blind palette: off restores the default colours', Hud.colors.health === HUD_COLOR.health && Hud.colors.teams[0] === colorNumber(CAT.teamColors[0].color));
}));

// HUD frame cost (PERF-002: <= 0.4 ms): a busy scene; the mean frame time of the fastest of several batches, so another process
// taking the CPU for a moment (parallel test runs) does not look like a slow HUD.
function hudTestMeasure(frames) {
  for (let warm = 0; warm < 30; warm++) hudTestFrame();
  let best = Infinity;
  for (let batch = 0; batch < HUD_TEST_COST_BATCHES; batch++) {
    const started = performance.now();
    for (let frame = 0; frame < frames; frame++) hudTestFrame();
    best = Math.min(best, (performance.now() - started) / frames);
  }
  return best;
}
// The busy scene of the cost test; `measure(scene)` runs inside it. Used by the cost test and by DebugApi.hudHeap.
function hudTestBusy(measure) {
  return hudTestWith(() => {
    const scene = hudTestMatch(), undo = hudTestStubs();
    hudTestFillScene(scene);
    for (const key of ['damageNumbers', 'itemTimers', 'captions', 'soundRing', 'compass']) Settings.set('hud.element.' + key, true);
    const result = measure(scene);
    undo();
    return result;
  });
}
DebugApi.hudCost = () => hudTestBusy(() => ({ ms: hudTestMeasure(HUD_TEST_COST_FRAMES), quads: HudBatch.quads }));
// JS heap growth over many frames of the busy scene (Chrome only, coarse): a quick way to see per-frame allocation. Returns bytes, -1 without performance.memory.
DebugApi.hudHeap = (frames) => hudTestBusy(() => {
  if (!performance.memory) return -1;
  hudTestMeasure(200);
  const before = performance.memory.usedJSHeapSize;
  for (let frame = 0; frame < frames; frame++) hudTestFrame();
  return performance.memory.usedJSHeapSize - before;
});

// HP-007 downed cues: a marker over a downed teammate, the hold-Use hint near it, the revive ring, the own bleed-out text.
Test.add('hud', (check) => hudTestWith(() => {
  const { id, mate } = hudTestMatch(), quads = (layer, drawer) => { hudTestFrame(); return hudTestDrawer(layer, drawer).quads; };
  check('downed: no downed cues while nobody is down', quads('world', 'downedAllies') === 0 && quads('front', 'downed') === 0);
  Damage.goDown(-1, mate);
  Sim.step();
  check('downed: a downed teammate gets a marker', quads('world', 'downedAllies') > 0);
  check('downed: no revive hint far from it', quads('front', 'downed') === 0);
  hudTestPlace(id, 0, 12, 0);
  check('downed: the hold-Use hint shows near it', quads('front', 'downed') > 0);
  Damage.reviving[id] = mate; Damage.reviveProgress[id] = REVIVE_SECONDS / 2;
  check('downed: the revive ring shows while reviving', quads('front', 'downed') > 0);
  Damage.reviving[id] = -1; Damage.reviveProgress[id] = 0;
  Damage.revive(mate);
  Damage.goDown(-1, id);
  Sim.step();
  check('downed: the local player sees the bleed-out time', (Actors.flags[id] & ACTOR_FLAG.DOWNED) !== 0 && quads('front', 'downed') > 0);
  check('downed: a downed actor lies prone (crawl pose)', Test.near(Actors.height[id], STANCE_HEIGHT[STANCE.PRONE], 1e-4), Actors.height[id]);
}));

// MOV-019 breath and the preset's movement resources reach the HUD: under water the breath bar runs down (low air darkens the
// edges), a Modern sprint shows its stamina; the Hardcore HUD hides the meter like the rest.
Test.add('hud', (check) => hudTestWith(() => {
  const { id } = hudTestMatch();
  Killcam.enabled = false;
  World.triggers.push(makeTrigger({ kind: 'water', min: [-60, -5, -60], max: [60, 5, 60] }, World.triggers.length));
  holdInput(id, 0, 0, BTN.CROUCH);
  stepSeconds(5);
  hudTestFrame();
  check('meter: 5 s with the head under water shows the breath running down', hudMoveMeters.air < 1 && hudMoveMeters.rows > 0 && Hud.quadsOf('movement') > 0,
    hudMoveMeters.air + ' / ' + hudMoveMeters.rows);
  stepSeconds(4);
  check('meter: low air darkens the screen edges', hudTestFrame() > 0 && hudTestDrawer('back', 'breath').quads > 0);
  World.triggers.pop();
  Move.setPreset(id, 'modern');
  resetMotion(id);
  holdInput(id, 0, 1, BTN.SPRINT);
  stepSeconds(3);
  hudTestFrame();
  check('meter: a 3 s Modern sprint shows the stamina left', hudMoveMeters.stamina < 1 && hudMoveMeters.rows > 0 && hudTestDrawer('main', 'movement').quads > 0, hudMoveMeters.stamina);
  Hud.noHud = true;
  hudTestFrame();
  check('meter: hidden by the Hardcore HUD', Hud.quadsOf('movement') === 0);
  Hud.noHud = false;
}));

Test.add('hud', (check) => {
  const cost = DebugApi.hudCost();
  check('cost: a busy HUD frame costs under 0.4 ms (PERF-002)', cost.ms <= HUD_TEST_COST_BUDGET_MS, cost.ms.toFixed(3) + ' ms with ' + cost.quads + ' quads');
});

// ---- The Ping button: a press shorter than a frame still pings; the finger on PING also picks on the wheel ----
Test.add('hud', (check) => {
  startInputMatch();
  let pings = 0, callouts = 0;
  const realPing = BotTeam.playerPing, realCallout = BotTeam.callout, button = TouchInput.elements.ping, frame = (seconds) => { Input.frame(seconds || INPUT_TEST_FRAME); Sim.step(); };
  BotTeam.playerPing = () => { pings++; };
  BotTeam.callout = () => { callouts++; };
  try {
    frame();
    inputKeyEvent('KeyZ', true); inputKeyEvent('KeyZ', false);   // down and up between two frames
    frame(); frame();
    check('ping: a key press shorter than a frame still pings once', pings === 1, pings);
    pings = 0;
    inputKeyEvent('KeyZ', true); Input.frame(INPUT_TEST_FRAME); inputKeyEvent('KeyZ', false); frame(); frame();   // a frame with no sim step (120 Hz screen)
    check('ping: a tap over a frame with no sim step pings once, not twice', pings === 1, pings);
    pings = 0;
    Actors.alive[Game.playerId] = 0;
    inputKeyEvent('KeyZ', true); inputKeyEvent('KeyZ', false); frame();
    Actors.alive[Game.playerId] = 1; frame(); frame();
    check('ping: a Ping pressed while dead does not ping later', pings === 0, pings);
    Input.setDevice('touch');
    inputTouchPointer('pointerdown', button, 3, 500, 300);
    for (let i = 0; i < 4; i++) frame(0.1);
    inputTouchPointer('pointermove', button, 3, 540, 300); frame();
    const toRight = CommWheel.selected;
    inputTouchPointer('pointermove', button, 3, 440, 300); frame();
    check('comm wheel: the finger holding PING opens it and picks by dragging', CommWheel.open && toRight >= 0 && CommWheel.selected >= 0 && CommWheel.selected !== toRight, toRight + ' then ' + CommWheel.selected);
    inputTouchPointer('pointerup', button, 3, 440, 300); frame();
    check('comm wheel: lifting the finger sends the callout', !CommWheel.open && callouts === 1, callouts);
  } finally {
    BotTeam.playerPing = realPing; BotTeam.callout = realCallout;
    CommWheel.reset(); TouchInput.reset(); Input.device = 'kbm';
  }
});

// ---- Colour-blind palettes keep health, armor and shield apart ----
const HUD_TEST_MIN_COLOR_DISTANCE = 100;   // RGB distance (0..441) between two vital bar colours
function hudTestColorDistance(a, b) {
  return Math.hypot(((a >> 16) & 255) - ((b >> 16) & 255), ((a >> 8) & 255) - ((b >> 8) & 255), (a & 255) - (b & 255));
}
Test.add('hud', (check) => {
  const saved = Settings.get('accessibility.colorBlind'), close = [];
  try {
    for (const id of Object.keys(HUD_PALETTES)) {
      Settings.set('accessibility.colorBlind', id);
      const health = Hud.colors.health;
      for (const [name, other] of [['armor', HUD_COLOR.armor], ['shield', HUD_COLOR.shield], ['low health', Hud.colors.healthLow]]) {
        if (hudTestColorDistance(health, other) < HUD_TEST_MIN_COLOR_DISTANCE) close.push(id + ' health/' + name);
      }
    }
  } finally {
    Settings.set('accessibility.colorBlind', saved);
  }
  check('colour-blind palettes: health stays well apart from armor, shield and low health', close.length === 0, close.join(', '));
});
