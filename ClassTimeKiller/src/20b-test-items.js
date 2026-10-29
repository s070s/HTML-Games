// Self-tests for S12 pickups and powerups: map keys, exact respawn timers and scales, caps and overheal, weapon stay,
// drops on death and their despawn, loot consumables, and every powerup (applies, stacks, expires on time, leaves nothing
// behind after death or match end, drops with its time left).

const ItemArena = {
  // TestArena match with item rules on top and the given map item entries loaded as spots.
  start(rules, entries) {
    TestArena.start(Object.assign({ itemRespawnScale: 1, teams: 0, dropOnDeath: 'none', weaponStay: false, mutators: [] }, rules || {}));
    Items.load(entries || [], 'ffa');
  },
  spot(item, x, z) { return { x, y: 0, z, item }; },
  // A fresh actor standing on (x, z) with half health (so heals apply).
  actor(team, x, z) {
    const id = TestArena.actor(team, x, z);
    Actors.health[id] = 50;
    return id;
  },
  kill(id) { TestArena.hit(-1, id, 1e6, { bypassArmor: true, bypassShield: true }); },
  readyDrops(key) {
    let count = 0;
    for (let slot = Items.spotCount; slot < PICKUP_CAP; slot++) if (Items.state[slot] === PICKUP_STATE.READY && Items.keyOf(slot) === key) count++;
    return count;
  },
  firstDrop(key) {
    for (let slot = Items.spotCount; slot < PICKUP_CAP; slot++) if (Items.state[slot] === PICKUP_STATE.READY && Items.keyOf(slot) === key) return slot;
    return -1;
  },
  // Lasting effects a powerup could leave on its holder.
  leftovers(id, baseHealth) {
    const problems = [];
    if (Move.statusSpeedScale[id] !== 1) problems.push('speed');
    if (Weapons.rateScale[id] !== 1) problems.push('rate');
    if (Weapons.freeAmmo[id]) problems.push('free ammo');
    if (Items.noArmor[id]) problems.push('no armor');
    if (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) problems.push('invisible');
    if (Actors.maxHealth[id] !== baseHealth) problems.push('max health ' + Actors.maxHealth[id]);
    if (Powerups.activeCount[id]) problems.push('still active');
    return problems.join(', ');
  },
  plainWeapon() { return CAT.weapons.find((weapon) => weapon.class !== 'power' && weapon.mag > 0 && Weapons.countsTowardCarry(weapon)); },
  powerWeapon() { return CAT.weapons.find((weapon) => weapon.class === 'power'); },
};

Test.add('items', (check) => {
  const unknown = [];
  CAT.maps.forEach((map) => map.items.forEach((entry) => { if (Items.resolve(entry.item) < 0) unknown.push(map.id + ':' + entry.item); }));
  check('every map item key resolves to an item, powerup or weapon', unknown.length === 0, unknown.slice(0, 6).join(', '));
  const groups = CAT.items.every((row) => PICKUP_GROUPS.includes(row.group) && Items.effects[row.effect]);
  check('every item row has a known group and effect handler', groups);
  check('unknown keys resolve to -1', Items.resolve('no-such-item') === -1);
});

// PERF-002: the per-step pickup loops stop at Items.usedEnd (every slot from there on is free), and a drop past the
// map spots still counts.
Test.add('items', (check) => {
  ItemArena.start({}, [ItemArena.spot('healthpack', 3, 0), ItemArena.spot('healthpack', 6, 0)]);
  check('usedEnd covers the map spots only', Items.usedEnd === 2 && Items.spotCount === 2, Items.usedEnd);
  const id = ItemArena.actor(1, 12, 0), slot = Items.drop('healthpack', 12, 0, 0);
  check('a drop past the spots raises usedEnd to its slot', slot === 2 && Items.usedEnd === 3, Items.usedEnd);
  const stray = Items.usedEnd;   // a slot past usedEnd made READY by hand: the unique-spot check must not scan that far
  const foundDrop = Items.dropExists(0);
  Items.state[slot] = PICKUP_STATE.FREE;
  Items.state[stray] = PICKUP_STATE.READY; Items.kind[stray] = Items.kind[0]; Items.row[stray] = Items.row[0];
  const foundStray = Items.dropExists(0);
  Items.state[stray] = PICKUP_STATE.FREE; Items.state[slot] = PICKUP_STATE.READY;
  check('dropExists finds the drop and stops at usedEnd', foundDrop && !foundStray, foundDrop + ' / ' + foundStray);
  Sim.run(1);
  check('the dropped pickup is touched and taken', Actors.health[id] === 75 && Items.state[slot] === PICKUP_STATE.FREE, Actors.health[id]);
  Items.clear();
  check('clear resets usedEnd', Items.usedEnd === 0);
});

