// Self-tests for the custom match editor (S18): share-code codec, draft validation, saved presets, the setup it builds,
// the 12 one-click rule bundles starting headless matches, and the editor screens.

DebugApi.custom = CustomMatch;   // ARC-040: __CTK.custom

function richDraft() {
  const draft = CustomMatch.defaults();
  const map = Maps.forMode('tdm')[0];
  return Object.assign(draft, { name: 'Night Raid', mode: 'tdm', map: map.id, bundle: 'tactical', move: 'agile', health: 'regen', weaponSet: 'militarySet', items: false,
    friendlyFire: 0.5, lives: 3, respawnDelay: 5, botCount: 6, allies: 4, scoreLimit: 100, timeLimit: 300,
    mutators: [{ id: 'gravity', value: 75 }, { id: 'ff', value: 100 }, { id: 'respawn', value: { delay: 4, wave: 10 } }, { id: 'oneshot', value: true }] });
}
function codeWith(object) { return CustomCodec.pack(object); }
function customRandomBytes(random, length, alphabet) { return Uint8Array.from({ length }, () => random.int(0, alphabet - 1)); }

// R-157: every new match seed (custom, editor test play, generated map) comes from one recipe, newSeed (S02).
Test.add('custom', (check) => {
  const savedRandom = Math.random, saved = MapGenMenu.state.seed;
  Math.random = () => 0.25;
  try {
    const expected = Math.floor(0.25 * SEED_RANGE);
    MapGenMenu.newSeed();
    check('seeds: custom matches and generated maps use newSeed', CustomMatch.setup(CustomMatch.defaults()).seed === expected
      && MapGenMenu.state.seed === expected, MapGenMenu.state.seed);
  } finally { Math.random = savedRandom; MapGenMenu.state.seed = saved; }
});

Test.add('custom', (check) => {
  const random = makeRandom(77);
  let roundTrips = 0, tried = 0;
  for (const length of [0, 1, 2, 3, 4, 17, 128, 129, 300, 2000]) {
    for (const alphabet of [2, 5, 256]) {
      tried++;
      const bytes = customRandomBytes(random, length, alphabet);
      const back = CustomCodec.expand(CustomCodec.compress(bytes), 1e6);
      if (back.length === bytes.length && back.every((value, index) => value === bytes[index])) roundTrips++;
    }
  }
  check('the compressor round-trips ' + tried + ' byte arrays of every size and alphabet', roundTrips === tried, roundTrips + '/' + tried);
  const repetitive = new TextEncoder().encode('{"mode":"tdm","mutators":[{"id":"gravity"},{"id":"gravity"}]}'.repeat(8));
  check('repetitive input shrinks a lot', CustomCodec.compress(repetitive).length < repetitive.length / 3, CustomCodec.compress(repetitive).length + ' of ' + repetitive.length);
  const throwsOn = (bytes) => { try { CustomCodec.expand(Uint8Array.from(bytes), 100); return false; } catch (error) { return true; } };
  check('expand rejects a truncated literal run, a truncated match and a distance before the start', throwsOn([5, 1, 2]) && throwsOn([0, 65, 128, 0]) && throwsOn([0, 65, 128, 0, 5]));
  check('expand rejects output over the limit (decompression bomb)', throwsOn([0, 65, 255, 0, 1]));
  const base64 = CustomCodec.toBase64Url(Uint8Array.from([251, 255, 254, 0, 1]));
  check('base64url has no padding or unsafe characters and round-trips', /^[A-Za-z0-9_-]+$/.test(base64) && CustomCodec.fromBase64Url(base64).join() === '251,255,254,0,1');
});

