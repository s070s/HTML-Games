// ==== S13 RULES / MODES ====
// Rules.build turns a match setup into the frozen ruleset Game.match.rules, in the MOV-001 order:
// mode defaults -> ruleset bundle (or a custom ruleset) -> mutators -> difficulty -> per-actor handicap.
// Later sections fill stages with Rules.addModifier(stage, fn(rules, setup)); a modifier sees every earlier stage's values.

const RULE_STAGES = ['mode', 'bundle', 'mutators', 'difficulty', 'handicap'];
const DEFAULT_MODE = 'ffa';
const DEFAULT_DIFFICULTY = 'regular';
const MAX_CUSTOM_RULESETS = 50;          // MOV-002
const CUSTOM_RULESET_PREFIX = 'custom-';
const HANDICAP_MIN = 0.25;               // X22: 25-100% damage dealt
const HANDICAP_MAX = 1;
const PRECISIONS = ['arena', 'standard', 'tactical', 'hero'];
const METERS = ['none', 'streak', 'boost', 'adrenaline', 'ultimate', 'energy'];
const DROP_RULES = ['none', 'held', 'all'];
// Ruleset fields naming a row of another catalogue: checked whenever that catalogue exists at build time.
const RULE_REFERENCES = { move: 'movement', health: 'health', economy: 'economy', weaponSet: 'weaponSets' };
// Mode row fields copied into the built ruleset; a custom match may change them through setup.modeOptions.
// The mode's respawn kind lands in rules.respawnMode (rules.respawn holds the ruleset timers).
const MODE_RULE_FIELDS = ['teams', 'sizeDefault', 'scoreLimit', 'timeLimit', 'scoreBy', 'rounds', 'objective', 'params', 'tiebreak', 'family'];
const MODE_OPTION_FIELDS = MODE_RULE_FIELDS.concat(['respawnMode']);
const RULE_IDENTITY_FIELDS = ['id', 'code', 'name', 'editor'];   // identity is set by the bundle stage itself; editor settings are not rules; never merged

const Rules = {
  modifiers: { mode: [], bundle: [], mutators: [], difficulty: [], handicap: [] },
  stagesRun: [],      // stage names in the order the last build ran them (self-test of the build order)
  problems: [],       // validation messages of the last build (each one is also logged)

  addModifier(stage, modify) {
    if (!this.modifiers[stage]) throw new Error('unknown rule stage ' + stage);
    this.modifiers[stage].push(modify);
  },
  removeModifier(stage, modify) {
    const list = this.modifiers[stage] || [];
    const index = list.indexOf(modify);
    if (index >= 0) list.splice(index, 1);
  },
  build(setup) {
    const rules = this.schemaDefaults();
    this.stagesRun.length = 0;
    this.problems.length = 0;
    for (const stage of RULE_STAGES) {
      RULE_STAGE_STEPS[stage](rules, setup);
      for (const modify of this.modifiers[stage]) modify(rules, setup);
      this.stagesRun.push(stage);
    }
    this.validate(rules);
    return deepFreeze(rules);
  },
  // Fresh copy of every ruleset schema default (REQUIRED fields are filled by the bundle stage).
  schemaDefaults() {
    const schema = Data.schemas.rulesets, rules = {};
    for (const field in schema) if (schema[field] !== REQUIRED) rules[field] = copyRuleValue(schema[field]);
    return rules;
  },
  // A bundle id, a saved custom ruleset id, or a ruleset object -> the fields that ruleset writes (or null).
  resolveRuleset(choice) {
    if (choice && typeof choice === 'object') return choice;
    const bundle = RULESET_ROWS.find((row) => row.id === choice);
    return bundle || this.custom.get(choice);
  },
  validate(rules) {
    if (!CAT.modes.byId(rules.mode)) this.report('unknown mode ' + rules.mode);
    for (const field in RULE_REFERENCES) {
      const catalogue = CAT[RULE_REFERENCES[field]];
      if (catalogue && rules[field] && !catalogue.byId(rules[field])) this.report('ruleset ' + rules.id + ': unknown ' + field + ' ' + rules[field]);
    }
    if (!PRECISIONS.includes(rules.precision)) this.report('ruleset ' + rules.id + ': unknown precision ' + rules.precision);
    if (!METERS.includes(rules.meter)) this.report('ruleset ' + rules.id + ': unknown meter ' + rules.meter);
    if (!DROP_RULES.includes(rules.dropOnDeath)) this.report('ruleset ' + rules.id + ': unknown dropOnDeath ' + rules.dropOnDeath);
  },
  report(text) {
    this.problems.push(text);
    ErrorLog.add('rules', text);
  },

  // Saved custom rulesets (MOV-002) live in Save.data.rulesets as plain objects with an id 'custom-N'.
  custom: {
    lastError: '',
    list() { return Save.data ? Save.data.rulesets : []; },
    get(id) { return this.list().find((row) => row.id === id) || null; },
    // Stores a copy of the known ruleset fields; returns the stored row, or null with lastError set.
    save(ruleset) {
      const name = cleanLabel(ruleset && ruleset.name || '', LABEL_MAX);
      if (!name) return this.fail('A custom ruleset needs a name.');
      const list = this.list();
      const existing = ruleset.id ? list.findIndex((row) => row.id === ruleset.id) : -1;
      if (existing < 0 && list.length >= MAX_CUSTOM_RULESETS) return this.fail('You can keep up to ' + MAX_CUSTOM_RULESETS + ' custom rulesets.');
      const stored = pickRulesetFields(ruleset);
      stored.name = name;
      stored.id = existing >= 0 ? list[existing].id : this.nextId();
      if (existing >= 0) list[existing] = stored; else list.push(stored);
      Save.scheduleSave();
      this.lastError = '';
      return stored;
    },
    remove(id) {
      const list = this.list(), index = list.findIndex((row) => row.id === id);
      if (index < 0) return false;
      list.splice(index, 1);
      Save.scheduleSave();
      return true;
    },
    nextId() {
      let highest = 0;
      for (const row of this.list()) highest = Math.max(highest, Number(String(row.id).slice(CUSTOM_RULESET_PREFIX.length)) || 0);
      return CUSTOM_RULESET_PREFIX + (highest + 1);
    },
    fail(text) { this.lastError = text; return null; },
  },
};

