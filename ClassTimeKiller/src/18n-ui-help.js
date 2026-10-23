// ==== S18 UI: HELP, RULES PANEL, ECONOMY PANEL AND TIPS (UI-002, ECO-001, VIS-006) ====
// Help (a one-minute start guide, the current controls, the self-test), the in-game rules panel of the running ruleset with its mutators,
// the economy panel, and a few optional tips toasted during the first matches. The panels read Game.match.rules and the catalogues;
// the text lines come from small data tables, so a new mode, objective or economy only needs a row. Contracts: docs/api/accessibility.md.

const HELP_LINES = [
  'Win matches against bots in fast first-person arena fights. Quick Match starts one right away.',
  'Keyboard and mouse: click the game to lock the mouse. Gamepad: any pad with the standard layout. Touch: {touch}.',
  'Settings apply immediately and are saved. Everything can be rebound under Settings > Controls.',
  'Captions, the sound ring, colour-blind palettes, reduced motion and hold or toggle for every held action are under Settings > Accessibility.',
];
const HELP_START_STEPS = [
  'Press Quick Match. A match against bots starts at once with your last setup.',
  'Move, look and fire. The pause key opens the menu: Rules shows what counts in this match.',
  'Pick up health, armor and weapons from the map. Hold the scoreboard key to see who is ahead.',
  'Open Play for other modes and maps, Custom for your own rules, Settings for controls, HUD and accessibility.',
];
const TIPS_SETTING = 'gameplay.tips';
const TIPS_MATCHES = 3;                  // tips appear in the first matches only
const TIP_ACTIONS = [                    // per tip: the actions whose keys fill the {0} {1} ... slots of the text
  { text: 'Move with {0} {1} {2} {3}, look with the mouse, fire with {4}. {5} pauses.', actions: ['forward', 'left', 'back', 'right', 'fire', 'pause'] },
  { text: 'Jump with {0}, crouch with {1}, sprint with {2}. Reload with {3}.', actions: ['jump', 'crouch', 'sprint', 'reload'] },
  { text: 'Hold {0} for the scoreboard. {1} pings a place for your team.', soloText: 'Hold {0} for the scoreboard. {1} marks a place.', actions: ['scoreboard', 'ping'] },
];
// The touch and pad tips name the sides of the touch preset in use and the pad's own glyphs (a PlayStation pad says Cross, not A).
const TIP_TOUCH_TEXT = '{touch}. The buttons on the {buttons} fire, jump and reload.';
const TIP_PAD = { text: 'Left stick moves, right stick looks. {0} fires, {1} aims, {2} jumps.', actions: ['fire', 'alt', 'jump'] };

const FRIENDLY_FIRE_TEXT = ['Friendly fire is off.', 'Friendly fire is on.'];
const ECONOMY_LINES = [   // [applies, text] per economy preset field; money amounts come from the row
  [(row) => row.money && row.buy === 'round', (row) => 'You start with $' + row.startMoney + ' (at most $' + row.maxMoney + '). Buy in the buy zone for ' + row.buyTime + ' s after each round starts.'],
  [(row) => row.money && row.buy === 'shop', () => 'Earn money from kills and waves; spend it in the shop between waves.'],
  [(row) => row.winReward > 0, (row) => 'A won round pays $' + row.winReward + (row.lossLadder.length ? '; a lost round pays $' + row.lossLadder.join(', $') + ' as losses add up.' : '.')],
  [(row) => row.killReward > 0, (row) => 'Each kill pays $' + row.killReward + ' plus a bonus that depends on the weapon.'],
  [(row) => row.plantReward > 0, (row) => 'Planting or defusing the bomb pays $' + row.plantReward + '.'],
  [(row) => row.rarities.length > 0, (row) => 'You carry ' + currentWeaponSet().carry + ' weapons. Loot comes in rarities: ' + row.rarities.join(', ') + '.'],
  [(row) => row.loadout === 'classes', () => 'Choose a class with weapons and perks in the loadout screen. Your field upgrade is part of the class.'],
  [(row) => row.loadout === 'heroes', () => 'Pick a hero. Each hero brings its own weapons, abilities and ultimate.'],
  [(row) => row.ladder.length > 0, (row) => 'Climb a ladder of ' + row.ladder.length + ' weapons: every kill moves you to the next one.'],
  [(row) => !row.money && row.rarities.length === 0 && row.loadout === 'none' && row.ladder.length === 0, () => 'Weapons, ammo, armor and health come from pickups on the map. They respawn after a while.'],
];

