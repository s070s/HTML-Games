// Builds Mizamon/build/index.html (reference section 13.5, steps 1, 3, 4 and 6; validation and the in-page checks come later).
//
//   node Mizamon/tools/build.mjs [--check] [--no-tests] [--out <folder>] [--root <folder>] [--json]
//
// Takes the build lock, assembles the page from src/, runs the rule tests on it (MZ_HTML) and writes
// <out>/index.html and <out>/build-report.json (the source hash and the SHA-256 of index.html). --check writes nothing.
// --no-tests skips the tests for a quick look: the report then says "untested" and the itch push refuses it.
// <out> is Mizamon/build by default; --root is the Mizamon folder to build (default: the one this file lives in).
// Exit codes: 0 built, 1 a problem and nothing written, 2 usage error, 3 input/output error.
import { spawn } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from '../shared/assemble-core.mjs';
import { MIZAMON_ROOT, assembleFromDisk, sourceHashFromDisk } from './assemble.mjs';

export const EXIT = Object.freeze({ built: 0, problem: 1, usage: 2, io: 3 });
const USAGE = 'usage: node Mizamon/tools/build.mjs [--check] [--no-tests] [--out <folder>] [--root <folder>] [--json]';
const LOCK_NAME = '.lock';
const STALE_UNREADABLE_LOCK_MS = 60 * 1000; // a lock file that never got its content (a crash while writing it)
const TEST_TIME_LIMIT_MS = 30 * 60 * 1000; // the strict run measured about 15 minutes (913 s) on this PC
const SIZE_WARN_BYTES = 4 * 1024 * 1024; // phone loading
const SIZE_STOP_BYTES = 16 * 1024 * 1024;
const SCRATCH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RENAME_RETRY_WAITS_MS = [100, 200, 400, 800]; // 5 tries: antivirus may hold a file for a moment
// The CSP of reference section 1: the page may load nothing and fetch nothing.
const EXPECTED_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:";
const CSP_META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/;

export class BuildError extends Error {
  constructor(message, exitCode = EXIT.problem) {
    super(message);
    this.exitCode = exitCode;
  }
}

function isProcessRunning(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM'; // it exists but belongs to someone else
  }
}

function clockTime(isoText) {
  const date = new Date(isoText);
  return Number.isNaN(date.getTime()) ? isoText : date.toTimeString().slice(0, 5);
}

// One build at a time, for the command line and the editor's server alike: the lock is created with the exclusive flag
// and holds the process id and the start time. Returns { release, note } (note is set when a stale lock was removed).
export function acquireLock(folder) {
  mkdirSync(folder, { recursive: true });
  const lockPath = join(folder, LOCK_NAME);
  let note = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const startedAt = new Date().toISOString();
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt }), { flag: 'wx' });
      return { note, release: () => releaseLock(lockPath) };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const holder = readLock(lockPath);
    if (holder && isProcessRunning(holder.pid)) throw new BuildError(`a build is running (since ${clockTime(holder.startedAt)})`);
    const rawContent = holder ? null : readRaw(lockPath);
    if (!holder) {
      const ageMs = lockAgeMs(lockPath);
      if (ageMs === null) continue; // it vanished: the next exclusive create succeeds or reads the new live lock
      if (ageMs < STALE_UNREADABLE_LOCK_MS) throw new BuildError('a build is starting');
    }
    // Two builds may both find the same stale lock: only one rename of it succeeds, then the exclusive create above decides.
    const renamedPath = `${lockPath}.stale-${process.pid}-${randomBytes(4).toString('hex')}`;
    try {
      renameSync(lockPath, renamedPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error; // another build already moved it away: try the create again
      continue;
    }
    if (!isSameLock(renamedPath, holder, rawContent)) {
      // The file renamed is not the one judged stale: another build replaced it in between, so a live lock was moved. Put it back.
      try {
        linkSync(renamedPath, lockPath); // exclusive: it fails if yet another lock was created meanwhile
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      rmSync(renamedPath, { force: true });
      throw new BuildError('a build is running');
    }
    note = holder ? `removed the lock of process ${holder.pid}, which no longer runs` : 'removed an unreadable lock file';
    removeStaleLocks(folder);
  }
  throw new BuildError('could not take the build lock');
}

