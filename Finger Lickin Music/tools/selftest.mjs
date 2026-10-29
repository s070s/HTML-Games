// tools/selftest.mjs - drives the in-page runner (M-31) in headless Chrome or Chromium. Spec: Part 3.4.
// Node built-ins only. Uses `playwright` when it resolves, else the built-in DevTools client (tools/lib-cdp.mjs).
//
//   node tools/selftest.mjs [--group <name>]... [--all] [--grep <substring>] [--slow] [--headed]
//                           [--json <path>] [--file <html>] [--smoke] [--timeout <seconds>] [--quiet]
//
// Exit codes: 0 all selected tests passed, 1 failed test or page error or no test ran or smoke failure,
// 2 watchdog timeout, 3 runner error (no browser, file missing, bad usage).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeAllBrowsersSync, delay, launchBrowser } from './lib-cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEST_FILE = 'FingerLickinMusic.test.html';
const SHIPPED_FILE = 'FingerLickinMusic.html';
const READY_TIMEOUT_MS = 30000;
const SMOKE_SETTLE_MS = 1000;
const WATCHDOG_SECONDS = 240;
const WATCHDOG_SLOW_SECONDS = 900;
const CLOSE_GRACE_MS = 5000;
const DESKTOP = { width: 1280, height: 720, deviceScaleFactor: 1, hasTouch: false };
const TOUCH = { width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true };
const TOUCH_GROUPS = ['input', 'ui', 'integration', 'faults'];
const CORPUS_GROUPS = ['files', 'integration', 'faults'];
const READY_EXPRESSION = '!!(window.FLM && window.FLM.selfTestReady === true)';
const SMOKE_READY_EXPRESSION = "!!(window.FLM && typeof window.FLM.diagnostics === 'function')";
const USAGE = 'usage: node tools/selftest.mjs [--group <name>]... [--all] [--grep <text>] [--slow] [--headed] '
  + '[--json <path>] [--file <html>] [--smoke] [--timeout <seconds>] [--quiet]';

let activeBrowser = null;

function say(text) {
  process.stdout.write(text + '\n');
}

function complain(text) {
  process.stderr.write(text + '\n');
}

// ---------------------------------------------------------------- command line (3.4.1)

function takeValue(argv, index, flag) {
  if (index + 1 >= argv.length) {
    complain('missing value for ' + flag + '\n' + USAGE);
    process.exit(3);
  }
  return argv[index + 1];
}

function parseArguments(argv) {
  const options = {
    groups: [], all: false, grep: '', slow: false, headed: false, json: null, file: null,
    smoke: false, timeoutSeconds: null, quiet: false
  };
  const valueFlags = {
    '--group': (value) => options.groups.push(value), '--grep': (value) => { options.grep = value; },
    '--json': (value) => { options.json = value; }, '--file': (value) => { options.file = value; },
    '--timeout': (value) => { options.timeoutSeconds = Number(value); }
  };
  const switchFlags = {
    '--all': () => { options.all = true; }, '--slow': () => { options.slow = true; }, '--headed': () => { options.headed = true; },
    '--smoke': () => { options.smoke = true; }, '--quiet': () => { options.quiet = true; }
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (valueFlags[flag]) {
      valueFlags[flag](takeValue(argv, index, flag));
      index += 1;
    } else if (switchFlags[flag]) switchFlags[flag]();
    else {
      complain('unknown option ' + flag + '\n' + USAGE);
      process.exit(3);
    }
  }
  if (options.timeoutSeconds !== null && !(options.timeoutSeconds > 0)) {
    complain('--timeout needs a positive number of seconds\n' + USAGE);
    process.exit(3);
  }
  return options;
}

// ---------------------------------------------------------------- exit and watchdog (3.4.6)

async function finish(code) {
  if (activeBrowser) {
    await Promise.race([activeBrowser.close().catch(() => {}), delay(CLOSE_GRACE_MS)]);
  }
  closeAllBrowsersSync();
  process.exit(code);
}

function startWatchdog(options) {
  const seconds = options.timeoutSeconds || (options.slow ? WATCHDOG_SLOW_SECONDS : WATCHDOG_SECONDS);
  setTimeout(() => {
    complain('TIMEOUT after ' + seconds + ' s');
    closeAllBrowsersSync();
    process.exit(2);
  }, seconds * 1000);
}

