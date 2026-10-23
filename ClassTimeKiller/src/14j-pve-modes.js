// ==== S14 PVE: MODES ====
// The PvE mode behaviours (Modes.register): M21 Siege Waves, M22 Endless Hold, M23 Mote Rush, M26 Ravager vs Fiends,
// M28 Silent Contract (stealth, MP12), M29 Attrition, M30 Firing Range and the MP11 Test Chambers (puzzle). Enemies come from
// the director (14h) and the rows (03o). Difficulty (rules.botSkill): lives (0 = unlimited), checkpoints and checkpointHeal
// (wave retries, DIF-004 Guardian Plate), gameSpeed (rules.fx.timeScale, written by the 14a difficulty stage before the
// ruleset freezes). Co-op results: winner = the player (or the first participant) on a win,
// PVE_LOST with reason 'defeat' on a loss. The HUD reads Modes.hud.pve (PVE_HUD fields, docs/api/pve.md).

const PVE_WIN = 'victory', PVE_LOSE = 'defeat';
const PVE_LOST = -3;                   // co-op loss winner: neither a winner nor DRAW, so the results read as a loss for every participant
const PVE_WAVE_STATE = { SHOP: 'shop', FIGHT: 'fight', EXTRACT: 'extract', DONE: 'done' };
const PVE_MAX_PICKS = 200;             // a wave budget is spent in at most this many picks
const PVE_FIENDS_TEAM = 1, PVE_RAVAGER_TEAM = 0;
const PVE_STATION_FALLBACK = [[0, 10], [4, 15], [-4, 20]];   // range stations in front of the spawn when the map has no 'dummy' hints
const PVE_CORE_ALARM_SECONDS = 5;      // modes-03: the bots defend the core this long after its last blow
const PVE_CORE_DEFEND = Object.freeze(['defend', 'defend']);   // the core objective's bot goal hints while it is under attack

// The HUD block's values at a match start (banked and boss are kept objects, reset in place).
const PVE_HUD_DEFAULTS = Object.freeze({
  active: false, mode: '', state: '', stateTimeLeft: 0, wave: 0, waves: 0, enemiesLeft: 0, retriesLeft: 0,
  guardian: false, guardianOffer: false, guardianAccepted: false, coreHealth: 0, coreMax: 0, coreShield: 0, carried: 0, alarms: 0, awareness: 0, relic: false, score: 0,
  chamber: 0, chambers: 0, chamberTime: 0, steps: 0, portals: 0, parTime: null, hint: '', solved: false, medal: '', stars: 0,
  shots: 0, hits: 0, headshots: 0, damage: 0, kills: 0, accuracy: 0, drillKills: 0, drillTargets: 0, drillBest: 0, drills: 0, parryAt: -1e9,
});
const PVE_HUD = Object.assign({
  banked: [0, 0],
  boss: null,               // PveBoss.hud (set by 14k)
}, PVE_HUD_DEFAULTS);
const pveSpot = { x: 0, y: 0, z: 0 };
const pveObjectiveList = [];
const pveHunted = [];   // the last enemies of a wave (ids), shown to the player as markers (17d)

// ---- Shared helpers ----
function pveSkill() { return Pve.skill(); }
function resetPveHud() {
  Object.assign(PVE_HUD, PVE_HUD_DEFAULTS);
  PVE_HUD.banked[0] = PVE_HUD.banked[1] = 0;
}
// Every PvE start: the machinery on, the HUD block (game speed is already in the ruleset); settings.lives: the difficulty's lives
// (only the co-op modes that handle a wipe take them: the practice and team modes would strand a fallen player).
function pveStart(options) {
  const settings = options || {};
  Pve.active = true;
  Pve.stealth = !!settings.stealth;
  PVE_HUD.active = true;
  PVE_HUD.mode = Modes.mode.id;
  if (settings.lives) applyDifficultyLives();
  PveLevel.begin(World.map);
  if (settings.coop) takeEnemySpawns();
}
function applyDifficultyLives() {
  const lives = pveSkill().lives > 0 ? pveSkill().lives : LIVES_UNLIMITED;
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) Modes.lives[id] = lives;
}
// Co-op maps mark enemy gates with team-1 spawns: those feed the director, players never spawn there.
function takeEnemySpawns() {
  const points = Modes.spawnPoints;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].team < 1) continue;
    Pve.spawnPoints.push({ x: points[i].x, y: points[i].y, z: points[i].z, yaw: points[i].yaw, side: NO_TEAM });
    points.splice(i, 1);
  }
}
function copyTeamSpawns(team, side) {
  for (const point of Modes.spawnPoints) if (point.team === team) Pve.spawnPoints.push({ x: point.x, y: point.y, z: point.z, yaw: point.yaw, side });
}
function teamSpawnCentre(team, out) {
  let count = 0;
  out.x = 0; out.y = 0; out.z = 0;
  for (const point of Modes.spawnPoints) {
    if (point.team !== team) continue;
    out.x += point.x; out.y += point.y; out.z += point.z; count++;
  }
  if (count > 0) { out.x /= count; out.y /= count; out.z /= count; } else centralSpot(out);
  return out;
}
// Map objectives of a kind that serve the running mode (for modes whose row has no objective kind of its own).
function addMapObjectives(kind, out) {
  out.length = 0;
  const sources = World.map && World.map.objectives ? World.map.objectives : [];
  for (const source of sources) if (source.kind === kind && mapServesMode(source, Modes.mode.id)) out.push(Modes.addObjective(source));
  return out;
}
function coopWinner() {
  if (Game.playerId >= 0 && Modes.participant[Game.playerId]) return Game.playerId;
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) return id;
  return DRAW;
}
// No participant (of the team, or at all for team < 0) alive or with a life left.
function teamWiped(team) {
  for (let id = 0; id < Actors.count; id++) if (Modes.participantStanding(id) && (team < 0 || Actors.team[id] === team)) return false;
  return true;
}
// Checkpoint: the fallen stand up again; everybody is healed to at least checkpointHeal of their health.
function reviveParticipants(heal) {
  for (let id = 0; id < Actors.count; id++) {
    if (!Modes.isActive(id)) continue;
    if (Modes.lives[id] === 0) Modes.lives[id] = 1;
    if (!Actors.alive[id]) Modes.spawnActor(id);
    Actors.health[id] = Math.max(Actors.health[id], Actors.maxHealth[id] * heal);
  }
}
// NPC-008 budget: wave points x difficulty aggression x players (4 is the baseline party).
function scaledBudget(budget) {
  const director = PVE_DIRECTOR, players = Modes.countActive();
  const byPlayers = Math.max(0.5, 1 + director.budgetPerExtraPlayer * (players - director.playersBaseline));
  return budget * (director.budgetScaleBase + director.budgetScaleAggression * pveSkill().aggression) * byPlayers;
}
// Spends the budget on weighted picks of `weights` (enemy key -> weight); gated: a row joins from its endlessFrom wave on.
// Heavies may be champions from PVE_CHAMPION_RULES.fromWave on.
function enqueueBudget(budget, weights, side, scale, wave, gated) {
  let left = budget, total = 0;
  for (const key in weights) total += weightOf(weights, key, wave, gated);
  for (let pick = 0; pick < PVE_MAX_PICKS && left > 0 && total > 0; pick++) {
    const key = pickWeighted(weights, total, wave, gated), row = CAT.enemies.byId(key);
    left -= Math.max(0.5, row.cost);
    Pve.enqueue(key, side, scale, championFor(row, wave), wave);
  }
}
function weightOf(weights, key, wave, gated) { return gated && CAT.enemies.byId(key).endlessFrom > wave ? 0 : weights[key]; }
function pickWeighted(weights, total, wave, gated) {
  let roll = Rng.pve.next() * total, last = '';
  for (const key in weights) {
    const weight = weightOf(weights, key, wave, gated);
    if (weight <= 0) continue;
    last = key;
    roll -= weight;
    if (roll <= 0) return key;
  }
  return last;
}
function championFor(row, wave) {
  const rules = PVE_CHAMPION_RULES;
  if (!row.heavy || wave < rules.fromWave || Rng.pve.next() >= rules.chance) return -1;
  return Rng.pve.int(0, PVE_CHAMPIONS.length - 1);
}
function championIndex(key) { return key ? PVE_CHAMPIONS.findIndex((row) => row.id === key) : -1; }
// Queues picks of `keys` (of heavyKeys by heavyChance) for a side until its living plus queued enemies reach `wanted`
// (swarm rows count every member).
function topUpSide(side, wanted, keys, heavyKeys, heavyChance) {
  let have = Pve.hostileCount(side) + Pve.pending(side);
  for (let guard = 0; guard < wanted && have < wanted; guard++) {
    const key = Rng.pve.pick(heavyKeys && Rng.pve.next() < heavyChance ? heavyKeys : keys);
    if (!Pve.enqueue(key, side, 1, -1, 1)) return;
    have += CAT.enemies.byId(key).group;
  }
}
function enemiesLeft() { return Pve.hostileCount() + Pve.pending(); }
function updateCoreHud() {
  PVE_HUD.coreHealth = Pve.core.health; PVE_HUD.coreMax = Pve.core.max; PVE_HUD.coreShield = Pve.core.shield;
}
function updatePlayerHud() {
  const id = Game.playerId;
  PVE_HUD.score = id >= 0 ? Modes.score[id] : 0;
}

