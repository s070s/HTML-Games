// Self-tests for the contracts between the engine sections S07-S13 (group 'wiring'): every block checks one hook or event
// that one section fills and another reads, so a one-ended contract (a hook nobody fills, an event nobody hears, a flag
// nobody reads) fails here. Actors stand on TestArena's floor.

const WiringTest = {
  // A hitscan shooter at the origin facing +z and a sturdy target `distance` metres ahead.
  shooter(distance) {
    const shooter = TestArena.actor(0, 0, 0, 0), target = TestArena.sponge(1, 0, distance);
    const weapon = giveFull(shooter, 'warden');
    Weapons.state[shooter] = WEAPON_STATE.IDLE; Weapons.nextShot[shooter] = 0;
    TestArena.aimAt(shooter, target);
    return { shooter, target, weapon };
  },
  fire(id) {
    Weapons.nextShot[id] = 0;
    TestArena.hold(id, BTN.FIRE, 1 / TICK_RATE);
    Sim.run(1);
  },
  // Runs fn with Game.headless off (code paths the renderer and effects take in a real browser), then restores it.
  withDisplay(fn) {
    const wasHeadless = Game.headless;
    Game.headless = false;
    try { return fn(); } finally { Game.headless = wasHeadless; }
  },
};

// ---- S11 <- S12: hitscan stops at devices and domes (Weapons.rayBlockers) ----
Test.add('wiring', (check) => {
  TestArena.start({ teams: 2, economy: 'pickups' });
  const t = WiringTest.shooter(10);
  const beacon = Devices.spawn(CAT.gadgets.byId('beacon'), t.target, 0, 0.7, 5);
  Devices.armTick[beacon] = Sim.tick;
  const healthBefore = Actors.health[t.target], deviceBefore = Devices.health[beacon];
  WiringTest.fire(t.shooter);
  check('a hitscan shot stops at a device in front of its target', Actors.health[t.target] === healthBefore, healthBefore - Actors.health[t.target]);
  check('the device takes the shot', Devices.health[beacon] < deviceBefore, Devices.health[beacon] + ' / ' + deviceBefore);
  Devices.clear();
  WiringTest.fire(t.shooter);
  check('without the device the same shot hits', Actors.health[t.target] < healthBefore);
  const dome = AbilityZones.add(ZONE_KIND.DOME, t.target, CAT.abilities.byId('aegisdome'), 0, 0, 10, 12);
  check('A26 the dome stops a ray at its surface from outside', Test.near(Weapons.blockDistance(0, 1, 0, 0, 0, 1, 50), 10 - Math.sqrt(24), 0.02), Weapons.blockDistance(0, 1, 0, 0, 0, 1, 50));
  check('A26 and from inside', Test.near(Weapons.blockDistance(0, 1, 10, 0, 0, 1, 50), Math.sqrt(24), 0.02));
  check('a ray that ends before the dome is not blocked', Weapons.blockDistance(0, 1, 0, 0, 0, 1, 3) === -1);
  AbilityZones.remove(dome);
  TestArena.finish();
});

// ---- Fire rate and speed: Buffs (12f) is the single writer of Weapons.rateScale and Move.statusSpeedScale ----
Test.add('wiring', (check) => {
  TestArena.start({ teams: 2 });
  const id = TestArena.actor(0, 0, 0, 0), weapon = giveFull(id, 'warden');
  const interval = Weapons.shotInterval(id, weapon, weapon.primary);
  Buffs.add(id, BUFF.RATE, 2, 5);
  Sim.run(1);
  check('the RATE buff writes Weapons.rateScale', Weapons.rateScale[id] === 2, Weapons.rateScale[id]);
  check('S11 halves the shot interval with it', Test.near(Weapons.shotInterval(id, weapon, weapon.primary), interval / 2, 1e-6));
  Powerups.give(id, CAT.powerups.byId('quickening'), 0);
  Buffs.add(id, BUFF.SLOW, 0.5, 5);
  Sim.run(1);
  check('powerup and buff fire rates multiply', Test.near(Weapons.rateScale[id], 2 * 1.3, 1e-5), Weapons.rateScale[id]);
  check('powerup speed and ability slows multiply', Test.near(Move.statusSpeedScale[id], 1.3 * 0.5, 1e-5), Move.statusSpeedScale[id]);
  Powerups.clearActor(id, false);
  Buffs.clear(id);
  check('everything back to 1 afterwards', Weapons.rateScale[id] === 1 && Move.statusSpeedScale[id] === 1);
  TestArena.finish();
});

