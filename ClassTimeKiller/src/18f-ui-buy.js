// ==== S18 UI: BUY MENU AND LOADOUT EDITOR ====
// 'buy' (ECP02 round buy, ECP07 wave shop): credits, buy time, the items with hotkeys 1-9 and the loss ladder panel
// (ECO-001). It opens with the buyMenu action (B) or from the pause menu and closes itself when buy time ends.
// 'loadout': classes and custom classes (ECP04), the hero (ECP05) and ability kit choices, stored by S13 Loadouts.
// Every control is a Ui button or cycle, so mouse, keyboard, gamepad (focus navigation) and touch all work.

const BUY_REFRESH_MS = 250;
const BUY_HOTKEY_COUNT = 9;
const BUY_CSS = '.ui-buy .ui-panel { width: min(680px, 100%); max-height: 100%; display: flex; flex-direction: column; }'
  + '.buy-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; overflow-y: auto; min-height: 0; touch-action: pan-y; }'
  + '.buy-item { display: flex; justify-content: space-between; gap: 8px; } .buy-item.off { opacity: 0.5; }'
  + '.buy-key { color: var(--ui-accent); font-weight: 700; margin-right: 8px; } .buy-price { color: var(--ui-dim); font-variant-numeric: tabular-nums; white-space: nowrap; }'
  + '.buy-ladder { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0 0 10px; color: var(--ui-dim); }'
  + '.buy-step { padding: 2px 8px; border: 1px solid var(--ui-line); border-radius: 6px; } .buy-step.next { border-color: var(--ui-accent); color: var(--ui-text); }';
const BUY_HUD = { money: 0, nextRoundMoney: 0, canBuy: false, buyTimeLeft: 0 };
const BUY_PAUSE_ENTRY = { label: 'Buy menu', screen: 'buy' };
const LOADOUT_PAUSE_ENTRY = { label: 'Loadout', screen: 'loadout' };
const LOADOUT_TABS = [['classes', 'Classes'], ['heroes', 'Hero'], ['kits', 'Ability kits']];
const KIT_SLOT_LABELS = { ability1: 'Ability 1', ability2: 'Ability 2', ultimate: 'Ultimate' };
const CLASS_WEAPON_SET = 'militarySet';   // ECP04 is the Modern Ops economy: primaries come from its weapon set
const HERO_PASSIVE_TEXT = {
  knockbackResist: 'Takes less knockback', killHaste: 'Speed burst after each kill', regen: 'Heals itself out of combat',
  shieldRegen: 'Faster shield recharge', scopeInfo: 'Scope shows enemy health', extraGrenade: 'Carries an extra grenade', smokeVision: 'Sees through smoke',
};

function formatCredits(amount) { return amount + ' cr'; }
function readableKey(key) { return key ? key.charAt(0).toUpperCase() + key.slice(1) : 'None'; }
function weaponName(key) { const weapon = CAT.weapons.byId(key); return weapon ? weapon.name : readableKey(key); }
function abilityName(key) { const row = CAT.abilities.byId(key); return row ? row.name : 'None'; }
function fieldUpgradeName(key) { return CAT.abilities.byId(key) ? abilityName(key) : readableKey(key); }
function perkName(key) { const perk = CAT.perks.byId(key); return perk ? perk.name : readableKey(key); }
function playerInMatch() { return !!Game.match && Game.playerId >= 0; }
function appendLines(element, lines) {
  element.textContent = '';
  for (const line of lines) element.appendChild(makeElement('div', '', line));
}

