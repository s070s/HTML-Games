// Runs ClassTimeKiller's built-in self-test in headless Chrome (software WebGL), no dependencies (Chrome startup: tools/cdp.mjs).
// Usage: node tools/selftest.mjs [--file <html>] [--group <name>] [--slow] [--eval "<js, may be async>"] [--screenshot <png>] [--timeout 240] [--no-selftest]
// Prints failed checks, page errors and the eval result. Exit code: 0 pass, 1 fail, 2 timeout, 3 runner error.
import { writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChrome, sleep } from './cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const file = resolve(option('--file', join(ROOT, 'ClassTimeKiller.html')));
const group = option('--group', '');
const slow = args.includes('--slow');   // also run the slow blocks (Test.add(..., { slow: true })) of every group
const extra = option('--eval', '');
const skipSelfTest = args.includes('--no-selftest');
const screenshot = option('--screenshot', ''); // PNG path: captured after --eval (use the eval to set up the scene)
const timeoutSeconds = Number(option('--timeout', '240'));

let session = null;
const finish = async (code) => {
  if (session) await session.close();
  process.exit(code);
};
const killer = setTimeout(() => { console.log('TIMEOUT after ' + timeoutSeconds + ' s'); finish(2); }, timeoutSeconds * 1000);

async function main() {
  session = await openChrome();
  const { evaluate, send, errors } = session;
  let failed = false;
  await session.open(file);
  if (!skipSelfTest) {
    const started = Date.now();
    const report = await evaluate('(async () => { const r = await __CTK.selfTest({ headless: true, group: ' + JSON.stringify(group) + ', slow: ' + slow + ' });'
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
  return failed;
}
main().then((failed) => { clearTimeout(killer); finish(failed ? 1 : 0); }).catch((error) => { console.log('RUNNER ERROR ' + error.message); clearTimeout(killer); finish(3); });
