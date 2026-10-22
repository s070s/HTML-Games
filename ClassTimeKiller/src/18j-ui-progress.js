// ==== S18 UI: CAREER SCREENS (PRG-001..PRG-014) ====
// The Career hub (main menu entry) with Profile / unlocks, Tournament Ladder, Challenge Rooms, Operations, Daily Seed, Cards
// and Statistics, the in-match card screen (pause menu and the 'cards' action), the XP panel on the results screen, the PvE mode
// entries (PRG-005, also on the Solo screen of 18o) and the Firing Range (main menu Range, the offer to new players, PRG-008).
// Logic lives in S15 (15a..15d); this file only shows it.

const CAREER_CSS = '.pg-bar { height: 8px; background: var(--ui-line); border-radius: 4px; overflow: hidden; margin: 4px 0 10px; max-width: 520px; }'
  + '.pg-bar > div { height: 100%; background: var(--ui-accent); } .pg-stars { color: var(--ui-accent); letter-spacing: 0.1em; margin-left: 8px; }'
  + '.pg-list .ui-row { flex-wrap: wrap; } .pg-small { color: var(--ui-dim); font-size: 0.875em; } .pg-award { margin-bottom: 10px; }'
  + '.pg-swatch { display: inline-block; width: 1em; height: 1em; border-radius: 3px; vertical-align: middle; margin-right: 6px; border: 1px solid var(--ui-line); }';
const CAREER_STAR = '★';
const CAREER_NO_STAR = '☆';
// PRG-005: the PvE modes started with a fixed setup (labels are the mode names).
const CAREER_MODE_ENTRIES = [{ mode: 'horde' }, { mode: 'endless' }, { mode: 'puzzle' }];
const CAREER_RANGE_MODE = 'range';
const CAREER_NEXT_UNLOCKS = 4;
const CAREER_HISTORY_SHOWN = 10;
const CAREER_DEFAULT_LOOK = '';
const CAREER_FINISH_GLOW_PX = 16;      // swatch glow in pixels at finish 1 (the finishes run 0.1 .. 0.65)

// The UI fills the links Progress (S15) needs from S18, so S15 never calls the UI directly.
Progress.links.outcome = (results) => PlayFlow.outcome(results);
Progress.links.playerStats = LocalPlayerStats;

function careerStars(count) { return CAREER_STAR.repeat(count) + CAREER_NO_STAR.repeat(Math.max(0, CHALLENGE_STARS.length - count)); }
function careerBar(fraction) {
  const bar = makeElement('div', 'pg-bar'), fill = makeElement('div');
  fill.style.width = Math.round(clamp(fraction, 0, 1) * 100) + '%';
  bar.appendChild(fill);
  return bar;
}
function careerList(root) { const list = makeElement('div', 'ui-scroll pg-list'); root.appendChild(list); return list; }
function careerRow(label, detail, buttons) {
  const row = makeElement('div', 'ui-row');
  const text = makeElement('span', 'ui-label', label);
  if (detail) { text.appendChild(makeElement('br')); text.appendChild(makeElement('span', 'pg-small', detail)); }
  row.appendChild(text);
  for (const button of buttons) row.appendChild(button);
  return row;
}
function careerDisabled(text) { const button = Ui.button(text, () => {}); button.disabled = true; return button; }
function careerModeName(modeId) { const row = CAT.modes.byId(modeId); return row ? row.name : modeId; }
function careerMapName(mapId) { const row = CAT.maps.byId(mapId); return row ? row.name : STAT_MAP_GROUP_NAMES[mapId] || mapId; }
function careerLevelText() {
  const level = Progress.level(), title = Progress.title();
  const next = level >= PROGRESS_LEVELS.max ? 'max level' : Math.round(Progress.levelProgress() * 100) + '% to level ' + (level + 1);
  return 'Level ' + level + (title ? ' - ' + title : '') + ' (' + next + ')';
}

