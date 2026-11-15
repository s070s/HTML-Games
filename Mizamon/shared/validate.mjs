// Validation of the data (reference section 13.6): the one engine the editor, the server, the Build and run-tests.mjs share.
// validateData(data) returns the findings { severity, tier, rule, kind, id, field, message: { en, el }, fix, waived }.
// kind is the kind of the entry that holds the problem (a key of KINDS), id the entry (for strings: the string key; '' for game and
// world), field a dotted path inside the entry ('' when none, e.g. 'rows[3]', 'mark', 'en').
// Tiers: 'integrity' (the game cannot run correctly: the Build stops) and 'content' (the strict test run fails on an unwaived finding;
// the lenient run only on a hard one). A waiver is `waive: [{ rule, note, date }]` in the entry (for strings: in the { el, en } object);
// it clears a content finding only, never an integrity error.
//
// Rules of 13.6 that DEV-02c cannot implement yet, because the data has nothing for them (no data is invented): replacement cycles and
// missing replacement targets (no replacements.json), audio limits (the sounds are synthesised notes, no clips), imported assets
// without a credits line (no imported assets), animation flashing (the animations are code), sprite references (the pictures are
// code), size limits, boss win-rate bands (the balance tests stay tests), the placeholders a context provides and the hospital's
// no-red rule (its palettes are code until DEV-07).
//
// The marker-text rule (13.2): no string anywhere in the data may contain a text that marks a place in the page. The data is
// inserted into the page script, and a marker inside it would make the page ambiguous for the assembler and the tests.
import { DATA_VERSION, KINDS, schemaProblems, walkWithSchema } from './schemas.mjs';
import {
  COPIED_ENGLISH_PHRASES, COPIED_GREEK_PHRASES, HOSPITAL_COPIED_ENGLISH, HOSPITAL_COPIED_GREEK, HOSPITAL_PATIENT_WORDS, MASCULINE_ONLY_FORMS, PARODY_CHARACTERS,
  PARODY_MARK, PARODY_PARTY_NAMES, denyListHit, plainText,
} from './content-rules.mjs';

// Every marker text of 13.2. A match anywhere in a string is refused, not only a whole line, because the text could end up on a
// line of its own after an edit of the page.
export const MARKER_TEXTS = Object.freeze(['// RULES-BEGIN', '// RULES-END', '/*DATA-BEGIN*/', '/*DATA-END*/', '/*@@']);
export const MARKER_TEXT_RULE = 'marker-text';

// ---- The rules --------------------------------------------------------------------------------------------------------------
const rule = (severity, tier, description, extra = {}) => Object.freeze({ severity, tier, ...extra, description });
export const VALIDATION_RULES = Object.freeze({
  // Errors of the integrity tier: the game cannot run correctly.
  schema: rule('error', 'integrity', 'An entry does not fit the schema of its kind (a wrong type, a missing or unknown field, a number out of range, an unknown event step).'),
  [MARKER_TEXT_RULE]: rule('error', 'integrity', 'A data string contains a text that marks a place in the page (13.2).'),
  'missing-reference': rule('error', 'integrity', 'A reference names an id that does not exist in its kind (species, move, item, map, trainer, sound, event, a team member, a warp target, an event step target).'),
  'missing-tile': rule('error', 'integrity', 'A map row holds a tile character that no tile defines.'),
  'missing-string-key': rule('error', 'integrity', 'A text key (a field, an event say step or a key derived from an id) is not a key of any strings group.'),
  'map-shape': rule('error', 'integrity', 'A map has a row count different from its height, or a row length different from its width.'),
  'warp-target': rule('error', 'integrity', 'A door leads outside the target map or onto a solid tile.'),
  'gate-flag-unset': rule('error', 'integrity', 'A door, person, trigger or place needs a flag that nothing sets.'),
  softlock: rule('error', 'integrity', 'The flag-aware flood fill from the start cannot reach a map that a built place or route lists.'),
  'placeholder-mismatch': rule('error', 'integrity', 'The {placeholders} of the Greek and the English text differ.'),
  'choice-syntax': rule('error', 'integrity', 'A {a|b} choice is broken: no "|", two "|", nested or unclosed braces.'),
  'type-mark-missing': rule('error', 'integrity', 'A type has no mark.'),
  'type-mark-shape': rule('error', 'integrity', 'A mark is not 5 rows of 5 characters "#" and ".".'),
  'type-mark-filled': rule('error', 'integrity', 'A mark has fewer than 7 filled pixels.'),
  'type-mark-similar': rule('error', 'integrity', 'Two marks differ in fewer than 6 of their 25 pixels.'),
  'type-mark-cross': rule('error', 'integrity', 'A mark is a plus-shaped cross or an x.'),
  'data-version': rule('error', 'integrity', 'game.json has a dataVersion newer than this code knows.'),
  // The one error of the content tier: it fails even in the lenient run unless waived.
  'real-person-or-brand': rule('error', 'content', 'A text names a real brand, person or party (the deny lists of 11.8); the marked parodies are allowed.', { hard: true }),
  'parody-placement': rule('error', 'content', 'A parody character\'s name is borne by something other than that character (a creature not marked as a parody, a trainer without it in the team, a move), or the parody party is named in a text that does not say it is a parody.', { hard: true }),
  // Warnings (content tier).
  'missing-english': rule('warning', 'content', 'The English text is empty (the game shows the Greek one).'),
  'masculine-only': rule('warning', 'content', 'A Greek text addresses the player with a form that only fits a man, outside a {man|woman} choice.'),
  'copied-phrase': rule('warning', 'content', 'A text copies a known line of another monster game.'),
  'hospital-words': rule('warning', 'content', 'A hospital text copies a known line, or jokes about patients or illness.'),
  'unused-entry': rule('warning', 'content', 'An entry of a kind where nothing uses it (certainly a mistake there).'),
  'unreachable-optional-place': rule('warning', 'content', 'A map that no built place or route needs cannot be reached either.'),
  'evolution-level': rule('warning', 'content', 'A creature evolves at a level below the levels at which it is met wild.'),
  // Info (content tier).
  'missing-tune': rule('info', 'content', 'A map names a tune that is not in the music of the data (the sound code plays nothing).'),
  'english-much-longer': rule('info', 'content', 'The English text is more than 2.5 times as long as the Greek one and longer than 40 characters.'),
});

