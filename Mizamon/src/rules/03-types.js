// ---- Types and the chart (CONTENT-SEED section 2) -------------------------------
// pol Politicians, asf Asfalites (army and police), ekk Orthodox Church,
// cel Celebrities, inf Influencers, biz Businessmen, mem Plain Greek Memes.
// TYPE_IDS and TYPE_RULES (strong and weak against) are built from data/types/ in 02-data.js.
const TYPE_CHART = (function buildChart() {
  const chart = {};
  for (const attacker of TYPE_IDS) {
    chart[attacker] = {};
    for (const defender of TYPE_IDS) {
      let multiplier = 1;
      if (TYPE_RULES[attacker].strong.includes(defender)) multiplier = 2;
      if (TYPE_RULES[attacker].weak.includes(defender)) multiplier = 0.5;
      if (attacker === defender) multiplier = 0.5; // "they protect each other"
      chart[attacker][defender] = multiplier;
    }
  }
  return chart;
})();
function typeMultiplier(attackType, defendType) { return TYPE_CHART[attackType][defendType]; }

// ---- Abilities (CONTENT-SEED section 3; the ones the MVP creatures hold) ---------
// ABILITY_IDS is built from data/abilities/ in 02-data.js; what an ability does is code (07-damage and later).

// ---- Statuses (section 4; the four of the MVP) --------------------------------
// STATUSES is built from data/statuses/ in 02-data.js (turns: how long it lasts, 0 = until the creature is switched out):
// inv Υπό Έρευνα: attack and rhetoric -25 %, archived after 5 turns; sca Σκάνδαλο: -1/8 HP per turn;
// str Απεργία: 50 % to do nothing, 3 turns; bri Λαδωμένος: 30 % to pocket the money instead of attacking, 4 turns.

