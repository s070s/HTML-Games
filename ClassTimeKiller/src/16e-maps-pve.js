// ==== S16 MAPS: PVE AND SPECIAL ====
// MP07 Cistern (horde, endless, fiends), MP10 Proving Grounds (range), MP12 Ash Manor (contract), MP11 Test Chambers (puzzle)
// and the MP09 Ring Isle placeholder (royale). Co-op maps: team 0 = the player side, team 1 = the enemy gates / guard posts.
// Rows use the compact MapKit lists (see 16a-maps.js).

const PVE_MODES = ['horde', 'endless', 'fiends'];

// MP07 Cistern - a square tank: the core room in the middle, four spawn gates (one per side), pump platforms west and east.
const cisternWest = {                                                                                // west gate and pump platform, mirrored east
  brushes: [
    ...MapKit.wall('concrete', 'z', -33, 1.5, -5, 5, 0, 5, [[0, 4, 3.4]]),                           // gate wall with a door
    ['concrete', -40, 0, 4.5, -33, 5, 5.5], ['concrete', -40, 0, -5.5, -33, 5, -4.5],                // gate hall side walls
    ['metal', -28, 0, -8, -22, 3, 8], ['metal', -28, 0, -16, -22, 3, -8, '+z'],                      // pump platform and its ramp
    ['metal', -27, 3, 2, -25, 4.2, 4], ['metal', -27, 3, -4, -25, 4.2, -2],                          // platform cover
  ],
  spawns: [[1, PVE_MODES, [[-38, 0, -2, 90], [-38, 0, 2, 90], [-36, 0, 0, 90]]]],
  zones: [['West Gate', -40, -5.5, -33, 5.5, -1, 8], ['West Pump', -28, -8, -22, 8, 1, 7], ['West Pump Ramp', -28, -16, -22, -8, -1, 5]],
  lights: [[-37, 4, 0, 0xa8d8ff, 14], [-25, 6, 0, 0xa8d8ff, 16]],
  hints: [['sniper', -24, 3, 0], ['choke', -33, 0, 0]],
  triggers: [{ kind: 'ladder', min: [-22, 0, -1], max: [-21.2, 3, 1] }],
};
const cisternNorth = {                                                                               // north gate, mirrored south
  brushes: [
    ...MapKit.wall('concrete', 'x', 33, 1.5, -5, 5, 0, 5, [[0, 4, 3.4]]),
    ['concrete', 4.5, 0, 33, 5.5, 5, 40], ['concrete', -5.5, 0, 33, -4.5, 5, 40],
  ],
  spawns: [[1, PVE_MODES, [[-2, 0, 38, 180], [2, 0, 38, 180], [0, 0, 36, 180]]]],
  zones: [['North Gate', -5.5, 33, 5.5, 40, -1, 8]],
  lights: [[0, 4, 37, 0xa8d8ff, 14]],
  hints: [['choke', 0, 0, 33]],
};
const cisternQuarter = {                                                                             // north-west quarter, mirrored three times
  brushes: [
    ['concrete', -17, 0, 17, -14, 3.6, 20], ['concrete', -26, 0, 10, -23, 1.2, 14], ['concrete', -12, 0, 26, -9, 1.2, 29], ['concrete', -30, 0, 20, -28, 2.6, 23],
    ['water', -33, 0, 27, -27, 0.05, 33],                                                            // acid pool (hazard trigger below)
  ],
  items: [
    ['healthpack', -12, 0, 22, PVE_MODES], ['ammobox', -19.5, 0, 17.5, PVE_MODES], ['armorshard', -20, 0, 26, PVE_MODES], ['ammocache', -8, 0, 14, PVE_MODES],
  ],
  zones: [['North West Court', -40, 0, 0, 40, -1, 8]],
  lights: [[-20, 6, 20, 0xa8d8ff, 24]],
  hints: [['cover', -15.5, 0, 15], ['cover', -21, 0, 20], ['guard', -10, 0, 20], ['flank', -30, 0, 14]],
  triggers: [
    { kind: 'hazard', min: [-33, 0, 27], max: [-27, 0.6, 33], dps: 12, element: 'acid' },
    { kind: 'teleporter', min: [-23, 0, 29], max: [-20, 0.3, 32], exit: [22, 0, -26], exitYaw: -35 },
  ],
};
const cisternCenter = {
  brushes: [
    ['concrete', -40, -1, -40, 40, 0, 40],                                                           // floor
    ['concrete', -43, -1, -43, 43, 10, -40], ['concrete', -43, -1, 40, 43, 10, 43], ['concrete', -43, -1, -40, -40, 10, 40], ['concrete', 40, -1, -40, 43, 10, 40], // walls
    ...MapKit.wall('concrete', 'x', 8, 1.5, -8, 8, 0, 5, [[0, 5, 3.4]]), ...MapKit.wall('concrete', 'x', -8, 1.5, -8, 8, 0, 5, [[0, 5, 3.4]]), // core room
    ...MapKit.wall('concrete', 'z', 8, 1.5, -8, 8, 0, 5, [[0, 5, 3.4]]), ...MapKit.wall('concrete', 'z', -8, 1.5, -8, 8, 0, 5, [[0, 5, 3.4]]),
    ['tile', -8, -1, -8, 8, 0, 8], ['metal', -1.5, 0, -1.5, 1.5, 0.4, 1.5],                          // core room floor, core pedestal
  ],
  spawns: [[0, PVE_MODES, [[3.5, 0, 3.5, 225], [-3.5, 0, 3.5, 135], [3.5, 0, -3.5, 315], [-3.5, 0, -3.5, 45], [5.5, 0, 0, 270], [-5.5, 0, 0, 90], [0, 0, 5.5, 180], [0, 0, -5.5, 0]]]],
  zones: [['Core Room', -8, -8, 8, 8, -1, 8], ['Core Door North', -2.5, 7, 2.5, 9, -1, 8], ['Core Door South', -2.5, -9, 2.5, -7, -1, 8],
    ['Core Door West', -9, -2.5, -7, 2.5, -1, 8], ['Core Door East', 7, -2.5, 9, 2.5, -1, 8]],
  lights: [[0, 5.5, 0, 0xffe0a0, 14], [0, 3.5, 8, 0xffe0a0, 8], [0, 3.5, -8, 0xffe0a0, 8], [8, 3.5, 0, 0xffe0a0, 8], [-8, 3.5, 0, 0xffe0a0, 8]],
  hints: [['guard', 0, 0, 4], ['guard', 0, 0, -4]],
  objectives: [
    { id: 'core', kind: 'core', x: 0, y: 0.4, z: 0, radius: 3, modes: ['horde', 'endless'] },
    { id: 'extract', kind: 'extract', x: 0, y: 0, z: -28, radius: 4, modes: ['endless'] },
  ],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'cistern', code: 'MP07', name: 'Cistern', size: [80, 20, 80], theme: 'canal', category: 'pve', modes: PVE_MODES,
  blurb: 'Defend the core room in a square tank: four spawn gates, pump platforms with ladders, acid pools and teleporters.',
  sky: { top: 0x0b1626, horizon: 0x2c4a63, fog: 0x1a2c3c, fogFar: 120, sun: [0.1, 0.9, 0.1] },
}, MapKit.join(MapKit.sym(cisternWest, 'x', true), MapKit.sym(cisternNorth, 'z', true), MapKit.sym(cisternQuarter, 'xz', true), cisternCenter))));

