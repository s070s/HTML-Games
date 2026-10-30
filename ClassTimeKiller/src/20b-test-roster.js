// Self-tests for the P3 roster: the retired weapon / gadget / item / ability ids and the save migration, no two weapons sharing a
// profile, what every ruleset lets the player reach (P3-01 / P3-05), and the starting loadout and locked entries (P3-07).

// Retired ids with their successors (04-save): every one must be gone from its catalogue and the successor must exist.
const RETIRED_WEAPONS = ['twinsting', 'riptide', 'tempest', 'longshot', 'pulsecarbine', 'frostbore', 'anvil', 'kingfisher'];
const RETIRED_GADGETS = ['decoy', 'prox', 'bubble', 'liftpad', 'regen', 'drain', 'dart'];
const RETIRED_ITEMS = ['surplus', 'aegisbelt', 'scoutrune', 'ammorune'];
const RETIRED_ABILITIES = ['ignite', 'frostlance'];

Test.add('roster', (check) => {
  check('38 weapons (36 combat + 2 tools)', CAT.weapons.length === 38 && CAT.weapons.filter((row) => row.class !== 'tool').length === 36, CAT.weapons.length);
  check('17 gadgets: 3 lethal, 6 tactical, 8 devices', CAT.gadgets.length === 17 && ['lethal', 'tactical', 'device'].map((slot) => CAT.gadgets.filter((row) => row.slot === slot).length).join() === '3,6,8',
    CAT.gadgets.length);
  check('33 items: 17 pickups + 16 powerups', CAT.items.length === 17 && CAT.powerups.length === 16, CAT.items.length + ' + ' + CAT.powerups.length);
  check('45 abilities: 38 A-rows + 7 AX rewards', CAT.abilities.length === 45 && CAT.abilities.filter((row) => row.code.startsWith('AX')).length === 7, CAT.abilities.length);
  const leftovers = RETIRED_WEAPONS.filter((key) => CAT.weapons.byId(key)).concat(RETIRED_GADGETS.filter((key) => CAT.gadgets.byId(key)),
    RETIRED_ITEMS.filter((key) => CAT.items.byId(key) || CAT.powerups.byId(key)), RETIRED_ABILITIES.filter((key) => CAT.abilities.byId(key)));
  check('no retired id is left in a catalogue', leftovers.length === 0, leftovers.join());
  const missing = [];
  for (const key in WEAPON_MIGRATION) if (!CAT.weapons.byId(WEAPON_MIGRATION[key])) missing.push(key);
  for (const key in GADGET_MIGRATION) if (!CAT.gadgets.byId(GADGET_MIGRATION[key]) && !CAT.abilities.byId(GADGET_MIGRATION[key])) missing.push(key);
  for (const key in ITEM_MIGRATION) if (!CAT.items.byId(ITEM_MIGRATION[key]) && !CAT.powerups.byId(ITEM_MIGRATION[key])) missing.push(key);
  for (const key in ABILITY_MIGRATION) if (!CAT.abilities.byId(ABILITY_MIGRATION[key])) missing.push(key);
  check('every migration target exists', missing.length === 0, missing.join());
  check('the migration maps cover exactly the retired ids (keys and codes)', RETIRED_WEAPONS.concat(RETIRED_WEAPON_CODES).every((key) => key in WEAPON_MIGRATION)
    && RETIRED_GADGETS.every((key) => key in GADGET_MIGRATION) && RETIRED_ITEMS.every((key) => key in ITEM_MIGRATION) && RETIRED_ABILITIES.every((key) => key in ABILITY_MIGRATION));
});

