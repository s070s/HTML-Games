// Self-tests for S11 weapons: catalogue rows, time-to-kill bands, exact fire rates, reload/swap timing, spread and
// recoil determinism, projectile sweeps, every W01..W46 row firing, carry limits, ammo, aim assist and the view model.

const SPEC_WEAPON_SETS = {
  arenaSet: 'W01 W04 W19 W21 W23 W30 W31 W32 W36 W37 W45', tacticalSet: 'W02 W04 W05 W06 W09 W11 W13 W14 W19 W24 W25 W29',
  militarySet: 'W02 W04 W05 W09 W10 W11 W13 W14 W15 W16 W19 W24 W25 W28 W29 W33', sandboxSet: 'W02 W05 W12 W15 W16 W17 W18 W23 W24 W31 W32 W35',
  ravagerSet: 'W01 W19 W20 W22 W26 W28 W31 W36 W39 W44 W45', knightSet: 'W03 W19 W20 W26 W34 W36 W38 W40', exoticSet: 'W07 W12 W27 W34 W37 W38 W39 W43 W44',
};
const FIRE_TYPES = ['hitscan', 'projectile', 'beam', 'melee', 'cone', 'lock', 'zoom', 'toggle', 'block', 'detonate', 'tool'];
const TRIGGERS = ['auto', 'semi', 'burst', 'charge', 'release'];
const BASE_HEALTH = 100;

// Shots needed against 100 HP and the time from the first to the killing shot (all hits, no falloff, body zone).
function timeToKill(mode) {
  const charge = mode.charge;
  const damage = charge && charge.target !== 'pellets' && charge.target !== 'multiplier' ? chargeDamage(charge, 1) : mode.damage;
  const pellets = charge && charge.target === 'pellets' ? chargeLevelValue(charge, 1) : mode.pellets;
  const perShot = (damage + (mode.splash ? mode.splash.dmg : 0)) * pellets;
  if (perShot <= 0) return -1;
  const shots = Math.ceil(BASE_HEALTH / perShot) - 1;
  const lockTime = mode.lock ? mode.lock.time : 0, chargeTime = charge ? charge.time : 0;
  const between = mode.burst ? Math.floor(shots / mode.burst) / mode.rate + (shots % mode.burst) * mode.burstGap : shots / mode.rate;
  return between + lockTime + chargeTime + mode.spinUp;
}
function giveFull(id, key) {
  Weapons.setLoadout(id, [key]);
  const weapon = CAT.weapons.byId(key), slot = Weapons.slotIndex(id, weapon.index);
  Weapons.magazine[slot] = 30000; Weapons.altAmmo[slot] = 30000; Weapons.reserve[slot] = 30000;
  return weapon;
}
function countShots(id, buttons, seconds) {
  return TestArena.count('weapon.fire', () => TestArena.hold(id, buttons, seconds));
}
// Presses and releases the trigger on alternate steps (the fastest possible tapping).
function countTapped(id, seconds) {
  return TestArena.count('weapon.fire', () => {
    for (let step = 0; step < seconds * TICK_RATE; step++) { Actors.buttons[id] = step % 2 ? 0 : BTN.FIRE; Sim.step(); }
    Actors.buttons[id] = 0;
  });
}

Test.add('weapons', (check) => {
  const codes = CAT.weapons.map((weapon) => weapon.code).join(' ');
  const expected = Array.from({ length: 46 }, (unused, index) => 'W' + String(index + 1).padStart(2, '0')).join(' ');
  check('W01..W46 all present in order', CAT.weapons.length === 46 && codes === expected, codes);
  check('P01..P16 projectiles present', CAT.projectiles.length >= 16 && CAT.projectiles.slice(0, 16).every((row, index) => row.code === 'P' + String(index + 1).padStart(2, '0')));
  const problems = [];
  for (const weapon of CAT.weapons) {
    for (const mode of [weapon.primary, weapon.alt]) {
      if (!mode) { problems.push(weapon.id + ': missing mode'); continue; }
      if (!FIRE_TYPES.includes(mode.type)) problems.push(mode.id + ': type ' + mode.type);
      if (!TRIGGERS.includes(mode.trigger)) problems.push(mode.id + ': trigger ' + mode.trigger);
      if (mode.projectile && !CAT.projectiles.byId(mode.projectile)) problems.push(mode.id + ': projectile ' + mode.projectile);
      if (!CAT.recoil.byId(mode.recoil)) problems.push(mode.id + ': recoil ' + mode.recoil);
      if (mode.status && !CAT.statusEffects.byId(mode.status.id)) problems.push(mode.id + ': status ' + mode.status.id);
      if (!CAT.elements.byId(mode.element)) problems.push(mode.id + ': element ' + mode.element);
      if (mode.tool && !Weapons.tools[mode.tool]) problems.push(mode.id + ': tool ' + mode.tool);
      if (mode.special && !Weapons.specials[mode.special]) problems.push(mode.id + ': special ' + mode.special);
      if (mode.charge && !(mode.charge.time > 0)) problems.push(mode.id + ': charge time');
      if ((mode.type === 'projectile' || mode.type === 'detonate') && !mode.projectile) problems.push(mode.id + ': no projectile');
    }
    if (weapon.equipTime < 0.3 || weapon.slot < 1 || weapon.slot > 9) problems.push(weapon.id + ': equip/slot');
    if (weapon.mag && !(weapon.reload > 0)) problems.push(weapon.id + ': reload');
    if ('ref' in weapon) problems.push(weapon.id + ': ref field');
  }
  check('every fire mode is valid data (types, triggers, keys)', problems.length === 0, problems.slice(0, 6).join('; '));
  for (const id in SPEC_WEAPON_SETS) {
    const set = CAT.weaponSets.byId(id), codesInSet = set ? set.weapons.map((key) => CAT.weapons.byId(key).code).join(' ') : '';
    check('WPN-006 ' + id + ' matches the spec', codesInSet === SPEC_WEAPON_SETS[id], codesInSet);
  }
  const unknown = CAT.weaponSets.flatMap((set) => set.weapons.concat(set.start)).filter((key) => !CAT.weapons.byId(key));
  check('weapon sets only name existing weapons', unknown.length === 0, unknown.join(', '));
  check('WPN-011 explosive alt fires arm at >= 6 m', CAT.projectiles.byId('contact').arm >= 6);
  const unarmedAlts = ['shardcaster', 'stakedriver', 'talonbow', 'starthrower'].filter((key) => !(CAT.weapons.byId(key).alt.arm >= 6));
  check('WPN-011 the W21, W26, W27 and W38 explosive alts arm at >= 6 m', unarmedAlts.length === 0, unarmedAlts.join());
});

// WPN-011: an explosive alt that hits closer than its arm distance is a dud.
Test.add('weapons', (check) => {
  TestArena.start({ weaponSet: 'fullSet' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 3);
  giveFull(shooter, 'talonbow');
  TestArena.aimAt(shooter, target);
  let blasts = -1;
  const shots = TestArena.count('weapon.fire', () => { blasts = TestArena.count('explosion', () => TestArena.hold(shooter, BTN.ALT, 0.5)); });
  check('WPN-011 the W27 explosive arrow does not explode at 3 m', shots >= 1 && blasts === 0, blasts + ' / ' + shots);
  TestArena.finish();
});

// WPN-011: the W21 alt shards inherit the alt mode but not its arm distance.
Test.add('weapons', (check) => {
  TestArena.start({ weaponSet: 'fullSet' });
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 1.5, 20);
  const grenade = Projectiles.spawn(CAT.projectiles.byId('grenade'), shooter, CAT.weapons.byId('shardcaster').index, 1, 0, 0.1, 20, 0, 0, 0, 100);
  Projectiles.explodeAt(grenade, 0, 0.1, 20, -1, ZONE.NONE);
  Sim.run(TICK_RATE / 2);
  check('WPN-011 W21 alt shards damage a sponge 1.5 m from the burst', Actors.health[target] < 100000, Actors.health[target]);
  Projectiles.clear();
  TestArena.finish();
});