// Map weapon pads follow the ruleset's weapon set (a gun of the same class first), and hero matches have none.
Test.add('items', (check) => {
  const spots = [ItemArena.spot('healthpack', 3, 0), ItemArena.spot('vanguard', 6, 0), ItemArena.spot('lancet', 9, 0)];
  ItemArena.start({ weaponSet: 'militarySet' }, spots);
  const military = CAT.weaponSets.byId('militarySet').weapons;
  check('a pad outside the set hands out a set gun of its class', Items.keyOf(1) === 'vanguard' && Items.keyOf(2) === 'kestrel', Items.keyOf(2));
  ItemArena.start({ weaponSet: 'arenaSet' }, spots);
  const arena = CAT.weaponSets.byId('arenaSet');
  check('the Arena set has no rifle: the Vanguard pad becomes an Arena pickup gun, not the spawn pistol', arena.weapons.includes(Items.keyOf(1)) && !arena.start.includes(Items.keyOf(1)) && military.includes('vanguard'), Items.keyOf(1));
  ItemArena.start({ weaponSet: 'sandboxSet' }, [ItemArena.spot('vanguard', 6, 0), ItemArena.spot('warden', 9, 0)]);
  const sandbox = CAT.weaponSets.byId('sandboxSet'), sandboxKeys = [Items.keyOf(0), Items.keyOf(1)];
  const pickupGun = (key) => sandbox.weapons.includes(key) && !sandbox.start.includes(key);
  check('Shield Wars: a converted pad never hands out a spawn gun (the Vanguard pad stays a rifle)', sandboxKeys.every(pickupGun) && CAT.weapons.byId(Items.keyOf(0)).class === 'rifle', sandboxKeys.join());
  ItemArena.start({ economy: 'heroKits' }, spots);
  check('hero kits: no weapon pads, other pickups stay', Items.spotCount === 1 && Items.keyOf(0) === 'healthpack', Items.spotCount);
  TestArena.finish();
});

// The one carry-limit rule: walking over a gun never swaps out the held one; holding Use swaps once (the
// HUD prompt names both guns and the touch USE button shows), not every few steps on a pile of three dropped guns.
Test.add('items', (check) => {
  ItemArena.start({ carry: 1 }, []);
  const id = ItemArena.actor(1, 20, 0), player = Game.playerId;
  Weapons.setLoadout(id, ['vanguard']);
  ['tempest', 'wasp', 'anvil'].forEach((key) => Items.drop(key, 20, 0, 0));
  let swaps = 0;
  const onPickup = (event) => { if (event.id === id && event.group === 'weapon') swaps++; };
  Bus.on('pickup', onPickup);
  Sim.run(3 * TICK_RATE);
  check('standing on the pile without Use keeps the held gun', swaps === 0 && Weapons.has(id, 'vanguard'), swaps);
  let prompt = '';
  for (let i = 0; i < Input.usePrompts.length && !prompt; i++) prompt = Input.usePrompts[i](id);
  Game.playerId = id;
  const touchUse = TouchInput.needs.use();
  Game.playerId = player;
  check('the Use prompt names the held gun and the floor gun, and touch shows USE', prompt === 'HOLD TO SWAP VANGUARD RIFLE FOR TEMPEST RIFLE' && touchUse, prompt + ' / ' + touchUse);
  TestArena.hold(id, BTN.USE, 3);
  check('one swap while holding Use on the pile', swaps === 1 && !Weapons.has(id, 'vanguard'), swaps);
  Actors.x[id] = 30;
  Sim.run(1);
  Actors.x[id] = 20;
  TestArena.hold(id, BTN.USE, 2 / TICK_RATE);   // the press step itself never swaps (a plant or defuse answering it comes later in the step)
  Bus.off('pickup', onPickup);
  check('stepping off and back on after the pause allows the next swap', swaps === 2, swaps);
  TestArena.finish();
});

// swap-02: a Use hold spent on a revive never swaps the held gun for the one underfoot, on the way in (from
// REVIVE_HINT_RANGE, where the revive prompt wins over the swap prompt) nor after the revive (fresh Use: the pile test).
// royaleUsePrompt (20b-test-modes2) reads Input.usePrompts like the HUD.
Test.add('items', (check) => {
  ItemArena.start({ carry: 1, downed: true, health: 'regen', teams: 2 }, []);
  const shooter = ItemArena.actor(1, 0, 0), medic = ItemArena.actor(2, 20, 0), mate = ItemArena.actor(2, 23, 0);
  Weapons.setLoadout(medic, ['vanguard']);
  Items.drop('tempest', 20, 0, 0);
  TestArena.hit(shooter, mate, 150);
  Sim.step();   // Damage.downedCount is counted in the step
  TestArena.hold(medic, BTN.USE, 1);
  check('3 m from a downed mate: revive prompt, Use held swaps nothing', royaleUsePrompt(medic) === 'HOLD TO REVIVE' && Weapons.has(medic, 'vanguard'));
  Actors.x[mate] = 21.3;   // in revive reach, off the gun
  Sim.step();
  TestArena.hold(medic, BTN.USE, REVIVE_SECONDS + 1);
  check('Use held to revive and on swaps nothing', Weapons.has(medic, 'vanguard') && !(Actors.flags[mate] & ACTOR_FLAG.DOWNED));
  Sim.step();
  check('then the swap is offered again', royaleUsePrompt(medic) === 'HOLD TO SWAP VANGUARD RIFLE FOR TEMPEST RIFLE');
  TestArena.finish();
});

