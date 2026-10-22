// Self-tests for the sim-side wiring between sections (group 'simwire'): every block drives one contract from the
// writer to its reader, so it fails when either end is missing. Difficulty sliders (DIF-002) one reader each, PvE level
// events and the level report, chamber records in the save, bank on Cistern, the royale map ring, ability second press,
// grenade cycling and grenade sounds, bot smoke and ballistic aim, weapon hits on props.

const SIMWIRE_BLOCK_WEAPON = 'W03';           // the block-and-parry weapon
const SIMWIRE_SLIDERS = { preset: 'regular', projectileSpeed: 1.5, resourceYield: 2, checkpointHeal: 0.9 };   // custom values under test (DIF-002 ranges)
const SIMWIRE_DROP_KILLS = 5;                 // kills of a 50% drop row: at resourceYield 2 every one drops
const SIMWIRE_LOW_HEALTH = 10;
const SIMWIRE_SECRET = { kind: 'secret', x: 6, y: 0, z: 6 };
const SIMWIRE_RING = { x: 12, z: -8, radius: 30 };
const SIMWIRE_CHAMBER = 3;

// The speed of the newest flying projectile `owner` launched (0 when none).
function simwireShotSpeed(owner) {
  for (let i = PROJECTILE_CAP - 1; i >= 0; i--) {
    if (Projectiles.state[i] !== PROJECTILE_STATE.FLYING || Projectiles.owner[i] !== owner) continue;
    return Math.hypot(Projectiles.vx[i], Projectiles.vy[i], Projectiles.vz[i]);
  }
  return 0;
}
function simwireDroppedItems() {
  let count = 0;
  for (let slot = 0; slot < PICKUP_CAP; slot++) if (Items.state[slot] !== PICKUP_STATE.FREE && !Items.spot[slot]) count++;
  return count;
}
// The brute's rocket launched once: its speed, and the speed of its weapon row (the slider multiplies it).
function simwireRocketSpeeds(brute) {
  const attack = Pve.rowOf(brute).attackRows[0], mode = CAT.weapons.byId(attack.weapon).primary;
  Projectiles.clear();
  Pve.aimX[brute] = 0; Pve.aimY[brute] = 1; Pve.aimZ[brute] = 0;
  launchProjectile(brute, attack, 0);
  return { shot: simwireShotSpeed(brute), row: mode.speed || CAT.projectiles.byId(mode.projectile).speed };
}

// ---- DIF-002: the damage sliders are applied once (PvE attacker scale), the parry slider scales the W03 window ----
Test.add('simwire', (check) => {
  startPveTest({ difficulty: 'nightmare' });
  const brute = spawnFacing('brute', 2.5), skill = Pve.skill(), info = Damage.info();
  check('playerDamage reaches enemy hits on the party exactly once', Test.near(Damage.attackerScale(brute, 0, info), skill.playerDamage, 1e-6), Damage.attackerScale(brute, 0, info));
  check('enemyDamage reaches party hits on enemies exactly once', Test.near(Damage.attackerScale(0, brute, info), skill.enemyDamage, 1e-6), Damage.attackerScale(0, brute, info));
  const block = CAT.weapons.find((row) => row.code === SIMWIRE_BLOCK_WEAPON).alt;
  Actors.pressed[0] = BTN.ALT;
  WeaponSpecialState.stepBlock(0, block, true, TICK_SECONDS);
  const window = WeaponSpecialState.parryUntil[0] - Sim.time;
  check('the W03 parry window follows the parry slider (nightmare is shorter)', Test.near(window, block.block.parryWindow * skill.parry / DIFFICULTY_PARRY_BASE, 1e-3) && window < block.block.parryWindow, window);
  Actors.pressed[0] = 0;
  Game.stop();
});
Test.add('simwire', (check) => {
  startPveTest({ difficulty: SIMWIRE_SLIDERS });
  const brute = spawnFacing('brute', 2.5), speeds = simwireRocketSpeeds(brute);
  check('projectileSpeed scales the PvE shot speed', Test.near(speeds.shot, speeds.row * SIMWIRE_SLIDERS.projectileSpeed, 1e-3), speeds.shot + ' / ' + speeds.row);
  const row = Pve.rowOf(brute), before = simwireDroppedItems();
  for (let kill = 0; kill < SIMWIRE_DROP_KILLS; kill++) Pve.dropLoot(brute, row, null, Sim.time);
  check('resourceYield 2 makes a 50% drop row drop on every kill', row.dropChance * SIMWIRE_SLIDERS.resourceYield >= 1 && simwireDroppedItems() === before + SIMWIRE_DROP_KILLS, simwireDroppedItems() - before);
  Projectiles.clear();
  Game.stop();
});

