// =============================================================================
// RULES: data tables and pure functions. No DOM, no Date, no Math.random.
// tools/run-tests.mjs loads exactly the text between RULES-BEGIN and RULES-END.
// Every random number comes from a seeded RNG that is passed in.
// =============================================================================

// ---- Constants --------------------------------------------------------------
const SAVE_VERSION = 3;
const SAVE_KEY = 'mizamon.v1.save';
const OPTIONS_KEY = 'mizamon.v1.options';
const MAX_LEVEL = 50;
const PARTY_MAX = 6;
const ARCHIVE_MAX = 60; // the Αρχείο Ασθενών (creature storage) of the hospital
const MOVES_MAX = 4;
const NAME_MAX = 8;
const DAMAGE_DIVISOR = 90; // damage = power * atk / def * (level + 4) / DAMAGE_DIVISOR
const CRIT_CHANCE = 1 / 16;
const CRIT_MULT = 1.5;
const STAB_MULT = 1.5;
const ENCOUNTER_CHANCE = 0.13; // chance per step on tall grass
const XP_DIVISOR = 4; // xp = species.xp * foeLevel / XP_DIVISOR
const TRAINER_XP_BONUS = 1.5;
const XP_SCALE_FROM = 13; // above this foe level the XP grows by foeLevel / XP_SCALE_FROM (section 11.4: the XP curve grows with the cube, the reward only linearly)
const PRIZE_PER_LEVEL = 30;
const OVERTIME_TURN = 120; // from this turn on the show runs over: both fighters lose HP each turn (ends any stalemate)
const OVERTIME_STEP = 1 / 32; // the loss grows by this share of max HP with every turn over time, so healing cannot keep up
const START_MONEY = 300;
const BLACKOUT_MONEY_KEEP = 0.5;
const STAT_KEYS = ['hp', 'atk', 'def', 'rat', 'rde', 'spe'];
const STAGE_KEYS = ['atk', 'def', 'rat', 'rde', 'spe', 'acc'];
const STAT_INDEX = { hp: 0, atk: 1, def: 2, rat: 3, rde: 4, spe: 5 };

