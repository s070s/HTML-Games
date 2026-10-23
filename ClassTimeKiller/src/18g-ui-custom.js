// ==== S18 UI: CUSTOM MATCH EDITOR ====
// Custom match (MUT-001): one screen with tabs Mode, Rules, Weapons, Bots, Mutators, Map; every field has a reset and the last
// settings are remembered. Saved presets live in Save.data.rulesets through Rules.custom (MOV-002, max 50); a preset can be shared
// as a text code (MUT-004: version + checksum + compressed JSON, copy and paste only). The 12 rule bundles RS01..RS12 start with one click.
// The pure model (CustomCodec, CustomMatch) has no DOM and is what the self-test drives; the screens below it only call the model.
// Contract: docs/api/mutators-custom.md.

const EDITOR_CODE_PREFIX = 'CTK';
const EDITOR_CODE_VERSION = 1;
const EDITOR_CODE_MAX_CHARS = 6000;
const EDITOR_PAYLOAD_MAX_BYTES = 16384;
const EDITOR_DEFAULT = -1;                    // numeric fields: -1 = the mode's / bundle's own default
const EDITOR_PERSONALITY_MIXED = 'mixed';
const EDITOR_LIST_MUTATOR = 'weaponset';      // the Weapons tab list travels as this mutator
const LZ_MAX_RUN = 128, LZ_MIN_MATCH = 3, LZ_MAX_MATCH = 130, LZ_MAX_OFFSET = 65535, LZ_MATCH_FLAG = 0x80;
const EDITOR_SCORE_LIMITS = [-1, 0, 10, 25, 50, 100, 150, 200, 300, 500];
const EDITOR_TIME_LIMITS = [-1, 0, 120, 300, 600, 900, 1200, 1800, 3600];
const EDITOR_ROUND_WINS = [-1, 1, 2, 3, 4, 5, 7];
const EDITOR_LIVES = [-1, 0, 1, 2, 3, 5, 10];
const EDITOR_RESPAWN = [-1, 0, 1, 2, 3, 5, 8, 10, 15];
const EDITOR_FRIENDLY_FIRE = [-1, 0, 0.5, 1];
const EDITOR_TABS = [['mode', 'Mode'], ['rules', 'Rules'], ['weapons', 'Weapons'], ['bots', 'Bots'], ['mutators', 'Mutators'], ['map', 'Map']];
const EDITOR_CSS = '.cm-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; } .cm-sub { display: block; color: var(--ui-dim); font-size: 0.875em; }'
  + '.cm-reset { min-height: 36px; padding: 0.3em 0.7em; }'
  + '.cm-name { flex: 1; min-width: 8em; background: var(--ui-panel);'
  + ' color: var(--ui-text); border: 1px solid var(--ui-line); border-radius: 8px; padding: 8px; font: inherit; } .cm-error { color: var(--ui-bad); } .cm-quick { display: grid;'
  + ' grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; margin: 6px 0 12px; } .cm-list .ui-row { flex-wrap: wrap; } .cm-controls .ui-slider { width: auto; flex: 1 1 170px; min-width: 150px; } .cm-controls .ui-value { min-width: 3.6em; }';

Settings.define('custom.draft', '', { label: 'Last custom match', category: 'gameplay' });

