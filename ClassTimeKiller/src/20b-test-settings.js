// Self-tests for the settings screens and the wiring check (group 'settings', plan step 16.5): every Settings.define key is written
// (by a settings control or a named internal writer) and read (Settings.readCounts), values round-trip through the save, reset to
// the defaults, the debounced save writes once, and the assist sliders reach the match setup.

DebugApi.settings = Settings;
DebugApi.access = Access;
DebugApi.viewFx = ViewFx;
DebugApi.crosshair = CrosshairEditor;

const SETTINGS_TEST_TABS = SETTINGS_TABS.map(([id]) => id);
// Keys with no control on purpose: the code that writes them is named here, the test proves they are read like any other.
const SETTINGS_INTERNAL_WRITERS = { 'video.autoQuality': 'the renderer benchmark (07e)', 'difficulty.tierShift': 'adaptive difficulty (14a)', 'custom.draft': 'the custom match editor draft (18g)' };
const SETTINGS_SAVE_WAIT_MS = SAVE_DEBOUNCE_MS + 200;

// A valid value different from the default, so a round trip proves something.
function settingTestValue(definition) {
  if (definition.options) return definition.options[(definition.options.indexOf(definition.fallback) + 1) % definition.options.length];
  if (typeof definition.fallback === 'boolean') return !definition.fallback;
  if (definition.min === undefined) return typeof definition.fallback === 'number' ? definition.fallback + 1 : 'changed';
  const span = definition.max - definition.min, step = definition.step || span / 100;
  const target = definition.fallback + span / 2 > definition.max ? definition.fallback - span / 2 : definition.fallback + span / 2;
  return clamp(Math.round(target / step) * step, definition.min, definition.max);
}
function settingTestSame(a, b) { return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b; }

// Reads every setting the way a session does: each owner re-reads on its 'setting' event, a match starts and steps, and the few settings
// read only where they apply (a held grenade, the speech voice, the saved custom draft, the adaptive tier) go through that path once.
function settingTestExerciseReads() {
  Settings.readCounts.clear();
  Settings.applyAll();
  Input.refreshConfig();                                  // the input frame does this before every look sample
  Settings.set('assist.enabled', true);
  Settings.set('difficulty.adaptive', true);
  Game.start(PlayFlow.buildSetup(PlayFlow.normalize({ bots: 2 }), () => 0.5));
  Sim.run(10);
  const id = Game.playerId;
  Gadgets.holdStart[id] = 0;
  Gadgets.holdRow[id] = CAT.gadgets.find((row) => row.cook).index;
  Gadgets.drawPreview({ meshFrom: () => 0 });
  Gadgets.holdStart[id] = Gadgets.holdRow[id] = -1;
  Difficulty.tierShift();
  Progress.unlockAll();
  Tips.show();
  CustomMatch.load();
  Sound.forceActive = true;
  Sound.speak('test');
  Sound.forceActive = false;
  Game.stop();
}

