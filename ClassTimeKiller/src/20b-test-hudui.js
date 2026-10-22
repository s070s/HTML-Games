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
  check('cards: the action opens the card screen and pauses (Y / Home / touch)', Ui.top() && Ui.top().name === 'cardUse' && Game.paused);
  check('cards: keyboard and gamepad defaults exist', Input.bound[Input.actionIndex.cards].includes('Key:KeyY') && Input.bound[Input.actionIndex.cards].includes('Pad:16'));
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

// ---- P02 touch: HUD layout, need-gated buttons, weapon bar taps, help text, toasts and gyro ----
const HUD_UI_SCREENS = [[667, 375], [812, 375], [844, 390]];   // landscape phones: css px
const HUD_UI_BAR_WEAPONS = 5;

function hudUiRect(left, top, width, height) { return { left, top, right: left + width, bottom: top + height }; }
// The boxes a phone HUD draws that no default button may cover: header (17c), minimap (17f), vitals, ammo panel and the weapon bar (17a).
function hudUiPhoneBoxes(layout) {
  const unit = layout.unit, map = HUD_MAP_SIZE_COMPACT * unit, header = HUD_HEADER_WIDTH * unit;
  hudPlaceWeaponBox(layout, HUD_UI_BAR_WEAPONS, 0);
  const first = hudBoxAt[0], top = hudBoxAt[1], height = hudBoxAt[3];
  hudPlaceWeaponBox(layout, HUD_UI_BAR_WEAPONS, HUD_UI_BAR_WEAPONS - 1);
  return {
    header: hudUiRect(layout.centerX - header / 2, layout.top, header, 44 * unit), minimap: hudUiRect(layout.left, layout.top, map, map),
    vitals: hudUiRect(layout.left, layout.bottom - layout.vitalsHeight, layout.barWidth, layout.vitalsHeight),
    ammo: hudUiRect(layout.ammoRight - layout.ammoWidth, layout.bottom - layout.ammoHeight, layout.ammoWidth, layout.ammoHeight),
    weaponBar: hudUiRect(first, top, hudBoxAt[0] + hudBoxAt[2] - first, height),
  };
}
// The first "control over box" pair of a layout preset at a screen size, or '' when the controls keep clear.
function hudUiTouchOverlap(preset, width, height) {
  const savedPreset = TouchInput.currentPreset, layout = {};
  TouchInput.currentPreset = TOUCH_PRESETS.find((row) => row.id === preset);
  updateHudLayout(layout, width, height);
  const boxes = hudUiPhoneBoxes(layout);
  let found = '';
  for (const name in boxes) {
    const box = boxes[name], control = found ? '' : hudPveTouchOverlap(layout, box.left, box.top, box.right, box.bottom, true);
    if (control) found = control + ' over ' + name + ' at ' + width + 'x' + height + ' ' + preset;
  }
  TouchInput.currentPreset = savedPreset;
  return found;
}

Test.add('hudui', (check) => {
  const savedDevice = Input.device;
  Input.device = 'touch';
  for (const [width, height] of HUD_UI_SCREENS) {
    for (const preset of ['standard', 'compact']) {
      const found = hudUiTouchOverlap(preset, width, height);
      check('touch hud: no default button covers the header, minimap, vitals, ammo or weapon bar at ' + width + 'x' + height + ' ' + preset, found === '', found);
    }
  }
  Input.device = savedDevice;
});

// Toasts and tips in a match go below the header and the top touch buttons.
Test.add('ui', (check) => {
  Ui.playBox.replaceChildren();
  Ui.toast('Match tip', 'play');
  check('toast: a play toast lands in the match spot, not at the top', Ui.playBox.children.length === 1 &&Ui.playBox.lastChild.textContent === 'Match tip' && Ui.toastBox.lastChild !== Ui.playBox.lastChild);
  check('toast: the match spot is below the top touch row', getComputedStyle(Ui.playBox).top !== getComputedStyle(Ui.toastBox).top);
  Ui.playBox.replaceChildren();
  Bus.emit('toast', { text: 'From the bus', placement: 'play' });
  check('toast: the toast event passes the placement on', Ui.playBox.lastChild.textContent === 'From the bus');
  Ui.playBox.replaceChildren();
  const savedTips = Save.data.tips, savedDevice = Input.device;
  Save.data.tips = { matches: 0 }; Input.device = 'touch';
  Tips.show();
  check('toast: the first-match tip is shown in the match spot', Ui.playBox.lastChild && Ui.playBox.lastChild.textContent === TIP_TOUCH_TEXT);
  Ui.playBox.replaceChildren();
  Save.data.tips = savedTips; Input.device = savedDevice;
});