Test.add('weapons', (check) => {
  const outside = [];
  for (const weapon of CAT.weapons) {
    const band = weapon.family.ttk;
    if (!band) continue;
    const ttk = timeToKill(weapon.primary);
    if (ttk < band[0] - 1e-6 || ttk > band[1] + 1e-6) outside.push(weapon.code + ' ' + weapon.id + ' ' + ttk.toFixed(3) + ' not in ' + band.join('-'));
  }
  check('time-to-kill vs 100 HP inside the family band for every weapon', outside.length === 0, outside.join('; '));
  check('TTK table: W13 three shots in 0.2 s, W24 one shot', Test.near(timeToKill(CAT.weapons.byId('vanguard').primary), 0.2, 1e-6) && timeToKill(CAT.weapons.byId('heron').primary) === 0);
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0);
  TestArena.sponge(2, 0, 20);
  const cases = [['wasp', 13], ['tempest', 11], ['twinsting', 15], ['stormlash', 20], ['anvil', 9]];
  for (const [key, rate] of cases) {
    giveFull(shooter, key);
    const shots = countShots(shooter, BTN.FIRE, 10);
    check('fire rate exact over 10 s: ' + key + ' ' + rate + ' rps', Math.abs(shots - rate * 10) <= 1, shots);
  }
  giveFull(shooter, 'warden');
  check('semi-auto at its rate when tapped every other step: 4 rps', Math.abs(countTapped(shooter, 10) - 40) <= 1);
  giveFull(shooter, 'ratchet');
  check('burst: 3 bursts/s x 3 rounds over 10 s', Math.abs(countTapped(shooter, 10) - 90) <= 3);
  giveFull(shooter, 'hailstorm');
  check('spin-up 0.5 s then 18 rps', Math.abs(countShots(shooter, BTN.FIRE, 10) - 9.5 * 18) <= 2);
  giveFull(shooter, 'verdict');
  let taps = 0;
  for (let k = 0; k < 5; k++) taps += countShots(shooter, BTN.FIRE, 0.2) + countShots(shooter, 0, 0.3);
  check('semi-auto fires once per press', taps === 5, taps);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0);
  Weapons.setLoadout(shooter, ['maul', 'wasp']);
  const wasp = CAT.weapons.byId('wasp'), slot = Weapons.slotIndex(shooter, wasp.index);
  check('setLoadout draws the last key at once', Weapons.currentWeapon(shooter) === wasp && Weapons.magazine[slot] === 30 && Weapons.reserve[slot] === 120);
  Weapons.magazine[slot] = 1;
  TestArena.hold(shooter, BTN.FIRE, 0.1);
  Sim.step();
  let empties = TestArena.count('weapon.empty', () => { Actors.buttons[shooter] = BTN.FIRE; Sim.step(); Sim.step(); Actors.buttons[shooter] = 0; });
  check('fire on empty: one weapon.empty per press and an automatic reload', empties === 1 && Weapons.state[shooter] === WEAPON_STATE.RELOAD);
  Sim.run(Math.round(wasp.reload * TICK_RATE) - 3);
  check('reload not finished before its time', Weapons.magazine[slot] === 0);
  Sim.run(3);
  check('reload fills the magazine at exactly ' + wasp.reload + ' s', Weapons.magazine[slot] === 30 && Weapons.reserve[slot] === 90, Weapons.magazine[slot]);
  Weapons.magazine[slot] = 10;
  TestArena.hold(shooter, BTN.RELOAD, 0.5);
  TestArena.hold(shooter, BTN.FIRE, 0.2);
  check('magazine reload ignores the trigger', Weapons.state[shooter] === WEAPON_STATE.RELOAD && Weapons.magazine[slot] === 10);
  Actors.slotRequest[shooter] = 1;
  Sim.step();
  Actors.slotRequest[shooter] = 0;
  check('switching cancels the reload without ammo', Weapons.state[shooter] === WEAPON_STATE.SWAP && Weapons.magazine[slot] === 10);
  const maul = CAT.weapons.byId('maul');
  Sim.run(Math.round(maul.equipTime * TICK_RATE) - 2);
  check('swap waits for the equip time', Weapons.state[shooter] === WEAPON_STATE.SWAP);
  Sim.run(2);
  check('swap ends after equipTime with the new weapon', Weapons.state[shooter] === WEAPON_STATE.IDLE && Weapons.currentWeapon(shooter) === maul);
  const switches = TestArena.count('weapon.switch', () => { Actors.buttons[shooter] = BTN.NEXT_WEAPON; Sim.step(); Actors.buttons[shooter] = 0; Sim.step(); });
  check('next weapon switches and emits weapon.switch', switches === 1 && Weapons.pending[shooter] === wasp.index);
  const firedDuringSwap = countShots(shooter, BTN.FIRE, 0.2);
  check('no firing during a swap', firedDuringSwap === 0);
  Weapons.setLoadout(shooter, ['scattergun']);
  const shotgun = CAT.weapons.byId('scattergun'), shells = Weapons.slotIndex(shooter, shotgun.index);
  Weapons.magazine[shells] = 2;
  TestArena.hold(shooter, BTN.RELOAD, shotgun.reload * 2 + 0.05);
  check('shell reload loads one shell per ' + shotgun.reload + ' s', Weapons.magazine[shells] === 4, Weapons.magazine[shells]);
  const shot = countShots(shooter, BTN.FIRE, 0.05);
  check('firing interrupts a shell reload', shot === 1 && Weapons.state[shooter] === WEAPON_STATE.IDLE, shot);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  const directions = () => {
    TestArena.start({});
    const shooter = TestArena.actor(1, 0, 0);
    giveFull(shooter, 'tempest');
    const points = [];
    const handler = Bus.on('impact', (event) => points.push(event.x.toFixed(5) + ',' + event.y.toFixed(5)));
    World.load({ id: 'wall', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }, { shape: 'box', min: [-20, 0, 30], max: [20, 20, 31] }] });
    Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0.05;
    TestArena.hold(shooter, BTN.FIRE, 30 / 11);
    Bus.off('impact', handler);
    TestArena.finish();
    return points;
  };
  Rng.reseed(77);
  const first = directions();
  Rng.reseed(77);
  const second = directions();
  check('seeded spray pattern identical across runs', first.length >= 29 && first.join('|') === second.join('|'), first.length);
  const pattern = CAT.recoil.byId('rifle').pattern;
  check('WPN-004 30-entry pitch/yaw pattern', pattern.length === RECOIL_PATTERN_LENGTH * 2 && pattern[0] > 0);
  const climbs = first.length > 10 && Number(first[10].split(',')[1]) > Number(first[0].split(',')[1]);
  check('spray climbs while the trigger is held', climbs, first[0] + ' -> ' + first[10]);
});

Test.add('weapons', (check) => {
  // MOV-025 itself (every row of the tactical table) is tested in the move group: weapons only add Move.inaccuracy.
  TestArena.start({ precision: 'tactical', move: 'tactical' });
  const shooter = TestArena.actor(1, 0, 0), tempest = giveFull(shooter, 'tempest');
  const spread = () => Weapons.spreadDegrees(shooter, tempest, tempest.primary);
  check('WPN-003 first shot standing is exact for rifles', spread() === 0);
  Actors.y[shooter] = 1; Motion.grounded[shooter] = 0;   // a real short fall
  Sim.step();
  check('MOV-025 airborne: the spread adds Move.inaccuracy (+10 deg)', Move.inaccuracy(shooter) === 10 && Test.near(spread(), 0.25 + 10, 1e-4), spread());
  for (let step = 0; step < TICK_RATE && !(Actors.flags[shooter] & ACTOR_FLAG.ON_GROUND); step++) Sim.step();
  const landing = spread();
  Sim.run(Math.round(0.3 * TICK_RATE) + 1);
  check('MOV-025 landing +3 deg decaying over 0.3 s', landing > 2.8 && landing <= 3.25 && spread() === 0, landing + ' -> ' + spread());
  const heron = giveFull(shooter, 'heron');
  const hip = Weapons.spreadDegrees(shooter, heron, heron.primary);
  TestArena.hold(shooter, BTN.ALT, 0.3);
  Actors.buttons[shooter] = BTN.ALT;
  Sim.step();
  check('ADS reaches 1 and the scoped sniper is exact (adsSpreadMult 0)', Weapons.ads[shooter] === 1 && hip >= 8 && Weapons.spreadDegrees(shooter, heron, heron.primary) === 0, hip);
  check('scoped move speed uses adsMoveMult', Test.near(Weapons.speedScale[shooter], heron.adsMoveMult, 1e-6), Weapons.speedScale[shooter]);
  check('the weapon speed scale reaches S10 (Move.weaponSpeedScale)', Move.weaponSpeedScale[shooter] === Weapons.speedScale[shooter], Move.weaponSpeedScale[shooter]);
  Actors.buttons[shooter] = 0;
  TestArena.finish();
});

