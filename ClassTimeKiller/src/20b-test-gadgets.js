// Self-tests for S12 grenades and gadgets: kits and carry limits, throw speeds, fuses and cooking, bounce / stick / impact,
// every grenade effect per its data row, smoke volumes (walls, line blocking, punching, expiry), flash by view angle, and
// deployables (caps, cooldowns, arming, triggers, damage, barrier brush, EMP, visibility, cleanup on death and match end).

// __CTK.gadgets / __CTK.items: inspect and drive S12 from the console or a --eval screenshot.
DebugApi.gadgets = { gadgets: Gadgets, thrown: Thrown, smoke: Smoke, areas: GadgetAreas, devices: Devices,
  device: (key, owner, x, y, z) => Devices.spawn(CAT.gadgets.byId(key), owner, x, y, z),
  effect: (key, owner, x, y, z) => GadgetEffects[CAT.gadgets.byId(key).effect](CAT.gadgets.byId(key), owner, x, y, z) };
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
  // Holds the grenade button 10 ticks, runs block() one tick before letting go.
  holdThen(id, block) { Actors.buttons[id] = BTN.GRENADE; Sim.run(10); block(); Sim.run(1); Actors.buttons[id] = 0; Sim.run(2); },
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
  armed(device) { Devices.armTick[device] = Sim.tick; },
};

// R-156 / R-190: every pool takes a free slot, else the one that ends (or began) first, through one helper.
Test.add('gadgets', (check) => {
  check('oldestFreeSlot: a free slot first, else the smallest age', oldestFreeSlot([1, 0, 1], [5, 9, 1], 3) === 1 && oldestFreeSlot([1, 1, 1], [5, 9, 1], 3) === 2);
  GadgetAreas.clear();
  for (let area = 0; area < AREA_CAP; area++) GadgetAreas.spawn(CAT.gadgets[0], -1, 0, 0, 0, area === 5 ? 1 : 10);
  check('a full GadgetAreas pool reuses the earliest-ending area', GadgetAreas.spawn(CAT.gadgets[0], -1, 0, 0, 0, 10) === 5);
  GadgetAreas.clear();
});

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
  const kitted = Gadgets.countOf(spawned, 'frag') === 1 && Gadgets.countOf(spawned, 'flash') === 1 && hud.gadget === 'Barrier Deploy';
  check('class kits on spawn: frag, glare shell and a barrier', kitted, JSON.stringify(hud));
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
  const overhand = slot >= 0 && Test.near(Thrown.vz[slot], 18, 0.01) && Test.near(Thrown.vy[slot], 5, 0.5);
  check('GAD-002 overhand 18 m/s forward, 5 up', overhand, slot >= 0 ? Thrown.vz[slot] + ' ' + Thrown.vy[slot] : 'none');
  check('a throw spends one', Gadgets.countOf(id, 'frag') === 1);
  const blast = GadgetArena.ticksToBlast('frag', 4);
  check('G01 fuse 2.5 s after the throw', Math.abs(blast - itemTicks(2.5) + 1) <= 2, blast);
  Gadgets.clear();
  GadgetArena.throwAfter(id, 0, BTN.ALT);
  const under = GadgetArena.firstThrown();
  check('GAD-002 underhand on ALT is slower', under >= 0 && Test.near(Thrown.vz[under], GADGET_TUNING.underhandSpeed, 0.01));
  Gadgets.clear();
  Weapons.setLoadout(id, ['warden']);
  Gadgets.give(id, 'frag', 1);
  Sim.run(itemTicks(1));   // the pistol is out
  const thrownShots = TestArena.count('weapon.fire', () => GadgetArena.throwAfter(id, 0.2, BTN.ALT));
  Sim.run(itemTicks(1));
  const altShots = TestArena.count('weapon.fire', () => GadgetArena.press(id, BTN.ALT));
  check('GAD-002 the underhand throw does not fire the weapon alt (ALT alone still does)', GadgetArena.firstThrown() >= 0 && thrownShots === 0 && altShots > 0, thrownShots + ' / ' + altShots);
  Gadgets.clear();
  Weapons.setLoadout(id, ['verdict']);
  Gadgets.give(id, 'frag', 1);
  Sim.run(itemTicks(1));   // the scoped rifle is out
  Actors.buttons[id] = BTN.GRENADE | BTN.ALT;
  Sim.run(itemTicks(0.2));
  const sights = Weapons.ads[id];
  Actors.buttons[id] = 0;
  check('GAD-002 holding ALT for an underhand throw does not raise a zoom alt\'s sights', sights === 0, sights);
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
  Meters.energy[victim] = 60;
  GadgetEffects.emp(emp, owner, 2, 1, 2);
  check('G20 suppresses enemies and disables their devices', Gadgets.suppressed(victim) && !Devices.working(turret));
  check('G20 also empties the suit energy of those it reaches (the merged Sap Field)', Meters.energy[victim] === 0, Meters.energy[victim]);
  GadgetArena.throwAfter(victim, 0);
  check('G20 no grenades while suppressed', GadgetArena.firstThrown() < 0 && Gadgets.countOf(victim, 'frag') === 1);
  Sim.run(itemTicks(emp.duration));
  check('G20 wears off after 4 s', !Gadgets.suppressed(victim) && Devices.working(turret));
  TestArena.finish();
});

