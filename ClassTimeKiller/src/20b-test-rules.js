// Self-tests for S13 rules: bundle table, build order and freezing, validation, mode stage, handicap, custom rulesets.

DebugApi.rules = Rules;   // ARC-040: __CTK.rules

// Spec table 6.1: code key move health economy precision meter (one line per bundle).
const EXPECTED_BUNDLES = [
  'RS01 classic arena stack pickups arena none', 'RS02 tourney arena stack pickups arena adrenaline',
  'RS03 tactical tactical tactical roundBuy tactical none', 'RS04 modern modern regen classes standard streak',
  'RS05 pilot agile regen classes standard boost', 'RS06 vanguard vanguard shield pickups standard none',
  'RS07 ravager ravager ravager pickups standard none', 'RS08 knight knight ravager pickups standard none',
  'RS09 heroes modern hero heroKits hero ultimate', 'RS10 royale agile loot loot standard none',
  'RS11 suit modern suit pickups standard energy', 'RS12 frame parkour shield classes standard energy',
];

function bundleLine(rules) {
  return [rules.code, rules.id, rules.move, rules.health, rules.economy, rules.precision, rules.meter].join(' ');
}

Test.add('rules', (check) => {
  check('12 bundles in code order', CAT.rulesets.length === 12 && CAT.rulesets.every((row, index) => row.code === 'RS' + String(index + 1).padStart(2, '0')));
  EXPECTED_BUNDLES.forEach((line, index) => {
    const rules = Rules.build({ mode: 'ffa', ruleset: CAT.rulesets[index].id });
    check('bundle ' + line.slice(0, 4) + ' builds per the spec table', bundleLine(rules) === line && Rules.problems.length === 0, bundleLine(rules) + ' / ' + Rules.problems.join('; '));
    check('bundle ' + line.slice(0, 4) + ' is deeply frozen', Object.isFrozen(rules) && Object.isFrozen(rules.respawn) && Object.isFrozen(rules.params) && Object.isFrozen(rules.mutators) && Object.isFrozen(rules.handicap.bots));
  });
  const tourney = Rules.build({ mode: 'ffa', ruleset: 'tourney' });
  check('RS02 adds one extra jump and the wall dodge', tourney.moveOverrides.extraJumps === 1 && tourney.moveOverrides.wallDodge === true);
  check('every bundle names a weapon set (heroes arm per hero)', CAT.rulesets.every((row) => row.id === 'heroes' ? row.weaponSet === '' : row.weaponSet.endsWith('Set')));
  let threw = false;
  try { tourney.friendlyFire = 1; } catch (error) { threw = true; }
  check('a frozen ruleset refuses writes', threw && tourney.friendlyFire === 0);
});

Test.add('rules', (check) => {
  const rules = Rules.build({ mode: 'ffa' });
  check('schema defaults (spec section 4)', rules.friendlyFire === 0 && rules.selfDamage === 0.5 && rules.knockback === 1 && rules.gravityScale === 1
    && rules.lives === 0 && rules.itemRespawnScale === 1 && rules.weaponStay === false && rules.dropOnDeath === 'held');
  check('ffa respawn 2 s, forced 10 s, protection 2 s, no waves', rules.respawn.delay === 2 && rules.respawn.forced === 10 && rules.respawn.protect === 2 && rules.respawn.wave === 0);
  check('mode stage copies the mode row', rules.mode === 'ffa' && rules.scoreLimit === 25 && rules.timeLimit === 600 && rules.teams === 0 && rules.respawnMode === 'normal');
  check('mode default ruleset is used when none is chosen', rules.id === 'classic' && Rules.build({ mode: 'bomb' }).id === 'tactical');
  check('mode scoring: +1 kill, -1 suicide', rules.scoring.kill === 1 && rules.scoring.suicide === -1 && rules.scoring.teamKill === -1);
  check('mode scoring override merges', Rules.build({ mode: 'attrition' }).scoring.kill === 5 && Rules.build({ mode: 'attrition' }).scoring.suicide === -1);
  const lms = Rules.build({ mode: 'lms', ruleset: 'classic' });
  check('a bundle keeps mode rules it does not write (lms lives 3)', lms.lives === 3);
  check('a bundle overrides mode defaults it writes', Rules.build({ mode: 'tdm', ruleset: { name: 'FF', friendlyFire: 0.5 } }).friendlyFire === 0.5);
  check('modes that bring an economy name it in params', Rules.build({ mode: 'gungame' }).params.economy === 'ladder' && Rules.build({ mode: 'horde' }).params.economy === 'waveShop');
  const custom = Rules.build({ mode: 'ffa', modeOptions: { scoreLimit: 10, timeLimit: 120, params: { extra: 1 } } });
  check('custom match mode options (MODE-001)', custom.scoreLimit === 10 && custom.timeLimit === 120 && custom.params.extra === 1);
  const respawn = Rules.build({ mode: 'ffa', ruleset: { name: 'Slow', respawn: { delay: 5 } } });
  check('nested fields merge (respawn delay only)', respawn.respawn.delay === 5 && respawn.respawn.forced === 10 && respawn.respawn.protect === 2 && respawn.name === 'Slow');
  check('rounds copied for round modes', Rules.build({ mode: 'bomb' }).rounds.winsNeeded === 7 && Rules.build({ mode: 'bomb' }).respawnMode === 'round');
});