// WPN-003 in presets without a MOV-025 table: + moveSpread x speed fraction f, + an air term; standing first shots stay exact.
Test.add('weapons', (check) => {
  TestArena.start({ move: 'arena' });
  const shooter = TestArena.actor(1, 0, 0), tempest = giveFull(shooter, 'tempest'), mode = tempest.primary;
  const spread = () => Weapons.spreadDegrees(shooter, tempest, mode);
  check('WPN-003 standing first shot exact without a table', Move.preset(shooter).inaccuracy === null && spread() === 0);
  Actors.vx[shooter] = Move.preset(shooter).groundSpeed;
  const running = spread();
  check('WPN-003 running adds moveSpread x f', Test.near(running, mode.spreadDeg + mode.moveSpread * MOVE_SPREAD_DEGREES, 1e-4), running);
  Motion.grounded[shooter] = 0;
  check('WPN-003 airborne adds the air term', Test.near(spread(), running + mode.moveSpread * AIR_SPREAD_DEGREES, 1e-4), spread());
  const ramjet = giveFull(shooter, 'ramjet'), lancet = giveFull(shooter, 'lancet');
  check('WPN-003 the default term spares projectile modes and the W23 rail (arena rockets stay exact)', Weapons.spreadDegrees(shooter, ramjet, ramjet.primary) === ramjet.primary.spreadDeg
    && Weapons.spreadDegrees(shooter, lancet, lancet.primary) === 0, Weapons.spreadDegrees(shooter, ramjet, ramjet.primary));
  Actors.vx[shooter] = 0; Motion.grounded[shooter] = 1;
  TestArena.finish();
});

// Movement hooks: S10 decides when an actor may fire (MOV-021 sprint-to-fire delay) and scales damage during a roll (MV08).
Test.add('weapons', (check) => {
  TestArena.start();
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 5);
  giveFull(shooter, 'tempest');
  setClock(shooter, CLOCK.FIRE_DELAY, 1);
  check('no shot while S10 says the actor cannot fire (Move.canFire)', !Move.canFire(shooter) && countShots(shooter, BTN.FIRE, 0.3) === 0);
  setClock(shooter, CLOCK.FIRE_DELAY, 0);
  check('fires again once Move.canFire allows it', countShots(shooter, BTN.FIRE, 0.3) > 0);
  const full = TestArena.hit(shooter, target, 40);
  Move.setPreset(target, 'parkour');
  setClock(target, CLOCK.ROLL, 0.4);
  const rolling = TestArena.hit(shooter, target, 40);
  check('a rolling target takes damage x Move.damageScale (MV08 0.25)', full === 40 && Test.near(rolling, 40 * 0.25, 1e-4), full + ' / ' + rolling);
  Move.setPreset(target, null);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-5, 0, 10], max: [5, 5, 10.05], material: 'concrete' }]);
  const shooter = TestArena.actor(1, 0, 0), behind = TestArena.sponge(2, 0, 14);
  const arrow = CAT.projectiles.byId('arrow');
  let passed = 0;
  for (let k = 0; k < 20; k++) {
    const i = Projectiles.spawn(arrow, shooter, CAT.weapons.byId('talonbow').index, 0, (k - 10) * 0.3, 1.5, 9.4, 0, 0, 70, 50);
    Sim.run(TICK_RATE / 2);
    if (Projectiles.state[i] && Projectiles.z[i] > 10.05) passed++;
  }
  check('no projectile tunnels through a 5 cm wall at 70 m/s', passed === 0 && Actors.health[behind] === 100000, passed);
  const rocket = CAT.projectiles.byId('rocket');
  const ramjet = CAT.weapons.byId('ramjet');
  for (let k = 0; k < PROJECTILE_CAP + 10; k++) Projectiles.spawn(rocket, shooter, ramjet.index, 0, 0, 30, 0, 0, 0, 0, 0);
  check('pool cap per projectile row recycles the oldest', Projectiles.active === rocket.poolSize, Projectiles.active);
  Projectiles.clear();
  TestArena.finish();
});

// AUD-005 / ACC-002: an enemy rocket closing in on the local player warns once; one flying away, the player's own and a grenade do not.
Test.add('weapons', (check) => {
  TestArena.start({});
  const player = TestArena.actor(1, 0, 0), enemy = TestArena.actor(2, 0, 40);
  const rocket = CAT.projectiles.byId('rocket'), grenade = CAT.projectiles.byId('grenade'), ramjet = CAT.weapons.byId('ramjet').index;
  Game.playerId = player;
  const warnings = [];
  const handler = Bus.on('projectile.incoming', (event) => warnings.push(event.kind + ':' + event.source));
  Projectiles.spawn(rocket, enemy, ramjet, 0, 0, 1.5, 40, 0, 0, -30, 0);      // straight at the player
  Projectiles.spawn(rocket, enemy, ramjet, 0, 5, 1.5, 20, 0, 0, 30, 0);       // 21 m away, flying away
  Projectiles.spawn(rocket, player, ramjet, 0, 0, 1.5, 2, 0, 0, 30, 0);       // the player's own
  Projectiles.spawn(grenade, enemy, ramjet, 0, 3, 1.5, 15, 0, 0, -8, 0);      // a closing grenade (not an incoming row)
  Sim.run(TICK_RATE);
  Bus.off('projectile.incoming', handler);
  check('an enemy rocket closing within 25 m sends one projectile.incoming (rocket whistle)', warnings.length === 1 && warnings[0] === 'rocket:' + enemy, warnings.join());
  Game.playerId = -1;
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-3, 0, 8], max: [3, 3, 8.1], material: 'wood' }]);
  const shooter = TestArena.actor(1, 0, 0), front = TestArena.sponge(2, -0.6, 4), middle = TestArena.sponge(2, -0.6, 6), back = TestArena.sponge(2, 0.6, 11);
  const lancet = giveFull(shooter, 'lancet');
  Actors.x[shooter] = 10;
  const row = [3, 4, 5, 6, 7, 8].map((z) => TestArena.sponge(2, 10, z));
  TestArena.aimAt(shooter, row[0], ZONE.HEAD);
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0;
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  const pierced = row.map((id) => Actors.health[id] < 100000);
  check('W23 rail pierces 4 targets and stops in the 5th', pierced.join() === 'true,true,true,true,true,false', pierced.join());
  row.forEach((id) => { Actors.alive[id] = 0; });
  Actors.x[shooter] = 0;
  Actors.x[front] = Actors.x[middle] = 0;
  const vanguard = giveFull(shooter, 'vanguard');
  TestArena.aimAt(shooter, back);
  Actors.x[front] = Actors.x[middle] = 20;
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  check('WPN-005 medium penetration passes thin wood at 0.7', Test.near(100000 - Actors.health[back], 34 * 0.7, 0.02), 100000 - Actors.health[back]);
  check('rows used', !!lancet && !!vanguard);
  TestArena.finish();
});

