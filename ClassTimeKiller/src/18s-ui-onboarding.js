// ==== S18 UI: CONTROLS CARD (P5-04) ====
// One short card per input type (touch, controller, keyboard and mouse) with the core actions only. It shows once, the first time that
// type plays a match (Save.data.tips.controlCards), and is always open again from Help, Settings > Controls and the pause menu. The key
// names come from the live bindings (a rebound key shows as the player set it) and the touch names from the touch control table
// (touchPathOf), so the card cannot drift from the controls. The first-play card pauses the match until "Got it".
// Contracts: docs/api/input-ui.md.

const CONTROLS_CARD_DEVICES = ['touch', 'gamepad', 'kbm'];
const CONTROLS_CARD_NAMES = ['Touch', 'Controller', 'Keyboard and mouse'];
const CONTROLS_CARD_REASON = 'card';     // Game.pause reason of the first-play card: the pause menu opens as for any pause, the card sits on it
const CONTROLS_CARD_PAUSE_ENTRY = { label: 'Controls card', screen: 'controlsCard' };
const CONTROLS_CARD_GESTURES = [['prone', 'prone'], ['melee', 'melee'], ['prevWeapon', 'previous weapon']];   // the touch actions that ride on a button and are needed in a fight
const CONTROLS_CARD_NOTES = {
  touch: 'Other buttons (USE, HEAL, NADE, BUY, abilities) appear when you can use them; A1, A2 and TOOL stay dimmed until then.',
  gamepad: 'View plus a button is a second layer (heal, gadget, previous weapon, buy menu). Everything can be rebound under Settings > Controls.',
  kbm: 'Click the game to lock the mouse. Everything can be rebound under Settings > Controls.',
};
// The rows: what = the action in words; actions = filled with the keys bound for the device; text = fixed words; path = an action's touch path.
const CONTROLS_CARD_ROWS = {
  gamepad: [
    { what: 'Move', text: 'Left stick' }, { what: 'Look', text: 'Right stick' }, { what: 'Fire', actions: ['fire'] }, { what: 'Alt (aim or alternate fire)', actions: ['alt'] },
    { what: 'Jump', actions: ['jump'] }, { what: 'Reload', actions: ['reload'] }, { what: 'Next weapon', actions: ['nextWeapon'] }, { what: 'Pause', actions: ['pause'] },
  ],
  kbm: [
    { what: 'Move', actions: ['forward', 'left', 'back', 'right'] }, { what: 'Look', text: 'Mouse' }, { what: 'Fire', actions: ['fire'] }, { what: 'Alt (aim or alternate fire)', actions: ['alt'] },
    { what: 'Jump', actions: ['jump'] }, { what: 'Reload', actions: ['reload'] }, { what: 'Sprint', actions: ['sprint'] }, { what: 'Crouch', actions: ['crouch'] }, { what: 'Pause', actions: ['pause'] },
  ],
  touch: [
    { what: 'Move', side: true }, { what: 'Look', side: true }, { what: 'Fire', path: 'fire' }, { what: 'Alt (aim or alternate fire)', path: 'alt' },
    { what: 'Jump', path: 'jump' }, { what: 'Crouch', path: 'crouch' }, { what: 'Reload', path: 'reload' }, { what: 'Next weapon', path: 'nextWeapon' }, { what: 'Pause', path: 'pause' },
  ],
};
const CONTROLS_CARD_CSS = '.cc-panel { width: min(600px, 100%); max-height: 100%; overflow-y: auto; touch-action: pan-y; } .cc-panel .ui-head { margin-bottom: 6px; }'
  + '.cc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin: 6px 0 8px; }'
  + '.cc-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--ui-line); }'
  + '.cc-key { color: var(--ui-accent); font-weight: 700; text-align: right; white-space: nowrap; } .cc-what { min-width: 0; }'
  + '@media (max-height: 520px) { .cc-panel { padding: 8px 14px; } .cc-panel .ui-title { font-size: 1.2em; } .cc-panel .ui-head { margin-bottom: 2px; } .cc-grid { margin: 2px 0 4px; }'
  + ' .cc-panel .ui-note { margin-bottom: 4px; line-height: 1.3; } .cc-row { padding: 3px 0; } .cc-panel .ui-foot { margin-top: 4px; } }';

