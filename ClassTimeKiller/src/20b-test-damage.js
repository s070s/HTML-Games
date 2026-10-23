// Self-tests for S11 damage: preset layer order and regen timing (HPP01..HPP09), precision, falloff, splash, statuses,
// elements, friendly fire, kill/assist events and the single damage path. TestArena is shared with the weapons tests.

const TestArena = {
  // A flat 120 x 120 m floor, a running match with a hand-made ruleset (only the fields S11 reads).
  start(overrides, brushes) {
    Game.start({ mode: 'ffa', map: 'test', seed: 1 });
    Game.match.rules = Object.assign({ id: 'test', health: 'stack', precision: 'standard', weaponSet: 'fullSet', friendlyFire: 0, selfDamage: 0.5, knockback: 1 }, overrides || {});
    World.load({ id: 'weapon-test', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }].concat(brushes || []) });
    Projectiles.clear();
  },
  finish() { Game.stop(); World.clear(); Projectiles.clear(); },
  actor(team, x, z, yaw) {
    const id = Actors.create(ACTOR_KIND.DUMMY, team, 'dummy');
    Actors.alive[id] = 1; Actors.place(id, x, 0, z);
    Actors.yaw[id] = Actors.aimYaw[id] = yaw || 0;
    Actors.flags[id] = ACTOR_FLAG.ON_GROUND;
    Damage.resetHealth(id);
    this.place(id, x, z);
    return id;
  },
  // Puts an actor at rest on the floor, already standing for S10 too (no landing next step), e.g. after knockback moved it.
  place(id, x, z) {
    Actors.x[id] = x; Actors.y[id] = 0; Actors.z[id] = z;
    Actors.vx[id] = Actors.vy[id] = Actors.vz[id] = 0;
    Motion.grounded[id] = 1; Motion.groundNY[id] = 1;
  },
  // A target that survives long tests (large health that never decays).
  sponge(team, x, z) {
    const id = this.actor(team, x, z, Math.PI);
    Actors.health[id] = Actors.maxHealth[id] = 100000;
    return id;
  },
  aimAt(shooter, target, zone) {
    Hitbox.point(target, zone === undefined ? ZONE.BODY : zone, pointScratch);
    const dx = pointScratch.x - Actors.x[shooter], dy = pointScratch.y - Actors.eyeY(shooter), dz = pointScratch.z - Actors.z[shooter];
    Actors.yaw[shooter] = Actors.aimYaw[shooter] = Math.atan2(dx, dz);
    Actors.pitch[shooter] = Actors.aimPitch[shooter] = Math.atan2(dy, Math.hypot(dx, dz));
  },
  hold(id, buttons, seconds) {
    Actors.buttons[id] = buttons;
    Sim.run(Math.round(seconds * TICK_RATE));
    Actors.buttons[id] = 0;
  },
  count(type, run) {
    let count = 0;
    const handler = Bus.on(type, () => { count++; });
    run();
    Bus.off(type, handler);
    return count;
  },
  hit(source, target, amount, extra) {
    const info = Damage.info();
    info.amount = amount;
    Object.assign(info, extra || {});
    return Damage.apply(source, target, info);
  },
};

