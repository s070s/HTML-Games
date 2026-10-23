// Self-tests for S16 maps: the hand-made catalogue, the validator (every rule has a mutation that must be caught), the lookups, the
// authoring kit and the agreement between the map data and S08's World. Debug hook: __CTK.map.check(id) -> problem list.

// Which modes each hand-made map must offer (spec s18 table, MP01..MP12; MP06 "all agile" = the agile-friendly modes).
const MAP_SPEC_MODES = {
  spire: ['duel', 'ffa'], skyyard: ['ffa', 'tdm'], twinkeeps: ['ctf', 'oneflag', 'dom'], dustline: ['bomb', 'elim', 'ghostops'],
  harbor: ['tdm', 'hardpoint', 'attrition'], gantry: ['ffa', 'duel', 'dom', 'hardpoint', 'oddball'], cistern: ['horde', 'endless', 'fiends'],
  convoyline: ['payload', 'rush', 'conquest'], isle: ['royale'], provinggrounds: ['range'], chambers: ['puzzle'], manor: ['contract'],
};
const MAP_SPEC_CODES = {
  spire: 'MP01', skyyard: 'MP02', twinkeeps: 'MP03', dustline: 'MP04', harbor: 'MP05', gantry: 'MP06', cistern: 'MP07', convoyline: 'MP08',
  isle: 'MP09', provinggrounds: 'MP10', chambers: 'MP11', manor: 'MP12',
};
const MAP_TEST_GRAVITIES = [13, 15, 16, 20, 22, 24];           // every movement preset (spec 6.3)

DebugApi.map = {
  list: () => CAT.maps.map((map) => map.id),
  find: (id) => (id ? Maps.get(id) : Game.match && Game.match.map) || null,
  check(id) {
    const map = this.find(id);
    return map ? Maps.validate(map) : ['unknown map ' + id];
  },
  validate: (map) => Maps.validate(map),
  report(id) {
    const map = this.find(id);
    return map ? Maps.report(map) : { id, problems: ['unknown map ' + id], stats: {} };
  },
};

const mapTestClone = (id) => { const copy = JSON.parse(JSON.stringify(Maps.get(id))); copy.id = id + '-test'; return copy; };
// True when a problem starts with `rule:` and holds the text (the text of the rule, not just any problem).
const mapTestHas = (problems, rule, text) => problems.some((problem) => problem.startsWith(rule + ':') && problem.includes(text || ''));
// One validator run per map for the whole file (a run takes up to a quarter of a second).
const mapTestReports = new Map();
const mapTestReport = (id) => {
  if (!mapTestReports.has(id)) mapTestReports.set(id, Maps.report(Maps.get(id)));
  return mapTestReports.get(id);
};
const mapTestWithin = (value, expected, tolerance) => Math.abs(value - expected) <= tolerance;

// Brushes of the ring of walls around a point (3.6 m inside, a 1.6 m door on the east side): a power item boxed in.
function mapTestEnclosure(x, y, z) {
  const rows = [].concat(
    MapKit.wall('concrete', 'z', x - 2, 0.4, z - 2, z + 2, y, y + 4, []), MapKit.wall('concrete', 'z', x + 2, 0.4, z - 2, z + 2, y, y + 4, [[z, 1.6, 3]]),
    MapKit.wall('concrete', 'x', z - 2, 0.4, x - 2, x + 2, y, y + 4, []), MapKit.wall('concrete', 'x', z + 2, 0.4, x - 2, x + 2, y, y + 4, []));
  return rows.map((row) => MapKit.brush(row));
}
const mapTestPoints = (map, group) => map.items.filter((item) => item.group === group);
const mapTestFloorOnly = (map) => { map.brushes = map.brushes.filter((brush) => brush.max[1] <= 0); };
const mapTestPad = (map) => map.triggers.find((trigger) => trigger.kind === 'jumppad');
// Standing points around an anchor point (at least 3 m from it and from each other), found with the scan so they are real floor.
function mapTestPointsNear(map, anchor, count) {
  const scan = MapScan.of(map), start = MapScan.nodeNear(scan, anchor.x, anchor.y, anchor.z, 0.5), chosen = [anchor];
  const points = MapScan.nodesAround(scan, start, 7, 0.3).map((node) => ({ x: MapScan.nodeX(scan, node), y: scan.nodeY[node], z: MapScan.nodeZ(scan, node) }));
  points.sort((a, b) => Math.hypot(a.x - anchor.x, a.z - anchor.z) - Math.hypot(b.x - anchor.x, b.z - anchor.z));
  for (const point of points) {
    if (chosen.length <= count && chosen.every((other) => Math.hypot(other.x - point.x, other.z - point.z) >= 3)) chosen.push(point);
  }
  return chosen.slice(1);
}
const mapTestItemsNear = (map, anchor, count, key, group) => mapTestPointsNear(map, anchor, count).map((point) => Object.assign(point, { item: key, group, modes: [] }));