function resolveFile(options) {
  const name = options.file || (options.smoke ? SHIPPED_FILE : TEST_FILE);
  const path = resolve(options.file ? process.cwd() : ROOT, name);
  if (!existsSync(path)) {
    complain('missing ' + path + ': run node tools/build.mjs first');
    process.exit(3);
  }
  return path;
}

async function openBrowser(options) {
  try {
    activeBrowser = await launchBrowser({ headed: options.headed });
  } catch (error) {
    complain('runner error: ' + error.message + '. Install Playwright or set FLM_CHROMIUM to a Chrome or Chromium executable.');
    process.exit(3);
  }
}

function openPage(contextOptions) {
  return activeBrowser.newPage(contextOptions).then((page) => {
    page.onCrash = () => {
      complain('CRASH: the page crashed');
      finish(1);
    };
    return page;
  });
}

// ---------------------------------------------------------------- corpus (3.4.3 step 4a)

function readCorpusEntries() {
  const folder = join(ROOT, 'test-corpus');
  const manifestPath = join(folder, 'MANIFEST.json');
  if (!existsSync(manifestPath)) return null;
  const manifestText = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText.charCodeAt(0) === 0xFEFF ? manifestText.slice(1) : manifestText);
  const rows = Array.isArray(manifest) ? manifest : manifest.files;
  return rows.map((row) => ({ ...row, base64: readFileSync(join(folder, row.file)).toString('base64') }));
}

async function injectCorpus(page, options) {
  const entries = readCorpusEntries();
  if (entries === null) {
    if (!options.quiet) say('note: test-corpus/MANIFEST.json not found; corpus tests will skip');
    return;
  }
  await page.evaluate('window.FLM.SelfTest.corpus.load(' + JSON.stringify(entries) + ')');
}

// ---------------------------------------------------------------- one pass in one browser context (3.4.3)

async function runPass(file, groups, runOptions, contextOptions, options, needsCorpus) {
  const page = await openPage(contextOptions);
  await page.goto(pathToFileURL(file).href + '?test');
  try {
    await page.waitFor(READY_EXPRESSION, READY_TIMEOUT_MS);
  } catch (error) {
    complain('the runner never became ready (FLM.selfTestReady) within ' + READY_TIMEOUT_MS / 1000 + ' s');
    page.pageErrors.forEach((text) => complain('PAGE ERROR ' + text));
    await finish(1);
  }
  if (needsCorpus) await injectCorpus(page, options);
  await page.evaluate('window.FLM.selfTest(' + JSON.stringify(groups) + ', ' + JSON.stringify(runOptions) + ').then(() => true)');
  const results = await page.evaluate('window.__FLM_RESULTS');
  results.pageErrors = (results.pageErrors || []).concat(page.pageErrors);
  await page.close();
  return results;
}

/** Adds the touch pass to the desktop results; its group names get the suffix @touch. */
function mergeTouchResults(results, touch) {
  touch.groups.forEach((row) => { row.name += '@touch'; });
  touch.tests.forEach((entry) => { entry.group += '@touch'; });
  results.groups.push(...touch.groups);
  results.tests.push(...touch.tests);
  ['total', 'passed', 'failed', 'skipped'].forEach((key) => { results[key] += touch[key]; });
  results.pageErrors.push(...touch.pageErrors.map((text) => '[touch] ' + text));
}

function selectionOverlaps(options, names) {
  return options.groups.length === 0 || options.groups.some((name) => names.includes(name));
}

// ---------------------------------------------------------------- output (3.4.4)

function pad(value, width) {
  return String(value).padStart(width);
}

function printTable(results) {
  const nameWidth = Math.max(5, ...results.groups.map((row) => row.name.length));
  say('GROUP'.padEnd(nameWidth) + ' | TOTAL | PASS | FAIL | SKIP |     MS');
  results.groups.forEach((row) => {
    say(row.name.padEnd(nameWidth) + ' | ' + pad(row.total, 5) + ' | ' + pad(row.passed, 4) + ' | ' + pad(row.failed, 4)
      + ' | ' + pad(row.skipped, 4) + ' | ' + pad(Math.round(row.ms), 6));
  });
}

