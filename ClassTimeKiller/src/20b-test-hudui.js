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
  const texts = [], pen = Object.assign({}, Hud.pen, { textAt: (string) => texts.push(String(string)) });
  updateHudLayout(Hud.layout, HUD_TEST_WIDTH, HUD_TEST_HEIGHT);
  hudDrawAbilities(pen, Hud.layout);
  const wrong = slots.filter((slot) => texts[texts.indexOf(slot.name) + 1] !== hudBoundLabel(slot.key, 'kbm')).map((slot) => slot.name);
  check('abilities: the kit leaves a slot empty, so the drawn buttons are not in slot order', slots.some((slot, index) => slot.key !== ABILITY_SLOT_NAMES[index]), slots.map((slot) => slot.key).join());
  check('abilities: every button shows the key of its own slot', slots.length > 0 && wrong.length === 0, wrong.join() + ' :: ' + texts.join('|'));
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
  check('main menu: Solo opens the PvE list', uiClickButton(root, 'Solo') && Ui.top().name === 'solo');
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
  check('main menu: Generated map opens the seed screen', uiClickButton(Ui.top().element, 'Generated map') && Ui.top().name === 'mapgen');
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
  check('grenade cycle: a keyboard default and a touch button exist', Input.bound[Input.actionIndex.grenadeNext].length > 0 && TOUCH_CONTROLS.some((row) => row.action === 'grenadeNext'));
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
  check('touch: no TYPE button with one grenade type (nothing to cycle)', !TouchInput.needMet('grenadeCycle') && !('grenadeCycle' in TouchInput.flags));
  Gadgets.give(player, 'smoke', 1);
  check('touch: the TYPE button shows with two grenade types', TouchInput.needMet('grenadeCycle') && Gadgets.grenadeTypes(player) === 2);
  Gadgets.cycleShown = true;
  Game.stop();
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }], player: { name: 'Me' } });
  check('touch: a new match forgets the last TYPE button answer (the next step re-shows it)', !Gadgets.cycleShown);
  Game.stop();
  World.clear();
});

