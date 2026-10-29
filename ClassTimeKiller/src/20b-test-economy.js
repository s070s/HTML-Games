// Self-tests for S13 economy and loadouts: money after win / loss sequences per preset (ECP02 round buy with the loss
// ladder and the half reset, ECP07 wave shop, ECP06 ladder), the buy rules (time, zone, money, carry limits), survivors
// keeping bought gear, class perks (ECP04) and the loadouts saved in Save.data.loadouts.

DebugApi.economy = { economy: Economy, loadouts: Loadouts };   // __CTK.economy

TEST_HOOKS.push([Economy.grants, 'gadget'], [Economy.grants, 'grant'], [Abilities, 'carrierCheck'], [Abilities, 'hiddenFromPulse']);

const ECONOMY_HUD = { money: 0, nextRoundMoney: 0, canBuy: false, buyTimeLeft: 0 };
const ROUND_START_MONEY = 800;

const PHASE_WAIT_STEPS = 10 * TICK_RATE;
function runUntilPhase(phase) {
  for (let step = 0; step < PHASE_WAIT_STEPS && Modes.phase !== phase; step++) Sim.step();
}
// Plays one bomb round to its end (victim, the last of its team, is killed by killer once the round is live), then
// waits for the next round's freeze. A kill during the freeze would only count when the round goes live.
function winRound(victim, killer) {
  runUntilPhase(PHASE.LIVE);
  killActor(victim, killer);
  Sim.step();
  runUntilPhase(PHASE.FREEZE);
}
function grantAllGadgets() { Economy.grants.gadget = () => true; }
function firstWeaponForSale(id) {
  return Economy.catalogue(id).find((item) => item.kind === 'weapon' && !Weapons.has(id, item.key)) || null;
}

Test.add('economy', (check) => {
  startBombTest();
  check('ECP02 everyone starts with 800', Economy.money(0) === ROUND_START_MONEY && Economy.money(1) === ROUND_START_MONEY, Economy.money(0) + ' / ' + Economy.money(1));
  killActor(1, 0);
  Sim.step();
  check('ECP02 kill 200 + win 3000 / first loss 1900', Economy.money(0) === 4000 && Economy.money(1) === 2700, Economy.money(0) + ' / ' + Economy.money(1));
  runUntilPhase(PHASE.FREEZE);
  Economy.hudState(1, ECONOMY_HUD);
  check('ECO-001 next-round money shows the next loss bonus', ECONOMY_HUD.nextRoundMoney === 2700 + 2400 && ECONOMY_HUD.money === 2700, ECONOMY_HUD.nextRoundMoney);
  check('ECP02 buy time open at the round start', ECONOMY_HUD.canBuy && Test.near(ECONOMY_HUD.buyTimeLeft, 15, 0.05), ECONOMY_HUD.buyTimeLeft);
  winRound(1, 0);
  check('ECP02 second loss 2400', Economy.money(1) === 5100 && Economy.money(0) === 7200, Economy.money(0) + ' / ' + Economy.money(1));
  winRound(1, 0);
  check('ECP02 third loss 2900, money capped at 9000', Economy.money(1) === 8000 && Economy.money(0) === 9000, Economy.money(0) + ' / ' + Economy.money(1));
  Economy.setMoney(1, 0);
  winRound(1, 0);
  check('ECP02 the ladder stays at its last step', Economy.money(1) === 2900, Economy.money(1));
  Economy.setMoney(0, 0);
  winRound(0, 1);
  check('ECP02 a win resets the loss counter', Economy.lossCount[1] === 0 && Economy.lossCount[0] === 1 && Economy.money(0) === 1900, Economy.lossCount + ' ' + Economy.money(0));
  Economy.setMoney(1, 0);
  runUntilPhase(PHASE.LIVE);
  killActor(1, 0);
  Sim.step();   // round 6 ends; round 7 would start the second half
  check('ECP02 after a win the next loss pays 1900 again', Economy.money(1) === 1900, Economy.money(1));
  endModeTest();
});

