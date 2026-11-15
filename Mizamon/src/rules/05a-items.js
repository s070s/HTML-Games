// ---- Items (section 8 and 7) ----------------------------------------------------
const ITEMS = {
  fakelaki: { kind: 'recruit', mult: 1, price: 80 },
  fakelos: { kind: 'recruit', mult: 1.5, price: 200 },
  koulouri: { kind: 'heal', amount: 20, price: 25 },
  souvlaki: { kind: 'heal', amount: 50, price: 70 },
  frapes: { kind: 'cure', price: 60 }, // the MVP has no Crisis blues, so the frappe cures any status
  tsipouro: { kind: 'heal', amount: 9999, accDown: true, price: 180 },
  // MZ-WORLD-02b (Νότια): two heal items that also clear a status (cures: true). Only the kiosks of Νότια and later districts sell them.
  dikigoros: { kind: 'heal', amount: 80, cures: true, price: 150 },
  gemista: { kind: 'heal', amount: 9999, cures: true, price: 300 },
  // MZ-WORLD-02d (Βόρεια): the thick envelope, a recruit item stronger than the Φάκελος. Only the kiosks of Βόρεια and later districts sell it.
  chontros: { kind: 'recruit', mult: 2.5, price: 600 },
  // MZ-WORLD-02e (Δυτικά): a mid-size heal between the Δικηγόρος and the Γεμιστά (no status cure). Only the kiosks of Δυτικά and later districts sell it.
  sylvasi: { kind: 'heal', amount: 120, price: 150 },
};
const ITEM_IDS = ['fakelaki', 'fakelos', 'koulouri', 'souvlaki', 'frapes', 'tsipouro', 'dikigoros', 'gemista', 'chontros', 'sylvasi'];
const SHOP_STOCK = ['fakelaki', 'fakelos', 'koulouri', 'souvlaki', 'frapes', 'tsipouro'];
const SHOP_STOCK_NOTIA = SHOP_STOCK.concat(['dikigoros', 'gemista']);
const SHOP_STOCK_VOREIA = SHOP_STOCK_NOTIA.concat(['chontros']);
const SHOP_STOCK_DYTIKA = SHOP_STOCK_VOREIA.concat(['sylvasi']);
// The stock of the kiosk on a map: its own list (map.stock) or the New Piraeus one.
function shopStockOf(map) { return map && map.stock ? map.stock : SHOP_STOCK; }
const START_BAG = { fakelaki: 5, koulouri: 3 };

