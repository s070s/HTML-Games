// Procedural map generator data (MAP-020..MAP-023, spec s18): the five generators GN1..GN5, the six tilesets of MAP-022
// (materials, light colour and sky per theme, 12 named room modules each), the room module patterns the modules use,
// the map sizes with their quality caps and the cover densities. The generic code in 16w-mapgen*.js reads only these rows.
// Materials must be map materials (MapRules.materials); colours are 0xRRGGBB like the map rows.

// Room module patterns. Props are [kind, u, v, width, depth, height]: u and v in -1..1 across the inner part of a cell
// (where prop centres may lie: the cell minus a 2.8 m border, so doors and the walk around the walls stay free), sizes in metres.
// kind: cover (crates and blocks, cover material), pillar (full-height column, pillar material), platform (solid block with a
// ramp on a seeded side: height = the platform top), low (a low wall, crouch cover).
Data.define('mapModules', { id: REQUIRED, props: REQUIRED, open: true }, [
  { id: 'plaza', props: [['cover', -0.9, -0.9, 1.2, 1.2, 1], ['cover', 0.9, 0.9, 1.2, 1.2, 1]] },
  { id: 'pillar', props: [['pillar', 0, 0, 1.6, 1.6, 0], ['cover', -0.95, 0.7, 1.2, 1.2, 1.8]], open: false },
  { id: 'crates', props: [['cover', -0.7, -0.5, 1.4, 1.4, 1.8], ['cover', 0.6, 0.8, 1.2, 1.2, 1], ['cover', 0.85, -0.85, 1.2, 1.2, 1.8]] },
  { id: 'platform', props: [['platform', 0, 0, 2.4, 2.4, 1.5]], open: false },
  { id: 'lowwalls', props: [['low', 0, -0.6, 3.6, 0.4, 1], ['low', 0, 0.6, 3.6, 0.4, 1]] },
  { id: 'corner', props: [['pillar', -0.55, -0.55, 2.4, 0.5, 0], ['pillar', -0.8, -0.2, 0.5, 1.8, 0], ['cover', 0.8, 0.8, 1.2, 1.2, 1]], open: false },
  { id: 'columns', props: [['pillar', -0.75, -0.75, 0.8, 0.8, 0], ['pillar', 0.75, 0.75, 0.8, 0.8, 0], ['pillar', -0.75, 0.75, 0.8, 0.8, 0], ['pillar', 0.75, -0.75, 0.8, 0.8, 0]] },
  { id: 'bunker', props: [['pillar', 0, 0, 3, 1.6, 0], ['cover', 0, 0.95, 1.2, 1.2, 1]], open: false },
]);

