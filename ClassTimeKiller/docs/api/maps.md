# Maps (S16): hand-made maps as data, lookups, authoring kit, validator

Files: `src/16a-maps.js` (rule tables `MapRules`, lookups `Maps`, authoring kit `MapKit`), `src/16b-maps-arena.js` (MP01 spire, MP02 skyyard, MP06 gantry),
`16c-maps-tactical.js` (MP04 dustline, MP05 harbor), `16d-maps-large.js` (MP03 twinkeeps, MP08 convoyline), `16e-maps-pve.js` (MP07 cistern, MP10 provinggrounds,
MP12 manor, MP11 chambers, MP09 isle placeholder), `16f-maps-define.js` (`Data.define('maps', …)` and the `match.setup` listener),
`16s-maps-scan.js` (`MapScan`: walkable graph), `16v-maps-validate.js` (`MapCheck`: the validator), tests in `20b-test-maps.js` (group `maps`).
Every map is one `maps` catalogue row in the map format of `ARCHITECTURE.md`; `World.load(map)` takes a row as it is.

## The maps

| Code | Key | Name | Size m | Theme | Category | Modes | Brushes | Spawns free/team0/team1 | Items | Objectives | Zones | Triggers |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MP01 | `spire` | Foundry Spire | 50x50 | foundry | arena | duel, ffa, lms, infection, juggernaut, cursetag, bearer, roulette | 41 | 16/0/0 | 24 | 0 | 14 | 0 |
| MP02 | `skyyard` | Skyward Yard | 70x70 | glacier | arena | ffa, tdm, lms, infection, juggernaut, cursetag, bearer, roulette | 47 | 16/8/8 | 32 | 0 | 16 | 9 |
| MP03 | `twinkeeps` | Twin Keeps | 120x60 | overgrowth | large | ctf, oneflag, dom, tdm | 61 | 0/8/8 | 37 | 8 | 18 | 0 |
| MP04 | `dustline` | Dustline | 110x90 | ruins | large | bomb, elim, ghostops | 62 | 0/9/9 | 0 | 2 | 13 | 0 |
| MP05 | `harbor` | Harbor Nine | 90x90 | canal | large | tdm, hardpoint, attrition, control | 95 | 0/8/8 | 45 | 6 | 29 | 12 |
| MP06 | `gantry` | Gantry Run | 100x80 | station | large | ffa, tdm, duel, dom, hardpoint, oddball, gungame, lms, infection, juggernaut, cursetag, bearer, roulette | 64 | 20/8/8 | 41 | 9 | 27 | 8 |
| MP07 | `cistern` | Cistern | 80x80 | canal | pve | horde, endless, fiends | 67 | 0/8/12 | 16 | 2 | 17 | 10 |
| MP08 | `convoyline` | Old Rail | 160x40 | ruins | large | payload, rush, conquest | 57 | 0/9/9 | 0 | 12 | 23 | 0 |
| MP09 | `isle` | Ring Isle (placeholder) | 300x300 | overgrowth | island | royale | 128 | 18/0/0 | 48 | 0 | 16 | 0 |
| MP10 | `provinggrounds` | Proving Grounds | 80x60 | station | range | range | 56 | 5/0/0 | 7 | 0 | 10 | 2 |
| MP11 | `chambers` | Test Chambers | 80x60 | glacier | puzzle | puzzle | 70 | 12/0/0 | 0 | 12 | 12 | 9 |
| MP12 | `manor` | Ash Manor | 90x90 | ruins | pve | contract | 75 | 0/6/10 | 4 | 2 | 12 | 1 |

MP09 is a hand-built stand-in marked `placeholder: true`; every match on it plays the GN5 island instead (docs/api/mapgen.md "MP09 Ring Isle"). MP11 has twelve rooms that teach ramps, stairs, ladder, pads,
teleporters, acid and a kill zone; the puzzle objects of MAP-030 (buttons, cubes, gates, lasers) arrive with step 14.4.

## Map row (catalogue `maps`)

Coordinates: metres, Y up, floor at y = 0, the map centred on the origin (`x` in `±size[0]/2`, `z` in `±size[2]/2`), yaw in degrees (0 looks +Z).

