# Abilities and economy (S12 part 2, S13 economy) - public API

Files:
- `src/03k-data-abilities.js`: catalogues `abilities`, `heroes`, `abilityKits`.
- `src/03l-data-economy.js`: catalogues `economy`, `meters`, `perks`, `classes`, `buyItems`.
- `src/12e-abilities.js`: `Abilities`, the framework.
- `src/12f-abilities-effects.js`: effect kinds, `Buffs`, `AbilityZones`, hero passives.
- `src/12g-abilities-meters.js`: `Meters`, the energy bar and match meters (souls are PU18 pickups, 12a/12b).
- `src/12h-surfaces.js`: `FloorSurfaces`, the HP-005 floor patches (wet floor, oil, burning oil; catalogue `surfaces` in 03d).
- `src/13d-economy.js`: `Economy` and `Loadouts`.
- `src/18f-ui-buy.js`: the `buy`, `loadout` and `classEditor` screens.

Tests: groups `abilities` and `economy`. Debug: `__CTK.abilities` `{ abilities, meters, zones }` and `__CTK.economy` `{ economy, loadouts }`.

## Catalogue `abilities` (A01..A40 without the retired A30 and A31, AX1..AX7: 45 rows; the retired keys map to `arcbolt` through `ABILITY_MIGRATION`, 04-save)

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

Effect kinds: `zone` (`params.zone`: lift, smoke, heal, dome, wall, strike), `blink`, `buff`, `grapple`, `rewind`, `glide`, `beacon`, `pulse`, `sight`, `drone`, `tracker`, `fence`, `timebend`, `push`, `link`, `mesmer`, `possess` (A23: the aimed fodder or beast joins the caster's side; from a bot caster that is a plain `swap` zone and the puppet's own brain fights for it; from a player it is a `puppet` zone and `PuppetState` hands it the caster's controls: system `puppet` (order 19, after every brain) copies the caster's move, aim and buttons to it and leaves the caster's body still, `puppetRestore` (89) gives the caster's input fields back; the local player's camera rides the puppet's eyes through `Render.cameraOverride` and the puppet is hidden from its driver; S14 PvE skips the brain of a driven enemy (`PuppetState.master[id] >= 0`) and a FIRE press starts its first attack in reach on the foe nearest its crosshair; it ends on the timer, the puppet's death, or a hit, stun or death of the caster (row `interrupt.damage`)), `frenzy`, `revive`, `bolt`, `swarm`, `decoy`, `telekinesis`, `gates`, `rift`, `rally`, `suitArmor`, `suitSpeed`, `suitStrength` (A03: `params.throwReach/throwSpeed/throwLift`: a paid melee swing throws the enemy in front, a bot or a PvE enemy, along the view; with none in reach it throws the breakable prop or debris piece in front through S08 `PropLift` with the W41 Lifter's mass limit and impact damage), `cloak`. HP-005 combos (12f `statusCombo` on `Damage.statusHooks`): a Shock on a wading target stuns everyone wading within 8 m (A29 in water), every Shock chains once to the source's nearest enemy within 4 m, and Burn (A30 Ignite) thaws Chill and Freeze (a thawed Freeze leaves a wet patch). Floor patches react in 12h (see Floor surfaces below); a `bolt` with no enemy in the aim cone reaches the patch at the aimed floor point (A29 shocks everyone in a wet patch, A30 lights oil) and is refused when no patch reacts. A `swarm` on a fodder enemy emits `ability.panic` (A32). A new row reuses a kind with other `params`; a new kind is one entry in `Abilities.effects`: `{ cast(id, row, slot) -> bool, step(id, row, slot, dt) -> false ends, end(id, row, slot, reason), drain(id, row) -> energy per second }`.

## Catalogues `heroes` (H01..H08) and `abilityKits`

