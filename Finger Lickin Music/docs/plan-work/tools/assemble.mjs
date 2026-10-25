// Assemble the Finger Lickin Music implementation plan from drafted parts.
// Usage: node assemble.mjs <partsDir> <outFile>
import fs from 'node:fs';
import path from 'node:path';

const [,, partsDir, outFile] = process.argv;
if (!partsDir || !outFile) { console.error('usage: node assemble.mjs <partsDir> <outFile>'); process.exit(2); }

const ORDER = [
  '00-front.md', '01-scope.md', '02-adr.md', '03-repo.md', '04-modules.md', '05-data.md',
  '06a-mod-foundation.md', '06b-mod-input.md', '06c-mod-parsers.md', '06d-mod-project.md',
  '06e-mod-render.md', '06f-mod-modes.md', '06g-mod-ui.md',
  '07-ui.md', '08-import.md', '09-perf.md', '10-safety.md',
  '11a-toc-0-5.md', '11b-toc-6-10.md', '11c-toc-11-16.md',
  '12a-tests-auto.md', '12b-tests-manual.md', '12c-tests-at-B.md', '12d-tests-at-EIP.md',
  '13-risks.md', '14-release.md',
  '15a-trace-B.md', '15b-trace-E.md', '15c-trace-I.md', '15d-trace-P.md',
  'A-coverage.md', 'B-appendices.md',
];

function readPart(name) {
  const p = path.join(partsDir, name);
  if (!fs.existsSync(p)) { console.error('MISSING PART: ' + name); return null; }
  let s = fs.readFileSync(p, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  s = s.replace(/\r\n?/g, '\n');
  if (!s.endsWith('\n')) s += '\n';
  return s;
}

// Build R-ID -> T-IDs map from 11x index files: "T04.03 | title | R-... R-..."
const rToT = new Map();
for (const f of fs.readdirSync(partsDir).filter(f => /^11x-index-.*\.txt$/.test(f))) {
  const lines = fs.readFileSync(path.join(partsDir, f), 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*(T\d\d\.\d\d)\s*\|/);
    if (!m) continue;
    const t = m[1];
    const ids = line.match(/R-[BEIP]\d+(?:\.\d+)*-\d\d/g) || [];
    for (const r of ids) {
      if (!rToT.has(r)) rToT.set(r, new Set());
      rToT.get(r).add(t);
    }
  }
}

let backfilled = 0, notBackfilled = 0;
function backfillPhase(text) {
  const lines = text.split('\n');
  let phaseCol = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) { phaseCol = -1; continue; }
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (/^R-ID$/i.test(cells[0] || '')) {
      phaseCol = cells.findIndex(c => /^phase/i.test(c));
      continue;
    }
    if (phaseCol < 0) continue;
    const m = (cells[0] || '').match(/^(R-[BEIP]\d+(?:\.\d+)*-\d\d)$/);
    if (!m) continue;
    const r = m[1];
    const cur = cells[phaseCol] || '';
    if (!/^Phase\s*\d\d?$/i.test(cur)) continue; // already rewritten or custom
    const ts = rToT.get(r);
    if (ts && ts.size) {
      const sorted = [...ts].sort();
      cells[phaseCol] = sorted.join(', ');
      lines[i] = '| ' + cells.join(' | ') + ' |';
      backfilled++;
    } else {
      notBackfilled++;
    }
  }
  return lines.join('\n');
}

function slugify(h) {
  return h.toLowerCase().replace(/[^a-z0-9 \-_]/g, '').trim().replace(/\s+/g, '-');
}

const bodies = [];
for (const name of ORDER) {
  let s = readPart(name);
  if (s == null) continue;
  if (/^15[a-d]-trace-/.test(name)) s = backfillPhase(s);
  bodies.push(s.trimEnd() + '\n');
}
const body = bodies.join('\n');

// Contents list: all ## and ### headings except T entries.
const used = new Map();
const toc = [];
for (const line of body.split('\n')) {
  const m = line.match(/^(##|###) (.+?)\s*$/);
  if (!m) continue;
  const text = m[2];
  if (/^T\d\d\.\d\d\b/.test(text)) continue;
  let slug = slugify(text);
  const n = used.get(slug) || 0; used.set(slug, n + 1);
  if (n) slug = slug + '-' + n;
  const indent = m[1] === '##' ? '' : '  ';
  toc.push(indent + '- [' + text.replace(/`/g, '') + '](#' + slug + ')');
}

const front = [
  '# Finger Lickin Music - Complete Implementation Plan',
  '',
  'Plan version 1.0.0 (2026-10-25). Covers specification FLM-1.0 (base), FLM-1.1.0 (edge cases and',
  'failure modes), FLM-1.2.0 (essential product improvements) and FLM-1.3.0 (maximum-polish checklist),',
  'stored verbatim in `docs/SPECIFICATION.txt`. Status: planning complete; implementation not started.',
  'Nothing described in this document exists in code yet. This single file is the executable roadmap',
  'and the complete design from which the game is implemented, start to finish.',
  '',
  '## Contents',
  '',
  ...toc,
  '',
].join('\n');

let out = front + '\n' + body;
out = out.replace(/\r\n?/g, '\n');
// Collapse 3+ blank lines to 2.
out = out.replace(/\n{4,}/g, '\n\n\n');
fs.writeFileSync(outFile, '﻿' + out, 'utf8');

const bytes = fs.statSync(outFile).size;
const lines = out.split('\n').length;
console.log(JSON.stringify({ outFile, bytes, lines, parts: bodies.length, expectedParts: ORDER.length, phaseBackfilled: backfilled, phaseNotBackfilled: notBackfilled, rIdsWithT: rToT.size }, null, 2));
