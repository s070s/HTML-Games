// Self-tests for S16 maps: the hand-made catalogue, the validator (it must catch what it claims to), the lookups, the authoring kit and
// the agreement between the map data and S08's World. Debug hook: __CTK.map.check(id) -> problem list.

// Which modes each hand-made map must offer (spec s18 table, MP01..MP12; MP06 "all agile" = the agile-friendly modes).
const MAP_SPEC_MODES = {
  spire: ['duel', 'ffa'], skyyard: ['ffa', 'tdm'], twinkeeps: ['ctf', 'oneflag', 'dom'], dustline: ['bomb', 'elim', 'ghostops'],
  harbor: ['tdm', 'hardpoint', 'attrition'], gantry: ['ffa', 'tdm', 'duel', 'dom', 'hardpoint', 'oddball'], cistern: ['horde', 'endless', 'fiends'],
  convoyline: ['payload', 'rush', 'conquest'], isle: ['royale'], provinggrounds: ['range'], chambers: ['puzzle'], manor: ['contract'],
};
const MAP_SPEC_CODES = { spire: 'MP01', skyyard: 'MP02', twinkeeps: 'MP03', dustline: 'MP04', harbor: 'MP05', gantry: 'MP06', cistern: 'MP07', convoyline: 'MP08',
  isle: 'MP09', provinggrounds: 'MP10', chambers: 'MP11', manor: 'MP12' };

DebugApi.map = {
  list: () => CAT.maps.map((map) => map.id),
  find: (id) => (id ? Maps.get(id) : Game.match && Game.match.map) || null,
  check(id) {
    const map = this.find(id);
    return map ? Maps.validate(map) : ['unknown map ' + id];
  },
  report(id) {
    const map = this.find(id);
    return map ? Maps.report(map) : { id, problems: ['unknown map ' + id], stats: {} };
  },
};

const mapTestClone = (id) => { const copy = JSON.parse(JSON.stringify(Maps.get(id))); copy.id = id + '-test'; return copy; };
const mapTestHas = (problems, prefix) => problems.some((text) => text.startsWith(prefix));

Test.add('maps', (check) => {
  check('catalogue: 12 hand-made maps MP01..MP12', CAT.maps.length === 12 && Object.keys(MAP_SPEC_CODES).every((id) => Maps.get(id) && Maps.get(id).code === MAP_SPEC_CODES[id]));
  check('catalogue: schema is valid', Data.validate('maps').length === 0, Data.validate('maps').join('; '));
  check('catalogue: only the island is a placeholder', CAT.maps.filter((map) => map.placeholder).map((map) => map.id).join() === 'isle');
  check('catalogue: island is 300 m', Maps.get('isle').size[0] === 300 && Maps.get('isle').size[2] === 300);
  for (const id in MAP_SPEC_MODES) {
    const map = Maps.get(id);
    check('modes: ' + id + ' offers ' + MAP_SPEC_MODES[id].join('/'), MAP_SPEC_MODES[id].every((mode) => map.modes.includes(mode)), map.modes.join());
  }
  for (const mode of new Set(Object.values(MAP_SPEC_MODES).flat())) check('modes: forMode(' + mode + ') finds a map', Maps.forMode(mode).length >= 1);
  check('modes: every listed mode is a known mode', CAT.maps.every((map) => map.modes.every((mode) => MapRules.rule(mode))));
  check('lookup: by id and by code', Maps.get('MP05') === Maps.get('harbor') && Maps.get('nope') === null);
});

Test.add('maps', (check) => {
  for (const map of CAT.maps) {
    const problems = Maps.validate(map);
    check('validate: ' + map.code + ' ' + map.id + ' has no problems', problems.length === 0, problems.slice(0, 4).join(' | '));
  }
  check('debug hook: __CTK.map.check returns the validator list', DebugApi.map.check('spire').length === 0 && DebugApi.map.check('nope').length === 1);
  const report = DebugApi.map.report('harbor');
  check('debug hook: report has stats and a hash', report.stats.hash === Maps.hash(Maps.get('harbor')) && report.stats.nodes > 1000);
});

