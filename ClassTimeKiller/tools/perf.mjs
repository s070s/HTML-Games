// Low-end performance runs of ClassTimeKiller in headless Chrome (plan phase 18, spec s3 PERF). No dependencies (Chrome: tools/cdp.mjs).
// CDP Emulation.setCPUThrottlingRate stands in for low-end phones (4x, 6x). Each scripted worst-case scene (__CTK.perf.scene,
// src/20b-test-perf.js) runs at each quality preset and throttle rate; the tool prints frame CPU p50/p95/p99, sim ms per step,
// per-system ms per step, render and HUD CPU ms, draw calls, instances, GC count and longest GC pause (trace), heap growth
// after forced GCs, and the boot time to the main menu.
// Usage: node tools/perf.mjs [--scenes tdm,horde,royale,generated,editor] [--presets potato,low,medium] [--throttle 4,6]
//        [--seconds 10] [--warmup 3] [--boot-runs 3] [--no-boot] [--no-scenes] [--alloc | --retained | --promoted] [--profile] [--json <file>] [--file <html>] [--timeout 1800]
// Exit code: 0 done (a budget miss is reported, not fatal), 3 runner error, 2 timeout. Budgets: PERF_BUDGETS below (PERF-002).
import { writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChrome, sleep } from './cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const list = (name, fallback) => option(name, fallback).split(',').map((value) => value.trim()).filter(Boolean);
const file = resolve(option('--file', join(ROOT, 'ClassTimeKiller.html')));
const scenes = list('--scenes', 'tdm,horde,royale,generated,editor');
const presets = list('--presets', 'potato,low,medium');
const throttles = list('--throttle', '4,6').map(Number);
const seconds = Number(option('--seconds', '10'));
const warmupSeconds = Number(option('--warmup', '3'));
const bootRuns = Number(option('--boot-runs', '3'));
const jsonFile = option('--json', '');
const retainedProfile = args.includes('--retained');   // the sites of what the recording allocated and still holds after a GC (heap growth)
const promotedProfile = args.includes('--promoted');   // the sites of what lived through a young-generation GC (what makes scavenges slow)
const allocSites = args.includes('--alloc') || retainedProfile || promotedProfile;   // print the top sites (the total rate is always measured)
const cpuProfile = args.includes('--profile');   // also print the functions with the most self time (CPU profiler)   // also print the top allocation sites of each recording (sampling heap profiler)
const timeoutSeconds = Number(option('--timeout', '1800'));
const BOOT_THROTTLES = [1, 4, 6];
const GC_EVENTS = ['MinorGC', 'MajorGC'];   // trace events of a main-thread GC pause (devtools.timeline)
const TRACE_CATEGORIES = 'devtools.timeline';
const ALLOC_SAMPLE_BYTES = 4096;          // sampling heap profiler interval (--alloc)
const ALLOC_TOP = 15;                     // allocation sites printed per run
const PROFILE_SAMPLE_US = 200;            // CPU profiler sampling interval (--profile)
// PERF-002 per 120 Hz step / per frame (ms); systems grouped as the spec groups them.
const PERF_BUDGETS = { sim: 2.0, movement: 0.5, ai: 1.0, projectiles: 0.3, rules: 0.2, render: 1.5, hud: 0.4, frameCpu: 5.5 };
const SYSTEM_GROUPS = { movement: ['move', 'bodies'], ai: ['botThink', 'pveBrains', 'nav'], projectiles: ['weapons', 'projectiles', 'weaponSpecials'],
  rules: ['rules', 'mutators', 'pve', 'pveBoss', 'operationTickets'] };

let session = null;
const finish = async (code) => { if (session) await session.close(); process.exit(code); };
const killer = setTimeout(() => { console.log('TIMEOUT after ' + timeoutSeconds + ' s'); finish(2); }, timeoutSeconds * 1000);
const fixed = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits === undefined ? 2 : digits) : '-');

async function throttle(rate) { await session.send('Emulation.setCPUThrottlingRate', { rate }); }

// Boot: navigation start to the loop start (Perf.bootMs: parse + boot of the whole file), per throttle rate; median of the runs.
async function measureBoot() {
  const results = {};
  for (const rate of BOOT_THROTTLES) {
    const runs = [];
    for (let run = 0; run < bootRuns; run++) {
      await throttle(rate);
      await session.open(file);
      runs.push(await session.evaluate('__CTK.perf.stats().bootMs'));
      await throttle(1);
    }
    runs.sort((a, b) => a - b);
    results[rate] = { median: runs[Math.floor(runs.length / 2)], first: runs[0], runs };
    console.log('BOOT ' + rate + 'x: median ' + fixed(results[rate].median, 0) + ' ms (' + runs.map((ms) => fixed(ms, 0)).join(', ') + ')');
  }
  return results;
}