// ---- Starting modes and the range: a fixed setup that does not overwrite the remembered Quick Match choice ----
function careerModeAvailable(modeId) { return Modes.isPlayable(modeId) && Maps.forMode(modeId).length > 0; }
function careerStartMode(modeId, difficulty) {
  if (!careerModeAvailable(modeId)) { Ui.toast('Coming soon'); return null; }
  const choice = { mode: modeId, map: Maps.forMode(modeId)[0].id, ruleset: '', bots: PlayFlow.defaultBots(modeId), difficulty: difficulty || PLAY_DEFAULT_DIFFICULTY, team: PLAY_AUTO_TEAM };
  return Game.start(PlayFlow.buildSetup(choice));
}
// One button per PvE mode entry (a disabled one when the build has no behaviour or map for it).
function careerModeButton(entry, difficulty) {
  const label = careerModeName(entry.mode);
  return careerModeAvailable(entry.mode) ? Ui.button(label, () => careerStartMode(entry.mode, difficulty && difficulty())) : careerDisabled(label + ' (coming soon)');
}
function careerRangeAvailable() { return Ui.screens.has(CAREER_RANGE_MODE) || careerModeAvailable(CAREER_RANGE_MODE); }
function careerOpenRange() {
  if (Ui.screens.has(CAREER_RANGE_MODE)) { Ui.open(CAREER_RANGE_MODE); return; }
  careerStartMode(CAREER_RANGE_MODE);
}

// ---- Career hub ----
const CAREER_SCREENS = [
  { label: 'Profile and unlocks', screen: 'profile' }, { label: 'Tournament Ladder', screen: 'ladder' },
  { label: 'Challenge Rooms', screen: 'challenges' }, { label: 'Operations', screen: 'operations' },
  { label: 'Daily Seed', screen: 'daily' }, { label: 'Cards', screen: 'cards' }, { label: 'Statistics', screen: 'stats' },
];
Ui.register('career', {
  build(root) {
    injectStyle('career-style', CAREER_CSS);
    screenHeader(root, 'Career');
    root.appendChild(makeElement('p', 'ui-sub', careerLevelText()));
    root.appendChild(careerBar(Progress.levelProgress()));
    const menu = makeElement('div', 'ui-menu');
    for (const entry of CAREER_SCREENS) menu.appendChild(Ui.button(entry.label, () => Ui.open(entry.screen), entry.screen === 'ladder' ? 'primary' : ''));
    menu.appendChild(Ui.button('Solo', () => Ui.open('solo')));   // the PvE modes (with a difficulty choice) live there; the Firing Range is on the main menu
    menu.firstChild.dataset.autofocus = '1';
    root.appendChild(menu);
  },
});

