// Uploads a game to its itch.io page with butler (itch.io's command-line uploader).
//
// Usage (from the repo root):
//   node tools/itch-push.mjs <game|all> [--dry-run] [--ref <commit>] [--repo <folder>] [--verify-only]
//   games: breakpoint, ironhorizon, classtimekiller, fingerlickinmusic, mizamon
//
// It uploads the last pushed commit (origin/main), never the working copy, so
// unpushed or unfinished work cannot reach players. Each upload folder holds the
// game's single HTML file as index.html and nothing else (no tests, tools, docs).
// Breakpoint loads breakpoint-tests.js only when its self-test is run, so the
// players' build does not need it.
//
// Mizamon has no committed page: the commit holds src/ and a build report. The push reads the report at the
// commit (status must be "ok"), assembles that commit's own sources in a temporary git worktree under the OS temp
// folder (removed again in a finally), and refuses unless the source hash and the SHA-256 of the assembled page
// equal the report's (a merge without a new build is stale). The report's commit is the upload version.
// --ref <commit> uploads (or checks) another commit than origin/main, for a dry run on a local commit (no fetch);
// --repo <folder> is the repository to read (default: the current folder);
// --verify-only does everything except the butler call, so butler need not be installed.
//
// butler is found through the BUTLER environment variable, then the PATH, then
// the copy the itch desktop app installs. Sign in once with `butler login`.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ITCH_USER = 's070s';
const CHANNEL = 'html5';
const GAMES = {
  breakpoint: { folder: 'Beat Em Up', file: 'Beat Em Up/breakpoint.html', slug: 'breakpoint' },
  ironhorizon: { folder: 'Mech Flight Sim', file: 'Mech Flight Sim/IronHorizon.html', slug: 'ironhorizon' },
  classtimekiller: { folder: 'ClassTimeKiller', file: 'ClassTimeKiller/ClassTimeKiller.html', slug: 'class-time-killer' },
  fingerlickinmusic: { folder: 'Finger Lickin Music', file: 'Finger Lickin Music/FingerLickinMusic.html', slug: 'finger-licking-music' },
  mizamon: { folder: 'Mizamon', report: 'Mizamon/build/build-report.json', assemble: 'Mizamon/tools/assemble.mjs', slug: 'mizamon' },
};
const UPLOAD_ROOT = join(tmpdir(), 'claude', 'itch-upload');

function git(args, options = {}) {
  return execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024, ...options });
}

function findButler() {
  if (process.env.BUTLER) return process.env.BUTLER;
  try {
    execFileSync('butler', ['-V'], { stdio: 'ignore' });
    return 'butler';
  } catch {
    // not on the PATH: try the itch desktop app's copy below
  }
  const brothFolder = join(process.env.APPDATA || '', 'itch', 'broth', 'butler');
  const versionFile = join(brothFolder, '.chosen-version');
  if (!existsSync(versionFile)) return null;
  const version = readFileSync(versionFile, 'utf8').trim();
  const appCopy = join(brothFolder, 'versions', version, process.platform === 'win32' ? 'butler.exe' : 'butler');
  return existsSync(appCopy) ? appCopy : null;
}