// MAP-022 tilesets: one per map theme (the render themes of 03b). Module rows are [callout name, pattern id].
const MAPGEN_SKIES = {
  foundry: { top: 0x3b2f3a, horizon: 0xd9925a, fog: 0xb9815a, fogFar: 170, sun: [0.4, 0.6, 0.3] },
  ruins: { top: 0x4f86c6, horizon: 0xd8e4ee, fog: 0xd6d0c0, fogFar: 220, sun: [-0.3, 0.7, 0.4] },
  station: { top: 0x05070f, horizon: 0x1b2a44, fog: 0x1b2a44, fogFar: 160, sun: [0.2, 0.6, -0.5] },
  canal: { top: 0x6f7f8f, horizon: 0xc3ccd3, fog: 0xaab6bf, fogFar: 180, sun: [0.3, 0.6, -0.4] },
  overgrowth: { top: 0x5ea0c8, horizon: 0xcfe6d9, fog: 0x9fc0a5, fogFar: 240, sun: [0.5, 0.8, 0.2] },
  glacier: { top: 0x7fb2e6, horizon: 0xe9f3fb, fog: 0xdce9f2, fogFar: 200, sun: [0.2, 0.6, 0.6] },
};
Data.define('mapTilesets', {
  id: REQUIRED, name: REQUIRED, floor: 'concrete', ground: 'sand', wall: 'concrete', pillar: 'concrete', cover: 'metal', platform: 'concrete',
  trim: 'metal', light: 0xffe0b0, wallHeight: 6, sky: REQUIRED, modules: REQUIRED,
}, [
  { id: 'foundry', name: 'Foundry', floor: 'concrete', ground: 'sand', wall: 'metal', pillar: 'concrete', cover: 'metal', platform: 'concrete', trim: 'metal', light: 0xffb070,
    sky: MAPGEN_SKIES.foundry, modules: [['Kiln', 'pillar'], ['Smelter', 'crates'], ['Crucible Hall', 'platform'], ['Slag Pit', 'lowwalls'], ['Gantry', 'columns'],
      ['Press Room', 'bunker'], ['Cooling Yard', 'plaza'], ['Ingot Store', 'crates'], ['Furnace Mouth', 'corner'], ['Ore Chute', 'pillar'], ['Bellows', 'columns'], ['Casting Floor', 'platform']] },
  { id: 'ruins', name: 'Ruins', floor: 'sand', ground: 'sand', wall: 'concrete', pillar: 'concrete', cover: 'wood', platform: 'concrete', trim: 'wood', light: 0xffe2b0,
    sky: MAPGEN_SKIES.ruins, modules: [['Courtyard', 'plaza'], ['Colonnade', 'columns'], ['Old Well', 'pillar'], ['Market', 'crates'], ['Chapel', 'bunker'],
      ['Broken Arch', 'corner'], ['Terrace', 'platform'], ['Bazaar', 'lowwalls'], ['Cistern Gate', 'pillar'], ['Watch Steps', 'platform'], ['Atrium', 'columns'], ['Rubble Lane', 'crates']] },
  { id: 'station', name: 'Station', floor: 'tile', ground: 'tile', wall: 'metal', pillar: 'metal', cover: 'metal', platform: 'metal', trim: 'glass', light: 0x7fd8ff,
    sky: MAPGEN_SKIES.station, modules: [['Airlock', 'bunker'], ['Hangar', 'plaza'], ['Reactor', 'pillar'], ['Cargo Bay', 'crates'], ['Bridge Deck', 'platform'],
      ['Lab', 'lowwalls'], ['Comms', 'columns'], ['Docking Ring', 'corner'], ['Hydroponics', 'lowwalls'], ['Med Bay', 'crates'], ['Core Shaft', 'pillar'], ['Observatory', 'platform']] },
  { id: 'canal', name: 'Canal', floor: 'concrete', ground: 'concrete', wall: 'concrete', pillar: 'concrete', cover: 'wood', platform: 'wood', trim: 'metal', light: 0xfff0c8,
    sky: MAPGEN_SKIES.canal, modules: [['Lock Gate', 'bunker'], ['Wharf', 'crates'], ['Pump House', 'pillar'], ['Towpath', 'lowwalls'], ['Boat Shed', 'platform'],
      ['Footbridge', 'columns'], ['Basin', 'plaza'], ['Warehouse', 'crates'], ['Sluice', 'corner'], ['Quay', 'lowwalls'], ['Mill Race', 'pillar'], ['Crane Yard', 'platform']] },
  { id: 'overgrowth', name: 'Overgrowth', floor: 'grass', ground: 'grass', wall: 'concrete', pillar: 'wood', cover: 'wood', platform: 'concrete', trim: 'wood', light: 0xfff4c8,
    sky: MAPGEN_SKIES.overgrowth, modules: [['Grove', 'columns'], ['Glade', 'plaza'], ['Old Shrine', 'bunker'], ['Root Hollow', 'corner'], ['Mossy Steps', 'platform'],
      ['Thicket', 'crates'], ['Fern Bank', 'lowwalls'], ['Stone Circle', 'columns'], ['Greenhouse', 'pillar'], ['Vine Wall', 'corner'], ['Lookout', 'platform'], ['Orchard', 'crates']] },
  { id: 'glacier', name: 'Glacier', floor: 'ice', ground: 'sand', wall: 'concrete', pillar: 'ice', cover: 'metal', platform: 'ice', trim: 'metal', light: 0xcfe8ff,
    sky: MAPGEN_SKIES.glacier, modules: [['Crevasse', 'lowwalls'], ['Ice Cave', 'pillar'], ['Research Hut', 'bunker'], ['Frozen Lake', 'plaza'], ['Serac', 'columns'],
      ['Snow Bridge', 'platform'], ['Drill Site', 'crates'], ['Icefall', 'corner'], ['Supply Cache', 'crates'], ['Moraine', 'lowwalls'], ['Weather Mast', 'pillar'], ['Summit', 'platform']] },
]);

// Map sizes (13.4 size cap per quality tier: a size is offered only on the tiers it lists; larger maps cost bake and scan time).
// scale picks the generator's own dimensions (generators list one entry per size).
Data.define('mapSizes', { id: REQUIRED, name: REQUIRED, index: 0, tiers: REQUIRED }, [
  { id: 'small', name: 'Small', index: 0, tiers: ['potato', 'low', 'medium', 'high', 'ultra'] },
  { id: 'medium', name: 'Medium', index: 1, tiers: ['low', 'medium', 'high', 'ultra'] },
  { id: 'large', name: 'Large', index: 2, tiers: ['medium', 'high', 'ultra'] },
]);

