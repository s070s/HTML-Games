// World map generator (MZ-WORLD-01): draws the schematic of the six districts and writes Mizamon/docs/world-map.png.
// Usage: node Mizamon/tools/world-map.mjs          (writes the PNG)
//        node Mizamon/tools/world-map.mjs --ascii  (prints the 30 x 15 district grid used in REFERENCE-mizamon.md)
// Node built-ins only (fs, zlib, path, url). The map is an abstraction of Attica, not a scale drawing; it is original art
// made of rectangles, lines and small pixel glyphs. The grid is 30 x 15 cells of 8 px = 240 x 120 px, the same data the
// in-game map screen (MZ-MAP-01) will use; the PNG adds a 16 px legend and is scaled x4 with nearest neighbour.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CELL = 8;
const COLS = 30;
const ROWS = 15;
const LEGEND_HEIGHT = 16;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL + LEGEND_HEIGHT;
const SCALE = 4;

// ---- The district grid ------------------------------------------------------------------------------------------
// Rectangles are applied in order; a later rectangle overrides an earlier one. Letters: P Peiraias, D Dytika, A Athina,
// V Voreia, N Notia, E Anatolika. '~' is sea, '#' is mainland outside the six districts (north of Parnitha, the Marathon
// coast). Lower case marks a hill or mountain cell of that district.
const DISTRICT_RECTS = [
  ['V', 9, 0, 21, 5], ['D', 2, 1, 8, 7], ['A', 9, 6, 16, 10], ['P', 1, 8, 8, 12], ['N', 9, 11, 16, 13],
  ['E', 19, 2, 28, 5], ['E', 17, 6, 28, 13], ['D', 5, 0, 8, 0], ['P', 2, 13, 6, 13],
];
const HILL_CELLS = [
  [5, 0], [6, 0], [7, 0], [8, 0], [6, 1], [7, 1], // Parnitha, north-west
  [17, 0], [18, 0], [19, 0], [20, 0], [18, 1], [19, 1], [20, 1], // Penteli, north-east
  [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [3, 3], // Aigaleo ridge, west edge of the west
  [17, 6], [17, 7], [17, 8], [17, 9], [18, 7], [18, 8], [18, 9], // Hymettus, east of the centre
  [17, 10], [17, 11], [17, 12], // the southern end of the Hymettus ridge: the pass of route 5 crosses it
  [15, 6], [16, 6], // Lycabettus, north-east of the centre square
  [11, 10], // the rock with the ancient temple
  [6, 11], // the Munychia hill, Kastella
];
// Real sea: the Aegean (east edge), the Saronic Gulf (south and west of Peiraias), the Elefsina bay (west of the Aigaleo ridge).
const SEA_CELLS = (x, y) => x === 29 || y === 14 || (x === 0 && y >= 2) || (x === 1 && y >= 2 && y <= 7) || (x === 1 && y >= 13) || (x >= 7 && x <= 8 && y >= 12 && y <= 13) || (x === 9 && y === 13);

const isDistrictLand = (char) => char !== '~' && char !== '#';

function buildGrid() {
  const grid = [];
  for (let y = 0; y < ROWS; y++) grid.push(new Array(COLS).fill('#'));
  for (const [letter, x0, y0, x1, y1] of DISTRICT_RECTS) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = letter;
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (SEA_CELLS(x, y)) grid[y][x] = '~';
  for (const [x, y] of HILL_CELLS) if (isDistrictLand(grid[y][x])) grid[y][x] = grid[y][x].toLowerCase();
  return grid;
}
const GRID = buildGrid();

const DISTRICTS = {
  P: { name: 'PEIRAIAS', color: [233, 184, 114] },
  N: { name: 'NOTIA', color: [143, 208, 200] },
  E: { name: 'ANATOLIKA', color: [217, 160, 196] },
  V: { name: 'VOREIA', color: [159, 203, 123] },
  D: { name: 'DYTIKA', color: [230, 210, 106] },
  A: { name: 'ATHINA', color: [201, 182, 232] },
};
// Label position per district, in pixels (top-left of the text), and per route, in pixels (centre of the label).
const LABELS = { P: [10, 64], N: [84, 106], E: [197, 56], V: [90, 2], D: [34, 28], A: [82, 50] };
const ROUTE_LABELS = {
  R1: [28, 92], R2: [60, 92], R3: [76, 92], R4: [100, 100], R5: [148, 100], R6: [180, 92], R7: [178, 36], R8: [132, 28],
  R9: [96, 20], R10: [48, 44], R11: [64, 62], R12: [106, 68],
};

// ---- Places, routes and lines (cell coordinates, centre of a cell) ------------------------------------------------
const TOWNS = {
  newPeiraias: [3, 10], kastella: [7, 10], faliro: [10, 12], glyfada: [15, 12], koropi: [21, 12], spata: [24, 9],
  kifisia: [17, 2], marousi: [15, 4], peristeri: [7, 5], chaidari: [4, 6], monastiraki: [10, 9], syntagma: [14, 8],
};
const BOSS_TOWNS = ['glyfada', 'spata', 'marousi', 'chaidari', 'syntagma']; // town with the district boss; Peiraias' boss is the harbour office below
const HARBOUR_OFFICE = [5, 12];
const PARLIAMENT = [15, 7];
// [id, path, progress]: progress says which way the route map runs, for the player marker on the route line:
// 'x' = left to right, '-x' = right to left, 'y' = top to bottom (marker fraction (x+0.5)/w, 1-(x+0.5)/w, (y+0.5)/h).
const ROUTES = [
  ['R1', [[3, 10], [3, 12], [5, 12]], 'x'],
  ['R2', [[5, 12], [6, 12], [7, 11], [7, 10]], 'x'],
  ['R3', [[7, 10], [9, 11], [10, 12]], 'x'],
  ['R4', [[10, 12], [12, 12], [15, 12]], 'x'],
  ['R5', [[15, 12], [18, 12], [21, 12]], 'x'],
  ['R6', [[21, 12], [22, 10], [24, 9]], 'x'],
  ['R7', [[24, 9], [23, 6], [21, 3], [18, 2], [17, 2]], '-x'],
  ['R8', [[17, 2], [17, 4], [15, 4]], '-x'],
  ['R9', [[15, 4], [13, 2], [10, 2], [9, 3], [8, 4], [7, 5]], '-x'],
  ['R10', [[7, 5], [5, 5], [4, 6]], '-x'],
  ['R11', [[4, 6], [6, 7], [8, 7], [9, 8], [10, 9]], 'x'],
  ['R12', [[10, 9], [12, 8], [14, 8]], 'x'],
];
// The data must agree with the grid: every town, the harbour office, the parliament and every point of every route path
// stand on district land (not sea, not outside land), and the progress value is one of the three known ones.
function checkOnLand(label, [x, y]) {
  const char = GRID[y] && GRID[y][x];
  if (!char || !isDistrictLand(char)) throw new Error(label + ' at [' + x + ', ' + y + '] is not on district land (' + char + ')');
}
for (const [name, cell] of Object.entries(TOWNS)) checkOnLand('town ' + name, cell);
checkOnLand('harbour office', HARBOUR_OFFICE);
checkOnLand('parliament', PARLIAMENT);
for (const [id, points, progress] of ROUTES) {
  if (!['x', '-x', 'y'].includes(progress)) throw new Error(id + ' has an unknown progress value ' + progress);
  points.forEach((cell, index) => checkOnLand(id + ' point ' + index, cell));
}

const LINES = [
  { color: [46, 160, 80], dash: 0, points: [[4, 11], [7, 10], [9, 9], [11, 8], [11, 6], [13, 5], [15, 4], [16, 3], [17, 2]] }, // metro 1: harbour to the leafy north
  { color: [210, 60, 60], dash: 0, points: [[5, 3], [7, 5], [7, 7], [9, 8], [11, 8], [13, 9], [14, 11], [15, 12]] }, // metro 2: north-west to the south
  { color: [50, 90, 210], dash: 0, points: [[4, 9], [8, 9], [11, 8], [14, 8], [18, 8], [21, 9], [24, 9]] }, // metro 3: west to the airport
  { color: [240, 250, 255], dash: 3, points: [[14, 8], [12, 11], [11, 12], [17, 12]] }, // tram: square to the coast, then along it
  { color: [120, 120, 130], dash: 4, points: [[5, 1], [12, 1], [19, 2], [22, 4], [25, 8], [25, 11]] }, // the ring road
];
const ICONS = [
  ['temple', 11, 10], ['stadium', 14, 3], ['airport', 25, 10], ['monastery', 3, 6], ['theatre', 6, 10], ['port', 2, 11], ['port', 27, 4], ['stadium', 5, 13],
];
const SHAPES = {
  temple: ['.....', '#####', '.#.#.', '.#.#.', '#####'],
  stadium: ['.###.', '#...#', '#...#', '.###.'],
  airport: ['..#..', '..#..', '#####', '..#..', '.###.'],
  monastery: ['..#..', '#####', '..#..', '..#..', '..#..'], // a Latin cross (an equal-armed one reads as a medical sign)
  theatre: ['#####', '.###.', '..#..'],
  port: ['..#..', '.###.', '..#..', '#.#.#', '.###.'],
};

// ---- Pixel buffer and drawing helpers ----------------------------------------------------------------------------
const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const index = (y * WIDTH + x) * 3;
  pixels[index] = color[0]; pixels[index + 1] = color[1]; pixels[index + 2] = color[2];
}
function fillRect(x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, color);
}
function drawLine(x0, y0, x1, y1, color, dash) {
  // Bresenham; dash > 0 draws `dash` pixels, skips `dash` pixels.
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let count = 0;
  for (;;) {
    if (!dash || Math.floor(count / dash) % 2 === 0) setPixel(x0, y0, color);
    count++;
    if (x0 === x1 && y0 === y1) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x0 += stepX; }
    if (doubled <= dx) { error += dx; y0 += stepY; }
  }
}
function drawPolyline(points, color, dash, thick) {
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = centre(points[i]);
    const [bx, by] = centre(points[i + 1]);
    drawLine(ax, ay, bx, by, color, dash);
    if (thick) { drawLine(ax + 1, ay, bx + 1, by, color, dash); drawLine(ax, ay + 1, bx, by + 1, color, dash); }
  }
}
function centre(cell) { return [cell[0] * CELL + CELL / 2, cell[1] * CELL + CELL / 2]; }
function drawShape(shape, cx, cy, color, outline) {
  const top = cy - Math.floor(shape.length / 2);
  const left = cx - Math.floor(shape[0].length / 2);
  if (outline) {
    shape.forEach((row, ry) => [...row].forEach((ch, rx) => {
      if (ch !== '#') return;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) setPixel(left + rx + ox, top + ry + oy, outline);
    }));
  }
  shape.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '#') setPixel(left + rx, top + ry, color); }));
}