// ---- Profile: level, cosmetics, the next unlocks, medals ----
function careerLookCycle(kind, label, onChange) {
  const rows = Progress.unlocked(kind);
  const values = [CAREER_DEFAULT_LOOK].concat(rows.map((row) => row.id)), labels = ['Default'].concat(rows.map((row) => row.name));
  return Ui.row(label, Ui.cycle(values, labels, Progress.profile().cosmetics[kind] || CAREER_DEFAULT_LOOK, (value) => {
    Progress.setCosmetic(kind, value);
    if (onChange) onChange();
  }));
}
// The worn body colour as a swatch, its glow showing the finish (an empty swatch: the default team look).
function careerPaintSwatch(swatch) {
  const color = Progress.look.color, finish = Progress.look.finish;
  const css = color === PROGRESS_NO_LOOK ? '' : '#' + color.toString(16).padStart(6, '0');
  swatch.style.background = css || 'transparent';
  swatch.style.boxShadow = css && finish !== PROGRESS_NO_LOOK ? '0 0 ' + Math.round(finish * CAREER_FINISH_GLOW_PX) + 'px ' + css : 'none';
}
function careerNextUnlocks() {
  const level = Progress.level();
  return CAT.unlocks.filter((row) => row.level > level && !Progress.isUnlocked(row)).sort((a, b) => a.level - b.level).slice(0, CAREER_NEXT_UNLOCKS);
}
Ui.register('profile', {
  build(root) {
    screenHeader(root, 'Profile');
    root.appendChild(makeElement('p', 'ui-sub', careerLevelText() + ', ' + Progress.profile().xp + ' XP, ' + Progress.profile().matches + ' matches'));
    root.appendChild(careerBar(Progress.levelProgress()));
    const list = careerList(root);
    list.appendChild(makeElement('div', 'ui-group', 'Look (cosmetic only)'));
    const swatch = makeElement('span', 'pg-swatch'), paint = () => careerPaintSwatch(swatch);
    const colorRow = careerLookCycle('color', 'Body colour', paint);
    colorRow.appendChild(swatch);
    paint();
    list.appendChild(colorRow);
    list.appendChild(careerLookCycle('finish', 'Finish', paint));
    list.appendChild(careerLookCycle('title', 'Title'));
    list.appendChild(makeElement('div', 'ui-group', 'Next unlocks'));
    for (const row of careerNextUnlocks()) list.appendChild(careerRow(row.name, 'Level ' + row.level + ' - ' + row.kind, []));
    list.appendChild(makeElement('p', 'ui-note', 'Mastery colours unlock by weapon mastery (Statistics); cards by their own challenge. Settings > Gameplay > Unlock everything opens all of it.'));
    list.appendChild(makeElement('div', 'ui-group', 'Medals'));
    for (const row of CAT.medals) list.appendChild(careerRow(row.code + ' ' + row.name + ': ' + (Progress.profile().medals[row.id] || 0), row.text, []));
  },
});

// ---- Tournament Ladder ----
function careerLadderStatus(tier, match) {
  const state = Ladder.state();
  if (state.cleared[Ladder.key(tier, match)]) return 'cleared';
  if (tier === state.tier && match === state.match) return 'next';
  return Ladder.isOpen(tier, match) ? 'open' : 'locked';
}
function careerLadderRow(tier, match) {
  const entry = Ladder.entry(tier, match), status = careerLadderStatus(tier, match);
  const opponents = entry.bots.slice(entry.allies || 0).map((id) => CAT.bots.byId(id).name).join(', ');
  const difficulties = PlayFlow.difficulties();
  const difficulty = Ui.cycle(difficulties.map((row) => row.id), difficulties.map((row) => row.name), Ladder.difficultyFor(tier, match), (value) => Ladder.setDifficulty(tier, match, value));
  const play = status === 'locked' ? careerDisabled('Locked') : Ui.button(status === 'next' ? 'Play' : 'Replay', () => Ladder.start(tier, match), status === 'next' ? 'primary' : '');
  if (status === 'next') play.dataset.autofocus = '1';
  const label = (match + 1) + '. ' + careerModeName(entry.mode) + ' on ' + careerMapName(entry.map) + (entry.final ? ' - FINAL' : '');
  return careerRow(label, 'vs ' + opponents + ' - ' + status, status === 'locked' ? [play] : [difficulty, play]);
}
Ui.register('ladder', {
  build(root) {
    screenHeader(root, 'Tournament Ladder');
    const state = Ladder.state();
    root.appendChild(makeElement('p', 'ui-sub', state.done ? 'Champion! Every match stays replayable.' : Ladder.clearedCount() + ' of ' + Ladder.matchCount() + ' matches cleared. Free-for-all: finish in the top ' + LADDER_PODIUM + '; duels and team matches: win.'));
    const list = careerList(root);
    CAT.ladder.forEach((row, tier) => {
      list.appendChild(makeElement('div', 'ui-group', row.code + ' ' + row.name));
      row.matches.forEach((entry, match) => list.appendChild(careerLadderRow(tier, match)));
    });
  },
});

