// Self-tests for S13 mutators X01..X50: the catalogue, what each one changes in the built ruleset, typed values, the conflict table
// (every pair), random combinations, and the runtime effects in a running match (dummies in a flat test map).

DebugApi.mutators = Mutators;   // ARC-040: __CTK.mutators

const MUTATOR_CODES = Array.from({ length: 50 }, (unused, index) => 'X' + String(index + 1).padStart(2, '0'));
const MUTATOR_RANDOM_COMBOS = 200;
const MUTATOR_TEST_SPAWNS = [{ x: -40, y: 0, z: -40 }, { x: 40, y: 0, z: 40 }, { x: -40, y: 0, z: 40 }, { x: 40, y: 0, z: -40 }];

function buildWith(id, value, extraSetup) {
  return Rules.build(Object.assign({ mode: 'ffa', mutators: [{ id, value: value === undefined ? true : value }] }, extraSetup || {}));
}

// id: [value (undefined = the default), check(rules, base)] - the field change each mutator's spec row promises.
const MUTATOR_EXPECTATIONS = {
  gravity: [undefined, (r) => r.gravityScale === 0.5],
  gamespeed: [undefined, (r) => r.fx.timeScale === 1.25],
  playerspeed: [undefined, (r) => r.moveOverrides.groundSpeed === 13.5 && r.moveOverrides.airWishCap === 13.5 && r.moveOverrides.sprintSpeed === undefined],
  dmgout: [undefined, (r) => r.fx.damageOut === 2],
  dmgin: [undefined, (r) => r.fx.damageIn === 0.5],
  health: [undefined, (r) => r.fx.health === 200],
  shields: [undefined, (r) => r.fx.shields === 150],
  oneshot: [undefined, (r) => r.weaponSet === 'matchSet' && r.fx.weaponList.join() === 'lancet' && r.fx.infiniteAmmo && r.fx.oneHit && r.fx.noItems && r.fx.noPowerups && r.items === false],
  rocketpit: [undefined, (r) => r.weaponSet === 'matchSet' && r.fx.weaponList.join() === 'ramjet' && r.fx.infiniteAmmo && r.items === false],
  weaponset: ['knightSet', (r) => r.weaponSet === 'knightSet'],
  weaponstay: [undefined, (r) => r.weaponStay === true],
  dropall: [undefined, (r) => r.dropOnDeath === 'all'],
  vampire: [undefined, (r) => r.fx.lifesteal === 0.5],
  bighead: [undefined, (r) => r.fx.headScale === 2.5],
  infammo: [undefined, (r) => r.fx.infiniteAmmo === true],
  nopowerups: [undefined, (r) => r.fx.noPowerups === true],
  superpowerups: [undefined, (r) => r.fx.superPowerups === 60],
  regen: [undefined, (r) => r.fx.regen === 5],
  noself: [undefined, (r) => r.selfDamage === 0 && r.knockback === 1],
  freejump: [undefined, (r) => r.selfDamage === 0 && r.fx.noFallDamage === true],
  ff: [undefined, (r) => r.friendlyFire === 0.5],
  handicap: [undefined, (r) => r.fx.handicap === true && r.handicap.player === 0.5],
  knockback: [undefined, (r) => r.knockback === 2],
  aircontrol: [undefined, (r) => r.fx.airControl === true],
  autohop: [undefined, (r) => r.fx.autoHop === true],
  multijump: [undefined, (r) => r.moveOverrides.extraJumps === 2 && r.moveOverrides.extraJumpVel === 6],
  slowmokills: [undefined, (r) => r.fx.slowmoKills === true],
  headonly: [undefined, (r) => r.fx.headOnly === true],
  lastgift: [undefined, (r) => r.fx.lastGift === true],
  volatile: [undefined, (r) => r.fx.volatileAmmo === true],
  colossal: [undefined, (r) => r.fx.growth === true],
  lives: [undefined, (r) => r.lives === 3],
  respawn: [undefined, (r) => r.respawn.delay === 5 && r.respawn.wave === 0 && r.respawn.forced === 10],
  protect: [undefined, (r) => r.respawn.protect === 3],
  radar: [undefined, (r) => r.fx.radar.mode === 'team' && r.fx.radar.range === 25],
  hardcore: [undefined, (r) => r.friendlyFire === 1 && r.fx.noHud === true && r.fx.healthScale === 0.3],
  darkness: [undefined, (r) => r.fx.darkness === true],
  airborne: [undefined, (r) => r.fx.airborneOnly === true],
  shrinkhit: [undefined, (r) => r.fx.shrinkHit === true],
  mirror: [undefined, (r) => r.fx.mirror === true],
  ballistics: [undefined, (r) => r.fx.ballistics.gravity === 9.8 && r.fx.ballistics.drag > 0],
  tags: [undefined, (r) => r.fx.tags === true && r.scoring.kill === 0 && r.scoring.tag === 1],
  adrenaline: [undefined, (r) => r.meter === 'adrenaline'],
  suppression: [undefined, (r) => r.fx.suppression === true],
  itemfrenzy: [undefined, (r) => r.itemRespawnScale === 0.25],
  powers: [undefined, (r) => r.fx.powers === true],
  triangle: [undefined, (r) => r.fx.triangle === true],
  cards: [undefined, (r) => r.fx.cards === true],
  limbs: [undefined, (r) => r.health === 'limb'],
  wildlife: [undefined, (r) => r.fx.wildlife === 4],
};

