// ==== S16 MAPS: ARENA ====
// MP01 Foundry Spire (duel, ffa, party modes) - vertical, three levels, Fury Core on the exposed north bridge.
// Rows use the compact MapKit lists (see 16a-maps.js): brushes [material, min xyz, max xyz (, rampDir)].

// Free-for-all party modes (M15, M17, M18, M19, M24, M25): every map with 16+ free spawns offers them (MP01, MP02, MP06).
const MAP_PARTY_MODES = ['lms', 'infection', 'juggernaut', 'cursetag', 'bearer', 'roulette'];

Maps.rows.push(MapKit.make({
  id: 'spire', code: 'MP01', name: 'Foundry Spire', size: [50, 20, 50], theme: 'foundry', category: 'arena',
  modes: ['duel', 'ffa'].concat(MAP_PARTY_MODES), blurb: 'Vertical duel arena: ground floor, a ring catwalk and a spire top linked by two exposed bridges.',
  props: MapKit.crates([[-21, -21], [19.5, 19.5], [-14.5, -8], [4, 7]]),   // breakable crates (MAP-013): two in corners, one by a low wall, one by a spire-side crate
  sky: { top: 0x1f2a44, horizon: 0xd9824b, fog: 0x4a3a30, fogFar: 140, sun: [0.4, 0.7, 0.3] },
  brushes: [
    ['concrete', -25, -1, -25, 25, 0, 25],                                          // ground
    ['concrete', -27, -1, -27, 27, 14, -25], ['concrete', -27, -1, 25, 27, 14, 27], // perimeter walls
    ['concrete', -27, -1, -25, -25, 14, 25], ['concrete', 25, -1, -25, 27, 14, 25],
    ['metal', -25, 0, 21, 25, 4, 25], ['metal', -25, 0, -25, 25, 4, -21],           // ring catwalk, 4 m up
    ['metal', 21, 0, -21, 25, 4, 21], ['metal', -25, 0, -21, -21, 4, 21],
    ['grip', 3, 0, 20.8, 7, 4, 21], ['grip', -7, 0, -21, -3, 4, -20.8],                           // grip panels: MV05 Ravagers climb from the floor to the ring
    ['concrete', 13, 0, -2.5, 21, 4, 2.5, '+x'], ['concrete', -21, 0, -2.5, -13, 4, 2.5, '-x'], // ground to ring ramps
    ['concrete', -4, 0, -4, 4, 8, 4],                                               // the spire
    ['metal', -1, 8, -1, 1, 11, 1],                                                 // crown column (full cover)
    ['metal', 3.4, 8, -3, 4, 9, 3], ['metal', -4, 8, -3, -3.4, 9, 3],               // crown parapets (crouch cover)
    ['metal', -2, 3.5, 12, 2, 4, 21], ['metal', -2, 3.5, -21, 2, 4, -12],           // bridge decks
    ['metal', -2, 4, 4, 2, 8, 12, '-z'], ['metal', -2, 4, -12, 2, 8, -4, '+z'],     // bridge ramps up to the spire
    ['metal', -18, 4, 21, -8, 5, 21.3], ['metal', 8, 4, 21, 18, 5, 21.3],           // ring rails (crouch cover)
    ['metal', -18, 4, -21.3, -8, 5, -21], ['metal', 8, 4, -21.3, 18, 5, -21],
    ['metal', 21, 4, -14, 21.3, 5, -4], ['metal', 21, 4, 4, 21.3, 5, 14],
    ['metal', -21.3, 4, -14, -21, 5, -4], ['metal', -21.3, 4, 4, -21, 5, 14],
    ['concrete', 11, 0, 11, 13, 3.2, 13], ['concrete', -13, 0, 11, -11, 3.2, 13],   // ground pillars (full cover)
    ['concrete', 11, 0, -13, 13, 3.2, -11], ['concrete', -13, 0, -13, -11, 3.2, -11],
    ['concrete', 7, 0, 14, 12, 1, 14.5], ['concrete', -12, 0, 14, -7, 1, 14.5],     // low walls (crouch cover)
    ['concrete', 7, 0, -14.5, 12, 1, -14], ['concrete', -12, 0, -14.5, -7, 1, -14],
    ['concrete', 14.5, 0, 7, 15, 1, 12], ['concrete', 14.5, 0, -12, 15, 1, -7],
    ['concrete', -15, 0, 7, -14.5, 1, 12], ['concrete', -15, 0, -12, -14.5, 1, -7],
    ['metal', 5, 0, 5, 7, 1.4, 7], ['metal', -7, 0, -7, -5, 1.4, -5],               // crates beside the spire
  ],
  spawns: [
    [-1, [], [[-16, 0, -16, 45], [6, 0, -17, 0], [16, 0, -16, 315], [17, 0, -8, 270], [17, 0, 8, 270], [16, 0, 16, 225], [6, 0, 17, 180],
      [-6, 0, 17, 180], [-16, 0, 16, 135], [-17, 0, 8, 90], [-17, 0, -8, 90], [-6, 0, -17, 0],
      [-14, 4, 23.2, 180], [14, 4, 23.2, 180], [-14, 4, -23.2, 0], [14, 4, -23.2, 0]]],
  ],
  items: [
    ['fury', 0, 4, 16.5], ['surplus', 0, 4, -16.5], ['heavyplate', 0, 8, 2.8], ['megacell', -18, 0, -6], ['vitalshard', 5, 4, 23], ['vitalshard', -5, 4, -23],
    ['lightplate', 23.2, 4, 10], ['lightplate', -23.2, 4, -10],
    ['armorshard', 9, 0, 9], ['armorshard', -9, 0, 9], ['armorshard', 9, 0, -9], ['armorshard', -9, 0, -9],
    ['healthpack', 0, 0, 9], ['healthpack', 0, 0, -9], ['healthvial', 23, 4, 22.5], ['healthvial', -23, 4, 22.5],
    ['healthvial', 23, 4, -22.5], ['healthvial', -23, 4, -22.5],
    ['ramjet', 8, 0, 2], ['stormlash', -8, 0, -2], ['lancet', 23.2, 4, 17], ['scattergun', -23.2, 4, -17], ['vanguard', 0, 0, -11],
    ['ammobox', 8, 0, -2], ['ammobox', -8, 0, 2], ['ammocache', 0, 0, 11],
  ],
  zones: [
    ['Spire Top', -4, -4, 4, 4, 6, 14], ['North Bridge', -2.5, 4, 2.5, 21, 2, 10], ['South Bridge', -2.5, -21, 2.5, -4, 2, 10],
    ['North Ring', -25, 21, 25, 25, 2, 8], ['South Ring', -25, -25, 25, -21, 2, 8], ['East Ring', 21, -21, 25, 21, 2, 8], ['West Ring', -25, -21, -21, 21, 2, 8],
    ['East Ramp', 13, -3, 21, 3, -1, 6], ['West Ramp', -21, -3, -13, 3, -1, 6], ['Spire Base', -7, -7, 7, 7, -1, 3],
    ['Northeast Floor', 0, 0, 25, 25], ['Northwest Floor', -25, 0, 0, 25], ['Southeast Floor', 0, -25, 25, 0], ['Southwest Floor', -25, -25, 0, 0],
  ],
  lights: [[0, 12, 0, 0xffc890, 20], [0, 6, 16, 0xffb070, 14], [0, 6, -16, 0xffb070, 14], [16, 6, 16, 0xff9050, 14], [-16, 6, -16, 0xff9050, 14]],
  hints: [
    ['choke', 12, 0, 0], ['choke', -12, 0, 0], ['sniper', 0, 8, -3], ['sniper', 0, 4, 23], ['cover', 14, 0, 14], ['cover', -14, 0, -14],
    ['flank', 0, 4, -23], ['cover', -10, 0, 8],
  ],
}));

