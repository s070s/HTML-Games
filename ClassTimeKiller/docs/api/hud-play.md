# HUD (S17) and match flow screens (S18 add-ons) - public API

Files: `src/17a-hud.js` (core, settings, layout, pen, projection, status panels), `17b-hud-combat.js` (crosshair, scope, hit / kill markers, damage numbers, damage arcs, vignette), `17c-hud-match.js` (header, kill feed, banners, respawn text), `17d-hud-markers.js` (world markers, name tags, item timers, captions, sound ring), `17e-hud-killcam.js` (killcam-lite), `18d-ui-play.js` (Quick Match, Play and results screens, `PlayFlow`), `18e-ui-scoreboard.js` (scoreboard screen, `LocalPlayerStats`). Tests: groups `hud` (`20b-test-hud.js`) and `play` (`20b-test-play.js`).

More elements (minimap, compass, awareness, barks), the Hardcore HUD rule, `hudAddElement` and the `keepInHardcore` argument of `Hud.register`: `docs/api/accessibility.md`.

## How the HUD is drawn (REN-005, PERF-002)

- WebGL quads only, no DOM. Four `HudBatch` layers, one draw call each: `hud.back` (10: scope, vignette, damage arcs), `hud.world` (20: markers, name tags, item timers, damage numbers), `hud.main` (30: crosshair, status panels, header, kill feed, captions, sound ring), `hud.front` (40: banners, respawn text, killcam panel).
- Drawn only while `Game.state === 'playing'` and `hud.show` is on (also while paused: the pause menu is DOM on top). The first layer calls `Hud.beginFrame(seconds, width, height)`: it advances `Hud.time` (the UI clock, frozen while paused) and recomputes the layout.
- A drawer is `Hud.register(layer, id, element, draw(pen, layout, seconds))`. `layer` is `'back' | 'world' | 'main' | 'front'`; `element` is a `HUD_ELEMENTS` id (its toggle `hud.element.<id>` hides the drawer) or `''` for always on. A drawer that throws is logged once and switched off, the others keep drawing. `Hud.quadsOf(element)` reports the quads an element drew in the last frame.
- Cost: a busy scene (about 420 quads: all panels, feed, markers, captions) measures 0.11 - 0.17 ms per frame in the headless self-test on the dev PC (budget 0.4 ms); the `hud` test group asserts it.
- No allocation per frame: numbers and times come from cached strings (`hudNumber`, `hudCount`, `hudTime`), events write into fixed rings of typed arrays, scratch objects are reused. Only `Items.activePowerups`, `Items.timers` and `Abilities.hudState` allocate what their owners put into the arrays they fill.

## Layout

`Hud.layout`: `width height unit margin left right top bottom centerX centerY compact touch` plus anchors for the stacks around the screen. `unit` = `clamp(min(width / 1100, height / 620), 0.9, 1.5)` x the player's HUD scale: 1 at the design size, so the smallest text (14 units) is never below 14 px at 100% scale (ACC-008). Safe-area insets come from the CSS `--safe-*` variables (`Hud.insets`, measured at boot and on resize) and move `left right top bottom` inwards. Compact layout (`hud.compact` `auto` = touch or a screen under 520 px high): smaller bars and ammo panel, no weapon bar, three kill feed rows, and on touch the ammo panel sits bottom centre-left so the touch buttons on the right stay free.

## The pen (`Hud.pen`)

`rect line ring text label(text with a shadow) panel(dark backing) bar(track + fill) triangle quad shape(kind 'circle' | 'square' | 'triangle' | 'diamond') octagon weaponIcon(class)` - HudBatch calls with `hud.opacity` applied to every alpha. Colours are numbers (0xRRGGBB). `HUD_WEAPON_ICONS` draws a silhouette per weapon class from rectangles.

## Settings (all in the generated Settings screen)

