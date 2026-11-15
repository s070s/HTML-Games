// ---- The content, built from DATA (data/ inlined by the assembler above the rules, reference 13.2) ---------------------------
// Each table below has the name and the shape it had when the content was written in code, so the rules and the engine read it
// as before. This file shapes data; it decides nothing.

// ---- Types: ids, strong and weak against, tag colours, marks (data/types/) ----
const TYPE_IDS = Object.keys(DATA.types);
const TYPE_RULES = {};
const TYPE_COLORS = {};
const TYPE_MARKS = {};
for (const typeId of TYPE_IDS) {
  const type = DATA.types[typeId];
  TYPE_RULES[typeId] = { strong: type.strong, weak: type.weak };
  TYPE_COLORS[typeId] = type.color;
  TYPE_MARKS[typeId] = type.mark;
}

// ---- Abilities, statuses and moves (data/abilities/, data/statuses/, data/moves/) ----
const ABILITY_IDS = Object.keys(DATA.abilities);
const ABILITIES = DATA.abilities; // id -> { kind, params }: what an ability does is a kind of the rules code and its numbers
const STATUSES = DATA.statuses; // id -> { turns, kind, params, recruitMult, color }
const MOVES = DATA.moves;

// ---- Items and the stock of the kiosks (data/items/, data/shops/); the start bag is in game.json ----
const ITEMS = DATA.items;
const ITEM_IDS = Object.keys(DATA.items);
const SHOP_STOCK = DATA.shops.peiraias.items;
const SHOP_STOCK_NOTIA = DATA.shops.notia.items;
const SHOP_STOCK_VOREIA = DATA.shops.voreia.items;
const SHOP_STOCK_DYTIKA = DATA.shops.dytika.items;
const START_BAG = DATA.game.startBag;

// ---- Creatures and trainers (data/species/, data/trainers/); the starters and the rival's answers are in game.json ----
const SPECIES = DATA.species;
const DEX_ORDER = Object.keys(DATA.species); // the order of data/species/index.json
const STARTERS = DATA.game.starters;
const RIVAL_STARTER = DATA.game.rivalStarter;
const TRAINERS = DATA.trainers;

// ---- Tiles, maps and the places the player starts and wakes up (data/tiles/, data/maps/, game.json) ----
const TILE_DEFS = {};
for (const tile of Object.values(DATA.tiles)) {
  const { char, ...definition } = tile; // the character is the key of the table
  TILE_DEFS[char] = definition;
}
const MAPS = DATA.maps;
for (const map of Object.values(MAPS)) {
  if (map.stock) map.stock = DATA.shops[map.stock].items; // a map names its kiosk's shop; the rules want the list
}
const START_MAP = DATA.game.startMap;
const HOSPITAL_SPOT = DATA.game.hospitalSpot; // just inside the hospital door
const DEFAULT_HEAL_SPOT = HOSPITAL_SPOT; // the black-out spot before any heal (after one, save.lastHeal: the last hospital that healed you)

// ---- The world map screen: the grid, the districts with their places (nodes) and routes (data/world.json, data/districts/) ----
const WORLD_BADGE_COUNT = DATA.world.badgeCount;
const WORLD = { cols: DATA.world.cols, rows: DATA.world.rows, grid: DATA.world.grid, districts: {}, nodes: {}, routes: {} };
for (const districtId of Object.keys(DATA.districts)) {
  const { places, routes, ...district } = DATA.districts[districtId];
  WORLD.districts[districtId] = Object.assign(district, { id: districtId });
  for (const placeId of Object.keys(places)) WORLD.nodes[placeId] = Object.assign({ district: districtId }, places[placeId], { id: placeId });
  for (const routeId of Object.keys(routes)) WORLD.routes[routeId] = Object.assign({ district: districtId }, routes[routeId], { id: routeId });
}

// ---- Every text of the game, Greek first, English second (data/strings/<group>.json: key -> { el, en }) ----
// The order of the keys follows the groups; nothing depends on it (a test scans for iteration over STRINGS).
const STRINGS = {};
for (const group of Object.values(DATA.strings)) {
  for (const key of Object.keys(group)) STRINGS[key] = [group[key].el, group[key].en];
}

// ---- The tunes and sound effects the engine plays by role (data/game.json): the title, battle, boss and fallback tunes; confirm, back, hit ... ----
const MUSIC = DATA.game.music;
const SOUNDS = DATA.game.sounds;

// ---- Scripted scenes: the step lists of data/events/ (run by the event runner of the engine) ----
const EVENTS = DATA.events;
