// Self-tests for the P4 mode merge and the new menu flow (group 'menuflow'): the 31 modes shown as 15 with variants that keep their ids,
// the curated cards and their defaults, Play -> card -> Match setup -> Start in 3 taps, the Advanced round trip to the Custom editor,
// the breadcrumb and the focus return on every input path, LB / RB tab switching, an old save that names merged modes, and the A-07 clocks.

// Every mode id of the build before P4 (spec section 13): each one must stay playable and stay the stored id.
const MENUFLOW_OLD_IDS = ['ffa', 'tdm', 'duel', 'ctf', 'oneflag', 'dom', 'conquest', 'rush', 'hardpoint', 'oddball', 'payload', 'control', 'bomb', 'elim', 'lms', 'gungame',
  'infection', 'juggernaut', 'cursetag', 'royale', 'horde', 'endless', 'bank', 'bearer', 'roulette', 'fiends', 'ghostops', 'contract', 'attrition', 'range', 'puzzle'];
// The P4-02 merge map: parent -> its variant rows.
const MENUFLOW_VARIANTS = { ffa: ['duel', 'lms', 'roulette', 'gungame'], tdm: ['attrition', 'elim'], ctf: ['oneflag'], dom: ['hardpoint', 'conquest', 'control'],
  bomb: ['ghostops', 'rush'], oddball: ['bearer', 'juggernaut', 'cursetag'], horde: ['endless'] };
const MENUFLOW_SINGLE = ['payload', 'infection', 'royale', 'bank', 'fiends', 'contract', 'range', 'puzzle'];

function menuflowOpenPlay() {
  Ui.closeAll(); Ui.open('main');
  uiClickButton(Ui.top().element, 'Play');
}
function menuflowRow(root, name) { return Array.from(root.querySelectorAll('.ui-row')).find((row) => row.firstChild.textContent === name); }
// The value button of a row (the editor wraps it with a Reset button).
function menuflowCycle(root, name) { return menuflowRow(root, name).querySelector('.ui-cycle'); }
// The crumbs of a screen as text: "Play > Holdfast".
function menuflowCrumbs(root) {
  const bar = root.querySelector('.ui-crumbs');
  return bar ? Array.from(bar.children).filter((part) => !part.classList.contains('ui-crumb-sep') && !part.classList.contains('ui-crumb-more')).map((part) => part.textContent).join(' > ') : '';
}
function menuflowBotCount() { return playTestCount(ACTOR_KIND.BOT); }

Test.add('menuflow', (check) => {
  check('modes: the build still has the 31 rows, every old id among them', CAT.modes.length === 31 && MENUFLOW_OLD_IDS.every((id) => CAT.modes.byId(id)) && new Set(MENUFLOW_OLD_IDS).size === 31);
  check('modes: 15 are shown (7 with variants, 8 alone), 16 are variants', modeMenuRows().length === 15 && CAT.modes.filter((row) => row.variantOf).length === 16
    && Object.keys(MENUFLOW_VARIANTS).length === 7 && MENUFLOW_SINGLE.length === 8);
  check('modes: every variant row names its parent from the merge map', Object.entries(MENUFLOW_VARIANTS).every(([parent, ids]) => ids.every((id) => CAT.modes.byId(id).variantOf === parent && CAT.modes.byId(id).variant)
    && modeVariantIds(parent).join() === [parent].concat(ids.slice().sort((a, b) => CAT.modes.findIndex((row) => row.id === a) - CAT.modes.findIndex((row) => row.id === b))).join()));
  check('modes: a parent has a label of its own default variant, a single mode has none', Object.keys(MENUFLOW_VARIANTS).every((id) => CAT.modes.byId(id).variant && !CAT.modes.byId(id).variantOf)
    && MENUFLOW_SINGLE.every((id) => !CAT.modes.byId(id).variant && !CAT.modes.byId(id).variantOf));
  check('modes: a variant reads "<mode> - <variant>", a parent and an unknown id read plainly', modeLabel('duel') === 'Frenzy - Duel 1v1' && modeLabel('hardpoint') === 'Holdfast - Moving hill (Hotpoint)'
    && modeLabel('endless') === 'Siege Waves - Endless (Endless Hold)' && modeLabel('ffa') === 'Frenzy' && modeLabel('payload') === 'Convoy' && modeLabel('nope') === 'nope');
  check('modes: the variant labels keep the old mode name in brackets where it is not in the label', CAT.modes.byId('oneflag').variant.includes('Lone Flag') && CAT.modes.byId('bearer').variant.includes('Flame Bearer')
    && CAT.modes.byId('conquest').variant.includes('Frontline') && CAT.modes.byId('ghostops').variant.includes('Ghost Ops') && CAT.modes.byId('elim').variant.includes('Last Squad'));
  check('modes: the card named endless is a progress card, not the mode (P4-05)', !!CAT.cards.byId('endless') && CAT.modes.byId('endless').variantOf === 'horde' && modeParentId('endless') === 'horde');
  const grouped = MODE_GROUPS.reduce((all, group) => all.concat(group.modes), []);
  check('all modes: the three groups hold each of the 15 menu modes once', MODE_GROUPS.length === 3 && grouped.length === 15 && new Set(grouped).size === 15 && grouped.every((id) => modeMenuRows().some((row) => row.id === id)));
  check('cards: eight, each on a mode and a map that serves it, in the P4-02 order', MODE_CARDS.map((card) => card.name).join() === 'Frenzy,Team Clash,Holdfast,Flag Raid,Detonate,Arms Ladder,Last Ring,Siege Waves'
    && MODE_CARDS.every((card) => Modes.isPlayable(card.mode) && Maps.get(card.map).modes.includes(card.mode)));
  const serves = (map, mode) => !!CAT.modes.byId(mode) && Maps.get(map).modes.includes(mode);
  check('references (P4-05): ladder matches, rooms, operation stages, daily modes, XP weights, Solo entries and map mode lists all still name existing mode rows',
    CAT.ladder.every((row) => row.matches.every((entry) => serves(entry.map, entry.mode))) && CAT.challenges.every((row) => serves(row.map, row.mode))
    && CAT.operations.every((row) => row.stages.every((stage) => serves(stage.map, stage.mode))) && DAILY_RULES.modes.every((id) => !!CAT.modes.byId(id))
    && Object.keys(PROGRESS_XP_MODES).every((id) => !!CAT.modes.byId(id)) && CAREER_MODE_ENTRIES.every((entry) => !!CAT.modes.byId(entry.mode))
    && CAT.maps.every((map) => map.modes.every((id) => !!CAT.modes.byId(id))));
  const control = CAT.modes.byId('control'), fiends = CAT.modes.byId('fiends');
  check('A-07: Uplink rounds last 240 s and Ravager vs Fiends rounds 180 s, in the built rules too', control.rounds.live === 240 && fiends.rounds.live === 180
    && Rules.build({ mode: 'control' }).rounds.live === 240 && Rules.build({ mode: 'fiends' }).rounds.live === 180);
  check('A-07: the other round modes keep their clocks (Detonate 100 s, Last Squad 90 s)', CAT.modes.byId('bomb').rounds.live === 100 && CAT.modes.byId('elim').rounds.live === 90);
});

