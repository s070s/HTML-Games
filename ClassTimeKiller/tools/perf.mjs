// Low-end performance runs of ClassTimeKiller in headless Chrome (plan phase 18, spec s3 PERF). No dependencies (Chrome: tools/cdp.mjs).
// CDP Emulation.setCPUThrottlingRate stands in for low-end phones (4x, 6x). Each scripted worst-case scene (__CTK.perf.scene,
// src/20b-test-perf.js) runs at each quality preset and throttle rate; the tool prints frame CPU p50/p95/p99, sim ms per step,
// per-system ms per step, render and HUD CPU ms, draw calls, instances, GC count and longest GC pause (trace), heap growth
// after forced GCs, and the boot time to the main menu.
// Usage: node tools/perf.mjs [--scenes tdm,horde,royale,generated,editor] [--presets potato,low,medium] [--throttle 4,6]
//        [--seconds 10] [--warmup 3] [--boot-runs 3] [--no-boot] [--no-scenes] [--alloc | --retained | --promoted] [--profile] [--reaction]
//        [--soak <minutes>] [--json <file>] [--file <html>] [--timeout 1800]
// --soak: the first scene at the first preset, unthrottled, for that many minutes; the heap after a forced GC every minute
// (PERF-006 step 18.4: the heap must not grow steadily) and the GC pauses of each minute.
// Exit code: 0 done (a budget miss is reported, not fatal), 3 runner error, 2 timeout. Budgets: PERF_BUDGETS below (PERF-002).
import { writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChrome, sleep } from './cdp.mjs';

// --help prints the usage; an unknown option stops before Chrome starts (a typo must not start a 20 minute sweep).
function checkArguments() {
  if (args.includes('--help')) { console.log(USAGE); process.exit(0); }
  for (let i = 0; i < args.length; i++) {
    if (VALUE_OPTIONS.includes(args[i])) { i++; continue; }
    if (FLAG_OPTIONS.includes(args[i])) continue;
    console.error('perf: unknown option ' + args[i]);
    console.error(USAGE);
    process.exit(3);
  }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const VALUE_OPTIONS = ['--scenes', '--presets', '--throttle', '--seconds', '--warmup', '--boot-runs', '--json', '--file', '--timeout', '--soak'];
const FLAG_OPTIONS = ['--no-boot', '--no-scenes', '--alloc', '--retained', '--promoted', '--profile', '--reaction'];
const USAGE = [
  'Usage: node tools/perf.mjs [--scenes tdm,horde,royale,generated,editor] [--presets potato,low,medium] [--throttle 4,6]',
  '       [--seconds 10] [--warmup 3] [--boot-runs 3] [--no-boot] [--no-scenes] [--alloc | --retained | --promoted] [--profile] [--reaction]',
  '       [--soak <minutes>] [--json <file>] [--file <html>] [--timeout 1800]   (docs/PERFORMANCE.md)',
].join('\n');
checkArguments();
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
const cpuProfile = args.includes('--profile');   // also print the functions with the most self time (CPU profiler)
const timeoutSeconds = Number(option('--timeout', '1800'));
const reactionRun = args.includes('--reaction');   // also check that dynamic resolution and the quality step-down react and recover
const soakMinutes = Number(option('--soak', '0'));
const SOAK_SAMPLE_MS = 60000;   // one heap sample (after a forced GC) per minute
const REACTION_PHASES = [{ rate: 1, seconds: 6 }, { rate: 6, seconds: 14 }, { rate: 1, seconds: 12 }];   // fast, slow, fast again
const REACTION_SAMPLE_MS = 1000;
const REACTION_VIEW = { width: 480, height: 270, deviceScaleFactor: 1, mobile: false };   // small: software WebGL can hold 60 fps at 1x
const BOOT_THROTTLES = [1, 4, 6];
const GC_EVENTS = ['MinorGC', 'MajorGC'];   // trace events of a main-thread GC pause (devtools.timeline)
const TRACE_CATEGORIES = 'devtools.timeline';
const ALLOC_SAMPLE_BYTES = 4096;          // sampling heap profiler interval (--alloc)
const ALLOC_TOP = 15;                     // allocation sites printed per run
const PROFILE_SAMPLE_US = 200;            // CPU profiler sampling interval (--profile)
// PERF-002 per 120 Hz step / per frame (ms); systems grouped as the spec groups them.
const PERF_BUDGETS = { sim: 2.0, movement: 0.5, ai: 1.0, projectiles: 0.3, rules: 0.2, render: 1.5, hud: 0.4, frameCpu: 5.5 };
const STEPS_PER_BUDGET_FRAME = 1;   // PERF-002 budgets a 120 fps frame: one 120 Hz sim step
// Frame CPU of a 120 fps frame: the frame's own cost without its sim steps, plus one step. Headless frames run at about
// 30 fps (software WebGL), so a raw frame carries about 4 sim steps and would count the sim four times against the budget.
const frameCpuAt120 = (report) => report.cpuMs.mean - report.simFrameMs.mean + STEPS_PER_BUDGET_FRAME * report.simMs.mean;
const SYSTEM_GROUPS = { movement: ['move', 'bodies'], ai: ['botThink', 'pveBrains', 'nav'], projectiles: ['weapons', 'projectiles', 'weaponSpecials'],
  rules: ['rules', 'mutators', 'pve', 'pveBoss', 'operationTickets'] };

let session = null;
const finish = async (code) => { if (session) await session.close(); process.exit(code); };
const killer = setTimeout(() => { console.log('TIMEOUT after ' + timeoutSeconds + ' s'); finish(2); }, timeoutSeconds * 1000);
const fixed = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits === undefined ? 2 : digits) : '-');

