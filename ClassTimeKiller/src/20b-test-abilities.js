// Self-tests for S12 abilities: the framework (cooldowns, charges, energy, fuel, souls, the match meters, groups,
// interrupts, cleanup on death and at match end), one cast-and-effect check per CAT.abilities row (A01..A40, AX1..AX7)
// and the hero kits H01..H08 (pools, weapons, movement). Actors stand on TestArena's floor facing +z.

DebugApi.abilities = { abilities: Abilities, meters: Meters, zones: AbilityZones };   // __CTK.abilities

const ENEMY_DISTANCE = 6;

// The slot of the newest footprint an actor left (A16: every actor has its own ring).
function lastPrint(id) { return id * FOOTPRINT_RING + (Footprints.next[id] + FOOTPRINT_RING - 1) % FOOTPRINT_RING; }

const AbilityTest = {
  // caster (team 0) at the origin facing +z, an enemy 6 m ahead, a second enemy beside it, an ally behind the caster.
  start(rules) {
    TestArena.start(Object.assign({ meter: 'energy' }, rules));
    const caster = TestArena.actor(0, 0, 0, 0), enemy = TestArena.actor(1, 0, ENEMY_DISTANCE, Math.PI);
    const second = TestArena.actor(1, 1.5, ENEMY_DISTANCE + 1, Math.PI), ally = TestArena.actor(0, 2, -2, 0);
    return { caster, enemy, second, ally, row: null, slot: SLOT.ABILITY1, i: 0 };
  },
  // Puts the row in the test slot with every resource full.
  give(t, abilityId, slot) {
    t.row = CAT.abilities.byId(abilityId);
    t.slot = slot === undefined ? SLOT.ABILITY1 : slot;
    t.i = Abilities.index(t.caster, t.slot);
    Abilities.setSlot(t.caster, t.slot, t.row);
    Meters.energy[t.caster] = Meters.energyMax();
    Meters.points[t.caster] = Meters.max();
    return t;
  },
  cast(t) {
    if (t.row.activation === 'hold') Actors.buttons[t.caster] |= SLOT_BUTTONS[t.slot];
    return Abilities.tryActivate(t.caster, t.slot);
  },
  // The resource the row uses was taken exactly once (ABL-002).
  paid(t, pointsBefore) {
    const row = t.row;
    if (row.resource === 'cooldown') return Abilities.cooldown[t.i] === row.cooldown;
    if (row.resource === 'charges') return Abilities.charges[t.i] === row.charges - 1;
    if (row.resource === 'energy') return Test.near(Meters.energy[t.caster], Meters.energyMax() - row.cost, 1e-4);
    if (row.resource === 'ultimate') return Test.near(Meters.points[t.caster], pointsBefore - Meters.ultimateCost(row), 1e-3);
    if (row.resource === 'souls') return Powerups.souls[t.caster] === 0;
    return true;
  },
  zoneOf(t, kind) { return AbilityZones.find(kind, t.caster); },
  distance(a, b) { return Math.hypot(Actors.x[a] - Actors.x[b], Actors.z[a] - Actors.z[b]); },
  clearPath(t) { TestArena.place(t.enemy, 30, -30); TestArena.place(t.second, -30, -30); },
};