Test.add('mutators', (check) => {
  check('50 mutators X01..X50 in order', CAT.mutators.length === 50 && CAT.mutators.every((row, index) => row.code === MUTATOR_CODES[index]));
  check('mutator catalogue validates against its schema', Data.validate('mutators').length === 0, Data.validate('mutators').join('; '));
  const operations = Object.keys(MUTATOR_OPERATIONS);
  const rowProblems = [];
  for (const row of CAT.mutators) {
    for (const operation of row.set) if (!operations.includes(operation.op)) rowProblems.push(row.id + ': unknown operation ' + operation.op);
    for (const other of row.conflicts) if (!CAT.mutators.byId(other)) rowProblems.push(row.id + ': conflict names unknown ' + other);
    for (const param of row.params) if (param.kind === 'range' && !(param.min < param.max && param.default >= param.min && param.default <= param.max)) rowProblems.push(row.id + ': bad range');
    if (!MUTATOR_EXPECTATIONS[row.id]) rowProblems.push(row.id + ': no test expectation');
  }
  check('every row uses known operations, real conflicts, sane ranges and has a test', rowProblems.length === 0, rowProblems.join('; '));
  check('rules.fx exists on every build (even without mutators)', Rules.build({ mode: 'ffa' }).fx && Object.keys(Rules.build({ mode: 'ffa' }).fx).length === 0);
});

Test.add('mutators', (check) => {
  const base = Rules.build({ mode: 'ffa' });
  for (const row of CAT.mutators) {
    const [value, applied] = MUTATOR_EXPECTATIONS[row.id];
    const rules = buildWith(row.id, value);
    check(row.code + ' ' + row.id + ' applies as specified', applied(rules, base) && Rules.problems.length === 0, JSON.stringify(rules.fx) + ' / ' + Rules.problems.join('; '));
    check(row.code + ' ' + row.id + ' is listed in the built ruleset', rules.mutators.length === 1 && rules.mutators[0].id === row.id);
  }
  check('the mutator stage runs between the bundle and the difficulty stage', Rules.stagesRun.indexOf('mutators') === Rules.stagesRun.indexOf('bundle') + 1);
  const bundle = Rules.build({ mode: 'ffa', ruleset: { name: 'Bundle with mutators', mutators: [{ id: 'gravity', value: 100 }] }, mutators: ['dmgout'] });
  check('bundle mutators and setup mutators both apply', bundle.mutators.map((entry) => entry.id).join() === 'gravity,dmgout' && bundle.gravityScale === 1 && bundle.fx.damageOut === 2);
});

