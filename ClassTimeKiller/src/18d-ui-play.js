// ==== S18 UI: MATCH FLOW (PRG-001, PRG-005, UI-001, MODE-003) ====
// Quick Match starts a match in one tap with the last used setup (or the defaults), the Play screen picks mode, map, rules, bots and
// difficulty (with Shuffle), and the results screen opens when a match ends (play again, next map, main menu).
// The last setup is kept in Save.data.play. Contracts: docs/api/hud-play.md.

const PLAY_DEFAULT_MODE = 'ffa';
const PLAY_DEFAULT_BOTS = 7;
const PLAY_DEFAULT_DIFFICULTY = 'regular';
const PLAY_MAX_BOTS = 31;
const PLAY_SHUFFLE_MIN_BOTS = 3;
const PLAY_PLAYER_NAME = 'You';
const PLAY_LENGTHS = { short: 0.5, standard: 1, long: 1.5 };   // match length: the factor on the mode's score and time limits
const PLAY_LENGTH_IDS = Object.keys(PLAY_LENGTHS);
const PLAY_LENGTH_LABELS = ['Short', 'Standard', 'Long'];
const PLAY_DEFAULT_LENGTH = 'standard';
const PLAY_SCORE_STEP = 5;
const PLAY_TIME_STEP = 30;
const PLAY_AUTO_TEAM = -1;
const PLAY_SEED_RANGE = 0x7fffffff;
const PLAY_RESULT_TITLES = { win: 'Victory', loss: 'Defeat', draw: 'Draw', over: 'Match over' };
const PLAY_REASON_TEXT = { score: 'Score limit reached', time: 'Time is up', overtime: 'Decided in overtime', draw: 'Nobody could break the tie', eliminated: 'Last one standing', rounds: 'Rounds decided', tickets: 'Tickets ran out' };
const PlayResultsExtras = [];   // fn(body) panels later files add to the results screen (18j: XP and progress)
const PLAY_CSS = '.pl-title { font-size: 2.2em; font-weight: 800; margin: 0; } .pl-win { color: var(--ui-good, #58d66b); } .pl-loss { color: var(--ui-bad); }'
  + '.pl-stats { color: var(--ui-dim); margin: 4px 0 12px; } .pl-form { max-width: 640px; }';

