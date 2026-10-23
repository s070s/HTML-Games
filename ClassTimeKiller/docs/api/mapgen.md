# Map generator (S16, steps 13.1 to 13.4): seeded maps in the authored map format

Files: `src/03n-data-mapgen.js` (catalogues `mapModules`, `mapTilesets`, `mapSizes`, `mapDensities`, `mapItemSets`, `generators`),
`src/16w-mapgen-kits.js` (`MapGenKits`: the geometry of GN1..GN5 on a shared cell grid), `src/16w-mapgen-place.js` (`MapGenPlace`: spawns, items,
objectives and hints; the fixed direction tables), `src/16w-mapgen.js` (`MapGen`: options, driver, validation, sightline repair, fallback, MP09),
`src/18h-ui-mapgen.js` (`MapGenMenu` and the `mapgen` screen), tests in `src/20b-test-mapgen.js` (group `mapgen`). The runtime map list lives in
`src/16a-maps.js` (`Maps.runtime`, `Maps.addRuntime`, `Maps.savedForMode`).

A generated map is an ordinary map row (docs/api/maps.md "Map row"): `World.load`, `Nav.build`, `Maps.validate`, the modes and the renderer
take it as they take a hand-made one.

## API

```
MapGen.generate({ generator, seed, size, theme, density, mode, quality, uncapped, trusted }) -> map row
MapGen.last          -> report of the latest generate() (below)
MapGen.resolve(options) -> { generator, seed, size, sizeCut, theme, density, mode, modes, trusted } (catalogue rows, the size capped)
MapGen.sizeCap(qualityId?) -> the largest mapSizes row the quality tier allows (default: the active preset)
MapGen.cappedSize(sizeId, qualityId?, uncapped?) -> the mapSizes row a request gets
MapGen.shareCode(options) -> 'CTKMAP-GN3-medium-foundry-normal-ffa-48213' (the settings generate() uses: size capped, theme resolved)
MapGen.parseShare(text) -> options, or null when the text is not a map code
MapGen.generator(idOrCode) -> generators row or null
MapGen.ringIsle()    -> MP09 Ring Isle (GN5, seed MAPGEN_TRUSTED_SEED, large, overgrowth, normal, royale), built once and cached
Daily.generateMap    =  (options) => MapGen.generate(options)   (hook of the earlier Daily Seed section 15c, filled here)
```

| Option | Values | Default |
|---|---|---|
| `generator` | `GN1`..`GN5` or the row id (`tilechain`, `lanes`, `mirror`, `towers`, `island`) | GN1 |
| `seed` | whole number, taken modulo 2^31 - 1 | 0 |
| `size` | `small`, `medium`, `large` (cut to the tier cap unless `uncapped`) | `medium` |
| `theme` | `foundry`, `ruins`, `station`, `canal`, `overgrowth`, `glacier` | picked from the generator and seed |
| `density` | `sparse`, `normal`, `dense` (share of cells with cover modules, island scatter) | `normal` |
| `mode` | one of the generator's `modes`; empty = the generator's `defaultModes` | empty |
| `quality` | quality preset id for the size cap | the active preset |
| `uncapped` | true: no size cap (tests, sweeps) | false |
| `trusted` | true: skip validation and repair (only for inputs a self-test proves valid, such as MP09) | false |

Determinism (MAP-020): every random draw comes from `makeRandom(hashString(key))` streams keyed by the generator, seed, size, theme, density
and modes, never from `Rng` or the clock. The same options give a map that is byte-identical under `JSON.stringify`. The same holds across
browsers (share codes, MP09 built at match start without validation): the kits and the placement never call `Math.hypot`, `sin`, `cos`,
`atan2` or `tan` (their last bit may differ between engines). Directions come from fixed tables (`MAPGEN_YAWS`: 8 spawn yaws as
(sin, cos); `MAPGEN_RING`: the validator's 16 directions as (cos, sin), the first quadrant written as literals and turned by swapping and
negating), distances from `Math.sqrt` (correctly rounded on every engine). A self-test scans the generator's functions for those calls.