// ---- Buy menu ----
const BuyMenu = {
  entries: [],            // { button, item } of the open menu
  status: null,
  ladder: null,
  ladderKey: '',
  timer: 0,
  openedWhileBuying: false,

  build(root) {
    injectStyle('ui-buy-style', BUY_CSS);
    root.classList.add('ui-dialog');
    const panel = makeElement('div', 'ui-panel'), head = makeElement('div', 'ui-head');
    head.appendChild(makeElement('h1', 'ui-title', Economy.preset().buy === 'shop' ? 'Shop' : 'Buy'));
    head.appendChild(Ui.button('Done', () => Ui.back()));
    this.status = makeElement('p', 'ui-sub');
    this.ladder = makeElement('div', 'buy-ladder');
    this.ladderKey = '';
    panel.appendChild(head); panel.appendChild(this.status); panel.appendChild(this.ladder);
    panel.appendChild(this.buildItems());
    root.appendChild(panel);
    this.refresh();
  },
  buildItems() {
    const list = makeElement('div', 'buy-items');
    this.entries.length = 0;
    Economy.catalogue().forEach((item, index) => list.appendChild(this.itemButton(item, index)));
    if (!this.entries.length) list.appendChild(makeElement('p', 'ui-note', BUY_REASON_TEXT.noEconomy));
    else this.entries[0].button.dataset.autofocus = '1';
    return list;
  },
  itemButton(item, index) {
    const button = Ui.button('', () => this.buy(item), 'buy-item'), label = makeElement('span', '');
    if (index < BUY_HOTKEY_COUNT) label.appendChild(makeElement('span', 'buy-key', String(index + 1)));
    label.appendChild(document.createTextNode(item.name));
    button.appendChild(label);
    button.appendChild(makeElement('span', 'buy-price', formatCredits(item.price)));
    this.entries.push({ button, item });
    return button;
  },
  buy(item) {
    const result = Economy.buy(Game.playerId, item.id);
    Ui.toast(result.ok ? 'Bought ' + item.name : BUY_REASON_TEXT[result.reason]);
    this.refresh();
  },
  buyByHotkey(index) {
    const entry = this.entries[index];
    if (entry) this.buy(entry.item);
  },
  refresh() {
    const id = Game.playerId, block = Economy.buyBlock(id);
    Economy.hudState(id, BUY_HUD);
    const timeText = block ? BUY_REASON_TEXT[block] : Economy.preset().buy === 'shop' ? 'Shop open' : 'Buy time ' + Math.ceil(BUY_HUD.buyTimeLeft) + ' s';
    this.status.textContent = formatCredits(BUY_HUD.money) + '  |  ' + timeText + '  |  Next round ' + formatCredits(BUY_HUD.nextRoundMoney);
    for (const entry of this.entries) entry.button.classList.toggle('off', !!block || !this.affordable(id, entry.item));
    this.drawLadder(id);
  },
  affordable(id, item) { return Economy.money(id) >= item.price && !Economy.limitReason(id, item); },
  // ECO-001: the loss ladder with the step a loss would pay next highlighted (redrawn only when that step changes).
  drawLadder(id) {
    const ladder = Economy.preset().lossLadder, team = id >= 0 ? Actors.team[id] : -1;
    const next = team >= 0 && team < TEAM_SIDES ? Math.min(Economy.lossCount[team] + 1, ladder.length) - 1 : -1;
    const key = ladder.join() + ':' + next;
    if (key === this.ladderKey) return;
    this.ladderKey = key;
    this.ladder.textContent = '';
    if (next < 0 || !ladder.length) return;
    this.ladder.appendChild(makeElement('span', '', 'Loss bonus'));
    ladder.forEach((value, index) => this.ladder.appendChild(makeElement('span', 'buy-step' + (index === next ? ' next' : ''), formatCredits(value))));
  },
  tick() {
    if (Ui.current() !== 'buy') return;
    this.refresh();
    if (this.openedWhileBuying && !Game.paused && Economy.buyBlock(Game.playerId) === 'closed') Ui.back();   // buy time ran out
  },
  open() {
    this.openedWhileBuying = Economy.canBuy(Game.playerId);
    this.timer = setInterval(() => this.tick(), BUY_REFRESH_MS);
  },
  close() { clearInterval(this.timer); this.entries.length = 0; },
};