// ---- The setup logic (no DOM: tested headless) ----
const PlayFlow = {
  // Modes with a registered behaviour and at least one map that lists them.
  playableModes() { return CAT.modes.filter((mode) => Modes.isPlayable(mode.id) && Maps.savedForMode(mode.id).length > 0); },
  maxBots() { return Math.min(Quality.current().bots, PLAY_MAX_BOTS); },
  mapsFor(modeId) { return Maps.savedForMode(modeId); },
  smallestMap(modeId) {
    let best = null;
    for (const map of this.mapsFor(modeId)) if (!best || map.size[0] * map.size[2] < best.size[0] * best.size[2]) best = map;
    return best;
  },
  difficulties() {
    return CAT.difficulty ? CAT.difficulty.map((row) => ({ id: row.id, name: row.name || row.id })) : [{ id: PLAY_DEFAULT_DIFFICULTY, name: 'Regular' }];
  },
  defaultBots(modeId) {
    const mode = CAT.modes.byId(modeId);
    return clamp((mode ? mode.sizeDefault : PLAY_DEFAULT_BOTS + 1) - 1, 0, this.maxBots());
  },
  defaults() {
    const map = this.smallestMap(PLAY_DEFAULT_MODE);
    return { mode: PLAY_DEFAULT_MODE, map: map ? map.id : '', ruleset: '', bots: Math.min(PLAY_DEFAULT_BOTS, this.maxBots()), difficulty: PLAY_DEFAULT_DIFFICULTY, team: PLAY_AUTO_TEAM, length: PLAY_DEFAULT_LENGTH };
  },
  // A complete valid setup choice from any partial or outdated one (a removed mode, a map that no longer lists the mode ...).
  normalize(choice) {
    const base = this.defaults(), source = choice || {};
    const mode = this.playableModes().find((row) => row.id === source.mode) || CAT.modes.byId(base.mode);
    const maps = this.mapsFor(mode.id);
    const map = maps.find((row) => row.id === source.map) || (mode.id === base.mode ? CAT.maps.byId(base.map) : this.smallestMap(mode.id));
    const difficulties = this.difficulties();
    const difficulty = difficulties.find((row) => row.id === source.difficulty) || difficulties.find((row) => row.id === base.difficulty) || difficulties[0];
    return {
      mode: mode.id, map: map ? map.id : '',
      ruleset: source.ruleset && CAT.rulesets.byId(source.ruleset) ? source.ruleset : '',
      bots: Number.isFinite(source.bots) ? clamp(Math.round(source.bots), 0, this.maxBots()) : (mode.id === base.mode ? base.bots : this.defaultBots(mode.id)),
      difficulty: difficulty.id,
      team: source.team === 0 || source.team === 1 ? source.team : PLAY_AUTO_TEAM,
      length: PLAY_LENGTHS[source.length] ? source.length : PLAY_DEFAULT_LENGTH,
    };
  },
  remembered() { return this.normalize(Save.data && Save.data.play); },
  remember(choice) {
    Save.data.play = { mode: choice.mode, map: choice.map, ruleset: choice.ruleset, bots: choice.bots, difficulty: choice.difficulty, team: choice.team, length: choice.length };
    Save.scheduleSave();
  },
  // The Game.start setup for a choice. `random` is injectable so tests get a fixed seed.
  buildSetup(choice, random) {
    const seed = Math.floor((random || Math.random)() * PLAY_SEED_RANGE);
    const setup = { mode: choice.mode, map: choice.map, mutators: [], bots: this.rosterBots(choice.bots, choice.difficulty, seed),
      seed, difficulty: choice.difficulty, player: { team: choice.team, name: PLAY_PLAYER_NAME } };
    if (choice.ruleset) setup.ruleset = choice.ruleset;
    const limits = this.lengthLimits(choice.mode, choice.length);
    if (limits) setup.modeOptions = limits;
    return setup;
  },
  // Named roster bots (their own names and traits) picked by the seed: first those whose tier the difficulty allows, then the others held
  // inside its range (plus the adaptive shift, which Bots.chooseTier adds only to a bot without a set tier); a field larger than the
  // roster is filled with unnamed bots.
  rosterBots(count, difficultyId, seed) {
    const difficulty = CAT.difficulty.byId(difficultyId) || CAT.difficulty.byId(PLAY_DEFAULT_DIFFICULTY);
    const inRange = (row) => row.tier >= difficulty.tierMin && row.tier <= difficulty.tierMax;
    const held = (row) => clamp(clamp(row.tier, difficulty.tierMin, difficulty.tierMax) + Difficulty.tierShift(), 0, BOT_TIER_COUNT - 1);
    const shuffled = makeRandom(seed).shuffle(CAT.bots.slice());
    const bots = shuffled.filter(inRange).concat(shuffled.filter((row) => !inRange(row)))
      .map((row) => (inRange(row) ? { profile: row.id } : { profile: row.id, tier: held(row) }));
    while (bots.length < count) bots.push({});
    return bots.slice(0, count);
  },
  // The mode's score and time limits scaled by the match length (Short 0.5x); null for the standard length. Rounded up to 5 points / 30 s.
  lengthLimits(modeId, length) {
    const factor = PLAY_LENGTHS[length] || 1, mode = CAT.modes.byId(modeId);
    if (factor === 1 || !mode) return null;
    const limits = {};
    if (mode.scoreLimit > 0) limits.scoreLimit = Math.ceil(mode.scoreLimit * factor / PLAY_SCORE_STEP) * PLAY_SCORE_STEP;
    if (mode.timeLimit > 0) limits.timeLimit = Math.ceil(mode.timeLimit * factor / PLAY_TIME_STEP) * PLAY_TIME_STEP;
    return limits;
  },
  // Starts a match for a choice (normalized and remembered). Runs synchronously so a click can still lock the pointer.
  start(choice, random) {
    const valid = this.normalize(choice);
    if (!valid.map) { Ui.toast('No map is available for that mode'); return null; }
    this.remember(valid);
    return Game.start(this.buildSetup(valid, random));
  },
  quickMatch() { return this.start(this.remembered()); },
  // A random valid mode / map / bot count / difficulty (PRG-001). The ruleset stays the mode's own.
  shuffle(random) {
    const pick = (list) => list[Math.floor(random() * list.length) % list.length];
    const mode = pick(this.playableModes()), map = pick(this.mapsFor(mode.id));
    const top = Math.max(PLAY_SHUFFLE_MIN_BOTS, this.defaultBots(mode.id));
    const bots = clamp(PLAY_SHUFFLE_MIN_BOTS + Math.floor(random() * (top - PLAY_SHUFFLE_MIN_BOTS + 1)), 0, this.defaultBots(mode.id));
    return this.normalize({ mode: mode.id, map: map.id, bots, difficulty: pick(this.difficulties()).id, length: this.remembered().length });
  },
  // Same setup, fresh seed (results screen: play again); a career match (setup.progress) is rebuilt by its structure (S15).
  // A winner-stays queue (M03 duel, results.queue) seats the bots in queue order: the winner stays, the loser waits last.
  playAgain(random) {
    if (!Game.match) return null;
    const setup = Progress.retrySetup(Game.match.setup) || Object.assign({}, Game.match.setup, { seed: Math.floor((random || Math.random)() * PLAY_SEED_RANGE) });
    const results = Game.match.results;
    if (!setup.progress && results && results.queue.length && setup.bots) setup.bots = this.queuedBots(setup.bots, results);
    return Game.start(setup);
  },
  // The setup's bots reordered by the queue names. Bots join in setup order, so the n-th bot actor (by id) is setup bot n.
  // Unnamed bots are named and tiered by seat (13b, 14a), so each reseated entry keeps its actor's name and tier (plus the adaptive change since).
  queuedBots(bots, results) {
    const botRows = results.players.filter((row) => row.kind !== ACTOR_KIND.PLAYER).sort((a, b) => a.id - b.id);
    const queued = results.queue.map((name) => botRows.findIndex((row) => row.name === name)).filter((index) => index >= 0);
    const waiting = bots.map((bot, index) => index).filter((index) => !queued.includes(index));
    const shift = Difficulty.tierShift() - Bots.setupShift;
    const seated = (index) => !botRows[index] ? bots[index]
      : Object.assign({}, bots[index], { name: botRows[index].name, tier: clamp(Bots.tier(botRows[index].id).tier + shift, 0, BOT_TIER_COUNT - 1) });
    return queued.concat(waiting).map(seated);
  },
  // Same mode and rules on the next map that lists the mode (not for career matches: they belong to their map).
  nextMap(random) {
    if (!Game.match || Game.match.setup.progress) return null;
    const setup = Game.match.setup, maps = this.mapsFor(setup.mode), current = maps.findIndex((map) => map.id === (Game.match.map ? Game.match.map.id : setup.map));
    const next = maps.length ? maps[(current + 1) % maps.length] : null;
    return Game.start(Object.assign({}, setup, { map: next ? next.id : setup.map, seed: Math.floor((random || Math.random)() * PLAY_SEED_RANGE) }));
  },
  // 'win' | 'loss' | 'draw' | 'over' from the results record and the local player.
  outcome(results) {
    if (results.draw) return 'draw';
    const player = Game.playerId;
    if (player < 0) return 'over';
    if (results.winnerTeam >= 0) return results.winnerTeam === Actors.team[player] ? 'win' : 'loss';
    return results.winnerId === player ? 'win' : 'loss';
  },
  winnerName(results) {
    if (results.draw) return '';
    if (results.winnerTeam >= 0) return TEAM_NAMES[results.winnerTeam];
    return results.winnerId >= 0 ? Actors.name[results.winnerId] : '';
  },
  // The results sentence: 'You win.', 'Your team (Red) wins.', 'Blue wins.', 'Mossa wins.' ('' for a draw).
  winnerText(results) {
    const name = this.winnerName(results);
    if (!name) return '';
    if (this.outcome(results) !== 'win') return name + ' wins.';
    return results.winnerTeam >= 0 ? 'Your team (' + name + ') wins.' : 'You win.';
  },
};
Bus.on('ui.quickMatch', () => PlayFlow.quickMatch());
Bus.on('ui.shuffleMatch', () => PlayFlow.start(PlayFlow.shuffle(Math.random)));   // for a menu entry or key that wants a random valid match in one action

