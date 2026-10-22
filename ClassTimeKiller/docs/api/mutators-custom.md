# Mutators (S13) and the custom match editor (S18) - public API

Files: `src/03m-data-mutators.js` (catalogue `mutators`, X01..X50), `src/13h-mutators.js` (`Mutators`: framework, rule stage, runtime hooks), `src/18g-ui-custom.js` (`CustomCodec`, `CustomMatch`, screens `custom`, `customPresets`, `customShare`). Tests: groups `mutators` (`20b-test-mutators.js`) and `custom` (`20b-test-custom.js`). Spec: section 14 (MUT-001..004), MOV-001/002, MODE-001.

## Catalogue `mutators`

`id code name effect params set conflicts`.

- `params`: typed parameters `{ key, kind: 'range' | 'choice', min, max, step, default, unit }` or `{ key, kind: 'choice', options, labels, default }`. `source: 'weaponSets'` means the options are the ids of that catalogue, `extra` adds fixed options (X10 adds `random`). A flag mutator has no params and its value is `true`. One param: the value is the number or string itself. Several params (X33, X35): the value is an object keyed by param key. `false` means "not chosen".
- `set`: data operations applied in order in the `mutators` rule stage. `{ field, op, value }` writes a literal, `{ field, op, param, scale, add }` writes `param value x scale + add`. A field is a ruleset field or a dotted path (`respawn.delay`, `fx.radar.mode`). Ops: `set`, `mul` (a missing field counts as 1), `min`, `max`, `mulMove` (multiplies `fields` of the movement preset and writes them to `moveOverrides`), `setMove`, `atLeastMove`, `weaponList` (weapon codes or keys: the match is armed with exactly these weapons), `weaponSet` (a set id, `random` or a list of weapon keys).
- `conflicts`: ids that cannot be combined with the row (symmetric: the check looks at both rows).

## `Mutators` (13h)

| Call | Meaning |
|---|---|
| `row(id)`, `isActive(id)`, `value(id)` | row, and the state in the running match (`value` is `undefined` when off) |
| `defaultValue(row)`, `coerce(row, value)`, `optionsOf(param)` | canonical typed values: numbers clamp to the range and snap to the step, `true` means the default, `undefined` is returned for an invalid value |
| `conflicts(a, b)` | the two ids cannot be combined |
| `add(list, id, value)` | `{ list, added, removed, message }`: adds or replaces one entry of a list of `{ id, value }`; conflicting earlier entries are removed (MUT-002, the last chosen wins) and `message` names both |
| `remove(list, id)`, `resolve(list)` | `resolve` turns ids and `{ id, value }` into the canonical list: unknown ids go to `unknown`, invalid values fall back to the default, conflicts are resolved last-wins, notes are in `messages` |
| `describe(entry)` | `Gravity 50%`, for the pause menu rules panel and the editor |
| `addHook(kind, fn(fx, a, b))` | one hook list per event: `spawn` (a = actor id), `kill` (a = kill event), `damage` (a = damage event), `fire` (a = shot), `step` (a = dt, system order 85). Hooks run only while `rules.fx` has entries; each checks its own flag |
| `suppression(id)` | 0..1 blur strength for the HUD while the actor is suppressed (X44) |
| `sizeScale(id)` | body size factor (growth x diminish) |

Rules build (MOV-001): the `mutators` stage resolves `rules.mutators` (bundle mutators + `setup.mutators`) into a canonical list of `{ id, value }`, creates `rules.fx = {}` and applies every row in list order. A refused combination shows a toast (`toast` event) and keeps the later choice; an unknown id is reported with `Rules.report`. The `handicap` stage sets `rules.handicap.player` from X22 unless the setup names a handicap.

## `rules.fx` (the contract for other sections)

`Game.match.rules.fx` always exists (frozen, possibly empty). Rows: what writes it, who reads it.