Test.add('damage', (check) => {
  TestArena.start({ health: 'stack' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5);
  check('HPP01 starts 100 HP / 0 armor', Actors.health[target] === 100 && Actors.armor[target] === 0);
  Actors.armor[target] = 100;
  TestArena.hit(shooter, target, 30);
  check('HPP01 armor absorbs 2/3 rounded up', Actors.armor[target] === 80 && Actors.health[target] === 90, Actors.armor[target] + ' / ' + Actors.health[target]);
  Actors.health[target] = 150; Actors.armor[target] = 150;
  Sim.run(10 * TICK_RATE);
  check('HPP01 overheal and armor above 100 decay 1/s', Test.near(Actors.health[target], 140, 0.05) && Test.near(Actors.armor[target], 140, 0.05), Actors.health[target] + ' / ' + Actors.armor[target]);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'regen' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5);
  TestArena.hit(shooter, target, 50);
  Sim.run(5 * TICK_RATE);
  check('HPP02 no regen before 5 s', Actors.health[target] === 50, Actors.health[target]);
  Sim.run(TICK_RATE);
  check('HPP02 regen 25 HP/s after 5 s', Test.near(Actors.health[target], 75, 0.01), Actors.health[target]);
  TestArena.start({ health: 'suit' });
  const suited = TestArena.actor(2, 0, 5);
  TestArena.hit(-1, suited, 50);
  Sim.run(6 * TICK_RATE);
  const before = Actors.health[suited];
  Sim.run(TICK_RATE);
  check('HPP08 regen 20 HP/s after 6 s', before === 50 && Test.near(Actors.health[suited], 70, 0.01), before + ' -> ' + Actors.health[suited]);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'shield' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5);
  check('HPP03 starts shield 70 + health 50', Actors.shield[target] === 70 && Actors.health[target] === 50);
  const headMode = CAT.weapons.byId('verdict').primary;
  TestArena.hit(shooter, target, 40, { zone: 'head', mode: headMode });
  check('HPP03 head multiplier does not apply to the shield', Actors.shield[target] === 30 && Actors.health[target] === 50, Actors.shield[target] + ' / ' + Actors.health[target]);
  TestArena.hit(shooter, target, 40, { zone: 'head', mode: headMode });
  check('HPP03 overflow past the shield is multiplied on health', Actors.shield[target] === 0 && Test.near(Actors.health[target], 30, 1e-4), Actors.health[target]);
  Sim.run(5 * TICK_RATE);
  check('HPP03 shield waits 5 s', Actors.shield[target] === 0);
  Sim.run(4 * TICK_RATE);
  check('HPP03 shield refills in 4 s (17.5/s)', Test.near(Actors.shield[target], 70, 0.01), Actors.shield[target]);
  Sim.run(4 * TICK_RATE);
  check('HPP03 health regenerates only to the next third', Test.near(Actors.health[target], 50 * 2 / 3, 0.01), Actors.health[target]);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'tactical', precision: 'tactical' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5);
  Actors.armor[target] = 100;
  const rifle = CAT.weapons.byId('vanguard').primary;
  TestArena.hit(shooter, target, 20, { zone: 'body', mode: rifle });
  check('HPP04 vest: health x armorPen, armor x (1-armorPen) x 0.5', Actors.health[target] === 85 && Actors.armor[target] === 97.5, Actors.health[target] + ' / ' + Actors.armor[target]);
  TestArena.hit(shooter, target, 20, { zone: 'legs', mode: rifle });
  check('HPP04 legs are unprotected (tactical legs x0.75)', Actors.health[target] === 70 && Actors.armor[target] === 97.5, Actors.health[target]);
  TestArena.hit(shooter, target, 10, { zone: 'head', mode: CAT.weapons.byId('warden').primary });
  check('HP-002 tactical pistol head x3.9 (no helmet)', Test.near(Actors.health[target], 31, 1e-4), Actors.health[target]);
  const second = TestArena.actor(2, 2, 5);
  TestArena.hit(shooter, second, 10, { zone: 'body', stomach: true, mode: rifle });
  check('HP-002 tactical stomach x1.25', Actors.health[second] === 87.5, Actors.health[second]);
  TestArena.hit(shooter, second, 20, { zone: 'head', mode: rifle });
  check('HP-002 tactical rifle head x4', Actors.health[second] === 7.5, Actors.health[second]);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'hero', precision: 'hero' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5);
  check('HPP05 hero pool 200', Actors.health[target] === 200);
  Actors.armor[target] = 100;
  TestArena.hit(shooter, target, 20);
  check('HPP05 armor: flat -5 per hit', Actors.armor[target] === 85 && Actors.health[target] === 200, Actors.armor[target]);
  TestArena.hit(shooter, target, 6);
  check('HPP05 armor reduction at most 50%', Actors.armor[target] === 82, Actors.armor[target]);
  TestArena.hit(shooter, target, 20, { kind: 'beam' });
  check('HPP05 beams ignore the flat reduction', Actors.armor[target] === 62, Actors.armor[target]);
  TestArena.hit(shooter, target, 10, { zone: 'head', mode: CAT.weapons.byId('wasp').primary });
  check('HP-002 hero head x1 for non-precision weapons', Actors.armor[target] === 57, Actors.armor[target]);
  Actors.maxShield[target] = 50; Actors.shield[target] = 0;
  TestArena.hit(shooter, target, 1);
  Sim.run(3 * TICK_RATE + TICK_RATE);
  check('HPP05 shields regen 30/s after 3 s', Test.near(Actors.shield[target], 30, 0.3), Actors.shield[target]);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'loot' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5), mate = TestArena.actor(2, 3, 5);
  Actors.shield[target] = 50;
  TestArena.hit(shooter, target, 70);
  check('HPP06 shield first, then health', Actors.shield[target] === 0 && Actors.health[target] === 80);
  const kills = TestArena.count('kill', () => TestArena.hit(shooter, target, 100));
  check('HPP06 squad: 0 HP goes down, not dead', kills === 0 && Actors.alive[target] === 1 && (Actors.flags[target] & ACTOR_FLAG.DOWNED) !== 0 && Actors.health[target] === DOWNED_HEALTH);
  check('HP-007 downed crawl speed', Damage.statusSpeed(target) === DOWNED_SPEED);
  const bled = TestArena.count('kill', () => Sim.run(DOWNED_BLEED_SECONDS * TICK_RATE + 2));
  check('HP-007 bleed-out after 30 s', bled === 1 && Actors.alive[target] === 0);
  TestArena.hit(shooter, mate, 100);
  check('HP-007 last standing squad member dies outright', Actors.alive[mate] === 0);
  TestArena.finish();
});

