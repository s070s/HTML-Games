// 92-test-faults.js - FI fault-injection tests (Part 12.5). First row: FI-037 (T01.05). Later entries append rows.
(function () {
'use strict';
const FLM = window.FLM;

FLM.SelfTest.group('faults', (t) => {
  t.test('FI-037 bus listener throws', () => {
    const core = FLM.Core;
    if (!core.Emitter || !core.Faults) t.skip('Core.Emitter or Core.Faults is not available');
    const emitter = new core.Emitter();      // a private bus: no other module hears the armed listener
    const calls = [];
    emitter.on('error', () => calls.push('first'), t.owner);
    emitter.on('error', () => calls.push('second'), t.owner);
    emitter.on('error', () => calls.push('third'), t.owner);
    const moduleCount = core.modules().length;

    // The fault makes the next listener call of the 'error' topic throw; the first listener is the one hit.
    core.Faults.set('error.throw', { origin: 'listener', count: 1 });
    try {
      emitter.emit('error', { code: 'E-TEST-000', origin: 'listener', count: 1 });
    } finally {
      core.Faults.clear('error.throw');
    }

    t.deepEq(calls, ['second', 'third']);
    t.eq(core.Faults.active('error.throw'), null);
    t.eq(core.modules().length, moduleCount);
    emitter.removeOwner(t.owner);
  });

  // T04.01: FI-008 on a fresh engine with an injected context factory (the app engine is already running).
  t.test('FI-008 audio initialization fails', () => {
    const core = FLM.Core;
    const settingsBefore = JSON.stringify(FLM.Screens.Settings.all());
    const stand = t.fakes.fakeAudioContext();
    const factory = t.fakes.spy(() => stand.context);
    const engine = FLM.Audio.createEngine({ contextFactory: factory, bus: new core.Emitter(), mobile: false });
    core.ErrorReporter._resetForTests();
    core.Faults.set('audio.fail', { phase: 'init' });
    try {
      t.throws(() => engine.init(), 'E-AUD-001');
      t.eq(engine.state(), 'none', 'no context');
      const panel = window.document.getElementById('fatal');
      t.ok(panel && panel.classList.contains('show'), '#fatal is shown');
      const text = window.document.getElementById('fatal-text');
      t.ok(text.textContent.includes(core.Text.get('E-AUD-001')), 'with the text of Part 10.6.3');
      t.eq(text.children.length, 0, 'the text went in as text, not as markup');
      t.eq(core.Faults.active('audio.fail'), null, 'the fault was used up');
      engine.init();
      engine.init();
      t.eq(factory.count, 1, 'a second init does not create a second context');
      t.eq(engine.ctxCount(), 1);
      t.eq(JSON.stringify(FLM.Screens.Settings.all()), settingsBefore, 'settings untouched');
    } finally {
      core.Faults.clearAll();
      core.ErrorReporter._resetForTests();
      engine.close();
    }
  });
});
})();