// A kill with a weapon (the shared test kill payload carries no weapon otherwise).
function killWith(victim, killer, weaponId) {
  testKill.weapon = weaponId;
  killActor(victim, killer);
  testKill.weapon = '';
}

Test.add('economy', (check) => {
  startModeTest('bomb', modesTestMap(BOMB_MAP), [0, 0, 1, 1], BOMB_OPTIONS);
  runSeconds(1.01);
  const rewards = [['wasp', 600], ['scattergun', 900], ['vanguard', CAT.weapons.byId('vanguard').killReward], ['heron', 100], ['maul', 1500]];
  for (const [weaponId, bonus] of rewards) {
    Economy.setMoney(0, 0);
    killWith(3, 0, weaponId);
    Actors.alive[3] = 1;
    check('ECP02 kill with ' + weaponId + ': 200 + class bonus ' + bonus, Economy.money(0) === 200 + bonus, Economy.money(0));
  }
  for (let id = 0; id < 4; id++) Economy.setMoney(id, 0);
  Actors.alive[1] = 0;
  scorePoints(0, 1, 'plant');
  check('ECP02 a plant pays 300 to every attacker (the dead too)', Economy.money(0) === 300 && Economy.money(1) === 300 && Economy.money(2) === 0, [0, 1, 2].map((id) => Economy.money(id)).join());
  scorePoints(2, 1, 'defuse');
  check('ECP02 a defuse pays 300 to the defuser', Economy.money(2) === 300 && Economy.money(3) === 0, [2, 3].map((id) => Economy.money(id)).join());
  endModeTest();
});

Test.add('economy', (check) => {
  startModeTest('bomb', modesTestMap(BOMB_MAP), [0, 1], { modeOptions: { rounds: { freeze: 1, endDelay: 1, live: 30, switchAt: 1, winsNeeded: 3 } } });
  runSeconds(1.01);
  killActor(1, 0);
  Sim.step();
  check('ECP02 last round of the half: next-round money is the start money', Economy.hudState(0, ECONOMY_HUD).nextRoundMoney === ROUND_START_MONEY, ECONOMY_HUD.nextRoundMoney);
  runSeconds(1);
  check('ECP02 the side switch resets money and the loss ladder', Modes.swapped && Economy.money(0) === ROUND_START_MONEY && Economy.money(1) === ROUND_START_MONEY && Economy.lossCount[1] === 0,
    Economy.money(0) + ' / ' + Economy.money(1));
  endModeTest();
});

Test.add('economy', (check) => {
  startBombTest();
  check('buy: vest', Economy.buy(0, 'vest').ok && Economy.money(0) === 150 && Actors.armor[0] === 100, Economy.money(0) + ' / ' + Actors.armor[0]);
  check('buy: a full vest is owned', Economy.buy(0, 'vest').reason === 'owned');
  check('buy: not enough credits', Economy.buy(0, 'vesthelmet').reason === 'money' && Economy.money(0) === 150);
  check('buy: unknown item', Economy.buy(0, 'nothing').reason === 'unknown');
  check('buy: gadget rows are on sale (S12 delivers them)', Economy.catalogue().some((item) => item.id === 'buyFlash'));
  grantAllGadgets();
  Economy.setMoney(0, 9000);
  const flashes = [Economy.buy(0, 'buyFlash').ok, Economy.buy(0, 'buyFlash').ok, Economy.buy(0, 'buyFlash').reason];
  check('buy: 2 glare shells per life', flashes[0] && flashes[1] && flashes[2] === 'limit', flashes);
  const grenades = [Economy.buy(0, 'buyFrag').ok, Economy.buy(0, 'buySmoke').ok, Economy.buy(0, 'buyFire').reason];
  check('buy: 4 grenades in all (GAD-001)', grenades[0] && grenades[1] && grenades[2] === 'limit', grenades);
  const weapon = firstWeaponForSale(0), before = Economy.money(0);
  check('buy: a priced weapon of the set', !!weapon && Economy.buy(0, weapon.id).ok && Weapons.has(0, weapon.key) && Economy.money(0) === before - weapon.price, weapon && weapon.id);
  check('buy: an owned weapon', Economy.buy(0, weapon.id).reason === 'owned');
  const homeX = Actors.x[0];
  placeActor(0, homeX + 9, Actors.z[0]);
  check('buy: outside the 8 m buy zone', Economy.buy(0, 'vesthelmet').reason === 'zone');
  placeActor(0, homeX, Actors.z[0]);
  Actors.alive[0] = 0;
  check('buy: dead actors cannot buy', Economy.buy(0, 'vesthelmet').reason === 'dead');
  Actors.alive[0] = 1;
  runSeconds(15 - Sim.time - 0.02);
  check('buy: still open just before 15 s', Economy.canBuy(0));
  runSeconds(0.03);
  check('buy: buy time over after 15 s', Economy.buy(0, 'vesthelmet').reason === 'closed' && !Economy.hudState(0, ECONOMY_HUD).canBuy);
  endModeTest();
});

