# ClassTimeKiller - Live Test Plan

Status: living document. Test areas point at `docs/SPECIFICATION.md` by section number and requirement-ID prefix (for example "§6 MOV"). When a requirement ID changes in the spec, update the row that cites it.

## 1. What a "live test" is

A live test is played by a person in a real browser on a real device, with the game opened straight from the single HTML file. It is not the headless self-test. The self-test (`__CTK.selfTest()`) checks logic in isolation; a live test checks what a player actually sees, hears and feels: frame pacing, input feel, touch layout, audio, menus, fairness of bots and recovery from real-world events (tab switch, phone lock, gamepad unplug, full storage).

Rules:
- Laptops launch from `file://` (double-click the HTML). Phones (D1-D4) load the same file from a static web server (PLT-001), because iOS Safari cannot run local HTML files. Serve it over HTTPS: on iPhone and iPad the gyro/motion sensors, the screen wake lock, persistent storage and the Home Screen app need a secure page, and a plain LAN `http://` address would hide those features (the gyro then shows "Gyro needs HTTPS"). A local test server with a trusted certificate is fine; D1/D2 also run LT-C-001 once from the file manager (`content://`) to check that saves work or the storage warning shows.
- Network off (airplane mode or browser offline) for at least one run per device: the game must make zero network requests.
- Use a fresh browser profile (or cleared site data) unless the test needs an existing save.
- Record the build: the version string shown in the main menu and in `__CTK.version`.

## 1a. Hosting the file for iPhone and iPad

The owner puts the single HTML file on their own web server and plays it in Safari. What that needs:
- Serve it over HTTPS (a normal certificate; no other file is needed, the game makes no network requests). Over plain `http://` the game plays, but the gyro/motion sensors, the screen wake lock, persistent storage and the Home Screen app are not available.
- Add to Home Screen: open the game in Safari, tap Share, then Add to Home Screen. The icon opens the game full screen as its own app (the game sets the Apple web-app tags itself).
- The Home Screen app keeps its own storage, apart from the Safari tab: it starts with an empty save. To move progress, use Back up or restore save (a footer button under every settings tab): Copy a backup in Safari, then Import it in the Home Screen app. The game offers this once on the app's first start.
- Safari may clear a site's data after about 7 days away; the Home Screen app and a granted persistent storage keep it. The game shows a one-time backup tip on the main menu after the first finished match.
- On iOS before 17 the silent switch mutes the game's sound; the game shows a one-time tip. From iOS 17 the sound plays with the switch on. The Mix with other audio setting lets a music app keep playing.
- Test on a real iPhone or iPad, not only a desktop browser: LT-C-032, LT-C-033, LT-C-041 to LT-C-044.

## 2. Device matrix

| Code | Device class | Browser | Screen | Notes |
|---|---|---|---|---|
| D1 | Low-end Android phone (4 GB RAM or less, Mali/Adreno 6xx class GPU) | Chrome (current) | 60 Hz | Primary low-spec target |
| D2 | Android phone with 120 Hz screen | Chrome (current) | 120 Hz | High refresh target on mobile |
| D3 | iPhone (A13 class or newer) | Safari (iOS 16 or newer, PLT-004) | 60 Hz | WebGL2 and Web Audio quirks |
| D4 | iPhone Pro with ProMotion | Safari (iOS 16 or newer) | 120 Hz | Safari may cap the frame loop at 60; record which |
| D5 | Integrated-graphics laptop (Intel UHD/Iris Xe or AMD Vega class) | Chrome | 60 Hz | Primary desktop target |
| D6 | Same laptop class | Edge | 120 Hz (external or built-in) | High refresh desktop |
| D7 | Same laptop class | Firefox | 60 Hz | Firefox WebGL2 and gamepad differences |
| D8 | Any laptop | Chrome | 60 Hz | Gamepad tests: Xbox-layout and PlayStation-layout pads, wired and Bluetooth |

"All" in a test row means D1 to D7. "Phones" means D1 to D4. "Laptops" means D5 to D7. "120 Hz" means D2, D4, D6.

## 3. How to measure

Performance HUD (F8, PERF-012 and ARC-040; on touch use the debug toggle in Settings or a four-finger tap on the look area). It also shows the caught-error ring (ARC-041). Bot debug view is F9 (BOT-092).
- Frame time p50 and p99 in milliseconds over the last 600 frames, current fps, dropped-frame count, draw calls, triangles, active entities, JS heap (where the browser exposes it).
- Target: p50 at or below 8.3 ms and p99 at or below 11 ms on 120 Hz devices; p99 at or below 16.7 ms (60 fps minimum) on every target device.
- Read the numbers after 30 seconds of play in the scene under test, not during loading.

`__CTK` debug commands used in this plan. The spec (ARC-040) defines `window.__CTK` = {selfTest, soak, perf, game, world, rules, catalogues, spawnBot, setTier, step(n)}. Commands marked "test hook" below are not yet in ARC-040: they are requested for live testing (see section 12). Until they exist, use the listed fallback.

| Command | Purpose |
|---|---|
| `__CTK.version` | Build string (test hook; fallback: version text on the main menu) |
| `__CTK.selfTest()` | ARC-030: runs the built-in checks, returns {total, failed, results[]}; also Help > "Run self-test" |
| `__CTK.perf` | ARC-040: performance data behind the F8 HUD (frame ms, sim/AI/render/HUD ms, GPU ms, draw calls, heap); p50/p99 over 600 frames is a test hook; `scenes()`, `scene(name, qualityId, { autoLower })`, `record(seconds)`, `info()`, `stop()` drive the worst-case scenes of `tools/perf.mjs` (docs/PERFORMANCE.md) |
| `__CTK.soak` | ARC-033: headless bot soak; use before LT-C-031 to catch stuck bots and fairness breaches early |
| `__CTK.seed(n)` | Test hook: sets the generator seed; fallback: seed field in Custom > Map (MAP-020) |
| `__CTK.map.check()` | Test hook: reachability and spawn-safety report (the MAP-001 load validation result) |
| `__CTK.spawnBot` / `__CTK.setTier` | ARC-040: add bots and set their tier; "max bots" means the PERF-009 cap for the active preset |
| `__CTK.bots.debug(bool)` | Same as F9 (BOT-092): nav graph, paths, vision cones, awareness meters, state, goal and scores |
| `__CTK.stress(level)` | Test hook: max bots plus max particles, decals, projectiles, sounds; fallback: max bots plus explosive-heavy mutators |
| `__CTK.give(weaponId)` / `__CTK.god(bool)` | Test hooks; fallback: Firing Range (PRG-008) weapon rack |
| `__CTK.save.dump()` / `__CTK.save.corrupt(kind)` | Test hooks; fallback: read or edit the `ctk.save.v1` key in DevTools Application > Local Storage (ARC-020) |
| `__CTK.step(n)` | ARC-040: advance n sim steps while paused, for frame-by-frame checks |
| `__CTK.log.errors()` | Test hook; fallback: error ring on the F8 HUD (ARC-041) |

Other tools: the browser console (must show zero uncaught errors), the browser task manager or `performance.memory` for memory, a stopwatch for menu timings, a phone screen recording when a bug is about feel or timing.

## 4. Severity definitions

| Severity | Meaning | Examples |
|---|---|---|
| Critical | Crash, cannot start or play, data loss, below 60 fps on a target device, controls unusable on a target device | Black screen on file://, save wiped, touch fire button dead on iPhone, p99 above 16.7 ms on D1 |
| High | A core feature is broken or unfair | Bots see through walls, spawn-killing, a mode never ends, a weapon's alt fire does nothing |
| Medium | A feature is partly wrong or confusing | Wrong number on HUD, tooltip missing, mutator works but its icon is wrong |
| Low | Polish | Text clipping, small audio pop, slightly off colour |

A bug's severity is decided by its worst effect on any target device, not by the device it was found on.

## 5. Pass, fail and reporting

- Pass: every expected result is seen and the measurable criterion is met on every device listed in the row.
- Fail: any expected result missing, any criterion missed, or any uncaught console error during the test.
- Blocked: the test cannot run because something else is broken; link the blocking bug.
- A test passes for one build only. Re-run after any change to the area.

Bug report template (one bug per report):

```
Title: [LT-ID] short description
Severity: Critical / High / Medium / Low
Build: (__CTK.version)
Device / OS / browser / refresh rate:
Launch: file:// or other
Settings: preset names, mutators, difficulty, seed (if procedural)
Steps to reproduce: 1. 2. 3.
Expected:
Actual:
Measurements: perf stats (p50/p99/heap), __CTK.log.errors() output
Frequency: always / N of M tries
Attachments: screenshot, screen recording, save dump (__CTK.save.dump())
```

## 6. Test tables

Columns: ID, Area (spec section and ID prefix), Device(s), Setup, Steps, Expected result, Pass criterion.

### 6.1 Critical (LT-C)