// Cover density: how many cells get a prop module (the rest stay open floor) and how many extra crates are scattered.
Data.define('mapDensities', { id: REQUIRED, name: REQUIRED, moduleShare: 0.7, scatter: 0 }, [
  { id: 'sparse', name: 'Sparse', moduleShare: 0.45, scatter: 0 },
  { id: 'normal', name: 'Normal', moduleShare: 0.7, scatter: 1 },
  { id: 'dense', name: 'Dense', moduleShare: 0.95, scatter: 2 },
]);

// Item sets the placement draws from (16w-mapgen-place.js). Group lists name MapRules.itemGroups (one plain pickup each, mirrored
// on mirrored maps); 'power' lists the power-up keys the generator puts on the centre line (the ones that fit any arena: no
// mode-specific or long-lasting powers).
Data.define('mapItemSets', { id: REQUIRED, list: REQUIRED }, [
  { id: 'power', list: ['fury', 'warding', 'quickening', 'surplus', 'renewal', 'skyward'] },
  { id: 'pickups', list: ['weapon', 'weapon', 'weapon', 'armor', 'armor', 'health', 'health', 'health', 'ammo', 'ammo'] },   // modes that use pickups
  { id: 'supply', list: ['health', 'health', 'ammo', 'armor'] },                                                              // other modes
  { id: 'loot', list: ['weapon', 'weapon', 'weapon', 'armor', 'armor', 'health', 'health', 'ammo'] },   // per royale loot site (6 sites: the 48 spots of MP09)
]);

// GN1..GN5 (MAP-021). kit = the layout function in 16w-mapgen-kits.js. cells = [cols, rows] per size (small, medium, large);
// cell = cell size in metres. modes = every mode the generator can place; defaultModes = the modes of a map made without a mode.
// fallback = the authored map used when five seeds in a row fail validation (MAP-023). siteWalk = the spawn-to-site run window in
// seconds the bomb sites aim for (GN2: 20-25 s at the tactical run speed; the site column nearest the window is used).
Data.define('generators', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, kit: REQUIRED, category: 'arena', cell: 12, cells: REQUIRED, height: 24, modes: REQUIRED,
  defaultModes: REQUIRED, fallback: REQUIRED, blurb: '', siteWalk: null,
}, [
  { id: 'tilechain', code: 'GN1', name: 'Tile Chain', kit: 'chain', category: 'pve', cell: 12, cells: [[5, 5], [6, 6], [7, 7]],
    modes: ['horde', 'endless', 'fiends', 'contract'], defaultModes: ['horde', 'endless', 'fiends', 'contract'], fallback: 'cistern',
    blurb: 'Themed rooms chained door to door: start, connectors, the objective room, the exit and a few dead ends.' },
  { id: 'lanes', code: 'GN2', name: 'Lanes and Sites', kit: 'lanes', category: 'large', cell: 14, cells: [[6, 3], [10, 3], [12, 3]],
    modes: ['bomb', 'ghostops', 'elim', 'tdm', 'rush', 'payload', 'conquest', 'dom', 'hardpoint', 'attrition', 'control'],
    defaultModes: ['bomb', 'elim', 'tdm'], fallback: 'dustline', siteWalk: [20, 25], blurb: 'Three lanes between two bases, two sites near the defenders and a contested middle.' },
  { id: 'mirror', code: 'GN3', name: 'Mirror Arena', kit: 'mirror', category: 'arena', cell: 12, cells: [[4, 4], [4, 5], [6, 5]],
    modes: ['ffa', 'duel', 'tdm', 'ctf', 'oneflag', 'dom', 'oddball', 'hardpoint', 'lms', 'gungame', 'juggernaut', 'infection', 'cursetag', 'roulette', 'bearer', 'bank'],
    defaultModes: ['ffa', 'duel', 'tdm'], fallback: 'spire', blurb: 'One half generated, then mirrored: the same rooms, items and spawns on both sides.' },
  { id: 'towers', code: 'GN4', name: 'Vertical Towers', kit: 'towers', category: 'large', cell: 16, cells: [[4, 3], [4, 4], [6, 4]],
    modes: ['ffa', 'tdm', 'dom', 'hardpoint', 'oddball', 'gungame', 'ctf'], defaultModes: ['ffa', 'tdm'], fallback: 'gantry',
    blurb: 'Rooftops linked by bridges, ladders and jump pads over open streets.' },
  { id: 'island', code: 'GN5', name: 'Island', kit: 'island', category: 'island', cell: 34, cells: [[6, 6], [8, 8], [9, 9]],
    modes: ['royale'], defaultModes: ['royale'], fallback: 'isle', blurb: 'Open ring island of walled fields with six loot sites.' },
]);