// ECP04 Tune Up: a field upgrade recharges rechargeScale times faster.
Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0, 'cover', 1), cooldown = CAT.gadgets.byId('cover').cooldown;
  Abilities.rechargeScale[owner] = 2;
  GadgetArena.press(owner, BTN.GADGET);
  const spent = Gadgets.countOf(owner, 'cover') === 0, ring = Gadgets.hudState(owner, {}).gadgetCooldown;
  check('ECP04 Tune Up: the HUD recharge ring starts full', ring > 0.95, ring);
  Sim.run(itemTicks(cooldown / 2) + 1);
  check('ECP04 Tune Up halves the field upgrade recharge at scale 2', spent && Gadgets.countOf(owner, 'cover') === 1);
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
  let device = 0;
  while (!Devices.active[device]) device++;
  check('allies cannot break it', !Devices.damage(device, 1000, owner) && Devices.active[device] === 1);
  check('G13 destroyed by damage, brush gone', Devices.damage(device, 300, enemy) && World.dynamic.length === 0 && Devices.count === 0);
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
  const shotMine = GadgetArena.device('claymore', owner, 20, 20);
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
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0), friend = GadgetArena.actor(1, 30, 30), enemy = GadgetArena.actor(2, 0, 20);
  const beacon = GadgetArena.device('beacon', owner, 10, 10);
  check('G24 one beacon per team', Devices.room(friend, CAT.gadgets.byId('beacon')) === 0);
  Bus.emit('actor.spawn', { id: friend });
  check('G24 teammates spawn at the beacon', Math.hypot(Actors.x[friend] - 10, Actors.z[friend] - 10) <= 1.5, Actors.x[friend] + ',' + Actors.z[friend]);
  check('G24 the beacon spawn sets the previous position too (no interpolation smear)', Actors.prevX[friend] === Actors.x[friend] && Actors.prevZ[friend] === Actors.z[friend]);
  const mine = GadgetArena.device('claymore', owner, 0, 5);
  check('GAD-003 enemy mines glint only within 8 m', !Devices.visibleTo(mine, enemy) && Devices.visibleTo(mine, friend));
  TestArena.place(enemy, 0, 10);
  check('GAD-003 visible to the enemy within 8 m', Devices.visibleTo(mine, enemy));
  ItemArena.kill(owner);
  check('devices are removed when the owner dies, the G24 beacon stays', Devices.active[beacon] === 1 && !Devices.active[mine] && Devices.count === 1);
  GadgetArena.device('sentry', friend, 3, 3);
  Smoke.spawn(CAT.gadgets.byId('smoke'), friend, 0, 1, 0);
  Bus.emit('match.end', {});
  check('match end clears devices, smoke and grenades', Devices.count === 0 && Smoke.count === 0 && GadgetArena.firstThrown() < 0);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start({ friendlyFire: 1 });
  const owner = GadgetArena.actor(1, 0, 0, 'cover', 1), blocker = GadgetArena.actor(1, 0, 2);
  GadgetArena.press(owner, BTN.GADGET);
  check('G13 is not set on top of a body', Devices.count === 0 && Gadgets.countOf(owner, 'cover') === 1);
  const mate = TestArena.sponge(1, 3, 8);
  const turret = GadgetArena.device('sentry', owner, 3, 3);
  Sim.run(TICK_RATE);
  check('turrets never shoot teammates, even with friendly fire', Actors.health[mate] === 100000 && Devices.target[turret] === -1);
  check('friendly fire lets teammates break devices, never the owner', !Devices.damage(turret, 500, owner) && Devices.damage(turret, 500, blocker));
  TestArena.finish();
});