Test.add('rules', (check) => {
  const seen = {};
  const onMutators = (rules) => { seen.mutatorSawMove = rules.move; rules.gravityScale = 0.5; };
  const onDifficulty = (rules, setup) => { seen.difficultySawGravity = rules.gravityScale; seen.difficulty = rules.difficulty; rules.selfDamage = setup.selfDamageForTest; };
  const onHandicap = (rules) => { seen.handicapSawSelfDamage = rules.selfDamage; };
  const onMode = (rules) => { seen.modeSawRuleset = rules.move; rules.itemRespawnScale = 2; };   // a field the tactical bundle does not write
  Rules.addModifier('mutators', onMutators);
  Rules.addModifier('difficulty', onDifficulty);
  Rules.addModifier('handicap', onHandicap);
  Rules.addModifier('mode', onMode);
  const rules = Rules.build({ mode: 'ffa', ruleset: 'tactical', selfDamageForTest: 0.25, difficulty: 'elite' });
  Rules.removeModifier('mutators', onMutators);
  Rules.removeModifier('difficulty', onDifficulty);
  Rules.removeModifier('handicap', onHandicap);
  Rules.removeModifier('mode', onMode);
  check('stages run in MOV-001 order', Rules.stagesRun.join(',') === 'mode,bundle,mutators,difficulty,handicap', Rules.stagesRun.join(','));
  check('a mode-stage modifier runs before the bundle', seen.modeSawRuleset === 'arena' && rules.itemRespawnScale === 2);
  check('mutators see the bundle values', seen.mutatorSawMove === 'tactical');
  check('difficulty sees the mutator change', seen.difficultySawGravity === 0.5 && seen.difficulty === 'elite');
  check('handicap sees the difficulty change', seen.handicapSawSelfDamage === 0.25 && rules.selfDamage === 0.25);
  check('removed modifiers no longer run', Rules.build({ mode: 'ffa' }).gravityScale === 1);
  let threw = false;
  try { Rules.addModifier('nope', () => {}); } catch (error) { threw = true; }
  check('unknown stage is refused', threw);
  const mutated = Rules.build({ mode: 'ffa', mutators: ['oneshot', { id: 'lives', value: 3 }] });
  check('mutator stage lists the chosen mutators', mutated.mutators.length === 2 && mutated.mutators[0].id === 'oneshot' && mutated.mutators[0].value === true && mutated.mutators[1].value === 3);
  check('default difficulty is regular', mutated.difficulty === 'regular');
});

Test.add('rules', (check) => {
  const rules = Rules.build({ mode: 'ffa', player: { handicap: 0.1 }, bots: [{ handicap: 2 }, {}, { handicap: 0.5 }] });
  check('handicap is clamped to 25-100% (X22)', rules.handicap.player === 0.25 && rules.handicap.bots.join(',') === '1,1,0.5', JSON.stringify(rules.handicap));
  check('no player: full damage', Rules.build({ mode: 'ffa' }).handicap.player === 1);
});