// A 3 x 5 pixel font: upper-case Latin letters, digits and a few signs.
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101111011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '-': '000000111000000', '.': '000000000000010', '/': '001001010100100', ' ': '000000000000000', '=': '000111000111000',
};
function textWidth(text) { return text.length * 4 - 1; }
function drawText(text, x, y, color, shadow) {
  [...text].forEach((ch, index) => {
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row * 3 + col] !== '1') continue;
        if (shadow) setPixel(x + index * 4 + col + 1, y + row + 1, shadow);
        setPixel(x + index * 4 + col, y + row, color);
      }
    }
  });
}

// ---- Compose the picture ------------------------------------------------------------------------------------------
const SEA = [60, 120, 180];
const FOAM = [143, 197, 238];
const INK = [27, 27, 47];
const GOLD = [244, 185, 66];
const PAPER = [246, 239, 220];
const OUTSIDE = [158, 154, 146]; // mainland outside the six districts

function shade(color, factor) { return color.map((value) => Math.max(0, Math.min(255, Math.round(value * factor)))); }

function drawLand() {
  fillRect(0, 0, WIDTH, HEIGHT, SEA);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const char = GRID[y][x];
      if (char === '~') {
        // a faint wave pattern keeps the sea from being a flat block
        if ((x + y) % 2 === 0) setPixel(x * CELL + 3, y * CELL + 4, FOAM);
        continue;
      }
      if (char === '#') {
        fillRect(x * CELL, y * CELL, CELL, CELL, OUTSIDE);
        continue;
      }
      const district = DISTRICTS[char.toUpperCase()];
      const hill = char !== char.toUpperCase();
      fillRect(x * CELL, y * CELL, CELL, CELL, hill ? shade(district.color, 0.82) : district.color);
    }
  }
  // borders: a dark line between two districts, a light line along the coast
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const here = GRID[y][x].toUpperCase();
      if (here === '~') continue;
      const rightSide = x + 1 < COLS ? GRID[y][x + 1].toUpperCase() : '~';
      const below = y + 1 < ROWS ? GRID[y + 1][x].toUpperCase() : '~';
      if (rightSide !== here) fillRect(x * CELL + CELL - 1, y * CELL, 1, CELL, rightSide === '~' ? FOAM : INK);
      if (below !== here) fillRect(x * CELL, y * CELL + CELL - 1, CELL, 1, below === '~' ? FOAM : INK);
      const leftSide = x > 0 ? GRID[y][x - 1].toUpperCase() : '~';
      const above = y > 0 ? GRID[y - 1][x].toUpperCase() : '~';
      if (leftSide === '~') fillRect(x * CELL, y * CELL, 1, CELL, FOAM);
      if (above === '~' && y > 0) fillRect(x * CELL, y * CELL, CELL, 1, FOAM);
    }
  }
  // hills: little peaks
  for (const [x, y] of HILL_CELLS) {
    if (GRID[y][x] === '~') continue;
    const [cx, cy] = centre([x, y]);
    drawShape(['..#..', '.###.', '#####'], cx, cy + 1, [107, 90, 70], null);
    drawShape(['..#..', '.#...'], cx, cy - 1, [250, 245, 235], null);
  }
}

