// The P8-03 test plan as data: 715 cases in 14 families (Appendix C "P8-03"). Used by tools/balance.mjs.
// A case: { id, family, wave, seeds, mirror, spec }. A run is (case, seed, mirror); the spec is what __CTK.balance.run(spec) takes
// (src/20b-test-balance.js): { mode, map, ruleset, minutes, botCount, forced {slot: code}, forcedCount, forcedPick [classes], grant [powerups],
// tier, overrides {path: value}, mutators, modeOptions }. The seed and the mirror flag are added per run.
// Waves (extremes first): 0 = F1 and F0 (about 2 min), 1 = home-map weapons, RS03 and RS07, bot skill, F8 EP1 and EP4, symmetric fairness,
// 2 = the rest, 3 = F8 EP2, EP3 and EP5 (only for abilities whose wave 1 index is outside 0.44-0.56).

export const WEAPONS = 'W01 W02 W03 W04 W05 W06 W07 W09 W10 W12 W13 W15 W17 W19 W20 W21 W23 W24 W25 W26 W27 W28 W30 W31 W32 W34 W35 W36 W37 W38 W39 W40 W43 W44'.split(' ');
export const CLASSES = ['melee', 'sidearm', 'smg', 'shotgun', 'rifle', 'marksman', 'sniper', 'energy', 'heavy', 'explosive', 'exotic'];
const HOME_MAPS = {
  spire: 'W01 W02 W03 W07 W09 W10 W19 W20 W21 W34 W35 W43 W44', skyyard: 'W04 W05 W06 W12 W15 W28 W30 W31 W32 W36 W37 W38 W39 W40', gantry: 'W13 W17 W23 W24 W25 W26 W27',
};
export const homeMap = (code) => Object.keys(HOME_MAPS).find((map) => HOME_MAPS[map].split(' ').includes(code));
const MAPS = ['spire', 'skyyard', 'gantry'];
const ABILITIES = 'A05 A06 A07 A08 A09 A10 A11 A12 A13 A14 A15 A16 A17 A18 A19 A20 A21 A22 A24 A25 A26 A27 A28 A29 A32 A33 A37 A38 A39 A40'.split(' ');
const PROFILES = { EP1: ['melee', 'shotgun'], EP2: ['smg', 'heavy'], EP3: ['rifle', 'sidearm', 'energy'], EP4: ['marksman', 'sniper'], EP5: ['explosive', 'exotic'] };
const GADGETS = { lethal: 'G01 G04 G06', tactical: 'G02 G03 G07 G08 G09 G20', device: 'G10 G13 G15 G18 G21 G22 G23 G24' };
const POWERUPS = 'PU01 PU02 PU03 PU04 PU05 PU06 PU09 PU10 PU11 PU12 PU13 PU14 PU15'.split(' ');
const OPEN = { timeLimit: 0, scoreLimit: 0 };
const SEEDS4 = [1, 2, 3, 4], SEEDS2 = [1, 2];
const GUN_SLOT = (code, classOf) => (classOf(code) === 'melee' ? 'melee' : classOf(code) === 'sidearm' ? 'secondary' : 'primary');
// Weapon classes by code (static copy of the roster so the plan builds without a browser; the page checks every code on use).
const CLASS_OF = {};
const ROSTER = { melee: 'W01 W02 W03', sidearm: 'W04 W05 W06 W07', smg: 'W09 W10 W12', rifle: 'W13 W15', energy: 'W17 W30 W36 W37 W38 W39', shotgun: 'W19 W20 W21', marksman: 'W23 W25 W26 W27',
  sniper: 'W24', heavy: 'W28 W35', explosive: 'W31 W32 W34 W40', exotic: 'W43 W44' };
for (const name in ROSTER) for (const code of ROSTER[name].split(' ')) CLASS_OF[code] = name;
const classOf = (code) => CLASS_OF[code];

const ffa = (map, extra) => Object.assign({ mode: 'ffa', map, ruleset: 'classic', minutes: 3, botCount: 12, modeOptions: OPEN }, extra);
const team = (extra) => Object.assign({ mode: 'tdm', map: 'harbor', ruleset: 'classic', minutes: 3, botCount: 10, modeOptions: OPEN }, extra);
const make = (id, family, wave, seeds, mirror, spec) => ({ id, family, wave, seeds, mirror, spec });
const gunSpec = (code, extra) => ({ forced: { [GUN_SLOT(code, classOf)]: code }, forcedCount: 3, ...extra });

