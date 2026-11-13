# Mizamon: decision log (MVP 1, District 1)

Every decision below has its reason. Numbers are the ones in `Mizamon.html`; `tools/run-tests.mjs` pins most of them.

## 1. Shape of the build
- **One file, no build step, no requests.** `Mizamon.html` holds the page, CSS and one script. The CSP meta tag is the one from the brief, unchanged (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:`). Nothing needed more: audio is WebAudio, art is drawn on canvases, storage is `localStorage`.
- **Rules block.** Everything between `// RULES-BEGIN` and `// RULES-END` is pure data and functions (no DOM, no `Date`, no `Math.random`). The tests load exactly that text with `node:vm` and the game runs the same text. The block ends with a `RULES` object listing what the tests may reach. The engine below the block (sprites, audio, input, screens) may use the browser.
- **Engine names must not clash with rules names.** The first version had an engine `say()` (dialog) overriding the rules' battle logger; the rules logger is now `logMsg`. A headless test would not have caught it, the in-page self-test did.
- **Screens are a stack of layers** (overworld, dialog, choice, party, battle...). Only the top layer gets input. Flows are `async` functions that `await` a layer, so scripted scenes read top to bottom.
- **Battle = rules + playback.** `playTurn()` changes the state and returns events; `BattleLayer` plays them (text, HP bars, animation). The same events drive the tests, the balance script and the screen, so a battle on screen is exactly the seeded battle the tests replay.
- **No per-frame allocation in play.** Sprites and tiles are drawn once to offscreen canvases. `T()` caches every text without variables; texts with numbers are built when a value changes, not per frame. Typewriter text slices a string only while it is typing. The gamepad is polled only when a pad is connected (`getGamepads()` allocates).
- **Scaling.** Logical screen 240x160 (15x10 tiles of 16 px). The backing canvas is sized in device pixels so text stays crisp. With room, the scale is a whole number (desktop 1280x720 = x4); on small screens it is fractional so a 390 px phone still gets the full width. Phone portrait: canvas on top, controls below. Phone landscape: controls overlay the two sides. The page never scrolls (`position: fixed`, `touch-action: none`).
- **Touch controls** show on touch devices (`pointer: coarse`, touch points) or when forced (`MIZAMON.forceTouch(true)`).

## 2. Rules: numbers and formulas
### Stats
- Six stats: HP, Ισχύς (atk), Άμυνα (def), Ρητορική (rat), Ρητ. Άμυνα (rde), Ταχύτητα (spe). Two attack stats because moves are Χειροδικία (physical, atk vs def) or Ρητορική (rhetoric, rat vs rde); status moves use neither.
- `HP = floor(base * level / 20) + level + 10`, other stat `= floor(base * level / 25) + 5`. No random individual values and no training points: a creature of a species and level is always the same, which keeps tests and balance exact. Example: Κομματάκι L5 has 26 HP, L12 has 49 HP.
- Stat stages -6..+6: `(2+s)/2` up, `2/(2-s)` down; accuracy uses `(3+s)/3`.

### Damage (own formula)
`damage = floor( floor(power * atk / def * (attackerLevel + 4) / 90) * STAB * typeMultiplier * crit * roll )`, minimum 1.
- STAB x1.5 (move type equals the attacker's type), type multiplier 2 / 1 / 0.5, critical x1.5 with chance 1/16, roll 0.85-1.00 (16 steps).
- `DAMAGE_DIVISOR = 90` was tuned so an ordinary same-level exchange takes a creature to about 30 % HP per neutral STAB hit. Measured: an average 1v1 wild fight (starter against a route creature, 0-3 levels lower) lasts 3.4 turns; the whole boss fight (3 creatures) 14-20 turns, about 5-6 turns per creature.
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
| Λαδωμένος | 30 % to pocket the money instead of attacking (the foe heals 1/16); 4 turns |
Statuses clear after every battle (the MVP has no overworld poison). Φραπές cures any of the four, because Crisis blues is not in the MVP.

### Abilities (the 14 used)
Ασυλία (Κομματάκι), Συνδικαλιστής (Κουλουράκι), Θεία Χάρη (Ψαλτάκι; the Sunday bonus uses the real clock, passed into the battle as `sunday` so tests stay deterministic), Ρουσφέτι (Φακελάκης), Αφορολόγητο (Φακελάρχης; +50 % prize money), Παλιά Δόξα (Λαϊκατζής), Viral (Story-ούλα), Ούτε Γάτα Ούτε Ζημιά (Τρολόσαυρος), Γραφειοκρατία (Δημοσιοϋπαλληλάκι; a status starts one turn late), Βύσμα (Εφοράκι; 20 % to ignore a hit from a higher level), Μπάχαλο (Φραπεδόρος), Κουμπαριά (Γιαγιάκα), Ντεσιμπέλ (Σπυράδωνις), Επιτελικό Κράτος (Μιζοτάκης).
- Changes against the seed text, each because a 1v1 MVP has no allies on the field: Επιτελικό Κράτος gives +1 priority to the holder's own first move; Κουμπαριά counts fainted same-type allies of the whole team; Ρουσφέτι heals the next creature sent in by the holder's side.

### Moves (41)
All 7 types have 4-13 moves (the minimum asked was 3). Simplifications of the seed list, each marked in the move text:
- Spin and Crisis blues are not in the MVP, so Spin effects become "accuracy -1" and Χημικά's Crisis blues becomes "speed -1". Διάγγελμα (Spin on all foes) lowers accuracy.
- Confusion (Ελλάδα 0 Λογική 1) became "30 % Απεργία".
- "Hits all foes" is just the one foe in a 1v1 battle.
- Προεκλογική Υπόσχεση: heals 25 % now, the promise is broken two turns later (lose 1/8).
- Τηλεπώληση and Πρόγραμμα Ανάκαμψης move money: the player gains money when the player's creature uses them, loses it when the opponent's does.
- No PP: moves are unlimited. It keeps the 3-6 turn battles simple and removes a menu.
- A creature knows 4 moves at most; at higher levels the newest four are kept.

### Opponent AI (seeded)
Each move scores by expected damage as a share of the foe's current HP (type, STAB, accuracy, hits), +30 for a kill, small fixed values for status and setup moves (heal only below 35 % HP and not twice in a row), x(0.85-1.15) noise, and 12 % of turns a random move. Trainers use their item once (below 35 % HP, 70 % chance per turn). The same AI plays the player side in the simulations.

### Recruiting
`chance = rate/150 * (1 + 1.5 * (1 - hp/maxHP)) * statusFactor * tier * levelFactor`, clamped to 0.03-0.95.
- `rate` per species (Φακελάκης 70, Λαϊκατζής and Story-ούλα 45, Τρολόσαυρος 40 ... Σπυράδωνις 24; starters and Μιζοτάκης 0 = cannot be recruited). statusFactor: Υπό Έρευνα x1.5 ("needs a friend"), Λαδωμένος x2, Σκάνδαλο/Απεργία x1.2. tier: Φακελάκι x1, Φάκελος x1.5. levelFactor `max(0.5, 1 - 0.015 * level)`.
- Examples: Φακελάκης L3 at full HP: 45 % with a Φακελάκι, 67 % with a Φάκελος; at half HP 78 %; at 10 % HP 95 %. Σπυράδωνις L15 with a Φάκελος: 19 % at full HP, 44 % at 10 % HP, 66 % with Υπό Έρευνα, 87 % Λαδωμένος.
- One seeded roll decides; the number of shakes (0-2 breaks) is cosmetic and also seeded. Break-out lines: "Το βρήκε λίγο." Success line: "... δέχτηκε... για τα παιδιά."
- Trainers' creatures cannot be recruited, except Σπυράδωνις in the television battle and only with a Φάκελος (a Φακελάκι is "too small for a minister"). Μιζοτάκης cannot be recruited at all. The master envelope (Offshore Λογαριασμός) is not in the MVP. There is no PC: a full team of 6 refuses new recruits.

### Experience and levels
- Total XP to reach level n: `floor(0.6 * n^3)` (L5 75, L8 307, L10 600, L12 1,036, L14 1,646, L20 4,800). Max level 50.
- XP per defeated creature: `floor(speciesXp * foeLevel / 4)`, x1.5 against trainers, split between the participants that are still standing.
- Level-up raises current HP by the same amount as max HP. A level-up learns the species' moves for that level; with 4 moves known the game asks which to forget (or to skip).
- **Evolution:** Φακελάκης becomes Φακελάρχης at level 10, reachable in the slice (the wild ones are L2-8). The starters' evolutions (Βουλευτάκος, Μπατσόνος, Διάκος Ντίσκο at about level 16) are outside the 12 creatures of the MVP and are not built.

### Money
Trainer prize `lastCreatureLevel * 30` (+200 for the boss, +400 for the television host), x1.5 if the lead creature has Αφορολόγητο. Start 300. Black-out: back to the last ΚΕΠ (the only one), team healed, half the money kept. Prices: Φακελάκι 80, Φάκελος 200, Κουλούρι 25, Σουβλάκι 70, Φραπές 60, Τσίπουρο 180.

## 3. World
- Maps are character grids with a legend (`TILE_DEFS`); the route is painted by a small function (rectangles and a path) so the layout is easy to change. All maps are in the rules block so the tests can check them: row widths, walkable NPC and warp tiles, reachability by a flood fill that follows doors (`reachableTiles`), talking across counters, and the gated studio door.
- Towns: Νέα Πειραιάς (lab, ΚΕΠ, Περίπτερο, Καφενείο, two closed houses, the studio), Route 1 (three zones of grass with levels 2-4, 4-6, 6-8, rate 13 % per grass step), the Harbour Office with the boss.
- Trainers see 3-4 tiles ahead in the direction they face, walk up to you, fight, and walk back. The rival: first fight on leaving the lab (a story fight; losing it is allowed and sends you to the ΚΕΠ), second fight on the route, then he leaves.
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
- Battle sentences are built from events at play time, so switching language changes them immediately. Greek names get the right article and "άγριος/αντίπαλος" by the species' grammatical gender.

## 6. Save
- Key `mizamon.v1.save`, object `{ version: 1, player, party, money, bag, dex, flags, lastHeal, options, rngState, starter }`. Options also live under `mizamon.v1.options` so the language is remembered before a first save.
- `migrateSave()` accepts version 0 (flat prototype shape with `team`, `items`, `girl`, `drachmas`), version 1, rejects newer versions, drops unknown creatures and items, clamps levels and falls back to the start position when a place is unknown. Every storage call is in `try/catch` with an in-memory fallback.
- The seeded RNG state is saved so a loaded game continues the same random sequence.

## 7. Tests and balance
- `node Mizamon/tools/run-tests.mjs`: 22 groups (type chart against the seed table, damage numbers, abilities, statuses, recruit odds, level-up and move learning, AI, a 1,000-battle seeded replay twice with equal checksums, encounters, reachability, data references, strings, save migration, prize rules). Prints `PASS n / m`, exit code 1 on failure.
- `window.MIZAMON.selfTest()` (browser): rules smoke tests, all 14 sprites drawn, title -> notice -> new game reaches the overworld, walking, a scripted battle won through the real menus, recruit success path through the Bag menu, save round trip, language toggle, touch controls. Test hooks: `MIZAMON.quickStart({...})`, `press`, `pause`, `pumpUntil`, `forceTouch`.
- `node Mizamon/tools/balance.mjs [runs]` simulates the boss fight with an AI-played player team (one random starter plus five random route creatures, two Σουβλάκι). The player AI does not switch cleverly and never grinds smartly, so a human does a little better. 500 runs per row:

| Player level | 6 creatures at that level | 6 creatures, 2 levels behind | only 3 creatures, no items |
|---|---|---|---|
| 10 | 35.6 % | 4.4 % | 1.2 % |
| 12 | 76.2 % | 41.4 % | 17.4 % |
| 14 | 95.6 % | 80.0 % | 50.2 % |

Boss team: Φακελάκης L11, Φραπεδόρος L12, Φακελάρχης L13 (holds a Σουβλάκι). A player at level 12-14 with a normal team wins; at level 10 the fight is a real wall. The four route trainers (with the rival) give about 800 XP to the creatures that fight (level 10 is 600, level 12 is 1,036); the rest is a few wild fights, which is the "little grinding".

## 8. Sound
Original WebAudio: square, triangle and sawtooth blips for the menu, hits, faint, level-up, recruit; six short procedural chiptune loops (title/credits, town, indoors, route, battle, boss) written as note lists, with their own melodies. Mute: Options, or the N key. The audio context starts on the first key press or tap (browsers require it).

## 9. Not in the MVP (on purpose)
PC storage, Χοντρός Φάκελος, Offshore Λογαριασμός, Δικηγόρος and the other battle items, Spin and Crisis blues, starter evolutions, districts 2-8, ΚΤΕΛ fast travel, ΑΦΜ, Spin-based moves, PP.