// The flags that the engine code sets by itself (src/engine/09-overworld.js and 03-state.js): gotStarter (a new game, 03-state.js),
// credits (bossVictory of a boss whose victory has chapterCard) and ending (finale, after the credits roll). The engine also sets
// 't_' + the id of every trainer it wins against (challenge), the victory.flag of a boss (bossVictory) and the hideFlag of a legend
// creature it beat (legendEncounter); those are derived from the data below. The event step setFlag (runEventStep) is read from the events.
export const ENGINE_FLAGS = Object.freeze(['gotStarter', 'credits', 'ending']);
const FLAGS_AT_START = Object.freeze(['gotStarter']);

// The steps of the event runner (runEventStep in src/engine/09-overworld.js). A step outside this list stops an event with an error.
// `branches` names the step lists inside a step, `trainer`/`sound` the fields that name a trainer or a sound.
const EVENT_STEPS = Object.freeze({
  setFlag: {}, sfx: { sound: 'sounds' }, say: {}, spawn: {}, walk: {}, remove: {}, evolutions: {}, builtin: { trainer: 'trainers' },
  battle: { trainer: 'trainers', branches: ['onRan', 'onWin', 'onLose'] }, end: {},
});

// The seven marks of the types are 5 x 5 shapes of # and . (MZ-A11Y-01, the test of 12.4): a mark must not be a plus or an x.
const MARK_SIZE = 5;
const MARK_MIN_FILLED = 7;
const MARK_MIN_DIFFERENCE = 6;
const CROSS_MARKS = Object.freeze(['..#..|..#..|#####|..#..|..#..', '#...#|.#.#.|..#..|.#.#.|#...#', '.#.#.|#####|.#.#.|#####|.#.#.']);

const HOSPITAL_KEY_PATTERN = /^(hosp|arch|sign\.hosp|npc\.hosp)\./;
const HOSPITAL_EXTRA_KEYS = Object.freeze(['b.rec.archived', 'blackout.hospital', 'kep.comeBack', 'map.hospital', 'sign.hospital']);
const LONG_ENGLISH_FACTOR = 2.5;
const LONG_ENGLISH_MIN_LENGTH = 40;
const RIVAL_TEAM_NAMES = Object.freeze(['$rival', '$rivalEvo', '$rivalFinal']);
const TRAINER_WITHOUT_STRINGS = 'rival1'; // its texts are the rival1.* keys of the event
const NEIGHBOURS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);

// ---- Findings ---------------------------------------------------------------------------------------------------------------
function markerFinding(kind, id, field, marker) {
  return {
    severity: 'error',
    rule: MARKER_TEXT_RULE,
    kind,
    id,
    field,
    message: {
      en: `The text contains "${marker}", which marks a place in the page. Remove it.`,
      el: `Το κείμενο περιέχει «${marker}», που σημαδεύει θέση στη σελίδα. Αφαιρέστε το.`,
    },
  };
}

// The text of a key counts too: a key such as "/*@@" would be written into the page as well. path is a list of segments.
function scan(value, path, found) {
  if (typeof value === 'string') {
    for (const marker of MARKER_TEXTS) if (value.includes(marker)) found.push({ path, marker });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scan(item, [...path, `[${index}]`], found));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      for (const marker of MARKER_TEXTS) if (key.includes(marker)) found.push({ path: [...path, `{key ${JSON.stringify(key)}}`], marker });
      scan(item, [...path, key], found);
    }
  }
}

// data is the DATA object: { kind: { id: entry } } (game and world are the entries themselves). Returns the findings.
export function markerTextFindings(data) {
  return markerHits(data).map(({ kind, path, marker }) => {
    const [id = '', ...field] = path;
    return markerFinding(kind, id, field.join('.'), marker);
  });
}

function markerHits(data) {
  const hits = [];
  for (const [kind, kindValue] of Object.entries(data)) {
    const found = [];
    scan(kindValue, [], found);
    for (const { path, marker } of found) hits.push({ kind, path, marker });
  }
  return hits;
}

// Throws one error that names every place; used by the assembler.
export function assertNoMarkerTexts(data) {
  const findings = markerTextFindings(data);
  if (findings.length === 0) return;
  const places = findings.slice(0, 5).map((finding) => `${finding.kind}/${finding.id}${finding.field ? '.' + finding.field : ''}`);
  throw new Error(`a data string contains a marker text of the page: ${places.join('; ')}${findings.length > 5 ? ` (and ${findings.length - 5} more)` : ''}`);
}

// ---- Reading the data -------------------------------------------------------------------------------------------------------
const hasOwn = (object, key) => object !== null && typeof object === 'object' && Object.hasOwn(object, key);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string';
const trimPath = (path) => (path.startsWith('.') ? path.slice(1) : path);
const KIND_NAMES = Object.freeze({
  game: ['game setting', 'ρύθμιση'], types: ['type', 'τύπος'], statuses: ['status', 'κατάσταση'], abilities: ['ability', 'ικανότητα'], moves: ['move', 'κίνηση'],
  species: ['species', 'είδος'], items: ['item', 'αντικείμενο'], shops: ['shop', 'κατάστημα'], trainers: ['trainer', 'προπονητής'], tiles: ['tile', 'πλακίδιο'],
  maps: ['map', 'χάρτης'], world: ['world', 'κόσμος'], districts: ['district', 'περιοχή'], events: ['event', 'γεγονός'], strings: ['text', 'κείμενο'],
  sounds: ['sound', 'ήχος'], music: ['tune', 'μελωδία'], places: ['place', 'τόπος'],
});
const kindName = (kind) => KIND_NAMES[kind] ?? [kind, kind];

// The entries of a kind as [id, entry]; game and world are one entry with the id ''; the strings are listed apart (stringEntries).
function entriesOf(data, kind) {
  const value = data[kind];
  if (value === undefined || kind === 'strings') return [];
  if (KINDS[kind].storage === 'single') return [['', value]];
  return isObject(value) ? Object.entries(value) : [];
}

// Every text of the strings groups as { key, group, text } (text is the { el, en } object).
function stringEntries(data) {
  const entries = [];
  for (const [group, texts] of Object.entries(data.strings ?? {})) {
    if (!isObject(texts)) continue;
    for (const [key, text] of Object.entries(texts)) entries.push({ key, group, text });
  }
  return entries;
}

