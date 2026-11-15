// The schema of every content kind (reference section 13.1), in a small schema language of our own (no JSON Schema library, no npm).
// One schema per kind drives the writer (the key order of a file), the checks below and, later, validation and the editor's forms.
//
// A node is { type, label: { en, el }, help, optional?, ... }. Types:
//   text, int (min, max), number (min, max), bool, color, enum (values), ref (kind), stringKey, rows (one text per map row),
//   list (item), tuple (items), object (fields: the key order of the file), dict (value: the node of every value).
// The key order of `fields` is the order of the keys in the data files and, because DEV-02b proves the move by deep equality
// with key order, the order of today's tables.
export const DATA_VERSION = 1;

const node = (type, en, el, help, extra = {}) => ({ type, label: { en, el }, help, ...extra });
const text = (en, el, help, extra) => node('text', en, el, help, extra);
const int = (en, el, help, extra) => node('int', en, el, help, extra);
const number = (en, el, help, extra) => node('number', en, el, help, extra);
const bool = (en, el, help, extra) => node('bool', en, el, help, extra);
const color = (en, el, help, extra) => node('color', en, el, help, extra);
const ref = (kind, en, el, help, extra) => node('ref', en, el, help, { ref: kind, ...extra });
const stringKey = (en, el, help, extra) => node('stringKey', en, el, help, extra);
const list = (item, en, el, help, extra) => node('list', en, el, help, { item, ...extra });
const tuple = (items, en, el, help, extra) => node('tuple', en, el, help, { items, ...extra });
const object = (fields, en, el, help, extra) => node('object', en, el, help, { fields, ...extra });
const dict = (value, en, el, help, extra) => node('dict', en, el, help, { value, ...extra });
const optional = (field) => ({ ...field, optional: true });
const enumeration = (values, en, el, help, extra) => node('enum', en, el, help, { values, ...extra });

const spot = (en, el) => object({
  map: ref('maps', 'Map', 'Χάρτης', 'The map the spot is on.'),
  x: int('Column', 'Στήλη', 'Tile column.', { min: 0 }),
  y: int('Row', 'Γραμμή', 'Tile row.', { min: 0 }),
  dir: enumeration(['up', 'down', 'left', 'right'], 'Facing', 'Κατεύθυνση', 'The way the player faces.'),
}, en, el, 'A place on a map and the way to face.');

// ---- game.json: the numbers and the ids the engine names ----------------------------------------------------------------
const gameSchema = object({
  dataVersion: int('Data version', 'Έκδοση δεδομένων', 'The shape of the data files; tools/migrate-data.mjs moves older data to this one.', { min: 1 }),
  maxLevel: int('Highest level', 'Ανώτατο επίπεδο', 'No creature grows above this level.', { min: 1 }),
  damageDivisor: int('Damage divisor', 'Διαιρέτης ζημιάς', 'damage = power x attack / defence x (level + 4) / this number.', { min: 1 }),
  critChance: number('Critical hit chance', 'Πιθανότητα κρίσιμου', 'Chance of a critical hit per move (0 to 1).', { min: 0, max: 1 }),
  critMult: number('Critical hit multiplier', 'Πολλαπλασιαστής κρίσιμου', 'Damage multiplier of a critical hit.', { min: 1 }),
  stabMult: number('Same-type multiplier', 'Πολλαπλασιαστής ίδιου τύπου', 'Damage multiplier when the move has the type of its user.', { min: 1 }),
  encounterChance: number('Wild encounter chance', 'Πιθανότητα συνάντησης', 'Chance per step in tall grass (0 to 1).', { min: 0, max: 1 }),
  xpDivisor: int('Experience divisor', 'Διαιρέτης εμπειρίας', 'xp = species xp x foe level / this number.', { min: 1 }),
  trainerXpBonus: number('Trainer experience bonus', 'Μπόνους εμπειρίας προπονητή', 'Experience multiplier for beating a trainer.', { min: 1 }),
  xpScaleFrom: int('Experience scaling level', 'Επίπεδο κλιμάκωσης εμπειρίας', 'Above this foe level the experience grows by level / this number.', { min: 1 }),
  prizePerLevel: int('Prize per level', 'Έπαθλο ανά επίπεδο', 'Money for beating a trainer: this number x the highest level of the team.', { min: 0 }),
  overtimeTurn: int('Overtime turn', 'Γύρος παράτασης', 'From this turn on both fighters lose HP each turn.', { min: 1 }),
  overtimeStep: number('Overtime step', 'Βήμα παράτασης', 'The share of the maximum HP lost per turn of overtime, growing every turn.', { min: 0 }),
  startMoney: int('Starting money', 'Αρχικά χρήματα', 'Money of a new game.', { min: 0 }),
  blackoutMoneyKeep: number('Money kept after a black-out', 'Χρήματα μετά από λιποθυμία', 'The share of the money the player keeps after losing every fight (0 to 1).', { min: 0, max: 1 }),
  startMap: spot('Start spot', 'Σημείο εκκίνησης'),
  hospitalSpot: spot('Hospital spot', 'Σημείο νοσοκομείου'),
  startBag: dict(int('Count', 'Πλήθος', 'How many.', { min: 0 }), 'Starting bag', 'Αρχική τσάντα', 'The items of a new game (item id: count).'),
  starters: list(ref('species', 'Species', 'Είδος', 'A starter.'), 'Starters', 'Αρχικά', 'The creatures the professor offers.'),
  rivalStarter: dict(ref('species', 'Rival creature', 'Πλάσμα αντιπάλου', 'The creature the rival picks.'), 'Rival table', 'Πίνακας αντιπάλου', 'The starter the rival copies for each starter of the player.'),
  finaleSpot: spot('Finale spot', 'Σημείο τέλους'),
  titleCreatures: list(ref('species', 'Species', 'Είδος', 'A creature on the title screen.'), 'Title creatures', 'Πλάσματα τίτλου', 'The creatures the title screen shows.'),
  music: dict(ref('music', 'Tune', 'Μελωδία', 'A tune.'), 'Music roles', 'Ρόλοι μουσικής', 'The tune of the title, the battles and the boss fights, and the fallback of a battle without a map.'),
  sounds: dict(ref('sounds', 'Sound', 'Ήχος', 'A sound effect.'), 'Sound roles', 'Ρόλοι ήχων', 'The sound effect the engine plays for each role (move, confirm, back, hit ...).'),
  battleThemes: dict(enumeration(['studio', 'sea', 'grass'], 'Theme', 'Θέμα', 'The look of the battle background.'), 'Battle backgrounds', 'Φόντα μάχης', 'The battle background of a map (a map that is not listed uses grass).'),
}, 'Game', 'Παιχνίδι', 'The tunable numbers of the rules and the ids the engine names.');

