// Runs ClassTimeKiller's built-in self-test in headless Chrome (software WebGL), no dependencies.
// Usage: node tools/selftest.mjs [--file <html>] [--group <name>] [--eval "<js, may be async>"] [--screenshot <png>] [--timeout 240] [--no-selftest]
// Prints failed checks, page errors and the eval result. Exit code: 0 pass, 1 fail, 2 timeout, 3 runner error.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const file = resolve(option('--file', join(ROOT, 'ClassTimeKiller.html')));
const group = option('--group', '');
const extra = option('--eval', '');
const skipSelfTest = args.includes('--no-selftest');
const screenshot = option('--screenshot', ''); // PNG path: captured after --eval (use the eval to set up the scene)
const timeoutSeconds = Number(option('--timeout', '240'));
const CHROME_PATHS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const chromePath = CHROME_PATHS.find((p) => existsSync(p));
if (!chromePath) { console.log('RUNNER ERROR Chrome not found'); process.exit(3); }

const profile = mkdtempSync(join(tmpdir(), 'ctk-chrome-'));
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
let failed = false;
const finish = (code) => {
  try { chrome.kill(); } catch (error) { /* already gone */ }
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch (error) { /* still locked */ } process.exit(code); }, 800);
};
const killer = setTimeout(() => { console.log('TIMEOUT after ' + timeoutSeconds + ' s'); finish(2); }, timeoutSeconds * 1000);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function main() {
  // Port 0: Chrome picks a free port and writes it to DevToolsActivePort, so parallel runs never collide.
  // Up to 60 s: Chrome starts slowly while antivirus scans or other runs share the CPU.
  let target = null;
  for (let i = 0; i < 240 && !target; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0].trim();
      const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      target = list.find((t) => t.type === 'page');
    } catch (error) { await sleep(250); }
  }
  if (!target) throw new Error('Chrome did not start');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + (message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text));
    if (message.method === 'Runtime.consoleAPICalled' && (message.params.type === 'error' || message.params.type === 'warning')) {
      errors.push(message.params.type.toUpperCase() + ': ' + message.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  };
  const send = (method, params) => new Promise((done) => { const id = ++nextId; pending.set(id, done); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (reply.result.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description || reply.result.exceptionDetails.text);
    return reply.result.result.value;
  };
  await send('Runtime.enable', {});
  await send('Page.enable', {});
  await send('Page.navigate', { url: pathToFileURL(file).href });
  for (let i = 0; i < 80; i++) { await sleep(250); if (await evaluate('!!window.__CTK').catch(() => false)) break; }
  if (!(await evaluate('!!window.__CTK'))) throw new Error('Game did not boot (no window.__CTK)');
  if (!skipSelfTest) {
    const started = Date.now();
    const report = await evaluate('(async () => { const r = await __CTK.selfTest({ headless: true, group: ' + JSON.stringify(group) + ' });'
      + ' return { total: r.total, failed: r.failed, groups: r.groups, bad: r.results.filter((x) => !x.ok).map((x) => x.group + ' + "' / '" + ' + x.name + (x.detail ? ' + "' :: '" + ' + x.detail : ' + "''" + ')) }; })()');
    console.log('SELFTEST ' + (report.total - report.failed) + '/' + report.total + ' passed in ' + ((Date.now() - started) / 1000).toFixed(1) + ' s (' + report.groups + ' groups)');
    report.bad.forEach((line) => console.log('  FAIL ' + line));
    if (report.failed) failed = true;
  }
  if (extra) {
    const value = await evaluate(extra);
    console.log('EVAL ' + (typeof value === 'string' ? value : JSON.stringify(value, null, 1)));
  }
  if (screenshot) {
    await sleep(500);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(screenshot), Buffer.from(shot.result.data, 'base64'));
    console.log('SCREENSHOT ' + resolve(screenshot));
  }
  const gameErrors = await evaluate('__CTK.log.errors()');
  gameErrors.forEach((line) => errors.push('GAME: ' + line));
  errors.forEach((line) => console.log('  ' + line));
  if (errors.some((line) => !line.startsWith('WARNING'))) failed = true;
  socket.close();
}
main().then(() => { clearTimeout(killer); finish(failed ? 1 : 0); }).catch((error) => { console.log('RUNNER ERROR ' + error.message); clearTimeout(killer); finish(3); });