async function throttle(rate) { await session.send('Emulation.setCPUThrottlingRate', { rate }); }

// Waits for the first drawn frame (Perf.bootMs is stamped at its end) and returns both boot stamps.
const BOOT_STAMPS = 'new Promise((done) => { const wait = () => { const stats = __CTK.perf.stats(); if (stats.bootMs) done({ loopStartMs: stats.loopStartMs, bootMs: stats.bootMs }); else requestAnimationFrame(wait); }; wait(); })';
const median = (values) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];

// Boot: navigation start to the main menu's first drawn frame (Perf.bootMs: parse + boot of the whole file, menu build,
// first frame with its shader compiles) and to the loop start (Perf.loopStartMs), per throttle rate; median of the runs.
async function measureBoot() {
  const results = {};
  for (const rate of BOOT_THROTTLES) {
    const runs = [];
    for (let run = 0; run < bootRuns; run++) {
      await throttle(rate);
      await session.open(file);
      runs.push(await session.evaluate(BOOT_STAMPS));
      await throttle(1);
    }
    const menu = runs.map((stamps) => stamps.bootMs), loop = runs.map((stamps) => stamps.loopStartMs);
    results[rate] = { median: median(menu), loopStartMedian: median(loop), runs };
    console.log('BOOT ' + rate + 'x: first menu frame median ' + fixed(results[rate].median, 0) + ' ms (' + menu.map((ms) => fixed(ms, 0)).join(', ') + '), loop start median '
      + fixed(results[rate].loopStartMedian, 0) + ' ms');
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
// Means first: under CDP throttling Chrome suspends the main thread in slices, so one frame's time grows by whole slices
// and the percentiles show those slices; the mean is the honest per-frame cost (docs/PERFORMANCE.md).
function printRun(run) {
  const r = run.report, g = run.groups, info = r.info;
  console.log([run.scene.padEnd(9), run.preset.padEnd(6), (run.rate + 'x').padEnd(3),
    'actors ' + String(info.alive).padStart(2) + '/' + String(info.actors).padStart(2),
    'frame p50/95/99 ' + fixed(r.frameMs.p50, 1) + '/' + fixed(r.frameMs.p95, 1) + '/' + fixed(r.frameMs.p99, 1),
    'cpu mean ' + fixed(r.cpuMs.mean) + ' @120 ' + fixed(frameCpuAt120(r)) + ' p50/95/99 ' + fixed(r.cpuMs.p50) + '/' + fixed(r.cpuMs.p95) + '/' + fixed(r.cpuMs.p99),
    'sim/step mean ' + fixed(r.simMs.mean) + ' p95 ' + fixed(r.simMs.p95),
    'move ' + fixed(g.movement) + ' ai ' + fixed(g.ai) + ' proj ' + fixed(g.projectiles) + ' rules ' + fixed(g.rules),
    'render mean ' + fixed(r.renderMs.mean) + ' p50 ' + fixed(r.renderMs.p50) + ' p95 ' + fixed(r.renderMs.p95), 'hud mean ' + fixed(r.hudMs.mean) + ' p50 ' + fixed(r.hudMs.p50) + ' p95 ' + fixed(r.hudMs.p95),
    'draws ' + fixed(r.drawCalls.p95, 0), 'inst ' + fixed(r.instances.p95, 0), 'scale ' + fixed(r.renderScale.p50),
    'gc minor ' + run.gc.minor.count + ' max ' + fixed(run.gc.minor.maxMs) + ' major ' + run.gc.major.count + ' max ' + fixed(run.gc.major.maxMs) + ' ms', 'alloc ' + fixed(run.allocations.totalKb / run.report.seconds, 0) + ' KB/s', 'heap ' + fixed(run.heapMb, 1) + ' MB ' + (run.heapGrowthKb >= 0 ? '+' : '') + fixed(run.heapGrowthKb, 0) + ' KB'].join(' | '));
  run.hotspots.forEach((entry) => console.log('    cpu ' + fixed(entry.ms / run.report.frames, 3).padStart(7) + ' ms/frame  ' + entry.site));
  run.allocations.sites.forEach((entry) => console.log('    alloc ' + fixed(entry.kb / run.report.seconds, 1).padStart(8) + ' KB/s  ' + entry.site));
  const misses = budgetMisses(run);
  if (misses.length) console.log('    over budget: ' + misses.join(', '));
}

function budgetMisses(run) {
  const r = run.report, g = run.groups, misses = [];
  const test = (name, value, limit) => { if (value > limit) misses.push(name + ' ' + fixed(value) + ' > ' + limit); };
  test('sim/step', r.simMs.mean, PERF_BUDGETS.sim);
  for (const group in SYSTEM_GROUPS) test(group + '/step', g[group], PERF_BUDGETS[group]);
  test('render', r.renderMs.mean, PERF_BUDGETS.render);
  test('hud', r.hudMs.mean, PERF_BUDGETS.hud);
  test('frame cpu @120', frameCpuAt120(r), PERF_BUDGETS.frameCpu);
  return misses;
}

// Dynamic resolution (PERF-007) and step-down (PERF-013) under throttling: the scale drops and the preset steps down
// while the CPU is slow, and the scale climbs again once it is fast (a stepped-down preset stays, by design).
async function measureReaction() {
  await session.send('Emulation.setDeviceMetricsOverride', REACTION_VIEW);
  await session.evaluate('__CTK.perf.scene("tdm", "medium", { autoLower: true })');
  const timeline = [];
  for (const phase of REACTION_PHASES) {
    await throttle(phase.rate);
    for (let waited = 0; waited < phase.seconds * 1000; waited += REACTION_SAMPLE_MS) {
      await sleep(REACTION_SAMPLE_MS);
      const info = await session.evaluate('__CTK.perf.info()');
      timeline.push({ rate: phase.rate, scale: info.renderScale, quality: info.quality, frameMs: info.smoothedFrameMs, toasts: info.toasts });
    }
  }
  await throttle(1);
  await session.evaluate('__CTK.perf.stop()');
  await session.send('Emulation.clearDeviceMetricsOverride', {});
  console.log('REACTION ' + timeline.map((t) => t.rate + 'x:' + fixed(t.scale) + '/' + t.quality + '/' + fixed(t.frameMs, 0) + 'ms').join(' '));
  return timeline;
}

// Long session (step 18.4): heap after a forced GC once a minute, with the GC pauses of each minute (trace).
async function measureSoak() {
  const scene = scenes[0], preset = presets[0], samples = [];
  await session.evaluate('__CTK.perf.scene(' + JSON.stringify(scene) + ', ' + JSON.stringify(preset) + ')');
  samples.push({ minute: 0, heapMb: (await heapAfterGc()) / 1048576 });
  for (let minute = 1; minute <= soakMinutes; minute++) {
    const trace = await startTrace();
    await sleep(SOAK_SAMPLE_MS);
    const gc = await stopTrace(trace);
    const info = await session.evaluate('__CTK.perf.info()');
    samples.push({ minute, heapMb: (await heapAfterGc()) / 1048576, gcCount: gc.count, gcMaxMs: gc.maxMs, alive: info.alive });
    const last = samples[samples.length - 1];
    console.log('SOAK ' + scene + ' ' + preset + ' minute ' + minute + ': heap ' + fixed(last.heapMb) + ' MB (' + (last.heapMb >= samples[minute - 1].heapMb ? '+' : '')
      + fixed((last.heapMb - samples[minute - 1].heapMb) * 1024, 0) + ' KB), GCs ' + gc.count + ' longest ' + fixed(gc.maxMs) + ' ms, alive ' + info.alive);
  }
  await session.evaluate('__CTK.perf.stop()');
  return samples;
}

async function main() {
  session = await openChrome({ flags: ['--enable-precise-memory-info'] });
  const output = { file, date: new Date().toISOString(), seconds, warmupSeconds, boot: null, runs: [] };
  if (!args.includes('--no-boot')) output.boot = await measureBoot();
  else await session.open(file);
  if (reactionRun) output.reaction = await measureReaction();
  if (soakMinutes > 0) output.soak = await measureSoak();
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