// An old save naming every retired weapon, ability and pad item loads with their successors (no error, nothing lost).
Test.add('roster', (check) => {
  const draft = { weaponList: ['longshot', 'kestrel', 'W33'], mutators: [{ id: 'weaponset', value: ['tempest', 'vanguard', 'frostbore'] }] };
  const old = {
    version: 1, revision: 3, settings: { 'custom.draft': JSON.stringify(draft) },
    stats: { weapons: { tempest: { shots: 10, hits: 5, kills: 30, headshots: 4 }, vanguard: { shots: 1, hits: 1, kills: 5, headshots: 1 }, riptide: { kills: 80, headshots: 20 },
      wasp: { shots: 2, hits: 1, kills: 1, headshots: 0 }, anvil: { shots: 3, hits: 3, kills: 150, headshots: 40 } } },
    crosshairs: { anvil: { style: 'dot' }, hailstorm: { style: 'ring' }, twinsting: { style: 'cross' } },
    loadouts: { classes: { selected: 'assault', custom: [{ id: 'class-1', name: 'Old', primary: 'longshot', secondary: 'hush', perks: ['bandolier', 'ghost', 'steady'], lethal: '', tactical: '', fieldUpgrade: 'echopulse' },
      { id: 'class-2', name: 'Old 2', primary: 'tempest', secondary: 'warden', perks: ['bandolier', 'ghost', 'steady'], lethal: '', tactical: '', fieldUpgrade: 'echopulse' }] },
      heroes: { hero: 'quill' }, kits: { frame: { ability2: 'ignite' }, powers: { ability1: 'frostlance' }, suit: { ability1: 'bulwark' } } },
    rulesets: [{ id: 'custom-1', name: 'Old', mutators: [], editor: { weaponList: ['kingfisher', 'ramjet', 'pulsecarbine'], mutators: [{ id: 'weaponset', value: ['W08', 'wasp'] }] } }],
    editorMaps: [{ id: 'user1', name: 'Old map', modes: ['ffa'], bytes: 10, data: { items: [['tempest', 0, 0, 0], ['surplus', 1, 0, 0, ['ffa']], ['healthpack', 2, 0, 0], ['scoutrune', 3, 0, 0]] } }],
  };
  const errors = ErrorLog.total;
  const saved = Save.data;
  const migrated = Save.migrate(JSON.parse(JSON.stringify(old)));
  const weapons = migrated.stats.weapons;
  check('migrate: stats of a retired weapon move into its successor, nothing lost', !weapons.tempest && !weapons.riptide && !weapons.anvil
    && weapons.vanguard.kills === 35 && weapons.vanguard.headshots === 5 && weapons.vanguard.shots === 11 && weapons.wasp.kills === 81 && weapons.hailstorm.kills === 150, JSON.stringify(weapons));
  Save.data = migrated;
  check('migrate: a mastery tier already reached is kept (Gold on the Hailstorm from the Anvil)', Progress.masteryOf('hailstorm') === masteryTierIndex('gold'), Progress.masteryOf('hailstorm'));
  Save.data = saved;
  const crosshairs = migrated.crosshairs;
  check('migrate: a crosshair override moves to the successor unless that has its own', !crosshairs.anvil && !crosshairs.twinsting && crosshairs.hailstorm.style === 'ring' && crosshairs.wasp.style === 'cross', JSON.stringify(crosshairs));
  const classes = migrated.loadouts.classes.custom;
  check('migrate: custom classes name the successor weapons', classes[0].primary === 'kestrel' && classes[0].secondary === 'hush' && classes[1].primary === 'vanguard');
  const kits = migrated.loadouts.kits;
  check('migrate: kit choices of retired abilities become Arc Bolt, others stay', kits.frame.ability2 === 'arcbolt' && kits.powers.ability1 === 'arcbolt' && kits.suit.ability1 === 'bulwark', JSON.stringify(kits));
  const preset = migrated.rulesets[0].editor;
  check('migrate: a saved match keeps its weapon list, mapped and without repeats (keys and codes)', preset.weaponList.join() === 'ramjet,hornet' && preset.mutators[0].value.join() === 'wasp', preset.weaponList.join() + ' / ' + preset.mutators[0].value.join());
  const items = migrated.editorMaps[0].data.items;
  check('migrate: a saved map keeps its pads with the successor item keys', items.map((row) => row[0]).join() === 'vanguard,megacell,healthpack,quickening' && items[1][4].join() === 'ffa', items.map((row) => row[0]).join());
  const text = JSON.parse(migrated.settings['custom.draft']);
  check('migrate: the editor draft kept in the settings is mapped too', text.weaponList.join() === 'kestrel,ramjet' && text.mutators[0].value.join() === 'vanguard,scattergun', migrated.settings['custom.draft']);
  check('migrate: the loadout of a migrated save is complete', Object.keys(DEFAULT_PICKUP_LOADOUT).every((slot) => typeof migrated.loadouts.pickup[slot] === 'string'));
  const again = Save.migrate(JSON.parse(JSON.stringify(migrated)));
  check('migrate: running it again changes nothing', JSON.stringify(again) === JSON.stringify(migrated));
  check('migrate: an old map pad row builds with the successor key and its group', MapKit.item(['tempest', 1, 2, 3]).item === 'vanguard' && MapKit.item(['surplus', 1, 2, 3]).group === 'health'
    && MapKit.item(['longshot', 1, 2, 3, ['ffa']]).group === 'weapon', MapKit.item(['surplus', 1, 2, 3]).group);
  check('migrate: loading the old save logged no error', ErrorLog.total === errors);
});