function lockAgeMs(lockPath) {
  try {
    return Date.now() - statSync(lockPath).mtimeMs;
  } catch {
    return null; // it vanished
  }
}

function readRaw(lockPath) {
  try {
    return readFileSync(lockPath, 'utf8');
  } catch {
    return null;
  }
}

// True when the renamed file is the lock that was read before: same pid and start time, or the same raw text when it was unreadable.
function isSameLock(renamedPath, holder, rawContent) {
  if (!holder) return readRaw(renamedPath) === rawContent;
  const renamed = readLock(renamedPath);
  return renamed !== null && renamed.pid === holder.pid && renamed.startedAt === holder.startedAt;
}

function removeStaleLocks(folder) {
  for (const name of readdirSync(folder)) {
    if (name.startsWith(`${LOCK_NAME}.stale-`)) rmSync(join(folder, name), { force: true });
  }
}

function readLock(lockPath) {
  try {
    const holder = JSON.parse(readFileSync(lockPath, 'utf8'));
    return Number.isInteger(holder.pid) ? holder : null;
  } catch {
    return null;
  }
}

function releaseLock(lockPath) {
  const holder = readLock(lockPath);
  if (holder && holder.pid === process.pid) rmSync(lockPath, { force: true });
}

// Checks of the assembled page that need no test run: the CSP meta is section 1's, the size is sane.
export function checkPage(html) {
  const warnings = [];
  const csp = CSP_META.exec(html);
  if (!csp || csp[1] !== EXPECTED_CSP) throw new BuildError('the CSP meta tag is not the one of reference section 1');
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > SIZE_STOP_BYTES) throw new BuildError(`the page is ${bytes} bytes, above the 16 MB limit`);
  if (bytes > SIZE_WARN_BYTES) warnings.push(`the page is ${bytes} bytes, above 4 MB (slow to load on a phone)`);
  return warnings;
}

function removeOldScratchFolders(scratchRoot) {
  if (!existsSync(scratchRoot)) return;
  for (const name of readdirSync(scratchRoot)) {
    const folder = join(scratchRoot, name);
    if (Date.now() - statSync(folder).mtimeMs > SCRATCH_MAX_AGE_MS) rmSync(folder, { recursive: true, force: true });
  }
}

// Runs run-tests.mjs of the built root on the candidate page (MZ_HTML) in a child process.
function runRuleTests(root, pagePath) {
  return new Promise((resolveTests) => {
    // The full run, always: a filter or a page path inherited from the parent would test a subset or another page.
    const env = { ...process.env };
    delete env.MZ_TEST_FILTER;
    delete env.MZ_HTML;
    env.MZ_HTML = pagePath;
    const child = spawn(process.execPath, [join(root, 'tools', 'run-tests.mjs')], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const timer = setTimeout(() => child.kill(), TEST_TIME_LIMIT_MS);
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      const summary = /^PASS (\d+) \/ (\d+)(?: \((\d+) skipped\))?$/m.exec(output); // "PASS n / m" or "PASS n / m (k skipped)"
      const failures = output.split('\n').filter((line) => line.startsWith('FAIL ')).map((line) => line.slice(5).trim());
      resolveTests({
        ran: true,
        exitCode,
        passed: summary ? Number(summary[1]) : 0,
        total: summary ? Number(summary[2]) : 0,
        skipped: summary && summary[3] ? Number(summary[3]) : 0,
        failures: summary || failures.length > 0 ? failures : [`the test run ended without a summary (exit code ${exitCode}): ${output.trim().split('\n').slice(-3).join(' | ')}`],
      });
    });
  });
}

// index.html first, then the report: a crash between the two renames leaves a new page beside the old report, whose stored
// hash then does not match (the push refuses it). A failure before this step leaves the folder untouched.
export function writeBuildFiles(outFolder, htmlBytes, report) {
  const pagePath = join(outFolder, 'index.html');
  const reportPath = join(outFolder, 'build-report.json');
  writeFileSync(`${pagePath}.tmp`, htmlBytes);
  writeFileSync(`${reportPath}.tmp`, JSON.stringify(report, null, 2) + '\n');
  renameWithRetry(`${pagePath}.tmp`, pagePath);
  renameWithRetry(`${reportPath}.tmp`, reportPath);
}

