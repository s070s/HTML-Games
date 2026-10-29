// Self-tests for Phase 5, controls and button layout (P5-01 to P5-04): the essential touch set and the context buttons, the 44 px floor,
// the three layout presets on 640x360, 812x375 and 932x430, every action reachable on touch, controller and keyboard / mouse,
// the saved layouts and bindings of the first release, and the controls card shown once per input type.

ControlsCard.auto = false;   // a due card never pauses a test's match from the frame loop (the tests below call step() themselves)
const CONTROLS_SCREENS = [[640, 360], [812, 375], [932, 430]];   // the phone sizes the layout is designed for (P5-01, Appendix C)
const CONTROLS_ESSENTIAL = ['stick', 'fire', 'aim', 'jump', 'crouch', 'reload', 'swap', 'pause'];
const CONTROLS_ALL_NEEDS = new Proxy({}, { get: () => () => true });   // TouchInput.needs with every need met: each context button shown
const CONTROLS_MIRRORED = TOUCH_PRESETS.find((preset) => preset.mirror);
const CONTROLS_NOTCH = 47;   // css px of a notch on each side of a landscape phone

// The ids of the shown touch controls after the layout is placed again.
function controlsShown() {
  TouchInput.applyAll();
  return TOUCH_CONTROLS.filter((control) => TouchInput.places[control.id].shown).map((control) => control.id);
}
// A player with no ability, gadget, grenade or item: only the essential buttons are usable.
function controlsEmptyKit(id) {
  for (const slot of [SLOT.ABILITY1, SLOT.ABILITY2, SLOT.ULTIMATE]) Abilities.setSlot(id, slot, null);
  Gadgets.clearGrenades(id); Gadgets.gadget[id] = -1;
  Items.carried.fill(0);
}
// What is wrong with the placed touch buttons on one screen, or '': under the floor, outside the safe area, or on another button.
function controlsLayoutProblem(width, height, preset, notch, allNeeds) {
  const savedPreset = TouchInput.currentPreset, savedNeeds = TouchInput.needs, savedLeft = Input.config.touchLeftFire, savedLayouts = Save.data.touchLayouts, insets = Hud.insets, savedInsets = Object.assign({}, insets);
  try {
    TouchInput.currentPreset = preset; Save.data.touchLayouts = {};
    if (allNeeds) { TouchInput.needs = CONTROLS_ALL_NEEDS; Input.config.touchLeftFire = true; }
    insets.left = insets.right = notch; insets.bottom = notch / 2; insets.top = 0;
    TouchInput.placeAll(width, height);
    const shown = TOUCH_CONTROLS.filter((control) => TouchInput.places[control.id].shown);
    for (const control of shown) {
      const place = TouchInput.places[control.id], radius = place.radius;
      if (radius * 2 < TOUCH_MIN_DIAMETER - 0.01) return control.id + ' is ' + Math.round(radius * 2) + ' px across';
      if (place.x - radius < insets.left - 0.01 || place.x + radius > width - insets.right + 0.01 || place.y - radius < insets.top - 0.01 || place.y + radius > height - insets.bottom + 0.01) return control.id + ' is outside the safe area';
      const other = shown.find((next) => next !== control && length2(TouchInput.places[next.id].x - place.x, TouchInput.places[next.id].y - place.y) < radius + TouchInput.places[next.id].radius - 0.01);
      if (other) return control.id + ' overlaps ' + other.id;
    }
    return '';
  } finally {
    TouchInput.currentPreset = savedPreset; TouchInput.needs = savedNeeds; Input.config.touchLeftFire = savedLeft; Save.data.touchLayouts = savedLayouts;
    Object.assign(insets, savedInsets);
  }
}

