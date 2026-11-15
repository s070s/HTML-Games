// ---- World (MZ-MAP-01) ------------------------------------------------------------------------
// The schematic map of Attica: six districts on a 30 x 15 grid (section 11.2 of REFERENCE-mizamon.md), the places on it and the
// routes between them. Pure data plus small pure functions, so the headless tests, tools/world-map.mjs and the map screen read the
// same numbers. Grid letters: upper case = a district, lower case = a hill of that district, '~' = sea, '#' = mainland outside
// the six districts. Cells are [x, y]; a route path is a list of cell centres from the route's first end (a) to its second (b).
// Πειραιάς, Νότια, Ανατολικά, Βόρεια, Δυτικά and Αθήνα are built (the Βουλή is not: it is a door on the square of Σύνταγμα); the other places are drawn locked ("soon") until their own task builds them (built: false).
const WORLD_BADGE_COUNT = 6;
const WORLD = {
  cols: 30, rows: 15,
  grid: [
    '#####ddddVVVVVVVVvvvvV#######~',
    '##DDDDddDVVVVVVVVVvvvV#######~',
    '##dDDDDDDVVVVVVVVVVEEEEEEEEEE~',
    '##ddDDDDDVVVVVVVVVVEEEEEEEEEE~',
    '##dDDDDDDVVVVVVVVVVEEEEEEEEEE~',
    '~~dDDDDDDVVVVVVVVVVEEEEEEEEEE~',
    '~~dDDDDDDAAAAAAaaeEEEEEEEEEEE~',
    '~~DDDDDDDAAAAAAAAeeEEEEEEEEEE~',
    '~PPPPPPPPAAAAAAAAeeEEEEEEEEEE~',
    '~PPPPPPPPAAAAAAAAeeEEEEEEEEEE~',
    '~PPPPPPPPAAaAAAAAeEEEEEEEEEEE~',
    '~PPPPPpPPNNNNNNNNeEEEEEEEEEEE~',
    '~PPPPPP~~NNNNNNNNeEEEEEEEEEEE~',
    '~~PPPPP~~~NNNNNNNEEEEEEEEEEEE~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  // order = play order; badgeFlag = the story flag the district's boss sets; levels = wild level range; label = where the name sits (cell units)
  districts: {
    peiraias: { letter: 'P', order: 1, bossTrainer: 'kotsos', badgeFlag: 'badge', nameKey: 'world.d.peiraias', levels: [2, 13], color: '#e9b872', label: [4.5, 8.5], built: true },
    notia: { letter: 'N', order: 2, bossTrainer: 'bougatsas', badgeFlag: 'badge_notia', nameKey: 'world.d.notia', levels: [13, 20], color: '#8fd0c8', label: [13.5, 12.5], built: true },
    anatolika: { letter: 'E', order: 3, bossTrainer: 'faia', badgeFlag: 'badge_anatolika', nameKey: 'world.d.anatolika', levels: [19, 26], color: '#d9a0c4', label: [25.5, 3.5], built: true },
    voreia: { letter: 'V', order: 4, bossTrainer: 'amartia', badgeFlag: 'badge_voreia', nameKey: 'world.d.voreia', levels: [26, 32], color: '#9fcb7b', label: [13.5, 1], built: true },
    dytika: { letter: 'D', order: 5, bossTrainer: 'plousiakis', badgeFlag: 'badge_dytika', nameKey: 'world.d.dytika', levels: [32, 38], color: '#e6d26a', label: [5.5, 3.5], built: true },
    athina: { letter: 'A', order: 6, bossTrainer: 'baboulas', badgeFlag: 'badge_athina', nameKey: 'world.d.athina', levels: [38, 44], color: '#c9b6e8', label: [12.5, 6.5], built: true },
  },
  // kind: 'town' | 'boss' (the boss building of a district) | 'door' (the Parliament); maps = the game maps that belong to the place;
  // boss = the district's boss is here; stop = a ΚΤΕΛ stop will stand here (MZ-MAP-02); has = what the info panel lists (built places only)
  nodes: {
    newPeiraias: { district: 'peiraias', kind: 'town', cell: [3, 10], maps: ['town', 'lab', 'kep', 'hospital', 'shop', 'cafe', 'studio'], stop: true, built: true, has: ['hospital', 'shop', 'cafe'] },
    harbourOffice: { district: 'peiraias', kind: 'boss', cell: [5, 12], maps: ['port'], boss: true, built: true, has: ['boss'] },
    kastella: { district: 'peiraias', kind: 'town', cell: [7, 10], maps: ['kastella', 'kastella_hospital', 'kastella_shop', 'kastella_theatre'], stop: true, built: true, seenFlag: 'badge', has: ['hospital', 'shop', 'theatre'] },
    faliro: { district: 'notia', kind: 'town', cell: [10, 12], maps: ['faliro', 'faliro_hospital', 'faliro_shop', 'faliro_cafe'], stop: true, built: true, has: ['hospital', 'shop', 'cafe'] },
    glyfada: { district: 'notia', kind: 'town', cell: [15, 12], maps: ['glyfada', 'glyfada_hospital', 'glyfada_shop', 'glyfada_boss'], boss: true, stop: true, built: true, has: ['hospital', 'shop', 'boss'] },
    koropi: { district: 'anatolika', kind: 'town', cell: [21, 12], maps: ['koropi', 'koropi_hospital', 'koropi_shop', 'koropi_cafe'], stop: true, built: true, has: ['hospital', 'shop', 'cafe'] },
    spata: { district: 'anatolika', kind: 'town', cell: [24, 9], maps: ['spata', 'spata_hospital', 'spata_shop', 'spata_boss'], boss: true, stop: true, built: true, has: ['hospital', 'shop', 'boss'] },
    kifisia: { district: 'voreia', kind: 'town', cell: [17, 2], maps: ['kifisia', 'kifisia_hospital', 'kifisia_shop', 'kifisia_cafe'], stop: true, built: true, has: ['hospital', 'shop', 'cafe'] },
    marousi: { district: 'voreia', kind: 'town', cell: [15, 4], maps: ['marousi', 'marousi_hospital', 'marousi_shop', 'marousi_boss'], boss: true, stop: true, built: true, has: ['hospital', 'shop', 'boss'] },
    peristeri: { district: 'dytika', kind: 'town', cell: [7, 5], maps: ['peristeri', 'peristeri_hospital', 'peristeri_shop', 'peristeri_cafe'], stop: true, built: true, has: ['hospital', 'shop', 'cafe'] },
    chaidari: { district: 'dytika', kind: 'town', cell: [4, 6], maps: ['chaidari', 'chaidari_hospital', 'chaidari_shop', 'chaidari_boss'], boss: true, stop: true, built: true, has: ['hospital', 'shop', 'boss'] },
    monastiraki: { district: 'athina', kind: 'town', cell: [10, 9], maps: ['monastiraki', 'monastiraki_hospital', 'monastiraki_shop', 'monastiraki_cafe', 'rock'], stop: true, built: true, has: ['hospital', 'shop', 'cafe', 'legend'] },
    syntagma: { district: 'athina', kind: 'town', cell: [14, 8], maps: ['syntagma', 'syntagma_hospital', 'syntagma_shop', 'lycabettus'], boss: true, stop: true, built: true, has: ['hospital', 'shop', 'boss'] },
    // The Βουλή (MZ-WORLD-02g): told about with the sixth badge (seenFlag), visited when any of its six maps is entered; its own level range (the district's is 38-44).
    parliament: { district: 'athina', kind: 'door', cell: [15, 7], maps: ['parliament_lobby', 'parliament_c1', 'parliament_c2', 'parliament_c3', 'parliament_plenary', 'parliament_roof'], built: true, seenFlag: 'badge_athina', levels: [44, 50], has: ['doctor', 'final'] },
  },
  // progress = the way the route's map runs, for the player marker: 'x' left to right, '-x' right to left, 'y' top to bottom
  routes: {
    route1: { district: 'peiraias', a: 'newPeiraias', b: 'harbourOffice', map: 'route1', path: [[3, 10], [3, 12], [5, 12]], progress: 'x', built: true },
    route2: { district: 'peiraias', a: 'harbourOffice', b: 'kastella', map: 'route2', path: [[5, 12], [6, 12], [7, 11], [7, 10]], progress: 'x', built: true },
    route3: { district: 'notia', a: 'kastella', b: 'faliro', map: 'route3', path: [[7, 10], [9, 11], [10, 12]], progress: 'x', built: true },
    route4: { district: 'notia', a: 'faliro', b: 'glyfada', map: 'route4', path: [[10, 12], [12, 12], [15, 12]], progress: 'x', built: true },
    route5: { district: 'anatolika', a: 'glyfada', b: 'koropi', map: 'route5', path: [[15, 12], [18, 12], [21, 12]], progress: 'x', built: true },
    route6: { district: 'anatolika', a: 'koropi', b: 'spata', map: 'route6', path: [[21, 12], [22, 10], [24, 9]], progress: 'x', built: true },
    route7: { district: 'voreia', a: 'spata', b: 'kifisia', map: 'route7', path: [[24, 9], [23, 6], [21, 3], [18, 2], [17, 2]], progress: '-x', built: true },
    route8: { district: 'voreia', a: 'kifisia', b: 'marousi', map: 'route8', path: [[17, 2], [17, 4], [15, 4]], progress: '-x', built: true },
    route9: { district: 'dytika', a: 'marousi', b: 'peristeri', map: 'route9', path: [[15, 4], [13, 2], [10, 2], [9, 3], [8, 4], [7, 5]], progress: '-x', built: true },
    route10: { district: 'dytika', a: 'peristeri', b: 'chaidari', map: 'route10', path: [[7, 5], [5, 5], [4, 6]], progress: '-x', built: true },
    route11: { district: 'athina', a: 'chaidari', b: 'monastiraki', map: 'route11', path: [[4, 6], [6, 7], [8, 7], [9, 8], [10, 9]], progress: 'x', built: true },
    route12: { district: 'athina', a: 'monastiraki', b: 'syntagma', map: 'route12', path: [[10, 9], [12, 8], [14, 8]], progress: 'x', built: true },
  },
};
for (const id of Object.keys(WORLD.districts)) WORLD.districts[id].id = id;
for (const id of Object.keys(WORLD.nodes)) WORLD.nodes[id].id = id;
for (const id of Object.keys(WORLD.routes)) WORLD.routes[id].id = id;

// The node or route a game map belongs to (null for a map that is on none: a test keeps every map on exactly one).
function mapNode(mapId) {
  for (const node of Object.values(WORLD.nodes)) if (node.maps.includes(mapId)) return node;
  for (const route of Object.values(WORLD.routes)) if (route.map === mapId) return route;
  return null;
}
function worldIsRoute(place) { return Array.isArray(place.path); }
// Where along a route the player stands, 0 at its first end and 1 at its second, from the tile on the route's own map.
function routeMarkerFraction(progress, x, y, width, height) {
  const raw = progress === 'y' ? (y + 0.5) / height : (x + 0.5) / width;
  return Math.max(0, Math.min(1, progress === '-x' ? 1 - raw : raw));
}
// The cell position (a float, in cell units) at this fraction of the path length.
function pointAlongPath(path, fraction) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  let remaining = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 1; i < path.length; i++) {
    const length = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
    }
    remaining -= length;
  }
  return path[path.length - 1].slice();
}
// The player marker for a map tile: the place's cell, or the point along the route's line. Null on a map without a place.
function worldMarker(mapId, x, y) {
  const place = mapNode(mapId);
  if (!place) return null;
  if (!worldIsRoute(place)) return { id: place.id, onRoute: false, fraction: 0, cell: place.cell.slice() };
  const map = MAPS[mapId];
  const fraction = routeMarkerFraction(place.progress, x, y, map.w, map.h);
  return { id: place.id, onRoute: true, fraction: fraction, cell: pointAlongPath(place.path, fraction) };
}