function removeWorktree(context, worktree) {
  try {
    git(['worktree', 'remove', '--force', worktree], { cwd: context.repo, stdio: 'ignore' });
  } catch {
    // not registered (never added, or already removed): the folder is deleted below
  }
  rmSync(worktree, { recursive: true, force: true });
  try {
    git(['worktree', 'prune'], { cwd: context.repo, stdio: 'ignore' });
  } catch {
    // nothing to prune
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

// A run that was killed leaves its `<slug>-src-<pid>` worktree behind: remove every one whose process no longer runs.
function removeDeadWorktrees(context, game) {
  const leftoverName = new RegExp('^' + game.slug + '-src-(\\d+)$');
  const names = existsSync(UPLOAD_ROOT) ? readdirSync(UPLOAD_ROOT) : [];
  for (const name of names) {
    const match = leftoverName.exec(name);
    if (match && Number(match[1]) !== process.pid && !isProcessRunning(Number(match[1]))) removeWorktree(context, join(UPLOAD_ROOT, name));
  }
  try {
    git(['worktree', 'prune'], { cwd: context.repo, stdio: 'ignore' });
  } catch {
    // nothing to prune
  }
}

// Mizamon: checks the build report of the commit, assembles that commit's sources in a temporary worktree, and
// refuses unless the source hash and the page's SHA-256 equal the report's. Writes <folder>/index.html.
function assembleFromReport(context, game, folder) {
  let reportText;
  try {
    reportText = git(['show', `${context.ref}:${game.report}`], { cwd: context.repo, stdio: 'pipe' }).toString();
  } catch {
    throw new Error(`${context.ref} has no ${game.report}: build on main and commit the report first`);
  }
  const report = JSON.parse(reportText);
  if (report.status !== 'ok') throw new Error(`the build report at ${context.ref} has status "${report.status}", not "ok"`);
  const worktree = join(UPLOAD_ROOT, `${game.slug}-src-${process.pid}`);
  removeDeadWorktrees(context, game);
  let printed;
  try {
    removeWorktree(context, worktree); // a leftover of a crashed run
    git(['worktree', 'add', '--detach', '--quiet', worktree, context.ref], { cwd: context.repo, stdio: 'pipe' });
    printed = execFileSync(process.execPath, [join(worktree, game.assemble), '--out', join(folder, 'index.html')], {
      cwd: worktree, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
    });
  } finally {
    removeWorktree(context, worktree);
  }
  const assembled = JSON.parse(printed.trim().split('\n').pop());
  const pageBytes = readFileSync(join(folder, 'index.html'));
  const pageHash = createHash('sha256').update(pageBytes).digest('hex');
  if (assembled.sourceHash !== report.sourceHash) throw new Error('stale report: the sources of ' + context.ref + ' are not the ones the build report was made from; build again and commit the report');
  if (pageHash !== report.indexHtmlSha256 || assembled.htmlSha256 !== report.indexHtmlSha256) throw new Error('the assembled page does not have the SHA-256 of the build report');
  return { bytes: pageBytes.length, commit: git(['log', '-1', '--format=%h', context.ref, '--', game.report], { cwd: context.repo }).toString().trim() };
}

// Writes the pushed version of the game into a fresh upload folder and returns its commit.
function buildUploadFolder(gameId, game, context) {
  const folder = join(UPLOAD_ROOT, gameId);
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  if (game.assemble) return { folder, ...assembleFromReport(context, game, folder) };
  const commit = git(['log', '-1', '--format=%h', context.ref, '--', game.folder], { cwd: context.repo }).toString().trim();
  if (!commit) throw new Error(`no pushed commit found for ${game.folder}`);
  const html = git(['show', `${context.ref}:${game.file}`], { cwd: context.repo });
  writeFileSync(join(folder, 'index.html'), html);
  return { folder, commit, bytes: html.length };
}

function pushGame(butler, gameId, context) {
  const game = GAMES[gameId];
  const { folder, commit, bytes } = buildUploadFolder(gameId, game, context);
  const target = `${ITCH_USER}/${game.slug}:${CHANNEL}`;
  const source = game.file ?? `${game.folder}/src assembled`;
  console.log(`\n== ${gameId}: ${source} at ${commit} (${bytes} bytes) -> ${target}${context.dryRun ? ' (dry run)' : ''}`);
  if (context.verifyOnly) {
    console.log(`verified: ${folder}`);
    return;
  }
  const args = ['push', folder, target, '--userversion', commit, '--if-changed'];
  if (context.dryRun) args.push('--dry-run');
  execFileSync(butler, args, { stdio: 'inherit' });
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  return index + 1 < args.length ? args[index + 1] : '';
}

function main() {
  const args = process.argv.slice(2);
  const ref = readOption(args, '--ref');
  const repo = readOption(args, '--repo');
  const optionValues = [ref, repo].filter((value) => value);
  const choice = args.find((arg) => !arg.startsWith('--') && !optionValues.includes(arg));
  const gameIds = choice === 'all' ? Object.keys(GAMES) : [choice];
  if (!choice || ref === '' || repo === '' || gameIds.some((id) => !GAMES[id])) {
    console.error(`usage: node tools/itch-push.mjs <${Object.keys(GAMES).join('|')}|all> [--dry-run] [--ref <commit>] [--repo <folder>] [--verify-only]`);
    process.exit(2);
  }
  const context = { repo: repo ?? process.cwd(), ref: ref ?? 'origin/main', dryRun: args.includes('--dry-run'), verifyOnly: args.includes('--verify-only') };
  const butler = context.verifyOnly ? null : findButler();
  if (!context.verifyOnly && !butler) {
    console.error('butler not found: install it from https://itch.io/docs/butler/ or set BUTLER to its path');
    process.exit(1);
  }
  try {
    if (ref === null) git(['fetch', '-q', 'origin', 'main'], { cwd: context.repo, stdio: 'inherit' });
    for (const gameId of gameIds) pushGame(butler, gameId, context);
  } catch (error) {
    console.error(`refused: ${error.message}`);
    process.exit(1);
  }
}

main();