Test.add('settings', (check) => {
  const keys = Array.from(Settings.definitions.keys());
  check('settings: there are many settings, every one with a label and a known category', keys.length > 90 && keys.every((key) => Settings.definitions.get(key).label && SETTINGS_TEST_TABS.includes(Settings.definitions.get(key).category)), keys.length);
  check('settings: every default lies inside its own range and options', keys.every((key) => {
    const definition = Settings.definitions.get(key);
    if (definition.options) return definition.options.includes(definition.fallback);
    return definition.min === undefined || (definition.fallback >= definition.min && definition.fallback <= definition.max && definition.min < definition.max);
  }));
  // A whole-number setting (an integer step) never keeps a fraction from an import (a fractional tier shift or FOV).
  const fov = Settings.validValue(Settings.definitions.get('video.fov'), 90.4), volume = Settings.validValue(Settings.definitions.get('audio.master'), 0.33);
  check('settings: whole-number settings are rounded', fov === 90 && volume === 0.33, fov + ' ' + volume);
  const internal = keys.filter((key) => !isEditableSetting(Settings.definitions.get(key)));
  check('settings: the only keys without a control are the named internal ones', internal.length === Object.keys(SETTINGS_INTERNAL_WRITERS).length && internal.every((key) => SETTINGS_INTERNAL_WRITERS[key]), internal.join());

  // ---- Written: every editable key has a control in its tab ----
  const leave = uiEnter();
  try {
    let missing = [];
    for (const [id] of SETTINGS_TABS) {
      if (!settingKeys(id).length) continue;
      Ui.open('settings', { tab: id });
      const labels = new Set(Array.from(Ui.top().element.querySelectorAll('.ui-scroll .ui-row .ui-label')).map((label) => label.textContent));
      missing = missing.concat(settingKeys(id).filter((key) => !labels.has(Settings.definitions.get(key).label)));
      Ui.closeAll();
    }
    check('settings: every editable setting has a control on its tab (it can be written)', missing.length === 0, missing.join());
    check('settings: every editable setting has a group heading outside the developer tab', keys.every((key) => {
      const definition = Settings.definitions.get(key);
      return !isEditableSetting(definition) || definition.category === 'developer' || Ui.settingGroup(key) !== '';
    }));
  } finally { leave(); }

  // ---- Read: every key is read by its owner after a session of events ----
  settingTestExerciseReads();
  const lazy = keys.filter((key) => !Settings.readCounts.get(key));
  check('settings: every setting is read by its owner (no one-ended settings)', lazy.length === 0, lazy.join());

  // ---- Round trip: set, read back, event, save, reload, reset ----
  const events = [];
  const listener = (key) => events.push(key);
  Bus.on('setting', listener);
  let wrongSet = [], wrongSave = [], wrongReload = [];
  for (const key of keys) {
    const definition = Settings.definitions.get(key), value = settingTestValue(definition);
    events.length = 0;
    Settings.set(key, value);
    if (!settingTestSame(Settings.get(key), value) || !events.includes(key)) wrongSet.push(key);
    if (!settingTestSame(Save.data.settings[key], value)) wrongSave.push(key);
  }
  Save.saveNow();
  const exported = Save.exportText();
  Save.data = Save.emptySave();
  Save.importText(exported);
  for (const key of keys) if (!settingTestSame(Settings.get(key), settingTestValue(Settings.definitions.get(key)))) wrongReload.push(key);
  Bus.off('setting', listener);
  check('settings round trip: every key can be set, announces itself and reads back', wrongSet.length === 0, wrongSet.join());
  check('settings round trip: every key is stored in the save', wrongSave.length === 0, wrongSave.join());
  check('settings round trip: an exported and imported save restores every key', wrongReload.length === 0, wrongReload.join());
  Save.data = null;
  Save.load();
  check('settings round trip: a reload from storage restores the values', settingTestSame(Settings.get('hud.scale'), settingTestValue(Settings.definitions.get('hud.scale'))));
  Save.data = Save.emptySave();
});

Test.add('settings', (check) => {
  // ---- Reset to defaults (tab and everything) ----
  for (const key of Settings.definitions.keys()) Settings.set(key, settingTestValue(Settings.definitions.get(key)));
  Settings.resetKeys(settingKeys('hud'));
  check('reset: a tab returns to its defaults and leaves the other tabs alone', settingKeys('hud').every((key) => settingTestSame(Settings.get(key), Settings.definitions.get(key).fallback))
    && !settingTestSame(Settings.get('video.fov'), Settings.definitions.get('video.fov').fallback));
  Settings.resetKeys(editableSettingKeys());
  check('reset: all settings return to their defaults', editableSettingKeys().every((key) => settingTestSame(Settings.get(key), Settings.definitions.get(key).fallback)));
  check('reset: the saved values are gone, not just overwritten', editableSettingKeys().every((key) => Save.data.settings[key] === undefined));

  const leave = uiEnter();
  try {
    Settings.set('video.fov', 100);
    Ui.open('settings');
    check('reset all: the settings screen has the button', uiClickButton(Ui.top().element, 'Reset all settings') && Ui.current() === 'confirm');
    uiClickButton(Ui.top().element, 'Reset');
    check('reset all: confirming resets every setting', Settings.get('video.fov') === Settings.definitions.get('video.fov').fallback && Ui.current() === 'settings');
  } finally { leave(); }

  // ---- Settings screens: a control changes its setting and the screen is the same one the key lives on ----
  const leaveAgain = uiEnter();
  try {
    Ui.open('settings', { tab: 'accessibility' });
    const row = Array.from(Ui.top().element.querySelectorAll('.ui-row')).find((item) => item.querySelector('.ui-label').textContent === Settings.definitions.get('accessibility.highContrast').label);
    row.querySelector('button').click();
    check('screen: a toggle on the accessibility tab writes its setting', Settings.get('accessibility.highContrast') === true);
    const sliderRow = Array.from(Ui.top().element.querySelectorAll('.ui-row')).find((item) => item.querySelector('.ui-label').textContent === Settings.definitions.get('accessibility.particles').label);
    const input = sliderRow.querySelector('input');
    input.value = 50; input.dispatchEvent(new Event('input'));
    check('screen: a slider writes its setting', Settings.get('accessibility.particles') === 50);
    Ui.closeAll();
  } finally { leaveAgain(); }
});