Test.add('mutators', (check) => {
  const gravity = CAT.mutators.byId('gravity');
  check('range values clamp to the row and snap to the step', Mutators.coerce(gravity, 10) === 25 && Mutators.coerce(gravity, 1000) === 300 && Mutators.coerce(gravity, 52) === 50 && Mutators.coerce(gravity, 'x') === undefined);
  check('true means the default value; false means not chosen', Mutators.coerce(gravity, true) === 50 && Mutators.coerce(gravity, false) === undefined);
  check('a rules build clamps an out-of-range value', buildWith('gravity', 5000).gravityScale === 3);
  const dropall = CAT.mutators.byId('dropall');
  check('choice values must be one of the options', Mutators.coerce(dropall, 'none') === 'none' && Mutators.coerce(dropall, 'bogus') === undefined);
  const respawn = CAT.mutators.byId('respawn');
  const wave = Mutators.coerce(respawn, { delay: 99, wave: 12 });
  check('several params give an object value with defaults for missing keys', wave.delay === 15 && wave.wave === 10 && Mutators.coerce(respawn, { delay: 4 }).wave === 0);
  check('a respawn delay above the forced time raises the forced time', buildWith('respawn', { delay: 12, wave: 0 }).respawn.forced === 17);
  const weaponset = CAT.mutators.byId('weaponset');
  check('a weapon set value can be a set id, random or a list of weapons', Mutators.coerce(weaponset, 'random') === 'random' && Mutators.coerce(weaponset, ['maul', 'warden']).length === 2
    && Mutators.coerce(weaponset, ['nonsense']) === undefined && Mutators.coerce(weaponset, []) === undefined && Mutators.coerce(weaponset, 'matchSet') === undefined);
  const listed = buildWith('weaponset', ['maul', 'lancet']);
  check('a weapon list arms the match set', listed.weaponSet === 'matchSet' && listed.fx.weaponList.join() === 'maul,lancet');
  const random = buildWith('weaponset', 'random');
  check('random weapon set picks a real set from the seeded rules stream', CAT.weaponSets.byId(random.weaponSet) && random.weaponSet !== 'matchSet');
  check('describe() reads well', Mutators.describe({ id: 'gravity', value: 50 }) === 'Gravity 50%' && Mutators.describe({ id: 'oneshot', value: true }) === 'One-Shot'
    && Mutators.describe({ id: 'dropall', value: 'none' }) === 'Drop on Death Nothing');
  const unknown = Test.expectErrors(() => Rules.build({ mode: 'ffa', mutators: ['nonsense', 'gravity'] }));
  check('an unknown mutator id is reported and skipped', unknown === 1 && Rules.build({ mode: 'ffa', mutators: ['gravity'] }).mutators.length === 1);
  check('the same mutator chosen twice keeps the last value', Rules.build({ mode: 'ffa', mutators: [{ id: 'gravity', value: 100 }, { id: 'gravity', value: 25 }] }).gravityScale === 0.25);
  check('a mutator set to false is removed', Mutators.resolve([{ id: 'gravity', value: 100 }, { id: 'gravity', value: false }]).list.length === 0);
});

Test.add('mutators', (check) => {
  // Every pair either stacks or is refused with a message naming both (MUT-002: the later choice wins).
  const ids = CAT.mutators.map((row) => row.id);
  let pairs = 0, refused = 0, bad = [];
  for (let first = 0; first < ids.length; first++) {
    for (let second = first + 1; second < ids.length; second++) {
      pairs++;
      const result = Mutators.add([{ id: ids[first], value: Mutators.defaultValue(CAT.mutators.byId(ids[first])) }], ids[second], true);
      const built = Rules.build({ mode: 'ffa', mutators: [ids[first], ids[second]] });
      const conflict = Mutators.conflicts(ids[first], ids[second]);
      if (Mutators.conflicts(ids[second], ids[first]) !== conflict) bad.push('asymmetric ' + ids[first] + '/' + ids[second]);
      if (!conflict && !(result.list.length === 2 && result.message === '' && built.mutators.length === 2)) bad.push('stack ' + ids[first] + '/' + ids[second]);
      if (conflict) refused++;
      const named = conflict && result.message.includes(CAT.mutators.byId(ids[first]).name) && result.message.includes(CAT.mutators.byId(ids[second]).name);
      if (conflict && !(named && result.list.length === 1 && result.list[0].id === ids[second] && built.mutators.length === 1)) bad.push('refuse ' + ids[first] + '/' + ids[second]);
      if (Rules.problems.length) bad.push('problems ' + ids[first] + '/' + ids[second] + ' ' + Rules.problems[0]);
    }
  }
  check('all 1225 pairs were checked', pairs === 1225, pairs);
  check('every pair stacks or is refused with a message; refusals are symmetric', bad.length === 0, bad.slice(0, 5).join('; '));
  check('the conflict table is not empty', refused >= 10 && refused < 80, refused);
  const toasts = [];
  const listener = Bus.on('toast', (payload) => toasts.push(payload.text));
  Rules.build({ mode: 'ffa', mutators: ['oneshot', 'rocketpit'] });
  Bus.off('toast', listener);
  check('a refused combination in a build shows a toast and keeps the last choice', toasts.length === 1 && toasts[0].includes('One-Shot') && Mutators.isActive('oneshot') === false);
});