// ---- S10 per-actor scales: glide gravity (A11), Marathon stamina, Quietstep footsteps ----
Test.add('wiring', (check) => {
  TestArena.start({ teams: 2, economy: 'classes', meter: 'energy' });
  const id = TestArena.actor(0, 0, 0, 0), preset = Move.preset(id);
  const row = CAT.abilities.byId('glidepack');
  Abilities.setSlot(id, SLOT.ABILITY1, row);
  Actors.y[id] = 20; Motion.grounded[id] = 0;
  Actors.buttons[id] = BTN.ABILITY1;
  Sim.run(2);
  check('A11 glide sets the actor gravity scale', Test.near(Move.gravityScale[id], row.params.gravity, 1e-6), Move.gravityScale[id]);
  check('Move.gravity reads it', Test.near(Move.gravity(id), preset.gravity * row.params.gravity, 1e-4), Move.gravity(id));
  Actors.buttons[id] = 0;
  Sim.run(3);
  check('letting go restores full gravity', Move.gravityScale[id] === 1, Move.gravityScale[id]);
  Economy.applyPerks(id, ['marathon', 'quietstep']);
  check('Marathon: stamina lasts twice as long', Move.staminaScale[id] === 2);
  Motion.stamina[id] = 2;
  updateStamina(id, Object.assign({}, preset, { sprintStamina: 5 }), true, 1);
  check('a sprinting second drains half a second of stamina', Test.near(Motion.stamina[id], 1.5, 1e-6), Motion.stamina[id]);
  check('Quietstep: silent footsteps', Move.footstepScale[id] === 0);
  const heard = [], loudness = [];
  const onSound = Bus.on('sound', (event) => { if (event.kind === 'step') heard.push(event.radius); });
  const onStep = Bus.on('move.step', (event) => loudness.push(event.loudness));
  Motion.grounded[id] = 1; Motion.sliding[id] = 0; Motion.stepDistance[id] = STRIDE_METRES;
  countSteps(id, preset, Actors.x[id], Actors.z[id]);
  Economy.applyPerks(id, []);
  Motion.stepDistance[id] = STRIDE_METRES;
  countSteps(id, preset, Actors.x[id], Actors.z[id]);
  Bus.off('sound', onSound); Bus.off('move.step', onStep);
  check('a quiet stride makes no bot noise and a 0 loudness step', heard.length === 1 && loudness[0] === 0 && loudness[1] === 1, heard.join() + ' / ' + loudness.join());
  check('audio skips silent steps', !SOUND_CONDITIONS.audible({ loudness: 0 }) && SOUND_CONDITIONS.audible({ loudness: 1 }) && SOUND_CONDITIONS.audible({}));
  TestArena.finish();
});

// ---- 12e abilities: EMP, freeze, own cloak flags, X46 power.pick, X40 mirror hero ----
Test.add('wiring', (check) => {
  TestArena.start({ teams: 2, meter: 'energy' });
  const id = TestArena.actor(0, 0, 0, 0);
  Abilities.setSlot(id, SLOT.ABILITY1, CAT.abilities.byId('glidepack'));
  Actors.buttons[id] = BTN.ABILITY1;
  Actors.y[id] = 20; Motion.grounded[id] = 0;
  Sim.run(2);
  check('an ability runs before the pulse', Abilities.active[Abilities.index(id, SLOT.ABILITY1)] === 1);
  Gadgets.suppress(id, 4);
  check('G20: the null pulse ends running abilities', Abilities.active[Abilities.index(id, SLOT.ABILITY1)] === 0);
  check('G20: and blocks new ones', !Abilities.tryActivate(id, SLOT.ABILITY1));
  check('G20: shields stop recharging for the same time', Damage.shieldRegenBlocked(id));
  Actors.buttons[id] = 0;
  TestArena.place(id, 0, 0);
  const blink = CAT.abilities.byId('shadowstep');
  Damage.addStatus(id, 'freeze', -1, 3, 1);
  check('G08: a frozen actor cannot blink', !castBlink(id, blink) && Actors.z[id] === 0);
  Damage.clearAllStatuses(id);
  Actors.flags[id] &= ~ACTOR_FLAG.FROZEN;
  check('without the freeze the blink works', castBlink(id, blink) && Actors.z[id] > 1);
  Buffs.add(id, BUFF.INVISIBLE, 1, 5);
  Buffs.apply();
  setCloak(id, false);
  check('a mode never clears a cloak another section set', (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) !== 0);
  Buffs.clear(id);
  check('the owner clears its own cloak', (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) === 0);
  Bus.emit('power.pick', { id, ability: 'grapnel' });
  check('X46: power.pick fills the first ability slot', Abilities.row(id, SLOT.ABILITY1).id === 'grapnel');
  TestArena.finish();
  TestArena.start({ teams: 2, economy: 'heroKits', fx: { mirror: true } });
  const player = TestArena.actor(0, 0, 0, 0), bot = TestArena.actor(1, 0, 10, 0);
  Game.playerId = player;
  Abilities.setChoice(player, { hero: 'brask' });
  Abilities.hero[player] = null;
  check('X40: a bot plays the player hero', Abilities.pickHero(bot).id === 'brask', Abilities.pickHero(bot).id);
  Game.playerId = -1;
  TestArena.finish();
});