// The round clocks of the two modes that had none: with nobody acting, a live round ends by the clock (reason 'time') at its limit.
Test.add('menuflow', (check) => {
  for (const [mode, seconds] of [['control', 240], ['fiends', 180]]) {
    Game.start({ mode, map: PlayFlow.mapsFor(mode)[0].id, seed: 1, player: { team: 0 }, bots: [{ dummy: true, team: 1 }] });
    let guard = 0;
    while (Modes.phase !== PHASE.LIVE && guard++ < 3000) Sim.step();
    const start = Modes.roundStart;
    check('A-07: ' + mode + ' goes live with a ' + seconds + ' s clock', Modes.phase === PHASE.LIVE && Math.abs(Modes.roundEndsAt - start - seconds) < 1e-6, Modes.roundEndsAt - start);
    guard = 0;
    while (Modes.phase === PHASE.LIVE && guard++ < (seconds + 5) * TICK_RATE) Sim.step();
    const length = Sim.time - start;
    check('A-07: ' + mode + ' round ends by the clock after ' + seconds + ' s, reason time', Modes.phase !== PHASE.LIVE && Modes.roundReason === 'time' && Math.abs(length - seconds) < 0.1, Modes.phase + ' ' + Modes.roundReason + ' ' + length.toFixed(2));
    Game.stop();
  }
});

// Every old id is reachable through Play > All modes > mode > Variant > Start, and starts as that very id.
Test.add('menuflow', (check) => uiWith(() => {
  const failed = [];
  for (const id of MENUFLOW_OLD_IDS) {
    const parent = modeParentId(id);
    menuflowOpenPlay();
    uiClickButton(Ui.top().element, 'All modes');
    const tile = Ui.top().element.querySelector('[data-mode="' + parent + '"]');
    if (!tile) { failed.push(id + ': no tile'); continue; }
    tile.click();
    const root = Ui.top().element;
    let guard = 0;
    while (PlaySetup.state.choice.mode !== id && menuflowRow(root, 'Variant') && guard++ < 8) menuflowCycle(root, 'Variant').click();
    uiClickButton(root, 'Start');
    if (!Game.match || Game.match.rules.mode !== id) failed.push(id + ': started ' + (Game.match ? Game.match.rules.mode : 'nothing'));
    else if (Save.data.play.mode !== id) failed.push(id + ': remembered ' + Save.data.play.mode);
    Game.stop();
  }
  check('flow: all 31 old mode ids start through Play > All modes > mode > Variant > Start and are remembered as that id', failed.length === 0, failed.join('; '));
  menuflowOpenPlay();
  uiClickButton(Ui.top().element, 'All modes');
  const tiles = Array.from(Ui.top().element.querySelectorAll('.pm-tile'));
  check('all modes: 15 tiles in the three groups, variants counted on the tile', tiles.length === 15 && Ui.top().element.querySelectorAll('.ui-group').length === 3
    && tiles.find((tile) => tile.dataset.mode === 'ffa').textContent.includes('5 variants') && !tiles.find((tile) => tile.dataset.mode === 'payload').textContent.includes('variants'));
  const variantLabels = (parent) => {
    Ui.closeAll(); Ui.open('playSetup', { mode: parent });
    const cycle = menuflowCycle(Ui.top().element, 'Variant'), seen = [];
    for (let i = 0; i < 12; i++) { if (seen.includes(cycle.textContent)) break; seen.push(cycle.textContent); cycle.click(); }
    return seen;
  };
  check('setup: the Variant row lists the parent first, then every variant label of the merge map', Object.keys(MENUFLOW_VARIANTS).every((parent) => variantLabels(parent).join() === modeVariantIds(parent).map((id) => CAT.modes.byId(id).variant).join()));
  Ui.closeAll(); Ui.open('playSetup', { mode: 'payload' });
  check('setup: a single mode has no Variant row', menuflowRow(Ui.top().element, 'Variant') === undefined);
}));

