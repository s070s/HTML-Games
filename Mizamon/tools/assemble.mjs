// Assembles the Mizamon page from Mizamon/src/ (reference section 13.3). Node built-ins only.
//
//   node Mizamon/tools/assemble.mjs --out <file> [--root <folder>]
//
// Writes the page to <file> (use a folder under the OS temp folder for a quick look; nothing is written in the repo
// and no test runs) and prints one JSON line with the source hash, the SHA-256 of the page and its size.
// --root is the Mizamon folder to read (default: the folder this file lives in), for a checkout of another commit.
// Exit codes: 0 done, 1 the sources do not assemble, 2 usage error, 3 input/output error.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemblePage, sha256Hex, sourceHash } from '../shared/assemble-core.mjs';

export const MIZAMON_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// What the source hash covers besides src/ and data/ (reference section 13.5).
const HASHED_FILES = ['shared/assemble-core.mjs', 'tools/assemble.mjs'];
const USAGE = 'usage: node Mizamon/tools/assemble.mjs --out <file> [--root <folder>]';

function listFiles(folder, relativeFolder) {
  const found = [];
  for (const name of readdirSync(folder).sort()) {
    const fullPath = join(folder, name);
    const relativePath = `${relativeFolder}/${name}`;
    if (statSync(fullPath).isDirectory()) found.push(...listFiles(fullPath, relativePath));
    else found.push(relativePath);
  }
  return found;
}

function readFragments(root, kind) {
  const folder = join(root, 'src', kind);
  return readdirSync(folder)
    .filter((name) => !name.startsWith('.'))
    .map((name) => ({ name, text: readFileSync(join(folder, name), 'utf8') }));
}

export function readSources(root = MIZAMON_ROOT) {
  return {
    shell: readFileSync(join(root, 'src', 'shell.html'), 'utf8'),
    rules: readFragments(root, 'rules'),
    engine: readFragments(root, 'engine'),
  };
}

export function assembleFromDisk(root = MIZAMON_ROOT) {
  return assemblePage(readSources(root));
}

export function sourceHashFromDisk(root = MIZAMON_ROOT) {
  const paths = [...listFiles(join(root, 'src'), 'src')];
  try {
    paths.push(...listFiles(join(root, 'data'), 'data'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error; // data/ comes with DEV-02b
  }
  paths.push(...HASHED_FILES);
  return sourceHash(paths.map((path) => ({ path, bytes: readFileSync(join(root, path)) })));
}

function parseArguments(argv) {
  const options = { root: MIZAMON_ROOT, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if ((flag === '--out' || flag === '--root') && index + 1 < argv.length) {
      index += 1;
      options[flag.slice(2)] = resolve(argv[index]);
    } else {
      return null;
    }
  }
  return options.out ? options : null;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) {
    console.error(USAGE);
    process.exit(2);
  }
  let html;
  let hash;
  try {
    html = assembleFromDisk(options.root);
    hash = sourceHashFromDisk(options.root);
  } catch (error) {
    console.error(error.code ? `input/output error: ${error.message}` : `does not assemble: ${error.message}`);
    process.exit(error.code ? 3 : 1);
  }
  const bytes = Buffer.from(html, 'utf8');
  try {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, bytes);
  } catch (error) {
    console.error(`input/output error: ${error.message}`);
    process.exit(3);
  }
  console.log(JSON.stringify({ sourceHash: hash, htmlSha256: sha256Hex(bytes), bytes: bytes.length }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
