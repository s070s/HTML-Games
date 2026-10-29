# Audio API (S06)

Global: `Sound` (never `Audio`). Web Audio synth only, no audio files. Files: `06-audio.js` (engine), `06b-audio-recipes.js` (data + event glue), `06c-audio-music.js` (generative music), tests in `20b-test-audio.js` (group `audio`).

Game code does **not** call Web Audio. It emits the events below; the audio section turns them into sounds. Everything is a no-op while `Game.headless` is true.

## How a sound happens

1. An event handler (generic code in `06b`, rows in `SOUND_EVENTS`) resolves a **recipe id** from the payload, finds the position and the acting actor, and calls `Sound.enqueue(...)`. No allocation: the request becomes one row in typed arrays (`SoundQueue`, 64 rows). Identical requests from the same actor within 2 m in one frame are merged (shotgun pellets make one impact sound).
2. Once per frame (`Loop` phase `audio`, `Sound.update`) the queue is ranked by priority then distance and at most `voices / 6` new voices start (4, Potato 2; a start is 10 to 40 automation calls and a steal about twice that). There is no wall-time cap on starts (the old 0.2 ms budget is gone): the start cap is the only limit, whatever the CPU speed. Each one gets equal-power pan or HRTF position, distance level, distance low-pass, an occlusion low-pass (max 4 `Sound.lineOfSight` rays per frame) and a caption. Sounds that got no voice are still captioned.
3. A voice is a pooled node chain (`24` voices, Potato `12`, `Quality.current().voices`) built when the context is created. Each chain owns its sources (a looping noise source and two oscillators; creating a source node costs about 30 microseconds, so a sound creates **no** node, it only schedules parameter changes). A chain with no sound playing is cut from the output so the audio thread skips it. The shared 2 s noise buffer is created once. When the pool is full the most expendable voice is stolen: lower priority first, then the farther, then the older. A sound that is less important than everything playing is dropped.

Priority (AUD-002), `AUDIO_PRIORITY`: `ui 6 > own 5 > near 4 > explosion 3 > far 2 > ambient 1`. `own` = the sound's acting actor is `Game.playerId`. `near` and `explosion` recipes drop to `far` beyond their `nearRange`.

Cost: `Sound.updateMs` (last frame), `Sound.peakUpdateMs`; the loop (S19) copies it to `Perf.counters.audioMs` (the audio section does not write into a later section). Budget 0.3 ms (AUD-007); the self-test runs 600 frames of a big fight (14 sound requests per frame, full pool, most starts are steals) and checks the average (about 0.05 ms on a desktop) and the 95th percentile.

## Public API

| Call | Meaning |
|---|---|
| `Sound.play(recipeId, x?, y?, z?, sourceActorId?)` | Queue a sound by recipe id. Without `x` it is not positional (centred, no filtering). |
| `Sound.enqueue(recipeIndex, positional, x, y, z, source, gain, pitch)` | Allocation-free form used by the event glue. |
| `Sound.recipeIndex(id)` | Index of a recipe, -1 when unknown. `Sound.recipes[index]`, `Sound.recipeById.get(id)`. |
| `Sound.speak(text)` | Reads text with `speechSynthesis` when `audio.speech` is on (Q3). Called automatically for `announce`. |
| `Sound.unlock()` | Create/resume the context. Called on `pointerdown`, `pointerup`, `keydown`, `touchend`, `click` and on a gamepad button press. |
| `Sound.lineOfSight = fn(ax, ay, az, bx, by, bz) -> bool` | Hook filled by S08 at load (`08a-world.js`): true when nothing solid lies between the points (`World.lineClear`). `null` means nothing is occluded. |
| `Sound.listenerSource = fn(out) -> bool` | Hook for spectate / killcam: fill `out.x, y, z, yaw, pitch` (eye position, radians) to move the listener. Default: the eye of `Game.playerId`; with neither, positional sounds play centred. Owner: the spectator (17h) answers with its camera while it is active and the killcam is not playing, else the previous hook (chain it, as 17h does). |
| `Sound.frameHooks.push(fn(seconds))` | Called each audio frame before the queue is processed (music uses it). |
| `Sound.stats()` | `{ voices, voiceLimit, started, stolen, rejected, queueDropped, updateMs, peakUpdateMs, maxStartedPerFrame, enabled }`. |
| `Sound.triggerCounts[recipeIndex]` | How many times each recipe was triggered (debug / tests). |
| `Sound.canPlay()` | True while a running AudioContext exists (`Sound.stats().enabled`). |
| `Sound.unsupported` | True once the browser has no Web Audio or the context would not start: one `toast`, never retried. |
| `Sound.onVisibility()` | Called on `visibilitychange`: a hidden page suspends the context at once, showing it wakes it. |
| `__CTK.audio` | `{ sound, music, bus, stats() }` for `--eval` sessions. |

