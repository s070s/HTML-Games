// ---- Pause menu ---------------------------------------------------------------------------------------------------------
async function openPauseMenu(world) {
  Sound.sfx('confirm');
  let start = 0;
  for (;;) {
    const choice = await choose([T('menu.party'), T('menu.bag'), T('menu.dossier'), T('menu.map'), T('menu.save'), T('menu.options'), T('menu.close')],
      { x: 140, y: 6, w: 96, start: start, title: T('ui.money', { n: G.money }) });
    if (choice === -1 || choice === 6) return;
    start = choice;
    if (choice === 0) await openLayer(new PartyLayer({ mode: 'view' }));
    else if (choice === 1) await openLayer(new BagLayer({ battle: false }));
    else if (choice === 2) await openLayer(new DossierLayer());
    else if (choice === 3) await openMapScreen();
    else if (choice === 4) {
      if (world.mapId !== 'cafe') await say('menu.saveOnlyCafe');
      else { const stored = writeSave(); await say(stored ? 'cafe.saved' : 'cafe.savedMemory'); }
    } else if (choice === 5) await openLayer(new OptionsLayer());
  }
}