Test.add('economy', (check) => {
  startBombTest();
  Economy.setMoney(0, 9000); Economy.setMoney(1, 9000);
  const kept = firstWeaponForSale(0);
  Economy.buy(0, kept.id); Economy.buy(0, 'vest');
  Economy.buy(1, firstWeaponForSale(1).id);
  const keptSlot = Weapons.slotIndex(0, CAT.weapons.byId(kept.key).index);
  runUntilPhase(PHASE.LIVE);
  Weapons.magazine[keptSlot] = 1; Weapons.reserve[keptSlot] = 2;
  winRound(1, 0);
  check('ECP02 survivors keep bought weapons and armor', Weapons.has(0, kept.key) && Actors.armor[0] === 100, Actors.armor[0]);
  check('ECP02 a kept weapon keeps its ammo, no free refill (modes-09)', Weapons.magazine[keptSlot] === 1 && Weapons.reserve[keptSlot] === 2,
    Weapons.magazine[keptSlot] + '/' + Weapons.reserve[keptSlot]);
  check('ECP02 the dead lose bought weapons', !Weapons.has(1, kept.key));
  endModeTest();
});

// R-134, R-197: survivors keep unused grenades and picked-up weapons; a helmet over a full vest costs only the helmet.
Test.add('economy', (check) => {
  startBombTest();
  Economy.setMoney(0, 1000);
  check('buy: a vest, then the helmet upgrade for 350', Economy.buy(0, 'vest').ok && Economy.buy(0, 'vesthelmet').price === 350 && Economy.money(0) === 0 && Damage.helmet[0] === 1,
    Economy.money(0));
  Economy.setMoney(0, 9000);
  check('buy: one frag charge', Economy.buy(0, 'buyFrag').ok && Gadgets.countOf(0, 'frag') === 1);
  Weapons.give(0, 'heron', 0);   // a picked-up rifle
  winRound(1, 0);
  check('ECP02 a survivor keeps the unused grenade and the picked-up weapon', Gadgets.countOf(0, 'frag') === 1 && Weapons.has(0, 'heron') && Damage.helmet[0] === 1,
    Gadgets.countOf(0, 'frag') + ' ' + Weapons.has(0, 'heron'));
  endModeTest();
});

// R-133, R-135: the Economy panel describes the economy in effect (a mode's params.economy wins); one source per economy rule.
Test.add('economy', (check) => {
  TestArena.start({ economy: 'classes', params: CAT.modes.byId('horde').params });
  const horde = economyPanelLines();
  check('economy panel: Siege Waves shows the wave shop', horde.name === 'Wave Shop' && horde.lines.some((line) => line.includes('shop between waves')) && !horde.lines.some((line) => line.includes('class')),
    horde.lines.join(' | '));
  TestArena.finish();
  TestArena.start({ economy: 'pickups', params: CAT.modes.byId('gungame').params });
  const played = ladderTiers(CAT.modes.byId('gungame').params).length;
  check('economy panel: Arms Ladder names the played ladder length (12)', played === 12 && economyPanelLines().lines.some((line) => line.includes('ladder of ' + played + ' weapons')));
  TestArena.finish();
  TestArena.start({ economy: 'loot', weaponSet: 'lootSet' });
  check('economy panel: loot reads the carry limit of the weapon set', economyPanelLines().lines.some((line) => line.includes('You carry ' + CAT.weaponSets.byId('lootSet').carry + ' weapons')));
  TestArena.finish();
  check('economy rows keep no unread or duplicate fields', ['carryOver', 'slots', 'ammoTypes', 'weaponStay'].every((field) => !(field in Data.schemas.economy)));
});