function drawLines() {
  for (const line of LINES) drawPolyline(line.points, line.color, line.dash, false);
}
function drawRoutes() {
  for (const [id, points] of ROUTES) {
    drawPolyline(points, INK, 0, true);
    drawPolyline(points, PAPER, 2, false);
    const [mx, my] = ROUTE_LABELS[id];
    const width = textWidth(id);
    fillRect(mx - Math.floor(width / 2) - 1, my - 3, width + 2, 7, PAPER);
    drawText(id, mx - Math.floor(width / 2), my - 2, INK, null);
  }
}
function drawPlaces() {
  for (const [kind, cx, cy] of ICONS) {
    const [px, py] = centre([cx, cy]);
    drawShape(SHAPES[kind], px, py, [60, 50, 40], PAPER);
  }
  const square = (cell, size, fill, border) => {
    const [px, py] = centre(cell);
    fillRect(px - Math.floor(size / 2) - 1, py - Math.floor(size / 2) - 1, size + 2, size + 2, border);
    fillRect(px - Math.floor(size / 2), py - Math.floor(size / 2), size, size, fill);
  };
  for (const cell of Object.values(TOWNS)) square(cell, 5, [255, 255, 255], INK);
  // boss marks: a gold diamond at the corner of the town (or of the harbour office)
  const diamond = (cell, dx, dy) => {
    const [px, py] = centre(cell);
    drawShape(['..#..', '.###.', '#####', '.###.', '..#..'], px + dx, py + dy, GOLD, INK);
  };
  for (const name of BOSS_TOWNS) diamond(TOWNS[name], 4, -4);
  square(HARBOUR_OFFICE, 5, [255, 255, 255], INK);
  diamond(HARBOUR_OFFICE, 4, -4);
  // the parliament: a larger purple square with a gold border (the final)
  const [fx, fy] = centre(PARLIAMENT);
  fillRect(fx - 4, fy - 4, 9, 9, GOLD);
  fillRect(fx - 3, fy - 3, 7, 7, [90, 50, 150]);
  fillRect(fx - 1, fy - 2, 3, 5, GOLD);
}
function drawLabels() {
  for (const [letter, [cx, cy]] of Object.entries(LABELS)) {
    const text = DISTRICTS[letter].name;
    const x = cx;
    const y = cy;
    fillRect(x - 1, y - 1, textWidth(text) + 3, 7, [246, 239, 220]);
    drawText(text, x, y, INK, null);
  }
  // compass
  const cx = WIDTH - 12;
  drawShape(['..#..', '.###.', '#####', '..#..', '..#..'], cx, 8, PAPER, INK);
  drawText('N', cx - 1, 15, PAPER, INK);
}
function drawLegend() {
  const top = ROWS * CELL;
  fillRect(0, top, WIDTH, LEGEND_HEIGHT, INK);
  const items = [
    [PAPER, 'R = ROUTE'], [[255, 255, 255], 'TOWN'], [GOLD, 'BOSS'], [[90, 50, 150], 'PARLIAMENT'], [OUTSIDE, 'OUTSIDE'],
    [[46, 160, 80], 'LINE 1'], [[210, 60, 60], 'LINE 2'], [[50, 90, 210], 'LINE 3'], [[240, 250, 255], 'TRAM'], [[120, 120, 130], 'RING ROAD'],
  ];
  let x = 3;
  items.forEach(([color, text], index) => {
    const y = top + (index < 5 ? 2 : 9);
    if (index === 5) x = 3;
    fillRect(x, y, 4, 4, color);
    drawText(text, x + 6, y - 1, PAPER, null);
    x += textWidth(text) + 14;
  });
}

