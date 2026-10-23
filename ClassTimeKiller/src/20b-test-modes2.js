// Self-tests for the add-on versus modes (13e objective, 13f party, 13g royale), group 'modes2'. Participants are practice
// dummies moved by setting positions; hits and kills go through the real damage path (Damage.apply) unless a test only
// needs a death (killActor from the 'modes' tests). Helpers modesTestMap, startModeTest, placeActor, runSeconds,
// startEventLog, endModeTest, holdUseFor, FFA_SPAWNS, TEAM_SPAWNS and BOMB_MAP come from 20b-test-modes.js.

const ADDON_MODES = ['rush', 'oddball', 'payload', 'ghostops', 'gungame', 'infection', 'juggernaut', 'cursetag', 'bearer', 'roulette', 'royale'];

// One hit through Damage.apply (kind 'hit' or 'melee'); spawn protection is ended first. Returns the damage dealt.
function hitActor(target, source, amount, kind) {
  Modes.endProtection(target);
  const info = Damage.info();
  info.amount = amount; info.kind = kind || 'hit'; info.zone = 'body';
  return Damage.apply(source, target, info);
}

function damageKill(victim, killer, kind) { return hitActor(victim, killer, 100000, kind); }

// Runs `seconds` of sim while the given actors stand at (x, z) of a moving point (the convoy cart).
function followFor(seconds, ids, point) {
  const steps = Math.round(seconds * TICK_RATE);
  for (let step = 0; step < steps; step++) {
    for (const id of ids) placeActor(id, point.x, point.z);
    Sim.step();
  }
}

// Shapes drawObjective (13b) pushes for one objective.
function countObjectiveMeshes(objective) {
  let meshes = 0;
  drawObjective({ mesh() { meshes++; return 0; } }, objective);
  return meshes;
}

function respawnAll() { runSeconds(Game.match.rules.respawn.delay + 0.05); }

Test.add('modes2', (check) => {
  check('every add-on versus mode is playable', ADDON_MODES.every((id) => Modes.isPlayable(id)));
  const rows = (id) => CAT.modes.byId(id);
  check('rush: 75 tickets, 2 relays x 3 stages (M08)', rows('rush').params.tickets === 75 && rows('rush').params.perStage === 2 && rows('rush').params.stages === 3);
  check('oddball: 1 pt/s, first to 100, carrier melee only (M10)', rows('oddball').params.holdRate === 1 && rows('oddball').scoreLimit === 100 && rows('oddball').params.carrierMeleeOnly);
  const convoy = rows('payload').params;
  check('payload: 1.2 to 1.8 m/s, rollback after 10 s, 3 checkpoints, 4:00 + 2:00 (M11)', convoy.speed === 1.2 && convoy.maxSpeed === 1.8 && convoy.rollbackAfter === 10
    && convoy.checkpoints === 3 && rows('payload').timeLimit === 240 && convoy.checkpointTime === 120 && Test.near(convoy.speed * (1 + 2 * convoy.pushStack), convoy.maxSpeed, 1e-9));
  check('gungame: a 14-weapon ladder by default, the last one melee (M16, fun-04)', rows('gungame').params.ladder.length === 14 && !rows('gungame').params.tiers
    && CAT.weapons.byId(GUNGAME_LADDER[13]).class === 'melee' && GUNGAME_LADDER.every((key) => CAT.weapons.byId(key)));
  check('infection: 1 per 6, after 20 s, 450 HP, 5 min (M17)', rows('infection').params.infectedPerPlayers === 6
    && rows('infection').params.infectAfter === 20 && rows('infection').params.infectedHealth === 450 && rows('infection').timeLimit === 300);
  check('juggernaut: x3 HP, x1.5 damage, 15 to win (M18)', rows('juggernaut').params.healthMult === 3 && rows('juggernaut').params.damageMult === 1.5 && rows('juggernaut').scoreLimit === 15);
  check('cursetag: 50 HP, melee only, the beacon passes the curse (M19)', rows('cursetag').params.cursedHealth === 50 && rows('cursetag').params.meleeOnly
    && rows('cursetag').params.passOnTag === false);
  const shortLadder = ladderTiers({ ladder: GUNGAME_LADDER, tiers: 3 });
  check('gungame: params.tiers shortens the ladder, keeping the melee tier last', shortLadder.join() === 'tempest,vanguard,maul'
    && ladderTiers({ ladder: GUNGAME_LADDER, tiers: 99 }).length === 14 && ladderTiers({ ladder: GUNGAME_LADDER }).length === 14
    && ladderTiers({ ladder: GUNGAME_LADDER, tiers: 1 }).join() === 'maul');
  const area = worldSafeArea({});
  check('worldSafeArea: the fallback without world bounds', Number.isFinite(World.boundsMin.x) || (area.x === 0 && area.z === 0 && area.radius === SAFE_AREA_FALLBACK_RADIUS));
  const ring = rows('royale').params;
  check('royale: 18 actors, 6 ring phases with the spec timings (M20)', rows('royale').sizeDefault === 18 && ring.ringWait.join() === '30,25,25,20,15,10'
    && ring.ringShrink.join() === '30,25,20,20,15,15' && ring.ringDamage.join() === '2,4,8,12,16,20' && ring.ringScale.length === 6 && rows('royale').respawn === 'none');
  check('royale: RS10 bundle (agile, loot shields, loot set with rarity)', rows('royale').ruleset === 'royale' && CAT.weaponSets.byId(Rules.build({ mode: 'royale' }).weaponSet).rarity);
  check('royale: shield by armor rarity 50/75/100/125 (HPP06)', ring.shieldByRarity.slice(0, 4).join() === '50,75,100,125' && ring.rarityWeights.length === WEAPON_RARITY_DAMAGE.length);
  check('bearer: 1 pt/s, x3 damage, first to 120 (M24)', rows('bearer').params.holdRate === 1 && rows('bearer').params.damageMult === 3 && rows('bearer').scoreLimit === 120);
  check('roulette: rotates every 30 s, infinite ammo, no pickups (M25)', rows('roulette').params.rotateEvery === 30 && rows('roulette').params.infiniteAmmo && rows('roulette').params.pickups === false);
  check('ghostops: bomb timers, melee + pistol attackers (M27)', ['tanto', 'warden'].every((key) => rows('ghostops').params.attackerLoadout.includes(key))
    && CAT.weapons.byId('warden').class === 'sidearm' && rows('ghostops').params.plantTime === 4 && rows('ghostops').rounds.winsNeeded === 7);
  check('hud has the add-on fields', Object.keys(MODE_HUD_EXTRAS).every((key) => key in Modes.hudState()));
  check('payload path maths', (() => {
    const path = [[0, 0, 0], [3, 0, 4], [3, 0, 10]], lengths = pathLengths(path), point = pointOnPath(path, lengths, 7, {});
    return lengths[2] === 11 && point.x === 3 && point.z === 6 && checkpointDistances([1], lengths, 3).join() === '5,11' && checkpointDistances(null, lengths, 2).join() === '5.5,11';
  })());
});

// ---- M08 Breach Assault ----
const RUSH_MAP = { spawns: TEAM_SPAWNS, objectives: [
  { id: 'r1a', kind: 'bombsite', team: 1, x: 20, y: 0, z: -10, radius: 4, stage: 1 }, { id: 'r1b', kind: 'bombsite', team: 1, x: 20, y: 0, z: 10, radius: 4, stage: 1 },
  { id: 'r2a', kind: 'bombsite', team: 1, x: 35, y: 0, z: -10, radius: 4, stage: 2 }, { id: 'r2b', kind: 'bombsite', team: 1, x: 35, y: 0, z: 10, radius: 4, stage: 2 },
] };

function armRelay(attacker, relay) {
  placeActor(attacker, relay.x, relay.z);
  holdUseFor(attacker, Modes.rules.params.plantTime + 0.02);
}

