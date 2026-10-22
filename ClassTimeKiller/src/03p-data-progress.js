// ==== S03 DATA: PROGRESSION ====
// Single-player structures and progression (spec section 19, PRG-001..PRG-014): XP rules and the level curve (levels 1..50),
// unlocks (cosmetics and sidegrades only, PRG-011), medals MD01..MD20, cards C01..C24 (spec 15 card table), the Tournament
// Ladder tiers BT0..BT7 with the named roster, the 20 Challenge Rooms, Operations and the Daily Seed rules.
// Code in 15a..15d reads every number from here; screens are in 18j. Contracts: docs/api/progression.md.

// ---- XP (PRG-010): a match pays perScore x score + perObjective x objective points + the medals' xp + finish / podium /
// win bonuses + perMinute x minutes played (capped). A match where the player did nothing pays nothing (no idle farming).
const PROGRESS_XP = {
  perScore: 12, perObjective: 30, finish: 120, podium: 80, win: 160, perMinute: 35, minutesCap: 15, minimumSeconds: 30,
  challengeStar: 150, ladderMatch: 200, operationStage: 200, daily: 150,
};
// Level curve: going from level n to n + 1 costs base + step x (n - 1) XP. Levels 1..50 (about 10 hours to level 30).
const PROGRESS_LEVELS = { max: 50, base: 1000, step: 55, unlockCap: 30 };
// Medals pay XP once per award; the double-award rules live in 15b (one chain medal per threshold, one streak medal per life).
const MEDAL_XP = 40;

Data.define('medals', { id: REQUIRED, code: REQUIRED, name: REQUIRED, text: REQUIRED, xp: MEDAL_XP }, [
  { id: 'firstStrike', code: 'MD01', name: 'First Strike', text: 'The first kill of the match.' },
  { id: 'double', code: 'MD02', name: 'Double', text: '2 kills, each within 3 s of the last.' },
  { id: 'multi', code: 'MD03', name: 'Multi', text: '3 kills, each within 3 s of the last.', xp: 80 },
  { id: 'spree', code: 'MD04', name: 'Spree', text: '5 kills without dying.', xp: 60 },
  { id: 'rampage', code: 'MD05', name: 'Rampage', text: '10 kills without dying.', xp: 120 },
  { id: 'unstoppable', code: 'MD06', name: 'Unstoppable', text: '15 kills without dying.', xp: 200 },
  { id: 'precise', code: 'MD07', name: 'Precise', text: '2 rail hits in a row.' },
  { id: 'humiliation', code: 'MD08', name: 'Humiliation', text: 'A melee kill.' },
  { id: 'comeback', code: 'MD09', name: 'Comeback', text: 'A kill after 3 deaths in a row.' },
  { id: 'defender', code: 'MD10', name: 'Defender', text: 'A kill near your own objective.' },
  { id: 'capture', code: 'MD11', name: 'Capture', text: 'Capture an objective.', xp: 60 },
  { id: 'assist', code: 'MD12', name: 'Assist', text: 'Help a teammate get a kill.', xp: 20 },
  { id: 'revenge', code: 'MD13', name: 'Revenge', text: 'Kill the one who last killed you.' },
  { id: 'telefrag', code: 'MD14', name: 'Telefrag', text: 'Arrive through a teleporter on top of someone.', xp: 80 },
  { id: 'airborne', code: 'MD15', name: 'Airborne', text: 'A kill while in the air.' },
  { id: 'longShot', code: 'MD16', name: 'Long Shot', text: 'A kill from more than 50 m.' },
  { id: 'ace', code: 'MD17', name: 'Ace', text: 'Eliminate the whole enemy team in one round.', xp: 200 },
  { id: 'clutch', code: 'MD18', name: 'Clutch', text: 'Win a round as the last one standing against 2 or more.', xp: 150 },
  { id: 'ghost', code: 'MD19', name: 'Ghost', text: 'Finish a stealth level without raising an alarm.', xp: 200 },
  { id: 'flawlessWave', code: 'MD20', name: 'Flawless Wave', text: 'Clear a wave without taking damage.', xp: 100 },
]);
// Medal detection numbers (15b).
const MEDAL_RULES = {
  chainSeconds: 3, double: 2, multi: 3, streaks: [[5, 'spree'], [10, 'rampage'], [15, 'unstoppable']],
  comebackDeaths: 3, defendRadius: 10, longShotMetres: 50, clutchEnemies: 2, railHits: 2, railWeapons: ['lancet'],
};

