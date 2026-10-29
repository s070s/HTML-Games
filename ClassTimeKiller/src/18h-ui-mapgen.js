// ==== S18 UI: GENERATED MAP SCREEN ====
// Generated map (13.4): generator, mode, size (capped by the quality tier), theme, density and seed, a share code to copy or
// paste, Generate (shows what the generator did) and Play. Keyboard, gamepad and touch work through the Ui controls (buttons,
// cycles, text fields). The model (MapGenMenu) has no DOM and is what the self-test drives. Contract: docs/api/mapgen.md.

const MAPGEN_MENU_RANDOM_THEME = '';
const MAPGEN_MENU_ANY_MODE = '';
const MAPGEN_MENU_BUSY_TEXT = 'Generating...';
const MAPGEN_MENU_MODE_BOTS = -1;                          // bots: the mode's default number (as Quick Match)
const MAPGEN_MENU_MATCH_KEYS = ['bots', 'difficulty'];     // match settings: changing them keeps the shown map
const MAPGEN_MENU_CSS = '.mg-field { width: 9em; background: var(--ui-panel); color: var(--ui-text); border: 1px solid var(--ui-line); border-radius: 8px; padding: 8px; font: inherit; }'
  + '.mg-code { flex: 1; min-width: 12em; font: 0.875em/1.4 ui-monospace, Consolas, monospace; } .mg-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }'
  + '.mg-status { white-space: pre-wrap; } .mg-error { color: var(--ui-bad); }';

const MapGenMenu = {
  state: { generator: 'GN3', mode: MAPGEN_MENU_ANY_MODE, size: MAPGEN_DEFAULT_SIZE, theme: MAPGEN_MENU_RANDOM_THEME, density: 'normal', seed: 1, map: null, report: null, notice: '',
    bots: MAPGEN_MENU_MODE_BOTS, difficulty: PLAY_DEFAULT_DIFFICULTY },

  options() {
    const s = this.state;
    return { generator: s.generator, mode: s.mode, size: s.size, theme: s.theme, density: s.density, seed: s.seed };
  },
  // A map setting changed: the shown map is out of date. A generator change drops a mode it does not offer.
  set(key, value) {
    this.state[key] = value;
    if (MAPGEN_MENU_MATCH_KEYS.includes(key)) return;
    this.state.map = null;
    this.state.notice = '';
    const generator = MapGen.generator(this.state.generator);
    if (key === 'generator' && !generator.modes.includes(this.state.mode)) this.state.mode = MAPGEN_MENU_ANY_MODE;
  },
  newSeed() { this.set('seed', newSeed()); },
  setSeedText(text) {
    if (!/^\d{1,10}$/.test(String(text).trim())) return false;
    this.set('seed', Number(text) % SEED_RANGE);
    return true;
  },
  // The sizes the quality tier allows (13.4 size cap).
  sizes() { return CAT.mapSizes.filter((row) => row.index <= MapGen.sizeCap().index); },
  // A size the tier does not offer becomes the largest it does (the screen opens and pasted codes go through this); true when cut.
  clampSize() {
    const allowed = this.sizes(), largest = allowed[allowed.length - 1];
    if (allowed.some((row) => row.id === this.state.size)) return false;
    this.state.size = largest.id;
    return true;
  },
  shareCode() { return MapGen.shareCode(this.options()); },
  usePaste(text) {
    const options = MapGen.parseShare(text);
    if (!options) return false;
    for (const key of Object.keys(options)) this.state[key] = options[key];
    this.state.map = null;
    this.state.notice = this.clampSize() ? 'The code asks for a ' + CAT.mapSizes.byId(options.size).name.toLowerCase() + ' map; this quality setting makes '
      + CAT.mapSizes.byId(this.state.size).name.toLowerCase() + ' maps at most, so the size was cut and the map differs from the shared one.' : '';
    return true;
  },
  generate() {
    this.state.map = MapGen.generate(this.options());
    this.state.report = MapGen.last;
    return this.state.map;
  },
  // The mode the match is played in: the chosen one, else the first the map offers.
  matchMode() {
    const map = this.state.map || this.generate();
    return map.modes.includes(this.state.mode) ? this.state.mode : map.modes[0];
  },
  // Game.start setup for the generated map: the chosen number of named roster bots (else the mode's default, as Quick Match) at the
  // chosen difficulty, the player on team 0 in team modes.
  setup() {
    const mode = this.matchMode(), row = CAT.modes.byId(mode), state = this.state;
    const count = state.bots === MAPGEN_MENU_MODE_BOTS ? Modes.defaultBots(mode, true).length : Math.min(state.bots, PlayFlow.maxBots());
    const bots = PlayFlow.rosterBots(count, state.difficulty, state.seed);
    return { mode, map: state.map, seed: state.seed, bots, difficulty: state.difficulty, player: row.teams === 2 ? { team: 0 } : {} };
  },
  describe() {
    const map = this.state.map, report = this.state.report, notice = this.state.notice ? this.state.notice + '\n' : '';
    if (!map || !report) return notice + 'Not generated yet. Change any setting, then press Generate.';
    if (report.fallback) return notice + 'No seed passed the checks, so the authored map ' + map.name + ' is served instead.\n' + report.problems.slice(0, 2).join('\n');
    const retried = report.seed === report.requestedSeed ? '' : ' (seed ' + report.requestedSeed + ' failed the checks; seed ' + report.seed + ' passed)';
    const repaired = report.repairs ? ', ' + report.repairs + ' sightline repair' + (report.repairs === 1 ? '' : 's') : '';
    return notice + map.name + retried + '\n' + map.size[0] + ' x ' + map.size[2] + ' m, ' + map.spawns.length + ' spawns, ' + map.items.length + ' items, '
      + map.objectives.length + ' objectives' + repaired + '\nMade in ' + Math.round(report.ms.total) + ' ms. Modes: ' + map.modes.map(modeLabel).join(', ');
  },
};