Test.add('rules', (check) => {
  check('unknown mode falls back to ffa and is reported', Test.expectErrors(() => check('fallback mode', Rules.build({ mode: 'nope' }).mode === 'ffa')) === 1);
  check('unknown ruleset falls back to the mode default', Test.expectErrors(() => check('fallback ruleset', Rules.build({ mode: 'tdm', ruleset: 'nope' }).id === 'classic')) === 1);
  check('unknown ruleset field is reported', Test.expectErrors(() => Rules.build({ mode: 'ffa', ruleset: { name: 'X', warp: 9 } })) === 1);
  check('bad precision and meter are reported', Test.expectErrors(() => Rules.build({ mode: 'ffa', ruleset: { name: 'X', precision: 'laser', meter: 'mana' } })) === 2);
  // References are checked against catalogues that exist at build time (temporary stand-in catalogue here).
  const saved = CAT.movement;
  const presets = [{ id: 'arena' }];
  presets.byId = (id) => presets.find((row) => row.id === id) || null;
  CAT.movement = presets;
  try {
    check('known movement preset passes', Test.expectErrors(() => Rules.build({ mode: 'ffa', ruleset: 'classic' })) === 0);
    check('unknown movement preset is reported', Test.expectErrors(() => Rules.build({ mode: 'ffa', ruleset: 'tactical' })) === 1 && Rules.problems[0].includes('move'));
  } finally {
    if (saved) CAT.movement = saved; else delete CAT.movement;
  }
});

Test.add('rules', (check) => {
  const first = Rules.custom.save({ name: '  Low Gravity  ', gravityScale: 0.4, warp: 9, respawn: { delay: 1, forced: 5, protect: 1, wave: 0 } });
  check('custom ruleset saved with an id and trimmed name', first && first.id === 'custom-1' && first.name === 'Low Gravity' && Save.data.rulesets.length === 1);
  check('unknown fields are not stored', first && first.warp === undefined && first.gravityScale === 0.4);
  check('a nameless ruleset is refused', Rules.custom.save({ gravityScale: 2 }) === null && Rules.custom.lastError.length > 0);
  const built = Rules.build({ mode: 'ffa', ruleset: 'custom-1' });
  check('a custom ruleset builds by id', built.gravityScale === 0.4 && built.respawn.forced === 5 && built.name === 'Low Gravity' && built.id === 'custom-1');
  const updated = Rules.custom.save({ id: 'custom-1', name: 'Low Gravity 2', gravityScale: 0.3 });
  check('saving an existing id replaces it', updated.id === 'custom-1' && Save.data.rulesets.length === 1 && Rules.custom.get('custom-1').gravityScale === 0.3);
  for (let i = 0; i < MAX_CUSTOM_RULESETS - 1; i++) Rules.custom.save({ name: 'Set ' + i });
  check('up to 50 custom rulesets (MOV-002)', Save.data.rulesets.length === 50 && Rules.custom.save({ name: 'One too many' }) === null);
  check('updating still works when full', Rules.custom.save({ id: 'custom-2', name: 'Renamed' }) !== null);
  check('remove', Rules.custom.remove('custom-1') && !Rules.custom.get('custom-1') && !Rules.custom.remove('custom-1'));
  check('ids stay unique after a remove', Rules.custom.save({ name: 'Fresh' }).id === 'custom-51');
  // R-201: ruleset names are cleaned like every other player label (cleanLabel, LABEL_MAX)
  const odd = Rules.custom.save({ id: 'custom-51', name: '<b>Odd\u0001</b>' + 'x'.repeat(60) });
  check('ruleset names are cleaned like other labels (cleanLabel, LABEL_MAX)', odd && !/[<\u0001]/.test(odd.name) && odd.name === cleanLabel(odd.name + 'x', LABEL_MAX) && odd.name.length === LABEL_MAX, odd && odd.name);
  Save.data.rulesets.length = 0;
});

Test.add('rules', (check) => {
  const match = Game.start({ mode: 'tdm', ruleset: 'modern', bots: [] });
  check('match.setup builds Game.match.rules', match.rules && Object.isFrozen(match.rules) && match.rules.mode === 'tdm' && match.rules.move === 'modern');
  Game.stop();
});
