# Input (S05) and UI shell (S18) - public API

Files: `05a-input.js` (action table, bindings, keyboard + mouse, latch, aim assist, pointer lock, pause rules), `05b-input-touch.js` (touch controls, layout editor model, gyro), `05c-input-gamepad.js` (gamepad), `18a-ui.js` (screen stack, focus navigation, toasts, control builders), `18b-ui-menus.js` (screens), `18c-ui-perf.js` (performance overlay). Tests: groups `input` and `ui`.

## What the input layer writes (every frame, Loop `input` phase)

For the local player (`Game.playerId`), only while `Game.isRunning()` (playing and not paused), before the sim steps:

| Field | Value |
|---|---|
| `Actors.moveX` / `moveZ` | -1..1, +1 = strafe right / forward; keyboard + touch stick + pad stick summed, length clamped to 1 |
| `Actors.aimYaw` / `aimPitch` | desired view angles in radians. Yaw increases to the LEFT (DATA-002), so looking right lowers it. Pitch clamped to +-89 deg. The systems copy these into `yaw`/`pitch` |
| `Actors.buttons` | `BTN` bits: held actions plus latched presses (below) |
| `Actors.slotRequest` | 1-9 for one sim step after a slot key, else 0 |

`Input.aim` `{ yaw, pitch }` holds the same angles at full precision, updated every frame before the sim steps: the renderer may use it for the local player's camera so look latency stays under one frame even when no sim step runs that frame (INP latency check). `Input.setAim(yaw, pitch)` turns it from the sim (S08 teleporter exits for `Game.playerId`, MOV-019).

View angles resynchronise from `Actors.yaw/pitch` whenever `Actors.spawnCount[id]` changes (a mode that respawns the player must set `Actors.yaw/pitch` and bump `spawnCount`).

### Latch and buffer (INP-009)

- A press is kept in `buttons` until a sim step has consumed it (`Sim.tick` changed), so a tap shorter than a frame is never lost. A second tap right after a first one waits (at most 0.10 s) for a step that sees the bit low, so every tap makes its own `Actors.pressed` edge.
- `Input.buffered(actionId)` is true when the action was pressed within 0.10 s of **sim time** (12 ticks); `Input.consumeBuffered(actionId)` clears it. Move (jump before landing) and Weapons (fire during a cooldown) call these for the 0.10 s buffer. Only rows with `buffered: true` (`jump`, `fire`) keep a press time; `buffered()` is false for every other action. Press times are cleared by `Input.clearAll()` (new match, pause, rebinding), so a press never outlives a restart.
- Wheel notches are queued: one weapon switch per notch even when several arrive in one frame.

## Action table

`Input.actions` (= `ACTION_ROWS`) is the single table. Row: `{ id, label, group, button | axis+sign | slot | event, toggle?, buffered?, always?, kbm: [binding, binding], pad: binding }`.

- `button`: `BTN` bit written to `Actors.buttons`. `axis`/`sign`: digital move key. `slot`: weapon slot request. `event`: no sim effect; emits `input.action`.
- `toggle: true` rows (crouch, sprint, walk, prone, fire, alt/aim, use, scoreboard) have a setting `controls.toggle.<id>` = `hold` | `toggle` (INP-002). Deviation, to be decided by the lead: the setting is one per action, not one per movement preset as INP-002 words it; it can be keyed by preset once S10 exposes the movement preset.
- `always: true` rows (perfHud, botDebug) also work while a menu is open.
- Defaults are INP-003 (WASD, Space, Ctrl, Shift, LMB fire, RMB alt/aim, R, E, Q, F, X, G, V, C, Z, 1-9, wheel, Tab, Esc, T, F10, F9) plus pad defaults on the standard mapping (RT fire, LT aim, A jump, B crouch, L3 sprint, X reload, Y next weapon, LB grenade, RB ability 1, d-pad left ability 2, d-pad up ultimate, d-pad right ping, d-pad down use, R3 melee, View scoreboard, Menu pause). Every one of the 16 buttons is taken, so a second layer uses chords: while View is held, a button with a `Pad:8+<button>` binding uses it instead (View + B walk, View + X gadget, View + Y comm, View + A heal); the chord press lets go of the scoreboard. `Input.bindingLabel('Pad:8+2')` = "View + X".
- M3 rows: `grenadeNext` (Next grenade type, N, touch `TYPE`; no pad default) writes `BTN.CYCLE_GRENADE` (`1 << 19`, S01); 12c `Gadgets.cycleGrenade(id)` makes the next carried grenade type the thrown one (bots do not press it). The touch `TYPE` button has `need: 'grenadeCycle'`: `TouchInput.needs.grenadeCycle` (12c) is true while the player carries two thrown types or more (`Gadgets.grenadeTypes`), and `Gadgets.syncCycleButton` re-applies the layout from the gadget step when that answer changes (never per frame otherwise). `cards` (Use a card, Y, pad Home `Pad:16`, touch `CARD`) is an event row: 18j opens the `cardUse` screen while the match has active cards (`CardRun.slots`), else a toast.
- Read state: `Input.isHeld(id)` (effective state after hold/toggle), `Input.effective[Input.actionIndex[id]]`.