// ---- Loadout editor ----
const LoadoutMenu = {
  tab: 'classes',
  body: null,
  tabButtons: new Map(),

  build(root, params) {
    screenHeader(root, 'Loadout');
    const tabs = makeElement('div', 'ui-tabs');
    this.body = makeElement('div', 'ui-scroll');
    this.tabButtons.clear();
    for (const [id, label] of LOADOUT_TABS) {
      const button = Ui.button(label, () => this.show(id), 'ui-tab');
      button.disabled = id === 'classes' && playerInMatch() && !Economy.usesClasses();   // a class pick would do nothing in this match
      this.tabButtons.set(id, button);
      tabs.appendChild(button);
    }
    root.appendChild(tabs); root.appendChild(this.body);
    this.show((params && params.tab) || defaultLoadoutTab());
    this.tabButtons.get(this.tab).dataset.autofocus = '1';
  },
  show(tab) {
    this.tab = tab;
    for (const [id, button] of this.tabButtons) button.classList.toggle('active', id === tab);
    this.body.textContent = '';
    LOADOUT_RENDERERS[tab](this.body);
  },
};

// The tab that matters in this match: heroes, a kit, or classes (also outside a match).
function defaultLoadoutTab() {
  if (!playerInMatch()) return 'classes';
  if (Abilities.usesHeroes()) return 'heroes';
  const kit = Abilities.kitOf(Game.playerId);
  if (kit && kit.id !== 'classes') return 'kits';
  return Economy.usesClasses() ? 'classes' : 'kits';
}

function renderClassesTab(body) {
  const classes = Loadouts.classes(), details = makeElement('div', 'ui-note');
  const pick = (id) => { Loadouts.selectClass(id); describeClass(details, Loadouts.selectedClass()); };
  body.appendChild(Ui.row('Class', Ui.cycle(classes.map((row) => row.id), classes.map((row) => row.name), Loadouts.selectedClass().id, pick)));
  body.appendChild(details);
  describeClass(details, Loadouts.selectedClass());
  const foot = makeElement('div', 'ui-foot');
  foot.appendChild(Ui.button('New custom class', () => Ui.open('classEditor', { row: Loadouts.selectedClass(), isNew: true })));
  foot.appendChild(Ui.button('Edit custom class', () => editSelectedClass()));
  foot.appendChild(Ui.button('Delete custom class', () => deleteSelectedClass(), 'danger'));
  body.appendChild(foot);
  if (playerInMatch()) body.appendChild(makeElement('p', 'ui-note', 'Class changes apply at your next spawn.'));
}
function describeClass(element, row) {
  appendLines(element, [
    'Primary: ' + weaponName(row.primary) + '  ·  Secondary: ' + weaponName(row.secondary),
    'Lethal: ' + readableKey(row.lethal) + '  ·  Tactical: ' + readableKey(row.tactical),
    'Perks: ' + row.perks.map(perkName).join(', '),
    'Field upgrade: ' + fieldUpgradeName(row.fieldUpgrade),
  ]);
}
function isCustomClass(row) { return !CAT.classes.byId(row.id); }
function editSelectedClass() {
  const row = Loadouts.selectedClass();
  if (!isCustomClass(row)) { Ui.toast('Preset classes cannot be changed: make a custom class from it.'); return; }
  Ui.open('classEditor', { row, isNew: false });
}
function deleteSelectedClass() {
  const row = Loadouts.selectedClass();
  if (!isCustomClass(row)) { Ui.toast('Preset classes cannot be deleted.'); return; }
  Ui.confirm({ title: 'Delete ' + row.name + '?', text: 'The custom class is removed.', yes: 'Delete', onYes: () => { Loadouts.removeClass(row.id); LoadoutMenu.show('classes'); } });
}

// The custom class editor: one cycle per field; the name is generated (gamepad and touch friendly).
const CLASS_FIELD_OPTIONS = {
  primary: () => CAT.weaponSets.byId(CLASS_WEAPON_SET).weapons.filter((key) => !['sidearm', 'melee'].includes(CAT.weapons.byId(key).class)),
  secondary: () => CAT.weapons.filter((weapon) => weapon.class === 'sidearm').map((weapon) => weapon.id),
  lethal: () => uniqueClassValues('lethal'),
  tactical: () => uniqueClassValues('tactical'),
  fieldUpgrade: () => CAT.economy.byId('classes').fieldUpgrades,
};
const CLASS_FIELD_LABELS = { primary: 'Primary', secondary: 'Secondary', lethal: 'Lethal', tactical: 'Tactical', fieldUpgrade: 'Field upgrade' };
const CLASS_FIELD_NAMES = { primary: weaponName, secondary: weaponName, lethal: readableKey, tactical: readableKey, fieldUpgrade: fieldUpgradeName };
function uniqueClassValues(field) { return Array.from(new Set(CAT.classes.map((row) => row[field]).filter(Boolean))); }

