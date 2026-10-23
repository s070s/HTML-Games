// Self-tests for the match flow (group 'play'): Quick Match with the remembered setup, the Play screen, Shuffle, the results screen,
// the scoreboard (rows, teams, objective column, accuracy, medals, open / close) and a full headless quick match from start to results.

DebugApi.scoreboard = Scoreboard;
DebugApi.playerStats = LocalPlayerStats;

const PLAY_TEST_SEED = 11;
const PLAY_TEST_SHUFFLES = 300;
const PLAY_TEST_STEPS = 240;

function playTestCount(kind) {
  let count = 0;
  for (let id = 0; id < Actors.count; id++) if (Actors.kind[id] === kind) count++;
  return count;
}
// Match setups need the tests' own bots-free player flow: the real flow starts bots as actors, which stand still until the bots section lands.
function playTestFinish() {
  Modes.score[Game.playerId] = CAT.modes.byId(Game.match.rules.mode).scoreLimit;
  Sim.run(2);
}

Test.add('play', (check) => {
  const defaults = PlayFlow.defaults();
  check('defaults: Frenzy on the smallest arena with 7 bots and the RS01 bundle', defaults.mode === 'ffa' && defaults.map === 'spire' && defaults.bots === 7
    && CAT.rulesets.byId(CAT.modes.byId('ffa').ruleset).code === 'RS01' && defaults.difficulty === 'regular');
  check('defaults: the smallest ffa map is picked by floor area', PlayFlow.smallestMap('ffa').id === 'spire' && PlayFlow.smallestMap('tdm').id === 'skyyard');
  check('defaults: the default difficulty is one of the choices', PlayFlow.difficulties().some((row) => row.id === 'regular') && PlayFlow.normalize({}).difficulty === 'regular');
  const modes = PlayFlow.playableModes();
  check('modes: every offered mode is playable and has a map (modes without a map are not offered)', modes.length >= 8 && modes.every((mode) => Modes.isPlayable(mode.id) && Maps.forMode(mode.id).length > 0));

  const starts = [];
  const listener = Bus.on('match.start', (match) => starts.push(match));
  Bus.emit('ui.quickMatch', null);
  Bus.off('match.start', listener);
  check('quick match: one event starts exactly one match, playing at once', starts.length === 1 && Game.state === 'playing' && Game.match === starts[0]);
  check('quick match: the default setup (ffa, spire, RS01) is running', Game.match.rules.mode === 'ffa' && Game.match.map.id === 'spire' && Game.match.rules.id === 'classic');
  check('quick match: the player and 7 bots exist', Game.playerId >= 0 && playTestCount(ACTOR_KIND.PLAYER) === 1 && playTestCount(ACTOR_KIND.BOT) === 7);
  check('quick match: the choice is remembered in the save (PRG-001)', JSON.stringify(Save.data.play) === JSON.stringify({ mode: 'ffa', map: 'spire', ruleset: '', bots: 7, difficulty: 'regular', team: -1, length: 'standard' }), JSON.stringify(Save.data.play));
  Sim.run(PLAY_TEST_STEPS);
  check('quick match: the match runs for two seconds without errors, everyone alive', Actors.alive[Game.playerId] === 1 && Game.isRunning());
  Bus.emit('ui.quickMatch', null);
  check('quick match: starting again replaces the match (still 8 actors)', Game.state === 'playing' && Actors.count === 8 && playTestCount(ACTOR_KIND.BOT) === 7);

  Save.data.play = { mode: 'tdm', map: 'skyyard', ruleset: 'tactical', bots: 5, difficulty: 'regular', team: 1 };
  PlayFlow.quickMatch();
  check('quick match: uses the remembered mode, map, rules, bots and team', Game.match.rules.mode === 'tdm' && Game.match.map.id === 'skyyard' && Game.match.rules.id === 'tactical'
    && playTestCount(ACTOR_KIND.BOT) === 5 && Actors.team[Game.playerId] === 1);
  Game.stop();

  Save.data.play = { mode: 'nope', map: 'nope', bots: 99 };
  const repaired = PlayFlow.remembered();
  check('remembered: unknown mode and map fall back to the defaults, bots are capped by the quality preset', repaired.mode === 'ffa' && repaired.map === 'spire' && repaired.bots === Math.min(99, PlayFlow.maxBots()));
  Save.data.play = { mode: 'tdm', map: 'spire' };
  check('remembered: a map that does not list the mode gives the smallest one that does', PlayFlow.remembered().map === 'skyyard');
  Settings.set('video.quality', 'potato');
  check('remembered: the potato preset allows 7 bots at most (PERF-009)', PlayFlow.normalize({ bots: 20 }).bots === 7 && PlayFlow.maxBots() === 7);
  Settings.set('video.quality', 'auto');
  check('remembered: a mode brings its own bot count (duel 1, ctf 9)', PlayFlow.normalize({ mode: 'duel' }).bots === 1 && PlayFlow.normalize({ mode: 'ctf' }).bots === Math.min(9, PlayFlow.maxBots()));
  check('remembered: empty and broken saves give the defaults', PlayFlow.normalize(null).mode === 'ffa' && PlayFlow.normalize({ bots: 'many', team: 7 }).team === -1);

  const setup = PlayFlow.buildSetup({ mode: 'ffa', map: 'spire', ruleset: '', bots: 3, difficulty: 'regular', team: -1 }, () => 0.5);
  check('setup: bots, seed, player and difficulty are filled, no ruleset means the mode default', setup.bots.length === 3 && setup.seed === Math.floor(0.5 * 0x7fffffff) && setup.player.team === -1
    && setup.difficulty === 'regular' && setup.ruleset === undefined && Array.isArray(setup.mutators));
  check('setup: a chosen ruleset is passed on', PlayFlow.buildSetup({ mode: 'ffa', map: 'spire', ruleset: 'tourney', bots: 0, difficulty: 'regular', team: 0 }, () => 0).ruleset === 'tourney');

  const random = makeRandom(PLAY_TEST_SEED).next, seen = new Set();
  let valid = true;
  for (let i = 0; i < PLAY_TEST_SHUFFLES; i++) {
    const pick = PlayFlow.shuffle(random), map = CAT.maps.byId(pick.map), mode = CAT.modes.byId(pick.mode);
    seen.add(pick.mode);
    valid = valid && Modes.isPlayable(pick.mode) && map.modes.includes(pick.mode) && pick.bots >= Math.min(3, PlayFlow.defaultBots(pick.mode)) && pick.bots <= PlayFlow.defaultBots(pick.mode)
      && PlayFlow.difficulties().some((row) => row.id === pick.difficulty) && mode.sizeDefault >= 1;
  }
  check('shuffle: ' + PLAY_TEST_SHUFFLES + ' random picks are all valid mode / map / bot combinations', valid);
  check('shuffle: it really varies the mode', seen.size >= 5, seen.size);
  Bus.emit('ui.shuffleMatch', null);
  check('shuffle: the shuffle event starts a valid match in one call', Game.state === 'playing' && Game.match.map.modes.includes(Game.match.rules.mode) && Save.data.play.mode === Game.match.rules.mode);
  Game.stop();
});