// ---- M21 Siege Waves / M22 Endless Hold: waves at a core, shop between waves ----
// plan: { waves (count, Infinity for endless), enqueue(wave), cleared(wave) -> 'next' | 'win' | 'extract' }
function makeWaveBehaviour(plan) {
  return {
    start() {
      pveStart({ coop: true, lives: true });
      const run = this.run = { wave: 0, state: PVE_WAVE_STATE.SHOP, endsAt: Sim.time + PVE_WAVE_RULES.firstWaveDelay, retriesLeft: 0, coreAtWave: 0,
        flawless: true, result: NOT_OVER, core: null, extract: null, deaths: 0, plateOffered: false, plateUsed: false, plateRefused: false, huntAt: 0 };
      const params = Modes.rules.params;
      run.retriesLeft = pveSkill().checkpoints ? params.retries || 0 : 0;
      const cores = addMapObjectives('core', pveObjectiveList);
      run.core = cores.length ? cores[0] : null;
      const spot = run.core || centralSpot(pveSpot);
      Pve.setCore(spot.x, spot.y, spot.z, params.coreHealth);
      const extracts = addMapObjectives('extract', pveObjectiveList);
      run.extract = extracts.length ? extracts[0] : null;
      Pve.objectiveFor = coreObjective;
      Economy.ensureMatch();   // it resets the shop at match.start, after this start: open it after that reset
      Economy.setShopOpen(true);
      PVE_HUD.waves = plan.waves === Infinity ? 0 : plan.waves;
    },
    step(dt, now) {
      const run = this.run;
      if (run.result !== NOT_OVER) return;
      if (run.state === PVE_WAVE_STATE.FIGHT) this.fight(run, now);
      else if (run.state === PVE_WAVE_STATE.EXTRACT) this.extracting(run, now);
      else if (now + TIME_EPSILON >= run.endsAt) this.beginWave(run, now);
      callCoreDefence(run, now);
      this.updateHud(run, now);
    },
    beginWave(run, now) {
      run.wave++;
      run.state = PVE_WAVE_STATE.FIGHT;
      run.flawless = true;
      run.coreAtWave = Pve.core.health;
      Economy.setShopOpen(false);
      Pve.beginEncounter();
      plan.enqueue(run.wave);
      Modes.announce('Wave ' + run.wave, 'wave', 2);
      Bus.emit('pve.wave', waveEvent(run.wave, 'start'));
    },
    fight(run, now) {
      if (Pve.core.health <= 0 || teamWiped(NO_TEAM)) { this.failWave(run, now); return; }
      const left = enemiesLeft();
      const hunting = left > 0 && left <= PVE_WAVE_RULES.huntLeft && Pve.pending() === 0;
      if (hunting) huntLastEnemies(run, now); else pveHunted.length = 0;
      if (left > 0) return;
      for (let id = 0; id < Actors.count; id++) if (Modes.isActive(id)) Modes.awardPlayer(id, 1, 'wave');
      Bus.emit('pve.wave', waveEvent(run.wave, 'end'));
      endEncounter(run);
      const next = plan.cleared(run.wave);
      if (next === 'win') { run.result = Modes.over(coopWinner(), PVE_WIN); return; }
      Economy.awardWave(0, run.flawless);
      reviveParticipants(pveSkill().checkpointHeal);
      if (next === 'extract' && run.extract) { run.state = PVE_WAVE_STATE.EXTRACT; run.endsAt = now + PVE_ENDLESS.extractSeconds; Modes.announce('Extraction open', 'wave', 2); return; }
      this.openShop(run, now);
    },
    openShop(run, now) {
      run.state = PVE_WAVE_STATE.SHOP;
      run.endsAt = now + PVE_WAVE_RULES.shopSeconds;
      Economy.setShopOpen(true);   // bots shop in it too (14f BotEconomy)
    },
    // Endless: a player standing in the extract zone while it is open ends the run as a win (bots-02: pushing on is the
    // player's choice, so a bot walking in counts only while no player stands).
    extracting(run, now) {
      if (extractor(run.extract) >= 0) { run.result = Modes.over(coopWinner(), 'extracted'); return; }
      if (now + TIME_EPSILON >= run.endsAt) this.openShop(run, now);
    },
    // A lost wave: retry from its start (checkpoint) while retries are left, else the run is lost. DIF-004: after 3
    // participant deaths in the wave the Guardian Plate (damage taken x0.5 for the retry) is offered once; it is a retry
    // of its own when checkpoints are on.
    failWave(run, now) {
      const plate = guardianOpen(run) && pveSkill().checkpoints;
      if (run.retriesLeft <= 0 && !plate) { run.result = Modes.over(PVE_LOST, PVE_LOSE); return; }
      if (plate) wearGuardianPlate(run); else run.retriesLeft--;
      Pve.clearEnemies();
      Pve.core.health = Math.max(run.coreAtWave, 1);
      reviveParticipants(pveSkill().checkpointHeal);
      run.wave--;
      Modes.announce('Checkpoint: wave ' + (run.wave + 1) + ' again', 'wave', 3);
      this.openShop(run, now);
    },
    onKill(victim) {
      if (!(victim >= 0) || !Modes.participant[victim]) return;
      const run = this.run;
      run.flawless = false;
      run.deaths++;
      if (run.deaths < PVE_DIRECTOR.guardianDeaths || run.plateOffered || run.plateUsed) return;
      run.plateOffered = true;
      Modes.announce('Guardian Plate ready for a retry', 'wave', 2);
    },
    isOver() { return this.run ? this.run.result : NOT_OVER; },
    score(index) { return Modes.score[index]; },
    finalBoss() { return plan.waves !== Infinity && this.run.wave >= plan.waves; },   // the last wave's boss ends the level
    updateHud(run, now) {
      PVE_HUD.wave = run.wave; PVE_HUD.state = run.state; PVE_HUD.stateTimeLeft = Math.max(0, run.endsAt - now);
      PVE_HUD.enemiesLeft = enemiesLeft(); PVE_HUD.retriesLeft = run.retriesLeft;
      PVE_HUD.guardianOffer = guardianOpen(run); PVE_HUD.guardian = guardianWorn();
      updateCoreHud();
      updatePlayerHud();
    },
  };
}
// modes-03: while enemies hit the core in a fight, its objective asks every bot to defend it (BOT_OBJECTIVE_VERBS 'defend'
// outranks camping, so no bot holds a far spot while the core falls); otherwise the bots play as they like.
function callCoreDefence(run, now) {
  if (!run.core) return;
  const attacked = run.state === PVE_WAVE_STATE.FIGHT && now - Pve.core.hitAt < PVE_CORE_ALARM_SECONDS;
  run.core.goals = attacked ? PVE_CORE_DEFEND : null;
}
// Who takes the team out through the zone: a standing player inside it; a bot inside it only while no player stands (a
// bots-only run, or every player down). -1 = nobody.
function extractor(zone) {
  let bot = -1, playerStands = false;
  for (let id = 0; id < Actors.count; id++) {
    if (!Modes.isActive(id) || !Modes.actsOnObjectives(id)) continue;
    const player = Actors.kind[id] === ACTOR_KIND.PLAYER, inside = withinTouch(id, zone.x, zone.y, zone.z, zone.radius);
    if (player && inside) return id;
    if (player) playerStands = true;
    else if (inside) bot = id;
  }
  return playerStands ? -1 : bot;
}
// DIF-004: the plate halves enemy damage to every participant until the retried wave is cleared.
function wearGuardianPlate(run) {
  run.plateUsed = true;
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) Pve.guardian[id] = 1;
  Modes.announce('Guardian Plate: damage taken halved', 'wave', 3);
}
// The offer stands (not worn yet, not refused this wave); with no answer from the player the plate is worn at the retry.
function guardianOpen(run) { return run.plateOffered && !run.plateUsed && !run.plateRefused; }
// DIF-004 choice (18o pause row): accept wears it at the next checkpoint retry, refuse drops the offer for the rest of the
// wave (a later wave offers it again while it was never worn). False when no wave mode offers it now.
Pve.answerGuardian = (accept) => {
  const run = Pve.active && Modes.behaviour ? Modes.behaviour.run : null;
  if (!run || !guardianOpen(run)) return false;
  if (accept) PVE_HUD.guardianAccepted = true; else run.plateRefused = true;
  PVE_HUD.guardianOffer = guardianOpen(run);
  return true;
};
function guardianWorn() {
  for (let id = 0; id < Actors.count; id++) if (Pve.guardian[id]) return true;
  return false;
}
// A cleared wave ends the encounter: its death count, an unused offer, its answer and the plate go.
function endEncounter(run) {
  run.deaths = 0;
  run.plateOffered = run.plateRefused = false;
  PVE_HUD.guardianAccepted = false;
  Pve.guardian.fill(0);
}
// NPC-007: the last few enemies of a wave (nothing queued) are marked for the player every tick (pveHunted, 17d) and pinged to
// the co-op bots every few seconds, so both hunt them instead of waiting for them. A ping is memory, not sight (BotSense.share):
// no shots through walls. Each ping also frees an enemy stuck inside a wall (bots-01: out of reach, it kept the wave from clearing).
function huntLastEnemies(run, now) {
  const ping = now >= run.huntAt;
  if (ping) run.huntAt = now + PVE_WAVE_RULES.huntPingSeconds;
  pveHunted.length = 0;
  for (let enemy = 0; enemy < Actors.count; enemy++) {
    if (!Pve.isHostile(enemy)) continue;
    pveHunted.push(enemy);
    if (!ping) continue;
    Pve.unstick(enemy);
    pingToBots(enemy, now);
  }
}
function pingToBots(enemy, now) {
  for (let bot = 0; bot < Actors.count; bot++) {
    if (Bots.isBot(bot) && Modes.participant[bot]) BotSense.share(bot, enemy, Actors.x[enemy], Actors.y[enemy], Actors.z[enemy], now);
  }
}
// 'pve.wave' { wave, phase: 'start' | 'end' } ('end' = cleared; a lost wave that restarts from its checkpoint sends no 'end').
const waveEventPayload = { wave: 0, phase: '' };
function waveEvent(wave, phase) { waveEventPayload.wave = wave; waveEventPayload.phase = phase; return waveEventPayload; }
// Co-op enemies with nothing else to do march on the core.
function coreObjective(id, out) {
  if (!Pve.core.active || Pve.core.health <= 0) return false;
  out.x = Pve.core.x; out.y = Pve.core.y; out.z = Pve.core.z;
  return true;
}

