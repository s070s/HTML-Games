// ---- Public handle for the tests and for quick starts -----------------------------------------------------------------------------------
window.MIZAMON = {
  version: 'MVP 1',
  selfTest: selfTest,
  rules: RULES,
  press: function (name, frames) { Input.inject(name, frames || 2); },
  forceTouch: function (on) { touchForced = on; resizeScreen(); },
  state: function () { return G; },
  // Starts a game without the intro (for tests and screenshots).
  quickStart: function (options) {
    const o = options || {};
    G = newGameState(o.name || 'ΝΙΚΟΣ', o.gender || 'm', o.starter || 'komma');
    G.rng = makeRng(o.seed || 1234);
    if (o.map) { G.player.map = o.map; G.player.x = o.x; G.player.y = o.y; G.player.dir = o.dir || 'down'; }
    if (o.flags) Object.assign(G.flags, o.flags);
    if (o.level) { G.party[0].lv = o.level; G.party[0].xp = xpForLevel(o.level); G.party[0].moves = movesAtLevel(G.party[0].sp, o.level); G.party[0].hp = maxHp(G.party[0]); }
    startWorld();
    return G;
  },
  layers: layers,
  runBattle: runBattle,
  // Manual stepping for tests: pause the real-time loop, then pump frames with optional button presses.
  pause: function (on) { loopPaused = !!on; },
  pumpUntil: pumpUntil,
  pumpFrames: pumpFrames,
  hold: function (name, frames) { Input.inject(name, frames); },
};
boot();