// No two weapons share a profile (P3-03): class, primary and alt differ in damage, rate, trigger, projectile or mechanic.
Test.add('roster', (check) => {
  const profile = (weapon) => [weapon.class, weapon.primary.type, weapon.primary.trigger, weapon.primary.damage, weapon.primary.rate, weapon.primary.pellets, weapon.primary.projectile,
    weapon.alt.type, weapon.alt.trigger, weapon.alt.damage, weapon.alt.rate, weapon.alt.projectile, weapon.alt.zoom, weapon.alt.status ? weapon.alt.status.id : ''].join('|');
  const seen = new Map(), same = [];
  for (const weapon of CAT.weapons) {
    const key = profile(weapon);
    if (seen.has(key)) same.push(seen.get(key) + ' = ' + weapon.id);
    seen.set(key, weapon.id);
  }
  check('no two weapons share a profile', same.length === 0, same.join(', '));
  const pairs = [];
  for (let first = 0; first < CAT.weapons.length; first++) {
    for (let second = first + 1; second < CAT.weapons.length; second++) {
      const a = CAT.weapons[first], b = CAT.weapons[second];
      if (a.class === b.class && a.primary.type === b.primary.type && a.primary.trigger === b.primary.trigger && a.primary.damage === b.primary.damage
        && a.primary.rate === b.primary.rate && a.alt.type === b.alt.type && a.alt.projectile === b.alt.projectile) pairs.push(a.id + '/' + b.id);
    }
  }
  check('no two weapons of a class share primary damage and rate with the same alt', pairs.length === 0, pairs.join(', '));
  const hush = CAT.weapons.byId('hush'), warden = CAT.weapons.byId('warden');
  check('Hush is a silent precision pistol: slower, harder, headshots x2.5, no tracer, noise 6', hush.primary.rate < warden.primary.rate && hush.primary.damage > warden.primary.damage
    && hush.primary.headMult === 2.5 && hush.primary.tracer === false && hush.noise === 6 && warden.primary.tracer === true);
  const stake = CAT.weapons.byId('stakedriver');
  check('Stakedriver alt is the only burn (P8-04 O1): a stake that burns at any range, the primary pins without burning', stake.alt.projectile === 'stake' && stake.alt.status.id === 'burn' && stake.alt.statusRange === 0 && !stake.primary.status && stake.primary.statusRange === 0);
  check('Ramjet alt is the lock-on homing volley, Wasp alt the hollow-point toggle, Kestrel holds 15', CAT.weapons.byId('ramjet').alt.type === 'lock' && CAT.weapons.byId('ramjet').alt.lock.time === 1.2
    && CAT.weapons.byId('wasp').alt.type === 'toggle' && CAT.weapons.byId('kestrel').mag === 15);
  const unpriced = CAT.weapons.filter((weapon) => ['sidearm', 'smg', 'rifle', 'shotgun', 'marksman', 'sniper', 'energy', 'heavy', 'explosive', 'exotic'].includes(weapon.class) && weapon.id !== 'warden' && !(weapon.price > 0));
  check('every buyable gun has a price (the 19 that had none included)', unpriced.length === 0, unpriced.map((weapon) => weapon.id).join());
});

// Access (P3-01 / P3-05): what each ruleset hands the player in a running match.
const ROSTER_RULESET_ACCESS = {
  // id: [weapon set, ability access, ability kit id ('' = none)]
  classic: ['fullSet', 'none', ''], tourney: ['fullSet', 'none', ''], tactical: ['fullSet', 'none', ''], modern: ['fullSet', 'kit', 'classes'], pilot: ['fullSet', 'kit', 'classes'],
  vanguard: ['fullSet', 'loadout', 'loadout'], ravager: ['fullSet', 'loadout', 'loadout'], knight: ['fullSet', 'loadout', 'loadout'], heroes: ['', 'kit', ''],
  royale: ['lootSet', 'loadout', 'loadout'], suit: ['fullSet', 'kit', 'suit'], frame: ['fullSet', 'loadout', 'frame'],
};
const ROSTER_PICKUP_RULESETS = ['classic', 'tourney', 'vanguard', 'ravager', 'knight', 'suit'];
function rosterMatch(ruleset, mode, seed) {
  return startModeTest(mode || 'tdm', modesTestMap({ spawns: TEAM_SPAWNS }), [1], { ruleset, seed: seed || 1, player: { name: 'Me', team: 0 } });
}
// The spawn guns of one bot without a favourite in a fresh match of this seed.
function rosterBotKeys(seed) {
  rosterMatch('classic', 'tdm', seed);
  const bot = Actors.create(ACTOR_KIND.BOT, 1, 'bot');
  Bots.profile[bot] = null;
  const keys = Loadouts.startKeys(bot).join();
  endModeTest();
  return keys;
}

Test.add('roster', (check) => {
  const guns = CAT.weapons.filter((row) => !['melee', 'sidearm', 'tool', 'power'].includes(row.class)).map((row) => row.id);
  const wrong = [];
  for (const row of CAT.rulesets) {
    const expected = ROSTER_RULESET_ACCESS[row.id];
    if (row.weaponSet !== expected[0] || row.abilities !== expected[1]) wrong.push(row.id + ' ' + row.weaponSet + '/' + row.abilities);
  }
  check('every ruleset names the whole roster (Last Ring its loot pool, heroes their kit) and its ability access', wrong.length === 0, wrong.join(', '));
  check('the full roster set holds all 38 weapons, the loot pool every gun with rarity', CAT.weaponSets.byId('fullSet').weapons.length === 38 && guns.every((key) => CAT.weaponSets.byId('lootSet').weapons.includes(key))
    && CAT.weaponSets.byId('lootSet').rarity === true);
  check('the themed sets stay as presets (Arena, Tactical, Military, Sandbox, Ravager, Knight, Loot, Exotic)', ['arenaSet', 'tacticalSet', 'militarySet', 'sandboxSet', 'ravagerSet', 'knightSet', 'lootSet', 'exoticSet'].every((id) => CAT.weaponSets.byId(id)));
  for (const row of CAT.rulesets) {
    const expected = ROSTER_RULESET_ACCESS[row.id];
    rosterMatch(row.id, row.id === 'heroes' ? 'tdm' : 'tdm');
    const kit = Abilities.kitOf(Game.playerId), kitId = kit && !Abilities.usesHeroes() ? kit.id : '';
    check('ruleset ' + row.id + ': the ability kit is "' + (expected[2] || 'none') + '"', kitId === expected[2], kitId);
    if (ROSTER_PICKUP_RULESETS.includes(row.id)) {
      check('ruleset ' + row.id + ': the loadout gun slots offer all 34 pickable weapons', Loadouts.usesPickupLoadout() && PICKUP_SLOTS.slice(0, 3).flatMap((slot) => Loadouts.pickupOptions(slot)).length === 34);
      check('ruleset ' + row.id + ': the player spawns with the saved loadout', Weapons.has(0, 'maul') && Weapons.has(0, 'warden') && Weapons.currentWeapon(0).id === 'hornet', Weapons.currentWeapon(0).id);
    }
    endModeTest();
  }
});