// Health lost by a sponge `distance` metres beside a blast of the row 1 m up (the owner stands far away).
function gadgetBlastLoss(row, owner, target, distance) {
  TestArena.place(target, distance, 0);
  Actors.health[target] = Actors.maxHealth[target];
  gadgetBlast(row, owner, 0, 1, 0);
  return Actors.maxHealth[target] - Actors.health[target];
}
const BLAST_EFFECTS = ['explode', 'singularity', 'mine', 'drones', 'impulse'];

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, -40), target = TestArena.sponge(2, 0, 0), failures = [];
  const rows = CAT.gadgets.filter((row) => row.damage > 0 && row.radius > 0 && BLAST_EFFECTS.includes(row.effect));
  rows.forEach((row) => {
    const centre = gadgetBlastLoss(row, owner, target, 0), inside = gadgetBlastLoss(row, owner, target, row.radius - 0.5);
    const outside = gadgetBlastLoss(row, owner, target, row.radius + 0.5);
    if (!Test.near(centre, row.damage, row.damage * 0.02)) failures.push(row.id + ' centre ' + centre + ' / ' + row.damage);
    if (inside <= 0 || inside >= centre) failures.push(row.id + ' inside ' + inside);
    if (outside !== 0) failures.push(row.id + ' outside ' + outside);
  });
  check('blast rows: full damage at the centre, less inside the radius, none just outside', rows.length >= 5 && failures.length === 0, failures.join('; '));
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start({ health: 'shield' });
  const owner = GadgetArena.actor(1, 0, -10), victim = GadgetArena.actor(2, 0, 0), emp = CAT.gadgets.byId('emp');
  Actors.shield[victim] = 10; Actors.health[victim] = 20;
  Damage.lastDamageTime[victim] = Sim.time - 100;   // both regeneration delays are long over
  GadgetEffects.emp(emp, owner, 0, 1, 0);
  Sim.run(TICK_RATE);
  check('G20 health regeneration goes on under EMP', Actors.health[victim] > 20, Actors.health[victim]);
  check('G20 shields do not recharge under EMP', Actors.shield[victim] === 10, Actors.shield[victim]);
  Sim.run(itemTicks(emp.duration) - TICK_RATE - 1);
  const stillBlocked = Actors.shield[victim] === 10;
  Sim.run(2);
  check('G20 shields recharge right after its 4 s', stillBlocked && Actors.shield[victim] > 10, Actors.shield[victim]);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const shooter = GadgetArena.actor(1, 0, 0), target = GadgetArena.actor(2, 0, 10), point = Vec.make();
  check('aim assist finds an enemy in front', Input.findAssistTarget(shooter, point));
  Smoke.spawn(CAT.gadgets.byId('smoke'), -1, 0, 1.5, 5);
  Sim.run(itemTicks(GADGET_TUNING.smokeExpandSeconds));
  check('aim assist never locks through smoke', !Input.findAssistTarget(shooter, point));
  Input.aimAssistTarget = (id, out) => { Hitbox.point(target, ZONE.BODY, out); return true; };
  check('the smoke filter stays when another section fills the hook', !Input.findAssistTarget(shooter, point));
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, -5), enemy = TestArena.sponge(2, 0, 15), ticks = CAT.gadgets.byId('ticks');
  Actors.flags[enemy] |= ACTOR_FLAG.INVISIBLE;
  const drone = GadgetArena.device('ticks', owner, 0, 0);
  Sim.run(TICK_RATE);
  const beyond = 15 > ticks.range * DEVICE_INVISIBLE_SHARE;
  check('G21 drones do not see a cloaked enemy beyond a quarter of their range', beyond && Devices.target[drone] === -1 && Devices.z[drone] === 0);
  Actors.flags[enemy] &= ~ACTOR_FLAG.INVISIBLE;
  Smoke.spawn(CAT.gadgets.byId('smoke'), -1, 0, 0.5, 7);
  Sim.run(itemTicks(GADGET_TUNING.smokeExpandSeconds));
  check('G21 drones do not see through smoke', Devices.target[drone] === -1);
  Smoke.clear();
  Sim.run(itemTicks(0.3));
  check('G21 a drone picks its target on the device tick', Devices.target[drone] === enemy);
  ItemArena.kill(enemy);
  Sim.run(1);
  check('G21 a dead target is dropped at once', Devices.target[drone] === -1);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start({}, [{ shape: 'box', min: [-10, 0, 5], max: [10, 4, 6] }]);
  const owner = GadgetArena.actor(1, 0, 0);
  for (let k = 0; k < 3; k++) TestArena.sponge(2, -4 + k * 4, 12);
  GadgetArena.device('ticks', owner, 0, 0);
  const lineClear = World.lineClear;
  let rays = 0;
  World.lineClear = (ax, ay, az, bx, by, bz) => { rays++; return lineClear.call(World, ax, ay, az, bx, by, bz); };
  try { Sim.run(TICK_RATE); } finally { World.lineClear = lineClear; }
  const most = Math.ceil(1 / AREA_TICK_SECONDS) * 3;
  check('G21 an idle drone looks for enemies 4 times a second, not every step', rays <= most, rays + ' sight rays in 1 s');
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 0, 'cover', 1), cover = CAT.gadgets.byId('cover');
  Actors.yaw[owner] = Actors.aimYaw[owner] = 1;   // about 57 degrees: the nearest axis is 90
  GadgetArena.press(owner, BTN.GADGET);
  const device = Devices.active.indexOf(1), brush = World.dynamic[0];
  check('G13 the drawn barrier turns to the axis of its brush', device >= 0 && Test.near(Devices.yaw[device], QUARTER_TURN, 1e-6), device >= 0 ? Devices.yaw[device] : 'none');
  const footprint = !!brush && Test.near(brush.maxX - brush.minX, cover.size[2], 1e-4) && Test.near(brush.maxZ - brush.minZ, cover.size[0], 1e-4);
  check('G13 the brush footprint matches that yaw', footprint);
  check('snapToAxis rounds to the nearest quarter turn', snapToAxis(0.6) === 0 && snapToAxis(-1) === -QUARTER_TURN && snapToAxis(3) === Math.PI);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start({}, [{ shape: 'box', min: [-5, 0, 4], max: [5, 4, 5] }]);
  const owner = GadgetArena.actor(1, 0, 10), enemy = GadgetArena.actor(2, 0, 0), turret = GadgetArena.device('sentry', owner, 0, 10);
  check('enemy deployed devices are drawn behind walls', Devices.shownTo(turret, enemy));
  check('bots do not see enemy devices through walls', !Gadgets.visibleTo(turret, enemy) && Gadgets.visibleTo(turret, owner));
  TestArena.place(enemy, 8, 10);
  check('bots see enemy devices in sight', Gadgets.visibleTo(turret, enemy));
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, 10), shooter = GadgetArena.actor(2, 0, 0), turret = GadgetArena.device('sentry', owner, 0, 10);
  const fullHealth = CAT.gadgets.byId('sentry').health;
  const gun = CAT.weapons.find((weapon) => weapon.primary.type === 'hitscan' && weapon.primary.damage >= 30);
  const blocker = TestArena.sponge(2, 0, 5);
  const shot = { id: shooter, weapon: gun.id, weaponClass: '', mode: 'primary', x: 0, y: Devices.centreY(turret), z: 0, dx: 0, dy: 0, dz: 1 };
  Bus.emit('weapon.fire', shot);
  check('a body in front shields the device behind it', Devices.health[turret] === fullHealth, Devices.health[turret]);
  TestArena.place(blocker, 30, 30);
  Bus.emit('weapon.fire', shot);
  check('without the body the shot breaks into the device', Devices.health[turret] < fullHealth, Devices.health[turret]);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const owner = GadgetArena.actor(1, 0, -10), fire = CAT.gadgets.byId('incendiary');
  GadgetEffects.fire(fire, owner, 0, 1.2, 1);
  const area = GadgetAreas.active.indexOf(1);
  check('G04 fire that went off in the air burns on the floor', area >= 0 && GadgetAreas.y[area] < 0.2, area >= 0 ? GadgetAreas.y[area] : 'none');
  GadgetAreas.clear();
  const carrier = GadgetArena.actor(2, 0, 3), thrower = GadgetArena.actor(1, 0, 0, 'sticky', 1);
  Actors.pitch[thrower] = Actors.aimPitch[thrower] = -0.35;
  GadgetArena.throwAfter(thrower, 0);
  Sim.run(30);
  const slot = GadgetArena.firstThrown();
  const attached = slot >= 0 && Thrown.state[slot] === THROWN_STATE.ATTACHED;
  ItemArena.kill(carrier);
  Sim.run(1);
  const sideways = slot >= 0 ? Math.hypot(Thrown.vx[slot], Thrown.vz[slot]) : -1;
  check('G06 a sticky drops straight off a carrier who dies', attached && sideways >= 0 && sideways < 0.01, sideways);
  TestArena.finish();
});