// One case per ability row: rules, setup before the cast, seconds to run after it, and the effect check.
// Ultimate-resource rows run with the ultimate meter so the exact point cost is visible.
const ABILITY_CASES = {
  bulwark: { rules: { health: 'suit' }, seconds: 0.1, expect: (t) => Buffs.get(t.caster, BUFF.ENERGY_REGEN) === 2 && Abilities.active[t.i] === 1 },
  overdrive: { seconds: 1, expect: (t) => Buffs.get(t.caster, BUFF.SPEED) === 1 && Meters.energy[t.caster] === Meters.energyMax() },   // off while not sprinting
  colossusweave: {
    seconds: 0.1,
    expect: (t) => {
      Actors.vy[t.caster] = 4;
      Bus.emit('move.jump', { id: t.caster, speed: 0, surface: '' });
      return Buffs.get(t.caster, BUFF.MELEE) === 2 && Test.near(Meters.energy[t.caster], Meters.energyMax() - 15, 1e-4) && Test.near(Actors.vy[t.caster], 4 * Math.sqrt(1.8), 1e-4);
    },
  },
  phantasm: { seconds: 1, expect: (t) => Buffs.has(t.caster, BUFF.INVISIBLE) && Test.near(Meters.energy[t.caster], Meters.energyMax() - 2, 0.05) },
  shadowstep: { setup: AbilityTest.clearPath, seconds: 0, expect: (t) => Actors.z[t.caster] > 8 && Buffs.has(t.caster, BUFF.NO_FIRE) },
  phaseslip: { seconds: 0.1, expect: (t) => { TestArena.hit(t.enemy, t.caster, 50); return Actors.health[t.caster] === 100; } },
  grapnel: { setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 1, expect: (t) => AbilityTest.distance(t.caster, t.enemy) < ENEMY_DISTANCE - 2 },
  surge: { setup: AbilityTest.clearPath, seconds: 0, expect: (t) => Actors.z[t.caster] > 5 },
  rewind: {
    setup: (t) => { Sim.run(Math.round(1.2 * TICK_RATE)); TestArena.place(t.caster, 5, 0); Sim.run(3 * TICK_RATE); TestArena.hit(t.enemy, t.caster, 50); },
    seconds: 0, expect: (t) => Math.abs(Actors.x[t.caster]) < 0.5 && Actors.health[t.caster] === 100,
  },
  updraft: { seconds: 1, expect: (t) => Actors.y[t.caster] > 1 && AbilityTest.zoneOf(t, ZONE_KIND.LIFT) >= 0 },
  glidepack: {
    setup: (t) => { Actors.y[t.caster] = 20; Motion.grounded[t.caster] = 0; Actors.flags[t.caster] &= ~ACTOR_FLAG.ON_GROUND; },
    seconds: 0.5, expect: (t) => Actors.vy[t.caster] > -2 && Test.near(Abilities.fuel[t.i], 2.5, 0.02),
  },
  relocator: {
    setup: AbilityTest.clearPath, seconds: 0.1,
    expect: (t) => {
      const beacon = AbilityTest.zoneOf(t, ZONE_KIND.BEACON), x = AbilityZones.x[beacon], z = AbilityZones.z[beacon];
      TestArena.place(t.caster, -10, -10);
      const teleported = Abilities.tryActivate(t.caster, t.slot);
      return beacon >= 0 && teleported && Test.near(Actors.x[t.caster], x, 0.01) && Test.near(Actors.z[t.caster], z, 0.01) && Abilities.charges[t.i] === 4;
    },
  },
  echopulse: { seconds: 0.1, expect: (t) => Damage.hasStatus(t.enemy, 'reveal') },
  huntersight: { seconds: 1, expect: (t) => Damage.hasStatus(t.enemy, 'reveal') && Test.near(Meters.energy[t.caster], Meters.energyMax() - 5, 0.05) },
  scoutdrone: {
    seconds: 0.5,
    expect: (t) => {
      const flying = AbilityTest.zoneOf(t, ZONE_KIND.DRONE) >= 0 && Buffs.has(t.caster, BUFF.NO_FIRE);
      TestArena.hit(t.enemy, t.caster, 5);
      return flying && !Abilities.active[t.i] && AbilityTest.zoneOf(t, ZONE_KIND.DRONE) < 0;   // damage ends the channel
    },
  },
  tracker: {
    seconds: 1,
    expect: (t) => {
      Footprints.clear();
      Bus.emit('move.step', { id: t.enemy, speed: 4, surface: '' });
      Bus.emit('move.step', { id: t.ally, speed: 4, surface: '' });
      const enemyPrint = lastPrint(t.enemy), allyPrint = lastPrint(t.ally);
      const fresh = footprintVisible(t.caster, enemyPrint) && !footprintVisible(t.caster, allyPrint) && !footprintVisible(t.enemy, enemyPrint);
      runSeconds(8.1);
      return Abilities.active[t.i] === 1 && fresh && !footprintVisible(t.caster, enemyPrint);   // enemy prints only, for 8 s
    },
  },
  veil: { seconds: 0.1, expect: (t) => AbilityTest.zoneOf(t, ZONE_KIND.SMOKE) >= 0 && AbilityZones.radius[AbilityTest.zoneOf(t, ZONE_KIND.SMOKE)] === 6 },
  fence: {
    setup: AbilityTest.clearPath, seconds: 0.1,
    expect: (t) => {
      const first = AbilityTest.zoneOf(t, ZONE_KIND.FENCE);
      Actors.yaw[t.caster] = Actors.aimYaw[t.caster] = 0.5;
      Abilities.tryActivate(t.caster, t.slot);
      return first >= 0 && newestZone(ZONE_KIND.FENCE, t.caster) !== first && AbilityZones.other[newestZone(ZONE_KIND.FENCE, t.caster)] === first;
    },
  },
  timebend: { seconds: 0.1, expect: (t) => Test.near(Move.statusSpeedScale[t.enemy], 0.25, 1e-4) && Move.statusSpeedScale[t.caster] === 1
    && Test.near(Weapons.rateScale[t.enemy], 0.25, 1e-4) && Weapons.rateScale[t.caster] === 1 },   // ABL-004: fire rate slows too
  gale: { setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 0, expect: (t) => Actors.vz[t.enemy] > 5 },
  binding: {
    setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 0,
    expect: (t) => { TestArena.hit(t.caster, t.enemy, 30); return Actors.health[t.second] === 70; },
  },
  mesmer: { seconds: 0.1, expect: (t) => Damage.hasStatus(t.enemy, 'sleep') && Damage.hasStatus(t.second, 'sleep') },
  puppet: {
    rules: { family: 'pve' },
    setup: (t) => { Actors.kind[t.enemy] = ACTOR_KIND.ENEMY; Actors.profile[t.enemy] = { fodder: true }; TestArena.aimAt(t.caster, t.enemy); },
    seconds: 0.1, expect: (t) => Actors.team[t.enemy] === 0,
  },
  frenzy: {
    setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 8.1,
    expect: (t) => Actors.team[t.enemy] === 1 && AbilityTest.zoneOf(t, ZONE_KIND.SWAP) < 0,   // restored after 8 s
  },
  mender: { setup: (t) => { Actors.health[t.ally] = 50; }, seconds: 1, expect: (t) => Test.near(Actors.health[t.ally], 70, 0.5) },
  aegisdome: {
    seconds: 0.1,
    expect: (t) => { killActor(t.caster, t.enemy); return AbilityTest.zoneOf(t, ZONE_KIND.DOME) >= 0; },   // persists after the owner dies
  },
  secondwind: { setup: (t) => { Actors.flags[t.ally] |= ACTOR_FLAG.DOWNED; }, seconds: 0, expect: (t) => !(Actors.flags[t.ally] & ACTOR_FLAG.DOWNED) },
  ampwall: { seconds: 0.1, expect: (t) => { const wall = AbilityTest.zoneOf(t, ZONE_KIND.WALL); return wall >= 0 && Test.near(AbilityZones.z[wall], 1.5, 0.01); } },
  arcbolt: { setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 0, expect: (t) => Actors.health[t.enemy] === 70 && Damage.hasStatus(t.enemy, 'shock') },
  // Swarm ticks every 0.5 s from the step after the cast: two ticks of 4 by 1.05 s.
  swarm: { setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 1.05, expect: (t) => Test.near(Actors.health[t.enemy], 92, 0.5) },
  holodouble: {
    seconds: 0.1,
    expect: (t) => {
      const decoy = AbilityZones.target[AbilityTest.zoneOf(t, ZONE_KIND.DECOY)];
      const standing = Actors.alive[decoy] && Actors.team[decoy] === 0;
      TestArena.hit(t.enemy, decoy, 1);
      return standing && !Actors.alive[decoy];
    },
  },
  wrath: {
    setup: (t) => { Powerups.souls[t.caster] = 66; }, seconds: 0.1,
    expect: (t) => {
      const buffed = Abilities.active[t.i] === 1 && Buffs.has(t.caster, BUFF.TOUCH_KILL);
      TestArena.place(t.enemy, 0, 1);
      Sim.step();
      const touched = !Actors.alive[t.enemy];
      TestArena.hit(t.caster, t.second, 1);
      return buffed && touched && !Actors.alive[t.second] && Actors.alive[t.ally];   // a touch or any hit kills enemies only
    },
  },
  lifterpower: { seconds: 1, expect: (t) => Test.near(Meters.energy[t.caster], Meters.energyMax() - 10, 0.1) && Abilities.active[t.i] === 1 },
  gatepair: { rules: { family: 'solo' }, seconds: 0, expect: (t) => GateState.next[t.caster] === 1 },
  overcore: { seconds: 0.1, expect: (t) => { TestArena.hit(t.caster, t.enemy, 10); return Actors.health[t.enemy] === 80; } },
  orbital: {
    setup: (t) => TestArena.aimAt(t.caster, t.enemy, ZONE.LEGS), seconds: 1.9,
    expect: (t) => { const before = Actors.alive[t.enemy]; runSeconds(0.15); return before && !Actors.alive[t.enemy]; },
  },
  rift: {
    setup: AbilityTest.clearPath, seconds: 0.1,
    expect: (t) => {
      const entry = AbilityTest.zoneOf(t, ZONE_KIND.RIFT), exit = AbilityZones.other[entry];
      const linked = entry >= 0 && AbilityZones.other[exit] === entry;
      TestArena.place(t.ally, AbilityZones.x[entry], AbilityZones.z[entry]);
      Sim.step();
      return linked && Test.near(Actors.x[t.ally], AbilityZones.x[exit], 0.01) && Test.near(Actors.z[t.ally], AbilityZones.z[exit], 0.01);
    },
  },
  rally: { seconds: 0.1, expect: (t) => Damage.surplus[t.ally] === 50 && Test.near(Buffs.get(t.ally, BUFF.SPEED), 1.2, 1e-6) && Buffs.get(t.enemy, BUFF.SPEED) === 1 },
  seerpulse: { setup: (t) => TestArena.place(t.enemy, 50, 50), seconds: 0.1, expect: (t) => Damage.hasStatus(t.enemy, 'reveal') },
  picketswarm: { seconds: 1, expect: (t) => Actors.health[t.enemy] < 100 && Actors.health[t.second] < 100 },
  surgecombo: { seconds: 0.1, expect: (t) => Test.near(Buffs.get(t.caster, BUFF.SPEED), 1.4, 1e-6) },
  boostercombo: { setup: (t) => { Actors.health[t.caster] = 50; }, seconds: 1, expect: (t) => Test.near(Actors.health[t.caster], 55, 0.1) },
  veilcombo: { seconds: 0.1, expect: (t) => Buffs.has(t.caster, BUFF.INVISIBLE) },
  berserkcombo: { seconds: 0.1, expect: (t) => Buffs.get(t.caster, BUFF.RATE) === 1.5 },
  ampedrounds: { seconds: 0.1, expect: (t) => { TestArena.hit(t.caster, t.enemy, 20); return Actors.health[t.enemy] === 75; } },
};

function caseState(t) {
  const health = [t.caster, t.enemy, t.second, t.ally].map((id) => Math.round(Actors.health[id] * 100) / 100);
  return 'health ' + health.join(' / ') + ', caster at ' + Actors.x[t.caster].toFixed(2) + ' ' + Actors.y[t.caster].toFixed(2) + ' ' + Actors.z[t.caster].toFixed(2);
}
function runAbilityCase(check, row) {
  const spec = ABILITY_CASES[row.id];
  const rules = Object.assign(row.resource === 'ultimate' ? { meter: 'ultimate' } : {}, spec.rules);
  const t = AbilityTest.give(AbilityTest.start(rules), row.id, row.activation === 'ult' ? SLOT.ULTIMATE : SLOT.ABILITY1);
  if (spec.setup) spec.setup(t);
  const pointsBefore = Meters.points[t.caster];
  const cast = row.activation === 'passive' || row.activation === 'ult' ? true : AbilityTest.cast(t);
  if (row.activation === 'ult') Sim.step();   // 'ult' rows fire by themselves once affordable
  check(row.code + ' ' + row.name + ' casts and pays its ' + row.resource, cast && AbilityTest.paid(t, pointsBefore), 'cast ' + cast);
  if (spec.seconds > 0) runSeconds(spec.seconds);
  check(row.code + ' ' + row.name + ' effect', spec.expect(t), caseState(t));
  Actors.buttons[t.caster] = 0;
  TestArena.finish();
}