// Each row breaks one rule of a sound map: [what is broken, map id, change to apply to a clone, rule prefix, text the problem must hold].
const MAP_MUTATIONS = [
  ['a brush with min above max', 'spire', (m) => { m.brushes[0].min[0] = m.brushes[0].max[0] + 1; }, 'brush', 'min must be below max'],
  ['an unknown material', 'spire', (m) => { m.brushes[1].material = 'lava'; }, 'brush', 'unknown material'],
  ['a ramp steeper than 40 degrees', 'spire', (m) => { m.brushes.find((b) => b.shape === 'ramp').max[1] = 12; }, 'brush', 'steeper'],
  ['a brush far outside the map', 'spire', (m) => { m.brushes[1].max[0] = 90; }, 'brush', 'outside the map size'],
  ['more brushes than the budget', 'spire', (m) => { for (let i = 0; i < 420; i++) m.brushes.push({ shape: 'box', min: [-24, 0, -24], max: [-23, 1, -23],
      material: 'dirt' }); }, 'budget', 'brushes'],
  ['more lights than the budget', 'spire', (m) => { for (let i = 0; i < 30; i++) m.lights.push(Object.assign({}, m.lights[0])); }, 'budget', 'lights'],
  ['a light without a radius', 'spire', (m) => { m.lights[0].radius = 0; }, 'light', 'invalid'],
  ['a spawn inside the spire', 'spire', (m) => { m.spawns[0].x = 0; m.spawns[0].z = 0; }, 'spawn', 'no standing floor'],
  ['a spawn with a bad team', 'spire', (m) => { m.spawns[0].team = 7; }, 'spawn', 'bad numbers or team'],
  ['a spawn that lists a mode the map lacks', 'spire', (m) => { m.spawns[0].modes = ['ctf']; }, 'spawn', 'lists mode ctf'],
  ['a spawn facing a wall', 'spire', (m) => { m.spawns[0] = { x: -20, y: 0, z: 6, yaw: 270, team: -1, modes: [] }; }, 'spawn-facing', 'faces a wall'],
  ['too few team spawns', 'twinkeeps', (m) => { m.spawns = m.spawns.slice(0, 5); }, 'spawn-count', 'needs 8 spawns'],
  ['two free spawns next to each other', 'spire', (m) => { Object.assign(m.spawns[1], { x: m.spawns[0].x + 1, z: m.spawns[0].z }); }, 'spawn-spread', 'closer than 5 m'],
  ['enemy spawns closer than 25 m', 'dustline', (m) => { m.spawns.push({ x: 0, y: 0, z: -34, yaw: 0, team: 1, modes: ['bomb'] }); }, 'spawn-safety', 'apart'],
  ['enemy spawns in sight of each other', 'skyyard', (m) => { m.brushes = m.brushes.filter((b) => !(b.min[0] === -12 && b.max[0] === 12 && b.min[1] === 3)); },
      'spawn-safety', 'see each other'],
  ['no items in a pickup mode', 'spire', (m) => { m.items = []; }, 'items', 'at least 6 item spots'],
  ['no health item', 'spire', (m) => { m.items = m.items.filter((item) => item.group !== 'health'); }, 'items', 'no health item'],
  ['an item in the wrong group', 'spire', (m) => { m.items[0].group = m.items[0].group === 'weapon' ? 'armor' : 'weapon'; }, 'items', 'belongs to group'],
  ['an item that lists a mode the map lacks', 'spire', (m) => { m.items[0].modes = ['ctf']; }, 'items', 'lists mode ctf'],
  ['an item hanging in the air', 'spire', (m) => { m.items[2].y = 50; }, 'items', 'no standing floor'],
  ['two items on the same spot', 'spire', (m) => { m.items.push(Object.assign({}, m.items[0])); }, 'items', 'apart (minimum 2)'],
  ['power items closer than 20 m', 'spire', (m) => { Object.assign(m.items[1], { x: m.items[0].x, z: m.items[0].z - 5 }); }, 'items', 'power items'],
  ['a power item boxed in by walls', 'harbor', (m) => { const p = mapTestPoints(m, 'power')[0]; m.brushes.push(...mapTestEnclosure(p.x, p.y, p.z)); }, 'items', 'boxed in'],
  ['two top items in one callout zone', 'harbor', (m) => { m.items.push(...mapTestItemsNear(m, mapTestPoints(m, 'power')[0], 1, 'megacell', 'health')); }, 'items', 'holds two top items'],
  ['a power item right at a spawn', 'spire', (m) => { Object.assign(m.items.find((item) => item.item === 'surplus'), { x: 6, y: 0, z: -14 }); }, 'items', 'from a spawn'],
  ['a top item next to one team only', 'harbor', (m) => { Object.assign(m.items.find((item) => item.item === 'megacell'), { x: -40, y: 0, z: -7 }); }, 'items', 'from team 0 spawns but'],
  ['no objectives for a listed mode', 'twinkeeps', (m) => { m.objectives = []; }, 'objectives', 'needs 2 flag'],
  ['an objective without a radius', 'twinkeeps', (m) => { m.objectives[0].radius = 0; }, 'objectives', 'bad numbers'],
  ['a flag for one team only', 'twinkeeps', (m) => { m.objectives.filter((o) => o.kind === 'flag').forEach((o) => { o.team = 0; }); }, 'objectives', 'no flag for team 1'],
  ['a payload path with two points', 'convoyline', (m) => { m.objectives.find((o) => o.kind === 'payloadPath').path.length = 2; }, 'objectives', 'at least 4 points'],
  ['no nav hints', 'spire', (m) => { m.navHints = []; }, 'hints', 'only 0 nav hints'],
  ['a nav hint of an unknown kind', 'spire', (m) => { m.navHints[0].kind = 'nap'; }, 'hints', 'unknown kind'],
  ['only two callout zones', 'spire', (m) => { m.zones = m.zones.slice(0, 2); }, 'zones', 'only 2 callout zones'],
  ['a zone with an inverted box', 'spire', (m) => { m.zones[0].min[0] = m.zones[0].max[0] + 1; }, 'zones', 'invalid box'],
  ['a repeated zone name', 'spire', (m) => { m.zones.push(Object.assign({}, m.zones[0])); }, 'zones', 'duplicate zone name'],
  ['most of the floor outside every zone', 'spire', (m) => { m.zones = m.zones.slice(0, 4); }, 'zones', '% of the walkable area'],
  ['a spawn outside every zone', 'spire', (m) => { m.zones = m.zones.filter((z) => !(z.min[0] <= m.spawns[0].x && z.max[0] >= m.spawns[0].x
      && z.min[2] <= m.spawns[0].z && z.max[2] >= m.spawns[0].z)); }, 'zones', 'is in no callout zone'],
  ['indoor zones without a light', 'harbor', (m) => { m.lights = []; }, 'lights', 'no light'],
  ['a trigger of an unknown kind', 'spire', (m) => { m.triggers.push({ kind: 'mist', min: [0, 0, 0], max: [1, 1, 1] }); }, 'triggers', 'unknown kind'],
  ['a trigger box with min above max', 'spire', (m) => { m.triggers.push({ kind: 'water', min: [2, 0, 0], max: [1, 1, 1] }); }, 'triggers', 'min must be below max'],
  ['a hazard with an unknown element', 'cistern', (m) => { m.triggers.find((t) => t.kind === 'hazard').element = 'acid'; }, 'triggers', 'hazard needs damage'],
  ['a jump pad without a target', 'skyyard', (m) => { delete mapTestPad(m).target; }, 'triggers', 'target [x, y, z] and peak'],
  ['a teleporter without a yaw', 'cistern', (m) => { delete m.triggers.find((t) => t.kind === 'teleporter').yaw; }, 'triggers', 'exit [x, y, z] and yaw needed'],
  ['a jump pad in mid air', 'skyyard', (m) => { const pad = mapTestPad(m); pad.min[1] += 40; pad.max[1] += 40; }, 'triggers', 'no floor to stand on'],
  ['a jump pad aimed at the void', 'skyyard', (m) => { mapTestPad(m).target = [20, 4, 20]; }, 'triggers', 'lands on nothing walkable'],
  ['a jump pad landing on the very edge', 'skyyard', (m) => { mapTestPad(m).target = [3.5, 4, 33.9]; }, 'triggers', 'from the edge of its floor'],
  ['a jump pad landing on an island nobody can leave', 'skyyard', (m) => {
    m.brushes.push({ shape: 'box', min: [-3, 19, -3], max: [3, 20, 3], material: 'metal' });
    mapTestPad(m).target = [0, 20, 0];
  }, 'triggers', 'cut-off place'],
  ['a wall across a jump pad arc', 'skyyard', (m) => { m.brushes.push({ shape: 'box', min: [1, 0, 16], max: [6, 16, 17], material: 'metal' }); }, 'triggers', 'hits geometry'],
  ['a teleporter leading into the void', 'cistern', (m) => { m.triggers.find((t) => t.kind === 'teleporter').exit = [200, 0, 0]; }, 'triggers', 'exits onto nothing walkable'],
  ['a ladder with no floor at its foot', 'cistern', (m) => { const ladder = m.triggers.find((t) => t.kind === 'ladder'); ladder.min[1] += 30; ladder.max[1] += 30; },
      'triggers', 'foot cells'],
  ['an open ledge without a kill zone', 'skyyard', (m) => { m.triggers = m.triggers.filter((t) => t.kind !== 'killzone'); }, 'open-edge', 'no kill zone'],
  ['a wall that cuts spawns from the map', 'provinggrounds', (m) => { m.brushes.push({ shape: 'box', min: [-40, 0, -22], max: [40, 3, -21], material: 'concrete' }); }, 'spawn', 'cut off'],
  ['every lane sealed by walls', 'dustline', (m) => {
    m.brushes.push({ shape: 'box', min: [-55, 0, -6], max: [55, 8, 6], material: 'concrete' }, { shape: 'box', min: [-55, 0, 6.5], max: [55, 8, 13], material: 'concrete' });
  }, 'lanes', 'separate route'],
  ['an open field with no cover', 'spire', mapTestFloorOnly, 'sightline', 'open line'],
];

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
  // play-02: Gantry's long sight lines with health regeneration gave Team Clash matches with almost no kills.
  check('modes: Team Clash is not offered on Gantry Run', !Maps.forMode('tdm').some((map) => map.id === 'gantry') && Maps.forMode('tdm').length >= 2);
  // blight-01: over Skyward Yard's open void edges every human fall adds an infected.
  const skySpawnsBlight = Maps.get('skyyard').spawns.some((spawn) => (spawn.modes || []).includes('infection'));
  check('modes: Blight is not offered on Skyward Yard, nor in its spawn sets', !Maps.get('skyyard').modes.includes('infection') && !skySpawnsBlight
    && Maps.forMode('infection').length >= 2);
  check('modes: every listed mode is a known mode', CAT.maps.every((map) => map.modes.every((mode) => MapRules.rule(mode))));
  // MODE-002: Play, Quick Match, Shuffle and Custom list only modes with a saved map, so every versus mode needs a hand-made one.
  const unserved = CAT.modes.filter((mode) => mode.family === 'versus' && !CAT.maps.some((map) => map.modes.includes(mode.id))).map((mode) => mode.id);
  check('modes: every versus mode has a hand-made map (pickable in Play and Custom)', unserved.length === 0, unserved.join());
  check('lookup: by id and by code', Maps.get('MP05') === Maps.get('harbor') && Maps.get('nope') === null);
});

