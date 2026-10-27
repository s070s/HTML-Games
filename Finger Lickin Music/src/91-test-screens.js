// 91-test-screens.js - unit tests for M-27 FLM.Screens (group 'screens'; test build only).
// T01.08 delivers UT-27-13 to UT-27-15 (the settings store, Part 6.27.8); T01.10 and T01.11 add the screen rows.
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
});
})();
