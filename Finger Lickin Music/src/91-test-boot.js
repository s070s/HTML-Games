// 91-test-boot.js - unit tests for M-29 FLM.Boot (group 'boot'; test build only).
// UT-29-01 to UT-29-12 follow Part 6.29.8. UT-29-06 and UT-29-09 first ran on a stand-in FLM.Audio (M-05 did not
// exist); since T04.01 the rows UT-29-06b and UT-29-09b run the same checks on the real engine of M-05 (the banner part
// of UT-29-09 belongs to M-27).
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('boot', (t) => {
  const Core = FLM.Core;
  const Boot = FLM.Boot;
  const MS_TOLERANCE = 5;
  const STAGE_COUNT = 16;
  const ALLOWED_RELAY = 'wss://relay.example:8443/flm';
  const MEMORY_NOTICE = 'Settings and projects cannot be saved in this browser mode. Use Export.';
  const FULL_CAPS = Object.freeze({
    canvas2d: true, raf: true, audioContext: true, webgl2: true, webgl1: true, pointerEvents: true,
    maxTouchPoints: 0, gamepad: true, webMidi: true, localStorage: true, indexedDB: true,
    offlineAudioContext: true, mediaRecorder: true, visibility: true, storageEstimate: true,
    performanceMemory: true
  });
  // Modules that boot would use if they existed; test runs never touch the real ones.
  const ABSENT = Object.freeze({ Audio: null, Render: null, Input: null, Transport: null, Project: null });

  t.afterEach(() => {
    Core.ErrorReporter._resetForTests();
    FLM.UI.clearToasts();
  });

  /** Puts `fake` on FLM[name] while fn runs, then restores what was there (module or nothing). */
  async function withFake(name, fake, fn) {
    const had = Object.prototype.hasOwnProperty.call(FLM, name);
    const original = FLM[name];
    FLM[name] = fake;
    try {
      return await fn();
    } finally {
      if (had) FLM[name] = original;
      else delete FLM[name];
    }
  }

  function fakeSettings(onboarding) {
    return {
      load() {},
      all: () => ({ onboarding, video: {}, audio: {} }),
      get: () => false,
      set: () => ({ ok: true })
    };
  }

  function fakeModules(extra) {
    const enterCalls = [];
    const modules = Object.assign({}, ABSENT, {
      Storage: {
        open: async () => ({ mode: 'memory', notice: MEMORY_NOTICE, local: { ok: false }, idb: { ok: false } })
      },
      Screens: { Settings: fakeSettings({ firstLaunchDone: true }), register() {} },
      Modes: {
        init() {},
        enter: async (mode, params) => { enterCalls.push({ mode, params }); return { ok: true, mode }; }
      }
    }, extra);
    return { modules, enterCalls };
  }

  t.test('UT-29-01 URL parameter parsing', () => {
    const first = Boot.parseUrlParams('?test&tier=LOW&diag&online=' + ALLOWED_RELAY + '&x=1');
    t.eq(first.test, true);
    t.eq(first.tier, 'Low');
    t.eq(first.diag, true);
    t.eq(first.online, ALLOWED_RELAY);
    t.eq(first.perf, false);
    t.deepEq(first.warnings, []);
    const second = Boot.parseUrlParams('?tier=ultra&online=http://x');
    t.eq(second.test, false);
    t.eq(second.tier, null);
    t.eq(second.online, null);
    t.deepEq(second.warnings, ['W-URL-TIER', 'W-URL-ONLINE']);
    t.eq(Boot.parseUrlParams('?online=wss://' + 'a'.repeat(200)).online, null, 'a URL over 200 characters');
    t.eq(Boot.parseUrlParams('?perf').perf, true);
    t.eq(Boot.parseUrlParams('').test, false);
  });

  t.test('UT-29-02 gate soft rows', () => {
    const caps = Object.assign({}, FULL_CAPS, { webgl2: false, webgl1: false, webMidi: false });
    const result = Boot.evaluateGate(caps);
    t.deepEq(result.hard, []);
    ['webgl2', 'webgl', 'midi'].forEach((id) => t.ok(result.degraded.includes(id), id + ' is degraded'));
    t.ok(!result.degraded.includes('localStorage'), 'a present capability is not degraded');
    const four = Boot.evaluateGate(Object.assign({}, FULL_CAPS, { maxTouchPoints: 2 }));
    t.ok(four.degraded.includes('touch4'), 'two touch points is fewer than four');
    const touchOk = Boot.evaluateGate(Object.assign({}, FULL_CAPS, { maxTouchPoints: 5 }));
    t.ok(!touchOk.degraded.includes('touch4'));
  });

  t.test('UT-29-03 gate hard rows', () => {
    const audio = Boot.evaluateGate(Object.assign({}, FULL_CAPS, { audioContext: false }));
    t.eq(audio.hard.length, 1);
    t.eq(audio.hard[0].id, 'audio');
    t.eq(audio.hard[0].code, 'E-CAP-001');
    t.eq(audio.hard[0].reason, 'This browser has no Web Audio support, so nothing could play.');
    const canvas = Boot.evaluateGate(Object.assign({}, FULL_CAPS, { canvas2d: false }));
    t.eq(canvas.hard[0].code, 'E-CAP-002');
    t.eq(canvas.hard[0].reason, 'This browser cannot draw graphics.');
    const frames = Boot.evaluateGate(Object.assign({}, FULL_CAPS, { raf: false }));
    t.eq(frames.hard[0].code, 'E-CAP-003');
    t.eq(frames.hard[0].reason, 'This browser is missing animation support.');
    t.ok(Object.isFrozen(Boot.GATE), 'the gate table is frozen');
  });

  t.test('UT-29-04 missing module is fatal', () => {
    Core.ErrorReporter._resetForTests();
    const registered = ['Core', 'UI', 'Boot'];
    t.eq(Boot._checkModules(registered, ['Core', 'UI']), null, 'nothing missing');
    t.eq(Core.ErrorReporter.records().length, 0);
    t.eq(Boot._checkModules(registered, ['Core', 'UI', 'Dance']), 'Dance');
    const records = Core.ErrorReporter.records();
    t.eq(records.length, 1);
    t.eq(records[0].code, 'E-GEN-001');
    t.eq(records[0].class, 'reload');
    t.eq(records[0].context.module, 'Dance');
    const shown = document.getElementById('fatal-text').textContent;
    t.ok(shown.includes('A part of the game failed to load: Dance. Reload the page.'), shown);
  });

  t.test('UT-29-05 storage modes reach the menu notice', async () => {
    const { modules, enterCalls } = fakeModules();
    const run = await Boot._runForTests({ modules });
    t.eq(run.result.ok, true);
    t.eq(run.stages.length, STAGE_COUNT);
    t.eq(run.stages[STAGE_COUNT - 1].stage, 'B16');
    t.eq(enterCalls.length, 1);
    t.eq(enterCalls[0].mode, 'menu');
    t.eq(enterCalls[0].params.screen, 'SCR-MainMenu');
    t.eq(enterCalls[0].params.notice, MEMORY_NOTICE);
    t.ok(run.gate.degraded.includes('localStorage'), 'the storage rows follow the B5 probe');
    t.ok(run.gate.degraded.includes('indexedDB'));
  });

  // Partial until T04.01: the stand-in below replaces the real Audio.init of M-05.
  t.test('UT-29-06 audio init failure (partial until T04.01)', async () => {
    const audio = { init() { throw new Error('the AudioContext constructor failed'); } };
    const { modules, enterCalls } = fakeModules({ Audio: audio });
    Core.ErrorReporter._resetForTests();
    const run = await Boot._runForTests({ modules });
    t.eq(run.result.ok, false);
    t.eq(run.result.code, 'E-AUD-001');
    const last = run.stages[run.stages.length - 1];
    t.eq(last.stage, 'B7');
    t.eq(last.ok, false);
    t.eq(enterCalls.length, 0, 'boot stopped before the menu');
    const record = Core.ErrorReporter.records().find((item) => item.code === 'E-AUD-001');
    t.ok(record, 'E-AUD-001 was reported');
    t.eq(record.class, 'reload');
  });

  t.test('UT-29-06b audio init failure with the real engine: #fatal shows E-AUD-001 (T04.01)', async () => {
    const engine = FLM.Audio.createEngine({ bus: new Core.Emitter(),
      contextFactory: () => { throw new Error('the AudioContext constructor failed'); } });
    const { modules, enterCalls } = fakeModules({ Audio: engine });
    Core.ErrorReporter._resetForTests();
    const run = await Boot._runForTests({ modules });
    t.eq(run.result.ok, false);
    t.eq(run.result.code, 'E-AUD-001');
    t.eq(run.stages[run.stages.length - 1].stage, 'B7');
    t.eq(enterCalls.length, 0, 'boot stopped before the menu');
    const records = Core.ErrorReporter.records().filter((item) => item.code === 'E-AUD-001');
    t.ok(records.length > 0 && records.every((item) => item.class === 'reload'), 'reported with the reload class');
    const panel = window.document.getElementById('fatal');
    t.ok(panel && panel.classList.contains('show'), '#fatal is shown');
    t.ok(window.document.getElementById('fatal-text').textContent.includes(Core.Text.get('E-AUD-001')));
    t.eq(engine.state(), 'none');
    engine.close();
  });

  t.test('UT-29-07 errors before ready escalate', () => {
    const escalated = [];
    Core.bus.on('error', (record) => {
      if (record.context && record.context.escalatedBy === 'boot') escalated.push(record);
    }, t.owner);
    Core.ErrorReporter._resetForTests();
    try {
      Boot._simulatePhase('booting');
      Core.ErrorReporter.report('E-INP-003', null, { module: 'Input' });
      t.eq(escalated.length, 1, 'escalated once while booting');
      t.eq(escalated[0].class, 'reload');
      t.eq(escalated[0].code, 'E-INP-003');
      Boot._simulatePhase('ready');
      Core.ErrorReporter.report('E-INP-004', null, { module: 'Input', key: 'KeyA', action: 'lane 1' });
      t.eq(escalated.length, 1, 'no escalation after ready');
    } finally {
      Boot._simulatePhase('ready');
    }
  });

  t.test('UT-29-08 landing branch', async () => {
    const first = Boot.landing({ onboarding: { firstLaunchDone: false } }, { test: false });
    t.eq(first.screen, 'SCR-FirstLaunch');
    t.eq(first.mode, 'menu');
    t.eq(first.banner, false);
    const audio = { isUnlocked: () => false };
    await withFake('Audio', audio, () => {
      const returning = Boot.landing({ onboarding: { firstLaunchDone: true } }, { test: false });
      t.eq(returning.screen, 'SCR-MainMenu');
      t.eq(returning.banner, true, 'the banner shows while audio is locked');
      const testMode = Boot.landing({ onboarding: { firstLaunchDone: false } }, { test: true });
      t.eq(testMode.screen, 'SCR-MainMenu');
      t.eq(testMode.banner, false);
    });
    await withFake('Audio', { isUnlocked: () => true }, () => {
      t.eq(Boot.landing({ onboarding: { firstLaunchDone: true } }, { test: false }).banner, false);
    });
  });

  // Partial until T04.01: the banner is hidden by M-27 (T01.11) and the real Audio.unlock arrives with M-05.
  t.test('UT-29-09 one-shot unlock gesture (partial until T04.01)', async () => {
    const unlock = t.fakes.spy();
    const audio = { isUnlocked: () => false, unlock };
    await withFake('Audio', audio, () => {
      const listenersBefore = Core.dom.count();
      const remove = Boot._installUnlockGesture();
      try {
        t.eq(Core.dom.count(), listenersBefore + 2, 'one pointer and one key listener');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab' }));
        t.eq(unlock.count, 0, 'Tab is ignored');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft' }));
        t.eq(unlock.count, 0, 'a modifier alone is ignored');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }));
        t.eq(unlock.count, 1, 'KeyA unlocks once');
        Core.bus.emit('audio.unlocked', { audioTime: 0, sampleRate: 48000, latencyMs: 0, attempts: 1 });
        t.eq(Core.dom.count(), listenersBefore, 'both listeners are removed after audio.unlocked');
        document.getElementById('overlay').dispatchEvent(new Event('pointerdown'));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB' }));
        t.eq(unlock.count, 1, 'no further unlock attempts');
      } finally {
        remove();
      }
    });
  });

  t.test('UT-29-09b one-shot unlock gesture with the real engine (T04.01)', async () => {
    const fake = t.fakes.fakeAudioContext();
    const resume = t.fakes.spy(() => {
      fake.setState('running');
      return Promise.resolve();
    });
    fake.overrides.resume = resume;
    const engine = FLM.Audio.createEngine({ context: fake.context, mobile: false });
    const flush = async () => {
      for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    };
    try {
      await withFake('Audio', engine, async () => {
        const listenersBefore = Core.dom.count();
        const remove = Boot._installUnlockGesture();
        try {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab' }));
          t.eq(resume.count, 0, 'Tab is ignored');
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }));
          t.eq(resume.count, 1, 'resume() ran synchronously inside the key handler (R-B21.2-02)');
          await flush();
          t.eq(engine.isUnlocked(), true);
          t.eq(Core.dom.count(), listenersBefore, 'both listeners are removed after audio.unlocked');
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB' }));
          t.eq(resume.count, 1, 'no further unlock attempts');
        } finally {
          remove();
        }
      });
    } finally {
      engine.close();
      FLM.Input.resampleAnchor();            // the anchor read the stand-in context while it was FLM.Audio
    }
  });

  t.test('UT-29-10 debug surface and fault gating', async () => {
    const debug = FLM.debug;
    const wasEnabled = debug.enabled;
    const debugInject = t.fakes.spy(() => true);
    try {
      debug.enabled = false;
      await withFake('Render', { debugInject }, () => {
        t.eq(debug.inject('render.contextLoss'), false, 'disabled');
        t.eq(debugInject.count, 0);
        debug.enabled = true;
        t.eq(debug.inject('render.contextLoss', { restoreAfterMs: 10 }), true);
        t.eq(debugInject.count, 1);
        t.eq(debugInject.calls[0].args[0], 'render.contextLoss');
        t.eq(debug.inject('bogus.fault'), false, 'unknown prefix');
        debug.clear('render.contextLoss');
      });
      t.eq(debug.inject('storage.quota', { target: 'both' }), true, 'a module without debugInject uses the registry');
      t.ok(Core.Faults.list().some((fault) => fault.name === 'storage.quota'));
      debug.clear('storage.quota');
      t.eq(Core.Faults.list().length, 0);
    } finally {
      debug.enabled = wasEnabled;
      Core.Faults.clearAll();
    }
  });

  t.test('UT-29-11 public surface keys', () => {
    const allowed = Core.modules().map((item) => item.name)
      .concat(['VERSION', 'BUILD', 'RELAY_URL', 'diagnostics', 'debug', 'selfTestReady', 'selfTest']);
    Object.keys(FLM).forEach((key) => t.ok(allowed.includes(key), 'unexpected global member FLM.' + key));
    t.eq(typeof FLM.diagnostics, 'function');
    t.eq(typeof FLM.selfTest, 'function', 'the test build has selfTest');
    t.eq(typeof FLM.selfTestReady, 'boolean');
    t.deepEq(Object.keys(FLM.debug).sort(),
      ['clear', 'counters', 'enabled', 'inject', 'log', 'showStats', 'tier']);
    t.eq(FLM.debug.enabled, true, 'enabled in the test build');
    t.ok(Array.isArray(FLM.debug.log('info')));
    t.eq(typeof FLM.debug.counters(), 'object');
    const report = FLM.diagnostics();
    t.eq(report.format, 'flm-diagnostics');
    t.ok(Array.isArray(report.providers.boot.stages), 'the Boot provider is registered');
    t.eq(typeof Boot.installSurface, 'function');
  });

  t.test('UT-29-12 boot stage order', async () => {
    const result = await Boot.ready();
    t.eq(result.ok, true, 'boot reached the menu: ' + JSON.stringify(result));
    const stages = Boot.stage();
    const expectedNames = Array.from({ length: STAGE_COUNT }, (unused, index) => 'B' + (index + 1));
    t.deepEq(stages.map((record) => record.stage), expectedNames);
    stages.forEach((record) => t.eq(record.ok, true, record.stage + ' ok'));
    const isTestMode = new URLSearchParams(window.location.search).has('test');
    if (isTestMode) t.eq(stages[14].skipped, true, 'B15 is skipped in test mode');
    stages.forEach((record, index) => {
      if (index > 0) t.ok(record.ms >= stages[index - 1].ms, record.stage + ' is not earlier than the step before');
    });
    const sum = stages.reduce((total, record) => total + record.stepMs, 0);
    t.near(sum, result.ms, MS_TOLERANCE, 'the step durations add up to the boot.ready time');
    t.ok(FLM.selfTestReady === true, 'the runner flag is set');
  });
});
})();