const HORDE_PLAN = {
  waves: PVE_HORDE_WAVES.length,
  enqueue(wave) {
    const row = PVE_HORDE_WAVES[wave - 1];
    enqueueBudget(scaledBudget(row.budget), row.mix, NO_TEAM, 1, wave, false);
    for (const extra of row.extra || []) Pve.enqueue(extra.enemy, NO_TEAM, 1, championIndex(extra.champion), wave);
  },
  cleared(wave) { return wave >= PVE_HORDE_WAVES.length ? 'win' : 'next'; },
};
// Endless: budget grows per wave, health and damage x (1 + scalePerWave x (wave - 1)) up to scaleCap; a boss every bossEvery waves.
const ENDLESS_PLAN = {
  waves: Infinity,
  enqueue(wave) {
    const params = Modes.rules.params, scale = Math.min(params.scaleCap, 1 + params.scalePerWave * (wave - 1));
    enqueueBudget(scaledBudget(PVE_ENDLESS.baseBudget + PVE_ENDLESS.budgetPerWave * (wave - 1)), PVE_ENDLESS.weights, NO_TEAM, scale, wave, true);
    if (wave % PVE_ENDLESS.bossEvery === 0) Pve.enqueue(PVE_ENDLESS.boss, NO_TEAM, scale, championIndex('unstoppable'), wave);
  },
  cleared(wave) { return wave % Modes.rules.params.extractEvery === 0 ? 'extract' : 'next'; },
};
Modes.register('horde', makeWaveBehaviour(HORDE_PLAN));
Modes.register('endless', makeWaveBehaviour(ENDLESS_PLAN));

// ECP07 wave shop item 'coreShield' (buy kind 'grant', delivered through S12's grant effects): shields the core.
Items.grantEffects.coreShield = () => {
  if (!Pve.core.active || Pve.core.health <= 0) return false;
  Pve.core.shield += PVE_WAVE_RULES.coreShield;
  return true;
};
// W30 beam (FireMode.repair) on the core repairs it, as S12 Devices.onShot repairs a friendly device.
const CORE_HIT_LIFT = 1;   // the core's hit sphere sits this far above its spot (where enemy attacks aim)
function repairCore(event) {
  const core = Pve.core, mode = gadgetShotMode(event), repair = repairPerShot(mode);
  if (!(repair > 0) || !core.active || core.health <= 0 || Actors.kind[event.id] === ACTOR_KIND.ENEMY) return;
  const distance = raySphere(event.x, event.y, event.z, event.dx, event.dy, event.dz, core.x, core.y + CORE_HIT_LIFT, core.z, PVE_WAVE_RULES.coreRadius);
  if (distance < 0 || distance > Devices.shotReach(event, mode.range)) return;
  core.health = Math.min(core.max, core.health + repair);
}
Bus.on('weapon.fire', repairCore);
// A parry of the local player's: the HUD flashes PARRIED (17g).
Bus.on('pve.parry', (event) => { if (event.target === Game.playerId) PVE_HUD.parryAt = Sim.time; });

