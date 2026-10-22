// ==== S20 SELF-TEST ====
// Test.add(group, fn, options) registers a block; fn(check) calls check(name, ok, detail), or check.skip(name, reason) for a
// probe the page cannot run (counted apart from passes). A throwing block becomes one failed check (ARC-030).
// Blocks run in registration order (file order). options.slow: a long soak that runs only with Test.run({ slow: true }) or
// when its group is named (--slow / --group in tools/selftest.mjs), so the default suite stays quick. Each block gets a clean slate: no match, default seed, memory storage.
// DebugApi becomes window.__CTK at boot (ARC-040); test files add their debug commands to it.

// Hooks that later sections fill at load (ARCHITECTURE: renderer and other hooks). A block may replace one with a stub;
// the loaded one is put back before the next block, so no block depends on what an earlier block left behind.
const TEST_HOOKS = [[Input, 'aimAssistTarget'], [Render, 'viewModel'], [Render, 'cameraOverride'], [Render, 'actorStyle'],
  [Render, 'worldQuery'], [Render, 'heldWeapon'], [Sound, 'lineOfSight']];

const TEST_FLOOR = { shape: 'box', min: [-60, -1, -60], max: [60, 0, 60] };   // 120 m test floor shared by test files

const Test = {
  blocks: [],
  loadedHooks: [],
  add(group, run, options) { this.blocks.push({ group, run, slow: !!(options && options.slow) }); },
  async run(options) {
    const settings = options || {};
    const results = [];
    const wasHeadless = Game.headless;
    const savedData = Save.data, savedStorage = Save.storage, savedRuntimeMaps = Maps.runtime;
    const groups = new Set();
    this.loadedHooks = TEST_HOOKS.map(([owner, key]) => owner[key]);
    if (settings.headless) Game.headless = true;
    for (const block of this.blocks) {
      if (settings.group && block.group !== settings.group) continue;
      if (block.slow && !settings.slow && !settings.group) continue;
      groups.add(block.group);
      const check = Test.checker(block.group, results);
      Test.isolate();
      const errorsBefore = ErrorLog.entries.length;
      try { await block.run(check); } catch (error) { check('block threw', false, error && error.stack ? String(error.stack).split('\n').slice(0, 3).join(' | ') : error); }
      const unexpected = ErrorLog.entries.slice(errorsBefore);
      if (unexpected.length) check('no errors logged during the block', false, unexpected.slice(0, 3).join(' || '));
    }
    Game.stop();
    this.restoreHooks();
    Save.data = savedData; Save.storage = savedStorage; Maps.runtime = savedRuntimeMaps;
    Settings.applyAll();   // settings changed by the tests reach their listeners again
    Game.headless = wasHeadless;
    return this.tally(results, groups.size);
  },
  // check(name, ok, detail) for one block; check.skip(name, reason) records a probe this page cannot run (R-160):
  // it counts as skipped, never as a pass.
  checker(group, results) {
    const check = (name, ok, detail) => { results.push({ group, name, ok: !!ok, detail: ok ? '' : String(detail === undefined ? '' : detail) }); };
    check.skip = (name, reason) => { results.push({ group, name, ok: true, skipped: true, detail: reason }); };
    return check;
  },
  // total = passed + failed + skipped
  tally(results, groups) {
    const failed = results.filter((r) => !r.ok).length, skipped = results.filter((r) => r.skipped).length;
    return { total: results.length, passed: results.length - failed - skipped, failed, skipped, groups, results };
  },
  // Clean state between blocks: stops any match, memory-only storage, fresh save, no runtime maps, default seed.
  isolate() {
    Game.stop();
    Maps.runtime = [];
    Save.storage = makeMemoryStorage(false);
    Save.data = Save.emptySave();
    Rng.reseed(1);
    this.restoreHooks();
  },
  restoreHooks() {
    TEST_HOOKS.forEach(([owner, key], index) => { owner[key] = this.loadedHooks[index]; });
  },
  near(a, b, tolerance) { return Math.abs(a - b) <= tolerance; },
  // Runs code that is expected to log errors; returns how many it logged and removes them from the ring.
  expectErrors(run) {
    const before = ErrorLog.entries.length;
    run();
    const added = ErrorLog.entries.length - before;
    ErrorLog.entries.length = before;
    return added;
  },
};

const DEBUG_STRESS_MUTATORS = ['rocketpit', 'lastgift'];   // explosive-heavy: rockets only, and every death drops a grenade

const DebugApi = {
  version: VERSION,
  selfTest: (options) => Test.run(options),
  game: Game,
  actors: Actors,
  world: World,
  catalogues: CAT,
  perf: { stats: () => Perf.stats() },
  step(steps) { Sim.run(steps || 1); return Sim.tick; },
  seed(seed) { Rng.reseed(seed); return Rng.seed; },
  // ARC-040 test hooks for live tests: give a weapon, item or powerup key (the item.grant path), and god mode (ACTOR_FLAG.GOD).
  give(key, id) { return Items.giveKey(id === undefined ? Game.playerId : id, key); },
  god(on, id) {
    const target = id === undefined ? Game.playerId : id;
    if (target < 0) return false;
    if (on) Actors.flags[target] |= ACTOR_FLAG.GOD; else Actors.flags[target] &= ~ACTOR_FLAG.GOD;
    return on;
  },
  // LT-C-030: a deathmatch with the most bots the quality preset allows; level 'max' adds the explosive mutators.
  stress(level) {
    const setup = PlayFlow.buildSetup(PlayFlow.normalize({ mode: PLAY_DEFAULT_MODE, bots: PlayFlow.maxBots() }));
    if (level === 'max') setup.mutators = DEBUG_STRESS_MUTATORS.slice();
    return Game.start(setup);
  },
  log: { errors: () => ErrorLog.entries.slice() },
  save: {
    dump: () => Save.exportText(),
    corrupt(kind) { // test hook: write a broken save, then reload it
      const broken = kind === 'empty' ? '' : kind === 'type' ? '[1,2,3]' : '{"version":1,"settings":';
      Save.write(SAVE_KEY, broken);
      return Save.load() && Save.notice;
    },
  },
};