// ---- Share code: a small byte-oriented LZ77 so a code stays short ----
// Tokens: a byte below 128 = that many + 1 literal bytes follow; a byte of 128 or more = a copy of (byte - 125) bytes from a two-byte distance.
const CustomCodec = {
  compress(bytes) {
    const out = [], recent = new Map();
    let literalStart = 0, position = 0;
    const flushLiterals = (end) => {
      for (let from = literalStart; from < end; from += LZ_MAX_RUN) {
        const count = Math.min(LZ_MAX_RUN, end - from);
        out.push(count - 1);
        for (let i = 0; i < count; i++) out.push(bytes[from + i]);
      }
      literalStart = end;
    };
    const remember = (at) => { if (at + 2 < bytes.length) recent.set((bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2], at); };
    while (position < bytes.length) {
      const length = this.matchLength(bytes, recent, position);
      if (length < LZ_MIN_MATCH) { remember(position); position++; continue; }
      const distance = position - recent.get((bytes[position] << 16) | (bytes[position + 1] << 8) | bytes[position + 2]);
      flushLiterals(position);
      out.push(LZ_MATCH_FLAG | (length - LZ_MIN_MATCH), distance >> 8, distance & 255);
      for (let i = 0; i < length; i++) remember(position + i);
      position += length;
      literalStart = position;
    }
    flushLiterals(bytes.length);
    return Uint8Array.from(out);
  },
  matchLength(bytes, recent, position) {
    if (position + 2 >= bytes.length) return 0;
    const earlier = recent.get((bytes[position] << 16) | (bytes[position + 1] << 8) | bytes[position + 2]);
    if (earlier === undefined || position - earlier > LZ_MAX_OFFSET) return 0;
    let length = 0;
    while (length < LZ_MAX_MATCH && position + length < bytes.length && bytes[earlier + length] === bytes[position + length]) length++;
    return length;
  },
  // Returns the original bytes or throws on any inconsistency (truncation, bad distance, output over the limit).
  expand(bytes, limit) {
    const out = [];
    let position = 0;
    while (position < bytes.length) {
      const token = bytes[position++];
      if (token < LZ_MATCH_FLAG) position = this.copyLiterals(bytes, out, position, token + 1);
      else position = this.copyMatch(bytes, out, position, token - LZ_MATCH_FLAG + LZ_MIN_MATCH);
      if (out.length > limit) throw new Error('code expands too far');
    }
    return Uint8Array.from(out);
  },
  copyLiterals(bytes, out, position, count) {
    if (position + count > bytes.length) throw new Error('truncated literals');
    for (let i = 0; i < count; i++) out.push(bytes[position + i]);
    return position + count;
  },
  copyMatch(bytes, out, position, length) {
    if (position + 2 > bytes.length) throw new Error('truncated match');
    const distance = (bytes[position] << 8) | bytes[position + 1];
    if (distance < 1 || distance > out.length) throw new Error('bad distance');
    for (let i = 0; i < length; i++) out.push(out[out.length - distance]);
    return position + 2;
  },
  toBase64Url(bytes) {
    let text = '';
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  fromBase64Url(text) {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  },
  checksum(text) { return hashString(text).toString(16).padStart(8, '0'); },
  cleanCode(text) { return String(text || '').replace(/\s+/g, ''); },   // a pasted code without its line breaks and spaces
  // The one share-code framing (match codes here, map editor codes in 18i): object -> '<prefix><version>-<checksum>-<payload>'.
  packCode(format, object) {
    const payload = this.toBase64Url(this.compress(new TextEncoder().encode(JSON.stringify(object))));
    return format.prefix + format.version + '-' + this.checksum(payload) + '-' + payload;
  },
  // text -> { object } (the parsed JSON) or { error } with a message for the player. Whitespace is ignored.
  unpackCode(format, text) {
    const clean = this.cleanCode(text);
    if (clean.length > format.maxChars) return { error: 'The code is too long to be a ' + format.noun + ' code.' };
    const parts = format.pattern.exec(clean);
    if (!parts) return { error: 'This is not a ClassTimeKiller ' + format.noun + ' code.' };
    if (Number(parts[1]) > format.version) return { error: 'This code was made by a newer version of the game.' };
    if (Number(parts[1]) < format.oldest) return { error: 'This code is from an old version and cannot be read.' };
    if (this.checksum(parts[3]) !== parts[2]) return { error: 'The code is damaged: it does not match its check value. Copy it again.' };
    try {
      const bytes = this.expand(this.fromBase64Url(parts[3]), format.maxBytes);
      return { object: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
    } catch (error) {
      return { error: SHARE_CODE_UNREADABLE };
    }
  },
  // object -> 'CTK1-<checksum>-<payload>'
  pack(object) { return this.packCode(MATCH_CODE_FORMAT, object); },
  // text -> { object } or { error } with a message for the player.
  unpack(text) {
    const unpacked = this.unpackCode(MATCH_CODE_FORMAT, text);
    if (unpacked.error || isPlainObject(unpacked.object)) return unpacked;
    return { error: 'The code holds no settings.' };
  },
};
// A share-code format: prefix + version, the oldest version still read, size limits (text, unpacked JSON) and the noun in messages.
function shareCodeFormat(prefix, version, oldest, maxChars, maxBytes, noun) {
  const pattern = new RegExp(String.raw`^${prefix}(\d+)-([0-9a-f]{8})-([A-Za-z0-9_-]+)$`);   // prefix, version, check value, payload
  return { prefix, version, oldest, maxChars, maxBytes, noun, pattern };
}
const SHARE_CODE_UNREADABLE = 'The code could not be read.';
const MATCH_CODE_FORMAT = shareCodeFormat(EDITOR_CODE_PREFIX, EDITOR_CODE_VERSION, EDITOR_CODE_VERSION, EDITOR_CODE_MAX_CHARS, EDITOR_PAYLOAD_MAX_BYTES, 'match');

// ---- The draft: every editor field, validation, and the conversion to a match setup ----
function customDefaults() {
  return { name: '', mode: DEFAULT_MODE, map: '', bundle: '', move: '', health: '', economy: '', weaponSet: '', weaponList: null, items: true,
    friendlyFire: EDITOR_DEFAULT, lives: EDITOR_DEFAULT, respawnDelay: EDITOR_DEFAULT, botCount: EDITOR_DEFAULT, allies: EDITOR_DEFAULT,
    difficulty: DEFAULT_DIFFICULTY, difficultySliders: {}, personality: EDITOR_PERSONALITY_MIXED, scoreLimit: EDITOR_DEFAULT, timeLimit: EDITOR_DEFAULT, roundWins: EDITOR_DEFAULT, mutators: [] };
}
const isToken = (value) => typeof value === 'string' && /^[a-z][A-Za-z0-9]{0,31}$/.test(value);
const isBlankOr = (check) => (value) => (value === '' || check(value) ? value : undefined);
const catalogueHas = (name) => (value) => !!CAT[name] && isToken(value) && value !== MATCH_SET_ID && !!CAT[name].byId(value);
const oneOfList = (list) => (value) => (list.includes(value) ? value : undefined);
const integerBetween = (low, high) => (value) => (Number.isInteger(value) && value >= low && value <= high ? value : undefined);
// DIF-002 slider overrides: { field: value } for fields that have a slider (Ui.difficultyRows, 18l), each inside its range.
function difficultySlidersCheck(value) {
  if (!isPlainObject(value)) return undefined;
  for (const field in value) {
    const definition = ASSIST_DEFINITIONS.get(field), number = value[field];
    if (!definition || typeof number !== 'number' || !(number >= definition.min && number <= definition.max)) return undefined;
  }
  return Object.assign({}, value);
}

// One note for both ends of a code: the sender's share screen and the receiver's import.
const SHARE_LOCAL_MAP_NOTE = 'A map editor or generated map lives only on its own device, so this code plays a random map.';
function isSharedMap(id) { return !id || (!!CAT.maps && !!CAT.maps.byId(id)); }

const EDITOR_FIELD_CHECKS = {
  name: (value) => (typeof value === 'string' ? cleanLabel(value, LABEL_MAX) : undefined),
  mode: (value) => (isToken(value) && CAT.modes.byId(value) && Modes.isPlayable(value) ? value : undefined),
  map: isBlankOr((value) => !!CAT.maps && isToken(value) && !!Maps.get(value)),
  bundle: isBlankOr((value) => RULESET_ROWS.some((row) => row.id === value)),
  move: isBlankOr(catalogueHas('movement')),
  health: isBlankOr(catalogueHas('health')),
  economy: isBlankOr(catalogueHas('economy')),
  weaponSet: isBlankOr(catalogueHas('weaponSets')),
  weaponList: (value) => (value === null ? null : Array.isArray(value) ? Mutators.coerceWeaponList({ source: 'weaponSets' }, value) : undefined),
  items: (value) => (typeof value === 'boolean' ? value : undefined),
  friendlyFire: oneOfList(EDITOR_FRIENDLY_FIRE),
  lives: oneOfList(EDITOR_LIVES),
  respawnDelay: oneOfList(EDITOR_RESPAWN),
  botCount: integerBetween(EDITOR_DEFAULT, QUALITY_BOTS_MAX),
  allies: integerBetween(EDITOR_DEFAULT, QUALITY_BOTS_MAX),
  difficulty: (value) => (isToken(value) && (!CAT.difficulty || !!CAT.difficulty.byId(value)) ? value : undefined),
  difficultySliders: difficultySlidersCheck,
  personality: (value) => (value === EDITOR_PERSONALITY_MIXED || (isToken(value) && !!CAT.bots && !!CAT.bots.byId(value)) ? value : undefined),
  scoreLimit: oneOfList(EDITOR_SCORE_LIMITS),
  timeLimit: oneOfList(EDITOR_TIME_LIMITS),
  roundWins: oneOfList(EDITOR_ROUND_WINS),
  mutators: (value) => {
    if (!Array.isArray(value) || value.length > CAT.mutators.length) return undefined;
    const valid = value.every((entry) => isPlainObject(entry) && Mutators.row(entry.id) && Mutators.coerce(Mutators.row(entry.id), entry.value) !== undefined);
    return valid ? Mutators.resolve(value).list : undefined;
  },
};

const CustomMatch = {
  // ---- Model ----
  defaults: customDefaults,
  // raw (any parsed JSON) -> { draft, errors }. Unknown or invalid fields keep their default and are listed in errors.
  validate(raw) {
    const draft = customDefaults(), errors = [];
    if (!isPlainObject(raw)) return { draft, errors: ['The settings are missing.'] };
    for (const key in raw) {
      if (!(key in draft)) { errors.push('unknown setting ' + key); continue; }
      const value = EDITOR_FIELD_CHECKS[key](raw[key]);
      if (value === undefined) errors.push('invalid ' + key); else draft[key] = value;
    }
    this.settle(draft, errors);
    return { draft, errors };
  },
  // Cross-field rules: a map must serve the mode; limits that a mode cannot use fall back to the default.
  settle(draft, errors) {
    if (draft.map && !Maps.savedForMode(draft.mode).some((map) => map.id === draft.map)) { errors.push('map ' + draft.map + ' does not serve ' + draft.mode); draft.map = ''; }
    if (!CAT.modes.byId(draft.mode).rounds) draft.roundWins = EDITOR_DEFAULT;
    if (CAT.modes.byId(draft.mode).teams !== 2) draft.allies = EDITOR_DEFAULT;
    if (draft.weaponList) this.setWeaponList(draft, draft.weaponList);
  },
  copy(draft) { return copyRuleValue(draft); },
  load() {
    let raw = null;
    try { raw = JSON.parse(Settings.get('custom.draft')); } catch (error) { raw = null; }
    return this.validate(raw).draft;
  },
  save(draft) { Settings.set('custom.draft', JSON.stringify(draft)); },

  // ---- Share codes ----
  // Only the fields that differ from the defaults travel in a code. Only a built-in map travels: an editor or generated map is
  // a local slot (user1 is another map on the next device), so the code then plays a random map.
  encode(draft) {
    const defaults = customDefaults(), changed = {};
    for (const key in defaults) if (JSON.stringify(draft[key]) !== JSON.stringify(defaults[key])) changed[key] = draft[key];
    if (!isSharedMap(changed.map)) delete changed.map;
    return CustomCodec.pack(changed);
  },
  // text -> { draft, note } or { error }
  decode(text) {
    const unpacked = CustomCodec.unpack(text);
    if (unpacked.error) return unpacked;
    const object = unpacked.object;
    let note = '';
    if (isPlainObject(object) && object.map && !isSharedMap(object.map)) { delete object.map; note = SHARE_LOCAL_MAP_NOTE; }
    const checked = this.validate(object);
    if (checked.errors.length) return { error: 'The code holds settings this version cannot use: ' + checked.errors.slice(0, 3).join(', ') + '.' };
    return { draft: checked.draft, note };
  },

  // ---- Ruleset and setup ----
  bundleOf(draft) {
    const mode = CAT.modes.byId(draft.mode);
    return RULESET_ROWS.find((row) => row.id === (draft.bundle || mode.ruleset)) || RULESET_ROWS[0];
  },
  hasOverrides(draft) {
    return !!(draft.move || draft.health || draft.economy || draft.weaponSet || !draft.items || draft.friendlyFire >= 0 || draft.lives >= 0 || draft.respawnDelay >= 0);
  },
  // The ruleset fields the draft writes on top of its bundle (the same shape Rules.custom stores).
  rulesetFields(draft) {
    const fields = copyRuleValue(this.bundleOf(draft));
    delete fields.id; delete fields.code;
    for (const key of ['move', 'health', 'economy', 'weaponSet']) if (draft[key]) fields[key] = draft[key];
    if (draft.friendlyFire >= 0) fields.friendlyFire = draft.friendlyFire;
    if (draft.lives >= 0) fields.lives = draft.lives;
    if (draft.respawnDelay >= 0) fields.respawn = { delay: draft.respawnDelay };
    fields.items = draft.items;
    fields.name = draft.name || fields.name;
    return fields;
  },
  // The mutators the match uses: the draft's own, plus the weapon list of the Weapons tab as a Weapon Set mutator.
  matchMutators(draft) {
    const list = draft.mutators.slice();
    return draft.weaponList ? Mutators.add(list, EDITOR_LIST_MUTATOR, draft.weaponList).list : list;
  },
  // Sets (a list of weapon keys) or clears (null) the Weapons tab list. A mutator that cannot be combined with a list (X08, X09)
  // is turned off in the draft, so the editor never shows a mutator the match would drop. Returns the notice for the player ('' if none).
  setWeaponList(draft, list) {
    draft.weaponList = list;
    if (!list) return '';
    const result = Mutators.add(draft.mutators, EDITOR_LIST_MUTATOR, list);
    draft.mutators = draft.mutators.filter((entry) => !result.removed.includes(entry.id));
    return result.message;
  },
  // Switches a mutator on with its default value. Mutators it cannot be combined with are turned off, and so is the weapon list when the
  // new mutator conflicts with it or chooses weapons itself (the last choice wins).
  turnOnMutator(draft, id) {
    const result = Mutators.add(draft.mutators, id, true);
    draft.mutators = result.list;
    const replacesList = draft.weaponList && (id === EDITOR_LIST_MUTATOR || Mutators.conflicts(id, EDITOR_LIST_MUTATOR));
    if (!replacesList) return result.message;
    draft.weaponList = null;
    return (result.message + ' The weapon list of the Weapons tab was turned off.').trim();
  },
  botCount(draft, mode) {
    const wanted = draft.botCount >= 0 ? draft.botCount : Modes.defaultBots(mode.id, true).length;
    return Math.min(wanted, Quality.current().bots);
  },
  // Mixed: the named roster bots Quick Play fields for the seed (R-148); otherwise every bot plays the chosen personality.
  botList(draft, mode, seed) {
    const count = this.botCount(draft, mode);
    const allies = draft.allies >= 0 ? Math.min(draft.allies, count) : Math.floor(count / 2);
    const bots = draft.personality === EDITOR_PERSONALITY_MIXED ? PlayFlow.rosterBots(count, draft.difficulty, seed)
      : Array.from({ length: count }, () => ({ profile: draft.personality }));
    if (mode.teams === 2) bots.forEach((bot, index) => { bot.team = index < allies ? 0 : 1; });
    return bots;
  },
  mapFor(draft, seed) {
    if (draft.map) return draft.map;
    const maps = Maps.savedForMode(draft.mode);
    return maps.length ? maps[seed % maps.length].id : undefined;
  },
  modeOptions(draft, mode) {
    const options = {};
    if (draft.scoreLimit >= 0) options.scoreLimit = draft.scoreLimit;
    if (draft.timeLimit >= 0) options.timeLimit = draft.timeLimit;
    // At most 2w - 1 rounds; a mode with a side switch (bomb, ghostops) switches after w - 1 of them, so both sides attack.
    if (draft.roundWins >= 0 && mode.rounds) {
      const wins = draft.roundWins;
      options.rounds = { winsNeeded: wins, limit: wins * 2 - 1, switchAt: mode.rounds.switchAt > 0 ? wins - 1 : 0 };
    }
    return options;
  },
  // draft -> Game.start setup. seed picks a random map when none is chosen; withPlayer false starts a spectator match.
  setup(draft, seed, withPlayer) {
    const mode = CAT.modes.byId(draft.mode), matchSeed = seed === undefined ? newSeed() : seed;
    const setup = { mode: mode.id, map: this.mapFor(draft, matchSeed), seed: matchSeed, mutators: this.matchMutators(draft), difficulty: this.difficultyOf(draft),
      bots: this.botList(draft, mode, matchSeed), modeOptions: this.modeOptions(draft, mode) };
    setup.ruleset = this.hasOverrides(draft) || draft.name ? Object.assign(this.rulesetFields(draft), { id: 'custom', name: draft.name || 'Custom match' }) : this.bundleOf(draft).id;
    if (draft.allies >= 0 && mode.teams === 2) setup.balance = false;
    if (withPlayer !== false) setup.player = mode.teams === 2 ? { team: 0 } : {};
    return setup;
  },
  // setup.difficulty: the preset id, or { preset, <field>: value } when sliders were moved (14a clamps and applies them).
  difficultyOf(draft) {
    if (Object.keys(draft.difficultySliders).length === 0) return draft.difficulty;
    return Object.assign({ preset: draft.difficulty }, draft.difficultySliders);
  },
  // One-click start of a rule bundle (RS01..RS12): the draft's mode, map, bots and limits with the bundle's own presets.
  bundleStart(draft, bundleId, seed, withPlayer) {
    const plain = this.copy(draft);
    Object.assign(plain, { bundle: bundleId, move: '', health: '', economy: '', weaponSet: '', weaponList: null, items: true, friendlyFire: EDITOR_DEFAULT,
      lives: EDITOR_DEFAULT, respawnDelay: EDITOR_DEFAULT, name: '', mutators: [] });
    return this.setup(plain, seed, withPlayer);
  },
  start(setup) {
    Ui.closeAll();
    return Game.start(setup);
  },

  // ---- Saved presets (MOV-002): ruleset fields + the editor's own settings ----
  saveAs(draft, name, id) {
    const preset = Object.assign(this.rulesetFields(draft), { mutators: this.matchMutators(draft), name, editor: this.copy(draft) });
    if (id) preset.id = id;
    return Rules.custom.save(preset);
  },
  fromPreset(preset) {
    const draft = preset.editor ? this.validate(preset.editor).draft : this.fromRuleset(preset);
    draft.name = preset.name;
    return draft;
  },
  // A ruleset saved without editor settings (by other code): take what the editor can express.
  fromRuleset(preset) {
    const raw = {};
    for (const key of ['move', 'health', 'economy', 'weaponSet', 'items', 'lives']) if (preset[key] !== undefined) raw[key] = preset[key];
    if (preset.mutators) raw.mutators = preset.mutators;
    const checked = this.validate(raw);
    return checked.draft;
  },
};

// ---- Screens ----
const EDITOR_STATE = { draft: null, tab: 'mode', refresh: null };

const editorLimitLabel = (zeroText, format) => (value) => (value === EDITOR_DEFAULT ? 'Default' : value === 0 ? zeroText : format(value));
const editorMinutes = (seconds) => (seconds >= 3600 ? '60 min' : seconds / 60 + ' min');
const editorPlain = (value) => String(value);
const editorList = (values, format) => ({ values, labels: values.map(format) });
const editorCatalogue = (rows, blankLabel) => ({ values: [''].concat(rows.map((row) => row.id)), labels: [blankLabel].concat(rows.map((row) => row.name)) });
const editorOptionalCatalogue = (name, blankLabel) => editorCatalogue(CAT[name] ? CAT[name].filter((row) => row.id !== MATCH_SET_ID) : [], blankLabel);

function editorModeOptions() {
  const rows = CAT.modes.filter((mode) => Modes.isPlayable(mode.id));
  return { values: rows.map((mode) => mode.id), labels: rows.map((mode) => mode.name) };
}
function editorMapOptions(draft) {
  const maps = Maps.savedForMode(draft.mode);
  return { values: [''].concat(maps.map((map) => map.id)), labels: ['Random'].concat(maps.map((map) => map.code + ' ' + map.name)) };
}
// Bot counts up to this device's quality cap (PlayFlow.maxBots), after the default entry named defaultLabel.
function editorBotOptions(defaultLabel) {
  const top = PlayFlow.maxBots(), values = [EDITOR_DEFAULT];
  for (let count = 0; count <= top; count++) values.push(count);
  return { values, labels: values.map((value) => (value === EDITOR_DEFAULT ? defaultLabel : String(value))) };
}
function editorBotCountOptions() { return editorBotOptions('Mode default'); }
function editorAlliesOptions() { return editorBotOptions('Balanced'); }
function editorDifficultyOptions() {
  const rows = CAT.difficulty ? Array.from(CAT.difficulty) : [{ id: DEFAULT_DIFFICULTY, name: 'Regular' }];
  return { values: rows.map((row) => row.id), labels: rows.map((row) => row.name) };
}
function editorPersonalityOptions() {
  const rows = CAT.bots ? Array.from(CAT.bots) : [];
  return { values: [EDITOR_PERSONALITY_MIXED].concat(rows.map((row) => row.id)), labels: ['Mixed'].concat(rows.map((row) => row.name)) };
}

// One row per simple field: which tab, the draft key, how to list its values, when to show it, what else changes with it.
const EDITOR_FIELDS = [
  { tab: 'mode', key: 'mode', label: 'Game mode', options: editorModeOptions, changed: 'modeChanged' },
  { tab: 'mode', key: 'scoreLimit', label: 'Score limit', options: () => editorList(EDITOR_SCORE_LIMITS, editorLimitLabel('None', editorPlain)), show: (draft) => Modes.honoursLimit(draft.mode, 'score') },
  { tab: 'mode', key: 'timeLimit', label: 'Time limit', options: () => editorList(EDITOR_TIME_LIMITS, editorLimitLabel('None', editorMinutes)), show: (draft) => Modes.honoursLimit(draft.mode, 'time') },
  { tab: 'mode', key: 'roundWins', label: 'Rounds to win', options: () => editorList(EDITOR_ROUND_WINS, editorLimitLabel('None', editorPlain)), show: (draft) => !!CAT.modes.byId(draft.mode).rounds },
  { tab: 'mode', key: 'lives', label: 'Lives', options: () => editorList(EDITOR_LIVES, editorLimitLabel('Unlimited', editorPlain)),
    show: (draft) => Mutators.fitsMode(Mutators.row('lives'), CAT.modes.byId(draft.mode)) },
  { tab: 'rules', key: 'bundle', label: 'Rule bundle', options: () => editorCatalogue(RULESET_ROWS, 'Mode default') },
  { tab: 'rules', key: 'move', label: 'Movement', options: () => editorOptionalCatalogue('movement', 'From bundle') },
  { tab: 'rules', key: 'health', label: 'Health', options: () => editorOptionalCatalogue('health', 'From bundle') },
  { tab: 'rules', key: 'economy', label: 'Economy', options: () => editorOptionalCatalogue('economy', 'From bundle'), show: () => !!CAT.economy },
  { tab: 'rules', key: 'friendlyFire', label: 'Friendly fire', options: () => editorList(EDITOR_FRIENDLY_FIRE, editorLimitLabel('Off', (value) => value * 100 + '%')) },
  { tab: 'rules', key: 'respawnDelay', label: 'Respawn delay', options: () => editorList(EDITOR_RESPAWN, editorLimitLabel('Instant', (value) => value + ' s')) },
  { tab: 'rules', key: 'items', label: 'Items on the map', options: () => ({ values: [false, true], labels: ['Off', 'On'] }) },
  { tab: 'weapons', key: 'weaponSet', label: 'Weapon set', options: () => editorOptionalCatalogue('weaponSets', 'From bundle') },
  { tab: 'bots', key: 'botCount', label: 'Bots', options: editorBotCountOptions },
  { tab: 'bots', key: 'allies', label: 'Bots on your team', options: editorAlliesOptions, show: (draft) => CAT.modes.byId(draft.mode).teams === 2 },
  { tab: 'bots', key: 'difficulty', label: 'Difficulty', options: editorDifficultyOptions, reset: DEFAULT_DIFFICULTY },
  { tab: 'bots', key: 'personality', label: 'Bot personality', options: editorPersonalityOptions, reset: EDITOR_PERSONALITY_MIXED },
  { tab: 'map', key: 'map', label: 'Map', options: editorMapOptions },
];

const EDITOR_CHANGED = {
  // A new mode: the limits belong to the old one; the map stays when it also serves the new mode.
  modeChanged(draft) {
    Object.assign(draft, { scoreLimit: EDITOR_DEFAULT, timeLimit: EDITOR_DEFAULT, roundWins: EDITOR_DEFAULT, allies: EDITOR_DEFAULT });
    if (!Maps.savedForMode(draft.mode).some((map) => map.id === draft.map)) draft.map = '';
  },
};

function editorDraft() {
  if (!EDITOR_STATE.draft) EDITOR_STATE.draft = CustomMatch.load();
  return EDITOR_STATE.draft;
}
function editorChanged() {
  CustomMatch.save(EDITOR_STATE.draft);
  if (EDITOR_STATE.refresh) EDITOR_STATE.refresh();
}
function editorResetValue(field) {
  const defaults = customDefaults();
  return field.reset !== undefined && field.reset !== true ? field.reset : defaults[field.key];
}

// A cycle for one field with its own Reset button (MUT-001: every field has a reset).
function editorFieldRow(field) {
  const draft = EDITOR_STATE.draft, options = field.options(draft);
  const wrap = makeElement('div', 'cm-controls');
  const cycle = Ui.cycle(options.values, options.labels, draft[field.key], (value) => {
    draft[field.key] = value;
    if (field.changed) EDITOR_CHANGED[field.changed](draft);
    editorChanged();
  });
  const reset = Ui.button('Reset', () => {
    draft[field.key] = editorResetValue(field);
    if (field.changed) EDITOR_CHANGED[field.changed](draft);
    editorChanged();
  }, 'cm-reset');
  wrap.appendChild(cycle);
  wrap.appendChild(reset);
  return Ui.row(field.label, wrap);
}

// ---- Weapons tab: the allowed weapons list ----
function editorWeaponRows(list) {
  const draft = EDITOR_STATE.draft;
  const limited = Ui.toggle(!!draft.weaponList, (on) => {
    const message = CustomMatch.setWeaponList(draft, on ? CAT.weapons.map((row) => row.id) : null);
    if (message) emitToast(message);
    editorChanged();
  });
  list.appendChild(Ui.row('Limit to chosen weapons', limited));
  list.appendChild(makeElement('p', 'ui-note', 'With a list, only these weapons are in the match. The list replaces the weapon set above.'));
  if (!draft.weaponList) return;
  for (const weapon of CAT.weapons) {
    const toggle = Ui.toggle(draft.weaponList.includes(weapon.id), (on) => editorToggleWeapon(weapon.id, on));
    list.appendChild(Ui.row(weapon.code + '  ' + weapon.name, toggle));
  }
}
function editorToggleWeapon(key, on) {
  const draft = EDITOR_STATE.draft, next = draft.weaponList.filter((item) => item !== key);
  if (on) next.push(key);
  if (!next.length) { emitToast('At least one weapon is needed.'); editorChanged(); return; }
  draft.weaponList = CAT.weapons.map((row) => row.id).filter((id) => next.includes(id));
  CustomMatch.save(draft);
}

// ---- Mutators tab: one row per mutator with a switch and its typed parameters ----
function editorParamControl(row, param, entry) {
  const read = () => (row.params.length === 1 ? entry.value : entry.value[param.key]);
  const write = (value) => {
    if (row.params.length === 1) entry.value = value; else entry.value[param.key] = value;
    CustomMatch.save(EDITOR_STATE.draft);
  };
  if (param.kind === 'range') {
    return Ui.slider({ min: param.min, max: param.max, step: param.step, value: read(), format: (shown) => shown + (param.unit || '') }, write);
  }
  const options = Mutators.optionsOf(param), labels = param.labels || options.map((option) => (CAT.weaponSets && CAT.weaponSets.byId(option) ? CAT.weaponSets.byId(option).name : String(option)));
  const shown = Array.isArray(read()) ? options[0] : read();
  return Ui.cycle(options, labels, shown, write);
}
function editorMutatorRow(row) {
  const draft = EDITOR_STATE.draft, entry = draft.mutators.find((item) => item.id === row.id);
  const label = makeElement('span', 'ui-label', row.code + '  ' + row.name);
  label.appendChild(makeElement('span', 'cm-sub', row.effect));
  const wrap = makeElement('div', 'cm-controls');
  if (entry) for (const param of row.params) wrap.appendChild(editorParamControl(row, param, entry));
  wrap.appendChild(Ui.toggle(!!entry, (on) => editorSwitchMutator(row, on)));
  const element = makeElement('div', 'ui-row');
  element.appendChild(label);
  element.appendChild(wrap);
  return element;
}
function editorSwitchMutator(row, on) {
  const draft = EDITOR_STATE.draft;
  if (!on) { draft.mutators = Mutators.remove(draft.mutators, row.id); editorChanged(); return; }
  const message = CustomMatch.turnOnMutator(draft, row.id);
  if (message) emitToast(message);
  editorChanged();
}
function editorMutatorRows(list) {
  const draft = EDITOR_STATE.draft;
  list.appendChild(makeElement('p', 'ui-note', draft.mutators.length ? draft.mutators.map((entry) => Mutators.describe(entry)).join(' | ') : 'No mutators. Turn some on; a mutator that cannot be combined with another one turns the other one off.'));
  list.appendChild(Ui.button('Turn all off', () => { draft.mutators = []; editorChanged(); }));
  for (const row of editorModeMutators(draft.mode)) list.appendChild(editorMutatorRow(row));
}
// The mutator rows the mode can use (row.needs); the others would do nothing there.
function editorModeMutators(modeId) {
  const mode = CAT.modes.byId(modeId);
  return CAT.mutators.filter((row) => Mutators.fitsMode(row, mode));
}

// ---- Rules tab: the one-click bundle starts ----
function editorQuickStarts(list) {
  list.appendChild(makeElement('div', 'ui-group', 'Quick start a rule bundle'));
  list.appendChild(makeElement('p', 'ui-note', 'Starts at once with the mode, map, bots and limits chosen here and the presets of the bundle.'));
  const grid = makeElement('div', 'cm-quick');
  for (const row of RULESET_ROWS) {
    grid.appendChild(Ui.button(row.code + '  ' + row.name, () => CustomMatch.start(CustomMatch.bundleStart(EDITOR_STATE.draft, row.id))));
  }
  list.appendChild(grid);
}

// Map tab: the generated map screen (18h) builds a new map from a seed and plays it.
function editorGeneratedMap(list) {
  list.appendChild(makeElement('div', 'ui-group', 'Generated map'));
  list.appendChild(Ui.button('Generate a map from a seed', () => Ui.open('mapgen')));
}

// Bots tab: the DIF-002 sliders on top of the chosen preset. A slider moved back to the preset's value drops its override.
function editorPresetValue(draft, field) {
  const preset = CAT.difficulty ? CAT.difficulty.byId(draft.difficulty) : null, definition = ASSIST_DEFINITIONS.get(field);
  const value = preset ? preset[field] : undefined;
  return typeof value === 'number' && value >= definition.min && value <= definition.max ? value : definition.fallback;
}
function editorDifficultySliders(list) {
  const draft = EDITOR_STATE.draft, values = {};
  for (const field of ASSIST_DEFINITIONS.keys()) values[field] = field in draft.difficultySliders ? draft.difficultySliders[field] : editorPresetValue(draft, field);
  list.appendChild(makeElement('div', 'ui-group', 'Difficulty sliders'));
  list.appendChild(makeElement('p', 'ui-note', 'Fine-tune the chosen difficulty. Damage, lives and checkpoints change PvE matches only.'));
  Ui.difficultyRows(list, values, (field, value) => {
    if (value === editorPresetValue(draft, field)) delete draft.difficultySliders[field]; else draft.difficultySliders[field] = value;
    CustomMatch.save(draft);   // no re-render: the slider being dragged keeps its place
  });
  list.appendChild(Ui.button('Reset sliders to the difficulty', () => { draft.difficultySliders = {}; editorChanged(); }, 'cm-reset'));
}

const EDITOR_TAB_EXTRAS = { rules: editorQuickStarts, weapons: editorWeaponRows, bots: editorDifficultySliders, mutators: editorMutatorRows, map: editorGeneratedMap };

function editorSummary(draft) {
  const mode = CAT.modes.byId(draft.mode), setup = CustomMatch.setup(draft, 0);
  const map = draft.map && Maps.get(draft.map) ? Maps.get(draft.map).name : 'random map';
  const mutators = draft.mutators.length ? ', ' + draft.mutators.length + ' mutator' + (draft.mutators.length === 1 ? '' : 's') : '';
  return mode.name + ' on ' + map + ', ' + setup.bots.length + ' bots' + mutators;
}

function editorRenderTab(list, summary) {
  const draft = EDITOR_STATE.draft;
  summary.textContent = editorSummary(draft);
  Ui.rebuild(list, () => {
    list.replaceChildren();
    const fields = EDITOR_FIELDS.filter((field) => field.tab === EDITOR_STATE.tab && (!field.show || field.show(draft)));
    for (const field of fields) list.appendChild(editorFieldRow(field));
    if (EDITOR_TAB_EXTRAS[EDITOR_STATE.tab]) EDITOR_TAB_EXTRAS[EDITOR_STATE.tab](list);
  });
}

Ui.register('custom', {
  build(root) {
    injectStyle('ui-custom-style', EDITOR_CSS);
    EDITOR_STATE.draft = CustomMatch.load();
    const head = makeElement('div', 'ui-head');
    head.appendChild(Ui.button('Back', () => Ui.back()));
    head.appendChild(makeElement('h1', 'ui-title', 'Custom Match'));
    const summary = makeElement('p', 'ui-sub');
    const tabs = makeElement('div', 'ui-tabs'), list = makeElement('div', 'ui-scroll cm-list'), foot = makeElement('div', 'ui-foot');
    const tabButtons = new Map();
    const render = () => {
      for (const [id, button] of tabButtons) button.classList.toggle('active', id === EDITOR_STATE.tab);
      editorRenderTab(list, summary);
    };
    for (const [id, name] of EDITOR_TABS) {
      const button = Ui.button(name, () => { EDITOR_STATE.tab = id; render(); }, 'ui-tab');
      tabButtons.set(id, button);
      tabs.appendChild(button);
    }
    const start = Ui.button('Start match', () => CustomMatch.start(CustomMatch.setup(EDITOR_STATE.draft)), 'primary');
    start.dataset.autofocus = '1';
    foot.appendChild(start);
    foot.appendChild(Ui.button('Presets', () => Ui.open('customPresets')));
    foot.appendChild(Ui.button('Share code', () => Ui.open('customShare')));
    foot.appendChild(Ui.button('Reset all', () => Ui.confirm({ title: 'Reset everything?', text: 'All custom match settings return to their defaults.', yes: 'Reset',
      onYes: () => { EDITOR_STATE.draft = customDefaults(); editorChanged(); } })));
    [head, summary, tabs, list, foot].forEach((part) => root.appendChild(part));
    EDITOR_STATE.refresh = render;
    render();
  },
  onClose() { EDITOR_STATE.refresh = null; },
});

// ---- Presets screen: save the current settings, load, overwrite, delete ----
function presetRow(preset, nameInput, renderList) {
  const wrap = makeElement('div', 'cm-controls');
  wrap.appendChild(Ui.button('Load', () => {
    EDITOR_STATE.draft = CustomMatch.fromPreset(preset);
    editorChanged();
    Ui.back();
  }));
  wrap.appendChild(Ui.button('Overwrite', () => {
    const saved = CustomMatch.saveAs(editorDraft(), preset.name, preset.id);
    emitToast(saved ? 'Preset ' + preset.name + ' overwritten.' : Rules.custom.lastError);
  }));
  wrap.appendChild(Ui.button('Delete', () => Ui.confirm({ title: 'Delete preset?', text: preset.name, yes: 'Delete', onYes: () => { Rules.custom.remove(preset.id); renderList(); } }), 'danger'));
  return Ui.row(preset.name, wrap);
}
Ui.register('customPresets', {
  build(root) {
    injectStyle('ui-custom-style', EDITOR_CSS);
    const head = makeElement('div', 'ui-head');
    head.appendChild(Ui.button('Back', () => Ui.back()));
    head.appendChild(makeElement('h1', 'ui-title', 'Saved Presets'));
    const nameInput = makeElement('input', 'cm-name');
    nameInput.type = 'text'; nameInput.maxLength = LABEL_MAX; nameInput.placeholder = 'Preset name';
    nameInput.value = editorDraft().name;
    const count = makeElement('p', 'ui-sub'), list = makeElement('div', 'ui-scroll');
    const renderList = () => {
      list.replaceChildren();
      count.textContent = Rules.custom.list().length + ' of ' + MAX_CUSTOM_RULESETS + ' presets saved';
      for (const preset of Rules.custom.list()) list.appendChild(presetRow(preset, nameInput, renderList));
    };
    const save = Ui.button('Save as new', () => {
      const saved = CustomMatch.saveAs(editorDraft(), nameInput.value);
      emitToast(saved ? 'Preset ' + saved.name + ' saved.' : Rules.custom.lastError);
      renderList();
    }, 'primary');
    const form = makeElement('div', 'cm-controls');
    form.appendChild(nameInput);
    form.appendChild(save);
    [head, form, count, list].forEach((part) => root.appendChild(part));
    renderList();
  },
});

// ---- Share screen: show and copy the code, paste and import one ----
const COPY_DONE_TEXT = 'Code copied.';
const COPY_MANUAL_TEXT = 'Select the code and copy it.';
// Copies a code field. Without the clipboard API (http) it selects the way iOS accepts and says "copied" only on success (R-046).
function copyText(text, field) {
  const fallback = () => {
    const wasReadOnly = field.readOnly;
    field.readOnly = false;
    field.focus();
    field.setSelectionRange(0, field.value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
    field.readOnly = wasReadOnly;
    emitToast(copied ? COPY_DONE_TEXT : COPY_MANUAL_TEXT);
  };
  if (!navigator.clipboard) { fallback(); return; }
  navigator.clipboard.writeText(text).then(() => emitToast(COPY_DONE_TEXT), fallback);
}
Ui.register('customShare', {
  build(root) {
    injectStyle('ui-custom-style', EDITOR_CSS);
    const head = makeElement('div', 'ui-head');
    head.appendChild(Ui.button('Back', () => Ui.back()));
    head.appendChild(makeElement('h1', 'ui-title', 'Share Code'));
    const scroll = makeElement('div', 'ui-scroll');
    const mine = makeElement('textarea', 'ui-code'), paste = makeElement('textarea', 'ui-code');
    mine.readOnly = true; mine.tabIndex = 0; paste.tabIndex = 0;
    const mapNote = makeElement('p', 'ui-note');
    const showCode = (draft) => { mine.value = CustomMatch.encode(draft); mapNote.textContent = isSharedMap(draft.map) ? '' : SHARE_LOCAL_MAP_NOTE; };
    showCode(editorDraft());
    paste.placeholder = 'Paste a match code here';
    const message = makeElement('p', 'ui-note');
    const importButton = Ui.button('Import code', () => {
      const result = CustomMatch.decode(paste.value);
      message.className = result.error ? 'ui-note cm-error' : 'ui-note';
      message.textContent = result.error || ('Imported. The settings are loaded in the editor. ' + result.note).trim();
      if (result.error) return;
      EDITOR_STATE.draft = result.draft;
      showCode(result.draft);
      editorChanged();
    }, 'primary');
    scroll.appendChild(makeElement('div', 'ui-group', 'Your settings as a code (' + mine.value.length + ' characters)'));
    scroll.appendChild(mine);
    scroll.appendChild(mapNote);
    scroll.appendChild(Ui.button('Copy code', () => copyText(mine.value, mine)));
    scroll.appendChild(makeElement('div', 'ui-group', 'Import a code'));
    scroll.appendChild(paste);
    scroll.appendChild(importButton);
    scroll.appendChild(message);
    root.appendChild(head);
    root.appendChild(scroll);
  },
});
