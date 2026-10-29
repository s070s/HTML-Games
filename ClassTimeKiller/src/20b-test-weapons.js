// Self-tests for S11 weapons: catalogue rows, time-to-kill bands, exact fire rates, reload/swap timing, spread and
// recoil determinism, projectile sweeps, every weapon row firing (38 rows, P3-04), carry limits, ammo, aim assist and the view model.

// P3-03 retired codes (never reused): merged into the weapon named in the migration map (WEAPON_MIGRATION, 04-save).
const RETIRED_WEAPON_CODES = ['W08', 'W11', 'W14', 'W16', 'W18', 'W22', 'W29', 'W33'];
const SPEC_WEAPON_SETS = {
  arenaSet: 'W01 W04 W19 W21 W23 W30 W31 W32 W36 W37 W45', tacticalSet: 'W02 W04 W05 W06 W09 W13 W19 W24 W25 W28',
  militarySet: 'W02 W04 W05 W09 W10 W13 W15 W19 W24 W25 W28 W31', sandboxSet: 'W02 W05 W12 W15 W25 W17 W10 W23 W24 W31 W32 W35',
  ravagerSet: 'W01 W19 W20 W26 W28 W31 W36 W39 W44 W45', knightSet: 'W03 W19 W20 W26 W34 W36 W38 W40', exoticSet: 'W07 W12 W27 W34 W37 W38 W39 W43 W44',
};
const FIRE_TYPES = ['hitscan', 'projectile', 'beam', 'melee', 'cone', 'lock', 'zoom', 'toggle', 'block', 'detonate', 'tool'];
const TRIGGERS = ['auto', 'semi', 'burst', 'charge', 'release'];

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
  const expected = Array.from({ length: 46 }, (unused, index) => 'W' + String(index + 1).padStart(2, '0')).filter((code) => !RETIRED_WEAPON_CODES.includes(code)).join(' ');
  check('W01..W46 without the 8 retired codes are present in order (38 weapons)', CAT.weapons.length === 38 && codes === expected, codes);
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
  const unarmedAlts = ['shardcaster', 'talonbow', 'starthrower'].filter((key) => !(CAT.weapons.byId(key).alt.arm >= 6));
  check('WPN-011 the W21, W27 and W38 explosive alts arm at >= 6 m', unarmedAlts.length === 0, unarmedAlts.join());
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
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0);
  TestArena.sponge(2, 0, 20);
  const cases = [['wasp', 13], ['vanguard', 10], ['hornet', 12], ['stormlash', 20], ['linker', 6]];
  for (const [key, rate] of cases) {
    giveFull(shooter, key);
    const shots = countShots(shooter, BTN.FIRE, 10);
    check('fire rate exact over 10 s: ' + key + ' ' + rate + ' rps', Math.abs(shots - rate * 10) <= 1, shots);
  }
  const semiRate = giveFull(shooter, 'warden').primary.rate;
  check('semi-auto at its rate when tapped every other step: ' + semiRate + ' rps', Math.abs(countTapped(shooter, 10) - semiRate * 10) <= 1);
  giveFull(shooter, 'ratchet');
  check('burst: 3 bursts/s x 3 rounds over 10 s', Math.abs(countTapped(shooter, 10) - 90) <= 3);
  const spinUp = giveFull(shooter, 'hailstorm').primary.spinUp;
  check('spin-up ' + spinUp + ' s then 18 rps', Math.abs(countShots(shooter, BTN.FIRE, 10) - (10 - spinUp) * 18) <= 2);
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
  Actors.buttons[shooter] = BTN.FIRE;
  Sim.step();
  Actors.buttons[shooter] = 0;
  check('the last round starts the reload by itself (R-084)', Weapons.magazine[slot] === 0 && Weapons.state[shooter] === WEAPON_STATE.RELOAD);
  Sim.run(Math.round(wasp.reload * TICK_RATE) - 2);
  check('reload not finished before its time', Weapons.magazine[slot] === 0);
  Sim.run(3);
  check('reload fills the magazine at exactly ' + wasp.reload + ' s', Weapons.magazine[slot] === 30 && Weapons.reserve[slot] === 90, Weapons.magazine[slot]);
  Weapons.magazine[slot] = 0; Weapons.reserve[slot] = 0;
  const empties = TestArena.count('weapon.empty', () => { Actors.buttons[shooter] = BTN.FIRE; Sim.step(); Sim.step(); Actors.buttons[shooter] = 0; Sim.step(); });
  check('fire on empty: one weapon.empty per press, no reload without reserve', empties === 1 && Weapons.state[shooter] === WEAPON_STATE.IDLE, empties);
  Weapons.reserve[slot] = 90;
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
    giveFull(shooter, 'vanguard');
    const points = [];
    const handler = Bus.on('impact', (event) => points.push(event.x.toFixed(5) + ',' + event.y.toFixed(5)));
    World.load({ id: 'wall', brushes: [{ shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] }, { shape: 'box', min: [-20, 0, 30], max: [20, 20, 31] }] });
    Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0.05;
    TestArena.hold(shooter, BTN.FIRE, 30 / 10);
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
  const shooter = TestArena.actor(1, 0, 0), vanguard = giveFull(shooter, 'vanguard');
  const spread = () => Weapons.spreadDegrees(shooter, vanguard, vanguard.primary);
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
  const shooter = TestArena.actor(1, 0, 0), vanguard = giveFull(shooter, 'vanguard'), mode = vanguard.primary;
  const spread = () => Weapons.spreadDegrees(shooter, vanguard, mode);
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
  giveFull(shooter, 'vanguard');
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
  const holdSeconds = mode.trigger === 'charge' ? mode.charge.time + 0.05 : mode.detonateOnRelease ? 0.05 : 1.5;   // W32 mines throw on a tap
  TestArena.hold(shooter, button, holdSeconds);
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
  check('every weapon row (38) fires and its primary and alt behave', failures.length === 0, failures.join('; '));
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
// Stances toggle on ALT.
function checkToggle(shooter, mode) {
  TestArena.hold(shooter, BTN.ALT, 0.05);
  return Weapons.toggled[shooter] === 1 ? '' : 'not toggled';
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
  giveFull(user, 'vanguard');
  TestArena.hold(user, BTN.FIRE, 0.05);
  check('MAP-013 a hitscan shot damages the prop it hits', Props.health[1] < 50, Props.health[1]);
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({ weaponSet: 'tacticalSet' });
  const id = TestArena.actor(1, 0, 0);
  Weapons.setLoadout(id, ['tanto', 'warden']);
  Weapons.give(id, 'vanguard');
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
  Weapons.setLoadout(id, ['vanguard']);
  Game.playerId = id;
  const model = Render.viewModel({});
  check('Render.viewModel describes the held weapon', model.visible && model.shape === 'rifle' && model.swap === 0 && model.reload === 0 && model.ads === 0);
  // The real hook through the 07e pose: an idle weapon sits at its hold pitch, a swap starts lowered and rises.
  const row = viewWeaponModel(model).pose;
  check('an idle view-model weapon is not lowered', Math.abs(poseWeapon(row, model).pitch) < 1e-6, poseWeapon(row, model).pitch);
  Weapons.give(id, 'warden', 0);
  Weapons.requestSwitch(id, CAT.weapons.byId('warden').index);
  Render.viewModel(model);
  const raised = poseWeapon(row, model).pitch;
  Sim.run(Math.ceil(Weapons.stateDuration[id] * SWAP_LOWER_SHARE * TICK_RATE));   // P6-04: the old weapon lowers first, then the new one rises
  Render.viewModel(model);
  const lowered = poseWeapon(viewWeaponModel(model).pose, model).pitch;
  Sim.run(Math.ceil(Weapons.stateDuration[id] * TICK_RATE) + 1);
  Render.viewModel(model);
  check('a swap lowers the old weapon, raises the new one and ends at the hold pose', Math.abs(raised) < 1e-6 && lowered < -0.5 && Math.abs(poseWeapon(row, model).pitch) < 1e-6, [raised, lowered]);
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
  const sidearm = giveFull(id, 'warden'), rifle = CAT.weapons.byId('vanguard');
  Weapons.give(id, 'vanguard', 0);
  Weapons.current[id] = rifle.index;
  check('attachments: unknown keys and melee weapons are refused', !Weapons.attach(id, 'vanguard', 'nothing') && !Weapons.attach(id, 'tanto', 'longBarrel'));
  const base = attachmentStats(id, rifle, sidearm);
  const wrong = CAT.attachments.filter((row) => {
    Weapons.detachAll(id, rifle);
    Weapons.attach(id, 'vanguard', row.id);
    return !statsMatch(attachmentStats(id, rifle, sidearm), base, rifle, row);
  }).map((row) => row.id);
  check('every attachment: stat = base x modifier table', wrong.length === 0, wrong.join(' '));
  Weapons.detachAll(id, rifle);
  ['longBarrel', 'shortBarrel', 'laserSight'].forEach((key) => Weapons.attach(id, 'vanguard', key));
  const stacked = attachmentStats(id, rifle, sidearm).spread;
  check('attachments stack multiplicatively and replace their own slot', Test.near(stacked, base.spread * 1.15 * 0.8, 1e-4), stacked + ' vs ' + base.spread);
  Weapons.detachAll(id, rifle);
  Weapons.statScale[id * WEAPON_STAT_COUNT + STAT.RELOAD] = 0.5;
  check('per-actor stat scale (perks) multiplies too', Test.near(attachmentStats(id, rifle, sidearm).reload, base.reload * 0.5, 1e-4));
  Weapons.statScale[id * WEAPON_STAT_COUNT + STAT.RELOAD] = 1;
  Weapons.attach(id, 'vanguard', 'quickMag');
  Weapons.magazine[Weapons.slotIndex(id, rifle.index)] = rifle.mag;
  Weapons.attach(id, 'vanguard', 'quickMag');
  check('fitting a smaller magazine trims the loaded rounds', Weapons.magazine[Weapons.slotIndex(id, rifle.index)] === Weapons.magSize(id, rifle));
  Weapons.give(id, 'vanguard', 0);
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
  for (let stack = 0; stack < CAT.statusEffects.byId('chill').maxStacks; stack++) Damage.addStatus(fodder, 'chill', shooter, 0, 1);   // the 3 chill stacks of G08 / A-rows
  check('three chill stacks freeze fodder without killing it (no self-shatter)', Actors.alive[fodder] === 1 && Damage.hasStatus(fodder, 'freeze'));
  TestArena.hit(shooter, fodder, 10);
  check('a hit in the same step as the freeze does not shatter (the other pellets of one blast)', Actors.alive[fodder] === 1 && Damage.hasStatus(fodder, 'freeze'));
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
  TestArena.finish();
});

