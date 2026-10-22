// Self-tests for the HUD extras, accessibility and the help / rules panels (group 'uiacc', plan steps 16.1, 16.3, 16.6, 16.7):
// colour-blind palettes, captions and cues, hold/toggle per action, reduce motion and the flash cap, high-contrast outlines,
// minimap / compass / motion tracker / awareness meter, the Hardcore HUD, crosshair editor, screens reachable with every device,
// font size and contrast, rules and economy panels, tips, and the HUD frame cost with everything on.

const ACCESS_TEST_WCAG_TEXT = 4.5;                 // contrast ratio of readable text
const ACCESS_TEST_MIN_FONT = 14;                   // ACC-008: pixels at 100% scale
const ACCESS_TEST_SCREEN_COST_MS = 1000;           // UI-001: no screen takes longer than a second to open
const ACCESS_TEST_HOLD_ACTIONS = ['crouch', 'sprint', 'walk', 'prone', 'fire', 'alt', 'use', 'scoreboard'];
const ACCESS_TEST_NEXT_SHOT_NOISE = 60;

function accessTestLuminance(hex) {
  const channel = (shift) => { const value = ((hex >> shift) & 255) / 255; return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4); };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}
function accessTestContrast(a, b) {
  const first = accessTestLuminance(a), second = accessTestLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
function accessTestHue(hex) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255, max = Math.max(r, g, b), delta = max - Math.min(r, g, b);
  if (delta === 0) return -1;
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}
function accessTestCssColor(name) { return parseInt(getComputedStyle(document.documentElement).getPropertyValue(name).trim().slice(1), 16); }

// A pen that records the rectangles drawn (colour and alpha of the last one).
const accessTestPen = { calls: [], rect(x, y, w, h, color, alpha) { this.calls.push({ color, alpha }); } };

Test.add('uiacc', (check) => hudTestWith(() => {
  // ---- ACC-001 colour-blind palettes ----
  const scene = hudTestMatch();
  const teamActors = [scene.id, scene.enemy];
  for (const id of ACCESS_PALETTES.slice(1)) {
    Settings.set('accessibility.colorBlind', id);
    const teams = Hud.colors.teams.slice();
    const ratio = accessTestContrast(teams[0], teams[1]);
    check('colour-blind ' + id + ': the team colours differ in brightness as well as hue', ratio >= 1.5, ratio.toFixed(2));
    const hues = [accessTestHue(Hud.colors.good), accessTestHue(Hud.colors.bad)];
    const redOrGreen = (hue) => hue >= 0 && (hue < 25 || hue > 335 || (hue > 75 && hue < 165));
    if (id !== 'tritanopia') check('colour-blind ' + id + ': the good and bad colours are neither red nor green', !hues.some(redOrGreen), hues.join());   // tritanopia confuses blue and yellow, not red and green
    check('colour-blind ' + id + ': the bodies of both teams use the palette', teamActors.every((actor) => actorBaseColor(actor) === teams[Actors.team[actor]]) && Render.teamPalette === Hud.colors.teams);
  }
  Settings.set('accessibility.colorBlind', 'off');
  check('colour-blind off: the normal team colours return to the bodies', Render.teamPalette === null && actorBaseColor(scene.id) === CAT.teamColors[Actors.team[scene.id]].color);

  // ---- ACC-008 contrast of the HUD text and the menu colours ----
  const textColors = ['text', 'dim', 'warn', 'bad', 'good', 'gold', 'health', 'armor', 'shield'];
  check('contrast: every HUD text colour reads on the panel (WCAG >= 4.5)', textColors.every((name) => accessTestContrast(HUD_COLOR[name], HUD_COLOR.panel) >= ACCESS_TEST_WCAG_TEXT), textColors.map((name) => name + ' ' + accessTestContrast(HUD_COLOR[name], HUD_COLOR.panel).toFixed(1)).join());
  const palettes = ACCESS_PALETTES.slice(1).every((id) => {
    const palette = HUD_PALETTES[id];
    return [palette.good, palette.bad, palette.health, palette.healthLow].concat(palette.teams).every((color) => accessTestContrast(color, HUD_COLOR.panel) >= ACCESS_TEST_WCAG_TEXT);
  });
  check('contrast: the colour-blind palette colours read on the panel too', palettes);
  const panel = accessTestCssColor('--ui-panel');
  check('contrast: menu text, dim text and status colours read on the menu panel', ['--ui-text', '--ui-dim', '--ui-bad', '--ui-good', '--ui-accent'].every((name) => accessTestContrast(accessTestCssColor(name), panel) >= ACCESS_TEST_WCAG_TEXT));
  check('contrast: dark text on the accent button reads', accessTestContrast(0x1a1205, accessTestCssColor('--ui-accent')) >= ACCESS_TEST_WCAG_TEXT);

  // ---- ACC-006 high-contrast enemy outlines ----
  Settings.set('accessibility.highContrast', true);
  check('high contrast: the renderer gets the option', Render.config.highContrast === true);
  check('high contrast: enemies are highlighted, the player and teammates are not', highlightFor(scene.enemy) === 1 && highlightFor(scene.id) === 0 && highlightFor(scene.mate) === 0);
  const slot = actorBatch.mesh('box', 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0);
  actorBatch.data[slot + HIGHLIGHT_SLOT] = 1;
  actorBatch.clear();
  const reused = actorBatch.mesh('box', 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0);
  actorBatch.clear();
  check('high contrast: a reused instance never keeps an old highlight', reused === slot && actorBatch.data[reused + HIGHLIGHT_SLOT] === 0);
  check('high contrast: the shape shader has the thick bright outline', SHAPES_FRAGMENT.includes('uHighlightColor') && SHAPES_VERTEX.includes('vHighlight'));
  const outlinesSetting = Settings.get('video.outlines');
  Settings.set('video.outlines', false);
  check('high contrast with character outlines off: only highlighted enemies get a shell (the base shell is zero), the pass still runs', baseOutlineAmount() === 0 && outlinePassNeeded() && SHAPES_VERTEX.includes('uBaseOutline'));
  Settings.set('video.outlines', true);
  check('high contrast with character outlines on: every character keeps the normal shell', baseOutlineAmount() === 1 && outlinePassNeeded());
  Settings.set('accessibility.highContrast', false);
  Settings.set('video.outlines', false);
  check('outlines and high contrast both off: no outline pass', !outlinePassNeeded());
  Settings.set('video.outlines', outlinesSetting);
  Settings.set('accessibility.highContrast', false);
  check('high contrast off: nobody is highlighted', highlightFor(scene.enemy) === 0 && Render.config.highContrast === false);

  // ---- ACC-005 particle intensity ----
  Settings.set('accessibility.particles', 50);
  check('particles: the intensity slider reaches the effects', Render.config.particleScale === 0.5);
  Settings.set('accessibility.particles', 100);
  check('particles: 100% is the normal amount', Render.config.particleScale === 1);

  // ---- ACC-006 audio ----
  Settings.set('audio.mono', true);
  Settings.set('audio.sfx', 0.3); Settings.set('audio.announcer', 0.2);
  check('audio: mono and the separate volumes reach the sound engine', Sound.mono === true && Sound.levels.sfx === 0.3 && Sound.levels.announcer === 0.2);
  check('audio: five separate volume sliders exist (master, effects, menu, voice, music)', ['master', 'sfx', 'ui', 'announcer', 'music'].every((name) => Settings.definitions.has('audio.' + name)));
  Settings.set('audio.mono', false);
}));

