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
  check('loadout: Gun Game offers no class pick', !Economy.usesLoadouts() && !loadoutAvailable());
  Game.start({ mode: 'tdm', seed: 1, bots: [{ dummy: true, team: 1 }], player: { name: 'Me', team: 0 }, ruleset: 'modern' });
  check('loadout: a class economy offers it', Economy.usesLoadouts() && loadoutAvailable(), Economy.preset().loadout);
  check('loadout: a class economy opens on the Classes tab', classesApplyInMatch() && defaultLoadoutTab() === 'classes');
  Game.start({ mode: 'tdm', seed: 1, bots: [{ dummy: true, team: 1 }], player: { name: 'Me', team: 0 }, ruleset: 'heroes' });
  check('loadout: a hero match uses loadouts but applies no class', Economy.usesLoadouts() && Economy.preset().loadout === 'heroes' && !classesApplyInMatch());
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

// ---- The stealth label follows the PvE section's own awareness rule; the touch TYPE button waits for its reader ----
Test.add('hudui', (check) => {
  World.load(pveTestMap());
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }], difficulty: 'regular' });
  check('stealth hud: no guards reads unseen', hudPveMostAwareState() === AWARENESS.UNAWARE);
  const calm = Pve.spawnEnemy('husk', 0, 0, 6, Math.PI), alert = Pve.spawnEnemy('husk', 4, 0, 6, Math.PI);
  Pve.awareness[calm] = 0; Pve.awareness[alert] = 1;
  check('stealth hud: the label is Pve.awarenessState of the most aware guard', hudPveMostAwareState() === AWARENESS.ALERT && hudPveMostAwareState() === Pve.awarenessState(alert));
  Pve.awareness[alert] = PVE_CONTRACT.unaware;
  check('stealth hud: the label follows the guard down to suspicious', hudPveMostAwareState() === Pve.awarenessState(alert) && hudPveMostAwareState() === AWARENESS.SUSPICIOUS);
  check('touch: the TYPE button follows the gadget reader', !!TouchInput.flags.grenadeCycle === grenadeCycleLive());
  Game.stop();
  const savedCycle = Gadgets.cycleGrenade;
  Gadgets.cycleGrenade = () => {};
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }] });
  check('touch: the TYPE button shows once Gadgets.cycleGrenade exists', TouchInput.flags.grenadeCycle === true);
  Game.stop();
  if (savedCycle === undefined) delete Gadgets.cycleGrenade; else Gadgets.cycleGrenade = savedCycle;
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: 0 }] });
  check('touch: the TYPE button hides again without it', !!TouchInput.flags.grenadeCycle === grenadeCycleLive());
  Game.stop();
  World.clear();
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