// MP10 Proving Grounds (range) - five 7 m shooting lanes with booths, a strafe lane with speed bumps, a movement park with a ramp,
// stairs, a ladder and a jump pad, and a dummy yard. Dummy stations are the 'dummy' nav hints.
const RANGE_LANE_CENTERS = [-26.5, -19.5, -12.5, -5.5, 1.5];
const RANGE_LANE_NAMES = ['Lane One', 'Lane Two', 'Lane Three', 'Lane Four', 'Lane Five'];
const rangeDividers = [-30, -23, -16, -9, -2, 5].flatMap((x, index) => MapKit.wall('concrete', 'z', x, 0.4, -30, 24, 0, 3, [[index % 2 ? -24 : -21, 2, 2.6]]));
const rangeLanes = RANGE_LANE_CENTERS.flatMap((c, index) => [
  ['wood', c - 1.5, 0, -22.4, c + 1.5, 1.1, -22],                                                      // firing counter (crouch cover)
  index % 2 === 0 ? ['concrete', c - 1.5, 0, 0, c + 1.5, 1.2, 0.4] : ['concrete', c - 0.5, 0, 12, c + 0.5, 2.6, 13], // mid-lane cover
]);
const rangeCenter = {
  brushes: [
    ['concrete', -40, -1, -30, 40, 0, 30],                                                           // floor
    ['concrete', -43, -1, -33, 43, 8, -30], ['concrete', -43, -1, 30, 43, 8, 33], ['concrete', -43, -1, -30, -40, 8, 30], ['concrete', 40, -1, -30, 43, 8, 30],
    ...rangeDividers, ...rangeLanes,
    ['concrete', -30, 0, 24, 5.2, 6, 25.5],                                                          // backstop behind the lanes
    ['concrete', -20.2, 0, 25.5, -19.8, 4, 28], ['concrete', 11.8, 0, 28, 12.2, 4, 30],              // back walk partitions (staggered gaps)
    ['concrete', 9.8, 0, -30, 10.2, 6, 24], ['concrete', 21.8, 0, -30, 22.2, 6, 24],                 // strafe lane walls (tall: the park platform looks over 3 m)
    ['concrete', 10.2, 0, -14, 21.8, 0.4, -13.4], ['concrete', 10.2, 0, -6, 21.8, 0.4, -5.4], ['concrete', 10.2, 0, 2, 21.8, 0.4, 2.6], ['concrete', 10.2, 0, 10, 21.8, 0.4, 10.6], // speed bumps
    ['concrete', 30, 0, -10, 38, 3, 10], ['concrete', 30, 0, -18, 38, 3, -10, '+z'],                 // movement park platform and ramp
    ...MapKit.stairs('concrete', '+x', 24, 14, 30, 20, 0, 3.2, 8), ['concrete', 30, 0, 14, 38, 3.2, 20], // stairs and landing
    ['concrete', -38, 0, -12, -35, 2.4, -9], ['concrete', -38, 0, 8, -35, 1.2, 11], ['metal', -34, 0, -2, -32, 1.2, 2], // dummy yard cover
  ],
  spawns: [[-1, ['range'], RANGE_LANE_CENTERS.map((c) => [c - 2, 0, -28, 0])]],
  items: RANGE_LANE_CENTERS.map((c) => ['ammobox', c + 2, 0, -26, ['range']]).concat([['healthpack', 26, 0, -26, ['range']], ['lightplate', -36, 0, -26, ['range']]]),
  zones: [
    ...RANGE_LANE_NAMES.map((name, index) => [name, RANGE_LANE_CENTERS[index] - 3.5, -30, RANGE_LANE_CENTERS[index] + 3.5, 24]),
    ['Pad Walk', 5, -30, 9.8, 24], ['Strafe Lane', 9.8, -30, 22.2, 24], ['Movement Park', 22.2, -30, 40, 24], ['Dummy Yard', -40, -30, -30, 24], ['Back Walk', -40, 24, 40, 30],
  ],
  lights: [[-12, 8, -26, 0xfff0d0, 30], [16, 8, 0, 0xfff0d0, 30], [-35, 6, 0, 0xfff0d0, 22], [34, 8, 0, 0xfff0d0, 22]],
  hints: RANGE_LANE_CENTERS.flatMap((c) => [['dummy', c, 0, -8], ['dummy', c, 0, 8], ['dummy', c, 0, 20]])
    .concat([['dummy', 16, 0, -20], ['dummy', 16, 0, 18], ['dummy', -36, 0, -20], ['dummy', -36, 0, 4], ['dummy', -36, 0, 18], ['sniper', 34, 3, 0]]),
  triggers: [
    { kind: 'ladder', min: [29.2, 0, -1], max: [30, 3, 1] },
    { kind: 'jumppad', min: [26, 0, 5], max: [28, 0.4, 7], launch: [6.06, 14.14, 0] },
  ],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'provinggrounds', code: 'MP10', name: 'Proving Grounds', size: [80, 14, 60], theme: 'station', category: 'range', modes: ['range'],
  blurb: 'Firing range: five shooting lanes, a strafe lane, a movement park and a dummy yard.',
  sky: { top: 0x6a95c4, horizon: 0xdde6ee, fog: 0xc4d0dc, fogFar: 160, sun: [0.2, 0.85, 0.3] },
}, rangeCenter)));

