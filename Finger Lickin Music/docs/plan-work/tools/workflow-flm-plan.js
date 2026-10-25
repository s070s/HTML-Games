export const meta = {
  name: 'flm-implementation-plan',
  description: 'Draft, cross-check and harden the Finger Lickin Music implementation plan parts',
  phases: [
    { title: 'Draft', detail: '23 parallel part drafters (front matter, scope, ADRs, repo, modules, data, 7 module-design groups, UI, import, perf, safety, risks, 4 traceability matrices, appendices)' },
    { title: 'Tests', detail: 'test plan compiled from module unit-test indexes and traceability indexes' },
    { title: 'Roadmap', detail: 'end-to-end table of contents phases 0-16' },
    { title: 'Release', detail: 'release checklist, polish gates, coverage map' },
    { title: 'Cover', detail: 'coverage critics per spec part, fixers, until dry' },
    { title: 'Consistency', detail: 'cross-part consistency reviewers and fixers' },
  ],
}

const SCR = '/tmp/claude-0/-home-user-HTML-Games/227781b1-1855-592f-8ada-c35332abbbb2/scratchpad'
const BRIEF = SCR + '/brief/BRIEF.md'
const SPEC = SCR + '/spec/SPECIFICATION.txt'
const PARTS = SCR + '/parts'
const T1 = SCR + '/brief/TASKS-stage1.md'
const T2 = SCR + '/brief/TASKS-later.md'

const DRAFT = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    file: { type: 'string' },
    line_count: { type: 'number' },
    summary: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'file', 'summary'],
}
const CRITIC = {
  type: 'object',
  properties: {
    gaps: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string' }, ref: { type: 'string' }, detail: { type: 'string' }, fix: { type: 'string' } },
      required: ['kind', 'ref', 'detail', 'fix'] } },
    checked: { type: 'object', properties: { rows: { type: 'number' }, p0p1: { type: 'number' }, ats: { type: 'number' }, covered: { type: 'number' } } },
  },
  required: ['gaps'],
}
const FIXER = {
  type: 'object',
  properties: {
    applied: { type: 'number' },
    skipped: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, reason: { type: 'string' } } } },
  },
  required: ['applied'],
}
const SKEPTIC = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'object', properties: {
      file: { type: 'string' }, line: { type: 'number' }, kind: { type: 'string' }, detail: { type: 'string' }, fix: { type: 'string' } },
      required: ['file', 'kind', 'detail', 'fix'] } },
  },
  required: ['issues'],
}
const SFIX = {
  type: 'object',
  properties: {
    applied: { type: 'number' },
    skipped: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, reason: { type: 'string' } } } },
  },
  required: ['applied'],
}

function draftPrompt(id, tasksFile, extra) {
  return [
    'You are drafting part "' + id + '" of the Finger Lickin Music implementation plan (a single large Markdown document that a later coding session must be able to implement the whole game from, in one go).',
    'Procedure:',
    '1. Read ' + BRIEF + ' completely. It is binding (names, numbers, decisions, ID schemes, writing rules).',
    '2. Read ' + tasksFile + ' and locate the section whose heading starts with "## TASK ' + id + '". Follow it exactly. Shared templates and rules in that file apply to you.',
    '3. The specification is ' + SPEC + ' (3,193 lines). Read it completely in chunks (Read with offset/limit, about 700 lines per call) unless your task names specific sections only; then read those sections plus B section 4 and B section 27.',
    '4. Write your output file(s) into ' + PARTS + '/ using the exact file names in the task. ASCII only (no byte above 0x7F), LF line endings. Overwrite existing files.',
    '5. Quality bar: an engineer must be able to implement from your part without asking a question. Decide everything; no "TBD", no "could", no unresolved alternatives except the three OQs named in the brief. Never describe anything as implemented, done, tested or measured.',
    extra || '',
    'When finished, return JSON with: ok (boolean), file (main output path), line_count (approximate), summary (3-6 sentences on what you covered), issues (array of strings: anything you could not resolve or that conflicts with the brief).',
  ].join('\n')
}

const STAGE1 = [
  ['00', '00-front.md'], ['01', '01-scope.md'], ['02', '02-adr.md'], ['03', '03-repo.md'],
  ['04', '04-modules.md'], ['05', '05-data.md'],
  ['06a', '06a-mod-foundation.md'], ['06b', '06b-mod-input.md'], ['06c', '06c-mod-parsers.md'],
  ['06d', '06d-mod-project.md'], ['06e', '06e-mod-render.md'], ['06f', '06f-mod-modes.md'], ['06g', '06g-mod-ui.md'],
  ['07', '07-ui.md'], ['08', '08-import.md'], ['09', '09-perf.md'], ['10', '10-safety.md'], ['13', '13-risks.md'],
  ['15a', '15a-trace-B.md'], ['15b', '15b-trace-E.md'], ['15c', '15c-trace-I.md'], ['15d', '15d-trace-P.md'],
  ['BCD', 'B-appendices.md'],
]

