// ==== S16 MAPS: CATALOGUE ====
// The `maps` catalogue: every row collected in Maps.rows by 16b..16e. Generated maps (MapGen, later) use the same schema.
// Fields beyond docs/ARCHITECTURE.md: category (sightline limit, MAP-003), version, placeholder, blurb (menu text). docs/api/maps.md.

Data.define('maps', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, size: REQUIRED, theme: REQUIRED, modes: REQUIRED, sky: REQUIRED,
  brushes: REQUIRED, spawns: REQUIRED, items: [], objectives: [], zones: REQUIRED, triggers: [], lights: [], navHints: [],
  seed: 0, category: 'arena', version: MapRules.version, placeholder: false, blurb: '',
}, Maps.rows);
