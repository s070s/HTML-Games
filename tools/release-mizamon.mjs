// The one command to run on main after a merge that changes Mizamon: build, commit the build report, push, upload.
//
//   node tools/release-mizamon.mjs        (from the repo root, on main)
//
// It runs these steps in order and stops at the first one that fails, saying which:
//   1. build         node Mizamon/tools/build.mjs (through ~/.claude/scripts/heavy.mjs when that exists), which runs the tests
//                    and writes Mizamon/build/build-report.json
//   2. clean sources Mizamon/src, data, shared and tools have no uncommitted change (the report must describe the commit)
//   3. stage         git add of the report alone
//   4. commit        "Mizamon: build report", the report alone
//   5. push          origin main with the gh credential helper (the itch push reads origin/main, so the report must be there)
//   6. upload        node tools/itch-push.mjs mizamon
// Exit codes: 0 released, 1 a step failed (nothing after it ran).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPORT_PATH = 'Mizamon/build/build-report.json';
const SOURCE_FOLDERS = ['Mizamon/src', 'Mizamon/data', 'Mizamon/shared', 'Mizamon/tools'];
const COMMIT_MESSAGE = 'Mizamon: build report';
const HEAVY_JOB_RUNNER = join(homedir(), '.claude', 'scripts', 'heavy.mjs');

function runCommand(repoRoot, command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) return { ok: false, reason: result.error.message };
  return result.status === 0 ? { ok: true } : { ok: false, reason: `exit code ${result.status}` };
}

function checkSourcesAreClean(repoRoot) {
  const result = spawnSync('git', ['status', '--porcelain', '--', ...SOURCE_FOLDERS], { cwd: repoRoot, encoding: 'utf8' });
  if (result.error || result.status !== 0) return { ok: false, reason: `git status failed: ${result.error ? result.error.message : result.stderr.trim()}` };
  const changed = result.stdout.split('\n').filter(Boolean);
  if (changed.length > 0) return { ok: false, reason: `uncommitted changes in the sources, so the report would not match the commit:\n${changed.join('\n')}` };
  return { ok: true };
}

// The steps, in order. Each has a label and a run function that returns { ok } or { ok: false, reason }.
export function releaseSteps(repoRoot, heavyJobRunner = HEAVY_JOB_RUNNER) {
  const buildArguments = existsSync(heavyJobRunner)
    ? [heavyJobRunner, '--', process.execPath, 'Mizamon/tools/build.mjs']
    : ['Mizamon/tools/build.mjs'];
  return [
    { label: 'build (tests and build report)', run: () => runCommand(repoRoot, process.execPath, buildArguments) },
    { label: 'check that the sources are committed', run: () => checkSourcesAreClean(repoRoot) },
    { label: 'stage the build report', run: () => runCommand(repoRoot, 'git', ['add', '--', REPORT_PATH]) },
    { label: 'commit the build report', run: () => runCommand(repoRoot, 'git', ['commit', '-q', '-m', COMMIT_MESSAGE, '--', REPORT_PATH]) },
    { label: 'push main', run: () => runCommand(repoRoot, 'git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', '-q', 'origin', 'main']) },
    { label: 'upload to itch.io', run: () => runCommand(repoRoot, process.execPath, ['tools/itch-push.mjs', 'mizamon']) },
  ];
}

// Runs the steps until one fails. Returns { ok, failedStep, reason } (failedStep is the 1-based number).
export function runSteps(steps, log = console.error) {
  for (let index = 0; index < steps.length; index += 1) {
    const outcome = steps[index].run();
    if (!outcome.ok) {
      log(`release stopped: step ${index + 1} of ${steps.length} (${steps[index].label}) failed: ${outcome.reason}`);
      if (index + 1 < steps.length) log(`not run: ${steps.slice(index + 1).map((step) => step.label).join(', ')}`);
      return { ok: false, failedStep: index + 1, reason: outcome.reason };
    }
  }
  return { ok: true, failedStep: null, reason: null };
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outcome = runSteps(releaseSteps(repoRoot));
  if (outcome.ok) console.log('released: build report committed and pushed, itch.io upload done');
  process.exit(outcome.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