Test.add('weapons', (check) => {
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 10);
  const mode = CAT.weapons.byId('ramjet').alt;
  Weapons.lockIds[id * MAX_LOCKS + 1] = target; Weapons.lockTime[id * MAX_LOCKS + 1] = mode.lock.time;
  check('lock-on hands missiles a lock held in any slot', LockOn.targetFor(id, mode) === target);
  LockOn.clear(id);
  Weapons.setLoadout(id, ['vanguard']);
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
  check('W04 dual pistols fire at twice the rate (tapping every other step nearly reaches it)', Test.near(Weapons.shotInterval(id, warden, warden.primary), 1 / (warden.primary.rate * 2), 1e-9) && dualShots >= warden.primary.rate * 2 * 5 - 3, dualShots);
  Weapons.give(id, 'warden');
  check('W04 a third pickup only adds ammo', Weapons.dual[slot] === 1 && Weapons.magSize(id, warden) === warden.mag * 2);
  TestArena.finish();
});

// Burst triggers (W15, W04 alt) follow the same rate rule as every other trigger: a rate boost shortens pull and gap.
Test.add('weapons', (check) => {
  TestArena.start({});
  const id = TestArena.actor(1, 0, 0);
  TestArena.sponge(2, 0, 20);
  Weapons.setLoadout(id, ['ratchet']);
  const ratchet = CAT.weapons.byId('ratchet'), mode = ratchet.primary;
  Weapons.rateScale[id] = 2;
  Weapons.nextShot[id] = 0;
  Weapons.fire(id, ratchet, mode, 0, 0);
  Weapons.startBurst(id, ratchet, mode, 0);
  check('a rate boost halves the burst pull interval', Test.near(Weapons.nextShot[id], 1 / (mode.rate * 2), 1e-6), Weapons.nextShot[id]);
  check('and the gap between burst rounds', Test.near(Weapons.burstTimer[id], mode.burstGap / 2, 1e-6), Weapons.burstTimer[id]);
  Weapons.rateScale[id] = 1;
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

// R-018 / R-184: a charge or lock-on release always fires what the magazine pays for, or clicks empty and reloads.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 20);
  const accelerator = giveFull(shooter, 'accelerator'), cells = Weapons.slotIndex(shooter, accelerator.index);
  Weapons.magazine[cells] = 5;
  TestArena.aimAt(shooter, target);
  const charged = TestArena.count('weapon.fire', () => { TestArena.hold(shooter, BTN.FIRE, accelerator.primary.charge.time + 0.5); Sim.step(); });
  check('W39 full charge with 5 cells fires the 4-cell level', charged === 1 && Weapons.magazine[cells] === 1 && Actors.health[target] === 100000 - 90, charged + ' / ' + Weapons.magazine[cells] + ' / ' + (100000 - Actors.health[target]));
  const ramjet = giveFull(shooter, 'ramjet'), rockets = Weapons.slotIndex(shooter, ramjet.index);
  Weapons.magazine[rockets] = 1;
  TestArena.aimAt(shooter, target);
  let shots = 0;
  const empties = TestArena.count('weapon.empty', () => { shots = countShots(shooter, BTN.ALT, ramjet.alt.lock.time + 0.2); Sim.step(); });
  check('W31 lock release with 1 rocket clicks empty and reloads', shots === 0 && empties === 1 && Weapons.state[shooter] === WEAPON_STATE.RELOAD, shots + ' / ' + empties + ' / ' + Weapons.state[shooter]);
  const hookjaw = giveFull(shooter, 'hookjaw'), shells = Weapons.slotIndex(shooter, hookjaw.index);
  Weapons.magazine[shells] = 1; Weapons.reserve[shells] = 0;
  Actors.z[target] = 3;
  TestArena.aimAt(shooter, target);
  const single = countShots(shooter, BTN.FIRE, 0.05);
  check('W20 last shell with no reserve fires one barrel', single === 1 && Weapons.magazine[shells] === 0, single + ' / ' + Weapons.magazine[shells]);
  TestArena.finish();
});