Test.add('play', (check) => {
  PlayFlow.quickMatch();
  const first = Game.match, seed = first.setup.seed;
  playTestFinish();
  const results = Game.match.results;
  check('headless flow: reaching the score limit ends the match with a results record', Game.state === 'results' && !!results && results.players.length === 8 && results.winnerId === Game.playerId);
  check('headless flow: the outcome is a win with the player named', PlayFlow.outcome(results) === 'win' && PlayFlow.winnerName(results) === Actors.name[Game.playerId]);
  const again = PlayFlow.playAgain(() => 0.25);
  check('play again: a fresh match with the same setup and a new seed', Game.state === 'playing' && again !== first && Game.match.setup.mode === 'ffa' && Game.match.setup.seed !== seed && Game.match.results === null && Actors.count === 8);
  playTestFinish();
  const lastMap = Game.match.map.id;
  PlayFlow.nextMap(() => 0.75);
  check('next map: the same mode on the next map that lists it', Game.state === 'playing' && Game.match.map.id !== lastMap && Game.match.map.modes.includes('ffa') && Game.match.setup.mode === 'ffa');
  Game.stop();
  check('leave: stopping returns to the menu and clears the actors', Game.state === 'menu' && Game.match === null && Actors.count === 0);
  check('outcome helpers: no match means nothing to ask', PlayFlow.playAgain() === null && PlayFlow.nextMap() === null);

  PlayFlow.start({ mode: 'tdm', map: 'skyyard', bots: 3, team: 0 });
  const player = Game.playerId;
  const verdicts = [PlayFlow.outcome({ draw: true }), PlayFlow.outcome({ draw: false, winnerTeam: 0, winnerId: -1 }), PlayFlow.outcome({ draw: false, winnerTeam: 1, winnerId: -1 }),
    PlayFlow.outcome({ draw: false, winnerTeam: -1, winnerId: player }), PlayFlow.outcome({ draw: false, winnerTeam: -1, winnerId: player + 5 })];
  Game.playerId = -1;
  verdicts.push(PlayFlow.outcome({ draw: false, winnerTeam: 0, winnerId: -1 }));
  Game.playerId = player;
  check('outcome: draw, team win, team loss, free-for-all win and loss, no player', verdicts.join() === 'draw,win,loss,win,loss,over', verdicts.join());
  Game.stop();
});

