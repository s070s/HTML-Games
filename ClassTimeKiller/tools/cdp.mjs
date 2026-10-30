// Headless Chrome over the DevTools protocol (CDP), shared by tools/selftest.mjs and tools/perf.mjs. No dependencies.
// openChrome(options) starts Chrome with a throwaway profile and returns a session:
//   { send(method, params), evaluate(expression), open(file), errors, on(method, fn), off(method, fn), close() }
// options: { flags: extra Chrome flags, log: file that gets Chrome's stdout and stderr (e.g. V8 --js-flags traces) }. evaluate awaits promises and returns the value (throws on a page exception).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME_PATHS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const BASE_FLAGS = ['--headless=new', '--remote-debugging-port=0', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required'];
const START_TRIES = 240;              // x 250 ms: up to 60 s, Chrome starts slowly while antivirus scans or other runs share the CPU
const BOOT_TRIES = 80;                // x 250 ms for window.__CTK after navigation
const EXIT_WAIT_MS = 5000;            // Chrome's helper processes hold the profile until the browser has really exited
const PROFILE_CLEANUP_TRIES = 20;     // x 250 ms: Windows releases the profile files a moment after the exit

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function findChrome() { return CHROME_PATHS.find((path) => existsSync(path)) || ''; }

export async function openChrome(options) {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome not found');
  const profile = mkdtempSync(join(tmpdir(), 'ctk-chrome-'));
  const flags = BASE_FLAGS.concat((options && options.flags) || [], ['--user-data-dir=' + profile, 'about:blank']);
  const output = options && options.log ? openSync(options.log, 'w') : 'ignore';
  const chrome = spawn(chromePath, flags, { stdio: ['ignore', output, output] });
  const exited = new Promise((done) => { if (chrome.exitCode !== null) done(); else chrome.once('exit', done); });
  // Waits for Chrome to exit, then deletes the profile, retrying while Windows still holds its files.
  const close = async () => {
    try { chrome.kill(); } catch (error) { /* already gone */ }
    await Promise.race([exited, sleep(EXIT_WAIT_MS)]);
    for (let i = 0; i < PROFILE_CLEANUP_TRIES; i++) {
      try { rmSync(profile, { recursive: true, force: true }); return; } catch (error) { await sleep(250); }
    }
  };
  try {
    const session = await connect(profile);
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
  // Navigates to the built game and waits until it booted (window.__CTK exists).
  const open = async (file) => {
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
