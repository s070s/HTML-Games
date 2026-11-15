// ---- Moves --------------------------------------------------------------------
// c: p = Χειροδικία (physical), r = Ρητορική (rhetoric), s = Κατάσταση (status).
// Effect keys: prio, hits, drain, recoil, selfHurt, heal, foeSt [id, chance %],
// bothSt, stg [[who, stat, amount, chance %]], rand [min, max], recharge, foeSkip,
// trap, decoy, noAbility, blockStatus, lobby, cureSelf, healBoth, gag, fracDmg,
// team, promise, sure (never misses).
function defMove(name, type, cat, power, acc, extra) {
  return Object.assign({ n: name, t: type, c: cat, p: power, a: acc }, extra || {});
}
const MOVES = {
  // Πολιτικοί
  psifodeltio: defMove('Ψηφοδέλτιο', 'pol', 'r', 60, 100),
  promise: defMove('Προεκλογική Υπόσχεση', 'pol', 's', 0, 100, { heal: 0.25, promise: true }),
  exetastiki: defMove('Εξεταστική Επιτροπή', 'pol', 's', 0, 100, { foeSt: ['inv', 100] }),
  tropologia: defMove('Τροπολογία της Νύχτας', 'pol', 'r', 70, 90, { noAbility: 3 }),
  diorismos: defMove('Διορισμός Ανιψιού', 'pol', 's', 0, 100, { decoy: true }),
  fonipanel: defMove('Φωνή στο Πάνελ', 'pol', 'r', 75, 100),
  tilepolisi: defMove('Τηλεπώληση', 'pol', 'r', 0, 100, { fracDmg: 0.125, money: 1 }),
  tweet: defMove('Tweet στις 3 τα Ξημερώματα', 'pol', 'r', 60, 90, { bothSt: 'sca' }),
  denmilas: defMove('Δεν σας Αφήνω να Μιλήσετε', 'pol', 's', 0, 100, { gag: 2 }),
  diaggelma: defMove('Διάγγελμα', 'pol', 'r', 80, 100, { stg: [['foe', 'acc', -1, 100]] }),
  psifiako: defMove('Ψηφιακό Ραντεβού', 'pol', 's', 0, 100, { foeSkip: 1 }),
  anakampsi: defMove('Πρόγραμμα Ανάκαμψης', 'pol', 's', 0, 100, { heal: 0.25, team: true, money: 1 }),
  technokratis: defMove('Τεχνοκράτης', 'pol', 's', 0, 100, { stg: [['self', 'rde', 2, 100]] }),
  // Ασφαλίτες
  chimika: defMove('Χημικά', 'asf', 'p', 60, 95, { stg: [['foe', 'spe', -1, 30]] }),
  globos: defMove('Γκλομπ', 'asf', 'p', 70, 100),
  taftotita: defMove('Έλεγχος Ταυτότητας', 'asf', 's', 0, 100, { trap: 3 }),
  enisxuseis: defMove('Ενισχύσεις', 'asf', 'p', 40, 100, { prio: 1 }),
  parelasi: defMove('Παρέλαση', 'asf', 'p', 90, 80, { recharge: true }),
  // Εκκλησία
  agiasmos: defMove('Αγιασμός', 'ekk', 'r', 50, 100, { cureSelf: true }),
  aforismos: defMove('Αφορισμός', 'ekk', 'r', 85, 85, { foeSt: ['sca', 30] }),
  litaneia: defMove('Λιτανεία', 'ekk', 's', 0, 100, { stg: [['foe', 'spe', -2, 100]] }),
  akinito: defMove('Αφορολόγητη Ακίνητη Περιουσία', 'ekk', 's', 0, 100, { stg: [['self', 'def', 2, 100]] }),
  thymiama: defMove('Θυμίαμα', 'ekk', 'r', 55, 100, { stg: [['foe', 'acc', -1, 30]] }),
  // Celebrities
  proinadiko: defMove('Πρωινάδικο', 'cel', 'r', 60, 100, { stg: [['foe', 'acc', -1, 30]] }),
  reunion: defMove('Reunion Tour', 'cel', 's', 0, 100, { stg: [['self', 'atk', 2, 100], ['self', 'def', -1, 100]] }),
  kavgas: defMove('Τηλεοπτικός Καβγάς', 'cel', 'p', 80, 90, { recoil: 0.25 }),
  souxe: defMove('Ρετρό Σουξέ', 'cel', 'r', 100, 70),
  autobio: defMove('Αυτοβιογραφία', 'cel', 's', 0, 100, { heal: 0.5, foeSkip: 1 }),
  // Influencers
  story: defMove('Story 24ωρο', 'inf', 'r', 40, 100, { hits: 2 }),
  cancel: defMove('Cancel', 'inf', 'r', 90, 85, { blockStatus: true }),
  hashtag: defMove('Hashtag Boost', 'inf', 'r', 50, 100, { prio: 1 }),
  bluetick: defMove('Μπλε Τικ', 'inf', 's', 0, 100, { stg: [['self', 'rat', 2, 100]] }),
  // Επιχειρηματίες
  offshore: defMove('Offshore Μεταφορά', 'biz', 'r', 60, 100, { drain: 0.5, foeSt: ['bri', 25] }),
  apolyseis: defMove('Απολύσεις', 'biz', 'p', 65, 100, { stg: [['foe', 'def', -1, 100]] }),
  lobbying: defMove('Lobbying', 'biz', 's', 0, 100, { lobby: true }),
  yperkostol: defMove('Υπερκοστολόγηση', 'biz', 'p', 120, 60, { selfHurt: 0.25 }),
  // Μιμίδια
  thios: defMove('Ο Θείος από το Σικάγο', 'mem', 'r', 1, 100, { rand: [1, 150] }),
  ellada: defMove('Ελλάδα 0 Λογική 1', 'mem', 'p', 55, 100, { foeSt: ['str', 30] }),
  frapes: defMove('Φραπές στο Κεφάλι', 'mem', 'p', 65, 95, { stg: [['foe', 'spe', -1, 50]] }),
  giagia: defMove('Γιαγιά με Παντόφλα', 'mem', 'p', 40, 100, { prio: 2, sure: true }),
  tzampa: defMove('Τζάμπα Κρασί', 'mem', 's', 0, 100, { healBoth: 0.25 }),
};

