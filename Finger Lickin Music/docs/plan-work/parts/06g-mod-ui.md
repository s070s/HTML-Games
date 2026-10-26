### 6.26 M-26 UI (`src/26-ui.js`, `FLM.UI`)

#### 6.26.1 Responsibilities and non-goals

Responsibilities:

- The screen stack inside `#overlay`: `push`, `replace`, `pop`, `popTo`, `back`, with one
  `history` entry per pushed screen and the browser back/forward rules of 6.26.4.2.
- Focus management: visible focus ring (`:focus-visible` plus the `.focus-ring` class for
  programmatic focus), focus trap in dialogs, focus restoration on dialog close and on screen
  pop, roving tabindex in lists, tabs and menus.
- Keyboard navigation for every menu, dialog and widget (Tab, Shift+Tab, arrows, Enter,
  Space, Escape, Home, End, PageUp, PageDown) and gamepad navigation in panel modes
  (d-pad as arrows, button 0 as Enter, button 1 as Escape).
- The widget set: `button`, `toggle`, `slider` (units, precision, keyboard and pointer),
  `select`, `number`, `list`, `tabs`, `field` (text input). Every widget has the five states
  of P 1 (empty, loading, success, error, disabled) where they apply and a disabled reason.
- Dialogs with consequence text (`dialog`, `confirmUnsaved`), `closeAllDialogs`,
  `dialogCount`; toasts with a queue, durations and dedupe.
- Responsive layout: `portrait`/`landscape` and `compact` classes on `body`, the width class
  `body[data-width]`, safe-area measurement, the `ui.layout` event, UI scale (`--ui`), high
  contrast and reduced motion classes on `html`.
- The touch pad component in `#touch` (4 pads, glyphs, pressed state, per-orientation layout
  and size), the HUD component in `#hud`, and the transport bar component.
- The user-facing text catalog lookup `UI.text(id, vars)` (the strings themselves are Part
  7.11; M-26 holds them as a frozen table `UI.TEXT`).
- Text-entry restriction during active gameplay and the long-name truncation rules.
- Being the error presenter of M-01 for the `recoverable` class (toast), registered with
  `Core.ErrorReporter.setPresenter`.

Non-goals: no knowledge of songs, projects, audio, transport or input semantics (M-26
references only M-01; it learns about the rest of the system only through bus payloads and
through arguments given by M-27 and M-28). No screen content: controllers live in M-27.
No canvas drawing (M-18, M-21). No persistence: settings are applied, never stored, by M-26.

#### 6.26.2 Public API

```js
FLM.Core.define('UI', function (FLM) {
  return Object.freeze({
    /** Called once by M-29 boot step B6. Builds nothing inside #overlay; measures layout,
     *  applies the given settings document, installs window resize/orientationchange,
     *  keydown (capture, for Escape and focus-ring tracking), pointerdown (focus-ring off)
     *  and popstate-independent listeners through Core.dom with owner UI_OWNER, registers the
     *  presenter with Core.ErrorReporter.setPresenter, subscribes to settings.changed, error,
     *  input.event (pad pressed state) and input.device (gamepad navigation).
     *  @param {{settings:object, caps:object}} opts  @returns {void}  Idempotent (second call is a no-op). */
    init(opts) {},

    // ---- screen stack ----
    Screens: {
      /** M-27 installs the controller resolver once: (screenId) -> ScreenController factory.
       *  @param {(id:string) => (() => ScreenController)} fn */
      setResolver(fn) {},
      /** Mount a new screen above the current one; adds one history entry.
       *  @param {string} id 'SCR-*'  @param {object=} params
       *  @returns {Promise<ScreenController>} resolves after mount() resolved and focus moved.
       *  Rejects with Error .code 'E-MODE-002' when the resolver has no such id or mount throws
       *  (the stack is left unchanged). Emits ui.screen {action:'push'}. */
      push(id, params) {},
      /** Unmount the top screen and mount `id` in its place (same depth; history entry
       *  replaced with history.replaceState). Emits ui.screen {action:'replace'}. */
      replace(id, params) {},
      /** Unmount the top screen without consulting onBack (programmatic). Refuses to pop the
       *  root (depth 1) and returns false. Emits ui.screen {action:'pop'}. */
      pop() /* -> Promise<boolean> */ {},
      /** Unmount every screen above the deepest screen with this id (default root). */
      popTo(id) /* -> Promise<number popped> */ {},
      /** User back (Back button, Escape with no dialog open, browser back via M-28 popstate):
       *  asks the top controller's onBack(); pops only on 'pop'. Returns the decision. */
      back(source /* 'button'|'key'|'browser'|'gamepad' */) /* -> Promise<'pop'|'handled'|'root'> */ {},
      current() /* -> {id, params, controller}|null */ {},
      depth() /* -> int (0 before boot, 1 = root only) */ {},
      ids() /* -> string[] bottom first (diagnostics, tests) */ {},
      /** History integration on/off (M-28 turns it on at Modes.init; tests turn it off). */
      setHistory(enabled /* boolean */) {},
      /** Called by M-28's popstate listener with event.state. */
      onPopState(state /* object|null */) /* -> Promise<void> */ {}
    },

    // ---- focus ----
    Focus: {
      /** Trap Tab inside root; returns a handle. Stack-based: the newest trap is active. */
      trap(root /* HTMLElement */) /* -> {release():void} */ {},
      release(handle) {},
      /** Focus `el`, or the first focusable inside a root, or the remembered element. Shows the
       *  focus ring when the last input was a key or gamepad, hides it after a pointer press. */
      restore(elOrRoot /* ?HTMLElement */) /* -> HTMLElement|null */ {},
      remember() /* -> HTMLElement|null (document.activeElement) */ {},
      focusable(root) /* -> HTMLElement[] in tab order */ {}
    },

    // ---- dialogs and toasts ----
    /** @param {DialogSpec} spec @returns {Promise<string>} the chosen button id, 'cancel' for
     *  Escape or backdrop, 'dismissed' when closed by closeAllDialogs. Emits ui.dialog twice
     *  (open, close). At most 3 dialogs stack; a 4th call rejects with E-GEN-001. */
    dialog(spec) {},
    closeAllDialogs(reason /* string */) /* -> number closed */ {},
    dialogCount() /* -> int */ {},
    /** @param {string} message  @param {ToastOptions=} opts  @returns {string} toast id */
    toast(message, opts) {},
    clearToasts() /* -> void */ {},
    /** DLG-UnsavedChanges. describe = Project.guard.describe(project) (M-15).
     *  @returns {Promise<'save'|'discard'|'cancel'>} */
    confirmUnsaved(describe /* {title, body, changeCount, lastSavedAt} */, opts /* ?{canSave:boolean} */) {},

    // ---- widgets (each returns a Widget handle; DOM is built with el() and text only) ----
    Widgets: {
      button(spec /* {id, label, icon?, kind:'primary'|'secondary'|'danger'|'ghost', onPress, disabledReason?, ariaLabel?} */) {},
      toggle(spec /* {id, label, value:boolean, onChange, disabledReason?} */) {},
      slider(spec /* SliderSpec */) {},
      select(spec /* {id, label, options:[{value, label, disabledReason?}], value, onChange} */) {},
      number(spec /* {id, label, min, max, step, value, unit, precision, onChange} */) {},
      list(spec /* {id, label, items:[{id, primary, secondary?, badge?, disabledReason?}], onPick, selectedId?, emptyText} */) {},
      tabs(spec /* {id, tabs:[{id, label}], value, onChange} */) {},
      field(spec /* {id, label, value, maxLength, pattern?, onCommit, placeholder?} */) {}
    },
    // Widget { root:HTMLElement, set(value), get(), setDisabled(reason /* string|null */),
    //          setState(state /* 'idle'|'loading'|'success'|'error' */, message?), focus(), destroy() }

    // ---- gameplay chrome ----
    HUD: {
      /** kind: 'instrument'|'dance'|'freeplay'|'studio'|'multiplayer'|'tutorial'. owner: the
       *  mode owner token; timers created for coalescing are registered with it. */
      show(kind, owner) {},
      hide() {},
      /** Partial update; unchanged fields cost nothing. @param {HudFields} fields */
      set(fields) {},
      /** Judgment feedback: word + glyph + lane pulse. @param {string} judgment
       *  @param {number[]} lanes  @param {{stray?:boolean, holdPhase?:string}=} opts */
      flash(judgment, lanes, opts) {},
      note(text /* string|null */) {},  // the one-line HUD note ("Graphics paused"), null clears
      reset() {},
      visible() /* -> boolean */ {}
    },
    TouchPads: {
      /** @param {PadSpec} spec  Builds 4 .pad elements inside #touch (replacing old ones). */
      show(spec) {},
      hide() {},
      /** Recompute pad rectangles for the current ui.layout (called on ui.layout). */
      layout() {},
      setPressed(index /* 0..3 */, pressed /* boolean */) {},
      root() /* -> HTMLElement #touch */ {},
      rects() /* -> [{x,y,w,h}] CSS px, for tests */ {}
    },
    /** Factory; the bar is placed by the caller. */
    TransportBar: {
      create(root, spec /* {buttons:string[], onAction:(id)=>void, showTempo:boolean} */) /* -> TransportBarHandle */ {}
    },
    // TransportBarHandle { update(TransportView), setEnabled(buttonId, enabled, reason?), destroy() }

    // ---- layout and presentation ----
    Layout: {
      orientation() /* -> 'portrait'|'landscape' */ {},
      safeArea() /* -> {top, right, bottom, left} CSS px */ {},
      compact() /* -> boolean */ {},
      widthClass() /* -> 'narrow'|'medium'|'wide' */ {},
      setScale(scale /* 0.8..1.5 */) /* -> number applied */ {},
      snapshot() /* -> ui.layout payload */ {}
    },
    setReducedMotion(mode /* 'system'|'on'|'off' */) /* -> boolean effective */ {},
    reducedMotion() /* -> boolean */ {},
    setHighContrast(on /* boolean */) {},
    /** M-28 sets false while a gameplay mode is playing or counting in. */
    setTextEntryAllowed(allowed /* boolean */) {},
    textEntryAllowed() /* -> boolean */ {},

    // ---- text ----
    truncate(str, maxChars, opts /* ?{keepExt:boolean} */) /* -> string */ {},
    TEXT: /* frozen {id: string} catalog of Part 7.11 */ {},
    /** Catalog lookup with {name} substitution; unknown id -> the id itself and Log.once warn. */
    text(id, vars) /* -> string */ {},
    /** DOM builder: el('button', {class:'btn', 'aria-label':'Play', on:{click:fn}}, [child...]).
     *  Strings in children become text nodes. Attributes named on* are refused (use `on`). */
    el(tag, attrs, children) /* -> HTMLElement */ {},

    /** Leak-test helper for M-28: {screens, dialogs, toasts, traps, padEls, hudVisible}. */
    counters() {}
  });
});
```

```js
/** ScreenController: implemented by M-27 for every SCR-*. All methods optional except mount. */
ScreenController {
  id,                                   // 'SCR-...'
  mount(root /* <section class="screen" data-screen=id> */, params, ctx /* {owner, ui:FLM.UI} */) /* -> void|Promise */,
  unmount() /* -> void; remove listeners registered with ctx.owner is done by M-26 */,
  onBack(source) /* -> 'pop'|'handled'|Promise<...>; default 'pop' */,
  onShow() /* became top again */, onHide() /* covered by a pushed screen */,
  initialFocus() /* -> HTMLElement|null */,
  keys /* ?{ [KeyboardEvent.code]: (evt) => boolean handled } screen shortcuts */
}
DialogSpec {
  id,                                   // 'DLG-*'
  title, body /* string or string[] paragraphs */, consequence /* string, required when any button kind is 'danger' */,
  buttons: [{id, label, kind:'primary'|'secondary'|'danger', isDefault?:boolean, isCancel?:boolean}],
  build /* ?(contentRoot, close(resultId)) => void, custom content (wizards) */,
  dismissible /* default true: Escape and backdrop give 'cancel' */,
  owner /* ?token; closeAllDialogs and Core.dom.offOwner clean it */
}
ToastOptions { kind:'info'|'success'|'warn'|'error', action?:{label, onPress}, durationMs?, key? /* dedupe key, default message */ }
SliderSpec { id, label, min, max, step, value, unit /* 'ms'|'%'|'dB'|'BPM'|'x'|'' */,
             precision /* decimals shown */, format? /* (v) => string */, onInput /* live, coalesced 10 Hz */,
             onChange /* committed: pointer up, key up */, bigStep? /* PageUp/PageDown, default 10 * step */ }
HudFields { score?:int, combo?:int, accuracy?:number 0..1, progress?:number 0..1, section?:string,
            performers?:[{slot, label, active:boolean}], judgmentWindow?:string, bpm?:number,
            sync?:'good'|'fair'|'poor'|null, lanesLabel?:[string x4], peers?:[{name, score, combo, connected}],
            chord?:string, keyLabel?:string, profileLabel?:string, octave?:int, timingLabel?:string,
            life?:number 0..1, countIn?:int|null, step?:{index:int, total:int} }
PadSpec { kind:'lanes'|'dance', layout:'bottom'|'right', size:'small'|'medium'|'large', opacity:number 0.3..1,
          labels:[string x4] /* aria-labels */, maxTouches:int /* from Caps.maxTouchPoints */ }
TransportView { state, bar, beat, timeS, durationS, bpm, loop:{enabled, aBar, bBar}|null, recording:boolean, countIn:int|null }
```

Events emitted: `ui.screen {action, screen, prev, depth}`, `ui.dialog {id, open, result}`,
`ui.layout {orientation, width, height, dpr, compact, safeArea}` (payloads of Part 4.4).
Events consumed: `settings.changed` (keys `video.uiScale`, `video.reducedMotion`,
`video.highContrast`, `accessibility.*`, `input.padLayout`, `input.padSize`,
`input.padOpacity`, `gameplay.showJudgmentText`), `error` (recoverable class -> toast via the
presenter; M-26 never shows dialogs for errors), `input.event` (pad pressed state, only while
pads are shown), `input.device` (start or stop gamepad menu navigation).

#### 6.26.3 Internal state

```js
const UI_OWNER = Symbol('ui');            // owner of M-26's own permanent listeners
stack: [{id, params, controller, root /* section */, owner /* Symbol per screen */, focusBefore}]  // bottom first
history: {enabled:false, ignorePops:0, baseDepth:0}   // baseDepth = history.length-independent counter
dialogs: [{id, spec, root, resolve, trap, focusBefore, owner}]                          // max 3
toasts: {visible:[{id, el, timer}], queue:[{message, opts}], recent: Map<key, tShown>}   // visible <= 3, queue <= 10
traps: [{root, keyHandler}]                // last element is active
focusRingMode: 'key' | 'pointer'          // toggles html.class 'kbd-nav'
layout: {orientation, width, height, dpr, compact, widthClass, safeArea, scale}
presentation: {reducedMotion:boolean, reducedMotionMode, highContrast:boolean}
hud: {kind:null, owner:null, fields:{}, rendered:{}, pending:null, lastApply:0, flashTimer:null, els:{}}
pads: {spec:null, els:[], pressed:[false,false,false,false]}
textEntryAllowed: true
gamepadNav: {timer:null, prevButtons:[]}  // only while a gamepad is connected and no gameplay HUD is shown
```

Invariants: `stack.length >= 1` after M-29 step B14; the DOM order of `#overlay` children
equals the stack order followed by the dialog layers; exactly one screen (`stack[top]`) is
not `inert` (lower screens get the `inert` attribute and `aria-hidden="true"`); while a dialog
is open every screen is inert; `hud.kind === null` iff `#hud.hidden`; `pads.els.length` is 0 or
4 and `#touch.hidden === (pads.els.length === 0)`.

#### 6.26.4 Algorithms

6.26.4.1 Screen stack

```js
async function push(id, params) {
  const factory = resolver(id);                          // throws E-MODE-002 'unknown screen <id>'
  const controller = factory();
  const owner = Symbol(id);
  const root = el('section', {class:'screen', 'data-screen': id, role:'region', 'aria-label': text('screen.' + id)});
  const top = stack[stack.length - 1];
  const focusBefore = Focus.remember();
  overlay.appendChild(root);
  try { await controller.mount(root, params || {}, {owner, ui: FLM.UI}); }
  catch (e) { Core.dom.offOwner(owner); root.remove(); throw coded('E-MODE-002', e, {screen:id}); }
  if (top) { top.controller.onHide && top.controller.onHide(); setInert(top.root, true); }
  stack.push({id, params, controller, root, owner, focusBefore});
  if (history.enabled) safeHistory('pushState', {flm:1, depth: stack.length, screen:id});
  Focus.restore(controller.initialFocus ? controller.initialFocus() : root);
  bus.emit('ui.screen', {action:'push', screen:id, prev: top ? top.id : null, depth: stack.length});
  return controller;
}
async function popInternal() {                           // shared by pop, popTo, back
  const top = stack.pop();
  try { top.controller.unmount && top.controller.unmount(); } catch (e) { report('E-GEN-001', e, {screen: top.id, op:'unmount'}); }
  Core.dom.offOwner(top.owner); Core.timers.clearOwner(top.owner); bus.removeOwner(top.owner);
  top.root.remove();
  const now = stack[stack.length - 1];
  setInert(now.root, false); now.controller.onShow && now.controller.onShow();
  Focus.restore(top.focusBefore && now.root.contains(top.focusBefore) ? top.focusBefore : now.root);
  bus.emit('ui.screen', {action:'pop', screen: top.id, prev: now.id, depth: stack.length});
}
```

- `replace(id, params)` = mount the new controller first (same failure rule as `push`), then
  unmount the old top, so a failing mount leaves the old screen in place. History:
  `replaceState({flm:1, depth, screen:id})`.
- `pop()`: returns false at depth 1; otherwise `popInternal()`; when history is enabled it
  increments `history.ignorePops` and calls `history.back()` so the browser entry count follows
  the stack (the resulting `popstate` is swallowed by `onPopState`).
- `popTo(id)`: finds the deepest index `i` with `stack[i].id === id` (default `0`); pops
  `stack.length - 1 - i` times with `popInternal()`; then, when history is enabled and at least
  one screen was popped, `ignorePops++` and `history.go(-(popped))` (one `popstate` results).
- `back(source)`: if a dialog is open, the topmost dialog resolves with `'cancel'` when
  dismissible (return `'handled'`). Else if depth is 1, return `'root'` (SCR-MainMenu decides
  nothing; the browser may leave the page, which is acceptable at the root). Else call
  `controller.onBack(source)` (default `'pop'`); on `'pop'` run `pop()` semantics; on
  `'handled'` do nothing. A throwing `onBack` counts as `'handled'` and is reported
  `E-GEN-001` (a broken controller must not make back navigation destructive).

6.26.4.2 Browser history

`history.pushState` is called once per pushed screen with `state = {flm:1, depth, screen}`.
`safeHistory` wraps every history call in try/catch (some `file://` contexts throw a
`SecurityError`); the first failure sets `history.enabled = false` and logs once
`W-UI-HISTORY`; navigation then works without browser back integration.

`onPopState(state)` (M-28 installs the `popstate` listener and calls it):

1. If `history.ignorePops > 0`: decrement and return (the pop was caused by `pop`/`popTo`).
2. `target = state && state.flm === 1 ? state.depth : 1`.
3. If `target < stack.length` (browser Back): call `back('browser')`. When the result is
   `'handled'` (for example SCR-Pause opened instead of leaving a song, or the unsaved-changes
   guard was cancelled), re-push one entry with `pushState({flm:1, depth: stack.length,
   screen})` so the browser's Back stays meaningful.
