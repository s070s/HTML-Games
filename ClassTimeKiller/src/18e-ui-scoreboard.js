// ==== S18 UI: SCOREBOARD (MODE-003, UI-010) ====
// A DOM screen: hold Tab (or the pad's View button) to look, tap the touch button to open and close it; it also opens between rounds and
// the results screen (18d) shows the same tables. Per player kills / deaths / assists / score, team totals, an objective column for
// the mode, and the local player's accuracy per weapon (LocalPlayerStats, fed by weapon and damage events) with the medals earned.

const SCOREBOARD_TEAM_SYMBOLS = ['●', '▲', '■', '◆'];
const SCOREBOARD_OBJECTIVE_LABELS = { flag: 'Captures', point: 'Captures', hill: 'Hold time', bombsite: 'Plants', relic: 'Hold time', core: 'Defence', bank: 'Banked', extract: 'Extracts' };
const SCOREBOARD_DEFAULT_OBJECTIVE_LABEL = 'Objective';
// Accuracy counts a hit by the range's one rule (S14 ACCURACY_HIT_KINDS): a splash is a hit, damage over time adds damage, no hit.
function scoreboardCountsHit(kind) { return ACCURACY_HIT_KINDS.includes(kind); }
// A 0xRRGGBB colour as CSS text (the S18 screens' one colour rule).
function cssHex(color) { return '#' + color.toString(16).padStart(6, '0'); }
const SCOREBOARD_CSS = '.sb-panel { width: min(1000px, 100%); max-height: 100%; overflow-y: auto; margin: auto; padding: 12px 14px; background: rgba(8, 12, 18, 0.9);'
  + ' border: 1px solid var(--ui-line); border-radius: 12px; pointer-events: auto; touch-action: pan-y; }'
  + '.sb-title { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; } .sb-title h2 { flex: 1; margin: 0; font-size: 1.25em; }'
  + '.sb-teams { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px; }'
  + '.sb-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; } .sb-table th { color: var(--ui-dim); font-weight: 600; text-align: right; padding: 3px 8px; }'
  + '.sb-table td { padding: 4px 8px; text-align: right; border-top: 1px solid rgba(255, 255, 255, 0.06); } .sb-table th:first-child, .sb-table td:first-child { text-align: left; }'
  + '.sb-me td { background: rgba(255, 190, 70, 0.14); font-weight: 700; } .sb-dead td { opacity: 0.55; }'
  + '.sb-team-head { display: flex; justify-content: space-between; font-weight: 800; padding: 4px 8px; border-bottom: 2px solid currentColor; }'
  + '.sb-section { color: var(--ui-accent); font-weight: 700; margin: 12px 0 4px; } .sb-note { color: var(--ui-dim); margin: 4px 0; }';

// ---- Accuracy and medals of the local player ----
const LocalPlayerStats = {
  shots: new Int32Array(WEAPON_COUNT), hits: new Int32Array(WEAPON_COUNT), headshots: new Int32Array(WEAPON_COUNT), kills: new Int32Array(WEAPON_COUNT),
  damage: new Float32Array(WEAPON_COUNT), shotSerial: new Int32Array(WEAPON_COUNT), hitSerial: new Int32Array(WEAPON_COUNT), headSerial: new Int32Array(WEAPON_COUNT),
  medals: new Map(),

  reset() {
    this.shots.fill(0); this.hits.fill(0); this.headshots.fill(0); this.kills.fill(0); this.damage.fill(0);
    this.shotSerial.fill(0); this.hitSerial.fill(0); this.headSerial.fill(0);
    this.medals.clear();
  },
  // One shot per fire event; a shot that hits several targets or pellets counts as one hit.
  onFire(event) {
    const weapon = CAT.weapons.byId(event.weapon);
    if (event.id !== Game.playerId || !weapon) return;
    this.shots[weapon.index]++;
    this.shotSerial[weapon.index]++;
  },
  onDamage(event) {
    const weapon = CAT.weapons.byId(event.weapon);
    if (event.source !== Game.playerId || event.target === event.source || !weapon) return;
    const index = weapon.index;
    this.damage[index] += event.amount;
    if (!scoreboardCountsHit(event.kind)) return;
    if (this.hitSerial[index] !== this.shotSerial[index]) { this.hitSerial[index] = this.shotSerial[index]; this.hits[index]++; }
    if (event.zone === 'head' && this.headSerial[index] !== this.shotSerial[index]) { this.headSerial[index] = this.shotSerial[index]; this.headshots[index]++; }
  },
  onKill(event) {
    const weapon = CAT.weapons.byId(event.weapon);
    if (event.killer === Game.playerId && event.victim !== event.killer && weapon) this.kills[weapon.index]++;
  },
  onMedal(event) {
    if (event.id === Game.playerId) this.medals.set(event.medal, (this.medals.get(event.medal) || 0) + 1);
  },
  accuracy(index) { return this.shots[index] > 0 ? this.hits[index] / this.shots[index] : 0; },
  // Weapons the player fired, in catalogue order.
  rows() {
    const rows = [];
    for (let index = 0; index < WEAPON_COUNT; index++) {
      if (this.shots[index] === 0 && this.kills[index] === 0) continue;
      rows.push({ name: CAT.weapons[index].name, shots: this.shots[index], hits: this.hits[index], accuracy: this.accuracy(index), kills: this.kills[index], headshots: this.headshots[index] });
    }
    return rows;
  },
};
Bus.on('weapon.fire', (event) => LocalPlayerStats.onFire(event));
Bus.on('damage', (event) => LocalPlayerStats.onDamage(event));
Bus.on('kill', (event) => LocalPlayerStats.onKill(event));
Bus.on('medal', (event) => LocalPlayerStats.onMedal(event));
Bus.on('match.start', () => LocalPlayerStats.reset());

