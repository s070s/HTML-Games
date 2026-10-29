// ==== S18 UI: MATCH FLOW (PRG-001, PRG-005, UI-001, MODE-003) ====
// Quick Match starts a match in one tap with the last used setup (or the defaults), the Play screens (18r) pick a mode card, then
// variant, map, bots and difficulty, and the results screen opens when a match ends (play again, next map, change mode, main menu).
// The last setup is kept in Save.data.play (mode may be a variant row; advanced: the last start came from the Custom editor, so Quick
// Match replays its draft). Contracts: docs/api/hud-play.md.

const PLAY_DEFAULT_MODE = 'ffa';
const PLAY_DEFAULT_BOTS = 7;
const PLAY_DEFAULT_DIFFICULTY = 'regular';
const PLAY_SHUFFLE_MIN_BOTS = 3;
const PLAY_PLAYER_NAME = 'You';
const PLAY_LENGTHS = { short: 0.5, standard: 1, long: 1.5 };   // match length: the factor on the mode's score and time limits
const PLAY_LENGTH_IDS = Object.keys(PLAY_LENGTHS);
const PLAY_LENGTH_LABELS = ['Short', 'Standard', 'Long'];
const PLAY_DEFAULT_LENGTH = 'standard';
const PLAY_SCORE_STEP = 5;
const PLAY_TIME_STEP = 30;
const PLAY_AUTO_TEAM = -1;
const PLAY_DEFAULT_ROUNDS = -1;    // rounds to win: -1 = the mode's own
const PLAY_MAX_ROUND_WINS = 7;     // the most rounds to win any mode or the Custom editor offers
const PLAY_RESULT_TITLES = { win: 'Victory', loss: 'Defeat', draw: 'Draw', over: 'Match over' };
const PLAY_REASON_TEXT = { score: 'Score limit reached', time: 'Time is up', overtime: 'Decided in overtime', draw: 'Nobody could break the tie', eliminated: 'Last one standing', rounds: 'Rounds decided', tickets: 'Tickets ran out',
  victory: 'Mission complete', defeat: 'The run is over', extracted: 'Extracted in time', objective: 'Objective complete' };
const PlayResultsExtras = [];   // fn(body) panels later files add to the results screen (18j: XP and progress)
const PLAY_CSS = '.pl-title { font-size: 2.2em; font-weight: 800; margin: 0; } .pl-win { color: var(--ui-good, #58d66b); } .pl-loss { color: var(--ui-bad); }'
  + '.pl-stats { color: var(--ui-dim); margin: 4px 0 12px; } .pl-form { max-width: 640px; }';