// ---- Challenge Rooms ----
function careerRoomUnlockText(group) {
  const row = CAT.unlocks.find((unlock) => unlock.kind === 'challenge' && unlock.value === group);
  return row ? 'Opens at level ' + row.level : 'Locked';
}
function careerRoomRow(row) {
  if (!Challenges.isOpen(row)) return careerRow(row.code + ' ' + row.name, careerRoomUnlockText(row.group), [careerDisabled('Locked')]);
  const record = Challenges.record(row.id);
  const buttons = [Ui.button('Play', () => Challenges.start(row.id, false))];
  buttons.push(Challenges.expertOpen(row.id) ? Ui.button('Expert', () => Challenges.start(row.id, true)) : careerDisabled('Expert at ' + CHALLENGE_EXPERT_STARS + ' stars'));
  const label = makeElement('span');
  label.textContent = row.code + ' ' + row.name;
  label.appendChild(makeElement('span', 'pg-stars', careerStars(record.stars)));
  const detail = row.text + ' Best ' + record.best + (record.expertBest ? ', Expert ' + record.expertBest + ' ' + careerStars(record.expertStars) : '') + '. Stars at ' + row.stars.join(' / ') + ' points.';
  const element = careerRow('', detail, buttons);
  element.firstChild.prepend(label);
  return element;
}
Ui.register('challenges', {
  build(root) {
    screenHeader(root, 'Challenge Rooms');
    root.appendChild(makeElement('p', 'ui-sub', Challenges.totalStars() + ' stars. Retry instantly with Play again on the results screen or Restart in the pause menu.'));
    const list = careerList(root);
    for (const kind of CHALLENGE_KINDS) {
      const rows = CAT.challenges.filter((row) => row.kind === kind);
      if (!rows.length) continue;
      list.appendChild(makeElement('div', 'ui-group', kind.replace(HUD_CAMEL_BREAK, '$1 $2')));
      for (const row of rows) list.appendChild(careerRoomRow(row));
    }
  },
});

// ---- Operations ----
function careerOperationRow(row) {
  const state = Operations.state(row.id), stage = row.stages[Math.min(state.stage, row.stages.length - 1)];
  const detail = state.done ? 'Finished: ' + state.result + ' (' + state.wins[0] + ' - ' + state.wins[1] + '). Completed ' + state.completed + 'x.'
    : 'Map ' + (state.stage + 1) + ' of ' + row.stages.length + ': ' + careerModeName(stage.mode) + ' on ' + careerMapName(stage.map) + '. Tickets ' + state.tickets[0] + ' vs ' + state.tickets[1]
      + (state.comeback === PROGRESS_PLAYER_TEAM ? '. Your side gets the heavy unit.' : state.comeback === PROGRESS_ENEMY_TEAM ? '. The enemy gets the heavy unit.' : '');
  const buttons = [Ui.button(state.done ? 'Play again' : 'Play map ' + (state.stage + 1), () => Operations.start(row.id), 'primary')];
  if (state.stage > 0 && !state.done) buttons.push(Ui.button('Restart', () => { Operations.reset(row.id); Ui.replace('operations'); }));
  return careerRow(row.code + ' ' + row.name + ' - ' + row.text, detail, buttons);
}
Ui.register('operations', {
  build(root) {
    screenHeader(root, 'Operations');
    root.appendChild(makeElement('p', 'ui-sub', 'Three maps in a row. Each death costs a ticket; tickets left carry over (' + OPERATION_TICKETS.base + ' + half of what is left). The side that lost a map gets a heavy unit on the next.'));
    const list = careerList(root);
    for (const row of CAT.operations) list.appendChild(careerOperationRow(row));
  },
});

