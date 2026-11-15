// ---- Map screen (Χάρτης / Map) ----------------------------------------------------------------------------------------------------
// 240 x 160: a 12 px title bar, the 30 x 15 cell map (8 px cells) and a 28 px info panel (three 9 px lines). The land, routes and places
// are drawn once into an offscreen canvas when the screen opens (nothing on them changes while it is open); the player marker and the
// cursor are drawn on top every frame.
const MAP_TOP = 12;
const MAP_CELL = 8;
const MAP_PANEL_TOP = 132;
const MAP_TEXT_LIMIT = 232; // the widest text line of the screen must fit in this many logical pixels
const MAP_PIP = 7;
const MAP_PIN = ['.###.', '#####', '##.##', '#####', '.###.', '..#..', '..#..'];
const MAP_DIAMOND = ['..#..', '.###.', '#####', '.###.', '..#..'];
const MAP_STAR = ['..#..', '.###.', '#####', '.###.', '##.##'];
const MAP_PEAK = ['..#..', '.###.', '#####'];
const MAP_SNOW = ['..#..', '.#...'];
const MAP_COLOR = { sea: '#3c78b4', foam: '#8fc5ee', outside: '#9e9a92', peak: '#6b5a46', snow: '#faf5eb', pipOff: '#3a3a52', pipEdge: '#8a8a99', door: '#5a3296', bus: '#2a5fc4' };
function shadeColor(hex, factor) {
  const value = parseInt(hex.slice(1), 16);
  const parts = [value >> 16, (value >> 8) & 255, value & 255].map(function (part) { return Math.max(0, Math.min(255, Math.round(part * factor))); });
  return 'rgb(' + parts.join(',') + ')';
}
// Draws a shape of '#' cells with its top-left corner at (left, top); an outline colour adds a 1 px ring first.
function drawShapeOn(g, shape, left, top, color, outline) {
  if (outline) {
    g.fillStyle = outline;
    shape.forEach(function (row, ry) {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] !== '#') continue;
        g.fillRect(left + rx - 1, top + ry, 3, 1); g.fillRect(left + rx, top + ry - 1, 1, 3);
      }
    });
  }
  g.fillStyle = color;
  shape.forEach(function (row, ry) { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') g.fillRect(left + rx, top + ry, 1, 1); });
}
function worldBadgeCount(world) { return Object.keys(world.badges).length; }
function mapCellCentre(cell) { return [Math.round(cell[0] * MAP_CELL + MAP_CELL / 2), Math.round(cell[1] * MAP_CELL + MAP_CELL / 2)]; }

function mapDistrictAt(x, y) {
  const char = WORLD.grid[y][x];
  if (char === '~' || char === '#') return char;
  return Object.values(WORLD.districts).find(function (district) { return district.letter === char.toUpperCase(); }).id;
}
function drawMapTerrain(g, world) {
  const locked = {};
  for (const id of Object.keys(WORLD.districts)) locked[id] = districtState(world, id) === 'locked';
  for (let y = 0; y < WORLD.rows; y++) {
    for (let x = 0; x < WORLD.cols; x++) {
      const here = mapDistrictAt(x, y);
      const left = x * MAP_CELL;
      const top = y * MAP_CELL;
      if (here === '~') {
        g.fillStyle = MAP_COLOR.sea; g.fillRect(left, top, MAP_CELL, MAP_CELL);
        if ((x + y) % 2 === 0) { g.fillStyle = MAP_COLOR.foam; g.fillRect(left + 3, top + 4, 1, 1); } // a faint wave mark
        continue;
      }
      if (here === '#') { g.fillStyle = MAP_COLOR.outside; g.fillRect(left, top, MAP_CELL, MAP_CELL); continue; }
      const hill = WORLD.grid[y][x] !== WORLD.grid[y][x].toUpperCase();
      let factor = hill ? 0.82 : 1;
      if (locked[here]) factor *= 0.62;
      g.fillStyle = shadeColor(WORLD.districts[here].color, factor); g.fillRect(left, top, MAP_CELL, MAP_CELL);
      if (locked[here]) { // the checker pattern of a locked district
        g.fillStyle = 'rgba(27,27,47,0.3)';
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) g.fillRect(left + i * 2, top + j * 2, 2, 2);
      }
    }
  }
  // borders: a dark line between two districts, a light line along the coast
  for (let y = 0; y < WORLD.rows; y++) {
    for (let x = 0; x < WORLD.cols; x++) {
      const here = mapDistrictAt(x, y);
      if (here === '~') continue;
      const rightSide = x + 1 < WORLD.cols ? mapDistrictAt(x + 1, y) : '~';
      const below = y + 1 < WORLD.rows ? mapDistrictAt(x, y + 1) : '~';
      const leftSide = x > 0 ? mapDistrictAt(x - 1, y) : '~';
      const above = y > 0 ? mapDistrictAt(x, y - 1) : '~';
      if (rightSide !== here) { g.fillStyle = rightSide === '~' ? MAP_COLOR.foam : COLOR.ink; g.fillRect(x * MAP_CELL + MAP_CELL - 1, y * MAP_CELL, 1, MAP_CELL); }
      if (below !== here) { g.fillStyle = below === '~' ? MAP_COLOR.foam : COLOR.ink; g.fillRect(x * MAP_CELL, y * MAP_CELL + MAP_CELL - 1, MAP_CELL, 1); }
      g.fillStyle = MAP_COLOR.foam;
      if (leftSide === '~') g.fillRect(x * MAP_CELL, y * MAP_CELL, 1, MAP_CELL);
      if (above === '~' && y > 0) g.fillRect(x * MAP_CELL, y * MAP_CELL, MAP_CELL, 1);
    }
  }
  // hills and mountains (lower case in the grid): little peaks with a snow tip
  for (let y = 0; y < WORLD.rows; y++) {
    for (let x = 0; x < WORLD.cols; x++) {
      const char = WORLD.grid[y][x];
      if (char === '~' || char === '#' || char === char.toUpperCase()) continue;
      const centre = mapCellCentre([x, y]);
      drawShapeOn(g, MAP_PEAK, centre[0] - 2, centre[1], MAP_COLOR.peak);
      drawShapeOn(g, MAP_SNOW, centre[0] - 2, centre[1] - 2, MAP_COLOR.snow);
    }
  }
}
function drawMapRoutes(g, world) {
  for (const route of Object.values(WORLD.routes)) {
    if (districtState(world, route.district) === 'locked') continue;
    const endStates = [placeState(world, route.a), placeState(world, route.b)];
    if (!endStates.some(function (state) { return state === 'seen' || state === 'visited'; })) continue;
    g.beginPath();
    route.path.forEach(function (cell, index) {
      const centre = mapCellCentre(cell);
      if (index === 0) g.moveTo(centre[0] + 0.5, centre[1] + 0.5); else g.lineTo(centre[0] + 0.5, centre[1] + 0.5);
    });
    if (route.built && world.routes[route.id]) { // walked: a solid line with its number
      g.setLineDash([]); g.lineJoin = 'round';
      g.strokeStyle = COLOR.ink; g.lineWidth = 3; g.stroke();
      g.strokeStyle = COLOR.paper; g.lineWidth = 1; g.stroke();
      const middle = mapCellCentre(pointAlongPath(route.path, 0.5));
      const label = route.id.replace('route', '');
      const width = label.length * 4 + 3;
      g.fillStyle = COLOR.paper; g.fillRect(middle[0] - Math.floor(width / 2), middle[1] - 4, width, 7);
      g.font = FONT_SMALL; g.textAlign = 'center'; g.fillStyle = COLOR.ink; g.fillText(label, middle[0], middle[1] - 4);
    } else { // not walked yet: dotted
      g.setLineDash([2, 2]); g.strokeStyle = COLOR.ink; g.lineWidth = 1; g.stroke(); g.setLineDash([]);
    }
  }
}
function drawMapPlaces(g, world) {
  for (const node of Object.values(WORLD.nodes)) {
    const state = placeState(world, node.id);
    if (state === 'hidden') continue;
    const centre = mapCellCentre(node.cell);
    const cx = centre[0];
    const cy = centre[1];
    if (state === 'unknown') { // built later: a question mark
      g.fillStyle = COLOR.ink; g.fillRect(cx - 3, cy - 3, 7, 7);
      g.fillStyle = COLOR.paper; g.fillRect(cx - 2, cy - 2, 5, 5);
      g.font = FONT_SMALL; g.textAlign = 'center'; g.fillStyle = COLOR.ink; g.fillText('?', cx + 0.5, cy - 4);
      continue;
    }
    if (node.kind === 'door') { // the Parliament: a purple square with a gold frame
      g.fillStyle = COLOR.gold; g.fillRect(cx - 4, cy - 4, 9, 9);
      g.fillStyle = MAP_COLOR.door; g.fillRect(cx - 3, cy - 3, 7, 7);
      if (state === 'visited') { g.fillStyle = '#ffffff'; g.fillRect(cx - 1, cy - 1, 3, 3); } // entered: a white dot in the middle
      continue;
    }
    g.fillStyle = COLOR.ink; g.fillRect(cx - 3, cy - 3, 7, 7);
    g.fillStyle = state === 'seen' ? WORLD.districts[node.district].color : '#ffffff'; g.fillRect(cx - 2, cy - 2, 5, 5); // a seen place is a hollow square in its district colour; a visited one is white
    if (node.boss) drawShapeOn(g, MAP_DIAMOND, cx + 2, cy - 6, world.badges[node.district] ? COLOR.gray : COLOR.gold, COLOR.ink);
    if (world.stops[node.id]) { g.fillStyle = MAP_COLOR.bus; g.fillRect(cx - 6, cy + 2, 4, 3); } // a bus pip: a ΚΤΕΛ stop is open here
  }
}
function drawMapDistrictNames(g, world) {
  g.textAlign = 'center';
  for (const district of Object.values(WORLD.districts)) {
    const name = T(district.nameKey);
    const x = Math.round(district.label[0] * MAP_CELL);
    const y = Math.round(district.label[1] * MAP_CELL) - 4;
    g.font = FONT;
    const width = Math.ceil(g.measureText(name).width);
    g.fillStyle = 'rgba(246,239,220,0.88)'; g.fillRect(x - Math.floor(width / 2) - 1, y - 1, width + 2, 10);
    g.fillStyle = COLOR.ink; g.fillText(name, x, y);
    if (districtState(world, district.id) === 'cleared') drawShapeOn(g, MAP_STAR, x + Math.ceil(width / 2) + 3, y + 1, COLOR.gold, COLOR.ink);
    if (!district.built) {
      g.font = FONT_SMALL;
      const soon = T('map.soon');
      const soonWidth = Math.ceil(g.measureText(soon).width);
      g.fillStyle = 'rgba(246,239,220,0.88)'; g.fillRect(x - Math.floor(soonWidth / 2) - 1, y + 10, soonWidth + 2, 9);
      g.fillStyle = COLOR.ink; g.fillText(soon, x, y + 11);
    }
  }
}
function buildMapBase(world) {
  const base = document.createElement('canvas');
  base.width = WORLD.cols * MAP_CELL;
  base.height = WORLD.rows * MAP_CELL;
  const g = base.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.textBaseline = 'top';
  drawMapTerrain(g, world);
  drawMapRoutes(g, world);
  drawMapPlaces(g, world);
  drawMapDistrictNames(g, world);
  return base;
}