// HP-007 in squad rulesets: classes and heroes down teammates; hold Use 5 s within 1.5 m revives; Last Stand draws a pistol.
Test.add('damage', (check) => {
  check('HP-007 class and hero rulesets down teammates, arena ones do not', Rules.build({ mode: 'tdm', ruleset: 'modern' }).downed === true
    && Rules.build({ mode: 'payload', ruleset: 'heroes' }).downed === true && Rules.build({ mode: 'tdm', ruleset: 'classic' }).downed === false);
  TestArena.start({ health: 'regen', downed: true });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5), medic = TestArena.actor(2, 1, 5), far = TestArena.actor(2, 20, 5);
  Weapons.setLoadout(target, ['tempest']);
  Economy.perkKeys[target].add('lastStand');
  TestArena.hit(shooter, target, 150);
  const pistol = CAT.weapons.byId(CAT.perks.byId('laststand').weapon);
  check('HP-007 a teammate at 0 HP goes down in a downed ruleset', (Actors.flags[target] & ACTOR_FLAG.DOWNED) !== 0 && Actors.alive[target] === 1);
  check('ECP04 Last Stand: the downed actor holds the pistol and may fire', Weapons.current[target] === pistol.index && !Weapons.lowered(target));
  const shots = TestArena.count('weapon.fire', () => TestArena.hold(target, BTN.FIRE, 0.1));
  check('ECP04 Last Stand: the pistol fires while downed', shots >= 1, shots);
  TestArena.hold(far, BTN.USE, REVIVE_SECONDS + 0.2);
  check('HP-007 Use held 20 m away revives nobody', (Actors.flags[target] & ACTOR_FLAG.DOWNED) !== 0);
  TestArena.hold(medic, BTN.USE, REVIVE_SECONDS - 0.5);
  Sim.step();
  check('HP-007 letting go of Use starts the revive over', (Actors.flags[target] & ACTOR_FLAG.DOWNED) !== 0 && Damage.reviveProgress[medic] === 0);
  TestArena.hold(medic, BTN.USE, REVIVE_SECONDS + 0.05);
  check('HP-007 Use held 5 s within 1.5 m revives the ally', !(Actors.flags[target] & ACTOR_FLAG.DOWNED) && Actors.health[target] === REVIVE_HEALTH, Actors.health[target]);
  check('ECP04 Last Stand: the old weapon comes back on revive', Weapons.current[target] === CAT.weapons.byId('tempest').index && !Damage.lastStand[target]);
  TestArena.hit(shooter, target, 150);
  TestArena.hit(shooter, far, 200);
  TestArena.hit(shooter, medic, 200);
  Sim.step();
  check('HP-007 downed teammates bleed out once no teammate stands', Actors.alive[target] === 0 && Actors.alive[medic] === 0 && Actors.alive[far] === 0);
  TestArena.finish();
});

