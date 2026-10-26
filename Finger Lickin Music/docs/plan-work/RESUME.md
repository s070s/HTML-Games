# RESUME: Finger Lickin Music implementation plan, work in progress

Snapshot date: 2026-10-26. Branch: `claude/determined-albattani-savk7i` (stage 1 completed there;
the 2026-10-25 work was on `claude/modest-ramanujan-pgmwvt`). Status: the plan document
`docs/IMPLEMENTATION-PLAN.md` does not exist yet. This folder holds everything needed to finish
it in a fresh session (the owner intends to resume locally with Opus 5.5 at high effort).

Nothing in `Finger Lickin Music/` is game code. The deliverable of this work is one Markdown
document that a later coding session implements the whole game from.

## 1. What exists

All files are UTF-8 with BOM, LF, ASCII content.

| Path (relative to this folder) | Role | State |
|---|---|---|
| `brief/BRIEF.md` | Binding brief for every drafting agent: writing rules, ID conventions, 16 fixed architecture decisions (ADR-01..16), the fixed module map M-01..M-31, fixed data model names, fixed numeric budgets, fixed screens and keys, repo conventions, the three open questions | Final |
| `brief/TASKS-stage1.md` | Per-part drafting instructions for Parts 0-10, 13, 15a-d and Appendices B/C/D, including the shared module-design template | Final |
| `brief/TASKS-later.md` | Instructions for Parts 12a-d (tests), 11a-c (roadmap), 14 (release), Appendix A (coverage), the coverage CRITIC/FIXER loop and the consistency SKEPTIC/FIXER pass | Final |
| `parts/00-front.md` | Part 0 "How to use this plan" | Drafted (584 lines) |
| `parts/01-scope.md` | Part 1 "Product scope and delivery profiles" | Drafted (381) |
| `parts/02-adr.md` | Part 2 "Architecture and technology decisions" ADR-01..16 elaborated | Drafted (1,276) |
| `parts/03-repo.md` | Part 3 "Repository layout, build, and tooling" | Drafted (1,186) |
| `parts/04-modules.md` | Part 4 "Module map, interfaces, and integration" | Drafted (792) |
| `parts/05-data.md` | Part 5 "Data model and serialization" | Drafted (1,448) |
| `parts/06a-mod-foundation.md` | Part 6 heading + modules M-01..M-06 | Drafted (2,220) |
| `parts/06b-mod-input.md` | Modules M-07, M-08, M-09 | Drafted (1,293) |
| `parts/06c-mod-parsers.md` | Modules M-10..M-14 | Drafted (2,364) |
| `parts/06d-mod-project.md` | Modules M-15, M-16, M-17 | Drafted (1,569) |
| `parts/06e-mod-render.md` | Modules M-18..M-22 | Drafted (2,863) |
| `parts/06f-mod-modes.md` | Modules M-23, M-24, M-25 | Drafted (1,967) |
| `parts/06g-mod-ui.md` | Modules M-26..M-31 | Drafted (3,290) |
| `parts/06x-ut-index-{a..g}.txt` | Unit-test indexes (`UT-MM-nn | M-MM | name`) for the module parts: a 162, b 102, c 149, d 87, e 120, f 96, g 117 | Drafted |
| `parts/07-ui.md` | Part 7 "User interface and navigation" | Drafted (2,191) |
| `parts/08-import.md` | Part 8 "Import, export, and compatibility strategy" | Drafted (1,239) |
| `parts/09-perf.md` | Part 9 "Performance budgets and device matrix" | Drafted (1,081) |
| `parts/10-safety.md` | Part 10 "Security, privacy, accessibility, and failure recovery" | Drafted (1,168) |
| `parts/13-risks.md` | Part 13 "Risk register" (RISK-01..77) | Drafted (253) |
| `parts/15a-trace-B.md` + `15x-index-B.txt` | Matrix 15.0 preface and 15.1 (B): 921 rows | Drafted (1,193) |
| `parts/15b-trace-E.md` + `15x-index-E.txt` | Matrix 15.2 (E): 364 rows | Drafted (443) |
| `parts/15c-trace-I.md` + `15x-index-I.txt` | Matrix 15.3 (I): 343 rows | Drafted (352) |
| `parts/15d-trace-P.md` + `15x-index-P.txt` | Matrix 15.4 (P): 360 rows | Drafted (376) |
| `parts/B-appendices.md` | Appendices B (glossary), C (prohibited mistakes), D (templates) | Drafted (751) |
| `parts/12a-tests-auto.md` + `12x-index-a.txt` | Part 12 heading, 12.1-12.7: strategy, UT index (833, copied), IT-001..060, FT-001..114, TT-001..036, PT-001..024, FI-001..042 | Drafted (1,874) |
| `parts/12b-tests-manual.md` + `12x-index-b.txt` | 12.8-12.11: XT-001..076, LT-001..096, release-blocking gate, evidence recording | Drafted (904) |
| `parts/12c-tests-at-B.md` + `12x-index-c.txt` | 12.12: 897 acceptance tests for B P0/P1 rows (merged from two slices) | Drafted (914) |
| `parts/12d-tests-at-EIP.md` + `12x-index-d.txt` | 12.13: 1,024 acceptance tests for E/I/P P0/P1 rows (merged from three slices) | Drafted (1,048) |
| `OPEN-ISSUES-stage1.md` | Cross-part conflicts and owner decisions reported by the stage 1 drafters; input for stages 5 and 6 | Open |
| `tools/assemble.mjs` | Concatenates `parts/` in the fixed order into the single plan file, generates the contents list, rewrites the matrix Phase column to T-IDs from the `11x-index-*.txt` files, writes BOM + LF. Usage: `node tools/assemble.mjs <partsDir> <outFile>` | Ready, untested on a full set |
| `tools/check-plan.mjs` | Mechanical checks on the assembled file: BOM, LF, ASCII, duplicate and undefined IDs (T, R, UT, IT, FT, TT, PT, XT, FI, LT, AT, RISK, ADR, M), seven mandatory labels per T entry, table column counts, invalid Status words, P0/P1 rows without an AT, spec sections missing from Appendix A, completion-claim scan, counts. Usage: `node tools/check-plan.mjs <plan> <spec>`; exit 1 on errors | Ready, untested on a full set |
| `tools/workflow-flm-plan.js` | The orchestration script used in the cloud session (Claude Code Workflow tool API). Reference only: its paths point at a scratchpad that no longer exists; the prompt texts in it are the ones to reuse | Reference |
| `PLAN-OF-WORK.md` | The approved plan for producing the document (outline, method, verification) | Reference |
| `../SPECIFICATION.txt` | The source specification, four parts (B base lines 1-1894, E 1896-2253, I 2256-2699, P 2705-3193) | Final |

