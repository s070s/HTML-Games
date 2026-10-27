// 26-ui.js - M-26 FLM.UI: screen stack, focus, dialogs, toasts, widgets, responsive layout, touch pads, HUD,
// accessibility (focus ring, reduced motion, high contrast, UI scale) and the user-facing text table.
// Separation rule: this file owns exactly one namespace (UI) and registers it once through FLM.Core.define.
// It uses only FLM.Core (M-01). It declares no module-level global state object (S-07): all state lives
// inside the factory closure. Spec: Part 6.26 (API 6.26.2, algorithms 6.26.4), Part 7.1 to 7.11, Part 10.5.
// The widget, screen and HUD style rules are injected here (shell.html keeps S02 to S05 empty); see STYLE_RULES.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.define('UI', function (FLM) {
  const Core = FLM.Core;
  const { assert, clamp } = Core;
  const bus = Core.bus;
  const doc = window.document;

  // ---------------------------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------------------------
  const UI_OWNER = Symbol('ui');             // owner of M-26's own permanent listeners, timers and subscriptions
  const PADS_OWNER = Symbol('ui.pads');      // owner of the pad listeners and the pad input subscription
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const HISTORY_FLAG = 1;                    // history.state.flm value of every entry M-26 creates
  const MAX_DIALOGS = 3;
  const MAX_TOASTS_VISIBLE = 3;
  const MAX_TOASTS_QUEUED = 10;
  const TOAST_DEDUPE_MS = 10000;
  const TOAST_MS = Object.freeze({ info: 3000, success: 2500, warn: 5000, error: 7000 });
  const TOAST_ACTION_MS = 8000;
  const TOAST_MIN_MS = 1500;
  const TOAST_MAX_MS = 15000;
  const TOAST_ICONS = Object.freeze({ info: 'info', success: 'check', warn: 'warn', error: 'error' });
  const PRESS_FEEDBACK_MS = 80;              // pressed scale 0.97 stays this long (P 21)
  const SPINNER_DELAY_MS = 300;              // a loading indicator never shows earlier (P 21)
  const STATE_RESET_MS = 2000;               // success and error return to idle after this long
  const SLIDER_INPUT_MS = 100;               // onInput of a slider is coalesced to 10 Hz
  const RESIZE_DEBOUNCE_MS = 100;
  const ORIENTATION_RECHECK_MS = 300;        // iOS reports the old size in the first orientationchange event
  const COMPACT_BELOW = 600;                 // min(width, height) in CSS px
  const NARROW_BELOW = 720;
  const WIDE_FROM = 1200;
  const SCALE_MIN = 0.8;
  const SCALE_MAX = 1.5;
  const SCALE_STEP = 0.05;
  const COMPACT_SCALE_CAP = 1.3;             // keeps four pads at 56 px or more on a 360 px phone
  const PAD_SIZES = Object.freeze({ small: 56, medium: 72, large: 88 });
  const PAD_SIZE_ORDER = Object.freeze(['small', 'medium', 'large']);
  const PAD_GAP = 8;
  const PAD_GAP_TIGHT = 4;
  const PAD_BAND_PORTRAIT = 0.28;
  const PAD_BAND_LANDSCAPE = 0.24;
  const PAD_GLYPH_FRACTION = 0.4;
  const PAD_COUNT = 4;
  const FEW_TOUCHES_BELOW = 4;
  const HUD_APPLY_MS = 33;                   // HUD writes are coalesced to 30 Hz
  const HUD_FLASH_MS = 120;
  const HUD_WORD_MS = 450;
  const COMBO_MILESTONE = 25;
  const COMBO_MIN_SHOWN = 2;
  const TEXT_MAX_NAME = 16;                  // performer and peer labels
  const GAMEPAD_POLL_MS = 100;
  const GAMEPAD_REPEAT_DELAY_MS = 400;
  const GAMEPAD_REPEAT_MS = 120;
  const TRUNCATE_MIN = 8;
  const BUTTON_KINDS = Object.freeze(['primary', 'secondary', 'danger', 'ghost']);
  const WIDGET_STATES = Object.freeze(['idle', 'loading', 'success', 'error']);
  const NAV_KEYS = Object.freeze(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space',
    'Escape', 'Home', 'End', 'PageUp', 'PageDown']);
  const UNIT_SUFFIX = Object.freeze({ ms: ' ms', '%': '%', dB: ' dB', BPM: ' BPM', x: 'x', '': '' });
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const TEXT_FIELD_SELECTOR = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):' +
    'not([type="button"]), textarea, [contenteditable="true"]';
  // Gamepad menu navigation (Part 6.26.4.4): standard mapping buttons -> key code, repeat only for the d-pad.
  const GAMEPAD_KEYS = Object.freeze([
    { button: 12, code: 'ArrowUp', key: 'ArrowUp', repeat: true },
    { button: 13, code: 'ArrowDown', key: 'ArrowDown', repeat: true },
    { button: 14, code: 'ArrowLeft', key: 'ArrowLeft', repeat: true },
    { button: 15, code: 'ArrowRight', key: 'ArrowRight', repeat: true },
    { button: 0, code: 'Enter', key: 'Enter', repeat: false },
    { button: 1, code: 'Escape', key: 'Escape', repeat: false }
  ]);

  // Which HUD parts each kind shows (Part 6.26.4.10). A value of 'pref' means a setting decides.
  const HUD_PARTS = Object.freeze({
    instrument: { score: 1, combo: 1, accuracy: 1, judgment: 1, progress: 1, section: 1, performers: 1,
      beat: 'flashOnBeat',
      countin: 1, pause: 'touch' },
    dance: { score: 1, combo: 1, accuracy: 1, judgment: 1, progress: 1, section: 1, beat: 1, life: 'lifeBar',
      countin: 1,
      step: 1, pause: 'touch' },
    freeplay: { performers: 1, beat: 1, chord: 1, keyinfo: 1, countin: 1, pause: 'touch' },
    studio: { progress: 1, section: 1, performers: 1, beat: 1, countin: 1 },
    multiplayer: { score: 1, combo: 1, accuracy: 1, judgment: 1, progress: 1, section: 1, performers: 1,
      beat: 'flashOnBeat', sync: 1, peers: 1, countin: 1, pause: 'touch' },
    tutorial: { score: 1, combo: 1, accuracy: 1, judgment: 1, progress: 1, beat: 1, countin: 1, step: 1,
      pause: 'touch' }
  });
  const JUDGMENTS = Object.freeze(['perfect', 'great', 'good', 'miss']);
  const TRANSPORT_BUTTONS = Object.freeze(['play', 'pause', 'stop', 'record', 'loop', 'metronome', 'rewind']);

  // ---------------------------------------------------------------------------------------------
  // Text table (Part 7.11; rule 5: ASCII only). Ids with {name} placeholders are filled by text().
  // ---------------------------------------------------------------------------------------------
  const TEXT = Object.freeze({
    'pads.shrunk': 'Touch pads were made smaller to fit this screen.',
    'pads.fewTouches': 'This device reports {n} simultaneous touches, so chords may need fewer fingers.',
    'pads.lane0': 'Circle pad', 'pads.lane1': 'Triangle pad', 'pads.lane2': 'Square pad', 'pads.lane3': 'Diamond pad',
    'pads.dance0': 'Left arrow pad', 'pads.dance1': 'Down arrow pad', 'pads.dance2': 'Up arrow pad',
    'pads.dance3': 'Right arrow pad',
    'field.pauseToEdit': 'Pause to edit this field.',
    'field.invalid': 'This value is not allowed.',
    'number.range': 'Allowed: {min} to {max}',
    'number.invalid': 'Enter a number.',
    'number.decrease': 'Decrease {label}',
    'number.increase': 'Increase {label}',
    'dlg.unsaved.consequence': 'Unsaved changes ({count}) are lost if you leave without saving.',
    'dlg.unsaved.save': 'Save and leave',
    'dlg.unsaved.discard': 'Leave without saving',
    'dlg.unsaved.cancel': 'Cancel',
    'ui.on': 'On', 'ui.off': 'Off', 'ui.back': 'Back', 'ui.backTo': 'Back to {name}', 'ui.close': 'Close',
    'ui.closeToast': 'Close notification', 'ui.loading': 'Loading', 'ui.noProject': 'No project open',
    'hud.pause': 'Pause', 'hud.progress': 'Song progress', 'hud.life': 'Life {n}%',
      'hud.step': 'Step {index} of {total}',
    'hud.countIn': 'Count-in {n}',
    'judgment.perfect': 'Perfect', 'judgment.great': 'Great', 'judgment.good': 'Good', 'judgment.miss': 'Miss',
    'sync.good': 'Sync good', 'sync.fair': 'Sync fair', 'sync.poor': 'Sync poor',
    'sr.getReady': 'Get ready', 'sr.combo': '{n} combo',
    'transport.play': 'Play', 'transport.pause': 'Pause', 'transport.stop': 'Stop', 'transport.record': 'Record',
    'transport.loop': 'Loop', 'transport.metronome': 'Metronome', 'transport.rewind': 'Rewind to start',
    'transport.countIn': 'Count-in {n}',
    'screen.SCR-FirstLaunch': 'Welcome', 'screen.SCR-MainMenu': 'Main menu', 'screen.SCR-QuickPlay': 'Quick Play',
    'screen.SCR-Instrument': 'Instrument Mode', 'screen.SCR-FreePlay': 'Free Play', 'screen.SCR-Studio': 'Studio',
    'screen.SCR-Library': 'Song Library', 'screen.SCR-ImportInspect': 'Import Music', 'screen.SCR-Dance': 'Dance Mode',
    'screen.SCR-Multiplayer': 'Multiplayer', 'screen.SCR-Characters': 'Characters', 'screen.SCR-Settings': 'Settings',
    'screen.SCR-Help': 'Help and Controls', 'screen.SCR-About': 'About', 'screen.SCR-Diagnostics': 'Diagnostics',
    'screen.SCR-Tutorial': 'Tutorial', 'screen.SCR-Results': 'Results', 'screen.SCR-Pause': 'Paused'
  });

  // ---------------------------------------------------------------------------------------------
  // Style rules and glyphs (tokens come from shell.html; no gradients, glow or blur, Part 7.1.7)
  // ---------------------------------------------------------------------------------------------
  const STYLE_RULES = [
    // shell.html: "html, body { font-size: var(--fs-3) }" comes after the scale rule and cancels it on the root.
    'html { font-size: calc(16px * var(--ui)); }',
    '.safe-probe { position: absolute; left: 0; top: 0; width: 0; height: 0; visibility: hidden; pointer-events: ' +
      'none;' +
      ' padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); }',
    '.icon { width: 1.25em; height: 1.25em; flex: none; fill: none; stroke: currentColor; stroke-width: 2;' +
      ' stroke-linecap: round; stroke-linejoin: round; vertical-align: -0.2em; }',
    '.icon.solid { fill: currentColor; stroke: none; }',
    '.screen { position: absolute; inset: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);' +
      ' display: flex; flex-direction: column; min-width: 0; overflow: hidden; background: var(--c-bg-2); }',
    '.topbar { display: flex; align-items: center; gap: var(--sp-3); flex: 0 0 auto; min-height: 3.5rem;' +
      ' padding: 0 var(--sp-3); background: var(--c-panel); border-bottom: var(--border); }',
    '.title-block { flex: 1 1 auto; min-width: 0; }',
    '.topbar h1 { margin: 0; font-size: var(--fs-5); line-height: var(--lh-tight); font-weight: var(--fw-bold); }',
    '.topbar h1, .subtitle, .ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.subtitle { margin: 0; font-size: var(--fs-2); color: var(--c-text-muted); }',
    '.status-chips { display: flex; gap: var(--sp-2); flex: none; font-size: var(--fs-2); }',
    '.screen-body { flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; touch-action: pan-y;' +
      ' overscroll-behavior: contain; padding: var(--sp-4); }',
    'body.compact .screen-body { padding: var(--sp-3); }',
    '.actionbar { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: var(--sp-2);' +
      ' padding: var(--sp-3); background: var(--c-panel); border-top: var(--border); }',
    '.btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);' +
      ' max-width: 100%; min-width: max(44px, 2.75rem); min-height: max(44px, 2.75rem); padding: var(--sp-2) ' +
        'var(--sp-4);' +
      ' border: var(--border); border-radius: var(--r-2); background: var(--c-panel-2); color: var(--c-text);' +
      ' font: inherit; font-size: var(--fs-3); font-weight: var(--fw-medium); cursor: pointer;' +
      ' transition: transform var(--t-fast) var(--ease), border-color var(--t-base) var(--ease); }',
    'body.touch .btn { min-width: var(--touch-min); min-height: var(--touch-min); }',
    'body:not(.touch) .btn:hover { border-color: var(--c-text-muted); }',
    '.btn.pressed { transform: scale(0.97); }',
    '.btn-primary { background: var(--c-accent); border-color: transparent; color: var(--c-accent-ink); }',
    '.btn-danger { border-color: var(--c-error); color: var(--c-error); }',
    '.btn-ghost { background: transparent; border-color: transparent; }',
    '.btn.icon-only { padding: var(--sp-2); }',
    '.btn[aria-pressed="true"] { background: var(--c-accent); color: var(--c-accent-ink); }',
    '.btn[aria-disabled="true"] { border-color: var(--c-line); background: var(--c-panel-2); color: ' +
      'var(--c-text-dim);' +
      ' cursor: not-allowed; }',
    '.btn-text { display: flex; flex-direction: column; align-items: center; min-width: 0; }',
    '.reason { margin: 0; font-size: var(--fs-2); font-weight: var(--fw-regular); color: var(--c-text-muted); }',
    '.spinner { display: inline-block; flex: none; width: 1em; height: 1em; border: 2px solid currentColor;' +
      ' border-right-color: transparent; border-radius: 50%; animation: flm-spin 900ms linear infinite; }',
    'html.reduced-motion .spinner { animation: none; }',
    '@keyframes flm-spin { to { transform: rotate(360deg); } }',
    '.widget { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-3); min-width: 0;' +
      ' margin-bottom: var(--sp-3); }',
    '.widget > label, .widget > .label { flex: 0 0 11rem; max-width: 100%; font-size: var(--fs-2);' +
      ' color: var(--c-text-muted); }',
    'body.compact .widget > label, body.compact .widget > .label { flex-basis: 100%; }',
    '.widget > .reason, .widget > .status { flex: 1 0 100%; }',
    '.status { margin: 0; font-size: var(--fs-2); color: var(--c-text-muted); }',
    '.widget[data-state="error"] .status { color: var(--c-error); }',
    '.widget[data-state="success"] .status { color: var(--c-ok); }',
    '.toggle { display: inline-flex; align-items: center; gap: var(--sp-3); min-height: max(44px, 2.75rem);' +
      ' padding: 0 var(--sp-2); border: 0; background: none; color: inherit; font: inherit; cursor: pointer; }',
    'body.touch .toggle { min-height: var(--touch-min); }',
    '.toggle .track { position: relative; flex: none; width: 40px; height: 24px; border-radius: var(--r-pill);' +
      ' border: 2px solid var(--c-text-dim); background: var(--c-line); }',
    '.toggle .thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;' +
      ' background: var(--c-text); transition: transform var(--t-fast) var(--ease); }',
    '.toggle[aria-checked="true"] .track { border-color: var(--c-accent); background: var(--c-accent); }',
    '.toggle[aria-checked="true"] .thumb { transform: translateX(16px); background: var(--c-accent-ink); }',
    '.toggle[aria-disabled="true"] { color: var(--c-text-dim); cursor: not-allowed; }',
    '.slider-row { display: flex; flex: 1 1 12rem; align-items: center; gap: var(--sp-3); min-width: 0; }',
    '.slider { flex: 1 1 auto; min-width: 6rem; height: max(44px, 2.75rem); margin: 0; background: transparent;' +
      ' accent-color: var(--c-accent); touch-action: pan-y; }',
    'body.touch .slider { height: var(--touch-min); }',
    '.slider-value { min-width: 4.5rem; text-align: right; }',
    '.select, .number, .field { min-height: max(44px, 2.75rem); padding: var(--sp-2) var(--sp-3);' +
      ' border: var(--bw) solid var(--c-text-dim); border-radius: var(--r-2); background: var(--c-panel-2);' +
      ' color: var(--c-text); font: inherit; font-size: var(--fs-3); max-width: 100%; }',
    'body.touch .select, body.touch .number, body.touch .field { min-height: var(--touch-min); }',
    '.number { width: 7rem; text-align: right; }',
    '.number-row { display: flex; align-items: center; gap: var(--sp-2); }',
    '.unit { font-size: var(--fs-2); color: var(--c-text-muted); }',
    '.list { list-style: none; margin: 0; padding: 0; overflow-x: hidden; overflow-y: auto; touch-action: pan-y;' +
      ' overscroll-behavior: contain; width: 100%; }',
    '.list > li { position: relative; display: flex; align-items: center; gap: var(--sp-3); min-width: 0;' +
      ' min-height: 56px; padding: var(--sp-2) var(--sp-4); border-bottom: var(--border); cursor: pointer; }',
    '.list > li:focus-visible, .list > li.focus-ring { outline-offset: -2px; }',
    'body:not(.touch) .list > li:hover { background: var(--c-panel-2); }',
    '.list > li[aria-selected="true"] { box-shadow: inset 4px 0 0 var(--c-accent); font-weight: var(--fw-bold); }',
    '.list > li[aria-disabled="true"] { color: var(--c-text-dim); }',
    '.list .item-text { flex: 1 1 auto; min-width: 0; }',
    '.list .primary-text, .list .secondary-text { display: block; overflow: hidden; text-overflow: ellipsis;' +
      ' white-space: nowrap; }',
    '.list .secondary-text { font-size: var(--fs-2); font-weight: var(--fw-regular); color: var(--c-text-muted); }',
    '.badge { flex: none; height: 22px; padding: 0 var(--sp-2); border: var(--border); border-radius: var(--r-pill);' +
      ' font-size: var(--fs-1); line-height: 20px; }',
    '.empty { margin: 0; padding: var(--sp-4); color: var(--c-text-muted); }',
    '.tabs { display: flex; gap: var(--sp-2); border-bottom: var(--border); overflow: hidden; width: 100%; }',
    '.tab { min-height: max(44px, 2.75rem); padding: 0 var(--sp-4); border: 0; border-bottom: 3px solid transparent;' +
      ' background: none; color: var(--c-text-muted); font: inherit; font-weight: var(--fw-medium); cursor: pointer; }',
    'body.touch .tab { min-height: var(--touch-min); }',
    '.tab[aria-selected="true"] { border-bottom-color: var(--c-accent); color: var(--c-text); }',
    '.status-ok { color: var(--c-ok); } .status-warn { color: var(--c-warn); } .status-error { color: ' +
      'var(--c-error); }',
    '.status-info { color: var(--c-accent-2); }',
    '.toast { display: flex; align-items: center; gap: var(--sp-3); max-width: 100%; padding: var(--sp-3);' +
      ' border-left: 4px solid var(--c-accent-2); border-radius: var(--r-2); background: var(--c-panel-2);' +
      ' box-shadow: var(--sh-2); pointer-events: auto; transition: opacity var(--t-base) var(--ease); }',
    '.toast-success { border-left-color: var(--c-ok); } .toast-warn { border-left-color: var(--c-warn); }',
    '.toast-error { border-left-color: var(--c-error); }',
    '.toast-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }',
    '.toast-code { display: block; font-size: var(--fs-1); color: var(--c-text-muted); }',
    'body.in-game #toast { top: calc(var(--safe-top) + 72px); bottom: auto; }',
    '.dialog-layer { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;' +
      ' padding: var(--sp-3); }',
    '.dialog-layer .backdrop { position: absolute; inset: 0; background: var(--c-overlay); }',
    '.dialog { position: relative; width: min(92vw, 32rem); max-height: 100%; overflow-y: auto; padding: var(--sp-5);' +
      ' border: var(--border); border-radius: var(--r-3); background: var(--c-panel); box-shadow: var(--sh-2); }',
    '.dialog h2 { margin: 0 0 var(--sp-3); font-size: var(--fs-4); line-height: var(--lh-tight); }',
    '.dialog p { margin: 0 0 var(--sp-3); }',
    '.consequence { display: flex; align-items: flex-start; gap: var(--sp-2); color: var(--c-warn); }',
    '.dialog-buttons { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--sp-2); margin-top: ' +
      'var(--sp-4); }',
    'body.compact .dialog-buttons { flex-direction: column-reverse; }',
    'body.compact .dialog-buttons .btn { width: 100%; }',
    '.hud-layer { position: absolute; inset: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);' +
      ' pointer-events: none; font-weight: var(--fw-bold); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8); }',
    '.hud-progress { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: var(--c-line); }',
    '.hud-progress-fill { height: 100%; width: 0; background: var(--c-accent-2); }',
    '.hud-left { position: absolute; top: calc(6px + var(--sp-2)); left: var(--sp-3); display: flex;' +
      ' flex-direction: column; gap: var(--sp-1); max-width: 45%; }',
    '.hud-right { position: absolute; top: calc(6px + var(--sp-2)); right: var(--sp-3); display: flex;' +
      ' flex-direction: column; align-items: flex-end; gap: var(--sp-1); max-width: 45%; }',
    '.hud-center { position: absolute; top: 45%; left: 0; right: 0; display: flex; flex-direction: column;' +
      ' align-items: center; gap: var(--sp-1); }',
    '#hud-score { font-size: var(--fs-5); } #hud-combo { font-size: var(--fs-6); }',
    '#hud-judgment { font-size: var(--fs-6); }',
    'html.large-judgment #hud-judgment { transform: scale(1.25); }',
    '#hud-accuracy, #hud-section, #hud-life { font-size: var(--fs-4); font-weight: var(--fw-medium); }',
    '.j-perfect { color: var(--j-perfect); } .j-great { color: var(--j-great); } .j-good { color: var(--j-good); }',
    '.j-miss { color: var(--j-miss); }',
    '.hud-hitline { position: absolute; left: 0; right: 0; bottom: 32%; display: flex; justify-content: center;' +
      ' gap: var(--sp-5); }',
    '.hit-marker { display: inline-flex; width: 2rem; height: 2rem; align-items: center; justify-content: center;' +
      ' border: 2px solid transparent; border-radius: 50%; color: var(--c-text-muted); }',
    '.hit-marker.pulse { border-color: currentColor; color: var(--c-text); }',
    '.hud-note { font-size: var(--fs-2); font-weight: var(--fw-medium); }',
    '.performer { display: inline-flex; align-items: center; gap: var(--sp-1); font-size: var(--fs-2); }',
    '.performer .dot { width: 0.75rem; height: 0.75rem; border: 2px solid currentColor; border-radius: 50%; }',
    '.performer.active .dot { background: currentColor; }',
    '#hud > .hud-button { position: absolute; top: calc(var(--safe-top) + var(--sp-2)); left: ' +
      'calc(var(--safe-left) + var(--sp-2));' +
      ' z-index: 1; }',
    '#touch .pad { position: absolute; left: 0; top: 0; display: flex; align-items: center; justify-content: center;' +
      ' overflow: hidden; border: 2px solid var(--c-line); border-radius: var(--r-3); color: var(--c-text);' +
      ' user-select: none; -webkit-user-select: none; }',
    '.pad-tint { position: absolute; inset: 0; opacity: var(--pad-opacity, 0.75); }',
    '.pad-0 { border-color: var(--lane-0); } .pad-0 .pad-tint { background: var(--lane-0); }',
    '.pad-1 { border-color: var(--lane-1); } .pad-1 .pad-tint { background: var(--lane-1); }',
    '.pad-2 { border-color: var(--lane-2); } .pad-2 .pad-tint { background: var(--lane-2); }',
    '.pad-3 { border-color: var(--lane-3); } .pad-3 .pad-tint { background: var(--lane-3); }',
    '.pad .glyph { position: relative; color: var(--c-text); }',
    '.pad.pressed .pad-tint { opacity: 1; }',
    '.pad.pressed { outline: 2px solid var(--c-text); outline-offset: -4px; }',
    '.pad.pressed .glyph { color: var(--c-bg); }',
    '.transport { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }',
    '.transport .readout { font-size: var(--fs-2); color: var(--c-text-muted); }',
    '.transport .badge { color: var(--c-warn); border-color: var(--c-warn); }',
    '.reduced-motion .toast, .reduced-motion .btn, .reduced-motion .toggle .thumb { transition: none; }'
  ].join('\n');

  // Icons the sprite of shell.html does not carry yet (Part 7.1.3 path data). Added once when absent.
  // Each part is [tag, attributes]; "dot" parts are filled because document CSS cannot reach into <use>.
  const ICON_PARTS = Object.freeze({
    play: [['path', { d: 'M8 5 L19 12 L8 19 Z' }]],
    pause: [['path', { d: 'M7 5 H10 V19 H7 Z M14 5 H17 V19 H14 Z' }]],
    stop: [['path', { d: 'M6 6 H18 V18 H6 Z' }]],
    record: [['circle', { cx: 12, cy: 12, r: 6.5 }]],
    loop: [['path', { d: 'M17 2 L21 6 L17 10 M3 11 V9 A3 3 0 0 1 6 6 H21 M7 22 L3 18 L7 14 M21 13 V15 A3 3 0 0 1 ' +
      '18 18 H3' }]],
    metronome: [['path', { d: 'M8.5 3 H15.5 L20 21 H4 Z M12 17 L17.5 6' }]],
    rewind: [['path', { d: 'M19 5 L10 12 L19 19 Z M6 5 V19' }]],
    back: [['path', { d: 'M15 5 L8 12 L15 19' }]],
    close: [['path', { d: 'M6 6 L18 18 M18 6 L6 18' }]],
    check: [['path', { d: 'M5 12 L10 17 L19 7' }]],
    plus: [['path', { d: 'M12 5 V19 M5 12 H19' }]],
    minus: [['path', { d: 'M5 12 H19' }]],
    volume: [['path', { d: 'M4 9 H8 L13 5 V19 L8 15 H4 Z M16 8.5 A5 5 0 0 1 16 15.5' }]],
    mute: [['path', { d: 'M4 9 H8 L13 5 V19 L8 15 H4 Z M16 9 L21 14 M21 9 L16 14' }]],
    info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11 V17' }],
      ['circle', { cx: 12, cy: 7.5, r: 1.1, fill: 'currentColor', stroke: 'none' }]],
    warn: [['path', { d: 'M12 3 L22 20 H2 Z M12 9 V14' }],
      ['circle', { cx: 12, cy: 17, r: 1.1, fill: 'currentColor', stroke: 'none' }]],
    error: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M9 9 L15 15 M15 9 L9 15' }]],
    'j-perfect': [['path',
      { d: 'M12 3 L14.6 9.2 L21.3 9.7 L16.2 14 L17.8 20.5 L12 17 L6.2 20.5 L7.8 14 L2.7 9.7 L9.4 9.2 Z' }]],
    'j-great': [['circle', { cx: 12, cy: 12, r: 7 }]],
    'j-good': [['circle', { cx: 12, cy: 12, r: 4 }]],
    'j-miss': [['path', { d: 'M6 6 L18 18 M18 6 L6 18' }]]
  });
  const SOLID_ICONS = Object.freeze(['play', 'pause', 'stop', 'record', 'j-perfect', 'j-good']);

  // ---------------------------------------------------------------------------------------------
  // State (inside the closure; Part 6.26.3)
  // ---------------------------------------------------------------------------------------------
  const stack = [];                                         // {id, params, controller, root, owner, focusBefore}
  const hist = { enabled: false, ignorePops: 0 };
  const dialogs = [];                                       // {id, spec, layer, root, resolve, trap, focusBefore}
  const toasts = { visible: [], queue: [], recent: new Map(), deduped: 0 };
  const traps = [];                                         // {root, owner, handle}; the last one is active
  const liveWidgets = new Set();                            // widget bases, for cleanup by screen and by dialog
  const gamepadNav = { timer: null, held: {}, connected: new Set() };
  const presentation = { reducedMotion: false, mode: 'system', highContrast: false };
  const prefs = defaultPrefs();
  const hud = { kind: null, owner: null, fields: {}, rendered: {}, shown: {}, els: {}, nodes: [], fill: null,
    built: false, pending: null,
    lastApply: -Infinity, applies: 0, flashTimer: null, wordTimer: null, announcedCombo: 0, lastSection: null };
  const pads = { spec: null, els: [], rects: [], pressed: [false, false, false, false], shrunkNoted: false };
  let layout = emptyLayout();
  let forcedMeasure = null;                                 // set by Layout._measureFrom (tests)
  let requestedScale = 1;
  let resolver = null;
  let initialized = false;
  let focusRingMode = 'pointer';
  let textEntryAllowed = true;
  let contextOwner = null;                                  // owner of the screen mounting or the dialog building
  let probeElement = null;
  let resizeTimer = null;
  let rememberedElement = null;
  let serial = 0;
  let mediaQuery = null;
  let initOptions = {};

  function defaultPrefs() {
    return { screenReaderLabels: true, flashOnBeat: false, largeJudgmentText: false, showJudgmentText: true,
      lifeBar: false, strayPressPenalty: false, padLayout: 'bottom', padSize: 'medium', padOpacity: 0.75 };
  }

  function emptyLayout() {
    return { orientation: 'landscape', width: 0, height: 0, dpr: 1, compact: false, widthClass: 'wide',
      safeArea: { top: 0, right: 0, bottom: 0, left: 0 }, scale: 1 };
  }

  // ---------------------------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------------------------
  function codedError(code, message) {
    const error = new Error(code + ': ' + message);
    error.code = code;
    return error;
  }

  function report(code, error, context) {
    return Core.ErrorReporter.report(code, error, context);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function keyName(evt) {
    return evt.code === 'NumpadEnter' ? 'Enter' : evt.code;
  }

  function isTextField(node) {
    return Boolean(node && node.nodeType === 1 && node.matches(TEXT_FIELD_SELECTOR));
  }

  function bodyHas(className) {
    return doc.body.classList.contains(className);
  }

  function fillText(template, vars) {
    return template.replace(/\{(\w+)\}/g, function (match, name) {
      return vars && hasOwn(vars, name) ? String(vars[name]) : '';
    });
  }

  /** Catalog lookup with {name} substitution. M-26's own table first, then FLM.Core.Text; unknown id -> the id. */
  function text(id, vars) {
    const key = String(id);
    if (hasOwn(TEXT, key)) return fillText(TEXT[key], vars);
    if (Core.Text.has(key)) return Core.Text.get(key, vars);
    Core.Log.once('ui.text.' + key, 'warn', 'ui', 'unknown text id ' + key);
    return key;
  }

  /** @returns {string} str cut to maxChars (minimum 8) with "..." (ASCII); keepExt keeps a short file extension. */
  function truncate(str, maxChars, opts) {
    const value = String(str);
    const max = Math.max(TRUNCATE_MIN, Math.floor(Number(maxChars) || 0));
    if (value.length <= max) return value;
    const dot = value.lastIndexOf('.');
    if (opts && opts.keepExt && dot >= 0 && dot >= value.length - 6) {
      const extension = value.slice(dot);
      return value.slice(0, max - 3 - extension.length) + '...' + extension;
    }
    return value.slice(0, max - 3) + '...';
  }

  function decimalsOf(step) {
    const parts = String(step).split('.');
    return parts.length > 1 ? parts[1].length : 0;
  }

  // ---------------------------------------------------------------------------------------------
  // DOM builder (never an HTML string; text goes in as text nodes)
  // ---------------------------------------------------------------------------------------------
  function attachHandlers(node, handlers, owner) {
    if (!handlers) return;
    Object.keys(handlers).forEach(function (type) {
      Core.dom.on(node, type, handlers[type], undefined, owner);
    });
  }

  function applyAttributes(node, attrs) {
    Object.keys(attrs).forEach(function (name) {
      if (name === 'on' || name === 'owner') return;
      assert(!/^on/i.test(name), 'el refuses the event attribute ' + name + '; use the on option');
      const value = attrs[name];
      if (value === undefined || value === null || value === false) return;
      const textValue = value === true ? '' : String(value);
      assert(!((name === 'href' || name === 'src') && /^\s*javascript:/i.test(textValue)),
        'el refuses a script address');
      node.setAttribute(name, textValue);
    });
  }

  function appendChildren(node, children) {
    if (children === undefined || children === null || children === false) return;
    if (Array.isArray(children)) {
      children.forEach((child) => appendChildren(node, child));
      return;
    }
    node.appendChild(typeof children === 'object' ? children : doc.createTextNode(String(children)));
  }

  /** DOM builder: el('button', {class:'btn', 'aria-label':'Play', on:{click:fn}, owner:token}, [child...]). */
  function el(tag, attrs, children) {
    assert(typeof tag === 'string' && tag !== '', 'el needs a tag name');
    const options = attrs || {};
    const node = doc.createElement(tag);
    applyAttributes(node, options);
    attachHandlers(node, options.on, options.owner || UI_OWNER);
    appendChildren(node, children);
    return node;
  }

  /** A sprite icon: <svg class="icon"><use href="#g-name"></use></svg> (name without the g- prefix). */
  function icon(name, extraClass) {
    const svg = doc.createElementNS(SVG_NS, 'svg');
    const solid = SOLID_ICONS.indexOf(name) >= 0;
    svg.setAttribute('class', (solid ? 'icon solid' : 'icon') + (extraClass ? ' ' + extraClass : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = doc.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#g-' + name);
    svg.appendChild(use);
    return svg;
  }

  /** A lane or arrow glyph from the shell sprite (class glyph keeps the high-contrast outline). */
  function laneGlyph(name) {
    const svg = icon(name);
    svg.setAttribute('class', 'glyph');
    return svg;
  }

  function installStyles() {
    if (doc.getElementById('flm-ui-style')) return;
    const style = doc.createElement('style');
    style.id = 'flm-ui-style';
    style.textContent = STYLE_RULES;
    doc.head.appendChild(style);
  }

  function installGlyphs() {
    const sprite = doc.getElementById('glyphs');
    if (!sprite) return;
    Object.keys(ICON_PARTS).forEach(function (name) {
      if (doc.getElementById('g-' + name)) return;
      const symbol = doc.createElementNS(SVG_NS, 'symbol');
      symbol.setAttribute('id', 'g-' + name);
      symbol.setAttribute('viewBox', '0 0 24 24');
      ICON_PARTS[name].forEach(function (part) {
        const shape = doc.createElementNS(SVG_NS, part[0]);
        Object.keys(part[1]).forEach((attribute) => shape.setAttribute(attribute, String(part[1][attribute])));
        symbol.appendChild(shape);
      });
      sprite.appendChild(symbol);
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Layout, safe areas, scale (Part 6.26.4.8)
  // ---------------------------------------------------------------------------------------------
  function finiteOrZero(value) {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function sanitizeInsets(insets) {
    const source = insets || {};
    return { top: finiteOrZero(source.top), right: finiteOrZero(source.right), bottom: finiteOrZero(source.bottom),
      left: finiteOrZero(source.left) };
  }

  function ensureProbe() {
    if (probeElement && probeElement.isConnected) return probeElement;
    probeElement = el('div', { class: 'safe-probe', 'aria-hidden': 'true' });
    doc.body.appendChild(probeElement);
    return probeElement;
  }

  function readSafeArea() {
    const style = window.getComputedStyle(ensureProbe());
    return sanitizeInsets({ top: parseFloat(style.paddingTop), right: parseFloat(style.paddingRight),
      bottom: parseFloat(style.paddingBottom), left: parseFloat(style.paddingLeft) });
  }

  // All geometry is read first; the classes are written afterwards (no layout thrash).
  function readMetrics() {
    if (forcedMeasure) return forcedMeasure;
    return { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1,
      safeArea: readSafeArea() };
  }

  function describeLayout(metrics) {
    const width = Math.round(metrics.width);
    const height = Math.round(metrics.height);
    return {
      orientation: width < height ? 'portrait' : 'landscape',
      width,
      height,
      dpr: metrics.dpr,
      compact: Math.min(width, height) < COMPACT_BELOW,
      widthClass: width < NARROW_BELOW ? 'narrow' : width < WIDE_FROM ? 'medium' : 'wide',
      safeArea: sanitizeInsets(metrics.safeArea)
    };
  }

  function sameInsets(a, b) {
    return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
  }

  function layoutDiffers(a, b) {
    return a.orientation !== b.orientation || a.width !== b.width || a.height !== b.height || a.dpr !== b.dpr ||
      a.compact !== b.compact || !sameInsets(a.safeArea, b.safeArea);
  }

  function writeLayoutClasses() {
    const body = doc.body;
    body.classList.toggle('portrait', layout.orientation === 'portrait');
    body.classList.toggle('landscape', layout.orientation === 'landscape');
    body.classList.toggle('compact', layout.compact);
    body.dataset.width = layout.widthClass;
  }

  function snapshot() {
    return { orientation: layout.orientation, width: layout.width, height: layout.height, dpr: layout.dpr,
      compact: layout.compact, safeArea: Object.assign({}, layout.safeArea) };
  }

  function applyLayout(next) {
    const changed = layoutDiffers(layout, next);
    const compactChanged = layout.compact !== next.compact;
    layout = Object.assign({}, next, { scale: layout.scale });
    writeLayoutClasses();
    if (compactChanged) applyScale();
    if (!changed) return;
    bus.emit('ui.layout', snapshot());
    if (pads.els.length > 0) layoutPads();
  }

  function measure() {
    applyLayout(describeLayout(readMetrics()));
  }

  /** Test hook: pretend the viewport has these dimensions until the next call with null. */
  function measureFrom(input) {
    forcedMeasure = input ? {
      width: Number(input.width), height: Number(input.height), dpr: Number(input.dpr) || 1,
      safeArea: input.safeArea ? sanitizeInsets(input.safeArea) : readSafeArea()
    } : null;
    measure();
  }

  function snapScale(value) {
    const stepped = Math.round(value / SCALE_STEP) * SCALE_STEP;
    return Number(clamp(stepped, SCALE_MIN, SCALE_MAX).toFixed(2));
  }

  function applyScale() {
    const cap = layout.compact ? COMPACT_SCALE_CAP : SCALE_MAX;
    layout.scale = Math.min(requestedScale, cap);
    doc.documentElement.style.setProperty('--ui', String(layout.scale));
  }

  /** @param {number} scale 0.8..1.5 @returns {number} the scale applied (capped at 1.3 on compact layouts) */
  function setScale(scale) {
    const value = Number(scale);
    requestedScale = Number.isFinite(value) ? snapScale(value) : 1;
    applyScale();
    measure();
    return layout.scale;
  }

  function systemPrefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** @param {'system'|'on'|'off'} mode @returns {boolean} the effective reduced-motion state */
  function setReducedMotion(mode) {
    presentation.mode = mode === 'on' || mode === 'off' ? mode : 'system';
    const forcedOn = presentation.mode === 'on';
    presentation.reducedMotion = presentation.mode === 'system' ? systemPrefersReducedMotion() : forcedOn;
    const root = doc.documentElement;
    root.classList.toggle('reduced-motion', presentation.reducedMotion);
    root.classList.toggle('motion-full', presentation.mode === 'off');
    return presentation.reducedMotion;
  }

  function setHighContrast(on) {
    presentation.highContrast = Boolean(on);
    doc.documentElement.classList.toggle('high-contrast', presentation.highContrast);
  }

  function setTextEntryAllowed(allowed) {
    textEntryAllowed = Boolean(allowed);
    liveWidgets.forEach((base) => { if (base.isField) applyTextEntry(base); });
    if (!textEntryAllowed && isTextField(doc.activeElement)) {
      doc.activeElement.blur();
      focusHeading();
    }
  }

  const Layout = Object.freeze({
    orientation: () => layout.orientation,
    safeArea: () => Object.assign({}, layout.safeArea),
    compact: () => layout.compact,
    widthClass: () => layout.widthClass,
    setScale,
    snapshot,
    scale: () => layout.scale,
    _measureFrom: measureFrom
  });

  // ---------------------------------------------------------------------------------------------
  // Focus (Part 6.26.4.3)
  // ---------------------------------------------------------------------------------------------
  function isFocusableNow(node) {
    return node.getClientRects().length > 0 && !node.closest('[inert]');
  }

  function focusable(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter(isFocusableNow);
  }

  function setFocusRingMode(mode) {
    if (focusRingMode === mode) return;
    focusRingMode = mode;
    doc.documentElement.classList.toggle('kbd-nav', mode === 'key');
    if (mode === 'pointer') {
      Array.from(doc.querySelectorAll('.focus-ring')).forEach((node) => node.classList.remove('focus-ring'));
    }
  }

  // Programmatic focus does not always match :focus-visible, so the ring class is the fallback.
  function focusNode(node) {
    node.focus({ preventScroll: true });
    if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
    if (focusRingMode === 'key') node.classList.add('focus-ring');
    return node;
  }

  function headingOf(root) {
    const heading = root.querySelector('h1, h2') || root;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    return heading;
  }

  function topScreenRoot() {
    return stack.length > 0 ? stack[stack.length - 1].root : null;
  }

  function headingScope(node) {
    return node.closest('section.screen, .dialog') || topScreenRoot() || doc.getElementById('overlay');
  }

  // Text fields never get focus on touch devices or during gameplay, so no on-screen keyboard opens by itself.
  function focusHeading() {
    const root = topScreenRoot() || doc.getElementById('overlay');
    if (root) focusNode(headingOf(root));
  }

  function initialFocusOf(root) {
    const entry = stack.find((item) => item.root === root);
    if (entry && typeof entry.controller.initialFocus === 'function') {
      try {
        const chosen = entry.controller.initialFocus();
        if (chosen && chosen.isConnected) return chosen;
      } catch (error) {
        report('E-GEN-001', error, { screen: entry.id, op: 'initialFocus' });
      }
    }
    const automatic = root.querySelector('[data-autofocus]');
    if (automatic && isFocusableNow(automatic)) return automatic;
    const candidates = focusable(root).filter((node) => !(bodyHas('touch') && isTextField(node)));
    return candidates[0] || headingOf(root);
  }

  function resolveFocusTarget(target) {
    if (!target || !target.isConnected) return null;
    if (target.matches(FOCUSABLE) && isFocusableNow(target)) {
      return bodyHas('touch') && isTextField(target) ? headingOf(headingScope(target)) : target;
    }
    return initialFocusOf(target);
  }

  function restore(target) {
    const node = resolveFocusTarget(target || rememberedElement);
    return node ? focusNode(node) : null;
  }

  function remember() {
    const active = doc.activeElement;
    rememberedElement = active && active !== doc.body ? active : null;
    return rememberedElement;
  }

  function activeTrap() {
    return traps.length > 0 ? traps[traps.length - 1] : null;
  }

  // Tab is handled completely here so the cycle is the same in every browser and in tests.
  function onTrapKey(entry, evt) {
    if (keyName(evt) !== 'Tab' || activeTrap() !== entry) return;
    evt.preventDefault();
    const list = focusable(entry.root);
    if (list.length === 0) return;
    const current = list.indexOf(doc.activeElement);
    let next = 0;
    if (evt.shiftKey) next = current <= 0 ? list.length - 1 : current - 1;
    else next = current < 0 || current === list.length - 1 ? 0 : current + 1;
    focusNode(list[next]);
  }

  function releaseEntry(entry) {
    const index = traps.indexOf(entry);
    if (index < 0) return;
    traps.splice(index, 1);
    Core.dom.offOwner(entry.owner);
  }

  /** Trap Tab inside root; stack-based, the newest trap is active. @returns {{release:function}} */
  function trap(root) {
    assert(root && root.nodeType === 1, 'Focus.trap needs an element');
    const entry = { root, owner: Symbol('trap'), handle: null };
    Core.dom.on(root, 'keydown', (evt) => onTrapKey(entry, evt), undefined, entry.owner);
    entry.handle = Object.freeze({ release: () => releaseEntry(entry) });
    traps.push(entry);
    return entry.handle;
  }

  function release(handle) {
    const entry = traps.find((item) => item.handle === handle);
    if (entry) releaseEntry(entry);
  }

  function onFocusIn(evt) {
    const active = activeTrap();
    if (active && !active.root.contains(evt.target)) {
      const list = focusable(active.root);
      if (list.length > 0) focusNode(list[0]);
      return;
    }
    if (!textEntryAllowed && isTextField(evt.target) && evt.target.closest('[data-widget="field"]')) {
      evt.target.blur();
      focusHeading();
    }
  }

  function onFocusOut(evt) {
    if (evt.target && evt.target.classList) evt.target.classList.remove('focus-ring');
  }

  const Focus = Object.freeze({ trap, release, restore, remember, focusable });

  // ---------------------------------------------------------------------------------------------
  // Toasts (Part 6.26.4.7)
  // ---------------------------------------------------------------------------------------------
  function toastHost() {
    return doc.getElementById('toast') || doc.body;
  }

  function toastDuration(entry) {
    const options = entry.options;
    if (Number.isFinite(options.durationMs)) return clamp(options.durationMs, TOAST_MIN_MS, TOAST_MAX_MS);
    return options.action ? TOAST_ACTION_MS : TOAST_MS[entry.kind];
  }

  function buildToastElement(entry) {
    const options = entry.options;
    const owner = entry.owner;
    const statusClass = 'status-' + (entry.kind === 'success' ? 'ok' : entry.kind === 'info' ? 'info' : entry.kind);
    const children = [icon(TOAST_ICONS[entry.kind], statusClass), el('span', { class: 'toast-text' }, [entry.message,
      options.code ? el('span', { class: 'toast-code code' }, String(options.code)) : null])];
    if (options.action) {
      children.push(el('button', { type: 'button', class: 'btn btn-secondary toast-action', owner,
        on: { click: () => runToastAction(entry) } }, String(options.action.label)));
    }
    children.push(el('button', { type: 'button', class: 'btn btn-ghost icon-only toast-close', owner,
      'aria-label': text('ui.closeToast'), on: { click: () => dismissToast(entry.id) } }, icon('close')));
    return el('div', { class: 'toast toast-' + entry.kind, role: entry.kind === 'error' ? 'alert' : 'status',
      'data-toast-id': entry.id }, children);
  }

  function runToastAction(entry) {
    try {
      entry.options.action.onPress();
    } catch (error) {
      report('E-GEN-001', error, { widget: 'toast-action' });
    }
    dismissToast(entry.id);
  }

  function showToast(entry) {
    entry.owner = Symbol('toast');
    entry.element = buildToastElement(entry);
    entry.timer = Core.timers.setTimeout(() => dismissToast(entry.id), toastDuration(entry), UI_OWNER);
    toasts.visible.push(entry);
    toastHost().appendChild(entry.element);
  }

  function dismissToast(id) {
    const index = toasts.visible.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const entry = toasts.visible[index];
    toasts.visible.splice(index, 1);
    Core.timers.clearTimeout(entry.timer);
    Core.dom.offOwner(entry.owner);
    entry.element.remove();
    if (toasts.queue.length > 0 && toasts.visible.length < MAX_TOASTS_VISIBLE) showToast(toasts.queue.shift());
  }

  function pruneRecentToasts(nowMs) {
    toasts.recent.forEach(function (seen, key) {
      if (nowMs - seen.t >= TOAST_DEDUPE_MS) toasts.recent.delete(key);
    });
  }

  /** @param {string} message @param {{kind?:string, action?:object, durationMs?:number, key?:string}=} opts
   *  @returns {string} toast id (the id of the earlier toast when the message was deduplicated) */
  function toast(message, opts) {
    const options = opts || {};
    const kind = hasOwn(TOAST_MS, options.kind) ? options.kind : 'info';
    const key = options.key || String(message);
    const nowMs = Core.now();
    pruneRecentToasts(nowMs);
    const seen = toasts.recent.get(key);
    if (seen) {
      toasts.deduped += 1;
      return seen.id;
    }
    const entry = { id: Core.uid(), message: String(message), kind, options };
    toasts.recent.set(key, { t: nowMs, id: entry.id });
    if (toasts.visible.length < MAX_TOASTS_VISIBLE) {
      showToast(entry);
      return entry.id;
    }
    if (toasts.queue.length >= MAX_TOASTS_QUEUED) toasts.queue.shift();
    toasts.queue.push(entry);
    return entry.id;
  }

  function clearToasts() {
    toasts.visible.slice().forEach((entry) => dismissToast(entry.id));
    toasts.queue.length = 0;
    toasts.recent.clear();
  }

  // The error presenter of M-01 for the recoverable class (Part 6.26.4.12).
  function presentError(record) {
    if (!record || record.class !== 'recoverable' || !record.userMessage) return;
    const context = record.context || {};
    const hasAction = typeof context.onAction === 'function' && typeof context.actionLabel === 'string';
    toast(record.userMessage, { kind: 'error', key: record.code, code: record.code,
      action: hasAction ? { label: context.actionLabel, onPress: context.onAction } : undefined });
  }

  // ---------------------------------------------------------------------------------------------
  // Widgets (Part 6.26.4.5)
  // ---------------------------------------------------------------------------------------------
  function createBase(type, spec) {
    assert(spec && typeof spec.id === 'string' && spec.id !== '', 'Widgets.' + type + ' needs an id');
    const id = 'w-' + spec.id;
    return { type, spec, id, controlId: id + '-control', owner: Symbol('widget.' + spec.id),
      screenOwner: widgetContextOwner(),
      state: 'idle', disabledReason: null, destroyed: false, resetTimer: null, spinnerTimer: null, root: null,
      control: null, reasonEl: null, statusEl: null, handle: null, nativeDisable: false, onDisabled: null,
      isField: false };
  }

  function widgetContextOwner() {
    return contextOwner || (stack.length > 0 ? stack[stack.length - 1].owner : null);
  }

  function currentScreenId() {
    return stack.length > 0 ? stack[stack.length - 1].id : null;
  }

  function onBase(base, target, type, fn, options) {
    Core.dom.on(target, type, fn, options, base.owner);
  }

  // Native keys already click a <button>; synthesized ones (gamepad, tests) are not trusted and need this help.
  function activateOnSyntheticKey(base, node, activate) {
    onBase(base, node, 'keydown', function (evt) {
      const name = keyName(evt);
      if (evt.isTrusted || (name !== 'Enter' && name !== 'Space')) return;
      evt.preventDefault();
      activate();
    });
  }

  function reasonLine(base, insideButton) {
    // A <button> may hold phrasing content only, so its reason line is a span.
    return el(insideButton ? 'span' : 'p', { class: 'reason', id: base.id + '-reason', hidden: true });
  }

  function statusLine(base) {
    base.statusEl = el('p', { class: 'status', id: base.id + '-status', role: 'status', hidden: true });
    return base.statusEl;
  }

  function applyDisabledReason(base, reason) {
    const message = reason ? String(reason) : null;
    base.disabledReason = message;
    const control = base.control;
    if (message) {
      control.setAttribute('aria-disabled', 'true');
      control.setAttribute('aria-describedby', base.reasonEl.id);
      control.setAttribute('title', message);
    } else {
      control.removeAttribute('aria-disabled');
      control.removeAttribute('aria-describedby');
      control.removeAttribute('title');
    }
    base.reasonEl.textContent = message || '';
    base.reasonEl.hidden = !message;
    base.root.classList.toggle('is-disabled', Boolean(message));
    if (base.onDisabled) base.onDisabled(Boolean(message));
  }

  function removeSpinner(base) {
    if (base.spinnerTimer !== null) Core.timers.clearTimeout(base.spinnerTimer);
    base.spinnerTimer = null;
    const spinner = base.root.querySelector('.spinner');
    if (spinner) spinner.remove();
    base.root.classList.remove('show-spinner');
  }

  // The loading indicator appears only after 300 ms so quick actions never flicker (P 21).
  function scheduleSpinner(base) {
    base.spinnerTimer = Core.timers.setTimeout(function () {
      base.spinnerTimer = null;
      if (base.state !== 'loading' || base.destroyed) return;
      base.control.insertBefore(el('span', { class: 'spinner', 'aria-hidden': 'true' }), base.control.firstChild);
      base.root.classList.add('show-spinner');
    }, SPINNER_DELAY_MS, base.owner);
  }

  function applyState(base, state, message) {
    const next = WIDGET_STATES.indexOf(state) >= 0 ? state : 'idle';
    if (base.resetTimer !== null) Core.timers.clearTimeout(base.resetTimer);
    base.resetTimer = null;
    removeSpinner(base);
    base.state = next;
    base.root.setAttribute('data-state', next);
    if (next === 'loading') {
      base.control.setAttribute('aria-busy', 'true');
      scheduleSpinner(base);
    } else {
      base.control.removeAttribute('aria-busy');
    }
    if (base.statusEl) {
      base.statusEl.textContent = message || '';
      base.statusEl.hidden = !message;
    }
    if (next === 'success' || next === 'error') {
      base.resetTimer = Core.timers.setTimeout(() => applyState(base, 'idle'), STATE_RESET_MS, base.owner);
    }
  }

  function failHandler(base, error, operation) {
    report('E-GEN-001', error, { screen: currentScreenId(), widget: base.spec.id, op: operation });
    if (!base.destroyed) applyState(base, 'error');
  }

  /** Runs a widget callback; a throw is reported and puts the widget in its error state (Part 6.26.5). */
  function callHandler(base, fn, argument, operation) {
    if (typeof fn !== 'function') return undefined;
    try {
      return fn(argument);
    } catch (error) {
      failHandler(base, error, operation);
      return undefined;
    }
  }

  function finishWidget(base, api) {
    const handle = Object.freeze(Object.assign({
      root: base.root,
      setDisabled: (reason) => applyDisabledReason(base, reason),
      setState: (state, message) => applyState(base, state, message),
      focus: () => focusWidget(base),
      destroy: () => destroyWidget(base)
    }, api));
    base.handle = handle;
    base.root.setAttribute('data-widget', base.type);
    base.root.setAttribute('id', base.id);
    liveWidgets.add(base);
    return handle;
  }

  function focusWidget(base) {
    if (base.destroyed) return;
    if (base.isField && !textEntryAllowed) {
      focusHeading();
      return;
    }
    focusNode(base.control);
  }

  function destroyWidget(base) {
    if (base.destroyed) return;
    base.destroyed = true;
    liveWidgets.delete(base);
    Core.dom.offOwner(base.owner);
    Core.timers.clearOwner(base.owner);
    bus.removeOwner(base.owner);
    base.root.remove();
  }

  function destroyWidgetsOf(owner, container) {
    Array.from(liveWidgets).forEach(function (base) {
      const inside = container && container.contains(base.root);
      if (base.screenOwner === owner || inside) destroyWidget(base);
    });
  }

  function labelFor(base, labelText) {
    return el('label', { for: base.controlId, id: base.id + '-label' }, labelText);
  }

  function describedBy(base, control) {
    control.setAttribute('aria-describedby', base.reasonEl.id);
  }

  function pressFeedback(base, node) {
    onBase(base, node, 'pointerdown', function () {
      node.classList.add('pressed');
      Core.timers.setTimeout(() => node.classList.remove('pressed'), PRESS_FEEDBACK_MS, base.owner);
    });
  }

  // ---- button
  function buttonClass(kind, iconOnly) {
    const kindClass = kind === 'primary' || kind === 'danger' ? ' ' + kind : '';
    return 'btn btn-' + kind + kindClass + (iconOnly ? ' icon-only' : '');
  }

  function runPress(base, onPress) {
    let result;
    try {
      result = typeof onPress === 'function' ? onPress() : undefined;
    } catch (error) {
      failHandler(base, error, 'onPress');
      return;
    }
    if (!result || typeof result.then !== 'function') return;
    applyState(base, 'loading');
    result.then(function () {
      if (!base.destroyed && base.state === 'loading') applyState(base, 'idle');
    }, (error) => failHandler(base, error, 'onPress'));
  }

  function button(spec) {
    const base = createBase('button', spec);
    assert(spec.label || spec.ariaLabel, 'Widgets.button ' + spec.id + ' needs a label or an aria-label');
    const kind = BUTTON_KINDS.indexOf(spec.kind) >= 0 ? spec.kind : 'secondary';
    const iconOnly = Boolean(spec.icon) && !spec.label;
    base.reasonEl = reasonLine(base, true);
    const labelEl = el('span', { class: 'btn-label' }, spec.label || '');
    const content = [spec.icon ? icon(spec.icon) : null];
    content.push(iconOnly ? base.reasonEl : el('span', { class: 'btn-text' }, [labelEl, base.reasonEl]));
    base.root = base.control = el('button', { type: 'button', class: buttonClass(kind, iconOnly), 'data-state': 'idle',
      'aria-label': spec.ariaLabel || (iconOnly ? spec.label : null) }, content);
    const activate = function () {
      if (base.state === 'loading') return;
      if (base.disabledReason) {
        toast(base.disabledReason, { kind: 'info' });
        return;
      }
      runPress(base, spec.onPress);
    };
    onBase(base, base.root, 'click', activate);
    onBase(base, base.root, 'contextmenu', (evt) => { if (bodyHas('in-game')) evt.preventDefault(); });
    pressFeedback(base, base.root);
    activateOnSyntheticKey(base, base.root, () => base.root.click());
    if (spec.disabledReason) applyDisabledReason(base, spec.disabledReason);
    return finishWidget(base, {
      set: (label) => { labelEl.textContent = String(label); },
      get: () => labelEl.textContent,
      setLabel(label, iconName) {
        labelEl.textContent = String(label);
        const existing = base.root.querySelector('svg.icon');
        if (existing && iconName) existing.replaceWith(icon(iconName));
        if (iconOnly) base.root.setAttribute('aria-label', String(label));
      }
    });
  }

  // ---- toggle
  function toggle(spec) {
    const base = createBase('toggle', spec);
    let value = Boolean(spec.value);
    base.reasonEl = reasonLine(base, false);
    const labelEl = el('span', { class: 'label', id: base.id + '-label' }, spec.label);
    const stateText = el('span', { class: 'state-text' });
    base.control = el('button', { type: 'button', id: base.controlId, class: 'toggle', role: 'switch',
      'aria-labelledby': base.id + '-label', 'aria-checked': String(value) }, [
      el('span', { class: 'track', 'aria-hidden': 'true' }, el('span', { class: 'thumb' })), stateText]);
    base.root = el('div', { class: 'widget', 'data-state': 'idle' }, [labelEl, base.control, base.reasonEl,
      statusLine(base)]);
    const render = function () {
      base.control.setAttribute('aria-checked', String(value));
      stateText.textContent = text(value ? 'ui.on' : 'ui.off');
    };
    const flip = function () {
      if (base.disabledReason) {
        toast(base.disabledReason, { kind: 'info' });
        return;
      }
      value = !value;
      render();
      callHandler(base, spec.onChange, value, 'onChange');
    };
    onBase(base, base.control, 'click', flip);
    pressFeedback(base, base.control);
    activateOnSyntheticKey(base, base.control, () => base.control.click());
    render();
    if (spec.disabledReason) applyDisabledReason(base, spec.disabledReason);
    return finishWidget(base, { set: (next) => { value = Boolean(next); render(); }, get: () => value });
  }

  // ---- slider
  function formatSliderValue(spec, value, precision) {
    if (typeof spec.format === 'function') return String(spec.format(value));
    const suffix = hasOwn(UNIT_SUFFIX, spec.unit || '') ? UNIT_SUFFIX[spec.unit || ''] : '';
    return value.toFixed(precision) + suffix;
  }

  function sliderKeyTarget(name, value, limits) {
    const { min, max, step, bigStep } = limits;
    if (name === 'ArrowLeft' || name === 'ArrowDown') return value - step;
    if (name === 'ArrowRight' || name === 'ArrowUp') return value + step;
    if (name === 'PageDown') return value - bigStep;
    if (name === 'PageUp') return value + bigStep;
    if (name === 'Home') return min;
    if (name === 'End') return max;
    return null;
  }

  function slider(spec) {
    const base = createBase('slider', spec);
    const limits = { min: Number(spec.min), max: Number(spec.max), step: Number(spec.step) || 1, bigStep: 0 };
    assert(Number.isFinite(limits.min) && Number.isFinite(limits.max) && limits.max > limits.min,
      'slider needs min < max');
    limits.bigStep = Number(spec.bigStep) || limits.step * 10;
    const precision = Number.isInteger(spec.precision) ? spec.precision : decimalsOf(limits.step);
    const digits = Math.max(precision, decimalsOf(limits.step));
    const snap = function (raw) {
      const stepped = limits.min + Math.round((raw - limits.min) / limits.step) * limits.step;
      return Number(clamp(stepped, limits.min, limits.max).toFixed(digits));
    };
    const live = { value: snap(Number.isFinite(Number(spec.value)) ? Number(spec.value) : limits.min), dirty: false,
      lastInputAt: -Infinity, pending: false, timer: null };
    base.reasonEl = reasonLine(base, false);
    base.nativeDisable = true;
    const input = el('input', { type: 'range', id: base.controlId, class: 'slider', min: limits.min, max: limits.max,
      step: limits.step });
    const readout = el('output', { class: 'slider-value num', for: base.controlId });
    base.control = input;
    base.root = el('div', { class: 'widget', 'data-state': 'idle' }, [labelFor(base, spec.label),
      el('div', { class: 'slider-row' }, [input, readout]), base.reasonEl, statusLine(base)]);
    const render = function () {
      input.value = String(live.value);
      const shown = formatSliderValue(spec, live.value, precision);
      readout.textContent = shown;
      input.setAttribute('aria-valuetext', shown);
    };
    const fireInput = function () {
      live.pending = false;
      live.lastInputAt = Core.now();
      callHandler(base, spec.onInput, live.value, 'onInput');
    };
    const emitInput = function () {
      const elapsed = Core.now() - live.lastInputAt;
      if (elapsed >= SLIDER_INPUT_MS) {
        fireInput();
        return;
      }
      live.pending = true;
      if (live.timer !== null) return;
      live.timer = Core.timers.setTimeout(function () {
        live.timer = null;
        if (live.pending) fireInput();
      }, SLIDER_INPUT_MS - elapsed, base.owner);
    };
    const commit = function () {
      if (live.timer !== null) Core.timers.clearTimeout(live.timer);
      live.timer = null;
      if (live.pending) fireInput();
      live.dirty = false;
      callHandler(base, spec.onChange, live.value, 'onChange');
    };
    const moveTo = function (raw) {
      live.value = snap(raw);
      live.dirty = true;
      render();
      emitInput();
    };
    onBase(base, input, 'keydown', function (evt) {
      if (base.disabledReason) return;
      const target = sliderKeyTarget(keyName(evt), live.value, limits);
      if (target === null) return;
      evt.preventDefault();
      moveTo(target);
    });
    onBase(base, input, 'keyup', function (evt) {
      if (live.dirty && sliderKeyTarget(keyName(evt), live.value, limits) !== null) commit();
    });
    onBase(base, input, 'input', () => moveTo(Number(input.value)));
    onBase(base, input, 'change', () => { if (live.dirty) commit(); });
    base.onDisabled = (disabled) => { input.disabled = disabled; };
    render();
    if (spec.disabledReason) applyDisabledReason(base, spec.disabledReason);
    return finishWidget(base, {
      set: (next) => { live.value = snap(Number(next)); render(); },
      get: () => live.value
    });
  }

  // ---- select
  function optionLabel(option) {
    return option.disabledReason ? option.label + ' - ' + option.disabledReason : option.label;
  }

  function select(spec) {
    const base = createBase('select', spec);
    base.reasonEl = reasonLine(base, false);
    base.nativeDisable = true;
    const options = (spec.options || []).map((option) => el('option', { value: option.value,
      disabled: Boolean(option.disabledReason) }, optionLabel(option)));
    base.control = el('select', { id: base.controlId, class: 'select' }, options);
    base.root = el('div', { class: 'widget', 'data-state': 'idle' }, [labelFor(base, spec.label), base.control,
      base.reasonEl, statusLine(base)]);
    base.control.value = String(spec.value);
    onBase(base, base.control, 'change', () => callHandler(base, spec.onChange, base.control.value, 'onChange'));
    base.onDisabled = (disabled) => { base.control.disabled = disabled; };
    if (spec.disabledReason) applyDisabledReason(base, spec.disabledReason);
    return finishWidget(base, { set: (next) => { base.control.value = String(next); }, get: () => base.control.value });
  }

  // ---- number
  function number(spec) {
    const base = createBase('number', spec);
    const min = Number(spec.min);
    const max = Number(spec.max);
    const step = Number(spec.step) || 1;
    const precision = Number.isInteger(spec.precision) ? spec.precision : decimalsOf(step);
    const live = { value: clamp(Number(spec.value) || 0, min, max) };
    base.reasonEl = reasonLine(base, false);
    base.nativeDisable = true;
    const input = el('input', { type: 'text', inputmode: 'decimal', id: base.controlId, class: 'number num',
      autocomplete: 'off', spellcheck: 'false' });
    base.control = input;
    const stepButton = (label, iconName, delta) => el('button', { type: 'button', class: 'btn btn-secondary icon-only',
      owner: base.owner, 'aria-label': text(label, { label: spec.label }),
        on: { click: () => commitValue(live.value + delta) } },
    icon(iconName));
    const minus = stepButton('number.decrease', 'minus', -step);
    const plus = stepButton('number.increase', 'plus', step);
    const unit = spec.unit ? el('span', { class: 'unit' }, String(spec.unit)) : null;
    base.root = el('div', { class: 'widget', 'data-state': 'idle' }, [labelFor(base, spec.label),
      el('div', { class: 'number-row' }, [minus, input, plus, unit]), base.reasonEl, statusLine(base)]);
    const render = () => { input.value = live.value.toFixed(precision); };
    function commitValue(raw) {
      if (base.disabledReason) return;
      const clamped = clamp(raw, min, max);
      if (clamped !== raw) applyState(base, 'error', text('number.range', { min, max }));
      const next = Number(clamped.toFixed(precision));
      const changed = next !== live.value;
      live.value = next;
      render();
      if (changed) callHandler(base, spec.onChange, next, 'onChange');
    }
    function commitText() {
      const raw = input.value.trim();
      const parsed = raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(parsed)) {
        render();
        applyState(base, 'error', text('number.invalid'));
        return;
      }
      commitValue(parsed);
    }
    onBase(base, input, 'keydown', function (evt) {
      const name = keyName(evt);
      if (name === 'Enter') commitText();
      else if (name === 'ArrowUp' || name === 'ArrowDown') commitValue(live.value +
        (name === 'ArrowUp' ? step : -step));
      else if (name === 'Escape') { render(); input.blur(); } else return;
      evt.preventDefault();
    });
    onBase(base, input, 'blur', () => { if (input.value.trim() !== live.value.toFixed(precision)) commitText(); });
    base.onDisabled = (disabled) => { input.disabled = disabled; minus.disabled = disabled; plus.disabled = disabled; };
    render();
    if (spec.disabledReason) applyDisabledReason(base, spec.disabledReason);
    return finishWidget(base, { set: (next) => { live.value = clamp(Number(next) || 0, min, max); render(); },
      get: () => live.value });
  }

  // ---- list
  function itemAriaLabel(item) {
    return item.secondary ? item.primary + ', ' + item.secondary : String(item.primary);
  }

  function buildListItem(base, item, role) {
    const parts = [el('span', { class: 'item-text' }, [
      el('span', { class: 'primary-text' }, String(item.primary)),
      item.secondary ? el('span', { class: 'secondary-text' }, String(item.secondary)) : null,
      item.disabledReason ? el('span', { class: 'reason' }, String(item.disabledReason)) : null])];
    if (item.badge) parts.push(el('span', { class: 'badge' }, String(item.badge)));
    return el('li', { role, tabindex: '-1', 'data-item': item.id, title: String(item.primary),
      'aria-label': itemAriaLabel(item), 'aria-disabled': item.disabledReason ? 'true' : null }, parts);
  }

  function list(spec) {
    const base = createBase('list', spec);
    const role = spec.role === 'menu' ? 'menu' : 'listbox';
    const itemRole = role === 'menu' ? 'menuitem' : 'option';
    const live = { items: [], active: 0, selectedId: spec.selectedId === undefined ? null : spec.selectedId };
    const listEl = el('ul', { class: 'list', role, id: base.controlId, 'aria-label': spec.label });
    const emptyEl = el('p', { class: 'empty', hidden: true }, spec.emptyText || '');
    base.reasonEl = reasonLine(base, false);
    base.control = listEl;
    base.root = el('div', { class: 'widget', 'data-state': 'idle' }, [listEl, emptyEl, base.reasonEl,
      statusLine(base)]);
    const rows = () => Array.from(listEl.children);
    const markActive = function (index) {
      rows().forEach((row, position) => row.setAttribute('tabindex', position === index ? '0' : '-1'));
      live.active = index;
    };
    const activate = function (index) {
      const item = live.items[index];
      if (!item) return;
      if (item.disabledReason) {
        toast(item.disabledReason, { kind: 'info' });
        return;
      }
      callHandler(base, spec.onPick, item.id, 'onPick');
    };
    const moveTo = function (index) {
      const count = live.items.length;
      if (count === 0) return;
      const target = (index + count) % count;
      markActive(target);
      focusNode(rows()[target]);
    };
    const render = function () {
      listEl.textContent = '';
      live.items.forEach((item) => listEl.appendChild(buildListItem(base, item, itemRole)));
      rows().forEach((row, index) => {
        if (itemRole === 'option') row.setAttribute('aria-selected', String(live.items[index].id === live.selectedId));
      });
      const selected = live.items.findIndex((item) => item.id === live.selectedId);
      markActive(selected >= 0 ? selected : 0);
      listEl.hidden = live.items.length === 0;
      emptyEl.hidden = live.items.length > 0;
    };
    const rowIndexOf = (node) => rows().indexOf(node.closest('li'));
    onBase(base, listEl, 'click',
      (evt) => { const index = rowIndexOf(evt.target); if (index >= 0) { markActive(index); activate(index); } });
    onBase(base, listEl, 'keydown', function (evt) {
      const name = keyName(evt);
      const index = rowIndexOf(evt.target);
      const grid = spec.grid === true;
      if (index < 0) return;
      if (name === 'ArrowDown' || (grid && name === 'ArrowRight')) moveTo(index + 1);
      else if (name === 'ArrowUp' || (grid && name === 'ArrowLeft')) moveTo(index - 1);
      else if (name === 'Home') moveTo(0);
      else if (name === 'End') moveTo(live.items.length - 1);
      else if (name === 'Enter' || name === 'Space') activate(index);
      else return;
      evt.preventDefault();
    });
    live.items = Array.isArray(spec.items) ? spec.items.slice() : [];
    render();
    if (spec.disabledReason) applyDisabledReason(base, spec.disabledReason);
    return finishWidget(base, {
      set: (id) => { live.selectedId = id; render(); },
      get: () => live.selectedId,
      setItems: (items) => { live.items = Array.isArray(items) ? items.slice() : []; render(); }
    });
  }

  // ---- tabs
  function tabs(spec) {
    const base = createBase('tabs', spec);
    const live = { value: spec.value, panels: new Map() };
    base.reasonEl = reasonLine(base, false);
    const tabList = el('div', { class: 'tabs', role: 'tablist', id: base.controlId });
    base.control = tabList;
    base.root = el('div', { class: 'widget', 'data-state': 'idle' }, [tabList, base.reasonEl, statusLine(base)]);
    const buttons = () => Array.from(tabList.children);
    const render = function () {
      buttons().forEach(function (node, index) {
        const selected = spec.tabs[index].id === live.value;
        node.setAttribute('aria-selected', String(selected));
        node.setAttribute('tabindex', selected ? '0' : '-1');
      });
      live.panels.forEach((panel, id) => { panel.hidden = id !== live.value; });
    };
    const choose = function (index, notify) {
      const target = (index + spec.tabs.length) % spec.tabs.length;
      live.value = spec.tabs[target].id;
      render();
      focusNode(buttons()[target]);
      if (notify) callHandler(base, spec.onChange, live.value, 'onChange');
    };
    spec.tabs.forEach(function (tab, index) {
      tabList.appendChild(el('button', { type: 'button', role: 'tab', class: 'tab', id: base.id + '-tab-' + tab.id,
        'data-tab': tab.id, owner: base.owner, on: { click: () => choose(index, true) } }, tab.label));
    });
    onBase(base, tabList, 'keydown', function (evt) {
      const name = keyName(evt);
      const index = buttons().indexOf(evt.target.closest('button'));
      if (index < 0) return;
      if (name === 'ArrowRight') choose(index + 1, true);
      else if (name === 'ArrowLeft') choose(index - 1, true);
      else if (name === 'Home') choose(0, true);
      else if (name === 'End') choose(spec.tabs.length - 1, true);
      else return;
      evt.preventDefault();
    });
    render();
    return finishWidget(base, {
      set: (id) => { live.value = id; render(); },
      get: () => live.value,
      panel(tabId, element) {
        element.setAttribute('role', 'tabpanel');
        element.setAttribute('aria-labelledby', base.id + '-tab-' + tabId);
        live.panels.set(tabId, element);
        render();
      }
    });
  }

  // ---- field (text input)
  function applyTextEntry(base) {
    const input = base.control;
    input.readOnly = !textEntryAllowed;
    input.setAttribute('aria-readonly', String(!textEntryAllowed));
    if (textEntryAllowed) input.removeAttribute('tabindex');
    else input.setAttribute('tabindex', '-1');
    base.hintEl.textContent = textEntryAllowed ? '' : text('field.pauseToEdit');
    base.hintEl.hidden = textEntryAllowed;
  }

  function field(spec) {
    const base = createBase('field', spec);
    base.isField = true;
    const live = { value: String(spec.value === undefined ? '' : spec.value) };
    const pattern = spec.pattern ? new RegExp('^(?:' + (spec.pattern.source || spec.pattern) + ')$') : null;
    base.reasonEl = reasonLine(base, false);
    base.nativeDisable = true;
    base.hintEl = el('p', { class: 'reason', hidden: true });
    base.control = el('input', { type: 'text', id: base.controlId, class: 'field', maxlength: spec.maxLength,
      placeholder: spec.placeholder, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off' });
    base.root = el('div', { class: 'widget', 'data-state': 'idle' }, [labelFor(base, spec.label), base.control,
      base.hintEl,
      base.reasonEl, statusLine(base)]);
    base.control.value = live.value;
    const revert = () => { base.control.value = live.value; };
    const commit = function () {
      const value = base.control.value.trim();
      if (value === live.value) return;
      if (pattern && !pattern.test(value)) {
        applyState(base, 'error', text('field.invalid'));
        return;
      }
      live.value = value;
      base.control.value = value;
      callHandler(base, spec.onCommit, value, 'onCommit');
    };
    onBase(base, base.control, 'keydown', function (evt) {
      const name = keyName(evt);
      if (name === 'Enter') commit();
      else if (name === 'Escape') { revert(); base.control.blur(); } else return;
      evt.preventDefault();
    });
    onBase(base, base.control, 'blur', commit);
    base.onDisabled = (disabled) => { base.control.disabled = disabled; };
    applyTextEntry(base);
    if (spec.disabledReason) applyDisabledReason(base, spec.disabledReason);
    return finishWidget(base, { set: (next) => { live.value = String(next); revert(); }, get: () => live.value });
  }

  const Widgets = Object.freeze({ button, toggle, slider, select, number, list, tabs, field });

  // ---------------------------------------------------------------------------------------------
  // Dialogs (Part 6.26.4.6)
  // ---------------------------------------------------------------------------------------------
  function setInert(node, on) {
    if (on) {
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    } else {
      node.removeAttribute('inert');
      node.removeAttribute('aria-hidden');
    }
  }

  // Exactly one screen (the top one) is interactive, and none while a dialog is open; lower dialogs are inert too.
  function refreshInert() {
    stack.forEach((entry, index) => setInert(entry.root, index !== stack.length - 1 || dialogs.length > 0));
    dialogs.forEach((record, index) => setInert(record.layer, index !== dialogs.length - 1));
  }

  function validateDialog(spec) {
    assert(spec && typeof spec.id === 'string' && spec.id !== '', 'dialog needs an id');
    const buttons = Array.isArray(spec.buttons) ? spec.buttons : [];
    const hasDanger = buttons.some((item) => item.kind === 'danger');
    assert(!hasDanger || (typeof spec.consequence === 'string' && spec.consequence !== ''),
      'dialog ' + spec.id + ' has a danger button but no consequence text');
    const cancelCount = buttons.filter((item) => item.isCancel).length;
    assert(spec.dismissible === false || buttons.length === 0 || cancelCount === 1,
      'dialog ' + spec.id + ' needs exactly one cancel button when it is dismissible');
  }

  function dialogParagraphs(body) {
    const lines = Array.isArray(body) ? body : body === undefined ? [] : [body];
    return lines.map((line) => el('p', null, String(line)));
  }

  function defaultButtonOf(buttons) {
    const hasDanger = buttons.some((item) => item.kind === 'danger');
    const chosen = buttons.find((item) => item.isDefault && item.kind !== 'danger');
    if (chosen) return chosen;
    if (hasDanger) return buttons.find((item) => item.isCancel) || buttons[0];
    return buttons[0];
  }

  function buildDialogContent(spec, record, finish) {
    const titleId = 'dlg-title-' + record.serial;
    const bodyId = 'dlg-body-' + record.serial;
    const buttons = Array.isArray(spec.buttons) ? spec.buttons : [];
    const content = [el('h2', { id: titleId }, String(spec.title || '')),
      el('div', { class: 'dialog-body', id: bodyId }, dialogParagraphs(spec.body))];
    if (spec.consequence) {
      content.push(el('p', { class: 'consequence' }, [icon('warn'), el('span', null, String(spec.consequence))]));
    }
    if (typeof spec.build === 'function') {
      const custom = el('div', { class: 'dialog-custom' });
      content.push(custom);
      spec.build(custom, finish);
    }
    record.buttonHandles = buttons.map((item) => Widgets.button({ id: spec.id + '-' + item.id, label: item.label,
      kind: item.kind, onPress: () => finish(item.id) }));
    content.push(el('div', { class: 'dialog-buttons' }, record.buttonHandles.map((handle) => handle.root)));
    const dialogEl = el('div', { class: 'dialog', id: spec.id.toLowerCase(), role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': titleId, 'aria-describedby': bodyId, 'data-dialog': spec.id }, content);
    return dialogEl;
  }

  function focusDialogStart(record, buttons) {
    const chosen = buttons.length > 0 ? defaultButtonOf(buttons) : null;
    const handle = chosen ? record.buttonHandles[buttons.indexOf(chosen)] : null;
    const target = handle ? handle.root : focusable(record.root)[0];
    if (target) focusNode(target);
  }

  function openDialog(spec, resolve) {
    validateDialog(spec);
    if (dialogs.length >= MAX_DIALOGS) {
      const error = codedError('E-GEN-001', 'more than ' + MAX_DIALOGS + ' dialogs: ' + spec.id);
      report('E-GEN-001', error, { dialog: spec.id });
      throw error;
    }
    serial += 1;
    const record = { id: spec.id, spec, serial, resolve, owner: Symbol('dialog'), closed: false, layer: null,
      root: null,
      trap: null, focusBefore: remember(), buttonHandles: [], dismissible: spec.dismissible !== false };
    const finish = (result) => closeDialog(record, result);
    const previousContext = contextOwner;
    contextOwner = record.owner;
    try {
      record.root = buildDialogContent(spec, record, finish);
    } finally {
      contextOwner = previousContext;
    }
    record.layer = el('div', { class: 'dialog-layer', owner: record.owner }, [
      el('div', { class: 'backdrop', owner: record.owner,
        on: { pointerup: () => { if (record.dismissible) finish('cancel'); } } }),
      record.root]);
    Core.dom.on(record.root, 'keydown', (evt) => onDialogKey(record, evt), undefined, record.owner);
    dialogs.push(record);
    doc.getElementById('overlay').appendChild(record.layer);
    refreshInert();
    record.trap = trap(record.root);
    focusDialogStart(record, Array.isArray(spec.buttons) ? spec.buttons : []);
    bus.emit('ui.dialog', { id: spec.id, open: true, result: null });
  }

  // Enter on a non-control element activates the default button (Part 6.26.4.4).
  function onDialogKey(record, evt) {
    if (keyName(evt) !== 'Enter' || evt.target.closest('button, input, select, textarea, a, [role="switch"]')) return;
    const buttons = Array.isArray(record.spec.buttons) ? record.spec.buttons : [];
    const chosen = buttons.length > 0 ? defaultButtonOf(buttons) : null;
    if (!chosen) return;
    evt.preventDefault();
    closeDialog(record, chosen.id);
  }

  function closeDialog(record, result) {
    if (record.closed) return;
    record.closed = true;
    const index = dialogs.indexOf(record);
    if (index >= 0) dialogs.splice(index, 1);
    record.trap.release();
    destroyWidgetsOf(record.owner, record.layer);
    Core.dom.offOwner(record.owner);
    record.layer.remove();
    refreshInert();
    restoreAfterDialog(record);
    bus.emit('ui.dialog', { id: record.id, open: false, result });
    record.resolve(result);
  }

  function restoreAfterDialog(record) {
    if (record.focusBefore && record.focusBefore.isConnected && !record.focusBefore.closest('[inert]')) {
      focusNode(record.focusBefore);
      return;
    }
    if (dialogs.length > 0) {
      const list = focusable(dialogs[dialogs.length - 1].root);
      if (list[0]) focusNode(list[0]);
      return;
    }
    if (stack.length > 0) restore(stack[stack.length - 1].root);
  }

  /** @param {object} spec DialogSpec @returns {Promise<string>} the chosen button id, 'cancel' or 'dismissed' */
  function dialog(spec) {
    return new Promise(function (resolve, reject) {
      try {
        openDialog(spec, resolve);
      } catch (error) {
        reject(error);
      }
    });
  }

  function cancelTopDialog() {
    const top = dialogs[dialogs.length - 1];
    if (top && top.dismissible) closeDialog(top, 'cancel');
  }

  function closeAllDialogs(reason) {
    const count = dialogs.length;
    if (count > 0) Core.Log.info('ui', 'closing all dialogs', { reason: String(reason) });
    dialogs.slice().reverse().forEach((record) => closeDialog(record, 'dismissed'));
    return count;
  }

  /** DLG-UnsavedChanges (Part 7.7). @returns {Promise<'save'|'discard'|'cancel'>} */
  function confirmUnsaved(describe, opts) {
    const info = describe || {};
    const buttons = [
      { id: 'cancel', label: text('dlg.unsaved.cancel'), kind: 'secondary', isCancel: true },
      { id: 'discard', label: text('dlg.unsaved.discard'), kind: 'danger' }
    ];
    if (opts && opts.canSave) buttons.push({ id: 'save', label: text('dlg.unsaved.save'), kind: 'primary',
      isDefault: true });
    return dialog({ id: 'DLG-UnsavedChanges', title: info.title, body: info.body,
      consequence: text('dlg.unsaved.consequence', { count: info.changeCount }), buttons });
  }

  // ---------------------------------------------------------------------------------------------
  // Screen stack and history (Part 6.26.4.1 and 6.26.4.2)
  // ---------------------------------------------------------------------------------------------
  function safeHistory(method, state) {
    try {
      if (method === 'pushState' || method === 'replaceState') window.history[method](state, '');
      else window.history[method](state);
      return true;
    } catch (error) {
      hist.enabled = false;
      Core.Log.once('W-UI-HISTORY', 'warn', 'ui', 'W-UI-HISTORY: browser history is not available');
      return false;
    }
  }

  function historyState(id) {
    return { flm: HISTORY_FLAG, depth: stack.length, screen: id };
  }

  function createController(id) {
    let factory = null;
    try {
      factory = resolver ? resolver(id) : null;
    } catch (error) {
      throw codedError('E-MODE-002', 'unknown screen ' + id);
    }
    if (typeof factory !== 'function') throw codedError('E-MODE-002', 'unknown screen ' + id);
    const controller = factory();
    if (!controller || typeof controller.mount !== 'function') throw codedError('E-MODE-002', 'screen ' + id +
      ' has no mount');
    return controller;
  }

  function screenLabel(id) {
    return hasOwn(TEXT, 'screen.' + id) ? text('screen.' + id) : id;
  }

  function insertScreenRoot(root) {
    const overlay = doc.getElementById('overlay');
    assert(overlay, 'the #overlay element is missing');
    const firstDialog = dialogs.length > 0 ? dialogs[0].layer : null;
    overlay.insertBefore(root, firstDialog);
  }

  // Builds and mounts a controller; on failure everything it created is removed (the stack is untouched).
  async function mountScreen(id, params) {
    const controller = createController(id);
    const owner = Symbol(id);
    const root = el('section', { class: 'screen', 'data-screen': id, role: 'region', 'aria-label': screenLabel(id) });
    const focusBefore = remember();
    insertScreenRoot(root);
    const previousContext = contextOwner;
    contextOwner = owner;
    try {
      await controller.mount(root, params || {}, { owner, ui: FLM.UI });
    } catch (error) {
      cleanupOwner(owner);
      destroyWidgetsOf(owner, root);
      root.remove();
      const wrapped = codedError('E-MODE-002', 'screen ' + id + ' could not start: ' + (error && error.message));
      wrapped.cause = error;
      throw wrapped;
    } finally {
      contextOwner = previousContext;
    }
    return { id, params, controller, root, owner, focusBefore };
  }

  function cleanupOwner(owner) {
    Core.dom.offOwner(owner);
    Core.timers.clearOwner(owner);
    Core.raf.cancelOwner(owner);
    bus.removeOwner(owner);
  }

  function callHook(entry, hook, argument) {
    if (typeof entry.controller[hook] !== 'function') return;
    try {
      entry.controller[hook](argument);
    } catch (error) {
      report('E-GEN-001', error, { screen: entry.id, op: hook });
    }
  }

  // Unmount never throws outward: the owner's listeners, timers and subscriptions are removed in every case.
  function unmountEntry(entry) {
    callHook(entry, 'unmount');
    cleanupOwner(entry.owner);
    destroyWidgetsOf(entry.owner, entry.root);
    entry.root.remove();
  }

  async function push(id, params) {
    const entry = await mountScreen(id, params);
    const below = stack[stack.length - 1] || null;
    if (below) callHook(below, 'onHide');
    stack.push(entry);
    refreshInert();
    if (hist.enabled) safeHistory('pushState', historyState(id));
    restore(entry.root);
    bus.emit('ui.screen', { action: 'push', screen: id, prev: below ? below.id : null, depth: stack.length });
    return entry.controller;
  }

  async function replace(id, params) {
    const old = stack[stack.length - 1];
    if (!old) return push(id, params);
    const entry = await mountScreen(id, params);
    stack[stack.length - 1] = entry;
    unmountEntry(old);
    refreshInert();
    if (hist.enabled) safeHistory('replaceState', historyState(id));
    restore(entry.root);
    bus.emit('ui.screen', { action: 'replace', screen: id, prev: old.id, depth: stack.length });
    return entry.controller;
  }

  // Shared by pop, popTo and back: removes the top screen and shows the one below.
  function popInternal() {
    const top = stack.pop();
    const now = stack[stack.length - 1];
    unmountEntry(top);
    refreshInert();
    callHook(now, 'onShow');
    const wanted = top.focusBefore && now.root.contains(top.focusBefore) ? top.focusBefore : now.root;
    restore(wanted);
    return top;
  }

  async function pop() {
    if (stack.length <= 1) return false;
    const top = popInternal();
    if (hist.enabled && safeHistory('back')) hist.ignorePops += 1;
    bus.emit('ui.screen', { action: 'pop', screen: top.id, prev: stack[stack.length - 1].id, depth: stack.length });
    return true;
  }

  async function popTo(id) {
    const target = id === undefined ? 0 : stack.map((entry) => entry.id).lastIndexOf(id);
    if (target < 0) return 0;
    const count = stack.length - 1 - target;
    if (count <= 0) return 0;
    const lastTop = stack[stack.length - 1].id;
    for (let done = 0; done < count; done += 1) popInternal();
    if (hist.enabled && safeHistory('go', -count)) hist.ignorePops += 1;
    bus.emit('ui.screen', { action: 'popTo', screen: stack[stack.length - 1].id, prev: lastTop, depth: stack.length });
    return count;
  }

  // The browser already moved its own history for source 'browser', so the stack follows without history.back().
  async function back(source) {
    if (dialogs.length > 0) {
      cancelTopDialog();
      return 'handled';
    }
    if (stack.length <= 1) return 'root';
    const top = stack[stack.length - 1];
    let decision = 'pop';
    try {
      if (typeof top.controller.onBack === 'function') decision = await top.controller.onBack(source);
    } catch (error) {
      report('E-GEN-001', error, { screen: top.id, op: 'onBack' });
      return 'handled';
    }
    if (decision !== 'pop') return 'handled';
    if (source === 'browser') {
      const popped = popInternal();
      bus.emit('ui.screen', { action: 'pop', screen: popped.id, prev: stack[stack.length - 1].id,
        depth: stack.length });
    } else {
      await pop();
    }
    return 'pop';
  }

  async function onPopState(state) {
    if (hist.ignorePops > 0) {
      hist.ignorePops -= 1;
      return;
    }
    const target = state && state.flm === HISTORY_FLAG ? state.depth : 1;
    if (target > stack.length) {
      if (safeHistory('back')) hist.ignorePops += 1;     // forward never re-opens a popped screen
      return;
    }
    if (target >= stack.length) return;
    const result = await back('browser');
    if (result === 'handled' && hist.enabled) safeHistory('pushState', historyState(currentScreenId()));
  }

  function setHistory(enabled) {
    hist.enabled = Boolean(enabled);
    hist.ignorePops = 0;
  }

  const Screens = Object.freeze({
    setResolver: (fn) => { resolver = typeof fn === 'function' ? fn : null; },
    push,
    replace,
    pop,
    popTo,
    back,
    current() {
      const top = stack[stack.length - 1];
      return top ? { id: top.id, params: top.params, controller: top.controller } : null;
    },
    depth: () => stack.length,
    ids: () => stack.map((entry) => entry.id),
    setHistory,
    onPopState
  });

  // The shared screen frame of Part 7.6.0: banner with Back, title and current task, status chips, one primary action.
  function frame(root, spec) {
    assert(root && root.nodeType === 1 && spec && typeof spec.prefix === 'string', 'frame needs a root and a prefix');
    const prefix = spec.prefix;
    const titleEl = el('h1', { id: prefix + '-title', title: spec.title }, String(spec.title));
    const subtitleEl = el('p', { class: 'subtitle', id: prefix + '-subtitle' },
      spec.subtitle === undefined ? text('ui.noProject') : String(spec.subtitle));
    const statusEl = el('div', { class: 'status-chips', id: prefix + '-status', role: 'status' });
    const topChildren = [];
    if (spec.back !== false) {
      const name = spec.backTo ? text('ui.backTo', { name: spec.backTo }) : text('ui.back');
      topChildren.push(Widgets.button({ id: prefix + '-back', icon: 'back',
        label: layout.compact ? '' : text('ui.back'),
        ariaLabel: name, kind: 'ghost', onPress: () => Screens.back('button') }).root);
    }
    topChildren.push(el('div', { class: 'title-block' }, [titleEl, subtitleEl]), statusEl);
    const top = el('header', { class: 'topbar', id: prefix + '-top', role: 'banner' }, topChildren);
    const body = el('div', { class: 'screen-body', id: prefix + '-body' });
    const parts = [top, body];
    let primary = null;
    if (spec.primary) {
      primary = Widgets.button({ id: prefix + '-primary', label: spec.primary.label, kind: 'primary',
        onPress: spec.primary.onPress, disabledReason: spec.primary.disabledReason });
      parts.push(el('footer', { class: 'actionbar' }, primary.root));
    }
    appendChildren(root, parts);
    return Object.freeze({ top, body, title: titleEl, subtitle: subtitleEl, status: statusEl, primary,
      setTitle: (value) => { titleEl.textContent = String(value); titleEl.setAttribute('title', String(value)); },
      setSubtitle: (value) => { subtitleEl.textContent = String(value); } });
  }

  const Frame = Object.freeze({ create: frame });

  // ---------------------------------------------------------------------------------------------
  // Touch pads (Part 6.26.4.9)
  // ---------------------------------------------------------------------------------------------
  function padSizeBelow(size) {
    const index = PAD_SIZE_ORDER.indexOf(size);
    return index > 0 ? PAD_SIZE_ORDER[index - 1] : null;
  }

  function rowRects(metrics, size, gap) {
    const { width, height, safeArea, orientation } = metrics;
    const minSide = PAD_SIZES[size];
    const bandHeight = Math.max(minSide,
      Math.round(height * (orientation === 'portrait' ? PAD_BAND_PORTRAIT : PAD_BAND_LANDSCAPE)));
    const usableWidth = width - safeArea.left - safeArea.right - gap * (PAD_COUNT + 1);
    const padWidth = Math.max(minSide, Math.floor(usableWidth / PAD_COUNT));
    const top = height - safeArea.bottom - bandHeight;
    const rects = [];
    for (let index = 0; index < PAD_COUNT; index += 1) {
      rects.push({ x: safeArea.left + gap + index * (padWidth + gap), y: top, w: padWidth, h: bandHeight - gap });
    }
    return { rects, fits: Math.floor(usableWidth / PAD_COUNT) >= minSide };
  }

  function gridRects(metrics, size) {
    const { width, height, safeArea } = metrics;
    const minSide = PAD_SIZES[size];
    const bandWidth = Math.max(minSide * 2 + PAD_GAP * 3, Math.round(width * PAD_BAND_LANDSCAPE));
    const cell = Math.max(minSide, Math.floor((bandWidth - PAD_GAP * 3) / 2));
    const rightX = width - safeArea.right - PAD_GAP - cell;
    const leftX = rightX - PAD_GAP - cell;
    const bottomY = height - safeArea.bottom - PAD_GAP - cell;
    const topY = bottomY - PAD_GAP - cell;
    return [{ x: leftX, y: topY, w: cell, h: cell }, { x: rightX, y: topY, w: cell, h: cell },
      { x: leftX, y: bottomY, w: cell, h: cell }, { x: rightX, y: bottomY, w: cell, h: cell }];
  }

  /** Pure geometry: {rects:[{x,y,w,h} x4], size, shrunk}. A row when portrait or layout 'bottom', else a 2 x 2 grid. */
  function computePadGeometry(metrics, spec) {
    let size = PAD_SIZES[spec.size] ? spec.size : 'medium';
    const wantsRow = metrics.orientation === 'portrait' || spec.layout !== 'right';
    if (!wantsRow) return { rects: gridRects(metrics, size), size, shrunk: false };
    let gap = PAD_GAP;
    let result = rowRects(metrics, size, gap);
    let shrunk = false;
    while (!result.fits) {
      const smaller = padSizeBelow(size);
      if (gap === PAD_GAP) gap = PAD_GAP_TIGHT;
      else if (smaller) { size = smaller; shrunk = true; } else break;
      result = rowRects(metrics, size, gap);
    }
    return { rects: result.rects, size, shrunk };
  }

  function padGlyphName(spec, index) {
    return spec.kind === 'dance' ? ['left', 'down', 'up', 'right'][index] : 'lane' + index;
  }

  function padLabel(spec, index) {
    const labels = Array.isArray(spec.labels) ? spec.labels : [];
    return labels[index] || text('pads.' + (spec.kind === 'dance' ? 'dance' : 'lane') + index);
  }

  function buildPad(spec, index) {
    return el('div', { class: 'pad pad-' + index, id: 'pad-' + index, role: 'button', 'aria-label': padLabel(spec,
      index),
      'data-index': index, owner: PADS_OWNER, on: { contextmenu: (evt) => evt.preventDefault() } },
    [el('span', { class: 'pad-tint', 'aria-hidden': 'true' }), laneGlyph(padGlyphName(spec, index))]);
  }

  function layoutPads() {
    if (!pads.spec) return;
    const spec = Object.assign({}, pads.spec, { layout: prefs.padLayout || pads.spec.layout });
    const geometry = computePadGeometry(snapshot(), spec);
    pads.rects = geometry.rects;
    pads.els.forEach(function (pad, index) {
      const rect = geometry.rects[index];
      pad.style.width = rect.w + 'px';
      pad.style.height = rect.h + 'px';
      pad.style.transform = 'translate(' + rect.x + 'px, ' + rect.y + 'px)';
      const glyph = pad.querySelector('.glyph');
      const side = Math.round(rect.h * PAD_GLYPH_FRACTION) + 'px';
      glyph.style.width = side;
      glyph.style.height = side;
    });
    if (geometry.shrunk && !pads.shrunkNoted) {
      pads.shrunkNoted = true;
      HUD.note(text('pads.shrunk'));
    }
  }

  function onPadInput(evt) {
    const match = /^(?:lane|dance)([0-3])$/.exec(String(evt && evt.control));
    if (match) setPressed(Number(match[1]), evt.type === 'press');
  }

  function removePadElements() {
    Core.dom.offOwner(PADS_OWNER);
    bus.removeOwner(PADS_OWNER);
    pads.els.forEach((pad) => pad.remove());
    pads.els = [];
    pads.rects = [];
    pads.pressed = [false, false, false, false];
  }

  function showPads(spec) {
    assert(spec && (spec.kind === 'lanes' || spec.kind === 'dance'), 'TouchPads.show needs a PadSpec');
    removePadElements();
    pads.spec = Object.assign({}, spec);
    pads.shrunkNoted = false;
    prefs.padLayout = spec.layout === 'right' ? 'right' : 'bottom';
    const touch = doc.getElementById('touch');
    for (let index = 0; index < PAD_COUNT; index += 1) {
      const pad = buildPad(spec, index);
      touch.appendChild(pad);
      pads.els.push(pad);
    }
    touch.hidden = false;
    touch.style.setProperty('--pad-opacity', String(clamp(Number(spec.opacity) || 0.75, 0.3, 1)));
    bus.on('input.event', onPadInput, PADS_OWNER);
    layoutPads();
    if (spec.maxTouches > 0 && spec.maxTouches < FEW_TOUCHES_BELOW) HUD.note(text('pads.fewTouches',
      { n: spec.maxTouches }));
  }

  function hidePads() {
    removePadElements();
    pads.spec = null;
    const touch = doc.getElementById('touch');
    if (touch) touch.hidden = true;
  }

  function setPressed(index, pressed) {
    assert(Number.isInteger(index) && index >= 0 && index < PAD_COUNT, 'pad index must be 0 to 3');
    pads.pressed[index] = Boolean(pressed);
    if (pads.els[index]) pads.els[index].classList.toggle('pressed', Boolean(pressed));
  }

  const TouchPads = Object.freeze({
    show: showPads,
    hide: hidePads,
    layout: layoutPads,
    setPressed,
    root: () => doc.getElementById('touch'),
    rects: () => pads.rects.map((rect) => Object.assign({}, rect)),
    _geometry: computePadGeometry
  });

  // ---------------------------------------------------------------------------------------------
  // HUD (Part 6.26.4.10)
  // ---------------------------------------------------------------------------------------------
  function hudElement(key, tag, attrs, children) {
    const node = el(tag, Object.assign({ id: 'hud-' + key, hidden: true }, attrs), children);
    hud.els[key] = node;
    return node;
  }

  function buildHudMarkers() {
    const markers = [];
    for (let index = 0; index < PAD_COUNT; index += 1) {
      markers.push(el('span', { class: 'hit-marker', 'data-lane': index, 'aria-hidden': 'true' },
        laneGlyph('lane' + index)));
    }
    return hudElement('hitline', 'div', { class: 'hud-hitline', 'aria-hidden': 'true' }, markers);
  }

  function buildHud() {
    if (hud.built) return;
    const host = doc.getElementById('hud');
    const fill = el('div', { class: 'hud-progress-fill' });
    hud.fill = fill;
    const progress = hudElement('progress', 'div', { class: 'hud-progress', role: 'progressbar', 'aria-valuemin': 0,
      'aria-valuemax': 100, 'aria-valuenow': 0, 'aria-label': text('hud.progress') }, fill);
    const left = el('div', { class: 'hud-left' }, [hudElement('section', 'div', { class: 'ellipsis' }),
      hudElement('beat', 'div', { class: 'hud-beat', 'aria-hidden': 'true' }), hudElement('performers', 'div'),
      hudElement('peers', 'div'), hudElement('step', 'div', { class: 'num' }), hudElement('note', 'div',
        { class: 'hud-note' })]);
    const right = el('div', { class: 'hud-right' }, [hudElement('score', 'div', { class: 'num' }),
      hudElement('accuracy', 'div', { class: 'num' }), hudElement('life', 'div', { class: 'num' }),
        hudElement('sync', 'div')]);
    const word = hudElement('judgment', 'div', { class: 'hud-judgment' });
    const center = el('div', { class: 'hud-center' }, [word, hudElement('combo', 'div', { class: 'num' }),
      hudElement('countin', 'div', { class: 'num' }), hudElement('chord', 'div'), hudElement('keyinfo', 'div'),
        buildHudMarkers()]);
    const pauseButton = Widgets.button({ id: 'hud-pause', icon: 'pause', ariaLabel: text('hud.pause'),
      kind: 'secondary',
      onPress: () => Screens.back('button') });
    pauseButton.root.classList.add('hud-button');
    pauseButton.root.hidden = true;
    hud.els.pause = pauseButton.root;
    hud.els.sr = el('div', { id: 'hud-sr', class: 'visually-hidden', 'aria-live': 'polite' });
    hud.nodes = [el('div', { class: 'hud-layer' }, [progress, left, right, center]), pauseButton.root, hud.els.sr];
    hud.nodes.forEach((node) => host.appendChild(node));
    hud.built = true;
  }

  function hudPartShown(kind, key) {
    const rule = HUD_PARTS[kind][key];
    if (!rule) return false;
    if (rule === 'touch') return bodyHas('touch');
    return rule === 1 || Boolean(prefs[rule]);
  }

  function setHudShown(key, shown) {
    if (hud.shown[key] === shown || !hud.els[key]) return;
    hud.shown[key] = shown;
    hud.els[key].hidden = !shown;
  }

  function setHudText(key, value) {
    if (hud.rendered[key] === value) return;
    hud.rendered[key] = value;
    hud.els[key].textContent = value;
  }

  function renderPerformers(performers) {
    const signature = JSON.stringify(performers);
    if (hud.rendered.performers === signature) return;
    hud.rendered.performers = signature;
    const host = hud.els.performers;
    host.textContent = '';
    performers.forEach(function (item) {
      const label = String(item.label);
      host.appendChild(el('span', { class: 'performer' + (item.active ? ' active' : ''), title: label },
        [el('span', { class: 'dot', 'aria-hidden': 'true' }), truncate(label, TEXT_MAX_NAME)]));
    });
  }

  function renderPeers(peers) {
    const signature = JSON.stringify(peers);
    if (hud.rendered.peers === signature) return;
    hud.rendered.peers = signature;
    const host = hud.els.peers;
    host.textContent = '';
    peers.forEach(function (peer) {
      const name = String(peer.name);
      host.appendChild(el('div', { class: 'peer num', title: name }, truncate(name, TEXT_MAX_NAME) + '  ' +
        Number(peer.score || 0).toLocaleString('en-US') + '  ' + (peer.combo || 0) + 'x' +
          (peer.connected ? '' : '  (offline)')));
    });
  }

  function renderSync(sync) {
    const key = sync || '';
    if (hud.rendered.sync === key) return;
    hud.rendered.sync = key;
    const host = hud.els.sync;
    host.textContent = '';
    if (!sync) return;
    const iconName = sync === 'good' ? 'check' : sync === 'fair' ? 'warn' : 'error';
    host.className = 'status-' + (sync === 'good' ? 'ok' : sync === 'fair' ? 'warn' : 'error');
    host.appendChild(icon(iconName));
    host.appendChild(doc.createTextNode(' ' + text('sync.' + sync)));
  }

  function announce(message) {
    if (!prefs.screenReaderLabels || !hud.els.sr) return;
    hud.els.sr.textContent = message;
  }

  // Only section changes and every 25th combo are read out; individual judgments would flood a screen reader.
  function announceChanges(fields) {
    if (fields.section && fields.section !== hud.lastSection) {
      hud.lastSection = fields.section;
      announce(String(fields.section));
    }
    const combo = Number(fields.combo) || 0;
    if (combo >= COMBO_MILESTONE && combo % COMBO_MILESTONE === 0 && combo !== hud.announcedCombo) {
      hud.announcedCombo = combo;
      announce(text('sr.combo', { n: combo }));
    }
    if (combo === 0) hud.announcedCombo = 0;
  }

  function applyHudScalars(fields, kind) {
    const show = (key) => hudPartShown(kind, key);
    const has = (name) => fields[name] !== undefined && fields[name] !== null;
    setHudShown('score', show('score'));
    if (show('score')) setHudText('score', Number(fields.score || 0).toLocaleString('en-US'));
    const combo = Number(fields.combo) || 0;
    setHudShown('combo', show('combo') && combo >= COMBO_MIN_SHOWN);
    if (combo >= COMBO_MIN_SHOWN) setHudText('combo', combo + 'x');
    setHudShown('accuracy', show('accuracy'));
    if (show('accuracy')) setHudText('accuracy', (100 * (Number(fields.accuracy) || 0)).toFixed(2) + '%');
    setHudShown('section', show('section') && has('section'));
    if (has('section')) setHudText('section', String(fields.section));
    setHudShown('life', show('life') && has('life'));
    if (has('life')) setHudText('life', text('hud.life', { n: Math.round(100 * Number(fields.life)) }));
    setHudShown('countin', show('countin') && has('countIn'));
    if (has('countIn')) setHudText('countin', text('hud.countIn', { n: fields.countIn }));
    setHudShown('step', show('step') && has('step'));
    if (has('step')) setHudText('step', text('hud.step', { index: fields.step.index, total: fields.step.total }));
  }

  function applyHudFreeplay(fields, kind) {
    const show = (key) => hudPartShown(kind, key);
    setHudShown('chord', show('chord') && Boolean(fields.chord));
    if (fields.chord) setHudText('chord', String(fields.chord));
    const info = [fields.keyLabel, fields.profileLabel, fields.octave === undefined ? null : 'Oct ' + fields.octave,
      fields.timingLabel].filter((part) => part !== undefined && part !== null && part !== '');
    setHudShown('keyinfo', show('keyinfo') && info.length > 0);
    if (info.length > 0) setHudText('keyinfo', info.join('  '));
  }

  function applyHudLists(fields, kind) {
    const show = (key) => hudPartShown(kind, key);
    setHudShown('performers', show('performers') && Array.isArray(fields.performers));
    if (Array.isArray(fields.performers)) renderPerformers(fields.performers);
    setHudShown('peers', show('peers') && Array.isArray(fields.peers));
    if (Array.isArray(fields.peers)) renderPeers(fields.peers);
    setHudShown('sync', show('sync') && Boolean(fields.sync));
    renderSync(fields.sync);
    setHudShown('beat', show('beat'));
    setHudShown('progress', show('progress'));
    setHudShown('pause', show('pause'));
    setHudShown('judgment', show('judgment') && hud.rendered.judgment !== undefined && hud.rendered.judgment !== '');
    setHudShown('hitline', show('judgment'));
  }

  function applyHudProgress(fields) {
    const fraction = clamp(Number(fields.progress) || 0, 0, 1);
    const width = (100 * fraction).toFixed(1) + '%';
    if (hud.rendered.progress === width) return;
    hud.rendered.progress = width;
    hud.fill.style.width = width;
    hud.els.progress.setAttribute('aria-valuenow', String(Math.round(100 * fraction)));
  }

  function applyHud() {
    hud.pending = null;
    hud.lastApply = Core.now();
    if (hud.kind === null) return;
    hud.applies += 1;
    applyHudScalars(hud.fields, hud.kind);
    applyHudFreeplay(hud.fields, hud.kind);
    applyHudLists(hud.fields, hud.kind);
    applyHudProgress(hud.fields);
    announceChanges(hud.fields);
  }

  function clearHudTimers() {
    if (hud.pending !== null) Core.timers.clearTimeout(hud.pending);
    if (hud.flashTimer !== null) Core.timers.clearTimeout(hud.flashTimer);
    if (hud.wordTimer !== null) Core.timers.clearTimeout(hud.wordTimer);
    hud.pending = null;
    hud.flashTimer = null;
    hud.wordTimer = null;
  }

  function hudShow(kind, owner) {
    assert(hasOwn(HUD_PARTS, kind), 'unknown HUD kind ' + kind);
    buildHud();
    clearHudTimers();
    hud.kind = kind;
    hud.owner = owner === undefined ? UI_OWNER : owner;
    hud.fields = {};
    hud.rendered = {};
    hud.shown = {};
    hud.announcedCombo = 0;
    hud.lastSection = null;
    const host = doc.getElementById('hud');
    host.hidden = false;
    host.className = 'hud-' + kind;
    hud.els.note.hidden = true;
    hud.els.note.textContent = '';
    stopGamepadNav();
    applyHud();
  }

  function hudHide() {
    clearHudTimers();
    hud.kind = null;
    hud.owner = null;
    const host = doc.getElementById('hud');
    if (host) host.hidden = true;
    startGamepadNavIfConnected();
  }

  function hudSet(fields) {
    if (hud.kind === null || !fields) return;
    Object.assign(hud.fields, fields);
    const elapsed = Core.now() - hud.lastApply;
    if (elapsed >= HUD_APPLY_MS) {
      if (hud.pending !== null) Core.timers.clearTimeout(hud.pending);
      applyHud();
      return;
    }
    if (hud.pending === null) hud.pending = Core.timers.setTimeout(applyHud, HUD_APPLY_MS - elapsed, hud.owner);
  }

  function pulseMarkers(lanes, on) {
    const markers = hud.els.hitline ? hud.els.hitline.children : [];
    (lanes || []).forEach(function (lane) {
      if (markers[lane]) markers[lane].classList.toggle('pulse', on);
    });
  }

  function clearJudgmentWord() {
    hud.wordTimer = null;
    hud.rendered.judgment = '';
    hud.els.judgment.textContent = '';
    hud.els.judgment.className = 'hud-judgment';
    setHudShown('judgment', false);
  }

  function showJudgmentWord(judgment) {
    const node = hud.els.judgment;
    node.textContent = '';
    node.className = 'hud-judgment j-' + judgment;
    node.appendChild(icon('j-' + judgment));
    if (prefs.showJudgmentText) node.appendChild(doc.createTextNode(' ' + text('judgment.' + judgment)));
    hud.rendered.judgment = judgment;
    setHudShown('judgment', hud.kind !== null && hudPartShown(hud.kind, 'judgment'));
    if (hud.wordTimer !== null) Core.timers.clearTimeout(hud.wordTimer);
    hud.wordTimer = Core.timers.setTimeout(clearJudgmentWord, HUD_WORD_MS, hud.owner);
  }

  function hudFlash(judgment, lanes, opts) {
    if (hud.kind === null) return;
    const kind = String(judgment).toLowerCase();
    if (JUDGMENTS.indexOf(kind) < 0) return;
    const stray = Boolean(opts && opts.stray);
    if (!stray || prefs.strayPressPenalty) showJudgmentWord(kind);
    pulseMarkers(lanes, true);
    if (hud.flashTimer !== null) Core.timers.clearTimeout(hud.flashTimer);
    hud.flashTimer = Core.timers.setTimeout(function () {
      hud.flashTimer = null;
      pulseMarkers([0, 1, 2, 3], false);
    }, HUD_FLASH_MS, hud.owner);
  }

  function hudNote(message) {
    buildHud();
    setHudText('note', message ? String(message) : '');
    hud.els.note.hidden = !message;
    hud.shown.note = Boolean(message);
  }

  function hudReset() {
    if (hud.kind === null) return;
    clearHudTimers();
    hud.fields = {};
    hud.rendered = {};
    hud.shown = {};
    hud.announcedCombo = 0;
    hud.lastSection = null;
    hud.els.judgment.className = 'hud-judgment';
    hud.els.judgment.textContent = '';
    applyHud();
  }

  const HUD = Object.freeze({ show: hudShow, hide: hudHide, set: hudSet, flash: hudFlash, note: hudNote,
    reset: hudReset,
    visible: () => hud.kind !== null });

  // ---------------------------------------------------------------------------------------------
  // Transport bar (shell; wired by T02.08)
  // ---------------------------------------------------------------------------------------------
  function createTransportBar(root, spec) {
    assert(root && root.nodeType === 1 && spec && Array.isArray(spec.buttons),
      'TransportBar.create needs a root and buttons');
    const bar = el('div', { class: 'transport', role: 'group', 'aria-label': 'Transport' });
    const handles = {};
    spec.buttons.filter((id) => TRANSPORT_BUTTONS.indexOf(id) >= 0).forEach(function (id) {
      handles[id] = Widgets.button({ id: 'transport-' + id, icon: id, label: '', ariaLabel: text('transport.' + id),
        kind: 'secondary', onPress: () => spec.onAction(id) });
      bar.appendChild(handles[id].root);
    });
    const position = el('span', { class: 'readout num', id: 'transport-position' });
    const clock = el('span', { class: 'readout num', id: 'transport-clock' });
    const tempo = spec.showTempo ? el('span', { class: 'readout num', id: 'transport-tempo' }) : null;
    const countIn = el('span', { class: 'badge', id: 'transport-countin', hidden: true });
    appendChildren(bar, [position, clock, tempo, countIn]);
    root.appendChild(bar);
    const setPressedState = (id, on) => { if (handles[id]) handles[id].root.setAttribute('aria-pressed',
      String(Boolean(on))); };
    const update = function (view) {
      const playing = view.state === 'playing' || view.state === 'recording';
      if (handles.play) handles.play.setLabel(text(playing ? 'transport.pause' : 'transport.play'),
        playing ? 'pause' : 'play');
      setPressedState('record', view.recording);
      setPressedState('loop', view.loop && view.loop.enabled);
      position.textContent = (Number(view.bar) + 1) + '.' + (Number(view.beat) + 1);
      clock.textContent = Core.formatTime(view.timeS) + ' / ' + Core.formatTime(view.durationS);
      if (tempo) tempo.textContent = (Number(view.bpm) || 0).toFixed(1) + ' BPM';
      countIn.hidden = view.countIn === null || view.countIn === undefined;
      if (!countIn.hidden) countIn.textContent = text('transport.countIn', { n: view.countIn });
    };
    const setEnabled = function (id, enabled, reason) {
      if (handles[id]) handles[id].setDisabled(enabled ? null : (reason || '-'));
    };
    const destroy = function () {
      Object.keys(handles).forEach((id) => handles[id].destroy());
      bar.remove();
    };
    return Object.freeze({ update, setEnabled, destroy, root: bar });
  }

  const TransportBar = Object.freeze({ create: createTransportBar });

  // ---------------------------------------------------------------------------------------------
  // Gamepad menu navigation (Part 6.26.4.4)
  // ---------------------------------------------------------------------------------------------
  function firstStandardGamepad() {
    if (typeof window.navigator.getGamepads !== 'function') return null;
    const all = Array.from(window.navigator.getGamepads() || []);
    return all.find((pad) => pad && pad.mapping === 'standard') || null;
  }

  function moveFocusByArrow(code) {
    const root = activeTrap() ? activeTrap().root : topScreenRoot();
    const list = focusable(root);
    if (list.length === 0) return;
    const current = list.indexOf(doc.activeElement);
    const forward = code === 'ArrowDown' || code === 'ArrowRight';
    const next = current < 0 ? 0 : (current + (forward ? 1 : -1) + list.length) % list.length;
    focusNode(list[next]);
  }

  function sendNavKey(item) {
    setFocusRingMode('key');
    const target = doc.activeElement || doc.body;
    const init = { code: item.code, key: item.key, bubbles: true, cancelable: true };
    const down = new window.KeyboardEvent('keydown', init);
    target.dispatchEvent(down);
    target.dispatchEvent(new window.KeyboardEvent('keyup', init));
    if (!down.defaultPrevented && item.code.indexOf('Arrow') === 0) moveFocusByArrow(item.code);
  }

  function pollGamepad() {
    const pad = firstStandardGamepad();
    const nowMs = Core.now();
    GAMEPAD_KEYS.forEach(function (item) {
      const held = gamepadNav.held[item.button] || (gamepadNav.held[item.button] = { down: false, since: 0, last: 0 });
      const pressed = Boolean(pad && pad.buttons[item.button] && pad.buttons[item.button].pressed);
      if (!pressed) {
        held.down = false;
        return;
      }
      const edge = !held.down;
      const repeating = item.repeat && nowMs - held.since >= GAMEPAD_REPEAT_DELAY_MS &&
        nowMs - held.last >= GAMEPAD_REPEAT_MS;
      if (edge) held.since = nowMs;
      held.down = true;
      if (edge || repeating) {
        held.last = nowMs;
        sendNavKey(item);
      }
    });
  }

  function startGamepadNavIfConnected() {
    if (gamepadNav.timer !== null || gamepadNav.connected.size === 0 || hud.kind !== null) return;
    if (initOptions.caps && initOptions.caps.gamepad === false) return;
    gamepadNav.timer = Core.timers.setInterval(pollGamepad, GAMEPAD_POLL_MS, UI_OWNER);
  }

  function stopGamepadNav() {
    if (gamepadNav.timer !== null) Core.timers.clearInterval(gamepadNav.timer);
    gamepadNav.timer = null;
    gamepadNav.held = {};
  }

  function onInputDevice(evt) {
    if (!evt || evt.source !== 'gamepad') return;
    const id = String(evt.id === undefined ? evt.index : evt.id);
    if (evt.connected) gamepadNav.connected.add(id);
    else gamepadNav.connected.delete(id);
    if (gamepadNav.connected.size === 0) stopGamepadNav();
    else startGamepadNavIfConnected();
  }

  // ---------------------------------------------------------------------------------------------
  // Keyboard handling, settings, init (Part 6.26.4.4)
  // ---------------------------------------------------------------------------------------------
  function onDocumentKeydown(evt) {
    const name = keyName(evt);
    if (NAV_KEYS.indexOf(name) >= 0) setFocusRingMode('key');
    if (dialogs.length > 0) {
      if (name === 'Escape') {
        evt.preventDefault();
        cancelTopDialog();
      }
      return;
    }
    if (isTextField(evt.target) && name !== 'Escape') return;
    if (runScreenShortcut(evt, name)) return;
    if (name === 'Escape' && !evt.defaultPrevented) handleEscape(evt);
  }

  function runScreenShortcut(evt, name) {
    const top = stack[stack.length - 1];
    const handler = top && top.controller.keys && top.controller.keys[name];
    if (typeof handler !== 'function') return false;
    let handled = false;
    try {
      handled = handler(evt) === true;
    } catch (error) {
      report('E-GEN-001', error, { screen: top.id, op: 'keys' });
    }
    if (handled) evt.preventDefault();
    return handled;
  }

  // In gameplay Escape is the pause control of M-07; a field or number box consumes it itself.
  function handleEscape(evt) {
    if (bodyHas('in-game')) return;
    if (evt.target && evt.target.closest && evt.target.closest('[data-widget="field"], [data-widget="number"]')) return;
    evt.preventDefault();
    back('key');
  }

  function onPointerDown() {
    setFocusRingMode('pointer');
  }

  function scheduleMeasure() {
    if (resizeTimer !== null) Core.timers.clearTimeout(resizeTimer);
    resizeTimer = Core.timers.setTimeout(function () {
      resizeTimer = null;
      measure();
    }, RESIZE_DEBOUNCE_MS, UI_OWNER);
  }

  function onOrientationChange() {
    measure();
    Core.timers.setTimeout(measure, ORIENTATION_RECHECK_MS, UI_OWNER);
  }

  function installListeners() {
    const on = (target, type, fn, options) => Core.dom.on(target, type, fn, options, UI_OWNER);
    on(doc, 'keydown', onDocumentKeydown, true);
    on(doc, 'pointerdown', onPointerDown, true);
    on(doc, 'focusin', onFocusIn);
    on(doc, 'focusout', onFocusOut);
    on(window, 'resize', scheduleMeasure);
    on(window, 'orientationchange', onOrientationChange);
    if (window.visualViewport) on(window.visualViewport, 'resize', scheduleMeasure);
    mediaQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
      on(mediaQuery, 'change', () => { if (presentation.mode === 'system') setReducedMotion('system'); });
    }
  }

  function applySettingKey(key, value) {
    if (key === 'video.uiScale') setScale(value);
    else if (key === 'video.reducedMotion') setReducedMotion(value);
    else if (key === 'video.highContrast') setHighContrast(value);
    else if (key === 'accessibility.screenReaderLabels') prefs.screenReaderLabels = Boolean(value);
    else if (key === 'accessibility.flashOnBeat') prefs.flashOnBeat = Boolean(value);
    else if (key === 'accessibility.largeJudgmentText') applyLargeJudgment(value);
    else if (key === 'gameplay.showJudgmentText') prefs.showJudgmentText = Boolean(value);
    else if (key === 'gameplay.lifeBar') prefs.lifeBar = Boolean(value);
    else if (key === 'gameplay.strayPressPenalty') prefs.strayPressPenalty = Boolean(value);
    else if (key === 'input.padLayout' || key === 'input.padSize' ||
      key === 'input.padOpacity') applyPadSetting(key, value);
    else return;
    if (hud.kind !== null) applyHud();
  }

  function applyLargeJudgment(value) {
    prefs.largeJudgmentText = Boolean(value);
    doc.documentElement.classList.toggle('large-judgment', prefs.largeJudgmentText);
  }

  function applyPadSetting(key, value) {
    if (!pads.spec) return;
    if (key === 'input.padLayout') {
      prefs.padLayout = value === 'right' ? 'right' : 'bottom';
      pads.spec.layout = prefs.padLayout;
    } else if (key === 'input.padSize') {
      pads.spec.size = value;
    } else {
      pads.spec.opacity = value;
      doc.getElementById('touch').style.setProperty('--pad-opacity', String(clamp(Number(value) || 0.75, 0.3, 1)));
    }
    layoutPads();
  }

  const SETTING_KEYS = Object.freeze([['video', ['uiScale', 'reducedMotion', 'highContrast']],
    ['accessibility', ['screenReaderLabels', 'flashOnBeat', 'largeJudgmentText']],
    ['gameplay', ['showJudgmentText', 'lifeBar', 'strayPressPenalty']], ['input', ['padLayout', 'padSize',
      'padOpacity']]]);

  function applySettingsDocument(settings) {
    SETTING_KEYS.forEach(function (group) {
      const values = settings && settings[group[0]];
      if (!values) return;
      group[1].forEach(function (name) {
        if (values[name] !== undefined) applySettingKey(group[0] + '.' + name, values[name]);
      });
    });
  }

  function onSettingsChanged(evt) {
    if (!evt) return;
    if (evt.key === '*' && evt.value && typeof evt.value === 'object') applySettingsDocument(evt.value);
    else applySettingKey(evt.key, evt.value);
  }

  /** Called once by M-29 boot step B6. Idempotent. @param {{settings:object, caps:object}} opts */
  function init(opts) {
    if (initialized) return;
    initialized = true;
    initOptions = opts || {};
    installListeners();
    bus.on('settings.changed', onSettingsChanged, UI_OWNER);
    bus.on('input.device', onInputDevice, UI_OWNER);
    Core.ErrorReporter.setPresenter(presentError);
    applySettingsDocument(initOptions.settings);
    setReducedMotion(presentation.mode);
    measure();
  }

  // ---------------------------------------------------------------------------------------------
  // Test hooks and counters
  // ---------------------------------------------------------------------------------------------
  /** Leak-test helper for M-28. */
  function counters() {
    return { screens: stack.length, dialogs: dialogs.length, toasts: toasts.visible.length,
      toastsQueued: toasts.queue.length,
      toastsDeduped: toasts.deduped, traps: traps.length, padEls: pads.els.length, hudVisible: hud.kind !== null,
      hudApplies: hud.applies, widgets: liveWidgets.size, initialized };
  }

  // Tests only: clears every dynamic thing (stack, dialogs, toasts, traps, widgets, HUD, pads, settings effects).
  function resetForTests() {
    closeAllDialogs('reset');
    clearToasts();
    toasts.deduped = 0;
    while (traps.length > 0) releaseEntry(traps[traps.length - 1]);
    hidePads();
    hudHide();
    while (stack.length > 0) unmountEntry(stack.pop());
    Array.from(liveWidgets).forEach(destroyWidget);
    hud.nodes.forEach((node) => node.remove());
    Object.assign(hud, { nodes: [], els: {}, fill: null, built: false, rendered: {}, shown: {}, fields: {} });
    setHistory(false);
    resolver = null;
    forcedMeasure = null;
    requestedScale = 1;
    Object.assign(prefs, defaultPrefs());
    hud.applies = 0;
    textEntryAllowed = true;
    setHighContrast(false);
    setReducedMotion('system');
    applyLargeJudgment(false);
    setFocusRingMode('pointer');
    rememberedElement = null;
    stopGamepadNav();
    gamepadNav.connected.clear();
    if (initialized) {
      applyScale();
      measure();
    }
  }

  // Tests only: resetForTests plus removal of every permanent listener, timer and subscription of init().
  function teardownForTests() {
    resetForTests();
    Core.dom.offOwner(UI_OWNER);
    Core.timers.clearOwner(UI_OWNER);
    bus.removeOwner(UI_OWNER);
    Core.ErrorReporter.setPresenter(null);
    if (probeElement) probeElement.remove();
    probeElement = null;
    resizeTimer = null;
    initialized = false;
    initOptions = {};
  }

  // Styles and glyphs are installed once when the module loads, so widgets look right even before init() runs.
  installStyles();
  installGlyphs();

  return Object.freeze({
    init,
    Screens,
    Focus,
    Frame,
    dialog,
    closeAllDialogs,
    dialogCount: () => dialogs.length,
    toast,
    clearToasts,
    confirmUnsaved,
    Widgets,
    HUD,
    TouchPads,
    TransportBar,
    Layout,
    setReducedMotion,
    reducedMotion: () => presentation.reducedMotion,
    setHighContrast,
    setTextEntryAllowed,
    textEntryAllowed: () => textEntryAllowed,
    truncate,
    TEXT,
    text,
    el,
    icon,
    counters,
    _resetForTests: resetForTests,
    _teardownForTests: teardownForTests
  });
});
})();