Test.add('maps', (check) => {
  for (const map of CAT.maps) {
    const problems = mapTestReport(map.id).problems;
    check('validate: ' + map.code + ' ' + map.id + ' has no problems', problems.length === 0, problems.slice(0, 4).join(' | '));
  }
  check('debug hook: __CTK.map.check returns the validator list', DebugApi.map.check('spire').length === 0 && DebugApi.map.check('nope').length === 1);
  const report = DebugApi.map.report('harbor');
  check('debug hook: report has stats and a hash', report.stats.hash === Maps.hash(Maps.get('harbor')) && report.stats.nodes > 1000);
  check('validate: a validation does not keep its scan in memory', MapScan.last === null);
});

// Per-map facts: budgets, materials, spawn counts per mode (MAP-010/011) and objectives per mode (s13).
function mapTestModeCounts(check, map) {
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
const mapTestRampDegrees = (brush) => Math.atan2(brush.max[1] - brush.min[1], brush.dir.endsWith('x') ? brush.max[0] - brush.min[0] : brush.max[2] - brush.min[2]) / DEG;

Test.add('maps', (check) => {
  for (const map of CAT.maps) {
    check(map.code + ': brush budget (<= 450) and ramp slope (<= 40 deg)', map.brushes.length <= MapRules.limits.brushes &&
      map.brushes.every((b) => b.shape !== 'ramp' || mapTestRampDegrees(b) <= MapRules.limits.rampMaxDegrees));
    check(map.code + ': every brush has a known material and min < max', map.brushes.every((b) => MapRules.materials.includes(b.material) && b.min.every((v, i) => v < b.max[i])));
    check(map.code + ': theme, sky and category are set', MapRules.themes.includes(map.theme) && typeof map.sky.top === 'number' && map.category in MapRules.sightLimits);
    check(map.code + ': has callout zones, nav hints and lights', map.zones.length >= 4 && map.navHints.length >= MapRules.limits.hints && map.lights.length >= 1);
    mapTestModeCounts(check, map);
  }
  const usedMaterials = new Set(CAT.maps.flatMap((map) => map.brushes.concat(map.props).map((b) => b.material)));
  check('materials: every one is used by some map brush or prop', MapRules.materials.every((material) => usedMaterials.has(material)), MapRules.materials.filter((m) => !usedMaterials.has(m)).join());
  const usedThemes = new Set(CAT.maps.map((map) => map.theme));
  check('themes: all six tilesets are used', MapRules.themes.every((theme) => usedThemes.has(theme)), MapRules.themes.filter((t) => !usedThemes.has(t)).join());
  const kinds = new Set(CAT.maps.flatMap((map) => map.triggers.map((t) => t.kind)));
  check('triggers: all six kinds are used', MapRules.triggerKinds.every((kind) => kinds.has(kind)), MapRules.triggerKinds.filter((k) => !kinds.has(k)).join());
});

Test.add('maps', (check) => {
  const spire = Maps.get('spire'), twin = Maps.get('twinkeeps');
  check('spawns: FFA spawns are team -1 and cover several zones', Maps.spawnList(spire, 'ffa', -1).length === 16 && mapTestReport('spire').stats.spawnZones >= 4);
  check('spawns: a team mode never gets another mode\'s spawns', Maps.spawnList(Maps.get('skyyard'), 'tdm', 0).every((s) => s.modes.includes('tdm'))
      && Maps.spawnList(Maps.get('skyyard'), 'tdm', -1).length === 0);
  check('spawns: team spawns are mirrored (twinkeeps)', twin.spawns.filter((s) => s.team === 0).every((s) => twin.spawns.some((o) => o.team === 1 && o.x === -s.x
      && o.z === s.z && Test.near(o.yaw, -s.yaw, 1e-9))));
  const isle = Maps.get('isle');
  const facing = isle.spawns.map((s) => -(s.x * Math.sin(s.yaw * DEG) + s.z * Math.cos(s.yaw * DEG)) / Math.hypot(s.x, s.z));
  check('spawns: every island spawn on the ring looks at the centre', facing.every((dot) => dot > 0.995), Math.min(...facing).toFixed(3));
});

// Items: keys, power spacing, MAP-005 spread, and what the mode filters keep.
function mapTestItemRules(check, map) {
  const keys = map.items.map((item) => item.item);
  check('items: ' + map.code + ' keys are known and in the right group', map.items.every((item) => MapRules.groupOf(item.item) === item.group && item.group !== ''),
      keys.filter((k) => !MapRules.groupOf(k)).join());
  const power = mapTestPoints(map, 'power');
  const gaps = power.flatMap((a, i) => power.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)));
  const closest = gaps.length ? Math.min(...gaps) : Infinity;
  check('items: ' + map.code + ' power items are >= 20 m apart (closest ' + (closest === Infinity ? 'n/a' : closest.toFixed(1)) + ')', closest >= MapRules.limits.powerSpacing);
}