// ---- P5-01: the essential set, and a context button only while it can act ----
Test.add('controls', (check) => {
  const id = startInputMatch(), loadedMap = World.map;
  Input.setDevice('touch'); TouchInput.syncVisible();
  Game.match.rules = { mode: 'ffa', teams: 0 };
  World.map = { size: 1 };   // a small map: no skimmer board, so no USE
  controlsEmptyKit(id);
  check('essential set: with nothing to use the screen holds the stick, FIRE, ALT, JUMP, DUCK, LOAD, SWAP and pause', controlsShown().join() === CONTROLS_ESSENTIAL.join(), controlsShown().join());
  check('essential set: every other control is a context button with a need or a setting', TOUCH_CONTROLS.filter((control) => !CONTROLS_ESSENTIAL.includes(control.id)).every((control) => control.need || control.setting));

  const ability = CAT.abilities.find((row) => row.activation === 'instant' && row.resource === 'cooldown' && row.modes === 'any');
  Abilities.setSlot(id, SLOT.ABILITY1, ability);
  check('ability 1: A1 shows while the ability is ready', controlsShown().includes('ability1'));
  Abilities.cooldown[Abilities.index(id, SLOT.ABILITY1)] = 5;
  const dim = (name) => TouchInput.elements[name].classList.contains('dim');
  check('ability 1: A1 stays on screen, dimmed, while the cooldown runs, and is not dimmed when ready', controlsShown().includes('ability1') && dim('ability1') && (() => {
    Abilities.cooldown[Abilities.index(id, SLOT.ABILITY1)] = 0; controlsShown(); return !dim('ability1');
  })());
  Abilities.cooldown[Abilities.index(id, SLOT.ABILITY1)] = 5; controlsShown();
  inputTouchPointer('pointerdown', TouchInput.elements.ability1, 72, 100, 118);
  const swallowed = Input.holdCount[Input.actionIndex.ability1] === 0 && TouchInput.stick.slot === null && TouchInput.findSlot(72).role === ROLE_NONE;
  inputTouchPointer('pointerup', TouchInput.elements.ability1, 72, 100, 118);
  check('ability 1: a tap on the dimmed A1 does nothing and reaches neither the stick nor the look', swallowed && Input.holdCount[Input.actionIndex.ability1] === 0 && TouchInput.activeCount === 0);
  let gestureToggles = 0;
  const gestureListener = Bus.on('input.action', (event) => { if (event.action === 'perfHud' && event.down) gestureToggles++; });
  inputTouchPointer('pointerdown', TouchInput.elements.ability1, 74, 100, 118);
  for (let pointer = 75; pointer < 78; pointer++) inputTouchPointer('pointerdown', TouchInput.zone, pointer, window.innerWidth - 100 - pointer, 200);
  inputTouchPointer('pointerup', TouchInput.elements.ability1, 74, 100, 118);
  for (let pointer = 75; pointer < 78; pointer++) inputTouchPointer('pointerup', TouchInput.zone, pointer, window.innerWidth - 100 - pointer, 200);
  Bus.off('input.action', gestureListener);
  Input.clearAll();
  check('ability 1: a finger resting on the dimmed A1 does not count toward the four-finger debug gesture', gestureToggles === 0 && TouchInput.activeCount === 0, gestureToggles);
  Abilities.cooldown[Abilities.index(id, SLOT.ABILITY1)] = 0; controlsShown();
  inputTouchPointer('pointerdown', TouchInput.elements.ability1, 73, 100, 118);
  const pressed = Input.holdCount[Input.actionIndex.ability1] === 1;
  inputTouchPointer('pointerup', TouchInput.elements.ability1, 73, 100, 118);
  check('ability 1: the same tap works once the ability is ready', pressed && Input.holdCount[Input.actionIndex.ability1] === 0);
  Abilities.suppress(id, 5); controlsShown();
  check('ability 1: a suppressed player (any reason but the cooldown) sees A1 dimmed too', TouchInput.places.ability1.shown && dim('ability1'));
  Abilities.suppressedUntil[id] = 0; controlsShown();
  check('ability 1: and not dimmed when the suppression ends', !dim('ability1'));
  Input.clearAll();
  Abilities.setSlot(id, SLOT.ABILITY2, CAT.abilities.find((row) => row.activation === 'passive'));
  check('ability 2: a passive ability has nothing to press, so no A2', !controlsShown().includes('ability2'));
  Abilities.setSlot(id, SLOT.ABILITY2, ability);
  check('ability 2: A2 shows with a ready ability, not dimmed', controlsShown().includes('ability2') && !dim('ability2'));

  const ultimate = CAT.abilities.find((row) => row.resource === 'ultimate' && row.activation === 'instant' && row.modes === 'any');
  const realPays = Meters.paysUltimate, realCost = Meters.ultimateCost;
  Meters.paysUltimate = () => true; Meters.ultimateCost = () => 100;   // an ultimate meter that has to fill (the default match has none: the ultimate is free)
  Abilities.setSlot(id, SLOT.ULTIMATE, ultimate);
  Meters.points[id] = 0;
  check('ultimate: ULT stays away until the ultimate is ready', !controlsShown().includes('ultimate'));
  Meters.points[id] = 1e6;
  check('ultimate: ULT shows when the ultimate is ready', controlsShown().includes('ultimate'));
  inputTouchPointer('pointerdown', TouchInput.elements.ultimate, 74, 100, 118);
  Meters.points[id] = 0;
  TouchInput.applyAll();
  const held = TouchInput.places.ultimate.shown;
  inputTouchPointer('pointerup', TouchInput.elements.ultimate, 74, 100, 118);
  check('finger on a button: ULT stays under the thumb until it lifts, then goes', held && !TouchInput.places.ultimate.shown && TouchInput.elements.ultimate.classList.contains('off'));
  Meters.points[id] = 1e6; controlsShown();
  inputTouchPointer('pointerdown', TouchInput.elements.ultimate, 75, 100, 118);
  Meters.points[id] = 0; TouchInput.applyAll();
  TouchInput.reset();   // a pause drops every finger: the button it held up must not stay (M2)
  TouchInput.syncNeeds();
  check('pause: a reset with a finger on ULT whose need is gone takes the button off the screen at the next frame', !TouchInput.places.ultimate.shown && TouchInput.activeCount === 0);
  Input.clearAll();
  Meters.points[id] = 0;
  Abilities.setSlot(id, SLOT.ULTIMATE, CAT.abilities.byId('wrath'));
  Meters.points[id] = 1e6;
  check('ultimate: an automatic ultimate (Wrath Form casts itself) has no button', !controlsShown().includes('ultimate'));
  Meters.paysUltimate = realPays; Meters.ultimateCost = realCost;
  Meters.points[id] = 0;

  const gadget = CAT.gadgets.find((row) => row.kind !== 'thrown');
  Gadgets.give(id, gadget.id, 1);
  check('gadget: TOOL shows while a use is left', controlsShown().includes('gadget'));
  Gadgets.count[id * GADGET_COUNT + gadget.index] = 0;
  check('gadget: TOOL stays dimmed when the use is spent, and is not dimmed with one left', controlsShown().includes('gadget') && dim('gadget') && (() => {
    Gadgets.count[id * GADGET_COUNT + gadget.index] = 1; controlsShown(); return !dim('gadget');
  })());
  Gadgets.count[id * GADGET_COUNT + gadget.index] = 0; controlsShown();
  inputTouchPointer('pointerdown', TouchInput.elements.gadget, 76, 100, 118);
  check('gadget: a tap on the dimmed TOOL does nothing', Input.holdCount[Input.actionIndex.gadget] === 0 && TouchInput.stick.slot === null);
  inputTouchPointer('pointerup', TouchInput.elements.gadget, 76, 100, 118);
  Gadgets.gadget[id] = -1;
  check('gadget: with no gadget in the kit TOOL is gone', !controlsShown().includes('gadget'));

  Gadgets.give(id, 'frag', 1);
  check('grenade: NADE shows with a grenade', controlsShown().includes('grenade'));
  Gadgets.clearGrenades(id);
  check('grenade: NADE goes with the last one', !controlsShown().includes('grenade'));

  Items.carried[id * ITEM_COUNT + CONSUMABLE_ROWS[0].index] = 1;
  Actors.health[id] = Actors.maxHealth[id];
  const full = controlsShown().includes('heal');
  Actors.health[id] = 10; Actors.shield[id] = 0;
  check('heal: HEAL shows only while a carried item would restore something', !full && controlsShown().includes('heal'), full);
  Items.carried.fill(0);
  check('heal: HEAL goes with the last item', !controlsShown().includes('heal'));

  check('ping: PING stays away in a match with no teams', !controlsShown().includes('ping'));
  Game.match.rules = { mode: 'tdm', teams: 2 };
  check('ping: PING shows in a team match', controlsShown().includes('ping'));
  Game.match.rules = { mode: 'ffa', teams: 0 };
  check('breath: HOLD stays away while the scope does not sway', !controlsShown().includes('breath'));
  TouchInput.setFlag('breath', true);
  check('breath: HOLD shows while it does', controlsShown().includes('breath'));
  TouchInput.setFlag('breath', false);

  check('buy: BUY stays away in a match with no round buy', !controlsShown().includes('buy'));
  Input.clearAll();
  World.map = loadedMap;
});