// ECP04 Last Stand at the carry limit: the pistol is lent on top, nothing is dropped, and it goes back on revive.
Test.add('damage', (check) => {
  TestArena.start({ health: 'regen', downed: true, carry: 2 });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5), medic = TestArena.actor(2, 1, 5);
  Weapons.setLoadout(target, ['lancet', 'tempest']);
  Economy.perkKeys[target].add('lastStand');
  const pistol = CAT.weapons.byId(CAT.perks.byId('laststand').weapon), lancet = CAT.weapons.byId('lancet'), tempest = CAT.weapons.byId('tempest');
  const owns = (weapon) => Weapons.owned[Weapons.slotIndex(target, weapon.index)] === 1;
  TestArena.hit(shooter, target, 150);
  check('ECP04 Last Stand at the carry limit keeps both carried weapons', Weapons.current[target] === pistol.index && owns(lancet) && owns(tempest) && Weapons.dropped === '');
  TestArena.hold(medic, BTN.USE, REVIVE_SECONDS + 0.05);
  check('ECP04 Last Stand: revive gives the held weapon back and takes the lent pistol', Weapons.current[target] === tempest.index && owns(lancet) && !owns(pistol), Weapons.current[target]);
  TestArena.hit(shooter, target, 150);
  TestArena.hold(medic, BTN.USE, 2);
  TestArena.hit(shooter, target, 500);
  Sim.step();
  check('HP-007 a revive cut short by the kill leaves no progress behind', Actors.alive[target] === 0 && Damage.reviveProgress[medic] === 0 && Damage.reviving[medic] === -1, Damage.reviveProgress[medic]);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'ravager' });
  const target = TestArena.actor(2, 0, 5);
  Actors.armor[target] = 50;
  TestArena.hit(-1, target, 40);
  check('HPP07 armor absorbs 50%', Actors.armor[target] === 30 && Actors.health[target] === 80);
  TestArena.start({ health: 'limb' });
  const shooter = TestArena.actor(1, 0, 0), limbed = TestArena.actor(2, 0, 5);
  TestArena.hit(shooter, limbed, 70, { zone: 'legs', x: 0.1, z: 5 });
  check('HPP09 one leg below 34% -> -25% speed', Damage.statusSpeed(limbed) === 0.75, Damage.statusSpeed(limbed));
  TestArena.hit(shooter, limbed, 50, { zone: 'body', x: -0.3, z: 5 });
  check('HPP09 arm below 67% adds 0.1 deg spread', Test.near(Damage.limbSpread(limbed), 0.1, 1e-6), Damage.limbSpread(limbed));
  check('HPP09 health mirrors the pools', Test.near(Actors.health[limbed], (600 - 120) / 6, 1e-3), Actors.health[limbed]);
  TestArena.hit(shooter, limbed, 100, { zone: 'head' });
  check('HPP09 head pool at 0 kills', Actors.alive[limbed] === 0);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'stack', precision: 'arena' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 5);
  let before = Actors.health[target];
  TestArena.hit(shooter, target, 10, { zone: 'head', mode: CAT.weapons.byId('lancet').primary });
  check('HP-002 arena head x1', before - Actors.health[target] === 10);
  before = Actors.health[target];
  TestArena.hit(shooter, target, 10, { zone: 'head', mode: CAT.weapons.byId('heron').primary });
  check('HP-002 arena alwaysHead weapons keep their head multiplier', before - Actors.health[target] === 25);
  before = Actors.health[target];
  TestArena.hit(shooter, target, 10, { distance: 40, mode: CAT.weapons.byId('tempest').primary, zone: 'body' });
  check('WPN-005 falloff halfway from 30 to 50 m = 0.9', Test.near(before - Actors.health[target], 9, 1e-4), before - Actors.health[target]);
  before = Actors.health[target];
  TestArena.hit(shooter, target, 10, { distance: 80, mode: CAT.weapons.byId('tempest').primary, zone: 'body' });
  check('WPN-005 falloff floor at minFactor', Test.near(before - Actors.health[target], 8, 1e-4));
  before = Actors.health[target];
  TestArena.hit(shooter, target, 0.3);
  check('HP-003 a passing hit deals at least 1', before - Actors.health[target] === 1);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ friendlyFire: 0 });
  const shooter = TestArena.actor(1, 0, 0), mate = TestArena.actor(1, 2, 0);
  check('friendly fire 0: no team damage', TestArena.hit(shooter, mate, 50) === 0 && Actors.health[mate] === 100);
  Game.match.rules = Object.assign({}, Game.match.rules, { friendlyFire: 0.5 });
  TestArena.hit(shooter, mate, 50);
  check('friendly fire 0.5 halves team damage', Actors.health[mate] === 75);
  Actors.flags[mate] |= ACTOR_FLAG.PROTECTED;
  check('spawn protection blocks damage', TestArena.hit(-1, mate, 50, { kind: 'hazard' }) === 0);
  Actors.flags[mate] &= ~ACTOR_FLAG.PROTECTED;
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ selfDamage: 0.5 });
  const owner = TestArena.actor(1, 0, 0), near = TestArena.actor(2, 0, 1.5), far = TestArena.actor(2, 0, 4.4), hidden = TestArena.actor(2, 3, 0);
  World.load({ id: 'splash', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }, { shape: 'box', min: [1, 0, -1], max: [1.3, 3, 1] }] });
  let impulses = 0;
  const onImpulse = Bus.on('impulse', (event) => { if (event.id === owner) impulses++; });
  const blast = Damage.blast();
  blast.x = 0; blast.y = 0.3; blast.z = 0; blast.owner = owner; blast.mode = CAT.weapons.byId('ramjet').primary; blast.radius = 3.5; blast.damage = 100;
  const explosions = TestArena.count('explosion', () => Damage.explode(blast));
  Bus.off('impulse', onImpulse);
  check('explosion event', explosions === 1);
  check('self splash x selfDamage 0.5 and full knockback', Actors.health[owner] === 50 && impulses === 1, Actors.health[owner]);
  const expectedNear = 100 * lerp(1, 0.2, (1.5 - TORSO_RADIUS) / 3.5);
  check('splash falls off linearly to minFactor', Test.near(100 - Actors.health[near], expectedNear, 0.01), 100 - Actors.health[near]);
  check('splash stops at its radius', Actors.health[far] === 100, Actors.health[far]);
  check('splash is blocked by walls (line of sight)', Actors.health[hidden] === 100);
  const safe = Damage.blast();
  safe.x = 0; safe.y = 0.3; safe.z = 0; safe.owner = owner; safe.radius = 6; safe.damage = 300; safe.ownerSafe = true;
  Damage.explode(safe);
  check('owner-safe blasts spare the owner (W40)', Actors.health[owner] === 50 && Actors.alive[near] === 0);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({});
  const a = TestArena.actor(1, 0, 0), b = TestArena.actor(3, 4, 0), victim = TestArena.actor(2, 0, 5);
  let kill = null;
  const handler = Bus.on('kill', (event) => { kill = Object.assign({}, event); });
  TestArena.hit(a, victim, 50, { weapon: 'wasp' });
  Sim.run(TICK_RATE);
  TestArena.hit(b, victim, 60, { weapon: 'tempest', zone: 'body' });
  Bus.off('kill', handler);
  check('kill event with killer and assister', kill && kill.victim === victim && kill.killer === b && kill.assister === a && kill.weapon === 'tempest', JSON.stringify(kill));
  check('death sets alive = 0', Actors.alive[victim] === 0);
  check('dead actors take no damage', TestArena.hit(a, victim, 10) === 0);
  const late = TestArena.actor(2, 0, 9);
  TestArena.hit(a, late, 50);
  Sim.run(6 * TICK_RATE);
  let lateKill = null;
  const second = Bus.on('kill', (event) => { lateKill = Object.assign({}, event); });
  TestArena.hit(b, late, 60);
  Bus.off('kill', second);
  check('no assist after the 5 s window', lateKill && lateKill.assister === -1, JSON.stringify(lateKill));
  const faller = TestArena.actor(2, 9, 9);
  TestArena.hit(a, faller, 20);
  let fall = null;
  const third = Bus.on('kill', (event) => { fall = Object.assign({}, event); });
  Bus.emit('damage.request', { target: faller, source: -1, amount: 500, kind: 'fall', x: 0, y: 0, z: 0 });
  Bus.off('kill', third);
  check('environment kill credits the last attacker', fall && fall.killer === a, JSON.stringify(fall));
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'stack' });
  const target = TestArena.actor(2, 0, 5);
  Actors.armor[target] = 100; Actors.shield[target] = 50; Actors.maxShield[target] = 50;
  Bus.emit('damage.request', { target, source: -1, amount: 30, kind: 'fall', x: 0, y: 0, z: 0 });
  check('damage.request fall goes to health only', Actors.health[target] === 70 && Actors.armor[target] === 100 && Actors.shield[target] === 50);
  Bus.emit('damage.request', { target, source: -1, amount: 1, kind: 'telefrag', x: 0, y: 0, z: 0 });
  check('damage.request telefrag is lethal', Actors.alive[target] === 0);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({ health: 'stack' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 5);
  Damage.addStatus(target, 'burn', shooter);
  Sim.run(4 * TICK_RATE + 2);
  check('HP-005 burn 10 HP/s for 4 s', Test.near(Actors.health[target], 60, 1e-4) && !Damage.hasStatus(target, 'burn'), Actors.health[target]);
  Damage.addStatus(target, 'chill', shooter, 0, 2);
  check('HP-005 chill slows 40%', Damage.statusSpeed(target) === 0.6 && !Damage.hasStatus(target, 'freeze'));
  Damage.addStatus(target, 'chill', shooter);
  check('HP-005 3 chill stacks = freeze (FROZEN)', Damage.hasStatus(target, 'freeze') && (Actors.flags[target] & ACTOR_FLAG.FROZEN) !== 0);
  Sim.step();   // the shatter needs a hit after the step that froze the target
  const before = Actors.health[target];
  TestArena.hit(shooter, target, 10);
  check('HP-005 frozen target shatters: next hit x3', Test.near(before - Actors.health[target], 30, 1e-4) && !Damage.hasStatus(target, 'freeze') && !(Actors.flags[target] & ACTOR_FLAG.FROZEN), before - Actors.health[target]);
  Actors.armor[target] = 50;
  Damage.addStatus(target, 'bleed', shooter);
  Sim.run(TICK_RATE);
  check('HP-005 bleed bypasses armor', Actors.armor[target] === 50, Actors.armor[target]);
  Damage.addStatus(target, 'sleep', shooter);
  const asleep = (Actors.flags[target] & ACTOR_FLAG.FROZEN) !== 0;
  TestArena.hit(shooter, target, 1);
  check('sleep stuns until damaged', asleep && !Damage.hasStatus(target, 'sleep') && !(Actors.flags[target] & ACTOR_FLAG.FROZEN));
  TestArena.start({ health: 'shield' });
  const shielded = TestArena.actor(2, 0, 5);
  Damage.addStatus(shielded, 'toxin', -1);
  Sim.run(TICK_RATE);
  check('HP-005 toxin bypasses shields', Actors.shield[shielded] === 70 && Actors.health[shielded] === 44, Actors.shield[shielded] + ' / ' + Actors.health[shielded]);
  Damage.shieldElement[shielded] = CAT.elements.findIndex((row) => row.id === 'thermal') + 1;
  TestArena.hit(-1, shielded, 10, { element: 'thermal' });
  check('HP-006 matching element x1.5 on a coloured shield', Actors.shield[shielded] === 55, Actors.shield[shielded]);
  TestArena.hit(-1, shielded, 10, { element: 'kinetic' });
  check('HP-006 other elements x0.75', Actors.shield[shielded] === 47.5, Actors.shield[shielded]);
  TestArena.finish();
});

