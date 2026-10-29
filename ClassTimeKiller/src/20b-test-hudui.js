// Self-tests for the HUD and UI wiring of M3: the PvE HUD (17g) and Operations tickets, the Solo menu and the Guardian Plate
// choice (18o), the main menu entries, the card and grenade cycle actions, the pause Restart of a career run, loadout gating,
// the custom match difficulty sliders, the live assist rows and the X35 / X36 mutators read by the HUD.

// Draws one frame with the PvE HUD block set to fields (the rest at its match-start defaults); returns the quads of the PvE panel.
function hudUiPveQuads(fields) {
  resetPveHud();
  Object.assign(Modes.hud.pve, { active: true }, fields);
  hudTestFrame();
  return Hud.quadsOf('pve');
}
// The Firing Range drill and the Test Chambers rows a test fills in.
const HUD_UI_WAVE = { mode: 'horde', state: 'fight', wave: 3, waves: 10, enemiesLeft: 12, coreHealth: 600, coreMax: 1000, retriesLeft: 2 };
const HUD_UI_CHAMBER = { mode: 'puzzle', chamber: 2, chambers: 6, chamberTime: 20, steps: 4, portals: 1, stars: 3, medal: 'gold', parTime: PVE_CHAMBERS[1].par.time };
const HUD_UI_RANGE = { mode: 'range', shots: 40, hits: 30, accuracy: 0.75, headshots: 6, damage: 900, kills: 7, drillKills: 4, drillTargets: 10, stateTimeLeft: 12 };
const HUD_UI_BIG_CORE = 5000;   // a Siege Waves core starts here, above the 0..999 number cache

// Counts String() calls while run() draws: the HUD builds a number's text once, never per frame (PERF-006).
function hudUiStringCalls(run) {
  const realString = globalThis.String;
  let calls = 0;
  const counting = (value) => { calls++; return realString(value); };
  Object.setPrototypeOf(counting, realString);   // String.fromCharCode and friends still work while counting
  globalThis.String = counting;
  try { run(); } finally { globalThis.String = realString; }
  return calls;
}

Test.add('hudui', (check) => hudTestWith(() => {
  hudTestMatch();
  const pve = Modes.hud.pve, savedBoss = pve.boss;
  resetPveHud(); hudTestFrame();
  check('pve hud: nothing is drawn outside a PvE mode', Hud.quadsOf('pve') === 0);
  const wave = hudUiPveQuads(HUD_UI_WAVE);
  const shielded = hudUiPveQuads(Object.assign({ coreShield: 300 }, HUD_UI_WAVE));
  check('pve hud: the wave panel draws wave, enemies and the core bar (UI-003)', wave > 0, wave);
  check('pve hud: the core shield adds its own bar', shielded > wave, shielded + ' vs ' + wave);
  check('pve hud: the Guardian Plate offer shows a prompt', hudUiPveQuads(Object.assign({ guardianOffer: true }, HUD_UI_WAVE)) > wave);
  pve.boss = { active: true, id: 1, name: 'Test Warden', health: 0.5, phase: 2, phases: 3, weakDisabled: true };
  const bossed = hudUiPveQuads(HUD_UI_WAVE);
  pve.boss = savedBoss;
  check('pve hud: an active boss adds its bar with the phase pips (E13)', bossed > wave, bossed + ' vs ' + wave);
  for (const mode of ['bank', 'fiends', 'contract']) check('pve hud: ' + mode + ' draws its status row', hudUiPveQuads({ mode, enemiesLeft: 5, awareness: 0.6 }) > 0);
  const chamber = hudUiPveQuads(HUD_UI_CHAMBER);
  check('pve hud: chambers draw the timer row and the medal table (MAP-030)', chamber > hudUiPveQuads(Object.assign({}, HUD_UI_CHAMBER, { chamber: 99 })), chamber);
  check('pve hud: a chamber hint is shown', hudUiPveQuads(Object.assign({ hint: 'Step on the plate' }, HUD_UI_CHAMBER)) > chamber);
  check('pve hud: the Firing Range draws its drill table', hudUiPveQuads(HUD_UI_RANGE) > 0);
  check('pve hud: the medal tier follows the chamber par times', hudPveChamberTier(Object.assign({}, PVE_HUD, HUD_UI_CHAMBER, { chamberTime: 0, steps: 0, portals: 0 })) === 0
    && hudPveChamberTier(Object.assign({}, PVE_HUD, HUD_UI_CHAMBER, { chamberTime: 1e6 })) === -1);
  check('pve hud: the medal table reads its times from PVE_HUD.parTime', chamber > hudUiPveQuads(Object.assign({}, HUD_UI_CHAMBER, { parTime: null })));
  check('pve hud: the range table shows every target down (PVE_HUD.kills)', hudUiPveQuads(Object.assign({}, HUD_UI_RANGE, { kills: 123 })) > hudUiPveQuads(Object.assign({}, HUD_UI_RANGE, { kills: 1 })));
  check('pve hud: Attrition shows the enemies left (NPC-008)', hudUiPveQuads({ mode: 'attrition', enemiesLeft: 5 }) > 0);
  const bigCore = Object.assign({}, HUD_UI_WAVE, { coreHealth: HUD_UI_BIG_CORE, coreMax: HUD_UI_BIG_CORE }), smallCore = Object.assign({}, HUD_UI_WAVE);
  hudUiPveQuads(bigCore);
  const bigCalls = hudUiStringCalls(() => hudUiPveQuads(bigCore)), smallCalls = hudUiStringCalls(() => hudUiPveQuads(smallCore));
  check('pve hud: a steady core of 5000 builds no new text per frame (PERF-006)', bigCalls === smallCalls, bigCalls + ' vs ' + smallCalls);
  check('pve hud: a new large value is built once, then reused', hudNumber(HUD_UI_BIG_CORE - 1) === '4999' && hudLargeNumberText.has(HUD_UI_BIG_CORE - 1) && hudLargeNumberText.size <= HUD_LARGE_NUMBER_LIMIT);
  Settings.set('hud.element.pve', false);
  check('pve hud: the element can be hidden (UI-015)', hudUiPveQuads(HUD_UI_WAVE) === 0);
  Settings.set('hud.element.pve', true);
  resetPveHud();
}));

Test.add('hudui', (check) => hudTestWith(() => {
  const ids = startPveMode('horde', [0, 0], {}, { player: { name: 'Me', team: 0 } });
  hudTestFrame();
  check('pve hud: a real Siege Waves match fills Modes.hud.pve and draws the panel', ids.length > 0 && Modes.hud.pve.active && Modes.hud.pve.mode === 'horde' && Hud.quadsOf('pve') > 0, Hud.quadsOf('pve'));
  Game.stop();
  check('pve hud: a versus match draws no PvE panel', (hudTestMatch(), hudTestFrame(), Hud.quadsOf('pve') === 0));
}));