// The steps of an event, nested ones included, as visit(step, path).
function walkEventSteps(steps, visit, path = '') {
  if (!Array.isArray(steps)) return;
  steps.forEach((step, index) => {
    if (!isObject(step)) return;
    const here = `${path}[${index}]`;
    visit(step, here);
    for (const branch of EVENT_STEPS[step.step]?.branches ?? []) walkEventSteps(step[branch], visit, `${here}.${branch}`);
  });
}

// Everything the rules share, computed once per validateData: the references, the string keys, the tiles, the flags.
function readContext(data) {
  const context = { data, references: [], stringKeyUses: [], keys: new Set(), tiles: new Map(), stringIndex: new Map() };
  for (const { key, text } of stringEntries(data)) {
    context.keys.add(key);
    context.stringIndex.set(key, text);
  }
  for (const tile of Object.values(data.tiles ?? {})) if (isObject(tile) && isText(tile.char)) context.tiles.set(tile.char, tile);
  const addReference = (kind, id, field, target, value) => context.references.push({ kind, id, field, target, value });
  for (const kind of Object.keys(KINDS)) {
    for (const [id, entry] of entriesOf(data, kind)) {
      walkWithSchema(KINDS[kind].schema, entry, (node, value, path) => {
        if (!isText(value)) return;
        if (node.type === 'ref') addReference(kind, id, trimPath(path), node.ref, value);
        else if (node.type === 'stringKey') context.stringKeyUses.push({ kind, id, field: trimPath(path), key: value });
      });
    }
  }
  collectExtraReferences(data, addReference, context);
  return context;
}

// The references that the schema cannot mark: the team of a trainer, the ids used as dictionary keys, the places a route joins and
// the steps of the events.
function collectExtraReferences(data, addReference, context) {
  for (const [id, trainer] of entriesOf(data, 'trainers')) {
    (Array.isArray(trainer.team) ? trainer.team : []).forEach((member, index) => {
      if (isObject(member) && isText(member.sp) && !RIVAL_TEAM_NAMES.includes(member.sp)) addReference('trainers', id, `team[${index}].sp`, 'species', member.sp);
    });
  }
  const game = data.game ?? {};
  for (const item of Object.keys(game.startBag ?? {})) addReference('game', '', `startBag.${item}`, 'items', item);
  for (const species of Object.keys(game.rivalStarter ?? {})) addReference('game', '', `rivalStarter.${species}`, 'species', species);
  for (const map of Object.keys(game.battleThemes ?? {})) addReference('game', '', `battleThemes.${map}`, 'maps', map);
  const placeIds = new Set(Object.values(data.districts ?? {}).flatMap((district) => Object.keys(district?.places ?? {})));
  context.placeIds = placeIds;
  for (const [id, district] of entriesOf(data, 'districts')) {
    for (const [routeId, route] of Object.entries(district?.routes ?? {})) {
      for (const end of ['a', 'b']) if (isText(route?.[end]) && !placeIds.has(route[end])) addReference('districts', id, `routes.${routeId}.${end}`, 'places', route[end]);
    }
  }
  for (const [id, steps] of entriesOf(data, 'events')) {
    walkEventSteps(steps, (step, path) => {
      for (const [field, target] of Object.entries(EVENT_STEPS[step.step] ?? {})) {
        if (field !== 'branches' && isText(step[field])) addReference('events', id, `${path}.${field}`, target, step[field]);
      }
      if (step.step === 'say' && Array.isArray(step.keys)) step.keys.forEach((key, index) => isText(key) && context.stringKeyUses.push({ kind: 'events', id, field: `${path}.keys[${index}]`, key }));
    });
  }
}

const existsIn = (context, target, value) => (target === 'places' ? context.placeIds.has(value) : hasOwn(context.data[target], value));

// ---- Report -----------------------------------------------------------------------------------------------------------------
function makeReporter(findings) {
  return (ruleId, kind, id, field, en, el, fix = '') => {
    const { severity, tier } = VALIDATION_RULES[ruleId];
    findings.push({ severity, tier, rule: ruleId, kind, id, field, message: { en, el }, fix, waived: false });
  };
}

// ---- Integrity: the schema ---------------------------------------------------------------------------------------------------
function problemParts(problem) {
  const split = problem.indexOf(': ');
  return { field: trimPath(problem.slice(0, split)), text: problem.slice(split + 2) };
}

function checkSchema({ data }, report) {
  const reportProblems = (kind, id, problems) => {
    for (const problem of problems) {
      const { field, text } = problemParts(problem);
      report('schema', kind, id, field, `${field || 'The entry'}: ${text}.`, `${field || 'Η εγγραφή'}: δεν ταιριάζει στο σχήμα (${text}).`, 'Change the value so that it fits the schema.');
    }
  };
  for (const kind of Object.keys(KINDS)) {
    for (const [id, entry] of entriesOf(data, kind)) reportProblems(kind, id, schemaProblems(KINDS[kind].schema, entry, ''));
  }
  for (const [group, texts] of Object.entries(data.strings ?? {})) {
    if (!isObject(texts)) report('schema', 'strings', group, '', `The group ${group} must be an object of texts.`, `Η ομάδα ${group} πρέπει να είναι αντικείμενο κειμένων.`);
    else for (const [key, text] of Object.entries(texts)) reportProblems('strings', key, schemaProblems(KINDS.strings.schema.value, text, ''));
  }
  for (const [id, steps] of entriesOf(data, 'events')) {
    walkEventSteps(steps, (step, path) => {
      if (isText(step.step) && !hasOwn(EVENT_STEPS, step.step)) {
        report('schema', 'events', id, path, `${path}: the step "${step.step}" is not in the catalogue of steps.`, `${path}: το βήμα «${step.step}» δεν υπάρχει στον κατάλογο βημάτων.`, 'Use a step of the catalogue.');
      }
    });
  }
  if (isObject(data.game) && Number.isInteger(data.game.dataVersion) && data.game.dataVersion > DATA_VERSION) {
    report('data-version', 'game', '', 'dataVersion', `The data is version ${data.game.dataVersion}, newer than this code knows (version ${DATA_VERSION}).`, `Τα δεδομένα είναι έκδοσης ${data.game.dataVersion}, νεότερης από αυτήν που ξέρει ο κώδικας (έκδοση ${DATA_VERSION}).`, 'Update the code.');
  }
}