Test.add('maps', (check) => {
  for (const map of CAT.maps) mapTestItemRules(check, map);
  for (const id of ['spire', 'skyyard', 'gantry']) {
    const stats = mapTestReport(id).stats;
    check('items: ' + id + ' MAP-005 target, no spawn is closest to more than 50% of the top items (' + stats.topItemShare + ')', stats.topItems >= 3 && stats.topItemShare <= 0.5);
  }
  for (const group of ['power', 'armor', 'health', 'weapon', 'ammo']) {
    check('items: pickups of group ' + group + ' appear on some map', CAT.maps.some((map) => map.items.some((item) => item.group === group)));
  }
  // The item catalogues belong to later sections: compare the keys only once all three exist (never required for this section's tests).
  const catalogues = ['weapons', 'powerups', 'items'].filter((name) => CAT[name]);
  const missing = catalogues.length < 3 ? [] : CAT.maps.flatMap((map) => map.items.map((item) => item.item)).filter((key) => !catalogues.some((name) => CAT[name].byId(key)));
  check('items: every item key exists in the weapons, powerups or items catalogue (checked once those exist)', missing.length === 0, missing.join());
  const spire = Maps.get('spire'), range = Maps.get('provinggrounds');
  const arenaGuns = CAT.weaponSets.byId('arenaSet').weapons;
  const offSet = CAT.maps.filter((map) => map.category === 'arena' && map.items.some((item) => item.group === 'weapon' && !arenaGuns.includes(item.item)));
  check('items: arena maps place only Arena set weapons', !offSet.length, offSet.map((map) => map.id).join());
  const serves = (map, mode) => map.items.filter((item) => mapServesMode(item, mode)).length;
  check('items: mapServesMode filters by mode', serves(range, 'range') && !serves(range, 'ffa') && serves(spire, 'ffa') === spire.items.length);
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
    check('zones: ' + map.code + ' at least 97% of the walkable area is covered', mapTestReport(map.id).stats.zoneCoverage >= 0.97);
  }
});