Test.add('roster', (check) => {
  rosterMatch('tactical');
  const priced = CAT.weapons.filter((row) => row.price > 0 && !['melee', 'tool', 'power'].includes(row.class)).map((row) => row.id);
  const listed = Economy.catalogue(0).filter((item) => item.kind === 'weapon').map((item) => item.key);
  check('Tactical Breach: the buy menu lists every priced gun of the roster', listed.length === priced.length && priced.every((key) => listed.includes(key)) && priced.length >= 30, listed.length + ' of ' + priced.length);
  check('Tactical Breach: no ability kit, the carry limit of 2 stays', Abilities.kitOf(0) === null && Weapons.carryLimit() === 2);
  endModeTest();
  rosterMatch('modern');
  const options = CLASS_FIELD_OPTIONS.primary();
  check('Modern Ops: a class picks any gun of the roster', options.length === 27 && options.includes('hailstorm') && !options.includes('daybreak') && Weapons.carryLimit() === 2);
  endModeTest();
  rosterMatch('classic');
  check('Arena Classic: unlimited arsenal, pads keep the map\'s own gun', Weapons.carryLimit() === 0 && Items.spotWeapon('lancet') === 'lancet' && Items.spotWeapon('hailstorm') === 'hailstorm');
  endModeTest();
  rosterMatch('tourney');
  const kit = Abilities.kitOf(0);
  check('Arena Tournament: no ability loadout unless Powers for all is on', kit === null);
  endModeTest();
  startModeTest('tdm', modesTestMap({ spawns: TEAM_SPAWNS }), [1], { ruleset: 'classic', mutators: [{ id: 'powers', value: true }] });
  check('Powers for All switches an ability on in Arena Classic', Abilities.kitOf(0) && Abilities.kitOf(0).id === 'powers');
  endModeTest();
  startModeTest('gungame', modesTestMap({ spawns: FFA_SPAWNS }), [-1], { ruleset: 'classic' });
  check('Gun Game: the loadout is off and a weapon says why', !Loadouts.usesPickupLoadout() && Loadouts.restriction('vanguard') !== '' && Loadouts.startKeys(0).join() === CAT.weaponSets.byId('fullSet').start.join());
  endModeTest();
  rosterMatch('classic');
  check('restrictions: power weapons and tools stay out of the loadout with their reason', Loadouts.restriction('daybreak') === 'Power weapons come from map pads' && Loadouts.restriction('lifter') !== ''
    && Loadouts.restriction('vanguard') === '');
  endModeTest();
  rosterMatch('heroes');
  check('Hero Squad: the heroes carry their own weapons, the loadout says so', Loadouts.restriction('vanguard') === 'Heroes carry their own weapons' && !Loadouts.usesPickupLoadout());
  endModeTest();
});

// Bots build their own loadout from the whole roster: a favourite that fits, else a gun that suits the map; a seeded match repeats it.
Test.add('roster', (check) => {
  rosterMatch('classic');
  const bot = Actors.create(ACTOR_KIND.BOT, 1, 'bot');
  Bots.profile[bot] = CAT.bots.byId('okoro');   // favourite: the Vanguard
  const first = Loadouts.startKeys(bot);
  check('a bot spawns with melee, sidearm and its favourite as the drawn gun', first.length === 3 && first[0] === 'maul' && CAT.weapons.byId(first[1]).class === 'sidearm' && first[2] === 'vanguard', first.join());
  Bots.profile[bot] = CAT.bots.byId('pell');   // favourite: a sidearm
  const sidearm = Loadouts.startKeys(bot);
  check('a sidearm favourite becomes the secondary, the primary then suits the map', sidearm[1] === 'warden' && CAT.weapons.byId(sidearm[2]).class !== 'sidearm' && CAT.weapons.byId(sidearm[2]).class !== 'melee', sidearm.join());
  Bots.profile[bot] = null;
  const drawn = Loadouts.startKeys(bot);
  check('without a favourite the pick is a roster gun', pickupSlotOptions('primary').includes(drawn[2]), drawn.join());
  endModeTest();
  const seeds = [1, 2, 3, 4, 5, 6].map(rosterBotKeys);
  check('a fresh match of the same seed repeats the pick, other seeds vary it', rosterBotKeys(3) === seeds[2] && rosterBotKeys(1) === seeds[0] && new Set(seeds).size >= 3, seeds.join(' | '));
  rosterMatch('classic');
  const kinds = new Set();
  for (let id = 0; id < 40; id++) kinds.add(botPrimaryForMap(id));
  check('across bots the picks vary and every one is a primary of the roster (P8-04: one-round launchers and exotics are in the draw)', kinds.size >= 4 && Array.from(kinds).every((key) => pickupSlotOptions('primary').includes(key)), Array.from(kinds).join());
  check('a short fight reaches the short guns, a long one does not (the pool follows the range bands)', botGunPool('primary', 8).some((weapon) => weapon.id === 'hookjaw') && !botGunPool('primary', 20).some((weapon) => weapon.id === 'hookjaw')
    && botGunPool('primary', 25).some((weapon) => weapon.id === 'fusionmortar') && !botGunPool('primary', 40).some((weapon) => weapon.id === 'fusionmortar'));
  const secondaries = new Set();
  for (let id = 0; id < 40; id++) secondaries.add(botGunForSlot(id, 'secondary'));
  check('bots draw their sidearm from the four sidearms, not always the Warden', secondaries.size >= 3 && Array.from(secondaries).every((key) => CAT.weapons.byId(key).class === 'sidearm'), Array.from(secondaries).join());
  endModeTest();
});