Test.add('damage', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 6);
  let impulse = null;
  const handler = Bus.on('impulse', (event) => { if (event.id === target) impulse = Object.assign({}, event); });
  TestArena.hit(shooter, target, 100, { dx: 0, dy: 0, dz: 1 });
  Bus.off('impulse', handler);
  check('MOV-017 knockback 0.15 x damage m/s along the hit', impulse && Test.near(impulse.z, 15, 1e-3) && impulse.y > 0, JSON.stringify(impulse));
  TestArena.finish();
});

// R-097: hitscan rulesets keep their targets in place; the ruleset's knockback is applied once (by S10).
Test.add('damage', (check) => {
  const modern = Rules.build({ mode: 'ffa', ruleset: 'modern', map: 'test' }), classic = Rules.build({ mode: 'ffa', ruleset: 'classic', map: 'test' });
  TestArena.start({ knockback: modern.knockback });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 3);
  Weapons.setLoadout(shooter, ['wasp']);
  let hits = 0;
  const onHit = Bus.on('damage', (event) => { if (event.target === target) hits++; });
  for (let step = 0; step < TICK_RATE && hits < 8; step++) { TestArena.aimAt(shooter, target); Actors.buttons[shooter] = BTN.FIRE; Sim.step(); }
  Actors.buttons[shooter] = 0;
  Sim.run(TICK_RATE);
  Bus.off('damage', onHit);
  const moved = Math.hypot(Actors.x[target], Actors.z[target] - 3);
  check('Modern Ops: 8 Wasp hits move the target less than 1.5 m', hits === 8 && moved < 1.5 && classic.knockback === 1, hits + ' hits, ' + moved.toFixed(2) + ' m, classic ' + classic.knockback);
  TestArena.finish();
});