// In the findings of validateData the id is the entry: the string key for strings (the path is group, key, field ...), none for game and world.
function markerPlace(kind, path) {
  if (KINDS[kind]?.storage === 'single') return { id: '', field: path.join('.') };
  const skipped = kind === 'strings' && path.length > 1 ? 1 : 0;
  return { id: path[skipped] ?? '', field: path.slice(skipped + 1).join('.') };
}

function checkMarkerTexts({ data }, report) {
  for (const { kind, path, marker } of markerHits(data)) {
    const { id, field } = markerPlace(kind, path);
    const { message } = markerFinding(kind, id, field, marker);
    report(MARKER_TEXT_RULE, kind, id, field, message.en, message.el, 'Remove the marker text.');
  }
}

// ---- Integrity: references, tiles, string keys ----------------------------------------------------------------------------
function checkReferences(context, report) {
  for (const { kind, id, field, target, value } of context.references) {
    if (existsIn(context, target, value)) continue;
    const [en, el] = kindName(target);
    if (kind === 'maps' && target === 'music') continue; // reported as the info "missing-tune"
    report('missing-reference', kind, id, field, `The ${en} "${value}" does not exist.`, `Το ${el} «${value}» δεν υπάρχει.`, `Pick a ${en} that exists, or create it.`);
  }
  for (const [id, map] of entriesOf(context.data, 'maps')) {
    (Array.isArray(map.rows) ? map.rows : []).forEach((row, y) => {
      const unknown = isText(row) ? [...new Set([...row].filter((char) => !context.tiles.has(char)))] : [];
      if (unknown.length > 0) report('missing-tile', 'maps', id, `rows[${y}]`, `Row ${y} has the tile character ${unknown.map((char) => `"${char}"`).join(', ')}, which no tile defines.`, `Η γραμμή ${y} έχει τον χαρακτήρα ${unknown.map((char) => `«${char}»`).join(', ')}, που δεν ορίζεται από πλακίδιο.`, 'Define the tile or paint another one.');
    });
  }
}

// The keys the code asks for that are built from an id (the data part of the test "every key the code asks for exists").
function derivedKeys(data) {
  const keys = [];
  const add = (kind, id, key) => keys.push({ kind, id, field: '', key });
  for (const [id] of entriesOf(data, 'types')) add('types', id, `type.${id}`);
  for (const [id] of entriesOf(data, 'abilities')) { add('abilities', id, `ab.${id}`); add('abilities', id, `abd.${id}`); }
  for (const [id, status] of entriesOf(data, 'statuses')) {
    for (const key of [`st.${id}`, `st.${id}.short`, `b.st.${id}`]) add('statuses', id, key);
    if (status.turns > 0) add('statuses', id, `b.stend.${id}`);
  }
  for (const [id] of entriesOf(data, 'moves')) add('moves', id, `move.${id}`);
  for (const [id] of entriesOf(data, 'species')) add('species', id, `sp.${id}`);
  for (const [id] of entriesOf(data, 'items')) { add('items', id, `item.${id}`); add('items', id, `itemd.${id}`); }
  for (const [id] of entriesOf(data, 'trainers')) {
    if (id !== TRAINER_WITHOUT_STRINGS) for (const part of ['intro', 'win', 'after']) add('trainers', id, `tr.${id}.${part}`);
  }
  for (const [id, map] of entriesOf(data, 'maps')) {
    (Array.isArray(map.npcs) ? map.npcs : []).forEach((npc, index) => {
      if (npc?.kind !== 'legend') return;
      for (const part of ['intro', 'gone']) keys.push({ kind: 'maps', id, field: `npcs[${index}]`, key: `legend.${npc.species}.${part}` });
    });
  }
  return keys;
}

function checkStringKeys(context, report) {
  for (const { kind, id, field, key } of [...context.stringKeyUses, ...derivedKeys(context.data)]) {
    if (context.keys.has(key)) continue;
    report('missing-string-key', kind, id, field, `The text key "${key}" is not defined in any strings group.`, `Το κλειδί κειμένου «${key}» δεν ορίζεται σε καμία ομάδα κειμένων.`, 'Add the text, or name a key that exists.');
  }
}

// ---- Integrity: maps ---------------------------------------------------------------------------------------------------------
function tileBlocks(context, map, x, y) {
  const char = Array.isArray(map.rows) ? map.rows[y]?.[x] : undefined;
  const tile = context.tiles.get(char);
  return !tile || tile.solid === true || tile.counter === true;
}

function checkMapShape(context, report) {
  for (const [id, map] of entriesOf(context.data, 'maps')) {
    if (!Array.isArray(map.rows)) continue;
    if (map.rows.length !== map.h) report('map-shape', 'maps', id, 'rows', `The map has ${map.rows.length} rows but its height is ${map.h}.`, `Ο χάρτης έχει ${map.rows.length} γραμμές αλλά ύψος ${map.h}.`, 'Make the rows and the height agree.');
    map.rows.forEach((row, y) => {
      if (isText(row) && row.length !== map.w) report('map-shape', 'maps', id, `rows[${y}]`, `Row ${y} has ${row.length} characters but the width is ${map.w}.`, `Η γραμμή ${y} έχει ${row.length} χαρακτήρες αλλά το πλάτος είναι ${map.w}.`, 'Make the row as wide as the map.');
    });
  }
}

function checkWarpTargets(context, report) {
  const maps = context.data.maps ?? {};
  for (const [id, map] of entriesOf(context.data, 'maps')) {
    (Array.isArray(map.warps) ? map.warps : []).forEach((warp, index) => {
      const target = hasOwn(maps, warp.to) ? maps[warp.to] : null;
      if (!target || !Array.isArray(target.rows)) return; // a missing target is a missing reference
      const inside = warp.tx >= 0 && warp.ty >= 0 && warp.ty < target.rows.length && warp.tx < (target.rows[warp.ty]?.length ?? 0);
      const field = `warps[${index}]`;
      if (!inside) report('warp-target', 'maps', id, field, `The door leads to ${warp.tx},${warp.ty}, outside the map ${warp.to}.`, `Η πόρτα οδηγεί στο ${warp.tx},${warp.ty}, έξω από τον χάρτη ${warp.to}.`, 'Point the door at a tile inside the target map.');
      else if (context.tiles.get(target.rows[warp.ty][warp.tx])?.solid !== false) report('warp-target', 'maps', id, field, `The door leads to ${warp.tx},${warp.ty} on ${warp.to}, a solid tile.`, `Η πόρτα οδηγεί στο ${warp.tx},${warp.ty} του ${warp.to}, σε συμπαγές πλακίδιο.`, 'Point the door at a tile the player can stand on.');
    });
  }
}