// ---- Help ----
Ui.register('help', {
  build(root) {
    screenHeader(root, 'Help');
    const body = makeElement('div', 'ui-scroll');
    body.appendChild(makeElement('div', 'ui-group', 'Start in one minute'));
    HELP_START_STEPS.forEach((step, index) => body.appendChild(makeElement('p', 'ui-note', (index + 1) + '. ' + step)));
    for (const line of HELP_LINES) body.appendChild(makeElement('p', 'ui-note', line.replace('{touch}', touchSidesText())));
    body.appendChild(makeElement('div', 'ui-group', 'Current controls'));
    body.appendChild(makeElement('div', 'ui-result', controlsSummary()));
    if (Ui.selfTestRunner) appendSelfTest(body);   // only the test build carries the tests
    body.appendChild(makeElement('p', 'ui-note', 'ClassTimeKiller v' + VERSION));
    root.appendChild(body);
  },
});
function appendSelfTest(body) {
  body.appendChild(makeElement('div', 'ui-group', 'Self-test'));
  const output = makeElement('div', 'ui-result', selfTestSummary(Ui.lastSelfTest));
  const run = Ui.button('Run self-test', () => runSelfTest(output, run));
  body.appendChild(run);
  body.appendChild(output);
}

// ---- Rules panel and economy panel ----
function rulesSection(body, title, lines) {
  body.appendChild(makeElement('div', 'ui-group', title));
  for (const line of lines) body.appendChild(makeElement('p', 'ui-note', line));
}
function nameOf(catalogue, id) {
  const row = catalogue && catalogue.byId(id);
  return row ? row.name : id;
}
function limitsText(rules) {
  const parts = [];
  if (rules.scoreLimit > 0) parts.push('first to ' + rules.scoreLimit + ' points');
  if (rules.rounds) parts.push('win ' + rules.rounds.winsNeeded + ' rounds');
  if (rules.timeLimit > 0) parts.push(Math.round(rules.timeLimit / 60) + ' minutes');
  return parts.length ? parts.join(', ') : 'no limit';
}
function respawnText(rules) {
  if (rules.respawnMode === 'none') return 'No respawns.';
  if (rules.respawnMode === 'round') return 'You come back at the start of the next round.';
  return 'Respawn after ' + rules.respawn.delay + ' s, with ' + rules.respawn.protect + ' s of protection.' + (rules.lives > 0 ? ' You have ' + rules.lives + ' lives.' : '');
}
function percentText(label, value) { return label + ' ' + Math.round(value * 100) + '%'; }

// What wins this match, in one or two lines: the mode row's goal (the one goal text) and its goalDetail with the params filled.
function modeGoalLines(rules) {
  const mode = CAT.modes.byId(rules.mode);
  if (!mode) return [];
  if (!mode.goalDetail) return [mode.goal];
  const params = rules.params || mode.params;
  return [mode.goal, mode.goalDetail.replace(/\{(\w+)\}/g, (all, key) => params[key])];
}
// The running match as plain lines for the rules panel (also used by the self-test).
function rulesPanelLines(rules) {
  const mode = CAT.modes.byId(rules.mode), setup = [];
  const goal = ['Mode: ' + (mode ? mode.name : rules.mode)].concat(modeGoalLines(rules), ['Limits: ' + limitsText(rules) + '.']);
  setup.push('Rule set: ' + rules.name + (rules.code ? ' (' + rules.code + ')' : '') + '.');
  setup.push('Health: ' + nameOf(CAT.health, rules.health) + '. Movement: ' + nameOf(CAT.movement, rules.move) + '. Weapons: ' + nameOf(CAT.weaponSets, rules.weaponSet) + '.');
  setup.push(respawnText(rules));
  setup.push(FRIENDLY_FIRE_TEXT[rules.friendlyFire > 0 ? 1 : 0] + ' ' + percentText('Self damage', rules.selfDamage) + '. ' + percentText('Knockback', rules.knockback) + '. ' + percentText('Gravity', rules.gravityScale) + '.');
  if (rules.items === false) setup.push('There are no pickups on the map.');
  return { goal, setup };
}
function mutatorLines(rules) {
  return rules.mutators.length ? rules.mutators.map((entry) => Mutators.describe(entry)) : ['No mutators.'];
}
function difficultyLine(rules) {
  const skill = rules.botSkill;
  if (!skill) return 'No bots.';
  return nameOf(CAT.difficulty, skill.preset) + ': bot skill tiers ' + (skill.tierMin + 1) + ' to ' + (skill.tierMax + 1) + '.';
}
// row: the economy in effect (a mode's params.economy wins over the rule set's); the self-test passes other rows.
function economyPanelLines(row = Economy.preset()) {
  const lines = [];
  for (const [applies, text] of ECONOMY_LINES) if (applies(row)) lines.push(text(row));
  if (buyKeyAvailable(row)) lines.push(buyMenuText(row));
  return { name: row.name, lines };
}
// Where the buy menu (or, without a shop, the loadout screen) opens for the device in use: a key on a keyboard, the pause menu on a pad
// or a phone (no control is bound there), naming the pause row 18f shows for this economy.
function buyMenuText(row = Economy.preset()) {
  const keyboard = Input.device !== 'touch' && Input.device !== 'gamepad' && (Input.getBinding('buyMenu', 0) || Input.getBinding('buyMenu', 1));
  const shop = row.buy !== 'none', screen = shop ? 'the buy menu' : 'the loadout screen', entry = shop ? BUY_PAUSE_ENTRY : LOADOUT_PAUSE_ENTRY;
  return keyboard ? 'Open ' + screen + ' with ' + hudBoundLabel('buyMenu', Input.device) + '.' : 'Open ' + screen + ' from the pause menu (' + entry.label + ').';
}
function buyKeyAvailable(row = Economy.preset()) { return row.buy !== 'none' || row.loadout !== 'none'; }

