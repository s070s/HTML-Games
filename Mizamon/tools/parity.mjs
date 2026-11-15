// The parity proof of the DEV-02 data move (reference section 13.12): everything that shows the game plays as it did before the
// content moved into data/. The baseline files in tests/baseline/ were made from main at the start of DEV-02b (commit in
// tests/baseline/BASELINE.txt) by this file; the rule tests make the same numbers from the current page and compare.
//
//   node Mizamon/tools/parity.mjs --write <folder> [--root <Mizamon folder>] [--balance-runs <n>]
//
// writes rules-tables.json, replay.json, migrated-saves.json, sound-calls.json and balance-output.txt into <folder>.
// Node built-ins only.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { MIZAMON_ROOT, assembleFromDisk } from './assemble.mjs';

export const BALANCE_RUNS = 40; // runs per row of the balance output that is compared (the default 500 takes minutes)
export const REPLAY_BATTLES = 1000;
// Rules constants that RULES does not export; read from inside the rules block (a name the page does not declare is left out:
// TYPE_COLORS was an engine table before DEV-02b).
export const INTERNAL_NAMES = ['CRIT_MULT', 'STAB_MULT', 'PRIZE_PER_LEVEL', 'OVERTIME_STEP', 'STAT_INDEX', 'BLACKOUT_MONEY_KEEP', 'XP_DIVISOR', 'TRAINER_XP_BONUS', 'XP_SCALE_FROM', 'TYPE_COLORS'];

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function rulesBlock(page) {
  const begin = page.indexOf('\n// RULES-BEGIN\n');
  const end = page.indexOf('\n// RULES-END\n');
  if (begin < 0 || end < begin) throw new Error('the page has no rules block');
  return page.slice(begin + 1, end);
}

// Runs the rules block of a page in a vm and returns RULES with the named internals under __internals.
export function loadRulesWithInternals(page, internalNames = INTERNAL_NAMES, extraExpression = '{}') {
  const picks = internalNames.map((name) => `if (typeof ${name} !== 'undefined') RULES.__internals.${name} = ${name};`).join('\n');
  const code = `(function () {\n${rulesBlock(page)}\nRULES.__internals = {};\n${picks}\nRULES.__extra = ${extraExpression};\nreturn RULES;\n})()`;
  return new vm.Script(code).runInNewContext({}, { timeout: 10000 });
}

// ---- Tables ---------------------------------------------------------------------------------------------------------------------
// Every value of RULES that is not a function, plus the internals, as plain JSON values (key order is kept by JSON.stringify).
export function tableSnapshot(rules, typeColors = null) {
  const tables = {};
  for (const name of Object.keys(rules)) {
    if (name.startsWith('__') || typeof rules[name] === 'function') continue;
    tables[name] = JSON.parse(JSON.stringify(rules[name]));
  }
  for (const name of Object.keys(rules.__internals)) tables[name] = JSON.parse(JSON.stringify(rules.__internals[name]));
  if (typeColors) tables.TYPE_COLORS = typeColors;
  return tables;
}

// The type colours were an engine table before DEV-02b (src/engine/00-screen.js); after it, a rules table.
export function typeColorsOfOldPage(page) {
  const found = /^const TYPE_COLORS = (\{.*\});$/m.exec(page);
  if (!found) throw new Error('no TYPE_COLORS line in the page');
  return JSON.parse(JSON.stringify(new vm.Script('(' + found[1] + ')').runInNewContext({})));
}

// ---- Replays --------------------------------------------------------------------------------------------------------------------
function randomParty(R, rng, size) {
  const ids = Object.keys(R.SPECIES);
  const party = [];
  for (let i = 0; i < size; i++) party.push(R.makeMon(R.pickOne(rng, ids), R.randInt(rng, 5, 15)));
  return party;
}
function replaySample(R, seed, count) {
  const rng = R.makeRng(seed);
  let total = 0;
  let wins = 0;
  const events = [];
  for (let i = 0; i < count; i++) {
    const result = R.simulateBattle(randomParty(R, rng, 3), randomParty(R, rng, 3), rng, {});
    total = (total + result.checksum) >>> 0;
    wins += result.winner === 0 ? 1 : 0;
    if (i < 40) events.push(result.battle.events);
  }
  return { total, wins, eventsSha256: sha256(JSON.stringify(events)) };
}

// The 1,000-battle replay checksums, and one fight against every trainer for each starter the rival can answer.
export function replaySummary(R) {
  const trainers = {};
  for (const id of Object.keys(R.TRAINERS)) {
    trainers[id] = {};
    for (const starter of R.STARTERS) {
      const foe = R.buildTrainerTeam(id, starter);
      const topLevel = Math.max(...foe.map((mon) => mon.lv));
      const rng = R.makeRng(R.hashString(id + starter));
      const player = [R.makeMon(starter, topLevel), R.makeMon(starter, topLevel), R.makeMon(starter, topLevel)];
      const result = R.simulateBattle(player, foe, rng, { foeItems: R.TRAINERS[id].items, playerItems: ['souvlaki', 'souvlaki'] });
      trainers[id][starter] = { team: foe.map((mon) => R.serializeMon(mon)), checksum: result.checksum, winner: result.winner, turns: result.turns };
    }
  }
  return {
    battles: REPLAY_BATTLES,
    seed2024: replaySample(R, 2024, REPLAY_BATTLES),
    seed7: replaySample(R, 7, 300),
    trainers,
    encounters: encounterSummary(R),
  };
}

