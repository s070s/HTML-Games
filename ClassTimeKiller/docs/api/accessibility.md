# HUD extras, settings completion and accessibility (S17 17f, S18 18k-18n) - public API

Files: `src/17f-hud-extra.js` (minimap, compass, awareness meters, bark lines, scope info, flash and suppression effects), `18k-ui-crosshair.js` (crosshair editor, view effects and view settings), `18l-ui-settings.js` (group headings, reset all, save flush, assist sliders), `18m-ui-access.js` (the shared accessibility settings and the Accessibility tab), `18n-ui-help.js` (Help, rules panel, economy panel, tips). Tests: groups `uiacc` (`20b-test-uiacc.js`) and `settings` (`20b-test-settings.js`). Debug: `__CTK.settings`, `__CTK.access`, `__CTK.viewFx`, `__CTK.crosshair`.

## Settings

One source per setting. Settings the earlier sections read are filled through hooks (the owner exposes a field, the later section writes it), so no section calls a later one.

| Key | Default | Defined in | Read by, effect |
|---|---|---|---|
| `accessibility.colorBlind` | off | 18m | 17a (`Hud.paletteId`, `Hud.colors`: bars, markers, pings, team colours), 18m (`Render.teamPalette`: the bodies use the palette teams) |
| `accessibility.highContrast` | off | 18m | 18m -> `Render.config.highContrast`: enemies get a thick bright outline (07c, instance float 14, thickness x2, colour `HIGHLIGHT_COLOR`) even when `video.outlines` is off |
| `accessibility.reduceMotion` | auto | 18m | 17a `Hud.reduceMotion()` (pulses, hit tint, flash strength), 18k `ViewFx.applyMotion` -> `Render.motion.*` = 0 |
| `accessibility.photosensitive` | off | 18m | 17a `Hud.flashColor/flashAlpha`: every full-screen flash is a dark overlay at most 50% strong, never white |
| `accessibility.particles` | 100 | 18m | 18m -> `Render.config.particleScale` (07d `Fx.burst` multiplies the particle count, still capped by the quality tier) |
| `video.shake` `video.fovKick` | 100 | 18k | `ViewFx` through `Render.motion.shake/fovKick` (x0 under reduce motion) |
| `video.headBob` | 0 | 07a | slider 0-100; 07e multiplies by `Render.motion.bob` (0 under reduce motion) |
| `video.viewmodelX/Y/Z` | 0 | 18k | cm, +-10 -> `Render.config.viewmodelOffset` (metres); 07e `poseWeapon` adds it, fading out while aiming so sights stay centred |
| `hud.element.minimap` `compass` `awareness` `barks` `movement` | on, off, on, on, on | 17f via `hudAddElement` | one toggle per element, like every HUD element. `barks` is in the Accessibility tab |
| `controls.toggle.<id>` | hold | 05a | one per row with `toggle: true`: `crouch sprint walk prone fire alt use scoreboard` (hold or toggle, ACC-004), plus `controls.toggle.sprintPad` (sprint on a controller, default toggle) |
| `gameplay.tips` | on | 18n | `Tips.show` at match start (first 3 matches) |
| `assist.enabled`, `assist.gameSpeed`, `assist.aimAssist`, `assist.parry`, `assist.playerDamage`, `assist.enemyDamage` | off, 1, 0, 0.3, 1, 1 | 18l | the assist fields that have a reader (range copied from `DIFFICULTY_SLIDERS`); `DifficultyAssist.apply(setup)` (rebuilds `setup.difficulty` from `setup.baseDifficulty`, the choice before any assist, so Restart and Play again drop assists switched off since) |

Existing and unchanged: `ui.scale` (18a, 75-150%), `audio.master/sfx/ui/announcer/music` (separate volumes), `audio.mono`, `hud.captionSize/captionBackground`, `hud.element.captions`, `hud.element.soundRing`, `hud.teamShapes`, `controls.pad.aimAssist`, `controls.touch.aimAssist`, `controls.touch.autoFire`. `hud.colorBlind` and `hud.reduceMotion` no longer exist (replaced by the `accessibility.*` keys; old saves simply ignore them).

