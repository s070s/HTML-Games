// ---- Self test (run it in the browser: await MIZAMON.selfTest()) ----------------------------------------------------------------
function yieldToBrowser() { return new Promise(function (resolve) { const channel = new MessageChannel(); channel.port1.onmessage = function () { resolve(); }; channel.port2.postMessage(0); }); }
async function pumpUntil(condition, maxFrames, button, every) {
  for (let i = 0; i < maxFrames; i++) {
    if (condition()) return true;
    if (button && i % every === 0) Input.inject(button, 2);
    stepGame();
    if (i % 4 === 0) renderFrame();
    await yieldToBrowser();
  }
  return condition();
}
async function pumpFrames(count) { await pumpUntil(function () { return false; }, count, null, 1); }
// Moves the battle command cursor to the command with this label key (a row of tabs: right = next) and presses A.
async function chooseBattleCommand(labelKey) {
  const top = layers[layers.length - 1];
  const wanted = ROOT_LABELS.indexOf(labelKey);
  for (let tries = 0; tries < ROOT_LABELS.length && top.rootCursor !== wanted; tries++) { Input.inject('right', 2); await pumpFrames(3); }
  const found = top.rootCursor === wanted;
  Input.inject('a', 2); await pumpFrames(3);
  return found;
}
async function selfTest() {
  const results = [];
  const check = function (name, pass, detail) { results.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail) }); };
  const snapshot = { G: G, layers: layers.slice(), OPT: Object.assign({}, OPT), forceMemory: Store.forceMemory, touchForced: touchForced, loopPaused: loopPaused, memory: Object.assign({}, Store.memory), sundayPinned: sundayPinned };
  sundayPinned = false;
  loopPaused = true;
  Store.forceMemory = true;
  Store.memory = {};
  const guard = async function (name, fn) {
    try { await fn(); } catch (error) { check(name, false, 'exception: ' + (error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error)); }
  };
  try {
    await guard('rules', async function () {
      check('chart has 7x7 entries', TYPE_IDS.every(function (a) { return TYPE_IDS.every(function (d) { return [0.5, 1, 2].includes(TYPE_CHART[a][d]); }); }));
      const attacker = makeMon('komma', 10);
      const defender = makeMon('fakelakis', 10);
      const hit = computeDamage(attacker, defender, MOVES.psifodeltio, { roll: 1 });
      check('damage is positive and super effective', hit.damage > 0 && hit.effectiveness === 2, hit.damage);
      const a = simulateBattle([makeMon('komma', 8)], [makeMon('eforaki', 8)], makeRng(7), {});
      const b = simulateBattle([makeMon('komma', 8)], [makeMon('eforaki', 8)], makeRng(7), {});
      check('seeded battle replays identically', a.checksum === b.checksum && a.winner === b.winner, a.checksum);
      const keys = Object.keys(STRINGS);
      check('every string has Greek and English', keys.every(function (key) { return STRINGS[key][0] && STRINGS[key][1]; }), keys.length + ' keys');
      const source = Array.prototype.map.call(document.scripts, function (s) { return s.textContent; }).join('\n');
      const used = new Set();
      source.replace(/\b(?:T|say|sayAll|askYesNo)\('([A-Za-z0-9_.]*[A-Za-z0-9_])'/g, function (all, key) { used.add(key); return all; });
      const missing = Array.from(used).filter(function (key) { return !STRINGS[key]; });
      check('every string key used in the code exists', missing.length === 0, missing.join(','));
    });
    await guard('sprites', async function () {
      const blank = [];
      for (const id of Object.keys(SPECIES)) {
        const data = creatureSprite(id).getContext('2d').getImageData(0, 0, 32, 32).data;
        let filled = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) filled++;
        if (filled < 150) blank.push(id);
      }
      check('all creature sprites are drawn', blank.length === 0, blank.join(','));
    });
    await guard('new game', async function () {
      layers.length = 0;
      G = null;
      titleFlow();
      const reached = await pumpUntil(function () { return layers.some(function (l) { return l instanceof OverworldLayer; }) && Fade.alpha === 0; }, 3000, 'a', 7);
      check('title, notice, new game reaches the overworld', reached && !!G && G.party.length === 1, G ? G.player.name + ' ' + G.player.map : 'no state');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      if (world) {
        await pumpFrames(5);
        const before = world.px;
        Input.inject('left', 14);
        await pumpFrames(30);
        check('player walks', world.px < before, before + ' -> ' + world.px);
      }
    });
    await guard('battle', async function () {
      if (!G) throw new Error('no game');
      G.party[0].lv = 20; G.party[0].xp = xpForLevel(20); G.party[0].hp = maxHp(G.party[0]);
      const xpBefore = G.party[0].xp;
      let result = null;
      runBattle({ kind: 'wild', foeParty: [makeMon('fakelakis', 2)] }).then(function (r) { result = r; });
      await pumpUntil(function () { return result !== null; }, 4000, 'a', 6);
      check('battle commands carry the debate labels', ROOT_LABELS.map(function (key) { return lookupString(key, 'en'); }).join('/') === 'Speech/Bag/Party/Flee');
      check('scripted battle is won through the UI', result === 'win' && G.party[0].xp > xpBefore, result + ' xp ' + xpBefore + ' -> ' + G.party[0].xp);
    });
    await guard('recruit', async function () {
      if (!G) throw new Error('no game');
      let success = false;
      let detail = '';
      for (let seed = 1; seed <= 12 && !success; seed++) {
        G.rng = makeRng(seed);
        G.bag.fakelaki = 5;
        const foe = makeMon('fakelakis', 3);
        foe.hp = 1;
        let result = null;
        const size = G.party.length;
        runBattle({ kind: 'wild', foeParty: [foe] }).then(function (r) { result = r; });
        // Wait for the first menu, pick the Bag command by its label, choose the first item (A), and let the rest run
        await pumpUntil(function () { const top = layers[layers.length - 1]; return top instanceof BattleLayer && top.mode === 'root'; }, 600, null, 1);
        await chooseBattleCommand('battle.bag');
        Input.inject('a', 2);
        await pumpUntil(function () { return result !== null; }, 3000, 'a', 8);
        success = G.party.length === size + 1;
        detail = 'seed ' + seed + ' party ' + G.party.length + ' result ' + result;
      }
      check('recruit success path adds the creature and the dossier entry', success && G.dex.got.fakelakis, detail);
    });
    await guard('hospital', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      // Walk in through the town door.
      world.loadMap('town', 15, 14, 'up');
      Input.inject('up', 12);
      const inside = await pumpUntil(function () { return world.mapId === 'hospital' && Fade.alpha === 0 && !world.busy; }, 400, null, 1);
      check('the town door leads into the hospital', inside && G.player.map === 'hospital', world.mapId);
      // Heal through the reception counter: no envelope in the bag, so it happens "at once".
      world.loadMap('hospital', 4, 3, 'up');
      const lead = G.party[0];
      lead.hp = 1; lead.status = { id: 'str', turns: 2 };
      G.bag.fakelaki = 0;
      G.lastHeal = { map: 'town', x: 1, y: 1, dir: 'up' };
      Input.inject('a', 2);
      const healed = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('the receptionist heals the team (HP and status) and the hospital becomes the return point', healed && lead.status === null && G.lastHeal.map === 'hospital', 'hp ' + lead.hp + '/' + maxHp(lead));
      // The VIP offer with a Φακελάκι: the first answer (Yes) spends exactly one.
      lead.hp = 1;
      G.bag.fakelaki = 2;
      Input.inject('a', 2);
      const vip = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('the VIP service heals too and spends one Φακελάκι', vip && G.bag.fakelaki === 1, 'fakelaki ' + G.bag.fakelaki);
      // The archive terminal: deposit the second creature, then bring it back.
      if (G.party.length < 2) G.party.push(makeMon('fakelakis', 3));
      const teamBefore = G.party.length;
      const archiveBefore = G.archive.length;
      const second = G.party[1].sp;
      world.loadMap('hospital', 1, 4, 'up');
      Input.inject('a', 2);
      await pumpUntil(function () { return topLayer() instanceof ChoiceLayer; }, 600, 'a', 8);
      const menuShown = topLayer() instanceof ChoiceLayer;
      await pumpFrames(3); // let the last injected press end, so the next one is a new press
      Input.inject('a', 2); // Deposit
      await pumpUntil(function () { return topLayer() instanceof PartyLayer; }, 200, null, 1);
      await pumpFrames(3);
      Input.inject('down', 2); await pumpFrames(4);
      Input.inject('a', 2);
      const deposited = await pumpUntil(function () { return G.archive.length === archiveBefore + 1; }, 200, null, 1);
      check('the archive terminal takes a team member', menuShown && deposited && G.party.length === teamBefore - 1 && G.archive[archiveBefore].sp === second, 'team ' + G.party.length + ' archive ' + G.archive.length);
      await pumpUntil(function () { return topLayer() instanceof ChoiceLayer; }, 600, 'a', 8);
      await pumpFrames(3);
      Input.inject('down', 2); await pumpFrames(4);
      Input.inject('a', 2); // Withdraw
      await pumpUntil(function () { return topLayer() instanceof ArchiveLayer; }, 200, null, 1);
      await pumpFrames(3);
      Input.inject('a', 2);
      const withdrawn = await pumpUntil(function () { return deposited && G.archive.length === archiveBefore; }, 200, null, 1);
      check('the archive terminal gives it back', withdrawn && G.party.length === teamBefore && G.party[teamBefore - 1].sp === second, 'team ' + G.party.length + ' archive ' + G.archive.length);
      await pumpUntil(function () { return topLayer() instanceof ChoiceLayer; }, 600, 'a', 8);
      await pumpFrames(3);
      Input.inject('b', 2);
      await pumpUntil(function () { return !world.busy; }, 300, null, 1);
      check('the archive menu closes and the world is free again', !world.busy && !(topLayer() instanceof ChoiceLayer));
    });
    await guard('save', async function () {
      if (!G) throw new Error('no game');
      G.money = 4321; G.flags.testFlag = true;
      G.archive = [makeMon('storoula', 4)];
      const stored = writeSave();
      const loaded = readSave();
      const copy = loaded ? gameFromSave(loaded) : null;
      check('loaded game matches', !!copy && copy.money === 4321 && copy.flags.testFlag === true && copy.party.length === G.party.length &&
        copy.party[0].sp === G.party[0].sp && copy.party[0].lv === G.party[0].lv && copy.player.name === G.player.name, copy ? copy.money : 'null');
      check('the archive survives a save and load', !!copy && copy.archive.length === 1 && copy.archive[0].sp === 'storoula' && copy.archive[0].lv === 4);
      check('save key is mizamon.v1.save with version 3', JSON.parse(Store.get('mizamon.v1.save')).version === 3);
      check('the visited places survive a save and load', !!copy && copy.world.visited.newPeiraias === 1, copy ? JSON.stringify(copy.world) : 'null');
      G.archive = [];
    });
    await guard('language', async function () {
      OPT.lang = 'el'; const greek = T('menu.bag');
      OPT.lang = 'en'; const english = T('menu.bag');
      OPT.lang = 'el';
      check('language toggle changes the strings', greek !== english && english === 'Bag', greek + ' / ' + english);
    });
    await guard('touch', async function () {
      touchForced = true; resizeScreen();
      const buttons = Array.from(touchPad.querySelectorAll('[data-btn]'));
      const shown = touchPad.style.display !== 'none' && buttons.length >= 7;
      const game = canvas.getBoundingClientRect();
      const covering = buttons.filter(function (button) {
        const box = button.getBoundingClientRect();
        return box.left < game.right && box.right > game.left && box.top < game.bottom && box.bottom > game.top;
      }).map(function (button) { return button.getAttribute('data-btn'); });
      // The four d-pad buttons are one drawn arrow turned four ways: same button size, same arrow size, no font glyph, in both layouts and when pressed.
      const pad = ['up', 'down', 'left', 'right'].map(function (name) { return touchPad.querySelector('[data-btn="' + name + '"]'); });
      const glyphs = /[▲▼◀▶]/;
      const padProblems = [];
      for (const layout of ['portrait', 'landscape']) {
        touchPad.className = layout;
        const sizes = pad.map(function (button) {
          const box = button.getBoundingClientRect();
          const arrow = button.querySelector('.arrow');
          const arrowBox = arrow ? arrow.getBoundingClientRect() : { width: 0, height: 0 };
          return [Math.round(box.width), Math.round(box.height), Math.round(arrowBox.width), Math.round(arrowBox.height)].join('x');
        });
        if (new Set(sizes).size !== 1 || sizes[0].split('x').some(function (n) { return Number(n) <= 0; })) padProblems.push(layout + ' sizes ' + sizes.join(','));
        // One drawn arrow turned four ways: four different transforms, and "up" is the unturned one (none or the identity matrix).
        const turns = pad.map(function (button) {
          const arrow = button.querySelector('.arrow');
          return arrow ? getComputedStyle(arrow).transform : '';
        });
        const upIsPlain = turns[0] === 'none' || turns[0] === 'matrix(1, 0, 0, 1, 0, 0)';
        if (new Set(turns).size !== 4 || !upIsPlain) padProblems.push(layout + ' turns ' + turns.join(' ; '));
        for (const button of pad) {
          button.classList.add('on');
          const arrow = button.querySelector('.arrow');
          if (!arrow || getComputedStyle(arrow).backgroundColor !== getComputedStyle(button).color) padProblems.push(layout + ' pressed colour ' + button.getAttribute('data-btn'));
          button.classList.remove('on');
        }
      }
      for (const button of pad) if (glyphs.test(button.textContent)) padProblems.push('glyph in ' + button.getAttribute('data-btn'));
      touchForced = false; resizeScreen();
      check('d-pad arrows are identical drawn shapes in both layouts and pressed (no font glyph)', padProblems.length === 0, padProblems.join(' | '));
      check('touch controls exist when forced on', shown);
      check('no touch button covers the game (' + window.innerWidth + 'x' + window.innerHeight + ')', covering.length === 0, covering.join(','));
    });
    await guard('map screen', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      const settle = function () { return pumpUntil(function () { return !world.busy && topLayer() === world; }, 400, null, 1); };
      world.loadMap('town', 15, 14, 'up');
      await settle();
      // From the pause menu: the entry is the fourth one, closing returns to the menu with the cursor still on it.
      Input.inject('menu', 2);
      await pumpUntil(function () { return topLayer() instanceof ChoiceLayer; }, 100, null, 1);
      await pumpFrames(3);
      for (let i = 0; i < 3; i++) { Input.inject('down', 2); await pumpFrames(3); }
      Input.inject('a', 2);
      const fromMenu = await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      check('the pause menu has a Χάρτης entry that opens the map', fromMenu && T('menu.map') === 'Χάρτης');
      const screen = topLayer();
      check('the marker stands on the current place (town: New Piraeus) and the cursor starts there', fromMenu && screen.marker.id === 'newPeiraias' && !screen.marker.onRoute && screen.cursor === 'newPeiraias', JSON.stringify(screen.marker));
      await pumpFrames(3);
      Input.inject('a', 2); await pumpFrames(3);
      const sheetShown = screen.sheet;
      Input.inject('b', 2); await pumpFrames(3); // the first B leaves the district sheet, not the map
      const sheetLeft = !screen.sheet && topLayer() === screen;
      Input.inject('menu', 2); // the menu input closes the map
      const backToMenu = await pumpUntil(function () { return topLayer() instanceof ChoiceLayer; }, 100, null, 1);
      check('A opens the district sheet, B leaves it, the menu input closes the map and returns to the pause menu on Χάρτης', sheetShown && sheetLeft && backToMenu && topLayer().cursor === 3, 'cursor ' + (topLayer() && topLayer().cursor));
      await pumpFrames(3);
      Input.inject('b', 2); await settle();
      // From the key: Q opens it on the overworld and closes it again, with the player on the same tile.
      const tile = world.px + ',' + world.py;
      MIZAMON.press('map', 2);
      const fromKey = await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      await pumpFrames(3);
      Input.inject('map', 2);
      const closedByKey = await settle();
      check('the map key opens the map and the same key closes it back to the overworld', fromKey && closedByKey && world.px + ',' + world.py === tile && G.player.map === 'town');
      MIZAMON.press('map', 2);
      await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      await pumpFrames(3);
      Input.inject('menu', 2);
      const menuClosed = await settle();
      check('opened by the key, the menu input closes the map back to the overworld (not to the pause menu)', menuClosed);
      MIZAMON.press('map', 2);
      await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      await pumpFrames(3);
      Input.inject('b', 2);
      check('B closes the map back to the overworld', await settle());
      // On a route the marker stands on the route's line, at the fraction the tile gives.
      world.loadMap('route1', 16, 9, 'right');
      await settle();
      MIZAMON.press('map', 2);
      await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      const onRoute = topLayer().marker;
      check('on route 1 the marker is on the route line at the tile fraction', !!onRoute && onRoute.onRoute && onRoute.id === 'route1' && Math.abs(onRoute.fraction - 16.5 / 32) < 1e-9, JSON.stringify(onRoute));
      // The cursor starts on the harbour office (the nearer end), moves to New Piraeus and back, and a direction with no place leaves it.
      const mapScreen = topLayer();
      const cursorAfter = async function (name) { Input.inject(name, 2); await pumpFrames(3); return mapScreen.cursor; };
      const startCursor = mapScreen.cursor;
      const movedLeft = await cursorAfter('left');
      const movedBack = await cursorAfter('right');
      const stayed = await cursorAfter('right');
      check('the cursor moves between New Piraeus and the harbour office with the d-pad and stays where no place lies', startCursor === 'harbourOffice' && movedLeft === 'newPeiraias' && movedBack === 'harbourOffice' && stayed === 'harbourOffice', [startCursor, movedLeft, movedBack, stayed].join(','));
      // draw() reads cached values: with no input, pumped frames and renders build nothing new.
      const realLayout = mapTitleLayout; const realLines = mapInfoLines; const realCentre = mapCellCentre; const realSpecies = districtSpecies;
      let builds = 0;
      mapTitleLayout = function () { builds++; return realLayout.apply(this, arguments); };
      mapInfoLines = function () { builds++; return realLines.apply(this, arguments); };
      mapCellCentre = function () { builds++; return realCentre.apply(this, arguments); };
      districtSpecies = function () { builds++; return realSpecies.apply(this, arguments); };
      try {
        Input.inject('a', 2); await pumpFrames(3); // the sheet opens: one rebuild of the lines
        const afterSheet = builds;
        await pumpFrames(10); renderFrame(); renderFrame();
        check('the map draw builds no layout, lines, positions or species lists per frame', mapScreen.sheet && afterSheet >= 1 && builds === afterSheet, afterSheet + ' then ' + builds);
      } finally { mapTitleLayout = realLayout; mapInfoLines = realLines; mapCellCentre = realCentre; districtSpecies = realSpecies; }
      Input.inject('b', 2); await pumpFrames(3);
      Input.inject('b', 2); await settle();
      check('closing the map returns to the overworld on the same tile', world.px === 16 && world.py === 9);
      world.loadMap('town', 15, 14, 'up');
      await settle();
      // The map is drawn without error and its pixels differ from an empty screen.
      MIZAMON.press('map', 2);
      await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      renderFrame();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 0; i < pixels.length; i += 16) if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) lit++;
      check('the map screen paints the whole screen', lit > pixels.length / 16 * 0.9, lit);
      await pumpFrames(3); Input.inject('b', 2); await settle();
      // Every text line fits in 232 px in both languages, the title bar with its badge pips and "n/6" included.
      const language = OPT.lang;
      const wide = [];
      for (const lang of ['el', 'en']) {
        OPT.lang = lang; resetTextCache();
        for (let won = 0; won <= WORLD_BADGE_COUNT; won++) {
          const layout = mapTitleLayout(won);
          if (layout.pipsX - layout.leftEnd < 4) wide.push(lang + ' title ' + won + ': ends at ' + layout.leftEnd + ', pips start at ' + layout.pipsX);
        }
        const probe = newWorldState();
        for (const id of Object.keys(WORLD.nodes)) { probe.visited[id] = 1; probe.badges[WORLD.nodes[id].district] = 1; }
        ctx.font = FONT;
        for (const id of Object.keys(WORLD.nodes)) {
          for (const sheet of [false, true]) {
            mapInfoLines(probe, id, sheet).forEach(function (line, index) {
              const room = sheet && index === 0 ? MAP_TEXT_LIMIT - MAP_PIP - 4 : MAP_TEXT_LIMIT; // the sheet's first line shares its row with the badge pip
              if (ctx.measureText(line).width > room) wide.push(lang + ' ' + id + ': ' + line);
            });
          }
        }
      }
      OPT.lang = language; resetTextCache();
      check('the title bar with the badge pips and every info line fit in 232 px in both languages', wide.length === 0, wide.join(' | '));
    });
    await guard('piraeus rework', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      const settle = function () { return pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, null, 1); };
      delete G.flags.badge; delete G.flags.credits;
      // The gate at the east edge of route 1: shut without the Port Medal (a few steps against it change nothing), open with it.
      world.loadMap('route1', 30, 10, 'right');
      await settle();
      Input.inject('right', 12);
      await pumpFrames(24);
      check('route 1: the east gate is shut without the Port Medal', world.mapId === 'route1' && world.px === 30, world.mapId + ' ' + world.px);
      G.flags.badge = true;
      Input.inject('right', 12);
      const onRoute2 = await pumpUntil(function () { return world.mapId === 'route2' && Fade.alpha === 0 && !world.busy; }, 400, null, 1);
      check('route 1: with the badge the gate leads to route 2 (the quay road)', onRoute2 && G.player.map === 'route2' && world.px === 1 && world.py === 8, world.mapId + ' ' + world.px + ',' + world.py);
      // Route 2 to the east end, then into Καστέλλα.
      world.loadMap('route2', 38, 8, 'right');
      await settle();
      Input.inject('right', 12);
      const inKastella = await pumpUntil(function () { return world.mapId === 'kastella' && Fade.alpha === 0 && !world.busy; }, 400, null, 1);
      check('route 2 leads into Καστέλλα, and the town has a way back', inKastella && G.player.map === 'kastella' && world.px === 1 && world.py === 12, world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      const backOnRoute2 = await pumpUntil(function () { return world.mapId === 'route2' && Fade.alpha === 0 && !world.busy; }, 400, null, 1);
      check('Καστέλλα leads back to the east end of route 2', backOnRoute2 && world.px === 38 && world.py === 8, world.mapId + ' ' + world.px + ',' + world.py);
      // The new maps and tiles are drawn: a frame on each map paints the screen, and every tile character has a sprite.
      const missing = Object.keys(TILE_DEFS).filter(function (char) { return char !== '~' && !tileSprites[char]; });
      check('every tile character has a sprite (the ferry, crane, yacht and ΚΤΕΛ stop included)', missing.length === 0, missing.join(','));
      const paintsScreen = function () {
        renderFrame();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 16) if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) lit++;
        return lit > pixels.length / 16 * 0.25; // the kiosk (8 x 6 tiles) fills a third of the screen: black borders around it
      };
      const painted = [];
      for (const [mapId, x, y] of [['route2', 17, 8], ['kastella', 12, 8], ['kastella_hospital', 5, 5], ['kastella_shop', 3, 3], ['kastella_theatre', 5, 5], ['town', 15, 14]]) {
        world.loadMap(mapId, x, y, 'up');
        await settle();
        await pumpFrames(2);
        if (!paintsScreen()) painted.push(mapId);
      }
      check('route 2, Καστέλλα, its three buildings and the town paint the screen', painted.length === 0, painted.join(','));
      // The Καστέλλα hospital heals and becomes the return point.
      world.loadMap('kastella_hospital', 4, 3, 'up');
      await settle();
      const lead = G.party[0];
      lead.hp = 1; G.bag.fakelaki = 0;
      G.lastHeal = { map: 'hospital', x: 5, y: 7, dir: 'up' };
      Input.inject('a', 2);
      const healedThere = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('the Καστέλλα hospital heals the team and becomes the black-out spot', healedThere && G.lastHeal.map === 'kastella_hospital', JSON.stringify(G.lastHeal));
      check('route 2 has its two trainers and the Εφοπλιστάκος is in the grass', MAPS.route2.npcs.filter(function (n) { return n.kind === 'trainer'; }).length === 2 && MAPS.route2.zones.some(function (z) { return z.table.some(function (e) { return e.sp === 'efoplistakos'; }); }));
      // The map screen shows the new places: Καστέλλα is told about with the badge, visited once entered; route 2 shows as a line with the marker on it.
      delete G.world.seen.kastella; delete G.world.visited.kastella; delete G.world.routes.route2;
      world.loadMap('town', 15, 14, 'up');
      await settle();
      MIZAMON.press('map', 2);
      await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      const seenScreen = topLayer();
      check('with the Port Medal the map tells about Καστέλλα (seen) and it can be selected', placeState(G.world, 'kastella') === 'seen' && worldCandidates(G.world).includes('kastella'), placeState(G.world, 'kastella'));
      await pumpFrames(3);
      for (let i = 0; i < 8 && seenScreen.cursor !== 'kastella'; i++) { Input.inject('right', 2); await pumpFrames(3); }
      check('the cursor reaches Καστέλλα with the d-pad', seenScreen.cursor === 'kastella', seenScreen.cursor);
      Input.inject('b', 2);
      check('B closes the map again', await settle());
      world.loadMap('route2', 20, 8, 'right');
      await settle();
      MIZAMON.press('map', 2);
      await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      const routeMarker = topLayer().marker;
      check('on route 2 the marker is on its line at the tile fraction, and the route is now walked', !!routeMarker && routeMarker.onRoute && routeMarker.id === 'route2' && Math.abs(routeMarker.fraction - 20.5 / 40) < 1e-9 && G.world.routes.route2 === 1, JSON.stringify(routeMarker));
      await pumpFrames(3); Input.inject('b', 2); await settle();
      world.loadMap('kastella', 12, 8, 'up');
      await settle();
      MIZAMON.press('map', 2);
      await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1);
      check('in Καστέλλα the marker stands on the town and the town counts as visited', topLayer().marker.id === 'kastella' && placeState(G.world, 'kastella') === 'visited', JSON.stringify(topLayer().marker));
      await pumpFrames(3); Input.inject('b', 2); await settle();
      // After Κώτσος: the badge, then the short chapter card (never the credits roll), then the flag credits and the studio line.
      delete G.flags.badge; delete G.flags.credits;
      world.loadMap('port', 5, 8, 'up');
      await settle();
      let sawCard = false; let sawCredits = false; let sawBadge = false; let finished = false;
      world.bossVictory('kotsos').then(function () { finished = true; });
      await pumpUntil(function () {
        sawBadge = sawBadge || layers.some(function (l) { return l instanceof BadgeLayer; });
        sawCard = sawCard || layers.some(function (l) { return l instanceof ChapterLayer; });
        sawCredits = sawCredits || layers.some(function (l) { return l instanceof CreditsLayer; });
        return finished;
      }, 3000, 'a', 6);
      check('after the boss the badge and the "Chapter 1 complete" card show, no credits roll, and the credits flag is set', finished && sawBadge && sawCard && !sawCredits && G.flags.badge === true && G.flags.credits === true, [finished, sawBadge, sawCard, sawCredits, G.flags.badge, G.flags.credits].join(' '));
      const language = OPT.lang;
      const tooWide = [];
      ctx.font = FONT;
      for (const lang of ['el', 'en']) for (const key of ['chapter.title', 'chapter.sub', 'badge.title', 'badge.sub']) if (ctx.measureText(lookupString(key, lang)).width > 232) tooWide.push(lang + ' ' + key);
      OPT.lang = language;
      check('the chapter card and the badge texts fit the screen in both languages', tooWide.length === 0, tooWide.join(','));
      check('the studio opens on the credits flag (old saves lose nothing)', warpOpen(MAPS.town.warps.find(function (w) { return w.to === 'studio'; }), G.flags));
    });
    await guard('notia', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      const settle = function () { return pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, null, 1); };
      const arrive = function (mapId, x, y) { return pumpUntil(function () { return world.mapId === mapId && world.px === x && world.py === y && Fade.alpha === 0 && !world.busy; }, 400, null, 1); };
      // The gate: the east end of the Καστέλλα promenade is shut without the Port Medal and leads to route 3 with it.
      delete G.flags.badge;
      world.loadMap('kastella', 24, 14, 'right');
      await settle();
      Input.inject('right', 12);
      await pumpFrames(24);
      check('Καστέλλα: the road to Νότια is shut without the Port Medal', world.mapId === 'kastella' && world.px === 24, world.mapId + ' ' + world.px);
      G.flags.badge = true;
      Input.inject('right', 12);
      check('Καστέλλα: with the Port Medal the promenade leads to route 3 (Poseidon Avenue)', await arrive('route3', 1, 8), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route3', 38, 8, 'right');
      await settle();
      Input.inject('right', 12);
      check('route 3 leads into Παλαιό Φάληρο', await arrive('faliro', 1, 9), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('Παλαιό Φάληρο leads back to the east end of route 3', await arrive('route3', 38, 8), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('faliro', 28, 9, 'right');
      await settle();
      Input.inject('right', 12);
      check('Παλαιό Φάληρο leads on to route 4 (the old airfield)', await arrive('route4', 1, 8), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route4', 34, 8, 'right');
      await settle();
      Input.inject('right', 12);
      check('route 4 leads into Γλυφάδα', await arrive('glyfada', 1, 7), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('Γλυφάδα leads back to route 4', await arrive('route4', 34, 8), world.mapId + ' ' + world.px + ',' + world.py);
      // Every new map paints the screen.
      const paintsScreen = function () {
        renderFrame();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 16) if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) lit++;
        return lit > pixels.length / 16 * 0.25;
      };
      const painted = [];
      for (const [mapId, x, y] of [['route3', 20, 8], ['faliro', 14, 9], ['faliro_hospital', 5, 5], ['faliro_shop', 3, 3], ['faliro_cafe', 4, 5], ['route4', 17, 8], ['glyfada', 12, 7], ['glyfada_hospital', 5, 5], ['glyfada_shop', 3, 3], ['glyfada_boss', 5, 6]]) {
        world.loadMap(mapId, x, y, 'up');
        await settle();
        await pumpFrames(2);
        if (!paintsScreen()) painted.push(mapId);
      }
      check('the ten new maps paint the screen', painted.length === 0, painted.join(','));
      // Παλαιό Φάληρο: the hospital heals and becomes the return point; the café saves.
      world.loadMap('faliro_hospital', 4, 3, 'up');
      await settle();
      const lead = G.party[0];
      lead.hp = 1; G.bag.fakelaki = 0;
      G.lastHeal = { map: 'hospital', x: 5, y: 7, dir: 'up' };
      Input.inject('a', 2);
      const healed = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Παλαιό Φάληρο: the hospital heals the team and becomes the black-out spot', healed && G.lastHeal.map === 'faliro_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('faliro_cafe', 3, 3, 'up');
      await settle();
      delete Store.memory[SAVE_KEY];
      Input.inject('a', 2);
      const savedAtCafe = await pumpUntil(function () { return !world.busy && Store.memory[SAVE_KEY] !== undefined; }, 1800, 'a', 6);
      check('Παλαιό Φάληρο: the café «Ο Παραλιακός» saves the game', savedAtCafe && migrateSave(JSON.parse(Store.memory[SAVE_KEY])).player.map === 'faliro_cafe', String(savedAtCafe));
      // Γλυφάδα: its hospital heals; the kiosk sells the two new items and a purchase works.
      world.loadMap('glyfada_hospital', 4, 3, 'up');
      await settle();
      lead.hp = 1;
      Input.inject('a', 2);
      const healedTwo = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Γλυφάδα: the hospital heals the team and becomes the black-out spot', healedTwo && G.lastHeal.map === 'glyfada_hospital', JSON.stringify(G.lastHeal));
      check('the kiosks of Νότια sell eight items (the two new ones last), the New Piraeus kiosk six', shopStockOf(MAPS.glyfada_shop).length === 8 && shopStockOf(MAPS.faliro_shop).length === 8 && shopStockOf(MAPS.shop).length === 6 && shopStockOf(MAPS.glyfada_shop)[7] === 'gemista');
      world.loadMap('glyfada_shop', 3, 3, 'up');
      await settle();
      G.money = 1000; G.bag.gemista = 0;
      Input.inject('a', 2);
      await pumpUntil(function () { return topLayer() instanceof ShopLayer; }, 600, 'a', 6);
      const shopLayer = topLayer();
      check('the Glyfada kiosk opens with its own stock', shopLayer instanceof ShopLayer && shopLayer.stock.length === 8, shopLayer.stock ? shopLayer.stock.length : 'no shop');
      for (let i = 0; i < 7; i++) { Input.inject('down', 2); await pumpFrames(3); }
      Input.inject('a', 2); await pumpFrames(4);
      check('buying the last item (Γεμιστά της Μάνας, 300) takes the money and fills the bag', G.bag.gemista === 1 && G.money === 700, G.bag.gemista + ' ' + G.money);
      Input.inject('b', 2);
      await pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, 'a', 6); // the goodbye line of the shopkeeper
      // The boss: a won fight through the real code gives the prize, the Coast Medal, no chapter card and no credits roll.
      world.loadMap('glyfada_boss', 5, 4, 'up');
      await settle();
      G.party.length = 1;
      G.party[0] = makeMon('diakosdisko', 50);
      G.starter = 'psaltak';
      G.money = 0; delete G.flags.badge_notia; delete G.flags.t_bougatsas; G.flags.badge = true; delete G.flags.credits;
      const boss = world.visibleNpcs().find(function (npc) { return npc.def.id === 'bougatsas'; });
      let sawBadge = false; let sawCard = false; let sawCredits = false; let finished = false; let sawMark = false; let markOnPlayer = false;
      world.busy = true; // as the game does while a scene runs: the A presses of this test do not start a second talk
      world.challenge(boss, false).then(function () { world.busy = false; finished = true; });
      await pumpUntil(function () {
        sawBadge = sawBadge || layers.some(function (l) { return l instanceof BadgeLayer; });
        sawCard = sawCard || layers.some(function (l) { return l instanceof ChapterLayer; });
        sawCredits = sawCredits || layers.some(function (l) { return l instanceof CreditsLayer; });
        sawMark = sawMark || layers.some(function (l) { return l instanceof BattleLayer && l.views[1].boostMark > 0; });
        markOnPlayer = markOnPlayer || layers.some(function (l) { return l instanceof BattleLayer && l.views[0].boostMark > 0; });
        return finished;
      }, 12000, 'a', 6);
      const markFoes = [];
      for (const trainerId of Object.keys(TRAINERS)) {
        const marked = buildTrainerTeam(trainerId, 'komma').some(function (mon) { return boostMarkOffset(mon, 'Lv 20') > 0; });
        if (marked !== !!TRAINERS[trainerId].boost) markFoes.push(trainerId); // every boosted boss shows the mark (Μπουγάτσας here; later bosses with a boost, such as Ο Υφυπουργός, too), no other trainer
      }
      check('the boost mark shows beside the level of the boss\' creatures only (not the player\'s, not any other trainer\'s) and the boss fight showed it', sawMark && !!TRAINERS.bougatsas.boost && !markOnPlayer && markFoes.length === 0 && boostMarkOffset(makeMon('komma', 20), 'Lv 20') === 0, [sawMark, markOnPlayer, markFoes.join(',')].join(' '));
      check('the boss fight is won through the UI: prize 20 x 30 + 200, the flag badge_notia, the badge card, no chapter card, no credits roll', finished && G.flags.t_bougatsas === true && G.flags.badge_notia === true && sawBadge && !sawCard && !sawCredits && !G.flags.credits && G.money === 800,
        [finished, G.flags.t_bougatsas, G.flags.badge_notia, sawBadge, sawCard, sawCredits, G.flags.credits, G.money].join(' '));
      // A lost fight sends the player back to the last hospital and sets no badge (the rules already cover the numbers; this is the flag path).
      check('the Coast Medal is not set by anything but the boss (the first badge flag is untouched)', G.flags.badge === true && TRAINERS.bougatsas.victory.flag === 'badge_notia');
      // The map shows Νότια: the routes as lines with the marker, the towns told about and visited, the district cleared.
      const openMap = async function () { MIZAMON.press('map', 2); await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1); await pumpFrames(3); return topLayer(); };
      const closeMap = async function () { Input.inject('b', 2); await settle(); };
      G.world.visited = {}; G.world.routes = {}; G.world.seen = {}; G.world.stops = {};
      world.loadMap('route3', 20, 8, 'right');
      await settle();
      let screen = await openMap();
      check('on route 3 the marker is on its line, the route is walked, Παλαιό Φάληρο is told about', screen.marker.onRoute && screen.marker.id === 'route3' && Math.abs(screen.marker.fraction - 20.5 / 40) < 1e-9 && G.world.routes.route3 === 1 && placeState(G.world, 'faliro') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('faliro', 14, 9, 'right');
      await settle();
      screen = await openMap();
      check('in Παλαιό Φάληρο the marker stands on the town and the town is visited', screen.marker.id === 'faliro' && placeState(G.world, 'faliro') === 'visited' && worldCandidates(G.world).includes('faliro'), JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('glyfada', 12, 7, 'right');
      await settle();
      screen = await openMap();
      for (let i = 0; i < 10 && screen.cursor !== 'glyfada'; i++) { Input.inject('right', 2); await pumpFrames(3); }
      check('Γλυφάδα is visited, its cursor can be reached, and the district shows as cleared with the Coast Medal', screen.marker.id === 'glyfada' && placeState(G.world, 'glyfada') === 'visited' && screen.cursor === 'glyfada' && districtState(G.world, 'notia') === 'cleared' && G.world.badges.notia === 1, screen.cursor + ' ' + districtState(G.world, 'notia'));
      await closeMap();
      // The texts fit and the starter's middle form shows up: Κομματάκι at level 16 becomes Βουλευτάκος.
      const language = OPT.lang;
      const tooWide = [];
      ctx.font = FONT;
      for (const lang of ['el', 'en']) {
        for (const key of ['badge.notia.title', 'badge.notia.sub']) if (ctx.measureText(lookupString(key, lang)).width > 232) tooWide.push(lang + ' ' + key);
        for (const mapId of Object.keys(MAPS)) if (/^(route3|route4|faliro|glyfada)/.test(mapId) && ctx.measureText(lookupString(MAPS[mapId].name, lang)).width > 232) tooWide.push(lang + ' ' + mapId);
      }
      OPT.lang = language;
      check('the Coast Medal texts and the names of the new maps fit the screen in both languages', tooWide.length === 0, tooWide.join(','));
      // The shop's name column: from x 18 to the count column at x 150 (right-aligned "x99" is about 16 px wide), so a name may be 116 px at most.
      const wideNames = [];
      ctx.font = FONT;
      for (const lang of ['el', 'en']) {
        for (const id of Object.keys(ITEMS)) {
          const nameWidth = Math.ceil(ctx.measureText(lookupString('item.' + id, lang)).width);
          if (nameWidth > SHOP_NAME_MAX_W) wideNames.push(lang + ' ' + id + ' ' + nameWidth);
        }
      }
      check('every item name fits the shop name column (' + SHOP_NAME_MAX_W + ' px) in both languages', wideNames.length === 0, wideNames.join(', '));
      G.party[0] = makeMon('komma', 16);
      runEvolutions();
      await pumpUntil(function () { return G.party[0].sp === 'vouleftakos' && topLayer() === world; }, 600, null, 1);
      check('a Κομματάκι of level 16 evolves into the Βουλευτάκος and the dossier knows it', G.party[0].sp === 'vouleftakos' && G.dex.got.vouleftakos === true, G.party[0].sp);
    });
    await guard('anatolika', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      const settle = function () { return pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, null, 1); };
      const arrive = function (mapId, x, y) { return pumpUntil(function () { return world.mapId === mapId && world.px === x && world.py === y && Fade.alpha === 0 && !world.busy; }, 400, null, 1); };
      // The gate: the east end of the Γλυφάδα street is shut without the Coast Medal and leads to route 5 with it.
      delete G.flags.badge_notia;
      world.loadMap('glyfada', 26, 7, 'right');
      await settle();
      Input.inject('right', 12);
      await pumpFrames(24);
      check('Γλυφάδα: the road to Ανατολικά is shut without the Coast Medal', world.mapId === 'glyfada' && world.px === 26, world.mapId + ' ' + world.px);
      G.flags.badge_notia = true;
      Input.inject('right', 12);
      check('Γλυφάδα: with the Coast Medal the street leads to route 5 (the Hymettus pass)', await arrive('route5', 1, 13), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('route 5 leads back to the east end of Γλυφάδα', await arrive('glyfada', 26, 7), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route5', 34, 4, 'right');
      await settle();
      Input.inject('right', 12);
      check('route 5 leads into Κορωπί', await arrive('koropi', 1, 9), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('Κορωπί leads back to route 5', await arrive('route5', 34, 4), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('koropi', 24, 9, 'right');
      await settle();
      Input.inject('right', 12);
      check('Κορωπί leads on to route 6 (the plain)', await arrive('route6', 1, 8), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route6', 38, 8, 'right');
      await settle();
      Input.inject('right', 12);
      check('route 6 leads into Σπάτα', await arrive('spata', 1, 9), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('Σπάτα leads back to route 6', await arrive('route6', 38, 8), world.mapId + ' ' + world.px + ',' + world.py);
      // Every new map paints the screen, and every new species has a sprite.
      const paintsScreen = function () {
        renderFrame();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 16) if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) lit++;
        return lit > pixels.length / 16 * 0.25;
      };
      const painted = [];
      for (const [mapId, x, y] of [['route5', 18, 13], ['koropi', 12, 9], ['koropi_hospital', 5, 5], ['koropi_shop', 3, 3], ['koropi_cafe', 4, 5], ['route6', 10, 8], ['spata', 12, 9], ['spata_hospital', 5, 5], ['spata_shop', 3, 3], ['spata_boss', 6, 6]]) {
        world.loadMap(mapId, x, y, 'up');
        await settle();
        await pumpFrames(2);
        if (!paintsScreen()) painted.push(mapId);
      }
      check('the ten new maps paint the screen', painted.length === 0, painted.join(','));
      const noSprite = ['monastiriaki', 'monimos', 'influenza', 'kryptomakis', 'nftarchis'].filter(function (id) { const sprite = creatureSprite(id); return !sprite || sprite.width < 16; });
      check('the five new creatures have a sprite', noSprite.length === 0, noSprite.join(','));
      // Κορωπί: the hospital heals and becomes the return point; the café saves. Σπάτα: its hospital heals; the kiosk opens with the eight items.
      world.loadMap('koropi_hospital', 4, 3, 'up');
      await settle();
      const lead = G.party[0];
      lead.hp = 1; G.bag.fakelaki = 0;
      G.lastHeal = { map: 'hospital', x: 5, y: 7, dir: 'up' };
      Input.inject('a', 2);
      const healed = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Κορωπί: the hospital heals the team and becomes the black-out spot', healed && G.lastHeal.map === 'koropi_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('koropi_cafe', 3, 3, 'up');
      await settle();
      delete Store.memory[SAVE_KEY];
      Input.inject('a', 2);
      const savedAtCafe = await pumpUntil(function () { return !world.busy && Store.memory[SAVE_KEY] !== undefined; }, 1800, 'a', 6);
      check('Κορωπί: the café «Το Κτήμα» saves the game', savedAtCafe && migrateSave(JSON.parse(Store.memory[SAVE_KEY])).player.map === 'koropi_cafe', String(savedAtCafe));
      world.loadMap('spata_hospital', 4, 3, 'up');
      await settle();
      lead.hp = 1;
      Input.inject('a', 2);
      const healedTwo = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Σπάτα: the hospital heals the team and becomes the black-out spot', healedTwo && G.lastHeal.map === 'spata_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('spata_shop', 3, 3, 'up');
      await settle();
      Input.inject('a', 2);
      await pumpUntil(function () { return topLayer() instanceof ShopLayer; }, 600, 'a', 6);
      const shopLayer = topLayer();
      check('the Σπάτα kiosk opens with the eight items of Νότια (Ανατολικά adds none)', shopLayer instanceof ShopLayer && shopLayer.stock.length === 8 && shopStockOf(MAPS.koropi_shop).length === 8, shopLayer.stock ? shopLayer.stock.length : 'no shop');
      Input.inject('b', 2);
      await pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, 'a', 6);
      // The boss: a won fight through the real code gives the prize, the Boarding Medal, no chapter card and no credits roll; the boost mark shows for her creatures only.
      world.loadMap('spata_boss', 6, 4, 'up');
      await settle();
      G.party.length = 1;
      G.party[0] = makeMon('diakosdisko', 50);
      G.starter = 'psaltak';
      G.money = 0; delete G.flags.badge_anatolika; delete G.flags.t_faia; G.flags.badge = true; G.flags.badge_notia = true; delete G.flags.credits;
      const boss = world.visibleNpcs().find(function (npc) { return npc.def.id === 'faia'; });
      let sawBadge = false; let sawCard = false; let sawCredits = false; let finished = false; let sawMark = false; let markOnPlayer = false;
      world.busy = true; // as the game does while a scene runs: the A presses of this test do not start a second talk
      world.challenge(boss, false).then(function () { world.busy = false; finished = true; });
      await pumpUntil(function () {
        sawBadge = sawBadge || layers.some(function (l) { return l instanceof BadgeLayer; });
        sawCard = sawCard || layers.some(function (l) { return l instanceof ChapterLayer; });
        sawCredits = sawCredits || layers.some(function (l) { return l instanceof CreditsLayer; });
        sawMark = sawMark || layers.some(function (l) { return l instanceof BattleLayer && l.views[1].boostMark > 0; });
        markOnPlayer = markOnPlayer || layers.some(function (l) { return l instanceof BattleLayer && l.views[0].boostMark > 0; });
        return finished;
      }, 12000, 'a', 6);
      const markFoes = [];
      for (const trainerId of Object.keys(TRAINERS)) {
        const marked = buildTrainerTeam(trainerId, 'komma').some(function (mon) { return boostMarkOffset(mon, 'Lv 20') > 0; });
        if (marked !== !!TRAINERS[trainerId].boost) markFoes.push(trainerId);
      }
      check('the boost mark shows beside the level of the creatures of a boosted boss only (not the player\'s, not any other trainer\'s) and the boss fight showed it when she has one', !markOnPlayer && markFoes.length === 0 && sawMark === !!TRAINERS.faia.boost, [sawMark, markOnPlayer, markFoes.join(',')].join(' '));
      check('the boss fight is won through the UI: prize 26 x 30 + 200, the flag badge_anatolika, the badge card, no chapter card, no credits roll', finished && G.flags.t_faia === true && G.flags.badge_anatolika === true && sawBadge && !sawCard && !sawCredits && !G.flags.credits && G.money === 980,
        [finished, G.flags.t_faia, G.flags.badge_anatolika, sawBadge, sawCard, sawCredits, G.flags.credits, G.money].join(' '));
      // The map shows Ανατολικά: both routes as lines with the marker, the towns told about and visited, the district cleared.
      const openMap = async function () { MIZAMON.press('map', 2); await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1); await pumpFrames(3); return topLayer(); };
      const closeMap = async function () { Input.inject('b', 2); await settle(); };
      G.world.visited = {}; G.world.routes = {}; G.world.seen = {}; G.world.stops = {};
      world.loadMap('route5', 18, 13, 'right');
      await settle();
      let screen = await openMap();
      check('on route 5 the marker is on its line, the route is walked, Κορωπί is told about', screen.marker.onRoute && screen.marker.id === 'route5' && Math.abs(screen.marker.fraction - 18.5 / 36) < 1e-9 && G.world.routes.route5 === 1 && placeState(G.world, 'koropi') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('route6', 20, 8, 'right');
      await settle();
      screen = await openMap();
      check('on route 6 the marker is on its line and Σπάτα is told about', screen.marker.onRoute && screen.marker.id === 'route6' && Math.abs(screen.marker.fraction - 20.5 / 40) < 1e-9 && placeState(G.world, 'spata') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('koropi', 12, 9, 'right');
      await settle();
      screen = await openMap();
      check('in Κορωπί the marker stands on the town and the town is visited', screen.marker.id === 'koropi' && placeState(G.world, 'koropi') === 'visited' && worldCandidates(G.world).includes('koropi'), JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('spata', 12, 9, 'right');
      await settle();
      screen = await openMap();
      for (let i = 0; i < 10 && screen.cursor !== 'spata'; i++) { Input.inject('right', 2); await pumpFrames(3); }
      check('Σπάτα is visited, its cursor can be reached, and the district shows as cleared with the Boarding Medal', screen.marker.id === 'spata' && placeState(G.world, 'spata') === 'visited' && screen.cursor === 'spata' && districtState(G.world, 'anatolika') === 'cleared' && G.world.badges.anatolika === 1, screen.cursor + ' ' + districtState(G.world, 'anatolika'));
      await closeMap();
      // The texts fit, and the evolutions of 11.3 work: Δημοσιοϋπαλληλάκι at 20, Story-ούλα at 22, Κρυπτο-Μάκης at 26.
      const language = OPT.lang;
      const tooWide = [], noName = [];
      ctx.font = FONT;
      for (const lang of ['el', 'en']) {
        for (const key of ['badge.anatolika.title', 'badge.anatolika.sub']) if (ctx.measureText(lookupString(key, lang)).width > 232) tooWide.push(lang + ' ' + key);
        for (const mapId of Object.keys(MAPS)) if (/^(route5|route6|koropi|spata)/.test(mapId) && ctx.measureText(lookupString(MAPS[mapId].name, lang)).width > 232) tooWide.push(lang + ' ' + mapId);
        for (const id of ['monastiriaki', 'monimos', 'influenza', 'kryptomakis', 'nftarchis']) if (ctx.measureText(lookupString('sp.' + id, lang)).width < 1) noName.push(lang + ' ' + id);
      }
      OPT.lang = language;
      check('the Boarding Medal texts and the names of the new maps fit the screen in both languages', tooWide.length === 0, tooWide.join(','));
      check('the five new creatures have a name in both languages', noName.length === 0, noName.join(','));
      const evolved = [];
      for (const [from, level, to] of [['dimosio', 20, 'monimos'], ['storoula', 22, 'influenza'], ['kryptomakis', 26, 'nftarchis']]) {
        G.party[0] = makeMon(from, level);
        runEvolutions();
        await pumpUntil(function () { return G.party[0].sp === to && topLayer() === world; }, 600, null, 1);
        if (G.party[0].sp !== to || G.dex.got[to] !== true) evolved.push(from + '>' + G.party[0].sp);
      }
      check('the three evolutions of 11.3 happen through the game (Δημοσιοϋπαλληλάκι 20, Story-ούλα 22, Κρυπτο-Μάκης 26) and the dossier knows the new forms', evolved.length === 0, evolved.join(','));
    });
    await guard('voreia', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      const settle = function () { return pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, null, 1); };
      const arrive = function (mapId, x, y) { return pumpUntil(function () { return world.mapId === mapId && world.px === x && world.py === y && Fade.alpha === 0 && !world.busy; }, 400, null, 1); };
      // The gate: the east end of the Σπάτα street is shut without the Boarding Medal and leads to route 7 with it.
      delete G.flags.badge_anatolika;
      world.loadMap('spata', 26, 9, 'right');
      await settle();
      Input.inject('right', 12);
      await pumpFrames(24);
      check('Σπάτα: the road to Βόρεια is shut without the Boarding Medal', world.mapId === 'spata' && world.px === 26, world.mapId + ' ' + world.px);
      G.flags.badge_anatolika = true;
      Input.inject('right', 12);
      check('Σπάτα: with the Boarding Medal the street leads to route 7 (the marble mountain)', await arrive('route7', 30, 14), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('right', 12);
      check('route 7 leads back to the east end of Σπάτα', await arrive('spata', 26, 9), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route7', 1, 3, 'left');
      await settle();
      Input.inject('left', 12);
      check('route 7 leads into Κηφισιά', await arrive('kifisia', 24, 9), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('right', 12);
      check('Κηφισιά leads back to route 7', await arrive('route7', 1, 3), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('kifisia', 1, 9, 'left');
      await settle();
      Input.inject('left', 12);
      check('Κηφισιά leads on to route 8 (the boulevard)', await arrive('route8', 42, 6), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route8', 1, 6, 'left');
      await settle();
      Input.inject('left', 12);
      check('route 8 leads into Μαρούσι', await arrive('marousi', 26, 9), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('right', 12);
      check('Μαρούσι leads back to route 8', await arrive('route8', 1, 6), world.mapId + ' ' + world.px + ',' + world.py);
      // Every new map paints the screen, and every new species has a sprite.
      const paintsScreen = function () {
        renderFrame();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 16) if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) lit++;
        return lit > pixels.length / 16 * 0.25;
      };
      const painted = [];
      for (const [mapId, x, y] of [['route7', 18, 14], ['kifisia', 12, 9], ['kifisia_hospital', 5, 5], ['kifisia_shop', 3, 3], ['kifisia_cafe', 4, 5], ['route8', 10, 6], ['marousi', 12, 9], ['marousi_hospital', 5, 5], ['marousi_shop', 3, 3], ['marousi_boss', 6, 6]]) {
        world.loadMap(mapId, x, y, 'up');
        await settle();
        await pumpFrames(2);
        if (!paintsScreen()) painted.push(mapId);
      }
      check('the ten new maps paint the screen', painted.length === 0, painted.join(','));
      const newSpecies = ['star90', 'rialito', 'lobbylykaina', 'giotarchis', 'yperypourgos', 'matanthropos', 'despotakis'];
      const noSprite = newSpecies.filter(function (id) { const sprite = creatureSprite(id); return !sprite || sprite.width < 16; });
      check('the seven new creatures have a sprite', noSprite.length === 0, noSprite.join(','));
      // Κηφισιά: the hospital heals and becomes the return point; the café saves. Μαρούσι: its hospital heals; the kiosk opens with the nine items and sells the new one.
      world.loadMap('kifisia_hospital', 4, 3, 'up');
      await settle();
      const lead = G.party[0];
      lead.hp = 1; G.bag.fakelaki = 0;
      G.lastHeal = { map: 'hospital', x: 5, y: 7, dir: 'up' };
      Input.inject('a', 2);
      const healed = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Κηφισιά: the hospital heals the team and becomes the black-out spot', healed && G.lastHeal.map === 'kifisia_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('kifisia_cafe', 3, 3, 'up');
      await settle();
      delete Store.memory[SAVE_KEY];
      Input.inject('a', 2);
      const savedAtCafe = await pumpUntil(function () { return !world.busy && Store.memory[SAVE_KEY] !== undefined; }, 1800, 'a', 6);
      check('Κηφισιά: the café «Ο Πλάτανος» saves the game', savedAtCafe && migrateSave(JSON.parse(Store.memory[SAVE_KEY])).player.map === 'kifisia_cafe', String(savedAtCafe));
      world.loadMap('marousi_hospital', 4, 3, 'up');
      await settle();
      lead.hp = 1;
      Input.inject('a', 2);
      const healedTwo = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Μαρούσι: the hospital heals the team and becomes the black-out spot', healedTwo && G.lastHeal.map === 'marousi_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('marousi_shop', 3, 3, 'up');
      await settle();
      Input.inject('a', 2);
      await pumpUntil(function () { return topLayer() instanceof ShopLayer; }, 600, 'a', 6);
      const shopLayer = topLayer();
      check('the Μαρούσι kiosk opens with nine items, the Χοντρός Φάκελος last', shopLayer instanceof ShopLayer && shopLayer.stock.length === 9 && shopLayer.stock[8] === 'chontros' && shopStockOf(MAPS.kifisia_shop).length === 9, shopLayer.stock ? shopLayer.stock.length : 'no shop');
      G.money = 1000; G.bag.chontros = 0;
      for (let i = 0; i < 8; i++) { Input.inject('down', 2); await pumpFrames(6); }
      Input.inject('a', 2);
      await pumpFrames(6);
      check('buying the Χοντρός Φάκελος (600) takes the money and fills the bag', G.bag.chontros === 1 && G.money === 400, G.bag.chontros + ' ' + G.money);
      Input.inject('b', 2);
      await pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, 'a', 6);
      // The boss: a won fight through the real code gives the prize, the First Row Medal, no chapter card and no credits roll; the boost mark shows for no creature of hers.
      world.loadMap('marousi_boss', 6, 4, 'up');
      await settle();
      G.party.length = 1;
      G.party[0] = makeMon('despotakis', 50);
      G.starter = 'psaltak';
      G.money = 0; delete G.flags.badge_voreia; delete G.flags.t_amartia; G.flags.badge = true; G.flags.badge_notia = true; G.flags.badge_anatolika = true; delete G.flags.credits;
      const boss = world.visibleNpcs().find(function (npc) { return npc.def.id === 'amartia'; });
      let sawBadge = false; let sawCard = false; let sawCredits = false; let finished = false; let sawMark = false; let markOnPlayer = false;
      world.busy = true; // as the game does while a scene runs: the A presses of this test do not start a second talk
      world.challenge(boss, false).then(function () { world.busy = false; finished = true; });
      await pumpUntil(function () {
        sawBadge = sawBadge || layers.some(function (l) { return l instanceof BadgeLayer; });
        sawCard = sawCard || layers.some(function (l) { return l instanceof ChapterLayer; });
        sawCredits = sawCredits || layers.some(function (l) { return l instanceof CreditsLayer; });
        sawMark = sawMark || layers.some(function (l) { return l instanceof BattleLayer && l.views[1].boostMark > 0; });
        markOnPlayer = markOnPlayer || layers.some(function (l) { return l instanceof BattleLayer && l.views[0].boostMark > 0; });
        return finished;
      }, 12000, 'a', 6);
      const markFoes = [];
      for (const trainerId of Object.keys(TRAINERS)) {
        const marked = buildTrainerTeam(trainerId, 'komma').some(function (mon) { return boostMarkOffset(mon, 'Lv 20') > 0; });
        if (marked !== !!TRAINERS[trainerId].boost) markFoes.push(trainerId);
      }
      check('the boost mark shows beside the level of the creatures of a boosted boss only (not the player\'s, not any other trainer\'s) and the boss fight showed it when he has one', !markOnPlayer && markFoes.length === 0 && sawMark === !!TRAINERS.amartia.boost, [sawMark, markOnPlayer, markFoes.join(',')].join(' '));
      check('the boss fight is won through the UI: prize 32 x 30 + 200, the flag badge_voreia, the badge card, no chapter card, no credits roll', finished && G.flags.t_amartia === true && G.flags.badge_voreia === true && sawBadge && !sawCard && !sawCredits && !G.flags.credits && G.money === 1160,
        [finished, G.flags.t_amartia, G.flags.badge_voreia, sawBadge, sawCard, sawCredits, G.flags.credits, G.money].join(' '));
      // The map shows Βόρεια: both routes as lines with the marker, the towns told about and visited, the district cleared.
      const openMap = async function () { MIZAMON.press('map', 2); await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1); await pumpFrames(3); return topLayer(); };
      const closeMap = async function () { Input.inject('b', 2); await settle(); };
      G.world.visited = {}; G.world.routes = {}; G.world.seen = {}; G.world.stops = {};
      world.loadMap('route7', 18, 14, 'left');
      await settle();
      let screen = await openMap();
      check('on route 7 the marker is on its line (right to left), the route is walked, Κηφισιά is told about', screen.marker.onRoute && screen.marker.id === 'route7' && Math.abs(screen.marker.fraction - (1 - 18.5 / 32)) < 1e-9 && G.world.routes.route7 === 1 && placeState(G.world, 'kifisia') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('route8', 20, 6, 'left');
      await settle();
      screen = await openMap();
      check('on route 8 the marker is on its line and Μαρούσι is told about', screen.marker.onRoute && screen.marker.id === 'route8' && Math.abs(screen.marker.fraction - (1 - 20.5 / 44)) < 1e-9 && placeState(G.world, 'marousi') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('kifisia', 12, 9, 'right');
      await settle();
      screen = await openMap();
      check('in Κηφισιά the marker stands on the town and the town is visited', screen.marker.id === 'kifisia' && placeState(G.world, 'kifisia') === 'visited' && worldCandidates(G.world).includes('kifisia'), JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('marousi', 12, 9, 'right');
      await settle();
      screen = await openMap();
      for (let i = 0; i < 10 && screen.cursor !== 'marousi'; i++) { Input.inject('left', 2); await pumpFrames(3); }
      check('Μαρούσι is visited, its cursor can be reached, and the district shows as cleared with the First Row Medal', screen.marker.id === 'marousi' && placeState(G.world, 'marousi') === 'visited' && screen.cursor === 'marousi' && districtState(G.world, 'voreia') === 'cleared' && G.world.badges.voreia === 1, screen.cursor + ' ' + districtState(G.world, 'voreia'));
      await closeMap();
      // The texts fit, every item name fits the shop column, and the evolutions of 11.3 work: Λαϊκατζής at 27, Εφοπλιστάκος at 30, the starters' middle forms at 32.
      const language = OPT.lang;
      const tooWide = [], noName = [];
      ctx.font = FONT;
      for (const lang of ['el', 'en']) {
        for (const key of ['badge.voreia.title', 'badge.voreia.sub']) if (ctx.measureText(lookupString(key, lang)).width > 232) tooWide.push(lang + ' ' + key);
        for (const mapId of Object.keys(MAPS)) if (/^(route7|route8|kifisia|marousi)/.test(mapId) && ctx.measureText(lookupString(MAPS[mapId].name, lang)).width > 232) tooWide.push(lang + ' ' + mapId);
        for (const id of ITEM_IDS) if (ctx.measureText(lookupString('item.' + id, lang)).width > SHOP_NAME_MAX_W) tooWide.push(lang + ' item ' + id);
        for (const id of newSpecies) if (ctx.measureText(lookupString('sp.' + id, lang)).width < 1) noName.push(lang + ' ' + id);
      }
      OPT.lang = language;
      check('the First Row Medal texts, the names of the new maps and every item name (116 px) fit in both languages', tooWide.length === 0, tooWide.join(','));
      check('the seven new creatures have a dossier text in both languages', noName.length === 0, noName.join(','));
      const evolved = [];
      for (const [from, level, to] of [['laikatzis', 27, 'star90'], ['efoplistakos', 30, 'giotarchis'], ['vouleftakos', 32, 'yperypourgos'], ['batsonos', 32, 'matanthropos'], ['diakosdisko', 32, 'despotakis']]) {
        G.party[0] = makeMon(from, level);
        runEvolutions();
        await pumpUntil(function () { return G.party[0].sp === to && topLayer() === world; }, 600, null, 1);
        if (G.party[0].sp !== to || G.dex.got[to] !== true) evolved.push(from + '>' + G.party[0].sp);
      }
      check('the five evolutions of 11.3 happen through the game (Λαϊκατζής 27, Εφοπλιστάκος 30, the three starters 32) and the dossier knows the new forms', evolved.length === 0, evolved.join(','));
    });
    await guard('dytika', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      const settle = function () { return pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, null, 1); };
      const arrive = function (mapId, x, y) { return pumpUntil(function () { return world.mapId === mapId && world.px === x && world.py === y && Fade.alpha === 0 && !world.busy; }, 400, null, 1); };
      // The gate: the west end of the Μαρούσι street is shut without the First Row Medal and leads to route 9 with it.
      delete G.flags.badge_voreia;
      world.loadMap('marousi', 1, 9, 'left');
      await settle();
      Input.inject('left', 12);
      await pumpFrames(24);
      check('Μαρούσι: the road to Δυτικά is shut without the First Row Medal', world.mapId === 'marousi' && world.px === 1, world.mapId + ' ' + world.px);
      G.flags.badge_voreia = true;
      Input.inject('left', 12);
      check('Μαρούσι: with the First Row Medal the street leads to route 9 (the ring road)', await arrive('route9', 42, 5), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('right', 12);
      check('route 9 leads back to the west end of Μαρούσι', await arrive('marousi', 1, 9), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route9', 1, 5, 'left');
      await settle();
      Input.inject('left', 12);
      check('route 9 leads into Περιστέρι', await arrive('peristeri', 24, 9), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('right', 12);
      check('Περιστέρι leads back to route 9', await arrive('route9', 1, 5), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('peristeri', 1, 9, 'left');
      await settle();
      Input.inject('left', 12);
      check('Περιστέρι leads on to route 10 (Thivon Avenue)', await arrive('route10', 34, 8), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('right', 12);
      check('route 10 leads back into Περιστέρι', await arrive('peristeri', 1, 9), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route10', 1, 8, 'left');
      await settle();
      Input.inject('left', 12);
      check('route 10 leads into Χαϊδάρι', await arrive('chaidari', 26, 9), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('right', 12);
      check('Χαϊδάρι leads back to route 10', await arrive('route10', 1, 8), world.mapId + ' ' + world.px + ',' + world.py);
      // Every new map paints the screen, and every new species has a sprite.
      const paintsScreen = function () {
        renderFrame();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 16) if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) lit++;
        return lit > pixels.length / 16 * 0.25;
      };
      const painted = [];
      for (const [mapId, x, y] of [['route9', 18, 5], ['peristeri', 12, 9], ['peristeri_hospital', 5, 5], ['peristeri_shop', 3, 3], ['peristeri_cafe', 4, 5], ['route10', 10, 8], ['chaidari', 12, 9], ['chaidari_hospital', 5, 5], ['chaidari_shop', 3, 3], ['chaidari_boss', 5, 6]]) {
        world.loadMap(mapId, x, y, 'up');
        await settle();
        await pumpFrames(2);
        if (!paintsScreen()) painted.push(mapId);
      }
      check('the ten new maps paint the screen', painted.length === 0, painted.join(','));
      const newSpecies = ['tavlilordos', 'giagiaexo', 'elegktis', 'ktimatomesitis', 'rousfetolykos'];
      const noSprite = newSpecies.filter(function (id) { const sprite = creatureSprite(id); return !sprite || sprite.width < 16; });
      check('the five new creatures have a sprite', noSprite.length === 0, noSprite.join(','));
      // Περιστέρι: the hospital heals and becomes the return point; the café saves. Χαϊδάρι: its hospital heals; the kiosk opens with the ten items and sells the new one.
      world.loadMap('peristeri_hospital', 4, 3, 'up');
      await settle();
      const lead = G.party[0];
      lead.hp = 1; G.bag.fakelaki = 0;
      G.lastHeal = { map: 'hospital', x: 5, y: 7, dir: 'up' };
      Input.inject('a', 2);
      const healed = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Περιστέρι: the hospital heals the team and becomes the black-out spot', healed && G.lastHeal.map === 'peristeri_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('peristeri_cafe', 3, 3, 'up');
      await settle();
      delete Store.memory[SAVE_KEY];
      Input.inject('a', 2);
      const savedAtCafe = await pumpUntil(function () { return !world.busy && Store.memory[SAVE_KEY] !== undefined; }, 1800, 'a', 6);
      check('Περιστέρι: the café «Η Γωνιά» saves the game', savedAtCafe && migrateSave(JSON.parse(Store.memory[SAVE_KEY])).player.map === 'peristeri_cafe', String(savedAtCafe));
      world.loadMap('chaidari_hospital', 4, 3, 'up');
      await settle();
      lead.hp = 1;
      Input.inject('a', 2);
      const healedTwo = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Χαϊδάρι: the hospital heals the team and becomes the black-out spot', healedTwo && G.lastHeal.map === 'chaidari_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('chaidari_shop', 3, 3, 'up');
      await settle();
      Input.inject('a', 2);
      await pumpUntil(function () { return topLayer() instanceof ShopLayer; }, 600, 'a', 6);
      const shopLayer = topLayer();
      check('the Χαϊδάρι kiosk opens with ten items, the Συλλογική Σύμβαση last', shopLayer instanceof ShopLayer && shopLayer.stock.length === 10 && shopLayer.stock[9] === 'sylvasi' && shopStockOf(MAPS.peristeri_shop).length === 10, shopLayer.stock ? shopLayer.stock.length : 'no shop');
      G.money = 1000; G.bag.sylvasi = 0;
      for (let i = 0; i < 9; i++) { Input.inject('down', 2); await pumpFrames(6); }
      Input.inject('a', 2);
      await pumpFrames(6);
      check('buying the Συλλογική Σύμβαση (150) takes the money and fills the bag', G.bag.sylvasi === 1 && G.money === 850, G.bag.sylvasi + ' ' + G.money);
      Input.inject('b', 2);
      await pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, 'a', 6);
      // The boss: a won fight through the real code gives the prize, the Tax-Free Medal, no chapter card and no credits roll; the boost mark shows only when he has a boost.
      world.loadMap('chaidari_boss', 5, 4, 'up');
      await settle();
      G.party.length = 0;
      for (const speciesId of ['despotakis', 'yperypourgos', 'matanthropos', 'despotakis', 'yperypourgos', 'matanthropos']) G.party.push(makeMon(speciesId, 50)); // six creatures at the level cap: the abbot's five must not win this test
      G.starter = 'psaltak';
      G.money = 0; delete G.flags.badge_dytika; delete G.flags.t_plousiakis; G.flags.badge = true; G.flags.badge_notia = true; G.flags.badge_anatolika = true; G.flags.badge_voreia = true; delete G.flags.credits;
      const boss = world.visibleNpcs().find(function (npc) { return npc.def.id === 'plousiakis'; });
      let sawBadge = false; let sawCard = false; let sawCredits = false; let finished = false; let sawMark = false; let markOnPlayer = false;
      world.busy = true; // as the game does while a scene runs: the A presses of this test do not start a second talk
      world.challenge(boss, false).then(function () { world.busy = false; finished = true; });
      await pumpUntil(function () {
        sawBadge = sawBadge || layers.some(function (l) { return l instanceof BadgeLayer; });
        sawCard = sawCard || layers.some(function (l) { return l instanceof ChapterLayer; });
        sawCredits = sawCredits || layers.some(function (l) { return l instanceof CreditsLayer; });
        sawMark = sawMark || layers.some(function (l) { return l instanceof BattleLayer && l.views[1].boostMark > 0; });
        markOnPlayer = markOnPlayer || layers.some(function (l) { return l instanceof BattleLayer && l.views[0].boostMark > 0; });
        return finished;
      }, 12000, 'a', 6);
      const markFoes = [];
      for (const trainerId of Object.keys(TRAINERS)) {
        const marked = buildTrainerTeam(trainerId, 'komma').some(function (mon) { return boostMarkOffset(mon, 'Lv 20') > 0; });
        if (marked !== !!TRAINERS[trainerId].boost) markFoes.push(trainerId);
      }
      check('the boost mark shows beside the level of the creatures of a boosted boss only (not the player\'s, not any other trainer\'s) and the boss fight showed it when he has one', !markOnPlayer && markFoes.length === 0 && sawMark === !!TRAINERS.plousiakis.boost, [sawMark, markOnPlayer, markFoes.join(',')].join(' '));
      check('the boss fight is won through the UI: prize 38 x 30 + 200, the flag badge_dytika, the badge card, no chapter card, no credits roll', finished && G.flags.t_plousiakis === true && G.flags.badge_dytika === true && sawBadge && !sawCard && !sawCredits && !G.flags.credits && G.money === 1340,
        [finished, G.flags.t_plousiakis, G.flags.badge_dytika, sawBadge, sawCard, sawCredits, G.flags.credits, G.money].join(' '));
      // The map shows Δυτικά: both routes as lines with the marker, the towns told about and visited, the district cleared.
      const openMap = async function () { MIZAMON.press('map', 2); await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1); await pumpFrames(3); return topLayer(); };
      const closeMap = async function () { Input.inject('b', 2); await settle(); };
      G.world.visited = {}; G.world.routes = {}; G.world.seen = {}; G.world.stops = {};
      world.loadMap('route9', 18, 5, 'left');
      await settle();
      let screen = await openMap();
      check('on route 9 the marker is on its line (right to left), the route is walked, Περιστέρι is told about', screen.marker.onRoute && screen.marker.id === 'route9' && Math.abs(screen.marker.fraction - (1 - 18.5 / 44)) < 1e-9 && G.world.routes.route9 === 1 && placeState(G.world, 'peristeri') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('route10', 20, 8, 'left');
      await settle();
      screen = await openMap();
      check('on route 10 the marker is on its line and Χαϊδάρι is told about', screen.marker.onRoute && screen.marker.id === 'route10' && Math.abs(screen.marker.fraction - (1 - 20.5 / 36)) < 1e-9 && placeState(G.world, 'chaidari') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('peristeri', 12, 9, 'right');
      await settle();
      screen = await openMap();
      check('in Περιστέρι the marker stands on the town and the town is visited', screen.marker.id === 'peristeri' && placeState(G.world, 'peristeri') === 'visited' && worldCandidates(G.world).includes('peristeri'), JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('chaidari', 12, 9, 'right');
      await settle();
      screen = await openMap();
      for (let i = 0; i < 10 && screen.cursor !== 'chaidari'; i++) { Input.inject('left', 2); await pumpFrames(3); }
      check('Χαϊδάρι is visited, its cursor can be reached, and the district shows as cleared with the Tax-Free Medal', screen.marker.id === 'chaidari' && placeState(G.world, 'chaidari') === 'visited' && screen.cursor === 'chaidari' && districtState(G.world, 'dytika') === 'cleared' && G.world.badges.dytika === 1, screen.cursor + ' ' + districtState(G.world, 'dytika'));
      await closeMap();
      // The texts fit, every item name fits the shop column, and the four evolutions work (the levels are data of the species).
      const language = OPT.lang;
      const tooWide = [], noName = [];
      ctx.font = FONT;
      for (const lang of ['el', 'en']) {
        for (const key of ['badge.dytika.title', 'badge.dytika.sub']) if (ctx.measureText(lookupString(key, lang)).width > 232) tooWide.push(lang + ' ' + key);
        for (const mapId of Object.keys(MAPS)) if (/^(route9|route10|peristeri|chaidari)/.test(mapId) && ctx.measureText(lookupString(MAPS[mapId].name, lang)).width > 232) tooWide.push(lang + ' ' + mapId);
        for (const id of ITEM_IDS) if (ctx.measureText(lookupString('item.' + id, lang)).width > SHOP_NAME_MAX_W) tooWide.push(lang + ' item ' + id);
        for (const id of newSpecies) if (ctx.measureText(lookupString('sp.' + id, lang)).width < 1) noName.push(lang + ' ' + id);
      }
      OPT.lang = language;
      check('the Tax-Free Medal texts, the names of the new maps and every item name (116 px) fit in both languages', tooWide.length === 0, tooWide.join(','));
      check('the five new creatures have a dossier text in both languages', noName.length === 0, noName.join(','));
      // Every creature name plus the widest level text (level 50) fits the battle name panel without overlap, measured as drawPollPanel draws (name at the left padding, level right-aligned at the right padding).
      const nameRoom = POLL_PANEL.w - 2 * POLL_PANEL.textPad - POLL_PANEL.nameGap;
      const nameTooWide = [];
      let widestName = 0;
      // A boosted boss' creature also carries the boost mark left of its level text (boostMarkOffset), so it has that much less room.
      const boosted = new Set();
      for (const trainer of Object.values(TRAINERS)) if (trainer.boost) for (const entry of trainer.team) boosted.add(entry.sp);
      for (const map of Object.values(MAPS)) for (const npc of map.npcs) if (npc.kind === 'legend' && npc.boost) boosted.add(npc.species); // the legend of the Rock carries a boost too (11.16)
      ctx.font = FONT;
      for (const lang of ['el', 'en']) {
        const levelWidth = ctx.measureText(lookupString('ui.lv', lang) + 50).width;
        for (const id of Object.keys(SPECIES)) {
          const used = ctx.measureText(speciesName(id)).width + levelWidth + (boosted.has(id) ? BOOST_MARK_W + 3 : 0);
          widestName = Math.max(widestName, used);
          if (used > nameRoom) nameTooWide.push(lang + ' ' + id + ' ' + used.toFixed(1));
        }
      }
      check('every creature name plus the level text of level 50 fits the battle name panel in both languages (widest ' + widestName.toFixed(1) + ' of ' + nameRoom + ' px)', nameTooWide.length === 0, nameTooWide.join(','));
      const evolved = [];
      for (const [from, to] of [['kafenovios', 'tavlilordos'], ['giagiaka', 'giagiaexo'], ['eforaki', 'elegktis'], ['monastiriaki', 'ktimatomesitis']]) {
        G.party[0] = makeMon(from, SPECIES[from].evo.lv);
        runEvolutions();
        await pumpUntil(function () { return G.party[0].sp === to && topLayer() === world; }, 600, null, 1);
        if (G.party[0].sp !== to || G.dex.got[to] !== true) evolved.push(from + '>' + G.party[0].sp);
      }
      check('the four evolutions of 11.15 happen through the game (Καφενόβιος, Γιαγιάκα, Εφοράκι, Μοναστηριάκι) and the dossier knows the new forms', evolved.length === 0, evolved.join(','));
    });
    await guard('athina', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      const settle = function () { return pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, null, 1); };
      const arrive = function (mapId, x, y) { return pumpUntil(function () { return world.mapId === mapId && world.px === x && world.py === y && Fade.alpha === 0 && !world.busy; }, 400, null, 1); };
      // The gate: the west end of the Χαϊδάρι street is shut without the Tax-Free Medal and leads to route 11 with it.
      delete G.flags.badge_dytika;
      world.loadMap('chaidari', 1, 9, 'left');
      await settle();
      Input.inject('left', 12);
      await pumpFrames(24);
      check('Χαϊδάρι: the road to Αθήνα is shut without the Tax-Free Medal', world.mapId === 'chaidari' && world.px === 1, world.mapId + ' ' + world.px);
      G.flags.badge_dytika = true;
      Input.inject('left', 12);
      check('Χαϊδάρι: with the Tax-Free Medal the street leads to route 11 (the old road)', await arrive('route11', 1, 6), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('route 11 leads back to the west end of Χαϊδάρι', await arrive('chaidari', 1, 9), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route11', 34, 6, 'right');
      await settle();
      Input.inject('right', 12);
      check('route 11 leads into Μοναστηράκι', await arrive('monastiraki', 1, 9), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('Μοναστηράκι leads back to route 11', await arrive('route11', 34, 6), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('monastiraki', 24, 9, 'right');
      await settle();
      Input.inject('right', 12);
      check('Μοναστηράκι leads on to route 12 (University Avenue)', await arrive('route12', 1, 8), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('route 12 leads back into Μοναστηράκι', await arrive('monastiraki', 24, 9), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('route12', 38, 8, 'right');
      await settle();
      Input.inject('right', 12);
      check('route 12 leads into Σύνταγμα', await arrive('syntagma', 1, 10), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('left', 12);
      check('Σύνταγμα leads back to route 12', await arrive('route12', 38, 8), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('monastiraki', 22, 2, 'up');
      await settle();
      Input.inject('up', 12);
      check('the steps of Μοναστηράκι lead up to the Rock', await arrive('rock', 10, 14), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('down', 12);
      check('the Rock leads back down to Μοναστηράκι', await arrive('monastiraki', 22, 2), world.mapId + ' ' + world.px + ',' + world.py);
      world.loadMap('syntagma', 28, 6, 'right');
      await settle();
      Input.inject('right', 12);
      check('the east edge of Σύνταγμα leads up to the Hill', await arrive('lycabettus', 10, 14), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('down', 12);
      check('the Hill leads back down to Σύνταγμα', await arrive('syntagma', 28, 6), world.mapId + ' ' + world.px + ',' + world.py);
      // The door of the parliament: a formal door with a warp that needs the sixth badge, and the sign beside it (MZ-WORLD-02g; the walk through it is in the group 'parliament').
      check('the door of the parliament is a warp that needs the sixth badge, with a sign beside it', !tileDef(MAPS.syntagma, 14, 4).solid && !!findWarp(MAPS.syntagma, 14, 4) && findWarp(MAPS.syntagma, 14, 4).needFlag === 'badge_athina' && MAPS.syntagma.signs['11,5'] === 'sign.syntagma.parliament', 'door');
      // Every new map paints the screen, and the new creature has a sprite.
      const paintsScreen = function () {
        renderFrame();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 16) if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) lit++;
        return lit > pixels.length / 16 * 0.25;
      };
      const painted = [];
      for (const [mapId, x, y] of [['route11', 18, 6], ['monastiraki', 12, 9], ['monastiraki_hospital', 5, 5], ['monastiraki_shop', 3, 3], ['monastiraki_cafe', 4, 5], ['rock', 10, 13], ['route12', 12, 8], ['lycabettus', 10, 13], ['syntagma', 12, 9], ['syntagma_hospital', 5, 5], ['syntagma_shop', 3, 3]]) {
        world.loadMap(mapId, x, y, 'up');
        await settle();
        await pumpFrames(2);
        if (!paintsScreen()) painted.push(mapId);
      }
      check('the eleven new maps paint the screen', painted.length === 0, painted.join(','));
      const noSprite = ['taxpayer'].filter(function (id) { const sprite = creatureSprite(id); return !sprite || sprite.width < 16; });
      check('the new creature has a sprite', noSprite.length === 0, noSprite.join(','));
      // Μοναστηράκι: the hospital heals and becomes the return point; the café saves. Σύνταγμα: its hospital heals; the kiosk opens with the ten items.
      world.loadMap('monastiraki_hospital', 4, 3, 'up');
      await settle();
      const lead = G.party[0];
      lead.hp = 1; G.bag.fakelaki = 0;
      G.lastHeal = { map: 'hospital', x: 5, y: 7, dir: 'up' };
      Input.inject('a', 2);
      const healed = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Μοναστηράκι: the hospital heals the team and becomes the black-out spot', healed && G.lastHeal.map === 'monastiraki_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('monastiraki_cafe', 3, 3, 'up');
      await settle();
      delete Store.memory[SAVE_KEY];
      Input.inject('a', 2);
      const savedAtCafe = await pumpUntil(function () { return !world.busy && Store.memory[SAVE_KEY] !== undefined; }, 1800, 'a', 6);
      check('Μοναστηράκι: the café «Το Παζάρι» saves the game', savedAtCafe && migrateSave(JSON.parse(Store.memory[SAVE_KEY])).player.map === 'monastiraki_cafe', String(savedAtCafe));
      world.loadMap('syntagma_hospital', 4, 3, 'up');
      await settle();
      lead.hp = 1;
      Input.inject('a', 2);
      const healedTwo = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('Σύνταγμα: the hospital heals the team and becomes the black-out spot', healedTwo && G.lastHeal.map === 'syntagma_hospital', JSON.stringify(G.lastHeal));
      world.loadMap('syntagma_shop', 3, 3, 'up');
      await settle();
      Input.inject('a', 2);
      await pumpUntil(function () { return topLayer() instanceof ShopLayer; }, 600, 'a', 6);
      const shopLayer = topLayer();
      check('the Σύνταγμα kiosk opens with the ten items, as in Δυτικά (nothing new in Αθήνα)', shopLayer instanceof ShopLayer && shopLayer.stock.length === 10 && shopLayer.stock[9] === 'sylvasi' && shopStockOf(MAPS.monastiraki_shop).length === 10, shopLayer.stock ? shopLayer.stock.length : 'no shop');
      G.money = 1000; G.bag.sylvasi = 0;
      for (let i = 0; i < 9; i++) { Input.inject('down', 2); await pumpFrames(6); }
      Input.inject('a', 2);
      await pumpFrames(6);
      check('buying the last item (150) at the Σύνταγμα kiosk takes the money and fills the bag', G.bag.sylvasi === 1 && G.money === 850, G.bag.sylvasi + ' ' + G.money);
      Input.inject('b', 2);
      await pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, 'a', 6);
      // The legend of the Rock: a fixed encounter at level 40, met by talking. A won fight sets the flag that hides it; the creature enters the dossier.
      world.loadMap('rock', 9, 6, 'up');
      await settle();
      G.party.length = 0;
      for (const speciesId of ['matanthropos', 'matanthropos', 'yperypourgos', 'despotakis', 'yperypourgos', 'matanthropos']) G.party.push(makeMon(speciesId, 50));
      G.starter = 'koulourak';
      delete G.flags.legend_taxpayer; delete G.dex.seen.taxpayer;
      const legend = world.visibleNpcs().find(function (npc) { return npc.def.id === 'taxpayer'; });
      check('the legend stands on the Rock in front of the monument, level 40', !!legend && legend.def.kind === 'legend' && legend.def.species === 'taxpayer' && legend.def.level === 40, legend ? legend.def.kind : 'not there');
      let legendFinished = false;
      let sawWildBattle = false;
      world.busy = true; // as the game does while a scene runs: the A presses of this test do not start a second talk
      world.legendEncounter(legend).then(function () { world.busy = false; legendFinished = true; });
      await pumpUntil(function () {
        sawWildBattle = sawWildBattle || layers.some(function (l) { return l instanceof BattleLayer && l.battle.kind === 'wild' && l.battle.sides[1].party[0].sp === 'taxpayer' && l.battle.sides[1].party[0].lv === 40; });
        return legendFinished;
      }, 12000, 'a', 6);
      const gone = !world.visibleNpcs().some(function (npc) { return npc.def.id === 'taxpayer'; });
      check('the legend: a wild battle against the level 40 creature, then the flag legend_taxpayer is set, it is gone and the dossier knows it', legendFinished && sawWildBattle && G.flags.legend_taxpayer === true && gone && G.dex.seen.taxpayer === true,
        [legendFinished, sawWildBattle, G.flags.legend_taxpayer, gone, G.dex.seen.taxpayer].join(' '));
      // The boss: a won fight through the real code gives the prize, the Assembly Medal, no chapter card and no credits roll; the boost mark shows only when he has a boost.
      world.loadMap('syntagma', 15, 10, 'up');
      await settle();
      G.party.length = 0;
      for (const speciesId of ['despotakis', 'yperypourgos', 'matanthropos', 'despotakis', 'yperypourgos', 'matanthropos']) G.party.push(makeMon(speciesId, 50)); // six creatures at the level cap: the boss' five must not win this test
      G.starter = 'psaltak';
      G.money = 0; delete G.flags.badge_athina; delete G.flags.t_baboulas; G.flags.badge = true; G.flags.badge_notia = true; G.flags.badge_anatolika = true; G.flags.badge_voreia = true; G.flags.badge_dytika = true; delete G.flags.credits;
      const boss = world.visibleNpcs().find(function (npc) { return npc.def.id === 'baboulas'; });
      let sawBadge = false; let sawCard = false; let sawCredits = false; let finished = false; let sawMark = false; let markOnPlayer = false;
      world.busy = true;
      world.challenge(boss, false).then(function () { world.busy = false; finished = true; });
      await pumpUntil(function () {
        sawBadge = sawBadge || layers.some(function (l) { return l instanceof BadgeLayer; });
        sawCard = sawCard || layers.some(function (l) { return l instanceof ChapterLayer; });
        sawCredits = sawCredits || layers.some(function (l) { return l instanceof CreditsLayer; });
        sawMark = sawMark || layers.some(function (l) { return l instanceof BattleLayer && l.views[1].boostMark > 0; });
        markOnPlayer = markOnPlayer || layers.some(function (l) { return l instanceof BattleLayer && l.views[0].boostMark > 0; });
        return finished;
      }, 12000, 'a', 6);
      const markFoes = [];
      for (const trainerId of Object.keys(TRAINERS)) {
        const marked = buildTrainerTeam(trainerId, 'komma').some(function (mon) { return boostMarkOffset(mon, 'Lv 20') > 0; });
        if (marked !== !!TRAINERS[trainerId].boost) markFoes.push(trainerId);
      }
      check('the boost mark shows beside the level of the creatures of a boosted boss only (not the player\'s, not any other trainer\'s) and the boss fight showed it when he has one', !markOnPlayer && markFoes.length === 0 && sawMark === !!TRAINERS.baboulas.boost, [sawMark, markOnPlayer, markFoes.join(',')].join(' '));
      check('the boss fight is won through the UI: prize 44 x 30 + 200, the flag badge_athina, the badge card, no chapter card, no credits roll', finished && G.flags.t_baboulas === true && G.flags.badge_athina === true && sawBadge && !sawCard && !sawCredits && !G.flags.credits && G.money === 1520,
        [finished, G.flags.t_baboulas, G.flags.badge_athina, sawBadge, sawCard, sawCredits, G.flags.credits, G.money].join(' '));
      // The map shows Αθήνα: both routes as lines with the marker (left to right), the towns told about and visited, the district cleared.
      const openMap = async function () { MIZAMON.press('map', 2); await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1); await pumpFrames(3); return topLayer(); };
      const closeMap = async function () { Input.inject('b', 2); await settle(); };
      G.world.visited = {}; G.world.routes = {}; G.world.seen = {}; G.world.stops = {};
      world.loadMap('route11', 18, 6, 'right');
      await settle();
      let screen = await openMap();
      check('on route 11 the marker is on its line (left to right), the route is walked, Μοναστηράκι is told about', screen.marker.onRoute && screen.marker.id === 'route11' && Math.abs(screen.marker.fraction - 18.5 / 36) < 1e-9 && G.world.routes.route11 === 1 && placeState(G.world, 'monastiraki') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('route12', 20, 8, 'right');
      await settle();
      screen = await openMap();
      check('on route 12 the marker is on its line and Σύνταγμα is told about', screen.marker.onRoute && screen.marker.id === 'route12' && Math.abs(screen.marker.fraction - 20.5 / 40) < 1e-9 && placeState(G.world, 'syntagma') === 'seen', JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('rock', 10, 13, 'up');
      await settle();
      screen = await openMap();
      check('on the Rock the marker stands on Μοναστηράκι and the town is visited', screen.marker.id === 'monastiraki' && !screen.marker.onRoute && placeState(G.world, 'monastiraki') === 'visited' && worldCandidates(G.world).includes('monastiraki'), JSON.stringify(screen.marker));
      await closeMap();
      world.loadMap('lycabettus', 10, 13, 'up');
      await settle();
      screen = await openMap();
      for (let i = 0; i < 10 && screen.cursor !== 'syntagma'; i++) { Input.inject('right', 2); await pumpFrames(3); }
      check('Σύνταγμα is visited (the Hill belongs to it), its cursor can be reached, and the district shows as cleared with the Assembly Medal', screen.marker.id === 'syntagma' && placeState(G.world, 'syntagma') === 'visited' && screen.cursor === 'syntagma' && districtState(G.world, 'athina') === 'cleared' && G.world.badges.athina === 1, screen.cursor + ' ' + districtState(G.world, 'athina'));
      await closeMap();
      // The texts fit and the creature has a dossier text in both languages.
      const language = OPT.lang;
      const tooWide = [];
      ctx.font = FONT;
      for (const lang of ['el', 'en']) {
        for (const key of ['badge.athina.title', 'badge.athina.sub']) if (ctx.measureText(lookupString(key, lang)).width > 232) tooWide.push(lang + ' ' + key);
        for (const mapId of Object.keys(MAPS)) if (/^(route11|route12|monastiraki|rock|lycabettus|syntagma)/.test(mapId) && ctx.measureText(lookupString(MAPS[mapId].name, lang)).width > 232) tooWide.push(lang + ' ' + mapId);
        if (ctx.measureText(lookupString('sp.taxpayer', lang)).width < 1) tooWide.push(lang + ' sp.taxpayer');
      }
      OPT.lang = language;
      check('the Assembly Medal texts and the names of the new maps fit in both languages', tooWide.length === 0, tooWide.join(','));
    });
    await guard('parliament', async function () {
      if (!G) throw new Error('no game');
      const world = layers.find(function (l) { return l instanceof OverworldLayer; });
      const topLayer = function () { return layers[layers.length - 1]; };
      const settle = function () { return pumpUntil(function () { return !world.busy && topLayer() === world; }, 600, null, 1); };
      const arrive = function (mapId, x, y) { return pumpUntil(function () { return world.mapId === mapId && world.px === x && world.py === y && Fade.alpha === 0 && !world.busy; }, 400, null, 1); };
      // walks one step from (x, y) of a map and says where the player is afterwards
      const walkFrom = async function (mapId, x, y, dir) { world.loadMap(mapId, x, y, dir); await settle(); Input.inject(dir, 12); await pumpFrames(30); };
      // The door on the square: shut without the sixth badge, open with it.
      delete G.flags.badge_athina; delete G.flags.t_euterpe; delete G.flags.t_minister; delete G.flags.t_rival6; delete G.flags.ending;
      await walkFrom('syntagma', 14, 5, 'up');
      check('Σύνταγμα: the door of the Βουλή is shut without the Assembly Medal', world.mapId === 'syntagma' && world.px === 14 && world.py === 5, world.mapId + ' ' + world.px + ',' + world.py);
      G.flags.badge_athina = true;
      world.loadMap('syntagma', 14, 5, 'up');
      await settle();
      Input.inject('up', 12);
      check('with the Assembly Medal the door leads into the lobby', await arrive('parliament_lobby', 6, 8), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('down', 12);
      check('the lobby leads back out to the square', await arrive('syntagma', 14, 5), world.mapId + ' ' + world.px + ',' + world.py);
      // The chambers open one after the other; each leads back to the lobby.
      world.loadMap('parliament_lobby', 2, 1, 'up');
      await settle();
      Input.inject('up', 12);
      check('the first chamber (Ευτέρπη) is open at once', await arrive('parliament_c1', 5, 7), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('down', 12);
      check('the first chamber leads back to the lobby', await arrive('parliament_lobby', 2, 1), world.mapId + ' ' + world.px + ',' + world.py);
      await walkFrom('parliament_lobby', 5, 1, 'up');
      check('the studio is shut until Ευτέρπη is beaten', world.mapId === 'parliament_lobby' && world.py === 1, world.mapId + ' ' + world.px + ',' + world.py);
      G.flags.t_euterpe = true;
      world.loadMap('parliament_lobby', 5, 1, 'up');
      await settle();
      Input.inject('up', 12);
      check('the studio opens once she is beaten, and leads back', await arrive('parliament_c2', 5, 7), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('down', 12);
      await arrive('parliament_lobby', 5, 1);
      await walkFrom('parliament_lobby', 8, 1, 'up');
      check('the phone lounge is shut until Σπυράδωνις is beaten', world.mapId === 'parliament_lobby' && world.py === 1, world.mapId + ' ' + world.px + ',' + world.py);
      G.flags.t_minister = true;
      world.loadMap('parliament_lobby', 8, 1, 'up');
      await settle();
      Input.inject('up', 12);
      check('the phone lounge opens once he is beaten, and leads back', await arrive('parliament_c3', 5, 7), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('down', 12);
      await arrive('parliament_lobby', 8, 1);
      await walkFrom('parliament_lobby', 11, 1, 'up');
      check('the plenary hall is shut until Μπέμπης is beaten', world.mapId === 'parliament_lobby' && world.py === 1, world.mapId + ' ' + world.px + ',' + world.py);
      G.flags.t_rival6 = true;
      world.loadMap('parliament_lobby', 11, 1, 'up');
      await settle();
      Input.inject('up', 12);
      check('the plenary hall opens once he is beaten, and leads back', await arrive('parliament_plenary', 7, 10), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('down', 12);
      await arrive('parliament_lobby', 11, 1);
      await walkFrom('parliament_plenary', 14, 1, 'up');
      check('the door of the roof is locked until the credits have rolled', world.mapId === 'parliament_plenary' && world.py === 1, world.mapId + ' ' + world.px + ',' + world.py);
      G.flags.ending = true;
      world.loadMap('parliament_plenary', 14, 1, 'up');
      await settle();
      Input.inject('up', 12);
      check('with the ending the door leads up to the roof, and the roof leads back down', await arrive('parliament_roof', 4, 6), world.mapId + ' ' + world.px + ',' + world.py);
      Input.inject('down', 12);
      check('the stairs of the roof lead back to the plenary hall', await arrive('parliament_plenary', 14, 1), world.mapId + ' ' + world.px + ',' + world.py);
      delete G.flags.ending; delete G.flags.t_rival6; delete G.flags.t_minister; delete G.flags.t_euterpe;
      // Every new map paints the screen, and the legend has a sprite, and so have the four new tiles.
      const paintsScreen = function () {
        renderFrame();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 16) if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) lit++;
        return lit > pixels.length / 16 * 0.25;
      };
      const painted = [];
      for (const [mapId, x, y] of [['parliament_lobby', 6, 6], ['parliament_c1', 5, 6], ['parliament_c2', 5, 6], ['parliament_c3', 5, 6], ['parliament_plenary', 7, 8], ['parliament_roof', 4, 5]]) {
        world.loadMap(mapId, x, y, 'up');
        await settle();
        await pumpFrames(2);
        if (!paintsScreen()) painted.push(mapId);
      }
      check('the six maps of the Βουλή paint the screen', painted.length === 0, painted.join(','));
      const noSprite = ['ilithiokratia'].filter(function (id) { const sprite = creatureSprite(id); return !sprite || sprite.width < 16; });
      check('the legend of the plenary hall has a sprite', noSprite.length === 0, noSprite.join(','));
      const noTile = ['Δ', 'Θ', 'Φ', 'Ξ'].filter(function (char) { return !tileSprites[char]; });
      check('the four tiles of the parliament have sprites', noTile.length === 0, noTile.join(','));
      // The doctor of the lobby heals the team, becomes the return point and takes no envelope; the chambers have nobody who heals.
      world.loadMap('parliament_lobby', 2, 5, 'up');
      await settle();
      const lead = G.party[0];
      lead.hp = 1; G.bag.fakelaki = 3;
      G.lastHeal = { map: 'hospital', x: 5, y: 7, dir: 'up' };
      Input.inject('a', 2);
      const healed = await pumpUntil(function () { return !world.busy && lead.hp === maxHp(lead); }, 1800, 'a', 6);
      check('the doctor of the lobby heals the team and the lobby becomes the black-out spot', healed && G.lastHeal.map === 'parliament_lobby' && G.lastHeal.x === 5 && G.lastHeal.y === 7, JSON.stringify(G.lastHeal));
      check('the doctor of the lobby takes no envelope (no VIP service, the Φακελάκια stay in the bag)', G.bag.fakelaki === 3, G.bag.fakelaki);
      check('only the lobby has someone who heals, and only the roof a café counter', ['parliament_c1', 'parliament_c2', 'parliament_c3', 'parliament_plenary', 'parliament_roof'].every(function (id) { return !MAPS[id].npcs.some(function (npc) { return npc.kind === 'heal'; }); }) && MAPS.parliament_roof.npcs.some(function (npc) { return npc.kind === 'save'; }), 'heal');
      // The fights, through the real code: six boosted creatures at the level cap, so the fight's result does not depend on the player's luck. Each win sets its flag; only the last gives the badge and the credits.
      const strongParty = function () {
        G.party.length = 0;
        for (const speciesId of ['despotakis', 'yperypourgos', 'matanthropos', 'despotakis', 'yperypourgos', 'matanthropos']) G.party.push(makeMon(speciesId, 50, 3));
      };
      let foeMarked = false; // a boost mark on a creature of the fighters (the player's own creatures here carry a boost so the result does not depend on luck; none of the four fighters has one)
      const fight = async function (mapId, npcId, x, y) {
        world.loadMap(mapId, x, y, 'up');
        await settle();
        strongParty();
        const fighter = world.visibleNpcs().find(function (npc) { return npc.def.id === npcId; });
        const seen = { badge: false, card: false, credits: false, foeLast: null, mark: false, finished: false, delta: 0, gain: 0 }, before = G.money; // delta: what money moves took or gave in the fight (battle.moneyDelta, added after the prize)
        world.busy = true;
        world.challenge(fighter, false).then(function () { world.busy = false; seen.finished = true; });
        await pumpUntil(function () {
          seen.badge = seen.badge || layers.some(function (l) { return l instanceof BadgeLayer; });
          seen.card = seen.card || layers.some(function (l) { return l instanceof ChapterLayer; });
          seen.credits = seen.credits || layers.some(function (l) { return l instanceof CreditsLayer; });
          for (const l of layers) if (l instanceof BattleLayer) { seen.foeLast = l.battle.sides[1].party[l.battle.sides[1].party.length - 1].sp; seen.mark = seen.mark || l.views[1].boostMark > 0; seen.delta = l.battle.moneyDelta; }
          return seen.finished;
        }, 24000, 'a', 6);
        foeMarked = foeMarked || seen.mark;
        seen.gain = G.money - before;
        return seen;
      };
      G.money = 0; G.starter = 'psaltak'; delete G.flags.credits; delete G.flags.badge_final; delete G.flags.ending;
      let seen = await fight('parliament_c1', 'euterpe', 5, 4);
      check('fight 1 through the UI: Ευτέρπη is beaten, the flag t_euterpe, the prize 46 x 30, no badge, no chapter card, no credits', seen.finished && G.flags.t_euterpe === true && seen.gain === 1380 + seen.delta && !seen.badge && !seen.card && !seen.credits && !G.flags.ending, JSON.stringify(seen) + ' ' + G.money);
      seen = await fight('parliament_c2', 'minister', 5, 4);
      check('fight 2 through the UI: Σπυράδωνις is beaten, the flag t_minister, no badge, no credits', seen.finished && G.flags.t_minister === true && seen.gain === 1410 + seen.delta && !seen.badge && !seen.credits && !G.flags.ending, JSON.stringify(seen) + ' ' + G.money);
      seen = await fight('parliament_c3', 'rival6', 5, 6);
      check('fight 3 through the UI: Μπέμπης ends with the last form of his starter (psaltak: Κομματάκι, his last form Υπερυπουργός), the flag t_rival6, no badge, no credits', seen.finished && seen.foeLast === 'yperypourgos' && G.flags.t_rival6 === true && seen.gain === 1440 + seen.delta && !seen.badge && !seen.credits && !G.flags.ending, JSON.stringify(seen));
      check('no fighter of the first three fights shows a boost mark (only the last one has a small boost)', !foeMarked && TRAINERS.euterpe.boost === undefined && TRAINERS.minister.boost === undefined && TRAINERS.rival6.boost === undefined && TRAINERS.undersec.boost === 1.03, JSON.stringify(seen));
      seen = await fight('parliament_plenary', 'undersec', 7, 4);
      check('fight 4 through the UI: the badge card, the credits roll, no chapter card, the flags t_undersec, badge_final and ending, the flag credits untouched', seen.finished && seen.badge && seen.credits && !seen.card && G.flags.t_undersec === true && G.flags.badge_final === true && G.flags.ending === true && !G.flags.credits, JSON.stringify(seen) + ' ' + G.flags.ending);
      check('after the credits the player stands on the roof, and the prize of the last fight is 50 x 30', world.mapId === 'parliament_roof' && world.px === 4 && world.py === 6 && seen.gain === 1500 + seen.delta, world.mapId + ' ' + world.px + ',' + world.py + ' ' + seen.gain + ' ' + seen.delta);
      // The ending: the plenary hall is empty but for the legend, who is met at level 50 and is gone once beaten; the roof saves the game with its ending.
      world.loadMap('parliament_plenary', 7, 4, 'up');
      await settle();
      const here = world.visibleNpcs().map(function (npc) { return npc.def.id; });
      check('after the ending the plenary hall is empty: Ο Υφυπουργός, his assistant and the members are gone, Ηλιθιοκρατία stands there alone', here.length === 1 && here[0] === 'ilithiokratia', here.join(','));
      strongParty();
      G.starter = 'komma';
      delete G.flags.legend_ilithiokratia; delete G.dex.seen.ilithiokratia;
      const legend = world.visibleNpcs().find(function (npc) { return npc.def.id === 'ilithiokratia'; });
      let legendFinished = false; let sawBattle = false; let sawMark = false;
      world.busy = true;
      world.legendEncounter(legend).then(function () { world.busy = false; legendFinished = true; });
      await pumpUntil(function () {
        for (const l of layers) if (l instanceof BattleLayer && l.battle.kind === 'wild' && l.battle.sides[1].party[0].sp === 'ilithiokratia' && l.battle.sides[1].party[0].lv === 50) { sawBattle = true; sawMark = sawMark || l.views[1].boostMark > 0; }
        return legendFinished;
      }, 12000, 'a', 6);
      check('the legend: a wild battle at level 50 with the boost mark shown, then the flag legend_ilithiokratia, it is gone and the dossier knows it', legendFinished && sawBattle && sawMark && G.flags.legend_ilithiokratia === true && world.visibleNpcs().length === 0 && G.dex.seen.ilithiokratia === true, [legendFinished, sawBattle, sawMark, G.flags.legend_ilithiokratia, world.visibleNpcs().length, G.dex.seen.ilithiokratia].join(' '));
      world.loadMap('parliament_roof', 6, 3, 'up');
      await settle();
      delete Store.memory[SAVE_KEY];
      Input.inject('a', 2);
      const savedOnRoof = await pumpUntil(function () { return !world.busy && Store.memory[SAVE_KEY] !== undefined; }, 1800, 'a', 6);
      const reloaded = savedOnRoof ? migrateSave(JSON.parse(Store.memory[SAVE_KEY])) : null;
      check('the café counter of the roof saves the game with its ending (a reload stands on the roof with the flags ending and badge_final)', !!reloaded && reloaded.player.map === 'parliament_roof' && reloaded.flags.ending === true && reloaded.flags.badge_final === true && reloaded.flags.legend_ilithiokratia === true, String(savedOnRoof));
      // The map shows the Βουλή: a door that is told about with the sixth badge, visited once entered, with its own level range; the marker stands on it inside.
      const openMap = async function () { MIZAMON.press('map', 2); await pumpUntil(function () { return topLayer() instanceof MapLayer; }, 100, null, 1); await pumpFrames(3); return topLayer(); };
      const closeMap = async function () { Input.inject('b', 2); await settle(); };
      G.world.visited = {}; G.world.routes = {}; G.world.seen = {}; G.world.stops = {};
      delete G.flags.badge_athina;
      world.loadMap('syntagma', 14, 6, 'up');
      await settle();
      let screen = await openMap();
      const hiddenWithout = placeState(G.world, 'parliament') === 'hidden' && !worldCandidates(G.world).includes('parliament');
      await closeMap();
      G.flags.badge_athina = true;
      world.loadMap('syntagma', 14, 6, 'up');
      await settle();
      screen = await openMap();
      const toldAbout = placeState(G.world, 'parliament') === 'seen' && worldCandidates(G.world).includes('parliament');
      check('on the map the Βουλή is not drawn before the Assembly Medal and is told about (a hollow door) with it', hiddenWithout && toldAbout, hiddenWithout + ' ' + toldAbout);
      await closeMap();
      world.loadMap('parliament_lobby', 6, 6, 'up');
      await settle();
      screen = await openMap();
      for (let i = 0; i < 10 && screen.cursor !== 'parliament'; i++) { Input.inject('up', 2); await pumpFrames(3); }
      check('inside the Βουλή the marker stands on its door, the place is visited, the cursor reaches it and the info line shows its own levels 44-50', screen.marker.id === 'parliament' && !screen.marker.onRoute && placeState(G.world, 'parliament') === 'visited' && screen.cursor === 'parliament' && screen.lines[1].indexOf('44-50') >= 0, screen.cursor + ' ' + (screen.lines ? screen.lines[1] : ''));
      check('the district of Αθήνα keeps its own levels 38-44 on its sheet and is cleared with the Assembly Medal', districtState(G.world, 'athina') === 'cleared' && mapInfoLines(G.world, 'syntagma', false)[1].indexOf('38-44') >= 0 && mapInfoLines(G.world, 'parliament', false)[1].indexOf('44-50') >= 0, mapInfoLines(G.world, 'syntagma', false)[1]);
      await closeMap();
      // The texts fit: the final badge, the six map names and every line of the credits in both languages.
      const language = OPT.lang;
      const tooWide = [];
      ctx.font = FONT;
      for (const lang of ['el', 'en']) {
        for (const key of ['badge.final.title', 'badge.final.sub']) if (ctx.measureText(lookupString(key, lang)).width > 232) tooWide.push(lang + ' ' + key);
        for (const mapId of Object.keys(MAPS)) if (/^parliament/.test(mapId) && ctx.measureText(lookupString(MAPS[mapId].name, lang)).width > 232) tooWide.push(lang + ' ' + mapId);
        for (const line of lookupString('credits.text', lang).split('\n')) if (ctx.measureText(line).width > 232) tooWide.push(lang + ' credits: ' + line);
        if (ctx.measureText(lookupString('sp.ilithiokratia', lang)).width < 1) tooWide.push(lang + ' sp.ilithiokratia');
      }
      OPT.lang = language;
      check('the final badge texts, the names of the six maps and every line of the credits fit in both languages', tooWide.length === 0, tooWide.join(','));
      const creditsLayer = new CreditsLayer();
      creditsLayer.onEnter();
      check('the credits screen splits its lines once, starts with the title and lists the facts of this game', creditsLayer.lines[0] === 'MIZAMON' && creditsLayer.lines.length > 12 && creditsLayer.lines.some(function (line) { return line.indexOf('Σάτιρα') === 0 || line.indexOf('Satire') === 0; }), creditsLayer.lines.length);
      const lastLine = creditsLayer.lines.length - 1;
      const closeFrame = creditsEndFrame(creditsLayer.lines.length);
      const lastY = creditsLineY(closeFrame, lastLine);
      check('the last line of the credits has scrolled fully onto the screen before the roll closes (and is not yet gone when it does)', lastY >= 0 && lastY <= SCREEN_H - 12 && creditsLineY(0, lastLine) > SCREEN_H, 'y ' + lastY);
      Sound.play(MAPS.parliament_roof.music);
    });
    await guard('map touch button', async function () {
      // The ΧΑΡΤΗΣ pill: shown, inside the window, off the game picture and clear of every other button (checked in the layout this window has).
      touchForced = true; resizeScreen();
      const map = touchPad.querySelector('[data-btn="map"]');
      const box = map.getBoundingClientRect();
      const game = canvas.getBoundingClientRect();
      const overlaps = [];
      for (const other of touchPad.querySelectorAll('[data-btn]')) {
        if (other === map) continue;
        const b = other.getBoundingClientRect();
        if (box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top) overlaps.push(other.getAttribute('data-btn'));
      }
      const inside = box.width > 0 && box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight;
      const onGame = box.left < game.right && box.right > game.left && box.top < game.bottom && box.bottom > game.top;
      // Pressing it makes the "map" input, and the touch handler releases it again.
      map.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const pressed = !!Input.touch.map;
      map.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const released = !Input.touch.map;
      touchForced = false; resizeScreen();
      check('the map touch button is reachable and clear of the other buttons (' + window.innerWidth + 'x' + window.innerHeight + ')', inside && !onGame && overlaps.length === 0 && pressed && released,
        'inside ' + inside + ' onGame ' + onGame + ' overlaps ' + overlaps.join(',') + ' pressed ' + pressed + ' released ' + released);
    });
    await guard('accessibility', async function () { await accessibilityChecks(check); });
  } finally {
    layers.length = 0;
    for (const layer of snapshot.layers) layers.push(layer);
    G = snapshot.G;
    OPT = snapshot.OPT;
    Store.forceMemory = snapshot.forceMemory;
    Store.memory = snapshot.memory;
    sundayPinned = snapshot.sundayPinned;
    touchForced = snapshot.touchForced;
    resizeScreen();
    Input.clear();
    Fade.alpha = 0;
    loopPaused = snapshot.loopPaused;
  }
  return results;
}

