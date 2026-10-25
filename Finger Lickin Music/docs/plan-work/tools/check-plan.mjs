// Mechanical checks for the assembled implementation plan.
// Usage: node check-plan.mjs <planFile> <specFile> [--max N]
import fs from 'node:fs';

const [,, planFile, specFile] = process.argv;
const MAX = Number((process.argv.find(a => a.startsWith('--max=')) || '--max=25').slice(6));
if (!planFile || !specFile) { console.error('usage: node check-plan.mjs <plan> <spec>'); process.exit(2); }

const raw = fs.readFileSync(planFile);
const report = { ok: true, errors: [], warnings: [], counts: {} };
function err(msg) { report.ok = false; report.errors.push(msg); }
function warn(msg) { report.warnings.push(msg); }
function lim(arr) { return arr.length > MAX ? arr.slice(0, MAX).concat(['... ' + (arr.length - MAX) + ' more']) : arr; }

// BOM and LF
const hasBom = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF;
if (!hasBom) err('No UTF-8 BOM at file start');
if (raw.includes(0x0D)) err('CR byte present (line endings must be LF)');
// ASCII
const nonAscii = [];
for (let i = hasBom ? 3 : 0; i < raw.length; i++) {
  const b = raw[i];
  if (b > 0x7E || (b < 0x20 && b !== 0x0A && b !== 0x09)) {
    nonAscii.push(i);
    if (nonAscii.length > 200) break;
  }
}
const text = raw.toString('utf8').replace(/^﻿/, '');
const lines = text.split('\n');
if (nonAscii.length) {
  // map offsets to line numbers
  const locs = [];
  let off = hasBom ? 3 : 0;
  let li = 0;
  const byteLines = raw.slice(hasBom ? 3 : 0).toString('latin1').split('\n');
  for (const l of byteLines) {
    const end = off + Buffer.byteLength(l, 'latin1') + 1;
    for (const p of nonAscii) if (p >= off && p < end) locs.push((li + 1) + ':' + (p - off) + ' byte 0x' + raw[p].toString(16));
    off = end; li++;
    if (locs.length > 60) break;
  }
  err('Non-ASCII bytes: ' + nonAscii.length + ' e.g. ' + lim(locs).join(', '));
}

