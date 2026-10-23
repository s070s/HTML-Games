// ==== S15 PROGRESSION: PROFILE, XP, LEVELS, UNLOCKS, STATS ====
// The local profile (PRG-010..PRG-014, ECO-002, ARC-020): XP from score, objectives and medals at the end of every match the
// player took part in, levels 1..50, unlocks (cosmetics and sidegrades only, never a stat), the "Unlock everything" option,
// statistics per weapon / mode / map with weapon mastery, the run metrics of the current match (RunLog) that challenges,
// cards and the daily seed score, and the save migration of the progress fields. Data: 03p. Contracts: docs/api/progression.md.

const PROGRESS_VERSION = 2;                 // 2: profile.chambers (MP11 chamber records)
const PROGRESS_SECONDS_PER_MINUTE = 60;
const PROGRESS_NOT_REACHED = -1;            // run metrics a match could not measure (enemies left outside a PvE match, a level report number missing)
// A number of the PvE level report (14j PveLevel: props, secrets, optional enemies), or not measured.
function pveReported(results, key) {
  const pve = results && results.pve ? results.pve : null;
  return pve && typeof pve[key] === 'number' ? pve[key] : PROGRESS_NOT_REACHED;
}
const PROGRESS_NEVER = Infinity;            // boss times nobody reported
const PROGRESS_NO_LOOK = -1;                // no colour / finish worn (the default body look)
const CHAMBER_SECONDS_STEP = 10;            // chamber record times are kept to a tenth of a second

Settings.define('progress.unlockAll', false, { label: 'Unlock everything', category: 'gameplay' });

// Kill styles shared by the run metrics and the medals (MD15 Airborne, MD16 Long Shot): one rule each.
function isAirborne(id) {
  return !(Actors.flags[id] & (ACTOR_FLAG.ON_GROUND | ACTOR_FLAG.IN_WATER | ACTOR_FLAG.ON_LADDER));
}
function isLongShot(killer, event) {
  return Math.hypot(Actors.x[killer] - event.x, Actors.y[killer] - event.y, Actors.z[killer] - event.z) > MEDAL_RULES.longShotMetres;
}