// A validator that only says "something is wrong" proves nothing: every mutation has to produce the problem of its own rule.
Test.add('maps', (check) => {
  for (const [what, id, change, rule, text] of MAP_MUTATIONS) {
    const broken = mapTestClone(id);
    change(broken);
    const problems = Maps.validate(broken);
    check('validator: ' + what + ' -> ' + rule + ': ' + text, mapTestHas(problems, rule, text), problems.slice(0, 3).join(' | '));
  }
  // MAP-005 share rule: the problem list is capped per rule, so the share itself is read from the stats.
  const crowded = mapTestClone('spire');
  crowded.items.push(...mapTestItemsNear(crowded, crowded.spawns[0], 8, 'heavyplate', 'armor'));
  const crowdedReport = Maps.report(crowded);
  check('validator: most top items near one spawn -> the share is above 50% and reported', crowdedReport.stats.topItemShare > 0.5
      && crowdedReport.problems.some((p) => p.startsWith('items:')), crowdedReport.stats.topItemShare);
  const lanes = mapTestReport('dustline').stats.routes;
  check('validator: dustline offers at least 3 separate routes (found ' + lanes + ')', lanes >= 3);
  const same = mapTestClone('dustline'), moved = mapTestClone('dustline');
  moved.items.push({ x: 0, y: 0, z: 20, item: 'healthpack', group: 'health', modes: [] });
  check('validator: a clone with the same data has the same hash, a changed map another', Maps.hash(same) === Maps.hash(Maps.get('dustline')) && Maps.hash(moved) !== Maps.hash(same));
});

// Maps written by hand elsewhere (editor, generator) may omit what the map format leaves optional or may be incomplete.
Test.add('maps', (check) => {
  const bare = mapTestClone('spire');
  for (const list of [bare.items, bare.spawns]) list.forEach((entry) => { delete entry.modes; });
  const noObjectiveModes = mapTestClone('twinkeeps');
  noObjectiveModes.objectives.forEach((objective) => { delete objective.modes; delete objective.path; });
  let thrown = '';
  try { Maps.validate(bare); Maps.validate(noObjectiveModes); Maps.objectivesFor(noObjectiveModes, 'ctf', 'flag'); Maps.spawnList(bare,
      'ffa', -1); } catch (error) { thrown = String(error); }
  check('format: entries without a modes list serve every mode and nothing throws', thrown === '', thrown);
  check('format: a missing modes list reads as every mode', bare.items.every((item) => mapServesMode(item, 'duel')) && Maps.spawnList(bare, 'ffa', -1).length === 16);
  check('format: a map without a modes list is still sound', Maps.validate(bare).length === 0);
  for (const list of MAP_REQUIRED_LISTS) {
    const broken = mapTestClone('spire');
    delete broken[list];
    let problems = [];
    try { problems = Maps.validate(broken); } catch (error) { problems = [String(error)]; }
    check('format: a map without ' + list + ' is reported, not crashed on', mapTestHas(problems, 'structure', list + ' list is missing'), problems.join(' | '));
  }
  const sizeless = mapTestClone('spire');
  delete sizeless.size;
  let sizeProblems = [];
  try { sizeProblems = Maps.validate(sizeless); } catch (error) { sizeProblems = [String(error)]; }
  check('format: a map without a size is reported, not crashed on', mapTestHas(sizeProblems, 'structure', 'size must be'), sizeProblems.join(' | '));
  const nameless = mapTestClone('spire');
  delete nameless.name; nameless.theme = 'volcano';
  check('format: a missing name and an unknown theme are reported', mapTestHas(Maps.validate(nameless), 'structure', 'id and name')
      && mapTestHas(Maps.validate(nameless), 'structure', 'unknown theme'));
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
  MapScan.release();
});