// ---- P5-01 / P5-02: sizes, safe area and no overlap on the three phone sizes, in every preset ----
Test.add('controls', (check) => {
  startInputMatch();
  Input.device = 'touch';
  const problems = [], moved = [];
  for (const preset of TOUCH_PRESETS) for (const [width, height] of CONTROLS_SCREENS) for (const notch of [0, CONTROLS_NOTCH]) for (const allNeeds of [false, true]) {
    const problem = controlsLayoutProblem(width, height, preset, notch, allNeeds);
    if (problem) problems.push([preset.id, width + 'x' + height, notch ? 'notch' : 'no notch', allNeeds ? 'all buttons' : 'essential', problem].join(' '));
  }
  check('layout: no button under 44 px, outside the safe area or on another, in 3 presets, 3 phone sizes, with and without a notch, essential and all buttons', problems.length === 0, problems.slice(0, 4).join('; '));
  check('layout: the floor is 44 css px and every control is drawn at that or more in every preset', TOUCH_MIN_DIAMETER === 44
    && TOUCH_PRESETS.every((preset) => TOUCH_CONTROLS.every((control) => { TouchInput.currentPreset = preset; return control.size * TouchInput.layoutOf(control.id, TouchInput.layoutScratch).scale >= 44 - 1e-9; })));
  TouchInput.currentPreset = TOUCH_PRESETS[0];
  TouchInput.setProperty('swap', 'scale', TOUCH_SCALE_MIN);
  check('layout: the editor cannot shrink a button under the floor', TouchInput.getProperty('swap', 'scale') * TouchInput.controlById.swap.size >= 44 - 1e-9);
  TouchInput.resetLayout();
  const savedNeeds = TouchInput.needs, savedLeft = Input.config.touchLeftFire;
  try {
    TouchInput.needs = CONTROLS_ALL_NEEDS;
    for (const [width, height] of CONTROLS_SCREENS) {
      TouchInput.placeAll(width, height);
      for (const control of TOUCH_CONTROLS) {
        const place = TouchInput.places[control.id];
        if (place.shown && length2(place.x - place.startX, place.y - place.startY) > 1) moved.push(control.id + ' at ' + width + 'x' + height);
      }
    }
  } finally { TouchInput.needs = savedNeeds; Input.config.touchLeftFire = savedLeft; }
  check('layout: on the three phone sizes every button of the standard preset sits on its layout spot (nothing needed to move)', moved.length === 0, moved.join());
  const left = TOUCH_CONTROLS.filter((control) => control.id !== 'stick' && control.x < 0.5), right = TOUCH_CONTROLS.filter((control) => control.x > 0.5);
  check('layout: the thumb zones: the context kit and the stick on the left, the fire cluster on the right', ['ability1', 'ability2', 'ultimate', 'gadget'].every((name) => left.includes(TouchInput.controlById[name]))
    && ['fire', 'aim', 'jump', 'crouch', 'reload', 'swap', 'use', 'heal', 'buy'].every((name) => right.includes(TouchInput.controlById[name])) && TouchInput.controlById.stick.x < 0.5);
  check('layout: FIRE is the biggest button and the right thumb\'s rest spot is in the lower right corner', TOUCH_CONTROLS.every((control) => control.id === 'fire' || control.id === 'stick' || control.size < TouchInput.controlById.fire.size)
    && TouchInput.controlById.fire.x > 0.85 && TouchInput.controlById.fire.y > 0.5);
});

// ---- P5-02: the left-handed preset mirrors the layout ----
Test.add('controls', (check) => {
  startInputMatch();
  Input.device = 'touch';
  const savedPreset = TouchInput.currentPreset, savedNeeds = TouchInput.needs, savedLayouts = Save.data.touchLayouts, wrong = [], places = TouchInput.places;
  try {
    TouchInput.needs = CONTROLS_ALL_NEEDS; Save.data.touchLayouts = {};
    for (const [width, height] of CONTROLS_SCREENS) {
      TouchInput.currentPreset = TOUCH_PRESETS[0]; TouchInput.placeAll(width, height);
      const standard = Object.fromEntries(TOUCH_CONTROLS.map((control) => [control.id, places[control.id].x]));
      TouchInput.currentPreset = CONTROLS_MIRRORED; TouchInput.placeAll(width, height);
      for (const control of TOUCH_CONTROLS) {
        if (control.id === 'pause' || control.id === 'buy' || control.setting || !places[control.id].shown) continue;   // pause is central; BUY has the one free corner in both hands
        const flipped = (standard[control.id] < width / 2) !== (places[control.id].x < width / 2);
        const exact = Math.abs(standard[control.id] + places[control.id].x - width) < 1.5;
        if (!flipped || (!control.mirrorAt && !exact)) wrong.push(control.id + ' at ' + width + 'x' + height);
      }
    }
  } finally { TouchInput.currentPreset = savedPreset; TouchInput.needs = savedNeeds; Save.data.touchLayouts = savedLayouts; }
  check('left-handed: every control swaps sides (the stick, the fire cluster, the kit), the plain ones to the exact mirror spot, on three phone sizes', wrong.length === 0, wrong.join());
  TouchInput.currentPreset = CONTROLS_MIRRORED;
  check('left-handed: the floating stick starts on the right thumb\'s side, not the left', TouchInput.inMoveZone(window.innerWidth * 0.9) && !TouchInput.inMoveZone(window.innerWidth * 0.1));
  TouchInput.currentPreset = TOUCH_PRESETS[0];
  check('left-handed: the standard preset starts the stick on the left', TouchInput.inMoveZone(window.innerWidth * 0.1) && !TouchInput.inMoveZone(window.innerWidth * 0.9));
  check('presets: Standard, Compact and Left-handed all exist, Compact only shrinks (scale under 1) and Left-handed mirrors', TOUCH_PRESETS.map((preset) => preset.id).join() === 'standard,compact,mirrored'
    && TOUCH_PRESETS[1].scale < 1 && !TOUCH_PRESETS[1].mirror && TOUCH_PRESETS[2].mirror);
  TouchInput.currentPreset = savedPreset;
});