// ---- Screen ----
function mapgenMenuCycle(label, rows, key, labelOf, render) {
  const options = rows.map((row) => row.value), labels = rows.map(labelOf);
  return Ui.row(label, Ui.cycle(options, labels, MapGenMenu.state[key], (value) => { MapGenMenu.set(key, value); render(); }));
}
function mapgenMenuChoices() {
  const generator = MapGen.generator(MapGenMenu.state.generator);
  return {
    generator: CAT.generators.map((row) => ({ value: row.code, name: row.code + '  ' + row.name })),
    mode: [{ value: MAPGEN_MENU_ANY_MODE, name: 'Any: ' + generator.defaultModes.map(modeLabel).join(', ') }]
      .concat(generator.modes.map((id) => ({ value: id, name: modeLabel(id) }))),
    size: MapGenMenu.sizes().map((row) => ({ value: row.id, name: row.name })),
    theme: [{ value: MAPGEN_MENU_RANDOM_THEME, name: 'Random' }].concat(CAT.mapTilesets.map((row) => ({ value: row.id, name: row.name }))),
    density: CAT.mapDensities.map((row) => ({ value: row.id, name: row.name })),
    bots: [{ value: MAPGEN_MENU_MODE_BOTS, name: 'Mode default' }].concat(Array.from({ length: PlayFlow.maxBots() + 1 }, (unused, count) => ({ value: count, name: String(count) }))),
    difficulty: PlayFlow.difficulties().map((row) => ({ value: row.id, name: row.name })),
  };
}
function mapgenMenuSeedRow(render) {
  const input = makeElement('input', 'mg-field');
  input.type = 'text'; input.inputMode = 'numeric'; input.value = String(MapGenMenu.state.seed);
  input.addEventListener('change', () => { if (!MapGenMenu.setSeedText(input.value)) Ui.toast('A seed is a whole number.'); render(); });
  const wrap = makeElement('div', 'mg-controls');
  wrap.appendChild(input);
  wrap.appendChild(Ui.button('New seed', () => { MapGenMenu.newSeed(); render(); }));
  return Ui.row('Seed', wrap);
}
function mapgenMenuShareRows(render) {
  const mine = makeElement('input', 'mg-field mg-code'), paste = makeElement('input', 'mg-field mg-code');
  mine.type = 'text'; mine.readOnly = true; mine.value = MapGenMenu.shareCode();
  paste.type = 'text'; paste.placeholder = 'Paste a map code';
  const copyWrap = makeElement('div', 'mg-controls'), pasteWrap = makeElement('div', 'mg-controls');
  copyWrap.appendChild(mine);
  copyWrap.appendChild(Ui.button('Copy', () => copyText(mine.value, mine)));
  pasteWrap.appendChild(paste);
  pasteWrap.appendChild(Ui.button('Use code', () => {
    if (!MapGenMenu.usePaste(paste.value)) Ui.toast('That is not a map code.');
    else if (MapGenMenu.state.notice) Ui.toast(MapGenMenu.state.notice);
    render();
  }));
  return [Ui.row('Share code', copyWrap), Ui.row('Paste', pasteWrap)];
}
function mapgenMenuRender(list, status) {
  const render = () => mapgenMenuRender(list, status);
  const choices = mapgenMenuChoices(), named = (row) => row.name;
  Ui.rebuild(list, () => {
    list.replaceChildren();
    for (const [key, label] of [['generator', 'Generator'], ['mode', 'Mode'], ['size', 'Size'], ['theme', 'Theme'], ['density', 'Density'], ['bots', 'Bots'], ['difficulty', 'Difficulty']]) {
      list.appendChild(mapgenMenuCycle(label, choices[key], key, named, render));
    }
    list.appendChild(mapgenMenuSeedRow(render));
    mapgenMenuShareRows(render).forEach((row) => list.appendChild(row));
  });
  status.textContent = MapGenMenu.describe();
  status.className = 'ui-note mg-status' + (MapGenMenu.state.report && MapGenMenu.state.report.fallback && MapGenMenu.state.map ? ' mg-error' : '');
}