// The title bar: the title on the left, the six badge pips and "n/6" on the right. Measured, so a test can check they fit and do not touch.
function mapTitleLayout(won) {
  ctx.font = FONT;
  const title = T('map.title') + ' · ' + T('map.scale');
  const count = won + '/' + WORLD_BADGE_COUNT;
  const countWidth = Math.ceil(ctx.measureText(count).width);
  const countX = SCREEN_W - 4 - countWidth;
  const pipsX = countX - 4 - (WORLD_BADGE_COUNT * (MAP_PIP + 1) - 1);
  return { title: title, count: count, countX: countX, pipsX: pipsX, leftEnd: 4 + Math.ceil(ctx.measureText(title).width) };
}
// The three info lines for the selected place: page one (what is there, the keys) or the district sheet (page two).
function mapInfoLines(world, nodeId, sheet) {
  const node = WORLD.nodes[nodeId];
  const district = WORLD.districts[node.district];
  const levels = T('map.levels', { lo: district.levels[0], hi: district.levels[1] });
  if (!sheet) {
    const has = (node.has || []).map(function (key) { return T('world.has.' + key); }).join(', ');
    const placeLevels = node.levels ? T('map.levels', { lo: node.levels[0], hi: node.levels[1] }) : levels; // the Βουλή has its own range
    return [T('world.' + nodeId) + ' · ' + T(district.nameKey), has + ' · ' + placeLevels, T('map.keys')];
  }
  const boss = TRAINERS[district.bossTrainer] ? TRAINERS[district.bossTrainer].name : '???';
  const species = districtSpecies(district.id);
  const towns = Object.values(WORLD.nodes).filter(function (other) { return other.district === district.id && other.kind === 'town'; });
  return [
    T(district.nameKey) + ' · ' + T(world.badges[district.id] ? 'map.badge.won' : 'map.badge.no'),
    T('map.sheet.boss', { boss: boss }),
    T('map.sheet.stats', {
      met: species.filter(function (id) { return G.dex.seen[id]; }).length, all: species.length,
      seen: towns.filter(function (town) { return world.visited[town.id]; }).length, towns: towns.length,
    }) + ' · ' + levels,
  ];
}

