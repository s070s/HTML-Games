// ---- Maps ------------------------------------------------------------------------------
// Tile characters. solid: blocks walking. counter: solid, but you can talk across it.
// TILE_DEFS (data/tiles/), MAPS (data/maps/: the tile rows, doors, signs, people, wild zones, kiosk stocks), START_MAP, HOSPITAL_SPOT and
// DEFAULT_HEAL_SPOT are built in 02-data.js. A map is { name, w, h, music, rows, warps, signs, npcs } plus stock (the kiosk's items),
// cafeHello, actions, triggers and zones; the black-out spot before any heal is the hospital (after one, save.lastHeal: the last
// hospital that healed you).

function tileAt(map, x, y) {
  if (y < 0 || y >= map.h || x < 0 || x >= map.w) return ' ';
  return map.rows[y][x];
}
function tileDef(map, x, y) { return TILE_DEFS[tileAt(map, x, y)] || { solid: true }; }
function npcVisible(npc, flags) {
  if (npc.showFlag && !flags[npc.showFlag]) return false;
  if (npc.hideFlag && flags[npc.hideFlag]) return false;
  // the rival leaves the map after each of his later fights (data/game.json)
  if (npc.kind === 'trainer' && LEAVING_TRAINERS.includes(npc.trainer) && flags['t_' + npc.trainer]) return false;
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