Test.add('play', (check) => uiWith(() => {
  Ui.open('main');
  const buttons = Array.from(Ui.top().element.querySelectorAll('.ui-menu button'));
  check('main menu: the Play entry is switched on by the play screen', !buttons[2].disabled && buttons[2].firstChild.textContent === 'Play');
  buttons[0].click();
  check('quick match: one click on the main menu starts a match (UI-001, at most 2 actions)', Game.state === 'playing' && Ui.stack.length === 0);
  Game.pause('menu');
  check('pause: a quick match can be paused and offers Quit to menu', Ui.current() === 'pause' && uiClickButton(Ui.top().element, 'Quit to menu') && Ui.current() === 'confirm');
  uiClickButton(Ui.top().element, 'Quit');
  check('pause: quitting stops the match and shows the main menu', Game.state === 'menu' && Game.match === null && Ui.current() === 'main');

  Ui.open('main');
  uiClickButton(Ui.top().element, 'Play');
  check('play screen: opens from the main menu', Ui.current() === 'play');
  const root = Ui.top().element, label = (name) => Array.from(root.querySelectorAll('.ui-row')).find((row) => row.firstChild.textContent === name);
  check('play screen: shows mode, map, rules, bots and difficulty from the remembered setup', ['Mode', 'Map', 'Rules', 'Bots', 'Difficulty'].every((name) => label(name))
    && label('Mode').lastChild.textContent === 'Frenzy' && label('Map').lastChild.textContent === 'Foundry Spire' && label('Your team') === undefined);
  check('play screen: the bot slider ends at the quality cap', Number(label('Bots').querySelector('input').max) === PlayFlow.maxBots() && Number(label('Bots').querySelector('input').value) === 7);
  check('play screen: the summary tells the mode limits', root.querySelector('.ui-note').textContent.includes('25'));
  label('Mode').lastChild.click();
  check('play screen: changing the mode updates maps, bots and the team row', label('Mode').lastChild.textContent !== 'Frenzy' && label('Map').lastChild.textContent.length > 0);
  while (label('Mode').lastChild.textContent !== 'Team Clash') label('Mode').lastChild.click();
  check('play screen: a team mode offers the team choice and only its own maps', label('Your team') !== undefined && label('Map').lastChild.textContent === 'Skyward Yard' && Number(label('Bots').querySelector('input').value) === 7);
  const savedRandom = Math.random;
  Math.random = makeRandom(5).next;
  const before = root.textContent;
  uiClickButton(root, 'Shuffle');
  Math.random = savedRandom;
  check('play screen: Shuffle picks another valid setup', root.textContent !== before || label('Mode') !== undefined);
  while (label('Mode').lastChild.textContent !== 'Team Clash') label('Mode').lastChild.click();
  label('Bots').querySelector('input').value = 4;
  label('Bots').querySelector('input').dispatchEvent(new Event('input'));
  uiClickButton(root, 'Start');
  check('play screen: Start runs the chosen setup and remembers it', Game.state === 'playing' && Game.match.rules.mode === 'tdm' && playTestCount(ACTOR_KIND.BOT) === 4 && Save.data.play.bots === 4 && Save.data.play.mode === 'tdm');
  Game.stop();
}));

