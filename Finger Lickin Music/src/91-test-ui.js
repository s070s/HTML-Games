// 91-test-ui.js - unit tests for M-26 FLM.UI (group 'ui'; test build only).
// UT-26-01 to UT-26-26 follow Part 6.26.8. UT-26-27 to UT-26-35 are extra checks for T01.06 and T01.07
// (shared frame, token contrast, accessible names, focus ring, UI scale, dialog roles, tabs and number,
// touch rules, gamepad menu navigation). UT-26-37 to UT-26-41 cover the wired transport bar (T02.08). The touch-only
// tests run in the touch pass of tools/selftest.mjs.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('ui', (t) => {
  const Core = FLM.Core;
  const UI = FLM.UI;
  const bus = Core.bus;
  const doc = window.document;
  const REGIONS = ['overlay', 'hud', 'touch'];
  const NO_INSET = { top: 0, right: 0, bottom: 0, left: 0 };
  const SLIDER_COALESCE_MS = 100;
  const TOAST_INFO_MS = 3000;
  const TOAST_ERROR_MS = 7000;
  const STATE_RESET_MS = 2000;
  const SPINNER_DELAY_MS = 300;
  const GAMEPAD_POLL_MS = 100;
  const HUD_APPLY_TRAILING_MS = 40;
  const TEXT_CONTRAST = 4.5;
  const NON_TEXT_CONTRAST = 3;
  const MIN_TOUCH_SIDE = 56;

  let ownsInit = false;
  let hadMenu = false;                       // boot left the main menu on screen; this group puts it back
  let savedChildren = {};

  t.before(() => {
    hadMenu = UI.Screens.depth() > 0;
    if (UI.counters().initialized) return;
    UI.init({ settings: {}, caps: {} });
    ownsInit = true;
  });

  // The tests unmount the menu screen; mount it again and take a fresh leak baseline, as the screens group does.
  t.after(async () => {
    UI._resetForTests();
    if (ownsInit) UI._teardownForTests();
    if (hadMenu) {
      FLM.Screens.register();
      await UI.Screens.push('SCR-MainMenu', {});
    }
    FLM.Modes._teardownForTests();
  });

  // Each test starts from empty #overlay, #hud and #touch; the runner's page content is put back afterwards.
  t.beforeEach(() => {
    UI._resetForTests();
    savedChildren = {};
    REGIONS.forEach((id) => {
      const node = doc.getElementById(id);
      savedChildren[id] = Array.from(node.childNodes);
      savedChildren[id].forEach((child) => child.remove());
    });
  });

  t.afterEach(() => {
    UI._resetForTests();
    doc.body.classList.remove('touch');
    REGIONS.forEach((id) => {
      const node = doc.getElementById(id);
      Array.from(node.childNodes).forEach((child) => child.remove());
      savedChildren[id].forEach((child) => node.appendChild(child));
    });
  });

  // ---------------------------------------------------------------- helpers

  function overlay() {
    return doc.getElementById('overlay');
  }

  function attach(node) {
    overlay().appendChild(node);
    return node;
  }

  function press(target, code, extra) {
    const init = Object.assign({ code, key: code, bubbles: true, cancelable: true }, extra);
    const event = new window.KeyboardEvent('keydown', init);
    target.dispatchEvent(event);
    return event;
  }

  function releaseKey(target, code) {
    target.dispatchEvent(new window.KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
  }

  function flush() {
    return Promise.resolve().then(() => Promise.resolve());
  }

  function capture(topic) {
    const events = [];
    bus.on(topic, (payload) => events.push(payload), t.owner);
    return events;
  }

  // A test screen: mount adds a heading and a button so there is something focusable.
  function controllerFor(id, hooks) {
    const calls = [];
    return Object.assign({
      id,
      calls,
      mount(root) {
        calls.push('mount');
        root.appendChild(UI.el('h1', null, id));
        root.appendChild(UI.el('button', { type: 'button', id: 'btn-' + id }, 'Open ' + id));
      },
      unmount() { calls.push('unmount'); }
    }, hooks);
  }

  function useScreens(controllers) {
    UI.Screens.setResolver((id) => (controllers[id] ? () => controllers[id] : null));
  }

  function sectionOf(id) {
    return overlay().querySelector('[data-screen="' + id + '"]');
  }

  function toastTexts() {
    return Array.from(doc.querySelectorAll('#toast .toast-text')).map((node) => node.textContent);
  }

  function dialogSpec(id, extra) {
    return Object.assign({ id, title: 'Title ' + id, body: 'Body',
      buttons: [{ id: 'ok', label: 'OK', kind: 'primary', isDefault: true },
        { id: 'cancel', label: 'Cancel', kind: 'secondary', isCancel: true }] }, extra);
  }

  function colorOf(name) {
    return window.getComputedStyle(doc.documentElement).getPropertyValue(name).trim();
  }

  function parseColor(value) {
    const hex = /^#([0-9a-f]{6})$/i.exec(value);
    if (hex) return [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16));
    const rgb = /^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/.exec(value);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    throw new Error('cannot read the color "' + value + '"');
  }

  function luminance(color) {
    const linear = color.map((channel) => {
      const unit = channel / 255;
      return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrast(foreground, background) {
    const a = luminance(parseColor(foreground));
    const b = luminance(parseColor(background));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function accessibleName(node) {
    const label = node.getAttribute('aria-label');
    if (label) return label;
    const ids = node.getAttribute('aria-labelledby');
    if (ids) return ids.split(' ').map((id) => (doc.getElementById(id) ||
      { textContent: '' }).textContent).join(' ').trim();
    if (node.id) {
      const forLabel = doc.querySelector('label[for="' + node.id + '"]');
      if (forLabel) return forLabel.textContent.trim();
    }
    return node.textContent.trim();
  }

  // ---------------------------------------------------------------- UT-26-01 to UT-26-07: screens and history

  t.test('UT-26-01 push and pop order', async () => {
    const controllers = { A: controllerFor('A'), B: controllerFor('B'), C: controllerFor('C') };
    useScreens(controllers);
    const events = capture('ui.screen');
    await UI.Screens.push('A');
    await UI.Screens.push('B');
    await UI.Screens.push('C');
    t.eq(await UI.Screens.pop(), true);
    t.eq(await UI.Screens.pop(), true);
    t.deepEq(UI.Screens.ids(), ['A']);
    t.deepEq(events.map((item) => item.action + item.depth), ['push1', 'push2', 'push3', 'pop2', 'pop1']);
    t.eq(controllers.B.calls.filter((call) => call === 'unmount').length, 1);
    t.eq(controllers.C.calls.filter((call) => call === 'unmount').length, 1);
    t.eq(await UI.Screens.pop(), false, 'the root is never popped');
  });

  t.test('UT-26-02 lower screens inert', async () => {
    useScreens({ A: controllerFor('A'), B: controllerFor('B') });
    await UI.Screens.push('A');
    await UI.Screens.push('B');
    const lower = sectionOf('A');
    const upper = sectionOf('B');
    t.ok(lower.hasAttribute('inert') && lower.getAttribute('aria-hidden') === 'true', 'A is inert and hidden');
    t.ok(!upper.hasAttribute('inert') && !upper.hasAttribute('aria-hidden'), 'B is interactive');
    await UI.Screens.pop();
    t.ok(!lower.hasAttribute('inert') && !lower.hasAttribute('aria-hidden'), 'A is interactive again');
  });

  t.test('UT-26-03 failing mount keeps stack', async () => {
    const failing = controllerFor('B', {
      mount(root, params, ctx) {
        Core.dom.on(root, 'click', () => {}, undefined, ctx.owner);
        throw new Error('mount failed');
      }
    });
    useScreens({ A: controllerFor('A'), B: failing });
    await UI.Screens.push('A');
    const listeners = Core.dom.count();
    await t.rejects(UI.Screens.push('B'), 'E-MODE-002');
    t.deepEq(UI.Screens.ids(), ['A']);
    t.eq(sectionOf('B'), null, 'no B section is left');
    t.eq(Core.dom.count(), listeners);
    await t.rejects(UI.Screens.push('missing'), 'E-MODE-002');
  });

  t.test('UT-26-04 unmount throw still cleans', async () => {
    const broken = controllerFor('B', {
      mount(root, params, ctx) { Core.dom.on(root, 'click', () => {}, undefined, ctx.owner); },
      unmount() { throw new Error('unmount failed UT-26-04'); }
    });
    useScreens({ A: controllerFor('A'), B: broken });
    await UI.Screens.push('A');
    const baseline = Core.dom.count();
    await UI.Screens.push('B');
    t.eq(Core.dom.count(), baseline + 1, 'B registered one listener');
    await UI.Screens.pop();
    UI.clearToasts();   // the reported error was toasted, and a toast has its own button listener
    t.eq(Core.dom.count(), baseline);
    const recorded = Core.ErrorReporter.records().some((record) => record.code === 'E-GEN-001' &&
      record.context.screen === 'B' && record.context.op === 'unmount');
    t.ok(recorded, 'E-GEN-001 was recorded');
  });

  t.test('UT-26-05 back consults onBack', async () => {
    const answers = ['handled', 'pop'];
    const guarded = controllerFor('B', { onBack: () => answers.shift() });
    useScreens({ A: controllerFor('A'), B: guarded });
    await UI.Screens.push('A');
    t.eq(await UI.Screens.back('key'), 'root');
    await UI.Screens.push('B');
    t.eq(await UI.Screens.back('key'), 'handled');
    t.eq(UI.Screens.depth(), 2);
    t.eq(await UI.Screens.back('key'), 'pop');
    t.eq(UI.Screens.depth(), 1);
    guarded.onBack = () => { throw new Error('onBack failed UT-26-05'); };
    await UI.Screens.push('B');
    t.eq(await UI.Screens.back('button'), 'handled', 'a throwing onBack counts as handled');
    t.eq(UI.Screens.depth(), 2);
  });

  t.test('UT-26-06 history entries follow stack', async () => {
    useScreens({ A: controllerFor('A'), B: controllerFor('B') });
    UI.Screens.setHistory(true);
    const back = t.fakes.stub(window.history, 'back');
    await UI.Screens.push('A');
    await UI.Screens.push('B');
    t.eq(window.history.state.depth, 2);
    await UI.Screens.pop();
    t.eq(back.count, 1, 'pop moves the browser back once');
    await UI.Screens.push('B');
    await UI.Screens.onPopState({ flm: 1, depth: 1 });
    t.eq(UI.Screens.depth(), 2, 'the popstate caused by pop is swallowed');
    await UI.Screens.onPopState({ flm: 1, depth: 1 });
    t.eq(UI.Screens.depth(), 1, 'a browser back pops the screen');
    t.eq(back.count, 1, 'browser back does not move the history again');
  });

  t.test('UT-26-06b history failure falls back to in-app navigation', async () => {
    useScreens({ A: controllerFor('A') });
    UI.Screens.setHistory(true);
    t.fakes.stub(window.history, 'pushState', () => { throw new Error('SecurityError'); });
    await UI.Screens.push('A');
    t.deepEq(UI.Screens.ids(), ['A']);
  });

  t.test('UT-26-07 forward is a no-op', async () => {
    useScreens({ A: controllerFor('A'), B: controllerFor('B') });
    UI.Screens.setHistory(true);
    const back = t.fakes.stub(window.history, 'back');
    await UI.Screens.push('A');
    await UI.Screens.push('B');
    await UI.Screens.onPopState({ flm: 1, depth: 3 });
    t.eq(UI.Screens.depth(), 2);
    t.eq(back.count, 1);
  });

  t.test('UT-26-07b replace and popTo', async () => {
    useScreens({ A: controllerFor('A'), B: controllerFor('B'), C: controllerFor('C'), D: controllerFor('D') });
    await UI.Screens.push('A');
    await UI.Screens.push('B');
    await UI.Screens.push('C');
    await UI.Screens.replace('D');
    t.deepEq(UI.Screens.ids(), ['A', 'B', 'D']);
    t.eq(await UI.Screens.popTo('A'), 2);
    t.deepEq(UI.Screens.ids(), ['A']);
    t.eq(await UI.Screens.popTo('missing'), 0);
  });

  // ---------------------------------------------------------------- UT-26-08 to UT-26-10: dialogs

  t.test('UT-26-08 dialog focus trap and restore', async () => {
    const opener = attach(UI.el('button', { type: 'button' }, 'Opener'));
    opener.focus();
    const result = UI.dialog(dialogSpec('DLG-Trap'));
    const dialogEl = doc.querySelector('[data-dialog="DLG-Trap"]');
    const inside = () => dialogEl.contains(doc.activeElement);
    t.ok(inside(), 'focus moved into the dialog');
    for (let count = 0; count < 3; count += 1) {
      press(doc.activeElement, 'Tab');
      t.ok(inside(), 'Tab ' + (count + 1) + ' stays inside');
    }
    press(doc.activeElement, 'Tab', { shiftKey: true });
    t.ok(inside(), 'Shift+Tab stays inside');
    doc.querySelector('[data-dialog="DLG-Trap"] button').click();
    t.eq(await result, 'ok');
    t.eq(doc.activeElement, opener, 'focus returns to the opener');
    t.eq(UI.dialogCount(), 0);
  });

  t.test('UT-26-09 dialog escape and danger default', async () => {
    const result = UI.dialog(dialogSpec('DLG-Danger', {
      consequence: 'The project is deleted.',
      buttons: [{ id: 'cancel', label: 'Cancel', kind: 'secondary', isCancel: true },
        { id: 'delete', label: 'Delete', kind: 'danger' }]
    }));
    t.eq(doc.activeElement.id, 'w-DLG-Danger-cancel', 'a destructive button is never the default focus');
    press(doc.activeElement, 'Escape');
    t.eq(await result, 'cancel');
    await t.rejects(UI.dialog(dialogSpec('DLG-NoConsequence', {
      buttons: [{ id: 'cancel', label: 'Cancel', kind: 'secondary', isCancel: true },
        { id: 'delete', label: 'Delete', kind: 'danger' }]
    })), 'E-GEN-004');
    t.eq(UI.dialogCount(), 0);
  });

  t.test('UT-26-10 dialog stack limit', async () => {
    const results = [1, 2, 3].map((number) => UI.dialog(dialogSpec('DLG-Stack' + number)));
    await t.rejects(UI.dialog(dialogSpec('DLG-Stack4')), 'E-GEN-001');
    t.eq(UI.dialogCount(), 3);
    t.eq(UI.closeAllDialogs('test'), 3);
    t.deepEq(await Promise.all(results), ['dismissed', 'dismissed', 'dismissed']);
    t.eq(UI.dialogCount(), 0);
  });

  t.test('UT-26-10b dialog events and unsaved-changes helper', async () => {
    const events = capture('ui.dialog');
    const result = UI.confirmUnsaved({ title: 'Unsaved changes', body: 'Body', changeCount: 3 }, { canSave: true });
    t.eq(doc.activeElement.id, 'w-DLG-UnsavedChanges-save', 'the non-destructive default gets focus');
    doc.getElementById('w-DLG-UnsavedChanges-discard').click();
    t.eq(await result, 'discard');
    t.deepEq(events.map((item) => item.open + ':' + item.result), ['true:null', 'false:discard']);
    const noSave = UI.confirmUnsaved({ title: 'Unsaved changes', body: 'Body', changeCount: 1 }, { canSave: false });
    t.eq(doc.activeElement.id, 'w-DLG-UnsavedChanges-cancel');
    UI.closeAllDialogs('test');
    t.eq(await noSave, 'dismissed');
  });

  // ---------------------------------------------------------------- UT-26-11: toasts

  t.test('UT-26-11 toast queue, durations, dedupe', () => {
    const timers = t.fakes.timers();
    timers.install();
    ['one', 'two', 'three', 'four'].forEach((message) => UI.toast(message));
    UI.toast('five', { key: 'one' });
    const counts = UI.counters();
    t.eq(counts.toasts, 3);
    t.eq(counts.toastsQueued, 1);
    t.eq(counts.toastsDeduped, 1);
    timers.advance(TOAST_INFO_MS);
    t.deepEq(toastTexts(), ['four'], 'the queued toast appears when a visible one expires');
    UI.clearToasts();
    UI.toast('boom', { kind: 'error' });
    t.eq(doc.querySelector('#toast .toast-error').getAttribute('role'), 'alert');
    timers.advance(TOAST_ERROR_MS - 1);
    t.eq(UI.counters().toasts, 1, 'an error toast lasts 7 s');
    timers.advance(1);
    t.eq(UI.counters().toasts, 0);
    UI.toast('with action', { action: { label: 'Undo', onPress: () => {} } });
    timers.advance(7999);
    t.eq(UI.counters().toasts, 1, 'a toast with an action lasts 8 s');
    timers.advance(1);
    t.eq(UI.counters().toasts, 0);
  });

  // ---------------------------------------------------------------- UT-26-12 to UT-26-15: widgets

  t.test('UT-26-12 button states', async () => {
    const timers = t.fakes.timers();
    timers.install();
    let release = null;
    let presses = 0;
    const pending = UI.Widgets.button({ id: 'pending', label: 'Go', onPress: () => {
      presses += 1;
      return new Promise((resolve) => { release = resolve; });
    } });
    attach(pending.root);
    pending.root.click();
    t.eq(pending.root.getAttribute('data-state'), 'loading');
    t.eq(pending.root.getAttribute('aria-busy'), 'true');
    t.eq(pending.root.querySelector('.spinner'), null, 'no spinner before 300 ms');
    timers.advance(SPINNER_DELAY_MS);
    t.ok(pending.root.querySelector('.spinner'), 'the spinner shows after 300 ms');
    pending.root.click();
    t.eq(presses, 1, 'a second press is ignored while loading');
    release();
    await flush();
    t.eq(pending.root.getAttribute('data-state'), 'idle');
    t.eq(pending.root.querySelector('.spinner'), null);
    const failing = UI.Widgets.button({ id: 'failing', label: 'Fail',
      onPress: () => { throw new Error('boom UT-26-12'); } });
    attach(failing.root);
    failing.root.click();
    t.eq(failing.root.getAttribute('data-state'), 'error');
    timers.advance(STATE_RESET_MS);
    t.eq(failing.root.getAttribute('data-state'), 'idle');
    const recorded = Core.ErrorReporter.records().some((record) => record.code === 'E-GEN-001' &&
      record.context.widget === 'failing');
    t.ok(recorded, 'E-GEN-001 carries the widget id');
  });

  t.test('UT-26-13 slider keyboard', () => {
    const timers = t.fakes.timers();
    timers.install();
    const inputs = [];
    const changes = [];
    const widget = UI.Widgets.slider({ id: 'vol', label: 'Volume', min: 0, max: 100, step: 5, value: 0, unit: '%',
      precision: 0, onInput: (value) => inputs.push(value), onChange: (value) => changes.push(value) });
    attach(widget.root);
    const input = widget.root.querySelector('input');
    const readout = widget.root.querySelector('output');
    const step = (code) => { press(input, code); const shown = readout.textContent; releaseKey(input,
      code); return shown; };
    t.eq(step('ArrowRight'), '5%');
    t.eq(step('PageUp'), '55%');
    t.eq(step('End'), '100%');
    t.eq(step('Home'), '0%');
    t.deepEq(changes, [5, 55, 100, 0], 'onChange fires once per key release');
    t.eq(input.getAttribute('aria-valuetext'), '0%');
    inputs.length = 0;
    timers.advance(SLIDER_COALESCE_MS);
    ['ArrowRight', 'ArrowRight', 'ArrowRight', 'PageUp'].forEach((code) => press(input, code));
    t.eq(inputs.length, 1, 'only the first key press reaches onInput at once');
    timers.advance(SLIDER_COALESCE_MS);
    t.deepEq(inputs, [5, 65], 'the trailing call carries the last value');
  });

  t.test('UT-26-14 disabled reason', () => {
    let presses = 0;
    const widget = UI.Widgets.button({ id: 'locked', label: 'Play', disabledReason: 'Needs audio',
      onPress: () => { presses += 1; } });
    attach(widget.root);
    t.eq(widget.root.getAttribute('aria-disabled'), 'true');
    t.ok(!widget.root.hasAttribute('disabled'), 'a disabled control stays focusable');
    widget.focus();
    t.eq(doc.activeElement, widget.root);
    press(widget.root, 'Enter');
    t.eq(presses, 0);
    t.ok(toastTexts().includes('Needs audio'), 'the reason is shown as a toast');
    const reason = doc.getElementById(widget.root.getAttribute('aria-describedby'));
    t.eq(reason.textContent, 'Needs audio', 'aria-describedby points at the visible reason');
    widget.setDisabled(null);
    t.ok(!widget.root.hasAttribute('aria-disabled'));
    widget.root.click();
    t.eq(presses, 1);
  });

  t.test('UT-26-15 roving tabindex list', () => {
    const picked = [];
    const items = [0, 1, 2, 3, 4].map((index) => ({ id: 'i' + index, primary: 'Item ' + index,
      disabledReason: index === 2 ? 'Not available' : undefined }));
    const widget = UI.Widgets.list({ id: 'menu', label: 'Menu', items, onPick: (id) => picked.push(id),
      emptyText: 'Nothing' });
    attach(widget.root);
    const rows = Array.from(widget.root.querySelectorAll('li'));
    const zeros = () => rows.filter((row) => row.getAttribute('tabindex') === '0').length;
    t.eq(zeros(), 1);
    rows[0].focus();
    const visited = [];
    for (let count = 0; count < 5; count += 1) {
      press(doc.activeElement, 'ArrowDown');
      visited.push(rows.indexOf(doc.activeElement));
      t.eq(zeros(), 1, 'exactly one tab stop');
    }
    t.deepEq(visited, [1, 2, 3, 4, 0], 'ArrowDown moves through every item and wraps');
    press(rows[4], 'Home');
    t.eq(doc.activeElement, rows[0]);
    press(rows[0], 'End');
    t.eq(doc.activeElement, rows[4]);
    rows[2].focus();
    press(rows[2], 'Enter');
    t.deepEq(picked, [], 'a disabled item is focusable but not activatable');
    press(rows[1], 'Enter');
    t.deepEq(picked, ['i1']);
    widget.setItems([]);
    t.ok(widget.root.querySelector('p.empty') && !widget.root.querySelector('p.empty').hidden, 'empty state text');
  });

  // ---------------------------------------------------------------- UT-26-16 to UT-26-19: layout

  t.test('UT-26-16 layout classes and event', () => {
    UI.Layout._measureFrom({ width: 1000, height: 1000, dpr: 1, safeArea: NO_INSET });
    const events = capture('ui.layout');
    UI.Layout._measureFrom({ width: 390, height: 844, dpr: 2, safeArea: NO_INSET });
    const body = doc.body;
    t.ok(body.classList.contains('portrait') && body.classList.contains('compact') &&
      !body.classList.contains('landscape'));
    t.eq(body.dataset.width, 'narrow');
    UI.Layout._measureFrom({ width: 844, height: 390, dpr: 2, safeArea: NO_INSET });
    t.ok(body.classList.contains('landscape') && !body.classList.contains('portrait'));
    t.deepEq(events.map((item) => item.orientation), ['portrait', 'landscape']);
    UI.Layout._measureFrom({ width: 844, height: 390, dpr: 2, safeArea: { top: NaN, right: NaN, bottom: NaN,
      left: NaN } });
    t.deepEq(UI.Layout.safeArea(), NO_INSET, 'an unreadable safe area counts as zero');
    UI.Layout._measureFrom({ width: 1300, height: 800, dpr: 1, safeArea: NO_INSET });
    t.ok(!body.classList.contains('compact'));
    t.eq(UI.Layout.widthClass(), 'wide');
  });

  t.test('UT-26-17 ui scale clamp and compact cap', () => {
    UI.Layout._measureFrom({ width: 1280, height: 720, dpr: 1, safeArea: NO_INSET });
    t.eq(UI.Layout.setScale(1.47), 1.45);
    t.eq(colorOf('--ui'), '1.45');
    UI.Layout._measureFrom({ width: 390, height: 844, dpr: 1, safeArea: NO_INSET });
    t.eq(UI.Layout.setScale(1.47), 1.3, 'compact layouts are capped at 1.3');
    t.eq(colorOf('--ui'), '1.3');
    t.eq(UI.Layout.setScale(0.5), 0.8);
    t.eq(UI.Layout.setScale(9), 1.3);
    UI.Layout._measureFrom({ width: 1280, height: 720, dpr: 1, safeArea: NO_INSET });
    t.eq(UI.Layout.scale(), 1.5, 'the cap lifts again on a large screen');
  });

  function padSpec(extra) {
    return Object.assign({ kind: 'lanes', layout: 'bottom', size: 'medium', opacity: 0.75,
      labels: ['Circle pad', 'Triangle pad', 'Square pad', 'Diamond pad'], maxTouches: 5 }, extra);
  }

  t.test('UT-26-18 pad geometry portrait', () => {
    const safeBottom = 20;
    UI.Layout._measureFrom({ width: 390, height: 844, dpr: 1, safeArea: { top: 0, right: 0, bottom: safeBottom,
      left: 0 } });
    UI.TouchPads.show(padSpec());
    const rects = UI.TouchPads.rects();
    t.eq(rects.length, 4);
    rects.forEach((rect, index) => {
      t.ok(rect.h >= 72 && rect.w >= MIN_TOUCH_SIDE, 'pad ' + index + ' is large enough');
      t.ok(rect.y >= 844 * (1 - 0.28) - safeBottom - 1, 'inside the bottom 28 percent');
      t.ok(rect.y + rect.h <= 844 - safeBottom, 'above the safe area');
      if (index > 0) t.ok(rect.x - (rects[index - 1].x + rects[index - 1].w) >= 8, 'gap of at least 8 px');
    });
    t.eq(doc.getElementById('pad-0').style.width, rects[0].w + 'px');
    t.eq(doc.getElementById('touch').hidden, false);
    UI.TouchPads.hide();
    t.eq(doc.getElementById('touch').hidden, true);
    t.eq(UI.counters().padEls, 0);
  });

  t.test('UT-26-19 pad geometry landscape right', () => {
    UI.Layout._measureFrom({ width: 844, height: 390, dpr: 1, safeArea: NO_INSET });
    UI.TouchPads.show(padSpec({ layout: 'right', size: 'small' }));
    const rects = UI.TouchPads.rects();
    rects.forEach((rect) => {
      t.ok(rect.w >= MIN_TOUCH_SIDE && rect.h >= MIN_TOUCH_SIDE, 'every side is at least 56 px');
      t.ok(rect.x >= 844 * 0.76 - 1 && rect.x + rect.w <= 844, 'inside the right 24 percent');
      t.ok(rect.y >= 0 && rect.y + rect.h <= 390);
    });
    t.ok(rects[0].x < rects[1].x && rects[0].y < rects[2].y, 'grid order is 0 1 / 2 3');
    t.ok(rects[1].x - (rects[0].x + rects[0].w) >= 8 && rects[2].y - (rects[0].y + rects[0].h) >= 8,
      'gaps of at least 8 px');
  });

  t.test('UT-26-19b pads shrink on a very narrow screen', () => {
    UI.Layout._measureFrom({ width: 200, height: 640, dpr: 1, safeArea: NO_INSET });
    UI.HUD.show('instrument');
    UI.TouchPads.show(padSpec({ size: 'large' }));
    t.ok(UI.TouchPads.rects().every((rect) => rect.w >= MIN_TOUCH_SIDE), 'pads keep the 56 px minimum');
    t.eq(doc.getElementById('hud-note').textContent, UI.text('pads.shrunk'));
    UI.TouchPads.hide();
    UI.TouchPads.show(padSpec({ maxTouches: 2 }));
    t.ok(doc.getElementById('hud-note').textContent.includes('2'), 'few simultaneous touches are announced');
  });

  // ---------------------------------------------------------------- UT-26-20 to UT-26-22: pads and HUD

  t.test('UT-26-20 pad pressed state from input', () => {
    UI.Layout._measureFrom({ width: 390, height: 844, dpr: 1, safeArea: NO_INSET });
    UI.TouchPads.show(padSpec());
    const pads = () => [0, 1, 2, 3].map((index) => doc.getElementById('pad-' + index).classList.contains('pressed'));
    t.fakes.inputEvent('lane2', 'press', 0);
    t.deepEq(pads(), [false, false, true, false]);
    t.fakes.inputEvent('lane2', 'release', 0.1);
    t.deepEq(pads(), [false, false, false, false]);
    UI.TouchPads.hide();
    t.fakes.inputEvent('lane1', 'press', 0.2);
    t.eq(doc.querySelectorAll('.pad.pressed').length, 0, 'hidden pads ignore input');
  });

  t.test('UT-26-21 pad glyphs and labels', () => {
    UI.Layout._measureFrom({ width: 390, height: 844, dpr: 1, safeArea: NO_INSET });
    const hrefs = () => [0, 1, 2, 3].map((index) => doc.getElementById('pad-' +
      index).querySelector('use').getAttribute('href'));
    UI.TouchPads.show(padSpec());
    t.deepEq(hrefs(), ['#g-lane0', '#g-lane1', '#g-lane2', '#g-lane3']);
    UI.TouchPads.show(padSpec({ kind: 'dance', labels: undefined }));
    t.deepEq(hrefs(), ['#g-left', '#g-down', '#g-up', '#g-right']);
    [0, 1, 2, 3].forEach((index) => {
      const pad = doc.getElementById('pad-' + index);
      t.ok(pad.getAttribute('aria-label') !== '', 'pad ' + index + ' has a label');
      t.ok(doc.getElementById(pad.querySelector('use').getAttribute('href').slice(1)),
        'the glyph exists in the sprite');
    });
    t.eq(doc.querySelectorAll('#touch .pad').length, 4, 'show replaces the old pads');
  });

  t.test('UT-26-22 HUD per kind and coalescing', () => {
    const timers = t.fakes.timers();
    timers.install();
    UI.HUD.show('dance');
    for (let count = 1; count <= 10; count += 1) {
      UI.HUD.set({ score: count * 1000, combo: count, accuracy: count === 10 ? 0.9725 : 0.5, progress: count / 10 });
      timers.advance(1);
    }
    timers.advance(HUD_APPLY_TRAILING_MS);
    t.ok(UI.counters().hudApplies <= 2, 'the DOM was written at most twice');
    const shown = (key) => !doc.getElementById('hud-' + key).hidden;
    t.ok(shown('score') && shown('combo') && shown('accuracy') && shown('progress'), 'dance elements are visible');
    t.ok(!shown('performers') && !shown('peers') && !shown('sync') && !shown('chord'), 'other kinds stay hidden');
    t.eq(doc.getElementById('hud-score').textContent, '10,000');
    t.eq(doc.getElementById('hud-accuracy').textContent, '97.25%');
    t.eq(doc.getElementById('hud-combo').textContent, '10x');
    t.eq(doc.getElementById('hud-progress').getAttribute('aria-valuenow'), '100');
    t.eq(doc.getElementById('hud').hidden, false);
    UI.HUD.hide();
    t.eq(doc.getElementById('hud').hidden, true);
    t.eq(UI.HUD.visible(), false);
    UI.HUD.show('freeplay');
    UI.HUD.set({ chord: 'Cmaj7', score: 5 });
    timers.advance(HUD_APPLY_TRAILING_MS);
    t.ok(!shown('score') && shown('chord'), 'free play shows the chord and no score');
  });

  t.test('UT-26-22b HUD judgment, note and reset', () => {
    const timers = t.fakes.timers();
    timers.install();
    UI.HUD.show('instrument');
    UI.HUD.flash('perfect', [1, 2]);
    const word = doc.getElementById('hud-judgment');
    t.ok(!word.hidden && word.classList.contains('j-perfect') && word.textContent.includes('Perfect'));
    t.ok(word.querySelector('use').getAttribute('href') === '#g-j-perfect', 'a glyph accompanies the word');
    t.ok(doc.querySelectorAll('.hit-marker.pulse').length === 2);
    timers.advance(120);
    t.eq(doc.querySelectorAll('.hit-marker.pulse').length, 0);
    UI.HUD.flash('miss', [0], { stray: true });
    t.ok(word.classList.contains('j-perfect') || word.hidden || word.textContent === '', 'a stray press shows no word');
    timers.advance(450);
    t.ok(word.hidden, 'the word fades after 450 ms');
    UI.HUD.note('Graphics paused');
    t.eq(doc.getElementById('hud-note').textContent, 'Graphics paused');
    UI.HUD.note(null);
    t.ok(doc.getElementById('hud-note').hidden);
    UI.HUD.set({ score: 900 });
    timers.advance(HUD_APPLY_TRAILING_MS);
    UI.HUD.reset();
    t.eq(doc.getElementById('hud-score').textContent, '0');
  });

  // ---------------------------------------------------------------- UT-26-23 to UT-26-26: text and presentation

  t.test('UT-26-23 text catalog', () => {
    const filled = UI.text('pads.fewTouches', { n: 2 });
    t.ok(filled.includes('2') && !filled.includes('{'), 'placeholders are replaced');
    const unknown = 'no.such.text.' + Core.uid();
    t.eq(UI.text(unknown), unknown);
    UI.text(unknown);
    const logged = Core.Log.entries().filter((entry) => entry.msg === 'unknown text id ' + unknown);
    t.eq(logged.length, 1, 'an unknown id is logged once');
    t.ok(Object.isFrozen(UI.TEXT));
    t.ok(Object.keys(UI.TEXT).every((key) => /^[\x20-\x7e]*$/.test(UI.TEXT[key])), 'the catalog is ASCII only');
    t.eq(UI.text('E-GEN-001'), Core.Text.get('E-GEN-001'), 'Core.Text entries are found too');
  });

  t.test('UT-26-24 text entry restriction', () => {
    const widget = UI.Widgets.field({ id: 'name', label: 'Name', value: 'abc', maxLength: 24, onCommit: () => {} });
    attach(widget.root);
    const input = widget.root.querySelector('input');
    UI.setTextEntryAllowed(false);
    t.eq(UI.textEntryAllowed(), false);
    t.ok(input.readOnly, 'the field is read-only');
    widget.focus();
    t.ok(doc.activeElement !== input, 'focus is redirected');
    input.focus();
    t.ok(doc.activeElement !== input, 'direct focus is refused too');
    t.ok(widget.root.textContent.includes(UI.text('field.pauseToEdit')), 'the hint explains why');
    const late = UI.Widgets.field({ id: 'late', label: 'Late', value: '', maxLength: 10, onCommit: () => {} });
    attach(late.root);
    t.ok(late.root.querySelector('input').readOnly, 'a field created later is read-only too');
    UI.setTextEntryAllowed(true);
    t.ok(!input.readOnly);
    widget.focus();
    t.eq(doc.activeElement, input);
  });

  t.test('UT-26-24b field commit and revert', () => {
    const commits = [];
    const widget = UI.Widgets.field({ id: 'title', label: 'Title', value: 'old', maxLength: 10, pattern: '[a-z ]+',
      onCommit: (value) => commits.push(value) });
    attach(widget.root);
    const input = widget.root.querySelector('input');
    input.focus();
    input.value = '  new  ';
    press(input, 'Enter');
    t.deepEq(commits, ['new'], 'the trimmed value is committed');
    input.value = 'BAD1';
    press(input, 'Enter');
    t.deepEq(commits, ['new'], 'a value that fails the pattern is not committed');
    t.eq(widget.root.getAttribute('data-state'), 'error');
    input.value = 'changed';
    press(input, 'Escape');
    t.eq(input.value, 'new', 'Escape reverts');
  });

  t.test('UT-26-25 truncate rules', () => {
    t.eq(UI.truncate('a'.repeat(50), 20), 'a'.repeat(17) + '...');
    t.eq(UI.truncate('my-very-long-song-name.mid', 16, { keepExt: true }), 'my-very-l....mid');
    t.eq(UI.truncate('a'.repeat(50), 4), 'a'.repeat(5) + '...', 'max is clamped to 8');
    t.eq(UI.truncate('short', 20), 'short');
    t.eq(UI.truncate(12345, 20), '12345');
  });

  t.test('UT-26-26 reduced motion and contrast classes', () => {
    const root = doc.documentElement;
    t.eq(UI.setReducedMotion('on'), true);
    t.ok(root.classList.contains('reduced-motion') && !root.classList.contains('motion-full'));
    t.eq(colorOf('--t-fast'), '0ms', 'transitions are instant');
    t.eq(UI.setReducedMotion('off'), false);
    t.ok(root.classList.contains('motion-full') && !root.classList.contains('reduced-motion'));
    t.eq(UI.reducedMotion(), false);
    UI.setReducedMotion('system');
    t.ok(!root.classList.contains('motion-full'));
    UI.setHighContrast(true);
    t.ok(root.classList.contains('high-contrast'));
    t.eq(colorOf('--c-focus'), '#ffffff');
    UI.setHighContrast(false);
    t.ok(!root.classList.contains('high-contrast'));
  });

  t.test('UT-26-26b settings.changed drives scale, motion and contrast', () => {
    UI.Layout._measureFrom({ width: 1280, height: 720, dpr: 1, safeArea: NO_INSET });
    bus.emit('settings.changed', { key: 'video.uiScale', value: 1.2, prev: 1, source: 'ui' });
    t.eq(UI.Layout.scale(), 1.2);
    bus.emit('settings.changed', { key: 'video.highContrast', value: true, prev: false, source: 'ui' });
    t.ok(doc.documentElement.classList.contains('high-contrast'));
    bus.emit('settings.changed', { key: 'video.reducedMotion', value: 'on', prev: 'system', source: 'ui' });
    t.ok(doc.documentElement.classList.contains('reduced-motion'));
    bus.emit('settings.changed', { key: '*', value: { video: { uiScale: 1, highContrast: false,
      reducedMotion: 'off' } },
      prev: null, source: 'load', keys: ['video.uiScale'] });
    t.eq(UI.Layout.scale(), 1);
    t.ok(!doc.documentElement.classList.contains('high-contrast'));
    t.ok(doc.documentElement.classList.contains('motion-full'));
  });

  // ---------------------------------------------------------------- extra checks for T01.06 and T01.07

  t.test('UT-26-27 shared screen frame', () => {
    const section = attach(UI.el('section', { class: 'screen' }));
    let saved = 0;
    const frame = UI.Frame.create(section, { prefix: 'xx', title: 'Settings', subtitle: 'Demo song',
      backTo: 'Main menu',
      primary: { label: 'Save', onPress: () => { saved += 1; } } });
    t.eq(section.querySelectorAll('h1').length, 1, 'one h1 per screen');
    t.eq(doc.getElementById('xx-top').getAttribute('role'), 'banner');
    t.eq(doc.getElementById('w-xx-back').getAttribute('aria-label'), 'Back to Main menu');
    t.eq(section.querySelectorAll('.btn-primary').length, 1, 'exactly one primary action');
    t.eq(doc.getElementById('xx-status').getAttribute('role'), 'status');
    t.eq(doc.getElementById('xx-subtitle').textContent, 'Demo song');
    frame.primary.root.click();
    t.eq(saved, 1);
    frame.setTitle('Other');
    t.eq(doc.getElementById('xx-title').textContent, 'Other');
  });

  t.test('UT-26-28 token contrast, default and high contrast', () => {
    const textPairs = [['--c-text', '--c-bg'], ['--c-text', '--c-panel'], ['--c-text-muted', '--c-panel'],
      ['--c-text-muted', '--c-bg-2'], ['--c-accent-ink', '--c-accent'], ['--c-ok', '--c-panel'], ['--c-warn',
        '--c-panel'],
      ['--c-error', '--c-panel'], ['--c-accent-2', '--c-panel']];
    const nonTextPairs = [['--c-focus', '--c-bg'], ['--c-focus', '--c-panel'], ['--c-text-dim', '--c-panel']];
    [false, true].forEach((high) => {
      UI.setHighContrast(high);
      const label = high ? 'high contrast' : 'default';
      textPairs.forEach((pair) => t.ok(contrast(colorOf(pair[0]), colorOf(pair[1])) >= TEXT_CONTRAST,
        label + ': ' + pair.join(' on ') + ' needs 4.5:1'));
      nonTextPairs.forEach((pair) => t.ok(contrast(colorOf(pair[0]), colorOf(pair[1])) >= NON_TEXT_CONTRAST,
        label + ': ' + pair.join(' on ') + ' needs 3:1'));
    });
  });

  t.test('UT-26-29 every interactive control has an accessible name', () => {
    const host = attach(UI.el('div'));
    const handles = [
      UI.Widgets.button({ id: 'a-btn', label: 'Save' }),
      UI.Widgets.button({ id: 'a-icon', icon: 'close', ariaLabel: 'Close panel' }),
      UI.Widgets.toggle({ id: 'a-tog', label: 'Sound', value: true }),
      UI.Widgets.slider({ id: 'a-sli', label: 'Volume', min: 0, max: 10, step: 1, value: 3, unit: '' }),
      UI.Widgets.select({ id: 'a-sel', label: 'Tier', options: [{ value: 'a', label: 'A' }, { value: 'b',
        label: 'B' }], value: 'a' }),
      UI.Widgets.number({ id: 'a-num', label: 'Tempo', min: 40, max: 240, step: 1, value: 120, unit: 'BPM',
        precision: 0 }),
      UI.Widgets.list({ id: 'a-list', label: 'Songs', items: [{ id: 's1', primary: 'Song one' }], emptyText: 'None' }),
      UI.Widgets.tabs({ id: 'a-tabs', tabs: [{ id: 't1', label: 'First' }, { id: 't2', label: 'Second' }],
        value: 't1' }),
      UI.Widgets.field({ id: 'a-fld', label: 'Name', value: '', maxLength: 10 })
    ];
    handles.forEach((handle) => host.appendChild(handle.root));
    const spec = dialogSpec('DLG-Names');
    UI.dialog(spec);
    const controls = UI.Focus.focusable(overlay());
    t.ok(controls.length >= 12, 'the audit covers the controls');
    controls.forEach((node) => t.ok(accessibleName(node) !== '', 'no accessible name on ' + node.tagName + '#' +
      node.id));
    UI.closeAllDialogs('test');
    t.eq(Array.from(doc.querySelectorAll('[data-widget]')).filter((node) => !node.id).length, 0,
      'every widget has an id');
  });

  t.test('UT-26-30 visible focus ring', () => {
    const widget = UI.Widgets.button({ id: 'ring', label: 'Ring' });
    attach(widget.root);
    press(doc.body, 'Tab');
    t.ok(doc.documentElement.classList.contains('kbd-nav'), 'keyboard use switches the ring on');
    UI.Focus.restore(widget.root);
    t.eq(doc.activeElement, widget.root);
    t.ok(widget.root.classList.contains('focus-ring'));
    const style = window.getComputedStyle(widget.root);
    t.ok(parseFloat(style.outlineWidth) >= 2 && style.outlineStyle === 'solid', 'outline of at least 2 px');
    t.ok(contrast(style.outlineColor, colorOf('--c-bg')) >= NON_TEXT_CONTRAST, 'ring contrast of at least 3:1');
    doc.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    t.ok(!doc.documentElement.classList.contains('kbd-nav') && !widget.root.classList.contains('focus-ring'),
      'a pointer press hides the ring');
  });

  t.test('UT-26-31 ui scale range and no horizontal scroll', () => {
    UI.Layout._measureFrom({ width: 1280, height: 720, dpr: 1, safeArea: NO_INSET });
    t.eq(UI.Layout.setScale(0.8), 0.8);
    t.ok(Math.abs(parseFloat(window.getComputedStyle(doc.documentElement).fontSize) - 12.8) < 0.01,
      'root size follows --ui');
    t.eq(UI.Layout.setScale(1.02), 1, 'steps of 0.05');
    t.eq(UI.Layout.setScale(1.5), 1.5);
    const section = attach(UI.el('section', { class: 'screen' }));
    const frame = UI.Frame.create(section, { prefix: 'sc', title: 'A rather long screen title for the scale test',
      subtitle: 'subtitle', primary: { label: 'Go', onPress: () => {} } });
    frame.body.appendChild(UI.Widgets.slider({ id: 'sc-s', label: 'Volume', min: 0, max: 100, step: 1, value: 50,
      unit: '%' }).root);
    frame.body.appendChild(UI.Widgets.field({ id: 'sc-f', label: 'Name', value: 'x'.repeat(40), maxLength: 80 }).root);
    t.ok(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, 'no horizontal page scroll');
    t.ok(frame.body.scrollWidth <= frame.body.clientWidth + 1, 'no horizontal scroll in the screen body');
  });

  t.test('UT-26-32 dialog roles and labels', () => {
    UI.dialog(dialogSpec('DLG-Roles', { body: ['First paragraph', 'Second paragraph'],
      consequence: 'Something is lost.' }));
    const node = doc.querySelector('[data-dialog="DLG-Roles"]');
    t.eq(node.getAttribute('role'), 'dialog');
    t.eq(node.getAttribute('aria-modal'), 'true');
    UI.dialog(dialogSpec('DLG-SaveFailed'));
    UI.dialog(dialogSpec('DLG-Unsupported', { alert: true }));
    t.eq(doc.querySelector('[data-dialog="DLG-SaveFailed"]').getAttribute('role'), 'alertdialog');
    t.eq(doc.querySelector('[data-dialog="DLG-Unsupported"]').getAttribute('role'), 'alertdialog');
    t.eq(doc.getElementById(node.getAttribute('aria-labelledby')).tagName, 'H2');
    t.eq(doc.getElementById(node.getAttribute('aria-describedby')).querySelectorAll('p').length, 2);
    t.ok(node.querySelector('.consequence use[href="#g-warn"]'),
      'the consequence has a warning glyph, not color alone');
    t.ok(doc.getElementById('g-warn'), 'the glyph exists in the sprite');
    UI.closeAllDialogs('test');
  });

  t.test('UT-26-33 tabs, select and number widgets', () => {
    const changes = [];
    const tabs = UI.Widgets.tabs({ id: 'tb', tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c',
      label: 'C' }],
      value: 'a', onChange: (value) => changes.push(value) });
    attach(tabs.root);
    const panelA = attach(UI.el('div'));
    const panelB = attach(UI.el('div'));
    tabs.panel('a', panelA);
    tabs.panel('b', panelB);
    t.ok(!panelA.hidden && panelB.hidden, 'only the active panel shows');
    const buttons = Array.from(tabs.root.querySelectorAll('[role="tab"]'));
    buttons[0].focus();
    press(buttons[0], 'ArrowRight');
    t.deepEq(changes, ['b']);
    t.ok(panelA.hidden && !panelB.hidden);
    t.eq(buttons.filter((node) => node.getAttribute('tabindex') === '0').length, 1);
    press(buttons[1], 'End');
    t.eq(tabs.get(), 'c');
    press(buttons[2], 'ArrowRight');
    t.eq(tabs.get(), 'a', 'arrows wrap');
    const picked = [];
    const select = UI.Widgets.select({ id: 'sl', label: 'Tier', value: 'a', onChange: (value) => picked.push(value),
      options: [{ value: 'a', label: 'Auto' }, { value: 'b', label: 'High', disabledReason: 'Needs WebGL' }] });
    attach(select.root);
    const options = select.root.querySelectorAll('option');
    t.eq(options[1].textContent, 'High - Needs WebGL');
    t.ok(options[1].disabled);
    const values = [];
    const number = UI.Widgets.number({ id: 'nm', label: 'Tempo', min: 40, max: 240, step: 1, value: 120, unit: 'BPM',
      precision: 0,
      onChange: (value) => values.push(value) });
    attach(number.root);
    const input = number.root.querySelector('input');
    input.value = '300';
    press(input, 'Enter');
    t.deepEq(values, [240], 'out-of-range text is clamped');
    t.eq(number.root.getAttribute('data-state'), 'error');
    t.ok(number.root.textContent.includes('Allowed: 40 to 240'));
    input.value = 'abc';
    press(input, 'Enter');
    t.eq(input.value, '240', 'invalid text restores the last value');
    press(input, 'ArrowDown');
    t.deepEq(values, [240, 239]);
    number.root.querySelector('button[aria-label^="Increase"]').click();
    t.eq(number.get(), 240);
  });

  t.test('UT-26-34 transport bar', () => {
    const actions = [];
    const host = attach(UI.el('div'));
    const bar = UI.TransportBar.create(host, { buttons: ['play', 'stop', 'record', 'loop'], showTempo: true,
      onAction: (id) => actions.push(id) });
    host.querySelector('#w-transport-record').click();
    t.deepEq(actions, ['record']);
    bar.update({ state: 'playing', bar: 3, beat: 1, timeS: 65, durationS: 200, bpm: 120, loop: { enabled: true },
      recording: false,
      countIn: null });
    t.eq(host.querySelector('#w-transport-play').getAttribute('aria-label'), 'Pause');
    t.eq(host.querySelector('#w-transport-loop').getAttribute('aria-pressed'), 'true');
    t.eq(host.querySelector('#transport-position').textContent, '4.2');
    t.eq(host.querySelector('#transport-clock').textContent, '1:05 / 3:20');
    t.eq(host.querySelector('#transport-tempo').textContent, '120.0 BPM');
    bar.setEnabled('stop', false, 'Nothing to stop');
    t.eq(host.querySelector('#w-transport-stop').getAttribute('aria-disabled'), 'true');
    bar.destroy();
    t.eq(host.querySelector('.transport'), null);
  });

  t.test('UT-26-35 gamepad menu navigation', () => {
    const timers = t.fakes.timers();
    timers.install();
    const picked = [];
    const widget = UI.Widgets.list({ id: 'pad-menu', label: 'Menu', items: [{ id: 'a', primary: 'A' }, { id: 'b',
      primary: 'B' }],
      onPick: (id) => picked.push(id), emptyText: '' });
    attach(widget.root);
    const rows = Array.from(widget.root.querySelectorAll('li'));
    rows[0].focus();
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    t.fakes.stub(window.navigator, 'getGamepads', () => [{ mapping: 'standard', buttons }]);
    bus.emit('input.device', { source: 'gamepad', connected: true, id: 'pad1', name: 'Pad' });
    buttons[13].pressed = true;
    timers.advance(GAMEPAD_POLL_MS);
    t.eq(doc.activeElement, rows[1], 'd-pad down moves focus');
    buttons[13].pressed = false;
    timers.advance(GAMEPAD_POLL_MS);
    buttons[0].pressed = true;
    timers.advance(GAMEPAD_POLL_MS);
    t.deepEq(picked, ['b'], 'button 0 acts as Enter');
    UI.HUD.show('instrument');
    buttons[0].pressed = false;
    timers.advance(GAMEPAD_POLL_MS);
    buttons[0].pressed = true;
    timers.advance(GAMEPAD_POLL_MS * 2);
    t.deepEq(picked, ['b'], 'menu navigation stops while a gameplay HUD is shown');
  });

  t.test('UT-26-36 touch targets and text focus on touch devices', { touch: true }, () => {
    if (!(window.navigator.maxTouchPoints > 0)) t.skip('needs a touch device context (navigator.maxTouchPoints > 0)');
    doc.body.classList.add('touch');
    const button = UI.Widgets.button({ id: 'tt-btn', label: 'Tap' });
    const toggle = UI.Widgets.toggle({ id: 'tt-tog', label: 'Sound', value: false });
    const field = UI.Widgets.field({ id: 'tt-fld', label: 'Name', value: '', maxLength: 10 });
    const host = attach(UI.el('section', { class: 'screen' }, UI.el('h1', null, 'Touch')));
    [button, toggle, field].forEach((handle) => host.appendChild(handle.root));
    t.ok(button.root.getBoundingClientRect().height >= MIN_TOUCH_SIDE, 'buttons are at least 56 px tall');
    t.ok(toggle.root.querySelector('.toggle').getBoundingClientRect().height >= MIN_TOUCH_SIDE,
      'toggles are at least 56 px tall');
    t.ok(field.root.querySelector('input').getBoundingClientRect().height >= MIN_TOUCH_SIDE,
      'fields are at least 56 px tall');
    UI.Focus.restore(host);
    t.ok(!(doc.activeElement && doc.activeElement.tagName === 'INPUT'), 'no text field is focused by itself on touch');
    UI.Focus.restore(field.root.querySelector('input'));
    t.ok(doc.activeElement.tagName !== 'INPUT', 'restore never opens the on-screen keyboard');
  });

  // ---------------------------------------------------------------- T02.08 wired transport bar

  const BAR_TICKS = 3840;
  const SONG_BARS = 8;                       // 16 s at 120 BPM
  const SEEK_MAX = 1000;
  const MIN_POINTER_SIDE = 44;
  const MIN_GAP = 8;

  function transportSong() {
    const song = FLM.Model.Song.create({ title: 'Bar test' });
    FLM.Model.Song.addTrack(song, FLM.Model.Track.create({ name: 'solo' }, song));
    song.durationTicks = SONG_BARS * BAR_TICKS;
    return song;
  }

  /** A private transport and bus, so no test touches Transport.main or the real subscriptions. */
  function wiredBar(options) {
    const given = options || {};
    const clock = t.fakes.clock(0);
    const eventBus = new Core.Emitter();
    const transport = FLM.Transport.create({ clock, bus: eventBus });
    if (given.song !== false) transport.load(transportSong());
    const host = attach(UI.el('div'));
    const actions = [];
    const bar = UI.TransportBar.create(host, { buttons: given.buttons || ['play', 'stop', 'rewind', 'loop'],
      showTempo: true, transport, bus: eventBus, owner: Symbol('bar-test'), onAction: (id) => actions.push(id) });
    return { clock, eventBus, transport, host, bar, actions };
  }

  const control = (rig, id) => rig.host.querySelector('#w-' + id);
  const iconOf = (node) => node.querySelector('use').getAttribute('href');

  function change(node, value) {
    node.value = String(value);
    node.dispatchEvent(new window.Event('input', { bubbles: true }));
    node.dispatchEvent(new window.Event('change', { bubbles: true }));
  }

  t.test('UT-26-37 wired bar: states, icons and disabled reasons', () => {
    const rig = wiredBar({ song: false });
    ['transport-play', 'transport-stop', 'transport-rewind', 'transport-loop'].forEach(function (id) {
      t.eq(control(rig, id).getAttribute('aria-disabled'), 'true', id + ' is disabled without a song');
      t.eq(control(rig, id).getAttribute('title'), 'Load a song first.', id + ' says why');
    });
    t.ok(control(rig, 'transport-seek-control').disabled, 'the seek slider is disabled without a song');
    rig.transport.load(transportSong());
    t.eq(control(rig, 'transport-play').getAttribute('aria-disabled'), null, 'a loaded song enables Play');
    t.eq(control(rig, 'transport-loop').getAttribute('title'), 'Set a loop region first.',
      'loop needs a region even with a song');
    t.eq(iconOf(control(rig, 'transport-play')), '#g-play');
    t.eq(control(rig, 'transport-play').getAttribute('aria-label'), 'Play');
    control(rig, 'transport-play').click();
    t.eq(rig.transport.state(), 'playing');
    t.eq(control(rig, 'transport-play').getAttribute('aria-label'), 'Pause');
    t.eq(iconOf(control(rig, 'transport-play')), '#g-pause');
    control(rig, 'transport-play').click();
    t.eq(rig.transport.state(), 'paused');
    t.eq(control(rig, 'transport-play').getAttribute('aria-label'), 'Resume');
    t.eq(iconOf(control(rig, 'transport-play')), '#g-play');
    control(rig, 'transport-play').click();
    t.eq(rig.transport.state(), 'playing', 'Resume continues');
    t.eq(iconOf(control(rig, 'transport-stop')), '#g-stop');
    control(rig, 'transport-stop').click();
    t.eq(rig.transport.state(), 'stopped');
    t.deepEq(rig.actions, ['play', 'pause', 'resume', 'stop'], 'onAction gets the resolved action');
    rig.bar.destroy();
  });

  t.test('UT-26-38 wired bar: readouts, seek slider, rewind and loop', () => {
    const timers = t.fakes.timers();
    timers.install();
    const rig = wiredBar();
    t.eq(rig.host.querySelector('#transport-position').textContent, '1.1');
    t.eq(rig.host.querySelector('#transport-clock').textContent, '0:00 / 0:16');
    t.eq(rig.host.querySelector('#transport-tempo').textContent, '120.0 BPM');
    rig.transport.play();
    rig.clock.set(4.05);                     // 0.05 s lead-in plus 4 s = two bars
    timers.advance(100);
    t.eq(rig.host.querySelector('#transport-position').textContent, '3.1', 'the poll follows the running transport');
    t.eq(rig.host.querySelector('#transport-clock').textContent, '0:04 / 0:16');
    t.eq(control(rig, 'transport-seek-control').value, '250', 'the slider follows too');
    change(control(rig, 'transport-seek-control'), SEEK_MAX / 2);
    rig.clock.set(4.1);                      // the seek anchors 0.05 s ahead
    t.eq(Math.round(rig.transport.position()), 4 * BAR_TICKS, 'dragging the slider seeks the transport');
    rig.transport.stop();
    control(rig, 'transport-rewind').click();
    t.eq(rig.transport.position(), 0, 'rewind seeks to the start');
    t.eq(rig.host.querySelector('#transport-position').textContent, '1.1');
    rig.transport.setLoop({ a: 0, b: BAR_TICKS });
    t.eq(control(rig, 'transport-loop').getAttribute('aria-pressed'), 'true');
    control(rig, 'transport-loop').click();
    t.eq(rig.transport.loopEnabled(), false, 'the loop button toggles the loop');
    t.eq(control(rig, 'transport-loop').getAttribute('aria-pressed'), 'false');
    rig.bar.destroy();
  });

  t.test('UT-26-39 wired bar: speed, count-in and Space', () => {
    const rig = wiredBar();
    t.eq(control(rig, 'transport-speed-control').options.length, 8, 'speed offers 0.25 to 2');
    change(control(rig, 'transport-speed-control'), 0.5);
    t.eq(rig.transport.speed(), 0.5);
    rig.transport.setSpeed(1.5);
    t.eq(control(rig, 'transport-speed-control').value, '1.5', 'the select follows the transport');
    change(control(rig, 'transport-countin-bars-control'), 2);
    t.eq(rig.transport.countInBars(), 2);
    const space = () => control(rig, 'transport-seek-control').dispatchEvent(new window.KeyboardEvent('keydown',
      { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
    space();
    t.eq(rig.transport.state(), 'countin', 'Space on the bar starts play with the count-in');
    t.eq(rig.host.querySelector('#transport-countin').hidden, false);
    t.ok(rig.host.querySelector('#transport-countin').textContent.startsWith('Count-in '));
    space();
    t.eq(rig.transport.state(), 'paused', 'Space pauses');
    control(rig, 'transport-stop').dispatchEvent(new window.KeyboardEvent('keydown',
      { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
    t.eq(rig.transport.state(), 'stopped', 'Space on a button acts as that button (Stop), not as play or pause');
    rig.bar.destroy();
  });

  t.test('UT-26-40 wired bar: pointer target sizes and cleanup', () => {
    const rig = wiredBar();
    const buttons = Array.from(rig.host.querySelectorAll('.transport .btn'));
    buttons.forEach((node) => t.ok(node.getBoundingClientRect().height >= MIN_POINTER_SIDE - 0.5 &&
      node.getBoundingClientRect().width >= MIN_POINTER_SIDE - 0.5, node.id + ' is at least 44 px'));
    t.ok(control(rig, 'transport-seek-control').getBoundingClientRect().height >= MIN_POINTER_SIDE - 0.5);
    t.ok(buttons.length >= 2);
    const first = buttons[0].getBoundingClientRect();
    const second = buttons[1].getBoundingClientRect();
    t.ok(second.left - first.right >= MIN_GAP - 0.5 || second.top >= first.bottom, 'buttons keep an 8 px gap');
    t.ok(rig.eventBus.emit('transport.state', {}) > 0, 'the bar listens while alive');
    rig.bar.destroy();
    t.eq(rig.eventBus.emit('transport.state', {}), 0, 'destroy removes every subscription');
    t.eq(rig.host.querySelector('.transport'), null);
  });

  t.test('UT-26-41 wired bar: touch targets', { touch: true }, () => {
    if (!(window.navigator.maxTouchPoints > 0)) t.skip('needs a touch device context (navigator.maxTouchPoints > 0)');
    doc.body.classList.add('touch');
    const rig = wiredBar();
    const nodes = Array.from(rig.host.querySelectorAll('.transport .btn, .transport select, .transport input'));
    nodes.forEach((node) => t.ok(node.getBoundingClientRect().height >= MIN_TOUCH_SIDE - 0.5,
      (node.id || node.tagName) + ' is at least 56 px tall'));
    rig.bar.destroy();
  });
});
})();