// R-019: a held lock-on weapon drops dead targets and locks the next enemy.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), first = [TestArena.actor(2, -0.4, 10), TestArena.actor(2, 0, 10), TestArena.actor(2, 0.4, 10)];
  giveFull(shooter, 'sparklock');
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0;
  Actors.buttons[shooter] = BTN.FIRE;
  Sim.run(TICK_RATE / 4);
  first.forEach((id) => TestArena.hit(-1, id, 1, { kind: 'telefrag' }));
  const fresh = TestArena.sponge(2, 0, 9);
  Sim.run(TICK_RATE * 2);
  Actors.buttons[shooter] = 0;
  check('W07 held through three kills locks and shoots a fresh enemy', Actors.health[fresh] < 100000, 100000 - Actors.health[fresh]);
  TestArena.finish();
});

// R-084 / R-081: an empty magazine reloads by itself, held trigger included; an empty alt pool only clicks.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0);
  TestArena.sponge(2, 0, 20);
  const wasp = CAT.weapons.byId('wasp');
  Weapons.setLoadout(shooter, ['wasp']);
  const slot = Weapons.slotIndex(shooter, wasp.index);
  let emptied = false, refilled = false;
  Actors.buttons[shooter] = BTN.FIRE;
  for (let step = 0; step < 5 * TICK_RATE; step++) {
    Sim.step();
    if (Weapons.magazine[slot] === 0) emptied = true;
    else if (emptied) refilled = true;
  }
  Actors.buttons[shooter] = 0;
  check('Wasp with the trigger held 5 s reloads when the magazine runs dry', emptied && refilled, emptied + ' / ' + refilled);
  const bow = CAT.weapons.byId('talonbow');
  Weapons.setLoadout(shooter, ['talonbow']);
  TestArena.hold(shooter, BTN.FIRE, 0.9);
  Sim.run(TICK_RATE);
  check('Talon Bow nocks the next arrow by itself after a shot', Weapons.magazine[Weapons.slotIndex(shooter, bow.index)] === 1);
  const hush = CAT.weapons.byId('hush');
  Weapons.setLoadout(shooter, ['hush']);
  const darts = Weapons.slotIndex(shooter, hush.index);
  Weapons.altAmmo[darts] = 0; Weapons.magazine[darts] = 5;
  const clicks = TestArena.count('weapon.empty', () => TestArena.hold(shooter, BTN.ALT, 0.05));
  check('Hush alt with no darts clicks empty and does not reload the magazine', clicks === 1 && Weapons.state[shooter] === WEAPON_STATE.IDLE, clicks + ' / ' + Weapons.state[shooter]);
  TestArena.finish();
});

