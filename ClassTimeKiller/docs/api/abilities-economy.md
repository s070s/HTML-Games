# Abilities and economy (S12 part 2, S13 economy) - public API

Files:
- `src/03k-data-abilities.js`: catalogues `abilities`, `heroes`, `abilityKits`.
- `src/03l-data-economy.js`: catalogues `economy`, `meters`, `perks`, `classes`, `buyItems`.
- `src/12e-abilities.js`: `Abilities`, the framework.
- `src/12f-abilities-effects.js`: effect kinds, `Buffs`, `AbilityZones`, hero passives.
- `src/12g-abilities-meters.js`: `Meters`, the energy bar, match meters and souls.
- `src/13d-economy.js`: `Economy` and `Loadouts`.
- `src/18f-ui-buy.js`: the `buy`, `loadout` and `classEditor` screens.

Tests: groups `abilities` and `economy`. Debug: `__CTK.abilities` `{ abilities, meters, zones }` and `__CTK.economy` `{ economy, loadouts }`.

## Catalogue `abilities` (A01..A40, AX1..AX7)

| Field | Default | Meaning |
|---|---|---|
| `id`, `code`, `name`, `category` | required | `shadowstep`, `A05`, display name; `suit` / `mobility` / `recon` / `control` / `sustain` / `offense` / `ultimate` / `physics` / `portal` / `reward` |
| `activation` | required | `instant`, `toggle` (press on/off), `hold` (while held), `channel` (press again cancels), `passive` (always on), `ult` (fires by itself once affordable, A34) |
| `resource` | `cooldown` | `cooldown`, `charges`, `energy`, `ultimate`, `fuel`, `souls`, `none` |
| `cost`, `costPerSecond` | 0 | energy (or souls) per cast; energy per second while active |
| `cooldown`, `charges` | 0 | seconds; with `charges`, one charge refills every `cooldown` seconds, one at a time |
| `duration` | 0 | active seconds; 0 = instant (cast and end in the same step); `fuel` rows: seconds of fuel |
| `range`, `ultCost` | 0 | metres; ultimate-meter cost (0 = the meter's `cost`; above the meter max = the full meter) |
| `effect`, `params` | required, `{}` | generic effect kind of 12f and its numbers |
| `group` | `''` | one active ability per group (the suit weaves) |
| `modes` | `any` | `versus` / `pve` / `solo`: the only `rules.family` the row works in |
| `interrupt` | `{ damage: false, stun: true, fire: false }` | what ends it while active |
| `balance` | `{}` | `noCarrier` (not while carrying an objective), `fireDelay`, `lineOfSight`, `dropsObjective` (A12: moving the user drops a carried objective) |
| `counter`, `botUse` | | counterplay text; bot hint `{ when, range, chance }` for S14 |
| `color`, `index` | | HUD colour; position in `CAT.abilities` (set at load) |

Effect kinds: `zone` (`params.zone`: lift, smoke, heal, dome, wall, strike), `blink`, `buff`, `grapple`, `rewind`, `glide`, `beacon`, `pulse`, `sight`, `drone`, `tracker`, `fence`, `timebend`, `push`, `link`, `mesmer`, `possess`, `frenzy`, `revive`, `bolt`, `swarm`, `decoy`, `telekinesis`, `gates`, `rift`, `rally`, `suitArmor`, `suitSpeed`, `suitStrength`, `cloak`. A new row reuses a kind with other `params`; a new kind is one entry in `Abilities.effects`: `{ cast(id, row, slot) -> bool, step(id, row, slot, dt) -> false ends, end(id, row, slot, reason), drain(id, row) -> energy per second }`.

## Catalogues `heroes` (H01..H08) and `abilityKits`

- `heroes`: `{ id, code, name, role, health, armor, shield, weapons, move, passive, gadget, ability1, ability2, ultimate, color }`.
  - `weapons` is the loadout; the last key is drawn.
  - `move` is a `CAT.movement` key.
  - `passive.kind` is one of `knockbackResist`, `killHaste`, `shieldRegen` (H02: +`rate`/s shield after `delay` s, on top of the HPP05 recharge), `regen` (H06: the HPP05 support role regen, see `Damage.roleOf`), `ability` (an always-on ability row) or `flag`.
  - A flag is read by other sections with `Abilities.passiveFlag(id, flag)`: `scopeInfo` (H04, HUD), `extraGrenade` (H05, items), `smokeVision` (H07, items/smoke). **Pending**: no reader exists yet (contract requests to those sections).
  - `gadget` is for the items section.
- `abilityKits`: `{ id, name, match, ability1, ability2, ultimate, passive, choices, cooldowns }`.
  - `match` is `{ ruleset }`, `{ economy }` or `{ mutator }`. The first matching row applies.
  - `choices[slot]` lists the abilities a loadout may pick. A choice of `KIT_SLOT_EMPTY` (`none`) leaves the slot empty.
  - `cooldowns[slot]` replaces the row cooldown in this kit (`Abilities.slotCooldown`).
  - Kits: `powers` (mutator `powers`), `suit` (RS11), `frame` (RS12), `classes` (the ECP04 field upgrade: Echo Pulse only, 90 s; a class with a gadget field upgrade has no ability).

## Abilities (`src/12e-abilities.js`)

Slots per actor: `SLOT.ABILITY1` / `ABILITY2` / `ULTIMATE` / `PASSIVE`. They are pressed with `BTN.ABILITY1` / `ABILITY2` / `ULTIMATE`; the passive slot has no button. Per-slot typed arrays are indexed `Abilities.index(id, slot)`: `slotAbility`, `cooldown`, `slotCooldown` (the full cooldown: row or kit override), `charges`, `active`, `activeTime` (`OPEN_ENDED` = -1 for toggles and holds), `elapsed`, `fuel`.

- Reading:
  - `row(id, slot)`, `slotOf(id, abilityId)`, `isActive(id, abilityId)`, `ready(id, slot)`.
  - `usable(id, row)`: not suppressed, not stunned (FROZEN/DOWNED), `modes` allows it, not `noCarrier` while carrying.
  - `canAfford(id, slot, row)`.
- Kits:
  - `economyKey()` returns `rules.params.economy` or else `rules.economy`. `usesHeroes()` is true for `heroKits`.
  - `kitOf(id)` returns the hero row or the matching `abilityKits` row.
  - `heroOf(id)` and `pickHero(id)`. The hero comes from the loadout choice, else `profile.hero`, else `CAT.heroes[id % 8]`.
  - `setChoice(id, { hero, ability1, ability2, ultimate })`. Disallowed choices fall back to the kit default.
  - `assignSlots(id)`, `setSlot(id, slot, row|null)`.
  - `refreshKit(id)`: an in-place respawn kit change (pools, weapons, movement, the gadget kit from scratch (`Gadgets.equip`, so the old hero's gadget goes), slots).
- Use:
  - `tryActivate(id, slot)`: a second press turns a toggle off or cancels a channel. The effect's `cast` must succeed before anything is paid, so a missing target costs nothing.
  - `forceCast(id, abilityId)`: adrenaline combos, already paid.
  - `grantReward(id, abilityId)`: streak and boost rewards load the ultimate slot for one use (`rewardLoaded[id]`); once it has run the slot returns to the kit ultimate or empties, whatever the row category.
  - `interrupt(id, 'damage'|'fire')`, `suppress(id, seconds)`, `end(id, slot, reason)`, `endAll`, `clearActor`, `clearMatch`.
- `hudState(id, out)`: fills `out.slots` (up to 3) with `{ id, name, key, ready, cooldown 0..1, charges, active, remaining, color }` and `out.meter` with `{ kind, value 0..1, ready, energy 0..1, souls }`. `out` must be `{ slots: [], meter: {} }`. The array and its entries are reused (filled in place every call).
- Hooks set by S13: `carrierCheck(id)` and `hiddenFromPulse(id)` (the Ghost perk).
- Other fields:
  - `rechargeScale[id]` is written by the Tune Up perk; it also divides the field-upgrade gadget recharge (12c `useGadget`).
  - `Damage.poolOverride` gives heroes their pools (HPP05).
  - `Damage.roleOf(id)` (12f) gives S11 the role for the HPP05 role regen: the hero role in hero rulesets, else `profile.role`.
- Sim system `abilities` at order 20 (after `status`). Lifecycle:
  - Slots are reset on `actor.create` and `actor.spawn`.
  - On `kill`: abilities end, and zones without `params.persist` are removed.
  - On `match.end` and `match.stop`: everything is cleared.
- Wiring: `power.pick { id, ability }` (X46) puts the ability in `ABILITY1`; with `rules.fx.mirror` (X40) every bot plays the player's hero (`pickHero` -> `mirroredHero`); `applyHero` calls `Gadgets.equipHero`. A frozen actor (FREEZE status) cannot teleport: blink, rewind, the beacon's return and rift steps check `canTeleport(id)`, and S11 gates skip frozen actors.

## Buffs and zones (`src/12f-abilities-effects.js`)

- `Buffs.add(id, BUFF.X, value, seconds)`, `get` (neutral value when off), `has`, `remaining`, `cancel`, `clear(id)`.
  - Each kind keeps 3 overlapping entries with their own value and end time. The same value extends its entry; `get` returns the strongest live entry (the lowest for slows). A strong short buff never lasts as long as a weak long one.
  - Kinds: SPEED, SLOW (lowest wins), DAMAGE, RATE, INVULNERABLE, INVISIBLE, REGEN (HP/s), TOUCH_KILL, NO_FIRE, KNOCKBACK, ENERGY_REGEN, MELEE. INVISIBLE sets `ACTOR_FLAG.INVISIBLE` only while the actor is not frozen (G08: a freeze stops a cloak; it comes back when the freeze ends).
  - **Buffs is the single writer of `Move.statusSpeedScale` and `Weapons.rateScale`** (`Buffs.applyScales(id)`, every step and whenever the powerup set changes): speed = SPEED x SLOW x `Powerups.speedScale`, fire rate = RATE x `Powerups.rateScale`. Other sections that need a speed or fire-rate change use `Buffs.add` (or, like powerups, keep their own factor that `applyScales` multiplies in).
  - RATE works through `Weapons.rateScale` (S11 divides every shot interval by it); NO_FIRE holds `Weapons.nextShot`.
- `AbilityZones`: a pool of 48 placed effects, stored as a struct of arrays.
  - Fields: `alive`, `kind` (`ZONE_KIND`), `owner`, `team`, `ability`, `x/y/z`, `radius`, `height`, `timeLeft`, `target`, `other`, `value`, `persist`.
  - Methods: `add(kind, owner, row, x, y, z, seconds)` returns the zone index, `find(kind, owner)`, `remove(zone)`, `removeOwned(id, keepPersistent)`, `clear()`, `inside(zone, id)`.
  - A zone starts working on the step after it was placed. The A38 strike lands exactly `params.delay` after the cast.
- Damage hooks: attacker scale (DAMAGE and MELEE buffs, touch kill), reducer (decoy, invulnerable, dome and amp wall, knockback resist, the bulwark weave), linked damage sharing (A21).
- Event `ability.teleport` `{ id, x, y, z }`: only rows with `balance.dropsObjective` (A12 relocator). Dashes, rewinds and rifts keep a carried objective.
- `BUFF.GRAVITY` (lowest wins, neutral 1): glide writes it while airborne. `Buffs.applyScales(id)` is the single writer of `Move.statusSpeedScale` (SPEED x SLOW x powerup speed), `Weapons.rateScale` (RATE x powerup rate) and `Move.gravityScale`; 12b calls it when powerups change.
- Domes (A26) stop hitscan at their surface from either side (`Weapons.rayBlockers`); ability shields do not regenerate while `Damage.shieldRegenBlocked(id)`. Smoke zones are laid with `Smoke.add` (not drawn as a box).

## Meters (`src/12g-abilities-meters.js`)

- Energy (ABL-002):
  - `Meters.energy[id]` runs from 0 to 100.
  - Regen is 5/s, starting `regenDelay` (1 s) after the last spend (energy meter row). The HPP08 suit preset uses 25/s after 2 s. A draining toggle or hold spends every step, so it never regenerates while on (A14 costs exactly 5/s).
  - `energyMax()` is the suit preset `energy.max` or the energy meter row `max` (100).
  - A kill orb gives +25.
  - `spendEnergy(id, amount)` returns false and empties the bar when there is not enough; `addEnergy(id, amount)`.
  - `actor.spawn` refills the bar and clears half-typed combo taps (`resetLife`). The match meter points, reward progress and souls stay across lives; streak meters restart on death (`resetOnDeath`).
- Match meter `rules.meter` (catalogue `meters`):
  - `streak` (rewards at 300/500/800 meter points, 100 per scoreboard point, resets on death).
  - `boost` (0.5/s + 4 per point; rewards at 50/80, then it starts over).
  - `adrenaline` (5 per kill, +10 every 5th kill in a life, +25 per capture; four direction taps with a full meter: FFFF BBBB LLRR FFBB).
  - `ultimate` (5/s + 1 per HP of damage or healing dealt; the ultimate slot pays `ultimateCost(row)`).
  - `energy`.
- `Meters.points[id]`, `max()`, `fraction(id)`, `paysUltimate()`, `addPoints`, `spendPoints`, `addHealing`, `streakDiscount[id]` (the Hardline perk), `souls[id]` (A34), `hudState(id, out)`.
- Sim system `meters` at order 22.

## Economy (`src/13d-economy.js`)

Presets `CAT.economy` (ECP01..ECP07): `pickups`, `roundBuy`, `loot`, `classes`, `heroKits`, `ladder`, `waveShop`.

- Money:
  - `Economy.money(id)`, `setMoney`, `addMoney`.
  - Money is capped at `maxMoney` (9000 in round buy).
  - ECP02 kill reward: the preset `killReward` (200) plus, for a weapon kill, the weapon's `killReward` class bonus (SMG 600, shotgun 900, rifle 300, sniper 100, melee 1500). The wave shop pays the enemy's `profile.cash`, clamped to 10..100 (default 50).
- **Loss ladder (the one rule):**
  - Each team has a loss counter (`Economy.lossCount[team]`).
  - A lost or drawn round adds 1. A won round resets it to 0.
  - A loss pays `lossLadder[min(counter, length) - 1]` (1900 / 2400 / 2900). A win pays `winReward` (3000).
  - Payouts go to every participant on 'round' end.
- Plant gives +300 to each member of the planter's team. Defuse gives +300 to the defuser.
- Half: when `Modes.swapped` changes (with `halfReset`), all money returns to `startMoney` (800), and the loss counters and kept gear reset.
- Keep on survive: weapons and armor bought by an actor that did not die come back at its next spawn.
- `Economy.hudState(id, out)` fills `{ money, nextRoundMoney, canBuy, buyTimeLeft }`. `nextRoundMoney` is the money a loss from here would leave: the start money when the next round starts a new half, and the money itself once the round has ended.
- Buying:
  - `Economy.buy(id, itemId)` returns a shared `{ ok, reason, price, item }`.
  - Checks run in this order: economy, alive, buy time (15 s from round start, or the shop open), buy zone (8 m from the actor's spawn point), item on sale, carry limits (owned weapon, full armor, per-life `limit`, shared `groupLimit` of 4 grenades), money, delivery.
  - Reasons are listed in `BUY_REASON_TEXT`.
  - Related calls: `buyBlock(id)`, `canBuy(id)`, `buyTimeLeft()`, `catalogue()` (buy items that can be granted, then the priced weapons of the weapon set), `limitReason(id, item)`.
- `Economy.grants[kind] = fn(id, item) -> bool`:
  - `armor`, `helmet`, `ammo` and `weapon` are built in.
  - `gadget` and `grant` are registered by the items section. Until then, those rows are not on sale.
- Other API: `Economy.awardWave(team, flawless)` (700 + 100), `setShopOpen(open)`, `ladderWeapon(tier)` (ECP06, 18 tiers).
- Classes (ECP04):
  - On spawn, the class perks write `Weapons.statScale` and the class weapons replace the start loadout (the set's melee is kept).
  - Bots use `CAT.classes[id % 6]`.
  - Perks: Stopping and Hardened change hitscan bullet damage (Stopping cancels Hardened); Hardline sets `Meters.streakDiscount`; Tune Up sets `Abilities.rechargeScale`; Scavenger refills ammo on a kill.
  - `Economy.hasPerk(id, key)` exposes flags to other sections: `ghost`, `marathon`, `quiet`, `lastStand`.
  - Field upgrades: `CAT.economy.byId('classes').fieldUpgrades` (G13 `cover`, G22 `trophy`, G23 `ammobox`, G24 `beacon`, A13 `echopulse`). Gadget ones are granted through `Economy.grants.gadget`.
- `Economy.switchHero(id, heroId)` (ECP05) returns `'now'` within 8 m of the last spawn point (in-place kit change), `'next'` otherwise, or `'unknown'`.
- `Economy.usesLoadouts()`: false when the mode arms everyone itself (params `ladder` or `rotateEvery`: Arms Ladder, Roulette) or the preset has `loadout: 'none'`; class kits apply only when true (the buy screen should ask it too). Perks write `Move.staminaScale` (Marathon) and `Move.footstepScale` (Quietstep 0); `Weapons.statScale` stays the perks' stat slot, `Weapons.mutatorScale` the mutators'.

## Loadouts (`Save.data.loadouts`)

`{ classes: { selected, custom: [] }, heroes: { hero }, kits: { kitId: { ability1, ability2, ultimate } } }` is created on first use.

- `Loadouts.classes()`, `selectedClass()`, `selectClass(id)`, `classFor(actorId)`.
- `saveClass(row)` stores up to 10 custom classes as `class-N`. It returns `null` with `lastError` when the secondary is not a sidearm, the perks are not one per tier, or the field upgrade is not in the ECP04 list.
- `removeClass(id)`, `hero()`, `setHero(id)`, `kitChoice(kitId)`, `setKitChoice(kitId, slot, abilityId)` (only allowed choices).
- `applyTo(actorId)` runs on `actor.create` for the player. Changes apply at the next spawn; heroes can switch instantly in the spawn room.

## UI (`src/18f-ui-buy.js`)

- `buy` overlay:
  - Shows credits, buy time, next-round money and the loss ladder panel (ECO-001).
  - Items have hotkeys 1-9. Unaffordable items are dimmed and a press shows the reason.
  - B or Esc closes it. It closes itself when buy time ends.
- `loadout` has three tabs: Classes, Hero and Ability kits. `classEditor` uses one cycle per field.
- Opening:
  - The `buyMenu` action (KeyB, Interface group) opens `buy` in buying matches, else `loadout` when the match has loadouts.
  - Gamepad and touch players use the pause menu rows `Buy menu` and `Loadout`. These rows exist only during matches that use them.

## Limits and notes

- A35 telekinesis pulls on press and punts on release. It cannot hold a prop, because S11's lifter needs the weapon drawn.
- A19 time bend slows actor movement only. In single player and PvE the field covers the whole map, except the user.
- A15 scout drone: the pilot stands still and cannot fire, and the drone ends in an EMP (r `empRadius`, `empSeconds`): enemies in the radius get 'shock' and `Gadgets.suppress` (shield recharge paused, gadgets and abilities held), enemy devices in the radius switch off (`Gadgets.empDevices`). There is no drone camera yet.
- A16 footprints are drawn only for the local player's tracker.
- A17 veil curtain is a visual zone. It does not block bot line of sight until `Smoke.add` exists (items section).
- A12 relocator: placing the beacon and teleporting to it each cost a charge.
- Not yet wired, because the hook is missing: glide gravity (applied through `vy`), Marathon and Quietstep (flags only: S10 needs a sprint-stamina and a footstep hook), the hero passive flags `scopeInfo`, `extraGrenade`, `smokeVision`.