Test.add('uiacc', (check) => hudTestWith(() => {
  // ---- ACC-002 captions, barks and the sound ring ----
  const scene = hudTestMatch();
  Settings.set('hud.element.captions', true);
  // The captions and the ring are fed by the sound engine's own 'caption' events (one emitter, S06); the HUD adds none. The engine runs live here.
  Sound.forceActive = true;
  Sound.resetState();
  const sound = (type, payload) => { hudTestEvent(type, payload); Sound.update(1.5); };   // 1.5 s clears every caption throttle
  const fire = (id, x, z, weaponClass) => { hudTestPlace(id, x, z, 0); sound('weapon.fire', { id, weapon: 'x', weaponClass: weaponClass || 'rifle', mode: 'primary', x, y: 1.5, z, dx: 0, dy: 0, dz: 1 }); };
  HudCaptions.reset();
  hudTestPlace(scene.mate, 0, 14, 0);
  sound('bark', { id: scene.mate, team: 0, category: 'spotted', text: 'Contact!' });
  check('barks: the speaker shows as a voice disc on the sound ring', HudCaptions.soundKind.some((kind, index) => kind === 'voice' && HudCaptions.soundAt[index] > 0));
  check('barks: the radio blip is captioned once, by the sound engine', HudCaptions.text.filter((text) => text === '[Radio chatter ahead]').length === 1, HudCaptions.text.join());
  hudTestEvent('bark', { id: scene.enemy, team: 1, category: 'spotted', text: 'Enemy chatter' });
  hudTestEvent('bark', { id: scene.enemy, team: 1, category: HUD_BARK_TAUNT, text: 'Too slow.' });
  check('barks: a teammate bark becomes a chat line with the speaker', HudExtra.barkText.includes('Contact!') && HudExtra.barkName[HudExtra.barkText.indexOf('Contact!')] === Actors.name[scene.mate]);
  check('barks: enemy chatter stays hidden, an enemy taunt shows', !HudExtra.barkText.includes('Enemy chatter') && HudExtra.barkText.includes('Too slow.'));
  hudTestFrame();
  check('barks: the chat lines are drawn and can be hidden', Hud.quadsOf('barks') > 0 && (Settings.set('hud.element.barks', false), hudTestFrame(), Hud.quadsOf('barks') === 0));
  Settings.set('hud.element.barks', true);
  HudCaptions.reset();
  hudTestEvent('announce', { text: 'Blue takes the lead', kind: 'lead', priority: 2 });
  check('subtitles: announcer text is also a caption while captions are on', HudCaptions.text.includes('Blue takes the lead'));
  HudCaptions.reset();
  fire(scene.enemy, 10, 0);
  check('captions: a shot to the left reads [Gunfire left]', HudCaptions.text.includes('[Gunfire left]'), HudCaptions.text.join());
  hudTestPlace(scene.enemy, -8, 0, 0);
  sound('move.step', { id: scene.enemy, speed: 6, surface: 'metal' });
  sound('explosion', { x: 0, y: 1, z: -9, radius: 5, owner: scene.enemy, source: 'x', element: '' });
  check('captions: footsteps on the right and an explosion behind have their own words', HudCaptions.text.includes('[Footsteps right]') && HudCaptions.text.includes('[Explosion behind]'), HudCaptions.text.join());
  const ring = HudCaptions.soundKind.filter((kind, index) => HudCaptions.soundAt[index] > 0 && kind);
  check('sound ring: the same cues feed the directional icons', ring.includes('gunfire') && ring.includes('footstep') && ring.includes('explosion'), ring.join());
  HudCaptions.reset();
  fire(scene.enemy, 10, 0);
  const slotsUsed = HudCaptions.soundAt.filter((at) => at > 0).length;
  check('captions: one shot is one ring entry (no second emitter)', slotsUsed === 1);
  HudCaptions.reset();
  fire(scene.id, 1, 1);
  fire(scene.enemy, 500, 0);
  check('captions: out of earshot and your own sounds are skipped', HudCaptions.at.every((at) => at < 0) && HudCaptions.soundAt.every((at) => at < 0));
  hudTestEvent('caption', { text: '[Rocket incoming ahead]', x: 0, y: 0, z: 10, kind: 'alert' });
  check('captions: a caption event reaches the captions', HudCaptions.text.includes('[Rocket incoming ahead]'));
  Settings.set('hud.element.soundRing', true);
  hudTestFrame();
  check('captions and ring are drawn', Hud.quadsOf('captions') > 0 && Hud.quadsOf('soundRing') > 0);
  Sound.forceActive = false;
  Sound.resetState();
}));