// R-028: Ghost Ops attackers buy armor and grenades only (params.attackerBuys); the defenders buy anything. Bots read the same list.
Test.add('economy', (check) => {
  startModeTest('ghostops', modesTestMap(BOMB_MAP), [0, 1], { modeOptions: { rounds: { freeze: 1, endDelay: 1, live: 30 } } });
  runSeconds(1.01);
  Economy.setMoney(0, 9000); Economy.setMoney(1, 9000);
  const attackerItems = Economy.catalogue(0).map((item) => item.kind);
  check('ghostops: no weapons on sale to the attackers', attackerItems.length > 0 && !attackerItems.includes('weapon') && Economy.buy(0, 'vanguard').ok === false
    && Economy.limitReason(0, weaponItem('vanguard')) === 'side' && Economy.money(0) === 9000, attackerItems.join());
  check('ghostops: attackers still buy armor and grenades', Economy.buy(0, 'vest').ok && Economy.buy(0, 'buySmoke').ok);
  check('ghostops: defenders buy rifles', Economy.catalogue(1).some((item) => item.kind === 'weapon') && Economy.buy(1, 'vanguard').ok);
  endModeTest();
});

// R-029, R-138: wherever the buy menu has items, buy time opens (round modes at the round start, the others at each spawn).
Test.add('economy', (check) => {
  const versus = CAT.modes.filter((row) => row.family === 'versus' && Modes.isPlayable(row.id) && row.respawn !== 'none');
  for (const mode of versus) {
    const teams = mode.teams === TEAM_COUNT ? [0, 1] : [-1, -1];
    startModeTest(mode.id, modesTestMap(COMBO_MAP), teams, { ruleset: 'tactical', modeOptions: { rounds: mode.rounds ? { freeze: 1, endDelay: 1, live: 30 } : null } });
    runSeconds(1.01);
    const items = Economy.catalogue(0).length;
    check('round buy in ' + mode.id + ': buy time is open while items are on sale', items === 0 || Economy.buyBlock(0) === '', items + ' ' + Economy.buyBlock(0));
    if (Economy.modeArmsEveryone()) check('round buy in ' + mode.id + ': the mode arms everyone, so no weapons are sold', !Economy.catalogue(0).some((item) => item.kind === 'weapon'));
    endModeTest();
  }
  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1], { ruleset: 'tactical' });
  runSeconds(Economy.preset().buyTime);
  check('round buy in ffa: buy time ends buyTime after the spawn', Economy.buyBlock(0) === 'closed');
  killActor(0, 1);
  respawnAll();
  check('round buy in ffa: a respawn opens it again', Actors.alive[0] === 1 && Economy.buyBlock(0) === '' && Economy.hudState(0, ECONOMY_HUD).buyTimeLeft > 0);
  endModeTest();
});

Test.add('economy', (check) => {
  TestArena.start({ economy: 'waveShop' });
  Economy.startHalf();
  const fighter = TestArena.actor(0, 0, 0), rich = TestArena.actor(1, 0, 5), plain = TestArena.actor(1, 5, 5);
  Actors.profile[rich] = { cash: 500 };
  killActor(rich, fighter);
  check('ECP07 kill reward by enemy, clamped to 100', Economy.money(fighter) === 100, Economy.money(fighter));
  killActor(plain, fighter);
  check('ECP07 kill reward default 50', Economy.money(fighter) === 150, Economy.money(fighter));
  Economy.awardWave(0, true);
  check('ECP07 wave 700 + flawless 100', Economy.money(fighter) === 950, Economy.money(fighter));
  check('ECP07 the shop is closed between openings', Economy.buy(fighter, 'ampAmmo').reason === 'closed');
  Economy.setShopOpen(true);
  check('ECP07 buy amp ammo in the shop', Economy.buy(fighter, 'ampAmmo').ok && Economy.money(fighter) === 850);
  check('ECP07 round-buy items are not sold in the shop', Economy.buy(fighter, 'vest').reason === 'unknown');
  const played = ladderTiers(CAT.modes.byId('gungame').params);
  check('ECP06 one ladder: the economy row and the played tiers share GUNGAME_LADDER, no second lookup',
    CAT.economy.byId('ladder').ladder === GUNGAME_LADDER && played[0] === GUNGAME_LADDER[0] && played[played.length - 1] === 'maul' && Economy.ladderWeapon === undefined);
  TestArena.finish();
});