// ---- types, statuses, abilities ------------------------------------------------------------------------------------------
const typeSchema = object({
  strong: list(ref('types', 'Type', 'Τύπος', 'A type.'), 'Strong against', 'Δυνατός απέναντι', 'The types this type hits for double damage.'),
  weak: list(ref('types', 'Type', 'Τύπος', 'A type.'), 'Weak against', 'Αδύναμος απέναντι', 'The types this type hits for half damage.'),
  color: color('Colour', 'Χρώμα', 'The colour of the type tag.'),
  mark: list(text('Row', 'Γραμμή', 'Five characters, # filled and . empty.'), 'Mark', 'Σήμα', 'The 5 x 5 shape beside the type colour, so the type can be told without colour.', { as: 'rows' }),
}, 'Type', 'Τύπος', 'A creature and move type.');
// What an ability or a status does is a *kind* that the rules code implements (src/rules/07-damage.js ... 08a-turns.js) and the numbers
// of that kind (reference 13.1). A new mechanic is a new kind in the rules code with its own test; the data only chooses a kind and
// sets its numbers. ABILITY_KINDS and STATUS_KINDS list every kind with the numbers it takes and a plain description (the editor shows it).
// `params` is one object whose optional fields are the union of every number of every kind; the catalogue says which a kind takes
// (behaviourProblems checks it). The order of the fields is the order of the files.
const behaviourParams = object({
  statuses: optional(list(ref('statuses', 'Status', 'Κατάσταση', 'A status.'), 'Statuses', 'Καταστάσεις', 'The statuses it works on.')),
  status: optional(ref('statuses', 'Status', 'Κατάσταση', 'The status it works on.')),
  hpShare: optional(number('HP share', 'Ποσοστό HP', 'The behaviour is active while the HP are at most this share of the maximum (0 to 1).', { min: 0, max: 1 })),
  chance: optional(number('Chance', 'Πιθανότητα', 'The chance that it happens each time (0 to 1).', { min: 0, max: 1 })),
  divisor: optional(int('Divisor', 'Διαιρέτης', 'The share of the maximum HP is one over this number.', { min: 1 })),
  sundayMult: optional(int('Sunday multiplier', 'Πολλαπλασιαστής Κυριακής', 'The effect is multiplied by this on a Sunday.', { min: 1 })),
  mult: optional(number('Multiplier', 'Πολλαπλασιαστής', 'What it multiplies by.', { min: 0 })),
  attackMult: optional(number('Attack multiplier', 'Πολλαπλασιαστής επίθεσης', 'The attack and rhetoric stats are multiplied by this.', { min: 0 })),
  leaveHp: optional(int('HP left', 'HP που μένουν', 'The HP the creature keeps.', { min: 0 })),
  turns: optional(int('Turns', 'Γύροι', 'How many turns.', { min: 0 })),
  stages: optional(int('Stages', 'Επίπεδα', 'How many stages a stat changes.', { min: 1, max: 6 })),
  priority: optional(int('Priority', 'Προτεραιότητα', 'How much the priority of the move goes up.', { min: 1 })),
  hitsMult: optional(int('Hits multiplier', 'Πολλαπλασιαστής χτυπημάτων', 'The number of hits is multiplied by this.', { min: 2 })),
}, 'Numbers', 'Αριθμοί', 'The numbers of the behaviour; which ones depends on the kind.');
const behaviour = (params, en, el) => ({ params, description: { en, el } });
export const ABILITY_KINDS = Object.freeze({
  statusShield: behaviour(['statuses'], 'Cannot get the listed statuses.', 'Δεν παθαίνει τις καταστάσεις της λίστας.'),
  critStrike: behaviour(['status'], 'Cannot get this status; a critical hit against it gives the status to a foe that has none.', 'Δεν παθαίνει αυτή την κατάσταση· ένα κρίσιμο χτύπημα εναντίον του την προκαλεί σε αντίπαλο χωρίς κατάσταση.'),
  regenerate: behaviour(['divisor', 'sundayMult'], 'At the end of each turn it heals one divisor-th of its maximum HP, more on a Sunday.', 'Στο τέλος κάθε γύρου θεραπεύει ένα κλάσμα των μέγιστων HP, περισσότερο την Κυριακή.'),
  favourOnSwitch: behaviour(['divisor'], 'When it is switched out, the creature that comes in heals one divisor-th of its maximum HP.', 'Όταν αλλάζει, το πλάσμα που μπαίνει θεραπεύει ένα κλάσμα των μέγιστων HP του.'),
  prizeBonus: behaviour(['mult'], 'The prize money of a won fight is multiplied.', 'Τα χρήματα του επάθλου πολλαπλασιάζονται.'),
  powerWhenLow: behaviour(['hpShare', 'mult'], 'The power of its moves is multiplied while its HP are at most a share of the maximum.', 'Η ισχύς των κινήσεων πολλαπλασιάζεται όσο τα HP είναι κάτω από ένα ποσοστό του μέγιστου.'),
  multiHitAfterKo: behaviour(['hitsMult'], 'After it knocks a creature out, its next damaging move hits more times.', 'Μετά από νοκ άουτ, η επόμενη κίνησή του με ζημιά χτυπά περισσότερες φορές.'),
  surviveKo: behaviour(['leaveHp'], 'Once per fight it survives a hit that would knock it out and keeps a few HP.', 'Μία φορά ανά μάχη αντέχει ένα χτύπημα που θα το νοκ άουτ και κρατά λίγα HP.'),
  delayStatus: behaviour(['turns'], 'A status a foe gives it starts some turns later.', 'Μια κατάσταση που του δίνει ο αντίπαλος ξεκινά μερικούς γύρους αργότερα.'),
  ignoreHigherLevel: behaviour(['chance'], 'It may ignore a hit from a creature of a higher level.', 'Μπορεί να αγνοήσει χτύπημα από πλάσμα υψηλότερου επιπέδου.'),
  randomStageUp: behaviour(['stages'], 'At the end of each turn one random stat goes up.', 'Στο τέλος κάθε γύρου ένα τυχαίο στατιστικό ανεβαίνει.'),
  powerWhenAllyFallen: behaviour(['mult'], 'The power of its moves is multiplied when an ally of its own type has fainted.', 'Η ισχύς των κινήσεων πολλαπλασιάζεται όταν έχει λιποθυμήσει σύμμαχος του ίδιου τύπου.'),
  rhetoricPower: behaviour(['mult'], 'The power of its rhetoric moves is multiplied.', 'Η ισχύς των κινήσεων ρητορικής πολλαπλασιάζεται.'),
  firstMovePriority: behaviour(['priority'], 'Its first move of the fight goes first.', 'Η πρώτη κίνηση της μάχης παίζει πρώτη.'),
});
export const STATUS_KINDS = Object.freeze({
  weaken: behaviour(['attackMult'], 'Attack and rhetoric are multiplied.', 'Η επίθεση και η ρητορική πολλαπλασιάζονται.'),
  hurt: behaviour(['divisor'], 'At the end of each turn it loses one divisor-th of its maximum HP; it ends when the creature is switched out.', 'Στο τέλος κάθε γύρου χάνει ένα κλάσμα των μέγιστων HP· τελειώνει όταν το πλάσμα αλλάξει.'),
  idle: behaviour(['chance'], 'The creature may do nothing instead of acting.', 'Το πλάσμα μπορεί να μην κάνει τίποτα αντί να δράσει.'),
  pocket: behaviour(['chance', 'divisor'], 'The creature may pocket the money instead of attacking; the foe heals one divisor-th of its maximum HP.', 'Το πλάσμα μπορεί να βάλει τα λεφτά στην τσέπη αντί να επιτεθεί· ο αντίπαλος θεραπεύεται κατά ένα κλάσμα των μέγιστων HP.'),
});
const statusSchema = object({
  turns: int('Turns', 'Γύροι', 'How many turns the status lasts (0 = until the creature is switched out).', { min: 0 }),
  kind: enumeration(Object.keys(STATUS_KINDS), 'Behaviour', 'Συμπεριφορά', 'What the status does: a kind of the rules code.'),
  params: behaviourParams,
  recruitMult: number('Recruit multiplier', 'Πολλαπλασιαστής στρατολόγησης', 'The recruit chance is multiplied by this while a creature has the status.', { min: 0 }),
  color: color('Colour', 'Χρώμα', 'The colour of the status tag.'),
}, 'Status', 'Κατάσταση', 'A status a creature can get in battle.');
const abilitySchema = object({
  kind: enumeration(Object.keys(ABILITY_KINDS), 'Behaviour', 'Συμπεριφορά', 'What the ability does: a kind of the rules code.'),
  params: behaviourParams,
}, 'Ability', 'Ικανότητα', 'A passive ability of a creature: a kind of the rules code and its numbers.');