// The HUD skips empty ability slots (a Siege Waves soul kit has only the ultimate): each drawn button names its own slot's key.
Test.add('hudui', (check) => hudTestWith(() => {
  startPveMode('horde', [0, 0], {}, { player: { name: 'Me', team: 0 } });
  Input.device = 'kbm';
  const slots = Abilities.hudState(Game.playerId, { slots: [], meter: { kind: 'none', value: 0, ready: false } }).slots;
  updateHudLayout(Hud.layout, HUD_TEST_WIDTH, HUD_TEST_HEIGHT);
  const texts = hudTestTexts(hudDrawAbilities);
  const wrong = slots.filter((slot) => texts[texts.indexOf(slot.name) + 1] !== hudBoundLabel(slot.key, 'kbm')).map((slot) => slot.name);
  check('abilities: the kit leaves a slot empty', slots.some((slot, index) => slot.key !== ABILITY_SLOT_NAMES[index]));
  check('abilities: every button shows its own slot key', slots.length > 0 && wrong.length === 0, texts.join());
  Game.stop();
}));

Test.add('hudui', (check) => hudTestWith(() => {
  const map = modesTestMap({ spawns: TEAM_SPAWNS, objectives: [{ id: 'a', kind: 'point', x: 0, y: 0, z: 20, radius: 4 }] });
  startModeTest('dom', map, [0, 1], { player: { name: 'Me', team: 0 }, progress: { kind: 'operation', id: 'hudTest', tickets: [80, 10] } });
  const tickets = hudTestDrawer('main', 'tickets');
  hudTestFrame();
  check('tickets: an Operations match draws both teams\' tickets', OperationRun.active && tickets.quads > 0, tickets.quads);
  OperationRun.active = false;
  hudTestFrame();
  check('tickets: nothing outside an Operation', tickets.quads === 0);
}));

// X35 / X36 end to end: the mutators reach the HUD through Game.start, not by setting the rules by hand.
Test.add('hudui', (check) => {
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true }], mutators: ['radar'] });
  check('X35: the motion tracker mutator reaches the HUD radar', HudExtra.radarMode === 'team' && HudExtra.radarRange === 25, HudExtra.radarMode);
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true }], mutators: ['hardcore'] });
  check('X36: the Hardcore HUD mutator hides the HUD', Hud.noHud === true && HudExtra.radarMode === 'off');
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true }] });
  check('X35 / X36: a plain match has the full HUD and no tracker', Hud.noHud === false && HudExtra.radarMode === 'off');
  Game.stop();
});

// ---- Main menu, Solo, Guardian Plate, Restart ----
Test.add('hudui', (check) => uiWith(() => {
  Ui.open('main');
  let root = Ui.top().element;
  check('main menu: Solo and Generated map are no main entries (P4-03)', !MAIN_MENU_ENTRIES.some((entry) => entry.label === 'Solo' || entry.label === 'Generated map'));
  uiClickButton(root, 'Career');
  check('career: Solo opens the PvE list', uiClickButton(Ui.top().element, 'Solo') && Ui.top().name === 'solo');
  root = Ui.top().element;
  const labels = Array.from(root.querySelectorAll('.ui-menu button')).map((button) => button.textContent);
  check('solo: one button per PvE mode entry', labels.length === CAREER_MODE_ENTRIES.length && labels[0] === careerModeName('horde'), labels.join());
  const started = [], realStart = Game.start;
  Game.start = (setup) => { started.push(setup); return null; };
  SoloMenu.difficulty = 'veteran';
  uiClickButton(root, careerModeName('horde'));
  Game.start = realStart;
  SoloMenu.difficulty = '';
  check('solo: a mode button starts it with the Solo difficulty', started.length === 1 && started[0].mode === 'horde' && (started[0].difficulty === 'veteran' || started[0].difficulty.preset === 'veteran'), JSON.stringify(started[0] && started[0].difficulty));
  Ui.closeAll();
  Ui.open('main');
  const opened = [];
  const listener = Bus.on('ui.range', () => opened.push('range'));
  Game.start = (setup) => { opened.push(setup.mode); return null; };   // 18j answers ui.range by starting the range mode
  uiClickButton(Ui.top().element, 'Range');
  Game.start = realStart;
  Bus.off('ui.range', listener);
  check('main menu: Range emits ui.range and starts the Firing Range', opened.join() === 'range,' + CAREER_RANGE_MODE || opened.join() === 'range', opened.join());
  Ui.closeAll();
  Ui.open('main');
  uiClickButton(Ui.top().element, 'Custom');
  uiClickButton(Ui.top().element, 'Map');
  check('custom: the Map tab opens the generated map seed screen', uiClickButton(Ui.top().element, 'Generate a map') && Ui.top().name === 'mapgen');
}));

Test.add('hudui', (check) => uiWith(() => {
  const ids = startPveMode('horde', [0], {}, { player: { name: 'Me', team: 0 } });
  const pve = Modes.hud.pve, savedAnswer = Pve.answerGuardian, answers = [];
  Pve.answerGuardian = (accept) => { answers.push(accept); pve.guardianOffer = false; return true; };
  Game.pause('menu'); Ui.open('pause');
  const pauseLabels = () => Array.from(Ui.top().element.querySelectorAll('button')).map((button) => button.textContent);
  check('guardian: no pause row while nothing is offered', !pauseLabels().includes('Guardian Plate'));
  Ui.closeAll();
  pve.guardianOffer = true;
  Ui.open('pause');
  check('guardian: the offer adds a pause row (DIF-004)', pauseLabels().includes('Guardian Plate'));
  uiClickButton(Ui.top().element, 'Guardian Plate');
  check('guardian: the row opens the choice', Ui.top().name === 'guardian');
  const dialogText = Ui.top().element.textContent;
  check('guardian: the dialog states the PvE rules (deaths, damage share, offered each wave)', dialogText.includes(PVE_DIRECTOR.guardianDeaths + ' deaths')
    && dialogText.includes(Math.round(PVE_DIRECTOR.guardianTaken * 100) + '%') && dialogText.includes('offered again each wave'), dialogText);
  uiClickButton(Ui.top().element, 'Wear it');
  pve.guardianOffer = true;
  Ui.open('guardian');
  uiClickButton(Ui.top().element, 'Refuse');
  check('guardian: Wear it and Refuse reach Pve.answerGuardian', answers.join() === 'true,false', answers.join());
  Pve.answerGuardian = savedAnswer;
  check('guardian: test match had a player', ids.length > 0);
  Ui.closeAll();
  endModeTest();
}));

Test.add('hudui', (check) => uiWith(() => {
  const marker = 4242;
  Progress.addRetry('hudTest', (tag, setup) => Object.assign({}, setup, { progress: null, seed: marker }));
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true }], player: { name: 'Me' }, progress: { kind: 'hudTest' } });
  Game.pause('menu'); Ui.open('pause');
  uiClickButton(Ui.top().element, 'Restart');
  uiClickButton(Ui.top().element, 'Restart');
  check('pause: Restart of a career run starts its Progress.retrySetup', !!Game.match && Game.match.setup.seed === marker, Game.match && Game.match.setup.seed);
  Progress.retries.delete('hudTest');
  Game.pause('menu'); Ui.open('pause');
  uiClickButton(Ui.top().element, 'Restart');
  uiClickButton(Ui.top().element, 'Restart');
  check('pause: Restart of a plain match starts the same setup', !!Game.match && Game.match.setup.seed === marker && Game.match.setup.mode === 'ffa');
  Ui.closeAll();
  Game.stop();
}));