| ID | Area | Device(s) | Setup | Steps | Expected result | Pass criterion |
|---|---|---|---|---|---|---|
| LT-C-001 | §2 PLT-001 | All | Fresh profile, network off | Open the HTML file from file:// | Title screen appears | Title visible within 3 s on laptops, 5 s on phones; zero console errors |
| LT-C-002 | §1 VIS-001, §2 PLT-001 | All | Network off, DevTools Network tab open (laptops) | Launch, play one full match | Game runs with no network | Zero network requests other than the file itself |
| LT-C-003 | §2 PLT-001, PLT-004, §23 REN-001, §24 ARC-041 | All | Fresh profile | Launch | WebGL2 context created, scene renders | No black or pink screen; `__CTK.log.errors()` empty |
| LT-C-004 | §2 PLT-002 | D5 with WebGL2 disabled in browser flags | Disable WebGL2 | Launch | Full-screen "WebGL2 is required" message with enable steps, never a blank page | Readable message shown within 3 s; page stays responsive |
| LT-C-005 | §3 PERF-001, PERF-008 | D1, D3, D5, D7 | Default settings, hand-made medium map, 7 bots | Play 2 min, read perf HUD | Smooth play | p99 at or below 16.7 ms |
| LT-C-006 | §3 PERF-001, PERF-002, PERF-003, PERF-007 | D2, D4, D6 | Default "auto" quality, 7 bots | Play 2 min, read perf HUD | 120 fps class pacing | p50 at or below 8.3 ms, p99 at or below 11 ms (D4: if Safari caps at 60, record it and require p99 at or below 16.7 ms) |
| LT-C-007 | §3 PERF-006, PERF-010, §23 REN-004 | D1 | Heaviest built-in map, max weapon effects on screen (explosive spam) | Fire continuously 30 s | No collapse | p99 at or below 16.7 ms; no single frame over 50 ms |
| LT-C-008 | §5 INP-001, INP-003, INP-009 | Laptops | Fresh profile | Click to start match; move with WASD, look with mouse, fire, jump | Pointer locks, all actions work | Pointer lock on first click; each action responds on the next frame |
| LT-C-009 | §5 INP-004 | Phones | Fresh profile | Start match; use left stick, right look area, fire, jump buttons | Touch controls work | All 4 controls respond; no page scroll, zoom or text select during play |
| LT-C-010 | §5 INP-004 | D3, D4 | Safari | Two- and three-finger touches during play; double-tap; edge swipe | No browser zoom, no selection callout; an edge back-swipe (Safari cannot block it) pauses the game | Game view never zooms; controls keep working; a swipe away pauses and resumes cleanly |
| LT-C-011 | §5 INP-007, INP-010 | D8 | Pad connected before launch | Navigate menus and play a match with the pad only | Full control without mouse or keyboard | Every menu reachable; move, look, fire, alt fire, jump, weapon switch work |
| LT-C-012 | §5 INP-007, §2 PLT-006 | D8 | Match running with pad | Unplug pad mid-fight | Game pauses and shows "controller disconnected" | Pause within 0.5 s; no stuck input (player not running or firing on its own) |
| LT-C-013 | §2 PLT-003, §24 ARC-020, ARC-021 | All | Earn progress (XP, unlocks), change options | Reload the page | Progress and options kept | All changed values identical after reload (compare `__CTK.save.dump()`) |
| LT-C-014 | §24 ARC-020 | All | Valid save present | `__CTK.save.corrupt('garbage')`, reload; then open the "Back up or restore save" button (footer under every settings tab) | Game starts; broken save copied to `ctk.save.bak` (to `ctk.save.spare` when the backup already holds a readable save), save reset with a notice; never a silent wipe; the backup is offered as Export backup / Restore backup | Title reached; notice shown; `ctk.save.bak` holds the broken data; Restore backup brings back a valid backup, and a bad one is refused without a reload |
| LT-C-015 | §24 ARC-020, ARC-041 | All | Valid save | `__CTK.save.corrupt('truncate')`, reload; then Copy a backup in the same screen and Import it back | Same as LT-C-014; Copy and Import round-trip the save | Title reached; zero uncaught errors; after Import the progress is back and nothing is lost |
| LT-C-016 | §24 ARC-020 | All | Save from an older version (`corrupt('oldVersion')`) | Reload | Save migrates | All old progress present; version field updated |
| LT-C-017 | §2 PLT-003, §24 ARC-020 | D5, D3 | Fill localStorage to quota (console snippet) | Earn progress, trigger save | Clear "could not save" notice; game keeps running | No crash; notice shown; existing save not destroyed |
| LT-C-018 | §2 PLT-003 | D3 | Safari private browsing | Launch and play | Game runs even if storage is blocked or tiny | Title and match playable; storage warning shown once |
| LT-C-019 | §24 ARC-020 | All | End-of-match screen (save moment) | Close tab right as results appear; relaunch | Either the old or the new save loads, never a broken one | Clean load on relaunch, 5 of 5 tries |
| LT-C-020 | §2 PLT-006, §20 UI-002 | All | In a match | Pause and resume 10 times quickly | Simulation stops while paused, resumes cleanly | No time jump, no stuck keys, no extra shots fired |
| LT-C-021 | §2 PLT-006, §24 ARC-010 | All | In a match | Switch tab (or lock phone) for 60 s, come back | Game is paused on return; no huge catch-up step | Player state unchanged; at most 4 sim steps in the first frame after return (ARC-010); audio back after one tap/click |
| LT-C-022 | §2 PLT-005, §20 UI-015 | Phones | In a match | Rotate phone portrait/landscape 5 times | Held upright on a phone (portrait under 600 px wide) a match pauses behind a "Turn your phone sideways" overlay and resumes on landscape; tablets (iPad) play on; menus stay usable upright | Canvas resolution correct after each rotate; no context-loss crash; a pause the player chose stays paused after rotating |
| LT-C-023 | §2 PLT-005 | D5 | In a match | Force context loss (`WEBGL_lose_context` from console), then restore | Game pauses (reason graphics), rebuilds and continues; after 5 s without a restore the save is written and "The graphics stopped" appears with a Reload button | Rendering back within 3 s, or the Reload screen; a late restore removes the Reload screen; save intact |
| LT-C-024 | §13 MODE-002, §1 VIS-004 | All | Every mode in the §13 catalogue (26, VIS-004), default rules, 3 bots | Start each mode | Every mode loads into play | Every mode reaches play within 5 s on laptops, 8 s on phones |
| LT-C-025 | §13 MODE-001 | Laptops | Each mode with its shortest time/score limit | Play to the end | Match ends, result screen shows, return to menu works | Every mode ends and returns to menu without reload |
| LT-C-026 | §18 MAP-001 | All | Each hand-made map, Deathmatch | Walk the full layout with `__CTK.god(true)` | No falling through floor, no holes into the void | Zero fall-throughs; `__CTK.map.check()` reports zero errors |
| LT-C-027 | §18 MAP-001, MAP-004, MAP-020, MAP-023 | Laptops | Procedural generator, seeds 1 to 50 | Generate each map, run `__CTK.map.check()` | Every spawn and pickup reachable | 50 of 50 seeds: 100% reachable, no spawn inside geometry |
| LT-C-028 | §18 MAP-021, MAP-023 | D1 | Largest procedural size | Generate 5 seeds | Generation finishes without freezing the page | Each generation under 3 s; page never shows "not responding" |
| LT-C-029 | §3 PERF-002, PERF-009, PERF-011, §16 BOT-090, BOT-091 | Laptops, D1 | Max bots, Team Deathmatch, 10 min | Play and watch AI time on perf HUD | AI never freezes the game | No frame over 50 ms caused by AI; all-bot AI time at or below 1.0 ms average (BOT-091) |
| LT-C-030 | §3 PERF-009, PERF-010, PERF-013 | All | `__CTK.stress('max')` | Run 60 s | Game stays playable | Laptops, D2, D4: p99 at or below 16.7 ms; D1, D3: auto quality brings p99 to 16.7 ms or less within 10 s |
| LT-C-031 | §3 PERF-005, PERF-006, §24 ARC-033 | D1, D5 | Endless horde or Deathmatch, bots on | Soak 60 min continuous play | Stable memory and fps | Heap at or below 150 MB and growth under 20% from minute 5 to minute 60; no GC pause over 2 ms (PERF-006); p99 at minute 60 within 10% of minute 5 |
| LT-C-032 | §22 AUD-001 | Phones, D7 | Fresh launch | Tap/click once on title | Audio starts after the first gesture | Sound plays within 0.2 s of first gesture; message shown if audio is blocked; iPhone with the silent switch on: sound plays (iOS 17+) or the one-time silent-switch tip shows (older iOS mutes the game until the switch is off) |
| LT-C-033 | §22 AUD-001, §2 PLT-006 | D3, D4 | Match running | Lock phone, unlock, return to Safari | Audio context resumes after one tap | Sound back after 1 tap; no crackle loop |
| LT-C-034 | §1 VIS-006, §19 PRG-001, §20 UI-001 | All | Fresh launch | Go from title to playing a quick match | Fast path exists | Quick Match is one tap from the main menu (PRG-001), any curated mode in 3 taps (Play, card, Start; UI-001); playing within 10 s on laptops, 15 s on phones |
| LT-C-035 | §6 MOV-010, MOV-016, MOV-022, §4 DATA-003 | All | Each movement preset | Walk, run, jump, crouch through a doorway and onto a 1-step ledge | Player never gets stuck | Player passes every standard doorway and step on every preset |
| LT-C-036 | §7 HP-001, HP-003 | All | Each health preset | Take damage to 0 | Player dies and respawns (or round logic applies) | Death always at 0; never alive at 0; respawn follows the mode rule |
| LT-C-037 | §8 WPN-001, WPN-002 | Laptops | Every weapon via `__CTK.give` | Fire primary and alt fire 5 s each, reload, switch | No weapon crashes or freezes the game | 100% of weapons fire both modes with zero console errors |
| LT-C-038 | §21 ACC-001, ACC-006, ACC-008, §20 UI-015 | All | Options open | Set HUD scale to 50% and 150%; each colour-blind mode; reduced motion | Game stays usable | Every menu button reachable; text at least 14 px at 100% scale |
| LT-C-039 | §5 INP-001, §2 PLT-006 | D5, D7 | Chrome and Firefox | Press Esc during pointer lock; click Resume | Pause menu opens; Resume re-locks pointer | Resume regains pointer lock in 1 click (if the browser refuses a re-lock within about 1 s of Esc, the game shows "Click to resume" and the next click locks); menu reached with 1 Esc |
| LT-C-040 | §1 VIS-003, §2 PLT-001 | All | Fresh profile | Search the file for external URLs; run with network off | Self-contained file | Zero external resource loads (scripts, fonts, images, audio) |
| LT-C-041 | §2 PLT-004, PLT-003 | D3, D4 | Game served over HTTPS; Safari tab with a save | Share > Add to Home Screen; open the new icon; accept the "Bring your progress?" offer or use Restore backup with a copied backup | Home Screen app opens full screen (no Safari bars) with its own empty save (it does not share Safari's storage) and offers the import once | Progress carried over through Copy/Import; the app shows no browser chrome; the one-time "Keep your progress" tip showed once in Safari after the first finished match |
| LT-C-042 | §2 PLT-004 | D3, D4 | Home Screen app and Safari tab | Play a match; swipe back from the screen edge during it; lock the phone mid-match | Back swipe pauses instead of leaving; a running visible match keeps the screen awake | Pause menu opens on the back swipe; the screen does not dim during a match over HTTPS |
| LT-C-043 | §2 PLT-004 | Android phone or iPad | Main menu | Use Full screen in the menu | Full screen where the browser allows it, otherwise the message "The browser did not allow full screen." | Full screen on and off cleanly; no crash on iPhone where it is not offered |
| LT-C-044 | §5 INP-006 | D3, D4 | Settings > Controls, gyro aim On | Over HTTPS, then once over plain HTTP | Over HTTPS the motion permission is asked once and gyro aim works; over HTTP one toast says the gyro needs HTTPS | No crash; the setting row shows when it cannot work |

### 6.2 High (LT-H)

| ID | Area | Device(s) | Setup | Steps | Expected result | Pass criterion |
|---|---|---|---|---|---|---|
| LT-H-001 | §6.3 MV01-MV08, MOV-011, MOV-026 | Laptops, D1 | Each movement preset, empty test map | Measure run speed, jump height, air control along a marked lane | Values match the preset table in the spec | Measured speed and jump height within 5% of spec values per preset |
| LT-H-002 | §6 MOV-010 | D5 at 60 Hz, D6 at 120 Hz | Same preset, same lane | Time a 50 m run and a jump distance on both screens | Movement is frame-rate independent | Times and distances differ by under 2% between 60 and 120 Hz |
| LT-H-003 | §6 MOV-022, MOV-023, MOV-024 | All | Each preset with slide, mantle, wall-run or double jump (where the preset has them) | Perform each special move 10 times | Each move triggers reliably and only when allowed | 10 of 10 triggers; no trigger on presets that disable the move |
| LT-H-004 | §6 MOV-012, MOV-013, MOV-018 | Laptops | MV01 arena (strafe-jump), MV02 tactical (bhopCap 1.2), MV03 modern (bhopCap 1.1); touch/pad with air-control assist X24 | Chain 10 jumps | Speed gain comes only from the air formula; landing speed clamped to bhopCap x groundSpeed where set; no auto-repeat jump while held | Landing speed never above bhopCap x groundSpeed |
| LT-H-005 | §6 MOV-019, §4 DATA-003, §18 MAP | All | Each hand-made map | Climb every ladder/jump pad/stairs | No stuck points | Zero spots where the player cannot move out within 2 s |
| LT-H-006 | §7 HPP01-HPP09 | All | Each health preset HPP01-HPP09 (expected values in section 10.2) | Take timed damage, wait, observe regen | Health, armor, shields and regen follow the preset | Regen delay and rate within 0.2 s and 5% of spec |
| LT-H-007 | §7 HP-001, HP-006 | Laptops | Armor and shield presets | Hit with each damage type (bullet, explosive, fire, melee) | Armor/shield absorption follows the spec table | HUD numbers match the expected value from the spec formula on 5 sample hits |
| LT-H-008 | §6 MOV-015 | All | Fall damage on | Drop from 3 heights | Damage scales with height; small drops harmless | Values within 5% of spec |
| LT-H-009 | §7 HP-002, §4 DATA-003 | Laptops | Headshot-enabled preset | Head, body, limb hits on a dummy | Location multipliers applied | Damage numbers match spec multipliers |
| LT-H-010 | §8 WPN-002, WPN-003, WPN-005 | Laptops, D1 | One weapon of each fire class: hitscan, projectile, spread, beam, charge, melee, thrown, lock-on | Fire primary at a target dummy at 5, 20, 50 m | Damage, falloff, spread follow the weapon table | Damage per hit within 5% of spec at each range |
| LT-H-011 | §8 WPN-001 | Laptops, D1 | Same fire classes | Use alt fire on each | Alt fire does its listed different action (zoom, burst, grenade, charge, block) | Every alt fire produces its spec behaviour; none is a copy of primary unless the spec says so |
| LT-H-012 | §8 WPN-002, §6 MOV-010 | D5 at 60 Hz, D6 at 120 Hz | Fastest-firing weapon | Hold fire for 10 s, count shots (ammo used) | Fire rate is frame-rate independent | Shot count identical (plus or minus 1) on both screens |
| LT-H-013 | §8 WPN-007, WPN-010 | All | Each weapon | Empty the magazine, reload, cancel reload by switching | Ammo counts stay correct | Never negative ammo, never free ammo, reload cancel keeps the right count |
| LT-H-014 | §8 WPN-002 | Laptops | Projectile weapons | Fire at a wall at point-blank range and through a thin gap | Projectiles never pass through walls | Zero tunnelling in 20 shots |
| LT-H-015 | §8 WPN-011, §6 MOV-017, §7 HP-003 | Laptops | Explosive weapons | Rocket-jump / self-damage test; hit enemy behind cover | Self-damage and splash obey the rule; splash blocked by solid walls | No splash damage through a solid wall |
| LT-H-016 | §9 GAD-001, GAD-002, G01-G24 | All | Each grenade and gadget | Throw/deploy each 3 times | Each works; cooldown/count shown | Every gadget triggers its effect; count and cooldown match spec |
| LT-H-017 | §9 GAD-003 | Laptops | Mines/traps/turrets | Place 3 near a spawn point | Limit 1 of each placed type per actor; enemy placed gadgets glint red within 8 m | Placement limit enforced; spawn zone rule enforced |
| LT-H-018 | §10 ABL-001, ABL-002, A01-A37 | All | Each ability | Use each ability, then try during cooldown | Ability fires; cooldown blocks re-use; HUD shows timer | Cooldown within 0.1 s of spec; HUD timer matches |
| LT-H-019 | §10 ABL-001, §5 INP-004 | Phones | Loadout with max abilities | Look at the touch HUD in a fight | Abilities do not clutter the screen | At most the spec number of ability buttons; none overlaps fire/move areas |
| LT-H-020 | §11 PWR-002, PWR-003 | All | Each powerup | Pick up, time duration, watch end | Effect, duration and end cue correct | Duration within 0.2 s of spec; clear visual and audio end cue |
| LT-H-021 | §11 PWR-001, §18 MAP-005, §16 BOT-013 | Laptops | Deathmatch, 7 bots, 15 min | Track who takes the strongest powerups and armor | Leader does not keep every big item (anti-snowball) | Leader's share of top items under 50% (spec value if different) |
| LT-H-022 | §12 ECO-001 | Laptops | Round-based mode with buy economy | Play 6 rounds winning and losing; read money each round | Money and loss bonus follow the one documented rule | Money matches spec formula every round; rule is explained in-game |
| LT-H-023 | §12 ECO | All | Loadout editor | Build, save, rename, delete loadouts; start match with each | Loadouts apply correctly | Spawned with exactly the saved items 5 of 5 times |
| LT-H-024 | §13 MODE-001 | Laptops | Every free-for-all mode | Reach the score limit | Correct winner declared | Winner equals highest score; ties handled per spec |
| LT-H-025 | §13 MODE-001, MODE-002 | Laptops | Every team mode | Reach score limit and time limit separately | Correct team wins; on a tie, sudden death until a lead exists, max +3 min then draw | Result matches the spec rule in both cases |
| LT-H-026 | §13 MODE-001 | Laptops | Every round-based / elimination mode | Lose all players; win by objective | Round ends, next round starts, match ends at the round limit | Round and match counts correct on the result screen |
| LT-H-027 | §13 MODE-004 | Laptops | Every objective mode (flag, zones, payload, bomb, etc.) | Take, carry, drop, return, capture | Each objective state change works and is announced | Every state change has HUD and audio cue; score updates once per capture |
| LT-H-028 | §19 PRG-005, §17 NPC-007, NPC-008 | All | Horde / survival mode | Survive waves 1 to 10; die on purpose | Waves escalate; lose condition ends the run; best wave saved | Wave counter correct; loss screen shows; best wave persists after reload |
| LT-H-029 | §18 MAP-010, §16 BOT-040, BOT-042 | Laptops | Every mode with respawns, max bots | Watch 50 respawns with `__CTK.bots.debug(true)` | No spawn-killing | No spawn within 12 m of an enemy or in enemy LOS within 25 m; 2 s spawn protection (ends on fire); 50 of 50 spawns clean |
| LT-H-030 | §18 MAP-011, §16 BOT-041 | Laptops | Team modes, one team dominating | Let the losing team respawn 20 times | Spawns avoid enemy sight lines and spawn trapping | Spawn zones have 2+ exits not overlooked; no bot holds LOS on an enemy spawn over 10 s |
| LT-H-031 | §14 MUT-002 | Laptops | Each mutator in the §14 catalogue (50, VIS-004) alone | Start a match with each | Each mutator changes the game as described | Every mutator shows its effect within 30 s of play |
| LT-H-032 | §14 MUT-002, MUT-003 | Laptops, D1 | Extreme stack: all compatible mutators at max | Play 3 min | Game stays playable and rules stay consistent | No crash; p99 at or below 16.7 ms on laptops; conflicting picks auto-resolved (last chosen wins) with a toast |
| LT-H-033 | §14 MUT-002 | Laptops | Pairs the spec marks incompatible | Try to enable both | Last chosen mutator wins; toast names the one switched off | Never both active at once; toast shown every time |
| LT-H-034 | §14 MUT-001, MUT-004 | All | Custom match editor | Build a custom match on all tabs, save it, reload page, load it; copy its text code, reset, paste code | Custom setup kept and shareable | Every field identical after reload and after pasting the text code |
| LT-H-035 | §15 DIF-001 | Laptops | Each difficulty preset, 1 v 1 bot, 5 matches each, same map | Record player score vs bot score | Difficulty rises smoothly | Average bot kills per minute rises with each preset step; no step more than 2x the previous |
| LT-H-036 | §15 DIF-002 | Laptops | Custom difficulty sliders | Move each slider to min and max | Each slider changes bot behaviour it names (aim, reaction, awareness, aggression) | Observed change on every slider, measured with `__CTK.bots.debug` |
| LT-H-037 | §1 VIS-005, §16 BOT-003, BOT-004, BOT-040 | Laptops | Hardest difficulty, `__CTK.bots.debug(true)` | Stand hidden behind a solid wall near a bot for 30 s | Bot does not know where you are | Bot never aims at or paths straight to the hidden player without a sound or sight cue |
| LT-H-038 | §16 BOT-003, BOT-040 | Laptops | Hardest difficulty | Sneak up behind a bot outside its view cone | Bot has a field of view, not 360 degree vision | Bot reacts only after a cue (sound, damage, teammate callout) |
| LT-H-039 | §16 BOT-006 | Laptops | Hardest difficulty | Peek a bot 20 times, record reaction time (screen recording) | Reaction time is human-like with jitter | No first shot earlier than 150 ms (floor); mean within 20% of the tier reaction value |
| LT-H-040 | §16 BOT-030, BOT-031, BOT-040 | Laptops | Hardest difficulty | Strafe at medium range 60 s; count hit percentage | Bot aim has error and misses | Hit rate below the tier cap in the spec BT table; no instant 360 turns; no aim through smoke |
| LT-H-041 | §16 BOT-033 | Laptops | Projectile weapons vs hardest bots | Fire 30 rockets at bots | Bots do not dodge perfectly | Hardest tier (BT7) dodges at most 60%; no dodge of unseen projectiles |
| LT-H-042 | §16 BOT-010, BOT-011, BOT-012 | Laptops | Every hand-made map, 15 bots, 10 min | Watch for bots standing still or walking into walls | Bots never stay stuck | No bot without progress over 6 s; recovery steps at 1.5 s (jump/strafe), 3 s (repath), 6 s (new goal) seen in debug log |
| LT-H-043 | §16 BOT-010, BOT-012, §18 MAP-023 | Laptops | Procedural seeds 1 to 20, 7 bots, 3 min each | Same as LT-H-042 | Bots navigate generated maps | Zero bots without progress over 6 s across all 20 seeds |
| LT-H-044 | §16 BOT-010 | Laptops | Map with ladders, jump pads, drops, doors | Watch bots use each | Bots use every traversal link the map has | Each link used by a bot at least once in 5 min |
| LT-H-045 | §16 BOT-050, BOT-051 | Laptops | Team mode, player as leader | Give each comm-wheel order (Attack, Defend, Hold here, Follow me, Freelance, Regroup, Cover me, Take point) to one bot, squad, all | Bots obey and acknowledge | Bark acknowledgement within 0.5-1.5 s; matching goal in debug view within 2 s |
| LT-H-046 | §16 BOT-060, BOT-061, BOT-062 | All | Team mode | Ping an enemy, a location, an item | Teammates react to pings | At least 1 bot responds to each ping type; ping visible on HUD |
| LT-H-047 | §16 BOT-070, BOT-020 | Laptops | Bots with different personalities | Watch each personality for 3 min | Personalities play differently (camper, rusher, sniper, support) | Debug stats (distance travelled, average range, time near objective) differ by at least 30% between personalities |
| LT-H-048 | §16 BOT-050, BOT-071, BOT-080 | Laptops | Team modes | Watch allied bots | Allied bots help: play objective, do not block doors, no team kills | Zero team kills by bots with friendly fire on; allies capture objectives |
| LT-H-049 | §15 DIF-003 | Laptops | Auto-adjust on (off by default) | Win 5 matches by a big margin, then lose 5 | At most +/-1 tier per match, shown on scoreboard, no hidden rubber-banding | Tier change visible on scoreboard; default is off |
| LT-H-050 | §16 BOT-070, §1 VIS-005 | Laptops | Any mode | Ask "are bots labelled?" Look at scoreboard and name tags | Bots are always clearly marked as bots | Every bot has a bot tag in scoreboard and kill feed |
| LT-H-051 | §17 NPC-001, NPC-004, NPC-006 | All | Each PvE enemy type, via horde or test room | Fight each enemy | Each enemy attacks, takes damage, dies per spec; weak points work | Health and damage within 5% of spec; weak point multiplier works |
| LT-H-052 | §17 NPC-002 | Laptops | Boss or elite enemies | Fight each; read hit areas | Hitboxes match the visible body; attacks are telegraphed | No hits register on empty space; every attack telegraphs at least 0.4 s; parryable green, unblockable red |
| LT-H-053 | §17 NPC-005, NPC-007, NPC-008, §16 BOT-012 | Laptops | Horde, wave 10+, max enemies | Watch enemies path to player | Enemies do not pile up stuck at doors; waves spawn out of sight at least 18 m away; finite spawner budget | No group stuck over 6 s; HUD remaining-enemies count reaches 0 |
| LT-H-054 | §18 MAP-001, MAP-002, MAP-010, MAP-011 | Laptops | Seeds 1 to 50 | `__CTK.map.check()` spawn report | Spawns are spread and safe | Every spawn has at least 2 exits; no spawn in direct line of another team's spawn |
| LT-H-055 | §18 MAP-020 | Laptops | Same seed twice | Generate seed 1234 twice on two devices | Same seed gives same map | Map hash in `__CTK.map.check()` identical across runs and devices |
| LT-H-056 | §18 MAP-003, MAP-004 | All | Each hand-made map | Count dark campable corners; check lighting | No pitch-black areas | Every walkable spot readable at default brightness |
| LT-H-057 | §19 PRG-003 | All | Tournament ladder (8 tiers BT0-BT7, 3-4 matches each) | Play the first 3 ladder matches; win (top 3 in FFA, win in team) and lose | Ladder advances on win, lets retry on loss | Progress saved after each step; retry restarts the same step |
| LT-H-058 | §19 PRG-004, §18 MAP-030 | All | All 20 challenge rooms and every puzzle chamber | Play each, complete and fail | Each is completable, restarts fast, gives 1-3 stars; Expert unlocks at 2 stars | Every room solvable; restart under 2 s; stars saved |
| LT-H-059 | §19 PRG-010, PRG-011, PRG-012, §12 ECO-002 | All | Offline progression | Earn XP and unlocks over 3 matches | XP and unlocks granted as shown; unlocks are sidegrades or cosmetics only; "Unlock everything" option works | Rewards equal the result screen; no unlock changes raw stats; no timers, logins or crates anywhere |
| LT-H-060 | §13 MODE-003, §20 UI-010, §5 INP-003 | All | Any mode | Hold scoreboard key/button | Scoreboard always available | Opens within 1 frame; shows all players, scores, ping-free bot tags |
| LT-H-061 | §20 UI-001 | All | All menus | Time each menu screen open and back | Menus are fast | No screen over 1 s to open (UI-001), target under 200 ms; back always 1 press |
| LT-H-062 | §20 UI-001, §19 PRG-001, §24 ARC-021 | All | Play a mode, quit, open the game again | Check the play menu | Last mode, map and settings remembered | Last used setup preselected after reload |
| LT-H-063 | §5 INP-005 | Phones | Touch layout editor | Move, resize, change opacity of every touch control; save; reload | Layout saved and used in play | Positions identical after reload; no control can be placed off-screen |
| LT-H-064 | §5 INP-005 | Phones | Touch layout editor | Reset to default | Default layout restored | Every control back to default position |
| LT-H-065 | §5 INP-002 | Laptops | Key rebinding | Rebind every action, including to mouse buttons; reload | Rebinds work and persist; conflicts warned | All rebinds work after reload; conflict warning appears |
| LT-H-066 | §5 INP-007 | D8 | Pad plugged in mid-match | Plug in, then unplug and plug a different pad type | Hot-plug detected; prompts change to the pad's glyph style | New pad works within 2 s; prompts update |
| LT-H-067 | §5 INP-001, INP-006, INP-007 | Laptops, Phones | Sensitivity and invert-Y options | Set min, max, invert | Look speed and direction follow settings | 360 degree turn distance scales linearly with sensitivity value |
| LT-H-068 | §21 ACC-002, ACC-003 | All | Subtitles/captions for sound cues | Turn on; trigger footsteps, gunfire, announcer | Visual cues shown for important sounds | Every announcer line and directional danger sound has a caption or indicator |
| LT-H-069 | §22 AUD-002, AUD-007 | All | Stress level max | Many explosions at once for 30 s, master volume max | No clipping; at most 24 voices (12 on Potato), low-priority sounds stolen first | Master output never clips (analyser peak at or below 0 dBFS); audio time at or below 0.3 ms per frame |
| LT-H-070 | §22 AUD-003, AUD-004 | All | Any match | Listen for enemy footsteps and gunfire direction with stereo headphones and phone speaker | Positional audio is readable | Tester names the correct side 8 of 10 times; footsteps locatable at 15 m on phone speaker |
| LT-H-071 | §16 BOT-001, §6 MOV-010 | Laptops | Each movement preset, F9 debug view | Measure a bot's ground speed and jump apex as in LT-H-001 | Bots move with exactly the player's preset values | Bot speed and apex within 5% of the player's on every preset |
| LT-H-072 | §7 HP-007, §16 BOT-071 | All | Squad mode with downed state | Get downed; let a bot ally revive; get downed with an enemy within 10 m | Crawl 1.2 m/s, bleed-out 30 s, revive 5 s; bots revive only when safe | Bot revives within 30 s when no enemy visible within 10 m; never revives under open fire without smoke |
| LT-H-073 | §18 MAP-014 | Laptops, D1 | Forge-lite editor | Place brushes, spawns, item pads, an objective; save; reload; press test-play | Map saved and playable with bots | Map identical after reload; test-play starts; placing object 401 is refused with a message |
| LT-H-074 | §8 WPN-012, §6 MOV-021 | Laptops, Phones, D8 | A sprint-capable ruleset (Modern Ops RS04), any gun | Sprint forward for 2 s, then tap Fire once (mouse click, touch FIRE, pad trigger) without holding; repeat with Alt on a gun whose Alt shoots | The sprint stops, and one shot (or Alt shot) leaves as soon as the short sprint-to-fire wait ends (about 0.35 s); the tap is never lost, and holding the sprint key through the tap does not start the sprint again before the shot | 10 of 10 taps shoot on all three inputs |
| LT-H-075 | §8 WPN-012 | All | Give W06 Hush, W10, W20, W26, W27 or W36 plus a second gun (`__CTK.give`); spend the magazine and reserve (set both to 0) | Press Fire on the empty gun, then press Alt | Fire clicks once, "Out of ammo: <gun>" shows and the second gun is raised; with the gun alone, "Out of ammo" shows and it stays in hand; Alt still shoots from its own pool, or says "Alt: no ammo" | Never a silent dead trigger; the HUD ammo reads NO AMMO |
| LT-H-076 | §8 WPN-012 | All | W40 Fusion Mortar with the normal loadout (1 round, 1 in reserve) | Fire, then press Alt within 1 s while it reloads | The orb explodes at once; the reload goes on | 10 of 10 shots can be detonated with Alt |
| LT-H-077 | §8 WPN-012 | All | W07 Sparklock Pistol (lock-on primary) and W31 Ramjet (lock-on Alt) | Hold the trigger with nothing in front for a second; then aim at an enemy within the cone; tap W31 Alt at nothing | Nothing in front: a dry click and "No target" once per hold; an enemy: a ring fills around it and turns into a red ring with a diamond when locked, and shots follow; W31 Alt tapped at nothing clicks and says "No target" | Cue on every empty hold; no cue while a lock builds |

### 6.3 Medium (LT-M)

| ID | Area | Device(s) | Setup | Steps | Expected result | Pass criterion |
|---|---|---|---|---|---|---|
| LT-M-001 | §1 VIS-005, §19 PRG-008 | All | New tester, no instructions, fresh profile | Play first 10 min (Firing Range is offered first, skippable) | Tester understands goal, controls and fun loop without help | Tester explains the goal and wins at least 1 fight on the easiest difficulty |
| LT-M-002 | §1 VIS-002 | All | Fresh profile | Read every visible name (weapons, maps, modes) | Only original names | No real brand, game or faction name anywhere |
| LT-M-003 | §4 DATA-004 | Laptops | Debug HUD on | Compare weapon stats screen with `__CTK` data dump for 10 weapons | UI shows the real data values | All 10 match exactly |
| LT-M-004 | §4 DATA-001, DATA-003 | Laptops | Units overlay (if any) | Measure a 1 m test block against player height | Units are consistent | Player eye height and block size match spec units |
| LT-M-005 | §6 MOV-001 | All | Each preset | Switch preset in menu, start match, read preset name on HUD/pause | Active preset is always visible | Pause screen shows the active movement and health preset |
| LT-M-006 | §5 INP-004 | Phones | Touch stick sprint (default: two edge pushes) | Push stick to edge twice within 0.4 s | Sprint triggers on the second edge push; a single push never sprints | Sprint starts 10 of 10 times |
| LT-M-007 | §5 INP-002 | Laptops | Crouch toggle vs hold | Set each option | Both behaviours work | Crouch state matches option in 10 of 10 presses |
| LT-M-008 | §20 UI-003, §7 HPP01-HPP09 | All | Each health preset | Read HUD health/armor/shield bars while taking damage | HUD layout matches the preset (no shield bar on no-shield presets) | No unused bars shown |
| LT-M-009 | §20 UI-003 | All | Any match | Take damage from 4 directions | Damage direction indicator points to the attacker | Indicator direction correct 4 of 4 |
| LT-M-010 | §8 WPN-010 | All | Weapon wheel / switch | Switch quickly through all carried weapons | Switch time follows spec; last-weapon quick switch works | Switch times within 0.05 s of spec |
| LT-M-011 | §8 WPN-003, WPN-004 | All | Each weapon | Look at crosshair, spread and recoil while firing | Crosshair shows real spread | Shots land inside the crosshair circle 95% of the time |
| LT-M-012 | §8 WPN-001, §20 UI-004 | All | Scoped/zoom alt fires | Zoom in and out; check sensitivity | Zoomed sensitivity follows the option | Zoom sensitivity scale applied |
| LT-M-013 | §8 WPN-007, WPN-009 | Laptops | Weapon pickups on map | Walk over owned and new weapons | Ammo or weapon granted; full ammo pickups left on floor | Ammo never above max |
| LT-M-014 | §9 GAD-002 | All | Grenade throw | Throw with short and long hold; watch arc preview | Arc preview matches the real path | Grenade lands within 1 m of preview end |
| LT-M-015 | §9 GAD | All | Gadget HUD | Use gadgets until empty | HUD count and empty state correct | Count never below 0; empty icon greyed |
| LT-M-016 | §10 ABL-002, §7 HP-005 | All | Ability + powerup + weapon effect at once | Activate all three | Effects combine per spec, HUD shows all | All three active icons visible with timers |
| LT-M-017 | §10 ABL-003 | Laptops | Ability descriptions | Read each ability tooltip, then use the ability | Text matches behaviour | Every tooltip states range, duration, cooldown that match spec |
| LT-M-018 | §11 PWR-001 | All | Pickup spawn timers | Take an item, time the respawn | Health 35 s, armor 25 s, powerups 120 s (first 45 +/- 15 s); 10 s warning before power items | Within 0.5 s of spec |
| LT-M-019 | §11 PWR-003 | All | Powerup on dead player | Die while powered up | Powerup drops with its remaining time (at least 5 s) | Dropped item shows remaining time 3 of 3 times |
| LT-M-020 | §12 ECO-001 | All | Buy menu | Open buy menu, buy, sell back (if allowed), close | Buy menu fast and clear; cannot overspend | Money never negative; menu opens under 200 ms |
| LT-M-021 | §13 MODE-001 | All | Each mode | Read the mode intro/rules card | Each mode explains its win rule in one screen | Every mode has a rules card |
| LT-M-022 | §20 UI-013 | All | Team modes | Check team colours on HUD, map, name tags | Team colours consistent everywhere | Same colour per team in every UI element |
| LT-M-023 | §13 MODE-001 | Laptops | Modes with overtime/sudden death | Force a tie | Overtime starts and is announced | Announcement and HUD timer change |
| LT-M-024 | §13 MODE | Laptops | Last-player-standing modes | Die early | Spectator view works; can skip to result | Spectate cycles players; skip works |
| LT-M-025 | §14 MUT | All | Mutator list | Hover/tap each mutator | Each has an icon, name and short description | Every mutator has all three |
| LT-M-026 | §14 MUT-003, §6 MOV-001 | Laptops | Low gravity + jump-heavy movement preset | Jump around the map | No getting out of map bounds | Player never leaves the playable area |
| LT-M-027 | §14 MUT | Laptops | One-Shot (X08) + shields preset | Play 3 min | Rule priority is clear and stated | Rule shown in match summary matches what happens |
| LT-M-028 | §14 MUT-002 | Laptops | Random mutator option | Start 10 random matches | Random picks only compatible sets | 10 of 10 compatible; chosen mutators listed on load |
| LT-M-029 | §15 DIF-001, §21 ACC-007 | All | Easiest preset | New player plays 3 matches | Easiest bots are beatable and still move and shoot | New player wins at least 1 of 3 |
| LT-M-030 | §15 DIF-001 | Laptops | Pause mid-match | Change difficulty sliders from pause | Change applies at once and no achievement is locked | Bot stats change within 5 s of resume |
| LT-M-031 | §16 BOT-020, BOT-021 | Laptops | Bots and items | Watch bots collect health/ammo when low | Bots seek health when hurt | Hurt bots go for health in at least 50% of cases where one is near |
| LT-M-032 | §16 BOT-080, §13 MODE-004 | Laptops | Bots vs objectives | Watch bots in each objective mode | Bots play the objective, not only deathmatch | Bots score objective points in every objective mode |
| LT-M-033 | §16 BOT-034, BOT-035, §10 ABL-003 | Laptops | Bots with gadgets/abilities | Watch 5 min | Bots use gadgets and abilities sensibly | Each bot uses at least one ability per life; not into walls |
| LT-M-034 | §16 BOT-100 | Laptops | Bot names and chatter (if any) | Watch kill feed and chat | Original, friendly bot names; no spam | At most 1 bark per bot per 5 s and 1 per team per 1.5 s; chatter option can turn it off |
| LT-M-035 | §16 BOT-020, BOT-041 | Laptops | Bot camping check | Count time bots stay in one spot | Bots move around except camper personality | Non-camper bots never hold one spot over 20 s without a goal |
| LT-M-036 | §17 NPC-007 | All | PvE enemy variety | Play horde waves 1 to 15 | New enemy types appear over time | At least the spec number of types by wave 15 |
| LT-M-037 | §17 NPC-002, NPC-004 | All | Enemy counters | Read the in-game hint for each special enemy | Every special enemy's counter is explained | Hint shown on first meeting |
| LT-M-038 | §18 MAP-021, MAP-022 | All | Procedural options | Change size, theme, density; generate | Options change the output | Each option gives a visibly different map |
| LT-M-039 | §18 MAP | All | Map select screen | Look at previews | Each map has a preview, size and suggested player count | All maps have the three |
| LT-M-040 | §18 MAP-020 | All | Procedural map | Share/copy seed, enter it again | Seed visible and re-enterable | Same map from typed seed |
| LT-M-041 | §19 PRG-003 | All | Ladder screen | Read opponents, rules and rewards before a step | Next step's rules shown before start | Rules and reward listed |
| LT-M-042 | §19 PRG-004, PRG-006 | All | Challenge rooms and Daily Seed | Look at star targets; play Daily Seed twice | Targets clear; best time and Daily Seed best score saved locally; no streak penalty | Best values persist after reload |
| LT-M-043 | §19 PRG-014 | All | Stats page | Play 3 matches, open stats | Kills, deaths, accuracy, playtime update | Numbers equal the sum of the 3 result screens |
| LT-M-044 | §20 UI-003, UI-005, §19 PRG-013 | All | Kill feed and hit markers | Get kills with different weapons | Kill feed shows weapon icon; hit marker on hit | Every kill in feed; marker on every hit |
| LT-M-045 | §24 ARC-021 | All | Options menu | Change each option, then reload the page 1 s later | Every option applies instantly and is saved within 500 ms | Option kept after a reload done 1 s after the change |
| LT-M-046 | §20 UI-010, UI-011 | All | Match result screen | Finish a match | Shows winner, scores, medals, per-weapon accuracy, XP, "play again"; killcam-lite on death is skippable | "Play again" restarts same setup in 1 press |
| LT-M-047 | §20 UI-015, §21 ACC-008 | Phones | Small-screen phone (5 inch) | Open every menu | No text cut off; buttons at least 44 px | All buttons at least 44 by 44 CSS px |
| LT-M-048 | §5 INP-010 | D8 | Menus with pad | Navigate every menu | Focus always visible; back button works | No menu where focus is lost |
| LT-M-049 | §21 ACC-001, §20 UI-013 | All | Colour-blind modes | Protanopia, deuteranopia, tritanopia; view teams, enemies, pings, markers | Colours stay distinguishable; team icons differ by shape | Tester tells teams apart in all modes, also by shape alone |
| LT-M-050 | §21 ACC-005, §20 UI-016 | All | Reduced motion / camera shake off / head bob off | Play with options on | Shake and bob are removed | No camera shake with option on; flashbang darkens instead of white; photosensitivity mode at most 3 flashes per second |
| LT-M-051 | §20 UI-016 | All | FOV slider | Set FOV 60 and 120 (defaults 90 desktop, 80 phone) | FOV changes, viewmodel not broken | FOV matches value; no stretched HUD |
| LT-M-052 | §21 ACC-004, §5 INP-002 | All | Hold-to-toggle options (Alt, crouch, sprint) | Toggle each | Each hold action has a toggle option | All hold actions toggleable |
| LT-M-053 | §5 INP-008, §21 ACC | All | Aim assist (touch/pad) | Set off, low, high | Aim assist strength changes; off means none | Slowdown inside 3 deg of a visible enemy only when on; never active with mouse; off near smoke and cloaked targets |
| LT-M-054 | §21 ACC-006 | All | Volume sliders | Set master, SFX, UI, voice/announcer, music to 0 and max; mono audio on | Each slider controls only its channel | Each channel silent at 0 |
| LT-M-055 | §22 AUD-002, AUD-005 | All | Many simultaneous sounds | Fire 3 weapons and explosions | Important sounds (footsteps, low health) still audible | Priority sounds never dropped |
| LT-M-056 | §22 AUD-006 | All | Synth music | Play 10 min | Music loops cleanly, no harsh repeats | No click at loop point |
| LT-M-057 | §3 PERF-008, PERF-013, §23 REN-008 | All | Quality presets low/medium/high/auto | Switch each in play | Change applies without reload; perf HUD reflects it | Visible change; no crash; first-run benchmark picks Low or Potato on D1; fps under 60 for 5 s lowers one step with a toast |
| LT-M-058 | §3 PERF-007, §23 REN-005 | All | Render scale slider | Set 50% and 100% | Resolution changes; HUD stays sharp | HUD text sharp at 50% render scale |
| LT-M-059 | §24 ARC-020 | Laptops | Two tabs of the game open | Change options in tab A, then play in tab B | No save clobbering | Later save wins or game warns about second tab |
| LT-M-060 | §2 PLT-007 | Laptops | Save export (Blob download) and import (file input) | Export save, clear storage, import | Full restore | `__CTK.save.dump()` identical before and after |
| LT-M-061 | §15 DIF-004 | All | PvE encounter | Die 3 times in the same encounter | "Guardian Plate" retry (-50% damage) offered once | Offer appears after death 3, only once per encounter |
| LT-M-062 | §18 MAP-023 | Laptops | Generator, a seed that fails validation (ask dev for one, or `__CTK.map` forced fail) | Generate it | Retries seed+1 up to 5 times, then falls back to an authored map | Player always lands in a valid map; toast or log names the fallback |
| LT-M-063 | §10 ABL-004, ABL-005 | All | Time Bend (A19) and Wrath Form (A34) | Use A19 in a single-player mode and in a versus bot mode; trigger A34 | A19 slows the world in SP, becomes an r8 slow field in versus; A34 timer visible; souls home within 6 m | Both behaviours seen; no world slow-down in versus |
| LT-M-064 | §7 HP-005 | All | Weapons/abilities with burn, chill, shock | Apply each status to a dummy; stack chill 3 times | Burn 10 HP/s 4 s; 3 chill stacks freeze 3 s; frozen target takes x3 on next hit | Values within 5%; status icons shown on target and HUD |
| LT-M-065 | §12 ECO-003 | All | Modern Ops (RS04) streak meter | Earn 300, 500, 800 points through objective play without kills | Score-based (not kill-based) rewards unlock | Rewards at 300/500/800 points even with zero kills |
| LT-M-066 | §28 PWR-001, §8 WPN-009 | All | Any map with item pads, free-for-all and a team mode | Pick up a health pack, an armor, an ammo box, a weapon and wait; watch the pad | The item vanishes the moment it is taken; the pad turns dark with a disc growing from its centre; the item and the lit pad are back exactly at the respawn time (health 35 s, weapon 5 s FFA / 30 s teams) | The pad is never lit while empty; the fill reaches the edge when the item returns |
| LT-M-067 | §5 INP-004 | Phones | Modern Ops (RS04) on touch, Settings > Controls > Touch sprint = Push the stick to its edge twice | Walk at full push for 5 s; ease off and push to the edge again 2 s later; then push to the edge twice quickly | The first two only walk; the quick double push sprints, and it ends when the push falls under 80% or the finger lifts. "One push to the edge" sprints at once; "Never from the stick" never sprints | No accidental sprint in 10 minutes of normal play |
| LT-M-068 | §5 INP-002, INP-004 | All | Settings > Controls, the pause menu help and the touch layout editor | Look for the alternate-fire control | It is called Alt everywhere (control list, "Alt: hold or toggle", touch button ALT); an older save with a moved button keeps its place | No screen still says Aim for this button |
| LT-M-069 | §20 UI-017, §13 MODE | All (touch, gamepad, keyboard / mouse) | Last Squad (M14), Detonate (M13), Last Ring (M20), Ghost Ops (M27), Ravager vs Fiends (M26), Last Standing (M15) with one life, and a custom match started without a player | Get killed (or start the spectator match); after the killcam press Fire, Alt, Reload; fly with the move control, look around, Jump / Crouch; wait for the round or match to end | A chase camera follows a living teammate (an enemy once no teammate lives) with the weapon in hand; Fire / Alt (touch NEXT / PREV) cycle, Reload (touch VIEW) switches to a free camera that flies and looks (touch: UP / DOWN appear) and back; gunfire and footsteps are heard from the camera; the HUD names the player watched; the camera and the buttons are normal again at the next round, the next life or the results | Both views reachable and a target cycle on every input device in all listed modes; no stuck camera; no spectator buttons after the respawn |
| LT-M-070 | §8 WPN-013 | All | Any map, every weapon class (include a launcher, a shotgun, a sniper rifle and a bot with each) | Fire at a far wall and at a bot, then stand with your back to a wall facing it close (hip and ADS) and fire; watch a bot fire at you | Tracers, muzzle flashes and rockets start at the barrel tip of the view model (yours) or the held model (bots'), and meet at the crosshair point; hits land where the crosshair is; against the wall in front nothing passes and the effect starts at the eye | Barrel tip and tracer start look the same on 10 of 10 weapons; no shot through the wall in 3 of 3 close-wall tries |
| LT-M-071 | §5 INP-004, INP-005 (P5-01, P5-02) | Phones (landscape 640x360 to 932x430, with and without a notch) | A match with abilities, a gadget, grenades and a heal item (a hero or class ruleset), once per layout preset (Standard, Compact, Left-handed) | Look at the buttons before any pickup; use each ability, the gadget, a grenade and a heal item; hold a thumb on one while it goes on cooldown; try the flick on LOAD, the slide on DUCK, the hold on SWAP; open Settings > Controls > Edit touch layout and shrink every button | Only the stick, FIRE, ALT, JUMP, DUCK, LOAD, SWAP and pause show at first; ULT (when ready), NADE, HEAL (when hurt) and BUY (during the buy time of a round-buy ruleset, opening the buy menu) appear only while usable and go when spent, A1, A2 and TOOL stay dimmed while they cannot be used and a tap on one does nothing; a button under a finger stays until it lifts; no button is smaller than 44 px, under the notch or on another; the left thumb never has to leave the stick for FIRE, JUMP or ALT | Every thumb zone reachable on 3 of 3 phones; 0 overlapping or clipped buttons; the flick, slide and hold work on 10 of 10 tries; no button shrinks under the floor in the editor |
| LT-M-072 | §5 INP-007 (P5-03) | Laptops, D8 (controller) | Tactical Breach (round buy) with a keyboard, then with a controller | Rebind a key to Q and press it in the match and in the buy menu; press X in the buy menu and in the match; with the controller press View + D-Up (buy menu) and View + D-Left (previous weapon) with 3 weapons carried; open Settings > Controls > Key and button bindings | Q is ability 1 in the match and Quick buy in the buy menu, X is reload and Quick buy, with no red row; the buy button names the key or button of the device in use (none on touch); both chords work; the Controls screen lists every action by its current name (Alt, Walk / hold breath, Quick buy) | Quick buy works on 3 of 3 input types; both chords work on 5 of 5 presses; no stale name on the Controls screen |
| LT-M-073 | §5 UI-002 (P5-04) | All (touch, gamepad, keyboard / mouse) | A new save (or clear `tips.controlCards`), then a first match on each input type | Start a match; read the card; press Got it; start another match on the same input type; pick up another input type mid-match; open the card from Help, Settings > Controls and the pause menu | The card of the input type in use pauses the first match, lists only the core actions with the player's own keys, and resumes with Got it, Esc or B; it never comes back for that type; the other types get theirs once; it opens again from the three menus and switches between types | One card per input type per save; 9 or fewer rows; never shown twice; reachable from 3 of 3 places |
| LT-M-074 | §8 WPN-014 (P6-02) | All (touch, gamepad, keyboard / mouse) | The sandbox weapon set (all 38 weapons), a practice range or a bot match | For each weapon with a magazine: fire a few rounds and reload (partial); empty it and reload (empty); shell guns: reload from 0, from half and from 5 of 6, press fire in the middle of a shell; press next weapon in the middle of a reload; press melee in the middle of a reload; watch a bot reload | The weapon tilts, its magazine (slide, bolt, pump, lid, cell, drum, tank, tube, round) leaves, a spare comes from the belt in a hand and goes in, the weapon comes back to the hold pose on the very frame the counter changes (empty: one extra chamber movement in the same time); a cancelled reload gives no rounds and blends out; the bot's arm, gun and magazine move | 32 of 32 weapons show their set (R1 to R14); the HUD count and the end of the motion are the same frame on 10 of 10 tries; no weapon pops, clips through the screen edge or keeps a part out of its seat after a cancel |
| LT-M-075 | §8 WPN-015 (P6-03) | All (touch, gamepad, keyboard / mouse) | Maul, tanto and bulwark in a bot match; a gun with the quick melee button; a dummy and a wall | Chop with the maul 5 times (held trigger, then taps); charge the alt to full, release at a bot and at the floor; slash and thrust with the tanto; bash and block with the bulwark, parry a green projectile; quick melee with a pistol, a rifle, a launcher and with a melee weapon in the pack; stand a bot in front and hit it; watch a bot get hit and a stunned bot | Each strike looks different; the weapon is at the hit the first frame after the press and is ready again exactly when the next swing is allowed; a held trigger cocks the weapon before the next chop; the hit body leans away from the blow, a stunned body staggers; the wall and floor give a sound and dust; the slam shakes the camera a little | 8 of 8 strikes distinct; the next swing never starts before the pose is back; hit reaction seen on 5 of 5 hits |
| LT-M-076 | §8 WPN-016 (P6-04) | All (keyboard / mouse, controller, touch) | Every weapon in the sandbox set, then each input type | For each weapon: swap away and back; reload (partial, empty, cancelled by a swap, cancelled by melee); quick melee; sprint; hold ADS; sprint while reloading; sprint then fire; change weapon three times quickly | The weapon in hand lowers for about a third of the swap and the new one rises; no pose pops or overlaps in any step; the sprint pose waits for a reload to end and comes back after it; a reload never shows through the sights; the weapon is at the hold pose when it can fire | 38 of 38 weapons on 3 of 3 input types with no visible pop; no animation delays a shot beyond the sim's own ready time |
| LT-M-077 | §8 WPN-017 (P7-02) | All (touch, gamepad, keyboard / mouse) | The sandbox weapon set, a practice range, a bot match; headphones | Fire every weapon at metal, concrete, wood, sand and water; watch the muzzle flash and the walls it lights; reload each weapon (partial and empty) and listen; fire a pump, a bolt rifle, a revolver, a Wasp; listen to a shot from far away (60 to 120 m) | Flash size grows from the Warden to the shotgun; the Hush, the bow and the melee weapons show none; surfaces differ (sparks on metal, dust on concrete, brown dust on wood, dust of the ground's colour on sand, a splash on water); casings fall from kinetic guns only; each reload makes its clicks in order; a distant shot booms and rings on; the last round pings | 38 of 38 weapons on 3 of 3 input types; no frame drop on a Low phone while firing a Wasp at a wall |
| LT-M-078 | §20 UI-005, §8 WPN-017 (P7-02) | All | A bot match with abilities, and the pause menu | Kill a bot with a headshot, then with the body; take damage from the left and behind; let health fall below 35 %; wait for an ability or the ultimate to come back; press the Binding Link, Frenzy Hex, Arc Bolt or Swarm Cloud ability with no enemy in view | The head kill marker and its confirm are gold and higher; damage arcs point at the source; the vignette and heartbeat start below 35 %; a chime and a flashing ring mark each returning ability; the target abilities click and say "No target" without spending anything | 5 of 5 cues on 3 of 3 input types |
| LT-M-079 | §21 ACC-005 (P7-03) | All (touch, gamepad, keyboard / mouse) | Settings > Video, Controls and Audio | Set weapon motion to 0 %, 50 %, 100 %; muzzle flash to off, reduced, full (with photosensitivity mode on and off, with a fast gun and a slow one); vibration strength to 0 %, 50 %; the heartbeat off; camera shake to 0 %; play a short match each time; close the game and open it again | Each setting reaches the game at once and survives a restart; at 0 % the weapon only shows the parts of a reload moving; reduced flash is one small faint particle with no light, photosensitivity mode turns a fast gun's flash off; 0 % vibration never buzzes; no heartbeat when off; no shake at 0 %; a save from before this version opens with the defaults | 5 of 5 settings reachable and effective on 3 of 3 input types |
| LT-M-080 | §8 WPN-013 (P8-04) | All | Any map, the Pitcher Launcher, the Gloop Gun, the Shardcaster alt and the Talon Bow, a flat floor or a far wall | Put the crosshair on the floor or a wall 10 m and 20 m away and fire each; then aim at the sky | The shot lands on the crosshair point (grenades and goo within about 0.5 m, the arrow within about 1.5 m); aimed at the sky or past the shot's reach it flies along the aim as before | 4 of 4 weapons at 2 of 2 distances |
| LT-M-081 | §10 ABL-003, §14 BOT (P8-04) | All | Shield Wars (no downed state) and Modern Ops, the Loadout screen opened in a match | Open the kit tab in both; look at Second Wind; start bots and read what they carry | In Shield Wars the Second Wind row reads "(Needs downed teammates)" and no bot carries it; in Modern Ops the label is gone and bots may carry it | 2 of 2 rulesets |
| LT-M-082 | §8 WPN-006, §14 BOT (P8-04) | All | A free-for-all on Spire and on Gantry with 12 bots, 4 minutes each | Watch what the bots carry (the scoreboard weapon icons or the F9 bot view) | Sidearms other than the Warden, and short guns (Hookjaw, Kindler, Scattergun) on the small map, long guns on the large one; no bot spawns with the Warden every time | 3 of 4 sidearms seen and 4 of 4 classes seen |
| LT-M-083 | §8 WPN-012 (P8-04) | All | Fire the Shardcaster until the 10-round magazine is empty and reload | The reload takes 2 s and the animation follows it | The gun is back after 2 s, not 0.5 s | 1 of 1 |
| LT-M-084 | §14 BOT, ARC-033 (P8-04) | All | A bot match on Gantry, bots with a rifle, a Talon Bow or an Accelerator, `__CTK.bots.debug(true)` | Watch a bot lose its target behind a wall, in smoke or under Ghostveil | Auto fire stops at once; a charge in hand is held or dropped, never released into the dark; the bot looks at the last place it saw the target, not at the target | 3 of 3 ways to lose a target |
| LT-M-085 | §8 WPN (P8-04) | All | Arms Ladder (Gun Game), hold Fire through a promotion | Kill with an automatic gun while holding Fire, then get a burst or semi gun | The automatic gun keeps firing; the burst or semi gun waits for a fresh press and leaves no stale burst rounds | 3 of 3 promotions |

### 6.4 Low (LT-L)

| ID | Area | Device(s) | Setup | Steps | Expected result | Pass criterion |
|---|---|---|---|---|---|---|
| LT-L-001 | §1 VIS-003 | All | Title screen | Look at logo, title and background | Procedural title art looks finished | No placeholder text or debug colours |
| LT-L-002 | §20 UI | All | Every menu | Look for text overflow in every language/scale | No clipped or overlapping text | Zero clipped labels |
| LT-L-003 | §20 UI | All | Menus | Hover/focus every button | Consistent hover/focus/press states | Every button has all three states |
| LT-L-004 | §20 UI | All | Menu transitions | Move through menus | Transitions short and skippable | No transition over 150 ms |
| LT-L-005 | §20 UI | All | Loading between matches | Watch load screen | Shows a tip or map name, not a frozen frame | Tip shown on loads over 1 s |
| LT-L-006 | §20 UI-015 | All | HUD layout presets | Switch HUD presets | All elements stay inside safe area (notch, rounded corners) | Nothing under the notch on D3/D4 |
| LT-L-007 | §20 UI-004 | All | Crosshair editor | Change shape, colour, size | Preview matches in-game crosshair | Exact match |
| LT-L-008 | §23 REN-002, REN-006 | All | Each weapon | Look at viewmodel idle, fire, reload animation | Procedural animations smooth, no popping | No visible snap between states |
| LT-L-009 | §8 WPN, §23 REN | All | Each weapon | Watch muzzle flash, tracers, impact decals | Effects match weapon class | Every weapon has a distinct effect |
| LT-L-010 | §22 AUD-003 | All | Each weapon | Listen to each fire sound | Each weapon has a distinct synthesized sound | Tester tells 10 random weapons apart by sound 8 of 10 |
| LT-L-011 | §22 AUD | All | Menu sounds | Click through menus | Soft, consistent UI sounds | No UI sound louder than gunfire |
| LT-L-012 | §22 AUD-001, §2 PLT-006 | All | Mute on tab hide | Switch tab | Audio fades out, not cut with a pop | No pop heard |
| LT-L-013 | §22 AUD | All | Start/stop of looping sounds (beam, minigun spin) | Start and stop 10 times | No clicks | No audible click |
| LT-L-014 | §23 REN-003 | All | Sky and lighting | Look around each map | No seams or banding in sky | No visible seam |
| LT-L-015 | §23 REN-001, REN-002 | All | Distance | Look far on large maps | Distant objects fade in, not pop in | No pop-in closer than fog distance |
| LT-L-016 | §3 PERF-010 | All | Decals | Shoot one wall 200 times | Old decals fade out cleanly | Oldest decal fades, no flicker (z-fighting) |
| LT-L-017 | §23 REN-002 | All | Player and bot models | Look at bots from all sides | Procedural models have no holes or inside-out faces | No visible holes |
| LT-L-018 | §17 NPC-006 | All | Enemy death | Kill each enemy type | Death effect matches type; bodies cleaned up | Bodies removed within spec time |
| LT-L-019 | §18 MAP | All | Map edges | Walk to map edges | Edges look intentional, not a plain void | Boundary visible |
| LT-L-020 | §11 PWR | All | Pickups | Look at each pickup on the floor | Each pickup readable by shape and colour | Tester names each pickup from 10 m |
| LT-L-021 | §19 PRG-013 | All | Unlock popups | Unlock 3 items | Popup short, not blocking play | Popup only on result screen or under 2 s in play |
| LT-L-022 | §19 PRG-011 | All | Profile/cosmetics | Change name colour or player look (if in spec) | Change shows in game | Visible in match |
| LT-L-023 | §16 BOT-100 | All | Bot taunts/emotes (if any) | Watch after kills | Light and rare | At most 1 bark per bot per 5 s (BOT-100) |
| LT-L-024 | §21 ACC-002, ACC-008 | All | Text size option | Set largest | Text larger without layout breaks | No overlap at largest size |
| LT-L-025 | §21 ACC-006 | All | High-contrast HUD option | Turn on | HUD more readable on bright maps | HUD text contrast at least 4.5:1 |
| LT-L-026 | §5 INP-007 | D8 | Pad rumble | Fire, take damage, explode | Rumble where the browser supports it; option to turn off | Rumble off option works |
| LT-L-027 | §5 INP-002, INP-003 | Laptops | Mouse wheel weapon switch | Scroll fast | One weapon per notch | No skipping |
| LT-L-028 | §20 UI-001 | All | Credits/about screen | Open | Shows version, build date, original-content note | Version equals `__CTK.version` |
| LT-L-029 | §2 PLT-001 | All | Browser tab | Look at tab title and icon | Tab has the game name and an inline icon | Title and icon present with no network |
| LT-L-030 | §20 UI-002 | All | Quit to menu from a match | Quit | Confirmation for ranked/ladder matches only | Quick match quits in 1 press; ladder asks to confirm |
| LT-L-031 | §18 MAP-012 | All | Any hand-made map | Walk into each zone; listen to bot barks | Zone name shows near the minimap and bots use it in calls | Every zone has a name; bark names match HUD |
| LT-L-032 | §16 BOT-062 | All | Team mode | Ping items and enemies | Bot replies (Ok, No, On my way, Dibs, Thanks) show text, icon and a chirp | All three parts present for every reply |

## 7. Smoke-test set (run after every implementation phase)

Run on D1 (or the slowest phone at hand) and D5 at least. About 20 minutes total. Any failure blocks the phase from closing.

| # | Test | Why it is in the smoke set |
|---|---|---|
| 1 | LT-C-001 | Starts from file:// |
| 2 | LT-C-002 | No network use |
| 3 | LT-C-003 | Renders |
| 4 | LT-C-005 | 60 fps floor on target |
| 5 | LT-C-008 | Keyboard and mouse work |
| 6 | LT-C-009 | Touch works |
| 7 | LT-C-011 | Gamepad works |
| 8 | LT-C-013 | Save survives reload |
| 9 | LT-C-014 | Corrupted save recovers |
| 10 | LT-C-021 | Tab switch / phone lock recovery |
| 11 | LT-C-024 | Every mode starts |
| 12 | LT-C-027 | Generator seeds reachable (seeds 1 to 10 only in smoke) |
| 13 | LT-C-032 | Audio starts after first gesture |
| 14 | LT-C-034 | Title to play fast |
| 15 | LT-H-029 | No spawn-killing |
| 16 | LT-H-037 | Bots do not see through walls |
| 17 | LT-H-042 | Bots not stuck (one map, 3 min only in smoke) |

Also run `__CTK.selfTest()` first: if it fails, stop and fix before live testing.

## 8. Release gate

A build may be called a release only when all of these are true:

1. Every Critical (LT-C) and High (LT-H) test passes on the full device matrix D1 to D8 (D8 only for pad tests).
2. The 60-minute soak (LT-C-031) and max stress (LT-C-030) pass on D1 and D5 on the same build.
3. Zero open Critical or High bugs. Medium bugs: each one is either fixed or written down with a reason in the release notes.
4. `__CTK.selfTest()` passes on every device in the matrix.
5. Every regression test in section 9 passes.
6. The results table (date, build, tester, device, pass/fail per test) is saved next to this file or in the release notes.

## 9. Reference-game mistakes and their regression tests

Each mistake found in the research notes (`research/*.md`, "Mistakes to avoid" and "Bots and AI") maps to at least one live test.

| Mistake seen in reference games | Regression test(s) |
|---|---|
| Spawn-killing and spawn trapping around spawn points | LT-H-029, LT-H-030, LT-H-017, LT-H-054 |
| Bots cheating: wallhack knowledge, 360 degree vision, instant reactions | LT-H-037, LT-H-038, LT-H-039 |
| Bots with inhuman aim and perfect projectile dodging | LT-H-040, LT-H-041 |
| Bots stuck on geometry or bad path data, retrying forever | LT-H-042, LT-H-043, LT-H-044, LT-H-053 |
| Bots too easy or too hard, difficulty jumps between steps | LT-H-035, LT-H-036, LT-M-029 |
| Poor ally AI that blocks or ignores objectives | LT-H-045, LT-H-048, LT-M-032 |
| Bots hidden or unlabelled among players | LT-H-050 |
| Missing scoreboard | LT-H-060 |
| Slow menus, extra clicks, game forgets last mode, settings not saving | LT-H-061, LT-H-062, LT-C-034, LT-C-013 |
| Ability clutter on screen, too many systems | LT-H-019, LT-M-016 |
| Snowballing: leader keeps the best armor and powerups | LT-H-021 |
| Frame-rate dependent fire rate or movement | LT-H-002, LT-H-012 |
| Performance locking out low-end hardware; poor scaling with settings | LT-C-005, LT-C-006, LT-C-030, LT-M-057 |
| Frame drops in heavy combat | LT-C-007, LT-C-030 |
| Audio you can only hear on good headphones; audio bug muting everything | LT-H-070, LT-C-032, LT-C-033, LT-M-054 |
| Overcomplicated economy without HUD help; unclear loss-bonus rule | LT-H-022, LT-M-020 |
| Small dark campable maps; getting lost | LT-H-056, LT-M-035, LT-L-019 |
| Explosive spam ("noob tube") dominating close maps | LT-H-015, LT-H-032 |
| Unclear enemy counters and hit boxes | LT-M-037, LT-H-052 |
| Encounters too long, slow restarts | LT-H-058 |
| Paid or grind-only advantages, timed rentals | LT-H-059 |
| Weak practice bots and test room | LT-M-029, LT-H-051 |
| Awkward controls on non-mouse devices, limited key rebinding | LT-C-009, LT-C-011, LT-H-063, LT-H-065 |
| Login, registration or network friction | LT-C-001, LT-C-002, LT-C-040 |
| Save format changes breaking old saves | LT-C-016 |
| Unannounced changes breaking bot routes | LT-H-043 (run after any map change) |
| Disorienting camera effects (motion sickness) | LT-M-050, LT-M-051 |
| Crowded or chaotic matches at high player counts | LT-C-029, LT-H-030 |
| Mode churn: modes removed or broken by updates | LT-C-024, LT-C-025 |


## 10. Preset matrices (expected values for LT-C-035, LT-C-036, LT-H-001 to LT-H-009)

Run the named tests once per row. Values come from SPECIFICATION.md §6.3 and §7 (marked **T** there: tunable, so re-read the spec before each run and update this table when they change). Tolerance: 5% unless the spec says otherwise (MOV-026: apex within 2%, ground speed within 1% in the self-test; live tests allow 5% because they are measured by hand).

### 10.1 Movement presets (§6.3, MOV-010 to MOV-027)

| Preset | Ground speed m/s | Jump apex m | Moves to check in LT-H-003 / LT-H-004 |
|---|---|---|---|
| MV01 `arena` | 9.0 | 1.37 | Strafe-jump speed gain (MOV-012), rocket jump (MOV-017), dodge double-tap 9.5 + 4.0 up, cd 0.7 s |
| MV02 `tactical` | 6.0 | 0.99 | Counter-strafe brings spread back within 0.08 s (MOV-025), crouch-jump +0.3 m, bhopCap 1.2 |
| MV03 `modern` | 4.8 | 0.83 | Sprint 6.4 with 5 s stamina, tactical sprint 7.6, slide entry 6.0 boost 8.0, mantle 2.2 m, sprintToFire 0.20 s (MOV-021) |
| MV04 `agile` | 5.1 | 1.28 | Double jump, sprint 7.6, slide-hop, wall-run 1.75 s at 9.5 m/s (MOV-023), mantle 2.0 m |
| MV05 `ravager` | 8.0 | 1.24 | Dash 2 charges refill on ground (MOV-024), extra jump, climb grip surfaces |
| MV06 `knight` | 6.5 | 0.76 | Shield charge 12 m to enemy within 25 m, cd 4 s, block/parry |
| MV07 `vanguard` | 6.8 | 1.38 | No sprint; floaty jump |
| MV08 `parkour` | 6.5 | 1.13 | Bullet jump 14.5 m/s, aim glide 3 s, wall latch 6 s, roll |

Also for every preset: LT-H-002 (60 Hz vs 120 Hz identical, MOV-010), fall damage per the preset's fall row (MOV-015, LT-H-008), water and ladders (MOV-019), no spawn telefrag (MOV-020).

### 10.2 Health presets (§7, HP-001 to HP-007)

| Preset | What to measure in LT-H-006 / LT-H-007 |
|---|---|
| HPP01 `stack` | Start 100 HP / 0 armor; overheal to 200 decays 1/s; armor absorbs 2/3 of damage |
| HPP02 `regen` | Regen starts 5 s after last damage at 25 HP/s; red vignette and heartbeat below 35 HP |
| HPP03 `shield` | Shield 70 + health 50; shield recharge after 5 s at 17.5/s; health regens in thirds after 8 s |
| HPP04 `tactical` | No regen; vest and helmet absorb per armorPen; legs unprotected |
| HPP05 `hero` | Armor flat -5 per hit (max 50% cut, not on beams or burn); shields regen 30/s after 3 s |
| HPP06 `loot` | Shield 50/75/100/125 by rarity; heal only by consumables; downed state in squads (HP-007) |
| HPP07 `ravager` | 100 HP / 50 armor, armor absorbs 50%; finisher gives health, saw gives ammo, burn gives armor |
| HPP08 `suit` | Health regen after 6 s at 20/s; suit energy recharge 25/s after 2 s; Bulwark routes damage to energy first |
| HPP09 `limb` (mutator X49) | Leg below 67% gives -10% speed, below 34% -25%; arm damage adds spread |

### 10.3 Rule-preset bundles (§6.1, MOV-001, MOV-002)

Run LT-C-024 smoke play (2 min) with each bundle RS01 to RS12 (Arena Classic, Arena Tournament, Tactical Breach, Modern Ops, Pilot Rush, Shield Wars, Ravager, Iron Bulwark, Hero Squad, Last Ring, Weave Suit, Frame Runner). Pass: the pause menu "Rules" panel lists the movement, health, economy, precision and meter values from the bundle row, and play matches them. Save 50 custom rulesets; the 51st must be refused with a clear message (MOV-002).

### 10.4 Weapon fire-mode classes (§8, WPN-001 to WPN-011)

LT-H-010 and LT-H-011 cover one weapon per FireMode type: `hitscan`, `projectile`, `beam`, `melee`, `spread`, `charge`, `zoom`, `lock`, `tool`. Extra checks: explosive alt fires do not arm before 6 m (WPN-011); switching is never faster than equipTime (WPN-010); power weapons announced 10 s before spawn (WPN-009); bots and player have the same recoil pattern (WPN-004).

## 11. Spec coverage map

Every section of SPECIFICATION.md has at least one live test. Sections 25 (Out of scope) and 26 (Open questions) have no tests of their own; when an open question is decided, add or edit the matching rows here.

| Spec section | Live tests |
|---|---|
| §1 Vision and pillars (VIS) | LT-C-002, LT-C-034, LT-C-040, LT-H-037, LT-H-059, LT-M-001, LT-M-002, LT-L-001 |
| §2 Platform and constraints (PLT) | LT-C-001 to LT-C-004, LT-C-012, LT-C-013, LT-C-017, LT-C-018, LT-C-020, LT-C-021, LT-C-023, LT-C-039, LT-C-040, LT-C-041 to LT-C-044, LT-M-060, LT-L-029 |
| §3 Performance budgets (PERF) | LT-C-005 to LT-C-007, LT-C-029 to LT-C-031, LT-M-057, LT-M-058 |
| §4 Units and data schemas (DATA) | LT-C-035, LT-H-005, LT-H-009, LT-M-003, LT-M-004 |
| §5 Input and controls (INP) | LT-C-008 to LT-C-012, LT-C-039, LT-H-063 to LT-H-067, LT-M-006, LT-M-007, LT-M-048, LT-M-053, LT-M-071 to LT-M-073, LT-L-026, LT-L-027 |
| §6 Movement and rule presets (MOV) | LT-C-035, LT-H-001 to LT-H-005, LT-H-008, LT-M-005, section 10.1, 10.3 |
| §7 Health, armor, shields, damage (HP) | LT-C-036, LT-H-006 to LT-H-009, LT-M-008, LT-M-009, section 10.2 |
| §8 Weapons (WPN) | LT-C-037, LT-H-010 to LT-H-015, LT-M-010 to LT-M-013, LT-M-070, LT-M-074 to LT-M-079, LT-L-008 to LT-L-010, section 10.4 |
| §9 Grenades and gadgets (GAD) | LT-H-016, LT-H-017, LT-M-014, LT-M-015 |
| §10 Abilities and powers (ABL) | LT-H-018, LT-H-019, LT-M-016, LT-M-017 |
| §11 Powerups and pickups (PWR) | LT-H-020, LT-H-021, LT-M-018, LT-M-019, LT-L-020 |
| §12 Economy and loadouts (ECO) | LT-H-022, LT-H-023, LT-H-059, LT-M-020 |
| §13 Game modes (MODE) | LT-C-024, LT-C-025, LT-H-024 to LT-H-030, LT-H-060, LT-M-021 to LT-M-024, LT-M-069 |
| §14 Mutators and custom match (MUT) | LT-H-031 to LT-H-034, LT-M-025 to LT-M-028 |
| §15 Difficulty (DIF) | LT-H-035, LT-H-036, LT-H-049, LT-M-029, LT-M-030 |
| §16 Bot AI (BOT) | LT-C-029, LT-H-037 to LT-H-050, LT-M-031 to LT-M-035, LT-L-023 |
| §17 PvE enemies (NPC) | LT-H-028, LT-H-051 to LT-H-053, LT-M-036, LT-M-037, LT-L-018 |
| §18 Maps and procedural generator (MAP) | LT-C-026 to LT-C-028, LT-H-029, LT-H-030, LT-H-042, LT-H-043, LT-H-054 to LT-H-056, LT-M-038 to LT-M-040, LT-L-019 |
| §19 Single-player structures and progression (PRG) | LT-H-057 to LT-H-059, LT-M-041 to LT-M-043, LT-L-021, LT-L-022 |
| §20 HUD, UI, menus (UI) | LT-C-020, LT-C-034, LT-H-060 to LT-H-064, LT-M-044 to LT-M-048, LT-M-069, LT-L-002 to LT-L-007, LT-L-028, LT-L-030 |
| §21 Accessibility (ACC) | LT-C-038, LT-H-068, LT-M-049 to LT-M-053, LT-L-024, LT-L-025 |
| §22 Audio (AUD) | LT-C-032, LT-C-033, LT-H-069, LT-H-070, LT-M-054 to LT-M-056, LT-L-010 to LT-L-013 |
| §23 Rendering (REN) | LT-C-003, LT-C-007, LT-C-023, LT-M-057, LT-M-058, LT-L-009, LT-L-014 to LT-L-017 |
| §24 Architecture, saves, self-test (ARC) | LT-C-013 to LT-C-019, LT-C-021 to LT-C-023, LT-C-031, LT-M-059, LT-M-060, section 7 (`__CTK.selfTest()`) |
| Appendix B Mistakes avoided (MIS) | Section 9 |


Added after the spec was finished: LT-H-071 to LT-H-073 (§16 BOT-001, §7 HP-007, §18 MAP-014), LT-M-061 to LT-M-065 (§15 DIF-004, §18 MAP-023, §10 ABL-004/005, §7 HP-005, §12 ECO-003), LT-L-031 and LT-L-032 (§18 MAP-012, §16 BOT-062).

### 11.1 Appendix B (MIS) to live tests

| MIS IDs | Live tests |
|---|---|
| MIS-001 | LT-H-004, LT-M-029 |
| MIS-002, MIS-003, MIS-004 | LT-H-039, LT-H-040, LT-H-038, LT-H-041 |
| MIS-005 | LT-H-042, LT-H-043, LT-C-031 |
| MIS-006 | LT-H-021 |
| MIS-007 | LT-H-002, LT-H-012 |
| MIS-008 | LT-H-061, LT-H-062, LT-M-045 |
| MIS-009 | LT-C-024, LT-C-025 |
| MIS-010 | LT-H-022, LT-M-020 |
| MIS-011, MIS-012 | LT-H-059 |
| MIS-013 | LT-H-015, section 10.4 |
| MIS-014 | LT-H-053 |
| MIS-015 | LT-M-065 |
| MIS-016 | LT-H-056, LT-H-017 |
| MIS-017 | LT-H-060 |
| MIS-018 | LT-H-029, LT-H-030 |
| MIS-019 | LT-C-029 |
| MIS-020 | No test needed (no building mode in scope) |
| MIS-021 | LT-H-035, LT-H-036, LT-C-031 |
| MIS-022 | LT-H-070, LT-H-068 |
| MIS-023 | LT-H-010 (sidearm damage within spec) |
| MIS-024 | Section 10.3 (arena bundles start equal) |
| MIS-025 | LT-M-032, LT-H-027 |
| MIS-026 | LT-H-051, LT-H-053 |
| MIS-027 | LT-H-059 |
| MIS-028 | LT-H-028 (horde scaling stays within its cap) |
| MIS-029 | LT-M-001, LT-H-058 |
| MIS-030 | LT-C-005, LT-C-030, LT-M-057 |
| MIS-031 | LT-H-006 (HPP08 row) |
| MIS-032 | LT-M-037, LT-H-052 |
| MIS-033 | LT-M-061, LT-H-058 |
| MIS-034 | LT-M-063 |
| MIS-035 | LT-L-021 |
| MIS-036 | LT-H-056, LT-L-031 |
| MIS-037 | LT-C-035, LT-H-003 |
| MIS-038, MIS-041 | No test needed (feature not in the game) |
| MIS-039 | LT-M-050 |
| MIS-040 | LT-H-028 (lives per difficulty) |
| MIS-042 | LT-C-031 (soak) |
| MIS-043 | LT-H-038 (awareness meter rises faster when closer) |
| MIS-044 | LT-H-019 |
| MIS-045 | LT-M-001, LT-H-051 |

## 12. Requests to the spec and open items

Status 2026-10-22: the first four rows are now in the spec (ARC-040 hooks and touch toggle, MAP-005 50% target, BOT-093 hit-rate caps); "test hook" tests use the spec API directly. They listed what this plan needed from the spec. Spec IDs with no live test (for example PERF-004 draw-call budgets, ARC-031/032/034 data checks) are covered by `__CTK.selfTest()` only. Section 26 (Open questions) defaults apply until answered: iOS 16 is the minimum for D3 and D4 (Q4); the Skimmer board (MOV-027) is tested on large maps if it ships (Q5).

| Item | Why the live tests need it |
|---|---|
| Add test hooks to `__CTK` (ARC-040): `version`, `seed(n)`, `map.check()`, `stress(level)`, `give`, `god`, `save.dump`, `save.corrupt(kind)`, `log.errors()`, perf p50/p99 | Makes LT-C-014 to LT-C-016, LT-C-027, LT-C-030 and many High tests quick and repeatable on phones without DevTools |
| A touch-friendly way to open the F8 perf HUD and F9 bot view (done: Options > Developer and a four-finger tap) | Phones have no F-keys; perf numbers are pass criteria on D1 to D4 |
| A numeric "leader share of top items" target for LT-H-021 | Spec has spread rules (MAP-005) but no number; this plan uses under 50% |
| Bot hit-rate caps per tier (BT table) quoted in one place | LT-H-040 needs a number per tier |

