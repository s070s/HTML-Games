// ---- Types and the chart (CONTENT-SEED section 2) -------------------------------
// pol Politicians, asf Asfalites (army and police), ekk Orthodox Church,
// cel Celebrities, inf Influencers, biz Businessmen, mem Plain Greek Memes.
const TYPE_IDS = ['pol', 'asf', 'ekk', 'cel', 'inf', 'biz', 'mem'];
const TYPE_RULES = {
  pol: { strong: ['biz', 'asf'], weak: ['mem', 'inf'] },
  asf: { strong: ['mem', 'inf'], weak: ['pol', 'ekk'] },
  ekk: { strong: ['asf', 'cel'], weak: ['biz', 'mem'] },
  cel: { strong: ['pol', 'biz'], weak: ['inf', 'ekk'] },
  inf: { strong: ['cel', 'pol'], weak: ['asf', 'mem'] },
  biz: { strong: ['ekk', 'inf'], weak: ['pol', 'cel'] },
  mem: { strong: ['pol', 'ekk'], weak: ['asf', 'biz'] },
};
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
const ABILITY_IDS = ['asy', 'syn', 'gra', 'rou', 'afo', 'pal', 'vir', 'out', 'bur', 'vys', 'bah', 'kou', 'des', 'epi'];

// ---- Statuses (section 4; the four of the MVP) --------------------------------
const STATUSES = {
  inv: { turns: 5 }, // Υπό Έρευνα: attack and rhetoric -25 %, archived after 5 turns
  sca: { turns: 0 }, // Σκάνδαλο: -1/8 HP per turn, until the creature is switched out
  str: { turns: 3 }, // Απεργία: 50 % to do nothing, 3 turns
  bri: { turns: 4 }, // Λαδωμένος: 30 % to pocket the money instead of attacking, 4 turns
};