function MapLayer() {
  this.opaque = true;
  this.frame = 0;
  this.sheet = false;
  this.world = G.world;
  this.base = buildMapBase(this.world);
  this.marker = worldMarker(G.player.map, G.player.x, G.player.y);
  this.cursor = this.startCursor();
  // Everything draw() shows is built here or when the cursor or the sheet changes, never per frame (reference section 11).
  this.won = worldBadgeCount(this.world);
  this.titleLayout = mapTitleLayout(this.won);
  this.markerPixel = this.marker ? mapCellCentre(this.marker.cell) : null;
  this.refreshInfo();
}
// The cursor's pixel position and its info lines; called when the cursor or the sheet changes.
MapLayer.prototype.refreshInfo = function () {
  this.cursorPixel = this.cursor ? mapCellCentre(WORLD.nodes[this.cursor].cell) : null;
  this.lines = this.cursor ? mapInfoLines(this.world, this.cursor, this.sheet) : null;
  this.districtWon = this.cursor ? !!this.world.badges[WORLD.nodes[this.cursor].district] : false;
};
// The cursor starts on the player's place; on a route, on the nearer end that is on the map.
MapLayer.prototype.startCursor = function () {
  const candidates = worldCandidates(this.world);
  const marker = this.marker;
  if (marker && !marker.onRoute && candidates.includes(marker.id)) return marker.id;
  if (marker && marker.onRoute) {
    const route = WORLD.routes[marker.id];
    const ends = marker.fraction < 0.5 ? [route.a, route.b] : [route.b, route.a];
    for (const id of ends) if (candidates.includes(id)) return id;
  }
  return candidates.length > 0 ? candidates[0] : null;
};
// Jumps to the nearest place in the pressed direction (a straight line is preferred over a sideways one).
MapLayer.prototype.moveCursor = function (direction) {
  if (!this.cursor) return;
  const vector = DIRS[direction];
  const from = WORLD.nodes[this.cursor].cell;
  let best = null;
  let bestScore = Infinity;
  for (const id of worldCandidates(this.world)) {
    if (id === this.cursor) continue;
    const cell = WORLD.nodes[id].cell;
    const along = (cell[0] - from[0]) * vector[0] + (cell[1] - from[1]) * vector[1];
    const across = Math.abs((cell[0] - from[0]) * vector[1] - (cell[1] - from[1]) * vector[0]);
    if (along <= 0) continue;
    const score = along + 2 * across;
    if (score < bestScore) { best = id; bestScore = score; }
  }
  if (best) { this.cursor = best; this.refreshInfo(); Sound.sfx(SOUNDS.move); }
};
MapLayer.prototype.update = function () {
  this.frame++;
  if (Input.pressed.b && this.sheet) { this.sheet = false; this.refreshInfo(); Sound.sfx(SOUNDS.back); return; }
  // back, the open key and the menu input all close the map; the layer below (pause menu or overworld) gets control back
  if (Input.pressed.b || Input.pressed.map || Input.pressed.menu) { Sound.sfx(SOUNDS.back); closeLayer(this); return; }
  if (Input.pressed.a && this.cursor) { this.sheet = !this.sheet; this.refreshInfo(); Sound.sfx(SOUNDS.confirm); return; }
  if (this.sheet) return;
  for (const name of ['up', 'down', 'left', 'right']) if (Input.repeat[name]) this.moveCursor(name);
};
MapLayer.prototype.draw = function () {
  ctx.font = FONT;
  const won = this.won;
  const layout = this.titleLayout;
  ctx.fillStyle = COLOR.ink; ctx.fillRect(0, 0, SCREEN_W, MAP_TOP);
  drawText(layout.title, 4, 2, COLOR.paper);
  for (let i = 0; i < WORLD_BADGE_COUNT; i++) {
    ctx.fillStyle = i < won ? COLOR.gold : MAP_COLOR.pipEdge; ctx.fillRect(layout.pipsX + i * (MAP_PIP + 1), 2, MAP_PIP, MAP_PIP);
    ctx.fillStyle = i < won ? '#c88a1c' : MAP_COLOR.pipOff; ctx.fillRect(layout.pipsX + i * (MAP_PIP + 1) + 1, 3, MAP_PIP - 2, MAP_PIP - 2);
  }
  drawText(layout.count, layout.countX, 2, COLOR.paper);
  ctx.drawImage(this.base, 0, MAP_TOP);
  const still = OPT.reduceMotion; // Reduced motion: no bobbing and no blinking
  if (this.marker) {
    const centre = this.markerPixel;
    const bob = still ? 0 : Math.floor(this.frame / 30) % 2; // 1 px every 500 ms
    drawShapeOn(ctx, MAP_PIN, centre[0] - 2, centre[1] + MAP_TOP - 10 - bob, COLOR.red, COLOR.ink);
  }
  if (this.cursor && blinkShows(this.frame, 4, still || OPT.flashesOff)) {
    const centre = this.cursorPixel;
    const left = centre[0] - 5;
    const top = centre[1] + MAP_TOP - 5;
    ctx.fillStyle = COLOR.gold;
    ctx.fillRect(left, top, 10, 1); ctx.fillRect(left, top + 9, 10, 1); ctx.fillRect(left, top, 1, 10); ctx.fillRect(left + 9, top, 1, 10);
  }
  ctx.fillStyle = COLOR.paper; ctx.fillRect(0, MAP_PANEL_TOP, SCREEN_W, SCREEN_H - MAP_PANEL_TOP);
  ctx.fillStyle = COLOR.ink; ctx.fillRect(0, MAP_PANEL_TOP, SCREEN_W, 1);
  if (!this.cursor) return;
  const lines = this.lines;
  for (let i = 0; i < lines.length; i++) drawText(lines[i], 4, MAP_PANEL_TOP + 2 + i * 9, i === 2 && !this.sheet ? COLOR.gray : COLOR.ink);
  if (this.sheet) { // the badge pip of the district at the right end of the first line
    const won = this.districtWon;
    ctx.fillStyle = won ? COLOR.gold : MAP_COLOR.pipEdge; ctx.fillRect(SCREEN_W - 4 - MAP_PIP, MAP_PANEL_TOP + 3, MAP_PIP, MAP_PIP);
    ctx.fillStyle = won ? '#c88a1c' : MAP_COLOR.pipOff; ctx.fillRect(SCREEN_W - 3 - MAP_PIP, MAP_PANEL_TOP + 4, MAP_PIP - 2, MAP_PIP - 2);
  }
};
// Opened from the pause menu, the overworld key (Q), Select or the touch pill; whoever opened it gets control back when it closes.
async function openMapScreen() {
  worldVisit(G.world, G.player.map, G.flags);
  Sound.sfx(SOUNDS.confirm);
  await openLayer(new MapLayer());
}

