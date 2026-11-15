// ---- Maps ------------------------------------------------------------------------------
// Tile characters. solid: blocks walking. counter: solid, but you can talk across it.
const TILE_DEFS = {
  '.': { solid: false }, ',': { solid: false }, 's': { solid: false }, 'g': { solid: false, grass: true },
  '#': { solid: true }, 'W': { solid: true }, '1': { solid: true }, '2': { solid: true }, '3': { solid: true },
  '4': { solid: true }, '5': { solid: true }, 'D': { solid: false }, 'd': { solid: true }, '~': { solid: true },
  'T': { solid: true }, 'S': { solid: true }, 'Z': { solid: true }, 'F': { solid: true }, 'K': { solid: true },
  'f': { solid: false }, 'w': { solid: true }, 'c': { solid: true, counter: true }, 'h': { solid: true },
  't': { solid: true }, 'r': { solid: false }, 'm': { solid: false },
  // Harbour decor on water (MZ-WORLD-02a): a moored ferry 'Q', a quay crane 'X', a yacht 'y'.
  'Q': { solid: true }, 'X': { solid: true }, 'y': { solid: true },
  // Open-air theatre tier 'e' (stone steps with a seat band, walkable) and the metro entrance sign 'j' (a sign, solid).
  'e': { solid: false }, 'j': { solid: true },
  // The ΚΤΕΛ bus stop sign 'U' (the fast-travel stop of MZ-MAP-02; for now it is a sign).
  'U': { solid: true },
  // South coast decor (MZ-WORLD-02b): sand 'a', sunbed with a parasol 'b', lifeguard tower 'k', tram rails 'l' (walkable), palm 'n', runway 'o' (walkable),
  // hangar 'p', crane of the unfinished project 'q', golf fairway 'u' (walkable), nightclub front 'G'.
  'a': { solid: false }, 'b': { solid: true }, 'k': { solid: true }, 'l': { solid: false }, 'n': { solid: true },
  'o': { solid: false }, 'p': { solid: true }, 'q': { solid: true }, 'u': { solid: false }, 'G': { solid: true },
  // East decor (MZ-WORLD-02c): rock 'R', vineyard rows 'v', pine 'I', monastery wall 'J', highway bridge deck 'O', road under the bridge 'z' (walkable),
  // fountain '7', terminal glass front 'x', terminal sliding door '8' (walkable), control tower '9', parked plane '0'.
  'R': { solid: true }, 'v': { solid: true }, 'I': { solid: true }, 'J': { solid: true }, 'O': { solid: true }, 'z': { solid: false },
  '7': { solid: true }, 'x': { solid: true }, '8': { solid: false }, '9': { solid: true }, '0': { solid: true },
  // North decor (MZ-WORLD-02d): marble block '%', white marble steps '&' (walkable), hedge '=', shop window '>', roundabout island '?', arena roof '^',
  // scaffolding '_', stage boards ';' (walkable), speaker stack ':', tennis court '!' (walkable).
  '%': { solid: true }, '&': { solid: false }, '=': { solid: true }, '>': { solid: true }, '?': { solid: true },
  '^': { solid: true }, '_': { solid: true }, ';': { solid: false }, ':': { solid: true }, '!': { solid: false },
  // West decor (MZ-WORLD-02e): toll booth '*', apartment block with laundry '+', river channel '-', market stall '/', football pitch '<' (walkable), goal '|',
  // crash barrier '@', asphalt '`' and asphalt with a dashed line ')' (both walkable), parked car '('.
  '*': { solid: true }, '+': { solid: true }, '-': { solid: true }, '/': { solid: true }, '<': { solid: false }, '|': { solid: true },
  '@': { solid: true }, '`': { solid: false }, ')': { solid: false }, '(': { solid: true },
  // Centre decor (MZ-WORLD-02f): ancient paving '"' (walkable), column or column stump '$', closed dig behind a hoarding '[', neoclassical building front ']',
  // police van '{', clock tower '}'.
  '"': { solid: false }, '$': { solid: true }, '[': { solid: true }, ']': { solid: true }, '{': { solid: true }, '}': { solid: true },
  // Parliament (MZ-WORLD-02g, Greek capitals as tile characters: the ASCII punctuation is used up): marble floor 'Δ' (walkable), bench 'Θ' (θρανίο), speaker's podium 'Φ', formal double door 'Ξ' (walkable).
  'Δ': { solid: false }, 'Θ': { solid: true }, 'Φ': { solid: true }, 'Ξ': { solid: false },
  // Hospital outside: teal roof '6', roof with the blue Η sign 'H', mint walls 'M', window 'N', green cross 'P', sliding glass door 'E'.
  '6': { solid: true }, 'H': { solid: true }, 'M': { solid: true }, 'N': { solid: true }, 'P': { solid: true }, 'E': { solid: false },
  // Hospital inside: wall 'i', floor 'L', corridor cot (ράντζο) 'B', vending machine 'V', TV 'Y', archive terminal 'A', reception counter 'C'.
  'i': { solid: true }, 'L': { solid: false }, 'B': { solid: true }, 'V': { solid: true }, 'Y': { solid: true }, 'A': { solid: true },
  'C': { solid: true, counter: true },
};
function paintMap(width, height, fill, operations) {
  const grid = [];
  for (let y = 0; y < height; y++) grid.push(new Array(width).fill(fill));
  const put = function (char, x, y) { if (y >= 0 && y < height && x >= 0 && x < width) grid[y][x] = char; };
  for (const op of operations) {
    if (op[0] === 'rect') for (let y = op[3]; y < op[3] + op[5]; y++) for (let x = op[2]; x < op[2] + op[4]; x++) put(op[1], x, y);
    if (op[0] === 'px') put(op[1], op[2], op[3]);
    if (op[0] === 'path') {
      const points = op[2];
      for (let i = 0; i + 1 < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) put(op[1], x, y);
      }
    }
  }
  return grid.map(function (row) { return row.join(''); });
}
const ROUTE_ROWS = paintMap(32, 18, 'T', [
  ['rect', '~', 1, 1, 22, 4],
  ['rect', 's', 1, 5, 30, 12],
  ['rect', '1', 24, 1, 4, 2],
  ['px', 'W', 24, 3], ['px', '#', 25, 3], ['px', '#', 26, 3], ['px', 'W', 27, 3],
  ['px', '#', 24, 4], ['px', 'D', 25, 4], ['px', '#', 26, 4], ['px', '#', 27, 4],
  ['rect', 'g', 2, 10, 5, 3], ['rect', 'g', 2, 6, 5, 2],
  ['rect', 'g', 8, 10, 7, 3], ['rect', 'g', 8, 14, 7, 3], ['rect', 'g', 9, 5, 6, 3],
  ['rect', 'g', 16, 9, 6, 4], ['rect', 'g', 16, 5, 6, 3], ['rect', 'g', 24, 8, 6, 5],
  ['path', '.', [[0, 9], [7, 9], [7, 13], [15, 13], [15, 8], [22, 8], [22, 6], [25, 6], [25, 5]]],
  ['px', 'T', 4, 8], ['px', 'T', 4, 14], ['px', 'T', 12, 8], ['px', 'T', 19, 14], ['px', 'T', 27, 14], ['px', 'T', 28, 6], ['px', 'T', 30, 16],
  ['px', 'T', 6, 15], ['px', 'T', 17, 15], ['px', 'T', 23, 11], ['px', 'T', 21, 15],
  ['px', 'Z', 2, 8], ['px', 'Z', 24, 7],
  // MZ-WORLD-02a: the east edge (trees before) gets a road to route 2 with a sign, shut until the badge.
  ['px', '.', 31, 10], ['px', 'Z', 31, 9],
]);

// Route 2, the quay road (40 x 14): the sea on top with ferries and a crane, a road with two fenced grounds (the twin stadium), grass patches.
const ROUTE2_ROWS = paintMap(40, 14, 'T', [
  ['rect', '~', 1, 1, 38, 2], ['px', 'Q', 6, 1], ['px', 'Q', 24, 2], ['px', 'X', 14, 1],
  ['rect', 's', 1, 3, 38, 10], ['rect', 'K', 4, 3, 2, 1], ['rect', 'K', 31, 3, 2, 1],
  ['rect', 'F', 14, 3, 8, 4], ['rect', 's', 15, 4, 6, 2], ['rect', 's', 17, 6, 2, 1],
  ['rect', 'F', 24, 9, 8, 4], ['rect', 's', 25, 10, 6, 2], ['rect', 's', 27, 9, 2, 1],
  ['rect', 'g', 2, 4, 9, 3], ['rect', 'g', 2, 10, 9, 3], ['rect', 'g', 11, 10, 11, 3], ['rect', 'g', 24, 3, 7, 3],
  ['rect', 'g', 33, 4, 6, 3], ['rect', 'g', 33, 10, 6, 3],
  ['path', '.', [[0, 8], [12, 8], [12, 7], [23, 7], [23, 8], [39, 8]]],
  ['px', 'T', 11, 4], ['px', 'T', 22, 4], ['px', 'T', 10, 9], ['px', 'T', 22, 11], ['px', 'T', 32, 6], ['px', 'T', 36, 12],
  ['px', 'Z', 2, 7], ['px', 'Z', 37, 7],
]);
// Καστέλλα (26 x 18): terraces down a hill, the theatre on top, the hospital and the kiosk in the middle, a marina strip with yachts below.
const KASTELLA_ROWS = paintMap(26, 18, 'T', [
  ['rect', ',', 1, 1, 24, 14], ['rect', '~', 1, 15, 24, 2],
  ['px', 'y', 4, 15], ['px', 'y', 10, 16], ['px', 'y', 17, 15], ['px', 'y', 22, 16],
  ['rect', '3', 9, 2, 7, 2], ['rect', '#', 9, 4, 7, 2], ['px', 'W', 9, 4], ['px', 'W', 15, 4], ['px', 'D', 12, 5],
  ['rect', '1', 2, 2, 4, 2], ['rect', '#', 2, 4, 4, 2], ['px', 'W', 2, 4], ['px', 'W', 5, 4], ['px', 'd', 3, 5],
  ['rect', '2', 19, 2, 4, 2], ['rect', '#', 19, 4, 4, 2], ['px', 'W', 19, 4], ['px', 'W', 22, 4], ['px', 'd', 20, 5],
  ['rect', 'F', 1, 7, 24, 1], ['rect', ',', 6, 7, 2, 1],
  ['rect', 'F', 1, 13, 24, 1], ['rect', ',', 21, 13, 2, 1],
  ['rect', '1', 2, 8, 4, 2], ['rect', '#', 2, 10, 4, 2], ['px', 'W', 2, 10], ['px', 'W', 5, 10], ['px', 'd', 3, 11],
  ['rect', '6', 9, 8, 5, 2], ['px', 'H', 11, 9],
  ['px', 'N', 9, 10], ['px', 'M', 10, 10], ['px', 'P', 11, 10], ['px', 'M', 12, 10], ['px', 'N', 13, 10], ['rect', 'M', 9, 11, 5, 1], ['px', 'E', 11, 11],
  ['rect', '4', 16, 8, 4, 2], ['rect', '#', 16, 10, 4, 2], ['px', 'W', 16, 10], ['px', 'W', 19, 10], ['px', 'D', 17, 11],
  ['rect', '2', 21, 8, 4, 2], ['rect', '#', 21, 10, 4, 2], ['px', 'W', 21, 10], ['px', 'W', 24, 10], ['px', 'd', 22, 11],
  ['px', 'S', 11, 6], ['px', 'S', 8, 11], ['px', 'S', 15, 11], ['px', 'U', 6, 13], ['px', 'S', 24, 13],
  ['px', '.', 0, 12],
  // MZ-WORLD-02b: the east end of the promenade (the roadworks sign before) is the road to Νότια: (24, 14) walks on, (25, 14) is the gate tile.
  ['px', '.', 25, 14],
]);

// The hospital front (5 x 4 tiles, door 'E' at the foot of the middle), the kiosk front (4 x 4, door at x + 1) and a plain house front,
// painted at a position so the Νότια towns do not repeat the rectangles by hand.
function hospitalFront(x, y) {
  return [['rect', '6', x, y, 5, 2], ['px', 'H', x + 2, y + 1],
    ['px', 'N', x, y + 2], ['px', 'M', x + 1, y + 2], ['px', 'P', x + 2, y + 2], ['px', 'M', x + 3, y + 2], ['px', 'N', x + 4, y + 2],
    ['rect', 'M', x, y + 3, 5, 1], ['px', 'E', x + 2, y + 3]];
}
function kioskFront(x, y) {
  return [['rect', '4', x, y, 4, 2], ['rect', '#', x, y + 2, 4, 2], ['px', 'W', x, y + 2], ['px', 'W', x + 3, y + 2], ['px', 'D', x + 1, y + 3]];
}
function houseFront(x, y, width, roof, doorX, doorChar) {
  return [['rect', roof, x, y, width, 2], ['rect', '#', x, y + 2, width, 2], ['px', 'W', x, y + 2], ['px', 'W', x + width - 1, y + 2], ['px', doorChar, doorX, y + 3]];
}

// Route 3, Λεωφόρος Ποσειδώνος (40 x 14): a hillside with grass, the tram rails, the avenue, a beach with sunbeds, the sea along the bottom.
const ROUTE3_ROWS = paintMap(40, 14, 'T', [
  ['rect', 's', 1, 1, 38, 5], ['rect', 'g', 2, 2, 9, 3], ['rect', 'g', 15, 2, 10, 3], ['rect', 'g', 29, 2, 9, 3],
  ['rect', 'l', 1, 6, 38, 1], ['rect', '.', 0, 7, 40, 2], ['rect', 'a', 1, 9, 38, 2], ['rect', '~', 1, 11, 38, 2],
  ['rect', 'g', 3, 9, 6, 2], ['rect', 'g', 29, 9, 8, 2],
  ['px', 'b', 10, 10], ['px', 'b', 15, 9], ['px', 'b', 17, 10], ['px', 'b', 21, 9], ['px', 'k', 24, 10],
  ['px', 'n', 2, 10], ['px', 'n', 13, 10], ['px', 'n', 27, 9], ['px', 'n', 38, 10],
  ['px', 'T', 12, 3], ['px', 'T', 13, 2], ['px', 'T', 27, 4], ['px', 'T', 28, 3], ['px', 'T', 38, 5],
  ['px', 'Z', 2, 6], ['px', 'Z', 37, 6],
]);
// Παλαιό Φάληρο (30 x 16): the buildings on top, the tram rails and the street, a beach and the marina below.
const FALIRO_ROWS = paintMap(30, 16, 'T', [
  ['rect', ',', 1, 1, 28, 10], ['rect', 'a', 1, 11, 28, 2], ['rect', '~', 1, 13, 28, 2],
  ['rect', 'l', 1, 8, 28, 1], ['rect', '.', 0, 9, 30, 1],
].concat(hospitalFront(2, 2), kioskFront(9, 2), houseFront(15, 2, 5, '5', 17, 'D'), houseFront(25, 2, 4, '2', 26, 'd'), [
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 20, 5], ['px', 'S', 24, 5], ['px', 'U', 22, 7], ['px', 'S', 12, 8],
  ['px', 'T', 7, 2], ['px', 'T', 13, 2], ['px', 'T', 21, 2], ['px', 'T', 22, 3],
  ['px', 'b', 5, 11], ['px', 'b', 9, 12], ['px', 'b', 14, 11], ['px', 'b', 20, 12],
  ['px', 'n', 2, 11], ['px', 'n', 12, 12], ['px', 'n', 17, 11], ['px', 'n', 25, 12], ['px', 'n', 27, 11],
  ['px', 'y', 4, 14], ['px', 'y', 10, 13], ['px', 'y', 16, 14], ['px', 'y', 22, 13], ['px', 'y', 27, 14],
]));
// Route 4, Ελληνικό (36 x 20): the old airfield: hangars, two straight runways, the cranes of the unfinished project, grass, a golf patch, the beach below.
const ROUTE4_ROWS = paintMap(36, 20, 'T', [
  ['rect', 's', 1, 1, 34, 15], ['rect', 'p', 3, 1, 7, 2], ['rect', 'p', 24, 1, 9, 2],
  ['rect', 'o', 1, 4, 34, 2], ['rect', 'o', 1, 12, 34, 2],
  ['rect', 'g', 2, 6, 8, 2], ['rect', 'g', 13, 6, 7, 2], ['rect', 'g', 23, 6, 6, 2],
  ['rect', 'g', 2, 9, 6, 3], ['rect', 'g', 12, 9, 8, 3], ['rect', 'u', 27, 9, 7, 3],
  ['rect', '.', 0, 8, 36, 1],
  ['px', 'q', 6, 14], ['px', 'q', 13, 15], ['px', 'q', 22, 14], ['px', 'q', 30, 15],
  ['rect', 'a', 1, 16, 34, 1], ['rect', '~', 1, 17, 34, 2],
  ['px', 'n', 4, 16], ['px', 'n', 12, 16], ['px', 'n', 20, 16], ['px', 'n', 28, 16],
  ['px', 'T', 11, 3], ['px', 'T', 21, 3], ['px', 'T', 11, 10], ['px', 'T', 25, 10],
  ['px', 'Z', 2, 7], ['px', 'Z', 33, 7],
]);
// Γλυφάδα (28 x 18): the buildings on top (hospital, kiosk, the big café, a nightclub), the street, a golf lawn and houses, the marina with a pier below.
const GLYFADA_ROWS = paintMap(28, 18, 'T', [
  ['rect', ',', 1, 1, 26, 13], ['rect', '~', 1, 14, 26, 3], ['rect', ',', 12, 14, 2, 2],
  ['rect', '.', 0, 7, 28, 1], // MZ-WORLD-02c: the street runs on to the east edge (27, 7), the gate to Ανατολικά
].concat(hospitalFront(2, 2), kioskFront(9, 2), houseFront(14, 2, 8, '4', 17, 'D'), [
  ['rect', 'G', 23, 2, 4, 4], ['px', 'd', 24, 5],
], houseFront(13, 9, 4, '3', 14, 'd'), houseFront(19, 9, 4, '1', 20, 'd'), [
  ['rect', 'u', 2, 9, 8, 4],
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 22, 5], ['px', 'S', 23, 6], ['px', 'S', 27, 6], ['px', 'S', 12, 12], ['px', 'S', 23, 12], ['px', 'U', 4, 13],
  ['px', 'T', 7, 2], ['px', 'T', 1, 8], ['px', 'T', 11, 10], ['px', 'T', 24, 10], ['px', 'T', 25, 12],
  ['px', 'y', 3, 15], ['px', 'y', 6, 14], ['px', 'y', 9, 16], ['px', 'y', 16, 15], ['px', 'y', 19, 14], ['px', 'y', 22, 16], ['px', 'y', 24, 15],
]));