## 2. What is missing (in dependency order)

Stage 1 is complete (all 23 parts drafted). Stage 2 is complete (Parts 12a-12d). The matrix
rows were kept one per obligation (owner gave no collapse instruction), so 12c/12d hold 1,921
acceptance tests. The license decision in `OPEN-ISSUES-stage1.md` section A is still open.
Stage 2 notes: 12c and 12d were each drafted as row slices by parallel agents and merged by
script (order and cell counts verified); a Method cell may combine forms separated by `; `.

Stage 3 (after stage 2): `11a-toc-0-5.md`, `11b-toc-6-10.md`, `11c-toc-11-16.md` in parallel
(each with its `11x-index-*.txt`).

Stage 4 (after stage 3): `14-release.md` and `A-coverage.md` in parallel.

Stage 5: coverage critics for spec parts B, E, I, P in parallel; fixers one at a time
(they edit shared files); repeat until a round reports zero gaps (max 3 rounds).

Stage 6: four consistency skeptics over the disjoint file groups named in TASKS-later.md;
then their fixers in parallel.

Stage 7: assemble, check, fix until clean; write the final files; commit; push.

## 3. How to run a drafting agent

Give each agent this prompt, replacing `<ID>` (for example `06e`, `15a`, `12c`), `<TASKS>`
(`TASKS-stage1.md` or `TASKS-later.md`), `<WORK>` (the absolute path of this folder) and
`<SPEC>` (the absolute path of `docs/SPECIFICATION.txt`):

```text
You are drafting part "<ID>" of the Finger Lickin Music implementation plan (a single large
Markdown document that a later coding session must be able to implement the whole game
from, in one go).
1. Read <WORK>/brief/BRIEF.md completely. It is binding (names, numbers, decisions, ID
   schemes, writing rules).
2. Read <WORK>/brief/<TASKS> and locate the section whose heading starts with "TASK <ID>".
   Follow it exactly. Shared templates and rules in that file apply to you.
3. The specification is <SPEC> (3,193 lines). Read it completely in chunks of about 700
   lines unless your task names specific sections only.
4. Read the already drafted parts your task names (in <WORK>/parts/) and keep names
   consistent with them; for module parts read 04-modules.md and 05-data.md.
5. Write your output file(s) into <WORK>/parts/ using the exact file names in the task.
   ASCII only (no byte above 0x7F), LF line endings. Write long tables incrementally.
6. Decide everything; no "TBD", no "could", no unresolved alternatives except the three
   OQs in the brief. Never describe anything as implemented, done, tested or measured.
When finished, report the output paths, line counts, a short summary and open issues.
```

