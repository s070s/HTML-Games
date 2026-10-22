// STUB until the economy helper lands (S13 economy, loadouts, buy menu).

const Economy = {
  money(id) { return 0; },
  // Fills out { money, nextRoundMoney, canBuy, buyTimeLeft } for the HUD.
  hudState(id, out) { out.money = 0; out.nextRoundMoney = 0; out.canBuy = false; out.buyTimeLeft = 0; return out; },
};
