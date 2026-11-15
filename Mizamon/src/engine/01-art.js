// ---- Pixel pens: small drawing helpers for procedural pixel art -------------------------
function makePen(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const pen = {
    canvas: canvas, g: g,
    px: function (x, y, color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); },
    rect: function (x, y, w, h, color) { g.fillStyle = color; g.fillRect(x, y, w, h); },
    ell: function (cx, cy, rx, ry, color) { // filled ellipse, one scanline at a time
      g.fillStyle = color;
      for (let y = -ry; y <= ry; y++) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)))));
        g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
      }
    },
    line: function (x1, y1, x2, y2, color) {
      g.fillStyle = color;
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
      for (let i = 0; i <= steps; i++) g.fillRect(Math.round(x1 + (x2 - x1) * i / steps), Math.round(y1 + (y2 - y1) * i / steps), 1, 1);
    },
    tri: function (x1, y1, x2, y2, x3, y3, color) {
      g.fillStyle = color;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill();
    },
    outline: function (color) { // 1 px dark outline around everything that is drawn
      const image = g.getImageData(0, 0, width, height);
      const data = image.data;
      const solid = new Uint8Array(width * height);
      for (let i = 0; i < solid.length; i++) solid[i] = data[i * 4 + 3] > 0 ? 1 : 0;
      const rgb = hexToRgb(color);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          if (solid[index]) continue;
          const near = (x > 0 && solid[index - 1]) || (x < width - 1 && solid[index + 1]) || (y > 0 && solid[index - width]) || (y < height - 1 && solid[index + width]);
          if (near) { data[index * 4] = rgb[0]; data[index * 4 + 1] = rgb[1]; data[index * 4 + 2] = rgb[2]; data[index * 4 + 3] = 255; }
        }
      }
      g.putImageData(image, 0, 0);
    },
  };
  return pen;
}
function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
function shade(hex, amount) { // amount -1..1 : darker or lighter
  const rgb = hexToRgb(hex).map(function (c) { return Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount))); });
  return '#' + rgb.map(function (c) { return c.toString(16).padStart(2, '0'); }).join('');
}

