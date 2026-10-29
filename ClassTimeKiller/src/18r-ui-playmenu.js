// ==== S18 UI: PLAY MENU (P4-03, P4-04) ====
// Play -> mode cards (the curated first list, then All modes and Shuffle) -> Match setup -> Start. Advanced opens the Custom editor (18g)
// filled with the setup; Back keeps its changes and Match setup shows them with a reset. PlaySetup holds the setup and the conversions to
// and from the editor draft without any DOM (the self-test drives it); the screens below only call it. The mode cards and groups are
// data in 03f, the setup logic (PlayFlow) in 18d. Contracts: docs/api/hud-play.md.

const PLAY_MENU_CSS = '.pm-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); max-width: 980px; }'
  + '.pm-card { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-height: 96px; } .pm-tile { min-height: 64px; justify-content: center; }'
  + '.pm-card-name { font-weight: 700; } .pm-card-variant { color: var(--ui-accent); font-size: 0.875em; }'
  + '.pm-card-goal, .pm-card-facts { color: var(--ui-dim); font-size: 0.875em; font-weight: 400; line-height: 1.3; } .pm-changes { color: var(--ui-accent); }'
  + '@media (max-height: 520px) { .pm-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; } .pm-card { min-height: 80px; } }';
const PLAY_ADVANCED_CRUMB = 'Advanced';
const PLAY_ROOT_CRUMB = 'Play';