// swap-02: the skimmer takes the Use hold that boards it, so guns ridden over at the carry limit stay, and so does
// the press that steps off onto a gun (Use held on).
Test.add('items', (check) => {
  ItemArena.start({ carry: 1, move: 'arena' }, []);
  World.map.size = SKIMMER_MIN_MAP_SIZE;
  const id = ItemArena.actor(1, 0, -50);
  Weapons.setLoadout(id, ['vanguard']);
  holdInput(id, 0, 1, 0);
  Sim.run(TICK_RATE / 2);
  holdInput(id, 0, 1, BTN.USE);
  Sim.step();
  for (let metre = 1; metre <= 10; metre++) Items.drop('tempest', 0, 0, Actors.z[id] + metre);
  Sim.run(TICK_RATE);
  check('skimmer: riding over guns swaps nothing', Move.onBoard(id) && Weapons.has(id, 'vanguard'));
  holdInput(id, 0, 1, 0);
  Sim.step();
  for (let metre = 0; metre <= 4; metre++) Items.drop('wasp', 0, 0, Actors.z[id] + metre);
  holdInput(id, 0, 0, BTN.USE);
  Sim.run(TICK_RATE / 2);
  check('skimmer: stepping off onto a gun swaps nothing', !Move.onBoard(id) && Weapons.has(id, 'vanguard'));
  TestArena.finish();
});

// Bots at the carry limit still upgrade at the pads with no Use, and only upgrade: a pad gun they cross is swapped in
// only when the bot values it more (14e weaponItemValue; swap-01). Weave Suit carries two guns and spawns with two,
// so every pad gun is a swap; the gun pushed out is still in Weapons.dropped when 'pickup' fires.
Test.add('items', (check) => {
  let upgrades = 0, downgrades = 0;
  const worth = (id, key) => BotCombat.weaponValue(id, CAT.weapons.byId(key), 1);
  const onPickup = (event) => {
    if (event.group !== 'weapon' || !Bots.active[event.id] || !Weapons.dropped) return;
    const gain = worth(event.id, event.item) - worth(event.id, Weapons.dropped);
    if (gain > 0) upgrades++;
    if (gain < 0) downgrades++;
  };
  Bus.on('pickup', onPickup);
  try { playMatch({ mode: 'tdm', map: 'harbor', ruleset: 'suit', minutes: 3, botCount: 10, seed: 1, modeOptions: SOAK_OPEN_MATCH }); } finally { Bus.off('pickup', onPickup); }
  check('Weave Suit: full bots swap guns at the pads, upgrades only', upgrades >= 8 && downgrades === 0, upgrades + ' / ' + downgrades);
});

Test.add('items', (check) => {
  ItemArena.start({}, [ItemArena.spot('healthpack', 3, 0)]);
  const id = ItemArena.actor(1, 3, 0);
  let pickups = 0;
  const handler = Bus.on('pickup', (event) => { if (event.item === 'healthpack' && event.group === 'health') pickups++; });
  Sim.run(1);
  Bus.off('pickup', handler);
  check('I02 +25 HP on touch with a pickup event', Actors.health[id] === 75 && pickups === 1, Actors.health[id] + ' / ' + pickups);
  const wait = Items.readyTick[0] - Sim.tick;
  check('I02 respawn timer is 35 s', Items.state[0] === PICKUP_STATE.WAITING && Math.abs(wait - itemTicks(35)) <= 1, wait);
  TestArena.place(id, 20, 0);
  Sim.run(Items.readyTick[0] - Sim.tick - 1);
  check('still waiting one tick before the timer', Items.state[0] === PICKUP_STATE.WAITING);
  const respawns = TestArena.count('item.respawn', () => Sim.run(2));
  check('back exactly on time with an item.respawn event', Items.state[0] === PICKUP_STATE.READY && respawns === 1, respawns);
  ItemArena.start({ itemRespawnScale: 0.5 }, [ItemArena.spot('healthpack', 3, 0)]);
  check('itemRespawnScale halves the timer', Items.respawnTicks(0) === itemTicks(17.5), Items.respawnTicks(0));
  ItemArena.start({ botSkill: CAT.difficulty.byId('stroll') }, [ItemArena.spot('healthpack', 3, 0)]);
  check('DIF-002 the difficulty resourceYield (D01 x2) makes map pickups return sooner', Items.respawnTicks(0) === itemTicks(35 / 2), Items.respawnTicks(0));
  TestArena.finish();
});

