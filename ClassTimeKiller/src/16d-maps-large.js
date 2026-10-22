// ==== S16 MAPS: LARGE ====
// MP03 Twin Keeps (ctf, oneflag, dom, tdm) and MP08 Old Rail (payload, rush, conquest).
// Team 0 starts west (Twin Keeps) / south-west (Old Rail), team 1 on the other side. Rows use the compact MapKit lists (see 16a-maps.js).

// MP03 Twin Keeps - mirrored: a keep at each end holds a flag, a field between them, a raised platform in the middle, a lane on each flank.
const keepsHalf = {                                                                                  // west half, mirrored east
  brushes: [
    ...MapKit.wall('concrete', 'z', -40, 2, -14, 14, 0, 6, [[0, 5, 3.2]]),                           // keep east wall with the main gate
    ...MapKit.wall('concrete', 'x', 14, 2, -56, -40, 0, 6, [[-47, 5, 3.2]]),                         // keep north wall with a side gate
    ...MapKit.wall('concrete', 'x', -14, 2, -56, -40, 0, 6, [[-47, 5, 3.2]]),                        // keep south wall with a side gate
    ['concrete', -54, 0, -2, -50, 0.4, 2], ['concrete', -50, 0, 6, -48, 2.6, 8], ['concrete', -50, 0, -8, -48, 2.6, -6], // flag stand, rear pillars
    ['concrete', -46, 0, -4, -45, 3, 4],                                                             // screen behind the gate (no line of sight through the keep)
    ['concrete', -60, 0, -16, -56, 6, 16],                                                           // keep rear wall
    ['concrete', -18, 0, -4, -10, 3, 4, '+x'],                                                       // ramp to the middle platform
    ['concrete', -30, 0, -3, -27, 2.4, 0], ['concrete', -24, 0, 2, -21, 1.2, 5],                     // field cover
  ],
  spawns: [
    [0, ['ctf', 'oneflag', 'dom', 'tdm'], [[-54, 0, 10, 90], [-49, 0, 10, 90], [-44, 0, 10, 90], [-54, 0, -10, 90], [-49, 0, -10, 90], [-44, 0, -10, 90], [-45, 0, 5, 90], [-45, 0, -5, 90]]],
  ],
  objectives: [
    { id: 'flagWest', kind: 'flag', team: 0, x: -52, y: 0.4, z: 0, radius: 2, modes: ['ctf'] },
    { id: 'baseWest', kind: 'flagBase', team: 0, x: -52, y: 0.4, z: 0, radius: 3, modes: ['ctf', 'oneflag'] },
    { id: 'pointWest', kind: 'point', x: -32, y: 0, z: 0, radius: 6, modes: ['dom'] },
  ],
  zones: [['West Keep', -56, -14, -40, 14, -1, 8], ['West Gate', -42, -4, -38, 4, -1, 8], ['West Ramp', -18, -4, -10, 4, -1, 5]],
  lights: [[-40, 3, 0, 0xffe2b0, 10], [-52, 5, 0, 0xffe2b0, 18], [-48, 5, 10, 0xffe2b0, 14], [-48, 5, -10, 0xffe2b0, 14], [-30, 6, 0, 0xffe8c8, 22]],
  hints: [['choke', -40, 0, 0], ['choke', -47, 0, 14], ['choke', -47, 0, -14], ['cover', -28.5, 0, 1.5], ['cover', -52, 0, 4]],
};
const keepsQuarter = {                                                                               // north-west quarter, mirrored three times
  brushes: [
    ['concrete', -30, 0, 16, -27, 3, 23.5], ['concrete', -14, 0, 22.5, -11, 3, 30], ['metal', -44, 0, 18, -41, 1.2, 20], // flank lane ruin walls (staggered) and cover
    ['metal', -36, 0, 9, -33, 1.2, 11], ['concrete', -20, 0, 12, -18, 3, 16],
  ],
  items: [
    ['lightplate', -35, 0, 20], ['healthpack', -34, 0, 6], ['armorshard', -46, 0, 12.5], ['ammobox', -23.5, 0, 18.5], ['ramjet', -20, 0, 24], ['scattergun', -37, 0, 13],
    ['healthvial', -24, 0, 8], ['stormlash', -8, 0, 12],
  ],
  zones: [['North West Lane', -60, 14, 0, 30, -1, 8], ['North West Field', -40, 0, -10, 16, -1, 8]],
  lights: [[-36, 6, 22, 0xffe8c8, 22], [-12, 6, 22, 0xffe8c8, 22]],
  hints: [['sniper', -44, 0, 22], ['cover', -24.5, 0, 21], ['flank', -16, 0, 24]],
};
const keepsCenter = {
  brushes: [
    ['concrete', -60, -1, -30, 60, 0, 30],                                                           // ground
    ['concrete', -63, -1, -33, 63, 14, -30], ['concrete', -63, -1, 30, 63, 14, 33],                  // perimeter
    ['concrete', -63, -1, -30, -60, 14, 30], ['concrete', 60, -1, -30, 63, 14, 30],
    ['concrete', -10, 0, -10, 10, 3, 10], ['concrete', -1.5, 3, -1.5, 1.5, 3.4, 1.5],                // middle platform and its pedestal
  ],
  items: [['fury', 0, 3, 6], ['surplus', 0, 0, 26], ['surplus', 0, 0, -26], ['heavyplate', 0, 3, -6], ['megacell', 0, 0, 13]],
  objectives: [
    { id: 'flagMid', kind: 'flag', team: -1, x: 0, y: 3.4, z: 0, radius: 2, modes: ['oneflag'] },
    { id: 'pointMid', kind: 'point', x: 0, y: 3.4, z: 0, radius: 6, modes: ['dom'] },
  ],
  zones: [
    ['Middle Platform North', -10, 0, 10, 10, 1, 8], ['Middle Platform South', -10, -10, 10, 0, 1, 8],
    ['Middle North', -10, 10, 10, 20, -1, 8], ['Middle South', -10, -20, 10, -10, -1, 8],
  ],
  hints: [['sniper', 0, 3, 8], ['sniper', 0, 3, -8], ['choke', 0, 0, 12]],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'twinkeeps', code: 'MP03', name: 'Twin Keeps', size: [120, 24, 60], theme: 'overgrowth', category: 'large', modes: ['ctf', 'oneflag', 'dom', 'tdm'],
  blurb: 'Mirrored fortress map: a flag keep at each end, a raised middle platform and a lane along each flank.',
  sky: { top: 0x4f86c0, horizon: 0xd8e6c8, fog: 0x9db890, fogFar: 200, sun: [0.3, 0.8, 0.3] },
}, MapKit.join(MapKit.sym(keepsHalf, 'x'), MapKit.sym(keepsQuarter, 'xz'), keepsCenter))));