Test.add('economy', (check) => {
  TestArena.start({ economy: 'classes' });
  const rifleman = TestArena.actor(0, 0, 0), assault = TestArena.actor(1, 0, 5), plain = TestArena.actor(1, 5, 0);
  Economy.applyClass(rifleman, CAT.classes.byId('rifleman'));
  Economy.applyClass(rifleman, CAT.classes.byId('rifleman'));
  const base = rifleman * WEAPON_STAT_COUNT;
  check('ECP04 class weapons', Weapons.has(rifleman, 'ratchet') && Weapons.has(rifleman, 'verdict'));
  check('ECP04 perk stats once (Bandolier, Steady)', Test.near(Weapons.statScale[base + STAT.RESERVE], 1.5, 1e-6) && Test.near(Weapons.statScale[base + STAT.SPREAD], 0.7, 1e-6),
    Weapons.statScale[base + STAT.RESERVE]);
  const bullet = { kind: 'hit', mode: CAT.weapons.byId('vanguard').primary };
  TestArena.hit(plain, rifleman, 50, bullet);
  check('ECP04 Hardened: -20% bullet damage', Test.near(Actors.health[rifleman], 60, 1e-3), Actors.health[rifleman]);
  Economy.applyClass(assault, CAT.classes.byId('assault'));
  Damage.resetHealth(rifleman);
  TestArena.hit(assault, rifleman, 50, bullet);
  check('ECP04 Stopping +20% and cancels Hardened', Test.near(Actors.health[rifleman], 40, 1e-3), Actors.health[rifleman]);
  Economy.applyClass(assault, CAT.classes.byId('support'));
  check('ECP04 Tune Up speeds the field upgrade', Abilities.rechargeScale[assault] === 1.5);
  Economy.applyClass(assault, CAT.classes.byId('scout'));
  check('ECP04 Hardline and Ghost', Meters.streakDiscount[assault] === 100 && Abilities.hiddenFromPulse(assault) && Abilities.rechargeScale[assault] === 1);
  Economy.clearPerks(rifleman);
  check('ECP04 clearing perks restores the stats', Test.near(Weapons.statScale[base + STAT.RESERVE], 1, 1e-6) && Economy.taken[rifleman] === 1);
  TestArena.finish();
});

// Perk texts restate their tuning numbers: every number in a text must follow from the row (a percent of a factor, the factor,
// its inverse or the value), so a balance change cannot leave a stale text behind (normalize-06).
Test.add('economy', (check) => {
  const stale = CAT.perks.filter((perk) => {
    const shown = Object.values(perk.stats).concat([perk.dealt, perk.taken, perk.value]).flatMap((n) => [Math.round(Math.abs(n - 1) * 100), n, Math.round(100 / n) / 100]);
    return (perk.text.match(/\d+(\.\d+)?/g) || []).some((text) => !shown.includes(Number(text)));
  });
  check('every number in a perk text follows from its stats or value', stale.length === 0, stale.map((perk) => perk.id).join());
});