// ---- M23 Mote Rush: each team fights its own PvE side, banks motes, sends blockers, then kills its boss first ----
const BankRun = {
  carried: new Int16Array(MAX_ACTORS), banked: [0, 0], invasions: [0, 0], boss: [-1, -1], banks: [null, null], result: NOT_OVER, nextFillAt: 0,
  reset() {
    this.carried.fill(0); this.banked[0] = this.banked[1] = 0; this.invasions[0] = this.invasions[1] = 0;
    this.boss[0] = this.boss[1] = -1; this.banks[0] = this.banks[1] = null; this.result = NOT_OVER; this.nextFillAt = 0;
  },
};
Modes.register('bank', {
  start() {
    pveStart();
    BankRun.reset();
    Pve.sideTeam = () => NO_TEAM;          // the PvE of a side is hostile to all, but hunts only its own team
    Pve.sideHunt = (side) => side;
    for (let team = 0; team < TEAM_COUNT; team++) {
      copyTeamSpawns(team, team);
      BankRun.banks[team] = this.bankOf(team);
    }
  },
  bankOf(team) {
    for (const objective of Modes.objectives) if (objective.kind === 'bank' && objective.team === team) return objective;
    teamSpawnCentre(team, pveSpot);
    return Modes.addObjective({ id: 'bank' + team, kind: 'bank', team, x: pveSpot.x, y: pveSpot.y, z: pveSpot.z, radius: PVE_BANK.bankRadius });
  },
  step(dt, now) {
    const refill = now + TIME_EPSILON >= BankRun.nextFillAt;
    if (refill) BankRun.nextFillAt = now + PVE_BANK.fillSeconds;
    for (let team = 0; team < TEAM_COUNT; team++) {
      if (refill) topUpSide(team, PVE_BANK.fodderAlive, PVE_BANK.fodder, null, 0);
      this.deposits(team);
    }
    for (let team = 0; team < TEAM_COUNT; team++) if (BankRun.banked[team] >= Modes.rules.params.bossAt) this.summonBoss(team);   // retried until it spawns (no spawn point or actor slot)
    const id = Game.playerId;
    PVE_HUD.carried = id >= 0 ? BankRun.carried[id] : 0;
    PVE_HUD.banked[0] = BankRun.banked[0]; PVE_HUD.banked[1] = BankRun.banked[1];
    PVE_HUD.enemiesLeft = Pve.hostileCount();
    updatePlayerHud();
  },
  deposits(team) {
    const bank = BankRun.banks[team];
    for (let id = 0; id < Actors.count; id++) {
      if (!Modes.isActive(id) || !Actors.alive[id] || Actors.team[id] !== team || BankRun.carried[id] <= 0) continue;
      if (withinTouch(id, bank.x, bank.y, bank.z, bank.radius)) this.bankMotes(id, team);
    }
  },
  bankMotes(id, team) {
    const amount = BankRun.carried[id], before = BankRun.banked[team];
    BankRun.carried[id] = 0;
    BankRun.banked[team] += amount;
    Modes.teamScore[team] = BankRun.banked[team];
    Modes.awardPlayer(id, amount, 'bank');
    const params = Modes.rules.params;
    this.sendBlocker(team, amount, params.blockerAt);
    if (Math.floor(BankRun.banked[team] / params.invasionAt) > Math.floor(before / params.invasionAt)) this.invade(team);
  },
  // The biggest deposit size (mode params.blockerAt) the deposit reaches picks the blocker sent to the other side.
  sendBlocker(team, amount, sizes) {
    for (let tier = Math.min(sizes.length, PVE_BANK.blockers.length) - 1; tier >= 0; tier--) {
      if (amount < sizes[tier]) continue;
      Pve.enqueue(PVE_BANK.blockers[tier], 1 - team, 1, -1, 1);
      return;
    }
  },
  // Invasion: a barrier-champion charger crosses into the other side's arena.
  invade(team) {
    BankRun.invasions[team]++;
    Pve.enqueue(PVE_BANK.invader, 1 - team, 1, championIndex(PVE_BANK.invaderChampion), 1);
    Modes.announce(TEAM_NAMES[team] + ' invades', 'objective', 2);
  },
  summonBoss(team) {
    if (BankRun.boss[team] >= 0 || !Pve.pickSpawn(team, pveSpot)) return;
    const id = Pve.spawnEnemy(PVE_BANK.boss, pveSpot.x, pveSpot.y, pveSpot.z, pveSpot.yaw, { team: NO_TEAM, side: team, huntTeam: team, overCap: true });
    if (id < 0) return;
    setVitality(id, Actors.maxHealth[id] * PVE_BANK.bossHealthShare);
    BankRun.boss[team] = id;
    Modes.announce(TEAM_NAMES[team] + ' summoned the Overlord', 'objective', 3);
  },
  onKill(victim, killer) {
    if (victim >= 0 && Modes.participant[victim]) { BankRun.carried[victim] = 0; return; }
    const side = Pve.isEnemy(victim) ? Pve.side[victim] : NO_TEAM;
    if (side < 0) return;
    if (victim === BankRun.boss[side]) {   // only the boss's own side wins with it; a foreign kill sends it back for the next step
      if (killer >= 0 && Modes.participant[killer] && Actors.team[killer] === side) BankRun.result = Modes.over(side, 'objective'); else BankRun.boss[side] = -1;
      return;
    }
    if (killer < 0 || !Modes.participant[killer] || Actors.team[killer] !== side) return;
    const row = Pve.rowOf(victim), motes = row.heavy || row.leader ? PVE_BANK.motesHeavy : PVE_BANK.motesFodder;
    BankRun.carried[killer] = Math.min(PVE_BANK.carryMax, BankRun.carried[killer] + motes);
  },
  isOver() { return BankRun.result; },
  score(index) { return BankRun.banked[index]; },
  finalBoss(id) { return id === BankRun.boss[0] || id === BankRun.boss[1]; },   // either side's boss; only a kill by the boss's own side wins (onKill)
});

// ---- M26 Ravager vs Fiends: one ravager (team 0) against fiends (team 1) who summon fodder and revive each other ----
const FiendRun = { reviveAt: new Float64Array(MAX_ACTORS).fill(Infinity), nextSummonAt: new Float64Array(MAX_ACTORS) };
// The bots' bank goal (S14 planner registry): carrying botBankAt motes or more, go to the team's bank; a full load is as
// urgent as an objective gets.
BotDecide.registerPlanner('bank', (id, plan) => {
  const carried = BankRun.carried[id], bank = Actors.team[id] >= 0 ? BankRun.banks[Actors.team[id]] : null;
  if (!bank || carried < PVE_BANK.botBankAt) return false;
  return planTarget(plan, bank, carried / PVE_BANK.carryMax, bank.radius * 0.5, ACTION.MOVE);
});

Modes.register('fiends', {
  start() {
    pveStart();
    const ravager = coopWinner();
    for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) Actors.team[id] = id === ravager ? PVE_RAVAGER_TEAM : PVE_FIENDS_TEAM;
    FiendRun.reviveAt.fill(Infinity);
    Pve.sideTeam = () => PVE_FIENDS_TEAM;
    Pve.sideHunt = () => PVE_RAVAGER_TEAM;
  },
  onSpawn(id) {
    if (!Modes.participant[id]) return;
    FiendRun.reviveAt[id] = Infinity;
    FiendRun.nextSummonAt[id] = Sim.time + PVE_FIENDS.summonEvery;
    if (Actors.team[id] !== PVE_RAVAGER_TEAM) return;
    const params = Modes.rules.params;
    setVitality(id, params.ravagerHealth);
    Actors.armor[id] = Actors.maxArmor[id] = params.ravagerArmor;
  },
  onRound(phase) {
    if (phase === 'start') Pve.clearEnemies();
    return phase === 'timeout' ? Modes.aliveLeaderTeam() : DRAW;
  },
  step(dt, now) {
    for (let id = 0; id < Actors.count; id++) {
      if (!Modes.isActive(id) || Actors.team[id] !== PVE_FIENDS_TEAM) continue;
      if (Actors.alive[id]) this.summon(id, now);
      else if (now + TIME_EPSILON >= FiendRun.reviveAt[id] && Modes.teamAliveCount(PVE_FIENDS_TEAM) > 0) Modes.spawnActor(id);
    }
    Modes.checkTeamWipe();
    PVE_HUD.enemiesLeft = Pve.hostileCount();
    updatePlayerHud();
  },
  summon(id, now) {
    if (now + TIME_EPSILON < FiendRun.nextSummonAt[id]) return;
    FiendRun.nextSummonAt[id] = now + PVE_FIENDS.summonEvery;
    if (countSummons(id) >= PVE_FIENDS.summonAlive) return;
    const key = Rng.pve.pick(PVE_FIENDS.summon), yaw = Actors.yaw[id];
    Pve.spawnEnemy(key, Actors.x[id] + Math.sin(yaw) * 2, Actors.y[id], Actors.z[id] + Math.cos(yaw) * 2, yaw,
      { team: PVE_FIENDS_TEAM, side: PVE_FIENDS_TEAM, huntTeam: PVE_RAVAGER_TEAM, summoner: id });
  },
  // A fallen fiend stands up again after reviveTime while a teammate lives (the round ends when both are down).
  onKill(victim) {
    if (victim >= 0 && Modes.participant[victim] && Actors.team[victim] === PVE_FIENDS_TEAM) FiendRun.reviveAt[victim] = Sim.time + Modes.rules.params.reviveTime;
  },
});

