// Party versus modes on the S13 framework: M16 Arms Ladder, M17 Blight, M18 Colossus, M19 Curse Tag, M24 Flame Bearer and
// M25 Roulette Arms. They use the add-on helpers of 13e: actor roles, held loadouts, melee kills and the onSpawn / onDamage /
// onJump behaviour hooks.

const HUMAN_TEAM = 0;
const INFECTED_TEAM = 1;
const ROULETTE_EXCLUDED_CLASSES = ['melee', 'tool', 'power'];
const ROULETTE_FALLBACK = 'warden';
const ladderTier = new Uint8Array(MAX_ACTORS);

// Colossus (M18) and the flame bearer (M24) hit harder by the mode's params.damageMult (HP-001 attacker multipliers).
function roleDamageScale(source) {
  if (!Modes.active || !(source >= 0)) return 1;
  const role = Modes.actorRole[source];
  if (role !== ACTOR_ROLE.COLOSSUS && role !== ACTOR_ROLE.BEARER) return 1;
  return Modes.rules.params.damageMult || 1;
}

// ---- M16 Arms Ladder: one weapon per tier (params.ladder, the last tier is the melee weapon); a kill climbs one tier,
// a melee kill also drops the victim one tier (meleeDemotes), and a melee kill on the last tier wins. Score = tier ----
Modes.register('gungame', {
  limits: ['time'],
  ladder: null, loadouts: null, winner: -1,
  start() {
    this.ladder = ladderTiers(Modes.rules.params);
    this.loadouts = ladderLoadouts(this.ladder, meleeWeaponKey());
    this.winner = -1;
    ladderTier.fill(0);
    Modes.hud.ladderTiers = this.ladder.length;
    Modes.hud.ladderTier = 1;
  },
  onSpawn(id) { Weapons.setLoadout(id, this.loadouts[ladderTier[id]]); },
  step() {
    for (let id = 0; id < Actors.count; id++) if (Actors.alive[id] && Modes.isActive(id)) holdLoadout(id, this.loadouts[ladderTier[id]]);
  },
  onKill(victim, killer) {
    if (!(killer >= 0) || killer === victim || !Modes.isActive(killer) || !Actors.isEnemy(killer, victim)) return;
    const melee = wasMeleeKill(victim);
    if (melee && Modes.rules.params.meleeDemotes) this.changeTier(victim, -1, 'demote');
    if (ladderTier[killer] < this.ladder.length - 1) { this.changeTier(killer, 1, 'advance'); return; }
    if (melee) this.winner = killer;
  },
  changeTier(id, step, reason) {
    const tier = clamp(ladderTier[id] + step, 0, this.ladder.length - 1);
    if (tier === ladderTier[id]) return;
    ladderTier[id] = tier;
    Modes.awardPlayer(id, step, reason);
    if (Actors.alive[id]) Weapons.setLoadout(id, this.loadouts[tier]);
    if (id === Game.playerId) Modes.hud.ladderTier = tier + 1;
  },
  isOver(now) { return this.winner >= 0 ? Modes.over(this.winner, 'score') : Modes.timeResult(now); },
  score(id) { return ladderTier[id]; },
});

// The first tiers - 1 ladder weapons plus the ladder's last (melee) weapon: a custom match can shorten the ladder (MODE-001).
function ladderTiers(params) {
  const ladder = params.ladder, tiers = clamp(Math.round(params.tiers) || ladder.length, 1, ladder.length);
  return ladder.slice(0, tiers - 1).concat(ladder[ladder.length - 1]);
}

// Loadout per tier: the melee weapon plus the tier weapon (drawn), or the melee weapon alone on a melee tier.
function ladderLoadouts(ladder, melee) {
  return ladder.map((key) => {
    const weapon = CAT.weapons.byId(key);
    return !weapon || weapon.class === 'melee' || key === melee ? [key] : [melee, key];
  });
}