Test.add('gadgets', (check) => {
  GadgetArena.start();
  const id = GadgetArena.actor(1, 0, 0, 'incendiary', 1);
  Game.playerId = id;
  Actors.pitch[id] = Actors.aimPitch[id] = 30 * DEG;   // a long lob: about 3 s in the air
  let ring = null;
  const batch = { meshFrom: (shape, instance) => { if (shape === 'ring') ring = { x: instance.x, z: instance.z }; return 0; } };
  Actors.buttons[id] = BTN.GRENADE;
  Sim.run(1);
  Gadgets.drawPreview(batch);
  Actors.buttons[id] = 0;
  Sim.run(itemTicks(4));
  const area = GadgetAreas.active.indexOf(1);
  check('the throw arc preview shows a landing ring for a long throw', ring !== null);
  const gap = ring && area >= 0 ? Math.hypot(ring.x - GadgetAreas.x[area], ring.z - GadgetAreas.z[area]) : -1;
  check('the preview lands where the grenade lands', gap >= 0 && gap < 0.6, gap);
  Game.playerId = -1;
  TestArena.finish();
});

// F42: every gear module starts a round clean; the beacon of the last round does not pull the new round's spawns.
Test.add('gadgets', (check) => {
  startModeTest('elim', modesTestMap({ spawns: TEAM_SPAWNS }), [0, 0, 1, 1]);
  runSeconds(CAT.modes.byId('elim').rounds.freeze + 0.5);
  const owner = 0;
  Devices.spawn(CAT.gadgets.byId('claymore'), owner, 0, 0, 3);
  Devices.spawn(CAT.gadgets.byId('beacon'), owner, 0, 0, 0);
  Smoke.spawn(CAT.gadgets.byId('smoke'), owner, 0, 1, 10);
  AbilityZones.add(ZONE_KIND.SMOKE, owner, null, 0, 0, 5, 60);
  FloorSurfaces.spillUnder(owner, 'oil', owner);
  Thrown.spawn(CAT.gadgets.byId('frag'), owner, 0, 1, 0, 0, 0, 0, 1000);
  check('round 1 gear is placed', Devices.count === 2 && Smoke.count > 0 && AbilityZones.count > 0 && FloorSurfaces.active.indexOf(1) >= 0 && GadgetArena.firstThrown() >= 0);
  Modes.endRound(0, 'test');
  Modes.nextRound(Sim.time);
  check('F42 a new round clears devices', Devices.count === 0, Devices.count);
  check('F42 a new round clears smoke, zones, patches and grenades in the air', Smoke.count === 0 && AbilityZones.count === 0 && FloorSurfaces.active.indexOf(1) < 0 && GadgetArena.firstThrown() < 0);
  check('F42 the round-start spawn ignores last round beacon', Math.abs(Actors.x[owner]) > 20, Actors.x[owner]);
  endModeTest();
});