// ---- M29 Attrition: AI minions on both teams; points for fodder 1, heavies 3, players and bots 5 ----
const AttritionRun = { bases: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], nextFillAt: 0 };
Modes.register('attrition', {
  start() {
    pveStart();
    Pve.sideTeam = (side) => side;
    Pve.sideHunt = () => NO_TEAM;
    for (let team = 0; team < TEAM_COUNT; team++) { copyTeamSpawns(team, team); teamSpawnCentre(team, AttritionRun.bases[team]); }
    AttritionRun.nextFillAt = 0;
    Pve.objectiveFor = (id, out) => {
      const base = AttritionRun.bases[1 - Pve.side[id]];
      if (!base) return false;
      out.x = base.x; out.y = base.y; out.z = base.z;
      return true;
    };
  },
  step(dt, now) {
    if (now >= AttritionRun.nextFillAt) {
      AttritionRun.nextFillAt = now + PVE_ATTRITION.respawnSeconds;
      for (let team = 0; team < TEAM_COUNT; team++) this.fill(team);
    }
    PVE_HUD.enemiesLeft = Pve.hostileCount();
    updatePlayerHud();
  },
  fill(team) { topUpSide(team, PVE_ATTRITION.minionsPerTeam, PVE_ATTRITION.fodder, PVE_ATTRITION.heavy, PVE_ATTRITION.heavyChance); },
  onKill(victim, killer) {
    if (!(victim >= 0) || !(killer >= 0) || killer === victim) return;
    const killerTeam = Actors.team[killer];
    if (killerTeam < 0 || killerTeam === Actors.team[victim]) return;
    // Modes.creditKill already paid a participant killer the row's kill points (= botPoints) to player and team: pay the difference.
    const participant = Modes.participant[killer] === 1;
    const extra = attritionPoints(victim) - (participant ? Modes.rules.scoring.kill : 0);
    if (extra === 0) return;
    Modes.awardTeam(killerTeam, extra);
    if (participant) Modes.awardPlayer(killer, extra, 'kill');
  },
});
function attritionPoints(victim) {
  const params = Modes.rules.params, row = Pve.rowOf(victim);
  if (!row) return params.botPoints;
  return row.heavy ? params.heavyPoints : params.fodderPoints;
}

// ---- M28 Silent Contract: stealth guards (BOT-005 meters), take the relic, leave by the extract ----
const ContractRun = { relic: null, extract: null, holder: -1, alarms: 0, kills: 0, startedAt: 0, result: NOT_OVER };
Modes.register('contract', {
  start() {
    pveStart({ stealth: Modes.rules.params.stealth, lives: true });
    Object.assign(ContractRun, { relic: null, extract: null, holder: -1, alarms: 0, kills: 0, startedAt: Sim.time, result: NOT_OVER });
    ContractRun.relic = addMapObjectives('relic', pveObjectiveList)[0] || null;
    ContractRun.extract = addMapObjectives('extract', pveObjectiveList)[0] || null;
    this.placeGuards();
    if (!ContractRun.relic) { centralSpot(pveSpot); ContractRun.relic = Modes.addObjective({ id: 'relic', kind: 'relic', x: pveSpot.x, y: pveSpot.y, z: pveSpot.z }); }
    if (!ContractRun.extract) { teamSpawnCentre(0, pveSpot); ContractRun.extract = Modes.addObjective({ id: 'exit', kind: 'extract', x: pveSpot.x, y: pveSpot.y, z: pveSpot.z }); }
  },
  // Guards stand at the team-1 spawns (the player never spawns there).
  placeGuards() {
    const points = Modes.spawnPoints;
    let guards = 0;
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].team < 1) continue;
      const id = guards < PVE_CONTRACT.guardsMax ? Pve.spawnEnemy(PVE_CONTRACT.guard, points[i].x, points[i].y, points[i].z, points[i].yaw) : -1;
      if (id >= 0) { guards++; PveLevel.markOptional(id); }   // the relic is the goal: guards never need to die
      points.splice(i, 1);
    }
  },
  step(dt, now) {
    const run = ContractRun;
    if (run.result !== NOT_OVER) return;
    if (run.holder < 0) this.tryTakeRelic();
    else if (Actors.alive[run.holder] && withinTouch(run.holder, run.extract.x, run.extract.y, run.extract.z, run.extract.radius)) this.complete(now);
    if (teamWiped(NO_TEAM)) run.result = Modes.over(PVE_LOST, PVE_LOSE);
    this.updateHud(now);
  },
  tryTakeRelic() {
    const relic = ContractRun.relic, taker = Modes.findActorNear(relic.x, relic.y, relic.z, relic.radius, NO_TEAM, NEAR_ANY);
    if (taker < 0 || !Modes.participant[taker]) return;
    ContractRun.holder = taker;
    relic.state = 'carried'; relic.carrier = taker;
    Modes.announce('Relic taken: reach the exit', 'objective', 2);
  },
  complete(now) {
    const run = ContractRun;
    Modes.awardPlayer(run.holder, contractScore(now), 'contract');
    run.result = Modes.over(coopWinner(), PVE_WIN);
  },
  onKill(victim, killer) {
    if (victim >= 0 && victim === ContractRun.holder) { ContractRun.holder = -1; ContractRun.relic.state = 'home'; ContractRun.relic.carrier = -1; }
    if (Pve.isEnemy(victim) && killer >= 0 && Modes.participant[killer]) ContractRun.kills++;
  },
  isOver() { return ContractRun.result; },
  updateHud(now) {
    let awareness = 0;
    for (let id = 0; id < Actors.count; id++) if (Pve.isEnemy(id) && Actors.alive[id]) awareness = Math.max(awareness, Pve.awareness[id]);
    PVE_HUD.awareness = awareness; PVE_HUD.alarms = ContractRun.alarms; PVE_HUD.relic = ContractRun.holder >= 0;
    PVE_HUD.enemiesLeft = Pve.hostileCount();
    updatePlayerHud();
    PVE_HUD.score = contractScore(now);
  },
});
// base - time - alarms - kills, plus the ghost (no alarm) and no-kill bonuses the mode row enables.
function contractScore(now) {
  const run = ContractRun, params = Modes.rules.params, data = PVE_CONTRACT;
  const base = data.base - data.perSecond * (now - run.startedAt) - data.perAlarm * run.alarms - data.perKill * run.kills;
  const ghost = params.ghostBonus && run.alarms === 0 ? data.ghostBonus : 0, clean = params.noKillBonus && run.kills === 0 ? data.noKillBonus : 0;
  return Math.max(0, Math.round(base)) + ghost + clean;
}
Bus.on('pve.alarm', () => { if (Modes.mode && Modes.mode.id === 'contract') ContractRun.alarms++; });

// ---- M30 Firing Range: stations on the 'dummy' hints (target, strafer, fire-back), shot statistics, repeating kill drills ----
// Free practice: the range never ends on its own (leave it from the pause menu). Accuracy counts a shot once however many
// pellets or blasts it lands (ACCURACY_HIT_KINDS); damage over time adds damage but no hits. Every drillTargets kills complete a
// drill (score from its time; the best time is kept) and the next drill starts.
const RANGE_INTRO_TEXT = 'Shoot ' + PVE_RANGE.drillTargets + ' targets for a timed drill. Pause > Quit to menu to leave.';   // what the room is and how to get out
const ACCURACY_HIT_KINDS = ['hit', 'melee', 'beam', 'splash'];   // damage kinds that count as a hit for accuracy (range HUD, scoreboard)
const RangeRun = { stations: [], shots: 0, hits: 0, headshots: 0, damage: 0, kills: 0, drillKills: 0, drillStart: -1, drillBest: 0, drills: 0,
  shotOpen: new Uint8Array(MAX_ACTORS), result: NOT_OVER };