4. If `target > stack.length` (browser Forward to an entry of a screen already popped): the
   game never re-opens popped screens; `ignorePops++` and `history.back()` returns the browser
   to the entry that matches the current stack. Forward is therefore a no-op (P 3 "browser back
   and forward behavior is predictable").
5. If `target === stack.length`: nothing.

6.26.4.3 Focus

- Focusable query: `a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),
  textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`, filtered to elements whose
  `getClientRects().length > 0` and that are not inside an `[inert]` ancestor.
- Focus ring: a `keydown` (capture) with code `Tab`, an arrow, `Enter`, `Space`, `Escape`,
  `Home`, `End`, `PageUp`, `PageDown`, or any gamepad navigation step sets `focusRingMode =
  'key'` and adds `html.kbd-nav`; a `pointerdown` removes it. Programmatic `Focus.restore`
  adds `.focus-ring` to the target only in `'key'` mode. The CSS of Part 3.2.4 draws
  `:focus-visible`; `.focus-ring` covers browsers that do not apply `:focus-visible` after
  `element.focus()`.
- `trap(root)`: pushes `{root, keyHandler}`; `keyHandler` on `keydown` `Tab`: with
  `list = focusable(root)`, if `list.length === 0` prevent default; if Shift+Tab on `list[0]`
  focus the last; if Tab on the last focus `list[0]`; prevent default in both wrap cases.
  Focus entering an element outside the active trap (via `focusin`) is redirected to
  `list[0]`. `release` removes the trap; the next trap down (if any) becomes active.
- `restore(x)`: element -> focus it if still connected and focusable; root -> its controller's
  `initialFocus()` or the first element with `data-autofocus`, else the first focusable; never
  focuses a text field on a touch device (`body.touch`), it focuses the screen heading
  (`tabindex="-1"`) instead, so the on-screen keyboard never opens by itself.

6.26.4.4 Keyboard navigation rules

| Context | Keys | Behavior |
|---|---|---|
| Any screen | `Tab`, `Shift+Tab` | native order; screens build DOM in visual order so no positive `tabindex` is used |
| Any screen | `Escape` | `UI.Screens.back('key')` unless a dialog is open (dialog cancel), a widget consumed it (open select), or `body.in-game` is set (then Escape is the M-07 `pause` control and M-28 handles it, 6.28.4.4 step 7) |
| Menu lists (`list`, main menu entries) | `ArrowUp`/`ArrowDown` (and `ArrowLeft`/`ArrowRight` in grid lists) | roving tabindex: exactly one item has `tabindex=0`; arrows move it and focus; wrap at ends; disabled items are focusable (so their reason is read) but not activatable |
| `list` | `Home`, `End` | first, last item |
| `list`, `button`, `toggle` | `Enter`, `Space` | activate; `toggle` flips; activation of a disabled item shows its reason as a toast (kind info) |
| `tabs` | `ArrowLeft`/`ArrowRight`, `Home`, `End` | move selection and activate the tab (automatic activation); `tablist`/`tab`/`tabpanel` roles |
| `slider` | `ArrowLeft`/`ArrowDown` -step, `ArrowRight`/`ArrowUp` +step, `PageDown`/`PageUp` -/+ bigStep, `Home`/`End` min/max | each key press calls `onInput`; `onChange` on keyup |
| `number` | as slider arrows plus typing digits | commit on `Enter` or blur; invalid text restores the last value and shows the error state for 2 s |
| `select` | `ArrowUp`/`ArrowDown` change value without opening; `Enter`/`Space` open the native picker | native `<select>` element |
| `field` | typing; `Enter` commits; `Escape` reverts and blurs | refused while text entry is restricted (6.26.4.10) |
| Dialog | `Escape` -> `'cancel'` when dismissible; `Enter` on a non-button element activates the default button | focus trapped |
| Gamepad (panel modes) | d-pad 12/13/14/15 -> ArrowUp/Down/Left/Right, button 0 -> Enter, button 1 -> Escape | synthesized `KeyboardEvent` dispatched to `document.activeElement` (or `document.body`) with `code` set; repeat after 400 ms, then every 120 ms while held |

Gamepad navigation runs on `Core.timers.setInterval(poll, 100, UI_OWNER)` started when
`input.device {source:'gamepad', connected:true}` arrives and stopped when the last gamepad
disconnects or `HUD.show` is called (gameplay owns the gamepad then); `HUD.hide` restarts it if
a gamepad is still connected. `poll` reads `navigator.getGamepads()` (index of the first non-null
pad, standard mapping only) and edge-detects the six buttons.

6.26.4.5 Widgets

All widgets are built with `el()`; labels use `<label for>` or `aria-labelledby`; every
widget root carries `data-widget=<type>` and the given `id` (prefixed `w-`).

- `button`: `<button type="button" class="btn btn-<kind>">` with optional `<svg class="glyph"><use
  href="#g-<icon>"></use></svg>` and the label text; `disabledReason` non-null -> `aria-disabled=
  "true"` (not the `disabled` attribute, so it stays focusable), a `.reason` line below the
  label (`--fs-2`, muted) with the reason text, and activation shows the reason as a toast.
  Pressed feedback: class `pressed` for `--t-fast` on pointerdown (P 21). `onPress` runs inside
  `try/catch`; a throw reports `E-GEN-001` `{screen, widget:id}` and sets the button state
  `error` for 2 s. A button whose `onPress` returns a Promise shows `loading` (spinner glyph,
  `aria-busy="true"`, re-presses ignored) until it settles.
- `toggle`: `<button role="switch" aria-checked>`; label left, state text right ("On"/"Off").
- `slider`: `<input type="range">` for accessibility plus a value readout `<output>`.
  Display: `format(v)` when given, else `v.toFixed(precision) + unitSuffix` where the suffix is
  `' ms'`, `'%'`, `' dB'`, `' BPM'`, `'x'` or `''` (P 21 "sensible units and precision").
  Values snap to `min + round((v - min) / step) * step` and are clamped; `onInput` is coalesced
  to <= 10 Hz with a trailing call (`Core.timers.setTimeout(..., 100, owner)`); `onChange`
  fires once on `change`. Touch: the range input has `touch-action: pan-y` so a vertical swipe
  scrolls the panel and a horizontal drag moves the thumb; the hit area is at least
  `--touch-min` tall.
- `select`: native `<select>`; options with `disabledReason` are `disabled` and their label is
  suffixed `" - " + reason`.
- `number`: `<input type="text" inputmode="decimal">` plus minus and plus buttons
  (`--touch-min` each); parse with `Number(text.trim())`; out-of-range values clamp and flash
  the error state with text "Allowed: {min} to {max}".
- `list`: `<ul role="listbox">` or `role="menu"` for the main menu (`spec.role`), items `<li
  role="option">`; empty `items` -> the `emptyText` paragraph with the class `empty` (P 21 empty
  states guide the next action). Long primary text is truncated by CSS ellipsis with the full
  text in `title` and `aria-label` (6.26.4.11).
- `tabs`: `role="tablist"`; panels are created by the caller and registered with
  `tabs.panel(tabId, element)`; inactive panels are `hidden`.
- `field`: `<input type="text" maxlength>`; `pattern` validated on commit; `onCommit(value)` with
  trimmed value; `autocomplete="off"`, `spellcheck="false"`, `autocapitalize="off"`.

States: `setState('loading'|'success'|'error'|'idle', message)` sets `data-state`, the
`aria-busy` flag for loading, and a status line (`role="status"`) with the message; `success`
reverts to `idle` after 2,000 ms.

6.26.4.6 Dialogs

1. If `dialogs.length === 3` reject (`E-GEN-001`, `{dialog: spec.id}`); a defect, not a user
   situation.
2. Validate: a `danger` button requires non-empty `consequence` (assert; P 21 "confirmation
   dialogs describe consequences accurately"); exactly one `isCancel` button when `dismissible`.
3. Build `<div class="dialog-layer"><div class="backdrop"></div><div role="dialog"
   aria-modal="true" aria-labelledby aria-describedby class="dialog" data-dialog=id>` with title
   (`h2`), body paragraphs, consequence paragraph (class `consequence`, `--c-warn` text plus a
   warning glyph, never color alone), custom content (`spec.build(contentRoot, close)`), and the
   button row in the order given (primary last on desktop, first on `compact` layouts: the row
   uses `flex-direction: row-reverse` on compact so the primary is nearest the thumb).
4. Append to `#overlay`, mark all screens `inert`, `focusBefore = Focus.remember()`, `trap`, focus
   the `isDefault` button, or the cancel button when any button is `danger` (a destructive
   action is never the default focus), else the first button.
5. Emit `ui.dialog {id, open:true, result:null}`. Resolution (button, Escape, backdrop
   pointerup when dismissible, `closeAllDialogs`) removes the layer, releases the trap, restores
   inertness (only the top screen interactive again unless another dialog remains), restores focus
   to `focusBefore` when connected, emits `ui.dialog {id, open:false, result}` and resolves.

`confirmUnsaved(describe, {canSave})` = `dialog({id:'DLG-UnsavedChanges', title: describe.title,
body: describe.body, consequence: text('dlg.unsaved.consequence', {count: describe.changeCount}),
buttons: [ {id:'cancel', label:'Keep editing', kind:'secondary', isCancel:true}, {id:'discard',
label:'Discard changes', kind:'danger'}, canSave ? {id:'save', label:'Save', kind:'primary',
isDefault:true} : null ].filter(Boolean)})`. Exact texts are Part 7.7.

6.26.4.7 Toasts

- Durations: `info` 3,000 ms, `success` 2,500 ms, `warn` 5,000 ms, `error` 7,000 ms; any toast
  with an action 8,000 ms; `opts.durationMs` overrides within 1,500-15,000 ms.
- Dedupe: a toast with the same `key` shown in the last 10,000 ms is dropped (counted in
  `counters().toastsDeduped`).
- At most 3 visible (newest at the bottom); further toasts queue (max 10; when full the oldest
  queued entry is dropped). When a visible toast expires the next queued one is shown.
- Each toast is `<div class="toast toast-<kind>" role="status">` with a kind glyph and text;
  `error` toasts use `role="alert"`. An action renders a button; activating it runs the action
  and closes the toast. Toasts never take focus. Reduced motion: no slide, opacity change only
  (CSS through `--t-base` = 0).
- Timers are created with `UI_OWNER` (toasts survive mode changes by design; `clearToasts()` is
  called only by tests and by `#fatal`).

6.26.4.8 Layout, safe areas, scale

- `measure()` runs at init, on `resize` (debounced 100 ms with `Core.timers`), on
  `orientationchange` (immediately and again after 300 ms because iOS reports the old size in the
  first event), and on `visualViewport.resize` when present.
- `orientation = innerWidth < innerHeight ? 'portrait' : 'landscape'`; `compact =
  min(innerWidth, innerHeight) < 600`; `widthClass = innerWidth < 720 ? 'narrow' : innerWidth <
  1200 ? 'medium' : 'wide'` (CSS px, before `--ui` scaling).
- Safe area: a hidden probe `<div class="safe-probe">` with `padding: var(--safe-top)
  var(--safe-right) var(--safe-bottom) var(--safe-left)`; `getComputedStyle` gives the four
  numbers in px.
- Classes: exactly one of `body.portrait`, `body.landscape`; `body.compact` toggled;
  `body.dataset.width = widthClass`.
- Emit `ui.layout` when any of orientation, width, height, dpr, compact or safe area changed.
- `setScale(s)`: `s = clamp(round(s / 0.05) * 0.05, 0.8, 1.5)`; on `compact` layouts the
  effective scale is capped at 1.3 (a 1.5 scale on a 360 px phone would push the four pads below
  the 56 px minimum width); `documentElement.style.setProperty('--ui', String(effective))`;
  then `measure()`. Returns the effective value; SCR-Settings shows "Limited to 1.3 on this
  screen size" when capped.
- `setReducedMotion(mode)`: `system` -> effective = `matchMedia('(prefers-reduced-motion:
  reduce)').matches` (a `change` listener on the media query list re-applies); `on` -> true;
  `off` -> false. Classes: `html.reduced-motion` when effective; `html.motion-full` when mode is
  `off`. Returns effective.
- `setHighContrast(on)`: toggles `html.high-contrast` (tokens of Part 3.2.2 do the rest).

6.26.4.9 Touch pads

Geometry (CSS px, computed in `layout()` from `Layout.snapshot()`):

```js
const minSide = {small: 56, medium: 72, large: 88}[spec.size];
const gap = 8;
const s = safeArea;
if (orientation === 'portrait' || spec.layout === 'bottom') {
  const bandH = Math.max(minSide, Math.round(height * (orientation === 'portrait' ? 0.28 : 0.24)));
  const usableW = width - s.left - s.right - gap * 5;
  const w = Math.max(minSide, Math.floor(usableW / 4));
  // row: x_i = s.left + gap + i * (w + gap); y = height - s.bottom - gap - (bandH - gap)
  rect_i = {x, y, w, h: bandH - gap};
} else {                                   // landscape + 'right': 2 x 2 grid in the right 24 percent
  const bandW = Math.max(minSide * 2 + gap * 3, Math.round(width * 0.24));
  const cell = Math.max(minSide, Math.floor((bandW - gap * 3) / 2));
  // grid order: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right, anchored bottom-right
}
```

- Dance pads (`kind:'dance'`) use the row layout in left, down, up, right order regardless of
  `spec.layout` in portrait; in landscape with `right` they form a cross-free 2 x 2 grid in the
  same order (left, down / up, right) so the order matches the highway columns.
- If `usableW / 4 < minSide` (very narrow screens) the pads keep `minSide` width and the gap
  drops to 4 px; if that still does not fit, `size` falls back one step and the HUD note shows
  `text('pads.shrunk')` once.
- Each pad: `<div class="pad pad-<i>" role="button" aria-label=labels[i]
  data-index=i>` containing the lane glyph `<svg class="glyph"><use href="#g-lane<i>">` (or
  `#g-left` etc. for dance) at 40 percent of the pad height and the lane color as background tint
  (`--lane-<i>` at `spec.opacity`). The glyph is mandatory (B 22 non-color identification).
- Pressed state: M-26 subscribes (owner `pads`) to `input.event`; for controls `lane0..3` (or
  `dance0..3`) it calls `setPressed(i, type === 'press')`, which toggles the class `pressed`
  (inverted contrast and a 2 px outline: shape change, not only color). Visual feedback happens
  in the same task as the event, before the next frame (P 5.1).
- Pointer handling itself belongs to M-07 (`Input.init({padRoot: #touch})`); M-26 only builds
  and positions the elements. `#touch` has `touch-action: none`; `contextmenu` on pads is
  prevented (long press on iOS and Android).
- `maxTouches < 4`: the HUD note `text('pads.fewTouches', {n})` is shown once per mode enter.

6.26.4.10 HUD, transport bar, text entry

HUD layout elements (built once at `init`, filled per `show(kind)`; ids `hud-*`): score,
combo, judgment word, accuracy, progress bar (`role="progressbar"` with `aria-valuenow` in
percent), section name, performers indicator (one dot plus label per slot: filled dot =
active, hollow = resting), beat indicator, sync badge (multiplayer), peer list (multiplayer),
HUD note line, pause button (`.hud-button`, always visible on touch devices, `aria-label`
"Pause"). Which elements show per kind:

| Element | instrument | dance | freeplay | studio | multiplayer | tutorial |
|---|---|---|---|---|---|---|
| score, combo, accuracy | yes | yes (dance styling `hud-dance`: centered combo, large step counter) | no | no | yes | yes |
| judgment word | yes | yes | no | no | yes | yes |
| progress bar | yes | yes | no | yes (song position) | yes | yes (step progress) |
| section name | yes | yes | no | yes | yes | no |
| performers indicator | yes | no | yes | yes | yes (one per player) | no |
| beat indicator | when `accessibility.flashOnBeat` | always | always | always | when set | always |
| sync badge, peers | no | no | no | no | yes | no |
| chord label, key, profile, octave, timing label | no | no | yes | no | no | no |
| life bar | no | when `gameplay.lifeBar` | no | no | no | no |
| count-in badge, step counter | count-in | count-in | count-in | count-in | count-in | both |
| pause button | touch | touch | touch | no (transport bar) | touch | touch |

- `set(fields)`: merges into `hud.fields`; if less than 33 ms since the last apply, schedules one
  trailing apply (`Core.timers.setTimeout(apply, 33 - elapsed, hud.owner)`); `apply` writes only
  changed strings with `textContent`. Formats: score `toLocaleString('en-US')` with thousands
  separators; combo `"<n>x"` hidden when `< 2`; accuracy `(100 * a).toFixed(2) + '%'`;
  progress width `(100 * p).toFixed(1) + '%'`.
- `flash(judgment, lanes, opts)`: sets the judgment word (`PERFECT`, `GREAT`, `GOOD`, `MISS`;
  `opts.stray` shows nothing unless `gameplay.strayPressPenalty`), the class `j-<judgment>`
  (color token plus a distinct glyph per judgment from Part 7.1: star, circle, dot, cross) and
  pulses the hit-line markers of `lanes` for 120 ms; reduced motion keeps the color and glyph
  change but drops the scale pop. Hidden when `gameplay.showJudgmentText` is false (glyph pulse
  remains). Screen reader: a separate visually-hidden `aria-live="polite"` region announces only
  section changes and combo milestones (every 25) when `accessibility.screenReaderLabels` is
  true; individual judgments are never announced (they would flood the reader).
- `TransportBar.create`: buttons from `['play','pause','stop','record','loop','metronome',
  'rewind']` with the matching glyphs; `update(view)` toggles `aria-pressed` and labels
  (Play/Pause swap), shows `bar.beat` as `"<bar+1>.<beat+1>"`, time `Core.formatTime(timeS)` /
  `formatTime(durationS)`, BPM to one decimal, a count-in badge `"Count-in <n>"`; all numbers
  use `.num` (tabular).
- Text-entry restriction: while `textEntryAllowed === false`, every `field` widget is set
  read-only with the hint `text('field.pauseToEdit')`, no field may receive focus (focus is
  redirected to the screen heading), and `Widgets.field` creation still works (fields appear
  read-only). M-28 sets it false on `transport.state` `countin`/`playing` in gameplay modes and
  true otherwise (B 6.4 minimal text entry during active gameplay).

6.26.4.11 Truncation

`truncate(str, max, {keepExt})`: `s = String(str)`; if `s.length <= max` return `s`; with
`keepExt` and a dot in the last 6 characters, `ext = s.slice(s.lastIndexOf('.'))`, return
`s.slice(0, max - 3 - ext.length) + '...' + ext`; else `s.slice(0, max - 3) + '...'`. `max` is
clamped to >= 8. Limits used by screens: track names 24 characters in mixer strips and pad
labels, 40 in lists, 60 in titles; song titles 40 in lists, 60 in headers; file names 40 with
`keepExt`; peer names 16. In every truncated place the full text is in `title` and
`aria-label`. CSS ellipsis (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) is
the second line of defense for proportional-width overflow.

6.26.4.12 Error presenter

`setPresenter(record => ...)`: for `class === 'recoverable'` and a non-empty `userMessage`, show
`toast(userMessage, {kind:'error', key: record.code, action})` where `action` is
`{label: record.context.actionLabel, onPress: record.context.onAction}` when the reporting
module put both into the context (for example M-27 passes `actionLabel:'Export'` and an
`onAction` that opens the export flow for `E-STO-001`), else no action. The function lives only
in the in-memory record; `Diagnostics.export()` serializes contexts without functions. `returnToMenu` and `reload` classes are ignored here
(M-28 and M-01 handle them).

#### 6.26.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Controller `mount` throws or rejects | try/catch in `push`/`replace` | previous stack unchanged | caller decides (M-28 leaves the mode) | no | M-28 reports E-MODE-002 and returns to the menu | none | old top screen stays focused | UT-26-03 |
| Controller `unmount` throws | try/catch | stack popped; owner listeners and timers removed anyway | n/a | no | log only (E-GEN-001) | none | next screen shown | UT-26-04 |
| `onBack` throws | try/catch | screen stays | user presses Back again | no | log | none | treated as 'handled' | UT-26-05 |
| `history.pushState` throws (file:// SecurityError) | try/catch | stack | no | no | none (log once W-UI-HISTORY) | in-app Back only | n/a | UT-26-06 |
| Fourth stacked dialog | count check | first three dialogs | n/a | no | log E-GEN-001 | n/a | caller's promise rejects | UT-26-10 |
| Widget handler throws | try/catch per handler | widget and screen | user retries | no | widget error state 2 s | none | idle state | UT-26-12 |
| Safe-area probe unsupported (`env()` absent) | computed padding NaN | zeros used | n/a | no | none | no inset | n/a | UT-26-16 |
| Touch pads do not fit at chosen size | geometry check | pads at smaller size | n/a | no | HUD note `pads.shrunk` | smaller pads | n/a | UT-26-18 |
| Unknown text id | lookup miss | id string shown | n/a | no | Log.once warn | id text | fix catalog | UT-26-23 |

#### 6.26.6 Limits and performance notes

- Screen depth: no hard limit; the deepest practical stack is 4 (MainMenu, Library,
  ImportInspect, Settings). Dialogs: 3. Toasts: 3 visible, 10 queued.
- HUD apply <= 0.5 ms per frame on desktop (a handful of `textContent` writes); HUD updates
  coalesced to <= 30 Hz; slider `onInput` <= 10 Hz; layout measurement <= 1 ms.
- No layout thrash: `measure()` reads all geometry first, then writes classes; pad rectangles
  are applied with `style.transform: translate(x, y)` plus width and height in one batch.
- Gamepad menu poll: 10 Hz only while a gamepad is connected and no HUD is shown.
- Every DOM listener goes through `Core.dom.on(el, type, fn, opts, owner)` so `assertClean`
  sees them (permanent UI listeners are part of the menu baseline).

#### 6.26.7 Spec coverage

B 6.3 (shared interface elements: mode, song, transport, master volume via TransportBar and
HUD, input status, loading, error notifications), B 6.4 (responsive layout, large targets,
safe areas, orientation, minimal text entry), B 8.2 (four large touch controls,
simultaneous presses supported by the pad DOM), B 21.1 (visible pressed states, no hover
reliance, orientation changes), B 22 (scalable UI, keyboard navigation, accessible labels,
non-color indications, reduced motion, high contrast), I 11.4 (loading and error states),
I 12 (configurable touch controls), I 15 (focus indicators, control sizes, consistent
accessibility settings), P 1 (consistent states), P 2.2 (no clipping, no horizontal scroll,
no layout jumps), P 2.3 (focus, pressed, disabled, loading states distinct), P 3 (back
navigation, focus restoration after dialogs, browser back and forward), P 5.1 (pressed and
released states), P 14 (touch target sizes and spacing, safe areas, UI scaling, controls
usable without a mouse), P 15 (keyboard focus visible, dialogs manage focus, disabled
controls explain why), P 21 (pressed feedback, units and precision, sliders by keyboard and
touch, long names, empty states, consequence text).

#### 6.26.8 Unit tests (group `ui`, file `src/91-test-ui.js`)

Setup common to all: a test container replaces `#overlay`, `#hud`, `#touch` children inside
the real page (the runner saves and restores them); the resolver is set to test controllers;
history integration off unless stated; layout tests set the container size through the
`UI.Layout._measureFrom({width, height, dpr, safeArea})` test hook (test build only).

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-26-01 | push and pop order | resolver with A, B, C; push A, B, C; pop twice | `ids()` is [A]; `ui.screen` events push x3 then pop x2 with correct depth; B and C `unmount` called once each |
| UT-26-02 | lower screens inert | push A then B | A root has `inert` and `aria-hidden="true"`; B has neither; after pop A has neither |
| UT-26-03 | failing mount keeps stack | B.mount throws | `push('B')` rejects with code E-MODE-002; `ids()` unchanged; no B section in DOM; `Core.dom.count()` unchanged |
| UT-26-04 | unmount throw still cleans | B registers a dom listener with ctx.owner and throws in unmount | after pop the listener count returns to baseline; E-GEN-001 recorded |
| UT-26-05 | back consults onBack | B.onBack returns 'handled' then 'pop' | first `back()` resolves 'handled' with depth 2; second resolves 'pop' with depth 1; at depth 1 `back()` resolves 'root' |
| UT-26-06 | history entries follow stack | history on; push A, B; pop; simulate popstate | `history.state.depth` is 2 after push B; pop increments ignorePops and the next onPopState is swallowed; a browser-back onPopState({depth:1}) at depth 2 calls back |
| UT-26-07 | forward is a no-op | history on; at depth 2 call onPopState({flm:1, depth:3}) | depth stays 2; `history.back` was called once (spy) |
| UT-26-08 | dialog focus trap and restore | focus a button in A; open dialog with 2 buttons; Tab x3, Shift+Tab | focus cycles within the dialog only; after resolve focus returns to the original button |
| UT-26-09 | dialog escape and danger default | dialog with danger + cancel | initial focus is the cancel button; Escape resolves 'cancel'; danger without consequence asserts |
| UT-26-10 | dialog stack limit | open 3 dialogs; open a 4th | 4th rejects E-GEN-001; `dialogCount()` 3; `closeAllDialogs('test')` returns 3 and each resolves 'dismissed' |
| UT-26-11 | toast queue, durations, dedupe | fake timers; 5 toasts, 2 with same key | 3 visible, 1 queued, 1 deduped; after 3,000 ms of fake time the queued one is visible; error toast lasts 7,000 ms |
| UT-26-12 | button states | onPress returns a pending promise; then a throwing handler | `data-state` loading and re-press ignored; resolve -> idle; throw -> error then idle after 2 s; E-GEN-001 with widget id |
| UT-26-13 | slider keyboard | slider 0..100 step 5 precision 0 unit '%' | ArrowRight -> 5 shown "5%"; PageUp -> 55; End -> 100; Home -> 0; onInput coalesced to <= 1 call per 100 ms with trailing value; onChange once per keyup |
| UT-26-14 | disabled reason | button with disabledReason | `aria-disabled="true"`, focusable, Enter shows a toast with the reason, onPress not called |
| UT-26-15 | roving tabindex list | list of 5, item 3 disabled | exactly one tabindex 0; ArrowDown moves through all 5 (wraps); Enter on item 3 does not call onPick |
| UT-26-16 | layout classes and event | `_measureFrom` 390x844 then 844x390 | body has portrait and compact then landscape; `ui.layout` emitted twice with orientation values; zero safe area when probe yields NaN |
| UT-26-17 | ui scale clamp and compact cap | setScale(1.47) on 1280x720; then on 390x844 | 1.45 applied; on compact effective 1.3; `--ui` style matches |
| UT-26-18 | pad geometry portrait | 390x844 medium | 4 rects, each >= 72 px tall and >= 56 px wide, gaps >= 8 px, band within bottom 28 percent plus safe bottom |
| UT-26-19 | pad geometry landscape right | 844x390 layout right size small | 2 x 2 grid inside the right 24 percent, every side >= 56 |
| UT-26-20 | pad pressed state from input | show pads; emit input.event press lane2 then release | pad 2 gets class pressed then loses it; other pads untouched |
| UT-26-21 | pad glyphs and labels | show lanes and dance | each pad contains `use` with href `#g-lane<i>` or the arrow ids and a non-empty aria-label |
| UT-26-22 | HUD per kind and coalescing | show('dance'); 10 set() calls within 10 ms | only dance elements visible; DOM written at most twice; final text equals the last values; accuracy "97.25%" |
| UT-26-23 | text catalog | text('pads.fewTouches', {n:2}); unknown id | substituted string; unknown returns id and logs once |
| UT-26-24 | text entry restriction | setTextEntryAllowed(false); field widget | input readOnly; focus() redirected; true restores |
| UT-26-25 | truncate rules | 'a'.repeat(50) max 20; 'my-very-long-song-name.mid' max 16 keepExt; max 4 | 17 a + '...' (20 chars); exactly 'my-very-l....mid'; max clamped to 8 |
| UT-26-26 | reduced motion and contrast classes | setReducedMotion('on'), ('off'), setHighContrast(true) | html classes reduced-motion; then motion-full without reduced-motion; high-contrast present |

#### 6.26.9 Implementation notes and browser quirks

- `inert` is supported in current Chromium, Firefox and Safari; where `'inert' in
  HTMLElement.prototype` is false, M-26 sets `aria-hidden="true"` and relies on the focus trap and
  a `focusin` redirect, which gives the same keyboard behavior.
- iOS Safari fires `orientationchange` before `innerWidth` changes; the 300 ms re-measure and
  `visualViewport.resize` cover it. Android Chrome changes `innerHeight` when the URL bar hides;
  the 100 ms debounce prevents pad jitter, and pads anchor to the bottom so the band follows.
- `:focus-visible` is not applied after programmatic `focus()` in some Safari versions; the
  `.focus-ring` class is the fallback.
- Synthesized `KeyboardEvent`s for gamepad navigation do not trigger native activation of
  buttons in every browser; M-26's own key handlers (Enter and Space on `button`, `list`,
  `toggle`) act on them, so navigation does not rely on default actions.
- Never use `innerHTML`, `insertAdjacentHTML` or `outerHTML` (build lint); `el()` sets
  attributes with `setAttribute` and refuses `on*` attribute names and `href`/`src` values that
  start with `javascript:` (`E-GEN-004` assertion).
- `history.pushState` with an unchanged URL is used deliberately (no hash routing), so a reload
  always boots at the main menu; the screen stack is not restored from history after a reload.
- Names follow Part 4.1 (`Core.dom`, `Core.timers`, `bus.removeOwner`).

### 6.27 M-27 Screens (`src/27-screens.js`, `FLM.Screens`)

#### 6.27.1 Responsibilities and non-goals

Responsibilities:

- One controller per `SCR-*` (18 screens) and one builder per `DLG-*` (the 11 dialogs of
  Part 7.7 plus `DLG-DeleteProject`, `DLG-ExportWav`, `DLG-ImportSettings`): what each reads,
  which modules it calls, which events it handles, how it leaves. Layouts, element ids,
  exact texts and per-state copy are Part 7.6 and 7.7; controllers build that DOM with
  `UI.el` and `UI.text`.
- The settings store `FLM.Screens.Settings` over `FLM.Storage.loadSettings` and `saveSettings`
  (key `flm.v1.settings`, owned by M-16; schema Part 5.11): normalize, debounce, get, set,
  reset, export, import, calibration view (6.27.4.2). M-16 persists and emits `settings.changed`.
- The tutorial state machine (I 11.3, seven steps; skippable, repeatable, keyboard and touch
  variants), the results screen content, the pause screen behavior.
- Global user-facing reactions to bus topics that are not owned by one screen: save failures
  (`project.saveFailed` -> DLG-SaveFailed), quota warnings, audio blocked or interrupted
  dialogs requested by M-28, returnToMenu notices.
- The key label function used by Help, Tutorial and Settings (`codeLabel`).

Non-goals: no mode lifecycle (M-28 enters and leaves modes, builds stages and judges); no
musical logic (M-08, M-09, M-17, M-23); no persistence other than the settings document (M-16
does projects); no DOM outside `#overlay` screens and dialogs (HUD and pads are M-26
components that M-28 shows).

#### 6.27.2 Public API

```js
FLM.Core.define('Screens', function (FLM) {
  return Object.freeze({
    SCREENS: ['SCR-FirstLaunch','SCR-MainMenu','SCR-QuickPlay','SCR-Instrument','SCR-FreePlay','SCR-Studio',
              'SCR-Library','SCR-ImportInspect','SCR-Dance','SCR-Multiplayer','SCR-Characters','SCR-Settings',
              'SCR-Help','SCR-About','SCR-Diagnostics','SCR-Tutorial','SCR-Results','SCR-Pause'],
    DIALOGS: ['DLG-UnsavedChanges','DLG-SaveFailed','DLG-ImportReplace','DLG-AudioBlocked','DLG-DeleteTrack',
              'DLG-Calibration','DLG-RemapConflict','DLG-ProjectTooLarge','DLG-Unsupported','DLG-NetError',
              'DLG-ResumeAudio','DLG-DeleteProject','DLG-ExportWav','DLG-ImportSettings'],

    /** Boot step B11: installs the resolver into UI.Screens.setResolver, subscribes the global
     *  reactions of 6.27.4.24 with owner SCREENS_OWNER. Idempotent. */
    register() {},
    /** Controller factory for a screen id (throws E-MODE-002 for unknown ids). */
    get(id) /* -> () => ScreenController */ {},
    /** Convenience: UI.Screens.push(id, params). */
    show(id, params) /* -> Promise<ScreenController> */ {},
    /** Open a dialog by id with params (6.27.5 builders). Resolves to the result id. */
    dialog(id, params) /* -> Promise<string> */ {},
    /** DLG-Unsupported variant "Returned to the menu" for returnToMenu error records (called by M-28). */
    showError(record /* ErrorRecord */) /* -> Promise<void> */ {},
    /** DLG-SaveFailed for a project.saveFailed payload. */
    showSaveFailed(payload) /* -> Promise<string> */ {},

    Settings: {
      DEFAULTS /* frozen 5.11 default document */, SCHEMA /* frozen {path: {type, min, max, step, values, comparable, immediate}} */,
      /** Boot step B6. Reads `Storage.loadSettings()` (M-16 falls back to the `.bak`), migrates, normalizes.
       *  @returns {{doc:object, source:'stored'|'backup'|'defaults', warnings:string[]}}
       *  M-16 emits settings.changed {key:'*', source:'load', keys}. Never throws. */
      load() {},
      get(path /* 'audio.masterVolume' */) /* -> value (copy for objects) */ {},
      all() /* -> deep copy of the document */ {},
      /** Validates and normalizes; persists through `Storage.saveSettings` (debounced 250 ms, immediate for
       *  onboarding.*, input.keys.* and calibration.*), which emits settings.changed {key, value, prev, source}.
       *  @returns {{ok:boolean, value:any, error:string|null}} */
      set(path, value, source /* 'ui'|'wizard'|'url'|'load'|'reset' */) {},
      setMany(patch /* {path: value} */, source) /* -> {ok, errors:string[]} one event per key */ {},
      reset(group /* ?'audio'|'input'|... */) /* -> void; emits '*' with source 'reset' */ {},
      calibration() /* -> Calibration {inputOffsetMs, audioLatencyMs, visualLeadMs} */ {},
      /** true when the gameplay settings keep results comparable (5.11 Comparable column). */
      comparable() /* -> boolean */ {},
      flush() /* -> Promise<{ok:boolean}> Storage.flushSettings(): write pending changes now (pagehide, tests) */ {},
      export() /* -> string .flmsettings.json text */ {},
      /** Parses and validates; does not apply. @returns {{ok, doc, changes:[{path, from, to}], error}} */
      parseImport(text) {},
      applyImport(doc) /* -> void (source 'load') */ {}
    },

    Tutorial: {
      STEPS /* frozen [{id, index, kind}] from Content.TUTORIAL */,
      start(fromStep /* ?int 1..7 */) /* -> void (called by SCR-Tutorial mount) */ {},
      step() /* -> int 1..7 or 0 */ {},
      skip() /* -> void: current step counts as skipped, go to next */ {},
      repeat() /* -> void: restart current step */ {},
      exit() /* -> Promise<void>: leave tutorial to menu */ {},
      state() /* -> TutorialState copy */ {},
      /** Pure transition function used by the controller and by tests. */
      transition(state, event /* {type, ...} */) /* -> TutorialState */ {}
    },

    /** 'KeyA' -> 'A', 'Digit1' -> '1', 'ArrowLeft' -> 'Left', 'ShiftLeft' -> 'Left Shift',
     *  'Escape' -> 'Esc', 'Space' -> 'Space', 'Semicolon' -> ';', unknown -> the code itself. */
    codeLabel(code) /* -> string */ {},
    /** Lane or direction words for touch instructions: ['circle','triangle','square','diamond']
     *  or ['left','down','up','right']. */
    padWords(kind /* 'lanes'|'dance' */) /* -> string[4] */ {},
    counters() /* -> {globalListeners, activeController:string|null} */ {}
  });
});
```

Events emitted: none (`settings.changed` is emitted by M-16 `Storage.saveSettings` and `loadSettings`, Part 4.4). All effects are calls into lower modules. Events consumed (global,
owner `SCREENS_OWNER`): `error`, `project.saveFailed`, `storage.quota`, `storage.state`, `audio.state`, `progress.unlock`. Per screen (owner =
screen owner, removed on unmount): listed in each controller below.

TutorialState:

```js
TutorialState { phase:'idle'|'instruct'|'active'|'success'|'retry'|'done'|'exited',
                index:int 0..7, passes:int, results:{hits:int, misses:int, chords:int, accuracy:number},
                skipped:int[], completed:int[], variant:'keyboard'|'touch' }
```

#### 6.27.3 Internal state

- `controllers: Map<screenId, factory>`; `dialogBuilders: Map<dialogId, (params) => DialogSpec>`.
- `settings: {doc, pendingWrite:timer|null, warningsLogged:Set}`; `SCHEMA` is derived once at
  load from the 5.11 table (type, range, step, enum values, Comparable flag, immediate flag).
- `tutorial: TutorialState`.
- `saveFailStreak: {projectId: count}` for checkpoint failures (6.27.4.24).
- Per controller instance: its DOM references, widget handles and the `ctx.owner` token from
  M-26; nothing survives unmount except values the controller wrote to settings.

Invariants: `settings.doc` always validates against `SCHEMA` (every write passes
normalization); `Tutorial.state().index === 0` iff `phase` is `idle`, `done` or `exited`;
controllers never keep references to other controllers.

#### 6.27.4 Algorithms

Each controller section lists: Reads (data sources), Calls (lower-module API), Handles (bus
topics and input), Leaves (how the screen or mode ends). "Owner" means the screen owner
token; every subscription and DOM listener of a controller uses it, so `unmount` needs no
manual cleanup beyond widgets (`widget.destroy()`). Lower-module names follow Part 4.1.

6.27.4.1 Shared rules for all controllers

1. `mount` builds DOM synchronously, then starts async loads (lists, previews) and shows
   the `loading` state for any panel whose data is not ready within 150 ms (P 21 "loading
   indicators appear only when useful"); loading never shows a percentage unless the source
   reports one (`import.progress.fraction`).
2. Every async action button returns its Promise to M-26 so the button shows `loading`, and
   reports success with a toast (`kind:'success'`) only after the operation resolved
   successfully (B 26.5 no false success, P 21 "clear feedback when an operation is
   complete").
3. Unavailable actions are rendered with `disabledReason` (never hidden) using the reasons of
   the Part 4.3 capability gate table.
4. Screens that change settings call `Settings.set(path, value, 'ui')` and nothing else; the
   effect reaches modules through `settings.changed`.
5. A gameplay screen's `onBack` returns `'handled'` after calling `Modes.pause('user')`
   (browser Back and Escape pause instead of leaving; I 12 protection against accidental
   navigation). Panel screens return `'pop'` unless a guard applies.
6. Text is inserted with `textContent` only; imported names pass through `UI.truncate`
   with the limits of 6.26.4.11.

6.27.4.2 Settings store

```js
function normalize(doc) {                 // deep-merge over DEFAULTS, clamp, enum check (5.11 rules)
  const out = deepClone(DEFAULTS), warnings = [];
  for (const path of Object.keys(SCHEMA)) {
    const raw = getPath(doc, path);
    if (raw === undefined) continue;
    const r = coerce(SCHEMA[path], raw);  // number: finite -> clamp + step snap; int: Math.round;
                                          // enum: member else default; string[]: length and
                                          // distinctness; bool: === true/false else default
    if (!r.ok) warnings.push(path);
    setPath(out, path, r.value);
  }
  out.x = collectUnknown(doc, SCHEMA);    // unknown keys preserved under x (5.11)
  return {doc: out, warnings};
}
```

- `load()`: `text = Storage.loadSettings()` (M-16 reads `flm.v1.settings` and falls back to the `.bak`:
  source `backup`, toast `text('settings.reset')` only when both were damaged);
  `version > 1` -> keep defaults in memory, warn `W-SET-NEWER`, and do not write until the
  user changes a setting (5.17); `version < 1` impossible in v1. Normalize; if any warning,
  `Log.once('W-SET-NORMALIZED', ...)`. Store `settings.doc`; M-16 emits `settings.changed {key:'*',
  value:null, prev:null, source:'load', keys:[all paths]}` from `loadSettings`.
- `set(path, value, source)`: unknown path -> `{ok:false, error:'unknown setting'}`; coerce;
  if the normalized value deep-equals the current one return `{ok:true}` without an event;
  else write into `doc` and call `Storage.saveSettings(doc, {key:path, value, prev, source}, {debounceMs})`:
  M-16 emits `settings.changed {key:path, value, prev, source}` at once and persists the document,
  immediately when `SCHEMA[path].immediate` (paths `onboarding.*`, `input.keys.*`,
  `calibration.*`, `debounceMs` 0), else debounced 250 ms. On `{ok:false}` toast
  `text('settings.saveFailed')` once per session (settings stay in memory).
- Special cases: `video.highContrast === true` forces `accessibility.laneGlyphs = true`
  (second event); `input.keys.*` writes call `Input.setMap(mapsFromSettings(doc))`;
  `net.relayUrl` validates `^wss?://` and length <= 200.
- `calibration()` returns the three `calibration.*` values; `comparable()` returns
  `doc.gameplay.judgmentPreset === 'standard'` (speed comparability is decided per play by M-28,
  5.11 note).
- `export()`: `JSON.stringify({format:'flm-settings', version:1, exportedAt: ISO, appVersion:
  FLM.VERSION, settings: doc}, null, 1)`; `parseImport` checks `format`, `version` (newer ->
  error `text('settings.importNewer')`), normalizes and lists the changed paths for
  DLG-ImportSettings; `applyImport` calls `setMany` with source `'load'`.

6.27.4.3 SCR-FirstLaunch (mode `menu`; B 6.1)

Seven steps rendered as one screen with an internal step index `s` (1..7); "Back" and
`Escape` go to `s - 1` (`onBack` returns `'handled'` while `s > 1`).

| Step | Shows | Action |
|---|---|---|
| 1 identity | game title, one-line tagline, version | "Continue" -> step 2 |
| 2 capability check | `Boot.GATE` results: each soft-degraded capability with its reason text; "Everything needed is available" when none | "Continue" |
| 3 audio activation | `text('first.audio')`; button "Start sound" | the click handler calls `Audio.unlock()` synchronously inside the gesture; resolves -> step 4; failure after 1,000 ms -> inline error with "Try again" (no dialog) and "Continue without sound for now" (allowed; gameplay entries will ask again through DLG-AudioBlocked) |
| 4 rendering | `Render.tier()` and its description; select of tiers (`auto`, High, Balanced, Low, Abstract) | writes `video.tier`; "Continue" |
| 5 input | detected input: touch when `Caps.maxTouchPoints > 0`, else keyboard; choice "Keyboard and mouse" or "Touch" (`onboarding.inputMode`); shows the default lane keys or the pad glyphs | "Continue" |
| 6 choose a mode | tiles: "Play a demo song" (Quick Play defaults), "Learn the controls" (tutorial), "Go to the main menu" | sets `onboarding.firstLaunchDone = true` (immediate write) then: demo -> `Modes.enter('quickplay', defaults)`; tutorial -> `Modes.enter('tutorial')`; menu -> `UI.Screens.replace('SCR-MainMenu')` |
| 7 unavailable features | not a separate page: every disabled feature found in step 2 is listed again under the tiles of step 6 with its reason (B 6.1 step 7), never blocking | none |

Reads: `Caps`, `Boot.GATE` results, `Render.tier()`, settings. Calls: `Audio.unlock`,
`Settings.set`, `Modes.enter`. Handles: `audio.unlocked` (advance from step 3 if the unlock
happened through another path). Leaves: step 6 choices; there is no way to reach the menu
without setting `firstLaunchDone` except closing the page (the next boot shows the flow
again, which is the intended returning-user rule: only completed onboarding is skipped, P 4).

6.27.4.4 SCR-MainMenu (mode `menu`, stack root)

Entries in the fixed order of BRIEF 7, each a `list` item (role `menu`):

| Entry | Action on activation | Disabled when (reason text) |
|---|---|---|
| Quick Play | `UI.Screens.push('SCR-QuickPlay', {phase:'select'})` | Catalog empty ("No built-in songs were loaded") |
| Instrument Mode | `push('SCR-Instrument', {phase:'select'})` | Catalog empty (same) |
| Free Play | `Modes.enter('freeplay')` | never |
| Studio | `Modes.enter('studio', {projectId: Settings.get('session.lastProjectId')})` | never (storage limits are shown inside) |
| Song Library | `Modes.enter('library')` | never |
| Import Music | synchronously `const files = Storage.pickFile({accept: Import.COMPATIBILITY.accept, multiple:false})` inside the gesture, then `Modes.enter('import', {files})` | never |
| Dance Mode | `push('SCR-Dance', {phase:'select'})` | Catalog empty |
| Multiplayer | `Modes.enter('multiplayer')` | no `RTCPeerConnection` and no relay URL ("This browser has no WebRTC support.") |
| Characters | `Modes.enter('customize')` | never (Abstract tier shows a 2D preview) |
| Settings | `Modes.enter('settings')` | never |
| Help and Controls | `Modes.enter('help')` | never |
| About | `Modes.enter('about')` | never |

Cards above the list (each optional, at most two visible, in this priority):

1. Recovery: when `Storage.get('recovery')` holds a project written by the reload class
   (Part 4.9), or `Project.Autosave.findRecoverable(lastProjectId, savedModifiedAt)` resolves a
   checkpoint newer than the saved project: "Recover unsaved project?" with "Recover" (opens
   Studio with the recovered project, marked dirty) and "Discard" (deletes the recovery key or
   ignores the checkpoint until the next autosave; consequence text names the project).
2. Audio banner: while `Audio.isUnlocked()` is false: "Tap or press a key to enable sound"
   (M-29 installs the one-shot gesture listener; the banner hides on `audio.unlocked`).
3. Storage notice: `Storage.state().notice` when non-null.
4. Continue: `flm.v1.lastSession` within the last 7 days: "Continue: <mode> - <song or
   project name>" re-enters that mode with the same song or project.

Also: the `TEST BUILD` badge when `FLM.SelfTest` exists; the highlighted entry is
`onboarding.lastMode` (focus starts there; P 21 "does not unexpectedly reset"). Handles:
`audio.unlocked`, `storage.state`, `progress.unlock` (no UI here; toasts are global).
Leaves: never (root); `onBack` returns `'pop'` and M-26 answers `'root'`.

6.27.4.5 SCR-QuickPlay (select phase in mode `menu`; play phase in mode `quickplay`)

Select phase. Reads: `Project.Catalog.list()` (built-in first, then songs registered in this
session from imports), `Settings.get('session.quickPlay')`. Controls: song list; instrument
choice = the song's tracks (name, GM family icon, "drums" badge) plus a "Dance" choice;
difficulty (`beginner..expert`, or `easy, normal, hard` when Dance is chosen); control
layout = profile `A` default (`F` for drum tracks; B-E available under "More layouts");
backing tracks toggle (on -> `targetTrackMode:'lower'`, off -> `'mute'` with all other tracks
silent: `accompanimentVolume: 0`); visualization (`full` or `minimal`); a link "Audio and
input settings" -> `push('SCR-Settings', {variant:'contextual'})`. Defaults: the stored
selection when its song still exists, else `demo-poprock`, track Keys, `beginner`, profile
`A`, backing on, visualization full (Part 1.7). Play (primary, `Enter`): `Settings.set(
'session.quickPlay', selection)`; `Modes.enter('quickplay', {songId, trackId|null, kind:
'instrument'|'dance', difficulty, profile, targetTrackMode, accompanimentVolume,
visualization, returnTo:'SCR-QuickPlay'})`.

Play phase (mounted by M-28 with `replace`). Reads: `params`. Handles: `judge.result`
(-> `UI.HUD.flash`), `score.update` (-> `HUD.set` score, combo, accuracy, progress from
`completion`), `sched.marker` (-> section name), `input.event` control `pause` press (->
`Modes.pause('user')`), `transport.state` (count-in badge). Leaves: M-28 enters `results` on
finish; SCR-Pause "Quit" -> `Modes.leave('user')`.

6.27.4.6 SCR-Instrument (select in `menu`; play in `instrument`; I 6.3 practice tools)

Select phase. Reads: Catalog entry or `params.report` (from SCR-ImportInspect) for the track
rows; `Mapping.ChartGenerator.simplificationReport(song, trackId, profile)` for the
"needs simplification" badges per difficulty. Controls: song, track ("Which track will be
playable"), target instrument (the chart's sound: track program by default; any GM program),
difficulty (four names plus "Auto": the lowest difficulty whose report says no
simplification is needed, else `advanced`), profile A-F with a one-line description from
`Mapping.profileTable`, practice panel: speed slider 0.50x-1.50x step 0.05 (`speed != 1.0`
shows "Results at this speed are practice only" because they are `comparable:false`),
"Speed up after each clean loop" toggle (+0.05 per loop pass with accuracy >= 0.9, up to
1.00x), loop section (from `Model.sections(song)`; "Whole song" default), start at
section, target track mode `mute`/`lower`/`full`, accompaniment volume 0-100 percent, solo a
track (sets one accompaniment strip solo), one hand (keys tracks only: "Left hand" chart
from notes < 60 or "Right hand" from notes >= 60, passed as generator option `pitchFilter`).
Play: `Modes.enter('instrument', {...selection, returnTo:'SCR-Instrument'})`.

Play phase: as SCR-QuickPlay play phase plus: practice changes from SCR-Pause apply through
`Modes.restart({...})`. Handles additionally `transport.loop` to show the loop pass counter
and the per-pass accuracy that M-28 reports in `Modes.gameplayState().passes` (the per-pass
judging and the speed-up rule are M-28's, 6.28.4.6).

6.27.4.7 SCR-FreePlay (mode `freeplay`; B 7.3)

Reads: `Settings.get('session.freePlay')`; `Instruments` program list (`Theory.gmProgramName`,
`Theory.gmFamilies`); `Theory.scales()`. Controls: instrument select (128 programs grouped
by family plus "Drum kit"), key (12 tonics with spelling by `Theory.keyName`), scale
(every `Theory.scales()` entry plus "Chromatic" and "Custom..." which opens a 12-toggle
editor calling `Theory.defineScale('custom:<steps>', ...)`), octave 2-6 (also `KeyQ`/`KeyE`),
register -12..+12 semitones, profile A-F (also `Digit1-6`), note length "Hold" or fixed 50-2,000
ms, velocity 1-127, sustain toggle (also `ShiftLeft` hold), quantize toggle with grid (1/4,
1/8, 1/16) and the visible mode label "Quantized to 1/8" or "Free timing" (B 7.3 distinction),
metronome toggle, tempo 20-300 BPM, count-in 1 or 2 bars, Record, Stop, Replay, "Open in
Studio".

Calls: M-28 entered the mode with a tempo-only song (one empty track `fp` with the chosen
program) and bound the Scheduler; the controller owns a `LiveMapper`:
`mapper = Mapping.createLive(ctxFromSettings())`; on each `input.event` (owner) for live
controls: `actions = mapper.handle(evt)`; for each action: `noteOn`/`noteOff`/`cc` ->
`Mapping.dispatch(action, 'fp')`; `profile` and `octave` -> update the controls and
`Settings.set('session.freePlay', ...)`; `label` -> `HUD.set({chord: label})`. Every control
change calls the matching `mapper.set*` and persists `session.freePlay` (debounced by the
settings store). Instrument change while notes sound: `mapper.releaseAll(now)` first (E 2.3,
P 9 "instrument changes do not leave notes stuck").

Recording (free-play take, not a Studio take): Record -> `Transport.main.record({countInBars})`
(the tempo-only song); while `recording`, every `noteOn`/`noteOff` action with a non-null
`tick` is collected into `take` as NoteEvents (`tick` is the quantized tick when quantize is
on, else `rawTick`); Stop -> `Transport.main.stop()`, open notes are closed at the stop tick;
Replay -> builds `replaySong` = the tempo-only song plus a locked track with the take events,
`Transport.main.load(replaySong)` and `play()`; "Open in Studio" -> `p = Project.create({name:
'Free Play ' + date, tempoBpm, timeSig, key, scale})`, push `Commands.addTrack` and
`Commands.addEvents(take)` through a new UndoStack, `Project.setCurrent(p)`, `Modes.enter(
'studio', {project:p})`. Leaving with an unsaved take: `onBack` -> `UI.confirmUnsaved({title:
'Keep your Free Play take?', ...}, {canSave:true})` where Save means "Open in Studio".

Handles: `input.event`, `transport.state`, `sched.beat` (metronome indicator), `audio.panic`
(mapper `releaseAll`). Leaves: Back (guarded as above) -> `Modes.leave('user')`.

6.27.4.8 SCR-Studio (mode `studio`; B 7.4, B 16, I 5)

M-28 opened the session (`Studio.Session.open(project)`); the controller is a view over `FLM.Studio`.

| Panel | Reads | Calls | Handles |
|---|---|---|---|
| Arrangement overview | `Studio.Session.overview()` | click -> `Transport.main.seek(tick)`; drag range -> `Studio.Session.setLoop(a, b)`; marker click -> `Studio.Session.playSection(i, {loop:false})` | `project.changed` (rebuild), playhead from the 10 Hz view timer |
| Track list | `Studio.Session.mixerState()`, project tracks | `addTrack`, `renameTrack` (field, commit on Enter), `duplicateTrack`, `reorderTrack` (drag or Alt+ArrowUp/Down), `deleteTrack` (after DLG-DeleteTrack), `setInstrument` (program select), `selectTrack` | `project.changed`, `studio.recording` |
| Piano roll | `Studio.Session.pianoRollData(trackId, range)` | `select`, `move`, `resize`, `remove`, `setVelocity`, `copy`, `cut`, `paste`, `quantize`, `setGrid`; locked tracks show "Imported track: edits create an editable copy" and the first edit calls `Studio.Session.ensureEditable` | `studio.selection`, `project.changed` |
| Mixer | `Studio.Session.mixerState()` | sliders -> `Studio.setMix(trackId, {...})` (coalesced 10 Hz by the slider), mute/solo toggles, master -> `Studio.Session.setMaster` | `audio.peak` (meters, clip indicator held 1 s) |
| Transport | `Transport.main` state | TransportBar actions: play/pause/stop -> `Transport.main.play/pause/stop`; record -> `Studio.Recorder.arm(currentTrackId, {countInBars, overdub:true, loop:loopEnabled})` then `start()`; loop toggle; metronome -> `Studio.Session.setMetronome`; tempo/meter/key fields -> `Studio.Session.setTempo/setMeter/setKeyScale` | `transport.state`, `transport.loop`, `studio.recording` |
| Markers | `Studio.Session.sections()` | add at playhead (label field), rename, remove, move | `project.changed` |

Shortcuts (screen `keys`; inactive while a text field has focus; chosen so that none collides
with the lane keys `KeyA KeyS KeyK KeyL`, the octave keys `KeyQ KeyE`, `Digit1-6` or Shift):
`Space` play/stop (DAW style: stop returns to the play start; while the transport is paused
from the transport bar, `Space` is the M-07 panic control instead), `KeyR` record, `KeyO` loop
toggle, `KeyM` metronome, `KeyG` quantize the selection with the current grid,
`Delete`/`Backspace` delete selection, `Ctrl+KeyZ` undo, `Ctrl+Shift+KeyZ` and `Ctrl+KeyY` redo,
`Ctrl+KeyC`/`Ctrl+KeyX`/`Ctrl+KeyV` copy, cut, paste at the playhead, `Ctrl+KeyS` save. Lane keys play
the selected track's instrument through a `LiveMapper` (profile from settings) when not
recording; while recording, `Studio.Recorder` consumes `input.event` itself.

Save: `Storage.saveProject(project)` -> `{ok:true}` toast "Saved" and `Settings.set(
'session.lastProjectId', id)`; `{ok:false}` -> nothing here (the global `project.saveFailed`
reaction opens DLG-SaveFailed). Export menu: MIDI (`Midi.write(song, {tempoOverride})` ->
`Storage.download(name + '.mid', bytes, 'audio/midi')`, showing the export notes of
5.14.1 first in a one-time confirm), Project (`Project.serialize` -> `.flm.json`), Audio mix
(DLG-ExportWav), Dance chart (when the project has one). Read-only (lock held elsewhere):
banner "Another tab has this project open. Studio opens read-only."; edit controls disabled
with that reason.

Leaves (`onBack`): if `Studio.Recorder.state()` is `recording` -> `await Recorder.stop()` (take
kept) first; then if `Project.isDirty(project)`: `UI.confirmUnsaved(Project.guard.describe(
project), {canSave:true})` -> `save` -> save, and leave only when it resolved ok; `discard` ->
leave (the in-memory project is dropped by `Project.setCurrent(null)`; the last checkpoint
stays recoverable from the main menu); `cancel` -> stay. Leave = `Modes.leave('user')`.

6.27.4.9 SCR-Library (mode `library`)

Reads: `Storage.listProjects()`, `Project.Catalog.list()`, `Settings.get(
'session.libraryFilter')`, `Storage.state()`, last `storage.quota`. Shows two tabs:
"Projects" and "Songs" (built-in and session imports, with the notice "Built-in songs are
original demo arrangements"). Filter field (query, case-insensitive substring of name) and
sort (`recent` or `name`); the filter and the scroll offset are restored on mount and saved
on unmount (P 21). Actions per project: Open (`Modes.enter('studio', {projectId})`), Play
(`push('SCR-Instrument', {phase:'select', songId})` after `Project.Catalog.register` of the
project song), Rename (field -> `Storage.renameProject`), Export (`.flm.json`), Delete
(DLG-DeleteProject -> `Storage.deleteProject`). Per song: Play (SCR-Instrument select),
Preview (plays 15 s from the second section through `Modes.preview(songId)`, see 6.28.4.8),
Open in Studio (`Project.fromSong(Catalog.getSong(id))`, guarded by DLG-ImportReplace when
the current project is dirty). Toolbar: "Import file" (as the main menu entry) and "Open
project file" (`Storage.pickFile({accept:['.flm.json','.json']})` -> `Storage.readFile` ->
`Project.deserialize(text)` -> errors shown inline with the `E-PRJ-*` text; ok -> DLG-ImportReplace
when a project with the same id exists in storage -> `Storage.saveProject` -> list
refresh). Space line: used/estimated bytes. Empty states: "No saved projects yet. Create one
in Studio or import a song." Handles: `storage.quota`, `project.saved`. Leaves: Back ->
`Modes.leave('user')`.

6.27.4.10 SCR-ImportInspect (mode `import`; I 6.1, I 6.2, B 7.5)

`mount(params)`: `files = await params.files` (empty array -> `Modes.leave('user')` silently: the
user cancelled the picker). One file is imported at a time: `Import.importFile(files[0])`.

States: `loading` (stage list validate, identify, parse, normalize, inspect, chart with the
current stage highlighted; a progress bar only when `fraction !== null`; a Cancel button ->
`Import.cancel()`), `error`, `ready`.

Ready state shows every I 6.1 field from the `InspectionReport`:

| I 6.1 item | Report source |
|---|---|
| detected format and version | `format`, `version`, `container`, compatibility `status` badge (Supported, Partial, Conversion) with text label |
| tracks and instrument assignments | `tracks[]` rows: name, program name, channel (1-based for display), drums badge, notes, pitch range names, max chord |
| song duration and tempo information | `duration.formatted`, `tempo.bpmStart`, min/max, `changes`, source ("from file" or "default 120 BPM, not in file") |
| time and key signatures | `meters[]`, `keys[]` with bars and their `*Source` |
| track event counts | `eventCount` and `noteCount` per row, totals |
| unsupported features and conversion warnings | `warnings` grouped by severity with counts; `warningsDropped` line when > 0 |
| which track will be playable | radio column; default `recommendedTrackId`; unplayable rows disabled with reason (`unplayableReason` for the whole file) |
| whether a simplified four-button mapping is needed | `chordComplexity.perDifficulty` badges per difficulty: "Simplified" or "Full" |

Chart preview and mapping change (I 6.2): difficulty and profile selects; on change
(debounced 150 ms) `chart = Mapping.ChartGenerator.generate(report.song, trackId, difficulty,
profile)`, `rows = ChartGenerator.preview(chart, report.song, fromBar, 8)` drawn on a
`<canvas class="chart-preview">` 2D context: four columns with lane colors and glyphs,
holds as bars, bar lines, 8 bars visible, scroll buttons by 8 bars; `ChartGenerator.describe(
chart)` as the summary line ("61 of 473 source notes not charted"). The source arrangement
text "The original arrangement is kept; this only changes the playable chart" is always
shown. Audio preview: Play/Stop -> `Modes.preview(report.song)`. Overflow tracks (> 32): a
checklist limited to 32 -> `Import.applyTrackSelection(report, ids)` and re-render.

Actions: "Play this track" -> `Project.Catalog.register({id: report.song.id, kind:'imported',
title, song: report.song})`, `Modes.enter('instrument', {songId, trackId, difficulty, profile,
returnTo:'SCR-Library'})`; "Open in Studio" -> if `Project.current()` is dirty ->
DLG-ImportReplace ("Replace" saves nothing and continues, "Save first" runs
`Storage.saveProject` then continues, "Cancel"); then `p = Project.fromSong(report.song)`,
`Project.setCurrent(p)`, `Modes.enter('studio', {project:p})`; "Import another file" (picker,
in the gesture); "Back". Import never touches the current project before one of these
confirmed actions (S-12).

Error state (`import.failed` or rejection): title `text('import.failedTitle')`, the error
message for the code (Part 7.11), the file name, and actions "Choose another file" and
"Back". A file identified as Unsupported (GP6/GP7 `.gpx`/`.gp`, unknown) opens DLG-Unsupported
with the format-specific text and stays in the error state underneath.

Handles: `import.progress`, `import.done`, `import.failed`. Leaves: Back -> `Modes.leave(
'user')` (an import in progress is cancelled first).

6.27.4.11 SCR-Dance (select in `menu`; play in `dance`; B 7.6, I 7)

Select phase. Reads: Catalog, `Settings.get('session.dance')`, IndexedDB `charts` store
(imported custom charts for the song, through `Storage.idb`... via `FLM.Dance` import helpers).
Controls: song, difficulty easy/normal/hard, layout arrows/pads (`DanceChart.layout`), practice
speed 0.50-1.00 step 0.05, loop section, life bar toggle (`gameplay.lifeBar`), alternate keys
info (`ArrowLeft..ArrowRight` and `KeyD KeyF KeyJ KeyK` labels from the current map), custom
chart: "Import chart" (`.flmdance.json` -> `Dance.importChart(text, song)`; validation errors
listed before gameplay, P 12 "chart errors are detected before gameplay"; a song mismatch shows
the 5.14.2 notice) and "Export chart" (`Dance.exportChart(chart, song)` -> download). Play:
`Settings.set('session.dance', ...)`, `Modes.enter('dance', {songId, difficulty, layout,
speed, loop, lifeBar, chart: importedChart|null, returnTo:'SCR-Dance'})`.

Play phase: dance HUD (`UI.HUD.show('dance')`, set by M-28) and dance pads; handles
`judge.result`, `score.update`, `input.event` pause; the life bar (when on) is drawn from
`DanceJudge.state().life` and reaching 0 ends the song with `endedBy:'fail'` (6.28.4.5).

6.27.4.12 SCR-Multiplayer (mode `multiplayer`; B 7.7, B 17, I 10)

Internal view state follows `net.state`:

| `net.state` | View | Actions |
|---|---|---|
| `idle` | privacy statement (`Net.PRIVACY_TEXT`, always visible here, B 23.2), display name field (`net.displayName`), "Host a room", "Join a room", STUN toggle with the note "Uses a public Google STUN server; off by default" (`net.stunEnabled`), relay URL line when set | Host -> `Net.createRoom({stun, relayUrl})`; Join -> view `join` |
| `creating`, `inviting` | spinner, then the invite code in a selectable `.code` box with "Copy" (clipboard, textarea fallback), and a field "Paste the answer code" | paste + "Connect" -> `Net.acceptAnswer(code)`; invalid code -> inline error `text('net.badCode')` |
| (join view) | field "Paste the invite code" | "Create answer" -> `Net.joinWithInvite(code)` -> answer code box with Copy and "Waiting for the host" |
| `connecting` | spinner with elapsed seconds; Cancel -> `Net.close('user')` | none |
| `lobby` | player list from `net.peer` (name, avatar color, instrument or track, ready, latency); host-only song and chart selection (Catalog built-in songs and songs shared by `sourceHash`), mode `sync` (same chart, competitive) or `coop` (each player picks a track; one track per player); ready toggle; sync diagnostics panel: per peer `rttMs`, `offsetMs`, `jitterMs`, quality badge text Good/Fair/Poor, missed updates from `Net.diagnostics()` | host: "Start" enabled when all players are ready and hashes match -> `Net.broadcast('start', ...)` via the Net API; guest: ready toggle -> `Net.send('ready', ...)` |
| `countdown` | 3-2-1 from `tStartShared`; M-28 has started gameplay (`Modes.startGameplay`) on the start message | none |
| `playing` | gameplay HUD with peers (`HUD.show('multiplayer')`), sync badge | pause request -> `Net.send('pause')` (host applies) |
| `results` | handled by SCR-Results (M-28 enters `results` with the connection kept) | "Back to lobby" there |
| `reconnecting` | banner "Reconnecting... (<s> s left of 60)" with a fresh code exchange area | as `inviting`/join |
| `ended`, `error` | DLG-NetError with the reason | OK -> `Modes.leave('net')` |

Handles: `net.state`, `net.peer`, `net.sync`, `character.changed` (own avatar), `judge.result`,
`score.update` (own), plus the host `scoreUpdate` data delivered by `Net` callbacks for the peer
list. Leaves: "Leave room" (confirm when a song is playing) -> `Modes.leave('user')`, which
closes the connection (4.7.2 step 12).

6.27.4.13 SCR-Characters (mode `customize`; B 13, I 8)

Reads: roster = `Project.current()?.characters` when a project is current, else the user
roster `Storage.get('characters')` merged with `Character.PRESETS`; `Character.OPTIONS`,
`Character.CATEGORIES`; `Progress.isUnlocked(id)` for cosmetic options and stage themes.
Layout: performer tabs (slots 0-4), category tabs, option controls (style selects, color
swatches from `params.palette`, height slider 0.90-1.10 step 0.01, accessory toggles with
`excludes`), preset picker, Randomize, name field, instrument assignment (tracks of the current
project or "None"), stage slot, animation style, stage theme tab (`video.stageTheme`).

Every change: `cfg2 = Character.normalize({...cfg, [field]: value})`; `v =
Character.validate(cfg2)`; invalid -> control error state, previous config kept; valid ->
store and `Character.applyTo(...)`/`character.changed` (M-22 emits) so M-21 rebuilds that one
performer live (I 8: no scene reload, song and project state untouched). Randomize ->
`Character.randomize(new Core.Prng(Core.fnv1a32(uid())))`. Presets apply appearance only
(5.10). Save: roster changes -> `Storage.set('characters', {version:1, presets})` (max
16 user presets; the 17th asks to replace the oldest); project characters ->
`Project.Commands.setCharacter(slot, config)` pushed on the project's UndoStack (6.28.9 note 3). Export -> `Character.serialize` -> `.flmchar.json`; Import -> `Character.deserialize` with
validation errors listed. Leaves: Back -> `Modes.leave('user')`; pending debounced writes are
flushed in `unmount`.

6.27.4.14 SCR-Settings (mode `settings`, or `variant:'contextual'` pushed over SCR-Pause)

Tabs (full variant): Audio, Controls, Gameplay, Video, Accessibility, Calibration, Privacy,
Advanced; the contextual variant shows Audio volumes, Calibration, Controls (pad layout,
size, opacity only), and Video (camera motion, effects level) (I 11.2). Each control is a
widget bound to a 5.11 path with `onChange -> Settings.set(path, v, 'ui')`; the Comparable
column marks controls whose non-default value makes results non-comparable with the badge
"Practice setting: results are not comparable" (P 5.3).

Remapping (Controls): the user selects a control row ("Lane 1 (circle)"), presses "Change",
the row shows "Press a key" and the controller captures the next `keydown` (capture listener
with owner, `preventDefault`, `Escape` cancels, `Tab` is refused with "Tab is reserved for
navigation"); `r = Input.remap(context, control, code)`; `r.ok` -> `Settings.set(
'input.keys.<group>', mapsToSettings(Input.getMap()), 'ui')`; `r.conflict` -> DLG-RemapConflict
("Swap" -> remap the other control to the old code then retry; "Cancel"). Reset Controls ->
confirm -> `Input.resetMap()` and settings reset of `input.keys`. MIDI: "Enable MIDI input"
-> `Input.enableMidi()` (disabled with the gate reason when not secure or not supported).

Calibration tab: the three values with sliders (input offset -200..200 ms, audio latency
0..500 ms, visual lead 600..3,000 ms shown also as note speed `x(1500/lead)`), "Run calibration"
-> DLG-Calibration. Advanced: polyphony cap, chord window, stats overlay, "Diagnostics" ->
`Modes.enter('diagnostics')` (full variant) or push SCR-Diagnostics (contextual is not
allowed: the entry is hidden there). Privacy: static text (nothing is collected). Settings
backup: Export (`Settings.export()` -> `.flmsettings.json`) and Import (picker -> 
`parseImport` -> DLG-ImportSettings listing changes -> `applyImport`).

Leaves: Back -> pop (contextual) or `Modes.leave('user')`; pending writes flushed.

6.27.4.15 SCR-Help (mode `help`)

Tabs: Controls (current keyboard map from `Input.getMap()` through `codeLabel`, gamepad map
table of 6.7.1, touch pad description with glyph words, MIDI default notes), Modes (what each
of Instrument, Free Play, Studio, Dance and Multiplayer does, P 4), Layouts (for each profile
A-F: `Mapping.profileTable(profile, ctx)` rendered as four rows "control -> action, pitches"
in the current key), File formats (`Import.COMPATIBILITY` rows with status words), Tutorial
("Start the tutorial" -> `Modes.enter('tutorial')`). Handles: `input.map` (refresh labels).
Leaves: Back.

6.27.4.16 SCR-About (mode `about`)

Shows: product name, `FLM.VERSION`, `FLM.BUILD` date and edition (Standalone or Online with
relay URL), the honest-limits sentences of Part 1 and 7.11 (synthesized instruments, no
sampled fidelity; supported and unsupported formats; multiplayer needs a manual code exchange
or a relay; storage is not a permanent backup), licenses ("No third-party code, fonts, sounds
or models are included; all songs are original"), instrument definitions version
(`Instruments.DEFS_VERSION`), environment facts (`Caps.secureContext`, `Caps.isFile`, render
tier, storage mode). Actions: "Copy diagnostics" (`FLM.diagnostics()` JSON to clipboard), 
"Diagnostics" -> `Modes.enter('diagnostics')`. Leaves: Back.

6.27.4.17 SCR-Diagnostics (mode `diagnostics`; B 24, I 3.5, I 13.2)

Panels (all refresh at 1 Hz with a timer on the screen owner): timing (`input.anchor` offset
and jitter, `sched.stall` count and last gap, scheduler stats), audio (`audio.state`,
`Audio.latency()`, `audio.voices` counters, sample rate, polyphony cap), rendering
(`render.stats` fps, p50, p95, draws, tier, downgrade flag, GL renderer string), storage
(mode, quota, usage), network (`Net.diagnostics()`), capabilities (`Caps.get()`), counters
(`FLM.debug.counters()`), log (last 100 of `Log.entries()` with a level filter), errors
(`ErrorReporter.records()`). Actions: Export (`Core.Diagnostics.export()` -> `.flmdiag.json`;
"Include song data" checkbox off by default, P 13.2), Copy, overlay toggle
(`video.showStats`). Test build only (when `FLM.SelfTest` exists): "Self-test" panel
(6.31.4.6). Leaves: Back.

6.27.4.18 SCR-Tutorial (mode `tutorial`; I 11.3)

The controller renders the instruction card (title, text, step counter "Step 3 of 7",
buttons Skip step, Repeat step, Exit tutorial) above the gameplay area and drives
`Tutorial.transition`. State machine:

```text
idle --start--> instruct(1)
instruct(i) --ready (button or any lane press)--> active(i)
active(i)   --criteria met--> success(i)
active(i)   --pass ended, criteria not met, passes < 3--> active(i) (next loop pass)
active(i)   --3 passes without success--> retry(i)
success(i)  --next (button, Enter, auto after 2.5 s)--> instruct(i+1)   [i < 7]
success(7)  --> done
retry(i)    --repeat--> instruct(i) ; --skip--> instruct(i+1)
any(i)      --skip--> instruct(i+1) (i recorded in skipped) ; at i = 7 --> done
any         --repeat--> instruct(i)
any         --exit--> exited
done        --> onboarding.tutorialDone = true; step 7 choice decides the next mode
```

Step execution by kind (data in Content.TUTORIAL, 6.30.4.8):

| Step | Kind | On `active` | Success criteria |
|---|---|---|---|
| 1 Trigger a note | chart | `Modes.startGameplay({kind:'instrument', songId:'tut-basics', trackId:'t1', chart: Content.tutorialChart(1, song), loop: step.segment, countInBars:1, targetTrackMode:'mute', accompanimentVolume:1, keepStage:true})`; the piano track stays muted in every step, so every sound of the piano comes from the player (hit sounds in steps 1-3, the live mapping in steps 4-5) | >= 4 head judgments non-miss |
| 2 Two simultaneous notes | chart | same with the two-lane chart | >= 4 chord notes judged non-miss (both lanes inside the chord tolerance) |
| 3 Follow a simple rhythm | chart | same | >= 8 non-miss and pass accuracy >= 0.60 |
| 4 Select a different instrument | instrument | `Modes.stopGameplay()`; free-play mapping (profile A, C major) on the tutorial piano track with an instrument picker of four programs (0 Acoustic Grand Piano, 25 Acoustic Guitar (steel), 80 Lead 1 (square), 12 Marimba) | program changed from 0 and >= 2 lane presses after the change |
| 5 Record a short performance | record | 4-bar loop (bars 13-16) with drums; `Transport.main.record({countInBars:1})`; presses captured like Free Play recording (6.27.4.7) | take has >= 4 notes; then the take replays once automatically |
| 6 Import a song | import | bytes = `Midi.write(tutorialSong)`; `Import.importFile({name:'tutorial-example.mid', bytes})`; the compact report summary (format, tracks, duration, playable track) is shown in the card | `report.playable === true` and the user presses "Got it" (an import error shows its message and offers Skip) |
| 7 Enter the studio or dance mode | choose | buttons "Open Studio", "Try Dance Mode", "Back to the menu" | any choice; sets `onboarding.tutorialDone` and enters `studio` (new project), `dance` (select phase of SCR-Dance pushed over the menu) or `menu` |

Keyboard and touch variants: `variant = onboarding.inputMode === 'touch' or (inputMode ===
'auto' and body.touch) ? 'touch' : 'keyboard'`. Instruction text templates contain
`{lane0}`..`{lane3}`; keyboard fills them with `codeLabel(map.lanes[i])` ("Press A"), touch
with `padWords('lanes')[i]` ("Tap the circle pad"). Step 2 text names two keys or two pads.
The variant re-evaluates on every `input.event` source change (a touch user who presses a key
gets keyboard text from the next step on). Every step is skippable (Skip button, `KeyN`) and
repeatable (Repeat button, `KeyR` outside step 5), and the whole tutorial can be repeated from
SCR-Help (P 4). Exit: `Escape` -> `Modes.pause('user')` while active (the pause screen offers
"Exit tutorial"), else `Tutorial.exit()`.

Handles: `judge.result` (counting per pass), `transport.loop` (pass end), `studio.take` (not
used: step 5 records locally), `import.done`/`import.failed` (step 6), `input.event`.

6.27.4.19 SCR-Results (mode `results`)

`params = {summary:PerformanceSummary, record:PerformanceRecord|null, isBest, previousBest,
unlocks:[...], players:[...]|null, replay:{mode, params}, returnTo}`. Content:

- Header: song title, track or "Dance", difficulty, profile, speed when != 1.00x.
- Score (large), accuracy percent with two decimals, max combo, completion percent,
  judgment counts (perfect, great, good, miss; each with word and glyph), hold breaks, stray
  presses, early and late counts with mean offset "on average 12 ms late" (a calibration
  hint "Consider adjusting the input offset" appears when `abs(meanDeltaMs) > 20` and judged
  >= 30).
- Section table: label, accuracy, misses; the worst section (`worstSectionIndex`) is marked
  with text "Hardest section" and a "Practice this section" button.
- Personal best: "New personal best" when `isBest`, else "Best: <score>" from `previousBest`;
  when `record.comparable === false`: "Practice result: not counted for personal bests
  (<reason>)" where reason is speed, judgment preset or incomplete.
- Unlocks: one line per `progress.unlock` payload received for this play.
- Multiplayer: players table (name, score, accuracy, max combo) ordered by score, host
  authoritative note "Scores are calculated by the host".

Actions: "Play again" (primary, `Enter`) -> `Modes.enter(replay.mode, replay.params)`;
"Practice this section" -> `Modes.enter('instrument', {...replay.params, loop: section,
returnTo})` (dance: `'dance'` with loop); "Choose another song" -> `Modes.leave('user')` then
push `returnTo` select screen; "Main menu"; multiplayer: "Back to lobby" -> `Modes.enter(
'multiplayer', {resume:true})`. Restart never reuses scoring state (M-28 creates a fresh Judge,
P 5.2).

6.27.4.20 SCR-Pause (pushed over gameplay screens; no mode change)

Pushed by `Modes.pause(reason)` after the transport is paused, the Judge set inactive and
inputs released (6.28.4.4). Shows the reason line (`'user'` -> "Paused"; interruption causes
-> the Part 4.7.4 texts), and buttons: Resume (primary; `Escape` and `Enter`), Restart song,
Restart section (when sections exist), Practice options (instrument and dance: speed and loop,
applied by `Modes.restart(changes)`), Settings (`push('SCR-Settings', {variant:'contextual'})`),
Quit to menu (`Modes.leave('user')`; tutorial: "Exit tutorial"). Quick toggles: camera motion
(`video.cameraMotion`), pad layout (`input.padLayout`).

Behavior rules (P 5.2, E 4.1):

1. While SCR-Pause is mounted the Judge is inactive, so lane presses produce no judgment and
   no stray count (pausing does not register notes); `Space` and `KeyP` are the `panic`
   control (Input), which M-28 maps to `Audio.panic(false)` plus the toast "All notes stopped".
2. Resume: the screen shows a countdown "3", "2", "1" over 1,500 ms (500 ms per step; reduced
   motion: the same numbers without scaling), then pops itself and calls `Modes.resume()`, which
   calls `Transport.main.resume()` (re-anchor at `audioNow + 0.05`) and activates the Judge. A
   second Escape during the countdown cancels it.
3. If audio is not running when Resume is chosen, DLG-ResumeAudio opens first; resume continues
   after `audio.state` returns to `running`.
4. Holds that were active at the pause are evaluated by the Judge on resume against the input
   state (06b rule); the countdown gives the player time to press again.
5. `onBack` (browser Back, gamepad B) = Resume.

6.27.4.21 Dialog builders

| DLG | Opened by | Buttons -> result | Effect of the result |
|---|---|---|---|
| DLG-UnsavedChanges | `UI.confirmUnsaved` from SCR-Studio, SCR-FreePlay, replace flows | Keep editing `cancel`, Discard changes `discard`, Save `save` | caller acts (6.27.4.7, 6.27.4.8) |
| DLG-SaveFailed | global `project.saveFailed` reaction | Export `export`, Try again `retry`, Close `cancel` | export: `Project.serialize` + download (`.flm.json`) and toast on dispatch; retry: `Storage.saveProject(project)` again |
| DLG-ImportReplace | SCR-ImportInspect, SCR-Library open flows | Replace `replace`, Save first `save` (only when storage works), Cancel `cancel` | caller acts |
| DLG-AudioBlocked | `Modes.enter` for modes needing audio (6.28.4.1 step 3) | Enable sound `enable` (gesture: `Audio.unlock()` inside the click), Cancel `cancel` | the dialog stays open showing "Waiting for sound..." until `audio.unlocked` (resolves `enabled`) or 5 s (shows "Sound is still blocked. Check that the tab is not muted, then try again.") |
| DLG-DeleteTrack | SCR-Studio | Delete track `delete` (danger), Cancel | consequence: "<name> and its <n> notes will be removed. You can undo this." plus "Recording on this track will stop." when armed |
| DLG-Calibration | SCR-Settings, DLG from results hint | Save `save`, Cancel `cancel` | wizard 6.27.4.22 |
| DLG-RemapConflict | SCR-Settings remap | Swap `swap`, Cancel `cancel` | 6.27.4.14 |
| DLG-ProjectTooLarge | Storage save result code for the 2 MB localStorage-only limit (5.8) | Export `export`, Continue without saving `cancel` | export as DLG-SaveFailed |
| DLG-Unsupported | unsupported file format, read-only Studio, unsupported export, returnToMenu notice | OK `ok` (+ "Copy diagnostics" for the returnToMenu variant) | none |
| DLG-NetError | `net.state` `error` or `ended` with a reason other than `user` | Try again `retry` (connection failures only), Back to lobby `lobby` (when still connected), Leave `leave` | retry -> restart the code exchange; leave -> `Modes.leave('net')` |
| DLG-ResumeAudio | M-28 on `audio.state` leaving `running` in modes needing audio | Resume sound `resume` (gesture: `Audio.resume()`), Not now `cancel` | gameplay stays paused either way until the user resumes in SCR-Pause |
| DLG-DeleteProject | SCR-Library | Delete `delete` (danger), Cancel | consequence names the project and states that exported files are not affected |
| DLG-ExportWav | SCR-Studio export | Cancel `cancel` | shows indeterminate progress while `Audio.renderWav(project)` runs; on resolve -> download `.wav` and close; mobile cap refusal shows the E-EXP-003 text and, when MediaRecorder exists, the OQ-2 alternative button "Record the mix in real time" |
| DLG-ImportSettings | SCR-Settings import | Apply `apply`, Cancel | lists up to 20 changed settings, then "+N more" |

6.27.4.22 DLG-Calibration wizard

Three pages; every page has Back, Next and Cancel; Save on the last page.

1. Audio tap test: "Tap any lane key or the pad on each click." The wizard schedules 12
   metronome clicks at 100 BPM (`Audio.Metronome` clicks at `t0 + k * 0.6`, `t0 = audioNow + 1.0`).
   Taps are `input.event` presses (owner of the dialog) for controls `lane0..3`, `dance0..3`,
   or a pointer press on the wizard pad; the audio time of a tap is `evt.tAudio`. Taps 1-2 are
   discarded (settling); each remaining tap is matched to the nearest click within +/- 300 ms;
   `dA = median(tap - click)` in ms; requires >= 6 matched taps and interquartile range <= 60 ms,
   else "The taps were too uneven. Try again." and the page restarts.
2. Visual tap test: 12 flashes of the wizard pad at the same times without sound (the flash is
   drawn when `Audio.clock().now() >= flashTime` in a RAF callback owned by the dialog); same
   matching -> `dV` in ms.
3. Result and visual lead: `inputOffsetMs = clamp(round(dV), -200, 200)`; `audioLatencyMs =
   clamp(round(dA - dV), 0, 500)` (the visual test contains only input and display delay, the
   audio test adds the output latency; their difference is the audio latency; I 2.3 "separate
   input latency and audio output compensation"); a highway preview with the visual lead slider
   600-3,000 ms. Save -> `Settings.setMany({calibration.inputOffsetMs, calibration.audioLatencyMs,
   calibration.visualLeadMs}, 'wizard')`. The text says "Browsers cannot measure every part of
   your device latency; this test estimates it from your taps" (I 3.5).

6.27.4.23 `codeLabel(code)`

`/^Key([A-Z])$/` -> letter; `/^Digit(\d)$/` -> digit; `/^Numpad(\d)$/` -> "Num " + digit;
`/^Arrow(Left|Right|Up|Down)$/` -> word; `ShiftLeft` -> "Left Shift", `ShiftRight` -> "Right
Shift", `ControlLeft` -> "Left Ctrl", `AltLeft` -> "Left Alt"; table: `Escape` "Esc", `Space`
"Space", `Enter` "Enter", `Backspace` "Backspace", `Tab` "Tab", `Semicolon` ";", `Quote` "'",
`Comma` ",", `Period` ".", `Slash` "/", `BracketLeft` "[", `BracketRight` "]", `Minus` "-",
`Equal` "=", `Backquote` "`"; `midi:<n>` -> "MIDI " + `Theory.noteName(n)`; anything else -> the
code unchanged.

6.27.4.24 Global reactions (owner `SCREENS_OWNER`, installed by `register`)

| Topic | Reaction |
|---|---|
| `project.saveFailed` | `kind:'save'` (or `'manual'`/`'autosave'` from Part 4 payloads): `showSaveFailed(payload)` unless a DLG-SaveFailed is already open; `kind:'checkpoint'`: count per project; 2 consecutive failures -> toast `text('save.checkpointFailed')` with action Export; a success resets the count |
| `storage.quota` | level `warn`: toast once per session "Storage is almost full (<percent>%). Export projects to keep backups."; `critical`: same text kind error with action "Library" |
| `storage.state` | toast the notice when the mode degrades at runtime |
| `error` | `returnToMenu` class: none here (M-28 leaves the mode and then calls `showError`); `recoverable`: none (M-26 presenter) |
| `audio.state` | none (M-28 decides when DLG-ResumeAudio is needed) |
| `progress.unlock` | toast kind success "Unlocked: <title>" (the results screen also lists it) |

#### 6.27.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Settings document damaged | `Storage.loadSettings` fallback / normalize warnings | defaults or backup | n/a | settings only | toast "Settings were reset" when both damaged | defaults | next write persists | UT-27-13 |
| Settings write fails (quota, private mode) | `Storage.saveSettings` ok:false | in-memory settings | next change retries | settings only | toast once | memory-only settings | n/a | UT-27-14 |
| Save fails | `project.saveFailed` | project in memory, previous saved copy (M-16) | Try again | unsaved changes | DLG-SaveFailed with Export | export path | successful save | UT-27-18 |
| Import fails or is unsupported | `import.failed` / identify `unsupported` | current project untouched (S-12) | Choose another file | no | error state, DLG-Unsupported | none | Back to menu | UT-27-19 |
| Calibration taps uneven | IQR check | previous calibration | restart page | no | inline message | none | Cancel keeps old values | UT-27-17 |
| Remap conflict | `Input.remap` conflict | old map | Swap or Cancel | no | DLG-RemapConflict | none | Cancel | UT-27-16 |
| Tutorial example import fails | rejection | tutorial state | Skip | no | message in the card | step skippable | next step | UT-27-11 |
| Net failure in lobby or game | `net.state` error | local settings, local projects | Try again | no | DLG-NetError | standalone menu | leave to menu | UT-27-22 |
| Controller handler throws | M-26 widget wrapper | screen | user retries | no | widget error state | none | Back | UT-26-12 |
| Clipboard denied | promise rejection | text | manual copy | no | textarea with the text selected | manual copy | n/a | UT-27-23 |

#### 6.27.6 Limits and performance notes

- Lists render at most 200 rows directly; longer lists (projects index max 200 by 5.15, GM
  programs 128) need no virtualization. The import report's track table shows up to 32 rows
  plus the overflow checklist.
- Chart preview regeneration is debounced 150 ms and must finish within 100 ms for a 10,000
  note track on desktop (generator cost is M-08's budget); previews draw at most 8 bars.
- Studio overview and playhead refresh at 10 Hz from a screen-owned timer; the piano roll
  redraws only on `project.changed`, `studio.selection` and scroll (no per-frame redraw).
- Settings writes are debounced 250 ms; at most one write per 250 ms during slider drags.
- Diagnostics refresh at 1 Hz; the log panel shows the last 100 entries.

#### 6.27.7 Spec coverage

B 6.1 (first launch seven steps), B 6.2 (main menu entries and disabled distinction), B 6.3,
B 7.1 (Quick Play selection without Studio), B 7.2 (difficulty, accompaniment), B 7.3 (Free
Play controls, quantized versus unquantized, record and replay), B 7.4 and B 16 (Studio
panels, track lifecycle, mixer, save, load, export, MIDI versus audio export distinction),
B 7.5 (import inspection, track choice, mute or lower target, speed, seek, loop), B 7.6 (dance
options, custom charts), B 7.7 and B 17 (room flows, ready states, host settings, sync
display), B 8.5 (calibration UI), B 13.1 (character editor), B 15.6 (exports), B 18.4 (too
large project path), B 22 (remappable controls, adjustable windows, labels), B 23.2 (privacy
statement), B 24 (actionable errors, diagnostics mode), E 4.1 (inputs during pause, remap
during song), E 5.3 (save failure path), I 2.3 (calibration without technical knowledge,
separate input and audio compensation), I 2.4 (section-by-section feedback), I 3.5 (audio
diagnostics guidance), I 5 and 5.2 (studio overview), I 6.1, I 6.2 (inspection fields,
preview, mapping change), I 6.3 (practice tools), I 7 (dance practice, chart import), I 9
(results with personal bests and unlocks), I 10.2 (sync diagnostics), I 11.1-11.4
(complexity levels through select phases and "More layouts", contextual settings, tutorial,
loading and error states), I 13.2 (diagnostics export without song content), P 3, P 4, P 5.2
(restart without stale scoring, pause registers no notes), P 5.3 (comparability notices),
P 8, P 9, P 10, P 11, P 12, P 13, P 15, P 16, P 19, P 21.

#### 6.27.8 Unit tests (group `screens`, file `src/91-test-screens.js`)

Setup: the real M-26 with history off; fakes for the lower modules a test does not exercise
(`t.fakes.stub(FLM.Storage)` style spies from M-31) and the in-memory IndexedDB fake;
`Modes.enter` replaced by a spy unless stated.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-27-01 | main menu entries and order | mount SCR-MainMenu | 12 items with the BRIEF 7 labels in order; focus on `onboarding.lastMode` entry |
| UT-27-02 | disabled entries explain why | caps without RTCPeerConnection and no relay URL | Multiplayer item `aria-disabled` with reason "This browser has no WebRTC support."; activating shows the reason toast; `Modes.enter` not called |
| UT-27-03 | import picker inside the gesture | spy `Storage.pickFile` and `Modes.enter` | on click `pick` is called synchronously before `enter`; `enter('import', {files})` receives the pick promise |
| UT-27-04 | quick play defaults | settings without `session.quickPlay` | selection is demo-poprock, Keys track, beginner, A, backing on; Play calls `enter('quickplay', ...)` with `returnTo:'SCR-QuickPlay'` and writes `session.quickPlay` |
| UT-27-05 | quick play dance choice | choose Dance | difficulty options become easy, normal, hard; profile control hidden; enter params `kind:'dance'` |
| UT-27-06 | instrument auto difficulty | stub simplificationReport: simplification needed for beginner and intermediate only; then for none; then for all | Auto resolves to `advanced`; then `beginner`; then `advanced` (fallback) |
| UT-27-07 | first launch steps and flag | mount, step through 1..6 choosing "Go to the main menu" | `onboarding.firstLaunchDone` true and written immediately; screen replaced by SCR-MainMenu; Back on step 3 returns to step 2 |
| UT-27-08 | tutorial transitions | `Tutorial.transition` pure calls | idle->instruct(1)->active(1)->success(1)->instruct(2); 3 failed passes -> retry; skip at 7 -> done; exit from any -> exited |
| UT-27-09 | tutorial success criteria | feed judge.result fixtures for steps 1-3 | step 1 succeeds at the 4th non-miss; step 3 requires accuracy >= 0.60 and 8 non-miss |
| UT-27-10 | tutorial variants | inputMode 'keyboard' with lanes KeyA..; then 'touch' | step 1 text contains "Press A"; touch text contains "circle pad" |
| UT-27-11 | tutorial example import | spies on Midi.write and Import.importFile (rejecting) | importFile called with name 'tutorial-example.mid' and the written bytes; on rejection the card shows the error and Skip is enabled |
| UT-27-12 | tutorial done sets flag | choose "Open Studio" at step 7 | `onboarding.tutorialDone` true; `enter('studio')` called |
| UT-27-13 | settings load normalization | `Storage.loadSettings` returns doc with masterVolume 3, padSize 'huge', unknown key `foo.bar` | masterVolume 1, padSize 'medium', `x.foo.bar` preserved, W-SET-NORMALIZED logged once; event key '*' with source 'load' |
| UT-27-14 | settings set event and debounce | fake timers; 5 sets of audio.masterVolume within 100 ms; one onboarding set | 5 events with prev values; one `Storage.saveSettings` write after 250 ms; onboarding write immediate |
| UT-27-15 | settings export import round trip | change 3 settings; export; reset; parseImport; applyImport | `changes` lists the 3 paths; after apply `all()` deep-equals the pre-reset document |
| UT-27-16 | remap capture and conflict | Input fake returning conflict for KeyS | DLG-RemapConflict shown; Swap calls remap for both controls; Escape during capture cancels without remap |
| UT-27-17 | calibration math | synthetic taps: audio test taps at click + 120 ms +/- 5, visual at flash + 40 ms | inputOffsetMs 40, audioLatencyMs 80; with IQR 80 ms the page restarts with the uneven message |
| UT-27-18 | save failed dialog | emit project.saveFailed kind 'save' | DLG-SaveFailed open; Export calls `Project.serialize` and `Storage.download` with `.flm.json`; a second event while open does not open another |
| UT-27-19 | import inspect renders I 6.1 fields | fixture InspectionReport with 3 tracks, warnings, tempo default | every I 6.1 item present by data-field attribute; default playable radio = recommendedTrackId; tempo source text "default 120 BPM, not in file" |
| UT-27-20 | import mapping change regenerates preview | fake timers; change difficulty twice within 100 ms | `ChartGenerator.generate` called once after 150 ms with the last difficulty; describe line updated |
| UT-27-21 | results content | PerformanceSummary fixture with worstSectionIndex 2, meanDeltaMs 25, judged 40, comparable false (speed) | section 2 labelled "Hardest section"; calibration hint shown; practice-result sentence names speed |
| UT-27-22 | multiplayer views follow net.state | emit net.state idle, inviting, lobby, error | privacy text visible in idle; code box in inviting; player list in lobby; DLG-NetError on error |
| UT-27-23 | clipboard fallback | `navigator.clipboard.writeText` rejects | a textarea with the diagnostics JSON is shown and selected |
| UT-27-24 | studio back guard | dirty project; confirm resolves 'cancel' then 'discard' | first back stays (`'handled'`), second calls `Modes.leave('user')` and `Project.setCurrent(null)` |
| UT-27-25 | library filter restore | session.libraryFilter {query:'neon', sort:'name', scroll:120} | list filtered and sorted; scrollTop 120 after mount; unmount writes the new values |
| UT-27-26 | codeLabel table | codes KeyA, Digit3, ArrowLeft, ShiftLeft, Escape, Semicolon, midi:60, Foo | 'A', '3', 'Left', 'Left Shift', 'Esc', ';', 'MIDI C4', 'Foo' |
| UT-27-27 | pause screen registers no notes | gameplay fakes; pause; press lane0 3 times; resume after countdown | no judge.result and stray count 0 while paused; `Modes.resume` called after 1,500 ms of fake time |
| UT-27-28 | audio blocked dialog resolves on unlock | open DLG-AudioBlocked; emit audio.unlocked | dialog resolves 'enabled' and closes |

#### 6.27.9 Implementation notes and browser quirks

- `Storage.pickFile` must run synchronously inside the click or keydown handler: Safari and
  Firefox block `input.click()` for file pickers outside a user gesture, and the gesture is
  lost after any `await`. The same applies to `Audio.unlock()` and `Audio.resume()` in
  DLG-AudioBlocked and DLG-ResumeAudio, and to clipboard writes.
- The remap capture listener is added on `window` in the capture phase so it sees the key
  before M-07; it calls `stopPropagation` so the key does not also trigger a game control.
- iOS Safari shows the on-screen keyboard for any focused input; text fields are never
  auto-focused (M-26 rule), and the multiplayer code boxes are `readonly` `textarea`s with a
  Copy button rather than fields to type into.
- The chart preview canvas is a small 2D canvas owned by the screen; it is not `canvas#flat`
  and not counted in GL counters; it is removed with the screen DOM.
- Practice loops (per-pass judging, speed-up) are normative in 6.28.4.6; the screen only shows
  the pass counter, the pass accuracy and the speed value.
- All user-facing strings referenced by id (`text('...')`) are defined in the Part 7.11
  catalog; ids used here that Part 7.11 must contain: `first.audio`, `settings.reset`,
  `settings.saveFailed`, `settings.importNewer`, `save.checkpointFailed`, `import.failedTitle`,
  `net.badCode`, `pads.shrunk`, `pads.fewTouches`, `field.pauseToEdit`, `tier.auto`,
  `dlg.unsaved.consequence`.

### 6.28 M-28 Modes (`src/28-modes.js`, `FLM.Modes`)

#### 6.28.1 Responsibilities and non-goals

Responsibilities:

- The mode manager of Part 4.7: exactly one active mode, serialized `enter` and `leave`,
  the full teardown contract, per-mode setup and teardown (6.28.4.3 table), the owner token
  that tags every resource a mode creates.
- Gameplay assembly inside a mode (`startGameplay`, `stopGameplay`, `restart`): song load,
  Scheduler binding, chart generation, Judge creation with per-pass time maps, input routing,
  hit sounds and target-track policy, stage and render loop, HUD and pads, finish detection
  and the transition to `results`.
- Pause and resume orchestration (`pause`, `resume`) used by SCR-Pause and interruptions.
- Interruption handling (visibility, pagehide, freeze, blur, audio state, orientation and
  resize, gamepad disconnect, context loss, memory and stall heuristics, network end).
- Audio previews in panel modes (`preview`, `stopPreview`).
- `assertClean()` and `baseline()` (Part 4.7.3) and the leak report in `mode.leave`.
- Auto render-tier downgrade (p95 frame time > 33 ms over 5 s).
- The `popstate` listener (browser back) forwarding to `UI.Screens.onPopState`, the
  `body.in-game` class, the `flm.v1.lastSession` record.

Non-goals: no screen content (M-27), no musical algorithms (M-08, M-09, M-23), no storage
format (M-15, M-16). M-28 never creates DOM other than toggling `#hud`, `#touch`,
`#rotate` visibility through M-26 and classes on `body`.

#### 6.28.2 Public API

```js
FLM.Core.define('Modes', function (FLM) {
  return Object.freeze({
    MODES: ['menu','quickplay','instrument','freeplay','studio','library','import','dance','multiplayer',
            'customize','settings','help','about','diagnostics','tutorial','results'],
    GAMEPLAY: ['quickplay','instrument','dance','multiplayer','tutorial'],
    LIVE: ['freeplay','studio'],
    /** Part 4.7 table as data: {mode: {audio:boolean, transport:'none'|'song'|'tempo'|'project'|'preview'|'tutorial',
     *  scheduler:'none'|'bound'|'preview', chart:'none'|'instrument'|'dance'|'either'|'step', stage:'none'|'full'|'small'|'single',
     *  input:'menu'|'instrument'|'dance'|'freeplay'|'studio', hud:string|null, pads:'never'|'touch'|'recording',
     *  screen:'SCR-*', landscape:boolean}} (frozen) */
    REQUIREMENTS: {},

    /** Boot step B10: popstate listener (UI.Screens.onPopState), document and window listeners for the
     *  interruption sources (owner MODES_OWNER), bus subscriptions to error, audio.state, render.*, ui.layout,
     *  input.device, sched.stall, net.state. Sets current = {mode:'none'}. Idempotent. */
    init() {},
    /** Serialized. Resolves {ok:true, mode} or {ok:false, mode:'menu', error:ErrorRecord}. Never rejects. */
    enter(mode, params) {},
    /** Serialized. Full teardown (4.7.2) to 'menu'. opts.next names the mode that follows (for the
     *  netConnections exemption). Resolves {leaks: object|null, ms}. Never rejects. */
    leave(reason /* 'user'|'finished'|'error'|'interrupt'|'net' */, opts /* ?{next:string} */) {},
    current() /* -> {mode, params, owner, enteredAt, transitioning:boolean} (copy; owner omitted) */ {},
    params() /* -> params of the current mode (copy) */ {},
    isGameplay(mode /* ?string, default current */) /* -> boolean */ {},
    isTransitioning() /* -> boolean */ {},

    /** Assemble gameplay inside the current mode (used by enter for quickplay, instrument, dance,
     *  and directly by SCR-Multiplayer on 'start' and SCR-Tutorial per step). @param {GameplaySpec} spec */
    startGameplay(spec) /* -> Promise<void> rejects with E-MODE-002 */ {},
    /** Tear down gameplay only (judges, pump, hit strip, stage stays when spec.keepStage). */
    stopGameplay(reason) /* -> Promise<void> */ {},
    /** Restart with optional changes {fromTick, section, speed, loop, difficulty, profile}: fresh Judge,
     *  regenerated chart when difficulty or profile changed, transport re-seeked; never reuses scoring state. */
    restart(changes) /* -> Promise<void> */ {},
    gameplayState() /* -> {active, kind, chartId, settingsHash, speed, passes:[{index, judged, accuracy}], finished} */ {},
    /** Pause the transport, deactivate judges, release inputs, push SCR-Pause with the reason. */
    pause(reason /* 'user'|'hidden'|'blur'|'audio'|'gamepad'|'stall'|'net' */) /* -> Promise<boolean> */ {},
    /** Pop SCR-Pause if present, Transport.resume(), activate the current judge. */
    resume() /* -> Promise<boolean> */ {},

    /** Audio preview in library and import modes. */
    preview(songOrId, opts /* ?{fromTick, durationS:15} */) /* -> Promise<{ok:boolean}> */ {},
    stopPreview() /* -> Promise<void> */ {},

    /** Called by the interruption listeners and by tests. */
    onInterrupt(cause, detail) /* -> 'paused'|'continued'|'ended'|'released'|'ignored' */ {},

    baseline() /* -> CounterSnapshot */ {},
    assertClean(opts /* ?{next:string, exempt:string[]} */) /* -> null | {counter: {expected, actual}} */ {},
    counters() /* -> CounterSnapshot (current values) */ {}
  });
});

GameplaySpec {
  kind: 'instrument' | 'dance',
  songId, song /* ?Song, overrides songId */, trackId /* instrument only */,
  difficulty, profile /* instrument only */, chart /* ?prebuilt Chart or DanceChart (tutorial, imported dance) */,
  countInBars: 0 | 1 | 2, speed: 0.25..2.0, fromTick: int, loop: {a, b} | null,
  targetTrackMode: 'mute' | 'lower' | 'full', accompanimentVolume: 0..1, soloTrackId: id | null,
  instrumentOverride: 0..128 | null, pitchFilter: 'left' | 'right' | null, speedUp: boolean,
  visualization: 'full' | 'minimal', lifeBar: boolean,
  net: null | {role:'host'|'guest', tStartShared:number, settingsHash:string},
  autoStart: boolean /* default true */, keepStage: boolean /* tutorial between steps */
}
```

Events emitted: `mode.enter {mode, prev, params, ms}`, `mode.leave {mode, next, reason, ms,
leaks}`, `mode.interrupted {mode, cause, action}`. Events consumed: `error`
(`returnToMenu` -> leave), `audio.state`, `audio.unlocked`, `render.contextLost`,
`render.contextRestored`, `render.tier`, `ui.layout`, `input.device`, `input.event` (gameplay
routing to judges; `pause` and `panic` controls), `sched.stall`, `transport.state`,
`transport.loop`, `transport.seek`, `transport.speed`, `judge.result`, `chart.finished`,
`net.state`, `progress.unlock` (collected for results).

#### 6.28.3 Internal state

```js
current = {mode:'none', params:{}, owner:null, enteredAt:0}
queue = Promise.resolve()                 // serialization chain for enter and leave
transitioning = false
baselineSnap = null                       // CounterSnapshot taken in menu
gp = {                                    // gameplay assembly, null when inactive
  owner, spec, song, chart, kind, judges: [{judge, map:PassTimeMap, from:number audio, to:number|Infinity}],
  pumpTimer, hitStrip:'hit'|null, hitVoices: Map<noteId, {pitches, offAt}>, velocityByNote: Map,
  passes: [], finishing:false, finished:false, startedAtIso, startAudio, unlocksSeen: [],
  stage, frameErrors: [], autoTierToastShown:false, rotateShown:false
}
preview = {active:false, timer:null, song:null}
interrupt = {stallTimes:[], lastMemCheck:0, contextLostTimer:null}
```

Invariants: `transitioning` is true only inside the queue body; `gp !== null` implies the
current mode is gameplay-capable (`GAMEPLAY` or `tutorial` steps) and `Transport.main.song()
!== null`; at most one judge in `gp.judges` has `to === Infinity` (the live pass); every timer,
RAF and listener created by enter, gameplay or previews carries `current.owner` (or
`gp.owner`, which is `current.owner`).

#### 6.28.4 Algorithms

6.28.4.1 `enter(mode, params)`

```js
function enter(mode, params) {
  const job = queue.then(() => doEnter(mode, params || {}));
  queue = job.catch(() => {});            // keep the chain alive
  return job;
}
async function doEnter(mode, p) {
  transitioning = true; const t0 = Core.now(); const prev = current.mode;
  try {
    assert(MODES.includes(mode), 'E-MODE-002 unknown mode');
    if (current.mode !== 'menu' && current.mode !== 'none') await doLeave('user', {next: mode});
    if (current.mode === 'menu' || current.mode === 'none') baselineSnap = counters();      // step 2
    const req = REQUIREMENTS[mode];
    if (req.audio && !Audio.isUnlocked()) {                                                  // step 3
      const r = await Screens.dialog('DLG-AudioBlocked', {mode});
      if (r !== 'enabled') { report('E-AUD-002', null, {mode}); return {ok:false, mode:'menu'}; }
    }
    if (mode === 'studio' && Storage.state().readOnly) p.readOnly = true;                    // lock elsewhere
    const owner = Symbol(mode + ':' + Core.uid());
    current = {mode, params:p, owner, enteredAt: Core.now()};                                 // step 4
    document.body.dataset.mode = mode;
    await SETUP[mode](p, owner);                                                              // steps 5-12, table 6.28.4.3 (menu: screen only)
    bus.emit('mode.enter', {mode, prev, params: safeParams(p), ms: Core.now() - t0});        // step 13
    if (SETUP[mode].autoStart) await SETUP[mode].autoStart(p);                               // step 14
    Settings.set('onboarding.lastMode', mode, 'ui'); writeLastSession(mode, p);
    return {ok:true, mode};
  } catch (e) {
    const rec = report('E-MODE-002', e, {mode});            // "<mode> could not start: <message>"
    await doLeave('error', {next:'menu'});
    await Screens.showError(rec);
    return {ok:false, mode:'menu', error: rec};
  } finally { transitioning = false; }
}
```

`menu` entry: when the stack is empty (boot) M-28 pushes `SCR-MainMenu` (or `replace` with
`SCR-FirstLaunch` per `p.screen`); otherwise the leave already popped to the root. When
`p.returnTo` names a select screen, it is pushed after the menu root with the stored session
selection (P 21 "song selection preserves the user's current filters").

6.28.4.2 `leave(reason, {next})`

Implements Part 4.7.2 exactly; every step is wrapped in `try/catch` reporting `E-MODE-003
{step}` and the sequence continues. Concrete calls:

| Step | Calls |
|---|---|
| 1 freeze input | `Input.releaseAll('mode')`; `Input.unbind(owner)`; `UI.setTextEntryAllowed(true)`; `body.classList.remove('in-game')` |
| 2 recording guard | `Studio.Recorder.state()` in `armed`, `countin`, `recording` -> `await Studio.Recorder.abort()`; free-play and tutorial takes are local and discarded |
| 3 gameplay | `stopGameplay('leave')` (judges disposed, pump cleared, hit strip removed); `stopPreview()` |
| 4 transport | `Transport.main.stop()` |
| 5 soft panic | `Audio.panic(false)` |
| 6 hard panic check | if `Audio.VoiceAllocator.activeCount() > 0`: wait 350 ms (`Core.timers.setTimeout(..., 350, owner)`), then if still `> 0` -> `Audio.panic(true)` and report `E-AUD-006` (recoverable) |
| 7 bindings | mode `studio`: `await Studio.Session.close()` (its own strips, lock, autosave stop); others: `Audio.Scheduler.unbind()`; `Transport.main.unload()` |
| 8 stage | `Render.stopLoop()`; `Stage.dispose()` when built; `Animation.Mixer.dispose()`; `Render.Flat2D.clear()` |
| 9 timers | `Core.timers.clearOwner(owner)`; `Core.raf.cancelOwner(owner)` |
| 10 UI | `UI.HUD.hide()`, `UI.HUD.reset()`, `UI.TouchPads.hide()`, hide `#rotate`, `UI.closeAllDialogs('mode-leave')`, `await UI.Screens.popTo('SCR-MainMenu')`, `body.dataset.mode = 'menu'` |
| 11 listeners | `Core.dom.offOwner(owner)`; `bus.removeOwner(owner)` |
| 12 network | mode `multiplayer` and `next !== 'results'`: `await Net.close(reason)` (200 ms best effort) |
| 13 autosave | `prev in {studio, freeplay}` and `Project.current()` dirty: `await withTimeout(Storage.autosave(Project.current()), 2000)`; failure is reported by M-16 through `project.saveFailed` |
| 14-15 | `leaks = assertClean({next})`; non-null -> report `E-MODE-001` (recoverable) with the leak object in context; emit `mode.leave {mode, next, reason, ms, leaks}` |
| 16 | `current = {mode:'menu', params:{}, owner: MENU_OWNER, enteredAt: Core.now()}` |

`leave` called while already in `menu` resolves immediately with `{leaks:null}`.

6.28.4.3 Per-mode setup and teardown

"Common gameplay" means `startGameplay(spec)` of 6.28.4.4 with the spec built from params.

| Mode | Setup (enter steps 5-12) | Auto start | Teardown beyond 6.28.4.2 |
|---|---|---|---|
| menu | screen only | none | none |
| quickplay | `UI.Screens.replace('SCR-QuickPlay', {phase:'play', ...p})` (the select screen is on top); common gameplay with `kind` from params; `HUD.show(kind === 'dance' ? 'dance' : 'instrument')` | `Transport.main.play({countInBars: settings audio.countInBars when gameplay.autoCountIn else 0})` | none |
| instrument | `replace('SCR-Instrument', {phase:'play'})` when the select screen is on top, else push; common gameplay (practice fields from params) | play with count-in | none |
| dance | `replace('SCR-Dance', {phase:'play'})` or push; common gameplay `kind:'dance'`; `HUD.show('dance')`; dance pads | play with count-in | none |
| freeplay | `song = Song.create({id:'freeplay', title:'Free Play'})` with one track `fp` (program from `session.freePlay`, `lockedSource:false`); `Transport.main.load(song, {tempoSource:'override', overrideBpm})`; `Audio.Scheduler.bind(Transport.main, song, {master})`; stage `single` (one performer for the program's family); `Input.bind({owner, context:'freeplay'})` with MIDI pass-through on; `HUD.show('freeplay', owner)`; pads on touch; push `SCR-FreePlay` | none (stopped; metronome per setting) | free-play take dropped (the screen asked first) |
| studio | project = `p.project` or `Project.deserialize((await Storage.loadProject(p.projectId)).text).project` or `Project.create()`; `Project.setCurrent(project)`; `await Studio.Session.open(project)` (strips, transport tempo, lock, autosave); stage `small` only when `UI.Layout.widthClass() === 'wide'`; `Input.bind({owner, context:'studio'})`; pads only while recording (on `studio.recording` state recording -> show, else hide); push `SCR-Studio` | none | `Studio.Session.close()` in step 7; `Settings.set('session.lastProjectId', id)` |
| library | push `SCR-Library`; previews on demand | none | `stopPreview()` |
| import | push `SCR-ImportInspect` with `p.files` | none | `Import.cancel()` when running; `stopPreview()`; the report and its song are dropped unless registered in the Catalog |
| multiplayer | push `SCR-Multiplayer` (`p.resume` shows the lobby of the open connection); gameplay is started by the screen with `startGameplay({..., net})` on the host `start` message | none | `Net.close` per step 12 |
| customize | stage `single` built for the selected performer; `Render.startLoop(customizeFrame)` where `customizeFrame(audioNow, dt)` drives `Animation.Mixer.update` with a synthetic preview: every 600 ms (100 BPM) the controller of the previewed performer receives `onEvent` calls with a 2-bar pattern for its family (keys: C major triads; guitar and bass: root strums; drums: kick-snare-hat; others: one note per beat), never through the bus and never audible; push `SCR-Characters` | none | flush roster writes |
| settings, help, about, diagnostics | push the screen | none | none |
| tutorial | `Transport.main.load(Catalog.getSong('tut-basics'))`; `Audio.Scheduler.bind`; stage `full` built once (`keepStage`); `HUD.show('tutorial', owner)`; push `SCR-Tutorial` (which calls `startGameplay`/`stopGameplay` per step) | screen-driven | tutorial takes discarded |
| results | push `SCR-Results` with `p` (summary, record, unlocks, replay params) | none | none |

6.28.4.4 `startGameplay(spec)` and `stopGameplay(reason)`

1. If `gp` is active, `stopGameplay('restart')` first. `owner = current.owner`.
2. Song: `spec.song` or `Project.Catalog.getSong(spec.songId)` (lazy expansion for built-ins);
   missing -> throw `E-MODE-002` ("song not found").
3. Transport: `Transport.main.load(song)` unless it already holds this song;
   `setCountIn(spec.countInBars)`; `setSpeed(spec.speed || 1)`; `spec.loop ? setLoop(spec.loop)
   : clearLoop()`; `seek(spec.fromTick || (spec.loop ? spec.loop.a : 0))`.
4. Audio: `Audio.Scheduler.bind(Transport.main, song, project ? project.mixer : {master:{gain:
   settings audio.masterVolume}})` when not yet bound; target-track policy (6.28.4.7).
5. Chart: `spec.chart` or cached by key `songId|trackId|difficulty|profile|options` in a
   page-lifetime `Map` (built-in and imported songs; nothing persisted, ADR-14):
   instrument -> `await Mapping.ChartGenerator.generateAsync(song, spec.trackId,
   spec.difficulty, spec.profile, {pitchFilter: spec.pitchFilter})`; dance ->
   `Dance.DanceChartGenerator.generate(song, spec.difficulty)` or the imported chart after
   `Dance.validate(chart)`. Multiplayer: `chart.settingsHash !== spec.net.settingsHash` ->
   throw `E-NET-005`. Generation failure -> `E-IMP-010` (returnToMenu, Part 4.7.1 step 7).
6. Judge: `judge = createPassJudge()` (6.28.4.6) with windows for `spec.difficulty` (dance:
   `Dance.WINDOW_MAP`), the `gameplay.judgmentPreset` factor (relaxed 1.5, strict 0.75,
   applied to all three half-widths and rounded to integer ms), calibration from
   `Settings.calibration()`, stray penalty from `gameplay.strayPressPenalty`; `judge.setActive(
   false)` until the transport is `playing`. Pump: `Core.timers.setInterval(() => pump(
   Audio.clock().now()), 50, owner)` where `pump(now)` calls `tick(now)` on every judge in
   `gp.judges`, retires closed pass judges (`now > to + 0.2`) and checks the life bar.
7. Input: `Input.bind({owner, context: spec.kind === 'dance' ? 'dance' : 'instrument', surface:
   '#view', pads:'#touch'})`; one `input.event` subscription (owner) routes events
   (6.28.4.6); `pause` press while the transport runs -> `pause('user')`; `pause` press while
   SCR-Pause is the top screen -> `UI.Screens.current().controller.onBack('key')` (starts the
   resume countdown, 6.27.4.20); `panic` press while paused -> `Audio.panic(false)` and toast
   "All notes stopped". M-28 adds `body.in-game` for every gameplay assembly (including
   `tutorial`) and removes it in `stopGameplay`, so M-26 leaves Escape to the `pause` control.
8. Stage: unless `spec.keepStage` and a stage exists: performers = project characters (slot
   order) or the arrangement's preset slots (M-30 `presetsBySlot`), one per track up to five,
   the chart track's performer marked as the player; `gp.stage = Stage.build(Render.renderer(),
   performers, {camera: settings video.cameraPreset, highway: {chart, leadMs: calibration
   visualLeadMs, audioLatencyMs}, tier: Render.tier(), minimal: spec.visualization ===
   'minimal'})`; `Animation.Mixer.add` per performer; `Render.startLoop(frame)`.
9. HUD and pads: `UI.HUD.show(kind, owner)` per mode, `UI.HUD.reset()`, lane labels from the
   keyboard map; `UI.TouchPads.show({kind: dance ? 'dance' : 'lanes', layout, size, opacity,
   labels, maxTouches: Caps.maxTouchPoints})` when `Caps.maxTouchPoints > 0` and
   `input.padsVisible !== 'never'`; `body.classList.add('in-game')`.
10. Subscriptions (owner): `transport.state` (judge activation, `UI.setTextEntryAllowed`,
    end detection), `transport.loop` (pass handling), `transport.seek`/`transport.speed` (time
    map refresh), `judge.result` (HUD flash, hit sounds, tutorial counters are the screen's),
    `score.update` (HUD), `chart.finished` (finish), `progress.unlock` (collect).
11. Multiplayer start: `atAudio = Net.Clock.toLocalAudio(spec.net.tStartShared)`;
    `Transport.main.play({countInBars: 0, fromTick: 0, atAudio})` (host and guest alike; the
    host's own `tStartShared` is `hostNow + 2.0` s). Otherwise when `spec.autoStart !== false`
    the mode's auto start runs.

`frame(audioNow, dtMs)` (inside `try`; errors follow Part 4.9 origin rule 2 with
`context.origin = 'frame'`): `tick = Transport.main.positionAt(audioNow)`; `gp.stage.update(
tick, audioNow, dtMs)`; `Animation.Mixer.update(tick, audioNow, dtMs)`; `Input.pollGamepad(
Core.now())`; every 100 ms `UI.HUD.set({progress: clamp(tick / song.durationTicks, 0, 1)})`;
every 1,000 ms the auto-tier check (6.28.4.10). The frame never judges and never schedules
audio (S-01, S-02).

`stopGameplay(reason)`: `Input.releaseAll('mode')` (holds close in the judges first), pump
cleared, every judge `dispose()`, hit voices released (`Instruments.liveNoteOff` at now) and
the `hit` strip disposed, `gp.judges = []`; unless `spec.keepStage`: `Render.stopLoop()`,
`Stage.dispose()`, `Animation.Mixer.dispose()`; `UI.TouchPads.hide()` (tutorial re-shows them
in the next step); `gp = null`.

6.28.4.5 Pause, resume, finish

- `pause(reason)`: requires `gp` and `Transport.main.state()` in `countin`, `playing`; calls
  `Transport.main.pause()`, `setActive(false)` on the live judge, `Input.releaseAll('pause')`,
  `UI.setTextEntryAllowed(true)`, emits `mode.interrupted {mode, cause: reason, action:'paused'}`
  for non-user reasons, pushes `SCR-Pause {reason}` unless it is already on top; multiplayer
  guests do not pause locally: `pause` sends `Net.send('pause', ...)` and waits for the host's
  authoritative pause message (applied by M-24 through the same `Transport.main.pause()`).
  Returns false when nothing was paused.
- `resume()`: when audio is not running -> `Screens.dialog('DLG-ResumeAudio')` and return false
  unless it ends `running`; `Transport.main.resume()`; refresh the live judge time map from
  `Transport.main.anchor()`; `setActive(true)` when the state becomes `playing`;
  `UI.setTextEntryAllowed(false)`. Multiplayer: only the host resumes (sends `resume` with a new
  `tStartShared`).
- Finish: `finishOnce(endedBy)` is called by `transport.state {state:'stopped', reason:'end'}`
  (song end without loop), by the `chart.finished` handler (emitted by M-09 `judge.finish(endedBy)`
  or by M-23, Part 4.4), by the life bar reaching 0 (`endedBy:'fail'`; transport stopped first),
  by the multiplayer host results (`'net'`); the triggers other than the event itself call
  `judge.finish(endedBy)` first, which emits `chart.finished`. It runs
  once per gameplay (`gp.finishing` guard): `judge.tick(Audio.clock().now() + 10)` on the live
  judge (declares every remaining note missed or completed), `summary = judge.summary({songId,
  chartId, startedAt: gp.startedAtIso, durationSec})`, `summary.speed = spec.speed`,
  `summary.comparable = summary.comparable && spec.speed === 1 && !spec.loop &&
  summary.completion === 1` (5.13), `rec = Progress.record(summary, {mode, songTitle,
  instrument, players})`; then `enter('results', {summary, record: rec.record, isBest:
  rec.isBest, previousBest: rec.previousBest, unlocks: gp.unlocksSeen, replay:{mode, params},
  returnTo: params.returnTo, players})` with leave reason `'finished'`. Tutorial gameplay never
  finishes this way: its loop region keeps playing until the screen stops it.

6.28.4.6 Judge time maps, input routing, practice loops

A `PassTimeMap` is a judge's private view of the transport anchor:

```js
class PassTimeMap {
  constructor(tempoMap, a /* Transport.main.anchor() */) { this.tm = tempoMap; this.set(a); }
  set(a) { this.audio = a.audioTime; this.sec = a.songSeconds; this.speed = a.speed; }
  audioTimeAt(tick) { return this.audio + (this.tm.ticksToSeconds(tick) - this.sec) / this.speed; }
  tickAt(t) { return this.tm.secondsToTicks(this.sec + (t - this.audio) * this.speed); }
}
```

- `createPassJudge()`: `map = new PassTimeMap(Transport.main.tempoMap(), Transport.main.anchor())`;
  `judge = Rhythm.Judge.bind({timeMap: map, strayPenalty})` (dance: `Dance.DanceJudge`), `load`,
  `setCalibration`, `setWindows`; push `{judge, map, from: map.audio, to: Infinity}`. The judge is
  not attached to `input.event`; M-28 routes.
- Map refresh: on `transport.state` (to `playing` or `recording`), `transport.seek` and
  `transport.speed`, the live judge's `map.set(Transport.main.anchor())`. Closed pass judges keep
  their frozen map.
- Input routing (one listener): for `lane*`/`dance*` controls, `j = gp.judges.find(e => evt.tAudio
  >= e.from && evt.tAudio < e.to) or the live judge`; `j.judge.onInput(evt)`. Releases are routed
  to the judge that received the matching press (kept in a per-control map) so a hold that
  crosses a loop wrap is closed by the judge that opened it.
- Practice loops (`spec.loop` set): on `transport.loop {a, b, pass, atAudioTime}` the live entry
  gets `to = atAudioTime`; a new pass judge is created whose map anchors at `{audioTime:
  atAudioTime, songSeconds: tm.ticksToSeconds(a), speed}` (the exact wrap computed by M-04, so the
  frozen and new maps meet without rounding error); the old judge keeps judging inputs before
  `atAudioTime` and its remaining notes are declared by the pump after `atAudioTime + good/1000`;
  then its state is pushed to `gp.passes` (`{index, judged, accuracy}`) and it is disposed.
  Speed-up: when `spec.speedUp` and the finished pass has `judged === total` and `accuracy >= 0.9`,
  `Transport.main.setSpeed(min(1.0, round2(speed + 0.05)))` at the next wrap. Results of a loop
  session report the last complete pass and are never comparable.
- Restart (`restart(changes)`): `stopGameplay('restart')` with `keepStage:true`, then
  `startGameplay({...spec, ...changes, keepStage:true})`: a fresh judge and fresh score (P 5.2).

6.28.4.7 Hit sounds and target-track policy (5.9.2, I 6.3)

- `mute`: the chart's source track strip is muted; `lower`: its gain is multiplied by 0.35
  (-9.1 dB); `full`: unchanged. Other tracks' strips: gain multiplied by
  `accompanimentVolume`; `soloTrackId` sets that strip solo (solo-set semantics of M-05).
  Applied through `Audio.createStrip(trackId).setGain/setMute/setSolo` after `Scheduler.bind`.
- Hit strip: for instrument gameplay with `targetTrackMode !== 'full'`, `Audio.createStrip('hit')`
  and `Instruments.program('hit', instrumentOverride ?? chart.instrument)` (128 = drum kit).
  On `judge.result` with `holdPhase !== 'tail'` and judgment not `miss`: `vel =
  gp.velocityByNote.get(noteId)` (mean source velocity of the note's `sourceEventIds`, built
  at chart load), for each pitch `Instruments.liveNoteOn('hit', pitch, vel, now)`; release at
  `now + min(4.0, seconds(durTicks))` for taps, at the tail result or hold break for holds.
  Misses play nothing. Dance plays no hit sounds (all tracks at full level).

6.28.4.8 Previews (library, import)

`preview(songOrId, {fromTick, durationS = 15})`: requires audio (DLG-AudioBlocked flow);
`stopPreview()` first; `song = typeof songOrId === 'string' ? Catalog.getSong(songOrId) :
songOrId`; `Transport.main.load(song)`; `Audio.Scheduler.bind(Transport.main, song, {master})`;
`seek(fromTick ?? second section start ?? 0)`; `play({countInBars:0})`; `preview.timer =
Core.timers.setTimeout(stopPreview, durationS * 1000, current.owner)`. `stopPreview()`:
`Transport.main.stop()`, `Audio.panic(false)`, `Audio.Scheduler.unbind()`,
`Transport.main.unload()`, timer cleared. Only one preview exists at a time.

6.28.4.9 Interruption handling (full table; 4.7.4 is the summary)

| Event (listener) | Gameplay modes | Live modes (freeplay, studio) | Panel modes | Preview running |
|---|---|---|---|---|
| `document` `visibilitychange` -> hidden | `pause('hidden')` (reason text "Paused because the game went to the background"); `Input.releaseAll('system')` | `Input.releaseAll('system')`; Studio recording -> `Studio.Recorder.stop()` (take kept); Free Play recording -> stop and keep; transport continues | nothing | `stopPreview()` |
| `visibilitychange` -> visible | stay paused; if `audio.state !== 'running'` -> DLG-ResumeAudio | `r = Transport.main.onVisible(audioNow, perfNow)`; `r.drifted` (> 5 ms) is logged and re-anchored by M-04; audio not running -> DLG-ResumeAudio | nothing | nothing |
| `window` `pagehide` and `document` `freeze` | as hidden, plus `Screens.Settings.flush()` and the synchronous recovery write: if `Project.current()` is dirty and no recording is active and `Project.estimateSize <= 2 MB` -> `Storage.set('recovery', {projectId, savedAt, text: Project.serialize(p)})` | same | settings flush and recovery write | stop |
| `window` `blur` | when the transport is `playing` or `countin`: `pause('blur')` ("Paused because the window lost focus"); M-07 releases keys | M-07 releases keys; playback continues | nothing | nothing |
| `audio.state` leaves `running` | `pause('audio')`; DLG-ResumeAudio when the page is visible | `Transport.main.pause()` (playback only); recording -> `Recorder.stop()` (take kept, E 5.1); DLG-ResumeAudio | nothing | `stopPreview()` |
| `audio.unlocked` after a rebuild | input anchors are re-sampled by M-07; the live judge map refreshes on the next play | same | nothing | nothing |
| `ui.layout` | `UI.TouchPads.layout()`, `Render.resize()`, `gp.stage.resize()`; rotate recommendation: when `REQUIREMENTS[mode].landscape` and the layout is compact portrait, show `#rotate` once per mode enter (dismiss button hides it; never blocks) | relayout | nothing | nothing |
| `input.device {source:'gamepad', connected:false}` | if the disconnect released held gamepad controls -> `pause('gamepad')` ("Controller disconnected") | released by M-07 | nothing | nothing |
| `render.contextLost` | HUD note "Graphics paused"; transport and judging continue (S-15); M-18 falls back to Abstract after 3 s without restore | same | same | nothing |
| `render.contextRestored` | clear the HUD note; M-21 rebuilds from CPU descriptions | same | same | nothing |
| memory heuristic (checked every 5 s while a stage loop runs: `performance.memory.usedJSHeapSize > 0.8 * jsHeapSizeLimit`) or 2 `sched.stall` with `gapMs > 500` within 10 s | downgrade one tier (`Render.setTier(lower, 'auto')`), toast `text('tier.memory')` "Reduced visual quality to keep audio stable" | same | nothing | nothing |
| `sched.stall` with `gapMs > 500` while `playing` | `pause('stall')` ("Playback stalled") | log only (the scheduler catch-up rule applies) | n/a | nothing |
| `net.state` `ended` or `error` | multiplayer playing: `finishOnce('net')` with the host's last results; lobby: DLG-NetError then `leave('net')` | n/a | n/a | n/a |
| `window` `offline` | multiplayer: toast "Network connection lost"; reconnection is M-24's | nothing | nothing | nothing |
| `error` with class `returnToMenu` | `leave('error')` then `Screens.showError(record)` | same | same | same |

Each handled row emits `mode.interrupted {mode, cause, action}`. Listeners for `document`
and `window` events are installed once by `init()` with `MODES_OWNER` (part of the menu
baseline) and dispatch by the current mode.

6.28.4.10 Auto tier

The auto-downgrade check is owned by M-18 (ADR-03 decision 4, Part 9.3.4, 6.18): it runs on the
renderer's own stats tick and calls its own `setTier(next lower, 'auto')`. M-28 only calls
`Render.holdAutoTier(3000)` at every mode enter, `Render.setAutoTier(false)` when the tier is
fixed by `?tier=` or by the setting `video.tier` other than `auto`, and reacts to
`render.tier {reason:'auto'}` with the toast `text('tier.auto')` once per mode. No automatic
upgrade during the page life (a device that needed a downgrade keeps it; the user can raise
it in Settings). The check uses frame statistics only and never touches audio or the
transport.

6.28.4.11 `baseline()`, `counters()`, `assertClean()`

```js
function counters() {
  const r = Render.counters();
  return {
    activeVoices: Audio.VoiceAllocator.activeCount(),
    schedulerRunning: Audio.Scheduler.running(), schedulerPending: Audio.Scheduler.pending(),
    strips: Audio.stripCount(), audioNodes: Audio.nodeCount(),
    transportState: Transport.main.state(), transportSong: Transport.main.song() !== null,
    timers: Core.timers.count(), rafHandles: Core.raf.count(), loopRunning: Render.loopRunning(),
    busListeners: Core.bus.listenerCount(), domListeners: Core.dom.count(),
    glBuffers: r.buffers, glTextures: r.textures, glPrograms: r.programs, glVaos: r.vaos,
    sceneNodes: Render.renderer() ? Render.renderer().scene.count() : 0,
    openDialogs: UI.dialogCount(), screenDepth: UI.Screens.depth(),
    hudHidden: document.getElementById('hud').hidden, touchHidden: document.getElementById('touch').hidden,
    heldControls: Input.held().length, boundSurfaces: Input.boundSurfaces(),
    recorderState: Studio.Recorder.state(), netConnections: Net.connectionCount(),
    audioBuffers: Import.audioBufferCount(),
    undoDepth: Project.current() ? Project.current().history.undoStack.counts().undo : 0,
    heapMB: Caps.performanceMemory ? performance.memory.usedJSHeapSize / 1048576 : null
  };
}
function assertClean(opts) {
  const c = counters(), b = baselineSnap || c, bad = {};
  const want = {
    activeVoices: 0, schedulerRunning: false, schedulerPending: 0, strips: b.strips, audioNodes: b.audioNodes,
    transportState: 'stopped', transportSong: false, timers: b.timers, rafHandles: 0, loopRunning: false,
    busListeners: b.busListeners, domListeners: b.domListeners, glBuffers: b.glBuffers, glTextures: b.glTextures,
    glPrograms: b.glPrograms, glVaos: b.glVaos, sceneNodes: 0, openDialogs: 0, screenDepth: 1,
    hudHidden: true, touchHidden: true, heldControls: 0, boundSurfaces: b.boundSurfaces, recorderState: 'idle',
    netConnections: netExempt(opts) ? c.netConnections : 0,
    audioBuffers: Project.current() ? Project.current().audioTrackCount() : 0
  };
  for (const k of Object.keys(want)) if (!(opts && opts.exempt || []).includes(k) && c[k] !== want[k])
    bad[k] = {expected: want[k], actual: c[k]};
  return Object.keys(bad).length ? bad : null;
}
// netExempt: leaving 'multiplayer' with next 'results', or leaving 'results' with next 'multiplayer'
// while Net.connectionCount() === 1 (the kept session).
```

`undoDepth` and `heapMB` are recorded in the leave payload (`mode.leave` carries the leak
object only; the counters are in the log at debug level) and never asserted per leave; the
20-cycle integration test asserts heap growth <= 10 MB. `assertClean()` called while a
non-menu mode is active compares against the same expectations (tests use it after `leave`).

6.28.4.12 Browser back and last session

`init()` installs `window` `popstate` -> `UI.Screens.onPopState(event.state)`; M-26 decides
(6.26.4.2). Gameplay screens answer `'handled'` with `pause('user')` (6.27.4.1 rule 5), so a
browser Back during a song pauses instead of leaving. `writeLastSession(mode, p)` writes
`flm.v1.lastSession = {mode, projectId, songId, at}` through `Storage.set` for the modes
`quickplay`, `instrument`, `dance`, `studio` (SCR-MainMenu's Continue card).

#### 6.28.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| A setup step throws (song missing, chart fails, stage build fails) | try/catch in `doEnter` | menu; project in memory | user retries from the menu | no | DLG-Unsupported "Returned to the menu" with E-MODE-002 text | none | full leave sequence | UT-28-05 |
| A leave step throws | per-step try/catch (E-MODE-003) | remaining steps still run | n/a | no (autosave step still runs) | log; leak report if counters differ | none | menu | UT-28-06 |
| Stuck voices after soft panic | `activeCount() > 0` after 350 ms | transport stopped | n/a | no | log E-AUD-006 | hard panic rebuild | voices 0 | UT-28-03 |
| Leaked resource after leave | `assertClean` non-null | app usable | n/a | no | E-MODE-001 in log and diagnostics | none | next leave re-checks | UT-28-07 |
| Audio blocked when a mode needs it | `Audio.isUnlocked()` false | menu | DLG-AudioBlocked | no | dialog | none | stays in menu on cancel (E-AUD-002) | UT-28-08 |
| Audio interrupted during play | `audio.state` | transport paused at the tick | DLG-ResumeAudio | no (take kept when recording) | dialog and SCR-Pause | none | resume | UT-28-10 |
| Rendering context lost | `render.contextLost` | transport, judging | M-18 restore | no | HUD note | Abstract after 3 s | restore or Abstract | UT-28-12 |
| Frame callback throws | Render wrapper report origin 'frame' | transport, judging (pump is a timer) | next frame | no | toast after the first; returnToMenu after 3 in 10 s (Part 4.9) | skipped frames | leave | UT-28-13 |
| Two transitions requested at once | queue | first completes, second runs after | n/a | no | none | n/a | serialized | UT-28-04 |
| Multiplayer chart hash mismatch | settingsHash compare | lobby | host reselects | no | DLG-NetError with E-NET-005 text | n/a | lobby | UT-28-16 |
| Autosave on leave fails | `project.saveFailed` | project in memory | DLG-SaveFailed actions | unsaved changes | DLG-SaveFailed on the menu | export | successful save | UT-28-15 |

#### 6.28.6 Limits and performance notes

- Leave <= 400 ms on desktop including the 350 ms voice wait (skipped when no voice is active
  after the soft panic, the common case); enter of a gameplay mode <= 300 ms excluding chart
  generation of a large imported track (generation yields every 20,000 source events).
- The judge pump runs at 20 Hz; each tick is O(due notes). Input routing is O(number of pass
  judges), at most 2.
- Chart cache: at most 64 charts per page life (oldest evicted), about 72 bytes per chart note
  (5.8 estimate).
- Interruption listeners are installed once; per-mode subscriptions use the mode owner.

#### 6.28.7 Spec coverage

B 6.3, B 7.1-7.7 (mode transitions without the studio, play-along, practice), B 9.2 (pause and
resume without drift: re-anchoring, no frame time), B 9.3 (calibration applied once, in the
Judge), B 12.7 (render fallback without touching audio), B 20.3 (resource release on mode
change), B 21.4 (interruptions: calls, lock, backgrounding, audio suspension, orientation,
memory pressure), B 24 (recoverable versus returnToMenu), B 26.2-26.4, E 2.1 (no duplicate
engines, repeated start and stop), E 2.2 (frame stalls, background throttling), E 4.1 (focus
loss, pause, device disconnect), E 5.1 (recording interruption keeps takes), E 6.2 (scene
switching releases resources), E 7 (hold across pause, touch interrupted), E 10 items 1, 2,
13, E 11 (mode transition returns to a valid state), E 13 (stuck notes after mode change are
release blocking), I 1.1, I 1.3, I 6.3 (practice loop, speed-up, mute or lower target), I 12
(protection against accidental navigation), I 13 (resource cleanup, panic), I 17 (mode
transition cleanup gate), P 3 (no duplicate listeners, back behavior), P 5.2 (pause registers
no notes, restart has fresh state), P 7.3, P 14 (background return), P 17 (no leaks).

#### 6.28.8 Unit tests (group `modes`, file `src/91-test-modes.js`)

Setup: test build with the Abstract tier forced (`Render.setTier('Abstract', 'url')`),
`OfflineAudioContext`-backed engine where audio output matters, `FakeClock`-driven transport
where timing matters; built-in song `tut-basics` (short) unless stated.

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-28-01 | enter and leave freeplay is clean | menu -> enter freeplay -> leave | `assertClean()` null; `mode.enter` and `mode.leave` emitted once each; `leaks` null |
| UT-28-02 | 20 cycles per gameplay mode | for quickplay (instrument chart), dance, tutorial: 20 x (enter, play 0.5 s of fake time, leave) | every leave clean; `busListeners`, `domListeners`, `timers`, GL counters equal to the baseline after each cycle |
| UT-28-03 | leave with a held note | instrument mode playing, lane0 held with hit sound active | after leave `activeVoices === 0` within 350 ms; `audio.panic` soft emitted; hard panic only when a voice survives (stub forcing one) |
| UT-28-04 | transitions serialize | call `enter('settings')` and `enter('help')` without awaiting | final mode help; settings entered and left exactly once; no overlapping `transitioning` |
| UT-28-05 | enter failure returns to menu | stub ChartGenerator to throw | result `{ok:false, mode:'menu'}`; E-MODE-002 recorded; DLG-Unsupported shown; assertClean null |
| UT-28-06 | leave step failure continues | stub Stage.dispose to throw | E-MODE-003 with step 'stage'; later steps ran (HUD hidden, screen depth 1) |
| UT-28-07 | assertClean detects leaks | after leave, create a timer and a bus listener with a foreign owner | assertClean reports `timers` and `busListeners` with expected and actual |
| UT-28-08 | audio blocked gate | `Audio.isUnlocked` false; dialog resolves 'cancel' | enter resolves `{ok:false}`; E-AUD-002; mode menu; with 'enabled' the mode is entered |
| UT-28-09 | visibility hidden pauses gameplay | instrument playing; dispatch hidden | transport paused; SCR-Pause on top with the background reason; `mode.interrupted {cause:'hidden', action:'paused'}`; `Input.held()` empty |
| UT-28-10 | live mode continues when hidden | freeplay playing metronome; hidden then visible with injected drift 8 ms | transport still playing; `onVisible` called and drift logged |
| UT-28-11 | gamepad disconnect pauses only when held | dance playing; disconnect with and without a held gamepad control | paused with reason gamepad only in the held case |
| UT-28-12 | context loss keeps transport | inject render.contextLoss during playback | transport state unchanged; HUD note "Graphics paused"; sched.noteOn keeps arriving |
| UT-28-13 | frame errors escalate | inject error.throw origin frame 3 times in 10 s | first two recoverable; third causes leave('error') to menu |
| UT-28-14 | finish runs once | emit transport end and chart.finished together | exactly one `Progress.record` call and one enter('results'); summary comparable false when speed 0.9 |
| UT-28-15 | autosave on leave from studio | dirty project; fake storage | `Storage.autosave` called once with the project; clean project -> not called |
| UT-28-16 | multiplayer hash mismatch | startGameplay with net.settingsHash 'deadbeef' | rejects with E-NET-005; lobby state kept (no transport play) |
| UT-28-17 | practice loop per-pass judging | loop bars 1-2 of tut-basics, fake inputs perfect on pass 1, none on pass 2 | `gameplayState().passes` = [{accuracy 1}, {accuracy 0}]; a press just before the wrap is judged by pass 1; speed-up raises speed by 0.05 after pass 1 only when enabled |
| UT-28-18 | target track policy | lower mode, accompaniment 0.5 | source strip gain x0.35, others x0.5; hit strip program equals chart instrument; a perfect head triggers liveNoteOn for every pitch; a miss triggers none |
| UT-28-19 | browser back pauses gameplay | history on; instrument playing; onPopState({depth:1}) | mode unchanged, transport paused, SCR-Pause pushed, history re-pushed |
| UT-28-20 | auto tier | enter a mode (stub `Render.holdAutoTier`); emit `render.tier {reason:'auto'}` twice; then enter with `video.tier` 'high' | `holdAutoTier(3000)` called at each enter; one toast per mode for the two events; `setAutoTier(false)` when the tier is fixed |
| UT-28-21 | netConnections exemption | fake Net with one connection; leave multiplayer next results; leave results next multiplayer | assertClean null in both; leave to menu with a connection reports `netConnections` |
| UT-28-22 | dance difficulty change only while stopped | dance mode bound; request a difficulty change while `playing`, while `paused`, then while `stopped` | refused (state unchanged) while playing and paused; while stopped the chart is regenerated and `DanceJudge.bind` is called exactly once |

#### 6.28.9 Implementation notes and browser quirks

- `pagehide` is the only reliable last event on iOS Safari (`beforeunload` is not fired);
  `freeze` exists only in Chromium. Neither allows async work, hence the synchronous recovery
  write to localStorage; IndexedDB autosave runs only in `leave`.
- `visibilitychange` to hidden also fires on screen lock and app switch on mobile (B 21.4); an
  incoming call on iOS additionally interrupts the AudioContext (`audio.state` 'interrupted'),
  which the audio row handles.
- After a long background period the audio clock may have advanced while timers were
  throttled; gameplay is paused so nothing is judged late, and live modes rely on the
  scheduler catch-up rule of M-05 plus `onVisible` drift handling.
- The rotate recommendation uses `#rotate` (static DOM of Part 3.2.5); dismissing it adds a
  per-mode flag only (not persisted), so the next song can recommend again.

Calls into lower modules. Every Part 6 section uses the Part 4.1 member names and the Part 4.4
topic names (the names that differed between the parallel drafts were renamed in the lower
sections; no aliases are exported). Notes:

1. M-01 `Core.define` signature: 06a gives `define(name, factory(FLM))` and records `{name,
   order}`; this part relies only on that.
2. `settings.changed` is emitted by M-16 (`Storage.loadSettings` and `Storage.saveSettings`)
   with the Part 4.4 payload `{key, value, prev, source, keys?}`; `FLM.Screens.Settings` (M-27)
   normalizes, debounces and calls `Storage.saveSettings`. Lower modules subscribe through the
   bus as Part 4.4 lists.
3. Characters edited in SCR-Characters reach the project only through the undoable
   `Project.Commands.setCharacter`; the user roster is a document stored with `Storage.get` and
   `Storage.set('characters', ...)` (`flm.v1.characters`, 5.15).

### 6.29 M-29 Boot (`src/29-boot.js`, `FLM.Boot`)

#### 6.29.1 Responsibilities and non-goals

Responsibilities: the initialization order of Part 4.3 (Phase A registration, Phase B
`start()`), the capability gate with its decision table and messages, the boot progress
panel, the audio unlock gesture for returning users, the first-launch versus returning-user
branch, URL parameters (`?test`, `?tier=`, `?diag`, `?online=`, `?perf`), boot-time error
escalation to `#fatal`, the global surface `window.FLM` members `diagnostics`, `debug`,
`selfTest`, `selfTestReady` (Part 4.8), and the fault-injection dispatcher behind
`FLM.debug.inject`.

Non-goals: no screen content (SCR-FirstLaunch is M-27), no mode logic (M-28), no capability
probing (M-01 `Caps`), no settings normalization (M-27 `Settings`).

#### 6.29.2 Public API

```js
FLM.Core.define('Boot', function (FLM) {
  // Load-time side effect (Part 4.2 corollary 3): one DOMContentLoaded listener, or
  // Core.timers.setTimeout(start, 0) when document.readyState is not 'loading'.
  return Object.freeze({
    /** Phase B. Runs once; a second call returns the same promise. Never rejects: hard failures
     *  end in #fatal and resolve {ok:false, code}. */
    start() /* -> Promise<{ok:boolean, ms:number, tier:string, firstLaunch:boolean, code?:string}> */ {},
    /** Recorded boot steps in order: [{stage:'B1', name, ms, ok}] (copy). */
    stage() /* -> Array */ {},
    /** Resolves with the start() result once boot.ready was emitted. */
    ready() /* -> Promise<object> */ {},
    /** Capability gate rows (frozen) and the evaluated result after B4. */
    GATE: /* [{id, test:(caps)=>boolean, hard:boolean, code:string|null, reason:string, affects:string[]}] */ [],
    gateResult() /* -> {hard:[row], soft:[row], degraded:[id]} */ {},
    /** Pure: evaluate the gate against a caps object (tests pass synthetic caps). */
    evaluateGate(caps) /* -> {hard, soft, degraded} */ {},
    /** Pure: parse a search string. */
    parseUrlParams(search /* '?a=b' */) /* -> {test:boolean, tier:string|null, diag:boolean, online:string|null, perf:boolean, warnings:string[]} */ {},
    /** Applies parsed parameters (B2). */
    applyUrlParams(parsed) /* -> void */ {},
    /** Pure: which screen boot lands on. */
    landing(settingsDoc, parsed) /* -> {mode:'menu', screen:'SCR-FirstLaunch'|'SCR-MainMenu', banner:boolean} */ {},
    /** Defines FLM.diagnostics, FLM.debug, FLM.selfTestReady, and FLM.selfTest when FLM.SelfTest exists. */
    installSurface() /* -> void */ {},
    /** The fault dispatcher used by FLM.debug.inject and FLM.debug.clear. */
    inject(fault, args) /* -> boolean */ {}, clear(fault) /* -> void */ {},
    FAULT_ROUTES: /* frozen {prefix: namespace} */ {}
  });
});
```

Events emitted: `boot.stage {stage, index, total, ms}` per step, `boot.ready {ms, tier,
firstLaunch, degraded}` once. Events consumed: `error` during boot (escalation, 6.29.4.4),
`audio.unlocked` (hide the banner, remove the one-shot gesture listener).

#### 6.29.3 Internal state

`started:Promise|null`, `stages:[]`, `gate:{hard, soft, degraded}|null`, `params` (parsed URL
parameters), `bootDone:false`, `gestureOff:function|null` (disposer of the one-shot unlock
listener), `faults: Map<name, args>` (active injected faults, for `clear` and diagnostics).

#### 6.29.4 Algorithms

6.29.4.1 Phase A (script evaluation, Part 4.3 A1-A5)

A1 is M-01. A2: M-02 to M-28 define themselves. A3: `29-boot.js` defines `FLM.Boot`, sets
`FLM.selfTestReady = false`, defines `FLM.diagnostics` and `FLM.debug` early (so they work
even when Phase B fails), and registers the start trigger. A4: `30-content.js` registers the
catalog and presets. A5 (test build): `90-selftest.js` and the test files register groups.
Because M-31 loads after M-29, `FLM.selfTest` is installed in Phase B step B13 (it exists only
when `FLM.SelfTest` was defined, i.e. in the test build; ADR-11: the shipped build has no
`selfTest` property at all).

6.29.4.2 Phase B `start()`

| Step | Action | Branch or failure | Budget (desktop) |
|---|---|---|---|
| B1 | `t0 = Core.now()`; show the boot progress panel when B1-B8 take > 300 ms (a `div.boot-progress` in `#overlay`, created with `document.createElement` and `textContent`, four labels "Storage", "Settings", "Sound", "Graphics", each marked done as its step completes; no percentage); verify `FLM.Core.modules()` contains Theory, Model, Transport, Audio, Instruments, Input, Mapping, Rhythm, Midi, Zip, MusicXml, GuitarPro, Import, Project, Storage, Studio, Render, Rig, Animation, Stage, Character, Dance, Net, Progress, UI, Screens, Modes | missing -> `ErrorReporter.fatal('E-GEN-001', null, {module})` with "A part of the game failed to load: <name>. Reload the page."; resolve `{ok:false}` | 1 ms |
| B2 | `params = parseUrlParams(location.search)`; `applyUrlParams(params)` | warnings logged | 1 ms |
| B3 | `caps = Caps.refresh()` (the load-time report is reused when already computed) | none | 20 ms |
| B4 | `gate = evaluateGate(caps)`; any hard row -> `ErrorReporter.fatal(row.code, null, {cap: row.id})` with `row.reason`; resolve `{ok:false, code}` | soft rows -> `gate.degraded` ids, shown by SCR-FirstLaunch step 2 and as disabled reasons | 1 ms |
| B5 | `status = await Storage.open()` (never rejects; 2,000 ms probe) | localOnly or memory modes produce notices (6.16) | 100 ms |
| B6 | `Screens.Settings.load()`; `UI.init({settings: Settings.all(), caps})`; `UI.setReducedMotion`, `setHighContrast`, `Layout.setScale` from settings; `Input.setMap` from `input.keys.*`; `body.classList.toggle('touch', caps.maxTouchPoints > 0)` | damaged settings -> defaults (M-27) | 10 ms |
| B7 | `Audio.init({mobile: Caps.isMobile(), polyphony: settings audio.polyphonyCap})` (context created suspended or lazily per 6.5); `Transport.main.setClock(Audio.clock())` | throw -> `fatal('E-AUD-001')` "Audio could not start in this browser" | 30 ms |
| B8 | `Render.init(document.getElementById('view'), document.getElementById('flat'), params.tier or settings video.tier or Render.pickTier(caps))` | WebGL2 -> WebGL1 -> Abstract inside M-18; never fatal | 150 ms |
| B9 | `Input.init()` / 6.7 `attach({keyboardTarget: window, padRoot: #touch, surface: #view})` once for the page; context `menu` | none | 5 ms |
| B10 | `Modes.init()`; `UI.Screens.setHistory(!params.test)` | none | 5 ms |
| B11 | `Screens.register()` | none | 5 ms |
| B12 | `Project.Catalog.list().length >= 5` else `Log.warn('boot', 'catalog incomplete')` | continue | 1 ms |
| B13 | test build (`FLM.SelfTest` defined): `FLM.selfTest = (groups, opts) => FLM.SelfTest.run(groups, opts)`; when `params.test`: `await Audio.unlock()` without a gesture (the headless flag `--autoplay-policy=no-user-gesture-required` allows it; a failure is logged, tests that need audio then use `OfflineAudioContext`) | none | n/a |
| B14 | `land = landing(Settings.all(), params)`; `await Modes.enter('menu', {screen: land.screen})`; remove the boot progress panel | SCR-FirstLaunch when `onboarding.firstLaunchDone === false` and not `params.test`; else SCR-MainMenu | 50 ms |
| B15 | returning users with `!Audio.isUnlocked()`: install the one-shot unlock gesture (6.29.4.3) | none | gesture-driven |
| B16 | `bootDone = true`; when the test build: `FLM.selfTestReady = true`; emit `boot.ready {ms: Core.now() - t0, tier: Render.tier(), firstLaunch: land.screen === 'SCR-FirstLaunch', degraded: gate.degraded}`; `params.diag` -> `FLM.debug.showStats = true` | none | 0 |

Every step records `{stage, name, ms, ok}` and emits `boot.stage {stage, index, total:16,
ms}`. The total must satisfy load-to-menu <= 1.5 s desktop and <= 3.0 s mobile (BRIEF 6; the
B5 worst case of 2,000 ms is the only step allowed to exceed its budget, and only when
IndexedDB hangs). Note: with `?test` the boot enters the menu like a normal returning user
(so `Modes.baseline()` is taken in the menu) but skips SCR-FirstLaunch, the unlock banner and
history integration.

6.29.4.3 Audio unlock for returning users

`gestureOff = Core.dom.on(document.getElementById('overlay'), 'pointerdown', onGesture,
{capture:true}, BOOT_OWNER)` plus the same for `keydown` on `window`. `onGesture(e)`: for
`keydown`, ignore modifier-only keys and `Tab` (keyboard navigation must not be hijacked
before the user chose something) - every other key counts; call `Audio.unlock()` synchronously
in the handler (no `await` before it); on `audio.unlocked` remove both listeners and hide the
banner (M-27 SCR-MainMenu). The unlock is attempted at most once per gesture; while still
locked, choosing a gameplay entry opens DLG-AudioBlocked (M-28), whose button is itself a
gesture. The SCR-FirstLaunch "Start sound" button is the unlock gesture on first launch, and
Boot does not install the listener while SCR-FirstLaunch is shown.

6.29.4.4 Global error handling during boot

M-01 owns `window.onerror`, `unhandledrejection` and `#fatal`. Boot adds the Part 4.9 origin
rule 1: until `boot.ready`, Boot subscribes to `error` and, for any record whose class is not
`reload`, calls `ErrorReporter.fatal(record.code, null, {escalatedBy:'boot', original:
record.id})` (an error during startup means the page state cannot be trusted). After
`boot.ready` the subscription is removed. `#fatal` buttons: Reload (`location.reload()`, wired
by the shell) and Copy diagnostics (wired by M-01 with `Diagnostics.export()`); M-29 adds
nothing to `#fatal` except through M-01.

6.29.4.5 Capability gate (`GATE`, evaluated at B4; texts are Part 4.3 and Part 7.11)

| id | Test on caps | Class | Code | Reason (user text) | Affects |
|---|---|---|---|---|---|
| canvas2d | 2D context available | hard | E-CAP-002 | "This browser cannot draw graphics." | everything |
| audio | `audioContext` | hard | E-CAP-001 | "This browser has no Web Audio support, so nothing could play." | everything |
| raf | `typeof requestAnimationFrame === 'function'` | hard | E-CAP-003 | "This browser is missing animation support." | everything |
| webgl2 | `webgl2` | soft | none | "Advanced 3D unavailable; using simpler graphics." | High tier |
| webgl | `webgl2 or webgl1` | soft | none | "3D stage unavailable in this browser; using the flat visualizer." | 3D tiers |
| pointer | `pointerEvents` | soft | none | none shown (Touch Events path, OQ-1) | touch input |
| touch4 | `maxTouchPoints === 0 or maxTouchPoints >= 4` | soft | none | "This device reports fewer than 4 simultaneous touches." | four-pad chords on touch |
| gamepad | `gamepad` | soft | none | "Gamepad input is not available in this browser." | gamepad |
| midi | `webMidi` (includes `secureContext`) | soft | none | "Web MIDI needs a secure context and a supporting browser." | MIDI input |
| localStorage | `localStorage` | soft | none | "Settings and projects cannot be saved in this browser mode. Use Export." | saving |
| indexedDB | `indexedDB` | soft | none | "Large projects cannot be stored; projects are limited to 2 MB. Use Export for backups." | large projects |
| offline | `offlineAudioContext` | soft | none | "WAV export is not available in this browser." | WAV export |
| mediaRecorder | `mediaRecorder` | soft | none | "Real-time mix recording is not available in this browser." | OQ-2 alternative |
| webrtc | `typeof RTCPeerConnection === 'function'` | soft | none | "This browser has no WebRTC support." | Multiplayer (unless a relay URL is set) |
| visibility | `visibility` | soft | none | none shown (blur only) | interruption detection |
| storageEstimate | `storageEstimate` | soft | none | none shown ("quota: unknown" in Diagnostics) | quota display |
| memory | `performanceMemory` | soft | none | none shown ("memory: not available" in Diagnostics) | memory heuristic |

The 2D-canvas and rAF probes are done by Boot itself at B4 (`document.createElement('canvas')
.getContext('2d')` non-null; the rAF type check) because the M-01 report does not carry them.
`secureContext` and `isFile` are informational (SCR-About). The storage rows are re-evaluated
from `Storage.open()`'s status after B5 (a browser can expose the APIs and still refuse them);
the effective reason comes from `status.notice`.

6.29.4.6 URL parameters

`parseUrlParams(search)` uses `URLSearchParams` (keys case-sensitive, lower-case only):

| Parameter | Accepted | Effect | Invalid |
|---|---|---|---|
| `test` | present (any value) | test mode: no first launch, no banner, no history, audio unlocked without a gesture | n/a |
| `tier` | `high`, `balanced`, `low`, `abstract` (case-insensitive) -> `High`... | forces the initial tier (`reason:'url'`); `video.tier` setting untouched | warning `W-URL-TIER`, ignored |
| `diag` | present | `FLM.debug.enabled = true`; stats overlay on after boot | n/a |
| `online` | `ws://` or `wss://` URL, length <= 256, parsable by `new URL` | `Net.setRelayUrl(url)`; Multiplayer offers the relay; `Settings.set('net.relayUrl', url, 'url')` without persisting (source `url` writes are memory-only) | warning `W-URL-ONLINE`, ignored |
| `perf` | present (test build only) | enables `FLM.SelfTest.perf` hooks (Part 9.7) | ignored in the shipped build |

Unknown parameters are ignored. Parameters are read once at boot; nothing else reads
`location.search`.

6.29.4.7 Public surface

`installSurface()` (A3, completed in B13) defines on `window.FLM` exactly: `diagnostics(opts)`
(returns `JSON.parse(Core.Diagnostics.export({includeContent: !!(opts && opts.includeSong)}).json)`
with the Boot provider `{stages, gate, params}` registered through `Diagnostics.provide`),
`debug` (object of Part 4.8: `enabled` (false unless `?diag` or the test build), `tier` getter
and setter (`Render.tier()`, `Render.setTier(name, 'user')`), `showStats` setter
(`Settings.set('video.showStats', v, 'ui')`), `inject`, `clear`, `log(level)` (`Log.entries()`
filtered), `counters()` (`Modes.counters()`)), `selfTestReady`, and `selfTest` (test build
only). No other global is created.

6.29.4.8 Fault dispatcher

`inject(fault, args)`: returns false unless `FLM.debug.enabled`. Route by the prefix before
the first dot through `FAULT_ROUTES`: `audio` -> `FLM.Audio`, `render` -> `FLM.Render`,
`storage` -> `FLM.Storage`, `net` -> `FLM.Net`, `input` -> `FLM.Input`, `import` ->
`FLM.Import`, `transport` -> `FLM.Transport`, `mode` -> `FLM.Modes`, `error` -> Boot itself.
The target module's `debugInject(fault, args) -> boolean` is called (each module that owns
faults in Part 10.9 implements `debugInject` and `debugClear`); a missing function or a false
result returns false with `Log.warn('fault', 'unsupported', {fault})`. Boot's own faults:
`error.throw {origin:'listener'}` subscribes a one-shot `error`-topic listener that throws;
`{origin:'frame'}` and `{origin:'scheduler'}` are forwarded to `FLM.Modes.debugInject` and
`FLM.Audio.debugInject`. Active faults are kept in `faults` and listed in the diagnostics
provider; `clear(fault)` calls `debugClear` and removes the entry.

#### 6.29.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| A module failed to define | B1 module check | nothing started | reload | no (storage untouched) | `#fatal` with the module name | none | reload | UT-29-04 |
| Hard capability missing | gate | nothing started | n/a | no | `#fatal` with the gate reason | none | other browser | UT-29-03 |
| Storage init slow or failing | 2,000 ms probe | memory or localOnly mode | next boot | yes for new work: notices say Export | main menu notice | Export-only saving | n/a | UT-29-05 |
| AudioContext constructor throws | try/catch at B7 | nothing playable | reload | no | `#fatal` E-AUD-001 | none | reload | UT-29-06 |
| Error before boot.ready | `error` subscription | n/a | reload | no | `#fatal` | none | reload | UT-29-07 |
| Invalid URL parameter | parser | defaults | n/a | no | log warning | none | n/a | UT-29-01 |
| Unlock gesture refused | `unlock()` false | menu | next gesture or DLG-AudioBlocked | no | banner stays | silent menu | user gesture | UT-29-09 |
| Fault injection when not enabled | `debug.enabled` | n/a | n/a | no | none (returns false) | n/a | n/a | UT-29-10 |

#### 6.29.6 Limits and performance notes

- Phase B budget sum: 380 ms desktop excluding gesture waits and the IndexedDB worst case,
  inside the 1.5 s load-to-menu budget together with script parse and evaluation of the
  1.5 MB file; mobile doubles every step.
- Boot creates no RAF and no interval; the only timers are the Storage probe timeout and the
  one-shot `setTimeout(start, 0)`.
- Content expansion is lazy (ADR-14): boot registers catalog entries only.

#### 6.29.7 Spec coverage

B 5.2 (direct file opening; no server), B 6.1 steps 2-4 and 7 (capability check, audio
activation by gesture, rendering capability, unavailable functionality explained without
blocking), B 19.4 (explicit initialization order), B 21.2 (audio activation with a user
gesture), B 24 (unsupported browser capabilities, audio initialization failure, rendering
initialization failure as actionable errors), E 2.1 (initialization attempted once; no
duplicate engines), E 9 (file://, secure context, storage differences, unsupported graphics),
I 11.4 (real progress only), I 14.3 (Standalone and Online editions via `?online`), P 4
(first launch fast, permissions only when required, returning users not forced through
onboarding), P 18 (offline core).

#### 6.29.8 Unit tests (group `boot`, file `src/91-test-boot.js`)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-29-01 | URL parameter parsing | `parseUrlParams('?test&tier=LOW&diag&online=wss://relay.example:8443/flm&x=1')`; then `?tier=ultra&online=http://x` | first: test true, tier 'Low', diag true, online url, no warnings; second: tier null, online null, warnings W-URL-TIER and W-URL-ONLINE |
| UT-29-02 | gate soft rows | synthetic caps without webgl2, webgl1, webMidi | `degraded` contains webgl2, webgl, midi; `hard` empty |
| UT-29-03 | gate hard rows | caps with `audioContext:false` | `hard` contains audio with code E-CAP-001 and the exact reason text |
| UT-29-04 | missing module is fatal | call the B1 check with a module list lacking 'Dance' | `ErrorReporter.fatal` spy called with E-GEN-001 and context module 'Dance' |
| UT-29-05 | storage modes reach the menu notice | Storage.open stub resolving mode 'memory' | notice string passed to SCR-MainMenu; boot continues to B16 |
| UT-29-06 | audio init failure | Audio.init stub throwing | fatal E-AUD-001; start resolves `{ok:false, code:'E-AUD-001'}` |
| UT-29-07 | errors before ready escalate | emit a recoverable error record before boot.ready (test hook `Boot._simulatePhase('booting')`) | fatal called once with escalatedBy 'boot'; after ready a recoverable error does not escalate |
| UT-29-08 | landing branch | `landing({onboarding:{firstLaunchDone:false}}, {test:false})`; then done true; then test true | SCR-FirstLaunch; SCR-MainMenu with banner when audio locked; SCR-MainMenu without banner in test mode |
| UT-29-09 | one-shot unlock gesture | locked audio stub; dispatch keydown Tab, then keydown KeyA, then pointerdown | Tab ignored; KeyA calls unlock once; after audio.unlocked both listeners removed (`Core.dom.count()` back to before) |
| UT-29-10 | debug surface and fault gating | `FLM.debug.enabled = false`; inject('render.contextLoss') | returns false; with enabled true routes to `FLM.Render.debugInject` spy; unknown prefix returns false |
| UT-29-11 | public surface keys | inspect `window.FLM` own keys | exactly the module namespaces of Part 4.8 plus VERSION, BUILD, diagnostics, debug, selfTestReady, selfTest (test build) |
| UT-29-12 | boot stage order | `Boot.stage()` of the running test page | stages B1..B16 in order, each with ok true except B15 skipped in test mode; `boot.ready` ms equals the sum within 5 ms |

#### 6.29.9 Implementation notes and browser quirks

- The script runs after the parser reached the end of `<body>` (the marker sits in the last
  script), so `document.readyState` is usually `interactive`; Boot then starts with
  `Core.timers.setTimeout(start, 0)` rather than waiting for `DOMContentLoaded`, which may
  already have fired.
- On `file://` in Chromium, `localStorage` works per file path; in Firefox it may be shared by
  all `file://` pages; in Safari it may be disabled. The B5 probe result, not the protocol,
  decides the mode (E 9).
- Do not create the `AudioContext` with a `sampleRate` option (iOS rejects mismatched rates);
  M-05 owns the options; Boot only calls `init`.
- `Caps.refresh()` creates probe canvases that M-01 releases; Boot's 2D probe canvas is local
  and released immediately (`canvas.width = 0`).

### 6.30 M-30 Content (`src/30-content.js`, `FLM.Content`)

#### 6.30.1 Responsibilities and non-goals

Responsibilities: the five original demo arrangements of Part 1.7 and the tutorial song
`tut-basics` as compact data in the FLM notation defined here; the deterministic expander
from notation to `Song`; the tutorial step definitions and their authored charts; the eight
character presets; registration of catalog entries into `FLM.Project.Catalog` and presets
into `FLM.Character` at load (Part 4.3 A4).

Non-goals: no charts for the demos (generated by M-08 and M-23 on first use, ADR-14); no
audio; no persistence; no rendering. Content never changes at runtime; all tables are
deep-frozen.

#### 6.30.2 Public API

```js
FLM.Core.define('Content', function (FLM) {
  return Object.freeze({
    VERSION: 1,                     // contentVersion stored with records (ADR-14 decision 6)
    NOTATION: {                     // frozen grammar constants (6.30.4.1)
      VERSION: 1,
      DUR: {w: 3840, h: 1920, q: 960, e: 480, s: 240, t: 120},
      CREATED_AT: '2026-10-23T00:00:00.000Z',
      RPN_BEND_SEMIS: 2
    },
    ARRANGEMENTS: [/* 5 frozen Arrangement records, 6.30.4.6 */],
    TUTORIAL: {/* frozen {arrangement, steps:[7 TutorialStep], lanePitches:[60,64,67,72]} */},
    CHARACTER_PRESETS: [/* 8 frozen CharacterPreset records (5.10), 6.30.4.7 */],

    /** Deterministic: the same arrangement always yields a deep-equal Song (ids included).
     *  Throws Error whose message starts with an E-CNT code (6.30.5). <= 50 ms per song (desktop). */
    expand(arrangement /* Arrangement or id */) /* -> Song */ {},
    /** Tokenizer used by expand and tests. */
    parsePattern(text /* string */) /* -> Token[] */ {},
    /** Authored chart for tutorial steps 1-3 (ChartNotes from the tutorial piano notes of the segment). */
    tutorialChart(stepIndex /* 1..3 */, song /* expanded tut-basics */) /* -> Chart */ {},
    /** Catalog entries for the five demos (registerBuiltin input). */
    list() /* -> CatalogEntry[] */ {},
    /** Counts used by tests and the About screen: {notes, perTrack:{trackId: n}, durationS, ranges:{trackId:{lo, hi}}}. */
    stats(song) /* -> object */ {}
  });
});
```

Events: none emitted, none consumed. Load-time side effect (the only one allowed for M-30):

```js
FLM.Project.Catalog.registerBuiltin(FLM.Content.list());
FLM.Project.Catalog.registerTutorial(Object.assign({}, catalogEntryOf(TUTORIAL.arrangement), {steps: TUTORIAL.steps}));
FLM.Character.registerPresets(FLM.Content.CHARACTER_PRESETS);
```

#### 6.30.3 Internal state

`cache: Map<id, Song>` is not held here (the Catalog caches the expanded song through the
entry's `expand` closure); M-30 keeps only the frozen tables. Invariants: every arrangement
expands without error; every expanded song satisfies `Model.validate(song).ok`.

#### 6.30.4 Algorithms

6.30.4.1 FLM notation version 1

An Arrangement record:

```js
Arrangement {
  id, title, artist: 'Finger Lickin Music', style, contentVersion: 1,
  key: {fifths, mode},                         // KeyMap entry at tick 0
  tempo: [[bar, bpm], ...],                    // 1-based bar, tempo entry at that bar's first tick
  meter: [[bar, numerator, denominator], ...], // 1-based bar
  sections: [{label, bars, h?, p?, dyn?, crash?}],  // h: harmony key (default label), p: part key
                                               // (default label), dyn: velocity offset (default 0),
                                               // crash: false suppresses the section crash
  harmony: {key: 'chord tokens, one per bar'},  // cyclic within the section
  chords: {symbol: {root, q?, <voicingSet>: 'N.N.N', ...}},
  patterns: {id: Pattern},
  drumVel: {gmKey: velocity},
  tracks: [TrackDef],
  cc: [CcDef], pedal: PedalDef|null, bend: {track: index, semis: 2}|null
}
TrackDef { name, program /* omitted for drums */, channel, drums?: true, slot, preset, crash?: true,
           parts: {partKey: PartSpec | null} }      // missing key or null = silent section
PartSpec = patternId                                    // repeated to fill the section
         | [[patternId, bars, transpose?], ...]          // list; repeated when its total divides the section
         | {layers: [PartSpec, PartSpec]}                // simultaneous parts (piano hands, comp + melody)
Pattern  = {step?, vel?, gate?, set?, swing?, notes: 'tokens'}         // melodic
         | {step?: 's'|'e3', grid: {gmKey: 'x.x.'}}                       // drums
CcDef    = {track, sections: [label...] | 'all', controller, shape: 'set'|'ramp'|'beatDip', value?, from?, to?, everyTicks?}
PedalDef = {track, modes: {sectionLabel: 'bar'|'twoBars'|'none'}}
```

Melodic token grammar (tokens separated by spaces; `|` is a bar check):

```text
token    := step [ '/' dur ] [ '!' vel ] [ '~b' ]
step     := 'r'                       rest
          | '_'                       tie: extends the previous sounding event by dur
          | note                      'C4', 'F#3', 'Bb2' (Theory.midiFromName; C4 = 60)
          | '[' note ('.' note)* ']'  explicit chord
          | 'x'                       every note of the current chord's voicing set (pattern.set)
          | '1'..'4'                  the n-th note (ascending) of that voicing
          | 'R' | 'T' | 'F' | 'O' | 'V' | 'A'   bass degrees of the current chord (below)
dur      := 'w'|'h'|'q'|'e'|'s'|'t' [ '.' | '3' ]   (dotted x1.5, triplet x2/3) | integer ticks
vel      := 1..127, absolute: section dyn is NOT applied to this token
'~b'     := bend gesture on a note (6.30.4.4)
```

Defaults: `dur` = `pattern.step` (default `q`), `vel` = `pattern.vel` (default 90), `gate`
0.92, `swing` false. Bass degrees: `R` root (`chords[sym].root`), `T` third (`R + 3` when
`q === 'min'`, else `R + 4`), `F` fifth (`R + 7`), `O` octave (`R + 12`), `V` = `R` when the
chord at this tick differs from the chord one tick earlier (a chord change), else `F`, `A`
chromatic approach = (root of the chord at `tick + dur`) - 1; when that chord is `-` or
missing, `A` = `R`. Chord placeholders in a bar whose harmony token is `-` (no chord)
render as rests.

Drum grids: one string per GM key; character `x` = `drumVel[key]` + dyn, `X` = that + 20,
`g` = 30 (ghost, absolute), `f` = 25 (feathered, absolute), `.` = nothing. Step `s` = 240
ticks (16 per 4/4 bar) or `e3` = 320 ticks (12 per 4/4 bar, 9 per 3/4 bar). Every drum note
has `durTicks = 120`, channel 9.

Harmony tokens: chord symbols from `chords`, `-` for no chord, and `A,B` for two chords
splitting the bar at half its length (`ticksPerBar / 2`; only allowed in 4/4).

6.30.4.2 Expansion algorithm (`expand`)

```js
function expand(arr) {
  // 1. Maps. Meter first (bar -> tick), then tempo entries at those bar ticks.
  const meter = new Model.MeterMap([]);  let tick = 0;  const barTick = [0];  // barTick[b] for 0-based bar b
  const totalBars = sum(arr.sections.map(s => s.bars));
  for (let b = 0, mi = 0, m = arr.meter[0]; b < totalBars; b++) {
    if (mi < arr.meter.length && arr.meter[mi][0] === b + 1) { m = arr.meter[mi++]; meter.set(tick, m[1], m[2]); }
    tick += 960 * 4 / m[2] * m[1]; barTick.push(tick);
  }
  const tempo = new Model.TempoMap(arr.tempo.map(([bar, bpm]) => ({tick: barTick[bar - 1], usPerQuarter: Math.round(60e6 / bpm)})));
  const keys = new Model.KeyMap([{tick: 0, fifths: arr.key.fifths, mode: arr.key.mode}]);
  // 2. Sections -> markers and an index of (startBar, bars, label, h, p, dyn, crash).
  // 3. Song shell with fixed id and timestamps (determinism).
  const song = Model.Song.create({id: arr.id, title: arr.title, artist: arr.artist,
    source: {format: 'builtin', fileName: '', version: 'FLM content ' + arr.contentVersion, warnings: []},
    tempoMap: tempo, meterMap: meter, keyMap: keys, createdAt: CREATED_AT, modifiedAt: CREATED_AT});
  // 4. Tracks in TrackDef order: id 't' + (index + 1).toString(36); lockedSource true; color TRACK_COLORS[index % 16].
  for each TrackDef td (index i): {
    const t = Model.Track.create({id: 't' + (i + 1).toString(36), name: td.name, channel: td.channel,
      program: td.drums ? 0 : td.program, isDrums: !!td.drums, lockedSource: true, color: Model.TRACK_COLORS[i % 16]});
    const notes = [];
    for each section s: renderPart(td.parts[s.p], s, notes, td);       // 6.30.4.3
    if (td.drums && td.crash) for each section s with td.parts[s.p] and s.crash !== false:
      if no note with pitch 49 at barTick[s.startBar] in notes: notes.push(drumNote(barTick[s.startBar], 49, s.dyn));
    events = notes + programEvent(0) (non-drums) + RPN events (bend track) + cc + pedal + bends;
    Model.sortEvents(events);
    // ids: NoteEvents in comparator order get t.id + '.' + (ordinal).toString(36), ordinal from 1.
    t.events = events; Model.touch(t); Model.Song.addTrack(song, t);
  }
  // 5. Markers: one {tick: barTick[s.startBar], label: s.label, kind: 'section'} per section,
  //    plus {tick: barTick[totalBars], label: 'End', kind: 'cue'}.
  // 6. song.durationTicks = Model.Song.computeDuration(song)   (equals barTick[totalBars] because of the End marker)
  // 7. assert Model.validate(song).ok, else throw 'E-CNT-005 ' + first error code
  return song;
}
```

6.30.4.3 Rendering one part

1. `PartSpec` normalization: string -> `[[id, Lp]]` where `Lp` is the pattern length in bars;
   list -> as given; `{layers}` -> render each layer independently over the same section.
   The list total `Lt` must equal the section bars, or divide it (the list repeats);
   otherwise throw `E-CNT-002 <arr.id>/<track>/<section>`. Each entry `[id, bars, tr]` renders
   pattern `id` repeatedly for `bars` bars (the pattern length must divide `bars`, else
   `E-CNT-002`) with transposition `tr` semitones (default 0). The built-in id `rest` renders
   nothing for any length.
2. Melodic pattern rendering from `t0` (absolute start tick): `pos = t0`; for each token:
   `d = dur(token)`; resolve the step at `pos` (chord lookup in the song-level chord timeline
   built once before any track is rendered: for every section, bar `k` of the section takes
   harmony token `k % tokens.length` of `harmony[s.h]`, a split token `A,B` gives chord A for
   `[barStart, barStart + ticksPerBar/2)` and B for the rest, `-` gives no chord; lookups for
   `A` at `tick + dur` may therefore cross into the next section); pitches = resolved notes +
   transposition; sounding length `len = max(1, round(d * gate))` unless the next token is `_`
   (ties make the event sound through `pos + d` plus the tie lengths, with the gate applied
   only to the final segment); velocity = `vel` token (absolute) or `clamp(pattern.vel +
   s.dyn, 1, 127)`; one NoteEvent per pitch `{tick: pos, durTicks: len, pitch, velocity,
   offVelocity: 64, channel: td.channel}`; `pos += d`. A `|` asserts `(pos - t0)` is a whole
   number of bars of the meter in force (`E-CNT-001 <pattern> at token <n>`). At the end of
   the token list `pos - t0` must be a whole number of bars (pattern length `Lp`).
3. Swing (`pattern.swing`): after rendering, for each note: `s2 = s + (s % 960 === 480 ? 160 :
   0)`, `e = s + durTicks`, `e2 = e + (e % 960 === 480 ? 160 : 0)`, `durTicks = max(1, e2 - s2)`,
   `tick = s2` (eighths on the triplet grid at ticks 0 and 640 of each beat, Part 1.7).
4. Drum grid rendering: `stepTicks = 240` or `320`; every grid string length must equal
   `ticksPerBar / stepTicks` (`E-CNT-001` otherwise); character at index `k` -> note at `t0 + k *
   stepTicks`.
5. Pitches outside 0..127 throw `E-CNT-004`; unknown chord symbols, patterns or tokens throw
   `E-CNT-003`.

6.30.4.4 Controllers, pedal, bends

- Program: non-drum tracks get `ProgramEvent {tick:0, program, bankMsb:0, bankLsb:0}`.
- `CcDef` shapes over each listed section `[a, b)`: `set` -> one event `{tick:a, value}`; `ramp`
  -> `n = (b - a) / everyTicks` events at `a + k * everyTicks`, `value = round(from + (to -
  from) * k / (n - 1))`; `beatDip` -> for every beat start `bt` in the section (meter-aware) the
  four events `bt + 0: 40`, `bt + 120: 68`, `bt + 240: 96`, `bt + 360: 127`.
- Pedal (`PedalDef`): per section mode: `bar` -> at every bar start `CC64 = 0`, then when at
  least one note of the track starts in that bar `CC64 = 127` at bar start + 60; `twoBars` ->
  the same on every second bar (offsets 0, 2, 4 within the section) for a two-bar span;
  `none` -> one `CC64 = 0` at the section start. Finally `CC64 = 0` at `durationTicks - 30`.
  Compare order puts the `cc` before notes at the same tick (5.2), so a pedal release at a bar
  start lets the new chord start un-pedaled and the pedal catches it 60 ticks later.
- Bend range: the bend track gets at tick 0 `CC101 = 0`, `CC100 = 0`, `CC6 = semis`, `CC38 = 0`
  (RPN 0).
- Bend gesture `~b` on a note at `s` with sounding length `D`: `bend 0` at `s`; `bend
  round(8191 * k / 4)` at `s + floor(D / 2) + floor(k * D / 8)` for `k = 1..4` (values 2048,
  4096, 6143, 8191 = +2 semitones); `bend 0` at `s + D`.

6.30.4.5 Tutorial chart construction (`tutorialChart(i, song)`)

`seg = TUTORIAL.steps[i - 1].segment` (`{fromBar, bars}`, 0-based bars); piano track `t1` notes
with `tick` in `[tickOfBar(fromBar), tickOfBar(fromBar + bars))` grouped by tick; each group
-> `ChartNote {id: 'c' + (ordinal).toString(36), tick, durTicks: max dur of the group (taps
keep their duration, isHold false), lanes: pitches mapped through lanePitches (60 -> 0, 64 ->
1, 67 -> 2, 72 -> 3) ascending, sourceEventIds: the note ids, pitches}`. Chart: `{id:
'tut-basics:step' + i, songId:'tut-basics', trackId:'t1', instrument:0, difficulty:'beginner',
profile:'A', notes, generatorVersion: Mapping.ChartGenerator.VERSION, settingsHash:
hex8(fnv1a32('tutorial|' + i)), omittedSourceEventIds: 0, source:'imported'}` (authored, never
persisted; see the open issue on 5.9.1 `source`).

6.30.4.6 The five arrangements and the tutorial song (normative data)

Lengths: `demo-poprock` 48 bars at 120 BPM = 96.0 s; `demo-piano` 32 bars, bars 1-28 at 76
BPM, bars 29-32 at 73, 70, 67, 64 BPM = 102.47 s; `demo-electro` 44 bars at 110 BPM = 96.0 s;
`demo-jazz` 48 bars of 4/4 and 16 bars of 3/4 at 150 BPM = 96.0 s; `demo-dance` 60 bars at
128 BPM = 112.5 s; `tut-basics` 16 bars at 100 BPM = 38.4 s.

```js
const POPROCK = {
  id: 'demo-poprock', title: 'Neon Boulevard', artist: 'Finger Lickin Music', style: 'Pop-rock band', contentVersion: 1,
  key: {fifths: 1, mode: 'major'}, tempo: [[1, 120]], meter: [[1, 4, 4]],
  sections: [{label: 'Intro', bars: 4, dyn: -10}, {label: 'Verse', bars: 8, dyn: -10}, {label: 'Chorus', bars: 8, dyn: 20},
             {label: 'Verse', bars: 8, dyn: -10}, {label: 'Chorus', bars: 8, dyn: 20}, {label: 'Bridge', bars: 4, dyn: 0},
             {label: 'Chorus', bars: 8, dyn: 20}],
  harmony: {Intro: 'G D Em C', Verse: 'G D Em C G D C D', Chorus: 'C D G Em C D G G', Bridge: 'Em C Am D'},
  chords: {
    G:  {root: 'G2', comp: 'G3.B3.D4.G4', keys: 'B3.D4.G4'},
    D:  {root: 'D2', comp: 'F#3.A3.D4.F#4', keys: 'A3.D4.F#4'},
    Em: {root: 'E2', q: 'min', comp: 'G3.B3.E4.G4', keys: 'B3.E4.G4'},
    C:  {root: 'C2', comp: 'G3.C4.E4.G4', keys: 'C4.E4.G4'},
    Am: {root: 'A2', q: 'min', comp: 'A3.C4.E4.A4', keys: 'C4.E4.A4'}
  },
  drumVel: {36: 100, 38: 100, 41: 95, 42: 80, 43: 95, 45: 95, 46: 85, 47: 95, 48: 95, 49: 110, 50: 95, 51: 80, 54: 70},
  patterns: {
    drIntro:   {grid: {36: 'x.......x.......', 42: 'x.x.x.x.x.x.x.x.'}},
    drVerse:   {grid: {36: 'x.....x.x.......', 38: '....x.......x...', 42: 'x.x.x.x.x.x.x.x.'}},
    drChorus:  {grid: {36: 'x.....x.x.x.....', 38: '....x.......x...', 42: 'x...x...x...x...', 46: '..x...x...x...x.', 54: '....x.......x...'}},
    drBridgeA: {grid: {36: 'x.......x.......', 38: '........x.......', 51: 'x.x.x.x.x.x.x.x.'}},
    drFill:    {grid: {36: 'x...............', 50: '..xx............', 48: '....xx..........', 47: '......xx........',
                       45: '........xx......', 43: '..........xx....', 41: '............xx..', 38: '..............xx'}},
    bsIntro:   {vel: 90, gate: 0.95, notes: 'R/w'},
    bsVerse:   {vel: 90, gate: 0.85, notes: 'R/e R/e R/e R/e R/e R/e R/e R/e'},
    bsChorus:  {vel: 90, gate: 0.85, notes: 'R/e R/e O/e R/e F/e R/e O/e A/e'},
    bsBridge:  {vel: 90, gate: 0.9,  notes: 'R/q R/q F/q A/q'},
    rgIntro:   {set: 'comp', vel: 80, gate: 0.95, notes: 'x/w'},
    rgVerse:   {set: 'comp', vel: 85, gate: 0.9,  notes: 'x/h x/q x/q'},
    rgChorus:  {set: 'comp', vel: 90, gate: 0.9,  notes: 'x/q x/q x/q x/q'},
    rgBridge:  {set: 'comp', vel: 85, gate: 0.95, notes: 'x/h x/h'},
    kIntro:    {set: 'keys', vel: 75, gate: 0.95, notes: 'x/w'},
    kVerse:    {set: 'keys', vel: 80, gate: 0.9,  notes: 'x/h x/h'},
    kChorus:   {set: 'keys', vel: 85, gate: 0.95, notes: 'x/w'},
    kBridge:   {set: 'keys', vel: 80, gate: 0.95, notes: 'x/w'},
    ldChorus:  {vel: 95, gate: 0.95, notes:
      'E4/q D4/e E4/e G4/q E4/q | F#4/q E4/e F#4/e A4/h | B4/q A4/e B4/e D5/q B4/q | B4/h. r/q | ' +
      'E4/q D4/e E4/e G4/q E4/q | F#4/q E4/e F#4/e A4/q D5/q | D5/q. B4/e A4/q G4/q | G4/w |'},
    ldBridge:  {vel: 90, gate: 0.95, notes: 'G4/h E4/h | E4/h G4/h | A4/q G4/q E4/q C4/q | D4/h F#4/h |'}
  },
  tracks: [
    {name: 'Drums', drums: true, channel: 9, slot: 0, preset: 'preset-ace', crash: true,
     parts: {Intro: 'drIntro', Verse: 'drVerse', Chorus: 'drChorus', Bridge: [['drBridgeA', 3], ['drFill', 1]]}},
    {name: 'Bass', program: 33, channel: 0, slot: 1, preset: 'preset-blue',
     parts: {Intro: 'bsIntro', Verse: 'bsVerse', Chorus: 'bsChorus', Bridge: 'bsBridge'}},
    {name: 'Rhythm Guitar', program: 27, channel: 1, slot: 2, preset: 'preset-riff',
     parts: {Intro: 'rgIntro', Verse: 'rgVerse', Chorus: 'rgChorus', Bridge: 'rgBridge'}},
    {name: 'Lead Guitar', program: 29, channel: 2, slot: 3, preset: 'preset-nova',
     parts: {Intro: null, Verse: null, Chorus: 'ldChorus', Bridge: 'ldBridge'}},
    {name: 'Keys', program: 4, channel: 3, slot: 4, preset: 'preset-ivy',
     parts: {Intro: 'kIntro', Verse: 'kVerse', Chorus: 'kChorus', Bridge: 'kBridge'}}
  ],
  cc: [], pedal: null, bend: null
};

const PIANO = {
  id: 'demo-piano', title: 'Rain on Glass Street', artist: 'Finger Lickin Music', style: 'Piano solo', contentVersion: 1,
  key: {fifths: -1, mode: 'minor'}, tempo: [[1, 76], [29, 73], [30, 70], [31, 67], [32, 64]], meter: [[1, 4, 4]],
  sections: [{label: 'Intro', bars: 4, dyn: -20}, {label: 'A', bars: 8, dyn: -6}, {label: 'B', bars: 8, dyn: 18},
             {label: 'A2', bars: 8, dyn: 0}, {label: 'Coda', bars: 4, dyn: -30}],
  harmony: {Intro: 'Dm Bb Gm A', A: 'Dm Bb F C Gm Dm A A', B: 'Bb F Gm Dm Bb F Gm A',
            A2: 'Dm Bb F C Gm Dm A -', Coda: 'Dm Gm A Dm'},
  chords: {
    Dm: {root: 'D3', q: 'min', lh: 'D2.A2.D3.F3'},  Bb: {root: 'Bb2', lh: 'Bb1.F2.Bb2.D3'},
    F:  {root: 'F2', lh: 'F2.C3.F3.A3'},            C:  {root: 'C3', lh: 'C2.G2.C3.E3'},
    Gm: {root: 'G2', q: 'min', lh: 'G2.D3.G3.Bb3'}, A:  {root: 'A2', lh: 'A1.E2.A2.C#3'}
  },
  drumVel: {},
  patterns: {
    lhIntro: {set: 'lh', vel: 66, gate: 1.0, notes: '1/q 2/q 3/q 4/q'},
    lhA:     {set: 'lh', vel: 66, gate: 1.0, notes: '1/e 2/e 3/e 4/e 3/e 2/e 3/e 4/e'},
    lhB:     {set: 'lh', vel: 66, gate: 1.0, notes: '1/q. 2/e 3/h'},
    lhCoda:  {set: 'lh', vel: 66, gate: 1.0, notes: 'x/w'},
    rhIntro: {vel: 74, gate: 0.98, notes: 'r/w | r/w | A4/h. G4/q | A4/w |'},
    rhA:     {vel: 74, gate: 0.98, notes:
      'D5/q. C5/e A4/h | Bb4/q. A4/e F4/h | A4/q C5/q F5/q. E5/e | E5/h G4/h | ' +
      '_/q Bb4/q D5/q Bb4/q | A4/h F4/h | E4/q A4/q C#5/q E5/q | C#5/h. r/q |'},
    rhB:     {vel: 74, gate: 0.98, notes:
      'F5/q. D5/e Bb4/h | C5/q. A4/e F4/h | G4/q Bb4/q D5/q G5/q!112 | F5/h D5/h | ' +
      'D5/q. C5/e Bb4/q D5/q | C5/q A4/q F4/q A4/q | Bb4/h G4/h | A4/h. C#5/q |'},
    rhA2:    {vel: 74, gate: 0.98, notes:
      'D5/q. C5/e A4/h | Bb4/q. A4/e F4/h | A4/q C5/q F5/q. E5/e | E5/h G4/h | ' +
      '_/q Bb4/q D5/q Bb4/q | A4/h F4/h | E4/q A4/q C#5/q E5/q | r/w |'},
    rhCoda:  {vel: 74, gate: 0.98, notes: 'D5/h A4/h | Bb4/h G4/h | A4/h C#5/h | D5/w!36 |'}
  },
  tracks: [
    {name: 'Piano', program: 0, channel: 0, slot: 0, preset: 'preset-sol',
     parts: {Intro: {layers: ['lhIntro', 'rhIntro']}, A: {layers: ['lhA', 'rhA']}, B: {layers: ['lhB', 'rhB']},
             A2: {layers: ['lhA', 'rhA2']}, Coda: {layers: ['lhCoda', 'rhCoda']}}}
  ],
  cc: [], pedal: {track: 0, modes: {Intro: 'bar', A: 'bar', B: 'twoBars', A2: 'bar', Coda: 'bar'}}, bend: null
};

const ELECTRO = {
  id: 'demo-electro', title: 'Circuit Bloom', artist: 'Finger Lickin Music', style: 'Electronic', contentVersion: 1,
  key: {fifths: 0, mode: 'minor'}, tempo: [[1, 110]], meter: [[1, 4, 4]],
  sections: [{label: 'Intro', bars: 8, h: 'cyc', dyn: -10}, {label: 'Build', bars: 8, h: 'cyc', dyn: 0},
             {label: 'Drop', bars: 16, h: 'cyc', dyn: 15}, {label: 'Break', bars: 4, h: 'cyc', dyn: -15},
             {label: 'Drop', bars: 8, h: 'cyc', p: 'Drop2', dyn: 15}],
  harmony: {cyc: 'Am Am F F C C G G'},
  chords: {
    Am: {root: 'A1', q: 'min', pad: 'A3.C4.E4.G4', arp: 'A4.C5.E5.A5'},
    F:  {root: 'F1', pad: 'F3.A3.C4.E4', arp: 'F4.A4.C5.F5'},
    C:  {root: 'C2', pad: 'G3.C4.E4', arp: 'C5.E5.G5.C6'},
    G:  {root: 'G1', pad: 'G3.B3.D4', arp: 'G4.B4.D5.G5'}
  },
  drumVel: {36: 105, 38: 90, 39: 95, 42: 75, 46: 85, 49: 110, 70: 55},
  patterns: {
    drIntroA: {grid: {42: 'x.x.x.x.x.x.x.x.'}},
    drIntroB: {grid: {36: 'x...x...x...x...', 42: 'x.x.x.x.x.x.x.x.'}},
    drBuild:  {grid: {36: 'x...x...x...x...', 39: '....x.......x...', 42: 'xxxxxxxxxxxxxxxx'}},
    drRoll:   {grid: {36: 'x...x...x...x...', 38: 'xxxxxxxxxxxxxxxx'}},
    drDrop:   {grid: {36: 'x...x...x...x...', 39: '....x.......x...', 46: '..x...x...x...x.'}},
    drDrop2:  {grid: {36: 'x...x...x...x...', 39: '....x.......x...', 46: '..x...x...x...x.', 70: '.x.x.x.x.x.x.x.x'}},
    bsW:      {vel: 95, gate: 0.95, notes: 'R/w'},
    bsQ:      {vel: 95, gate: 0.85, notes: 'R/q R/q R/q R/q'},
    bsDrop:   {vel: 95, gate: 0.85, notes: 'r/e R/e r/e R/e r/e O/e r/e R/e'},
    arpE:     {set: 'arp', vel: 80, gate: 0.8, notes: '1/e 2/e 3/e 4/e 1/e 2/e 3/e 4/e'},
    arpS:     {set: 'arp', vel: 80, gate: 0.8, notes: '1/s 2/s 3/s 4/s 3/s 2/s 1/s 2/s 1/s 2/s 3/s 4/s 3/s 2/s 1/s 2/s'},
    padW:     {set: 'pad', vel: 70, gate: 1.0, notes: 'x/w _/w'},
    ldDrop:   {vel: 90, gate: 0.95, notes:
      'E5/q. D5/e C5/q A4/q | C5/h~b A4/h | A4/q. G4/e A4/q C5/q | F4/w~b | ' +
      'G4/q. A4/e C5/q E5/q | G5/h E5/h | D5/q. C5/e B4/q D5/q | B4/h~b r/h |'}
  },
  tracks: [
    {name: 'Drums', drums: true, channel: 9, slot: 0, preset: 'preset-pixel', crash: true,
     parts: {Intro: [['drIntroA', 4], ['drIntroB', 4]], Build: [['drBuild', 7], ['drRoll', 1]], Drop: 'drDrop', Break: null, Drop2: 'drDrop2'}},
    {name: 'Synth Bass', program: 39, channel: 0, slot: 1, preset: 'preset-blue',
     parts: {Intro: [['rest', 4], ['bsW', 4]], Build: 'bsQ', Drop: 'bsDrop', Break: null, Drop2: 'bsDrop'}},
    {name: 'Arp', program: 80, channel: 1, slot: 2, preset: 'preset-nova',
     parts: {Intro: [['rest', 4], ['arpE', 4]], Build: 'arpE', Drop: 'arpS', Break: null, Drop2: 'arpS'}},
    {name: 'Pad', program: 88, channel: 2, slot: 3, preset: 'preset-ivy',
     parts: {Intro: 'padW', Build: 'padW', Drop: 'padW', Break: 'padW', Drop2: 'padW'}},
    {name: 'Lead', program: 81, channel: 3, slot: 4, preset: 'preset-riff',
     parts: {Intro: null, Build: null, Drop: 'ldDrop', Break: null, Drop2: 'ldDrop'}}
  ],
  cc: [{track: 3, sections: ['Intro'], controller: 1, shape: 'set', value: 0},
       {track: 3, sections: ['Build'], controller: 1, shape: 'ramp', from: 0, to: 100, everyTicks: 960},
       {track: 3, sections: ['Drop'], controller: 1, shape: 'set', value: 100},
       {track: 3, sections: ['Break'], controller: 1, shape: 'ramp', from: 100, to: 0, everyTicks: 960}],
  pedal: null, bend: {track: 4, semis: 2}
};
// Note on 'Drop' twice: sections are matched by position, so the cc row for 'Drop' applies to every
// section labelled 'Drop' (both drops: CC1 = 100 at each start); the parts use p 'Drop2' for the second.

const JAZZ = {
  id: 'demo-jazz', title: 'Three Over Four', artist: 'Finger Lickin Music', style: 'Jazz trio', contentVersion: 1,
  key: {fifths: -1, mode: 'major'}, tempo: [[1, 150]], meter: [[1, 4, 4], [17, 3, 4], [25, 4, 4], [49, 3, 4], [57, 4, 4]],
  sections: [{label: 'A1', bars: 8, h: 'A', p: 'A'}, {label: 'A2', bars: 8, h: 'A', p: 'A', crash: false},
             {label: 'B', bars: 8, h: 'B', p: 'B', crash: false}, {label: 'A3', bars: 8, h: 'A', p: 'A', crash: false},
             {label: 'Solo A1', bars: 8, h: 'A', p: 'SoloA', dyn: 5}, {label: 'Solo A2', bars: 8, h: 'A', p: 'SoloA', dyn: 5, crash: false},
             {label: 'Solo B', bars: 8, h: 'B', p: 'B', dyn: 5, crash: false}, {label: 'Solo A3', bars: 8, h: 'End', p: 'End', crash: false}],
  harmony: {A: 'Fmaj7 Dm7 Gm7 C7 Am7,D7 Gm7,C7 Fmaj7 Gm7,C7', B: 'Bbmaj7 Bbmaj7 Am7 D7 Gm7 Gm7 C7 C7',
            End: 'Fmaj7 Dm7 Gm7 C7 Am7,D7 Gm7,C7 Fmaj7 Fmaj7'},
  chords: {
    Fmaj7:  {root: 'F2', comp: 'A3.C4.E4.G4'},   Dm7: {root: 'D2', q: 'min', comp: 'F3.A3.C4.E4'},
    Gm7:    {root: 'G2', q: 'min', comp: 'Bb3.D4.F4.A4'}, C7: {root: 'C2', comp: 'Bb3.D4.E4.A4'},
    Am7:    {root: 'A2', q: 'min', comp: 'C4.E4.G4.B4'}, D7: {root: 'D2', comp: 'C4.E4.F#4.B4'},
    Bbmaj7: {root: 'Bb1', comp: 'D4.F4.A4.C5'}
  },
  drumVel: {36: 25, 37: 70, 38: 30, 44: 60, 49: 100, 51: 75},
  patterns: {
    compA:  {set: 'comp', vel: 64, gate: 0.9, swing: true, notes: 'x/q. x/e r/q x/q'},
    compB:  {set: 'comp', vel: 64, gate: 0.9, swing: true, notes: 'x/q r/q x/q'},
    melA:   {vel: 80, gate: 0.9, swing: true, notes:
      'C5/q A4/e C5/e r/e A4/e G4/q | F4/h r/h | D5/q Bb4/e D5/e r/e Bb4/e A4/q | G4/h. r/q | ' +
      'E5/q C5/e E5/e F#5/q D5/q | F5/q D5/e Bb4/e E5/q C5/q | A4/w | r/w |'},
    melAEnd: {vel: 80, gate: 0.95, swing: true, notes:
      'C5/q A4/e C5/e r/e A4/e G4/q | F4/h r/h | D5/q Bb4/e D5/e r/e Bb4/e A4/q | G4/h. r/q | ' +
      'E5/q C5/e E5/e F#5/q D5/q | F5/q D5/e Bb4/e E5/q C5/q | A4/w | F4/w |'},
    melB:   {vel: 80, gate: 0.9, swing: true, notes:
      'D5/q F5/q A5/q | G5/h. | E5/q G5/q C5/q | F#5/h. | D5/q F5/q Bb4/q | A4/h. | E5/q G5/q Bb5/q | C5/h. |'},
    solA:   {vel: 84, gate: 0.85, swing: true, notes:
      'F4/e A4/e C5/e E5/e G5/e E5/e C5/e A4/e | D5/e C5/e A4/e F4/e E4/q r/q | ' +
      'G4/e Bb4/e D5/e F5/e A5/e F5/e D5/e Bb4/e | E5/e D5/e Bb4/e G4/e E4/h | ' +
      'C5/e E5/e G5/e E5/e F#5/e A5/e F#5/e D5/e | F5/e D5/e Bb4/e G4/e E5/e C5/e Bb4/e G4/e | ' +
      'A4/q C5/q E5/q G5/q | F5/h r/h |'},
    walkA:  {vel: 85, gate: 0.9, notes: 'R/q T/q V/q A/q'},
    walkB:  {vel: 85, gate: 0.9, notes: 'R/q F/q A/q'},
    drA:    {step: 'e3', grid: {51: 'x..x.xx..x.x', 44: '...x.....x..', 38: '.....g.....g', 36: 'f.....f.....'}},
    drSolo: {step: 'e3', grid: {51: 'x..x.xx..x.x', 44: '...x.....x..', 38: '.....g.....g', 36: 'f.....f.....', 37: '.........x..'}},
    drB:    {step: 'e3', grid: {51: 'x..x.xx.x', 44: '...x..x..', 36: 'f........'}}
  },
  tracks: [
    {name: 'Piano', program: 0, channel: 0, slot: 1, preset: 'preset-mo',
     parts: {A: {layers: ['compA', 'melA']}, B: {layers: ['compB', 'melB']}, SoloA: {layers: ['compA', 'solA']},
             End: {layers: ['compA', 'melAEnd']}}},
    {name: 'Acoustic Bass', program: 32, channel: 1, slot: 2, preset: 'preset-blue',
     parts: {A: 'walkA', B: 'walkB', SoloA: 'walkA', End: 'walkA'}},
    {name: 'Drums', drums: true, channel: 9, slot: 0, preset: 'preset-ace', crash: true,
     parts: {A: 'drA', B: 'drB', SoloA: 'drSolo', End: 'drSolo'}}
  ],
  cc: [], pedal: null, bend: null
};

const DANCE = {
  id: 'demo-dance', title: 'Four Floors Up', artist: 'Finger Lickin Music', style: 'Dance, 128 BPM', contentVersion: 1,
  key: {fifths: 1, mode: 'minor'}, tempo: [[1, 128]], meter: [[1, 4, 4]],
  sections: [{label: 'Intro', bars: 8, h: 'cyc', dyn: -10}, {label: 'Verse', bars: 16, h: 'cyc', dyn: 0},
             {label: 'Build', bars: 8, h: 'cyc', dyn: 5}, {label: 'Drop', bars: 16, h: 'cyc', dyn: 15},
             {label: 'Outro', bars: 12, h: 'out', dyn: -5}],
  harmony: {cyc: 'Em Em C C G G D D', out: 'Em Em C C G G D D Em Em Em Em'},
  chords: {
    Em: {root: 'E2', q: 'min', pad: 'E3.G3.B3', stab: 'E4.G4.B4'}, C: {root: 'C2', pad: 'E3.G3.C4', stab: 'E4.G4.C5'},
    G:  {root: 'G2', pad: 'D3.G3.B3', stab: 'D4.G4.B4'},           D: {root: 'D2', pad: 'D3.F#3.A3', stab: 'D4.F#4.A4'}
  },
  drumVel: {36: 110, 38: 85, 39: 95, 46: 80, 49: 110, 56: 75},
  patterns: {
    drIn:     {grid: {36: 'x...x...x...x...', 46: '..x...x...x...x.'}},
    drV:      {grid: {36: 'x...x...x...x...', 46: '..x...x...x...x.', 39: '....x.......x...'}},
    drBuildA: {grid: {36: 'x...x...x...x...', 38: 'x.x.x.x.x.x.x.x.'}},
    drBuildB: {grid: {36: 'x...x...x...x...', 38: 'xxxxxxxxxxxxxxxx'}},
    drDrop:   {grid: {36: 'x...x...x...x...', 46: '..x...x...x...x.', 39: '....x.......x...', 56: '...x.......x....'}},
    bsE:      {vel: 95, gate: 0.8, notes: 'R/e R/e R/e R/e R/e R/e R/e R/e'},
    hook:     {vel: 100, gate: 0.85, notes: 'E4/e G4/e B4/e r/e A4/e G4/e E4/q | D4/e E4/e G4/e r/e B4/q r/q |'},
    padW:     {set: 'pad', vel: 70, gate: 1.0, notes: 'x/w _/w'},
    stab:     {set: 'stab', vel: 90, gate: 0.5, notes: 'r/h r/q r/e x/e'}
  },
  tracks: [
    {name: 'Drums', drums: true, channel: 9, slot: 0, preset: 'preset-pixel', crash: true,
     parts: {Intro: 'drIn', Verse: 'drV', Build: [['drBuildA', 4], ['drBuildB', 4]], Drop: 'drDrop', Outro: 'drIn'}},
    {name: 'Synth Bass', program: 38, channel: 0, slot: 1, preset: 'preset-blue',
     parts: {Intro: null, Verse: 'bsE', Build: 'bsE', Drop: 'bsE', Outro: [['bsE', 8], ['rest', 4]]}},
    {name: 'Hook', program: 87, channel: 1, slot: 2, preset: 'preset-nova',
     parts: {Intro: null, Verse: null, Build: null, Drop: [['hook', 2, 0], ['hook', 2, 12]],
             Outro: [['hook', 2, 0], ['hook', 2, 12], ['hook', 2, 0], ['hook', 2, 12], ['rest', 4]]}},
    {name: 'Pad', program: 89, channel: 2, slot: 3, preset: 'preset-ivy',
     parts: {Intro: 'padW', Verse: 'padW', Build: 'padW', Drop: 'padW', Outro: 'padW'}},
    {name: 'Stab', program: 7, channel: 3, slot: 4, preset: 'preset-riff',
     parts: {Intro: null, Verse: 'stab', Build: null, Drop: 'stab', Outro: null}}
  ],
  cc: [{track: 3, sections: ['Intro', 'Build', 'Outro'], controller: 11, shape: 'set', value: 127},
       {track: 3, sections: ['Verse', 'Drop'], controller: 11, shape: 'beatDip'}],
  pedal: null, bend: null
};

const TUTORIAL_SONG = {
  id: 'tut-basics', title: 'First Steps', artist: 'Finger Lickin Music', style: 'Tutorial', contentVersion: 1,
  key: {fifths: 0, mode: 'major'}, tempo: [[1, 100]], meter: [[1, 4, 4]],
  sections: [{label: 'Step 1', bars: 4, crash: false}, {label: 'Step 2', bars: 4, crash: false},
             {label: 'Step 3', bars: 4, crash: false}, {label: 'Record', bars: 4, crash: false}],
  harmony: {}, chords: {},
  drumVel: {36: 70, 38: 70, 42: 55},
  patterns: {
    tp1: {vel: 90, gate: 0.9, notes: 'C4/h C4/h'},
    tp2: {vel: 90, gate: 0.9, notes: '[C4.E4]/h [G4.C5]/h'},
    tp3: {vel: 90, gate: 0.85, notes: 'C4/q E4/q G4/e G4/e C5/q'},
    tdr: {grid: {36: 'x.......x.......', 38: '....x.......x...', 42: 'x.x.x.x.x.x.x.x.'}}
  },
  tracks: [
    {name: 'Piano', program: 0, channel: 0, slot: 0, preset: 'preset-sol',
     parts: {'Step 1': 'tp1', 'Step 2': 'tp2', 'Step 3': 'tp3', Record: null}},
    {name: 'Drums', drums: true, channel: 9, slot: 1, preset: 'preset-ace', crash: false,
     parts: {'Step 1': 'tdr', 'Step 2': 'tdr', 'Step 3': 'tdr', Record: 'tdr'}}
  ],
  cc: [], pedal: null, bend: null
};
```

Section-label rules used above: `harmony`, `parts`, `pedal.modes` and `cc.sections` are keyed
by the section's `h`, `p`, label and label respectively (`h` and `p` default to the label).

Expected expansion counts (note events per track; the content tests allow +/- 0 for the
counts below because they follow directly from the data):

| Song | Track counts (t1, t2, ...) | Notes | Other events |
|---|---|---|---|
| demo-poprock | Drums 687, Bass 340, Rhythm Guitar 624, Lead Guitar 100, Keys 192 | 1,943 | 4 program events |
| demo-piano | Piano 253 (left hand 176, right hand 77) | 253 | 1 program, CC64 pedal events |
| demo-electro | Drums 562, Synth Bass 132, Arp 480, Pad 78, Lead 66 | 1,318 | 4 program, 4 RPN CCs, 54 bends, CC1 51 events (Intro 1, Build 32, both Drop sections 1 each, Break 16) |
| demo-jazz | Piano 923 (comp 704, melody 219), Acoustic Bass 240, Drums 730 | 1,893 | 2 program events |
| demo-dance | Drums 645, Synth Bass 384, Hook 120, Pad 90, Stab 96 | 1,335 | 4 program, CC11 515 events (3 sets + 512 dips) |
| tut-basics | Piano 44, Drums 192 | 236 | 1 program |

Total demo notes: 6,742 (inside the 4,000-7,000 target of Part 1.7). Drum voices: across the
five demo drum tracks every voice of the 12-voice kit occurs (kick 36, snare 38, rimshot 37,
clap 39, tom 41-50, closed hat 42, open hat 46, pedal hat 44, crash 49, ride 51, cowbell 56,
shaker and misc 54 and 70). Pitch ranges stay inside the 6.6 template ranges of each
program (EP 28-103, guitar 40-88, bass 28-67, synth lead and pad 36-96, clavinet 36-96,
piano 21-108).

6.30.4.7 Character presets (`CHARACTER_PRESETS`, CharacterPreset of 5.10)

| presetId | Name | body | heightScale | skin | hair (style, color) | face | top | bottom | shoes | accessories | animationStyle |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `preset-ace` | Ace | broad | 1.05 | skin5 | short, #1b1b1b | face2 | tank, #c0392b | jeans, #2d3a4a | sneakers, #f2f2f2 | wristband | energetic |
| `preset-blue` | Blue | average | 1.08 | skin2 | long, #3b2a1a | face1 | shirt, #2e5e8c | jeans, #1f2833 | boots, #4a3020 | (none) | calm |
| `preset-riff` | Riff | slim | 1.00 | skin4 | mohawk, #d6336c | face3 | jacket, #222222 | jeans, #333a44 | boots, #111111 | scarf | energetic |
| `preset-nova` | Nova | slim | 0.95 | skin6 | curly, #f5b041 | face4 | hoodie, #7d3c98 | shorts, #2c3e50 | sneakers, #ffffff | glasses | normal |
| `preset-ivy` | Ivy | average | 0.97 | skin3 | medium, #6e2c00 | face1 | dress, #16a085 | none, #000000 | sneakers, #ecf0f1 | (none) | normal |
| `preset-mo` | Mo | broad | 1.02 | skin7 | none, #000000 | face2 | shirt, #f0e6d2 | jeans, #3e2723 | boots, #5d4037 | hat | calm |
| `preset-pixel` | Pixel | average | 0.92 | skin1 | short, #48c9b0 | face3 | tee, #1abc9c | shorts, #34495e | sneakers, #ff9f43 | headphones, wristband | energetic |
| `preset-sol` | Sol | slim | 1.04 | skin8 | long, #0b0b0b | face4 | jacket, #8e44ad | skirt, #2c2c54 | boots, #2d2d2d | glasses | calm |

Each record: `{format:'flm-character', version:1, presetId, builtIn:true, character:{name, body,
heightScale, skin, hair, face, top, bottom, shoes, accessories, animationStyle, version:1}}`.
Slot assignment per arrangement is the `slot` and `preset` of each TrackDef above; a song with
fewer than five tracks leaves the remaining slots empty (no idle performers on stage, so the
stage never shows a musician that does not play, I 4.4).

6.30.4.8 Tutorial steps (`TUTORIAL.steps`)

`lanePitches = [60, 64, 67, 72]` (lanes 0-3; C4, E4, G4, C5). Segments are 0-based bars of
`tut-basics`.

| index | id | Title | Kind | Segment | Keyboard text | Touch text | Success |
|---|---|---|---|---|---|---|---|
| 1 | `tut-note` | Trigger a note | chart | bars 0-3 | "Press {lane0} when a circle reaches the line." | "Tap the {lane0} pad when a circle reaches the line." | `{minHits: 4}` |
| 2 | `tut-two` | Play two notes together | chart | bars 4-7 | "Press {lane0} and {lane1} together, then {lane2} and {lane3} together." | "Tap the {lane0} and {lane1} pads together, then the {lane2} and {lane3} pads." | `{minChordHits: 4}` |
| 3 | `tut-rhythm` | Follow a simple rhythm | chart | bars 8-11 | "Follow the rhythm: quarter, quarter, two quick ones, quarter." | same | `{minHits: 8, minAccuracy: 0.60}` |
| 4 | `tut-instrument` | Pick a different instrument | instrument | bars 0-3 loop (drums only) | "Choose another instrument, then play a few notes with {lane0} to {lane3}." | "Choose another instrument, then tap a few pads." | `{programChanged: true, minPresses: 2}` |
| 5 | `tut-record` | Record a short performance | record | bars 12-15 | "Press Record, wait for the count-in, then play anything for four bars." | "Tap Record, wait for the count-in, then tap the pads for four bars." | `{minTakeNotes: 4}` |
| 6 | `tut-import` | Import a song | import | none | "Imported files are checked before you play. Here is an example." | same | `{playable: true, confirmed: true}` |
| 7 | `tut-next` | Make music | choose | none | "Open the Studio to build a song, or try Dance Mode." | same | `{choice: 'studio' or 'dance' or 'menu'}` |

`{laneN}` is filled by M-27 (key label or pad word). Instruments offered at step 4: programs 0,
25, 80, 12 (`TUTORIAL.instruments`).

6.30.4.9 Catalog entries (`list()`)

```js
CatalogEntry {
  id, kind: 'builtin', title, artist, style, contentVersion: 1,
  bpm /* first tempo */, keyName /* Theory.keyName(fifths, mode) */, meterLabel /* '4/4' or '4/4, 3/4' */,
  bars, durationS /* computed from tempo and meter data without expanding notes */,
  tracks: [{trackId: 't1'.., name, program, isDrums, slot, preset}],
  defaultTrackId /* demo-poprock: Keys 't5'; others: the first non-drum track */,
  presetsBySlot: [presetId or null x5],
  expand: () => Song      // calls Content.expand(arrangement); the Catalog caches the result
}
```

`registerTutorial` receives the same shape with `kind:'tutorial'` and `steps`; the Catalog
exposes it through `Catalog.tutorial()` and `Catalog.getSong('tut-basics')`, never in Quick
Play lists.

#### 6.30.5 Error handling and recovery

Content errors are defects in shipped data; they are found by the unit tests, not by users.
At runtime `expand` throws an `Error` whose message starts with one of `E-CNT-001` (bar check
or grid length), `E-CNT-002` (part length mismatch), `E-CNT-003` (unknown chord, pattern or
token), `E-CNT-004` (pitch out of range), `E-CNT-005` (model validation failed); callers report
`E-GEN-001` with `context.content = <id>` and `context.detail = <message>`.

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| Registration at load throws | try in the load-time block | empty catalog | n/a | no | SCR-QuickPlay empty state "No built-in songs were loaded" (Part 4.3 A4) | no demos | reload after a fix | UT-30-11 |
| Expansion throws for one song | `expand` error | other songs | n/a | no | toast E-GEN-001 "This demo song could not be loaded" and the song is disabled with that reason | that song unavailable | n/a | UT-30-09 |
| Preset invalid | `Character.validate` in `registerPresets` | other presets | n/a | no | log | preset missing from the picker | n/a | UT-30-12 |
| Tutorial chart construction fails | `tutorialChart` error | tutorial screen | Skip step | no | card message | step skippable | next step | UT-30-13 |

#### 6.30.6 Limits and performance notes

- Source size of `30-content.js`: the data above is about 25 KB of source plus about 8 KB
  of expander code, inside the 60 KB budget of ADR-14.
- `expand` <= 50 ms per song on the desktop reference device (largest: demo-poprock with
  about 1,950 notes); total expanded notes 6,742 plus 236 for the tutorial.
- Expansion allocates once per song per page life (the Catalog cache); nothing is persisted.

#### 6.30.7 Spec coverage

B 7.1 (built-in songs for Quick Play), B 7.2 (single notes, chords, intervals, repeated notes,
sustained notes, rests, subdivisions, tempo changes in the content), B 9.1 (tempo and meter
changes exercised), B 10.5, B 11.4 (sustain, pitch bend, modulation, expression in the
content), B 13.1 (preset appearances), B 23.3 (original content only), E 3.2 (sustain pedal
durations, meter change mid-song), I 9.3 (presets as cosmetic data), I 11.3 (tutorial song and
seven steps), P 4 (built-in demo without importing), P 21 (coherent demo content).

#### 6.30.8 Unit tests (group `content`, file `src/91-test-content.js`)

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-30-01 | expansion determinism | expand every arrangement twice | `JSON.stringify` of both results equal; note ids identical; `createdAt` equals the fixed constant |
| UT-30-02 | durations | expand all | `TempoMap.ticksToSeconds(durationTicks)` equals 96.0, 102.47 (+/- 0.01), 96.0, 96.0, 112.5 and 38.4 s; every demo within 60-120 s |
| UT-30-03 | note counts | `stats(song)` | per-track and total counts equal the 6.30.4.6 table; total demo notes 6,742 |
| UT-30-04 | tempo and meter change present | inspect maps | demo-piano tempo entries at bars 29-32 with BPM 73, 70, 67, 64; demo-jazz meter entries at bars 17, 25, 49, 57 alternating 3/4 and 4/4 |
| UT-30-05 | pitch ranges inside instrument ranges | for each melodic track, `Instruments.definition(program).range` | every note pitch within the range; piano right hand pitches >= 60 and left hand < 60 in demo-piano |
| UT-30-06 | drum voice coverage | map every drum note through `Instruments.drumVoiceFor(key)` over the five demos | all 12 voice indexes occur |
| UT-30-07 | swing and ties | expand demo-jazz and demo-piano | jazz melody off-beat eighths start at beat offset 640; demo-piano bar 5 starts with no new G4 and the G4 of bar 4 has `durTicks = 1920 + round(960 * 0.98) = 2861` |
| UT-30-08 | controllers | expand demo-electro and demo-dance | 9 bend gestures with values 0, 2048, 4096, 6143, 8191, 0; RPN CC101/100/6/38 at tick 0 on Lead; CC1 ramp 0..100 in 32 steps; CC11 dips 40/68/96/127 per beat in Verse and Drop |
| UT-30-09 | notation errors | a 4/4 pattern with a bar check token after one quarter note; unknown token `H4`; part list of 3 bars in an 8-bar section | throws messages starting E-CNT-001, E-CNT-003, E-CNT-002 |
| UT-30-10 | model validity | `Model.validate(expand(a))` for all | ok true, events sorted, durationTicks equals the End marker tick |
| UT-30-11 | catalog registration | after load | `Project.Catalog.list()` has the 5 demo ids in order with durationS matching UT-30-02 without expanding (no expand call recorded) |
| UT-30-12 | presets valid | `Character.validate(preset.character + id)` for the 8 presets | all valid; serialized size <= 4,096 bytes; presetIds unique |
| UT-30-13 | tutorial charts | `tutorialChart(1..3, expand(tut-basics))` | 8, 8 and 20 ChartNotes; step 2 notes have lanes [0,1] and [2,3]; every sourceEventId exists; lanes follow lanePitches |
| UT-30-14 | pedal derivation | demo-piano with `Model.deriveSustain(t1)` | B section notes extend across a chord change (effectiveDurTicks > durTicks); bar 28 has no notes and no pedal-down event |

#### 6.30.9 Implementation notes and browser quirks

- Type the data exactly as written; the bar checks (`|`) and the count table catch typing
  errors. Do not "fix" musical content without updating the count table and the LEDGER.
- Note names use `#` and `b` only (no double accidentals); `Bb1` is MIDI 34, `C6` is 84.
- `Model.Track.create` assigns default ids with `uid()`; the expander passes explicit ids, so
  determinism does not depend on `uid()`.
- The expander runs inside the Catalog's `expand` closure on first use, which happens in the
  user's click handler for Play; 50 ms is inside the time-to-first-playable budget (5 s desktop).

### 6.31 M-31 SelfTest (`src/90-selftest.js`, `src/91-test-*.js`, `src/92-test-*.js`, `FLM.SelfTest`)

#### 6.31.1 Responsibilities and non-goals

Responsibilities (test build only; ADR-11): the in-page test runner (`group`, `test`, async
tests, per-test timeout, slow filter, grep, skip), the assertion set, the fakes (fake clock,
fake timers, in-memory IndexedDB, in-memory localStorage, `OfflineAudioContext` helpers, input
synthesis, stubs and spies), the corpus store fed by `tools/selftest.mjs`, the performance
scenario registry used by `tools/perf.mjs`, the results object and `window.__FLM_RESULTS`,
the group leak check through `FLM.Modes.assertClean()`, and the "Run self-test" panel content
on SCR-Diagnostics.

Non-goals: no test content beyond the runner's own tests (`UT-31-*`); module tests live in
`91-test-<module>.js` and cross-module tests (IT, TT, FT, FI, PT smoke) in `92-test-<group>.js`
(Part 12). Nothing of this module exists in `FingerLickinMusic.html` (the build excludes
`9*-*.js`; the smoke check fails when `FLM.selfTest` exists in the shipped file).

#### 6.31.2 Public API

```js
FLM.Core.define('SelfTest', function (FLM) {
  return Object.freeze({
    VERSION: '1.0.0',
    /** The 36 group names of Part 3.1, in run order. */
    KNOWN_GROUPS: ['core','theory','model','transport','audio','instruments','input','mapping','rhythm','midi',
                   'zip','musicxml','guitarpro','import','project','storage','studio','render','rig','animation',
                   'stage','character','dance','net','progress','ui','screens','modes','boot','content','selftest',
                   'integration','timing','files','faults','perf-smoke'],
    /** Register a group. fn(t) runs immediately and declares tests with t.test; a second
     *  registration of the same name appends. Unknown names throw (the list above is closed). */
    group(name, fn) {},
    /** Add one test to a registered group (same as t.test inside the group callback). */
    test(groupName, name, opts, fn) {},
    /** Run groups. groups: undefined (all), a name, or an array. opts: {slow, grep, touch, timeoutMs}.
     *  Assigns window.__FLM_RESULTS and resolves to the results object (6.31.4.4). Never rejects. */
    run(groups, opts) /* -> Promise<Results> */ {},
    /** [{name, tests, slow}] for the registered groups (diagnostics panel). */
    groups() {},
    results() /* -> last Results or null */ {},
    progress() /* -> {running:boolean, group:string|null, index:int, total:int, passed:int, failed:int} */ {},
    RESULT_SHAPE: /* frozen description of the results object (6.31.4.4) */ {},
    /** Isolated runner with its own registry (used by UT-31 tests to test the runner). */
    createRunner() /* -> {group, run, groups} */ {},

    assert: { eq, deepEq, near, within, ok, throws, rejects },   // also available as t.eq etc.
    fakes: {
      FakeClock /* class; clock(start) returns new FakeClock(start) */, FakeIndexedDB /* class; indexedDB(opts) returns an instance */,
      clock(startSec /* = 0 */) /* -> FakeClock */ {},
      timers() /* -> FakeTimers (install/uninstall/advance) */ {},
      indexedDB(opts) /* -> FakeIndexedDB factory */ {},
      localStorage() /* -> FakeStorage */ {},
      offlineContext(opts /* {seconds, sampleRate:48000, channels:2} */) /* -> Promise<OfflineAudioContext> */ {},
      onsets(audioBuffer, opts /* {threshold:0.05, channel:0} */) /* -> number[] seconds */ {},
      inputs: { key(code, down, tPerf), tap(lane, tPerf, holdMs), pointer(id, type, x, y, tPerf, pointerType),
                gamepad(state), midi(bytes, tPerf), event(control, type, tAudio, source) },
      stub(obj, method, impl) /* -> Spy (auto-restored after the test) */ {},
      spy(fn) /* -> Spy */ {}
    },
    corpus: { load(entries), has(file), get(file) /* -> {bytes:Uint8Array, recipe, format, expect} */, list(), loaded() },
    perf:   { register(name, fn), run(name, opts) /* -> Promise<{name, durationMs, metrics, notes}> */, list() }
  });
});

/** The t object passed to group callbacks. */
TestContext {
  test(name /* 'UT-NN-nn sentence' */, opts /* ?{slow:boolean, timeoutMs:number, touch:boolean} */, fn /* async ok */),
  before(fn), after(fn),               // once per group run
  beforeEach(fn), afterEach(fn),
  skip(reason) /* throws the Skip signal */,
  eq(actual, expected, msg), deepEq(actual, expected, msg), near(a, b, eps, msg), within(x, lo, hi, msg), ok(cond, msg),
  throws(fn, codePrefix /* ?'E-CNT-001' */, msg), rejects(promiseOrFn, codePrefix, msg) /* async */,
  fakes, corpus, options /* {slow, touch, grep} of the current run */
}
FakeClock { now() /* seconds */, advance(sec), set(sec) }
FakeTimers { install(), uninstall(), advance(ms) /* runs due timeouts, intervals and RAF callbacks in time order */, pending() }
Spy { calls: [{args, result, error}], count, last(), reset(), restore() }
```

Events: none emitted, none consumed (tests subscribe to topics they assert on, with an owner
token removed in `afterEach`).

#### 6.31.3 Internal state

```js
registry: Map<groupName, {name, tests:[{name, opts, fn}], hooks:{before:[], after:[], beforeEach:[], afterEach:[]}}>
running: null | {group, index, total, passed, failed}
lastResults: null | Results
activeStubs: Spy[]            // restored after every test
corpus: Map<file, {bytes, recipe, format, expect}>
perfScenarios: Map<name, fn>
```

Invariants: tests run strictly one at a time; `activeStubs` is empty between tests; the
registry is never modified while `running` is non-null (a `group` call during a run throws).

#### 6.31.4 Algorithms

6.31.4.1 `run(groups, opts)`

```js
async function run(groups, opts = {}) {
  const startedAt = new Date().toISOString();
  const wanted = groups === undefined ? KNOWN_GROUPS : [].concat(groups);
  const unknown = wanted.filter(g => !KNOWN_GROUPS.includes(g));
  const order = KNOWN_GROUPS.filter(g => wanted.includes(g) && registry.has(g));
  const res = {version: FLM.SelfTest.VERSION, build: FLM.VERSION + ' ' + (FLM.BUILD && FLM.BUILD.date) + ' test',
    userAgent: navigator.userAgent, startedAt, finishedAt: null,
    options: {groups: groups === undefined ? null : wanted, slow: !!opts.slow, grep: opts.grep || '', touch: !!opts.touch},
    known: KNOWN_GROUPS.slice(), unknown, groups: [], tests: [], total: 0, passed: 0, failed: 0, skipped: 0, pageErrors: []};
  if (FLM.Modes.current().mode !== 'menu') await FLM.Modes.leave('user');
  for (const g of order) await runGroup(registry.get(g), opts, res);
  res.finishedAt = new Date().toISOString();
  lastResults = res; window.__FLM_RESULTS = res;
  return res;
}
```

`runGroup(group, opts, res)`:

1. `t0 = performance.now()`; run `before` hooks (a throwing hook fails every test of the group
   with message `before hook: <message>` and skips to step 4).
2. For each test in registration order: skip silently (not counted) when `test.opts.slow &&
   !opts.slow`, when `opts.grep` is set and `(group + '/' + name).toLowerCase()` does not
   contain it, or when `test.opts.touch === true && !opts.touch`; otherwise `runTest`.
3. `runTest`: `beforeEach` hooks; `limit = test.opts.timeoutMs || opts.timeoutMs ||
   (test.opts.slow ? 60000 : 10000)`; `outcome = await Promise.race([Promise.resolve().then(() =>
   test.fn(t)), timeout(limit)])` where `timeout` rejects with `Error('timeout after ' + limit +
   ' ms')`; result `{group, name, pass: true, skipped: false, ms, message: ''}`, or `pass:false`
   with `message = err.message` (first 500 chars) for assertion failures and thrown errors, or
   `skipped:true, pass:true, message: reason` for `t.skip`; `afterEach` hooks run in `finally`;
   all `activeStubs` are restored, fake timers uninstalled, test-owned bus listeners removed
   (`bus.removeOwner(testOwner)`).
4. `after` hooks; leak check: if `FLM.Modes.current().mode !== 'menu'` -> `await
   FLM.Modes.leave('user')`; `leaks = FLM.Modes.assertClean()`; non-null -> append `{group, name:
   group + ' leak check', pass:false, skipped:false, ms:0, message: JSON.stringify(leaks)}`.
5. Append the group row `{name, total, passed, failed, skipped, ms}` and add to the totals.

A test that times out keeps running in the background (JavaScript cannot cancel it); the
runner marks it failed and continues; its later side effects are contained by the leak check.

6.31.4.2 Assertions

| Assertion | Pass condition | Failure message |
|---|---|---|
| `eq(a, b)` | `Object.is(a, b)` or both `NaN` | `expected <b> but got <a>` (values via `JSON.stringify`, 200 chars) |
| `deepEq(a, b)` | structural equality: same prototype class for arrays and plain objects, same own enumerable keys, recursive; typed arrays element-wise; `Map` and `Set` by entries | first differing path, e.g. `at tracks[2].events[5].tick: expected 960 got 959` |
| `near(a, b, eps)` | `abs(a - b) <= eps` | `expected <b> +/- <eps> but got <a>` |
| `within(x, lo, hi)` | `lo <= x && x <= hi` | `expected <x> in [<lo>, <hi>]` |
| `ok(c)` | truthy | `assertion failed: <msg>` |
| `throws(fn, prefix)` | `fn` throws and, when given, `String(err.code or err.message)` starts with `prefix` | `expected a throw` or `expected code <prefix> but got <code>` |
| `rejects(p, prefix)` | promise rejects (a function is called and its result awaited) with the same prefix rule | as throws |

Assertions throw `AssertionError` (a subclass of `Error` with `name = 'AssertionError'`).

6.31.4.3 Fakes

- `clock(start)`: `{now: () => s, advance(d) { s += d; }, set(v) { s = v; }}`; passed to
  `FLM.Transport.create({clock, bus})` (06a) and to judge time maps.
- `timers()`: `install()` replaces `window.setTimeout`, `clearTimeout`, `setInterval`,
  `clearInterval`, `requestAnimationFrame`, `cancelAnimationFrame` and `performance.now` with
  versions on a virtual clock starting at the real `performance.now()`; `advance(ms)` runs every
  due callback in time order (intervals re-queued, RAF callbacks at 16.667 ms steps with the
  virtual time as argument); `uninstall()` restores the originals (also done automatically after
  each test). M-01's wrappers look up the window functions at call time, so code under test goes
  through the fake (requirement noted in 6.31.9).
- `indexedDB(opts)`: an in-memory factory implementing what M-16 uses: `open(name, version)` with
  `onupgradeneeded`, `onsuccess`, `onerror`, `onblocked`; `db.createObjectStore(name, {keyPath})`,
  `store.createIndex(name, keyPath, {unique})`; `db.transaction(stores, mode)` with
  `objectStore().get/put/delete/getAll/clear`, `index().get/getAll`, `oncomplete`, `onerror`,
  `onabort`; requests settle asynchronously in microtask order; values are stored with
  `structuredClone` (so Blobs survive). Fault options: `{hangOpen:true}` (never fires success),
  `failNextWrite:'QuotaExceededError'|'AbortError'`, `quotaBytes:int` (puts beyond the total size
  fail with `QuotaExceededError`), `corruptOnRead:id` (returns a damaged record once).
- `localStorage()`: `getItem`, `setItem` (with a `quotaBytes` option throwing a DOMException
  named `QuotaExceededError`), `removeItem`, `key`, `length`, `clear`.
- `offlineContext({seconds, sampleRate = 48000, channels = 2})`: `new OfflineAudioContext(channels,
  ceil(seconds * sampleRate), sampleRate)`; `onsets(buffer, {threshold, channel})` returns the times
  where `abs(sample)` first exceeds the threshold after at least 10 ms below it, used by the
  scheduling-precision tests (onset within 1 ms of the intended time).
- `inputs`: wrappers over `FLM.Input.synthesize` (06b) so synthesized events go through the real
  handlers; `event(control, type, tAudio, source)` emits a ready-made `input.event` payload for
  judge-level tests (`tPerf` computed back through the anchor).
- `stub(obj, method, impl)`: saves `obj[method]`, replaces it with a spy that records calls and
  delegates to `impl` (or returns undefined), and restores it after the test. Decision for
  stubbing namespaces: `FLM.Core.define` freezes namespace objects only in the shipped build
  (`FLM.BUILD.test === false`); in the test build it applies `Object.seal` recursively to the
  namespace and its nested plain objects (members stay replaceable, nothing can be added), while
  the exported data tables of S-07 are deep-frozen in both builds. A stub therefore replaces
  cross-module calls (`FLM.Storage.pickFile`), never a module's internal closures; stubbing a
  frozen table throws `cannot stub frozen <method>`.

6.31.4.4 Results object

The shape of Part 3.4.4 (the contract read by `tools/selftest.mjs`):

```json
{ "version": "1.0.0", "build": "1.0.0 2026-11-02 test", "userAgent": "...",
  "startedAt": "ISO", "finishedAt": "ISO",
  "options": { "groups": null, "slow": false, "grep": "", "touch": false },
  "known": ["core", "..."], "unknown": [],
  "groups": [ { "name": "core", "total": 28, "passed": 28, "failed": 0, "skipped": 0, "ms": 120 } ],
  "tests": [ { "group": "core", "name": "UT-01-01 define registers namespace", "pass": true, "skipped": false, "ms": 1, "message": "" } ],
  "total": 28, "passed": 28, "failed": 0, "skipped": 0, "pageErrors": [] }
```

Every `tests[]` entry carries at least `{group, name, pass, ms, message}` (ADR-11); `skipped` is
added. `pageErrors` is filled by the tool, not by the runner. An unknown group name appears in
`unknown` and contributes zero tests (the tool fails the run, 3.4.1).

6.31.4.5 Corpus and performance hooks

- `corpus.load(entries)`: for each `{file, base64, fnv1a32, recipe, format, expect}`: decode base64
  to a `Uint8Array` (`atob` then byte copy), compute `fnv1a32` over the byte values (the same
  algorithm as `Core.fnv1a32` applied to bytes 0..255 instead of UTF-16 code units, matching
  `tools/make-corpus.mjs`), compare; a mismatch records the file in `corpus.errors` and every test
  of the `files` group fails with `corpus hash mismatch: <file>` (3.4.3 step 4a). `has(file)` and
  `get(file)` serve tests; tests needing the corpus call `t.skip('corpus not loaded (run
  tools/selftest.mjs)')` when `!corpus.loaded()`.
- `perf.register(name, fn)` is called by `92-test-perf-smoke.js` for every Part 9.7 scenario; `perf.
  run(name, {durationMs})` leaves any mode, runs `fn(opts)` (which enters modes and measures),
  leaves again, and resolves `{name, durationMs, metrics, notes}`; unknown names resolve `{name,
  durationMs:0, metrics:{}, notes:['unknown scenario']}`.

6.31.4.6 Self-test panel on SCR-Diagnostics (test build)

Shown only when `FLM.SelfTest` exists. Content: group checklist (all `KNOWN_GROUPS` with test
counts from `groups()`), "Include slow tests" toggle, filter field (grep), buttons "Run
selected" and "Run all", a progress line from `progress()` polled every 250 ms ("Running audio
(5 of 36), 112 passed, 0 failed"), the results table (group, total, pass, fail, skip, ms), the
failure list (`group/name :: message`), "Copy results JSON" (`JSON.stringify(results, null, 2)`
through the clipboard helper), and the notice "corpus not loaded (run tools/selftest.mjs)" when
the corpus is empty. Running: the panel calls `await Modes.leave('user')`, `r = await
FLM.selfTest(groups, {slow, grep, touch: document.body.classList.contains('touch')})`,
`Settings.set('diagnostics.selfTestLastRun', r.finishedAt, 'ui')`, then `Modes.enter(
'diagnostics', {selfTestResults: r})`, which renders the stored results. The test build also
shows the `TEST BUILD` badge on SCR-MainMenu (6.27.4.4).

#### 6.31.5 Error handling and recovery

| What can fail | Detection | State that remains valid | Retry | User data at risk | User informed how | Degraded mode | Return to known-good | Test |
|---|---|---|---|---|---|---|---|---|
| A test throws or fails | try/catch per test | runner and other tests | rerun | test data only (tests use fakes; storage tests use the fake IndexedDB) | result entry with message | n/a | next test | UT-31-02 |
| A test hangs | timeout race | runner continues | rerun | no | `timeout after <ms> ms` | n/a | next test | UT-31-05 |
| A test leaks resources | group leak check | runner | n/a | no | failed `<group> leak check` entry | n/a | `Modes.leave` before the next group | UT-31-15 |
| A stub is not restored | `activeStubs` restore in finally | original functions | n/a | no | n/a | n/a | automatic | UT-31-12 |
| Corpus bytes corrupted in transit | fnv1a32 check | other groups | rerun the tool | no | `corpus hash mismatch` failures | files group fails | regenerate corpus | UT-31-16 |
| Unknown group requested | name check | n/a | n/a | no | `unknown` list; tool exit 1 | n/a | n/a | UT-31-09 |

#### 6.31.6 Limits and performance notes

- Per-test default timeout 10 s, slow tests 60 s (3.4.6); the whole `--all` run is expected to
  finish inside the tool's 240 s watchdog on the development machine.
- The runner adds < 1 ms overhead per test; results for about 700 tests serialize to < 300 KB.
- Fake IndexedDB keeps everything in memory; tests must not store more than 50 MB (the Chromium
  tab limit is far higher; the cap keeps runs fast).

#### 6.31.7 Spec coverage

B 1.4 (validate each subsystem before integrating the next), B 4.2 (automated tests for timing
and file handling), B 25.1-25.7 (unit, integration, file-format, timing, cross-device and
performance test infrastructure), E 12 and E 13 (test infrastructure for the added sections),
I 13.1 (fault injection through fakes and `FLM.debug.inject`), I 17 (automated quality gates,
regression tests), P 20 (testing and release quality).

#### 6.31.8 Unit tests (group `selftest`, file `src/91-test-selftest.js`)

All tests use `createRunner()` so the inner runs do not touch the real registry or
`window.__FLM_RESULTS` (except UT-31-10, which saves and restores it).

| ID | Name | Setup | Assertion |
|---|---|---|---|
| UT-31-01 | passing test recorded | inner group with one passing test | result `pass:true`, `skipped:false`, `ms >= 0`, `message === ''` |
| UT-31-02 | failing assertion recorded | `t.eq(1, 2)` | `pass:false`; message `expected 2 but got 1`; the next test still runs |
| UT-31-03 | thrown error recorded | test throws `Error('boom')` | `pass:false`, message `boom` |
| UT-31-04 | async test awaited | test awaits a 20 ms timer then asserts | pass; `ms >= 20` |
| UT-31-05 | timeout | test with `{timeoutMs: 50}` awaiting a never-resolving promise | fail with `timeout after 50 ms`; the run finishes |
| UT-31-06 | skip | `t.skip('no WebGL2 in headless')` | `skipped:true`, `pass:true`, message is the reason; group `skipped` count 1 |
| UT-31-07 | slow filter | one slow and one normal test; run without and with `{slow:true}` | 1 test then 2 tests reported |
| UT-31-08 | grep filter | tests 'ZZ-01 alpha' and 'ZZ-02 beta'; grep 'BETA' | only the beta test reported |
| UT-31-09 | unknown group | `run('nonsense')` | `unknown` is ['nonsense'], total 0, `known` lists 36 names |
| UT-31-10 | results shape and global | top-level `run('selftest')` with an inner flag preventing recursion | `window.__FLM_RESULTS === returned object`; keys match `RESULT_SHAPE`; group row totals equal the sum of entries |
| UT-31-11 | assertion semantics | near(0.1 + 0.2, 0.3, 1e-12), within(5, 0, 5), deepEq on nested Map and Float32Array, throws with prefix, rejects with prefix | each passes; a deepEq mismatch message names the differing path |
| UT-31-12 | stubs restored | stub `Math.max` inside a test; next test calls `Math.max` | original behavior in the next test; `activeStubs` empty |
| UT-31-13 | fake clock with transport | `Transport.create({clock: fakes.clock(), bus: new Emitter()})`, load a 120 BPM song, play, advance 1 s | `Math.floor(positionAt(clock.now()))` equals 1,824 (06a anchors `play` at `now + 0.05`: (1.00 - 0.05) s x 1,920 ticks/s) |
| UT-31-14 | fake IndexedDB basics and faults | open v1 with upgrade creating a store and index; put, get, index getAll; then `failNextWrite` | values round-trip; the failing put fires `onerror` with name `QuotaExceededError` and the transaction aborts |
| UT-31-15 | group leak check | inner group whose test creates a `Core.timers.setInterval` with a foreign owner and does not clear it | an extra failed entry `<group> leak check` with `timers` in its message |
| UT-31-16 | corpus hash check | `corpus.load([{file:'a.mid', base64:'TVRoZA==', fnv1a32: 0}])` | `corpus.errors` contains a.mid; `has('a.mid') === false` |

#### 6.31.9 Implementation notes and browser quirks

- Fake timers require that `FLM.Core.timers` and `Core.now()` call `window.setTimeout`,
  `window.requestAnimationFrame` and `performance.now` at call time instead of caching them at
  load; this is a requirement on M-01 (6.1) recorded here so the 06a implementation honors it.
- `performance.now` is a method on `Performance.prototype`; the fake assigns an own property on
  the `performance` instance and deletes it on uninstall (works in Chromium, Firefox and Safari).
- `OfflineAudioContext` in headless Chromium renders faster than real time, which makes the audio
  scheduling tests deterministic; real-time drift tests (TT, 10 min) are `slow` and use the real
  context with the autoplay flag of 3.4.2.
- `structuredClone` exists in all target browsers; the fake IndexedDB falls back to a JSON round
  trip for plain data where it does not (tests that store Blobs then skip with a reason).
- The runner never calls `alert`, `confirm` or `prompt` (the tool records dialogs as failures).