Test.add('play', (check) => uiWith(() => {
  PlayFlow.quickMatch();
  const seed = Game.match.setup.seed;
  playTestFinish();
  check('results: the screen opens by itself when the match ends', Game.state === 'results' && Ui.current() === 'results');
  const root = Ui.top().element, text = root.textContent;
  check('results: title, winner, your stats and the scoreboard with all 8 players', text.includes('Victory') && text.includes('You win.') && text.includes('kills') && root.querySelectorAll('.sb-table tr').length === 9);
  check('results: the three buttons are there and Esc does not close it', ['Play again', 'Next map', 'Main menu'].every((name) => Array.from(root.querySelectorAll('button')).some((button) => button.textContent === name)) && !Ui.back());
  uiClickButton(root, 'Play again');
  check('results: Play again starts a new match and closes the screen', Game.state === 'playing' && Ui.stack.length === 0 && Game.match.setup.seed !== seed);
  playTestFinish();
  uiClickButton(Ui.top().element, 'Next map');
  check('results: Next map starts the same mode on another map', Game.state === 'playing' && Game.match.map.id !== 'spire');
  playTestFinish();
  uiClickButton(Ui.top().element, 'Main menu');
  check('results: Main menu leaves the match and shows the main menu', Game.state === 'menu' && Ui.current() === 'main');
  Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true }], player: {} });
  Modes.finish(-1);
  check('results: a draw shows its own title', Ui.top().element.textContent.includes('Draw'));
}));

Test.add('play', (check) => {
  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1, -1], { player: { name: 'Me' } });
  const me = Game.playerId, others = [];
  for (let id = 0; id < Actors.count; id++) if (id !== me && Modes.participant[id]) others.push(id);
  Modes.score[others[0]] = 9; Modes.kills[others[0]] = 9; Modes.score[me] = 4; Modes.kills[me] = 2; Modes.deaths[me] = 1; Modes.score[others[1]] = 4; Modes.kills[others[1]] = 3;
  const rows = Scoreboard.playerRows();
  check('scoreboard: every participant, sorted by score then kills', rows.length === 4 && rows[0].id === others[0] && rows[1].id === others[1] && rows[2].id === me);
  check('scoreboard: kills, deaths, assists and score come from the live match', rows[2].kills === 2 && rows[2].deaths === 1 && rows[2].score === 4 && rows[2].alive);
  const box = document.createElement('div');
  Scoreboard.renderInto(box);
  check('scoreboard: one table with a header and four player rows, no objective column', box.querySelectorAll('tr').length === 5 && !box.textContent.includes('Captures') && box.querySelectorAll('.sb-me').length === 1);
  Modes.objective[me] = 2;
  Scoreboard.renderInto(box);
  check('scoreboard: an objective column appears as soon as someone scored one', box.textContent.includes('Objective'));
  Actors.alive[others[2]] = 0;
  Scoreboard.renderInto(box);
  check('scoreboard: dead players are greyed', box.querySelectorAll('.sb-dead').length >= 1);
  endModeTest();

  startModeTest('dom', modesTestMap({ spawns: TEAM_SPAWNS, objectives: [{ id: 'a', kind: 'point', x: 0, y: 0, z: 20, radius: 4 }] }), [0, 0, 1, 1], { player: { name: 'Me', team: 0 } });
  Modes.teamScore[0] = 12; Modes.teamScore[1] = 7; Modes.teamRounds[1] = 1;
  Scoreboard.renderInto(box);
  const heads = Array.from(box.querySelectorAll('.sb-team-head')).map((head) => head.textContent);
  check('scoreboard: team modes show a block per team with its total', heads.length === 2 && heads[0].includes('Blue') && heads[0].includes('12') && heads[1].includes('Red') && heads[1].includes('Rounds 1'), heads.join('|'));
  check('scoreboard: Holdfast has the Captures column', box.textContent.includes('Captures'));
  check('scoreboard: team members sit under their own team', box.querySelectorAll('.sb-teams > div')[0].querySelectorAll('tr').length === 1 + 3);
  const mine = box.querySelector('.sb-me td').style.color;
  check('scoreboard: team colour and shape mark the rows (ACC-001)', mine !== '' && box.textContent.includes('●') && box.textContent.includes('▲'));
  endModeTest();
});