// The curated cards: 3 taps from the main menu, each match with the P4-02 defaults.
Test.add('menuflow', (check) => uiWith(() => {
  const expectations = {
    frenzy: (rules) => rules.scoreLimit === 25 && rules.timeLimit === 600,
    teamclash: (rules) => rules.scoreLimit === 50 && rules.timeLimit === 600 && rules.friendlyFire === 0,
    holdfast: (rules) => rules.scoreLimit === 200 && rules.timeLimit === 600,
    flagraid: (rules) => rules.scoreLimit === 3 && rules.timeLimit === 900 && rules.params.returnTime === 20,
    detonate: (rules) => rules.rounds.winsNeeded === 5 && rules.rounds.limit === 9 && rules.rounds.switchAt === 4 && rules.rounds.freeze === 15 && rules.rounds.live === 100,
    armsladder: (rules) => rules.params.ladder.length === 12 && rules.timeLimit === 600,
    lastring: (rules) => rules.params.squadSize === 3,
    siegewaves: (rules) => rules.params.coreHealth === 5000 && rules.params.retries === 2,
  };
  const problems = [];
  for (const card of MODE_CARDS) {
    Ui.closeAll(); Ui.open('main');
    let taps = 0;
    const tap = (root, text) => { taps++; return uiClickButton(root, text); };
    tap(Ui.top().element, 'Play');
    tap(Ui.top().element, card.name);
    tap(Ui.top().element, 'Start');
    const mode = CAT.modes.byId(card.mode), match = Game.match;
    if (!match || Game.state !== 'playing') { problems.push(card.id + ': no match'); continue; }
    const rules = match.rules, bots = Math.min(mode.sizeDefault - 1, PlayFlow.maxBots());
    if (taps !== 3) problems.push(card.id + ': ' + taps + ' taps');
    if (rules.mode !== card.mode) problems.push(card.id + ': mode ' + rules.mode);
    if (match.map.id !== card.map) problems.push(card.id + ': map ' + match.map.id);
    if (rules.id !== mode.ruleset) problems.push(card.id + ': ruleset ' + rules.id);
    if (menuflowBotCount() !== bots) problems.push(card.id + ': ' + menuflowBotCount() + ' bots, wanted ' + bots);
    if (rules.difficulty !== 'regular') problems.push(card.id + ': difficulty ' + rules.difficulty);
    if (!expectations[card.id](rules)) problems.push(card.id + ': limits');
    Game.stop();
  }
  check('cards: every card starts its mode, map, ruleset, bots, difficulty and limits in 3 taps (Play, card, Start)', problems.length === 0, problems.join('; '));
  Ui.closeAll(); Ui.open('main'); uiClickButton(Ui.top().element, 'Play'); uiClickButton(Ui.top().element, 'Detonate');
  check('cards: Detonate shows first to 5 rounds on its setup; 7 stays under Advanced', Ui.top().element.querySelector('.pm-summary').textContent.includes('first to 5 rounds') && PlaySetup.state.choice.roundWins === 5);
  uiClickButton(Ui.top().element, 'Advanced');
  check('cards: the editor is prefilled with first to 5 and offers 7', EDITOR_STATE.draft.roundWins === 5 && EDITOR_ROUND_WINS.includes(7));
  Ui.closeAll(); Ui.open('playSetup', { mode: 'ghostops' });
  check('cards: another Detonate variant brings its own 7 rounds', PlaySetup.state.choice.roundWins === -1 && Ui.top().element.querySelector('.pm-summary').textContent.includes('first to 7 rounds'));
  Ui.closeAll();
  Save.data.play = null;
  Ui.open('main');
  uiClickButton(Ui.top().element, 'Quick Match');
  check('quick match: still one press, and a new save gets the Frenzy card defaults', Game.state === 'playing' && Game.match.rules.mode === 'ffa' && Game.match.map.id === 'spire' && menuflowBotCount() === 7);
  Game.stop();
}));