### Bindings

Binding strings: `Key:KeyW` (KeyboardEvent.code), `Mouse:0`, `Wheel:up` / `Wheel:down`, `Pad:7` (standard mapping index). `''` = unbound. Each action has three slots: keyboard/mouse A, keyboard/mouse B, pad.

| Call | Effect |
|---|---|
| `Input.getBinding(id, slot)` | binding string |
| `Input.setBinding(id, slot, binding)` | returns the ids of other actions now sharing it (conflict flag), or `null` if the slot cannot take that binding (pad button on a keyboard slot) |
| `Input.resetBindings([id])` | defaults for one action or all |
| `Input.conflictsOf(id)`, `Input.allConflicts()` | conflict lookup |
| `Input.bindingLabel(binding)` | display name; pad glyphs follow `Input.padStyle` (`letters`, `shapes`, `generic`) |
| `Input.captureNext(device, cb)` / `cancelCapture()` | rebinding: next press of `'kbm'` or `'pad'` goes to `cb(binding)`; Esc gives `cb(null)` (cancel), Backspace gives `cb('')` (clear) |

Saved in `Save.data.bindings[actionId] = [slot0, slot1, slot2]`, only for actions that differ from the default.

## Devices

- `Input.device`: `'kbm' | 'touch' | 'gamepad'`, last used. Emits `input.device` `{ device }` on change. Aim assist and assists in later sections key off it.
- Keyboard + mouse: pointer lock on a click while a match runs, `unadjustedMovement` when `controls.rawMouse` and supported (silent fallback to a normal lock), no OS acceleration applied by the game. Sensitivity `controls.mouseSensitivity` (0.05 deg per count at 1.0), `Input.cmPer360(sensitivity, dpi)` for the display, `controls.invertY`, `controls.adsMultiplier` while the aim action is held.
- Touch: see below. Gamepad: see below.
- `Input.rumble(strength 0..1, milliseconds)`: strength is clamped to 0..1 and negative durations to 0 (a silent rumble does nothing); pad `vibrationActuator` (a rejected effect is swallowed) or `navigator.vibrate` with the duration scaled by strength; respects `controls.vibration`. Sources (INP-007): `damage` to the local player (strength = amount / 100, 160 ms), an `explosion` within 2x its radius of the player (fading with distance, 240 ms) and the player's own `weapon.fire` with a heavy, explosive, power, shotgun or sniper class (0.35, 70 ms); numbers in `RUMBLE` (05a).

### Pause rules (PLT-006)

`Game.pause(reason)` on: window blur (`'blur'`), tab hidden (`'hidden'`), pointer lock lost during play (`'pointerlock'`), pad unplugged while it was the active device (`'controller'`), the pause action (`'menu'`). Every held, latched and queued input is dropped on pause. After Esc the browser refuses a re-lock for about 1 s: `Input.requestResume()` asks for the lock first and resumes when granted; if refused it emits `input.relock` (the UI closes its menus) and shows "Click to resume"; the next click locks and resumes. A running match without a lock shows "Click to play". `Input.resumeBlocked = fn() -> true` refuses Resume (S07 fills it with `Render.lost`: after a graphics context loss, `'graphics'` pause, the game resumes by itself on restore, PLT-005).

