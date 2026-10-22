// ==== S16 MAPS ====
// Hand-made maps are data rows (docs/ARCHITECTURE.md map format, docs/api/maps.md for the extras). This file holds the rule tables,
// the lookups every other section uses (Maps.get / forMode / spawnList / itemsFor / objectivesFor / zoneAt) and MapKit, the
// authoring helpers the map files use to write brushes, spawns, items and zones compactly. The scan and the validator are in
// 16s-maps-scan.js and 16v-maps-validate.js; the maps in 16b..16e; Data.define('maps') is in 16f.

// A key the table holds itself (never an inherited name such as __proto__ or constructor): mode, category and other key lookups.
const mapOwnKey = (table, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
const mapColorIs = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffff;   // a 0xRRGGBB map colour

// One place for every number and key list the map validator and the map files share.
const MapRules = {
  version: 1,
  materials: ['concrete', 'metal', 'wood', 'glass', 'dirt', 'water', 'grass', 'sand', 'ice', 'tile', 'grip'],   // grip: the MV05 climb walls (climbGripOnly)
  themes: ['foundry', 'ruins', 'station', 'canal', 'overgrowth', 'glacier'],                  // MAP-022 tilesets
  sightLimits: { arena: 60, tactical: 60, pve: 90, range: 60, puzzle: 60, large: 90, island: 150 }, // MAP-003, metres, by map category (pve: enemies approach along lanes)
  elements: ['kinetic', 'thermal', 'cryo', 'arc', 'toxin', 'void'],                            // HP-006 damage elements (hazard triggers name one)
  triggerKinds: ['jumppad', 'teleporter', 'ladder', 'water', 'hazard', 'killzone'],
  objectiveKinds: ['flag', 'flagBase', 'point', 'hill', 'bombsite', 'payloadPath', 'relic', 'core', 'bank', 'extract'],
  hintKinds: ['cover', 'sniper', 'choke', 'flank', 'dummy', 'guard', 'secret'],     // secret: a PvE level secret (14j PveLevel)
  itemGroups: ['power', 'armor', 'health', 'weapon', 'ammo'],
  // Spec backtick keys (PWR, WPN). Plain pickups (I01..I10) have no spec key: these keys are the map contract for S12.
  itemKeys: {
    health: ['healthvial', 'healthpack', 'healthcrate', 'megacell', 'vitalshard'],   // vitalshard (PU20): spots only appear in Ravager health matches (12a)
    armor: ['armorshard', 'lightplate', 'heavyplate'],
    ammo: ['ammobox', 'ammocache'],
    power: ['fury', 'warding', 'quickening', 'ghostveil', 'renewal', 'skyward', 'surplus', 'aegisbelt', 'berserk', 'sigil', 'bottomless', 'vampfang',
      'seer', 'springboots', 'guardianrune', 'scoutrune', 'ammorune', 'lightbearer', 'daybreak', 'halcyon'],
    weapon: ['maul', 'tanto', 'bulwark', 'warden', 'verdict', 'hush', 'sparklock', 'twinsting', 'wasp', 'hornet', 'riptide', 'needlethorn', 'vanguard', 'tempest',
      'ratchet', 'longshot', 'coilcaster', 'pulsecarbine', 'scattergun', 'hookjaw', 'shardcaster', 'frostbore', 'lancet', 'heron', 'kestrel', 'stakedriver',
      'talonbow', 'hailstorm', 'anvil', 'linker', 'ramjet', 'pitcher', 'kingfisher', 'gloop', 'kindler', 'ember', 'stormlash', 'starthrower', 'accelerator',
      'fusionmortar', 'lifter', 'twingate', 'auger', 'razorwind'],
  },
  topItemKeys: ['megacell', 'heavyplate'],        // with every 'power' item: the "top items" of MAP-005 (never two in one zone)
  // Per mode: spawn rule, objectives it needs (kind, minimum count) and whether the map's pickups are used (MODE table, spec s13).
  spawnRules: { free: [[-1, 16]], teams: [[0, 8], [1, 8]], coop: [[0, 4], [1, 4]], solo: [[-1, 2]] },
  modes: {
    ffa: ['free', [], true], duel: ['free', [], true], lms: ['free', [], false], gungame: ['free', [], false], infection: ['free', [], false],
    juggernaut: ['free', [], true], cursetag: ['free', [], false], roulette: ['free', [], false], bearer: ['free', [], false], royale: ['free', [], false],
    oddball: ['free', [['relic', 1]], true],
    tdm: ['teams', [], true], ctf: ['teams', [['flag', 2], ['flagBase', 2]], true], oneflag: ['teams', [['flag', 1], ['flagBase', 2]], true],
    dom: ['teams', [['point', 3]], true], conquest: ['teams', [['point', 5]], false], rush: ['teams', [['bombsite', 6]], false],
    hardpoint: ['teams', [['hill', 4]], true], payload: ['teams', [['payloadPath', 1]], false], control: ['teams', [['point', 1]], false],
    bomb: ['teams', [['bombsite', 2]], false], elim: ['teams', [], false], ghostops: ['teams', [['bombsite', 2]], false],
    attrition: ['teams', [], true], bank: ['teams', [['bank', 2]], false],
    horde: ['coop', [['core', 1]], false], endless: ['coop', [['core', 1], ['extract', 1]], false], fiends: ['coop', [], false],
    contract: ['coop', [['relic', 1], ['extract', 1]], false],
    range: ['solo', [], false], puzzle: ['solo', [['extract', 1]], false],
  },
  limits: {
    brushes: 450, lights: 24, zones: 4, hints: 6, pickupItems: 6, powerSpacing: 20, itemSpacing: 2, ffaSpawnSpacing: 5, topItemShare: 0.5,
    routes: 3, minExposure: 6, rampMaxDegrees: 40, shellThickness: 3,   // shell: brushes may extend this far outside size
  },
  groupOf(key) {
    for (const group in this.itemKeys) if (this.itemKeys[group].includes(key)) return group;
    return '';
  },
  rule(mode) { return mapOwnKey(this.modes, mode) ? this.modes[mode] : null; },
};

// Per-map lookup tables built once on first use (spawn lists per mode and team, zones sorted by volume). They are keyed by the row object:
// clone a row before editing it (the map editor does), or the tables would go stale.
const mapCache = new WeakMap();
const MAPS_RUNTIME_KEEP = 8;                                  // generated maps kept for lookups (each holds a few hundred brushes)
function mapCacheFor(map) {
  let entry = mapCache.get(map);
  if (!entry) { entry = { spawns: new Map(), zones: null }; mapCache.set(map, entry); }
  return entry;
}

const Maps = {
  rows: [],                                                     // filled by the 16b..16e files, defined as CAT.maps in 16f
  runtime: [],                                                  // maps registered at run time: the editor's saved maps and generated maps (MapGen keeps at most MAPS_RUNTIME_KEEP of its own), newest last
  get(idOrCode) {
    if (!CAT.maps) return null;
    const known = (map) => map.id === idOrCode || map.code === idOrCode;
    return CAT.maps.byId(idOrCode) || CAT.maps.find(known) || this.runtime.find(known) || null;
  },
  forMode(modeId) { return CAT.maps ? CAT.maps.concat(this.runtime).filter((map) => map.modes.includes(modeId)) : []; },   // hand-made, then runtime maps
  // The maps that survive a reload: hand-made maps and the editor's saved maps (pickers and saved setups list these; a generated map is gone after a reload).
  savedForMode(modeId) { return this.forMode(modeId).filter((map) => !map.gen); },
  // A generated map joins the lookups (Maps.get / forMode, Game.start({ map: id })); past the limit the oldest generated map drops out (editor maps stay).
  addRuntime(map) {
    this.registerRuntime(map);
    const generated = this.runtime.filter((row) => row.gen);
    if (generated.length > MAPS_RUNTIME_KEEP) this.unregisterRuntime(generated[0].id);
  },
  // A spawn serves an actor of `team` (-1 = free for all) in `mode` when team matches and its mode list is empty or has the mode.
  spawnMatches(spawn, modeId, team) { return spawn.team === team && mapServesMode(spawn, modeId); },
  // Cached list (never modified by callers): spawn rows for a mode and team. The cache is keyed by the map row: clone a row before editing it.
  spawnList(map, modeId, team) {
    const cache = mapCacheFor(map).spawns, key = modeId + ':' + team;
    if (!cache.has(key)) cache.set(key, map.spawns.filter((spawn) => this.spawnMatches(spawn, modeId, team)));
    return cache.get(key);
  },
  itemsFor(map, modeId) { return map.items.filter((item) => mapServesMode(item, modeId)); },
  objectivesFor(map, modeId, kind) {
    return map.objectives.filter((objective) => mapServesMode(objective, modeId) && (!kind || objective.kind === kind));
  },
  // Smallest callout zone holding the point (MAP-012); null outside every zone. Runs per frame for the HUD: no closures.
  zoneAt(map, x, y, z) {
    const entry = mapCacheFor(map);
    if (!entry.zones) entry.zones = map.zones.slice().sort((a, b) => mapBoxVolume(a) - mapBoxVolume(b));
    for (let i = 0; i < entry.zones.length; i++) if (mapInBox(entry.zones[i], x, y, z, 0, 0)) return entry.zones[i];
    return null;
  },
  sightLimit(map) { return MapRules.sightLimits[map.category] || MapRules.sightLimits.arena; },
  // Stable fingerprint of the map content (MAP-020: same seed gives the same hash).
  hash(map) {
    return hashString(JSON.stringify([map.size, map.brushes, map.spawns, map.items, map.objectives, map.zones, map.triggers, map.lights, map.navHints]));
  },
  validate(map) { return MapCheck.run(map).problems; },     // problem strings, empty = the map is sound (16v-maps-validate.js)
  report(map) { return MapCheck.run(map); },                // { problems, stats }
  // The map editor's saved maps join the lookups the same way (Maps.get / forMode / Game.start({ map: id })): a row with the same id is replaced.
  registerRuntime(map) {
    this.unregisterRuntime(map.id);
    this.runtime.push(map);
    return map;
  },
  unregisterRuntime(id) { this.runtime = this.runtime.filter((map) => map.id !== id); },
};

// The one mode rule: spawns, items and objectives carry an optional `modes` list; a missing or empty list serves every mode of the map.
const MAP_ALL_MODES = Object.freeze([]);
const mapModesOf = (entry) => entry.modes || MAP_ALL_MODES;
const mapServesMode = (entry, modeId) => {
  const modes = mapModesOf(entry);
  return modes.length === 0 || modes.includes(modeId);
};

// The one box rule: a point inside a { min, max } box (zone, trigger), each side grown by the margins (metres).
function mapInBox(box, x, y, z, marginXZ, marginY) {
  return x >= box.min[0] - marginXZ && x <= box.max[0] + marginXZ && z >= box.min[2] - marginXZ && z <= box.max[2] + marginXZ &&
    y >= box.min[1] - marginY && y <= box.max[1] + marginY;
}
function mapBoxVolume(box) { return (box.max[0] - box.min[0]) * (box.max[1] - box.min[1]) * (box.max[2] - box.min[2]); }

// ---- MapKit: authoring helpers. Compact rows in, plain map-format objects out (no state, run once at load). ----
// Compact rows: brush [material, x0,y0,z0, x1,y1,z1 (, rampDir)]; spawn group [team, modes, [[x,y,z,yawDegrees], ...]];
// item [key, x,y,z (, modes)]; zone [name, x0,z0, x1,z1 (, y0, y1)]; light [x,y,z,color,radius]; hint [kind, x,y,z].
const MAP_STEP = 0.45;                                   // DATA-003 step height: stairs risers and walkable steps never exceed it
const MAP_ZONE_FLOOR = -10, MAP_ZONE_CEILING = 60;      // default vertical extent of a callout zone, metres
const MAP_CRATE_SIZE = 1.2;                             // a breakable crate's edge, metres (S08 props, W41 lifts it)
const MapKit = {
  brush(row) {
    const brush = { shape: row.length > 7 ? 'ramp' : 'box', min: [row[1], row[2], row[3]], max: [row[4], row[5], row[6]], material: row[0] };
    if (row.length > 7) brush.dir = row[7];
    return brush;
  },
  spawns(groups) {
    const out = [];
    for (const [team, modes, points] of groups) for (const p of points) out.push({ x: p[0], y: p[1], z: p[2], yaw: p[3], team, modes });
    return out;
  },
  item(row) {
    return { x: row[1], y: row[2], z: row[3], item: row[0], group: MapRules.groupOf(row[0]), modes: row[4] || [] };
  },
  zone(row) {
    return { name: row[0], min: [row[1], row.length > 6 ? row[5] : MAP_ZONE_FLOOR, row[2]], max: [row[3], row.length > 6 ? row[6] : MAP_ZONE_CEILING, row[4]] };
  },
  light(row) { return { x: row[0], y: row[1], z: row[2], color: row[3], radius: row[4] }; },
  hint(row) { return { kind: row[0], x: row[1], y: row[2], z: row[3] }; },
  objective(row) { return Object.assign({ team: -1, radius: 3, path: [], modes: [] }, row); },
  // Breakable crates (S08 props with the PROP_FIELDS defaults): one MAP_CRATE_SIZE box per [x, z (, y)] low corner, y = 0 when left out.
  crates(corners) {
    return corners.map(([x, z, base]) => {
      const y = base || 0;
      return { min: [x, y, z], max: [x + MAP_CRATE_SIZE, y + MAP_CRATE_SIZE, z + MAP_CRATE_SIZE] };
    });
  },
  // Expands a map definition (compact lists, see above) into a full map row.
  make(def) {
    const row = Object.assign({}, def);
    row.brushes = def.brushes.map((r) => this.brush(r));
    row.spawns = this.spawns(def.spawns);
    row.items = (def.items || []).map((r) => this.item(r));
    row.objectives = (def.objectives || []).map((r) => this.objective(r));
    row.zones = def.zones.map((r) => this.zone(r));
    row.triggers = def.triggers || [];
    row.lights = (def.lights || []).map((r) => this.light(r));
    row.navHints = (def.hints || []).map((r) => this.hint(r));
    row.props = def.props || [];        // breakable boxes (S08 Props); every map has the list
    delete row.hints;
    return row;
  },
  // Wall along one axis ('x': runs along x at z = fixed; 'z': runs along z at x = fixed) with door gaps [centre, width, height].
  wall(material, axis, fixed, thickness, from, to, y0, y1, doors) {
    const rows = [], half = thickness / 2;
    let cursor = from;
    for (const [centre, width, height] of (doors || []).slice().sort((a, b) => a[0] - b[0])) {
      rows.push(this.slab(material, axis, fixed, half, cursor, centre - width / 2, y0, y1));
      rows.push(this.slab(material, axis, fixed, half, centre - width / 2, centre + width / 2, y0 + height, y1));
      cursor = centre + width / 2;
    }
    rows.push(this.slab(material, axis, fixed, half, cursor, to, y0, y1));
    return rows.filter((row) => row !== null);
  },
  slab(material, axis, fixed, half, from, to, y0, y1) {
    if (to - from < 0.01 || y1 - y0 < 0.01) return null;
    return axis === 'x' ? [material, from, y0, fixed - half, to, y1, fixed + half] : [material, fixed - half, y0, from, fixed + half, y1, to];
  },
  // Stairs filling the rectangle x0..x1 / z0..z1, rising toward dir from yBase by `rise` in `steps` equal steps (each riser <= 0.45 m).
  stairs(material, dir, x0, z0, x1, z1, yBase, rise, steps) {
    if (rise / steps > MAP_STEP) throw new Error('stairs: riser ' + (rise / steps).toFixed(2) + ' m is higher than the ' + MAP_STEP + ' m step');
    const rows = [], alongX = dir === '+x' || dir === '-x', positive = dir[0] === '+';
    const length = alongX ? x1 - x0 : z1 - z0;
    for (let i = 0; i < steps; i++) {
      const near = positive ? i : steps - 1 - i;                      // slice index counted from the low edge of the rectangle
      const a = (alongX ? x0 : z0) + (length * near) / steps, b = a + length / steps;
      const top = yBase + (rise * (i + 1)) / steps;
      rows.push(alongX ? [material, a, yBase, z0, b, top, z1] : [material, x0, yBase, a, x1, top, b]);
    }
    return rows;
  },
  // Concatenates compact definitions (each may hold brushes, spawns, items, zones, lights, hints, triggers, objectives).
  join(...defs) {
    const out = {};
    for (const key of MAP_LIST_KEYS) out[key] = [].concat(...defs.map((def) => def[key] || []));
    return out;
  },
  // The definition plus its mirror image across x = 0 ('x') or z = 0 ('z'); several letters mirror in turn ('xz' gives four copies).
  // Mirroring across x swaps teams 0 and 1 (team sides lie along x) unless keepTeams is true (co-op maps: both gates are team 1).
  // Zone and objective names swap West/East (x) or North/South (z).
  sym(def, axes, keepTeams) {
    let result = def;
    for (const axis of axes) result = this.join(result, this.mirror(result, axis, keepTeams));
    return result;
  },
  mirror(def, axis, keepTeams) {
    const x = axis === 'x', swapTeams = x && !keepTeams, swapName = (text) => text.replace(x ? /West|East/g : /North|South/g, (word) => MAP_OPPOSITE[word]);
    const out = {};
    out.brushes = (def.brushes || []).map((row) => this.mirrorBrush(row, x));
    out.spawns = (def.spawns || []).map(([team, modes, points]) => [swapTeams && team >= 0 ? 1 - team : team, modes, points.map((p) => this.mirrorSpawn(p, x))]);
    out.items = (def.items || []).map((row) => this.mirrorPoint(row, x ? 1 : 3));
    out.zones = (def.zones || []).map((row) => this.mirrorZone(row, x, swapName));
    out.lights = (def.lights || []).map((row) => this.mirrorPoint(row, x ? 0 : 2));
    out.hints = (def.hints || []).map((row) => this.mirrorPoint(row, x ? 1 : 3));
    out.triggers = (def.triggers || []).map((t) => this.mirrorTrigger(t, x));
    out.objectives = (def.objectives || []).map((o) => this.mirrorObjective(o, x, swapName, swapTeams));
    return out;
  },
  mirrorPoint(row, index) { const copy = row.slice(); copy[index] = -row[index]; return copy; },
  mirrorPair(row, low, high) { const copy = row.slice(); copy[low] = -row[high]; copy[high] = -row[low]; return copy; },
  mirrorBrush(row, x) {
    const copy = x ? this.mirrorPair(row, 1, 4) : this.mirrorPair(row, 3, 6);
    if (row.length > 7) copy[7] = row[7][1] === (x ? 'x' : 'z') ? (row[7][0] === '+' ? '-' : '+') + row[7][1] : row[7];
    return copy;
  },
  mirrorSpawn(p, x) { const copy = this.mirrorPoint(p, x ? 0 : 2); copy[3] = x ? -p[3] : 180 - p[3]; return copy; },
  mirrorZone(row, x, swapName) {
    const copy = x ? this.mirrorPair(row, 1, 3) : this.mirrorPair(row, 2, 4);
    copy[0] = swapName(row[0]);
    return copy;
  },
  mirrorTrigger(t, x) {
    const axis = x ? 0 : 2, copy = JSON.parse(JSON.stringify(t));
    copy.min[axis] = -t.max[axis]; copy.max[axis] = -t.min[axis];
    if (t.target) copy.target[axis] = -t.target[axis];
    if (t.exit) copy.exit[axis] = -t.exit[axis];
    if (typeof t.yaw === 'number') copy.yaw = x ? -t.yaw : 180 - t.yaw;
    return copy;
  },
  mirrorObjective(o, x, swapName, swapTeams) {
    const axis = x ? 0 : 2, copy = JSON.parse(JSON.stringify(o));
    copy.id = swapName(o.id);
    if (swapTeams && o.team >= 0) copy.team = 1 - o.team;
    copy[x ? 'x' : 'z'] = -o[x ? 'x' : 'z'];
    if (o.path) copy.path = o.path.map((p) => this.mirrorPoint(p, axis));
    return copy;
  },
};
const MAP_LIST_KEYS = ['brushes', 'spawns', 'items', 'zones', 'lights', 'hints', 'triggers', 'objectives'];
const MAP_OPPOSITE = { West: 'East', East: 'West', North: 'South', South: 'North' };