// ---- The setup logic (no DOM: tested headless) ----
const PlayFlow = {
  // Modes with a registered behaviour and at least one map that lists them.
  playableModes() { return CAT.modes.filter((mode) => Modes.isPlayable(mode.id) && Maps.savedForMode(mode.id).length > 0); },
  maxBots() { return Quality.current().bots; },   // the quality preset's cap (PERF-009)
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
    return { mode: PLAY_DEFAULT_MODE, map: map ? map.id : '', ruleset: '', bots: Math.min(PLAY_DEFAULT_BOTS, this.maxBots()), difficulty: PLAY_DEFAULT_DIFFICULTY, team: PLAY_AUTO_TEAM, length: PLAY_DEFAULT_LENGTH,
      roundWins: PLAY_DEFAULT_ROUNDS };
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
      roundWins: mode.rounds && Number.isInteger(source.roundWins) && source.roundWins >= 1 && source.roundWins <= PLAY_MAX_ROUND_WINS ? source.roundWins : PLAY_DEFAULT_ROUNDS,
    };
  },
  remembered() { return this.normalize(Save.data && Save.data.play); },
  // roundWins is saved only when the choice sets it, and advanced ({ draft, team }) only after a Custom editor start, so a plain save keeps its old shape.
  remember(choice, advanced) {
    const play = { mode: choice.mode, map: choice.map, ruleset: choice.ruleset, bots: choice.bots, difficulty: choice.difficulty, team: choice.team, length: choice.length };
    if (choice.roundWins >= 1) play.roundWins = choice.roundWins;
    if (advanced) play.advanced = advanced;
    Save.data.play = play;
    Save.scheduleSave();
  },
  // A start from the Custom editor: Quick Match replays a copy of that draft and team (its mode, map and difficulty also fill the Play screen's last card).
  rememberAdvanced(draft, team) {
    const side = team === 0 || team === 1 ? team : PLAY_AUTO_TEAM;
    this.remember(this.normalize({ mode: draft.mode, map: draft.map, difficulty: draft.difficulty, team: side }), { draft: CustomMatch.copy(draft), team: side });
  },
  // The Game.start setup for a choice. `random` is injectable so tests get a fixed seed.
  buildSetup(choice, random) {
    const seed = newSeed(random);
    const setup = { mode: choice.mode, map: choice.map, mutators: [], bots: this.rosterBots(choice.bots, choice.difficulty, seed),
      seed, difficulty: choice.difficulty, player: { team: choice.team, name: PLAY_PLAYER_NAME } };
    if (choice.ruleset) setup.ruleset = choice.ruleset;
    const limits = this.lengthLimits(choice.mode, choice.length, choice.ruleset);
    const rounds = choice.roundWins >= 1 ? modeRoundOptions(CAT.modes.byId(choice.mode), choice.roundWins) : null;
    if (limits || rounds) setup.modeOptions = Object.assign({}, limits, rounds);
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
  // The mode's score (as the ruleset builds it: hero kits lower it), time and ticket limits scaled by the match length (Short 0.5x);
  // null for the standard length. Rounded up to 5 points or tickets / 30 s. Round modes and modes without limits get no field:
  // the Play screen then hides the choice.
  lengthLimits(modeId, length, ruleset) {
    const factor = PLAY_LENGTHS[length] || 1, mode = CAT.modes.byId(modeId);
    if (factor === 1 || !mode) return null;
    const limits = {}, scoreLimit = playScoreLimit(modeId, ruleset);
    if (scoreLimit > 0) limits.scoreLimit = Math.ceil(scoreLimit * factor / PLAY_SCORE_STEP) * PLAY_SCORE_STEP;
    if (mode.timeLimit > 0) limits.timeLimit = Math.ceil(mode.timeLimit * factor / PLAY_TIME_STEP) * PLAY_TIME_STEP;
    if (mode.params.tickets > 0) limits.params = { tickets: Math.ceil(mode.params.tickets * factor / PLAY_SCORE_STEP) * PLAY_SCORE_STEP };
    return limits;
  },
  hasLength(modeId) { return Object.keys(this.lengthLimits(modeId, PLAY_LENGTH_IDS[0]) || {}).length > 0; },
  // Team modes let the player pick a side, unless the mode sets the sides itself (params.fixedSides: Blight, Ravager vs Fiends).
  hasTeamChoice(modeId) {
    const mode = CAT.modes.byId(modeId);
    return !!mode && mode.teams === TEAM_COUNT && !mode.params.fixedSides;
  },
  // Starts a match for a choice (normalized and remembered). Runs synchronously so a click can still lock the pointer.
  start(choice, random) {
    const valid = this.normalize(choice);
    if (!valid.map) { Ui.toast('No map is available for that mode'); return null; }
    this.remember(valid);
    return Game.start(this.buildSetup(valid, random));
  },
  // After an Advanced start the save holds a copy of the draft that was started and its team: Quick Match replays that copy, whatever
  // the editor holds by now.
  quickMatch() {
    const play = Save.data && Save.data.play, advanced = play && play.advanced;
    if (isPlainObject(advanced) && isPlainObject(advanced.draft)) return this.startAdvanced(CustomMatch.validate(advanced.draft).draft, advanced.team);
    return this.start(this.remembered());
  },
  // Starts a match from a Custom editor draft (a copy is remembered for Quick Match). team: the Match setup's side choice, for a team mode.
  startAdvanced(draft, team) {
    const setup = CustomMatch.setup(draft);
    if (!setup.map) { Ui.toast('No map is available for that mode'); return null; }
    if (CAT.modes.byId(draft.mode).teams === TEAM_COUNT && (team === 0 || team === 1)) setup.player = { team };
    this.rememberAdvanced(draft, team);
    return CustomMatch.start(setup);
  },
  // ---- Mode cards (P4-02): the curated first list, each with its default setup ----
  cardFor(modeId) { return MODE_CARDS.find((card) => card.mode === modeId) || null; },
  // The card that holds the focus on Play: the last started mode's own, else its parent's, else another card of its family, else the first.
  lastCard() {
    const mode = this.remembered().mode, parent = modeParentId(mode);
    return this.cardFor(mode) || this.cardFor(parent) || MODE_CARDS.find((card) => modeParentId(card.mode) === parent) || MODE_CARDS[0];
  },
  // The remembered setup when it is a variant (with no card of its own) of this card's mode: Play opens its parent card with that variant chosen.
  variantChoice(card) {
    const last = this.remembered();
    const reopen = last.mode !== card.mode && modeParentId(last.mode) === card.mode && !this.cardFor(last.mode);
    return reopen ? Object.assign({}, last, { ruleset: '' }) : undefined;   // a rule bundle chosen long ago under Advanced does not come back unseen
  },
  // What Match setup starts with for a mode: its card's defaults, else its row's own (smallest map, its bot count). The difficulty is the
  // remembered one; keep ({ difficulty, team, length }) carries the player's choices over a variant switch.
  modeChoice(modeId, keep) {
    const card = this.cardFor(modeId), kept = keep || {};
    return this.normalize({ mode: modeId, map: card ? card.map : undefined, roundWins: card ? card.roundWins : undefined,
      difficulty: kept.difficulty || this.remembered().difficulty, team: kept.team, length: kept.length });
  },
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
    const setup = Progress.retrySetup(Game.match.setup) || Object.assign({}, Game.match.setup, { seed: newSeed(random) });
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
    return Game.start(Object.assign({}, setup, { map: next ? next.id : setup.map, seed: newSeed(random) }));
  },
  // 'win' | 'loss' | 'draw' | 'over' from the results record and the local player.
  outcome(results) {
    if (results.lost) return 'loss';
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

// ---- Mode facts for the Play screens (the screens themselves are in 18r) ----
// The standard-length score limit the match will use (Rules.build applies the ruleset's own rules, such as the hero kill limit).
function playScoreLimit(modeId, ruleset) { return Rules.build(ruleset ? { mode: modeId, ruleset } : { mode: modeId }).scoreLimit; }

// Players and limits in a few words: "8 players, first to 25, 10 min". roundWins (>= 1): rounds to win when it differs from the mode's.
function playModeFacts(modeId, ruleset, roundWins) {
  const mode = CAT.modes.byId(modeId), scoreLimit = playScoreLimit(modeId, ruleset);
  const parts = [mode.sizeDefault + ' players'];
  if (mode.params.squadSize) parts.push('squads of ' + mode.params.squadSize);
  if (scoreLimit > 0) parts.push('first to ' + scoreLimit);
  if (mode.rounds) parts.push('first to ' + (roundWins >= 1 ? roundWins : mode.rounds.winsNeeded) + ' rounds');
  if (mode.params.ladder) parts.push(mode.params.ladder.length + ' guns');
  if (mode.timeLimit > 0) parts.push(Math.round(mode.timeLimit / 60) + ' min');
  return parts.join(', ');
}
function playModeSummary(modeId, ruleset, roundWins) {
  return (CAT.modes.byId(modeId).goal + ' ' + playModeFacts(modeId, ruleset, roundWins) + '.').trim();
}
// The mode options for "first to N rounds" (Custom editor and Match setup): at most 2N - 1 rounds; a mode with a side switch
// (bomb, ghostops) switches after N - 1 of them, so both sides attack.
function modeRoundOptions(mode, wins) {
  return { rounds: { winsNeeded: wins, limit: wins * 2 - 1, switchAt: mode.rounds.switchAt > 0 ? wins - 1 : 0 } };
}

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
    if (Game.match && !Game.match.setup.progress) {
      foot.appendChild(Ui.button('Next map', () => PlayFlow.nextMap()));
      foot.appendChild(Ui.button('Change mode', () => Ui.open('playSetup', { mode: Game.match.setup.mode })));   // Match setup of the same card (18r)
    }
    foot.appendChild(Ui.button('Main menu', () => Game.stop()));
    root.appendChild(foot);
  },
  onOpen() { Input.exitLock(); },
});

Bus.on('boot', () => injectStyle('play-style', PLAY_CSS));