// Advanced: the Custom editor is prefilled from Match setup, Back keeps its changes, Match setup shows them with a reset.
Test.add('menuflow', (check) => uiWith(() => {
  menuflowOpenPlay();
  uiClickButton(Ui.top().element, 'Holdfast');
  let root = Ui.top().element;
  const slider = menuflowRow(root, 'Bots').querySelector('input');
  slider.value = 5; slider.dispatchEvent(new Event('input'));
  menuflowCycle(root, 'Match length').click();
  uiClickButton(root, 'Advanced');
  check('advanced: Advanced opens the Custom editor, breadcrumb Play > Holdfast > Advanced', Ui.current() === 'custom' && menuflowCrumbs(Ui.top().element) === 'Play > Holdfast > Advanced');
  const prefilled = CustomMatch.load();
  check('advanced: the draft holds the card: mode, map, bots, difficulty and the long match as limits', prefilled.mode === 'dom' && prefilled.map === 'twinkeeps' && prefilled.botCount === 5
    && prefilled.difficulty === 'regular' && prefilled.scoreLimit === 300 && prefilled.timeLimit === 900 && prefilled.mutators.length === 0 && prefilled.bundle === '', JSON.stringify(prefilled));
  const editor = Ui.top().element;
  check('advanced: the Mode tab shows the parent as Game mode and the row as Variant', menuflowCycle(editor, 'Game mode').textContent === 'Holdfast' && menuflowCycle(editor, 'Variant').textContent === 'Three points');
  CustomMatch.turnOnMutator(EDITOR_STATE.draft, 'gravity');
  EDITOR_STATE.draft.bundle = 'tactical';
  editorChanged();
  const variantCycle = menuflowCycle(editor, 'Variant');
  let guard = 0;
  while (variantCycle.textContent !== CAT.modes.byId('hardpoint').variant && guard++ < 6) menuflowCycle(editor, 'Variant').click();
  check('advanced: the editor picks a variant row (Hotpoint) and the summary names it', EDITOR_STATE.draft.mode === 'hardpoint' && editor.querySelector('.ui-sub').textContent.includes('Holdfast - Moving hill (Hotpoint)'));
  uiClickButton(editor, 'Back');
  root = Ui.top().element;
  const note = root.querySelector('.pm-changes'), tactical = CAT.rulesets.byId('tactical').name;
  check('advanced: Back returns to Match setup with the changes kept: variant, random map, the note', Ui.current() === 'playSetup' && menuflowCycle(root, 'Variant').textContent === CAT.modes.byId('hardpoint').variant
    && menuflowCycle(root, 'Map').textContent === 'Random' && note.textContent === 'Advanced changes: ' + tactical + ', 1 mutator.' && !note.hidden, note.textContent);
  check('advanced: the breadcrumb stays Play > Holdfast and Advanced gets the focus back', menuflowCrumbs(root) === 'Play > Holdfast' && document.activeElement.textContent === 'Advanced');
  uiClickButton(root, 'Start');
  const match = Game.match;
  check('advanced: Start on Match setup uses the editor changes (variant, bundle, mutator, 5 bots) and remembers the editor start',
    match && match.rules.mode === 'hardpoint' && match.rules.id === 'tactical' && match.rules.mutators.some((entry) => entry.id === 'gravity') && menuflowBotCount() === 5 && isPlainObject(Save.data.play.advanced) && Save.data.play.advanced.draft.mode === 'hardpoint');
  Game.stop();
  PlayFlow.quickMatch();
  check('advanced: Quick Match replays the editor draft after an Advanced start', Game.match.rules.mode === 'hardpoint' && Game.match.rules.mutators.some((entry) => entry.id === 'gravity'));
  Game.stop();
  menuflowOpenPlay();
  uiClickButton(Ui.top().element, 'Holdfast');
  uiClickButton(Ui.top().element, 'Advanced');
  EDITOR_STATE.draft.bundle = 'tactical'; editorChanged();
  uiClickButton(Ui.top().element, 'Back');
  root = Ui.top().element;
  check('advanced: the note shows again, with a reset button named for the card', !root.querySelector('.pm-changes').hidden && uiClickButton(root, 'Reset to card defaults'));
  check('advanced: Reset to card defaults drops the changes: the card mode, its map, no note', PlaySetup.state.choice.mode === 'dom' && PlaySetup.state.choice.map === 'twinkeeps' && !PlaySetup.state.advanced
    && root.querySelector('.pm-changes').hidden && menuflowCycle(root, 'Variant').textContent === 'Three points');
  uiClickButton(root, 'Start');
  check('advanced: a start from Match setup after the reset is the plain card start and clears the editor flag', Game.match.rules.mode === 'dom' && Game.match.rules.id === 'modern'
    && Game.match.rules.mutators.length === 0 && Save.data.play.advanced === undefined);
  Game.stop();
  Ui.closeAll();
  Ui.open('custom');
  check('advanced: Custom from the main menu keeps its own breadcrumb, Custom', menuflowCrumbs(Ui.top().element) === 'Custom');
  Ui.closeAll();
  check('advanced: a Reset-to-defaults card (a mode without a card) says so', (Ui.open('playSetup', { mode: 'oddball' }), uiClickButton(Ui.top().element, 'Reset to mode defaults')));
}));

