// ==== S15 PROGRESSION: LADDER, CHALLENGE ROOMS, OPERATIONS, DAILY SEED ====
// Tournament Ladder (PRG-003), Challenge Rooms (PRG-004), Operations with ticket carry-over and the comeback unit (PRG-007)
// and the Daily Seed (PRG-006). Each builds a Game.start setup tagged setup.progress = { kind, ... } and judges the finished
// match in its Progress handler (15a calls it once per match). Progress lives in Save.data (ladder, progression). Data: 03p.

const PROGRESS_PLAYER_NAME = 'You';
const PROGRESS_PLAYER_TEAM = 0;
const PROGRESS_ENEMY_TEAM = 1;
const MINUTE_MS = 60000;
const OPERATION_WARN_TICKETS = 10;
const operationAnnounce = { text: '', kind: 'objective', priority: 1 };

function progressSetup(fields, progress, seed) {
  return Object.assign({ mutators: [], bots: [], seed, player: { team: PROGRESS_PLAYER_TEAM, name: PROGRESS_PLAYER_NAME }, progress }, fields);
}

// ---- Tournament Ladder ----
const Ladder = {
  state() { return Progress.ladder(); },
  key(tier, match) { return tier + '.' + match; },
  entry(tier, match) { const row = CAT.ladder[tier]; return row ? row.matches[match] || null : null; },
  matchCount() { return CAT.ladder.reduce((sum, row) => sum + row.matches.length, 0); },
  clearedCount() { return Object.keys(this.state().cleared).length; },
  // A match can be played once the ladder reached it (earlier ones stay replayable).
  isOpen(tier, match) {
    const state = this.state();
    if (state.done || Progress.unlockAll()) return true;
    return tier < state.tier || (tier === state.tier && match <= state.match);
  },
  difficultyFor(tier, match) { return this.state().difficulty[this.key(tier, match)] || CAT.ladder[tier].difficulty; },
  setDifficulty(tier, match, difficultyId) {
    if (!CAT.difficulty.byId(difficultyId)) return false;
    this.state().difficulty[this.key(tier, match)] = difficultyId;
    Save.scheduleSave();
    return true;
  },
  // Named bots at their roster tier, held inside the chosen difficulty's tier range (an easier choice softens the field).
  setup(tier, match, difficultyId, seed) {
    const entry = this.entry(tier, match), difficulty = CAT.difficulty.byId(difficultyId) || CAT.difficulty.byId(this.difficultyFor(tier, match));
    const teams = CAT.modes.byId(entry.mode).teams === TEAM_COUNT, allies = entry.allies || 0;
    const bots = entry.bots.map((profile, index) => ({
      profile, tier: clamp(CAT.bots.byId(profile).tier, difficulty.tierMin, difficulty.tierMax),
      team: teams ? (index < allies ? PROGRESS_PLAYER_TEAM : PROGRESS_ENEMY_TEAM) : undefined,
    }));
    return progressSetup({ mode: entry.mode, map: entry.map, bots, difficulty: difficulty.id, modeOptions: Object.assign({}, LADDER_OPTIONS[entry.mode] || {}), balance: false },
      { kind: 'ladder', tier, match }, seed);
  },
  start(tier, match, difficultyId, random) {
    if (!this.isOpen(tier, match)) return null;
    return Game.start(this.setup(tier, match, difficultyId || this.difficultyFor(tier, match), newSeed(random)));
  },
  // Free-for-all: a podium place (the XP podium rule); duels and team modes: a win.
  passed(results) { return Progress.onPodium(results) || Progress.outcome(results) === 'win'; },
  // Play again: the same ladder match at the difficulty it was played on, a fresh seed.
  retry(tag, setup) { return this.setup(tag.tier, tag.match, setup.difficulty, newSeed()); },
  // After a pass: the match that follows on the ladder, if the ladder has one open.
  nextStep(tag) {
    if (!Game.match || !Game.match.results || !this.passed(Game.match.results)) return null;
    const tierEnds = tag.match + 1 >= CAT.ladder[tag.tier].matches.length;
    const tier = tag.tier + (tierEnds ? 1 : 0), match = tierEnds ? 0 : tag.match + 1;
    if (tier >= CAT.ladder.length || !this.isOpen(tier, match)) return null;
    return { label: 'Next match', build: () => this.setup(tier, match, this.difficultyFor(tier, match), newSeed()) };
  },
  onResult(match, metrics, award) {
    const tag = match.setup.progress, entry = this.entry(tag.tier, tag.match), state = this.state();
    if (!entry) return;
    if (!this.passed(match.results)) { award.lines.push('Ladder: not cleared. Retry any time.'); return; }
    const first = !state.cleared[this.key(tag.tier, tag.match)];
    state.cleared[this.key(tag.tier, tag.match)] = true;
    if (first) award.xp += PROGRESS_XP.ladderMatch;
    if (tag.tier === state.tier && tag.match === state.match) this.advance(state);
    award.lines.push(entry.final ? 'Ladder champion! The Warden of Nine has fallen.' : 'Ladder match cleared.');
    Save.scheduleSave();
  },
  advance(state) {
    if (state.done) return;
    state.match++;
    if (state.match < CAT.ladder[state.tier].matches.length) return;
    state.match = 0;
    state.tier++;
    if (state.tier < CAT.ladder.length) return;
    state.tier = CAT.ladder.length - 1;
    state.match = CAT.ladder[state.tier].matches.length - 1;
    state.done = true;
  },
};