// Help and prompts follow the device in use.
Test.add('ui', (check) => {
  const savedDevice = Input.device, buyRow = CAT.economy.find((row) => buyKeyAvailable(row)), rules = { economy: buyRow.id };
  Input.device = 'touch';
  const touchLines = economyPanelLines(rules).lines.join('\n'), touchControls = controlsSummary();
  check('help: a phone is not told to press B for the buy menu', !touchLines.includes('with B') && touchLines.includes('pause menu'), touchLines);
  check('help: a phone sees the touch buttons with their names', touchControls.includes('TAB: Scoreboard') && touchControls.includes('II: Pause') && touchControls.includes('Edit touch layout'), touchControls);
  Input.device = 'gamepad';
  check('help: a pad is sent to the pause menu for the buy menu too', economyPanelLines(rules).lines.join('\n').includes('pause menu'));
  Input.device = 'kbm';
  check('help: a keyboard player is told the key', economyPanelLines(rules).lines.join('\n').includes('with B.'));
  const savedFire = [Input.getBinding('fire', 0), Input.getBinding('fire', 1)];
  Input.setBinding('fire', 0, ''); Input.setBinding('fire', 1, 'Mouse:1');
  check('prompts: a key bound only in the second slot still shows', hudBoundLabel('fire', 'kbm') === Input.bindingLabel('Mouse:1'), hudBoundLabel('fire', 'kbm'));
  Input.setBinding('fire', 0, savedFire[0]); Input.setBinding('fire', 1, savedFire[1]);
  Input.device = savedDevice;
});

// Only usable buttons show; prone is reachable on touch.
Test.add('input', (check) => {
  const id = startInputMatch();
  Input.setDevice('touch'); TouchInput.syncVisible();
  const off = (name) => TouchInput.elements[name].classList.contains('off');
  const frame = () => Input.frame(INPUT_TEST_FRAME);
  for (const slot of [SLOT.ABILITY1, SLOT.ABILITY2, SLOT.ULTIMATE]) Abilities.setSlot(id, slot, null);
  Gadgets.clearGrenades(id); Gadgets.gadget[id] = -1;
  Items.carried.fill(0);
  frame();
  check('needs: a player with no abilities sees no A1, A2 or ULT', off('ability1') && off('ability2') && off('ultimate'));
  check('needs: no gadget, no grenade and nothing to heal hides GADGET, NADE and HEAL', off('gadget') && off('grenade') && off('heal'));
  Abilities.setSlot(id, SLOT.ABILITY1, CAT.abilities[0]);
  frame();
  check('needs: a filled slot shows its button and only that one', !off('ability1') && off('ability2') && off('ultimate'));
  Gadgets.give(id, CAT.gadgets.find((row) => row.kind === 'thrown').id, 1);
  Items.carried[id * ITEM_COUNT + CONSUMABLE_ROWS[0].index] = 1;
  frame();
  check('needs: a carried grenade and a carried consumable show NADE and HEAL', !off('grenade') && !off('heal'));
  check('needs: the classic movement has no prone, so no PRONE button', off('prone') && Move.preset(id).proneMult === 0);
  Move.setPreset(id, 'modern');
  frame();
  check('needs: the Modern movement shows PRONE', !off('prone'));
  inputTouchPointer('pointerdown', TouchInput.elements.prone, 5, 300, 300);
  frame(); Sim.step();
  check('prone: pressing the touch button sets the prone action', Input.effective[Input.actionIndex.prone] === 1 && (Actors.buttons[id] & BTN.PRONE) !== 0);
  inputTouchPointer('pointerup', TouchInput.elements.prone, 5, 300, 300);
  Move.setPreset(id, '');
});