function printDetails(results, options) {
  results.tests.filter((entry) => !entry.pass).forEach((entry) => say('FAIL ' + entry.group + '/' + entry.name + ' :: ' + entry.message));
  if (!options.quiet) {
    results.tests.filter((entry) => entry.skipped).forEach((entry) => say('SKIP ' + entry.group + '/' + entry.name + ' :: ' + entry.message));
  }
  results.pageErrors.forEach((text) => say('PAGE ERROR ' + text));
}

function printSummary(results, seconds) {
  say('SELFTEST ' + results.passed + '/' + results.total + ' passed, ' + results.failed + ' failed, '
    + results.skipped + ' skipped in ' + seconds.toFixed(1) + ' s (' + results.groups.length + ' groups)');
}

/** Exit code per 3.4.6 for a finished run; prints the reason for a failure that has no failed-test line. */
function exitCodeFor(results) {
  if (results.unknown.length > 0) {
    complain('unknown group(s): ' + results.unknown.join(', ') + '. Known groups: ' + results.known.join(', '));
    return 1;
  }
  if (results.total === 0) {
    complain('no tests ran (mistyped group, or the group has no tests yet)');
    return 1;
  }
  return results.failed > 0 || results.pageErrors.length > 0 ? 1 : 0;
}

// ---------------------------------------------------------------- suite and smoke

async function runSuite(file, options) {
  const started = Date.now();
  const groups = options.groups.length > 0 ? options.groups : undefined;
  const runOptions = { slow: options.slow, grep: options.grep, touch: false };
  const needsCorpus = selectionOverlaps(options, CORPUS_GROUPS);
  const results = await runPass(file, groups, runOptions, DESKTOP, options, needsCorpus);
  if (selectionOverlaps(options, TOUCH_GROUPS)) {
    const touchGroups = options.groups.length > 0 ? options.groups.filter((name) => TOUCH_GROUPS.includes(name)) : TOUCH_GROUPS;
    const touchResults = await runPass(file, touchGroups, { ...runOptions, touch: true }, TOUCH, options, needsCorpus);
    mergeTouchResults(results, touchResults);
  }
  if (!options.quiet) printTable(results);
  printDetails(results, options);
  printSummary(results, (Date.now() - started) / 1000);
  if (options.json) writeFileSync(resolve(options.json), JSON.stringify(results, null, 2) + '\n');
  return exitCodeFor(results);
}

async function collectSmokeProblems(page, file) {
  const problems = [];
  try {
    await page.waitFor(SMOKE_READY_EXPRESSION, READY_TIMEOUT_MS);
  } catch (error) {
    problems.push('FLM.diagnostics did not appear within ' + READY_TIMEOUT_MS / 1000 + ' s (boot did not finish)');
  }
  await delay(SMOKE_SETTLE_MS);
  problems.push(...page.pageErrors);
  const fatalShown = await page.evaluate("(() => { const el = document.getElementById('fatal'); return !!el && el.classList.contains('show'); })()");
  if (fatalShown) problems.push('the #fatal screen is showing');
  const hasRunner = await page.evaluate('!!(window.FLM && window.FLM.selfTest)');
  if (hasRunner && !file.endsWith('.test.html')) problems.push('FLM.selfTest exists in a build that must not contain the runner');
  return problems;
}

async function runSmoke(file) {
  const page = await openPage(DESKTOP);
  await page.goto(pathToFileURL(file).href);
  const problems = await collectSmokeProblems(page, file);
  await page.close();
  if (problems.length === 0) {
    say('SMOKE OK ' + file);
    return 0;
  }
  problems.forEach((text) => say('SMOKE FAIL ' + text));
  return 1;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const file = resolveFile(options);
  startWatchdog(options);
  await openBrowser(options);
  const code = options.smoke ? await runSmoke(file) : await runSuite(file, options);
  await finish(code);
}

main().catch((error) => {
  complain('runner error: ' + (error && error.message ? error.message : error));
  finish(3);
});