Test.add('settings', async (check) => {
  // ---- Debounced save (ARC-021, MIS-008): a burst of changes is one write, and a flush writes at once ----
  const counted = Save.storage = makeCountingStorage();
  for (let value = 60; value < 70; value++) Settings.set('video.fov', value);
  check('save: a burst of changes writes nothing yet', counted.writes === 0);
  await uiWait(SETTINGS_SAVE_WAIT_MS);
  check('save: the burst becomes one write after the debounce', counted.writes === 1, counted.writes);
  check('save: the written record holds the last value', JSON.parse(counted.getItem(SAVE_KEY)).settings['video.fov'] === 69);
  Settings.set('video.fov', 75);
  flushSave();
  check('save: flushSave writes at once (page hide, pause)', counted.writes === 2 && JSON.parse(counted.getItem(SAVE_KEY)).settings['video.fov'] === 75);
  await uiWait(SETTINGS_SAVE_WAIT_MS);
  check('save: the flushed change does not write a second time later', counted.writes === 2, counted.writes);
  const broken = makeMemoryStorage(true);
  Save.storage = broken; Save.storageWorks = true; Save.notice = '';
  Settings.set('video.fov', 80);
  let escaped = null;
  try { flushSave(); } catch (error) { escaped = error; }
  check('save: blocked storage never stops the game from changing settings', Settings.get('video.fov') === 80 && escaped === null && !Save.storageWorks, escaped);
  Save.storage = makeMemoryStorage(false); Save.storageWorks = true; Save.notice = '';
});

// R-036: a stored or imported value Settings.set would refuse never reaches a reader.
Test.add('settings', (check) => {
  const bad = { 'video.fov': null, 'ui.scale': 'huge', 'video.frameCap': 45, 'hud.scale': 9999, 'video.headBob': true };
  const read = () => Object.keys(bad).map((key) => Settings.get(key)).join();
  const wanted = (scale) => [FOV_DEFAULT, 1, 0, scale, 100].join();
  Save.write(SAVE_KEY, JSON.stringify({ version: 1, settings: bad }));
  Save.load();
  Settings.applyAll();
  check('settings: bad stored values are dropped or clamped', read() === wanted(HUD_SCALE_MAX) && Render.config.fov === FOV_DEFAULT, read());
  check('settings: an old on/off head bob renders as 100 %', Render.config.headBob === 100, Render.config.headBob);
  Save.importText(JSON.stringify({ version: 1, settings: Object.assign({}, bad, { 'video.fov': 'wide', 'hud.scale': -5 }) }));
  check('settings: imports are checked too', read() === wanted(HUD_SCALE_MIN), read());
  Settings.resetKeys(Object.keys(bad));
});