- `heroes`: `{ id, code, name, role, health, armor, shield, weapons, move, passive, gadget, ability1, ability2, ultimate, color }`.
  - `weapons` is the loadout; the last key is drawn.
  - `move` is a `CAT.movement` key.
  - `passive.kind` is one of `knockbackResist`, `killHaste`, `shieldRegen` (H02: +`rate`/s shield after `delay` s, on top of the HPP05 recharge), `regen` (H06: the HPP05 support role regen, see `Damage.roleOf`), `ability` (an always-on ability row) or `flag`.
  - A flag is read by other sections with `Abilities.passiveFlag(id, flag)`: `scopeInfo` (H04, the HUD scope readout in 17f), `extraGrenade` (H05, `Gadgets.equipHero` in 12c), `smokeVision` (H07, `Smoke.lineBlocked` with a viewer id: aim assist and bot sight in 14b see through smoke).
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
  - `economyKey(rules?)` returns `rules.params.economy` or else `rules.economy` of the given built rules (default `currentRules()`). `usesHeroes()` is true for `heroKits`. `keptDraw(id)` is the drawn hero while the actor is still on the team it was drawn for, else null.
  - `kitOf(id)` returns the hero row or the matching `abilityKits` row.
  - `heroOf(id)` and `pickHero(id)`. The hero comes from the loadout choice, else `profile.hero`, else a hero drawn once per match per team (`drawHero`: a role the team lacks first, then one no teammate plays, then any; seeded by the match seed and actor id; kept in `Abilities.drawn` with the team it was drawn for in `Abilities.drawnTeam`, so a bot moved by auto-balance draws again; reset on actor.create). `wantedHero(id)` = the loadout choice or `profile.hero`.
  - `setChoice(id, { hero, ability1, ability2, ultimate })`. Disallowed choices fall back to the kit default.
  - `assignSlots(id)`, `setSlot(id, slot, row|null)`, `replaceUltimate(id, row)` (ends a running ultimate, then sets the slot; used by `forceCast` and `loadReward`).
  - `refreshKit(id)`: an in-place respawn kit change (pools, weapons, movement, the gadget kit from scratch (`Gadgets.equip`, so the old hero's gadget goes), slots).
- Use:
  - `tryActivate(id, slot)`: a second press turns a toggle off or cancels a channel. The effect's `cast` must succeed before anything is paid, so a missing target costs nothing. A-09 (P7): for a `needsTarget` row (A21 link, A24 frenzy, A29 bolt, A32 swarm) a press of the local player that found no target emits `ability.notarget` (the dry click) and toasts "No target", once per press (a bot, and an ultimate that asks every step without a press, stay silent). `watchReady` emits `ability.ready` for the local player's slots (P7 F10).
  - The slot button does the same while the ability runs: `stepActor` sees a new press of `BTN.ABILITY1` / `ABILITY2` / `ULTIMATE` on a running toggle or channel (`pressedAgain`) and calls `tryActivate`, which ends it. The press that started it never ends it (only a new press counts).
  - `forceCast(id, abilityId)`: adrenaline combos, already paid.
  - `grantReward(id, abilityId)`: streak and boost rewards load the ultimate slot for one use (`rewardLoaded[id]`); a reward earned while one is loaded waits in a queue of 3 (`REWARD_QUEUE_SIZE`) and never replaces the loaded one; once it has run the slot returns to the kit ultimate or empties, whatever the row category. In a soul mode (`rules.params.souls`) no reward loads: the slot stays Wrath Form's.
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
  - Kinds: SPEED, SLOW (lowest wins), DAMAGE, RATE, INVULNERABLE, INVISIBLE, REGEN (HP/s), TOUCH_KILL, NO_FIRE, ENERGY_REGEN, MELEE (GRAVITY and RATE_SLOW are described below). INVISIBLE sets `ACTOR_FLAG.INVISIBLE` only while the actor is not frozen (G08: a freeze stops a cloak; it comes back when the freeze ends).
  - **Buffs is the single writer of `Move.statusSpeedScale` and `Weapons.rateScale`** (`Buffs.applyScales(id)`, every step and whenever the powerup set changes): speed = SPEED x SLOW x `Powerups.speedScale`, fire rate = RATE x `Powerups.rateScale`. Other sections that need a speed or fire-rate change use `Buffs.add` (or, like powerups, keep their own factor that `applyScales` multiplies in).
  - RATE works through `Weapons.rateScale` (S11 divides every shot interval by it); NO_FIRE holds `Weapons.nextShot`, and (A06 Phase Slip, through `Gadgets.attackLocks`) also stops grenades, gadgets and `offense` / `control` abilities (`ATTACK_CATEGORIES`); a grenade being cooked when it starts is put away (kept). Rally (A40 Rally Cry) gives every living ally surplus shield inside `RALLY_SURPLUS_CAP` (100), and that surplus is lost again after 8 s (`RallyShield`; one pool, a later rally moves the end) together with the speed buff.
- `AbilityZones`: a pool of 48 placed effects, stored as a struct of arrays.
  - Fields: `alive`, `kind` (`ZONE_KIND`), `owner`, `team`, `ability`, `x/y/z`, `radius`, `height`, `timeLeft`, `target`, `other`, `value`, `persist`.
  - Methods: `add(kind, owner, row, x, y, z, seconds)` returns the zone index, `find(kind, owner)`, `remove(zone)`, `removeOwned(id, keepPersistent)`, `clear()`, `inside(zone, id)`.
  - A zone starts working on the step after it was placed. The A38 strike lands exactly `params.delay` after the cast.
- Damage hooks: attacker scale (DAMAGE and MELEE buffs, touch kill), reducer (decoy, invulnerable, dome and amp wall, knockback resist, the bulwark weave), linked damage sharing (A21).
- Event `ability.teleport` `{ id, x, y, z }`: only rows with `balance.dropsObjective` (A12 relocator). Dashes, rewinds and rifts keep a carried objective.
- `BUFF.GRAVITY` (lowest wins, neutral 1): glide writes it while airborne. `Buffs.applyScales(id)` is the single writer of `Move.statusSpeedScale` (SPEED x SLOW x powerup speed), `Weapons.rateScale` (RATE x RATE_SLOW x powerup rate; `BUFF.RATE_SLOW` is lowest-wins, neutral 1: ABL-004 time slow and C02 Slowtide, so a rate boost never cancels a slow) and `Move.gravityScale`; 12b calls it when powerups change.
- Domes (A26) stop hitscan at their surface from either side (`Weapons.rayBlockers`); ability shields do not regenerate while `Damage.shieldRegenBlocked(id)`. Smoke zones are laid with `Smoke.add` (not drawn as a box).

## Floor surfaces (`src/12h-surfaces.js`, HP-005)

- Catalogue `surfaces` (03d): `wet` (spreads Shock), `oil` (lit by Burn or a thermal explosion, becomes `fire`), `fire` (6 s, 20 HP/s thermal `dot` plus Burn to whoever stands in it). Fields: `seconds`, `radius`, `spillFrom` (prop material), `spreads`, `igniteStatus`, `igniteElement`, `becomes`, `dps`, `element`, `status`, `statusSeconds`, `fx`, `glow`, `color`.
- `FloorSurfaces`: a pool of 16 patches as a struct of arrays (`active`, `row`, `owner`, `x/y/z`, `radius`, `endTick`); a full pool replaces the patch that ends first. `spill(row, owner, x, y, z)` drops a patch on the floor below the point (up to 4 m), `spillUnder(id, key, owner)`, `stands(slot, id)` (feet within 0.6 m of the patch height, inside its radius), `clear()` (every world load and clear).
- Sources: a breakable prop whose material a row names breaks (`world.break`: material `oil` = an oil drum, `water` = a water tank; MP07 Cistern has one of each, MP12 Ash Manor an oil drum, and `MapRules.materials` lists `oil` so map codes and the editor accept oil props), and Burn thawing a Freeze (12f) spills a wet patch under the target.
- Reactions: a `Damage.statusHooks` entry after the 12f combos. A status a patch `spreads` landing on someone in it lands on everyone standing in it; its `igniteStatus` on someone in it, or an `explosion` of its `igniteElement` within its radius plus the blast radius, turns it into `becomes` and lights every touching patch that can burn; a patch that can burn spilled later against a burning one lights at once (credited to that fire's igniter). Statuses a combo hands out (`ComboState.spreading`) never react again. A G04 fire area lights the oil it overlaps on every step (`FloorSurfaces.igniteNear`, shared with explosions), since its pop is announced with radius 0.
- Burning patches hurt on the G04 fire area tick (0.25 s, `AREA_TICK_SECONDS` in 11b) through the shared 12c `fireAreaHit` (`Damage.apply`, kind `dot`, credited to the igniter, team rules apply; the status only on a real hit), and smoke (`Smoke.covers`) puts them out as it does a G04 fire area. Sim system `surfaces` at order 57; render source `surfaces` draws each patch as a flat disc (`meshFrom`, no allocation).

## Meters (`src/12g-abilities-meters.js`)

- Energy (ABL-002):
  - `Meters.energy[id]` runs from 0 to 100.
  - Regen is 5/s, starting `regenDelay` (1 s) after the last spend (energy meter row). The HPP08 suit preset uses 25/s after 2 s. A draining toggle or hold spends every step, so it never regenerates while on (A14 costs exactly 5/s).
  - `energyMax()` is the suit preset `energy.max` or the energy meter row `max` (100).
  - A kill orb gives +25.
  - `spendEnergy(id, amount)` returns false and empties the bar when there is not enough; `addEnergy(id, amount)`.
  - `actor.spawn` refills the bar and clears half-typed combo taps (`resetLife`). The match meter points, reward progress and souls (`Powerups.souls`) stay across lives; streak meters restart on death (`resetOnDeath`).
- Match meter `rules.meter` (catalogue `meters`):
  - `streak` (rewards at 300/500/800 meter points, 100 per scoreboard point, resets on death).
  - `boost` (0.5/s + 4 per point; rewards at 50/80, then it starts over).
  - `adrenaline` (5 per kill, +10 every 5th kill in a life, +25 per capture; four direction taps, each within 0.25 s (`TAP_WINDOW`) of the one before, with a full meter: FFFF BBBB LLRR FFBB).
  - `ultimate` (5/s + 1 per HP of damage or healing dealt; the ultimate slot pays `ultimateCost(row)`).
  - `energy`.
- `Meters.points[id]`, `max()`, `fraction(id)`, `paysUltimate()`, `addPoints`, `spendPoints`, `addHealing`, `streakDiscount[id]` (the Hardline perk), `hudState(id, out)` (its `souls` = `Powerups.souls[id]`).
- Souls (A34 Wrath Form): one counter, `Powerups.souls[id]` (S12 12b), fed only by PU18 Soul Shard pickups that PvE kills drop in soul modes (`rules.params.souls`; 12a `Items.dropSoul`, homing in 12a). A soul mode puts Wrath Form in an ultimate slot its kit leaves empty (`assignKitSlot`); it casts itself once the souls pay for it and spends them all.
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
- Keep on survive (`Economy.keepGear(id)`, at the round payout): armor, helmet, the held weapon, owned weapons with their magazine and reserve ammo, and gadgets of an actor that did not die come back at its next spawn. A round start clears all placed gear.
- `Economy.hudState(id, out)` fills `{ money, nextRoundMoney, canBuy, buyTimeLeft }`. `nextRoundMoney` is the money a loss from here would leave: the start money when the next round starts a new half, and the money itself once the round has ended.
- Buying:
  - `Economy.buy(id, itemId)` returns a shared `{ ok, reason, price, item }`.
  - Checks run in this order: economy, alive, buy time (15 s from round start in round modes, 15 s from each spawn in other modes with a round buy economy, or the shop open), buy zone (8 m from the actor's spawn point), item on sale, carry limits (owned weapon, full armor, per-life `limit`, shared `groupLimit` of 4 grenades), money, delivery.
  - Reasons are listed in `BUY_REASON_TEXT`.
  - Related calls: `buyBlock(id)`, `canBuy(id)`, `buyTimeLeft(id)`, `catalogue(id)` (buy items that can be granted, then the priced weapons of the weapon set, only what `sideAllows(id, item)` lets that actor's side buy: a mode that arms everyone sells no weapons, and `params.attackerBuys` limits the attackers to the listed item kinds), `priceFor(id, item)` (a helmet over a full vest costs only the helmet), `limitReason(id, item)`. The economy rows no longer have `carryOver`, `slots`, `ammoTypes` or `weaponStay` fields. The help panel text comes from `economyPanelLines(row = Economy.preset())` (18n).
- `Economy.grants[kind] = fn(id, item) -> bool`:
  - `armor`, `helmet`, `ammo` and `weapon` are built in.
  - `gadget` (`Gadgets.give`) and `grant` (`Items.grantBuy`) are registered at the end of 13d-economy.js.
- Other API: `Economy.awardWave(team, flawless)` (700 + 100), `setShopOpen(open)`; the ECP06 tier weapons come from `ladderTiers(params)` (13f, MODE-001).
- Classes (ECP04):
  - On spawn, the class perks write `Weapons.statScale` and the class weapons replace the start loadout (the set's melee is kept).
  - Bots use `CAT.classes[id % 6]`.
  - Perks: Stopping and Hardened change hitscan bullet damage (Stopping cancels Hardened); Hardline sets `Meters.streakDiscount`; Tune Up sets `Abilities.rechargeScale`; Scavenger refills ammo on a kill.
  - `Economy.hasPerk(id, key)` exposes flags to other sections: `ghost`, `marathon`, `quiet`, `lastStand`.
  - Field upgrades: `CAT.economy.byId('classes').fieldUpgrades` (G13 `cover`, G22 `trophy`, G23 `ammobox`, G24 `beacon`, A13 `echopulse`). Gadget ones are granted through `Economy.grants.gadget`.
- `Economy.switchHero(id, heroId)` (ECP05) returns `'now'` within 8 m of the last spawn point (in-place kit change), `'next'` otherwise, or `'unknown'`.
- `Economy.usesLoadouts()`: false when `Economy.modeArmsEveryone()` (the `MODE_ARMING_PARAMS` check: params `ladder` or `rotateEvery`, Arms Ladder, Roulette) or the preset has `loadout: 'none'`; `Economy.usesClasses()` = `usesLoadouts()` and the preset loadout is `classes`: `onSpawn` applies class kits only then. The loadout screen (18f) asks the same calls: no class pick (or Classes tab) in a match where `usesClasses()` is false (a hero match), an ability kit stays pickable unless the mode arms everyone. Perks write `Move.staminaScale` (Marathon) and `Move.footstepScale` (Quietstep 0); `Weapons.statScale` stays the perks' stat slot, `Weapons.mutatorScale` the mutators'.

## Loadouts (`Save.data.loadouts`)

`{ classes: { selected, custom: [] }, heroes: { hero }, kits: { kitId: { ability1, ability2, ultimate } } }` is created on first use.

- `Loadouts.classes()`, `selectedClass()`, `selectClass(id)`, `classFor(actorId)`.
- Body model (`Economy.applyBodyModel(id)`, on every spawn and an in-room hero switch): the hero's row of 03s `actorModels`, else the class's (`classModelId`: a custom class wears the first preset class with the same primary weapon class), else the ruleset's own row (RS03, RS08, RS11), else the default body; it calls 07c `ActorModels.set` (docs/api/render.md).
- `saveClass(row)` stores up to 10 custom classes as `class-N`. It returns `null` with `lastError` when the primary or the secondary is not one of `classWeaponOptions(slot)` (the whole roster, `pickupSlotOptions` in 13d: a sidearm as the secondary, any gun that is not a sidearm, melee, tool or map power weapon as the primary), the perks are not one per tier, or the field upgrade is not in the ECP04 list.
- `removeClass(id)`, `hero()`, `setHero(id)`, `kitChoice(kitId)`, `setKitChoice(kitId, slot, abilityId)` (only allowed choices).
- `applyTo(actorId)` runs on `actor.create` for the player. Changes apply at the next spawn; heroes can switch instantly in the spawn room.

## UI (`src/18f-ui-buy.js`)

- `buy` overlay:
  - Shows credits, buy time, next-round money and the loss ladder panel (ECO-001).
  - Items have hotkeys 1-9. Unaffordable items are dimmed and a press shows the reason.
  - B or Esc closes it. It closes itself when buy time ends.
- `loadout` has four tabs: Weapons and gear (the pickup loadout, below), Classes, Hero and Ability kits. `classEditor` uses one cycle per field. Weapon options are `classWeaponOptions(slot)`.
- Pickup loadout (P3-05, P3-07): `Save.data.loadouts.pickup` = `{ melee, primary, secondary, lethal, tactical, device }` (default `DEFAULT_PICKUP_LOADOUT` in 03l: Breaker Maul, Hornet Carbine, Warden Pistol, Frag Charge, Glare Shell, Barrier Deploy; the ability kit `loadout` holds Surge Dash and Rally Cry). `Loadouts.usesPickupLoadout()` is true where the ruleset arms from `fullSet`, the economy is `pickups` and no mode arms everyone; `pickupOptions(slot)`, `setPickup(slot, key)` (checks the slot), `pickedKey(slot)` (falls back to the default), `resetPickup()`, `startKeys(id)` (melee, secondary, primary: the saved loadout for the player, `botSpawnKeys` for a bot: its favourite when it fits a slot, else a gun whose `botPref.range` suits the map, drawn from its own hash stream), `gear(id)` and `restriction(key)` (the reason a weapon is not handed out here, shown in the loadout screen). `Weapons.startKeys` and `Gadgets.loadoutGear` are the hooks 13d fills. Ruleset field `abilities` (`none` | `kit` | `loadout`) decides the ability kit: kit `loadout` matches `{ abilities: 'loadout' }` (RS06, RS07, RS08, RS10); an ultimate needs a meter that pays it, so those four rulesets run the `ultimate` meter.
- Opening:
  - The `buyMenu` action (KeyB, Interface group) opens `buy` in buying matches, else `loadout` when the match has loadouts.
  - Gamepad and touch players use the pause menu rows `Buy menu` and `Loadout`. These rows exist only during matches that use them.

## Limits and notes

- A35 telekinesis pulls on press and punts on release. It cannot hold a prop, because S11's lifter needs the weapon drawn.
- A19 time bend slows actor movement only. In single player and PvE the field covers the whole map, except the user.
- A15 scout drone: the pilot stands still and cannot fire, and the drone ends in an EMP (r `empRadius`, `empSeconds`): enemies in the radius get 'stun' (non-electric, so no HP-005 Shock combo) and `Gadgets.suppress` (shield recharge paused, gadgets and abilities held), enemy devices in the radius switch off (`Gadgets.empDevices`). There is no drone camera yet.
- A16 footprints are drawn only for the local player's tracker. Each enemy of a Tracker Sense holder keeps its own ring of prints (`FOOTPRINT_RING` 40, about 8 s at a base sprint, fewer when sped up); a step quieter than `FOOTPRINT_MIN_LOUDNESS` (a crouch-walk, a Quietstep step) leaves none.
- A17 veil curtain is real smoke (`Smoke.add`): it blocks bot sight and aim assist like a G02 cloud.
- A12 relocator: placing the beacon and teleporting to it each cost a charge.
- Hooks into S10: glide gravity through `Move.gravityScale`, Marathon through `Move.staminaScale`, Quietstep through `Move.footstepScale` (13d sets both perks; the footstep sound reads the loudness).