## Settings screen (18b + 18l)

- `Ui.settingGroup(key)` (filled by 18l from `SETTING_GROUPS`, first matching prefix wins) names the heading of a row; rows with the same heading are grouped in first-seen order. `''` = no heading.
- `Ui.settingsExtras[category]` rows go above the generated rows, `Ui.settingsExtras[category + ':after']` below. The Accessibility tab mirrors hold/toggle, aim assist and volume rows from their home tabs (same settings, never a second copy).
- `Ui.settingsFooter`: `fn(refresh) -> button` pushed by 18l: "Reset all settings" (confirm, then `Settings.resetKeys(keys)` drops the saved value of every editable key so it returns to its default and announces each once; bindings and progress stay).
- A save is flushed on `pagehide`, when the tab hides and on pause (`flushSave`), on top of the 500 ms debounce; it writes only when `Save.dirty` (an unwritten change). When the tab shows again, or on the `storage` event and `pageshow`, a newer save from another tab is adopted while this tab has no change of its own (`adoptOtherTabSave`). The "Back up or restore save" button is the footer under every tab (`docs/api/input-ui.md`).
- Wiring check: the `settings` test walks every `Settings.define` key. Written = it has a control on its tab (or is one of the three named internal keys `video.autoQuality`, `difficulty.tierShift`, `custom.draft`); read = `Settings.readCounts` after `applyAll`, a match and the few lazy read paths (held grenade, speech voice, custom draft, adaptive tier). No one-ended settings were found.
- `valueControl(definition, value, apply)` (18b) is the one control builder (cycle, toggle, slider) used by the settings rows, the crosshair editor and the assist rows.

## Assist sliders (ACC-007, DIF-002)

`ASSIST_ROWS` (18l) has one row per `DIFFICULTY_SLIDERS` field with two flags. `live`: a section reads `rules.botSkill.<field>` (reactionScale, aimErrorScale, aggression, attackers by the bots section, gameSpeed, aimAssist below); only live fields get a slider anywhere. `assist`: the player may keep it as a personal assist (the Gameplay tab, setting `assist.<field>`). Every field is live now: the PvE section (14h-14j) reads playerDamage (hits PvE enemies deal to you), enemyDamage (hits you deal to them), parry, projectileSpeed, resourceYield, lives and checkpointHeal. `gameSpeed`, `aimAssist`, `parry`, `playerDamage` and `enemyDamage` are also personal assists. A future field without a reader gets `live: false` and no slider.

Switched on (`assist.enabled`), `Game.start` (through `Game.setupHooks`, so every start path: Play, Quick Match, Career, Custom, Generated Map, Restart) turns `setup.difficulty` into `{ preset, <the assists the player moved away from neutral> }`: the preset keeps every other field (tiers, aggression, reaction), so picking Nightmare with a slower game still plays like Nightmare. The bots section clamps the object into `rules.botSkill`.

- Game speed rides on `rules.fx.timeScale` (a `difficulty` rule-stage modifier in 18l multiplies it by `botSkill.gameSpeed`), the field of the Game Speed mutator: 13h resets `Sim.timeScale` from it every step, so the speed survives mutators and kill slow-mo comes back to it.
- Aim assist is a floor for the touch and gamepad strength: `Input.assistStrength()` is `max(device slider, rules.botSkill.aimAssist) / 100` (preset value -1 = no floor); never for the mouse (INP-008).
- Using assists costs nothing: nothing stores or checks them for progression.
- `Ui.difficultyRows(container, values, onChange)` builds one slider row per live field for a plain `{ field: value }` object (the custom match editor mounts it on its Bots tab, `docs/api/mutators-custom.md`).

## HUD extras (17f)

All draw through the pen into the existing layers; hideable elements go through `hudAddElement(row)` (17a: pushes into `HUD_ELEMENTS`, defines the setting).