Test.add('maps', (check) => {
  for (const map of CAT.maps) {
    check(map.code + ': brush budget (<= 450) and ramp slope (<= 40 deg)', map.brushes.length <= MapRules.limits.brushes &&
      map.brushes.every((b) => b.shape !== 'ramp' || Math.atan2(b.max[1] - b.min[1], b.dir.endsWith('x') ? b.max[0] - b.min[0] : b.max[2] - b.min[2]) / DEG <= 40));
    check(map.code + ': every brush has a known material and min < max', map.brushes.every((b) => MapRules.materials.includes(b.material) && b.min.every((v, i) => v < b.max[i])));
    check(map.code + ': theme, sky and category are set', MapRules.themes.includes(map.theme) && typeof map.sky.top === 'number' && map.category in MapRules.sightLimits);
    check(map.code + ': has callout zones, nav hints and lights', map.zones.length >= 4 && map.navHints.length >= MapRules.limits.hints && map.lights.length >= 1);
  }
  const usedMaterials = new Set(CAT.maps.flatMap((map) => map.brushes.map((b) => b.material)));
  check('materials: all ten are used by some map', MapRules.materials.every((material) => usedMaterials.has(material)), MapRules.materials.filter((m) => !usedMaterials.has(m)).join());
  const usedThemes = new Set(CAT.maps.map((map) => map.theme));
  check('themes: all six tilesets are used', MapRules.themes.every((theme) => usedThemes.has(theme)), MapRules.themes.filter((t) => !usedThemes.has(t)).join());
  const kinds = new Set(CAT.maps.flatMap((map) => map.triggers.map((t) => t.kind)));
  check('triggers: all six kinds are used', MapRules.triggerKinds.every((kind) => kinds.has(kind)), MapRules.triggerKinds.filter((k) => !kinds.has(k)).join());
});

Test.add('maps', (check) => {
  for (const map of CAT.maps) {
    for (const mode of map.modes) {
      for (const [team, minimum] of MapRules.spawnRules[MapRules.rule(mode)[0]]) {
        const have = Maps.spawnList(map, mode, team).length;
        check('spawns: ' + map.code + ' ' + mode + ' team ' + team + ' has ' + have + ' (>= ' + minimum + ')', have >= minimum);
      }
      for (const [kind, minimum] of MapRules.rule(mode)[1]) {
        const have = Maps.objectivesFor(map, mode, kind).length;
        check('objectives: ' + map.code + ' ' + mode + ' has ' + have + ' ' + kind + ' (>= ' + minimum + ')', have >= minimum);
      }
    }
  }
  const spire = Maps.get('spire');
  check('spawns: FFA spawns are team -1 and cover several zones', Maps.spawnList(spire, 'ffa', -1).length === 16 && DebugApi.map.report('spire').stats.spawnZones >= 4);
  check('spawns: a team mode never gets another mode\'s spawns', Maps.spawnList(Maps.get('skyyard'), 'tdm', 0).every((s) => s.modes.includes('tdm')) && Maps.spawnList(Maps.get('skyyard'), 'tdm', -1).length === 0);
  check('spawns: team spawns are mirrored (twinkeeps)', Maps.get('twinkeeps').spawns.filter((s) => s.team === 0).every((s) => Maps.get('twinkeeps').spawns.some((o) => o.team === 1 && o.x === -s.x && o.z === s.z && Test.near(o.yaw, -s.yaw, 1e-9))));
});

Test.add('maps', (check) => {
  for (const map of CAT.maps) {
    const keys = map.items.map((item) => item.item);
    check('items: ' + map.code + ' keys are known and in the right group', map.items.every((item) => MapRules.groupOf(item.item) === item.group && item.group !== ''), keys.filter((k) => !MapRules.groupOf(k)).join());
    const power = map.items.filter((item) => item.group === 'power');
    const closest = power.reduce((least, a, i) => power.slice(i + 1).reduce((m, b) => Math.min(m, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)), least), Infinity);
    check('items: ' + map.code + ' power items are >= 20 m apart (closest ' + (closest === Infinity ? 'n/a' : closest.toFixed(1)) + ')', closest >= MapRules.limits.powerSpacing);
  }
  for (const id of ['spire', 'skyyard', 'gantry']) {
    const stats = DebugApi.map.report(id).stats;
    check('items: ' + id + ' MAP-005 target, no spawn is closest to more than 50% of the top items (' + stats.topItemShare + ')', stats.topItems >= 3 && stats.topItemShare <= 0.5);
  }
  for (const group of ['power', 'armor', 'health', 'weapon', 'ammo']) {
    check('items: pickups of group ' + group + ' appear on some map', CAT.maps.some((map) => map.items.some((item) => item.group === group)));
  }
  // The item catalogues belong to later sections: compare the keys only when they exist (never required for this section's tests).
  const missing = [];
  for (const name of ['weapons', 'powerups']) for (const key of CAT[name] ? CAT.maps.flatMap((map) => map.items.map((item) => item.item)) : []) {
    if (MapRules.itemKeys.weapon.includes(key) && name === 'weapons' && !CAT.weapons.byId(key)) missing.push(key);
    if (MapRules.itemKeys.power.includes(key) && name === 'powerups' && !CAT.powerups.byId(key)) missing.push(key);
  }
  check('items: weapon and powerup keys exist in their catalogues when those exist', missing.length === 0, missing.join());
  const spire = Maps.get('spire');
  check('items: itemsFor filters by mode', Maps.itemsFor(Maps.get('provinggrounds'), 'range').length > 0 && Maps.itemsFor(Maps.get('provinggrounds'), 'ffa').length === 0 && Maps.itemsFor(spire, 'ffa').length === spire.items.length);
});