// ---- S11 shield regeneration pause: one hook for every section ----
Test.add('wiring', (check) => {
  TestArena.start({ teams: 2 });
  const id = TestArena.actor(0, 0, 0, 0);
  Actors.maxShield[id] = 100; Actors.shield[id] = 10;
  Damage.lastDamageTime[id] = Sim.time - 100;
  Damage.pauseShieldRegen(id, 1);
  stepShieldRegen(id, { delay: 0, rate: 30 }, 1);
  check('H02 shield passive waits while shields are paused', Actors.shield[id] === 10, Actors.shield[id]);
  Sim.run(TICK_RATE + 1);
  check('the pause ends on time', !Damage.shieldRegenBlocked(id));
  stepShieldRegen(id, { delay: 0, rate: 30 }, 1);
  check('then the passive recharges', Actors.shield[id] >= 40, Actors.shield[id]);
  TestArena.finish();
});

// ---- 12a-12d <- S13 economy grants, hero gadgets and passive flags, Smoke.add ----
Test.add('wiring', (check) => {
  TestArena.start({ teams: 2, economy: 'classes' });
  const id = TestArena.actor(0, 0, 0, 0);
  Gadgets.resetActor(id);
  check('Economy.grants.gadget gives grenades', Economy.grant(id, 'gadget', 'frag') && Gadgets.countOf(id, 'frag') === 1);
  check('and ECP04 field upgrades', Economy.grant(id, 'gadget', 'beacon') && Gadgets.hudState(id, {}).gadget === 'Rally Beacon');
  const shield = CAT.buyItems.byId('coreShield');
  check('a grant row nobody delivers is not on sale', !Economy.canGrant(shield));
  Items.grantEffects.coreShield = () => true;
  check('a registered grant effect puts it on sale and delivers it', Economy.canGrant(shield) && Economy.grants.grant(id, shield));
  delete Items.grantEffects.coreShield;
  TestArena.finish();
  TestArena.start({ teams: 2, economy: 'heroKits' });
  const brask = TestArena.actor(0, 0, 0, 0);
  Abilities.setChoice(brask, { hero: 'brask' });
  Bus.emit('actor.spawn', { id: brask });
  check('H05 gets its hero gadget plus one extra', Gadgets.countOf(brask, 'singularity') === 2, Gadgets.countOf(brask, 'singularity'));
  const mirelle = TestArena.actor(0, 0, 3, 0), plain = TestArena.actor(1, 4, 3, 0);
  Abilities.hero[mirelle] = CAT.heroes.byId('mirelle');
  Abilities.hero[plain] = CAT.heroes.byId('brask');
  check('Smoke.add lays a curtain of puffs', Smoke.add(0, 0, 10, 12, 3, 15, 0, -1) >= 4 && Smoke.count >= 4, Smoke.count);
  Sim.run(itemTicks(2));
  check('the curtain blocks sight through it', Smoke.lineBlocked(0, 1.5, 4, 0, 1.5, 16, plain));
  check('H07 sees through smoke', !Smoke.lineBlocked(0, 1.5, 4, 0, 1.5, 16, mirelle));
  check('the curtain spans its width', Smoke.lineBlocked(-5, 1.5, 4, -5, 1.5, 16) && !Smoke.lineBlocked(-9, 1.5, 4, -9, 1.5, 16));
  Smoke.clear();
  Abilities.setSlot(plain, SLOT.ABILITY1, CAT.abilities.byId('veil'));
  Actors.pitch[plain] = Actors.aimPitch[plain] = -0.3;
  check('A17 Veil Curtain lays real smoke', Abilities.tryActivate(plain, SLOT.ABILITY1) && Smoke.count > 0, Smoke.count);
  TestArena.finish();
});