// ---- Play screen: every choice on one page, Start and Shuffle ----
function playModeOptions() {
  const modes = PlayFlow.playableModes();
  return { values: modes.map((mode) => mode.id), labels: modes.map((mode) => mode.name) };
}
function playRulesetOptions() {
  return { values: [''].concat(CAT.rulesets.map((row) => row.id)), labels: ['Mode default'].concat(CAT.rulesets.map((row) => row.name)) };
}
function playTeamOptions() {
  return { values: [PLAY_AUTO_TEAM, 0, 1], labels: ['Automatic', TEAM_NAMES[0], TEAM_NAMES[1]] };
}

function playModeSummary(modeId) {
  const mode = CAT.modes.byId(modeId);
  const parts = [mode.sizeDefault + ' players'];
  if (mode.scoreLimit > 0) parts.push('first to ' + mode.scoreLimit);
  if (mode.timeLimit > 0) parts.push(Math.round(mode.timeLimit / 60) + ' min');
  return parts.join(', ');
}

Ui.register('play', {
  build(root) {
    screenHeader(root, 'Play');
    const choice = PlayFlow.remembered(), form = makeElement('div', 'ui-scroll pl-form'), summary = makeElement('p', 'ui-note');
    const render = () => Ui.rebuild(form, () => {
      form.replaceChildren();
      const modes = playModeOptions(), maps = PlayFlow.mapsFor(choice.mode), rulesets = playRulesetOptions(), difficulties = PlayFlow.difficulties(), teams = playTeamOptions();
      form.appendChild(Ui.row('Mode', Ui.cycle(modes.values, modes.labels, choice.mode, (value) => { choice.mode = value; Object.assign(choice, PlayFlow.normalize({ mode: value, ruleset: choice.ruleset, difficulty: choice.difficulty, team: choice.team, length: choice.length })); render(); })));
      form.appendChild(Ui.row('Map', Ui.cycle(maps.map((map) => map.id), maps.map((map) => map.name), choice.map, (value) => { choice.map = value; })));
      form.appendChild(Ui.row('Rules', Ui.cycle(rulesets.values, rulesets.labels, choice.ruleset, (value) => { choice.ruleset = value; })));
      form.appendChild(Ui.row('Bots', Ui.slider({ min: 0, max: PlayFlow.maxBots(), step: 1, value: choice.bots, format: (value) => String(value) }, (value) => { choice.bots = value; })));
      form.appendChild(Ui.row('Difficulty', Ui.cycle(difficulties.map((row) => row.id), difficulties.map((row) => row.name), choice.difficulty, (value) => { choice.difficulty = value; })));
      form.appendChild(Ui.row('Match length', Ui.cycle(PLAY_LENGTH_IDS, PLAY_LENGTH_LABELS, choice.length, (value) => { choice.length = value; })));
      if (CAT.modes.byId(choice.mode).teams === 2) form.appendChild(Ui.row('Your team', Ui.cycle(teams.values, teams.labels, choice.team, (value) => { choice.team = value; })));
      summary.textContent = playModeSummary(choice.mode);
    });
    root.appendChild(form);
    root.appendChild(summary);
    const foot = makeElement('div', 'ui-foot');
    const start = Ui.button('Start', () => PlayFlow.start(choice), 'primary');
    start.dataset.autofocus = '1';
    foot.appendChild(start);
    foot.appendChild(Ui.button('Shuffle', () => { Object.assign(choice, PlayFlow.shuffle(Math.random), { length: choice.length }); render(); }));
    foot.appendChild(Ui.button('Loadout', () => Ui.open('loadout')));   // the abilities section registers the screen
    root.appendChild(foot);
    render();
  },
});

