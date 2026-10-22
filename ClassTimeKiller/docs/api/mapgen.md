# Map generator (S16, steps 13.1 to 13.4): seeded maps in the authored map format

Files: `src/03n-data-mapgen.js` (catalogues `mapModules`, `mapTilesets`, `mapSizes`, `mapDensities`, `generators`),
`src/16w-mapgen-kits.js` (`MapGenKits`: the geometry of GN1..GN5 on a shared cell grid), `src/16w-mapgen.js` (`MapGen`: options, driver,
validation, sightline repair, fallback, MP09; `MapGenPlace`: spawns, items, objectives and hints), `src/18h-ui-mapgen.js` (`MapGenMenu` and the
`mapgen` screen), tests in `src/20b-test-mapgen.js` (group `mapgen`). The runtime map list lives in `src/16a-maps.js` (`Maps.runtime`, `Maps.addRuntime`).

A generated map is an ordinary map row (docs/api/maps.md "Map row"): `World.load`, `Nav.build`, `Maps.validate`, the modes and the renderer
take it as they take a hand-made one.

## API

```
MapGen.generate({ generator, seed, size, theme, density, mode, quality, uncapped, trusted }) -> map row
MapGen.last          -> report of the latest generate() (below)
MapGen.resolve(options) -> { generator, seed, size, theme, density, mode, modes, trusted } (catalogue rows, the size capped)
MapGen.sizeCap(qualityId?) -> the largest mapSizes row the quality tier allows (default: the active preset)
MapGen.shareCode(options) -> 'CTKMAP-GN3-medium-foundry-normal-ffa-48213'
MapGen.parseShare(text) -> options, or null when the text is not a map code
MapGen.generator(idOrCode) -> generators row or null
MapGen.ringIsle()    -> MP09 Ring Isle (GN5, seed MAPGEN_TRUSTED_SEED, large, overgrowth, normal, royale), built once and cached
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
and modes, never from `Rng` or the clock. The same options give a map that is byte-identical under `JSON.stringify`.

## Generators

| Code | Kit | Category | Cell m | Cells small / medium / large | Modes (default first) | Fallback |
|---|---|---|---|---|---|---|
| GN1 Tile Chain | `chain` | pve | 12 | 5x5 / 6x6 / 7x7 | horde, endless, fiends, contract | cistern |
| GN2 Lanes and Sites | `lanes` | large | 14 | 6x3 / 8x3 / 10x3 | bomb, elim, tdm; ghostops, rush, payload, conquest, dom, hardpoint, attrition, control | dustline |
| GN3 Mirror Arena | `mirror` | arena | 12 | 4x4 / 4x5 / 6x5 | ffa, duel, tdm; ctf, oneflag, dom, oddball, hardpoint, lms, gungame, juggernaut, infection, cursetag, roulette, bearer, bank | spire |
| GN4 Vertical Towers | `towers` | large | 16 | 4x3 / 4x4 / 6x4 | ffa, tdm; dom, hardpoint, oddball, gungame, ctf | gantry |
| GN5 Island | `island` | island | 34 | 6x6 / 8x8 / 9x9 | royale | isle |

- GN1: a chain of rooms door to door (start room, connectors, the objective room, the exit, dead ends); co-op spawns in the start room and the gate rooms.
- GN2: three lanes between two bases joined every other cell; bomb sites near the defenders, rush stages, a payload street kept clear.
- GN3: the west half is generated and mirrored (x to -x, yaw to -yaw), so items, spawns and objectives are fair by construction.
- GN4: solid towers with flat roofs over streets; bridges between roofs; each tower is reached by a ramp, a ladder or a jump pad toward an inner street.
- GN5: fields walled by staggered hedges (70% of each border) with open corner fields; six walled loot compounds (8 loot items each, 48 in all) and `map.ring`.

Grid rules that keep every map walkable: walls 0.6 m thick on cell borders, doors in the middle half of a border (at least 1.4 m wide), corner
rooms get two doors on each inner border (a single door each would leave two lanes, MAP-002), ramps rise 0.7 m per metre, free spawns stay 8 m
off the map edge.

## Data (03n)

- `mapModules`: cover patterns (`plaza`, `pillar`, `crates`, `platform`, `lowwalls`, `corner`, `columns`, `bunker`); props are `[kind, u, v, w, d, h]` in cell units.
- `mapTilesets` (MAP-022): one per theme with floor, ground, wall, pillar, cover, platform and trim materials, light colour, wall height, sky, and
  twelve callout modules `[name, pattern]` (the cell names become the map's callout zones).
- `mapSizes`: `{ id, name, index, tiers }`; a size is offered only on the quality tiers it lists (small: all; medium: low and up; large: medium and up).
- `mapDensities`: `{ id, name, moduleShare, scatter }`.
- `generators`: the table above (`cells` per size index, `modes`, `defaultModes`, `fallback`, `blurb`).

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
Extra fields: `gen: { generator, size, theme, density, mode, requestedSeed }` and, for GN5, `ring: { x, z, radius }` (the royale ring centre and
start radius; see "Contract requests").

## Report (`MapGen.last`)

`{ requestedSeed, seed, attempts, fallback, repairs, problems, ms: { build, scan, place, validate, total } }`. `seed` is the seed that was
accepted (or the last one tried), `problems` the last validator result.

## Runtime registry (16a)

`Maps.runtime` keeps the latest `MAPS_RUNTIME_KEEP` (8) generated maps, one per id. `Maps.get(id)` and `Maps.forMode(mode)` include them, so
`Game.start({ map: id })` and `Game.start({ map: mapObject })` both work. Hand-made maps are never replaced.

## MP09 Ring Isle

`MapGen.ringIsle()` generates GN5 with `MAPGEN_TRUSTED_SEED` (2), large, overgrowth, royale, trusted (no validation at match start), and gives it
the catalogue id `isle`, code `MP09` and the name Ring Isle. A `match.setup` listener swaps the placeholder row for it, so any royale match on
`isle` plays the generated island. The self-test validates this exact map with zero problems; a change to the kits that breaks it fails the test
(pick a new trusted seed then).

## Size caps (13.4)

`MapGen.sizeCap()` reads the active quality preset: potato small; low medium; medium, high and ultra large. `generate` cuts larger requests to
the cap unless `uncapped` is set. The screen offers only the allowed sizes.

## Timings

"Generation" is the generator's own work: `ms.build + ms.place`. The scan (`ms.scan`) and the validator (`ms.validate`) are the S16 checker's
cost and are reported apart. Desktop numbers (i5-9600K, headless Chrome), largest size, one seed:

| | GN1 | GN2 | GN3 | GN4 | GN5 |
|---|---|---|---|---|---|
| build + place | ~35 ms | ~25 ms | ~25 ms | ~25 ms | ~20 ms |
| scan | ~50 ms | ~45 ms | ~25 ms | ~60 ms | ~100 ms |
| validate | ~30 ms | ~140 ms | ~40 ms | ~125 ms | ~650 ms |

Small maps take 25 to 90 ms in all, validation included. The self-test asserts generation under 100 ms per seed (500 ms on a low-end phone).

## Screen (18h)

Screen `mapgen`, opened from the custom match Map tab ("Generate a map from a seed"): cycles for generator, mode, size, theme (Random or one of
six) and density; a seed field with New seed; the share code with Copy and a paste field with Use code; Generate shows the result (seed tried
and accepted, size, counts, repairs, time, or the fallback); Play starts `{ mode, map, seed, bots: Modes.defaultBots(mode, true), player }`
with the player on team 0 in team modes. `MapGenMenu` holds the state and has no DOM.

## Debug

- `__CTK.mapgen.generate(options)`, `__CTK.mapgen.last`, and every other `MapGen` call.
- `__CTK.mapgen.sweep(count)`: validates `count` seeds (1000, 1001, ...) over GN1..GN5 and every size; returns `{ total, accepted, retried,
  repaired, fallback, slowestMs, slowest, slowestGenerationMs, slowestScanMs, failures }`. A run of 60 seeds: 60 accepted, 1 retried, 14 repaired,
  0 fallbacks, slowest generation 27 ms; the slowest total is a GN5 large map at about 2 s (validator runs of the repair rounds).
- `__CTK.mapgen.parts()`: `{ MapScan, MapCheck, MapGenPlace, MapGenKits }` for console debugging.

## Contract requests

- 13g royale ring: read `map.ring` (centre and start radius) when present instead of the world bounds.
- Ziplines (S08) do not exist yet, so GN4 links roofs with bridges, ladders and jump pads only.
- Main menu (UI-001): an entry for the generated map screen once UI-001 lists it.