```
{ id, code, name, size: [x, y, z], theme, category, modes: [...], sky, blurb, version: 1, placeholder: false, seed: 0,
  brushes:    [{ shape: 'box'|'ramp', min: [x,y,z], max: [x,y,z], dir: '+x'|'-x'|'+z'|'-z' (ramps: the high side), material }],
  spawns:     [{ x, y, z, yaw, team: -1|0|1, modes: [] }],
  items:      [{ x, y, z, item: <key>, group: 'power'|'armor'|'health'|'weapon'|'ammo', modes: [] }],
  objectives: [{ id, kind, team: -1, x, y, z, radius: 3, path: [], modes: [], stage?, checkpoints? }],
  zones:      [{ name, min: [x,y,z], max: [x,y,z] }],
  triggers:   [{ kind: 'jumppad', min, max, target: [x,y,z], peak } | { kind: 'teleporter', min, max, exit: [x,y,z], yaw } | { kind: 'ladder', min, max }
               | { kind: 'water', min, max } | { kind: 'hazard', min, max, damage, element } | { kind: 'killzone', min, max }],   // fields as in docs/api/world-move.md
  lights:     [{ x, y, z, color: 0xRRGGBB, radius }],
  navHints:   [{ kind: 'cover'|'sniper'|'choke'|'flank'|'dummy'|'guard'|'secret', x, y, z }],
  props:      [{ min: [x,y,z], max: [x,y,z], health: 50, material: 'wood', mass: 20, debris: 6, color }] }   // breakable boxes (S08 Props)
```

Fields beyond ARCHITECTURE.md (all optional, defaults in `16f`): `category` (`arena tactical pve range puzzle large island`, picks the sightline limit: 60 / 60 / 90 / 60 / 60 / 90 / 150 m),
`version` (map data version, migrate when it changes), `placeholder`, `blurb` (one line for the map picker), spawn/item/objective `modes` (empty = every mode of the map), objective `stage`
(Breach Assault stage 1..3) and `checkpoints` (payload: indices into `path`). Generated maps add `gen` (how they were made) and royale maps may carry
`ring: { x, z, radius }` (ring centre and start radius; docs/api/mapgen.md; 13g starts the royale ring there). `secret` hints are PvE level secrets (14j `PveLevel`,
found within 1.5 m) and `props` the breakable crates the PvE level report counts; `MapKit.make` gives every map a `props` list (empty by default) and the map editor
keeps it through its codes (rows checked like brushes; codes made before props load with none).

* `sky`: `{ top, horizon, fog, fogFar, sun: [x, y, z] }` (colours 0xRRGGBB, metres, direction towards the sun). `theme`: `foundry ruins station canal overgrowth glacier` (MAP-022).
* Materials: `concrete metal wood glass dirt water grass sand ice tile`. `water` brushes are canal/pool beds and puddles (solid; the swim volume is the `water` trigger).
* Trigger boxes are `min`/`max` corners and the fields are the ones S08 reads (docs/api/world-move.md): a pad throws whoever steps on it along an arc that peaks `peak` m above the higher of the
  feet and the `target` and ends on `target` (feet position), under the actor's own gravity. The arc is the same path under every gravity (only the flight time changes), so a pad lands on its target
  in every movement preset (gravity 13 to 24) from any spot of its box. Teleporter `yaw` is the exit facing in degrees; hazard `damage` is HP per second and `element` one of
  `kinetic thermal cryo arc toxin void` (HP-006). The maps never use the older `launch` / `exitYaw` / `dps` names.
* Item keys: powerups and weapons use the spec backtick keys (`fury`, `lancet`, …; `daybreak`/`halcyon` are group `power`). Plain pickups have no spec key, so these keys are the contract
  for the S12 `items` catalogue: health `healthvial healthpack healthcrate megacell`, armor `armorshard lightplate heavyplate`, ammo `ammobox ammocache`. The item position is the floor point;
  the pickup floats above it.

## Spawn contract (MAP-010 / MAP-011, used by S13)

A spawn serves an actor of `team` in `mode` when `spawn.team === team` and `spawn.modes` is empty or contains `mode` (`Maps.spawnMatches`). Free-for-all modes use team -1; team modes use 0 and 1;
the maps list spawns for team modes only under team 0/1 and `modes` lists, so a team mode never picks an FFA spawn. Team 0 is the first side: attackers in `bomb`, `ghostops`, `rush`, `payload`
(they also own the `payloadPath` objective); in co-op modes (`horde endless fiends contract`) team 0 is the player side and team 1 the enemy gates / guard posts (S15 reads them). Minimums,
checked by the validator: free for all 16 (spread over several callout zones, 5 m apart), team modes 8 per team (at least 25 m from every enemy spawn and never in its line of sight), co-op 4 + 4.
Spawn protection, distance to enemies and last-death rules are dynamic and belong to S13.