// ---- Integrity: flags and the flood fill -------------------------------------------------------------------------------------
// Every flag that the steps of an event set (the steps of the branches too).
function eventFlags(steps) {
  const flags = [];
  walkEventSteps(steps, (step) => { if (step.step === 'setFlag' && isText(step.flag)) flags.push(step.flag); });
  return flags;
}

// What winning against a trainer sets: its t_ flag, the flag of its victory, and the flags credits and ending (09-overworld.js).
function trainerWinFlags(id, trainer) {
  const flags = [`t_${id}`];
  const victory = trainer?.victory;
  if (!victory) return flags;
  if (isText(victory.flag)) flags.push(victory.flag);
  if (victory.chapterCard) flags.push('credits');
  if (victory.credits) flags.push('ending');
  return flags;
}

function settableFlags(data) {
  const flags = new Set(ENGINE_FLAGS);
  for (const [id, trainer] of entriesOf(data, 'trainers')) for (const flag of trainerWinFlags(id, trainer)) flags.add(flag);
  for (const [, district] of entriesOf(data, 'districts')) if (isText(district.badgeFlag)) flags.add(district.badgeFlag);
  for (const [, steps] of entriesOf(data, 'events')) for (const flag of eventFlags(steps)) flags.add(flag);
  for (const [, map] of entriesOf(data, 'maps')) {
    for (const npc of Array.isArray(map.npcs) ? map.npcs : []) if (npc?.kind === 'legend' && isText(npc.hideFlag)) flags.add(npc.hideFlag); // legendEncounter
  }
  return flags;
}

function checkGateFlags(context, report) {
  const settable = settableFlags(context.data);
  const gate = (kind, id, field, flag, what) => {
    if (!isText(flag) || settable.has(flag)) return;
    report('gate-flag-unset', kind, id, field, `${what} needs the flag "${flag}", and nothing sets it.`, `${what} απαιτεί τη σημαία «${flag}», που δεν τη θέτει τίποτα.`, 'Set the flag in a victory, an event or a legend, or name a flag that is set.');
  };
  for (const [id, map] of entriesOf(context.data, 'maps')) {
    (map.warps ?? []).forEach((warp, index) => gate('maps', id, `warps[${index}].needFlag`, warp.needFlag, 'The door'));
    (map.npcs ?? []).forEach((npc, index) => {
      gate('maps', id, `npcs[${index}].showFlag`, npc.showFlag, `The person ${npc.id}`);
      gate('maps', id, `npcs[${index}].hideFlag`, npc.hideFlag, `The person ${npc.id}`);
    });
    (map.triggers ?? []).forEach((trigger, index) => gate('maps', id, `triggers[${index}].flag`, trigger.flag, 'The trigger'));
  }
  for (const [id, district] of entriesOf(context.data, 'districts')) {
    for (const [placeId, place] of Object.entries(district.places ?? {})) gate('districts', id, `places.${placeId}.seenFlag`, place.seenFlag, `The place ${placeId}`);
  }
}

// The flag-aware flood fill (13.6): the tiles the player can walk to from the start, through doors, with the flags that the places
// reached so far can set (beating a person, an event of a trigger, a legend). Repeated until no flag is new.
function reachableTiles(context) {
  const { data } = context;
  const maps = data.maps ?? {};
  const start = data.game?.startMap;
  const flags = new Set(FLAGS_AT_START);
  const warpIndex = new Map(Object.entries(maps).map(([id, map]) => [id, new Map((map.warps ?? []).map((warp) => [`${warp.x},${warp.y}`, warp]))]));
  const flood = () => {
    const reached = new Map();
    const queue = [];
    const visit = (mapId, x, y) => {
      if (!hasOwn(maps, mapId)) return;
      if (!reached.has(mapId)) reached.set(mapId, new Set());
      const key = `${x},${y}`;
      if (reached.get(mapId).has(key)) return;
      reached.get(mapId).add(key);
      queue.push([mapId, x, y]);
    };
    if (start) visit(start.map, start.x, start.y);
    while (queue.length > 0) {
      const [mapId, x, y] = queue.pop();
      for (const [dx, dy] of NEIGHBOURS) {
        const warp = warpIndex.get(mapId).get(`${x + dx},${y + dy}`);
        if (tileBlocks(context, maps[mapId], x + dx, y + dy) || (warp?.needFlag && !flags.has(warp.needFlag))) continue;
        visit(mapId, x + dx, y + dy);
        if (warp) visit(warp.to, warp.tx, warp.ty);
      }
    }
    return reached;
  };
  const talkable = (mapId, npc, tiles) => NEIGHBOURS.some(([dx, dy]) => {
    const near = [npc.x + dx, npc.y + dy];
    if (tiles.has(near.join(','))) return true;
    return context.tiles.get(maps[mapId].rows?.[near[1]]?.[near[0]])?.counter === true && tiles.has(`${near[0] + dx},${near[1] + dy}`);
  });
  const present = (npc) => (!npc.showFlag || flags.has(npc.showFlag)) && !(npc.hideFlag && flags.has(npc.hideFlag));
  for (;;) {
    const reached = flood();
    const before = flags.size;
    for (const [mapId, tiles] of reached) {
      for (const npc of maps[mapId].npcs ?? []) {
        if (!present(npc) || !talkable(mapId, npc, tiles)) continue;
        if (npc.trainer && hasOwn(data.trainers, npc.trainer)) trainerWinFlags(npc.trainer, data.trainers[npc.trainer]).forEach((flag) => flags.add(flag));
        if (npc.kind === 'legend' && isText(npc.hideFlag)) flags.add(npc.hideFlag);
      }
      for (const trigger of maps[mapId].triggers ?? []) {
        if (tiles.has(`${trigger.x},${trigger.y}`) && hasOwn(data.events, trigger.event)) eventFlags(data.events[trigger.event]).forEach((flag) => flags.add(flag));
      }
    }
    if (flags.size === before) return reached;
  }
}

