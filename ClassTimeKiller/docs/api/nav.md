# Nav (S09) - navigation graph and pathfinding

Files: `src/09a-nav.js` (graph build, node queries, cover, debug lines), `src/09b-nav-path.js` (A*, cache, request queue, smoothing, reachability, map validation). Tests: `src/20b-test-nav.js` (group `nav`). Spec: BOT-010..BOT-012, BOT-091, BOT-092, MAP-001, MAP-023, ARC-034.

## Lifecycle

- `Bus.on('world.load', map => Nav.build(map))`: the graph is rebuilt every time S08 loads a map. Nothing else to call.
- `Nav.version` increases with every build; `Nav.buildMs` and `Nav.buildPhases` (`raster`, `nodes`, `links`, `components and cover`) hold the build time.
- A build empties the path cache and every request slot (status back to `NONE`): requesters re-request after a map load.
- Graph cache (BOT-010 "cached per map"): the last 4 graphs are kept, keyed by a hash of the map's brushes, triggers and `Nav.limits`. Loading the same map again restores its graph (about 0.4 ms instead of a full build); `Nav.lastBuildCached` says which happened; `Nav.clearCache()` empties it.
- Emits no events. Reads `World.brushes`, `World.boundsMin/Max` and the map's `triggers`.

## Build limits (`Nav.limits`)

Later sections may change them before the map loads (for example from the jumpiest movement preset of the match).

| Field | Default | Meaning |
|---|---|---|
| `jumpUp` | 2.45 | highest jump link built, m (MV04 apex 1.28 + extra jump 1.13). Bots filter with `allowJumpHeight`. |
| `jumpReach` | 3.2 | longest jump or drop link, horizontal m |
| `maxDrop` | 12 | deepest drop link built, m |
| `safeDrop` | 6 | default `maxDrop` of a path query (BOT-010) |
| `gravity` | `GRAVITY` (20) | jump pad arc tracing, m/s^2 |
| `referenceSpeed` | 6 | m/s; link cost = travel seconds at this speed |
| `ladderSpeed` | 3 | m/s climbing (MOV-019) |

## How the graph is made

1. Raster of 0.5 m columns over the world bounds. Every walkable brush top (slope <= 45 deg, DATA-003) is a sample when: no brush covers it, there is footing 0.25 m around the centre (edge margin), and the 0.40 m capsule fits from step height (0.45 m) up to 1.80 m (stand) or 1.10 m (crouch-only sample). Water deeper than 1.2 m adds a swim sample 1.2 m under the surface.
2. Nodes: per 1.5 m cell, one node per walk-connected surface (the sample nearest the cell centre); one node in the middle of every standable run of at most 4 columns along x or z (doorways, gaps between crates); one node at the centre of every jump pad and teleporter.
3. Links (directed; walk-like links are added both ways):
   - walk / crouch / swim: neighbours within 2.2 m whose raster walk is unbroken (height change per 0.5 m column <= a step or a 45 deg ramp) and whose chest-height line is clear. Crouch when any crossed sample is crouch-only; swim when any end or crossed sample is wet.
   - jump: within 3.2 m, not walkable; required height = (highest brush top on the way, including the target ledge) - start + 0.15 m, at most `jumpUp`; the rise, the crossing at apex height (chest and head lines) and the descent must be clear. A brush filling the body height and reaching above the jump limit blocks it.
   - drop: as jump when nothing must be cleared and the target is lower than a step; `height` = drop depth, at most `maxDrop`.
   - ladder, jump pad, teleport: from triggers (below).
   - nothing walks out of a node inside a jump pad or teleporter volume (it launches you); walks may step onto its centre node.
4. Strongly connected components (same component = reachable both ways), cover points, node lookup grid.

All brush tests use the same plane math as `World.raycast` (`rayVersusBrush`), through a 4 m brush grid.

## Map triggers read by nav

`map.triggers` entries (`min`, `max` = volume corners in metres):

| kind | extra fields | link |
|---|---|---|
| `ladder` | - | `LADDER` both ways between the floor node at the volume base and the node near the volume top (top node up to 1.6 m under `max[1]`) |
| `jumppad` | `launch: [vx, vy, vz]` m/s (velocity given by the pad), or `target: [x, y, z]` landing point | `JUMPPAD` from the pad centre node to the node where the traced arc lands on a walkable floor |
| `teleporter` | `exit: [x, y, z]` feet position after teleporting | `TELEPORT` from the volume's floor node to the node nearest the exit |
| `water` | - | samples inside are wet (`WATER` flag, swim links at 50 % speed) |

## Graph data (typed arrays, valid until the next build)

- Nodes `0..nodeCount-1`: `nodeX/Y/Z` (feet), `nodeFlags` (`NAV_NODE.CROUCH` 1 crouch-only, `WATER` 2, `PASSAGE` 4 doorway/gap node, `TRIGGER` 8 inside a jump pad/teleporter, `NARROW` 16 solid within 0.6 m), `component`.
- Links in CSR order: node `n` owns links `linkStart[n] .. linkStart[n + 1] - 1`; `linkFrom`, `linkTarget`, `linkType`, `linkCost` (seconds), `linkHeight` (jump: required height; drop: depth; ladder: climb; else 0).
- `NAV_LINK = { WALK 0, CROUCH 1, JUMP 2, DROP 3, LADDER 4, JUMPPAD 5, TELEPORT 6, SWIM 7 }`, `NAV_LINK_NONE = 255`. `NAV_LINK_ROWS[type]` = `{ key, speedFactor, extraSeconds, smooth, twoWay }`: cost = length / (referenceSpeed x speedFactor) + extraSeconds (+ fall time for drops, + climb / ladderSpeed for ladders, flight time for pads).
- Components: `componentCount`, `componentStart`, `componentNodes` (CSR), `mainComponent` (largest).
- Cover: `coverCount`, `coverNode`, `coverDirX/Z` (unit direction from the node toward the wall), `coverLow` (1 = crouch cover: blocked at 0.9 m, open at head height).