// ---- Input: card use and the grenade cycle ----
Test.add('hudui', (check) => uiWith(() => {
  const id = startInputMatch();
  check('grenade cycle: the action writes BTN.CYCLE_GRENADE into Actors.buttons', (inputHoldAction('grenadeNext', true), Input.frame(INPUT_TEST_FRAME), (Actors.buttons[id] & BTN.CYCLE_GRENADE) !== 0));
  inputHoldAction('grenadeNext', false); inputStepAndFrame(); inputStepAndFrame();
  check('grenade cycle: the bit is free (no other button shares it)', Object.keys(BTN).filter((key) => BTN[key] === BTN.CYCLE_GRENADE).length === 1 && (Actors.buttons[id] & BTN.CYCLE_GRENADE) === 0);
  check('grenade cycle: a keyboard default and a touch gesture (a swipe on NADE) exist', Input.bound[Input.actionIndex.grenadeNext].length > 0 && TOUCH_CONTROLS.some((row) => row.swipeAction === 'grenadeNext'));
  Game.stop();
  World.load(pveTestMap({ spawns: PVE_HOME.concat(PVE_ENEMY_GATES) }));
  Game.start({ mode: 'horde', seed: 1, bots: [], player: { name: 'Me', team: 0 }, cards: ['stoneskin'] });
  check('cards: an active card enables the touch button and the pause row', CardRun.slots.length === 1 && TouchInput.flags.cards === true && Ui.pauseEntries.includes(CARDS_PAUSE_ENTRY) && CARDS_PAUSE_ENTRY.when());
  Bus.emit('input.action', { action: 'cards', down: true });
  check('cards: the action opens the card screen and pauses (Y / View + RB / touch)', Ui.top() && Ui.top().name === 'cardUse' && Game.paused);
  check('cards: keyboard and gamepad defaults exist', Input.bound[Input.actionIndex.cards].includes('Key:KeyY') && Input.bound[Input.actionIndex.cards].includes('Pad:8+5'));
  Ui.closeAll(); Game.resume();
  Game.stop();
  check('cards: the touch button goes away with the match', TouchInput.flags.cards === false);
  World.clear();
}));

// ---- Loadouts only where the economy hands them out ----
Test.add('hudui', (check) => {
  Game.start({ mode: 'gungame', seed: 1, bots: [{ dummy: true }], player: { name: 'Me' } });
  check('loadout: Gun Game offers no class pick', Economy.modeArmsEveryone() && !Economy.usesLoadouts() && !Economy.usesClasses() && !loadoutAvailable());
  Game.start({ mode: 'tdm', seed: 1, bots: [{ dummy: true, team: 1 }], player: { name: 'Me', team: 0 }, ruleset: 'modern' });
  check('loadout: a class economy offers it', Economy.usesLoadouts() && loadoutAvailable(), Economy.preset().loadout);
  check('loadout: a class economy opens on the Classes tab', Economy.usesClasses() && defaultLoadoutTab() === 'classes');
  Game.start({ mode: 'tdm', seed: 1, bots: [{ dummy: true, team: 1 }], player: { name: 'Me', team: 0 }, ruleset: 'heroes' });
  check('loadout: a hero match uses loadouts but applies no class', Economy.usesLoadouts() && Economy.preset().loadout === 'heroes' && !Economy.usesClasses());
  Game.stop();
});
Test.add('hudui', (check) => uiWith(() => {
  Game.start({ mode: 'tdm', seed: 1, bots: [{ dummy: true, team: 1 }], player: { name: 'Me', team: 0 }, ruleset: 'heroes' });
  Ui.open('loadout');
  const classesTab = LoadoutMenu.tabButtons.get('classes');
  check('loadout: the Classes tab is off in a hero match (a class pick would do nothing)', classesTab.disabled && LoadoutMenu.tab !== 'classes', LoadoutMenu.tab);
  Ui.closeAll();
  Game.start({ mode: 'tdm', seed: 1, bots: [{ dummy: true, team: 1 }], player: { name: 'Me', team: 0 }, ruleset: 'modern' });
  Ui.open('loadout');
  check('loadout: the Classes tab is on in a class match', !LoadoutMenu.tabButtons.get('classes').disabled && LoadoutMenu.tab === 'classes', LoadoutMenu.tab);
  Ui.closeAll();
  Game.stop();
}));

// ---- The stealth label follows the PvE section's own awareness rule; the touch TYPE button needs two grenade types ----
Test.add('hudui', (check) => {
  World.load(pveTestMap());
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }], difficulty: 'regular' });
  check('stealth hud: no guards reads unseen', hudPveMostAwareState() === AWARENESS.UNAWARE);
  const calm = Pve.spawnEnemy('husk', 0, 0, 6, Math.PI), alert = Pve.spawnEnemy('husk', 4, 0, 6, Math.PI);
  Pve.awareness[calm] = 0; Pve.awareness[alert] = 1;
  check('stealth hud: the label is Pve.awarenessState of the most aware guard', hudPveMostAwareState() === AWARENESS.ALERT && hudPveMostAwareState() === Pve.awarenessState(alert));
  Pve.awareness[alert] = PVE_CONTRACT.unaware;
  check('stealth hud: the label follows the guard down to suspicious', hudPveMostAwareState() === Pve.awarenessState(alert) && hudPveMostAwareState() === AWARENESS.SUSPICIOUS);
  Game.stop();
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }], player: { name: 'Me' } });
  const player = Game.playerId;
  Gadgets.count.fill(0, player * GADGET_COUNT, (player + 1) * GADGET_COUNT);
  Gadgets.give(player, 'frag', 2);
  Gadgets.syncCycleButton();
  check('touch: the NADE face names no type with one grenade type (nothing to cycle)', Gadgets.cycleShown === -1);
  Gadgets.give(player, 'smoke', 1); Gadgets.syncCycleButton();
  check('touch: the NADE face names the type with two grenade types', Gadgets.cycleShown === Gadgets.grenade[player] && Gadgets.grenadeTypes(player) === 2);
  Game.stop();
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }], player: { name: 'Me' } });
  check('touch: a new match forgets the last named type (the next step names it again)', Gadgets.cycleShown === -1);
  Game.stop();
  World.clear();
});