// R-078 / R-079 / R-080: combo ray hits actors in front of the orb, a flare never reveals its shooter, a mine detonation spends no mine.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), front = TestArena.sponge(2, 0, 4);
  giveFull(shooter, 'coilcaster');
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0;
  Actors.y[front] = -10;   // out of the orb's way while it flies
  TestArena.hold(shooter, BTN.ALT, 0.05);
  Sim.run(TICK_RATE);
  const orb = Projectiles.state.indexOf(PROJECTILE_STATE.FLYING);
  Actors.y[front] = 0;
  Projectiles.vx[orb] = Projectiles.vy[orb] = Projectiles.vz[orb] = 0;
  Projectiles.x[orb] = 0; Projectiles.y[orb] = Actors.eyeY(shooter); Projectiles.z[orb] = 11.9;
  Weapons.nextShot[shooter] = 0;
  const combos = TestArena.count('explosion', () => TestArena.hold(shooter, BTN.FIRE, 0.05));
  check('W17 primary hits the enemy in front of the orb, the orb stays', Actors.health[front] < 100000 && combos === 0 && Projectiles.state[orb] === PROJECTILE_STATE.FLYING, (100000 - Actors.health[front]) + ' / ' + combos);
  Projectiles.clear();
  Actors.alive[front] = 0;
  const pitcher = giveFull(shooter, 'pitcher'), mines = Weapons.slotIndex(shooter, pitcher.index);
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = -0.3;
  Weapons.magazine[mines] = 6;
  for (let k = 0; k < 2; k++) { TestArena.hold(shooter, BTN.ALT, 0.05); Sim.run(TICK_RATE); }
  const thrown = Projectiles.countOwned(shooter, pitcher.index);
  const blasts = TestArena.count('explosion', () => { TestArena.hold(shooter, BTN.ALT, 0.5); Sim.run(2); });
  check('W32 taps throw mines; a long hold detonates them and throws none', thrown === 2 && blasts === 2 && Weapons.magazine[mines] === 4, thrown + ' / ' + blasts + ' / ' + Weapons.magazine[mines]);
  TestArena.finish();
});