// ---- Unlocks (PRG-010, PRG-011): cosmetics and sidegrades only. kind: 'color' (body colour), 'finish' (body glow),
// 'title' (profile title), 'challenge' (a Challenge Room opens), 'card' (a card can be placed). Reached by level (<= 30)
// or by one named challenge: `mastery` (a weapon mastery tier, PRG-014) or `card` (the card's own play-style condition).
// value: the cosmetic itself; it never names a stat (self-test: no unlock changes a stat).
const UNLOCK_KINDS = ['color', 'finish', 'title', 'challenge', 'card'];
const UNLOCK_ROWS = [
  { id: 'colorSlate', name: 'Slate', kind: 'color', level: 1, value: 0x7d8a99 },
  { id: 'titleRookie', name: 'Rookie', kind: 'title', level: 1, value: 'Rookie' },
  { id: 'colorEmber', name: 'Ember', kind: 'color', level: 2, value: 0xd8643a },
  { id: 'titleRegular', name: 'Regular', kind: 'title', level: 3, value: 'Regular' },
  { id: 'colorMoss', name: 'Moss', kind: 'color', level: 4, value: 0x6f9a4a },
  { id: 'finishSatin', name: 'Satin', kind: 'finish', level: 5, value: 0.1 },
  { id: 'colorTide', name: 'Tide', kind: 'color', level: 6, value: 0x3e8fb8 },
  { id: 'titleSkirmisher', name: 'Skirmisher', kind: 'title', level: 7, value: 'Skirmisher' },
  { id: 'colorSaffron', name: 'Saffron', kind: 'color', level: 8, value: 0xe0b23a },
  { id: 'finishSheen', name: 'Sheen', kind: 'finish', level: 10, value: 0.2 },
  { id: 'colorPlum', name: 'Plum', kind: 'color', level: 11, value: 0x8a4f9e },
  { id: 'titleVeteran', name: 'Veteran', kind: 'title', level: 12, value: 'Veteran' },
  { id: 'colorFrost', name: 'Frost', kind: 'color', level: 14, value: 0xb8dcef },
  { id: 'finishGlow', name: 'Glow', kind: 'finish', level: 15, value: 0.35 },
  { id: 'colorRust', name: 'Rust', kind: 'color', level: 17, value: 0x9b4b34 },
  { id: 'titleAce', name: 'Ace', kind: 'title', level: 18, value: 'Ace' },
  { id: 'colorJade', name: 'Jade', kind: 'color', level: 20, value: 0x2fa37a },
  { id: 'finishRadiant', name: 'Radiant', kind: 'finish', level: 22, value: 0.5 },
  { id: 'colorNight', name: 'Night', kind: 'color', level: 24, value: 0x262a3a },
  { id: 'titleElite', name: 'Elite', kind: 'title', level: 26, value: 'Elite' },
  { id: 'colorRoyal', name: 'Royal', kind: 'color', level: 28, value: 0x4b3fb8 },
  { id: 'titleLegend', name: 'Legend', kind: 'title', level: 30, value: 'Legend' },
  { id: 'colorBronzeMastery', name: 'Bronze Mastery', kind: 'color', mastery: 'bronze', value: 0xb07a4a },
  { id: 'colorSilverMastery', name: 'Silver Mastery', kind: 'color', mastery: 'silver', value: 0xc4ccd4 },
  { id: 'colorGoldMastery', name: 'Gold Mastery', kind: 'color', mastery: 'gold', value: 0xe8c250 },
  { id: 'finishMasterGlow', name: 'Master Glow', kind: 'finish', mastery: 'master', value: 0.65 },
  { id: 'roomsTier2', name: 'Challenge Rooms 6-10', kind: 'challenge', level: 4, value: 2 },
  { id: 'roomsTier3', name: 'Challenge Rooms 11-15', kind: 'challenge', level: 9, value: 3 },
  { id: 'roomsTier4', name: 'Challenge Rooms 16-20', kind: 'challenge', level: 16, value: 4 },
];

// Weapon mastery (PRG-014): per weapon, kills and headshots reach a tier; each tier unlocks the mastery colours above.
const MASTERY_TIERS = [
  { id: 'bronze', name: 'Bronze', kills: 25, headshots: 0, color: 0xb07a4a },
  { id: 'silver', name: 'Silver', kills: 75, headshots: 15, color: 0xc4ccd4 },
  { id: 'gold', name: 'Gold', kills: 150, headshots: 40, color: 0xe8c250 },
  { id: 'master', name: 'Master', kills: 300, headshots: 100, color: 0x7fe0ff },
];

