# Mizamon: decision log (MVP 1, District 1)

Every decision below has its reason. Numbers are the ones in `Mizamon.html`; `tools/run-tests.mjs` pins most of them.

## 1. Shape of the build
- **One file, no build step, no requests.** `Mizamon.html` holds the page, CSS and one script. The CSP meta tag is the one from the brief, unchanged (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:`). Nothing needed more: audio is WebAudio, art is drawn on canvases, storage is `localStorage`.
- **Rules block.** Everything between `// RULES-BEGIN` and `// RULES-END` is pure data and functions (no DOM, no `Date`, no `Math.random`). The tests load exactly that text with `node:vm` and the game runs the same text. The block ends with a `RULES` object listing what the tests may reach. The engine below the block (sprites, audio, input, screens) may use the browser.
- **Engine names must not clash with rules names.** The first version had an engine `say()` (dialog) overriding the rules' battle logger; the rules logger is now `logMsg`. A headless test would not have caught it, the in-page self-test did.
- **Screens are a stack of layers** (overworld, dialog, choice, party, battle...). Only the top layer gets input. Flows are `async` functions that `await` a layer, so scripted scenes read top to bottom.
- **Battle = rules + playback.** `playTurn()` changes the state and returns events; `BattleLayer` plays them (text, HP bars, animation). The same events drive the tests, the balance script and the screen, so a battle on screen is exactly the seeded battle the tests replay.
- **No per-frame allocation in play.** Sprites and tiles are drawn once to offscreen canvases. `T()` caches every text without variables; texts with numbers are built when a value changes, not per frame. Typewriter text slices a string only while it is typing. The gamepad is polled only when a pad is connected (`getGamepads()` allocates), and its state object is reused. The sky gradients (battle, one per theme; title) are created once. The list of visible NPCs is rebuilt only when a story flag was added or the map changed. The Summary screen cuts its ability text once, not per frame.
- **Scaling.** Logical screen 240x160 (15x10 tiles of 16 px). The backing canvas is sized in device pixels so text stays crisp. With room, the scale is a whole number (desktop 1280x720 = x4); on small screens it is fractional so a 390 px phone still gets the full width. Phone portrait: canvas on top, controls below. Phone landscape: the two button pads stand in the side margins, never over the game: the scale is `min((width - 2 * 160) / 240, height / 160)` (160 CSS px is what the d-pad needs; at 667 x 325 the game is 348 px wide with 160 px on each side). The page never scrolls (`position: fixed`, `touch-action: none`).
- **Touch controls** show on touch devices (`pointer: coarse`, touch points) or when forced (`MIZAMON.forceTouch(true)`). The four d-pad arrows are one drawn triangle (an empty `span.arrow`, `clip-path`, `background: currentColor`, 1.1 em) turned by CSS, not font glyphs: the first build used U+25B2/25BC/25C0/25B6, and phones draw the last two as coloured emoji, so left/right did not match up/down. The self-test checks equal button and arrow sizes in both layouts, the pressed colour, and that no d-pad text contains those glyphs.
- **Reduced motion** starts from the operating system setting (`prefers-reduced-motion: reduce`) when nothing was saved; the Options screen overrides it and the choice is remembered. With it on, a fainting creature disappears at once (no slide and fade), as hits, attacks and flashes already did.
- **Battle screen layout (decision).** The first build used the classic arrangement of its genre (foe panel top right, player panel bottom left, a message box with a 2 x 2 command box). It is replaced by an original television-debate screen, 240 x 160 logical pixels:
  - the two fighters stand on wooden podiums that face each other at the same height (player left, opponent right), 64 px sprites;
  - above each podium a poll panel (the "δημοσκόπηση", i.e. the HP bar, with name, level and, for the player, the numbers; the status tag sits in the same panel); both panels are at the same height at the top of the screen;
  - between the podiums and the bottom, a row of four command tabs: Ομιλία (Speech: the moves), Τσάντα (Bag), Κόμμα (Party: switch creature), Διαφυγή (Flee). Left/right (or up/down) move along the row, A confirms. The tabs are dimmed while a message plays;
  - the whole bottom of the screen is a news-ticker strip (a red "ΕΙΔΗΣΕΙΣ / NEWS" tag on the left, navy band, white text, three lines). Messages, the prompt ("το μικρόφωνο είναι δικό σου") and the move list (a vertical list, up/down) all appear there. While a move is highlighted, the tab row shows its type, power, accuracy and category instead;
  - a trainer's portrait stands on the opponent's podium until the first creature is sent out; the recruit envelope flies from podium to podium.
  It stays readable at 390 x 844 (scale 1.6) and 844 x 390 (scale 2) because every text is the 8 px game font on large flat bands, and it is driven only by the d-pad and A/B, so touch needs nothing extra.
- **Battle texts are in the game's own voice.** Every line that the first build took from the common phrasing of other monster games ("What will X do?", "X used Y!", "Go, X!", "come back", "critical hit", "super effective", "not very effective", "Wild/Foe X", the learn-move, evolution and black-out lines) was rewritten in both languages as political satire: "X decided: Y!", "X was transferred back to the bench.", "Double whammy: the favour landed!", "It did not stick: nearly untouched.", "The poll numbers plunge!", "Cabinet reshuffle! X is changing portfolio...", "New minister: Y. Sworn in.", moves are "fired" or "shelved", level-ups are "promotions". Wild creatures are "independent" (ανεξάρτητος), opponents "Opposition X" in English. A test keeps a list of the old phrasings out of the strings table.
- **A battle that throws an exception ends as "ran"**: no flags, no medal, no credits, no prize; the error is logged to the console.

## 2. Rules: numbers and formulas
### Stats
- Six stats: HP, Ισχύς (atk), Άμυνα (def), Ρητορική (rat), Ρητ. Άμυνα (rde), Ταχύτητα (spe). Two attack stats because moves are Χειροδικία (physical, atk vs def) or Ρητορική (rhetoric, rat vs rde); status moves use neither.
- `HP = floor(base * level / 20) + level + 10`, other stat `= floor(base * level / 25) + 5`. No random individual values and no training points: a creature of a species and level is always the same, which keeps tests and balance exact. Example: Κομματάκι L5 has 26 HP, L12 has 49 HP.
- Stat stages -6..+6: `(2+s)/2` up, `2/(2-s)` down; accuracy uses `(3+s)/3`.

### Damage (own formula)
`damage = floor( floor(power * atk / def * (attackerLevel + 4) / 90) * STAB * typeMultiplier * crit * roll )`, minimum 1.
- STAB x1.5 (move type equals the attacker's type), type multiplier 2 / 1 / 0.5, critical x1.5 with chance 1/16, roll 0.85-1.00 (16 steps).
- `DAMAGE_DIVISOR = 90` was tuned so an ordinary same-level exchange takes a creature to about 30 % HP per neutral STAB hit. Measured: an average 1v1 wild fight (starter against a route creature, 0-3 levels lower) lasts 4.0 turns; the whole boss fight (3 creatures) 15-22 turns, about 5-7 turns per creature.
- Fixed numbers pinned by a test: Κομματάκι L10 (rat 27) with Ψηφοδέλτιο against Φακελάκης L10 (rde 20, HP 39): base 12, x1.5 STAB x2 = 36; with a critical 54; lowest roll 30.
- Accuracy: `chance = move accuracy * accuracyMultiplier(stage)`; "never misses" moves skip the roll.

### Order and priority
Switching, items, recruiting and running go before moves (player first). Moves: higher priority first, then higher speed, ties by the seeded RNG. A creature that faints cancels its own pending action.

### Statuses (4)
| Status | Rule in the build |
|---|---|
| Υπό Έρευνα | attack and rhetoric x0.75; archived after 5 turns |
| Σκάνδαλο | loses 1/8 max HP at the end of each turn; ends when switched out |
| Απεργία | 50 % to do nothing; 3 turns |
| Λαδωμένος | 30 % to pocket the money instead of attacking (the foe heals 1/16); 4 turns. Inflicted by Offshore Μεταφορά (25 %) |
Statuses clear after every battle (the MVP has no overworld poison). Φραπές cures any of the four, because Crisis blues is not in the MVP.

### Abilities (the 14 used)
Ασυλία (Κομματάκι), Συνδικαλιστής (Κουλουράκι), Θεία Χάρη (Ψαλτάκι; the Sunday bonus uses the real clock, passed into the battle as `sunday` so tests stay deterministic), Ρουσφέτι (Φακελάκης), Αφορολόγητο (Φακελάρχης; +50 % prize money), Παλιά Δόξα (Λαϊκατζής), Viral (Story-ούλα), Ούτε Γάτα Ούτε Ζημιά (Τρολόσαυρος), Γραφειοκρατία (Δημοσιοϋπαλληλάκι; a status starts one turn late), Βύσμα (Εφοράκι; 20 % to ignore a hit from a higher level), Μπάχαλο (Φραπεδόρος), Κουμπαριά (Γιαγιάκα), Ντεσιμπέλ (Σπυράδωνις), Επιτελικό Κράτος (Μιζοτάκης).
- Every status can be inflicted by some move a creature learns (a test checks it); Λαδωμένος comes from Offshore Μεταφορά (25 %), so the recruit bonus for a bribed creature is reachable.
- Changes against the seed text, each because a 1v1 MVP has no allies on the field: Επιτελικό Κράτος gives +1 priority to the holder's own first move; Κουμπαριά counts fainted same-type allies of the whole team; Ρουσφέτι heals the next creature sent in by the holder's side.

### Moves (41)
All 7 types have 4-13 moves (the minimum asked was 3). Simplifications of the seed list, each marked in the move text:
- Spin and Crisis blues are not in the MVP, so Spin effects become "accuracy -1" and Χημικά's Crisis blues becomes "speed -1". Διάγγελμα (Spin on all foes) lowers accuracy.
- Confusion (Ελλάδα 0 Λογική 1) became "30 % Απεργία".
- "Hits all foes" is just the one foe in a 1v1 battle.
- Προεκλογική Υπόσχεση: heals 25 % now, the promise is broken two turns later (lose 1/8).
- Τηλεπώληση and Πρόγραμμα Ανάκαμψης move money: the player gains money when the player's creature uses them, loses it when the opponent's does.
- No PP: moves are unlimited. It keeps the 3-6 turn battles simple and removes a menu.
- A creature knows 4 moves at most. When a species has learned more by a level, it keeps its basic attack (the first damaging move of its own type) plus the newest three, so no creature loses its main attack (the boss's Φακελάρχης L13 keeps Offshore Μεταφορά: Offshore, Lobbying, Υπερκοστολόγηση, Φραπές). Learning during play still asks which move to forget.

### Opponent AI (seeded)
Each move scores by expected damage as a share of the foe's current HP (type, STAB, accuracy, hits), +30 for a kill, small fixed values for status and setup moves (heal only below 35 % HP and not twice in a row), x(0.85-1.15) noise, and 12 % of turns a random move. Trainers use their item once (below 35 % HP, 70 % chance per turn). The same AI plays the player side in the simulations.
- **Pointless moves score 0** (`USELESS_MOVE_SCORE`, below even a 1-damage hit): a setup move whose stat is already at +2 or more (Τεχνοκράτης would otherwise climb to +6 and make Μιζοτάκης untouchable), a skip-turn move used the turn before (Ψηφιακό Ραντεβού), a heal at full HP. The 12 % random pick never takes a pointless move.
- **Overtime (stalemate breaker).** From turn 120 both active creatures lose `maxHP * (turns over) / 32` at the end of every turn (the show runs over time; "οι δημοσκοπήσεις πέφτουν και για τους δύο"). Two defensive healers (two Μιζοτάκης, or one against a creature that cannot hurt it) could otherwise heal forever. A seeded sample of 1,000 random 3 v 3 battles never reaches the 400-turn simulation limit; about 2.4 % of them need overtime.

### Recruiting
`chance = rate/150 * (1 + 1.5 * (1 - hp/maxHP)) * statusFactor * tier * levelFactor`, clamped to 0.03-0.95.
- `rate` per species (Φακελάκης 70, Λαϊκατζής and Story-ούλα 45, Τρολόσαυρος 40 ... Σπυράδωνις 24; starters and Μιζοτάκης 0 = cannot be recruited). statusFactor: Υπό Έρευνα x1.5 ("needs a friend"), Λαδωμένος x2, Σκάνδαλο/Απεργία x1.2. tier: Φακελάκι x1, Φάκελος x1.5. levelFactor `max(0.5, 1 - 0.015 * level)`.
- Examples: Φακελάκης L3 at full HP: 45 % with a Φακελάκι, 67 % with a Φάκελος; at half HP 78 %; at 10 % HP 95 %. Σπυράδωνις L15 with a Φάκελος: 19 % at full HP, 44 % at 10 % HP, 66 % with Υπό Έρευνα, 87 % Λαδωμένος.
- One seeded roll decides; the number of shakes (0-2 breaks) is cosmetic and also seeded. Break-out lines: "Το βρήκε λίγο." Success line: "... δέχτηκε... για τα παιδιά."
- Trainers' creatures cannot be recruited, except Σπυράδωνις in the television battle and only with a Φάκελος (a Φακελάκι is "too small for a minister"). Μιζοτάκης cannot be recruited at all. The master envelope (Offshore Λογαριασμός) is not in the MVP. A recruit with a full team of 6 goes to the hospital's Αρχείο Ασθενών (section 10); only when that is full too (60) is the offer refused.

### Experience and levels
- Total XP to reach level n: `floor(0.6 * n^3)` (L5 75, L8 307, L10 600, L12 1,036, L14 1,646, L20 4,800). Max level 50.
- XP per defeated creature: `floor(speciesXp * foeLevel / 4)`, x1.5 against trainers, split between the participants that are still standing.
- Level-up raises current HP by the same amount as max HP. A level-up learns the species' moves for that level; with 4 moves known the game asks which to forget (or to skip).
- **Evolution:** Φακελάκης becomes Φακελάρχης at level 10, reachable in the slice (the wild ones are L2-8). The starters' evolutions (Βουλευτάκος, Μπατσόνος, Διάκος Ντίσκο at about level 16) are outside the 12 creatures of the MVP and are not built.

### Money
Trainer prize `lastCreatureLevel * 30` (+200 for the boss, +400 for the television host), x1.5 if the lead creature has Αφορολόγητο. Start 300. Black-out: back to the hospital door (the only place that heals), team healed, half the money kept. Prices: Φακελάκι 80, Φάκελος 200, Κουλούρι 25, Σουβλάκι 70, Φραπές 60, Τσίπουρο 180.

## 3. World
- Maps are character grids with a legend (`TILE_DEFS`); the route is painted by a small function (rectangles and a path) so the layout is easy to change. All maps are in the rules block so the tests can check them: row widths, walkable NPC and warp tiles, reachability by a flood fill that follows doors (`reachableTiles`), talking across counters, and the gated studio door.
- Towns: Νέα Πειραιάς (lab, ΚΕΠ, Περίπτερο, Καφενείο, the hospital, two closed houses, the studio), Route 1 (three zones of grass with levels 2-4, 4-6, 6-8, rate 13 % per grass step), the Harbour Office with the boss.
- Trainers see 3-4 tiles ahead in the direction they face, walk up to you, fight, and walk back. The rival: first fight on leaving the lab (a story fight; losing it is allowed and sends you to the hospital), second fight on the route, then he leaves.
- **Rival's starter:** he takes the starter that does not threaten yours (Κομματάκι gets Ψαλτάκι, Ψαλτάκι gets Κομματάκι, Κουλουράκι gets Κουλουράκι), so the first fight is fair for all three choices.
- Wild tables list the 8 route creatures (no starters, no parody characters); Φραπεδόρος and Γιαγιάκα are rarer.
- **After the credits:** the Τηλεοπτικό Στούντιο door in the square opens. The host fights with Σπυράδωνις L15 then Μιζοτάκης L17, prize 910; a Φάκελος can recruit Σπυράδωνις during that fight only.
- **Saving:** at the Καφενείο (pause menu says so elsewhere). Without working storage the save lives in memory and the cafe says so.

## 4. Parody characters (SPEC ground rule 2)
- The game opens with the verbatim satire notice (Greek and English together). Party: Νέα Δημοκτατορία; its logo (a blue envelope with a crown) is drawn by code and appears on the lapel of Σπυράδωνις and the podium of Μιζοτάκης. No real logo, no flags.
- Sprites are generic cartoon figures by role: a shouting man in a suit with a thick book; a man in a suit at a podium with a laptop. No likeness is attempted.
- Dossier texts for both say "ΠΑΡΩΔΙΑ" and joke only about public personas (shouting on panels, "books", an "executive state", addresses, digital appointments). No crimes are claimed; every file ends "Ποτέ δεν καταδικάστηκε" like all the others.
- The host is a fictional trainer (Ο Παρουσιαστής Ρεκλαμάκης). Tone: institutions and behaviours only (bribery, nepotism, queues, media, police "incidents", church property, influencers); no jokes about groups of people, no real names, no real tragedies.

## 5. Language
- One table `STRINGS` holds every text as `[Greek, English]`. `{name}` is the player's name; `{m|f}` picks masculine or feminine Greek (used where the player is addressed, e.g. "Είσαι έτοιμος/έτοιμη;"). Both the in-page self-test and the headless tests check that every key has both languages with the same placeholders, and that every key used by the code exists (including the keys built from data).
- Creature and move names are Greek in both languages. English mode adds a gloss in the move text ("Ballot: ...") and the Dossier ("Κομματάκι = Little Party Kid"). Types, statuses, abilities, items and stats are translated.
- Battle sentences are built from events at play time, so switching language changes them immediately. Greek names get the right article and "ανεξάρτητος/αντίπαλος" by the species' grammatical gender. Wherever the player is addressed with a gendered Greek form it uses the `{man|woman}` choice ("{διάσημος|διάσημη}", "{μόνος|μόνη}", "{ανιψιέ|ανιψιά}", "{φίλε|φίλη}"); a test finds masculine-only forms left outside a choice.

## 6. Save
- Key `mizamon.v1.save` (the key name is unchanged), object `{ version: 2, player, party, archive, money, bag, dex, flags, lastHeal, options, rngState, starter }`. Options also live under `mizamon.v1.options` so the language is remembered before a first save.
- `migrateSave()` accepts version 0 (flat prototype shape with `team`, `items`, `girl`, `drachmas`; its story flags are rebuilt: a team means `gotStarter`, a position outside the lab means the rival was met, `rival1` and `t_rival1`; it is first turned into the version-1 shape), version 1 (no archive: `archive = []`; a `lastHeal` on the `kep` map becomes the hospital spot) and version 2, rejects newer versions, drops unknown creatures and items, clamps levels and falls back to the start position when a place is unknown. Every storage call is in `try/catch` with an in-memory fallback.
- The seeded RNG state is saved so a loaded game continues the same random sequence.

## 7. Tests and balance
- `node Mizamon/tools/run-tests.mjs`: 42 groups, including the hospital ones (archive rules, recruit to archive, save v2 and migration, heal and VIP, black-out spot, hospital map reachability, hospital strings, hospital look) (type chart against the seed table, damage numbers, every ability with a control case (Ασυλία, Συνδικαλιστής, Γραφειοκρατία, Ούτε Γάτα Ούτε Ζημιά, Βύσμα with its 12-28 % bound, Επιτελικό Κράτος, Viral, Ρουσφέτι, Κουμπαριά), the four statuses with exact turn counts, every status inflictable, recruit odds, level-up, the kept basic attack, AI scoring and no-stall checks, a 1,000-battle seeded replay twice with equal checksums, encounters, reachability, data references, strings (both languages, no copied phrasing, gendered forms), save migration with flags, prize rules, and source checks of the engine: a broken battle returns "ran", Reduced motion follows the OS). Each rule test was checked by removing the feature and watching it fail. Prints `PASS n / m`, exit code 1 on failure.
- `window.MIZAMON.selfTest()` (browser): rules smoke tests, all 14 sprites drawn, title -> notice -> new game reaches the overworld, walking, a scripted battle won through the real menus (the commands are found by their labels, the test also checks the four labels), recruit success path through the Bag command, landscape touch pads that do not overlap the game, the hospital (through the town door, the reception heal, the VIP heal that spends one Φακελάκι, the archive terminal deposit and withdraw through its menu), save round trip with the archive, language toggle, touch controls and the d-pad arrows. Test hooks: `MIZAMON.quickStart({...})`, `press`, `pause`, `pumpUntil`, `forceTouch`.
- `node Mizamon/tools/balance.mjs [runs]` simulates the boss fight with an AI-played player team (one random starter plus five random route creatures, two Σουβλάκι). The player AI does not switch cleverly and never grinds smartly, so a human does a little better. 500 runs per row:

| Player level | 6 creatures at that level | 6 creatures, 2 levels behind | only 3 creatures, no items |
|---|---|---|---|
| 10 | 20.4 % | 1.2 % | 1.0 % |
| 12 | 65.8 % | 32.8 % | 15.0 % |
| 14 | 92.8 % | 67.4 % | 51.4 % |

Boss team: Φακελάκης L11, Φραπεδόρος L12, Φακελάρχης L13 (holds a Σουβλάκι); every boss creature now keeps its basic attack and Offshore Μεταφορά can bribe, so the fight is harder than in the first build (which measured 35.6 / 4.4 / 1.2, 76.2 / 41.4 / 17.4 and 95.6 / 80.0 / 50.2 %). A player at level 12-14 with a normal team still wins most fights; at level 10 the fight is a real wall. The four route trainers (with the rival) give about 800 XP to the creatures that fight (level 10 is 600, level 12 is 1,036); the rest is a few wild fights, which is the "little grinding".

## 8. Sound
Original WebAudio: square, triangle and sawtooth blips for the menu, hits, faint, level-up, recruit; six short procedural chiptune loops (title/credits, town, indoors, route, battle, boss) written as note lists, with their own melodies. Mute: Options, or the N key. The audio context starts on the first key press or tap (browsers require it).

## 9. Not in the MVP (on purpose)
Χοντρός Φάκελος, Offshore Λογαριασμός, Δικηγόρος and the other battle items, Spin and Crisis blues, starter evolutions, districts 2-8, ΚΤΕΛ fast travel, ΑΦΜ, Spin-based moves, PP.

## 10. Hospital (MZ-HOSP-01)
The Owner asked for "a hospital building" like the one in the games of the genre. What was built is the ROLE that building plays (heal the team, the place you return to after losing, the terminal that stores extra creatures) as Mizamon's own building. Nothing is copied from any existing game's centre.
- **Νοσοκομείο 3000** («Γενικό Νοσοκομείο Νέας Πειραιάς 3000»), in the town on the free lot between the studio and the right house (door at 15,13, five tiles wide, so it reads as the big building of the square). Teal roof with a blue Η plate (the Greek capital Eta), mint walls, a green pharmacy-style cross, a sliding glass door. The sign text is read from the wall left of the door (a sign tile in the street row would have cut the street in two). The town stays connected: a test walks every free town tile.
- **Interior** (12 x 9): a reception counter with the receptionist and the doctor behind it; below it a corridor with six ράντζα (cots standing in the corridor), four waiting people (four different lines about waiting lists, a cot with a view of the corridor, a strike "in progress", a child waiting "five minutes" for two semesters), a broken coffee machine (a sign), a TV with a morning show (a sign), and the Αρχείο Ασθενών terminal. The doctor hints at a Φακελάκι ("helps my memory"). Spawn and black-out spot: just inside the door (5,7).
- **Heal.** The receptionist says the regulation is "an appointment in 3 to 5 years", "free, for anyone who is patient and has a cot"; then it happens at once ("a cot just became free: a miracle, or a typing error"). With a Φακελάκι in the bag she offers the VIP service ("no waiting, for the pharmacy expenses"): Yes spends one and gives a different closing line; No, or no item, is the normal path. The envelope is never required. Same heal both ways: whole team, HP and status (`hospitalHeal`). A short flashing heart-monitor line (a sweeping green line on a dark screen) and an original blip sequence (three flat beeps, then two rising blips) play; with Reduced motion the line is drawn whole, does not scroll or flash.
- **Return point.** `HOSPITAL_SPOT` (inside the door) is `DEFAULT_HEAL_SPOT` and the last-visit heal spot, so a black-out ends there ("you woke up on a cot in the corridor ... examined without an appointment"). The ΚΕΠ 3000 stays as a building with its queue and ticket joke; its clerk now says the file is incomplete, to come back tomorrow, and sends the player to the hospital. It heals nothing.
- **Αρχείο Ασθενών.** A terminal tile, a map `actions` entry (`'10,3': 'archive'`), opens a menu: Deposit (pick a team member), Withdraw (pick from the archive list), Catalogue (browse: level, type, HP; six rows, up/down, left/right page), Close. Capacity 60 (`ARCHIVE_MAX`). A creature keeps level, moves and HP. Rules: a deposit needs room and at least one other team member still able to fight (so never the last fighter, never an empty team; a fainted creature may go); a withdrawal needs room in the team of 6. Creatures in the archive count as recruited in the Dossier.
- **Recruits.** With a full team, a successful recruit goes to the archive with the line "went to the archive" instead of being refused (`battle.opts.archive` is the player's archive; the rules code pushes into it). A full archive, or a battle without one (simulations), refuses as before (`b.rec.full`, item kept).
- **Save v2.** `SAVE_VERSION` 2 adds `archive`. A version-1 save gets `archive = []` and a heal spot on the `kep` map becomes the hospital spot; version 0 first becomes the version-1 shape. A version-1 save of a player who stood on the lot now covered by the hospital (town x 13-17, y 10-13) loads on the pavement in front of the hospital door, facing down; any other unwalkable position still falls back to the start position. Dex keys are rebuilt in `DEX_ORDER` so a second migration gives the same object.
- **Voice.** Greek public-hospital clichés about the system only (cots in the corridor, waiting lists, a strike, an envelope for "VIP service", a broken machine, a morning show about optical illusions); never about patients, illness or real tragedies. A test keeps patient and illness words out of the new texts. The hospital texts avoid gendered adjectives ("για όποιον έχει υπομονή"); where one is needed the `{m|f}` choice is used.
- **Originality rules (kept by tests where a test can see them).** No red roof with white walls (teal and mint; a colour test finds no red on the outside), no red-cross emblem (the cross is green, the sign is a blue Η), no nurse character (the receptionist is a clerk with a teal cardigan; the doctor a man with a held-out envelope), no greeting, bow, jingle, machine with balls, counter layout or text of any existing centre (a test looks for known phrases), its own blip sequence (`SFX_PATTERNS.hospital`), the reception is a long counter with people behind it and a corridor in front, not a single nurse behind a counter with a healing machine.
- **Test setup note.** The test that keeps `Math.random`/`Date` out of the rules block now also works on a CRLF checkout (`autocrlf`), where it failed before.