// ---- M17 Blight: everyone starts human (team 0); after infectAfter s one in infectedPerPlayers becomes infected (team 1:
// infectedHealth HP, melee only, a jump is a leap). A hit does not turn a human: any death after the outbreak does (a kill by
// the infected, a fall, a hazard), so a human who dies comes back infected (the mode row's goal says the same).
// The infected win when no human is left; humans win at the time limit ----
Modes.register('infection', {
  limits: ['time'],
  outbreak: false, meleeLoadout: null,
  start() {
    this.outbreak = false;
    this.meleeLoadout = [meleeWeaponKey()];
    for (let id = 0; id < Actors.count; id++) if (Modes.participant[id]) Actors.team[id] = HUMAN_TEAM;
    this.countSides();
  },
  step(dt, now) {
    const params = Modes.rules.params;
    if (!this.outbreak && now - Modes.startTime + TIME_EPSILON >= params.infectAfter) this.startOutbreak(params);
    for (let id = 0; id < Actors.count; id++) {
      if (Actors.alive[id] && Modes.actorRole[id] === ACTOR_ROLE.INFECTED) holdLoadout(id, this.meleeLoadout);
    }
    this.countSides();
  },
  startOutbreak(params) {
    this.outbreak = true;
    const wanted = Math.max(1, Math.floor(this.countSides() / params.infectedPerPlayers));
    for (let k = 0; k < wanted; k++) {
      const id = randomAliveMember(HUMAN_TEAM, -1);
      if (id >= 0) this.infect(id);
    }
    Modes.announce('The blight spreads', 'objective', 3);
  },
  infect(id) {
    Actors.team[id] = INFECTED_TEAM;
    Modes.setRole(id, ACTOR_ROLE.INFECTED);
    if (Actors.alive[id]) this.applyInfection(id);
  },
  applyInfection(id) {
    setVitality(id, Modes.rules.params.infectedHealth);
    Weapons.setLoadout(id, this.meleeLoadout);
  },
  onSpawn(id) { if (Modes.actorRole[id] === ACTOR_ROLE.INFECTED) this.applyInfection(id); },
  onKill(victim) {
    if (this.outbreak && victim >= 0 && Modes.isActive(victim) && Actors.team[victim] === HUMAN_TEAM) this.infect(victim);
  },
  onJump(event) {
    const id = event.id;
    if (Modes.actorRole[id] !== ACTOR_ROLE.INFECTED) return;
    const params = Modes.rules.params, yaw = Actors.yaw[id];
    emitImpulse(id, Math.sin(yaw) * params.leapSpeed, params.leapLift, Math.cos(yaw) * params.leapSpeed);
  },
  // Team scores hold the head counts (humans, infected); returns the number of participants.
  countSides() {
    let humans = 0, infected = 0;
    for (let id = 0; id < Actors.count; id++) {
      if (!Modes.isActive(id)) continue;
      if (Actors.team[id] === INFECTED_TEAM) infected++; else humans++;
    }
    Modes.teamScore[HUMAN_TEAM] = humans; Modes.teamScore[INFECTED_TEAM] = infected;
    Modes.hud.survivors = humans; Modes.hud.infected = infected;
    return humans + infected;
  },
  livesOver() { return this.outbreak ? Modes.livesWinner() : NOT_OVER; },   // until the outbreak every side is human
  isOver(now) {
    if (this.outbreak && Modes.teamScore[HUMAN_TEAM] === 0) return Modes.over(INFECTED_TEAM, 'eliminated');
    const limit = Modes.rules.timeLimit;
    if (limit > 0 && now - Modes.startTime + TIME_EPSILON >= limit) return Modes.over(HUMAN_TEAM, 'time');
    return NOT_OVER;
  },
  score() { return 0; },   // head counts are not a lead: no leader announcements
});