// ---- P5-01: every action has a way on touch, the grouped ones through their gesture ----
Test.add('controls', (check) => {
  const id = startInputMatch(), elements = TouchInput.elements, frame = () => { Input.frame(INPUT_TEST_FRAME); Sim.step(); };
  const none = ACTION_ROWS.filter((row) => touchPathOf(row.id) === '').map((row) => row.id);
  check('touch paths: every action row is on a button, a gesture of a button or has a listed touch path', none.length === 0, none.join());
  check('touch paths: the listed ones name only real actions', Object.keys(TOUCH_ACTION_PATHS).every((action) => Input.actionIndex[action] !== undefined));
  check('touch paths: the gestures read as the buttons name them', touchPathOf('melee') === 'flick LOAD' && touchPathOf('prone') === 'slide DUCK' && touchPathOf('prevWeapon') === 'hold SWAP'
    && touchPathOf('grenadeNext') === 'slide NADE' && touchPathOf('alt') === 'ALT' && touchPathOf('comm') === 'hold PING');
  Input.setDevice('touch'); TouchInput.syncVisible();
  const pressed = [], realReady = TouchInput.ready;
  let pointer = 100;
  TouchInput.ready = CONTROLS_ALL_NEEDS;   // A1, A2 and TOOL are dimmed (and swallow the tap) without a kit: this loop is about the plain press
  for (const control of TOUCH_CONTROLS) {
    if (!control.action || control.holdAction || control.swipeAction || control.action === 'pause' || control.action === 'buyMenu') continue;   // pause and BUY open screens: tested on their own
    const index = Input.actionIndex[control.action];
    inputTouchPointer('pointerdown', elements[control.id], ++pointer, 300, 300);
    if (Input.holdCount[index] !== 1) pressed.push(control.id);
    inputTouchPointer('pointerup', elements[control.id], pointer, 300, 300);
    if (Input.holdCount[index] !== 0) pressed.push(control.id + ' stuck');
  }
  TouchInput.ready = realReady;
  Input.clearAll();
  check('touch buttons: every plain button holds its action while a finger is on it and lets go after', pressed.length === 0, pressed.join());
  const edges = (bit) => { let count = 0; for (let i = 0; i < 4; i++) { frame(); if (Actors.pressed[id] & bit) count++; } return count; };
  const edgesOf = (...bits) => { const counts = bits.map(() => 0); for (let i = 0; i < 4; i++) { frame(); bits.forEach((bit, n) => { if (Actors.pressed[id] & bit) counts[n]++; }); } return counts.join(); };
  inputTouchPointer('pointerdown', elements.reload, 1, 1000, 600); inputTouchPointer('pointerup', elements.reload, 1, 1000, 600);
  const tapEdges = edges(BTN.RELOAD);
  check('LOAD: a tap reloads', tapEdges === 1, tapEdges + ' hold ' + Input.holdCount[Input.actionIndex.reload] + ' slots ' + TouchInput.activeCount + ' shown ' + TouchInput.shown);
  inputTouchPointer('pointerdown', elements.reload, 2, 1000, 600); inputTouchPointer('pointermove', elements.reload, 2, 1000, 600 - TOUCH_SWIPE_FAR - 10); inputTouchPointer('pointerup', elements.reload, 2, 1000, 570);
  const melee = edges(BTN.MELEE);
  check('LOAD: a flick is the melee and does not reload', melee === 1 && !(Actors.buttons[id] & BTN.RELOAD), melee);
  inputTouchPointer('pointerdown', elements.reload, 3, 1000, 600); inputTouchPointer('pointermove', elements.reload, 3, 1000 + TOUCH_SWIPE + 2, 600); inputTouchPointer('pointerup', elements.reload, 3, 1020, 600);
  check('LOAD: a short slide (a thumb that slips) is still the reload, once, not the melee', edgesOf(BTN.RELOAD, BTN.MELEE) === '1,0');
  inputTouchPointer('pointerdown', elements.reload, 31, 1000, 600); TouchInput.findSlot(31).startTime -= TOUCH_COOK_MS + 20; frame();
  const cooked = Input.holdCount[Input.actionIndex.reload] === 1;
  inputTouchPointer('pointermove', elements.reload, 31, 1000, 600 - TOUCH_SWIPE_FAR - 10); inputTouchPointer('pointerup', elements.reload, 31, 1000, 560);
  check('LOAD: a flick that starts after the 150 ms window is no melee: the still finger already pressed the reload', cooked && edgesOf(BTN.RELOAD, BTN.MELEE).endsWith(',0'));
  const savedPreset = TouchInput.currentPreset;
  TouchInput.currentPreset = CONTROLS_MIRRORED; TouchInput.applyAll();
  const place = TouchInput.places.reload;
  inputTouchPointer('pointerdown', elements.reload, 32, place.x, place.y); inputTouchPointer('pointermove', elements.reload, 32, place.x + TOUCH_SWIPE_FAR + 10, place.y); inputTouchPointer('pointerup', elements.reload, 32, place.x + 40, place.y);
  check('LOAD: the flick melees in the left-handed layout too (any direction, where the button now is)', place.x < innerWidth / 2 && edgesOf(BTN.RELOAD, BTN.MELEE) === '0,1');
  TouchInput.currentPreset = savedPreset; TouchInput.applyAll();
  TouchInput.setFlag('spectate', true);
  inputTouchPointer('pointerdown', elements.reload, 33, 1000, 600); inputTouchPointer('pointermove', elements.reload, 33, 1000, 560); inputTouchPointer('pointerup', elements.reload, 33, 1000, 560);
  check('LOAD: while spectating it is VIEW at once and a flick never melees', edgesOf(BTN.RELOAD, BTN.MELEE) === '1,0');
  TouchInput.setFlag('spectate', false);
  inputTouchPointer('pointerdown', elements.swap, 4, 1000, 600); inputTouchPointer('pointerup', elements.swap, 4, 1000, 600);
  check('SWAP: a tap is the next weapon', edges(BTN.NEXT_WEAPON) === 1);
  inputTouchPointer('pointerdown', elements.swap, 5, 1000, 600); TouchInput.findSlot(5).startTime -= TOUCH_HOLD_MS * 2; inputTouchPointer('pointerup', elements.swap, 5, 1000, 600);
  check('SWAP: a hold is the previous weapon', edges(BTN.PREV_WEAPON) === 1);
  Move.setPreset(id, 'modern');
  inputTouchPointer('pointerdown', elements.crouch, 6, 1000, 600); inputTouchPointer('pointermove', elements.crouch, 6, 1000, 560); inputTouchPointer('pointerup', elements.crouch, 6, 1000, 560); frame(); frame();
  check('DUCK: a slide is prone', Motion.proneWanted[id] === 1);
  Move.setPreset(id, '');
  Gadgets.give(id, 'frag', 1); Gadgets.give(id, 'smoke', 1); TouchInput.applyAll();
  inputTouchPointer('pointerdown', elements.grenade, 7, 1000, 600); inputTouchPointer('pointermove', elements.grenade, 7, 1000, 560); inputTouchPointer('pointerup', elements.grenade, 7, 1000, 560);
  check('NADE: a slide is the next grenade type', edges(BTN.CYCLE_GRENADE) === 1);
  const events = recordEvents(['input.action'], () => {
    inputTouchPointer('pointerdown', elements.pause, 8, 1000, 600); inputTouchPointer('pointerup', elements.pause, 8, 1000, 600);
  });
  check('pause: the II button pauses the match', events.some((event) => event.action === 'pause' && event.down) && Game.paused);
  Game.resume();
  Input.device = 'kbm';
});