Test.add('modes2', (check) => {
  const blasts = startEventLog('explosion'), announcements = startEventLog('announce');
  startModeTest('rush', modesTestMap(RUSH_MAP), [0, 1]);
  const [r1a, r1b, r2a, r2b] = Modes.objectives;
  check('rush: attackers start with 75 tickets', Modes.teamScore[0] === 75 && Modes.attackingTeam() === 0);
  check('rush: only stage 1 is open', r1a.active && r1b.active && !r2a.active && !r2b.active && Modes.hudState().stage === 1 && Modes.hud.stages === 2);
  check('rush: bots read arm / defend goals', Modes.goalFor(r1a, 0) === 'arm' && Modes.goalFor(r1a, 1) === 'defend' && Modes.goalFor(r2a, 0) === '');
  placeActor(0, r1a.x, r1a.z);
  holdUseFor(0, 3.9);
  check('rush: not armed before 4 s', r1a.state === 'home');
  Sim.step();
  check('rush: releasing USE loses the arming progress', r1a.timer === 0);
  armRelay(0, r1a);
  check('rush: armed after 4 s held in the relay zone', r1a.state === 'planted' && Modes.objective[0] === 1 && Modes.goalFor(r1a, 1) === 'disarm');
  placeActor(1, r1a.x + 1, r1a.z);
  holdUseFor(1, 4.9);
  check('rush: not disarmed before 5 s', r1a.state === 'planted');
  Sim.step();
  check('rush: an interrupted disarm starts over', r1a.timer === 0);
  holdUseFor(1, 5.02);
  check('rush: disarmed after 5 s; the relay can be armed again', r1a.state === 'home' && Modes.objective[1] === 1 && Modes.goalFor(r1a, 0) === 'arm');
  placeActor(1, -40, 0);
  armRelay(0, r1a);
  runSeconds(29.5);
  check('rush: the fuse burns 30 s', r1a.state === 'planted');
  runSeconds(0.6);
  check('rush: the relay is destroyed after the fuse', r1a.state === 'detonated' && blasts.length === 1 && blasts[0].radius === 15);
  armRelay(0, r1b);
  runSeconds(30.1);
  check('rush: both relays destroyed open stage 2', r2a.active && r2b.active && !r1a.active && Modes.hud.stage === 2);
  damageKill(0, 1);
  check('rush: an attacker death costs a ticket', Modes.teamScore[0] === 74);
  respawnAll();
  armRelay(0, r2a); runSeconds(30.1);
  armRelay(0, r2b); runSeconds(30.1);
  check('rush: the last stage destroyed wins for the attackers', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'objective');
  check('rush: no stage past the last one is announced or shown', Modes.hud.stage === 2 && announcements.some((event) => event.text === 'Stage 2')
    && !announcements.some((event) => event.text === 'Stage 3'));
  blasts.stop(); announcements.stop();
  endModeTest();
  // The ticket cost of a death is the mode param, as in Frontline (modes-07).
  startModeTest('rush', modesTestMap(RUSH_MAP), [0, 1], { modeOptions: { params: { deathCost: 3 } } });
  damageKill(0, 1);
  check('rush: params.deathCost sets the tickets an attacker death costs', Modes.teamScore[0] === 72, Modes.teamScore[0]);
  endModeTest();

  startModeTest('rush', modesTestMap(RUSH_MAP), [0, 1], { modeOptions: { params: { tickets: 1 } } });
  armRelay(0, Modes.objectives[0]);
  damageKill(0, 1);
  Sim.step();
  check('rush: out of tickets with a relay armed: the match goes on', !Game.match.ended && Modes.teamScore[0] === 0);
  placeActor(1, Modes.objectives[0].x, Modes.objectives[0].z);
  holdUseFor(1, 5.02);
  Sim.step();
  check('rush: then disarming it wins for the defenders', Game.match.ended && Game.match.winner === 1 && Game.match.results.reason === 'tickets');
  endModeTest();
});

// ---- M10 Relic Run ----
const RELIC_MAP = { spawns: FFA_SPAWNS, objectives: [{ id: 'relic', kind: 'relic', x: 0, y: 0, z: 0, radius: 1 }] };

Test.add('modes2', (check) => {
  startModeTest('oddball', modesTestMap(RELIC_MAP), [-1, -1, -1]);
  const relic = Modes.objectives[0];
  check('oddball: the relic waits at home', relic.state === 'home' && relic.carrier === -1);
  Modes.endProtection(0);
  placeActor(0, 0, 0);
  Sim.step();
  check('oddball: touching the relic picks it up', relic.state === 'carried' && relic.carrier === 0 && Modes.actorRole[0] === ACTOR_ROLE.CARRIER && Modes.hud.special === 0);
  check('oddball: goals hold / take', Modes.goalFor(relic, 0) === 'hold' && Modes.goalFor(relic, 1) === 'take');
  Sim.step();
  check('oddball: the carrier fights with melee only', Weapons.currentWeapon(0).class === 'melee' && !Weapons.has(0, 'warden'));
  Weapons.give(0, 'scattergun', 0); Weapons.current[0] = CAT.weapons.byId('scattergun').index;
  Sim.step();
  check('oddball: drawing a gun puts the melee loadout back', !Weapons.has(0, 'scattergun') && Weapons.currentWeapon(0).class === 'melee');
  const before = Modes.score[0];
  runSeconds(10);
  check('oddball: 1 point per second held', Modes.score[0] - before === 10, Modes.score[0] - before);
  placeActor(0, 10, 5);
  Sim.step();
  damageKill(0, 1);
  check('oddball: kills score nothing', Modes.score[1] === 0 && Modes.kills[1] === 1);
  Sim.step();
  check('oddball: the relic drops where the carrier died', relic.state === 'dropped' && Test.near(relic.x, 10, 0.01) && Modes.actorRole[0] === ACTOR_ROLE.NONE && Modes.hud.special === -1);
  runSeconds(29.9);
  check('oddball: dropped relic stays 30 s', relic.state === 'dropped');
  runSeconds(0.2);
  check('oddball: then returns home', relic.state === 'home' && relic.x === 0);
  endModeTest();

  startModeTest('oddball', modesTestMap(RELIC_MAP), [-1, -1], { modeOptions: { scoreLimit: 5 } });
  placeActor(0, 0, 0);
  Actors.flags[0] |= ACTOR_FLAG.PROTECTED;
  Sim.step();
  check('oddball: a spawn-protected actor does not take the relic', Modes.objectives[0].state === 'home');
  placeActor(0, 30, 30);
  placeActor(1, 0, 0);
  Modes.endProtection(1);
  runSeconds(5.05);
  check('oddball: the first to the score limit wins', Game.match.ended && Game.match.winner === 1 && Game.match.results.reason === 'score');
  endModeTest();
});

// ---- M11 Convoy ----
const CONVOY_MAP = { spawns: TEAM_SPAWNS, objectives: [
  { id: 'cart', kind: 'payloadPath', team: 0, x: -20, y: 0, z: 0, radius: 3, checkpoints: [1, 2], path: [[-20, 0, 0], [0, 0, 0], [20, 0, 0]] },
] };