// ---- Phones: the PvE side tables and notes stay clear of the default touch buttons and the ammo panel ----
const HUD_UI_RULESET_BUTTONS = ['ability1', 'ability2', 'ultimate', 'gadget'];   // shown only where the ruleset gives abilities or a gadget
// The buttons where TouchInput.placeAll puts them on the layout's screen (the places the layer draws).
function hudPveTouchOverlap(layout, left, top, right, bottom, everything) {
  TouchInput.placeAll(layout.width, layout.height);
  for (const control of TOUCH_CONTROLS) {
    const place = TouchInput.places[control.id], radius = place.radius - 0.5, x = place.x, y = place.y;
    if (!place.shown || control.setting) continue;   // opt-in buttons (left fire) are not default layout
    if (!everything && (control.id === 'stick' || HUD_UI_RULESET_BUTTONS.includes(control.id))) continue;   // the floating stick; ruleset buttons (the PvE tables are drawn where none exist)
    if (x + radius > left && x - radius < right && y + radius > top && y - radius < bottom) return control.id;
  }
  return '';
}
Test.add('hudui', (check) => {
  const layout = {}, savedDevice = Input.device;
  Input.device = 'touch';
  updateHudLayout(layout, 844, 390);
  Input.device = savedDevice;
  hudPvePlaceRows(layout);
  const unit = layout.unit, width = HUD_PVE_SIDE_WIDTH * unit, left = hudPveSideLeft(layout, width), top = hudPveSideTop(layout, hudPveAt[0]);
  const rangeBottom = top + hudPveSideRow(layout) * 11.4;
  check('pve hud on a phone: the range table ends left of the crosshair', left >= layout.left && left + width < layout.centerX, [left, width]);
  check('pve hud on a phone: no touch button over the range table', hudPveTouchOverlap(layout, left, top, left + width, rangeBottom) === '', hudPveTouchOverlap(layout, left, top, left + width, rangeBottom));
  const noteWidth = 260 * unit, noteX = hudPveNoteX(layout, noteWidth), noteY = hudPveNoteY(layout, HUD_PVE_HINT_RISE);
  check('pve hud on a phone: the hint sits above the ammo panel', noteY + 14 * unit <= layout.bottom - 58 * unit, [noteY, layout.bottom]);
  check('pve hud on a phone: no touch button over the hint', hudPveTouchOverlap(layout, noteX - noteWidth / 2, noteY - 14 * unit, noteX + noteWidth / 2, noteY + 14 * unit) === '',
    hudPveTouchOverlap(layout, noteX - noteWidth / 2, noteY - 14 * unit, noteX + noteWidth / 2, noteY + 14 * unit));
  for (const accepted of [false, true]) {
    const text = hudPveGuardianText({ guardianAccepted: accepted }, true), box = hudPveNoteRect(layout, text, HUD_PVE_PROMPT_RISE);
    const over = hudPveTouchOverlap(layout, box.x - box.width / 2, box.y - HUD_PVE_NOTE_HALF * unit, box.x + box.width / 2, box.y + HUD_PVE_NOTE_HALF * unit);
    check('pve hud on a phone: no touch button over the Guardian Plate prompt (' + (accepted ? 'ready' : 'offered') + ')', over === '' && box.x - box.width / 2 >= layout.left - 1, over + ' ' + [box.x, box.width]);
  }
  Input.device = 'kbm';
  updateHudLayout(layout, 1280, 800);
  Input.device = savedDevice;
  check('pve hud on a desktop: the side tables stay at the right edge', hudPveSideLeft(layout, width) + width === layout.right && hudPveNoteX(layout, noteWidth) === layout.centerX);
});

// ---- Phones: the comm wheel (17g) stays on screen and clear of every default touch button, in both hand layouts ----
const HUD_UI_PHONES = [[844, 390], [667, 375], [568, 320]];
const HUD_UI_WHEEL_MIN_SHARE = 0.44;   // of the design radius: the smallest phone with its 14 px labels leaves the ring 0.447
const HUD_UI_ALL_NEEDS = new Proxy({}, { get: () => () => true });   // TouchInput.needs with every need met: each button shown
// touch-01 at the extreme: every button shown (each need met, the left FIRE on) at layout scale 2 and HUD 150 on every screen,
// the landscape ones with a notch too: none on another.
Test.add('hudui', (check) => hudTestWith(() => {
  const needs = TouchInput.needs, leftFire = Input.config.touchLeftFire, savedPreset = TouchInput.currentPreset, savedLayouts = Save.data.touchLayouts, problems = [], places = TouchInput.places;
  try {
    TouchInput.needs = HUD_UI_ALL_NEEDS;
    Save.data.touchLayouts = Object.fromEntries(TOUCH_PRESETS.map((preset) => [preset.id, hudUiGrown()]));
    Input.config.touchLeftFire = true; Input.device = 'touch'; Hud.scale = 1.5;
    for (const notch of [0, 47]) for (const preset of TOUCH_PRESETS) for (const [width, height] of HUD_UI_SCREENS) {
      if (notch && width < height) continue;
      Hud.insets.left = Hud.insets.right = notch; Hud.insets.bottom = notch / 2; TouchInput.currentPreset = preset;
      TouchInput.placeAll(width, height);
      const shown = TOUCH_CONTROLS.map((control) => control.id).filter((id) => places[id].shown);
      const pair = shown.find((a) => shown.some((b) => a !== b && length2(places[a].x - places[b].x, places[a].y - places[b].y) < places[a].radius + places[b].radius - 0.01));
      if (pair) problems.push([notch, preset.id, width, height, pair].join(' '));
    }
  } finally {
    TouchInput.needs = needs; Input.config.touchLeftFire = leftFire; Save.data.touchLayouts = savedLayouts; TouchInput.currentPreset = savedPreset;
    Hud.insets.left = Hud.insets.right = Hud.insets.bottom = 0;
  }
  check('touch-01: every button shown at layout scale 2 and HUD 150, notch or none: none on another', problems.length === 0, problems.slice(0, 3).join('; '));
}));
// Every control at layout scale 2 (the editor's largest).
function hudUiGrown() { return Object.fromEntries(TOUCH_CONTROLS.map((control) => [control.id, { scale: TOUCH_SCALE_MAX }])); }
// The first callout under a touch button or past a screen edge (its icon at the picked size, the largest), or ''.
function hudUiWheelProblem(layout) {
  TouchInput.placeAll(layout.width, layout.height);   // the ring reads the buttons' places
  const unit = layout.unit, ring = commWheelPlaceRing(layout), textHalf = hudTextHalf(HUD_TEXT_SMALL * unit), spot = {};
  for (let i = 0; i < COMM_CALLOUTS.length; i++) {
    const label = COMM_CALLOUTS[i].label;
    commWheelSpotOf(ring, i, true, unit, spot);
    const labelHalf = HudPen.measure(label, HUD_TEXT_SMALL * unit) / 2, iconHalf = spot.size / 2;
    const over = hudPveTouchOverlap(layout, spot.x - labelHalf, spot.labelY - textHalf, spot.x + labelHalf, spot.labelY + textHalf)
      || hudPveTouchOverlap(layout, spot.x - iconHalf, spot.y - iconHalf, spot.x + iconHalf, spot.y + iconHalf);
    if (over) return label + ' under ' + over;
    const reach = Math.max(labelHalf, iconHalf);
    if (spot.x - reach < 0 || spot.x + reach > layout.width || spot.y - iconHalf < 0 || spot.labelY + textHalf > layout.height) return label + ' off screen';
  }
  return '';
}
// The default places, every button at layout scale 2, the left FIRE on, every need met (there a callout may stay under a button
// rather than shrink the ring under its floor).
const HUD_UI_WHEEL_CASES = ['', ', buttons at scale 2', ', left FIRE on', ', every need met'];
Test.add('hudui', (check) => {
  const layout = {}, savedDevice = Input.device, savedPreset = TouchInput.currentPreset, savedLayouts = Save.data.touchLayouts, needs = TouchInput.needs, leftFire = Input.config.touchLeftFire;
  try {
    for (const preset of [TOUCH_PRESETS[0], TOUCH_PRESETS[2]]) {
      TouchInput.currentPreset = preset;
      for (const phone of HUD_UI_PHONES) HUD_UI_WHEEL_CASES.forEach((name, kind) => {
        Save.data.touchLayouts = kind === 1 ? { [preset.id]: hudUiGrown() } : {};
        Input.config.touchLeftFire = kind === 2; TouchInput.needs = kind === 3 ? HUD_UI_ALL_NEEDS : needs;
        Input.device = 'touch';
        updateHudLayout(layout, phone[0], phone[1]);
        Input.device = savedDevice;
        const problem = hudUiWheelProblem(layout), share = commWheelRing.radius / (COMM_WHEEL_RADIUS * layout.unit);
        check('comm wheel on a phone (' + preset.id + ' ' + phone.join('x') + name + '): every callout on screen, ' + (kind === 3 ? 'the ring at its floor or more' : 'none under a touch button'),
          share >= (kind ? COMM_WHEEL_MIN_SHARE : HUD_UI_WHEEL_MIN_SHARE) - 1e-9 && (kind === 3 ? !problem.endsWith('off screen') : problem === ''), problem + ' ' + share);
      });
    }
  } finally {
    TouchInput.currentPreset = savedPreset; Input.device = savedDevice; Save.data.touchLayouts = savedLayouts; TouchInput.needs = needs; Input.config.touchLeftFire = leftFire;
  }
  Input.device = 'kbm';
  updateHudLayout(layout, 1280, 800);
  Input.device = savedDevice;
  const ring = commWheelPlaceRing(layout);
  check('comm wheel on a desktop: the ring stays round the crosshair at full size', ring.x === layout.centerX && ring.y === layout.centerY && ring.radius === COMM_WHEEL_RADIUS * layout.unit);
});