- **Minimap** (element `minimap`, top left, 116 design px, 86 compact, range 40 m, player heading up): your triangle, teammates (team shape and colour), active objectives (clamped to the edge), your side's pings. Enemies appear only (UI-006) as a red dot for 2 s after a loud shot (`sound` event `kind: 'shot'` with `radius >= HUD_MAP_SHOT_NOISE` 20 m: suppressed weapons stay off), while a `reveal` status is on them (seer powerup, drone, pulse), or by the motion tracker. A jammer on you (`Gadgets.jammed`) replaces the content by moving bars and the word JAMMED.
- **Motion tracker** (X35, `rules.fx.radar = { mode, range }`, read at `match.start` by `HudExtra.readRules`): shows enemies that move faster than 1.5 m/s and are not crouched or prone, inside `range` (default 25 m; the map scale grows with it). `team` = within range of you or any living teammate (they share the tracker; in free-for-all only you), `all` = within range of you only, `off` = none.
- **Compass** (element `compass`, off by default, top centre under the header): N NE E SE S SW W NW and the objective bearings; north is +Z, east is -X.
- **Awareness meter** (UI-014, element `awareness`, only in PvE matches (`rules.teams === 1`) and stealth modes (`rules.params.cloakWhenStill`), never in free-for-all or team arena play): above the head of a bot that is aware of you (`BotSense.awareness[pair(bot, you)]`, >= 0.02, within 45 m, at most 10, never through walls: `World.lineClear`), a bar filled by the meter, white -> amber -> red, and `!` at 100%.
- **Movement meters** (element `movement`, under the crosshair; drawers `movement` on the main layer and `breath` on the back layer): from `Move.meters(id, out)`, one row per resource that is below full: breath under water (AIR, then LOW AIR blinking, then DROWNING, with the screen edges darkening, steady under reduce motion), sprint STAMINA, GLIDE time, DASH and tactical SPRINT charge pips.
- **Bark lines** (element `barks`, under the minimap, newest 4, 6 s): `bark` events of your side and enemy kill taunts, with the speaker's name in the team colour. They are the subtitles of the radio blips (ACC-002).
- **Scope info** (H04, under element `crosshair`): while scoped (the scope overlay is showing) and `Abilities.passiveFlag(you, 'scopeInfo')`, the enemy under the crosshair (not behind a wall) shows its name and health bar.
- **Flash** (`Gadgets.blindAmount(you)`): a full-screen overlay. A blind starts as a white flash only when the 3-per-second cap (`Hud.flashAllowed`) allows it and photosensitivity is off; otherwise it fades in dark. Strength goes through `Hud.flashAlpha` (reduce motion halves it, photosensitivity caps it at 50%).
- **Suppression** (X44, `Mutators.suppression(you)`): quads cannot blur, so the screen edges fill with grey haze bands (steady under reduce motion).
- **Hardcore HUD** (X36, `rules.fx.noHud`): `Hud.noHud` hides every drawer except the elements in `HUD_HARDCORE_KEEP` (crosshair, hit markers, respawn text, captions, sound ring) and drawers registered with `keepInHardcore` (flash, suppression): `Hud.register(layer, id, element, draw, keepInHardcore)`.
- **Captions and the sound ring**: S06 is the only emitter of `caption` events (also while the audio context is blocked, because its queue captions before it starts voices; the radio blip of a `bark` gives the voice disc). The HUD only draws them. Announcer text (`announce`) is also added as a caption while captions are on.

## View effects (18k)

`Render.viewEffect(camera, seconds)` (07e calls it after the camera followed the player; not during killcam or spectate) is filled with `ViewFx.apply`: trauma shake (yaw, pitch and roll of at most 2.6 / 2 degrees, decays in 0.6 s) from nearby explosions (up to 3 blast radii), hits on you, landings above 6 m/s; FOV kick (decays at 24 deg/s, max 12) from dashes and impulses. `Render.motion = { bob, shake, fovKick }` (0..1) carries reduce motion and the sliders to 07e. `ViewFx.addTrauma(amount)` / `addKick(degrees)` are the public triggers.

## Crosshair editor (18k, UI-004)