// A shop front of the boulevard (MZ-WORLD-02d): a roof row, a row of shop windows with a grey door in the middle.
function shopFront(x, y, width, roof) {
  return [['rect', roof, x, y, width, 1], ['rect', '>', x, y + 1, width, 1], ['px', 'd', x + Math.floor(width / 2), y + 1]];
}

// An apartment block (MZ-WORLD-02e): a roof row and rows of balconies with laundry; there is no door (the people live elsewhere in the satire).
function blockFront(x, y, width, height, roof) {
  return [['rect', roof, x, y, width, 1], ['rect', '+', x, y + 1, width, height - 1]];
}

// Route 5, Υμηττός (36 x 16): the Hymettus pass. A road that switches back three times up the ridge (bottom, middle, top), grass between the legs, rocks and pines, a monastery wall at the lower turn.
const ROUTE5_ROWS = paintMap(36, 16, 'I', [
  ['rect', 's', 1, 1, 34, 14], ['rect', 'R', 1, 1, 34, 2],
  ['rect', '.', 0, 13, 30, 2], ['rect', '.', 28, 8, 2, 6], ['rect', '.', 6, 8, 24, 2], ['rect', '.', 6, 3, 2, 7], ['rect', '.', 6, 3, 30, 2],
  ['rect', 'g', 2, 3, 4, 6], ['rect', 'g', 9, 5, 18, 3], ['rect', 'g', 1, 10, 26, 3], ['rect', 'g', 31, 5, 4, 3],
  ['rect', 'J', 31, 8, 4, 6], ['rect', '1', 32, 9, 2, 2],
  ['px', 'R', 22, 6], ['px', 'R', 12, 5], ['px', 'R', 25, 11], ['px', 'R', 8, 11], ['px', 'R', 4, 5], ['px', 'R', 33, 6],
  ['px', 'I', 4, 11], ['px', 'I', 15, 12], ['px', 'I', 20, 11], ['px', 'I', 10, 7], ['px', 'I', 24, 5], ['px', 'I', 3, 7], ['px', 'I', 12, 2], ['px', 'I', 24, 1],
  ['px', 'Z', 2, 12], ['px', 'Z', 30, 12], ['px', 'Z', 33, 5],
]);
// Κορωπί (26 x 16): a plain town. The buildings on top (hospital, kiosk, café, a house), a square with a fountain and plane trees, the street, vineyard rows below.
const KOROPI_ROWS = paintMap(26, 16, 'T', [
  ['rect', ',', 1, 1, 24, 8], ['rect', '.', 0, 9, 26, 1], ['rect', 's', 1, 10, 24, 5],
].concat(hospitalFront(2, 2), kioskFront(9, 2), houseFront(15, 2, 5, '5', 17, 'D'), houseFront(21, 2, 4, '2', 22, 'd'), [
  ['rect', 'v', 2, 11, 8, 3], ['rect', 'v', 15, 11, 9, 3],
  ['px', '7', 12, 7], ['px', 'T', 9, 7], ['px', 'T', 15, 7],
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 20, 5], ['px', 'U', 22, 7], ['px', 'S', 6, 8],
  ['px', 'T', 24, 7], ['px', 'T', 1, 7],
]));
// Route 6, Μεσόγεια (40 x 16): the plain. A straight road, vineyard rows and grass on both sides, the highway bridge over the road in the middle.
const ROUTE6_ROWS = paintMap(40, 16, 'T', [
  ['rect', 's', 1, 1, 38, 14], ['rect', '.', 0, 7, 40, 2],
  ['rect', 'g', 2, 5, 14, 2], ['rect', 'g', 22, 5, 16, 2], ['rect', 'g', 2, 9, 14, 2], ['rect', 'g', 22, 9, 16, 2],
  ['rect', 'v', 3, 2, 6, 3], ['rect', 'v', 11, 2, 5, 3], ['rect', 'v', 23, 2, 6, 3], ['rect', 'v', 31, 2, 6, 3],
  ['rect', 'v', 3, 12, 6, 2], ['rect', 'v', 11, 12, 5, 2], ['rect', 'v', 23, 12, 7, 2], ['rect', 'v', 31, 12, 6, 2],
  ['rect', 'O', 17, 1, 3, 6], ['rect', 'O', 17, 9, 3, 6], ['rect', 'z', 17, 7, 3, 2],
  ['px', 'T', 1, 4], ['px', 'T', 38, 4], ['px', 'T', 1, 11], ['px', 'T', 38, 11], ['px', 'T', 10, 3], ['px', 'T', 30, 13],
  ['px', 'Z', 2, 6], ['px', 'Z', 37, 9],
]);
// Σπάτα (28 x 18): the airport town. The buildings on top (hospital, kiosk, the terminal with a glass front and a tower), the street, a fence with a gate and the apron with parked planes below.
const SPATA_ROWS = paintMap(28, 18, 'T', [
  ['rect', ',', 1, 1, 26, 9], ['rect', '.', 0, 9, 28, 1], ['rect', 'o', 1, 11, 26, 5], // MZ-WORLD-02d: the street runs on to the east edge (27, 9), the gate to Βόρεια
  ['rect', 'F', 1, 10, 8, 1], ['rect', ',', 9, 10, 3, 1], ['rect', 'F', 12, 10, 15, 1],
].concat(hospitalFront(2, 2), kioskFront(9, 2), [
  ['rect', '2', 14, 2, 12, 2], ['rect', 'x', 14, 4, 12, 2], ['px', '8', 19, 5], ['px', '9', 26, 3],
  ['px', '0', 5, 13], ['px', '0', 13, 14], ['px', '0', 21, 12],
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 17, 6], ['px', 'S', 27, 8], ['px', 'U', 5, 8],
  ['px', 'T', 1, 7], ['px', 'T', 24, 7], ['px', 'T', 8, 8],
]));

// Route 7, Πεντέλη (32 x 18): the marble mountain. Three road legs joined by white marble steps (bottom, middle, top), quarry blocks and two cranes on top, grass between the legs.
// It runs right to left: the arrival from Σπάτα is on the right edge, the way on to Κηφισιά on the left edge.
const ROUTE7_ROWS = paintMap(32, 18, 'T', [
  ['rect', 's', 1, 1, 30, 16], ['rect', '%', 1, 1, 28, 2], ['px', 'q', 13, 2], ['px', 'q', 24, 2],
  ['rect', '.', 6, 14, 26, 2], ['rect', '&', 6, 10, 2, 4], ['rect', '.', 6, 8, 22, 2], ['rect', '&', 26, 5, 2, 3], ['rect', '.', 0, 3, 28, 2],
  ['rect', 'g', 2, 5, 22, 3], ['rect', 'g', 9, 10, 20, 4],
  ['px', 'R', 10, 6], ['px', 'R', 20, 6], ['px', 'R', 14, 12], ['px', 'R', 27, 11], ['px', 'R', 3, 12], ['px', 'R', 5, 15],
  ['px', 'I', 4, 6], ['px', 'I', 18, 7], ['px', 'I', 11, 11], ['px', 'I', 22, 12], ['px', 'I', 29, 6], ['px', 'I', 2, 14], ['px', 'I', 16, 6],
  ['px', 'Z', 29, 13], ['px', 'Z', 12, 7], ['px', 'Z', 2, 5],
]);
// Κηφισιά (26 x 18): the leafy town. The buildings on top (hospital, kiosk, café, a villa), clipped hedges, a plane-tree square with a fountain, villas below and
// the terminus station of the metro. The roads to the east (route 7) and to the west (route 8) meet in the street.
const KIFISIA_ROWS = paintMap(26, 18, 'T', [
  ['rect', ',', 1, 1, 24, 15], ['rect', '.', 0, 9, 26, 1],
].concat(hospitalFront(2, 2), kioskFront(9, 2), houseFront(15, 2, 5, '5', 17, 'D'), houseFront(21, 2, 4, '2', 22, 'd'), [
  ['rect', '=', 1, 7, 4, 1], ['rect', '=', 20, 7, 5, 1],
], houseFront(2, 11, 6, '1', 4, 'd'), houseFront(19, 11, 6, '3', 22, 'd'), [
  ['rect', '=', 1, 15, 8, 1], ['rect', '=', 18, 15, 7, 1],
  ['px', '7', 13, 12], ['px', 'T', 11, 11], ['px', 'T', 15, 11], ['px', 'T', 11, 13], ['px', 'T', 15, 13], ['px', 'T', 9, 12], ['px', 'T', 17, 12],
  ['px', 'j', 17, 14], ['px', 'U', 23, 8],
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 20, 5], ['px', 'S', 8, 8],
]));
// Route 8, Λεωφόρος Κηφισίας (44 x 14): a long boulevard. Shop fronts on the north side, a two-lane road, a roundabout in the middle, grass strips and trees on both sides.
// It runs right to left like route 7.
const ROUTE8_ROWS = paintMap(44, 14, 'T', [
  ['rect', ',', 1, 1, 42, 12], ['rect', '.', 0, 5, 44, 2], ['rect', '.', 19, 3, 8, 8], ['rect', '?', 21, 5, 4, 4], ['px', 'T', 22, 6], ['px', 'T', 23, 7],
  ['rect', 'g', 3, 3, 12, 2], ['rect', 'g', 30, 3, 11, 2], ['rect', 'g', 2, 8, 15, 4], ['rect', 'g', 29, 8, 13, 4],
].concat(shopFront(1, 1, 7, '1'), shopFront(9, 1, 7, '2'), shopFront(17, 1, 7, '3'), shopFront(25, 1, 8, '5'), shopFront(34, 1, 8, '1'), [
  ['px', 'T', 4, 7], ['px', 'T', 10, 7], ['px', 'T', 16, 7], ['px', 'T', 30, 7], ['px', 'T', 36, 7], ['px', 'T', 41, 7],
  ['px', 'T', 7, 9], ['px', 'T', 13, 10], ['px', 'T', 33, 9], ['px', 'T', 38, 10],
  ['px', 'S', 41, 4], ['px', 'S', 17, 7], ['px', 'S', 3, 4],
]));
// Μαρούσι (28 x 18): the arena complex. The hospital and the kiosk on the left, the stadium (an arched roof with scaffolding on it) on the right, the street, a fenced
// tennis court below on the left and houses on the right. The road from route 8 comes in on the east edge; the west end of the street is the gate to Δυτικά (MZ-WORLD-02e).
const MAROUSI_ROWS = paintMap(28, 18, 'T', [
  ['rect', ',', 1, 1, 26, 15], ['rect', '.', 0, 9, 28, 1], // MZ-WORLD-02e: the street runs on to the west edge (0, 9), the gate to Δυτικά
].concat(hospitalFront(2, 2), kioskFront(9, 2), [
  ['rect', '^', 14, 1, 13, 2], ['rect', '_', 16, 1, 4, 2], ['rect', '_', 23, 1, 2, 2], ['rect', '#', 14, 3, 13, 2],
  ['px', 'W', 14, 4], ['px', 'W', 17, 4], ['px', 'D', 20, 4], ['px', 'W', 23, 4], ['px', 'W', 26, 4],
  ['rect', 'F', 1, 10, 10, 6], ['rect', '!', 2, 11, 8, 4], ['px', ',', 5, 10],
], houseFront(14, 11, 5, '4', 16, 'd'), houseFront(21, 11, 5, '2', 22, 'd'), [
  ['px', 'T', 12, 11], ['px', 'T', 20, 12], ['px', 'T', 27, 14], ['px', 'T', 12, 14], ['px', 'T', 20, 14],
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 17, 5], ['px', 'S', 7, 8], ['px', 'S', 0, 8], ['px', 'U', 12, 8],
]));

// Route 9, Ο Αυτοκινητόδρομος (44 x 12): a highway. Four asphalt lanes with dashed lines, crash barriers with gaps, grass verges with trees, and a toll plaza in the middle.
// It runs right to left: the arrival from Μαρούσι is on the right edge, the way on to Περιστέρι on the left edge.
const ROUTE9_ROWS = paintMap(44, 12, 'T', [
  ['rect', 's', 1, 1, 42, 10],
  ['rect', 'g', 2, 1, 14, 2], ['rect', 'g', 25, 1, 15, 2], ['rect', 'g', 4, 9, 13, 2], ['rect', 'g', 27, 9, 12, 2],
  ['rect', '`', 0, 4, 44, 4], ['rect', ')', 0, 4, 44, 1], ['rect', ')', 0, 6, 44, 1],
  ['rect', '@', 1, 3, 5, 1], ['rect', '@', 9, 3, 7, 1], ['rect', '@', 19, 3, 10, 1], ['rect', '@', 32, 3, 6, 1], ['rect', '@', 41, 3, 2, 1],
  ['rect', '@', 1, 8, 8, 1], ['rect', '@', 12, 8, 9, 1], ['rect', '@', 24, 8, 10, 1], ['rect', '@', 37, 8, 6, 1],
  ['rect', '*', 22, 5, 2, 1], ['rect', '*', 22, 7, 2, 1], ['rect', '*', 22, 3, 2, 1],
  ['px', 'T', 20, 1], ['px', 'T', 21, 2], ['px', 'T', 10, 10], ['px', 'T', 22, 9], ['px', 'T', 40, 10], ['px', 'T', 3, 2], ['px', 'T', 14, 9],
  ['px', 'Z', 18, 2], ['px', 'Z', 31, 10], ['px', 'Z', 24, 10],
  ['px', 'S', 41, 2], ['px', 'S', 20, 9], ['px', 'S', 2, 9],
]);
// Περιστέρι (26 x 18): the dense west. The hospital, the kiosk, the café and an apartment block on top, the street market in the open space, the street, a fenced
// football ground below on the left and apartment blocks with laundry on the right. The roads to the east (route 9) and to the west (route 10) meet in the street.
const PERISTERI_ROWS = paintMap(26, 18, 'T', [
  ['rect', ',', 1, 1, 24, 15], ['rect', '.', 0, 9, 26, 1],
].concat(hospitalFront(2, 2), kioskFront(9, 2), houseFront(15, 2, 5, '1', 17, 'D'), blockFront(21, 2, 4, 4, '2'), [
  ['rect', '/', 3, 7, 1, 1], ['rect', '/', 5, 7, 1, 1], ['rect', '/', 12, 7, 1, 1], ['rect', '/', 14, 7, 1, 1], ['rect', '/', 16, 7, 1, 1], ['rect', '/', 18, 7, 1, 1],
  ['rect', 'F', 1, 10, 10, 6], ['rect', '<', 2, 11, 8, 4], ['px', ',', 5, 10],
  ['px', '|', 2, 12], ['px', '|', 2, 13], ['px', '|', 9, 12], ['px', '|', 9, 13],
], blockFront(12, 11, 5, 4, '2'), blockFront(18, 11, 5, 4, '2'), blockFront(23, 11, 2, 4, '2'), [
  ['px', 'T', 12, 15], ['px', 'T', 24, 15], ['px', 'T', 24, 7],
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 20, 5], ['px', 'S', 8, 8], ['px', 'S', 6, 10], ['px', 'U', 23, 8],
]));
// Route 10, Λεωφόρος Θηβών (36 x 18): a straight avenue. Market stalls and grass behind a pavement on the north side, a two-lane road, a pavement, grass patches and the
// river channel (a concrete bed with a little water) on the south side. It runs right to left like route 9.
const ROUTE10_ROWS = paintMap(36, 18, 'T', [
  ['rect', 's', 1, 1, 34, 14],
  ['rect', 'g', 2, 1, 12, 2], ['rect', 'g', 20, 1, 14, 2], ['rect', 'g', 3, 11, 11, 2], ['rect', 'g', 22, 11, 11, 2],
  ['rect', ',', 1, 5, 34, 2], ['rect', '.', 0, 7, 36, 2], ['rect', ',', 1, 9, 34, 2],
  ['rect', '/', 4, 4, 2, 1], ['rect', '/', 10, 4, 2, 1], ['rect', '/', 16, 4, 2, 1], ['rect', '/', 22, 4, 2, 1], ['rect', '/', 28, 4, 2, 1],
  ['rect', '-', 1, 13, 34, 2],
  ['px', 'T', 8, 3], ['px', 'T', 19, 3], ['px', 'T', 26, 3], ['px', 'T', 33, 3], ['px', 'T', 6, 12], ['px', 'T', 17, 12], ['px', 'T', 30, 12],
  ['px', 'Z', 14, 2], ['px', 'Z', 34, 12], ['px', 'Z', 2, 12],
  ['px', 'S', 33, 4], ['px', 'S', 2, 10], ['px', 'S', 19, 11],
]);
// Χαϊδάρι (28 x 18): the pass town under the ridge. The hospital and the kiosk on the left, the compound of the monastery (a roof, a plain whitewashed wall, a door and the
// car park in front of it, with parked cars and a barrier booth) on the right, the street, the ridge (rocks and pines with a path) and apartment blocks below.
// The road from route 10 comes in on the east edge; the west end of the street is the gate to Αθήνα (MZ-WORLD-02f).
const CHAIDARI_ROWS = paintMap(28, 18, 'T', [
  ['rect', ',', 1, 1, 26, 15], ['rect', '.', 0, 9, 28, 1], // MZ-WORLD-02f: the street runs on to the west edge (0, 9), the gate to Αθήνα
].concat(hospitalFront(2, 2), kioskFront(9, 2), [
  ['rect', '1', 14, 1, 13, 2], ['rect', 'J', 14, 3, 13, 1], ['rect', '#', 14, 4, 13, 1],
  ['px', 'W', 16, 4], ['px', 'W', 18, 4], ['px', 'D', 20, 4], ['px', 'W', 22, 4], ['px', 'W', 24, 4],
  ['rect', '`', 14, 5, 13, 4], ['px', '(', 15, 6], ['px', '(', 17, 7], ['px', '(', 23, 6], ['px', '(', 25, 7], ['px', '*', 14, 8], ['px', '*', 15, 8],
  ['rect', 'R', 1, 10, 9, 6], ['px', ',', 5, 10], ['px', ',', 5, 11], ['px', ',', 5, 12], ['px', 'I', 2, 11], ['px', 'I', 8, 12], ['px', 'I', 3, 14], ['px', 'I', 7, 15], ['px', 'I', 1, 10],
], blockFront(11, 11, 5, 4, '2'), blockFront(18, 11, 5, 4, '3'), blockFront(24, 11, 2, 4, '2'), [
  ['px', 'T', 17, 12], ['px', 'T', 17, 14], ['px', 'T', 12, 15], ['px', 'T', 23, 15], ['px', 'T', 11, 7],
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 13, 4], ['px', 'S', 0, 8], ['px', 'S', 13, 7], ['px', 'U', 12, 8],
]));

