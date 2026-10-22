# Forge-lite map editor (S16 / S18, MAP-014)

Files: `src/16x-forge.js` (model: the map being edited, budget, undo / redo, serialising, saved maps, codes, templates), `src/16x-forge-tools.js` (fly camera, 3D cursor, placement tools, grab and drop, the command table with all three input devices, the render source, test-play), `src/18i-ui-forge.js` (the editor screen and its dialogs). Tests: `src/20b-test-forge.js` (group `forge`). Entry: `Map editor` in the main menu (`18b`), screen name `forge`.
The file names sort after `16v`, so the editor calls `Maps.validate`, `MapKit`, `MapRules` and `CustomMatch` directly. `16x-forge-tools.js` sorts before `16x-forge.js` (`-` before `.`): the tools file therefore reads nothing of the model at load time, only inside functions.

## What the player gets

* A fly camera over the map on a 0.5 m grid (snap 0.5 / 1 / 2 m). Tools: Select, Box, Ramp, Spawn, Item pad, Objective, Zone, Trigger, Light, Nav hint. Box and ramp are the shapes the validator accepts (`wedge` and `cylinder` of S08 are not valid map shapes yet). Materials come from `MapRules.materials` and are drawn in the colour of `CAT.materials`.
* Place, grab and drop, turn by 90 degrees, resize, copy and delete; properties of the selection (material, team, item, objective kind and team, bomb site stage, payload path points, trigger kind and far end, hazard damage and element, light colour and radius, zone name).
* Item pads: the keys of `MapRules.itemKeys` (the validator's contract), named from `CAT.weapons`, `CAT.powerups` and `CAT.items` when those exist.
* Object budget 400 (all lists together), shown live (amber from 90%, red when full) and enforced: the 401st object is refused with a toast. Lights stop at the validator limit of 24.
* Undo / redo: a fixed ring of 128 entries (no growth); a group of edits (`Forge.group`) is one step.
* Start from an empty map (a floor), a template (`FORGE_TEMPLATES`: Foundry arena for ffa / duel, Team yard for tdm / ctf / elim / attrition; both pass `Maps.validate`) or a copy of any built-in map (all 12 copy, serialise back and validate).
* Check (the validation panel): `Maps.validate` problems as buttons; a click returns to the editor with the object selected and the camera on it. Helpers: add the nine callout zones, add a light to every zone, suggest modes.
* My maps: up to 20 saved maps in `Save.data.editorMaps`, with the space used and free; rename, open, delete (with confirmation). A save that would take the whole save past 90% of the 1 MB limit is refused with the sizes in the message. Save as a new map keeps the old slot.
* Share code: `CTKMAP1-<checksum>-<payload>` (compressed JSON in the MapKit compact format, version, checksum), copy and paste only. Corrupt, cut, foreign, newer or hostile codes are rejected with a message and change nothing.
* Test play: a mode picker limited to modes the map can play (an objective of each kind the mode needs and a spawn per side); `Game.start` with the edited map object; when the match stops (pause menu quit, results screen) the editor comes back with its state intact.
* Saved maps with at least one mode become runtime maps (`Maps.registerRuntime`): `Maps.forMode`, `Maps.get`, the Custom match map picker and `Game.start({ map: 'user1' })` all see them, from the first frame of the next session on.

## Controls (all three devices reach the same commands)

| Device | Controls |
|---|---|
| Keyboard + mouse | WASD fly, E / Q up and down, Shift fast; hold right mouse to look; the left click places (or selects with the Select tool); the wheel turns the stamp or the selection, Shift + wheel changes the level; `1`-`0` choose a tool; R turn, G grab, V copy, F snap, Del / X delete, `[` `]` cycle the tool option, PageUp / PageDown level, arrows nudge the selection, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z undo and redo, T show zones, Esc let go / menu |
| Gamepad | left stick flies, right stick looks, RT / LT up and down; the cursor is the screen centre. A place / select, B delete, X turn, Y grab, LB / RB tool option, d-pad up / down tool, d-pad left snap, d-pad right redo, View undo, Start menu, L3 / R3 level down / up |
| Touch | one finger drags the cursor (a tap places nothing), two fingers look; on-screen buttons fly (hold), place, delete, turn, grab, undo, redo. The side panels start hidden on small screens (Panels button). |

The pad is read directly each frame (`ForgeTools.readPad`); the menu commands the pad also produces are swallowed by the screen hook `onCommand` (below). While a dialog is open over the editor the editing keys, mouse and pad do nothing (`ForgeTools.inputLive`), and a pad button held under a dialog does not fire when it closes.

## Model: `Forge` (16x-forge.js)

* State: `Forge.map` (a full map row, see `docs/api/maps.md`), `slotId`, `dirty`, `selection { list, index }` (list = `brushes spawns items objectives zones triggers lights navHints`), `message` (last refusal), `problems`.
* Budget: `count()`, `budgetLeft()`, `add(list, object)` -> index or -1 (refused, with a toast), `insertAt`, `deleteObject`, `replace(list, index, object)`, `setMeta(key, value)`, `group(fn)`.
* History: `undo()`, `redo()`, `canUndo()`, `canRedo()`; entries `{ op: add|del|set|meta, list, index, before, after, group }` in `Forge.history.entries` (fixed length `FORGE_HISTORY_SIZE`).
* Geometry helpers: `bounds(list, object, out)`, `moved / turned / resized` (return a changed clone, moves are limited to the map plus its 3 m shell), selection shortcuts `nudgeSelected`, `turnSelected`, `resizeSelected`, `deleteSelected`, `duplicateSelected`, `editSelected(mutate)`, `objectNear(x, y, z, reach, out)`.
* Settings (each one undoable): `rename`, `setTheme` (also sets the sky from `CAT.themes`), `setSize`, `setCategory`, `setModes`; `feasibleModes(map, strict)`, `modeReady`, `modeNeeds`, `suggestModes`.
* Checking: `validate()` (updates `problems`), `locate(problemText)` -> `{ list, index, x, y, z }` or null, `addZoneGrid()`, `addZoneLights()`.
* Serialising: `toMap()` (deep copy), `compact(map)` / `expand(def)` (MapKit compact rows, `expand` checks every field and returns `{ map }` or `{ error }`), `exportCode(map?)`, `decodeCode(text)`, `importCode(text)`.
* Start points: `newFrom({ kind: 'empty' | 'template' | 'builtin', id })`, `FORGE_TEMPLATES`.
* Saves: `saved()`, `usedBytes()`, `freeBytes()`, `saveCurrent(name?)`, `saveAsNew()`, `loadSaved(id)`, `deleteSaved(id)`, `renameSaved(id, name)`, `syncRuntime()` (called on `boot` and after every change of the list).
* Saved entry: `{ id: 'user<N>', name, modes, bytes, data }`, `data` = the compact def. The runtime map has `id 'user<N>'`, `code 'U<NN>'`.

Numbers: `FORGE_BUDGET` 400, `FORGE_HISTORY_SIZE` 128, `FORGE_MAX_MAPS` 20, `FORGE_SAFE_SAVE_BYTES` 0.9 x `SAVE_MAX_BYTES`, `FORGE_SNAPS` 0.5 / 1 / 2.

## Tools: `ForgeTools` (16x-forge-tools.js)

* Session: `attach()` / `detach()` (the screen calls them; the camera override and a theme-only world are set while attached), `active`, `camera { x, y, z, yaw, pitch }`, `cursor { x, y, z, valid }`, `hover`, `tool`, `stamp`, `snap()`, `elevation`, `view { zones, triggers }`.
* `frame(seconds)` (Loop `input` phase, registered at `boot`): reads the pad, flies, aims the cursor, picks the object under the pointer. No allocation per frame (typed arrays, scratch objects, top-level helpers instead of closures).
* `command(name)` runs: `primary secondary rotate grab duplicate undo redo snap optionPrev optionNext toolPrev toolNext levelUp levelDown toggleZones nudge{Forward,Back,Left,Right} menu cancel tool:<id>`; tables `FORGE_COMMAND_KEYS`, `FORGE_HOLD_KEYS`, `FORGE_PAD_COMMANDS`; `setHold(name, down)` for held touch buttons.
* The cursor stands on the nearest brush face the pointer ray hits (top faces give the surface height) or on the level plane; it is snapped to the grid and kept inside the map. Zones and triggers are picked only while shown or while their tool is active.
* `draw(batch)` is the `Render.addSource('forge')` callback: grid, map bounds, every object as instanced shapes (box, wedge, capsule, cone, sphere, cylinder, ring), selection / hover outlines, the grabbed object's ghost and the ghost of what a click places. The world itself is loaded empty (only its theme and sky) so no mesh is baked per edit.
* Test play: `playableModes()`, `testPlay(mode)` (`CustomMatch.setup` for the bots and rules, `setup.map` = the edited map), `afterPlay()` (a `match.stop` listener in `18i`, after the main menu opened; headless runs re-attach without opening a screen).

## Hooks and edits to other files

* `16a-maps.js`: `Maps.runtime` (array), `Maps.registerRuntime(map)` (replaces a runtime map with the same id), `Maps.unregisterRuntime(id)`; `Maps.get` and `Maps.forMode` include runtime maps. The map generator can use the same hook.
* `18a-ui.js`: a screen may define `onCommand(command)`; `Ui.onMenuCommand` asks it first and stops when it returns true (the editor reads the pad itself).
* `18b-ui-menus.js`: main menu entry `Map editor` (after Range). `18g-ui-custom.js`: the map field of the custom match accepts runtime maps (`Maps.get` instead of `CAT.maps.byId`). `20b-test-ui.js`: the three checks that list the main menu entries and every screen's pad navigation know the new entry and the pad-driven editor screen.
* Event `forge.changed` `{ what }` with `what` = `map` (a new map), `edit`, `selection`, `tool`, `problems`, `saved`. The screens and the tools listen; the payload object is reused.

## Tests (group `forge`)

Budget exactness and refusal of object 401 (moving and deleting keep it exact); undo / redo round trip over 50 mixed edits restoring the exact map JSON at every step, the ring cap, groups, selection follow; templates and a copy of every built-in map validate and serialise back; save / load / rename / delete, 20 map limit, storage cap refusal with the numbers, blocked storage; export / import round trip, 8 kinds of corrupt code and 13 kinds of hostile content rejected; cursor, snapping, level, placing with every tool, picking, grab and drop, delete; keyboard, mouse, gamepad (fake pad) and touch (buttons, one finger, two fingers) devices; dialogs block world input; every screen opens; test-play on the arena, the yard (ctf) and the return to the editor; a saved map as a normal match map; drawing counts. `__CTK.forgeSweep(seeds)` runs a longer randomised sweep of edit / undo / redo / code round trips (300 seeds in about 3 s).

## Known limits

* Only `box` and `ramp` brushes (the validator's shapes). Triggers are placed with default far ends and edited with steppers. Puzzle objects (MAP-030) do not exist yet.
* The editor does not keep a draft across page reloads: save the map first (the menu asks before leaving with unsaved changes).