Test.add('settings', (check) => {
  // ---- Assist sliders (ACC-007, DIF-002) ----
  // A slider that is shown must change something: every live field has a reader here (what the owning section sees), and the fields
  // nobody reads yet have no slider anywhere.
  const liveFields = DIFFICULTY_SLIDERS.filter((slider) => ASSIST_ROWS[slider.field].live);
  check('assist: every slider with a reader has a reader in this test, every other field has no slider', liveFields.every((slider) => ASSIST_EFFECT_READERS[slider.field])
    && DIFFICULTY_SLIDERS.every((slider) => ASSIST_ROWS[slider.field].live || (!Settings.definitions.get('assist.' + slider.field) && !ASSIST_DEFINITIONS.has(slider.field))));
  const unchanged = liveFields.filter((slider) => assistEffect(slider.field, slider.min) === assistEffect(slider.field, slider.max)).map((slider) => slider.field);
  check('assist: moving a live slider from its minimum to its maximum changes what the owning section reads', unchanged.length === 0, unchanged.join());
  check('assist: the player settings are exactly the live assist fields, range from the slider row', DIFFICULTY_SLIDERS.every((slider) => {
    const definition = Settings.definitions.get('assist.' + slider.field), wanted = ASSIST_ROWS[slider.field].live && ASSIST_ROWS[slider.field].assist;
    if (!wanted) return !definition;
    return definition && definition.min === slider.min && definition.max === slider.max && definition.fallback >= slider.min && definition.fallback <= slider.max;
  }));

  const setup = { difficulty: 'nightmare' };
  DifficultyAssist.apply(setup);
  check('assist: switched off, the setup keeps the chosen preset', setup.difficulty === 'nightmare');
  Settings.set('assist.enabled', true);
  const untouched = { difficulty: 'nightmare' };
  DifficultyAssist.apply(untouched);
  check('assist: switched on with every slider neutral, the preset is not overridden', untouched.difficulty.preset === 'nightmare' && Object.keys(untouched.difficulty).length === 1, JSON.stringify(untouched.difficulty));
  Settings.set('assist.gameSpeed', 0.7);
  const built = PlayFlow.buildSetup(PlayFlow.normalize({ difficulty: 'nightmare', bots: 2 }), () => 0.5);
  Game.start(built);
  check('assist: only the sliders the player moved ride on the preset', built.difficulty.preset === 'nightmare' && built.difficulty.gameSpeed === 0.7 && built.difficulty.aimAssist === undefined, JSON.stringify(built.difficulty));
  const skill = Game.match.rules.botSkill;
  check('assist: the preset keeps its bot tiers and behaviour', skill.preset === 'nightmare' && skill.tierMin === 7 && skill.aggression === 1 && skill.attackers === 7 && skill.gameSpeed === 0.7);
  check('assist: game speed scales the simulation clock', Test.near(Sim.timeScale, 0.7, 1e-9), Sim.timeScale);
  Game.stop();
  // A mutator makes 13h reset Sim.timeScale every step: the assist speed must survive that, and kill slow-mo must come back to it.
  built.mutators = ['radar'];
  Game.start(built);
  Sim.run(10);
  check('assist: game speed survives the mutator step hook', Test.near(Sim.timeScale, 0.7, 1e-9), Sim.timeScale);
  Mutators.slowmoLeft = 0.05;
  Sim.run(1);
  check('assist: kill slow-mo halves the assist speed', Test.near(Sim.timeScale, 0.35, 1e-9), Sim.timeScale);
  Sim.run(10);
  check('assist: slow-mo ends back at the assist speed', Test.near(Sim.timeScale, 0.7, 1e-9), Sim.timeScale);
  Game.stop();
  // ACC-007: every start path (career, custom, generated map, restart) goes through Game.start, so a hand-built setup gets the assists too.
  const direct = { mode: 'ffa', seed: 1, difficulty: 'veteran' };
  Game.start(direct);
  check('assist: a setup not built by Play still gets the assist sliders', direct.difficulty.preset === 'veteran' && Game.match.rules.botSkill.gameSpeed === 0.7 && Test.near(Sim.timeScale, 0.7, 1e-9), JSON.stringify(direct.difficulty));
  Game.stop();
  Settings.set('assist.gameSpeed', 1);
  check('assist: the next match starts at normal speed again', (Game.start({ mode: 'ffa', seed: 1 }), Test.near(Sim.timeScale, 1, 1e-9)));
  Game.stop();
  Settings.set('assist.gameSpeed', 0.7);
  // Restart and Play again start the adjusted setup again: assists switched off or moved back since then must come off.
  const restarted = { mode: 'ffa', seed: 1, difficulty: 'regular' };
  Game.start(restarted); Game.stop();
  Settings.set('assist.enabled', false);
  Game.start(restarted);
  check('assist: a restart after switching assists off drops them', restarted.difficulty === 'regular' && !Test.near(Sim.timeScale, 0.7, 1e-9), JSON.stringify(restarted.difficulty));
  Game.stop();
  Settings.set('assist.enabled', true); Settings.set('assist.gameSpeed', 1);
  Game.start(restarted);
  check('assist: a restart after a slider went back to neutral drops it', restarted.difficulty.preset === 'regular' && restarted.difficulty.gameSpeed === undefined, JSON.stringify(restarted.difficulty));
  Game.stop();
  Settings.set('assist.gameSpeed', 0.7);

  Settings.set('assist.aimAssist', 80);
  const floorSetup = { difficulty: 'regular' };
  DifficultyAssist.apply(floorSetup);
  check('assist: the aim assist slider joins the setup', floorSetup.difficulty.aimAssist === 80);
  const device = Input.device;
  Settings.set('controls.pad.aimAssist', 30); Input.refreshConfig();
  Game.start(PlayFlow.buildSetup(PlayFlow.normalize({ difficulty: 'regular', bots: 2 }), () => 0.5));
  Input.device = 'gamepad';
  check('assist: the aim assist floor lifts a weaker device slider', Test.near(Input.assistStrength(), 0.8, 1e-9), Input.assistStrength());
  Input.device = 'kbm';
  check('assist: the floor never reaches the mouse (INP-008)', Input.assistStrength() === 0);
  Input.device = device;
  Game.stop();

  const values = {}, changes = [];
  const container = makeElement('div');
  Ui.difficultyRows(container, values, (field, value) => changes.push(field + '=' + value));
  check('assist: the custom match builder makes one row per live field', container.querySelectorAll('.ui-row').length === liveFields.length);
  const input = container.querySelector('input');
  input.value = 1.2; input.dispatchEvent(new Event('input'));
  check('assist: a builder row writes into the given object', Object.keys(values).length === 1 && changes.length === 1, changes.join());
});