// params: { row, isNew }; without params it starts a new class from the selected one.
function buildClassEditor(root, params) {
  const options = params || { row: Loadouts.selectedClass(), isNew: true };
  const draft = Object.assign({}, options.row, { perks: options.row.perks.slice() });
  if (options.isNew) { delete draft.id; draft.name = 'Custom ' + (Loadouts.store().classes.custom.length + 1); }
  screenHeader(root, options.isNew ? 'New custom class' : 'Edit ' + draft.name);
  const list = makeElement('div', 'ui-scroll');
  for (const field in CLASS_FIELD_OPTIONS) list.appendChild(classFieldRow(draft, field));
  for (let tier = 1; tier <= 3; tier++) list.appendChild(perkRow(draft, tier));
  const foot = makeElement('div', 'ui-foot');
  foot.appendChild(Ui.button('Save', () => saveDraftClass(draft), 'primary'));
  foot.appendChild(Ui.button('Cancel', () => Ui.back()));
  root.appendChild(list); root.appendChild(foot);
}
function classFieldRow(draft, field) {
  const options = CLASS_FIELD_OPTIONS[field](), names = options.map(CLASS_FIELD_NAMES[field]);
  if (!options.includes(draft[field])) draft[field] = options[0];
  return Ui.row(CLASS_FIELD_LABELS[field], Ui.cycle(options, names, draft[field], (value) => { draft[field] = value; }));
}
function perkRow(draft, tier) {
  const perks = CAT.perks.filter((perk) => perk.tier === tier), options = perks.map((perk) => perk.id);
  if (!options.includes(draft.perks[tier - 1])) draft.perks[tier - 1] = options[0];
  const cycle = Ui.cycle(options, perks.map((perk) => perk.name + ': ' + perk.text), draft.perks[tier - 1], (value) => { draft.perks[tier - 1] = value; });
  return Ui.row('Perk ' + tier, cycle);
}
function saveDraftClass(draft) {
  const stored = Loadouts.saveClass(draft);
  if (!stored) { Ui.toast(Loadouts.lastError); return; }
  Loadouts.selectClass(stored.id);
  Ui.back();
  if (Ui.current() === 'loadout') LoadoutMenu.show('classes');
}

function renderHeroesTab(body) {
  const details = makeElement('div', 'ui-note');
  body.appendChild(Ui.row('Hero', Ui.cycle(CAT.heroes.map((hero) => hero.id), CAT.heroes.map((hero) => hero.name + ' (' + hero.role + ')'), Loadouts.hero().id,
    (id) => { pickHero(id); describeHero(details, Loadouts.hero()); })));
  body.appendChild(details);
  describeHero(details, Loadouts.hero());
}
// ECP05: inside the spawn room the switch is instant, elsewhere it waits for the next spawn.
function pickHero(id) {
  Loadouts.setHero(id);
  if (!playerInMatch() || !Abilities.usesHeroes()) return;
  Ui.toast(Economy.switchHero(Game.playerId, id) === 'now' ? 'Hero switched' : 'Your hero changes at the next spawn');
}
function describeHero(element, hero) {
  const passive = hero.passive.kind === 'ability' ? abilityName(hero.passive.ability) : HERO_PASSIVE_TEXT[hero.passive.flag || hero.passive.kind] || 'None';
  appendLines(element, [
    'Health ' + hero.health + (hero.armor ? '  ·  Armor ' + hero.armor : '') + (hero.shield ? '  ·  Shield ' + hero.shield : ''),
    'Weapons: ' + hero.weapons.map(weaponName).join(', '),
    'Abilities: ' + [hero.ability1, hero.ability2].filter(Boolean).map(abilityName).join(', ') + '  ·  Ultimate: ' + abilityName(hero.ultimate),
    'Passive: ' + passive,
  ]);
}