// R-082 / R-083: the W03 block covers its row's arcDeg; attachments never make a swap faster than the WPN-010 floor.
Test.add('weapons', (check) => {
  TestArena.start({});
  const guard = TestArena.actor(1, 0, 0), attacker = TestArena.actor(2, 0, 5, Math.PI);
  Weapons.setLoadout(guard, ['bulwark']);
  Actors.buttons[guard] = BTN.ALT;
  Sim.run(3);
  const angle = 65 * DEG, side = { dx: -Math.sin(angle), dy: 0, dz: -Math.cos(angle) };
  check('W03 a hit 65 deg off the 120 deg guard is not blocked', TestArena.hit(attacker, guard, 40, side) === 40);
  Actors.buttons[guard] = 0;
  Weapons.setLoadout(guard, ['maul', 'vanguard']);
  Weapons.attach(guard, 'vanguard', 'shortBarrel');
  Weapons.attach(guard, 'vanguard', 'lightStock');
  Weapons.current[guard] = CAT.weapons.byId('maul').index;
  const vanguard = CAT.weapons.byId('vanguard');
  Weapons.requestSwitch(guard, vanguard.index);
  check('WPN-010 stacked equip attachments stop at the floor', Weapons.stateDuration[guard] >= vanguard.equipTime * EQUIP_SCALE_FLOOR - 1e-6, Weapons.stateDuration[guard]);
  TestArena.finish();
});

// R-186: W36 stored heat vents once the shooter stops firing, so the heat blast is earned right before it is used.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0);
  TestArena.sponge(2, 0, 20);
  giveFull(shooter, 'ember');
  TestArena.hold(shooter, BTN.FIRE, 3);
  const stored = Weapons.heat[shooter];
  Sim.run(TICK_RATE * 15);
  check('W36 heat builds while firing and vents to 0 when idle', stored >= 100 && Weapons.heat[shooter] === 0, stored + ' -> ' + Weapons.heat[shooter]);
  TestArena.finish();
});

// Balance pass: each gun keeps a reason to pick it (the R-086, R-091 and R-095 notes hold, and prices follow strength).
Test.add('weapons', (check) => {
  const weapon = (key) => CAT.weapons.byId(key);
  const hailstorm = weapon('hailstorm').primary, warden = weapon('warden'), ramjet = weapon('ramjet').primary;
  check('R-091 the Hailstorm keeps the heavy penetration of the merged Anvil (P3-03)', hailstorm.penetration === 'high' && hailstorm.damage * hailstorm.rate >= 250);
  check('R-095 the Warden burst kills faster up close than the semi', timeToKill(warden.alt) < timeToKill(warden.primary), timeToKill(warden.alt) + ' / ' + timeToKill(warden.primary));
  check('R-086 one rocket never kills 100 HP, two kill 100 HP + 50 armor', ramjet.damage < BASE_HEALTH && ramjet.damage + ramjet.splash.dmg >= BASE_HEALTH * 1.5);
  check('the Vanguard needs a fourth shot at 60 m (falloff), three up close', shotsToKill(weapon('vanguard').primary, 0) === 3 && shotsToKill(weapon('vanguard').primary, 60) === 4);
  check('P3-03 the Wasp takes the hollow-point toggle of the merged Riptide, the Kestrel the 15-round magazine of the Longshot', weapon('wasp').alt.type === 'toggle' && weapon('wasp').alt.toggle.status.id === 'slow' && weapon('kestrel').mag === 15);
  const moraine = CAT.heroes.byId('moraine'), quillGun = weapon(CAT.heroes.byId('quill').weapons[0]).primary;
  const bastide = CAT.heroes.byId('bastide'), quillDps = quillGun.damage * quillGun.rate;
  check('H02 Moraine (the Hailstorm carries her) falls to the Quill Vanguard in under 1.2 s', (moraine.health + moraine.shield) / quillDps < 1.2);
  check('H01 Bastide (slow, short-range kit) holds out against the Quill Vanguard for over 1.9 s', (bastide.health + bastide.armor) / quillDps > 1.9);
});