Test.add('abilities', (check) => {
  const missing = CAT.abilities.filter((row) => !ABILITY_CASES[row.id]).map((row) => row.id);
  check('every ability row has a test case', missing.length === 0, missing.join(', '));
});
for (const row of CAT.abilities) if (ABILITY_CASES[row.id]) Test.add('abilities', (check) => runAbilityCase(check, row));

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'echopulse');
  AbilityTest.cast(t);
  runSeconds(20 - 0.02);
  check('cooldown: echo pulse not ready before 20 s', !Abilities.ready(t.caster, t.slot));
  runSeconds(0.03);
  check('cooldown: ready after exactly 20 s', Abilities.ready(t.caster, t.slot));
  Abilities.rechargeScale[t.caster] = 2;
  AbilityTest.cast(t);
  runSeconds(10.01);
  check('cooldown: recharge scale (Tune Up) halves it', Abilities.ready(t.caster, t.slot));
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'surge');
  for (let k = 0; k < 3; k++) { AbilityTest.clearPath(t); TestArena.place(t.caster, 0, 0); AbilityTest.cast(t); }
  check('charges: three dashes empty the charges', Abilities.charges[t.i] === 0 && !AbilityTest.cast(t));
  runSeconds(3.01);
  check('charges: one charge back after 3 s', Abilities.charges[t.i] === 1);
  runSeconds(6);
  check('charges: one at a time, full after 9 s', Abilities.charges[t.i] === 3 && Abilities.cooldown[t.i] === 0);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.start({});
  Meters.energy[t.caster] = 50;
  runSeconds(2);
  check('ABL-002 energy regenerates 5/s', Test.near(Meters.energy[t.caster], 60, 0.05), Meters.energy[t.caster]);
  killActor(t.enemy, t.caster);
  check('ABL-002 a kill orb gives 25 energy', Test.near(Meters.energy[t.caster], 85, 0.05), Meters.energy[t.caster]);
  TestArena.finish();
  const suit = AbilityTest.start({ health: 'suit' });
  Meters.spendEnergy(suit.caster, 50);
  runSeconds(2 - 0.02);
  check('HPP08 suit energy waits 2 s', Meters.energy[suit.caster] === 50);
  runSeconds(1.02);
  check('HPP08 then refills 25/s', Test.near(Meters.energy[suit.caster], 75, 0.3), Meters.energy[suit.caster]);
  check('energy: not enough empties the bar', !Meters.spendEnergy(suit.caster, 90) && Meters.energy[suit.caster] === 0);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.start({ meter: 'ultimate' });
  runSeconds(2);
  check('ECO-003 ultimate meter 5/s', Test.near(Meters.points[t.caster], 10, 0.05), Meters.points[t.caster]);
  TestArena.hit(t.caster, t.enemy, 40);
  check('ECO-003 ultimate meter +1 per damage dealt', Test.near(Meters.points[t.caster], 50, 0.1), Meters.points[t.caster]);
  TestArena.finish();
  const boost = AbilityTest.start({ meter: 'boost' });
  runSeconds(4);
  check('ECO-003 boost meter 0.5/s', Test.near(Meters.points[boost.caster], 2, 0.01), Meters.points[boost.caster]);
  TestArena.finish();
});

const scoreEvent = { id: -1, team: 0, points: 0, reason: 'kill' };
function scorePoints(id, points, reason) {
  scoreEvent.id = id; scoreEvent.team = Actors.team[id]; scoreEvent.points = points; scoreEvent.reason = reason || 'kill';
  Bus.emit('score', scoreEvent);
}

Test.add('abilities', (check) => {
  const t = AbilityTest.start({ meter: 'streak' });
  scorePoints(t.caster, 2);
  check('streak: 200 points, nothing yet', Meters.points[t.caster] === 200 && !Abilities.row(t.caster, SLOT.ULTIMATE));
  scorePoints(t.caster, 1);
  check('streak: 300 points load the seer pulse', Abilities.row(t.caster, SLOT.ULTIMATE).id === 'seerpulse' && Abilities.ready(t.caster, SLOT.ULTIMATE));
  check('streak: the reward is used once', Abilities.tryActivate(t.caster, SLOT.ULTIMATE) && !Abilities.reward[t.caster]);
  runSeconds(5);
  check('streak: the slot empties after use', !Abilities.row(t.caster, SLOT.ULTIMATE));
  killActor(t.caster, t.enemy);
  check('streak: resets on death', Meters.points[t.caster] === 0);
  TestArena.finish();
  const hardline = AbilityTest.start({ meter: 'streak' });
  Meters.streakDiscount[hardline.caster] = 100;
  scorePoints(hardline.caster, 2);
  check('streak: Hardline lowers the thresholds by 100', Abilities.row(hardline.caster, SLOT.ULTIMATE).id === 'seerpulse');
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.start({ meter: 'adrenaline' });
  check('adrenaline: the first combo fills the empty ultimate slot', Abilities.row(t.caster, SLOT.ULTIMATE).id === 'surgecombo');
  for (let k = 0; k < 5; k++) {
    const victim = TestArena.actor(1, 10 + k, 10);
    killActor(victim, t.caster);
  }
  check('adrenaline: 5 per kill, +10 on the 5th kill', Meters.points[t.caster] === 35, Meters.points[t.caster]);
  scorePoints(t.caster, 1, 'capture');
  check('adrenaline: +25 per capture', Meters.points[t.caster] === 60, Meters.points[t.caster]);
  Meters.points[t.caster] = 100;
  for (const tap of [-1, 1, -1, -1, 1, -1, 1, -1]) { Actors.moveZ[t.caster] = tap > 0 ? 0 : -1; Sim.step(); }   // B B B B
  Actors.moveZ[t.caster] = 0;
  check('adrenaline: four back taps cast the booster', Abilities.isActive(t.caster, 'boostercombo') && Meters.points[t.caster] === 0);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'bulwark');
  Abilities.setSlot(t.caster, SLOT.ABILITY2, CAT.abilities.byId('overdrive'));
  AbilityTest.cast(t);
  Abilities.tryActivate(t.caster, SLOT.ABILITY2);
  check('group: one weave at a time', !Abilities.isActive(t.caster, 'bulwark') && Abilities.isActive(t.caster, 'overdrive'));
  Abilities.tryActivate(t.caster, SLOT.ABILITY2);
  check('toggle: a second press turns it off', !Abilities.isActive(t.caster, 'overdrive'));
  Abilities.tryActivate(t.caster, SLOT.ABILITY2);
  Actors.flags[t.caster] |= ACTOR_FLAG.FROZEN;
  Sim.step();
  check('interrupt: a stun ends a toggle and blocks casts', !Abilities.isActive(t.caster, 'overdrive') && !Abilities.tryActivate(t.caster, SLOT.ABILITY2));
  Actors.flags[t.caster] &= ~ACTOR_FLAG.FROZEN;
  Abilities.suppress(t.caster, 2);
  check('suppress: no abilities for the duration', !Abilities.tryActivate(t.caster, SLOT.ABILITY2));
  runSeconds(2.01);
  check('suppress: usable again after it', Abilities.tryActivate(t.caster, SLOT.ABILITY2));
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({ health: 'suit' }), 'phantasm');
  AbilityTest.cast(t);
  Bus.emit('weapon.fire', { id: t.caster, weapon: 'warden', mode: 'primary' });
  check('interrupt: firing drops the cloak and empties the bar (A04)', !Abilities.active[t.i] && Meters.energy[t.caster] === 0 && !Buffs.has(t.caster, BUFF.INVISIBLE));
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'echopulse');
  Abilities.setSlot(t.caster, SLOT.ABILITY2, CAT.abilities.byId('veil'));
  Abilities.setSlot(t.caster, SLOT.ULTIMATE, CAT.abilities.byId('aegisdome'));
  AbilityTest.cast(t);
  Abilities.tryActivate(t.caster, SLOT.ABILITY2);
  Abilities.tryActivate(t.caster, SLOT.ULTIMATE);
  killActor(t.caster, t.enemy);
  check('death: active abilities end', !Abilities.active[t.i]);
  check('death: zones end unless they persist', AbilityTest.zoneOf(t, ZONE_KIND.SMOKE) < 0 && AbilityTest.zoneOf(t, ZONE_KIND.DOME) >= 0);
  Bus.emit('match.end', Game.match);
  check('match end: every zone and buff is cleared', AbilityZones.find(ZONE_KIND.DOME, t.caster) < 0 && Buffs.get(t.ally, BUFF.SPEED) === 1);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.start({ economy: 'heroKits', health: 'hero', meter: 'ultimate' });
  for (const hero of CAT.heroes) {
    Abilities.setChoice(t.caster, { hero: hero.id });
    Abilities.refreshKit(t.caster);
    const pools = Actors.maxHealth[t.caster] === hero.health && Actors.armor[t.caster] === hero.armor && Actors.shield[t.caster] === hero.shield;
    const kit = Abilities.row(t.caster, SLOT.ABILITY1).id === hero.ability1 && Abilities.row(t.caster, SLOT.ULTIMATE).id === hero.ultimate;
    const gear = hero.weapons.every((key) => Weapons.has(t.caster, key)) && Move.preset(t.caster).id === hero.move;
    check(hero.code + ' ' + hero.name + ': pools, abilities, weapons and movement', pools && kit && gear, Actors.maxHealth[t.caster] + ' ' + Actors.armor[t.caster] + ' ' + Actors.shield[t.caster]);
  }
  Abilities.setChoice(t.caster, { hero: 'tamsin' });
  Abilities.refreshKit(t.caster);
  check('H08 passive tracker sense is always on', Abilities.isActive(t.caster, 'tracker'));
  TestArena.finish();
  const versus = AbilityTest.start({});
  check('no kit outside hero and kit rulesets', !Abilities.row(versus.caster, SLOT.ABILITY1));
  check('A23 Puppet Jump is PvE only', !Abilities.usable(versus.caster, CAT.abilities.byId('puppet')));
  TestArena.finish();
});