// ---- Tiles (16x16) ----------------------------------------------------------------------
const tileSprites = {};
let waterFrames = [];
function drawGrassTexture(p, base, seed) {
  p.rect(0, 0, 16, 16, base);
  const rng = makeRng(seed);
  const light = shade(base, 0.18);
  const dark = shade(base, -0.18);
  for (let i = 0; i < 14; i++) p.px(Math.floor(rng() * 16), Math.floor(rng() * 16), rng() < 0.5 ? light : dark);
}
function drawWallTile(p, window) {
  p.rect(0, 0, 16, 16, '#f0ebdc');
  p.rect(0, 13, 16, 3, '#cfc6ae');
  p.rect(0, 0, 16, 1, '#ddd5c0');
  if (window) {
    p.rect(3, 3, 10, 9, '#3a5f94');
    p.rect(4, 4, 8, 7, '#8fc3ee');
    p.rect(8, 4, 1, 7, '#3a5f94');
    p.rect(4, 7, 8, 1, '#3a5f94');
    p.rect(2, 3, 1, 9, '#c0583a');
    p.rect(13, 3, 1, 9, '#c0583a');
    p.rect(3, 12, 10, 1, '#8a7a5a');
  }
}
function drawRoofTile(p, color) {
  p.rect(0, 0, 16, 16, color);
  const dark = shade(color, -0.25);
  const light = shade(color, 0.2);
  for (let y = 0; y < 16; y += 4) { p.rect(0, y + 3, 16, 1, dark); p.rect(0, y, 16, 1, light); }
  for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 4 : 0; x < 16; x += 8) p.rect(x, y, 1, 4, dark);
}
// The hospital's own look: teal roof, mint walls, a blue Η plate, a green cross (never red), pale green floors.
const HOSPITAL_GREEN = '#2fa15a';
const HOSPITAL_TEAL = '#2f8f8a';
function drawMintWall(p) {
  p.rect(0, 0, 16, 16, '#d9efe6');
  p.rect(0, 13, 16, 3, '#a9cfc0');
  p.rect(0, 0, 16, 1, '#c4e0d3');
}
function drawHospitalFloor(p) {
  p.rect(0, 0, 16, 16, '#e3ece6');
  p.rect(0, 0, 8, 8, '#d2e0d8');
  p.rect(8, 8, 8, 8, '#d2e0d8');
}
function buildHospitalTiles(make) {
  make('6', function (p) { drawRoofTile(p, HOSPITAL_TEAL); });
  make('H', function (p) { // roof with a blue plate showing the Greek capital Eta
    drawRoofTile(p, HOSPITAL_TEAL);
    p.rect(2, 3, 12, 10, '#1b3f7a'); p.rect(3, 4, 10, 8, '#2a5fc4');
    p.rect(5, 5, 2, 6, '#ffffff'); p.rect(9, 5, 2, 6, '#ffffff'); p.rect(5, 7, 6, 2, '#ffffff');
  });
  make('M', drawMintWall);
  make('N', function (p) {
    drawMintWall(p);
    p.rect(2, 2, 12, 10, '#2d6f6a'); p.rect(3, 3, 10, 8, '#9fd6e6');
    p.rect(7, 3, 2, 8, '#2d6f6a'); p.rect(3, 6, 10, 1, '#2d6f6a');
    p.rect(1, 12, 14, 1, '#6f9a8c');
  });
  make('P', function (p) { // pharmacy-style green cross on the wall
    drawMintWall(p);
    p.rect(5, 1, 6, 12, '#1d6e3c'); p.rect(2, 4, 12, 6, '#1d6e3c');
    p.rect(6, 2, 4, 10, HOSPITAL_GREEN); p.rect(3, 5, 10, 4, HOSPITAL_GREEN);
    p.rect(6, 3, 4, 1, '#6fd596');
  });
  make('E', function (p) { // sliding glass door
    drawMintWall(p);
    p.rect(2, 1, 12, 15, '#2d6f6a');
    p.rect(3, 2, 5, 14, '#bfe6f0'); p.rect(9, 2, 4, 14, '#bfe6f0');
    p.rect(4, 3, 1, 4, '#e8f8fc'); p.rect(10, 3, 1, 4, '#e8f8fc');
    p.rect(7, 8, 1, 3, '#2d6f6a'); p.rect(8, 8, 1, 3, '#2d6f6a');
  });
  make('i', function (p) {
    p.rect(0, 0, 16, 16, '#b9d8cf');
    p.rect(0, 0, 16, 2, '#d3ece3');
    p.rect(0, 8, 16, 1, '#6f9a8c'); p.rect(0, 9, 16, 7, '#8fbcae');
    for (let x = 0; x < 16; x += 8) p.rect(x, 9, 1, 7, '#79a698');
    p.rect(0, 14, 16, 2, '#6f9a8c');
  });
  make('L', drawHospitalFloor);
  make('B', function (p) { // a cot standing in the corridor
    drawHospitalFloor(p);
    p.rect(1, 1, 14, 14, '#5a5a66'); p.rect(2, 2, 12, 12, '#e8ecf0');
    p.rect(2, 7, 12, 7, '#4a78c0'); p.rect(2, 10, 12, 1, '#3a60a0');
    p.rect(3, 3, 10, 3, '#ffffff'); p.rect(3, 5, 10, 1, '#cfd6e0');
    p.rect(0, 13, 3, 3, '#33333d'); p.rect(13, 13, 3, 3, '#33333d');
  });
  make('V', function (p) { // vending machine, out of order
    drawHospitalFloor(p);
    p.rect(1, 0, 14, 16, '#3a4a6a'); p.rect(2, 1, 12, 8, '#1d2a3a');
    const colors = ['#d8452f', '#f4b942', '#2f8a5a', '#b0489a'];
    for (let i = 0; i < 4; i++) { p.rect(3 + i * 3, 2, 2, 3, colors[i]); p.rect(3 + i * 3, 6, 2, 2, colors[(i + 2) % 4]); }
    p.rect(2, 10, 12, 3, '#f0d030');
    for (let x = 2; x < 14; x += 4) p.rect(x, 10, 2, 3, '#26262e');
    p.rect(5, 14, 6, 2, '#14141c');
  });
  make('Y', function (p) { // small TV on a stand
    drawHospitalFloor(p);
    p.rect(7, 11, 2, 4, '#555560'); p.rect(4, 14, 8, 2, '#44444f');
    p.rect(1, 1, 14, 10, '#26262e'); p.rect(2, 2, 12, 8, '#5fa8d8');
    p.rect(10, 3, 3, 3, '#f6d84a'); p.rect(2, 8, 12, 2, '#d8452f'); p.rect(3, 8, 5, 1, '#ffffff');
  });
  make('A', function (p) { // the Αρχείο Ασθενών terminal
    drawHospitalFloor(p);
    p.rect(1, 9, 14, 7, '#7e8aa0'); p.rect(1, 9, 14, 1, '#a8b2c4');
    p.rect(3, 0, 10, 9, '#2a2f3a'); p.rect(4, 1, 8, 7, '#0e2a1c');
    p.rect(5, 2, 5, 1, '#4fe08a'); p.rect(5, 4, 6, 1, '#4fe08a'); p.rect(5, 6, 3, 1, '#4fe08a'); p.rect(9, 6, 2, 1, '#9fffc0');
    p.rect(4, 11, 8, 3, '#cfd6e0'); p.rect(5, 12, 6, 1, '#8a94a8');
  });
  make('C', function (p) { // reception counter
    drawHospitalFloor(p);
    p.rect(0, 4, 16, 3, '#f0f6f3'); p.rect(0, 7, 16, 1, '#a9cfc0');
    p.rect(0, 8, 16, 8, HOSPITAL_TEAL);
    p.rect(1, 10, 6, 5, '#25736f'); p.rect(9, 10, 6, 5, '#25736f');
  });
}
function buildTileSprites() {
  const make = function (char, fn) { const p = makePen(TILE, TILE); fn(p); tileSprites[char] = p.canvas; };
  make('.', function (p) {
    drawGrassTexture(p, '#a2a2ad', 11);
    p.rect(0, 7, 16, 1, '#8a8a96'); p.rect(7, 0, 1, 16, '#8a8a96');
  });
  make(',', function (p) {
    p.rect(0, 0, 16, 16, '#dcd3bd');
    p.rect(0, 0, 16, 1, '#c3b99f'); p.rect(0, 8, 16, 1, '#c3b99f'); p.rect(0, 0, 1, 16, '#c3b99f'); p.rect(8, 0, 1, 8, '#c3b99f'); p.rect(4, 8, 1, 8, '#c3b99f'); p.rect(12, 8, 1, 8, '#c3b99f');
  });
  make('s', function (p) { drawGrassTexture(p, '#5fa650', 3); });
  make('g', function (p) {
    drawGrassTexture(p, '#3d8f3c', 5);
    const dark = '#216b2c';
    const light = '#7fd067';
    for (let x = 1; x < 16; x += 4) {
      for (let y = 2; y < 16; y += 6) {
        const yy = y + (x % 8 === 1 ? 0 : 3);
        p.rect(x, yy, 1, 4, dark); p.rect(x - 1, yy - 1, 1, 2, dark); p.rect(x + 1, yy - 1, 1, 2, dark);
        p.px(x, yy - 1, light);
      }
    }
  });
  make('#', function (p) { drawWallTile(p, false); });
  make('W', function (p) { drawWallTile(p, true); });
  make('1', function (p) { drawRoofTile(p, '#c0583a'); });
  make('2', function (p) { drawRoofTile(p, '#3a6ea5'); });
  make('3', function (p) { drawRoofTile(p, '#4a8a5a'); });
  make('4', function (p) { // kiosk awning: stripes
    p.rect(0, 0, 16, 16, '#f2f2f2');
    for (let x = 0; x < 16; x += 4) p.rect(x, 0, 2, 16, '#d8452f');
    p.rect(0, 14, 16, 2, '#9a2f20');
  });
  make('5', function (p) { drawRoofTile(p, '#7a4aa0'); });
  make('D', function (p) {
    drawWallTile(p, false);
    p.rect(3, 1, 10, 15, '#5a3a22'); p.rect(4, 2, 8, 14, '#8a5a32'); p.rect(4, 2, 8, 1, '#a8733f');
    p.rect(5, 4, 6, 4, '#6e4526'); p.rect(5, 9, 6, 5, '#6e4526');
    p.px(10, 9, '#f4d03f');
  });
  make('d', function (p) {
    drawWallTile(p, false);
    p.rect(3, 1, 10, 15, '#4c4c58'); p.rect(4, 2, 8, 14, '#6a6a78');
    p.rect(4, 5, 8, 1, '#44444f'); p.rect(4, 10, 8, 1, '#44444f');
    p.rect(7, 7, 3, 3, '#d8d8e0'); p.px(8, 8, '#555');
  });
  make('T', function (p) {
    drawGrassTexture(p, '#5fa650', 3);
    p.rect(7, 9, 2, 6, '#6b4a2a');
    p.ell(8, 6, 6, 6, '#2d7a3a'); p.ell(6, 5, 3, 3, '#3f9a4c'); p.ell(11, 8, 3, 3, '#256a30');
    p.px(10, 3, '#7fd067');
  });
  make('S', function (p) {
    p.rect(0, 0, 16, 16, '#dcd3bd');
    p.rect(7, 8, 2, 8, '#6b4a2a');
    p.rect(2, 2, 12, 8, '#d8b268'); p.rect(2, 2, 12, 1, '#f2d596'); p.rect(2, 9, 12, 1, '#9a7a3a');
    p.rect(4, 4, 8, 1, '#6b4a2a'); p.rect(4, 6, 6, 1, '#6b4a2a');
  });
  make('Z', function (p) {
    drawGrassTexture(p, '#5fa650', 3);
    p.rect(7, 8, 2, 8, '#6b4a2a');
    p.rect(2, 2, 12, 8, '#d8b268'); p.rect(2, 2, 12, 1, '#f2d596'); p.rect(2, 9, 12, 1, '#9a7a3a');
    p.rect(4, 4, 8, 1, '#6b4a2a'); p.rect(4, 6, 6, 1, '#6b4a2a');
  });
  make('F', function (p) {
    p.rect(0, 0, 16, 16, '#dcd3bd');
    p.rect(0, 5, 16, 2, '#8a6a3a'); p.rect(0, 10, 16, 2, '#8a6a3a'); p.rect(2, 3, 2, 12, '#6b4a2a'); p.rect(12, 3, 2, 12, '#6b4a2a');
  });
  make('K', function (p) {
    p.rect(0, 0, 16, 16, '#c89a62');
    p.rect(1, 1, 14, 14, '#a8733f'); p.rect(2, 2, 12, 12, '#c89a62');
    p.line(2, 2, 13, 13, '#8a5a32'); p.line(13, 2, 2, 13, '#8a5a32');
    p.rect(1, 1, 14, 1, '#6b4a2a'); p.rect(1, 14, 14, 1, '#6b4a2a');
  });
  make('f', function (p) {
    p.rect(0, 0, 16, 16, '#c99b64');
    p.rect(0, 3, 16, 1, '#b3844e'); p.rect(0, 7, 16, 1, '#b3844e'); p.rect(0, 11, 16, 1, '#b3844e'); p.rect(0, 15, 16, 1, '#b3844e');
    p.rect(5, 0, 1, 3, '#b3844e'); p.rect(11, 4, 1, 3, '#b3844e'); p.rect(3, 8, 1, 3, '#b3844e'); p.rect(9, 12, 1, 3, '#b3844e');
  });
  make('w', function (p) {
    p.rect(0, 0, 16, 16, '#58668a');
    p.rect(0, 0, 16, 2, '#7686ad'); p.rect(0, 14, 16, 2, '#3e4966');
    for (let y = 2; y < 14; y += 4) p.rect(0, y + 3, 16, 1, '#46527a');
    for (let y = 2; y < 14; y += 4) for (let x = (y / 4) % 2 ? 4 : 0; x < 16; x += 8) p.rect(x, y, 1, 4, '#46527a');
  });
  make('c', function (p) {
    p.rect(0, 0, 16, 16, '#c99b64');
    p.rect(0, 0, 16, 6, '#e8c48a'); p.rect(0, 6, 16, 1, '#8a5a32'); p.rect(0, 7, 16, 9, '#8a5a32');
    p.rect(2, 9, 5, 5, '#a8733f'); p.rect(9, 9, 5, 5, '#a8733f');
  });
  make('h', function (p) {
    p.rect(0, 0, 16, 16, '#6b4a2a');
    p.rect(1, 1, 14, 14, '#3e2a18');
    const colors = ['#d8452f', '#2f8a5a', '#f4b942', '#3a6ea5', '#b0489a'];
    for (let row = 0; row < 2; row++) {
      p.rect(1, 7 + row * 7, 14, 1, '#6b4a2a');
      for (let i = 0; i < 4; i++) p.rect(2 + i * 3, 2 + row * 7, 2, 5, colors[(i + row * 2) % colors.length]);
    }
  });
  make('t', function (p) {
    p.rect(0, 0, 16, 16, '#c99b64');
    p.ell(8, 8, 6, 6, '#8a5a32'); p.ell(8, 7, 6, 5, '#d8b268');
    p.rect(5, 6, 2, 2, '#f4f4f4'); p.rect(9, 8, 2, 2, '#d8452f');
  });
  make('r', function (p) {
    p.rect(0, 0, 16, 16, '#a23a3a');
    p.rect(0, 0, 16, 2, '#e8c06a'); p.rect(0, 14, 16, 2, '#e8c06a');
    p.rect(3, 4, 10, 8, '#c24a4a'); p.rect(6, 6, 4, 4, '#e8c06a');
  });
  make('m', function (p) {
    p.rect(0, 0, 16, 16, '#c99b64');
    p.rect(1, 4, 14, 10, '#46435a');
    for (let x = 2; x < 14; x += 3) p.rect(x, 5, 1, 8, '#5d5a74');
  });
  // Harbour decor (MZ-WORLD-02a): each one carries its own water so it can stand on the sea.
  const drawSea = function (p) { p.rect(0, 0, 16, 16, '#2a78c8'); p.rect(0, 0, 16, 1, '#3a8ad8'); p.rect(2, 12, 4, 1, '#8ccaf2'); p.rect(10, 5, 3, 1, '#5aa6e6'); };
  make('Q', function (p) { // a moored ferry: white hull with a red stripe, two decks, a funnel
    drawSea(p);
    p.rect(0, 9, 16, 5, '#f4f4f4'); p.rect(0, 12, 16, 1, '#c0392b'); p.rect(0, 14, 16, 1, '#8ccaf2');
    p.rect(2, 5, 11, 4, '#e6e6ee'); for (let x = 3; x < 12; x += 3) p.rect(x, 6, 2, 2, '#2d6f9a');
    p.rect(9, 1, 3, 4, '#c0392b'); p.rect(9, 1, 3, 1, '#222'); p.rect(0, 9, 16, 1, '#c8c8d4');
  });
  make('X', function (p) { // a quay crane in port yellow
    drawSea(p);
    p.rect(2, 4, 2, 12, '#e0a020'); p.rect(11, 4, 2, 12, '#e0a020'); p.rect(2, 9, 11, 1, '#c88810');
    p.rect(0, 2, 16, 2, '#e0a020'); p.rect(1, 1, 14, 1, '#c88810'); p.rect(12, 4, 1, 6, '#222'); p.rect(11, 10, 3, 2, '#c0392b');
  });
  make('y', function (p) { // a yacht: white sail, small hull
    drawSea(p);
    p.tri(8, 1, 8, 10, 13, 10, '#f6f6f6'); p.tri(7, 3, 7, 10, 3, 10, '#dcdcec');
    p.rect(2, 10, 12, 3, '#26325a'); p.rect(3, 13, 10, 1, '#1a2240'); p.rect(2, 10, 12, 1, '#f4c430');
  });
  make('U', function (p) { // ΚΤΕΛ stop: a blue sign on a post with a little bus
    p.rect(0, 0, 16, 16, '#dcd3bd'); p.rect(7, 8, 2, 8, '#6b4a2a');
    p.rect(2, 1, 12, 8, '#2a5fc4'); p.rect(2, 1, 12, 1, '#7fa8f0');
    p.rect(4, 3, 8, 4, '#f4f4f4'); p.rect(5, 4, 2, 2, '#2a5fc4'); p.rect(8, 4, 2, 2, '#2a5fc4'); p.rect(4, 7, 8, 1, '#c0392b');
  });
  make('e', function (p) { // open-air theatre tier: pale stone steps with a darker seat band
    p.rect(0, 0, 16, 16, '#d9cdb0'); p.rect(0, 0, 16, 1, '#efe6cf'); p.rect(0, 15, 16, 1, '#a89b7c');
    p.rect(0, 5, 16, 4, '#c3b28a'); p.rect(0, 5, 16, 1, '#e4d7b4'); p.rect(0, 8, 16, 1, '#8f8060');
    p.rect(3, 11, 1, 2, '#bfb396'); p.rect(11, 2, 1, 2, '#bfb396');
  });
  make('j', function (p) { // metro entrance: a dark stairwell frame with a green sign (no real logo) and a down arrow
    p.rect(0, 0, 16, 16, '#dcd3bd');
    p.rect(2, 5, 12, 11, '#4a4a58'); p.rect(3, 6, 10, 10, '#23232e');
    for (let step = 0; step < 4; step++) p.rect(4 + step, 8 + step * 2, 8 - step * 2, 1, '#6c6c80');
    p.rect(2, 0, 12, 5, '#2f8a5a'); p.rect(2, 0, 12, 1, '#7fd0a0');
    p.rect(7, 1, 2, 2, '#f4f4f4'); p.tri(5, 3, 11, 3, 8, 5, '#f4f4f4');
  });
  // South coast decor (MZ-WORLD-02b).
  const drawSand = function (p) { drawGrassTexture(p, '#e8d49a', 21); p.px(3, 4, '#cdb67a'); p.px(11, 10, '#cdb67a'); p.px(6, 13, '#cdb67a'); };
  make('a', drawSand);
  make('b', function (p) { // a sunbed under a striped parasol
    drawSand(p);
    p.rect(2, 10, 12, 3, '#2a78c8'); p.rect(2, 10, 12, 1, '#8ccaf2'); p.rect(2, 13, 2, 2, '#7a5a30'); p.rect(12, 13, 2, 2, '#7a5a30');
    p.rect(7, 4, 2, 7, '#8a8a98');
    p.tri(1, 5, 15, 5, 8, 0, '#f4f4f4'); p.tri(1, 5, 5, 5, 4, 2, '#e0483e'); p.tri(8, 0, 12, 5, 8, 5, '#e0483e'); p.rect(1, 5, 14, 1, '#c0392b');
  });
  make('k', function (p) { // a lifeguard tower on stilts: striped hut, a ladder, a flag
    drawSand(p);
    p.rect(2, 9, 2, 7, '#7a5a30'); p.rect(12, 9, 2, 7, '#7a5a30'); p.line(3, 15, 12, 9, '#7a5a30'); p.rect(7, 12, 2, 4, '#9a7a4a');
    p.rect(1, 8, 14, 1, '#5a3a22'); p.rect(2, 3, 12, 5, '#f4f4f4'); p.rect(2, 5, 12, 1, '#f08a30'); p.rect(4, 4, 3, 2, '#8fc3ee');
    p.rect(1, 2, 14, 1, '#f08a30'); p.rect(8, 0, 1, 2, '#6b4a2a'); p.rect(9, 0, 3, 2, '#f4c430');
  });
  make('l', function (p) { // tram rails on gravel
    p.rect(0, 0, 16, 16, '#b4ae9c'); p.px(2, 2, '#9a9482'); p.px(12, 13, '#9a9482'); p.px(7, 8, '#cfc9b6');
    for (let x = 1; x < 16; x += 4) p.rect(x, 2, 2, 12, '#6b4a2a');
    p.rect(0, 4, 16, 2, '#7a7e8a'); p.rect(0, 4, 16, 1, '#c8ccd8'); p.rect(0, 10, 16, 2, '#7a7e8a'); p.rect(0, 10, 16, 1, '#c8ccd8');
  });
  make('n', function (p) { // a palm tree on sand
    drawSand(p);
    p.line(8, 15, 9, 6, '#7a5a30'); p.line(9, 15, 10, 6, '#6b4a2a');
    p.tri(9, 6, 0, 3, 3, 7, '#2d8a3a'); p.tri(9, 6, 15, 3, 12, 7, '#2d8a3a'); p.tri(9, 6, 4, 0, 8, 1, '#3f9a4c'); p.tri(9, 6, 14, 0, 11, 1, '#3f9a4c'); p.tri(9, 6, 6, 9, 12, 9, '#256a30');
    p.px(8, 8, '#8a5a32'); p.px(10, 8, '#8a5a32');
  });
  make('o', function (p) { // runway: asphalt with a dashed centre line
    p.rect(0, 0, 16, 16, '#4a4a54'); p.px(3, 3, '#5a5a66'); p.px(12, 12, '#3c3c46'); p.px(8, 13, '#5a5a66');
    p.rect(2, 7, 8, 2, '#e8e8e8'); p.rect(0, 0, 16, 1, '#8a8a96'); p.rect(0, 15, 16, 1, '#8a8a96');
  });
  make('p', function (p) { // a hangar: corrugated metal with a big door
    p.rect(0, 0, 16, 16, '#8aa0b8'); for (let x = 1; x < 16; x += 3) p.rect(x, 0, 1, 16, '#6c849c');
    p.rect(0, 0, 16, 2, '#5a7088'); p.rect(2, 7, 12, 9, '#4a5a70'); p.rect(2, 7, 12, 1, '#2a3446'); p.rect(7, 7, 2, 9, '#2a3446'); p.rect(2, 4, 12, 1, '#d8c040');
  });
  make('q', function (p) { // the crane of the unfinished project: a lattice mast and a jib on dusty ground
    p.rect(0, 0, 16, 16, '#cbbf9a'); p.px(4, 13, '#b3a47a'); p.px(12, 14, '#b3a47a');
    p.rect(5, 3, 1, 13, '#d8a020'); p.rect(9, 3, 1, 13, '#d8a020'); for (let y = 4; y < 16; y += 3) p.line(5, y, 9, y + 3, '#b8860a');
    p.rect(0, 2, 16, 2, '#d8a020'); p.rect(0, 1, 16, 1, '#b8860a'); p.rect(1, 4, 1, 5, '#222'); p.rect(0, 9, 3, 2, '#c0392b'); p.rect(11, 0, 4, 2, '#8a6a10');
  });
  make('u', function (p) { // golf fairway: mown stripes
    drawGrassTexture(p, '#86cf6a', 9);
    p.rect(0, 0, 16, 4, '#92d974'); p.rect(0, 8, 16, 4, '#92d974');
  });
  make('G', function (p) { // a nightclub front: dark wall with neon bars
    p.rect(0, 0, 16, 16, '#2c2040'); p.rect(0, 13, 16, 3, '#1c1430');
    p.rect(2, 3, 12, 2, '#ff4fa8'); p.rect(2, 8, 12, 2, '#3fe0e8'); p.rect(2, 3, 1, 7, '#ff4fa8'); p.rect(13, 3, 1, 7, '#3fe0e8');
    p.px(7, 6, '#f4f4f4'); p.px(8, 6, '#f4f4f4');
  });
  // East decor (MZ-WORLD-02c): the Hymettus pass, the Mesogeia plain and the airport. No cross, no religious icon: the pass wall is a plain stone wall.
  make('R', function (p) { // a boulder on hill ground
    drawGrassTexture(p, '#9a9684', 41);
    p.ell(8, 10, 7, 5, '#5e5a4e'); p.ell(8, 9, 7, 5, '#8c887a'); p.ell(6, 7, 3, 2, '#b4b09e'); p.rect(4, 12, 9, 1, '#6e6a5c'); p.px(11, 8, '#a8a492');
  });
  make('v', function (p) { // vineyard rows: three green rows on brown soil with posts and grape dots
    p.rect(0, 0, 16, 16, '#a8794a'); p.px(2, 2, '#8a5f38'); p.px(13, 9, '#8a5f38');
    for (let x = 1; x < 16; x += 5) { p.rect(x, 0, 3, 16, '#3f8a2a'); p.rect(x + 1, 0, 1, 16, '#5aa83a'); for (let y = 2; y < 16; y += 5) p.px(x, y, '#6a2a70'); }
    p.rect(0, 7, 16, 1, '#7a5230');
  });
  make('I', function (p) { // a pine on grass
    drawGrassTexture(p, '#5fa650', 3);
    p.rect(7, 12, 2, 4, '#6b4a2a');
    p.tri(8, 0, 2, 7, 14, 7, '#1f6a3a'); p.tri(8, 3, 1, 11, 15, 11, '#2a7a44'); p.tri(8, 6, 0, 14, 16, 14, '#1a5a30'); p.px(8, 3, '#7fd067');
  });
  make('J', function (p) { // a plain whitewashed stone wall with a stone cap
    p.rect(0, 0, 16, 16, '#ece6d6'); p.rect(0, 0, 16, 3, '#b8a888'); p.rect(0, 3, 16, 1, '#8f8068'); p.rect(0, 13, 16, 3, '#cfc6ae');
    p.rect(0, 8, 16, 1, '#d8d0bc'); p.rect(5, 4, 1, 4, '#d8d0bc'); p.rect(11, 9, 1, 4, '#d8d0bc');
  });
  make('O', function (p) { // the highway bridge deck seen from above: grey concrete, a dashed centre line, rails on both sides
    p.rect(0, 0, 16, 16, '#9a9aa6'); p.rect(0, 0, 3, 16, '#6a6a78'); p.rect(13, 0, 3, 16, '#6a6a78'); p.rect(0, 0, 1, 16, '#c8c8d4'); p.rect(15, 0, 1, 16, '#c8c8d4');
    p.rect(7, 1, 2, 5, '#f0e8c0'); p.rect(7, 9, 2, 5, '#f0e8c0'); p.px(5, 7, '#8a8a96'); p.px(11, 12, '#8a8a96');
  });
  make('z', function (p) { // the road under the bridge: dark asphalt, girders above
    p.rect(0, 0, 16, 16, '#6a6a76'); p.rect(0, 0, 16, 3, '#3e3e4a'); p.rect(0, 13, 16, 3, '#3e3e4a'); p.rect(0, 3, 16, 1, '#52525e');
    p.rect(2, 7, 4, 1, '#8a8a96'); p.rect(10, 8, 4, 1, '#8a8a96');
  });
  make('7', function (p) { // a village fountain: a stone basin with a water jet, on the paving
    p.rect(0, 0, 16, 16, '#dcd3bd'); p.rect(0, 0, 16, 1, '#c3b99f');
    p.ell(8, 9, 7, 6, '#9a9482'); p.ell(8, 9, 6, 5, '#5aa6e6'); p.ell(8, 9, 3, 2, '#8ccaf2');
    p.rect(7, 3, 2, 6, '#bfe6ff'); p.px(6, 3, '#e8f8ff'); p.px(9, 4, '#e8f8ff'); p.rect(6, 9, 4, 2, '#9a9482');
  });
  make('x', function (p) { // the terminal front: dark frame, blue-green glass, mullions
    p.rect(0, 0, 16, 16, '#34445e'); p.rect(1, 2, 14, 12, '#7fc6dc'); p.rect(1, 2, 14, 3, '#a8e0ee');
    p.rect(5, 2, 1, 12, '#34445e'); p.rect(10, 2, 1, 12, '#34445e'); p.rect(1, 8, 14, 1, '#34445e'); p.px(3, 4, '#e8f8fc'); p.px(12, 11, '#e8f8fc');
  });
  make('8', function (p) { // the terminal sliding door: two glass panes in the dark frame
    p.rect(0, 0, 16, 16, '#34445e'); p.rect(2, 1, 12, 15, '#2a3550');
    p.rect(3, 2, 5, 14, '#bfe6f0'); p.rect(9, 2, 4, 14, '#bfe6f0'); p.rect(4, 3, 1, 4, '#e8f8fc'); p.rect(10, 3, 1, 4, '#e8f8fc'); p.rect(7, 8, 2, 3, '#34445e');
  });
  make('9', function (p) { // a control tower: a shaft with a glass cab and a light, on the paving
    p.rect(0, 0, 16, 16, '#dcd3bd'); p.rect(5, 6, 6, 10, '#c8c8d4'); p.rect(5, 6, 1, 10, '#9a9aa8'); p.rect(10, 6, 1, 10, '#9a9aa8'); p.rect(7, 10, 2, 3, '#7a7a88');
    p.rect(2, 1, 12, 5, '#34445e'); p.rect(3, 2, 10, 3, '#8fd0f0'); p.rect(1, 0, 14, 1, '#e0e0ea'); p.rect(1, 6, 14, 1, '#e0e0ea'); p.px(8, 0, '#f4c430');
  });
  make('0', function (p) { // a parked plane seen from the side on the apron: white fuselage, tail fin, a wing, a stripe
    p.rect(0, 0, 16, 16, '#4a4a54'); p.px(3, 3, '#5a5a66'); p.px(12, 13, '#3c3c46');
    p.tri(1, 4, 5, 8, 1, 8, '#2a78c8'); p.ell(9, 9, 7, 3, '#f4f4f4'); p.rect(4, 11, 10, 1, '#c8ccd8'); p.rect(2, 9, 13, 1, '#2a78c8');
    for (let x = 6; x < 14; x += 2) p.px(x, 8, '#2a3550'); p.rect(7, 11, 5, 2, '#a8acb8'); p.rect(14, 8, 2, 2, '#8fd0f0');
  });
  // North decor (MZ-WORLD-02d): the marble mountain, the boulevard and the arena. No cross, no religious icon, no brand on any shop window.
  make('%', function (p) { // a block of white marble on rock ground, with grey veins
    drawGrassTexture(p, '#9a9684', 57);
    p.rect(1, 3, 14, 11, '#5e5a4e'); p.rect(1, 2, 14, 11, '#eceae4'); p.rect(1, 2, 14, 2, '#fafaf6'); p.rect(1, 11, 14, 2, '#cfccc2');
    p.line(3, 5, 8, 9, '#b8b4aa'); p.line(8, 9, 12, 7, '#b8b4aa'); p.px(5, 4, '#ffffff'); p.px(11, 10, '#a8a49a');
  });
  make('&', function (p) { // white marble steps
    p.rect(0, 0, 16, 16, '#e8e6de');
    for (let y = 0; y < 16; y += 4) { p.rect(0, y, 16, 1, '#faf8f2'); p.rect(0, y + 3, 16, 1, '#b8b4a8'); }
    p.px(3, 5, '#cfccc0'); p.px(11, 10, '#cfccc0'); p.px(7, 14, '#cfccc0');
  });
  make('=', function (p) { // a clipped hedge on grass
    drawGrassTexture(p, '#5fa650', 3);
    p.rect(0, 3, 16, 11, '#1f5a2a'); p.rect(0, 3, 16, 3, '#2d7a3a'); p.rect(0, 11, 16, 3, '#174a22');
    for (let x = 1; x < 16; x += 4) { p.px(x, 6, '#3f9a4c'); p.px(x + 2, 9, '#2a6a34'); }
  });
  make('>', function (p) { // a shop window: a striped awning over a glass display with a mannequin (no brand, no writing)
    drawWallTile(p, false);
    p.rect(0, 0, 16, 4, '#f2f2f2'); for (let x = 0; x < 16; x += 4) p.rect(x, 0, 2, 4, '#d8452f'); p.rect(0, 4, 16, 1, '#9a2f20');
    p.rect(1, 6, 14, 9, '#34445e'); p.rect(2, 7, 12, 7, '#a8dcee'); p.rect(2, 7, 12, 2, '#d4f0f8');
    p.rect(7, 8, 2, 2, '#f0c8a0'); p.rect(6, 10, 4, 4, '#e04f8a'); p.rect(3, 11, 2, 3, '#f4c430'); p.rect(11, 11, 2, 3, '#3a6ea5');
  });
  make('?', function (p) { // the island of a roundabout: a lawn with a stone kerb and a few flowers
    drawGrassTexture(p, '#5fa650', 11);
    p.rect(0, 0, 16, 1, '#c8c8d0'); p.rect(0, 15, 16, 1, '#c8c8d0'); p.rect(0, 0, 1, 16, '#c8c8d0'); p.rect(15, 0, 1, 16, '#c8c8d0');
    p.px(4, 5, '#f4c430'); p.px(10, 9, '#e04f8a'); p.px(6, 12, '#f4f4f4'); p.px(12, 4, '#f4f4f4');
  });
  make('^', function (p) { // the arched roof of the arena: a pale curved cover with steel ribs
    p.rect(0, 0, 16, 16, '#c6ccd8'); p.rect(0, 0, 16, 3, '#e4e8f0'); p.rect(0, 13, 16, 3, '#8a92a6');
    for (let x = 2; x < 16; x += 5) p.rect(x, 0, 1, 16, '#7a849a');
    p.rect(0, 7, 16, 1, '#a8b0c2');
  });
  make('_', function (p) { // scaffolding over the roof: poles, planks and cross bars
    p.rect(0, 0, 16, 16, '#c6ccd8');
    p.rect(1, 0, 2, 16, '#b0804a'); p.rect(13, 0, 2, 16, '#b0804a'); p.rect(0, 3, 16, 2, '#8a5a32'); p.rect(0, 10, 16, 2, '#8a5a32');
    p.line(3, 5, 13, 10, '#6b4a2a'); p.line(13, 5, 3, 10, '#6b4a2a');
  });
  make(';', function (p) { // stage boards: dark wood with tape marks
    p.rect(0, 0, 16, 16, '#3a2a46');
    for (let x = 0; x < 16; x += 4) p.rect(x, 0, 1, 16, '#2a1c34');
    p.rect(0, 0, 16, 1, '#5a4668'); p.px(5, 6, '#f4c430'); p.px(10, 11, '#ff4fa8'); p.px(12, 3, '#3fe0e8');
  });
  make(':', function (p) { // a speaker stack: two black cabinets with cones
    p.rect(0, 0, 16, 16, '#3a2a46'); p.rect(2, 0, 12, 16, '#15151f'); p.rect(2, 0, 12, 1, '#4a4a5e');
    p.ell(8, 5, 3, 3, '#33333f'); p.ell(8, 5, 1, 1, '#8a8a9a'); p.ell(8, 12, 3, 3, '#33333f'); p.ell(8, 12, 1, 1, '#8a8a9a');
  });
  make('!', function (p) { // a tennis court: red clay with white lines
    p.rect(0, 0, 16, 16, '#c0583a'); p.px(3, 4, '#b04a30'); p.px(11, 11, '#b04a30'); p.px(8, 8, '#d06a48');
    p.rect(0, 0, 16, 1, '#f4f4f4'); p.rect(0, 15, 16, 1, '#f4f4f4');
  });
  // West decor (MZ-WORLD-02e): the highway, the apartment blocks, the market and the football ground. No cross, no religious icon, no writing on any sign tile.
  make('`', function (p) { // asphalt: dark grey with a few specks
    p.rect(0, 0, 16, 16, '#5e5e6a'); p.px(3, 4, '#6a6a76'); p.px(11, 10, '#52525e'); p.px(7, 13, '#6a6a76'); p.px(13, 3, '#52525e');
  });
  make(')', function (p) { // asphalt with a dashed lane line along its lower edge
    p.rect(0, 0, 16, 16, '#5e5e6a'); p.px(4, 5, '#6a6a76'); p.px(12, 9, '#52525e');
    p.rect(1, 14, 6, 1, '#f0e8c0'); p.rect(9, 14, 6, 1, '#f0e8c0');
  });
  make('*', function (p) { // a toll booth: a pale cabin with a red roof and a window, a striped barrier arm across the lane, on asphalt
    p.rect(0, 0, 16, 16, '#5e5e6a');
    p.rect(3, 1, 10, 11, '#d8d8e0'); p.rect(3, 1, 10, 3, '#c0392b'); p.rect(5, 5, 6, 4, '#8fc3ee'); p.rect(5, 5, 6, 1, '#34445e'); p.rect(3, 11, 10, 1, '#9a9aa6');
    p.rect(0, 13, 16, 2, '#f4f4f4'); for (let x = 0; x < 16; x += 4) p.rect(x, 13, 2, 2, '#c0392b');
  });
  make('@', function (p) { // a steel crash barrier on a grass verge
    drawGrassTexture(p, '#5fa650', 17);
    p.rect(0, 5, 16, 3, '#c8ccd4'); p.rect(0, 5, 16, 1, '#f0f2f6'); p.rect(0, 7, 16, 1, '#8a90a0');
    for (let x = 1; x < 16; x += 5) p.rect(x, 8, 2, 6, '#6a6a78');
  });
  make('(', function (p) { // a parked car seen from above on asphalt: red body, pale glass, dark wheels
    p.rect(0, 0, 16, 16, '#5e5e6a');
    p.rect(2, 2, 12, 12, '#c0392b'); p.rect(2, 2, 12, 1, '#e0604e'); p.rect(3, 4, 10, 2, '#8fc3ee'); p.rect(3, 10, 10, 2, '#8fc3ee'); p.rect(4, 6, 8, 4, '#a02e22');
    p.rect(1, 3, 1, 3, '#222'); p.rect(14, 3, 1, 3, '#222'); p.rect(1, 10, 1, 3, '#222'); p.rect(14, 10, 1, 3, '#222');
    p.px(3, 2, '#f4e08a'); p.px(12, 2, '#f4e08a');
  });
  make('+', function (p) { // an apartment block: pale facade, two windows, a balcony rail with laundry hanging on a line
    p.rect(0, 0, 16, 16, '#e4dcc8'); p.rect(0, 0, 16, 1, '#c9bfa6'); p.rect(0, 15, 16, 1, '#b8ae94');
    p.rect(1, 1, 6, 5, '#3a5f94'); p.rect(2, 2, 4, 3, '#8fc3ee'); p.rect(9, 1, 6, 5, '#3a5f94'); p.rect(10, 2, 4, 3, '#8fc3ee');
    p.rect(0, 7, 16, 1, '#8a8a96'); for (let x = 1; x < 16; x += 3) p.rect(x, 8, 1, 4, '#8a8a96'); p.rect(0, 12, 16, 1, '#8a8a96');
    p.line(1, 8, 14, 8, '#6a5a4a'); p.rect(2, 9, 3, 3, '#e04f8a'); p.rect(6, 9, 2, 4, '#f4f4f4'); p.rect(9, 9, 3, 3, '#3a8fd0'); p.px(13, 9, '#f4c430');
  });
  make('-', function (p) { // the river channel: a concrete bed with a little water in the middle
    p.rect(0, 0, 16, 16, '#9a9aa6'); p.rect(0, 0, 16, 2, '#c8c8d4'); p.rect(0, 14, 16, 2, '#c8c8d4');
    p.rect(0, 2, 16, 12, '#6a8aa8'); p.rect(0, 5, 16, 1, '#8ab0cc'); p.rect(3, 9, 5, 1, '#8ab0cc'); p.rect(10, 7, 4, 1, '#4e6e8a'); p.rect(2, 12, 3, 1, '#4e6e8a');
  });
  make('/', function (p) { // a market stall: a green and white awning over a table with fruit and crates, on paving
    p.rect(0, 0, 16, 16, '#dcd3bd');
    p.rect(0, 1, 16, 5, '#f2f2f2'); for (let x = 0; x < 16; x += 4) p.rect(x, 1, 2, 5, '#2f8f4a'); p.rect(0, 6, 16, 1, '#1f6a34');
    p.rect(0, 6, 1, 9, '#6b4a2a'); p.rect(15, 6, 1, 9, '#6b4a2a');
    p.rect(1, 8, 14, 3, '#8a5a32'); p.ell(4, 8, 2, 1, '#d8452f'); p.ell(8, 8, 2, 1, '#f4c430'); p.ell(12, 8, 2, 1, '#6aae3a');
    p.rect(1, 11, 14, 4, '#b0804a'); p.rect(1, 11, 14, 1, '#d8a868'); p.rect(7, 11, 1, 4, '#8a5a32');
  });
  make('<', function (p) { // a football pitch: two shades of mown grass in stripes
    p.rect(0, 0, 16, 16, '#3f9a4a'); p.rect(0, 0, 16, 8, '#4aa856'); p.px(3, 3, '#58b864'); p.px(11, 12, '#368a42'); p.px(8, 6, '#58b864');
  });
  make('|', function (p) { // a goal on the pitch: a white frame with a net
    p.rect(0, 0, 16, 16, '#3f9a4a'); p.rect(0, 0, 16, 8, '#4aa856');
    p.rect(2, 1, 12, 1, '#f4f4f4'); p.rect(2, 1, 1, 14, '#f4f4f4'); p.rect(13, 1, 1, 14, '#f4f4f4');
    for (let y = 3; y < 14; y += 2) p.rect(3, y, 10, 1, '#c8c8d0'); for (let x = 5; x < 13; x += 2) p.rect(x, 2, 1, 12, '#c8c8d0');
  });
  // Centre decor (MZ-WORLD-02f): the old road, the ruins, the neoclassical fronts and the square. No cross, no religious icon, no real monument and no writing on any tile.
  make('"', function (p) { // ancient paving: large worn flagstones of grey-beige marble with cracks and a little moss
    p.rect(0, 0, 16, 16, '#bdb4a0');
    p.rect(0, 0, 16, 1, '#a39a86'); p.rect(0, 7, 16, 1, '#a39a86'); p.rect(0, 15, 16, 1, '#a39a86');
    p.rect(0, 0, 1, 7, '#a39a86'); p.rect(9, 0, 1, 7, '#a39a86'); p.rect(5, 8, 1, 7, '#a39a86'); p.rect(13, 8, 1, 7, '#a39a86');
    p.px(3, 3, '#cfc7b4'); p.px(12, 4, '#cfc7b4'); p.px(8, 11, '#cfc7b4'); p.px(2, 12, '#7f9a5a'); p.px(14, 2, '#7f9a5a'); p.line(10, 9, 12, 12, '#8f8672');
  });
  make('$', function (p) { // a marble column drum on the ancient paving: fluted, with a broken top edge
    p.rect(0, 0, 16, 16, '#bdb4a0'); p.rect(0, 0, 16, 1, '#a39a86'); p.rect(0, 15, 16, 1, '#a39a86');
    p.rect(4, 4, 8, 10, '#e8e2d2'); p.rect(4, 4, 2, 10, '#fbf7ea'); p.rect(10, 4, 2, 10, '#c4bca6'); p.rect(7, 4, 1, 10, '#d4ccb6');
    p.rect(3, 13, 10, 2, '#cfc7b4'); p.rect(3, 14, 10, 1, '#8f8672');
    p.ell(8, 4, 4, 2, '#fbf7ea'); p.px(5, 3, '#bdb4a0'); p.px(11, 3, '#bdb4a0'); p.px(8, 2, '#bdb4a0');
  });
  make('[', function (p) { // a closed dig: a heap of soil behind a hoarding with orange and white stripes
    p.rect(0, 0, 16, 16, '#a07c52'); p.px(2, 2, '#8a6a46'); p.px(13, 6, '#8a6a46'); p.px(6, 14, '#8a6a46');
    p.ell(8, 12, 7, 3, '#7a5a3a'); p.ell(8, 11, 6, 2, '#8a6a46');
    p.rect(0, 3, 16, 6, '#f2f2f2'); for (let x = 0; x < 16; x += 4) p.rect(x, 3, 2, 6, '#e8742a');
    p.rect(0, 3, 16, 1, '#c8c8c8'); p.rect(0, 8, 16, 1, '#8a8a8a'); p.rect(1, 9, 2, 4, '#6b4a2a'); p.rect(13, 9, 2, 4, '#6b4a2a');
  });
  make(']', function (p) { // the front of a neoclassical building: an ochre wall, a row of white columns and tall dark windows between them
    p.rect(0, 0, 16, 16, '#e0cf9e'); p.rect(0, 0, 16, 1, '#f0e4bc'); p.rect(0, 15, 16, 1, '#b8a470');
    for (let x = 1; x < 16; x += 5) { p.rect(x, 0, 3, 16, '#f8f2dc'); p.rect(x, 0, 1, 16, '#ffffff'); p.rect(x + 2, 0, 1, 16, '#c8bc98'); }
    p.rect(4, 3, 2, 9, '#5a4a38'); p.rect(9, 3, 2, 9, '#5a4a38'); p.rect(4, 3, 2, 1, '#8a7a62'); p.rect(9, 3, 2, 1, '#8a7a62');
  });
  make('{', function (p) { // a police van from above on the paving: white body, a blue stripe, a light bar on the roof, dark wheels, no writing
    p.rect(0, 0, 16, 16, '#dcd3bd');
    p.rect(1, 2, 14, 12, '#f2f4f8'); p.rect(1, 2, 14, 1, '#ffffff'); p.rect(1, 13, 14, 1, '#b8bcc8');
    p.rect(1, 7, 14, 2, '#2a5fc4'); p.rect(3, 4, 10, 2, '#34445e'); p.rect(5, 10, 6, 2, '#c8ccd8');
    p.rect(5, 5, 3, 1, '#d8452f'); p.rect(8, 5, 3, 1, '#2a78c8');
    p.rect(0, 3, 1, 3, '#222'); p.rect(15, 3, 1, 3, '#222'); p.rect(0, 10, 1, 3, '#222'); p.rect(15, 10, 1, 3, '#222');
  });
  make('}', function (p) { // a short clock tower: a pale stone shaft with a round clock face and a pointed cap, on the paving
    p.rect(0, 0, 16, 16, '#dcd3bd');
    p.rect(3, 4, 10, 12, '#bfb49a'); p.rect(3, 4, 2, 12, '#d4caae'); p.rect(11, 4, 2, 12, '#9a8f78'); p.rect(3, 13, 10, 1, '#8a7f66');
    p.tri(2, 4, 8, 0, 14, 4, '#8a3a2a'); p.px(8, 0, '#f4c430');
    p.ell(8, 8, 3, 3, '#f4f0e0'); p.ell(8, 8, 2, 2, '#ffffff'); p.line(8, 8, 8, 6, '#222'); p.line(8, 8, 10, 9, '#222');
  });
  // The parliament inside (MZ-WORLD-02g): marble floor, a bench, the speaker's podium and a formal door. No writing, no emblem, no flag.
  const drawMarbleFloor = function (p) {
    p.rect(0, 0, 16, 16, '#e8e4da'); p.rect(0, 0, 8, 8, '#d6d1c4'); p.rect(8, 8, 8, 8, '#d6d1c4');
    p.px(3, 5, '#c4beb0'); p.px(4, 6, '#c4beb0'); p.px(12, 3, '#c4beb0'); p.px(11, 12, '#c4beb0'); p.px(2, 12, '#f4f1ea'); p.px(13, 6, '#f4f1ea');
  };
  make('Δ', drawMarbleFloor);
  make('Θ', function (p) { // a bench of the hall: a dark wooden back, a green leather seat with a lighter edge, wooden feet
    drawMarbleFloor(p);
    p.rect(0, 2, 16, 4, '#5a3a22'); p.rect(0, 2, 16, 1, '#7a5230'); p.rect(0, 5, 16, 1, '#3e2814');
    p.rect(0, 6, 16, 6, '#2f7a4a'); p.rect(0, 6, 16, 1, '#56a572'); p.rect(0, 11, 16, 1, '#1f5634');
    p.rect(1, 12, 2, 3, '#3e2814'); p.rect(13, 12, 2, 3, '#3e2814');
  });
  make('Φ', function (p) { // the speaker's podium: a wooden lectern with a lighter top and a small microphone
    drawMarbleFloor(p);
    p.rect(1, 6, 14, 9, '#6b4a2a'); p.rect(1, 6, 14, 2, '#a8733f'); p.rect(3, 9, 10, 5, '#8a5a32'); p.rect(3, 9, 10, 1, '#5a3a22'); p.rect(1, 14, 14, 1, '#3e2814');
    p.rect(7, 2, 2, 5, '#9a9aa8'); p.rect(6, 1, 4, 2, '#2a2a34');
  });
  make('Ξ', function (p) { // a formal double door: a pale stone frame, two dark mahogany leaves with panels and brass handles
    p.rect(0, 0, 16, 16, '#cfc7b4'); p.rect(0, 0, 16, 2, '#e8e2d2'); p.rect(0, 15, 16, 1, '#8f8672');
    p.rect(2, 2, 12, 14, '#5a2f22'); p.rect(2, 2, 1, 14, '#3a1c14'); p.rect(13, 2, 1, 14, '#3a1c14'); p.rect(7, 2, 2, 14, '#2a1510');
    p.rect(3, 4, 4, 5, '#7a4332'); p.rect(9, 4, 4, 5, '#7a4332'); p.rect(3, 10, 4, 5, '#7a4332'); p.rect(9, 10, 4, 5, '#7a4332');
    p.rect(6, 9, 1, 3, '#e0b040'); p.rect(9, 9, 1, 3, '#e0b040');
  });
  buildHospitalTiles(make);
  make('~', function () {});
  waterFrames = [];
  for (let frame = 0; frame < 2; frame++) {
    const p = makePen(TILE, TILE);
    p.rect(0, 0, 16, 16, '#2a78c8');
    p.rect(0, 0, 16, 1, '#3a8ad8');
    const offset = frame * 4;
    for (let y = 3; y < 16; y += 6) { p.rect((2 + offset) % 12, y, 4, 1, '#8ccaf2'); p.rect((9 + offset) % 12, y + 3, 3, 1, '#5aa6e6'); }
    waterFrames.push(p.canvas);
  }
}