Test.add('custom', (check) => {
  const defaults = CustomMatch.defaults();
  const checked = CustomMatch.validate(defaults);
  check('the default draft is valid', checked.errors.length === 0, checked.errors.join('; '));
  const empty = CustomMatch.encode(defaults);
  check('a default draft makes a short code with version and checksum', /^CTK1-[0-9a-f]{8}-[A-Za-z0-9_-]+$/.test(empty) && empty.length < 40, empty);
  check('a default code decodes to the defaults', JSON.stringify(CustomMatch.decode(empty).draft) === JSON.stringify(defaults));

  const rich = richDraft();
  const code = CustomMatch.encode(rich);
  const decoded = CustomMatch.decode(code);
  check('a rich draft survives the share code round trip', !decoded.error && JSON.stringify(decoded.draft) === JSON.stringify(CustomMatch.validate(rich).draft), decoded.error);
  check('the mutators survive the round trip (the later One-Shot removed nothing here)', decoded.draft && decoded.draft.mutators.map((entry) => entry.id).join() === 'gravity,ff,respawn,oneshot');
  check('a rich code stays short enough to paste in a message', code.length < 500, code.length);
  check('whitespace and line breaks inside a pasted code are ignored', CustomMatch.decode('  ' + code.slice(0, 20) + '\n' + code.slice(20, 60) + ' \r\n' + code.slice(60) + '\n').draft.mode === 'tdm');
  const withList = Object.assign(CustomMatch.defaults(), { weaponList: ['maul', 'warden', 'lancet'] });
  check('a weapon list is shared too', CustomMatch.decode(CustomMatch.encode(withList)).draft.weaponList.join() === 'maul,warden,lancet');

  const payloadStart = code.lastIndexOf('-') + 1;
  const flipped = code.slice(0, payloadStart + 3) + (code[payloadStart + 3] === 'A' ? 'B' : 'A') + code.slice(payloadStart + 4);
  const refusals = {
    corrupt: CustomMatch.decode(flipped).error,
    truncated: CustomMatch.decode(code.slice(0, code.length - 10)).error,
    wrongPrefix: CustomMatch.decode('XYZ1-' + code.slice(5)).error,
    newer: CustomMatch.decode(code.replace('CTK1-', 'CTK2-')).error,
    older: CustomMatch.decode(code.replace('CTK1-', 'CTK0-')).error,
    garbage: CustomMatch.decode('hello world').error,
    empty: CustomMatch.decode('').error,
    huge: CustomMatch.decode('CTK1-00000000-' + 'A'.repeat(7000)).error,
    checksum: CustomMatch.decode(code.replace(/^CTK1-[0-9a-f]{8}/, 'CTK1-00000000')).error,
  };
  for (const name in refusals) check('a ' + name + ' code is refused with a message', typeof refusals[name] === 'string' && refusals[name].length > 10, name);
  check('the corrupt and newer messages say what is wrong', refusals.corrupt.includes('damaged') && refusals.newer.includes('newer'));

  const bogus = (object) => CustomMatch.decode(codeWith(object)).error;
  check('valid wrapping but an unknown mode is refused', bogus({ mode: 'nonsense' }).includes('invalid mode'));
  check('an unknown setting is refused', bogus({ cheat: true }).includes('unknown setting cheat'));
  check('an unknown mutator is refused', bogus({ mutators: [{ id: 'nonsense', value: true }] }).includes('invalid mutators'));
  check('an out-of-range mutator value is refused', bogus({ mutators: [{ id: 'gravity', value: 'fast' }] }).includes('invalid mutators'));
  check('a wrong type is refused', bogus({ items: 'yes' }).includes('invalid items') && bogus({ botCount: 99 }).includes('invalid botCount') && bogus({ weaponList: ['nonsense'] }).includes('invalid weaponList'));
  check('a map that does not serve the mode is refused', bogus({ mode: 'duel', map: Maps.forMode('tdm').find((map) => !map.modes.includes('duel')).id }).includes('does not serve'));
  check('a code that is not an object is refused', CustomMatch.decode(codeWith([1, 2])).error === 'The code holds no settings.');
  check('a limit that makes no sense for the mode is dropped, not trusted', CustomMatch.decode(codeWith({ mode: 'ffa', roundWins: 3 })).draft.roundWins === -1);
  // Editor maps are local save slots (user1 here is another map on the next device): a code never names one (meta-07).
  Maps.registerRuntime(Object.assign({}, CAT.maps.byId('spire'), { id: 'user19' }));
  const shared = CustomMatch.decode(CustomMatch.encode(Object.assign(CustomMatch.defaults(), { map: 'user19' }))), foreign = CustomMatch.decode(codeWith({ map: 'user19' }));
  Maps.unregisterRuntime('user19');
  check('a code leaves out an editor map; one that names it imports a random map and says why', shared.draft.map === '' && foreign.draft.map === '' && /editor/.test(foreign.note) && /generated/.test(foreign.note));
});