// The problems of the behaviour of the abilities and statuses of a DATA object (an empty list = every entry names a kind of the
// catalogue and gives exactly the numbers that kind takes).
export function behaviourProblems(data) {
  const problems = [];
  const check = (label, entries, catalogue) => {
    for (const [id, entry] of Object.entries(entries ?? {})) {
      const found = catalogue[entry.kind];
      if (!found) { problems.push(`${label} ${id}: "${entry.kind}" is not a kind of the catalogue`); continue; }
      const given = Object.keys(entry.params ?? {}).sort().join(', ');
      const wanted = [...found.params].sort().join(', ');
      if (given !== wanted) problems.push(`${label} ${id}: the kind ${entry.kind} takes ${wanted}, the entry has ${given}`);
    }
  };
  check('ability', data.abilities, ABILITY_KINDS);
  check('status', data.statuses, STATUS_KINDS);
  return problems;
}

// ---- moves ---------------------------------------------------------------------------------------------------------------
const stageChange = tuple([
  enumeration(['self', 'foe'], 'Who', 'Ποιος', 'Who is changed.'),
  enumeration(['atk', 'def', 'rat', 'rde', 'spe', 'acc'], 'Stat', 'Στατιστικό', 'The stat that changes.'),
  int('Stages', 'Επίπεδα', 'How many stages (negative lowers).', { min: -6, max: 6 }),
  int('Chance %', 'Πιθανότητα %', 'Chance in percent.', { min: 0, max: 100 }),
], 'Stat change', 'Αλλαγή στατιστικού', 'Who, which stat, how many stages, chance in percent.');
const moveSchema = object({
  n: text('Name', 'Όνομα', 'The Greek name shown in battle.'),
  t: ref('types', 'Type', 'Τύπος', 'The type of the move.'),
  c: enumeration(['p', 'r', 's'], 'Category', 'Κατηγορία', 'p = physical, r = rhetoric, s = status.'),
  p: int('Power', 'Ισχύς', 'Base power (0 for a move that does no damage).', { min: 0 }),
  a: int('Accuracy', 'Ακρίβεια', 'Chance to hit, in percent.', { min: 0, max: 100 }),
  heal: optional(number('Heal', 'Θεραπεία', 'Share of the maximum HP the user heals.', { min: 0 })),
  noAbility: optional(int('Ignore ability', 'Αγνόηση ικανότητας', 'Turns the foe ability is ignored.', { min: 0 })),
  decoy: optional(bool('Decoy', 'Δόλωμα', 'Puts up a decoy.')),
  fracDmg: optional(number('Fraction damage', 'Ζημιά κλάσματος', 'Damage as a share of the foe maximum HP.', { min: 0 })),
  bothSt: optional(ref('statuses', 'Status on both', 'Κατάσταση και στους δύο', 'A status both fighters get.')),
  gag: optional(int('Gag', 'Φίμωση', 'Turns the foe cannot use rhetoric.', { min: 0 })),
  stg: optional(list(stageChange, 'Stat changes', 'Αλλαγές στατιστικών', 'The stat changes of the move.')),
  trap: optional(int('Trap', 'Παγίδευση', 'Turns the foe cannot switch.', { min: 0 })),
  prio: optional(int('Priority', 'Προτεραιότητα', 'Moves with a higher priority go first.', { min: 0 })),
  recharge: optional(bool('Recharge', 'Επαναφόρτιση', 'The user loses its next turn.')),
  cureSelf: optional(bool('Cures the user', 'Θεραπεύει τον χρήστη', 'Clears the status of the user.')),
  recoil: optional(number('Recoil', 'Ανάκρουση', 'Share of the damage the user takes back.', { min: 0 })),
  hits: optional(int('Hits', 'Χτυπήματα', 'How many times the move hits.', { min: 1 })),
  blockStatus: optional(bool('Blocks status', 'Μπλοκάρει κατάσταση', 'The foe cannot get a status.')),
  drain: optional(number('Drain', 'Απορρόφηση', 'Share of the damage the user heals.', { min: 0 })),
  lobby: optional(bool('Lobby', 'Λόμπι', 'The lobbying effect.')),
  selfHurt: optional(number('Self damage', 'Ζημιά στον εαυτό', 'Share of the maximum HP the user loses.', { min: 0 })),
  rand: optional(tuple([int('Least', 'Ελάχιστο', 'Smallest power.', { min: 0 }), int('Most', 'Μέγιστο', 'Largest power.', { min: 0 })], 'Random power', 'Τυχαία ισχύς', 'The power is picked between two numbers.')),
  healBoth: optional(number('Heal both', 'Θεραπεία και των δύο', 'Share of the maximum HP both fighters heal.', { min: 0 })),
  promise: optional(bool('Promise', 'Υπόσχεση', 'The promise effect.')),
  team: optional(bool('Whole team', 'Όλη η ομάδα', 'The effect reaches the whole team.')),
  foeSkip: optional(int('Foe skips', 'Ο αντίπαλος χάνει', 'Turns the foe loses.', { min: 0 })),
  sure: optional(bool('Never misses', 'Δεν αστοχεί', 'The move always hits.')),
  foeSt: optional(tuple([ref('statuses', 'Status', 'Κατάσταση', 'The status the foe gets.'), int('Chance %', 'Πιθανότητα %', 'Chance in percent.', { min: 0, max: 100 })], 'Foe status', 'Κατάσταση αντιπάλου', 'A status the foe can get, with its chance in percent.')),
  money: optional(int('Money', 'Χρήματα', 'The money effect.', { min: 0 })),
}, 'Move', 'Κίνηση', 'A move a creature can use.');