function checkSoftlocks(context, report) {
  const { data } = context;
  if (!isObject(data.maps) || !isObject(data.game?.startMap)) return;
  const reached = reachableTiles(context);
  const needed = new Set();
  const lost = (id, field, mapId) => {
    needed.add(mapId);
    if (hasOwn(data.maps, mapId) && !reached.has(mapId)) report('softlock', 'districts', id, field, `The map ${mapId} cannot be reached from the start, although a built place or route needs it.`, `Ο χάρτης ${mapId} δεν μπορεί να προσεγγιστεί από την αρχή, αν και τον χρειάζεται τόπος ή διαδρομή που είναι έτοιμα.`, 'Open a way to it: a door, or a flag that something sets.');
  };
  for (const [id, district] of entriesOf(data, 'districts')) {
    for (const [placeId, place] of Object.entries(district.places ?? {})) {
      if (place.built) (place.maps ?? []).forEach((mapId, index) => lost(id, `places.${placeId}.maps[${index}]`, mapId));
    }
    for (const [routeId, route] of Object.entries(district.routes ?? {})) {
      if (route.built) lost(id, `routes.${routeId}.map`, route.map);
    }
  }
  for (const mapId of Object.keys(data.maps)) {
    const unlisted = !needed.has(mapId);
    if (unlisted && !reached.has(mapId)) report('unreachable-optional-place', 'maps', mapId, '', `The map ${mapId} cannot be reached and no built place or route needs it.`, `Ο χάρτης ${mapId} δεν μπορεί να προσεγγιστεί και κανένας έτοιμος τόπος ή διαδρομή δεν τον χρειάζεται.`, 'Add a door to it, or list it in a place.');
  }
}

// ---- Integrity: the marks of the types ---------------------------------------------------------------------------------------
const isMarkGrid = (mark) => Array.isArray(mark) && mark.length === MARK_SIZE && mark.every((row) => isText(row) && row.length === MARK_SIZE && /^[#.]+$/.test(row));

function checkTypeMarks({ data }, report) {
  const grids = [];
  for (const [id, type] of entriesOf(data, 'types')) {
    if (!Array.isArray(type.mark) || type.mark.length === 0) {
      report('type-mark-missing', 'types', id, 'mark', `The type ${id} has no mark.`, `Ο τύπος ${id} δεν έχει σήμα.`, 'Draw a 5 x 5 mark.');
      continue;
    }
    if (!isMarkGrid(type.mark)) {
      report('type-mark-shape', 'types', id, 'mark', `The mark of ${id} must be ${MARK_SIZE} rows of ${MARK_SIZE} characters "#" and ".".`, `Το σήμα του ${id} πρέπει να έχει ${MARK_SIZE} γραμμές των ${MARK_SIZE} χαρακτήρων «#» και «.».`, 'Redraw the mark.');
      continue;
    }
    const cells = type.mark.join('');
    const filled = cells.split('#').length - 1;
    if (filled < MARK_MIN_FILLED) report('type-mark-filled', 'types', id, 'mark', `The mark of ${id} has ${filled} filled pixels; it needs at least ${MARK_MIN_FILLED}.`, `Το σήμα του ${id} έχει ${filled} γεμάτα pixel· χρειάζονται τουλάχιστον ${MARK_MIN_FILLED}.`, 'Fill more pixels.');
    if (CROSS_MARKS.includes(type.mark.join('|'))) report('type-mark-cross', 'types', id, 'mark', `The mark of ${id} is a cross, a plus or an x.`, `Το σήμα του ${id} είναι σταυρός, συν ή χι.`, 'Draw another shape: a cross reads as a religious sign.');
    for (const other of grids) {
      const differing = [...cells].filter((cell, index) => cell !== other.cells[index]).length;
      if (differing < MARK_MIN_DIFFERENCE) report('type-mark-similar', 'types', id, 'mark', `The mark of ${id} differs from the mark of ${other.id} in only ${differing} pixels; it needs ${MARK_MIN_DIFFERENCE}.`, `Το σήμα του ${id} διαφέρει από το σήμα του ${other.id} μόνο σε ${differing} pixel· χρειάζονται ${MARK_MIN_DIFFERENCE}.`, 'Make the marks more different.');
    }
    grids.push({ id, cells });
  }
}

// ---- Integrity: the texts ----------------------------------------------------------------------------------------------------
const placeholdersOf = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');

// A {a|b} choice has exactly one "|"; a group of braces without one is a {placeholder}. Returns what is broken, or null.
export function choiceProblem(text) {
  let openAt = -1;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '{' && openAt !== -1) return 'braces are nested';
    if (char === '{') openAt = index;
    if (char === '}' && openAt === -1) return 'a "}" has no "{"';
    if (char !== '}') continue;
    const inside = text.slice(openAt + 1, index);
    openAt = -1;
    const bars = inside.split('|').length - 1;
    if (bars > 1) return 'a choice has more than one "|"';
    if (bars === 0 && !/^\w+$/.test(inside)) return 'a choice has no "|"';
  }
  return openAt === -1 ? null : 'a "{" is never closed';
}

function checkTexts({ data }, report) {
  for (const { key, text } of stringEntries(data)) {
    if (!isObject(text) || !isText(text.el) || !isText(text.en)) continue; // the schema reports it
    const bothPresent = text.el !== '' && text.en !== '';
    if (bothPresent && placeholdersOf(text.el) !== placeholdersOf(text.en)) {
      report('placeholder-mismatch', 'strings', key, 'en', `The placeholders differ: Greek {${placeholdersOf(text.el)}}, English {${placeholdersOf(text.en)}}.`, `Τα {σύμβολα θέσης} διαφέρουν: ελληνικά {${placeholdersOf(text.el)}}, αγγλικά {${placeholdersOf(text.en)}}.`, 'Use the same {placeholders} in both texts.');
    }
    for (const language of ['el', 'en']) {
      const problem = choiceProblem(text[language]);
      if (problem) report('choice-syntax', 'strings', key, language, `The choice is broken: ${problem}.`, `Η επιλογή είναι σπασμένη: ${problem}.`, 'Write choices as {one|other}.');
    }
  }
}

// ---- Content: the texts ------------------------------------------------------------------------------------------------------
const isHospitalKey = (key) => HOSPITAL_KEY_PATTERN.test(key) || HOSPITAL_EXTRA_KEYS.includes(key);
const firstMatch = (patterns, text) => patterns.find((pattern) => pattern.test(text));

