// ---- Creatures (the MVP 12 plus the two parody characters of section 11) -------------
// base: [hp, atk, def, rat (rhetoric), rde (rhetoric defence), spe]
// xp: base experience yield; rec: recruit rate 0-100 (0 = cannot be recruited);
// g: grammatical gender of the name (m, f, n) for the Greek article.
const SPECIES = {
  komma: { n: 'Κομματάκι', t: 'pol', ab: 'asy', g: 'n', starter: true, rec: 0, xp: 50, evo: { to: 'vouleftakos', lv: 16 },
    base: [46, 38, 44, 56, 48, 46], learn: [[1, 'psifodeltio'], [1, 'promise'], [5, 'exetastiki'], [8, 'tropologia'], [11, 'thios']] },
  koulourak: { n: 'Κουλουράκι', t: 'asf', ab: 'syn', g: 'n', starter: true, rec: 0, xp: 50, evo: { to: 'batsonos', lv: 16 },
    base: [52, 56, 54, 34, 42, 42], learn: [[1, 'globos'], [1, 'enisxuseis'], [6, 'chimika'], [10, 'taftotita'], [13, 'parelasi']] },
  psaltak: { n: 'Ψαλτάκι', t: 'ekk', ab: 'gra', g: 'n', starter: true, rec: 0, xp: 50, evo: { to: 'diakosdisko', lv: 16 },
    base: [50, 36, 46, 52, 56, 38], learn: [[1, 'agiasmos'], [1, 'thymiama'], [6, 'aforismos'], [10, 'litaneia'], [13, 'akinito']] },
  fakelakis: { n: 'Φακελάκης', t: 'biz', ab: 'rou', g: 'm', rec: 70, xp: 40, evo: { to: 'fakelarchis', lv: 10 },
    base: [38, 44, 34, 46, 38, 52], learn: [[1, 'offshore'], [1, 'apolyseis'], [6, 'lobbying'], [9, 'yperkostol']] },
  fakelarchis: { n: 'Φακελάρχης', t: 'biz', ab: 'afo', g: 'm', rec: 25, xp: 70,
    base: [62, 62, 52, 66, 56, 62], learn: [[1, 'offshore'], [1, 'apolyseis'], [1, 'lobbying'], [1, 'yperkostol'], [12, 'frapes']] },
  laikatzis: { n: 'Λαϊκατζής', t: 'cel', ab: 'pal', g: 'm', rec: 45, xp: 45, evo: { to: 'star90', lv: 27 },
    base: [44, 38, 36, 56, 40, 54], learn: [[1, 'proinadiko'], [1, 'reunion'], [5, 'kavgas'], [9, 'souxe'], [12, 'autobio']] },
  storoula: { n: 'Story-ούλα', t: 'inf', ab: 'vir', g: 'f', rec: 45, xp: 45, evo: { to: 'influenza', lv: 22 },
    base: [38, 34, 34, 58, 40, 62], learn: [[1, 'story'], [1, 'hashtag'], [5, 'bluetick'], [9, 'cancel']] },
  trolosavros: { n: 'Τρολόσαυρος', t: 'mem', ab: 'out', g: 'm', rec: 40, xp: 45,
    base: [52, 54, 40, 36, 36, 54], learn: [[1, 'ellada'], [1, 'frapes'], [7, 'thios'], [11, 'tzampa']] },
  dimosio: { n: 'Δημοσιοϋπαλληλάκι', t: 'pol', ab: 'bur', g: 'n', rec: 45, xp: 45, evo: { to: 'monimos', lv: 20 },
    base: [56, 34, 66, 36, 56, 24], learn: [[1, 'psifodeltio'], [1, 'diorismos'], [6, 'exetastiki'], [10, 'tropologia'], [13, 'promise']] },
  eforaki: { n: 'Εφοράκι', t: 'asf', ab: 'vys', g: 'n', rec: 40, xp: 45, evo: { to: 'elegktis', lv: 36 },
    base: [44, 54, 44, 40, 46, 52], learn: [[1, 'globos'], [1, 'taftotita'], [6, 'chimika'], [9, 'enisxuseis']] },
  frapedoros: { n: 'Φραπεδόρος', t: 'mem', ab: 'bah', g: 'm', rec: 30, xp: 50,
    base: [66, 46, 58, 40, 50, 20], learn: [[1, 'frapes'], [1, 'tzampa'], [6, 'ellada'], [11, 'thios']] },
  giagiaka: { n: 'Γιαγιάκα', t: 'mem', ab: 'kou', g: 'f', rec: 30, xp: 50, evo: { to: 'giagiaexo', lv: 37 },
    base: [50, 56, 44, 36, 50, 44], learn: [[1, 'giagia'], [1, 'ellada'], [7, 'frapes'], [10, 'thios']] },
  efoplistakos: { n: 'Εφοπλιστάκος', t: 'biz', ab: 'afo', g: 'm', rec: 25, xp: 55, evo: { to: 'giotarchis', lv: 30 },
    base: [58, 46, 52, 60, 54, 40], learn: [[1, 'offshore'], [1, 'lobbying'], [8, 'apolyseis'], [12, 'yperkostol']] },
  // MZ-WORLD-02b (Νότια): the café regular, and the middle forms of the three starters (evolution level 16, section 11.3).
  kafenovios: { n: 'Καφενόβιος', t: 'mem', ab: 'bur', g: 'm', rec: 28, xp: 60, evo: { to: 'tavlilordos', lv: 36 },
    base: [64, 52, 56, 46, 54, 36], learn: [[1, 'ellada'], [1, 'tzampa'], [7, 'frapes'], [12, 'giagia'], [17, 'thios']] },
  vouleftakos: { n: 'Βουλευτάκος', t: 'pol', ab: 'asy', g: 'm', rec: 0, xp: 80, evo: { to: 'yperypourgos', lv: 32 },
    base: [60, 50, 58, 74, 64, 60], learn: [[1, 'psifodeltio'], [1, 'promise'], [5, 'exetastiki'], [8, 'tropologia'], [11, 'thios'], [18, 'diaggelma']] },
  batsonos: { n: 'Μπατσόνος', t: 'asf', ab: 'syn', g: 'm', rec: 0, xp: 80, evo: { to: 'matanthropos', lv: 32 },
    base: [68, 74, 70, 44, 56, 54], learn: [[1, 'globos'], [1, 'enisxuseis'], [6, 'chimika'], [10, 'taftotita'], [13, 'parelasi']] },
  diakosdisko: { n: 'Διάκος Ντίσκο', t: 'ekk', ab: 'gra', g: 'm', rec: 0, xp: 80, evo: { to: 'despotakis', lv: 32 },
    base: [64, 46, 60, 70, 76, 50], learn: [[1, 'agiasmos'], [1, 'thymiama'], [6, 'aforismos'], [10, 'litaneia'], [13, 'akinito']] },
  // MZ-WORLD-02c (Ανατολικά): the pilgrim's novice, two evolved forms (Δημοσιοϋπαλληλάκι at 20, Story-ούλα at 22) and the crypto line (evolution at 26, section 11.3).
  monastiriaki: { n: 'Μοναστηριάκι', t: 'ekk', ab: 'afo', g: 'n', rec: 30, xp: 60, evo: { to: 'ktimatomesitis', lv: 36 },
    base: [60, 44, 66, 50, 68, 30], learn: [[1, 'agiasmos'], [1, 'akinito'], [8, 'thymiama'], [12, 'litaneia'], [16, 'aforismos']] },
  monimos: { n: 'Μόνιμος', t: 'pol', ab: 'bur', g: 'm', rec: 25, xp: 65,
    base: [72, 38, 84, 44, 72, 28], learn: [[1, 'psifodeltio'], [1, 'diorismos'], [6, 'exetastiki'], [10, 'tropologia'], [13, 'promise'], [22, 'diaggelma']] },
  influenza: { n: 'Influεnζα', t: 'inf', ab: 'vir', g: 'f', rec: 30, xp: 65,
    base: [47, 50, 38, 88, 47, 78], learn: [[1, 'story'], [1, 'hashtag'], [5, 'bluetick'], [9, 'cancel'], [24, 'tweet']] },
  kryptomakis: { n: 'Κρυπτο-Μάκης', t: 'biz', ab: 'rou', g: 'm', rec: 32, xp: 60, evo: { to: 'nftarchis', lv: 26 },
    base: [37, 39, 29, 64, 35, 53], learn: [[1, 'hashtag'], [1, 'offshore'], [7, 'bluetick'], [12, 'cancel'], [20, 'lobbying']] },
  nftarchis: { n: 'NFT-άρχης', t: 'biz', ab: 'rou', g: 'm', rec: 20, xp: 75,
    base: [45, 43, 37, 76, 43, 56], learn: [[1, 'hashtag'], [1, 'offshore'], [7, 'bluetick'], [12, 'cancel'], [20, 'lobbying']] },
  // MZ-WORLD-02d (Βόρεια): two evolved forms (Λαϊκατζής at 27, Εφοπλιστάκος at 30), the reality star and the lobbyist, and the last form of each starter (evolution at 32, section 11.3).
  star90: { n: 'Σταρ των 90ς', t: 'cel', ab: 'pal', g: 'm', rec: 28, xp: 70,
    base: [57, 60, 44, 96, 53, 58], learn: [[1, 'proinadiko'], [1, 'reunion'], [5, 'kavgas'], [9, 'souxe'], [12, 'autobio']] },
  rialito: { n: 'Ριάλιτο-Νταής', t: 'cel', ab: 'pal', g: 'm', rec: 30, xp: 65,
    base: [61, 91, 49, 53, 44, 58], learn: [[1, 'kavgas'], [1, 'reunion'], [8, 'proinadiko'], [14, 'souxe'], [18, 'autobio']] },
  lobbylykaina: { n: 'Lobby-Λύκαινα', t: 'pol', ab: 'bur', g: 'f', rec: 25, xp: 70,
    base: [63, 58, 55, 89, 59, 56], learn: [[1, 'psifodeltio'], [1, 'lobbying'], [8, 'tropologia'], [14, 'diaggelma'], [20, 'exetastiki']] },
  giotarchis: { n: 'Γιοτάρχης', t: 'biz', ab: 'afo', g: 'm', rec: 18, xp: 80,
    base: [76, 56, 66, 76, 66, 46], learn: [[1, 'offshore'], [1, 'lobbying'], [8, 'apolyseis'], [12, 'yperkostol']] },
  yperypourgos: { n: 'Υπερυπουργός', t: 'pol', ab: 'asy', g: 'm', rec: 0, xp: 100,
    base: [74, 62, 70, 92, 80, 72], learn: [[1, 'psifodeltio'], [1, 'promise'], [5, 'exetastiki'], [8, 'tropologia'], [11, 'thios'], [18, 'diaggelma']] },
  matanthropos: { n: 'ΜΑΤάνθρωπος', t: 'asf', ab: 'syn', g: 'm', rec: 0, xp: 100,
    base: [84, 92, 86, 56, 68, 64], learn: [[1, 'globos'], [1, 'enisxuseis'], [6, 'chimika'], [10, 'taftotita'], [13, 'parelasi']] },
  despotakis: { n: 'Δεσποτάκης', t: 'ekk', ab: 'gra', g: 'm', rec: 0, xp: 100,
    base: [78, 56, 74, 86, 94, 60], learn: [[1, 'agiasmos'], [1, 'thymiama'], [6, 'aforismos'], [10, 'litaneia'], [13, 'akinito']] },
  // MZ-WORLD-02e (Δυτικά): four evolved forms (Καφενόβιος, Εφοράκι and Μοναστηριάκι at 36, Γιαγιάκα at 37; 11.3 proposed 30 / 32, 11.15 explains the move) and the patronage wolf.
  // Τάβλι-λόρδος, Γιαγιά Παντόφλα and Κτηματομεσίτης have the glass-cannon shape that held the boss inside the bands (more attack and rhetoric, a little more of the rest).
  tavlilordos: { n: 'Τάβλι-λόρδος', t: 'mem', ab: 'bur', g: 'm', rec: 20, xp: 80,
    base: [88, 86, 81, 76, 77, 44], learn: [[1, 'ellada'], [1, 'tzampa'], [7, 'frapes'], [12, 'giagia'], [17, 'thios']] },
  giagiaexo: { n: 'Γιαγιά Παντόφλα', t: 'mem', ab: 'kou', g: 'f', rec: 18, xp: 85,
    base: [74, 107, 67, 60, 74, 52], learn: [[1, 'giagia'], [1, 'ellada'], [7, 'frapes'], [10, 'thios']] },
  elegktis: { n: 'Ελεγκτής ΣΔΟΕ 3000', t: 'asf', ab: 'vys', g: 'm', rec: 20, xp: 80,
    base: [62, 78, 62, 52, 62, 64], learn: [[1, 'globos'], [1, 'taftotita'], [6, 'chimika'], [9, 'enisxuseis']] },
  ktimatomesitis: { n: 'Κτηματομεσίτης', t: 'ekk', ab: 'afo', g: 'm', rec: 20, xp: 85,
    base: [88, 68, 93, 86, 102, 34], learn: [[1, 'akinito'], [1, 'lobbying'], [8, 'offshore'], [14, 'yperkostol'], [20, 'apolyseis']] },
  rousfetolykos: { n: 'Ρουσφετόλυκος', t: 'pol', ab: 'rou', g: 'm', rec: 22, xp: 80,
    base: [70, 64, 60, 86, 62, 72], learn: [[1, 'psifodeltio'], [1, 'diorismos'], [8, 'tropologia'], [14, 'diaggelma'], [20, 'exetastiki']] },
  // MZ-WORLD-02f (Αθήνα): the legend of the Rock, met once at level 40 (a fixed encounter, not a wild creature). Its name is short so that it fits the battle name panel; the
  // dossier text carries the full "Ο Τελευταίος Φορολογούμενος" (11.16).
  taxpayer: { n: 'Φορολογούμενος', t: 'mem', ab: 'out', g: 'm', rec: 6, xp: 150,
    base: [97, 78, 91, 71, 91, 52], learn: [[1, 'ellada'], [1, 'giagia'], [1, 'frapes'], [1, 'tzampa']] },
  // MZ-WORLD-02g (Βουλή): the legend of the empty plenary hall, met once at level 50 after the credits (a fixed encounter with a visible boost, like the legend of the Rock, 11.16 and 11.17):
  // the species itself is ordinary (a base sum of 490 or less), so a recruited one is no stronger than the best final forms.
  ilithiokratia: { n: 'Ηλιθιοκρατία', t: 'pol', ab: 'asy', g: 'f', rec: 5, xp: 160,
    base: [112, 58, 96, 96, 96, 32], learn: [[1, 'psifodeltio'], [1, 'tropologia'], [1, 'diaggelma'], [1, 'promise']] },
  // Parody characters (CONTENT-SEED section 11): recruitable only in the television battle.
  spyradonis: { n: 'Σπυράδωνις', t: 'pol', ab: 'des', g: 'm', rec: 24, xp: 80, parody: true,
    base: [60, 55, 50, 76, 55, 55], learn: [[1, 'fonipanel'], [1, 'tilepolisi'], [1, 'tweet'], [1, 'denmilas']] },
  mizotakis: { n: 'Μιζοτάκης', t: 'pol', ab: 'epi', g: 'm', rec: 0, xp: 90, parody: true,
    base: [72, 50, 65, 74, 80, 58], learn: [[1, 'psifiako'], [1, 'anakampsi'], [1, 'diaggelma'], [1, 'technokratis']] },
};
const DEX_ORDER = ['komma', 'koulourak', 'psaltak', 'fakelakis', 'fakelarchis', 'laikatzis', 'storoula', 'trolosavros',
  'dimosio', 'eforaki', 'frapedoros', 'giagiaka', 'efoplistakos', 'kafenovios', 'vouleftakos', 'batsonos', 'diakosdisko',
  'monastiriaki', 'monimos', 'influenza', 'kryptomakis', 'nftarchis',
  'star90', 'rialito', 'lobbylykaina', 'giotarchis', 'yperypourgos', 'matanthropos', 'despotakis',
  'tavlilordos', 'giagiaexo', 'elegktis', 'ktimatomesitis', 'rousfetolykos', 'taxpayer', 'ilithiokratia', 'spyradonis', 'mizotakis'];
const STARTERS = ['komma', 'koulourak', 'psaltak'];
// The rival copies the starter that does not threaten the player's pick (a fair first fight).
const RIVAL_STARTER = { komma: 'psaltak', psaltak: 'komma', koulourak: 'koulourak' };