Test.add('maps', (check) => {
  const doorway = MapKit.wall('concrete', 'x', 0, 1, -10, 10, 0, 4, [[0, 3, 3]]);
  check('kit: wall with one door = two side segments and a lintel', doorway.length === 3 && doorway.some((row) => row[2] === 3 && row[1] === -1.5 && row[4] === 1.5));
  const stairs = MapKit.stairs('concrete', '+x', 0, 0, 4, 2, 0, 2, 5);
  check('kit: stairs rise in equal steps of at most 0.45 m', stairs.length === 5 && stairs.every((row, i) => Test.near(row[5], 0.4 * (i + 1), 1e-9)));
  const down = MapKit.stairs('concrete', '-z', 0, 0, 2, 4, 1, 2, 5);
  check('kit: stairs toward -z start at the far edge', down[0][3] > down[4][3] && Test.near(down[4][5], 3, 1e-9));
  let refused = false;
  try { MapKit.stairs('concrete', '+x', 0, 0, 4, 2, 0, 2, 4); } catch (error) { refused = true; }
  check('kit: stairs with a riser above 0.45 m are refused (so every stair in every map is climbable)', refused && MapKit.stairs('concrete', '+x', 0, 0, 4, 2, 0, 1.8, 4).length === 4);
});

// Mirror, join and expand rules of the kit, on one small half map.
Test.add('maps', (check) => {
  const half = {
    brushes: [['metal', -4, 0, 1, -2, 3, 5, '+x']], spawns: [[0, ['tdm'], [[-3, 0, 2, 90]]]], items: [['fury', -3, 0, 2]], zones: [['West Hall', -5, 0, -1, 6]],
    lights: [[-3, 3, 2, 0xffffff, 5]], hints: [['cover', -3, 0, 2]], objectives: [{ id: 'flagWest', kind: 'flag', team: 0, x: -3, y: 0, z: 2 }],
    triggers: [
      { kind: 'jumppad', min: [-4, 0, 1], max: [-2, 0.4, 3], target: [-3, 2, 8], peak: 2 },
      { kind: 'teleporter', min: [-4, 0, -3], max: [-3, 0.3, -2], exit: [-2, 0, 6], yaw: 30 },
    ],
  };
  const both = MapKit.sym(half, 'x'), flipped = MapKit.sym(half, 'z');
  const mirroredNames = both.zones[1][0] === 'East Hall' && both.objectives[1].id === 'flagEast' && both.objectives[1].team === 1 && both.objectives[1].x === 3;
  check('kit: mirror across x flips x, ramp direction, yaw, teams and names', both.brushes[1][1] === 2 && both.brushes[1][4] === 4 && both.brushes[1][7] === '-x'
      && both.spawns[1][0] === 1 && both.spawns[1][2][0][3] === -90 && mirroredNames);
  check('kit: mirror across x flips pad targets, teleporter exits and teleporter yaw', both.triggers[2].target[0] === 3 && both.triggers[3].exit[0] === 2
      && both.triggers[3].yaw === -30 && both.triggers[2].target[2] === 8);
  check('kit: mirror across z keeps teams and flips z, yaw and names', flipped.brushes[1][3] === -5 && flipped.spawns[1][0] === 0
      && flipped.spawns[1][2][0][3] === 90 && flipped.zones[1][2] === -6);
  check('kit: mirror across z flips pad targets, teleporter exits and teleporter yaw', flipped.triggers[2].target[2] === -8 && flipped.triggers[3].exit[2] === -6
      && flipped.triggers[3].yaw === 150);
  check('kit: keepTeams leaves both sides on the same team', MapKit.sym(half, 'x', true).spawns[1][0] === 0 && MapKit.sym(half, 'x', true).objectives[1].team === 0);
  check('kit: join concatenates every list', MapKit.join(half, half).brushes.length === 2 && MapKit.join(half, half).triggers.length === 4);
  const row = MapKit.make({ id: 'kit', brushes: half.brushes, spawns: half.spawns, items: half.items, zones: half.zones, lights: half.lights, hints: half.hints });
  check('kit: make expands compact rows into the map format', row.brushes[0].dir === '+x' && row.spawns[0].team === 0 && row.items[0].group === 'power'
      && row.zones[0].min[1] === MAP_ZONE_FLOOR && row.navHints[0].kind === 'cover' && !('hints' in row));
});

// A flat 20 x 20 m floor split by a wall along x at z = 0, with one doorway at an offset from the middle; can a body cross it?
function mapTestDoorPasses(width, height, offset) {
  const rows = [['concrete', -10, -1, -10, 10, 0, 10]].concat(MapKit.wall('concrete', 'x', 0, 1, -10, 10, 0, 6, [[offset, width, height]]));
  const map = { size: [20, 10, 20], brushes: rows.map((row) => MapKit.brush(row)), triggers: [] };
  const scan = MapScan.of(map);
  const south = MapScan.nodeNear(scan, 0, 0, -5, 0.5), north = MapScan.nodeNear(scan, 0, 0, 5, 0.5);
  return MapScan.reach(scan, [south], false, null)[north] === 1;
}
const MAP_TEST_OFFSETS = [-0.5, -0.45, -0.4, -0.3, -0.25, -0.2, -0.1, 0, 0.05, 0.1, 0.2, 0.25, 0.3, 0.4, 0.45, 0.5];
const mapTestNodesAt = (scan, x, z) => { const column = MapScan.columnOf(scan, x, z); return scan.columnStart[column + 1] - scan.columnStart[column]; };

