# World collision (S08) and movement (S10) - public API

Files: `src/08a-world.js` (brushes, tree, rays, hulls), `src/08b-world-collide.js` (sweeps, slide, queries),
`src/08c-world-triggers.js` (trigger volumes), `src/08d-world-bodies.js` (rigid bodies, destructible props),
`src/03b-data-movement.js` (presets MV01..MV08), `src/10a-move.js` (controller core), `src/10b-move-special.js` (special moves).
Tests: groups `world` (`src/20b-test-world.js`) and `move` (`src/20b-test-move.js`).

## Map data read by S08

```js
map = {
  brushes: [{ shape: 'box' | 'ramp' | 'wedge' | 'cylinder', min: [x, y, z], max: [x, y, z],
              dir: '+x' | '-x' | '+z' | '-z',   // ramp/wedge: the side the slope rises toward
              sides: 8,                          // cylinder: faces of the prism inside the box footprint
              material: 'concrete' }],           // surface for footsteps; 'grip' = climbable in climbGripOnly presets
  triggers: [ /* see Triggers */ ],
  props: [{ min, max, health: 50, material: 'wood', mass: 20, debris: 6, color: 0x8a6a45 }],
  size: 120 | [width, depth],                    // metres; the Skimmer board needs >= 150
}
```

A wedge is a ramp. Slopes up to 45 deg are floor (`WALKABLE_NORMAL_Y`); steeper ones slide.

## World (S08)

| Call | Result |
|---|---|
| `World.load(map)` / `World.clear()` | builds brushes, the bounding-volume tree, triggers and props; emits `world.load` |
| `World.raycast(ox, oy, oz, dx, dy, dz, maxDistance, hit)` | nearest brush or standing prop along a normalized ray; `hit = makeHit()` gets `distance x y z nx ny nz brush`; `hit.brush.prop >= 0` means a destructible prop (index) |
| `World.lineClear(ax, ay, az, bx, by, bz)` | true when nothing solid is between the points |
| `World.pointInside(x, y, z)` | point inside any brush or prop |
| `World.capsuleFits(x, y, z, radius, height)` | a capsule with its feet at (x,y,z) touches nothing (spawn checks, nav) |
| `World.sweepCapsule(ax, ay, az, bx, by, bz, radius, height, trace)` | true when blocked; `trace = makeTrace()` gets `fraction x y z nx ny nz brush startSolid allSolid`; walks the tree directly, so sweeps of any length see every brush (spawn checks, nav links) |
| `World.floorBelow(x, y, z, maxDrop, hit?)` | height of walkable floor within maxDrop, else `NaN` |
| `World.sphereTouches(x, y, z, radius)` | sphere overlaps geometry |
| `World.raycastActors(ox, oy, oz, dx, dy, dz, maxDistance, ignoreId, hit)` | nearest live actor hit volume along a normalized ray, or -1; `hit = makeActorHit()` gets `distance x y z nx ny nz actor zone` (`'head' 'body' 'legs'`). Walls are not checked: call `World.raycast` first and pass its distance as maxDistance. Uses `Hitbox.ray` (also S08); sizes are the S01 body constants |
| `World.actorsInSphere(x, y, z, radius, out)` | ids of live actors whose capsule touches the sphere written into `out`; returns the count (explosions, melee) |
| `World.actorsInCone(ox, oy, oz, dx, dy, dz, cosHalfAngle, range, ignoreId, out)` | ids of live actors whose chest (60 % of height) is inside the cone; returns the count (flames, sprays, aim assist) |
| `World.touchTriggers(id, gravity)` | called by S10 once per actor step; returns `TRIGGER_MEDIUM` bits `WATER` (swim depth) `WADING` (touching water) `LADDER HEAD_UNDER MOVED` |
| `World.triggers` | normalized trigger rows (`kind index minX..maxZ` + kind fields) for nav links |
| `World.airLeft(id)` | seconds of breath left (HUD) |
| `World.tree`, `World.brushes`, `World.dynamic` | read-only data (dynamic = standing props) |

Constants: `ACTOR_RADIUS` 0.40, `STEP_HEIGHT` 0.45, `ACTOR_STAND_HEIGHT` 1.80, `WALKABLE_NORMAL_Y` (cos 45 deg), `COLLISION_SKIN` 0.005 m.