// ---- P5-03: controller and keyboard / mouse defaults for the renamed and merged actions ----
Test.add('controls', (check) => uiWith(() => {
  const id = startInputMatch();
  Input.loadBindings();
  const padGaps = ACTION_ROWS.filter((row) => !row.axis && !row.slot && !['perfHud', 'botDebug'].includes(row.id) && !Input.defaultsOf(row)[2]).map((row) => row.id);
  check('controller: every action but the sticks, the weapon slots and the developer views has a button or chord (A-08: previous weapon, buy menu)', padGaps.length === 0, padGaps.join());
  check('controller: previous weapon is View + D-Left and the buy menu View + D-Up', Input.getBinding('prevWeapon', 2) === 'Pad:8+14' && Input.getBinding('buyMenu', 2) === 'Pad:8+12'
    && Input.bindingLabel('Pad:8+14') === 'View + D-Left');
  check('bindings: no default conflict, with Quick buy sharing Q and X with a game action', Input.allConflicts().length === 0 && Input.getBinding('quickBuy', 0) === Input.getBinding('ability1', 0) && Input.getBinding('quickBuy', 2) === Input.getBinding('reload', 2));
  check('bindings: a game action that takes a key another game action holds is flagged, a menu-only one is not', Input.setBinding('ability1', 0, 'Key:KeyF').join() === 'ability2' && Input.setBinding('quickBuy', 1, 'Key:KeyF').length === 0 && Input.setBinding('quickBuy', 0, 'Key:KeyJ').length === 0);
  const reserved = ['Key:Escape', 'Key:Enter', 'Key:ArrowLeft', 'Key:KeyB', 'Key:Digit3', 'Key:Tab', 'Key:Space'].map((binding) => Input.setBinding('quickBuy', 0, binding).join());
  const padReserved = ['Pad:0', 'Pad:1', 'Pad:4', 'Pad:5', 'Pad:9', 'Pad:8+0'].map((binding) => Input.setBinding('quickBuy', 2, binding).join());
  Input.resetBindings();
  const padFree = ['Pad:2', 'Pad:3', 'Pad:6', 'Pad:8+2'].map((binding) => Input.setBinding('quickBuy', 2, binding).join());
  check('bindings: Quick buy on a key or button the menus read themselves (Esc, Enter, Space, arrows, Tab, B, 1-9, A, B, LB, RB, Start, or View + one of them) is flagged', reserved.every((text) => text === 'menu') && padReserved.every((text) => text === 'menu'), reserved + ' / ' + padReserved);
  check('bindings: and Quick buy on any other key or button is not', padFree.every((text) => text === '') && Input.setBinding('quickBuy', 0, 'Key:KeyJ').length === 0);
  Input.setBinding('quickBuy', 0, 'Key:Escape');
  check('bindings: a game action on the same inputs is judged as before (no "menus" flag)', !Input.setBinding('jump', 0, 'Key:Enter').includes('menu') && !Input.setBinding('walk', 0, 'Key:Escape').includes('menu'));
  const flagged = (() => { Ui.open('bindings'); const row = Array.from(Ui.top().element.querySelectorAll('.ui-row.conflict')).map((element) => element.textContent).join('|'); Ui.closeAll(); return row; })();
  check('bindings: the Controls screen shows that row red and says the menus read the input', flagged.includes('Quick buy') && flagged.includes('shares a key with the menus'), flagged);
  Input.resetBindings();
  check('labels: the old Aim names are gone from the action rows and the touch buttons', ![ACTION_ROWS, TOUCH_CONTROLS].some((rows) => rows.some((row) => /\bAim\b/.test(row.label))) && Input.actions.find((row) => row.id === 'alt').label === 'Alt'
    && Input.actions.find((row) => row.id === 'walk').label === 'Walk / hold breath');

  const pad = inputFakePad(), events = [];
  inputUsePad(pad);
  const listener = Bus.on('input.action', (event) => events.push(event.action + (event.down ? ' down' : ' up')));
  Input.device = 'gamepad';
  inputPadButton(pad, 8, true); Input.frame(INPUT_TEST_FRAME);
  inputPadButton(pad, 14, true); Input.frame(INPUT_TEST_FRAME);
  const previous = (Actors.buttons[id] & BTN.PREV_WEAPON) !== 0;
  inputPadButton(pad, 14, false); Input.frame(INPUT_TEST_FRAME);
  inputPadButton(pad, 12, true); Input.frame(INPUT_TEST_FRAME);
  inputPadButton(pad, 12, false); inputPadButton(pad, 8, false); Input.frame(INPUT_TEST_FRAME);
  check('controller: View + D-Left is the previous weapon', previous);
  check('controller: View + D-Up opens the buy menu action', events.includes('buyMenu down'), events.join());
  events.length = 0;
  Input.uiOpen = true;
  inputPadButton(pad, 2, true); Input.frame(INPUT_TEST_FRAME); inputPadButton(pad, 2, false); Input.frame(INPUT_TEST_FRAME);
  check('controller: X inside a menu is Quick buy, and no reload', events.includes('quickBuy down') && !(Actors.buttons[id] & BTN.RELOAD), events.join());
  events.length = 0;
  Input.uiOpen = false;
  const reloads = Input.presses[Input.actionIndex.reload];
  inputPadButton(pad, 2, true); Input.frame(INPUT_TEST_FRAME); inputPadButton(pad, 2, false); Input.frame(INPUT_TEST_FRAME);
  check('controller: X in the match is the reload, never a quick buy', !events.some((event) => event.startsWith('quickBuy')) && Input.presses[Input.actionIndex.reload] === reloads + 1);
  Bus.off('input.action', listener);
  inputReleasePad();

  Input.device = 'kbm'; events.length = 0;
  const key = Bus.on('input.action', (event) => events.push(event.action + (event.down ? ' down' : ' up')));
  const abilities = Input.presses[Input.actionIndex.ability1];
  inputTapKey('KeyQ');
  const inMatch = events.slice(), inMatchPresses = Input.presses[Input.actionIndex.ability1] - abilities;
  Input.uiOpen = true; events.length = 0;
  inputTapKey('KeyQ');
  const inMenu = events.slice();
  Input.uiOpen = false;
  Bus.off('input.action', key);
  check('keyboard: Q is the ability in the match and Quick buy in a menu, never both', !inMatch.includes('quickBuy down') && inMatchPresses === 1 && inMenu.includes('quickBuy down') && Input.presses[Input.actionIndex.ability1] === abilities + 1, inMatch + ' / ' + inMenu);

  // The Quick buy of the buy menu comes through the action: key Q on a keyboard, X on a controller, the button on touch.
  const saved = Save.data;
  Save.data = Save.emptySave();
  rosterMatch('tactical');
  Economy.setMoney(0, 9000);
  Input.loadBindings(); Input.device = 'kbm';
  Ui.open('buy');
  const before = Economy.money(0);
  check('quick buy: the keyboard label names the bound key', uiScreenText('buy').includes('key Q'));
  inputTapKey('KeyQ');
  check('quick buy: Q in the buy menu buys the loadout primary', Weapons.has(0, 'hornet') && Economy.money(0) < before);
  Ui.closeAll();
  Input.device = 'gamepad'; Ui.open('buy');
  const padLabel = Input.bindingLabel(Input.getBinding('quickBuy', 2));
  check('quick buy: the controller label names its button, not a key', uiScreenText('buy').includes('Quick buy: Hornet Carbine') && uiScreenText('buy').includes(', ' + padLabel + ')') && !uiScreenText('buy').includes('key '));
  Ui.closeAll();
  Input.device = 'touch'; Ui.open('buy');
  check('quick buy: the touch label names no key or button', /Quick buy: Hornet Carbine \([^,)]*\)/.test(uiScreenText('buy')) && !uiScreenText('buy').includes('key '), uiScreenText('buy').slice(0, 160));
  Ui.closeAll();
  // BUY (P5-01): a context button for the buy time of a round-buy ruleset; it opens the buy menu.
  Input.device = 'touch';
  const player = Game.playerId, buyShown = () => { TouchInput.applyAll(); return TouchInput.places.buy.shown; };
  check('buy: BUY shows during the buy time of a round-buy match, in the buy zone', player >= 0 && Economy.canBuy(player) && buyShown());
  inputTouchPointer('pointerdown', TouchInput.elements.buy, 81, 600, 320); inputTouchPointer('pointerup', TouchInput.elements.buy, 81, 600, 320);
  check('buy: a tap on BUY opens the buy menu', Ui.current() === 'buy', Ui.current());
  Ui.closeAll(); Input.clearAll();
  const savedUntil = Economy.buyUntil[player];
  Economy.buyUntil[player] = 0;
  check('buy: BUY goes when the buy time is over', !buyShown());
  Economy.buyUntil[player] = savedUntil;
  endModeTest();
  Save.data = saved;
  Input.device = 'kbm';

  Ui.open('bindings');
  const rows = Ui.top().element.querySelectorAll('.ui-row');
  check('bindings screen: a row for every action, Quick buy and the renamed Walk included', rows.length === ACTION_ROWS.length && uiScreenText('bindings').includes('Quick buy') && uiScreenText('bindings').includes('Walk / hold breath'), rows.length);
  Ui.closeAll();
  Ui.open('help');
  check('help: the keyboard summary lists Alt, Quick buy and the walk key by their names', ['Alt: Right Mouse', 'Quick buy (in the buy menu): Q', 'Walk / hold breath'].every((text) => uiScreenText('help').includes(text)));
  Input.device = 'touch'; Ui.closeAll(); Ui.open('help');
  check('help: the touch summary names the essential buttons, the flick on LOAD and the context rule', ['LOAD: Reload (flick: melee)', 'DUCK: Crouch (slide', 'SWAP: Swap weapon (hold: previous)', 'every other button shows only while it can act', 'A1, A2 and TOOL stay dimmed'].every((text) => uiScreenText('help').includes(text)));
  Input.device = 'kbm';
}));