Pure functions (testable without a context): `makeVoiceAllocator(capacity)` (`acquire(priority, distance, now, duration)`, `activeCount(now)`), `computeAudioSpatial(out, recipe, x, y, z)` (needs `setAudioListener`), `audioAttenuation(recipe, distance)`, `audioPriorityFor(recipe, distance, own)`, `soundLookup(lookup, payload)`.

## Settings (all `category: 'audio'` unless noted)

`audio.master` 0.8, `audio.sfx` 1, `audio.music` 0.5 (music volume), `audio.heartbeat` true (the low-health heartbeat on or off), `audio.ui` 0.8, `audio.announcer` 0.9 (sliders 0..1, step 0.05; the bus gain is the square of the slider), `audio.musicMode` `auto` (`auto | on | off`: Auto follows the quality preset and is off on Potato, On plays on every preset, Off never plays), `audio.mix` false (iPhone: the page lets other audio, such as the music app, keep playing), `audio.mono` false (category `accessibility`; folds the master bus to one channel), `audio.hrtf` true (HRTF panning only on High and Ultra; ignored with mono), `audio.speech` false (spoken announcer, Q3). Toggles are declared with `options: [false, true]` and `optionLabels: ['Off', 'On']`.

Quality: `Quality.current().voices` (voice limit) and `.music` (what `audio.musicMode` Auto follows; false on Potato).

## Buses

`sfx`, `music`, `voice` (announcer, pings, radio blips), `game` (the three above; faded to 0 on `game.pause`), `ui` (stays audible in the pause menu), `master` -> `limiter` (DynamicsCompressor) -> `clipper` (soft clipper, output never above 0.96) -> destination.

Pause: `game.pause` fades the game buses. Only a `'hidden'` pause (and a hidden page, `Sound.onVisibility`) suspends the context, 150 ms later; every other reason (`menu`, `blur`, pointer-lock loss, `rotate`, `graphics`) keeps it running so a resume that is not a user gesture (the rotate guard) still has sound. `game.resume` undoes it.

AUD-001: the context is created on the first gesture. If it is still not running 1.5 s later one `toast` says sound is blocked. iOS 17+: `navigator.audioSession.type` is `'playback'` (`'ambient'` with `audio.mix`), set at context creation and when a `audio.*` setting changes; older iOS: one `toast` about the silent switch (once, `Save.data.tips.silentSwitch`). With no Web Audio the game says so once (`Sound.unsupported`) and stays silent.

## Events consumed

Payload fields as in `docs/ARCHITECTURE.md`. "Own" = the actor is `Game.playerId`.