// MP02 Skyward Yard (ffa, tdm, party modes) - floating platforms: bases west and east, islands north and south, a centre deck with a tower;
// jump pads link the deck and the islands; the Lancet Rail sits on a ledge that juts out over the void.
const skyWest = {
  brushes: [
    ['ice', -34, -2, -12, -22, 2, 12], ['ice', -22, 2, -4, -12, 6, 4, '+x'],                       // base island and its ramp to the deck
    ['metal', -27, 2, 5, -25, 3, 7], ['metal', -27, 2, -7, -25, 3, -5],                             // crouch cover
    ['concrete', -31, 2, -1.5, -25, 9, 1.5],                                                         // the base bunker (breaks the long lines across the void)
    ['concrete', -24, 2, -4.6, -12, 9, -4.2], ['concrete', -24, 2, 4.2, -12, 9, 4.6],               // walls along the ramp
  ],
  spawns: [
    [0, ['tdm'], [[-31, 2, -9, 90], [-31, 2, -3, 90], [-31, 2, 3, 90], [-31, 2, 9, 90], [-24.5, 2, -10, 90], [-24.5, 2, -2.5, 90], [-24.5, 2, 2.5, 90], [-24.5, 2, 10, 90]]],
    [-1, ['ffa'].concat(MAP_PARTY_MODES), [[-31, 2, -9, 90], [-31, 2, 9, 90], [-24.5, 2, -2.5, 90], [-24.5, 2, 2.5, 90]]],
  ],
  items: [
    ['lightplate', -33, 2, 10.5], ['healthpack', -33, 2, -10.5], ['scattergun', -28, 2, 3.5], ['ammobox', -22.8, 2, -8], ['armorshard', -17, 4, 0],
  ],
  zones: [['West Base', -34, -12, -22, 12, -1, 6], ['West Ramp', -22, -4, -12, 4, 1, 8]],
  lights: [[-28, 6, 0, 0xcfe8ff, 18]],
  hints: [['choke', -17, 4, 0], ['cover', -26, 2, 8.5], ['cover', -26, 2, -8.5]],
};
const skySpan = {                                                                                    // north-west span, mirrored to the other three corners
  brushes: [['ice', -30, 1, 12, -26, 2, 26], ['ice', -30, 1, 24, -16, 2, 28], ['ice', -16, 2, 24, -12, 4, 28, '+x']],
  items: [['healthvial', -28, 2, 20], ['ammobox', -21, 2, 26]],
  zones: [['North West Span', -31, 12, -12, 28, -1, 6]],
  hints: [['choke', -28, 2, 16], ['flank', -20, 2, 26]],
};
const skyNorth = {                                                                                   // north island and the pads that serve it, mirrored to the south
  brushes: [['ice', -12, 0, 22, 12, 4, 34], ['ice', -3, 4, 26.8, 3, 5, 27.2], ['metal', -9, 4, 29, -7, 8, 31], ['metal', 7, 4, 29, 9, 8, 31]],
  spawns: [[-1, ['ffa'].concat(MAP_PARTY_MODES), [[-10.5, 4, 32.5, 180], [10.5, 4, 32.5, 180], [-10.5, 4, 24, 180], [10.5, 4, 24, 180]]]],
  items: [['surplus', 0, 4, 31], ['armorshard', -10, 4, 32], ['armorshard', 10, 4, 32], ['healthpack', -10, 4, 24], ['healthpack', 10, 4, 24]],
  zones: [['North Isle', -12, 22, 12, 34, -1, 10]],
  lights: [[0, 9, 28, 0xcfe8ff, 18]],
  hints: [['sniper', 0, 4, 33], ['cover', 0, 4, 25.5]],
  triggers: [
    { kind: 'jumppad', min: [2, 6, 7.5], max: [5, 6.4, 10.5], target: [3.5, 4, 28], peak: 4 },      // deck to island
    { kind: 'jumppad', min: [-5, 6, 7.5], max: [-2, 6.4, 10.5], target: [-3.5, 4, 28], peak: 4 },
    { kind: 'jumppad', min: [2, 4, 22.5], max: [5, 4.4, 25.5], target: [3.5, 6, 6.5], peak: 4 },    // island back to the deck
    { kind: 'jumppad', min: [-5, 4, 22.5], max: [-2, 4.4, 25.5], target: [-3.5, 6, 6.5], peak: 4 },
  ],
};
const skyCenter = {
  brushes: [
    ['ice', -12, 3, -12, 12, 6, 12], ['metal', -4, 6, -4, 4, 10, 4], ['metal', 4, 6, -2, 12, 10, 2, '-x'], ['metal', -12, 6, -2, -4, 10, 2, '+x'], // deck, tower, tower ramps
    ['grip', -3, 6, 4, -1.5, 10, 4.2], ['grip', 1.5, 6, -4.2, 3, 10, -4],                         // grip panels: MV05 Ravagers climb the tower
    ['metal', -1, 9.5, 4, 1, 10, 16],                                                               // the risky ledge
    ['ice', 6, 0, 12.5, 12, 10, 21.5], ['ice', -12, 0, 12.5, -6, 10, 21.5],                         // floating monoliths: break the long lines over the void
    ['ice', 6, 0, -21.5, 12, 10, -12.5], ['ice', -12, 0, -21.5, -6, 10, -12.5],
    ['metal', 8, 6, 7, 10, 7.4, 9], ['metal', -10, 6, 7, -8, 7.4, 9], ['metal', 8, 6, -9, 10, 7.4, -7], ['metal', -10, 6, -9, -8, 7.4, -7], // crates
  ],
  items: [['quickening', 0, 10, 0], ['heavyplate', 0, 6, 8], ['megacell', 0, 6, -8], ['lancet', 0, 10, 14.5], ['vitalshard', 2.5, 10, -2.5], ['vitalshard', -2.5, 10, 2.5]],
  zones: [
    ['Center North', -12, 0, 12, 12, 2, 8], ['Center South', -12, -12, 12, 0, 2, 8], ['Sky Tower', -4, -4, 4, 4, 8, 14],
    ['Rail Ledge', -1.5, 4, 1.5, 17, 8, 12], ['Tower Ramp West', -12, -2, -4, 2, 5, 11], ['Tower Ramp East', 4, -2, 12, 2, 5, 11],
  ],
  lights: [[0, 14, 0, 0xcfe8ff, 24]],
  hints: [['sniper', 0, 10, 3], ['cover', 9, 6, 6], ['cover', -9, 6, -6]],
  triggers: [{ kind: 'killzone', min: [-40, -40, -40], max: [40, -3, 40] }],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'skyyard', code: 'MP02', name: 'Skyward Yard', size: [70, 30, 70], theme: 'glacier', category: 'arena',
  modes: ['ffa', 'tdm'].concat(MAP_PARTY_MODES),
  blurb: 'Open floating platforms linked by ramps and jump pads; the Lancet Rail waits on a risky ledge.',
  props: MapKit.crates([[-12, -3.5, 6], [10.5, 2, 6], [-7, -31, 4], [5.5, 29.5, 4]]),   // breakable crates (MAP-013): beside the tower ramps and the island posts
  sky: { top: 0x6fa8de, horizon: 0xe3f1fb, fog: 0xcfe3f3, fogFar: 200, sun: [0.3, 0.8, 0.5] },
}, MapKit.join(MapKit.sym(skyWest, 'x'), MapKit.sym(skySpan, 'xz'), MapKit.sym(skyNorth, 'z'), skyCenter))));