// ---- Run metrics of the local player in the running match (reset on match.start; plain numbers, no allocation per event) ----
const RunLog = {
  kills: 0, deaths: 0, airKills: 0, rangedKills: 0, explosiveShots: 0, damageTaken: 0,
  lowestHealth: 0, souls: 0, armorPickups: 0, marks: 0, wrathForms: 0, wrathKills: 0, inWrath: false, chamberRecords: 0,
  bossSeconds: PROGRESS_NEVER, finalBossSeconds: PROGRESS_NEVER,
  outSeconds: PROGRESS_NEVER,  // match seconds when the player lost their last life (lives rules); PROGRESS_NEVER while still in
  weaponUsed: new Uint8Array(WEAPON_COUNT),
  metrics: {},                // reused result of measure()

  reset() {
    this.kills = this.deaths = this.airKills = this.rangedKills = this.explosiveShots = 0;
    this.damageTaken = this.souls = this.armorPickups = this.marks = this.wrathForms = this.wrathKills = 0;
    this.inWrath = false;
    this.chamberRecords = 0;
    this.lowestHealth = Infinity;
    this.bossSeconds = this.finalBossSeconds = this.outSeconds = PROGRESS_NEVER;
    this.weaponUsed.fill(0);
  },
  isPlayer(id) { return id >= 0 && id === Game.playerId; },
  // S13 counts the life lost first (its kill listener runs earlier), so lives 0 here means the player is out of the match.
  onKill(event) {
    if (this.isPlayer(event.victim)) this.deaths++;
    if (this.isPlayer(event.victim) && Modes.lives[event.victim] === 0) this.outSeconds = Math.min(this.outSeconds, Sim.time - Modes.startTime);
    if (!this.isPlayer(event.killer) || event.victim === event.killer) return;
    this.kills++;
    const weapon = CAT.weapons.byId(event.weapon);
    if (weapon) this.weaponUsed[weapon.index] = 1;
    if (!weapon || weapon.class !== 'melee') this.rangedKills++;
    if (isAirborne(event.killer)) this.airKills++;
    if (this.inWrath) this.wrathKills++;
  },
  // Wrath Form starts or ends for the player (A34 ability.cast / ability.end); a start while already in it is the same form.
  setWrath(id, active) {
    if (!this.isPlayer(id)) return;
    if (active && !this.inWrath) this.wrathForms++;
    this.inWrath = active;
  },
  onDamage(event) {
    if (!this.isPlayer(event.target)) return;
    if (event.source !== event.target) this.damageTaken += event.amount;
    this.lowestHealth = Math.min(this.lowestHealth, Actors.health[event.target]);
  },
  onFire(event) {
    if (!this.isPlayer(event.id)) return;
    const weapon = CAT.weapons.byId(event.weapon);
    if (weapon) this.weaponUsed[weapon.index] = 1;
  },
  // Any explosion the player caused (a grenade, a gadget, a barrel they shot) is explosive use, like a rocket shot.
  onExplosion(event) { if (event.radius > 0 && this.isPlayer(event.owner)) this.explosiveShots++; },   // a gadget pop (smoke, fire: radius 0) is no blast
  onPickup(event) { if (this.isPlayer(event.id) && event.group === 'armor') this.armorPickups++; },
  weaponsUsed() {
    let count = 0;
    for (let index = 0; index < WEAPON_COUNT; index++) count += this.weaponUsed[index];
    return count;
  },
  // Every number challenges, cards and the daily seed read, for the finished (or running) match. Reused object.
  measure(match) {
    const out = this.metrics, results = match && match.results, mine = Progress.playerResult(results);
    out.kills = this.kills; out.deaths = this.deaths; out.airKills = this.airKills;
    out.rangedKills = this.rangedKills; out.explosiveShots = this.explosiveShots;
    out.damageTaken = Math.round(this.damageTaken); out.souls = this.souls; out.armorPickups = this.armorPickups;
    out.marks = this.marks; out.wrathForms = this.wrathForms; out.wrathKills = this.wrathKills; out.weaponsUsed = this.weaponsUsed();
    out.lowestHealth = this.lowestHealth === Infinity ? (Game.playerId >= 0 ? Actors.health[Game.playerId] : 0) : this.lowestHealth;
    out.headshots = Progress.playerHeadshots(); out.accuracy = Progress.playerAccuracy() * Math.min(1, Progress.playerHits() / CHALLENGE_ACCURACY_HITS);
    out.seconds = results ? Math.min(results.duration, this.outSeconds) : 0;   // a player out of lives stops earning time (PRG-004)
    out.score = mine ? mine.score : 0; out.objective = mine ? mine.objective : 0; out.bestStreak = mine ? mine.bestStreak : 0;
    out.won = Progress.creditedWin(results) ? 1 : 0;
    out.placement = Progress.placement(results);
    out.cardsEquipped = match && match.rules && match.rules.cards ? match.rules.cards.ids.length : 0;
    out.hard = match ? Progress.isHard(match.rules ? match.rules.difficulty : '') : false;
    const trial = !!(match && match.setup && match.setup.progress && match.setup.progress.kind === 'challenge');   // a room is no PvE level
    out.pveFinished = match && match.rules && match.rules.family !== 'versus' && out.won && !trial ? 1 : 0;
    out.enemiesLeft = Pve.active ? enemiesLeft() : PROGRESS_NOT_REACHED;   // living plus queued enemies (14j), read once at the end
    out.propsLeft = pveReported(results, 'propsLeft'); out.secretsLeft = pveReported(results, 'secretsLeft'); out.optionalLeft = pveReported(results, 'optionalLeft');
    out.bossSeconds = this.bossSeconds; out.finalBossSeconds = this.finalBossSeconds;
    return out;
  },
};