// ---- M18 Colossus: the first kill makes the killer the Colossus (maxHealth x healthMult, damage x damageMult, marked);
// whoever kills the Colossus becomes it. Only kills as the Colossus score (1 each) ----
Modes.register('juggernaut', {
  colossus: -1,
  start() { this.colossus = -1; },
  step() { if (this.colossus >= 0 && !Modes.isActive(this.colossus)) this.crown(-1); },
  onSpawn(id) { if (id === this.colossus) this.empower(id); },
  onKill(victim, killer) {
    const credited = killer >= 0 && killer !== victim && Modes.isActive(killer);
    if (victim === this.colossus) { this.crown(credited ? killer : -1); return; }
    if (!credited) return;
    if (killer === this.colossus) Modes.awardPlayer(killer, 1, 'kill');
    else if (this.colossus < 0) this.crown(killer);
  },
  crown(id) {
    if (this.colossus >= 0) Modes.setRole(this.colossus, ACTOR_ROLE.NONE);
    this.colossus = id;
    Modes.hud.special = id;
    if (id < 0) return;
    Modes.setRole(id, ACTOR_ROLE.COLOSSUS);
    if (Actors.alive[id]) this.empower(id);   // a killer already dead (a late rocket) is empowered when it respawns
    Modes.announce(Actors.name[id] + ' is the Colossus', 'objective', 3);
  },
  empower(id) { setVitality(id, Actors.maxHealth[id] * Modes.rules.params.healthMult); },
});

// ---- M19 Curse Tag: one cursed actor (cursedHealth HP, no armor or shield, melee only). Killing the cursed scores 1; the
// cursed passes the curse by reaching the beacon (to a random other player; the beacon then moves to the spawn point
// farthest from the new cursed). passOnTag (off by default, custom matches) also passes it by a melee hit (to the one
// hit). Passing restores health and loadout ----
Modes.register('cursetag', {
  cursed: -1, beacon: null, meleeLoadout: null,
  start() {
    this.cursed = -1;
    this.meleeLoadout = [meleeWeaponKey()];
    const spot = centralSpot(spotScratch);
    this.beacon = Modes.addObjective({ id: 'beacon', kind: 'beacon', x: spot.x, y: spot.y, z: spot.z, radius: Modes.rules.params.beaconRadius });
    this.beacon.goals = OBJECTIVE_GOALS.beacon;
  },
  step() {
    if (this.cursed < 0 || !Modes.isActive(this.cursed)) this.curse(randomAliveMember(NO_TEAM, -1));
    const cursed = this.cursed;
    if (cursed < 0 || !Actors.alive[cursed]) return;
    if (Modes.rules.params.meleeOnly) holdLoadout(cursed, this.meleeLoadout);
    // Spawn protection keeps a cursed actor who respawns on the beacon from passing the curse at once.
    if (!(Actors.flags[cursed] & ACTOR_FLAG.PROTECTED) && Modes.inZone(this.beacon, cursed)) this.pass(randomAliveMember(NO_TEAM, cursed));
  },
  onDamage(event) {
    const target = event.target;
    if (!Modes.rules.params.passOnTag || event.source !== this.cursed || event.kind !== 'melee' || target === this.cursed) return;
    if (Actors.alive[target] && Modes.isActive(target)) this.pass(target);
  },
  onKill(victim, killer) {
    if (victim === this.cursed && killer >= 0 && killer !== victim && Modes.isActive(killer)) Modes.awardPlayer(killer, 1, 'kill');
  },
  onSpawn(id) { if (id === this.cursed) this.applyCurse(id); },
  curse(id) {
    this.cursed = id;
    Modes.hud.special = id;
    if (id < 0) return;
    Modes.setRole(id, ACTOR_ROLE.CURSED);
    if (Actors.alive[id]) this.applyCurse(id);
    Modes.announce(Actors.name[id] + ' is cursed', 'objective', 2);
  },
  applyCurse(id) {
    setVitality(id, Modes.rules.params.cursedHealth);
    Actors.armor[id] = 0; Actors.shield[id] = 0;
    if (Modes.rules.params.meleeOnly) Weapons.setLoadout(id, this.meleeLoadout);
  },
  pass(to) {
    const from = this.cursed;
    if (to < 0 || to === from) return;
    Modes.setRole(from, ACTOR_ROLE.NONE);
    if (Actors.alive[from]) { Damage.resetHealth(from); Weapons.giveStartLoadout(from); }
    this.curse(to);
    this.moveBeacon(to);
  },
  moveBeacon(cursed) {
    let best = -1;
    for (const point of Modes.spawnPoints) {
      const distance = length2(point.x - Actors.x[cursed], point.z - Actors.z[cursed]);
      if (distance <= best) continue;
      best = distance;
      this.beacon.x = point.x; this.beacon.y = point.y; this.beacon.z = point.z;
    }
  },
});