// ---- species, items, shops, trainers -------------------------------------------------------------------------------------
const speciesSchema = object({
  n: text('Name', 'Όνομα', 'The Greek name.'),
  t: ref('types', 'Type', 'Τύπος', 'The type of the creature.'),
  ab: ref('abilities', 'Ability', 'Ικανότητα', 'The ability of the creature.'),
  g: enumeration(['m', 'f', 'n'], 'Gender of the name', 'Γένος του ονόματος', 'm, f or n: the Greek article of the name.'),
  starter: optional(bool('Starter', 'Αρχικό', 'The professor may offer it.')),
  rec: int('Recruit rate', 'Ποσοστό στρατολόγησης', 'Chance to recruit, 0 to 100 (0 = cannot be recruited).', { min: 0, max: 100 }),
  xp: int('Experience yield', 'Εμπειρία', 'The base experience a defeated one gives.', { min: 0 }),
  evo: optional(object({
    to: ref('species', 'Evolves into', 'Εξελίσσεται σε', 'The creature it becomes.'),
    lv: int('At level', 'Στο επίπεδο', 'The level of the evolution.', { min: 1 }),
  }, 'Evolution', 'Εξέλιξη', 'What the creature evolves into.')),
  parody: optional(bool('Parody character', 'Παρωδία', 'One of the two marked parody characters.')),
  base: tuple([
    int('HP', 'HP', 'Base hit points.', { min: 1 }), int('Attack', 'Επίθεση', 'Base attack.', { min: 1 }), int('Defence', 'Άμυνα', 'Base defence.', { min: 1 }),
    int('Rhetoric', 'Ρητορική', 'Base rhetoric attack.', { min: 1 }), int('Rhetoric defence', 'Ρητορική άμυνα', 'Base rhetoric defence.', { min: 1 }), int('Speed', 'Ταχύτητα', 'Base speed.', { min: 1 }),
  ], 'Base stats', 'Βασικά στατιστικά', 'hp, atk, def, rat, rde, spe.'),
  learn: list(tuple([int('Level', 'Επίπεδο', 'The level it learns the move.', { min: 1 }), ref('moves', 'Move', 'Κίνηση', 'The move.')], 'Learned move', 'Μάθηση', 'A level and a move.'), 'Learnset', 'Κινήσεις', 'The moves it learns, by level.'),
}, 'Species', 'Είδος', 'A creature.');
const itemSchema = object({
  kind: enumeration(['recruit', 'heal', 'cure'], 'Kind', 'Είδος', 'recruit = an envelope for recruiting, heal = heals HP, cure = clears a status.'),
  mult: optional(number('Recruit multiplier', 'Πολλαπλασιαστής', 'The multiplier of the recruit chance.', { min: 0 })),
  amount: optional(int('Heals', 'Θεραπεύει', 'HP healed (9999 = all).', { min: 0 })),
  accDown: optional(bool('Lowers accuracy', 'Μειώνει ακρίβεια', 'The creature loses accuracy afterwards.')),
  cures: optional(bool('Cures status', 'Θεραπεύει κατάσταση', 'Also clears a status.')),
  price: int('Price', 'Τιμή', 'The shop price.', { min: 0 }),
}, 'Item', 'Αντικείμενο', 'A bag item.');
const shopSchema = object({
  items: list(ref('items', 'Item', 'Αντικείμενο', 'An item on sale.'), 'Items', 'Αντικείμενα', 'What the kiosk sells, in order.'),
}, 'Shop', 'Κατάστημα', 'The stock of a kiosk.');
const victorySchema = object({
  flag: text('Badge flag', 'Σημαία παρασήμου', 'The story flag the win sets.'),
  win2: stringKey('First line', 'Πρώτη φράση', 'The line after the win.'),
  title: stringKey('Badge title', 'Τίτλος παρασήμου', 'The text of the badge card.'),
  sub: stringKey('Badge subtitle', 'Υπότιτλος παρασήμου', 'The second text of the badge card.'),
  win3: stringKey('Line after the card', 'Φράση μετά την κάρτα', 'The line after the badge card.'),
  chapterCard: optional(bool('Chapter card', 'Κάρτα κεφαλαίου', 'Shows the chapter card (the first boss).')),
  ribbon: optional(color('Ribbon colour', 'Χρώμα κορδέλας', 'The colour of the badge ribbon.')),
  credits: optional(bool('Rolls the credits', 'Ξεκινά τους τίτλους', 'The last fight: the credits roll.')),
}, 'Victory', 'Νίκη', 'What a won boss fight plays.');
const trainerSchema = object({
  name: text('Name', 'Όνομα', 'The Greek name.'),
  look: text('Look', 'Εμφάνιση', 'The look (a character drawing) of the trainer.'),
  boss: optional(bool('Boss', 'Αρχηγός', 'A district boss.')),
  recruitable: optional(bool('Recruitable', 'Στρατολογήσιμος', 'The trainer joins instead of fighting for money.')),
  recruitOnly: optional(ref('items', 'Recruit only with', 'Στρατολόγηση μόνο με', 'The item that recruits the trainer.')),
  bonus: optional(int('Bonus money', 'Μπόνους χρημάτων', 'Extra prize money.', { min: 0 })),
  victory: optional(victorySchema),
  boost: optional(number('Boost', 'Ενίσχυση', 'Multiplies the stats of the team.', { min: 0 })),
  team: list(object({
    sp: text('Species', 'Είδος', 'A species id, or $rival, $rivalEvo or $rivalFinal (the rival creature).'),
    lv: int('Level', 'Επίπεδο', 'The level.', { min: 1 }),
  }, 'Member', 'Μέλος', 'A creature of the team.'), 'Team', 'Ομάδα', 'The creatures, in order.'),
  items: list(ref('items', 'Item', 'Αντικείμενο', 'An item.'), 'Items', 'Αντικείμενα', 'The items the trainer uses in the fight.'),
}, 'Trainer', 'Προπονητής', 'A trainer.');

