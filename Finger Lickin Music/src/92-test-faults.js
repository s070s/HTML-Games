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
});
})();