Test.add('maps', (check) => {
  const wide = MAP_TEST_OFFSETS.filter((offset) => !mapTestDoorPasses(1.4, 2.4, offset));
  check('doorway: 1.4 m wide and 2.4 m high passes at every offset on the grid', wide.length === 0, wide.join());
  const roomy = MAP_TEST_OFFSETS.filter((offset) => !mapTestDoorPasses(1.6, 2.4, offset));
  check('doorway: 1.6 m wide (MAP-004) passes at every offset', roomy.length === 0, roomy.join());
  const narrow = MAP_TEST_OFFSETS.filter((offset) => mapTestDoorPasses(1.2, 2.4, offset));
  check('doorway: 1.2 m wide never passes, wherever it sits', narrow.length === 0, narrow.join());
  check('doorway: 1.3 m wide does not pass', !mapTestDoorPasses(1.3, 2.4, 0) && !mapTestDoorPasses(1.3, 2.4, 0.25));
  check('doorway: 2.4 m high passes, 2.3 m does not', mapTestDoorPasses(1.4, 2.4, 0) && !mapTestDoorPasses(1.4, 2.3, 0) && !mapTestDoorPasses(1.4, 2.3, 0.25));
  const lone = MapScan.of({ size: [20, 10, 20], brushes: [['concrete', -10, -1, -10, 10, 0, 10], ['concrete', 0, 0, -10, 1, 4, 10]].map((row) => MapKit.brush(row)), triggers: [] });
  check('doorway: the body stands 0.45 m from a lone wall (capsule 0.4 m plus skin) but not closer', mapTestNodesAt(lone, -0.25, 0) === 0 && mapTestNodesAt(lone, -0.75, 0) === 1);
  MapScan.release();
});

Test.add('maps', (check) => {
  const harbor = Maps.get('harbor');
  const first = MapScan.of(harbor);
  check('scan: the latest scan is reused for the same row', MapScan.of(harbor) === first);
  check('scan: node count is sane for a 90 x 90 m map', first.nodeCount > 20000 && first.nodeCount < 120000, first.nodeCount);
  check('scan: edges are packed typed arrays with a cost per kind', first.forward.to instanceof Int32Array && first.forward.kind instanceof Uint8Array
      && first.forward.kind.every((kind) => kind < first.edgeCosts.length));
  check('scan: the reverse graph holds the same edges', first.backward.to.length === first.forward.to.length
      && first.backward.start[first.nodeCount] === first.forward.start[first.nodeCount]);
  const dock = MapScan.nodeNear(first, -40, 0, 16, 0.5), bed = MapScan.nodeNear(first, -20, -3, 16, 0.5);
  check('scan: the canal bed is walkable and joined to the dock by the slipway', dock >= 0 && bed >= 0 && MapScan.reach(first, [bed], false, null)[dock] === 1);
  const distances = MapScan.distances(first, [dock], null, false).dist;
  check('scan: path distance is at least the straight-line distance', distances[bed] >= Math.hypot(20, 0) && isFinite(distances[bed]));
  const spire = MapScan.of(Maps.get('spire'));
  const ground = MapScan.nodeNear(spire, 0, 0, 16, 0.5), crown = MapScan.nodeNear(spire, 0, 8, 2.8, 0.5);
  check('scan: the spire top is reachable from the floor and back', MapScan.reach(spire, [ground], false, null)[crown] === 1 && MapScan.reach(spire, [crown], false, null)[ground] === 1);
  const around = MapScan.nodesAround(spire, ground, 1, 1);
  check('scan: nodesAround finds the cells within a radius, itself included', around.includes(ground) && around.length >= 8 && around.length <= 16, around.length);
  const ladder = MapScan.of(Maps.get('cistern')).ladders[0];
  check('scan: a ladder joins cells at its foot and at its top', ladder.bottoms > 0 && ladder.tops > 0);
  check('scan: teleporters resolve their exit cell', MapScan.of(Maps.get('cistern')).teleporters.every((t) => t.exit >= 0 && t.entries > 0));
  const isle = MapScan.of(Maps.get('isle'));
  check('scan: the 300 m island uses the coarse grid (fewer than 120000 cells)', isle.cell === MAP_CELL_COARSE && isle.nodeCount < 120000, isle.nodeCount);
  MapScan.release();
});

// Jump pads (docs/api/world-move.md): the arc ends on the target whatever the gravity, so the target and the arcs are what is checked.
function mapTestPadStarts(scan, pad) {
  const trigger = pad.trigger, found = [];
  for (let n = 0; n < scan.nodeCount; n++) if (mapInBox(trigger, MapScan.nodeX(scan, n), scan.nodeY[n], MapScan.nodeZ(scan, n), 0, 0.6)) found.push(n);
  return found;
}
function mapTestBlockedArcs(scan, pad) {
  let blocked = 0;
  for (const node of mapTestPadStarts(scan, pad)) {
    for (const gravity of MAP_TEST_GRAVITIES) {
      if (!MapScan.arcClear(scan, MapScan.nodeX(scan, node), scan.nodeY[node], MapScan.nodeZ(scan, node), pad.trigger, gravity)) blocked++;
    }
  }
  return blocked;
}
const mapTestPadMaps = ['skyyard', 'gantry', 'provinggrounds', 'chambers'];