// ---- Custom match difficulty sliders (DIF-002) ----
Test.add('hudui', (check) => {
  const draft = CustomMatch.defaults();
  draft.difficulty = 'veteran';
  draft.difficultySliders = { aggression: 0.2, playerDamage: 0.5 };
  const code = CustomMatch.encode(draft), back = CustomMatch.decode(code);
  check('custom difficulty: the sliders survive a share code', !back.error && back.draft.difficultySliders.aggression === 0.2 && back.draft.difficultySliders.playerDamage === 0.5, back.error);
  check('custom difficulty: an out of range or unknown slider is refused', CustomMatch.validate({ difficultySliders: { aggression: 5 } }).errors.length === 1
    && CustomMatch.validate({ difficultySliders: { nonsense: 1 } }).errors.length === 1 && CustomMatch.validate({ difficultySliders: 3 }).errors.length === 1);
  const setup = CustomMatch.setup(draft, 1, false);
  check('custom difficulty: the setup carries { preset, fields }', setup.difficulty.preset === 'veteran' && setup.difficulty.aggression === 0.2);
  check('custom difficulty: no sliders keep the plain preset id', CustomMatch.setup(CustomMatch.defaults(), 1, false).difficulty === CustomMatch.defaults().difficulty);
  Game.start(setup);
  const skill = Game.match.rules.botSkill;
  check('custom difficulty: the sliders reach rules.botSkill', skill.preset === 'veteran' && skill.aggression === 0.2 && skill.playerDamage === 0.5 && skill.attackers === 4, JSON.stringify(skill));
  Game.stop();
  check('assist rows: every DIF-002 field is live with a slider (the settings group measures each effect)', DIFFICULTY_SLIDERS.every((slider) => ASSIST_ROWS[slider.field].live && ASSIST_DEFINITIONS.has(slider.field)));
});

Test.add('hudui', (check) => uiWith(() => {
  const saved = Settings.get('custom.draft');
  EDITOR_STATE.draft = null;
  CustomMatch.save(CustomMatch.defaults());
  Ui.open('custom');
  const root = Ui.top().element;
  uiClickButton(root, 'Bots');
  const sliders = root.querySelectorAll('input[type="range"]');
  check('custom editor: the Bots tab mounts the difficulty sliders', sliders.length === ASSIST_DEFINITIONS.size, sliders.length);
  const first = sliders[0];
  first.value = first.max; first.dispatchEvent(new Event('input', { bubbles: true }));
  const moved = Object.keys(EDITOR_STATE.draft.difficultySliders).length;
  check('custom editor: moving a slider stores an override on the draft', moved === 1, JSON.stringify(EDITOR_STATE.draft.difficultySliders));
  uiClickButton(root, 'Reset sliders');
  check('custom editor: Reset sliders drops the overrides', Object.keys(EDITOR_STATE.draft.difficultySliders).length === 0);
  Ui.closeAll();
  EDITOR_STATE.draft = null;
  Settings.set('custom.draft', saved);
}));

// ---- Touch: HUD layout, usable buttons, weapon bar taps, help, toasts and gyro ----
Test.add('hudui', (check) => {
  const savedDevice = Input.device, savedPreset = TouchInput.currentPreset, layout = {}, box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });
  Input.device = 'touch';
  for (const [width, height] of [[667, 375], [812, 375], [844, 390]]) {
    for (const preset of TOUCH_PRESETS) {
      TouchInput.currentPreset = preset;
      updateHudLayout(layout, width, height);
      const unit = layout.unit, map = HUD_MAP_SIZE_COMPACT * unit, bar = hudBoxAt;
      hudPlaceWeaponBox(layout, 5, 0);   // a five weapon bar: first box to last
      const first = bar[0], top = bar[1], boxHeight = bar[3];
      hudPlaceWeaponBox(layout, 5, 4);
      const boxes = [box(layout.left, layout.top, map, map), box(layout.left, layout.bottom - layout.vitalsHeight, layout.barWidth, layout.vitalsHeight),
        box(layout.ammoRight - layout.ammoWidth, layout.bottom - layout.ammoHeight, layout.ammoWidth, layout.ammoHeight), box(first, top, bar[0] + bar[2] - first, boxHeight)];   // minimap, vitals, ammo, bar (the header: touch-01 below)
      const found = boxes.map((b, index) => index + hudPveTouchOverlap(layout, b.left, b.top, b.right, b.bottom, true)).filter((text) => text.length > 1);
      check('touch hud: no default button covers the HUD at ' + width + 'x' + height + ' ' + preset.id, found.length === 0, found.join());
    }
  }
  TouchInput.currentPreset = savedPreset; Input.device = savedDevice;
});