Test.add('modes2', (check) => {
  startModeTest('payload', modesTestMap(CONVOY_MAP), [0, 0, 0, 1, 1], { modeOptions: { timeLimit: 60, params: { checkpointTime: 30 } } });
  const cart = Modes.objectives[0], behaviour = Modes.behaviour;
  check('payload: the cart starts at the path start', cart.x === -20 && Modes.hud.payloadCheckpoints === 2 && Modes.goalFor(cart, 0) === 'escort' && Modes.goalFor(cart, 3) === 'stop');
  followFor(5, [0], cart);
  check('payload: one attacker pushes at 1.2 m/s', Test.near(behaviour.distance, 6, 0.05) && Modes.hud.payloadState === 'moving', behaviour.distance);
  let at = behaviour.distance;
  followFor(2, [0, 1], cart);
  check('payload: two attackers push at 1.5 m/s', Test.near(behaviour.distance - at, 3, 0.05), behaviour.distance - at);
  at = behaviour.distance;
  followFor(2, [0, 1, 2], cart);
  check('payload: three attackers push at the 1.8 m/s cap', Test.near(behaviour.distance - at, 3.6, 0.05), behaviour.distance - at);
  at = behaviour.distance;
  followFor(3, [0, 3], cart);
  check('payload: a defender at the cart stops it (contested)', behaviour.distance === at && Modes.hud.payloadState === 'contested');
  for (const id of [0, 1, 2, 3]) placeActor(id, -45, 20);
  runSeconds(9.9);
  check('payload: no rollback for 10 s', behaviour.distance === at && Modes.hud.payloadState === 'idle');
  runSeconds(2.1);
  check('payload: then it rolls back at 0.5 m/s', Test.near(at - behaviour.distance, 1, 0.05) && Modes.hud.payloadState === 'rollback', at - behaviour.distance);
  const timeBefore = Modes.hudState().timeLeft;
  followFor(9, [0, 1, 2], cart);
  check('payload: a checkpoint adds 30 s to the clock', Modes.hud.payloadCheckpoint === 1 && Test.near(Modes.hudState().timeLeft - timeBefore, 30 - 9, 0.05) && Modes.teamScore[0] === 1,
    Modes.hudState().timeLeft - timeBefore);
  for (const id of [0, 1, 2]) placeActor(id, -45, 20);
  runSeconds(30);
  check('payload: rollback stops at the last checkpoint', Test.near(behaviour.distance, 20, 1e-6), behaviour.distance);
  followFor(12, [0, 1, 2], cart);
  check('payload: the cart at the end wins for the attackers', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'objective');
  endModeTest();

  startModeTest('payload', modesTestMap(CONVOY_MAP), [0, 1], { modeOptions: { timeLimit: 10 } });
  const slowCart = Modes.objectives[0];
  followFor(10.05, [0], slowCart);
  check('payload: an attacker at the cart at the time limit means overtime', !Game.match.ended && Modes.overtime);
  placeActor(0, -45, 20);
  Sim.step(); Sim.step();
  check('payload: leaving the cart in overtime loses', Game.match.ended && Game.match.winner === 1 && Game.match.results.reason === 'overtime');
  endModeTest();

  startModeTest('payload', modesTestMap(CONVOY_MAP), [0, 1], { modeOptions: { timeLimit: 10 } });
  runSeconds(10.05);
  check('payload: the clock runs out without the cart: defenders win', Game.match.ended && Game.match.winner === 1 && Game.match.results.reason === 'time');
  endModeTest();

  // Time warnings count the checkpoint time too (R-131): 90 s + 60 s from checkpoint 1.
  const warnings = startEventLog('announce');
  startModeTest('payload', modesTestMap(CONVOY_MAP), [0, 0, 1], { modeOptions: { timeLimit: 90, params: { checkpointTime: 60 } } });
  followFor(15, [0, 1], Modes.objectives[0]);
  for (const id of [0, 1]) placeActor(id, -45, 20);
  const minuteWarnings = () => warnings.filter((event) => event.text === '1 minute remaining').length;
  runSeconds(40 - Sim.time);
  check('payload: no "1 minute" warning while 110 s are left', Modes.hud.payloadCheckpoint === 1 && minuteWarnings() === 0 && Modes.timeLeft(Sim.time) > 100, Modes.timeLeft(Sim.time));
  runSeconds(91 - Sim.time);
  check('payload: the warning comes with 1 minute really left', minuteWarnings() === 1 && Test.near(Modes.timeLeft(Sim.time), 59, 0.1), Modes.timeLeft(Sim.time));
  warnings.stop();
  endModeTest();

  startModeTest('payload', modesTestMap({ spawns: TEAM_SPAWNS }), [0, 1]);
  check('payload: a map without a path keeps nothing from the last convoy', Modes.behaviour.reached === 0 && Modes.behaviour.total === 0 && Modes.behaviour.score(0) === 0);
  endModeTest();
});

// ---- M27 Ghost Ops ----
Test.add('modes2', (check) => {
  startModeTest('ghostops', modesTestMap(BOMB_MAP), [0, 1], { modeOptions: { rounds: { freeze: 1, endDelay: 1, live: 60, winsNeeded: 1 } } });
  runSeconds(1.01);
  const charge = Modes.objectives[1];
  check('ghostops: attackers are ghosts, defenders are not', Modes.actorRole[0] === ACTOR_ROLE.GHOST && Modes.actorRole[1] === ACTOR_ROLE.NONE && charge.carrier === 0);
  const site = Modes.objectives[0];
  check('ghostops: bots read arm / defend on the sites before the plant', Modes.goalFor(site, 0) === 'arm' && Modes.goalFor(site, 1) === 'defend' && Modes.goalFor(charge, 0) === '');
  check('ghostops: attackers carry melee + pistol only', Weapons.has(0, 'tanto') && Weapons.has(0, 'warden') && Weapons.currentWeapon(0).id === 'warden');
  Weapons.give(0, 'vanguard', 0); Weapons.current[0] = CAT.weapons.byId('vanguard').index;
  Sim.step();
  check('ghostops: drawing a rifle puts the attacker loadout back', !Weapons.has(0, 'vanguard'));
  check('ghostops: a still attacker is cloaked, a defender never', (Actors.flags[0] & ACTOR_FLAG.INVISIBLE) !== 0 && (Actors.flags[1] & ACTOR_FLAG.INVISIBLE) === 0);
  check('ghostops: the carried charge hides with its cloaked carrier', countObjectiveMeshes(charge) === 0);
  Actors.vx[0] = 3;
  Modes.behaviour.stepGhosts(Sim.time);
  check('ghostops: a moving attacker is visible', (Actors.flags[0] & ACTOR_FLAG.INVISIBLE) === 0);
  check('ghostops: a visible carrier shows the charge', countObjectiveMeshes(charge) === 1);
  Actors.vx[0] = 0;
  Bus.emit('weapon.fire', { id: 0 });
  runSeconds(0.9);
  check('ghostops: firing reveals the attacker for 1 s', (Actors.flags[0] & ACTOR_FLAG.INVISIBLE) === 0);
  runSeconds(0.2);
  check('ghostops: then the still attacker cloaks again', (Actors.flags[0] & ACTOR_FLAG.INVISIBLE) !== 0);
  placeActor(0, 20, 0);
  holdUseFor(0, 4.05);
  check('ghostops: the bomb rules plant the charge', charge.state === 'planted');
  Sim.step();
  check('ghostops: after the plant bots read guard / disarm on the charge', Modes.goalFor(charge, 0) === 'guard' && Modes.goalFor(charge, 1) === 'disarm' && Modes.goalFor(site, 0) === '');
  runSeconds(40.1);
  check('ghostops: detonation wins the round and the match', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'rounds');
  endModeTest();
});