drawLand();
drawLines();
drawRoutes();
drawPlaces();
drawLabels();
drawLegend();

// ---- PNG encoder (zlib + CRC32, no packages) -----------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}
function encodePng() {
  const outWidth = WIDTH * SCALE;
  const outHeight = HEIGHT * SCALE;
  const raw = Buffer.alloc((outWidth * 3 + 1) * outHeight);
  let offset = 0;
  for (let y = 0; y < outHeight; y++) {
    raw[offset++] = 0; // filter type 0 (none)
    const sourceRow = Math.floor(y / SCALE) * WIDTH * 3;
    for (let x = 0; x < outWidth; x++) {
      const source = sourceRow + Math.floor(x / SCALE) * 3;
      raw[offset++] = pixels[source]; raw[offset++] = pixels[source + 1]; raw[offset++] = pixels[source + 2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(outWidth, 0); header.writeUInt32BE(outHeight, 4);
  header[8] = 8; header[9] = 2; header[10] = 0; header[11] = 0; header[12] = 0; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (process.argv.includes('--ascii')) {
  console.log(GRID.map((row) => row.join('')).join('\n'));
} else {
  const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'world-map.png');
  mkdirSync(dirname(target), { recursive: true });
  const png = encodePng();
  writeFileSync(target, png);
  console.log('wrote ' + target + ' (' + WIDTH * SCALE + ' x ' + HEIGHT * SCALE + ', ' + png.length + ' bytes)');
}