Test.add('custom', (check) => {
  // Saved presets (MOV-002) and the remembered draft (MIS-008).
  const draft = richDraft();
  const first = CustomMatch.saveAs(draft, 'Night Raid');
  check('a preset is saved with an id and the ruleset fields', first && first.id === 'custom-1' && first.name === 'Night Raid' && first.move === 'agile' && first.items === false && first.friendlyFire === 0.5);
  check('the preset keeps the editor settings (mode, map, bots, limits)', first.editor.mode === 'tdm' && first.editor.botCount === 6 && first.editor.scoreLimit === 100);
  check('a preset lives in Save.data.rulesets', Save.data.rulesets.length === 1 && Rules.custom.get('custom-1').name === 'Night Raid');
  const loaded = CustomMatch.fromPreset(Rules.custom.get('custom-1'));
  check('loading a preset restores the draft', JSON.stringify(loaded) === JSON.stringify(CustomMatch.validate(draft).draft));
  const second = CustomMatch.saveAs(Object.assign(CustomMatch.copy(draft), { botCount: 2 }), 'Small', 'custom-1');
  check('saving with an id replaces that preset', second.id === 'custom-1' && Save.data.rulesets.length === 1 && Rules.custom.get('custom-1').editor.botCount === 2);
  check('a nameless preset is refused with a message', CustomMatch.saveAs(draft, '  ') === null && Rules.custom.lastError.length > 5);
  const rules = Rules.build({ mode: 'ffa', ruleset: 'custom-1' });
  check('a saved preset builds as a ruleset (mutators included)', rules.id === 'custom-1' && rules.move === 'agile' && rules.items === false && rules.fx.timeScale === undefined && rules.gravityScale === 0.75 && Rules.problems.length === 0, Rules.problems.join('; '));
  check('a plain ruleset without editor settings loads what the editor can express', CustomMatch.fromPreset({ id: 'custom-9', name: 'Old', move: 'agile', health: 'nonsense', lives: 3 }).move === 'agile' && CustomMatch.fromPreset({ id: 'custom-9', name: 'Old', move: 'agile', health: 'nonsense' }).health === '');
  for (let count = 1; count < 50; count++) CustomMatch.saveAs(draft, 'Preset ' + count);
  check('50 presets fit', Save.data.rulesets.length === 50);
  check('the 51st is refused with a message', CustomMatch.saveAs(draft, 'One too many') === null && Rules.custom.lastError.includes('50'));
  Rules.custom.remove('custom-1');
  check('deleting frees a slot', Save.data.rulesets.length === 49 && CustomMatch.saveAs(draft, 'Again') !== null);

  CustomMatch.save(draft);
  check('the last draft is remembered', JSON.stringify(CustomMatch.load()) === JSON.stringify(CustomMatch.validate(draft).draft));
  Settings.set('custom.draft', '{broken');
  check('a broken remembered draft falls back to the defaults', JSON.stringify(CustomMatch.load()) === JSON.stringify(CustomMatch.defaults()));
  Settings.set('custom.draft', JSON.stringify({ mode: 'nonsense', botCount: 3 }));
  check('a remembered draft with a removed mode keeps the valid fields', CustomMatch.load().mode === 'ffa' && CustomMatch.load().botCount === 3);
});

