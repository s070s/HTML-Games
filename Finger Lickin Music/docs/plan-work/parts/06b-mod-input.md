### 6.7 M-07 Input (`src/07-input.js`, `FLM.Input`)

#### 6.7.1 Responsibilities and non-goals

Responsibilities:
- Own every physical input source: keyboard (`KeyboardEvent.code`), pointer (mouse, touch,
  pen via Pointer Events only), gamepad (polled), optional Web MIDI.
- Normalize every source into `InputEvent { source, control, type, tPerf, tAudio, pressure }`
  and emit it on `EVT-input.event`. `source` is one of `'keyboard' | 'pointer' | 'gamepad' |
  'midi' | 'system'` (`'system'` is used only for release-all events).
- Keep one logical lifecycle per control (`idle -> pressed -> idle`), suppress duplicate
  presses and key repeat, and release everything on focus loss, page hide, pointer
  cancellation, device disconnect, and mode leave (B 8.1, E 4.1, P 5.1).
- Hold the control maps (per context) and the remap API with conflict detection (B 8.2, B 22).
- Convert `tPerf` to `tAudio` with the anchored offset of Part 4.5 (`Input.perfToAudio`).
- Store the `Calibration` record for the UI; it never applies any offset (Part 5.12; the single
  application point is `FLM.Rhythm.Judge`, 6.9.4).
- Expose `InputState` (held controls, press times, owners) for HUD pads, Mapping, Rhythm.

Non-goals:
- No musical meaning (that is M-08), no judging (M-09), no DOM styling of pads (M-26 toggles
  the pressed class by listening to `input.event`), no persistence (M-27 persists maps through
  M-16 and restores them with `Input.setMap` at boot).
- Two players on one keyboard: Deferred (P2). v1 has exactly one logical player; `InputEvent`
  has no player field. The control name space is reserved so that a `playerIndex` field can be
  added in a later version without renaming controls.
- Touch Events are never listened to for input; one `touchstart` listener exists only to call
  `preventDefault()` (gesture blocking). If OQ-1 fails in XT tests, the fallback is a Touch
  Events path that feeds the same `padPress/padRelease` functions (6.7.9).

Control names (fixed): `lane0 lane1 lane2 lane3`, `dance0 dance1 dance2 dance3` (0 left,
1 down, 2 up, 3 right), `pause`, `panic`, `octUp`, `octDown`, `profile1 .. profile6`,
`sustain`. Raw MIDI notes outside the mapped set are emitted as `midi:<n>` (`n` = 0..127)
only while MIDI pass-through is on (Free Play and Studio recording turn it on).

Contexts (which controls are live): `menu` (none; UI handles its own keys), `instrument`
(lanes, octUp, octDown, sustain, pause, panic), `freeplay` (lanes, octUp, octDown, sustain,
profile1-6, pause, panic, `midi:<n>`), `studio` (same as freeplay), `dance` (dance0-3, pause,
panic).

Default keyboard maps (BRIEF 7):

| Context | Control | Default codes |
|---|---|---|
| instrument, freeplay, studio | lane0 lane1 lane2 lane3 | `KeyA` `KeyS` `KeyK` `KeyL` |
| instrument, freeplay, studio | octDown, octUp | `KeyQ`, `KeyE` |
| instrument, freeplay, studio | sustain | `ShiftLeft`, `ShiftRight` |
| freeplay, studio | profile1 .. profile6 | `Digit1` .. `Digit6` |
| dance | dance0 dance1 dance2 dance3 | `ArrowLeft` `ArrowDown` `ArrowUp` `ArrowRight` and alternates `KeyD` `KeyF` `KeyJ` `KeyK` |
| global (all non-menu) | pause | `Escape` |
| global (all non-menu) | panic | `KeyP`; also `Space` while `FLM.Transport.state() === 'paused'` |

`KeyK` is bound to `lane2` in instrument contexts and to `dance3` in the dance context; this is
not a conflict because conflict detection is per context (global controls conflict with every
context).

Default gamepad map (standard mapping, first connected pad only, fixed in v1, not remappable):

| Gamepad button index | instrument, freeplay, studio | dance |
|---|---|---|
| 0, 1, 2, 3 (bottom, right, left, top face) | lane0, lane1, lane2, lane3 | dance1, dance3, dance0, dance2 |
| 12, 13, 14, 15 (d-pad up, down, left, right) | octUp, octDown, (none), (none) | dance2, dance1, dance0, dance3 |
| 4, 5 (LB, RB) | octDown, octUp | (none) |
| 9 (start) | pause | pause |
| 8 (select) | panic | panic |
| 6, 7 (triggers) | sustain (either) | (none) |

Default MIDI map: notes 60, 62, 64, 65 -> `lane0..lane3` (and `dance0..dance3` in the dance
context); CC 64 >= 64 -> `sustain` press, CC 64 < 64 -> `sustain` release. Remappable through
`remap('midi', control, noteNumber)`.

#### 6.7.2 Public API

```js
/** @namespace FLM.Input */
FLM.Core.define('Input', function (Core, Transport, Audio) {
  return {
    /** Install the window-level listeners (once, at boot: Part 4.3 B9). opts: { keyboardTarget: Window,
     *  padRoot: HTMLElement|null, surface: HTMLElement }. Idempotent: a second call without detach()
     *  throws Core.assert failure 'Input.init twice'. */
    init(opts) {},
    /** Remove every listener, stop MIDI listening, releaseAll('system'). Safe when not attached. */
    detach() {},
    /** Binds the input context of a mode (Part 4.7.1 step 10). opts: { owner, context:
     *  'menu'|'instrument'|'freeplay'|'dance'|'studio', surface?, pads?, controls? }. Releases all
     *  controls that are not live in the new context with source 'system'. */
    bind(opts) {},
    /** Part 4.7.2 step 1: releases the controls of `owner` and returns to the 'menu' context
     *  (the boot-level listeners of `init` stay). */
    unbind(owner) {},
    /** Number of surfaces currently bound through bind() (0 in the menu); assertClean() compares it
     *  with the baseline (Part 4.7.3). */
    boundSurfaces() {},
    /** @returns {string} current context */
    context() {},
    /** Called once per render frame by the active mode: gamepad edge detection + anchor sample
     *  (sample taken only when >= 25 ms since the previous one). @param {number} tPerf */
    pollGamepad(tPerf) {},
    /** Release every pressed control, emitting release events with source 'system'.
     *  @param {'system'|'mode'|'pause'|'device'|'context'} reason  (logged, not emitted) */
    releaseAll(reason) {},

    /** InputState */
    /** @returns {string[]} control names currently pressed, in press order */
    held() {},
    State: {
      /** @returns {boolean} */
      isHeld(control) {},
      /** @returns {number|null} tAudio of the press that owns the control */
      pressedAt(control) {},
      /** @returns {{source:string, physical:string}|null} e.g. {source:'keyboard', physical:'KeyA'} */
      owner(control) {}
    },

    /** Maps. Shape: see 6.7.3 `Maps`. */
    DEFAULT_MAPS: /* frozen copy of the defaults of 6.7.1 */ {},
    getMap() {},
    /** Validates and installs maps; unknown controls/contexts are dropped with Log warnings;
     *  returns {ok:boolean, errors:string[]}. Never throws on bad data (settings may be stale). */
    setMap(maps) {},
    /** Bind a physical code (keyboard code string or MIDI note number) to a control.
     *  @param {'instrument'|'freeplay'|'studio'|'dance'|'global'|'midi'} ctx
     *  @returns {{ok:true}|{ok:false, conflict:{context:string, control:string, code:string}}} */
    remap(ctx, control, code) {},
    /** Remove one binding. @returns {boolean} removed */
    unmap(ctx, control, code) {},
    /** Restore defaults for one context (or all when ctx is undefined). */
    resetMap(ctx) {},
    /** @returns {string[]} control names live in a context (see 6.7.1) */
    controlsFor(ctx) {},

    /** Performance time (ms) -> audio time (s) using the anchored offset of Part 4.5.
     *  Returns null when the AudioContext is not running (no anchor). */
    perfToAudio(tPerf) {},
    /** @returns {{samples:number, offsetSec:number|null, spreadMs:number}} */
    anchor() {},

    /** @returns {{gamepads:[{index:number,id:string,mapping:string}],
     *            midi:{supported:boolean, secure:boolean, enabled:boolean, inputs:string[]}}} */
    devices() {},
    /** User-triggered (Settings). Resolves {ok:true} or {ok:false, code:'E-INP-001'|'E-INP-002'}. */
    enableMidi() {},
    disableMidi() {},
    /** Free Play / Studio: emit unmapped MIDI notes as control 'midi:<n>'. */
    setMidiPassThrough(on) {},

    /** Calibration storage only. @param {{inputOffsetMs:number, audioLatencyMs:number,
     *  visualLeadMs:number}} cal  Values are clamped: offsets -500..500, lead 600..3000. */
    setCalibration(cal) {},
    /** @returns {Calibration} a copy */
    calibration() {},

    /** Listener count for FLM.Modes.assertClean(): number of DOM/MIDI listeners installed. */
    listenerCount() {},

    /** Test build only (undefined in the shipped build). Synthesizes events through the same
     *  handlers the browser would call. */
    synthesize: {
      key(code, down, tPerf, mods) {},
      pointer(pointerId, type /* 'down'|'move'|'up'|'cancel' */, x, y, pressure, tPerf, pointerType) {},
      gamepad(stateOrNull /* {index, buttons:[{pressed,value}], mapping} */) {},
      midi(bytes /* Uint8Array */, tPerf) {},
      blur() {}, hidden() {}, pagehide() {}
    }
  };
});
```

Events emitted: `EVT-input.event` (payload: `InputEvent`, one per press or release). Events
consumed: none (Input reads `FLM.Transport.state()` and `FLM.Audio.ctx()` directly; both
are lower-numbered modules).

#### 6.7.3 Internal state

```js
// Per-control lifecycle. Exactly one record per control name.
ControlState { name, pressed:boolean, owner:{source, physical}|null, tAudioPressed:number|null,
               tPerfPressed:number|null }

// Pointer tracking (pads): pointerId -> current pad index (0..3) or -1 (outside all pads)
PointerTrack { pointerId, padIndex, pointerType }
padRects: [DOMRect x4]   // recomputed on resize, orientationchange, bind, init

// Keyboard: physical code -> control resolved at keydown via maps[context] then maps.global
keysDown: Set<code>      // physical keys believed down (cleared on releaseAll)

// Gamepad
gpPrev: { index:number, buttons:boolean[17] } | null   // last sampled button states

// MIDI
midiAccess: MIDIAccess|null; midiInputs: Map<id, MIDIInput>; midiPassThrough:boolean
midiNotesDown: Set<number>

// Anchor ring (Part 4.5): 20 most recent offset samples (audioSec - perfSec)
anchor: { ring: Float64Array(20), n:number, next:number, lastSampleTPerf:number, median:number|null }

Maps {
  version: 1,
  keyboard: {
    instrument: { lane0:['KeyA'], lane1:['KeyS'], lane2:['KeyK'], lane3:['KeyL'],
                  octDown:['KeyQ'], octUp:['KeyE'], sustain:['ShiftLeft','ShiftRight'] },
    freeplay:   { ...instrument, profile1:['Digit1'], ... profile6:['Digit6'] },
    studio:     { same as freeplay },
    dance:      { dance0:['ArrowLeft','KeyD'], dance1:['ArrowDown','KeyF'],
                  dance2:['ArrowUp','KeyJ'], dance3:['ArrowRight','KeyK'] },
    global:     { pause:['Escape'], panic:['KeyP'], panicWhilePaused:['Space'] }
  },
  midi: { lane0:60, lane1:62, lane2:64, lane3:65, sustainCC:64 }
}
```

Invariants:
1. A control is `pressed` for at most one owner at a time; only the owner's release (or a
   release-all) returns it to idle. Presses from a different owner while pressed are ignored.
2. `held()` order equals press order; `pressedAt` is the owner's `tAudio`.
3. `listenerCount()` equals the number of `addEventListener` calls minus removals; after
   `detach()` it is 0.
4. The anchor ring never holds samples from a different `AudioContext` instance (cleared on
   `audio.state` change to a new context, detected by identity comparison each sample).
5. No module other than M-07 reads raw DOM input events for gameplay (UI widgets read their
   own keyboard navigation events in menus only).

#### 6.7.4 Algorithms