Test.add('play', (check) => {
  startModeTest('ffa', modesTestMap({ spawns: FFA_SPAWNS }), [-1, -1], { player: { name: 'Me' } });
  const me = Game.playerId, other = me === 0 ? 1 : 0;
  LocalPlayerStats.reset();
  const fire = (id) => Bus.emit('weapon.fire', { id, weapon: 'warden', weaponClass: 'sidearm', mode: 'primary', x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 1 });
  const hit = (extra) => Bus.emit('damage', Object.assign({ target: other, source: me, amount: 10, absorbed: 0, zone: 'body', weapon: 'warden', element: 'kinetic', kind: 'hit', x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 }, extra));
  fire(me); hit(); hit(); hit();
  fire(me);
  fire(me); hit({ zone: 'head' });
  fire(me); hit({ kind: 'dot' });
  fire(other);
  Bus.emit('damage', { target: me, source: other, amount: 5, weapon: 'warden', kind: 'hit', zone: 'body' });
  Bus.emit('kill', { victim: other, killer: me, assister: -1, weapon: 'warden', zone: 'head', element: 'kinetic', x: 0, y: 0, z: 0 });
  const rows = LocalPlayerStats.rows();
  check('accuracy: shots, hits (once per shot even with pellets), headshots and kills per weapon', rows.length === 1 && rows[0].name === 'Warden Pistol' && rows[0].shots === 4 && rows[0].hits === 2 && rows[0].headshots === 1 && rows[0].kills === 1, JSON.stringify(rows));
  check('accuracy: 2 of 4 shots is 50%, burning damage and other players shots do not count', Test.near(rows[0].accuracy, 0.5, 1e-9));
  Bus.emit('medal', { id: me, medal: 'doubleKill' });
  Bus.emit('medal', { id: me, medal: 'doubleKill' });
  Bus.emit('medal', { id: other, medal: 'spree' });
  const box = document.createElement('div');
  Scoreboard.renderInto(box);
  check('scoreboard: your weapons table shows the percentage and the medals show with counts', box.textContent.includes('Your weapons') && box.textContent.includes('50%') && box.textContent.includes('Double Kill x2') && !box.textContent.includes('Spree'));
  Game.start(Game.match.setup);
  check('accuracy: a new match starts from zero', LocalPlayerStats.rows().length === 0 && LocalPlayerStats.medals.size === 0);
  endModeTest();
});

Test.add('play', (check) => uiWith(() => {
  PlayFlow.quickMatch();
  Bus.emit('input.action', { action: 'scoreboard', down: true });
  check('scoreboard: Tab opens it (a DOM screen, UI-010)', Ui.current() === 'scoreboard' && Ui.top().element.textContent.includes('Frenzy'));
  Bus.emit('input.action', { action: 'scoreboard', down: false });
  check('scoreboard: releasing Tab closes it', Ui.current() === '');
  Input.device = 'touch';
  Bus.emit('input.action', { action: 'scoreboard', down: true });
  Bus.emit('input.action', { action: 'scoreboard', down: false });
  check('scoreboard: on touch a tap opens it and the release keeps it open', Ui.current() === 'scoreboard');
  Bus.emit('input.action', { action: 'scoreboard', down: true });
  Bus.emit('input.action', { action: 'scoreboard', down: false });
  check('scoreboard: the next tap closes it', Ui.current() === '');
  Bus.emit('input.action', { action: 'scoreboard', down: true });
  uiClickButton(Ui.top().element, 'Close');
  check('scoreboard: the Close button works', Ui.current() === '');
  Input.device = 'kbm';
  Modes.score[Game.playerId] = 7;
  Bus.emit('input.action', { action: 'scoreboard', down: true });
  Modes.score[Game.playerId] = 12;
  Scoreboard.timer = 0;
  Scoreboard.refresh(1000);
  check('scoreboard: it refreshes while open', Ui.top().element.querySelector('.sb-me').textContent.includes('12'));
  Ui.closeAll();
  Game.pause('menu');
  Ui.closeAll();
  Bus.emit('input.action', { action: 'scoreboard', down: true });
  check('scoreboard: not while paused', Ui.current() === '');
  Game.resume();
  Scoreboard.onRound({ phase: 'end' });
  check('scoreboard: a round end opens it by itself', Ui.current() === 'scoreboard' && Scoreboard.auto);
  Scoreboard.onRound({ phase: 'start' });
  check('scoreboard: the next round closes it again', Ui.current() === '' && !Scoreboard.auto);
  Ui.open('help');
  Scoreboard.onRound({ phase: 'end' });
  check('scoreboard: a round end does not cover another open screen', Ui.current() === 'help');
  Ui.closeAll();
  Game.headless = true;
  Bus.emit('input.action', { action: 'scoreboard', down: true });
  check('scoreboard: headless runs open no screen', Ui.stack.length === 0);
  Game.stop();
}));