function renderKitsTab(body) {
  for (const kit of CAT.abilityKits) {
    if (kit.id === 'classes') continue;   // the class field upgrade is edited with the class
    body.appendChild(makeElement('div', 'ui-group', kit.name));
    for (const slotName in kit.choices) body.appendChild(kitSlotRow(kit, slotName));
  }
  if (playerInMatch()) body.appendChild(makeElement('p', 'ui-note', 'Ability changes apply at your next spawn.'));
}
function kitSlotRow(kit, slotName) {
  const options = kit.choices[slotName], current = Loadouts.kitChoice(kit.id)[slotName] || kit[slotName];
  return Ui.row(KIT_SLOT_LABELS[slotName], Ui.cycle(options, options.map(abilityName), current, (abilityId) => Loadouts.setKitChoice(kit.id, slotName, abilityId)));
}

const LOADOUT_RENDERERS = { classes: renderClassesTab, heroes: renderHeroesTab, kits: renderKitsTab };

// ---- Opening: the buyMenu action (B), the pause menu rows, B again or Esc closes ----
function buyMenuAvailable() { return Economy.usesMoney() && Economy.preset().buy !== 'none'; }
// Classes only where the economy hands them out (Economy.usesLoadouts: not in Gun Game or Roulette, whose mode arms everyone);
// an ability kit can still be picked in a match without classes, unless the mode arms everyone.
function loadoutAvailable() {
  if (Economy.usesLoadouts()) return true;
  return playerInMatch() && !Economy.modeArmsEveryone() && Abilities.kitOf(Game.playerId) !== null;
}
function onBuyMenuAction(event) {
  if (event.action !== 'buyMenu' || !event.down || Game.state !== 'playing' || Game.paused || Ui.stack.length) return;
  if (buyMenuAvailable()) Ui.open('buy');
  else if (loadoutAvailable()) Ui.open('loadout');
  else Ui.toast(BUY_REASON_TEXT.noEconomy);
}
// While one of these screens is on top, B closes it and the digits buy (game actions are off while a menu is open).
function onBuyScreenKey(event) {
  const screen = Ui.current();
  if (screen !== 'buy' && screen !== 'loadout') return;
  if (event.code === 'KeyB') { Ui.back(); event.preventDefault(); return; }
  const digit = screen === 'buy' && /^Digit[1-9]$/.test(event.code) ? Number(event.code.slice(5)) : 0;
  if (digit) { BuyMenu.buyByHotkey(digit - 1); event.preventDefault(); }
}
function setPauseEntry(entry, wanted) {
  const index = Ui.pauseEntries.indexOf(entry);
  if (wanted && index < 0) Ui.pauseEntries.push(entry);
  if (!wanted && index >= 0) Ui.pauseEntries.splice(index, 1);
}
// The pause rows exist only in matches that buy or pick loadouts.
function syncPauseEntries(inMatch) {
  setPauseEntry(BUY_PAUSE_ENTRY, inMatch && buyMenuAvailable());
  setPauseEntry(LOADOUT_PAUSE_ENTRY, inMatch && loadoutAvailable());
}

Ui.register('buy', {
  overlay: true,
  build: (root) => BuyMenu.build(root),
  onOpen: () => BuyMenu.open(),
  onClose: () => BuyMenu.close(),
});
Ui.register('loadout', { build: (root, params) => LoadoutMenu.build(root, params) });
Ui.register('classEditor', { build: buildClassEditor });
Bus.on('input.action', onBuyMenuAction);
// The touch TYPE button (grenade type cycle) shows once the gadget section reads BTN.CYCLE_GRENADE through Gadgets.cycleGrenade
// (contract request, docs/api/input-ui.md); until then a press would do nothing.
function grenadeCycleLive() { return typeof Gadgets.cycleGrenade === 'function'; }
Bus.on('match.start', () => { syncPauseEntries(true); TouchInput.setFlag('grenadeCycle', grenadeCycleLive()); });
Bus.on('match.stop', () => syncPauseEntries(false));
Bus.on('boot', () => window.addEventListener('keydown', onBuyScreenKey));
