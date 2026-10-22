// Self-tests for S12 grenades and gadgets: kits and carry limits, throw speeds, fuses and cooking, bounce / stick / impact,
// every grenade effect per its data row, smoke volumes (walls, line blocking, punching, expiry), flash by view angle, and
// deployables (caps, cooldowns, arming, triggers, damage, barrier brush, EMP, visibility, cleanup on death and match end).

// __CTK.gadgets / __CTK.items: inspect and drive S12 from the console or a --eval screenshot.
DebugApi.gadgets = { gadgets: Gadgets, thrown: Thrown, smoke: Smoke, areas: GadgetAreas, devices: Devices,
  device: (key, owner, x, y, z) => Devices.spawn(CAT.gadgets.byId(key), owner, x, y, z), effect: (key, owner, x, y, z) => GadgetEffects[CAT.gadgets.byId(key).effect](CAT.gadgets.byId(key), owner, x, y, z) };
DebugApi.items = { items: Items, powerups: Powerups, give: (id, key) => Powerups.give(id, CAT.powerups.byId(key), 0) };

const GadgetArena = {
  start(rules, brushes) {
    TestArena.start(Object.assign({ economy: 'pickups', teams: 2, mutators: [] }, rules || {}), brushes);
    Gadgets.clear(); Devices.clear();
  },
  // An actor facing +z (yaw 0) with a level view, holding `count` of a gadget row.
  actor(team, x, z, key, count) {
    const id = TestArena.actor(team, x, z, 0);
    Actors.pitch[id] = Actors.aimPitch[id] = 0;
    if (key) Gadgets.give(id, key, count === undefined ? 1 : count);
    if (key) Gadgets.select(id, key);
    return id;
  },
  // Holds BTN.GRENADE (plus extra buttons) for `seconds`, then lets go; the throw happens on the release step.
  throwAfter(id, seconds, extra) {
    Actors.buttons[id] = BTN.GRENADE | (extra || 0);
    Sim.run(Math.max(1, itemTicks(seconds)));
    Actors.buttons[id] = extra || 0;
    Sim.run(1);
    Actors.buttons[id] = 0;
  },
  press(id, button) { Actors.buttons[id] = button; Sim.run(1); Actors.buttons[id] = 0; Sim.run(1); },
  firstThrown() { for (let slot = 0; slot < THROWN_CAP; slot++) if (Thrown.state[slot]) return slot; return -1; },
  // Ticks until the first 'explosion' event of a gadget row (max `limit` seconds), or -1.
  ticksToBlast(key, limit) {
    let at = -1;
    const start = Sim.tick, handler = Bus.on('explosion', (event) => { if (event.source === key && at < 0) at = Sim.tick - start; });
    for (let step = 0; step < itemTicks(limit) && at < 0; step++) Sim.run(1);
    Bus.off('explosion', handler);
    return at;
  },
  device(key, owner, x, z) { return Devices.spawn(CAT.gadgets.byId(key), owner, x, 0, z); },
  armed(d) { Devices.armTick[d] = Sim.tick; },
};

Test.add('gadgets', (check) => {
  const missing = CAT.gadgets.filter((row) => !(row.kind === 'thrown' ? GadgetEffects[row.effect] : Devices.steps[row.effect]));
  check('G01..G24 every row has a behaviour', missing.length === 0, missing.map((row) => row.id).join(', '));
  const badKits = CAT.gadgetKits.filter((kit) => Object.keys(kit.grenades).concat(kit.gadget ? [kit.gadget] : []).some((key) => !CAT.gadgets.byId(key)));
  check('every kit names known gadget rows', badKits.length === 0, badKits.map((kit) => kit.id).join(', '));
  check('a smoke grid covers the largest smoke radius', SMOKE_HALF * SMOKE_CELL >= CAT.gadgets.byId('smoke').radius);
});