## Objectives per mode

`ctf` 2 `flag` (team 0/1) + 2 `flagBase`; `oneflag` neutral `flag` (team -1) + 2 `flagBase`; `dom` 3 `point`; `conquest` 5 `point`; `rush` 6 `bombsite` with `stage` 1..3 (two per stage, team 1 defends);
`hardpoint` 4+ `hill`, listed in rotation order; `payload` one `payloadPath` (`path` points west to east, `checkpoints` = path indices); `bomb` and `ghostops` 2 `bombsite` (A = `siteWest`, B = `siteEast`);
`oddball` 1 `relic`; `horde` 1 `core`; `endless` `core` + `extract`; `contract` `relic` (the target) + `extract`; `puzzle` one `extract` pad per chamber (`exit1`..`exit12`).
`bank` is supported by the validator but no listed map offers it (mode M23 is not in the MP table).

## Lookups (`Maps`)

* `Maps.get(idOrCode)` row or null (null before the catalogue exists); `Maps.forMode(modeId)` rows (hand-made, then runtime maps); `Maps.savedForMode(modeId)` hand-made and editor maps, no generated ones (pickers and saved setups use it: a generated map is gone after a reload).
  **Runtime maps** (`Maps.runtime`): `Maps.registerRuntime(map)` / `Maps.unregisterRuntime(id)` (the map editor's saved maps, `docs/api/mapeditor.md`) and `Maps.addRuntime(map)` (generated maps; past `MAPS_RUNTIME_KEEP` the oldest generated map drops out, editor maps stay). A runtime map is a full map row and replaces the runtime map with the same id; it never replaces a catalogue row.
* Rows are plain data. The lookup caches and the latest scan are keyed by the row object, so clone a row (`JSON.parse(JSON.stringify(row))`) before editing it; never edit a catalogue row in place.
* Shared rules, global helpers: `mapServesMode(entry, modeId)` (a spawn, item or objective serves a mode when its `modes` list is missing, empty or holds the mode), `mapModesOf(entry)`, `mapInBox(box, x, y, z, marginXZ, marginY)`
  (point in a `{ min, max }` box: zones, triggers, lights).
* `Maps.spawnList(map, modeId, team)`: cached array, do not modify. `Maps.spawnMatches(spawn, modeId, team)`.
* `Maps.itemsFor(map, modeId)`, `Maps.objectivesFor(map, modeId, kind?)`: new arrays, call at match start, not per step.
* `Maps.zoneAt(map, x, y, z)`: the smallest callout zone holding the point or null (HUD callouts, bot barks); allocation free, safe to call every frame.
* `Maps.sightLimit(map)`, `Maps.hash(map)` (stable fingerprint, MAP-020), `Maps.validate(map)` -> problem strings (empty = sound), `Maps.report(map)` -> `{ id, problems, stats }`.
* Events: consumes `match.setup` and sets `Game.match.map` to the row of `setup.map` (id or code), or to `setup.map` itself when it is an object (generated or custom map); an unknown id leaves it null. Emits nothing.
* Settings keys: none.

## Authoring kit (`MapKit`, used by the map files)

Compact rows: brush `[material, x0,y0,z0, x1,y1,z1 (, rampDir)]`; spawn group `[team, modes, [[x,y,z,yawDegrees], …]]`; item `[key, x,y,z (, modes)]`; zone `[name, x0,z0, x1,z1 (, y0, y1)]`; light `[x,y,z,color,radius]`;
hint `[kind, x,y,z]`. `MapKit.make(def)` expands them; `MapKit.wall(material, axis, fixed, thickness, from, to, y0, y1, doors)` builds a wall with door gaps `[centre, width, height]`;
`MapKit.stairs(material, dir, x0,z0, x1,z1, yBase, rise, steps)` (throws when a riser would be above 0.45 m); `MapKit.sym(def, 'x'|'z'|'xz', keepTeams?)` adds mirror copies (x swaps teams 0/1 unless `keepTeams`; names swap West/East or North/South);
`MapKit.join(...defs)`.

## Validator (`Maps.validate`, hook `__CTK.map.check(id)` -> problems, `__CTK.map.report(id)` -> `{ problems, stats }`, `__CTK.map.list()`)

Form rules (one checker for every map row: hand-made, generated, and the editor's saved maps and codes): `MapCheck.headerProblems(map)` (id, name, size, theme, category, sky, known modes;
keys are own keys of `MapRules`, never inherited names such as `__proto__`) and one rule per row, `brushProblem triggerProblem lightProblem itemKeyProblem objectiveKeyProblem hintKeyProblem
propProblem` (each `''` or the text). `MapCheck.formProblem(map)` = the first of them; the validator reports each one under its rule and adds the design limits. Brush material `grip` is the
MV05 Ravager climb wall (`climbGripOnly`): MP01, MP02, MP06, MP07 and MP12 carry grip panels. Item key `vitalshard` (PU20, group `health`) has spots on the same maps; they appear only in
matches with the Ravager health preset (`healthPreset`, 12a).

Problems read `rule: text`. Rules: `structure brush budget light props` (shape, min < max, materials, bounds, ramp slope <= 40 deg, <= 450 brushes, <= 24 lights, prop boxes), `spawn spawn-count spawn-spread spawn-safety spawn-facing`,
`items` (known keys and groups, floor under every item, 2 m apart, power items 20 m apart, one top item per zone, exposed power items, distance balance between teams, no spawn nearest to more than 50% of the top
items = the MAP-005 target), `objectives` (per mode, on a floor, reachable), `hints`, `zones` (names, every point and 97% of the walkable area covered), `lights` (every zone that is mostly indoors holds a light),
`triggers` (fields; a pad has floor to stand on, its target is a walkable cell at least 0.4 m inside its floor and in the main play space, and the arc from every start cell of the box is free of geometry
under gravity 13, 20 and 24; teleporter exits; ladders have a foot and a top), `open-edge` (a drop over 12 m needs a kill zone), `lanes` (>= 3 separate routes between the team ends; not for `range`/`puzzle`)
and `sightline` (no free horizontal line longer than the category limit from a 4 m lattice of eye positions; placeholders are exempt).
A map that is missing a list (`brushes spawns items objectives zones triggers lights navHints`) or has a bad header or trigger is reported by `structure`/`brush`/`triggers` and not analysed further; entries without a `modes` list serve every mode.
It works on a grid of standing surfaces (`MapScan`; 0.5 m cells, 1 m on maps 200 m or longer): a cell fits when the walls leave room for the capsule (0.42 m on each side) and 1.4 m in total on each axis, so a 1.4 m doorway passes at any offset on the
grid and a 1.2 m one never does; 2.4 m of height above the feet; steps up to 0.45 m, walk-off drops up to 6 m, plus pad / teleporter / ladder links. Every spawn, item, objective and hint must lie in one strongly connected region, so nothing is cut
off or a one-way trap. It needs no movement code and does not touch `World`. Cost (scan plus checks): about 20 to 80 ms per map and 0.2 s for the 300 m island on a desktop i5. Horizontal rays
(`MapScan.rayLength`) walk the 4 m brush buckets (the shared `BrushGrid` of S01) front to back and stop at the first bucket past the nearest hit; path searches use a typed-array heap. Memory: edges are packed typed arrays (an Int32 target and a Uint8 kind per edge); only the latest
scan is kept (`MapScan.of(map)`) and `Maps.validate` releases it when it ends (`MapScan.release()`).
Dependencies on S08: `makeBrush`, `rayHitsBox`, `rayVersusBrush`, `pointInBrush`, `makeHit` must stay top-level functions with their present signatures (the test group `maps` cross-checks the scan against `World.raycast`).

## Tests (group `maps`)

Every map validates; spec table codes and modes; spawn counts and objectives per mode; item spread target; zones; a table of mutations (`MAP_MUTATIONS`: 54 broken clones, each has to produce the problem of its own rule, e.g.
`triggers: ... hits geometry`) covering every rule name of the validator (several checks of the big rules such as `items`, `triggers` and `zones` each have their own row); doorways of 1.2 / 1.3 / 1.4 / 1.6 m at 16 grid offsets and heights of 2.3 / 2.4 m; every pad flown under the six distinct preset gravities (13 to 24) from every start
cell; maps with missing lists or `modes`; kit and mirror maths; scan results; agreement with `World` ray hits; `match.map` resolution.

## Needs from other sections

* S08 `World.addPart` triggers: read `target/peak`, `yaw`, `damage/element` exactly as in world-move.md (they do). Every map hazard names its own `element` (S08's default `fire` is not an HP-006 element).