// ---- Phones and tablets both ways (touch-01), in modes with each header row, at the default places and with every button the
// layout editor moved to the top or the bottom edge, in play and in the killcam replay:
// 1. no shown touch button on another; 2. none in the aim zone around the crosshair (TOUCH_AIM_ZONE of the short side);
// each at least TOUCH_MIN_DIAMETER across (or its full size when that is smaller) and on its layout spot's half of the screen;
// 3. the banners are drawn, clear of the buttons when a free place exists, and a moved stack stays out of the aim zone;
// 4. no button over a quad the header (score panel, round pips, control meters, objective chips) or the killcam panel draws;
// 5. landscape (auto-fit, 17a): no panel of a full kit (four weapons, three abilities, grenade, gadget and consumables, money in
// the buy time, two powerups, kill feed rows with long names)
// meets another, text 14 px or more ----
const HUD_UI_SCREENS = [[568, 320], [667, 375], [750, 342], [320, 568], [390, 664], [1080, 810], [810, 1080]];   // iPhone SE, 8 and 13 landscape, SE and 13 portrait, iPad
const HUD_UI_MODES = ['ffa', 'elim', 'bomb', 'dom', 'control', 'operation'];   // panel only, pips, pips + chips, chips, pips + meters + chips, tickets (tdm)
const HUD_UI_BANNERS = ['Rook Varga takes the lead', 'Double Kill'];
const HUD_UI_BANNER_GLYPHS = HUD_UI_BANNERS.join('').replace(/ /g, '').length + 2;   // the letters and the medal's two stars
// The [left, top, right, bottom] box of every quad in the HUD batch from quad first on (hudFloats: x y u v, then the colour, per vertex).
function hudUiDrawnBoxes(first) {
  const stride = HUD_VERTEX_BYTES / 4, corners = [0, 1, 2, 3], boxes = [];
  for (let quad = first; quad < HudBatch.quads; quad++) {
    const xs = corners.map((i) => hudFloats[(quad * 4 + i) * stride]), ys = corners.map((i) => hudFloats[(quad * 4 + i) * stride + 1]);
    boxes.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  }
  return boxes;
}
// A box meets a circle (the nearest point of the box is inside it).
function hudUiBoxMeetsCircle(box, x, y, radius) { return length2(clamp(x, box[0], box[2]) - x, clamp(y, box[1], box[3]) - y) < radius; }
// The core buttons a thumb finds by feel: never on the other half, whatever keepsHalf allows (a DUCK beside the stick is a miss).
const HUD_UI_CORE_BUTTONS = ['stick', 'fire', 'jump', 'aim', 'use', 'crouch', 'reload', 'grenade', 'melee', 'swap'];
// What breaks rules 1, 2 and 4 for the shown buttons and rule 3's clear stack, or ''. Touching (half a pixel) is allowed.
function hudUiTouchBreak(fixed, banners, width, height, layout) {
  const places = TouchInput.places, shown = TOUCH_CONTROLS.filter((control) => places[control.id].shown), aimRadius = TOUCH_AIM_ZONE * Math.min(width, height);
  for (const control of shown) {
    const place = places[control.id], radius = place.radius - 0.5, x = place.x, y = place.y;
    const other = shown.find((next) => next !== control && length2(places[next.id].x - x, places[next.id].y - y) < radius + places[next.id].radius - 0.5);
    if (other) return control.id + ' on ' + other.id;
    if (length2(x - width / 2, y - height / 2) < aimRadius + radius) return control.id + ' in the aim zone';
    if (place.radius * 2 < Math.min(TOUCH_MIN_DIAMETER, place.fullRadius * 2) - 0.01) return control.id + ' ' + Math.round(place.radius * 2) + ' px across';
    if (!TouchInput.keepsHalf(place, x, width)) return control.id + ' left its half';
    if (HUD_UI_CORE_BUTTONS.includes(control.id) && (x < width / 2) !== (place.startX < width / 2)) return control.id + ' crossed the centre';
    const over = fixed.find((box) => hudUiBoxMeetsCircle(box, x, y, radius)) || (HudBanners.free && banners.find((box) => hudUiBoxMeetsCircle(box, x, y, radius)));
    if (over) return control.id + ' over ' + over.map(Math.round);
  }
  if (layout.phone) {   // a phone: the newest banner alone, small, on the panel line
    const panel = hudHeaderBox(layout, []);
    const letters = HUD_UI_BANNERS[1].replace(/ /g, '').length;   // each glyph and, at most, its shadow
    if (banners.length < letters || banners.length > 2 * letters) return banners.length + ' banner quads on a phone';
    return banners.some((box) => (box[1] + box[3]) / 2 > panel[1] + panel[3]) ? 'phone banner outside the score panel' : '';
  }
  if (banners.length < HUD_UI_BANNER_GLYPHS) return 'banners hidden';
  const moved = HudBanners.top > height * 0.22 + 0.5;
  return moved && banners.some((box) => hudUiBoxMeetsCircle(box, width / 2, height / 2, aimRadius)) ? 'banners moved onto the crosshair' : '';
}
// The problems of the running match on one screen size: each preset, default and moved places (-1: none moved), in play and replay.
// The panels the buttons must leave uncovered (rule 4): the header with its rows and tickets, the minimap, vitals, ammo, weapon bar.
function hudUiDrawPanels(layout) {
  for (const draw of [hudDrawHeader, hudDrawTickets, hudDrawMinimap, hudDrawVitals, hudDrawAmmo, hudDrawWeaponBar]) draw(HudPen, layout);
}
const HUD_UI_KIT_PANELS = [hudDrawHeader, hudDrawKillFeed, hudDrawMinimap, hudDrawVitals, hudDrawAmmo, hudDrawWeaponBar, hudDrawGadgets, hudDrawAbilities, hudDrawMoney, hudDrawPowerups];
// What breaks rule 5, or the empty string.
function hudUiPanelsMeet(layout) {
  const boxes = HUD_UI_KIT_PANELS.map((draw) => { HudBatch.quads = 0; draw(HudPen, layout); return hudUiDrawnBoxes(0); });
  const meet = (p, q) => Math.min(p[2], q[2]) - Math.max(p[0], q[0]) > 0.5 && Math.min(p[3], q[3]) - Math.max(p[1], q[1]) > 0.5;
  const first = boxes.findIndex((mine, index) => boxes.some((other, next) => next > index && mine.some((p) => other.some((q) => meet(p, q)))));
  return first >= 0 ? HUD_UI_KIT_PANELS[first].name + ' meets a panel' : layout.textFloor < HUD_TEXT_SMALL ? 'text under 14 px' : '';
}
// HUD scale 100%, 125% and 150%; layouts at the defaults (-1) or every button moved to the top or bottom edge, at editor scales 1 to 2.
const HUD_UI_HUD_SCALES = [1, 1.25, 1.5], HUD_UI_EDITS = [[-1, 0], [0.01, 0], [0.99, 0], [-1, 1.5], [-1, 1.75], [-1, 2], [0.01, 2]];
function hudUiTouchProblems(width, height, draw) {
  const layout = {}, problems = [];
  for (const hudScale of HUD_UI_HUD_SCALES) {
    Hud.scale = hudScale;
    for (const preset of TOUCH_PRESETS) {
      TouchInput.currentPreset = preset;
      updateHudLayout(layout, width, height); Hud.textFloor = layout.textFloor;   // as the frame's layout sets it (the fitted scale)
      const meet = width > height && hudUiPanelsMeet(layout);
      if (meet) problems.push([width, height, hudScale, preset.id, meet].join(' '));
      for (const [moved, scale] of HUD_UI_EDITS) {
        const saved = {};
        for (const control of TOUCH_CONTROLS) saved[control.id] = Object.assign(moved < 0 ? {} : { x: control.x, y: moved }, scale ? { scale } : {});
        Save.data.touchLayouts = moved < 0 && !scale ? {} : { [preset.id]: saved };
        for (const replay of [false, true]) {
          Killcam.playing = replay;
          TouchInput.placeAll(width, height);
          HudBatch.quads = 0;
          draw(layout);
          if (replay) hudDrawKillcamPanel(HudPen, layout);
          const fixed = hudUiDrawnBoxes(0), first = HudBatch.quads;
          hudDrawBanners(HudPen, layout);
          const broken = hudUiTouchBreak(fixed, hudUiDrawnBoxes(first), width, height, layout);
          if (broken) problems.push([width, height, hudScale, preset.id, moved, scale, replay, broken].join(' '));
        }
      }
    }
  }
  Hud.applySettings();
  return problems;
}
Test.add('hudui', (check) => hudTestWith(() => {
  const savedPreset = TouchInput.currentPreset, savedLayouts = Save.data.touchLayouts, kit = [Abilities.hudState, Items.activePowerups, Gadgets.hudState, Economy.hudState, Items.consumableCount];
  Items.consumableCount = () => 2;
  Input.device = 'touch'; TouchInput.shown = true;
  Abilities.hudState = (id, out) => { out.slots = ['A1', 'A2', 'ULT'].map((name) => ({ name, ready: true, key: 'ability1', charges: 2 })); return out; };
  Gadgets.hudState = Economy.hudState = (id, out) => Object.assign(out, { grenade: 'frag', grenadeCount: 2, gadget: 'mine', gadgetCount: 1, money: 800, canBuy: true, buyTimeLeft: 20 });
  Items.activePowerups = (id, list) => { list.splice(0, 9, { name: 'Haste', remaining: 5, duration: 10 }, { name: 'Shield', remaining: 5, duration: 10 }); return 2; };
  try {
    for (const mode of HUD_UI_MODES) {
      const operation = mode === 'operation', modeId = operation ? 'tdm' : mode;
      Game.start({ mode: modeId, map: PlayFlow.smallestMap(modeId).id, seed: 1, bots: [{ dummy: true }, { dummy: true }] });
      if (operation) { OperationRun.active = true; OperationRun.tickets.fill(250); }
      for (let slot = 1; slot <= HUD_FIT_WEAPON_SLOTS; slot++) Weapons.owned[Weapons.slotIndex(Game.playerId, CAT.weapons.findIndex((row) => row.slot === slot))] = 1;   // a full weapon bar
      HudBanners.add(HUD_UI_BANNERS[0], 'lead', 1, false); HudBanners.add(HUD_UI_BANNERS[1], 'medal', HUD_BANNER_PRIORITY_LONG, true);
      for (let i = 0; i < 3; i++) Actors.name[i] = 'Maximilian Featherstonehaugh ' + i;   // long names: the touch feed cuts them
      for (let i = 0; i < 3; i++) HudFeed.add({ killer: (i + 1) % 3, victim: i % 3, weapon: 'smg', headshot: true });
      Hud.time += 1;   // the banners are fully faded in
      const problems = HUD_UI_SCREENS.flatMap(([width, height]) => hudUiTouchProblems(width, height, hudUiDrawPanels));
      check('touch-01: buttons apart, off the aim zone, the header and the killcam panel, banners shown, panels apart in ' + mode, problems.length === 0, problems.slice(0, 4).join('; '));
      OperationRun.active = false;
      endModeTest();
    }
  } finally {
    [Abilities.hudState, Items.activePowerups, Gadgets.hudState, Economy.hudState, Items.consumableCount] = kit;
    OperationRun.active = false; Killcam.playing = false; Save.data.touchLayouts = savedLayouts; TouchInput.currentPreset = savedPreset; TouchInput.shown = false;
    TouchInput.applyAll();
  }
}));

