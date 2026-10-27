// 92-test-perf-smoke.js - PT smoke checks (Part 12.6) and in-page performance scenarios (Part 9.7.2).
// First rows: PT-001 and PT-002 (T01.05). A smoke pass never stands in for the PT result of tools/perf.mjs.
// In-page scenarios are registered with FLM.SelfTest.perf.register by the entries that own them.
(function () {
'use strict';
const FLM = window.FLM;

// The shipped file is limited to 2,621,440 bytes (PT-001). The test build also carries the 9*-*.js files, so
// this gross-regression check allows room for them; tools/build.mjs enforces the exact shipped limit.
const TEST_BUILD_SCRIPT_LIMIT = 4194304;
const BOOT_STAGE_COUNT = 16;

function inlineScriptLength() {
  return Array.from(document.scripts)
    .filter((script) => !script.src)
    .reduce((sum, script) => sum + script.textContent.length, 0);
}

function expectedStageNames() {
  return Array.from({ length: BOOT_STAGE_COUNT }, (unused, index) => 'B' + (index + 1));
}

FLM.SelfTest.group('perf-smoke', (t) => {
  t.test('PT-001 build-size smoke', () => {
    const length = inlineScriptLength();
    t.within(length, 1, TEST_BUILD_SCRIPT_LIMIT, 'inline script length of the running page');
  });

  t.test('PT-002 boot-to-menu smoke', () => {
    if (!FLM.Boot || typeof FLM.Boot.stage !== 'function') t.skip('FLM.Boot is not built yet (T01.10)');
    const stages = FLM.Boot.stage();
    t.deepEq(stages.map((record) => record.stage), expectedStageNames());
  });
});
})();