// ---- M16 Arms Ladder ----
Test.add('modes2', (check) => {
  startModeTest('gungame', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1]);
  const ladder = Modes.behaviour.ladder, last = ladder.length - 1;
  check('gungame: everyone starts on tier 1 with its weapon and the melee weapon', [0, 1, 2].every((id) => Weapons.currentWeapon(id).id === ladder[0] && Weapons.has(id, 'maul'))
    && Modes.hud.ladderTiers === GUNGAME_LADDER.length);
  damageKill(1, 0);
  check('gungame: a kill advances one tier and swaps the weapon', Modes.behaviour.score(0) === 1 && Weapons.currentWeapon(0).id === ladder[1] && !Weapons.has(0, ladder[0]) && Modes.score[0] === 1);
  respawnAll();
  damageKill(2, 1); respawnAll();
  damageKill(2, 1); respawnAll();
  check('gungame: the victim respawns on its own tier', Weapons.currentWeapon(1).id === ladder[2] && Modes.behaviour.score(1) === 2);
  damageKill(1, 2, 'melee');
  check('gungame: a melee kill demotes the victim and advances the killer', Modes.behaviour.score(1) === 1 && Modes.behaviour.score(2) === 1 && Modes.score[1] === 1);
  respawnAll();
  check('gungame: the demoted victim respawns one tier lower', Weapons.currentWeapon(1).id === ladder[1]);
  damageKill(2, 0, 'melee');
  check('gungame: a melee kill on tier 1 cannot demote further', Modes.behaviour.score(0) === 2);
  for (let k = 0; k < last - 2; k++) killActor(2, 0);
  respawnAll();
  check('gungame: the last tier is melee only', Modes.behaviour.score(0) === last && Weapons.currentWeapon(0).class === 'melee' && Weapons.currentWeapon(0).id === ladder[last]);
  damageKill(1, 0);
  Sim.step();
  check('gungame: a last-tier kill that is not melee does not win', !Game.match.ended && Modes.behaviour.score(0) === last);
  respawnAll();
  damageKill(1, 0, 'melee');
  Sim.step();
  check('gungame: the last-tier melee kill wins', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'score');
  endModeTest();

  startModeTest('gungame', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1], { modeOptions: { params: { tiers: 3 } } });
  check('gungame: a 3-tier ladder (custom match)', Modes.hud.ladderTiers === 3 && Weapons.currentWeapon(0).id === GUNGAME_LADDER[0]);
  killActor(1, 0); respawnAll();
  killActor(1, 0); respawnAll();
  check('gungame: its third tier is the melee weapon', Weapons.currentWeapon(0).id === 'maul' && Modes.behaviour.score(0) === 2);
  damageKill(1, 0, 'melee');
  Sim.step();
  check('gungame: a melee kill on it wins', Game.match.ended && Game.match.winner === 0);
  endModeTest();
  // Pacing probe (fun-04): with 18 tiers, 8 bots on gantry ran out of time or into sudden death on every seed.
  const run = DebugApi.soak('gungame', 'gantry', 11, 7, 1, {});
  check('gungame pacing: 8 bots finish the ladder in normal time', run.reason === 'score' && run.seconds < 600, run.reason + ' ' + run.seconds);
});

// ---- M17 Blight ----
Test.add('modes2', (check) => {
  const impulses = startEventLog('impulse');
  startModeTest('infection', modesTestMap({ spawns: FFA_SPAWNS }), [0, 1, 0, 1, 0, 1]);
  const ids = [0, 1, 2, 3, 4, 5];
  check('infection: everyone starts human', ids.every((id) => Actors.team[id] === HUMAN_TEAM) && Modes.hud.survivors === 6 && Modes.hud.infected === 0);
  runSeconds(19.9);
  check('infection: nobody is infected before 20 s', Modes.hud.infected === 0);
  runSeconds(0.2);
  const first = ids.find((id) => Actors.team[id] === INFECTED_TEAM);
  check('infection: one infected per 6 players at 20 s', Modes.hud.infected === 1 && Modes.hud.survivors === 5 && Modes.actorRole[first] === ACTOR_ROLE.INFECTED);
  const infectedHealth = Modes.rules.params.infectedHealth;
  check('infection: the infected is tough and melee only', Actors.maxHealth[first] === infectedHealth && Weapons.currentWeapon(first).class === 'melee');
  const human = ids.find((id) => Actors.team[id] === HUMAN_TEAM);
  hitActor(human, first, 30, 'melee');
  const stillHuman = Actors.team[human] === HUMAN_TEAM;
  damageKill(human, first, 'melee');
  check('infection: only a kill turns a human (modes-02), scoring 1', stillHuman && Actors.team[human] === INFECTED_TEAM && Modes.score[first] === 1);
  const victim = ids.find((id) => Actors.team[id] === HUMAN_TEAM);
  damageKill(victim, -1);
  check('infection: a human who dies joins the infected', Actors.team[victim] === INFECTED_TEAM);
  respawnAll();
  check('infection: and comes back infected', Actors.alive[victim] && Actors.health[victim] === infectedHealth && Weapons.currentWeapon(victim).class === 'melee');
  Bus.emit('move.jump', { id: first, speed: 0, surface: '' });
  const leap = impulses.find((event) => event.id === first);
  check('infection: an infected jump is a leap', leap && Test.near(Math.hypot(leap.x, leap.z), 8, 1e-4) && leap.y === 3);
  for (const id of ids) if (Actors.team[id] === HUMAN_TEAM) damageKill(id, first, 'melee');
  Sim.step();
  check('infection: the infected win when no human is left', Game.match.ended && Game.match.winner === INFECTED_TEAM && Game.match.results.reason === 'eliminated');
  impulses.stop();
  endModeTest();

  startModeTest('infection', modesTestMap({ spawns: FFA_SPAWNS }), [0, 0, 0], { modeOptions: { timeLimit: 30 } });
  runSeconds(30.05);
  check('infection: humans standing at the time limit win', Game.match.ended && Game.match.winner === HUMAN_TEAM && Game.match.results.reason === 'time');
  endModeTest();
  // Balance probe (modes-02): with one hit converting, the infected wiped 12 bots in 51-133 s on every seed. Now the humans hold well into the match.
  const soak = DebugApi.soak('infection', 'spire', 5.5, 11, 2, {});
  check('infection balance: a bot match on spire lasts past 3 minutes', soak.seconds > 180, soak.seconds);
});

// ---- M18 Colossus ----
Test.add('modes2', (check) => {
  startModeTest('juggernaut', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1], { modeOptions: { scoreLimit: 2 } });
  runSeconds(2);
  check('juggernaut: a normal hit deals its damage', hitActor(2, 1, 10) === 10);
  damageKill(1, 0);
  check('juggernaut: the first kill makes the Colossus (x3 health)', Modes.actorRole[0] === ACTOR_ROLE.COLOSSUS && Actors.health[0] === 300 && Actors.maxHealth[0] === 300 && Modes.hud.special === 0);
  check('juggernaut: kills before the Colossus score nothing', Modes.score[0] === 0);
  check('juggernaut: the Colossus deals x1.5 damage', hitActor(2, 0, 10) === 15);
  respawnAll();
  damageKill(2, 1);
  check('juggernaut: kills by others score nothing', Modes.score[1] === 0 && Modes.actorRole[1] === ACTOR_ROLE.NONE);
  respawnAll();
  damageKill(0, 2);
  check('juggernaut: killing the Colossus takes the role', Modes.actorRole[2] === ACTOR_ROLE.COLOSSUS && Modes.actorRole[0] === ACTOR_ROLE.NONE && Actors.health[2] === 300 && Modes.score[2] === 0);
  respawnAll();
  check('juggernaut: the old Colossus respawns with normal health', Actors.health[0] === 100 && Actors.maxHealth[0] === 100);
  damageKill(0, 2); respawnAll();
  check('juggernaut: each Colossus kill scores 1', Modes.score[2] === 1);
  damageKill(1, 2);
  Sim.step();
  check('juggernaut: first to the score limit wins', Game.match.ended && Game.match.winner === 2 && Game.match.results.reason === 'score');
  endModeTest();

  startModeTest('juggernaut', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1]);
  runSeconds(2);
  killActor(0, -1);
  damageKill(1, 0);   // a late rocket: its shooter is already dead
  check('juggernaut: a dead killer is crowned', Modes.actorRole[0] === ACTOR_ROLE.COLOSSUS && Modes.behaviour.colossus === 0 && !Actors.alive[0]);
  respawnAll();
  check('juggernaut: and respawns with the Colossus health', Actors.alive[0] && Actors.health[0] === 300 && Actors.maxHealth[0] === 300);
  endModeTest();
});