// ---- Challenge Rooms ----
const Challenges = {
  record(id) {
    const records = Progress.profile().challenges;
    if (!isPlainObject(records[id])) records[id] = {};
    return fillMissing(records[id], { best: 0, stars: 0, expertBest: 0, expertStars: 0, plays: 0 });
  },
  isOpen(row) { return row.group <= Progress.roomGroup(); },
  expertOpen(id) { return Progress.unlockAll() || this.record(id).stars >= CHALLENGE_EXPERT_STARS; },
  starsFor(row, points) { return row.stars.filter((threshold) => points >= threshold).length; },
  totalStars() {
    let total = 0;
    for (const row of CAT.challenges) { const record = this.record(row.id); total += record.stars + record.expertStars; }
    return total;
  },
  // Expert = bots expertTier tiers up plus the room's own `expert` mutators, else its kind's (CHALLENGE_EXPERT_MUTATORS).
  expertMutators(row) { return row.expert.length ? row.expert : CHALLENGE_EXPERT_MUTATORS[row.kind]; },
  setup(id, expert, seed) {
    const row = CAT.challenges.byId(id), tier = clamp(row.tier + (expert ? row.expertTier : 0), 0, CAT.botTiers.length - 1);
    const bots = Array.from({ length: row.bots }, () => ({ tier }));
    return progressSetup({ mode: row.mode, map: row.map, bots, difficulty: expert ? CHALLENGE_DIFFICULTY.expert : CHALLENGE_DIFFICULTY.normal, cards: [],   // a fixed trial: no placed cards
      mutators: row.mutators.concat(expert ? this.expertMutators(row) : []), modeOptions: Object.assign({}, row.options) }, { kind: 'challenge', id, expert: !!expert }, seed);
  },
  start(id, expert, random) {
    const row = CAT.challenges.byId(id);
    if (!row || !this.isOpen(row) || (expert && !this.expertOpen(id))) return null;
    return Game.start(this.setup(id, expert, newSeed(random)));
  },
  // Stars newly earned pay XP once (replaying for the same stars pays only the match XP: no grind).
  onResult(match, metrics, award) {
    const tag = match.setup.progress, row = CAT.challenges.byId(tag.id);
    if (!row) return;
    const record = this.record(row.id), points = Progress.points(row.points, metrics, row.par), stars = this.starsFor(row, points);
    const bestField = tag.expert ? 'expertBest' : 'best', starField = tag.expert ? 'expertStars' : 'stars';
    const gained = Math.max(0, stars - record[starField]), expertNew = !tag.expert && record.stars < CHALLENGE_EXPERT_STARS && stars >= CHALLENGE_EXPERT_STARS;
    record.plays++;
    record[bestField] = Math.max(record[bestField], points);
    record[starField] = Math.max(record[starField], stars);
    award.xp += gained * PROGRESS_XP.challengeStar;
    award.lines.push(row.name + (tag.expert ? ' (Expert)' : '') + ': ' + points + ' points, ' + stars + ' of 3 stars' + (gained ? ' (new best)' : ''));
    if (expertNew) award.lines.push('Expert version unlocked.');
    Save.scheduleSave();
  },
};