Test.add('uiacc', (check) => {
  // ---- ACC-004 hold or toggle for every hold action ----
  check('hold/toggle: every hold action has a setting', ACCESS_TEST_HOLD_ACTIONS.every((id) => ACCESS_HOLD_ACTIONS.includes(id) && Settings.definitions.has('controls.toggle.' + id)));
  const events = [];
  const listener = (event) => { if (event.action === 'scoreboard') events.push(event.down); };
  Bus.on('input.action', listener);
  for (const id of ACCESS_HOLD_ACTIONS) {
    const index = Input.actionIndex[id];
    Input.clearAll();
    Settings.set('controls.toggle.' + id, 'hold');
    Input.refreshConfig();
    Input.pressAction(index);
    const heldWhileDown = Input.isHeld(id);
    Input.releaseAction(index);
    const heldAfterRelease = Input.isHeld(id);
    Settings.set('controls.toggle.' + id, 'toggle');
    Input.refreshConfig();
    Input.pressAction(index); Input.releaseAction(index);
    const onAfterTap = Input.isHeld(id);
    Input.pressAction(index); Input.releaseAction(index);
    const offAfterSecondTap = !Input.isHeld(id);
    check('hold/toggle ' + id + ': hold follows the key, toggle stays on until the second press', heldWhileDown && !heldAfterRelease && onAfterTap && offAfterSecondTap);
    Settings.set('controls.toggle.' + id, 'hold');
  }
  Input.refreshConfig();
  Bus.off('input.action', listener);
  check('hold/toggle: a toggled scoreboard reports its release too', events.join() === 'true,false,true,false', events.join());

  const overlayEvents = [];
  const overlayListener = (event) => { if (event.action === 'scoreboard') overlayEvents.push(event.down); };
  Bus.on('input.action', overlayListener);
  Settings.set('controls.toggle.scoreboard', 'toggle'); Input.refreshConfig(); Input.clearAll();
  Input.bindingDown('Key:Tab'); Input.bindingUp('Key:Tab');
  Input.uiOpen = true;                                    // the scoreboard overlay is a screen: the second press must still reach the action
  Input.bindingDown('Key:Tab'); Input.bindingUp('Key:Tab');
  Input.uiOpen = false;
  Bus.off('input.action', overlayListener);
  check('hold/toggle: a toggled scoreboard closes with the same key while its overlay is open', overlayEvents.join() === 'true,false' && !Input.isHeld('scoreboard'), overlayEvents.join());
  Input.uiOpen = true;
  Input.bindingDown('Key:Tab'); Input.bindingUp('Key:Tab');
  Input.uiOpen = false;
  check('hold/toggle: with a menu open and the toggle off the key does nothing to the game', !Input.isHeld('scoreboard'));
  Settings.set('controls.toggle.scoreboard', 'hold'); Input.refreshConfig(); Input.clearAll();

  // ---- ACC-004 aim assist slider ----
  const device = Input.device;
  Settings.set('controls.pad.aimAssist', 30); Settings.set('controls.touch.aimAssist', 90); Input.refreshConfig();
  Input.device = 'gamepad';
  const pad = Input.assistStrength();
  Input.device = 'touch';
  const touch = Input.assistStrength();
  Input.device = 'kbm';
  const mouse = Input.assistStrength();
  Input.device = device;
  check('aim assist: the sliders set the strength per device and never for the mouse', Test.near(pad, 0.3, 1e-9) && Test.near(touch, 0.9, 1e-9) && mouse === 0);
  Settings.set('controls.pad.aimAssist', 0); Input.refreshConfig();
  Input.device = 'gamepad';
  check('aim assist: 0 turns it off', Input.assistStrength() === 0);
  Input.device = device;
});