// Every W01..W46 row: give, aim at a target, use primary then alt; each must do its job.
function exerciseMode(shooter, target, weapon, mode, button) {
  Weapons.resetFiring(shooter);
  const slot = Weapons.slotIndex(shooter, weapon.index);
  Weapons.magazine[slot] = 30000; Weapons.altAmmo[slot] = 30000;
  const startHealth = Actors.health[target];
  aimForMode(shooter, target, mode);
  if (button === BTN.FIRE && weapon.alt.type === 'zoom') { TestArena.hold(shooter, BTN.ALT, ADS_SECONDS + 0.05); button |= BTN.ALT; }   // scoped weapons are tested aimed
  let fired = 0, effects = 0;
  const onFire = Bus.on('weapon.fire', () => { fired++; });
  const onEffect = Bus.on('impulse', () => { effects++; });
  TestArena.hold(shooter, button, mode.trigger === 'charge' ? mode.charge.time + 0.05 : 1.5);
  Sim.run(TICK_RATE * 4);
  Bus.off('weapon.fire', onFire);
  Bus.off('impulse', onEffect);
  return { fired, effects, damage: startHealth - Actors.health[target] };
}
// Lobbed projectiles need a ballistic aim (flat ground: pitch = asin(g d / v^2) / 2 above the line of sight).
function aimForMode(shooter, target, mode) {
  TestArena.aimAt(shooter, target);
  const row = mode.projectile ? CAT.projectiles.byId(mode.projectile) : null;
  if (!row || !row.gravity) return;
  const speed = mode.speed || row.speed, distance = Math.hypot(Actors.x[target] - Actors.x[shooter], Actors.z[target] - Actors.z[shooter]);
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = Actors.pitch[shooter] + Math.asin(Math.min(1, row.gravity * distance / (speed * speed))) / 2;
}
function modeDealsDamage(mode) { return mode.damage > 0 || !!mode.splash || !!mode.charge || mode.heatDamage > 0 || mode.type === 'lock'; }
const MELEE_TEST_DISTANCE = 1.2;
const RANGED_TEST_DISTANCE = 8;         // beyond the 6 m arm distance of contact grenades
// Melee close in, cone weapons just inside their cone, everything else at the ranged distance.
function testDistance(weapon) {
  if (weapon.class === 'melee') return MELEE_TEST_DISTANCE;
  const cones = [weapon.primary.cone, weapon.alt.cone].filter((cone) => cone).map((cone) => cone.range - 1);
  return Math.min(RANGED_TEST_DISTANCE, ...cones);
}

Test.add('weapons', (check) => {
  const failures = [];
  for (const weapon of CAT.weapons) {
    TestArena.start({ weaponSet: 'fullSet' });
    const shooter = TestArena.actor(1, 0, 0);
    const target = TestArena.sponge(2, 0, testDistance(weapon));
    giveFull(shooter, weapon.id);
    TestArena.aimAt(shooter, target);
    if (weapon.id === 'twingate') Actors.pitch[shooter] = Actors.aimPitch[shooter] = -1;
    const primary = exerciseMode(shooter, target, weapon, weapon.primary, BTN.FIRE);
    if (!primary.fired) failures.push(weapon.code + ' primary never fired');
    if (modeDealsDamage(weapon.primary) && primary.damage <= 0) failures.push(weapon.code + ' primary dealt no damage');
    TestArena.place(target, 0, testDistance(weapon));   // the primary's knockback (S10 applies impulses) may have moved it
    const altProblem = checkAlt(shooter, target, weapon);
    if (altProblem) failures.push(weapon.code + ' alt: ' + altProblem);
    TestArena.finish();
  }
  check('every W01..W46 row fires and its primary and alt behave', failures.length === 0, failures.join('; '));
});

function checkAlt(shooter, target, weapon) {
  const mode = weapon.alt;
  if (mode.type === 'zoom') { Actors.buttons[shooter] = BTN.ALT; Sim.run(TICK_RATE / 2); Actors.buttons[shooter] = 0; return Weapons.ads[shooter] === 1 ? '' : 'no ADS'; }
  if (mode.type === 'toggle') return checkToggle(shooter, mode);
  if (mode.type === 'block') { Actors.buttons[shooter] = BTN.ALT; Sim.step(); const blocking = WeaponSpecialState.blocking[shooter]; Actors.buttons[shooter] = 0; return blocking ? '' : 'not blocking'; }
  if (mode.type === 'detonate') return checkDetonate(shooter, target, weapon);
  const result = exerciseMode(shooter, target, weapon, mode, BTN.ALT);
  if (!result.fired) return 'never fired';
  if (modeDealsDamage(mode) && result.damage <= 0) return 'no damage';
  return '';
}
// Stances toggle on ALT; a mount (needsLedge) must be refused on open ground (the ledge case has its own test).
function checkToggle(shooter, mode) {
  TestArena.hold(shooter, BTN.ALT, 0.05);
  const toggled = Weapons.toggled[shooter] === 1;
  if (mode.toggle.needsLedge) return toggled ? 'mounted without a ledge' : '';
  return toggled ? '' : 'not toggled';
}
// Explosives are lobbed and detonated; a drill (W43) is fired into the target and its damage must land on detonation.
function checkDetonate(shooter, target, weapon) {
  Weapons.resetFiring(shooter);
  const drill = CAT.projectiles.byId(weapon.alt.projectile).onHit === 'drill';
  if (drill) TestArena.aimAt(shooter, target);
  else Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0.3;
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  Sim.run(drill ? TICK_RATE / 2 : 10);
  const before = Actors.health[target];
  const explosions = TestArena.count('explosion', () => TestArena.hold(shooter, BTN.ALT, 0.05));
  if (drill) return Test.near(before - Actors.health[target], weapon.primary.damage, 1e-3) ? '' : 'detonation dealt ' + (before - Actors.health[target]);
  return explosions > 0 ? '' : 'nothing detonated';
}

Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 10);
  giveFull(shooter, 'sparklock');
  TestArena.aimAt(shooter, target);
  const early = countShots(shooter, BTN.FIRE, 0.3);
  const locked = countShots(shooter, BTN.FIRE, 1);
  check('W07 fires only after a 0.4 s lock', early === 0 && locked > 0 && Actors.health[target] < 100000, early + ' / ' + locked);
  giveFull(shooter, 'needlethorn');
  let combos = 0;
  const onBlast = Bus.on('explosion', (event) => { if (event.radius === 2) combos++; });
  TestArena.hold(shooter, BTN.FIRE, 1);
  Sim.run(TICK_RATE);
  Bus.off('explosion', onBlast);
  check('W12 seven stuck needles burst', combos >= 1, combos);
  giveFull(shooter, 'coilcaster');
  TestArena.aimAt(shooter, target);
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = Actors.pitch[shooter] + 0.04;
  TestArena.hold(shooter, BTN.ALT, 0.05);
  Sim.run(TICK_RATE / 4);
  Weapons.nextShot[shooter] = 0;
  let comboRadius = 0;
  const onCombo = Bus.on('explosion', (event) => { comboRadius = Math.max(comboRadius, event.radius); });
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  Bus.off('explosion', onCombo);
  check('W17 hitting the orb with the primary is a 4 m combo', comboRadius === 4, comboRadius);
  giveFull(shooter, 'frostbore');
  Actors.z[target] = 4;
  TestArena.aimAt(shooter, target);
  Weapons.nextShot[shooter] = 0;
  TestArena.hold(shooter, BTN.ALT, 0.05);
  check('W22 freeze blast freezes the target', Damage.hasStatus(target, 'freeze'));
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.actor(2, 0, 8, Math.PI);
  giveFull(shooter, 'hush');
  TestArena.aimAt(shooter, target);
  TestArena.hold(shooter, BTN.ALT, 0.05);
  check('W06 sleep dart: target sleeps, no damage', Damage.hasStatus(target, 'sleep') && Actors.health[target] === 100);
  giveFull(shooter, 'hookjaw');
  let pulled = null;
  const onPull = Bus.on('impulse', (event) => { if (event.id === shooter) pulled = Object.assign({}, event); });
  TestArena.hold(shooter, BTN.ALT, 0.05);
  Sim.run(TICK_RATE / 2);
  Bus.off('impulse', onPull);
  check('W20 hook pulls the user toward the target', pulled && pulled.z > 10, JSON.stringify(pulled));
  check('W20 hook has a 6 s cooldown', countShots(shooter, BTN.ALT, 1) === 0);
  TestArena.place(shooter, 0, 0);   // the hook really pulled the user (S10)
  giveFull(shooter, 'halcyon');
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0.2;
  TestArena.hold(shooter, BTN.ALT, 0.05);
  Sim.step();
  check('W46 guided warhead: the user stands still', Weapons.speedScale[shooter] === 0 && Projectiles.guiding[shooter] === 1);
  Projectiles.clear();
  giveFull(shooter, 'razorwind');
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0;
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  const out = Projectiles.countOwned(shooter, CAT.weapons.byId('razorwind').index);
  Sim.run(TICK_RATE * 2);
  check('W44 blade flies out and returns to the owner', out === 1 && Projectiles.countOwned(shooter, CAT.weapons.byId('razorwind').index) === 0);
  Weapons.nextShot[shooter] = 0;
  Actors.yaw[shooter] = Actors.aimYaw[shooter] = Math.PI / 2;
  World.load({ id: 'blade', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }, { shape: 'box', min: [6, 0, -5], max: [7, 5, 5] }] });
  TestArena.hold(shooter, BTN.ALT, 0.05);
  Sim.run(TICK_RATE);
  const lodged = Projectiles.state.indexOf(PROJECTILE_STATE.STUCK) >= 0;
  TestArena.hold(shooter, BTN.ALT, 0.05);
  Sim.run(TICK_RATE);
  check('W44 alt lodges the blade, alt again recalls it', lodged && Projectiles.countOwned(shooter, CAT.weapons.byId('razorwind').index) === 0);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const user = TestArena.actor(1, 0, 0), friend = TestArena.actor(1, 0, 8, Math.PI), enemy = TestArena.sponge(2, 0, 20);
  giveFull(user, 'twingate');
  Actors.pitch[user] = Actors.aimPitch[user] = -0.6;
  TestArena.hold(user, BTN.FIRE, 0.05);
  Actors.yaw[user] = Actors.aimYaw[user] = Math.PI;
  Weapons.nextShot[user] = 0;
  TestArena.hold(user, BTN.ALT, 0.05);
  const slot = user * 2;
  check('W42 places both gates', WeaponSpecialState.gateOpen[slot] === 1 && WeaponSpecialState.gateOpen[slot + 1] === 1);
  Actors.x[friend] = WeaponSpecialState.gateX[slot]; Actors.z[friend] = WeaponSpecialState.gateZ[slot]; Actors.y[friend] = WeaponSpecialState.gateY[slot] + 0.1;
  Actors.vy[friend] = -5; Motion.grounded[friend] = 0;   // falling onto the floor gate
  Game.match.rules = Object.assign({}, Game.match.rules, { gravityScale: 0 });   // S10 moves the friend first: no gravity keeps 5 m/s
  Sim.step();
  const exitZ = WeaponSpecialState.gateZ[slot + 1];
  check('W42 gate teleports an actor and keeps its speed', Math.abs(Actors.z[friend] - exitZ) < 1.5 && Test.near(Math.hypot(Actors.vx[friend], Actors.vy[friend], Actors.vz[friend]), 5, 1e-3), Actors.z[friend] + ' vs ' + exitZ);
  giveFull(user, 'lifter');
  Actors.yaw[user] = Actors.aimYaw[user] = 0; Actors.pitch[user] = Actors.aimPitch[user] = 0;
  Actors.z[friend] = 3; Actors.x[friend] = 0; Actors.y[friend] = 0;
  let pushed = null;
  const onPush = Bus.on('impulse', (event) => { if (event.id === friend) pushed = Object.assign({}, event); });
  TestArena.hold(user, BTN.FIRE, 0.05);
  Bus.off('impulse', onPush);
  check('W41 punt pushes an actor away', pushed && pushed.z > 10, JSON.stringify(pushed));
  const grenade = Projectiles.spawn(CAT.projectiles.byId('grenade'), enemy, CAT.weapons.byId('pitcher').index, 0, 0, 1.6, 5, 0, 0, -5, 0);
  Weapons.nextShot[user] = 0;
  TestArena.hold(user, BTN.ALT, 0.2);
  Actors.buttons[user] = BTN.ALT;
  Sim.step();
  const caught = WeaponSpecialState.heldProjectile[user] === grenade;
  Actors.buttons[user] = BTN.ALT | BTN.FIRE;
  Weapons.nextShot[user] = 0;
  Sim.step();
  Actors.buttons[user] = 0;
  check('W41 catches a projectile and throws it back as its own', caught && Projectiles.owner[grenade] === user && Projectiles.vz[grenade] > 20, caught);
  check('W41 exposes a prop hook for the world section', 'propHook' in WeaponSpecialState);
  TestArena.finish();
});

