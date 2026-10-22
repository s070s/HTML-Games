# Weapons, projectiles and damage (S11) - public API

Files: `src/03c-data-weapons.js`, `src/03d-data-health.js` (data), `src/11a-weapons.js`, `src/11b-projectiles.js`, `src/11c-damage.js`, `src/11d-weapons-special.js` (code), `src/20b-test-damage.js`, `src/20b-test-weapons.js` (self-test groups `damage` and `weapons`).

## Sim systems

| Order | Name | What it does |
|---|---|---|
| 20 | `status` | `Damage.step`: status effects (DoT ticks, stuns), regeneration, overheal decay, downed bleed-out |
| 40 | `weapons` | `Weapons.step`: per-actor weapon state machine, firing, hitscan, melee, cones |
| 45 | `weaponSpecials` | held objects of the Graviton Lifter, twin-gate teleports |
| 50 | `projectiles` | `Projectiles.step`: pooled projectiles swept against the world and actor hit volumes |

Every system runs without a match (`DEFAULT_RULES` = spec defaults) and without renderer, audio or DOM.

## Ruleset fields read (`Game.match.rules`)

`health` (HPP key, default `stack`), `precision` (`arena`/`standard`/`tactical`/`hero`), `weaponSet` (default `arenaSet`), `friendlyFire` (0), `selfDamage` (0.5), `knockback` (1). Optional: `carry` (number, overrides the weapon set's carry limit), `ammoTiers` (boolean, overrides the set's).

## Input read