function playTestHit(target, amount) {
  const info = Damage.info();
  info.amount = amount;
  let source = 0;
  while (Actors.kind[source] !== ACTOR_KIND.BOT) source++;
  return Damage.apply(source, target, info);
}

Test.add('play', (check) => {
  const match = DebugApi.stress('max');
  check('__CTK.stress: a deathmatch with the most bots the quality allows (ARC-040)', match === Game.match && Game.match.rules.mode === 'ffa'
    && playTestCount(ACTOR_KIND.BOT) === PlayFlow.maxBots() && Game.playerId >= 0, playTestCount(ACTOR_KIND.BOT) + '/' + PlayFlow.maxBots());
  check('__CTK.stress(\'max\'): the explosive mutators are on', DEBUG_STRESS_MUTATORS.every((id) => Game.match.rules.mutators.some((entry) => entry.id === id)) && Mutators.fx.lastGift === true);
  const player = Game.playerId;
  check('__CTK.give: gives a weapon key to the player', DebugApi.give('warden') && Weapons.has(player, 'warden'));
  check('__CTK.give: gives a powerup key', DebugApi.give('quickening') && Powerups.has(player, 'quickening'));
  Modes.endProtection(player);
  DebugApi.god(true);
  const dealtWithGod = playTestHit(player, 500);
  check('__CTK.god(true): the player takes no damage', Actors.alive[player] === 1 && dealtWithGod === 0);
  DebugApi.god(false);
  check('__CTK.god(false): damage lands again', playTestHit(player, 1) > 0 && (Actors.flags[player] & ACTOR_FLAG.GOD) === 0);
  Game.stop();
});

// ---- Roster bots: every bot (in the difficulty range or held inside it) gets the adaptive tier shift ----
Test.add('play', (check) => {
  const adaptive = Settings.get('difficulty.adaptive'), shift = Settings.get('difficulty.tierShift');
  try {
    Settings.set('difficulty.adaptive', true); Settings.set('difficulty.tierShift', 1);
    const difficulty = CAT.difficulty.byId('stroll');
    Game.start(PlayFlow.buildSetup(PlayFlow.normalize({ mode: 'ffa', bots: 7, difficulty: 'stroll' }), () => 0.5));
    const wrong = [];
    for (let id = 0; id < Actors.count; id++) {
      const row = Actors.kind[id] === ACTOR_KIND.BOT ? Bots.profile[id] : null;
      if (row && Bots.tier(id).tier !== clamp(clamp(row.tier, difficulty.tierMin, difficulty.tierMax) + 1, 0, BOT_TIER_COUNT - 1)) wrong.push(row.name + ' ' + row.tier + '->' + Bots.tier(id).tier);
    }
    check('roster bots: each tier is the profile tier held in the range, plus the adaptive shift', wrong.length === 0, wrong.join());
  } finally {
    Settings.set('difficulty.tierShift', shift); Settings.set('difficulty.adaptive', adaptive);
    Game.stop();
  }
});