// Breadcrumb and Back: keyboard, gamepad and touch paths.
Test.add('menuflow', (check) => uiWith(() => {
  const focused = () => document.activeElement;
  menuflowOpenPlay();
  check('breadcrumb: the main menu has none and Play shows "Play"', Ui.stack[0].element.querySelector('.ui-crumbs') === null && menuflowCrumbs(Ui.top().element) === 'Play');
  check('focus: Play opens with the last started card focused (a new save: Frenzy)', focused().dataset.card === 'frenzy');
  // Gamepad: the d-pad moves, A opens, B goes back.
  uiMenuCommand('right'); uiMenuCommand('right');
  check('gamepad: the d-pad moves across the cards', focused().dataset.card === 'holdfast');
  uiMenuCommand('accept');
  const setupRoot = Ui.top().element;
  check('gamepad: A opens Match setup, breadcrumb Play > Holdfast, Start focused', Ui.current() === 'playSetup' && menuflowCrumbs(setupRoot) === 'Play > Holdfast' && focused().textContent === 'Start');
  const ring = Ui.focusables(setupRoot);
  let onCrumb = ring.some((item) => item.closest('.ui-crumbs'));
  for (let step = 0; step < ring.length + 2; step++) { uiMenuCommand('next'); if (focused() && focused().closest('.ui-crumbs')) onCrumb = true; }
  check('breadcrumb: the crumbs are never in the focus order (gamepad next, keyboard Tab)', !onCrumb && setupRoot.querySelectorAll('.ui-crumbs button, .ui-crumbs [tabindex]').length === 0);
  check('focus order: Back, the rows, then Start, Loadout, Advanced, Reset to card defaults', ring[0].textContent === 'Back' && ring.length > 8
    && ['Start', 'Loadout', 'Advanced', 'Reset to card defaults'].every((text, index) => ring[ring.length - 4 + index].textContent === text));
  uiMenuCommand('back');
  check('gamepad: B goes up one level and returns to the Holdfast card', Ui.current() === 'play' && focused().dataset.card === 'holdfast');
  uiMenuCommand('back');
  check('gamepad: B on Play returns to the main menu', Ui.current() === 'main');
  // Keyboard: arrows, Enter (a click on the focused control), Escape.
  uiClickButton(Ui.top().element, 'Play');
  uiKey('ArrowRight');
  check('keyboard: the arrow keys move between the cards', focused().dataset.card === 'teamclash');
  focused().click();   // what Enter does on a focused button: the browser clicks it (Ui has no Enter handler of its own)
  check('keyboard: activating the focused card opens Match setup of that card', Ui.current() === 'playSetup' && menuflowCrumbs(Ui.top().element) === 'Play > Team Clash');
  uiKey('Escape');
  check('keyboard: Esc goes back and the Team Clash card has the focus', Ui.current() === 'play' && focused().dataset.card === 'teamclash');
  // Touch: a tap does not focus a button on every browser; the card still gets the focus back.
  document.activeElement.blur();
  const card = Ui.top().element.querySelector('[data-card="flagraid"]');
  card.click();
  uiClickButton(Ui.top().element, 'Back');
  check('touch: Back returns to the card that was tapped', Ui.current() === 'play' && focused() === card);
  // Breadcrumb taps.
  Save.data.play = { mode: 'royale' };
  uiClickButton(Ui.top().element, 'All modes');
  check('breadcrumb: All modes shows Play > All modes and focuses the first mode of the last used group (Party)', menuflowCrumbs(Ui.top().element) === 'Play > All modes' && focused().dataset.mode === 'oddball');
  Ui.top().element.querySelector('[data-mode="dom"]').click();
  check('breadcrumb: a mode opened from All modes reads Play > All modes > Holdfast', menuflowCrumbs(Ui.top().element) === 'Play > All modes > Holdfast');
  uiClickButton(Ui.top().element, 'Advanced');
  const advanced = Ui.top().element, bar = advanced.querySelector('.ui-crumbs');
  check('breadcrumb: Advanced shows four crumbs; on a short screen the first two hide behind "..."', menuflowCrumbs(advanced) === 'Play > All modes > Holdfast > Advanced'
    && bar.querySelectorAll('.ui-crumb-far').length === 3 && bar.querySelectorAll('.ui-crumb-more').length === 1 && getComputedStyle(bar.querySelector('.ui-crumb-more')).display === 'none');
  Array.from(bar.querySelectorAll('.ui-crumb')).find((crumb) => crumb.textContent === 'All modes').click();
  check('breadcrumb: tapping a crumb goes back to that screen, the tile focused', Ui.current() === 'playModes' && focused().dataset.mode === 'dom');
  Array.from(Ui.top().element.querySelectorAll('.ui-crumb')).find((crumb) => crumb.textContent === 'Play').click();
  check('breadcrumb: tapping Play goes back to the cards', Ui.current() === 'play' && Ui.stack.length === 2);
  Ui.closeAll();
  Ui.open('settings');
  check('breadcrumb: other screens get one too (Settings; Career > Ladder)', menuflowCrumbs(Ui.top().element) === 'Settings'
    && (Ui.closeAll(), Ui.open('main'), uiClickButton(Ui.top().element, 'Career'), uiClickButton(Ui.top().element, 'Tournament Ladder'), menuflowCrumbs(Ui.top().element) === 'Career > Tournament Ladder'));
  Ui.closeAll();
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true }], player: {} });
  Modes.finish(Game.playerId);
  uiClickButton(Ui.top().element, 'Change mode');
  check('breadcrumb: Change mode on the results opens the same mode\'s setup, Play > Frenzy', Ui.current() === 'playSetup' && PlaySetup.state.choice.mode === 'ffa' && menuflowCrumbs(Ui.top().element) === 'Play > Frenzy');
  Ui.back();
  check('results: Back from Change mode returns to the results', Ui.current() === 'results');
  Game.stop();
}));