Test.add('uiacc', (check) => hudTestWith(() => {
  // ---- ACC-005 reduce motion, bob, shake and FOV kick ----
  const scene = hudTestMatch(), id = scene.id;
  const camera = { x: 0, y: 1.6, z: 0, yaw: 0.5, pitch: 0.1, roll: 0, fov: 90 };
  Settings.set('accessibility.reduceMotion', 'off');
  Settings.set('video.shake', 50); Settings.set('video.fovKick', 100);
  check('motion: the shake slider scales the view effects', Render.motion.shake === 0.5 && Render.motion.fovKick === 1 && Render.motion.bob === 1 && !Hud.reduceMotion());
  ViewFx.reset(); ViewFx.trauma = 1; ViewFx.kick = 6;
  ViewFx.apply(camera, 0.016);
  check('motion: shake and FOV kick move the camera', camera.roll !== 0 && camera.yaw !== 0.5 && camera.fov > 90, JSON.stringify(camera));
  Settings.set('accessibility.reduceMotion', 'on');
  check('motion: reduce motion silences shake, FOV kick and bob', Hud.reduceMotion() && Render.motion.shake === 0 && Render.motion.fovKick === 0 && Render.motion.bob === 0);
  Object.assign(camera, { yaw: 0.5, pitch: 0.1, roll: 0, fov: 90 });
  ViewFx.trauma = 1; ViewFx.kick = 6;
  ViewFx.apply(camera, 0.016);
  check('motion: with reduce motion the camera stays where it is', camera.roll === 0 && camera.yaw === 0.5 && camera.pitch === 0.1 && camera.fov === 90);
  Settings.set('accessibility.reduceMotion', 'auto');
  check('motion: reduce motion also switches the menu animations off (one class)', (Settings.set('accessibility.reduceMotion', 'on'), document.documentElement.classList.contains('reduce-motion')) && (Settings.set('accessibility.reduceMotion', 'off'), !document.documentElement.classList.contains('reduce-motion')));
  Settings.set('accessibility.reduceMotion', 'auto');
  check('motion: auto follows the system preference', Hud.reduceMotion() === hudSystemReduceMotion);
  const systemBefore = hudSystemReduceMotion;
  hudSetSystemMotion(true);
  const followedOn = Hud.reduceMotion() && Render.motion.shake === 0 && document.documentElement.classList.contains('reduce-motion');
  hudSetSystemMotion(false);
  const followedOff = !Hud.reduceMotion() && Render.motion.shake > 0 && !document.documentElement.classList.contains('reduce-motion');
  hudSetSystemMotion(systemBefore);
  check('motion: auto follows a change of the system preference while the game runs (HUD, menus and view effects)', followedOn && followedOff, followedOn + ' ' + followedOff);
  Settings.set('accessibility.reduceMotion', 'off');
  ViewFx.reset();
  Actors.x[id] = Actors.y[id] = Actors.z[id] = 0;
  const near = { x: 0, y: 1, z: 2, radius: 5, owner: -1, source: '', element: 'kinetic' }, far = Object.assign({}, near, { z: 60 });
  Bus.emit('explosion', near);
  const nearTrauma = ViewFx.trauma;
  ViewFx.reset();
  Bus.emit('explosion', far);
  check('motion: a close explosion shakes the view, a far one does not', nearTrauma > 0.3 && ViewFx.trauma === 0, nearTrauma);
  hudTestDamage(scene.enemy, id, { amount: 30 });
  check('motion: a hit on you shakes the view a little', ViewFx.trauma > 0 && ViewFx.trauma <= VIEW_DAMAGE_TRAUMA_MAX);
  ViewFx.reset();
  Bus.emit('move.dash', { id, speed: 8, surface: 'concrete' });
  check('motion: a dash kicks the field of view', ViewFx.kick === VIEW_DASH_KICK);
  // head bob: a grounded moving player bobs by the slider, never with reduce motion
  Actors.flags[id] |= ACTOR_FLAG.ON_GROUND; Actors.vx[id] = 7; Actors.vz[id] = 0;
  Render.config.headBob = 100;
  ViewState.bobPhase = 0.4;
  const bobbing = Math.abs(headBob(id, 0.01));
  Render.motion.bob = 0;
  const still = Math.abs(headBob(id, 0.01));
  Render.motion.bob = 1; Render.config.headBob = 0;
  check('motion: head bob follows its slider and reduce motion', bobbing > 0 && still === 0 && headBob(id, 0.01) === 0);
  Settings.set('video.viewmodelX', 5);
  check('view: the weapon offset sliders (cm) reach the renderer in metres', Test.near(Render.config.viewmodelOffset[0], 0.05, 1e-9));
  const state = { ads: 0, kick: 0, reload: 0, swap: 0 };
  const rest = poseWeapon(viewModelRows.rifle, state).x;
  state.ads = 1;
  const aimed = poseWeapon(viewModelRows.rifle, state).x;
  Settings.set('video.viewmodelX', 0);
  state.ads = 0;
  const unmoved = poseWeapon(viewModelRows.rifle, state).x;
  state.ads = 1;
  check('view: the offset moves the held weapon but never the aimed one', Test.near(rest - unmoved, -0.05, 1e-9) && Test.near(aimed, poseWeapon(viewModelRows.rifle, state).x, 1e-9));
  Settings.set('video.fov', 200);
  check('view: the field of view stays between 60 and 120', Settings.get('video.fov') === 120 && (Settings.set('video.fov', 10), Settings.get('video.fov') === 60));
  Settings.set('video.fov', FOV_DEFAULT);
  check('view: the default is 90 on desktop and 80 on phones', Settings.definitions.get('video.fov').fallback === (TOUCH_DEVICE ? 80 : 90));

  // ---- ACC-005 flashes: photosensitivity and the 3 per second cap ----
  Settings.set('accessibility.photosensitive', true);
  check('flash: photosensitivity darkens instead of brightening and caps the strength', Hud.flashColor(HUD_COLOR.text) === HUD_COLOR.black && Hud.flashAlpha(0.9) === 0.5);
  Settings.set('accessibility.photosensitive', false);
  Settings.set('accessibility.reduceMotion', 'on');
  check('flash: reduce motion halves flashes', Test.near(Hud.flashAlpha(0.8), 0.4, 1e-9));
  Settings.set('accessibility.reduceMotion', 'off');
  check('flash: normally a flash is white at full strength', Hud.flashColor(HUD_COLOR.text) === HUD_COLOR.text && Hud.flashAlpha(0.8) === 0.8);
  const savedBlind = Gadgets.blindAmount;
  let blind = 0;
  Gadgets.blindAmount = () => blind;
  const layout = { width: 1280, height: 720 };
  Hud.resetFlashes(); HudExtra.blindWas = 0;
  let bright = 0;
  for (let episode = 0; episode < 10; episode++) {
    blind = 0; hudDrawBlind(accessTestPen, layout);
    blind = 1; hudDrawBlind(accessTestPen, layout);
    if (HudExtra.blindBright) bright++;
    Hud.time += 0.1;
  }
  check('flash cap: ten flashbangs in one second show at most three bright flashes', bright >= 1 && bright <= HUD_FLASHES_PER_SECOND, bright);
  accessTestPen.calls.length = 0;
  Hud.time += 5; Hud.resetFlashes(); HudExtra.blindWas = 0; blind = 0; hudDrawBlind(accessTestPen, layout); blind = 1; hudDrawBlind(accessTestPen, layout);
  check('flash: a flash that is allowed is white', accessTestPen.calls.length === 1 && accessTestPen.calls[0].color === HUD_COLOR.text && accessTestPen.calls[0].alpha === 1);
  Settings.set('accessibility.photosensitive', true);
  accessTestPen.calls.length = 0;
  blind = 0; hudDrawBlind(accessTestPen, layout); blind = 1; hudDrawBlind(accessTestPen, layout);
  check('flash: in photosensitivity mode the blind is a dark overlay, never white', accessTestPen.calls.length === 1 && accessTestPen.calls[0].color === HUD_COLOR.black && accessTestPen.calls[0].alpha <= 0.5);
  Settings.set('accessibility.photosensitive', false);
  accessTestPen.calls.length = 0;
  Gadgets.blindAmount = savedBlind;
  ViewFx.trauma = 1; ViewFx.kick = 5;
  Game.start({ mode: 'ffa', seed: 1 });
  check('motion: a new match starts calm', ViewFx.trauma === 0 && ViewFx.kick === 0);
}));