// ---- Results screen: opened by the match.end listener of 18b ----
function playResultsStats(results) {
  const mine = results.players.find((player) => player.id === Game.playerId);
  if (!mine) return Math.round(results.duration) + ' s';
  return mine.kills + ' kills, ' + mine.deaths + ' deaths, ' + mine.assists + ' assists, score ' + Math.round(mine.score) + ', best streak ' + mine.bestStreak;
}

Ui.register('results', {
  noBack: true,
  build(root) {
    const results = Game.match ? Game.match.results : null, outcome = results ? PlayFlow.outcome(results) : 'over';
    const title = makeElement('h1', 'pl-title pl-' + outcome, PLAY_RESULT_TITLES[outcome]);
    root.appendChild(title);
    if (results) {
      root.appendChild(makeElement('p', 'ui-sub', (PlayFlow.winnerText(results) + ' ' + (PLAY_REASON_TEXT[results.reason] || '')).trim()));
      root.appendChild(makeElement('p', 'pl-stats', playResultsStats(results)));
      if (results.queue.length) root.appendChild(makeElement('p', 'ui-note', 'Next up: ' + results.queue.join(', ')));
    }
    const body = makeElement('div', 'ui-scroll');
    root.appendChild(body);
    Scoreboard.renderInto(body);
    for (const addExtra of PlayResultsExtras) addExtra(body);
    const foot = makeElement('div', 'ui-foot');
    // A career match offers its next step after a pass (Next match, Next map) and Retry after a loss; the primary button is the likely one.
    // An operation moves on after every map, so its Next map is the only way on until the run ends (then New run).
    const step = Game.match ? Progress.nextStep(Game.match.setup) : null;
    const replay = Game.match ? Progress.replayLabel(Game.match.setup, outcome) : 'Play again';
    const again = replay ? Ui.button(replay, () => PlayFlow.playAgain(), step ? '' : 'primary') : null;
    const main = step ? Ui.button(step.label, () => Game.start(step.build()), 'primary') : again;
    main.dataset.autofocus = '1';
    if (step) foot.appendChild(main);
    if (again) foot.appendChild(again);
    if (Game.match && !Game.match.setup.progress) foot.appendChild(Ui.button('Next map', () => PlayFlow.nextMap()));
    foot.appendChild(Ui.button('Main menu', () => Game.stop()));
    root.appendChild(foot);
  },
  onOpen() { Input.exitLock(); },
});

Bus.on('boot', () => injectStyle('play-style', PLAY_CSS));
