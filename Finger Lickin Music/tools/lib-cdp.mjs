// tools/lib-cdp.mjs - browser launcher shared by tools/selftest.mjs and tools/perf.mjs.
// Uses `playwright` when createRequire resolves it; otherwise a built-in Chrome DevTools Protocol client written
// with Node's global WebSocket (decision D1 in docs/LEDGER.md). Node built-ins only, no installs.
//
//   const browser = await launchBrowser({ headed: false });
//   const page = await browser.newPage({ width: 1280, height: 720, deviceScaleFactor: 1, hasTouch: false });
//   await page.goto(url); const value = await page.evaluate('1 + 1'); await browser.close();
//
// Both backends give the same page object: pageErrors, dialogs, crashed, onCrash, goto, evaluate, waitFor, close.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const FLAGS = [
  '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-precise-memory-info'
];

const WINDOWS_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LINUX_FALLBACK = '/opt/pw-browsers/chromium';
const START_TIMEOUT_MS = 20000;
const POLL_MS = 100;
const NAVIGATION_TIMEOUT_MS = 60000;
const COMMAND_TIMEOUT_MS = 120000;
const ERROR_TEXT_LIMIT = 1000;
const REMOVE_RETRIES = 20;

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class NoBrowserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NoBrowserError';
  }
}

// ---------------------------------------------------------------- cleanup on every exit path

const cleanups = new Set();

function runCleanups() {
  for (const cleanup of Array.from(cleanups)) {
    try { cleanup(); } catch (error) { /* the process is ending; nothing more to do */ }
  }
}

process.on('exit', runCleanups);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => process.exit(130));
}

/** Synchronous kill of every browser this process started and removal of its profile folders. */
export function closeAllBrowsersSync() {
  runCleanups();
}

function killProcessTree(child) {
  if (!child || child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

function removeFolder(folder) {
  if (!folder || !existsSync(folder)) return;
  try {
    rmSync(folder, { recursive: true, force: true, maxRetries: REMOVE_RETRIES, retryDelay: POLL_MS });
  } catch (error) {
    process.stderr.write('warning: could not remove ' + folder + ' (' + error.code + ')\n');
  }
}

// ---------------------------------------------------------------- finding the browser

function newestPlaywrightChromium() {
  const base = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : null;
  if (!base || !existsSync(base)) return null;
  const revisions = readdirSync(base)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
  for (const name of revisions) {
    const candidate = join(base, name, 'chrome-win64', 'chrome.exe');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** FLM_CHROMIUM, then the installed Chrome, then the newest Playwright Chromium, then the Linux fallback. */
export function findBrowserExecutable() {
  const candidates = [process.env.FLM_CHROMIUM, WINDOWS_CHROME, newestPlaywrightChromium(), LINUX_FALLBACK];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new NoBrowserError('no Chrome or Chromium found (set FLM_CHROMIUM to an executable)');
  return found;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// ---------------------------------------------------------------- shared page helpers

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + ' ms')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Polls evaluate(expression) until it is truthy; throws after timeoutMs. */
async function waitForExpression(page, expression, timeoutMs, pollMs = POLL_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(expression)) return;
      lastError = null;
    } catch (error) {
      lastError = error;                 // the page may still be loading: try again
    }
    await delay(pollMs);
  }
  throw new Error('timed out after ' + timeoutMs + ' ms waiting for ' + expression
    + (lastError ? ' (last error: ' + lastError.message + ')' : ''));
}

function describeException(details) {
  const exception = details.exception || {};
  const text = exception.description || details.text || 'unknown error';
  return String(text).slice(0, ERROR_TEXT_LIMIT);
}

function describeRemoteObject(argument) {
  if (argument.value !== undefined) return String(argument.value);
  return argument.description || argument.type;
}

// ---------------------------------------------------------------- CDP client

class CdpConnection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = [];
    this.closed = false;
    socket.addEventListener('message', (event) => this.onMessage(event.data));
    socket.addEventListener('close', () => this.onClose());
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => resolve(new CdpConnection(socket)));
      socket.addEventListener('error', () => reject(new Error('cannot connect to ' + url)));
    });
  }

  onMessage(data) {
    const message = JSON.parse(String(data));
    if (message.id !== undefined) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message + ' (' + waiter.method + ')'));
      else waiter.resolve(message.result);
      return;
    }
    this.handlers.forEach((handler) => handler(message.method, message.params || {}, message.sessionId));
  }

  onClose() {
    this.closed = true;
    this.pending.forEach((waiter) => waiter.reject(new Error('browser connection closed (' + waiter.method + ')')));
    this.pending.clear();
  }

  onEvent(handler) {
    this.handlers.push(handler);
  }

  // timeoutMs = Infinity for commands that may run as long as a whole test run (the tool's watchdog covers those).
  send(method, params = {}, sessionId = undefined, timeoutMs = COMMAND_TIMEOUT_MS) {
    if (this.closed) return Promise.reject(new Error('browser connection closed (' + method + ')'));
    const id = this.nextId;
    this.nextId += 1;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
    this.socket.send(JSON.stringify(message));
    return timeoutMs === Infinity ? result : withTimeout(result, timeoutMs, method);
  }

  close() {
    try { this.socket.close(); } catch (error) { /* already closed */ }
  }
}