// ---- The Match setup state and its link to the Custom editor (no DOM) ----
const PlaySetup = {
  state: null,   // the open Match setup: { origin: the mode the card or tile opened, choice: a PlayFlow choice, advanced: the editor holds the setup }

  begin(modeId, choice) {
    this.state = { origin: modeId, choice: choice || PlayFlow.modeChoice(modeId), advanced: false };
    return this.state;
  },
  // Match setup closed: the player's own Custom draft, which Advanced replaced for the editor, comes back.
  end() {
    if (this.state && this.state.stash !== undefined) Settings.set('custom.draft', this.state.stash);
    this.state = null;
  },
  // The Variant row: the playable rows of the open mode's family, its parent first.
  variantIds() {
    return modeVariantIds(modeParentId(this.state.choice.mode)).filter((id) => Modes.isPlayable(id) && PlayFlow.mapsFor(id).length > 0);
  },
  // The breadcrumb name: the card the setup came from (Arms Ladder, not Frenzy), else the parent mode of the setup's mode.
  crumbName() {
    const card = PlayFlow.cardFor(this.state.origin), mode = this.state.choice.mode;
    return card && modeParentId(card.mode) === modeParentId(mode) ? card.name : CAT.modes.byId(modeParentId(mode)).name;
  },
  hasCard() { return !!PlayFlow.cardFor(this.state.origin); },

  // ---- Row changes: the choice, and the editor draft when it holds the setup (the draft keeps its own advanced fields) ----
  // A picked variant loads that row's own defaults (its card's when it has one); difficulty, team and length stay.
  setMode(modeId) {
    const choice = this.state.choice;
    this.state.choice = PlayFlow.modeChoice(modeId, { difficulty: choice.difficulty, team: choice.team, length: choice.length });
    if (!this.state.advanced) return;
    const draft = CustomMatch.load(), next = this.state.choice;
    draft.mode = modeId;
    EDITOR_CHANGED.modeChanged(draft);
    Object.assign(draft, { map: next.map, botCount: next.bots, difficulty: next.difficulty, roundWins: next.roundWins >= 1 ? next.roundWins : EDITOR_DEFAULT }, this.limitFields(next));
    CustomMatch.save(draft);
  },
  setMap(map) { this.state.choice.map = map; this.draftSet({ map }); },
  setBots(bots) { this.state.choice.bots = bots; this.draftSet({ botCount: bots }); },
  setDifficulty(difficulty) { this.state.choice.difficulty = difficulty; this.draftSet({ difficulty }); },
  setLength(length) { this.state.choice.length = length; this.draftSet(this.limitFields(this.state.choice)); },
  setTeam(team) { this.state.choice.team = team; },
  draftSet(fields) {
    if (!this.state.advanced) return;
    CustomMatch.save(Object.assign(CustomMatch.load(), fields));
  },

  // ---- Advanced ----
  // The editor's score and time limits nearest to the match length of a choice (-1, the mode's own, for Standard).
  limitFields(choice) {
    const limits = PlayFlow.lengthLimits(choice.mode, choice.length, choice.ruleset) || {};
    const nearest = (list, wanted) => (wanted > 0 ? list.filter((value) => value > 0).reduce((best, value) => (Math.abs(value - wanted) < Math.abs(best - wanted) ? value : best)) : EDITOR_DEFAULT);
    return { scoreLimit: nearest(EDITOR_SCORE_LIMITS, limits.scoreLimit), timeLimit: nearest(EDITOR_TIME_LIMITS, limits.timeLimit) };
  },
  // The editor draft for a choice: its mode (a variant row), map, bots, difficulty, rule bundle, rounds and limits; everything else is a default.
  toDraft(choice) {
    const draft = customDefaults();
    Object.assign(draft, { mode: choice.mode, map: choice.map, bundle: choice.ruleset, botCount: choice.bots, difficulty: choice.difficulty,
      roundWins: choice.roundWins >= 1 ? choice.roundWins : EDITOR_DEFAULT }, this.limitFields(choice));
    return CustomMatch.validate(draft).draft;
  },
  // Match setup -> the editor: the first time the editor's draft is filled from the setup; after that the editor keeps its own changes.
  prepareAdvanced() {
    EDITOR_STATE.tab = 'mode';   // the editor opens on the Mode tab, not on the tab it was left on
    if (this.state.advanced) return;
    if (this.state.stash === undefined) this.state.stash = Settings.get('custom.draft');   // once: a reset and a second Advanced keep the first
    CustomMatch.save(this.toDraft(this.state.choice));
    this.state.advanced = true;
  },
  // Back from the editor: the setup shows what the editor holds for its own rows. A random map (blank in the editor) stays random.
  readDraft() {
    const draft = CustomMatch.load(), previous = this.state.choice;
    const choice = PlayFlow.normalize({ mode: draft.mode, map: draft.map, ruleset: draft.bundle, difficulty: draft.difficulty, team: previous.team, length: previous.length,
      bots: draft.botCount >= 0 ? draft.botCount : PlayFlow.defaultBots(draft.mode), roundWins: draft.roundWins });
    if (!draft.map) choice.map = '';
    this.state.choice = choice;
  },
  // What the editor changes that the rows of Match setup do not show ("Modern Ops, 2 mutators").
  changes() {
    if (!this.state.advanced) return [];
    const draft = CustomMatch.load(), choice = this.state.choice, list = [];
    const bundle = CAT.rulesets.byId(draft.bundle), weaponSet = CAT.weaponSets.byId(draft.weaponSet);
    if (draft.bundle) list.push(bundle ? bundle.name : draft.bundle);
    if (draft.mutators.length) list.push(draft.mutators.length + (draft.mutators.length === 1 ? ' mutator' : ' mutators'));
    if (draft.weaponList) list.push('weapon list');
    else if (draft.weaponSet) list.push(weaponSet ? weaponSet.name : draft.weaponSet);
    if (draft.move || draft.health || draft.economy || !draft.items || draft.friendlyFire >= 0 || draft.lives >= 0 || draft.respawnDelay >= 0) list.push('own rules');
    if (draft.personality !== EDITOR_PERSONALITY_MIXED || Object.keys(draft.difficultySliders).length) list.push('own bot settings');
    if (draft.allies >= 0) list.push('own team split');
    if ((draft.scoreLimit >= 0 || draft.timeLimit >= 0) && choice.length === PLAY_DEFAULT_LENGTH) list.push('own limits');
    if (draft.roundWins >= 0 && draft.roundWins !== PlayFlow.modeChoice(draft.mode).roundWins) list.push('rounds to win');
    return list;
  },
  start() {
    const state = this.state;
    return state.advanced ? PlayFlow.startAdvanced(CustomMatch.load(), state.choice.team) : PlayFlow.start(state.choice);
  },
  // Back to the card's (or mode's) defaults; the editor's changes are dropped from the setup.
  reset() {
    this.state.choice = PlayFlow.modeChoice(this.state.origin);
    this.state.advanced = false;
  },
};

