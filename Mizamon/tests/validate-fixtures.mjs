// One fixture per validation rule (reference 13.6): `change(data)` breaks a deep copy of the real data in exactly the way its rule
// looks for, and `expect` names the finding the rule must give. The test of run-tests.mjs and `node Mizamon/tests/validate-fixtures.mjs
// --check` run every fixture: the untouched data has no error and no warning, and each changed copy has a finding with the fixture's
// rule, kind, id and field (the field may be a prefix). A fixture with `waived: true` has a waiver in the entry and the finding must be
// waived; a finding of any other fixture must not be (a waiver never clears an integrity error). A fixture with `clean: true` is a good
// case: its changed copy must have no finding of the rule at all.
// Node built-ins only.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readData } from '../shared/data-files.mjs';
import { VALIDATION_RULES, validateData } from '../shared/validate.mjs';

const WAIVER = { rule: 'real-person-or-brand', note: 'a fixture', date: '2026-11-15' };
const PLUS_MARK = ['..#..', '..#..', '#####', '..#..', '..#..'];

// The first tile of a map that the player cannot stand on (a solid tile), as [x, y].
function solidTileOf(data, mapId) {
  const solid = new Set(Object.values(data.tiles).filter((tile) => tile.solid).map((tile) => tile.char));
  const rows = data.maps[mapId].rows;
  for (let y = 0; y < rows.length; y++) {
    const x = [...rows[y]].findIndex((char) => solid.has(char));
    if (x >= 0) return [x, y];
  }
  throw new Error(`${mapId} has no solid tile`);
}

// A map that no door leads to and that no place lists.
function lonelyMap(data) {
  const map = structuredClone(data.maps.lab);
  map.warps = [];
  map.npcs = [];
  return map;
}