Test.add('maps', (check) => {
  for (const id of mapTestPadMaps) {
    const scan = MapScan.of(Maps.get(id));
    for (const pad of scan.pads) {
      const where = id + ' pad at ' + pad.trigger.min.join(',');
      check('pads: ' + where + ' lands on a floor, at least one capsule radius from its edge', pad.landing >= 0 && pad.firm);
      check('pads: ' + where + ' flies clear from every start cell under every preset gravity (13 to 24)', pad.entries > 0 && mapTestBlockedArcs(scan, pad) === 0
          && pad.open === pad.entries);
    }
  }
  check('pads: skyyard has 8 pads, gantry 4, the proving grounds and chambers at least 1 each', MapScan.of(Maps.get('skyyard')).pads.length === 8
      && MapScan.of(Maps.get('gantry')).pads.length === 4 &&
    MapScan.of(Maps.get('provinggrounds')).pads.length >= 1 && MapScan.of(Maps.get('chambers')).pads.length >= 3);
  const pad = { target: [10, 4, 0], peak: 3 };
  const apexes = MAP_TEST_GRAVITIES.map((gravity) => { const arc = World.padArc(pad, 6, gravity); return 6 + (arc.upSpeed * arc.upSpeed) / (2 * gravity); });
  check('pads: the arc peaks 3 m above the higher of start and target under every gravity', apexes.every((apex) => mapTestWithin(apex, 9, 1e-9)), apexes.join());
  const times = MAP_TEST_GRAVITIES.map((gravity) => World.padArc(pad, 6, gravity).time * Math.sqrt(gravity));
  check('pads: flight time scales with 1/sqrt(gravity), so the path in space is the same', times.every((scaled) => mapTestWithin(scaled, times[0], 1e-9)));
  // The scan flies S08's own arc: a pad with no `peak` rises the default height, so a low ceiling on the way blocks it.
  const roofed = { size: [20, 10, 20], brushes: [['concrete', -10, -1, -10, 10, 0, 10], ['concrete', -2, 2.8, 2, 2, 3, 6]].map((row) => MapKit.brush(row)), triggers: [] };
  const roofScan = MapScan.of(roofed);
  check('pads: a peakless pad flies the game arc into a low roof', !MapScan.arcClear(roofScan, 0, 0, 0, { target: [0, 0, 8] }, GRAVITY)
    && MapScan.arcClear(roofScan, 0, 0, 0, { target: [0, 0, 8], peak: 0.5 }, GRAVITY));
  MapScan.release();
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

// Audit 32 (MAP-013): the versus maps carry breakable props for W41, shots and blasts. Bots' nav and the validator treat props as solid
// boxes; this checks that each prop stands on a floor and keeps clear of brushes, triggers, spawns, items and objectives.
const MAP_TEST_PROP_CLEARANCE = 2.5;   // metres from a prop's edge to any spawn, item or objective on its level
const MAP_TEST_PROP_LEVEL = 3;         // points more than this far above or below the prop's base are on another level
const MAP_TEST_PROP_ROUTE = 8;         // metres from a prop's centre to an item, objective or choke/cover hint: a place players pass
const MAP_TEST_PROPS_ON_ROUTES = 2;    // props per versus map that must stand where players pass (W41 lifts, breaks, G01)
function mapTestBoxesMeet(a, b, margin) {
  for (let axis = 0; axis < 3; axis++) if (a.min[axis] >= b.max[axis] + margin || a.max[axis] <= b.min[axis] - margin) return false;
  return true;
}
function mapTestPropProblem(map, prop) {
  const onFloor = map.brushes.some((brush) => brush.shape === 'box' && Math.abs(brush.max[1] - prop.min[1]) < 0.01 && brush.min[0] <= prop.min[0]
    && brush.max[0] >= prop.max[0] && brush.min[2] <= prop.min[2] && brush.max[2] >= prop.max[2]);
  if (!onFloor) return 'stands on no floor';
  if (map.brushes.some((brush) => mapTestBoxesMeet(brush, prop, -0.001))) return 'overlaps a brush';
  if (map.triggers.some((trigger) => mapTestBoxesMeet(trigger, prop, 1))) return 'touches a trigger';
  const gap = (p) => Math.max(prop.min[0] - p.x, p.x - prop.max[0], prop.min[2] - p.z, p.z - prop.max[2]);
  const near = map.spawns.concat(map.items, map.objectives).find((p) => gap(p) < MAP_TEST_PROP_CLEARANCE && Math.abs(p.y - prop.min[1]) < MAP_TEST_PROP_LEVEL);
  return near ? 'is too close to ' + (near.item || near.kind || 'a spawn') + ' at ' + near.x + ', ' + near.z : '';
}
Test.add('maps', (check) => {
  const problems = [];
  for (const map of CAT.maps) map.props.forEach((prop, index) => {
    const text = mapTestPropProblem(map, Data.normalize(PROP_FIELDS, prop));
    if (text) problems.push(map.code + ' prop #' + index + ' ' + text);
  });
  check('props: every prop stands on a floor, clear of brushes, triggers, spawns, items and objectives', problems.length === 0, problems.slice(0, 4).join('; '));
  const versus = CAT.maps.filter((map) => !map.placeholder && (map.category === 'arena' || map.category === 'large'));
  const bare = versus.filter((map) => map.props.length < 3).map((map) => map.code);
  check('props: every versus map has breakable props', versus.length >= 7 && bare.length === 0, bare.join());
  const offRoute = versus.filter((map) => {
    const places = map.items.concat(map.objectives, map.navHints.filter((hint) => hint.kind === 'choke' || hint.kind === 'cover'));
    const onRoute = map.props.filter((prop) => places.some((place) => Math.abs(place.y - prop.min[1]) < MAP_TEST_PROP_LEVEL
      && length2(place.x - (prop.min[0] + prop.max[0]) / 2, place.z - (prop.min[2] + prop.max[2]) / 2) < MAP_TEST_PROP_ROUTE));
    return onRoute.length < MAP_TEST_PROPS_ON_ROUTES;
  }).map((map) => map.code);
  check('props: every versus map has crates where players pass (by items, objectives or cover)', offRoute.length === 0, offRoute.join());
  check('props: the Graviton Lifter can hold every map prop', CAT.maps.every((map) => map.props.every((prop) => Data.normalize(PROP_FIELDS, prop).mass <= LIFTER_MAX_MASS)));
});