Test.add('ui', (check) => {
  const savedTips = Save.data.tips, savedDevice = Input.device, economy = CAT.economy.find((row) => buyKeyAvailable(row)), buyText = () => economyPanelLines(economy).lines.join('\n');
  Save.data.tips = { matches: 0 }; Input.device = 'touch';
  Ui.playBox.replaceChildren(); Ui.toastBox.replaceChildren();
  // The tip is shown from match.start, before Game.start sets the state to playing (the real listener skips headless runs: this one has its timing).
  const tipAtStart = Bus.on('match.start', () => Tips.show());
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: -1 }] });
  Bus.off('match.start', tipAtStart);
  check('toast: the first-match tip lands in the match spot, not at the top (ios-01)', !!Ui.playBox.lastChild && Ui.playBox.lastChild.textContent === Tips.touchText() && !Ui.toastBox.lastChild);
  emitToast('Mutator turned off');
  check('toast: every toast in a match lands there', Ui.playBox.lastChild.textContent === 'Mutator turned off' && !Ui.toastBox.lastChild);
  Game.stop();
  emitToast('Saved');
  check('toast: menus keep the top', Ui.toastBox.lastChild.textContent === 'Saved');
  Ui.playBox.replaceChildren(); Ui.toastBox.replaceChildren();
  check('help: a phone is told the pause menu, not B, and sees its buttons', !buyText().includes('with B') && buyText().includes('pause menu') && controlsSummary().includes('score panel'));
  Input.device = 'gamepad';
  const padText = buyText();
  Input.device = 'kbm';
  const saved = [Input.getBinding('fire', 0), Input.getBinding('fire', 1)];
  Input.setBinding('fire', 0, ''); Input.setBinding('fire', 1, 'Mouse:1');
  check('help: a pad gets the pause menu, a keyboard the key; a key in slot 2 only shows', padText.includes('pause menu') && buyText().includes('with B.') && hudBoundLabel('fire', 'kbm') === Input.bindingLabel('Mouse:1'));
  Input.setBinding('fire', 0, saved[0]); Input.setBinding('fire', 1, saved[1]);
  Save.data.tips = savedTips; Input.device = savedDevice;
});