| Key | Default | Notes |
|---|---|---|
| `hud.show` | true | the HUD toggle |
| `hud.scale` | 100 | percent, 50-150 |
| `hud.opacity` | 100 | percent, 30-100 |
| `hud.compact` | auto | auto / on / off |
| `hud.element.<id>` | true | one per `HUD_ELEMENTS` row: `crosshair hitMarkers damageNumbers(off) vitals ammo weapons gadgets abilities money powerups itemTimers(off) damageArcs vignette header killFeed markers nameTags banners respawnText captions(off, accessibility) soundRing(off, accessibility)` |
| `hud.crosshair.style` `size` `gap` `thickness` `outline` `color` `dot` `dynamic` | cross 9 4 2 on white off on | UI-004; `style` cross / dot / circle / T / chevron |
| `hud.scopeOverlay` | true | dark scope ring for weapons with `alt.zoom` >= 2.5 |
| `hud.killcam` | true | killcam replay after your death |
| `hud.teamShapes` | true | team shape next to team colour (ACC-001) |
| `accessibility.colorBlind` | off | protanopia / deuteranopia / tritanopia palettes for HUD colours and team colours (defined in 18m, read here; replaces `hud.colorBlind`) |
| `accessibility.reduceMotion` | auto | auto follows `prefers-reduced-motion`; on = no pulsing vignette / bars, no screen tint, halved flashes (replaces `hud.reduceMotion`) |
| `accessibility.photosensitive` | off | flashes become dark overlays (`Hud.flashColor/flashAlpha`) |
| `hud.captionSize` `hud.captionBackground` | 16, on | ACC-002 |

## Elements and what they read