export const VALIDATION_FIXTURES = Object.freeze([
  { rule: 'schema', change: (data) => { data.species.komma.rec = 'often'; }, expect: { kind: 'species', id: 'komma', field: 'rec' } },
  { rule: 'schema', change: (data) => { data.events.rival1.push({ step: 'dance' }); }, expect: { kind: 'events', id: 'rival1', field: '[' } },
  { rule: 'marker-text', change: (data) => { data.strings.ui['ui.yes'].en = 'Yes /*@@'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'en' } },
  { rule: 'missing-reference', change: (data) => { data.maps.town.warps[0].to = 'nowhere'; }, expect: { kind: 'maps', id: 'town', field: 'warps[0].to' } },
  { rule: 'missing-reference', change: (data) => { data.trainers.kotsos.team[0].sp = 'nobody'; }, expect: { kind: 'trainers', id: 'kotsos', field: 'team[0].sp' } },
  { rule: 'missing-reference', change: (data) => { data.events.rival1[2].sound = 'nosound'; }, expect: { kind: 'events', id: 'rival1', field: '[2].sound' } },
  { rule: 'missing-tile', change: (data) => { data.maps.town.rows[0] = '§' + data.maps.town.rows[0].slice(1); }, expect: { kind: 'maps', id: 'town', field: 'rows[0]' } },
  { rule: 'missing-string-key', change: (data) => { data.maps.town.signs['5,7'] = 'sign.nowhere'; }, expect: { kind: 'maps', id: 'town', field: 'signs.5,7' } },
  { rule: 'missing-string-key', change: (data) => { delete data.strings.type['type.pol']; }, expect: { kind: 'types', id: 'pol', field: '' } },
  { rule: 'missing-string-key', change: (data) => { data.events.rival1[4].keys[0] = 'rival1.nowhere'; }, expect: { kind: 'events', id: 'rival1', field: '[4].keys[0]' } },
  { rule: 'map-shape', change: (data) => { data.maps.town.rows.pop(); }, expect: { kind: 'maps', id: 'town', field: 'rows' } },
  { rule: 'map-shape', change: (data) => { data.maps.town.rows[1] += 'T'; }, expect: { kind: 'maps', id: 'town', field: 'rows[1]' } },
  {
    rule: 'warp-target',
    change: (data) => { [data.maps.town.warps[0].tx, data.maps.town.warps[0].ty] = solidTileOf(data, 'lab'); },
    expect: { kind: 'maps', id: 'town', field: 'warps[0]' },
  },
  { rule: 'warp-target', change: (data) => { data.maps.town.warps[0].tx = 99; }, expect: { kind: 'maps', id: 'town', field: 'warps[0]' } },
  { rule: 'gate-flag-unset', change: (data) => { data.maps.town.warps[0].needFlag = 'never_set'; }, expect: { kind: 'maps', id: 'town', field: 'warps[0].needFlag' } },
  { rule: 'gate-flag-unset', change: (data) => { data.districts.peiraias.places.harbourOffice.seenFlag = 'never_set'; }, expect: { kind: 'districts', id: 'peiraias', field: 'places.harbourOffice.seenFlag' } },
  {
    rule: 'softlock',
    change: (data) => {
      data.maps.island = lonelyMap(data);
      data.districts.peiraias.places.newPeiraias.maps.push('island');
    },
    expect: { kind: 'districts', id: 'peiraias', field: 'places.newPeiraias.maps[7]' },
  },
  {
    // the harbour office opens only with the flag that its own boss sets: a flag that is set, but not before the door
    rule: 'softlock',
    change: (data) => { data.maps.route1.warps.find((warp) => warp.to === 'port').needFlag = 'badge'; },
    expect: { kind: 'districts', id: 'peiraias', field: 'places.harbourOffice.maps[0]' },
  },
  { rule: 'placeholder-mismatch', change: (data) => { data.strings.ui['ui.yes'].en = 'Yes {name}'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'en' } },
  { rule: 'choice-syntax', change: (data) => { data.strings.ui['ui.yes'].el = 'Ναι {α|β|γ}'; data.strings.ui['ui.yes'].en = 'Yes {a|b|c}'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'el' } },
  { rule: 'choice-syntax', change: (data) => { data.strings.ui['ui.yes'].el = 'Ναι {ος'; data.strings.ui['ui.yes'].en = 'Yes {{a}}'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'en' } },
  { rule: 'type-mark-missing', change: (data) => { delete data.types.pol.mark; }, expect: { kind: 'types', id: 'pol', field: 'mark' } },
  { rule: 'type-mark-shape', change: (data) => { data.types.pol.mark = ['###', '###']; }, expect: { kind: 'types', id: 'pol', field: 'mark' } },
  { rule: 'type-mark-filled', change: (data) => { data.types.pol.mark = ['.....', '.....', '.###.', '.....', '.....']; }, expect: { kind: 'types', id: 'pol', field: 'mark' } },
  {
    rule: 'type-mark-similar',
    change: (data) => { data.types.asf.mark = [...data.types.pol.mark]; data.types.asf.mark[0] = '.##..'; },
    expect: { kind: 'types', id: 'asf', field: 'mark' },
  },
  { rule: 'type-mark-cross', change: (data) => { data.types.cel.mark = [...PLUS_MARK]; }, expect: { kind: 'types', id: 'cel', field: 'mark' } },
  { rule: 'data-version', change: (data) => { data.game.dataVersion = 99; }, expect: { kind: 'game', id: '', field: 'dataVersion' } },
  { rule: 'real-person-or-brand', change: (data) => { data.strings.ui['ui.yes'].el = 'Ο Μητσοτάκης λέει ναι'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'el' } },
  { rule: 'real-person-or-brand', change: (data) => { data.strings.ui['ui.yes'].en = 'Yes, says Google'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'en' } },
  { rule: 'real-person-or-brand', change: (data) => { data.species.komma.n = 'Starbucks'; }, expect: { kind: 'species', id: 'komma', field: 'n' } },
  { rule: 'real-person-or-brand', change: (data) => { data.trainers.kotsos.name = 'Ο Τσίπρας'; }, expect: { kind: 'trainers', id: 'kotsos', field: 'name' } },
  { rule: 'real-person-or-brand', change: (data) => { data.moves.psifodeltio.n = 'Airbnb'; }, expect: { kind: 'moves', id: 'psifodeltio', field: 'n' } },
  {
    rule: 'real-person-or-brand',
    waived: true,
    change: (data) => { data.strings.ui['ui.yes'].el = 'Ο Μητσοτάκης λέει ναι'; data.strings.ui['ui.yes'].waive = [WAIVER]; },
    expect: { kind: 'strings', id: 'ui.yes', field: 'el' },
  },
  {
    rule: 'real-person-or-brand',
    waived: true,
    change: (data) => { data.species.komma.n = 'Starbucks'; data.species.komma.waive = [WAIVER]; },
    expect: { kind: 'species', id: 'komma', field: 'n' },
  },
  {
    rule: 'missing-reference',
    waived: false, // a waiver never clears an integrity error
    change: (data) => { data.maps.town.warps[0].to = 'nowhere'; data.maps.town.waive = [{ ...WAIVER, rule: 'missing-reference' }]; },
    expect: { kind: 'maps', id: 'town', field: 'warps[0].to' },
  },
  { rule: 'parody-placement', change: (data) => { data.species.komma.n = 'Μιζοτάκης'; }, expect: { kind: 'species', id: 'komma', field: 'n' } },
  { rule: 'parody-placement', change: (data) => { data.trainers.kotsos.name = 'Ο Σπυράδωνις'; }, expect: { kind: 'trainers', id: 'kotsos', field: 'name' } },
  { rule: 'parody-placement', change: (data) => { data.moves.psifodeltio.n = 'Spyradonis'; }, expect: { kind: 'moves', id: 'psifodeltio', field: 'n' } },
  { rule: 'parody-placement', change: (data) => { data.strings.ui['ui.yes'].en = 'New Democratorship says yes'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'en' } },
  { rule: 'parody-placement', change: (data) => { data.strings.ui['ui.yes'].el = 'Νέα Δημοκτατορία λέει ναι'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'el' } },
  {
    // good: a creature marked as a parody bears the name, the trainer that has the character in the team bears it, the party is marked as a parody
    rule: 'parody-placement',
    clean: true,
    change: (data) => {
      data.species.komma.n = 'Μιζοτάκης';
      data.species.komma.parody = true;
      data.trainers.kotsos.name = 'Ο Σπυράδωνις';
      data.trainers.kotsos.team[0].sp = 'spyradonis';
      data.strings.ui['ui.yes'].el = 'Νέα Δημοκτατορία (παρωδία)';
      data.strings.ui['ui.yes'].en = 'New Democratorship (a parody)';
    },
    expect: { kind: 'species', id: 'komma', field: 'n' },
  },
  { rule: 'missing-english', change: (data) => { data.strings.ui['ui.yes'].en = ''; }, expect: { kind: 'strings', id: 'ui.yes', field: 'en' } },
  { rule: 'masculine-only', change: (data) => { data.strings.ui['ui.yes'].el = 'Είσαι έτοιμος;'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'el' } },
  { rule: 'copied-phrase', change: (data) => { data.strings.ui['ui.yes'].en = 'What will you do?'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'en' } },
  { rule: 'copied-phrase', change: (data) => { data.strings.ui['ui.yes'].el = 'Συγχαρητήρια!'; data.strings.ui['ui.yes'].en = 'Well done!'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'el' } },
  { rule: 'hospital-words', change: (data) => { data.strings.hosp['hosp.hello'].el = 'Για ασθενείς μόνο.'; }, expect: { kind: 'strings', id: 'hosp.hello', field: 'el' } },
  { rule: 'hospital-words', change: (data) => { data.strings.hosp['hosp.hello'].en = 'Welcome to our centre.'; }, expect: { kind: 'strings', id: 'hosp.hello', field: 'en' } },
  { rule: 'unused-entry', change: (data) => { data.moves.spare = structuredClone(data.moves.psifodeltio); }, expect: { kind: 'moves', id: 'spare', field: '' } },
  { rule: 'unused-entry', change: (data) => { data.events.spare = []; }, expect: { kind: 'events', id: 'spare', field: '' } },
  { rule: 'unreachable-optional-place', change: (data) => { data.maps.attic = lonelyMap(data); }, expect: { kind: 'maps', id: 'attic', field: '' } },
  { rule: 'evolution-level', change: (data) => { data.species.fakelakis.evo.lv = 1; }, expect: { kind: 'species', id: 'fakelakis', field: 'evo.lv' } },
  { rule: 'missing-tune', change: (data) => { data.maps.town.music = 'silence'; }, expect: { kind: 'maps', id: 'town', field: 'music' } },
  { rule: 'english-much-longer', change: (data) => { data.strings.ui['ui.yes'].en = 'Yes, and that is a very long way of saying it, much longer than needed'; }, expect: { kind: 'strings', id: 'ui.yes', field: 'en' } },
]);

