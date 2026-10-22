# Map editor (S16 / S18, MAP-014)

Files: `src/16x-mapeditor.js` (model: the map being edited, budget, undo / redo, serialising, saved maps, codes, templates), `src/16x-mapeditor-tools.js` (fly camera, 3D cursor, placement tools, grab and drop, the command table with all three input devices, the render source, test-play), `src/18i-ui-mapeditor.js` (the editor screen and its dialogs). Tests: `src/20b-test-mapeditor.js` (group `mapEditor`). Entry: `Map editor` in the main menu (`18b`), screen name `mapEditor`; its dialogs are `mapEditorMenu`, `mapEditorObject`, `mapEditorNew`, `mapEditorMaps`, `mapEditorCheck`, `mapEditorCode`, `mapEditorPlay`, `mapEditorSettings`, `mapEditorModes`.
The file names sort after `16v`, so the editor calls `Maps.validate`, `MapKit` and `MapRules` directly. `16x-mapeditor-tools.js` sorts before `16x-mapeditor.js` (`-` before `.`): the tools file therefore reads nothing of the model at load time, only inside functions.
The two `16x` files use nothing from S18 or later (dependency rule). What needs the UI or the custom match lives in `18i-ui-mapeditor.js` (screens, `MapEditorPlay`, `MapEditorShare`) and fills a hook of the tools (`dialogOpen`, `menuRequest`).

## What the player gets