- Vitals: `Actors.health/armor/shield` + `max*`; overheal draws a gold line; low health pulses (reduce-motion aware).
- Ammo: `Weapons.currentWeapon/ammo/magSize/state`; LOW AMMO at <= 25% of the magazine, RELOAD / NO AMMO, a reload progress bar. Weapon bar: owned weapons by slot.
- Gadgets `Gadgets.hudState(id, out)`, abilities and meter `Abilities.hudState(id, out)` (`cooldown` is the fraction **remaining**, 0 = ready), money `Economy.hudState(id, out)` (shown for `roundBuy` / `waveShop` economies, or whenever money, income or a buy phase is non-zero), powerups `Items.activePowerups(id, out)`, item timers `Items.timers(out)` (within 40 m, on screen).
- Crosshair: `Hud.crosshairFor(weapon)` = settings, then `Hud.crosshairOverride(weapon, out)` (default hook: class table `HUD_CLASS_CROSSHAIRS`, then the player's `Save.data.crosshairs[weaponId]`; set with `Hud.setCrosshairOverride(weaponId, fields | null)`; fields `style size gap thickness outline color dot dynamic hidden`). The gap grows with `Weapons.spreadDegrees` converted to pixels with the camera FOV (smoothed, capped).
- Hit marker (white, gold for a head hit), kill marker (red cross): from `damage` events with `source` = you (kinds hit, melee, beam, splash) and `kill` events with `killer` = you. Damage numbers stack per target for 0.7 s.
- Damage arcs: `damage` events with `target` = you; the bearing follows the attacker's live position (clockwise from straight ahead). Vignette below 40% health, red only; the short red hit tint is limited to 3 per second (`Hud.flashAllowed()`, ACC-005).
- Header from `Modes.hudState()`: team scores with team shapes, FFA rank / score / leader, the clock (red under 30 s), OVERTIME, GET READY / ROUND OVER, FIRST TO n, round pips, control meters, objective chips (letter, owner colour, capture arc, contested ring, bomb countdown, flag state). Kill feed: `kill` events, oldest first, 6 s, newest 5 rows (3 compact), weapon icon + head icon. Banners: `announce` events and your own `medal` events (`CAT.medals` row name when it exists, else the id in words). Respawn text: `Modes.hudState().respawnIn` (countdown, "press fire", ELIMINATED).
- Markers (`Hud.project`): objectives from `Modes.objectives` (letter / shape, distance), pings from `ping` events of your side (6 s), off-screen arrows on the edge, teammate name tags (<= 60 m, never enemies), captions and the visual sound ring from `caption` events (shape per kind: footstep circle, gunfire triangle, explosion diamond, item square, voice disc, alert triangle).
- Comm wheel (17g `CommWheel`, an `Input` source, front layer): hold Comm (T) or hold Ping 0.3 s (keyboard Z, pad d-pad right, touch PING); look input picks one of the `COMM_CALLOUTS` (14f) on a ring around the crosshair instead of turning the view; letting go sends `BotTeam.callout`, a short Ping tap sends `BotTeam.playerPing` (docs/api/bots.md).

`Hud.project(x, y, z, out)` -> true when the point is in front of the camera and on screen; `out` (default `hudProjection`) gets `x y depth distance dirX dirY` in CSS pixels; it matches the renderer's matrices (tested against `Mat4`).

## Killcam-lite (UI-011)

`Killcam` records every actor's `x y z yaw pitch eye` plus a living flag at 20 Hz in a fixed ring (44 frames, typed arrays, sim system `killcamRecord` at order 95). When the local player is killed by another actor (and `hud.killcam` is on and at least 0.3 s of history exists) the last 2 s replay from the killer's eyes: `Render.cameraOverride` places the camera, `Render.actorStyle` hides the live bodies and the `killcam` render source draws the recorded ones as capsules with a face box. The panel shows killer name, weapon, headshot and the killer's health / armor / shield at the moment of the kill, a progress line and a skip hint. It ends after the replay plus 0.25 s, on respawn, on `match.end` / `stop`, or when the player releases and presses fire / jump / use after 0.35 s. `Killcam.sample(id, simTime)` returns the interpolated transform (reused object).

**Hook chaining:** 17e wraps whatever `Render.cameraOverride` and `Render.actorStyle` held when it loaded (items, abilities and the renderer fill theirs earlier). A section that assigns either hook later must chain the previous value the same way.

## Scoreboard (UI-010, MODE-003)

Screen `scoreboard` (overlay, passthrough). Tab / the pad's View button: hold to look; touch: tap to open, tap again or Close to hide (with `controls.toggle.scoreboard` on, Input keeps the toggle on every device and the board closes on the reported release; closing it any way resets that toggle). It opens by itself at the end of a round and closes when the next round starts (`round` events). Rows are live from `Modes` during the match and from `Game.match.results` afterwards: player (team symbol + colour, dead greyed, local row highlighted), score, kills, deaths, assists and an objective column (`Captures`, `Plants`, `Hold time`, ... by `rules.objective`, or `Objective` when anyone has objective points); team modes add a block per team with its score and rounds. Below: `LocalPlayerStats` for the local player - per weapon shots, hits (one per shot even for pellets), accuracy, kills, headshots (from `weapon.fire`, `damage`, `kill` events) - and the medals earned (`medal` events). `Scoreboard.renderInto(container)` is shared with the results screen. `LocalPlayerStats` resets on `match.start`.

## Match flow (PRG-001, UI-001)

`PlayFlow` (no DOM):

- `Bus 'ui.quickMatch'` -> `PlayFlow.quickMatch()`: starts the remembered setup in the same call (so the click can lock the pointer). Remembered in `Save.data.play = { mode, map, ruleset, bots, difficulty, team }` on every start; an invalid or outdated record is repaired by `PlayFlow.normalize` (unknown mode -> ffa, a map that does not list the mode -> the smallest one that does, bots capped by `Quality.current().bots`, a missing mode default bot count). Defaults: `ffa`, the smallest ffa map by floor area (`spire`), 7 bots, the mode's own ruleset (RS01 `classic`), difficulty `regular`.
- `PlayFlow.buildSetup(choice, random)` -> `{ mode, map, mutators: [], bots: [{}, ...], seed, difficulty, player: { team, name: 'You' }, ruleset? }` (`ruleset` only when chosen). Bot entries are empty objects: the bots section fills profile and tier from `setup.difficulty`.
- `PlayFlow.start(choice, random)`, `shuffle(random)` (random playable mode, a map listing it, bots 3..default, random difficulty; ruleset stays the mode's), `playAgain()` (same setup, new seed), `nextMap()` (same mode on the next map that lists it), `outcome(results)` (`win | loss | draw | over`), `winnerName(results)`, `playableModes()` (modes with a registered behaviour that a map lists), `mapsFor(mode)`, `difficulties()` (`CAT.difficulty` rows when that catalogue exists at runtime, else one `Regular`), `maxBots()`.
- Screens: `play` (mode, map, rules, bots slider, difficulty, team for team modes, Start, Shuffle; the main menu's Play entry turns on) and `results` (opened by the `match.end` listener of 18b: Victory / Defeat / Draw, winner, reason, your stats, the scoreboard tables, Play again, Next map, Main menu = `Game.stop()`). The results screen releases the pointer lock.

## Events

Consumes `damage kill weapon.fire medal announce ping caption actor.spawn round input.action match.start match.stop match.end setting boot`. Emits nothing new.

## Debug

`__CTK.hud`, `__CTK.killcam`, `__CTK.play`, `__CTK.scoreboard`, `__CTK.playerStats`, `__CTK.bus`, `__CTK.hudCost()` (mean ms per busy HUD frame, headless: set `__CTK.game.headless = true` first).

## Known limits

No touch gesture for hiding the HUD (the Hardcore HUD mutator and `hud.show` hide it; minimap, compass, awareness meters, bark lines, scope info, flash and suppression effects are in `accessibility.md`). The minimap is a radar without walls. The killcam replays positions and view direction, not animations, projectiles or effects. The vignette is red edge bands (no blur).