A. Timestamping (every source)
1. `tPerf`: for DOM events use `event.timeStamp` when `Math.abs(event.timeStamp -
   performance.now()) < 60000` (it is a performance-origin timestamp); otherwise (epoch-based
   or missing) use `performance.now()`. Gamepad: the `tPerf` passed to `pollGamepad()`. MIDI:
   `event.timeStamp` (always performance-origin per spec; same check applied anyway).
2. `tAudio = perfToAudio(tPerf)` (algorithm B). `null` before the first anchor sample.
3. `pressure`: pointer -> `event.pressure` (0..1; browsers report 0.5 for mouse without
   pressure); keyboard -> 1; gamepad -> `button.value` (0..1); MIDI -> `velocity / 127`.

B. Anchor estimation (`perfToAudio`)
1. `sample()`: let `ctx = FLM.Audio.ctx()`. If `!ctx || ctx.state !== 'running'`, return
   (no sample). If `ctx.getOutputTimestamp` exists and returns `{contextTime, performanceTime}`
   with both finite: `offset = contextTime - performanceTime / 1000`. Else `offset =
   ctx.currentTime - performance.now() / 1000`. Push into the 20-slot ring; set
   `lastSampleTPerf = performance.now()`; recompute `median` (sort a copy of the filled slots,
   middle element, or mean of the two middle elements for even counts).
2. `sample()` is called from `pollGamepad(tPerf)` when `tPerf - lastSampleTPerf >= 25`, and from
   every event handler before computing `tAudio` under the same 25 ms rule (so the first press
   after an idle period gets a fresh sample).
3. `perfToAudio(tPerf) = median === null ? null : tPerf / 1000 + median`.
4. When the context identity changes (Audio rebuilt after hard panic or failure), the ring is
   cleared (`n = 0`, `median = null`).
5. `anchor().spreadMs = (max - min of ring) * 1000`; Diagnostics shows it.

C. Keyboard
1. `keydown`: if `event.repeat` -> return (no preventDefault, nothing emitted). If
   `event.ctrlKey || event.metaKey || event.altKey` -> return (browser shortcuts pass through).
   If `document.activeElement` is `INPUT`, `TEXTAREA`, `SELECT` or `isContentEditable` ->
   return unless the code resolves to `pause`.
2. Resolve `code = event.code || fallbackCode(event.key)`; `fallbackCode` maps a single
   letter a-z to `Key<UPPER>`, a digit to `Digit<d>`, else `''` (unresolvable -> return).
3. Resolve the control: look up `maps.keyboard[context][*]` for the code, then
   `maps.keyboard.global`. `panicWhilePaused` resolves to `panic` only when
   `FLM.Transport.state() === 'paused'`; otherwise unresolved. Unresolved -> return (default
   action allowed). Context `menu` -> return for every code.
4. `event.preventDefault()` for every resolved code (stops Space scrolling, Arrow scrolling,
   Escape leaving fullscreen is left to the browser: Escape is not prevented).
5. If `keysDown.has(code)` -> return (duplicate keydown without repeat flag). Add to `keysDown`.
6. `press(control, {source:'keyboard', physical:code}, tPerf)` (algorithm F).
7. `keyup`: `code` as above; `keysDown.delete(code)`; if the control's owner is
   `{keyboard, code}` -> `release(control, owner, tPerf)`; otherwise nothing (another physical
   key owns it, or it was already released by release-all).

D. Pointer (touch pads and gameplay surface)
1. Listeners on `padRoot` (the `#touch` container): `pointerdown`, `pointermove`, `pointerup`,
   `pointercancel`, `pointerleave` (all `{passive:false}`); on `surface` and `padRoot`:
   `touchstart` and `touchmove` with `preventDefault()` only (`{passive:false}`);
   `contextmenu` -> `preventDefault()`. CSS `touch-action: none` is set by M-26 on both.
2. Pad hit test: `padIndexAt(x, y)` over cached `padRects` (recomputed on `resize`,
   `orientationchange`, `init`, `bind`, and whenever M-26 calls `Input.layoutChanged()`
   after moving pads; `layoutChanged` is an alias of the rect refresh exposed on the namespace).
   The pad control for index i is `lane<i>` in instrument contexts and `dance<i>` in dance.
3. `pointerdown`: ignore if `pointerType === 'mouse' && event.button !== 0`. `i =
   padIndexAt`. If `i < 0` -> return. Record `PointerTrack{pointerId, padIndex:i}`;
   `press(padControl(i), {source:'pointer', physical:'ptr' + pointerId}, tPerf)`. No pointer
   capture is requested (capture would hide pad-to-pad drags).
4. `pointermove` (only for tracked pointers): `j = padIndexAt`. If `j === padIndex` -> return.
   If `padIndex >= 0` -> `release(padControl(padIndex), owner, tPerf)`. If `j >= 0` ->
   `press(padControl(j), owner, tPerf)`. Set `padIndex = j` (may be -1: finger left all pads,
   control released; re-entering a pad presses again).
5. `pointerup`, `pointercancel`, `pointerleave` (leave only when the pointer leaves `padRoot`):
   if tracked and `padIndex >= 0` -> release; delete the track.
6. `lostpointercapture` is not used. A pointer whose `pointerup` never arrives (browser bug)
   is cleaned by release-all on blur/hidden, and by the 10-pointer cap: when an eleventh track
   would be created the oldest track is released and dropped with `Log.warn('INP_PTR_CAP')`.

E. Gamepad (`pollGamepad`)
1. `navigator.getGamepads` missing -> skip. Choose `pad` = the lowest-index non-null gamepad
   with `connected === true`. If none and `gpPrev` exists -> `releaseAll('device')` for
   controls owned by `source:'gamepad'`; `gpPrev = null`; return.
2. If `pad.index !== gpPrev.index` -> treat as a new device: release gamepad-owned controls,
   `gpPrev = {index, buttons: all false}`. If `pad.mapping !== 'standard'` log once
   `INP_GP_NONSTANDARD` and still use the table.
3. For each index b in the table for the current context: `now = pad.buttons[b] &&
   (pad.buttons[b].pressed || pad.buttons[b].value > 0.5)`. Rising edge -> `press(control,
   {source:'gamepad', physical:'gp' + b}, tPerf, value)`; falling edge -> release. Store.
4. `gamepaddisconnected` listener: release gamepad-owned controls immediately (do not wait
   for the next poll).

F. `press(control, owner, tPerf, pressure)` and `release(control, owner, tPerf)`
1. `press`: if control is not live in the current context -> return. If `state.pressed` ->
   return (duplicate from any owner). Set pressed, owner, times. Build `InputEvent` with
   `type:'press'`, `tAudio = perfToAudio(tPerf)`. Emit `input.event`. Append to `heldOrder`.
2. `release`: if `!state.pressed` -> return. If `owner` given and differs from `state.owner`
   -> return. Clear state; remove from `heldOrder`; emit `InputEvent{type:'release'}` with
   the same `source` as the owner (or `'system'` for release-all).
3. `releaseAll(reason)`: for each pressed control in `heldOrder` order emit a release with
   `source:'system'`, `tPerf = performance.now()`; clear `keysDown`, pointer tracks (pads),
   `midiNotesDown`; `gpPrev.buttons` all false; `Log.info('INP_RELEASE_ALL', reason)`.
4. System triggers: `window.blur`, `document.visibilitychange` when `hidden`, `pagehide` ->
   `releaseAll('system')`. `bind` -> `releaseAll('context')` for controls not live in
   the new context (others are kept: e.g. `pause` held across a context change is harmless).
   Modes call `releaseAll('mode')` on leave (Part 4.7).

