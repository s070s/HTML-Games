// ==== S15 PROGRESSION: MEDALS ====
// Medals MD01..MD20 (PRG-013, UI-012) detected from match events and emitted as 'medal' { id, medal } for the local player
// (the HUD banner, the sting and the scoreboard already listen). Each medal has one scripted trigger and fires only then.
// Double-award rules: a kill chain pays Double at 2 and Multi at 3 once per chain; a life pays each streak medal once; one
// kill may pay several different medals (Multi + Spree), never the same medal twice. Numbers: MEDAL_RULES in 03p.

const MEDAL_KIND = { NONE: 0, MELEE: 1, TELEFRAG: 2 };
const MEDAL_NOBODY = -1;

const Medals = {
  chain: new Uint8Array(MAX_ACTORS),            // kills in the current chain (each within chainSeconds of the last)
  chainAt: new Float64Array(MAX_ACTORS),
  streak: new Uint8Array(MAX_ACTORS),           // kills since the last death
  deathsInRow: new Uint8Array(MAX_ACTORS),      // deaths since the last kill
  lastKiller: new Int8Array(MAX_ACTORS).fill(MEDAL_NOBODY),
  lastHitKind: new Uint8Array(MAX_ACTORS),      // MEDAL_KIND of the last damage taken
  lastHitSource: new Int8Array(MAX_ACTORS).fill(MEDAL_NOBODY),
  railHit: new Uint8Array(MAX_ACTORS),          // the current rail shot hit someone (damage comes before 'weapon.fire')
  railRow: new Uint8Array(MAX_ACTORS),          // rail hits in a row
  roundKiller: new Int8Array(MAX_ACTORS).fill(MEDAL_NOBODY),
  clutch: new Uint8Array(MAX_ACTORS),           // was the last one standing of its side against clutchEnemies or more
  waveHurt: new Uint8Array(MAX_ACTORS),
  firstStrikeDone: false,
  alarmRaised: false,
  event: { id: 0, medal: '' },
  railWeapons: new Uint8Array(WEAPON_COUNT),

  reset() {
    this.chain.fill(0); this.chainAt.fill(0); this.streak.fill(0); this.deathsInRow.fill(0); this.lastKiller.fill(MEDAL_NOBODY);
    this.lastHitKind.fill(0); this.lastHitSource.fill(MEDAL_NOBODY); this.railHit.fill(0); this.railRow.fill(0);
    this.resetRound();
    this.waveHurt.fill(0);
    this.firstStrikeDone = false;
    this.alarmRaised = false;
  },
  resetRound() { this.roundKiller.fill(MEDAL_NOBODY); this.clutch.fill(0); },
  award(id, medal) {
    if (id < 0 || Actors.kind[id] !== ACTOR_KIND.PLAYER) return;
    this.event.id = id; this.event.medal = medal;
    Bus.emit('medal', this.event);
  },

  // ---- Kills: First Strike, chains, streaks, Humiliation, Comeback, Revenge, Telefrag, Airborne, Long Shot, Defender, Assist, Ace ----
  onKill(event) {
    const victim = event.victim, killer = event.killer;
    const counts = killer >= 0 && killer !== victim && Actors.isEnemy(killer, victim);
    this.onDeath(victim, killer);
    const helper = event.assister;
    if (counts && helper >= 0 && helper !== killer && !Actors.isEnemy(helper, killer)) this.award(helper, 'assist');
    if (counts) this.countedKill(killer, victim, event);
    // The next life starts clean: an old melee or telefrag hit must not style a later kill.
    this.lastHitKind[victim] = MEDAL_KIND.NONE;
    this.lastHitSource[victim] = MEDAL_NOBODY;
  },
  countedKill(killer, victim, event) {
    if (!this.firstStrikeDone) { this.firstStrikeDone = true; this.award(killer, 'firstStrike'); }
    this.chainKill(killer);
    this.streakKill(killer);
    this.styleKill(killer, victim, event);
    this.roundKill(killer, victim);
  },
  onDeath(victim, killer) {
    this.streak[victim] = 0;
    this.chain[victim] = 0;
    if (this.deathsInRow[victim] < 255) this.deathsInRow[victim]++;
    if (killer >= 0 && killer !== victim) this.lastKiller[victim] = killer;
  },
  chainKill(killer) {
    const now = Sim.time;
    this.chain[killer] = this.chain[killer] > 0 && now - this.chainAt[killer] <= MEDAL_RULES.chainSeconds ? Math.min(255, this.chain[killer] + 1) : 1;
    this.chainAt[killer] = now;
    if (this.chain[killer] === MEDAL_RULES.double) this.award(killer, 'double');
    if (this.chain[killer] === MEDAL_RULES.multi) this.award(killer, 'multi');
  },
  streakKill(killer) {
    this.streak[killer] = Math.min(255, this.streak[killer] + 1);
    for (const [kills, medal] of MEDAL_RULES.streaks) if (this.streak[killer] === kills) this.award(killer, medal);
    if (this.deathsInRow[killer] >= MEDAL_RULES.comebackDeaths) this.award(killer, 'comeback');
    this.deathsInRow[killer] = 0;
  },
  styleKill(killer, victim, event) {
    if (this.lastHitKind[victim] === MEDAL_KIND.MELEE && this.lastHitSource[victim] === killer) this.award(killer, 'humiliation');
    if (this.lastHitKind[victim] === MEDAL_KIND.TELEFRAG && this.lastHitSource[victim] === killer) this.award(killer, 'telefrag');
    if (this.lastKiller[killer] === victim) { this.lastKiller[killer] = MEDAL_NOBODY; this.award(killer, 'revenge'); }
    if (isAirborne(killer)) this.award(killer, 'airborne');
    if (Math.hypot(Actors.x[killer] - event.x, Actors.y[killer] - event.y, Actors.z[killer] - event.z) > MEDAL_RULES.longShotMetres) this.award(killer, 'longShot');
    if (defendsObjective(killer, victim)) this.award(killer, 'defender');
  },
  // MD17 Ace: in a round mode, the killer took down every enemy participant of this round. MD18 Clutch candidates.
  roundKill(killer, victim) {
    if (!Modes.active || !Modes.rules || !Modes.rules.rounds) return;
    this.roundKiller[victim] = killer;
    if (allEnemiesDownBy(killer)) this.award(killer, 'ace');
    this.markClutches();
  },
  markClutches() {
    for (let team = 0; team < TEAM_COUNT; team++) {
      const alone = soleSurvivor(team);
      if (alone >= 0 && Modes.teamAliveCount(1 - team) >= MEDAL_RULES.clutchEnemies) this.clutch[alone] = 1;
    }
  },
  onRound(event) {
    if (event.phase === 'start') { this.resetRound(); return; }
    if (event.phase !== 'end' || event.winner < 0) return;
    for (let id = 0; id < Actors.count; id++) {
      if (this.clutch[id] && Actors.alive[id] && Actors.team[id] === event.winner) this.award(id, 'clutch');
    }
    this.clutch.fill(0);
  },

  // ---- Damage and shots: hit kinds for Humiliation / Telefrag, rail hits in a row (MD07), wave damage (MD20) ----
  onDamage(event) {
    const target = event.target;
    if (target < 0) return;
    this.lastHitKind[target] = event.kind === 'melee' ? MEDAL_KIND.MELEE : event.kind === 'telefrag' ? MEDAL_KIND.TELEFRAG : MEDAL_KIND.NONE;
    this.lastHitSource[target] = event.source;
    if (event.source !== target && event.amount > 0) this.waveHurt[target] = 1;
    const weapon = CAT.weapons.byId(event.weapon);
    if (event.source >= 0 && event.source !== target && weapon && this.railWeapons[weapon.index]) this.railHit[event.source] = 1;
  },
  onFire(event) {
    const weapon = CAT.weapons.byId(event.weapon);
    if (!weapon || !this.railWeapons[weapon.index] || event.mode === 'melee') return;
    const id = event.id;
    this.railRow[id] = this.railHit[id] ? this.railRow[id] + 1 : 0;
    this.railHit[id] = 0;
    if (this.railRow[id] < MEDAL_RULES.railHits) return;
    this.railRow[id] = 0;
    this.award(id, 'precise');
  },
  onScore(event) { if (event.reason === 'capture' && event.id >= 0) this.award(event.id, 'capture'); },
  // MD20: a PvE wave cleared ('pve.wave' phase 'end') by a living player who took no damage since it started.
  onWave(event) {
    if (event.phase === 'start') { this.waveHurt.fill(0); return; }
    if (event.phase !== 'end') return;
    for (let id = 0; id < Actors.count; id++) if (Actors.kind[id] === ACTOR_KIND.PLAYER && Actors.alive[id] && !this.waveHurt[id]) this.award(id, 'flawlessWave');
  },
  // MD19: a stealth (solo family) level finished and won with no alarm raised.
  onMatchEnd(match) {
    const id = Game.playerId;
    if (id < 0 || !match.rules || match.rules.family !== 'solo' || this.alarmRaised || !match.results) return;
    if (Progress.outcome(match.results) === 'win') this.award(id, 'ghost');
  },
};
MEDAL_RULES.railWeapons.forEach((key) => { const row = CAT.weapons.byId(key); if (row) Medals.railWeapons[row.index] = 1; });