// ---- Cards (spec 15 card table, MIS-035): 3 active slots (each used once per level, 30 s) + 2 passive slots; placing costs
// Marks, removing refunds half. versus: allowed in versus matches with X48 (rules.fx.cards); PvE matches always allow cards.
// effect: { kind, value } read by the generic effect code in 15d. unlock: { metric, op, value } over the run metrics of one
// finished PvE level (RunLog in 15a + results.pve from the PvE section); hard: the difficulty is at least CARD_HARD_DIFFICULTY.
const CARD_SLOTS = { active: 3, passive: 2 };
const CARD_ACTIVE_SECONDS = 30;
const CARD_REFUND = 0.5;
const CARD_HARD_DIFFICULTY = 'skilled';
const CARD_ROWS = [
  { id: 'stoneskin', code: 'C01', name: 'Stoneskin', type: 'active', cost: 100, versus: true, effect: { kind: 'takenScale', value: 0.5 }, text: 'Damage taken x0.5.', unlock: { metric: 'pveFinished', op: '>=', value: 1, text: 'Finish any PvE level.' } },
  { id: 'slowtide', code: 'C02', name: 'Slowtide', type: 'active', cost: 100, versus: false, effect: { kind: 'worldSlow', value: 0.5 }, text: 'The world around you moves at half speed.', unlock: { metric: 'propsLeft', op: '==', value: 0, text: 'Destroy all props in a level.' } },
  { id: 'soulkeep', code: 'C03', name: 'Soulkeep', type: 'passive', cost: 500, versus: false, effect: { kind: 'soulLife', value: 3 }, text: 'Souls last x3.', unlock: { metric: 'enemiesLeft', op: '==', value: 0, text: 'Kill all enemies in a level.' } },
  { id: 'longwick', code: 'C04', name: 'Longwick', type: 'passive', cost: 100, versus: true, effect: { kind: 'activeSeconds', value: 10 }, text: 'Active cards last 10 s longer.', unlock: { metric: 'marks', op: '>=', value: 500, text: 'Collect 500 Marks in a level.' } },
  { id: 'blessing', code: 'C05', name: 'Hale Start', type: 'passive', cost: 200, versus: true, effect: { kind: 'startHealth', value: 150 }, text: 'Start with 150 HP.', unlock: { metric: 'bossSeconds', op: '<', value: 120, text: 'Defeat a boss in under 2:00.' } },
  { id: 'refill', code: 'C06', name: 'Deep Pockets', type: 'passive', cost: 500, versus: true, effect: { kind: 'ammoPickup', value: 2 }, text: 'Ammo pickups give twice as much.', unlock: { metric: 'explosiveShots', op: '==', value: 0, text: 'Finish a level without explosives.' } },
  { id: 'fleet', code: 'C07', name: 'Fleetfoot', type: 'active', cost: 100, versus: true, effect: { kind: 'speed', value: 1.3 }, text: 'Speed x1.3.', unlock: { metric: 'souls', op: '>=', value: 100, text: 'Collect 100 souls in a level.' } },
  { id: 'fury2', code: 'C08', name: 'Twin Fury', type: 'active', cost: 200, versus: true, effect: { kind: 'damage', value: 2 }, text: 'Damage x2.', unlock: { metric: 'rangedKills', op: '==', value: 0, minKills: 1, text: 'Finish a level with melee kills only.' } },
  { id: 'darkpact', code: 'C09', name: 'Dark Pact', type: 'passive', cost: 400, versus: false, effect: { kind: 'wrathAt', value: 50 }, text: 'Wrath Form at 50 souls.', unlock: { metric: 'secretsLeft', op: '==', value: 0, text: 'Find all secrets in a level.' } },
  { id: 'rapid', code: 'C10', name: 'Rapid Hands', type: 'active', cost: 300, versus: true, effect: { kind: 'rate', value: 2 }, text: 'Fire rate x2.', unlock: { metric: 'bossSeconds', op: '<', value: 240, text: 'Defeat a boss in under 4:00.' } },
  { id: 'magnet', code: 'C11', name: 'Soul Magnet', type: 'passive', cost: 500, versus: false, effect: { kind: 'soulMagnet', value: 15 }, text: 'Souls fly to you from 15 m.', unlock: { metric: 'souls', op: '==', value: 0, text: 'Finish a level without collecting souls.' } },
  { id: 'encore', code: 'C12', name: 'Encore', type: 'passive', cost: 1000, versus: true, effect: { kind: 'activeUses', value: 2 }, text: 'Active cards can be used twice.', unlock: { metric: 'wrathKills', op: '>=', value: 30, text: 'Get 30 kills in Wrath Form.' } },
  { id: 'greed', code: 'C13', name: 'Greed', type: 'passive', cost: 2000, versus: false, effect: { kind: 'marks', value: 2 }, text: 'Marks x2.', unlock: { metric: 'optionalLeft', op: '==', value: 0, text: 'Kill every optional spawn in a level.' } },
  { id: 'ironwill', code: 'C14', name: 'Iron Will', type: 'active', cost: 666, versus: false, effect: { kind: 'invulnerable', value: 1 }, text: 'Invulnerable.', unlock: { metric: 'bossSeconds', op: '<', value: 80, text: 'Defeat a boss in under 1:20.' } },
  { id: 'rage', code: 'C15', name: 'Rage', type: 'active', cost: 500, versus: false, effect: { kind: 'damage', value: 4 }, text: 'Damage x4.', unlock: { metric: 'secretsLeft', op: '==', value: 0, deaths: 0, text: 'Find all secrets without dying.' } },
  { id: 'hardy', code: 'C16', name: 'Hardy', type: 'passive', cost: 100, versus: true, effect: { kind: 'baseHealth', value: 150 }, text: 'Base HP 150.', unlock: { metric: 'armorPickups', op: '==', value: 0, text: 'Finish a level without armor pickups.' } },
  { id: 'freecards', code: 'C17', name: 'Patron', type: 'passive', cost: 0, versus: true, effect: { kind: 'freePlacement', value: 1 }, text: 'Cards are placed for free.', unlock: { metric: 'cardsEquipped', op: '==', value: 0, text: 'Finish a level with no cards.' } },
  { id: 'lastbreath', code: 'C18', name: 'Last Breath', type: 'passive', cost: 500, versus: true, effect: { kind: 'lastBreath', value: 33 }, text: 'Survive one lethal hit with 33 HP.', unlock: { metric: 'secretsLeft', op: '==', value: 0, hard: true, text: 'Find all secrets on a hard difficulty.' } },
  { id: 'discord', code: 'C19', name: 'Discord', type: 'active', cost: 200, versus: false, effect: { kind: 'discord', value: 15 }, text: 'Enemies fight each other for 15 s.', unlock: { metric: 'wrathForms', op: '>=', value: 3, text: 'Enter Wrath Form 3 times in a level.' } },
  { id: 'redeemer', code: 'C20', name: 'Soul Feast', type: 'passive', cost: 1000, versus: false, effect: { kind: 'soulHeal', value: 2 }, text: 'Souls heal twice as much.', unlock: { metric: 'lowestHealth', op: '>', value: 50, text: 'Keep HP above 50 for a whole level.' } },
  { id: 'endless', code: 'C21', name: 'Endless Clip', type: 'active', cost: 300, versus: true, effect: { kind: 'noAmmoUse', value: 1 }, text: 'Shots use no ammo.', unlock: { metric: 'kills', op: '<=', value: 88, minKills: 1, text: 'Finish a level with 88 kills or fewer.' } },
  { id: 'onehp', code: 'C22', name: 'Brittle Foes', type: 'active', cost: 300, versus: false, effect: { kind: 'brittleFoes', value: 1 }, text: 'Every hit on an enemy is lethal.', unlock: { metric: 'weaponsUsed', op: '==', value: 1, text: 'Finish a level with a single weapon.' } },
  { id: 'regenhp', code: 'C23', name: 'Mending', type: 'passive', cost: 1000, versus: true, effect: { kind: 'regen', value: 75, rate: 3 }, text: 'HP regrows to 75 at 3 per second.', unlock: { metric: 'bossSeconds', op: '<', value: 240, hard: true, text: 'Defeat a boss in under 4:00 on a hard difficulty.' } },
  { id: 'thief', code: 'C24', name: 'Life Thief', type: 'passive', cost: 2000, versus: true, effect: { kind: 'lifesteal', value: 0.05 }, text: '5% of the damage you deal heals you.', unlock: { metric: 'finalBossSeconds', op: '<', value: 240, text: 'Defeat the final boss in under 4:00.' } },
];
Data.define('cards', { id: REQUIRED, code: REQUIRED, name: REQUIRED, type: REQUIRED, cost: REQUIRED, versus: false, effect: REQUIRED, text: '', unlock: REQUIRED }, CARD_ROWS);
// One unlock row per card (its play-style condition is the named challenge).
Data.define('unlocks', { id: REQUIRED, name: REQUIRED, kind: REQUIRED, level: 0, mastery: '', card: '', value: null },
  UNLOCK_ROWS.concat(CARD_ROWS.map((row) => ({ id: 'card' + row.code, name: row.name + ' card', kind: 'card', card: row.id, value: row.id }))));
