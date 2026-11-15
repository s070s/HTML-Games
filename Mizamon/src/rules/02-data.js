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
const STATUSES = DATA.statuses;
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