// ---- Daily Seed ----
function careerDailySummary(choice) {
  const ruleset = CAT.rulesets.byId(choice.ruleset), names = choice.mutators.map((id) => Mutators.row(id).name);
  return careerModeName(choice.mode) + ', ' + (ruleset ? ruleset.name : choice.ruleset) + ', ' + names.join(' + ') + ', ' + (choice.generator ? 'generated map' : careerMapName(choice.map));
}
Ui.register('daily', {
  build(root) {
    screenHeader(root, 'Daily Seed');
    const key = Daily.todayKey(), choice = Daily.choiceFor(key), best = Progress.profile().daily[key];
    root.appendChild(makeElement('p', 'ui-sub', key + ': ' + careerDailySummary(choice)));
    root.appendChild(makeElement('p', 'ui-note', 'The same date gives everyone the same match. Play as often as you like: only your best score is kept. Missing a day costs nothing.'));
    const foot = makeElement('div', 'ui-foot'), play = Ui.button(best === undefined ? 'Play today' : 'Play again (best ' + best + ')', () => Daily.start(key), 'primary');
    play.dataset.autofocus = '1';
    foot.appendChild(play);
    root.appendChild(foot);
    const list = careerList(root);
    list.appendChild(makeElement('div', 'ui-group', 'Your best scores'));
    for (const entry of Daily.history().slice(0, CAREER_HISTORY_SHOWN)) list.appendChild(careerRow(entry.key + ': ' + entry.best, '', []));
  },
});

// ---- Cards ----
function careerCardButton(row) {
  if (Cards.isEquipped(row.id)) return Ui.button('Remove', () => { Cards.unequip(row.id); Ui.replace('cards'); });
  const problem = Cards.equipProblem(row.id);
  if (problem) return careerDisabled(Cards.isUnlocked(row.id) ? problem : 'Locked');
  return Ui.button('Place (' + Cards.priceOf(row) + ')', () => { Cards.equip(row.id); Ui.replace('cards'); });
}
function careerCardRow(row) {
  const detail = row.text + ' Cost ' + row.cost + '.' + (row.versus ? ' Versus with Cards Allowed.' : ' PvE only.') + (Cards.isUnlocked(row.id) ? '' : ' Unlock: ' + row.unlock.text);
  return careerRow(row.code + ' ' + row.name + ' (' + row.type + ')', detail, [careerCardButton(row)]);
}
Ui.register('cards', {
  build(root) {
    screenHeader(root, 'Cards');
    const active = Cards.equipped('active').length, passive = Cards.equipped('passive').length;
    root.appendChild(makeElement('p', 'ui-sub', Cards.marks() + ' Marks. Active ' + active + ' / ' + CARD_SLOTS.active + ', passive ' + passive + ' / ' + CARD_SLOTS.passive
      + '. Removing a card refunds half. Use active cards from the pause menu during a match.'));
    const list = careerList(root);
    for (const type of ['active', 'passive']) {
      list.appendChild(makeElement('div', 'ui-group', type === 'active' ? 'Active (once per level, ' + CARD_ACTIVE_SECONDS + ' s)' : 'Passive (whole level)'));
      for (const row of CAT.cards) if (row.type === type) list.appendChild(careerCardRow(row));
    }
  },
});
// In a match: the active cards with a Use button each (pause menu entry).
Ui.register('cardUse', {
  build(root) {
    screenHeader(root, 'Cards');
    const list = careerList(root);
    if (!CardRun.slots.length) list.appendChild(makeElement('p', 'ui-note', 'No active cards in this match.'));
    CardRun.slots.forEach((slot, index) => {
      const row = CAT.cards.byId(slot.id), running = slot.endsAt > Sim.time;
      const use = slot.usesLeft > 0 && !running ? Ui.button('Use', () => { CardRun.activate(index); Input.requestResume(); }, 'primary') : careerDisabled(running ? 'Running' : 'Used');
      list.appendChild(careerRow(row.name, row.text + ' Uses left: ' + slot.usesLeft, [use]));
    });
  },
});
// The pause row and the touch button exist only while the match holds active cards; the 'cards' action (Y, pad Home, touch CARD)
// pauses and opens the same screen. Re-added at every match start (a test run may empty Ui.pauseEntries).
const CARDS_PAUSE_ENTRY = { label: 'Cards', screen: 'cardUse', when: () => CardRun.slots.length > 0 };
function careerOpenCards(event) {
  if (event.action !== 'cards' || !event.down || Game.state !== 'playing' || Game.paused || Ui.stack.length) return;
  if (!CardRun.slots.length) { Ui.toast('No active cards in this match'); return; }
  Game.pause('menu');
  Ui.open('cardUse');
}
Bus.on('input.action', careerOpenCards);
Bus.on('match.start', () => { setPauseEntry(CARDS_PAUSE_ENTRY, true); TouchInput.setFlag('cards', CardRun.slots.length > 0); });
Bus.on('match.stop', () => TouchInput.setFlag('cards', false));