// MP12 Ash Manor (contract) - a manor with five rooms and a walkable roof inside a walled garden. Three ways in (front gate, west
// garden, east yard), guards inside and out; steal the relic from the study and leave by the south-east corner.
const MANOR_GUARD_MODES = ['contract'];
const manorColumns = [[-28, -28], [28, -28], [-28, 28], [28, 28], [-10, -26], [10, -26], [-10, 26], [10, 26]]
  .map(([x, z]) => ['concrete', x - 0.6, 0, z - 0.6, x + 0.6, 3, z + 0.6]);                          // garden statues (full cover)
const manorCenter = {
  brushes: [
    ['grass', -45, -1, -45, 45, 0, 45],                                                              // garden floor
    ['concrete', -48, -1, -48, 48, 6, -45], ['metal', -3, 0, -45, -2, 5, -43.5], ['metal', 2, 0, -45, 3, 5, -43.5], // south wall, front gate posts
    ['concrete', -48, -1, 45, 48, 6, 48], ['concrete', -48, -1, -45, -45, 6, 45], ['concrete', 45, -1, -45, 48, 6, 45],
    ...MapKit.wall('concrete', 'x', -6, 0.6, -20, 20, 0, 4, [[0, 3, 3]]), ...MapKit.wall('concrete', 'x', 18, 0.6, -20, 20, 0, 4, [[14, 2, 2.8]]), // manor walls
    ...MapKit.wall('concrete', 'z', -20, 0.6, -6, 18, 0, 4, [[0, 2, 2.8]]), ...MapKit.wall('concrete', 'z', 20, 0.6, -6, 18, 0, 4, [[12, 2, 2.8]]),
    ...MapKit.wall('concrete', 'z', -7, 0.4, -6, 18, 0, 4, [[0, 2, 2.8], [12, 2, 2.8]]), ...MapKit.wall('concrete', 'z', 7, 0.4, -6, 18, 0, 4, [[0, 2, 2.8], [12, 2, 2.8]]), // hall walls
    ...MapKit.wall('concrete', 'x', 6, 0.4, -20, -7, 0, 4, [[-13.5, 2, 2.8]]), ...MapKit.wall('concrete', 'x', 6, 0.4, 7, 20, 0, 4, [[13.5, 2, 2.8]]), // room dividers
    ['wood', -20, 4, -6, 20, 4.4, 18],                                                               // the roof (walkable)
    ['wood', 20, 0, -3, 28, 4.4, 1, '-x'],                                                           // ramp up to the roof
    ['wood', -3, 0, 3, 3, 0.9, 5], ['wood', -4, 0, 12, -2, 0.9, 15], ['wood', 2, 0, 12, 4, 0.9, 15], ['wood', -17, 0, -3, -15, 1.4, 0], ['wood', 15, 0, 1, 18, 0.9, 4], // furniture
    ['wood', -18, 0, 15.5, -16, 0.9, 17.5],
    ['grass', -5, 0, -44, -4.6, 2.4, -30], ['grass', 4.6, 0, -44, 5, 2.4, -30], ['grass', -44, 0, -30, -8, 2.4, -29.4], ['grass', 8, 0, -30, 44, 2.4, -29.4], // front path hedges
    ['grass', 8, 0, 34, 44, 2.4, 34.6], ['grass', -44, 0, 34, -8, 2.4, 34.6],                        // north garden hedges
    ['concrete', -12, 0, -40, -6, 3.4, -34], ['concrete', 6, 0, -40, 12, 3.4, -34],                  // gatehouses
    ...MapKit.wall('glass', 'x', -24, 0.3, 28, 40, 0, 2.8, []), ...MapKit.wall('glass', 'x', -14, 0.3, 28, 40, 0, 2.8, [[34, 2, 2.4]]),  // greenhouse
    ...MapKit.wall('glass', 'z', 28, 0.3, -24, -14, 0, 2.8, []), ...MapKit.wall('glass', 'z', 40, 0.3, -24, -14, 0, 2.8, []),
    ['grass', -42, 0, -12, -28, 2.4, -11.4], ['grass', -42, 0, 2, -34, 2.4, 2.6], ['grass', -30, 0, -24, -14, 2.4, -23.4], ['grass', 14, 0, -34, 24, 2.4, -33.4], // hedges
    ['grass', -30, 0, 26, -14, 2.4, 26.6], ['grass', 14, 0, 26, 30, 2.4, 26.6], ['grass', 32, 0, 6, 42, 2.4, 6.6], ['grass', -40, 0, 18, -32, 2.4, 18.6],
    ['grass', 34, 0, 30, 42, 2.4, 30.6], ['grass', -42, 0, 32, -34, 2.4, 32.6],
    ...manorColumns,
  ],
  spawns: [
    [0, MANOR_GUARD_MODES, [[-1.5, 0, -42, 0], [1.5, 0, -42, 0], [-42, 0, 8, 90], [-42, 0, 12, 90], [42, 0, -18, 270], [42, 0, -22, 270]]],
    [1, MANOR_GUARD_MODES, [[-3, 0, 10, 180], [3, 0, 2, 0], [-13, 0, 2, 90], [-13, 0, 14, 270], [13, 0, -2, 90], [13, 0, 14, 0], [0, 0, -30, 0], [-26, 0, -26, 45], [26, 0, 20, 225], [10, 4.4, 6, 270]]],
  ],
  items: [['healthpack', 14, 0, 15.5, MANOR_GUARD_MODES], ['ammobox', 0, 0, 8, MANOR_GUARD_MODES], ['armorshard', -15, 0, -4, MANOR_GUARD_MODES], ['healthvial', 12, 4.4, 14, MANOR_GUARD_MODES]],
  zones: [
    ['Great Hall', -7, -6, 7, 18, -1, 4.2], ['Library', -20, -6, -7, 6, -1, 4.2], ['Study', -20, 6, -7, 18, -1, 4.2], ['Dining Room', 7, -6, 20, 6, -1, 4.2],
    ['Kitchen', 7, 6, 20, 18, -1, 4.2], ['Manor Roof', -20, -6, 29, 18, 3.9, 12], ['Greenhouse', 28, -24, 40, -14, -1, 6], ['Front Gate', -6, -48, 6, -38, -1, 8],
    ['South West Garden', -45, -45, 0, 0], ['South East Garden', 0, -45, 45, 0], ['North West Garden', -45, 0, 0, 45], ['North East Garden', 0, 0, 45, 45],
  ],
  lights: [[0, 3.4, 6, 0xffd9a0, 14], [-13.5, 3.4, 0, 0xffd9a0, 12], [-13.5, 3.4, 12, 0xffd9a0, 12], [13.5, 3.4, 0, 0xffd9a0, 12], [13.5, 3.4, 12, 0xffd9a0, 12],
    [0, 5, -44, 0xffe8c0, 16], [-30, 6, 0, 0xc8d8f0, 24], [30, 6, 20, 0xc8d8f0, 24]],
  hints: [
    ['guard', 0, 0, -30], ['guard', -26, 0, -26], ['guard', 26, 0, 20], ['guard', -3, 0, 10], ['guard', 13, 0, 14], ['guard', -13, 0, 14],
    ['sniper', 10, 4.4, 6], ['sniper', -10, 4.4, 14], ['choke', 0, 0, -6], ['choke', -20, 0, 0], ['cover', -16, 0, 1], ['flank', 36, 0, -8],
  ],
  objectives: [
    { id: 'relic', kind: 'relic', x: -14, y: 0, z: 12, radius: 1.5, modes: MANOR_GUARD_MODES },
    { id: 'exit', kind: 'extract', x: 40, y: 0, z: -40, radius: 3, modes: MANOR_GUARD_MODES },
  ],
  triggers: [{ kind: 'ladder', min: [-21.2, 0, 8], max: [-20.4, 4.4, 10] }],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'manor', code: 'MP12', name: 'Ash Manor', size: [90, 16, 90], theme: 'ruins', category: 'pve', modes: MANOR_GUARD_MODES,
  blurb: 'Stealth contract: slip past the guards, steal the relic from the study and leave through the south-east corner.',
  sky: { top: 0x1a2236, horizon: 0x6a5a58, fog: 0x3a3a44, fogFar: 150, sun: [-0.2, 0.5, 0.2] },
}, manorCenter)));