// MP08 Old Rail (payload, rush, conquest) - a 160 m railway: the rail corridor in the middle, a street on each side behind rows of
// buildings, cross streets (plazas) every 36 m. Team 0 starts at the west end and attacks east; team 1 defends from the east end.
const railHalf = {                                                                                   // west half, mirrored east
  brushes: [
    ...MapKit.wall('concrete', 'x', 10, 8, -68, 0, 0, 6, [[-54, 8, 6], [-18, 8, 6]]),                // north building row (the doors are full-height gaps = cross streets)
    ...MapKit.wall('concrete', 'x', -10, 8, -68, 0, 0, 6, [[-54, 8, 6], [-18, 8, 6]]),               // south building row
    ...MapKit.wall('concrete', 'z', -70, 2, -20, 20, 0, 6, [[0, 8, 3.4], [17, 4, 3.4], [-17, 4, 3.4]]), // base wall with three doors
    ['concrete', -40, 0, -6, -34, 3, 1], ['concrete', -30, 0, -1, -24, 3, 6],                        // rail corridor signal boxes (stagger = no straight line)
    ['concrete', -44, 0, 14, -40.5, 2.6, 17.2], ['concrete', -36, 0, 16.8, -32.5, 2.6, 20],         // north street barricades (staggered, 4.5 m apart)
    ['concrete', -44, 0, -17.2, -40.5, 2.6, -14], ['concrete', -36, 0, -20, -32.5, 2.6, -16.8],      // south street barricades
    ['metal', -56, 0, 1.5, -52, 1.2, 4], ['metal', -20, 0, -5, -16, 1.2, -2.5], ['metal', -56, 0, 12, -52, 1.2, 14.5], ['metal', -20, 0, -14.5, -16, 1.2, -12], // plaza cover
    ['metal', -62, 0, 16.5, -60, 2.4, 17.5], ['metal', -62, 0, -17.5, -60, 2.4, -16.5],                                                              // street cover
  ],
  spawns: [
    [0, ['payload', 'rush', 'conquest'], [[-77, 0, -14, 90], [-77, 0, -7, 90], [-77, 0, 0, 90], [-77, 0, 7, 90], [-77, 0, 14, 90], [-74, 0, -10.5, 90],
      [-74, 0, -3.5, 90], [-74, 0, 3.5, 90], [-74, 0, 10.5, 90]]],
  ],
  zones: [
    ['West Base', -80, -20, -70, 20, -1, 8], ['West Plaza', -58, -20, -50, 20, -1, 8], ['Mid West Plaza', -22, -20, -14, 20, -1, 8],
    ['West Rail', -70, -6, -58, 6, -1, 8], ['West Rail Cut', -50, -6, -22, 6, -1, 8], ['North West Street', -70, 14, -22, 20, -1, 8],
    ['South West Street', -70, -20, -22, -14, -1, 8], ['Inner West Rail', -14, -6, 0, 6, -1, 8],
    ['Inner North West Street', -14, 14, 0, 20, -1, 8], ['Inner South West Street', -14, -20, 0, -14, -1, 8],
  ],
  lights: [[-76, 6, 0, 0xffe6c0, 24], [-76, 6, 16, 0xffe6c0, 18], [-76, 6, -16, 0xffe6c0, 18], [-54, 7, 0, 0xffe6c0, 24], [-18, 7, 0, 0xffe6c0, 24]],
  hints: [
    ['choke', -70, 0, 0], ['choke', -54, 0, 8], ['choke', -18, 0, 8], ['sniper', -76, 0, 12], ['cover', -54, 0, 5.5], ['cover', -18, 0, -6], ['flank', -50, 0, 17], ['flank', -50, 0, -17],
  ],
};
const railCenter = {
  brushes: [
    ['concrete', -80, -1, -20, 80, 0, 20],                                                           // ground
    ['concrete', -83, -1, -23, 83, 14, -20], ['concrete', -83, -1, 20, 83, 14, 23],                  // perimeter
    ['concrete', -83, -1, -20, -80, 14, 20], ['concrete', 80, -1, -20, 83, 14, 20],
    ['metal', -80, 0, -1, 80, 0.15, -0.7], ['metal', -80, 0, 0.7, 80, 0.15, 1],                     // the two rails (walkable bumps)
  ],
  zones: [['Center Rail', -10, -6, 10, 6, -1, 8], ['North Center Street', -10, 14, 10, 20, -1, 8], ['South Center Street', -10, -20, 10, -14, -1, 8]],
  hints: [['choke', 0, 0, -4]],
  objectives: [
    { id: 'cart', kind: 'payloadPath', team: 0, x: -66, y: 0, z: 0, radius: 3, modes: ['payload'], checkpoints: [6, 10, 15],
      path: [[-66, 0, 0], [-56, 0, 0], [-44, 0, 3.5], [-37, 0, 3.5], [-32, 0, 0], [-27, 0, -3.5], [-18, 0, 0], [-4, 0, 0], [8, 0, 0], [18, 0, 0], [27, 0, -3.5],
        [32, 0, 0], [37, 0, 3.5], [44, 0, 3.5], [54, 0, 0], [66, 0, 0]] },
    { id: 'rush1a', kind: 'bombsite', team: 1, x: -48, y: 0, z: 17, radius: 4, stage: 1, modes: ['rush'] },
      { id: 'rush1b', kind: 'bombsite', team: 1, x: -48, y: 0, z: -17, radius: 4, stage: 1, modes: ['rush'] },
    { id: 'rush2a', kind: 'bombsite', team: 1, x: 0, y: 0, z: 17, radius: 4, stage: 2, modes: ['rush'] },
      { id: 'rush2b', kind: 'bombsite', team: 1, x: 0, y: 0, z: -17, radius: 4, stage: 2, modes: ['rush'] },
    { id: 'rush3a', kind: 'bombsite', team: 1, x: 56, y: 0, z: 17, radius: 4, stage: 3, modes: ['rush'] },
      { id: 'rush3b', kind: 'bombsite', team: 1, x: 56, y: 0, z: -17, radius: 4, stage: 3, modes: ['rush'] },
    { id: 'flag1', kind: 'point', x: -54, y: 0, z: -2, radius: 6, modes: ['conquest'] }, { id: 'flag2', kind: 'point', x: -18, y: 0, z: 2, radius: 6, modes: ['conquest'] },
    { id: 'flag3', kind: 'point', x: 0, y: 0, z: 0, radius: 6, modes: ['conquest'] }, { id: 'flag4', kind: 'point', x: 18, y: 0, z: 2, radius: 6, modes: ['conquest'] },
    { id: 'flag5', kind: 'point', x: 54, y: 0, z: -2, radius: 6, modes: ['conquest'] },
  ],
};
Maps.rows.push(MapKit.make(Object.assign({
  id: 'convoyline', code: 'MP08', name: 'Old Rail', size: [160, 24, 40], theme: 'ruins', category: 'large', modes: ['payload', 'rush', 'conquest'],
  blurb: 'A long railway: push the cart east along the rails, or flank through the streets behind the buildings.',
  sky: { top: 0x587fa8, horizon: 0xe2d2b0, fog: 0xb0a488, fogFar: 230, sun: [-0.4, 0.6, 0.3] },
}, MapKit.join(MapKit.sym(railHalf, 'x'), railCenter))));