Test.add('custom', (check) => {
  const draft = richDraft();
  const setup = CustomMatch.setup(draft, 5);
  check('setup: mode, map, seed and difficulty', setup.mode === 'tdm' && setup.map === draft.map && setup.seed === 5 && setup.difficulty === draft.difficulty);
  check('setup: 6 bots, 4 on the player team and 2 on the other (allies 4)', setup.bots.length === 6 && setup.bots.filter((bot) => bot.team === 0).length === 4 && setup.bots.filter((bot) => bot.team === 1).length === 2 && setup.balance === false);
  check('setup: the player joins team 0', setup.player.team === 0 && CustomMatch.setup(draft, 5, false).player === undefined);
  check('setup: limits become mode options', setup.modeOptions.scoreLimit === 100 && setup.modeOptions.timeLimit === 300);
  check('setup: overrides make a custom ruleset object named after the draft', setup.ruleset.id === 'custom' && setup.ruleset.name === 'Night Raid' && setup.ruleset.move === 'agile' && setup.ruleset.items === false && setup.ruleset.lives === 3 && setup.ruleset.respawn.delay === 5);
  const plain = CustomMatch.setup(CustomMatch.defaults(), 1);
  check('setup: an untouched draft uses the mode default bundle id and the mode default bot count', plain.ruleset === 'classic' && plain.bots.length === Modes.defaultBots('ffa', true).length && plain.balance === undefined);
  const roster = PlayFlow.rosterBots(plain.bots.length, plain.difficulty, 1);
  check('setup: mixed personality fields the Quick Play roster bots (R-148)', JSON.stringify(plain.bots) === JSON.stringify(roster) && !!roster[0].profile, JSON.stringify(plain.bots[0]));
  check('setup: no map chosen picks one that serves the mode, the same one for the same seed', Maps.forMode('ffa').some((map) => map.id === plain.map) && CustomMatch.setup(CustomMatch.defaults(), 1).map === plain.map);
  const listed = CustomMatch.setup(Object.assign(CustomMatch.defaults(), { weaponList: ['maul', 'lancet'], mutators: [{ id: 'oneshot', value: true }] }), 1);
  check('setup: a weapon list becomes the last Weapon Set mutator and wins conflicts', listed.mutators.map((entry) => entry.id).join() === 'weaponset' && listed.mutators[0].value.join() === 'maul,lancet');
  const roundsDraft = Object.assign(CustomMatch.defaults(), { mode: 'bomb', roundWins: 3 });
  check('setup: rounds to win becomes a mode option for round modes', CustomMatch.setup(roundsDraft, 1).modeOptions.rounds.winsNeeded === 3);
  check('setup: the bot count never exceeds the quality cap', CustomMatch.setup(Object.assign(CustomMatch.defaults(), { botCount: 23 }), 1).bots.length === Quality.current().bots);
  const built = Rules.build(CustomMatch.setup(draft, 5));
  check('setup builds a valid ruleset (mutators, limits, rule fields)', built.scoreLimit === 100 && built.timeLimit === 300 && built.move === 'agile' && built.friendlyFire === 1 && built.mutators.length === 4 && Rules.problems.length === 0,
    JSON.stringify(built.mutators) + Rules.problems.join('; '));
});

Test.add('custom', (check) => {
  // Every rule bundle RS01..RS12 starts a headless match in one call.
  const base = Object.assign(CustomMatch.defaults(), { botCount: 3, scoreLimit: 10 });
  for (const row of RULESET_ROWS) {
    const setup = CustomMatch.bundleStart(base, row.id, 3, false);
    const errorsBefore = ErrorLog.entries.length;
    const match = Game.start(setup);
    Sim.run(TICK_RATE);
    const ok = match.rules.id === row.id && match.rules.move === row.move && match.rules.health === row.health && match.rules.meter === row.meter && Actors.count === 3 && Rules.problems.length === 0;
    check('bundle ' + row.code + ' ' + row.id + ' starts a headless match and runs a second', ok && ErrorLog.entries.length === errorsBefore, match.rules.id + ' ' + Actors.count + ' ' + Rules.problems.join('; '));
    Game.stop();
  }
  const draft = Object.assign(CustomMatch.defaults(), { botCount: 2, name: 'With extras', mutators: [{ id: 'health', value: 150 }, { id: 'regen', value: 3 }], move: 'agile' });
  const match = Game.start(CustomMatch.setup(draft, 4, false));
  Sim.run(TICK_RATE);
  check('a custom draft with mutators starts and applies them', match.rules.id === 'custom' && match.rules.move === 'agile' && Actors.maxHealth[0] === 150 && match.rules.mutators.length === 2);
  Game.stop();
  const quick = CustomMatch.bundleStart(Object.assign(CustomMatch.defaults(), { name: 'Keep?', mutators: [{ id: 'gravity', value: 50 }], move: 'agile' }), 'modern', 1, false);
  check('a bundle quick start ignores the draft rule overrides and mutators', quick.ruleset === 'modern' && quick.mutators.length === 0);
});