// balance-01: bots without a hero choice draw one per team from the match seed (headless Hero Squad Team Clash, 10 bots):
// a team of five fields every role and no hero twice, keeps its heroes across picks, leaves a teammate's own pick out,
// draws again when auto-balance moves it to the other team, and the line-ups change with the seed.
const HERO_DRAW_SEEDS = [1, 2, 3, 4], HERO_DRAW_BOTS = 10;
Test.add('abilities', (check) => {
  const roles = new Set(CAT.heroes.map((hero) => hero.role)).size, lineups = new Set();
  for (const seed of HERO_DRAW_SEEDS) {
    const probe = () => {
      for (const team of [0, 1]) {
        const ids = sideMembers(team), heroes = ids.map((id) => Abilities.pickHero(id)), names = heroes.map((hero) => hero.id).join(' ');
        check('seed ' + seed + ' team ' + team + ': no hero twice, every role', new Set(heroes).size === heroes.length && new Set(heroes.map((hero) => hero.role)).size === roles, names);
        check('seed ' + seed + ' team ' + team + ': the same heroes on the next pick', ids.every((id, k) => Abilities.pickHero(id) === heroes[k]), names);
        lineups.add(team + ': ' + names);
      }
      const team = sideMembers(0), picked = Abilities.pickHero(team[1]);
      for (const id of team) Abilities.drawn[id] = null;
      Abilities.setChoice(team[0], { hero: picked.id });
      check('seed ' + seed + ': a teammate\'s own pick is left out of the draw', team.slice(1).every((id) => Abilities.pickHero(id) !== picked), picked.id);
      const otherHeroes = sideMembers(1).map((id) => Abilities.pickHero(id));
      const moved = team.slice(1).find((id) => otherHeroes.includes(Abilities.pickHero(id)));   // 5 + 5 heroes of 8: some are shared
      Actors.team[moved] = 1;   // as auto-balance does
      check('seed ' + seed + ': a bot moved to the other team draws for it', !otherHeroes.includes(Abilities.pickHero(moved)), String(moved));
    };
    playMatch({ mode: 'tdm', map: 'harbor', ruleset: 'heroes', minutes: 0, botCount: HERO_DRAW_BOTS, seed, modeOptions: SOAK_OPEN_MATCH, probe });
  }
  check('the line-ups change with the seed', lineups.size > HERO_DRAW_SEEDS.length, [...lineups].join(' / '));
});