* A fly camera over the map on a 0.5 m grid (snap 0.5 / 1 / 2 m). Tools: Select, Box, Ramp, Spawn, Item pad, Objective, Zone, Trigger, Light, Nav hint. Box and ramp are the shapes the validator accepts (`wedge` and `cylinder` of S08 are not valid map shapes yet). Materials come from `MapRules.materials` and are drawn in the colour of `CAT.materials`.
* Place, grab and drop, turn by 90 degrees, resize, copy and delete; properties of the selection (material, team, item, objective kind and team, bomb site stage, payload path points, trigger kind and far end, hazard damage and element, light colour and radius, zone name).
* Item pads: the keys of `MapRules.itemKeys` (the validator's contract), named from `CAT.weapons`, `CAT.powerups` and `CAT.items` when those exist.
* Object budget 400 (all lists together), shown live (amber from 90%, red when full) and enforced: the 401st object is refused with a toast. Lights stop at the validator limit of 24.
* Undo / redo: a fixed ring of 128 entries (no growth); a group of edits (`MapEditor.group`) is one step.
* Start from an empty map (a floor), a template (`MAPEDIT_TEMPLATES`: Platform arena for ffa / duel, Team yard for tdm / ctf / elim / attrition; both pass `Maps.validate`) or a copy of any built-in map (all 12 copy, serialise back and validate).
* Check (the validation panel): `Maps.validate` problems as buttons; a click returns to the editor with the object selected and the camera on it. Helpers: add the nine callout zones, add a light to every zone, suggest modes.
* My maps: up to 20 saved maps in `Save.data.editorMaps`, with the space used and free; rename, open, delete (with confirmation). A save that would take the whole save past 90% of the 1 MB limit is refused with the sizes in the message. Save as a new map keeps the old slot.
* Share code: `CTKEDIT1-<checksum>-<payload>` (compressed JSON in the MapKit compact format, version, checksum), copy and paste only. Corrupt, cut, foreign, newer or hostile codes are rejected with a message and change nothing.
* Test play: a mode picker limited to modes the map can play (an objective of each kind the mode needs and a spawn per side); `CustomMatch.start` with the edited map object; when the match stops (pause menu quit, results screen) the editor comes back with its state intact. A restart from the pause menu keeps the match: the editor waits for the last stop.
* Saved maps become runtime maps (`Maps.registerRuntime`) for the modes they are ready for (`MapEditor.readyModes`: the validator's spawn and objective counts). A mode the player switched on that the map cannot serve is not offered in matches (the save keeps the choice and its toast says so); a map ready for none stays out. `Maps.forMode`, `Maps.get`, the Custom match map picker and `Game.start({ map: 'user1' })` see the others from the first frame of the next session on.
* Map settings: name, theme, width, depth, height (each size row also offers the map's own value, so a copy of a non-square built-in map is never turned square or reset by a click), sightline class, modes.

## Controls (all three devices reach the same commands)

| Device | Controls |
|---|---|
| Keyboard + mouse | WASD fly, E / Q up and down, Shift fast; hold right mouse to look; the left click places (or selects with the Select tool); the wheel turns the stamp or the selection, Shift + wheel changes the level; `1`-`0` choose a tool; R turn, G grab, V copy, F snap, Del / X delete, `[` `]` cycle the tool option, `,` `.` previous / next tool (Tab and the arrows stay free for the panels: the arrows nudge the selection only while no panel control has the focus), PageUp / PageDown level, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z undo and redo, T show zones, Esc let go / menu |
| Gamepad | left stick flies, right stick looks, RT / LT up and down; the cursor is the screen centre. A place / select, B delete, X turn, Y grab, LB / RB tool option, d-pad up / down tool, d-pad left snap, d-pad right redo, View undo, Start menu, L3 / R3 level down / up |
| Touch | one finger drags the cursor (a tap places nothing), two fingers look; on-screen buttons fly (hold), place, delete, turn, grab, undo, redo. The side panels start hidden on small screens (Panels button). |

The menu (Start on the pad) lists every dialog: `Tool and object options` mirrors the side panels (tool options and the properties of the selection) so the pad and the keyboard reach every control; `Check the map`, `My maps`, `New map`, `Map settings` (name, theme, size, class, modes), `Share code` and `Test play` are dialogs too.

The pad is read directly each frame (`MapEditorTools.readPad`); the menu commands the pad also produces are swallowed by the screen hook `onCommand` (below). While a dialog is open over the editor the editing keys, mouse and pad do nothing (`MapEditorTools.inputLive`, which asks the `dialogOpen` hook), and a pad button held under a dialog does not fire when it closes.

## Model: `MapEditor` (16x-mapeditor.js)

* State: `MapEditor.map` (a full map row, see `docs/api/maps.md`), `slotId`, `dirty`, `selection { list, index }` (list = `brushes spawns items objectives zones triggers lights navHints`), `message` (last refusal), `problems`.
* Budget: `count()`, `budgetLeft()`, `add(list, object)` -> index or -1 (refused, with a toast), `deleteObject`, `replace(list, index, object)`, `setMeta(key, value)`, `group(fn)`.
* History: `undo()`, `redo()`, `canUndo()`, `canRedo()`; entries `{ op: add|del|set|meta, list, index, before, after, group }` in `MapEditor.history.entries` (fixed length `MAPEDIT_HISTORY_SIZE`).
* Geometry helpers: `bounds(list, object, out)`, `moved / turned / resized` (return a changed clone, moves are limited to the map plus its 3 m shell), selection shortcuts `nudgeSelected`, `turnSelected`, `resizeSelected`, `deleteSelected`, `duplicateSelected`, `editSelected(mutate)`, `objectNear(x, y, z, reach, out)`.
* Settings (each one undoable): `rename`, `setTheme` (also sets the sky from `CAT.themes`), `setSize(width, height, depth?)` (the depth stays when left out), `setCategory`, `setModes`; `feasibleModes(map, strict)`, `modeReady`, `modeNeeds`, `suggestModes`, `readyModes(map)` (the map's listed modes it can serve).
* Checking: `validate()` (updates `problems`), `locate(problemText)` -> `{ list, index, x, y, z }` or null (it finds objects named by list and number, by objective id or by zone name, and otherwise the object near a printed position), `addZoneGrid()`, `addZoneLights()`.
* Serialising: `toMap()` (deep copy), `compact(map)` / `expand(def)` (MapKit compact rows, `expand` checks every field and returns `{ map }` or `{ error }`). The text codes are `MapEditorShare` in 18i (below).
* Start points: `newFrom({ kind: 'empty' | 'template' | 'builtin', id })`, `MAPEDIT_TEMPLATES`.
* Saves: `saved()`, `usedBytes()`, `freeBytes()`, `saveCurrent(name?)`, `saveAsNew()`, `loadSaved(id)`, `deleteSaved(id)`, `renameSaved(id, name)`, `syncRuntime()` (called on `boot` and after every change of the list; it registers `readyModes` only, through `registerPlayable`).
* Saved entry: `{ id: 'user<N>', name, modes, bytes, data }`, `data` = the compact def. The runtime map has `id 'user<N>'`, `code 'U<NN>'`.

Numbers: `MAPEDIT_BUDGET` 400, `MAPEDIT_HISTORY_SIZE` 128, `MAPEDIT_MAX_MAPS` 20, `MAPEDIT_SAFE_SAVE_BYTES` 0.9 x `SAVE_MAX_BYTES`, `MAPEDIT_SNAPS` 0.5 / 1 / 2.

## Tools: `MapEditorTools` (16x-mapeditor-tools.js)

* Hooks the screens fill: `dialogOpen()` (true while a dialog covers the editor), `menuRequest()`.
* Session: `attach()` / `detach()` (the screen calls them; the camera override and a theme-only world are set while attached), `active`, `camera { x, y, z, yaw, pitch }`, `cursor { x, y, z, valid }`, `hover`, `tool`, `stamp`, `snap()`, `elevation`, `view { zones, triggers }`.
* `frame(seconds)` (Loop `input` phase, registered at `boot`): reads the pad, flies, aims the cursor, picks the object under the pointer. No allocation per frame (typed arrays, scratch objects, top-level helpers instead of closures).
* `command(name)` runs: `primary secondary rotate grab duplicate undo redo snap optionPrev optionNext toolPrev toolNext levelUp levelDown toggleZones nudge{Forward,Back,Left,Right} menu cancel tool:<id>`; tables `MAPEDIT_COMMAND_KEYS`, `MAPEDIT_HOLD_KEYS`, `MAPEDIT_PAD_COMMANDS`; `setHold(name, down)` for held touch buttons.
* The cursor stands on the nearest brush face the pointer ray hits (top faces give the surface height) or on the level plane; it is snapped to the grid and kept inside the map. Zones and triggers are picked only while shown or while their tool is active.
* `draw(batch)` is the `Render.addSource('mapEditor')` callback: grid, map bounds, every object as instanced shapes (box, wedge, capsule, cone, sphere, cylinder, ring), selection / hover outlines, the grabbed object's ghost and the ghost of what a click places. What the player works on (grid, selection, hover, ghost) is drawn before the bulk objects, and the outline of trigger and zone volumes gets plainer (12 edges, then the 4 bars of the foot, then one flat plate) as their number grows, so no shape goes past the 1024 instances of the render batch. The world itself is loaded empty (only its theme and sky) so no mesh is baked per edit.
* Grab and drop: `startGrab()` takes its anchor with the grabbed brush out of the way (a pillar grabbed by its top is not sunk by its own height); any change of the map while grabbing (undo, redo, a new map) cancels the grab.
* Touch: `drag.slots` holds the ids of the (at most two) fingers on the view; only they count towards the two-finger look, a finger on an on-screen button never does.
* `playableModes()`: the modes a test match can be played in (an objective of each kind the mode needs and a spawn per side). Test-play itself is `MapEditorPlay` in 18i.

## Screens and helpers: `18i-ui-mapeditor.js`

* `MapEditorUi`: the editor screen (top bar built once and updated in place, palette, properties, status, touch buttons). A `mapEditor.changed` event only marks the parts it touches (`mark(what)`: `edit` top bar + properties, `selection` properties, `tool` top bar + palette, `saved` top bar, `map` all); `flush()` redraws them once per frame (the `ui` loop phase) and gives the keyboard focus back to the control at the same place of a rebuilt panel (`rebuild(panel, fill)`).
* `MapEditorPlay.testPlay(mode)`: refuses a mode the map cannot play, otherwise `CustomMatch.start` with `setup.map` = the edited map. `returning` is set until the editor is back; `onMatchStop()` (a `match.stop` listener) queues `settle()` as a microtask, which brings the editor back only when no match is running by then, so the stop that `Game.start` makes inside a restart does not open the editor. `settle()` is public for tests (headless runs re-attach without opening a screen).
* `MapEditorShare`: `exportCode(map?)`, `decodeCode(text)` -> `{ map }` or `{ error }` (nothing is changed), `importCode(text)` (replaces the map being edited). Format `CTKEDIT1-<checksum>-<payload>`, framed by the one share-code codec `CustomCodec.packCode/unpackCode(MAPEDIT_CODE_FORMAT, ...)` (18g); the prefix differs from the generator's `CTKMAP-` settings codes.

## Hooks and edits to other files

* `16a-maps.js`: `Maps.runtime` (array), `Maps.registerRuntime(map)` (replaces a runtime map with the same id), `Maps.unregisterRuntime(id)`; `Maps.get` and `Maps.forMode` include runtime maps. The map generator can use the same hook.
* `18a-ui.js`: a screen may define `onCommand(command)`; `Ui.onMenuCommand` asks it first and stops when it returns true (the editor reads the pad itself).
* `18b-ui-menus.js`: main menu entry `Map editor` (after Range). `18g-ui-custom.js`: the map field of the custom match accepts runtime maps (`Maps.get` instead of `CAT.maps.byId`) and its name check is the shared `cleanLabel`. `20b-test-ui.js`: the three checks that list the main menu entries and every screen's pad navigation know the new entry and the pad-driven editor screen.
* `01-core.js`: `cleanLabel(text, limit)` (player-typed names: control characters and angle brackets removed, trimmed, cut), used by the editor and the custom match. `07b-render-world.js`: `writeSunDirection(theme, out)`, used by `applyTheme` and by the editor's sky for a theme.
* `16a-maps.js`: `Maps.runtime` is uncapped here (a generator that registers rows must evict only its own, never the editor's saved maps).
* Event `mapEditor.changed` `{ what }` with `what` = `map` (a new map), `edit`, `selection`, `tool`, `problems`, `saved`. The screens and the tools listen; the payload object is reused.

## Tests (group `mapEditor`)

Budget exactness and refusal of object 401 (moving and deleting keep it exact); undo / redo round trip over 50 mixed edits restoring the exact map JSON at every step, the ring cap, groups, selection follow; templates and a copy of every built-in map validate and serialise back; save / load / rename / delete, 20 map limit, storage cap refusal with the numbers, blocked storage; export / import round trip, 8 kinds of corrupt code and 13 kinds of hostile content rejected; cursor, snapping, level, placing with every tool, picking, grab and drop (a box keeps its height; undo or redo cancels a grab), delete; keyboard, mouse, gamepad (fake pad) and touch (buttons, one finger, two fingers) devices; dialogs block world input; every screen opens; test-play on the arena, the yard (ctf), the return to the editor and its restart rule; a saved map as a normal match map; drawing counts per shape against the batch capacity, the partial refresh of the screen, saved maps registered only for ready modes, non-square sizes kept, problems of triggers and zones located. `__CTK.mapEditorSweep(seeds)` runs a longer randomised sweep of edit / undo / redo / code round trips (300 seeds in about 3 s).

## Known limits

* Only `box` and `ramp` brushes (the validator's shapes). Triggers are placed with default far ends and edited with steppers. Puzzle objects (MAP-030) do not exist yet.
* The editor does not keep a draft across page reloads: save the map first (the menu asks before leaving with unsaved changes).