Modes.register('range', {
  start() {
    pveStart();
    Object.assign(RangeRun, { shots: 0, hits: 0, headshots: 0, damage: 0, kills: 0, drillKills: 0, drillStart: -1, drillBest: 0, drills: 0, result: NOT_OVER });
    RangeRun.shotOpen.fill(0);
    RangeRun.stations.length = 0;
    const hints = (World.map && World.map.navHints ? World.map.navHints : []).filter((hint) => hint.kind === 'dummy');
    const origin = Modes.spawnPoints[0] || { x: 0, y: 0, z: 0, yaw: 0 };
    const spots = hints.length ? hints : PVE_STATION_FALLBACK.map(([dx, dz]) => ({ x: origin.x + dx, y: origin.y, z: origin.z + dz }));
    spots.forEach((spot, index) => RangeRun.stations.push({ x: spot.x, y: spot.y, z: spot.z, yaw: Math.atan2(origin.x - spot.x, origin.z - spot.z),
      kind: PVE_RANGE.kinds[index % PVE_RANGE.kinds.length], shield: PVE_RANGE.shieldLevels[index % PVE_RANGE.shieldLevels.length], id: -1, respawnAt: 0 }));
    PVE_HUD.drillTargets = PVE_RANGE.drillTargets;
    Modes.announce(RANGE_INTRO_TEXT, 'wave', 2);
  },
  step(dt, now) {
    for (const station of RangeRun.stations) this.keepStation(station, now);
    if (teamWiped(NO_TEAM)) RangeRun.result = Modes.over(PVE_LOST, PVE_LOSE);
    PVE_HUD.shots = RangeRun.shots; PVE_HUD.hits = RangeRun.hits; PVE_HUD.headshots = RangeRun.headshots; PVE_HUD.damage = Math.round(RangeRun.damage);
    PVE_HUD.kills = RangeRun.kills; PVE_HUD.drillKills = RangeRun.drillKills; PVE_HUD.accuracy = RangeRun.shots > 0 ? RangeRun.hits / RangeRun.shots : 0;
    PVE_HUD.stateTimeLeft = RangeRun.drillStart >= 0 ? now - RangeRun.drillStart : 0;
    PVE_HUD.drillBest = RangeRun.drillBest; PVE_HUD.drills = RangeRun.drills;
    updatePlayerHud();
  },
  keepStation(station, now) {
    const row = station.id >= 0 ? Pve.rowOf(station.id) : null;   // the slot may hold another enemy once the corpse is gone
    if (row && row.id === station.kind && Actors.alive[station.id]) return;
    if (station.id >= 0) { station.id = -1; station.respawnAt = now + PVE_RANGE.respawnSeconds; }
    if (now + TIME_EPSILON < station.respawnAt) return;
    station.id = Pve.spawnEnemy(station.kind, station.x, station.y, station.z, station.yaw, { team: ENEMY_TEAM, overCap: true });
    if (station.id >= 0 && station.shield > 0) Actors.shield[station.id] = Actors.maxShield[station.id] = station.shield;
  },
  onFire(shot) {
    if (shot.id < 0 || !Modes.participant[shot.id]) return;
    RangeRun.shots++;
    RangeRun.shotOpen[shot.id] = 1;
    if (RangeRun.drillStart < 0) RangeRun.drillStart = Sim.time;
  },
  onDamage(event) {
    const source = event.source;
    if (!Pve.isEnemy(event.target) || source < 0 || !Modes.participant[source] || event.amount <= 0) return;
    RangeRun.damage += event.amount;
    if (!ACCURACY_HIT_KINDS.includes(event.kind) || !RangeRun.shotOpen[source]) return;
    RangeRun.shotOpen[source] = 0;
    RangeRun.hits++;
    if (event.zone === 'head') RangeRun.headshots++;
  },
  onKill(victim, killer) {
    if (!Pve.isEnemy(victim) || !(killer >= 0) || !Modes.participant[killer]) return;
    if (RangeRun.drillStart < 0) RangeRun.drillStart = Sim.time;
    RangeRun.kills++;
    RangeRun.drillKills++;
    if (RangeRun.drillKills >= PVE_RANGE.drillTargets) completeDrill(killer);
  },
  isOver() { return RangeRun.result; },
});
function completeDrill(killer) {
  const run = RangeRun, seconds = Sim.time - run.drillStart;
  Modes.awardPlayer(killer, Math.max(1, Math.round(PVE_RANGE.drillSeconds * 10 - seconds * 10)), 'drill');
  run.drillBest = run.drillBest > 0 ? Math.min(run.drillBest, seconds) : seconds;
  run.drills++;
  run.drillKills = 0;
  run.drillStart = -1;
  Modes.announce('Drill done: ' + seconds.toFixed(1) + ' s', 'objective', 2);
}

// ---- MP11 Test Chambers: twelve rooms, one concept each; exit pads unlock by buttons, cubes on plates, shot relays ----
const CHAMBER_MAX_ELEMENTS = 4;
const ChamberRun = {
  index: 0, startedAt: 0, steps: 0, portals: 0, stars: 0, medals: [], result: NOT_OVER, centreX: 0, centreZ: 0,
  done: new Uint8Array(CHAMBER_MAX_ELEMENTS),          // button pressed / plate loaded / relay lit
  cubeX: 0, cubeY: 0, cubeZ: 0, cubeCarried: false, exits: [],
  chamber() { return PVE_CHAMBERS[this.index]; },
};
Modes.register('puzzle', {
  start() {
    pveStart();
    Object.assign(ChamberRun, { index: 0, stars: 0, result: NOT_OVER });
    ChamberRun.medals = [];
    ChamberRun.exits = addMapObjectives('extract', []).slice();
    PVE_HUD.chambers = PVE_CHAMBERS.length;
    enterChamber(0);
  },
  onSpawn(id) {
    if (!Modes.participant[id]) return;
    Weapons.setLoadout(id, PVE_CHAMBER_RULES.loadout);
    placeInChamber(id, ChamberRun.index);
  },
  step(dt, now) {
    if (ChamberRun.result !== NOT_OVER) return;
    const id = Game.playerId >= 0 ? Game.playerId : coopWinner();
    if (id < 0 || !Actors.alive[id]) return;
    stepChamber(id);
    if (chamberSolved() && touchesExit(id)) finishChamber(id, now);
    updateChamberHud(now);
  },
  onFire(shot) {
    if (shot.id < 0 || !Modes.participant[shot.id]) return;
    if (shot.weapon === 'twingate') ChamberRun.portals++;
    shootRelays(shot);
  },
  isOver() { return ChamberRun.result; },
});

