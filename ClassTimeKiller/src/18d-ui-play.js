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
const PLAY_AUTO_TEAM = -1;
const PLAY_SEED_RANGE = 0x7fffffff;
const PLAY_RESULT_TITLES = { win: 'Victory', loss: 'Defeat', draw: 'Draw', over: 'Match over' };
const PLAY_REASON_TEXT = { score: 'Score limit reached', time: 'Time is up', overtime: 'Decided in overtime', draw: 'Nobody could break the tie', eliminated: 'Last one standing', rounds: 'Rounds decided', tickets: 'Tickets ran out' };
const PLAY_CSS = '.pl-title { font-size: 2.2em; font-weight: 800; margin: 0; } .pl-win { color: var(--ui-good, #58d66b); } .pl-loss { color: var(--ui-bad); }'
  + '.pl-stats { color: var(--ui-dim); margin: 4px 0 12px; } .pl-form { max-width: 640px; }';

// ---- The setup logic (no DOM: tested headless) ----
const PlayFlow = {
  // Modes with a registered behaviour and at least one map that lists them.
  playableModes() { return CAT.modes.filter((mode) => Modes.isPlayable(mode.id) && Maps.forMode(mode.id).length > 0); },
  maxBots() { return Math.min(Quality.current().bots, PLAY_MAX_BOTS); },
  mapsFor(modeId) { return Maps.forMode(modeId); },
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
    return { mode: PLAY_DEFAULT_MODE, map: map ? map.id : '', ruleset: '', bots: Math.min(PLAY_DEFAULT_BOTS, this.maxBots()), difficulty: PLAY_DEFAULT_DIFFICULTY, team: PLAY_AUTO_TEAM };
  },
  // A complete valid setup choice from any partial or outdated one (a removed mode, a map that no longer lists the mode ...).
  normalize(choice) {
    const base = this.defaults(), source = choice || {};
    const mode = this.playableModes().find((row) => row.id === source.mode) || CAT.modes.byId(base.mode);
    const maps = this.mapsFor(mode.id);
    const map = maps.find((row) => row.id === source.map) || (mode.id === base.mode ? CAT.maps.byId(base.map) : this.smallestMap(mode.id));
    const difficulty = this.difficulties().find((row) => row.id === source.difficulty);
    return {
      mode: mode.id, map: map ? map.id : '',
      ruleset: source.ruleset && CAT.rulesets.byId(source.ruleset) ? source.ruleset : '',
      bots: Number.isFinite(source.bots) ? clamp(Math.round(source.bots), 0, this.maxBots()) : (mode.id === base.mode ? base.bots : this.defaultBots(mode.id)),
      difficulty: difficulty ? difficulty.id : this.difficulties()[0].id,
      team: source.team === 0 || source.team === 1 ? source.team : PLAY_AUTO_TEAM,
    };
  },
  remembered() { return this.normalize(Save.data && Save.data.play); },
  remember(choice) {
    Save.data.play = { mode: choice.mode, map: choice.map, ruleset: choice.ruleset, bots: choice.bots, difficulty: choice.difficulty, team: choice.team };
    Save.scheduleSave();
  },
  // The Game.start setup for a choice. `random` is injectable so tests get a fixed seed.
  buildSetup(choice, random) {
    const setup = { mode: choice.mode, map: choice.map, mutators: [], bots: Array.from({ length: choice.bots }, () => ({})),
      seed: Math.floor((random || Math.random)() * PLAY_SEED_RANGE), difficulty: choice.difficulty, player: { team: choice.team, name: PLAY_PLAYER_NAME } };
    if (choice.ruleset) setup.ruleset = choice.ruleset;
    return setup;
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
    return this.normalize({ mode: mode.id, map: map.id, bots, difficulty: pick(this.difficulties()).id });
  },
  // Same setup, fresh seed (results screen: play again).
  playAgain(random) {
    if (!Game.match) return null;
    const setup = Object.assign({}, Game.match.setup, { seed: Math.floor((random || Math.random)() * PLAY_SEED_RANGE) });
    return Game.start(setup);
  },
  // Same mode and rules on the next map that lists the mode.
  nextMap(random) {
    if (!Game.match) return null;
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
    const render = () => {
      form.replaceChildren();
      const modes = playModeOptions(), maps = PlayFlow.mapsFor(choice.mode), rulesets = playRulesetOptions(), difficulties = PlayFlow.difficulties(), teams = playTeamOptions();
      form.appendChild(Ui.row('Mode', Ui.cycle(modes.values, modes.labels, choice.mode, (value) => { choice.mode = value; Object.assign(choice, PlayFlow.normalize({ mode: value, ruleset: choice.ruleset, difficulty: choice.difficulty, team: choice.team })); render(); })));
      form.appendChild(Ui.row('Map', Ui.cycle(maps.map((map) => map.id), maps.map((map) => map.name), choice.map, (value) => { choice.map = value; })));
      form.appendChild(Ui.row('Rules', Ui.cycle(rulesets.values, rulesets.labels, choice.ruleset, (value) => { choice.ruleset = value; })));
      form.appendChild(Ui.row('Bots', Ui.slider({ min: 0, max: PlayFlow.maxBots(), step: 1, value: choice.bots, format: (value) => String(value) }, (value) => { choice.bots = value; })));
      form.appendChild(Ui.row('Difficulty', Ui.cycle(difficulties.map((row) => row.id), difficulties.map((row) => row.name), choice.difficulty, (value) => { choice.difficulty = value; })));
      if (CAT.modes.byId(choice.mode).teams === 2) form.appendChild(Ui.row('Your team', Ui.cycle(teams.values, teams.labels, choice.team, (value) => { choice.team = value; })));
      summary.textContent = playModeSummary(choice.mode);
    };
    root.appendChild(form);
    root.appendChild(summary);
    const foot = makeElement('div', 'ui-foot');
    const start = Ui.button('Start', () => PlayFlow.start(choice), 'primary');
    start.dataset.autofocus = '1';
    foot.appendChild(start);
    foot.appendChild(Ui.button('Shuffle', () => { Object.assign(choice, PlayFlow.shuffle(Math.random)); render(); }));
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
      const winner = PlayFlow.winnerName(results);
      root.appendChild(makeElement('p', 'ui-sub', (winner ? winner + ' wins. ' : '') + (PLAY_REASON_TEXT[results.reason] || '')));
      root.appendChild(makeElement('p', 'pl-stats', playResultsStats(results)));
      if (results.queue.length) root.appendChild(makeElement('p', 'ui-note', 'Next up: ' + results.queue.join(', ')));
    }
    const body = makeElement('div', 'ui-scroll');
    root.appendChild(body);
    Scoreboard.renderInto(body);
    const foot = makeElement('div', 'ui-foot');
    const again = Ui.button('Play again', () => PlayFlow.playAgain(), 'primary');
    again.dataset.autofocus = '1';
    foot.appendChild(again);
    foot.appendChild(Ui.button('Next map', () => PlayFlow.nextMap()));
    foot.appendChild(Ui.button('Main menu', () => Game.stop()));
    root.appendChild(foot);
  },
  onOpen() { Input.exitLock(); },
});

Bus.on('boot', () => injectStyle('play-style', PLAY_CSS));