// P3-07: a new save has a ready default loadout that works in the first match, and every pick is checked.
Test.add('roster', (check) => {
  const keep = Save.data;
  Save.data = Save.emptySave();
  const fresh = Save.data.loadouts.pickup;
  check('a fresh save holds the default loadout: Breaker Maul, Hornet Carbine, Warden Pistol, Frag Charge, Glare Shell, Barrier Deploy',
    ['maul', 'hornet', 'warden', 'frag', 'flash', 'cover'].join() === [fresh.melee, fresh.primary, fresh.secondary, fresh.lethal, fresh.tactical, fresh.device].join(), JSON.stringify(fresh));
  check('every default pick fits its slot', PICKUP_SLOTS.every((slot) => Loadouts.pickupOptions(slot).includes(fresh[slot])));
  const loadoutKit = CAT.abilityKits.byId('loadout');
  check('the ability kit defaults are Surge Dash and Rally Cry, both on the pick lists', loadoutKit.ability1 === 'surge' && loadoutKit.ultimate === 'rally' && loadoutKit.choices.ability1.includes('surge') && loadoutKit.choices.ultimate.includes('rally'));
  rosterMatch('vanguard');
  check('first match: guns, gear and abilities are in hand without a loadout screen', Weapons.has(0, 'maul') && Weapons.has(0, 'hornet') && Weapons.has(0, 'warden') && Gadgets.countOf(0, 'frag') === 2
    && Gadgets.countOf(0, 'flash') === 2 && Gadgets.countOf(0, 'cover') === 1 && Abilities.row(0, SLOT.ABILITY1).id === 'surge' && Abilities.row(0, SLOT.ULTIMATE).id === 'rally',
    Weapons.currentWeapon(0).id + ' ' + Gadgets.countOf(0, 'frag') + Gadgets.countOf(0, 'flash') + Gadgets.countOf(0, 'cover'));
  check('the drawn gun is the primary', Weapons.currentWeapon(0).id === 'hornet');
  endModeTest();
  check('picks are checked: a power weapon, a tool or the wrong slot is refused, a valid one is kept', !Loadouts.setPickup('primary', 'daybreak') && !Loadouts.setPickup('primary', 'lifter')
    && !Loadouts.setPickup('secondary', 'vanguard') && !Loadouts.setPickup('lethal', 'cover') && !Loadouts.setPickup('nothing', 'maul') && Loadouts.setPickup('primary', 'hailstorm') && Loadouts.pickedKey('primary') === 'hailstorm');
  Loadouts.setPickup('lethal', 'sticky'); Loadouts.setPickup('device', 'sentry'); Loadouts.setPickup('melee', 'tanto');
  rosterMatch('classic');
  check('the next spawn uses the picks (Hailstorm, Edge Tanto, Leech Charge, Picket Turret)', Weapons.has(0, 'hailstorm') && Weapons.has(0, 'tanto') && !Weapons.has(0, 'hornet') && Gadgets.countOf(0, 'sticky') > 0 && Gadgets.countOf(0, 'sentry') === 1);
  endModeTest();
  fresh.primary = 'nonsense';
  check('an edited save falls back to the default for that slot', Loadouts.pickedKey('primary') === 'hornet');
  Loadouts.resetPickup();
  check('reset gives the default loadout back', Object.keys(DEFAULT_PICKUP_LOADOUT).every((slot) => Loadouts.pickedKey(slot) === DEFAULT_PICKUP_LOADOUT[slot]));
  Save.data = keep;
});