// D-F01: the W40 Detonate alt works while the single round reloads (default loadout: 1 round, 1 in reserve).
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0);
  Weapons.setLoadout(shooter, ['fusionmortar']);
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0.3;
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  Sim.run(TICK_RATE / 4);
  check('W40 the single round starts the reload at once', Weapons.state[shooter] === WEAPON_STATE.RELOAD);
  const blasts = TestArena.count('explosion', () => { TestArena.hold(shooter, BTN.ALT, 0.05); Sim.run(TICK_RATE * 2); });
  check('W40 Alt detonates the orb during the reload, once (the fuse finds nothing left)', blasts === 1, blasts);
  Weapons.setLoadout(shooter, ['fusionmortar']);
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  Sim.run(TICK_RATE / 4);
  const fuse = TestArena.count('explosion', () => Sim.run(TICK_RATE * 3));
  check('W40 without Alt the orb still blows by its fuse', fuse === 1, fuse);
  TestArena.finish();
});

// D-F02 (MOV-021): a trigger pressed during the sprint-to-fire wait is kept and answered the moment the wait ends. A one-step
// tap is never lost, the sprint key held down does not put the actor back into the sprint before that shot, and a trigger that
// is still held needs no buffer. Primary and alt shots both buffer.
Test.add('weapons', (check) => {
  loadTestWorld();
  useTestRules({ move: 'modern', weaponSet: 'fullSet' });
  const id = groundedTester(-55, -55), wait = Move.preset(id).sprintToFire + CAT.weapons.byId('warden').readyTime;
  giveFull(id, 'warden');
  holdInput(id, 0, 1, BTN.SPRINT, 45);
  stepSeconds(1);
  check('D-F02 the actor sprints before the tap', Motion.sprinting[id] === 1);
  let shots = 0;
  const handler = Bus.on('weapon.fire', () => { shots++; });
  holdInput(id, 0, 1, BTN.SPRINT | BTN.FIRE);
  Sim.step();
  holdInput(id, 0, 1, BTN.SPRINT);
  stepSeconds(wait - 0.1);
  check('D-F02 a one-step tap makes no shot inside the wait, and the held sprint key does not restart the sprint', shots === 0 && Motion.sprinting[id] === 0 && Move.fireWait(id) > 0, shots + ' / ' + Motion.sprinting[id]);
  stepSeconds(0.2);
  check('D-F02 the buffered tap fires the moment the wait ends (one shot)', shots === 1, shots);
  stepSeconds(0.5);
  check('D-F02 the sprint resumes after the shot, no second shot', shots === 1 && Motion.sprinting[id] === 1, shots + ' / ' + Motion.sprinting[id]);
  holdInput(id, 0, 1, BTN.SPRINT | BTN.FIRE);
  Sim.step();
  holdInput(id, 0, 1, BTN.SPRINT);
  stepSeconds(wait + PRESS_BUFFER_GRACE + 0.2);
  check('D-F02 a second tap is answered by one more shot, no stray shot long after', shots === 2, shots);
  Bus.off('weapon.fire', handler);
  const dull = giveFull(id, 'vanguard');
  const heldShots = TestArena.count('weapon.fire', () => {
    holdInput(id, 0, 1, BTN.SPRINT | BTN.FIRE);
    stepSeconds(0.05);
    holdInput(id, 0, 1, BTN.SPRINT | BTN.FIRE);
    stepSeconds(wait + 0.1);
    holdInput(id, 0, 0, 0);
  });
  check('D-F02 a trigger held through the wait still fires by itself (auto)', heldShots >= 1 && Weapons.magazine[Weapons.slotIndex(id, dull.index)] === 30000 - heldShots * dull.primary.ammoPerShot, heldShots);
});