Test.add('gadgets', (check) => {
  GadgetArena.start({ economy: 'roundBuy' });
  const id = GadgetArena.actor(1, 0, 0);
  check('GAD-001 round buy: one of a type', Gadgets.give(id, 'frag', 3) === 1);
  check('GAD-001 round buy: two glare shells', Gadgets.give(id, 'flash', 3) === 2);
  Gadgets.give(id, 'smoke', 1);
  check('GAD-001 round buy: four in all', Gadgets.give(id, 'cryo', 1) === 0 && Gadgets.thrownTotal(id) === 4);
  GadgetArena.start({ economy: 'classes' });
  const spawned = GadgetArena.actor(1, 0, 0);
  Bus.emit('actor.spawn', { id: spawned });
  const hud = Gadgets.hudState(spawned, {});
  check('class kits on spawn: frag, glare shell and a barrier', Gadgets.countOf(spawned, 'frag') === 1 && Gadgets.countOf(spawned, 'flash') === 1 && hud.gadget === 'Barrier Deploy', JSON.stringify(hud));
  GadgetArena.start({ economy: 'pickups' });
  const refill = GadgetArena.actor(1, 0, 0);
  Items.addAllAmmo(refill, CAT.items.byId('ammocache'));
  check('ammo caches refill kit grenades (pickups economy)', Gadgets.countOf(refill, 'frag') === 1);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const id = GadgetArena.actor(1, 0, 0, 'frag', 2);
  GadgetArena.throwAfter(id, 0);
  const slot = GadgetArena.firstThrown();
  check('GAD-002 overhand 18 m/s forward, 5 up', slot >= 0 && Test.near(Thrown.vz[slot], 18, 0.01) && Test.near(Thrown.vy[slot], 5, 0.5), slot >= 0 ? Thrown.vz[slot] + ' ' + Thrown.vy[slot] : 'none');
  check('a throw spends one', Gadgets.countOf(id, 'frag') === 1);
  const blast = GadgetArena.ticksToBlast('frag', 4);
  check('G01 fuse 2.5 s after the throw', Math.abs(blast - itemTicks(2.5) + 1) <= 2, blast);
  Gadgets.clear();
  GadgetArena.throwAfter(id, 0, BTN.ALT);
  const under = GadgetArena.firstThrown();
  check('GAD-002 underhand on ALT is slower', under >= 0 && Test.near(Thrown.vz[under], GADGET_TUNING.underhandSpeed, 0.01));
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start({ selfDamage: 1 });
  const id = GadgetArena.actor(1, 0, 0, 'frag', 2);
  GadgetArena.throwAfter(id, 1);
  const blast = GadgetArena.ticksToBlast('frag', 3);
  check('G01 cooking 1 s leaves 1.5 s of fuse', Math.abs(blast - itemTicks(1.5) + 1) <= 2, blast);
  Damage.resetHealth(id);
  Actors.buttons[id] = BTN.GRENADE;
  const inHand = GadgetArena.ticksToBlast('frag', 3);
  Actors.buttons[id] = 0;
  check('a fully cooked grenade goes off in the hand', Math.abs(inHand - itemTicks(2.5)) <= 2 && Actors.health[id] < 100, inHand + ' / ' + Actors.health[id]);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start({}, [{ shape: 'box', min: [-5, 0, 6], max: [5, 4, 7] }]);
  const id = GadgetArena.actor(1, 0, 0, 'frag', 1);
  const bounces = TestArena.count('projectile.bounce', () => { GadgetArena.throwAfter(id, 0); Sim.run(TICK_RATE); });
  const slot = GadgetArena.firstThrown();
  check('G01 bounces off a wall with a tick', bounces >= 1 && slot >= 0 && Thrown.z[slot] < 6, bounces);
  Gadgets.clear();
  const target = GadgetArena.actor(2, 0, 3);
  Gadgets.give(id, 'sticky', 1); Gadgets.select(id, 'sticky');
  Actors.pitch[id] = Actors.aimPitch[id] = -0.35;   // a flat throw that meets the body
  GadgetArena.throwAfter(id, 0);
  Sim.run(30);
  const stuck = GadgetArena.firstThrown();
  check('G06 sticks to an actor', stuck >= 0 && Thrown.state[stuck] === THROWN_STATE.ATTACHED && Thrown.attached[stuck] === target);
  Sim.run(itemTicks(1.5) - 20);
  check('G06 goes off on its fuse and hurts the carrier', GadgetArena.firstThrown() < 0 && Actors.health[target] < 100, Actors.health[target]);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 1), fire = CAT.gadgets.byId('incendiary');
  GadgetEffects.fire(fire, owner, 0, 0, 1);
  Sim.run(itemTicks(1));
  const early = 100000 - Actors.health[target];
  Sim.run(itemTicks(5));
  const late = 100000 - Actors.health[target] - early;
  check('G04 fire hurts and burns', early > 0 && Damage.hasStatus(target, 'burn'), early);
  check('G04 fire ramps up', late / 5 > early, early + ' then ' + late / 5 + '/s');
  Sim.run(itemTicks(2));
  check('G04 fire ends after 7 s', !GadgetAreas.active.some((on) => on));
  GadgetEffects.fire(fire, owner, 0, 0, 1);
  Smoke.spawn(CAT.gadgets.byId('smoke'), owner, 0, 0.5, 1);
  Sim.run(itemTicks(2));
  check('G04 smoke puts fire out', !GadgetAreas.active.some((on) => on));
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start({}, [{ shape: 'box', min: [-10, 0, 13], max: [10, 6, 14] }]);
  const smoke = CAT.gadgets.byId('smoke');
  Smoke.spawn(smoke, -1, 0, 1, 10);
  check('G02 starts small', !Smoke.lineBlocked(-6, 1, 7, 6, 1, 7));
  Sim.run(itemTicks(GADGET_TUNING.smokeExpandSeconds));
  check('G02 blocks a line through it', Smoke.lineBlocked(-8, 1, 10, 8, 1, 10));
  check('G02 does not block a line beside it', !Smoke.lineBlocked(-8, 1, 20, 8, 1, 20) && !Smoke.lineBlocked(10, 1, 0, 10, 1, 20));
  check('G02 does not pass through walls', Smoke.covers(0, 1, 12) && !Smoke.covers(0, 1, 14.6));
  Smoke.punchRay(-8, 1, 10, 1, 0, 0, 16);
  check('G02 bullets punch a hole', !Smoke.lineBlocked(-8, 1, 10, 8, 1, 10));
  Sim.run(itemTicks(GADGET_TUNING.smokePunchSeconds) + 1);
  check('G02 the hole closes after 2 s', Smoke.lineBlocked(-8, 1, 10, 8, 1, 10));
  Bus.emit('explosion', { x: 0, y: 1, z: 10, radius: 3, owner: -1, source: 'test', element: 'kinetic' });
  check('G02 blasts clear the cells around them', !Smoke.covers(0, 1, 10) && Smoke.covers(0, 1, 6));
  Sim.run(itemTicks(smoke.duration));
  check('G02 is gone after 18 s', Smoke.count === 0 && !Smoke.lineBlocked(-8, 1, 10, 8, 1, 10));
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, -20), facing = GadgetArena.actor(2, -3, 0), away = GadgetArena.actor(2, 3, 0), flash = CAT.gadgets.byId('flash');
  Actors.yaw[facing] = 0; Actors.yaw[away] = Math.PI;
  GadgetEffects.flash(flash, owner, 0, 1.6, 6);
  const facingSeconds = Damage.statusTime[facing * STATUS_COUNT + BLIND_INDEX], awaySeconds = Damage.statusTime[away * STATUS_COUNT + BLIND_INDEX];
  check('G03 facing the flash blinds longer', facingSeconds > awaySeconds * 3 && awaySeconds > 0, facingSeconds + ' / ' + awaySeconds);
  check('G03 never more than its 3.5 s', facingSeconds <= flash.duration + 1e-6);
  check('the HUD reads the blind share', Gadgets.blindAmount(facing) > Gadgets.blindAmount(away));
  check('G03 the thrower\'s team is spared without friendly fire', Damage.statusTime[owner * STATUS_COUNT + BLIND_INDEX] === 0);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, -10), near = TestArena.sponge(2, 0, 2), far = TestArena.sponge(2, 0, 15);
  GadgetEffects.freeze(CAT.gadgets.byId('cryo'), owner, 0, 0.5, 0);
  check('G08 freezes enemies in reach only', Damage.hasStatus(near, 'freeze') && !Damage.hasStatus(far, 'freeze'));
  TestArena.place(near, 0, 2);
  GadgetEffects.impulse(CAT.gadgets.byId('impulse'), owner, 0, 0.5, 0);
  check('G07 knocks enemies away', Actors.vz[near] > 1, Actors.vz[near]);
  GadgetEffects.dart(CAT.gadgets.byId('dart'), owner, 0, 1, 0);
  Sim.run(itemTicks(1.1));
  check('G19 pulses reveal enemies in reach', Damage.hasStatus(far, 'reveal') === false && Damage.hasStatus(near, 'reveal'));
  const decoy = CAT.gadgets.byId('decoy');
  let shots = 0;
  const handler = Bus.on('sound', (event) => { if (event.kind === 'shot') shots++; });
  GadgetEffects.decoy(decoy, owner, 5, 0, 5);
  Sim.run(itemTicks(decoy.duration) + 1);
  Bus.off('sound', handler);
  check('G05 fake shots for 15 s', Math.abs(shots - decoy.duration * decoy.rate) <= 1, shots);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, -10), target = TestArena.sponge(2, 4, 0), sink = CAT.gadgets.byId('singularity');
  GadgetEffects.singularity(sink, owner, 0, 1, 0);
  Sim.run(10);
  check('G09 pulls enemies to the centre', Actors.vx[target] < 0, Actors.vx[target]);
  const blast = GadgetArena.ticksToBlast('singularity', sink.duration + 1);
  check('G09 goes off after 4 s', Math.abs(blast - itemTicks(sink.duration) + 10) <= 2, blast);
  const emp = CAT.gadgets.byId('emp'), victim = GadgetArena.actor(2, 2, 2, 'frag', 1), turret = GadgetArena.device('sentry', victim, 3, 3);
  GadgetEffects.emp(emp, owner, 2, 1, 2);
  check('G20 suppresses enemies and disables their devices', Gadgets.suppressed(victim) && !Devices.working(turret));
  GadgetArena.throwAfter(victim, 0);
  check('G20 no grenades while suppressed', GadgetArena.firstThrown() < 0 && Gadgets.countOf(victim, 'frag') === 1);
  Sim.run(itemTicks(emp.duration));
  check('G20 wears off after 4 s', !Gadgets.suppressed(victim) && Devices.working(turret));
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0, 'cover', 1);
  const hud = {};
  GadgetArena.press(owner, BTN.GADGET);
  check('G13 BTN.GADGET sets a barrier with a brush', Devices.count === 1 && World.dynamic.length === 1);
  check('G13 the barrier stops shots', World.raycast(0, 1, 0, 0, 0, 1, 5, makeHit()));
  Gadgets.hudState(owner, hud);
  check('cooldown shows on the HUD', hud.gadgetCount === 0 && hud.gadgetCooldown > 0.9, JSON.stringify(hud));
  Sim.run(itemTicks(CAT.gadgets.byId('cover').cooldown));
  check('G13 ends after 30 s and recharges after 60 s', Devices.count === 0 && World.dynamic.length === 0 && Gadgets.countOf(owner, 'cover') === 1);
  GadgetArena.press(owner, BTN.GADGET);
  Gadgets.give(owner, 'cover', 1);
  GadgetArena.press(owner, BTN.GADGET);
  check('GAD-003 one barrier per owner', Devices.count === 1 && Gadgets.countOf(owner, 'cover') === 1);
  const enemy = GadgetArena.actor(2, 10, 10);
  let d = 0;
  while (!Devices.active[d]) d++;
  check('allies cannot break it', !Devices.damage(d, 1000, owner) && Devices.active[d] === 1);
  check('G13 destroyed by damage, brush gone', Devices.damage(d, 300, enemy) && World.dynamic.length === 0 && Devices.count === 0);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0), mine = GadgetArena.device('claymore', owner, 0, 0), enemy = TestArena.sponge(2, 0, 2);
  Actors.buttons[enemy] = BTN.CROUCH;
  Sim.run(itemTicks(2));
  check('G10 crouching passes a tripjaw mine', Devices.active[mine] === 1 && (Actors.flags[enemy] & ACTOR_FLAG.CROUCHED) !== 0);
  TestArena.place(enemy, 0, -2);
  Actors.buttons[enemy] = 0;
  Sim.run(itemTicks(1));
  check('G10 only its 60 degree cone sets it off', Devices.active[mine] === 1);
  TestArena.place(enemy, 0, 2);
  Sim.run(2);
  check('G10 an enemy in front sets it off', Devices.active[mine] === 0 && Actors.health[enemy] < 100000);
  const prox = GadgetArena.device('prox', owner, 10, 10), passer = TestArena.sponge(2, 10, 11);
  Sim.run(itemTicks(1));
  check('G11 waits 2 s to arm', Devices.active[prox] === 1);
  Sim.run(itemTicks(1.1));
  check('G11 goes off once armed', Devices.active[prox] === 0 && Actors.health[passer] < 100000);
  const shotMine = GadgetArena.device('prox', owner, 20, 20);
  const shooter = GadgetArena.actor(2, 20, 15);
  const gun = CAT.weapons.find((weapon) => weapon.primary.type === 'hitscan' && weapon.primary.damage >= 30);
  Bus.emit('weapon.fire', { id: shooter, weapon: gun.id, weaponClass: '', mode: 'primary', x: 20, y: 0.09, z: 15, dx: 0, dy: 0, dz: 1 });
  check('mines break when shot', Devices.active[shotMine] === 0);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, -3, 0), enemy = TestArena.sponge(2, 0, 10);
  const turret = GadgetArena.device('sentry', owner, 0, 0);
  Sim.run(TICK_RATE);
  check('G15 the turret shoots enemies in range', Actors.health[enemy] < 100000 && Devices.target[turret] === enemy, Actors.health[enemy]);
  Devices.remove(turret, false);
  const ticks = Devices.room(owner, CAT.gadgets.byId('ticks'));
  check('G21 two scuttlers per owner', ticks === 2);
  const drone = GadgetArena.device('ticks', owner, 0, 0);
  Sim.run(itemTicks(3));
  check('G21 a scuttler runs to an enemy and goes off', Devices.active[drone] === 0 && Actors.health[enemy] < 100000);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0), friend = GadgetArena.actor(1, 1, 0), enemy = GadgetArena.actor(2, -1, 0);
  Actors.health[friend] = 50; Actors.health[enemy] = 50;
  GadgetArena.device('regen', owner, 0, 0);
  Sim.run(TICK_RATE);
  check('G16 heals everyone inside, enemies too', Test.near(Actors.health[friend], 65, 0.5) && Test.near(Actors.health[enemy], 65, 0.5), Actors.health[friend] + ' / ' + Actors.health[enemy]);
  Devices.clear();
  Actors.maxShield[enemy] = Actors.shield[enemy] = 100; Actors.maxShield[friend] = Actors.shield[friend] = 100;
  const healthBefore = Actors.health[enemy];
  GadgetArena.device('drain', owner, 0, 0);
  Sim.run(TICK_RATE);
  check('G17 drains enemy shields only', Actors.shield[enemy] < 100 && Actors.health[enemy] === healthBefore && Actors.shield[friend] === 100, Actors.shield[enemy]);
  Devices.clear();
  GadgetArena.device('jammer', owner, 0, 0);
  check('G18 jams enemies nearby, not friends', Gadgets.jammed(enemy) && !Gadgets.jammed(friend));
  Devices.clear();
  const weapon = ItemArena.plainWeapon(), slot = Weapons.slotIndex(friend, weapon.index);
  Weapons.give(friend, weapon.id, 0); Weapons.reserve[slot] = 0;
  GadgetArena.device('ammobox', owner, 0, 0);
  Sim.run(TICK_RATE + 1);
  const share = Math.round(Weapons.maxReserve(friend, weapon) * CAT.gadgets.byId('ammobox').amount);
  check('G23 the supply crate refills friends 20 % a second', Weapons.reserve[slot] === share, Weapons.reserve[slot] + ' / ' + share);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0), enemy = GadgetArena.actor(2, 0, 20, 'frag', 2);
  Actors.yaw[enemy] = Actors.aimYaw[enemy] = Math.PI;
  const snatcher = GadgetArena.device('trophy', owner, 0, 10);
  GadgetArena.throwAfter(enemy, 0);
  Sim.run(TICK_RATE);
  check('G22 removes an enemy grenade in flight', GadgetArena.firstThrown() < 0 && Devices.charges[snatcher] === 2, Devices.charges[snatcher]);
  Devices.clear();
  GadgetArena.device('bubble', owner, 0, 10);
  GadgetArena.throwAfter(enemy, 0);
  Sim.run(TICK_RATE);
  check('G12 the dome stops grenades coming in', GadgetArena.firstThrown() < 0);
  Devices.clear();
  const pad = GadgetArena.device('liftpad', owner, 5, 5), jumper = GadgetArena.actor(1, 5, 5);
  Actors.y[jumper] = CAT.gadgets.byId('liftpad').size[1];
  Sim.run(1);
  const expected = Math.sqrt(2 * Move.gravity(jumper) * CAT.gadgets.byId('liftpad').launch);
  check('G14 the lift pad throws up to its height', Devices.active[pad] === 1 && Actors.vy[jumper] > expected * 0.8, Actors.vy[jumper] + ' / ' + expected);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0), friend = GadgetArena.actor(1, 30, 30), enemy = GadgetArena.actor(2, 0, 20);
  const beacon = GadgetArena.device('beacon', owner, 10, 10);
  check('G24 one beacon per team', Devices.room(friend, CAT.gadgets.byId('beacon')) === 0);
  Bus.emit('actor.spawn', { id: friend });
  check('G24 teammates spawn at the beacon', Math.hypot(Actors.x[friend] - 10, Actors.z[friend] - 10) <= 1.5, Actors.x[friend] + ',' + Actors.z[friend]);
  const mine = GadgetArena.device('prox', owner, 0, 5);
  check('GAD-003 enemy mines glint only within 8 m', !Devices.visibleTo(mine, enemy) && Devices.visibleTo(mine, friend));
  TestArena.place(enemy, 0, 10);
  check('GAD-003 visible to the enemy within 8 m', Devices.visibleTo(mine, enemy));
  ItemArena.kill(owner);
  check('devices are removed when the owner dies', !Devices.active[beacon] && !Devices.active[mine] && Devices.count === 0);
  GadgetArena.device('sentry', friend, 3, 3);
  Smoke.spawn(CAT.gadgets.byId('smoke'), friend, 0, 1, 0);
  Bus.emit('match.end', {});
  check('match end clears devices, smoke and grenades', Devices.count === 0 && Smoke.count === 0 && GadgetArena.firstThrown() < 0);
  TestArena.finish();
});