// balance-04: hero Team Clash counts to HERO_KILL_LIMIT_SCALE of its limit; other rulesets and modes and a match's own limit
// keep theirs.
Test.add('abilities', (check) => {
  const tdm = CAT.modes.byId('tdm').scoreLimit, limit = (setup) => Rules.build(setup).scoreLimit, hero = limit({ mode: 'tdm', ruleset: 'heroes' });
  check('hero Team Clash counts to the hero share of the kill limit', hero === Math.ceil(tdm * HERO_KILL_LIMIT_SCALE), String(hero));
  check('Arena Classic Team Clash keeps its limit', limit({ mode: 'tdm' }) === tdm);
  check('a match\'s own score limit is kept', limit({ mode: 'tdm', ruleset: 'heroes', modeOptions: { scoreLimit: 40 } }) === 40);
  for (const mode of ['ctf', 'ffa', 'attrition', 'cursetag', 'roulette']) {
    check(mode + ' keeps its score limit in a hero ruleset', limit({ mode, ruleset: 'heroes' }) === CAT.modes.byId(mode).scoreLimit, String(limit({ mode, ruleset: 'heroes' })));
  }
  // hazard-01: hero pools soak more hits, so at full push most Skyward Yard kills were falls (botsoak measures the share).
  const heroRules = Rules.build({ mode: 'tdm', ruleset: 'heroes' }), classicRules = Rules.build({ mode: 'tdm' });
  check('Hero Squad hits push half as far, Arena Classic at full push', heroRules.hitKnockback === 0.5 && classicRules.hitKnockback === 1, String(heroRules.hitKnockback));
  check('Hero Squad keeps the full self push (own blasts, leaps)', heroRules.knockback === 1, String(heroRules.knockback));
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'echopulse');
  const hud = { slots: [], meter: Object.assign({}, METER_HUD) };
  check('HUD: hudState returns out', Abilities.hudState(t.caster, hud) === hud);
  check('HUD: one slot, ready', hud.slots.length === 1 && hud.slots[0].ready && hud.slots[0].id === 'echopulse' && hud.meter.kind === 'energy');
  AbilityTest.cast(t);
  runSeconds(1);
  Abilities.hudState(t.caster, hud);
  check('HUD: cooldown fraction and remaining time', Test.near(hud.slots[0].cooldown, 19 / 20, 1e-3) && Test.near(hud.slots[0].remaining, 2, 0.01) && hud.slots[0].active, JSON.stringify(hud.slots[0]));
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.start({});
  Buffs.add(t.caster, BUFF.SPEED, 1.2, 8);    // A40 rally
  Buffs.add(t.caster, BUFF.SPEED, 1.25, 2.5); // H03 kill haste
  check('buffs: the strongest live speed buff applies', Test.near(Buffs.get(t.caster, BUFF.SPEED), 1.25, 1e-6));
  runSeconds(3);
  check('buffs: a strong short buff ends on time, the weak long one stays', Test.near(Buffs.get(t.caster, BUFF.SPEED), 1.2, 1e-6), Buffs.get(t.caster, BUFF.SPEED));
  runSeconds(5.1);
  check('buffs: neutral after both ended', Buffs.get(t.caster, BUFF.SPEED) === 1 && !Buffs.has(t.caster, BUFF.SPEED));
  Buffs.add(t.enemy, BUFF.SLOW, 0.4, 1.5);    // A18 fence
  Buffs.add(t.enemy, BUFF.SLOW, 0, TICK_BUFF); // A15 pilot standing still
  check('buffs: the lowest slow applies', Buffs.get(t.enemy, BUFF.SLOW) === 0);
  runSeconds(0.5);
  check('buffs: the pilot freeze ends, the fence slow stays', Test.near(Buffs.get(t.enemy, BUFF.SLOW), 0.4, 1e-6) && Test.near(Buffs.remaining(t.enemy, BUFF.SLOW), 1, 0.02));
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'huntersight');
  AbilityTest.cast(t);
  runSeconds(4);
  check('ABL-002 a draining toggle never regenerates: hunter sight costs 5/s', Test.near(Meters.energy[t.caster], Meters.energyMax() - 20, 0.05), Meters.energy[t.caster]);
  Abilities.tryActivate(t.caster, t.slot);
  runSeconds(1 - 0.02);
  check('ABL-002 regen waits regenDelay after the last spend', Test.near(Meters.energy[t.caster], Meters.energyMax() - 20, 0.05));
  runSeconds(1.02);
  check('ABL-002 then 5/s', Test.near(Meters.energy[t.caster], Meters.energyMax() - 15, 0.1), Meters.energy[t.caster]);
  Meters.energy[t.caster] = 10;
  Meters.points[t.caster] = 40;
  Bus.emit('actor.spawn', { id: t.caster });
  check('spawn: a full energy bar, the match meter stays', Meters.energy[t.caster] === Meters.energyMax() && Meters.points[t.caster] === 40);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'overdrive');
  AbilityTest.cast(t);
  Actors.flags[t.caster] |= ACTOR_FLAG.SPRINTING;
  const effect = Abilities.effects.suitSpeed;
  effect.step(t.caster, t.row, t.slot, TICK_SECONDS);
  check('A02 sprinting: speed x1.5 and 20 energy per second', Buffs.get(t.caster, BUFF.SPEED) === 1.5 && effect.drain(t.caster, t.row) === 20);
  Actors.flags[t.caster] &= ~ACTOR_FLAG.SPRINTING;
  Buffs.cancel(t.caster, BUFF.SPEED);
  effect.step(t.caster, t.row, t.slot, TICK_SECONDS);
  check('A02 walking: no speed and no drain', Buffs.get(t.caster, BUFF.SPEED) === 1 && effect.drain(t.caster, t.row) === 0);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'surge');
  AbilityTest.clearPath(t);
  check('teleport event: a dash keeps a carried objective', TestArena.count('ability.teleport', () => AbilityTest.cast(t)) === 0);
  AbilityTest.give(t, 'relocator');
  const events = TestArena.count('ability.teleport', () => { AbilityTest.cast(t); Sim.step(); AbilityTest.cast(t); });
  check('teleport event: the relocator jump drops it (A12)', events === 1);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.start({ economy: 'classes' });
  t.row = CAT.abilities.byId('echopulse'); t.i = Abilities.index(t.caster, SLOT.ABILITY1);
  check('ECP04 the class kit gives Echo Pulse as the field upgrade', Abilities.row(t.caster, SLOT.ABILITY1) === t.row);
  AbilityTest.cast(t);
  check('ECP04 the field upgrade recharges in 90 s (kit cooldown)', Abilities.cooldown[t.i] === 90 && Abilities.slotCooldown[t.i] === 90);
  Abilities.setChoice(t.caster, { ability1: classFieldAbility({ fieldUpgrade: 'cover' }) });
  Abilities.onSpawn(t.caster);
  check('ECP04 a gadget field upgrade leaves the ability slot empty', !Abilities.row(t.caster, SLOT.ABILITY1));
  check('ECP04 only Echo Pulse is an ability field upgrade', CAT.abilityKits.byId('classes').choices.ability1.join() === 'echopulse');
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.start({ meter: 'streak' });
  scorePoints(t.caster, 5);
  check('streak: 500 points load the 300 reward first and queue the orbital lance', Abilities.row(t.caster, SLOT.ULTIMATE).id === 'seerpulse');
  check('streak: the first reward is used once', Abilities.tryActivate(t.caster, SLOT.ULTIMATE));
  runSeconds(CAT.abilities.byId('seerpulse').duration + 0.2);
  check('streak: then the orbital lance loads', Abilities.row(t.caster, SLOT.ULTIMATE).id === 'orbital');
  check('streak: the orbital is used once', Abilities.tryActivate(t.caster, SLOT.ULTIMATE));
  check('streak: an instant reward of any category empties the slot', !Abilities.row(t.caster, SLOT.ULTIMATE) && !Abilities.rewardLoaded[t.caster]);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.start({ economy: 'heroKits', health: 'hero', meter: 'ultimate' });
  const regenAfter = (heroId, profile) => {
    Abilities.setChoice(t.caster, { hero: heroId });
    Abilities.refreshKit(t.caster);
    Actors.profile[t.caster] = profile || null;
    TestArena.hit(t.enemy, t.caster, 50);
    const hurt = Actors.health[t.caster];
    runSeconds(1.4);
    const waited = Actors.health[t.caster] === hurt;
    runSeconds(1.1);
    return waited ? Actors.health[t.caster] - hurt : -1;
  };
  check('HPP05 support role regen: Lark 15/s after 1.5 s', Test.near(regenAfter('lark'), 15, 0.6));
  check('HPP05 support role regen: Mirelle too', Test.near(regenAfter('mirelle'), 15, 0.6));
  check('HPP05 a support-profile bot playing Lark regenerates once', Test.near(regenAfter('lark', { role: 'support' }), 15, 0.6));
  check('HPP05 a tank does not regenerate health', regenAfter('bastide', { role: 'support' }) === 0);
  Abilities.setChoice(t.caster, { hero: 'moraine' });
  Abilities.refreshKit(t.caster);
  Actors.profile[t.caster] = null;
  TestArena.hit(t.enemy, t.caster, 100);
  const shield = Actors.shield[t.caster];
  const passive = CAT.heroes.byId('moraine').passive;
  runSeconds(passive.delay + 0.5);
  check('H02 shield regen passive: ' + passive.rate + '/s after ' + passive.delay + ' s (before the preset 3 s)', passive.delay + 0.5 < 3 && Test.near(Actors.shield[t.caster] - shield, passive.rate * 0.5, 1), Actors.shield[t.caster] - shield);
  TestArena.finish();
});

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'echopulse');
  const hud = { slots: [], meter: Object.assign({}, METER_HUD) };
  Abilities.hudState(t.caster, hud);
  const slots = hud.slots, first = hud.slots[0];
  Abilities.hudState(t.caster, hud);
  check('HUD: the slots array and entries are reused', hud.slots === slots && hud.slots[0] === first && hud.slots.length === 1);
  Abilities.setSlot(t.caster, SLOT.ABILITY1, null);
  Abilities.hudState(t.caster, hud);
  check('HUD: emptied slots are trimmed', hud.slots.length === 0);
  TestArena.finish();
});