// ---- tiles, maps ---------------------------------------------------------------------------------------------------------
const tileSchema = object({
  char: text('Character', 'Χαρακτήρας', 'The one character of the tile in map rows.'),
  solid: bool('Solid', 'Συμπαγές', 'The player cannot walk on it.'),
  grass: optional(bool('Tall grass', 'Ψηλό χορτάρι', 'Wild creatures appear here.')),
  counter: optional(bool('Counter', 'Πάγκος', 'Someone behind it can be talked to across it.')),
}, 'Tile', 'Πλακίδιο', 'A tile of the maps.');
const npcSchema = object({
  id: text('Id', 'Κωδικός', 'The id of the person on this map.'),
  x: int('Column', 'Στήλη', 'Tile column.', { min: 0 }),
  y: int('Row', 'Γραμμή', 'Tile row.', { min: 0 }),
  face: enumeration(['up', 'down', 'left', 'right'], 'Facing', 'Κατεύθυνση', 'The way the person faces.'),
  look: text('Look', 'Εμφάνιση', 'The look (a character drawing).'),
  kind: enumeration(['talk', 'prof', 'kep', 'heal', 'shop', 'save', 'trainer', 'boss', 'legend'], 'Kind', 'Είδος', 'What talking to the person does.'),
  text: optional(stringKey('Text', 'Κείμενο', 'The key of what the person says.')),
  trainer: optional(ref('trainers', 'Trainer', 'Προπονητής', 'The trainer the person is.')),
  species: optional(ref('species', 'Species', 'Είδος', 'The legend creature.')),
  healKeys: optional(dict(stringKey('Text', 'Κείμενο', 'A text key.'), 'Healer texts', 'Κείμενα θεραπευτή', 'The texts of a healer (hello, free, atOnce, done).')),
  sight: optional(int('Sight', 'Όραση', 'How many tiles away a trainer sees the player.', { min: 0 })),
  level: optional(int('Level', 'Επίπεδο', 'The level of the legend creature.', { min: 1 })),
  boost: optional(number('Boost', 'Ενίσχυση', 'Multiplies the stats of the legend creature.', { min: 0 })),
  showFlag: optional(text('Show when', 'Εμφάνιση όταν', 'The person only appears once this flag is set.')),
  hideFlag: optional(text('Hide when', 'Απόκρυψη όταν', 'The person is gone once this flag is set.')),
}, 'Person', 'Άτομο', 'A person on a map.');
const warpSchema = object({
  x: int('Column', 'Στήλη', 'Tile column of the door.', { min: 0 }),
  y: int('Row', 'Γραμμή', 'Tile row of the door.', { min: 0 }),
  to: ref('maps', 'To map', 'Προς χάρτη', 'The map the door leads to.'),
  tx: int('Target column', 'Στήλη προορισμού', 'Tile column on the target map.', { min: 0 }),
  ty: int('Target row', 'Γραμμή προορισμού', 'Tile row on the target map.', { min: 0 }),
  needFlag: optional(text('Needs flag', 'Απαιτεί σημαία', 'The door opens once this flag is set.')),
  lockedText: optional(stringKey('Locked text', 'Κείμενο κλειδώματος', 'What is said while the door is shut.')),
}, 'Door', 'Πόρτα', 'A door to another map.');
const zoneSchema = object({
  x0: int('From column', 'Από στήλη', 'The first column of the zone.', { min: 0 }),
  x1: int('To column', 'Έως στήλη', 'The last column of the zone.', { min: 0 }),
  table: list(object({
    sp: ref('species', 'Species', 'Είδος', 'A wild creature.'),
    w: int('Weight', 'Βάρος', 'How often it appears compared with the others.', { min: 1 }),
    min: int('Lowest level', 'Χαμηλότερο επίπεδο', 'The lowest level.', { min: 1 }),
    max: int('Highest level', 'Υψηλότερο επίπεδο', 'The highest level.', { min: 1 }),
  }, 'Wild creature', 'Άγριο πλάσμα', 'A creature of the zone.'), 'Table', 'Πίνακας', 'The wild creatures of the zone.'),
}, 'Zone', 'Ζώνη', 'A range of columns where wild creatures appear.');
const mapSchema = object({
  name: stringKey('Name', 'Όνομα', 'The key of the name of the map.'),
  w: int('Width', 'Πλάτος', 'Tiles across.', { min: 1 }),
  h: int('Height', 'Ύψος', 'Tiles down.', { min: 1 }),
  music: ref('music', 'Music', 'Μουσική', 'The tune of the map.'),
  rows: list(text('Row', 'Γραμμή', 'One tile character per column.'), 'Tiles', 'Πλακίδια', 'The tile characters of the map, row by row.', { as: 'rows' }),
  stock: optional(ref('shops', 'Shop', 'Κατάστημα', 'The kiosk of the map sells the stock of this shop.')),
  cafeHello: optional(stringKey('Café greeting', 'Χαιρετισμός καφενείου', 'What the café owner says.')),
  warps: list(warpSchema, 'Doors', 'Πόρτες', 'The doors of the map.'),
  signs: dict(stringKey('Text', 'Κείμενο', 'The text key.'), 'Signs', 'Πινακίδες', 'The signs of the map (column,row: text key).'),
  actions: optional(dict(text('Action', 'Ενέργεια', 'The action of the tile.'), 'Actions', 'Ενέργειες', 'Tiles that start an action (column,row: action).')),
  npcs: list(npcSchema, 'People', 'Άτομα', 'The people of the map.'),
  triggers: optional(list(object({
    x: int('Column', 'Στήλη', 'Tile column.', { min: 0 }),
    y: int('Row', 'Γραμμή', 'Tile row.', { min: 0 }),
    flag: text('Flag', 'Σημαία', 'The event runs while this flag is not set.'),
    event: ref('events', 'Event', 'Γεγονός', 'The event that runs.'),
  }, 'Trigger', 'Σκανδάλη', 'A tile that runs an event once.'), 'Triggers', 'Σκανδάλες', 'The tiles that run an event.')),
  zones: optional(list(zoneSchema, 'Wild zones', 'Ζώνες', 'Where wild creatures appear.')),
}, 'Map', 'Χάρτης', 'A map.');

