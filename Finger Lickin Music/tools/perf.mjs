// tools/perf.mjs - runs the performance scenarios of Part 9.7 and compares them with the budgets of Part 9.1.
// Spec: Part 3.5. Node built-ins only. Scenarios so far: build-size (PT-001) and boot-to-menu (PT-002);
// later entries add scenarios to SCENARIOS and BUDGETS. Any other name is passed to the in-page harness
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
const SHIP_TARGET_BYTES = 1572864;         // 1.5 MB target (a warning, a gate only at Phase 16)
const SHIP_LIMIT_BYTES = 2621440;          // 2.5 MB hard limit (PT-001)
const MIN_WATCHDOG_SECONDS = 240;
const DEFAULT_PLANNED_SECONDS = 60;        // planned duration of a scenario this tool does not know yet
const CLOSE_GRACE_MS = 5000;
const BYTES_PER_MB = 1048576;
const USAGE = 'usage: node tools/perf.mjs [--scenario <name>]... [--all] [--tier <High|Balanced|Low|Abstract>] '
  + '[--repeat <n>] [--json <path>] [--headed] [--file <html>] [--timeout <seconds>]';
const PLANNED_SECONDS = { 'build-size': 1, 'boot-to-menu': 10 };
const DEFAULT_SET = ['build-size', 'boot-to-menu'];

// Budgets of Part 9.7.7 (desktop column). A metric without an entry is reported as info.
const BUDGETS = {
  'build-size': { shipBytes: 2621440 },
  'boot-to-menu': { menuMs: 1500, menuMsMax: 2250, phaseAMs: 600, bootMs: 400, capsMs: 20 }
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

/** Any other scenario runs in the page: FLM.SelfTest.perf.run in the test build (Part 9.7.2). */
async function runHarnessScenario(context, name) {
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

const SCENARIOS = { 'build-size': runBuildSize, 'boot-to-menu': runBootToMenu };

// ---------------------------------------------------------------- judging and output

function judge(result) {
  const budgets = BUDGETS[result.name] || {};
  result.budgets = {};
  result.results = {};
  Object.keys(result.metrics).forEach((metric) => {
    const value = result.metrics[metric];
    if (budgets[metric] === undefined) result.results[metric] = 'info';
    else {
      result.budgets[metric] = budgets[metric];
      if (!Number.isFinite(value)) result.results[metric] = 'invalid';
      else result.results[metric] = value <= budgets[metric] ? 'pass' : 'FAIL';
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
      const budget = result.budgets[metric] === undefined ? '-' : '<= ' + result.budgets[metric];
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