// P2-02: a picked pad shows nothing of the item. It is a dark empty disc with a fill that grows from the centre as the respawn time
// passes; the item (and its lit base) is back exactly when the spot is ready. Weapon, health, armor, ammo and power spots alike.
Test.add('items', (check) => {
  const plain = ItemArena.plainWeapon(), power = ItemArena.powerWeapon();
  ItemArena.start({}, [ItemArena.spot('healthpack', 3, 0), ItemArena.spot('lightplate', 6, 0), ItemArena.spot('ammobox', 9, 0), ItemArena.spot(plain.id, 12, 0), ItemArena.spot(power.id, 15, 0)]);
  const camera = Render.camera, saved = { x: camera.x, y: camera.y, z: camera.z };
  camera.x = 0; camera.y = 1.6; camera.z = 0;
  const frame = () => { const recorder = meshRecorder(); Items.draw(recorder); return recorder.meshes; };
  const pads = (meshes) => meshes.filter((mesh) => mesh.shape === 'cylinder' && mesh.y < PICKUP_FLOAT / 2);   // the flat discs; item models float higher
  try {
    Items.state[4] = PICKUP_STATE.READY;
    const full = frame(), readyDiscs = pads(full).length;
    check('P2-02 five ready spots: each shows its lit base disc and its item', readyDiscs === 5 && full.length > 5, readyDiscs + ' / ' + full.length);
    const taker = ItemArena.actor(1, 3, 0);
    Sim.step();
    check('P2-02 the picked spot is waiting and its item model is gone', Items.state[0] === PICKUP_STATE.WAITING && Items.state[1] === PICKUP_STATE.READY);
    const afterPickup = frame(), items = full.length - afterPickup.length;
    check('P2-02 right after the pickup the pad draws one dark disc and no fill', pads(afterPickup).length === readyDiscs && items > 0 && Items.waitShare(0) < 0.01, pads(afterPickup).length + ' / ' + items);
    TestArena.place(taker, 40, 0);
    const wait = Items.readyTick[0] - Sim.tick;
    Sim.run(Math.round(wait / 2));
    const half = Items.waitShare(0);
    const midway = frame();
    check('P2-02 half way through the respawn the fill is half grown', Test.near(half, 0.5, 0.02) && pads(midway).length === readyDiscs + 1, half + ' / ' + pads(midway).length);
    const fill = pads(midway).find((mesh) => Test.near(mesh.sz, half, 1e-3));
    check('P2-02 the fill disc is scaled by the share and sits above the base', !!fill && fill.y > pads(afterPickup)[0].y, fill && fill.y);
    Sim.run(Items.readyTick[0] - Sim.tick - 1);
    check('P2-02 one tick before the respawn the item is still not drawn', Items.state[0] === PICKUP_STATE.WAITING && frame().length < full.length && Items.waitShare(0) > 0.99);
    Sim.run(2);
    check('P2-02 on the respawn tick the item and the lit base are back, the fill is gone', Items.state[0] === PICKUP_STATE.READY && frame().length === full.length && Items.waitShare(0) === 0);
    const waitingAt = Sim.tick;
    Items.wait(4, 600);
    Sim.run(300);
    check('P2-02 a power spot fills over its own, longer wait', Test.near(Items.waitShare(4), 0.5, 0.01) && Items.waitTicks[4] === 600 && Sim.tick - waitingAt === 300, Items.waitShare(4));
  } finally { camera.x = saved.x; camera.y = saved.y; camera.z = saved.z; }
  TestArena.finish();
});

Test.add('items', (check) => {
  const plain = ItemArena.plainWeapon(), power = ItemArena.powerWeapon(), pad = CAT.items.byId('weaponpad');
  ItemArena.start({}, [ItemArena.spot(plain.id, 3, 0), ItemArena.spot(power.id, 6, 0)]);
  check('WPN-009 weapon spots 5 s in free-for-all', Items.respawnTicks(0) === itemTicks(pad.respawn), Items.respawnTicks(0));
  check('WPN-009 power weapons 120 s', Items.respawnTicks(1) === itemTicks(pad.respawnPower), Items.respawnTicks(1));
  check('power weapon spots wait for their first spawn', Items.state[1] === PICKUP_STATE.WAITING);
  ItemArena.start({ teams: 2 }, [ItemArena.spot(plain.id, 3, 0)]);
  check('WPN-009 weapon spots 30 s in team modes', Items.respawnTicks(0) === itemTicks(pad.respawnTeams), Items.respawnTicks(0));
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({}, [ItemArena.spot('healthpack', 3, 0), ItemArena.spot('megacell', 6, 0), ItemArena.spot('heavyplate', 9, 0)]);
  const full = TestArena.actor(1, 3, 0);
  Sim.run(1);
  check('I02 is not taken at full health', Items.state[0] === PICKUP_STATE.READY && Actors.health[full] === 100);
  const megaCap = Math.max(100, Math.min(200, Damage.preset().overhealCap));
  TestArena.place(full, 6, 0);
  Sim.run(1);
  check('I04 overheals up to its cap', Actors.health[full] === Math.min(megaCap, 200), Actors.health[full] + ' / ' + megaCap);
  const before = Actors.health[full];
  TestArena.place(full, 30, 0);
  Sim.run(5 * TICK_RATE);
  check('overheal decays 1 HP/s back towards 100', before <= 100 || Test.near(Actors.health[full], before - 5, 0.1), before + ' -> ' + Actors.health[full]);
  TestArena.place(full, 9, 0);
  Sim.run(1);
  const armorCap = Math.min(200, Actors.maxArmor[full]);
  check('I07 +100 armor up to the armor cap', Actors.armor[full] === Math.min(100, armorCap), Actors.armor[full]);
  Actors.armor[full] = armorCap;
  check('I05 is refused at the armor cap', !Items.effects.armor(full, CAT.items.byId('armorshard')) && Actors.armor[full] === armorCap);
  TestArena.finish();
});

Test.add('items', (check) => {
  const plain = ItemArena.plainWeapon(), power = ItemArena.powerWeapon();
  ItemArena.start({ weaponStay: true }, [ItemArena.spot(plain.id, 3, 0), ItemArena.spot(power.id, 6, 0)]);
  const first = ItemArena.actor(1, 3, 0), second = ItemArena.actor(2, 3, 0);
  Sim.run(1);
  check('X11 weapon stay: both take it and the spot stays', Weapons.has(first, plain.id) && Weapons.has(second, plain.id) && Items.state[0] === PICKUP_STATE.READY);
  check('weapon stay never applies to power weapons', !Items.stays(1));
  ItemArena.start({ weaponStay: false }, [ItemArena.spot(plain.id, 3, 0)]);
  const taker = ItemArena.actor(1, 3, 0);
  Sim.run(1);
  check('without weapon stay the spot empties', Weapons.has(taker, plain.id) && Items.state[0] === PICKUP_STATE.WAITING);
  TestArena.finish();
});

