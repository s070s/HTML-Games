// ==== S16 MAPS: TACTICAL ====
// MP04 Dustline (bomb, elim, ghostops) and MP05 Harbor Nine (tdm, hardpoint, attrition, control).
// Team 0 = attackers / first side, team 1 = defenders / second side. Rows use the compact MapKit lists (see 16a-maps.js).

// MP04 Dustline - three lanes (west, mid, east) between two spawn rooms; bomb sites in the north side rooms; tunnels link the lanes.
const dustWest = {                                                                                   // west half, mirrored east
  brushes: [
    ...MapKit.wall('concrete', 'z', -23, 20, -30, 30, 0, 5, [[-12, 5, 3.5], [14, 5, 3.5]]),          // west block with two tunnels
    ...MapKit.wall('concrete', 'z', -20, 2, -45, -30, 0, 5, [[-37.5, 4, 3.4]]),                      // south room divider
    ...MapKit.wall('concrete', 'z', -20, 2, 30, 45, 0, 5, [[37.5, 4, 3.4]]),                         // north room divider
    ['concrete', -52, 0, -4, -42, 3.4, -2.5], ['concrete', -46, 0, 9, -35, 3.4, 10.5], ['concrete', -40, 0, -22, -34, 1.2, -21.2], // lane walls and cover
    ['concrete', -16.9, 0, 35, -15.9, 3, 40], ['concrete', -16.9, 0, -40, -15.9, 3, -35],           // screens inside the spawn rooms, in line with the doors
    ['metal', -45, 0, -38, -42, 2.2, -35], ['metal', -35, 0, -40, -32, 1.2, -38], ['metal', -28, 0, -34, -25, 2.2, -32],            // alcove crates
    ['metal', -44, 0, 34, -41, 2.2, 37], ['metal', -34, 0, 38, -30, 1.2, 40], ['concrete', -50, 0, 41, -47, 3, 44],                 // site crates
  ],
  objectives: [{ id: 'siteWest', kind: 'bombsite', x: -38, y: 0, z: 36, radius: 6, modes: ['bomb', 'ghostops'] }],
  zones: [
    ['West Alcove', -55, -45, -20, -30, -1, 8], ['West Site', -55, 30, -20, 45, -1, 8], ['West Lane', -55, -30, -33, 30, -1, 8],
    ['West Tunnel South', -33, -14.5, -13, -9.5, -1, 8], ['West Tunnel North', -33, 11.5, -13, 16.5, -1, 8],
  ],
  lights: [[-23, 3.2, -12, 0xffd9a0, 14], [-23, 3.2, 14, 0xffd9a0, 14], [-42, 5, 0, 0xffe6c0, 22], [-38, 5, 36, 0xffe6c0, 20], [-38, 5, -36, 0xffe6c0, 20]],
  hints: [
    ['choke', -23, 0, -12], ['choke', -23, 0, 14], ['sniper', -53, 0, -28], ['cover', -44, 0, -1], ['cover', -40, 0, 6], ['flank', -44, 0, 20],
  ],
};
const dustCenter = {
  brushes: [
    ['sand', -55, -1, -45, 55, 0, 45],                                                               // ground
    ['concrete', -58, -1, -48, 58, 8, -45], ['concrete', -58, -1, 45, 58, 8, 48],                    // perimeter
    ['concrete', -58, -1, -45, -55, 8, 45], ['concrete', 55, -1, -45, 58, 8, 45],
    ['concrete', -9, 0, -3, 9, 4, 3], ['concrete', -4, 0, 11.5, 4, 3.4, 16.5], ['concrete', -4, 0, -16.5, 4, 3.4, -11.5], // mid block and the two mid huts
    ['concrete', 7, 0, 12, 13, 3.4, 13.5], ['concrete', -13, 0, 12, -7, 3.4, 13.5], ['concrete', 7, 0, -13.5, 13, 3.4, -12], ['concrete', -13, 0, -13.5, -7, 3.4, -12], // mid walls
    ['metal', 8, 0, -22, 11, 1.2, -19], ['metal', -11, 0, 19, -8, 1.2, 22],                          // mid crates
    ['metal', 5, 0, -33, 8, 2.2, -31], ['metal', 5, 0, 31, 8, 2.2, 33], ['metal', -12, 0, -33, -9, 1.2, -31], ['metal', -12, 0, 31, -9, 1.2, 33], // spawn room cover
  ],
  spawns: [
    [0, ['bomb', 'elim', 'ghostops'], [[-15, 0, -41, 0], [-7.5, 0, -41, 0], [0, 0, -41, 0], [7.5, 0, -41, 0], [15, 0, -41, 0], [-15, 0, -35, 0], [-7.5, 0, -35, 0],
      [7.5, 0, -35, 0], [15, 0, -35, 0]]],
    [1, ['bomb', 'elim', 'ghostops'], [[-15, 0, 41, 180], [-7.5, 0, 41, 180], [0, 0, 41, 180], [7.5, 0, 41, 180], [15, 0, 41, 180], [-15, 0, 35, 180], [-7.5, 0, 35, 180],
      [7.5, 0, 35, 180], [15, 0, 35, 180]]],
  ],
  zones: [['Attack Spawn', -20, -45, 20, -30, -1, 8], ['Defense Spawn', -20, 30, 20, 45, -1, 8], ['Mid Lane', -13, -30, 13, 30, -1, 8]],
  lights: [[0, 6, -38, 0xfff0d0, 26], [0, 6, 38, 0xfff0d0, 26], [0, 6, 0, 0xffe6c0, 26]],
  hints: [['sniper', 0, 0, 36], ['sniper', 0, 0, -36], ['choke', 0, 0, 8], ['choke', 0, 0, -8], ['cover', 6, 0, -20], ['cover', -6, 0, 20]],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'dustline', code: 'MP04', name: 'Dustline', size: [110, 20, 90], theme: 'ruins', category: 'large', modes: ['bomb', 'elim', 'ghostops'],
  blurb: 'Tactical map: three lanes, two bomb sites in the north side rooms, tunnels between the lanes.',
  props: MapKit.crates([[-55, -45], [53.5, 43.5], [-7, 11.5], [4, -15]]),   // breakable crates (MAP-013): two in corners, two beside mid cover walls
  sky: { top: 0x5b86b8, horizon: 0xf0d9a8, fog: 0xc9b48a, fogFar: 190, sun: [0.5, 0.7, -0.2] },
}, MapKit.join(MapKit.sym(dustWest, 'x'), dustCenter))));