const results = { draft: {}, tests: {}, roadmap: {}, release: {}, cover: [], consistency: {} }

phase('Draft')
log('Stage 1: drafting ' + STAGE1.length + ' parts in parallel')
const drafts = await parallel(STAGE1.map(([id, file]) => () =>
  agent(draftPrompt(id, T1), { label: 'draft:' + id, phase: 'Draft', schema: DRAFT, agentType: 'general-purpose' })
    .then(r => ({ id, file, r }))))
for (const d of drafts.filter(Boolean)) results.draft[d.id] = d.r
const missing1 = STAGE1.filter(([id]) => !results.draft[id] || !results.draft[id].ok).map(([id]) => id)
if (missing1.length) {
  log('Stage 1 retry for: ' + missing1.join(', '))
  const retry = await parallel(missing1.map(id => () =>
    agent(draftPrompt(id, T1, 'This is a retry; a previous attempt did not complete. Check whether a partial file exists and complete or rewrite it.'),
      { label: 'draft-retry:' + id, phase: 'Draft', schema: DRAFT, agentType: 'general-purpose' }).then(r => ({ id, r }))))
  for (const d of retry.filter(Boolean)) results.draft[d.id] = d.r
}

phase('Tests')
log('Stage 2a: automated and manual test plans')
const t2a = await parallel([
  () => agent(draftPrompt('12a', T2, 'Do not read the whole spec; read only the sections your task lists plus B 4 and B 27.'), { label: 'draft:12a', phase: 'Tests', schema: DRAFT, agentType: 'general-purpose' }),
  () => agent(draftPrompt('12b', T2, 'Do not read the whole spec; read only the sections your task lists plus B 4 and B 27.'), { label: 'draft:12b', phase: 'Tests', schema: DRAFT, agentType: 'general-purpose' }),
])
results.tests['12a'] = t2a[0]; results.tests['12b'] = t2a[1]
log('Stage 2b: acceptance tests per requirement')
const t2b = await parallel([
  () => agent(draftPrompt('12c', T2, 'Read spec part B (lines 1-1894) for context; the traceability index file gives you the rows.'), { label: 'draft:12c', phase: 'Tests', schema: DRAFT, agentType: 'general-purpose' }),
  () => agent(draftPrompt('12d', T2, 'Read spec parts E, I, P (lines 1896-3193) for context; the traceability index files give you the rows.'), { label: 'draft:12d', phase: 'Tests', schema: DRAFT, agentType: 'general-purpose' }),
])
results.tests['12c'] = t2b[0]; results.tests['12d'] = t2b[1]

phase('Roadmap')
log('Stage 3: roadmap phases 0-16')
const t3 = await parallel([
  () => agent(draftPrompt('11a', T2, 'Read spec B 1.1, B 27, E 12, I 20 and skim the rest; the index files carry the IDs you must cover.'), { label: 'draft:11a', phase: 'Roadmap', schema: DRAFT, agentType: 'general-purpose' }),
  () => agent(draftPrompt('11b', T2, 'Read spec B 1.1, B 27, E 12, I 20 and skim the rest; the index files carry the IDs you must cover.'), { label: 'draft:11b', phase: 'Roadmap', schema: DRAFT, agentType: 'general-purpose' }),
  () => agent(draftPrompt('11c', T2, 'Read spec B 1.1, B 27, B 28, E 12, E 13, I 20 and skim the rest; the index files carry the IDs you must cover.'), { label: 'draft:11c', phase: 'Roadmap', schema: DRAFT, agentType: 'general-purpose' }),
])
results.roadmap['11a'] = t3[0]; results.roadmap['11b'] = t3[1]; results.roadmap['11c'] = t3[2]

phase('Release')
log('Stage 4: release checklist and coverage map')
const t4 = await parallel([
  () => agent(draftPrompt('14', T2, 'Read spec B 26, B 28, E 13, I 19 and all of P (lines 2705-3193).'), { label: 'draft:14', phase: 'Release', schema: DRAFT, agentType: 'general-purpose' }),
  () => agent(draftPrompt('A', T2, 'Read the whole spec to enumerate every section and subsection number.'), { label: 'draft:A', phase: 'Release', schema: DRAFT, agentType: 'general-purpose' }),
])
results.release['14'] = t4[0]; results.release['A'] = t4[1]