Test.add('custom', (check) => {
  uiWith(() => {
    Settings.set('custom.draft', '');
    const started = performance.now();
    check('the custom screen is registered and the main menu entry is enabled', Ui.screens.has('custom') && Ui.screens.has('customPresets') && Ui.screens.has('customShare'));
    Ui.open('main');
    const customButton = Array.from(Ui.root.querySelectorAll('.ui-main button')).find((button) => button.textContent.startsWith('Custom'));
    check('main menu: Custom is not marked coming soon', customButton && !customButton.disabled);
    check('opening the editor works and is fast (UI-001)', customButton && (customButton.click(), Ui.current() === 'custom') && performance.now() - started < UI_OPEN_BUDGET_MS);
    const root = Ui.root.querySelector('.ui-custom');
    const tabNames = Array.from(root.querySelectorAll('.ui-tab')).map((button) => button.textContent);
    check('six tabs: Mode, Rules, Weapons, Bots, Mutators, Map', tabNames.join() === 'Mode,Rules,Weapons,Bots,Mutators,Map', tabNames.join());
    for (const name of tabNames) {
      const errorsBefore = ErrorLog.entries.length;
      uiClickButton(root, name);
      check('tab ' + name + ' renders rows', root.querySelectorAll('.ui-row, .cm-quick').length > 0 && ErrorLog.entries.length === errorsBefore);
    }
    uiClickButton(root, 'Mode');
    const rows = Array.from(root.querySelectorAll('.cm-list .ui-row'));
    check('every simple field row has a Reset button (MUT-001)', rows.length >= 4 && rows.every((row) => Array.from(row.querySelectorAll('button')).some((button) => button.textContent === 'Reset')));
    const modeRow = rows[0];
    modeRow.querySelector('.ui-cycle').click();
    check('changing the mode cycle changes the draft and the remembered setting', EDITOR_STATE.draft.mode !== 'ffa' && JSON.parse(Settings.get('custom.draft')).mode === EDITOR_STATE.draft.mode, EDITOR_STATE.draft.mode);
    Array.from(root.querySelectorAll('.cm-list .ui-row'))[0].querySelector('.cm-reset').click();
    check('Reset puts the field back to its default', EDITOR_STATE.draft.mode === 'ffa');

    uiClickButton(root, 'Mutators');
    const mutatorRows = root.querySelectorAll('.cm-list .ui-row');
    check('the mutators tab lists every mutator the mode can use (Frenzy: 49 of 50) with a switch each', mutatorRows.length === editorModeMutators(EDITOR_STATE.draft.mode).length && mutatorRows.length === 49 && Array.from(mutatorRows).every((row) => row.querySelector('.ui-cycle')));
    const switchOf = (code) => Array.from(root.querySelectorAll('.cm-list .ui-row')).find((row) => row.textContent.startsWith(code)).querySelector('.cm-controls > .ui-cycle:last-child');
    switchOf('X08').click();
    check('turning One-Shot on adds it to the draft', EDITOR_STATE.draft.mutators.map((entry) => entry.id).join() === 'oneshot');
    switchOf('X09').click();
    check('turning on a conflicting mutator replaces the other and tells the player', EDITOR_STATE.draft.mutators.map((entry) => entry.id).join() === 'rocketpit' && Ui.lastToast.includes('One-Shot'), Ui.lastToast);
    switchOf('X01').click();
    const gravityRow = Array.from(root.querySelectorAll('.cm-list .ui-row')).find((row) => row.textContent.startsWith('X01'));
    check('an active mutator shows its typed parameter control', !!gravityRow.querySelector('input[type=range]'));
    const slider = gravityRow.querySelector('input[type=range]');
    slider.value = 200; slider.dispatchEvent(new Event('input'));
    check('the parameter slider writes the clamped value', EDITOR_STATE.draft.mutators.find((entry) => entry.id === 'gravity').value === 200);
    uiClickButton(root, 'Turn all off');
    check('Turn all off clears the mutators', EDITOR_STATE.draft.mutators.length === 0);

    uiClickButton(root, 'Weapons');
    Array.from(root.querySelectorAll('.cm-list .ui-row')).find((row) => row.textContent.startsWith('Limit to chosen')).querySelector('.ui-cycle').click();
    check('weapons tab: the list switch shows one switch per weapon', root.querySelectorAll('.cm-list .ui-row').length === 2 + CAT.weapons.length, root.querySelectorAll('.cm-list .ui-row').length);
    check('weapons tab: limiting starts with every weapon allowed', EDITOR_STATE.draft.weaponList && EDITOR_STATE.draft.weaponList.length === CAT.weapons.length);

    uiClickButton(root, 'Rules');
    const quickButtons = root.querySelectorAll('.cm-quick button');
    check('rules tab: 12 one-click bundle starts', quickButtons.length === 12);
    check('the editor can be driven by keyboard and pad: everything is focusable', Ui.focusables(root).length > 20);
    Ui.navigate('next');
    check('focus navigation moves inside the screen', root.contains(document.activeElement));

    EDITOR_STATE.draft.botCount = 2;
    EDITOR_STATE.draft.weaponList = null;
    Game.headless = true;
    uiClickButton(root, 'Mode');
    uiClickButton(root, 'Start match');
    check('Start match closes the menus and starts the match', !!Game.match && Ui.stack.length === 0 && Actors.count >= 3, Ui.stack.length + ' ' + Actors.count);
    Game.stop();
  });
});