// ---- Play: the mode cards, All modes, Shuffle ----
function playCardLines(button, name, variant, goal, facts) {
  button.appendChild(makeElement('span', 'pm-card-name', name));
  if (variant) button.appendChild(makeElement('span', 'pm-card-variant', variant));
  button.appendChild(makeElement('span', 'pm-card-goal', goal));
  if (facts) button.appendChild(makeElement('span', 'pm-card-facts', facts));
}
// Opens Match setup from a card or tile; the control takes the focus first, so Back returns to it on every browser.
function playOpenSetup(button, modeId, choice) {
  button.focus();
  return Ui.open('playSetup', { mode: modeId, choice }, button);
}
function playCardButton(card) {
  const mode = CAT.modes.byId(card.mode), button = Ui.button('', () => playOpenSetup(button, card.mode, PlayFlow.variantChoice(card)), 'pm-card');
  button.dataset.card = card.id;
  playCardLines(button, card.name, mode.variantOf ? modeLabel(card.mode) : '', mode.goal, playModeFacts(card.mode, '', card.roundWins));
  return button;
}
function playTileButton(label, detail, onClick) {
  const button = Ui.button('', onClick, 'pm-card pm-tile');
  playCardLines(button, label, '', detail, '');
  return button;
}
Ui.register('play', {
  build(root) {
    screenHeader(root, 'Play');
    const grid = makeElement('div', 'ui-menu pm-grid'), last = PlayFlow.lastCard();
    for (const card of MODE_CARDS) {
      const button = playCardButton(card);
      if (card.id === last.id) button.dataset.autofocus = '1';
      grid.appendChild(button);
    }
    const all = playTileButton('All modes', 'Every mode and variant, in groups.', () => Ui.open('playModes', null, all));
    const shuffle = playTileButton('Shuffle', 'A random mode, map and bot count.', () => {
      const choice = PlayFlow.shuffle(Math.random);
      playOpenSetup(shuffle, choice.mode, choice);
    });
    grid.appendChild(all);
    grid.appendChild(shuffle);
    root.appendChild(grid);
  },
});

// ---- All modes: the 15 menu modes in three groups ----
Ui.register('playModes', {
  build(root) {
    screenHeader(root, 'All modes');
    const list = makeElement('div', 'ui-scroll'), lastParent = modeParentId(PlayFlow.remembered().mode);
    let focusGroup = MODE_GROUPS.findIndex((group) => group.modes.includes(lastParent));
    if (focusGroup < 0) focusGroup = 0;
    MODE_GROUPS.forEach((group, index) => {
      list.appendChild(makeElement('div', 'ui-group', group.name));
      const grid = makeElement('div', 'ui-menu pm-grid');
      group.modes.forEach((id, position) => {
        const row = CAT.modes.byId(id), variants = modeVariantIds(id).length;
        const tile = playTileButton(row.name, row.goal, () => playOpenSetup(tile, id));
        tile.dataset.mode = id;
        if (variants > 1) tile.appendChild(makeElement('span', 'pm-card-variant', variants + ' variants'));
        if (index === focusGroup && position === 0) tile.dataset.autofocus = '1';
        grid.appendChild(tile);
      });
      list.appendChild(grid);
    });
    root.appendChild(list);
  },
});