// P3-01: every ruleset with classes arms them from the whole roster (RS12 Frame Runner included): no swap table, no themed set.
Test.add('economy', (check) => {
  World.load(modesTestMap({ spawns: TEAM_SPAWNS }));
  Game.start({ mode: 'tdm', ruleset: 'frame', seed: 1, bots: CAT.classes.map((row, index) => ({ dummy: true, team: index % 2 })) });
  Economy.applyClass(0, CAT.classes.byId('marksman'));
  check('frame: classes carry their own weapons (Marksman: Kestrel DMR, Verdict Magnum)', Weapons.has(0, 'kestrel') && Weapons.has(0, 'verdict') && Weapons.has(1, Loadouts.classFor(1).primary), '');
  const card = makeElement('div');
  describeClass(card, CAT.classes.byId('marksman'));
  check('frame: the class card names the weapons the class spawns with', card.textContent.includes(weaponName('kestrel')) && card.textContent.includes(weaponName('verdict')), card.textContent);
  // The class editor offers the whole roster: every gun that is not a sidearm as a primary, every sidearm as a secondary.
  const guns = CAT.weapons.filter((row) => !['melee', 'sidearm', 'tool', 'power'].includes(row.class)).map((row) => row.id);
  check('classes: the editor offers every gun and every sidearm of the roster', CLASS_FIELD_OPTIONS.primary().join() === guns.join() && guns.length === 27
    && CLASS_FIELD_OPTIONS.secondary().join() === 'warden,verdict,hush,sparklock', CLASS_FIELD_OPTIONS.primary().length + ' ' + CLASS_FIELD_OPTIONS.secondary().join());
  endModeTest();
  const perks = ['bandolier', 'ghost', 'steady'];
  check('classes: a power weapon, a tool, a melee weapon or a sidearm as the primary is refused', Loadouts.saveClass({ primary: 'daybreak', secondary: 'hush', perks }) === null
    && Loadouts.saveClass({ primary: 'lifter', secondary: 'warden', perks }) === null && Loadouts.saveClass({ primary: 'maul', secondary: 'warden', perks }) === null
    && Loadouts.saveClass({ primary: 'warden', secondary: 'verdict', perks }) === null, Loadouts.lastError);
  const wide = Loadouts.saveClass({ name: 'Wide', primary: 'shardcaster', secondary: 'hush', perks });
  check('classes: a gun outside the old Military set is accepted now', !!wide);
  if (wide) Loadouts.removeClass(wide.id);
});

Test.add('economy', (check) => {
  check('loadouts: created on first use', Loadouts.selectedClass().id === CAT.classes[0].id && !!Save.data.loadouts);
  check('loadouts: the secondary must be a sidearm', Loadouts.saveClass({ primary: 'vanguard', secondary: 'ratchet', perks: ['bandolier', 'ghost', 'steady'] }) === null && !!Loadouts.lastError);
  check('loadouts: the field upgrade comes from the ECP04 list', Loadouts.saveClass({ primary: 'vanguard', secondary: 'warden', perks: ['bandolier', 'ghost', 'steady'], fieldUpgrade: 'orbital' }) === null);
  check('loadouts: one perk per tier', Loadouts.saveClass({ primary: 'vanguard', secondary: 'warden', perks: ['bandolier', 'scavenger', 'steady'] }) === null);
  const stored = Loadouts.saveClass({ name: 'Mine', primary: 'vanguard', secondary: 'warden', perks: ['bandolier', 'ghost', 'steady'] });
  check('loadouts: custom class saved', !!stored && stored.id === 'class-1' && Loadouts.selectClass('class-1'));
  check('loadouts: hero and kit choice', Loadouts.setHero('quill') && Loadouts.setKitChoice('suit', 'ability2', 'colossusweave') && !Loadouts.setKitChoice('suit', 'ability2', 'orbital'));
  Save.saveNow();
  Save.data = null;
  Save.load();
  check('loadouts: restored from storage', Loadouts.selectedClass().name === 'Mine' && Loadouts.hero().id === 'quill' && Loadouts.kitChoice('suit').ability2 === 'colossusweave');
  for (let i = 0; i < 10; i++) Loadouts.saveClass({ name: 'Extra', primary: 'vanguard', secondary: 'warden', perks: ['bandolier', 'ghost', 'steady'] });
  check('loadouts: at most 10 custom classes', Save.data.loadouts.classes.custom.length === 10 && !!Loadouts.lastError);
  check('loadouts: removing the selected class selects a preset', Loadouts.removeClass('class-1') && Loadouts.selectedClass().id === CAT.classes[0].id);
  TestArena.start({ economy: 'heroKits', health: 'hero', meter: 'ultimate' });
  const player = Actors.create(ACTOR_KIND.PLAYER, 0, 'player');
  Actors.alive[player] = 1;
  Abilities.onSpawn(player);
  check('loadouts: the player gets the saved hero', Abilities.heroOf(player).id === 'quill' && Abilities.row(player, SLOT.ULTIMATE).id === CAT.heroes.byId('quill').ultimate);
  Economy.spawnX[player] = Actors.x[player]; Economy.spawnZ[player] = Actors.z[player];
  check('ECP05 hero switch in the spawn room is instant', Economy.switchHero(player, 'lark') === 'now' && Abilities.heroOf(player).id === 'lark' && Actors.maxHealth[player] === CAT.heroes.byId('lark').health);
  Actors.x[player] += 20;
  check('ECP05 hero switch away from spawn waits for the next spawn', Economy.switchHero(player, 'brask') === 'next' && Abilities.heroOf(player).id === 'lark');
  TestArena.finish();
});