// D-F02: the buffer also holds for an alt that shoots, and a weapon swap drops it.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 10);
  giveFull(shooter, 'hornet');
  TestArena.aimAt(shooter, target);
  setClock(shooter, CLOCK.FIRE_DELAY, 0.3);
  let shots = 0;
  const handler = Bus.on('weapon.fire', (event) => { if (event.mode === 'alt') shots++; });
  Actors.buttons[shooter] = BTN.ALT; Sim.step(); Actors.buttons[shooter] = 0;
  Sim.run(TICK_RATE * 0.5);
  check('D-F02 an alt shot pressed in the wait fires when it ends', shots === 1, shots);
  setClock(shooter, CLOCK.FIRE_DELAY, 0.3);
  Weapons.nextShot[shooter] = 0; Weapons.nextAlt[shooter] = 0;
  Actors.buttons[shooter] = BTN.FIRE; Sim.step(); Actors.buttons[shooter] = 0;
  check('D-F02 the press is pending and holds the sprint off', Weapons.pressBuffer[shooter] !== 0 && Move.firePending[shooter] === 1);
  Weapons.give(shooter, 'vanguard');
  Weapons.requestSwitch(shooter, CAT.weapons.byId('vanguard').index);
  check('D-F02 a weapon switch drops the pending press', Weapons.pressBuffer[shooter] === 0 && Move.firePending[shooter] === 0);
  Bus.off('weapon.fire', handler);
  TestArena.finish();
});

// D-F03: a primary with no round and nothing to reload clicks, tells the local player, and moves on to the next weapon that can
// shoot; the Alt keeps its own pool. A weapon alone only clicks and toasts.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 8);
  Game.playerId = shooter;
  Weapons.setLoadout(shooter, ['warden', 'hush']);
  const hush = CAT.weapons.byId('hush'), warden = CAT.weapons.byId('warden'), slot = Weapons.slotIndex(shooter, hush.index);
  Weapons.magazine[slot] = 0; Weapons.reserve[slot] = 0;
  TestArena.aimAt(shooter, target);
  let empty = null;
  const handler = Bus.on('weapon.empty', (event) => { empty = { pool: event.pool, dry: event.dry }; });
  const clicks = TestArena.count('weapon.empty', () => TestArena.hold(shooter, BTN.FIRE, 0.05));
  check('D-F03 W06 with nothing left clicks once and reports it dry', clicks === 1 && empty && empty.pool === 'mag' && empty.dry === true, clicks + ' ' + JSON.stringify(empty));
  check('D-F03 the press moves on to the next weapon with ammo', Weapons.state[shooter] === WEAPON_STATE.SWAP && Weapons.pending[shooter] === warden.index && Ui.lastToast === 'Out of ammo: ' + warden.name, Ui.lastToast);
  Sim.run(TICK_RATE);
  check('D-F03 and holds it when the swap is done', Weapons.current[shooter] === warden.index && Weapons.state[shooter] === WEAPON_STATE.IDLE);
  Weapons.requestSwitch(shooter, hush.index);
  Sim.run(TICK_RATE);
  check('D-F03 the empty weapon stays selectable; its Alt keeps its own pool and still fires', Weapons.current[shooter] === hush.index && countShots(shooter, BTN.ALT, 0.3) > 0);
  Weapons.setLoadout(shooter, ['hush']);
  Weapons.magazine[slot] = 0; Weapons.reserve[slot] = 0;
  Ui.lastToast = '';
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  Sim.run(TICK_RATE / 4);
  check('D-F03 a lone empty weapon stays in hand and says so', Weapons.current[shooter] === hush.index && Weapons.state[shooter] === WEAPON_STATE.IDLE && Ui.lastToast === 'Out of ammo', Ui.lastToast);
  Weapons.altAmmo[slot] = 0;
  TestArena.hold(shooter, BTN.ALT, 0.05);
  check('D-F03 an empty Alt pool says so too', Ui.lastToast === 'Alt: no ammo', Ui.lastToast);
  Weapons.setLoadout(shooter, ['warden', 'hush']);
  Weapons.reserve[slot] = 5; Weapons.magazine[slot] = 0;
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  check('D-F03 with reserve left the weapon reloads instead of switching', Weapons.state[shooter] === WEAPON_STATE.RELOAD, Weapons.state[shooter]);
  Bus.off('weapon.empty', handler);
  TestArena.finish();
});