// ---- P5-02 / P5-03: a save from the first release loads into the new layout and bindings ----
function controlsOldSave() {
  return JSON.parse(JSON.stringify({
    version: 1, revision: 3,
    settings: {}, progression: { marks: 1 },
    bindings: {
      prevWeapon: ['Wheel:up', 'Key:KeyJ', ''], buyMenu: ['Key:KeyB', '', ''], jump: ['Key:KeyK', '', 'Pad:0'], ghost: ['Key:KeyG', '', ''], grenade: 'broken',
    },
    touchLayouts: {
      standard: {
        fire: { x: 0.91, y: 0.58, scale: 1, opacity: 0.7, hidden: false },
        jump: { x: 0.5, y: 0.5, scale: 1.2, opacity: 0.7, hidden: false },
        melee: { x: 0.3, y: 0.3, scale: 1, opacity: 0.7, hidden: false },
        aim: { x: 0.80, y: 0.40, scale: 1, opacity: 0.7, hidden: true },
        swap: { x: 0.76, y: 0.21, scale: 1, opacity: 0.4, hidden: false },
        prone: { x: 0.5 },
      },
      compact: { reload: { x: 0.94, y: 0.34, scale: 0.8, opacity: 0.7, hidden: false }, crouch: { x: 0.2, y: 0.9, scale: 0.8, opacity: 0.7, hidden: false } },
      mirrored: { jump: { x: 0.20, y: 0.72, scale: 1, opacity: 0.7, hidden: false }, fire: { x: 0.09, y: 0.58, scale: 1.3, opacity: 0.7, hidden: false }, heal: 7 },
      broken: 3,
    },
  }));
}
Test.add('controls', (check) => {
  startInputMatch();
  const migrated = Save.migrate(controlsOldSave()), layouts = migrated.touchLayouts, bindings = migrated.bindings;
  check('migrate: the save is marked as the current controls generation', migrated.controlsVersion === CONTROLS_VERSION && CONTROLS_VERSION === 2 && Save.emptySave().controlsVersion === CONTROLS_VERSION);
  check('migrate: the controls card flags are filled in (an old save shows each card once)', JSON.stringify(migrated.tips.controlCards) === '{"touch":false,"gamepad":false,"kbm":false}');
  check('migrate layouts: a control left at its old default loses its stored default (the new spot applies)', !layouts.standard.fire && !layouts.mirrored.jump && !layouts.compact.reload);
  check('migrate layouts: a moved control keeps its spot and size, and only those', JSON.stringify(layouts.standard.jump) === '{"x":0.5,"y":0.5,"scale":1.2}' && JSON.stringify(layouts.mirrored.fire) === '{"scale":1.3}' && JSON.stringify(layouts.compact.crouch) === '{"x":0.2,"y":0.9}');
  check('migrate layouts: a hidden button and a changed opacity stay', JSON.stringify(layouts.standard.aim) === '{"hidden":true}' && JSON.stringify(layouts.standard.swap) === '{"opacity":0.4}');
  check('migrate layouts: the removed MELEE button and unknown entries go', !layouts.standard.melee && !layouts.standard.prone && !('heal' in layouts.mirrored) && !('broken' in layouts));
  check('migrate bindings: previous weapon and the buy menu get their controller defaults, the player\'s own slots stay', JSON.stringify(bindings.prevWeapon) === '["Wheel:up","Key:KeyJ","Pad:8+14"]' && bindings.buyMenu[2] === 'Pad:8+12' && bindings.jump.join() === 'Key:KeyK,,Pad:0');
  const taken = Save.migrate({ version: 1, bindings: { prevWeapon: ['Wheel:up', '', ''], scoreboard: ['Key:Tab', '', 'Pad:8+14'] }, progression: { marks: 1 } }).bindings;
  check('migrate bindings: a chord the player already gave another action is not taken from it, and entries of unknown actions go', taken.prevWeapon[2] === '' && taken.scoreboard[2] === 'Pad:8+14' && !('ghost' in bindings) && !('grenade' in bindings));
  const unrebound = Save.migrate({ version: 1, bindings: { scoreboard: ['Key:Tab', '', 'Pad:8+14'] }, progression: { marks: 1 } }).bindings;
  const savedData = Save.data;
  Save.data = Save.emptySave(); Save.data.bindings = unrebound; Input.loadBindings();
  const sharers = (Input.bindingMap.get('Pad:8+14') || []).map((index) => ACTION_ROWS[index].id).join();
  Save.data = savedData; Input.loadBindings();
  check('migrate bindings: an action the player never rebound does not take a chord the player gave another action (M3: it would fire both)', JSON.stringify(unrebound.prevWeapon) === '["Wheel:up","",""]' && sharers === 'scoreboard', JSON.stringify(unrebound.prevWeapon) + ' ' + sharers);
  const again = JSON.stringify(Save.migrate(JSON.parse(JSON.stringify(migrated))));
  check('migrate: running it again changes nothing', again === JSON.stringify(migrated));
  const current = Save.emptySave();
  current.touchLayouts = { standard: { fire: { x: 0.91, y: 0.58 } } };
  check('migrate: a save of the current generation keeps what it has (a fire button the player really put there)', JSON.stringify(Save.migrate(current).touchLayouts) === JSON.stringify({ standard: { fire: { x: 0.91, y: 0.58 } } }));
  check('migrate: an import takes the same path', (() => { const text = JSON.stringify(controlsOldSave()), saved = Save.data, storage = Save.storage; Save.storage = makeMemoryStorage(false); try { Save.importText(text); return Save.data.controlsVersion === CONTROLS_VERSION && Save.data.bindings.buyMenu[2] === 'Pad:8+12'; } finally { Save.data = saved; Save.storage = storage; } })());

  Save.data = migrated;
  Input.loadBindings();
  check('migrated bindings work: the controller chord reaches the previous weapon action', Input.getBinding('prevWeapon', 2) === 'Pad:8+14' && Input.bindingMap.get('Pad:8+14').some((index) => ACTION_ROWS[index].id === 'prevWeapon'));
  Input.device = 'touch';
  const problems = [];
  for (const [width, height] of CONTROLS_SCREENS) for (const preset of TOUCH_PRESETS) {
    const problem = controlsLayoutProblemSaved(width, height, preset, migrated.touchLayouts);
    if (problem) problems.push(preset.id + ' ' + width + 'x' + height + ' ' + problem);
  }
  check('migrated layouts: the old moved buttons load and every button still fits with no overlap on the three phone sizes', problems.length === 0, problems.join('; '));
  Input.device = 'kbm';
});
// Like controlsLayoutProblem, with the layouts of a save, every need met.
function controlsLayoutProblemSaved(width, height, preset, layouts) {
  const savedPreset = TouchInput.currentPreset, savedNeeds = TouchInput.needs, savedLayouts = Save.data.touchLayouts;
  try {
    TouchInput.currentPreset = preset; TouchInput.needs = CONTROLS_ALL_NEEDS; Save.data.touchLayouts = layouts;
    TouchInput.placeAll(width, height);
    const shown = TOUCH_CONTROLS.filter((control) => TouchInput.places[control.id].shown);
    for (const control of shown) {
      const place = TouchInput.places[control.id], radius = place.radius;
      if (place.x - radius < -0.01 || place.x + radius > width + 0.01 || place.y - radius < -0.01 || place.y + radius > height + 0.01) return control.id + ' is off screen';
      const other = shown.find((next) => next !== control && length2(TouchInput.places[next.id].x - place.x, TouchInput.places[next.id].y - place.y) < radius + TouchInput.places[next.id].radius - 0.01);
      if (other) return control.id + ' overlaps ' + other.id;
    }
    return '';
  } finally { TouchInput.currentPreset = savedPreset; TouchInput.needs = savedNeeds; Save.data.touchLayouts = savedLayouts; }
}