Test.add('uiacc', (check) => hudTestWith(() => {
  // ---- UI-003/006 minimap, tracker, compass ----
  const scene = hudTestMatch(), { id, mate, enemy } = scene;
  hudTestFrame();
  const minimap = () => { hudTestFrame(); return Hud.quadsOf('minimap'); };
  const withoutEnemy = (() => { Actors.alive[enemy] = 0; const quads = minimap(); Actors.alive[enemy] = 1; return quads; })();
  const base = minimap();
  check('minimap: it draws and shows your side, objectives and pings', base > 10 && Hud.quadsOf('minimap') === base);
  check('minimap: an enemy is not shown by default', base === withoutEnemy, base + ' vs ' + withoutEnemy);
  Settings.set('hud.element.minimap', false);
  check('minimap: it can be hidden', minimap() === 0);
  Settings.set('hud.element.minimap', true);
  hudTestEvent('sound', { x: 5, y: 0, z: 30, radius: ACCESS_TEST_NEXT_SHOT_NOISE, kind: 'shot', source: enemy });
  const fired = minimap();
  check('minimap: an enemy that fires a loud shot shows as a red dot', fired > base, base + ' -> ' + fired);
  Hud.time += HUD_MAP_BLIP_SECONDS + 0.1;
  check('minimap: the dot is gone after two seconds', minimap() === base);
  hudTestEvent('sound', { x: 5, y: 0, z: 30, radius: HUD_MAP_SHOT_NOISE - 1, kind: 'shot', source: enemy });
  check('minimap: a quiet (suppressed) shot stays off the map', minimap() === base);
  const revealSlot = enemy * STATUS_COUNT + HudExtra.revealIndex;
  Damage.statusTime[revealSlot] = 2;
  check('minimap: a revealed enemy (seer effects) shows', minimap() > base);
  Damage.statusTime[revealSlot] = 0;

  // motion tracker (X35): moving, standing enemies in range; a crouch-walk stays hidden
  const rules = Game.match.rules;
  const setRadar = (radar) => { Game.match.rules = Object.assign({}, rules, { fx: radar ? { radar } : {} }); HudExtra.readRules(); };
  setRadar({ mode: 'all', range: 40 });
  Actors.vx[enemy] = 0; Actors.vz[enemy] = 3;
  check('tracker: a moving enemy in range shows', minimap() > base);
  Actors.flags[enemy] |= ACTOR_FLAG.CROUCHED;
  check('tracker: a crouch-walking enemy stays hidden', minimap() === base);
  Actors.flags[enemy] &= ~ACTOR_FLAG.CROUCHED;
  Actors.vz[enemy] = 0.5;
  check('tracker: a nearly still enemy stays hidden', minimap() === base);
  Actors.vz[enemy] = 3;
  setRadar({ mode: 'all', range: 20 });
  check('tracker: an enemy out of range stays hidden', minimap() === base);
  setRadar({ mode: 'team', range: 20 });
  check('tracker: team mode shares the range of every living teammate (the mate is 17 m away)', minimap() > base);
  setRadar({ mode: 'off', range: 40 });
  check('tracker: off shows nothing', minimap() === base);
  setRadar(null);
  const jam = Gadgets.jammed;
  Gadgets.jammed = () => true;
  setRadar({ mode: 'all', range: 40 });
  const jammed = minimap();
  Gadgets.jammed = jam;
  check('minimap: a jammer hides every mark and shows moving bars and the word JAMMED instead', jammed === 3 + HUD_JAM_BARS + 'JAMMED'.length, jammed);
  setRadar(null);

  Settings.set('hud.element.compass', true);
  hudTestFrame();
  check('compass: it draws the directions and objective marks and can be hidden', Hud.quadsOf('compass') > 5 && (Settings.set('hud.element.compass', false), hudTestFrame(), Hud.quadsOf('compass') === 0));
  Settings.set('hud.element.compass', false);

  // ---- UI-014 stealth awareness ----
  Actors.kind[enemy] = ACTOR_KIND.BOT;
  const meter = (amount) => { BotSense.awareness[BotSense.pair(enemy, id)] = amount; hudTestFrame(); return Hud.quadsOf('awareness'); };
  const matchRules = Game.match.rules;
  const withRules = (changes) => { Game.match.rules = Object.assign({}, matchRules, changes); };
  check('awareness: a team match (domination) shows no meter although the bot has seen you', meter(0.8) === 0);
  withRules({ teams: 0 });
  check('awareness: nor does free-for-all', meter(0.8) === 0);
  withRules({ teams: 2, params: { cloakWhenStill: true } });
  check('awareness: a stealth mode (players cloak when still) does', meter(0.8) > 0);
  withRules({ teams: 1 });                                // PvE: everyone on one side
  check('awareness: an unaware enemy shows nothing, an alerted one a meter, a spotted one a bar and a mark', meter(0) === 0 && meter(0.4) > 0 && meter(1) > meter(0.4));
  check('awareness: the colour runs white, amber, red', hudAwarenessColor(0) === HUD_COLOR.text && hudAwarenessColor(0.5) === HUD_COLOR.warn && hudAwarenessColor(1) === Hud.colors.bad);
  hudTestPlace(enemy, 5, 70, 0);
  check('awareness: far enemies show nothing', meter(0.8) === 0);
  hudTestPlace(enemy, 5, 30, 0);
  const wall = { shape: 'box', min: [-20, 0, 15], max: [20, 6, 16] };
  World.load(modesTestMap({ brushes: [TEST_FLOOR, wall] }));
  check('awareness: a wall hides the meter (no wall hack)', meter(0.8) === 0);
  World.load(modesTestMap({ brushes: [TEST_FLOOR] }));
  check('awareness: and it returns when the view is clear', meter(0.8) > 0);
  Settings.set('hud.element.awareness', false);
  check('awareness: it can be hidden', meter(0.8) === 0);
  Settings.set('hud.element.awareness', true);
  Game.match.rules = matchRules;

  // ---- X36 Hardcore HUD ----
  Settings.set('hud.element.captions', true);
  hudTestEvent('caption', { text: '[Footsteps left]', x: -4, y: 0, z: 2, kind: 'footstep' });
  Game.match.rules = Object.assign({}, rules, { fx: { noHud: true } });
  Hud.applySettings();
  hudTestFrame();
  check('hardcore HUD: the bars, ammo, header, feed and minimap are gone', ['vitals', 'ammo', 'header', 'killFeed', 'minimap', 'weapons', 'markers'].every((name) => Hud.quadsOf(name) === 0));
  check('hardcore HUD: the crosshair and the accessibility captions stay', Hud.quadsOf('crosshair') > 0 && Hud.quadsOf('captions') > 0);
  Game.match.rules = rules;
  Hud.applySettings();
  hudTestFrame();
  check('hardcore HUD off: everything is back', Hud.quadsOf('vitals') > 0 && Hud.quadsOf('minimap') > 0);

  // ---- X44 suppression, and the flash staying under the Hardcore HUD ----
  const suppression = Mutators.suppression, blurQuads = () => { hudTestFrame(); return hudTestDrawer('back', 'suppression').quads; };
  const calm = blurQuads();
  Mutators.suppression = () => 0.8;
  const blurred = blurQuads();
  Game.match.rules = Object.assign({}, rules, { fx: { noHud: true } });
  Hud.applySettings();
  const blurredHardcore = blurQuads();
  Game.match.rules = rules;
  Hud.applySettings();
  Mutators.suppression = suppression;
  check('suppression: shots passing close add the blur bands', calm === 0 && blurred === 1 + HUD_SUPPRESS_BANDS * 4, calm + ' -> ' + blurred);
  check('suppression: the blur stays when the rest of the HUD is hidden (it is gameplay)', blurredHardcore === blurred);
  check('suppression: it is gone when nothing suppresses you', blurQuads() === 0);

  // ---- H04 scope info ----
  hudTestArm(id, 'heron');
  Weapons.ads[id] = 1;
  hudTestPlace(mate, 30, 5, 0);                      // keep the teammate out of the line of sight
  hudTestPlace(enemy, 0, 25, 0);
  hudTestCamera(id);
  const flag = Abilities.passiveFlag;
  Abilities.passiveFlag = () => false;
  hudTestFrame();
  const plain = Hud.quadsOf('crosshair');
  Abilities.passiveFlag = (actor, name) => name === 'scopeInfo';
  hudTestFrame();
  const informed = Hud.quadsOf('crosshair');
  hudTestPlace(enemy, 40, 25, 0);
  hudTestFrame();
  const missed = Hud.quadsOf('crosshair');
  Abilities.passiveFlag = flag;
  check('scope info: a scoped hero sees the health of the enemy under the crosshair', plain > 0 && informed > plain, plain + ' -> ' + informed);
  check('scope info: nothing is shown when no enemy is under it', missed === plain);
}));