// ---- Match setup: variant, map, bots, difficulty, match length, your team; Start ----
function playMapOptions(choice) {
  const maps = PlayFlow.mapsFor(choice.mode);
  return { values: (choice.map === '' ? [''] : []).concat(maps.map((map) => map.id)), labels: (choice.map === '' ? ['Random'] : []).concat(maps.map((map) => map.name)) };
}
function playTeamOptions() {
  return { values: [PLAY_AUTO_TEAM, 0, 1], labels: ['Automatic', TEAM_NAMES[0], TEAM_NAMES[1]] };
}
function playSetupRows(form) {
  const choice = PlaySetup.state.choice, variants = PlaySetup.variantIds(), maps = playMapOptions(choice), difficulties = PlayFlow.difficulties(), teams = playTeamOptions();
  const refill = () => playSetupRefresh(form.closest('.ui-playSetup'));
  if (variants.length > 1) {
    form.appendChild(Ui.row('Variant', Ui.cycle(variants, variants.map((id) => CAT.modes.byId(id).variant), choice.mode, (value) => { PlaySetup.setMode(value); refill(); })));
  }
  form.appendChild(Ui.row('Map', Ui.cycle(maps.values, maps.labels, choice.map, (value) => PlaySetup.setMap(value))));
  form.appendChild(Ui.row('Bots', Ui.slider({ min: 0, max: PlayFlow.maxBots(), step: 1, value: choice.bots, format: (value) => String(value) }, (value) => PlaySetup.setBots(value))));
  form.appendChild(Ui.row('Difficulty', Ui.cycle(difficulties.map((row) => row.id), difficulties.map((row) => row.name), choice.difficulty, (value) => PlaySetup.setDifficulty(value))));
  if (PlayFlow.hasLength(choice.mode)) form.appendChild(Ui.row('Match length', Ui.cycle(PLAY_LENGTH_IDS, PLAY_LENGTH_LABELS, choice.length, (value) => { PlaySetup.setLength(value); refill(); })));
  if (PlayFlow.hasTeamChoice(choice.mode)) form.appendChild(Ui.row('Your team', Ui.cycle(teams.values, teams.labels, choice.team, (value) => PlaySetup.setTeam(value))));
}
// Redraws the rows, the summary and the editor-changes line from PlaySetup (also after Back from the editor).
function playSetupRefresh(root) {
  const choice = PlaySetup.state.choice, changes = PlaySetup.changes(), note = root.querySelector('.pm-changes');
  const form = root.querySelector('.pl-form');
  Ui.rebuild(form, () => { form.replaceChildren(); playSetupRows(form); });
  root.querySelector('.pm-summary').textContent = playModeSummary(choice.mode, choice.ruleset, choice.roundWins);
  note.textContent = changes.length ? 'Advanced changes: ' + changes.join(', ') + '.' : '';
  note.hidden = !changes.length;
  Ui.setCrumb(Ui.stack.find((entry) => entry.element === root), PlaySetup.crumbName());
  root.querySelector('.pm-reset').textContent = PlaySetup.hasCard() ? 'Reset to card defaults' : 'Reset to mode defaults';
}
// params: { mode: the mode or variant row to set up, choice (optional): a ready choice, such as Shuffle's }.
Ui.register('playSetup', {
  build(root, params) {
    const request = params || {};
    PlaySetup.begin(request.mode || PlayFlow.lastCard().mode, request.choice);
    Ui.top().crumbBase = Ui.isOpen('play') ? [] : [PLAY_ROOT_CRUMB];   // opened from the results screen: Play is not below it
    screenHeader(root, 'Match setup', undefined, PlaySetup.crumbName());
    root.appendChild(makeElement('div', 'ui-scroll pl-form'));
    root.appendChild(makeElement('p', 'ui-note pm-summary'));
    root.appendChild(makeElement('p', 'ui-note pm-changes'));
    const foot = makeElement('div', 'ui-foot');
    const start = Ui.button('Start', () => PlaySetup.start(), 'primary');
    start.dataset.autofocus = '1';
    foot.appendChild(start);
    foot.appendChild(Ui.button('Loadout', () => Ui.open('loadout')));   // the abilities section registers the screen
    const advanced = Ui.button('Advanced', () => { PlaySetup.prepareAdvanced(); Ui.open('custom', { crumb: PLAY_ADVANCED_CRUMB }, advanced); });
    foot.appendChild(advanced);
    foot.appendChild(Ui.button('Reset', () => { PlaySetup.reset(); playSetupRefresh(root); }, 'pm-reset'));
    root.appendChild(foot);
    playSetupRefresh(root);
  },
  onResume(root) {
    if (!PlaySetup.state) return;
    if (PlaySetup.state.advanced) PlaySetup.readDraft();
    playSetupRefresh(root);
  },
  onClose() { PlaySetup.end(); },
});

Bus.on('boot', () => injectStyle('play-menu-style', PLAY_MENU_CSS));