// ---- P5-04: the controls card, once per input type, and open again from Help, Settings and the pause menu ----
Test.add('controls', (check) => uiWith(() => {
  const saved = Save.data.tips, savedDevice = Input.device, savedTips = Settings.get('gameplay.tips'), stack = () => Ui.stack.map((entry) => entry.name).join();
  Save.data.tips = { matches: 0, homeScreen: false, silentSwitch: false, controlCards: { touch: false, gamepad: false, kbm: false } };
  Settings.set('gameplay.tips', true);
  Game.headless = true; Input.device = 'touch'; Game.start({ mode: 'ffa', seed: 1, bots: [{ dummy: true, team: -1 }], player: { name: 'Me' } }); Game.headless = false;   // the match runs headless, the UI is on
  check('card: the match start and a change of input type queue the card (listeners)', ['match.start', 'input.device'].every((type) => Bus.listeners.get(type).some((listener) => String(listener).includes('ControlsCard.queue'))));
  ControlsCard.queue(Input.device);
  check('card: a new save is due the touch card at its first match', ControlsCard.pending === 'touch');
  const quiet = () => !Game.paused && Ui.stack.length === 0 && ControlsCard.pending === 'touch' && !Save.data.tips.controlCards.touch;
  Spectate.active = true; ControlsCard.step(); const inSpectate = quiet(); Spectate.active = false;
  Killcam.playing = true; ControlsCard.step(); const inKillcam = quiet(); Killcam.playing = false;
  const player = Game.playerId; Game.playerId = -1; ControlsCard.step(); const noPlayer = quiet(); Game.playerId = player;
  check('card: it never interrupts a spectator, a killcam or a match with no player, and the card stays due (not marked seen)', inSpectate && inKillcam && noPlayer, [inSpectate, inKillcam, noPlayer].join());
  ControlsCard.step();
  check('card: it pauses the match and opens on the pause menu', Game.paused && Game.pauseReason === CONTROLS_CARD_REASON && stack() === 'pause,controlsCard', stack());
  const text = uiScreenText('controlsCard');
  check('card: the touch card names the core buttons from the control table and no more', ['Move', 'Look', 'FIRE', 'ALT', 'JUMP', 'DUCK', 'LOAD', 'SWAP', 'II'].every((word) => text.includes(word)) && !text.includes('MELEE')
    && Ui.top().element.querySelectorAll('.cc-row').length === CONTROLS_CARD_ROWS.touch.length && CONTROLS_CARD_ROWS.touch.length <= 9, text.slice(0, 200));
  check('card: the touch card says the left thumb moves, and how the gestures and context buttons work', text.includes('the left thumb: the stick') && text.includes('Flick LOAD: melee') && text.includes('appear when you can use them') && text.includes('stay dimmed'), text);
  check('card: showing it marks that input type seen (and no other)', Save.data.tips.controlCards.touch && !Save.data.tips.controlCards.gamepad && !Save.data.tips.controlCards.kbm);
  uiClickButton(Ui.top().element, 'Got it');
  check('card: Got it resumes the match and closes both screens', !Game.paused && Ui.stack.length === 0, stack());
  ControlsCard.queue('touch');
  check('card: touch is not shown a second time', ControlsCard.pending === '');
  Input.setDevice('gamepad');
  check('card: another input type picked up in the match is due its own card', ControlsCard.pending === 'gamepad');
  ControlsCard.step();
  const pad = uiScreenText('controlsCard');
  check('card: the controller card shows the controller\'s own glyphs for the core actions', Game.paused && pad.includes('Left stick') && pad.includes(Input.bindingLabel('Pad:7')) && pad.includes(Input.bindingLabel('Pad:6')) && pad.includes('Next weapon') && !pad.includes('FIRE'), pad.slice(0, 200));
  Ui.back();
  check('card: Back (Esc, B) on the first-play card resumes too', !Game.paused && Ui.stack.length === 0);
  Input.setDevice('kbm');
  ControlsCard.step();
  const keys = uiScreenText('controlsCard');
  check('card: the keyboard card shows the live bindings', keys.includes('W A S D') && keys.includes('Right Mouse') && keys.includes('Left Mouse') && keys.includes('Left Shift') && keys.includes('Esc'), keys.slice(0, 200));
  Ui.back();
  check('card: all three input types are marked seen', CONTROLS_CARD_DEVICES.every((device) => Save.data.tips.controlCards[device]));
  Input.setDevice('touch'); Input.setDevice('kbm'); Input.setDevice('gamepad');
  check('card: none is shown again', ControlsCard.pending === '' && !Game.paused);

  Save.data.tips.controlCards.kbm = false;
  Input.setBinding('fire', 0, 'Key:KeyJ');
  Ui.closeAll(); Ui.open('controlsCard', { device: 'kbm' });
  check('card: it shows a rebound key as the player set it', uiScreenText('controlsCard').includes('Fire') && uiScreenText('controlsCard').includes('J'));
  Input.resetBindings();
  Ui.closeAll();

  Ui.open('help');
  check('card: Help re-opens it', uiClickButton(Ui.top().element, 'Show the controls card') && Ui.current() === 'controlsCard');
  uiClickButton(Ui.top().element, 'Done');
  check('card: from Help it closes with Done, back to Help, and does not pause or resume anything', stack() === 'help' && Game.paused === false);
  Ui.closeAll();
  Ui.open('settings', { tab: 'controls' });
  check('card: Settings > Controls re-opens it', uiClickButton(Ui.top().element, 'Controls card') && Ui.current() === 'controlsCard' && !!Ui.top().element.querySelector('.ui-cycle'));
  Ui.closeAll();
  Game.pause('menu');
  check('card: the pause menu lists it', Ui.top().element.textContent.includes('Controls card') && uiClickButton(Ui.top().element, 'Controls card') && Ui.current() === 'controlsCard');
  Ui.back();
  Game.resume();
  check('card: its device switch shows the other cards', (() => {
    Ui.open('controlsCard', { device: 'kbm' });
    const element = Ui.top().element, cycle = element.querySelector('.ui-cycle');
    const first = element.textContent;
    cycle.click();
    const second = element.textContent;
    Ui.back();
    return first.includes('Keyboard and mouse') && second.includes('Touch') && second.includes('FIRE') && first !== second;
  })());

  Settings.set('gameplay.tips', false);
  Save.data.tips.controlCards.touch = false; ControlsCard.pending = '';
  ControlsCard.queue('touch');
  check('card: the tips setting off keeps the card from interrupting a match (it stays in the menus)', ControlsCard.pending === '');
  Settings.set('gameplay.tips', savedTips);
  Game.headless = true;
  Game.stop(); Game.start({}); ControlsCard.pending = 'kbm'; Game.stop();
  check('card: a match that ends forgets a card that was due', ControlsCard.pending === '');
  Game.headless = false;
  Save.data.tips = saved; Input.device = savedDevice;
}));