// W41 lifts props (S08 PropLift) and catches hand grenades (S12 Thrown); hitscan shots damage props (MAP-013).
Test.add('weapons', (check) => {
  TestArena.start({});
  World.load({ id: 'lifter-props', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }],
    props: [{ min: [-0.4, 0.9, 3], max: [0.4, 1.7, 3.8], mass: 20, health: 50 }, { min: [-0.5, 0, 12], max: [0.5, 3, 13], health: 50 }] });
  const user = TestArena.actor(1, 0, 0), enemy = TestArena.sponge(2, 0, 20);
  giveFull(user, 'lifter');
  Actors.pitch[user] = Actors.aimPitch[user] = 0;
  Actors.buttons[user] = BTN.ALT;
  Sim.run(2);
  const body = WeaponSpecialState.heldProp[user];
  check('W41 alt lifts a breakable prop off the world as a held body', body >= 0 && Bodies.active[body] === 1 && !Props.isStanding(0), body);
  Sim.run(10);
  check('W41 holds the lifted body in front of the holder', body >= 0 && Math.abs(Bodies.z[body] - LIFTER_HOLD_DISTANCE) < 0.2, body >= 0 ? Bodies.z[body] : -1);
  Actors.buttons[user] = BTN.ALT | BTN.FIRE;
  Weapons.nextShot[user] = 0;
  Sim.step();
  Actors.buttons[user] = 0;
  check('W41 punt launches the held body with the lifter impact damage', body >= 0 && WeaponSpecialState.heldProp[user] === -1 && Bodies.vz[body] > 20
    && Bodies.impactCap[body] === LIFTER_DAMAGE_CAP, body >= 0 ? Bodies.vz[body] : -1);
  Sim.run(TICK_RATE);
  const grenade = Thrown.spawn(CAT.gadgets.byId('frag'), enemy, 0, 1.6, 5, 0, 0, -3, itemTicks(10));
  Actors.buttons[user] = BTN.ALT;
  Weapons.nextShot[user] = 0;
  Sim.run(2);
  const caught = WeaponSpecialState.heldGrenade[user] === grenade;
  Actors.buttons[user] = BTN.ALT | BTN.FIRE;
  Weapons.nextShot[user] = 0;
  Sim.step();
  Actors.buttons[user] = 0;
  check('W41 catches a hand grenade and throws it back as its own', caught && Thrown.owner[grenade] === user && Thrown.vz[grenade] > 20, caught);
  Thrown.clear();
  giveFull(user, 'tempest');
  TestArena.hold(user, BTN.FIRE, 0.05);
  check('MAP-013 a hitscan shot damages the prop it hits', Props.health[1] < 50, Props.health[1]);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({ weaponSet: 'tacticalSet' });
  const id = TestArena.actor(1, 0, 0);
  Weapons.setLoadout(id, ['tanto', 'warden']);
  Weapons.give(id, 'tempest');
  const dropped = Weapons.give(id, 'heron') && Weapons.dropped;
  const carried = CAT.weapons.filter((weapon) => Weapons.has(id, weapon.id) && Weapons.countsTowardCarry(weapon)).length;
  check('WPN-009 carry limit 2 in tactical (melee does not count)', carried === 2 && Weapons.has(id, 'tanto') && dropped !== '', carried + ' ' + dropped);
  TestArena.start({ weaponSet: 'arenaSet' });
  const arena = TestArena.actor(1, 0, 0);
  CAT.weaponSets.byId('arenaSet').weapons.forEach((key) => Weapons.give(arena, key));
  check('arena carries the full arsenal', CAT.weaponSets.byId('arenaSet').weapons.every((key) => Weapons.has(arena, key)));
  const rocket = CAT.weapons.byId('ramjet'), slot = Weapons.slotIndex(arena, rocket.index);
  Weapons.give(arena, 'ramjet');
  check('WPN-007 owned weapon pickup gives ammo', Weapons.reserve[slot] === rocket.reserve + rocket.pickupAmmo);
  Weapons.addAmmo(arena, rocket.ammoType, 1000);
  check('ammo pickups cap at maxAmmo', Weapons.reserve[slot] === rocket.maxAmmo);
  TestArena.start({ weaponSet: 'exoticSet' });
  const tiered = TestArena.actor(1, 0, 0);
  Weapons.setLoadout(tiered, ['sparklock']);
  const pistol = CAT.weapons.byId('sparklock'), pistolSlot = Weapons.slotIndex(tiered, pistol.index);
  Weapons.magazine[pistolSlot] = 0; Weapons.reserve[pistolSlot] = 0;
  TestArena.hold(tiered, BTN.RELOAD, pistol.reload + 0.1);
  check('WPN-007 ammo tiers: primary-tier reserve is infinite', Weapons.magazine[pistolSlot] === pistol.mag && Weapons.ammo(tiered).infinite);
  Weapons.give(tiered, 'warden', 4);
  const warden = CAT.weapons.byId('warden');
  check('WPN-008 legendary rarity: +30% magazine', Weapons.magazine[Weapons.slotIndex(tiered, warden.index)] === Math.round(warden.mag * 1.3));
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-3, 0, 14], max: [3, 4, 14.5] }]);
  const id = TestArena.actor(1, 0, 0), enemy = TestArena.actor(2, 0.3, 10), hidden = TestArena.actor(2, 0, 20);
  const out = { x: 0, y: 0, z: 0, target: -1, angle: 0 };
  check('INP-008 aim assist finds the enemy inside the cone', Input.aimAssistTarget(id, out) && out.target === enemy && out.angle < AIM_ASSIST_CONE_DEG);
  Actors.alive[enemy] = 0;
  check('INP-008 no assist through walls', !Input.aimAssistTarget(id, out) && hidden >= 0);
  Weapons.setLoadout(id, ['tempest']);
  Game.playerId = id;
  const model = Render.viewModel({});
  check('Render.viewModel describes the held weapon', model.visible && model.shape === 'rifle' && model.swap === 1 && model.reload === 0 && model.ads === 0);
  Game.playerId = -1;
  TestArena.finish();
});