// The HUD weapon bar is a row of slot buttons on a phone; a held SWAP goes back one weapon.
Test.add('input', (check) => hudTestWith(() => {
  hudTestMatch();
  runSeconds(3);   // past the start of the round
  const id = Game.playerId, keys = [1, 2, 3, 4].map((slot) => CAT.weapons.find((row) => row.slot === slot).id);
  Weapons.owned.fill(0);
  keys.forEach((key) => Weapons.give(id, key, 0, true));   // outside the carry limit: all four stay
  const third = CAT.weapons.byId(keys[2]).index;
  Weapons.current[id] = third;
  Input.setDevice('touch'); TouchInput.syncVisible();
  Input.frame(INPUT_TEST_FRAME);   // takes the bindings of this save before the tap
  hudTestFrame();
  const count = hudCollectOwnedWeapons(id), second = hudOwned.indexOf(CAT.weapons.byId(keys[1]).index);
  hudPlaceWeaponBox(Hud.layout, count, second);
  const x = hudBoxAt[0] + hudBoxAt[2] / 2, y = hudBoxAt[1] + hudBoxAt[3] / 2;
  check('weapon bar: the phone HUD draws the bar', count === 4 && Hud.layout.touch && Hud.quadsOf('weapons') > 0, count + ' ' + Hud.layout.touch + ' ' + Hud.quadsOf('weapons'));
  inputTouchPointer('pointerdown', TouchInput.zone, 6, x, y);
  inputTouchPointer('pointerup', TouchInput.zone, 6, x, y);
  Input.frame(INPUT_TEST_FRAME); Sim.step();
  const wanted = Weapons.state[id] === WEAPON_STATE.SWAP ? Weapons.pending[id] : Weapons.current[id];
  check('weapon bar: tapping the slot 2 box switches to slot 2 within one step', CAT.weapons[wanted].slot === 2, CAT.weapons[wanted].slot);
  check('weapon bar: the tap did not turn the view or start the stick', TouchInput.stick.slot === null && Input.look.assistedX === 0);
  Weapons.current[id] = third; Weapons.state[id] = WEAPON_STATE.IDLE;
  inputTouchPointer('pointerdown', TouchInput.elements.swap, 7, 300, 300);
  TouchInput.findSlot(7).startTime -= TOUCH_HOLD_MS * 2;
  inputTouchPointer('pointerup', TouchInput.elements.swap, 7, 300, 300);
  Input.frame(INPUT_TEST_FRAME); Sim.step();
  check('swap: a held SWAP is the previous weapon', (Actors.pressed[id] & BTN.PREV_WEAPON) !== 0 && (Actors.pressed[id] & BTN.NEXT_WEAPON) === 0);
  inputTouchPointer('pointerdown', TouchInput.elements.swap, 8, 300, 300);
  inputTouchPointer('pointerup', TouchInput.elements.swap, 8, 300, 300);
  Input.frame(INPUT_TEST_FRAME); Sim.step();
  check('swap: a tapped SWAP is the next weapon', (Actors.pressed[id] & BTN.NEXT_WEAPON) !== 0 && (Actors.pressed[id] & BTN.PREV_WEAPON) === 0);
}));

// Gyro: never asks while Off, says so once when it cannot work, reads the old iOS -90 as 270.
Test.add('input', async (check) => {
  const realMotion = window.DeviceMotionEvent, secure = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  const settle = () => new Promise((done) => setTimeout(done, 0));
  let asks = 0, answer = 'denied';
  const stub = function () {};
  stub.requestPermission = () => { asks++; return Promise.resolve(answer); };
  window.DeviceMotionEvent = stub;
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Ui.lastToast = '';
  try {
    Settings.set('controls.touch.gyro', 'off'); Input.refreshConfig();
    TouchInput.syncGyro(Input.config.touchGyro);
    await settle();
    check('gyro: Off never asks for motion access and never listens', asks === 0 && !TouchInput.gyro.attached && !TouchInput.gyro.asked);
    Settings.set('controls.touch.gyro', 'always');
    await settle();
    check('gyro: choosing a mode asks once', asks === 1);
    check('gyro: a refused permission says so once', Ui.lastToast === TOUCH_GYRO_MESSAGE && TouchInput.gyro.unavailable && !TouchInput.gyro.attached);
    check('gyro: the settings row is marked unavailable', Settings.definitions.get(TOUCH_GYRO_KEY).label.includes(TOUCH_GYRO_NOTE));
    Input.refreshConfig();
    TouchInput.syncGyro(Input.config.touchGyro);
    await settle();
    check('gyro: a refused permission is not asked again', asks === 1);
    Settings.set('controls.touch.gyro', 'off');
    check('gyro: switching Off clears the mark', !TouchInput.gyro.unavailable && !Settings.definitions.get(TOUCH_GYRO_KEY).label.includes(TOUCH_GYRO_NOTE));
    answer = 'granted';
    Settings.set('controls.touch.gyro', 'aiming');
    await settle();
    check('gyro: a granted permission attaches the sensor', asks === 2 && TouchInput.gyro.attached);
    Settings.set('controls.touch.gyro', 'off');
    check('gyro: switching Off detaches it', !TouchInput.gyro.attached);
  } finally {
    Settings.set('controls.touch.gyro', 'off'); Input.refreshConfig();
    if (realMotion === undefined) delete window.DeviceMotionEvent; else window.DeviceMotionEvent = realMotion;
    if (secure) Object.defineProperty(window, 'isSecureContext', secure); else delete window.isSecureContext;
  }
  const upright = { right: 0, down: 0 }, flipped = { right: 0, down: 0 };
  gyroToLook({ beta: 30, gamma: 10 }, -90, upright);
  gyroToLook({ beta: 30, gamma: 10 }, 270, flipped);
  check('gyro: the old iOS landscape-right angle -90 uses the 270 axes', Test.near(upright.right, flipped.right, 1e-9) && Test.near(upright.down, flipped.down, 1e-9) && flipped.right !== 0);
});