// The checkpointHeal slider heals the party at a horde checkpoint (the wave restarts after the core falls).
Test.add('simwire', (check) => withShortShop(() => {
  const ids = startPveMode('horde', [0], {}, { difficulty: SIMWIRE_SLIDERS });
  runUntil(() => Modes.behaviour.run.state === PVE_WAVE_STATE.FIGHT, 10);
  Actors.health[ids[0]] = SIMWIRE_LOW_HEALTH;
  Pve.damageCore(1e6, -1);
  runSeconds(0.1);
  check('a checkpoint heals to checkpointHeal of the health', Actors.health[ids[0]] >= Actors.maxHealth[ids[0]] * SIMWIRE_SLIDERS.checkpointHeal - 1e-3, Actors.health[ids[0]]);
  endModeTest();
}));

// ---- PvE events: wave phases with the MD20 medal, boss fight times, secrets, crates and the level report ----
Test.add('simwire', (check) => withShortShop(() => {
  const ids = startPveMode('horde', [0], {}, { player: { name: 'Tester' } });
  const player = Game.playerId;
  godMode(ids);
  const waves = startEventLog('pve.wave'), medals = startEventLog('medal');
  runUntil(() => waves.some((event) => event.phase === 'end'), 120, () => {
    if (Modes.behaviour.run.state === PVE_WAVE_STATE.FIGHT) killAllEnemies(player);
  });
  waves.stop(); medals.stop();
  check('pve.wave sends phase start, then phase end for the cleared wave', waves.length >= 2 && waves[0].phase === 'start' && waves[0].wave === 1
    && waves.some((event) => event.phase === 'end' && event.wave === 1), waves.map((event) => event.wave + event.phase).join());
  check('MD20 Flawless Wave: an untouched player clearing a wave earns it', medals.some((event) => event.id === player && event.medal === 'flawlessWave'));
  const bosses = startEventLog('pve.boss');
  killEnemy(spawnFacing('overlord', 14), player);
  check('pve.boss defeated carries the fight time; a mid-run boss is not final', bosses.some((event) => event.kind === 'defeated' && event.seconds >= 0 && !event.final)
    && RunLog.bossSeconds < PROGRESS_NEVER && RunLog.finalBossSeconds === PROGRESS_NEVER);
  Modes.behaviour.run.wave = PVE_HORDE_WAVES.length;
  killEnemy(spawnFacing('overlord', 14), player);
  bosses.stop();
  check('the boss of the last wave is final and sets the final boss time', bosses.some((event) => event.kind === 'defeated' && event.final) && RunLog.finalBossSeconds < PROGRESS_NEVER);
  endModeTest();
}));

Test.add('simwire', (check) => withShortShop(() => {
  Settings.set('video.quality', 'high');
  const ids = startPveMode('horde', [0], { navHints: [SIMWIRE_SECRET], props: [propRow(-6, 6)] });
  const secrets = startEventLog('pve.secret'), crates = startEventLog('pve.crate');
  Sim.run(1);
  const hidden = secrets.length === 0;
  Actors.x[ids[0]] = SIMWIRE_SECRET.x; Actors.z[ids[0]] = SIMWIRE_SECRET.z;
  Sim.run(1);
  check('a participant at a secret hint finds it once (pve.secret)', hidden && secrets.length === 1 && secrets[0].id === ids[0] && PveLevel.secretsLeft() === 0);
  Sim.run(1);
  check('a found secret is not found again', secrets.length === 1);
  Props.damage(0, 1000, ids[0]);
  check('a participant breaking a prop sends pve.crate', crates.length === 1 && crates[0].id === ids[0] && crates[0].prop === 0);
  secrets.stop(); crates.stop();
  Modes.finish(Modes.over(coopWinner(), PVE_WIN));
  const report = Game.match.results.pve, metrics = RunLog.measure(Game.match);
  check('match.results.pve reports what the level can measure', report && report.secretsLeft === 0 && report.propsLeft === 0 && report.optionalLeft === undefined, JSON.stringify(report));
  check('the run metrics read the report (card unlocks)', metrics.secretsLeft === 0 && metrics.propsLeft === 0 && metrics.optionalLeft === PROGRESS_NOT_REACHED);
  endModeTest();
}));

