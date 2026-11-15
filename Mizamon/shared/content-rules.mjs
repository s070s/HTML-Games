// The content rules of the texts (reference section 13.6, "The content rules"): the deny lists of real brands, people and parties, the
// copied-phrase lists, the gendered-forms check, the hospital's word lists and the word lists of the district tests. validate.mjs and
// run-tests.mjs both read them from here, so a list exists once. The values are those of run-tests.mjs (DEV-02c moved them).
// Node built-ins only (none needed).

// ---- Section 11.8: no real brand, person or party in any text --------------------------------------------------------------
// Compared without case and without accents. The marked parodies (Μιζοτάκης, Σπυράδωνις, Νέα Δημοκτατορία) must not match.
export const DENIED_WHOLE_WORDS = ['Airbnb', 'Starbucks', 'Coca-Cola', 'Coca Cola', 'Facebook', 'Instagram', 'TikTok', 'Google', 'Amazon',
  'Netflix', 'Uber', 'Wolt', 'efood', 'Lidl', 'Vodafone', 'Cosmote', 'OPAP', 'ΟΠΑΠ', 'ΝΔ', 'Νέα Δημοκρατία', 'ΣΥΡΙΖΑ', 'ΠΑΣΟΚ', 'ΚΚΕ', 'Ελληνική Λύση', 'Χρυσή Αυγή',
  'Syriza', 'Pasok', 'KKE', 'ND', 'New Democracy', 'Golden Dawn', 'Greek Solution',
  'Blue Star', 'Minoan', 'Anek', 'Seajets', 'Hellenic Seaways', 'Attica Group', 'ΑΝΕΚ', 'Μινωικές', 'Μπλου Σταρ', 'Σιτζετς'];
export const DENIED_NAME_STEMS = ['McDonald', 'Μητσοτάκ', 'Τσίπρα', 'Ανδρουλάκ', 'Βελόπουλ', 'Κουτσούμπ', 'Γεωργιάδ', 'Mitsotak', 'Tsipras', 'Androulak', 'Velopoul', 'Koutsoumb', 'Georgiad'];
// common words that are also brands: checked on the raw text, capitalised whole words only
export const DENIED_CAPITALISED_WORDS = /(?<![\p{L}\p{N}])(?:Apple|Meta)(?![\p{L}\p{N}])/u;
// The two parody characters, each with its Greek and its English spelling, and the parody party (13.6: the parody names only on the two
// parody characters; the party only marked as a parody). PARODIES is every one of them, for the deny-list test.
export const PARODY_CHARACTERS = [['Μιζοτάκης', 'Mizotakis'], ['Σπυράδωνις', 'Spyradonis']];
export const PARODY_PARTY_NAMES = ['Νέα Δημοκτατορία', 'New Democratorship'];
export const PARODIES = [...PARODY_CHARACTERS.flat(), ...PARODY_PARTY_NAMES];
// What marks a text as a parody (compared on plainText): "παρωδία" / "ΠΑΡΩΔΙΑ" in Greek, "parody" in English.
export const PARODY_MARK = /παρωδ|parody/;
export const plainText = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escapeForRegex = (text) => plainText(text).replace(/[.*+?^$()|[\]{}\\]/g, '\\$&').replace(/ /g, '[ -]');
export const DENY_PATTERN = new RegExp('(?<![\\p{L}\\p{N}])(?:(?:' + DENIED_WHOLE_WORDS.map(escapeForRegex).join('|') + ')(?![\\p{L}\\p{N}])|(?:' + DENIED_NAME_STEMS.map(escapeForRegex).join('|') + '))', 'u');

// The text a deny list matched in a text, or null.
export function denyListHit(text) {
  const found = plainText(text).match(DENY_PATTERN) || text.match(DENIED_CAPITALISED_WORDS);
  return found ? found[0] : null;
}

// ---- The copied phrasing of the battle texts, and the gendered forms --------------------------------------------------------
export const COPIED_ENGLISH_PHRASES = [/what will .* do/i, /\bused \{move\}/i, /^go,/i, /come back/i, /^a critical hit/i, /super effective/i, /not very effective/i, /blacked out/i,
  /is evolving/i, /wants to learn/i, /^congratulations! it/i, /sends out/i, /\bmissed!/i, /^hit \{n\} times/i];