// ---- Statistics ----
function careerAccuracy(record) { return record.shots > 0 ? Math.round(record.hits / record.shots * 100) + '%' : '-'; }
function careerMastery(key) { const tier = Progress.masteryOf(key); return tier >= 0 ? MASTERY_TIERS[tier].name : 'no mastery yet'; }
Ui.register('stats', {
  build(root) {
    screenHeader(root, 'Statistics');
    const stats = Progress.stats(), totals = stats.totals;
    root.appendChild(makeElement('p', 'ui-sub', totals.matches + ' matches, ' + totals.wins + ' wins, ' + totals.kills + ' kills, ' + totals.deaths + ' deaths, ' + Math.round(totals.seconds / PROGRESS_SECONDS_PER_MINUTE) + ' minutes'));
    const list = careerList(root);
    list.appendChild(makeElement('div', 'ui-group', 'Weapons'));
    for (const key of Object.keys(stats.weapons).sort()) {
      const record = stats.weapons[key], row = CAT.weapons.byId(key);
      list.appendChild(careerRow((row ? row.name : key) + ' - ' + careerMastery(key), record.kills + ' kills, ' + record.headshots + ' headshots, accuracy ' + careerAccuracy(record), []));
    }
    list.appendChild(makeElement('div', 'ui-group', 'Modes'));
    for (const key of Object.keys(stats.modes).sort()) {
      const record = stats.modes[key];
      list.appendChild(careerRow(careerModeName(key), record.played + ' played, ' + record.wins + ' wins, ' + record.kills + ' kills, best score ' + record.bestScore, []));
    }
    list.appendChild(makeElement('div', 'ui-group', 'Maps'));
    for (const key of Object.keys(stats.maps).sort()) list.appendChild(careerRow(careerMapName(key), stats.maps[key].played + ' played, ' + stats.maps[key].wins + ' wins', []));
    list.appendChild(makeElement('p', 'ui-note', 'Mastery tiers: ' + MASTERY_TIERS.map((tier) => tier.name + ' ' + tier.kills + ' kills' + (tier.headshots ? ' + ' + tier.headshots + ' headshots' : '')).join(', ') + '.'));
  },
});

// ---- Results screen: what the match paid ----
function careerAwardPanel(container) {
  const award = Progress.finishMatch(Game.match);
  if (!award) return;
  const panel = makeElement('div', 'pg-award');
  const levelText = award.levelAfter > award.levelBefore ? 'Level up: ' + award.levelBefore + ' -> ' + award.levelAfter : careerLevelText();
  panel.appendChild(makeElement('div', 'ui-group', '+' + award.xp + ' XP. ' + levelText));
  panel.appendChild(careerBar(Progress.levelProgress()));
  const lines = award.lines.slice();
  if (award.medals.length) lines.push('Medals: ' + award.medals.join(', '));
  if (award.unlocks.length) lines.push('Unlocked: ' + award.unlocks.join(', '));
  for (const line of lines) panel.appendChild(makeElement('p', 'ui-note', line));
  container.prepend(panel);
}
PlayResultsExtras.push(careerAwardPanel);

// ---- First start: offer the Firing Range once (skippable, PRG-008); a build without the range keeps the offer for later ----
function careerOfferRange() {
  const profile = Progress.profile();
  if (Game.headless || profile.rangeOffered || !careerRangeAvailable()) return;
  Ui.confirm({ title: 'Welcome', text: 'Warm up in the Firing Range first? You can skip it and go straight to the menu.', yes: 'Firing Range', no: 'Skip', onYes: careerOpenRange });
  profile.rangeOffered = true;
  Save.scheduleSave();
}
Bus.on('ready', careerOfferRange);
Bus.on('ui.range', careerOpenRange);   // main menu Range: starts inside the click so the pointer can lock