// Marks (card currency): per PvE enemy kill and per crate; Greed doubles them.
const MARKS_RULES = { perKill: 5, perCrate: 25 };

// ---- Tournament Ladder (PRG-003): tiers BT0..BT7, each 3-4 matches of FFA / Duel / TDM / CTF / Holdfast / Detonate against
// named bots (B01..B24). Advance: top `podium` in free-for-all, a win in duels and team modes. The last match is the duel
// against B24. difficulty: the suggested preset; the player may pick another per match (bot tiers follow its range).
// options: setup.modeOptions (shorter matches than the mode default keep the ladder about 10 hours).
const LADDER_PODIUM = 3;
const LADDER_OPTIONS = { ffa: { scoreLimit: 15, timeLimit: 480 }, duel: { scoreLimit: 10, timeLimit: 480 }, tdm: { scoreLimit: 30, timeLimit: 480 } };
Data.define('ladder', { id: REQUIRED, code: REQUIRED, name: REQUIRED, tier: REQUIRED, difficulty: REQUIRED, matches: REQUIRED }, [
  { id: 'tier0', code: 'BT0', name: 'Novice Cup', tier: 0, difficulty: 'stroll', matches: [
    { mode: 'ffa', map: 'spire', bots: ['pell', 'dovetail', 'grommet'] },
    { mode: 'duel', map: 'spire', bots: ['dovetail'] },
    { mode: 'tdm', map: 'skyyard', bots: ['pell', 'grommet', 'ashby'], allies: 1 }] },
  { id: 'tier1', code: 'BT1', name: 'Rookie Circuit', tier: 1, difficulty: 'recruit', matches: [
    { mode: 'ffa', map: 'skyyard', bots: ['grommet', 'ashby', 'lintel', 'pell'] },
    { mode: 'ctf', map: 'twinkeeps', bots: ['lintel', 'ashby', 'grommet', 'dovetail', 'pell'], allies: 2 },
    { mode: 'duel', map: 'spire', bots: ['ashby'] }] },
  { id: 'tier2', code: 'BT2', name: 'Regular League', tier: 2, difficulty: 'novice', matches: [
    { mode: 'ffa', map: 'gantry', bots: ['mossa', 'rookvarga', 'tilde', 'lintel'] },
    { mode: 'dom', map: 'twinkeeps', bots: ['mossa', 'tilde', 'rookvarga', 'ashby', 'lintel'], allies: 2 },
    { mode: 'tdm', map: 'harbor', bots: ['tilde', 'mossa', 'rookvarga', 'grommet', 'ashby'], allies: 2 },
    { mode: 'duel', map: 'gantry', bots: ['tilde'] }] },
  { id: 'tier3', code: 'BT3', name: 'Skilled Series', tier: 3, difficulty: 'regular', matches: [
    { mode: 'ffa', map: 'skyyard', bots: ['corvan', 'nyx7', 'brindle', 'saffi'] },
    { mode: 'bomb', map: 'dustline', bots: ['corvan', 'nyx7', 'brindle', 'saffi', 'mossa'], allies: 2 },
    { mode: 'duel', map: 'spire', bots: ['nyx7'] }] },
  { id: 'tier4', code: 'BT4', name: 'Adept Open', tier: 4, difficulty: 'skilled', matches: [
    { mode: 'ffa', map: 'gantry', bots: ['halloran', 'quarry', 'jessamy', 'okoro'] },
    { mode: 'ctf', map: 'twinkeeps', bots: ['okoro', 'halloran', 'quarry', 'jessamy', 'saffi'], allies: 2 },
    { mode: 'dom', map: 'gantry', bots: ['jessamy', 'quarry', 'halloran', 'okoro', 'corvan'], allies: 2 },
    { mode: 'duel', map: 'gantry', bots: ['halloran'] }] },
  { id: 'tier5', code: 'BT5', name: 'Masters Bracket', tier: 5, difficulty: 'veteran', matches: [
    { mode: 'ffa', map: 'skyyard', bots: ['vantablue', 'marrow', 'isoldecrane', 'halloran'] },
    { mode: 'tdm', map: 'harbor', bots: ['marrow', 'vantablue', 'isoldecrane', 'quarry', 'okoro'], allies: 2 },
    { mode: 'duel', map: 'spire', bots: ['isoldecrane'] }] },
  { id: 'tier6', code: 'BT6', name: 'Inhuman Gauntlet', tier: 6, difficulty: 'elite', matches: [
    { mode: 'ffa', map: 'gantry', bots: ['teodor', 'wrenkasai', 'ostrava', 'marrow'] },
    { mode: 'bomb', map: 'dustline', bots: ['teodor', 'ostrava', 'wrenkasai', 'vantablue', 'isoldecrane'], allies: 2 },
    { mode: 'ctf', map: 'twinkeeps', bots: ['wrenkasai', 'teodor', 'ostrava', 'marrow', 'vantablue'], allies: 2 },
    { mode: 'duel', map: 'gantry', bots: ['teodor'] }] },
  { id: 'tier7', code: 'BT7', name: 'Apex Final', tier: 7, difficulty: 'nightmare', matches: [
    { mode: 'ffa', map: 'skyyard', bots: ['calderrhee', 'teodor', 'wrenkasai', 'ostrava'] },
    { mode: 'duel', map: 'spire', bots: ['calderrhee'] },
    { mode: 'duel', map: 'gantry', bots: ['wardenofnine'], final: true }] },
]);