// Route 11, Ιερά Οδός (36 x 14): the old paved road. Two lanes of ancient paving through grass, column stumps on both sides, two closed digs behind hoardings.
// It runs left to right: the arrival from Χαϊδάρι is on the left edge, the way on to Μοναστηράκι on the right edge.
const ROUTE11_ROWS = paintMap(36, 14, 'T', [
  ['rect', 's', 1, 1, 34, 12],
  ['rect', '"', 1, 6, 34, 2], ['px', '"', 0, 6], ['px', '"', 35, 6],
  ['rect', '[', 6, 2, 5, 3], ['rect', '[', 24, 9, 6, 3],
  ['rect', 'g', 13, 1, 9, 3], ['rect', 'g', 2, 9, 10, 3], ['rect', 'g', 14, 10, 8, 2], ['rect', 'g', 24, 2, 9, 3], ['rect', 'g', 31, 9, 3, 3],
  ['px', '$', 4, 5], ['px', '$', 9, 5], ['px', '$', 15, 5], ['px', '$', 20, 5], ['px', '$', 27, 5], ['px', '$', 32, 5],
  ['px', '$', 5, 8], ['px', '$', 11, 8], ['px', '$', 17, 8], ['px', '$', 23, 8], ['px', '$', 30, 8],
  ['px', 'T', 3, 2], ['px', 'T', 12, 10], ['px', 'T', 22, 3], ['px', 'T', 33, 4], ['px', 'T', 20, 10], ['px', 'T', 1, 12], ['px', 'T', 34, 12],
  ['px', 'Z', 3, 5], ['px', 'Z', 8, 5], ['px', 'Z', 25, 8],
]);
// Μοναστηράκι (26 x 18): the flea-market town. The hospital, the kiosk and the café on top, the market stalls, the main street, a short clock tower and old houses below,
// and the hill of the Rock behind on the right with its marble steps (the way up). The road from route 11 comes in on the west edge; the east edge leads on to route 12.
const MONASTIRAKI_ROWS = paintMap(26, 18, 'T', [
  ['rect', ',', 1, 1, 24, 16], ['rect', '.', 0, 9, 26, 1],
].concat(hospitalFront(2, 2), kioskFront(9, 2), houseFront(15, 2, 5, '1', 17, 'D'), [
  ['rect', 'R', 21, 1, 4, 5], ['rect', '&', 22, 1, 1, 5],
  ['rect', '/', 3, 7, 1, 1], ['rect', '/', 5, 7, 1, 1], ['rect', '/', 8, 7, 1, 1], ['rect', '/', 13, 7, 1, 1], ['rect', '/', 15, 7, 1, 1], ['rect', '/', 18, 7, 1, 1],
  ['px', '}', 12, 12],
], houseFront(2, 11, 5, '1', 4, 'd'), houseFront(8, 11, 3, '3', 9, 'd'), houseFront(16, 11, 5, '5', 18, 'd'), [
  ['px', 'T', 1, 10], ['px', 'T', 14, 15], ['px', 'T', 24, 11], ['px', 'T', 24, 15], ['px', 'T', 6, 16], ['px', 'T', 19, 16],
  ['px', 'S', 7, 5], ['px', 'S', 13, 5], ['px', 'S', 20, 5], ['px', 'S', 23, 6], ['px', 'S', 6, 8], ['px', 'S', 12, 11], ['px', 'U', 23, 8],
]));
// The Rock (20 x 16): a hill with a worn marble path, a temple on top that is wrapped in scaffolding (a roof of marble blocks, a wall of columns), a ticket booth at the foot.
const ROCK_ROWS = paintMap(20, 16, 'T', [
  ['rect', 's', 1, 1, 18, 14],
  ['rect', '%', 5, 1, 10, 1], ['rect', '_', 5, 2, 10, 1], ['rect', '$', 5, 3, 10, 1],
  ['rect', '"', 3, 4, 14, 3],
  ['rect', '"', 3, 7, 2, 4], ['rect', '"', 3, 9, 8, 2], ['rect', '&', 9, 11, 2, 2], ['rect', '"', 9, 13, 2, 2], ['px', '"', 10, 15],
  ['rect', 'R', 1, 1, 3, 3], ['rect', 'R', 16, 1, 3, 3], ['px', 'R', 7, 8], ['px', 'R', 14, 9], ['px', 'R', 16, 12], ['px', 'R', 2, 13], ['px', 'R', 13, 13],
  ['px', 'I', 6, 11], ['px', 'I', 7, 13], ['px', 'I', 15, 8], ['px', 'I', 17, 10], ['px', 'I', 4, 12], ['px', 'I', 13, 11], ['px', 'I', 17, 4],
  ['px', 'K', 12, 12], ['px', 'S', 8, 7], ['px', 'S', 13, 12], ['px', 'S', 12, 4],
]);
// Route 12, Λεωφόρος Πανεπιστημίου (40 x 16): the avenue. Three neoclassical buildings in a row on the north side (a roof, two storeys of columns, marble steps), grass parks, a
// round plaza with a fountain on a lawn island (the road goes round it), shop windows and market stalls on the south side. It runs left to right.
const ROUTE12_ROWS = paintMap(40, 16, 'T', [
  ['rect', ',', 1, 1, 38, 14],
  ['rect', '.', 1, 8, 38, 2], ['px', '.', 0, 8], ['px', '.', 39, 8],
  ['rect', '.', 26, 6, 7, 5], ['rect', '?', 28, 7, 3, 3], ['px', '7', 29, 8],
  ['rect', '1', 2, 1, 6, 1], ['rect', ']', 2, 2, 6, 2], ['rect', '&', 2, 4, 6, 1],
  ['rect', '1', 9, 1, 6, 1], ['rect', ']', 9, 2, 6, 2], ['rect', '&', 9, 4, 6, 1],
  ['rect', '1', 16, 1, 6, 1], ['rect', ']', 16, 2, 6, 2], ['rect', '&', 16, 4, 6, 1],
  ['rect', 'g', 2, 5, 7, 3], ['rect', 'g', 10, 5, 8, 3], ['rect', 'g', 13, 10, 9, 2], ['rect', 'g', 34, 2, 4, 5],
].concat(shopFront(2, 12, 8, '2'), shopFront(12, 12, 7, '3'), [
  ['rect', '/', 23, 12, 1, 1], ['rect', '/', 25, 12, 1, 1], ['rect', '/', 33, 12, 1, 1], ['rect', '/', 35, 12, 1, 1],
  ['px', 'T', 5, 6], ['px', 'T', 14, 6], ['px', 'T', 36, 3], ['px', 'T', 18, 11], ['px', 'T', 34, 6], ['px', 'T', 24, 2], ['px', 'T', 38, 12],
  ['px', 'S', 1, 6], ['px', 'S', 25, 5], ['px', 'S', 11, 11], ['px', 'S', 30, 12],
]));
// The hill of Λυκαβηττός (20 x 16): pines and rocks, a path that switches back up to a viewpoint terrace with a fence, grass patches, a funicular station that is closed. No chapel and no cross.
const LYCABETTUS_ROWS = paintMap(20, 16, 'T', [
  ['rect', 's', 1, 1, 18, 14],
  ['rect', 'F', 5, 1, 10, 1], ['rect', '"', 5, 2, 10, 3],
  ['path', '.', [[10, 14], [10, 11], [4, 11], [4, 8], [10, 8], [10, 5]]], ['px', '.', 10, 15],
  ['rect', 'g', 2, 2, 2, 5], ['rect', 'g', 12, 9, 6, 4], ['rect', 'g', 1, 12, 7, 2], ['rect', 'g', 6, 5, 3, 2],
  ['rect', '5', 14, 5, 4, 1], ['rect', 'x', 14, 6, 4, 1], ['px', 'd', 15, 6],
  ['rect', 'R', 16, 1, 3, 3], ['px', 'R', 2, 9], ['px', 'R', 13, 12], ['px', 'R', 12, 14],
  ['px', 'I', 1, 8], ['px', 'I', 7, 10], ['px', 'I', 13, 7], ['px', 'I', 17, 9], ['px', 'I', 8, 13], ['px', 'I', 3, 10], ['px', 'I', 12, 6], ['px', 'I', 17, 13], ['px', 'I', 5, 13],
  ['px', 'S', 9, 14], ['px', 'S', 13, 7], ['px', 'S', 6, 3],
]);
// Σύνταγμα (30 x 20): the square. The hospital and the kiosk on top, the long front of the parliament in the middle (its door opens with the Assembly Medal, MZ-WORLD-02g), the police vans in rows, a fountain,
// the closed metro entrance, trees. The road from route 12 comes in on the west edge; the way to the hill is on the east edge. The boss stands in the middle of the square.
const SYNTAGMA_ROWS = paintMap(30, 20, 'T', [
  ['rect', ',', 1, 1, 28, 18], ['rect', '.', 0, 10, 9, 1],
].concat(hospitalFront(1, 1), kioskFront(24, 1), [
  ['rect', '5', 8, 1, 14, 1], ['rect', ']', 8, 2, 14, 3], ['px', 'Ξ', 14, 4], ['rect', '&', 12, 5, 5, 1],
  ['rect', '{', 9, 7, 5, 1], ['rect', '{', 17, 7, 5, 1],
  ['rect', '{', 3, 13, 6, 1], ['rect', '{', 3, 15, 6, 1], ['rect', '{', 20, 13, 7, 1], ['rect', '{', 20, 15, 7, 1],
  ['px', '7', 15, 13], ['px', 'j', 22, 10], ['px', 'U', 12, 11],
  ['px', 'T', 2, 8], ['px', 'T', 27, 8], ['px', 'T', 2, 11], ['px', 'T', 27, 11], ['px', 'T', 10, 16], ['px', 'T', 19, 16], ['px', 'T', 15, 16], ['px', 'T', 1, 18], ['px', 'T', 28, 18], ['px', 'T', 6, 17], ['px', 'T', 23, 17],
  ['px', '&', 28, 6], ['px', '&', 29, 6],
  ['px', 'S', 6, 4], ['px', 'S', 23, 4], ['px', 'S', 11, 5], ['px', 'S', 23, 10], ['px', 'S', 27, 5],
]));