// ---- MP11 chamber records in Save.data.progression.chambers (PROGRESS_VERSION 2) ----
Test.add('simwire', (check) => {
  Save.data = Save.migrate(JSON.parse('{"version":1,"progression":{"version":1,"xp":120}}'));
  check('migration: a version 1 profile gains an empty chamber record list', isPlainObject(Progress.profile().chambers) && Progress.profile().xp === 120 && Progress.chamberStars() === 0);
  Bus.emit('pve.chamber', { chamber: SIMWIRE_CHAMBER, kind: 'complete', medal: 'silver', stars: 2, seconds: 41.26 });
  const first = Progress.chamberRecord(SIMWIRE_CHAMBER);
  check('a completed chamber keeps medal, stars and time', first && first.medal === 'silver' && first.stars === 2 && first.seconds === 41.3, JSON.stringify(first));
  Bus.emit('pve.chamber', { chamber: SIMWIRE_CHAMBER, kind: 'complete', medal: 'bronze', stars: 1, seconds: 20 });
  check('a run with fewer stars does not replace the record', Progress.chamberRecord(SIMWIRE_CHAMBER).stars === 2);
  Bus.emit('pve.chamber', { chamber: SIMWIRE_CHAMBER, kind: 'complete', medal: 'silver', stars: 2, seconds: 30 });
  check('as many stars in less time replace it', Progress.chamberRecord(SIMWIRE_CHAMBER).seconds === 30 && Progress.chamberStars() === 2);
  Bus.emit('pve.chamber', { chamber: SIMWIRE_CHAMBER + 1, kind: 'enter', medal: '', stars: 0, seconds: 0 });
  check('entering a chamber records nothing', Progress.chamberRecord(SIMWIRE_CHAMBER + 1) === null);
  Progress.profile().chambers[SIMWIRE_CHAMBER + 1] = null;
  check('a malformed chamber entry of an imported save counts no stars', Progress.chamberStars() === 2);
  Save.data = Save.emptySave();
});

// ---- M23 bank on MP07 Cistern: the map's own bank objectives and team spawns ----
Test.add('simwire', (check) => {
  check('Cistern lists bank mode', Maps.forMode('bank').some((map) => map.id === 'cistern'));
  startModeTest('bank', Maps.get('cistern'), [0, 1]);
  check('bank uses the map banks, one per half', BankRun.banks[0] && BankRun.banks[0].id === 'bankWest' && BankRun.banks[1] && BankRun.banks[1].id === 'bankEast');
  const team0 = Modes.participant.findIndex((on, id) => on && Actors.team[id] === 0);
  check('team 0 spawns in the west half', team0 >= 0 && Actors.x[team0] < 0, team0 >= 0 ? Actors.x[team0] : team0);
  endModeTest();
});

// ---- M20 royale: the ring starts from map.ring when the map has one ----
Test.add('simwire', (check) => {
  startModeTest('royale', modesTestMap({ spawns: FFA_SPAWNS, ring: SIMWIRE_RING }), [-1, -1, -1]);
  check('the ring starts at the map ring', Ring.x === SIMWIRE_RING.x && Ring.z === SIMWIRE_RING.z && Ring.startRadius === SIMWIRE_RING.radius, Ring.x + ' ' + Ring.z + ' ' + Ring.startRadius);
  endModeTest();
});