// ---- Overworld characters (16x16, three directions x three frames) ------------------------
const LOOKS = {
  playerM: { skin: '#f0c08a', hair: '#3b2417', top: '#2f6fd0', pants: '#33384d', style: 'short' },
  playerF: { skin: '#f0c08a', hair: '#7a3b1e', top: '#d0447a', pants: '#33384d', style: 'long', skirt: true },
  prof: { skin: '#f0c08a', hair: '#d8d8d8', top: '#f4f4f4', pants: '#555a66', style: 'bald', glasses: true, coat: true },
  student: { skin: '#e8b88a', hair: '#2a2a2a', top: '#8a5ab0', pants: '#33384d', style: 'short' },
  rival: { skin: '#f6d0a0', hair: '#f0d048', top: '#242460', pants: '#242460', style: 'pomp', tie: '#d03030', pacifier: true },
  kid: { skin: '#f0c08a', hair: '#8a4a22', top: '#e0883a', pants: '#3a5a9a', style: 'short' },
  oldman: { skin: '#e8b88a', hair: '#cfcfcf', top: '#7a6a4a', pants: '#3a3a3a', style: 'bald', mustache: true, hat: '#2a2a3a' },
  oldman2: { skin: '#e8b88a', hair: '#bbbbbb', top: '#5a7a5a', pants: '#3a3a3a', style: 'bald', glasses: true },
  oldwoman: { skin: '#e8b88a', hair: '#e0e0e0', top: '#222228', pants: '#222228', style: 'bun', skirt: true },
  fisher: { skin: '#d8a070', hair: '#6a4a2a', top: '#d8c030', pants: '#2a4a7a', style: 'short', hat: '#d8c030' },
  clerk: { skin: '#f0c08a', hair: '#4a3a2a', top: '#3a6ea5', pants: '#33384d', style: 'short', tie: '#f0f0f0' },
  reception: { skin: '#f0c08a', hair: '#7a4a2a', top: '#2f8f8a', pants: '#33384d', style: 'bun', glasses: true, phone: true },
  doctor: { skin: '#e8b88a', hair: '#9a9a9a', top: '#5a7a9a', pants: '#33384d', style: 'short', glasses: true, mustache: true, envelope: true },
  kiosk: { skin: '#e8b88a', hair: '#2a2a2a', top: '#d8452f', pants: '#33384d', style: 'short', mustache: true, apron: '#f0f0f0' },
  cafeowner: { skin: '#e8b88a', hair: '#2a2a2a', top: '#f0f0f0', pants: '#33384d', style: 'bald', mustache: true, apron: '#3a8a5a' },
  cop: { skin: '#f0c08a', hair: '#2a2a2a', top: '#26325a', pants: '#26325a', style: 'short', hat: '#26325a', tie: '#111' },
  blogger: { skin: '#f0c08a', hair: '#e050a0', top: '#f08aa0', pants: '#3a3a5a', style: 'long', phone: true, glasses: true },
  singer: { skin: '#d8a070', hair: '#111111', top: '#8a2ab0', pants: '#111111', style: 'pomp', mustache: true, glasses: true },
  captain: { skin: '#e8b88a', hair: '#cccccc', top: '#f4f4f4', pants: '#f4f4f4', style: 'short', hat: '#f4f4f4', brim: '#1a2a5a', mustache: true },
  sailor: { skin: '#d8a070', hair: '#3a2a1a', top: '#f4f4f4', pants: '#1a2a5a', style: 'short', stripes: '#1a2a5a' },
  host: { skin: '#f0c08a', hair: '#2a2a2a', top: '#161620', pants: '#161620', style: 'short', bowtie: '#d03030', mic: true },
  fan: { skin: '#e8b88a', hair: '#3a2a1a', top: '#e8d030', pants: '#33384d', style: 'short', stripes: '#3a3a8a', hat: '#3a3a8a' },
  // Νότια (MZ-WORLD-02b): the people of the coast.
  lifeguard: { skin: '#d8a070', hair: '#3a2a1a', top: '#f08a30', pants: '#f08a30', style: 'short', hat: '#f4f4f4', brim: '#f08a30', glasses: true },
  sunbedseller: { skin: '#d8a070', hair: '#2a2a2a', top: '#3fb0c0', pants: '#e8e0c0', style: 'short', hat: '#e8d090', mustache: true },
  conductor: { skin: '#e8b88a', hair: '#3a3a3a', top: '#2a5a8a', pants: '#2a3a5a', style: 'short', hat: '#2a5a8a', tie: '#f4f4f4' },
  golfer: { skin: '#e8b88a', hair: '#8a8a8a', top: '#7ac07a', pants: '#e8e0c0', style: 'short', hat: '#f4efe0', glasses: true },
  surfer: { skin: '#e0a878', hair: '#f0d068', top: '#30b0c0', pants: '#f06aa0', style: 'long', phone: true, skirt: true },
  skipper: { skin: '#d8a070', hair: '#cccccc', top: '#f4f4f4', pants: '#d8c8a0', style: 'short', hat: '#f4f4f4', brim: '#1a2a5a', glasses: true, stripes: '#1a2a5a' },
  bougatsas: { skin: '#e8b88a', hair: '#555555', top: '#f0e6c8', pants: '#33384d', style: 'bald', mustache: true, apron: '#d8a84a', hat: '#f4f4f4' },
  // Ανατολικά (MZ-WORLD-02c): the people of the pass, the plain and the airport.
  pilgrim: { skin: '#e0b080', hair: '#6a5a4a', top: '#7a5a3a', pants: '#5a4a3a', style: 'long', hat: '#d8c8a0', brim: '#b0a070' },
  customs: { skin: '#e8b88a', hair: '#2a2a2a', top: '#6aa0c8', pants: '#33384d', style: 'short', hat: '#33384d', tie: '#f4c430', glasses: true },
  tourist: { skin: '#f0c08a', hair: '#e8c060', top: '#f06a8a', pants: '#f4f0e0', style: 'long', hat: '#f4e8c0', phone: true, skirt: true },
  vineyard: { skin: '#d8a070', hair: '#8a8a8a', top: '#8a3a50', pants: '#4a4a3a', style: 'short', hat: '#c8b070', apron: '#6a4a2a', mustache: true },
  cryptoseller: { skin: '#f0c08a', hair: '#2a2a2a', top: '#3a3a58', pants: '#2a2a3a', style: 'pomp', glasses: true, phone: true, stripes: '#3fe0e8' },
  spotter: { skin: '#e8b88a', hair: '#4a3a2a', top: '#6a8a3a', pants: '#5a5a4a', style: 'short', hat: '#6a8a3a', glasses: true, phone: true },
  checkin: { skin: '#e8b88a', hair: '#4a3a2a', top: '#2a4a8a', pants: '#2a3a5a', style: 'bun', glasses: true, tie: '#f4c430' },
  // Βόρεια (MZ-WORLD-02d): the people of the mountain road, the boulevard and the arena.
  oldstar: { skin: '#e0a878', hair: '#cccccc', top: '#d8b030', pants: '#2a2a3a', style: 'pomp', glasses: true, mic: true, stripes: '#f4f4f4' },
  gardener: { skin: '#d8a070', hair: '#8a8a8a', top: '#4a7a3a', pants: '#5a4a3a', style: 'short', hat: '#c8b070', brim: '#a89050', apron: '#6a4a2a' },
  tennis: { skin: '#f0c08a', hair: '#e8c060', top: '#f4f4f4', pants: '#f4f4f4', style: 'long', hat: '#3fa850', brim: '#2a7a3a', skirt: true },
  contestant: { skin: '#e8b88a', hair: '#c0408a', top: '#f08a30', pants: '#2a2a3a', style: 'long', phone: true, stripes: '#f4c430' },
  lobbyist: { skin: '#e8b88a', hair: '#3a3a3a', top: '#2a3a5a', pants: '#1a1a2a', style: 'short', tie: '#c0392b', glasses: true, envelope: true },
  usher: { skin: '#d8a070', hair: '#4a3a2a', top: '#8a1a3a', pants: '#1a1a2a', style: 'short', hat: '#8a1a3a', brim: '#f4c430', bowtie: '#f4c430' },
  amartia: { skin: '#e8b88a', hair: '#40e0d0', top: '#15151f', pants: '#3a2a5a', style: 'pomp', glasses: true, hat: '#15151f', brim: '#ff4fa8', stripes: '#ff4fa8' },
  // Δυτικά (MZ-WORLD-02e): the people of the highway, the market, the river road and the pass town.
  tollclerk: { skin: '#e8b88a', hair: '#4a3a2a', top: '#f0a020', pants: '#33384d', style: 'bun', stripes: '#f4f4f4', hat: '#f0a020', brim: '#f4f4f4', envelope: true },
  ultras: { skin: '#e8b88a', hair: '#2a2a2a', top: '#8a3fa0', pants: '#1a1a2a', style: 'short', stripes: '#f0a020', hat: '#8a3fa0', brim: '#f0a020' },
  granny: { skin: '#e8b88a', hair: '#e0e0e0', top: '#4a2a5a', pants: '#4a2a5a', style: 'bun', skirt: true, apron: '#f0d8a0', slipper: true },
  marketeer: { skin: '#d8a070', hair: '#3a2a1a', top: '#4a9a40', pants: '#33384d', style: 'short', hat: '#f4f4f4', brim: '#c8c8c8', apron: '#f0f0f0', mustache: true },
  philosopher: { skin: '#e8b88a', hair: '#bbbbbb', top: '#6a4a7a', pants: '#3a3a3a', style: 'long', glasses: true, mustache: true, bowtie: '#d8a82a' },
  steward: { skin: '#e8b88a', hair: '#4a3a2a', top: '#2a2a3a', pants: '#1a1a2a', style: 'short', tie: '#d8a82a', glasses: true, envelope: true },
  gatekeeper: { skin: '#d8a070', hair: '#2a2a2a', top: '#3a3a44', pants: '#2a2a2a', style: 'short', hat: '#2a2a2a', brim: '#d8a82a', mustache: true, bowtie: '#d8a82a' },
  plousiakis: { skin: '#e8b88a', hair: '#cccccc', top: '#2a2a34', pants: '#2a2a34', style: 'bald', mustache: true, glasses: true, tie: '#d8a82a', stripes: '#d8a82a', envelope: true },
  faia: { skin: '#f0c08a', hair: '#e050c0', top: '#f4f4f4', pants: '#40c8e0', style: 'long', phone: true, glasses: true, skirt: true, stripes: '#c040a0' },
  // Αθήνα (MZ-WORLD-02f): the people of the old road, the flea market, the avenue and the square.
  ministryclerk: { skin: '#f0c08a', hair: '#4a3a2a', top: '#8a8a96', pants: '#33384d', style: 'bun', glasses: true, tie: '#8a1a3a', envelope: true },
  guide: { skin: '#d8a070', hair: '#2a2a2a', top: '#e8742a', pants: '#33384d', style: 'short', hat: '#e8742a', brim: '#f4f4f4', stripes: '#f4f4f4', mic: true },
  porter: { skin: '#d8a070', hair: '#3a2a1a', top: '#a8734a', pants: '#4a4a3a', style: 'short', hat: '#6a4a2a', apron: '#6a4a2a', mustache: true },
  busker: { skin: '#e8b88a', hair: '#7a4a2a', top: '#3a8a5a', pants: '#2a2a3a', style: 'long', hat: '#d8452f', brim: '#a02e22', mic: true },
  inspector: { skin: '#e8b88a', hair: '#4a3a2a', top: '#2e3846', pants: '#1a2236', style: 'bun', glasses: true, hat: '#2e3846', brim: '#f4c430', tie: '#c0392b', envelope: true },
  cadet: { skin: '#e8b88a', hair: '#2a2a2a', top: '#26325a', pants: '#26325a', style: 'short', hat: '#26325a', brim: '#f4c430', bowtie: '#f4c430' },
  taxpayerman: { skin: '#e8b88a', hair: '#6a5a4a', top: '#7a7f8c', pants: '#3a3f50', style: 'short', glasses: true, tie: '#2a4a8a', envelope: true },
  baboulas: { skin: '#e0a878', hair: '#cccccc', top: '#1e2a4a', pants: '#1e2a4a', style: 'short', hat: '#1e2a4a', brim: '#d8a82a', mustache: true, glasses: true, stripes: '#d8a82a', tie: '#d8a82a' },
  // Βουλή (MZ-WORLD-02g): the head clerk with her stamps, the loud minister of the panels, the under-secretary of everything (a sash of many offices).
  euterpe: { skin: '#f0c08a', hair: '#8a8a96', top: '#5a2f55', pants: '#2a2a3a', style: 'bun', glasses: true, skirt: true, tie: '#e0b040', envelope: true },
  ministerman: { skin: '#e0805a', hair: '#bdbdc4', top: '#202026', pants: '#202026', style: 'pomp', tie: '#f4c430', mic: true },
  undersec: { skin: '#e8b88a', hair: '#3a3a3a', top: '#14234a', pants: '#14234a', style: 'short', glasses: true, tie: '#e0b040', stripes: '#e0b040', envelope: true },
  fusedmp: { skin: '#e8b88a', hair: '#6a5a4a', top: '#2f7a4a', pants: '#33384d', style: 'short', glasses: true, tie: '#e0b040', stripes: '#1f5634', hat: '#5a3a22', brim: '#7a5230' },
};
function drawCharFrame(p, ox, oy, look, dir, frame) {
  const dark = shade(look.top, -0.3);
  const stepLeft = frame === 1;
  const stepRight = frame === 2;
  // legs and shoes
  p.rect(ox + 5, oy + 13, 3, stepLeft ? 1 : 2, look.pants);
  p.rect(ox + 8, oy + 13, 3, stepRight ? 1 : 2, look.pants);
  p.rect(ox + 5, oy + (stepLeft ? 14 : 15), 3, 1, '#222');
  p.rect(ox + 8, oy + (stepRight ? 14 : 15), 3, 1, '#222');
  // body
  p.rect(ox + 4, oy + 8, 8, 5, look.top);
  p.rect(ox + 4, oy + 8, 1, 5, dark);
  p.rect(ox + 11, oy + 8, 1, 5, dark);
  if (look.skirt) p.rect(ox + 4, oy + 12, 8, 2, look.top);
  if (look.coat) { p.rect(ox + 4, oy + 8, 8, 7, look.top); p.rect(ox + 7, oy + 10, 2, 5, '#cfcfcf'); }
  if (look.apron) p.rect(ox + 5, oy + 10, 6, 5, look.apron);
  if (look.stripes) for (let y = 9; y < 13; y += 2) p.rect(ox + 4, oy + y, 8, 1, look.stripes);
  p.px(ox + 4, oy + 12, look.skin); p.px(ox + 11, oy + 12, look.skin);
  // head
  p.rect(ox + 5, oy + 2, 6, 6, look.skin);
  if (dir === 'up') {
    p.rect(ox + 5, oy + 1, 6, 6, look.hair);
  } else {
    if (look.style !== 'bald') p.rect(ox + 5, oy + 1, 6, 2, look.hair);
    else p.rect(ox + 5, oy + 1, 6, 1, look.hair);
    if (look.style === 'long' || look.style === 'bun') {
      p.rect(ox + 4, oy + 2, 1, 6, look.hair); p.rect(ox + 11, oy + 2, 1, 6, look.hair);
    }
    if (look.style === 'pomp') { p.rect(ox + 5, oy + 0, 6, 2, look.hair); p.rect(ox + 4, oy + 2, 1, 2, look.hair); p.rect(ox + 11, oy + 2, 1, 2, look.hair); }
    if (look.style === 'bun') p.rect(ox + 6, oy + 0, 4, 1, look.hair);
    if (look.style === 'bald') { p.px(ox + 4, oy + 3, look.hair); p.px(ox + 11, oy + 3, look.hair); }
    if (dir === 'down') {
      p.px(ox + 6, oy + 5, '#1a1a1a'); p.px(ox + 9, oy + 5, '#1a1a1a');
      if (look.glasses) { p.rect(ox + 5, oy + 5, 3, 1, '#222'); p.rect(ox + 8, oy + 5, 3, 1, '#222'); }
      if (look.mustache) p.rect(ox + 6, oy + 6, 4, 1, shade(look.hair, -0.4));
      if (look.pacifier) { p.rect(ox + 7, oy + 7, 2, 1, '#e8e040'); p.px(ox + 8, oy + 8, '#e8e040'); }
      if (look.tie) p.rect(ox + 7, oy + 8, 2, 4, look.tie);
      if (look.bowtie) { p.rect(ox + 6, oy + 8, 4, 1, look.bowtie); }
      if (look.mic) { p.rect(ox + 12, oy + 9, 1, 3, '#aaa'); p.px(ox + 12, oy + 8, '#222'); }
      if (look.phone) { p.rect(ox + 12, oy + 7, 2, 4, '#222'); p.px(ox + 12, oy + 8, '#8fc3ee'); }
      if (look.envelope) { p.rect(ox + 12, oy + 10, 3, 2, '#f6efdc'); p.px(ox + 13, oy + 10, '#d8a030'); } // an envelope held out, just in case
      if (look.slipper) { p.rect(ox + 12, oy + 8, 3, 2, '#d8887a'); p.rect(ox + 12, oy + 8, 3, 1, '#a85a4a'); } // a house slipper raised in the hand
    } else if (dir === 'left') {
      p.px(ox + 6, oy + 5, '#1a1a1a');
      p.rect(ox + 8, oy + 2, 3, 5, look.hair);
      if (look.glasses) p.rect(ox + 5, oy + 5, 2, 1, '#222');
      if (look.mustache) p.rect(ox + 5, oy + 6, 2, 1, shade(look.hair, -0.4));
    }
  }
  if (look.hat) {
    p.rect(ox + 4, oy + 0, 8, 3, look.hat);
    p.rect(ox + 3, oy + 3, 10, 1, look.brim || shade(look.hat, -0.3));
  }
}
const charSheets = {};
function charSheet(lookId) {
  if (charSheets[lookId]) return charSheets[lookId];
  const p = makePen(48, 48);
  const look = LOOKS[lookId];
  ['down', 'up', 'left'].forEach(function (dir, row) {
    for (let frame = 0; frame < 3; frame++) drawCharFrame(p, frame * 16, row * 16, look, dir, frame);
  });
  charSheets[lookId] = p.canvas;
  return p.canvas;
}