// MP05 Harbor Nine (tdm, hardpoint, attrition, control) - a cargo yard in the middle, a quay on each side, two canals with bridges;
// the canals are swimmable and end in slipways. Team 0 starts at the west end of the yard, team 1 at the east end.
const harborQuarter = {                                                                              // north-west quarter, mirrored three times
  brushes: [
    ['concrete', -45, -4, 0, 0, 0, 10], ['concrete', -45, -4, 10, -36, 0, 22], ['concrete', -45, -4, 22, 0, 0, 45],                   // yard, dock land, quay (down to the canal bed)
    ['water', -30, -4, 10, 0, -3, 22], ['concrete', -36, -3, 10, -30, 0, 22, '-x'],                                                    // canal bed, slipway
    ['wood', -23, -0.5, 10, -17, 0, 22],                                                                                               // bridge
    ['concrete', -26, 0, 33, -6, 6, 42], ['metal', -36, 0, 26, -33, 2.4, 29], ['metal', -14, 0, 24, -11, 2.4, 27], ['concrete', -3, 0, 35, 0, 3, 38], // warehouse and quay cover
    ['metal', -22, 0, 3, -18, 2.6, 5.4], ['metal', -14, 0, 6, -10, 2.6, 8.4], ['metal', -8, 0, 1, -5, 1.2, 3.5],                       // yard containers
    ['concrete', -43, 0, 11, -40, 3, 13], ['metal', -41, 0, 36, -38, 2.4, 39],                                                         // dock and corner cover
  ],
  items: [
    ['lightplate', -41, 0, 42], ['healthpack', -40, 0, 16], ['healthvial', -20, 0, 8], ['armorshard', -30, 0, 28], ['armorshard', -31, 0, 6],
    ['ammobox', -16, 0, 29], ['vanguard', -33, 0, 41], ['scattergun', -26, 0, 7], ['lancet', -8, 0, 25.5], ['ammobox', -25, 0, 9],
  ],
  zones: [
    ['North West Quay', -45, 22, 0, 45, -1, 10], ['North West Dock', -45, 10, -30, 22, -1, 6], ['North West Canal', -30, 10, 0, 22, -6, -1],
    ['North West Bridge', -23, 10, -17, 22, -1, 3], ['North West Canal Bank', -30, 10, -23, 22, -1, 3], ['North West Yard', -30, 0, 0, 10, -1, 8],
  ],
  lights: [[-16, 7, 38, 0xffe8c0, 24], [-38, 6, 38, 0xffe8c0, 22], [-14, 6, 5, 0xffe0b0, 24], [-26, 0.5, 16, 0xcfe6ff, 18], [-8, 0.5, 14, 0xcfe6ff, 16]],
  hints: [['sniper', -4, 0, 40], ['cover', -35, 0, 24], ['cover', -12.5, 0, 22.8], ['choke', -20, 0, 16], ['cover', -20, 0, 7]],
  triggers: [
    { kind: 'water', min: [-36, -3, 10], max: [0, -0.3, 22] },
    { kind: 'ladder', min: [-9.5, -3, 21.2], max: [-8.5, 0, 22] }, { kind: 'ladder', min: [-9.5, -3, 10], max: [-8.5, 0, 10.8] },
  ],
};
const harborWest = {                                                                                 // west base, mirrored east
  brushes: MapKit.wall('concrete', 'z', -30, 1.5, -10, 10, 0, 4, [[-5, 4, 3.2], [5, 4, 3.2]])                // base wall
    .concat(MapKit.wall('concrete', 'z', -16, 1.5, -10, 10, 0, 4, [[-5, 4, 3.2], [5, 4, 3.2]]))              // yard gate wall (breaks the long diagonals)
    .concat([['metal', -40, 0, -1.5, -37, 1.4, 1.5], ['concrete', -34, 0, 2.5, -33, 2.6, 7.5], ['concrete', -34, 0, -7.5, -33, 2.6, -2.5]]), // base cover and door screens
  spawns: [
    [0, ['tdm', 'hardpoint', 'attrition', 'control'], [[-43, 0, -7, 90], [-43, 0, -2.5, 90], [-43, 0, 2.5, 90], [-43, 0, 7, 90], [-38, 0, -7, 90], [-38, 0, -2.5, 90],
      [-38, 0, 2.5, 90], [-38, 0, 7, 90]]],
  ],
  zones: [['West Base', -45, -10, -30, 10, -1, 8]],
  hints: [['choke', -30, 0, 5], ['choke', -30, 0, -5]],
};
const harborCenter = {
  brushes: [
    ['wood', -3, -0.5, 10, 3, 0, 22], ['wood', -3, -0.5, -22, 3, 0, -10],                            // centre bridges
    ['concrete', -3, 0, -5, 3, 2.6, -1.5], ['metal', 8, 0, 3, 11, 2.6, 6], ['metal', -11, 0, -6, -8, 2.6, -3],  // yard cover around the middle
    ['concrete', -48, -1, -48, 48, 12, -45], ['concrete', -48, -1, 45, 48, 12, 48], ['concrete', -48, -1, -45, -45, 12, 45], ['concrete', 45, -1, -45, 48, 12, 45], // perimeter
  ],
  items: [['fury', 0, 0, 0], ['surplus', 0, 0, 33], ['surplus', 0, 0, -33], ['heavyplate', 0, 0, 16], ['megacell', 0, 0, -16]],
  zones: [['North Bridge', -3, 10, 3, 22, -1, 3], ['South Bridge', -3, -22, 3, -10, -1, 3], ['Cargo Heart', -3, -5, 3, 5, -1, 8]],
  hints: [['cover', 0, 0, 6], ['cover', 0, 0, -6], ['sniper', 0, 0, 20]],
  objectives: [
    { id: 'hill1', kind: 'hill', x: 0, y: 0, z: 0, radius: 8, modes: ['hardpoint'] }, { id: 'hill2', kind: 'hill', x: 0, y: 0, z: 28, radius: 7, modes: ['hardpoint'] },
    { id: 'hill3', kind: 'hill', x: 0, y: 0, z: 16, radius: 5, modes: ['hardpoint'] }, { id: 'hill4', kind: 'hill', x: 0, y: 0, z: -28, radius: 7, modes: ['hardpoint'] },
    { id: 'hill5', kind: 'hill', x: 0, y: 0, z: -16, radius: 5, modes: ['hardpoint'] },
    { id: 'uplink', kind: 'point', x: 0, y: 0, z: 0, radius: 6, modes: ['control'] },
  ],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'harbor', code: 'MP05', name: 'Harbor Nine', size: [90, 24, 90], theme: 'canal', category: 'large', modes: ['tdm', 'hardpoint', 'attrition', 'control'],
  blurb: 'Docks with a cargo yard, two swimmable canals and bridges: three lanes between the bases.',
  props: MapKit.crates([[-45, -45], [43.5, 43.5], [22, 2], [-23, -3]]),   // breakable crates (MAP-013): two in corners, two beside the middle cover
  sky: { top: 0x4d7fb5, horizon: 0xe8e0d0, fog: 0xb4c4d0, fogFar: 180, sun: [0.2, 0.75, 0.4] },
}, MapKit.join(MapKit.sym(harborQuarter, 'xz'), MapKit.sym(harborWest, 'x'), harborCenter))));