// The words after "Move" and "Look" on touch name the thumb the touch preset in use gives each job (the left-handed preset swaps them).
function controlsCardTouchSide(what) {
  const mirrored = TouchInput.preset().mirror, move = mirrored ? 'right' : 'left';
  return what === 'Move' ? 'the ' + move + ' thumb: the stick' : 'the other thumb: drag the view';
}
// The rows of one device as [what, how] pairs with the live names.
function controlsCardRows(device) {
  return CONTROLS_CARD_ROWS[device].map((row) => {
    if (row.path) return [row.what, touchPathOf(row.path)];
    if (row.side) return [row.what, controlsCardTouchSide(row.what)];
    if (row.text) return [row.what, row.text];
    const keys = row.actions.map((action) => hudBoundLabel(action, device)).filter((label) => label !== '');
    return [row.what, keys.length ? keys.join(' ') : Input.bindingLabel(NO_BINDING)];
  });
}
// The note under the rows; touch adds how the gestures on the buttons are made (the names come from the control table).
function controlsCardNote(device) {
  if (device !== 'touch') return CONTROLS_CARD_NOTES[device];
  const gestures = CONTROLS_CARD_GESTURES.map(([action, words]) => {
    const sentence = touchPathOf(action) + ': ' + words;
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
  });
  return gestures.join(' ') + ' ' + CONTROLS_CARD_NOTES.touch;
}
// The seen flags of the save (a save repaired by Save.migrate always has them; a record a caller replaced may not).
function controlsCardSeen() {
  const tips = Save.data.tips;
  if (!savePlainObject(tips.controlCards)) tips.controlCards = { touch: false, gamepad: false, kbm: false };
  return tips.controlCards;
}
function markControlsCardSeen(device) {
  const seen = controlsCardSeen();
  if (seen[device]) return;
  seen[device] = true;
  Save.scheduleSave();
}

Ui.register('controlsCard', {
  // Not an overlay: the screen under it (the pause menu, Help) is hidden, so the card reads on its own.
  // The first-play card ends with the match resumed (Esc, B and Got it all do that); a card opened from a menu closes like any screen.
  onBack(element) {
    if (element.dataset.first !== '1') return false;
    Input.requestResume();
    return true;
  },
  build(root, params) {
    injectStyle('ui-controls-card-style', CONTROLS_CARD_CSS);
    root.classList.add('ui-dialog');
    const first = !!(params && params.first);
    root.dataset.first = first ? '1' : '0';
    let device = params && CONTROLS_CARD_DEVICES.includes(params.device) ? params.device : CONTROLS_CARD_DEVICES.includes(Input.device) ? Input.device : 'kbm';
    const panel = makeElement('div', 'ui-panel cc-panel'), head = makeElement('div', 'ui-head'), body = makeElement('div', 'cc-body');
    const draw = () => {
      body.replaceChildren();
      const grid = makeElement('div', 'cc-grid');
      for (const [what, how] of controlsCardRows(device)) {
        const row = makeElement('div', 'cc-row');
        row.appendChild(makeElement('span', 'cc-what', what));
        row.appendChild(makeElement('span', 'cc-key', how));
        grid.appendChild(row);
      }
      body.appendChild(grid);
      body.appendChild(makeElement('p', 'ui-note', controlsCardNote(device)));
      markControlsCardSeen(device);
    };
    head.appendChild(makeElement('h1', 'ui-title', 'Controls'));
    head.appendChild(Ui.cycle(CONTROLS_CARD_DEVICES, CONTROLS_CARD_NAMES, device, (next) => { device = next; draw(); }));
    const done = Ui.button(first ? 'Got it' : 'Done', () => { if (first) Input.requestResume(); else Ui.back(); }, 'primary');
    done.dataset.autofocus = '1';
    const foot = makeElement('div', 'ui-foot');
    foot.appendChild(done);
    panel.appendChild(head); panel.appendChild(body); panel.appendChild(foot);
    root.appendChild(panel);
    draw();
  },
});

const ControlsCard = {
  pending: '',   // the input type whose card is due (set at a match start or when the player changes input type mid-match)
  auto: true,    // false: the frame hook below never pauses a match by itself (the self-tests switch it off and call step() themselves)
  wanted(device) { return CONTROLS_CARD_DEVICES.includes(device) && !controlsCardSeen()[device] && Settings.get(TIPS_SETTING); },
  queue(device) { if (!Game.headless && this.wanted(device)) this.pending = device; },
  // Once per frame: a due card pauses the running match, on a bare match view only (never over a menu or a pending resume).
  step() {
    if (!this.pending || Game.headless || !Game.isRunning() || Ui.stack.length || Input.resumePending) return;
    if (Spectate.active || Killcam.playing || Game.playerId < 0) return;   // a spectator, a replay or a match with no player is not playing yet: the card stays due for the next real match
    const device = this.pending;
    this.pending = '';
    if (!this.wanted(device)) return;
    this.device = device;
    Game.pause(CONTROLS_CARD_REASON);
  },
  device: 'kbm',   // the card the pause above opens
};

Bus.on('game.pause', (reason) => { if (reason === CONTROLS_CARD_REASON && !Game.headless) Ui.open('controlsCard', { device: ControlsCard.device, first: true }); });   // after 18b opened the pause menu: the card sits on it
Bus.on('match.start', () => { ControlsCard.queue(Input.device); setPauseEntry(CONTROLS_CARD_PAUSE_ENTRY, true); });
Bus.on('match.stop', () => { ControlsCard.pending = ''; });
Bus.on('input.device', (event) => { if (Game.state === 'playing') ControlsCard.queue(event.device); });
Bus.on('boot', () => Loop.onFrame('ui', () => { if (ControlsCard.auto) ControlsCard.step(); }));