// GC pauses from a trace of the recording (count, longest, total).
function startTrace() {
  const events = [];
  const collect = (params) => { for (const event of params.value) if (GC_EVENTS.includes(event.name) && event.dur) events.push(event); };
  session.on('Tracing.dataCollected', collect);
  return session.send('Tracing.start', { categories: TRACE_CATEGORIES, transferMode: 'ReportEvents' }).then(() => ({ events, collect }));
}

async function stopTrace(trace) {
  let completed = null;
  const complete = new Promise((done) => { completed = done; session.on('Tracing.tracingComplete', completed); });
  await session.send('Tracing.end', {});
  await complete;
  session.off('Tracing.tracingComplete', completed);
  session.off('Tracing.dataCollected', trace.collect);
  const summary = (name) => {
    const pauses = trace.events.filter((event) => event.name === name).map((event) => event.dur / 1000);
    return { count: pauses.length, maxMs: pauses.length ? Math.max(...pauses) : 0, totalMs: pauses.reduce((sum, ms) => sum + ms, 0) };
  };
  const minor = summary('MinorGC'), major = summary('MajorGC');
  return { count: minor.count + major.count, maxMs: Math.max(minor.maxMs, major.maxMs), totalMs: minor.totalMs + major.totalMs, minor, major };
}

async function startProfile() {
  if (!cpuProfile) return;
  await session.send('Profiler.enable', {});
  await session.send('Profiler.setSamplingInterval', { interval: PROFILE_SAMPLE_US });
  await session.send('Profiler.start', {});
}

// Self time per function over the recording, most first.
async function stopProfile() {
  if (!cpuProfile) return [];
  const profile = (await session.send('Profiler.stop', {})).result.profile;
  const selfTime = new Map(), byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const deltas = profile.timeDeltas;
  profile.samples.forEach((id, index) => {
    const frame = byId.get(id).callFrame, key = (frame.functionName || '(anonymous)') + ' :' + (frame.lineNumber + 1);
    selfTime.set(key, (selfTime.get(key) || 0) + (deltas[index] || 0) / 1000);
  });
  return [...selfTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, ALLOC_TOP).map(([site, ms]) => ({ site, ms }));
}

// Bytes allocated per function (self size of the sampled allocations, objects freed by GC included). The total over every
// site is the run's allocation rate (PERF-006: zero steady-state allocation).
async function startAllocations() {
  await session.send('HeapProfiler.enable', {});
  const collected = !retainedProfile;
  await session.send('HeapProfiler.startSampling', { samplingInterval: ALLOC_SAMPLE_BYTES, includeObjectsCollectedByMajorGC: collected || promotedProfile,
    includeObjectsCollectedByMinorGC: collected && !promotedProfile });
}

async function stopAllocations() {
  if (retainedProfile) await session.send('HeapProfiler.collectGarbage', {});
  const reply = await session.send('HeapProfiler.stopSampling', {});
  const sites = new Map();
  let total = 0;
  // A built-in (no script url, e.g. Math.hypot boxing its result) is listed with the script function that called it.
  const walk = (node, caller) => {
    const frame = node.callFrame, name = (frame.functionName || '(anonymous)') + ' :' + (frame.lineNumber + 1);
    const key = frame.url || !caller ? name : frame.functionName + ' <- ' + caller;
    if (node.selfSize) sites.set(key, (sites.get(key) || 0) + node.selfSize);
    total += node.selfSize;
    node.children.forEach((child) => walk(child, frame.url ? name : caller));
  };
  walk(reply.result.profile.head, '');
  const top = allocSites ? [...sites.entries()].sort((a, b) => b[1] - a[1]).slice(0, ALLOC_TOP) : [];
  return { totalKb: total / 1024, sites: top.map(([site, bytes]) => ({ site, kb: bytes / 1024 })) };
}

async function heapAfterGc() {
  await session.send('HeapProfiler.collectGarbage', {});
  const usage = await session.send('Runtime.getHeapUsage', {});
  return usage.result.usedSize;
}

function groupSystems(systems) {
  const groups = {};
  for (const group in SYSTEM_GROUPS) groups[group] = SYSTEM_GROUPS[group].reduce((sum, name) => sum + (systems[name] || 0), 0);
  return groups;
}

