// ==== S15 PROGRESSION: LADDER, CHALLENGE ROOMS, OPERATIONS, DAILY SEED ====
// Tournament Ladder (PRG-003), Challenge Rooms (PRG-004), Operations with ticket carry-over and the comeback unit (PRG-007)
// and the Daily Seed (PRG-006). Each builds a Game.start setup tagged setup.progress = { kind, ... } and judges the finished
// match in its Progress handler (15a calls it once per match). Progress lives in Save.data (ladder, progression). Data: 03p.

const PROGRESS_PLAYER_NAME = 'You';
const PROGRESS_SEED_RANGE = 0x7fffffff;
const PROGRESS_PLAYER_TEAM = 0;
const PROGRESS_ENEMY_TEAM = 1;
const MINUTE_MS = 60000;
const OPERATION_WARN_TICKETS = 10;
const operationAnnounce = { text: '', kind: 'objective', priority: 1 };

function progressSeed(random) { return Math.floor((random || Math.random)() * PROGRESS_SEED_RANGE); }
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
    return Game.start(this.setup(tier, match, difficultyId || this.difficultyFor(tier, match), progressSeed(random)));
  },
  // Free-for-all: a podium place (the XP podium rule); duels and team modes: a win.
  passed(results) { return Progress.onPodium(results) || Progress.outcome(results) === 'win'; },
  // Play again: the same ladder match at the difficulty it was played on, a fresh seed.
  retry(tag, setup) { return this.setup(tag.tier, tag.match, setup.difficulty, progressSeed()); },
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
    if (!isPlainRecord(records[id])) records[id] = {};
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
  setup(id, expert, seed) {
    const row = CAT.challenges.byId(id), tier = clamp(row.tier + (expert ? row.expertTier : 0), 0, CAT.botTiers.length - 1);
    const bots = Array.from({ length: row.bots }, () => ({ tier }));
    return progressSetup({ mode: row.mode, map: row.map, bots, difficulty: expert ? CHALLENGE_DIFFICULTY.expert : CHALLENGE_DIFFICULTY.normal,
      mutators: row.mutators.concat(expert ? row.expert : []), modeOptions: Object.assign({}, row.options) }, { kind: 'challenge', id, expert: !!expert }, seed);
  },
  start(id, expert, random) {
    const row = CAT.challenges.byId(id);
    if (!row || !this.isOpen(row) || (expert && !this.expertOpen(id))) return null;
    return Game.start(this.setup(id, expert, progressSeed(random)));
  },
  // Stars newly earned pay XP once (replaying for the same stars pays only the match XP: no grind).
  onResult(match, metrics, award) {
    const tag = match.setup.progress, row = CAT.challenges.byId(tag.id);
    if (!row) return;
    const record = this.record(row.id), points = Progress.points(row.points, metrics, row.par), stars = this.starsFor(row, points);
    const bestField = tag.expert ? 'expertBest' : 'best', starField = tag.expert ? 'expertStars' : 'stars';
    const gained = Math.max(0, stars - record[starField]);
    record.plays++;
    record[bestField] = Math.max(record[bestField], points);
    record[starField] = Math.max(record[starField], stars);
    award.xp += gained * PROGRESS_XP.challengeStar;
    award.lines.push(row.name + (tag.expert ? ' (Expert)' : '') + ': ' + points + ' points, ' + stars + ' of 3 stars' + (gained ? ' (new best)' : ''));
    if (!tag.expert && record.stars >= CHALLENGE_EXPERT_STARS && stars >= CHALLENGE_EXPERT_STARS && gained) award.lines.push('Expert version unlocked.');
    Save.scheduleSave();
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
    if (!isPlainRecord(records[id])) records[id] = this.freshState();
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
  start(id, random) {
    if (!CAT.operations.byId(id)) return null;
    return Game.start(this.nextSetup(id, progressSeed(random)));
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
    award.xp += PROGRESS_XP.operationStage;
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
  // 'YYYY-MM-DD' of a moment at a UTC offset in minutes (tests pin the offset; the game passes the device's).
  dateKey(milliseconds, offsetMinutes) {
    const shifted = new Date(milliseconds + offsetMinutes * MINUTE_MS);
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0'), day = String(shifted.getUTCDate()).padStart(2, '0');
    return shifted.getUTCFullYear() + '-' + month + '-' + day;
  },
  todayKey() { const now = Date.now(); return this.dateKey(now, -new Date(now).getTimezoneOffset()); },
  modes() { return DAILY_RULES.modes.filter((mode) => Modes.isPlayable(mode) && dailyHandMaps(mode).length > 0); },
  // Mode, bundle, 2 non-conflicting mutators and the map, all from the date's seed.
  choiceFor(key) {
    const seed = hashString('daily:' + key), random = makeRandom(seed);
    const mode = random.pick(this.modes()), ruleset = random.pick(DAILY_RULES.rulesets);
    const mutators = [];
    for (const id of random.shuffle(DAILY_RULES.mutators.slice())) {
      if (mutators.length >= DAILY_RULES.mutatorCount) break;
      if (!mutators.some((taken) => Mutators.conflicts(taken, id))) mutators.push(id);
    }
    const hand = random.pick(dailyHandMaps(mode));
    return { key, seed, mode, ruleset, mutators, map: hand.id, generated: dailyGeneratedMap(seed, mode) };
  },
  setup(key) {
    const choice = this.choiceFor(key);
    return progressSetup({ mode: choice.mode, map: choice.generated || choice.map, ruleset: choice.ruleset, mutators: choice.mutators.slice(),
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
    if (first) award.xp += PROGRESS_XP.daily;
    award.lines.push('Daily ' + tag.key + ': ' + points + ' points (best ' + daily[tag.key] + ')');
    const keys = Object.keys(daily).sort();
    while (keys.length > DAILY_RULES.historyDays) delete daily[keys.shift()];
    Save.scheduleSave();
  },
};

// The hand-made maps (S03 catalogue) serving a mode: never the editor's saved or generated maps, which differ per device.
function dailyHandMaps(mode) { return CAT.maps.filter((map) => map.modes.includes(mode)); }
// MAP-020: a generated map when the map generator section is present (another helper builds MapGen), else null (hand-made map).
function dailyGeneratedMap(seed, mode) {
  if (typeof MapGen === 'undefined' || typeof MapGen.generate !== 'function') return null;
  try {
    const map = MapGen.generate({ seed, mode });
    return map && typeof map === 'object' && Array.isArray(map.spawns) && map.spawns.length > 0 ? map : null;
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
Progress.addRetry('challenge', (tag) => Challenges.setup(tag.id, tag.expert, progressSeed()));
Progress.addRetry('operation', (tag) => Operations.nextSetup(tag.id, progressSeed()));
Progress.addRetry('daily', (tag) => Daily.setup(tag.key));
Sim.addSystem('operationTickets', 75, () => OperationRun.step());
Bus.on('match.start', (match) => OperationRun.onStart(match));
Bus.on('match.stop', () => { OperationRun.active = false; });
Bus.on('kill', (event) => OperationRun.onKill(event));