class CdpPage {
  constructor(connection, sessionId, targetId, contextId) {
    this.connection = connection;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.contextId = contextId;
    this.pageErrors = [];
    this.dialogs = [];
    this.crashed = false;
    this.onCrash = null;
    this.eventWaiters = [];
    connection.onEvent((method, params, session) => {
      if (session === sessionId) this.onEvent(method, params);
    });
  }

  send(method, params, timeoutMs) {
    return this.connection.send(method, params, this.sessionId, timeoutMs);
  }

  async setup(options) {
    await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Inspector.enable'].map((method) => this.send(method)));
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: options.width, height: options.height, deviceScaleFactor: options.deviceScaleFactor, mobile: false
    });
    if (options.hasTouch) await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }

  onEvent(method, params) {
    if (method === 'Runtime.exceptionThrown') this.pageErrors.push('pageerror: ' + describeException(params.exceptionDetails));
    else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      this.pageErrors.push('console.error: ' + params.args.map(describeRemoteObject).join(' ').slice(0, ERROR_TEXT_LIMIT));
    } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
      this.pageErrors.push('log error: ' + params.entry.text + (params.entry.url ? ' (' + params.entry.url + ')' : ''));
    } else if (method === 'Page.javascriptDialogOpening') this.onDialog(params);
    else if (method === 'Inspector.targetCrashed') this.onCrashed();
    this.eventWaiters = this.eventWaiters.filter((waiter) => !waiter(method));
  }

  onDialog(params) {
    this.dialogs.push(params.type + ': ' + params.message);
    this.pageErrors.push('dialog (' + params.type + '): ' + params.message);
    this.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
  }

  onCrashed() {
    this.crashed = true;
    if (this.onCrash) this.onCrash();
  }

  /** Resolves when the named event arrives for this page. */
  waitForEvent(method, ms) {
    const arrival = new Promise((resolve) => {
      this.eventWaiters.push((name) => {
        if (name !== method) return false;
        resolve();
        return true;
      });
    });
    return withTimeout(arrival, ms, method);
  }

  async goto(url) {
    const loaded = this.waitForEvent('Page.loadEventFired', NAVIGATION_TIMEOUT_MS);
    loaded.catch(() => {});
    const navigation = await this.send('Page.navigate', { url });
    if (navigation.errorText) throw new Error('navigation to ' + url + ' failed: ' + navigation.errorText);
    await loaded;
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, Infinity);
    if (result.exceptionDetails) throw new Error(describeException(result.exceptionDetails));
    return result.result.value;
  }

  waitFor(expression, timeoutMs) {
    return waitForExpression(this, expression, timeoutMs);
  }

  async close() {
    await this.connection.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {});
    await this.connection.send('Target.disposeBrowserContext', { browserContextId: this.contextId }).catch(() => {});
  }
}

class CdpBrowser {
  constructor(connection, child, profileFolder, version) {
    this.kind = 'cdp';
    this.version = version;
    this.connection = connection;
    this.child = child;
    this.profileFolder = profileFolder;
    this.forceCleanup = () => {
      killProcessTree(child);
      removeFolder(profileFolder);
      cleanups.delete(this.forceCleanup);
    };
    cleanups.add(this.forceCleanup);
  }

  async newPage(options) {
    const { browserContextId } = await this.connection.send('Target.createBrowserContext');
    const { targetId } = await this.connection.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await this.connection.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new CdpPage(this.connection, sessionId, targetId, browserContextId);
    await page.setup(options);
    return page;
  }

  async close() {
    await this.connection.send('Browser.close').catch(() => {});
    this.connection.close();
    await delay(POLL_MS);
    this.forceCleanup();
  }
}