Test.add('mutators', (check) => {
  const random = makeRandom(12345);
  let failures = 0, problems = '';
  for (let run = 0; run < MUTATOR_RANDOM_COMBOS; run++) {
    const picks = [];
    while (picks.length < 3) {
      const row = random.pick(CAT.mutators);
      const rawOf = (param) => (param.kind === 'range' ? random.range(param.min, param.max) : random.pick(Mutators.optionsOf(param)));
      const raw = row.params.length === 1 ? rawOf(row.params[0]) : Object.fromEntries(row.params.map((param) => [param.key, rawOf(param)]));
      picks.push({ id: row.id, value: row.params.length ? raw : true });
    }
    const errorsBefore = ErrorLog.entries.length;
    const rules = Rules.build({ mode: random.pick(['ffa', 'tdm', 'ctf', 'bomb', 'lms']), mutators: picks });
    const complete = rules.mutators.length >= 1 && rules.mutators.length <= 3 && Object.isFrozen(rules.fx);
    if (!complete || Rules.problems.length || ErrorLog.entries.length > errorsBefore) { failures++; problems = JSON.stringify(picks) + Rules.problems.join(';'); }
  }
  check(MUTATOR_RANDOM_COMBOS + ' random 3-mutator combinations build without errors', failures === 0, problems);
});

// ---- Runtime effects ----
function startMutatorMatch(mutators, setup) {
  World.load({ id: 'mutator-test', brushes: [TEST_FLOOR], spawns: MUTATOR_TEST_SPAWNS, objectives: [] });
  Game.start(Object.assign({ mode: 'ffa', seed: 1, bots: [{ dummy: true }, { dummy: true }, { dummy: true }], mutators }, setup || {}));
  for (let id = 0; id < Actors.count; id++) {
    Actors.flags[id] = (Actors.flags[id] & ~ACTOR_FLAG.PROTECTED) | ACTOR_FLAG.ON_GROUND;
    Actors.x[id] = id * 10; Actors.z[id] = 0; Actors.y[id] = 0;
  }
  return Game.match;
}
function stopMutatorMatch() { Game.playerId = -1; Game.stop(); World.clear(); }
function strike(source, target, amount, extra) {
  const info = Damage.info();
  info.amount = amount;
  info.kind = 'hit';
  Object.assign(info, extra || {});
  return Damage.apply(source, target, info);
}
function healthOf(id) { return Actors.health[id] + Actors.armor[id] + Actors.shield[id]; }

Test.add('mutators', (check) => {
  startMutatorMatch([{ id: 'dmgout', value: 200 }, { id: 'dmgin', value: 50 }]);
  const before = healthOf(1);
  strike(0, 1, 20);
  check('damage dealt x2 and damage taken x0.5 stack (20 becomes 20)', Math.abs(before - healthOf(1) - 20) < 0.01, before - healthOf(1));
  const selfBefore = healthOf(0);
  strike(-1, 0, 20, { kind: 'hazard' });
  check('damage taken also scales environment damage', Math.abs(selfBefore - healthOf(0) - 10) < 0.01, selfBefore - healthOf(0));
  stopMutatorMatch();

  startMutatorMatch(['headonly']);
  const body = strike(0, 1, 30, { zone: 'body' }), head = strike(0, 1, 30, { zone: 'head' });
  check('headshots only: a body hit does nothing, a head hit hurts', body === 0 && head > 0, body + ' ' + head);
  stopMutatorMatch();

  startMutatorMatch(['airborne']);
  const grounded = strike(0, 1, 30);
  Actors.flags[1] &= ~ACTOR_FLAG.ON_GROUND;
  const airborne = strike(0, 1, 30);
  check('sky duel: only airborne targets take damage', grounded === 0 && airborne > 0, grounded + ' ' + airborne);
  stopMutatorMatch();

  startMutatorMatch(['oneshot']);
  strike(0, 1, 10);
  check('one-shot: a 10 damage hit kills', Actors.alive[1] === 0);
  stopMutatorMatch();

  startMutatorMatch(['freejump']);
  const fall = strike(-1, 0, 30, { kind: 'fall' });
  check('free weapon jumps: fall damage is cancelled', fall === 0, fall);
  stopMutatorMatch();

  const match = startMutatorMatch([{ id: 'handicap', value: 50 }]);
  match.handicap[0] = 0.5;
  const dealt = strike(0, 1, 40);
  check('handicap: damage dealt follows the per-actor factor', Math.abs(dealt - 20) < 0.01, dealt);
  stopMutatorMatch();
});