// Ways code could lower a pool without Damage.apply: `-=`, `--`, or `pool[x] = ... pool[x] - ...` (Math.max forms too).
const DAMAGE_SIDE_PATHS = [
  /Actors\.(health|armor|shield)\[[^\]]+\]\s*(-=|--)/,
  /Actors\.(health|armor|shield)\[([^\]]+)\]\s*=[^;\n]*Actors\.\1\[\2\]\s*-(?!=)/,
];

// HP-004 / 6.2: every damage passes Damage.apply (count check) and no other code lowers health, armor or shields.
Test.add('damage', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 6);
  let healthLost = 0, events = 0;
  const handler = Bus.on('damage', (event) => { healthLost += event.healthDamage; events++; });
  const callsBefore = Damage.applyCount, start = Actors.health[target];
  const loadout = ['warden', 'ramjet', 'stormlash', 'kindler', 'shardcaster'];
  for (const key of loadout) {
    Weapons.setLoadout(shooter, [key]);
    TestArena.aimAt(shooter, target);
    TestArena.hold(shooter, BTN.FIRE, 1);
    Sim.run(TICK_RATE * 2);
  }
  Bus.off('damage', handler);
  check('weapons dealt damage', events > 10, events);
  check('health lost equals the sum of damage events', Test.near(start - Actors.health[target], healthLost, 0.01), (start - Actors.health[target]) + ' vs ' + healthLost);
  check('every damage event came from a Damage.apply call', Damage.applyCount - callsBefore >= events);
  const script = Array.from(document.scripts).map((element) => element.textContent).join('\n');
  const sections = script.split(/\n\/\/ ==== (\S+) ====\n/);
  const offenders = [];
  for (let k = 1; k < sections.length; k += 2) {
    if (sections[k] === '11c-damage.js' || sections[k].startsWith('20')) continue;
    if (DAMAGE_SIDE_PATHS.some((pattern) => pattern.test(sections[k + 1]))) offenders.push(sections[k]);
  }
  check('no damage side path lowers health outside Damage.apply', sections.length > 10 && offenders.length === 0, offenders.join(', '));
  const samples = ['Actors.health[id] -= 5;', 'Actors.armor[id]--;', 'Actors.shield[t] = Math.max(0, Actors.shield[t] - 5);'];
  check('the side path patterns catch every lowering form', samples.every((line) => DAMAGE_SIDE_PATHS.some((pattern) => pattern.test(line))) &&
    !DAMAGE_SIDE_PATHS.some((pattern) => pattern.test('Actors.health[id] = Math.min(cap, Actors.health[id] + 5);')));
  TestArena.finish();
});

