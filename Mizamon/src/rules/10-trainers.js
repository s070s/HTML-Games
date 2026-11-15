// ---- Trainers (CONTENT-SEED section 1 and 11) --------------------------------------------
// '$rival' in a team is replaced by the rival's starter (see RIVAL_STARTER).
const TRAINERS = {
  rival1: { name: 'Ο Μπέμπης', look: 'rival', team: [{ sp: '$rival', lv: 5 }], items: [] },
  phoebe: { name: 'Η Μπλόγκερ Φοίβη', look: 'blogger', team: [{ sp: 'storoula', lv: 6 }], items: [] },
  stelios: { name: 'Ο Αστυφύλακας Στέλιος', look: 'cop', team: [{ sp: 'eforaki', lv: 7 }, { sp: 'dimosio', lv: 7 }], items: [] },
  takis: { name: 'Ο Μπουζουξής Τάκης', look: 'singer', team: [{ sp: 'laikatzis', lv: 8 }, { sp: 'trolosavros', lv: 7 }], items: [] },
  rival2: { name: 'Ο Μπέμπης', look: 'rival', team: [{ sp: '$rival', lv: 9 }, { sp: 'fakelakis', lv: 8 }], items: ['koulouri'] },
  // victory: what bossVictory plays (the flag it sets, the two lines around the badge card, the card's texts, the chapter card after the first boss)
  kotsos: { name: 'Ο Λιμενάρχης Κώτσος', look: 'captain', boss: true, bonus: 200,
    victory: { flag: 'badge', win2: 'boss.win2', title: 'badge.title', sub: 'badge.sub', win3: 'boss.win3', chapterCard: true },
    team: [{ sp: 'fakelakis', lv: 11 }, { sp: 'frapedoros', lv: 12 }, { sp: 'fakelarchis', lv: 13 }], items: ['souvlaki'] },
  // Route 2 (MZ-WORLD-02a): a fan of the twin-stadium ground and a ferry sailor, two creatures each (L10 + L11, L11 + L12).
  fan: { name: 'Ο Οπαδός Θύμιος', look: 'fan', team: [{ sp: 'laikatzis', lv: 10 }, { sp: 'frapedoros', lv: 11 }], items: [] },
  ferrysailor: { name: 'Ο Ναύτης Μανώλης', look: 'sailor', team: [{ sp: 'fakelarchis', lv: 11 }, { sp: 'efoplistakos', lv: 12 }], items: [] },
  // Route 3 and 4, Γλυφάδα (MZ-WORLD-02b). Levels 14-18; the rival's third fight is the boss' top level minus 2 (18) with his evolved starter.
  lifeguard: { name: 'Ο Ναυαγοσώστης Βαγγέλης', look: 'lifeguard', team: [{ sp: 'laikatzis', lv: 15 }, { sp: 'trolosavros', lv: 16 }, { sp: 'eforaki', lv: 16 }], items: [] },
  sunbedseller: { name: 'Ο Ξαπλωστράς Μάκης', look: 'sunbedseller', team: [{ sp: 'frapedoros', lv: 15 }, { sp: 'eforaki', lv: 16 }, { sp: 'laikatzis', lv: 16 }], items: [] },
  conductor: { name: 'Ο Εισπράκτορας Λάμπρος', look: 'conductor', team: [{ sp: 'dimosio', lv: 16 }, { sp: 'fakelarchis', lv: 16 }], items: [] },
  golfer: { name: 'Ο Γκόλφερ Τζίμης', look: 'golfer', team: [{ sp: 'efoplistakos', lv: 16 }, { sp: 'giagiaka', lv: 17 }, { sp: 'kafenovios', lv: 17 }], items: [] },
  surfer: { name: 'Η Influencer Κική', look: 'surfer', team: [{ sp: 'storoula', lv: 17 }, { sp: 'laikatzis', lv: 17 }, { sp: 'frapedoros', lv: 18 }], items: [] },
  skipper: { name: 'Ο Καπετάνιος Σταύρος', look: 'skipper', team: [{ sp: 'efoplistakos', lv: 17 }, { sp: 'fakelarchis', lv: 18 }], items: [] },
  rival3: { name: 'Ο Μπέμπης', look: 'rival', team: [{ sp: 'fakelarchis', lv: 17 }, { sp: '$rivalEvo', lv: 18 }], items: ['souvlaki'] },
  bougatsas: { name: 'Ο Κύριος Μπουγάτσας', look: 'bougatsas', boss: true, bonus: 200,
    victory: { flag: 'badge_notia', win2: 'boss.bougatsas.win2', title: 'badge.notia.title', sub: 'badge.notia.sub', win3: 'boss.bougatsas.win3', ribbon: '#2f9a96' },
    boost: 1.16, team: [{ sp: 'kafenovios', lv: 18 }, { sp: 'efoplistakos', lv: 20 }, { sp: 'frapedoros', lv: 19 }, { sp: 'giagiaka', lv: 20 }], items: ['souvlaki'] },
  // Route 5, route 6 and Σπάτα (MZ-WORLD-02c). Levels 20-25; wild levels are 19-22 on route 5 and 22-26 on route 6.
  pilgrim: { name: 'Ο Προσκυνητής Κλεάνθης', look: 'pilgrim', team: [{ sp: 'monastiriaki', lv: 20 }, { sp: 'trolosavros', lv: 21 }], items: [] },
  customs: { name: 'Ο Τελωνειακός Ευθύμης', look: 'customs', team: [{ sp: 'eforaki', lv: 21 }, { sp: 'monimos', lv: 22 }, { sp: 'efoplistakos', lv: 22 }], items: [] },
  tourist: { name: 'Η Τουρίστρια Ροδάνθη', look: 'tourist', team: [{ sp: 'storoula', lv: 21 }, { sp: 'laikatzis', lv: 22 }], items: [] },
  vineyard: { name: 'Ο Αμπελουργός Μελέτης', look: 'vineyard', team: [{ sp: 'giagiaka', lv: 23 }, { sp: 'frapedoros', lv: 23 }, { sp: 'kafenovios', lv: 24 }], items: [] },
  cryptoseller: { name: 'Ο Κρυπτοπώλης Ζαφείρης', look: 'cryptoseller', team: [{ sp: 'kryptomakis', lv: 23 }, { sp: 'influenza', lv: 24 }, { sp: 'trolosavros', lv: 24 }], items: [] },
  spotter: { name: 'Ο Παρατηρητής Βάιος', look: 'spotter', team: [{ sp: 'monimos', lv: 23 }, { sp: 'eforaki', lv: 24 }], items: [] },
  checkin: { name: 'Η Υπάλληλος Φιλαρέτη', look: 'checkin', team: [{ sp: 'monimos', lv: 23 }, { sp: 'kryptomakis', lv: 23 }, { sp: 'influenza', lv: 24 }], items: [] },
  faia: { name: 'Η @influencεr_Φαίη', look: 'faia', boss: true, bonus: 200,
    victory: { flag: 'badge_anatolika', win2: 'boss.faia.win2', title: 'badge.anatolika.title', sub: 'badge.anatolika.sub', win3: 'boss.faia.win3', ribbon: '#a8449a' },
    team: [{ sp: 'kryptomakis', lv: 23 }, { sp: 'influenza', lv: 24 }, { sp: 'monimos', lv: 24 }, { sp: 'trolosavros', lv: 25 }, { sp: 'nftarchis', lv: 26 }], items: ['gemista'] },
  // Route 7, route 8 and Μαρούσι (MZ-WORLD-02d). Levels 27-31; wild levels are 26-29 on route 7 and 29-31 on route 8. The rival's fourth fight is the boss' top level minus 2 (30).
  oldstar: { name: 'Ο Αοιδός Φιλήμων', look: 'oldstar', team: [{ sp: 'star90', lv: 27 }, { sp: 'trolosavros', lv: 27 }], items: [] },
  gardener: { name: 'Ο Κηπουρός Θεόφραστος', look: 'gardener', team: [{ sp: 'fakelarchis', lv: 27 }, { sp: 'efoplistakos', lv: 27 }], items: [] },
  tennis: { name: 'Η Τενίστρια Ασπασία', look: 'tennis', team: [{ sp: 'influenza', lv: 28 }, { sp: 'star90', lv: 29 }], items: [] },
  contestant: { name: 'Η Παίκτρια Ευρυδίκη', look: 'contestant', team: [{ sp: 'rialito', lv: 28 }, { sp: 'influenza', lv: 28 }, { sp: 'trolosavros', lv: 28 }], items: [] },
  lobbyist: { name: 'Ο Λομπίστας Ερμόλαος', look: 'lobbyist', team: [{ sp: 'lobbylykaina', lv: 29 }, { sp: 'nftarchis', lv: 29 }], items: [] },
  rival4: { name: 'Ο Μπέμπης', look: 'rival', team: [{ sp: 'influenza', lv: 28 }, { sp: '$rivalEvo', lv: 30 }], items: ['souvlaki'] },
  usher: { name: 'Ο Ταξιθέτης Αγάπιος', look: 'usher', team: [{ sp: 'rialito', lv: 28 }, { sp: 'lobbylykaina', lv: 28 }, { sp: 'star90', lv: 28 }], items: [] },
  amartia: { name: 'DJ Αμαρτία', look: 'amartia', boss: true, bonus: 200,
    victory: { flag: 'badge_voreia', win2: 'boss.amartia.win2', title: 'badge.voreia.title', sub: 'badge.voreia.sub', win3: 'boss.amartia.win3', ribbon: '#3f9a52' },
    team: [{ sp: 'rialito', lv: 29 }, { sp: 'influenza', lv: 30 }, { sp: 'fakelarchis', lv: 32 }, { sp: 'lobbylykaina', lv: 32 }, { sp: 'star90', lv: 32 }], items: ['gemista'] },
  // Route 9, route 10 and Χαϊδάρι (MZ-WORLD-02e). Levels 34-37; wild levels are 32-35 on route 9 and 34-37 on route 10. No rival fight in this district (his fifth is in Αθήνα).
  tollclerk: { name: 'Η Εισπράκτορας Αγλαΐα', look: 'tollclerk', team: [{ sp: 'fakelarchis', lv: 34 }, { sp: 'monimos', lv: 34 }], items: [] },
  ultras: { name: 'Ο Οπαδός Θρασύβουλος', look: 'ultras', team: [{ sp: 'rialito', lv: 35 }, { sp: 'trolosavros', lv: 34 }], items: [] },
  granny: { name: 'Η Γιαγιά Αρετή', look: 'granny', team: [{ sp: 'giagiaka', lv: 35 }, { sp: 'frapedoros', lv: 34 }], items: [] },
  marketeer: { name: 'Ο Μανάβης Κοσμάς', look: 'marketeer', team: [{ sp: 'rousfetolykos', lv: 36 }, { sp: 'elegktis', lv: 36 }], items: [] },
  philosopher: { name: 'Ο Στοχαστής Νικηφόρος', look: 'philosopher', team: [{ sp: 'tavlilordos', lv: 36 }, { sp: 'ktimatomesitis', lv: 36 }], items: [] },
  steward: { name: 'Ο Επίτροπος Ευστάθιος', look: 'steward', team: [{ sp: 'ktimatomesitis', lv: 36 }, { sp: 'giotarchis', lv: 36 }], items: [] },
  gatekeeper: { name: 'Ο Θυρωρός Ευγένιος', look: 'gatekeeper', team: [{ sp: 'elegktis', lv: 37 }, { sp: 'lobbylykaina', lv: 37 }], items: [] },
  plousiakis: { name: 'Ο Ηγούμενος Πλουσιάκης', look: 'plousiakis', boss: true, bonus: 200,
    victory: { flag: 'badge_dytika', win2: 'boss.plousiakis.win2', title: 'badge.dytika.title', sub: 'badge.dytika.sub', win3: 'boss.plousiakis.win3', ribbon: '#d8a82a' },
    team: [{ sp: 'ktimatomesitis', lv: 36 }, { sp: 'giagiaexo', lv: 37 }, { sp: 'tavlilordos', lv: 38 }, { sp: 'fakelarchis', lv: 37 }, { sp: 'despotakis', lv: 38 }], items: [] },
  // Route 11, Μοναστηράκι, route 12, the hill of Λυκαβηττός and Σύνταγμα (MZ-WORLD-02f). Levels 39-42; wild levels are 38-41 on route 11 and 40-43 on route 12. Two creatures each (the XP share of the district stays under 1).
  // The rival's fifth fight is the boss' top level minus 2 (42); he still has the middle form of his starter (the last forms are the Βουλή's, MZ-WORLD-02g).
  clerk: { name: 'Η Υπάλληλος Ανθή', look: 'ministryclerk', team: [{ sp: 'monimos', lv: 39 }, { sp: 'lobbylykaina', lv: 39 }], items: [] },
  guide: { name: 'Ο Ξεναγός Αριστείδης', look: 'guide', team: [{ sp: 'star90', lv: 39 }, { sp: 'giagiaexo', lv: 39 }], items: [] },
  porter: { name: 'Ο Αχθοφόρος Λευτέρης', look: 'porter', team: [{ sp: 'tavlilordos', lv: 39 }, { sp: 'monimos', lv: 40 }], items: [] },
  student: { name: 'Η Φοιτήτρια Δάφνη', look: 'student', team: [{ sp: 'influenza', lv: 39 }, { sp: 'lobbylykaina', lv: 40 }], items: [] },
  busker: { name: 'Ο Οργανοπαίκτης Στρατής', look: 'busker', team: [{ sp: 'giotarchis', lv: 40 }, { sp: 'trolosavros', lv: 40 }], items: [] },
  rival5: { name: 'Ο Μπέμπης', look: 'rival', team: [{ sp: 'influenza', lv: 39 }, { sp: '$rivalEvo', lv: 42 }], items: ['souvlaki'] },
  inspector: { name: 'Η Επιθεωρήτρια Ευανθία', look: 'inspector', team: [{ sp: 'elegktis', lv: 40 }, { sp: 'monimos', lv: 41 }], items: [] },
  cadet: { name: 'Ο Δόκιμος Παντελής', look: 'cadet', team: [{ sp: 'matanthropos', lv: 40 }, { sp: 'monimos', lv: 41 }], items: [] },
  baboulas: { name: 'Ο Ταξίαρχος Μπαμπούλας', look: 'baboulas', boss: true, bonus: 200,
    victory: { flag: 'badge_athina', win2: 'boss.baboulas.win2', title: 'badge.athina.title', sub: 'badge.athina.sub', win3: 'boss.baboulas.win3', ribbon: '#3a6ea5' },
    team: [{ sp: 'fakelarchis', lv: 43 }, { sp: 'fakelarchis', lv: 42 }, { sp: 'fakelarchis', lv: 42 }, { sp: 'star90', lv: 43 }, { sp: 'nftarchis', lv: 42 }, { sp: 'matanthropos', lv: 44 }], items: [] },
  // The Βουλή (MZ-WORLD-02g): four fights in a row, healing only at the doctor of the lobby between them. Levels 44-50 (the tops are 46, 47, 48 and 50: the lowest band row is at top minus 5, 5, 6 and 6).
  // Only the last one is a boss with a badge (the Διορισμός Εφ' Όρου Ζωής) and the credits.
  euterpe: { name: 'Η Προϊσταμένη Ευτέρπη', look: 'euterpe',
    team: [{ sp: 'lobbylykaina', lv: 45 }, { sp: 'tavlilordos', lv: 44 }, { sp: 'fakelarchis', lv: 44 }, { sp: 'tavlilordos', lv: 46 }, { sp: 'lobbylykaina', lv: 46 }], items: ['souvlaki'] },
  minister: { name: 'Ο Υπουργός Σπυράδωνις', look: 'ministerman',
    team: [{ sp: 'spyradonis', lv: 46 }, { sp: 'lobbylykaina', lv: 45 }, { sp: 'giagiaexo', lv: 45 }, { sp: 'fakelarchis', lv: 46 }, { sp: 'giagiaexo', lv: 47 }], items: [] },
  rival6: { name: 'Ο Μπέμπης', look: 'rival',
    team: [{ sp: 'star90', lv: 47 }, { sp: 'tavlilordos', lv: 47 }, { sp: 'tavlilordos', lv: 46 }, { sp: 'fakelarchis', lv: 48 }, { sp: 'lobbylykaina', lv: 47 }, { sp: '$rivalFinal', lv: 48 }], items: ['souvlaki'] },
  undersec: { name: 'Ο Υφυπουργός Παντός', look: 'undersec', boss: true,
    victory: { flag: 'badge_final', win2: 'boss.undersec.win2', title: 'badge.final.title', sub: 'badge.final.sub', win3: 'boss.undersec.win3', ribbon: '#8a2a4a', credits: true },
    // A small visible boost (the mark shows beside the level, 11.12 and 11.17) keeps the last fight inside its bands with a team of creatures the player has met.
    boost: 1.03, team: [{ sp: 'star90', lv: 49 }, { sp: 'tavlilordos', lv: 49 }, { sp: 'tavlilordos', lv: 47 }, { sp: 'ktimatomesitis', lv: 48 }, { sp: 'lobbylykaina', lv: 47 }, { sp: 'mizotakis', lv: 50 }], items: ['gemista'] },
  host: { name: 'Ο Παρουσιαστής Ρεκλαμάκης', look: 'host', recruitable: true, recruitOnly: 'fakelos', bonus: 400,
    team: [{ sp: 'spyradonis', lv: 15 }, { sp: 'mizotakis', lv: 17 }], items: ['souvlaki'] },
};
// '$rival' is the rival's starter, '$rivalEvo' its middle form (his third fight), '$rivalFinal' its last form (his last fight, the Βουλή).
function resolveTeamSpecies(speciesId, playerStarter) {
  const rivalStarter = RIVAL_STARTER[playerStarter || 'komma'];
  if (speciesId === '$rival') return rivalStarter;
  if (speciesId === '$rivalEvo') return SPECIES[rivalStarter].evo.to;
  if (speciesId === '$rivalFinal') return SPECIES[SPECIES[rivalStarter].evo.to].evo.to; // the last form (the final fight of the Βουλή)
  return speciesId;
}
function buildTrainerTeam(trainerId, playerStarter) {
  const trainer = TRAINERS[trainerId];
  return trainer.team.map(function (entry) {
    return makeMon(resolveTeamSpecies(entry.sp, playerStarter), entry.lv, trainer.boost);
  });
}