// F44 (R-099): in a team-less match the owner alone respawns on their own beacon.
Test.add('gadgets', (check) => {
  GadgetArena.start({ teams: 0 });
  const owner = GadgetArena.actor(-1, 40, 40), other = GadgetArena.actor(-1, -40, -40);
  GadgetArena.device('beacon', owner, 10, 10);
  Bus.emit('actor.spawn', { id: owner });
  Bus.emit('actor.spawn', { id: other });
  check('F44 free-for-all: the owner respawns at their beacon', Math.hypot(Actors.x[owner] - 10, Actors.z[owner] - 10) <= 1.5, Actors.x[owner] + ',' + Actors.z[owner]);
  check('F44 free-for-all: another player is not moved', Actors.x[other] === -40 && Actors.z[other] === -40);
  TestArena.finish();
});

// F44 (R-101): Phase Slip ('cannot fire') also stops grenades, gadgets and offensive abilities.
Test.add('gadgets', (check) => {
  GadgetArena.start();
  const id = GadgetArena.actor(1, 0, 0, 'frag', 2);
  Gadgets.give(id, 'claymore', 1);
  Buffs.add(id, BUFF.NO_FIRE, 2, 2);
  GadgetArena.throwAfter(id, 0.2);
  check('F44 no grenade while Phase Slip runs', GadgetArena.firstThrown() < 0 && Gadgets.count[id * GADGET_COUNT + CAT.gadgets.byId('frag').index] === 2);
  Gadgets.select(id, 'claymore');
  GadgetArena.press(id, BTN.GADGET);
  check('F44 no gadget while Phase Slip runs', Devices.count === 0);
  check('F44 an offensive ability is refused while Phase Slip runs', !Abilities.usable(id, CAT.abilities.byId('arcbolt')) && Abilities.usable(id, CAT.abilities.byId('phaseslip')));
  Buffs.clear(id);
  check('F44 offensive abilities work again afterwards', Abilities.usable(id, CAT.abilities.byId('arcbolt')));
  GadgetArena.throwAfter(id, 0.2);
  check('F44 grenades work again afterwards', GadgetArena.firstThrown() >= 0);
  TestArena.finish();
});