function chamberElementAt(element, out) {
  out.x = ChamberRun.centreX + element.at[0]; out.y = element.at[1]; out.z = ChamberRun.centreZ + element.at[2];
  return out;
}
function enterChamber(index) {
  const run = ChamberRun, row = PVE_CHAMBERS[index];
  run.index = index; run.startedAt = Sim.time; run.steps = 0; run.portals = 0; run.cubeCarried = false;
  run.done.fill(0);
  const zone = World.map && World.map.zones ? World.map.zones.find((entry) => entry.name === row.zone) : null;
  run.centreX = zone ? (zone.min[0] + zone.max[0]) / 2 : 0;
  run.centreZ = zone ? (zone.min[2] + zone.max[2]) / 2 : 0;
  const cube = row.elements.find((element) => element.kind === 'cube');
  if (cube) { chamberElementAt(cube, pveSpot); run.cubeX = pveSpot.x; run.cubeY = pveSpot.y; run.cubeZ = pveSpot.z; }
  PVE_HUD.parTime = row.par.time;
  PVE_HUD.hint = row.hint;   // MAP-030: heavy hints early, none in the last chambers
  if (row.hint) Modes.announce(row.hint, 'objective', 2);
  Bus.emit('pve.chamber', chamberEvent(index, 'enter', '', 0, 0));
}
// The chamber's spawn (map spawns follow the chamber order), else its zone centre.
function placeInChamber(id, index) {
  const point = Modes.spawnPoints[index];
  if (point) relocateActor(id, point.x, point.y, point.z, point.yaw);
  else relocateActor(id, ChamberRun.centreX, 0, ChamberRun.centreZ, 0);
}
function stepChamber(id) {
  const row = ChamberRun.chamber(), pressedUse = (Actors.pressed[id] & BTN.USE) !== 0;
  for (let index = 0; index < row.elements.length; index++) {
    const element = row.elements[index];
    chamberElementAt(element, pveSpot);
    if (element.kind === 'button' && pressedUse && withinTouch(id, pveSpot.x, pveSpot.y, pveSpot.z, PVE_CHAMBER_RULES.useRadius)) { ChamberRun.done[index] = 1; Weapons.claimUse(id); }   // no gun swap on this hold (swap-02)
    else if (element.kind === 'cube') stepCube(id, pressedUse, element);
    else if (element.kind === 'plate') ChamberRun.done[index] = cubeOn(pveSpot) ? 1 : 0;
    else if (element.kind === 'fizzle' && insideFizzle(id, element, pveSpot)) crossFizzle(id, row, element);
  }
}
// A fizzle grid returns a carried cube to its start and, with clears 'gates', closes the crosser's twin gates (W42).
function crossFizzle(id, row, element) {
  if (ChamberRun.cubeCarried) resetCube(row);
  if (element.clears !== 'gates') return;
  WeaponSpecialState.gateOpen[id * 2] = 0;
  WeaponSpecialState.gateOpen[id * 2 + 1] = 0;
}
// The dropped cube rests on the plate at `spot`.
function cubeOn(spot) {
  const run = ChamberRun;
  if (run.cubeCarried) return false;
  return length2(run.cubeX - spot.x, run.cubeZ - spot.z) <= PVE_CHAMBER_RULES.plateRadius && Math.abs(run.cubeY - spot.y) < 1;
}
function stepCube(id, pressedUse, element) {
  const run = ChamberRun;
  if (run.cubeCarried) {
    const yaw = Actors.yaw[id];
    run.cubeX = Actors.x[id] + Math.sin(yaw) * PVE_CHAMBER_RULES.carryAhead; run.cubeY = Actors.y[id]; run.cubeZ = Actors.z[id] + Math.cos(yaw) * PVE_CHAMBER_RULES.carryAhead;
    if (pressedUse) { run.cubeCarried = false; Weapons.claimUse(id); }   // dropped where it is
    return;
  }
  if (!pressedUse || !withinTouch(id, run.cubeX, run.cubeY, run.cubeZ, PVE_CHAMBER_RULES.useRadius)) return;
  run.cubeCarried = true;
  Weapons.claimUse(id);
}
function insideFizzle(id, element, centre) {
  const size = element.size || [1, 3, 1];
  return Math.abs(Actors.x[id] - centre.x) <= size[0] / 2 + 0.4 && Math.abs(Actors.z[id] - centre.z) <= size[2] / 2 + 0.4;
}
function resetCube(row) {
  const cube = row.elements.find((element) => element.kind === 'cube');
  ChamberRun.cubeCarried = false;
  chamberElementAt(cube, pveSpot);
  ChamberRun.cubeX = pveSpot.x; ChamberRun.cubeY = pveSpot.y; ChamberRun.cubeZ = pveSpot.z;
}
// A relay lights when a shot's line passes within relayRadius of it (in range, nothing in between).
function shootRelays(shot) {
  const row = ChamberRun.chamber();
  for (let index = 0; index < row.elements.length; index++) {
    if (row.elements[index].kind !== 'relay') continue;
    chamberElementAt(row.elements[index], pveSpot);
    const rx = pveSpot.x - shot.x, ry = pveSpot.y - shot.y, rz = pveSpot.z - shot.z;
    const along = rx * shot.dx + ry * shot.dy + rz * shot.dz;
    if (along <= 0 || along > PVE_CHAMBER_RULES.relayRange) continue;
    const miss = length3(rx - shot.dx * along, ry - shot.dy * along, rz - shot.dz * along);
    if (miss <= PVE_CHAMBER_RULES.relayRadius && World.lineClear(shot.x, shot.y, shot.z, pveSpot.x - shot.dx * 0.3, pveSpot.y - shot.dy * 0.3, pveSpot.z - shot.dz * 0.3)) ChamberRun.done[index] = 1;
  }
}
function chamberSolved() {
  const row = ChamberRun.chamber();
  if (row.lock === 'none') return true;
  for (let index = 0; index < row.elements.length; index++) {
    const kind = row.elements[index].kind;
    if (kind === 'cube' || kind === 'fizzle') continue;
    if (row.lock !== 'all' && kind !== row.lock) continue;
    if (!ChamberRun.done[index]) return false;
  }
  return true;
}
function touchesExit(id) {
  const exit = ChamberRun.exits[ChamberRun.index];
  return !!exit && withinTouch(id, exit.x, exit.y, exit.z, exit.radius);
}
// Medal: the best tier whose time, step and portal limits all hold (gold 3 stars .. bronze 1, none 0).
function chamberMedal(row, seconds, steps, portals) {
  for (let tier = 0; tier < PVE_CHAMBER_RULES.medals.length; tier++) {
    if (seconds <= row.par.time[tier] && steps <= row.par.steps[tier] && portals <= row.par.portals[tier]) return tier;
  }
  return -1;
}
function finishChamber(id, now) {
  const run = ChamberRun, row = run.chamber();
  const seconds = now - run.startedAt, tier = chamberMedal(row, seconds, run.steps, run.portals);
  const medal = tier >= 0 ? PVE_CHAMBER_RULES.medals[tier] : '', stars = tier >= 0 ? PVE_CHAMBER_RULES.medals.length - tier : 0;
  run.medals.push(medal);
  run.stars += stars;
  PVE_HUD.medal = medal;
  Modes.awardPlayer(id, stars, 'chamber');
  Bus.emit('pve.chamber', chamberEvent(run.index, 'complete', medal, stars, seconds));   // S15 keeps the best run per chamber
  if (run.index + 1 >= PVE_CHAMBERS.length) { run.result = Modes.over(id, PVE_WIN); return; }
  enterChamber(run.index + 1);
  placeInChamber(id, run.index);
}
function updateChamberHud(now) {
  const run = ChamberRun;
  PVE_HUD.chamber = run.index + 1; PVE_HUD.chamberTime = now - run.startedAt; PVE_HUD.steps = run.steps; PVE_HUD.portals = run.portals;
  PVE_HUD.solved = chamberSolved(); PVE_HUD.stars = run.stars;
  updatePlayerHud();
}
const chamberEventPayload = { chamber: 0, kind: '', medal: '', stars: 0, seconds: 0 };
function chamberEvent(index, kind, medal, stars, seconds) {
  chamberEventPayload.chamber = index + 1; chamberEventPayload.kind = kind; chamberEventPayload.medal = medal;
  chamberEventPayload.stars = stars; chamberEventPayload.seconds = seconds;
  return chamberEventPayload;
}
Bus.on('move.step', (event) => { if (Modes.mode && Modes.mode.id === 'puzzle' && Modes.participant[event.id]) ChamberRun.steps++; });

