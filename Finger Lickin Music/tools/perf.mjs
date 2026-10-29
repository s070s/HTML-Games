// tools/perf.mjs - runs the performance scenarios of Part 9.7 and compares them with the budgets of Part 9.1.
// Spec: Part 3.5. Node built-ins only. Scenarios so far: build-size (PT-001), boot-to-menu (PT-002) and input-latency
// (PT-009, input part; the tool sends the key presses), chord-stress-1000 (PT-012, in page); later entries add scenarios to SCENARIOS and BUDGETS. Any other name is passed to the in-page harness
// FLM.SelfTest.perf.run (test build) and its metrics are reported as info until a budget is added here.
//
//   node tools/perf.mjs [--scenario <name>]... [--all] [--tier <High|Balanced|Low|Abstract>] [--repeat <n>]
//                       [--json <path>] [--headed] [--file <html>] [--timeout <seconds>]
//
// Exit codes: 0 every budgeted metric passes, 1 a budget failed, 2 watchdog timeout, 3 runner error.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeAllBrowsersSync, delay, launchBrowser } from './lib-cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEST_FILE = 'FingerLickinMusic.test.html';
const SHIPPED_FILE = 'FingerLickinMusic.html';
const TIERS = ['High', 'Balanced', 'Low', 'Abstract'];
const DESKTOP = { width: 1280, height: 720, deviceScaleFactor: 1, hasTouch: false };
const READY_TIMEOUT_MS = 30000;
const COLD_LOADS = 5;                      // Part 9.7.3: boot-to-menu uses 5 cold loads
const KEY_PRESSES = 100;                   // Part 9.7.3: input-latency sends this many lane key presses
const KEY_SPACING_MIN_MS = 50;             // random spacing between presses, seeded
const KEY_SPACING_MAX_MS = 150;
const KEY_HOLD_MS = 20;                    // how long a key stays down
const KEY_SEED = 0xF1A9;
const KEY_READY_TIMEOUT_MS = 20000;
const LANE_KEYS = [{ code: 'KeyA', key: 'a', keyCode: 65 }, { code: 'KeyS', key: 's', keyCode: 83 },
  { code: 'KeyK', key: 'k', keyCode: 75 }, { code: 'KeyL', key: 'l', keyCode: 76 }];
const SHIP_TARGET_BYTES = 1572864;         // 1.5 MB target (a warning, a gate only at Phase 16)
const SHIP_LIMIT_BYTES = 2621440;          // 2.5 MB hard limit (PT-001)
const MIN_WATCHDOG_SECONDS = 240;
const DEFAULT_PLANNED_SECONDS = 60;        // planned duration of a scenario this tool does not know yet
const CLOSE_GRACE_MS = 5000;
const BYTES_PER_MB = 1048576;
const USAGE = 'usage: node tools/perf.mjs [--scenario <name>]... [--all] [--tier <High|Balanced|Low|Abstract>] '
  + '[--repeat <n>] [--json <path>] [--headed] [--file <html>] [--timeout <seconds>]';
const PLANNED_SECONDS = { 'build-size': 1, 'boot-to-menu': 10, 'input-latency': 25, 'chord-stress-1000': 20, 'content-expand': 5, 'playback-dense': 200, 'loop-drift-short': 65 };
const DEFAULT_SET = ['build-size', 'boot-to-menu', 'chord-stress-1000', 'content-expand', 'playback-dense',
  'loop-drift-short'];

// Budgets of Part 9.7.7 (desktop column). A metric without an entry is reported as info.
const BUDGETS = {
  'build-size': { shipBytes: 2621440 },
  'boot-to-menu': { menuMs: 1500, menuMsMax: 2250, phaseAMs: 600, bootMs: 400, capsMs: 20 },
  'input-latency': { inputProcP95Ms: 4, inputProcMaxMs: 16.7 },
  // Part 9.6.4 and rows 21 and 22 (desktop cap 64); accountError is |started + dropped - 16000|; audioNodesMax = cap x 11 nodes (Part 6.6.6; stolen voices that are fading out are counted apart)
  'chord-stress-1000': { voicesMax: 64, accountError: 0, tickWorkMaxMs: 4, lateEvents: 0, activeVoicesAfterStop: 0,
    audioNodesExcess: 0, audioNodesMax: 704, errors: 0 },
  'content-expand': { expandMaxMs: 50 },
  // PT-004 (Part 9.7.7): a number is a maximum, {min, max} a range
  'playback-dense': { lookaheadMaxMs: 125, tickIntervalP50Ms: { min: 23, max: 27 }, tickIntervalP95Ms: 50, tickIntervalMaxMs: 95,
    tickWorkMaxMs: 4, schedErrorMaxMs: 1.0, lateEvents: 0, voicesMax: 64 },
  'loop-drift-short': { driftMs: 2.0 }
};