// Step 5.4: reload and equip durations the weapon would use now (the state machine is reset afterwards).
function measuredDurations(id, weapon, other) {
  const slot = Weapons.slotIndex(id, weapon.index);
  Weapons.state[id] = WEAPON_STATE.IDLE; Weapons.magazine[slot] = 0;
  Weapons.beginReload(id, weapon);
  const reload = Weapons.stateDuration[id];
  Weapons.state[id] = WEAPON_STATE.IDLE; Weapons.current[id] = other.index;
  Weapons.requestSwitch(id, weapon.index);
  const equip = Weapons.stateDuration[id];
  Weapons.state[id] = WEAPON_STATE.IDLE; Weapons.current[id] = weapon.index;
  return { reload, equip };
}
// Step 5.4: the stats a fitted weapon uses right now (bloom forces a non-zero spread to compare against).
function attachmentStats(id, weapon, other) {
  Weapons.bloom[id] = 1;
  Weapons.updateSpeed(id);
  const durations = measuredDurations(id, weapon, other);
  return {
    damage: Weapons.shotDamage(id, weapon, weapon.primary, 1), spread: Weapons.spreadDegrees(id, weapon, weapon.primary),
    mag: Weapons.magSize(id, weapon), reserve: Weapons.maxReserve(id, weapon), move: Weapons.speedScale[id],
    reload: durations.reload, equip: durations.equip, recoil: Weapons.modifier(id, weapon, STAT.RECOIL),
  };
}
// True when every stat equals base x the expected multiplier (mag and reserve are rounded to whole rounds).
function statsMatch(stats, base, weapon, multiplier) {
  const rounded = { mag: weapon.mag, reserve: weapon.maxAmmo };
  return WEAPON_STATS.every((stat) => {
    if (rounded[stat] !== undefined) return stats[stat] === Math.round(rounded[stat] * multiplier[stat]);
    return Test.near(stats[stat], base[stat] * multiplier[stat], 1e-4 * Math.max(1, base[stat]));
  });
}

Test.add('weapons', (check) => {
  check('attachment slots and multipliers are valid (0.5..2)', CAT.attachments.every((row) =>
    ATTACHMENT_SLOTS.includes(row.slot) && WEAPON_STATS.every((stat) => row[stat] >= 0.5 && row[stat] <= 2)));
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0);
  const sidearm = giveFull(id, 'warden'), rifle = CAT.weapons.byId('tempest');
  Weapons.give(id, 'tempest', 0);
  Weapons.current[id] = rifle.index;
  check('attachments: unknown keys and melee weapons are refused', !Weapons.attach(id, 'tempest', 'nothing') && !Weapons.attach(id, 'tanto', 'longBarrel'));
  const base = attachmentStats(id, rifle, sidearm);
  const wrong = CAT.attachments.filter((row) => {
    Weapons.detachAll(id, rifle);
    Weapons.attach(id, 'tempest', row.id);
    return !statsMatch(attachmentStats(id, rifle, sidearm), base, rifle, row);
  }).map((row) => row.id);
  check('every attachment: stat = base x modifier table', wrong.length === 0, wrong.join(' '));
  Weapons.detachAll(id, rifle);
  ['longBarrel', 'shortBarrel', 'laserSight'].forEach((key) => Weapons.attach(id, 'tempest', key));
  const stacked = attachmentStats(id, rifle, sidearm).spread;
  check('attachments stack multiplicatively and replace their own slot', Test.near(stacked, base.spread * 1.15 * 0.8, 1e-4), stacked + ' vs ' + base.spread);
  Weapons.detachAll(id, rifle);
  Weapons.statScale[id * WEAPON_STAT_COUNT + STAT.RELOAD] = 0.5;
  check('per-actor stat scale (perks) multiplies too', Test.near(attachmentStats(id, rifle, sidearm).reload, base.reload * 0.5, 1e-4));
  Weapons.statScale[id * WEAPON_STAT_COUNT + STAT.RELOAD] = 1;
  Weapons.attach(id, 'tempest', 'quickMag');
  Weapons.magazine[Weapons.slotIndex(id, rifle.index)] = rifle.mag;
  Weapons.attach(id, 'tempest', 'quickMag');
  check('fitting a smaller magazine trims the loaded rounds', Weapons.magazine[Weapons.slotIndex(id, rifle.index)] === Weapons.magSize(id, rifle));
  Weapons.give(id, 'tempest', 0);
  check('picking up an owned weapon again keeps its attachments', Weapons.modifier(id, rifle, STAT.MAG) === CAT.attachments.byId('quickMag').mag);
  TestArena.finish();
});

const FRONT_HIT = { dx: 0, dy: 0, dz: -1 };   // a hit travelling toward an actor that faces +z