const MAPS = {
  town: {
    name: 'map.town', w: 24, h: 16, music: 'town',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'T~~~~Q~~~~~~~~Q~~~~~X~~T',
      'T,,,,,,,,,,,,,,,,,,,,,,T',
      'T,2222,3333,4444,1111,,T',
      'T,2222,3333,4444,1111,,T',
      'T,W##W,W##W,W##W,W##W,,T',
      'T,#D##,#D##,#D##,#D##,,T',
      'T,,,,S,,,,S,,,,S,,,,S,,T',
      'T.......................',
      'T,,,,,,,,,,,,,,,,,,,,,,T',
      'T,1111,,,5555666662222,j',
      'T,1111,,,555566H662222,T',
      'T,W##W,,,W##WNMPMNW##W,T',
      'T,#d##,,,#D##MMEMM##d#,T',
      'T,,,,,,,,,,,,S,,,,,,,,,T',
      'TTTTTTTTTTTTTTTTTTTTTTUT',
    ],
    warps: [
      { x: 3, y: 6, to: 'lab', tx: 4, ty: 6 },
      { x: 8, y: 6, to: 'kep', tx: 4, ty: 6 },
      { x: 13, y: 6, to: 'shop', tx: 3, ty: 4 },
      { x: 18, y: 6, to: 'cafe', tx: 4, ty: 6 },
      { x: 10, y: 13, to: 'studio', tx: 4, ty: 6, needFlag: 'credits', lockedText: 'warp.studio' },
      { x: 15, y: 13, to: 'hospital', tx: 5, ty: 7 },
      { x: 23, y: 8, to: 'route1', tx: 1, ty: 9 },
    ],
    signs: { '5,7': 'sign.lab', '10,7': 'sign.kep', '15,7': 'sign.shop', '20,7': 'sign.cafe', '13,14': 'sign.studio', '14,13': 'sign.hospital', '3,13': 'sign.house1', '20,13': 'sign.house2', '22,15': 'sign.ktel', '23,10': 'sign.metro' },
    npcs: [
      { id: 'kid', x: 6, y: 9, face: 'down', look: 'kid', kind: 'talk', text: 'npc.kid' },
      { id: 'oldman', x: 14, y: 9, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.oldman' },
      { id: 'fisher', x: 12, y: 2, face: 'down', look: 'fisher', kind: 'talk', text: 'npc.fisher' },
    ],
    triggers: [{ x: 3, y: 7, flag: 'rival1', event: 'rival1' }],
  },
  lab: {
    name: 'map.lab', w: 10, h: 8, music: 'indoor',
    rows: ['wwwwwwwwww', 'whhfffffhw', 'wffffffffw', 'wfttffttfw', 'wffffffffw', 'wfrrrrrrfw', 'wfrrrrrrfw', 'wwwwmmwwww'],
    warps: [{ x: 4, y: 7, to: 'town', tx: 3, ty: 7 }, { x: 5, y: 7, to: 'town', tx: 3, ty: 7 }],
    signs: {},
    npcs: [
      { id: 'prof', x: 4, y: 2, face: 'down', look: 'prof', kind: 'prof' },
      { id: 'student', x: 7, y: 4, face: 'left', look: 'student', kind: 'talk', text: 'npc.student' },
    ],
  },
  kep: {
    name: 'map.kep', w: 10, h: 8, music: 'indoor',
    rows: ['wwwwwwwwww', 'wffffffffw', 'wccccccccw', 'wffffffffw', 'wfhhffhhfw', 'wffffffffw', 'wffffffffw', 'wwwwmmwwww'],
    warps: [{ x: 4, y: 7, to: 'town', tx: 8, ty: 7 }, { x: 5, y: 7, to: 'town', tx: 8, ty: 7 }],
    signs: {},
    npcs: [
      { id: 'kepclerk', x: 4, y: 1, face: 'down', look: 'clerk', kind: 'kep' },
      { id: 'queue1', x: 6, y: 5, face: 'up', look: 'oldwoman', kind: 'talk', text: 'npc.queue1' },
      { id: 'queue2', x: 2, y: 6, face: 'up', look: 'kid', kind: 'talk', text: 'npc.queue2' },
    ],
  },
  // Νοσοκομείο 3000: reception counter (heal), a corridor with ράντζα and waiting people, a broken vending machine,
  // a TV, and the Αρχείο Ασθενών terminal (actions: 'archive'). Row 1 is behind the counter; nobody can walk there.
  hospital: {
    name: 'map.hospital', w: 12, h: 9, music: 'indoor',
    rows: [
      'iiiiiiiiiiii',
      'iLLLLLLLLLLi',
      'iCCCCCCCCCCi',
      'iALLLYLLLLVi',
      'iLLLLLLLLLLi',
      'iBLLLLLLLLBi',
      'iBLLBLLBLLBi',
      'iLLLLLLLLLLi',
      'iiiiimmiiiii',
    ],
    warps: [{ x: 5, y: 8, to: 'town', tx: 15, ty: 14 }, { x: 6, y: 8, to: 'town', tx: 15, ty: 14 }],
    signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
    actions: { '1,3': 'archive' },
    npcs: [
      { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
      { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.hosp.doctor' },
      { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'oldwoman', kind: 'talk', text: 'npc.hosp.wait1' },
      { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman2', kind: 'talk', text: 'npc.hosp.wait2' },
      { id: 'hospwait3', x: 2, y: 6, face: 'right', look: 'kid', kind: 'talk', text: 'npc.hosp.wait3' },
      { id: 'hospwait4', x: 9, y: 6, face: 'up', look: 'fisher', kind: 'talk', text: 'npc.hosp.wait4' },
    ],
  },
  shop: {
    name: 'map.shop', w: 8, h: 6, music: 'indoor',
    rows: ['wwwwwwww', 'whhffhhw', 'wccccccw', 'wffffffw', 'wffffffw', 'wwwmmwww'],
    warps: [{ x: 3, y: 5, to: 'town', tx: 13, ty: 7 }, { x: 4, y: 5, to: 'town', tx: 13, ty: 7 }],
    signs: {},
    npcs: [
      { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
      { id: 'customer', x: 5, y: 4, face: 'up', look: 'student', kind: 'talk', text: 'npc.customer' },
    ],
  },
  cafe: {
    name: 'map.cafe', w: 10, h: 8, music: 'indoor',
    rows: ['wwwwwwwwww', 'whhfffffhw', 'wcccccfffw', 'wffffffffw', 'wffffffffw', 'wfttffttfw', 'wffffffffw', 'wwwwmmwwww'],
    warps: [{ x: 4, y: 7, to: 'town', tx: 18, ty: 7 }, { x: 5, y: 7, to: 'town', tx: 18, ty: 7 }],
    signs: {},
    npcs: [
      { id: 'cafeowner', x: 3, y: 1, face: 'down', look: 'cafeowner', kind: 'save' },
      { id: 'tavli1', x: 2, y: 4, face: 'right', look: 'oldman', kind: 'talk', text: 'npc.tavli1' },
      { id: 'tavli2', x: 7, y: 6, face: 'up', look: 'oldman2', kind: 'talk', text: 'npc.tavli2' },
    ],
  },
  studio: {
    name: 'map.studio', w: 10, h: 8, music: 'studio',
    rows: ['wwwwwwwwww', 'wrrrrrrrrw', 'wrrrrrrrrw', 'wffffffffw', 'wfhhffhhfw', 'wffffffffw', 'wffffffffw', 'wwwwmmwwww'],
    warps: [{ x: 4, y: 7, to: 'town', tx: 10, ty: 14 }, { x: 5, y: 7, to: 'town', tx: 10, ty: 14 }],
    signs: {},
    npcs: [{ id: 'host', x: 4, y: 2, face: 'down', look: 'host', kind: 'trainer', trainer: 'host' }],
  },
  route1: {
    name: 'map.route1', w: 32, h: 18, music: 'route',
    rows: ROUTE_ROWS,
    warps: [
      { x: 0, y: 9, to: 'town', tx: 22, ty: 8 },
      { x: 25, y: 4, to: 'port', tx: 5, ty: 8 },
      { x: 31, y: 10, to: 'route2', tx: 1, ty: 8, needFlag: 'badge', lockedText: 'warp.route2' },
    ],
    signs: { '2,8': 'sign.route1', '24,7': 'sign.port', '31,9': 'sign.route1.east' },
    npcs: [
      { id: 'phoebe', x: 11, y: 13, face: 'left', look: 'blogger', kind: 'trainer', trainer: 'phoebe', sight: 4 },
      { id: 'stelios', x: 15, y: 10, face: 'down', look: 'cop', kind: 'trainer', trainer: 'stelios', sight: 4 },
      { id: 'takis', x: 19, y: 8, face: 'left', look: 'singer', kind: 'trainer', trainer: 'takis', sight: 4 },
      { id: 'rival2', x: 22, y: 7, face: 'down', look: 'rival', kind: 'trainer', trainer: 'rival2', sight: 3 },
    ],
    zones: [
      { x0: 0, x1: 6, table: [
        { sp: 'fakelakis', w: 40, min: 2, max: 4 }, { sp: 'trolosavros', w: 14, min: 2, max: 4 }, { sp: 'laikatzis', w: 14, min: 2, max: 4 },
        { sp: 'storoula', w: 10, min: 2, max: 4 }, { sp: 'dimosio', w: 12, min: 2, max: 4 }, { sp: 'eforaki', w: 10, min: 2, max: 4 }] },
      { x0: 7, x1: 15, table: [
        { sp: 'fakelakis', w: 30, min: 4, max: 6 }, { sp: 'trolosavros', w: 14, min: 4, max: 6 }, { sp: 'laikatzis', w: 14, min: 4, max: 6 },
        { sp: 'storoula', w: 12, min: 4, max: 6 }, { sp: 'dimosio', w: 12, min: 4, max: 6 }, { sp: 'eforaki', w: 12, min: 4, max: 6 },
        { sp: 'frapedoros', w: 6, min: 5, max: 7 }] },
      { x0: 16, x1: 99, table: [
        { sp: 'fakelakis', w: 22, min: 6, max: 8 }, { sp: 'trolosavros', w: 12, min: 6, max: 8 }, { sp: 'laikatzis', w: 12, min: 6, max: 8 },
        { sp: 'storoula', w: 12, min: 6, max: 8 }, { sp: 'dimosio', w: 10, min: 6, max: 8 }, { sp: 'eforaki', w: 12, min: 6, max: 8 },
        { sp: 'frapedoros', w: 10, min: 6, max: 8 }, { sp: 'giagiaka', w: 10, min: 6, max: 8 }] },
    ],
  },
  port: {
    name: 'map.port', w: 12, h: 10, music: 'boss',
    rows: ['wwwwwwwwwwww', 'whhfffffffhw', 'wffffffffffw', 'wfffccccfffw', 'wffffffffffw', 'wfKKffffKKfw', 'wffffffffffw', 'wfrrrrrrrrfw', 'wfrrrrrrrrfw', 'wwwwwmmwwwww'],
    warps: [{ x: 5, y: 9, to: 'route1', tx: 25, ty: 5 }, { x: 6, y: 9, to: 'route1', tx: 25, ty: 5 }],
    signs: {},
    npcs: [
      { id: 'kotsos', x: 5, y: 2, face: 'down', look: 'captain', kind: 'boss', trainer: 'kotsos' },
      { id: 'sailor1', x: 6, y: 6, face: 'right', look: 'sailor', kind: 'talk', text: 'npc.sailor1' },
      { id: 'sailor2', x: 9, y: 6, face: 'left', look: 'sailor', kind: 'talk', text: 'npc.sailor2' },
    ],
  },
};
// MZ-WORLD-02a: route 2 and Καστέλλα. The interiors reuse the templates of New Piraeus (the hospital rows, the shop rows).
MAPS.route2 = {
  name: 'map.route2', w: 40, h: 14, music: 'route',
  rows: ROUTE2_ROWS,
  warps: [
    { x: 0, y: 8, to: 'route1', tx: 30, ty: 10 },
    { x: 39, y: 8, to: 'kastella', tx: 1, ty: 12 },
  ],
  signs: { '2,7': 'sign.route2', '37,7': 'sign.kastella' },
  npcs: [
    { id: 'fan', x: 17, y: 5, face: 'down', look: 'fan', kind: 'trainer', trainer: 'fan', sight: 4 },
    { id: 'ferrysailor', x: 30, y: 6, face: 'down', look: 'sailor', kind: 'trainer', trainer: 'ferrysailor', sight: 3 },
    { id: 'ferryclerk', x: 8, y: 7, face: 'down', look: 'clerk', kind: 'talk', text: 'npc.ferryclerk' },
    { id: 'groundkeeper', x: 28, y: 11, face: 'up', look: 'oldman2', kind: 'talk', text: 'npc.groundkeeper' },
  ],
  zones: [
    { x0: 0, x1: 19, table: [
      { sp: 'fakelarchis', w: 35, min: 10, max: 12 }, { sp: 'efoplistakos', w: 8, min: 11, max: 12 }, { sp: 'laikatzis', w: 22, min: 10, max: 12 },
      { sp: 'frapedoros', w: 18, min: 10, max: 12 }, { sp: 'giagiaka', w: 17, min: 10, max: 12 }] },
    { x0: 20, x1: 99, table: [
      { sp: 'fakelarchis', w: 35, min: 11, max: 13 }, { sp: 'efoplistakos', w: 8, min: 12, max: 13 }, { sp: 'laikatzis', w: 22, min: 11, max: 13 },
      { sp: 'frapedoros', w: 18, min: 11, max: 13 }, { sp: 'giagiaka', w: 17, min: 11, max: 13 }] },
  ],
};
MAPS.kastella = {
  name: 'map.kastella', w: 26, h: 18, music: 'town',
  rows: KASTELLA_ROWS,
  warps: [
    { x: 0, y: 12, to: 'route2', tx: 38, ty: 8 },
    { x: 12, y: 5, to: 'kastella_theatre', tx: 5, ty: 8 },
    { x: 11, y: 11, to: 'kastella_hospital', tx: 5, ty: 7 },
    { x: 17, y: 11, to: 'kastella_shop', tx: 3, ty: 4 },
  ],
  signs: { '11,6': 'sign.theatre', '8,11': 'sign.kastella.hospital', '15,11': 'sign.shop', '6,13': 'sign.ktel', '24,14': 'sign.roadworks', '3,5': 'sign.house1', '20,5': 'sign.house2', '3,11': 'sign.house1', '22,11': 'sign.house2' },
  npcs: [
    { id: 'kvillager', x: 17, y: 4, face: 'down', look: 'oldwoman', kind: 'talk', text: 'npc.kastella1' },
    { id: 'kstudent', x: 7, y: 10, face: 'left', look: 'student', kind: 'talk', text: 'npc.kastella2' },
    { id: 'kfisher', x: 8, y: 3, face: 'down', look: 'oldman2', kind: 'talk', text: 'npc.kastella3' },
  ],
};
MAPS.kastella_hospital = {
  name: 'map.kastella.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'kastella', tx: 11, ty: 12 }, { x: 6, y: 8, to: 'kastella', tx: 11, ty: 12 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.kastella.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'oldman', kind: 'talk', text: 'npc.kastella.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldwoman', kind: 'talk', text: 'npc.hosp.wait1' },
  ],
};
MAPS.kastella_shop = {
  name: 'map.kastella.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  warps: [{ x: 3, y: 5, to: 'kastella', tx: 17, ty: 12 }, { x: 4, y: 5, to: 'kastella', tx: 17, ty: 12 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'fisher', kind: 'talk', text: 'npc.kastella.customer' },
  ],
};
// The open-air theatre: the sea behind a stage on top, stone tiers ('e', walkable steps) below it, a viewpoint on the stage that looks over the whole bay.
MAPS.kastella_theatre = {
  name: 'map.kastella.theatre', w: 12, h: 10, music: 'town',
  rows: ['T~~~~~~~~~~T', 'TrrrrrrrrrrT', 'TrrrrrrrrrrT', 'T,,,,,,,,,,T', 'TeeeeeeeeeeT', 'TeeeeeeeeeeT', 'TeeeeeeeeeeT', 'TeeeeeeeeeeT', 'T,,,,,,,,,,T', 'TTTTT,,TTTTT'],
  warps: [{ x: 5, y: 9, to: 'kastella', tx: 12, ty: 6 }, { x: 6, y: 9, to: 'kastella', tx: 12, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'viewpoint', x: 5, y: 2, face: 'down', look: 'clerk', kind: 'talk', text: 'npc.theatre.view' },
    { id: 'theatreold', x: 9, y: 5, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.theatre.old' },
  ],
};
// MZ-WORLD-02b: the district Νότια. The gate is the east end of the Καστέλλα promenade (the flag badge, as 11.4 says for the road out of the first district).
MAPS.kastella.warps.push({ x: 25, y: 14, to: 'route3', tx: 1, ty: 8, needFlag: 'badge', lockedText: 'warp.route3' });
MAPS.kastella.signs['24,13'] = 'sign.kastella.east';
delete MAPS.kastella.signs['24,14'];
MAPS.route3 = {
  name: 'map.route3', w: 40, h: 14, music: 'route',
  rows: ROUTE3_ROWS,
  warps: [
    { x: 0, y: 8, to: 'kastella', tx: 24, ty: 14 },
    { x: 39, y: 8, to: 'faliro', tx: 1, ty: 9 },
  ],
  signs: { '2,6': 'sign.route3', '37,6': 'sign.faliro' },
  npcs: [
    { id: 'sunbedseller', x: 12, y: 9, face: 'up', look: 'sunbedseller', kind: 'trainer', trainer: 'sunbedseller', sight: 2 },
    { id: 'conductor', x: 19, y: 6, face: 'down', look: 'conductor', kind: 'trainer', trainer: 'conductor', sight: 2 },
    { id: 'lifeguard', x: 26, y: 10, face: 'up', look: 'lifeguard', kind: 'trainer', trainer: 'lifeguard', sight: 3 },
    { id: 'beachgoer', x: 20, y: 10, face: 'up', look: 'kid', kind: 'talk', text: 'npc.beachgoer' },
    { id: 'roadworker', x: 34, y: 7, face: 'down', look: 'oldman2', kind: 'talk', text: 'npc.roadworker' },
  ],
  zones: [
    { x0: 0, x1: 19, table: [
      { sp: 'frapedoros', w: 22, min: 13, max: 15 }, { sp: 'trolosavros', w: 20, min: 13, max: 15 }, { sp: 'laikatzis', w: 18, min: 13, max: 15 },
      { sp: 'eforaki', w: 16, min: 13, max: 15 }, { sp: 'efoplistakos', w: 8, min: 14, max: 15 }, { sp: 'fakelarchis', w: 6, min: 14, max: 15 }] },
    { x0: 20, x1: 99, table: [
      { sp: 'frapedoros', w: 22, min: 14, max: 16 }, { sp: 'trolosavros', w: 20, min: 14, max: 16 }, { sp: 'laikatzis', w: 18, min: 14, max: 16 },
      { sp: 'eforaki', w: 16, min: 14, max: 16 }, { sp: 'efoplistakos', w: 8, min: 14, max: 16 }, { sp: 'fakelarchis', w: 6, min: 14, max: 16 }] },
  ],
};
MAPS.faliro = {
  name: 'map.faliro', w: 30, h: 16, music: 'town',
  rows: FALIRO_ROWS,
  warps: [
    { x: 0, y: 9, to: 'route3', tx: 38, ty: 8 },
    { x: 29, y: 9, to: 'route4', tx: 1, ty: 8 },
    { x: 4, y: 5, to: 'faliro_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'faliro_shop', tx: 3, ty: 4 },
    { x: 17, y: 5, to: 'faliro_cafe', tx: 4, ty: 6 },
  ],
  signs: { '7,5': 'sign.faliro.hospital', '13,5': 'sign.shop', '20,5': 'sign.faliro.cafe', '24,5': 'sign.house2', '22,7': 'sign.ktel', '12,8': 'sign.faliro.tram' },
  npcs: [
    { id: 'framwatcher', x: 14, y: 7, face: 'down', look: 'oldman', kind: 'talk', text: 'npc.faliro1' },
    { id: 'fcafeguest', x: 20, y: 7, face: 'left', look: 'clerk', kind: 'talk', text: 'npc.faliro2' },
    { id: 'fbeachkid', x: 8, y: 11, face: 'right', look: 'kid', kind: 'talk', text: 'npc.faliro3' },
  ],
};
MAPS.faliro_hospital = {
  name: 'map.faliro.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'faliro', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'faliro', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.faliro.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'oldman', kind: 'talk', text: 'npc.faliro.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman2', kind: 'talk', text: 'npc.hosp.wait2' },
  ],
};
MAPS.faliro_shop = {
  name: 'map.faliro.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_NOTIA,
  warps: [{ x: 3, y: 5, to: 'faliro', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'faliro', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'student', kind: 'talk', text: 'npc.faliro.customer' },
  ],
};
// The first Καφενείο of Νότια («Ο Παραλιακός»): the save point, with its own greeting (cafeHello).
MAPS.faliro_cafe = {
  name: 'map.faliro.cafe', w: 10, h: 8, music: 'indoor',
  rows: MAPS.cafe.rows,
  cafeHello: 'cafe.hello.faliro',
  warps: [{ x: 4, y: 7, to: 'faliro', tx: 17, ty: 6 }, { x: 5, y: 7, to: 'faliro', tx: 17, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'cafeowner', x: 3, y: 1, face: 'down', look: 'cafeowner', kind: 'save' },
    { id: 'fcafe1', x: 2, y: 4, face: 'right', look: 'oldman', kind: 'talk', text: 'npc.fcafe1' },
    { id: 'fcafe2', x: 7, y: 6, face: 'up', look: 'fisher', kind: 'talk', text: 'npc.fcafe2' },
  ],
};
MAPS.route4 = {
  name: 'map.route4', w: 36, h: 20, music: 'route',
  rows: ROUTE4_ROWS,
  warps: [
    { x: 0, y: 8, to: 'faliro', tx: 28, ty: 9 },
    { x: 35, y: 8, to: 'glyfada', tx: 1, ty: 7 },
  ],
  signs: { '2,7': 'sign.route4', '33,7': 'sign.glyfada' },
  npcs: [
    { id: 'surfer', x: 9, y: 7, face: 'down', look: 'surfer', kind: 'trainer', trainer: 'surfer', sight: 2 },
    { id: 'rival3', x: 20, y: 6, face: 'down', look: 'rival', kind: 'trainer', trainer: 'rival3', sight: 2 },
    { id: 'golfer', x: 30, y: 10, face: 'up', look: 'golfer', kind: 'trainer', trainer: 'golfer', sight: 3 },
    { id: 'airfieldworker', x: 15, y: 10, face: 'down', look: 'fan', kind: 'talk', text: 'npc.airfield1' },
    { id: 'planewatcher', x: 5, y: 12, face: 'up', look: 'oldman', kind: 'talk', text: 'npc.airfield2' },
  ],
  zones: [
    { x0: 0, x1: 17, table: [
      { sp: 'kafenovios', w: 26, min: 16, max: 18 }, { sp: 'frapedoros', w: 22, min: 16, max: 18 }, { sp: 'giagiaka', w: 20, min: 16, max: 18 },
      { sp: 'efoplistakos', w: 16, min: 16, max: 18 }, { sp: 'storoula', w: 16, min: 16, max: 18 }] },
    { x0: 18, x1: 99, table: [
      { sp: 'kafenovios', w: 26, min: 17, max: 19 }, { sp: 'frapedoros', w: 22, min: 17, max: 19 }, { sp: 'giagiaka', w: 20, min: 17, max: 19 },
      { sp: 'efoplistakos', w: 16, min: 17, max: 19 }, { sp: 'storoula', w: 16, min: 17, max: 19 }] },
  ],
};
MAPS.glyfada = {
  name: 'map.glyfada', w: 28, h: 18, music: 'town',
  rows: GLYFADA_ROWS,
  warps: [
    { x: 0, y: 7, to: 'route4', tx: 34, ty: 8 },
    { x: 4, y: 5, to: 'glyfada_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'glyfada_shop', tx: 3, ty: 4 },
    { x: 17, y: 5, to: 'glyfada_boss', tx: 5, ty: 8 },
    { x: 27, y: 7, to: 'route5', tx: 1, ty: 13, needFlag: 'badge_notia', lockedText: 'warp.route5' }, // MZ-WORLD-02c: the road to Ανατολικά opens with the Coast Medal
  ],
  signs: { '7,5': 'sign.glyfada.hospital', '13,5': 'sign.shop', '22,5': 'sign.glyfada.cafe', '23,6': 'sign.glyfada.club', '27,6': 'sign.glyfada.east',
    '12,12': 'sign.house1', '23,12': 'sign.house2', '4,13': 'sign.ktel' },
  npcs: [
    { id: 'skipper', x: 11, y: 9, face: 'up', look: 'skipper', kind: 'trainer', trainer: 'skipper', sight: 3 },
    { id: 'gmarina', x: 17, y: 13, face: 'down', look: 'fisher', kind: 'talk', text: 'npc.glyfada1' },
    { id: 'ggolf', x: 5, y: 10, face: 'right', look: 'golfer', kind: 'talk', text: 'npc.glyfada2' },
    { id: 'gclubber', x: 24, y: 8, face: 'up', look: 'singer', kind: 'talk', text: 'npc.glyfada3' },
  ],
};
MAPS.glyfada_hospital = {
  name: 'map.glyfada.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'glyfada', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'glyfada', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.glyfada.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'oldwoman', kind: 'talk', text: 'npc.glyfada.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'kid', kind: 'talk', text: 'npc.hosp.wait3' },
  ],
};
MAPS.glyfada_shop = {
  name: 'map.glyfada.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_NOTIA,
  warps: [{ x: 3, y: 5, to: 'glyfada', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'glyfada', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'fisher', kind: 'talk', text: 'npc.glyfada.customer' },
  ],
};
// «Η Μεγάλη Προκυμαία»: the big seaside café, a counter with the boss behind it (the Port Office layout, with tables).
MAPS.glyfada_boss = {
  name: 'map.glyfada.boss', w: 12, h: 10, music: 'boss',
  rows: ['wwwwwwwwwwww', 'whhfffffffhw', 'wffffffffffw', 'wfffccccfffw', 'wffffffffffw', 'wfttffffttfw', 'wffffffffffw', 'wfttffffttfw', 'wffffffffffw', 'wwwwwmmwwwww'],
  warps: [{ x: 5, y: 9, to: 'glyfada', tx: 17, ty: 6 }, { x: 6, y: 9, to: 'glyfada', tx: 17, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'bougatsas', x: 5, y: 2, face: 'down', look: 'bougatsas', kind: 'boss', trainer: 'bougatsas' },
    { id: 'bcust1', x: 2, y: 6, face: 'right', look: 'oldman2', kind: 'talk', text: 'npc.boss.cust1' },
    { id: 'bcust2', x: 9, y: 6, face: 'left', look: 'clerk', kind: 'talk', text: 'npc.boss.cust2' },
  ],
};
// MZ-WORLD-02c: the district Ανατολικά. The gate is the east end of the Γλυφάδα street (the flag badge_notia, defined with the Γλυφάδα warps).
MAPS.route5 = {
  name: 'map.route5', w: 36, h: 16, music: 'route',
  rows: ROUTE5_ROWS,
  warps: [
    { x: 0, y: 13, to: 'glyfada', tx: 26, ty: 7 },
    { x: 35, y: 4, to: 'koropi', tx: 1, ty: 9 },
  ],
  signs: { '2,12': 'sign.route5', '30,12': 'sign.monastery', '33,5': 'sign.koropi' },
  npcs: [
    { id: 'pilgrim', x: 30, y: 9, face: 'left', look: 'pilgrim', kind: 'trainer', trainer: 'pilgrim', sight: 2 },
    { id: 'customs', x: 16, y: 7, face: 'down', look: 'customs', kind: 'trainer', trainer: 'customs', sight: 2 },
    { id: 'tourist', x: 20, y: 5, face: 'up', look: 'tourist', kind: 'trainer', trainer: 'tourist', sight: 2 },
    { id: 'hiker', x: 13, y: 11, face: 'right', look: 'kid', kind: 'talk', text: 'npc.hiker' },
    { id: 'wallkeeper', x: 31, y: 7, face: 'down', look: 'oldman2', kind: 'talk', text: 'npc.wallkeeper' },
  ],
  zones: [
    { x0: 0, x1: 17, table: [
      { sp: 'eforaki', w: 22, min: 19, max: 21 }, { sp: 'trolosavros', w: 22, min: 19, max: 21 }, { sp: 'storoula', w: 20, min: 19, max: 21 },
      { sp: 'efoplistakos', w: 18, min: 19, max: 21 }, { sp: 'monastiriaki', w: 6, min: 19, max: 21 }] },
    { x0: 18, x1: 99, table: [
      { sp: 'eforaki', w: 22, min: 20, max: 22 }, { sp: 'trolosavros', w: 22, min: 20, max: 22 }, { sp: 'storoula', w: 20, min: 20, max: 21 },
      { sp: 'efoplistakos', w: 18, min: 20, max: 22 }, { sp: 'monastiriaki', w: 6, min: 20, max: 22 }] },
  ],
};
MAPS.koropi = {
  name: 'map.koropi', w: 26, h: 16, music: 'town',
  rows: KOROPI_ROWS,
  warps: [
    { x: 0, y: 9, to: 'route5', tx: 34, ty: 4 },
    { x: 25, y: 9, to: 'route6', tx: 1, ty: 8 },
    { x: 4, y: 5, to: 'koropi_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'koropi_shop', tx: 3, ty: 4 },
    { x: 17, y: 5, to: 'koropi_cafe', tx: 4, ty: 6 },
  ],
  signs: { '7,5': 'sign.koropi.hospital', '13,5': 'sign.shop', '20,5': 'sign.koropi.cafe', '22,7': 'sign.ktel', '6,8': 'sign.koropi.town' },
  npcs: [
    { id: 'kwatcher', x: 12, y: 8, face: 'up', look: 'oldman', kind: 'talk', text: 'npc.koropi1' },
    { id: 'kgrower', x: 12, y: 12, face: 'left', look: 'fisher', kind: 'talk', text: 'npc.koropi2' },
    { id: 'kkid', x: 7, y: 7, face: 'right', look: 'kid', kind: 'talk', text: 'npc.koropi3' },
  ],
};
MAPS.koropi_hospital = {
  name: 'map.koropi.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'koropi', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'koropi', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.koropi.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'oldman2', kind: 'talk', text: 'npc.koropi.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'kid', kind: 'talk', text: 'npc.hosp.wait3' },
  ],
};
MAPS.koropi_shop = {
  name: 'map.koropi.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_NOTIA,
  warps: [{ x: 3, y: 5, to: 'koropi', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'koropi', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'oldman', kind: 'talk', text: 'npc.koropi.customer' },
  ],
};
// The first Καφενείο of Ανατολικά («Το Κτήμα»): the save point, with its own greeting (cafeHello).
MAPS.koropi_cafe = {
  name: 'map.koropi.cafe', w: 10, h: 8, music: 'indoor',
  rows: MAPS.cafe.rows,
  cafeHello: 'cafe.hello.koropi',
  warps: [{ x: 4, y: 7, to: 'koropi', tx: 17, ty: 6 }, { x: 5, y: 7, to: 'koropi', tx: 17, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'cafeowner', x: 3, y: 1, face: 'down', look: 'cafeowner', kind: 'save' },
    { id: 'kcafe1', x: 2, y: 4, face: 'right', look: 'fisher', kind: 'talk', text: 'npc.kcafe1' },
    { id: 'kcafe2', x: 7, y: 6, face: 'up', look: 'oldman2', kind: 'talk', text: 'npc.kcafe2' },
  ],
};
MAPS.route6 = {
  name: 'map.route6', w: 40, h: 16, music: 'route',
  rows: ROUTE6_ROWS,
  warps: [
    { x: 0, y: 8, to: 'koropi', tx: 24, ty: 9 },
    { x: 39, y: 8, to: 'spata', tx: 1, ty: 9 },
  ],
  signs: { '2,6': 'sign.route6', '37,9': 'sign.spata' },
  npcs: [
    { id: 'vineyard', x: 6, y: 6, face: 'down', look: 'vineyard', kind: 'trainer', trainer: 'vineyard', sight: 2 },
    { id: 'cryptoseller', x: 20, y: 6, face: 'down', look: 'cryptoseller', kind: 'trainer', trainer: 'cryptoseller', sight: 2 },
    { id: 'spotter', x: 33, y: 9, face: 'up', look: 'spotter', kind: 'trainer', trainer: 'spotter', sight: 2 },
    { id: 'farmhand', x: 13, y: 10, face: 'up', look: 'oldman', kind: 'talk', text: 'npc.farmhand' },
    { id: 'bridgewalker', x: 27, y: 5, face: 'down', look: 'student', kind: 'talk', text: 'npc.bridgewalker' },
  ],
  zones: [
    { x0: 0, x1: 19, table: [
      { sp: 'influenza', w: 26, min: 22, max: 24 }, { sp: 'kryptomakis', w: 26, min: 22, max: 24 }, { sp: 'monimos', w: 24, min: 22, max: 24 }] },
    { x0: 20, x1: 99, table: [
      { sp: 'influenza', w: 26, min: 24, max: 26 }, { sp: 'kryptomakis', w: 24, min: 23, max: 25 }, { sp: 'monimos', w: 24, min: 23, max: 25 },
      { sp: 'nftarchis', w: 6, min: 26, max: 26 }] },
  ],
};
MAPS.spata = {
  name: 'map.spata', w: 28, h: 18, music: 'town',
  rows: SPATA_ROWS,
  warps: [
    { x: 0, y: 9, to: 'route6', tx: 38, ty: 8 },
    { x: 4, y: 5, to: 'spata_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'spata_shop', tx: 3, ty: 4 },
    { x: 19, y: 5, to: 'spata_boss', tx: 6, ty: 8 },
    { x: 27, y: 9, to: 'route7', tx: 30, ty: 14, needFlag: 'badge_anatolika', lockedText: 'warp.route7' }, // MZ-WORLD-02d: the road to Βόρεια opens with the Boarding Medal
  ],
  signs: { '7,5': 'sign.spata.hospital', '13,5': 'sign.shop', '17,6': 'sign.spata.terminal', '27,8': 'sign.spata.north', '5,8': 'sign.ktel' },
  npcs: [
    { id: 'checkin', x: 21, y: 7, face: 'left', look: 'checkin', kind: 'trainer', trainer: 'checkin', sight: 3 },
    { id: 'queue1', x: 15, y: 6, face: 'right', look: 'tourist', kind: 'talk', text: 'npc.spata.queue1' },
    { id: 'queue2', x: 15, y: 7, face: 'right', look: 'kid', kind: 'talk', text: 'npc.spata.queue2' },
    { id: 'queue3', x: 15, y: 8, face: 'right', look: 'oldwoman', kind: 'talk', text: 'npc.spata.queue3' },
    { id: 'orbitalsailor', x: 24, y: 8, face: 'left', look: 'sailor', kind: 'talk', text: 'npc.spata.sailor' },
  ],
};
MAPS.spata_hospital = {
  name: 'map.spata.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'spata', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'spata', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.spata.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'tourist', kind: 'talk', text: 'npc.spata.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.hosp.wait2' },
  ],
};
MAPS.spata_shop = {
  name: 'map.spata.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_NOTIA,
  warps: [{ x: 3, y: 5, to: 'spata', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'spata', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'student', kind: 'talk', text: 'npc.spata.customer' },
  ],
};
// «Διαστημολιμένας»: the terminal with its gates, a counter with the boss behind it (the Port Office layout, with luggage shelves and tables).
MAPS.spata_boss = {
  name: 'map.spata.boss', w: 14, h: 10, music: 'boss',
  rows: ['wwwwwwwwwwwwww', 'whhffffffffhhw', 'wffffffffffffw', 'wfffccccccfffw', 'wffffffffffffw', 'wfrrffffffrrfw', 'wffffffffffffw', 'wfttffffffttfw', 'wffffffffffffw', 'wwwwwwmmwwwwww'],
  warps: [{ x: 6, y: 9, to: 'spata', tx: 19, ty: 6 }, { x: 7, y: 9, to: 'spata', tx: 19, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'faia', x: 6, y: 2, face: 'down', look: 'faia', kind: 'boss', trainer: 'faia' },
    { id: 'tcust1', x: 2, y: 6, face: 'right', look: 'tourist', kind: 'talk', text: 'npc.spata.cust1' },
    { id: 'tcust2', x: 11, y: 6, face: 'left', look: 'clerk', kind: 'talk', text: 'npc.spata.cust2' },
  ],
};
// MZ-WORLD-02d: the district Βόρεια. The gate is the east end of the Σπάτα street (the flag badge_anatolika, defined with the Σπάτα warps).
MAPS.route7 = {
  name: 'map.route7', w: 32, h: 18, music: 'route',
  rows: ROUTE7_ROWS,
  warps: [
    { x: 31, y: 14, to: 'spata', tx: 26, ty: 9 },
    { x: 0, y: 3, to: 'kifisia', tx: 24, ty: 9 },
  ],
  signs: { '29,13': 'sign.route7', '12,7': 'sign.quarry', '2,5': 'sign.kifisia' },
  npcs: [
    { id: 'oldstar', x: 22, y: 13, face: 'down', look: 'oldstar', kind: 'trainer', trainer: 'oldstar', sight: 2 },
    { id: 'gardener', x: 14, y: 7, face: 'down', look: 'gardener', kind: 'trainer', trainer: 'gardener', sight: 2 },
    { id: 'contestant', x: 8, y: 5, face: 'down', look: 'contestant', kind: 'trainer', trainer: 'contestant', sight: 3 },
    { id: 'quarryman', x: 18, y: 3, face: 'down', look: 'oldman', kind: 'talk', text: 'npc.quarryman' },
    { id: 'stonecutter', x: 10, y: 9, face: 'up', look: 'oldman2', kind: 'talk', text: 'npc.stonecutter' },
  ],
  zones: [
    { x0: 0, x1: 15, table: [
      { sp: 'star90', w: 22, min: 27, max: 29 }, { sp: 'fakelarchis', w: 20, min: 27, max: 29 }, { sp: 'efoplistakos', w: 16, min: 27, max: 29 },
      { sp: 'influenza', w: 20, min: 27, max: 29 }, { sp: 'trolosavros', w: 16, min: 27, max: 29 }, { sp: 'nftarchis', w: 10, min: 27, max: 29 }, { sp: 'rialito', w: 6, min: 28, max: 29 }] },
    { x0: 16, x1: 99, table: [
      { sp: 'star90', w: 22, min: 27, max: 28 }, { sp: 'fakelarchis', w: 20, min: 26, max: 28 }, { sp: 'efoplistakos', w: 16, min: 26, max: 28 },
      { sp: 'influenza', w: 20, min: 26, max: 28 }, { sp: 'trolosavros', w: 16, min: 26, max: 28 }, { sp: 'nftarchis', w: 10, min: 26, max: 28 }] },
  ],
};
MAPS.kifisia = {
  name: 'map.kifisia', w: 26, h: 18, music: 'town',
  rows: KIFISIA_ROWS,
  warps: [
    { x: 25, y: 9, to: 'route7', tx: 1, ty: 3 },
    { x: 0, y: 9, to: 'route8', tx: 42, ty: 6 },
    { x: 4, y: 5, to: 'kifisia_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'kifisia_shop', tx: 3, ty: 4 },
    { x: 17, y: 5, to: 'kifisia_cafe', tx: 4, ty: 6 },
  ],
  signs: { '7,5': 'sign.kifisia.hospital', '13,5': 'sign.shop', '20,5': 'sign.kifisia.cafe', '8,8': 'sign.kifisia.town', '23,8': 'sign.ktel', '17,14': 'sign.kifisia.metro' },
  npcs: [
    { id: 'kfwatcher', x: 12, y: 8, face: 'down', look: 'oldwoman', kind: 'talk', text: 'npc.kifisia1' },
    { id: 'kfhedge', x: 9, y: 10, face: 'right', look: 'student', kind: 'talk', text: 'npc.kifisia2' },
    { id: 'kfrich', x: 21, y: 10, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.kifisia3' },
  ],
};
MAPS.kifisia_hospital = {
  name: 'map.kifisia.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'kifisia', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'kifisia', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.kifisia.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'oldwoman', kind: 'talk', text: 'npc.kifisia.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.hosp.wait2' },
  ],
};
MAPS.kifisia_shop = {
  name: 'map.kifisia.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_VOREIA,
  warps: [{ x: 3, y: 5, to: 'kifisia', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'kifisia', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'oldwoman', kind: 'talk', text: 'npc.kifisia.customer' },
  ],
};
// The first Καφενείο of Βόρεια («Ο Πλάτανος»): the save point, with its own greeting (cafeHello).
MAPS.kifisia_cafe = {
  name: 'map.kifisia.cafe', w: 10, h: 8, music: 'indoor',
  rows: MAPS.cafe.rows,
  cafeHello: 'cafe.hello.kifisia',
  warps: [{ x: 4, y: 7, to: 'kifisia', tx: 17, ty: 6 }, { x: 5, y: 7, to: 'kifisia', tx: 17, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'cafeowner', x: 3, y: 1, face: 'down', look: 'cafeowner', kind: 'save' },
    { id: 'kfcafe1', x: 2, y: 4, face: 'right', look: 'oldwoman', kind: 'talk', text: 'npc.kfcafe1' },
    { id: 'kfcafe2', x: 7, y: 6, face: 'up', look: 'student', kind: 'talk', text: 'npc.kfcafe2' },
  ],
};
MAPS.route8 = {
  name: 'map.route8', w: 44, h: 14, music: 'route',
  rows: ROUTE8_ROWS,
  warps: [
    { x: 43, y: 6, to: 'kifisia', tx: 1, ty: 9 },
    { x: 0, y: 6, to: 'marousi', tx: 26, ty: 9 },
  ],
  signs: { '41,4': 'sign.route8', '17,7': 'sign.roundabout', '3,4': 'sign.marousi.road' },
  npcs: [
    { id: 'rival4', x: 34, y: 7, face: 'up', look: 'rival', kind: 'trainer', trainer: 'rival4', sight: 2 },
    { id: 'lobbyist', x: 13, y: 7, face: 'up', look: 'lobbyist', kind: 'trainer', trainer: 'lobbyist', sight: 2 },
    { id: 'tennis', x: 8, y: 9, face: 'up', look: 'tennis', kind: 'trainer', trainer: 'tennis', sight: 3 },
    { id: 'shopper', x: 28, y: 4, face: 'down', look: 'tourist', kind: 'talk', text: 'npc.shopper' },
    { id: 'driver', x: 24, y: 10, face: 'up', look: 'oldman', kind: 'talk', text: 'npc.driver' },
  ],
  zones: [
    { x0: 22, x1: 99, table: [
      { sp: 'star90', w: 22, min: 29, max: 30 }, { sp: 'rialito', w: 20, min: 29, max: 30 }, { sp: 'lobbylykaina', w: 18, min: 29, max: 30 }, { sp: 'influenza', w: 20, min: 29, max: 30 },
      { sp: 'fakelarchis', w: 14, min: 29, max: 29 }, { sp: 'trolosavros', w: 12, min: 29, max: 29 }, { sp: 'nftarchis', w: 8, min: 29, max: 29 }, { sp: 'efoplistakos', w: 8, min: 29, max: 29 }] },
    { x0: 0, x1: 21, table: [
      { sp: 'star90', w: 22, min: 30, max: 31 }, { sp: 'rialito', w: 20, min: 30, max: 31 }, { sp: 'lobbylykaina', w: 20, min: 30, max: 31 }, { sp: 'influenza', w: 20, min: 30, max: 31 },
      { sp: 'giotarchis', w: 6, min: 30, max: 31 }] },
  ],
};
MAPS.marousi = {
  name: 'map.marousi', w: 28, h: 18, music: 'town',
  rows: MAROUSI_ROWS,
  warps: [
    { x: 27, y: 9, to: 'route8', tx: 1, ty: 6 },
    { x: 4, y: 5, to: 'marousi_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'marousi_shop', tx: 3, ty: 4 },
    { x: 20, y: 4, to: 'marousi_boss', tx: 6, ty: 8 },
    { x: 0, y: 9, to: 'route9', tx: 42, ty: 5, needFlag: 'badge_voreia', lockedText: 'warp.route9' }, // MZ-WORLD-02e: the road to Δυτικά opens with the First Row Medal
  ],
  signs: { '7,5': 'sign.marousi.hospital', '13,5': 'sign.shop', '17,5': 'sign.marousi.stadium', '7,8': 'sign.marousi.tennis', '0,8': 'sign.marousi.west', '12,8': 'sign.ktel' },
  npcs: [
    { id: 'usher', x: 20, y: 7, face: 'up', look: 'usher', kind: 'trainer', trainer: 'usher', sight: 3 },
    { id: 'mrwatcher', x: 24, y: 6, face: 'left', look: 'oldman2', kind: 'talk', text: 'npc.marousi1' },
    { id: 'mrfan', x: 16, y: 8, face: 'right', look: 'kid', kind: 'talk', text: 'npc.marousi2' },
    { id: 'mrticket', x: 6, y: 7, face: 'down', look: 'student', kind: 'talk', text: 'npc.marousi3' },
  ],
};
MAPS.marousi_hospital = {
  name: 'map.marousi.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'marousi', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'marousi', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.marousi.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'kid', kind: 'talk', text: 'npc.marousi.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.hosp.wait3' },
  ],
};
MAPS.marousi_shop = {
  name: 'map.marousi.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_VOREIA,
  warps: [{ x: 3, y: 5, to: 'marousi', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'marousi', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'student', kind: 'talk', text: 'npc.marousi.customer' },
  ],
};
// «Στάδιο Συναυλιών 3000»: a stage with speaker stacks, the DJ booth in front of it and the boss on the stage (the Port Office layout).
MAPS.marousi_boss = {
  name: 'map.marousi.boss', w: 14, h: 10, music: 'boss',
  rows: ['wwwwwwwwwwwwww', 'w:;;;;;;;;;;:w', 'w:;;;;;;;;;;:w', 'wfffccccccfffw', 'wffffffffffffw', 'wfrrffffffrrfw', 'wffffffffffffw', 'wfttffffffttfw', 'wffffffffffffw', 'wwwwwwmmwwwwww'],
  warps: [{ x: 6, y: 9, to: 'marousi', tx: 20, ty: 5 }, { x: 7, y: 9, to: 'marousi', tx: 20, ty: 5 }],
  signs: {},
  npcs: [
    { id: 'amartia', x: 6, y: 2, face: 'down', look: 'amartia', kind: 'boss', trainer: 'amartia' },
    { id: 'scust1', x: 2, y: 6, face: 'right', look: 'oldwoman', kind: 'talk', text: 'npc.marousi.cust1' },
    { id: 'scust2', x: 11, y: 6, face: 'left', look: 'student', kind: 'talk', text: 'npc.marousi.cust2' },
  ],
};
// MZ-WORLD-02e: the district Δυτικά. The gate is the west end of the Μαρούσι street (the flag badge_voreia, defined with the Μαρούσι warps).
MAPS.route9 = {
  name: 'map.route9', w: 44, h: 12, music: 'route',
  rows: ROUTE9_ROWS,
  warps: [
    { x: 43, y: 5, to: 'marousi', tx: 1, ty: 9 },
    { x: 0, y: 5, to: 'peristeri', tx: 24, ty: 9 },
  ],
  signs: { '41,2': 'sign.route9', '20,9': 'sign.toll', '2,9': 'sign.peristeri' },
  npcs: [
    { id: 'tollclerk', x: 21, y: 6, face: 'right', look: 'tollclerk', kind: 'trainer', trainer: 'tollclerk', sight: 3 },
    { id: 'ultras', x: 34, y: 9, face: 'up', look: 'ultras', kind: 'trainer', trainer: 'ultras', sight: 3 },
    { id: 'granny', x: 7, y: 2, face: 'down', look: 'granny', kind: 'trainer', trainer: 'granny', sight: 3 },
    { id: 'tollwatcher', x: 27, y: 4, face: 'down', look: 'oldman', kind: 'talk', text: 'npc.tollwatcher' },
    { id: 'hitchhiker', x: 12, y: 6, face: 'right', look: 'student', kind: 'talk', text: 'npc.hitchhiker' },
  ],
  zones: [
    { x0: 22, x1: 99, table: [
      { sp: 'monimos', w: 20, min: 32, max: 34 }, { sp: 'lobbylykaina', w: 20, min: 32, max: 34 }, { sp: 'fakelarchis', w: 18, min: 32, max: 34 }, { sp: 'giotarchis', w: 14, min: 32, max: 34 },
      { sp: 'kafenovios', w: 12, min: 32, max: 34 }, { sp: 'giagiaka', w: 12, min: 32, max: 34 }, { sp: 'monastiriaki', w: 8, min: 32, max: 34 }, { sp: 'eforaki', w: 8, min: 32, max: 34 }] },
    { x0: 0, x1: 21, table: [
      { sp: 'monimos', w: 14, min: 33, max: 35 }, { sp: 'lobbylykaina', w: 14, min: 33, max: 35 }, { sp: 'fakelarchis', w: 12, min: 33, max: 35 }, { sp: 'giotarchis', w: 8, min: 33, max: 34 },
      { sp: 'kafenovios', w: 12, min: 33, max: 35 }, { sp: 'giagiaka', w: 12, min: 33, max: 35 }, { sp: 'monastiriaki', w: 10, min: 33, max: 35 }, { sp: 'eforaki', w: 10, min: 33, max: 35 }] },
  ],
};
MAPS.peristeri = {
  name: 'map.peristeri', w: 26, h: 18, music: 'town',
  rows: PERISTERI_ROWS,
  warps: [
    { x: 25, y: 9, to: 'route9', tx: 1, ty: 5 },
    { x: 0, y: 9, to: 'route10', tx: 34, ty: 8 },
    { x: 4, y: 5, to: 'peristeri_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'peristeri_shop', tx: 3, ty: 4 },
    { x: 17, y: 5, to: 'peristeri_cafe', tx: 4, ty: 6 },
  ],
  signs: { '7,5': 'sign.peristeri.hospital', '13,5': 'sign.shop', '20,5': 'sign.peristeri.cafe', '8,8': 'sign.peristeri.market', '6,10': 'sign.peristeri.pitch', '23,8': 'sign.ktel' },
  npcs: [
    { id: 'psfan', x: 5, y: 13, face: 'right', look: 'ultras', kind: 'talk', text: 'npc.peristeri1' },
    { id: 'psseller', x: 13, y: 8, face: 'up', look: 'marketeer', kind: 'talk', text: 'npc.peristeri2' },
    { id: 'pslaundry', x: 21, y: 8, face: 'up', look: 'oldwoman', kind: 'talk', text: 'npc.peristeri3' },
  ],
};
MAPS.peristeri_hospital = {
  name: 'map.peristeri.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'peristeri', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'peristeri', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.peristeri.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'oldwoman', kind: 'talk', text: 'npc.peristeri.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.hosp.wait2' },
  ],
};
MAPS.peristeri_shop = {
  name: 'map.peristeri.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_DYTIKA,
  warps: [{ x: 3, y: 5, to: 'peristeri', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'peristeri', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'oldman2', kind: 'talk', text: 'npc.peristeri.customer' },
  ],
};
// The first Καφενείο of Δυτικά («Η Γωνιά»): the save point, with its own greeting (cafeHello).
MAPS.peristeri_cafe = {
  name: 'map.peristeri.cafe', w: 10, h: 8, music: 'indoor',
  rows: MAPS.cafe.rows,
  cafeHello: 'cafe.hello.peristeri',
  warps: [{ x: 4, y: 7, to: 'peristeri', tx: 17, ty: 6 }, { x: 5, y: 7, to: 'peristeri', tx: 17, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'cafeowner', x: 3, y: 1, face: 'down', look: 'cafeowner', kind: 'save' },
    { id: 'pscafe1', x: 2, y: 4, face: 'right', look: 'oldman', kind: 'talk', text: 'npc.pscafe1' },
    { id: 'pscafe2', x: 7, y: 6, face: 'up', look: 'kid', kind: 'talk', text: 'npc.pscafe2' },
  ],
};
MAPS.route10 = {
  name: 'map.route10', w: 36, h: 18, music: 'route',
  rows: ROUTE10_ROWS,
  warps: [
    { x: 35, y: 8, to: 'peristeri', tx: 1, ty: 9 },
    { x: 0, y: 8, to: 'chaidari', tx: 26, ty: 9 },
  ],
  signs: { '33,4': 'sign.route10', '2,10': 'sign.channel', '19,11': 'sign.chaidari' },
  npcs: [
    { id: 'marketeer', x: 14, y: 6, face: 'down', look: 'marketeer', kind: 'trainer', trainer: 'marketeer', sight: 2 },
    { id: 'philosopher', x: 26, y: 10, face: 'up', look: 'philosopher', kind: 'trainer', trainer: 'philosopher', sight: 2 },
    { id: 'steward', x: 7, y: 6, face: 'down', look: 'steward', kind: 'trainer', trainer: 'steward', sight: 3 },
    { id: 'stallholder', x: 11, y: 5, face: 'up', look: 'kiosk', kind: 'talk', text: 'npc.stallholder' },
    { id: 'angler', x: 20, y: 12, face: 'down', look: 'fisher', kind: 'talk', text: 'npc.angler' },
  ],
  zones: [
    { x0: 18, x1: 99, table: [
      { sp: 'monimos', w: 12, min: 34, max: 35 }, { sp: 'lobbylykaina', w: 12, min: 34, max: 35 }, { sp: 'fakelarchis', w: 10, min: 34, max: 35 },
      { sp: 'kafenovios', w: 12, min: 34, max: 35 }, { sp: 'giagiaka', w: 12, min: 34, max: 36 }, { sp: 'monastiriaki', w: 10, min: 34, max: 35 }, { sp: 'eforaki', w: 8, min: 34, max: 35 }] },
    { x0: 0, x1: 17, table: [
      { sp: 'tavlilordos', w: 14, min: 36, max: 37 }, { sp: 'ktimatomesitis', w: 14, min: 36, max: 37 }, { sp: 'giagiaexo', w: 10, min: 37, max: 37 },
      { sp: 'lobbylykaina', w: 10, min: 35, max: 37 }, { sp: 'monimos', w: 10, min: 35, max: 36 }, { sp: 'fakelarchis', w: 10, min: 35, max: 37 }, { sp: 'giagiaka', w: 10, min: 35, max: 36 },
      { sp: 'elegktis', w: 8, min: 36, max: 37 }, { sp: 'rousfetolykos', w: 8, min: 35, max: 37 }] },
  ],
};
MAPS.chaidari = {
  name: 'map.chaidari', w: 28, h: 18, music: 'town',
  rows: CHAIDARI_ROWS,
  warps: [
    { x: 27, y: 9, to: 'route10', tx: 1, ty: 8 },
    { x: 4, y: 5, to: 'chaidari_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'chaidari_shop', tx: 3, ty: 4 },
    { x: 20, y: 4, to: 'chaidari_boss', tx: 5, ty: 8 },
    { x: 0, y: 9, to: 'route11', tx: 1, ty: 6, needFlag: 'badge_dytika', lockedText: 'warp.route11' }, // MZ-WORLD-02f: the old road to Αθήνα opens with the Tax-Free Medal
  ],
  signs: { '7,5': 'sign.chaidari.hospital', '13,5': 'sign.shop', '13,4': 'sign.chaidari.monastery', '13,7': 'sign.chaidari.carpark', '0,8': 'sign.chaidari.west', '12,8': 'sign.ktel' },
  npcs: [
    { id: 'gatekeeper', x: 20, y: 7, face: 'up', look: 'gatekeeper', kind: 'trainer', trainer: 'gatekeeper', sight: 3 },
    { id: 'chattendant', x: 19, y: 8, face: 'right', look: 'oldman2', kind: 'talk', text: 'npc.chaidari1' },
    { id: 'chstudent', x: 8, y: 8, face: 'right', look: 'student', kind: 'talk', text: 'npc.chaidari2' },
    { id: 'chneighbour', x: 22, y: 10, face: 'up', look: 'oldwoman', kind: 'talk', text: 'npc.chaidari3' },
  ],
};
MAPS.chaidari_hospital = {
  name: 'map.chaidari.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'chaidari', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'chaidari', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.chaidari.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'student', kind: 'talk', text: 'npc.chaidari.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.hosp.wait2' },
  ],
};
MAPS.chaidari_shop = {
  name: 'map.chaidari.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_DYTIKA,
  warps: [{ x: 3, y: 5, to: 'chaidari', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'chaidari', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'oldwoman', kind: 'talk', text: 'npc.chaidari.customer' },
  ],
};
// «Μονή Αφορολογήτου»: the office of the owner of the car park (the Port Office layout): a counter with the abbot behind it, ledger shelves, rugs and tables. No icon, no cross.
MAPS.chaidari_boss = {
  name: 'map.chaidari.boss', w: 12, h: 10, music: 'boss',
  rows: ['wwwwwwwwwwww', 'whhffffffhhw', 'wffffffffffw', 'wfffccccfffw', 'wffffffffffw', 'wfrrffffrrfw', 'wffffffffffw', 'wfttffffttfw', 'wffffffffffw', 'wwwwwmmwwwww'],
  warps: [{ x: 5, y: 9, to: 'chaidari', tx: 20, ty: 5 }, { x: 6, y: 9, to: 'chaidari', tx: 20, ty: 5 }],
  signs: {},
  npcs: [
    { id: 'plousiakis', x: 5, y: 2, face: 'down', look: 'plousiakis', kind: 'boss', trainer: 'plousiakis' },
    { id: 'mcust1', x: 2, y: 6, face: 'right', look: 'oldwoman', kind: 'talk', text: 'npc.chaidari.cust1' },
    { id: 'mcust2', x: 9, y: 6, face: 'left', look: 'student', kind: 'talk', text: 'npc.chaidari.cust2' },
  ],
};
// MZ-WORLD-02f: the district Αθήνα. The gate is the west end of the Χαϊδάρι street (the flag badge_dytika, defined with the Χαϊδάρι warps).
MAPS.route11 = {
  name: 'map.route11', w: 36, h: 14, music: 'route',
  rows: ROUTE11_ROWS,
  warps: [
    { x: 0, y: 6, to: 'chaidari', tx: 1, ty: 9 },
    { x: 35, y: 6, to: 'monastiraki', tx: 1, ty: 9 },
  ],
  signs: { '3,5': 'sign.route11', '8,5': 'sign.dig', '25,8': 'sign.stumps' },
  npcs: [
    { id: 'clerk', x: 12, y: 4, face: 'down', look: 'ministryclerk', kind: 'trainer', trainer: 'clerk', sight: 3 },
    { id: 'guide', x: 26, y: 8, face: 'up', look: 'guide', kind: 'trainer', trainer: 'guide', sight: 3 },
    { id: 'digger', x: 8, y: 8, face: 'up', look: 'oldman2', kind: 'talk', text: 'npc.digger' },
    { id: 'roadtourist', x: 17, y: 9, face: 'left', look: 'tourist', kind: 'talk', text: 'npc.roadtourist' },
  ],
  zones: [
    { x0: 0, x1: 17, table: [
      { sp: 'monimos', w: 14, min: 38, max: 40 }, { sp: 'elegktis', w: 12, min: 38, max: 40 }, { sp: 'rousfetolykos', w: 12, min: 38, max: 40 }, { sp: 'lobbylykaina', w: 14, min: 38, max: 40 },
      { sp: 'tavlilordos', w: 12, min: 38, max: 40 }, { sp: 'giagiaexo', w: 12, min: 38, max: 40 }, { sp: 'star90', w: 14, min: 38, max: 40 }] },
    { x0: 18, x1: 99, table: [
      { sp: 'monimos', w: 14, min: 39, max: 41 }, { sp: 'elegktis', w: 12, min: 39, max: 41 }, { sp: 'rousfetolykos', w: 12, min: 39, max: 41 }, { sp: 'lobbylykaina', w: 14, min: 39, max: 41 },
      { sp: 'tavlilordos', w: 12, min: 39, max: 41 }, { sp: 'giagiaexo', w: 12, min: 39, max: 41 }, { sp: 'star90', w: 14, min: 39, max: 41 }] },
  ],
};
MAPS.monastiraki = {
  name: 'map.monastiraki', w: 26, h: 18, music: 'town',
  rows: MONASTIRAKI_ROWS,
  warps: [
    { x: 0, y: 9, to: 'route11', tx: 34, ty: 6 },
    { x: 25, y: 9, to: 'route12', tx: 1, ty: 8 },
    { x: 4, y: 5, to: 'monastiraki_hospital', tx: 5, ty: 7 },
    { x: 10, y: 5, to: 'monastiraki_shop', tx: 3, ty: 4 },
    { x: 17, y: 5, to: 'monastiraki_cafe', tx: 4, ty: 6 },
    { x: 22, y: 1, to: 'rock', tx: 10, ty: 14 },
  ],
  signs: { '7,5': 'sign.monastiraki.hospital', '13,5': 'sign.shop', '20,5': 'sign.monastiraki.cafe', '23,6': 'sign.monastiraki.rock', '6,8': 'sign.monastiraki.market', '12,11': 'sign.monastiraki.clock', '23,8': 'sign.ktel' },
  npcs: [
    { id: 'porter', x: 10, y: 8, face: 'down', look: 'porter', kind: 'trainer', trainer: 'porter', sight: 2 },
    { id: 'mnstall', x: 14, y: 8, face: 'up', look: 'marketeer', kind: 'talk', text: 'npc.monastiraki1' },
    { id: 'mnwoman', x: 19, y: 8, face: 'left', look: 'oldwoman', kind: 'talk', text: 'npc.monastiraki2' },
    { id: 'mnkid', x: 8, y: 10, face: 'up', look: 'kid', kind: 'talk', text: 'npc.monastiraki3' },
  ],
};
MAPS.monastiraki_hospital = {
  name: 'map.monastiraki.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'monastiraki', tx: 4, ty: 6 }, { x: 6, y: 8, to: 'monastiraki', tx: 4, ty: 6 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.monastiraki.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'tourist', kind: 'talk', text: 'npc.monastiraki.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.hosp.wait2' },
  ],
};
MAPS.monastiraki_shop = {
  name: 'map.monastiraki.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_DYTIKA,
  warps: [{ x: 3, y: 5, to: 'monastiraki', tx: 10, ty: 6 }, { x: 4, y: 5, to: 'monastiraki', tx: 10, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'tourist', kind: 'talk', text: 'npc.monastiraki.customer' },
  ],
};
// The first Καφενείο of Αθήνα («Το Παζάρι»): the save point, with its own greeting (cafeHello).
MAPS.monastiraki_cafe = {
  name: 'map.monastiraki.cafe', w: 10, h: 8, music: 'indoor',
  rows: MAPS.cafe.rows,
  cafeHello: 'cafe.hello.monastiraki',
  warps: [{ x: 4, y: 7, to: 'monastiraki', tx: 17, ty: 6 }, { x: 5, y: 7, to: 'monastiraki', tx: 17, ty: 6 }],
  signs: {},
  npcs: [
    { id: 'cafeowner', x: 3, y: 1, face: 'down', look: 'cafeowner', kind: 'save' },
    { id: 'mncafe1', x: 2, y: 4, face: 'right', look: 'oldman', kind: 'talk', text: 'npc.mncafe1' },
    { id: 'mncafe2', x: 7, y: 6, face: 'up', look: 'student', kind: 'talk', text: 'npc.mncafe2' },
  ],
};
// The Rock: the legend of the hill. The Φορολογούμενος stands on the top terrace in front of the temple (a fixed encounter: kind 'legend', gone once beaten or recruited).
MAPS.rock = {
  name: 'map.rock', w: 20, h: 16, music: 'route',
  rows: ROCK_ROWS,
  warps: [{ x: 10, y: 15, to: 'monastiraki', tx: 22, ty: 2 }],
  signs: { '8,7': 'sign.rock.path', '13,12': 'sign.rock.ticket', '12,4': 'sign.rock.scaffold' },
  npcs: [
    { id: 'taxpayer', x: 9, y: 5, face: 'down', look: 'taxpayerman', kind: 'legend', species: 'taxpayer', level: 40, boost: 1.55, hideFlag: 'legend_taxpayer' },
    { id: 'rockguide', x: 14, y: 5, face: 'left', look: 'guide', kind: 'talk', text: 'npc.rock.guide' },
    { id: 'rocktourist', x: 6, y: 5, face: 'right', look: 'tourist', kind: 'talk', text: 'npc.rock.tourist' },
    { id: 'rockticket', x: 11, y: 12, face: 'right', look: 'kiosk', kind: 'talk', text: 'npc.rock.ticket' },
  ],
};
MAPS.route12 = {
  name: 'map.route12', w: 40, h: 16, music: 'route',
  rows: ROUTE12_ROWS,
  warps: [
    { x: 0, y: 8, to: 'monastiraki', tx: 24, ty: 9 },
    { x: 39, y: 8, to: 'syntagma', tx: 1, ty: 10 },
  ],
  signs: { '1,6': 'sign.route12', '25,5': 'sign.omonia', '11,11': 'sign.avenue.market', '30,12': 'sign.avenue.shops' },
  npcs: [
    { id: 'student', x: 31, y: 11, face: 'up', look: 'student', kind: 'trainer', trainer: 'student', sight: 2 },
    { id: 'busker', x: 27, y: 5, face: 'down', look: 'busker', kind: 'trainer', trainer: 'busker', sight: 2 },
    { id: 'rival5', x: 35, y: 7, face: 'down', look: 'rival', kind: 'trainer', trainer: 'rival5', sight: 2 },
    { id: 'avmarket', x: 24, y: 11, face: 'up', look: 'marketeer', kind: 'talk', text: 'npc.avenue1' },
    { id: 'avpigeon', x: 21, y: 6, face: 'right', look: 'oldwoman', kind: 'talk', text: 'npc.avenue2' },
  ],
  zones: [
    { x0: 0, x1: 19, table: [
      { sp: 'monimos', w: 12, min: 40, max: 41 }, { sp: 'elegktis', w: 12, min: 40, max: 41 }, { sp: 'rousfetolykos', w: 12, min: 40, max: 41 }, { sp: 'lobbylykaina', w: 12, min: 40, max: 41 },
      { sp: 'tavlilordos', w: 12, min: 40, max: 41 }, { sp: 'giagiaexo', w: 12, min: 40, max: 41 }, { sp: 'star90', w: 12, min: 40, max: 41 },
      { sp: 'ktimatomesitis', w: 6, min: 40, max: 42 }, { sp: 'giotarchis', w: 10, min: 40, max: 42 }, { sp: 'influenza', w: 10, min: 40, max: 42 }] },
    { x0: 20, x1: 99, table: [
      { sp: 'monimos', w: 8, min: 40, max: 41 }, { sp: 'elegktis', w: 8, min: 40, max: 41 }, { sp: 'rousfetolykos', w: 8, min: 40, max: 41 }, { sp: 'lobbylykaina', w: 8, min: 40, max: 41 },
      { sp: 'tavlilordos', w: 8, min: 40, max: 41 }, { sp: 'giagiaexo', w: 8, min: 40, max: 41 }, { sp: 'star90', w: 8, min: 40, max: 41 },
      { sp: 'ktimatomesitis', w: 6, min: 41, max: 43 }, { sp: 'giotarchis', w: 12, min: 41, max: 43 }, { sp: 'influenza', w: 12, min: 41, max: 43 }] },
  ],
};
MAPS.lycabettus = {
  name: 'map.lycabettus', w: 20, h: 16, music: 'route',
  rows: LYCABETTUS_ROWS,
  warps: [{ x: 10, y: 15, to: 'syntagma', tx: 28, ty: 6 }],
  signs: { '9,14': 'sign.hill.path', '13,7': 'sign.hill.funicular', '6,3': 'sign.hill.view' },
  npcs: [
    { id: 'inspector', x: 7, y: 7, face: 'down', look: 'inspector', kind: 'trainer', trainer: 'inspector', sight: 2 },
    { id: 'viewman', x: 12, y: 3, face: 'up', look: 'oldman', kind: 'talk', text: 'npc.hill.view' },
    { id: 'hillkid', x: 8, y: 10, face: 'up', look: 'kid', kind: 'talk', text: 'npc.hill.kid' },
  ],
  zones: [
    { x0: 0, x1: 99, table: [
      { sp: 'star90', w: 14, min: 40, max: 41 }, { sp: 'lobbylykaina', w: 14, min: 40, max: 41 }, { sp: 'rousfetolykos', w: 12, min: 40, max: 41 },
      { sp: 'giotarchis', w: 14, min: 41, max: 43 }, { sp: 'influenza', w: 14, min: 41, max: 43 }, { sp: 'ktimatomesitis', w: 6, min: 41, max: 43 }] },
  ],
};
MAPS.syntagma = {
  name: 'map.syntagma', w: 30, h: 20, music: 'town',
  rows: SYNTAGMA_ROWS,
  warps: [
    { x: 0, y: 10, to: 'route12', tx: 38, ty: 8 },
    { x: 3, y: 4, to: 'syntagma_hospital', tx: 5, ty: 7 },
    { x: 25, y: 4, to: 'syntagma_shop', tx: 3, ty: 4 },
    { x: 29, y: 6, to: 'lycabettus', tx: 10, ty: 14 },
    { x: 14, y: 4, to: 'parliament_lobby', tx: 6, ty: 8, needFlag: 'badge_athina', lockedText: 'warp.parliament' }, // MZ-WORLD-02g: the door of the Βουλή opens with the sixth badge
  ],
  signs: { '6,4': 'sign.syntagma.hospital', '23,4': 'sign.shop', '11,5': 'sign.syntagma.parliament', '23,10': 'sign.syntagma.metro', '27,5': 'sign.syntagma.hill', '12,11': 'sign.ktel' },
  npcs: [
    { id: 'baboulas', x: 15, y: 9, face: 'down', look: 'baboulas', kind: 'boss', trainer: 'baboulas' },
    { id: 'cadet', x: 10, y: 12, face: 'right', look: 'cadet', kind: 'trainer', trainer: 'cadet', sight: 3 },
    { id: 'sypigeon', x: 18, y: 12, face: 'up', look: 'oldwoman', kind: 'talk', text: 'npc.syntagma1' },
    { id: 'sytourist', x: 22, y: 8, face: 'left', look: 'tourist', kind: 'talk', text: 'npc.syntagma2' },
    { id: 'syvanman', x: 7, y: 12, face: 'down', look: 'oldman2', kind: 'talk', text: 'npc.syntagma3' },
  ],
};
MAPS.syntagma_hospital = {
  name: 'map.syntagma.hospital', w: 12, h: 9, music: 'indoor',
  rows: MAPS.hospital.rows,
  warps: [{ x: 5, y: 8, to: 'syntagma', tx: 3, ty: 5 }, { x: 6, y: 8, to: 'syntagma', tx: 3, ty: 5 }],
  signs: { '10,3': 'sign.hosp.vending', '5,3': 'sign.hosp.tv' },
  actions: { '1,3': 'archive' },
  npcs: [
    { id: 'hospreception', x: 4, y: 1, face: 'down', look: 'reception', kind: 'heal' },
    { id: 'hospdoctor', x: 7, y: 1, face: 'down', look: 'doctor', kind: 'talk', text: 'npc.syntagma.doctor' },
    { id: 'hospwait1', x: 3, y: 4, face: 'down', look: 'oldwoman', kind: 'talk', text: 'npc.syntagma.wait1' },
    { id: 'hospwait2', x: 8, y: 5, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.hosp.wait2' },
  ],
};
MAPS.syntagma_shop = {
  name: 'map.syntagma.shop', w: 8, h: 6, music: 'indoor',
  rows: MAPS.shop.rows,
  stock: SHOP_STOCK_DYTIKA,
  warps: [{ x: 3, y: 5, to: 'syntagma', tx: 25, ty: 5 }, { x: 4, y: 5, to: 'syntagma', tx: 25, ty: 5 }],
  signs: {},
  npcs: [
    { id: 'shopkeeper', x: 3, y: 1, face: 'down', look: 'kiosk', kind: 'shop' },
    { id: 'customer', x: 5, y: 4, face: 'up', look: 'oldman2', kind: 'talk', text: 'npc.syntagma.customer' },
  ],
};
// MZ-WORLD-02g: the Βουλή (the door on the square of Σύνταγμα, flag badge_athina). The lobby (14 x 10) has the doctor who heals between the fights, the queue and the security gate joke and the
// doors of the four chambers: the chamber of Ευτέρπη opens at once, each next one when the fight before it is won (t_euterpe, t_minister, t_rival6). Three chambers of 12 x 9, the plenary hall
// of 16 x 12 with the last fight, and the roof of 10 x 8 that opens with the flag ending (set by the credits). No hospital, no healing inside a chamber.
const PARLIAMENT_LOBBY_ROWS = [
  'wwΞwwΞwwΞwwΞww',
  'wΔΔΔΔΔΔΔΔΔΔΔΔw',
  'wΔΔΔΔΔrrΔΔΔΔhw',
  'wΔΔΔΔΔrrΔΔΔΔΔw',
  'wcccΔΔrrΔΔΔΔΔw',
  'wΔΔΔΔΔrrΔΔΔΔΔw',
  'wΔΔΔΔΔrrΔΔΔΔΔw',
  'wΔΔΔΔΔrrΔΔtΔΔw',
  'wΔhΔΔΔrrΔΔΔhΔw',
  'wwwwwwmmwwwwww',
];
const PARLIAMENT_CHAMBER1_ROWS = [
  'wwwwwwwwwwww', 'whhfffffffhw', 'wfffccccfffw', 'wffffffffffw', 'wffffrrffffw', 'wfttffffttfw', 'wffffrrffffw', 'wffffrrffffw', 'wwwwwΞΞwwwww',
];
const PARLIAMENT_CHAMBER2_ROWS = [
  'wwwwwwwwwwww', 'w::;;;;;;::w', 'w;;;;;;;;;;w', 'w;;cc;;cc;;w', 'wffffffffffw', 'wfKffffffKfw', 'wffffrrffffw', 'wffffrrffffw', 'wwwwwΞΞwwwww',
];
const PARLIAMENT_CHAMBER3_ROWS = [
  'wwwwwwwwwwww', 'whhfffffffhw', 'wffffffffffw', 'wfrrrrrrrrfw', 'wfrrrrrrrrfw', 'wfΘΘffffΘΘfw', 'wffffffffffw', 'wffffffffffw', 'wwwwwΞΞwwwww',
];
const PARLIAMENT_PLENARY_ROWS = [
  'wwwwwwwwwwwwwwΞw',
  'wΔΔΔΔΔΔΔΔΔΔΔΔΔΔw',
  'wΔΔΔΔΔΦΦΦΦΔΔΔΔΔw',
  'wΔΔΔΔΔΔΔΔΔΔΔΔΔΔw',
  'wΔΘΘΘΘΔrrΔΘΘΘΘΔw',
  'wΔΔΔΔΔΔrrΔΔΔΔΔΔw',
  'wΔΘΘΘΘΔrrΔΘΘΘΘΔw',
  'wΔΔΔΔΔΔrrΔΔΔΔΔΔw',
  'wΔΘΘΘΘΔrrΔΘΘΘΘΔw',
  'wΔΔΔΔΔΔrrΔΔΔΔΔΔw',
  'wΔΔΔΔΔΔrrΔΔΔΔΔΔw',
  'wwwwwwwΞΞwwwwwww',
];
const PARLIAMENT_ROOF_ROWS = [
  'FFFFFFFFFF', 'F````````F', 'F````ccc`F', 'F````````F', 'F`tt`````F', 'F````````F', 'F````````F', 'FFFFΞΞFFFF',
];
MAPS.parliament_lobby = {
  name: 'map.parliament.lobby', w: 14, h: 10, music: 'indoor',
  rows: PARLIAMENT_LOBBY_ROWS,
  warps: [
    { x: 6, y: 9, to: 'syntagma', tx: 14, ty: 5 }, { x: 7, y: 9, to: 'syntagma', tx: 14, ty: 5 },
    { x: 2, y: 0, to: 'parliament_c1', tx: 5, ty: 7 },
    { x: 5, y: 0, to: 'parliament_c2', tx: 5, ty: 7, needFlag: 't_euterpe', lockedText: 'warp.parliament.c2' },
    { x: 8, y: 0, to: 'parliament_c3', tx: 5, ty: 7, needFlag: 't_minister', lockedText: 'warp.parliament.c3' },
    { x: 11, y: 0, to: 'parliament_plenary', tx: 7, ty: 10, needFlag: 't_rival6', lockedText: 'warp.parliament.plenary' },
  ],
  signs: { '3,0': 'sign.parliament.c1', '6,0': 'sign.parliament.c2', '9,0': 'sign.parliament.c3', '12,0': 'sign.parliament.plenary', '12,2': 'sign.parliament.queue', '10,7': 'sign.parliament.table' },
  npcs: [
    { id: 'lobbydoctor', x: 2, y: 3, face: 'down', look: 'doctor', kind: 'heal', healKeys: { hello: 'lobby.hello', free: 'lobby.free', atOnce: 'lobby.atOnce', done: 'lobby.done' } },
    { id: 'lobbyguard', x: 8, y: 8, face: 'left', look: 'usher', kind: 'talk', text: 'npc.parliament.guard' },
    { id: 'lobbyq1', x: 12, y: 3, face: 'up', look: 'tourist', kind: 'talk', text: 'npc.parliament.q1' },
    { id: 'lobbyq2', x: 12, y: 4, face: 'up', look: 'oldwoman', kind: 'talk', text: 'npc.parliament.q2' },
    { id: 'lobbyq3', x: 12, y: 5, face: 'up', look: 'student', kind: 'talk', text: 'npc.parliament.q3' },
  ],
};
MAPS.parliament_c1 = {
  name: 'map.parliament.c1', w: 12, h: 9, music: 'boss',
  rows: PARLIAMENT_CHAMBER1_ROWS,
  warps: [{ x: 5, y: 8, to: 'parliament_lobby', tx: 2, ty: 1 }, { x: 6, y: 8, to: 'parliament_lobby', tx: 2, ty: 1 }],
  signs: { '1,1': 'sign.parliament.c1.shelf', '7,2': 'sign.parliament.c1.stamps' },
  npcs: [
    { id: 'euterpe', x: 5, y: 3, face: 'down', look: 'euterpe', kind: 'boss', trainer: 'euterpe' },
    { id: 'c1clerk1', x: 2, y: 6, face: 'right', look: 'ministryclerk', kind: 'talk', text: 'npc.parliament.c1.clerk1' },
    { id: 'c1clerk2', x: 9, y: 6, face: 'left', look: 'inspector', kind: 'talk', text: 'npc.parliament.c1.clerk2' },
  ],
};
MAPS.parliament_c2 = {
  name: 'map.parliament.c2', w: 12, h: 9, music: 'boss',
  rows: PARLIAMENT_CHAMBER2_ROWS,
  warps: [{ x: 5, y: 8, to: 'parliament_lobby', tx: 5, ty: 1 }, { x: 6, y: 8, to: 'parliament_lobby', tx: 5, ty: 1 }],
  signs: { '2,1': 'sign.parliament.c2.air', '9,5': 'sign.parliament.c2.cases' },
  npcs: [
    { id: 'minister', x: 5, y: 3, face: 'down', look: 'ministerman', kind: 'boss', trainer: 'minister' },
    { id: 'c2host', x: 3, y: 5, face: 'right', look: 'host', kind: 'talk', text: 'npc.parliament.c2.host' },
    { id: 'c2camera', x: 8, y: 6, face: 'up', look: 'oldman2', kind: 'talk', text: 'npc.parliament.c2.camera' },
  ],
};
MAPS.parliament_c3 = {
  name: 'map.parliament.c3', w: 12, h: 9, music: 'boss',
  rows: PARLIAMENT_CHAMBER3_ROWS,
  warps: [{ x: 5, y: 8, to: 'parliament_lobby', tx: 8, ty: 1 }, { x: 6, y: 8, to: 'parliament_lobby', tx: 8, ty: 1 }],
  signs: { '1,1': 'sign.parliament.c3.phones', '2,5': 'sign.parliament.c3.sofa' },
  npcs: [
    { id: 'rival6', x: 5, y: 3, face: 'down', look: 'rival', kind: 'trainer', trainer: 'rival6', sight: 3 },
    { id: 'c3aide', x: 9, y: 6, face: 'left', look: 'lobbyist', kind: 'talk', text: 'npc.parliament.c3.aide' },
  ],
};
// The plenary hall: benches in blocks on both sides of a carpet aisle, the speaker's podium at the back, the door to the roof in the top right corner. Ο Υφυπουργός Παντός stands in front
// of the podium with his assistant; once the credits have rolled (the flag ending) they and the members are gone and Ηλιθιοκρατία stands there alone.
MAPS.parliament_plenary = {
  name: 'map.parliament.plenary', w: 16, h: 12, music: 'boss',
  rows: PARLIAMENT_PLENARY_ROWS,
  warps: [
    { x: 7, y: 11, to: 'parliament_lobby', tx: 11, ty: 1 }, { x: 8, y: 11, to: 'parliament_lobby', tx: 11, ty: 1 },
    { x: 14, y: 0, to: 'parliament_roof', tx: 4, ty: 6, needFlag: 'ending', lockedText: 'warp.parliament.roof' },
  ],
  signs: { '6,2': 'sign.plenary.podium', '2,4': 'sign.plenary.bench', '13,0': 'sign.plenary.roof' },
  npcs: [
    { id: 'undersec', x: 7, y: 3, face: 'down', look: 'undersec', kind: 'boss', trainer: 'undersec', hideFlag: 'ending' },
    { id: 'undersecaide', x: 8, y: 3, face: 'down', look: 'steward', kind: 'talk', text: 'npc.plenary.aide', hideFlag: 'ending' },
    { id: 'plenarymp1', x: 3, y: 5, face: 'down', look: 'oldman2', kind: 'talk', text: 'npc.plenary.mp1', hideFlag: 'ending' },
    { id: 'plenarymp2', x: 12, y: 7, face: 'left', look: 'oldman', kind: 'talk', text: 'npc.plenary.mp2', hideFlag: 'ending' },
    { id: 'ilithiokratia', x: 7, y: 3, face: 'down', look: 'fusedmp', kind: 'legend', species: 'ilithiokratia', level: 50, boost: 1.35, showFlag: 'ending', hideFlag: 'legend_ilithiokratia' },
  ],
};
// The roof: the epilogue. A café counter that saves the game (so the end can be kept), a table, three people who stayed, a fence all round, and the stairs down to the plenary hall.
MAPS.parliament_roof = {
  name: 'map.parliament.roof', w: 10, h: 8, music: 'town',
  rows: PARLIAMENT_ROOF_ROWS,
  cafeHello: 'cafe.hello.roof',
  warps: [{ x: 4, y: 7, to: 'parliament_plenary', tx: 14, ty: 1 }, { x: 5, y: 7, to: 'parliament_plenary', tx: 14, ty: 1 }],
  signs: { '1,0': 'sign.roof.view', '8,0': 'sign.roof.antenna' },
  npcs: [
    { id: 'roofcafe', x: 6, y: 1, face: 'down', look: 'cafeowner', kind: 'save' },
    { id: 'roofeuterpe', x: 2, y: 3, face: 'right', look: 'euterpe', kind: 'talk', text: 'npc.roof.euterpe' },
    { id: 'roofminister', x: 7, y: 4, face: 'left', look: 'ministerman', kind: 'talk', text: 'npc.roof.minister' },
    { id: 'roofrival', x: 3, y: 5, face: 'up', look: 'rival', kind: 'talk', text: 'npc.roof.rival' },
  ],
};
const START_MAP = { map: 'lab', x: 4, y: 6, dir: 'up' };
const HOSPITAL_SPOT = { map: 'hospital', x: 5, y: 7, dir: 'up' }; // just inside the hospital door
const DEFAULT_HEAL_SPOT = HOSPITAL_SPOT; // the black-out spot before any heal (after one, save.lastHeal: the last hospital that healed you)

function tileAt(map, x, y) {
  if (y < 0 || y >= map.h || x < 0 || x >= map.w) return ' ';
  return map.rows[y][x];
}
function tileDef(map, x, y) { return TILE_DEFS[tileAt(map, x, y)] || { solid: true }; }
function npcVisible(npc, flags) {
  if (npc.showFlag && !flags[npc.showFlag]) return false;
  if (npc.hideFlag && flags[npc.hideFlag]) return false;
  if (npc.kind === 'trainer' && npc.trainer === 'rival2' && flags.t_rival2) return false; // he leaves after the second fight
  if (npc.kind === 'trainer' && npc.trainer === 'rival3' && flags.t_rival3) return false; // and after the third
  if (npc.kind === 'trainer' && npc.trainer === 'rival4' && flags.t_rival4) return false; // and after the fourth
  if (npc.kind === 'trainer' && npc.trainer === 'rival5' && flags.t_rival5) return false; // and after the fifth
  return true;
}
function findWarp(map, x, y) {
  for (const warp of map.warps) if (warp.x === x && warp.y === y) return warp;
  return null;
}
function warpOpen(warp, flags) { return !warp.needFlag || !!flags[warp.needFlag]; }
function npcAtTile(map, x, y, flags) {
  for (const npc of map.npcs) if (npc.x === x && npc.y === y && npcVisible(npc, flags)) return npc;
  return null;
}
function tileWalkable(map, x, y, flags) {
  if (tileDef(map, x, y).solid) return false;
  if (npcAtTile(map, x, y, flags)) return false;
  const warp = findWarp(map, x, y);
  if (warp && !warpOpen(warp, flags)) return false;
  return true;
}
function zoneAt(map, x) {
  for (const zone of map.zones || []) if (x >= zone.x0 && x <= zone.x1) return zone;
  return null;
}
// Returns { sp, lv } for a wild encounter, or null. Uses the seeded RNG only.
function rollEncounter(rng, map, x, y) {
  if (!tileDef(map, x, y).grass) return null;
  if (rng() >= ENCOUNTER_CHANCE) return null;
  const zone = zoneAt(map, x);
  if (!zone) return null;
  const entry = pickWeighted(rng, zone.table);
  return { sp: entry.sp, lv: randInt(rng, entry.min, entry.max) };
}
// Reachability helper: every (map, x, y) a player can walk to from a start, following warps.
// flags: story flags (gated doors open when their flag is set).
function reachableTiles(startMap, startX, startY, flags) {
  const seen = new Set();
  const queue = [[startMap, startX, startY]];
  seen.add(startMap + ':' + startX + ':' + startY);
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const [mapId, x, y] = queue.shift();
    const map = MAPS[mapId];
    for (const [dx, dy] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (!tileWalkable(map, nx, ny, flags)) continue;
      const key = mapId + ':' + nx + ':' + ny;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([mapId, nx, ny]);
      const warp = findWarp(map, nx, ny);
      if (warp) {
        const targetKey = warp.to + ':' + warp.tx + ':' + warp.ty;
        if (!seen.has(targetKey)) { seen.add(targetKey); queue.push([warp.to, warp.tx, warp.ty]); }
      }
    }
  }
  return seen;
}
// Can the player stand somewhere that lets them talk to this NPC (directly or across a counter)?
function npcTalkable(mapId, npc, reached) {
  const map = MAPS[mapId];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ax = npc.x + dx;
    const ay = npc.y + dy;
    if (reached.has(mapId + ':' + ax + ':' + ay)) return true;
    if (tileDef(map, ax, ay).counter && reached.has(mapId + ':' + (ax + dx) + ':' + (ay + dy))) return true;
  }
  return false;
}

