// Self-tests for S12 abilities: the framework (cooldowns, charges, energy, fuel, souls, the match meters, groups,
// interrupts, cleanup on death and at match end), one cast-and-effect check per CAT.abilities row (A01..A40, AX1..AX7)
// and the hero kits H01..H08 (pools, weapons, movement). Actors stand on TestArena's floor facing +z.

const ENEMY_DISTANCE = 6;

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
    Meters.energy[t.caster] = ENERGY_MAX;
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
    if (row.resource === 'energy') return Test.near(Meters.energy[t.caster], ENERGY_MAX - row.cost, 1e-4);
    if (row.resource === 'ultimate') return Test.near(Meters.points[t.caster], pointsBefore - Meters.ultimateCost(row), 1e-3);
    if (row.resource === 'souls') return Meters.souls[t.caster] === 0;
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
  overdrive: { seconds: 1, expect: (t) => Buffs.get(t.caster, BUFF.SPEED) === 1.5 && Meters.energy[t.caster] === ENERGY_MAX },   // drains only while sprinting
  colossusweave: { seconds: 0.1, expect: (t) => Buffs.get(t.caster, BUFF.MELEE) === 2 },
  phantasm: { rules: { health: 'suit' }, seconds: 1, expect: (t) => Buffs.has(t.caster, BUFF.INVISIBLE) && Test.near(Meters.energy[t.caster], ENERGY_MAX - 2, 0.05) },
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
  huntersight: { rules: { health: 'suit' }, seconds: 1, expect: (t) => Damage.hasStatus(t.enemy, 'reveal') && Test.near(Meters.energy[t.caster], ENERGY_MAX - 5, 0.05) },
  scoutdrone: {
    seconds: 0.5,
    expect: (t) => {
      const flying = AbilityTest.zoneOf(t, ZONE_KIND.DRONE) >= 0 && Buffs.has(t.caster, BUFF.NO_FIRE);
      TestArena.hit(t.enemy, t.caster, 5);
      return flying && !Abilities.active[t.i] && AbilityTest.zoneOf(t, ZONE_KIND.DRONE) < 0;   // damage ends the channel
    },
  },
  tracker: { seconds: 1, expect: (t) => Abilities.active[t.i] === 1 },
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
  timebend: { seconds: 0.1, expect: (t) => Test.near(Move.statusSpeedScale[t.enemy], 0.25, 1e-4) && Move.statusSpeedScale[t.caster] === 1 },
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
  ampwall: { seconds: 0.1, expect: (t) => { const z = AbilityTest.zoneOf(t, ZONE_KIND.WALL); return z >= 0 && Test.near(AbilityZones.z[z], 1.5, 0.01); } },
  arcbolt: { setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 0, expect: (t) => Actors.health[t.enemy] === 70 && Damage.hasStatus(t.enemy, 'shock') },
  ignite: { setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 0, expect: (t) => Actors.health[t.enemy] === 90 && Damage.hasStatus(t.enemy, 'burn') },
  frostlance: {
    setup: (t) => TestArena.aimAt(t.caster, t.enemy), seconds: 0,
    expect: (t) => Actors.health[t.enemy] === 90 && (Damage.hasStatus(t.enemy, 'chill') || Damage.hasStatus(t.enemy, 'freeze')),
  },
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
  wrath: { setup: (t) => { Meters.souls[t.caster] = 66; }, seconds: 0.1, expect: (t) => Abilities.active[t.i] === 1 && Buffs.has(t.caster, BUFF.TOUCH_KILL) },
  lifterpower: { rules: { health: 'suit' }, seconds: 1, expect: (t) => Test.near(Meters.energy[t.caster], ENERGY_MAX - 10, 0.1) && Abilities.active[t.i] === 1 },
  gatepair: { rules: { family: 'solo' }, seconds: 0, expect: (t) => GateState.next[t.caster] === 1 },
  overcore: { seconds: 0.1, expect: (t) => { TestArena.hit(t.caster, t.enemy, 10); return Actors.health[t.enemy] === 80; } },
  orbital: {
    setup: (t) => TestArena.aimAt(t.caster, t.enemy, ZONE.LEGS), seconds: 1.9,
    expect: (t) => { const before = Actors.alive[t.enemy]; runSeconds(0.15); return before && !Actors.alive[t.enemy]; },
  },
  rift: { seconds: 0.1, expect: (t) => { const z = AbilityTest.zoneOf(t, ZONE_KIND.RIFT); return z >= 0 && AbilityZones.other[AbilityZones.other[z]] === z; } },
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

Test.add('abilities', (check) => {
  const t = AbilityTest.give(AbilityTest.start({}), 'echopulse');
  const hud = { slots: [], meter: { kind: '', value: 0, ready: false, energy: 0, souls: 0 } };
  Abilities.hudState(t.caster, hud);
  check('HUD: one slot, ready', hud.slots.length === 1 && hud.slots[0].ready && hud.slots[0].id === 'echopulse' && hud.meter.kind === 'energy');
  AbilityTest.cast(t);
  runSeconds(1);
  Abilities.hudState(t.caster, hud);
  check('HUD: cooldown fraction and remaining time', Test.near(hud.slots[0].cooldown, 19 / 20, 1e-3) && Test.near(hud.slots[0].remaining, 2, 0.01) && hud.slots[0].active, JSON.stringify(hud.slots[0]));
  TestArena.finish();
});