// MP11 Test Chambers - twelve 20 m rooms in a snake (1 to 12), each teaching one traversal element that the exit pad needs. Plans are
// written around the room centre (x east, z north); placeChamber() moves them into the grid. Puzzle objects (buttons, cubes) come with step 14.4.
const CHAMBER_CENTERS = [[-30, -20], [-10, -20], [10, -20], [30, -20], [30, 0], [10, 0], [-10, 0], [-30, 0], [-30, 20], [-10, 20], [10, 20], [30, 20]];
const CHAMBER_NAMES = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const CHAMBER_PLANS = [
  { brushes: [['concrete', 2, 0, -4, 7, 2, 4], ['concrete', -5, 0, -4, 2, 2, 4, '+x']], exit: [4.5, 2, 0] },                                    // 1 ramp
  { brushes: [...MapKit.stairs('concrete', '+x', -4, -3, 2, 3, 0, 3.2, 8), ['concrete', 2, 0, -3, 7, 3.2, 3]], exit: [4.5, 3.2, 0] },             // 2 stairs
  { brushes: [['concrete', 2, 0, -4, 7, 4, 4]], triggers: [{ kind: 'ladder', min: [1.2, 0, -1], max: [2, 4, 1] }], exit: [4.5, 4, 0] },          // 3 ladder
  { brushes: [['concrete', 3, 0, -4, 7, 4.5, 4]], triggers: [{ kind: 'jumppad', min: [-3, 0, -1.5], max: [-1, 0.4, 1.5], launch: [6.36, 16.73, 0] }], exit: [5, 4.5, 0] }, // 4 jump pad
  { brushes: [['concrete', 2, 0, 3.5, 7, 4, 4], ['concrete', 2, 0, -4, 7, 4, -3.5], ['concrete', 2, 0, -3.5, 2.5, 4, 3.5], ['concrete', 6.5, 0, -3.5, 7, 4, 3.5]], // 5 teleporter alcove
    triggers: [{ kind: 'teleporter', min: [-6, 0, -1], max: [-4, 0.3, 1], exit: [4.5, 0, -2], exitYaw: 90 }, { kind: 'teleporter', min: [5, 0, 1.5], max: [6.3, 0.3, 3], exit: [-3, 0, 3], exitYaw: 270 }], exit: [4, 0, 2] },
  { brushes: [['wood', -4, 0, -1.5, -2, 1.4, 1.5, '+x'], ['wood', -2, 0, -1.5, 2, 1.4, 1.5], ['wood', 2, 0, -1.5, 4, 1.4, 1.5, '-x']],                // 6 acid strip with a bridge
    triggers: [{ kind: 'hazard', min: [-2, -0.5, -9], max: [2, 0.2, 9], dps: 15, element: 'acid' }], exit: [6, 0, 0] },
  { brushes: [['ice', -8, -1, -8, 8, 0, 8], ['concrete', -3, 0, -6, -1.4, 2.4, -2], ['concrete', 1.4, 0, 2, 3, 2.4, 6]], exit: [6, 0, 0] },       // 7 ice rink with pillars
  { brushes: [['concrete', -8, 0, -7, -2, 2, -3, '+x'], ['concrete', -2, 0, -7, 2, 2, -3], ['concrete', -2, 2, -3, 2, 4, 3, '+z'], ['concrete', -2, 0, 3, 2, 4, 7]], exit: [0, 4, 5] }, // 8 two ramps
  { brushes: [['concrete', -2, 0, -4, 2, 3, 4], ['concrete', 4, 0, -4, 7, 6, 4]],                                                                  // 9 twin pads
    triggers: [{ kind: 'jumppad', min: [-6, 0, -1], max: [-4, 0.4, 1], launch: [5.2, 14.14, 0] }, { kind: 'jumppad', min: [-0.5, 3, -1], max: [1.5, 3.4, 1], launch: [4.16, 15.49, 0] }], exit: [5.5, 6, 0] },
  { brushes: [['concrete', -5.5, 0, -1.5, 4, 2.4, 1.5], ['concrete', -9, 0, -1.5, -5.5, 2.4, 1.5, '+x'], ['concrete', 4, 0, -1.5, 8, 2.4, 1.5, '-x']], // 10 bridge over a kill zone
    triggers: [{ kind: 'killzone', min: [-5, -2, -9], max: [3.5, 0.2, 9] }], exit: [0, 2.4, 0] },
  { brushes: [['concrete', -6, 0, -9, -5.6, 3, 4], ['concrete', -1, 0, -4, -0.6, 3, 9], ['concrete', 4, 0, -9, 4.4, 3, 4]], exit: [7.5, 0, 6] },      // 11 switchback walls
  { brushes: [['concrete', -3, 0, -4, 1, 2.4, 4], ['concrete', -8, 0, -4, -3, 2.4, 4, '+x'], ['concrete', 1, 0, -4, 5, 5.2, 4]],                    // 12 ramp then ladder
    triggers: [{ kind: 'ladder', min: [0.2, 2.4, -1], max: [1, 5.2, 1] }], exit: [3, 5.2, 0] },
];
// A plan moved to its room: brushes, triggers and exit offset by the room centre.
function placeChamber(plan, cx, cz) {
  const moveBrush = (r) => { const c = r.slice(); c[1] += cx; c[4] += cx; c[3] += cz; c[6] += cz; return c; };
  const moveTrigger = (t) => {
    const c = JSON.parse(JSON.stringify(t));
    c.min[0] += cx; c.max[0] += cx; c.min[2] += cz; c.max[2] += cz;
    if (c.exit) { c.exit[0] += cx; c.exit[2] += cz; }
    return c;
  };
  return { brushes: plan.brushes.map(moveBrush), triggers: (plan.triggers || []).map(moveTrigger), exit: [plan.exit[0] + cx, plan.exit[1], plan.exit[2] + cz] };
}
const chamberRooms = CHAMBER_PLANS.map((plan, index) => placeChamber(plan, CHAMBER_CENTERS[index][0], CHAMBER_CENTERS[index][1]));
const chamberCenter = {
  brushes: [
    ['concrete', -40, -1, -30, 40, 0, 30], ['concrete', -43, -1, -33, 43, 8, -30], ['concrete', -43, -1, 30, 43, 8, 33], ['concrete', -43, -1, -30, -40, 8, 30], ['concrete', 40, -1, -30, 43, 8, 30],
    ...MapKit.wall('concrete', 'z', -20, 1, -30, 30, 0, 8, [[-22, 3, 3], [2, 3, 3], [18, 3, 3]]),    // walls between rooms, 8 m (platforms look over 5); doors of neighbouring walls are staggered
    ...MapKit.wall('concrete', 'z', 0, 1, -30, 30, 0, 8, [[-18, 3, 3], [-2, 3, 3], [22, 3, 3]]),
    ...MapKit.wall('concrete', 'z', 20, 1, -30, 30, 0, 8, [[-22, 3, 3], [2, 3, 3], [18, 3, 3]]),
    ...MapKit.wall('concrete', 'x', -10, 1, -40, 40, 0, 8, [[30, 3, 3]]), ...MapKit.wall('concrete', 'x', 10, 1, -40, 40, 0, 8, [[-30, 3, 3]]),
    ...chamberRooms.flatMap((room) => room.brushes),
  ],
  spawns: [[-1, ['puzzle'], CHAMBER_CENTERS.map(([cx, cz]) => [cx - 7.5, 0, cz - 7, 90])]],
  zones: CHAMBER_NAMES.map((name, index) => ['Chamber ' + name, CHAMBER_CENTERS[index][0] - 10, CHAMBER_CENTERS[index][1] - 10, CHAMBER_CENTERS[index][0] + 10, CHAMBER_CENTERS[index][1] + 10]),
  hints: CHAMBER_CENTERS.map(([cx, cz]) => ['cover', cx - 6, 0, cz + 6]),
  lights: CHAMBER_CENTERS.map(([cx, cz]) => [cx, 4.5, cz, 0xe8f4ff, 16]),
  triggers: chamberRooms.flatMap((room) => room.triggers),
  objectives: chamberRooms.map((room, index) => ({ id: 'exit' + (index + 1), kind: 'extract', x: room.exit[0], y: room.exit[1], z: room.exit[2], radius: 1.2, modes: ['puzzle'] })),
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'chambers', code: 'MP11', name: 'Test Chambers', size: [80, 12, 60], theme: 'glacier', category: 'puzzle', modes: ['puzzle'],
  blurb: 'Twelve small rooms, one traversal element each: ramps, stairs, a ladder, jump pads, teleporters, acid and a kill zone.',
  sky: { top: 0xc8d8e8, horizon: 0xf2f6fa, fog: 0xdce6f0, fogFar: 120, sun: [0.1, 0.9, 0.2] },
}, chamberCenter)));