// ---- Challenge Rooms (PRG-004): 20 trials, points from the run metrics x `points` weights (underPar = seconds left of `par`),
// 1-3 stars at `stars` thresholds (10,000 points per star), an Expert version once 2 stars are earned (bots `expertTier`
// tiers up and the `expert` mutators, else its kind's CHALLENGE_EXPERT_MUTATORS). group: the room block that a level unlock
// opens (1 = from the start).
const CHALLENGE_STARS = [10000, 20000, 30000];
const CHALLENGE_EXPERT_STARS = 2;
const CHALLENGE_DIFFICULTY = { normal: 'regular', expert: 'veteran' };   // bot sliders of a normal / Expert room
const CHALLENGE_KINDS = ['timeTrial', 'killChain', 'waveSurvival', 'dropKill', 'ghostRun', 'accuracy'];
// The Expert mutators of each room kind, for rows that name no `expert` list of their own (damage taken in percent).
const CHALLENGE_EXPERT_MUTATORS = {
  timeTrial: ['nopowerups', { id: 'dmgin', value: 150 }], killChain: [{ id: 'dmgin', value: 150 }, 'nopowerups'],
  waveSurvival: ['nopowerups', 'lastgift'], dropKill: ['suppression', 'nopowerups'],
  ghostRun: ['suppression', { id: 'dmgin', value: 150 }], accuracy: ['suppression', 'nopowerups'],
};
Data.define('challenges', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, kind: REQUIRED, group: 1, mode: REQUIRED, map: REQUIRED, bots: REQUIRED, tier: 0,
  options: {}, mutators: [], par: 0, points: REQUIRED, stars: CHALLENGE_STARS, expertTier: 2, expert: [], text: '',
}, [
  { id: 'sprint', code: 'CR01', name: 'Spire Sprint', kind: 'timeTrial', mode: 'ffa', map: 'spire', bots: 3, tier: 0, options: { scoreLimit: 5, timeLimit: 300 }, par: 150, points: { kills: 3000, underPar: 220 }, text: 'Five kills, as fast as you can.' },
  { id: 'chainYard', code: 'CR02', name: 'Yard Chain', kind: 'killChain', mode: 'ffa', map: 'skyyard', bots: 5, tier: 0, options: { scoreLimit: 12, timeLimit: 300 }, points: { bestStreak: 2500, kills: 500 }, text: 'Build the longest chain of kills without dying.' },
  { id: 'holdout', code: 'CR03', name: 'Holdout', kind: 'waveSurvival', mode: 'ffa', map: 'gantry', bots: 6, tier: 0, options: { scoreLimit: 0, timeLimit: 300 }, mutators: [{ id: 'lives', value: 3 }], points: { kills: 1200, seconds: 40, won: 6000 }, text: 'Three lives. Outlast everyone.' },
  { id: 'dropZone', code: 'CR04', name: 'Drop Zone', kind: 'dropKill', mode: 'ffa', map: 'gantry', bots: 4, tier: 0, options: { scoreLimit: 10, timeLimit: 300 }, mutators: ['multijump'], points: { airKills: 3000, kills: 500 }, text: 'Kills while airborne count most.' },
  { id: 'markYard', code: 'CR05', name: 'Marksman Yard', kind: 'accuracy', mode: 'ffa', map: 'skyyard', bots: 4, tier: 0, options: { scoreLimit: 8, timeLimit: 300 }, points: { accuracy: 20000, headshots: 800, kills: 500 }, text: 'Every miss costs you points.' },
  { id: 'quietSpire', code: 'CR06', name: 'Quiet Spire', kind: 'ghostRun', group: 2, mode: 'ffa', map: 'spire', bots: 3, tier: 1, options: { scoreLimit: 6, timeLimit: 300 }, par: 180, points: { kills: 3500, damageTaken: -30, underPar: 110 }, text: 'Win without getting hit.' },
  { id: 'sprintGantry', code: 'CR07', name: 'Gantry Dash', kind: 'timeTrial', group: 2, mode: 'ffa', map: 'gantry', bots: 4, tier: 1, options: { scoreLimit: 8, timeLimit: 300 }, par: 200, points: { kills: 2500, underPar: 110 }, text: 'Eight kills against the clock.' },
  { id: 'chainKeeps', code: 'CR08', name: 'Keep Chain', kind: 'killChain', group: 2, mode: 'ffa', map: 'gantry', bots: 6, tier: 1, options: { scoreLimit: 15, timeLimit: 360 }, points: { bestStreak: 2200, kills: 450 }, text: 'Chain kills across the gantries.' },
  { id: 'bigHeads', code: 'CR09', name: 'Big Heads', kind: 'accuracy', group: 2, mode: 'ffa', map: 'spire', bots: 4, tier: 1, options: { scoreLimit: 10, timeLimit: 300 }, mutators: ['bighead'], points: { headshots: 1900, accuracy: 12000 }, text: 'Bigger heads, so aim for them.' },
  { id: 'lastLight', code: 'CR10', name: 'Last Light', kind: 'waveSurvival', group: 2, mode: 'ffa', map: 'skyyard', bots: 7, tier: 1, options: { scoreLimit: 0, timeLimit: 360 }, mutators: [{ id: 'lives', value: 3 }], points: { kills: 1000, seconds: 35, won: 7000 }, text: 'Last one standing on the yard.' },
  { id: 'skyDuel', code: 'CR11', name: 'Sky Duel', kind: 'dropKill', group: 3, mode: 'ffa', map: 'skyyard', bots: 4, tier: 2, options: { scoreLimit: 10, timeLimit: 300 }, mutators: ['aircontrol', 'multijump'], points: { airKills: 3200, kills: 400 }, text: 'Take the fight to the air.' },
  { id: 'oneShot', code: 'CR12', name: 'One Shot', kind: 'accuracy', group: 3, mode: 'ffa', map: 'gantry', bots: 5, tier: 2, options: { scoreLimit: 10, timeLimit: 300 }, mutators: ['oneshot'], points: { accuracy: 18000, kills: 1300 }, text: 'One-shot rails: do not miss.' },
  { id: 'shadowYard', code: 'CR13', name: 'Shadow Yard', kind: 'ghostRun', group: 3, mode: 'ffa', map: 'skyyard', bots: 4, tier: 2, options: { scoreLimit: 8, timeLimit: 300 }, par: 210, points: { kills: 2800, damageTaken: -25, underPar: 80 }, text: 'Strike from the shadows and stay unhurt.' },
  { id: 'duelRush', code: 'CR14', name: 'Duel Rush', kind: 'timeTrial', group: 3, mode: 'duel', map: 'spire', bots: 1, tier: 2, options: { scoreLimit: 7, timeLimit: 300 }, par: 150, points: { kills: 3000, underPar: 130, deaths: -800 }, text: 'Seven kills in a duel, fast.' },
  { id: 'packHunt', code: 'CR15', name: 'Pack Hunt', kind: 'killChain', group: 3, mode: 'ffa', map: 'skyyard', bots: 7, tier: 2, options: { scoreLimit: 20, timeLimit: 420 }, points: { bestStreak: 2000, kills: 400 }, text: 'A crowd to chain through.' },
  { id: 'ironRing', code: 'CR16', name: 'Iron Ring', kind: 'waveSurvival', group: 4, mode: 'ffa', map: 'gantry', bots: 8, tier: 3, options: { scoreLimit: 0, timeLimit: 420 }, mutators: [{ id: 'lives', value: 3 }], points: { kills: 1000, seconds: 30, won: 8000 }, text: 'Eight tough rivals, three lives.' },
  { id: 'freefall', code: 'CR17', name: 'Freefall', kind: 'dropKill', group: 4, mode: 'ffa', map: 'gantry', bots: 5, tier: 3, options: { scoreLimit: 12, timeLimit: 360 }, mutators: ['gravity'], points: { airKills: 2800, kills: 500 }, text: 'Low gravity, long falls.' },
  { id: 'headHunter', code: 'CR18', name: 'Head Hunter', kind: 'accuracy', group: 4, mode: 'ffa', map: 'skyyard', bots: 5, tier: 3, options: { scoreLimit: 10, timeLimit: 300 }, mutators: ['headonly'], points: { headshots: 2000, accuracy: 10000 }, text: 'Only headshots hurt.' },
  { id: 'phantom', code: 'CR19', name: 'Phantom', kind: 'ghostRun', group: 4, mode: 'ffa', map: 'gantry', bots: 5, tier: 3, options: { scoreLimit: 10, timeLimit: 360 }, par: 240, points: { kills: 2300, damageTaken: -20, underPar: 70 }, text: 'Ten kills, untouched.' },
  { id: 'gauntlet', code: 'CR20', name: 'The Gauntlet', kind: 'timeTrial', group: 4, mode: 'ffa', map: 'skyyard', bots: 7, tier: 3, options: { scoreLimit: 12, timeLimit: 420 }, par: 300, points: { kills: 1800, underPar: 70, deaths: -1000 }, text: 'Twelve kills against the best, against the clock.' },
]);