Hit volumes (DATA-003): head sphere r 0.14 centred 0.04 m above the eye; body cylinder r 0.30 from 0.85 to 1.45 m;
legs cylinder r 0.22 from 0.05 to 0.85 m. Body and legs heights scale by `height / 1.8` (crouch, prone). They use flat
caps instead of rounded ends so the zones never overlap; ties go head, then body, then legs.

Low-level movers (`Collide`, used by S10 and bodies; other sections should prefer the World calls):
`makeMover()`, `Collide.gatherAround(mover, reach)`, `Collide.sweep(...)`, `Collide.slide(mover, dt)` (plane-by-plane clip,
up to 3 planes), `Collide.stepSlide(mover, dt, stepHeight)`, `Collide.probeGround(mover, distance, trace)`,
`Collide.depenetrate(mover)`, `Collide.overlaps(x, y, z, hull)`. Hulls: `setCapsuleHull`, `setSphereHull`, `setBoxHull`. Zero-allocation forms (PERF-006: float arguments to a call that is not inlined are boxed on the heap): `setSweepSegment(ax, ay, az, bx, by, bz)` (fills the shared sweep query) + `Collide.sweepSegment(hull, out)`; `clipBrush(brush, segment, hull, skin)` takes a segment object `{ sx sy sz ex ey ez }`; `rayBrushOf(ray, brush, hit)` takes `{ sx sy sz dx dy dz limit }` (`rayBrush(...)` is the argument wrapper). Hot code uses `length2` / `length3` (S01) instead of `Math.hypot`.
A gather keeps every brush it touches: the list starts at 256 (`CANDIDATE_START_SIZE`) and grows on a crowded map. `mover.planeBrushes[i]` is the brush of
`mover.planes[i]` (the walls touched in a slide).

## Triggers (`map.triggers`)

| kind | fields | effect |
|---|---|---|
| `jumppad` | `target: [x,y,z]`, `peak: 2` | sets the actor's velocity to a ballistic arc that tops out `peak` m above the higher of feet and target and lands on target (for the actor's own gravity) |
| `teleporter` | `exit: [x,y,z]`, `yaw: 0` (deg) | moves to the exit, sets `yaw`, `aimYaw`, `prev*` (no interpolation smear); horizontal speed kept and turned to the exit yaw; every other live capsule at the exit gets a lethal `telefrag` request credited to the arriver (MOV-020) |
| `ladder` | - | S10 climbs at 3.0 m/s (look down > 30 deg to descend, crouch slides down, jump pushes off) |
| `water` | - | swim (50% ground speed, 3D) once the water reaches the capsule middle; the top is the surface; head under: 12 s of air, then `drown` requests 2, 4, 6 ... 15 HP every second; breathing refills at once |
| `hazard` | `damage: 10` (HP/s), `element: 'thermal'` (an HP-006 element id) | `hazard` request of damage x 0.5 every 0.5 s, the first on contact |
| `killzone` | - | lethal `hazard` request; falling 30 m below the lowest brush does the same |

Every volume is `{ kind, min, max }` (axis-aligned). A row is logged and skipped when its kind is unknown, `min`/`max` are not
3 numbers each or min is above max, `target`/`exit` is not 3 numbers, or a jump pad's `peak` is not above 0. A pad's flight
time is at least 0.1 s. The fall-out check is off while the world has no brushes.

## Rigid bodies and props (`Bodies`, `Props`)