Test.add('uiacc', (check) => {
  // ---- HUD cost with every element on (PERF-002) ----
  const cost = hudTestWith(() => {
    const scene = hudTestMatch(), undo = hudTestStubs();
    hudTestFillScene(scene);
    for (const row of HUD_ELEMENTS) Settings.set('hud.element.' + row.id, true);
    Game.match.rules = Object.assign({}, Game.match.rules, { fx: { radar: { mode: 'all', range: 50 } } });
    HudExtra.readRules();
    Actors.vz[scene.enemy] = 4;
    const savedBlind = Gadgets.blindAmount, savedSuppression = Mutators.suppression;
    Gadgets.blindAmount = () => 0.5;
    Mutators.suppression = () => 0.5;
    const ms = hudTestMeasure(HUD_TEST_COST_FRAMES), quads = HudBatch.quads;
    Gadgets.blindAmount = savedBlind; Mutators.suppression = savedSuppression;
    undo();
    return { ms, quads };
  });
  check('cost: a busy HUD with every element on stays under 0.4 ms (PERF-002)', cost.ms <= HUD_TEST_COST_BUDGET_MS, cost.ms.toFixed(3) + ' ms with ' + cost.quads + ' quads');
});

Test.add('uiacc', (check) => hudTestWith(() => uiWith(() => {
  // ---- UI-004 crosshair editor ----
  Ui.open('crosshair');
  const root = Ui.top().element;
  hudTestFrame();
  const preview = HudBatch.layers.find((layer) => layer.name === 'hud.preview');
  check('crosshair editor: the live preview is drawn while the editor is open', CrosshairEditor.open && preview.count > 4);
  const styleRow = Array.from(root.querySelectorAll('.ui-row')).find((row) => row.querySelector('.ui-label').textContent === Settings.definitions.get('hud.crosshair.style').label);
  styleRow.querySelector('button').click();
  check('crosshair editor: a control changes the setting and the preview follows', Settings.get('hud.crosshair.style') === 'dot' && CrosshairEditor.current().style === 'dot');
  CrosshairEditor.target = 'warden';
  CrosshairEditor.write('size', 20);
  const warden = CAT.weapons.byId('warden');
  check('crosshair editor: a weapon override is stored apart and wins for that weapon', Save.data.crosshairs.warden.size === 20 && Hud.crosshairFor(warden).size === 20 && Settings.get('hud.crosshair.size') === 9);
  check('crosshair editor: other weapons keep the default size', Hud.crosshairFor(CAT.weapons.byId('verdict')).size === 9);
  CrosshairEditor.clearOverride();
  check('crosshair editor: removing the override returns to the default', !CrosshairEditor.hasOverride() && Hud.crosshairFor(warden).size === 9);
  CrosshairEditor.target = '';
  CrosshairEditor.write('gap', 10);
  CrosshairEditor.resetAll();
  check('crosshair editor: reset restores the default crosshair and drops every override', Settings.get('hud.crosshair.gap') === 4 && Settings.get('hud.crosshair.style') === 'cross' && Object.keys(Save.data.crosshairs).length === 0);
  const weaponCycle = root.querySelector('.ui-cycle');
  weaponCycle.click();
  check('crosshair editor: the weapon choice selects the weapon to edit and keeps the focus in the panel', CrosshairEditor.target === CAT.weapons[0].id && root.contains(document.activeElement));
  Ui.back();
  hudTestFrame();
  check('crosshair editor: closing it removes the preview', !CrosshairEditor.open && preview.count === 0 && CrosshairEditor.target === '');
})));