const BOOT_READY_EXPRESSION = "!!(window.FLM && window.FLM.Boot && typeof window.FLM.Boot.stage === 'function'"
  + " && window.FLM.Boot.stage().some((record) => record.stage === 'B16'))";

let activeBrowser = null;

function say(text) {
  process.stdout.write(text + '\n');
}

function complain(text) {
  process.stderr.write(text + '\n');
}

function stop(code, message) {
  complain(message);
  process.exit(code);
}

// ---------------------------------------------------------------- command line (3.5)

function parseArguments(argv) {
  const options = { scenarios: [], all: false, tier: 'Balanced', repeat: 1, json: null, headed: false, file: null, timeoutSeconds: null };
  const valueFlags = {
    '--scenario': (value) => options.scenarios.push(value), '--tier': (value) => { options.tier = value; },
    '--repeat': (value) => { options.repeat = Number(value); }, '--json': (value) => { options.json = value; },
    '--file': (value) => { options.file = value; }, '--timeout': (value) => { options.timeoutSeconds = Number(value); }
  };
  const switchFlags = { '--all': () => { options.all = true; }, '--headed': () => { options.headed = true; } };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (valueFlags[flag]) {
      if (index + 1 >= argv.length) stop(3, 'missing value for ' + flag + '\n' + USAGE);
      valueFlags[flag](argv[index + 1]);
      index += 1;
    } else if (switchFlags[flag]) switchFlags[flag]();
    else stop(3, 'unknown option ' + flag + '\n' + USAGE);
  }
  if (!TIERS.includes(options.tier)) stop(3, '--tier must be one of ' + TIERS.join(', ') + '\n' + USAGE);
  if (!Number.isInteger(options.repeat) || options.repeat < 1) stop(3, '--repeat needs a whole number of at least 1\n' + USAGE);
  if (options.timeoutSeconds !== null && !(options.timeoutSeconds > 0)) stop(3, '--timeout needs a positive number of seconds\n' + USAGE);
  return options;
}

// ---------------------------------------------------------------- exit and watchdog

async function finish(code) {
  if (activeBrowser) await Promise.race([activeBrowser.close().catch(() => {}), delay(CLOSE_GRACE_MS)]);
  closeAllBrowsersSync();
  process.exit(code);
}

/** Part 9.7.1: max(240 s, 1.5 x planned duration x repeat + 120 s) unless --timeout is given. */
function watchdogSeconds(options, names) {
  if (options.timeoutSeconds) return options.timeoutSeconds;
  const planned = names.reduce((sum, name) => sum + (PLANNED_SECONDS[name] || DEFAULT_PLANNED_SECONDS), 0);
  return Math.max(MIN_WATCHDOG_SECONDS, 1.5 * planned * options.repeat + 120);
}

function startWatchdog(seconds) {
  setTimeout(() => {
    complain('TIMEOUT after ' + seconds + ' s');
    closeAllBrowsersSync();
    process.exit(2);
  }, seconds * 1000);
}

function resolveFile(options, name) {
  const path = options.file ? resolve(process.cwd(), options.file) : join(ROOT, name);
  if (!existsSync(path)) stop(3, 'missing ' + path + ': run node tools/build.mjs first');
  return path;
}

// ---------------------------------------------------------------- statistics

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

// ---------------------------------------------------------------- scenarios

function emptyResult(name) {
  return { name, durationMs: 0, metrics: {}, samples: {}, notes: [] };
}

/** PT-001: size of the shipped file including the BOM. */
async function runBuildSize(context) {
  const result = emptyResult('build-size');
  const bytes = statSync(resolveFile(context.options, SHIPPED_FILE)).size;
  result.metrics.shipBytes = bytes;
  result.metrics.shipMb = round(bytes / BYTES_PER_MB, 2);
  if (bytes > SHIP_TARGET_BYTES) result.notes.push('above the 1.5 MB target of ' + SHIP_TARGET_BYTES + ' bytes (a gate only at Phase 16)');
  return result;
}