// Antivirus or an indexer can hold a file for a moment on Windows (EPERM, EBUSY): try again with short waits.
function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      if ((error.code !== 'EPERM' && error.code !== 'EBUSY') || attempt >= RENAME_RETRY_WAITS_MS.length) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RENAME_RETRY_WAITS_MS[attempt]);
    }
  }
}

// Returns { exitCode, report, notes }. Throws nothing except for programming errors.
export async function runBuild({ root = MIZAMON_ROOT, out = join(root, 'build'), check = false, runTests = true } = {}) {
  const startedAt = Date.now();
  const notes = [];
  let lock = null;
  let scratchFolder = null;
  try {
    lock = acquireLock(out);
    if (lock.note) notes.push(lock.note);
    const html = assembleFromDisk(root);
    const warnings = checkPage(html);
    const htmlBytes = Buffer.from(html, 'utf8');
    const report = {
      status: 'ok',
      mode: 'strict',
      builtAt: new Date().toISOString(),
      sourceHash: sourceHashFromDisk(root),
      indexHtmlSha256: sha256Hex(htmlBytes),
      sizes: { total: htmlBytes.length },
      tests: { ran: false },
      inPage: 'not run',
      warnings,
      durationSeconds: 0,
    };
    if (runTests) {
      const scratchRoot = join(tmpdir(), 'claude', 'mizamon-build');
      mkdirSync(scratchRoot, { recursive: true });
      removeOldScratchFolders(scratchRoot);
      scratchFolder = mkdtempSync(join(scratchRoot, 'run-'));
      const pagePath = join(scratchFolder, 'real.html');
      writeFileSync(pagePath, htmlBytes);
      report.tests = await runRuleTests(root, pagePath);
      if (report.tests.exitCode !== 0 || report.tests.failures.length > 0 || report.tests.passed + report.tests.skipped !== report.tests.total) report.status = 'failed';
    } else {
      report.status = 'untested';
    }
    report.durationSeconds = Math.round((Date.now() - startedAt) / 100) / 10;
    report.notes = notes;
    if (report.status === 'failed') return { exitCode: EXIT.problem, report, notes };
    if (!check) writeBuildFiles(out, htmlBytes, report);
    return { exitCode: EXIT.built, report, notes };
  } catch (error) {
    if (error instanceof BuildError) return { exitCode: error.exitCode, report: null, notes: [...notes, error.message] };
    if (error.code) return { exitCode: EXIT.io, report: null, notes: [...notes, `input/output error: ${error.message}`] };
    return { exitCode: EXIT.problem, report: null, notes: [...notes, `does not assemble: ${error.message}`] };
  } finally {
    if (scratchFolder) rmSync(scratchFolder, { recursive: true, force: true });
    if (lock) lock.release();
  }
}

function parseArguments(argv) {
  const options = { root: MIZAMON_ROOT, out: null, check: false, runTests: true, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--check') options.check = true;
    else if (flag === '--no-tests') options.runTests = false;
    else if (flag === '--json') options.json = true;
    else if ((flag === '--out' || flag === '--root') && index + 1 < argv.length) {
      index += 1;
      options[flag.slice(2)] = resolve(argv[index]);
    } else return null;
  }
  options.out ??= join(options.root, 'build');
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) {
    console.error(USAGE);
    process.exit(EXIT.usage);
  }
  const result = await runBuild(options);
  for (const note of result.notes) console.error(note);
  const { report } = result;
  if (report) for (const failure of report.tests.failures ?? []) console.error(`FAIL ${failure}`);
  if (options.json && report) console.log(JSON.stringify(report, null, 2));
  if (report && !options.json) {
    const tests = report.tests.ran ? `${report.tests.passed} / ${report.tests.total} tests${report.tests.skipped > 0 ? ` (${report.tests.skipped} skipped)` : ''}` : 'tests not run';
    console.log(`${report.status}: ${report.sizes.total} bytes, ${tests}, ${report.durationSeconds} s${options.check ? ' (check only, nothing written)' : ''}`);
    if (result.exitCode === EXIT.built && !options.check) console.log(`written: ${join(options.out, 'index.html')} and build-report.json`);
  }
  process.exit(result.exitCode);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
