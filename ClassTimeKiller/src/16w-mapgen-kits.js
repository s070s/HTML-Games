// ==== S16 MAP GENERATOR: KITS ====
// The five layouts of MAP-021 on one cell grid. A kit gets a context (settings, tileset, density, its own seeded random, grid
// dimensions) and returns a plan: def (compact MapKit rows: brushes, zones, lights; full trigger objects), size, and the anchor
// points MapGenPlace uses per mode (bases, centre, flags, points, sites, stages, path, core, exit, topSpots, itemSpots, hints,
// loot, ring, mirror). Grid rules that keep every map walkable (docs/api/mapgen.md): walls 0.6 m thick on cell borders, doors
// 2.4 x 3.2 m (MAP-004 double doorway) in the middle half of a border, props only in the inner part of a cell (2.8 m from
// its borders), platforms solid to the floor (nothing to get stuck under), ramps at most 35 degrees.

const MAPGEN_WALL = 0.6;
const MAPGEN_DOOR = [2.4, 3.2];         // width, height
const MAPGEN_WIDE_DOOR = 4;             // payload street doors
const MAPGEN_INNER_BORDER = 2.8;        // prop centres stay this far inside their cell
const MAPGEN_SCREEN = 5;                // a screen border: one wall piece this long in the middle, open on both sides
const MAPGEN_RAMP_RISE = 0.7;           // ramp rise per metre of run (35 degrees, the validator allows 40)
const MAPGEN_FLOOR = -1;                // floor slabs run from here to y = 0
const MAPGEN_LIGHT_LIFT = 1;            // lights hang this far above the walls
const MAPGEN_BRUSH_HEADROOM = 40;       // brushes left free under the budget for repair pillars
const MAPGEN_TOWER = { half: 3, heights: [4, 5.5], ladder: 1.6, pad: 4, padSize: 1, peak: 3, deck: 2.4, deckThick: 0.3, share: 0.5, screenOdds: 0.4 };
const MAPGEN_DEAD_ENDS = 3, MAPGEN_DEAD_END_TRIES = 12;   // GN1: at most this many dead-end branches, found in this many tries
const MAPGEN_DEAD_END_ROOMS = [1, 2];   // rooms per dead-end branch
const MAPGEN_ISLAND = { hedgeCover: 0.7, hedgeShift: 0.15, hedgeHeight: 4, pois: 6, poiCell: 16, poiShift: 3, scatterBase: 1,
  scatterClear: 4, treeSize: 1, treeHeight: 7, rockSize: 2, rockHeight: 1.8 };
const MAPGEN_RESERVED = 5;             // tower side kept free for a neighbour's ramp or pad
const MAPGEN_BORDER_ODDS = { door: 0.5, doors: 0.25, none: 0.15, screen: 0.1 };   // interior borders of the arena grids
const MAPGEN_ROW_NAMES = 'ABCDEFGH';
// Ramp side -> [dx, dz, MapKit ramp dir (the high side, next to the platform)].
const MAPGEN_SIDES = [[1, 0, '-x'], [0, 1, '-z'], [-1, 0, '+x'], [0, -1, '+z']];

// ---- The cell grid ----
function mapgenGrid(ctx, x0, z0) {
  const cols = ctx.cols, rows = ctx.rows, cell = ctx.cell;
  return {
    cols, rows, cell, x0: x0 === undefined ? -cols * cell / 2 : x0, z0: z0 === undefined ? -rows * cell / 2 : z0,
    floor: ctx.tileset ? ctx.tileset.floor : '', lights: true, mirrored: false,
    cells: Array.from({ length: cols * rows }, () => ({ used: true, module: null, name: '', turn: 0, east: false, height: 0, sides: [0, 0, 0, 0] })),
    vertical: new Array((cols + 1) * rows).fill('door'), horizontal: new Array(cols * (rows + 1)).fill('door'),
    verticalShift: new Float64Array((cols + 1) * rows), horizontalShift: new Float64Array(cols * (rows + 1)),
  };
}
const mapgenCell = (grid, c, r) => grid.cells[r * grid.cols + c];
const mapgenVertical = (grid, c, r) => r * (grid.cols + 1) + c;     // border on line x = x0 + c * cell, row r
const mapgenHorizontal = (grid, c, r) => r * grid.cols + c;         // border on line z = z0 + r * cell, column c
const mapgenCentreX = (grid, c) => grid.x0 + (c + 0.5) * grid.cell;
const mapgenCentreZ = (grid, r) => grid.z0 + (r + 0.5) * grid.cell;
// A side of a cell in world terms: east cells of a mirrored grid swap east and west.
const mapgenWorldSide = (cell, side) => (cell.east && side % 2 === 0 ? (side + 2) % 4 : side);
// Calls visit(c, r) for columns c0..c1 - 1 of rows r0..r1 - 1, row by row (cells or border lines: the caller picks the ranges).
function mapgenEach(c0, c1, r0, r1, visit) {
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) visit(c, r);
}
const mapgenRect = (grid, c, r, inset) => ({ x0: grid.x0 + c * grid.cell + inset, z0: grid.z0 + r * grid.cell + inset, x1: grid.x0 + (c + 1) * grid.cell - inset, z1: grid.z0 + (r + 1) * grid.cell - inset });