// ---- Rows: live from Modes while the match runs, from the results record once it is over ----
const Scoreboard = {
  auto: false,         // opened by a round end (closes by itself when the next round starts)
  timer: 0,

  // Per-player rows sorted like the results: score, kills, fewer deaths.
  playerRows() {
    const results = Game.match && Game.match.results;
    const rows = results ? results.players.map((player) => Object.assign({ alive: false }, player)) : this.liveRows();
    rows.sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
    return rows;
  },
  liveRows() {
    const rows = [];
    for (let id = 0; id < Actors.count; id++) {
      if (!Modes.participant[id]) continue;
      rows.push({ id, name: Actors.name[id], kind: Actors.kind[id], team: Actors.team[id], kills: Modes.kills[id], deaths: Modes.deaths[id], assists: Modes.assists[id],
        score: Modes.score[id], objective: Modes.objective[id], alive: Actors.alive[id] === 1, queued: Modes.queued[id] === 1 });
    }
    return rows;
  },
  teamRows() {
    const results = Game.match && Game.match.results;
    if (results && results.teams.length) return results.teams;
    return [0, 1].map((team) => ({ team, name: TEAM_NAMES[team], score: Modes.teamScore[team], rounds: Modes.teamRounds[team] }));
  },
  objectiveLabel(rows) {
    const kind = Game.match && Game.match.rules ? Game.match.rules.objective : 'none';
    if (SCOREBOARD_OBJECTIVE_LABELS[kind]) return SCOREBOARD_OBJECTIVE_LABELS[kind];
    return rows.some((row) => row.objective > 0) ? SCOREBOARD_DEFAULT_OBJECTIVE_LABEL : '';
  },
  playerName(row) { return row.name || 'Player'; },

  buildTable(rows, objectiveLabel) {
    const table = makeElement('table', 'sb-table'), head = makeElement('tr');
    for (const title of ['Player', 'Score', 'Kills', 'Deaths', 'Assists']) head.appendChild(makeElement('th', '', title));
    if (objectiveLabel) head.appendChild(makeElement('th', '', objectiveLabel));
    table.appendChild(head);
    for (const row of rows) table.appendChild(this.buildRow(row, !!objectiveLabel));
    return table;
  },
  buildRow(row, withObjective) {
    const tr = makeElement('tr', (row.id === Game.playerId ? 'sb-me ' : '') + (row.alive || Game.match.results ? '' : 'sb-dead'));
    const symbol = row.team >= 0 ? SCOREBOARD_TEAM_SYMBOLS[row.team % SCOREBOARD_TEAM_SYMBOLS.length] + ' ' : '';
    const name = makeElement('td', '', symbol + this.playerName(row) + (row.queued ? ' (waiting)' : ''));
    const nameColor = Progress.bodyColor(row.id, row.team >= 0 ? Hud.teamColor(row.team) : -1);   // the player's row wears the body colour
    if (nameColor >= 0) name.style.color = cssHex(nameColor);
    tr.appendChild(name);
    for (const value of [row.score, row.kills, row.deaths, row.assists]) tr.appendChild(makeElement('td', '', String(Math.round(value))));
    if (withObjective) tr.appendChild(makeElement('td', '', String(Math.round(row.objective))));
    return tr;
  },
  buildTeamBlock(team, rows, objectiveLabel) {
    const block = makeElement('div'), head = makeElement('div', 'sb-team-head');
    head.style.color = cssHex(Hud.teamColor(team.team));
    head.appendChild(makeElement('span', '', SCOREBOARD_TEAM_SYMBOLS[team.team % SCOREBOARD_TEAM_SYMBOLS.length] + ' ' + team.name));
    head.appendChild(makeElement('span', '', (team.rounds ? 'Rounds ' + team.rounds + '   ' : '') + 'Score ' + Math.round(team.score)));
    block.appendChild(head);
    block.appendChild(this.buildTable(rows.filter((row) => row.team === team.team), objectiveLabel));
    return block;
  },
  buildAccuracy() {
    const rows = LocalPlayerStats.rows(), box = makeElement('div');
    if (!rows.length) return box;
    box.appendChild(makeElement('div', 'sb-section', 'Your weapons'));
    const table = makeElement('table', 'sb-table'), head = makeElement('tr');
    for (const title of ['Weapon', 'Shots', 'Hits', 'Accuracy', 'Kills', 'Headshots']) head.appendChild(makeElement('th', '', title));
    table.appendChild(head);
    for (const row of rows) {
      const tr = makeElement('tr');
      tr.appendChild(makeElement('td', '', row.name));
      for (const value of [row.shots, row.hits, Math.round(row.accuracy * 100) + '%', row.kills, row.headshots]) tr.appendChild(makeElement('td', '', String(value)));
      table.appendChild(tr);
    }
    box.appendChild(table);
    return box;
  },
  buildMedals() {
    const box = makeElement('div');
    if (!LocalPlayerStats.medals.size) return box;
    box.appendChild(makeElement('div', 'sb-section', 'Medals'));
    const parts = [];
    for (const [medal, count] of LocalPlayerStats.medals) parts.push(hudMedalTitle(medal) + (count > 1 ? ' x' + count : ''));
    box.appendChild(makeElement('p', 'sb-note', parts.join('   ')));
    return box;
  },
  // Fills `container` with the tables of the running or finished match. Used by the screen, its refresh and the results screen.
  renderInto(container) {
    container.replaceChildren();
    if (!Game.match) return;
    const rows = this.playerRows(), label = this.objectiveLabel(rows), teams = Game.match.rules && Game.match.rules.teams === 2;
    if (teams) {
      const grid = makeElement('div', 'sb-teams');
      for (const team of this.teamRows()) grid.appendChild(this.buildTeamBlock(team, rows, label));
      container.appendChild(grid);
    } else container.appendChild(this.buildTable(rows, label));
    container.appendChild(this.buildAccuracy());
    container.appendChild(this.buildMedals());
  },
  title() {
    const mode = Game.match && Game.match.rules ? CAT.modes.byId(Game.match.rules.mode) : null;
    const map = Game.match && Game.match.map ? Game.match.map.name : '';
    return (mode ? mode.name : 'Match') + (map ? ' - ' + map : '');
  },

  // Tab / View button / touch button. Mouse and pad hold to look; touch taps toggle. With the "toggle" setting on (ACC-004) Input
  // keeps the toggle itself and reports the second press as a release, so the board closes on that release on every device.
  tapToggles() { return Input.device === 'touch' && !Input.isToggleMode('scoreboard'); },
  onAction(down) {
    if (Game.headless || Game.state !== 'playing') return;
    const open = Ui.isOpen('scoreboard'), toggle = this.tapToggles();
    this.auto = false;
    if (down && !open && !Ui.current() && !Game.paused) Ui.open('scoreboard');
    else if (down && open && toggle) Ui.back();
    else if (!down && open && !toggle) Ui.back();
  },
  // Between rounds the board opens by itself and closes when the next round starts.
  onRound(event) {
    if (Game.headless || Game.state !== 'playing') return;
    if (event.phase === 'end' && !Ui.current() && !Game.paused) { Ui.open('scoreboard'); this.auto = true; return; }
    if (event.phase !== 'end' && this.auto && Ui.isOpen('scoreboard')) { this.auto = false; Ui.back(); }
  },
  refresh(now) {
    if (!Ui.isOpen('scoreboard') || now - this.timer < UI_REFRESH_MS) return;
    this.timer = now;
    const body = Ui.root.querySelector('.sb-body');
    if (body) this.renderInto(body);
  },
};

Ui.register('scoreboard', {
  overlay: true,
  passthrough: true,
  inGame: true,
  build(root) {
    const panel = makeElement('div', 'sb-panel'), title = makeElement('div', 'sb-title');
    title.appendChild(makeElement('h2', '', Scoreboard.title()));
    title.appendChild(Ui.button('Close', () => Ui.back()));
    panel.appendChild(title);
    const body = makeElement('div', 'sb-body');
    panel.appendChild(body);
    root.appendChild(panel);
    Scoreboard.renderInto(body);
  },
  onClose() { Scoreboard.auto = false; Input.resetToggle('scoreboard'); },
});

Bus.on('input.action', (event) => { if (event.action === 'scoreboard') Scoreboard.onAction(event.down); });
Bus.on('round', (event) => Scoreboard.onRound(event));
Bus.on('boot', () => {
  injectStyle('scoreboard-style', SCOREBOARD_CSS);
  Loop.onFrame('ui', () => Scoreboard.refresh(performance.now()));
});