Test.add('maps', (check) => {
  const harbor = Maps.get('harbor');
  const zone = Maps.zoneAt(harbor, 0, 0, 0);
  check('zones: zoneAt returns the smallest zone holding the point', zone && zone.name === 'Cargo Heart', zone && zone.name);
  check('zones: nothing outside every zone', Maps.zoneAt(harbor, 500, 0, 500) === null);
  for (const map of CAT.maps) {
    const names = map.zones.map((z) => z.name);
    check('zones: ' + map.code + ' names are unique', new Set(names).size === names.length);
    const uncovered = [].concat(map.spawns, map.items, map.objectives, map.navHints).filter((p) => !Maps.zoneAt(map, p.x, p.y, p.z));
    check('zones: ' + map.code + ' every spawn, item, objective and hint is in a callout zone', uncovered.length === 0, uncovered.length);
    check('zones: ' + map.code + ' at least 97% of the walkable area is covered', DebugApi.map.report(map.id).stats.zoneCoverage >= 0.97);
  }
});

Test.add('maps', (check) => {
  // The validator must catch what it claims to catch: each mutation of a sound map has to produce a problem of the expected kind.
  const spire = mapTestClone('spire');
  spire.spawns[0].x = 0; spire.spawns[0].z = 0;
  check('validator: a spawn inside the spire is reported', mapTestHas(Maps.validate(spire), 'spawn:'));
  const floating = mapTestClone('spire');
  floating.brushes.push({ shape: 'box', min: [-2, 20, -2], max: [2, 21, 2], material: 'metal' });
  floating.spawns[0] = { x: 0, y: 21, z: 0, yaw: 0, team: -1, modes: [] };
  check('validator: a spawn on an unreachable platform is reported', Maps.validate(floating).some((p) => p.startsWith('spawn:') && p.includes('cut off')));
  const sunk = mapTestClone('spire');
  sunk.items[2].y = 50;
  check('validator: an item with no floor is reported', mapTestHas(Maps.validate(sunk), 'items:'));
  const steep = mapTestClone('spire');
  steep.brushes[steep.brushes.findIndex((b) => b.shape === 'ramp')].max[1] = 12;
  check('validator: a ramp steeper than 40 degrees is reported', Maps.validate(steep).some((p) => p.startsWith('brush:') && p.includes('steeper')));
  const inverted = mapTestClone('spire');
  inverted.brushes[0].min[0] = inverted.brushes[0].max[0] + 1;
  check('validator: a brush with min above max is reported', mapTestHas(Maps.validate(inverted), 'brush:'));
  const paint = mapTestClone('spire');
  paint.brushes[1].material = 'lava';
  check('validator: an unknown material is reported', Maps.validate(paint).some((p) => p.includes('unknown material')));
  const noFlags = mapTestClone('twinkeeps');
  noFlags.objectives = [];
  check('validator: missing objectives for a listed mode are reported', mapTestHas(Maps.validate(noFlags), 'objectives:'));
  const twinZones = mapTestClone('spire');
  twinZones.zones.push({ name: twinZones.zones[0].name, min: [0, 0, 0], max: [1, 1, 1] });
  check('validator: duplicate zone names are reported', mapTestHas(Maps.validate(twinZones), 'zones:'));
  const noKill = mapTestClone('skyyard');
  noKill.triggers = noKill.triggers.filter((t) => t.kind !== 'killzone');
  check('validator: an open ledge over the void without a kill zone is reported', mapTestHas(Maps.validate(noKill), 'open-edge:'));
  const closePower = mapTestClone('spire');
  closePower.items[1].x = closePower.items[0].x; closePower.items[1].z = closePower.items[0].z - 5;
  check('validator: power items closer than 20 m are reported', Maps.validate(closePower).some((p) => p.includes('power items')));
  const bodies = mapTestClone('dustline');
  bodies.spawns.push({ x: 0, y: 0, z: -34, yaw: 0, team: 1, modes: ['bomb'] });
  check('validator: enemy spawns closer than 25 m are reported', mapTestHas(Maps.validate(bodies), 'spawn-safety:'));
  const dark = mapTestClone('harbor');
  dark.lights = [];
  check('validator: indoor zones without light are reported', mapTestHas(Maps.validate(dark), 'lights:'));
  const thin = mapTestClone('twinkeeps');
  thin.spawns = thin.spawns.slice(0, 5);
  check('validator: too few team spawns are reported', mapTestHas(Maps.validate(thin), 'spawn-count:'));
  const walled = mapTestClone('provinggrounds');
  walled.brushes.push({ shape: 'box', min: [-40, 0, -22], max: [40, 3, -21], material: 'concrete' });
  check('validator: a wall that cuts spawns from the map is reported', Maps.validate(walled).length > 0);
  const lonely = mapTestClone('dustline');
  lonely.brushes.push({ shape: 'box', min: [-55, 0, -6], max: [55, 8, 6], material: 'concrete' });
  lonely.brushes.push({ shape: 'box', min: [-55, 0, 6.5], max: [55, 8, 13], material: 'concrete' });
  check('validator: sealing every lane is reported', Maps.validate(lonely).length > 0);
  const lanes = mapTestClone('dustline');
  const before = DebugApi.map.report('dustline').stats.routes;
  check('validator: dustline offers at least 3 separate routes (found ' + before + ')', before >= 3);
  check('validator: a clone with the same data has the same hash', Maps.hash(lanes) === Maps.hash(Maps.get('dustline')));
  const moved = mapTestClone('dustline');
  moved.items.push({ x: 0, y: 0, z: 20, item: 'healthpack', group: 'health', modes: [] });
  check('validator: a changed map has another hash', Maps.hash(moved) !== Maps.hash(Maps.get('dustline')));
});