Test.add('items', (check) => {
  const plain = ItemArena.plainWeapon();
  ItemArena.start({ dropOnDeath: 'held' });
  const victim = ItemArena.actor(1, 0, 0);
  Weapons.give(victim, plain.id, 0);
  ItemArena.kill(victim);
  const slot = ItemArena.firstDrop(plain.id);
  check('dropOnDeath held: the held weapon drops', slot >= 0);
  check('drops vanish after 30 s', slot >= 0 && Math.abs(Items.despawnTick[slot] - Sim.tick - itemTicks(ITEM_TIMING.droppedSeconds)) <= 1);
  Sim.run(itemTicks(ITEM_TIMING.droppedSeconds) + 1);
  check('the drop is gone after its time', slot >= 0 && Items.state[slot] === PICKUP_STATE.FREE);
  ItemArena.start({ dropOnDeath: 'none' });
  const keeper = ItemArena.actor(1, 0, 0);
  Weapons.give(keeper, plain.id, 0);
  ItemArena.kill(keeper);
  check('dropOnDeath none: nothing drops', ItemArena.readyDrops(plain.id) === 0);
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0);
  const patch = CAT.items.byId('patch');
  check('loot consumables are granted into the carry', Items.grant(id, 'patch') && Items.carriedCount(id, 'patch') === 1);
  check('use starts the timer', Items.use(id, 'patch') && Items.useProgress(id) === 0);
  Sim.run(itemTicks(patch.useTime) - 2);
  check('I13 nothing before its use time', Actors.health[id] === 50, Actors.health[id]);
  Sim.run(3);
  check('I13 +15 HP after 3 s and spent', Actors.health[id] === 65 && Items.carriedCount(id, 'patch') === 0, Actors.health[id]);
  Actors.health[id] = patch.cap;
  Items.grant(id, 'patch');
  check('I13 not usable at its 75 HP cap', !Items.use(id, 'patch'));
  TestArena.finish();
});

// The heal action (BTN.HEAL, key H, touch HEAL) uses the first carried consumable that would restore; bots heal once calm.
Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0), patch = CAT.items.byId('patch');
  check('the heal action and its touch button exist', Input.actionIndex.heal !== undefined && TOUCH_CONTROLS.some((control) => control.action === 'heal'));
  Items.grant(id, 'patch');
  TestArena.hold(id, BTN.HEAL, 0.05);
  check('the heal button starts a carried consumable', Items.useProgress(id) >= 0 && Items.consumableCount(id) === 1);
  Sim.run(itemTicks(patch.useTime));
  check('the heal button item applies after its use time', Actors.health[id] === 65 && Items.consumableCount(id) === 0, Actors.health[id]);
  TestArena.finish();   // bots press the same heal button (20b-test-bots: the decision is the brain's)
});

Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0), baseHealth = Actors.maxHealth[id], failures = [];
  CAT.powerups.forEach((row) => {
    Damage.resetHealth(id); Actors.health[id] = 50; Powerups.resetActor(id);
    if (!Powerups.give(id, row, 0)) { failures.push(row.id + ' not taken'); return; }
    if (Powerups.lasts(row) && !Powerups.has(id, row.id)) failures.push(row.id + ' not active');
    Powerups.clearActor(id, false);
    const left = ItemArena.leftovers(id, row.instant.vital ? Actors.maxHealth[id] : baseHealth);   // PU20 raises max HP for good
    if (left) failures.push(row.id + ': ' + left);
  });
  check('PU01..PU20 each apply and leave nothing when removed', failures.length === 0, failures.join('; '));
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0), fury = CAT.powerups.byId('fury'), slot = id * POWERUP_COUNT + fury.index;
  Powerups.give(id, fury, 0);
  check('PU01 lasts 30 s', Powerups.endTick[slot] - Sim.tick === itemTicks(30));
  Powerups.give(id, fury, 0);
  Powerups.give(id, fury, 0);
  check('stacking adds time up to 60 s', Powerups.endTick[slot] - Sim.tick === itemTicks(60), Powerups.endTick[slot] - Sim.tick);
  let ended = 0;
  const handler = Bus.on('powerup.end', (event) => { if (event.powerup === 'fury') ended++; });
  Sim.run(Powerups.endTick[slot] - Sim.tick - 1);
  const stillOn = Powerups.has(id, 'fury');
  Sim.run(2);
  Bus.off('powerup.end', handler);
  check('expires exactly on its tick', stillOn && !Powerups.has(id, 'fury') && ended === 1);
  TestArena.finish();
});

// Health lost by a fresh target when `source` hits it for `amount` (with optional damage info fields).
function powerupLoss(source, target, amount, extra) {
  Damage.resetHealth(target);
  const before = Actors.health[target] + Actors.armor[target] + Actors.shield[target];
  TestArena.hit(source, target, amount, extra);
  return before - (Actors.health[target] + Actors.armor[target] + Actors.shield[target]);
}