// LB / RB (the pad's prev / next menu commands) switch tabs, in Settings and in the editor; other screens keep the sequential move.
Test.add('menuflow', (check) => uiWith(() => {
  const savedDevice = Input.device, pad = inputFakePad();
  const active = (root) => Array.from(root.querySelectorAll('.ui-tab')).findIndex((tab) => tab.classList.contains('active'));
  try {
    Ui.open('settings');
    let root = Ui.top().element;
    const tabs = Array.from(root.querySelectorAll('.ui-tab'));
    check('tabs: Settings starts on its first tab', active(root) === 0 && tabs.length >= 4);
    inputPadPress(pad, 5, true); inputPadPress(pad, 5, false);   // RB through the real pad poll
    check('tabs: RB switches Settings to the next tab and the focus follows', active(root) === 1 && document.activeElement === tabs[1]);
    inputPadPress(pad, 4, true); inputPadPress(pad, 4, false);   // LB
    check('tabs: LB goes back', active(root) === 0 && document.activeElement === tabs[0]);
    uiMenuCommand('prev');
    check('tabs: LB on the first tab wraps to the last, whose rows show', active(root) === tabs.length - 1 && root.querySelector('.ui-scroll').children.length > 0);
    uiMenuCommand('next');
    check('tabs: RB on the last tab wraps to the first', active(root) === 0);
    Ui.closeAll(); EDITOR_STATE.tab = 'mode'; Ui.open('custom');
    root = Ui.top().element;
    check('tabs: the editor starts on Mode', EDITOR_STATE.tab === 'mode' && active(root) === 0);
    uiMenuCommand('next');
    check('tabs: RB switches the editor to Rules', EDITOR_STATE.tab === 'rules' && active(root) === 1 && root.textContent.includes('Rule bundle'));
    uiMenuCommand('prev'); uiMenuCommand('prev');
    check('tabs: LB wraps the editor to Map, with the generated map entry', EDITOR_STATE.tab === 'map' && root.textContent.includes('Generate a map from a seed'));
    EDITOR_STATE.tab = 'mode';
    Ui.closeAll(); menuflowOpenPlay();
    const before = document.activeElement;
    uiMenuCommand('next');
    check('tabs: a screen without tabs keeps LB / RB as the sequential focus move', document.activeElement !== before && Ui.current() === 'play');
  } finally {
    inputReleasePad();
    Input.device = savedDevice;
    EDITOR_STATE.tab = 'mode';
  }
}));

