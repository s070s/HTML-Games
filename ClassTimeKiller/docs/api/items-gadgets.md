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

`mode`, `teams` (0 = free-for-all weapon pad times), `itemRespawnScale` (1), `weaponStay` (false), `dropOnDeath` (`none` | `held` | `all`, default `held`), `friendlyFire` (0), `economy` (gadget kit id, default `pickups`), `mutators` (`nopowerups` skips power spots; `souls` makes PvE kills drop souls), `params.souls` (same, set by a mode), `params.enemyPickups` (true lets PvE enemies take pickups; by default they leave them to players), `gravityScale` (grenade arcs through `bodyGravity()`).

## Input read

`BTN.GRENADE`: press with a grenade ready starts the hold; release throws (18 m/s along the view + 5 m/s up; with `BTN.ALT` held at release: underhand 9 + 2; that ALT hold never fires the weapon's alt, `Weapons.altClaim`). Cookable rows burn their fuse while held; a full cook goes off in the hand. `BTN.GADGET`: uses the gadget-slot row (placed or deployed). Both are blocked while `ACTOR_FLAG.FROZEN`, `ACTOR_FLAG.DOWNED` or EMP-suppressed.

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
- `Items.grant(id, key)` (buys: helmet, vest; royale health loot), `Items.carriedCount(id, key)`, `Items.use(id, key)`, `Items.useProgress(id)` (0..1, -1 none), `Items.cancelUse(id)` for loot consumables. A press of `BTN.HEAL` (action `heal`, key H, touch HEAL) runs `Items.useBest(id)`: the first carried I13..I17 row in catalogue order that would restore something. `Items.consumableCount(id)` = all carried consumables (HUD). Bots use one by themselves (`Items.botWantsHeal`) once `BOT_HEAL_CALM` (3 s) passed since their last damage and health or shield is missing.
- HUD: `Items.timers(out)` (respawning spots `{item, group, x, y, z, remaining}`), `Items.activePowerups(id, out)` (`{id, name, remaining, duration, color, persistent}`), `Items.soulCount(id)`. Bots: `Items.perceptionScale(id)` (PU04 cloak: 0.25).
- Registries: `Items.takers[kind]`, `Items.effects[effect]`, `Items.extraAmmo` (fn(id, row) -> bool; 12c refills kit grenades from ammo caches).
- `addAmmoShare(id, share)` -> rounds added: every owned magazine weapon gains share x its max reserve, at least 1 (I09, PU17, G23 share it).
- Gating: map item spots are placed unless `rules.items === false`, `rules.fx.noItems` or the mode's `params.pickups === false` (roulette, royale: the mode places its own loot); `params.pickups` = a pickup key keeps only that pickup's spots (M15 `springboots`); spot respawn times are divided by the difficulty's `resourceYield` (`rules.botSkill`, DIF-002); powerup spots also skip `fx.noPowerups` / the `nopowerups` mutator (X16). With `rules.weaponSet === 'matchSet'` a weapon spot whose gun is not on the match list hands out the list's guns in turn (`Items.spotWeapon`).
- Rarity: weapon pickups carry `Items.rarity[slot]` (WPN-008 index); a dying actor's weapons keep theirs on the floor (`dropWeaponAround`), and a weapon swapped out at the carry limit drops with `Weapons.droppedRarity`. `Items.drop(key, x, y, z, timeLeft, dropper, rarity)`, `Items.dropAround(key, id, k, n, timeLeft, rarity)`.
- Grants: `Items.givers[PICKUP_KIND]` = `fn(id, key) -> bool` (item rows, powerups (12b), weapons); `Items.giveKey(id, key)` answers `item.grant { id, item }` (X17). `Items.grantEffects[key] = fn(id, item) -> bool` delivers an economy buy of kind `grant` (ECP07 wave shop); `Items.canGrantBuy(key)` = a registered effect or an item row; `Items.grantBuy(id, item)`. S13 registers `Economy.grants.gadget` and `Economy.grants.grant` at the end of 13d (S12 cannot fill an S13 registry at load).
- X30 Volatile Ammo (`rules.fx.volatileAmmo`): a shot (`weapon.fire`) that reaches a ready ammo pickup before any wall blows it up (4 m, 80 damage, credited to the shooter); spot pickups then respawn as usual. Under X41 the bullet sets it off when it gets there (`Items.bulletHit` in `Projectiles.bulletHits`), not the shot.
- `Items.giveWeapon(id, key, rarity, floorY)`: pickups and `item.grant` weapons; at the carry limit the swapped-out weapon drops at the feet with its rarity (`Weapons.dropped`, `Weapons.droppedRarity`). The reserved weapon set id `MATCH_SET_ID` ('matchSet') is defined here once (13h and the custom editor use it).

## Powerups (12b)

- `Powerups.give(id, row, timeLeft)` -> bool, `Powerups.has(id, key)`, `Powerups.ticksLeft(id, row)`, `Powerups.clearActor(id, drop)`, `Powerups.souls[id]`.
- Keeps the speed and fire rate factors `Powerups.speedScale` / `Powerups.rateScale`, which `Buffs.applyScales` (12f, the single writer) multiplies into `Move.statusSpeedScale` / `Weapons.rateScale`; writes the shared hooks `Weapons.freeAmmo`, `Items.noArmor`, `ACTOR_FLAG.INVISIBLE` (only clears the flag when it set it), and chains `Render.actorStyle` (tint, glow, cloak shimmer). Damage hooks: `Damage.addAttackerScale` (damage, melee, fodder melee) and `Damage.addReducer` (invulnerable, immune kinds, taken scale, belt absorb).
- A timed powerup given while `Sim.tick` is T works for exactly `duration` steps: the step of tick T + duration removes it before movement.
- G08: while the `freeze` status holds a PU04 holder, the cloak is off (`ACTOR_FLAG.INVISIBLE` cleared, `Items.perceptionScale` 1); it comes back when the freeze ends. Abilities should refuse teleports while `Damage.hasStatus(id, 'freeze')`.
- Death drops the droppable powerups with their time left (at least 5 s); death, `match.end` and `match.stop` remove everything.

## Grenades and smoke (12c)

- `Gadgets.give(id, key, amount)` -> added (kit limits for thrown rows), `Gadgets.select(id, key)`, `Gadgets.countOf(id, key)`, `Gadgets.equip(id)` (on `actor.spawn`), `Gadgets.refill(id)`.
- `Gadgets.hudState(id, out)` -> `{grenade, grenadeCount, gadget, gadgetCount, gadgetCooldown (0..1 left), cook (0..1)}`. `Gadgets.rechargeTicks(id, row)` is the one field-upgrade recharge (`row.cooldown / Abilities.rechargeScale[id]`, ECP04 Tune Up), used for the cooldown and the HUD fraction.
- `Gadgets.suppressed(id)` (G20 EMP: no grenades, gadgets or abilities; shield recharge is held through `Damage.shieldRegenBlockedUntil` for the same 4 s, health regeneration goes on), `Gadgets.blindAmount(id)` (0..1 for the flash overlay), `Gadgets.jammed(id)` (G18: hide the radar), `Gadgets.visibleTo(index, id)`, `Gadgets.damageDevice(index, amount, source)`.
- Registries: `Gadgets.deployers` (fn(id, row) -> bool; 12d), `Gadgets.empHooks` (fn(owner, x, y, z, radius, seconds)). The one EMP path: `Gadgets.suppress(id, seconds)` per actor (gadgets held, shield recharge paused, abilities held) and `Gadgets.empDevices(owner, x, y, z, radius, seconds)` for devices; G20 and the A15 drone's end both use them.
- `Smoke.lineBlocked(ax, ay, az, bx, by, bz)` -> true when the segment passes through 1 m or more of smoke (bots, turrets, drones and aim assist use it). Aim assist goes through the `Input.aimAssistFilters` registry, so whichever section fills `Input.aimAssistTarget` keeps the smoke rule. `Smoke.covers(x, y, z)`. Smoke fills a 1 m occupancy grid from its centre, never through walls, grows over 1.5 s, and loses cells for 2 s to hitscan, beam and cone shots (`weapon.fire`) and blasts (`explosion`).
- Throws leave the hand 0.5 m in front of the eye along the view (`throwOrigin`); the arc preview starts there and follows the flight until the fuse (what is left of it while cooking) would end. Fire areas burn on the floor below where the grenade went off (3 m probe). A grenade stuck to a body loses its throw speed and drops when the carrier dies.
- Flash: blind seconds = duration x view share (facing 1, facing away 0.1) x distance share (1 at the centre, 0.25 at the edge), line of sight to the eye; enemies and the thrower, allies only with friendly fire.
- `Smoke.add(x, y, z, width, height, seconds, yaw, owner)` -> puff count: a smoke curtain `width` wide along the right vector of `yaw`, puffs of radius `height / 2` (at most the largest smoke radius) spaced 1.5 x that radius (2.25 m for A17's 3 m curtain) (ability smoke walls use it); grenade clouds and curtain puffs share 16 smoke slots. `Smoke.lineBlocked(ax, ay, az, bx, by, bz, viewer)` is false for a viewer with the hero passive `smokeVision`; the aim assist filter passes the player.
- Hero kits: `Gadgets.equipHero(id, hero)` gives the hero's gadget, plus one above the carry limit with the passive `extraGrenade` (H05); 12e calls it from `applyHero`. A spawn-room hero switch (`Abilities.refreshKit`) reruns `Gadgets.equip` first, so the old hero's gadget goes. `Gadgets.clearGrenades(id)` empties the thrown counts (13d before a class kit's lethal and tactical).
- `Gadgets.suppress(id, seconds)` also pauses shield regeneration (`Damage.pauseShieldRegen`) and the actor's abilities (`Abilities.suppress`).

## Devices (12d)

- `Devices.spawn(row, owner, x, y, z)`, `Devices.room(owner, row)` (GAD-003 caps: `max` per owner, `perTeam` per team), `Devices.damage(d, amount, source)`, `Devices.working(d)` (armed and not EMP-disabled), `Devices.clear()`.
- Shots: hitscan, beams and cones damage the nearest device on the ray (`Devices.onShot` on `weapon.fire`; X41 bullets through `Devices.bulletHit`), and `Devices.blockShot` (a `Weapons.rayBlockers` entry) stops the ray there. Every device with health blocks, the shooter's own and allies' too: it is a solid object; whether it takes the damage follows the friendly-fire rule, and the impact at the stop shows why the shot ended. A mode with `repair` (W30 beam) heals a friendly device (`Devices.friendOf`) by `repair / rate` per shot up to the row's health instead.
- Shots damage devices along the ray up to the first wall or body (a body in front shields the device; fire mode damage x pellets); blasts deal 100 x (1 - d/r).
- G12 dome: any projectile or grenade, whoever fired it, that crosses its wall this step (inside then outside or the reverse) is removed. G22 snatcher: enemy ones anywhere inside its radius, up to its charges.
- G13 barrier: the device yaw is snapped to the nearest axis (`snapToAxis`), so the drawn box and the axis-aligned brush agree.
- G15 turret and G21 drones pick the nearest enemy body in range they see (`Devices.nearestSeen`: walls, smoke, cloaked enemies only within 25 % of the range). Turrets pick on every shot; drones on the 0.25 s device tick and between picks only drop a target that died. Allies cannot harm devices unless friendly fire is on. Destroyed devices emit `gadget.destroyed`.
- `Devices.shownTo(d, id)` (renderer): friends see every device, enemies see deployed devices, and enemy placed gadgets (mines) only as a glint within 8 m in line of sight. `Gadgets.visibleTo(d, id)` (bots): the same, and enemy deployed devices only in line of sight. Devices are removed when their owner dies and at match start, end and stop.

## Events

Emitted: `pickup` `{id, item, group, x, y, z}`, `item.respawn` `{item, group, x, y, z}`, `sound` (`pickup`, `grenade`, `explosion`, `shot` for decoys and turrets, `pulse`, `jump`, `break`), `announce` `{text, kind: 'power', priority}`, `powerup.start` / `powerup.end` `{id, powerup}`, `souls` `{id, count}`, `projectile.bounce` `{x, y, z, kind: 'grenade', source}`, `explosion` (radius 0 for pops that hurt nobody, so audio plays the element sting), `impulse`, `gadget.use` `{id, gadget, kind}`, `gadget.place` / `gadget.destroyed` `{index, gadget, owner, x, y, z}`. Payloads are reused: copy what you keep.

Listened: `match.start`, `match.end`, `match.stop`, `kill`, `actor.spawn`, `actor.create`, `damage` (lifesteal), `move.jump` (spring boots), `weapon.fire`, `explosion`.

## Debug

`__CTK.items` `{items, powerups, give(id, key)}` and `__CTK.gadgets` `{gadgets, thrown, smoke, areas, devices, device(key, owner, x, y, z), effect(key, owner, x, y, z)}`.
