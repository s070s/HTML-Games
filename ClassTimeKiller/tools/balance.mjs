// Batch runner for the P8 balance plan (Appendix C "P8-03"), headless Chrome pages, no dependencies.
// Usage: node tools/balance.mjs --out <dir> [--plan <families or case globs, comma separated>] [--wave 0-3] [--workers 1-4] [--resume] [--run-timeout 120]
//          [--seeds 1,2] [--extra-seeds 5,6,7,8] [--minutes 3] [--set "weapons.id.field=json;abilities.id.field=json"] [--tag name] [--list] [--file <test html>]
// --set adds A / B overrides (T4) to every selected run; --tag keeps those runs apart (the case id and the key get "@name" appended).
//        node tools/balance.mjs --summary <runs.jsonl> [--out <dir>]      (the P8-01 comparison: fail / watch / no-data lines, summary.json)
// Writes one JSON line per run to <out>/runs.jsonl ({ key, case, family, seed, mirror, ok, wall, rec | error }), skips the (case, seed, mirror) keys
// already done with --resume, restarts a worker's Chrome page after 200 runs or a failure, prints a progress line every 25 runs.
// Exit code: 0 all runs ok, 1 a run failed, 2 timeout of the whole job, 3 runner error.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChrome } from './cdp.mjs';
import { buildPlan, runsOf } from './balance-plan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const MAX_WORKERS = 4;
const RUNS_PER_PAGE = 200;
const PROGRESS_EVERY = 25;

function selectRuns() {
  let runs = runsOf(buildPlan());
  const plan = option('--plan', '');
  if (plan) {
    const patterns = plan.split(',').map((text) => new RegExp('^' + text.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));
    runs = runs.filter((run) => patterns.some((pattern) => pattern.test(run.family) || pattern.test(run.case)));
  }
  const wave = option('--wave', '');
  if (wave) {
    const [low, high] = wave.split('-').map(Number);
    runs = runs.filter((run) => run.wave >= low && run.wave <= (high === undefined ? low : high));
  }
  const extra = option('--extra-seeds', '');   // tuning: more seeds than the plan has for the selected cases
  if (extra) {
    const first = new Map();
    for (const run of runs) if (!first.has(run.case)) first.set(run.case, run);
    for (const run of first.values()) for (const seed of extra.split(',').map(Number)) for (const mirror of runs.filter((r) => r.case === run.case && r.spec.seed === run.spec.seed).map((r) => r.spec.mirror)) {
      const spec = { ...run.spec, seed, mirror };
      runs.push({ ...run, key: run.case + '|' + seed + '|' + (mirror ? 1 : 0), spec });
    }
  }
  const seeds = option('--seeds', '');
  if (seeds) { const keep = seeds.split(',').map(Number); runs = runs.filter((run) => keep.includes(run.spec.seed)); }
  const overrides = {};
  for (const pair of option('--set', '').split(';').filter(Boolean)) overrides[pair.slice(0, pair.indexOf('='))] = JSON.parse(pair.slice(pair.indexOf('=') + 1));
  const tag = option('--tag', '');
  for (const run of runs) {
    if (Object.keys(overrides).length) run.spec.overrides = Object.assign({}, run.spec.overrides || {}, overrides);
    if (tag) { run.key += '@' + tag; run.case += '@' + tag; }
  }
  const minutes = Number(option('--minutes', '0'));
  if (minutes > 0) for (const run of runs) run.spec.minutes = minutes;
  return runs.sort((a, b) => a.map.localeCompare(b.map) || a.wave - b.wave || a.case.localeCompare(b.case));
}

function doneKeys(path) {
  const done = new Set();
  if (!existsSync(path)) return done;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const entry = JSON.parse(line); if (entry.ok) done.add(entry.key); } catch (error) { /* a torn last line is redone */ }
  }
  return done;
}

async function runJob() {
  const out = resolve(option('--out', ''));
  if (!option('--out', '')) throw new Error('--out <dir> is required (scratch files belong in the temp folder)');
  mkdirSync(out, { recursive: true });
  const file = resolve(option('--file', join(ROOT, 'ClassTimeKiller.test.html')));
  const path = join(out, 'runs.jsonl');
  let runs = selectRuns();
  if (args.includes('--list')) { for (const run of runs) console.log(run.key + ' wave ' + run.wave + ' ' + run.map); console.log(runs.length + ' runs'); return 0; }
  if (args.includes('--resume')) { const done = doneKeys(path); runs = runs.filter((run) => !done.has(run.key)); }
  const workers = Math.min(MAX_WORKERS, Math.max(1, Number(option('--workers', '1'))));
  const runTimeout = Number(option('--run-timeout', '120')) * 1000;
  const total = runs.length, started = Date.now();
  let finished = 0, failed = 0;
  console.log('balance: ' + total + ' runs, ' + workers + ' worker(s), out ' + path);
  const queue = runs.slice();
  const worker = async (index) => {
    let session = null, used = 0;
    const open = async () => { session = await openChrome({ flags: [] }); await session.open(file); used = 0; };
    const close = async () => { if (session) { await session.close(); session = null; } };
    try {
      while (queue.length) {
        const run = queue.shift();
        if (!session || used >= RUNS_PER_PAGE) { await close(); await open(); }
        used++;
        const entry = { key: run.key, case: run.case, family: run.family, seed: run.spec.seed, mirror: run.spec.mirror, ok: false };
        const errorsBefore = session.errors.length;
        const began = Date.now();
        try {
          const call = session.evaluate('JSON.stringify(__CTK.balance.run(' + JSON.stringify(run.spec) + '))');
          const timer = new Promise((_, reject) => setTimeout(() => reject(new Error('run timeout')), runTimeout));
          entry.rec = JSON.parse(await Promise.race([call, timer]));
          entry.ok = true;
          const pageErrors = session.errors.slice(errorsBefore).filter((line) => !line.startsWith('WARNING'));
          const gameErrors = await session.evaluate('__CTK.log.errors().length');
          if (pageErrors.length || gameErrors) { entry.ok = false; entry.error = (pageErrors[0] || gameErrors + ' logged game errors'); }
        } catch (error) {
          entry.error = error.message;
          await close();   // a hung or crashed page is dropped; the next run opens a fresh one
        }
        entry.wall = Date.now() - began;
        appendFileSync(path, JSON.stringify(entry) + '\n');
        finished++;
        if (!entry.ok) { failed++; console.log('  FAIL ' + run.key + ': ' + entry.error); }
        if (finished % PROGRESS_EVERY === 0 || finished === total) {
          const minutes = (Date.now() - started) / 60000;
          console.log('balance: ' + finished + '/' + total + ' runs, ' + failed + ' failed, ' + minutes.toFixed(1) + ' min, worker ' + index);
        }
      }
    } finally { await close(); }
  };
  await Promise.all(Array.from({ length: workers }, (_, index) => worker(index)));
  console.log('balance: done, ' + finished + ' runs, ' + failed + ' failed, ' + ((Date.now() - started) / 60000).toFixed(1) + ' min');
  return failed ? 1 : 0;
}

async function main() {
  if (args.includes('--summary')) {
    const { summarize } = await import('./balance-summary.mjs');
    const files = option('--summary', '').split(',').map((path) => resolve(path.trim()));   // later files win for a repeated run key
    return summarize(files.join(','), resolve(option('--out', dirname(files[0]))), resolve(option('--file', join(ROOT, 'ClassTimeKiller.test.html'))));
  }
  return runJob();
}
main().then((code) => process.exit(code)).catch((error) => { console.log('RUNNER ERROR ' + error.stack); process.exit(3); });