## Queries

| Call | Returns |
|---|---|
| `Nav.nearestNode(x, y, z)` | best node within 6 m by horizontal distance + 2 x height difference, preferring nodes up to 3 m below / 1 m above with a clear line; -1 on an empty graph |
| `Nav.nodePosition(node, out)` | writes the node's feet position into `out {x, y, z}` |
| `Nav.reachable(a, b)` | true when `b` can be reached from `a` over any links (same component: O(1); else a breadth-first search) |
| `Nav.randomReachableNode(from, rng)` | random node of `from`'s component (never a trigger node) for roaming; `rng` = a `makeRandom` stream such as `Rng.bots`; -1 for a bad node |
| `Nav.nearestCover(x, y, z, threatX, threatY, threatZ, maxDistance)` | cover index (`Nav.coverNode[index]` is its node) whose wall faces the threat and hides the body from it, nearest to (x, y, z); -1 when none |
| `Nav.debugLines(out)` | fills `out` (Float32Array) with link segments, 7 floats each `ax ay az bx by bz type` (two-way links once); returns the count. For the F9 view (BOT-092). |
| `Nav.validate(map)` | list of problem strings: spawns without a node, spawns not reachable both ways from spawn 0, items and objectives not reachable both ways from spawn 0 (MAP-001, MAP-023). Empty = valid. |

## Path search

Options (all optional; the same object may be reused):

| Field | Default | Effect |
|---|---|---|
| `allowJumpHeight` | `limits.jumpUp` | skip jump links needing more (the bot's own preset: apex + extra jumps) |
| `maxDrop` | `limits.safeDrop` | skip drop links deeper than this |
| `crouchOk` | true | false skips crouch links |
| `danger` | null | Float32Array (length `nodeCount`), extra seconds for entering each node |
| `avoid` | null | `fn(node)` -> extra seconds for entering the node; `Infinity` forbids it |

`allowJumpHeight` is floored to 1 cm and `maxDrop` to 10 cm (the cache key resolution).

- `Nav.findPath(from, to, options)`: synchronous A* (binary heap over typed arrays, admissible heuristic including teleporter shortcuts). Returns the node count (0 = no path). Result in `Nav.pathNodes[0..pathLength-1]`, `Nav.pathTypes[i]` = link type from node i to i + 1 (`NAV_LINK_NONE` on the last), `Nav.pathCost` seconds (Infinity when none). The arrays are overwritten by the next query. Unbudgeted: for validators and tools; bots use `request`.
- Cache: 64 direct-mapped entries keyed by (from, to, allowJumpHeight, maxDrop, crouchOk), paths up to 256 nodes, also remembers "no path". Queries with `danger` or `avoid` bypass it. `Nav.lastCacheHit`, `Nav.cacheHits`, `Nav.cacheMisses`, `Nav.searches` (A* runs).
- Zero allocation: every buffer is sized by the build; queries create no objects.

## Requests (BOT-091: at most 4 searches per tick)

- `Nav.request(id, from, to, options)`: `id` = slot 0..63 (a bot uses its actor id). Options are copied. A new request replaces the slot's pending one. Returns false for a bad id.
- The sim system `'nav'` (order 15, after bot brains) calls `Nav.serveRequests()`: at most `NAV_QUERIES_PER_TICK` (4) A* searches per tick; cache hits do not count. `Nav.searchesThisTick`, `Nav.pendingRequests()`.
- `Nav.result(id)`: `NAV_STATUS.NONE 0 | QUEUED 1 | DONE 2 | FAILED 3`. `Nav.cancel(id)` drops a pending request.
- Results (valid until the slot is requested again or the map reloads): `Nav.resultCost(id)`, `Nav.resultNodeCount(id)`, `Nav.resultNode(id, i)`, `Nav.resultPointCount(id)`, `Nav.resultPoint(id, i, out)` writes the smoothed point into `out {x, y, z}` and returns the type of the move that starts there (walk, crouch, swim, or the jump/drop/ladder/jumppad/teleport to perform; `NAV_LINK_NONE` at the goal). Paths longer than 1024 nodes fail.
- Smoothing (`Nav.smoothPath(nodes, types, length, outPoints, outTypes, offset)`): string pulling up to 12 nodes ahead; a corridor is straight when its raster walk is unbroken, it crosses no trigger volume and its chest line is clear. Jump, drop, ladder, pad and teleport links are never cut.

## Debug

`__CTK.nav` = `Nav`; `__CTK.perf.navBuild(map)` empties the graph cache, loads the map (default: the 100 x 100 m test map) and returns the build ms (ARC-034).

## Performance (headless Chrome, i5-9600K desktop)

100 x 100 m test map (25 rooms, 2 m doorways, 60 crates, 9 platforms with ramps; 4675 nodes, 38 466 links): build 55-65 ms warm, about 115 ms on the first (cold) build; A* 0.14 ms average, 0.3 ms corner to corner. A low-end phone runs JavaScript roughly 4-8 x slower: about 250-450 ms warm and more on a cold first build, so the 300 ms target (BOT-010) is met on mid-range phones and integrated-GPU laptops, not yet proven on the slowest phones. Loading a map again takes about 0.4 ms (graph cache).

## Known limits

- One flat node graph: no cluster level (BOT-011 hierarchical A*), no wall-run, rocket-jump or dash links. One graph per map (not per preset), filtered per bot by `allowJumpHeight` / `maxDrop`.
- Dynamic avoidance of other actors and fire areas is the caller's job through `danger` / `avoid`.
