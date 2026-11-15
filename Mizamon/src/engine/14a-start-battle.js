// ---- Start a battle and return 'win' | 'lose' | 'ran' --------------------------------------------------------------
async function runBattle(setup) {
  const trainer = setup.trainerId ? TRAINERS[setup.trainerId] : null;
  const battle = createBattle(G.party, setup.foeParty, G.rng, {
    kind: setup.kind, trainerId: setup.trainerId, foeItems: trainer ? trainer.items : [], foeName: trainer ? trainer.name : '',
    bag: G.bag, archive: G.archive, sunday: isSundayToday(), recruitable: !!(trainer && trainer.recruitable), recruitOnly: trainer ? trainer.recruitOnly : null,
  });
  const mapId = G.player.map;
  const theme = DATA.game.battleThemes[mapId] || 'grass'; // the background of the map (data/game.json)
  const layer = new BattleLayer(battle, trainer, theme);
  Sound.play(trainer && trainer.boss ? 'boss' : 'battle');
  await Fade.start(1, 14);
  pushLayer(layer);
  await waitFrames(2);
  await Fade.start(0, 14);
  let result;
  try { result = await layer.run(); } catch (error) {
    // A broken battle must never count as a win: no story flag, medal or credits follow from 'ran'.
    console.error('Mizamon battle error', error);
    endBattle(battle);
    result = 'ran';
  }
  await Fade.start(1, 12);
  removeLayer(layer);
  const world = layers.find(function (candidate) { return candidate instanceof OverworldLayer; });
  Sound.play(world ? world.map.music : 'town');
  await Fade.start(0, 12);
  return result;
}

