# Maps (S16): hand-made maps as data, lookups, authoring kit, validator

Files: `src/16a-maps.js` (rule tables `MapRules`, lookups `Maps`, authoring kit `MapKit`), `src/16b-maps-arena.js` (MP01 spire, MP02 skyyard, MP06 gantry),
`16c-maps-tactical.js` (MP04 dustline, MP05 harbor), `16d-maps-large.js` (MP03 twinkeeps, MP08 convoyline), `16e-maps-pve.js` (MP07 cistern, MP10 provinggrounds,
MP12 manor, MP11 chambers, MP09 isle placeholder), `16f-maps-define.js` (`Data.define('maps', …)` and the `match.setup` listener),
`16s-maps-scan.js` (`MapScan`: walkable graph), `16v-maps-validate.js` (`MapCheck`: the validator), tests in `20b-test-maps.js` (group `maps`).
Every map is one `maps` catalogue row in the map format of `ARCHITECTURE.md`; `World.load(map)` takes a row as it is.

## The maps

| Code | Key | Name | Size m | Theme | Category | Modes | Brushes | Spawns free/team0/team1 | Items | Objectives | Zones | Triggers |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MP01 | `spire` | Foundry Spire | 50x50 | foundry | arena | duel, ffa | 41 | 16/0/0 | 24 | 0 | 14 | 0 |
| MP02 | `skyyard` | Skyward Yard | 70x70 | glacier | arena | ffa, tdm | 47 | 16/8/8 | 32 | 0 | 16 | 9 |
| MP03 | `twinkeeps` | Twin Keeps | 120x60 | overgrowth | large | ctf, oneflag, dom, tdm | 61 | 0/8/8 | 37 | 8 | 18 | 0 |
| MP04 | `dustline` | Dustline | 110x90 | ruins | large | bomb, elim, ghostops | 62 | 0/9/9 | 0 | 2 | 13 | 0 |
| MP05 | `harbor` | Harbor Nine | 90x90 | canal | large | tdm, hardpoint, attrition | 95 | 0/8/8 | 45 | 5 | 29 | 12 |
| MP06 | `gantry` | Gantry Run | 100x80 | station | large | ffa, tdm, duel, dom, hardpoint, oddball, gungame | 64 | 20/8/8 | 41 | 9 | 27 | 8 |
| MP07 | `cistern` | Cistern | 80x80 | canal | pve | horde, endless, fiends | 67 | 0/8/12 | 16 | 2 | 17 | 10 |
| MP08 | `convoyline` | Old Rail | 160x40 | ruins | large | payload, rush, conquest | 57 | 0/9/9 | 0 | 12 | 23 | 0 |
| MP09 | `isle` | Ring Isle (placeholder) | 300x300 | overgrowth | island | royale | 128 | 18/0/0 | 48 | 0 | 16 | 0 |
| MP10 | `provinggrounds` | Proving Grounds | 80x60 | station | range | range | 56 | 5/0/0 | 7 | 0 | 10 | 2 |
| MP11 | `chambers` | Test Chambers | 80x60 | glacier | puzzle | puzzle | 70 | 12/0/0 | 0 | 12 | 12 | 9 |
| MP12 | `manor` | Ash Manor | 90x90 | ruins | pve | contract | 75 | 0/6/10 | 4 | 2 | 12 | 1 |

MP09 is a hand-built stand-in marked `placeholder: true`; generator GN5 (step 13.1) replaces it. MP11 has twelve rooms that teach ramps, stairs, ladder, pads,
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
  triggers:   [{ kind: 'jumppad', min, max, launch: [vx, vy, vz] } | { kind: 'teleporter', min, max, exit: [x,y,z], exitYaw } | { kind: 'ladder', min, max }
               | { kind: 'water', min, max } | { kind: 'hazard', min, max, dps, element } | { kind: 'killzone', min, max }],
  lights:     [{ x, y, z, color: 0xRRGGBB, radius }],
  navHints:   [{ kind: 'cover'|'sniper'|'choke'|'flank'|'dummy'|'guard', x, y, z }] }