// ---- Phones: the PvE side tables and notes stay clear of the default touch buttons and the ammo panel ----
const HUD_UI_RULESET_BUTTONS = ['ability1', 'ability2', 'ultimate', 'gadget'];   // shown only where the ruleset gives abilities or a gadget
function hudPveTouchOverlap(layout, left, top, right, bottom, everything) {
  const place = {};
  for (const control of TOUCH_CONTROLS) {
    if (control.setting) continue;   // opt-in buttons (left fire) are not default layout
    if (!everything && (control.id === 'stick' || HUD_UI_RULESET_BUTTONS.includes(control.id))) continue;   // the floating stick; ruleset buttons (the PvE tables are drawn where none exist)
    TouchInput.layoutOf(control.id, place);
    const radius = control.size * place.scale / 2, x = place.x * layout.width, y = place.y * layout.height;
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
// The first callout under a touch button or past a screen edge (its icon at the picked size, the largest), or ''.
function hudUiWheelProblem(layout) {
  const unit = layout.unit, ring = commWheelPlaceRing(layout), textHalf = commWheelLabelHalf(unit), spot = {};
  for (let i = 0; i < COMM_CALLOUTS.length; i++) {
    const label = COMM_CALLOUTS[i].label;
    commWheelSpotOf(ring, i, true, unit, spot);
    const labelHalf = HudBatch.measure(label, HUD_TEXT_SMALL * unit) / 2, iconHalf = spot.size / 2;
    const over = hudPveTouchOverlap(layout, spot.x - labelHalf, spot.labelY - textHalf, spot.x + labelHalf, spot.labelY + textHalf)
      || hudPveTouchOverlap(layout, spot.x - iconHalf, spot.y - iconHalf, spot.x + iconHalf, spot.y + iconHalf);
    if (over) return label + ' under ' + over;
    const reach = Math.max(labelHalf, iconHalf);
    if (spot.x - reach < 0 || spot.x + reach > layout.width || spot.y - iconHalf < 0 || spot.labelY + textHalf > layout.height) return label + ' off screen';
  }
  return '';
}
Test.add('hudui', (check) => {
  const layout = {}, savedDevice = Input.device, savedPreset = TouchInput.currentPreset;
  try {
    for (const preset of [TOUCH_PRESETS[0], TOUCH_PRESETS[2]]) {
      TouchInput.currentPreset = preset;
      for (const phone of HUD_UI_PHONES) {
        Input.device = 'touch';
        updateHudLayout(layout, phone[0], phone[1]);
        Input.device = savedDevice;
        const problem = hudUiWheelProblem(layout), radius = commWheelRing.radius;
        check('comm wheel on a phone (' + preset.id + ' ' + phone.join('x') + '): every callout on screen, none under a touch button',
          problem === '' && radius >= COMM_WHEEL_RADIUS * layout.unit / 2, problem + ' ' + radius);
      }
    }
  } finally { TouchInput.currentPreset = savedPreset; Input.device = savedDevice; }
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
      const unit = layout.unit, map = HUD_MAP_SIZE_COMPACT * unit, header = HUD_HEADER_WIDTH * unit, bar = hudBoxAt;
      hudPlaceWeaponBox(layout, 5, 0);   // a five weapon bar: first box to last
      const first = bar[0], top = bar[1], boxHeight = bar[3];
      hudPlaceWeaponBox(layout, 5, 4);
      const boxes = [box(layout.centerX - header / 2, layout.top, header, 44 * unit), box(layout.left, layout.top, map, map), box(layout.left, layout.bottom - layout.vitalsHeight, layout.barWidth, layout.vitalsHeight),
        box(layout.ammoRight - layout.ammoWidth, layout.bottom - layout.ammoHeight, layout.ammoWidth, layout.ammoHeight), box(first, top, bar[0] + bar[2] - first, boxHeight)];   // header, minimap, vitals, ammo, bar
      const found = boxes.map((b, index) => index + hudPveTouchOverlap(layout, b.left, b.top, b.right, b.bottom, true)).filter((text) => text.length > 1);
      check('touch hud: no default button covers the HUD at ' + width + 'x' + height + ' ' + preset.id, found.length === 0, found.join());
    }
  }
  TouchInput.currentPreset = savedPreset; Input.device = savedDevice;
});

Test.add('ui', (check) => {
  const savedTips = Save.data.tips, savedDevice = Input.device, economy = CAT.economy.find((row) => buyKeyAvailable(row)), buyText = () => economyPanelLines(economy).lines.join('\n');
  Save.data.tips = { matches: 0 }; Input.device = 'touch';
  Ui.playBox.replaceChildren(); Ui.toastBox.replaceChildren();
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: -1 }] });
  Tips.show();
  check('toast: the first-match tip lands in the match spot, not at the top', Ui.playBox.lastChild.textContent === Tips.touchText() && !Ui.toastBox.lastChild);
  emitToast('Mutator turned off');
  check('toast: any other toast in a running match lands there too', Ui.playBox.lastChild.textContent === 'Mutator turned off' && !Ui.toastBox.lastChild);
  Game.stop();
  emitToast('Saved');
  check('toast: in the menus toasts stay at the top', Ui.toastBox.lastChild.textContent === 'Saved');
  Ui.playBox.replaceChildren(); Ui.toastBox.replaceChildren();
  check('help: a phone is told the pause menu, not B, and sees its buttons', !buyText().includes('with B') && buyText().includes('pause menu') && controlsSummary().includes('TAB: Scoreboard'));
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
  check('needs: nothing to use hides A1, A2, ULT, GADGET, NADE, HEAL and PRONE', ['ability1', 'ability2', 'ultimate', 'gadget', 'grenade', 'heal', 'prone'].every(off));
  fill(id);
  frame();
  check('needs: a filled slot, a grenade, a consumable and prone movement show only their buttons', !off('ability1') && off('ability2') && !off('grenade') && !off('heal') && !off('prone'));
  inputTouchPointer('pointerdown', TouchInput.elements.prone, 5, 300, 300);
  frame(); Sim.step();
  check('prone: pressing the touch button sets the prone action', (Actors.buttons[id] & BTN.PRONE) !== 0);
  inputTouchPointer('pointerup', TouchInput.elements.prone, 5, 300, 300);
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
