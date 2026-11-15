// ---- Game flow: title, new game, continue ---------------------------------------------------------------------
function clockSeed() { return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0; }
function startWorld() {
  layers.length = 0;
  pushLayer(new OverworldLayer());
}
async function newGameFlow() {
  const gender = await openLayer(new GenderLayer());
  PREVIEW_PLAYER.gender = gender;
  const name = await openLayer(new NameLayer(gender === 'f' ? 'ΜΑΡΙΑ' : 'ΝΙΚΟΣ'));
  const backdrop = new BackdropLayer('prof');
  pushLayer(backdrop);
  PREVIEW_PLAYER.name = name;
  resetTextCache();
  for (const key of ['intro.1', 'intro.2', 'intro.3', 'intro.4', 'intro.5']) await say(key, { name: name });
  let starter;
  for (;;) {
    starter = await openLayer(new StarterLayer());
    if (await askYesNo('starter.confirm', { mon: speciesName(starter) })) break;
  }
  G = newGameState(name, gender, starter);
  G.rng = makeRng(clockSeed());
  resetTextCache();
  await say('intro.6', { name: name, mon: speciesName(starter) });
  await say('intro.7', { name: name });
  removeLayer(backdrop);
  await Fade.start(1, 12);
  startWorld();
  await waitFrames(3);
  await Fade.start(0, 12);
}
async function titleFlow() {
  layers.length = 0;
  G = null;
  await openLayer(new NoticeLayer());
  pushLayer(new TitleLayer());
  for (;;) {
    const saved = readSave();
    const choice = await choose([T('title.new'), { label: T('title.continue'), disabled: !saved }, T('menu.options')], { x: 84, y: 100, w: 72, cancel: false });
    if (choice === 0) { await newGameFlow(); return; }
    if (choice === 1) {
      G = gameFromSave(saved);
      resetTextCache();
      Sound.sfx('confirm');
      await Fade.start(1, 12);
      startWorld();
      await waitFrames(3);
      await Fade.start(0, 12);
      return;
    }
    if (choice === 2) await openLayer(new OptionsLayer());
  }
}