// ---- the world map screen: world.json and districts ---------------------------------------------------------------------
const worldSchema = object({
  cols: int('Columns', 'Στήλες', 'Cells across the schematic map.', { min: 1 }),
  rows: int('Rows', 'Γραμμές', 'Cells down the schematic map.', { min: 1 }),
  grid: list(text('Row', 'Γραμμή', 'One letter per cell.'), 'Grid', 'Πλέγμα', 'Upper case = a district, lower case = a hill of it, ~ = sea, # = mainland.', { as: 'rows' }),
  badgeCount: int('Badges', 'Παράσημα', 'How many district badges there are.', { min: 0 }),
}, 'World', 'Κόσμος', 'The schematic map of the country.');
const placeSchema = object({
  kind: enumeration(['town', 'boss', 'door'], 'Kind', 'Είδος', 'town, boss (the boss building of a district) or door (the Parliament).'),
  cell: tuple([int('Column', 'Στήλη', 'Cell column.', { min: 0 }), int('Row', 'Γραμμή', 'Cell row.', { min: 0 })], 'Cell', 'Κελί', 'Where the place is on the schematic map.'),
  maps: list(ref('maps', 'Map', 'Χάρτης', 'A map of the place.'), 'Maps', 'Χάρτες', 'The game maps that belong to the place.'),
  boss: optional(bool('Boss here', 'Αρχηγός εδώ', 'The boss of the district is here.')),
  stop: optional(bool('Bus stop', 'Στάση', 'A bus stop stands here.')),
  built: bool('Built', 'Έτοιμο', 'False = drawn locked ("soon").'),
  seenFlag: optional(text('Seen when', 'Ορατό όταν', 'The flag that tells the player about the place.')),
  levels: optional(tuple([int('From', 'Από', 'Lowest level.', { min: 1 }), int('To', 'Έως', 'Highest level.', { min: 1 })], 'Levels', 'Επίπεδα', 'Its own level range.')),
  has: list(text('Feature', 'Χαρακτηριστικό', 'What the info panel lists.'), 'Has', 'Διαθέτει', 'What the info panel lists.'),
}, 'Place', 'Τόπος', 'A place of a district.');
const routeSchema = object({
  a: text('From', 'Από', 'The place at the first end.'),
  b: text('To', 'Προς', 'The place at the second end.'),
  map: ref('maps', 'Map', 'Χάρτης', 'The map of the route.'),
  path: list(tuple([int('Column', 'Στήλη', 'Cell column.', { min: 0 }), int('Row', 'Γραμμή', 'Cell row.', { min: 0 })], 'Cell', 'Κελί', 'A cell of the path.'), 'Path', 'Διαδρομή', 'The cells of the route from its first end to its second.'),
  progress: enumeration(['x', '-x', 'y'], 'Direction', 'Κατεύθυνση', 'The way the map runs, for the player marker.'),
  built: bool('Built', 'Έτοιμο', 'False = drawn locked.'),
}, 'Route', 'Διαδρομή', 'A route between two places.');
const districtSchema = object({
  letter: text('Letter', 'Γράμμα', 'The letter of the district in the grid.'),
  order: int('Order', 'Σειρά', 'The play order.', { min: 1 }),
  bossTrainer: ref('trainers', 'Boss', 'Αρχηγός', 'The boss trainer.'),
  badgeFlag: text('Badge flag', 'Σημαία παρασήμου', 'The flag the boss sets.'),
  nameKey: stringKey('Name', 'Όνομα', 'The key of the name.'),
  levels: tuple([int('From', 'Από', 'Lowest level.', { min: 1 }), int('To', 'Έως', 'Highest level.', { min: 1 })], 'Wild levels', 'Επίπεδα', 'The wild level range.'),
  color: color('Colour', 'Χρώμα', 'The colour on the map screen.'),
  label: tuple([number('Column', 'Στήλη', 'Where the name sits (cell units).', { min: 0 }), number('Row', 'Γραμμή', 'Where the name sits (cell units).', { min: 0 })], 'Label place', 'Θέση ετικέτας', 'Where the name sits.'),
  built: bool('Built', 'Έτοιμο', 'False = drawn locked.'),
  places: dict(placeSchema, 'Places', 'Τόποι', 'The places of the district.'),
  routes: dict(routeSchema, 'Routes', 'Διαδρομές', 'The routes of the district.'),
}, 'District', 'Περιοχή', 'A district of the world map.');