function recordMs(records, stage) {
  const record = records.find((item) => item.stage === stage);
  return record ? Number(record.ms) : NaN;
}

async function coldLoad(file, tier) {
  const page = await activeBrowser.newPage(DESKTOP);
  try {
    await page.goto(pathToFileURL(file).href + '?tier=' + tier);
    await page.waitFor(BOOT_READY_EXPRESSION, READY_TIMEOUT_MS);
    const records = await page.evaluate('window.FLM.Boot.stage()');
    const menuMs = recordMs(records, 'B16');
    const phaseAMs = recordMs(records, 'B1');
    return { menuMs, phaseAMs, bootMs: menuMs - phaseAMs, capsMs: recordMs(records, 'B3') - recordMs(records, 'B2'), errors: page.pageErrors };
  } finally {
    await page.close();
  }
}

/** PT-002: five cold loads of the shipped file, each in a new browser context, read from FLM.Boot.stage(). */
async function runBootToMenu(context) {
  const result = emptyResult('boot-to-menu');
  const file = resolveFile(context.options, SHIPPED_FILE);
  const loads = [];
  for (let index = 0; index < COLD_LOADS * context.options.repeat; index += 1) loads.push(await coldLoad(file, context.options.tier));
  const column = (key) => loads.map((load) => load[key]);
  result.metrics.menuMs = round(median(column('menuMs')));
  result.metrics.menuMsMax = round(Math.max(...column('menuMs')));
  result.metrics.phaseAMs = round(median(column('phaseAMs')));
  result.metrics.bootMs = round(median(column('bootMs')));
  result.metrics.capsMs = round(median(column('capsMs')));
  result.samples.menuMs = loads.length;
  loads.forEach((load) => load.errors.forEach((text) => result.notes.push('page error: ' + text)));
  result.notes.push('menuMs is the B16 record ms; phaseAMs the B1 record ms; capsMs the B3 minus B2 record ms');
  return result;
}

/**
 * Any other scenario runs in the page: FLM.SelfTest.perf.run in the test build (Part 9.7.2). With --repeat n it runs n
 * times, each in a fresh page: the metrics are the median of the runs, and every run is listed in a note, so a result
 * that passes only on the quiet runs of a busy machine is visible (result.runs holds the metrics of each run).
 */
async function runHarnessScenario(context, name) {
  const runs = [];
  for (let index = 0; index < context.options.repeat; index += 1) runs.push(await runHarnessOnce(context, name));
  if (runs.length === 1) return runs[0];
  const merged = Object.assign({}, runs[0], { metrics: {}, samples: Object.assign({}, runs[0].samples), notes: [],
    runs: runs.map((run) => run.metrics), durationMs: runs.reduce((sum, run) => sum + run.durationMs, 0) });
  Object.keys(runs[0].metrics).forEach((metric) => {
    const values = runs.map((run) => run.metrics[metric]);
    const worst = WORST_RUN_METRICS.has(metric);
    const finite = values.every((value) => Number.isFinite(value));
    merged.metrics[metric] = !finite ? values[0] : worst ? Math.max(...values) : round(median(values), 2);
    if (runs.every((run) => run.samples[metric] !== undefined)) merged.samples[metric] = Math.min(...runs.map((run) => run.samples[metric]));
    if (BUDGETS[name] && BUDGETS[name][metric] !== undefined) {
      merged.notes.push('runs of ' + metric + ': ' + values.join(' / ') + ' (budget ' + JSON.stringify(BUDGETS[name][metric]) +
        (worst ? ', worst run judged)' : ', median judged)'));
    }
  });
  runs.forEach((run, index) => run.notes.forEach((text) => merged.notes.push('run ' + (index + 1) + ': ' + text)));
  return merged;
}