// What the section that owns the field reads for a match started with that slider value (the bots, the loop clock and the input).
const ASSIST_EFFECT_READERS = {
  gameSpeed: () => Sim.timeScale,
  aimAssist: () => {
    const device = Input.device;
    Input.device = 'gamepad';
    const strength = Input.assistStrength();
    Input.device = device;
    return strength;
  },
  reactionScale: () => Bots.reactionScale(),
  aimErrorScale: () => Bots.aimErrorScale(),
  attackers: () => Bots.maxAttackers(),
  aggression: () => {
    for (let id = 0; id < Actors.count; id++) if (id !== Game.playerId) return BotDecide.aggression(id, Game.playerId);
    return -1;
  },
};
// The PvE section (14h-14j) applies these, measured on a spawned brute (rockets, armour drops) and the first participant through
// the PvE code itself: damage scales, the parry window, the rocket speed, drops, the PvE start's lives and the checkpoint revive.
const ASSIST_PARRY_ELAPSED = 0.3;   // seconds since the MELEE press: outside the shortest parry window, inside the longest
const ASSIST_DROP_TRIES = 40;       // brute kills counted for the drop chance (0.5 x yield)
function assistTestEnemy() { return Pve.spawnEnemy('brute', 0, 0, 6, Math.PI); }
function assistFirstParticipant() {
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) return id;
  return -1;
}
function assistRocketSpeed() {
  const brute = assistTestEnemy();
  launchProjectile(brute, Pve.rowOf(brute).attackRows[0], 0);
  for (let slot = 0; slot < PROJECTILE_CAP; slot++) {
    if (Projectiles.state[slot] && Projectiles.owner[slot] === brute) return Math.hypot(Projectiles.vx[slot], Projectiles.vy[slot], Projectiles.vz[slot]);
  }
  return -1;
}
function assistDropCount() {
  const brute = assistTestEnemy(), realDrop = Items.drop;
  let drops = 0;
  Items.drop = () => { drops++; };
  try {
    for (let kill = 0; kill < ASSIST_DROP_TRIES; kill++) Pve.dropLoot(brute, Pve.rowOf(brute), null, Sim.time);
  } finally { Items.drop = realDrop; }
  return drops;
}
// The wave modes revive at a checkpoint with reviveParticipants(skill.checkpointHeal) (14j).
function assistCheckpointHealth() {
  const id = assistFirstParticipant();
  Actors.health[id] = 1;
  reviveParticipants(Pve.skill().checkpointHeal);
  return Actors.health[id];
}
Object.assign(ASSIST_EFFECT_READERS, {
  playerDamage: () => Pve.attackerScale(assistTestEnemy(), assistFirstParticipant()),
  enemyDamage: () => Pve.attackerScale(assistFirstParticipant(), assistTestEnemy()),
  parry: () => {
    const target = assistFirstParticipant();
    Pve.parryAt[target] = Sim.time - ASSIST_PARRY_ELAPSED;
    return Pve.parried(assistTestEnemy(), target, { parry: true, id: 'assistTest', kind: 'melee' });
  },
  lives: () => {
    applyDifficultyLives();
    return Modes.lives[assistFirstParticipant()];
  },
  projectileSpeed: assistRocketSpeed,
  resourceYield: assistDropCount,
  checkpointHeal: assistCheckpointHealth,
});
function assistEffect(field, value) {
  const setting = Settings.get('controls.pad.aimAssist');
  Settings.set('controls.pad.aimAssist', 0); Input.refreshConfig();
  Game.start({ mode: 'ffa', seed: 1, bots: [{}, {}], difficulty: { preset: 'regular', [field]: value } });
  const seen = ASSIST_EFFECT_READERS[field]();
  Game.stop();
  Settings.set('controls.pad.aimAssist', setting); Input.refreshConfig();
  return seen;
}