Ui.register('mapgen', {
  build(root) {
    injectStyle('ui-mapgen-style', MAPGEN_MENU_CSS);
    if (MapGenMenu.clampSize()) MapGenMenu.state.map = null;
    screenHeader(root, 'Generated Map');
    const list = makeElement('div', 'ui-scroll'), status = makeElement('p', 'ui-note mg-status'), foot = makeElement('div', 'ui-foot');
    const buttons = [];
    // Generating can take a second on a phone: say so, hold both buttons and let the screen repaint before the work starts (the map check does the same).
    const whenGenerated = (work) => () => {
      status.textContent = MAPGEN_MENU_BUSY_TEXT;
      const focused = buttons.includes(document.activeElement) ? document.activeElement : null;
      buttons.forEach((button) => { button.disabled = true; });
      setTimeout(() => {
        buttons.forEach((button) => { button.disabled = false; });
        if (focused) focused.focus();
        if (status.isConnected) work();   // the player may have left the screen meanwhile
      }, 0);
    };
    const generate = Ui.button('Generate', whenGenerated(() => { MapGenMenu.generate(); mapgenMenuRender(list, status); }));
    const play = Ui.button('Play', whenGenerated(() => {
      const setup = MapGenMenu.setup();
      Ui.closeAll();
      Game.start(setup);
    }), 'primary');
    buttons.push(generate, play);
    play.dataset.autofocus = '1';
    foot.appendChild(play);
    foot.appendChild(generate);
    [list, status, foot].forEach((part) => root.appendChild(part));
    mapgenMenuRender(list, status);
  },
});