async function waitForDebugger(port, child) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('the browser exited with code ' + child.exitCode + ' before it was ready');
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/version', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return await response.json();
    } catch (error) { /* not listening yet */ }
    await delay(POLL_MS);
  }
  throw new Error('the browser did not open its debugging port within ' + START_TIMEOUT_MS + ' ms');
}

async function launchWithCdp(headed) {
  const executable = findBrowserExecutable();
  const port = await freePort();
  const parent = join(tmpdir(), 'claude');
  mkdirSync(parent, { recursive: true });
  const profileFolder = mkdtempSync(join(parent, 'flm-profile-'));
  const args = [...FLAGS, '--remote-debugging-port=' + port, '--remote-allow-origins=*', '--user-data-dir=' + profileFolder,
    '--no-first-run', '--no-default-browser-check', 'about:blank'];
  if (!headed) args.unshift('--headless=new');
  const child = spawn(executable, args, { stdio: 'ignore', windowsHide: true });
  const earlyCleanup = () => { killProcessTree(child); removeFolder(profileFolder); };
  cleanups.add(earlyCleanup);
  try {
    const spawnFailed = new Promise((resolve, reject) => child.once('error', reject));
    const info = await Promise.race([waitForDebugger(port, child), spawnFailed]);
    const connection = await CdpConnection.connect(info.webSocketDebuggerUrl);
    cleanups.delete(earlyCleanup);
    return new CdpBrowser(connection, child, profileFolder, info.Browser);
  } catch (error) {
    earlyCleanup();
    cleanups.delete(earlyCleanup);
    throw error;
  }
}

// ---------------------------------------------------------------- Playwright backend

class PlaywrightPage {
  constructor(page, context) {
    this.page = page;
    this.context = context;
    this.pageErrors = [];
    this.dialogs = [];
    this.crashed = false;
    this.onCrash = null;
    page.on('pageerror', (error) => this.pageErrors.push('pageerror: ' + String(error.stack || error.message).slice(0, ERROR_TEXT_LIMIT)));
    page.on('console', (message) => {
      if (message.type() === 'error') this.pageErrors.push('console.error: ' + message.text().slice(0, ERROR_TEXT_LIMIT));
    });
    page.on('dialog', (dialog) => {
      this.dialogs.push(dialog.type() + ': ' + dialog.message());
      this.pageErrors.push('dialog (' + dialog.type() + '): ' + dialog.message());
      dialog.dismiss().catch(() => {});
    });
    page.on('crash', () => {
      this.crashed = true;
      if (this.onCrash) this.onCrash();
    });
  }

  goto(url) { return this.page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS }); }

  evaluate(expression) { return this.page.evaluate(expression); }

  waitFor(expression, timeoutMs) { return waitForExpression(this, expression, timeoutMs); }

  close() { return this.context.close(); }
}

class PlaywrightBrowser {
  constructor(browser) {
    this.kind = 'playwright';
    this.version = browser.version();
    this.browser = browser;
  }

  async newPage(options) {
    const context = await this.browser.newContext({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: options.deviceScaleFactor, hasTouch: options.hasTouch
    });
    return new PlaywrightPage(await context.newPage(), context);
  }

  close() { return this.browser.close(); }
}

function loadPlaywright() {
  if (process.env.FLM_NO_PLAYWRIGHT === '1') return null;
  try {
    return createRequire(import.meta.url)('playwright');
  } catch (error) {
    return null;
  }
}

// Part 3.4.2: default launch, then the FLM_CHROMIUM / /opt/pw-browsers/chromium executable.
async function launchWithPlaywright(playwright, headed) {
  const options = { headless: !headed, args: FLAGS };
  try {
    return new PlaywrightBrowser(await playwright.chromium.launch(options));
  } catch (first) {
    const fallback = process.env.FLM_CHROMIUM || LINUX_FALLBACK;
    try {
      return new PlaywrightBrowser(await playwright.chromium.launch({ ...options, executablePath: fallback }));
    } catch (second) {
      throw new Error('cannot launch Chromium through playwright: ' + first.message + ' / ' + second.message);
    }
  }
}

/** Playwright when it resolves and launches, else the built-in CDP client. Throws NoBrowserError or Error. */
export async function launchBrowser({ headed = false } = {}) {
  const playwright = loadPlaywright();
  let playwrightFailure = null;
  if (playwright) {
    try {
      return await launchWithPlaywright(playwright, headed);
    } catch (error) {
      playwrightFailure = error;
    }
  }
  try {
    return await launchWithCdp(headed);
  } catch (error) {
    if (playwrightFailure) error.message = playwrightFailure.message + ' / ' + error.message;
    throw error;
  }
}
