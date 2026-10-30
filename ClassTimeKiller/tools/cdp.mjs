// Headless Chrome over the DevTools protocol (CDP), shared by tools/selftest.mjs, tools/perf.mjs, tools/balance.mjs and tools/balance-summary.mjs. No dependencies.
// openChrome(options) starts Chrome on one of a few fixed profile folders (ctk-chrome-slot-0..7 in the temp folder) and returns a session:
//   { send(method, params), evaluate(expression), open(file, { clearStorage }), errors, on(method, fn), off(method, fn), close(), profile }
// options: { flags: extra Chrome flags, log: file that gets Chrome's stdout and stderr (e.g. V8 --js-flags traces) }. evaluate awaits promises and returns the value (throws on a page exception).
// Profile folders are never deleted: on this PC Windows keeps about a third of deleted Chrome profiles "delete pending" until a reboot. open(file) clears the game's save storage before it boots (not the shader cache), so every run starts clean; { clearStorage: false } skips that.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readFileSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME_PATHS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const BASE_FLAGS = ['--headless=new', '--remote-debugging-port=0', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required'];
const START_TRIES = 240;              // x 250 ms: up to 60 s, Chrome starts slowly while antivirus scans or other runs share the CPU
const BOOT_TRIES = 80;                // x 250 ms for window.__CTK after navigation
const EXIT_WAIT_MS = 5000;            // Chrome's helper processes hold the profile until the browser has really exited
const PROFILE_SLOTS = 8;              // fixed profile folders ctk-chrome-slot-0..7: at most this many Chromes run at once
const SLOT_TRIES = 240;               // x 250 ms: wait for a free slot while all of them are in use
const SLOT_FOLDER = 'ctk-chrome-slot-';
const SLOT_PIPE = '\\\\.\\pipe\\ctk-chrome-slot-';   // Windows: the claim on a slot is a named pipe of this name plus the slot number
const SLOT_PORT_BASE = 47600;         // elsewhere: a local port (below Windows' ephemeral range, inside Linux's: a slot whose port is taken is just skipped)
const STORAGE_ORIGIN = 'file://';     // the built game is a file: page, and Chrome keeps all file: storage under this origin
const STORAGE_TYPES = 'local_storage,indexeddb,websql,cookies,cache_storage,service_workers';   // the save-related types only, not shader_cache

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function findChrome() { return CHROME_PATHS.find((path) => existsSync(path)) || ''; }

// A slot is claimed by listening on a name only that slot has: the operating system refuses a second listener and frees the name
// when the process ends, even in a crash, so a claim never goes stale and parallel runs never share a profile.
function claimSlotName(index) {
  return new Promise((done) => {
    const server = createServer();
    server.unref();
    server.once('error', () => done(null));
    if (process.platform === 'win32') server.listen(SLOT_PIPE + index, () => done(server));
    else server.listen(SLOT_PORT_BASE + index, '127.0.0.1', () => done(server));
  });
}

// Chrome holds a profile's lockfile open while it runs, so a lockfile that cannot be removed means a Chrome (e.g. one left by a
// crashed run) still uses the slot. The stale DevToolsActivePort file of the last run is removed so the new run cannot read an old port.
function profileIsFree(profile) {
  for (const name of ['lockfile', 'DevToolsActivePort']) {
    try { rmSync(join(profile, name), { force: true }); } catch (error) { return false; }
  }
  return true;
}

async function tryClaimSlot(index) {
  const claim = await claimSlotName(index);
  if (!claim) return null;
  const profile = join(tmpdir(), SLOT_FOLDER + index);
  try {
    mkdirSync(profile, { recursive: true });
    if (profileIsFree(profile)) return { profile, release: () => claim.close() };
  } catch (error) { claim.close(); throw error; }
  claim.close();
  return null;
}

async function claimProfileSlot() {
  for (let attempt = 0; attempt < SLOT_TRIES; attempt++) {
    for (let index = 0; index < PROFILE_SLOTS; index++) {
      const slot = await tryClaimSlot(index);
      if (slot) return slot;
    }
    await sleep(250);
  }
  throw new Error('No free Chrome profile slot (all ' + PROFILE_SLOTS + ' are in use)');
}