Test.add('uiacc', (check) => hudTestWith(() => uiWith(() => {
  // ---- UI-002, ECO-001, VIS-006 rules panel, economy panel, loadout button, tips ----
  Ui.open('play');
  check('play screen: it has a Loadout button that opens the loadout screen', uiClickButton(Ui.top().element, 'Loadout') && Ui.current() === 'loadout');
  Ui.closeAll();
  Game.start({ mode: 'ffa', seed: 1, mutators: ['radar'], bots: [{ dummy: true, team: -1 }], player: { name: 'Me', team: -1 } });
  const rules = Game.match.rules, lines = rulesPanelLines(rules);
  check('rules panel: goal lines name the mode, the objective and the limits', lines.goal[0] === 'Mode: Frenzy' && lines.goal.some((line) => line.startsWith('Limits: first to 25')), lines.goal.join(' | '));
  check('rules panel: rule lines name the ruleset, presets and respawn', lines.setup[0].startsWith('Rule set: Arena Classic') && lines.setup.some((line) => line.startsWith('Health:')) && lines.setup.some((line) => line.startsWith('Respawn')), lines.setup.join(' | '));
  check('rules panel: mutators are listed through Mutators.describe', mutatorLines(rules).join().includes('Motion Tracker'), mutatorLines(rules).join());
  Game.pause('menu');
  const labels = Array.from(Ui.top().element.querySelectorAll('.ui-menu button')).map((button) => button.textContent);
  check('rules panel: the pause menu offers Rules, Economy and Crosshair', ['Rules', 'Economy', 'Crosshair'].every((label) => labels.includes(label)), labels.join());
  uiClickButton(Ui.top().element, 'Rules');
  check('rules panel: the screen shows the running match', Ui.current() === 'rules' && uiScreenText('rules').includes('Frenzy') && uiScreenText('rules').includes('Motion Tracker'));
  Ui.back();
  uiClickButton(Ui.top().element, 'Economy');
  check('economy panel: the screen shows the economy of the match', Ui.current() === 'economy' && uiScreenText('economy').includes('Map Pickups'));
  Ui.closeAll();
  Game.resume();
  const economies = CAT.economy.map((row) => ({ id: row.id, lines: economyPanelLines(Object.assign({}, rules, { economy: row.id })).lines }));
  check('economy panel: every economy explains itself', economies.every((entry) => entry.lines.length > 0), economies.filter((entry) => !entry.lines.length).map((entry) => entry.id).join());
  const roundBuy = economyPanelLines(Object.assign({}, rules, { economy: 'roundBuy' })).lines.join(' ');
  check('economy panel: money economies give the numbers of the preset', roundBuy.includes('$800') && roundBuy.includes('$3000') && roundBuy.includes('$200'), roundBuy);
  Game.stop();
  Ui.open('rules');
  check('rules panel: outside a match it says so', uiScreenText('rules').includes('Start a match'));
  Ui.closeAll();

  Save.data.tips = { matches: 0 };
  const first = Tips.show(), second = Tips.show(), third = Tips.show(), fourth = Tips.show();
  check('tips: one tip in each of the first three matches, then none', first.includes('Move with W A S D') && second.includes('Jump with') && third.includes('scoreboard') && fourth === '', [first, second, third, fourth].join(' | '));
  Save.data.tips = { matches: 0 };
  Settings.set(TIPS_SETTING, false);
  check('tips: the option turns them off', Tips.show() === '');
  Settings.set(TIPS_SETTING, true);
  Input.device = 'touch';
  check('tips: touch players get touch words', Tips.text(0) === TIP_TOUCH_TEXT);
  Input.device = 'kbm';
})));

// ---- Every screen: opens fast, reachable and leavable with each device alone, fonts of at least 14 px ----
const ACCESS_TEST_SCREENS = ['settings', 'bindings', 'help', 'play', 'custom', 'customPresets', 'customShare', 'loadout', 'classEditor', 'touchLayout', 'rules', 'economy', 'crosshair', 'saveTransfer'];

function accessTestSmallText(element) {
  const small = [];
  for (const node of element.querySelectorAll('*')) {
    const hasText = Array.from(node.childNodes).some((child) => child.nodeType === 3 && child.textContent.trim());
    if (hasText && parseFloat(getComputedStyle(node).fontSize) < ACCESS_TEST_MIN_FONT - 0.01) small.push(node.className + ':' + getComputedStyle(node).fontSize);
  }
  return small;
}

