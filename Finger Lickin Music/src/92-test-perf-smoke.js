// 92-test-perf-smoke.js - PT smoke checks (Part 12.6) and in-page performance scenarios (Part 9.7.2).
// First rows: PT-001 and PT-002 (T01.05). A smoke pass never stands in for the PT result of tools/perf.mjs.
// In-page scenarios are registered with FLM.SelfTest.perf.register by the entries that own them.
// T03.10 registers `input-latency` (PT-009, input part): the `instrument` mode on a test chart, key presses from the
// tool (trusted events) or, without a tool, synthesized ones; the Free Play phase and liveSchedMaxMs wait for Phase 06.
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

// ------------------------------------------------------------------------------------------ input-latency (PT-009)
const INPUT_SONG_NOTES = 60;               // a 31 s song: longer than the 100 presses of the tool take
const ASSISTED_PRESSES = 100;              // the tool sends these (Part 9.7.3)
const SYNTHESIZED_PRESSES = 20;            // without a tool the scenario sends these itself, each with a known tPerf
const SYNTHESIZED_SPACING_MS = 60;
const PRESS_POLL_MS = 50;
const PRESS_WAIT_LIMIT_MS = 60000;
const P95 = 0.95;
const LANE_CONTROL = /^lane[0-3]$/;
const SYNTHESIZED_KEYS = Object.freeze(['KeyA', 'KeyS', 'KeyK', 'KeyL']);
const ROUND_DIGITS = 100;

const roundTo = (value) => Math.round(value * ROUND_DIGITS) / ROUND_DIGITS;

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function wait(ms, owner) {
  return new Promise((resolve) => FLM.Core.timers.setTimeout(resolve, ms, owner));
}

/** Sends one lane press and release through Input.synthesize, with the stamp of this moment. */
function sendSynthesizedPress(index) {
  const code = SYNTHESIZED_KEYS[index % SYNTHESIZED_KEYS.length];
  FLM.Input.synthesize.key(code, true, FLM.Core.now());
  FLM.Input.synthesize.key(code, false, FLM.Core.now());
}

async function collectPresses(samples, wanted, assisted, owner) {
  const started = FLM.Core.now();
  let sent = 0;
  while (samples.length < wanted && FLM.Core.now() - started < PRESS_WAIT_LIMIT_MS) {
    if (!assisted && sent < wanted) {
      sendSynthesizedPress(sent);
      sent += 1;
    }
    await wait(assisted ? PRESS_POLL_MS : SYNTHESIZED_SPACING_MS, owner);
  }
}

/**
 * PT-009: processing time of a lane press = (performance.now() when input.event reaches the last listener) - tPerf.
 * options: {assisted: true when tools/perf.mjs sends the presses as trusted key events, presses: how many}.
 */
async function inputLatency(options) {
  const assisted = options.assisted === true;
  const defaultPresses = assisted ? ASSISTED_PRESSES : SYNTHESIZED_PRESSES;
  const wanted = Number.isFinite(options.presses) ? options.presses : defaultPresses;
  const owner = Symbol('perf-input-latency');
  const samples = [];
  const notes = [];
  const fixtures = FLM.SelfTest.fixtures;
  const entered = await FLM.Modes.enter('instrument', { song: fixtures.song(INPUT_SONG_NOTES),
    testChart: fixtures.chart(INPUT_SONG_NOTES, 'beginner'), countInBars: 0 });
  if (!entered.ok) throw new Error('the instrument mode did not start');
  FLM.Core.bus.on('input.event', (event) => {
    if (event.type === 'press' && LANE_CONTROL.test(event.control)) samples.push(FLM.Core.now() - event.tPerf);
  }, owner);
  await collectPresses(samples, wanted, assisted, owner);
  FLM.Core.bus.removeOwner(owner);
  const jitter = FLM.Input.anchor().spreadMs;
  await FLM.Modes.leave('user');
  const leaks = FLM.Modes.assertClean();
  if (leaks) notes.push('assertClean: ' + JSON.stringify(leaks));
  if (samples.length < wanted) notes.push('only ' + samples.length + ' of ' + wanted + ' presses arrived');
  const sorted = samples.slice().sort((a, b) => a - b);
  const metrics = sorted.length === 0 ? {} : { inputProcP95Ms: roundTo(percentile(sorted, P95)),
    inputProcMaxMs: roundTo(sorted[sorted.length - 1]), anchorJitterMs: roundTo(jitter) };
  return { metrics, samples: { inputProcP95Ms: sorted.length, inputProcMaxMs: sorted.length }, notes };
}

FLM.SelfTest.perf.register('input-latency', inputLatency);
})();