// ---- A room on a PvE mode ends here: Siege Waves runs ten waves and the range keeps no clock, so a wave room ends as a win
// after its `waves` cleared waves and the range course at its time limit (at the rules stage, like the operation tickets) ----
const ChallengeRun = {
  row: null,
  wavesCleared: 0,
  onStart(match) {
    const tag = match.setup.progress;
    this.row = tag && tag.kind === 'challenge' && Modes.active && Modes.rules.family !== 'versus' ? CAT.challenges.byId(tag.id) : null;
    this.wavesCleared = 0;
    if (this.row && this.row.waves > 0) PVE_HUD.waves = this.row.waves;   // the wave HUD counts the room's waves
  },
  onWave(event) { if (this.row && event.phase === 'end') this.wavesCleared++; },
  step() {
    const row = this.row;
    if (!row || !Modes.active) return;
    const cleared = row.waves > 0 && this.wavesCleared >= row.waves, timeUp = Modes.rules.timeLimit > 0 && Modes.timeLeft(Sim.time) <= 0;
    if (!cleared && !timeUp) return;
    this.row = null;
    Modes.finish(Modes.over(coopWinner(), cleared ? PVE_WIN : 'time'));
  },
};

// ---- Operations: three maps, tickets carried over, the comeback unit ----
const OperationRun = {
  active: false,
  tickets: new Float64Array(TEAM_COUNT),
  warned: new Uint8Array(TEAM_COUNT),
  onStart(match) {
    const tag = match.setup.progress;
    this.active = !!tag && tag.kind === 'operation' && Modes.active;
    if (!this.active) return;
    for (let team = 0; team < TEAM_COUNT; team++) { this.tickets[team] = tag.tickets[team]; this.warned[team] = 0; }
  },
  onKill(event) {
    if (!this.active || !Modes.participant[event.victim]) return;
    const team = Actors.team[event.victim];
    if (team < 0 || team >= TEAM_COUNT) return;
    this.tickets[team] = Math.max(0, this.tickets[team] - OPERATION_TICKETS.deathCost);
    if (this.tickets[team] > OPERATION_WARN_TICKETS || this.warned[team]) return;
    this.warned[team] = 1;
    operationAnnounce.text = TEAM_NAMES[team] + ': ' + OPERATION_WARN_TICKETS + ' tickets left';
    Bus.emit('announce', operationAnnounce);
  },
  // A side out of tickets loses the map (after the kill that emptied it, at the rules stage).
  step() {
    if (!this.active || !Modes.active) return;
    for (let team = 0; team < TEAM_COUNT; team++) {
      if (this.tickets[team] > 0) continue;
      this.active = false;
      Modes.finish(Modes.over(1 - team, 'tickets'));
      return;
    }
  },
};