Test.add('items', (check) => {
  ItemArena.start({});
  const holder = ItemArena.actor(1, 0, 0), target = ItemArena.actor(2, 0, 5);
  const plain = powerupLoss(holder, target, 10);
  Powerups.give(holder, CAT.powerups.byId('fury'), 0);
  check('PU01 deals x3 damage', Test.near(powerupLoss(holder, target, 10), plain * 3, 0.01), plain);
  Powerups.clearActor(holder, false);
  Powerups.give(target, CAT.powerups.byId('warding'), 0);
  check('PU02 halves damage taken', Test.near(powerupLoss(holder, target, 20), powerupLoss(-1, holder, 20) / 2, 0.51));
  check('PU02 ignores splash', powerupLoss(holder, target, 20, { kind: 'splash' }) === 0);
  Powerups.clearActor(target, false);
  Powerups.give(target, CAT.powerups.byId('sigil'), 0);
  check('PU10 takes no damage', powerupLoss(holder, target, 50) === 0);
  Powerups.clearActor(target, false);
  Powerups.give(holder, CAT.powerups.byId('vampfang'), 0);
  Actors.health[holder] = 50;
  TestArena.hit(holder, target, 20);
  check('PU12 heals 30 % of damage dealt', Test.near(Actors.health[holder], 56, 0.01), Actors.health[holder]);
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0);
  Powerups.give(id, CAT.powerups.byId('quickening'), 0);
  check('PU03 speed and fire rate x1.3', Test.near(Move.statusSpeedScale[id], 1.3, 1e-6) && Test.near(Weapons.rateScale[id], 1.3, 1e-6));
  Powerups.give(id, CAT.powerups.byId('ghostveil'), 0);
  check('PU04 cloak flag and 25 % perception', (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) !== 0 && Test.near(Items.perceptionScale(id), 0.25, 1e-6));
  Powerups.give(id, CAT.powerups.byId('bottomless'), 0);
  check('PU11 free ammo', Weapons.freeAmmo[id] === 1);
  Powerups.clearActor(id, false);
  Actors.health[id] = 50;
  Powerups.give(id, CAT.powerups.byId('renewal'), 0);
  Sim.run(TICK_RATE);
  check('PU05 regenerates 15 HP/s below 110', Test.near(Actors.health[id], 65, 0.2), Actors.health[id]);
  Powerups.clearActor(id, false);
  Powerups.give(id, CAT.powerups.byId('surplus'), 0);
  check('PU07 +100 surplus shield', Damage.surplus[id] === 100);
  check('PU07 refused while the surplus is full', !Powerups.give(id, CAT.powerups.byId('surplus'), 0));
  Sim.run(5 * TICK_RATE);
  check('PU07 surplus decays 2/s', Test.near(Damage.surplus[id], 90, 0.1), Damage.surplus[id]);
  Powerups.give(id, CAT.powerups.byId('guardianrune'), 0);
  check('PU15 doubles max health', Actors.maxHealth[id] === 200, Actors.maxHealth[id]);
  check('runes: one at a time', !Powerups.give(id, CAT.powerups.byId('scoutrune'), 0));
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({});
  const holder = ItemArena.actor(1, 0, 0), baseHealth = Actors.maxHealth[holder];
  ['fury', 'ghostveil', 'quickening', 'guardianrune'].forEach((key) => Powerups.give(holder, CAT.powerups.byId(key), 0));
  Sim.run(10 * TICK_RATE);
  ItemArena.kill(holder);
  check('PWR-003 nothing left on the holder after death', ItemArena.leftovers(holder, baseHealth) === '', ItemArena.leftovers(holder, baseHealth));
  const slot = ItemArena.firstDrop('fury');
  check('timed powerups drop, runes do not', slot >= 0 && ItemArena.readyDrops('ghostveil') === 1 && ItemArena.readyDrops('guardianrune') === 0);
  check('the drop keeps its 20 s left', slot >= 0 && Math.abs(Items.timeLeft[slot] - itemTicks(20)) <= 2, slot >= 0 ? Items.timeLeft[slot] : -1);
  const finder = ItemArena.actor(2, 0, 0);
  Items.x[slot] = Actors.x[finder]; Items.z[slot] = Actors.z[finder];
  Sim.run(1);
  const left = Powerups.ticksLeft(finder, CAT.powerups.byId('fury'));
  check('the finder gets the time that was left', Math.abs(left - itemTicks(20)) <= 3, left);
  Powerups.give(finder, CAT.powerups.byId('seer'), 0);
  Bus.emit('match.end', {});
  check('match end removes every powerup', Powerups.activeCount[finder] === 0);
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({}, [ItemArena.spot('fury', 3, 0)]);
  const first = Items.readyTick[0] - Sim.tick;
  check('PWR-001 power items first appear 45 +/- 15 s in', first >= itemTicks(30) && first <= itemTicks(60), first);
  let warnings = 0;
  const handler = Bus.on('announce', (event) => { if (event.kind === 'power') warnings++; });
  Sim.run(Items.readyTick[0] - Sim.tick - itemTicks(ITEM_TIMING.powerWarning) + 1);
  Bus.off('announce', handler);
  check('PWR-002 announced 10 s before it appears', warnings === 1, warnings);
  ItemArena.start({ mutators: ['nopowerups'] }, [ItemArena.spot('fury', 3, 0), ItemArena.spot('healthpack', 6, 0)]);
  check('X16 no powerups: power spots are skipped', Items.spotCount === 1 && Items.keyOf(0) === 'healthpack');
  ItemArena.start({}, [ItemArena.spot('lightbearer', 3, 0)]);
  const holder = ItemArena.actor(1, 30, 0);
  Powerups.give(holder, CAT.powerups.byId('lightbearer'), 0);
  check('PU19 unique: its spot waits while it is held', Items.uniqueOut(CAT.powerups.byId('lightbearer').index));
  TestArena.finish();
});