// F44 (R-104): a grenade held when the thrower is frozen, downed or jammed is not thrown; Phase Slip puts it away (no risk-free drop).
Test.add('gadgets', (check) => {
  GadgetArena.start();
  const id = GadgetArena.actor(1, 0, 0, 'smoke', 1), frag = CAT.gadgets.byId('frag').index;
  GadgetArena.holdThen(id, () => { Actors.flags[id] |= ACTOR_FLAG.FROZEN; });
  check('F44 a plain grenade held by a frozen actor is cancelled, not thrown', GadgetArena.firstThrown() < 0 && Gadgets.holdStart[id] < 0 && Gadgets.thrownTotal(id) === 1);
  Actors.flags[id] &= ~ACTOR_FLAG.FROZEN;
  Gadgets.give(id, 'frag', 1); Gadgets.select(id, 'frag');
  GadgetArena.holdThen(id, () => Buffs.add(id, BUFF.NO_FIRE, 2, 2));
  check('F44 a cooking grenade under Phase Slip is put away, not dropped', GadgetArena.firstThrown() < 0 && Gadgets.holdStart[id] < 0 && Gadgets.count[id * GADGET_COUNT + frag] === 1);
  Buffs.clear(id);
  GadgetArena.holdThen(id, () => Gadgets.suppress(id, 3));
  const slot = GadgetArena.firstThrown();
  check('F44 a cooking grenade of a jammed actor falls at the feet', slot >= 0 && Thrown.vx[slot] === 0 && Thrown.vz[slot] === 0 && Gadgets.holdStart[id] < 0);
  TestArena.finish();
});

// F46: no write-only gear data: every column of the gadget and ability rows has a reader in the game code (not the data or the tests).
Test.add('gadgets', (check) => {
  const source = Array.from(document.scripts).map((script) => script.textContent).join('\n');
  const code = source.slice(source.indexOf('// ==== 04-save.js'), source.indexOf('// ==== 20a-selftest.js'));
  const unread = [];
  for (const table of [CAT.gadgets, CAT.abilities]) {
    const columns = new Set();
    table.forEach((row) => Object.keys(row).forEach((key) => columns.add(key)));
    for (const column of columns) if (!new RegExp('\\.' + column + '\\b').test(code)) unread.push(column);
  }
  check('F46 every gadget and ability column has a reader', unread.length === 0, unread.join(', '));
  check('F46 the smoke grid keeps no owner or row it never reads', !Smoke.owner && !Smoke.row);
});

// PERF-006: the per-step movement, damage and gear code (S10-S12) measures lengths with length2/length3, never Math.hypot.
Test.add('gadgets', (check) => {
  const sections = Array.from(document.scripts).map((element) => element.textContent).join('\n').split(/\n\/\/ ==== (\S+) ====\n/);
  const offenders = [];
  for (let k = 1; k < sections.length; k += 2) if (/^1[0-2][a-h]-/.test(sections[k]) && /Math\.hypot\s*\(/.test(sections[k + 1])) offenders.push(sections[k]);
  check('PERF-006 no Math.hypot in S10-S12', sections.length > 10 && offenders.length === 0, offenders.join(', '));
  check('one area tick constant for puddles, fire areas, devices and floors', typeof AREA_TICK === 'undefined' && typeof DEVICE_TICK === 'undefined'
    && SURFACE_TICK_STEPS === Math.round(AREA_TICK_SECONDS * TICK_RATE));
});