Test.add('mutators', (check) => {
  startMutatorMatch([{ id: 'health', value: 200 }, { id: 'shields', value: 100 }]);
  check('health mutator sets the start and maximum health', Actors.health[0] === 200 && Actors.maxHealth[0] === 200);
  check('shields mutator gives the default pool when the preset has none', Actors.shield[0] === 50 && Actors.maxShield[0] === 50);
  stopMutatorMatch();
  startMutatorMatch([{ id: 'shields', value: 0 }], { ruleset: 'vanguard' });
  check('shields off removes the preset shield', Actors.shield[0] === 0 && Actors.maxShield[0] === 0);
  stopMutatorMatch();
  startMutatorMatch(['hardcore']);
  check('hardcore leaves 30% health', Math.abs(Actors.health[0] - 30) < 0.01 && Math.abs(Actors.maxHealth[0] - 30) < 0.01 && Game.match.rules.friendlyFire === 1);
  stopMutatorMatch();
  startMutatorMatch([{ id: 'regen', value: 10 }]);
  Actors.health[1] = 50;
  Sim.run(TICK_RATE);
  check('regeneration adds the rate per second', Math.abs(Actors.health[1] - 60) < 0.2, Actors.health[1]);
  stopMutatorMatch();
  startMutatorMatch([{ id: 'vampire', value: 50 }]);
  Actors.health[0] = 40;
  const dealt = strike(0, 1, 30);
  check('vampire heals the attacker for the share of the damage dealt', Math.abs(Actors.health[0] - (40 + dealt * 0.5)) < 0.01, Actors.health[0] + ' ' + dealt);
  stopMutatorMatch();
});

Test.add('mutators', (check) => {
  startMutatorMatch(['colossal']);
  strike(0, 1, 100000);
  check('growth: a kill adds 5% health and size', Actors.alive[1] === 0 && Mutators.growth[0] === 1 && Math.abs(Hitbox.sizeScale[0] - 1.05) < 1e-4 && Math.abs(Actors.maxHealth[0] - 105) < 0.01, Actors.maxHealth[0]);
  for (let kill = 0; kill < 14; kill++) { Mutators.growth[0] = Math.min(Mutators.growth[0], GROWTH_MAX_KILLS); }
  Mutators.growth[0] = GROWTH_MAX_KILLS;
  Actors.alive[1] = 1; Actors.health[1] = 1;
  strike(0, 1, 100000);
  check('growth stops at +50%', Mutators.growth[0] === GROWTH_MAX_KILLS);
  Bus.emit('actor.spawn', { id: 0 });
  check('growth resets on respawn', Mutators.growth[0] === 0 && Hitbox.sizeScale[0] === 1);
  stopMutatorMatch();

  startMutatorMatch(['shrinkhit']);
  strike(0, 1, 1);
  check('diminish: a hit shrinks the target 5%', Math.abs(Hitbox.sizeScale[1] - 0.95) < 1e-4);
  for (let hit = 0; hit < 20; hit++) { Actors.health[1] = 100; strike(0, 1, 1); }
  check('diminish stops at 50%', Math.abs(Hitbox.sizeScale[1] - 0.5) < 1e-4);
  stopMutatorMatch();
  check('sizes are back to normal after the match', Hitbox.sizeScale[1] === 1);

  const sideRay = (id, height) => Hitbox.ray(id, Actors.x[id] + 5, Actors.y[id] + height, Actors.z[id], -1, 0, 0, 20, 0);
  startMutatorMatch([]);
  const normalHeadTop = Actors.eye[0] + HEAD_ABOVE_EYE + 0.25;
  const normalMiss = sideRay(0, normalHeadTop);
  stopMutatorMatch();
  startMutatorMatch(['bighead']);
  const bigHit = sideRay(0, normalHeadTop);
  check('big head: a shot that misses a normal head hits the enlarged one', normalMiss < 0 && bigHit > 0 && Hitbox.zone === ZONE.HEAD, normalMiss + ' ' + bigHit);
  stopMutatorMatch();
});