// An old save: custom matches, ladder progress, challenges, operations, cards and medals that name merged modes load and show.
Test.add('menuflow', (check) => uiWith(() => {
  const old = Save.emptySave();
  old.play = { mode: 'duel', map: 'spire', ruleset: '', bots: 1, difficulty: 'regular', team: -1, length: 'standard' };
  old.settings['custom.draft'] = JSON.stringify({ mode: 'hardpoint', map: 'harbor', botCount: 5 });
  old.rulesets = [{ id: 'custom-1', name: 'Old Lives', mutators: [], editor: { mode: 'lms', lives: 5, name: 'Old Lives' } }];
  old.stats = { modes: { duel: { played: 4, wins: 2, kills: 21, deaths: 9, bestScore: 10 }, hardpoint: { played: 2, wins: 1, kills: 12, deaths: 6, bestScore: 150 },
    endless: { played: 1, wins: 0, kills: 30, deaths: 3, bestScore: 8 }, lms: { played: 1, wins: 1, kills: 4, deaths: 1, bestScore: 3 } } };
  const duelTier = CAT.ladder.findIndex((row) => row.matches.some((entry) => entry.mode === 'duel')), duelMatch = CAT.ladder[duelTier].matches.findIndex((entry) => entry.mode === 'duel');
  old.ladder = { tier: duelTier, match: duelMatch, done: false, cleared: { [Ladder.key(0, 0)]: true }, difficulty: {} };
  old.progression = { xp: 500000, medals: { spree: 2 }, cards: { unlocked: { endless: true }, active: [], passive: [], marks: 0 },
    challenges: { duelRush: { best: 23000, stars: 2, expertBest: 0, expertStars: 0, plays: 3 } },
    operations: { ironcoast: { stage: 2, tickets: [48, 52], wins: [1, 1], comeback: -1, done: false, result: '', completed: 0 } } };
  let imported = false;
  try { imported = Save.importText(JSON.stringify(old)); } catch (error) { imported = String(error); }
  check('old save: it imports and every field survives', imported === true && Save.data.play.mode === 'duel' && Progress.stats().modes.duel.played === 4 && Progress.profile().medals.spree === 2, String(imported));
  check('old save: the last Play setup keeps the variant; Play focuses its parent card', PlayFlow.remembered().mode === 'duel' && PlayFlow.lastCard().id === 'frenzy');
  menuflowOpenPlay();
  check('old save: Play opens with the Frenzy card focused', document.activeElement.dataset.card === 'frenzy');
  uiClickButton(Ui.top().element, 'Frenzy');
  check('old save: the Frenzy card opens Match setup with the remembered Duel 1v1 variant chosen', menuflowCycle(Ui.top().element, 'Variant').textContent === 'Duel 1v1' && PlaySetup.state.choice.mode === 'duel' && PlaySetup.state.origin === 'ffa');
  Ui.closeAll();
  PlayFlow.quickMatch();
  check('old save: Quick Match replays the Duel it remembers', Game.match.rules.mode === 'duel' && menuflowBotCount() === 1);
  Game.stop(); Ui.closeAll();

  EDITOR_STATE.tab = 'mode';
  Ui.open('custom');
  const editor = Ui.top().element;
  check('old save: the last custom match shows Holdfast with the Moving hill variant, on its map', menuflowCycle(editor, 'Game mode').textContent === 'Holdfast'
    && menuflowCycle(editor, 'Variant').textContent === CAT.modes.byId('hardpoint').variant && editor.querySelector('.ui-sub').textContent === 'Holdfast - Moving hill (Hotpoint) on Harbor Nine, 5 bots', editor.querySelector('.ui-sub').textContent);
  uiClickButton(editor, 'Start match');
  check('old save: it starts as Hotpoint', Game.match.rules.mode === 'hardpoint' && menuflowBotCount() === 5);
  Game.stop(); Ui.closeAll();
  const preset = Rules.custom.list()[0], draft = CustomMatch.fromPreset(preset);
  Game.start(CustomMatch.setup(draft, 3));
  check('old save: a saved custom preset keeps its Last Standing mode and lives', draft.mode === 'lms' && draft.lives === 5 && Game.match.rules.mode === 'lms' && Game.match.rules.lives === 5);
  Game.stop();
  const decoded = CustomMatch.decode(CustomCodec.pack({ mode: 'bearer', botCount: 3 }));
  check('old save: a share code made before P4 names Flame Bearer and loads unchanged', !decoded.error && decoded.draft.mode === 'bearer' && decoded.draft.botCount === 3 && CustomMatch.encode(decoded.draft) === CustomCodec.pack({ mode: 'bearer', botCount: 3 }));

  Ui.open('stats');
  const stats = Ui.top().element.textContent;
  check('old save: Statistics lists the merged modes as <mode> - <variant>, each with its own numbers', stats.includes('Frenzy - Duel 1v1') && stats.includes('Holdfast - Moving hill (Hotpoint)')
    && stats.includes('Siege Waves - Endless (Endless Hold)') && stats.includes('4 played, 2 wins, 21 kills'));
  Ui.closeAll(); Ui.open('ladder');
  const ladderText = Ui.top().element.textContent;
  check('old save: the ladder keeps its progress and shows the duel as Frenzy - Duel 1v1', Ladder.state().tier === duelTier && Ladder.state().match === duelMatch && Ladder.clearedCount() === 1
    && ladderText.includes('. Frenzy - Duel 1v1 on Foundry Spire'));
  Ui.closeAll();
  Ladder.start(duelTier, duelMatch);
  check('old save: the duel ladder match starts as a duel', Game.match && Game.match.rules.mode === 'duel' && Game.match.setup.progress.kind === 'ladder');
  Game.stop(); Ui.closeAll();
  const room = Challenges.record('duelRush');
  Ui.open('challenges');
  check('old save: Challenge Room CR14 Duel Rush keeps its stars and shows them', room.stars === 2 && room.best === 23000 && Ui.top().element.textContent.includes('CR14 Duel Rush' + careerStars(2)));
  Ui.closeAll();
  Challenges.start('duelRush', false);
  check('old save: Duel Rush starts as a duel', Game.match && Game.match.rules.mode === 'duel' && Game.match.setup.progress.id === 'duelRush');
  Game.stop(); Ui.closeAll();
  Ui.open('operations');
  check('old save: the operation run shows its last map as Holdfast - Moving hill (Hotpoint)', Ui.top().element.textContent.includes('Map 3 of 3: Holdfast - Moving hill (Hotpoint) on Harbor Nine. Tickets 48 vs 52'));
  Ui.closeAll();
  Operations.start('ironcoast');
  check('old save: it plays that map as Hotpoint', Game.match.rules.mode === 'hardpoint' && Game.match.setup.progress.stage === 2);
  Game.stop(); Ui.closeAll();
  Ui.open('cards');
  check('old save: the Endless card stays unlocked and is not confused with the mode', Progress.profile().cards.unlocked.endless === true && !!CAT.cards.byId('endless') && Ui.current() === 'cards');
  Ui.closeAll();
  const dailyModes = new Set();
  for (let day = 1; day <= 40; day++) dailyModes.add(Daily.choiceFor('2026-' + String(1 + Math.floor(day / 29)).padStart(2, '0') + '-' + String(1 + day % 28).padStart(2, '0')).mode);
  check('old save: the daily seed draws from the same mode list (40 days: only listed modes, Hotpoint among them)', DAILY_RULES.modes.join() === 'ffa,tdm,dom,hardpoint,ctf'
    && Array.from(dailyModes).every((id) => DAILY_RULES.modes.includes(id)) && dailyModes.has('hardpoint'), Array.from(dailyModes).join());
  Ui.open('daily');
  check('old save: the Daily Seed screen opens and names its mode with the variant label when it is one', Ui.current() === 'daily' && Ui.top().element.querySelector('.ui-sub').textContent.includes(careerModeName(Daily.choiceFor(Daily.todayKey()).mode)));
}));