// ---- Profile, XP, levels, unlocks, stats ----
const Progress = {
  handlers: new Map(),        // setup.progress.kind -> fn(match, metrics, award) (ladder, challenge, operation, daily, cards)
  finishers: [],              // fn(match, metrics, award) for every finished match (card unlocks, marks)
  preFinishers: [],           // fn(match) before anything is counted (end-of-match medals such as MD19)
  retries: new Map(),         // setup.progress.kind -> { builder: fn(tag, setup) -> the setup a results-screen retry starts, label }
  nexts: new Map(),           // setup.progress.kind -> fn(tag) -> { label, build } of the next step, or null
  lastAward: null,            // what the last finished match paid (results screen)
  awardedMatch: null,
  look: { color: PROGRESS_NO_LOOK, finish: PROGRESS_NO_LOOK },   // the worn cosmetics as plain numbers (read every frame)
  // Filled by S18 (18j) at load, so this earlier section never calls the UI directly: the match outcome rule of the play
  // flow (PlayFlow.outcome) and the local player's per-weapon tallies and medals (LocalPlayerStats).
  links: { outcome: null, playerStats: null },
  outcome(results) { return results && this.links.outcome ? this.links.outcome(results) : 'over'; },
  tally() { return this.links.playerStats; },

  // ---- Save layout (ARC-020): fills every missing progress field of any older save ----
  emptyProfile() {
    return { version: PROGRESS_VERSION, xp: 0, matches: 0, medals: {}, unlocked: {}, cosmetics: { color: '', finish: '', title: '' }, rangeOffered: false,
      cards: { unlocked: {}, active: [], passive: [], marks: 0 }, challenges: {}, operations: {}, daily: {}, chambers: {} };
  },
  emptyStats() { return { version: PROGRESS_VERSION, weapons: {}, modes: {}, maps: {}, totals: { matches: 0, wins: 0, kills: 0, deaths: 0, seconds: 0 } }; },
  emptyLadder() { return { version: PROGRESS_VERSION, tier: 0, match: 0, done: false, cleared: {}, difficulty: {} }; },
  migrate(data) {
    data.progression = fillMissing(isPlainObject(data.progression) ? data.progression : {}, this.emptyProfile());
    data.stats = fillMissing(isPlainObject(data.stats) ? data.stats : {}, this.emptyStats());
    data.ladder = fillMissing(isPlainObject(data.ladder) ? data.ladder : {}, this.emptyLadder());
    data.progression.xp = Math.max(0, Number(data.progression.xp) || 0);
    data.progression.version = data.stats.version = data.ladder.version = PROGRESS_VERSION;
    return data;
  },
  // The live progress records; an older save (or one written before this section existed) migrates on first use.
  profile() { return this.ensure().progression; },
  stats() { return this.ensure().stats; },
  ladder() { return this.ensure().ladder; },
  ensure() {
    const data = Save.data;
    const current = isPlainObject(data.progression) && data.progression.version === PROGRESS_VERSION && isPlainObject(data.stats)
      && data.stats.version === PROGRESS_VERSION && isPlainObject(data.ladder) && data.ladder.version === PROGRESS_VERSION;
    return current ? data : this.migrate(data);
  },

  // ---- Levels (PRG-010) ----
  xpToNext(level) { return PROGRESS_LEVELS.base + PROGRESS_LEVELS.step * (level - 1); },
  xpForLevel(level) {
    let total = 0;
    for (let reached = 1; reached < level; reached++) total += this.xpToNext(reached);
    return total;
  },
  levelOf(xp) {
    let level = 1, remaining = xp;
    while (level < PROGRESS_LEVELS.max && remaining >= this.xpToNext(level)) { remaining -= this.xpToNext(level); level++; }
    return level;
  },
  level() { return this.levelOf(this.profile().xp); },
  levelProgress() {
    const level = this.level();
    if (level >= PROGRESS_LEVELS.max) return 1;
    return (this.profile().xp - this.xpForLevel(level)) / this.xpToNext(level);
  },
  addXp(amount) {
    const profile = this.profile();
    profile.xp += Math.max(0, Math.round(amount));
    Save.scheduleSave();
  },

  // ---- XP of one match: score, objectives, medals, finish / podium / win, minutes played, x the difficulty factor ----
  // results: Game.match.results; medalXp: the XP of the medals the player earned; difficulty: the match's (id or { preset }).
  // Returns a reused breakdown.
  matchXp(results, medalXp, difficulty) {
    const out = matchXpScratch, mine = this.playerResult(results);
    out.score = out.objective = out.medals = out.finish = out.podium = out.win = out.time = out.total = 0;
    if (this.xpReason(results)) return out;
    const minutes = results.duration / PROGRESS_SECONDS_PER_MINUTE, bonusShare = Math.min(1, minutes / PROGRESS_XP.bonusMinutes);
    const factor = PROGRESS_XP_DIFFICULTY[difficultyIdOf(difficulty)] || 1, weight = PROGRESS_XP_MODES[results.mode] || PROGRESS_XP_MODE_FULL;
    out.score = Math.max(0, mine.score) * PROGRESS_XP.perScore * weight.score * factor;
    out.objective = Math.max(0, mine.objective) * PROGRESS_XP.perObjective * weight.objective * factor;
    out.medals = medalXp * factor;
    out.finish = PROGRESS_XP.finish * bonusShare * factor;
    out.win = Progress.outcome(results) === 'win' ? PROGRESS_XP.win * bonusShare * factor : 0;
    out.podium = !out.win && this.onPodium(results) ? PROGRESS_XP.podium * bonusShare * factor : 0;
    out.time = Math.min(minutes, PROGRESS_XP.minutesCap) * PROGRESS_XP.perMinute * factor;
    out.total = Math.round(out.score + out.objective + out.medals + out.finish + out.win + out.podium + out.time);
    return out;
  },
  // Why a match pays no XP ('' when it pays): too short, spectated, or the player did not take part (no idle farming).
  xpReason(results) {
    const mine = this.playerResult(results);
    if (!mine) return 'No XP: you did not play this match.';
    if (results.duration < PROGRESS_XP.minimumSeconds) return 'No XP: matches under ' + PROGRESS_XP.minimumSeconds + ' s pay none.';
    return this.tookPart(mine) ? '' : 'No XP: you did not take part.';
  },
  // The one "took part" rule (XP, a side's win): score, objective points, a kill, an assist or damage dealt.
  tookPart(mine) { return mine.score > 0 || mine.objective > 0 || mine.kills > 0 || mine.assists > 0 || this.playerDamage() > 0; },
  // A win the player earns: their side won, and they took part or had no ally to win it for them (a solo level).
  creditedWin(results) {
    const mine = this.playerResult(results);
    if (!mine || Progress.outcome(results) !== 'win') return false;
    return this.tookPart(mine) || !results.players.some((player) => player.id !== mine.id && mine.team >= 0 && player.team === mine.team);
  },
  playerResult(results) {
    if (!results || Game.playerId < 0) return null;
    return results.players.find((player) => player.id === Game.playerId) || null;
  },
  // 1-based rank of the player in the results (team modes: 1 for the winning side), 0 when absent.
  placement(results) {
    if (!results) return 0;
    const index = results.players.findIndex((player) => player.id === Game.playerId);
    if (index < 0) return 0;
    if (results.teams.length) return Progress.outcome(results) === 'win' ? 1 : 2;
    return index + 1;
  },
  // A podium place (top LADDER_PODIUM) in a free-for-all larger than the podium: a duel or a 3-player match has none, so
  // its loser is never paid for a place; team modes have none either (only the win counts).
  onPodium(results) {
    if (!results || results.teams.length || results.players.length <= LADDER_PODIUM) return false;
    const place = this.placement(results);
    return place > 0 && place <= LADDER_PODIUM;
  },
  playerHeadshots() { return this.tallySum('headshots'); },
  playerAccuracy() {
    const hits = this.playerHits(), shots = this.tallySum('shots');
    return shots > 0 ? hits / shots : 0;
  },
  playerHits() { return this.tallySum('hits'); },
  playerDamage() { return this.tallySum('damage'); },
  tallySum(field) {
    const values = this.tally()[field];
    let total = 0;
    for (let index = 0; index < WEAPON_COUNT; index++) total += values[index];
    return total;
  },
  isHard(difficulty) {
    const row = CAT.difficulty.byId(difficultyIdOf(difficulty)), hard = CAT.difficulty.byId(CARD_HARD_DIFFICULTY);
    return !!row && CAT.difficulty.indexOf(row) >= CAT.difficulty.indexOf(hard);
  },
  // Points of a challenge / daily row: sum of weight x metric; `underPar` = seconds left of par (0 when slower or lost).
  points(weights, metrics, par) {
    let total = 0;
    for (const key in weights) {
      const value = key === 'underPar' ? (metrics.won ? Math.max(0, (par || 0) - metrics.seconds) : 0) : Number(metrics[key]) || 0;
      total += weights[key] * value;
    }
    return Math.max(0, Math.round(total));
  },

  // ---- Unlocks (PRG-010, PRG-011): by level (<= 30), weapon mastery tier or the card's own condition ----
  unlockAll() { return Settings.get('progress.unlockAll') === true; },
  isUnlocked(row) {
    if (!row) return false;
    if (this.unlockAll()) return true;
    if (row.card) return this.profile().cards.unlocked[row.card] === true;
    if (row.mastery) return this.masteryReached(row.mastery);
    return this.level() >= row.level;
  },
  unlocked(kind) { return CAT.unlocks.filter((row) => row.kind === kind && this.isUnlocked(row)); },
  // Highest challenge room group open (1 = from the start).
  roomGroup() {
    let group = 1;
    for (const row of this.unlocked('challenge')) group = Math.max(group, row.value);
    return group;
  },
  setCosmetic(kind, unlockId) {
    const row = unlockId ? CAT.unlocks.byId(unlockId) : null;
    if (unlockId && (!row || row.kind !== kind || !this.isUnlocked(row))) return false;
    this.profile().cosmetics[kind] = unlockId || '';
    Save.scheduleSave();
    this.refreshLook();
    return true;
  },
  cosmetic(kind) {
    const row = CAT.unlocks.byId(this.profile().cosmetics[kind]);
    return row && this.isUnlocked(row) ? row.value : null;
  },
  // Resolves the worn colour and finish once (cosmetic choice, Unlock everything, match start, a counted match), so the
  // renderer's per-frame style reads two numbers instead of walking the unlock rules.
  refreshLook() {
    const color = this.cosmetic('color'), finish = this.cosmetic('finish');
    this.look.color = color === null ? PROGRESS_NO_LOOK : color;
    this.look.finish = finish === null ? PROGRESS_NO_LOOK : finish;
  },
  // The colour an actor is shown in where no body is drawn (view model, scoreboard row, killcam figure): the worn body colour
  // for the local player, else `fallback`.
  bodyColor(id, fallback) { return id >= 0 && id === Game.playerId && this.look.color !== PROGRESS_NO_LOOK ? this.look.color : fallback; },
  title() { return this.cosmetic('title') || ''; },

  // ---- Statistics per weapon / mode / map (PRG-014) and weapon mastery ----
  weaponStats(key) { return this.stats().weapons[key] || null; },
  masteryOf(key) {
    const record = this.weaponStats(key);
    let reached = PROGRESS_NOT_REACHED;
    if (!record) return reached;
    const kills = Number(record.kills) || 0, headshots = Number(record.headshots) || 0;   // older saves may lack a counter
    for (let index = 0; index < MASTERY_TIERS.length; index++) {
      if (kills >= MASTERY_TIERS[index].kills && headshots >= MASTERY_TIERS[index].headshots) reached = index;
    }
    return reached;
  },
  masteryReached(tierId) {
    const wanted = masteryTierIndex(tierId);
    if (wanted < 0) return false;
    for (const key in this.stats().weapons) if (this.masteryOf(key) >= wanted) return true;
    return false;
  },
  recordStats(match) {
    const stats = this.stats(), results = match.results, mine = this.playerResult(results), won = Progress.outcome(results) === 'win' ? 1 : 0;
    const mode = statRecord(stats.modes, results.mode, MODE_STAT_FIELDS), map = statRecord(stats.maps, statMapKey(match.map), MAP_STAT_FIELDS);
    mode.played++; mode.wins += won; mode.kills += mine.kills; mode.deaths += mine.deaths; mode.bestScore = Math.max(mode.bestScore, mine.score);
    map.played++; map.wins += won;
    stats.totals.matches++; stats.totals.wins += won; stats.totals.kills += mine.kills; stats.totals.deaths += mine.deaths;
    stats.totals.seconds += Math.round(results.duration);
    for (let index = 0; index < WEAPON_COUNT; index++) this.recordWeapon(stats, index, this.tally());
  },
  recordWeapon(stats, index, tally) {
    if (!tally.shots[index] && !tally.kills[index]) return;
    const record = statRecord(stats.weapons, CAT.weapons[index].id, WEAPON_STAT_FIELDS);
    record.shots += tally.shots[index]; record.hits += tally.hits[index];
    record.kills += tally.kills[index]; record.headshots += tally.headshots[index];
  },

  // ---- End of a match: stats, medals, XP, the run handlers; idempotent per match (results screen and match.end both ask) ----
  addHandler(kind, handler) { this.handlers.set(kind, handler); },
  addFinisher(finisher) { this.finishers.push(finisher); },
  addPreFinisher(finisher) { this.preFinishers.push(finisher); },
  // `label` names a retry that does not replay the finished match (an operation moves on): the results screen shows it only when no next step does the same.
  addRetry(kind, builder, label) { this.retries.set(kind, { builder, label: label || '' }); },
  addNext(kind, finder) { this.nexts.set(kind, finder); },
  // The setup "Play again" starts for a tagged match (null when untagged): each structure rebuilds its own, so a ladder
  // match keeps its tier and difficulty, a daily keeps its date seed and an operation plays its current map.
  retrySetup(setup) {
    const tag = setup && setup.progress, retry = tag ? this.retries.get(tag.kind) : null;
    return retry ? retry.builder(tag, setup) : null;
  },
  // The results screen's replay button: Retry after a lost career match that replays itself, Play again otherwise; a retry that moves on
  // shows its own label only when there is no next step (else '' : the next step button already does it).
  replayLabel(setup, outcome) {
    const tag = setup && setup.progress, retry = tag ? this.retries.get(tag.kind) : null;
    if (retry && retry.label) return this.nextStep(setup) ? '' : retry.label;
    return retry && outcome === 'loss' ? 'Retry' : 'Play again';
  },
  // The next step of a career after the finished match, or null (lost, nothing left): { label, build() -> setup } (the results screen's primary button).
  nextStep(setup) {
    const tag = setup && setup.progress, finder = tag ? this.nexts.get(tag.kind) : null;
    return finder ? finder(tag) : null;
  },
  finishMatch(match) {
    if (!match || !match.results || this.awardedMatch === match) return this.awardedMatch === match ? this.lastAward : null;
    if (!this.playerResult(match.results)) return null;
    this.awardedMatch = match;
    for (const finisher of this.preFinishers) finisher(match);
    const profile = this.profile(), levelBefore = this.level(), unlockedBefore = this.unlockedIds();
    const metrics = RunLog.measure(match);
    const award = { xp: 0, levelBefore, levelAfter: levelBefore, lines: [], unlocks: [], breakdown: null, medals: [] };
    const medalXp = this.recordMedals(profile, award);
    award.breakdown = Object.assign({}, this.matchXp(match.results, medalXp, match.rules ? match.rules.difficulty : ''));
    award.xp = award.breakdown.total;
    const noXp = this.xpReason(match.results);
    if (noXp) award.lines.push(noXp);
    this.recordStats(match);
    const tag = match.setup.progress, handler = tag ? this.handlers.get(tag.kind) : null;
    if (handler) handler(match, metrics, award);
    for (const finisher of this.finishers) finisher(match, metrics, award);
    profile.matches++;
    this.addXp(award.xp);
    award.levelAfter = this.level();
    award.unlocks = this.unlockedIds().filter((id) => !unlockedBefore.includes(id)).map((id) => CAT.unlocks.byId(id).name);
    if (award.levelAfter > levelBefore) emitToast('Level ' + award.levelAfter + ' reached');
    this.lastAward = award;
    this.refreshLook();
    Save.scheduleSave();
    return award;
  },
  recordMedals(profile, award) {
    let xp = 0;
    for (const [id, count] of this.tally().medals) {
      const row = CAT.medals.byId(id);
      profile.medals[id] = (profile.medals[id] || 0) + count;
      if (row) { xp += row.xp * count; award.medals.push(row.name + (count > 1 ? ' x' + count : '')); }
    }
    return xp;
  },
  // ---- MP11 Test Chambers records (Save.data.progression.chambers['1'..'12'] = { medal, stars, seconds }) ----
  // A completed chamber ('pve.chamber' kind complete) keeps the best run: more stars, or as many stars in less time.
  recordChamber(event) {
    const old = this.chamberRecord(event.chamber);
    const seconds = Math.round(event.seconds * CHAMBER_SECONDS_STEP) / CHAMBER_SECONDS_STEP;
    const better = !old || event.stars > old.stars || (event.stars === old.stars && seconds < old.seconds);
    if (!better) return false;
    this.profile().chambers[String(event.chamber)] = { medal: event.medal, stars: event.stars, seconds };
    if (event.stars > 0) RunLog.chamberRecords++;
    Save.scheduleSave();
    return true;
  },
  // A malformed entry of an imported save (not a record with a medal name, a whole star count the medals allow and a time) is no
  // record and counts no stars, so the Solo screen and the stars total never read a bad field.
  chamberRecord(chamber) {
    const record = this.profile().chambers[String(chamber)];
    if (!isPlainObject(record) || typeof record.medal !== 'string' || !Number.isFinite(record.seconds) || record.seconds < 0) return null;
    return Number.isInteger(record.stars) && record.stars >= 0 && record.stars <= PVE_CHAMBER_RULES.medals.length ? record : null;
  },
  chamberStars() {
    let stars = 0;
    for (const key in this.profile().chambers) { const record = this.chamberRecord(key); if (record) stars += record.stars; }
    return stars;
  },
  unlockedIds() {
    const ids = [];
    for (const row of CAT.unlocks) if (this.isUnlocked(row)) ids.push(row.id);
    return ids;
  },
};
const matchXpScratch = { score: 0, objective: 0, medals: 0, finish: 0, podium: 0, win: 0, time: 0, total: 0 };
const MODE_STAT_FIELDS = { played: 0, wins: 0, kills: 0, deaths: 0, bestScore: 0 };
const MAP_STAT_FIELDS = { played: 0, wins: 0 };
const WEAPON_STAT_FIELDS = { shots: 0, hits: 0, kills: 0, headshots: 0 };
// Map statistics: a catalogue map by its id; generated and custom maps (a new id per seed or save) share one row each, so the list stays short.
const STAT_MAP_GROUP_NAMES = { generated: 'Generated maps', custom: 'Custom maps', none: 'No map' };
function statMapKey(map) {
  if (!map) return 'none';
  return CAT.maps.byId(map.id) ? map.id : map.gen ? 'generated' : 'custom';
}