// ---- The self-check: node Mizamon/tests/validate-fixtures.mjs --check ----------------------------------------------------------
function failures(data) {
  const problems = []; // { rule, text }
  const add = (rule, text) => problems.push({ rule, text });
  for (const finding of validateData(data).filter((item) => item.severity !== 'info')) {
    add(finding.rule, `the real data has ${finding.severity} ${finding.rule} at ${finding.kind}/${finding.id} ${finding.field}: ${finding.message.en}`);
  }
  for (const ruleId of Object.keys(VALIDATION_RULES)) {
    if (!VALIDATION_FIXTURES.some((fixture) => fixture.rule === ruleId)) add(ruleId, `no fixture for the rule ${ruleId}`);
  }
  VALIDATION_FIXTURES.forEach((fixture, index) => {
    const label = `fixture ${index + 1} (${fixture.rule}${fixture.waived ? ', waived' : ''})`;
    if (!Object.hasOwn(VALIDATION_RULES, fixture.rule)) { add(fixture.rule, `${label}: unknown rule`); return; }
    const copy = structuredClone(data);
    fixture.change(copy);
    if (fixture.clean) {
      const wrong = validateData(copy).find((finding) => finding.rule === fixture.rule);
      if (wrong) add(fixture.rule, `${label}: a good case has the finding ${wrong.kind}/${wrong.id} ${wrong.field}`);
      return;
    }
    const { kind, id, field } = fixture.expect;
    const found = validateData(copy).find((finding) => finding.rule === fixture.rule && finding.kind === kind && finding.id === id && (field === undefined || finding.field.startsWith(field)));
    if (!found) add(fixture.rule, `${label}: no finding at ${kind}/${id} ${field ?? ''}`);
    else if (found.waived !== (fixture.waived === true)) add(fixture.rule, `${label}: waived is ${found.waived}`);
  });
  return problems;
}

function runCheck() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const { data } = readData(root);
  const problems = failures(data);
  for (const ruleId of Object.keys(VALIDATION_RULES)) {
    const count = VALIDATION_FIXTURES.filter((fixture) => fixture.rule === ruleId).length;
    console.log(`${problems.some((problem) => problem.rule === ruleId) ? 'FAIL' : 'ok  '} ${ruleId} (${count} fixtures)`);
  }
  for (const problem of problems) console.log(`  ${problem.text}`);
  if (problems.length > 0) process.exit(1);
  console.log(`OK ${Object.keys(VALIDATION_RULES).length} rules, ${VALIDATION_FIXTURES.length} fixtures`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--check')) runCheck();
