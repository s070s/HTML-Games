// ---- Items (section 8 and 7) ----------------------------------------------------
// ITEMS, ITEM_IDS, the shop stocks (SHOP_STOCK and the district ones) and START_BAG are built from data/items/, data/shops/ and
// data/game.json in 02-data.js. An item is { kind: 'recruit' | 'heal' | 'cure', price } plus mult (recruit), amount, accDown, cures (heal).
// The stock of the kiosk on a map: its own list (map.stock, resolved from its shop in 02-data.js) or the New Piraeus one.
function shopStockOf(map) { return map && map.stock ? map.stock : SHOP_STOCK; }