// ---- Creature sprites (32x32 each) -------------------------------------------------------------
function humanoid(p, o) {
  const skin = o.skin || '#f0c08a';
  // legs, shoes
  if (!o.longRobe) {
    p.rect(11, 26, 4, 4, o.pants || '#333a50'); p.rect(17, 26, 4, 4, o.pants || '#333a50');
    p.rect(10, 29, 5, 2, '#222'); p.rect(17, 29, 5, 2, '#222');
  }
  // arms and torso
  p.rect(7, 17, 3, 8, o.suit); p.rect(22, 17, 3, 8, o.suit);
  p.rect(7, 24, 3, 2, skin); p.rect(22, 24, 3, 2, skin);
  p.rect(10, 16, 12, o.longRobe ? 14 : 11, o.suit);
  p.rect(10, 16, 1, o.longRobe ? 14 : 11, shade(o.suit, -0.25)); p.rect(21, 16, 1, o.longRobe ? 14 : 11, shade(o.suit, -0.25));
  if (o.shirt) p.rect(14, 16, 4, 6, o.shirt);
  if (o.tie) { p.rect(15, 17, 2, 2, o.tie); p.rect(15, 19, 2, 6, o.tie); p.px(15, 25, o.tie); }
  // head
  p.ell(16, 9, 7, 7, skin);
  p.rect(9, 7, 1, 4, skin); p.rect(22, 7, 1, 4, skin);
  if (o.cheeks) { p.rect(10, 12, 2, 1, o.cheeks); p.rect(20, 12, 2, 1, o.cheeks); }
}
function eyes(p, y, color) {
  p.rect(12, y, 2, 2, '#ffffff'); p.rect(18, y, 2, 2, '#ffffff');
  p.px(13, y + 1, color || '#111'); p.px(19, y + 1, color || '#111');
}
const creatureDrawers = {
  komma: function (p) {
    humanoid(p, { suit: '#2d4a9a', shirt: '#ffffff', tie: '#d03030', cheeks: '#e8887a' });
    p.ell(16, 4, 7, 3, '#5a3a22'); p.rect(9, 4, 14, 3, '#5a3a22');
    eyes(p, 8); p.rect(14, 13, 4, 1, '#7a2a2a'); p.px(13, 12, '#7a2a2a'); p.px(18, 12, '#7a2a2a');
    p.rect(11, 18, 2, 2, '#f4c430'); // party pin
    p.rect(23, 17, 6, 8, '#ffffff'); p.rect(24, 19, 4, 1, '#8a8a99'); p.rect(24, 21, 4, 1, '#8a8a99'); p.px(25, 23, '#2f9a4a'); p.px(26, 22, '#2f9a4a'); // the ballot
  },
  koulourak: function (p) {
    humanoid(p, { suit: '#26325a', shirt: '#cfd6ea', tie: '#111', cheeks: '#e8887a' });
    p.rect(9, 1, 14, 5, '#26325a'); p.rect(8, 5, 16, 2, '#161e38'); // cap
    p.ell(16, 3, 3, 2, '#e8b030'); p.ell(16, 3, 1, 1, '#26325a'); // the sesame ring badge
    eyes(p, 8); p.rect(14, 13, 4, 1, '#7a2a2a');
    p.rect(4, 12, 3, 16, '#3a2a1a'); p.rect(5, 12, 1, 16, '#5a4a3a'); // baton
  },
  psaltak: function (p) {
    humanoid(p, { suit: '#1c1c24', longRobe: true, shirt: '#f4f4f4', cheeks: '#e8887a' });
    p.rect(10, 15, 12, 2, '#f4f4f4'); // collar
    p.rect(11, 0, 10, 5, '#1c1c24'); p.rect(9, 4, 14, 2, '#1c1c24'); // hat
    p.rect(10, 8, 12, 3, '#111'); p.rect(15, 8, 2, 1, '#e0b020'); // sunglasses
    p.px(12, 9, '#4a4a6a'); p.px(19, 9, '#4a4a6a'); p.rect(14, 13, 4, 1, '#7a2a2a');
    p.line(13, 17, 16, 21, '#e0b020'); p.line(19, 17, 16, 21, '#e0b020'); p.px(16, 22, '#e0b020'); // gold chain
    p.line(25, 18, 25, 24, '#c0a030'); p.ell(25, 27, 3, 3, '#e0b020'); p.px(25, 27, '#a07a10'); // censer
    p.px(27, 22, '#cfcfd8'); p.px(28, 20, '#cfcfd8'); p.px(26, 19, '#cfcfd8');
  },
  fakelakis: function (p) {
    p.rect(9, 3, 14, 8, '#6fbf73'); p.rect(10, 4, 12, 1, '#4e9a56'); p.rect(10, 7, 12, 1, '#4e9a56'); p.ell(16, 7, 2, 2, '#4e9a56'); // the note peeking out
    p.rect(5, 10, 22, 16, '#f3ead2'); p.rect(5, 24, 22, 2, '#dcd0ae');
    p.tri(5, 10, 27, 10, 16, 19, '#dcd0ae'); p.line(5, 10, 16, 19, '#b8a97c'); p.line(27, 10, 16, 19, '#b8a97c');
    p.ell(16, 19, 2, 2, '#c0392b');
    p.rect(11, 21, 3, 3, '#ffffff'); p.rect(18, 21, 3, 3, '#ffffff'); p.px(12, 23, '#111'); p.px(19, 23, '#111');
    p.rect(14, 26, 4, 1, '#7a2a2a');
    p.rect(2, 16, 3, 7, '#f3ead2'); p.rect(27, 16, 3, 7, '#f3ead2');
    p.rect(10, 26, 3, 4, '#333a50'); p.rect(19, 26, 3, 4, '#333a50'); p.rect(9, 29, 5, 2, '#222'); p.rect(18, 29, 5, 2, '#222');
  },
  fakelarchis: function (p) {
    p.rect(10, 0, 12, 7, '#15151f'); p.rect(7, 6, 18, 2, '#15151f'); p.rect(10, 5, 12, 1, '#c0392b');
    p.rect(3, 8, 26, 17, '#f3ead2'); p.rect(3, 22, 26, 3, '#e6d9ae'); p.rect(3, 8, 26, 1, '#f4c430');
    p.tri(3, 9, 29, 9, 16, 18, '#e0d2a0'); p.line(3, 9, 16, 18, '#b8a97c'); p.line(29, 9, 16, 18, '#b8a97c');
    p.ell(16, 18, 2, 2, '#c0392b'); p.px(16, 18, '#f4c430');
    p.rect(8, 20, 5, 4, '#ffffff'); p.rect(19, 20, 5, 4, '#ffffff'); p.px(10, 22, '#111'); p.px(21, 22, '#111');
    p.line(18, 19, 24, 19, '#f4c430'); p.line(18, 25, 24, 25, '#f4c430'); p.line(18, 19, 18, 25, '#f4c430'); p.line(24, 19, 24, 25, '#f4c430'); // monocle
    p.rect(11, 25, 8, 1, '#7a2a2a'); p.rect(19, 25, 6, 1, '#8a5a32'); p.px(25, 25, '#ff8a30'); // cigar
    p.rect(0, 15, 3, 8, '#f3ead2'); p.rect(29, 15, 3, 8, '#f3ead2');
    p.rect(9, 25, 4, 5, '#3a3a50'); p.rect(19, 25, 4, 5, '#3a3a50'); p.rect(8, 29, 6, 2, '#111'); p.rect(18, 29, 6, 2, '#111');
  },
  laikatzis: function (p) {
    humanoid(p, { skin: '#d8a070', suit: '#7a2fa0', shirt: '#d8a070', cheeks: null });
    p.ell(16, 4, 8, 4, '#111'); p.rect(8, 4, 3, 8, '#111'); p.rect(21, 4, 3, 8, '#111'); // pompadour and sideburns
    p.rect(10, 8, 5, 3, '#111'); p.rect(17, 8, 5, 3, '#111'); p.px(11, 8, '#6a6a8a'); p.px(18, 8, '#6a6a8a'); p.rect(15, 9, 2, 1, '#111'); // sunglasses
    p.rect(12, 12, 8, 2, '#111'); p.rect(14, 14, 4, 1, '#7a2a2a'); // moustache and grin
    p.line(13, 17, 16, 22, '#f4d03f'); p.line(19, 17, 16, 22, '#f4d03f'); p.px(16, 23, '#f4d03f');
    p.px(12, 20, '#ffffff'); p.px(19, 24, '#ffffff'); p.px(14, 26, '#ffffff'); // sequins
    p.rect(23, 14, 3, 3, '#9a9aa8'); p.rect(24, 17, 1, 8, '#222'); p.px(24, 14, '#d8d8e8'); // microphone
    p.rect(8, 26, 6, 1, '#7a2fa0'); p.rect(18, 26, 6, 1, '#7a2fa0');
  },
  storoula: function (p) {
    humanoid(p, { suit: '#2aa6a0', cheeks: '#f0808a', pants: '#3a3a5a' });
    p.ell(16, 1, 4, 3, '#e050a0'); p.rect(8, 3, 16, 5, '#e050a0'); p.rect(8, 4, 3, 12, '#e050a0'); p.rect(21, 4, 3, 12, '#e050a0'); // bun and long hair
    p.rect(9, 8, 6, 4, '#222'); p.rect(17, 8, 6, 4, '#222'); p.rect(15, 9, 2, 1, '#222'); p.rect(10, 9, 2, 1, '#f08aa0'); p.rect(18, 9, 2, 1, '#f08aa0');
    p.rect(14, 13, 4, 1, '#c0392b'); p.px(13, 12, '#c0392b'); p.px(18, 12, '#c0392b');
    p.rect(23, 6, 6, 11, '#15151f'); p.rect(24, 7, 4, 8, '#8fc3ee'); p.px(25, 9, '#ffffff'); // phone
    p.rect(2, 3, 3, 1, '#e0483e'); p.rect(1, 4, 5, 2, '#e0483e'); p.rect(2, 6, 3, 1, '#e0483e'); p.px(3, 7, '#e0483e'); // heart
  },
  trolosavros: function (p) {
    p.tri(4, 22, 4, 12, 10, 18, '#4a9a40'); // tail
    p.ell(16, 20, 9, 8, '#5fae4f'); p.ell(16, 22, 5, 5, '#c8e6a0');
    p.ell(16, 10, 9, 7, '#5fae4f');
    p.tri(8, 6, 11, 0, 13, 5, '#3a7a30'); p.tri(14, 4, 16, -1, 18, 4, '#3a7a30'); p.tri(19, 5, 21, 0, 24, 6, '#3a7a30'); // spikes
    p.ell(11, 8, 3, 3, '#ffffff'); p.ell(21, 8, 3, 3, '#ffffff'); p.px(12, 9, '#111'); p.px(20, 9, '#111'); p.px(11, 8, '#111'); p.px(21, 8, '#111');
    p.rect(9, 12, 14, 3, '#2a4a24'); for (let x = 10; x < 22; x += 3) p.rect(x, 12, 2, 2, '#ffffff'); // grin with teeth
    p.rect(8, 26, 5, 4, '#4a9a40'); p.rect(19, 26, 5, 4, '#4a9a40'); p.rect(7, 29, 7, 2, '#3a7a30'); p.rect(18, 29, 7, 2, '#3a7a30');
    p.rect(22, 0, 9, 6, '#ffffff'); p.px(24, 3, '#222'); p.px(26, 3, '#222'); p.px(28, 3, '#222'); p.px(22, 6, '#ffffff'); // comment bubble
  },
  dimosio: function (p) {
    humanoid(p, { suit: '#cfd8e3', shirt: '#cfd8e3', tie: '#3a3a5a', pants: '#4a4a5a' });
    p.rect(9, 3, 14, 3, '#7a7a7a'); p.rect(10, 6, 12, 1, '#7a7a7a'); // thin hair
    p.rect(10, 8, 5, 3, '#222'); p.rect(17, 8, 5, 3, '#222'); p.rect(11, 9, 3, 1, '#ffffff'); p.rect(18, 9, 3, 1, '#ffffff'); p.px(15, 9, '#222'); p.px(12, 9, '#222'); p.px(19, 9, '#222');
    p.rect(14, 14, 4, 1, '#7a2a2a'); p.px(13, 15, '#7a2a2a'); p.px(18, 15, '#7a2a2a');
    p.rect(22, 3, 1, 4, '#3a5fa0'); // pen behind the ear
    p.rect(22, 12, 8, 12, '#ffffff'); p.rect(22, 14, 8, 1, '#9a9aaa'); p.rect(22, 17, 8, 1, '#9a9aaa'); p.rect(22, 20, 8, 1, '#9a9aaa'); // stack of papers
    p.rect(2, 20, 5, 3, '#8a5a32'); p.rect(2, 23, 5, 3, '#c0392b'); // rubber stamp
  },
  eforaki: function (p) {
    humanoid(p, { suit: '#555a66', shirt: '#e8e8e8', tie: '#c0392b', pants: '#44495a' });
    p.rect(11, 0, 10, 5, '#15151f'); p.rect(7, 5, 18, 2, '#15151f'); p.rect(11, 4, 10, 1, '#c0392b'); // bowler hat
    p.rect(11, 8, 3, 1, '#111'); p.rect(18, 8, 3, 1, '#111'); eyes(p, 9); p.rect(12, 13, 8, 2, '#3a3a3a'); p.rect(14, 15, 4, 1, '#7a2a2a');
    p.ell(26, 15, 4, 4, '#cfeaf8'); p.rect(22, 11, 9, 1, '#555'); p.rect(22, 19, 9, 1, '#555'); p.rect(22, 11, 1, 9, '#555'); p.rect(30, 11, 1, 9, '#555');
    p.rect(26, 20, 2, 6, '#555'); // magnifying glass
    p.rect(1, 22, 8, 7, '#8a5a32'); p.rect(3, 20, 4, 2, '#5a3a22'); p.px(4, 25, '#f4d03f'); // briefcase
  },
  frapedoros: function (p) {
    p.rect(21, 0, 2, 8, '#d03030'); p.rect(21, 2, 2, 1, '#ffffff'); p.rect(21, 5, 2, 1, '#ffffff'); p.rect(19, 0, 4, 1, '#d03030'); // the straw
    p.ell(16, 8, 9, 3, '#f6efdc'); p.ell(14, 6, 4, 2, '#ffffff'); // foam
    p.tri(6, 8, 26, 8, 23, 27, '#b98a5a'); p.tri(6, 8, 9, 27, 23, 27, '#b98a5a'); p.rect(9, 8, 14, 19, '#b98a5a');
    p.rect(7, 9, 2, 15, '#d8b080'); p.rect(23, 9, 1, 17, '#8a6a3a'); p.rect(9, 25, 14, 2, '#8a6a3a');
    eyes(p, 14); p.rect(14, 19, 4, 1, '#7a2a2a'); p.px(13, 18, '#7a2a2a'); p.px(18, 18, '#7a2a2a');
    p.rect(3, 15, 4, 3, '#b98a5a'); p.rect(25, 15, 4, 3, '#b98a5a');
    p.rect(11, 27, 3, 3, '#333a50'); p.rect(18, 27, 3, 3, '#333a50'); p.rect(10, 29, 5, 2, '#222'); p.rect(17, 29, 5, 2, '#222');
  },
  giagiaka: function (p) {
    humanoid(p, { suit: '#202028', longRobe: true, skin: '#e8b88a', cheeks: '#e8887a' });
    p.ell(16, 5, 8, 4, '#15151f'); p.rect(8, 5, 16, 5, '#15151f'); p.px(12, 3, '#d8452f'); p.px(19, 3, '#f4d03f'); p.px(15, 2, '#d8452f'); // headscarf with flowers
    p.rect(11, 8, 4, 3, '#222'); p.rect(17, 8, 4, 3, '#222'); p.rect(12, 9, 2, 1, '#ffffff'); p.rect(18, 9, 2, 1, '#ffffff'); p.px(13, 9, '#111'); p.px(19, 9, '#111');
    p.line(10, 6, 14, 7, '#555'); p.line(22, 6, 18, 7, '#555'); p.rect(14, 14, 4, 1, '#7a2a2a');
    p.rect(11, 17, 10, 10, '#f4f4f4'); p.rect(11, 17, 10, 1, '#cfcfcf'); // apron
    p.rect(22, 9, 6, 11, '#e8b88a'); p.rect(23, 1, 7, 10, '#d8887a'); p.rect(23, 1, 7, 2, '#a85a4a'); p.rect(24, 9, 5, 2, '#a85a4a'); // raised arm and slipper
  },
  efoplistakos: function (p) {
    humanoid(p, { suit: '#1a2a5a', shirt: '#ffffff', tie: '#f4c430', pants: '#e8e8e8', skin: '#d8a070' });
    p.rect(10, 1, 12, 4, '#f4f4f4'); p.rect(8, 5, 16, 2, '#1a2a5a'); p.rect(15, 2, 2, 2, '#f4c430'); // yachting cap with a gold anchor badge
    p.rect(10, 8, 5, 3, '#111'); p.rect(17, 8, 5, 3, '#111'); p.rect(15, 9, 2, 1, '#111'); p.px(11, 8, '#6a6a8a'); p.px(18, 8, '#6a6a8a'); // sunglasses
    p.rect(13, 13, 6, 1, '#7a2a2a'); p.px(12, 12, '#7a2a2a'); p.px(19, 12, '#7a2a2a'); // smug smile
    p.rect(11, 18, 3, 1, '#f4c430'); p.rect(11, 20, 3, 1, '#f4c430'); // gold buttons
    p.rect(22, 21, 8, 3, '#f4f4f4'); p.rect(22, 23, 8, 1, '#c0392b'); p.rect(24, 18, 4, 3, '#cfd6e0'); p.rect(26, 15, 1, 3, '#8a8a98'); // toy ship in his hand
    p.rect(1, 22, 6, 5, '#2d6f9a'); p.rect(2, 23, 4, 1, '#ffffff'); // the folded sea chart
  },
  kafenovios: function (p) {
    humanoid(p, { suit: '#7a5a3a', shirt: '#f4f4f4', pants: '#3a3a4a', skin: '#e0a878', cheeks: '#e8887a' });
    p.rect(9, 2, 14, 4, '#4a4a52'); p.rect(8, 5, 16, 2, '#33333a'); // flat cap
    eyes(p, 8); p.rect(11, 11, 10, 2, '#a8a8b0'); p.rect(14, 13, 4, 1, '#7a2a2a'); // grey moustache
    p.rect(11, 18, 2, 6, '#5a3a22'); p.rect(19, 18, 2, 6, '#5a3a22'); // waistcoat edges
    p.rect(24, 22, 5, 4, '#f4f4f4'); p.rect(25, 21, 3, 1, '#5a3a22'); p.px(29, 23, '#f4f4f4'); p.px(29, 24, '#f4f4f4'); // the little coffee cup
    p.rect(1, 15, 7, 9, '#e8e4d0'); p.rect(2, 17, 5, 1, '#8a8a98'); p.rect(2, 19, 5, 1, '#8a8a98'); p.rect(2, 21, 3, 1, '#8a8a98'); // newspaper
    p.px(8, 26, '#8a2a1a'); p.px(7, 27, '#8a2a1a'); p.px(9, 27, '#8a2a1a'); p.px(8, 28, '#8a2a1a'); // worry beads, under the hand
  },
  vouleftakos: function (p) {
    humanoid(p, { suit: '#1d3278', shirt: '#ffffff', tie: '#d03030', cheeks: '#e8887a' });
    p.ell(16, 4, 7, 3, '#5a3a22'); p.rect(9, 4, 14, 3, '#5a3a22'); p.rect(9, 6, 2, 3, '#9a9aa8'); p.rect(21, 6, 2, 3, '#9a9aa8'); // hair with grey temples
    eyes(p, 8); p.rect(14, 13, 4, 1, '#7a2a2a'); p.px(13, 12, '#7a2a2a'); p.px(18, 12, '#7a2a2a');
    p.line(11, 17, 20, 25, '#f4c430'); p.line(12, 17, 21, 25, '#f4c430'); // sash
    p.rect(11, 18, 3, 2, '#f4c430'); // party pin
    p.rect(22, 15, 8, 10, '#8a8a99'); p.rect(24, 16, 4, 1, '#222'); p.rect(23, 18, 6, 5, '#c8ccd8'); p.px(26, 20, '#2f9a4a'); // the ballot box
  },
  batsonos: function (p) {
    humanoid(p, { suit: '#1c2848', shirt: '#cfd6ea', tie: '#111', cheeks: '#e8887a' });
    p.rect(6, 16, 4, 5, '#1c2848'); p.rect(22, 16, 4, 5, '#1c2848'); // broad shoulders
    p.rect(9, 0, 14, 6, '#1c2848'); p.rect(7, 5, 18, 2, '#101830'); p.ell(16, 3, 3, 2, '#e8b030'); // tall cap with the ring badge
    p.rect(10, 8, 5, 3, '#111'); p.rect(17, 8, 5, 3, '#111'); p.rect(15, 9, 2, 1, '#111'); p.px(11, 8, '#6a6a8a'); p.px(18, 8, '#6a6a8a'); p.rect(14, 13, 4, 1, '#7a2a2a');
    p.rect(0, 12, 7, 16, '#26325a'); p.rect(1, 13, 5, 14, '#9fd4ff'); p.line(2, 14, 4, 20, '#e8f8ff'); // the riot shield
    p.rect(25, 10, 3, 18, '#222'); p.rect(26, 10, 1, 18, '#44444f'); // the baton
  },
  diakosdisko: function (p) {
    humanoid(p, { suit: '#241c34', longRobe: true, shirt: '#f4f4f4', cheeks: '#e8887a' });
    p.rect(10, 15, 12, 2, '#f4f4f4'); p.rect(14, 17, 4, 13, '#e0b020'); p.rect(15, 18, 2, 11, '#f4d86a'); // collar and a golden stole
    p.rect(11, 0, 10, 6, '#15151f'); p.rect(9, 5, 14, 2, '#15151f'); // tall black hat
    p.rect(10, 8, 12, 3, '#3a3a5a'); p.rect(11, 8, 4, 1, '#9fe8ff'); p.rect(17, 8, 4, 1, '#ff9fe8'); p.rect(14, 13, 4, 1, '#7a2a2a'); // mirrored sunglasses
    p.ell(26, 9, 4, 4, '#d8d8e8'); p.px(24, 8, '#8a8aa0'); p.px(26, 7, '#8a8aa0'); p.px(28, 9, '#8a8aa0'); p.px(25, 11, '#8a8aa0'); p.rect(26, 13, 1, 5, '#8a8a98'); // the disco ball
    p.px(29, 4, '#ffffff'); p.px(2, 10, '#ff9fe8'); p.px(3, 16, '#9fe8ff'); p.px(28, 20, '#ffffff'); // sparkles
  },
  monastiriaki: function (p) { // a novice in a brown robe with a grey beard, carrying a small piece of wall with a price tag (no cross, no icon)
    humanoid(p, { suit: '#5a4630', longRobe: true, shirt: '#e8dcc0', cheeks: '#e8887a' });
    p.rect(10, 1, 12, 5, '#2c2218'); p.rect(8, 5, 16, 2, '#1c1610'); // round dark cap
    eyes(p, 8); p.rect(12, 12, 8, 5, '#d4d4da'); p.rect(14, 13, 4, 1, '#8a8a96'); // beard
    p.rect(10, 22, 12, 2, '#d8c090'); p.rect(15, 24, 2, 5, '#d8c090'); // rope belt
    p.rect(23, 14, 8, 10, '#ece6d6'); p.rect(23, 14, 8, 3, '#b8a888'); p.rect(25, 19, 4, 1, '#d8d0bc'); p.rect(25, 21, 3, 1, '#d8d0bc'); // the piece of wall
    p.rect(26, 17, 3, 2, '#f4c430'); p.px(27, 17, '#8a6a10'); // its price tag
  },
  monimos: function (p) { // a tenured official: grey suit, thin hair, round glasses, a giant rubber stamp held high
    humanoid(p, { suit: '#7a8698', shirt: '#f4f4f4', tie: '#2a2a3a', cheeks: '#e8887a', pants: '#3a3a4a' });
    p.rect(11, 3, 10, 3, '#9a9aa6'); p.rect(9, 6, 3, 4, '#9a9aa6'); p.rect(20, 6, 3, 4, '#9a9aa6');
    p.rect(10, 7, 5, 4, '#222'); p.rect(17, 7, 5, 4, '#222'); p.rect(11, 8, 3, 2, '#bfe3f4'); p.rect(18, 8, 3, 2, '#bfe3f4'); p.rect(15, 8, 2, 1, '#222');
    p.px(13, 9, '#111'); p.px(19, 9, '#111'); p.rect(14, 13, 4, 1, '#7a2a2a');
    p.rect(24, 2, 6, 3, '#3a2a1a'); p.rect(25, 5, 4, 8, '#6a4a2a'); p.rect(23, 13, 8, 4, '#2a2a3a'); p.rect(24, 17, 6, 1, '#4a8a4a'); // the stamp: knob, handle, block, ink
    p.rect(2, 15, 8, 10, '#f4efe0'); p.rect(3, 17, 6, 1, '#8a8a99'); p.rect(3, 19, 6, 1, '#8a8a99'); p.rect(3, 21, 4, 1, '#8a8a99'); p.rect(5, 22, 3, 2, '#4a8a4a'); // a stamped paper
    p.rect(10, 26, 5, 1, '#2a2a3a'); p.rect(17, 26, 5, 1, '#2a2a3a');
  },
  influenza: function (p) { // a star influencer: gold hair, big sunglasses, a phone on a stick with a ring light, glitter
    humanoid(p, { suit: '#7a3ac8', cheeks: '#f0808a', pants: '#2a2a4a' });
    p.ell(16, 3, 8, 4, '#f0a030'); p.rect(8, 3, 16, 5, '#f0a030'); p.rect(7, 4, 3, 13, '#f0a030'); p.rect(22, 4, 3, 13, '#f0a030'); // long gold hair
    p.rect(9, 8, 6, 4, '#15151f'); p.rect(17, 8, 6, 4, '#15151f'); p.rect(15, 9, 2, 1, '#15151f'); p.px(10, 9, '#bfe3f4'); p.px(18, 9, '#bfe3f4'); // sunglasses
    p.rect(14, 13, 4, 1, '#d03060'); p.px(13, 12, '#d03060'); p.px(18, 12, '#d03060');
    p.rect(26, 14, 1, 14, '#8a8a98'); p.ell(26, 9, 5, 5, '#f4f4f4'); p.rect(24, 6, 5, 7, '#15151f'); p.rect(25, 7, 3, 5, '#8fc3ee'); // the stick, the ring light, the phone
    p.px(3, 6, '#ffffff'); p.px(2, 9, '#ff9fe8'); p.px(4, 12, '#9fe8ff'); p.px(5, 4, '#f4c430'); p.px(2, 14, '#f4c430'); // glitter
    p.rect(3, 22, 2, 1, '#ff9fe8'); p.rect(2, 23, 4, 1, '#ff9fe8'); p.rect(3, 24, 2, 1, '#ff9fe8'); // a small pink spark
  },
  kryptomakis: function (p) { // a trader in a dark hoodie with the hood up, wrap-around shades and a phone with a rising chart
    humanoid(p, { suit: '#2a2a3e', cheeks: '#e8887a', pants: '#1a1a28' });
    p.rect(8, 1, 16, 8, '#2a2a3e'); p.rect(7, 4, 3, 10, '#2a2a3e'); p.rect(22, 4, 3, 10, '#2a2a3e'); p.rect(11, 6, 10, 7, '#e0a878'); // hood around the face
    p.rect(10, 8, 12, 3, '#15151f'); p.rect(11, 8, 4, 1, '#3fe0e8'); p.rect(17, 8, 4, 1, '#3fe0e8'); p.rect(14, 13, 4, 1, '#7a2a2a');
    p.rect(12, 17, 8, 2, '#f4c430'); p.px(11, 18, '#f4c430'); p.px(20, 18, '#f4c430'); p.rect(15, 19, 2, 2, '#f4c430'); // a gold chain
    p.rect(22, 12, 8, 12, '#15151f'); p.rect(23, 13, 6, 10, '#0e1a2a'); p.rect(24, 20, 1, 2, '#2fbf5a'); p.rect(26, 17, 1, 4, '#2fbf5a'); p.rect(28, 14, 1, 5, '#2fbf5a'); p.rect(25, 18, 1, 2, '#e0483e'); // chart
    p.rect(2, 20, 6, 6, '#f4c430'); p.rect(3, 21, 4, 4, '#d8a020'); p.rect(4, 22, 2, 2, '#f4c430'); // a plain gold coin
  },
  nftarchis: function (p) { // the crypto ruler: a violet blazer, laser shades, a big gold chain, a framed pixel picture under his arm
    humanoid(p, { suit: '#5a2a9a', shirt: '#111', tie: '#f4c430', cheeks: '#e8887a', pants: '#1a1a28' });
    p.rect(10, 1, 12, 4, '#15151f'); p.rect(9, 4, 14, 2, '#15151f'); p.rect(9, 6, 2, 4, '#15151f'); p.rect(21, 6, 2, 4, '#15151f'); // slick black hair
    p.rect(10, 8, 12, 3, '#15151f'); p.rect(11, 9, 4, 1, '#ff4fa8'); p.rect(17, 9, 4, 1, '#ff4fa8'); p.rect(14, 13, 4, 1, '#7a2a2a');
    p.rect(11, 16, 10, 2, '#f4c430'); p.rect(11, 18, 2, 4, '#f4c430'); p.rect(19, 18, 2, 4, '#f4c430'); p.ell(16, 23, 3, 3, '#f4c430'); p.ell(16, 23, 2, 2, '#fff2a0'); // a heavy chain with a medallion
    p.rect(0, 11, 10, 12, '#f4c430'); p.rect(1, 12, 8, 10, '#2a2a3e'); // the frame
    p.rect(2, 13, 2, 2, '#3fe0e8'); p.rect(4, 13, 2, 2, '#ff4fa8'); p.rect(6, 13, 2, 2, '#3fe0e8'); p.rect(2, 15, 6, 2, '#ff4fa8'); p.rect(2, 17, 2, 2, '#f4c430'); p.rect(6, 17, 2, 2, '#3fe0e8'); p.rect(3, 19, 4, 2, '#3fe0e8'); // pixel art
  },
  star90: function (p) { // a star of the 90s: a huge permed blonde mane, a magenta jacket with shoulder pads and a microphone
    humanoid(p, { suit: '#c04aa8', shirt: '#f4f4f4', cheeks: '#f0808a', pants: '#2a2a4a' });
    p.rect(5, 15, 5, 4, '#c04aa8'); p.rect(22, 15, 5, 4, '#c04aa8'); p.rect(5, 15, 5, 1, '#f4c430'); p.rect(22, 15, 5, 1, '#f4c430'); // shoulder pads
    p.ell(16, 3, 10, 5, '#f0c860'); p.rect(6, 3, 20, 5, '#f0c860'); p.rect(5, 5, 4, 12, '#f0c860'); p.rect(23, 5, 4, 12, '#f0c860'); // the mane
    p.rect(9, 8, 6, 3, '#15151f'); p.rect(17, 8, 6, 3, '#15151f'); p.rect(15, 9, 2, 1, '#15151f'); p.rect(14, 13, 4, 1, '#d03060'); // sunglasses and lips
    p.rect(11, 18, 10, 2, '#f4c430'); p.px(13, 19, '#fff2a0'); p.px(18, 19, '#fff2a0'); // sequins
    p.rect(26, 12, 2, 10, '#555566'); p.ell(27, 10, 3, 3, '#aaaab8'); p.px(26, 9, '#e8e8f0'); // the microphone
  },
  rialito: function (p) { // a reality-show bruiser: sleeveless top, a red headband, huge arms, a camera light on the shoulder
    humanoid(p, { suit: '#34445e', cheeks: '#e8887a', pants: '#2a2a3a' });
    p.rect(3, 16, 5, 10, '#e0a878'); p.rect(24, 16, 5, 10, '#e0a878'); p.rect(3, 16, 5, 2, '#34445e'); p.rect(24, 16, 5, 2, '#34445e'); // bare muscular arms
    p.rect(10, 3, 12, 4, '#2a1c14'); p.rect(9, 6, 14, 2, '#c0392b'); p.rect(22, 6, 4, 2, '#c0392b'); p.rect(24, 8, 2, 3, '#c0392b'); // hair and the red headband
    eyes(p, 9); p.rect(14, 13, 4, 1, '#7a2a2a'); p.rect(11, 8, 3, 1, '#2a1c14'); p.rect(18, 8, 3, 1, '#2a1c14');
    p.rect(22, 9, 8, 6, '#15151f'); p.rect(28, 10, 3, 4, '#3a3a4a'); p.px(23, 10, '#e0483e'); p.px(24, 10, '#e0483e'); // the shoulder camera with its red light
    p.rect(12, 18, 8, 4, '#4a5a7a'); p.rect(14, 19, 4, 2, '#f4f4f4'); // a number patch
  },
  lobbylykaina: function (p) { // a lobbyist: sharp grey suit, grey hair in two wolf-ear tufts, a briefcase with a banknote sticking out
    humanoid(p, { suit: '#5a6a80', shirt: '#f4f4f4', tie: '#c0392b', cheeks: '#e8887a', pants: '#2a2a3a' });
    p.rect(9, 2, 14, 5, '#9a9aa6'); p.tri(9, 3, 8, 0, 12, 3, '#9a9aa6'); p.tri(23, 3, 24, 0, 20, 3, '#9a9aa6'); p.rect(7, 5, 3, 10, '#9a9aa6'); p.rect(22, 5, 3, 10, '#9a9aa6'); // hair and the two tufts
    p.rect(10, 8, 5, 3, '#222'); p.rect(17, 8, 5, 3, '#222'); p.rect(11, 9, 3, 1, '#d0e8f4'); p.rect(18, 9, 3, 1, '#d0e8f4'); p.rect(15, 9, 2, 1, '#222'); // glasses
    p.rect(14, 13, 4, 1, '#a02030'); p.px(13, 12, '#a02030'); p.px(18, 12, '#a02030');
    p.rect(21, 20, 10, 8, '#4a3a2a'); p.rect(21, 20, 10, 1, '#6a5a4a'); p.rect(24, 18, 4, 2, '#4a3a2a'); p.rect(23, 17, 6, 3, '#6ab86a'); p.px(26, 18, '#2a6a2a'); // briefcase, banknote
  },
  giotarchis: function (p) { // a yacht owner: a white captain's jacket with gold buttons, a white cap, a ship's wheel
    humanoid(p, { suit: '#f4f4f4', shirt: '#2a3a6a', cheeks: '#e8887a', pants: '#d8d0b8' });
    p.rect(8, 16, 16, 2, '#2a3a6a'); p.rect(8, 20, 16, 1, '#2a3a6a'); p.px(13, 22, '#f4c430'); p.px(18, 22, '#f4c430'); p.px(13, 24, '#f4c430'); p.px(18, 24, '#f4c430'); // stripes and buttons
    p.rect(9, 0, 14, 5, '#f4f4f4'); p.rect(7, 4, 18, 2, '#1a2a5a'); p.ell(16, 2, 2, 2, '#f4c430'); // the cap
    p.rect(10, 8, 12, 3, '#222'); p.rect(11, 9, 4, 1, '#9fd4ff'); p.rect(17, 9, 4, 1, '#9fd4ff'); p.rect(14, 13, 4, 1, '#7a2a2a'); p.rect(12, 12, 8, 1, '#d8d8d8'); // shades, moustache
    p.ell(26, 16, 5, 5, '#8a5a32'); p.ell(26, 16, 3, 3, '#e8f4ff'); p.rect(25, 9, 2, 14, '#8a5a32'); p.rect(19, 15, 14, 2, '#8a5a32'); // the ship's wheel
  },
  yperypourgos: function (p) { // the super-minister: a red cape, a navy suit with the sash of many offices, fourteen small badges in rows, a briefcase
    humanoid(p, { suit: '#1d3278', shirt: '#ffffff', tie: '#d03030', cheeks: '#e8887a' });
    p.rect(5, 15, 3, 14, '#c0392b'); p.rect(24, 15, 3, 14, '#c0392b'); p.rect(4, 26, 5, 3, '#a02a20'); p.rect(23, 26, 5, 3, '#a02a20'); // the cape behind the shoulders
    p.ell(16, 4, 7, 3, '#4a2a1a'); p.rect(9, 4, 14, 3, '#4a2a1a'); p.rect(9, 6, 2, 3, '#bdbdc4'); p.rect(21, 6, 2, 3, '#bdbdc4');
    eyes(p, 8); p.rect(14, 13, 4, 1, '#7a2a2a'); p.px(13, 12, '#7a2a2a'); p.px(18, 12, '#7a2a2a');
    p.line(11, 17, 20, 25, '#f4c430'); p.line(12, 17, 21, 25, '#f4c430'); // sash
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) p.px(12 + col * 2, 19 + row * 2, (row + col) % 2 ? '#f4c430' : '#e8e8f0'); // the badges
    p.rect(1, 22, 9, 7, '#6a4a2a'); p.rect(3, 20, 5, 2, '#6a4a2a'); p.rect(1, 22, 9, 1, '#8a6a4a'); p.px(5, 25, '#f4c430'); // briefcase
  },
  matanthropos: function (p) { // the riot-police man in full armour: a visor helmet, chest plate, a tall shield, a baton
    humanoid(p, { suit: '#1a2238', shirt: '#2a3452', cheeks: '#e8887a', pants: '#1a2238' });
    p.rect(5, 15, 6, 6, '#2a3452'); p.rect(21, 15, 6, 6, '#2a3452'); p.rect(11, 16, 10, 8, '#3a4666'); p.rect(11, 16, 10, 1, '#5a6686'); p.rect(15, 17, 2, 6, '#2a3452'); // armour plate
    p.rect(8, 0, 16, 9, '#222a44'); p.rect(7, 4, 18, 3, '#222a44'); p.rect(9, 6, 14, 3, '#5a8ab0'); p.rect(9, 6, 14, 1, '#8ac0e8'); p.rect(15, 7, 2, 4, '#222a44'); // helmet and visor
    p.rect(12, 12, 8, 3, '#222a44'); p.rect(14, 13, 4, 1, '#7a2a2a');
    p.rect(0, 10, 8, 20, '#2a3452'); p.rect(1, 11, 6, 18, '#9fd4ff'); p.line(2, 13, 5, 22, '#e8f8ff'); p.rect(0, 10, 8, 1, '#5a6686'); p.rect(0, 29, 8, 1, '#5a6686'); // the tall shield
    p.rect(25, 6, 3, 22, '#222'); p.rect(26, 6, 1, 22, '#4a4a5a'); p.rect(25, 24, 3, 4, '#555566'); // the baton
  },
  despotakis: function (p) { // the little bishop: a black robe, a tall black hat with a veil, a white beard, mirrored shades, a golden staff with a disco ball (no cross)
    humanoid(p, { suit: '#241c34', longRobe: true, shirt: '#f4f4f4', cheeks: '#e8887a' });
    p.rect(10, 15, 12, 2, '#f4f4f4'); p.rect(13, 17, 6, 13, '#e0b020'); p.rect(14, 18, 4, 11, '#f4d86a'); p.rect(13, 22, 6, 1, '#a07810'); // collar and a broad golden stole
    p.rect(10, 0, 12, 6, '#15151f'); p.rect(8, 5, 16, 2, '#15151f'); p.rect(8, 6, 3, 8, '#15151f'); p.rect(21, 6, 3, 8, '#15151f'); // the tall hat with its veil
    p.rect(10, 8, 12, 3, '#3a3a5a'); p.rect(11, 8, 4, 1, '#9fe8ff'); p.rect(17, 8, 4, 1, '#ff9fe8'); // mirrored shades
    p.rect(12, 12, 8, 7, '#e8e8f0'); p.rect(14, 13, 4, 1, '#8a8a96'); p.rect(13, 16, 6, 2, '#cfcfda'); // the long white beard
    p.rect(27, 8, 2, 22, '#e0b020'); p.rect(27, 8, 1, 22, '#f4d86a'); p.ell(28, 5, 4, 4, '#d8d8e8'); p.px(26, 4, '#8a8aa0'); p.px(28, 3, '#8a8aa0'); p.px(30, 5, '#8a8aa0'); p.px(27, 7, '#8a8aa0'); // the staff and its disco ball
    p.px(2, 6, '#ffffff'); p.px(3, 12, '#ff9fe8'); p.px(2, 20, '#9fe8ff'); // sparkles
  },
  tavlilordos: function (p) { // a backgammon lord: a plum velvet jacket, white hair under a crown of two dice, a gold monocle, the board under his arm
    humanoid(p, { suit: '#6a2a4a', shirt: '#f4f4f4', tie: '#d8a82a', pants: '#2a2a3a', cheeks: '#e8887a' });
    p.rect(9, 3, 14, 3, '#d8d8de'); p.rect(9, 5, 3, 4, '#d8d8de'); p.rect(20, 5, 3, 4, '#d8d8de'); // white hair
    p.rect(10, 0, 5, 4, '#f4f4f4'); p.px(11, 1, '#111'); p.px(13, 2, '#111'); p.rect(17, 0, 5, 4, '#f4f4f4'); p.px(18, 1, '#111'); p.px(20, 1, '#111'); p.px(19, 2, '#111'); p.px(18, 3, '#111'); p.px(20, 3, '#111'); // two dice
    eyes(p, 8); p.rect(17, 7, 5, 1, '#d8a82a'); p.rect(17, 11, 5, 1, '#d8a82a'); p.rect(17, 7, 1, 5, '#d8a82a'); p.rect(21, 7, 1, 5, '#d8a82a'); // the monocle
    p.rect(11, 12, 10, 2, '#d8d8de'); p.rect(14, 14, 4, 1, '#7a2a2a');
    p.rect(21, 15, 10, 13, '#6b4a2a'); p.rect(22, 16, 8, 11, '#d8c090'); p.rect(26, 16, 1, 11, '#6b4a2a'); // the board
    for (let k = 0; k < 3; k++) { p.tri(22 + k * 2, 16, 24 + k * 2, 16, 23 + k * 2, 21, '#a02e22'); p.tri(22 + k * 2, 26, 24 + k * 2, 26, 23 + k * 2, 22, '#2a2a3a'); }
    p.px(28, 18, '#f4f4f4'); p.px(28, 24, '#222'); // discs
  },
  giagiaexo: function (p) { // a grandmother in black with a studded scarf, mirrored shades and a giant red slipper held like a hammer
    humanoid(p, { suit: '#15151c', longRobe: true, skin: '#e8b88a', cheeks: '#e8887a' });
    p.ell(16, 5, 8, 4, '#15151f'); p.rect(8, 5, 16, 5, '#15151f'); for (let x = 9; x < 24; x += 3) p.px(x, 4, '#c8ccd4'); // scarf with metal studs
    p.rect(9, 8, 6, 3, '#3a3a5a'); p.rect(17, 8, 6, 3, '#3a3a5a'); p.rect(10, 8, 3, 1, '#9fe8ff'); p.rect(18, 8, 3, 1, '#9fe8ff'); p.rect(15, 9, 2, 1, '#222'); // mirrored shades
    p.rect(14, 14, 4, 1, '#7a2a2a'); p.rect(4, 15, 5, 3, '#15151c'); p.rect(23, 15, 5, 3, '#15151c'); // shoulder pads
    p.rect(11, 17, 10, 10, '#f4f4f4'); p.rect(11, 17, 10, 1, '#cfcfcf'); p.rect(11, 22, 10, 1, '#d8d0c0'); // apron
    p.rect(24, 8, 3, 12, '#e8b88a'); p.rect(21, 0, 10, 9, '#d8452f'); p.rect(21, 0, 10, 2, '#a02e22'); p.rect(21, 6, 10, 3, '#8a2018'); p.rect(24, 3, 4, 1, '#f4c430'); // the huge slipper
  },
  elegktis: function (p) { // an inspector of the future: a grey suit, a flat cap with a badge, a glowing cyan visor, a clipboard of ticked boxes
    humanoid(p, { suit: '#44505e', shirt: '#e8e8e8', tie: '#c0392b', pants: '#2e3846', cheeks: '#e8887a' });
    p.rect(10, 1, 12, 4, '#2e3846'); p.rect(8, 4, 16, 2, '#1e2836'); p.rect(15, 2, 2, 2, '#f4c430'); // flat cap with a badge
    p.rect(9, 7, 14, 4, '#15202a'); p.rect(10, 8, 12, 2, '#3fe0e8'); p.rect(10, 8, 12, 1, '#a8f4f8'); // the visor
    p.rect(12, 13, 8, 1, '#8a8a96'); p.rect(14, 14, 4, 1, '#7a2a2a');
    p.rect(22, 13, 9, 13, '#8a6a3a'); p.rect(23, 14, 7, 11, '#f4f0e0'); p.rect(25, 12, 3, 2, '#c8c8d0'); // clipboard
    for (let y = 16; y < 24; y += 3) { p.rect(24, y, 2, 2, '#2f9a4a'); p.rect(27, y, 2, 1, '#8a8a99'); }
    p.rect(2, 20, 7, 6, '#2a2a3a'); p.rect(3, 21, 5, 2, '#9fe8ff'); p.rect(3, 24, 5, 1, '#f4c430'); // a pocket scanner
  },
  ktimatomesitis: function (p) { // a property agent: a beige suit, a grey beard, a round cap, a FOR SALE board on a post and a ring of gold keys
    humanoid(p, { suit: '#8a7a5a', shirt: '#f4f4f4', tie: '#2a4a8a', pants: '#4a4a3a', cheeks: '#e8887a' });
    p.rect(10, 1, 12, 5, '#2c2218'); p.rect(8, 5, 16, 2, '#1c1610');
    eyes(p, 8); p.rect(12, 12, 8, 5, '#d4d4da'); p.rect(14, 13, 4, 1, '#8a8a96'); // beard
    p.rect(28, 6, 2, 22, '#6b4a2a'); p.rect(22, 6, 9, 8, '#f4f4f4'); p.rect(22, 6, 9, 2, '#c0392b'); p.rect(24, 9, 5, 1, '#8a8a99'); p.rect(24, 11, 3, 1, '#8a8a99'); // the board
    p.rect(2, 18, 8, 7, '#d8c090'); p.rect(3, 19, 6, 5, '#ece6d6'); p.tri(2, 18, 10, 18, 6, 14, '#a02e22'); p.rect(5, 21, 2, 3, '#6b4a2a'); // a model house with a roof
    p.ell(26, 21, 2, 2, '#f4c430'); p.ell(26, 21, 1, 1, '#2c2218'); p.rect(26, 23, 1, 4, '#f4c430'); p.rect(26, 26, 2, 1, '#f4c430'); // gold key
  },
  rousfetolykos: function (p) { // a wolf in a tailored navy suit: grey fur, pointed ears, a briefcase of envelopes and a phone at the ear
    humanoid(p, { suit: '#1e2e50', shirt: '#f4f4f4', tie: '#c0392b', pants: '#1a2236', skin: '#9a9aa8' });
    p.tri(8, 6, 9, -1, 14, 3, '#82828f'); p.tri(24, 6, 23, -1, 18, 3, '#82828f'); p.tri(9, 4, 10, 1, 12, 3, '#d88a9a'); p.tri(23, 4, 22, 1, 20, 3, '#d88a9a'); // ears
    p.rect(10, 3, 12, 3, '#82828f');
    eyes(p, 8, '#7a4a10'); p.rect(12, 11, 8, 4, '#c8c8d2'); p.rect(14, 11, 4, 2, '#222'); p.px(13, 14, '#f4f4f4'); p.px(18, 14, '#f4f4f4'); // snout, nose and fangs
    p.rect(22, 9, 3, 5, '#222'); p.px(23, 10, '#8fc3ee'); // phone at the ear
    p.rect(1, 20, 10, 8, '#6a4a2a'); p.rect(3, 18, 6, 2, '#4a3a22'); p.rect(2, 16, 4, 4, '#f6efdc'); p.rect(6, 15, 4, 4, '#f6efdc'); p.px(4, 17, '#d8a030'); p.px(8, 16, '#d8a030'); // briefcase with envelopes
  },
  taxpayer: function (p) { // the last taxpayer: a worn grey suit, thin gold glasses, a tired smile, a briefcase and a receipt that is longer than he is
    humanoid(p, { suit: '#7a7f8c', shirt: '#f4f4f4', tie: '#2a4a8a', pants: '#3a3f50', cheeks: '#e8887a' });
    p.rect(10, 2, 12, 4, '#6a5a4a'); p.rect(9, 4, 3, 4, '#6a5a4a'); p.rect(20, 4, 3, 4, '#6a5a4a'); // thinning brown hair
    eyes(p, 8); p.rect(11, 7, 4, 1, '#d8a82a'); p.rect(17, 7, 4, 1, '#d8a82a'); p.rect(15, 8, 2, 1, '#d8a82a'); // thin gold glasses
    p.rect(13, 12, 6, 1, '#7a2a2a'); p.px(12, 11, '#7a2a2a'); p.px(19, 11, '#7a2a2a'); // a small, tired smile
    p.rect(1, 20, 9, 8, '#6b4a2a'); p.rect(2, 21, 7, 6, '#8a6a42'); p.rect(4, 19, 3, 1, '#4a3a22'); p.px(5, 23, '#d8a82a'); // briefcase
    p.rect(23, 14, 6, 17, '#fbf8ee'); p.rect(23, 14, 1, 17, '#d8d4c4'); p.rect(28, 14, 1, 17, '#d8d4c4'); // the receipt: a long paper strip
    for (let y = 16; y < 30; y += 3) { p.rect(24, y, 3, 1, '#8a8a99'); p.rect(27, y, 1, 1, '#2a4a8a'); }
    p.rect(24, 29, 4, 2, '#d8a82a'); // a gold stamp at its end
  },
  ilithiokratia: function (p) { // the fused parliament: three tiers of green benches grown into one body, a dozen small heads with the same blank smile, a gavel on top
    const head = function (x, y, hair) {
      p.rect(x, y, 5, 5, '#f0c08a'); p.rect(x, y, 5, 1, hair); p.px(x + 1, y + 2, '#111'); p.px(x + 3, y + 2, '#111'); p.rect(x + 1, y + 4, 3, 1, '#a85050');
      p.rect(x - 1, y + 5, 7, 3, '#33384d'); p.px(x + 2, y + 5, '#e0b040'); // a dark suit with a gold tie
    };
    for (const x of [8, 14, 20]) head(x, 1, '#6a5a4a');
    p.rect(5, 9, 22, 2, '#2f7a4a'); p.rect(5, 9, 22, 1, '#56a572');
    for (const x of [5, 11, 17, 23]) head(x, 11, x === 11 ? '#bdbdc4' : '#3a3a3a');
    p.rect(2, 19, 28, 2, '#2f7a4a'); p.rect(2, 19, 28, 1, '#56a572');
    for (const x of [2, 8, 14, 20, 26]) head(x, 21, x === 14 ? '#8a8a96' : '#4a3a2a');
    p.rect(0, 29, 32, 3, '#5a3a22'); p.rect(0, 29, 32, 1, '#7a5230');
    p.line(25, 6, 30, 1, '#8a5a32'); p.rect(27, 0, 4, 3, '#a8733f'); // a gavel
  },
  spyradonis: function (p) {
    humanoid(p, { suit: '#202026', shirt: '#ffffff', tie: '#f4c430', skin: '#e0805a' });
    p.ell(16, 3, 8, 3, '#bdbdc4'); p.rect(8, 3, 3, 7, '#bdbdc4'); p.rect(21, 3, 3, 7, '#bdbdc4'); // wild grey hair
    p.rect(10, 6, 5, 2, '#8a8a92'); p.rect(17, 6, 5, 2, '#8a8a92'); // bushy eyebrows
    p.rect(11, 8, 3, 2, '#ffffff'); p.rect(18, 8, 3, 2, '#ffffff'); p.px(12, 9, '#111'); p.px(19, 9, '#111');
    p.ell(16, 13, 4, 3, '#5a1a1a'); p.rect(13, 11, 6, 1, '#ffffff'); p.rect(14, 14, 4, 1, '#d8607a'); // the shouting mouth
    p.line(26, 8, 28, 10, '#ffffff'); p.line(27, 5, 30, 8, '#ffffff'); p.line(27, 11, 30, 12, '#ffffff'); // sound waves
    p.rect(11, 18, 5, 4, '#2a5fc4'); p.px(12, 18, '#f4c430'); p.px(14, 18, '#f4c430'); p.line(11, 19, 13, 21, '#ffffff'); p.line(15, 19, 13, 21, '#ffffff'); // logo pin: blue envelope with crown
    p.rect(1, 17, 8, 10, '#c0392b'); p.rect(2, 19, 6, 2, '#f4c430'); p.rect(1, 17, 1, 10, '#8a2a20'); // the thick book
  },
  mizotakis: function (p) {
    p.rect(9, 12, 14, 8, '#14234a'); p.rect(7, 14, 3, 6, '#14234a'); p.rect(22, 14, 3, 6, '#14234a'); // shoulders
    p.rect(14, 12, 4, 5, '#ffffff'); p.rect(15, 14, 2, 6, '#2a5fc4');
    p.ell(16, 7, 6, 6, '#f0c08a'); p.ell(16, 2, 6, 2, '#bdbdc4'); p.rect(10, 2, 2, 6, '#bdbdc4'); p.rect(20, 2, 2, 6, '#bdbdc4'); // neat grey hair
    p.rect(11, 6, 4, 3, '#222'); p.rect(17, 6, 4, 3, '#222'); p.rect(12, 7, 2, 1, '#ffffff'); p.rect(18, 7, 2, 1, '#ffffff'); p.px(15, 7, '#222'); // glasses
    p.rect(14, 11, 4, 1, '#7a2a2a');
    p.rect(11, 15, 10, 5, '#c8ccd8'); p.rect(12, 16, 8, 3, '#9fd4ff'); p.rect(11, 15, 10, 1, '#8a8e9a'); // the laptop
    p.rect(6, 19, 20, 12, '#8a5a32'); p.rect(6, 19, 20, 2, '#a8733f'); p.rect(6, 29, 20, 2, '#5a3a22'); // podium
    p.rect(11, 22, 10, 6, '#2a5fc4'); p.line(11, 22, 16, 26, '#ffffff'); p.line(21, 22, 16, 26, '#ffffff'); p.rect(12, 20, 8, 2, '#f4c430'); p.px(13, 19, '#f4c430'); p.px(16, 19, '#f4c430'); p.px(19, 19, '#f4c430'); // logo
  },
};
const creatureSprites = {};
function creatureSprite(speciesId) {
  if (creatureSprites[speciesId]) return creatureSprites[speciesId];
  const p = makePen(32, 32);
  creatureDrawers[speciesId](p);
  p.outline('#14142a');
  creatureSprites[speciesId] = p.canvas;
  return p.canvas;
}
function buildAllSprites() {
  buildTileSprites();
  for (const id of Object.keys(LOOKS)) charSheet(id);
  for (const id of Object.keys(SPECIES)) creatureSprite(id);
}

