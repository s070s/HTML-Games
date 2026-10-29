// 91-test-screens.js - unit tests for M-27 FLM.Screens (group 'screens'; test build only).
// T01.08 delivers UT-27-13 to UT-27-15 (the settings store, Part 6.27.8). T01.11 adds UT-27-01, UT-27-02, UT-27-07,
// UT-27-26 and UT-27-28 (on stand-ins until T04.01; UT-27-28e and f run the dialogs on the real M-05) and checks for
// the settings, help, about and diagnostics screens. T03.04 adds UT-27-16 (remap capture and conflict) with its
// variants, a settings-to-Input maps check and the Help and first launch checks for controls.
// T03.09 adds UT-27-17 (calibration math and the DLG-Calibration steps) and the calibration settings checks.
// A lower-case letter after an id marks an extra check of that row.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('screens', (t) => {
  const Core = FLM.Core;
  const Storage = FLM.Storage;
  const Settings = FLM.Screens.Settings;
  const bus = Core.bus;
  const SETTINGS_KEY = 'flm.v1.settings';
  const DEBOUNCE_MS = 250;
  const DRAG_STEP_MS = 20;

  let wasOpen = false;
  let savedDocument = null;

  t.before(() => {
    wasOpen = Storage.state().opened;
    savedDocument = Settings.all();
  });

  t.afterEach(() => {
    Storage._teardownForTests();
    Settings._resetForTests();
    FLM.UI.clearToasts();
  });

  // Puts the real storage and the document boot loaded back after this group.
  t.after(async () => {
    Settings._resetForTests(savedDocument);
    if (wasOpen) await Storage.open();
  });

  function seeded(documentObject) {
    const ls = t.fakes.localStorage();
    if (documentObject !== undefined) ls.setItem(SETTINGS_KEY, JSON.stringify(documentObject));
    return ls;
  }

  const openLocalOnly = (ls) => Storage.open({ localStorage: ls, idbFactory: null });

  t.test('UT-27-13 settings load normalization', async () => {
    await openLocalOnly(seeded({ version: 1, audio: { masterVolume: 3 }, input: { padSize: 'huge' },
      foo: { bar: 7 } }));
    Core.Log.clear();
    const events = [];
    bus.on('settings.changed', (event) => events.push(event), t.owner);
    const loaded = Settings.load();
    Settings.load();
    t.eq(loaded.source, 'stored');
    t.eq(Settings.get('audio.masterVolume'), 1);
    t.eq(Settings.get('input.padSize'), 'medium');
    t.eq(Settings.all().x.foo.bar, 7, 'the unknown key is kept under x');
    t.deepEq(loaded.warnings.sort(), ['audio.masterVolume', 'input.padSize']);
    const logged = Core.Log.entries().filter((entry) => entry.msg.includes('W-SET-NORMALIZED'));
    t.eq(logged.length, 1, 'W-SET-NORMALIZED is logged once');
    t.ok(events.some((event) => event.key === '*' && event.source === 'load'), 'a load event was emitted');
  });

  t.test('UT-27-13b a damaged record falls back to the backup, then to the defaults', async () => {
    const ls = seeded();
    ls.setItem(SETTINGS_KEY, '{broken');
    ls.setItem(SETTINGS_KEY + '.bak', JSON.stringify({ version: 1, audio: { masterVolume: 0.3 } }));
    await openLocalOnly(ls);
    const fromBackup = Settings.load();
    t.eq(fromBackup.source, 'backup');
    t.eq(Settings.get('audio.masterVolume'), 0.3);
    ls.setItem(SETTINGS_KEY, '{broken');
    ls.setItem(SETTINGS_KEY + '.bak', '[1,2');
    const reset = Settings.load();
    t.eq(reset.source, 'defaults');
    t.eq(Settings.get('audio.masterVolume'), Settings.DEFAULTS.audio.masterVolume);
    const shown = Array.from(window.document.querySelectorAll('.toast')).map((node) => node.textContent);
    t.ok(shown.some((text) => text.includes('Settings were reset')), 'the reset toast is shown');
  });

  t.test('UT-27-14 settings set event and debounce', async () => {
    const timers = t.fakes.timers();
    timers.install();
    const ls = seeded();
    let liveWrites = 0;
    const originalSetItem = ls.setItem.bind(ls);
    ls.setItem = (key, value) => {
      if (key === SETTINGS_KEY) liveWrites += 1;
      originalSetItem(key, value);
    };
    await openLocalOnly(ls);
    Settings.load();
    const events = [];
    bus.on('settings.changed', (event) => { if (event.key === 'audio.masterVolume') events.push(event); }, t.owner);
    [0.1, 0.2, 0.3, 0.4, 0.5].forEach((value) => {
      t.eq(Settings.set('audio.masterVolume', value, 'ui').ok, true);
      timers.advance(DRAG_STEP_MS);
    });
    t.deepEq(events.map((event) => event.prev), [0.8, 0.1, 0.2, 0.3, 0.4], 'five events with their previous values');
    t.eq(liveWrites, 0, 'nothing is written before the debounce time');
    timers.advance(DEBOUNCE_MS);
    t.eq(liveWrites, 1, 'one write for the five changes');
    Settings.set('onboarding.firstLaunchDone', true, 'ui');
    t.eq(liveWrites, 2, 'an onboarding change is written at once');
    const stored = JSON.parse(ls.getItem(SETTINGS_KEY));
    t.eq(stored.audio.masterVolume, 0.5);
    t.eq(stored.onboarding.firstLaunchDone, true);
  });

  t.test('UT-27-14b high contrast forces lane glyphs and bad values are refused', async () => {
    await openLocalOnly(seeded());
    Settings.load();
    Settings.set('accessibility.laneGlyphs', false, 'ui');
    const events = [];
    bus.on('settings.changed', (event) => events.push(event.key), t.owner);
    Settings.set('video.highContrast', true, 'ui');
    t.deepEq(events, ['video.highContrast', 'accessibility.laneGlyphs']);
    t.eq(Settings.get('accessibility.laneGlyphs'), true);
    t.eq(Settings.set('audio.masterVolume', 'loud', 'ui').ok, false);
    t.eq(Settings.set('no.such.setting', 1, 'ui').error, 'unknown setting');
    t.eq(Settings.set('video.uiScale', 9, 'ui').value, 1.5, 'out of range values are clamped');
  });

  t.test('UT-27-15 settings export import round trip', async () => {
    const timers = t.fakes.timers();
    timers.install();
    await openLocalOnly(seeded());
    Settings.load();
    Settings.set('audio.masterVolume', 0.5, 'ui');
    Settings.set('video.uiScale', 1.25, 'ui');
    Settings.set('gameplay.judgmentPreset', 'strict', 'ui');
    const before = Settings.all();
    const text = Settings.export();
    Settings.reset();
    t.eq(Settings.get('audio.masterVolume'), Settings.DEFAULTS.audio.masterVolume);
    const parsed = Settings.parseImport(text);
    t.eq(parsed.ok, true);
    t.deepEq(parsed.changes.map((change) => change.path).sort(),
      ['audio.masterVolume', 'gameplay.judgmentPreset', 'video.uiScale']);
    Settings.applyImport(parsed.doc);
    t.deepEq(Settings.all(), before);
    t.eq(Settings.comparable(), false, 'a strict judgment preset makes results not comparable');
  });

  t.test('UT-27-15b import refuses foreign and newer files', async () => {
    await openLocalOnly(seeded());
    Settings.load();
    t.eq(Settings.parseImport('not json').ok, false);
    t.eq(Settings.parseImport(JSON.stringify({ format: 'other', version: 1, settings: {} })).ok, false);
    const newer = Settings.parseImport(JSON.stringify({ format: 'flm-settings', version: 2, settings: {} }));
    t.eq(newer.ok, false);
    t.ok(newer.error.includes('newer'), 'the message names the newer version');
  });

  // ---------------------------------------------------------------- T01.11: screens and dialogs
  const UI = FLM.UI;
  const Screens = FLM.Screens;
  const doc = window.document;
  const MENU_LABELS = ['Quick Play', 'Instrument Mode', 'Free Play', 'Studio', 'Song Library', 'Import Music',
    'Dance Mode', 'Multiplayer', 'Characters', 'Settings', 'Help and Controls', 'About'];
  const LATER_BUILD = 'Available after a later build step';
  const WAIT_TURNS = 100;

  let ownsInit = false;
  let hadMenu = false;                       // boot left the main menu on screen; this group puts it back
  let replaced = [];                         // [{name, had, value}] namespaces swapped for stand-ins

  t.before(() => {
    hadMenu = UI.Screens.depth() > 0;
    if (UI.counters().initialized) return;
    UI.init({ settings: {}, caps: {} });
    ownsInit = true;
  });

  t.after(async () => {
    UI._resetForTests();
    if (ownsInit) UI._teardownForTests();
    if (hadMenu) {
      Screens.register();
      await UI.Screens.push('SCR-MainMenu', {});
    }
    FLM.Modes._teardownForTests();           // a fresh leak baseline, as the modes group does after its UI resets
  });

  t.beforeEach(() => {
    UI._resetForTests();
    replaced = [];
    Screens.register();
  });

  t.afterEach(() => {
    UI._resetForTests();
    replaced.reverse().forEach((item) => {
      if (item.had) FLM[item.name] = item.value;
      else delete FLM[item.name];
    });
    FLM.Input.resetMap();                    // a test that remapped keys must not leak them into the next
  });

  // Swaps a whole namespace for a stand-in (frozen namespaces cannot be stubbed per member).
  function standIn(name, value) {
    replaced.push({ name, had: Object.prototype.hasOwnProperty.call(FLM, name), value: FLM[name] });
    FLM[name] = value;
  }

  function modesSpy(mode) {
    const calls = [];
    const enter = (name, params) => {
      calls.push(['enter', name, params]);
      return Promise.resolve({ ok: true });
    };
    standIn('Modes', { enter,
      leave: (reason) => { calls.push(['leave', reason]); return Promise.resolve(); },
      current: () => ({ mode: mode || 'menu' }) });
    return calls;
  }

  const yieldTurn = () => new Promise((resolve) => Core.timers.setTimeout(resolve, 0, t.owner));

  async function waitFor(check, message) {
    for (let turn = 0; turn < WAIT_TURNS; turn += 1) {
      if (check()) return;
      await yieldTurn();
    }
    throw new Error('timed out waiting for ' + message);
  }

  const screenRoot = (id) => doc.querySelector('[data-screen="' + id + '"]');
  const button = (id) => doc.getElementById('w-' + id);
  // The focusable element of a widget: the widget root itself for a button, else its button, select or input.
  const control = (id) => {
    const root = button(id);
    return root.matches('button') ? root : root.querySelector('button, select, input');
  };
  const toastTexts = () => Array.from(doc.querySelectorAll('.toast')).map((node) => node.textContent);
  const menuRows = () => Array.from(doc.querySelectorAll('#w-mm-list li'));
  const rowOf = (id) => doc.querySelector('#w-mm-list li[data-item="' + id + '"]');

  async function openStorage() {
    await openLocalOnly(seeded());
    Settings.load();
  }

  t.test('UT-27-01 main menu entries and order', async () => {
    await openStorage();
    await Screens.show('SCR-MainMenu', {});
    const labels = menuRows().map((row) => row.querySelector('.primary-text').textContent);
    t.deepEq(labels, MENU_LABELS, '12 items with the BRIEF 7 labels in order');
    t.eq(doc.activeElement, rowOf('quickplay'), 'Quick Play holds the initial focus');
    t.ok(doc.getElementById('mm-version').textContent.startsWith('Version ' + FLM.VERSION), 'version line');
  });

  t.test('UT-27-01b the entry of the last used mode takes the focus and is marked', async () => {
    await openStorage();
    Settings.set('onboarding.lastMode', 'settings', 'ui');
    await Screens.show('SCR-MainMenu', {});
    t.eq(doc.activeElement, rowOf('settings'));
    t.ok(rowOf('settings').querySelector('.secondary-text').textContent.startsWith('Last used - '));
    t.ok(!rowOf('about').querySelector('.secondary-text').textContent.startsWith('Last used - '));
  });

  t.test('UT-27-01c enabled entries enter their mode, later entries are disabled with a reason', async () => {
    await openStorage();
    const calls = modesSpy();
    await Screens.show('SCR-MainMenu', {});
    const enabled = menuRows().filter((row) => row.getAttribute('aria-disabled') !== 'true')
      .map((row) => row.getAttribute('data-item'));
    t.deepEq(enabled, ['settings', 'help', 'about']);
    const disabled = menuRows().filter((row) => row.getAttribute('aria-disabled') === 'true');
    t.eq(disabled.length, 9);
    disabled.forEach((row) => t.ok(row.querySelector('.reason').textContent.length > 0, 'one-line reason'));
    t.eq(rowOf('quickplay').querySelector('.reason').textContent, LATER_BUILD);
    rowOf('help').click();
    t.deepEq(calls, [['enter', 'help', {}]]);
  });

  t.test('UT-27-02 disabled entries explain why', async () => {
    await openStorage();
    const calls = modesSpy();
    await Screens.show('SCR-MainMenu', { environment: { webrtc: false, relayUrl: '' } });
    const row = rowOf('multiplayer');
    t.eq(row.getAttribute('aria-disabled'), 'true');
    t.eq(row.querySelector('.reason').textContent, 'This browser has no WebRTC support.');
    row.click();
    t.ok(toastTexts().includes('This browser has no WebRTC support.'), 'activating shows the reason toast');
    t.eq(calls.length, 0, 'Modes.enter was not called');
  });

  t.test('UT-27-02b a relay URL keeps the multiplayer reason a later-build reason', async () => {
    await openStorage();
    await Screens.show('SCR-MainMenu', { environment: { webrtc: false, relayUrl: 'wss://relay.example/room' } });
    t.eq(rowOf('multiplayer').querySelector('.reason').textContent, LATER_BUILD);
  });

  async function stepThroughFirstLaunch() {
    const controller = await Screens.show('SCR-FirstLaunch', {});
    const press = (id) => button(id).click();
    t.eq(controller.step(), 1);
    t.ok(doc.getElementById('fl-version').textContent.includes(FLM.VERSION), 'name and version on step 1');
    press('fl-next');
    t.eq(controller.step(), 2);
    t.ok(doc.getElementById('fl-checks'), 'capability summary from the gate');
    press('fl-next');
    t.eq(controller.step(), 3);
    return controller;
  }

  t.test('UT-27-07 first launch steps and flag', async () => {
    const ls = seeded();
    await openLocalOnly(ls);
    Settings.load();
    const controller = await stepThroughFirstLaunch();
    controller.onBack();
    t.eq(controller.step(), 2, 'Back on step 3 returns to step 2');
    button('fl-next').click();
    button('fl-skip-sound').click();
    t.eq(controller.step(), 4);
    t.ok(/^Graphics: (WebGL2|WebGL1|2D)$/.test(doc.getElementById('fl-render-line').textContent), 'rendering line');
    button('fl-next').click();
    t.eq(controller.step(), 5);
    button('fl-next').click();
    t.eq(controller.step(), 6);
    t.eq(Settings.get('onboarding.firstLaunchDone'), false, 'the flag is not set before the choice');
    button('fl-menu').click();
    t.eq(Settings.get('onboarding.firstLaunchDone'), true);
    t.eq(JSON.parse(ls.getItem(SETTINGS_KEY)).onboarding.firstLaunchDone, true, 'written immediately');
    await waitFor(() => UI.Screens.current() && UI.Screens.current().id === 'SCR-MainMenu', 'the main menu');
    t.eq(UI.Screens.depth(), 1, 'the first launch screen was replaced');
  });

  t.test('UT-27-07b choices of later steps are disabled and Skip setup goes to the menu', async () => {
    await openStorage();
    const controller = await Screens.show('SCR-FirstLaunch', {});
    controller.goTo(6);
    t.eq(button('fl-learn').getAttribute('aria-disabled'), 'true');
    t.eq(button('fl-demo').getAttribute('aria-disabled'), 'true');
    controller.goTo(1);
    button('fl-skip').click();
    await waitFor(() => UI.Screens.current() && UI.Screens.current().id === 'SCR-MainMenu', 'the main menu');
    t.eq(Settings.get('onboarding.firstLaunchDone'), true);
    t.eq(Settings.get('onboarding.inputMode'), 'auto');
  });

  // T04.02: the master and metronome volume sliders of SCR-Pause store the setting; M-05 follows settings.changed.
  t.test('T04.02 pause screen: master and metronome volume sliders write through Settings.set', async () => {
    await openStorage();
    await Screens.show('SCR-Pause', {});
    const stored = { master: Settings.get('audio.masterVolume'), metronome: Settings.get('audio.metronomeVolume') };
    const master = control('ps-audio-masterVolume');
    const metronome = control('ps-audio-metronomeVolume');
    t.eq(master.value, String(Math.round(Settings.get('audio.masterVolume') * 100)), 'shows the stored value');
    t.ok(doc.getElementById('set-audio-masterVolume') === null, 'its ids do not clash with SCR-Settings');
    const changes = [];
    bus.on('settings.changed', (event) => changes.push([event.key, event.value]), t.owner);
    [[master, 30], [metronome, 55]].forEach(([node, value]) => {
      node.value = String(value);
      node.dispatchEvent(new window.Event('input', { bubbles: true }));
      node.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    t.deepEq(changes, [['audio.masterVolume', 0.3], ['audio.metronomeVolume', 0.55]]);
    t.eq(Settings.get('audio.masterVolume'), 0.3);
    t.near(FLM.Audio.masterGain(), 0.3, 1e-9, 'the audio engine took the master volume');
    t.near(FLM.Audio.metronomeGain(), 0.55, 1e-9, 'and the metronome volume');
    Settings.setMany({ 'audio.masterVolume': stored.master, 'audio.metronomeVolume': stored.metronome }, 'ui');
    t.near(FLM.Audio.masterGain(), stored.master, 1e-9, 'the page volumes are back');
  });

  t.test('UT-27-26 codeLabel table', () => {
    const codes = ['KeyA', 'Digit3', 'ArrowLeft', 'ShiftLeft', 'Escape', 'Semicolon', 'midi:60', 'Foo'];
    t.deepEq(codes.map((code) => Screens.codeLabel(code)),
      ['A', '3', 'Left', 'Left Shift', 'Esc', ';', 'MIDI C4', 'Foo']);
    t.eq(Screens.codeLabel('Numpad7'), 'Num 7');
    t.deepEq(Screens.padWords('dance'), ['left', 'down', 'up', 'right']);
    t.deepEq(Screens.padWords('lanes'), ['circle', 'triangle', 'square', 'diamond']);
  });

  const dialogNode = (id) => doc.querySelector('[data-dialog="' + id + '"]');
  const dialogButton = (label) => Array.from(doc.querySelectorAll('.dialog button'))
    .find((node) => node.textContent.includes(label));

  t.test('UT-27-28 audio blocked dialog resolves on unlock', async () => {
    const pending = Screens.dialog('DLG-AudioBlocked', { mode: 'quickplay' });
    t.ok(dialogNode('DLG-AudioBlocked'), 'the dialog is open');
    t.ok(dialogNode('DLG-AudioBlocked').textContent.includes('Quick Play needs sound.'));
    Core.bus.emit('audio.unlocked', { audioTime: 0, sampleRate: 48000, latencyMs: 0, attempts: 1 });
    t.eq(await pending, 'enabled');
    t.eq(UI.dialogCount(), 0, 'the dialog closed');
  });

  t.test('UT-27-28b the enable button unlocks inside the click; cancel and a missing audio module', async () => {
    const stubbed = { calls: 0, unlock() { stubbed.calls += 1; return Promise.resolve(); }, isUnlocked: () => true };
    standIn('Audio', stubbed);
    const pending = Screens.dialog('DLG-AudioBlocked', { mode: 'freeplay' });
    dialogButton('Turn on sound').click();
    t.eq(stubbed.calls, 1, 'Audio.unlock was called synchronously by the click');
    t.eq(await pending, 'enabled');
    delete FLM.Audio;
    const second = Screens.dialog('DLG-AudioBlocked', { mode: 'freeplay' });
    dialogButton('Turn on sound').click();
    const said = dialogNode('DLG-AudioBlocked').textContent.includes('Sound did not start');
    t.ok(said, 'without audio the dialog says so');
    dialogButton('Cancel').click();
    t.eq(await second, 'cancel');
  });

  t.test('UT-27-28c resume audio dialog calls resume inside the click', async () => {
    const stubbed = { calls: 0, resume() { stubbed.calls += 1; return Promise.resolve(); } };
    standIn('Audio', stubbed);
    const pending = Screens.dialog('DLG-ResumeAudio', {});
    dialogButton('Resume sound').click();
    t.eq(await pending, 'resume');
    t.eq(stubbed.calls, 1);
    const stay = Screens.dialog('DLG-ResumeAudio', {});
    dialogButton('Stay paused').click();
    t.eq(await stay, 'cancel');
  });

  // T04.01: the two audio dialogs on the real engine of M-05 (its context is a stand-in whose resume() we control).
  async function withEngineAsAudio(engine, body) {
    const original = FLM.Audio;
    FLM.Audio = engine;
    try {
      await body();
    } finally {
      FLM.Audio = original;
      engine.close();
      FLM.Input.resampleAnchor();            // the anchor read the stand-in context while it was FLM.Audio
    }
  }

  t.test('UT-27-28e the enable button unlocks the real engine inside the click and the dialog resolves (T04.01)',
    async () => {
      const fake = t.fakes.fakeAudioContext();
      const resume = t.fakes.spy(() => {
        fake.setState('running');
        return Promise.resolve();
      });
      fake.overrides.resume = resume;
      await withEngineAsAudio(FLM.Audio.createEngine({ context: fake.context, mobile: false }), async () => {
        const pending = Screens.dialog('DLG-AudioBlocked', { mode: 'freeplay' });
        dialogButton('Turn on sound').click();
        t.eq(resume.count, 1, 'resume() ran synchronously inside the click');
        t.eq(await pending, 'enabled');
        t.eq(FLM.Audio.isUnlocked(), true);
        t.eq(UI.dialogCount(), 0, 'the dialog closed');
      });
    });

  t.test('UT-27-28f the resume dialog resumes the real engine inside the click (T04.01)', async () => {
    const fake = t.fakes.fakeAudioContext({ state: 'running' });
    const resume = t.fakes.spy(() => {
      fake.setState('running');
      return Promise.resolve();
    });
    fake.overrides.resume = resume;
    const engine = FLM.Audio.createEngine({ context: fake.context, mobile: false });
    await withEngineAsAudio(engine, async () => {
      await engine.unlock();
      fake.setState('interrupted');
      fake.overrides.resume = t.fakes.spy(() => {
        fake.setState('running');
        return Promise.resolve();
      });
      const pending = Screens.dialog('DLG-ResumeAudio', {});
      dialogButton('Resume sound').click();
      t.eq(fake.overrides.resume.count, 1, 'resume() ran synchronously inside the click');
      t.eq(await pending, 'resume');
      t.eq(engine.state(), 'running');
    });
  });

  t.test('UT-27-28d showError opens the returned-to-menu dialog; unknown and later dialogs are refused', async () => {
    const shown = Screens.showError({ code: 'E-MODE-002', message: 'x', userMessage: 'The mode could not start.',
      context: { mode: 'quickplay' } });
    const node = dialogNode('DLG-Unsupported');
    t.ok(node.textContent.includes('Quick Play stopped'));
    t.ok(node.textContent.includes('The mode could not start.'));
    t.ok(node.textContent.includes('You are back at the main menu.'));
    dialogButton('OK').click();
    await shown;
    let thrown = null;
    await Screens.dialog('DLG-DeleteTrack', {}).catch((error) => { thrown = error; });
    t.eq(thrown && thrown.code, 'E-MODE-002');
  });

  t.test('T01.11 registry: register is idempotent, get refuses unknown and unbuilt screens', () => {
    t.eq(Screens.SCREENS.length, 18);
    t.eq(Screens.DIALOGS.length, 14);
    const before = Screens.counters().globalListeners;
    Screens.register();
    Screens.register();
    t.eq(Screens.counters().globalListeners, before, 'no second set of global listeners');
    ['SCR-MainMenu', 'SCR-Settings', 'SCR-Help', 'SCR-About', 'SCR-Diagnostics', 'SCR-FirstLaunch']
      .forEach((id) => t.eq(typeof Screens.get(id), 'function', id));
    ['SCR-Nope', 'SCR-QuickPlay'].forEach((id) => {
      let code = null;
      try { Screens.get(id); } catch (error) { code = error.code; }
      t.eq(code, 'E-MODE-002', id);
    });
  });

  t.test('T01.11 settings screen: categories, rows write through Settings.set, back leaves the mode', async () => {
    await openStorage();
    const calls = modesSpy('settings');
    const controller = await Screens.show('SCR-Settings', {});
    const tabs = Array.from(doc.querySelectorAll('#w-set-cats [role="tab"]')).map((node) => node.textContent);
    t.deepEq(tabs, ['Audio', 'Controls', 'Gameplay', 'Video', 'Accessibility', 'Calibration', 'Data and backup',
      'Privacy', 'Advanced']);
    control('set-audio-metronomeAccent').click();
    t.eq(Settings.get('audio.metronomeAccent'), false);
    controller.showCategory('accessibility');
    control('set-video-highContrast').click();
    t.eq(Settings.get('video.highContrast'), true);
    t.eq(control('set-accessibility-laneGlyphs').getAttribute('aria-disabled'), 'true', 'lane symbols locked on');
    controller.showCategory('privacy');
    t.ok(doc.getElementById('set-privacy').textContent.startsWith('Finger Lickin Music keeps your settings'));
    controller.showCategory('data');
    t.ok(doc.getElementById('set-backup-note').textContent.startsWith('Browser storage is not a permanent backup'));
    t.eq(controller.onBack(), 'handled');
    t.deepEq(calls, [['leave', 'user']]);
  });

  t.test('T01.11 settings reset all asks first; export and import controls exist', async () => {
    await openStorage();
    modesSpy('settings');
    const controller = await Screens.show('SCR-Settings', { category: 'data' });
    t.eq(controller.category(), 'data');
    Settings.set('audio.masterVolume', 0.4, 'ui');
    button('set-reset-all').click();
    t.ok(dialogNode('DLG-ConfirmReset'), 'the confirmation dialog is open');
    dialogButton('Cancel').click();
    await yieldTurn();
    t.eq(Settings.get('audio.masterVolume'), 0.4, 'cancel keeps the settings');
    button('set-reset-all').click();
    dialogButton('Reset settings').click();
    await waitFor(() => Settings.get('audio.masterVolume') === Settings.DEFAULTS.audio.masterVolume, 'the reset');
    ['set-export', 'set-import', 'set-first-launch'].forEach((id) => t.ok(button(id), id));
    t.eq(button('set-clear-history').getAttribute('aria-disabled'), 'true');
  });

  t.test('T01.11 help screen texts and key tables', async () => {
    await openStorage();
    await Screens.show('SCR-Help', {});
    const text = screenRoot('SCR-Help').textContent;
    t.ok(text.includes('Playback in a background tab may stutter in some browsers.'));
    t.ok(text.includes('No sound on iPhone or iPad? Check that the ring and silent switch is not set to silent'));
    t.ok(text.includes('Quick Play: pick a song, a part and a difficulty, and play along with the band.'));
    const keys = Array.from(doc.querySelectorAll('#hlp-keys tbody tr')).map((row) => row.textContent);
    t.ok(keys.includes('Lane 1 (circle)A'), 'lane 1 shows the A key');
    t.ok(keys.includes('Dance leftLeft or D'));
  });

  t.test('T01.11 about screen texts', async () => {
    await openStorage();
    await Screens.show('SCR-About', {});
    const text = screenRoot('SCR-About').textContent;
    t.ok(text.includes('Standalone edition. Everything runs from this file on your device'));
    t.ok(text.includes('Runtime dependencies: none.'));
    t.ok(text.includes('so there are no third-party licenses to list.'));
    t.ok(text.includes('Copyright (c) 2026 the Finger Lickin Music authors. All rights reserved.'));
    t.ok(text.includes('Limits of this version'));
    t.ok(text.includes('What needs more than this file'));
    t.ok(text.includes('Finger Lickin Music ' + FLM.VERSION));
  });

  t.test('T01.11 diagnostics screen sections, load timing and test-build controls', { timeoutMs: 8000 }, async () => {
    await openStorage();
    await Screens.show('SCR-Diagnostics', {});
    ['dg-build', 'dg-caps', 'dg-timing', 'dg-audio', 'dg-render', 'dg-storage', 'dg-input', 'dg-net', 'dg-errors',
      'dg-log'].forEach((id) => t.ok(doc.getElementById(id), id));
    t.ok(doc.getElementById('dg-load').textContent.startsWith('Load timing:'));
    t.ok(doc.querySelector('#dg-storage tbody').textContent.includes('Mode'));
    t.ok(button('dg-export') && button('dg-copy') && button('dg-selftest') && button('dg-perf'));
    t.eq(button('dg-perf').getAttribute('aria-disabled'), FLM.SelfTest.perf.list().length === 0 ? 'true' : null);
    Core.ErrorReporter.report('E-REN-007', new Error('probe'), { module: 'Screens' });
    await new Promise((resolve) => Core.timers.setTimeout(resolve, 1100, t.owner));
    t.ok(doc.querySelector('#dg-errors tbody').textContent.includes('E-REN-007'), 'the table refreshes each second');
  });

  // ---------------------------------------------------------------- T03.04: controls, remapping, Help and Controls
  const JSON_CLONE = (value) => JSON.parse(JSON.stringify(value));
  const pressKey = (code, init) => doc.body.dispatchEvent(new window.KeyboardEvent('keydown',
    Object.assign({ code, key: code, bubbles: true, cancelable: true }, init)));
  const statusOf = (control) => doc.querySelector('[data-status="' + control + '"]').textContent;
  const chipTexts = (control) => Array.from(doc.querySelectorAll('[data-control="' + control +
    '"] .remap-chips button')).map((node) => node.textContent);

  /** A stand-in for M-07 that records its calls, finds conflicts by itself and starts from the default maps. */
  function fakeInput() {
    const map = Core.deepClone(FLM.Input.DEFAULT_MAPS);
    const calls = [];
    const clash = (context, control, code) => {
      const scopes = context === 'global' ? Object.keys(map.keyboard) : [context, 'global'];
      for (const scope of scopes) {
        const other = Object.keys(map.keyboard[scope]).find((name) => (scope !== context || name !== control) &&
          map.keyboard[scope][name].includes(code));
        if (other) return { context: scope, control: other, code };
      }
      return null;
    };
    return { calls, map,
      getMap: () => Core.deepClone(map),
      setMap: () => ({ ok: true, errors: [] }),
      resetMap: () => calls.push(['resetMap']),
      remap(context, control, code) {
        calls.push(['remap', context, control, code]);
        const conflict = clash(context, control, code);
        if (conflict) return { ok: false, conflict };
        map.keyboard[context][control].push(code);
        return { ok: true };
      },
      unmap(context, control, code) {
        calls.push(['unmap', context, control, code]);
        const list = map.keyboard[context][control];
        if (list.length < 2 || !list.includes(code)) return false;
        list.splice(list.indexOf(code), 1);
        return true;
      } };
  }

  async function showControls() {
    await openStorage();
    const calls = modesSpy('settings');
    const controller = await Screens.show('SCR-Settings', { category: 'controls' });
    return { calls, controller };
  }

  t.test('UT-27-16 remap capture and conflict', async () => {
    const input = fakeInput();
    ['instrument', 'freeplay', 'studio'].forEach((context) => input.map.keyboard[context].lane1.push('KeyX'));
    standIn('Input', input);
    const { calls } = await showControls();
    button('set-add-lane0').click();
    t.eq(statusOf('lane0'), 'Press a key for Lane 1 (circle). Escape cancels.');
    pressKey('KeyS');
    await waitFor(() => dialogNode('DLG-RemapConflict'), 'the conflict dialog');
    const text = dialogNode('DLG-RemapConflict').textContent;
    t.ok(text.includes('S is already used for Lane 2 (triangle) (Instrument). Use it for Lane 1 (circle) instead?'),
      text);
    t.ok(text.includes('Lane 2 (triangle) keeps its other keys.'));
    t.deepEq(Settings.get('input.keys.lanes'), ['KeyA', 'KeyS', 'KeyK', 'KeyL'], 'nothing is saved before the answer');
    dialogButton('Use for Lane 1').click();
    await waitFor(() => !dialogNode('DLG-RemapConflict') && chipTexts('lane0').includes('S'), 'the swap');
    t.deepEq(input.calls.filter((call) => call[0] === 'unmap').map((call) => call.slice(1)),
      [['instrument', 'lane1', 'KeyS'], ['freeplay', 'lane1', 'KeyS'], ['studio', 'lane1', 'KeyS']],
      'the other control gives the key up in every context it has it');
    t.deepEq(chipTexts('lane1'), ['X']);
    t.deepEq(Settings.get('input.keys.lanes'), ['KeyA', 'KeyX', 'KeyK', 'KeyL']);
    t.deepEq(Settings.get('input.keys.more').lane0, ['KeyS']);
    t.deepEq(calls, [], 'Escape never left the screen');
  });

  t.test('UT-27-16b Cancel keeps the map, Choose another key captures again, Escape cancels the capture', async () => {
    const input = fakeInput();
    ['instrument', 'freeplay', 'studio'].forEach((context) => input.map.keyboard[context].lane1.push('KeyX'));
    standIn('Input', input);
    const { calls } = await showControls();
    button('set-add-lane0').click();
    pressKey('KeyS');
    await waitFor(() => dialogNode('DLG-RemapConflict'), 'the dialog');
    dialogButton('Cancel').click();
    await waitFor(() => !dialogNode('DLG-RemapConflict'), 'the dialog to close');
    t.deepEq(input.calls.filter((call) => call[0] === 'unmap'), [], 'Cancel changes nothing');
    t.deepEq(chipTexts('lane0'), ['A']);
    button('set-add-lane0').click();
    pressKey('KeyS');
    await waitFor(() => dialogNode('DLG-RemapConflict'), 'the dialog again');
    dialogButton('Choose another key').click();
    await waitFor(() => !dialogNode('DLG-RemapConflict'), 'the dialog to close');
    t.ok(statusOf('lane0').startsWith('Press a key for Lane 1'), 'the capture restarted');
    pressKey('Escape');
    t.eq(statusOf('lane0'), '', 'Escape cancels the capture');
    t.deepEq(input.calls.filter((call) => call[0] === 'remap' && call[3] !== 'KeyS'), [], 'no remap was tried');
    t.deepEq(calls, [], 'and the screen was not left');
  });

  t.test('UT-27-16c a conflict with a control that has no other key cannot be moved', async () => {
    standIn('Input', fakeInput());
    await showControls();
    button('set-add-lane0').click();
    pressKey('KeyS');
    await waitFor(() => dialogNode('DLG-RemapConflict'), 'the dialog');
    const text = dialogNode('DLG-RemapConflict').textContent;
    t.ok(text.includes('Lane 2 (triangle) has no other key, so S cannot be moved.'));
    t.eq(dialogButton('Use for'), undefined, 'the move button is hidden');
    dialogButton('Cancel').click();
    await waitFor(() => !dialogNode('DLG-RemapConflict'), 'the dialog to close');
  });

  t.test('UT-27-16d reserved keys are refused with their message and the capture stays open', async () => {
    const input = fakeInput();
    standIn('Input', input);
    await showControls();
    button('set-add-lane0').click();
    pressKey('Tab');
    t.eq(statusOf('lane0'), 'Tab is reserved for navigation.');
    pressKey('F5');
    t.eq(statusOf('lane0'), 'F5 cannot be used because the browser or system reserves it.');
    pressKey('KeyC', { ctrlKey: true });
    t.ok(statusOf('lane0').includes('cannot be used because the browser or system reserves it.'));
    t.deepEq(input.calls, [], 'nothing reached M-07');
    pressKey('KeyZ');
    t.deepEq(input.calls, [['remap', 'instrument', 'lane0', 'KeyZ'], ['remap', 'freeplay', 'lane0', 'KeyZ'],
      ['remap', 'studio', 'lane0', 'KeyZ']], 'a usable key is bound in every gameplay context');
    t.deepEq(chipTexts('lane0'), ['A', 'Z']);
  });

  t.test('UT-27-16e real maps: add, remove, last key refused, persisted, reset, nothing lost on reload', async () => {
    await showControls();
    button('set-add-lane0').click();
    pressKey('KeyF');
    t.deepEq(chipTexts('lane0'), ['A', 'F']);
    ['instrument', 'freeplay', 'studio'].forEach((context) => {
      t.deepEq(FLM.Input.getMap().keyboard[context].lane0, ['KeyA', 'KeyF'], context);
    });
    t.deepEq(Settings.get('input.keys.more').lane0, ['KeyF'], 'stored with the settings');
    t.deepEq(FLM.Input.getMap(), Settings.mapsFromSettings(Settings.all()), 'a reload restores the same map');
    control('set-key-lane1-KeyS').click();
    t.ok(toastTexts().includes('Each control needs at least one key.'), 'the last key stays (S-INP-01)');
    t.deepEq(chipTexts('lane1'), ['S']);
    control('set-key-lane0-KeyA').click();
    t.deepEq(chipTexts('lane0'), ['F']);
    t.deepEq(Settings.get('input.keys.lanes'), ['KeyF', 'KeyS', 'KeyK', 'KeyL']);
    t.deepEq(chipTexts('sustain'), ['Left Shift', 'Right Shift']);
    button('set-add-pause').click();
    pressKey('KeyA');
    t.ok(!dialogNode('DLG-RemapConflict'), 'KeyA was freed from lane 1');
    t.deepEq(chipTexts('pause'), ['Esc', 'A']);
    button('set-add-dance0').click();
    pressKey('KeyA');
    await waitFor(() => dialogNode('DLG-RemapConflict'), 'the global key clashes with a dance key');
    t.ok(dialogNode('DLG-RemapConflict').textContent.includes('(all modes)'));
    dialogButton('Cancel').click();
    await waitFor(() => !dialogNode('DLG-RemapConflict'), 'the dialog to close');
    button('set-remap-reset').click();
    await waitFor(() => dialogNode('DLG-ConfirmReset'), 'the confirmation');
    t.ok(dialogNode('DLG-ConfirmReset').textContent.includes('Reset controls?'));
    dialogButton('Reset controls').click();
    await waitFor(() => !dialogNode('DLG-ConfirmReset') && chipTexts('lane0').join() === 'A', 'the reset');
    t.deepEq(FLM.Input.getMap(), JSON_CLONE(FLM.Input.DEFAULT_MAPS));
    t.deepEq(Settings.get('input.keys.more'), { sustain: ['ShiftRight'] });
    t.deepEq(Settings.get('input.keys.lanes'), ['KeyA', 'KeyS', 'KeyK', 'KeyL']);
  });

  t.test('UT-27-16f changing category or leaving drops an open capture', async () => {
    const input = fakeInput();
    standIn('Input', input);
    const { controller } = await showControls();
    button('set-add-lane0').click();
    controller.showCategory('audio');
    pressKey('KeyZ');
    t.deepEq(input.calls, [], 'the key press after the switch is an ordinary key');
  });

  t.test('T03.04 settings and Input maps: defaults agree, writes reach Input, damage falls back', async () => {
    await openStorage();
    const defaults = Settings.mapsFromSettings(Settings.DEFAULTS);
    t.deepEq(defaults, JSON_CLONE(FLM.Input.DEFAULT_MAPS), 'the default settings are the BRIEF 7 maps');
    const patch = Settings.mapsToSettings(defaults);
    Object.keys(patch).forEach((path) => {
      t.deepEq(patch[path], Settings.DEFAULTS.input.keys[path.slice('input.keys.'.length)], path);
    });
    Settings.set('input.keys.lanes', ['KeyZ', 'KeyX', 'KeyC', 'KeyV'], 'ui');
    t.deepEq(FLM.Input.getMap().keyboard.freeplay.lane3, ['KeyV'], 'an input.keys write calls Input.setMap');
    Settings.setMany({ 'input.keys.lanes': ['KeyX', 'KeyZ', 'KeyC', 'KeyV'], 'input.keys.pause': 'KeyU' }, 'ui');
    t.deepEq(FLM.Input.getMap().keyboard.global.pause, ['KeyU'], 'a batch is installed as a whole');
    const damaged = Settings.mapsFromSettings({ input: { keys: { lanes: ['A', 'B'], more: { lane0: ['Key A!'] } } } });
    t.deepEq(damaged.keyboard.instrument, Object.assign({}, defaults.keyboard.instrument, { sustain: ['ShiftLeft'] }),
      'damaged key settings fall back to the defaults (an empty extra list drops the second sustain key)');
    const imported = Settings.parseImport(JSON.stringify({ format: 'flm-settings', version: 1,
      settings: { input: { keys: { more: { lane0: ['Key A!'], bogus: ['KeyB'], sustain: ['ShiftRight'],
        lane1: ['KeyF', 'KeyG', 'KeyH'] } } } } }));
    t.deepEq(imported.doc.input.keys.more, { sustain: ['ShiftRight'] }, 'only valid extra keys survive');
    Settings.set('input.midiLaneNotes', [61, 62, 64, 65], 'ui');
    t.eq(FLM.Input.getMap().midi.lane0, 61, 'the MIDI lane notes reach Input too');
  });

  t.test('T03.04 help controls tables come from the live maps and follow input.map', async () => {
    await openStorage();
    await Screens.show('SCR-Help', {});
    const rows = () => Array.from(doc.querySelectorAll('#hlp-keys tbody tr')).map((row) => row.textContent);
    t.ok(rows().includes('Lane 1 (circle)A'));
    t.ok(rows().includes('SustainLeft Shift or Right Shift'));
    t.eq(rows().length, 19, 'every control has a row');
    FLM.Input.remap('instrument', 'lane0', 'KeyZ');
    t.ok(rows().includes('Lane 1 (circle)A or Z'), 'a remap shows at once');
    t.ok(button('hlp-change'), 'the Change link to Settings');
  });

  // ---------------------------------------------------------------- T03.09: calibration settings and DLG-Calibration
  const CAL_CLICKS = 12;
  const CAL_SPACING_MS = 667;
  const CAL_TEST_INTERVAL_MS = 120;          // a fast run: the same steps with a shorter beat
  const CAL_WAIT_MS = 4000;
  const CAL_POLL_MS = 10;
  const CAL_POINTER_LAG_MS = 20;             // a tap shortly after its flash
  const WIZARD_WORDS_FORBIDDEN = ['latency', 'buffer', 'sample rate'];
  const calibrationTargets = (start) => Array.from({ length: CAL_CLICKS }, (item, index) => start + index *
    CAL_SPACING_MS);
  const tapsAt = (targets, deltas) => targets.map((target, index) => target + deltas[index % deltas.length]);

  async function waitUntil(check, message) {
    for (let waited = 0; waited < CAL_WAIT_MS; waited += CAL_POLL_MS) {
      if (check()) return;
      await new Promise((resolve) => Core.timers.setTimeout(resolve, CAL_POLL_MS, t.owner));
    }
    throw new Error('timed out waiting for ' + message);
  }

  // The modules that keep the calibration are shared, so each test puts them back.
  async function keepingCalibration(body) {
    const rhythm = FLM.Rhythm.calibration();
    const input = FLM.Input.calibration();
    try {
      await body();
    } finally {
      FLM.Rhythm.setCalibration(rhythm);
      FLM.Input.setCalibration(input);
    }
  }

  t.test('UT-27-17 calibration math', () => {
    const math = Screens.Calibration;
    const targets = calibrationTargets(1000);
    const audio = math.analyzeTaps(tapsAt(targets, [115, 125, 120, 118, 122]), targets);
    t.eq(audio.status, 'ok');
    t.near(audio.medianMs, 120, 5);
    const visual = math.analyzeTaps(tapsAt(targets, [40]), targets);
    t.deepEq([visual.status, visual.medianMs, visual.matched], ['ok', 40, 8], 'the first four flashes are ignored');
    const current = { inputOffsetMs: 7, audioLatencyMs: 9, visualLeadMs: 1700 };
    t.deepEq(math.calibrationFromMedians({ audioMs: 120, visualMs: 40 }, current),
      { inputOffsetMs: 40, audioLatencyMs: 80, visualLeadMs: 1700 });
    t.deepEq(math.calibrationFromMedians({ audioMs: null, visualMs: 40 }, current),
      { inputOffsetMs: 40, audioLatencyMs: 9, visualLeadMs: 1700 }, 'a skipped click step keeps the sound delay');
    t.deepEq(math.calibrationFromMedians({ audioMs: null, visualMs: null }, current), current);
    t.deepEq(math.calibrationFromMedians({ audioMs: 900, visualMs: 600 }, current),
      { inputOffsetMs: 200, audioLatencyMs: 300, visualLeadMs: 1700 }, 'clamped to the setting ranges');
    t.deepEq(math.calibrationFromMedians({ audioMs: 10, visualMs: 90 }, current).audioLatencyMs, 0,
      'a negative sound delay is clamped to 0');
  });

  t.test('UT-27-17b too few and uneven taps are reported and ignored taps do not count', () => {
    const math = Screens.Calibration;
    const targets = calibrationTargets(1000);
    const few = math.analyzeTaps(tapsAt(targets, [30]).slice(0, 9), targets);
    t.deepEq([few.status, few.matched], ['few', 5], 'five matched taps are not enough');
    t.eq(math.analyzeTaps([], targets).status, 'few');
    t.eq(math.analyzeTaps([], targets).medianMs, null);
    const uneven = math.analyzeTaps(tapsAt(targets, [0, 80]), targets);
    t.eq(uneven.status, 'uneven');
    t.ok(uneven.iqrMs > 40);
    const far = math.analyzeTaps(tapsAt(targets, [333]), targets);
    t.eq(far.status, 'few', 'taps further than 300 ms from a flash match nothing');
    const early = tapsAt(targets, [30]).map((tap, index) => (index < 4 ? tap + 5000 : tap));
    t.eq(math.analyzeTaps(early, targets).status, 'ok', 'wild taps on the first four flashes change nothing');
  });

  /** Opens DLG-Calibration with a fast beat; taps are emitted on input.event with a fixed offset from each flash. */
  async function openWizard(deltas, taps) {
    const shown = Screens.dialog('DLG-Calibration', { intervalMs: CAL_TEST_INTERVAL_MS, startDelayMs: 0,
      onRunStart: (targets) => {
        const tapTimes = taps === undefined ? tapsAt(targets, deltas) : taps(targets);
        tapTimes.forEach((tPerf, index) => {
          Core.timers.setTimeout(() => bus.emit('input.event', { source: 'keyboard', control: 'lane0', type: 'press',
            tPerf, tAudio: tPerf / 1000, pressure: 1 }), Math.max(0, targets[index] - Core.now()) + 5, t.owner);
        });
      } });
    await waitUntil(() => dialogNode('DLG-Calibration'), 'the wizard');
    return { closed: shown };   // wrapped: an async function would wait for the dialog to close
  }

  const wizardText = () => dialogNode('DLG-Calibration').textContent;
  const statusText = () => doc.getElementById('cal-status').textContent;
  const pressEscape = () => doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape',
    code: 'Escape', bubbles: true, cancelable: true }));

  async function runWatchStep() {
    button('cal-listen-skip').click();
    button('cal-start').click();
    await waitUntil(() => doc.getElementById('w-cal-again') !== null, 'the step result');
  }

  t.test('UT-27-17c wizard: tap step, preview and summary save the three keys with source wizard', async () => {
    await openStorage();
    await keepingCalibration(async () => {
      const changes = [];
      bus.on('settings.changed', (event) => { if (event.key.startsWith('calibration.')) changes.push(event); },
        t.owner);
      const contextBefore = FLM.Input.context();
      const shown = (await openWizard([40])).closed;
      t.ok(wizardText().includes('1. Listen and tap'));
      t.ok(wizardText().includes('Tap any lane key or pad on every click you hear.'));
      t.eq(button('cal-listen-start').getAttribute('aria-disabled'), 'true',
        'the click step waits for the audio build step');
      await runWatchStep();
      t.ok(statusText().includes('Tap timing measured: +40 ms.'), statusText());
      button('cal-next').click();
      t.ok(wizardText().includes('3. Note speed'));
      t.ok(doc.getElementById('cal-preview'), 'the live preview is shown');
      button('cal-next').click();
      t.eq(doc.getElementById('cal-summary').textContent, 'Sound delay: 0 ms. Tap timing: +40 ms. Note speed: x1.0.');
      WIZARD_WORDS_FORBIDDEN.forEach((word) => t.eq(wizardText().toLowerCase().includes(word), false, word));
      t.eq(Settings.get('calibration.inputOffsetMs'), 0, 'nothing is saved before Save');
      button('cal-save').click();
      t.eq(await shown, 'save');
      t.deepEq(Settings.calibration(), { inputOffsetMs: 40, audioLatencyMs: 0, visualLeadMs: 1500 });
      t.ok(changes.length === 1 && changes[0].source === 'wizard', 'one change, source wizard');
      t.eq(FLM.Rhythm.calibration().inputOffsetMs, 40, 'M-09 applies it');
      t.eq(FLM.Input.calibration().inputOffsetMs, 40, 'M-07 stores it');
      t.eq(FLM.Input.context(), contextBefore, 'the wizard released its input context');
    });
  });

  t.test('UT-27-17d wizard: uneven taps offer Try again and Use anyway, too few taps only Try again', async () => {
    await openStorage();
    await keepingCalibration(async () => {
      let shown = (await openWizard([0, 50])).closed;
      await runWatchStep();
      t.eq(statusText(), 'Your taps were uneven, so the result may be off. Try again for a steadier result.');
      t.ok(button('cal-again') && button('cal-anyway'), 'both choices are offered');
      t.eq(button('cal-next'), null);
      button('cal-anyway').click();
      t.ok(wizardText().includes('3. Note speed'));
      dialogButton('Cancel').click();
      t.eq(await shown, 'cancel');
      t.eq(Settings.get('calibration.inputOffsetMs'), 0, 'Cancel keeps the old values');
      shown = (await openWizard([40], (targets) => tapsAt(targets, [40]).slice(0, 8))).closed;
      await runWatchStep();
      t.eq(statusText(), 'Not enough taps were counted. Tap on each click, then try again.');
      t.ok(button('cal-again') && button('cal-skip'));
      t.eq(button('cal-anyway'), null, 'Use anyway is only for uneven taps');
      dialogButton('Cancel').click();
      await shown;
    });
  });

  t.test('UT-27-17e wizard: Escape stops a running step only', async () => {
    await openStorage();
    await keepingCalibration(async () => {
      const shown = (await openWizard([40], () => [])).closed;
      button('cal-listen-skip').click();
      button('cal-start').click();
      t.ok(doc.getElementById('cal-pad'), 'the circle is shown');
      pressEscape();
      t.ok(dialogNode('DLG-Calibration'), 'the dialog stays open');
      t.ok(statusText().startsWith('Press Start.'), 'the step is back at its start');
      pressEscape();
      await shown;
      t.eq(dialogNode('DLG-Calibration'), null, 'Escape with no step running closes the dialog');
    });
  });

  t.test('UT-27-17g wizard: pointer taps on the circle are counted', async () => {
    await openStorage();
    await keepingCalibration(async () => {
      const shown = (await openWizard([40], (targets) => {
        targets.forEach((target) => Core.timers.setTimeout(() => {
          doc.getElementById('cal-pad').dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
        }, Math.max(0, target - Core.now()) + CAL_POINTER_LAG_MS, t.owner));
        return [];
      })).closed;
      button('cal-listen-skip').click();
      button('cal-start').click();
      await waitUntil(() => doc.getElementById('w-cal-again') !== null, 'the step result');
      t.eq(statusText().includes('Not enough taps'), false, statusText());
      dialogButton('Cancel').click();
      await shown;
    });
  });

  t.test('UT-27-17f wizard summary: manual fields show milliseconds, Reset to 0 clears both offsets', async () => {
    await openStorage();
    await keepingCalibration(async () => {
      Settings.setMany({ 'calibration.inputOffsetMs': 25, 'calibration.audioLatencyMs': 60 }, 'ui');
      const shown = (await openWizard([40])).closed;
      button('cal-listen-skip').click();
      button('cal-skip').click();
      button('cal-next').click();
      t.ok(wizardText().includes('Sound delay: 60 ms. Tap timing: +25 ms.'), wizardText());
      t.ok(doc.getElementById('w-cal-input-offset').textContent.includes('ms'), 'each offset is shown in ms');
      t.ok(doc.getElementById('w-cal-sound-delay').textContent.includes('ms'));
      button('cal-reset').click();
      t.ok(wizardText().includes('Sound delay: 0 ms. Tap timing: 0 ms.'), wizardText());
      button('cal-save').click();
      await shown;
      t.deepEq([Settings.get('calibration.inputOffsetMs'), Settings.get('calibration.audioLatencyMs')], [0, 0]);
    });
  });

  t.test('T03.09 settings calibration values reach Input and Rhythm, and Reset calibration clears them', async () => {
    await openStorage();
    await keepingCalibration(async () => {
      Settings.set('calibration.inputOffsetMs', 25, 'ui');
      Settings.setMany({ 'calibration.audioLatencyMs': 60, 'calibration.visualLeadMs': 2000 }, 'ui');
      t.deepEq(FLM.Rhythm.calibration(), { inputOffsetMs: 25, audioLatencyMs: 60, visualLeadMs: 2000 });
      t.deepEq(FLM.Input.calibration(), { inputOffsetMs: 25, audioLatencyMs: 60, visualLeadMs: 2000 });
      Settings.set('calibration.inputOffsetMs', 900, 'ui');
      t.eq(Settings.get('calibration.inputOffsetMs'), 200, 'the setting clamps to -200..200');
      modesSpy('settings');
      await Screens.show('SCR-Settings', { category: 'calibration' });
      ['inputOffsetMs', 'audioLatencyMs'].forEach((name) => {
        t.ok(doc.getElementById('w-set-calibration-' + name).textContent.includes('ms'), name + ' is shown in ms');
      });
      button('set-reset-calibration').click();
      t.deepEq(FLM.Rhythm.calibration(), { inputOffsetMs: 0, audioLatencyMs: 0, visualLeadMs: 1500 });
      t.deepEq(FLM.Input.calibration(), { inputOffsetMs: 0, audioLatencyMs: 0, visualLeadMs: 1500 });
    });
  });

  t.test('T03.09 Run calibration opens DLG-Calibration from the Calibration tab', async () => {
    await openStorage();
    modesSpy('settings');
    await Screens.show('SCR-Settings', { category: 'calibration' });
    button('set-wizard').click();
    await waitUntil(() => dialogNode('DLG-Calibration'), 'the wizard');
    t.ok(wizardText().includes('Calibration'));
    dialogButton('Cancel').click();
    await waitUntil(() => !dialogNode('DLG-Calibration'), 'the wizard to close');
  });

  t.test('UT-09-29 via Settings: a calibration change while a judge plays marks the run not comparable', async () => {
    await openStorage();
    await keepingCalibration(async () => {
      const Model = FLM.Model;
      const judge = FLM.Rhythm.Judge.bind({ timeMap: { audioTimeAt: (tick) => tick / 1920, tickAt: (s) => s * 1920,
        position: () => 0 }, input: { held: () => [] },
        bus: new Core.Emitter() });
      try {
        const note = { id: 'a', tick: 1920, durTicks: 1, lanes: [0], sourceEventIds: [], pitches: [60],
          isHold: false };
        judge.load({ id: 'song:test', songId: 'song', trackId: 'track', instrument: 0, difficulty: 'beginner',
          profile: 'A', notes: [note], generatorVersion: 1, settingsHash: '00000000', omittedSourceEventIds: 0,
          source: 'generated' }, Model.Song.create({ durationTicks: 3840 }), 'beginner');
        judge.setActive(true);
        Settings.set('calibration.visualLeadMs', 2000, 'ui');
        t.eq(judge.summary().comparable, true, 'the note speed is not a timing change');
        Settings.set('calibration.inputOffsetMs', 30, 'wizard');
        t.eq(judge.summary().comparable, false);
      } finally {
        judge.dispose();
      }
    });
  });

  t.test('T03.04 first launch step 5 offers the pad size where touch is used', async () => {
    await openStorage();
    Settings.set('onboarding.inputMode', 'touch', 'ui');
    const controller = await Screens.show('SCR-FirstLaunch', {});
    controller.goTo(5);
    const size = control('fl-pad-size');
    t.ok(size, 'the pad size choice is offered');
    size.value = 'large';
    size.dispatchEvent(new window.Event('change', { bubbles: true }));
    t.eq(Settings.get('input.padSize'), 'large');
    Settings.set('onboarding.inputMode', 'desktop', 'ui');
    controller.goTo(4);
    controller.goTo(5);
    t.eq(doc.getElementById('w-fl-pad-size'), null, 'no pad size on a keyboard device');
    t.ok(doc.getElementById('fl-keys-hint'), 'the keyboard hint points to Settings');
  });
});
})();