function isAirborne(id) {
  return !(Actors.flags[id] & (ACTOR_FLAG.ON_GROUND | ACTOR_FLAG.IN_WATER | ACTOR_FLAG.ON_LADDER));
}
// MD10: the victim was within defendRadius of an objective of the killer's side (own flag or base, owned point, defended
// site) or was carrying the killer's flag.
function defendsObjective(killer, victim) {
  const team = Actors.team[killer];
  if (!Modes.active || team < 0) return false;
  for (const objective of Modes.objectives) {
    const ours = objective.team === team || objective.owner === team;
    if (!ours) continue;
    if (objective.carrier === victim) return true;
    if (Math.hypot(Actors.x[victim] - objective.x, Actors.z[victim] - objective.z) <= MEDAL_RULES.defendRadius) return true;
  }
  return false;
}
function allEnemiesDownBy(killer) {
  let enemies = 0;
  for (let id = 0; id < Actors.count; id++) {
    if (!Modes.participant[id] || !Actors.isEnemy(killer, id)) continue;
    if (Actors.alive[id] || Medals.roundKiller[id] !== killer) return false;
    enemies++;
  }
  return enemies > 1;
}
function soleSurvivor(team) {
  let survivor = -1;
  for (let id = 0; id < Actors.count; id++) {
    if (!Modes.participant[id] || Actors.team[id] !== team || !Actors.alive[id]) continue;
    if (survivor >= 0) return -1;
    survivor = id;
  }
  return survivor;
}

Bus.on('match.start', () => Medals.reset());
Bus.on('kill', (event) => Medals.onKill(event));
Bus.on('damage', (event) => Medals.onDamage(event));
Bus.on('weapon.fire', (event) => Medals.onFire(event));
Bus.on('score', (event) => Medals.onScore(event));
Bus.on('round', (event) => Medals.onRound(event));
Bus.on('pve.wave', (event) => Medals.onWave(event));
Bus.on('pve.alarm', () => { Medals.alarmRaised = true; });
Progress.addPreFinisher((match) => Medals.onMatchEnd(match));   // before the XP count of the match