phase('Cover')
const SPECPARTS = ['B', 'E', 'I', 'P']
function criticPrompt(X, round) {
  return [
    'You are coverage CRITIC ' + X + ' (round ' + round + ') for the Finger Lickin Music implementation plan.',
    'Read ' + BRIEF + ' first. Then read ' + T2 + ' and follow the section "## CRITIC <X>" with X = ' + X + '.',
    'The specification is ' + SPEC + '. Spec part line ranges: B 1-1894, E 1896-2253, I 2256-2699, P 2705-3193. Read your part completely.',
    'Part files are in ' + PARTS + '/.',
    'Be exhaustive about missing matrix rows: compare the spec text line by line against the matrix rows for your part.',
    'Return the JSON described in the CRITIC section.',
  ].join('\n')
}
function fixerPrompt(X, gaps) {
  return [
    'You are FIXER ' + X + ' for the Finger Lickin Music implementation plan.',
    'Read ' + BRIEF + ' first. Then read ' + T2 + ' and follow the section "## FIXER <X>" with X = ' + X + '.',
    'Part files are in ' + PARTS + '/. The specification is ' + SPEC + '.',
    'Apply every gap below. Keep ASCII only, keep table shapes, keep numbering contiguous, append index lines.',
    'GAPS (JSON):',
    JSON.stringify(gaps),
    'Return the JSON described in the FIXER section.',
  ].join('\n')
}
let round = 0
let totalGaps = -1
while (round < 3 && totalGaps !== 0) {
  round++
  const reports = await parallel(SPECPARTS.map(X => () =>
    agent(criticPrompt(X, round), { label: 'critic:' + X + ' r' + round, phase: 'Cover', schema: CRITIC, agentType: 'general-purpose' })))
  const gapsBy = {}
  totalGaps = 0
  SPECPARTS.forEach((X, i) => { const g = (reports[i] && reports[i].gaps) || []; gapsBy[X] = g; totalGaps += g.length })
  results.cover.push({ round, gaps: SPECPARTS.map((X, i) => ({ X, n: gapsBy[X].length, checked: reports[i] && reports[i].checked })) })
  log('Cover round ' + round + ': ' + totalGaps + ' gaps (' + SPECPARTS.map(X => X + '=' + gapsBy[X].length).join(' ') + ')')
  if (totalGaps === 0) break
  for (const X of SPECPARTS) {
    if (!gapsBy[X].length) continue
    const fx = await agent(fixerPrompt(X, gapsBy[X]), { label: 'fixer:' + X + ' r' + round, phase: 'Cover', schema: FIXER, agentType: 'general-purpose' })
    results.cover[results.cover.length - 1]['fixed_' + X] = fx
  }
}
if (totalGaps !== 0) log('Cover: stopped after 3 rounds with ' + totalGaps + ' gaps still reported (listed in result)')

phase('Consistency')
const GROUPS = ['1', '2', '3', '4']
function skepticPrompt(G) {
  return [
    'You are consistency SKEPTIC G' + G + ' for the Finger Lickin Music implementation plan.',
    'Read ' + BRIEF + ' first. Then read ' + T2 + ' and follow the section "## SKEPTIC <G>" for group G' + G + '.',
    'Part files are in ' + PARTS + '/. Read every file of your group completely (use offset/limit for long files).',
    'Return the JSON described in the SKEPTIC section, most important issues first.',
  ].join('\n')
}
function sfixPrompt(G, issues) {
  return [
    'You are SKEPTIC-FIXER G' + G + ' for the Finger Lickin Music implementation plan.',
    'Read ' + BRIEF + ' first. Then read ' + T2 + ' and follow the section "## SKEPTIC-FIXER <G>".',
    'Part files are in ' + PARTS + '/. Apply each issue below with minimal in-place edits; keep IDs, table shapes and ASCII.',
    'ISSUES (JSON):',
    JSON.stringify(issues),
    'Return the JSON described in the SKEPTIC-FIXER section.',
  ].join('\n')
}
const skep = await parallel(GROUPS.map(G => () =>
  agent(skepticPrompt(G), { label: 'skeptic:G' + G, phase: 'Consistency', schema: SKEPTIC, agentType: 'general-purpose' })))
const issuesBy = {}
GROUPS.forEach((G, i) => { issuesBy[G] = (skep[i] && skep[i].issues) || [] })
log('Consistency: ' + GROUPS.map(G => 'G' + G + '=' + issuesBy[G].length).join(' ') + ' issues')
const sfx = await parallel(GROUPS.filter(G => issuesBy[G].length).map(G => () =>
  agent(sfixPrompt(G, issuesBy[G]), { label: 'sfix:G' + G, phase: 'Consistency', schema: SFIX, agentType: 'general-purpose' })))
results.consistency = { issues: GROUPS.map(G => ({ G, n: issuesBy[G].length, sample: issuesBy[G].slice(0, 8) })), fixes: sfx }

return results