function checkContentTexts({ data }, report) {
  for (const { key, text } of stringEntries(data)) {
    if (!isObject(text) || !isText(text.el) || !isText(text.en)) continue;
    if (text.en.trim() === '') report('missing-english', 'strings', key, 'en', 'The English text is empty; the game shows the Greek one.', 'Το αγγλικό κείμενο είναι άδειο· το παιχνίδι δείχνει το ελληνικό.', 'Write the English text.');
    const outsideChoices = text.el.replace(/\{[^{}|]*\|[^{}|]*\}/g, '');
    const masculine = outsideChoices.match(MASCULINE_ONLY_FORMS);
    if (masculine) report('masculine-only', 'strings', key, 'el', `The Greek text addresses the player with "${masculine[0]}", a form that only fits a man.`, `Το ελληνικό κείμενο απευθύνεται στον παίκτη με το «${masculine[0]}», τύπο που ταιριάζει μόνο σε άντρα.`, 'Put the form in a {man|woman} choice.');
    const copiedEnglish = firstMatch(COPIED_ENGLISH_PHRASES, text.en);
    if (copiedEnglish) report('copied-phrase', 'strings', key, 'en', `The English text copies a known line of another game (${copiedEnglish}).`, `Το αγγλικό κείμενο αντιγράφει γνωστή φράση άλλου παιχνιδιού (${copiedEnglish}).`, 'Word it in our own way.');
    const copiedGreek = firstMatch(COPIED_GREEK_PHRASES, text.el);
    if (copiedGreek) report('copied-phrase', 'strings', key, 'el', `The Greek text copies a known line of another game (${copiedGreek}).`, `Το ελληνικό κείμενο αντιγράφει γνωστή φράση άλλου παιχνιδιού (${copiedGreek}).`, 'Word it in our own way.');
    if (isHospitalKey(key)) checkHospitalText(key, text, report);
    if (text.en.length > LONG_ENGLISH_MIN_LENGTH && text.en.length > text.el.length * LONG_ENGLISH_FACTOR) {
      report('english-much-longer', 'strings', key, 'en', `The English text (${text.en.length} characters) is much longer than the Greek one (${text.el.length}).`, `Το αγγλικό κείμενο (${text.en.length} χαρακτήρες) είναι πολύ μακρύτερο από το ελληνικό (${text.el.length}).`, 'Check that both say the same.');
    }
  }
}

function checkHospitalText(key, text, report) {
  if (HOSPITAL_COPIED_ENGLISH.test(text.en)) report('hospital-words', 'strings', key, 'en', 'The hospital text copies a known line of another game.', 'Το κείμενο του νοσοκομείου αντιγράφει γνωστή φράση άλλου παιχνιδιού.', 'Word it in our own way.');
  if (HOSPITAL_COPIED_GREEK.test(text.el)) report('hospital-words', 'strings', key, 'el', 'The hospital text copies a known line of another game.', 'Το κείμενο του νοσοκομείου αντιγράφει γνωστή φράση άλλου παιχνιδιού.', 'Word it in our own way.');
  if (HOSPITAL_PATIENT_WORDS.test(text.el)) report('hospital-words', 'strings', key, 'el', 'The hospital text speaks of patients or illness; the jokes are about the system.', 'Το κείμενο του νοσοκομείου μιλά για ασθενείς ή ασθένεια· τα αστεία αφορούν το σύστημα.', 'Joke about the system, never about patients.');
}

// The texts the deny lists and the parody rule read: both languages of every string, and the names of species, trainers and moves.
function namedTexts(data) {
  const texts = [];
  for (const { key, text } of stringEntries(data)) {
    if (!isObject(text)) continue;
    for (const field of ['el', 'en']) if (isText(text[field])) texts.push({ kind: 'strings', id: key, field, text: text[field] });
  }
  for (const [id, species] of entriesOf(data, 'species')) if (isText(species.n)) texts.push({ kind: 'species', id, field: 'n', text: species.n });
  for (const [id, trainer] of entriesOf(data, 'trainers')) if (isText(trainer.name)) texts.push({ kind: 'trainers', id, field: 'name', text: trainer.name });
  for (const [id, move] of entriesOf(data, 'moves')) if (isText(move.n)) texts.push({ kind: 'moves', id, field: 'n', text: move.n });
  return texts;
}

function checkDenyLists({ data }, report) {
  for (const { kind, id, field, text } of namedTexts(data)) {
    const hit = denyListHit(text);
    if (hit) report('real-person-or-brand', kind, id, field, `The text names "${hit}", a real brand, person or party.`, `Το κείμενο αναφέρει το «${hit}», πραγματική επωνυμία, πρόσωπο ή κόμμα.`, 'Invent a name, or keep it with a waiver and a note.');
  }
}

// The parodies (13.6): a parody character's name is borne only by that character (a creature marked `parody`, or the trainer whose team has
// it) and by no move, and the parody party is only named in a text that says it is a parody.
const spellingIn = (text, spellings) => spellings.find((spelling) => plainText(text).includes(plainText(spelling)));
const isMarkedCreature = (data, speciesId) => hasOwn(data.species, speciesId) && data.species[speciesId].parody === true;

function checkParodyPlacement({ data }, report) {
  const misplaced = (kind, id, field, name, en, el, fix) => report('parody-placement', kind, id, field, `The name "${name}" ${en}`, `Το όνομα «${name}» ${el}`, fix);
  for (const spellings of PARODY_CHARACTERS) {
    for (const [id, species] of entriesOf(data, 'species')) {
      const name = isText(species.n) ? spellingIn(species.n, spellings) : undefined;
      if (name && species.parody !== true) misplaced('species', id, 'n', name, 'is a parody character\'s, and this creature is not one (it is not marked as a parody).', 'είναι χαρακτήρα παρωδίας, και αυτό το πλάσμα δεν είναι (δεν έχει σημανθεί ως παρωδία).', 'Give the creature another name.');
    }
    for (const [id, trainer] of entriesOf(data, 'trainers')) {
      const name = isText(trainer.name) ? spellingIn(trainer.name, spellings) : undefined;
      const team = Array.isArray(trainer.team) ? trainer.team : [];
      const hasCharacter = team.some((member) => isObject(member) && isMarkedCreature(data, member.sp) && isText(data.species[member.sp].n) && spellingIn(data.species[member.sp].n, spellings));
      if (name && !hasCharacter) misplaced('trainers', id, 'name', name, 'is a parody character\'s, and this trainer\'s team does not have that character.', 'είναι χαρακτήρα παρωδίας, και η ομάδα του προπονητή δεν έχει αυτόν τον χαρακτήρα.', 'Give the trainer another name.');
    }
    for (const [id, move] of entriesOf(data, 'moves')) {
      const name = isText(move.n) ? spellingIn(move.n, spellings) : undefined;
      if (name) misplaced('moves', id, 'n', name, 'is a parody character\'s, and a move cannot bear it.', 'είναι χαρακτήρα παρωδίας, και μια κίνηση δεν μπορεί να το φέρει.', 'Give the move another name.');
    }
  }
  for (const { kind, id, field, text } of namedTexts(data)) {
    const party = spellingIn(text, PARODY_PARTY_NAMES);
    if (party && !PARODY_MARK.test(plainText(text))) misplaced(kind, id, field, party, 'is the parody party, and this text does not say that it is a parody.', 'είναι το κόμμα παρωδίας, και αυτό το κείμενο δεν λέει ότι είναι παρωδία.', 'Add "(parody)" / "(παρωδία)" to the text.');
  }
}