// A match's difficulty as its preset id (rules.difficulty is an id or { preset, ... }).
function difficultyIdOf(difficulty) { return typeof difficulty === 'object' && difficulty ? difficulty.preset : difficulty; }
function masteryTierIndex(tierId) {
  for (let index = 0; index < MASTERY_TIERS.length; index++) if (MASTERY_TIERS[index].id === tierId) return index;
  return PROGRESS_NOT_REACHED;
}
// Copies every field of `defaults` that `target` lacks (one level into nested records); returns target.
function fillMissing(target, defaults) {
  for (const key in defaults) {
    const fallback = defaults[key];
    if (target[key] === undefined || (isPlainObject(fallback) && !isPlainObject(target[key]))) target[key] = fallback;
    else if (isPlainObject(fallback) && !Object.keys(fallback).length) continue;
    else if (isPlainObject(fallback)) fillMissing(target[key], fallback);
  }
  return target;
}
function statRecord(table, key, fields) {
  if (!isPlainObject(table[key])) table[key] = {};
  return fillMissing(table[key], Object.assign({}, fields));
}

// The chosen body colour and finish of the player (cosmetic only: drawn, never read by a rule).
Render.addActorStyle((id, out) => {
  if (id !== Game.playerId || id < 0) return;
  const color = Progress.look.color, finish = Progress.look.finish;
  if (color !== PROGRESS_NO_LOOK) { out.r = ((color >> 16) & 255) / 255; out.g = ((color >> 8) & 255) / 255; out.b = (color & 255) / 255; }
  if (finish !== PROGRESS_NO_LOOK) out.emissive = Math.max(out.emissive, finish);
});
// First person draws no body (07c), so the held weapon wears the body colour: the S11 view model hook, wrapped once at load.
const progressWeaponViewModel = Render.viewModel;
Render.viewModel = (out) => {
  if (progressWeaponViewModel) progressWeaponViewModel(out);
  out.color = Progress.bodyColor(Game.playerId, out.color);
  return out;
};