// ---- events, strings, sounds, music --------------------------------------------------------------------------------------
// The steps of an event: a fixed catalogue (13.1). `step` names the kind; the rest depends on it.
const eventStepSchema = node('object', 'Step', 'Βήμα', 'One step of an event.', { open: 'step' });
const eventSchema = list(eventStepSchema, 'Event', 'Γεγονός', 'A list of steps.');
const stringsSchema = dict(object({
  el: text('Greek', 'Ελληνικά', 'The Greek text.'),
  en: text('English', 'Αγγλικά', 'The English text (empty = the game shows the Greek one).'),
}, 'Text', 'Κείμενο', 'A text in both languages.'), 'Texts of a group', 'Κείμενα ομάδας', 'The texts of one group, by key.');
const soundSchema = object({
  type: enumeration(['synth'], 'Type', 'Τύπος', 'synth = notes played by the sound engine.'),
  notes: list(object({
    at: number('Start', 'Έναρξη', 'Seconds after the start.', { min: 0 }),
    freq: number('Frequency', 'Συχνότητα', 'Hertz.', { min: 1 }),
    dur: number('Length', 'Διάρκεια', 'Seconds.', { min: 0 }),
    wave: enumeration(['sine', 'square', 'sawtooth', 'triangle'], 'Wave', 'Κυματομορφή', 'The shape of the tone.'),
    vol: number('Volume', 'Ένταση', 'From 0 to 1.', { min: 0, max: 1 }),
    slideTo: optional(number('Slide to', 'Γλίστρημα προς', 'Frequency in hertz the tone slides to.', { min: 1 })),
  }, 'Note', 'Νότα', 'One tone.'), 'Notes', 'Νότες', 'The tones of the effect.'),
}, 'Sound', 'Ήχος', 'A sound effect.');
const musicSchema = object({
  bpm: int('Tempo', 'Ρυθμός', 'Beats per minute.', { min: 1 }),
  stepsPerBeat: int('Steps per beat', 'Βήματα ανά παλμό', 'How many steps one beat has.', { min: 1 }),
  channels: list(object({
    name: text('Name', 'Όνομα', 'The name of the channel.'),
    wave: enumeration(['sine', 'square', 'sawtooth', 'triangle'], 'Wave', 'Κυματομορφή', 'The shape of the tone.'),
    vol: number('Volume', 'Ένταση', 'From 0 to 1.', { min: 0, max: 1 }),
    gate: number('Gate', 'Διάρκεια νότας', 'The length of a note in steps.', { min: 0 }),
  }, 'Channel', 'Κανάλι', 'One voice.'), 'Channels', 'Κανάλια', 'The voices of the tune.'),
  patterns: dict(object({
    steps: int('Steps', 'Βήματα', 'The length of the pattern.', { min: 1 }),
    notes: list(list(int('Note', 'Νότα', 'A MIDI number (0 = rest).', { min: 0, max: 127 }), 'Notes of a channel', 'Νότες καναλιού', 'One note per step.'), 'Channels', 'Κανάλια', 'The notes of each channel.'),
  }, 'Pattern', 'Μοτίβο', 'A row of steps.'), 'Patterns', 'Μοτίβα', 'The patterns of the tune.'),
  order: list(text('Pattern', 'Μοτίβο', 'A pattern id.'), 'Order', 'Σειρά', 'The patterns in the order they play.'),
  loop: bool('Loop', 'Επανάληψη', 'The tune plays again from its start.'),
}, 'Tune', 'Μελωδία', 'A tune.');