export function buildPlan() {
  const cases = [];
  const add = (...args) => cases.push(make(...args));
  // F0 follow-ups
  [2, 3, 4].forEach((seed, i) => add('F0-0' + (i + 1), 'F0', 0, [seed], false, { mode: 'tdm', map: 'harbor', ruleset: 'classic', minutes: 3, botCount: 16, modeOptions: OPEN }));
  [2, 3, 4].forEach((seed, i) => add('F0-0' + (i + 4), 'F0', 0, [seed], false, { mode: 'tdm', map: 'harbor', ruleset: 'classic', minutes: 3, botCount: 16, modeOptions: OPEN, forced: { only: ['W01', 'W04'] }, forcedCount: 16 }));
  const w21 = gunSpec('W21', { map: 'spire' });
  add('F0-07', 'F0', 1, SEEDS4, false, ffa('spire', { ...gunSpec('W21'), overrides: { 'weapons.shardcaster.reload': 0.5 } }));
  add('F0-08', 'F0', 1, SEEDS4, false, ffa('spire', w21));
  const stakeBurn = { 'weapons.stakedriver.primary.statusRange': 25, 'weapons.stakedriver.primary.status': { id: 'burn', seconds: 3 } };
  add('F0-09', 'F0', 1, SEEDS4, false, ffa('gantry', { ...gunSpec('W26'), overrides: stakeBurn }));
  add('F0-10', 'F0', 1, SEEDS4, false, ffa('gantry', gunSpec('W26')));
  add('F0-11', 'F0', 1, SEEDS4, false, ffa('skyyard', gunSpec('W31')));
  add('F0-12', 'F0', 1, SEEDS4, false, ffa('skyyard', { ...gunSpec('W31'), overrides: { 'weapons.ramjet.mag': 6 } }));
  add('F0-13', 'F0', 0, [1], false, { probe: 'lob' });
  add('F0-14', 'F0', 1, SEEDS4, false, ffa('spire', { overrides: { 'items.healthpack.respawn': 35, 'items.lightplate.respawn': 25 } }));
  add('F0-15', 'F0', 1, SEEDS4, false, ffa('spire', {}));
  add('F0-16', 'F0', 1, SEEDS4, false, ffa('skyyard', { ruleset: 'tourney', overrides: { 'abilities.veilcombo.interrupt': null } }));
  add('F0-17', 'F0', 1, SEEDS4, false, ffa('skyyard', { ruleset: 'tourney' }));
  add('F0-18', 'F0', 1, SEEDS4, true, team({ ruleset: 'vanguard', forced: { ability1: 'A27' }, forcedCount: 3 }));
  add('F0-19', 'F0', 1, SEEDS4, true, team({ ruleset: 'modern', mutators: ['powers'], forced: { ability1: 'A27' }, forcedCount: 3 }));
  // F1 static
  for (let n = 1; n <= 7; n++) add('F1-S' + n, 'F1', 0, [1], false, { probe: 'static' + n });
  // F2 weapon OFAT, F2b bot skill
  for (const code of WEAPONS) {
    for (const map of MAPS) add(`F2-${code}-${map}`, 'F2', map === homeMap(code) ? 1 : 2, SEEDS4, false, ffa(map, gunSpec(code)));
    const home = homeMap(code);
    add(`F2b-${code}-T1`, 'F2b', 1, SEEDS4, false, ffa(home, { ...gunSpec(code), tier: 1 }));
    add(`F2b-${code}-T6`, 'F2b', 1, SEEDS4, false, ffa(home, { ...gunSpec(code), tier: 6 }));
  }
  // F3a weapon x extreme ruleset (RS03 one life, RS07 fast, RS02 extra jump, RS04 regen), F3b class x other ruleset, F3c class x X41
  const extreme = [['RS03', 'tactical', 1], ['RS07', 'ravager', 1], ['RS02', 'tourney', 2], ['RS04', 'modern', 2]];
  for (const code of WEAPONS) for (const [name, ruleset, wave] of extreme) add(`F3a-${code}-${name}`, 'F3a', wave, SEEDS4, false, ffa(homeMap(code), gunSpec(code, { ruleset })));
  const others = [['RS05', 'pilot'], ['RS06', 'vanguard'], ['RS08', 'knight'], ['RS10', 'royale'], ['RS11', 'suit'], ['RS12', 'frame']];
  for (const weaponClass of CLASSES) {
    for (const [name, ruleset] of others) add(`F3b-${weaponClass}-${name}`, 'F3b', 2, SEEDS4, false, ffa('skyyard', { ruleset, forcedPick: [weaponClass], forcedCount: 3 }));
    add(`F3c-${weaponClass}-X41`, 'F3c', 2, SEEDS4, false, ffa('skyyard', { forcedPick: [weaponClass], forcedCount: 3, mutators: ['ballistics'] }));
  }
  // F4 power weapons (the pads are on the maps: W45 on skyyard, W46 on gantry; spec.pads can still add one)
  add('F4-W45-skyyard', 'F4', 2, SEEDS4, false, ffa('skyyard', {}));
  add('F4-W46-gantry', 'F4', 2, SEEDS4, false, ffa('gantry', {}));
  // F5 gadgets (3 bots of side A, mirrored pairs on two seeds)
  for (const slot in GADGETS) for (const code of GADGETS[slot].split(' ')) {
    add(`F5-${code}-tdm`, 'F5', 2, SEEDS2, true, team({ forced: { [slot]: code }, forcedCount: 3 }));
    add(`F5-${code}-dom`, 'F5', 2, SEEDS2, true, { mode: 'dom', map: 'twinkeeps', ruleset: 'classic', minutes: 3, botCount: 10, modeOptions: OPEN, forced: { [slot]: code }, forcedCount: 3 });
  }
  // Controls: the same bots with nothing granted or forced beyond their own default (the carriers are always bots 0, 2, 4 of the seed's roster, so their
  // index and K/D are compared with these, not with 0.5 and 1)
  add('F5-CTRL-tdm', 'F5', 2, SEEDS2, true, team({ forced: { melee: 'W01' }, forcedCount: 3 }));
  add('F5-CTRL-dom', 'F5', 2, SEEDS2, true, { mode: 'dom', map: 'twinkeeps', ruleset: 'classic', minutes: 3, botCount: 10, modeOptions: OPEN, forced: { melee: 'W01' }, forcedCount: 3 });
  add('F6-CTRL', 'F6', 2, SEEDS4, false, ffa('skyyard', { grant: [], forcedCount: 3 }));
  add('F7-CTRL', 'F7', 2, SEEDS2, true, team({ ruleset: 'vanguard', forced: { melee: 'W02' }, forcedCount: 3 }));
  for (const profile in PROFILES) add('F8-CTRL-' + profile, 'F8', profile === 'EP1' || profile === 'EP4' ? 1 : 3, SEEDS2, true, team({ ruleset: 'vanguard', forcedPick: PROFILES[profile], forcedCount: 3 }));
  // F6 powerups
  for (const code of POWERUPS) add(`F6-${code}`, 'F6', 2, SEEDS4, false, ffa('skyyard', { grant: [code], forcedCount: 3 }));
  add('F6-PU18', 'F6', 2, SEEDS4, false, { mode: 'horde', map: 'cistern', ruleset: 'classic', minutes: 3, botCount: 4, modeOptions: OPEN, grant: ['PU18'], forcedCount: 2 });
  add('F6-PU19', 'F6', 2, SEEDS4, false, ffa('spire', { mode: 'bearer', grant: ['PU19'], forcedCount: 1 }));
  add('F6-PU20', 'F6', 2, SEEDS4, false, ffa('skyyard', { ruleset: 'ravager', grant: ['PU20'], forcedCount: 3 }));
  // F7 abilities OFAT
  for (const code of ABILITIES) add(`F7-${code}`, 'F7', 2, SEEDS2, true, team({ ruleset: 'vanguard', forced: { [code >= 'A37' ? 'ultimate' : 'ability1']: code }, forcedCount: 3 }));
  for (const code of ['A01', 'A02', 'A03', 'A04']) add(`F7-${code}`, 'F7', 2, SEEDS2, true, team({ ruleset: 'suit', forced: { ability1: code }, forcedCount: 3 }));
  for (const code of ['A05', 'A06', 'A08', 'A11', 'A14', 'A19', 'A20', 'A29', 'A35']) add(`F7-FR-${code}`, 'F7', 2, SEEDS2, true, team({ ruleset: 'frame', forced: { ability1: code }, forcedCount: 3 }));
  add('F7-A23', 'F7', 2, SEEDS4, false, { mode: 'horde', map: 'cistern', ruleset: 'classic', minutes: 3, botCount: 4, modeOptions: OPEN, forced: { ability1: 'A23' }, mutators: ['powers'], forcedCount: 2 });   // A23 is only in the Powers for All kit (X46)
  add('F7-A34', 'F7', 2, SEEDS4, false, { mode: 'horde', map: 'cistern', ruleset: 'classic', minutes: 3, botCount: 4, modeOptions: OPEN, forced: { ability1: 'A34' }, overrides: { 'abilities.wrath.cost': 20 }, forcedCount: 2 });   // Wrath is the automatic ultimate of the soul modes; 66 souls are not collected in 3 minutes (a bot gathers about 33 in 10), so the effect is measured with 20
  for (const [name, ruleset] of [['RS02', 'tourney'], ['RS04', 'modern'], ['RS05', 'pilot']]) add(`F7-M-${name}`, 'F7', 2, SEEDS2, true, team({ ruleset }));
  // F8 ability x engagement profile (EP1 and EP4 first)
  for (const code of ABILITIES) for (const profile in PROFILES) {
    const wave = profile === 'EP1' || profile === 'EP4' ? 1 : 3;
    add(`F8-${code}-${profile}`, 'F8', wave, SEEDS2, true, team({ ruleset: 'vanguard', forced: { [code >= 'A37' ? 'ultimate' : 'ability1']: code }, forcedPick: PROFILES[profile], forcedCount: 3 }));
  }
  // F9 heroes
  for (let n = 1; n <= 8; n++) add('F9-H0' + n, 'F9', 2, SEEDS2, true, team({ ruleset: 'heroes', forced: { hero: 'H0' + n }, forcedCount: 2 }));
  // F10 fairness (the mode's own limits)
  const full = (mode, map, extra) => Object.assign({ mode, map, ruleset: 'classic', minutes: 22, botCount: 10 }, extra);
  const symmetric = [['tdm', 'skyyard'], ['tdm', 'twinkeeps'], ['tdm', 'harbor'], ['ctf', 'twinkeeps'], ['oneflag', 'twinkeeps'], ['dom', 'twinkeeps'], ['dom', 'gantry'], ['hardpoint', 'harbor'],
    ['hardpoint', 'gantry'], ['conquest', 'convoyline'], ['control', 'harbor'], ['elim', 'dustline'], ['attrition', 'harbor']];
  for (const [mode, map] of symmetric) add(`F10-${mode}-${map}`, 'F10', 1, [1, 2, 3, 4, 5, 6, 7, 8], true, full(mode, map));
  const asymmetric = [['bomb', 'dustline'], ['ghostops', 'dustline'], ['rush', 'convoyline'], ['payload', 'convoyline'], ['infection', 'spire'], ['infection', 'gantry'], ['fiends', 'cistern'],
    ['juggernaut', 'skyyard'], ['cursetag', 'spire']];
  for (const [mode, map] of asymmetric) add(`F10-${mode}-${map}`, 'F10', 2, [1, 2, 3, 4, 5, 6, 7, 8], false, full(mode, map));
  const freeForAll = [['ffa', 'spire'], ['ffa', 'skyyard'], ['ffa', 'gantry'], ['duel', 'spire'], ['lms', 'gantry'], ['gungame', 'gantry'], ['roulette', 'spire'], ['oddball', 'gantry'], ['bearer', 'spire']];
  for (const [mode, map] of freeForAll) add(`F10-${mode}-${map}`, 'F10', 2, SEEDS4, false, full(mode, map, { botCount: mode === 'duel' ? 2 : 8 }));
  add('F10-horde-cistern-Regular', 'F10', 2, SEEDS4, false, full('horde', 'cistern', { botCount: 4, difficulty: 'regular', minutes: 30 }));
  add('F10-horde-cistern-Hard', 'F10', 2, SEEDS4, false, full('horde', 'cistern', { botCount: 4, difficulty: 'veteran', minutes: 30 }));
  add('F10-endless-cistern-Regular', 'F10', 2, SEEDS4, false, full('endless', 'cistern', { botCount: 4, difficulty: 'regular', minutes: 30 }));
  add('F10-bank-cistern', 'F10', 2, SEEDS4, false, full('bank', 'cistern', { botCount: 8 }));
  add('F10-royale-isle', 'F10', 2, SEEDS4, false, full('royale', 'isle', { botCount: 18, minutes: 20 }));
  const rulesets = ['classic', 'tourney', 'tactical', 'modern', 'pilot', 'vanguard', 'ravager', 'knight', 'heroes', 'royale', 'suit', 'frame'];
  rulesets.forEach((ruleset, i) => add('F10-RS' + String(i + 1).padStart(2, '0'), 'F10', 2, [1, 2, 3, 4], true, full('tdm', 'harbor', { ruleset: ruleset === 'royale' ? 'royale' : ruleset })));
  return cases;
}

// Every (case, seed, mirror) of the plan as a run: { key, case, family, wave, map, spec } (spec carries the seed and the mirror flag).
export function runsOf(cases) {
  const runs = [];
  for (const c of cases) {
    for (const seed of c.seeds) for (const mirror of c.mirror ? [false, true] : [false]) {
      runs.push({ key: `${c.id}|${seed}|${mirror ? 1 : 0}`, case: c.id, family: c.family, wave: c.wave, map: c.spec.map || '', spec: { ...c.spec, seed, mirror } });
    }
  }
  return runs;
}
