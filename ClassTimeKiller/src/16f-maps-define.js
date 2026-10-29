// ==== S16 MAPS: CATALOGUE ====
// The `maps` catalogue: every row collected in Maps.rows by 16b..16e. Generated maps (MapGen, later) use the same schema.
// Fields beyond docs/ARCHITECTURE.md: category (sightline limit, MAP-003), version, placeholder, blurb (menu text), props (breakable
// boxes, S08 Props; the PvE level report counts them). docs/api/maps.md.

Maps.rows.sort((a, b) => (a.code < b.code ? -1 : 1));          // catalogue order = map code order, whatever file a map lives in
Data.define('maps', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, size: REQUIRED, theme: REQUIRED, modes: REQUIRED, sky: REQUIRED,
  brushes: REQUIRED, spawns: REQUIRED, items: [], objectives: [], zones: REQUIRED, triggers: [], lights: [], navHints: [],
  seed: 0, category: 'arena', version: MapRules.version, placeholder: false, blurb: '', props: [],
}, Maps.rows);

// The match record gets its map row as soon as the setup is announced, so every match.load / match.start listener can read Game.match.map.
// setup.map is a catalogue id / code, or a map object (generated or custom). An unknown id leaves match.map null: the mode layer
// decides, except for a mode that cannot run without a map (behaviour.needsMap, M28 Silent Contract): it gets its first map (A-02).
Bus.on('match.setup', (match) => {
  const requested = match.setup.map;
  match.map = requested && typeof requested === 'object' ? requested : Maps.get(requested);
  const behaviour = Modes.behaviours.get(match.setup.mode);
  if (match.map || !behaviour || !behaviour.needsMap) return;
  match.map = Maps.forMode(match.setup.mode)[0] || null;
  if (requested && match.map) emitToast('Map "' + requested + '" was not found: playing ' + match.map.name);   // a typo or a deleted map is not silent
});