G. Web MIDI
1. `enableMidi()`: if `!navigator.requestMIDIAccess` or `!window.isSecureContext` -> resolve
   `{ok:false, code:'E-INP-001'}` ("MIDI input needs a secure (https) page and a browser that
   supports Web MIDI."). Else `requestMIDIAccess({sysex:false})`; rejection ->
   `{ok:false, code:'E-INP-002'}` ("MIDI access was denied."). Success: subscribe
   `midimessage` on every input; `statechange` adds/removes inputs. Only one access object is
   held; a second `enableMidi()` while enabled resolves `{ok:true}` without a new request.
2. `midimessage(bytes)`: `status = bytes[0] & 0xF0`. `0x90` with `bytes[2] > 0` -> note on;
   `0x80`, or `0x90` with velocity 0 -> note off. Note `n`: control = mapped lane/dance
   control if `n` matches `maps.midi.laneK` (dance context uses the same numbers for
   `danceK`), else `'midi:' + n` when pass-through is on, else ignored. Note on ->
   `press(control, {source:'midi', physical:'n' + n}, tPerf, velocity/127)`; note off ->
   release by that owner. `0xB0` with controller `maps.midi.sustainCC`: value >= 64 -> press
   `sustain` (owner `{midi, 'cc64'}`), else release. All other messages ignored.
3. `disableMidi()`: remove listeners, release midi-owned controls, drop the access object.

H. Remap and conflict detection
1. `remap(ctx, control, code)`: validate `control` is in `controlsFor(ctx)` (for `'global'`:
   `pause`, `panic`, `panicWhilePaused`; for `'midi'`: `lane0..3`). Invalid -> `{ok:false,
   conflict:null}` with `Log.warn`.
2. Conflict search: the same `code` bound to a different control in the same context, or in
   `global` (for any context), or, when `ctx === 'global'`, in any context. The first conflict
   found (contexts iterated in the order instrument, freeplay, studio, dance, global; controls
   in declaration order) is returned: `{ok:false, conflict:{context, control, code}}`. The UI
   shows `DLG-RemapConflict` (Part 7.7) and offers "Replace" which calls
   `unmap(conflict.context, conflict.control, code)` then `remap` again.
3. A control may have up to 3 codes; a fourth is refused with `{ok:false, conflict:null}`
   and `Log.warn('INP_MAP_FULL')`. A control must keep at least one code: `unmap` of the last
   code is refused (`false`).
4. `setMap(maps)`: deep-validate; unknown keys dropped; codes must match
   `/^[A-Za-z0-9]{1,32}$/`; MIDI notes integers 0..127; conflicts in the supplied data are
   resolved by keeping the first binding and dropping later ones (recorded in `errors`).
   Missing controls fall back to defaults. Installing maps calls `releaseAll('context')`.

I. Context switch: `bind({owner, context})` sets the current context, refreshes pad rects, releases
   controls not live in `ctx`, and clears `keysDown` entries whose code resolves to nothing in
   the new context (so a key held across the switch produces no stale release).

#### 6.7.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| keyup lost (focus loss, OS shortcut, alt-tab) | `blur`, `visibilitychange`, `pagehide` fire; or next keydown of the same code | maps, anchor | automatic | none | none (silent release) | none | `releaseAll('system')` | UT-07-12, UT-07-13 |
| touch ends outside pad or is cancelled | `pointermove` outside rects, `pointercancel`, `pointerleave` | other pads stay pressed | automatic | none | pad pressed state clears | none | release that pointer's control | UT-07-16, UT-07-17 |
| pointerup never arrives | 10-track cap or blur | other tracks | automatic | none | none | none | drop oldest track | UT-07-19 |
| gamepad disconnects mid-performance | `gamepaddisconnected` or null slot in `pollGamepad` | keyboard and pointer | re-plug | none | HUD input status (M-26 polls `devices()`) | continue with other sources | release gamepad-owned controls | UT-07-21 |
| Web MIDI unsupported or insecure context | `enableMidi()` checks | everything else | no | none | Settings toggle shows E-INP-001 text | play without MIDI | toggle stays off | UT-07-23 |
| MIDI permission denied | promise rejection | everything else | user may retry | none | E-INP-002 toast | play without MIDI | toggle stays off | UT-07-24 |
| AudioContext not running (no anchor) | `perfToAudio` returns null | lifecycle still tracked | automatic when audio resumes | none | DLG-ResumeAudio is shown by M-28 on `audio.state` | menu-only input | ring refills within 20 samples (<= 500 ms) | UT-07-09 |
| anchor spread grows (clock divergence, E 2.2) | `anchor().spreadMs > 5` | events still timestamped | automatic | none | Diagnostics shows spread | none | median tolerates outliers | UT-07-10 |
| stale or corrupt maps in settings | `setMap` validation | defaults | n/a | none | `errors[]` shown once as a toast by M-27 | defaults | `resetMap()` | UT-07-26 |
| `init` called twice | assert | first attachment | n/a | none | ErrorReporter (recoverable) | n/a | `detach` then `init` | UT-07-02 |
| text field focused during gameplay | `activeElement` check | none affected | n/a | none | n/a | keys go to the field | blur field (UI closes text entry on play) | UT-07-15 |

#### 6.7.6 Limits and performance notes

- Handler cost: <= 0.1 ms per event on desktop (no allocation beyond the `InputEvent`
  object); no `querySelector` in handlers (rects cached).
- Pointer tracks <= 10; controls fixed at 20 + 128 pass-through names (lazy records).
- Anchor ring 20 samples; one sort of 20 numbers per sample (every >= 25 ms).
- Gamepad poll once per frame; only the first connected pad is read.
- Added processing between the browser event and `input.event` emission <= 1 frame (BRIEF 6);
  it is synchronous within the handler.
- No listener is added per screen; all listeners are installed once in `init` and removed in
  `detach`; `listenerCount()` is part of `assertClean()`.

#### 6.7.7 Spec coverage

B 7.3 (sustain, octave, layouts switch keys), B 8.1, B 8.2, B 8.4 (simultaneous presses, held
notes), B 8.5 (calibration storage, touch-control behavior), B 14.4 (dance inputs through the
same system), B 21.1, B 22 (remappable controls), E 1 (stuck touch), E 4.1 (all 13 cases), E 9
(Web MIDI optional, secure context), E 10 item 13 (cleanup), I 2.1 (custom layouts), I 2.3, I
12 (touch cancellation, focus), I 15 (remappable keyboard and touch), I 17 (mobile input
lifecycle), P 5.1 (all 11 lines), P 14 (simultaneous touches, cancellation), P 15.

#### 6.7.8 Unit tests

Setup common to all: `init({keyboardTarget: window, padRoot: #touch (4 pads laid out by the
test), surface: #view})`, context `instrument` unless stated, `FLM.Audio` replaced by the
SelfTest fake context (`state:'running'`, `currentTime` driven by the fake clock, no
`getOutputTimestamp`), a recorder listener on `input.event`.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-07-01 | default maps match BRIEF 7 | `DEFAULT_MAPS` | lanes `KeyA KeyS KeyK KeyL`; dance arrows plus `KeyD KeyF KeyJ KeyK`; pause `Escape`; panic `KeyP` and `Space` under `panicWhilePaused`; octave `KeyQ`/`KeyE`; profiles `Digit1..6` |
| UT-07-02 | init is idempotent-guarded | `init` twice | second call reports via ErrorReporter (recoverable), `listenerCount()` unchanged |
| UT-07-03 | detach removes all listeners | init, detach | `listenerCount() === 0`; a synthesized keydown emits nothing |
| UT-07-04 | keydown press lifecycle | `synthesize.key('KeyA', true, 1000)` | one event `{source:'keyboard', control:'lane0', type:'press', tPerf:1000}`; `State.isHeld('lane0')` |
| UT-07-05 | keyup release | press then `synthesize.key('KeyA', false, 1100)` | one release event; `held()` empty |
| UT-07-06 | event.repeat ignored | press, then key with `mods.repeat=true` x5 | exactly one press event |
| UT-07-07 | duplicate keydown ignored | two keydowns without keyup | one press event |
| UT-07-08 | second owner cannot release | keyboard presses lane0, pointer down on pad 0, pointer up | lane0 still held; exactly one press and zero releases emitted |
| UT-07-09 | tAudio null before anchor | fake context `state:'suspended'`, key press | `tAudio === null`, event still emitted |
| UT-07-10 | anchor median rejects outliers | feed 19 samples with offset 1.000 and 1 with 3.000 via `pollGamepad` and fake clock | `anchor().offsetSec` within 1e-9 of 1.000; `spreadMs` 2000 |
| UT-07-11 | perfToAudio mapping | fake context currentTime 5.0 at performance.now 2000 ms; `pollGamepad(2000)`; `perfToAudio(2500)` | 5.5 +/- 1e-6 |
| UT-07-12 | blur releases all with source system | hold lane0 and lane2, `synthesize.blur()` | two release events `source:'system'`, order lane0 then lane2 |
| UT-07-13 | visibilitychange hidden and pagehide release all | hold lane1; `synthesize.hidden()`; hold again; `synthesize.pagehide()` | release emitted in both cases; `held()` empty |
| UT-07-14 | modifier combos pass through | key `KeyA` with `mods.ctrlKey` | no event; `preventDefault` not called |
| UT-07-15 | text field focus blocks gameplay keys | focus an `<input>`, key `KeyA`; then `Escape` | no lane event; `pause` press emitted |
| UT-07-16 | pointer down/up on pad | `synthesize.pointer(1,'down',cx0,cy0,0.5,...)`, `'up'` | press and release of `lane0`, `source:'pointer'`, `pressure 0.5` |
| UT-07-17 | drag between pads | down on pad 0, move to pad 1 coordinates, up | events: press lane0, release lane0, press lane1, release lane1 |
| UT-07-18 | move outside all pads releases | down on pad 2, move to (-10,-10) | release lane2; `held()` empty; moving back in presses again |
| UT-07-19 | pointercancel and pointer cap | down on pad 3 then `'cancel'`; then 11 distinct pointer downs | release emitted; after the 11th, oldest released, `Log` has `INP_PTR_CAP` |
| UT-07-20 | four simultaneous pointers | downs with ids 1-4 on pads 0-3 | `held()` equals `['lane0','lane1','lane2','lane3']` |
| UT-07-21 | gamepad edge detection and disconnect | `synthesize.gamepad({index:0,buttons:[b0 pressed]})`, `pollGamepad`; same again; `synthesize.gamepad(null)`, `pollGamepad` | one press lane0; no duplicate on second poll; release with source `system` after null |
| UT-07-22 | gamepad dance context mapping | context dance; button 12 pressed | press `dance2` |
| UT-07-23 | enableMidi without support | `navigator.requestMIDIAccess` undefined (fake) | resolves `{ok:false, code:'E-INP-001'}` |
| UT-07-24 | MIDI note mapping and pass-through | fake access; `synthesize.midi([0x90,60,100])`, `[0x80,60,0]`, pass-through on then `[0x90,61,64]` | press/release `lane0` with pressure 100/127; press `midi:61` |
| UT-07-25 | MIDI sustain CC | `[0xB0,64,127]` then `[0xB0,64,0]` | press then release `sustain`, source `midi` |
| UT-07-26 | remap conflict detection | `remap('instrument','lane1','KeyA')` | `{ok:false, conflict:{context:'instrument', control:'lane0', code:'KeyA'}}`; `remap('dance','dance0','KeyK')` returns `{ok:true}` (per-context) |
| UT-07-27 | remap replaces after unmap, min one code | `unmap('instrument','lane0','KeyA')` (last code) | returns false; after `remap('instrument','lane0','KeyZ')`, unmap of `KeyA` returns true and `KeyZ` presses lane0 |
| UT-07-28 | setMap tolerates corrupt data | `setMap({keyboard:{instrument:{lane0:['Key A!'], bogus:['KeyB']}}})` | `ok:false`, `errors.length >= 2`, lane0 keeps default `KeyA` |
| UT-07-29 | bind releases non-live controls | hold lane0 and pause; `bind({owner, context:'dance'})` | release lane0 (source system); pause still held |
| UT-07-30 | Space is panic only while paused | Transport fake state `playing`: `Space` -> nothing; state `paused`: `Space` -> `panic` press | as stated |
| UT-07-31 | timestamp sanity fallback | `synthesize.key` with `tPerf` = epoch ms (1.7e12) | emitted `tPerf` within 50 ms of `performance.now()` |
| UT-07-32 | calibration clamp and non-application | `setCalibration({inputOffsetMs:900, audioLatencyMs:-900, visualLeadMs:100})`; press | stored `500, -500, 600`; event `tAudio` equals `perfToAudio(tPerf)` exactly (no offset applied) |

#### 6.7.9 Implementation notes and browser quirks

- iOS Safari (OQ-1): Pointer Events are supported from iOS 13; whether four simultaneous
  `pointerdown`s arrive on all devices is verified by XT tests. Fallback (built only if XT
  fails): add `touchstart/touchmove/touchend/touchcancel` listeners that call the same
  `press/release` with `physical:'t' + identifier` and set a flag so the Pointer handlers
  ignore `pointerType === 'touch'` (never both).
- iOS Safari fires `pointercancel` when the page starts scrolling; `touch-action: none` on
  `#touch` and `#view` plus the non-passive `touchmove` `preventDefault` stop the scroll.
- Android Chrome: `KeyboardEvent.code` can be `''` for some IME keyboards; the `fallbackCode`
  rule in C.2 handles letters and digits.
- Firefox: a gamepad appears in `getGamepads()` only after a button press; `devices()` may
  show no pad until then (documented in Help).
- Safari: `getOutputTimestamp` is missing in some versions; the `currentTime` fallback is
  used; expect `spreadMs` 2-6 ms (acceptable: median is used).
- `event.timeStamp` is performance-origin in all five target browsers today; the sanity check
  in A.1 guards old WebKit epoch timestamps.
- Keep `Escape` unprevented so fullscreen exit keeps working; `pause` still fires.
- Never call `setPointerCapture`: it defeats pad-to-pad drags.
- `ShiftLeft`/`ShiftRight` as sustain: Shift does not alter `code` values of other keys.
- `Space` is prevented only when it resolves (paused); otherwise the browser may scroll, which
  is acceptable in menus because the UI prevents page scrolling by layout.

### 6.8 M-08 Mapping (`src/08-mapping.js`, `FLM.Mapping`)

#### 6.8.1 Responsibilities and non-goals

Responsibilities:
- Translate `InputEvent`s into musical actions for live play (Free Play, Studio recording,
  Instrument mode lane hits) through the six profiles A-F (B 8.3, I 2.1), with octave and
  register controls, sustain, chord recognition labels, optional quantization of recorded
  ticks, out-of-range policy and instrument range awareness.
- Generate deterministic four-button `Chart`s per difficulty from any `Track` of a `Song`
  (`ChartGenerator`), never deleting or altering source events (B 7.5, E 4.2, I 2.2, I 6.2),
  with `stats` for the inspection screen and a preview API (I 6.1, I 6.2).
- Compute `settingsHash` (Part 5.9).

Non-goals: no judging or scoring (M-09), no audio (actions are dispatched to `FLM.Instruments`
through `Mapping.dispatch`, which is the only Audio call in this module), no persistence, no
dance charts (M-23), no UI.

#### 6.8.2 Public API

```js
FLM.Core.define('Mapping', function (Core, Theory, Model, Transport, Audio, Instruments, Input) {
  return {
    PROFILES: ['A','B','C','D','E','F'],
    DIFFICULTIES: ['beginner','intermediate','advanced','expert'],

    /** Live mapper for Free Play / Studio / Instrument-mode hits.
     *  ctx: { profile:'A'..'F', key:{tonic:0..11, mode:'major'|'minor'}, scale:string (Theory id,
     *  default from mode), octave:int (default 4), register:int (default 0), program:0..127,
     *  isDrums:boolean, channel:int, velocity:int (default 100), noteLength:'hold'|'fixed',
     *  fixedDurTicks:int (default 240), quantize:boolean, chordSlots:[ChordSlot x4]|null,
     *  intervals:[int x4]|null, range:{low,high}|null (defaults from Instruments.range(program)) }
     *  @returns {LiveMapper} */
    createLive(ctx) {},

    /** Dispatch a MusicalAction to Instruments at action.tAudio (or now + 0.005 if null).
     *  @param {MusicalAction} action @param {string} trackId */
    dispatch(action, trackId) {},

    /** Profile semantics tables (read-only data) for Help and for tests. */
    profileTable(profile, ctx) {},   // -> [{control, action:string, pitches:[int]}] x4

    ChartGenerator: {
      /** Deterministic. @returns {Chart} (with stats). Throws Error with .code 'E-INP-010'
       *  (unknown track), 'E-INP-011' (bad difficulty/profile/options). */
      generate(song, trackId, difficulty, profile, options) {},
      /** Same result as generate(), returned as a Promise; yields to the event loop (setTimeout 0)
       *  every 20,000 source events (Part 4.7.1 step 7). */
      generateAsync(song, trackId, difficulty, profile, options) {},
      /** Generator algorithm version (written to every chart and to settingsHash). */
      VERSION: 1,
      /** Per-difficulty report for the inspection screen (I 6.1 "needs simplification"). */
      simplificationReport(song, trackId, profile) {},
      /** Preview rows for SCR-ImportInspect: lanes x bars. */
      preview(chart, song, fromBar, barCount) {},
      /** One-line description, e.g. "Expert: 412 notes, 38 chords, 25 holds; 61 of 473 source notes not charted". */
      describe(chart) {},
      /** Validates a Chart (sorted, lanes 0..3 unique per note, ids unique, hash matches). */
      validate(chart, song) {},     // -> {ok:boolean, errors:string[]}
      settingsHash(difficulty, profile, generatorVersion, trackId, sourceNoteCount) {} // -> 8 hex chars
    }
  };
});

/** LiveMapper (instance) */
LiveMapper {
  handle(inputEvent) : MusicalAction[],   // pure given state; also invokes onAction callbacks
  onAction(cb) : () => void,              // returns unsubscribe
  setProfile(p), setKey(key), setScale(id), setOctave(n), shiftOctave(dn), setRegister(n),
  setProgram(program, isDrums), setVelocity(v), setNoteLength(mode, durTicks), setQuantize(on),
  setChordSlots(slots), setIntervals(ints),
  state() : LiveMapperState,              // copy: profile, key, scale, octave, register, held pitches, sustain, lastChordLabel
  releaseAll(tAudio) : MusicalAction[],   // noteOff for every sounding pitch (mode leave, panic)
  dispose()
}

MusicalAction {
  kind: 'noteOn'|'noteOff'|'cc'|'profile'|'octave'|'label',
  pitches: [int],            // noteOn/noteOff
  velocity: int,             // noteOn 1..127
  controller: int, value: int,   // cc (64 sustain)
  profile: 'A'..'F',         // profile
  octave: int,               // octave
  label: string,             // label (chord name for HUD)
  control: string,           // originating control
  tAudio: number|null,
  tick: int|null,            // Transport.tickAt(tAudio) at the time of the action, quantized when enabled
  rawTick: int|null,         // unquantized tick
  channel: int, program: int
}
```

Events emitted: none (actions are returned and passed to callbacks; the mode decides what to
do). Events consumed: none. `dispatch` is the single bridge to `FLM.Instruments.noteOn /
noteOff / controlChange` (6.6.2).

#### 6.8.3 Internal state

```js
LiveMapperState {
  profile, key:{tonic, mode}, scaleId, octave, register, program, isDrums, channel, velocity,
  noteLength, fixedDurTicks, quantize,
  chordSlots: [ChordSlot x4], intervals: [int x4], range: {low, high},
  sounding: Map<control, {pitches:[int], tAudio}>,   // what each pressed control is sounding
  sustain: boolean,                                    // control 'sustain' held or latched
  deferred: Set<int>,                                  // pitches whose noteOff waits for sustain release
  chordWindow: { t0: number|null, pitches:[int], timer: null },   // 30 ms grouping for labels
  fixedTimers: [],                                     // noteLength 'fixed' pending noteOffs (audio-time, no JS timers)
  rangeWarned: Set<program>
}
ChordSlot { degree: 1..7, type: Theory chord id, inversion: 0..3 }
```

Chart generation keeps no module state; every call is a pure function of its inputs.

Invariants:
1. For every `noteOn` emitted by a LiveMapper there is exactly one matching `noteOff` for the
   same pitches (on release, on fixed length expiry, on sustain release, or in `releaseAll`).
2. `handle()` never allocates JS timers; fixed-length note offs are emitted immediately as
   `noteOff` actions with `tAudio = on.tAudio + durSeconds` (Instruments schedules them).
3. Pitches are always integers in 0..127 after range policy.
4. Chart generation is referentially transparent: `JSON.stringify(generate(args)) ===
   JSON.stringify(generate(args))` and independent of wall clock, locale and iteration order
   of any Map/Set (only arrays are iterated).

#### 6.8.4 Algorithms

A. Scale and key context. `scaleId` defaults to `'major'` for `mode:'major'` and
`'naturalMinor'` for `mode:'minor'`; `Theory.scaleDegrees(tonic, scaleId, octave, count)`
returns MIDI numbers of consecutive degrees starting at degree 1 in the given octave (C4 = 60).
Examples below use key C major, octave 4, program 0 (Acoustic Grand Piano, range 21..108).

B. Profile semantics (free play; `button` = lane0..lane3). Pressing several buttons sounds
all of their pitches (polyphony is the union).

Profile A - Four-note lanes: button i -> scale degree i+1 at the current octave. `octUp` /
`octDown` shift the octave by 1. In chart play (Instrument mode) lanes carry the chart note's
own `pitches`, so A is the default profile for charts.

| Button | Action | C major example |
|---|---|---|
| lane0 | degree 1 | C4 (60) |
| lane1 | degree 2 | D4 (62) |
| lane2 | degree 3 | E4 (64) |
| lane3 | degree 4 | F4 (65) |

Profile B - Interval: button i -> root + `intervals[i]` semitones where root = tonic at the
current octave. Default intervals `[0, third, 7, 12]` with `third` = 4 when the scale's third
degree is a major third above the tonic, else 3 (`Theory.scaleDegrees` degree 3 minus degree
1). Configurable to any `[0..24] x4` through `setIntervals`.

| Button | Action | C major example | A minor example |
|---|---|---|---|
| lane0 | root (unison) | C4 | A4 |
| lane1 | third (scale-aware) | E4 | C5 |
| lane2 | perfect fifth | G4 | E5 |
| lane3 | octave | C5 | A5 |

Profile C - Chord: button i -> chord `chordSlots[i]` built on scale degree `slot.degree` with
`Theory.chordNotes(rootMidi, slot.type, slot.inversion, octave)`; default slots are the
diatonic triads I, IV, V, vi (major) or i, iv, v, VI (minor): `type` chosen by
`Theory.diatonicTriad(scaleId, degree)` (major, minor or dim); `inversion` 0. Voicing rule:
after inversion, if the chord's lowest note is more than 7 semitones above the tonic octave
root, drop the chord by one octave (keeps hands near the root). Root selection: `setRegister`
is not used by C; the UI's "root" dropdown calls `setChordSlots` with rewritten degrees.

| Button | Action | C major example | A minor example |
|---|---|---|---|
| lane0 | I chord | C4 E4 G4 | A3 C4 E4 (i, after voicing drop) |
| lane1 | IV chord | F4 A4 C5 | D4 F4 A4 |
| lane2 | V chord | G4 B4 D5 | E4 G4 B4 |
| lane3 | vi chord | A4 C5 E5 | F4 A4 C5 (VI) |

Profile D - Scale: button i -> degree `register*1 + page*4 + i + 1` of the extended scale
(degrees continue past the octave: degree 8 = tonic one octave up). `octUp`/`octDown` move
`page` by +1/-1 (four degrees per page, so the player walks the scale); `setRegister(n)`
shifts by single degrees (-7..7). Quantization option applies to D and A (see E).

| Button | page 0 | page 1 | register +1, page 0 |
|---|---|---|---|
| lane0 | C4 | G4 | D4 |
| lane1 | D4 | A4 | E4 |
| lane2 | E4 | B4 | F4 |
| lane3 | F4 | C5 | G4 |

Profile E - Instrument-specific: by GM family of `program` (BRIEF 6 family table), or the
drum kit when `isDrums`:

| Family | lane0 | lane1 | lane2 | lane3 | C major example |
|---|---|---|---|---|---|
| Drums (isDrums) | kick 36 | snare 38 | closed hat 42 | crash 49 | same |
| Bass (32-39) | root, octave 2 | fifth | octave | scale degree 7 (leading or flat 7) | C2 G2 C3 B2 |
| Guitar (24-31) | power chord I (root, 5th, octave) | power chord IV | power chord V | single root | C3 G3 C4; F3 C4 F4; G3 D4 G4; C3 |
| Piano, Chromatic Perc, Organ, Strings, Ensemble, Brass, Reed, Pipe, Synth Lead, Synth Pad, Ethnic, Percussive (melodic) | degree 1 | degree 3 | degree 5 | degree 8 | C4 E4 G4 C5 |
| Synth Effects, Sound Effects | degrees 1-4 (as A) | | | | C4 D4 E4 F4 |

Octave for E: default octave from `Instruments.range(program)`: the octave containing the
range midpoint rounded down (bass -> 2, guitar -> 3, others -> 4); `octUp`/`octDown` shift.

Profile F - Rhythm/percussion: always the drum kit (channel 10), independent of `program`:

| Page (octUp/octDown) | lane0 | lane1 | lane2 | lane3 |
|---|---|---|---|---|
| 0 (default) | kick 36 | snare 38 | closed hat 42 | crash 49 |
| 1 | low tom 45 | high tom 50 | ride 51 | cowbell 56 |
| -1 | kick 35 | rimshot 37 | pedal hat 44 | open hat 46 |

For melodic tracks in chart play, profile F charts use the drum lane map of step K below only
when `isDrums`; for a melodic track profile F falls back to the contour strategy.

`profile1..6` controls call `setProfile('A'..'F')` and emit a `profile` action (HUD label).
`octUp`/`octDown` emit an `octave` action. Octave is clamped so that every pitch of the current
page stays inside `range` (clamp policy C below); the clamp result is what the `octave`
action reports.

C. Out-of-range policy. For each computed pitch p: while `p < range.low` add 12; while
`p > range.high` subtract 12; if the range is narrower than 12 and p is still outside, clamp
to the nearest bound. When any pitch was moved, `Log.warn('MAP_RANGE_CLAMP', {program,
pitch})` once per program (`rangeWarned`). Drum pitches are never range-shifted (kit keys are
fixed; a kit key outside 35..81 is replaced by 38 with the same warning).

D. Press handling (`handle(evt)`), `evt.type === 'press'`:
1. Resolve `control`. `octUp`/`octDown` -> step B octave rule, return `[octave action]`.
   `profileK` -> `setProfile`, return `[profile action]`. `sustain` -> `sustain = true`,
   return `[cc 64 value 127]`. `pause`/`panic`/unknown -> `[]`.
2. `midi:<n>` (pass-through) -> pitches `[n]` (no range policy; the player chose the pitch).
   Lane controls -> pitches from the profile table (step B) then range policy (C).
3. `velocity`: if `evt.source === 'midi'` or (`evt.source === 'pointer'` and `evt.pressure`
   is not 0.5 and `pressure > 0`) or (`evt.source === 'gamepad'` and `pressure < 1`):
   `clamp(round(evt.pressure * 127), 1, 127)`; otherwise `state.velocity` (default 100).
4. `tAudio = evt.tAudio` (null -> action carries null; `dispatch` plays at now + 5 ms).
   `rawTick = Transport.tickAt(tAudio)` when the transport is in `playing`, `recording` or
   `countin` state, else null. `tick = quantize ? snap(rawTick) : rawTick` (E).
5. If the control is already in `sounding` (should not happen: Input suppresses duplicates)
   return `[]`.
6. Record `sounding.set(control, {pitches, tAudio})`. Emit `noteOn`. If `noteLength ===
   'fixed'`, also emit `noteOff` for the same pitches at `tAudio + Transport.ticksToSecondsAt(
   fixedDurTicks)` (duration in seconds at the current tempo and speed) and mark the control
   as "auto-off" so its release emits nothing.
7. Chord label: if `chordWindow.t0 === null || tAudio - chordWindow.t0 > 0.030`, start a new
   window `{t0:tAudio, pitches:[...]}`; else append. Whenever the window holds >= 2 distinct
   pitch classes, emit `label` with `Theory.recognizeChord(pitchSet)` name (or the interval
   name for exactly 2 pitch classes; single pitch -> note name). The window never delays sound.

`evt.type === 'release'`:
1. `sustain` -> `sustain = false`; emit `[cc 64 value 0]` and, for every pitch in `deferred`
   that is no longer in any `sounding` entry, emit `noteOff` at `evt.tAudio`; clear `deferred`.
2. Lane or midi control: `s = sounding.get(control)`; if none -> `[]`. Delete it. If the
   control was auto-off -> `[]`. If `sustain` -> add pitches to `deferred`, return `[]`
   (Instruments also receives CC 64, so the voice sustains; the explicit noteOff later keeps
   the LiveMapper's own bookkeeping exact). Else emit `noteOff` for the pitches at
   `evt.tAudio`.
3. `releaseAll(tAudio)`: noteOff for every sounding and deferred pitch; emit `cc 64 0` if
   sustain was on; clear state.

E. Quantization (Free Play option, B 7.3, B 10.4): grid fixed at 1/16 = 240 ticks.
`snap(t) = round(t / 240) * 240` using round-half-up on the quotient. Applies to
`MusicalAction.tick` only (what the Recorder stores and the piano roll shows); audio plays at
the unquantized time. The HUD shows "Quantize 1/16" or "Free" from `state().quantize`
(the mode distinguishes quantized from unquantized playing by this flag and by storing
`quantized:true` on recorded notes via `rawTick !== tick`).

F. Chord recognition window: 30 ms, labels only (see D.7). Studio's Recorder additionally
groups notes whose `rawTick` lie within the 30 ms window to the earliest member's tick when its
`chordSnap` option is on (6.17; the LiveMapper exposes `chordWindow.t0` through `state()`).

G. `ChartGenerator.generate(song, trackId, difficulty, profile, options)` - normative,
deterministic, no randomness. `options` (all optional): `{ holdMinTicks: per-difficulty
default, groupToleranceTicks: 30, windowSize: 8, keyOverride: null }`.

Difficulty parameters (fixed):

| Difficulty | maxLanes per event | minSpacingTicks | holds | holdMinTicks | keep threshold |
|---|---|---|---|---|---|
| beginner | 1 | 960 (1 beat) | no | n/a | weight >= 2, relaxed to >= 1 then >= 0 if sparse (G.5) |
| intermediate | 2 | 480 (1/8) | no | n/a | weight >= 1, relaxed to >= 0 if sparse |
| advanced | 3 | 240 (1/16) | yes | 1920 (2 beats) | all |
| expert | 4 | 240 (1/16) | yes | 960 (1 beat) | all |

Steps:
1. Validate: `track = song.tracks.find(t => t.id === trackId)` else throw `E-INP-010`;
   `difficulty` in DIFFICULTIES and `profile` in PROFILES else throw `E-INP-011`; options
   numbers finite and positive else `E-INP-011`.
2. Collect source notes: `src = track.events.filter(e => e.kind === 'note')`, sorted by
   `(tick, pitch, id)` (the events array is already sorted; the sort is a defensive copy).
   `durTicks` is the raw note duration (not the sustain-pedal derived duration; decision:
   holds follow written note lengths). `sourceNoteCount = src.length`. If 0: return an empty
   Chart with `stats.warnings = ['W-IMP-CHART-EMPTY']`.
3. Group simultaneous notes: walk `src`; start a new group when `note.tick - group.tick >
   groupToleranceTicks` (30 ticks = 1/128 note); group = `{tick: first member tick, members:
   [NoteEvent], pitches: sorted unique asc, durTicks: max member durTicks, velMax, root:
   pitches[0], top: pitches[last], size: pitches.length}`. Members keep their own ticks in
   `sourceEventIds` only.
4. Weights (integer 0..8) per group:
   - `pos = song.meterMap.beatAt(group.tick)` -> `{bar, beat (0-based), frac (0..1 of a beat)}`
     (6.3). On-beat (`frac === 0`): beat 0 -> 4; the middle beat of an even-numerator meter
     (beat = numerator/2) -> 3; other beats -> 2. Half-beat (`frac === 0.5`) -> 1. Else 0.
   - +1 if `group.top` is a local melodic peak: greater than the previous group's top and
     greater than or equal to the next group's top (first/last group compare one side only).
   - +1 if `size >= 3` (chord: root matters, I 2.2).
   - +1 if `velMax >= 100` (accent).
   - +1 if `durTicks >= 960`.
5. Selection (greedy by weight): `order = groups indices sorted by (weight desc, tick asc)`.
   Accept index i if `weight >= threshold` and no accepted group j has `|tick_i - tick_j| <
   minSpacingTicks`. Accepted set sorted by tick = `kept`. Sparse rule for beginner and
   intermediate: let `bars = song.meterMap.barAt(song.durationTicks) + 1`; if
   `kept.length < bars / 2` (beginner) or `< bars` (intermediate), lower the threshold by 1
   and recompute (at most twice; thresholds 2 -> 1 -> 0 for beginner, 1 -> 0 for intermediate).
   Thresholds never change for advanced and expert (every group is a candidate; spacing is the
   only filter, so advanced/expert differ only in maxLanes and holds).
6. Strategy: `isDrums || profile === 'F'` with `isDrums` -> `drum` (K); `profile === 'C'` ->
   `chordSlot` (L); every other case -> `contour` (J).
7. Lane count for a kept group: `n = min(group.size, maxLanes)` (drum strategy: distinct drum
   lanes, see K). Chord-slot strategy: `n = 1` for chords.
8. Representative pitches when `n < size`: take `top` first, then `root`, then interior
   pitches by largest index gap from already chosen (ties -> lower pitch), until n. For the
   Bass family (program 32-39) `root` is taken first. `ChartNote.pitches` always lists ALL
   group pitches (hitting the note sounds the whole chord); the representative set only
   determines lanes.
9. ChartNote: `{ id: 'cn' + zeroPad(index, 5), tick: group.tick, durTicks: group.durTicks,
   lanes: [...], sourceEventIds: members.map(m => m.id), pitches: group.pitches, isHold }`
   where `isHold = holdsEnabled && durTicks >= holdMinTicks && (no later kept note shares a
   lane with it before tick + durTicks)`. If a later kept note in the same lane starts before
   `tick + durTicks`, set `durTicks = laterTick - tick - 60` (never below 0) and recompute
   `isHold` against `holdMinTicks`.
10. Lanes are sorted ascending and unique per note; notes sorted by tick; two kept notes
    never share a tick (groups are spaced by minSpacing >= 240 > tolerance).
11. `settingsHash = Core.fnv1a32(difficulty + '|' + profile + '|' + ChartGenerator.VERSION + '|' +
    trackId + '|' + sourceNoteCount)` rendered as 8 lowercase hex characters (Part 5.9).
    `Chart.id = 'chart-' + settingsHash + '-' + trackId`.
12. `stats = { sourceNoteCount, groupCount, keptCount, omittedSourceEventIds: number of source
    notes in groups not kept, laneCounts:[4], holdCount, chordCount (notes with lanes >= 2),
    maxSimultaneousSource: max group.size, maxLanesUsed, bars, densityPerBar:[count per bar],
    minSpacingTicks, strategy, warnings:[] }`. `W-IMP-CHART-OMITTED` is pushed when
    `omittedSourceEventIds > 0` (severity `info`; message in 8.8: "N of M notes are not charted
    at this difficulty; they still play in the arrangement").
13. Return `Chart { id, songId: song.id, trackId, instrument: track.program (or 'drums' when
    isDrums), difficulty, profile, notes, generatorVersion: 1, settingsHash, stats }`.

J. Contour lane assignment (strategy `contour`), processing kept notes in tick order with a
sliding window of the last `windowSize` (8) assigned notes, each remembered as `{repPitch,
lane}` (`repPitch` = the note's top representative pitch):
1. `pitch = note.top`. Same-pitch rule: if any window entry has `repPitch === pitch`, use its
   lane (`laneTop`). Skip to step 4.
2. Rank rule: `distinct = sorted unique repPitches in window plus pitch`; `rank = index of
   pitch in distinct`; `laneTop = floor(rank * 4 / distinct.length)` (0..3).
3. Direction rule (only when the same-pitch rule did not apply and the window is not empty):
   `prev = last window entry`. If `pitch > prev.repPitch` and `laneTop <= prev.lane` ->
   `laneTop = min(prev.lane + 1, 3)`. If `pitch < prev.repPitch` and `laneTop >= prev.lane`
   -> `laneTop = max(prev.lane - 1, 0)`.
4. Multi-lane block: `n` lanes as a contiguous block ending at `laneTop`: `start = clamp(
   laneTop - n + 1, 0, 4 - n)`; `lanes = [start .. start + n - 1]`, assigned to the
   representative pitches in ascending pitch order (lowest pitch -> lowest lane).
5. Push `{repPitch: pitch, lane: laneTop}` to the window (drop the oldest beyond 8).

K. Drum lane map (strategy `drum`): GM key -> lane: 35, 36 -> 0 (kick); 37, 38, 39, 40 -> 1
(snare, rimshot, clap); 42, 44, 46 -> 2 (hats); everything else in 35..81 -> 3 (cymbals,
toms, misc); keys outside 35..81 -> 3. A group's lanes are the distinct lanes of its members;
if more than `maxLanes`, keep by priority 0, 1, 2, 3 (kick first). Representative pitches are
the members on the kept lanes (`pitches` still lists all members).

L. Chord-slot assignment (strategy `chordSlot`, profile C): for groups with `size >= 3`:
`key = song.keyMap.keyAt(group.tick)` (or `options.keyOverride`); `degree = scale degree of
pitchClass(root) in the key's scale` (1..7, or 0 when not diatonic); lane = 0 for degree 1,
1 for degree 4, 2 for degree 5, 3 otherwise; `n = 1`. Groups with `size < 3` use J (contour).
The window of J is shared so single notes stay coherent with chord lanes.

M. `simplificationReport(song, trackId, profile)`: runs `generate` for each difficulty and
returns `[{difficulty, keptCount, omittedSourceEventIds, maxSimultaneousSource, maxLanes,
needsSimplification: omittedSourceEventIds > 0 || maxSimultaneousSource > maxLanes}]`.
`preview(chart, song, fromBar, barCount)` returns `{ bars:[{bar, startTick, endTick}],
lanes:[[{tick, durTicks, isHold, id}] x4], omitted: number }` restricted to the bar range.
`describe(chart)` formats: `"<Difficulty>: <notes> notes, <chords> chords, <holds> holds;
<omitted> of <source> source notes not charted"` (omitted clause only when > 0).

N. `validate(chart, song)`: checks `notes` sorted by tick strictly increasing; each `lanes`
non-empty, unique, in 0..3, ascending; `durTicks >= 0`; `isHold` implies `durTicks > 0`;
ids unique; every `sourceEventIds` entry exists in the track (when `song` given);
`settingsHash` recomputes identically; `generatorVersion === 1`. Returns `{ok, errors}`;
`E-INP-012` is the error code used when a mode receives an invalid chart (e.g. a project
saved by a buggy build).

#### 6.8.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| unknown track or bad arguments to generate | validation (E-INP-010/011 thrown) | song untouched | caller fixes args | none | ImportInspect shows "Chart could not be generated for this track" | choose another track | n/a | UT-08-20 |
| track has no notes | step 2 | empty chart | n/a | none | inspection row "no playable notes" (W-IMP-CHART-EMPTY) | track not selectable for play | n/a | UT-08-21 |
| source denser than four lanes (E 4.2) | stats.omitted > 0 or maxSimultaneousSource > maxLanes | all source events kept in the Song | n/a | none | W-IMP-CHART-OMITTED on inspection and results | omitted notes still play in the arrangement | n/a | UT-08-23 |
| pitch outside instrument range | range policy | sound continues | n/a | none | Log once per program | octave-shifted pitch | n/a | UT-08-10 |
| release without matching press (lost events) | `sounding` miss | other notes | n/a | none | none | none | `releaseAll` on mode leave/panic | UT-08-13 |
| sustain held forever (E 2.3) | mode leave or panic | none | n/a | none | none | none | `releaseAll` emits cc64 0 and all noteOffs | UT-08-14 |
| transport not running at press (tick null) | `Transport.state()` | audio plays | n/a | none | none | actions carry `tick:null`; Recorder ignores them | n/a | UT-08-15 |
| chart from storage invalid | `validate` | project intact | regenerate | none | E-INP-012 toast then regenerate | regenerated chart | regenerate from source | UT-08-25 |
| `Instruments.noteOn` throws (voice allocation failure) | try/catch in `dispatch` | mapper bookkeeping | next press | none | ErrorReporter recoverable | silence for that note | noteOff still emitted later | UT-08-16 |

#### 6.8.6 Limits and performance notes

- `generate` for a 100,000-note track: O(n log n) (one sort for selection); target <= 150 ms
  desktop, <= 400 ms mobile; it is synchronous (called from the inspection screen after import
  completes, never during gameplay). Charts for the five built-in songs x 4 difficulties are
  generated at load lazily per song (Part 9.4).
- `handle()`: O(1) per event; chord label recognition uses at most 10 pitches.
- Chart memory: ~120 bytes per ChartNote; a 20,000-note chart is ~2.4 MB and is the practical
  upper bound; charts above 50,000 notes are refused with `E-INP-011` ("Track too dense to
  chart") so that highway rendering stays within budget.
- The 30-tick grouping tolerance and all thresholds are constants exported on
  `Mapping.ChartGenerator.PARAMS` for tests.

#### 6.8.7 Spec coverage

B 7.2 (single notes, simultaneous notes, chords, intervals, repeated notes, sustained notes,
rests, subdivisions, difficulty levels, instrument-independent input layer), B 7.3 (notes and
chords, key, scale, register, octave, duration, velocity, sustain, layouts, scale constraints
off = chromatic scale, quantized vs unquantized), B 7.5 (map imported notes to four buttons,
source intact), B 8.3 (profiles A-F, switch without modifying source), B 8.4, B 10.4 (scale
mapping fields, out-of-range, quantization), E 4.2 (all 12 cases), E 10 items 4 and 6, I 2.1,
I 2.2 (adaptive difficulty rules), I 6.1 (needs-simplification flag), I 6.2 (deterministic
generator, preview, mapping change), P 5.3 (difficulty labels correspond to measurable
differences, chord simplification documented), P 9 (keys, scales, inversions, quantization,
sustain), P 11 (original data remains, charts previewable).

#### 6.8.8 Unit tests

Setup common to all: `FLM.Instruments` replaced by a recording fake (`noteOn/noteOff/
controlChange` push to an array); Transport fake clock at 120 BPM, state `playing`,
anchor so that `tickAt(t) = round(t * 960 * 2)`; `mk(evt)` builds an `InputEvent` with
`source:'keyboard'` unless stated. Song fixtures come from `FLM.SelfTest.fixtures.song(...)`
(6.31): `fx.melody` (C major scale up and down, quarter notes, 8 bars), `fx.chords` (I IV V vi
triads, whole notes), `fx.drums` (kick/snare/hat pattern, 4 bars), `fx.dense` (16th-note
arpeggios with 5-note chords on beat 1).

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-08-01 | profile A pitches C major | `createLive({profile:'A', key:{tonic:0,mode:'major'}})`; press lane0..3 | noteOn pitches 60, 62, 64, 65 |
| UT-08-02 | profile A octave shift | press octUp then lane0 | `octave` action 5; noteOn pitch 72 |
| UT-08-03 | profile B intervals major and minor | C major lane0..3; A minor lane1 | 60, 64, 67, 72; A minor lane1 -> 72 (C5) |
| UT-08-04 | profile C chords and voicing | C major lane0..3; A minor lane0 | [60,64,67], [65,69,72], [67,71,74], [69,72,76]; A minor lane0 -> [57,60,64] |
| UT-08-05 | profile C inversion | `setChordSlots` slot0 inversion 1 | lane0 -> [64,67,72] |
| UT-08-06 | profile D paging and register | page 0, octUp, setRegister(1) | lane0: 60 then 67 then (page 1, reg 1) 69 |
| UT-08-07 | profile E by family | program 33 (bass), 27 (guitar), 0 (piano), isDrums | bass lane0 36 (C2), guitar lane0 [48,55,60], piano lane3 72, drums lane1 38 |
| UT-08-08 | profile F pages | lane2 at page 0, -1, 1 | 42, 44, 51 |
| UT-08-09 | profile switch via controls | press profile3, lane0 | `profile` action 'C'; chord pitches |
| UT-08-10 | range policy | program 33 range 28..55, profile A octave 6 press lane0 | pitch shifted by octaves into range (84 -> 48); Log has MAP_RANGE_CLAMP once after two presses |
| UT-08-11 | velocity from pressure | pointer press pressure 0.8; keyboard press; midi pressure 100/127 | velocities 102, 100, 100 |
| UT-08-12 | fixed note length | `setNoteLength('fixed', 480)`; press; release | noteOn and noteOff(tAudio + 0.5 s at 120 BPM) emitted at press; release emits nothing |
| UT-08-13 | release without press | release lane1 | returns [] |
| UT-08-14 | sustain defers note offs | press sustain, press lane0, release lane0, release sustain | cc64 127; noteOn; no noteOff at lane release; at sustain release: cc64 0 then noteOff 60 |
| UT-08-15 | tick null when stopped | Transport fake state `stopped`; press | action `tick:null`, `rawTick:null` |
| UT-08-16 | dispatch isolates Instruments errors | fake `noteOn` throws | `dispatch` does not throw; ErrorReporter received one recoverable report |
| UT-08-17 | quantization snaps recorded tick only | `setQuantize(true)`; press at tAudio giving rawTick 250 | `tick` 240, `rawTick` 250, `tAudio` unchanged |
| UT-08-18 | chord label within 30 ms | presses lane0, lane1, lane2 (profile A gives C D E) at +0, +10, +20 ms; then in profile C lane0 | label actions; final label for [60,64,67] is "C" (Theory name for major triad) |
| UT-08-19 | releaseAll closes everything | press lane0, lane2, sustain; `releaseAll` | noteOffs for 60 and 64, cc64 0, `state().sounding` empty |
| UT-08-20 | generate argument validation | unknown trackId; difficulty 'hard' | throws with `.code` E-INP-010 and E-INP-011 |
| UT-08-21 | empty track | track with cc events only | chart.notes length 0; stats.warnings contains W-IMP-CHART-EMPTY |
| UT-08-22 | determinism | `generate(fx.dense, ..., 'expert','A')` twice; and again after a `generate` on another song | `JSON.stringify` equal for both runs |
| UT-08-23 | beginner keeps beats, omits the rest | `fx.dense` beginner | every note tick is on a beat (`beatAt(tick).frac === 0`); spacing >= 960; `stats.omittedSourceEventIds > 0`; warning W-IMP-CHART-OMITTED |
| UT-08-24 | difficulty ladder | all four difficulties on `fx.dense` | keptCount non-decreasing beginner -> expert; maxLanesUsed <= 1, 2, 3, 4 respectively; expert has holds for notes >= 960 ticks |
| UT-08-25 | validate detects corruption | take a chart, set `notes[3].lanes = [2,2]` and a wrong hash | `validate` returns ok false with two errors; untouched chart validates ok |
| UT-08-26 | contour same-pitch and direction | `fx.melody` expert | repeated pitches reuse lanes; ascending run lanes non-decreasing; descending run lanes non-increasing |
| UT-08-27 | multi-lane block ordering | `fx.chords` expert | each chord note has lanes contiguous and `pitches` of length 3 with all source pitches; lane order follows pitch order |
| UT-08-28 | drum lane map | `fx.drums` expert and beginner | kick in lane 0, snare lane 1, hats lane 2; beginner keeps kick on beat 1 and 3 with maxLanes 1 |
| UT-08-29 | chord-slot strategy | `fx.chords` with profile C | lanes [0], [1], [2], [3] for I, IV, V, vi chords |
| UT-08-30 | hold truncation | two notes in one lane where the first's duration overlaps the second (expert) | first `durTicks` = gap - 60; `isHold` false when below 960 |
| UT-08-31 | settingsHash composition | `settingsHash('expert','A',1,'t1',473)` | 8 lowercase hex chars; differs when any argument changes; equals `Core.fnv1a32('expert\|A\|1\|t1\|473')` formatted |
| UT-08-32 | sparse relaxation | syncopated fixture with no on-beat notes | beginner chart is non-empty (threshold relaxed), still spaced by 960 |
| UT-08-33 | preview and describe | `preview(chart, song, 0, 4)`, `describe(chart)` | 4 bars; lane arrays contain only notes within the bar range; description string matches the format in M |
| UT-08-34 | simplificationReport | `fx.dense` | beginner/intermediate `needsSimplification` true; expert false when maxSimultaneousSource <= 4 |

#### 6.8.9 Implementation notes and browser quirks

- Use only arrays and plain objects in the generator; `Map`/`Set` iteration order is stable
  in practice but the determinism invariant is simpler to prove without them.
- Avoid `Array.prototype.sort` without a total comparator: every comparator ends with the
  `id` string comparison (`<`/`>`), never `localeCompare`.
- `fnv1a32` must operate on UTF-16 code units (the string is ASCII by construction; ids are
  generated by `Core.uid()` which is ASCII).
- Free Play HUD needs the label action within the same frame as the press: `handle()` is
  synchronous and the mode calls it directly from the `input.event` listener.
- The `tick` of an action uses `Transport.tickAt(evt.tAudio)` (input audio time), never the
  time at which `handle()` runs (I 1.3).
- Chart generation must not run during `playing`; the inspection screen and Quick Play run it
  before entering the gameplay mode (M-28 asserts `Transport.state() === 'stopped'` before
  calling `generate`).

### 6.9 M-09 Rhythm (`src/09-rhythm.js`, `FLM.Rhythm`)

#### 6.9.1 Responsibilities and non-goals

Responsibilities:
- `Chart`/`ChartNote` runtime model helpers (`laneOf(control)`, chart cursor), judgment windows
  per difficulty (B 9.3), the `Judge` (input vs intended time after calibration applied
  exactly once), hold judging, chord notes, strays, miss detection in deterministic time order,
  `Score` with integer arithmetic (BRIEF 6), combo, accuracy, completion, per-section stats,
  `PerformanceSummary`, replay (B 9.4, I 2.4, E 4.2, P 5.2).
- Serve dance scoring unchanged: the `Judge` is lane-based; M-23 feeds `DanceStep`s converted
  to the same `ChartNote` shape (`lanes = directions`) and the window preset of the dance
  difficulty (6.23).

Non-goals: no highway rendering (M-21), no HUD (M-26), no input listening beyond
subscribing to `input.event` when attached, no persistence of results (M-25 consumes
`PerformanceSummary`), no multiplayer authority logic (M-24 runs one `Judge` per player on
the host using this module unchanged).

#### 6.9.2 Public API

```js
FLM.Core.define('Rhythm', function (Core, Model, Transport, Input) {
  return {
    /** Half-width windows in ms (BRIEF 6). */
    WINDOWS: {
      beginner:     { perfect: 45, great: 90, good: 135 },
      intermediate: { perfect: 35, great: 70, good: 110 },
      advanced:     { perfect: 25, great: 55, good: 90 },
      expert:       { perfect: 18, great: 40, good: 70 }
    },
    POINTS: { perfect: 100, great: 70, good: 40, miss: 0 },
    CHORD_TOLERANCE_MS: 50,
    /** @returns {{perfect,great,good}} copy for a difficulty; throws E-INP-011 on unknown */
    windowsFor(difficulty) {},
    /** 'lane0'..'lane3' or 'dance0'..'dance3' -> 0..3; anything else -> -1 */
    laneOf(control) {},
    /** Judgment for an integer delta given windows: 'perfect'|'great'|'good'|null (outside). */
    judgmentFor(absDeltaMs, windows) {},
    /** Symmetric rounding used everywhere: sign(x) * round(abs(x)). */
    roundMs(x) {},

    /** Judge factory (Part 4.1 `Judge.bind`; Part 4.7.1 step 8 follows it with load(), setCalibration()
     *  and attach()). @returns {Judge} */
    Judge: { bind(opts) {} },   // opts: { timeMap?: {audioTimeAt(tick), tickAt(audioTime)} (default FLM.Transport),
                                //         strayPenalty?: 'none'|'combo' (default 'none'),
                                //         windowsPreset?: 'standard'|'custom' }

    /** Replay: judge an input log against a chart with a fixed time map; returns the final
     *  ScoreState and the list of JudgeResults. Deterministic. */
    replay(chart, song, difficulty, inputLog, calibration, opts) {},

    /** Section boundaries: markers of kind 'section' or every 4 bars. */
    sectionsOf(song) {}      // -> [{label, startTick, endTick}]
  };
});

/** Judge (instance) */
Judge {
  load(chart, song, windowsOrDifficulty) : void,   // validates chart (Mapping.ChartGenerator.validate shape rules), builds indexes, restart()
  setCalibration(cal) : void,                       // reads inputOffsetMs and audioLatencyMs; the ONLY application point
  setWindows(windows, preset) : void,               // custom windows mark summary.comparable = false
  attach() : void,                                  // subscribe to input.event (listener counted); idempotent
  detach() : void,
  setActive(on) : void,                             // false while paused/countin/stopped: inputs ignored, no misses declared
  onInput(evt) : JudgeResult|null,                  // see 6.9.4 B
  tick(audioNow) : JudgeResult[],                   // declares due misses and hold completions; see 6.9.4 D
  restart() : void,                                 // clears all judged state, keeps chart/calibration/windows; re-arms finish()
  finish(endedBy) : void,                           // 'end'|'user'|'fail'|'net': emits chart.finished once per bind (Part 4.4); called by M-28 and, for dance, by M-23
  state() : ScoreState,                             // copy
  summary(meta) : PerformanceSummary,               // meta: {songId, chartId, startedAt, durationSec}
  sections() : SectionStat[],
  results() : JudgeResult[],                        // in declaration order
  inputLog() : InputEvent[],                        // every press/release seen while active (for replay and multiplayer)
  nextNotes(lane, count) : ChartNote[],             // for HUD/highway helpers (unjudged, from cursor)
  dispose() : void
}

JudgeResult { noteId, judgment:'perfect'|'great'|'good'|'miss', deltaMs:int|null, tInput:number|null,
              part:'head'|'tail', lanes:[int], tick:int }
ScoreState  { score:int, combo:int, maxCombo:int, counts:{perfect,great,good,miss}, judged:int, total:int,
              accuracy:number /* pointsSum / (100*judged), 0 when judged = 0 */, completion:number /* judged/total */,
              pointsSum:int, stray:int, holdBreaks:int, lastStrayLane:int|null }
SectionStat { index, label, startTick, endTick, counts, judged, total, pointsSum, accuracy }
PerformanceSummary {
  version:1, songId, chartId, trackId, difficulty, profile, settingsHash, windowsPreset,
  comparable:boolean, calibration:{inputOffsetMs, audioLatencyMs}, strayPenalty,
  score, maxCombo, counts, judged, total, accuracy, completion, pointsSum, stray, holdBreaks,
  earlyCount, lateCount, meanDeltaMs:int, absMeanDeltaMs:int, sections:[SectionStat],
  worstSectionIndex:int|null, startedAt, completedAt, durationSec
}
```

Events emitted: `EVT-judge.result` (payload `JudgeResult`, one per head or tail judgment,
including misses), `EVT-score.update` (payload `ScoreState` copy, emitted after every
change including strays) and `EVT-chart.finished` (payload `{chartId, kind:'instrument', summary,
endedBy}`, once per bind, from `finish(endedBy)`). Events consumed: `EVT-input.event` when attached.

#### 6.9.3 Internal state

```js
JudgeState {
  chart, song, windows:{perfect,great,good}, goodSec, preset, offsetSec,   // offsetSec = (inputOffsetMs + audioLatencyMs)/1000
  timeMap, active:boolean, strayPenalty,
  notes: [RuntimeNote],                 // chart.notes order (tick ascending)
  byLane: [ [noteIndex] x4 ],           // indices of notes whose lanes include the lane, tick ascending
  laneCursor: [int x4],                 // first index in byLane[l] that may still be unjudged
  missCursor: int,                      // first note index whose head is not yet declared missed/judged
  pending: Map<noteIndex, PendingChord>,// chord heads partially pressed
  holds: Map<noteIndex, ActiveHold>,
  score: ScoreState, results: [], log: [], sectionStats: [SectionStat], sectionIndexOfNote: Int32Array,
  deltaSum:int, absDeltaSum:int, deltaCount:int, early:int, late:int,
  held: Set<lane>                        // lanes currently pressed as seen by the Judge
}
RuntimeNote  { ref: ChartNote, idx, laneMask:int, headJudged:boolean, tailJudged:boolean, tailDue:boolean }
PendingChord { firstTAdj:number, lanesPressed:int (mask), deltas:[int] }
ActiveHold   { noteIdx, lanesHeld:int (mask), endTick }
```

Invariants:
1. A note's head is judged at most once; a hold's tail at most once; `judged` counts heads
   plus tails; `total = notes.length + number of hold notes`.
2. Misses are declared in note order at their window-close time, and always before any input
   whose adjusted time is later than that close time (deterministic ordering, 6.9.4 A).
3. All arithmetic on score, combo, points and deltas is integer; `accuracy` and `completion`
   are derived at read time from integers.
4. `offsetSec` is read from `Calibration` only in `setCalibration`; no other module subtracts
   or adds calibration to input or note times.
5. `restart()` leaves `state()` equal to a fresh `load()` (P 5.2 "restart does not reuse
   stale scoring state").

#### 6.9.4 Algorithms

Notation: `noteT(n) = timeMap.audioTimeAt(n.tick)` (audio seconds for the note under the
current transport anchor and speed), `endT(n) = timeMap.audioTimeAt(n.tick + n.durTicks)`,
`good = windows.good`, `tAdj = evt.tAudio - offsetSec`. Deltas are in integer ms:
`deltaMs = roundMs((tAdj - noteT(n)) * 1000)`; positive = late. Inside test: `abs(deltaMs) <=
window` (B 9.3 boundary: an input exactly on the window edge is inside; `judgmentFor(45,
beginner) === 'perfect'`, `judgmentFor(46, beginner) === 'great'`).

Judgment windows are compared in real (audio) time, so a slower practice speed does not widen
or narrow them (decision; reason: windows describe player reaction accuracy).

A. Deterministic ordering (`advance(tLimit)`), called at the start of `onInput` with `tLimit =
tAdj` and from `tick(audioNow)` with `tLimit = audioNow - offsetSec`:
1. While `missCursor < notes.length` and `noteT(notes[missCursor]) + good/1000 < tLimit`:
   let `n = notes[missCursor]`. If `!n.headJudged`: declare head miss (E.3) with
   `tInput:null`, `deltaMs:null`; delete any `pending` entry for it. `missCursor++`.
   (Notes whose head was hit earlier are skipped; the cursor only ever moves forward because
   `notes` is tick-ascending and `noteT` is monotonic in tick.)
2. For each `ActiveHold h` with `endT(h) + good/1000 < tLimit` and tail not judged: tail
   auto-complete: if all of `h.lanesHeld` are still in `held` -> tail judged `'perfect'` with
   `deltaMs: 0` (holding through the end is the ideal; a late release is never penalized);
   otherwise (lanes were released by a `'system'` release while active) -> hold break (C.3).
3. Because every `onInput` first runs `advance(tAdj)`, the sequence of judgments depends only
   on the input log, not on the cadence of `tick()` calls (the replay invariant, B 9.4).

B. `onInput(evt)`:
1. If `!active` -> return null (paused: no stray, no judgment, P 5.2; the event is still
   appended to `log` with a `ignored:true` flag so replays reproduce the pause).
2. `lane = laneOf(evt.control)`; if `lane < 0` -> return null. Append `evt` to `log`.
3. If `evt.tAudio === null` -> `Log.warn('RHY_NO_TAUDIO')` once and return null.
4. `tAdj = evt.tAudio - offsetSec`; `advance(tAdj)`.
5. Release (`evt.type === 'release'`): `held.delete(lane)`; for each `ActiveHold` whose
   `lanesHeld` includes lane -> C.2; return null (tails are reported via `results`).
6. Press: `held.add(lane)`. Candidate search in `byLane[lane]` from `laneCursor[lane]`:
   advance the cursor past notes with `headJudged`; then scan notes while `noteT(n) <= tAdj
   + good/1000`, skipping judged heads; keep the unjudged note with the smallest
   `abs(deltaMs)` such that `abs(deltaMs) <= good`; ties -> the earlier tick. No candidate ->
   stray (E.5), return null.
7. Single-lane note (`laneMask` has one bit): judge head with `deltaMs` (E.1), return the
   result.
8. Chord note (two or more lanes): `p = pending.get(idx)`. If none: create `{firstTAdj: tAdj,
   lanesPressed: bit(lane), deltas:[deltaMs]}`; return null (nothing judged yet). Else if
   `bit(lane)` already in `lanesPressed` -> return null (duplicate lane press within the
   chord; not a stray). Else if `roundMs((tAdj - p.firstTAdj) * 1000) > CHORD_TOLERANCE_MS`
   -> this press is a stray (E.5), the chord stays pending; return null. Else add lane and
   delta. If `lanesPressed === n.laneMask`: judge head with `deltaMs = the delta of largest
   absolute value` (worst lane; ties -> the later press), delete pending, return the result.
   A chord still pending when its window closes is missed by A.1 (partial presses are not
   strays).

C. Holds:
1. On a non-miss head judgment of a note with `isHold`: `holds.set(idx, {lanesHeld:
   laneMask, endTick: tick + durTicks})`. If `endT <= noteT + 0.001` (zero-length after
   truncation) the tail is judged `'perfect'` immediately (degenerate hold; the generator
   avoids this but a custom dance chart may not).
2. Release of a held lane: `h.lanesHeld &= ~bit(lane)`. `relDelta = roundMs((tAdj -
   endT(h)) * 1000)`. If `relDelta < -good` -> hold break (C.3). Else tail judged by
   `judgmentFor(abs(relDelta))` (which exists because `relDelta >= -good`; a late release
   beyond `+good` cannot occur here because A.2 auto-completes first). Delete the hold.
   Only the first lane release of a chord hold is judged; the other lanes' releases find no
   hold.
3. Hold break: tail judged `'miss'` (counts.miss++, combo = 0, `holdBreaks++`), `deltaMs =
   relDelta` (or null when caused by A.2), head judgment kept. Delete the hold. The HUD text
   for a tail miss is "Hold break" (M-26 reads `part:'tail'`).
4. Pause: `setActive(false)` leaves holds untouched. On `setActive(true)` (resume), for each
   hold: lanes in `lanesHeld` that are not in `Input.held()` are treated as released at
   `tAdj = Transport.audioTimeAt(Transport.positionTick())` (the resume position), applying
   C.2. Lanes still physically held continue. (E 7 "hold begins before a pause and ends after
   resume".)
5. Seek while active: the mode calls `restart()` for a seek outside the loop region; a loop
   wrap (`transport.loop`) calls `restart()` as well when practicing a section (decision:
   each loop pass is a fresh scoring pass; the mode shows the pass number).

D. `tick(audioNow)`: if `!active` return `[]`; `advance(audioNow - offsetSec)`; return the
results declared during this call. The mode calls `tick` once per frame; a stalled frame (E
2.2, 100-500 ms) only delays the declaration of misses, never their time or order.

E. Scoring (integers only):
1. Head judgment `j` with `deltaMs`: `points = POINTS[j]`; `mult = min(4, 1 + floor(combo /
   10))` using the combo before this note; `score += points * mult`; `pointsSum += points`;
   `counts[j]++`; `judged++`; if `j !== 'miss'`: `combo++`, `maxCombo = max(maxCombo,
   combo)`; else `combo = 0`. Delta statistics (non-miss only): `deltaSum += deltaMs`,
   `absDeltaSum += abs(deltaMs)`, `deltaCount++`, `early++` when `deltaMs < 0`, `late++`
   when `> 0`. Section stats updated via `sectionIndexOfNote[idx]` (F). Emit `judge.result`
   then `score.update`.
2. Tail judgment: identical arithmetic with `part:'tail'`; the tail's `lanes` and `tick` are
   the note's (tick = end tick).
3. Miss declaration: as E.1 with `j = 'miss'`, `deltaMs:null`, `tInput:null`.
4. Multiplier examples: notes 1-10 of a streak x1, 11-20 x2, 21-30 x3, 31+ x4. Maximum score
   for a chart of N heads and H tails with all perfects is computable in a test
   (`100 * sum of multipliers`).
5. Stray press: `stray++`, `lastStrayLane = lane`; if `strayPenalty === 'combo'`: `combo =
   max(0, combo - 1)`. No `judge.result`; emit `score.update` (the HUD flashes the pad).
   `strayPenalty` is `'combo'` when the setting `gameplay.strayPressPenalty` (Part 5.11, default false) is true, else `'none'`.
6. `accuracy = judged === 0 ? 0 : pointsSum / (100 * judged)`; `completion = total === 0 ?
   0 : judged / total`. Display rounding (two decimals of percent) is done by the UI.

F. Sections: `sectionsOf(song)`: markers with `kind === 'section'` sorted by tick define
`[startTick, nextStartTick)`; a leading unlabeled section `"Intro"` covers `[0,
firstMarkerTick)` when the first marker is not at 0; when no section markers exist, sections
are every 4 bars: `startTick = meterMap.tickOfBar(4k)` with labels `"Bars 1-4"`, `"Bars 5-8"`,
... The last section ends at `song.durationTicks` (or the last note end if larger). On
`load`, each note's section index is precomputed by binary search on `startTick`; tails
belong to the head's section. `worstSectionIndex` = the section with the lowest accuracy
among sections with `judged >= 4` (ties -> earlier), else null.

G. `summary(meta)`: fills `PerformanceSummary` from state; `meanDeltaMs = deltaCount ?
roundMs(deltaSum / deltaCount) : 0`; `absMeanDeltaMs` likewise; `comparable = preset ===
'standard' && strayPenalty === 'none'`; `calibration` copied from the last
`setCalibration` (calibration values are informational and do not affect `comparable`:
Part 5.11 marks which settings break comparability; windows and penalties do, calibration does
not).

H. `replay(chart, song, difficulty, inputLog, calibration, opts)`: creates a Judge with
`timeMap = {audioTimeAt: t => song.tempoMap.ticksToSeconds(t), tickAt: s =>
song.tempoMap.secondsToTicks(s)}` (speed 1, anchor 0), `load`, `setCalibration`,
`setActive(true)`; for each logged event in order: events flagged `ignored` toggle nothing
(they were ignored live too) but events carry `activeChange` markers written by `setActive`
into the log (`{marker:'active', on:boolean, tAudio}`) so the replay reproduces pauses;
then `onInput(evt)`; finally `tick(lastEventT + 10)`. Returns `{state, results}`. The live
`results` must equal the replay `results` element by element (UT-09-27) - the primary
determinism gate (I 2.4, B 9.4).

I. Dance: M-23 calls `Judge.bind`, `load(danceChartAsChart, song, windowsFor(map[dance
difficulty]))` where `DanceStep` -> `ChartNote {id, tick, durTicks, lanes: directions,
sourceEventIds: [], pitches: [], isHold}` and controls `dance0..3` map to lanes 0..3 through
`laneOf`. Nothing else differs.

#### 6.9.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| chart invalid (unsorted, bad lanes, duplicate ids) | `load` validation throws `E-INP-012` | previous chart (not replaced) | regenerate chart | none | toast "Chart data is invalid; regenerating" (M-28) | n/a | `load` with regenerated chart | UT-09-02 |
| input without `tAudio` (audio not running) | null check | score | automatic when audio resumes | none | DLG-ResumeAudio by M-28 | inputs ignored | audio resume -> anchor -> inputs judged | UT-09-25 |
| frame stall delays `tick` (E 2.2) | none needed | all | n/a | none | none | misses declared late but at correct order | `advance` on next input or tick | UT-09-20 |
| input while paused | `active === false` | score unchanged | n/a | none | none | n/a | n/a | UT-09-21 |
| hold spans a pause (E 7) | `setActive(true)` re-check | holds | n/a | none | HUD shows hold state | n/a | C.4 | UT-09-18 |
| release-all (system) during a hold | release events with source `system` | head judgment | n/a | none | "Hold break" | n/a | C.3 | UT-09-19 |
| calibration changed mid-song (E 4.1) | `setCalibration` while active | all judged notes keep their results | n/a | none | HUD toast "Calibration changed; results not comparable" when changed while active (`comparable=false` for this run) | n/a | next run | UT-09-29 |
| chord with more lanes than the player can press (E 4.2) | generator caps lanes to maxLanes | n/a | n/a | none | inspection warning | n/a | n/a | UT-08-24 |
| `judge.result` listener throws | `Emitter` per-listener isolation (6.1) | Judge state | n/a | none | ErrorReporter | listener skipped | n/a | UT-09-30 |
| time map returns NaN (transport not anchored) | `Number.isFinite` guard in `noteT` | score | automatic | none | none | inputs ignored until anchored | anchor | UT-09-26 |

#### 6.9.6 Limits and performance notes

- `onInput`: O(k) where k is the number of notes within the good window in that lane
  (<= 3 at 240-tick spacing and 135 ms window up to 300 BPM); `tick`: O(misses declared +
  holds). Both allocate only the result objects. Target <= 0.05 ms per call.
- `load`: O(n) plus one binary search per note for sections; 20,000 notes <= 20 ms.
- `log` holds every active press/release: <= 32 bytes per entry in typed-array form
  (`control index, type, tAudio` as Float64 and Uint8 arrays with a growth factor of 2); a
  10-minute expert chart logs ~5,000 events (~160 KB). The mode clears it in `restart()`.
- `results` <= `total` entries; `sections` <= 1 + bars/4.
- Windows and points are constants; the UI's "custom windows" accessibility setting passes a
  widened copy through `setWindows(w, 'custom')` (each width >= the standard value; the
  module refuses narrower-than-standard custom windows with `E-INP-011`).

#### 6.9.7 Spec coverage

B 7.2 (scoring and feedback, sustained notes, rests), B 7.5 (score and feedback), B 7.6
(timing judgments, combos, score, miss and accuracy, holds via the shared Judge), B 8.5 (no
double compensation), B 9.1 (ticks, count-in via `active`), B 9.3 (configurable windows,
documented in ms, calibration applied to the comparison), B 9.4 (all 8 items; determinism), B
14.2, B 14.4 (independence from instrument mapping), B 22 (configurable windows), E 2.2
(frame stall ordering), E 4.1 (hold through pause, calibration change), E 4.2 (all 12 cases;
same-timestamp notes are one chord note by generation, overlapping chords by lane masks,
missed and retried, exact boundary, early input = stray, stray press policy, sustained across
boundary, more than four lanes capped by generator), E 7 (hold across pause, consecutive
misses), E 10 item 2, I 1.3, I 2.3, I 2.4 (section feedback, deterministic and independently
testable), I 17 (scoring boundary conditions), I 19 (deterministic judgment), P 5.2 (all 12
lines), P 5.3 (comparability flag), P 12 (holds and releases judged consistently).

#### 6.9.8 Unit tests

Setup common to all: `judge = Judge.bind({timeMap: fixed 120 BPM map (tick t -> t/1920 s),
...})`, `load(chart, song, 'beginner')` unless stated, `setCalibration({inputOffsetMs:0,
audioLatencyMs:0})`, `setActive(true)`. `press(lane, tMs)` and `release(lane, tMs)` build
InputEvents with `tAudio = tMs/1000`. Chart fixtures: `single(lane, tick)`, `chord(lanes,
tick)`, `hold(lane, tick, dur)`, built by `FLM.SelfTest.fixtures.chart([...])` with
`settingsHash` computed.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-09-01 | windows table | `windowsFor` x4 | equals BRIEF 6 values; unknown throws E-INP-011 |
| UT-09-02 | load validation | chart with `lanes:[4]`; chart unsorted | both throw E-INP-012; previous chart still loaded |
| UT-09-03 | boundary exactly +window (beginner) | note at 1000 ms; press at 1045, 1090, 1135 on three notes | perfect, great, good |
| UT-09-04 | boundary exactly -window (beginner) | presses at -45, -90, -135 relative | perfect, great, good; `deltaMs` -45, -90, -135 |
| UT-09-05 | one past each boundary | +46, +91, +136 | great, good, stray (no result; `stray === 1`) |
| UT-09-06 | expert windows | load 'expert'; presses +18, +19, +40, +41, +70, +71 | perfect, great, great, good, good, stray |
| UT-09-07 | rounding symmetry | press at +45.5 ms and -45.5 ms on two notes (beginner) | both `deltaMs` 46/-46 -> great; `roundMs(0.4) === 0`, `roundMs(-0.5) === -1` |
| UT-09-08 | points and multiplier | 31 notes all perfect | score = 100*(10*1 + 10*2 + 10*3 + 1*4) = 7000; combo 31 |
| UT-09-09 | miss resets combo, multiplier from combo before note | 12 perfects, 1 miss, 1 perfect | score 100*10 + 100*2*2 + 0 + 100 = 1500; combo 1; maxCombo 12 |
| UT-09-10 | accuracy and completion | 4 notes: perfect, great, good, miss (via tick) | pointsSum 210; accuracy 0.525; completion 1.0; counts {1,1,1,1} |
| UT-09-11 | miss by tick | note at 1000; `tick(1.136)` (beginner) | one miss result with `tInput:null`; `tick(1.135)` before it declares nothing |
| UT-09-12 | nearest-note candidate | notes lane0 at 1000 and 1200; press at 1110 | judged note is the 1200 note (delta -90) because abs 90 < 110 |
| UT-09-13 | missed then retried (E 4.2) | note at 1000; `tick(2.0)`; press at 2010 | miss then stray; no second judgment |
| UT-09-14 | chord all lanes within tolerance | chord lanes [0,2] at 1000; press 0 at 990, press 2 at 1030 | one result after second press, `deltaMs` 30 (worst), perfect |
| UT-09-15 | chord lane beyond 50 ms tolerance | press 0 at 990, press 2 at 1050 | second press is a stray; `tick(1.2)` -> chord miss |
| UT-09-16 | chord missing lane after window | press 0 at 1000 only; `tick(1.2)` | miss; stray count 0 |
| UT-09-17 | hold tail judged on release | hold lane1 tick 0 dur 1920 (1 s); press at 0; release at 1030 | head perfect; tail `part:'tail'` perfect (delta 30 <= 45) |
| UT-09-18 | hold through a pause | hold 2 s; press at 0; `setActive(false)` at 500; `setActive(true)` with `Input.held()` fake containing lane | no break; `tick(3.0)` auto-completes tail perfect |
| UT-09-19 | early release = hold break, head kept | release at 400 (end 1000, good 135) | tail miss; head result unchanged; `holdBreaks === 1`; combo 0 |
| UT-09-20 | stall does not reorder | notes at 1000 (A) and 1200 (B); no tick until press on B at 1190 | results order: A miss (declared at onInput), then B hit; score identical to a run with `tick` every 10 ms |
| UT-09-21 | inactive ignores inputs | `setActive(false)`; press | returns null; `stray === 0`; log entry flagged ignored |
| UT-09-22 | stray penalty option | `Judge.bind({strayPenalty:'combo'})`; 3 hits then a stray | combo 2; `lastStrayLane` set; `summary().comparable === false` |
| UT-09-23 | calibration applied once | `setCalibration({inputOffsetMs:30, audioLatencyMs:20})`; note at 1000; press at 1050 | `deltaMs === 0` (perfect); no other module changed the event (`evt.tAudio` still 1.050) |
| UT-09-24 | custom windows refuse narrower | `setWindows({perfect:10, great:40, good:70}, 'custom')` on expert | throws E-INP-011; widened windows accepted and `comparable === false` |
| UT-09-25 | input without tAudio | press with `tAudio:null` | null; Log has RHY_NO_TAUDIO once |
| UT-09-26 | NaN time map guard | timeMap returning NaN | onInput returns null, tick declares nothing, no exception |
| UT-09-27 | replay determinism | random-ish but fixed input log (200 events incl. a pause) on `fx.dense` expert chart | `replay(...).results` deep-equals live `results`; `state` deep-equals |
| UT-09-28 | restart clears state | play 5 notes; `restart()` | `state()` equals fresh state; `results()` empty; cursors 0; next press judges the first note again |
| UT-09-29 | calibration change mid-run flags comparability | `setCalibration` while active | `summary().comparable === false`; earlier results unchanged |
| UT-09-30 | listener error isolation | `judge.result` listener throws | onInput still returns the result; ErrorReporter called once |
| UT-09-31 | sections from markers and 4-bar fallback | song with markers at bars 1, 9; song without markers (16 bars) | 2 sections "Intro"-less (first at 0) with labels; fallback gives 4 sections "Bars 1-4".."Bars 13-16"; per-section counts sum to totals |
| UT-09-32 | worst section | misses concentrated in section 2 | `summary().worstSectionIndex === 1` |
| UT-09-33 | dance chart through the same Judge | `DanceStep`s converted to ChartNotes with lanes = directions; `dance2` press | judged like lane2; windows 'intermediate' for 'normal' |
| UT-09-34 | total counts heads plus tails | chart with 10 notes of which 3 holds | `total === 13`; after all judged `completion === 1` |
| UT-09-35 | speed does not change windows | timeMap at speed 0.5 (tick t -> t/960 s) | press 45 ms late is still perfect; chart spacing in audio time doubles |
| UT-09-36 | nextNotes helper | 5 notes in lane 0 | `nextNotes(0, 2)` returns the first two unjudged; after judging one, returns notes 2-3 |

#### 6.9.9 Implementation notes and browser quirks

- The Judge must not read `performance.now()` or `AudioContext.currentTime` itself; all times
  come from `InputEvent.tAudio` and the `audioNow` argument (I 1.3).
- `timeMap` defaults to `FLM.Transport` (`audioTimeAt`, `tickAt`); during `countin` the
  transport reports negative ticks, so `setActive(false)` during count-in avoids strays.
- Keep `laneMask` bit operations in 32-bit ints; `lanes` arrays are derived once at `load`.
- Emit `judge.result` before `score.update` so HUD text and numbers update in one frame.
- The `log` is the multiplayer input stream source: M-24 serializes entries `{lane, type,
  tShared}` from it (6.24).
- `Object.freeze` the `WINDOWS` and `POINTS` tables in the test build to catch accidental
  mutation (`'use strict'` turns writes into TypeErrors).