function mapgenPickWeighted(random, odds) {
  let roll = random.next();
  for (const key in odds) { roll -= odds[key]; if (roll <= 0) return key; }
  return Object.keys(odds)[0];
}
function mapgenEmptyPlan(size) {
  return { size, def: { brushes: [], zones: [], lights: [], triggers: [] }, mirror: false, bases: [[], []], centre: { x: 0, z: 0 }, flags: [], points: { default: [] },
    sites: [], stages: [], path: [], core: { x: 0, z: 0 }, exit: { x: 0, z: 0 }, topSpots: [], itemSpots: [], hints: [], loot: null, ring: null };
}
// Every perimeter border is a wall; borders between used and unused cells too.
function mapgenCloseGrid(grid) {
  const used = (c, r) => c >= 0 && r >= 0 && c < grid.cols && r < grid.rows && mapgenCell(grid, c, r).used;
  mapgenEach(0, grid.cols + 1, 0, grid.rows, (c, r) => mapgenCloseBorder(grid.vertical, mapgenVertical(grid, c, r), used(c - 1, r), used(c, r)));
  mapgenEach(0, grid.cols, 0, grid.rows + 1, (c, r) => mapgenCloseBorder(grid.horizontal, mapgenHorizontal(grid, c, r), used(c, r - 1), used(c, r)));
}
// A border between a used and an unused cell is a wall; one between two unused cells is nothing.
function mapgenCloseBorder(borders, index, before, after) {
  if (before !== after) borders[index] = 'wall';
  else if (!before) borders[index] = 'none';
}
// Mirrored maps (GN2..GN4): the east half copies the west half's choices across x = 0 (cells, borders and door shifts).
function mapgenMirrorGrid(grid) {
  const half = grid.cols / 2;
  mapgenEach(half, grid.cols, 0, grid.rows, (c, r) => mapgenMirrorCell(mapgenCell(grid, grid.cols - 1 - c, r), mapgenCell(grid, c, r)));
  mapgenEach(half + 1, grid.cols + 1, 0, grid.rows, (c, r) => mapgenCopyBorder(grid.vertical, grid.verticalShift, mapgenVertical(grid, grid.cols - c, r), mapgenVertical(grid, c, r), 1));
  mapgenEach(half, grid.cols, 0, grid.rows + 1, (c, r) => mapgenCopyBorder(grid.horizontal, grid.horizontalShift, mapgenHorizontal(grid, grid.cols - 1 - c, r), mapgenHorizontal(grid, c, r), -1));
}
function mapgenMirrorCell(source, target) {
  Object.assign(target, { used: source.used, module: source.module, name: source.name, turn: source.turn, east: true, height: source.height, sides: source.sides.slice() });
}
// A border copied onto its mirror line; sign -1 flips the door shift (a horizontal border runs along x, so its shift mirrors too).
function mapgenCopyBorder(borders, shifts, from, to, sign) {
  borders[to] = borders[from];
  shifts[to] = sign * shifts[from];
}
// Seeded door shifts: a door sits in the middle half of its border so neighbouring doors stay apart (three-lane rule).
function mapgenShiftDoors(ctx, grid) {
  const reach = grid.cell / 4;
  for (let i = 0; i < grid.verticalShift.length; i++) grid.verticalShift[i] = ctx.random.range(-reach, reach);
  for (let i = 0; i < grid.horizontalShift.length; i++) grid.horizontalShift[i] = ctx.random.range(-reach, reach);
}
function mapgenRandomBorders(ctx, grid, westOnly) {
  const limit = westOnly ? grid.cols / 2 : grid.cols;
  mapgenEach(1, limit, 0, grid.rows, (c, r) => { grid.vertical[mapgenVertical(grid, c, r)] = mapgenPickWeighted(ctx.random, MAPGEN_BORDER_ODDS); });
  mapgenEach(0, limit, 1, grid.rows, (c, r) => { grid.horizontal[mapgenHorizontal(grid, c, r)] = mapgenPickWeighted(ctx.random, MAPGEN_BORDER_ODDS); });
  mapgenWidenCorners(grid);
}

// Corner rooms have two inner borders only: a single door in each would leave two lanes (MAP-002), so they get two doors.
function mapgenWidenCorners(grid) {
  const lastColumn = grid.cols - 1, lastRow = grid.rows - 1;
  for (const row of [0, lastRow]) for (const column of [1, lastColumn]) mapgenWidenBorder(grid.vertical, mapgenVertical(grid, column, row));
  for (const row of [1, lastRow]) for (const column of [0, lastColumn]) mapgenWidenBorder(grid.horizontal, mapgenHorizontal(grid, column, row));
}

function mapgenWidenBorder(borders, index) {
  if (borders[index] === 'door' || borders[index] === 'wall') borders[index] = 'doors';
}
// Modules for the cells of one half (or all), share of cells per density; names unique per map (a number is added on repeats).
function mapgenFillModules(ctx, grid, westOnly) {
  mapgenEach(0, westOnly ? grid.cols / 2 : grid.cols, 0, grid.rows, (c, r) => mapgenFillCell(ctx, mapgenCell(grid, c, r)));
  mapgenFillNames(grid);
}
function mapgenFillCell(ctx, cell) {
  const row = ctx.random.pick(ctx.tileset.modules);
  cell.turn = ctx.random.int(0, 3);
  if (cell.used && !cell.module && ctx.random.chance(ctx.density.moduleShare)) cell.module = CAT.mapModules.byId(row[1]);
  if (!cell.name) cell.name = row[0];
}
// Zone names stay unique: a repeated name gets a number (the mirror adds West / East itself).
function mapgenFillNames(grid) {
  const seen = new Map();
  for (const cell of grid.cells) {
    const count = (seen.get(cell.name) || 0) + 1;
    seen.set(cell.name, count);
    if (count > 1) cell.name += ' ' + count;
  }
}