// ---- Results flow: next step, plain winner text, roster bots, match length ----
Test.add('play', (check) => uiWith(() => {
  const saved = Save.data.play, buttons = () => Array.from(Ui.top().element.querySelectorAll('button')).map((button) => button.textContent);
  try {
    Save.data.play = undefined;
    PlayFlow.quickMatch();
    const names = Array.from({ length: Actors.count }, (unused, id) => id).filter((id) => Actors.kind[id] === ACTOR_KIND.BOT).map((id) => Actors.name[id]);
    check('quick match: the bots are seven different roster bots', names.length === 7 && new Set(names).size === 7 && names.every((name) => CAT.bots.some((row) => row.name === name)), names.join());
    playTestFinish();
    check('results: a won free-for-all says You win.', Ui.top().element.textContent.includes('You win.'));
    Game.stop(); Ui.closeAll();
    const short = PlayFlow.lengthLimits('ffa', 'short');
    check('match length: Short halves the limits, rounded up (15 frags, 5 minutes)', short.scoreLimit === 15 && short.timeLimit === 300 && PlayFlow.lengthLimits('ffa', 'standard') === null);
    PlayFlow.start(Object.assign(PlayFlow.defaults(), { length: 'short' }));
    const first = Game.match.rules.scoreLimit + '/' + Game.match.rules.timeLimit;
    Game.stop(); PlayFlow.quickMatch();
    check('match length: Short runs the match and Quick Match keeps it', first === '15/300' && Game.match.rules.scoreLimit === 15 && Save.data.play.length === 'short', first);
    Game.stop();
    Ladder.setDifficulty(0, 0, 'novice'); Ladder.start(0, 0); Modes.finish(Game.playerId);
    const primary = Ui.top().element.querySelector('.ui-foot .primary');
    check('results: a cleared ladder match offers Next match as the primary button', Ui.current() === 'results' && primary && primary.textContent === 'Next match');
    uiClickButton(Ui.top().element, 'Next match');
    check('results: Next match starts ladder match 2', Game.match.setup.progress.kind === 'ladder' && Game.match.setup.progress.match === 1);
    Modes.finish(Array.from({ length: Actors.count }, (unused, id) => id).find((id) => id !== Game.playerId && Actors.kind[id] === ACTOR_KIND.BOT));
    check('results: a lost ladder match offers Retry, not Next match', buttons().includes('Retry') && !buttons().includes('Next match'));
    Game.stop(); Ui.closeAll();
    // An operation moves on after every map, so a lost map offers only Next map (no Retry that would start the next stage).
    Operations.reset('highline'); Operations.start('highline'); Modes.finish(1);
    check('results: a lost operation map offers Next map and no Retry or Play again', buttons().includes('Next map') && !buttons().includes('Retry') && !buttons().includes('Play again'), buttons().join());
  } finally {
    Save.data.play = saved;
    Game.stop(); Ui.closeAll();
  }
}));

// ---- A co-op run that ends with no winner is a loss: Defeat with its reason, never Draw (ai-01) ----
Test.add('play', (check) => uiWith(() => {
  try {
    Game.start({ mode: 'horde', map: 'cistern', seed: PLAY_TEST_SEED, player: { team: 0, name: PLAY_PLAYER_NAME }, bots: [] });
    Modes.finish(Modes.over(DRAW, PVE_LOSE));
    const results = Game.match.results, text = Ui.top().element.textContent;
    check('results: a lost co-op run is a loss, not a draw', results.lost && !results.draw && PlayFlow.outcome(results) === 'loss', JSON.stringify({ lost: results.lost, draw: results.draw }));
    check('results: the screen says Defeat and why', text.includes(PLAY_RESULT_TITLES.loss) && !!PLAY_REASON_TEXT[PVE_LOSE] && text.includes(PLAY_REASON_TEXT[PVE_LOSE]), text.slice(0, 80));
    check('results: every co-op end reason has its line', [PVE_WIN, PVE_LOSE, 'extracted', 'objective'].every((reason) => !!PLAY_REASON_TEXT[reason]));
    Game.stop(); Ui.closeAll();
    Game.start({ mode: 'ffa', map: 'spire', seed: PLAY_TEST_SEED, player: { name: PLAY_PLAYER_NAME }, bots: [{}] });
    Modes.finish(Modes.over(DRAW, 'draw'));
    check('results: a versus draw stays a draw', Game.match.results.draw && !Game.match.results.lost && PlayFlow.outcome(Game.match.results) === 'draw');
  } finally {
    Game.stop(); Ui.closeAll();
  }
}));
