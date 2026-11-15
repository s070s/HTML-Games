// ---- World (MZ-MAP-01) ------------------------------------------------------------------------
// The schematic map of Attica: six districts on a 30 x 15 grid (section 11.2 of REFERENCE-mizamon.md), the places on it and the
// routes between them. Pure data plus small pure functions, so the headless tests, tools/world-map.mjs and the map screen read the
// same numbers. Grid letters: upper case = a district, lower case = a hill of that district, '~' = sea, '#' = mainland outside
// the six districts. Cells are [x, y]; a route path is a list of cell centres from the route's first end (a) to its second (b).
// Πειραιάς, Νότια, Ανατολικά, Βόρεια, Δυτικά and Αθήνα are built (the Βουλή is not: it is a door on the square of Σύνταγμα); the other places are drawn locked ("soon") until their own task builds them (built: false).
// WORLD, WORLD_BADGE_COUNT and the .id of every district, place (node) and route are built from data/world.json and data/districts/ in
// 02-data.js. A place is { district, kind, cell, maps, ... }; a route is { district, a, b, map, path, progress, built }.

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