// ---- Abilities: a second press of the slot button ends a toggle or cancels a channel ----
function simwirePress(id, button) {
  Actors.buttons[id] = button;
  Sim.run(1);
  Actors.buttons[id] = 0;
  Sim.run(1);
}
Test.add('simwire', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'overdrive');
  simwirePress(t.caster, BTN.ABILITY1);
  const on = Abilities.isActive(t.caster, 'overdrive');
  simwirePress(t.caster, BTN.ABILITY1);
  check('toggle: the button turns it on, a second press off', on && !Abilities.isActive(t.caster, 'overdrive'));
  AbilityTest.give(t, 'scoutdrone');
  simwirePress(t.caster, BTN.ABILITY1);
  const channel = Abilities.isActive(t.caster, 'scoutdrone');
  simwirePress(t.caster, BTN.ABILITY1);
  check('channel: a second press cancels it', channel && !Abilities.isActive(t.caster, 'scoutdrone'));
  TestArena.finish();
});

// ---- Grenades: BTN.CYCLE_GRENADE picks the next carried type; bounce sounds name the effect bots flee ----
Test.add('simwire', (check) => {
  GadgetArena.start();
  const id = GadgetArena.actor(0, 0, 0, 'frag', 1);
  Gadgets.give(id, 'smoke', 1);
  const frag = CAT.gadgets.byId('frag').index, smoke = CAT.gadgets.byId('smoke').index;
  const first = Gadgets.grenade[id];
  simwirePress(id, BTN.CYCLE_GRENADE);
  check('the cycle button selects the next carried grenade', first === frag && Gadgets.grenade[id] === smoke);
  simwirePress(id, BTN.CYCLE_GRENADE);
  check('and wraps round to the first', Gadgets.grenade[id] === frag);
  const sounds = startEventLog('sound');
  GadgetArena.throwAfter(id, 0.1);
  runSeconds(1.5);
  sounds.stop();
  const bounce = sounds.find((event) => event.kind === 'grenade');
  check('a grenade bounce sound carries its effect', bounce && bounce.effect === CAT.gadgets.byId('frag').effect, bounce && bounce.effect);
  TestArena.finish();
});

// ---- Bots: H07 smokeVision sees through smoke; X41 ballistics lead and drop ----
Test.add('simwire', (check) => {
  const [bot, dummy] = startBotTest(botTestMap(false));
  Abilities.hero[bot] = CAT.heroes.byId('mirelle');
  placeFacing(bot, 0, -10, 0); placeFacing(dummy, 0, 10, Math.PI);
  Smoke.spawn(CAT.gadgets.byId(SMOKE_ROW), -1, 0, 1, 0);
  runSeconds(1);   // the smoke grows to full size
  const pair = bot * MAX_ACTORS + dummy;
  const throughSmoke = () => BotSense.lineOpen(bot, dummy, pair) && BotSense.lineOpen(bot, dummy, pair);   // head and body rays
  const seer = throughSmoke();
  Abilities.hero[bot] = null;
  check('a smokeVision bot (H07) has an open line through smoke, others do not', seer && !throughSmoke());
  endBotTest();
  const rifle = CAT.weapons.find((row) => row.primary.type === 'hitscan').primary;
  startBotTest(botTestMap(false));
  const instant = BotCombat.leadSpeed(rifle);
  endBotTest();
  startBotTest(botTestMap(false), 'ffa', { mutators: ['ballistics'] });
  check('X41: bots lead hitscan shots at the bullet speed, with drop', instant === 0 && BotCombat.leadSpeed(rifle) === BALLISTIC_ROW.speed
    && BotCombat.dropFor(rifle, 1) === 0.5 * Weapons.ballistics().gravity);
  endBotTest();
});

// ---- Weapons: a hitscan hit damages a prop and the break names the shooter ----
Test.add('simwire', (check) => {
  Settings.set('video.quality', 'high');
  TestArena.start();
  Props.load({ props: [propRow(0, 5)] });
  const shooter = TestArena.actor(0, 0.5, 0, 0), weapon = CAT.weapons.find((row) => row.primary.type === 'hitscan');
  const breaks = startEventLog('world.break');
  Shot.trace(shooter, weapon, weapon.primary, 1000, 0.5, 0.5, 0, 0, 0, 1);
  breaks.stop();
  check('a shot breaks the prop it hits; world.break names the shooter', !Props.isStanding(0) && breaks.length === 1 && breaks[0].source === shooter, breaks.length);
  Props.clear();
  TestArena.finish();
});