### Aim assist (INP-008)

Only when `Input.device` is `touch` or `gamepad`, never for the mouse. A later section fills `Input.aimAssistTarget = fn(actorId, out) -> bool`: set `out.x/y/z` to the nearest valid hitbox point of a visible enemy, return false for none (cloaked). Sections that only need to refuse a found point push `fn(actorId, point) -> bool` to `Input.aimAssistFilters` instead of wrapping the hook (S12 refuses points behind smoke); `Input.findAssistTarget(actorId, out)` runs the hook and then every filter. Inside a 3 degree cone the look is slowed by 40% x strength; magnetism pulls toward the point at up to 1.5 deg/s x strength while the player looks, fires or aims, never overshooting (no snap). Strength settings `controls.pad.aimAssist` (default 60) and `controls.touch.aimAssist` (default 70); `Input.assistStrength()` raises it to the difficulty floor `Game.match.rules.botSkill.aimAssist` (0-100, -1 = none) and is 0 for the mouse. `Input.isToggleMode(actionId)` tells whether a hold action is set to toggle (ACC-004); `Input.resetToggle(actionId)` puts a toggled action back to off when its effect ended by other means (the scoreboard closed with its Close button). `Input.assist` `{ active, slowdown, error }` reports the last frame.

Touch auto-fire: `Input.autoFire` (setting `controls.touch.autoFire`, default on). Each frame the aim assist search (`Input.findAssistTarget`, the same single search aim assist uses, run for auto-fire even with the touch slider at 0) sets `Input.autoFireTarget` when the crosshair is within the target's torso width (`atan(TORSO_RADIUS / distance)`); the input layer then presses fire (touch device only). Cloaked enemies and points behind smoke are never targets (the hook and its filters).
- Strength: touch `controls.touch.aimAssist`, gamepad `controls.pad.aimAssist` (never the mouse); `Input.aimAssistOverride = fn() -> 0..100 | -1` (S11 fills it from the match's difficulty, `rules.botSkill.aimAssist`) replaces the device setting, -1 keeps it. `Input.aimAssistFilters` (list of `fn(id, point) -> bool`) can refuse a found point (S12: smoke).

## Touch (05b)

`TouchInput` builds a DOM layer in `#overlay`: floating left stick (touch left of 42% of the width, or the dashed hint), look zone on the rest, one round button per row of `TOUCH_CONTROLS` (fire, aim, jump, crouch, reload, swap, grenade, heal, ability 1/2, ultimate, ping, scoreboard, pause, optional left fire, use, melee, gadget, comm, grenade type, card). A row with `need` shows only while `TouchInput.needs[need]()` is true: USE while the mode row has `useButton` (plant, defuse, arm, loot swap, chamber buttons: M08, M13, M20, M27, M31) or any fn in `TouchInput.useNeeds` is true (S11: revive in a team match with downed; S10: skimmer board on large maps), COMM once the comm wheel (17g) fills `TouchInput.needs.comm`; a need with no function reads the match flag `TouchInput.flags[need]`, set by `TouchInput.setFlag(name, on)` (the card button: 18j sets `cards` on `match.start` when the match has active cards, off on `match.stop`); the grenade type button reads `TouchInput.needs.grenadeCycle` (12c: two carried thrown types or more). Push past 90% sprints (released under 80%), unless `TouchInput.stickSprints()` is false (S10: Tactical, where the sprint button walks). Look: `controls.touch.sensitivity`, `controls.touch.acceleration`; tap-to-fire `controls.touch.tapToFire`; gyro `controls.touch.gyro` (`off|aiming|always`, iOS permission requested from the setting change or the next touch). Fingers are tracked by pointer id in a pool of 10 slots. Four fingers down within 300 ms toggle the performance overlay. Deviation from ARC-040: the bot debug view has no touch gesture; on touch it is `Options > Developer > Bot debug view`. Gyro: a positive `rotationRate.beta` turns the view up, so pitch is the negated beta (yaw is the negated gamma). The layer is shown while a match runs on a touch device (`controls.touch.show`: `auto|on|off`).

Layout (INP-005): presets `standard`, `compact`, `mirrored` (setting `controls.touch.layout`). `TouchInput.layoutOf/getProperty(id, key)`, `setProperty(id, 'scale' 0.5-2 | 'opacity' 0.2-1 | 'hidden' | 'position' {x,y})`, `resetLayout()`, `setEditing(bool)`, `select(id)`, `onSelect` callback. A control can never leave the screen. Saved in `Save.data.touchLayouts[presetId][controlId] = { x, y, scale, opacity, hidden }`.

## Gamepad (05c)

`PadInput`: standard mapping, polled once per frame only while a pad is connected. Settings `controls.pad.innerDeadzone` (0.1), `outerDeadzone` (0.95), `curve` (`linear|classic|dynamic`), `sensX`, `sensY`, `invertY`, `aimAssist`. Look speed 200 deg/s at full deflection x sensitivity. Menu navigation (d-pad and left stick with key repeat, A accept, B/Menu back, bumpers prev/next) is emitted as `input.menu` `{ command }` while a screen is open. Hot-plug updates `Input.padStyle`; an unplug mid-match pauses.

## Events

| Event | Payload | Emitter | Listener |
|---|---|---|---|
| `input.action` | `{ action, down }` for `event` rows (scoreboard, pause, comm, perfHud, botDebug) | Input | UI (perf overlay); HUD for scoreboard/comm |
| `input.menu` | `{ command }` up/down/left/right/next/prev/accept/back | Input (pad) | Ui |
| `input.device` | `{ device }` | Input | any |
| `input.relock` | null | Input | Ui (closes menus) |
| `ui.click` | `{ kind }` accept/back/toggle/move | Ui | audio (later) |
| `ui.range` | null | main menu Range | 18j: opens the range screen when registered, else starts the Firing Range mode |
| `ui.quickMatch` | null | main menu | S13 mode code: **start the match synchronously inside the handler** so pointer lock can be requested in the click |
| `toast` | `{ text }` | any | Ui |

Consumed: `boot`, `ready`, `setting`, `toast`, `game.pause`, `game.resume`, `match.start/stop/end`.

## Settings keys

Controls category: `controls.mouseSensitivity`, `mouseDpi`, `rawMouse`, `invertY`, `adsMultiplier`, `vibration`, `toggle.crouch|sprint|walk|prone|fire|alt|use|scoreboard` (a toggled event row such as the scoreboard emits its release when it is switched off, and `Input.releasesToggle` lets its second press through while a screen is open); `controls.pad.*` and `controls.touch.*` as above. UI: `ui.scale` (accessibility), `developer.perfHud`, `developer.botDebug`. Every key is read by its owner; the settings screen is generated from `Settings.definitions` (options, booleans and numbers with min/max become controls; other values stay internal).

## UI shell (18)

- `Ui.register(name, { build(root, params), onOpen, onClose, onBack, noBack, passthrough, overlay })`; `Ui.open(name, params)`, `Ui.back()`, `Ui.replace`, `Ui.closeAll()`, `Ui.current()`, `Ui.isOpen(name)`. Opening an unregistered name shows the toast "Coming soon". A screen whose `build` throws is logged and removed. `Input.uiOpen` is true while any screen is open (game actions are ignored).
- Navigation: keyboard arrows / Tab / Esc, gamepad via `input.menu`, touch taps. Inside a text field or textarea (`isTextField`, 05a) only Tab and Esc navigate; every other key belongs to the field (game bindings and the map editor keys ignore it too). Left/right adjust sliders and cycles. Focus is always drawn.
- `Ui.rebuild(container, build)` refills a container and keeps the focus on the control at the same position (screens that redraw themselves after a change). Settings screen hooks (`Ui.settingGroup`, `Ui.settingsFooter`, `Ui.settingsExtras[category + ':after']`), the Help screen (18n), crosshair editor, rules and economy panels: `docs/api/accessibility.md`.
- Builders: `Ui.button(text, onClick, className)`, `Ui.row(label, control)`, `Ui.cycle(options, labels, value, onChange)`, `Ui.toggle`, `Ui.slider({min,max,step,value,format}, onChange)`, `Ui.confirm({ title, text, yes, no, onYes })` (No, Esc and Back only close it), `Ui.toast(text)`.
- Screens now: `main` (Quick Match, Career, Play, Solo, Custom, Range, Generated map, Map editor, Settings, Help: entries whose screen is not registered are disabled "coming soon"; the list scrolls; on a short screen such as a landscape phone, under 520 px high, the buttons wrap into columns at least 180 px wide so every entry fits), `solo` (18o: Siege Waves, Endless Hold, Test Chambers with one difficulty choice), `guardian` (18o: the Guardian Plate choice), `pause`, `settings`, `bindings`, `touchLayout`, `help`, `confirm`, `saveTransfer` (Settings > Developer > Export or import save, 18l: Export fills a text box with `Save.exportText()`, Download file saves it as a Blob link, Load file reads one into the box, Import confirms, runs `Save.importText` and restarts the page through `SaveTransfer.reload`; a bad paste is refused with a toast). Shared code box style: `textarea.ui-code` (18a).
- Save robustness (S04, PLT-003): `Save.migrate` replaces a top-level field whose kind differs from `Save.emptySave()` (`"settings": null`, a string for an object, an object for a list; a null default also takes an object). A failed write (storage blocked or full, or a save over 1 MB) sets `Save.notice` and emits one `toast` at once; a repeat of the same failure stays quiet.
- Hooks for later sections: register `ladder`, `play`, `custom`, `range` (main menu entries) and `results` (opened on `match.end`); push `{ label, screen, when? }` to `Ui.pauseEntries` (pause menu rows, e.g. the rules panel; `when()` false hides the row for now; add and remove rows with `setPauseEntry(entry, wanted)`, 18f); pause Restart starts `Progress.retrySetup(match.setup)` when the match belongs to a career run (ladder, challenge, operation, daily), else the same setup; push builder functions to `Ui.settingsExtras[category]`; `Ui.botDebug` (F9); `Ui.perfVisible` (F10); `Ui.selfTestRunner` (set by `20b-test-ui.js` to `Test.run`; Help > Run self-test calls it with `{ headless: true }`).
- A screen may define `onCommand(command)`: `Ui.onMenuCommand` asks it first and stops when it returns true (the map editor reads the pad itself, `docs/api/mapeditor.md`). Main menu entries: Range emits `ui.range`, Generated map opens `mapgen` (18h), Map editor opens `mapEditor`.
- Headless runs (`Game.headless`) open no menus on `ready`, `game.pause` or `match.stop`.
- `Ui.settingsExtras.controls` shows cm per 360, controller status and links to the bindings and layout editor.

### Performance overlay (18c)

`PerfOverlay`: DOM text refreshed 4 times a second while visible (`developer.perfHud`, F10; a four-finger tap toggles it and the F9 bot debug view): fps, frame p50/p95/p99, sim p95, render/hud/audio/gpu ms, draw calls, triangles, render scale, actors, bots (alive hostile or friendly bot actors), the AI system cost (all sim systems named `ai*`, `bot*` or `pveBrains`), projectiles (`Projectiles.active`, copied by `Perf.publishCounters()` each frame), particles, dropped steps, JS heap (Chrome), device, bot debug, the five slowest sim systems and the last three `ErrorLog` entries. Turns red under 60 fps. Reads `Perf.stats()` and `Sim.timing` at runtime (S19 loads after S18 but the loop starts after boot).

## Debug

`__CTK.input`, `__CTK.touch`, `__CTK.pad`, `__CTK.ui` expose the objects.
Live-test hooks (20a, ARC-040): `__CTK.give(key, id = player)` gives a weapon, item or powerup key through `Items.giveKey`; `__CTK.god(on, id = player)` sets or clears `ACTOR_FLAG.GOD`; `__CTK.stress(level)` starts a Frenzy match with `PlayFlow.maxBots()` bots, and `'max'` adds the explosive mutators X09 Rocket Pit and X29 Last Gift (LT-C-030).