// Every timed powerup at once: each works through the step before its end tick and is gone after the step of its end tick.
Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0), timed = CAT.powerups.filter((row) => Powerups.isTimed(row)), failures = [];
  timed.forEach((row) => {
    Powerups.give(id, row, 0);
    const left = Powerups.ticksLeft(id, row);
    if (left !== itemTicks(row.duration)) failures.push(row.id + ' lasts ' + left);
  });
  const ends = [...new Set(timed.map((row) => Sim.tick + itemTicks(row.duration)))].sort((a, b) => a - b);
  ends.forEach((end) => {
    const due = timed.filter((row) => Sim.tick + Powerups.ticksLeft(id, row) === end);
    Sim.run(end - Sim.tick);
    due.forEach((row) => { if (!Powerups.has(id, row.id)) failures.push(row.id + ' gone early'); });
    Sim.run(1);
    due.forEach((row) => { if (Powerups.has(id, row.id)) failures.push(row.id + ' still on at its end tick'); });
  });
  check('every timed powerup lasts its duration and ends on its exact tick', timed.length >= 10 && failures.length === 0, failures.join('; '));
  check('nothing is left once they all ended', ItemArena.leftovers(id, Actors.maxHealth[id]) === '', ItemArena.leftovers(id, Actors.maxHealth[id]));
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0), target = ItemArena.actor(2, 0, 5);
  Powerups.give(id, CAT.powerups.byId('skyward'), 0);
  Actors.buttons[id] = BTN.JUMP;
  Sim.run(TICK_RATE);
  Actors.buttons[id] = 0;
  check('PU06 flight climbs at 8 m/s', Actors.y[id] > 6 && Actors.y[id] < 9, Actors.y[id]);
  check('PU06 no fall damage while it lasts', powerupLoss(-1, id, 50, { kind: 'fall' }) === 0);
  Powerups.clearActor(id, false);
  Damage.resetHealth(id);
  TestArena.place(id, 0, 0);
  Powerups.give(id, CAT.powerups.byId('aegisbelt'), 0);
  const belt = id * POWERUP_COUNT + CAT.powerups.byId('aegisbelt').index;
  TestArena.hit(-1, id, 30);
  check('PU08 the belt absorbs damage first', Actors.health[id] === 100 && Powerups.charges[belt] === 70, Actors.health[id] + ' / ' + Powerups.charges[belt]);
  TestArena.hit(-1, id, 80);
  Sim.run(1);
  check('PU08 damage past the belt hurts and the spent belt ends', Actors.health[id] === 90 && !Powerups.has(id, 'aegisbelt'), Actors.health[id]);
  const plainMelee = powerupLoss(id, target, 10, { kind: 'melee' });
  Actors.health[id] = 40;
  Powerups.give(id, CAT.powerups.byId('berserk'), 0);
  check('PU09 heals to 100 on pickup', Actors.health[id] === 100, Actors.health[id]);
  check('PU09 melee deals x4', Test.near(powerupLoss(id, target, 10, { kind: 'melee' }), plainMelee * 4, 0.01), plainMelee);
  check('PU09 other damage is unchanged', Test.near(powerupLoss(id, target, 10), powerupLoss(-1, target, 10), 0.01));
  Powerups.clearActor(id, false);
  Powerups.give(id, CAT.powerups.byId('lightbearer'), 0);
  check('PU19 the bearer flame deals x3', Test.near(powerupLoss(id, target, 10), powerupLoss(-1, target, 10) * 3, 0.01));
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0), enemy = ItemArena.actor(2, 0, 20), friend = ItemArena.actor(1, 5, 0), ghost = ItemArena.actor(2, 0, -20);
  Abilities.hiddenFromPulse = (other) => other === ghost;   // the Ghost perk (S13 fills the hook)
  Powerups.give(id, CAT.powerups.byId('seer'), 0);
  Sim.run(2);
  check('PU13 reveals the holder\'s enemies, not friends', Damage.hasStatus(enemy, 'reveal') && !Damage.hasStatus(friend, 'reveal'));
  check('PU13 does not reveal an enemy with the Ghost perk (ECP04)', !Damage.hasStatus(ghost, 'reveal'));
  Powerups.clearActor(id, false);
  const boots = CAT.powerups.byId('springboots');
  Powerups.give(id, boots, 0);
  Actors.vy[id] = 5;
  Bus.emit('move.jump', { id, speed: 5, surface: '' });
  check('PU14 jumps twice as high (speed x the square root of 2)', Test.near(Actors.vy[id], 5 * Math.SQRT2, 1e-4), Actors.vy[id]);
  for (let jump = 1; jump < boots.charges; jump++) Bus.emit('move.jump', { id, speed: 5, surface: '' });
  Sim.run(1);
  check('PU14 ends after its 3 boosted jumps', !Powerups.has(id, 'springboots'));
  Actors.armor[id] = 50;
  Powerups.give(id, CAT.powerups.byId('scoutrune'), 0);
  check('PU16 removes armor and refuses armor pickups', Actors.armor[id] === 0 && !Items.effects.armor(id, CAT.items.byId('lightplate')));
  check('PU16 speed x1.25', Test.near(Move.statusSpeedScale[id], 1.25, 1e-6));
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0), weapon = ItemArena.plainWeapon(), slot = Weapons.slotIndex(id, weapon.index);
  Weapons.give(id, weapon.id, 0);
  Weapons.reserve[slot] = 0;
  Powerups.give(id, CAT.powerups.byId('ammorune'), 0);
  Sim.run(TICK_RATE + 1);
  const share = Math.max(1, Math.round(Weapons.maxReserve(id, weapon) * 0.05));
  check('PU17 5 % of max ammo every second', Weapons.reserve[slot] === share, Weapons.reserve[slot] + ' / ' + share);
  Powerups.clearActor(id, false);
  Actors.health[id] = 50;
  const souls = Powerups.souls[id];
  check('PU18 a soul shard adds a soul and 1 HP', Powerups.give(id, CAT.powerups.byId('soul'), 0) && Powerups.souls[id] === souls + 1 && Actors.health[id] === 51);
  const vital = CAT.powerups.byId('vitalshard');
  Powerups.give(id, vital, 0);
  check('PU20 +25 max health', Actors.maxHealth[id] === 125, Actors.maxHealth[id]);
  for (let shard = 0; shard < 3; shard++) Powerups.give(id, vital, 0);
  check('PU20 max health stops at 200', Actors.maxHealth[id] === vital.instant.vitalHealthCap, Actors.maxHealth[id]);
  Actors.maxArmor[id] = 100;
  Powerups.give(id, vital, 0);
  check('PU20 then raises max armor by 25', Actors.maxArmor[id] === 125, Actors.maxArmor[id]);
  Powerups.give(id, vital, 0); Powerups.give(id, vital, 0);
  check('PU20 max armor stops at 150', Actors.maxArmor[id] === vital.instant.vitalArmorCap && !Powerups.give(id, vital, 0), Actors.maxArmor[id]);
  TestArena.finish();
});