function buildRulesBody(body, rules) {
  const text = rulesPanelLines(rules);
  rulesSection(body, 'Goal', text.goal);
  rulesSection(body, 'Rules', text.setup);
  rulesSection(body, 'Mutators', mutatorLines(rules));
  rulesSection(body, 'Bots', [difficultyLine(rules)]);
}
Ui.register('rules', {
  build(root) {
    screenHeader(root, 'Rules of this match');
    const body = makeElement('div', 'ui-scroll');
    if (Game.match && Game.match.rules) buildRulesBody(body, Game.match.rules); else body.appendChild(makeElement('p', 'ui-note', 'Start a match to see its rules.'));
    root.appendChild(body);
  },
});
Ui.register('economy', {
  build(root) {
    screenHeader(root, 'Economy');
    const body = makeElement('div', 'ui-scroll');
    if (Game.match && Game.match.rules) {
      const panel = economyPanelLines();
      rulesSection(body, panel.name, panel.lines);
    } else body.appendChild(makeElement('p', 'ui-note', 'Start a match to see its economy.'));
    root.appendChild(body);
  },
});
const RULES_PAUSE_ENTRIES = [{ label: 'Rules', screen: 'rules' }, { label: 'Economy', screen: 'economy' }];
Bus.on('match.start', () => { for (const entry of RULES_PAUSE_ENTRIES) setPauseEntry(entry, true); });

// ---- Optional tips in the first matches ----
Settings.define(TIPS_SETTING, true, { label: 'Show short tips in the first matches', category: 'gameplay' });

// Which thumb moves and which looks in the touch preset in use (the left-handed one swaps them).
function touchSidesText() { return TouchInput.preset().mirror ? 'right thumb moves, left thumb looks' : 'left thumb moves, right thumb looks'; }
// A tip row's text with its {0} {1} ... slots filled by the keys bound for `device`; its soloText in a match without teams.
function tipText(tip, device) {
  const solo = tip.soloText && Game.match && Game.match.rules && !Game.match.rules.teams;
  const labels = tip.actions.map((action) => hudBoundLabel(action, device) || Input.bindingLabel(NO_BINDING));
  return (solo ? tip.soloText : tip.text).replace(/\{(\d)\}/g, (unused, slot) => labels[+slot]);
}
const Tips = {
  // The text of tip number `index` for the device in use; '' when there is none.
  text(index) {
    if (Input.device === 'touch') return index === 0 ? this.touchText() : '';
    if (Input.device === 'gamepad') return index === 0 ? tipText(TIP_PAD, 'gamepad') : '';
    const tip = TIP_ACTIONS[index];
    return tip ? tipText(tip, 'kbm') : '';
  },
  touchText() {
    const sides = touchSidesText();
    return TIP_TOUCH_TEXT.replace('{touch}', sides[0].toUpperCase() + sides.slice(1)).replace('{buttons}', TouchInput.preset().mirror ? 'left' : 'right');
  },
  matchesSeen() { return Save.data && Save.data.tips ? Save.data.tips.matches : 0; },
  // Called at match start: one tip per match for the first TIPS_MATCHES matches. Returns the text shown ('' = none).
  show() {
    const seen = this.matchesSeen();
    if (!Settings.get(TIPS_SETTING) || seen >= TIPS_MATCHES) return '';
    Save.data.tips.matches = seen + 1;
    Save.scheduleSave();
    const text = this.text(seen);
    if (text) Ui.toast(text);
    return text;
  },
};
Bus.on('match.start', () => { if (!Game.headless) Tips.show(); });