// HP-005 combos through Damage.statusHooks: Shock chains once, wet + Shock stuns everyone in that water, Burn melts ice.
Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start(), 'arcbolt');
  TestArena.aimAt(t.caster, t.enemy);
  AbilityTest.cast(t);
  check('Shock chains to the nearest other enemy (HP-005 +chain)', Damage.hasStatus(t.second, 'shock') && !Damage.hasStatus(t.ally, 'shock') && !Damage.hasStatus(t.caster, 'shock'));
  Damage.clearAllStatuses(t.enemy); Damage.clearAllStatuses(t.second);
  TestArena.place(t.second, 6, ENEMY_DISTANCE);
  TestArena.place(t.ally, 0, ENEMY_DISTANCE + 7);
  Meters.energy[t.caster] = Meters.energyMax(); Abilities.cooldown[t.i] = 0;
  AbilityTest.cast(t);
  const dryShocked = Damage.hasStatus(t.second, 'shock');
  Damage.clearAllStatuses(t.enemy);
  for (const id of [t.enemy, t.second, t.ally]) Motion.medium[id] = TRIGGER_MEDIUM.WADING;
  Meters.energy[t.caster] = Meters.energyMax(); Abilities.cooldown[t.i] = 0;
  AbilityTest.cast(t);
  check('A29 on a dry target: nobody 6 m away is shocked', !dryShocked);
  check('A29 on a wet target: everyone wading in that water is stunned, the caster on dry floor is not (HP-005 wet floor)',
    Damage.hasStatus(t.second, 'shock') && Damage.hasStatus(t.ally, 'shock') && !Damage.hasStatus(t.caster, 'shock'));
  for (const id of [t.enemy, t.second, t.ally]) { Motion.medium[id] = 0; Damage.clearAllStatuses(id); }
  Damage.resetHealth(t.enemy);
  Damage.addStatus(t.enemy, 'freeze', t.caster);
  Damage.addStatus(t.enemy, 'burn', t.caster);
  check('Burn melts ice: the frozen target thaws and burns', !Damage.hasStatus(t.enemy, 'freeze') && Damage.hasStatus(t.enemy, 'burn'),
    Damage.hasStatus(t.enemy, 'freeze') + ' ' + Damage.hasStatus(t.enemy, 'burn'));
  for (const id of [t.caster, t.ally]) Motion.medium[id] = TRIGGER_MEDIUM.WADING;
  chargeHit(t.enemy, t.caster, CAT.enemies.byId('charger').attacks[0]);   // a non-electric stun: no chain, no wet spread
  check('E10 charger knockdown stuns only its target, even in water (no HP-005 Shock combo)',
    Damage.hasStatus(t.caster, 'stun') && !Damage.hasStatus(t.ally, 'stun') && !Damage.hasStatus(t.ally, 'shock') && !Damage.hasStatus(t.caster, 'shock'));
  for (const id of [t.caster, t.ally]) Motion.medium[id] = 0;
  TestArena.finish();
});

// HP-005 floor surfaces (12h): a wet patch + Shock stuns everyone standing in it, A29 aimed at the patch floor too, and a
// thawed Freeze leaves a wet patch.
function surfaceSlots(key) {
  const row = CAT.surfaces.byId(key), slots = [];
  for (let slot = 0; slot < SURFACE_CAP; slot++) if (FloorSurfaces.active[slot] && FloorSurfaces.row[slot] === row.index) slots.push(slot);
  return slots;
}
function aimAtFloor(id, x, z) {
  const dx = x - Actors.x[id], dz = z - Actors.z[id];
  Actors.yaw[id] = Actors.aimYaw[id] = Math.atan2(dx, dz);
  Actors.pitch[id] = Actors.aimPitch[id] = Math.atan2(-Actors.eyeY(id), length2(dx, dz));
}
Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start(), 'arcbolt');
  const refill = () => { Meters.energy[t.caster] = Meters.energyMax(); Abilities.cooldown[t.i] = 0; };
  TestArena.place(t.ally, -1, ENEMY_DISTANCE);   // beside the target: the chain never picks an ally
  TestArena.aimAt(t.caster, t.enemy);
  AbilityTest.cast(t);
  const dryAlly = Damage.hasStatus(t.ally, 'shock');
  for (const id of [t.enemy, t.second, t.ally]) Damage.clearAllStatuses(id);
  FloorSurfaces.spill(CAT.surfaces.byId('wet'), -1, 0, 1, ENEMY_DISTANCE);
  refill();
  AbilityTest.cast(t);
  check('A29 on dry floor: the ally beside the target is not shocked', !dryAlly);
  check('wet floor + Shock: everyone standing in the patch is stunned, the caster on dry floor is not (HP-005)',
    Damage.hasStatus(t.ally, 'shock') && !Damage.hasStatus(t.caster, 'shock'));
  Damage.clearAllStatuses(t.ally);
  AbilityTest.clearPath(t);
  refill();
  aimAtFloor(t.caster, 0, ENEMY_DISTANCE + 1.5);
  const floorCast = AbilityTest.cast(t);
  check('A29 aimed at the wet floor with no enemy in the cone shocks everyone in the patch', floorCast && Damage.hasStatus(t.ally, 'shock'), floorCast);
  refill();
  aimAtFloor(t.caster, 0, -ENEMY_DISTANCE);
  check('A29 aimed at dry floor with no enemy is refused (nothing paid)', !AbilityTest.cast(t) && Meters.energy[t.caster] === Meters.energyMax());
  FloorSurfaces.clear();
  TestArena.place(t.enemy, 0, ENEMY_DISTANCE);
  Damage.clearAllStatuses(t.enemy);
  Damage.addStatus(t.enemy, 'freeze', t.caster);
  Damage.addStatus(t.enemy, 'burn', t.caster);
  const puddle = surfaceSlots('wet');
  check('Burn thawing a Freeze leaves a wet patch under the target', puddle.length === 1 && FloorSurfaces.stands(puddle[0], t.enemy), puddle.length);
  TestArena.finish();
  check('a world load or clear removes every patch', surfaceSlots('wet').length === 0);
});

// HP-005 oil: an oil drum prop spills a slick; Burn on someone in it lights a 6 s fire area that burns whoever stands
// in it and lights touching oil; a thermal explosion over oil lights it, a kinetic one does not.
Test.add('abilities', (check) => {
  const badRows = CAT.surfaces.filter((row) => [row.spreads, row.igniteStatus, row.status].some((key) => key && !CAT.statusEffects.byId(key))
    || (row.becomes && !CAT.surfaces.byId(row.becomes)) || (row.spillFrom && !CAT.materials.byId(row.spillFrom)) || (row.fx && !CAT.fxKinds.byId(row.fx))
    || !CAT.elements.byId(row.element) || (row.igniteElement && !CAT.elements.byId(row.igniteElement)));
  check('surface rows name real statuses, surfaces, materials, elements and fx kinds', badRows.length === 0, badRows.map((row) => row.id).join());
  const t = AbilityTest.start();
  Props.load({ props: [{ min: [-0.4, 0, 2.6], max: [0.4, 1.2, 3.4], health: 10, material: 'oil' }, { min: [3, 0, 3], max: [4, 1, 4], health: 10, material: 'wood' }] });
  Props.damage(1, 50, t.caster);
  check('a wooden prop spills nothing', surfaceSlots('oil').length === 0);
  Props.damage(0, 50, t.caster);
  const slick = surfaceSlots('oil');
  check('a broken oil drum spills an oil slick on the floor under it', slick.length === 1 && Test.near(FloorSurfaces.y[slick[0]], 0, 1e-3) && Test.near(FloorSurfaces.z[slick[0]], 3, 1e-3), slick.length);
  const fireRow = CAT.surfaces.byId('fire');
  FloorSurfaces.spill(CAT.surfaces.byId('oil'), -1, 0, 0, 7);   // touches the first slick: it lights with it
  TestArena.place(t.enemy, 0, 3.5);
  TestArena.place(t.second, 1, 7);
  TestArena.place(t.ally, -1, 7);
  Damage.addStatus(t.enemy, 'burn', t.caster, 2, 1);
  check('Burn on a target standing in oil lights it: a 6 s fire area (HP-005 oil floor + Burn)',
    surfaceSlots('oil').length === 0 && surfaceSlots('fire').length === 2 && Test.near(FloorSurfaces.endTick[slick[0]] - Sim.tick, fireRow.seconds * TICK_RATE, 1));
  runSeconds(0.3);
  check('burning oil hurts and burns an enemy standing in it, not an ally (friendly fire off)',
    Damage.hasStatus(t.second, 'burn') && Actors.health[t.second] < Actors.maxHealth[t.second] && !Damage.hasStatus(t.ally, 'burn') && Actors.health[t.ally] === Actors.maxHealth[t.ally]);
  runSeconds(fireRow.seconds);
  check('the fire area goes out after its seconds', surfaceSlots('fire').length === 0);
  FloorSurfaces.spill(CAT.surfaces.byId('oil'), -1, 10, 0, 10);
  Bus.emit('explosion', { x: 11, y: 0.3, z: 10, radius: 3, owner: t.caster, source: 'frag', element: 'kinetic' });
  const afterKinetic = surfaceSlots('oil').length;
  Bus.emit('explosion', { x: 11, y: 0.3, z: 10, radius: 0, owner: t.caster, source: 'incendiary', element: 'thermal' });
  check('a thermal explosion over oil lights it, a kinetic one does not', afterKinetic === 1 && surfaceSlots('fire').length === 1, afterKinetic);
  const burning = surfaceSlots('fire')[0], late = FloorSurfaces.spill(CAT.surfaces.byId('oil'), -1, 14.5, 0, 10);
  check('oil spilled later against burning oil lights at once, credited to its igniter',
    surfaceSlots('oil').length === 0 && FloorSurfaces.rowOf(late).id === 'fire' && FloorSurfaces.owner[late] === t.caster);
  Smoke.spawn(CAT.gadgets.byId('smoke'), -1, 8, 0.5, 10);   // covers the first patch, not the one 6.5 m away
  runSeconds(2);
  check('smoke puts burning oil out, as it does a G04 fire area', !FloorSurfaces.active[burning] && FloorSurfaces.active[late] === 1);
  FloorSurfaces.clear();
  FloorSurfaces.spill(CAT.surfaces.byId('oil'), -1, 20, 0, 20);
  GadgetAreas.spawn(CAT.gadgets.byId('incendiary'), t.caster, 24, 0.05, 20, 1);   // a Cinder Jar fire area overlapping the slick's edge
  runSeconds(0.3);
  check('a G04 fire area lights the oil it overlaps, not only oil its pop lands on', surfaceSlots('oil').length === 0 && surfaceSlots('fire').length === 1);
  TestArena.finish();
});