Test.add('mutators', (check) => {
  startMutatorMatch(['gamespeed']);
  check('game speed sets the sim time scale', Sim.timeScale === 1.25);
  stopMutatorMatch();
  check('the time scale returns to 1 when the match stops', Sim.timeScale === 1);

  startMutatorMatch(['slowmokills']);
  Game.playerId = 0;
  strike(0, 1, 100000);
  Sim.run(1);
  check('kill slow-mo halves time after the player kills', Mutators.slowmoLeft > 0 && Sim.timeScale === 0.5, Sim.timeScale);
  Sim.run(Math.round(SLOWMO_SIM_SECONDS * TICK_RATE) + 2);
  check('kill slow-mo ends after 1.5 s of real time', Sim.timeScale === 1 && Mutators.slowmoLeft === 0, Sim.timeScale);
  stopMutatorMatch();

  startMutatorMatch(['tags']);
  const killerScore = Modes.score[0];
  strike(0, 1, 100000);
  check('confirm kills: the kill itself scores nothing', Modes.score[0] === killerScore && TagPool.life.some((life) => life > 0));
  Actors.x[2] = Actors.x[1]; Actors.z[2] = Actors.z[1];
  Sim.run(2);
  check('an opponent touching the tag denies it', TagPool.life.every((life) => life <= 0) && Modes.score[0] === killerScore);
  Actors.x[2] = 30;
  Actors.alive[1] = 1; Actors.health[1] = 100;
  strike(0, 1, 100000);
  Actors.x[0] = Actors.x[1]; Actors.z[0] = Actors.z[1];
  Sim.run(2);
  check('the killer collecting the tag scores the point', Modes.score[0] === killerScore + 1 && Modes.objective[0] === 1, Modes.score[0]);
  strike(0, 1, 1);
  stopMutatorMatch();

  startMutatorMatch(['lastgift']);
  Actors.x[2] = 30; Actors.z[2] = 30;
  const explosions = [];
  const listener = Bus.on('explosion', (payload) => explosions.push(payload.source));
  strike(0, 1, 100000);
  Actors.x[2] = Actors.x[1]; Actors.z[2] = Actors.z[1];
  const healthBefore = healthOf(2);
  Sim.run(Math.round((GIFT_FUSE_SECONDS + 0.2) * TICK_RATE));
  Bus.off('explosion', listener);
  check('last gift: a dead actor drops a grenade that explodes after its fuse', explosions.join() === 'lastgift' && healthOf(2) < healthBefore, explosions.join() + ' ' + healthOf(2));
  stopMutatorMatch();
});

Test.add('mutators', (check) => {
  startMutatorMatch(['suppression']);
  const shot = { id: 0, weapon: 'warden', weaponClass: 'pistol', mode: 'primary', x: 0, y: 1.6, z: 0, dx: 1, dy: 0, dz: 0 };
  Actors.x[1] = 10; Actors.y[1] = 0; Actors.z[1] = 1.5;
  Actors.x[2] = 10; Actors.z[2] = 12;
  Bus.emit('weapon.fire', shot);
  const spread = Weapons.statScale[1 * WEAPON_STAT_COUNT + STAT.SPREAD];
  check('suppression: a near miss suppresses the target, widens its spread and blurs the view', Mutators.suppressed[1] > 0 && spread === SUPPRESS_SPREAD && Mutators.suppression(1) > 0.9);
  check('suppression: a target far from the line is not suppressed', Mutators.suppressed[2] === 0 && Mutators.suppressed[0] === 0);
  Sim.run(Math.round((SUPPRESS_SECONDS + 0.1) * TICK_RATE));
  check('suppression wears off and the spread returns', Mutators.suppressed[1] === 0 && Weapons.statScale[1 * WEAPON_STAT_COUNT + STAT.SPREAD] === 1);
  stopMutatorMatch();

  startMutatorMatch(['triangle']);
  Actors.health[0] = 50; Actors.armor[0] = 0;
  Weapons.give(0, 'maul');
  Actors.alive[1] = 1;
  strike(0, 1, 100000, { weapon: 'maul', kind: 'melee' });
  check('resource triangle: a melee kill refills health', Actors.health[0] === 75, Actors.health[0]);
  Actors.alive[1] = 1; Actors.health[1] = 10;
  strike(0, 1, 100000, { element: 'thermal' });
  check('resource triangle: a burning kill gives armor', Actors.armor[0] >= 25, Actors.armor[0]);
  Bus.emit('actor.spawn', { id: 2 });
  check('resource triangle halves the reserve ammo cap', Weapons.statScale[2 * WEAPON_STAT_COUNT + STAT.RESERVE] === TRIANGLE_RESERVE_SCALE);
  stopMutatorMatch();

  startMutatorMatch(['mirror']);
  Game.playerId = 0;
  Actors.kind[0] = ACTOR_KIND.PLAYER;
  Weapons.setLoadout(0, ['ramjet', 'maul']);
  Bus.emit('actor.spawn', { id: 1 });
  check('mirror match: a bot copies the player loadout', Weapons.has(1, 'ramjet') && Weapons.has(1, 'maul'));
  Actors.kind[0] = ACTOR_KIND.DUMMY;
  stopMutatorMatch();
});