// The part of the save that the map screen needs: places entered, routes walked, places told about, ΚΤΕΛ stops, badges won.
function newWorldState() { return { visited: {}, routes: {}, stops: {}, badges: {}, seen: {} }; }
function worldSyncBadges(world, flags) {
  for (const district of Object.values(WORLD.districts)) if (flags && flags[district.badgeFlag]) world.badges[district.id] = 1;
  for (const node of Object.values(WORLD.nodes)) if (node.seenFlag && flags && flags[node.seenFlag]) world.seen[node.id] = 1; // told about by a story flag
}
function worldMarkPlace(world, place) {
  if (worldIsRoute(place)) { world.routes[place.id] = 1; world.seen[place.a] = 1; world.seen[place.b] = 1; } else world.visited[place.id] = 1;
}
// Called whenever the player stands on a map (and when the map screen opens).
function worldVisit(world, mapId, flags) {
  const place = mapNode(mapId);
  if (place) worldMarkPlace(world, place);
  worldSyncBadges(world, flags);
}
// Keeps only ids that exist, each as 1, so a damaged save cannot put a stranger on the map.
function normalizeWorld(raw) {
  const clean = newWorldState();
  const source = raw && typeof raw === 'object' ? raw : {};
  const known = { visited: WORLD.nodes, routes: WORLD.routes, stops: WORLD.nodes, badges: WORLD.districts, seen: WORLD.nodes };
  for (const part of Object.keys(known)) {
    const ids = source[part] && typeof source[part] === 'object' ? Object.keys(source[part]) : [];
    for (const id of ids) if (Object.prototype.hasOwnProperty.call(known[part], id) && source[part][id]) clean[part][id] = 1; // own names only: not "constructor" or "toString"
  }
  for (const id of Object.keys(clean.routes)) { clean.seen[WORLD.routes[id].a] = 1; clean.seen[WORLD.routes[id].b] = 1; } // a walked route tells about both its ends
  return clean;
}
// A version-2 save has no world part: rebuild it from what the save says (section 11.5 of the reference).
function worldFromOldSave(mapId, flags) {
  const world = newWorldState();
  const f = flags || {};
  if (f.badge) { worldMarkPlace(world, WORLD.nodes.harbourOffice); worldMarkPlace(world, WORLD.routes.route1); worldMarkPlace(world, WORLD.nodes.newPeiraias); }
  if (f.rival1) worldMarkPlace(world, WORLD.nodes.newPeiraias);
  if (f.t_phoebe || f.t_stelios || f.t_takis || f.t_rival2) worldMarkPlace(world, WORLD.routes.route1);
  worldVisit(world, mapId, f);
  return world;
}
function worldDistrictByOrder(order) { return Object.values(WORLD.districts).find(function (district) { return district.order === order; }) || null; }
// 'locked' (not built yet, or the previous badge is missing), 'open' or 'cleared' (its own badge is won).
function districtState(world, districtId) {
  const district = WORLD.districts[districtId];
  if (!district.built) return 'locked';
  if (world.badges[districtId]) return 'cleared';
  const previous = worldDistrictByOrder(district.order - 1);
  return previous && !world.badges[previous.id] ? 'locked' : 'open';
}
// 'hidden' (not drawn), 'unknown' (built later: a question mark), 'seen' (told it exists) or 'visited'.
function placeState(world, nodeId) {
  const node = WORLD.nodes[nodeId];
  if (districtState(world, node.district) === 'locked') return 'hidden';
  if (!node.built) return 'unknown';
  if (world.visited[nodeId]) return 'visited';
  return world.seen[nodeId] ? 'seen' : 'hidden';
}
// The places the map cursor can stand on.
function worldCandidates(world) {
  return Object.keys(WORLD.nodes).filter(function (id) { const state = placeState(world, id); return state === 'seen' || state === 'visited'; });
}
// The species a district's wild zones hold (for the "met" count on the district sheet).
function districtSpecies(districtId) {
  const found = new Set();
  for (const [mapId, map] of Object.entries(MAPS)) {
    const place = mapNode(mapId);
    if (!place || place.district !== districtId) continue;
    for (const zone of map.zones || []) for (const entry of zone.table) found.add(entry.sp);
  }
  return Array.from(found);
}