Bus.on('boot', () => { Progress.ensure(); Progress.refreshLook(); });
Bus.on('setting', (key) => { if (key === 'progress.unlockAll') Progress.refreshLook(); });
Bus.on('match.start', () => { RunLog.reset(); Progress.refreshLook(); });
Bus.on('kill', (event) => RunLog.onKill(event));
Bus.on('damage', (event) => RunLog.onDamage(event));
Bus.on('weapon.fire', (event) => RunLog.onFire(event));
Bus.on('pickup', (event) => RunLog.onPickup(event));
Bus.on('explosion', (event) => RunLog.onExplosion(event));
Bus.on('souls', (event) => { if (RunLog.isPlayer(event.id)) RunLog.souls++; });
// A34 Wrath Form (S12 ability events) counts the Wrath Form metrics (C12 Encore, C19 Discord unlocks).
Bus.on('ability.cast', (event) => { if (event.ability === SOUL_ULTIMATE) RunLog.setWrath(event.id, true); });
Bus.on('ability.end', (event) => { if (event.ability === SOUL_ULTIMATE) RunLog.setWrath(event.id, false); });
// PvE reports (S14 PvE, docs/api/progression.md): boss fight times (kind 'defeated') and chamber records.
Bus.on('pve.boss', (event) => {
  if (event.kind !== 'defeated') return;   // phase, weak and start reports carry no boss time
  RunLog.bossSeconds = Math.min(RunLog.bossSeconds, event.seconds);
  if (event.final) RunLog.finalBossSeconds = Math.min(RunLog.finalBossSeconds, event.seconds);
});
Bus.on('pve.chamber', (event) => { if (event.kind === 'complete') Progress.recordChamber(event); });
// The results lines of a chamber run: new records and the star total kept in the profile.
Progress.addFinisher((match, metrics, award) => {
  if (RunLog.chamberRecords > 0) award.lines.push('Chamber records: ' + RunLog.chamberRecords + ' (stars kept: ' + Progress.chamberStars() + ')');
});
Bus.on('match.end', (match) => Progress.finishMatch(match));