// HP-005 in real play: every spill row has a prop of its material on a shipped map (oil drums, a water tank), and the
// map editor accepts such props.
Test.add('abilities', (check) => {
  const propMaterials = new Set(CAT.maps.flatMap((map) => map.props.map((prop) => prop.material)));
  const missing = CAT.surfaces.filter((row) => row.spillFrom && !propMaterials.has(row.spillFrom));
  check('every spill row has a prop of its material on a shipped map', missing.length === 0, missing.map((row) => row.id).join());
  check('the map editor accepts an oil drum prop with its colour', mapEditPropIs(Object.assign({ min: [0, 0, 0], max: [1, 1, 1] }, MAP_OIL_DRUM)));
});

// A23 Puppet Jump: the caster's input drives the puppet (move, look; FIRE starts its attack) while the caster's body stands
// still, the camera rides the puppet's eyes, and a hit on the caster or the puppet's death ends it.
Test.add('abilities', (check) => {
  startPveTest({ player: { team: 0 } });
  const player = Game.playerId, row = CAT.abilities.byId('puppet'), camera = {}, style = { visible: true };
  Modes.endProtection(player);
  TestArena.place(player, 3, 0);
  const puppet = Pve.spawnEnemy('husk', 3, 0, 6, Math.PI), enemyTeam = Actors.team[puppet];
  TestArena.aimAt(player, puppet);
  Abilities.setSlot(player, SLOT.ABILITY1, row);
  const cast = Abilities.effects.possess.cast(player, row, SLOT.ABILITY1);
  Abilities.begin(player, SLOT.ABILITY1, row);
  check('A23 the caster takes the fodder enemy', cast && PuppetState.puppet[player] === puppet && PuppetState.master[puppet] === player && Actors.team[puppet] === Actors.team[player]);
  const castAim = Actors.aimYaw[player];
  PuppetState.aimYaw[player] = castAim + 1;   // a stale copy: linked after this tick's drive, nothing was taken yet
  PuppetState.restore();
  check('A23 on the cast tick the caster keeps its own input (no stale copy handed back)', Actors.aimYaw[player] === castAim);
  Sim.step();
  Actors.moveX[player] = 0; Actors.moveZ[player] = 1; Actors.aimYaw[player] = 0; Actors.aimPitch[player] = 0; Actors.buttons[player] = 0;
  const casterX = Actors.x[player], casterZ = Actors.z[player], puppetZ = Actors.z[puppet];
  Sim.run(TICK_RATE / 2);
  check('A23 the caster\'s input walks and turns the puppet', Actors.z[puppet] - puppetZ > 1 && Math.abs(wrapAngle(Actors.yaw[puppet])) < 0.05, Actors.z[puppet] - puppetZ);
  check('A23 the caster\'s body stands still and keeps its input for the next step', length2(Actors.x[player] - casterX, Actors.z[player] - casterZ) < 0.05 && Actors.moveZ[player] === 1);
  check('A23 the camera rides the puppet\'s eyes and the puppet is hidden from its driver', (Render.view.alpha = 1, Render.cameraOverride(camera) === true)
    && Test.near(camera.z, Actors.z[puppet], 1e-6) && Test.near(camera.y, Actors.eyeY(puppet), 1e-6) && (abilityStyle(puppet, style), style.visible === false));
  const drawn = meshRecorder();
  Pve.draw(drawn);
  check('A23 the PvE draw skips the enemy its player drives (the camera is inside it)', drawn.meshes.length === 0, drawn.meshes.length);
  Render.view.alpha = 0.5;
  Render.cameraOverride(camera);
  Render.view.alpha = 1;
  check('A23 the puppet camera is interpolated between sim steps like followPlayer', Actors.z[puppet] > Actors.prevZ[puppet]
    && Test.near(camera.z, (Actors.prevZ[puppet] + Actors.z[puppet]) / 2, 1e-6), camera.z + ' ' + Actors.prevZ[puppet] + ' ' + Actors.z[puppet]);
  Actors.moveZ[player] = 0;
  const victim = Pve.spawnEnemy('husk', Actors.x[puppet], 0, Actors.z[puppet] + 1.2, Math.PI);
  Actors.buttons[player] = BTN.FIRE; Sim.run(2); Actors.buttons[player] = 0;
  check('A23 FIRE starts the puppet\'s attack on the foe under its crosshair', Pve.phase[puppet] !== ATTACK_PHASE.IDLE && Pve.attackTarget[puppet] === victim, Pve.phase[puppet] + ' ' + Pve.attackTarget[puppet]);
  Actors.moveZ[player] = 1; Actors.buttons[player] = BTN.FIRE;
  PuppetState.drive();   // 'puppet' already ran this step when the hit lands (projectiles: order 50)
  TestArena.hit(victim, player, 5);
  check('A23 a hit on the caster frees the puppet and gives the camera back', PuppetState.puppet[player] === -1 && PuppetState.master[puppet] === -1
    && Actors.team[puppet] === enemyTeam && !Abilities.active[Abilities.index(player, SLOT.ABILITY1)] && Render.cameraOverride(camera) === false);
  check('A23 control ending after the drive in the same step gives the caster its held input back at once', Actors.moveZ[player] === 1 && Actors.buttons[player] === BTN.FIRE,
    Actors.moveZ[player] + ' ' + Actors.buttons[player]);
  Actors.moveZ[player] = 0; Actors.buttons[player] = 0;
  TestArena.place(victim, 30, 30);
  TestArena.aimAt(player, puppet);
  const recast = Abilities.effects.possess.cast(player, row, SLOT.ABILITY1);
  Abilities.begin(player, SLOT.ABILITY1, row);
  killEnemy(puppet, player);
  Sim.run(3);   // the zone goes on its second step, the ability slot one step later
  check('A23 the puppet\'s death ends the control', PuppetState.puppet[player] === -1 && PuppetState.count === 0 && !Abilities.active[Abilities.index(player, SLOT.ABILITY1)],
    recast + ' ' + PuppetState.puppet[player]);
  Game.stop();
  World.clear();
});

// A23 from a co-op bot (X46 Powers for All): a plain team swap, the puppet's own brain fights for the bot and the bot keeps its input.
Test.add('abilities', (check) => {
  startPveTest({ player: { team: 0 }, bots: [{ team: 0 }] });
  let bot = -1;
  for (let id = 0; id < Actors.count; id++) if (Actors.kind[id] === ACTOR_KIND.BOT) bot = id;
  const row = CAT.abilities.byId('puppet');
  TestArena.place(Game.playerId, -20, 0);
  TestArena.place(bot, 3, 0);
  const puppet = Pve.spawnEnemy('husk', 3, 0, 6, Math.PI);
  TestArena.aimAt(bot, puppet);
  Abilities.setSlot(bot, SLOT.ABILITY1, row);
  const cast = Abilities.effects.possess.cast(bot, row, SLOT.ABILITY1);
  Abilities.begin(bot, SLOT.ABILITY1, row);
  Sim.step();
  Actors.moveZ[bot] = 1;
  PuppetState.drive();
  check('A23 a bot caster: the puppet joins its side but the bot drives nothing and keeps its own input', bot >= 0 && cast
    && Actors.team[puppet] === Actors.team[bot] && PuppetState.puppet[bot] === -1 && PuppetState.master[puppet] === -1 && PuppetState.count === 0 && Actors.moveZ[bot] === 1,
    cast + ' ' + PuppetState.puppet[bot] + ' ' + Actors.moveZ[bot]);
  Sim.run(3);
  check('A23 a bot caster: the ability runs on (its step hook does not end an unlinked cast)', !!Abilities.active[Abilities.index(bot, SLOT.ABILITY1)]);
  Game.stop();
  World.clear();
});