// Quick Match replays the last start: the draft that was started (not what the editor holds now), its team, and a rule bundle quick start.
Test.add('menuflow', (check) => uiWith(() => {
  menuflowOpenPlay();
  uiClickButton(Ui.top().element, 'Holdfast');
  menuflowCycle(Ui.top().element, 'Your team').click(); menuflowCycle(Ui.top().element, 'Your team').click();
  uiClickButton(Ui.top().element, 'Advanced');
  CustomMatch.turnOnMutator(EDITOR_STATE.draft, 'gravity'); editorChanged();
  uiClickButton(Ui.top().element, 'Back');
  uiClickButton(Ui.top().element, 'Start');
  check('quick match: an Advanced start from Match setup plays the chosen team (Red) and the mutator', Game.match.rules.mode === 'dom' && Actors.team[Game.playerId] === 1
    && Game.match.rules.mutators.some((entry) => entry.id === 'gravity') && Save.data.play.advanced.team === 1);
  Game.stop();
  menuflowOpenPlay();
  uiClickButton(Ui.top().element, 'Detonate');
  uiClickButton(Ui.top().element, 'Advanced');
  check('quick match: the editor now holds Detonate', CustomMatch.load().mode === 'bomb');
  Ui.closeAll();
  PlayFlow.quickMatch();
  check('quick match: Quick Match still replays the Holdfast that was started, with its team and mutator, not the Detonate left open in the editor', Game.match.rules.mode === 'dom'
    && Actors.team[Game.playerId] === 1 && Game.match.rules.mutators.some((entry) => entry.id === 'gravity'));
  Game.stop();
  // A rule bundle quick start of the editor is remembered the same way.
  const bundle = CAT.rulesets.byId('modern');
  EDITOR_STATE.tab = 'rules';
  Ui.open('custom');
  uiClickButton(Ui.top().element, bundle.code);
  check('quick match: a bundle quick start runs the bundle', Game.match.rules.id === 'modern' && Game.match.rules.mode === 'ffa' && Game.match.rules.mutators.length === 0);
  Game.stop();
  CustomMatch.save(Object.assign(CustomMatch.defaults(), { mode: 'bomb' }));
  PlayFlow.quickMatch();
  check('quick match: Quick Match replays that bundle start, not the editor draft that was saved since', Game.match.rules.id === 'modern' && Game.match.rules.mode === 'ffa', Game.match.rules.id + ' ' + Game.match.rules.mode);
  Game.stop(); EDITOR_STATE.tab = 'mode';
}));

// Advanced works on its own copy: the player's Custom draft comes back when Match setup closes, however it closes.
Test.add('menuflow', (check) => uiWith(() => {
  const mine = () => CustomMatch.load();
  CustomMatch.save(Object.assign(CustomMatch.defaults(), { mode: 'ctf', botCount: 3 }));
  menuflowOpenPlay();
  uiClickButton(Ui.top().element, 'Holdfast');
  uiClickButton(Ui.top().element, 'Advanced');
  check('custom draft: Advanced shows the Holdfast setup in the editor', CustomMatch.load().mode === 'dom' && menuflowCycle(Ui.top().element, 'Game mode').textContent === 'Holdfast');
  uiClickButton(Ui.top().element, 'Back');
  uiClickButton(Ui.top().element, 'Reset');
  uiClickButton(Ui.top().element, 'Advanced');
  uiClickButton(Ui.top().element, 'Back');
  uiMenuCommand('back');
  check('custom draft: a Flag Raid Custom draft survives Advanced, a reset and a second Advanced once Match setup closes', Ui.current() === 'play' && mine().mode === 'ctf' && mine().botCount === 3);
  uiClickButton(Ui.top().element, 'Holdfast');
  uiClickButton(Ui.top().element, 'Advanced');
  uiClickButton(Ui.top().element, 'Start match');
  check('custom draft: it survives an Advanced start as well, and the started copy is what Quick Match replays', Game.match.rules.mode === 'dom' && mine().mode === 'ctf' && mine().botCount === 3
    && Save.data.play.advanced.draft.mode === 'dom');
  Game.stop();
  Ui.closeAll(); Ui.open('main'); uiClickButton(Ui.top().element, 'Custom');
  check('custom draft: Custom from the main menu still holds it', menuflowCycle(Ui.top().element, 'Game mode').textContent === 'Flag Raid');
}));

// Cards: the breadcrumb names the card, and a card that reopens its last variant does not bring back an old rule bundle.
Test.add('menuflow', (check) => uiWith(() => {
  menuflowOpenPlay();
  uiClickButton(Ui.top().element, 'Arms Ladder');
  check('breadcrumb: the Arms Ladder card reads Play > Arms Ladder, not Play > Frenzy', menuflowCrumbs(Ui.top().element) === 'Play > Arms Ladder' && PlaySetup.state.choice.mode === 'gungame');
  Ui.back();
  uiClickButton(Ui.top().element, 'Frenzy');
  check('breadcrumb: the Frenzy card reads Play > Frenzy', menuflowCrumbs(Ui.top().element) === 'Play > Frenzy');
  Ui.closeAll();
  Save.data.play = { mode: 'duel', map: 'spire', ruleset: 'heroes', bots: 1, difficulty: 'regular', team: -1, length: 'standard' };
  const before = PlayFlow.remembered().ruleset;
  menuflowOpenPlay();
  uiClickButton(Ui.top().element, 'Frenzy');
  check('variant card: it reopens the last variant (Duel 1v1) without the old Rules choice, and shows no changes note', before === 'heroes' && PlaySetup.state.choice.mode === 'duel'
    && PlaySetup.state.choice.ruleset === '' && Ui.top().element.querySelector('.pm-changes').hidden);
}));