// ---- M19 Curse Tag ----
Test.add('modes2', (check) => {
  startModeTest('cursetag', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1], { modeOptions: { scoreLimit: 2 } });
  Sim.step();
  const behaviour = Modes.behaviour, beacon = Modes.objectives[0];
  const cursed = behaviour.cursed, other = cursed === 0 ? 1 : 0, third = 3 - cursed - other;
  check('cursetag: one actor is cursed (50 HP, melee only)', cursed >= 0 && Modes.actorRole[cursed] === ACTOR_ROLE.CURSED && Actors.health[cursed] === 50 && Actors.maxHealth[cursed] === 50
    && Weapons.currentWeapon(cursed).class === 'melee');
  check('cursetag: the beacon is the cursed one\'s goal', beacon.kind === 'beacon' && Modes.goalFor(beacon, cursed) === 'reach' && Modes.goalFor(beacon, other) === '');
  runSeconds(2);
  damageKill(third, other);
  check('cursetag: killing someone else scores nothing', Modes.score[other] === 0);
  damageKill(cursed, other);
  check('cursetag: killing the cursed scores 1', Modes.score[other] === 1 && behaviour.cursed === cursed);
  respawnAll();
  check('cursetag: the cursed respawns still cursed', Actors.alive[cursed] && Actors.health[cursed] === 50);
  hitActor(other, cursed, 10, 'melee');
  check('cursetag: a melee hit does not pass the curse (the beacon does)', behaviour.cursed === cursed && Modes.actorRole[other] === ACTOR_ROLE.NONE);
  Modes.endProtection(cursed);
  placeActor(cursed, beacon.x, beacon.z);
  Sim.step();
  const next = behaviour.cursed;
  check('cursetag: reaching the beacon passes the curse to someone else', next !== cursed && next >= 0 && Modes.actorRole[cursed] === ACTOR_ROLE.NONE
    && Actors.health[next] === 50 && Actors.health[cursed] === 100 && Weapons.currentWeapon(cursed).class !== 'melee');
  const farthest = Math.max(...Modes.spawnPoints.map((point) => Math.hypot(point.x - Actors.x[next], point.z - Actors.z[next])));
  check('cursetag: the beacon moves to the spawn farthest from the new cursed', Test.near(Math.hypot(beacon.x - Actors.x[next], beacon.z - Actors.z[next]), farthest, 1e-4));
  const killer = next === other ? third : other;
  runSeconds(2);
  damageKill(next, killer);
  Sim.step();
  check('cursetag: first to the score limit wins', Game.match.ended && Game.match.winner === killer && Game.match.results.reason === 'score', killer);
  endModeTest();

  startModeTest('cursetag', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1], { modeOptions: { params: { passOnTag: true } } });
  Sim.step();
  const tagger = Modes.behaviour.cursed, tagged = 1 - tagger;
  hitActor(tagged, tagger, 10, 'melee');
  check('cursetag: with passOnTag a melee hit passes the curse', Modes.behaviour.cursed === tagged && Actors.health[tagged] === 50 && Actors.alive[tagged]
    && Modes.actorRole[tagger] === ACTOR_ROLE.NONE && Actors.health[tagger] === 100);
  endModeTest();
});

// ---- M24 Flame Bearer ----
Test.add('modes2', (check) => {
  startModeTest('bearer', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1], { modeOptions: { scoreLimit: 8 } });
  const flame = Modes.objectives[0];
  [0, 1, 2].forEach((id) => placeActor(id, 10 * id - 10, 20));   // away from the flame (it lies on a spawn point)
  check('bearer: the flame lies at the most central spawn', flame.id === 'flame' && flame.kind === 'relic' && FFA_SPAWNS.some((spawn) => spawn.x === flame.x && spawn.z === flame.z));
  runSeconds(2);
  placeActor(1, flame.x, flame.z);
  Sim.step();
  check('bearer: touching the flame makes the bearer', Modes.actorRole[1] === ACTOR_ROLE.BEARER && flame.carrier === 1);
  check('bearer: the bearer hits x3 (never-expiring Fury Core)', hitActor(2, 1, 10) === 30 && hitActor(1, 2, 10) === 10);
  check('bearer: the bearer keeps its guns', Weapons.currentWeapon(1).class !== 'melee');
  runSeconds(5);
  check('bearer: 1 point per second held', Modes.score[1] === 5, Modes.score[1]);
  damageKill(2, 1);
  check('bearer: kills score too', Modes.score[1] === 6);
  respawnAll();
  runSeconds(0.1);
  check('bearer: first to the score limit wins', Game.match.ended && Game.match.winner === 1 && Game.match.results.reason === 'score');
  endModeTest();
});

// ---- M25 Roulette Arms ----
Test.add('modes2', (check) => {
  startModeTest('roulette', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1], { modeOptions: { scoreLimit: 2 } });
  const first = Modes.hud.weapon, pool = rouletteWeapons([]);
  check('roulette: everyone has the same weapon and nothing else', [0, 1, 2].every((id) => Weapons.currentWeapon(id).id === first && !Weapons.has(id, 'maul')) && pool.includes(first));
  check('roulette: no melee, tool or power weapon in the draw', pool.every((key) => !ROULETTE_EXCLUDED_CLASSES.includes(CAT.weapons.byId(key).class)) && pool.length > 2);
  const weapon = CAT.weapons.byId(first), slot = Weapons.slotIndex(0, weapon.index);
  Weapons.reserve[slot] = 0;
  Sim.step();
  check('roulette: infinite ammo keeps the reserve full', Weapons.reserve[slot] === weapon.reserve);
  runSeconds(29.9);
  check('roulette: the weapon holds for 30 s', Modes.hud.weapon === first && Test.near(Modes.hud.rotateIn, 0.1, 0.02));
  runSeconds(0.2);
  const second = Modes.hud.weapon;
  check('roulette: then everyone gets a new one, never the same twice', second !== first && [0, 1, 2].every((id) => Weapons.currentWeapon(id).id === second && !Weapons.has(id, first)));
  damageKill(1, 0); respawnAll();
  check('roulette: respawns carry the current weapon', Weapons.currentWeapon(1).id === second);
  damageKill(2, 0);
  Sim.step();
  check('roulette: kills to the limit win', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'score');
  endModeTest();
  check('pickOther never repeats', Array.from({ length: 20 }, () => pickOther(['a', 'b'], 'a')).every((key) => key === 'b') && pickOther(['a'], 'a') === 'a');
});

// ---- M20 Last Ring ----
const ROYALE_ITEMS = [
  { x: 10, y: 0, z: 10, item: 'warden', group: 'weapon' }, { x: 12, y: 0, z: 10, item: 'lightplate', group: 'armor' },
  { x: 14, y: 0, z: 10, item: 'healthpack', group: 'health' }, { x: 16, y: 0, z: 10, item: 'ammobox', group: 'ammo' },
  { x: 18, y: 0, z: 10, item: 'fury', group: 'power' },
];