Screen `crosshair` (passthrough): a panel with the weapon choice ("All weapons" = the default settings, or one weapon whose override is edited through `Hud.setCrosshairOverride`), the style, size, gap, thickness, outline, colour, centre dot, dynamic spread, scope overlay and a preview spread slider; Remove override, Reset (default and every override), Done. The preview is the HudBatch layer `hud.preview` (order 50) drawn only while the editor is open, with the same `hudDrawCrosshairShape` as the HUD over four contrast bands. Reached from Settings > HUD ("Crosshair editor") and the pause menu. `CrosshairEditor.current()` returns the effective fields for the target.

## Accessibility pieces (18m)

- Colour-blind: `HUD_PALETTES` (17a) hold the colours (protanopia / deuteranopia: blue and orange, tritanopia: teal and pink, teal lightened so the teams also differ in brightness); `Render.teamPalette` points at `Hud.colors.teams` while a palette is on, 07c `actorBaseColor` reads it. Team shapes (`hud.teamShapes`, on) differ per team.
- Hold or toggle: 05a rows with `toggle: true`. `Input.releasesToggle(index)`: a toggled event action that is on (the scoreboard overlay) still hears its own second press while a screen is open; a toggled-off event row emits its release (`input.action { down: false }`) when it is switched off.
- Text: all UI text is at least 14 px at 100% UI scale (`.ui-tag` 0.875em, `.ui-result` 14 px); HUD text is never below 14 px at 100% HUD scale (`Hud.textFloor`; `hudFloorTextSize` is the one ACC-008 floor, applied when text is drawn and when it is measured: HUD drawers measure through `HudPen.measure` / `measureAt`, not `HudBatch.measure`). WCAG contrast of every HUD text colour against the HUD panel and of the menu colours against the menu panel is >= 4.5 (tested, also for the palettes).
- `Access.holdKeys()` = the hold or toggle keys the Accessibility tab mirrors, built from `TOGGLE_SETTINGS` and `PAD_TOGGLE_SETTINGS` (05a). `Access.mirroredCount()` (rows mirrored from other tabs) exists only in the tests.

## Help, rules panel, economy panel, tips (18n)

- `help`: a four-step start guide, how-to lines, current controls (`.ui-result` #1), the self-test (`.ui-result` #2).
- `rules` (pause menu row "Rules", UI-002): `rulesPanelLines(rules)` -> `{ goal, setup }` (mode, the goal from `modeGoalLines(rules)`: a `MODE_GOAL_TEXT` line whose `{param}` slots are filled from `rules.params` (roulette: `{rotateEvery}`), else the objective and score text from `OBJECTIVE_TEXT` / `SCORE_BY_TEXT`, limits, ruleset, health / movement / weapon set names, respawn, friendly fire, self damage, knockback, gravity, pickups), `mutatorLines(rules)` (`Mutators.describe` per entry), `difficultyLine(rules)`.
- `economy` (pause menu row "Economy", ECO-001): `economyPanelLines(row = Economy.preset())` -> `{ name, lines }` from the `ECONOMY_LINES` table (a line per applicable economy row field) plus `buyMenuText(row)`: where the buy menu (or the loadout screen) opens for the device in use, a key on a keyboard, the pause menu on a pad or phone. A new economy needs a row, not code.
- The pause rows are (re)added at every `match.start` (a test run may empty `Ui.pauseEntries`): `setPauseEntry` of 18f.
- Tips: `Tips.show()` at `match.start` (not headless): one toast in each of the first 3 matches (`Save.data.tips.matches`), text from the bindings of the device in use (`hudBoundLabel(action, device)` gives the first bound key, `''` when none); off with `gameplay.tips`. The iPhone tips (`Save.data.tips.silentSwitch`, `tips.homeScreen`) are shown once by the audio section and `18p`, `docs/api/input-ui.md`.

## Events

Consumes `sound bark announce caption explosion damage move.land move.dash impulse match.start match.stop setting boot game.pause`. Emits nothing new: when the system reduce-motion preference changes, 17a emits `setting` `'accessibility.reduceMotion'` so the HUD, the menus (18m) and the view effects (18k) re-read it.

## Contract requests

None open: the custom editor mounts `Ui.difficultyRows` (M3) and every `ASSIST_ROWS` field has its reader.