## Generators

| Code | Kit | Category | Cell m | Cells small / medium / large | Modes (default first) | Fallback |
|---|---|---|---|---|---|---|
| GN1 Tile Chain | `chain` | pve | 12 | 5x5 / 6x6 / 7x7 | horde, endless, fiends, contract | cistern |
| GN2 Lanes and Sites | `lanes` | large | 14 | 6x3 / 10x3 / 12x3 | bomb, elim, tdm; ghostops, rush, payload, conquest, dom, hardpoint, attrition, control | dustline |
| GN3 Mirror Arena | `mirror` | arena | 12 | 4x4 / 4x5 / 6x5 | ffa, duel, tdm; ctf, oneflag, dom, oddball, hardpoint, lms, gungame, juggernaut, infection, cursetag, roulette, bearer, bank | spire |
| GN4 Vertical Towers | `towers` | large | 16 | 4x3 / 4x4 / 6x4 | ffa, tdm; dom, hardpoint, oddball, gungame, ctf | gantry |
| GN5 Island | `island` | island | 34 | 6x6 / 8x8 / 9x9 | royale | isle |

- GN1: a chain of rooms door to door (start room, connectors, the objective room, the exit, dead ends); co-op spawns in the start room and the gate rooms.
- GN2: three lanes between two bases joined every other cell; bomb sites in the defenders' half, rush stages, a payload street kept clear.
  MAP-021 spawn-to-site 20-25 s: of the site columns between the centre and the defender base, placement takes the pair whose two sites miss
  the generator's `siteWalk` window (20-25 s) by the fewest seconds of running (walking distance on the scan from the attackers' first spawn /
  the tactical preset's `groundSpeed`, 6 m/s) and writes them to `map.gen.siteSeconds`. Large maps land in the window (about 20 to 22.5 s),
  medium ones within a second of it (about 19.5 to 20.5 s); small ones are too short (about 10.5 s) and use the farthest column.
- GN3: the west half is generated and mirrored (x to -x, yaw to -yaw with `MapKit.mirrorPoint` / `MapKit.mirrorSpawn`), so items, spawns
  and objectives are fair by construction; a spawn is only taken when its mirror image also faces open space.
- GN4: solid towers with flat roofs over streets; bridges between roofs; each tower is reached by a ramp, a ladder or a jump pad toward an inner street.
- GN5: fields walled by staggered hedges (70% of each border) with open corner fields; six walled loot compounds (8 loot items each, 48 in all) and `map.ring`.

Grid rules that keep every map walkable: walls 0.6 m thick on cell borders, doors in the middle half of a border (at least 1.4 m wide), corner
rooms get two doors on each inner border (a single door each would leave two lanes, MAP-002), ramps rise 0.7 m per metre, free spawns stay 8 m
off the map edge.

## Data (03n)