// P3-07: a locked entry shows what it asks for and the player's progress.
Test.add('roster', (check) => uiWith(() => {
  const keep = Save.data;
  Save.data = Save.emptySave();
  const nine = CAT.unlocks.find((row) => row.level === 8 && !row.mastery);
  const text = Progress.requirementText(nine);
  check('a level unlock says its level, the player\'s level and XP', text.includes('Level 8') && text.includes('you are level 1') && text.includes('0 /'), text);
  check('an unlocked row has no requirement', Progress.requirementText(CAT.unlocks.find((row) => row.level === 1 && !row.mastery)) === '');
  const gold = CAT.unlocks.find((row) => row.mastery === 'gold');
  Save.data.stats.weapons = { vanguard: { kills: 37, headshots: 12, shots: 0, hits: 0 }, wasp: { kills: 10, headshots: 9, shots: 0, hits: 0 } };
  check('a mastery colour says the kills and headshots and the best weapon\'s progress', Progress.requirementText(gold) === 'Gold mastery with one weapon: 37 / 150 kills, 12 / 40 headshots', Progress.requirementText(gold));
  const card = CAT.unlocks.find((row) => row.card);
  check('a card unlock quotes the card\'s own condition', !card || Progress.requirementText(card).includes('Card unlock'), card ? Progress.requirementText(card) : 'no card unlock row');
  const closedRoom = CAT.challenges.find((row) => !Challenges.isOpen(row)), openRoom = CAT.challenges.find((row) => Challenges.isOpen(row));
  check('a closed Challenge Room asks for its level with the progress', Challenges.requirementText(closedRoom).includes('you are level 1'), Challenges.requirementText(closedRoom));
  check('a locked Expert run shows the stars earned', Challenges.requirementText(openRoom) === 'Expert: earn ' + CHALLENGE_EXPERT_STARS + ' stars (0 / ' + CHALLENGE_EXPERT_STARS + ')', Challenges.requirementText(openRoom));
  check('a closed ladder match asks to clear the one before it', Ladder.requirementText(0, 2) === 'Clear the match before it first' && Ladder.requirementText(0, 0) === '', Ladder.requirementText(0, 2));
  Ui.open('profile');
  const profile = uiScreenText('profile');
  check('the profile lists the next unlocks and the mastery colours with their requirement', profile.includes('you are level 1') && profile.includes('Gold mastery with one weapon: 37 / 150 kills'), profile.slice(0, 200));
  Ui.closeAll();
  Ui.open('ladder');
  check('the ladder shows why a match is closed', uiScreenText('ladder').includes('Clear the match before it first'));
  Ui.closeAll();
  Ui.open('challenges');
  check('the Challenge Rooms show the level a closed room opens at and the stars an Expert run needs', uiScreenText('challenges').includes('you are level 1') && uiScreenText('challenges').includes('(0 / ' + CHALLENGE_EXPERT_STARS + ')'));
  Ui.closeAll();
  Ui.open('loadout');
  LoadoutMenu.show('weapons');
  const weaponsTab = uiScreenText('loadout');
  check('the loadout screen lists the picks of the pickup loadout', weaponsTab.includes('Breaker Maul') && weaponsTab.includes('Hornet Carbine') && weaponsTab.includes('Warden Pistol') && weaponsTab.includes('Frag Charge'));
  Ui.closeAll();
  startModeTest('gungame', modesTestMap({ spawns: FFA_SPAWNS }), [-1], { ruleset: 'classic', player: { name: 'Me' } });
  Ui.open('loadout');
  LoadoutMenu.show('weapons');
  check('a restricted weapon stays in the list with its reason', uiScreenText('loadout').includes('hands out every weapon itself'));
  Ui.closeAll();
  endModeTest();
  Save.data = keep;
}));

// ---- Review fixes: share codes, spawn kits, melee defaults, licences, bot gear, quick buy, refill, carry, unlock badge ----
Test.add('roster', (check) => {
  const decoded = CustomMatch.decode(CustomCodec.pack({ weaponList: ['tempest', 'kestrel', 'longshot'] }));
  check('an old share code naming retired weapons decodes with their successors', !decoded.error && decoded.draft.weaponList.join() === 'vanguard,kestrel', decoded.error || decoded.draft.weaponList.join());
  startModeTest('lms', modesTestMap({ spawns: FFA_SPAWNS }), [-1], { ruleset: 'classic', player: { name: 'Me' } });
  const forbidden = ['daybreak', 'halcyon', 'lifter', 'twingate'].filter((key) => Weapons.has(0, key));
  check('Last Standing hands out no power weapon or tool, but the guns', forbidden.length === 0 && Weapons.has(0, 'vanguard') && Weapons.has(0, 'heron'), forbidden.join());
  endModeTest();
  const carried = (ruleset) => { rosterMatch(ruleset); const kept = ['tanto', 'maul', 'bulwark'].filter((key) => Weapons.has(0, key)).join(); endModeTest(); return kept; };
  const fresh = Save.data;
  Save.data = Save.emptySave();
  check('Tactical Breach, Modern Ops, Pilot Rush and Frame Runner spawn with the Edge Tanto', ['tactical', 'modern', 'pilot', 'frame'].every((ruleset) => carried(ruleset) === 'tanto'),
    ['tactical', 'modern', 'pilot', 'frame'].map(carried).join(' / '));
  check('the pickup rulesets spawn with the loadout melee (Breaker Maul by default)', ROSTER_PICKUP_RULESETS.every((ruleset) => carried(ruleset) === 'maul'), ROSTER_PICKUP_RULESETS.map(carried).join(' / '));
  Loadouts.setPickup('melee', 'bulwark');
  check('a melee the player picked is used in Tactical Breach too', carried('tactical') === 'bulwark', carried('tactical'));
  Loadouts.resetPickup();
  rosterMatch('tactical');
  check('melee-only roles use the ruleset\'s melee', meleeWeaponKey() === 'tanto', meleeWeaponKey());
  endModeTest();
  rosterMatch('knight');
  const bot = Actors.create(ACTOR_KIND.BOT, 1, 'bot');
  Bots.profile[bot] = null;
  check('a bot spawns with the ruleset\'s melee (Iron Bulwark: the Bulwark Shield-Saw)', Loadouts.startKeys(bot)[0] === 'bulwark', Loadouts.startKeys(bot).join());
  endModeTest();
  Save.data = fresh;
});

