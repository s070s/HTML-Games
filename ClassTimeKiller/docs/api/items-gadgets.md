# Pickups, powerups, grenades and gadgets (S12 part 1) - public API

Files: `src/03i-data-items.js`, `src/03j-data-gadgets.js` (data), `src/12a-items.js`, `src/12b-powerups.js`, `src/12c-gadgets.js`, `src/12d-gadgets-placed.js` (code), `src/20b-test-items.js`, `src/20b-test-gadgets.js` (self-test groups `items` and `gadgets`).

## Sim systems

| Order | Name | What it does |
|---|---|---|
| 25 | `powerups` | `Powerups.step`: exact expiry, spent pools, surplus decay, regeneration bands, flight, ammo regeneration, seer reveal |
| 58 | `gadgets` | `Gadgets.step`: BTN.GRENADE hold / cook / throw, BTN.GADGET use, gadget recharge, thrown bodies, timed areas, smoke expiry, EMP suppression |
| 59 | `deployables` | `Devices.step`: arming, lifetimes and the behaviour of every placed and deployed device |
| 60 | `items` | `Items.step`: respawn timers, despawn of drops, soul homing, touch pickups, loot consumables in use |

Render sources: `pickups` (spinning shapes in group colours, faint bases on empty spots), `thrown` (grenades in flight plus the local player's throw arc while BTN.GRENADE is held, setting `gameplay.grenadePreview`), `smoke` (blob lattice, at most 480 per frame, plus `Fx.burst('smoke')` puffs), `deployables` (devices, area rings, red glint on enemy placed gadgets). All harm goes through `Damage.apply` / `Damage.explode`.

## Ruleset fields read (`Game.match.rules`, via `currentRules()`)

`mode`, `teams` (0 = free-for-all weapon pad times), `itemRespawnScale` (1), `weaponStay` (false), `dropOnDeath` (`none` | `held` | `all`, default `held`), `friendlyFire` (0), `economy` (gadget kit id, default `pickups`), `mutators` (`nopowerups` skips power spots; `souls` makes PvE kills drop souls), `params.souls` (same, set by a mode), `gravityScale` (grenade arcs through `bodyGravity()`).

## Input read

`BTN.GRENADE`: press with a grenade ready starts the hold; release throws (18 m/s along the view + 5 m/s up; with `BTN.ALT` held at release: underhand 9 + 2). Cookable rows burn their fuse while held; a full cook goes off in the hand. `BTN.GADGET`: uses the gadget-slot row (placed or deployed). Both are blocked while `ACTOR_FLAG.FROZEN`, `ACTOR_FLAG.DOWNED` or EMP-suppressed.

## Data catalogues

- `CAT.items` (I01..I17): `id code name group ('health'|'armor'|'ammo'|'weapon'|'tactical'|'loot') effect ('health'|'armor'|'ammoType'|'ammoAll'|'weapon'|'helmet'|'vest'|'consume') amount cap overheal respawn respawnTeams respawnPower useTime stack restores ('health'|'shield'|'overflow') shape size color index`. Map item keys are row ids (plus powerup ids and weapon ids).
- `CAT.powerups` (PU01..PU20): `duration maxDuration persistent respawn stacking ('add'|'refresh'|'rune') mods {} instant {} pool (''|'surplus'|'belt'|'jumps') charges drops unique mapItem announce campaign color shape size index`. `mods`: damage, melee, fodderMelee, taken, immune [kinds], invulnerable, speed, rate, invisible + perception, regen [rate, upTo, ...], flight, noFall, surplusDecay, lifesteal, reveal, jumpScale, maxHealthScale, maxArmorScale, noArmor, ammoRegen, freeAmmo. `instant`: surplus + surplusCap, belt + beltTotal, healTo, heal, soul, vital + vitalHealthCap + vitalArmorCap.
- `ITEM_TIMING`: `firstPowerSpawn 45`, `firstPowerSpread 15`, `droppedSeconds 30`, `droppedPowerupMinimum 5`, `powerWarning 10` (s).
- `CAT.gadgets` (G01..G24): `kind ('thrown'|'placed'|'deployed') effect carry cooldown fuse cook impact stick stickActors bounce radius duration damage element status statusSeconds ownerSafe health arm trigger coneDeg crouchSafe range rate max perTeam count speed launch heal drain amount pulses interval knockback pull size [3] shape color counter botUse index`. Thrown effects: `explode smoke flash fire decoy impulse freeze singularity dart emp`. Device effects: `mine dome barrier launchpad turret heal drain jammer drones trophy supply beacon`.
- `CAT.gadgetKits`: `id grenades {row: count} gadget total perType limits {row: n} refill` per economy (`pickups roundBuy loot classes heroKits ladder waveShop`).
- `GADGET_TUNING`: throw speeds, `enemyGlintRange 8`, `smokePunchSeconds 2`, `smokeExpandSeconds 1.5`, `flashMinimumAngle 0.1`, `flashMinimumDistance 0.25`, `fireRampFrom 0.25`, `turretSpreadDeg 2`, `dropSpeed 2`.

## Items (12a)

- `Items.load(entries, mode)`: map spots (`{x, y, z, item, modes}`; unknown keys are logged), called on `match.start` with `match.map.items`. Power items (powerups, power weapons) first appear 45 +/- 15 s in and are announced 10 s before every respawn.
- `Items.resolve(key)` -> `PICKUP_KIND.ITEM | POWERUP | WEAPON` or -1. `Items.respawnTicks(slot)`, `Items.stays(slot)` (weapon stay).
- `Items.drop(key, x, y, z, timeLeft, dropper)` -> slot: a pickup that vanishes after 30 s (`timeLeft` = powerup ticks left; the dropper cannot retake it until stepping off).
- `Items.grant(id, key)` (buys: helmet, vest), `Items.carriedCount(id, key)`, `Items.use(id, key)`, `Items.useProgress(id)` (0..1, -1 none), `Items.cancelUse(id)` for loot consumables.
- HUD: `Items.timers(out)` (respawning spots `{item, group, x, y, z, remaining}`), `Items.activePowerups(id, out)` (`{id, name, remaining, duration, color, persistent}`), `Items.soulCount(id)`. Bots: `Items.perceptionScale(id)` (PU04 cloak: 0.25).
- Registries: `Items.takers[kind]`, `Items.effects[effect]`, `Items.extraAmmo` (fn(id, row) -> bool; 12c refills kit grenades from ammo caches).

## Powerups (12b)

- `Powerups.give(id, row, timeLeft)` -> bool, `Powerups.has(id, key)`, `Powerups.ticksLeft(id, row)`, `Powerups.clearActor(id, drop)`, `Powerups.souls[id]`.
- Writes the shared hooks `Move.statusSpeedScale`, `Weapons.rateScale`, `Weapons.freeAmmo`, `Items.noArmor`, `ACTOR_FLAG.INVISIBLE` (only clears the flag when it set it), and chains `Render.actorStyle` (tint, glow, cloak shimmer). Damage hooks: `Damage.addAttackerScale` (damage, melee, fodder melee) and `Damage.addReducer` (invulnerable, immune kinds, taken scale, belt absorb).
- Death drops the droppable powerups with their time left (at least 5 s); death, `match.end` and `match.stop` remove everything.

## Grenades and smoke (12c)

- `Gadgets.give(id, key, amount)` -> added (kit limits for thrown rows), `Gadgets.select(id, key)`, `Gadgets.countOf(id, key)`, `Gadgets.equip(id)` (on `actor.spawn`), `Gadgets.refill(id)`.
- `Gadgets.hudState(id, out)` -> `{grenade, grenadeCount, gadget, gadgetCount, gadgetCooldown (0..1 left), cook (0..1)}`.
- `Gadgets.suppressed(id)` (G20 EMP: no grenades, gadgets, abilities or shield regeneration), `Gadgets.blindAmount(id)` (0..1 for the flash overlay), `Gadgets.jammed(id)` (G18: hide the radar), `Gadgets.visibleTo(index, id)`, `Gadgets.damageDevice(index, amount, source)`.
- Registries: `Gadgets.deployers` (fn(id, row) -> bool; 12d), `Gadgets.empHooks` (fn(owner, x, y, z, radius, seconds)).
- `Smoke.lineBlocked(ax, ay, az, bx, by, bz)` -> true when the segment passes through 1 m or more of smoke (bots, turrets and aim assist use it). `Smoke.covers(x, y, z)`. Smoke fills a 1 m occupancy grid from its centre, never through walls, grows over 1.5 s, and loses cells for 2 s to hitscan, beam and cone shots (`weapon.fire`) and blasts (`explosion`).
- Flash: blind seconds = duration x view share (facing 1, facing away 0.1) x distance share (1 at the centre, 0.25 at the edge), line of sight to the eye; enemies and the thrower, allies only with friendly fire.

## Devices (12d)

- `Devices.spawn(row, owner, x, y, z)`, `Devices.room(owner, row)` (GAD-003 caps: `max` per owner, `perTeam` per team), `Devices.damage(d, amount, source)`, `Devices.working(d)` (armed and not EMP-disabled), `Devices.clear()`.
- Shots damage devices along the ray (fire mode damage x pellets); blasts deal 100 x (1 - d/r). Allies cannot harm devices unless friendly fire is on. Destroyed devices emit `gadget.destroyed`.
- Enemy placed gadgets (mines) are only drawn and visible within 8 m in line of sight; deployed devices always show. Devices are removed when their owner dies and at match start, end and stop.

## Events

Emitted: `pickup` `{id, item, group, x, y, z}`, `item.respawn` `{item, group, x, y, z}`, `sound` (`pickup`, `grenade`, `explosion`, `shot` for decoys and turrets, `pulse`, `jump`, `break`), `announce` `{text, kind: 'power', priority}`, `powerup.start` / `powerup.end` `{id, powerup}`, `souls` `{id, count}`, `projectile.bounce` `{x, y, z, kind: 'grenade', source}`, `explosion` (radius 0 for pops that hurt nobody, so audio plays the element sting), `impulse`, `gadget.use` `{id, gadget, kind}`, `gadget.place` / `gadget.destroyed` `{index, gadget, owner, x, y, z}`. Payloads are reused: copy what you keep.

Listened: `match.start`, `match.end`, `match.stop`, `kill`, `actor.spawn`, `actor.create`, `damage` (lifesteal), `move.jump` (spring boots), `weapon.fire`, `explosion`.

## Debug

`__CTK.items` `{items, powerups, give(id, key)}` and `__CTK.gadgets` `{gadgets, thrown, smoke, areas, devices, device(key, owner, x, y, z), effect(key, owner, x, y, z)}`.