- `mapModules`: cover patterns (`plaza`, `pillar`, `crates`, `platform`, `lowwalls`, `corner`, `columns`, `bunker`); props are `[kind, u, v, w, d, h]` in cell units. Kinds: `cover pillar climb platform low`; `pillar` and `climb` reach the wall height, `climb` (the bunker block) is a grip wall MV05 Ravagers climb.
- `mapTilesets` (MAP-022): one per theme with floor, ground, wall, pillar, cover, platform, trim and climb (default `grip`) materials, light colour, wall height, sky, and
  twelve callout modules `[name, pattern]` (the cell names become the map's callout zones).
- `mapSizes`: `{ id, name, index, tiers }`; a size is offered only on the quality tiers it lists (small: all; medium: low and up; large: medium and up).
- `mapDensities`: `{ id, name, moduleShare, scatter }`.
- `mapItemSets`: `{ id, list }`: `power` (the power-up keys put on the centre line), `pickups` / `supply` (one plain pickup per group entry, for
  modes with and without pickups), `loot` (per royale loot site). Pickups tied to a health preset (PU20 Vital Shard, `healthPreset`) are
  never drawn as plain pickups: maps with pickups or supply get one extra pair of each (12a shows it only in Ravager health matches).
- `generators`: the table above (`cells` per size index, `modes`, `defaultModes`, `fallback`, `blurb`, `siteWalk` for GN2).

## Pipeline per seed (MAP-023)

1. Kit geometry (`MapGenKits[kit](ctx)`) returns a plan: compact defs (brushes, zones, lights, triggers) plus anchor points for placement
   (`bases`, `centre`, `flags`, `points`, `sites`, `stages`, `path`, `core`, `exit`, `topSpots`, `itemSpots`, `hints`, `loot`, `ring`, `mirror`).
2. `MapKit.make` builds the row; `MapScan.of(map)` scans it; jump pads and ladders the scan rejects are removed and the row is rebuilt.
3. `MapGenPlace.run`: spawns (free: farthest-point sampling; teams: 8 per base, 26 m apart and out of sight; co-op up to 6 per side in the start and gate rooms), objectives per mode
   (`MAPGEN_OBJECTIVES`), items (power and top armor on the centre line, plain pickups mirrored, loot sites), nav hints (chokes at doors, sniper
   spots on platforms, cover). Spots are roomy nodes of the main walking loop.
4. `Maps.validate(map)` (skipped when `trusted`). When every problem is a sightline problem, pillars go on the long lines and the seed is
   rebuilt (up to 2 repair rounds).
5. Accepted: the map is registered (`Maps.addRuntime`, unless trusted). Otherwise seed + 1, five seeds in all, then the fallback: the generator's
   authored map when it offers the modes, else the first authored map for the mode. The fallback is reported, never silent.

## Generated map row

`id` = `'gn' + generator number + size letter + theme (2 letters) + density letter + seed + (mode or 'all')`, e.g. `gn3sfon48213ffa`;
`code` = `GN3-48213`; `name` = theme + generator + seed; `seed` = the seed that was accepted; `modes` = `[mode]` or the default modes.
Extra fields (ARCHITECTURE.md map format): `gen: { generator, size, theme, density, mode, requestedSeed, siteSeconds? }` and, for GN5,
`ring: { x, z, radius }` (the royale ring centre and start radius; 13g `mapRingStart` starts the ring there when all three numbers are valid).

## Report (`MapGen.last`)

`{ requestedSeed, seed, attempts, rounds, fallback, repairs, problems, sizeCut, ms: { build, scan, place, validate, repair, total } }`. `seed`
is the seed that was accepted (or the last one tried), `attempts` the seeds tried, `rounds` the builds (a sightline repair rebuilds the seed),
`problems` the last validator result, `sizeCut` true when the requested size was cut to the tier cap. `ms` sums each phase over all rounds.

## Runtime registry (16a)

`Maps.runtime` keeps the latest `MAPS_RUNTIME_KEEP` (8) generated maps, one per id. `Maps.get(id)` and `Maps.forMode(mode)` include them, so
`Game.start({ map: id })` and `Game.start({ map: mapObject })` both work. Hand-made maps are never replaced. Pickers and saved setups (the custom
match Map tab, its random map, its saved draft) use `Maps.savedForMode(mode)`, the hand-made and editor maps only: a generated map is gone after a
reload, so a saved setup must never name one.

## MP09 Ring Isle

`MapGen.ringIsle()` generates GN5 with `MAPGEN_TRUSTED_SEED` (2), large, overgrowth, royale, trusted (no validation at match start), and gives it
the catalogue id `isle`, code `MP09` and the name Ring Isle. A `match.setup` listener swaps the placeholder row for it, so any royale match on
`isle` plays the generated island. The self-test validates this exact map with zero problems; a change to the kits that breaks it fails the test
(pick a new trusted seed then).

## Size caps (13.4)

`MapGen.sizeCap()` reads the active quality preset: potato small; low medium; medium, high and ultra large. `generate` cuts larger requests to
the cap unless `uncapped` is set (`MapGen.last.sizeCut`). The share code names the capped size, so a code always rebuilds the map the device made.
The screen offers only the allowed sizes: it clamps its size to the largest allowed one when it opens, and a pasted code whose size the tier does
not offer is cut too, with a toast and a line in the status that the map differs from the shared one.

## Timings

Two budgets, per build round (MapGen.last.ms divided by `rounds`), at the largest size on this desktop (i5-9600K, headless Chrome):
- generation = kit geometry + scan + placement (`ms.build + ms.scan + ms.place`): under 100 ms (a low-end phone is about five times slower:
  under 500 ms);
- validation = `Maps.validate` (`ms.validate`): under 300 ms.

A sightline repair adds a round (another build, scan and validation) plus `ms.repair`. Measured on an idle machine, ms per round
(generation / validation / whole generate()):

| | small | medium | large |
|---|---|---|---|
| GN1 | 20 / 5 / 26 | 11 / 5 / 16 | 17 / 8 / 25 |
| GN2 | 16 / 21 / 37 | 23 / 36 / 138 (2 rounds) | 27 / 40 / 155 (2 rounds) |
| GN3 | 9 / 10 / 19 | 10 / 12 / 22 | 14 / 25 / 39 |
| GN4 | 10 / 15 / 25 | 14 / 23 / 38 | 21 / 38 / 141 (2 rounds) |
| GN5 | 27 / 70 / 97 | 48 / 133 / 182 | 59 / 176 / 235 |

The scan and the validator got faster for this (16s, 16v): horizontal rays walk the 4 m brush buckets front to back instead of testing every
brush, path searches use a typed-array heap, a column's surfaces are sorted in place, trigger boxes visit only their columns, the main-loop
search skips spawns already in the loop, and the lane search stops at its target. Results are unchanged (the `maps` group passes as before).

The self-test scales both budgets by how much slower the engine runs a fixed plain workload than desktop Chrome (Firefox gets an extra factor of 1.6 on top), so a 2x regression of the generator still fails everywhere; it checks both budgets on the largest size of every generator (strict, best of two runs) and on the 200-seed sweep (each seed over a
budget is run once more; at most 2% may stay over, for a busy machine).

## Screen (18h)

Screen `mapgen`, opened from the custom match Map tab ("Generate a map from a seed"): cycles for generator, mode, size, theme (Random or one of
six) and density; a seed field with New seed; the share code with Copy and a paste field with Use code; Bots (the mode's default number, else 0..max) and Difficulty cycles follow; changing them keeps the shown map. Generate shows the result (seed tried
and accepted, size, counts, repairs, time, or the fallback); Generate and Play first show "Generating...", hold both buttons and let the screen repaint, then run on a timer tick (a phone can take a second). Play starts `{ mode, map, seed, bots, difficulty, player }`: `bots` are named roster bots from `PlayFlow.rosterBots(count, difficulty, seed)` (as Quick Match), with the player on team 0 in team modes. `MapGenMenu` holds the state and has no DOM.

## Debug

- `__CTK.mapgen.generate(options)`, `__CTK.mapgen.last`, and every other `MapGen` call.
- `__CTK.mapgen.sweep(count)`: validates `count` seeds (1000, 1001, ...) over GN1..GN5 and every size; returns `{ total, accepted, fallback,
  repaired, retried, slowestGeneration, slowestGenerationMap, slowestValidation, slowestValidationMap, slowestTotal, slowestTotalMap, over,
  unreported }` (ms per round; `over` lists seeds over a budget after one re-run, `unreported` seeds with problems but no fallback). A run of
  200 seeds: 200 accepted, 0 fallbacks, 7 retried, 38 repaired, 0 unreported, about 25 s.
- `__CTK.mapgen.parts()`: `{ MapScan, MapCheck, MapGenPlace, MapGenKits }` for console debugging.

## Contract requests


- Ziplines (S08) do not exist yet, so GN4 links roofs with bridges, ladders and jump pads only.
- Main menu (UI-001): done, the "Generated map" entry opens `mapgen`.