// Puzzle props: buttons, the cube, plates, relays (red until done, then green), fizzle grids and the exit lock ring.
const CHAMBER_CUBE_SIZE = [PVE_CHAMBER_RULES.cubeSize, PVE_CHAMBER_RULES.cubeSize, PVE_CHAMBER_RULES.cubeSize];
const CHAMBER_COLORS = { off: [0.9, 0.2, 0.15], on: [0.2, 0.95, 0.35], cube: [0.75, 0.8, 0.9], fizzle: [0.4, 0.7, 1] };
function drawChambers(batch) {
  if (!Modes.mode || Modes.mode.id !== 'puzzle' || ChamberRun.result !== NOT_OVER) return;
  const row = ChamberRun.chamber();
  for (let index = 0; index < row.elements.length; index++) drawChamberElement(batch, row.elements[index], ChamberRun.done[index] === 1);
  const exit = ChamberRun.exits[ChamberRun.index];
  if (!exit) return;
  chamberExitSize[0] = chamberExitSize[2] = exit.radius * 2;
  drawChamberMark(batch, 'ring', exit, 0.05, chamberExitSize, chamberSolved() ? CHAMBER_COLORS.on : CHAMBER_COLORS.off, 0.8);
}
// Chamber marks per element kind: shape, lift above the spot, full size, glow (fizzle walls and the cube are boxes of their own size).
const CHAMBER_MARKS = {
  button: { shape: 'cylinder', lift: 0.5, size: [0.35, 1, 0.35], glow: 0.6 },
  plate: { shape: 'disc', lift: 0.03, size: [1.6, 0.05, 1.6], glow: 0.5 },
  relay: { shape: 'sphere', lift: 0, size: [0.5, 0.5, 0.5], glow: 0.9 },
};
const chamberExitSize = [0, 0.1, 0];
// One reused instance record (batch.meshFrom, PERF-006): the callers pass objects and constants, the floats are computed here.
const chamberInstance = makeShapeInstance();
function drawChamberMark(batch, shape, spot, lift, size, color, glow) {
  const instance = chamberInstance;
  instance.x = spot.x; instance.y = spot.y + lift; instance.z = spot.z;
  instance.sx = size[0]; instance.sy = size[1]; instance.sz = size[2];
  instance.setRgb(color); instance.emissive = glow;
  batch.meshFrom(shape, instance);
}
function drawChamberElement(batch, element, done) {
  const mark = CHAMBER_MARKS[element.kind];
  chamberElementAt(element, pveSpot);
  if (mark) drawChamberMark(batch, mark.shape, pveSpot, mark.lift, mark.size, done ? CHAMBER_COLORS.on : CHAMBER_COLORS.off, mark.glow);
  else if (element.kind === 'fizzle') drawChamberBox(batch, element.size, CHAMBER_COLORS.fizzle, 0.4);
  else if (element.kind === 'cube') {
    pveSpot.x = ChamberRun.cubeX; pveSpot.y = ChamberRun.cubeY; pveSpot.z = ChamberRun.cubeZ;
    drawChamberBox(batch, CHAMBER_CUBE_SIZE, CHAMBER_COLORS.cube, 0.2);
  }
}
// A box standing on pveSpot
function drawChamberBox(batch, size, color, glow) {
  pveSpot.y += size[1] / 2;
  drawChamberMark(batch, 'box', pveSpot, 0, size, color, glow);
}
Render.addSource('pveChambers', drawChambers);

// ---- Level report (docs/api/progression.md): secrets, crates, optional enemies, and match.results.pve for card unlocks ----
// Secrets are the map's 'secret' nav hints (found by a participant within PVE_SECRET_RADIUS, 'pve.secret'); crates are the
// destructible props (a participant breaking one: 'pve.crate'); optional enemies are those a level never needs dead
// (contract guards, X50 beasts). A number the level cannot measure (no secrets, no breakable props, nothing optional, no
// hostile spawn) stays out of the report, so it never unlocks a card.
const PVE_SECRET_RADIUS = 1.5;
const PVE_SECRET_MAX = 16;
const PveLevel = {
  secretX: new Float32Array(PVE_SECRET_MAX), secretY: new Float32Array(PVE_SECRET_MAX), secretZ: new Float32Array(PVE_SECRET_MAX),
  found: new Uint8Array(PVE_SECRET_MAX), secretCount: 0,
  optional: new Uint8Array(MAX_ACTORS), optionalUsed: false,
  secretEvent: { id: -1, secret: 0 }, crateEvent: { id: -1, prop: -1 },

  reset() { this.secretCount = 0; this.found.fill(0); this.optional.fill(0); this.optionalUsed = false; },
  begin(map) {
    this.reset();
    for (const hint of (map && map.navHints) || []) if (hint.kind === 'secret' && this.secretCount < PVE_SECRET_MAX) this.addSecret(hint);
  },
  addSecret(hint) {
    const index = this.secretCount++;
    this.secretX[index] = hint.x; this.secretY[index] = hint.y; this.secretZ[index] = hint.z;
  },
  markOptional(id) { this.optional[id] = 1; this.optionalUsed = true; },
  step() {
    if (!Pve.active) return;
    for (let index = 0; index < this.secretCount; index++) {
      if (this.found[index]) continue;
      const finder = Modes.findActorNear(this.secretX[index], this.secretY[index], this.secretZ[index], PVE_SECRET_RADIUS, NO_TEAM, NEAR_ANY);
      if (finder >= 0) this.find(index, finder);
    }
  },
  find(index, id) {
    this.found[index] = 1;
    this.secretEvent.id = id; this.secretEvent.secret = index;
    Bus.emit('pve.secret', this.secretEvent);
    Modes.announce('Secret found', 'objective', 1);
  },
  onBreak(event) {
    const id = event.source;
    if (!Pve.active || !(id >= 0) || !Modes.participant[id]) return;
    this.crateEvent.id = id; this.crateEvent.prop = event.prop;
    Bus.emit('pve.crate', this.crateEvent);
  },
  secretsLeft() {
    let left = 0;
    for (let index = 0; index < this.secretCount; index++) if (!this.found[index]) left++;
    return left;
  },
  optionalLeft() {
    let left = 0;
    for (let id = 0; id < Actors.count; id++) if (Pve.isEnemy(id) && Actors.alive[id] && (this.optional[id] || Pve.rowOf(id).beast)) left++;
    return left;
  },
  // The match results of a finished PvE level (a fresh object: the results screen keeps it).
  report(match) {
    if (!Pve.active || !match.results || !match.rules || match.rules.family === 'versus') return;
    const pve = {}, props = standingProps();
    if (props >= 0) pve.propsLeft = props;
    if (this.secretCount > 0) pve.secretsLeft = this.secretsLeft();
    if (this.optionalUsed || Pve.wildlife > 0) pve.optionalLeft = this.optionalLeft();
    match.results.pve = pve;
  },
};
// Breakable props still standing (-1 when the map has none: props past the quality budget never break, S08).
function standingProps() {
  let breakable = 0, standing = 0;
  for (let index = 0; index < Props.brushes.length; index++) {
    if (!Props.breakable[index]) continue;
    breakable++;
    if (Props.isStanding(index)) standing++;
  }
  return breakable > 0 ? standing : -1;
}
// 14k: whether a killed boss was the level's final boss (the mode behaviour's finalBoss rule; none = not final).
function pveFinalBoss(id) {
  const behaviour = Modes.behaviour;
  return !!(behaviour && behaviour.finalBoss && behaviour.finalBoss(id));
}

// ---- Lifecycle ----
function resetPveModes() {
  resetPveHud();
  Pve.sideTeam = null;
  Pve.sideHunt = null;
  pveHunted.length = 0;   // no marker outlives its match (17d draws whatever is listed)
  PveLevel.reset();
}
Modes.hud.pve = PVE_HUD;
Sim.addSystem('pveLevel', 82, () => PveLevel.step());
Bus.on('match.setup', resetPveModes);
Bus.on('match.stop', resetPveModes);
Bus.on('match.end', (match) => PveLevel.report(match));   // before S15 counts the match (its listener comes later)
Bus.on('world.break', (event) => PveLevel.onBreak(event));
Bus.on('actor.create', (id) => { PveLevel.optional[id] = 0; });