Test.add('weapons', (check) => {
  TestArena.start({});
  const guard = TestArena.actor(1, 0, 0), attacker = TestArena.actor(2, 0, 5, Math.PI);
  Weapons.setLoadout(guard, ['scattergun', 'bulwark']);
  Actors.buttons[guard] = BTN.ALT;
  Sim.run(3);
  check('W03 block absorbs a frontal hit', TestArena.hit(attacker, guard, 40, FRONT_HIT) === 0 && Actors.health[guard] === 100);
  Weapons.requestSwitch(guard, CAT.weapons.byId('scattergun').index);
  Sim.run(TICK_RATE);
  Actors.buttons[guard] = 0;
  Sim.step();
  const dealt = TestArena.hit(attacker, guard, 40, FRONT_HIT);
  check('W03 swapping away ends the block: full frontal damage', dealt === 40 && WeaponSpecialState.blocking[guard] === 0, dealt);
  Weapons.setLoadout(guard, ['bulwark']);
  Actors.buttons[guard] = BTN.ALT;
  Sim.run(3);
  const wasBlocking = WeaponSpecialState.blocking[guard] === 1;
  TestArena.hit(-1, guard, 1, { kind: 'telefrag' });
  Actors.buttons[guard] = 0;
  check('W03 death drops the guard', wasBlocking && !Actors.alive[guard] && WeaponSpecialState.blocking[guard] === 0);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), fodder = TestArena.actor(2, 0, 2, Math.PI);
  Actors.kind[fodder] = ACTOR_KIND.ENEMY; Actors.profile[fodder] = { fodder: true };
  giveFull(shooter, 'frostbore');
  TestArena.aimAt(shooter, fodder);
  const hits = [];
  const onDamage = Bus.on('damage', (event) => { if (event.target === fodder) hits.push(event.amount); });
  TestArena.hold(shooter, BTN.ALT, 1 / TICK_RATE);
  Bus.off('damage', onDamage);
  const mode = CAT.weapons.byId('frostbore').alt;
  check('W22 freeze blast deals pellets x damage, no self-shatter', hits.length === mode.pellets && hits.every((amount) => amount === mode.damage), hits.join(' '));
  check('W22 freeze blast leaves fodder alive and frozen', Actors.alive[fodder] === 1 && Damage.hasStatus(fodder, 'freeze'));
  Sim.step();
  TestArena.hit(shooter, fodder, 10);
  check('HP-005 a follow-up hit shatters frozen fodder', !Actors.alive[fodder]);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0);
  const pitcher = giveFull(shooter, 'pitcher'), up = { x: 0, y: 0.6, z: 0.8 };
  const grenade = CAT.projectiles.byId('grenade'), mine = CAT.projectiles.byId('mine');
  const explosions = TestArena.count('explosion', () => {
    for (let k = 0; k < 3; k++) Projectiles.spawnFromWeapon(shooter, pitcher, pitcher.primary, MODE_PRIMARY, up, 0, 1, 0, -1);
    for (let k = 0; k < 5; k++) Projectiles.spawnFromWeapon(shooter, pitcher, pitcher.alt, MODE_ALT, up, 0, 1, 0, -1);
  });
  const grenades = Projectiles.countOwned(shooter, pitcher.index, grenade.index), mines = Projectiles.countOwned(shooter, pitcher.index, mine.index);
  check('W32 mine limit 4 recycles the oldest mine, never a grenade', explosions === 1 && grenades === 3 && mines === 4, explosions + ' / ' + grenades + ' / ' + mines);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({ friendlyFire: 0, selfDamage: 0.5 });
  const owner = TestArena.actor(1, 0, 0), ally = TestArena.actor(1, 1, 0), enemy = TestArena.actor(2, -1, 0);
  const kindler = giveFull(owner, 'kindler'), down = { x: 0, y: -1, z: 0 };
  const puddle = Projectiles.spawnFromWeapon(owner, kindler, kindler.alt, MODE_ALT, down, 10, 1, 0, -1);
  Projectiles.becomeArea(puddle, 0, 0.05, 0);
  Sim.run(TICK_RATE);
  check('W35 napalm puddle burns enemies', Damage.hasStatus(enemy, 'burn') && Actors.health[enemy] < 100);
  check('W35 puddle spares allies with friendly fire off', Actors.health[ally] === 100 && !Damage.hasStatus(ally, 'burn'));
  Projectiles.clear();
  Damage.resetHealth(owner);
  Damage.addStatus(owner, 'burn', owner);
  Sim.run(TICK_RATE);
  check('own burn ticks at rules.selfDamage: 10 HP/s x 0.5', Test.near(100 - Actors.health[owner], 5, 1e-3), 100 - Actors.health[owner]);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-1, 0, 0.4], max: [1, 1.1, 1.2] }]);
  const id = TestArena.actor(1, 0, 0);
  const heron = giveFull(id, 'heron'), slot = Weapons.slotIndex(id, heron.index);
  Actors.buttons[id] = BTN.ALT;
  Sim.run(TICK_RATE / 2);
  const scoped = Weapons.ads[id] === 1;
  Weapons.magazine[slot] = 0;
  Weapons.beginReload(id, heron);
  Sim.run(TICK_RATE / 2);
  Actors.buttons[id] = 0;
  Sim.step();   // the release must be seen before the next press
  check('ADS drops during a reload even with ALT held', scoped && Weapons.ads[id] === 0, Weapons.ads[id]);
  giveFull(id, 'anvil');
  TestArena.hold(id, BTN.ALT, 0.05);
  const mounted = Weapons.toggled[id] === 1;
  Actors.vx[id] = 3;
  Sim.step();
  Actors.vx[id] = 0;
  check('W29 mounts on a ledge and unmounts when the actor moves', mounted && Weapons.toggled[id] === 0, mounted + ' ' + Weapons.toggled[id] + ' ' + hasLedgeInFront(id));
  TestArena.hold(id, BTN.ALT, 0.05);
  const remounted = Weapons.toggled[id] === 1;
  Actors.z[id] = -10;
  Sim.step();
  check('W29 mount drops when the ledge is gone', remounted && Weapons.toggled[id] === 0);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 10);
  const mode = CAT.weapons.byId('kingfisher').alt;
  Weapons.lockIds[id * MAX_LOCKS + 1] = target; Weapons.lockTime[id * MAX_LOCKS + 1] = mode.lock.time;
  check('lock-on hands missiles a lock held in any slot', LockOn.targetFor(id, mode) === target);
  LockOn.clear(id);
  Weapons.setLoadout(id, ['tempest']);
  let fire = null, sounds = 0;
  const onFire = Bus.on('weapon.fire', (event) => { fire = Object.assign({}, event); });
  const onSound = Bus.on('sound', (event) => { if (event.source === id) sounds++; });
  TestArena.hold(id, BTN.MELEE, 0.05);
  Bus.off('weapon.fire', onFire);
  Bus.off('sound', onSound);
  check('quick melee emits weapon.fire (mode melee) and a sound', fire && fire.mode === 'melee' && sounds === 1, JSON.stringify(fire));
  Game.playerId = id;
  Weapons.nextShot[id] = 0;
  TestArena.hold(id, BTN.FIRE, 0.3);
  const model = Render.viewModel({});
  Game.playerId = -1;
  check('Render.viewModel carries the recoil punch in degrees', model.recoilPitch !== 0 && typeof model.recoilYaw === 'number', model.recoilPitch);
  const orb = CAT.projectiles.byId(CAT.weapons.byId('daybreak').primary.projectile);
  check('W45 orb is its own row: no combo, no parry', orb.id !== 'orb' && !orb.comboTarget && !orb.parryable);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0);
  TestArena.sponge(2, 0, 20);
  Weapons.setLoadout(id, ['warden']);
  const warden = CAT.weapons.byId('warden'), slot = Weapons.slotIndex(id, warden.index);
  Weapons.magazine[slot] = 5;
  Weapons.give(id, 'warden');
  check('W04 second pickup = dual: shared magazine x2, new gun loaded', Weapons.dual[slot] === 1 && Weapons.magSize(id, warden) === warden.mag * 2 && Weapons.magazine[slot] === 5 + warden.mag);
  Weapons.reserve[slot] = 30000; Weapons.magazine[slot] = 30000;
  const dualShots = countTapped(id, 5);
  check('W04 dual pistols fire at twice the rate (8 rps; tapping every other step reaches 7.5)', Test.near(Weapons.shotInterval(id, warden, warden.primary), 1 / (warden.primary.rate * 2), 1e-9) && dualShots >= 37, dualShots);
  Weapons.give(id, 'warden');
  check('W04 a third pickup only adds ammo', Weapons.dual[slot] === 1 && Weapons.magSize(id, warden) === warden.mag * 2);
  TestArena.finish();
});