// ---- 12a pickups follow the ruleset: rules.items, fx.noPowerups, params.pickups, royale, matchSet, X30, X17, rarity ----
Test.add('wiring', (check) => {
  const spots = [ItemArena.spot('healthpack', 3, 0), ItemArena.spot('quickening', 6, 0), ItemArena.spot('vanguard', 9, 0)];
  ItemArena.start({ items: false }, spots);
  check('rules.items === false: no map pickups', Items.spotCount === 0);
  ItemArena.start({ fx: { noPowerups: true } }, spots);
  check('fx.noPowerups: powerup spots are skipped', Items.spotCount === 2);
  ItemArena.start({ params: { pickups: false } }, spots);
  check('params.pickups === false: no map pickups', Items.spotCount === 0);
  check('royale places its own loot', CAT.modes.byId('royale').params.pickups === false);
  ItemArena.start({ weaponSet: 'matchSet' }, []);
  CAT.weaponSets.byId('matchSet').weapons = ['maul', 'warden'];   // what 13h fills at match.setup from a weapon list
  Items.load(spots, 'ffa');
  check('matchSet: weapon spots hand out the match list', Items.keyOf(2) === 'warden', Items.keyOf(2));
  emptyMatchSet();
  ItemArena.start({ fx: { volatileAmmo: true } }, [ItemArena.spot('ammobox', 0, 6)]);
  const shooter = TestArena.actor(0, 0, 0, 0);
  giveFull(shooter, 'warden');
  Weapons.state[shooter] = WEAPON_STATE.IDLE;
  Actors.pitch[shooter] = Actors.aimPitch[shooter] = Math.atan2(PICKUP_FLOAT - Actors.eye[shooter], 6);
  let blasts = 0;
  const onBlast = Bus.on('explosion', (event) => { if (event.source === 'volatile') blasts++; });
  WiringTest.fire(shooter);
  Bus.off('explosion', onBlast);
  check('X30: a shot ammo pickup explodes and waits for its respawn', blasts === 1 && Items.state[0] === PICKUP_STATE.WAITING, blasts);
  ItemArena.start({ dropOnDeath: 'held' }, []);
  const giver = ItemArena.actor(1, 0, 0), taker = ItemArena.actor(2, 20, 0);
  Bus.emit('item.grant', { id: giver, item: 'quickening' });
  check('X17: item.grant gives the powerup', Powerups.has(giver, 'quickening'));
  Weapons.setLoadout(giver, ['vanguard']);
  Weapons.rarity[Weapons.slotIndex(giver, CAT.weapons.byId('vanguard').index)] = 3;
  ItemArena.kill(giver);
  const slot = ItemArena.firstDrop('vanguard');
  check('a dropped weapon keeps its rarity', slot >= 0 && Items.rarity[slot] === 3, slot >= 0 ? Items.rarity[slot] : 'no drop');
  TestArena.place(taker, Items.x[slot], Items.z[slot]);
  Sim.run(1);
  check('and the next owner gets it with that rarity', Weapons.has(taker, 'vanguard') && Weapons.rarity[Weapons.slotIndex(taker, CAT.weapons.byId('vanguard').index)] === 3);
  TestArena.finish();
});

// ---- S13 economy: loadouts stay off where the mode arms everyone; stat factor slots ----
Test.add('wiring', (check) => {
  TestArena.start({ economy: 'classes', params: { ladder: ['warden'] } });
  check('a weapon ladder mode has no loadouts', !Economy.usesLoadouts());
  TestArena.start({ economy: 'classes', params: { rotateEvery: 30 } });
  check('roulette has no loadouts', !Economy.usesLoadouts());
  TestArena.start({ economy: 'classes' });
  check('classes keep their loadouts', Economy.usesLoadouts());
  const id = TestArena.actor(0, 0, 0, 0);
  Economy.applyPerks(id, ['steady']);
  check('perks write Weapons.statScale, never the mutator slots', Weapons.statScale[id * WEAPON_STAT_COUNT + STAT.SPREAD] === Math.fround(0.7)
    && Weapons.mutatorScale[id * WEAPON_STAT_COUNT + STAT.SPREAD] === 1);
  Economy.applyPerks(id, []);
  TestArena.finish();
});

// ---- S07 renderer reads: head size (X14), Lights Out (X37), map lights ----
Test.add('wiring', (check) => {
  TestArena.start({ teams: 2, fx: { darkness: true } });
  const id = TestArena.actor(0, 0, 0, 0);
  Hitbox.headScale[id] = 2.5;
  check('X14: the drawn head follows Hitbox.headScale', readActorStyle(id).headScale === 2.5);
  Hitbox.headScale[id] = 1;
  applyTheme(CAT.themes[0].id);
  const theme = CAT.themes[0], frame = Render.frame;
  check('X37: the sun and ambient light go dark', frame.ambientSky[0] < 0.1 && frame.sunColor[0] < 0.1 * theme.sunIntensity, frame.ambientSky[0]);
  WiringTest.withDisplay(() => { Fx.clear(); updateFlashlights(); });
  check('X37: every actor carries a flashlight', fxLights.endTime.some((end) => end > Render.frame.time));
  Fx.clear();
  TestArena.finish();
  applyTheme(CAT.themes[0].id);
  check('the normal theme comes back without the mutator', Render.frame.ambientSky[0] > 0.1);
  const broken = [];
  for (const map of CAT.maps) {
    for (const light of readMapLights(map)) if (![light.x, light.y, light.z, light.radius].every(Number.isFinite)) broken.push(map.id);
  }
  check('map lights read x/y/z on every map', broken.length === 0, broken.slice(0, 5).join(', '));
});