// MP06 Gantry Run (agile modes) - two long blocks with walkable rooftops, 4 m wall-run lanes behind them, a central hub; teams start in the end yards.
const gantryQuarter = {                                                                              // north-west quarter, mirrored to the other three
  brushes: [
    ['concrete', -50, 0, 16, -36, 8, 22, '+x'],                                                      // yard ramp up to the north roof
    ['metal', -10, 0, 24, -8, 2.4, 25.9], ['metal', -22, 0, 26.1, -20, 2.4, 28],                     // lane chicane crates (stagger breaks the long line)
    ['concrete', -22, 0, 8, -20, 3, 12], ['concrete', -42, 0, 30, -38, 3, 34], ['metal', -45, 0, 8, -43, 1, 14], // pillars, yard cover
    ['concrete', -31, 8, 20, -29, 12, 22], ['concrete', -18, 8, 16, -16, 12, 18], ['concrete', -14, 8, 18, -12, 12, 20], // roof vents (full cover, break the long roof lines)
  ],
  spawns: [
    [0, ['tdm', 'dom', 'hardpoint'], [[-46, 0, 6, 90], [-46, 0, 12, 90], [-46, 0, 29, 90], [-46, 0, 35, 90]]],
    [-1, ['ffa', 'duel', 'gungame', 'oddball'].concat(MAP_PARTY_MODES), [[-40, 0, 10, 90], [-44, 0, 32, 90], [-15, 0, 26, 90], [-30, 8, 18, 90], [-30, 0, 11, 90]]],
  ],
  items: [
    ['lightplate', -47, 0, 37.5], ['healthpack', -42, 0, 12], ['armorshard', -30, 0, 26], ['ammobox', -16, 0, 26], ['stormlash', -28, 0, 9.5],
    ['ramjet', -33, 8, 19], ['vanguard', -42, 0, 26.5], ['healthvial', -22, 8, 19], ['armorshard', -26, 8, 16.5],
  ],
  zones: [
    ['North West Yard', -50, 0, -34, 40, -1, 6], ['North West Ramp', -50, 16, -36, 22, -1, 10], ['North Lane West', -34, 24, 0, 28, -1, 5],
    ['North Roof West', -36, 14, 0, 24, 6, 12],
  ],
  lights: [[-42, 8, 20, 0xffe0b0, 24], [-20, 12, 11, 0xffe0b0, 26], [-18, 6, 26, 0xffd8a0, 18]],
  hints: [['sniper', -34, 8, 19], ['choke', -17, 0, 26], ['cover', -18, 0, 10], ['flank', -43, 0, 30]],
  triggers: [
    { kind: 'ladder', min: [-16, 0, 24], max: [-14, 8, 24.8] },
    { kind: 'jumppad', min: [-6, 0, 10], max: [-4, 0.4, 12], target: [-5, 8, 19], peak: 6 },       // up to the north roof
  ],
};
const gantryHalf = {                                                                                 // west half of the central area, mirrored east
  brushes: [['concrete', -16, 0, -3, -8, 4, 3, '+x']].concat(MapKit.wall('concrete', 'z', -26, 1.5, -14, 14, 0, 12, [[-5, 4, 3.2], [5, 4, 3.2]])), // hub ramp, gate wall
  zones: [['West Plaza', -36, -14, -16, 14, -1, 6], ['Hub Ramp West', -16, -4, -8, 4, -1, 5]],
};
const gantryCenter = {
  brushes: [
    ['concrete', -50, -1, -40, 50, 0, 40],                                                           // ground
    ['concrete', -53, -1, -43, 53, 14, -40], ['concrete', -53, -1, 40, 53, 14, 43],                  // perimeter
    ['concrete', -53, -1, -40, -50, 14, 40], ['concrete', 50, -1, -40, 53, 14, 40],
    ['concrete', -36, 0, 14, 36, 7.8, 24], ['metal', -36, 7.8, 14, 36, 8, 24],                       // north block and its roof
    ['concrete', -36, 0, -24, 36, 7.8, -14], ['metal', -36, 7.8, -24, 36, 8, -14],                   // south block and its roof
    ['concrete', -34, 0, 28, 34, 10, 40], ['concrete', -34, 0, -40, 34, 10, -28],                    // warehouses behind the lanes
    ['metal', -8, 0, -8, 8, 4, 8],                                                                   // hub
    ['grip', -5, 0, 8, 5, 4, 8.2], ['grip', -5, 0, -8.2, 5, 4, -8],                                 // grip panels: MV05 Ravagers climb the hub
    ['metal', -7, 4, -7, -6, 6, -6], ['metal', 6, 4, -7, 7, 6, -6], ['metal', -7, 4, 6, -6, 6, 7], ['metal', 6, 4, 6, 7, 6, 7], // hub corner posts
  ],
  items: [['fury', 0, 4, 5], ['surplus', 0, 0, 26], ['surplus', 0, 0, -26], ['megacell', 0, 8, 19], ['heavyplate', 0, 8, -19], ['vitalshard', 5, 4, -5], ['vitalshard', -5, 4, 5]],
  zones: [
    ['Hub', -8, -8, 8, 8, 2, 8],
    ['Center North', -16, 8, 16, 14, -1, 6], ['Center South', -16, -14, 16, -8, -1, 6], ['North Roof Mid', -6, 14, 6, 24, 6, 12],
    ['South Roof Mid', -6, -24, 6, -14, 6, 12], ['North Lane Mid', 0, 24, 8, 28, -1, 5], ['South Lane Mid', -8, -28, 0, -24, -1, 5],
  ],
  hints: [['sniper', 0, 8, 22], ['sniper', 0, 8, -22], ['cover', 0, 4, -5]],
  objectives: [
    { id: 'domA', kind: 'point', x: 0, y: 8, z: 19, radius: 6, modes: ['dom'] }, { id: 'domB', kind: 'point', x: 0, y: 4, z: 0, radius: 6, modes: ['dom'] },
    { id: 'domC', kind: 'point', x: 0, y: 8, z: -19, radius: 6, modes: ['dom'] },
    { id: 'hill1', kind: 'hill', x: 0, y: 4, z: 0, radius: 7, modes: ['hardpoint'] }, { id: 'hill2', kind: 'hill', x: 0, y: 0, z: 26, radius: 6, modes: ['hardpoint'] },
    { id: 'hill3', kind: 'hill', x: 42, y: 0, z: 0, radius: 8, modes: ['hardpoint'] }, { id: 'hill4', kind: 'hill', x: 0, y: 0, z: -26, radius: 6, modes: ['hardpoint'] },
    { id: 'hill5', kind: 'hill', x: -42, y: 0, z: 0, radius: 8, modes: ['hardpoint'] },
    { id: 'relic', kind: 'relic', x: 0, y: 4, z: -4, radius: 2, modes: ['oddball'] },
  ],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'gantry', code: 'MP06', name: 'Gantry Run', size: [100, 24, 80], theme: 'station', category: 'large',
  modes: ['ffa', 'tdm', 'duel', 'dom', 'hardpoint', 'oddball', 'gungame'].concat(MAP_PARTY_MODES),
  blurb: 'Agile playground: rooftop runs, 4 m wall-run lanes and a central hub; ladders and pads cross between levels.',
  props: MapKit.crates([[-50, -23.5], [48.5, 22], [-6.5, -6, 4], [-23, -8]]),   // breakable crates (MAP-013): two in corners, one on the hub, one by ground cover
  sky: { top: 0x3a5a88, horizon: 0xe9c9a0, fog: 0x7a7f8a, fogFar: 170, sun: [-0.3, 0.6, 0.4] },
}, MapKit.join(MapKit.sym(gantryQuarter, 'xz'), MapKit.sym(gantryHalf, 'x'), gantryCenter))));