// ---- Buy menu and loadout editor (DOM screens) ----
const buyMenuAction = { action: 'buyMenu', down: true };

Test.add('economy', (check) => uiWith(() => {
  startModeTest('bomb', modesTestMap(BOMB_MAP), [1], Object.assign({ player: { team: 0 } }, BOMB_OPTIONS));
  runSeconds(1.01);
  const player = Game.playerId;
  check('buy menu: pause rows only in buying matches', Ui.pauseEntries.includes(BUY_PAUSE_ENTRY) && BUY_PAUSE_ENTRY.when() && !LOADOUT_PAUSE_ENTRY.when());
  Bus.emit('input.action', buyMenuAction);
  check('buy menu: B opens it during buy time', Ui.current() === 'buy' && BuyMenu.entries.length === Economy.catalogue().length);
  check('buy menu: shows credits and the loss ladder', uiScreenText('buy').includes('800 cr') && uiScreenText('buy').includes('Loss bonus'));
  uiKey('Digit1');
  check('buy menu: hotkey 1 buys the first item', Economy.money(player) === 150 && Actors.armor[player] === 100, Economy.money(player));
  const helmet = BuyMenu.entries.find((entry) => entry.item.id === 'vesthelmet').button;
  Economy.setMoney(player, 400);
  BuyMenu.refresh();
  check('buy menu: the helmet over a full vest shows its upgrade price', helmet.textContent.includes(formatCredits(350)) && !helmet.classList.contains('off'), helmet.textContent);
  uiKey('KeyB');
  check('buy menu: B closes it', Ui.stack.length === 0);
  Ui.open('buy');
  runSeconds(15);
  BuyMenu.tick();
  check('buy menu: closes itself when buy time ends', Ui.stack.length === 0);
  endModeTest();
}));

Test.add('economy', (check) => uiWith(() => {
  Ui.open('loadout');
  check('loadout: opens on the classes tab outside a match', Ui.current() === 'loadout' && LoadoutMenu.tab === 'classes');
  uiClickButton(Ui.top().element, 'New custom class');
  check('loadout: the class editor opens', Ui.current() === 'classEditor');
  uiClickButton(Ui.top().element, 'Save');
  check('loadout: saving stores and selects the custom class', Ui.current() === 'loadout' && Loadouts.selectedClass().id === 'class-1' && Save.data.loadouts.classes.custom.length === 1);
  LoadoutMenu.show('heroes');
  check('loadout: the hero tab lists the hero', uiScreenText('loadout').includes(Loadouts.hero().name));
  LoadoutMenu.show('kits');
  check('loadout: the kit tab lists every kit with choices', CAT.abilityKits.filter((kit) => kit.id !== 'classes').every((kit) => uiScreenText('loadout').includes(kit.name)));
}));