async function runScene(scene, preset, rate) {
  const info = await session.evaluate('__CTK.perf.scene(' + JSON.stringify(scene) + ', ' + JSON.stringify(preset) + ')');
  await throttle(rate);
  await sleep(warmupSeconds * 1000);
  const heapBefore = await heapAfterGc();
  const trace = await startTrace();
  await startAllocations();
  await startProfile();
  const report = await session.evaluate('__CTK.perf.record(' + seconds + ')');
  const gc = await stopTrace(trace);   // first: the retained profile forces a GC that must not count as a match GC
  const hotspots = await stopProfile();
  const allocations = await stopAllocations();
  const heapAfter = await heapAfterGc();
  await throttle(1);
  await session.evaluate('__CTK.perf.stop()');
  return { scene, preset, rate, info, report, gc, heapGrowthKb: (heapAfter - heapBefore) / 1024, heapMb: heapAfter / 1048576, groups: groupSystems(report.systems), allocations, hotspots };
}

// One line per run, then the budget misses of that run.
function printRun(run) {
  const r = run.report, g = run.groups;
  console.log([run.scene.padEnd(9), run.preset.padEnd(6), (run.rate + 'x').padEnd(3),
    'actors ' + String(run.info.alive).padStart(2) + '/' + String(run.info.actors).padStart(2),
    'frame p50/95/99 ' + fixed(r.frameMs.p50, 1) + '/' + fixed(r.frameMs.p95, 1) + '/' + fixed(r.frameMs.p99, 1),
    'cpu ' + fixed(r.cpuMs.p50) + '/' + fixed(r.cpuMs.p95) + '/' + fixed(r.cpuMs.p99),
    'sim/step ' + fixed(r.simMs.p50) + '/' + fixed(r.simMs.p95),
    'move ' + fixed(g.movement) + ' ai ' + fixed(g.ai) + ' proj ' + fixed(g.projectiles) + ' rules ' + fixed(g.rules),
    'render ' + fixed(r.renderMs.p50) + '/' + fixed(r.renderMs.p95), 'hud ' + fixed(r.hudMs.p95),
    'draws ' + fixed(r.drawCalls.p95, 0), 'inst ' + fixed(r.instances.p95, 0), 'scale ' + fixed(r.renderScale.p50),
    'gc minor ' + run.gc.minor.count + ' max ' + fixed(run.gc.minor.maxMs) + ' major ' + run.gc.major.count + ' max ' + fixed(run.gc.major.maxMs) + ' ms', 'alloc ' + fixed(run.allocations.totalKb / run.report.seconds, 0) + ' KB/s', 'heap ' + fixed(run.heapMb, 1) + ' MB ' + (run.heapGrowthKb >= 0 ? '+' : '') + fixed(run.heapGrowthKb, 0) + ' KB'].join(' | '));
  run.hotspots.forEach((entry) => console.log('    cpu ' + fixed(entry.ms / run.report.frames, 3).padStart(7) + ' ms/frame  ' + entry.site));
  run.allocations.sites.forEach((entry) => console.log('    alloc ' + fixed(entry.kb / seconds, 1).padStart(8) + ' KB/s  ' + entry.site));
  const misses = budgetMisses(run);
  if (misses.length) console.log('    over budget: ' + misses.join(', '));
}

function budgetMisses(run) {
  const r = run.report, g = run.groups, misses = [];
  const test = (name, value, limit) => { if (value > limit) misses.push(name + ' ' + fixed(value) + ' > ' + limit); };
  test('sim p95/step', r.simMs.p95, PERF_BUDGETS.sim);
  for (const group in SYSTEM_GROUPS) test(group + '/step', g[group], PERF_BUDGETS[group]);
  test('render p95', r.renderMs.p95, PERF_BUDGETS.render);
  test('hud p95', r.hudMs.p95, PERF_BUDGETS.hud);
  return misses;
}

async function main() {
  session = await openChrome({ flags: ['--enable-precise-memory-info'] });
  const output = { file, date: new Date().toISOString(), seconds, warmupSeconds, boot: null, runs: [] };
  if (!args.includes('--no-boot')) output.boot = await measureBoot();
  else await session.open(file);
  if (!args.includes('--no-scenes')) {
    for (const scene of scenes) {
      for (const preset of presets) {
        for (const rate of throttles) {
          const run = await runScene(scene, preset, rate);
          output.runs.push(run);
          printRun(run);
        }
      }
    }
  }
  const gameErrors = await session.evaluate('__CTK.log.errors()');
  gameErrors.concat(session.errors).forEach((line) => console.log('  ERROR ' + line));
  if (jsonFile) { writeFileSync(resolve(jsonFile), JSON.stringify(output, null, 1)); console.log('JSON ' + resolve(jsonFile)); }
}
main().then(() => { clearTimeout(killer); finish(0); }).catch((error) => { console.log('RUNNER ERROR ' + (error.stack || error.message)); clearTimeout(killer); finish(3); });