// ---- Emitting the grid as brushes, zones and lights ----
function mapgenEmitGrid(ctx, grid, plan, wallHeight) {
  mapgenEmitFloors(ctx, grid, plan);
  mapgenEmitBorders(ctx, grid, plan, wallHeight);
  mapgenEach(0, grid.cols, 0, grid.rows, (c, r) => mapgenEmitCell(ctx, grid, plan, c, r, wallHeight));
}
function mapgenEmitFloors(ctx, grid, plan) {
  for (let r = 0; r < grid.rows; r++) mapgenEmitFloorRow(grid, plan, r);
}
// One floor slab per run of used cells in a row.
function mapgenEmitFloorRow(grid, plan, r) {
  let start = -1;
  for (let c = 0; c <= grid.cols; c++) {
    const used = c < grid.cols && mapgenCell(grid, c, r).used;
    if (used && start < 0) start = c;
    if (used || start < 0) continue;
    plan.def.brushes.push([grid.floor, grid.x0 + start * grid.cell, MAPGEN_FLOOR, grid.z0 + r * grid.cell, grid.x0 + c * grid.cell, 0, grid.z0 + (r + 1) * grid.cell]);
    start = -1;
  }
}
function mapgenEmitBorders(ctx, grid, plan, wallHeight) {
  mapgenEach(0, grid.cols + 1, 0, grid.rows, (c, r) => {
    const index = mapgenVertical(grid, c, r);
    mapgenBorder(ctx, plan, 'z', grid.x0 + c * grid.cell, grid.z0 + r * grid.cell, grid.cell, grid.vertical[index], grid.verticalShift[index], wallHeight);
  });
  mapgenEach(0, grid.cols, 0, grid.rows + 1, (c, r) => {
    const index = mapgenHorizontal(grid, c, r);
    mapgenBorder(ctx, plan, 'x', grid.z0 + r * grid.cell, grid.x0 + c * grid.cell, grid.cell, grid.horizontal[index], grid.horizontalShift[index], wallHeight);
  });
}
// One border: axis = the direction the wall runs, fixed = its line, from = its start, kind = wall | door | doors | wide | screen | none.
function mapgenBorder(ctx, plan, axis, fixed, from, length, kind, shift, wallHeight) {
  if (kind === 'none') return;
  const middle = from + length / 2, material = ctx.tileset.wall;
  if (kind === 'screen' || kind === 'hedge') {
    const half = (kind === 'screen' ? MAPGEN_SCREEN : length * MAPGEN_ISLAND.hedgeCover) / 2;
    plan.def.brushes.push(MapKit.slab(material, axis, fixed, MAPGEN_WALL / 2, middle + shift - half, middle + shift + half, 0, wallHeight));
    return;
  }
  const doors = MAPGEN_BORDER_DOORS[kind](middle, shift, length);
  plan.def.brushes.push(...MapKit.wall(material, axis, fixed, MAPGEN_WALL, from, from + length, 0, wallHeight, doors));
  for (const door of doors) plan.hints.push(axis === 'z' ? { kind: 'choke', x: fixed, z: door[0] } : { kind: 'choke', x: door[0], z: fixed });
}
const MAPGEN_BORDER_DOORS = {
  wall: () => [],
  door: (middle, shift) => [[middle + shift, MAPGEN_DOOR[0], MAPGEN_DOOR[1]]],
  wide: (middle, shift) => [[middle + shift, MAPGEN_WIDE_DOOR, MAPGEN_DOOR[1]]],
  doors: (middle, shift, length) => [[middle - length / 4, MAPGEN_DOOR[0], MAPGEN_DOOR[1]], [middle + length / 4, MAPGEN_DOOR[0], MAPGEN_DOOR[1]]],
};
function mapgenEmitCell(ctx, grid, plan, c, r, wallHeight) {
  const cell = mapgenCell(grid, c, r);
  if (!cell.used) return;
  const x = mapgenCentreX(grid, c), z = mapgenCentreZ(grid, r), rect = mapgenRect(grid, c, r, 0);
  plan.def.zones.push([cell.name + (cell.east ? ' East' : grid.mirrored ? ' West' : ''), rect.x0, rect.z0, rect.x1, rect.z1]);
  if (grid.lights && plan.def.lights.length < MapRules.limits.lights) plan.def.lights.push([x, wallHeight + MAPGEN_LIGHT_LIFT, z, ctx.tileset.light, grid.cell]);
  plan.itemSpots.push({ x, z });
  mapgenCellProps(ctx, grid, plan, cell, x, z, wallHeight);
}
// The props of a cell's module (none without a module), centred on (x, z).
function mapgenCellProps(ctx, grid, plan, cell, x, z, wallHeight) {
  if (!cell.module) return;
  for (const prop of cell.module.props) mapgenProp(ctx, plan, prop, cell, x, z, grid.cell / 2 - MAPGEN_INNER_BORDER, wallHeight);
}
// A module prop, turned by the cell's quarter turns and mirrored in east cells.
function mapgenProp(ctx, plan, prop, cell, x, z, inner, wallHeight) {
  const [kind, u, v, width, depth, height] = prop;
  const turned = cell.turn % 2 === 1;
  let pu = [u, -v, -u, v][cell.turn] * inner, pv = [v, u, -v, -u][cell.turn] * inner;
  if (cell.east) pu = -pu;
  const w = turned ? depth : width, d = turned ? width : depth, cx = x + pu, cz = z + pv;
  const top = kind === 'pillar' ? wallHeight : height;
  const material = kind === 'pillar' ? ctx.tileset.pillar : kind === 'low' ? ctx.tileset.trim : kind === 'platform' ? ctx.tileset.platform : ctx.tileset.cover;
  plan.def.brushes.push([material, cx - w / 2, 0, cz - d / 2, cx + w / 2, top, cz + d / 2]);
  if (kind === 'platform') mapgenRamp(ctx, plan, cx, cz, w, d, top, mapgenWorldSide(cell, cell.turn), 0);
  if (kind === 'platform') plan.hints.push({ kind: 'sniper', x: cx, z: cz });
}
// A ramp on one side of a block (side index into MAPGEN_SIDES) from the floor (base) up to the block top.
function mapgenRamp(ctx, plan, cx, cz, width, depth, top, side, base) {
  const [dx, dz, dir] = MAPGEN_SIDES[side], run = (top - base) / MAPGEN_RAMP_RISE, half = 1.2;
  const near = dx ? cx + dx * width / 2 : cz + dz * depth / 2, far = near + (dx || dz) * run;
  const low = Math.min(near, far), high = Math.max(near, far);
  plan.def.brushes.push(dx ? [ctx.tileset.platform, low, base, cz - half, high, top, cz + half, dir] : [ctx.tileset.platform, cx - half, base, low, cx + half, top, high, dir]);
}