```

Fields beyond ARCHITECTURE.md (all optional, defaults in `16f`): `category` (`arena tactical pve range puzzle large island`, picks the sightline limit: 60 / 60 / 90 / 60 / 60 / 90 / 150 m),
`version` (map data version, migrate when it changes), `placeholder`, `blurb` (one line for the map picker), spawn/item/objective `modes` (empty = every mode of the map), objective `stage`
(Breach Assault stage 1..3) and `checkpoints` (payload: indices into `path`).

* `sky`: `{ top, horizon, fog, fogFar, sun: [x, y, z] }` (colours 0xRRGGBB, metres, direction towards the sun). `theme`: `foundry ruins station canal overgrowth glacier` (MAP-022).
* Materials: `concrete metal wood glass dirt water grass sand ice tile`. `water` brushes are canal/pool beds and puddles (solid; the swim volume is the `water` trigger).
* Trigger boxes are `min`/`max` corners. `launch` is the velocity at the pad (m/s); the maps are tuned for gravity 20 (`GRAVITY`), other presets land a little short or long.
  Teleporter `exitYaw` is in degrees. Hazard `element` is one of `kinetic thermal cryo arc toxin void` (HP-006).
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

* `Maps.get(idOrCode)` row or null; `Maps.forMode(modeId)` rows.
* `Maps.spawnList(map, modeId, team)`: cached array, do not modify. `Maps.spawnMatches(spawn, modeId, team)`.
* `Maps.itemsFor(map, modeId)`, `Maps.objectivesFor(map, modeId, kind?)`: new arrays, call at match start, not per step.
* `Maps.zoneAt(map, x, y, z)`: the smallest callout zone holding the point or null (HUD callouts, bot barks).
* `Maps.sightLimit(map)`, `Maps.hash(map)` (stable fingerprint, MAP-020), `Maps.validate(map)` -> problem strings (empty = sound), `Maps.report(map)` -> `{ id, problems, stats }`.
* Events: consumes `match.setup` and sets `Game.match.map` to the row of `setup.map` (id or code), or to `setup.map` itself when it is an object (generated or custom map); an unknown id leaves it null. Emits nothing.
* Settings keys: none.

## Authoring kit (`MapKit`, used by the map files)

Compact rows: brush `[material, x0,y0,z0, x1,y1,z1 (, rampDir)]`; spawn group `[team, modes, [[x,y,z,yawDegrees], …]]`; item `[key, x,y,z (, modes)]`; zone `[name, x0,z0, x1,z1 (, y0, y1)]`; light `[x,y,z,color,radius]`;
hint `[kind, x,y,z]`. `MapKit.make(def)` expands them; `MapKit.wall(material, axis, fixed, thickness, from, to, y0, y1, doors)` builds a wall with door gaps `[centre, width, height]`;
`MapKit.stairs(material, dir, x0,z0, x1,z1, yBase, rise, steps)`; `MapKit.sym(def, 'x'|'z'|'xz', keepTeams?)` adds mirror copies (x swaps teams 0/1 unless `keepTeams`; names swap West/East or North/South);
`MapKit.join(...defs)`.

## Validator (`Maps.validate`, hook `__CTK.map.check(id)` -> problems, `__CTK.map.report(id)` -> `{ problems, stats }`, `__CTK.map.list()`)

Problems read `rule: text`. Rules: `structure brush budget light` (shape, min < max, materials, bounds, ramp slope <= 40 deg, <= 450 brushes, <= 24 lights), `spawn spawn-count spawn-spread spawn-safety spawn-facing`,
`items` (known keys and groups, floor under every item, 2 m apart, power items 20 m apart, one top item per zone, exposed power items, distance balance between teams, no spawn nearest to more than 50% of the top
items = the MAP-005 target), `objectives` (per mode, on a floor, reachable), `hints`, `zones` (names, every point and 97% of the walkable area covered), `lights` (every zone that is mostly indoors holds a light),
`triggers` (fields, pads land on a walkable cell, teleporter exits, ladders have a foot and a top), `open-edge` (a drop over 12 m needs a kill zone), `lanes` (>= 3 separate routes between the team ends; not for `range`/`puzzle`)
and `sightline` (no free horizontal line longer than the category limit from a 4 m lattice of eye positions; placeholders are exempt).
It works on a 0.5 m grid of standing surfaces (`MapScan`: bodies need 1.4 m of width and 2.4 m of height, steps up to 0.45 m, walk-off drops up to 6 m, plus pad / teleporter / ladder links) and requires every
spawn, item, objective and hint to lie in one strongly connected region, so nothing is cut off or a one-way trap. It needs no movement code and does not touch `World`. Cost: 40 to 250 ms per map, about 1.2 s for the 300 m island.
Dependencies on S08: `makeBrush`, `rayHitsBox`, `rayVersusBrush`, `pointInBrush`, `makeHit` must stay top-level functions with their present signatures (the test group `maps` cross-checks the scan against `World.raycast`).

## Tests (group `maps`)

Every map validates; spec table codes and modes; spawn counts and objectives per mode; item spread target; zones; one mutation per validator rule (the validator must catch it); kit and mirror maths;
scan results; agreement with `World` ray hits; `match.map` resolution.