// A32 panics fodder (ability.panic -> S14 PvE broken morale); A03 throws the enemy in front on a melee swing.
Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({ family: 'pve' }), 'swarm');
  Actors.kind[t.enemy] = ACTOR_KIND.ENEMY; Actors.profile[t.enemy] = { fodder: true }; Pve.row[t.enemy] = 0;
  TestArena.aimAt(t.caster, t.enemy);
  let panics = 0;
  const listener = Bus.on('ability.panic', (event) => { if (event.id === t.enemy) panics++; });
  AbilityTest.cast(t);
  Bus.off('ability.panic', listener);
  check('A32 swarm on a fodder enemy panics it for the swarm time', panics === 1 && Test.near(Pve.brokenUntil[t.enemy] - Sim.time, t.row.duration, 1e-6), Pve.brokenUntil[t.enemy] - Sim.time);
  AbilityTest.give(t, 'colossusweave');
  AbilityTest.cast(t);
  Sim.run(1);
  TestArena.place(t.second, 0, 1.5);
  Actors.yaw[t.caster] = Actors.aimYaw[t.caster] = 0; Actors.pitch[t.caster] = Actors.aimPitch[t.caster] = 0;
  let thrown = null;
  const onImpulse = Bus.on('impulse', (event) => { if (event.id === t.second) thrown = Object.assign({}, event); });
  Bus.emit('weapon.fire', { id: t.caster, weapon: 'maul', weaponClass: 'melee', mode: 'melee', x: 0, y: 1.6, z: 0, dx: 0, dy: 0, dz: 1 });
  Bus.off('impulse', onImpulse);
  const params = t.row.params;
  check('A03 a melee swing throws the enemy in front along the view', thrown && Test.near(thrown.z, params.throwSpeed, 1e-4) && Test.near(thrown.y, params.throwLift, 1e-4), JSON.stringify(thrown));
  TestArena.finish();
});

// A03 with no enemy in reach: the breakable prop in front is thrown along the view with the W41 Lifter's impact damage.
Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'colossusweave');
  World.load({ id: 'a03-props', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }], props: [{ min: [-0.4, 1.2, 1], max: [0.4, 2, 1.8], mass: 20, health: 50 }] });
  AbilityTest.clearPath(t);
  AbilityTest.cast(t);
  Sim.run(1);
  Actors.yaw[t.caster] = Actors.aimYaw[t.caster] = 0; Actors.pitch[t.caster] = Actors.aimPitch[t.caster] = 0;
  Bus.emit('weapon.fire', { id: t.caster, weapon: 'maul', weaponClass: 'melee', mode: 'melee', x: 0, y: 1.6, z: 0, dx: 0, dy: 0, dz: 1 });
  let body = -1;
  for (let i = 0; i < BODY_CAPACITY; i++) if (Bodies.active[i] && Bodies.kind[i] === BODY_KIND.THROWN && Bodies.owner[i] === t.caster) body = i;
  check('A03 a melee swing throws the prop in front along the view', body >= 0 && !Props.isStanding(0) && Test.near(Bodies.vz[body], t.row.params.throwSpeed, 1e-3)
    && Bodies.impactCap[body] === LIFTER_DAMAGE_CAP, body >= 0 ? Bodies.vz[body] : -1);
  TestArena.finish();
});

// F43: a combo is four taps close together, not four direction changes at any pace.
Test.add('abilities', (check) => {
  const t = AbilityTest.start({ meter: 'adrenaline' });
  const walkForward = (gapSeconds) => {
    Actors.moveZ[t.caster] = 1; Sim.step();
    Actors.moveZ[t.caster] = 0; Sim.run(Math.round(gapSeconds * TICK_RATE));
  };
  Meters.points[t.caster] = 100;
  for (let k = 0; k < 4; k++) walkForward(1);
  check('F43 four forward walks one second apart do not cast the combo', !Abilities.isActive(t.caster, 'surgecombo') && Meters.points[t.caster] === 100);
  for (let k = 0; k < 4; k++) walkForward(0.15);
  check('F43 four quick forward taps cast the combo', Abilities.isActive(t.caster, 'surgecombo') && Meters.points[t.caster] === 0);
  TestArena.finish();
});

// F44 (R-100): A40 Rally Cry's extra shield is a timed pool inside the surplus cap.
Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({ meter: 'ultimate' }), 'rally');
  Damage.surplus[t.ally] = 80;
  AbilityTest.cast(t);
  runSeconds(0.1);
  const cap = RALLY_SURPLUS_CAP;
  check('F44 rally shield stops at the surplus cap', Damage.surplus[t.ally] === cap && Damage.surplus[t.caster] === 50, Damage.surplus[t.ally]);
  runSeconds(CAT.abilities.byId('rally').duration + 0.2);
  check('F44 rally shield is gone after its 8 s (earlier surplus stays)', Damage.surplus[t.ally] === 80 && Damage.surplus[t.caster] === 0, Damage.surplus[t.ally]);
  TestArena.finish();
});

// F45 (R-102): Tracker footprints last the full 8 s with many runners about, and a crouch-walk leaves none.
Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'tracker');
  AbilityTest.cast(t);
  const runners = [t.enemy, t.second];
  for (let k = 0; k < 6; k++) runners.push(TestArena.actor(1, -10 - k, 10, Math.PI));
  Footprints.clear();
  Bus.emit('move.step', { id: t.enemy, speed: 4, surface: '', loudness: 1 });
  const first = lastPrint(t.enemy);
  for (let step = 0; step < 29; step++) {
    runSeconds(0.25);
    for (const runner of runners) Bus.emit('move.step', { id: runner, speed: 4, surface: '', loudness: 1 });
  }
  check('F45 with eight runners about, an enemy print is still shown after 7.25 s', footprintVisible(t.caster, first), Sim.time);
  const before = Footprints.next[t.enemy];
  Bus.emit('move.step', { id: t.enemy, speed: 2, surface: '', loudness: 0.25 });
  Bus.emit('move.step', { id: t.enemy, speed: 0, surface: '', loudness: 0 });
  check('F45 a crouch-walk or a silent step leaves no print', Footprints.next[t.enemy] === before);
  TestArena.finish();
});

// F45 (R-107): targeted abilities use the shared nearest-seen picker: a cloaked enemy or one behind smoke is no target.
Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'binding');
  check('F45 an enemy in the cone is a target', aimTarget(t.caster, 30) === t.enemy);
  Actors.flags[t.enemy] |= ACTOR_FLAG.INVISIBLE;
  check('F45 a cloaked enemy in the cone is no target and the cast is refused', aimTarget(t.caster, 30) < 0 && !AbilityTest.cast(t));
  Actors.flags[t.enemy] &= ~ACTOR_FLAG.INVISIBLE;
  Smoke.spawn(CAT.gadgets.byId('smoke'), -1, 0, 1, 3);
  runSeconds(2);
  check('F45 an enemy behind smoke is no target', aimTarget(t.caster, 30) < 0);
  TestArena.finish();
});

// F45 (R-107): the picker orders by the crosshair, not by distance: a nearer enemy further off the aim line loses (A23 cone).
Test.add('abilities', (check) => {
  const t = AbilityTest.start({});
  TestArena.place(t.second, 1.5, 3);
  check('F45 the enemy on the crosshair is picked over a nearer one 27 deg off', aimTarget(t.caster, 30, 30) === t.enemy);
  check('F45 the range still holds: only the near one is in reach', aimTarget(t.caster, 5, 30) === t.second);
  TestArena.finish();
});