Test.add('mutators', (check) => {
  startMutatorMatch(['oneshot']);
  const set = CAT.weaponSets.byId('matchSet');
  check('a weapon list fills the reserved match set', set.weapons.join() === 'lancet' && set.start.join() === 'lancet');
  check('everyone spawns with the listed weapon and infinite ammo', Weapons.has(0, 'lancet') && !Weapons.has(0, 'maul') && Weapons.ammo(0).infinite);
  stopMutatorMatch();
  check('the match set is emptied again after the match', CAT.weaponSets.byId('matchSet').weapons.join() === 'maul');

  startMutatorMatch([{ id: 'weaponset', value: ['maul', 'warden', 'lancet', 'ramjet'] }]);
  check('a custom list starts with a melee weapon and up to two guns', CAT.weaponSets.byId('matchSet').start.join() === 'maul,warden,lancet' && Weapons.has(0, 'warden'));
  stopMutatorMatch();

  startMutatorMatch(['infammo']);
  check('infinite ammo works without a weapon list', Weapons.ammo(0).infinite === true);
  stopMutatorMatch();

  startMutatorMatch([{ id: 'playerspeed', value: 200 }, { id: 'multijump', value: 3 }, 'autohop', 'aircontrol']);
  check('movement mutators reach the movement section', Move.preset(0).groundSpeed === 18 && Move.preset(0).extraJumps === 3 && MatchMove.autoHop === true && MatchMove.airControl === true);
  stopMutatorMatch();

  startMutatorMatch(['limbs']);
  check('locational damage swaps the health preset', Damage.preset().id === 'limb');
  stopMutatorMatch();

  const hadAbilities = !!CAT.abilities, hadPowerups = !!CAT.powerups;
  if (!hadAbilities) CAT.abilities = [{ id: 'testdash', code: 'A05' }, { id: 'testfar', code: 'A99' }];
  if (!hadPowerups) CAT.powerups = [{ id: 'testboost' }];
  const picks = [], grants = [];
  const pickListener = Bus.on('power.pick', (payload) => picks.push(payload.ability));
  const grantListener = Bus.on('item.grant', (payload) => grants.push(payload.id));
  startMutatorMatch([{ id: 'powers', value: true }, { id: 'superpowerups', value: 15 }]);
  Bus.emit('actor.spawn', { id: 1 });
  Sim.run(Math.round(16 * TICK_RATE));
  Bus.off('power.pick', pickListener); Bus.off('item.grant', grantListener);
  const aliveCount = Array.from({ length: Actors.count }, (unused, id) => Actors.alive[id]).filter(Boolean).length;
  check('powers for all announces one ability per spawn (A05..A33 only)', picks.length >= 1 && picks.every((name) => CAT.abilities.byId ? CAT.abilities.byId(name) : true) && !picks.includes('testfar'));
  check('super powerups grant every living actor a powerup each interval', grants.length === aliveCount && aliveCount >= 3, grants.length + ' ' + aliveCount);
  stopMutatorMatch();
  if (!hadAbilities) delete CAT.abilities;
  if (!hadPowerups) delete CAT.powerups;
});