// ---- Shared anchors of the mirrored grids ----
function mapgenMirrorAnchors(grid, plan, rows) {
  const width = grid.cols * grid.cell, centreRow = Math.floor(grid.rows / 2), centreZ = mapgenCentreZ(grid, centreRow);
  plan.mirror = true;
  plan.centre = { x: 0, z: centreZ };
  plan.bases = [[mapgenColumnRect(grid, 0)], [mapgenColumnRect(grid, grid.cols - 1)]];
  plan.flags = [{ x: mapgenCentreX(grid, 0), z: centreZ }, { x: mapgenCentreX(grid, grid.cols - 1), z: centreZ }];
  const rowZ = rows.map((r) => mapgenCentreZ(grid, r));
  plan.points[3] = [{ x: -width / 4, z: centreZ }, { x: 0, z: centreZ }, { x: width / 4, z: centreZ }];
  plan.points[5] = [{ x: -width * 0.32, z: centreZ }, { x: -width * 0.16, z: rowZ[0] }, { x: 0, z: centreZ }, { x: width * 0.16, z: rowZ[0] }, { x: width * 0.32, z: centreZ }];
  plan.points.default = [{ x: 0, z: centreZ }, { x: -width / 4, z: rowZ[0] }, { x: width / 4, z: rowZ[rowZ.length - 1] }, { x: -width / 4, z: rowZ[rowZ.length - 1] }, { x: width / 4, z: rowZ[0] }];
  plan.topSpots = rowZ.filter((z) => z !== centreZ).map((z) => ({ x: 0, z })).concat([{ x: 0, z: centreZ }]);
}
function mapgenColumnRect(grid, c) {
  const rect = mapgenRect(grid, c, 0, 1);
  rect.z1 = grid.z0 + grid.rows * grid.cell - 1;
  return rect;
}
// The centre line of a mirrored grid stays open (no wall on x = 0): the centre spots and the top items stand on it.
function mapgenOpenCentre(grid) {
  for (let r = 0; r < grid.rows; r++) grid.vertical[mapgenVertical(grid, grid.cols / 2, r)] = 'none';
}
function mapgenRowsExcept(grid, skip) { return Array.from({ length: grid.rows }, (unused, r) => r).filter((r) => r !== skip); }