`Actors.buttons` / `Actors.pressed`: `FIRE` (primary), `ALT` (alternate fire, aim, block, toggle, detonate), `RELOAD`, `MELEE` (quick melee: the carried melee weapon's primary, else a 30 damage bash), `NEXT_WEAPON`, `PREV_WEAPON`; `Actors.slotRequest` (1-9, acted on when it changes; repeated presses cycle weapons sharing a slot). Shots fly along `Actors.yaw` / `Actors.pitch` (the view the movement section sets from `aimYaw`/`aimPitch`) plus the recoil punch.

Firing is blocked while `ACTOR_FLAG.FROZEN` or `ACTOR_FLAG.DOWNED` is set.

## Data catalogues

- `CAT.weaponClasses`: `id slot tier ('primary'|'special'|'heavy'|'none') precision pistol firstShotExact ttk [min,max] equipTime reload ammoType color`. Class values are the defaults for weapon rows.
- `CAT.weapons` (W01..W46): spec Weapon schema plus `code`, `reload` (s, per shell when `reloadShell`), `altAmmo` (separate alt rounds), `dualWield` (W04: a second pickup makes a pair), derived `index` (typed-array index), `family` (class row), `primary` / `alt` (normalized fire mode rows). `botPref {range [min,max] m, value 0..1}` and `noise` (m) are for bots.
- `CAT.fireModes` (`<weapon>.primary`, `<weapon>.alt`, `quick.melee`): spec FireMode schema. `type`: `hitscan` (pellets allowed), `projectile`, `beam` (continuous hitscan: `damage` per tick, `rate` ticks/s), `melee` (`reach`, `backstab`, `launch`), `cone` (`cone {range, angle}`; 360 = shockwave), `lock` (`lock {time, targets, coneDeg, range}`), `zoom` (ADS, `zoom` factor), `toggle` (`toggle {damageMult, rateMult, recoilMult, speedMult, frontResist, status, needsLedge}`), `block` (`block {pool, regen, parryWindow, arcDeg}`), `detonate` (detonates the owner's `projectile` of this weapon), `tool` (`tool` key in `Weapons.tools`). `trigger`: `auto`, `semi`, `burst` (`burst` rounds, `burstGap` s, `rate` = bursts/s), `charge` (fires on release; `charge {time, min, max | levels, target 'damage'|'pellets'|'multiplier', speed [min,max], ammo [..]}`), `release` (lock-on fires on release). `ammo`: `mag` / `alt` / `none`. Other fields: `falloff [startM, endM, minFactor]`, `splash {r, dmg, minFactor}`, `penetration` (`low`/`med`/`high`: thin wood/metal/glass passes at 0.5/0.7/0.85), `pierce`, `status {id, seconds, stacks}` with `statusRange` (min distance), `element`, `spinUp`, `heat` / `heatDamage`, `chain {targets, radius}`, `combo`, `stickCombo`, `split`, `puddle`, `aura`, `laser`, `cooldown`, `maxActive` + `activeRule` (`block`/`recycle`), `detonateOnRelease` (hold the alt 0.35 s, release: detonate), `guided`, `alwaysHead`, `knockback`, `fodderKill`, `allyLink`, `repair` (HP/s a shot gives a friendly device instead of damage: W30 beam 60; S14 also repairs the PvE core with it), `special` (`airblast`: W35 napalm also throws enemy projectiles within 5 m and 45 deg back along the aim), `noise` (-1 = weapon's). `zoom` above 1 on a non-zoom alt also aims down sights while ALT is held (W19 slug 1.2x). `zoomMax` = a second scope step: while fully scoped, next/previous weapon flips between `zoom` and `zoomMax` instead of switching (`Weapons.zoomed[id]`, reset when the sights drop; W24 4x/8x).
- `CAT.projectiles` (P01..P16 from the spec, P17 drill, P18 blade, P19 dark orb, P20 Daybreak orb - its own row so it is neither a combo target nor parryable): `speed gravity life radius bounce (speed kept) bounces (-1 until fuse, 0 = act on contact) fuse stick stickActor homing (deg/s) drag arm onHit ('explode'|'damage'|'pin' (W26: a wall within 1.5 m behind the victim pins it: status `pinned`)|'puddle'|'pull'|'drill') poolSize roll ownerSafe comboTarget parryable pierce returning silent color scale`.
- `CAT.recoil`: pattern parameters; `pattern` is the generated 30-entry `[pitch, yaw]` kick table in degrees (WPN-004).
- `CAT.weaponSets`: `id weapons start carry (0 = full arsenal; melee and tools never count) ammoTiers rarity power`. Spec sets plus `fullSet` (all 46).
- `CAT.health` (HPP01..HPP09), `CAT.precision` (HP-002 zone multipliers; MOV-025 movement spread is the movement preset's, read through `Move.inaccuracy`), `CAT.statusEffects` (`burn chill freeze shock bleed toxin blind sleep slow reveal pinned stun`; `shock` is electric and combos, `stun` is the non-electric stagger/knockdown/EMP stun), `CAT.elements` (`kinetic thermal cryo arc toxin void`), `CAT.damageKinds` (`hit melee splash beam dot self fall hazard drown telefrag crush`: what each bypasses).
- `WEAPON_RARITY_DAMAGE`, `WEAPON_RARITY_MAG` (WPN-008, rarity index 0..4).
- `CAT.attachments` (step 5.4): `id name slot ('barrel'|'magazine'|'underbarrel'|'stock', see ATTACHMENT_SLOTS) damage spread recoil reload mag reserve equip move` - multipliers, 1 = unchanged; `reload` and `equip` scale durations. `WEAPON_STATS` lists the stat names in `STAT` index order.

## Weapons (11a)

- `Weapons.give(id, key, rarity)` -> bool. Owned already: adds `pickupAmmo` (WPN-007); a `dualWield` weapon picked up a second time becomes a pair instead (`Weapons.dual[slot]` = 1: magazine x2, fire rate x2, the new gun arrives loaded). At the carry limit the held (or first carried) weapon is replaced and its key left in `Weapons.dropped` (its rarity in `Weapons.droppedRarity`) for the items section to drop.
- `Weapons.setLoadout(id, keys)`: replaces the inventory; the last key is drawn at once. `Weapons.giveStartLoadout(id)` uses the set's `start` (called on `actor.spawn`).
- `Weapons.clear(id)`, `Weapons.has(id, key)`, `Weapons.currentWeapon(id)` -> row | null, `Weapons.ammo(id)` -> shared `{ magazine, reserve, alt, infinite }`.
- `Weapons.addAmmo(id, ammoType, amount)` -> rounds added to every owned weapon of that type (capped at `maxAmmo`).
- `Weapons.requestSwitch(id, weaponIndex)`, `Weapons.cycle(id, +1|-1)`, `Weapons.inSlot(id, slot)`.
- State per actor (typed arrays, index = actor id): `current`, `pending`, `state` (`WEAPON_STATE.IDLE|SWAP|RELOAD`), `stateTime`, `stateDuration`, `ads` (0..1), `toggled`, `heat`, `charge`, `recoilPitch` / `recoilYaw` (deg), `bloom`, `kick`. Per actor x weapon (`Weapons.slotIndex(id, weapon.index)`): `owned`, `magazine`, `reserve`, `altAmmo`, `rarity`, `dual`. ADS rises only while a zoom alt is held and the weapon is idle (a reload lowers the sights). A mount (W29 `toggle.needsLedge`) needs a ledge in front and drops as soon as the actor moves faster than 0.2 m/s or the ledge is gone.
- `Weapons.speedScale[id]`: movement multiplier (weapon moveMult/adsMoveMult, stance, statuses, crippled legs, downed crawl, guided warhead = 0), copied every step to `Move.weaponSpeedScale`, which S10 applies to the wish speed.
- Attachments and perks: `Weapons.attach(id, weaponKey, attachmentKey)` -> bool (weapons with a magazine that count toward the carry limit; replaces the attachment in the same slot), `Weapons.detachAll(id, weapon)`, `Weapons.modifier(id, weapon, STAT.X)` -> multiplier. Every stat = base x `Weapons.statScale[id * WEAPON_STAT_COUNT + STAT.X]` (per-actor, for perks such as reload or ammo bonuses; reset only on `actor.create`) x each fitted attachment. A newly given weapon starts bare; picking up one already owned keeps its attachments. Damage perks belong in `Damage.addAttackerScale`.
- `Weapons.spreadDegrees(id, weapon, mode)`: current spread (WPN-003, `Move.inaccuracy` x mode `moveSpread` for MOV-025, ADS, limb damage); `ready` also asks `Move.canFire`, and every step writes `Move.weaponSpeedScale`; a damage reducer applies `Move.damageScale` (MV08 roll).
- Hooks: `Input.aimAssistTarget(id, out)` -> bool, `out = { x, y, z, target, angle }` (nearest visible, uncloaked enemy body within 6 deg / 60 m). `Render.viewModel(out)` -> `{ visible, shape (weapon class), color, kick, reload 0..1, swap 0..1 (1 = raised), ads, zoom (FOV divisor), charge, recoilPitch / recoilYaw (deg the spray punches away from the view), dual }` for `Game.playerId`.
- Registries for new behaviours: `Weapons.deliveries[type]`, `Weapons.tools[key]`, `Weapons.specials[key]`.
- `Weapons.rayBlockers`: list of `fn(ox, oy, oz, dx, dy, dz, maxDistance) -> distance | -1` (S12 pushes devices and ability domes); `Weapons.blockDistance(...)` returns the nearest or -1. `Shot.trace` stops a hitscan ray there (no actor behind it is hit, no penetration) and emits an `impact` at the stop facing the shooter (`emitBlockedImpact`).
- `Weapons.rateScale[id]`: the single fire-rate factor (default 1); only S12 `Buffs.applyScales` writes it (RATE status x powerup rate).
- `Input.aimAssistOverride` (filled here): the match's `rules.botSkill.aimAssist` (0..100) replaces the player's device setting; -1 or no difficulty keeps it.
- `Hitbox` lives in S08 (`08b-world-collide.js`, used by `World.raycastActors`); its sizes are the S01 body constants. `Hitbox.ray(id, ox, oy, oz, dx, dy, dz, maxDistance, inflate)` -> distance | -1 (zone in `Hitbox.zone`, `ZONE.HEAD|BODY|LEGS`); `Hitbox.point(id, zone, out)`. Volumes: head sphere r 0.14 at eye + 0.04, torso r 0.30 from 0.85 to 1.45 m, legs r 0.22 from 0.05 to 0.85 m, both as upright cylinders scaled by height/1.8 (zones never overlap).

## Projectiles (11b)

- `Projectiles.spawn(row, owner, weaponIndex, modeIndex, x, y, z, vx, vy, vz, damage)` -> slot; `Projectiles.spawnFromWeapon(...)`.
- Gravity and drag are per projectile (`Projectiles.gravity[i]`, `Projectiles.drag[i]`), copied from the row at spawn.
- X41 Ballistics (`rules.fx.ballistics { gravity, drag }`): `deliverHitscan` spawns every pellet with `Projectiles.spawnBallistic(owner, weapon, mode, modeIndex, direction, damage, ballistics)`: row `bullet` (P21, 320 m/s), life = mode range / speed, gravity and drag from the mutator; the hit keeps the hitscan mode (falloff by distance flown, headshots). Pierce, thin-cover penetration, chain and combo shots do not apply to bullets. `Weapons.ballistics()` = the `{ gravity, drag }` in force or null; `Weapons.fliesAsBullet(mode)` = this hitscan mode fires bullets now (weapon.fire listeners that settle shots with an instant ray skip those). A bullet stops at `Weapons.blockDistance` on each sweep step (devices, domes; an impact shows the stop), and `Projectiles.bulletHits` = list of `fn(owner, mode, ox, oy, oz, dx, dy, dz, length)` runs for the part of a step the bullet flew unstopped by bodies (S12: devices take one pellet, X30 ammo blows up).
- `Projectiles.countOwned(owner, weaponIndex, typeIndex = -1)` (typeIndex = projectile row index, -1 any; `maxActive` limits count only the mode's own projectile row, so W32 mines never recycle grenades), `Projectiles.detonateOwned(owner, weaponIndex, projectileKey)`, `Projectiles.clear()`, `Projectiles.active` (count for the perf HUD), `Projectiles.guiding[id]`.
- Pool: 256 slots, struct of arrays; at a row's `poolSize` (or a full pool) the oldest is recycled. Projectiles never strike their owner directly (own splash still applies).
- Render sources: `projectiles` (spheres, puddles as flat cylinders) and `gates` (rings).

## Damage (11c)

- `Damage.apply(source, target, info)` -> damage dealt. The only damage path. `info = Damage.info()` (pooled; fields `amount zone ('head'|'body'|'legs'|'none') stomach mode weapon kind element distance knockback bypassArmor bypassShield x y z dx dy dz`). Order: friendly fire / self scale -> `Damage.addAttackerScale` hooks -> zone x precision -> falloff -> shatter -> `Damage.addReducer` hooks (subtractive reducers see the zone-scaled amount; HPP03 applies the zone after the shields instead) -> overshield -> shield (element factor) -> armor -> health -> minimum 1 -> downed / death.
- `Damage.statusHooks`: `fn(id, row, source, seconds)` after `Damage.addStatus` lands a status (filled by S12 12f for the HP-005 combos: wet + Shock, Shock chain, Burn melts ice).
- `Damage.explode(blast)` with `blast = Damage.blast()`: `{ x, y, z, owner, mode, radius, damage, exclude, ownerSafe, weapon, element }`. Linear falloff to `mode.splash.minFactor` (0.2), line of sight, self damage x `rules.selfDamage`, knockback.
- `Damage.resetHealth(id)` (on `actor.spawn` / `actor.create`), `Damage.revive(id)`, `Damage.addStatus(id, key, source, seconds, stacks)`, `Damage.hasStatus(id, key)`, `Damage.statusSpeed(id)`, `Damage.limbSpread(id)`.
- Shield regen pause: `Damage.pauseShieldRegen(id, seconds)` keeps the later of the current block and now + seconds; `Damage.shieldRegenBlocked(id)` -> bool (S12 suppression and EMP; ability shields check it too).
- Per-actor arrays other sections may write: `Damage.surplus` (powerups), `Damage.shieldElement` (PvE coloured shield: elements index + 1), `Damage.helmet` (HPP04 buy), `Damage.shieldRegenBlockedUntil` (Sim.tick before which shields do not recharge; S12 EMP, health regeneration is not affected; reset on spawn). `Damage.poolOverride = fn(id, out {health, armor, shield})` for hero pools. `Damage.roleOf = fn(id) -> role` for the HPP05 role regen (S12 fills it with the hero role; without it the profile role is used). `Damage.applyCount` (self-test).
- A freeze cannot be shattered by hits in the step that froze the target (the other pellets of the W22 blast); the next step's hit shatters it. Own damage over time (`dot`) is scaled by `rules.selfDamage` like own splash. Puddle statuses ride on accepted puddle damage only (friendly fire and protection apply). W03 block and parry count only while the block weapon is drawn and idle (block also needs ALT held); swaps, deaths and respawns drop the guard. `WeaponSpecialState.parryHooks` (fn(target, projectile) -> true) lets other sections parry a parryable projectile first (S14: PvE green projectiles inside the difficulty parry window, any weapon); a true answer reflects it like a W03 parry. Stuns (freeze, shock, sleep, stun) set `ACTOR_FLAG.FROZEN`; downed sets `ACTOR_FLAG.DOWNED`. Fodder = `kind ENEMY` with `profile.fodder === true`; `profile.massFactor` scales knockback; `profile.role === 'support'` enables the HPP05 passive regen.

## Events

Emitted: `weapon.fire` `{ id, weapon, weaponClass, mode ('primary'|'alt'|'melee' for the MELEE button bash), x, y, z, dx, dy, dz }`, `weapon.reload` / `weapon.switch` / `weapon.empty` `{ id, weapon }`, `impact` `{ x, y, z, nx, ny, nz, material, weapon, owner }`, `explosion` `{ x, y, z, radius, owner, source, element }`, `damage` `{ target, source, amount, absorbed, zone, weapon, element, kind, shieldDamage, armorDamage, healthDamage, x, y, z, dx, dy, dz }`, `kill` `{ victim, killer, assister, weapon, zone, element, x, y, z }` (assister = most recent other damager within 5 s; environment kills credit the last attacker), `impulse` `{ id, x, y, z }`, `sound` `{ x, y, z, radius, kind: 'shot'|'explosion', source }`.

Consumed: `damage.request` (routed through `Damage.apply`), `actor.create`, `actor.spawn`, `kill` (drops the victim's block), `match.start` / `match.stop` (clear projectiles).

## Debug

`__CTK.giveWeapon(id, key)`, `__CTK.weapons`, `__CTK.damage`.

## Known limits

Twin gates teleport (floor gates place the feet on the floor, ceiling gates the head under the ceiling, wall gates the middle 0.8 m out) but are drawn as rings without a view through them. The Graviton Lifter pushes, pulls and catches projectiles; physics props arrive through `WeaponSpecialState.propHook`. Attachments have data, stats and tests but no pick-up or menu UI yet. Not built yet: the W24 second zoom level (8x) and its 4 s hold breath (the scope has one 4x level and no sway to steady), and the HP-005 floor combos (wet floor + shock, oil floor + burn), which need floor materials from the world section.