// A charge or lock is licensed while it is held with the target in sight (the next CHARGE_LICENSE_SLACK only) and for its release, one tick and the
// same slack long (ARC-033; P8-04: the strict one tick missed the shot that leaves a step after the decision, which showed as an unperceived shot).
Test.add('roster', (check) => {
  rosterMatch('classic');
  const bot = Actors.create(ACTOR_KIND.BOT, 1, 'bot'), mode = CAT.weapons.byId('accelerator').primary, hold = mode.charge.time;
  BotCombat.holdSince[bot] = -1; BotCombat.licenseUntil[bot] = -1;
  BotCombat.holdThenRelease(bot, 0, mode, 10);
  check('starting a charge in sight licenses its fill time and the slack', Test.near(BotCombat.licenseUntil[bot], 10 + hold + CHARGE_LICENSE_SLACK, 1e-9) && BotCombat.holdSince[bot] === 10);
  BotCombat.holdThenRelease(bot, 0, mode, 10 + hold / 2);
  check('holding it never shortens the licence', BotCombat.licenseUntil[bot] >= 10 + hold / 2 + CHARGE_LICENSE_SLACK - 1e-9);
  BotCombat.holdThenRelease(bot, 0, mode, 10 + hold);
  check('the release is licensed for one tick, for its target', Test.near(BotCombat.licenseUntil[bot], 10 + hold + TICK_SECONDS + CHARGE_LICENSE_SLACK, 1e-9) && BotCombat.licenseTarget[bot] === 0 && BotCombat.holdSince[bot] === -1,
    BotCombat.licenseUntil[bot]);
  endModeTest();
});

// Bots choose gadgets and abilities by their botUse rules, from their own hash stream.
Test.add('roster', (check) => {
  rosterMatch('vanguard');
  const bots = [];
  for (let k = 0; k < 10; k++) { const id = Actors.create(ACTOR_KIND.BOT, 1, 'bot' + k); Bots.profile[id] = null; bots.push(id); }
  const gear = bots.map((id) => Loadouts.gear(id));
  const slotOk = gear.every((set) => CAT.gadgets.byId(set.lethal).slot === 'lethal' && CAT.gadgets.byId(set.tactical).slot === 'tactical' && CAT.gadgets.byId(set.device).slot === 'device');
  check('a bot\'s lethal, tactical and device fit their slots', slotOk, JSON.stringify(gear[0]));
  check('a bot repeats its picks and the bots differ', JSON.stringify(Loadouts.gear(bots[0])) === JSON.stringify(gear[0]) && new Set(gear.map((set) => set.lethal + set.tactical + set.device)).size >= 3);
  check('an effect a tier cannot use is never picked (the flash needs the flashPeek tier flag)', bots.every((id, index) => Bots.tier(id).flashPeek || gear[index].tactical !== 'flash'));
  const kit = CAT.abilityKits.byId('loadout'), picks = bots.map((id) => [Abilities.kitAbility(id, kit, 'ability1'), Abilities.kitAbility(id, kit, 'ultimate')]);
  check('a bot\'s ability and ultimate come from the kit lists, by botUse chance', picks.every(([ability, ultimate]) => kit.choices.ability1.includes(ability) && kit.choices.ultimate.includes(ultimate)
    && CAT.abilities.byId(ability).botUse.chance > 0), JSON.stringify(picks[0]));
  check('and differ between bots, the same each time', new Set(picks.map((pair) => pair.join())).size >= 3 && Abilities.kitAbility(bots[0], kit, 'ability1') === picks[0][0]);
  check('the player is not touched: the saved choice or the kit default', Loadouts.botAbility(0, kit, 'ability1') === '' && Loadouts.gear(0).lethal === Loadouts.pickedKey('lethal'));
  endModeTest();
  rosterMatch('classic');
  const guns = [];
  for (let k = 0; k < 10; k++) { const id = Actors.create(ACTOR_KIND.BOT, 1, 'gun' + k); Bots.profile[id] = null; guns.push(id); }
  const small = guns.map((id) => botPrimaryForMap(id));
  check('a bot\'s primary fits the fight distance (range band)', guns.every((id, index) => botGunFits(id, CAT.weapons.byId(small[index])) || !CAT.weapons.filter((row) => botGunFits(id, row)).length), small.join());
  const bought = [];
  rosterMatch('tactical');
  const buyer = Actors.create(ACTOR_KIND.BOT, 1, 'buyer');
  Bots.profile[buyer] = null;
  for (const row of CAT.weapons) if (row.class !== 'melee' && Economy.catalogue(buyer).some((item) => item.key === row.id) && gunWorthFor(buyer, row.id) > 0) bought.push(row.id);
  check('Tactical Breach bots only consider guns that fit their fight distance', bought.length > 0 && bought.every((key) => botGunFits(buyer, CAT.weapons.byId(key))), bought.join());
  endModeTest();
});
function gunWorthFor(id, key) { return gunWorth(id, { kind: 'weapon', weaponClass: CAT.weapons.byId(key).class, key }); }