// HP-001 order: zone x precision before the victim's reductions (a 30 headshot into a 10-point block pool deals 60 - 10).
Test.add('damage', (check) => {
  TestArena.start({ health: 'stack' });
  const guard = TestArena.actor(1, 0, 0), attacker = TestArena.actor(2, 0, 5, Math.PI);
  Actors.health[guard] = Actors.maxHealth[guard] = 1000;
  Weapons.setLoadout(guard, ['bulwark']);
  Actors.buttons[guard] = BTN.ALT;
  Sim.run(3);
  WeaponSpecialState.blockPool[guard] = 10;
  const mode = CAT.weapons.byId('warden').primary;
  const head = zoneMultiplier(Game.match.rules, { mode, zone: 'head', stomach: false });
  const dealt = TestArena.hit(attacker, guard, 30, { mode, zone: 'head', dx: 0, dy: 0, dz: -1 });
  Actors.buttons[guard] = 0;
  check('HP-001 zone x precision applies before victim reductions', head > 1 && Test.near(dealt, 30 * head - 10, 1e-4), dealt + ' head x' + head);
  TestArena.finish();
});
// One lifesteal helper (PU12, X13, C24) and one heal path: a share of damage dealt to another heals the living source.
Test.add('damage', (check) => {
  TestArena.start();
  const source = TestArena.actor(0, 0, 0), target = TestArena.actor(1, 0, 5);
  const event = { source, target, amount: 20 };
  Actors.health[source] = 50;
  Damage.lifesteal(event, 0.5);
  check('lifesteal heals the source by the share of the damage', Actors.health[source] === 60, Actors.health[source]);
  Actors.health[source] = Actors.maxHealth[source] - 1;
  Damage.lifesteal(event, 0.5);
  check('lifesteal stops at max health', Actors.health[source] === Actors.maxHealth[source]);
  Actors.health[source] = 50;
  Damage.lifesteal({ source, target: source, amount: 20 }, 0.5);
  check('self damage steals nothing', Actors.health[source] === 50);
  const steal = Damage.lifesteal, holds = CardRun.holds, shares = [];
  Damage.lifesteal = (payload, share) => { shares.push(share); };
  CardRun.holds = (kind) => kind === CARD_KIND.lifesteal;
  try {
    Powerups.lifesteal[source] = 0.25;
    Powerups.onDamage(event);
    onDamageLifesteal({ lifesteal: 0.1 }, event);
    cardDamage(event);
  } finally { Damage.lifesteal = steal; CardRun.holds = holds; Powerups.lifesteal[source] = 0; }
  check('PU12, X13 and C24 all heal through Damage.lifesteal', shares.length === 3 && shares[0] === 0.25 && shares[1] === 0.1 && shares[2] === CardRun.value[CARD_KIND.lifesteal], shares.join(' '));
  TestArena.finish();
});