Test.add('input', (check) => {
  const off = (name) => TouchInput.elements[name].classList.contains('off'), frame = () => Input.frame(INPUT_TEST_FRAME);
  const stale = () => TOUCH_CONTROLS.filter((control) => control.need && off(control.id) === TouchInput.needMet(control.need)).map((control) => control.id);
  const fill = (id) => {
    Abilities.setSlot(id, SLOT.ABILITY1, CAT.abilities[0]);
    Gadgets.give(id, CAT.gadgets.find((row) => row.kind === 'thrown').id, 1);
    Items.carried[id * ITEM_COUNT + CONSUMABLE_ROWS[0].index] = 1;
    Move.setPreset(id, 'modern');
  };
  const empty = (id) => {
    for (const slot of [SLOT.ABILITY1, SLOT.ABILITY2, SLOT.ULTIMATE]) Abilities.setSlot(id, slot, null);
    Gadgets.clearGrenades(id); Gadgets.gadget[id] = -1;
    Items.carried.fill(0);
  };
  let id = startInputMatch();
  Input.setDevice('touch'); TouchInput.syncVisible();
  empty(id);
  frame();
  check('needs: nothing to use hides A1, A2, ULT, GADGET, NADE and HEAL', ['ability1', 'ability2', 'ultimate', 'gadget', 'grenade', 'heal'].every(off));
  fill(id);
  frame();
  check('needs: a filled slot, a grenade and a consumable show only their buttons', !off('ability1') && off('ability2') && !off('grenade') && !off('heal'));
  Move.setPreset(id, '');
  id = startInputMatch();   // the same needs again in the next match
  Input.setDevice('touch'); TouchInput.syncVisible();
  empty(id); fill(id);
  frame();
  check('needs: the next match with the same needs shows the same buttons', stale().length === 0, stale().join());
  Move.setPreset(id, '');
  const savedPreset = TouchInput.currentPreset;
  TouchInput.currentPreset = TOUCH_PRESETS.find((preset) => preset.mirror);
  inputTouchPointer('pointerdown', TouchInput.zone, 10, INPUT_TEST_RIGHT_X, 300);
  check('left-handed: a thumb on the right starts the floating stick', TouchInput.stick.slot !== null);
  inputTouchPointer('pointerup', TouchInput.zone, 10, INPUT_TEST_RIGHT_X, 300);
  TouchInput.currentPreset = savedPreset;
});

Test.add('input', (check) => hudTestWith(() => {
  hudTestMatch();
  runSeconds(3);   // past the start of the round
  const id = Game.playerId, keys = [1, 2, 3, 4].map((slot) => CAT.weapons.find((row) => row.slot === slot).id), swap = TouchInput.elements.swap;
  const tap = (element, pointer, x, y, held) => {
    inputTouchPointer('pointerdown', element, pointer, x, y);
    if (held) TouchInput.findSlot(pointer).startTime -= TOUCH_HOLD_MS * 2;
    inputTouchPointer('pointerup', element, pointer, x, y);
    Input.frame(INPUT_TEST_FRAME); Sim.step();
  };
  Weapons.owned.fill(0);
  keys.forEach((key) => Weapons.give(id, key, 0, true));   // outside the carry limit: all four stay
  Weapons.current[id] = CAT.weapons.byId(keys[2]).index;
  Input.setDevice('touch'); TouchInput.syncVisible();
  Input.frame(INPUT_TEST_FRAME);   // takes the bindings of this save before the tap
  hudTestFrame();
  hudPlaceWeaponBox(Hud.layout, hudCollectOwnedWeapons(id), hudOwned.indexOf(CAT.weapons.byId(keys[1]).index));
  tap(TouchInput.zone, 6, hudBoxAt[0] + hudBoxAt[2] / 2, hudBoxAt[1] + hudBoxAt[3] / 2);
  const picked = () => CAT.weapons[Weapons.state[id] === WEAPON_STATE.SWAP ? Weapons.pending[id] : Weapons.current[id]].slot;
  check('weapon bar: tapping the slot 2 box picks slot 2 within one step', picked() === 2 && TouchInput.stick.slot === null);
  hudPlaceWeaponBox(Hud.layout, hudCollectOwnedWeapons(id), 0);
  const barX = hudBoxAt[0] + hudBoxAt[2] / 2, barY = hudBoxAt[1] + hudBoxAt[3] / 2;
  inputTouchPointer('pointerdown', TouchInput.zone, 9, barX, barY);
  inputTouchPointer('pointermove', TouchInput.zone, 9, barX + 60, barY);
  const stickStarted = TouchInput.stick.slot !== null;
  inputTouchPointer('pointerup', TouchInput.zone, 9, barX + 60, barY);
  Input.frame(INPUT_TEST_FRAME); Sim.step();
  check('weapon bar: a thumb that lands on the bar and drags moves, it picks no slot', barX < window.innerWidth * TOUCH_MOVE_ZONE && stickStarted && picked() === 2, barX + ' ' + stickStarted + ' ' + picked());
  tap(swap, 7, 300, 300, true);
  check('swap: a held SWAP is the previous weapon', (Actors.pressed[id] & BTN.PREV_WEAPON) !== 0);
  tap(swap, 8, 300, 300);
  check('swap: a tapped SWAP is the next weapon', (Actors.pressed[id] & BTN.NEXT_WEAPON) !== 0 && (Actors.pressed[id] & BTN.PREV_WEAPON) === 0);
}));

Test.add('input', async (check) => {
  const realMotion = window.DeviceMotionEvent, secure = Object.getOwnPropertyDescriptor(window, 'isSecureContext'), settle = () => new Promise((done) => setTimeout(done, 0));
  const label = () => Settings.definitions.get(TOUCH_GYRO_KEY).label, gyro = TouchInput.gyro, set = (mode) => Settings.set(TOUCH_GYRO_KEY, mode);
  let asks = 0, answer = 'denied';
  const realOnMotion = TouchInput.onMotion;
  TouchInput.onMotion = () => {};   // a sensor that never reports (some engines send one empty event on listen)
  window.DeviceMotionEvent = function () {};
  window.DeviceMotionEvent.requestPermission = () => { asks++; return Promise.resolve(answer); };
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Ui.lastToast = '';
  try {
    set('off'); Input.refreshConfig(); await settle();
    check('gyro: Off never asks and never listens', asks === 0 && !gyro.attached);
    set('always'); await settle();
    Input.refreshConfig(); TouchInput.requestGyro(); await settle();
    check('gyro: a refused permission asks once, says so and marks the row', asks === 1 && Ui.lastToast === TOUCH_GYRO_MESSAGE && label().includes(TOUCH_GYRO_NOTE));
    set('off');
    answer = 'granted'; set('aiming'); await settle();
    check('gyro: Off clears the mark; a granted permission attaches the sensor, Off detaches it', !label().includes(TOUCH_GYRO_NOTE) && asks === 2 && gyro.attached && (set('off'), !gyro.attached));
    const wait = () => new Promise((done) => setTimeout(done, TOUCH_GYRO_WAIT_MS * 0.6));
    set('always'); await wait();
    set('off'); set('always'); await wait();   // the first sensor wait ends here; the new one has not
    check('gyro: Off then On again does not let the old sensor wait fail the new one', gyro.attached && !gyro.unavailable);
  } finally {
    set('off'); Input.refreshConfig();
    TouchInput.onMotion = realOnMotion;
    if (realMotion === undefined) delete window.DeviceMotionEvent; else window.DeviceMotionEvent = realMotion;
    if (secure) Object.defineProperty(window, 'isSecureContext', secure); else delete window.isSecureContext;
  }
  const upright = { right: 0, down: 0 }, flipped = { right: 0, down: 0 };
  gyroToLook({ beta: 30, gamma: 10 }, -90, upright); gyroToLook({ beta: 30, gamma: 10 }, 270, flipped);
  check('gyro: the old iOS landscape-right angle -90 uses the 270 axes', upright.right === flipped.right && flipped.right !== 0);
});