// Review fixes: a dry tap buffered during the sprint-to-fire wait clicks once; a downed Last Stand pistol never auto-switches;
// W07 held through kills says "No target" only after a real gap, and a bot stays silent.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0), target = TestArena.sponge(2, 0, 8);
  Game.playerId = shooter;
  Weapons.setLoadout(shooter, ['warden', 'hush']);
  const hush = CAT.weapons.byId('hush'), slot = Weapons.slotIndex(shooter, hush.index);
  Weapons.magazine[slot] = 0; Weapons.reserve[slot] = 0;
  TestArena.aimAt(shooter, target);
  setClock(shooter, CLOCK.FIRE_DELAY, 0.2);
  const clicks = TestArena.count('weapon.empty', () => { Actors.buttons[shooter] = BTN.FIRE; Sim.step(); Actors.buttons[shooter] = 0; Sim.run(TICK_RATE); });
  check('a dry tap buffered during the sprint-to-fire wait clicks once when the wait ends', clicks === 1, clicks);
  Weapons.setLoadout(shooter, ['warden', 'hush']);
  Weapons.magazine[slot] = 0; Weapons.reserve[slot] = 0;
  Actors.flags[shooter] |= ACTOR_FLAG.DOWNED;
  Damage.lastStand[shooter] = 1;
  TestArena.hold(shooter, BTN.FIRE, 0.05);
  Sim.step();
  check('a downed actor with a dry Last Stand pistol does not switch weapons', Weapons.state[shooter] !== WEAPON_STATE.SWAP && Weapons.current[shooter] === hush.index);
  Actors.flags[shooter] &= ~ACTOR_FLAG.DOWNED; Damage.lastStand[shooter] = 0;
  TestArena.finish();

  TestArena.start({});
  const me = TestArena.actor(1, 0, 0), bot = TestArena.actor(1, 3, 0);
  Game.playerId = me;
  const sparklock = CAT.weapons.byId('sparklock'), lockTime = sparklock.primary.lock.time;
  giveFull(bot, 'sparklock'); giveFull(me, 'sparklock');
  Actors.pitch[bot] = Actors.aimPitch[bot] = 0; Actors.pitch[me] = Actors.aimPitch[me] = 0;
  const cues = TestArena.count('weapon.nolock', () => { Actors.buttons[bot] = BTN.FIRE; TestArena.hold(me, BTN.FIRE, lockTime + 0.3); Actors.buttons[bot] = 0; Sim.step(); });
  check('a bot holding a lock-on trigger on nothing makes no cue; the local player does', cues === 1, cues);
  const foe = TestArena.sponge(2, 0, 10);
  TestArena.aimAt(me, foe);
  const afterKill = TestArena.count('weapon.nolock', () => {
    Actors.buttons[me] = BTN.FIRE;
    Sim.run(Math.round(TICK_RATE * (lockTime + 0.3)));
    TestArena.hit(-1, foe, 1e6, { kind: 'telefrag' });
    Sim.run(Math.round(TICK_RATE * 0.2));
    Actors.buttons[me] = 0; Sim.step();
  });
  check('W07 held through a kill says nothing in the first moments after it (the wait restarts)', afterKill === 0, afterKill);
  TestArena.finish();
});

// D-F04: lock-on weapons say so when nothing can be locked: a 'weapon.nolock' event (the empty click) and a "No target" toast
// once per hold; W31 (lock on release, the alt) also cues a tap. With a target in the cone there is no cue.
Test.add('weapons', (check) => {
  TestArena.start({});
  const shooter = TestArena.actor(1, 0, 0);
  Game.playerId = shooter;
  const sparklock = giveFull(shooter, 'sparklock');
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0;
  Ui.lastToast = '';
  const cues = TestArena.count('weapon.nolock', () => TestArena.hold(shooter, BTN.FIRE, sparklock.primary.lock.time + 0.5));
  check('D-F04 W07 held with no target cues once (event and toast)', cues === 1 && Ui.lastToast === 'No target', cues + ' / ' + Ui.lastToast);
  const tapped = TestArena.count('weapon.nolock', () => TestArena.hold(shooter, BTN.FIRE, 0.1));
  check('D-F04 a short tap on W07 stays quiet (no lock time elapsed)', tapped === 0, tapped);
  const target = TestArena.sponge(2, 0, 10);
  TestArena.aimAt(shooter, target);
  const withTarget = TestArena.count('weapon.nolock', () => TestArena.hold(shooter, BTN.FIRE, sparklock.primary.lock.time + 0.5));
  check('D-F04 W07 with an enemy in the cone gives no cue', withTarget === 0, withTarget);
  Actors.y[target] = -20;
  giveFull(shooter, 'ramjet');
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = 0;
  Ui.lastToast = '';
  const volley = TestArena.count('weapon.nolock', () => { TestArena.hold(shooter, BTN.ALT, 0.1); Sim.step(); });
  check('D-F04 W31 tapped with nothing to lock cues on release', volley === 1 && Ui.lastToast === 'No target', volley + ' / ' + Ui.lastToast);
  const long = TestArena.count('weapon.nolock', () => { TestArena.hold(shooter, BTN.ALT, CAT.weapons.byId('ramjet').alt.lock.time + 0.3); Sim.step(); });
  check('D-F04 W31 held long enough cues once, not again on release', long === 1, long);
  TestArena.finish();
});

DebugApi.giveWeapon =(id, key) => Weapons.give(id, key, 0);
DebugApi.weapons = Weapons;
DebugApi.damage = Damage;