| Key | Mutator | Meaning | Read by |
|---|---|---|---|
| `timeScale` | X02 (difficulty may multiply it) | game speed, copied to `Sim.timeScale` (the loop feeds real seconds x it to the 120 Hz steps and allows that many times more steps per frame, so 200% keeps up on a slow frame at twice the sim cost); X27 halves it for 1.5 s | 13h, 19 |
| `damageOut` `damageIn` | X04 X05 | damage factors (Damage attacker scale hook) | 13h |
| `health` `healthScale` `shields` | X06 X36 X07 | spawn pools, applied after S11 resets them | 13h |
| `handicap` `handicapPlayer` | X22 | fills `rules.handicap.player` (unless the setup names one). The damage factor `Game.match.handicap[source]` itself is applied to every opponent hit by 13b, with or without X22 | 13h, 13b |
| `oneHit` `headOnly` `airborneOnly` `noFallDamage` | X08 X28 X38 X20 | damage rules (Damage attacker scale hook) | 13h; bots (MUT-003: oneHit raises dodge priority) |
| `lifesteal` `regen` `growth` `shrinkHit` `lastGift` `tags` `suppression` `triangle` `slowmoKills` `mirror` | X13 X18 X31 X39 X29 X42 X44 X47 X27 X40 | runtime hooks; `triangle` is also on whenever the health preset has `triangle` (HPP07 in RS07/RS08), and a melee finisher is a kill with a melee-class weapon or `kill.kind === 'melee'` (the quick-melee bash) | 13h |
| `weaponList` | X08 X09 X10 | with `rules.weaponSet === 'matchSet'`: 13h fills the reserved weapon set row `matchSet` at `match.setup` (melee first, then two guns as the spawn loadout) and empties it on `match.stop` | 13h, S11, S12 (the pickups of the map follow `weaponSet.weapons`) |
| `infiniteAmmo` | X08 X09 X15 | reserve ammo never runs out | S11 `Weapons.infiniteReserve` |
| `headScale` | X14 | head hit sphere factor | S08 `Hitbox.headScale`; S07 draws the head and visor larger (`style.headScale`, 13h actor style) |
| `noItems` `noPowerups` `volatileAmmo` `superPowerups` | X08 X16 X30 X17 | items | S12: `rules.items === false` (X08, X09, the editor) removes every pickup; `noPowerups` removes powerups; `volatileAmmo`: an ammo pickup explodes when shot; `superPowerups` is the interval, 13h emits `item.grant` |
| `radar` `noHud` | X35 X36 | `{ mode: 'off'|'team'|'all', range }`, hide the HUD | S17 |
| `darkness` | X37 | dense black fog, no sun or map lights, a flashlight per visible living actor | S07 (`matchDarkness`, `darkenFrame`, `updateFlashlights`) |
| `ballistics` | X41 | `{ gravity: 9.8, drag }`: hitscan becomes projectiles | S11: every hitscan pellet flies as a `bullet` (P21) through `Projectiles.spawnBallistic` with that gravity and drag, keeping its mode's damage, falloff and range; pierce, penetration, chain and combo do not apply to it |
| `powers` | X46 | one random ability per life: 13h emits `power.pick` | S12 `Abilities` puts it in the first ability slot |
| `cards` `wildlife` | X48 X50 | cards allowed in versus; number of neutral beasts | progression, PvE |

`mirror` (X40) is also read by S12: every bot plays the player's hero (`Abilities.pickHero`).

X24 and X25 write no field: S10 (`buildMatchMove`, `hasMutator`) reads their ids from `rules.mutators`.

Other ruleset fields the rows write: `gravityScale`, `knockback`, `selfDamage`, `friendlyFire`, `lives`, `respawn.{delay,forced,protect,wave}`, `itemRespawnScale`, `weaponStay`, `dropOnDeath`, `meter`, `health` (X49 `limb`), `moveOverrides` (X03 scales `groundSpeed sprintSpeed tacSprintSpeed airWishCap wallRunSpeed`, X26 sets `extraJumps` and raises `extraJumpVel` to 6), `scoring.kill/tag` (X42), `items`.

## Events

Emitted: `toast { text }` (refused combination), `item.grant { id, item }` (X17: every living actor gets the powerup), `power.pick { id, ability }` (X46, abilities A05..A33), `explosion` (X29, source `lastgift`). Consumed: `match.setup`, `match.stop`, `actor.create`, `actor.spawn`, `kill`, `damage`, `weapon.fire`. Render sources: `tags` (confirm tags), `gifts` (live last gifts, blinking faster before the blast). Render hook: `Render.addActorStyle` (body size).

## Edits to other sections