// ARC-020 / PLT-007 / R-008: Settings > Back up or restore save; the export imports back and restarts the game.
Test.add('settings', (check) => uiWith(() => {
  Save.data.settings['video.fov'] = 77;
  Ui.open('settings');
  check('save transfer: on the first tab', uiClickButton(Ui.top().element, 'Back up or restore save') && Ui.current() === 'saveTransfer');
  const screen = Ui.top().element, area = screen.querySelector('textarea.ui-code');
  uiClickButton(screen, 'Export');
  check('save transfer: Export fills the box with the save', JSON.parse(area.value).settings['video.fov'] === 77);
  Save.data.settings['video.fov'] = 60;
  const reload = SaveTransfer.reload;
  let reloads = 0;
  SaveTransfer.reload = () => { reloads++; };
  uiClickButton(screen, 'Import');
  uiClickButton(Ui.top().element, 'Import');   // the confirm dialog's yes
  check('save transfer: Import restores the exported save, then restarts', Settings.get('video.fov') === 77 && reloads === 1);
  SaveTransfer.reload = reload;
  const anchorClick = HTMLAnchorElement.prototype.click;
  let clicked = null, connected = false;
  HTMLAnchorElement.prototype.click = function recordClick() { clicked = this; connected = this.isConnected; };
  SaveTransfer.download();
  HTMLAnchorElement.prototype.click = anchorClick;
  check('save transfer: the download link is in the page when clicked (Safari / iOS), then removed', connected && clicked && !clicked.isConnected);
}));