// ---- Operations (PRG-007): 3 maps in a row; each side starts a map with `tickets` (base) plus `carry` x the tickets it had
// left on the last map, capped at `cap`; every death costs one ticket (a side at 0 loses the map). The side that lost the
// last map gets the comeback unit (one heavy bot on its side). The side that wins more maps wins the operation.
const OPERATION_TICKETS = { base: 60, carry: 0.5, cap: 120, deathCost: 1 };
const OPERATION_COMEBACK = { profile: 'okoro', tier: 6, name: 'Heavy Unit' };
Data.define('operations', { id: REQUIRED, code: REQUIRED, name: REQUIRED, difficulty: 'regular', bots: 3, stages: REQUIRED, text: '' }, [
  { id: 'ironcoast', code: 'OP1', name: 'Iron Coast', difficulty: 'novice', bots: 3, text: 'Push from the yards to the harbour.', stages: [
    { mode: 'tdm', map: 'skyyard' }, { mode: 'dom', map: 'twinkeeps' }, { mode: 'hardpoint', map: 'harbor' }] },
  { id: 'highline', code: 'OP2', name: 'Highline', difficulty: 'regular', bots: 4, text: 'Hold the gantries, then the keeps.', stages: [
    { mode: 'dom', map: 'gantry' }, { mode: 'tdm', map: 'harbor' }, { mode: 'ctf', map: 'twinkeeps' }] },
  { id: 'longwinter', code: 'OP3', name: 'Long Winter', difficulty: 'skilled', bots: 5, text: 'Three fronts against elite squads.', stages: [
    { mode: 'hardpoint', map: 'gantry' }, { mode: 'dom', map: 'twinkeeps' }, { mode: 'tdm', map: 'skyyard' }] },
]);

// ---- Daily Seed (PRG-006): the local date picks a mode from DAILY_RULES.modes, a ruleset bundle, 2 non-conflicting
// mutators from the list, and a generated map when the generator exists (else a hand-made map serving the mode).
// Scored by DAILY_RULES.points over the run metrics; the best score per date is kept (no streaks, no penalties).
const DAILY_RULES = {
  modes: ['ffa', 'tdm', 'dom', 'hardpoint', 'ctf'],
  rulesets: ['classic', 'tourney', 'modern', 'pilot', 'vanguard'],
  mutators: ['gravity', 'playerspeed', 'vampire', 'bighead', 'infammo', 'regen', 'noself', 'multijump', 'knockback', 'slowmokills', 'aircontrol', 'colossal', 'weaponstay', 'tags'],
  mutatorCount: 2, bots: 5, difficulty: 'regular', historyDays: 60,   // bots: fixed, inside the lowest quality preset's cap (7)
  points: { kills: 500, score: 100, headshots: 200, deaths: -150, won: 3000 },
};