// MP09 Ring Isle - PLACEHOLDER (placeholder: true) for the royale mode until generator GN5 (step 13.1) replaces it: a flat 300 m island with
// six points of interest, a centre hill and a lattice of low ridges that keeps every sightline under 150 m. Loot spots are the map items.
const ISLE_POIS = [['Quarry', 85, 0], ['Lighthouse', 42, 74], ['Old Mill', -42, 74], ['Harbor Town', -85, 0], ['Radar Hill', -42, -74], ['Ruined Fort', 42, -74]];
const ISLE_LOOT = ['warden', 'wasp', 'tempest', 'vanguard', 'scattergun', 'kestrel', 'ratchet', 'pitcher', 'healthpack', 'lightplate', 'ammobox', 'healthvial'];
const ISLE_RIDGE_SPACING = 30, ISLE_RIDGE_COUNT = 10;
const isleNearAnything = (x, z) => Math.hypot(x, z) < 18 || ISLE_POIS.some(([, px, pz]) => Math.hypot(x - px, z - pz) < 26);
const isleRidges = Array.from({ length: ISLE_RIDGE_COUNT * ISLE_RIDGE_COUNT }, (unused, index) => {
  const i = index % ISLE_RIDGE_COUNT, j = Math.floor(index / ISLE_RIDGE_COUNT);
  const x = -135 + ISLE_RIDGE_SPACING * i, z = -135 + ISLE_RIDGE_SPACING * j;
  if (isleNearAnything(x, z)) return null;
  return (i + j) % 2 === 0 ? ['dirt', x - 7, 0, z - 0.75, x + 7, 4, z + 0.75] : ['dirt', x - 0.75, 0, z - 7, x + 0.75, 4, z + 7];
}).filter((row) => row !== null);
const isleBuildings = ISLE_POIS.flatMap(([, px, pz]) => [
  ['concrete', px - 13, 0, pz - 13, px - 5, 6, pz - 5], ['concrete', px + 5, 0, pz - 13, px + 13, 6, pz - 5],
  ['concrete', px - 13, 0, pz + 5, px - 5, 6, pz + 13], ['concrete', px + 5, 0, pz + 5, px + 13, 6, pz + 13], ['metal', px - 2, 0, pz - 2, px + 2, 11, pz + 2],
]);
const isleLootItems = ISLE_POIS.flatMap(([, px, pz], poi) => Array.from({ length: 8 }, (unused, k) => {
  const angle = (k / 8) * Math.PI * 2 + 0.4, radius = 17;
  return [ISLE_LOOT[(poi * 3 + k) % ISLE_LOOT.length], +(px + Math.cos(angle) * radius).toFixed(1), 0, +(pz + Math.sin(angle) * radius).toFixed(1), ['royale']];
}));
const isleSpawns = Array.from({ length: 18 }, (unused, k) => {
  const angle = (k / 18) * Math.PI * 2 + 0.17;
  return [+(Math.cos(angle) * 138).toFixed(1), 0, +(Math.sin(angle) * 138).toFixed(1), Math.round((((angle * 180) / Math.PI + 270) % 360))];
});
Maps.rows.push(MapKit.make({
  id: 'isle', code: 'MP09', name: 'Ring Isle', size: [300, 40, 300], theme: 'overgrowth', category: 'island', modes: ['royale'], placeholder: true,
  blurb: 'Placeholder island for the Last Ring mode: six points of interest around a central hill.',
  sky: { top: 0x3f7fc8, horizon: 0xcfe4f2, fog: 0xb4cfe0, fogFar: 320, sun: [0.4, 0.8, 0.2] },
  brushes: [
    ['grass', -150, -1, -150, 150, 0, 150],
    ['dirt', -153, -1, -153, 153, 30, -150], ['dirt', -153, -1, 150, 153, 30, 153], ['dirt', -153, -1, -150, -150, 30, 150], ['dirt', 150, -1, -150, 153, 30, 150], // cliffs
    ['dirt', -10, 0, -10, 10, 5, 10], ['dirt', -22, 0, -6, -10, 5, 6, '+x'], ['dirt', 10, 0, -6, 22, 5, 6, '-x'], ['dirt', -6, 0, -22, 6, 5, -10, '+z'], ['dirt', -6, 0, 10, 6, 5, 22, '-z'], // centre hill
    ...isleBuildings, ...isleRidges,
  ],
  spawns: [[-1, ['royale'], isleSpawns]],
  items: isleLootItems,
  zones: [
    ...ISLE_POIS.map(([name, px, pz]) => [name, px - 22, pz - 22, px + 22, pz + 22]), ['Heart Hill', -24, -24, 24, 24],
    ['North West Shore', -150, 50, -50, 150], ['North Shore', -50, 50, 50, 150], ['North East Shore', 50, 50, 150, 150],
    ['West Shore', -150, -50, -50, 50], ['Central Plain', -50, -50, 50, 50], ['East Shore', 50, -50, 150, 50],
    ['South West Shore', -150, -150, -50, -50], ['South Shore', -50, -150, 50, -50], ['South East Shore', 50, -150, 150, -50],
  ],
  lights: [[42, 14, 74, 0xfff2b0, 60], [0, 9, 0, 0xffffff, 40]],
  hints: [['sniper', 0, 5, 0], ['cover', 20, 0, 20], ['cover', -20, 0, -20], ['choke', 60, 0, 0], ['choke', -60, 0, 0], ['flank', 0, 0, 60], ['flank', 0, 0, -60]],
}));