Test.add('maps', (check) => {
  // The map data and S08's World must agree: spawns stand on floors, nothing is inside geometry, the scan heights equal World ray hits.
  const hit = makeHit();
  for (const map of CAT.maps) {
    World.load(map);
    const points = [].concat(map.spawns, map.items, map.objectives);
    const bad = points.filter((p) => !World.raycast(p.x, p.y + 0.5, p.z, 0, -1, 0, 1, hit) || Math.abs(hit.y - p.y) > 0.3 || World.pointInside(p.x, p.y + 1.0, p.z));
    check('world: ' + map.code + ' spawns, items and objectives stand on floors and outside solids', bad.length === 0, bad.length ? JSON.stringify(bad[0]) : '');
    const scan = MapScan.of(map);
    let wrong = 0;
    for (let n = 0; n < scan.nodeCount; n += 97) {
      const found = World.raycast(MapScan.nodeX(scan, n), scan.nodeY[n] + 1.5, MapScan.nodeZ(scan, n), 0, -1, 0, 4, hit);
      if (!found || Math.abs(hit.y - scan.nodeY[n]) > 0.06) wrong++;
    }
    check('world: ' + map.code + ' scan surfaces match World ray hits', wrong === 0, wrong);
  }
  World.clear();
});

Test.add('maps', (check) => {
  const doorway = MapKit.wall('concrete', 'x', 0, 1, -10, 10, 0, 4, [[0, 3, 3]]);
  check('kit: wall with one door = two side segments and a lintel', doorway.length === 3 && doorway.some((row) => row[2] === 3 && row[1] === -1.5 && row[4] === 1.5));
  const stairs = MapKit.stairs('concrete', '+x', 0, 0, 4, 2, 0, 2, 5);
  check('kit: stairs rise in equal steps of at most 0.45 m', stairs.length === 5 && stairs.every((row, i) => Test.near(row[5], 0.4 * (i + 1), 1e-9)) && 2 / 5 <= 0.45);
  const down = MapKit.stairs('concrete', '-z', 0, 0, 2, 4, 1, 2, 5);
  check('kit: stairs toward -z start at the far edge', down[0][3] > down[4][3] && Test.near(down[4][5], 3, 1e-9));
  const half = { brushes: [['metal', -4, 0, 1, -2, 3, 5, '+x']], spawns: [[0, ['tdm'], [[-3, 0, 2, 90]]]], items: [['fury', -3, 0, 2]], zones: [['West Hall', -5, 0, -1, 6]], lights: [[-3, 3, 2, 0xffffff, 5]], hints: [['cover', -3, 0, 2]],
    triggers: [{ kind: 'jumppad', min: [-4, 0, 1], max: [-2, 0.4, 3], launch: [3, 10, 1] }], objectives: [{ id: 'flagWest', kind: 'flag', team: 0, x: -3, y: 0, z: 2 }] };
  const both = MapKit.sym(half, 'x'), flipped = MapKit.sym(half, 'z');
  check('kit: mirror across x flips x, ramp direction, yaw, teams, names and launch', both.brushes[1][1] === 2 && both.brushes[1][4] === 4 && both.brushes[1][7] === '-x' && both.spawns[1][0] === 1 && both.spawns[1][2][0][3] === -90 &&
    both.zones[1][0] === 'East Hall' && both.triggers[1].launch[0] === -3 && both.objectives[1].id === 'flagEast' && both.objectives[1].team === 1 && both.objectives[1].x === 3);
  check('kit: mirror across z keeps teams and flips z, yaw and names', flipped.brushes[1][3] === -5 && flipped.spawns[1][0] === 0 && flipped.spawns[1][2][0][3] === 90 && flipped.zones[1][2] === -6 && flipped.triggers[1].launch[2] === -1);
  check('kit: keepTeams leaves both sides on the same team', MapKit.sym(half, 'x', true).spawns[1][0] === 0 && MapKit.sym(half, 'x', true).objectives[1].team === 0);
  check('kit: join concatenates every list', MapKit.join(half, half).brushes.length === 2 && MapKit.join(half, half).triggers.length === 2);
  const row = MapKit.make({ id: 'kit', brushes: half.brushes, spawns: half.spawns, items: half.items, zones: half.zones, lights: half.lights, hints: half.hints });
  check('kit: make expands compact rows into the map format', row.brushes[0].dir === '+x' && row.spawns[0].team === 0 && row.items[0].group === 'power' && row.zones[0].min[1] === ZONE_FLOOR && row.navHints[0].kind === 'cover' && !('hints' in row));
});