`Sim.timeScale` (S01), `Hitbox.sizeScale` (heights and radii of every hit volume, head centre included) and `Hitbox.headScale` (S08), `Weapons.mutatorScale` (S11: a second per-actor stat factor next to `statScale`, which stays the perks' slot; 13h writes spread for X44 and reserve for X47 there, `Weapons.modifier` multiplies both), the handicap attacker scale (13b), `Weapons.infiniteReserve` reads `rules.fx.infiniteAmmo` (S11), the `matchSet` row in `weaponSets` (03c), `items` and `editor` fields in the ruleset schema (03e; `editor` is ignored by the build), `RULE_IDENTITY_FIELDS` skips `editor` (13a), `Modes.balanceTeams` keeps a custom split when `setup.balance === false` (13b), `hasMutator` in 10a reads `{ id, value }` lists, `Loop.advance` uses `Sim.timeScale` and scales its step cap with it (19).

## Custom match editor (18g)

Screen `custom` (main menu entry Custom): tabs Mode, Rules, Weapons, Bots, Mutators, Map. Every simple field is a cycle with its own Reset button; the first option of a number or preset is the default of the mode or bundle. The draft is saved on every change in the setting `custom.draft` (JSON). The Rules tab starts the 12 rule bundles RS01..RS12 with one click (the draft's mode, map, bots and limits with the bundle's own presets). The Map tab also opens the generated map screen `mapgen` (docs/api/mapgen.md). The Mutators tab shows all 50 with a switch and typed controls; switching one on that conflicts with another turns the other off and shows a toast. Footer: Start match, Presets (`customPresets`), Share code (`customShare`), Reset all. Everything uses `Ui` builders: keyboard, gamepad and touch navigable; text fields keep their arrow keys.

### `CustomMatch` (pure model, no DOM)

- `defaults()` -> the draft: `name mode map ('' = random) bundle ('' = mode default) move health economy weaponSet ('' = from the bundle) weaponList (null or weapon keys) items friendlyFire lives respawnDelay botCount allies scoreLimit timeLimit roundWins (-1 = the mode's own default) difficulty difficultySliders personality mutators`. `difficultySliders` = `{ field: value }` of the DIF-002 sliders moved away from the chosen preset (Bots tab, `Ui.difficultyRows`; validated: a field with a slider, a number inside its `DIFFICULTY_SLIDERS` range; carried by share codes; "Reset sliders to the difficulty" clears it).
- `validate(raw)` -> `{ draft, errors }` (unknown or invalid fields keep their default and are listed). `load()` / `save(draft)` use `custom.draft`.
- `setup(draft, seed, withPlayer)` -> the `Game.start` setup: `mode map seed ruleset (bundle id, or a custom ruleset object when anything is overridden) mutators bots modeOptions difficulty player balance`; `difficulty` is the preset id, or `{ preset, ...difficultySliders }` when sliders were moved (`difficultyOf(draft)`). The Weapons tab list becomes the last `weaponset` mutator; `setWeaponList(draft, list)` and `turnOnMutator(draft, id)` resolve its conflicts inside the draft (One-Shot and Rocket Pit are turned off when the list is switched on, and the list is turned off when one of them is switched on; both return the notice the editor shows as a toast), and loading or importing a draft settles them the same way. With "bots on your team" set, `setup.balance = false` keeps the split.
- `bundleStart(draft, bundleId, seed, withPlayer)` -> setup of a one-click bundle start; `start(setup)` closes the menus and calls `Game.start` (call it inside the click handler so pointer lock can be requested).
- Presets (MOV-002, max 50, `Rules.custom`): `saveAs(draft, name, id?)` stores the ruleset fields plus `editor` (the whole draft), `fromPreset(row)` loads one (a preset saved without `editor` loads the fields the editor knows).

### Share code (MUT-004)

`CTK1-<8 hex checksum>-<payload>`: payload = base64url of an LZ77-compressed UTF-8 JSON of only the fields that differ from the defaults. The checksum is the FNV-1a hash of the payload text. `CustomMatch.encode(draft)` -> text; `CustomMatch.decode(text)` -> `{ draft }` or `{ error }` with a message for the player (not a code, newer or older version, damaged, too long, unreadable, invalid settings). The framing is shared: `CustomCodec.packCode(format, object)` / `unpackCode(format, text)` with a format from `shareCodeFormat(prefix, version, oldest, maxChars, maxBytes, noun)` (match codes `MATCH_CODE_FORMAT`, map editor codes `MAPEDIT_CODE_FORMAT` in 18i). Whitespace in a pasted code is ignored; every field is validated (unknown ids, ranges, maps that do not serve the mode, weapon keys, mutator values). No network.

## Known limits

X14 head size and X31/X39 body size change the hit volumes and are drawn through `Render.addActorStyle` (`scale`, `headScale`). X17 (`item.grant`), X30, X37, X40, X41 and X46 (`power.pick`) are read by S07/S11/S12 as listed above. X35 and X36 are read by the HUD (17f `HudExtra.readRules`, 17a `Hud.noHud`; tested end to end in the `hudui` group). X48 (progression) and X50 (PvE) still only set their `rules.fx` flag: those sections have to read them. X47 refills health and ammo on melee kills and armor on thermal kills; "finisher" kills of downed actors follow when the downed state is exposed to the kill event. X29 uses a 100 damage, 5 m, 3 s grenade until the gadget rows expose the real numbers. X22 handicaps the player; bots take their handicap from `setup.bots[].handicap`. The Bots tab picks one personality for every bot or "Mixed" (the bot section chooses); a custom mix of several personalities is not offered.