// ---- Content: entries and levels ---------------------------------------------------------------------------------------------
// The kinds where an entry that nothing uses is certainly a mistake. Left out: shops (a map without a stock sells the default shop of the
// code), maps (the rule unreachable-optional-place), districts, strings (the keys the code names are not in the data).
function checkUnused(context, report) {
  const { data } = context;
  const used = {};
  for (const { target, value } of context.references) (used[target] ??= new Set()).add(value);
  const mapChars = new Set(Object.values(data.maps ?? {}).flatMap((map) => (Array.isArray(map.rows) ? map.rows.join('') : '').split('')));
  const tileIsUsed = (id) => mapChars.has(data.tiles[id]?.char);
  for (const kind of ['types', 'statuses', 'abilities', 'moves', 'species', 'items', 'trainers', 'tiles', 'events', 'sounds', 'music']) {
    for (const [id] of entriesOf(data, kind)) {
      if (kind === 'tiles' ? tileIsUsed(id) : used[kind]?.has(id)) continue;
      const [en, el] = kindName(kind);
      report('unused-entry', kind, id, '', `Nothing uses the ${en} "${id}".`, `Τίποτα δεν χρησιμοποιεί το ${el} «${id}».`, 'Use it, or delete it.');
    }
  }
}

// A creature that is met wild only above its own evolution level has already evolved when met.
function checkEvolutionLevels({ data }, report) {
  const lowest = new Map();
  for (const [, map] of entriesOf(data, 'maps')) {
    for (const zone of map.zones ?? []) for (const entry of zone.table ?? []) lowest.set(entry.sp, Math.min(lowest.get(entry.sp) ?? Infinity, entry.min));
  }
  for (const [id, species] of entriesOf(data, 'species')) {
    const metFrom = lowest.get(id);
    if (species.evo && metFrom !== undefined && species.evo.lv < metFrom) {
      report('evolution-level', 'species', id, 'evo.lv', `${id} evolves at level ${species.evo.lv} but is met wild from level ${metFrom}.`, `Το ${id} εξελίσσεται στο επίπεδο ${species.evo.lv} αλλά συναντιέται άγριο από το επίπεδο ${metFrom}.`, 'Raise the evolution level or lower the wild levels.');
    }
  }
}

// ---- Info --------------------------------------------------------------------------------------------------------------------
function checkTunes({ data }, report) {
  for (const [id, map] of entriesOf(data, 'maps')) {
    if (isText(map.music) && !hasOwn(data.music, map.music)) report('missing-tune', 'maps', id, 'music', `The map names the tune "${map.music}", which is not in the music; nothing plays.`, `Ο χάρτης αναφέρει τη μελωδία «${map.music}», που δεν υπάρχει· δεν παίζει τίποτα.`, 'Write the tune, or pick one that exists.');
  }
}

// ---- The engine ---------------------------------------------------------------------------------------------------------------
const CHECKS = Object.freeze([
  { rules: ['schema', 'data-version'], run: checkSchema },
  { rules: [MARKER_TEXT_RULE], run: checkMarkerTexts },
  { rules: ['missing-reference', 'missing-tile'], run: checkReferences },
  { rules: ['missing-string-key'], run: checkStringKeys },
  { rules: ['map-shape'], run: checkMapShape },
  { rules: ['warp-target'], run: checkWarpTargets },
  { rules: ['gate-flag-unset'], run: checkGateFlags },
  { rules: ['softlock', 'unreachable-optional-place'], run: checkSoftlocks },
  { rules: ['type-mark-missing', 'type-mark-shape', 'type-mark-filled', 'type-mark-similar', 'type-mark-cross'], run: checkTypeMarks },
  { rules: ['placeholder-mismatch', 'choice-syntax'], run: checkTexts },
  { rules: ['missing-english', 'masculine-only', 'copied-phrase', 'hospital-words', 'english-much-longer'], run: checkContentTexts },
  { rules: ['real-person-or-brand'], run: checkDenyLists },
  { rules: ['parody-placement'], run: checkParodyPlacement },
  { rules: ['unused-entry'], run: checkUnused },
  { rules: ['evolution-level'], run: checkEvolutionLevels },
  { rules: ['missing-tune'], run: checkTunes },
]);

function entryOf(context, kind, id) {
  if (kind === 'strings') return context.stringIndex.get(id);
  return KINDS[kind]?.storage === 'single' ? context.data[kind] : context.data[kind]?.[id];
}

// A content finding is waived when its entry holds a waiver for the rule; an integrity error never is.
function isWaived(context, finding) {
  if (finding.tier !== 'content') return false;
  const waivers = entryOf(context, finding.kind, finding.id)?.waive;
  return Array.isArray(waivers) && waivers.some((waiver) => waiver?.rule === finding.rule);
}

// data is the DATA object. options.rules (a list of rule ids) limits which rules run. Returns the findings.
export function validateData(data, options = {}) {
  const wanted = options.rules ? new Set(options.rules) : null;
  const context = readContext(data);
  const findings = [];
  const report = makeReporter(findings);
  for (const check of CHECKS) {
    if (!wanted || check.rules.some((ruleId) => wanted.has(ruleId))) check.run(context, report);
  }
  const selected = wanted ? findings.filter((finding) => wanted.has(finding.rule)) : findings;
  for (const finding of selected) finding.waived = isWaived(context, finding);
  return selected;
}