Test.add('modes2', (check) => {
  const hazards = startEventLog('damage.request');
  startModeTest('royale', modesTestMap({ spawns: FFA_SPAWNS, items: ROYALE_ITEMS }), [-1, -1, -1]);
  const params = Game.match.rules.params, start = Ring.startRadius;
  check('royale: the ring starts around the whole world', Test.near(start, Math.hypot(120, 120) / 2, 1e-6) && Ring.state === 'wait' && Modes.hudState().ringPhase === 1 && Modes.hud.ringPhases === 6);
  check('royale: the next circle lies inside the ring', Math.hypot(Ring.toX - Ring.x, Ring.toZ - Ring.z) + Ring.toRadius <= Ring.radius + 1e-6 && Test.near(Ring.toRadius, start * params.ringScale[0], 1e-6));
  check('royale: no respawns', Game.match.rules.respawnMode === 'none');
  runSeconds(29.9);
  check('royale: the ring waits 30 s', Ring.radius === start && Test.near(Modes.hud.ringTimeLeft, 0.1, 0.02));
  runSeconds(15.1);
  check('royale: then shrinks over 30 s', Ring.state === 'shrink' && Test.near(Ring.radius, lerp(start, start * params.ringScale[0], 0.5), 0.1), Ring.radius);
  runSeconds(15.05);
  check('royale: phase 2 starts at the planned circle', Ring.phase === 1 && Ring.state === 'wait' && Test.near(Ring.radius, start * params.ringScale[0], 1e-6) && Ring.damage === 4);
  hazards.length = 0;
  for (const id of [0, 1, 2]) { placeActor(id, Ring.x, Ring.z); Actors.alive[id] = 1; }
  placeActor(2, Ring.x + Ring.radius + 5, Ring.z);
  runSeconds(3);
  check('royale: outside the ring hurts ringDamage HP each second', hazards.length === 3 && hazards.every((event) => event.target === 2 && event.amount === 4 && event.kind === 'hazard'), hazards.length);
  hazards.stop();
  endModeTest();

  startModeTest('royale', modesTestMap({ spawns: FFA_SPAWNS, items: ROYALE_ITEMS }), [-1, -1]);
  check('royale: loot spots from the weapon, armor, health and ammo items', RoyaleLoot.count === 4 && RoyaleLoot.weapon[0] === CAT.weapons.byId('warden').index);
  const drawn = () => { propBatch.clear(); drawRoyale(propBatch); const count = batchInstances(propBatch); propBatch.clear(); return count; };
  const withGun = drawn();
  RoyaleLoot.taken[0] = 1;
  const gun = withGun - drawn();
  RoyaleLoot.taken[0] = 0;
  check('royale: a weapon spot draws the gun model and a rarity ring, not a box', gun > 2, gun);
  runSeconds(2);
  const rarity = RoyaleLoot.rarity[0];
  Actors.flags[0] |= ACTOR_FLAG.DOWNED; Damage.downedTime[0] = DOWNED_BLEED_SECONDS;
  placeActor(0, 10, 10); runSeconds(0.2);
  check('royale: a downed actor takes no loot (HP-007)', RoyaleLoot.taken[0] === 0);
  Actors.flags[0] &= ~ACTOR_FLAG.DOWNED;
  runSeconds(0.2);
  check('royale: a weapon spot gives its weapon with its rarity (WPN-008)', Weapons.has(0, 'warden') && Weapons.rarity[Weapons.slotIndex(0, CAT.weapons.byId('warden').index)] === rarity && RoyaleLoot.taken[0] === 1);
  placeActor(0, 14, 10); runSeconds(0.2);
  const consumable = CAT.items.byId(LOOT_CONSUMABLES[RoyaleLoot.rarity[2]]);
  check('royale: a health spot gives the I13-I17 consumable of its rarity to carry', RoyaleLoot.taken[2] === 1 && Items.carriedCount(0, consumable.id) === 1, consumable.id);
  hitActor(0, 1, 60);
  const hurt = Actors.health[0] + Actors.shield[0];
  Actors.buttons[0] = BTN.HEAL; runSeconds(0.05); Actors.buttons[0] = 0;
  runSeconds(consumable.useTime + 0.1);
  check('royale: the heal button uses the carried consumable', Actors.health[0] + Actors.shield[0] > hurt && Items.carriedCount(0, consumable.id) === 0, Actors.health[0] + Actors.shield[0]);
  placeActor(0, 12, 10); runSeconds(0.2);
  check('royale: armor sets the shield by its rarity', Actors.shield[0] === params.shieldByRarity[RoyaleLoot.rarity[1]] && RoyaleLoot.taken[1] === 1);
  const warden = CAT.weapons.byId('warden'), wardenSlot = Weapons.slotIndex(0, warden.index);
  Weapons.reserve[wardenSlot] = 0;
  placeActor(0, 16, 10); runSeconds(0.2);
  check('royale: ammo stays on the spot while a melee weapon is drawn', Weapons.currentWeapon(0).ammoType === '' && RoyaleLoot.taken[3] === 0);
  Weapons.requestSwitch(0, warden.index);
  runSeconds(warden.equipTime + 0.2);
  check('royale: ammo tops up the drawn weapon', RoyaleLoot.taken[3] === 1 && Weapons.reserve[wardenSlot] > 0, Weapons.reserve[wardenSlot]);
  damageKill(1, 0);
  Sim.step();
  check('royale: the last one standing wins', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'eliminated');
  endModeTest();

  startModeTest('royale', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1],
    { modeOptions: { params: { ringWait: [1, 1], ringShrink: [1, 1], ringScale: [0.3, 0.02], ringDamage: [40, 80] } } });
  followFor(4.05, [0, 1, 2], Ring);
  check('royale: after the last phase the ring stays closed', Ring.state === 'closed' && Test.near(Ring.radius, 0.02 * Ring.startRadius, 1e-6) && Ring.damage === 80 && Modes.hud.ringTimeLeft === 0);
  damageKill(1, 0);
  followFor(3, [0, 2], Ring);
  check('royale: the dead never respawn', !Actors.alive[1] && Modes.respawnIn(1, Sim.time) === -1 && Modes.hud.aliveCount === 2);
  placeActor(2, -55, -55);
  for (let step = 0; step < 4 * TICK_RATE && !Game.match.ended; step++) { placeActor(0, Ring.x, Ring.z); Sim.step(); }
  check('royale: only the one inside survives and wins', Game.match.ended && Game.match.winner === 0 && Game.match.results.reason === 'eliminated');
  check('royale: placement ranks the standing first, then later deaths', Modes.behaviour.score(0) > Math.max(Modes.behaviour.score(1), Modes.behaviour.score(2)) && Modes.behaviour.score(1) !== Modes.behaviour.score(2));
  endModeTest();

  // A lone competitor (Play with 0 bots) plays on until it falls; then the match ends instead of running forever (modes-01).
  startModeTest('royale', modesTestMap({ spawns: FFA_SPAWNS }), [-1]);
  runSeconds(1);
  const goesOn = !Game.match.ended;
  damageKill(0, -1, 'hazard');
  runSeconds(0.1);
  check('royale alone: goes on while the lone actor stands, then ends as a loss', goesOn && Game.match.ended && Game.match.results.lost);
  endModeTest();

  World.load(modesTestMap({ spawns: FFA_SPAWNS }));
  Game.start({ mode: 'royale', seed: 1, bots: Array.from({ length: 30 }, () => ({ dummy: true })) });
  check('royale: the bot count stays within the PERF-009 cap', Actors.count === Quality.current().bots && Actors.count <= 23);
  endModeTest();
});

