// =============================================================================
// RULES: data tables and pure functions. No DOM, no Date, no Math.random.
// tools/run-tests.mjs loads exactly the text between RULES-BEGIN and RULES-END.
// Every random number comes from a seeded RNG that is passed in.
// =============================================================================

// ---- Constants --------------------------------------------------------------
// The tunable numbers are in data/game.json (DATA.game); the save format and the layout limits are code.
const SAVE_VERSION = 3;
const SAVE_KEY = 'mizamon.v1.save';
const OPTIONS_KEY = 'mizamon.v1.options';
const MAX_LEVEL = DATA.game.maxLevel;
const PARTY_MAX = 6;
const ARCHIVE_MAX = 60; // the Αρχείο Ασθενών (creature storage) of the hospital
const MOVES_MAX = 4;
const NAME_MAX = 8;
const DAMAGE_DIVISOR = DATA.game.damageDivisor; // damage = power * atk / def * (level + 4) / DAMAGE_DIVISOR
const CRIT_CHANCE = DATA.game.critChance;
const CRIT_MULT = DATA.game.critMult;
const STAB_MULT = DATA.game.stabMult;
const ENCOUNTER_CHANCE = DATA.game.encounterChance; // chance per step on tall grass
const XP_DIVISOR = DATA.game.xpDivisor; // xp = species.xp * foeLevel / XP_DIVISOR
const TRAINER_XP_BONUS = DATA.game.trainerXpBonus;
const XP_SCALE_FROM = DATA.game.xpScaleFrom; // above this foe level the XP grows by foeLevel / XP_SCALE_FROM (section 11.4: the XP curve grows with the cube, the reward only linearly)
const PRIZE_PER_LEVEL = DATA.game.prizePerLevel;
const OVERTIME_TURN = DATA.game.overtimeTurn; // from this turn on the show runs over: both fighters lose HP each turn (ends any stalemate)
const OVERTIME_STEP = DATA.game.overtimeStep; // the loss grows by this share of max HP with every turn over time, so healing cannot keep up
const START_MONEY = DATA.game.startMoney;
const BLACKOUT_MONEY_KEEP = DATA.game.blackoutMoneyKeep;
const STAT_KEYS = ['hp', 'atk', 'def', 'rat', 'rde', 'spe'];
const STAGE_KEYS = ['atk', 'def', 'rat', 'rde', 'spe', 'acc'];
const STAT_INDEX = { hp: 0, atk: 1, def: 2, rat: 3, rde: 4, spe: 5 };