// One screen with every device: opens fast, fonts, Tab reaches everything and cycles, the gamepad keeps its focus, and (screens that can be left)
// the keyboard, the gamepad and a touch button each leave it. Top-level screens (main menu, pause, results) cannot be left by Back.
function accessTestScreen(check, name) {
  const started = performance.now();
  const opened = Ui.open(name);
  const openMs = performance.now() - started;
  if (!opened) { check('screen ' + name + ': opens', false, 'did not open'); return; }
  const element = Ui.top().element, items = Ui.focusables(element), first = items[0];
  check('screen ' + name + ': opens in under a second with something to focus', openMs < ACCESS_TEST_SCREEN_COST_MS && items.length > 0 && element.contains(document.activeElement), openMs.toFixed(0) + ' ms, ' + items.length + ' focusables');
  check('screen ' + name + ': all text is at least 14 px at 100% scale (ACC-008)', accessTestSmallText(element).length === 0, accessTestSmallText(element).slice(0, 3).join());
  document.activeElement.blur(); first.focus();
  const seen = new Set();
  for (let step = 0; step < items.length; step++) { seen.add(document.activeElement); uiKey('Tab'); }
  check('screen ' + name + ': Tab reaches every control and comes back (keyboard, no focus trap)', seen.size === items.length && document.activeElement === first, seen.size + ' of ' + items.length);
  let kept = true;
  for (const command of ['next', 'down', 'right', 'up', 'left', 'prev']) { uiMenuCommand(command); kept = kept && element.contains(document.activeElement); }
  check('screen ' + name + ': gamepad navigation keeps the focus inside the screen', kept);
  if (Ui.screens.get(name).noBack) return;
  uiKey('Escape');
  const leftByKeyboard = Ui.current() !== name;
  Ui.open(name);
  uiMenuCommand('back');
  const leftByPad = Ui.current() !== name;
  Ui.open(name);
  const button = Array.from(Ui.top().element.querySelectorAll('button')).find((item) => /^(Back|Done|Close)$/.test(item.textContent));
  if (button) button.click();
  const leftByTouch = !!button && Ui.current() !== name;
  check('screen ' + name + ': it can be left with the keyboard, the gamepad and a touch button', leftByKeyboard && leftByPad && leftByTouch, [leftByKeyboard, leftByPad, leftByTouch].join());
}

// ACC-008 in the style sheets themselves, so screens the walk above never opens are covered too (em = of the 16 px overlay font).
Test.add('uiacc', (check) => {
  const sheets = { UI_CSS, MENUS_CSS, EDITOR_CSS, MAPGEN_MENU_CSS, MAPEDIT_CSS, CAREER_CSS }, small = [];
  for (const name in sheets) {
    for (const match of sheets[name].matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?([\d.]+)(px|em)/g)) {
      const pixels = match[2] === 'em' ? parseFloat(match[1]) * 16 : parseFloat(match[1]);
      if (pixels < ACCESS_TEST_MIN_FONT - 0.01) small.push(name + ' ' + match[0]);
    }
  }
  check('menus: no menu style sets text under 14 px at 100% scale (ACC-008)', small.length === 0, small.join('; '));
});

Test.add('uiacc', (check) => hudTestWith(() => uiWith(() => {
  for (const name of ACCESS_TEST_SCREENS) { accessTestScreen(check, name); Ui.closeAll(); }
  accessTestScreen(check, 'main');
  Ui.closeAll();
  Ui.open('settings', { tab: 'accessibility' });
  const unnamed = Array.from(Ui.top().element.querySelectorAll('.ui-row button, .ui-row input')).filter((control) => !control.getAttribute('aria-labelledby'));
  check('settings: every control of a row has an accessible name (screen readers)', unnamed.length === 0 && Ui.top().element.querySelectorAll('.ui-row input').length > 0, unnamed.length);
  Ui.closeAll();
  Settings.set('ui.scale', 1.5);
  Ui.open('help');
  const scaled = parseFloat(getComputedStyle(Ui.root).fontSize);
  Ui.closeAll();
  Settings.set('ui.scale', 1);
  check('UI scale: the interface scales between 75% and 150%', scaled === 24 && Settings.definitions.get('ui.scale').min === 0.75 && Settings.definitions.get('ui.scale').max === 1.5);
  // screens that exist only inside a match: the buy menu (round buy economy), the pause menu with a dialog on top, the results
  Game.start({ mode: 'bomb', seed: 1, bots: [{ dummy: true, team: 1 }], player: { name: 'Me', team: 0 } });
  accessTestScreen(check, 'buy');
  Ui.closeAll();
  Game.pause('menu');
  const pauseItems = Ui.focusables(Ui.top().element);
  check('screen pause: it has focusable rows and Resume has the focus', pauseItems.length >= 4 && document.activeElement.textContent === 'Resume');
  Ui.closeAll();
  Game.resume();
  Game.pause('menu');
  accessTestScreen(check, 'pause');
  Ui.confirm({ title: 'Test', text: 'Test', yes: 'Yes', onYes: () => {} });
  check('screen confirm: the dialog has the focus on its safe button', Ui.current() === 'confirm' && document.activeElement.textContent === 'Cancel');
  uiKey('Escape');
  check('screen confirm: Escape closes the dialog and the pause menu is back', Ui.current() === 'pause');
  Game.resume();
  Game.end(Game.playerId);
  check('screen results: it opens when the match ends', Ui.current() === 'results');
  accessTestScreen(check, 'results');
  Game.stop();
})));

// ---- Scoreboard on a touch device, with and without the ACC-004 toggle setting: one toggle source, no drift ----
Test.add('uiacc', (check) => uiWith(() => {
  const device = Input.device, index = Input.actionIndex.scoreboard;
  const tap = () => Input.pulseAction(index);              // what the touch button does
  PlayFlow.quickMatch();
  Input.device = 'touch';
  Settings.set('controls.toggle.scoreboard', 'hold'); Input.refreshConfig(); Input.clearAll();
  tap();
  const openedByTap = Ui.current() === 'scoreboard';
  tap();
  check('touch scoreboard, hold setting: a tap opens, the next tap closes', openedByTap && Ui.current() === '');

  Settings.set('controls.toggle.scoreboard', 'toggle'); Input.refreshConfig(); Input.clearAll();
  const states = [];
  for (let taps = 0; taps < 4; taps++) { tap(); states.push(Ui.current() === 'scoreboard'); }
  check('touch scoreboard, toggle setting: every tap flips it (open, closed, open, closed), no double taps', states.join() === 'true,false,true,false', states.join());
  tap();
  uiClickButton(Ui.top().element, 'Close');
  tap();
  check('touch scoreboard, toggle setting: after the Close button the next tap opens it again', Ui.current() === 'scoreboard' && Input.isHeld('scoreboard'));
  Ui.closeAll();
  check('touch scoreboard, toggle setting: closing it any way puts the toggle back to off', !Input.isHeld('scoreboard'));

  Settings.set('controls.toggle.scoreboard', 'hold'); Input.refreshConfig(); Input.clearAll();
  Input.device = device;
}));