Test.add('maps', (check) => {
  const harbor = Maps.get('harbor');
  const first = MapScan.of(harbor);
  check('scan: results are cached per map row', MapScan.of(harbor) === first);
  check('scan: node count is sane for a 90 x 90 m map', first.nodeCount > 20000 && first.nodeCount < 100000, first.nodeCount);
  const dock = MapScan.nodeNear(first, -40, 0, 16, 0.5), bed = MapScan.nodeNear(first, -20, -3, 16, 0.5);
  check('scan: the canal bed is walkable and joined to the dock by the slipway', dock >= 0 && bed >= 0 && MapScan.reach(first, [bed], false, null)[dock] === 1);
  const distances = MapScan.distances(first, [dock], null, false).dist;
  check('scan: path distance is at least the straight-line distance', distances[bed] >= Math.hypot(20, 0) && isFinite(distances[bed]));
  const spire = MapScan.of(Maps.get('spire'));
  const ground = MapScan.nodeNear(spire, 0, 0, 16, 0.5), crown = MapScan.nodeNear(spire, 0, 8, 2.8, 0.5);
  check('scan: the spire top is reachable from the floor and back', MapScan.reach(spire, [ground], false, null)[crown] === 1 && MapScan.reach(spire, [crown], false, null)[ground] === 1);
  const pads = MapScan.of(Maps.get('skyyard')).pads;
  check('scan: every skyyard jump pad lands on a walkable surface', pads.length === 8 && pads.every((pad) => pad.landing >= 0));
  const ladder = MapScan.of(Maps.get('cistern')).ladders[0];
  check('scan: a ladder joins cells at its foot and at its top', ladder.bottoms > 0 && ladder.tops > 0);
  check('scan: teleporters resolve their exit cell', MapScan.of(Maps.get('cistern')).teleporters.every((t) => t.exit >= 0 && t.entries > 0));
});

Test.add('maps', (check) => {
  Game.start({ mode: 'ffa', map: 'spire' });
  check('match: Game.match.map is the map row of setup.map', Game.match.map === Maps.get('spire') && DebugApi.map.find() === Maps.get('spire'));
  Game.start({ mode: 'ffa', map: 'no-such-map' });
  check('match: an unknown map id leaves match.map null without an error', Game.match.map === null);
  const custom = mapTestClone('spire');
  Game.start({ mode: 'ffa', map: custom });
  check('match: a map object in the setup is used as it is', Game.match.map === custom);
  Game.stop();
});