// Built-in part of each stage; the registered modifiers of the same stage run right after it.
const RULE_STAGE_STEPS = {
  mode(rules, setup) {
    let mode = CAT.modes.byId(setup.mode || DEFAULT_MODE);
    if (!mode) { Rules.report('unknown mode ' + setup.mode + ', using ' + DEFAULT_MODE); mode = CAT.modes.byId(DEFAULT_MODE); }
    rules.mode = mode.id;
    for (const field of MODE_RULE_FIELDS) rules[field] = copyRuleValue(mode[field]);
    rules.respawnMode = mode.respawn;
    rules.scoring = Object.assign({}, MODE_SCORING, mode.scoring);
    applyFields(rules, setup.modeOptions || {}, MODE_OPTION_FIELDS);
    applyFields(rules, mode.rules, null);
  },
  bundle(rules, setup) {
    const mode = CAT.modes.byId(rules.mode);
    let ruleset = Rules.resolveRuleset(setup.ruleset || mode.ruleset);
    if (!ruleset) { Rules.report('unknown ruleset ' + setup.ruleset + ', using ' + mode.ruleset); ruleset = Rules.resolveRuleset(mode.ruleset); }
    applyFields(rules, ruleset, null);
    rules.id = ruleset.id || 'custom';
    rules.code = ruleset.code || '';
    rules.name = ruleset.name || 'Custom';
  },
  mutators(rules, setup) {
    const chosen = (setup.mutators || []).map((entry) => (typeof entry === 'string' ? { id: entry, value: true } : { id: entry.id, value: entry.value }));
    rules.mutators = rules.mutators.concat(chosen);
  },
  difficulty(rules, setup) {
    rules.difficulty = setup.difficulty || DEFAULT_DIFFICULTY;
  },
  // Handicap per participant in setup order: the player first (when present), then setup.bots.
  handicap(rules, setup) {
    const bots = setup.bots || [];
    rules.handicap = { player: clampHandicap(setup.player && setup.player.handicap), bots: bots.map((bot) => clampHandicap(bot && bot.handicap)) };
  },
};

// Copies the fields of source into rules; objects merge one level deep (respawn: { delay } keeps forced/protect/wave).
// allowed: list of field names to accept, or null for "any ruleset field".
function applyFields(rules, source, allowed) {
  const schema = Data.schemas.rulesets;
  for (const field in source) {
    if (RULE_IDENTITY_FIELDS.includes(field)) continue;
    const known = allowed ? allowed.includes(field) : field in schema;
    if (!known) { Rules.report('unknown ruleset field ' + field); continue; }
    rules[field] = mergeRuleValue(rules[field], source[field]);
  }
}

function mergeRuleValue(current, incoming) {
  const bothObjects = isPlainObject(current) && isPlainObject(incoming);
  return bothObjects ? Object.assign({}, current, incoming) : copyRuleValue(incoming);
}

function copyRuleValue(value) {
  if (Array.isArray(value)) return value.map(copyRuleValue);
  if (!isPlainObject(value)) return value;
  const copy = {};
  for (const key in value) copy[key] = copyRuleValue(value[key]);
  return copy;
}

function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function pickRulesetFields(source) {
  const picked = {};
  for (const field in Data.schemas.rulesets) if (source[field] !== undefined) picked[field] = copyRuleValue(source[field]);
  return picked;
}

function clampHandicap(value) { return typeof value === 'number' ? clamp(value, HANDICAP_MIN, HANDICAP_MAX) : HANDICAP_MAX; }

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key in value) deepFreeze(value[key]);
  return value;
}

Bus.on('match.setup', (match) => { match.rules = Rules.build(match.setup); });