// A wild encounter roll for every zone of every map, over 30 seeded steps.
function encounterSummary(R) {
  const summary = {};
  for (const [mapId, map] of Object.entries(R.MAPS)) {
    if (!map.zones) continue;
    const rng = R.makeRng(R.hashString(mapId));
    const rolls = [];
    for (let step = 0; step < 30; step++) {
      const x = (step * 7) % map.w;
      rolls.push(R.rollEncounter(rng, map, x, 0));
    }
    summary[mapId] = rolls;
  }
  return summary;
}

// ---- Saves ----------------------------------------------------------------------------------------------------------------------
// migrateSave on saves of every version and at the story points (after the starter, each badge, the credits, the ending).
export function migratedSaves(R) {
  const badgeFlags = Object.values(R.WORLD.districts).map((district) => district.badgeFlag);
  const party = [R.makeMon('komma', 12), R.makeMon('fakelakis', 9), R.makeMon('storoula', 7)].map((mon) => R.serializeMon(mon));
  const save = (map, x, y, flags) => ({
    version: 3, player: { name: 'ΜΑΡΙΑ', gender: 'f', map, x, y, dir: 'left' }, party, money: 1234, bag: { fakelaki: 3, souvlaki: 2 },
    dex: { seen: { komma: true }, got: { komma: true } }, flags, lastHeal: { map: 'hospital', x: 5, y: 7, dir: 'up' }, rngState: 99,
  });
  const results = {};
  results.v0 = R.migrateSave({ name: 'Α', drachmas: 5, team: [{ id: 'komma', lv: 5 }], map: 'town', x: 5, y: 8, items: { fakelaki: 2 }, girl: true });
  results.v0Lab = R.migrateSave({ v: 0, name: 'Α', drachmas: 5, team: [{ id: 'komma', lv: 5 }], map: 'lab', x: 4, y: 6 });
  results.v1 = R.migrateSave({ version: 1, player: { name: 'ΝΙΚΟΣ', gender: 'm', map: 'kep', x: 4, y: 6, dir: 'down' }, party, money: 50, bag: {}, dex: { seen: {}, got: {} }, flags: { gotStarter: true, rival1: true }, lastHeal: { map: 'kep', x: 4, y: 6, dir: 'down' }, rngState: 1, starter: 'komma' });
  results.v2 = R.migrateSave({ ...save('route1', 1, 9, { gotStarter: true, rival1: true }), version: 2 });
  results.newer = R.migrateSave({ ...save('town', 5, 8, {}), version: 4 });
  const points = { starter: { gotStarter: true }, rival: { gotStarter: true, rival1: true, t_rival1: true } };
  const flagsSoFar = { gotStarter: true, rival1: true };
  badgeFlags.forEach((flag, index) => {
    flagsSoFar[flag] = true;
    points['badge' + (index + 1)] = { ...flagsSoFar };
  });
  points.credits = { ...flagsSoFar, credits: true };
  points.ending = { ...flagsSoFar, credits: true, ending: true };
  for (const [name, flags] of Object.entries(points)) {
    const place = name === 'ending' ? ['parliament_roof', 4, 6] : ['town', 5, 8];
    results['v3_' + name] = R.migrateSave(save(place[0], place[1], place[2], flags));
    results['v2_' + name] = R.migrateSave({ ...save(place[0], place[1], place[2], flags), version: 2 });
  }
  return JSON.parse(JSON.stringify(results));
}

// ---- Sound ----------------------------------------------------------------------------------------------------------------------
// A fake AudioContext that logs every oscillator and gain call, run on the Sound code of the engine fragment. The tune lists are
// four loops (STEPS_PER_LOOP steps each) of every tune; an effect is played once. Returns { id: { calls, sha256 } }.
export const STEPS_PER_LOOP = 32;
export const LOOPS = 4;

export function makeFakeAudio() {
  const log = [];
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    resume() {}
    createGain() {
      const record = { node: 'gain', set: [], ramp: [] };
      return { gain: { value: 1, setValueAtTime: (v, t) => record.set.push([v, t]), linearRampToValueAtTime: (v, t) => record.ramp.push([v, t]) }, connect: (target) => { record.to = target && target.__record ? 'osc' : 'out'; }, __record: record };
    }
    createOscillator() {
      const record = { node: 'osc', type: null, freq: [], slide: [], start: null, stop: null, gain: null };
      log.push(record);
      const oscillator = {
        __record: record,
        set type(value) { record.type = value; },
        frequency: { setValueAtTime: (v, t) => record.freq.push([v, t]), linearRampToValueAtTime: (v, t) => record.slide.push([v, t]) },
        connect: (gainNode) => { record.gain = gainNode.__record; },
        start: (t) => { record.start = t; },
        stop: (t) => { record.stop = t; },
      };
      return oscillator;
    }
  }
  return { FakeAudioContext, log };
}