- `Bodies.spec` (reusable): `{ shape: BODY_SHAPE.SPHERE | BOX, kind: BODY_KIND.THROWN | DEBRIS, x, y, z, vx, vy, vz, halfX, halfY, halfZ, mass, color, owner }` (sphere radius = halfX).
- `Bodies.spawn(spec)` -> index or -1 (20 slots; debris is recycled oldest first; thrown bodies are never evicted).
- `Bodies.applyImpulse(index, ix, iy, iz)`: velocity change = impulse / mass (kg*m/s), wakes the body.
- `Bodies.raycast(ox, oy, oz, dx, dy, dz, maxDistance, hit)` -> index or -1 (hit.brush = null).
- `Bodies.remove(index)`, `Bodies.count()`, `Bodies.debrisCount()`, arrays `active sleeping x y z vx vy vz halfX halfY halfZ mass owner`.
- Bodies step at Sim order 55: gravity `GRAVITY x rules.gravityScale`, restitution 0.3, floor friction, max 40 m/s, sleep after 1 s at rest; debris sleeps 1 s after spawning and disappears 3 s later; bodies never collide with each other or block actors.
- A thrown body faster than 6 m/s that overlaps an actor sends one `damage.request` kind `crush`, amount `mass x speed x 0.05` clamped to 40, point = the body's centre.
- `Props.damage(index, amount)` (S11 calls it when `hit.brush.prop >= 0`); at 0 health the prop disappears, spawns 4-8 debris and emits `world.break` and a `sound` (kind `break`, radius 30).
- Explosions (`explosion` event) push bodies (120 kg*m/s at the centre, falling off) and damage props (100 at the centre, falling to 0 at the radius).
- Budget (MAP-013, PERF-010): every prop is solid at every quality (collision, cover, sight and nav never depend on video
  settings); only the first `Quality.current().props` props of a map (32/24/16/8/4, read at load) can break, the rest ignore
  damage. Live debris is capped by the same number, read when a prop breaks; the oldest debris is recycled first.
- Drawn through `Render.addSource('bodies', ...)` with `batch.mesh(shape, x, y, z, 0, 0, sizeX, sizeY, sizeZ, r, g, b, 0)` - sizes are full extents.

## Movement presets (`CAT.movement`, `src/03b-data-movement.js`)

Rows `arena tactical modern agile ravager knight vanguard parkour` (codes MV01..MV08) with every number from spec 6.3.
A field of 0 turns its mechanic off. Ruleset fields read: `rules.move` (preset id, fallback `arena`), `rules.gravityScale`
(gravity = preset gravity x scale), `rules.knockback` (scales `impulse`), `rules.mutators` (`autohop` = X25, `aircontrol` = X24),
and optional `rules.moveOverrides` (preset fields merged over the row, e.g. RS02 `{ extraJumps: 1, extraJumpVel: 8.1, wallDodge: true }`).

## Move (S10)

Sim system `move` at order 30 moves every live actor from `moveX moveZ aimYaw aimPitch buttons pressed` and writes
`x y z vx vy vz yaw pitch height eye` and the flags `ON_GROUND CROUCHED PRONE SPRINTING SLIDING WALL_RUN IN_WATER ON_LADDER`.
Yaw/pitch are copied from aimYaw/aimPitch every step (turn-rate limits belong to the bot layer).

| Call | Result |
|---|---|
| `Move.preset(id)` | the actor's preset row (per-actor override, else the match preset) |
| `Move.setPreset(id, presetId or null)` | per-actor preset (hero kits) |
| `Move.gravity(id)` | effective gravity m/s^2 (jump arcs, nav, bots) |
| `Move.inaccuracy(id)` | MOV-025 degrees of extra spread (tactical: still 0, walk/slow 1.1, crouch-move 0.8, run 5, air 10, landing +3 fading over 0.3 s); 0 in other presets |
| `Move.canFire(id)` | false while sprinting, during `sprintToFire` after a sprint, mantling, shield charging or on the board (S11 adds weapon readyTime) |
| `Move.damageScale(id)` | 0.25 while rolling (MV08), else 1 - S11 multiplies incoming damage |
| `Move.weaponSpeedScale[id]` | written by S11 every step: weapon `moveMult` x `adsMoveMult` when aiming (default 1) |
| `Move.statusSpeedScale[id]` | written only by S12 `Buffs.applyScales`: statuses x powerup speed (default 1) |
| `Move.gravityScale[id]` | per-actor gravity factor (default 1), written only by `Buffs.applyScales` (glide = a GRAVITY buff); used by `Move.gravity`, every step and slides |
| `Move.staminaScale[id]` | sprint drain divisor (default 1; S13 Marathon perk) |
| `Move.footstepScale[id]` | footstep loudness (default 1; S13 Quietstep perk 0): scales the step noise radius and `move.step` `loudness` |
| `Move.stamina[id]` / `Move.staminaFraction(id)` | seconds of sprint left / 0..1 (1 when unlimited) |
| `Move.dashCharges(id)` | whole dash charges ready |
| `Move.stateName(id)` | `walk mantle dash charge wall_run latch ladder swim` |
| `Move.isGrounded(id)`, `Move.horizontalSpeed(id)` | state queries |
| `Move.setBoard(id, on)` -> bool, `Move.onBoard(id)` | Skimmer (MOV-027): only on maps with size >= 150 m; 13 m/s; no weapons; any `damage` to the rider knocks it off for 2 s |

