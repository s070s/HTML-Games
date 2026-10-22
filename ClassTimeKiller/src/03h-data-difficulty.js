// ==== S03 DATA: DIFFICULTY ====
// Difficulty presets D01..D10 (spec 15) and the DIF-002 slider ranges. A preset sets the bot tier mix and the sliders;
// S14 turns the chosen preset (plus custom slider values) into rules.botSkill at the 'difficulty' rule stage.
// playerDamage / enemyDamage only change PvE damage (BOT-040: no bot damage bonus in versus); resourceYield = the
// "Pickups" column; aimAssist -1 keeps the player's own aim assist setting; lives 0 = unlimited (PvE).

Data.define('difficulty', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, tierMin: REQUIRED, tierMax: REQUIRED,
  playerDamage: 1, enemyDamage: 1, attackers: 3, aggression: 0.5, resourceYield: 1, parry: 0.3, aimAssist: -1,
  reactionScale: 1, aimErrorScale: 1, projectileSpeed: 1, gameSpeed: 1, lives: 0, checkpoints: true, checkpointHeal: 0.5,
}, [
  { id: 'stroll', code: 'D01', name: 'Stroll', tierMin: 0, tierMax: 0, playerDamage: 0.4, attackers: 1, aggression: 0.1, resourceYield: 2, parry: 0.5, aimAssist: 100, checkpointHeal: 1 },
  { id: 'recruit', code: 'D02', name: 'Recruit', tierMin: 0, tierMax: 1, playerDamage: 0.6, attackers: 2, aggression: 0.25, resourceYield: 1.5, parry: 0.4 },
  { id: 'novice', code: 'D03', name: 'Novice', tierMin: 1, tierMax: 2, playerDamage: 0.75, attackers: 2, aggression: 0.35, resourceYield: 1.25 },
  { id: 'regular', code: 'D04', name: 'Regular', tierMin: 2, tierMax: 3, playerDamage: 1, attackers: 3, aggression: 0.5, resourceYield: 1 },
  { id: 'skilled', code: 'D05', name: 'Skilled', tierMin: 3, tierMax: 4, playerDamage: 1.25, attackers: 3, aggression: 0.6, resourceYield: 1 },
  { id: 'veteran', code: 'D06', name: 'Veteran', tierMin: 4, tierMax: 5, playerDamage: 1.5, attackers: 4, aggression: 0.7, resourceYield: 0.9 },
  { id: 'elite', code: 'D07', name: 'Elite', tierMin: 5, tierMax: 6, playerDamage: 2, attackers: 5, aggression: 0.8, resourceYield: 0.8, parry: 0.2 },
  { id: 'masterful', code: 'D08', name: 'Masterful', tierMin: 6, tierMax: 6, playerDamage: 2.25, attackers: 6, aggression: 0.9, resourceYield: 0.75 },
  { id: 'nightmare', code: 'D09', name: 'Nightmare', tierMin: 7, tierMax: 7, playerDamage: 2.5, attackers: 7, aggression: 1, resourceYield: 0.7, parry: 0.15 },
  { id: 'ascendant', code: 'D10', name: 'Ascendant', tierMin: 7, tierMax: 7, playerDamage: 2.5, attackers: 8, aggression: 1, resourceYield: 0.7, lives: 1, checkpoints: false },
]);

// DIF-002 slider ranges: a custom value (setup.difficulty = { preset, <field>: value }) is clamped into its range.
const DIFFICULTY_SLIDERS = [
  { field: 'reactionScale', min: 0.5, max: 2 },
  { field: 'aimErrorScale', min: 0.5, max: 3 },
  { field: 'aggression', min: 0, max: 1 },
  { field: 'attackers', min: 1, max: 8 },
  { field: 'playerDamage', min: 0.25, max: 4 },
  { field: 'enemyDamage', min: 0.25, max: 4 },
  { field: 'projectileSpeed', min: 0.5, max: 1.5 },
  { field: 'parry', min: 0.1, max: 0.5 },
  { field: 'resourceYield', min: 0.5, max: 2 },
  { field: 'gameSpeed', min: 0.5, max: 1.2 },
  { field: 'aimAssist', min: 0, max: 100 },
  { field: 'lives', min: 0, max: 9 },
  { field: 'checkpointHeal', min: 0, max: 1 },
];