// Round buy: the loadout primary is the one-tap quick buy. The ammo cache refills the loadout's grenades. A chosen set keeps its own carry.
Test.add('roster', (check) => uiWith(() => {
  const keep = Save.data;
  Save.data = Save.emptySave();
  rosterMatch('tactical');
  Economy.setMoney(0, 9000);
  const before = Economy.money(0), price = CAT.weapons.byId('hornet').price;
  Ui.open('buy');
  check('the buy menu offers the quick buy of the loadout primary', uiScreenText('buy').includes('Quick buy: Hornet Carbine') && uiScreenText('buy').includes('key Q'));
  const result = Economy.quickBuy(0);
  check('quick buy buys the loadout primary in one call', result.ok && Weapons.has(0, 'hornet') && Economy.money(0) === before - price, result.reason);
  Ui.closeAll();
  Loadouts.setPickup('primary', 'vanguard');
  Weapons.setLoadout(0, ['tanto', 'warden']);
  check('and follows the pick', Economy.quickBuy(0).ok && Weapons.has(0, 'vanguard'));
  endModeTest();
  Loadouts.resetPickup();
  Loadouts.setPickup('lethal', 'sticky'); Loadouts.setPickup('tactical', 'smoke');
  rosterMatch('classic');
  const count = (key) => Gadgets.countOf(0, key);
  check('the loadout gear is carried from the spawn', count('sticky') === 1 && count('smoke') === 1 && count('frag') === 0);
  Gadgets.count.fill(0, 0, GADGET_COUNT);
  check('an ammo cache refills the loadout\'s lethal and tactical, not the kit\'s frag', Gadgets.refill(0) && count('sticky') === 1 && count('smoke') === 1 && count('frag') === 0);
  endModeTest();
  const plain = Rules.build({ mode: 'ffa', ruleset: 'tactical' });
  const viaMutator = Rules.build({ mode: 'ffa', ruleset: 'tactical', mutators: [{ id: 'weaponset', value: 'lootSet' }] });
  const draft = Object.assign(CustomMatch.defaults(), { bundle: 'tactical', weaponSet: 'lootSet' });
  const viaEditor = Rules.build(CustomMatch.setup(draft, 1));
  check('a weapon set chosen with the mutator or the editor keeps its own carry limit (Loot: 5), a bundle keeps its own (2)',
    plain.carry === 2 && viaMutator.carry === null && viaMutator.weaponSet === 'lootSet' && viaEditor.carry === null && viaEditor.ammoTiers === null && viaEditor.weaponSet === 'lootSet',
    plain.carry + ' ' + viaMutator.carry + ' ' + viaEditor.carry);
  Save.data = keep;
}));

// P3-07: the unlock toast and the "New" badge.
Test.add('roster', (check) => uiWith(() => {
  const keep = Save.data;
  Save.data = Save.emptySave();
  Progress.seenIds();
  check('nothing is new in a fresh save', !CAT.unlocks.some((row) => Progress.isNew(row)));
  const row = CAT.unlocks.find((entry) => entry.level === 2 && !entry.mastery && !entry.card);
  Progress.profile().xp = Progress.xpForLevel(2) - 1;
  const toasts = [], handler = Bus.on('toast', (event) => toasts.push(event.text));
  Game.start({ mode: 'ffa', map: 'spire', seed: 4, player: { name: 'You' }, bots: [{ dummy: true }] });
  const player = Game.playerId;
  Sim.run(60 * 120);
  Modes.score[player] = 5; Modes.kills[player] = 5;
  Modes.finish(player);
  Bus.off('toast', handler);
  Game.stop();
  check('a new unlock gives a toast', toasts.some((text) => text.startsWith('Unlocked: ') && text.includes(row.name)), toasts.join(' | '));
  check('and a New badge on the career menu and in the profile until it is opened', Progress.isNew(row));
  Ui.open('career');
  check('the career menu marks the profile entry', uiScreenText('career').includes('Profile and unlocks (New)'));
  Ui.closeAll();
  Ui.open('profile');
  const text = uiScreenText('profile');
  check('the profile lists it as New', text.includes('New') && text.includes(row.name), text.slice(0, 160));
  check('and the badge is gone once seen', !Progress.isNew(row));
  Ui.closeAll();
  Save.data = keep;
}));