async function runHarnessOnce(context, name) {
  const file = resolveFile(context.options, TEST_FILE);
  const page = await activeBrowser.newPage(DESKTOP);
  try {
    await page.goto(pathToFileURL(file).href + '?test&tier=' + context.options.tier + '&perf');
    await page.waitFor('!!(window.FLM && window.FLM.selfTestReady === true)', READY_TIMEOUT_MS);
    const heapBefore = await page.evaluate('performance.memory ? performance.memory.usedJSHeapSize : null');
    const result = await page.evaluate('window.FLM.SelfTest.perf.run(' + JSON.stringify(name) + ', {})');
    const heapAfter = await page.evaluate('performance.memory ? performance.memory.usedJSHeapSize : null');
    if (heapBefore !== null && heapAfter !== null) result.metrics.heapDeltaMb = round((heapAfter - heapBefore) / BYTES_PER_MB, 2);
    page.pageErrors.forEach((text) => result.notes.push('page error: ' + text));
    return result;
  } finally {
    await page.close();
  }
}

/** Seeded generator (mulberry32): the same press spacing in every run. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** One trusted key event: through the DevTools client when the page has send(), else through Playwright. */
function sendKey(page, spec, down) {
  if (typeof page.send === 'function') {
    return page.send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code: spec.code, key: spec.key,
      windowsVirtualKeyCode: spec.keyCode });
  }
  return down ? page.page.keyboard.down(spec.code) : page.page.keyboard.up(spec.code);
}

async function sendKeyPresses(page, count) {
  const random = seededRandom(KEY_SEED);
  for (let index = 0; index < count; index += 1) {
    const spec = LANE_KEYS[Math.floor(random() * LANE_KEYS.length)];
    const spacing = KEY_SPACING_MIN_MS + random() * (KEY_SPACING_MAX_MS - KEY_SPACING_MIN_MS);
    await sendKey(page, spec, true);
    await delay(KEY_HOLD_MS);
    await sendKey(page, spec, false);
    await delay(Math.max(0, spacing - KEY_HOLD_MS));
  }
}

/**
 * PT-009 (input part): the page enters the instrument mode on a test chart and counts the presses; this tool sends
 * 100 trusted key presses at seeded 50 to 150 ms spacing once the song plays. The Free Play phase and
 * liveSchedMaxMs wait for the audio phase (Phase 06).
 */
async function runInputLatency(context) {
  const file = resolveFile(context.options, TEST_FILE);
  const page = await activeBrowser.newPage(DESKTOP);
  try {
    await page.goto(pathToFileURL(file).href + '?test&tier=' + context.options.tier + '&perf');
    await page.waitFor('!!(window.FLM && window.FLM.selfTestReady === true)', READY_TIMEOUT_MS);
    const running = page.evaluate('window.FLM.SelfTest.perf.run("input-latency", { assisted: true, presses: '
      + KEY_PRESSES + ' })');
    running.catch(() => {});                 // a failure is reported below, after the presses
    await page.waitFor("window.FLM.Modes.current().mode === 'instrument' && window.FLM.Transport.main.state() === "
      + "'playing'", KEY_READY_TIMEOUT_MS);
    if (typeof page.send === 'function') await page.send('Page.bringToFront');
    await sendKeyPresses(page, KEY_PRESSES);
    const result = await running;
    page.pageErrors.forEach((text) => result.notes.push('page error: ' + text));
    Object.keys(BUDGETS['input-latency']).forEach((metric) => {
      if (result.metrics[metric] === undefined || result.samples[metric] < KEY_PRESSES) result.metrics[metric] = NaN;
    });
    return result;
  } finally {
    await page.close();
  }
}

// Part 9.1.1 rule 8 and the rows of 9.1.2: fewer samples than this make the metric invalid, which fails a gated row.
const MINIMUM_SAMPLES = {
  'playback-dense': { lookaheadMaxMs: 5000, schedErrorMaxMs: 5000, tickIntervalP50Ms: 1000, tickIntervalP95Ms: 1000,
    tickIntervalMaxMs: 1000, tickWorkMaxMs: 1000 }
};

// Metrics that count failures: with --repeat they are judged by the worst run, never by the median (a bad run must show).
const WORST_RUN_METRICS = new Set(['accountError', 'errors', 'activeVoicesAfterStop', 'audioNodesExcess', 'voicesMax', 'lateEvents']);

const SCENARIOS = { 'build-size': runBuildSize, 'boot-to-menu': runBootToMenu, 'input-latency': runInputLatency };

// ---------------------------------------------------------------- judging and output