// Collect definitions
const defs = { T: new Map(), R: new Map(), UT: new Map(), IT: new Map(), FT: new Map(), TT: new Map(), PT: new Map(), XT: new Map(), FI: new Map(), LT: new Map(), AT: new Map(), RISK: new Map(), ADR: new Map(), M: new Map() };
for (let i = 1; i <= 31; i++) defs.M.set('M-' + String(i).padStart(2, '0'), 0);
function addDef(kind, id, line) {
  const m = defs[kind];
  if (!m.has(id)) m.set(id, []);
  if (Array.isArray(m.get(id))) m.get(id).push(line);
}
const rRows = []; // {id, priority, line, tests, status, phaseCell}
let inPart15 = false, inPart12 = false, inPart11 = false;
let tHeaderCols = null;
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  const ln = i + 1;
  if (/^## 15\./.test(L)) { inPart15 = true; inPart12 = false; inPart11 = false; }
  else if (/^## 12\./.test(L)) { inPart12 = true; inPart15 = false; inPart11 = false; }
  else if (/^## 11\./.test(L)) { inPart11 = true; inPart12 = false; inPart15 = false; }
  else if (/^## /.test(L)) { inPart15 = inPart12 = inPart11 = false; }

  let m;
  if ((m = L.match(/^### (T\d\d\.\d\d)\b/))) addDef('T', m[1], ln);
  if ((m = L.match(/^### \d+\.\d+ (ADR-\d\d)\b/))) addDef('ADR', m[1], ln);
  if ((m = L.match(/^\| (RISK-\d\d) \|/))) addDef('RISK', m[1], ln);
  if ((m = L.match(/^\| (UT-\d\d-\d\d) \|/))) addDef('UT', m[1], ln);
  if ((m = L.match(/^\| ((IT|FT|TT|PT|XT|FI|LT)-\d{3}) \|/))) addDef(m[2], m[1], ln);
  if ((m = L.match(/^\| (AT-R-[BEIP]\d+(?:\.\d+)*-\d\d) \|/))) addDef('AT', m[1], ln);
  if (inPart15 && (m = L.match(/^\| (R-[BEIP]\d+(?:\.\d+)*-\d\d) \|/))) {
    addDef('R', m[1], ln);
    const cells = L.split('|').slice(1, -1).map(c => c.trim());
    rRows.push({ id: m[1], line: ln, cells });
  }
}

// Part 15 header columns -> find Priority/Tests/Status indexes per table (assume consistent header)
let hdr = null;
for (const L of lines) { if (/^\| R-ID \|/i.test(L)) { hdr = L.split('|').slice(1, -1).map(c => c.trim()); break; } }
if (!hdr) err('No Part 15 header row starting with "| R-ID |" found');
const idx = (name) => hdr ? hdr.findIndex(h => new RegExp('^' + name, 'i').test(h)) : -1;
const iPri = idx('Priority'), iTests = idx('Tests'), iStatus = idx('Status'), iPhase = idx('Phase'), iMod = idx('Module');

// Duplicates
for (const kind of Object.keys(defs)) {
  if (kind === 'M') continue;
  const dups = [...defs[kind].entries()].filter(([, v]) => Array.isArray(v) && v.length > 1).map(([k, v]) => k + '@' + v.join('/'));
  if (dups.length) err('Duplicate ' + kind + ' definitions: ' + dups.length + ' e.g. ' + lim(dups).join(', '));
}

// References
const refRe = {
  T: /\bT\d\d\.\d\d\b/g,
  R: /\bR-[BEIP]\d+(?:\.\d+)*-\d\d\b/g,
  UT: /\bUT-\d\d-\d\d\b/g,
  IT: /\bIT-\d{3}\b/g, FT: /\bFT-\d{3}\b/g, TT: /\bTT-\d{3}\b/g, PT: /\bPT-\d{3}\b/g, XT: /\bXT-\d{3}\b/g, FI: /\bFI-\d{3}\b/g, LT: /\bLT-\d{3}\b/g,
  AT: /\bAT-R-[BEIP]\d+(?:\.\d+)*-\d\d\b/g,
  RISK: /\bRISK-\d\d\b/g, ADR: /\bADR-\d\d\b/g, M: /\bM-\d\d\b/g,
};
const undefinedRefs = {};
const refCounts = {};
for (const [kind, re] of Object.entries(refRe)) {
  const seen = new Map();
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (kind === 'R' && /^\| R-/.test(L)) continue; // definition rows
    let m; re.lastIndex = 0;
    while ((m = re.exec(L))) {
      const id = m[0];
      if (!seen.has(id)) seen.set(id, i + 1);
    }
  }
  refCounts[kind] = seen.size;
  const und = [...seen.entries()].filter(([id]) => !defs[kind].has(id)).map(([id, ln]) => id + '@' + ln);
  if (und.length) undefinedRefs[kind] = und;
}
for (const [kind, und] of Object.entries(undefinedRefs)) {
  // Ranges like UT-05-03..UT-05-09 reference endpoints only; interior IDs are not referenced, so this is a true undefined check.
  err('Undefined ' + kind + ' references: ' + und.length + ' e.g. ' + lim(und).join(', '));
}

// Orphan tests (defined but never referenced outside their definition row and index tables)
for (const kind of ['IT', 'FT', 'TT', 'PT', 'XT', 'FI', 'LT', 'UT', 'RISK']) {
  const orphans = [];
  for (const id of defs[kind].keys()) {
    let count = 0;
    for (const L of lines) { if (L.includes(id)) { count++; if (count > 1) break; } }
    if (count <= 1) orphans.push(id);
  }
  if (orphans.length) warn('Orphan ' + kind + ' IDs (defined, never referenced elsewhere): ' + orphans.length + ' e.g. ' + lim(orphans).join(', '));
}

// T entries: mandatory labels
const LABELS = ['- Position:', '- Purpose:', '- Covers:', '- Depends on:', '- Deliverables:', '- Verification:', '- Open items:'];
const badT = [];
let tCount = 0;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^### (T\d\d\.\d\d)\b/);
  if (!m) continue;
  tCount++;
  let j = i + 1;
  const found = new Set();
  while (j < lines.length && !/^###? /.test(lines[j])) {
    for (const lab of LABELS) if (lines[j].startsWith(lab)) found.add(lab);
    j++;
  }
  const missing = LABELS.filter(l => !found.has(l));
  if (missing.length) badT.push(m[1] + ' missing ' + missing.map(x => x.replace(/^- |:$/g, '')).join('/'));
}
if (badT.length) err('T entries missing mandatory labels: ' + badT.length + ' e.g. ' + lim(badT).join('; '));

// Tables: column count consistency
const badTables = [];
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith('|')) continue;
  const start = i;
  const hdrCols = lines[i].split('|').length - 2;
  let j = i + 1;
  if (!(j < lines.length && /^\|\s*:?-{2,}/.test(lines[j]))) { i = j; continue; }
  j++;
  while (j < lines.length && lines[j].startsWith('|')) {
    const c = lines[j].split('|').length - 2;
    if (c !== hdrCols) badTables.push((j + 1) + ' (expected ' + hdrCols + ' got ' + c + ')');
    j++;
  }
  i = j;
}
if (badTables.length) err('Table rows with wrong column count: ' + badTables.length + ' e.g. lines ' + lim(badTables).join(', '));

// Part 15: priority / AT coverage / status / phase backfill
const p01NoAt = [], badStatus = [], phaseNotBackfilled = [];
const okStatus = new Set(['Implemented', 'Partial', 'Blocked', 'Unimplemented', 'Deferred']);
for (const r of rRows) {
  const pri = iPri >= 0 ? r.cells[iPri] : '';
  const st = iStatus >= 0 ? r.cells[iStatus] : '';
  const ph = iPhase >= 0 ? r.cells[iPhase] : '';
  if (st && !okStatus.has(st)) badStatus.push(r.id + '=' + st);
  if ((pri === 'P0' || pri === 'P1') && !defs.AT.has('AT-' + r.id)) p01NoAt.push(r.id);
  if (/^Phase\s*\d/.test(ph)) phaseNotBackfilled.push(r.id);
}
if (badStatus.length) err('Rows with invalid Status: ' + lim(badStatus).join(', '));
if (p01NoAt.length) err('P0/P1 requirements without an AT row: ' + p01NoAt.length + ' e.g. ' + lim(p01NoAt).join(', '));
if (phaseNotBackfilled.length) warn('Matrix rows whose Phase was not mapped to a T section: ' + phaseNotBackfilled.length + ' e.g. ' + lim(phaseNotBackfilled).join(', '));

// Forbidden claims
const claimRe = /\b(has been (implemented|tested|verified|measured)|is implemented|are implemented|was implemented|already implemented|fully implemented|successfully tested)\b/i;
const claims = [];
for (let i = 0; i < lines.length; i++) if (claimRe.test(lines[i]) && !/never|must not|do not|not yet|will be|until|only when|cannot/i.test(lines[i])) claims.push(i + 1);
if (claims.length) warn('Lines that may claim completion: ' + lim(claims.map(String)).join(', '));

// Spec coverage: every section/subsection appears in Appendix A
const spec = fs.readFileSync(specFile, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
const ranges = { B: [1, 1894], E: [1896, 2253], I: [2256, 2699], P: [2705, 3193] };
const specSecs = [];
for (const [part, [a, b]] of Object.entries(ranges)) {
  for (let ln = a; ln <= b && ln <= spec.length; ln++) {
    const L = spec[ln - 1];
    let m;
    if (part === 'B') {
      if ((m = L.match(/^(\d{1,2})\. \S/))) specSecs.push([part, m[1]]);
      else if ((m = L.match(/^(\d{1,2}\.\d{1,2}) \S/))) specSecs.push([part, m[1]]);
    } else {
      if ((m = L.match(/^(\d{1,2})\. \S/))) specSecs.push([part, m[1]]);
      else if ((m = L.match(/^(\d{1,2}\.\d{1,2})\.? \S/))) specSecs.push([part, m[1]]);
    }
  }
}
// Appendix A text
let appA = '';
{
  const s = lines.findIndex(L => /^## Appendix A\./.test(L));
  if (s < 0) err('Appendix A heading not found');
  else {
    let e = lines.findIndex((L, i) => i > s && /^## /.test(L));
    if (e < 0) e = lines.length;
    appA = lines.slice(s, e).join('\n');
  }
}
const uncovered = [];
for (const [part, sec] of specSecs) {
  const esc = sec.replace(/\./g, '\\.');
  const re = new RegExp('\\|\\s*' + part + '\\s*\\|\\s*' + esc + '(?:\\s|\\|)|\\b' + part + ' ' + esc + '\\b');
  if (!re.test(appA)) uncovered.push(part + ' ' + sec);
}
if (uncovered.length) err('Spec sections not found in Appendix A: ' + uncovered.length + ' e.g. ' + lim(uncovered).join(', '));

// Counts
report.counts = {
  bytes: raw.length,
  lines: lines.length,
  headings2: lines.filter(L => /^## /.test(L)).length,
  T: defs.T.size, tEntriesChecked: tCount,
  R: defs.R.size,
  R_byPart: ['B', 'E', 'I', 'P'].reduce((o, p) => (o[p] = [...defs.R.keys()].filter(k => k.startsWith('R-' + p)).length, o), {}),
  R_P0P1: rRows.filter(r => iPri >= 0 && /^P[01]$/.test(r.cells[iPri])).length,
  UT: defs.UT.size, IT: defs.IT.size, FT: defs.FT.size, TT: defs.TT.size, PT: defs.PT.size, XT: defs.XT.size, FI: defs.FI.size, LT: defs.LT.size, AT: defs.AT.size,
  RISK: defs.RISK.size, ADR: defs.ADR.size,
  specSections: specSecs.length,
  refCounts,
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
