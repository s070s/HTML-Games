// Uploads a game to its itch.io page with butler (itch.io's command-line uploader).
//
// Usage (from the repo root):
//   node tools/itch-push.mjs <game|all> [--dry-run]
//   games: breakpoint, ironhorizon, classtimekiller, fingerlickinmusic, mizamon
//
// It uploads the last pushed commit (origin/main), never the working copy, so
// unpushed or unfinished work cannot reach players. Each upload folder holds the
// game's single HTML file as index.html and nothing else (no tests, tools, docs).
// Breakpoint loads breakpoint-tests.js only when its self-test is run, so the
// players' build does not need it.
//
// butler is found through the BUTLER environment variable, then the PATH, then
// the copy the itch desktop app installs. Sign in once with `butler login`.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ITCH_USER = 's070s';
const CHANNEL = 'html5';
const GAMES = {
  breakpoint: { folder: 'Beat Em Up', file: 'Beat Em Up/breakpoint.html', slug: 'breakpoint' },
  ironhorizon: { folder: 'Mech Flight Sim', file: 'Mech Flight Sim/IronHorizon.html', slug: 'ironhorizon' },
  classtimekiller: { folder: 'ClassTimeKiller', file: 'ClassTimeKiller/ClassTimeKiller.html', slug: 'class-time-killer' },
  fingerlickinmusic: { folder: 'Finger Lickin Music', file: 'Finger Lickin Music/FingerLickinMusic.html', slug: 'finger-licking-music' },
  mizamon: { folder: 'Mizamon', file: 'Mizamon/Mizamon.html', slug: 'mizamon' },
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

// Writes the pushed version of the game into a fresh upload folder and returns its commit.
function buildUploadFolder(gameId, game) {
  const commit = git(['log', '-1', '--format=%h', 'origin/main', '--', game.folder]).toString().trim();
  if (!commit) throw new Error(`no pushed commit found for ${game.folder}`);
  const html = git(['show', `origin/main:${game.file}`]);
  const folder = join(UPLOAD_ROOT, gameId);
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.html'), html);
  return { folder, commit, bytes: html.length };
}

function pushGame(butler, gameId, dryRun) {
  const game = GAMES[gameId];
  const { folder, commit, bytes } = buildUploadFolder(gameId, game);
  const target = `${ITCH_USER}/${game.slug}:${CHANNEL}`;
  console.log(`\n== ${gameId}: ${game.file} at ${commit} (${bytes} bytes) -> ${target}${dryRun ? ' (dry run)' : ''}`);
  const args = ['push', folder, target, '--userversion', commit, '--if-changed'];
  if (dryRun) args.push('--dry-run');
  execFileSync(butler, args, { stdio: 'inherit' });
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const choice = args.find((arg) => !arg.startsWith('--'));
  const gameIds = choice === 'all' ? Object.keys(GAMES) : [choice];
  if (!choice || gameIds.some((id) => !GAMES[id])) {
    console.error(`usage: node tools/itch-push.mjs <${Object.keys(GAMES).join('|')}|all> [--dry-run]`);
    process.exit(2);
  }
  const butler = findButler();
  if (!butler) {
    console.error('butler not found: install it from https://itch.io/docs/butler/ or set BUTLER to its path');
    process.exit(1);
  }
  git(['fetch', '-q', 'origin', 'main'], { stdio: 'inherit' });
  for (const gameId of gameIds) pushGame(butler, gameId, dryRun);
}

main();