// ---- M24 Flame Bearer: the relic rules of 13e with one prize, the flame: its holder scores holdRate points per second on
// top of kills and hits with damageMult (a never-expiring Fury Core, PU19) ----
Modes.register('bearer', makePrizeBehaviour('flame', ACTOR_ROLE.BEARER, '', 'flame'));

// ---- M25 Roulette Arms: everyone carries the same weapon, drawn at random (Rng.rules) from the weapon set every
// rotateEvery s, never the same twice in a row; infiniteAmmo keeps its reserve full ----
Modes.register('roulette', {
  pool: [], loadout: [''], nextAt: 0,
  start() {
    rouletteWeapons(this.pool);
    this.loadout[0] = '';
    this.rotate(Sim.time);
  },
  rotate(now) {
    this.loadout[0] = pickOther(this.pool, this.loadout[0]);
    this.nextAt = now + Modes.rules.params.rotateEvery;
    Modes.hud.weapon = this.loadout[0];
    for (let id = 0; id < Actors.count; id++) if (Actors.alive[id] && Modes.isActive(id)) Weapons.setLoadout(id, this.loadout);
    if (now > Modes.startTime) Modes.announce('Weapon: ' + CAT.weapons.byId(this.loadout[0]).name, 'objective', 2);
  },
  onSpawn(id) { Weapons.setLoadout(id, this.loadout); },
  step(dt, now) {
    if (now + TIME_EPSILON >= this.nextAt) this.rotate(this.nextAt);
    Modes.hud.rotateIn = Math.max(0, this.nextAt - now);
    const infinite = Modes.rules.params.infiniteAmmo;
    for (let id = 0; id < Actors.count; id++) {
      if (!Actors.alive[id] || !Modes.isActive(id)) continue;
      holdLoadout(id, this.loadout);
      if (infinite) refillReserve(id);
    }
  },
});

// The guns of the match weapon set (no melee, tool or power weapon): the Roulette draw and the Last Ring loot (13g).
function rouletteWeapons(out) {
  out.length = 0;
  for (const key of currentWeaponSet().weapons) {
    const weapon = CAT.weapons.byId(key);
    if (weapon && !ROULETTE_EXCLUDED_CLASSES.includes(weapon.class)) out.push(key);
  }
  if (!out.length) out.push(ROULETTE_FALLBACK);
  return out;
}

// A random entry of list other than `current` (the same one only when the list has one entry).
function pickOther(list, current) {
  const at = list.indexOf(current);
  if (at < 0 || list.length < 2) return list[Rng.rules.int(0, list.length - 1)];
  const index = Rng.rules.int(0, list.length - 2);
  return list[index >= at ? index + 1 : index];
}

function refillReserve(id) {
  const weapon = Weapons.currentWeapon(id);
  if (!weapon) return;
  const slot = Weapons.slotIndex(id, weapon.index);
  if (Weapons.reserve[slot] < weapon.reserve) Weapons.reserve[slot] = weapon.reserve;
  if (Weapons.altAmmo[slot] < weapon.altAmmo) Weapons.altAmmo[slot] = weapon.altAmmo;
}

Damage.addAttackerScale(roleDamageScale);