const Operations = {
  freshState() { return { stage: 0, tickets: [OPERATION_TICKETS.base, OPERATION_TICKETS.base], wins: [0, 0], comeback: -1, done: false, result: '', completed: 0 }; },
  state(id) {
    const records = Progress.profile().operations;
    if (!isPlainObject(records[id])) records[id] = this.freshState();
    return fillMissing(records[id], this.freshState());
  },
  reset(id) {
    const completed = this.state(id).completed;
    Progress.profile().operations[id] = Object.assign(this.freshState(), { completed });
    Save.scheduleSave();
  },
  // PRG-007 carry-over: base + carry x tickets left, capped. A side that ran out carries nothing.
  carryTickets(left) { return Math.min(OPERATION_TICKETS.cap, OPERATION_TICKETS.base + Math.floor(OPERATION_TICKETS.carry * Math.max(0, left))); },
  setup(id, seed) {
    const row = CAT.operations.byId(id), state = this.state(id), stage = row.stages[Math.min(state.stage, row.stages.length - 1)];
    const bots = [];
    for (let index = 0; index < row.bots - 1; index++) bots.push({ team: PROGRESS_PLAYER_TEAM });
    for (let index = 0; index < row.bots; index++) bots.push({ team: PROGRESS_ENEMY_TEAM });
    if (state.comeback >= 0) bots.push({ profile: OPERATION_COMEBACK.profile, tier: OPERATION_COMEBACK.tier, name: OPERATION_COMEBACK.name, team: state.comeback });
    return progressSetup({ mode: stage.mode, map: stage.map, bots, difficulty: row.difficulty, balance: false, modeOptions: { scoreLimit: 0 } },
      { kind: 'operation', id, stage: state.stage, tickets: state.tickets.slice() }, seed);
  },
  // The operation's current map; a finished operation begins a new run.
  nextSetup(id, seed) {
    if (this.state(id).done) this.reset(id);
    return this.setup(id, seed);
  },
  // The operation's next map once this one is counted (none after the last map: New run starts the operation again).
  nextStep(tag) {
    if (this.state(tag.id).done) return null;
    return { label: 'Next map', build: () => this.setup(tag.id, newSeed()) };
  },
  start(id, random) {
    if (!CAT.operations.byId(id)) return null;
    return Game.start(this.nextSetup(id, newSeed(random)));
  },
  // The map's winner; a draw goes to the side with more tickets left.
  stageWinner(results) {
    if (results.winnerTeam >= 0) return results.winnerTeam;
    if (OperationRun.tickets[0] === OperationRun.tickets[1]) return -1;
    return OperationRun.tickets[0] > OperationRun.tickets[1] ? 0 : 1;
  },
  onResult(match, metrics, award) {
    const tag = match.setup.progress, row = CAT.operations.byId(tag.id), state = this.state(tag.id);
    if (!row || state.done || tag.stage !== state.stage) return;
    const winner = this.stageWinner(match.results);
    if (winner >= 0) state.wins[winner]++;
    state.tickets = [this.carryTickets(OperationRun.tickets[0]), this.carryTickets(OperationRun.tickets[1])];
    state.comeback = winner >= 0 ? 1 - winner : -1;
    state.stage++;
    if (award.breakdown.total > 0) award.xp += PROGRESS_XP.operationStage;   // the map pays only a player who took part (no idle farming)
    award.lines.push(row.name + ' map ' + state.stage + ' of ' + row.stages.length + ': ' + (winner === PROGRESS_PLAYER_TEAM ? 'won' : winner < 0 ? 'drawn' : 'lost')
      + '. Tickets next map: ' + state.tickets[0] + ' / ' + state.tickets[1]);
    if (state.stage >= row.stages.length) this.complete(row, state, award);
    Save.scheduleSave();
  },
  complete(row, state, award) {
    state.done = true;
    state.completed++;
    state.result = state.wins[PROGRESS_PLAYER_TEAM] > state.wins[PROGRESS_ENEMY_TEAM] ? 'won' : 'lost';
    award.lines.push('Operation ' + row.name + ' ' + state.result + ' (' + state.wins[0] + ' - ' + state.wins[1] + ').');
  },
};