function judge(result) {
  const budgets = BUDGETS[result.name] || {};
  result.budgets = {};
  result.results = {};
  Object.keys(result.metrics).forEach((metric) => {
    const value = result.metrics[metric];
    if (budgets[metric] === undefined) result.results[metric] = 'info';
    else {
      const budget = budgets[metric];
      const limit = typeof budget === 'number' ? { max: budget } : budget;
      const minimum = (MINIMUM_SAMPLES[result.name] || {})[metric];
      result.budgets[metric] = typeof budget === 'number' ? budget : budget.min + '-' + budget.max;
      if (!Number.isFinite(value)) result.results[metric] = 'invalid';
      else if (minimum !== undefined && !(result.samples[metric] >= minimum)) {
        result.results[metric] = 'invalid';
        result.notes.push(metric + ' has ' + result.samples[metric] + ' samples, the row needs ' + minimum + ': invalid');
      } else if (value > limit.max || (limit.min !== undefined && value < limit.min)) result.results[metric] = 'FAIL';
      else result.results[metric] = 'pass';
    }
  });
  const unknown = result.notes.includes('unknown scenario');
  result.pass = !unknown && !Object.values(result.results).some((outcome) => outcome === 'FAIL' || outcome === 'invalid');
  return result;
}

function printResults(results) {
  say('SCENARIO       | METRIC           | VALUE      | BUDGET     | RESULT');
  results.forEach((result) => {
    Object.keys(result.metrics).forEach((metric) => {
      const limit = result.budgets[metric];
      const budget = limit === undefined ? '-' : typeof limit === 'string' ? limit : '<= ' + limit;
      say(result.name.padEnd(14) + ' | ' + metric.padEnd(16) + ' | ' + String(result.metrics[metric]).padEnd(10)
        + ' | ' + budget.padEnd(10) + ' | ' + result.results[metric]);
    });
    result.notes.forEach((note) => say(result.name + ' note: ' + note));
  });
}

function buildInfoOf(file) {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const match = /Finger Lickin Music (\S+) built (\S+) (\S+) (\S+)/.exec(text);
  return match ? { version: match[1], build: match[1] + ' ' + match[2] + ' ' + match[4] } : { version: 'unknown', build: 'unknown' };
}

async function describeBrowser() {
  const page = await activeBrowser.newPage(DESKTOP);
  const userAgent = await page.evaluate('navigator.userAgent');
  await page.close();
  return { userAgent, engine: activeBrowser.kind + ' ' + activeBrowser.version };
}

function writeJson(options, results, startedAt, browserInfo) {
  const info = buildInfoOf(options.file ? resolve(process.cwd(), options.file) : join(ROOT, SHIPPED_FILE));
  const document = {
    version: info.version, build: info.build, environment: 'headless-swiftshader', userAgent: browserInfo.userAgent,
    browser: browserInfo.engine, tier: options.tier, repeat: options.repeat,
    set: options.scenarios.length > 0 ? 'custom' : 'default', startedAt, scenarios: results,
    pass: results.every((result) => result.pass)
  };
  writeFileSync(resolve(options.json), JSON.stringify(document, null, 2) + '\n');
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const names = options.scenarios.length > 0 ? options.scenarios : DEFAULT_SET;
  startWatchdog(watchdogSeconds(options, names));
  try {
    activeBrowser = await launchBrowser({ headed: options.headed });
  } catch (error) {
    stop(3, 'runner error: ' + error.message + '. Install Playwright or set FLM_CHROMIUM to a Chrome or Chromium executable.');
  }
  const startedAt = new Date().toISOString();
  const context = { options };
  const results = [];
  for (const name of names) {
    const started = Date.now();
    const run = SCENARIOS[name] || ((ctx) => runHarnessScenario(ctx, name));
    const result = await run(context);
    if (result.durationMs === 0) result.durationMs = Date.now() - started;
    results.push(judge(result));
  }
  printResults(results);
  const browserInfo = await describeBrowser();
  if (options.json) writeJson(options, results, startedAt, browserInfo);
  const pass = results.every((result) => result.pass);
  say('PERF ' + (pass ? 'PASS' : 'FAIL') + ' ' + results.length + ' scenario(s), tier ' + options.tier + ', repeat ' + options.repeat);
  await finish(pass ? 0 : 1);
}

main().catch((error) => {
  complain('runner error: ' + (error && error.message ? error.message : error));
  finish(3);
});