// M20 squads: round-robin squads, a shared drop-in, one respawn beacon per squad, and the last squad standing wins.
Test.add('modes2', (check) => {
  startModeTest('royale', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1, -1, -1, -1]);
  const squads = Modes.squads, params = Game.match.rules.params;
  Move.setPreset(0, 'tactical'); Modes.endProtection(0);   // MOV-015 fall damage (lethal above 22 m/s); firing ends protection
  check('royale: six actors make two squads of three', squads.count === 2 && [0, 1, 0, 1, 0, 1].every((team, id) => Actors.team[id] === team)
    && !Actors.isEnemy(0, 2) && Actors.isEnemy(0, 1) && Game.match.rules.teams === 0);
  const viewer = Game.playerId;
  Game.playerId = 1;   // a player in squad 1
  const ownColor = Hud.teamColor(1) === Hud.colors.teams[0] && Hud.teamColor(0) === Hud.colors.teams[1];
  Game.playerId = viewer;
  check('royale: the player\'s own squad has the own-team HUD colour, whatever its index', ownColor);
  check('royale: squads drop in together from above', Actors.y[0] >= ROYALE_DROP_HEIGHT - 1 && Math.hypot(Actors.x[2] - Actors.x[0], Actors.z[2] - Actors.z[0]) <= DROP_SPREAD + 1e-3
    && Math.hypot(Actors.x[1] - Actors.x[0], Actors.z[1] - Actors.z[0]) > DROP_SPREAD * 2, Actors.y[0]);
  runSeconds(3);
  check('royale: the drop lands on the ground', Actors.y[0] < 0.5 && Actors.alive[0] === 1, Actors.y[0]);
  check('royale: the drop-in takes no fall damage, even with MOV-015 falls', Actors.health[0] === Actors.maxHealth[0] && Move.safeLanding[0] === 0, Actors.health[0]);
  Move.setPreset(0, null);
  killActor(2, 1); killActor(4, 1);
  Actors.alive[2] = 0; Actors.alive[4] = 0;
  placeActor(0, squads.beaconX[0], squads.beaconZ[0]);
  Actors.buttons[0] = BTN.USE;
  runSeconds(BEACON_SECONDS - 1);
  Actors.buttons[0] = 0;
  runSeconds(0.3);
  Actors.buttons[0] = BTN.USE;
  runSeconds(BEACON_SECONDS - 1);
  check('royale: letting go of Use at the beacon starts over', !Actors.alive[2] && squads.beaconUses[0] === params.squadBeacons);
  runSeconds(1.2);
  Actors.buttons[0] = 0;
  check('royale: holding Use at the squad beacon brings the dead squadmates back', Actors.alive[2] === 1 && Actors.alive[4] === 1 && squads.beaconUses[0] === params.squadBeacons - 1
    && Math.hypot(Actors.x[2] - squads.beaconX[0], Actors.z[2] - squads.beaconZ[0]) <= DROP_SPREAD + 1e-3 && Modes.behaviour.score(2) >= ROYALE_STANDING_RANK);
  killActor(1, 0); killActor(3, 0);
  Sim.step();
  check('royale: one squad member left keeps the squad in the match', !Game.match.ended && Modes.hud.aliveCount === 4);
  killActor(5, 0);
  Sim.step();
  check('royale: the last squad standing wins', Game.match.ended && Actors.team[Game.match.winner] === 0 && Game.match.results.reason === 'eliminated');
  endModeTest();

  startModeTest('royale', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1]);
  check('royale: a match of one squad or fewer plays solo', Modes.squads.count === 0 && Actors.team[0] === NO_TEAM && Actors.isEnemy(0, 1));
  endModeTest();
});

// Royale weapon spots: owned copies and swaps at the carry limit keep the loot's rarity.
const ROYALE_WEAPON_ITEMS = [
  { x: 10, y: 0, z: 10, item: 'kestrel', group: 'weapon' }, { x: 20, y: 0, z: 10, item: 'kestrel', group: 'weapon' },
  { x: 30, y: 0, z: 10, item: 'vanguard', group: 'weapon' },
];

Test.add('modes2', (check) => {
  startModeTest('royale', modesTestMap({ spawns: FFA_SPAWNS, items: ROYALE_WEAPON_ITEMS }), [-1, -1]);
  runSeconds(2);
  const kestrel = CAT.weapons.byId('kestrel'), slot = Weapons.slotIndex(0, kestrel.index);
  placeActor(0, 10, 10); runSeconds(0.2);
  Weapons.reserve[slot] = Weapons.maxReserve(0, kestrel);
  Weapons.rarity[slot] = 0;
  RoyaleLoot.rarity[1] = 4;
  placeActor(0, 20, 10); runSeconds(0.2);
  check('royale: a copy of an owned gun stays on the spot while the reserve is full', RoyaleLoot.taken[1] === 0 && Weapons.rarity[slot] === 0);
  Weapons.reserve[slot] = 0;
  runSeconds(0.2);
  check('royale: it is taken for its ammo and the better rarity is kept', RoyaleLoot.taken[1] === 1 && Weapons.reserve[slot] > 0 && Weapons.rarity[slot] === 4);
  for (const key of ['verdict', 'hush', 'wasp', 'hornet']) Weapons.give(0, key, 1);
  Weapons.current[0] = CAT.weapons.byId('tanto').index;
  const pushedOut = Weapons.firstCarried(0);
  Weapons.rarity[Weapons.slotIndex(0, pushedOut)] = 3;
  placeActor(0, 30, 10);
  runSeconds(0.2);
  check('royale: a full inventory leaves a new gun on the spot without USE', Weapons.atCarryLimit(0) && RoyaleLoot.weapon[2] === CAT.weapons.byId('vanguard').index && !Weapons.has(0, 'vanguard'));
  holdUseFor(0, 0.2);
  check('royale: with USE held the gun pushed out lies on the spot with its own rarity', Weapons.has(0, 'vanguard') && RoyaleLoot.weapon[2] === pushedOut
    && RoyaleLoot.rarity[2] === 3 && RoyaleLoot.taken[2] === 0, RoyaleLoot.rarity[2]);
  endModeTest();
});

// The placeholder island MP09 runs a full-size royale: 18 actors (capped by quality), 48 loot spots, the ring around the island.
Test.add('modes2', (check) => {
  Game.start({ mode: 'royale', map: 'isle', seed: 3, player: { name: 'Tester' }, bots: Modes.defaultBots('royale', true).map(() => ({ dummy: true })) });
  check('royale on MP09: the island is loaded', World.map && World.map.id === 'isle');
  check('royale on MP09: participants within the cap', Modes.countParticipants() === Math.min(18, Quality.current().bots + 1));
  check('royale on MP09: 48 loot spots', RoyaleLoot.count === 48 && Array.from(RoyaleLoot.rarity.subarray(0, 48)).every((value) => value <= 4));
  check('royale on MP09: the ring covers the island', Ring.startRadius > Math.hypot(150, 150));
  runSeconds(5);
  check('royale on MP09: everyone is still standing after 5 s', Modes.active && Modes.hud.aliveCount === Modes.countParticipants());
  Game.stop();
});

// Every add-on mode runs 60 s headless with dummies on a test map without errors or a premature end.
Test.add('modes2', (check) => {
  const maps = { rush: RUSH_MAP, oddball: RELIC_MAP, payload: CONVOY_MAP, ghostops: BOMB_MAP };
  for (const id of ADDON_MODES) {
    const teams = CAT.modes.byId(id).teams === TEAM_COUNT ? [0, 1, 0, 1] : [-1, -1, -1, -1];
    startModeTest(id, modesTestMap(maps[id] || { spawns: FFA_SPAWNS }), teams);
    runSeconds(60);
    check('mode ' + id + ' runs 60 s headless', Modes.active && !Game.match.ended, Modes.phase);
    endModeTest();
  }
});

// PERF-002: the game rules stay within 0.2 ms per step with a full royale on the island.
Test.add('modes2', (check) => {
  Game.start({ mode: 'royale', map: 'isle', seed: 5, bots: Modes.defaultBots('royale', false).map(() => ({ dummy: true })) });
  runSeconds(1);
  let total = 0;
  const steps = 2 * TICK_RATE;
  for (let step = 0; step < steps; step++) { Sim.step(); total += Sim.timing.rules; }
  check('royale rules step within the PERF-002 budget (0.2 ms)', total / steps < 0.2, (total / steps).toFixed(4) + ' ms');
  Game.stop();
});