// soundSource: the text of src/engine/06-sound.js; dataSource: the DATA line block of the page ('' before DEV-02b);
// bpmOf(trackId): the tempo of a tune; ids: { effects: [...], tunes: [...] }.
export function soundCalls(soundSource, dataSource, bpmOf, ids) {
  const out = {};
  const run = (action) => {
    const { FakeAudioContext, log } = makeFakeAudio();
    const timers = [];
    const sandbox = { window: { AudioContext: FakeAudioContext }, setInterval: (fn) => { timers.push(fn); return timers.length; }, clearInterval: () => {} };
    const code = `${dataSource}\nconst OPT = { sound: true };\n${soundSource}\n;({ Sound })`;
    const { Sound } = new vm.Script(code).runInNewContext(sandbox, { timeout: 10000 });
    Sound.unlock();
    log.length = 0;
    action(Sound, log);
    return log;
  };
  for (const id of ids.effects) {
    const log = run((Sound) => Sound.sfx(id));
    out['sfx:' + id] = { calls: log.length, sha256: sha256(JSON.stringify(log)) };
  }
  for (const id of ids.tunes) {
    const stepLength = 60 / bpmOf(id) / 2;
    const log = run((Sound, records) => {
      Sound.play(id);
      const horizon = Sound.nextTime + LOOPS * STEPS_PER_LOOP * stepLength - 1e-9;
      let guard = 0;
      while (Sound.nextTime < horizon && guard++ < 10000) {
        Sound.context.currentTime += 0.05;
        Sound.schedule();
      }
      const kept = records.filter((record) => record.start < horizon);
      records.length = 0;
      records.push(...kept);
    });
    out['music:' + id] = { calls: log.length, sha256: sha256(JSON.stringify(log)) };
  }
  return out;
}

// The text between the data markers of a page ('' when there is none).
export function dataBlockOf(page) {
  const begin = page.indexOf('\n/*DATA-BEGIN*/\n');
  const end = page.indexOf('\n/*DATA-END*/\n');
  return begin < 0 || end < begin ? '' : page.slice(begin + 1, end + '\n/*DATA-END*/\n'.length);
}

// ---- Balance output -------------------------------------------------------------------------------------------------------------
export function balanceOutput(runs, root = MIZAMON_ROOT, html = null) {
  const env = { ...process.env };
  delete env.MZ_TEST_FILTER;
  if (html) env.MZ_HTML = html; else delete env.MZ_HTML;
  const result = spawnSync(process.execPath, [join(root, 'tools', 'balance.mjs'), String(runs)], { encoding: 'utf8', env, timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('balance.mjs failed: ' + result.stderr);
  return result.stdout;
}

// ---- Baseline writer ------------------------------------------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const folder = option('--write', null);
  if (!folder) {
    console.error('usage: node Mizamon/tools/parity.mjs --write <folder> [--root <Mizamon folder>] [--balance-runs <n>]');
    process.exit(2);
  }
  const root = resolve(option('--root', MIZAMON_ROOT));
  const page = assembleFromDisk(root);
  const rules = loadRulesWithInternals(page);
  mkdirSync(folder, { recursive: true });
  const write = (name, value) => writeFileSync(join(folder, name), typeof value === 'string' ? value : JSON.stringify(value) + '\n');
  const typeColors = typeColorsOfOldPage(page);
  const tables = tableSnapshot(rules, typeColors);
  // The old sound tables, as JSON, so the new data format can be compared with them as well.
  const engineText = page.slice(page.indexOf('// ENGINE: everything below'));
  const oldSound = new vm.Script(`${engineText.slice(engineText.indexOf('const MUSIC_TRACKS'), engineText.indexOf('const Sound = {'))}\n({ MUSIC_TRACKS, SFX_PATTERNS })`).runInNewContext({});
  write('rules-tables.json', { tables, engineTables: JSON.parse(JSON.stringify(oldSound)) });
  write('replay.json', replaySummary(rules));
  write('migrated-saves.json', migratedSaves(rules));
  const soundSource = readFileSync(join(root, 'src', 'engine', '06-sound.js'), 'utf8');
  write('sound-calls.json', soundCalls(soundSource, dataBlockOf(page), (id) => oldSound.MUSIC_TRACKS[id].bpm, { effects: Object.keys(oldSound.SFX_PATTERNS), tunes: Object.keys(oldSound.MUSIC_TRACKS) }));
  const runs = Number(option('--balance-runs', BALANCE_RUNS));
  write('balance-output.txt', balanceOutput(runs, root).split('\r\n').join('\n'));
  write('balance-runs.json', { runs });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