// R-161: the custom editor, the generated-map menu and the map editor panels redraw through Ui.rebuild (one focus-keeping rule).
Test.add('custom', (check) => uiWith(() => {
  const rebuild = Ui.rebuild;
  let calls = 0;
  Ui.rebuild = function (container, build) { calls++; return rebuild.call(this, container, build); };
  try {
    Settings.set('custom.draft', '');
    Ui.open('custom');
    Ui.open('mapgen');
    MapEditorUi.rebuild(document.createElement('div'), () => {});
  } finally { Ui.rebuild = rebuild; }
  check('custom, map generator and map editor panels redraw via Ui.rebuild', calls >= 3, calls);
}));

Test.add('custom', (check) => {
  uiWith(() => {
    Settings.set('custom.draft', '');
    Ui.open('custom');
    const root = Ui.root.querySelector('.ui-custom');
    EDITOR_STATE.draft.botCount = 4;
    EDITOR_STATE.draft.mutators = [{ id: 'gravity', value: 75 }];
    uiClickButton(root, 'Presets');
    const presets = Ui.root.querySelector('.ui-customPresets');
    presets.querySelector('input').value = 'My preset';
    uiClickButton(presets, 'Save as new');
    check('presets screen: Save as new stores the preset', Rules.custom.list().length === 1 && Rules.custom.list()[0].name === 'My preset');
    check('presets screen: the preset is listed with Load, Overwrite and Delete', presets.querySelectorAll('.ui-row').length === 1 && presets.querySelectorAll('.ui-row button').length === 3);
    EDITOR_STATE.draft.botCount = 1;
    uiClickButton(presets, 'Load');
    check('presets screen: Load restores the settings and returns to the editor', EDITOR_STATE.draft.botCount === 4 && Ui.current() === 'custom');
    Ui.open('customPresets');
    uiClickButton(Ui.root.querySelector('.ui-customPresets'), 'Delete');
    uiClickButton(Ui.root.querySelector('.ui-confirm'), 'Delete');
    check('presets screen: Delete asks first, then removes the preset', Rules.custom.list().length === 0);
    Ui.back();

    uiClickButton(root, 'Share code');
    const share = Ui.root.querySelector('.ui-customShare');
    const boxes = share.querySelectorAll('textarea');
    check('share screen: shows the current code', CustomMatch.decode(boxes[0].value).draft.botCount === 4);
    boxes[1].value = 'CTK1-00000000-abc';
    uiClickButton(share, 'Import code');
    check('share screen: a bad code shows an error and changes nothing', share.querySelector('.cm-error') && EDITOR_STATE.draft.botCount === 4);
    boxes[1].value = CustomMatch.encode(Object.assign(CustomMatch.defaults(), { botCount: 7, mode: 'tdm' }));
    uiClickButton(share, 'Import code');
    check('share screen: a good code is imported into the editor', EDITOR_STATE.draft.botCount === 7 && EDITOR_STATE.draft.mode === 'tdm' && !share.querySelector('.cm-error'));
    const arrow = new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true, cancelable: true });
    boxes[1].dispatchEvent(arrow);
    check('text fields keep their arrow keys (menu navigation does not steal them)', !arrow.defaultPrevented);
    Maps.registerRuntime(Object.assign({}, CAT.maps.byId('spire'), { id: 'user19' }));
    EDITOR_STATE.draft.map = 'user19';
    Ui.open('customShare');
    const local = Ui.root.querySelectorAll('.ui-customShare');
    check('share screen: the sender is told the local map is left out', local[local.length - 1].textContent.includes(SHARE_LOCAL_MAP_NOTE) && !share.textContent.includes(SHARE_LOCAL_MAP_NOTE));
    Maps.unregisterRuntime('user19');
    EDITOR_STATE.draft.map = '';
    Ui.closeAll();
  });
});