| Event | Sound |
|---|---|
| `weapon.fire` | `mode: 'melee'` (quick melee) plays the `melee` swing; else recipe by `weapon` override, else `weaponClass` (see classes below); `mode: 'alt'` plays 15% lower |
| `weapon.reload` `weapon.switch` `weapon.empty` | `reload` `switch` `empty` at the actor |
| `weapon.fire` (second row) | `lastRound` (own, a short ping) when the local player's shot emptied the magazine (`magShare` 0). The first row also: own shots rise to x1.08 in pitch from a quarter of the magazine to empty (P7 F09); a shot heard beyond 35 m rings longer and loses its crack (below, F07) |
| `weapon.cue` | the local player's reload and cycle moments (P7 F11): `reloadOut reloadIn reloadRack shellIn cellCharge`, own and non-positional; the particle cues have no recipe |
| `ability.ready` | `abilityReady` (two notes) or `ultReady` (three), UI bus, for the local player, at most one per 0.5 s |
| `ability.notarget` | `empty` (the dry click) for the local player: a target ability pressed with no target (A-09) |
| `weapon.nolock` | `empty` (the dry click) at the actor: a lock-on trigger with no target (D-F04) |
| `impact` | `impact.<material>` at the point |
| `explosion` | `explosion` / `explosionFire` / `explosionFrost` / `explosionShock` by `element`; level and pitch by `radius` |
| `move.step` | `step.<surface>` at the actor, level by `speed`, own steps 45% |
| `move.jump` `move.land` `move.slide` `move.dash` `move.mantle` `move.wallrun` | `jump` `land` `slide` `dash` `mantle` `wallrun` at the actor |
| `damage` | source = player, target other: `hitTick` (`headshot` when `zone` is `head`); target = player: `damageTaken`, level by `amount` |
| `kill` | killer = player: `killConfirm`; always `death` at the victim |
| `pickup` | `pickup`, `pickupHealth`, `pickupArmor`, `pickupAmmo`, `pickupWeapon`, `powerChime` by the item group (payload `group`, else the item's catalogue row) |
| `ping` | `ping`, `pingDanger` (kind `danger` / `enemy`) |
| `ability.cast` `ability.end` | `abilityCast` `abilityEnd` |
| `ui.click` | by `kind`: `accept` `uiConfirm`, `back` `uiBack`, `move` `uiHover`, `toggle` `uiClick`; the table also has `error` `uiError`, but no code sends that kind |
| `announce` | by `kind`: `overtime` `time` `bomb` `lead` `announceWarn`; `objective` `flag` `capture` `announceObjective`; `power` `announcePower`; else `announce`. Also spoken when `audio.speech` is on |
| `gadget.use` `gadget.place` `gadget.destroyed` | `abilityCast` (own 80%), `gadgetPlace`, `gadgetBreak` |
| `powerup.end` | `abilityEnd` at the actor |
| `world.trigger` | by `kind`: `jumppad` `padLaunch`, `teleporter` `teleport`; ladders, water and hazards stay silent |
| `pve.parry` | `parry` at the actor |
| `pve.core` | `coreDown` sting (not positional) |
| `pve.tell` | `tellAttack`, `tellUnblockable` or `tellParry` by the attack kind (14h `playTellSound`) |
| `medal` | own medals only: `medal`, pitch varies by medal name |
| `game.pause` `game.resume` `setting` `match.start` `match.stop` | pause fades, volume/quality refresh, state reset |

Requested events nobody emits yet (the audio rows exist, the emitters are in other sections):

| Event | Payload | Sound |
|---|---|---|
| `projectile.incoming` | `{ x, y, z, kind, source }` an `incoming` projectile row (rocket, warhead, missile) of a non-ally, once when it comes within 25 m of the local player and closes in (S11 `Projectiles.warnIncoming`) | `rocketWhistle` + alert caption |
| `projectile.bounce` | `{ x, y, z, kind, source }` | `grenadeTick` |
| `item.respawn` | `{ x, y, z, item, group }` | `powerChime` for `group: 'power'`, else `itemRespawn` |
| `bark` | `{ id, text, kind }` bot radio line | `radioBlip` + voice caption |

Derived without events (frame update): low-health heartbeat (switch `audio.heartbeat`, on by default; P7-03) (`Actors.health / maxHealth` of the player below `LOW_HEALTH_FRACTION` (35%, S03 03d), 1.0 s down to 0.5 s between beats), shield break for any actor whose `Actors.shield` drops to 0 while alive.

### Weapon classes

`sidearm shotgun rifle smg lmg dmr sniper rail launcher energy heavy melee tool exotic power` plus the catalogue names `marksman` (= `dmr`) and `explosive` (= `launcher`). Unknown classes play `rifle`. Weapon keys with their own sound (`SOUND_TABLES.weaponOverride`; the self-test checks every key exists in `CAT.weapons`; the long-term home for this is an optional `sound` field on the weapon row): `lancet` (rail), `heron` (sniper), `kestrel` (dmr), `kindler` (flame), `hush` (suppressed), `tanto` (stab), `talonbow` (bowshot).

### Surfaces

Materials `concrete metal wood glass dirt water flesh sparks`; many aliases (`steel`, `grass`, `plank`, ...) map to them in `SOUND_MATERIAL_ALIASES` (P7 F03 added `plate oil hazard trim grip` to metal, `ice light` to glass, `moss` to dirt); unknown names play concrete.

### Distant gunfire (P7 F07)
A recipe with `gun: true` (every weapon-class recipe but melee, tool, flame, suppressed, stab and bowshot) heard beyond 35 m (`AUDIO_TAIL_START`) plays the same voice with its last pulse ringing longer: decay x1 at 35 m up to x(1 + the class's `tail`) at 120 m (`AUDIO_TAIL_END`; `weaponClasses.tail`: sniper 1.6, power 1.5, explosive 1.4, heavy 1.3, the rest 1) and the noise crack fading to nothing. No extra voice. The kill confirm of a head kill is pitched x1.2 (`pitchIf` on the event row, F01).

## Events emitted

- `toast { text }`: sound blocked, silent-switch hint, unsupported browser.
- `caption { text, x, y, z, kind }` (ACC-002/003) for sounds of **other** actors that are audible: `text` is e.g. `[Footsteps left]` (`ahead right behind left`), `kind` is one of `footstep gunfire explosion item voice alert`. The HUD draws the caption and a visual sound ring from `x y z`. Throttled per actor and kind (`captionGap`, 0.35 to 1.2 s). Your own sounds and non-positional sounds (announcer) emit none; the announcer text is already on the HUD banner.

## Recipes (data)

`SOUND_RECIPE_GROUPS` in `06b`: groups share defaults, a row is one sound. Add a sound = add a row, then (if an event should play it) a table entry or an event row. Fields:

- `noise { filter, from, to, q, attack, decay, gain }`: noise burst through a filter sweeping from `from` to `to` Hz.
- `tone { wave, from, to, attack, decay, gain, partial }`: oscillator gliding `from` to `to` Hz; `partial` adds a second oscillator at that ratio.
- `pulses [s]`, `pitchSteps [factor]`: the envelope repeats at each offset with that pitch factor (clicks, chirps, stings). Offsets rise; a pulse's decay is shortened to the room before the next pulse (`layer.decays[pulse]`, built by `finishSoundLayer`) because a Web Audio ramp starts from the previous event on the timeline. The last pulse rings out fully. The recipe test requires at least 10 ms of decay per pulse.
- `retrigger` (seconds, 0 = off): one actor starts the recipe at most that often. All weapon-fire recipes use 0.02 (`SOUND_GUN_RETRIGGER`), so a beam or minigun that emits `weapon.fire` every step starts a sound about every second 60 fps frame, not one per step.
- `bus`, `priority`, `ref` / `rolloff` (level is 1 up to `ref` metres, then `ref / (ref + rolloff * extra)`), `nearRange`, `range` (farther sounds are dropped), `gain`, `occludes`, `caption`, `captionKind`, `captionGap`.

Events whose position is missing or not a finite number, and actor events with an unknown actor id, are skipped.

Event rows (`SOUND_EVENTS`): `event`, `recipe` or `lookup [[payloadField, table], ...]`, `source` (payload field with the acting actor), `pos` (`payload` | `actor` | `none`), `when` (named condition), `gain`, `ownGain`, `gainScale` / `pitchScale { field, from, to, min, max }`, `altPitch`, `pitchBy`, `speak`.

## Spatial rules (AUD-003, AUD-004)

Listener = eye of `Game.playerId`, yaw/pitch from `Actors` (right = `(-cos yaw, 0, sin yaw)`). Default: `StereoPannerNode` (equal power), pan from the horizontal angle. High and Ultra: HRTF `PannerNode` at the listener-space position. Distance: level by `audioAttenuation`, low-pass `18 kHz / (1 + d / 30 m)`, sounds behind the listener 35% duller (front/back cue on one speaker). Occluded sounds (`Sound.lineOfSight` false): low-pass x0.15, level x0.7. Footsteps keep at least 30% of their level at 15 m and are dropped beyond 45 m.

## Music (AUD-006)

`SoundMusic` (`06c`): calm pad, combat bass/arpeggio/hi-hat, boss drone and stabs over Am - F - C - G at 100 BPM. All oscillators are built once when music starts and are only retargeted; the scheduler writes parameter events 0.25 s ahead (no node creation per note). Intensity (0..1) rises with `damage` events involving the local player (up to +0.35 each) or within 25 m (up to +0.15) and decays 0.08 per second; the combat layer fades in between 0.15 and 0.55. A layer that stays silent for 4 s is disconnected from the output (the audio thread then skips its oscillators) and reconnected as soon as it is wanted again. The boss layer plays on top of full combat while a boss fights (`pve.boss` start until defeated or gone, match end or stop); menus play calm only. The Music setting `audio.musicMode` decides: Auto = off on Potato (`Quality.current().music` false), On, Off. Music is also silent at music volume 0. There is no `Sound.setMusicMood`.