// PU20 Vital Shard spots (audit 28): placed by hand-made maps, they appear only in matches with the Ravager health preset (RS07, RS08, M26).
Test.add('items', (check) => {
  const shardSpots = [ItemArena.spot('vitalshard', 0, 0), ItemArena.spot('healthpack', 4, 0)];
  ItemArena.start({ health: 'ravager' }, shardSpots);
  check('PU20: a Ravager match places the map\'s Vital Shard spots', Items.spotCount === 2 && Items.keyOf(0) === 'vitalshard', Items.spotCount);
  TestArena.finish();
  ItemArena.start({ health: 'stack' }, shardSpots);
  check('PU20: other health presets leave the shard spots out', Items.spotCount === 1 && Items.keyOf(0) === 'healthpack', Items.spotCount);
  TestArena.finish();
  const shardMaps = CAT.maps.filter((map) => map.items.some((item) => item.item === 'vitalshard'));
  const rulesetMaps = ['ravager', 'knight'].every((ruleset) => CAT.rulesets.byId(ruleset).health === CAT.powerups.byId('vitalshard').healthPreset);
  check('PU20: arena and Ravager vs Fiends maps carry shard spots for the Ravager rulesets', rulesetMaps && shardMaps.length >= 5
    && shardMaps.some((map) => map.modes.includes('fiends')) && shardMaps.some((map) => map.modes.includes('duel')), shardMaps.map((map) => map.code).join());
});

Test.add('items', (check) => {
  ItemArena.start({});
  const id = ItemArena.actor(1, 0, 0);
  Powerups.give(id, CAT.powerups.byId('ghostveil'), 0);
  Damage.addStatus(id, 'freeze', -1, 3, 1);
  Sim.run(1);
  check('G08 a frozen Ghostveil holder is not cloaked', !(Actors.flags[id] & ACTOR_FLAG.INVISIBLE) && Items.perceptionScale(id) === 1);
  Sim.run(itemTicks(3) + 2);
  check('the cloak comes back when the freeze ends', (Actors.flags[id] & ACTOR_FLAG.INVISIBLE) !== 0 && Test.near(Items.perceptionScale(id), 0.25, 1e-6));
  TestArena.finish();
});

Test.add('items', (check) => {
  ItemArena.start({}, [ItemArena.spot('healthpack', 3, 0)]);
  const monster = ItemArena.actor(2, 3, 0);
  Actors.kind[monster] = ACTOR_KIND.ENEMY;
  Sim.run(1);
  check('PvE enemies leave pickups alone', Actors.health[monster] === 50 && Items.state[0] === PICKUP_STATE.READY);
  Game.match.rules.params = { enemyPickups: true };
  Sim.run(1);
  check('a mode can let enemies take pickups', Actors.health[monster] === 75, Actors.health[monster]);
  TestArena.finish();
});

// F44 (R-103): going down cancels a heal in progress; a revive does not finish it.
Test.add('items', (check) => {
  ItemArena.start({ downed: true });
  const id = ItemArena.actor(1, 0, 0), mate = ItemArena.actor(1, 3, 0), patch = CAT.items.byId('patch');
  Items.grant(id, 'patch');
  TestArena.hold(id, BTN.HEAL, 0.05);
  check('F44 the heal is running', Items.useProgress(id) >= 0);
  Damage.goDown(-1, id);
  check('F44 going down cancels the heal', Items.useProgress(id) < 0 && Items.consumableCount(id) === 1);
  Sim.run(itemTicks(patch.useTime) + 1);
  Damage.revive(id);
  Sim.run(2);
  check('F44 a revive after the use time heals nothing extra', Actors.health[id] === REVIVE_HEALTH, Actors.health[id]);
  check('F44 the patch is still carried', Items.consumableCount(id) === 1);
  TestArena.finish();
});
