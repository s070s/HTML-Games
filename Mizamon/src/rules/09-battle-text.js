// ---- Battle text: events to sentences ------------------------------------------------
const ARTICLE = { m: 'Ο', f: 'Η', n: 'Το' };
const WILD_ADJECTIVE = { m: 'ανεξάρτητος', f: 'ανεξάρτητη', n: 'ανεξάρτητο' };
const FOE_ADJECTIVE = { m: 'αντίπαλος', f: 'αντίπαλη', n: 'αντίπαλο' };
// Label of a creature in battle text: "Ο Φακελάκης", "Ο ανεξάρτητος Φακελάκης", "Opposition Φακελάκης".
function monLabel(ref, lang, battleKind) {
  const species = SPECIES[ref.sp];
  if (lang === 'en') {
    if (ref.side === 0) return species.n;
    return (battleKind === 'wild' ? 'Independent ' : 'Opposition ') + species.n;
  }
  if (ref.side === 0) return ARTICLE[species.g] + ' ' + species.n;
  const adjective = battleKind === 'wild' ? WILD_ADJECTIVE[species.g] : FOE_ADJECTIVE[species.g];
  return ARTICLE[species.g] + ' ' + adjective + ' ' + species.n;
}
function eventVars(vars, lang, battleKind) {
  const out = {};
  for (const name of Object.keys(vars || {})) {
    const value = vars[name];
    if (value && typeof value === 'object') { out[name] = monLabel(value, lang, battleKind); out[name + '_name'] = SPECIES[value.sp].n; }
    else if (name === 'move') out[name] = MOVES[value].n;
    else if (name === 'item') out[name] = lookupString('item.' + value, lang);
    else if (name === 'stat') out[name] = lookupString('stat.' + value, lang);
    else out[name] = value;
  }
  return out;
}
function eventText(event, lang, gender, battleKind) {
  return formatText(lookupString(event.key, lang), eventVars(event.v, lang, battleKind), gender);
}