// One entry per kind, in the order of the DATA object. storage: 'single' = data/<file>, 'folder' = data/<folder>/<id>.json plus
// index.json, 'groups' = data/strings/<group>.json plus index.json (the list of groups).
export const KINDS = Object.freeze({
  game: { storage: 'single', file: 'game.json', schema: gameSchema },
  types: { storage: 'folder', folder: 'types', schema: typeSchema },
  statuses: { storage: 'folder', folder: 'statuses', schema: statusSchema },
  abilities: { storage: 'folder', folder: 'abilities', schema: abilitySchema },
  moves: { storage: 'folder', folder: 'moves', schema: moveSchema },
  species: { storage: 'folder', folder: 'species', schema: speciesSchema },
  items: { storage: 'folder', folder: 'items', schema: itemSchema },
  shops: { storage: 'folder', folder: 'shops', schema: shopSchema },
  trainers: { storage: 'folder', folder: 'trainers', schema: trainerSchema },
  tiles: { storage: 'folder', folder: 'tiles', schema: tileSchema },
  maps: { storage: 'folder', folder: 'maps', schema: mapSchema },
  world: { storage: 'single', file: 'world.json', schema: worldSchema },
  districts: { storage: 'folder', folder: 'districts', schema: districtSchema },
  events: { storage: 'folder', folder: 'events', schema: eventSchema },
  strings: { storage: 'groups', folder: 'strings', schema: stringsSchema },
  sounds: { storage: 'folder', folder: 'sounds', schema: soundSchema },
  music: { storage: 'folder', folder: 'music', schema: musicSchema },
});

// ---- Working with a schema -----------------------------------------------------------------------------------------------
// Returns a copy of the value whose object keys follow the schema's field order; a key the schema does not know is an error.
export function orderBySchema(schema, value, path = '') {
  switch (schema.type) {
    case 'object': {
      if (schema.open) return value; // an event step: its own fixed catalogue decides
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path || 'value'} must be an object`);
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.fields, key)) throw new Error(`${path}.${key} is not a field of the schema`);
      }
      const ordered = {};
      for (const [key, field] of Object.entries(schema.fields)) {
        if (Object.hasOwn(value, key)) ordered[key] = orderBySchema(field, value[key], `${path}.${key}`);
      }
      return ordered;
    }
    case 'dict': {
      const ordered = {};
      for (const [key, item] of Object.entries(value)) ordered[key] = orderBySchema(schema.value, item, `${path}.${key}`);
      return ordered;
    }
    case 'list':
      return value.map((item, index) => orderBySchema(schema.item, item, `${path}[${index}]`));
    default:
      return value;
  }
}

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

// A list of problems (empty when the value fits the schema): wrong types, missing fields, numbers out of range.
export function schemaProblems(schema, value, path = 'value') {
  const problems = [];
  const bad = (message) => problems.push(`${path}: ${message}`);
  switch (schema.type) {
    case 'text': case 'stringKey': case 'ref':
      if (typeof value !== 'string') bad('must be text');
      break;
    case 'int':
      if (!Number.isInteger(value)) bad('must be a whole number');
      else if ((schema.min !== undefined && value < schema.min) || (schema.max !== undefined && value > schema.max)) bad(`${value} is out of range`);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) bad('must be a number');
      else if ((schema.min !== undefined && value < schema.min) || (schema.max !== undefined && value > schema.max)) bad(`${value} is out of range`);
      break;
    case 'bool':
      if (typeof value !== 'boolean') bad('must be true or false');
      break;
    case 'color':
      if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) bad('must be a colour like #aabbcc');
      break;
    case 'enum':
      if (!schema.values.includes(value)) bad(`must be one of ${schema.values.join(', ')}`);
      break;
    case 'list':
      if (!Array.isArray(value)) bad('must be a list');
      else value.forEach((item, index) => problems.push(...schemaProblems(schema.item, item, `${path}[${index}]`)));
      break;
    case 'tuple':
      if (!Array.isArray(value) || value.length !== schema.items.length) bad(`must be a list of ${schema.items.length}`);
      else value.forEach((item, index) => problems.push(...schemaProblems(schema.items[index], item, `${path}[${index}]`)));
      break;
    case 'dict':
      if (value === null || typeof value !== 'object' || Array.isArray(value)) bad('must be an object');
      else for (const [key, item] of Object.entries(value)) problems.push(...schemaProblems(schema.value, item, `${path}.${key}`));
      break;
    case 'object':
      if (schema.open) {
        if (value === null || typeof value !== 'object' || typeof value[schema.open] !== 'string') bad(`must be an object with a text "${schema.open}"`);
        break;
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value)) { bad('must be an object'); break; }
      for (const key of Object.keys(value)) if (!Object.hasOwn(schema.fields, key)) bad(`${key} is not a field`);
      for (const [key, field] of Object.entries(schema.fields)) {
        if (Object.hasOwn(value, key)) problems.push(...schemaProblems(field, value[key], `${path}.${key}`));
        else if (!field.optional) bad(`${key} is missing`);
      }
      break;
    default:
      bad(`unknown schema type ${schema.type}`);
  }
  return problems;
}

// Walks a schema and calls visit(node, value, path) for every value that has a node: the use finder and validation build on it.
export function walkWithSchema(schema, value, visit, path = '') {
  visit(schema, value, path);
  if (schema.type === 'object' && !schema.open && value && typeof value === 'object') {
    for (const [key, field] of Object.entries(schema.fields)) if (Object.hasOwn(value, key)) walkWithSchema(field, value[key], visit, `${path}.${key}`);
  } else if (schema.type === 'list' && Array.isArray(value)) {
    value.forEach((item, index) => walkWithSchema(schema.item, item, visit, `${path}[${index}]`));
  } else if (schema.type === 'tuple' && Array.isArray(value)) {
    value.forEach((item, index) => walkWithSchema(schema.items[index], item, visit, `${path}[${index}]`));
  } else if (schema.type === 'dict' && value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) walkWithSchema(schema.value, item, visit, `${path}.${key}`);
  }
}