export async function openChrome(options) {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome not found');
  const slot = await claimProfileSlot();
  const profile = slot.profile;
  let chrome = null, exited = Promise.resolve();
  // Waits for Chrome to exit, then gives the slot back. The profile folder stays: only a Chrome that has really exited lets go of its lockfile.
  const close = async () => {
    try { if (chrome) chrome.kill(); } catch (error) { /* already gone */ }
    await Promise.race([exited, sleep(EXIT_WAIT_MS)]);
    slot.release();
  };
  try {
    const flags = BASE_FLAGS.concat((options && options.flags) || [], ['--user-data-dir=' + profile, 'about:blank']);
    const output = options && options.log ? openSync(options.log, 'w') : 'ignore';
    chrome = spawn(chromePath, flags, { stdio: ['ignore', output, output] });
    exited = new Promise((done) => { if (chrome.exitCode !== null) done(); else chrome.once('exit', done); });
    const session = await connect(profile);
    session.profile = profile;
    session.close = async () => {
      // Browser.close shuts Chrome and its helper processes down cleanly, so they release the profile.
      await Promise.race([session.send('Browser.close', {}), exited, sleep(EXIT_WAIT_MS)]);
      session.socket.close();
      await close();
    };
    return session;
  } catch (error) {
    await close();
    throw error;
  }
}

// Port 0: Chrome picks a free port and writes it to DevToolsActivePort, so parallel runs never collide.
async function findPageTarget(profile) {
  for (let i = 0; i < START_TRIES; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0].trim();
      const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      const target = list.find((t) => t.type === 'page');
      if (target) return target;
    } catch (error) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome did not start');
}

async function connect(profile) {
  const target = await findPageTarget(profile);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let nextId = 0;
  const pending = new Map(), listeners = new Map(), errors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return; }
    collectError(message, errors);
    const handlers = listeners.get(message.method);
    if (handlers) handlers.forEach((handler) => handler(message.params));
  };
  const send = (method, params) => new Promise((done) => { const id = ++nextId; pending.set(id, done); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (reply.error) throw new Error(reply.error.message);
    if (reply.result.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description || reply.result.exceptionDetails.text);
    return reply.result.result.value;
  };
  const on = (method, handler) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(handler); };
  const off = (method, handler) => { const handlers = listeners.get(method) || []; if (handlers.includes(handler)) handlers.splice(handlers.indexOf(handler), 1); };
  // Clears what the last run left in the reused profile for the game's origin: exactly local storage, IndexedDB, WebSQL, cookies,
  // Cache Storage and service workers (STORAGE_TYPES). The GPU shader cache stays, so boot timings keep their meaning.
  const clearStorage = async () => {
    const reply = await send('Storage.clearDataForOrigin', { origin: STORAGE_ORIGIN, storageTypes: STORAGE_TYPES });
    if (reply.error) throw new Error('Could not clear the game storage: ' + reply.error.message);
  };
  // Navigates to the built game and waits until it booted (window.__CTK exists). The storage is cleared first, so the game boots as on a
  // first visit; open(file, { clearStorage: false }) keeps what the page saved (perf.mjs: later boots are warm, with the saved record).
  const open = async (file, openOptions) => {
    if (!openOptions || openOptions.clearStorage !== false) await clearStorage();
    await send('Page.navigate', { url: pathToFileURL(file).href });
    for (let i = 0; i < BOOT_TRIES; i++) { await sleep(250); if (await evaluate('!!window.__CTK').catch(() => false)) return; }
    throw new Error('Game did not boot (no window.__CTK)');
  };
  await send('Runtime.enable', {});
  await send('Page.enable', {});
  return { socket, send, evaluate, on, off, open, errors };
}

// Page exceptions, console errors and warnings land in the session's error list.
function collectError(message, errors) {
  if (message.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + (message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text));
  if (message.method === 'Runtime.consoleAPICalled' && (message.params.type === 'error' || message.params.type === 'warning')) {
    errors.push(message.params.type.toUpperCase() + ': ' + message.params.args.map((a) => a.value ?? a.description).join(' '));
  }
}