// ---- Daily Seed: the local date decides everything; best score per date, replayable, no streaks ----
const Daily = {
  generateMap: null,   // hook filled by the map generator (16w): fn(options) -> map row, MapGen.generate
  // 'YYYY-MM-DD' of a moment at a UTC offset in minutes (tests pin the offset; the game passes the device's).
  dateKey(milliseconds, offsetMinutes) {
    const shifted = new Date(milliseconds + offsetMinutes * MINUTE_MS);
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0'), day = String(shifted.getUTCDate()).padStart(2, '0');
    return shifted.getUTCFullYear() + '-' + month + '-' + day;
  },
  todayKey() { const now = Date.now(); return this.dateKey(now, -new Date(now).getTimezoneOffset()); },
  modes() { return DAILY_RULES.modes.filter((mode) => Modes.isPlayable(mode) && dailyHandMaps(mode).length > 0); },
  // Mode, bundle, 2 non-conflicting mutators, the hand-made map and the generator id, all from the date's seed.
  // Only setup() builds the generated map (tens to hundreds of ms), so showing the choice on the Daily screen stays cheap.
  choiceFor(key) {
    const seed = hashString('daily:' + key), random = makeRandom(seed);
    const mode = random.pick(this.modes()), ruleset = random.pick(DAILY_RULES.rulesets);
    const mutators = [];
    for (const id of random.shuffle(DAILY_RULES.mutators.slice())) {
      if (mutators.length >= DAILY_RULES.mutatorCount) break;
      if (!mutators.some((taken) => Mutators.conflicts(taken, id))) mutators.push(id);
    }
    const hand = random.pick(dailyHandMaps(mode)), generator = random.pick(dailyGenerators(mode));
    return { key, seed, mode, ruleset, mutators, map: hand.id, generator: Daily.generateMap && generator ? generator.id : '' };
  },
  setup(key) {
    const choice = this.choiceFor(key), generated = dailyGeneratedMap(choice.seed, choice.mode, choice.generator);
    return progressSetup({ mode: choice.mode, map: generated || choice.map, ruleset: choice.ruleset, mutators: choice.mutators.slice(),
      bots: Array.from({ length: DAILY_RULES.bots }, () => ({})), difficulty: DAILY_RULES.difficulty },
    { kind: 'daily', key }, choice.seed);
  },
  start(key) { return Game.start(this.setup(key || this.todayKey())); },
  history() {
    const daily = Progress.profile().daily;
    return Object.keys(daily).sort().reverse().map((key) => ({ key, best: daily[key] }));
  },
  onResult(match, metrics, award) {
    const tag = match.setup.progress, daily = Progress.profile().daily, points = Progress.points(DAILY_RULES.points, metrics, 0);
    const first = daily[tag.key] === undefined;
    daily[tag.key] = Math.max(daily[tag.key] || 0, points);
    if (first && award.breakdown.total > 0) award.xp += PROGRESS_XP.daily;   // the first play pays only a player who took part (no idle farming)
    award.lines.push('Daily ' + tag.key + ': ' + points + ' points (best ' + daily[tag.key] + ')');
    const keys = Object.keys(daily).sort();
    while (keys.length > DAILY_RULES.historyDays) delete daily[keys.shift()];
    Save.scheduleSave();
  },
};

// The hand-made maps (S03 catalogue) serving a mode: never the editor's saved or generated maps, which differ per device.
function dailyHandMaps(mode) { return CAT.maps.filter((map) => map.modes.includes(mode)); }
// The map generators (GN rows) that build maps for the mode: a daily never plays on a generator made for other modes.
function dailyGenerators(mode) { return CAT.generators.filter((row) => row.modes.includes(mode)); }
// MAP-020: a map the date's generator builds for the mode at DAILY_RULES.mapSize (allowed on every quality tier, so every device
// builds the same map); null (the hand-made map) without the generator hook or a generator for the mode, or when the map built
// does not offer the mode (a fallback map for other modes).
function dailyGeneratedMap(seed, mode, generatorId) {
  if (!Daily.generateMap || !generatorId) return null;
  try {
    const map = Daily.generateMap({ generator: generatorId, seed, mode, size: DAILY_RULES.mapSize });
    return map && Array.isArray(map.spawns) && map.spawns.length > 0 && map.modes.includes(mode) ? map : null;
  } catch (error) {
    ErrorLog.add('daily map', error);
    return null;
  }
}

Progress.addHandler('ladder', (match, metrics, award) => Ladder.onResult(match, metrics, award));
Progress.addHandler('challenge', (match, metrics, award) => Challenges.onResult(match, metrics, award));
Progress.addHandler('operation', (match, metrics, award) => Operations.onResult(match, metrics, award));
Progress.addHandler('daily', (match, metrics, award) => Daily.onResult(match, metrics, award));
Progress.addRetry('ladder', (tag, setup) => Ladder.retry(tag, setup));
Progress.addRetry('challenge', (tag) => Challenges.setup(tag.id, tag.expert, newSeed()));
Progress.addRetry('operation', (tag) => Operations.nextSetup(tag.id, newSeed()), 'New run');
Progress.addRetry('daily', (tag) => Daily.setup(tag.key));
Progress.addNext('ladder', (tag) => Ladder.nextStep(tag));
Progress.addNext('operation', (tag) => Operations.nextStep(tag));
Sim.addSystem('operationTickets', 75, () => OperationRun.step());
Sim.addSystem('challengeEnd', 75, () => ChallengeRun.step());
Bus.on('match.start', (match) => ChallengeRun.onStart(match));
Bus.on('match.stop', () => { ChallengeRun.row = null; });
Bus.on('pve.wave', (event) => ChallengeRun.onWave(event));
Bus.on('match.start', (match) => OperationRun.onStart(match));
Bus.on('match.stop', () => { OperationRun.active = false; });
Bus.on('kill', (event) => OperationRun.onKill(event));