Controls (buttons from `BTN`): JUMP jump / double jump / wall jump-out / mantle / bullet jump (crouched or sliding, MV08);
CROUCH held crouch, slide when pressed at slide speed, roll when held on landing (MV08); PRONE toggles prone (MV03);
WALK walk; SPRINT sprint, double-tap = tactical sprint (MV03), or dash (MV05) / shield charge (MV06) in presets without sprint;
double-tap a direction = dodge (MV01); ALT in the air = wall latch next to a wall or glide (MV08).
Walls: walking (facing the wall) or jumping into a ledge up to `mantleHeight` mantles (0.35 s); in or at water every preset
reaches ledges up to max(`mantleHeight`, 1.6 m) above the feet, so swimmers climb out over a rim at or a little above the
surface; pushing into a wall climbs up to `climbHeight`
(MV05 only on `grip` material); wall-run starts automatically when airborne, moving forward >= 4 m/s next to a wall at < 60 deg.
Wall and ledge probes share a budget of 3 rays per actor per step (MOV-023): a mantle probe (2 rays) runs first.
The `autohop` mutator repeats ground jumps only: a held jump never spends double jumps, wall jumps, ladder push-offs or mantles.

Settings: `gameplay.airAssist` = `auto` (default: on for touch/gamepad in presets with `airAssist`, i.e. arena) | `on` | `off`.

### Events emitted (payloads are reused: copy what you keep)

| Event | Payload | When |
|---|---|---|
| `move.jump` | `{ id, speed, surface }` | any jump (ground, extra, wall, ladder, bullet) |
| `move.land` | `{ id, speed (impact m/s), surface }` | first grounded step |
| `move.step` | `{ id, speed, surface, loudness }` | every 1.6 m on the floor (not while sliding; never for silent walks); `loudness` = `Move.footstepScale[id]` (0 = silent, S06 plays nothing) |
| `move.slide` `move.dash` `move.mantle` `move.wallrun` | `{ id, speed, surface }` | slide start; dodge, dash or shield charge; mantle start (speed = height); wall-run start |
| `sound` | `{ x, y, z, radius, kind: 'step' or 'land', source }` | footsteps 15 m (crouch or walk halves, silentWalk walks are silent), landings 20 m |
| `damage.request` | `{ target, source: -1, amount, kind: 'fall', element: 'none', x, y, z }` | fall damage (MOV-015) |
| `world.trigger` | `{ id, kind, index, x, y, z }` | jump pad launch, teleport |
| `world.break` | `{ prop, material, x, y, z }` (`prop` = the index in `hit.brush.prop`) | a prop broke |
| `damage.request` kinds `telefrag drown hazard crush` | as above (`source` = the arriver for telefrag, the thrower for crush) | S08 triggers and bodies |

Consumed: `impulse { id, x, y, z }` (velocity change, x `rules.knockback`, capped 30 m/s; lifts the actor off the floor when upward),
`damage` (knocks riders off the board), `explosion` (bodies, props), `actor.create` / `actor.spawn` (reset per-actor state).

## Notes and spec choices

- Gravity per actor is the preset's `gravity` (24/20/15/16/22/20/13/16) x `rules.gravityScale`, which MOV-026 needs; the core `GRAVITY` (20) is used for bodies.
- Position integration averages the velocity over each step, so jump heights equal `jumpVel^2 / 2g` exactly (MOV-026).
- Ground friction uses `min(stopSpeed, wishSpeed)` while there is movement input, so the slowest stance (modern prone 1.2 m/s with stopSpeed 2 and friction 8) can still move; standing still and counter-strafing use the full MOV-011 rule.
- Unspecified tunables (named constants): double-tap window 0.25 s, mantle reach 0.3 m, climb speed 4.5 m/s, wall-run minimum height 1 m, slide friction default 1.5 (modern), Skimmer minimum map size 150 m, swim friction 3.