// The player's own role and ladder tier reach the HUD; ghost roles follow the side switch.
Test.add('modes2', (check) => {
  World.load(modesTestMap({ spawns: FFA_SPAWNS }));
  Game.start({ mode: 'juggernaut', seed: 1, player: { name: 'Tester' }, bots: [{ dummy: true }, { dummy: true }] });
  runSeconds(2);
  damageKill(1, Game.playerId);
  check("hud: the player's role", Modes.hudState().role === 'colossus' && Modes.hud.special === Game.playerId);
  endModeTest();

  World.load(modesTestMap({ spawns: FFA_SPAWNS }));
  Game.start({ mode: 'gungame', seed: 1, player: { name: 'Tester' }, bots: [{ dummy: true }] });
  runSeconds(2);
  damageKill(1, Game.playerId);
  check("hud: the player's ladder tier", Modes.hudState().ladderTier === 2 && Modes.hud.ladderTiers === GUNGAME_LADDER.length);
  endModeTest();

  startModeTest('ghostops', modesTestMap(BOMB_MAP), [0, 1], { modeOptions: { rounds: { freeze: 1, endDelay: 1, live: 5, switchAt: 1, winsNeeded: 3 } } });
  runSeconds(1.01);
  check('ghostops: team 0 are the ghosts in round 1', Modes.actorRole[0] === ACTOR_ROLE.GHOST && Modes.actorRole[1] === ACTOR_ROLE.NONE);
  runSeconds(7.1);
  check('ghostops: after the side switch team 1 are the ghosts', Modes.swapped && Modes.round === 2 && Modes.actorRole[1] === ACTOR_ROLE.GHOST && Modes.actorRole[0] === ACTOR_ROLE.NONE
    && Weapons.currentWeapon(1).id === 'warden' && (Actors.flags[0] & ACTOR_FLAG.INVISIBLE) === 0);
  endModeTest();
});

// The shared helpers of the mode timers (intervalDue on any owner), the zone damage and the active-participant count.
Test.add('modes2', (check) => {
  const owner = { timer: 0 };
  let fired = 0;
  for (let step = 0; step < 10; step++) if (intervalDue(owner, 'timer', 0.25, 1)) fired++;
  check('intervalDue: fires once per interval on any owner and key, keeping the remainder', fired === 2 && Test.near(owner.timer, 0.5, 1e-9), fired + ' ' + owner.timer);
  const hazards = startEventLog('damage.request');
  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [0, 0], {});
  runSeconds(1.01);
  placeActor(0, 0, 0); placeActor(1, 20, 0); placeActor(2, 0, 0);
  hazards.length = 0;
  hurtOutsideZone(0, 0, 10, 7);
  check('hurtOutsideZone: hurts only the actors beyond the radius', hazards.length === 1 && hazards[0].target === 1 && hazards[0].amount === 7 && hazards[0].kind === 'hazard');
  check('countActive: in-play participants, never above countParticipants', Modes.countActive() === Actors.count && Modes.countActive() <= Modes.countParticipants(), Modes.countActive() + ' ' + Actors.count);
  hazards.stop();
  endModeTest();
});

// ---- Mode x rules combinations (R-138): every mode under X32 lives, fixed sides ----
// One map with every objective kind the modes below need.
const COMBO_MAP = { spawns: TEAM_SPAWNS, objectives: CTF_MAP.objectives.concat(RUSH_MAP.objectives, CONVOY_MAP.objectives, RELIC_MAP.objectives,
  [{ id: 'pointWest', kind: 'point', x: 0, y: 0, z: -30, radius: 5 }, { id: 'pointEast', kind: 'point', x: 0, y: 0, z: 30, radius: 5 }, { id: 'hill1', kind: 'hill', x: 0, y: 0, z: 0 }]) };
const ONE_LIFE = [{ id: 'lives', value: 1 }];
// Versus modes with respawns and without rounds (Blight counts lives only from its outbreak: checked on its own below).
const LIVES_MODES = CAT.modes.filter((row) => row.family === 'versus' && !row.rounds && row.respawn === 'normal' && row.id !== 'infection').map((row) => row.id);

// Kills every participant on `team` (free-for-all: everyone but actor 0) and reports whether the match ended within 1 s.
function wipeOut(team) {
  for (let id = 1; id < Actors.count; id++) if (Modes.participant[id] && (team === NO_TEAM || Actors.team[id] === team)) killActor(id, 0);
  for (let step = 0; step < TICK_RATE && !Game.match.ended; step++) Sim.step();
  return Game.match.ended;
}

Test.add('modes2', (check) => {
  for (const id of LIVES_MODES) {
    const teams = CAT.modes.byId(id).teams === TEAM_COUNT ? [0, 1, 0, 1] : [-1, -1, -1];
    startModeTest(id, modesTestMap(COMBO_MAP), teams, { mutators: ONE_LIFE });
    runSeconds(1.01);
    const ended = wipeOut(teams[0] === 0 ? 1 : NO_TEAM);
    check('lives 1: ' + id + ' ends within 1 s of a wipe-out', ended && Game.match.winner === 0 && Game.match.results.reason === 'eliminated', Game.match.results && Game.match.results.reason);
    endModeTest();
  }
  startModeTest('rush', modesTestMap(RUSH_MAP), [0, 1, 0, 1], { mutators: ONE_LIFE });
  armRelay(0, Modes.objectives[0]);
  placeActor(1, -40, 0); placeActor(3, -40, 5);
  check('lives 1: rush attackers out with a relay armed: the match goes on', !wipeOutAttackers() && Modes.objectives[0].state === 'planted');
  runSeconds(Modes.rules.params.fuse);
  check('lives 1: the relay goes off, then the defenders win (out of lives counts like 0 tickets)', Game.match.ended && Game.match.winner === 1, Game.match.results && Game.match.results.reason);
  endModeTest();
  // Blight converts the dead, so lives would only end it when the few first infected fall: X32 is not offered there (modes-03).
  startModeTest('infection', modesTestMap(COMBO_MAP), [0, 1, 0, 1], { mutators: ONE_LIFE });
  const livesOff = Modes.rules.lives === 0 && !Mutators.fitsMode(Mutators.row('lives'), CAT.modes.byId('infection'));
  runSeconds(Modes.rules.params.infectAfter + 1.01);
  for (const id of sideMembers(INFECTED_TEAM)) killActor(id, sideMembers(HUMAN_TEAM)[0]);
  runSeconds(1);
  check('lives: not offered in infection, which goes on after the first infected fall', livesOff && !Game.match.ended);
  endModeTest();
});
function sideMembers(team) { return Array.from({ length: Actors.count }, (unused, id) => id).filter((id) => Modes.participant[id] && Actors.team[id] === team); }
function wipeOutAttackers() {
  for (let id = 0; id < Actors.count; id++) if (Actors.team[id] === 0) killActor(id, 1);
  runSeconds(1);
  return Game.match.ended;
}

// M26: auto-balance never touches modes that set their sides themselves (params.fixedSides), round after round.
Test.add('modes2', (check) => {
  World.load(modesTestMap({ spawns: TEAM_SPAWNS }));
  Game.start({ mode: 'fiends', seed: 1, player: { name: 'Tester' }, bots: [{ dummy: true }, { dummy: true }, { dummy: true }, { dummy: true }],
    modeOptions: { rounds: { freeze: 1, endDelay: 1 } } });
  const ravagers = () => Array.from({ length: Actors.count }, (unused, id) => id).filter((id) => Modes.participant[id] && Actors.team[id] === 0 && Actors.maxHealth[id] === 175);
  check('fiends 1 vs 4: one 175 HP Ravager in round 1', ravagers().length === 1 && Modes.teamSize(0) === 1, ravagers().join());
  runSeconds(1.01);
  for (let id = 0; id < Actors.count; id++) if (Modes.participant[id] && Actors.team[id] === 1) killActor(id, ravagers()[0]);
  runSeconds(2.1);
  check('fiends 1 vs 4: still one Ravager in round 2', Modes.round === 2 && ravagers().length === 1 && Modes.teamSize(0) === 1, Modes.round + ' ' + ravagers().join());
  endModeTest();
});