export const COPIED_GREEK_PHRASES = [/χρησιμοποίησε/, /Σούπερ αποτελεσματικό/, /Εύστοχο χτύπημα/, /στέλνει στη μάχη/, /τι κάνει;/, /Επιστρέφει:/, /Λιποθύμησες/, /εξελίσσεται\.\.\./, /Συγχαρητήρια/];
// The player may be a woman: forms that only fit a man must sit inside a {man|woman} choice.
export const MASCULINE_ONLY_FORMS = /(διάσημος|μόνος|έτοιμος|ανιψιέ|φίλε|κύριε|νεαρέ|αγόρι μου|γίνεις προπονητής)/;

// ---- The hospital: nothing copies another game, and the jokes are about the system, never about patients or illness -------------
export const HOSPITAL_COPIED_ENGLISH = /nurse|joy\b|pok[eé]|red cross|we hope to see you again|restored to full|welcome to our|we heal your/i;
export const HOSPITAL_COPIED_GREEK = /νοσοκόμα|τζόι|κόκκινος σταυρός|ελπίζουμε να σε ξαναδούμε|θα σε ξαναδούμε|καλώς ήρθες στο κέντρο|θεραπεύουμε/i;
export const HOSPITAL_PATIENT_WORDS = /(^|\s)(ασθενής|ασθενείς|αρρώστ|πάσχ|καρκίν|θάνατ)/i;

// ---- Word lists of the district tests (no faith, no real monument or violence), compared on plainText ------------------------
export const FAITH_WORDS = /προσευχ|αγιασμ|σταυρ|θυμιαμ|λιτανει|λειτουργ|εξομολογ|χριστ|θεου|θεος|prayer|pray |saint|holy|cross|incense|ritual|liturg|bless|sacred|faith|priest|baptis|(?<!\p{L})(?:αγιο|αγια)|παναγι|θεε(?!\p{L})|ευλογ|εικονισμ|εικονοστ|προσκυν|θαυμα(?!σ)/u;
export const ATHINA_FORBIDDEN_WORDS = /παρεκκλ|εκκλησ|chapel|church|τζαμ|sinagog|ακροπολ|παρθενών|parthenon|acropolis|λυκαβηττ|lycabettus|χούντα|χουντα|junta|πολυτεχνει|polytechnic|riot|ταραχ|δακρυγόν|tear gas|νεκρ|σκοτώ|killed|violence|βία(?!\p{L})|πυρκαγι|wildfire/u;
// no real monument name on the names of the shops and the café of Μοναστηράκι and Σύνταγμα
export const MONUMENT_WORDS = /(ακροπολ|παρθενών|acropolis|parthenon|βράχος|rock)/;
// the credits text: no AI attribution and no name
export const CREDITS_FORBIDDEN_WORDS = /(\bAI\b|Claude|Anthropic|OpenAI|GPT|ChatGPT|generated|δημιουργήθηκε από τεχνητή|τεχνητή νοημοσύνη|Σταθόπουλος|Stathopoulos|Μητσοτάκ|Τσίπρα)/i;

// One summary of every list, so a test can check that no entry of a list is written as a literal anywhere else.
export const CONTENT_RULE_LISTS = Object.freeze({
  DENIED_WHOLE_WORDS,
  DENIED_NAME_STEMS,
  DENIED_CAPITALISED_WORDS,
  PARODIES,
  PARODY_CHARACTERS,
  PARODY_PARTY_NAMES,
  PARODY_MARK,
  COPIED_ENGLISH_PHRASES,
  COPIED_GREEK_PHRASES,
  MASCULINE_ONLY_FORMS,
  HOSPITAL_COPIED_ENGLISH,
  HOSPITAL_COPIED_GREEK,
  HOSPITAL_PATIENT_WORDS,
  FAITH_WORDS,
  ATHINA_FORBIDDEN_WORDS,
  MONUMENT_WORDS,
  CREDITS_FORBIDDEN_WORDS,
});