const MapGenKits = {
  // GN3 Mirror Arena: rooms with random borders and modules on the west half, mirrored east.
  mirror(ctx) {
    const grid = mapgenGrid(ctx), plan = mapgenEmptyPlan([ctx.cols * ctx.cell, ctx.generator.height, ctx.rows * ctx.cell]);
    grid.mirrored = true;
    mapgenShiftDoors(ctx, grid);
    mapgenRandomBorders(ctx, grid, true);
    mapgenFillModules(ctx, grid, true);
    mapgenMirrorGrid(grid);
    mapgenOpenCentre(grid);
    mapgenCloseGrid(grid);
    mapgenEmitGrid(ctx, grid, plan, ctx.tileset.wallHeight);
    mapgenMirrorAnchors(grid, plan, mapgenRowsExcept(grid, Math.floor(grid.rows / 2)));
    return plan;
  },

  // GN2 Lanes and Sites: three lanes (rows) between the bases, walls with a few doors between the lanes, two sites near the
  // defenders (team 1, east), a contested middle. Geometry mirrored so both teams walk the same distances; roles are not.
  lanes(ctx) {
    const grid = mapgenGrid(ctx), plan = mapgenEmptyPlan([ctx.cols * ctx.cell, ctx.generator.height, ctx.rows * ctx.cell]);
    const payload = ctx.settings.modes.includes('payload'), half = grid.cols / 2;
    grid.mirrored = true;
    mapgenShiftDoors(ctx, grid);
    for (let c = 0; c < half; c++) for (let r = 0; r < grid.rows; r++) this.laneBorders(ctx, grid, c, r, payload);
    mapgenFillModules(ctx, grid, true);
    if (payload) for (let c = 0; c < half; c++) mapgenCell(grid, c, 1).module = null;      // the payload street stays clear
    mapgenMirrorGrid(grid);
    mapgenOpenCentre(grid);
    mapgenCloseGrid(grid);
    mapgenEmitGrid(ctx, grid, plan, ctx.tileset.wallHeight);
    mapgenMirrorAnchors(grid, plan, [0, 2]);
    this.laneObjectives(grid, plan);
    return plan;
  },
  laneBorders(ctx, grid, c, r, payload) {
    if (c > 0) grid.vertical[mapgenVertical(grid, c, r)] = r === 1 && payload ? 'wide' : ctx.random.pick(['door', 'doors', 'screen']);
    if (r > 0) grid.horizontal[mapgenHorizontal(grid, c, r)] = c === 0 ? 'none' : c % 2 === 1 ? 'door' : 'wall';     // bases open, lanes joined every other cell
    if (payload && r === 1 && c > 0) grid.verticalShift[mapgenVertical(grid, c, r)] = (c % 2 ? 1 : -1) * grid.cell * 0.2;
  },
  laneObjectives(grid, plan) {
    const north = mapgenCentreZ(grid, 2), south = mapgenCentreZ(grid, 0), column = (share) => mapgenCentreX(grid, Math.min(grid.cols - 2, Math.round(grid.cols * share)));
    const sitePair = (c) => [{ x: mapgenCentreX(grid, c), z: north }, { x: mapgenCentreX(grid, c), z: south }];
    plan.sites = sitePair(grid.cols - 2);
    // Site columns in the defenders' half short of their base: placement picks the one nearest the spawn-to-site walk window.
    plan.siteOptions = Array.from({ length: grid.cols / 2 - 1 }, (unused, index) => sitePair(grid.cols / 2 + index));
    plan.stages = [0.34, 0.5, 0.67].map((share) => [{ x: column(share), z: north }, { x: column(share), z: south }]);
    plan.path = [];
    for (let c = 0; c < grid.cols; c++) {
      plan.path.push({ x: mapgenCentreX(grid, c), z: 0 });
      if (c + 1 < grid.cols) plan.path.push({ x: grid.x0 + (c + 1) * grid.cell, z: grid.verticalShift[mapgenVertical(grid, c + 1, 1)] });
    }
  },

  // GN4 Vertical Towers: solid towers with flat roofs over open streets, bridges between neighbouring roofs, ladders, ramps and
  // jump pads up; screen walls break the long street lines; each base is walled with two doors. Mirrored.
  towers(ctx) {
    const grid = mapgenGrid(ctx), plan = mapgenEmptyPlan([ctx.cols * ctx.cell, ctx.generator.height, ctx.rows * ctx.cell]);
    const half = grid.cols / 2, wallHeight = ctx.tileset.wallHeight + 2;
    grid.mirrored = true;
    mapgenShiftDoors(ctx, grid);
    grid.vertical.fill('none'); grid.horizontal.fill('none');
    const screen = (borders, index) => { if (ctx.random.chance(MAPGEN_TOWER.screenOdds)) borders[index] = 'screen'; };
    mapgenEach(1, half, 0, grid.rows, (c, r) => screen(grid.vertical, mapgenVertical(grid, c, r)));
    mapgenEach(0, half, 1, grid.rows, (c, r) => screen(grid.horizontal, mapgenHorizontal(grid, c, r)));
    for (let r = 0; r < grid.rows; r++) grid.vertical[mapgenVertical(grid, 1, r)] = 'doors';
    mapgenFillModules(ctx, grid, true);
    mapgenEach(1, half, 0, grid.rows, (c, r) => this.chooseTower(ctx, mapgenCell(grid, c, r)));
    mapgenEach(1, half, 0, grid.rows, (c, r) => this.bridges(grid, c, r));
    mapgenEach(1, half, 0, grid.rows, (c, r) => this.towerAccess(ctx, grid, c, r));
    mapgenMirrorGrid(grid);
    mapgenOpenCentre(grid);
    mapgenCloseGrid(grid);
    mapgenEmitGrid(ctx, grid, plan, wallHeight);
    mapgenEach(0, grid.cols, 0, grid.rows, (c, r) => this.emitTower(ctx, grid, plan, c, r));
    mapgenMirrorAnchors(grid, plan, mapgenRowsExcept(grid, Math.floor(grid.rows / 2)));
    return plan;
  },
  chooseTower(ctx, cell) {
    if (!ctx.random.chance(MAPGEN_TOWER.share)) return;
    cell.module = null;
    cell.height = ctx.random.pick(MAPGEN_TOWER.heights);
  },
  // Side codes: 0 free, 1 bridge, 2 ramp, 3 ladder, 4 jump pad, 5 reserved (index = MAPGEN_SIDES order: east, north, west, south).
  bridges(grid, c, r) {
    const cell = mapgenCell(grid, c, r);
    if (!cell.height) return;
    const east = c + 1 < grid.cols / 2 ? mapgenCell(grid, c + 1, r) : null, north = r + 1 < grid.rows ? mapgenCell(grid, c, r + 1) : null;
    if (east && east.height === cell.height) { cell.sides[0] = 1; east.sides[2] = 1; grid.vertical[mapgenVertical(grid, c + 1, r)] = 'none'; }
    if (north && north.height === cell.height) { cell.sides[1] = 1; north.sides[3] = 1; grid.horizontal[mapgenHorizontal(grid, c, r + 1)] = 'none'; }
  },
  // Ramps and pads only toward an inner neighbour of the west half (never the perimeter, a base wall or the centre line); the
  // neighbour keeps that side free so nothing lands on the ramp. Ladders go on any free side.
  towerAccess(ctx, grid, c, r) {
    const cell = mapgenCell(grid, c, r);
    if (!cell.height) return;
    const free = [0, 1, 2, 3].filter((side) => !cell.sides[side]);
    ctx.random.shuffle(free);
    const inner = free.filter((side) => this.innerNeighbour(grid, c, r, side));
    const climb = cell.height <= MAPGEN_TOWER.heights[0] ? 2 : 4;
    if (inner.length) this.claimSide(grid, c, r, inner[0], climb);
    if (inner.length > 1 && climb === 2) this.claimSide(grid, c, r, inner[1], 4);
    const ladder = free.find((side) => !cell.sides[side]);
    if (ladder !== undefined) cell.sides[ladder] = 3;
  },
  innerNeighbour(grid, c, r, side) {
    const [dx, dz] = MAPGEN_SIDES[side], nc = c + dx, nr = r + dz;
    if (nc < 1 || nc >= grid.cols / 2 || nr < 0 || nr >= grid.rows) return null;
    return mapgenCell(grid, nc, nr).sides[(side + 2) % 4] ? null : mapgenCell(grid, nc, nr);
  },
  claimSide(grid, c, r, side, kind) {
    const neighbour = this.innerNeighbour(grid, c, r, side);
    if (!neighbour) return;
    mapgenCell(grid, c, r).sides[side] = kind;
    neighbour.sides[(side + 2) % 4] = MAPGEN_RESERVED;
    if (side === 0) grid.vertical[mapgenVertical(grid, c + 1, r)] = 'none';
    if (side === 2) grid.vertical[mapgenVertical(grid, c, r)] = 'none';
    if (side === 1) grid.horizontal[mapgenHorizontal(grid, c, r + 1)] = 'none';
    if (side === 3) grid.horizontal[mapgenHorizontal(grid, c, r)] = 'none';
  },
  emitTower(ctx, grid, plan, c, r) {
    const cell = mapgenCell(grid, c, r), t = MAPGEN_TOWER;
    if (!cell.height) return;
    const x = mapgenCentreX(grid, c), z = mapgenCentreZ(grid, r), top = cell.height;
    plan.def.brushes.push([ctx.tileset.platform, x - t.half, 0, z - t.half, x + t.half, top, z + t.half]);
    plan.hints.push({ kind: 'sniper', x, z });
    for (let side = 0; side < 4; side++) {
      this.towerSide(ctx, grid, plan, cell.sides[side], mapgenWorldSide(cell, side), x, z, top);
    }
  },
  towerSide(ctx, grid, plan, kind, side, x, z, top) {
    const t = MAPGEN_TOWER, [dx, dz] = MAPGEN_SIDES[side];
    if (kind === 2) mapgenRamp(ctx, plan, x, z, t.half * 2, t.half * 2, top, side, 0);
    if (kind === 1 && (side === 0 || side === 1)) {
      const reach = grid.cell - t.half;
      plan.def.brushes.push(dx ? [ctx.tileset.trim, x + t.half, top - t.deckThick, z - t.deck / 2, x + reach, top, z + t.deck / 2]
        : [ctx.tileset.trim, x - t.deck / 2, top - t.deckThick, z + t.half, x + t.deck / 2, top, z + reach]);
    }
    if (kind === 3) {
      const face = t.half, depth = 0.6, wide = t.ladder / 2;
      const min = dx ? [x + dx * face + Math.min(0, dx * depth), 0, z - wide] : [x - wide, 0, z + dz * face + Math.min(0, dz * depth)];
      const max = dx ? [min[0] + depth, top, z + wide] : [x + wide, top, min[2] + depth];
      plan.def.triggers.push({ kind: 'ladder', min, max });
    }
    if (kind === 4) {
      const px = x + dx * (t.half + t.pad), pz = z + dz * (t.half + t.pad), size = t.padSize;
      plan.def.triggers.push({ kind: 'jumppad', min: [px - size, 0, pz - size], max: [px + size, 0.4, pz + size], target: [x, top, z], peak: t.peak });
    }
  },

  // GN1 Tile Chain (PvE): a self-avoiding chain of rooms Start - connectors - Objective - connectors - Exit joined door to door,
  // plus dead ends; unused cells stay solid rock (no floor). Team 0 starts in the Start room, the enemy gates are the Exit and
  // the dead ends.
  chain(ctx) {
    const grid = mapgenGrid(ctx), plan = mapgenEmptyPlan([ctx.cols * ctx.cell, ctx.generator.height, ctx.rows * ctx.cell]);
    const path = this.chainPath(ctx, grid), ends = this.deadEnds(ctx, grid, path);
    for (const cell of grid.cells) cell.used = false;
    grid.vertical.fill('wall'); grid.horizontal.fill('wall');
    for (const [c, r] of path.concat(ends.flat())) mapgenCell(grid, c, r).used = true;
    for (let i = 1; i < path.length; i++) this.joinCells(ctx, grid, path[i - 1], path[i]);
    for (const branch of ends) branch.forEach((step, i) => this.joinCells(ctx, grid, i ? branch[i - 1] : step.from, step));
    mapgenShiftDoors(ctx, grid);
    this.nameChain(ctx, grid, path, ends);
    mapgenFillModules(ctx, grid, false);
    mapgenCloseGrid(grid);
    mapgenEmitGrid(ctx, grid, plan, ctx.tileset.wallHeight);
    this.chainAnchors(grid, plan, path, ends);
    return plan;
  },
  // Random self-avoiding walk from an edge cell; the longest of a few tries (it never needs more than the grid).
  chainPath(ctx, grid) {
    const want = Math.round(grid.cols * grid.rows * 0.45);
    let best = [];
    for (let attempt = 0; attempt < 6 && best.length < want; attempt++) {
      const walk = this.walk(ctx, grid, [0, ctx.random.int(0, grid.rows - 1)], want);
      if (walk.length > best.length) best = walk;
    }
    return best;
  },
  walk(ctx, grid, start, want) {
    const path = [start], seen = new Set([start.join()]);
    while (path.length < want) {
      const options = this.freeNeighbours(grid, path[path.length - 1], seen);
      if (!options.length) break;
      options.sort((a, b) => b[0] - a[0]);                           // lean east so the chain crosses the map
      const next = ctx.random.chance(0.55) ? options[0] : ctx.random.pick(options);
      path.push(next);
      seen.add(next.join());
    }
    return path;
  },
  // The grid cells beside [c, r] that are not in `seen` (keys 'c,r').
  freeNeighbours(grid, [c, r], seen) {
    return MAPGEN_SIDES.map(([dx, dz]) => [c + dx, r + dz]).filter(([nc, nr]) => nc >= 0 && nr >= 0 && nc < grid.cols && nr < grid.rows && !seen.has(nc + ',' + nr));
  },
  // Up to three dead-end branches of one or two rooms off connector rooms (never off the start or the exit room).
  deadEnds(ctx, grid, path) {
    if (path.length < 3) return [];                    // no connector room to branch from
    const used = new Set(path.map((p) => p.join())), branches = [];
    for (let attempt = 0; attempt < MAPGEN_DEAD_END_TRIES && branches.length < MAPGEN_DEAD_ENDS; attempt++) {
      const from = path[ctx.random.int(1, path.length - 2)], rooms = ctx.random.int(MAPGEN_DEAD_END_ROOMS[0], MAPGEN_DEAD_END_ROOMS[1]);
      const branch = this.deadEnd(ctx, grid, from, rooms, used);
      if (branch.length) branches.push(branch);
    }
    return branches;
  },
  // One branch of up to `rooms` new rooms from `from`; each step remembers the room it comes from.
  deadEnd(ctx, grid, from, rooms, used) {
    const branch = [];
    let at = from;
    for (let step = 0; step < rooms; step++) {
      const options = this.freeNeighbours(grid, at, used);
      if (!options.length) break;
      const next = ctx.random.pick(options);
      next.from = at;
      branch.push(next);
      used.add(next.join());
      at = next;
    }
    return branch;
  },
  joinCells(ctx, grid, a, b) {
    const kind = ctx.random.chance(0.3) ? 'doors' : 'door';
    if (a[1] === b[1]) grid.vertical[mapgenVertical(grid, Math.max(a[0], b[0]), a[1])] = kind;
    else grid.horizontal[mapgenHorizontal(grid, a[0], Math.max(a[1], b[1]))] = kind;
  },
  nameChain(ctx, grid, path, ends) {
    const middle = path[Math.floor(path.length / 2)];
    const special = [[path[0], 'Entry Hall', 'plaza'], [middle, 'Core Room', 'plaza'], [path[path.length - 1], 'Exit Gate', 'plaza']];
    ends.forEach((branch, index) => special.push([branch[branch.length - 1], 'Side Gate ' + (index + 1), 'crates']));
    for (const [[c, r], name, module] of special) Object.assign(mapgenCell(grid, c, r), { name, module: CAT.mapModules.byId(module) });
  },
  chainAnchors(grid, plan, path, ends) {
    const room = ([c, r]) => mapgenRect(grid, c, r, 1), centre = ([c, r]) => ({ x: mapgenCentreX(grid, c), z: mapgenCentreZ(grid, r) });
    const middle = path[Math.floor(path.length / 2)];
    plan.bases = [[room(path[0])], [room(path[path.length - 1])].concat(ends.map((branch) => room(branch[branch.length - 1])))];
    plan.centre = centre(middle);
    plan.core = centre(middle);
    plan.exit = centre(path[path.length - 1]);
    plan.itemSpots = path.slice(1, -1).filter((p) => p !== middle).map(centre);
  },

  // GN5 Island (royale): fields on a lattice of hedges, each hedge covering 70% of its border, shifted to alternate ends on
  // neighbouring lines so every axis-aligned line meets a hedge within two fields; six walled loot compounds (POIs); trees and
  // rocks in the other fields; cliffs all round. The ring closes on the centre.
  island(ctx) {
    const grid = mapgenGrid(ctx), plan = mapgenEmptyPlan([ctx.cols * ctx.cell, ctx.generator.height, ctx.rows * ctx.cell]), i = MAPGEN_ISLAND;
    Object.assign(grid, { floor: ctx.tileset.ground, lights: false });
    grid.vertical.fill('hedge'); grid.horizontal.fill('hedge');
    mapgenEach(0, grid.cols + 1, 0, grid.rows, (c, r) => { grid.verticalShift[mapgenVertical(grid, c, r)] = this.hedgeShift(ctx, grid, c); });
    mapgenEach(0, grid.cols, 0, grid.rows + 1, (c, r) => { grid.horizontalShift[mapgenHorizontal(grid, c, r)] = this.hedgeShift(ctx, grid, r); });
    this.openCorners(grid);
    mapgenCloseGrid(grid);
    const pois = this.choosePois(ctx, grid);
    grid.cells.forEach((cell, index) => { cell.name = pois.has(index) ? ctx.random.pick(ctx.tileset.modules)[0] : 'Field ' + MAPGEN_ROW_NAMES[(index / grid.cols) | 0] + (index % grid.cols + 1); });
    mapgenFillNames(grid);
    mapgenEmitGrid(ctx, grid, plan, i.hedgeHeight);
    plan.itemSpots.length = 0;
    for (const index of pois) this.islandField(ctx, grid, plan, index, true);
    const room = Math.floor((MapRules.limits.brushes - MAPGEN_BRUSH_HEADROOM - plan.def.brushes.length) / (grid.cells.length - pois.size));
    const perField = Math.max(0, Math.min(i.scatterBase + ctx.density.scatter, room));
    for (let index = 0; index < grid.cells.length; index++) if (!pois.has(index)) this.islandField(ctx, grid, plan, index, false, perField);
    plan.centre = { x: mapgenCentreX(grid, grid.cols >> 1), z: mapgenCentreZ(grid, grid.rows >> 1) };
    plan.ring = { x: 0, z: 0, radius: Math.round(grid.cols * grid.cell * Math.SQRT1_2) };
    return plan;
  },
  // A corner field has only two hedges: they are left out, so a corner joins its two neighbours and has room for three lanes (MAP-002).
  openCorners(grid) {
    const last = grid.cols - 1, top = grid.rows - 1;
    for (const [c, r] of [[0, 0], [last, 0], [0, top], [last, top]]) {
      grid.vertical[mapgenVertical(grid, c === 0 ? 1 : last, r)] = 'none';
      grid.horizontal[mapgenHorizontal(grid, c, r === 0 ? 1 : top)] = 'none';
    }
  },
  hedgeShift(ctx, grid, line) { return (line % 2 ? 1 : -1) * grid.cell * MAPGEN_ISLAND.hedgeShift + ctx.random.range(-0.5, 0.5); },
  // Six fields apart from each other (never two side by side) hold the compounds.
  choosePois(ctx, grid) {
    const order = ctx.random.shuffle(grid.cells.map((cell, index) => index)), chosen = new Set();
    const apart = (a, b) => Math.max(Math.abs((a % grid.cols) - (b % grid.cols)), Math.abs(((a / grid.cols) | 0) - ((b / grid.cols) | 0))) > 1;
    for (const index of order) if (chosen.size < MAPGEN_ISLAND.pois && [...chosen].every((other) => apart(index, other))) chosen.add(index);
    return chosen;
  },
  islandField(ctx, grid, plan, index, isPoi, scatter) {
    const i = MAPGEN_ISLAND, c = index % grid.cols, r = (index / grid.cols) | 0, shift = () => ctx.random.range(-i.poiShift, i.poiShift);
    const cx = mapgenCentreX(grid, c) + shift(), cz = mapgenCentreZ(grid, r) + shift();
    if (isPoi) this.compound(ctx, plan, cx, cz);
    else this.scatter(ctx, plan, mapgenRect(grid, c, r, i.scatterClear), scatter);
    plan.itemSpots.push({ x: cx, z: cz });
  },
  // A walled loot compound: a one-cell grid with a door on every side and a module inside.
  compound(ctx, plan, cx, cz) {
    const cell = MAPGEN_ISLAND.poiCell, grid = mapgenGrid({ cols: 1, rows: 1, cell }, cx - cell / 2, cz - cell / 2);
    mapgenShiftDoors(ctx, grid);
    Object.assign(grid.cells[0], { name: '', module: CAT.mapModules.byId(ctx.random.pick(ctx.tileset.modules)[1]), turn: ctx.random.int(0, 3) });
    mapgenEmitBorders(ctx, grid, plan, MAPGEN_ISLAND.hedgeHeight);
    mapgenProps(ctx, grid, plan);
    if (plan.def.lights.length < MapRules.limits.lights) plan.def.lights.push([cx, MAPGEN_ISLAND.hedgeHeight + MAPGEN_LIGHT_LIFT, cz, ctx.tileset.light, cell]);
    if (!plan.loot) plan.loot = [];
    plan.loot.push(mapgenRect(grid, 0, 0, 1));
  },
  scatter(ctx, plan, rect, count) {
    const i = MAPGEN_ISLAND, placed = [];
    for (let tries = 0; tries < count * 4 && placed.length < count; tries++) {
      const x = ctx.random.range(rect.x0, rect.x1), z = ctx.random.range(rect.z0, rect.z1);
      if (placed.some((p) => mapgenFlat(p.x, p.z, x, z) < i.scatterClear)) continue;
      placed.push({ x, z });
      const tree = ctx.random.chance(0.6), half = (tree ? i.treeSize : i.rockSize) / 2;
      plan.def.brushes.push([tree ? ctx.tileset.pillar : ctx.tileset.cover, x - half, 0, z - half, x + half, tree ? i.treeHeight : i.rockHeight, z + half]);
    }
  },
};
// The props of every cell of a grid without its floors, zones or lights (compounds stand on the island ground).
function mapgenProps(ctx, grid, plan) {
  mapgenEach(0, grid.cols, 0, grid.rows, (c, r) => mapgenCellProps(ctx, grid, plan, mapgenCell(grid, c, r), mapgenCentreX(grid, c), mapgenCentreZ(grid, r), MAPGEN_ISLAND.hedgeHeight));
}