// WPN-001 alt fires: W19 slug aims at 1.2x, W35 napalm airblasts enemy projectiles back, W30 beam repairs friendly devices.
Test.add('weapons', (check) => {
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0), enemy = TestArena.sponge(2, 0, 30), out = {};
  giveFull(id, 'scattergun');
  TestArena.hold(id, BTN.ALT, 0.5);
  Game.playerId = id;
  Weapons.viewModel(out);
  Game.playerId = -1;
  check('W19 slug: holding ALT aims down sights at 1.2x zoom', Weapons.ads[id] > 0 && out.zoom > 1 && out.zoom <= 1.2, Weapons.ads[id] + ' ' + out.zoom);
  const scatter = CAT.weapons.byId('scattergun'), pelletSpread = Weapons.spreadDegrees(id, scatter, scatter.primary);
  check('W19: holding the slug ALT leaves the pellet spread at its hip value', Test.near(pelletSpread, scatter.primary.spreadDeg, 1e-6), pelletSpread);
  Weapons.setLoadout(id, ['warden', 'heron']);   // the last key is drawn
  Actors.buttons[id] = BTN.ALT;
  Sim.run(TICK_RATE / 2);
  Actors.buttons[id] = BTN.ALT | BTN.NEXT_WEAPON; Sim.step(); Actors.buttons[id] = BTN.ALT; Sim.step();
  Game.playerId = id; Weapons.viewModel(out); Game.playerId = -1;
  check('W24 scoped: next weapon flips the scope to 8x instead of switching', out.zoom === 8 && Weapons.currentWeapon(id).id === 'heron', out.zoom + ' ' + Weapons.currentWeapon(id).id);
  Actors.buttons[id] = 0; Sim.run(TICK_RATE / 2);
  check('W24: lowering the sights returns the scope to 4x', Weapons.zoomed[id] === 0);
  giveFull(id, 'kindler');
  const rocket = Projectiles.spawn(CAT.projectiles.byId('rocket'), enemy, CAT.weapons.byId('ramjet').index, 0, 0, 1.6, 3, 0, 0, -10, 50);
  const friendly = Projectiles.spawn(CAT.projectiles.byId('rocket'), id, CAT.weapons.byId('ramjet').index, 0, 0.5, 1.6, 3, 0, 0, 10, 50);
  TestArena.hold(id, BTN.ALT, 1 / TICK_RATE);
  check('W35 airblast: an enemy rocket in front now flies away, owned by the shooter', Projectiles.owner[rocket] === id && Projectiles.vz[rocket] > 0, Projectiles.owner[rocket] + ' ' + Projectiles.vz[rocket]);
  check('W35 airblast: the napalm shot still fires and own projectiles are left alone', Projectiles.countOwned(id, CAT.weapons.byId('kindler').index, CAT.projectiles.byId('goo').index) === 1
    && Projectiles.owner[friendly] === id && Projectiles.vz[friendly] === 10);
  Projectiles.clear();
  const turret = Devices.spawn(CAT.gadgets.byId('sentry'), id, 0, 0, 6), row = CAT.gadgets.byId('sentry');
  Actors.pitch[id] = Actors.aimPitch[id] = Math.atan2(Devices.centreY(turret) - Actors.eyeY(id), 6);
  Devices.health[turret] = row.health / 2;
  giveFull(id, 'linker');
  TestArena.hold(id, BTN.ALT, 1);
  check('W30 beam repairs a friendly turret at about 60 HP/s', Devices.health[turret] > row.health / 2 + 40 && Devices.health[turret] <= row.health, Devices.health[turret]);
  Devices.remove(turret);
  Pve.setCore(0, 0, 15, 1000);
  Pve.core.health = 500;
  Actors.pitch[id] = Actors.aimPitch[id] = Math.atan2(Pve.core.y + CORE_HIT_LIFT - Actors.eyeY(id), 15);
  TestArena.hold(id, BTN.ALT, 1);
  check('W30 beam repairs the PvE core at about 60 HP/s', Pve.core.health > 540 && Pve.core.health <= 560, Pve.core.health);
  Pve.core.active = false;
  TestArena.finish();
});

// W24 scope sway (FireMode.breath): the aimed scope drifts and moves view and shots; holding breath (the Walk action)
// steadies it for 4 s, then the winded sway is larger until the breath refills; the touch BREATH button shows while it sways.
function weaponSwayPeak(id, buttons, seconds) {
  let peak = 0;
  Actors.buttons[id] = buttons;
  for (let i = 0; i < seconds * TICK_RATE; i++) { Sim.step(); peak = Math.max(peak, Math.abs(Weapons.swayYaw[id])); }
  return peak;
}
Test.add('weapons', (check) => {
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0), out = {}, aim = Vec.make();
  giveFull(id, 'heron');
  Game.playerId = id;
  const aimed = weaponSwayPeak(id, BTN.ALT, 2.5);
  check('W24 an aimed scope sways about SCOPE_SWAY_DEG', aimed > SCOPE_SWAY_DEG * 0.8 && aimed <= SCOPE_SWAY_DEG + 1e-4, aimed);
  for (let i = 0; i < TICK_RATE * 4 && Math.abs(Weapons.swayYaw[id]) < SCOPE_SWAY_DEG * 0.3; i++) Sim.step();
  Weapons.viewModel(out);
  Weapons.aimDirection(id, 0, aim);
  const shotYaw = wrapAngle(Math.atan2(aim.x, aim.z) - Actors.yaw[id]) / DEG;
  check('W24 the sway moves the view and the shots alike', Test.near(out.recoilYaw, Weapons.swayYaw[id], 1e-5) && Test.near(shotYaw, Weapons.swayYaw[id], 1e-3), shotYaw + ' ' + Weapons.swayYaw[id]);
  check('touch: the BREATH button (Walk) shows while the scope sways', TouchInput.needMet('breath') && TOUCH_CONTROLS.some((control) => control.need === 'breath' && control.action === 'walk'));
  weaponSwayPeak(id, BTN.ALT | BTN.WALK, 1);
  const steady = weaponSwayPeak(id, BTN.ALT | BTN.WALK, 2);
  check('W24 a held breath steadies the scope', steady < SCOPE_SWAY_DEG * SWAY_STEADY_SCALE * 1.5, steady);
  weaponSwayPeak(id, BTN.ALT | BTN.WALK, 1.5);
  const winded = weaponSwayPeak(id, BTN.ALT | BTN.WALK, 2.5);
  check('W24 after 4 s of held breath the winded sway grows past the normal sway', Weapons.breathUsed[id] === 4 && winded > SCOPE_SWAY_DEG * 1.5, winded);
  weaponSwayPeak(id, BTN.ALT, 4.5);
  check('W24 breathing normally refills the breath', Weapons.breathUsed[id] === 0, Weapons.breathUsed[id]);
  weaponSwayPeak(id, 0, 0.5);
  check('W24 lowered sights: no sway and no BREATH button', Weapons.swayYaw[id] === 0 && Weapons.swayPitch[id] === 0 && !TouchInput.needMet('breath'));
  giveFull(id, 'kestrel');
  check('a scope without breath never sways', weaponSwayPeak(id, BTN.ALT, 1) === 0 && Weapons.ads[id] === 1);
  Game.playerId = -1;
  TouchInput.setFlag('breath', false);
  TestArena.finish();
});

// W26 stake pins a victim standing just in front of a wall ('pinned' status); in the open it only hits.
Test.add('weapons', (check) => {
  TestArena.start({}, [{ shape: 'box', min: [-3, 0, 11], max: [3, 3, 12] }]);
  const id = TestArena.actor(1, 0, 0), walled = TestArena.sponge(2, 0, 10), open = TestArena.sponge(2, 20, 10);
  giveFull(id, 'stakedriver');
  TestArena.aimAt(id, walled);
  TestArena.hold(id, BTN.FIRE, 0.4);
  check('W26 a stake pins a victim against the wall behind it', Damage.hasStatus(walled, 'pinned') && Actors.health[walled] < 100000);
  Sim.step();   // the release must be seen before the next press
  TestArena.aimAt(id, open);
  TestArena.hold(id, BTN.FIRE, 1);
  check('W26 a victim in the open is hit but not pinned', Actors.health[open] < 100000 && !Damage.hasStatus(open, 'pinned'), Actors.health[open] + ' ' + Damage.hasStatus(open, 'pinned'));
  TestArena.finish();
});

// R-006: the W44 lodged-blade line stops at walls; an owner out of sight of the blade gets no line at all.
Test.add('weapons', (check) => {
  const wall = (z) => ({ shape: 'box', min: [-6, 0, z], max: [6, 5, z + 1] });
  TestArena.start({}, [wall(10), wall(20)]);
  const owner = TestArena.actor(1, 0, 15), near = TestArena.sponge(2, 0, 17.5);
  giveFull(owner, 'razorwind');
  TestArena.hold(owner, BTN.ALT, 0.05);
  Sim.run(TICK_RATE / 2);
  check('W44 blade lodged in the far wall', Projectiles.state.indexOf(PROJECTILE_STATE.STUCK) >= 0);
  Sim.run(TICK_RATE);
  check('W44 line cuts an enemy between the blade and the owner', Actors.health[near] < 100000, Actors.health[near]);
  Actors.alive[near] = 0;
  TestArena.place(owner, 0, 5);
  const behind = TestArena.sponge(2, 0, 8);
  Sim.run(TICK_RATE * 2);
  check('W44 line never cuts through a wall', Actors.health[behind] === 100000, 100000 - Actors.health[behind]);
  TestArena.finish();
});

DebugApi.giveWeapon =(id, key) => Weapons.give(id, key, 0);
DebugApi.weapons = Weapons;
DebugApi.damage = Damage;