For the matrix parts (15a-d) add: the header row must be exactly
`| R-ID | Spec ref | Requirement | Priority | Module(s) | Phase | Tests | Status |`,
every row has exactly 8 cells, and the Requirement text never contains a pipe.

Critics, fixers and skeptics use the "CRITIC <X>", "FIXER <X>", "SKEPTIC <G>" and
"SKEPTIC-FIXER <G>" sections of `TASKS-later.md`; pass the gap or issue JSON into the fixer
prompt. The cloud run used the structured return shapes shown in `tools/workflow-flm-plan.js`.

## 4. Assembly and verification

```sh
cd "Finger Lickin Music/docs/plan-work"
node tools/assemble.mjs parts ../IMPLEMENTATION-PLAN.md
node tools/check-plan.mjs ../IMPLEMENTATION-PLAN.md ../SPECIFICATION.txt
```

Fix every error the checker prints (it names IDs and line numbers) and re-run until it
exits 0. Expected final size: 400-800 KB, 10,000-18,000 lines. Then:
- restore the README status paragraph to: "Status: implementation plan version 1.0.0.
  There is no game yet. Nothing in this folder runs." and keep the pointer lines;
- keep this `plan-work/` folder in the repo (it is the provenance of the plan), or delete
  it in the same commit if the owner prefers a clean docs folder;
- commit: `Finger Lickin Music docs: complete implementation plan (spec FLM-1.0 to 1.3.0),
  no game code yet`; push only when the owner says so.

## 5. Decisions and incidents recorded during the cloud session

- Plan mode was active during the first drafting run; agents could not write to disk and
  stored their complete drafts inside plan files. Those ten drafts were recovered verbatim
  into `parts/`. No content was lost; the drafts are complete parts, not fragments.
- The cloud container had 4 CPUs, which caps the Workflow tool at 2 concurrent agents. The
  remaining drafting was therefore launched as directly spawned parallel agents; they were
  stopped at the owner's request before writing anything, which is why stage 1 is partial.
- Event-bus topics: Part 4 fixes the convention that topics are written as bare dotted
  names (`transport.state`) in code and tables; the `EVT-` prefix appears only as the ID
  form in prose. Keep this; do not rename.
- Part 3 adds two decisions beyond the brief that later parts must honor: the online
  edition build `FingerLickinMusic.online.html` (gitignored) and cross-module test files
  `src/92-test-<group>.js` in addition to the per-module `src/91-test-<module>.js`.
- Parts 6a-6d were drafted in parallel with Parts 4 and 5, so public API names may
  diverge slightly; the stage 6 consistency pass (group G2 against G1) reconciles them.
- The matrix Phase column is written as `Phase NN` by the 15a-d agents and rewritten to
  T-IDs by `assemble.mjs` from the `11x-index-*.txt` files; rows with no T entry stay as
  `Phase NN` and are reported as warnings.
- The README was committed early with an "in preparation" status line so the branch never
  describes a missing file as present; the final commit restores the wording above.
- The first commit on this branch (1744cd5) holds `docs/SPECIFICATION.txt` and `README.md`.

- Stage 2 (same session): 12a and 12b first, then five AT slice agents (B 1-12, B 13-29, E, I,
  P) whose fragments were merged into 12c and 12d. Their open issues are appended to
  `OPEN-ISSUES-stage1.md` (lines starting with `- 12`).
- 2026-10-26 session (cloud, `claude/determined-albattani-savk7i`): the 13 missing stage 1
  parts were drafted by 13 parallel agents and committed one by one as each finished. Agents
  wrote files without a BOM; the session added the BOM before each commit. Every agent's open
  issues are in `OPEN-ISSUES-stage1.md`. The matrices came out larger than the brief expected
  (1,988 rows in total). Several parts invented error codes independently (E-NET, E-REN,
  E-PRJ, E-AUD ranges overlap between 06e, 06f, 07 and 10); stage 6 must build one registry,
  with Part 10.6 as the base. The session stopped at the stage 1 boundary to stay within the
  owner's credit budget.

## 6. Conventions the next session must keep

- UTF-8 with BOM, LF, ASCII-only content for every new text file.
- ID conventions, status vocabulary and numeric budgets exactly as in `brief/BRIEF.md`.
- Never mark anything implemented in the plan; the plan precedes all code.
- Commit messages start with `Finger Lickin Music docs: `; push only on the owner's go.