// PLT-004: one iPhone / iPad rule (an iPhone agent, or a Mac with touch) for audio and device code; a running match holds
// the wake lock (a controller is no touch: the phone would dim); leaving a text field undoes the iOS keyboard's page shift.
Test.add('settings', async (check) => {
  const agents = [['iPhone', 'iPhone', 1], ['Macintosh', 'MacIntel', 5], ['Macintosh', 'MacIntel', 0], ['Windows', 'Win32', 10]];
  const apple = agents.map(([userAgent, platform, maxTouchPoints]) => { const nav = { userAgent, platform, maxTouchPoints }; return Device.isIos(nav) + '/' + (Sound.configureSession(nav) !== 'none'); });
  check('iPhone and iPad found by one rule', apple.join() === 'true/true,true/true,false/false,false/false', apple.join());
  const calls = [], sentinel = Object.assign(new EventTarget(), { release() { calls.push('release'); return Promise.resolve(); } }), scrollTo = window.scrollTo;
  Object.defineProperty(navigator, 'wakeLock', { value: { request(type) { calls.push(type); return Promise.resolve(sentinel); } }, configurable: true });
  Game.state = 'playing';
  Device.updateWakeLock(); Device.updateWakeLock();
  await Promise.resolve();
  Game.paused = true;
  Device.updateWakeLock();
  check('wake lock: held in a running match only', calls.join() === 'screen,release', calls.join());
  // platforms-03: a lock the system lets go is asked for again (after the retry wait), not left off for the rest of the match.
  Game.paused = false;
  Device.updateWakeLock();
  await Promise.resolve();
  sentinel.dispatchEvent(new Event('release'));
  Device.wakeRetryAt = 0;
  Device.updateWakeLock();
  check('wake lock: asked for again after the system lets it go', calls.join() === 'screen,release,screen,screen' && Device.awake, calls.join());
  Game.paused = true;
  Device.updateWakeLock();
  await Promise.resolve();
  calls.length = 0;
  window.scrollTo = (x, y) => calls.push(x + ',' + y);
  // A background page gets no real focus changes: the event a blur sends.
  Ui.root.appendChild(document.createElement('textarea')).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  check('keyboard: a left field scrolls back', calls.pop() === '0,0', calls.join());
  delete navigator.wakeLock; window.scrollTo = scrollTo; Ui.root.lastChild.remove();
  Game.state = 'menu'; Game.paused = false;
  Device.updateWakeLock();
});

// R-008: persist() is asked once, at the first gesture. The Home Screen tip shows once, in an iOS Safari tab, after a
// finished match and only on the bare main menu (never over the Welcome); a granted persist() needs none. The Home Screen
// app's first start (its own empty save) offers the import.
Test.add('settings', (check) => uiWith(() => {
  let asked = 0;
  Object.defineProperty(navigator, 'storage', { value: { persist: () => { asked++; return Promise.resolve(true); } }, configurable: true });
  const saved = { isIos: Device.isIos, standalone: Device.standalone, persistAsked: Device.persistAsked, persistResult: Device.persistResult };
  const dialogs = () => Ui.stack.filter((entry) => entry.name === 'confirm').length;
  const device = (ios, homeScreen, persisted) => Object.assign(Device, { isIos: () => ios, standalone: () => homeScreen, persistResult: persisted || null });
  try {
    Device.persistAsked = false;
    Device.armPersist();
    window.dispatchEvent(new PointerEvent('pointerdown'));
    window.dispatchEvent(new KeyboardEvent('keydown'));
    check('storage: persist asked once, at a gesture', asked === 1, asked);
    Ui.open('main');
    device(true, false).atReady();
    const atStart = Device.showPendingDialog();
    Game.state = 'results';
    for (const [ios, homeScreen, persisted] of [[false, false], [true, true], [true, false, true]]) device(ios, homeScreen, persisted).homeScreenTip();
    check('home tip: not at start, off iOS Safari, or when persisted', !atStart && !Device.pendingDialog);
    Ui.confirm({ title: 'Welcome', text: '', onYes: () => {} });
    device(true, false).homeScreenTip();
    const waited = !Device.showPendingDialog() && (Game.state = 'menu', !Device.showPendingDialog());
    Ui.back();
    check('home tip: waits for the bare main menu, shows once', waited && Device.showPendingDialog() && dialogs() === 1
      && uiClickButton(Ui.top().element, HOME_SCREEN_TIP.yes) && Ui.current() === 'saveTransfer' && (Device.homeScreenTip(), !Device.pendingDialog));
    Ui.closeAll(); Ui.open('main');
    Save.data = Save.emptySave();
    device(true, true).atReady();
    check('home app: a fresh save offers the import', Device.showPendingDialog() && uiClickButton(Ui.top().element, HOME_SCREEN_IMPORT.yes) && Ui.current() === 'saveTransfer');
  } finally {
    delete navigator.storage;
    Object.assign(Device, saved, { pendingDialog: null });
    Game.state = 'menu';
  }
}));