Test.add('custom', (check) => {
  // The Weapons tab list and the mutators resolve their conflicts inside the draft (MUT-002: the last choice wins, with a notice).
  const draft = CustomMatch.defaults();
  draft.mutators = [{ id: 'oneshot', value: true }, { id: 'gravity', value: 75 }];
  const notice = CustomMatch.setWeaponList(draft, ['maul', 'warden']);
  check('switching the weapon list on turns off a conflicting mutator and says so', draft.mutators.map((entry) => entry.id).join() === 'gravity' && notice.includes('One-Shot') && draft.weaponList.join() === 'maul,warden', notice);
  check('a list without conflicts gives no notice and clearing it gives none either', CustomMatch.setWeaponList(draft, ['maul']) === '' && CustomMatch.setWeaponList(draft, null) === '' && draft.weaponList === null && draft.mutators.length === 1);
  CustomMatch.setWeaponList(draft, ['maul', 'warden']);
  const second = CustomMatch.turnOnMutator(draft, 'rocketpit');
  check('turning on a mutator that conflicts with the list turns the list off and says so', draft.weaponList === null && draft.mutators.map((entry) => entry.id).join() === 'gravity,rocketpit' && second.includes('weapon list'), second);
  CustomMatch.setWeaponList(draft, ['maul', 'warden']);
  check('turning on the Weapon Set mutator replaces the list (the last choice wins)', CustomMatch.turnOnMutator(draft, 'weaponset').includes('weapon list') && draft.weaponList === null);
  check('turning on a harmless mutator keeps the list', (CustomMatch.setWeaponList(draft, ['maul']), CustomMatch.turnOnMutator(draft, 'regen') === '') && draft.weaponList.join() === 'maul');

  const loaded = CustomMatch.validate({ weaponList: ['maul', 'lancet'], mutators: [{ id: 'rocketpit', value: true }, { id: 'regen', value: 5 }] });
  check('a loaded or imported draft with a conflict is settled in the draft too', loaded.errors.length === 0 && loaded.draft.mutators.map((entry) => entry.id).join() === 'regen' && loaded.draft.weaponList.length === 2, loaded.errors.join());
  const setup = CustomMatch.setup(loaded.draft, 1);
  check('the editor draft and the match agree on the mutators', setup.mutators.map((entry) => entry.id).join() === 'regen,weaponset');

  uiWith(() => {
    Settings.set('custom.draft', '');
    Ui.open('custom');
    const root = Ui.root.querySelector('.ui-custom');
    EDITOR_STATE.draft.mutators = [{ id: 'oneshot', value: true }];
    uiClickButton(root, 'Weapons');
    Array.from(root.querySelectorAll('.cm-list .ui-row')).find((row) => row.textContent.startsWith('Limit to chosen')).querySelector('.ui-cycle').click();
    check('weapons tab: switching the list on with One-Shot on tells the player and updates the draft', EDITOR_STATE.draft.mutators.length === 0 && Ui.lastToast.includes('One-Shot'), Ui.lastToast);
    Ui.closeAll();
  });
});

// R-044 / R-045 / R-046: code fields can be selected, copied and pasted on phones; Copy never claims a failed copy.
// Only the copy toasts (no Web Audio adds its own); no clipboard API (http).
Test.add('custom', (check) => uiWith(() => {
  const toasts = [], listener = Bus.on('toast', (payload) => { if ([COPY_DONE_TEXT, COPY_MANUAL_TEXT].includes(payload.text)) toasts.push(payload.text); });
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  let selected = '', copies = false;
  document.execCommand = () => { selected = document.activeElement.value; return copies; };
  try {
    Ui.open('customShare');
    uiClickButton(Ui.top().element, 'Copy code');
    const code = Ui.top().element.querySelector('textarea');
    copies = true;
    Ui.open('saveTransfer');
    const area = Ui.top().element.querySelector('textarea'), field = area.parentNode.appendChild(makeElement('input'));
    uiClickButton(Ui.top().element, 'Copy');
    check('copy: says copied only when it copied', toasts.join() === COPY_MANUAL_TEXT + ',' + COPY_DONE_TEXT
      && selected === area.value && code.readOnly && JSON.parse(area.value).version === SAVE_VERSION, toasts.join());
    const menus = [area, document.getElementById('view')].map((target) => { const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); target.dispatchEvent(menu); return menu.defaultPrevented; });
    const style = (element) => getComputedStyle(element).getPropertyValue('-webkit-user-select') || getComputedStyle(element).userSelect;
    check('copy: text fields keep the paste menu', menus.join() === 'false,true' && style(area) === 'text' && style(field) === 'text' && style(document.body) === 'none');
  } finally {
    delete document.execCommand;
    delete navigator.clipboard;
    Bus.off('toast', listener);
  }
}));
