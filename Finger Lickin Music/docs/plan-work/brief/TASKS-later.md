# Stage 2-6 tasks

Common procedure: read `BRIEF.md` first. Read the specification as directed. Read the
earlier part files you are told to read from the `parts/` directory (paths in your prompt).
Write only the files your task names. ASCII only, LF. Return the JSON your prompt asks for.

---------------------------------------------------------------------------------------

## TASK 12a  (file `12a-tests-auto.md`, index `12x-index-a.txt`)

Inputs to read: BRIEF; spec sections B 25, B 26, E 2, E 3, E 4, E 5, E 6, E 7, E 9, E 11,
E 13, I 13, I 17, I 19, P 20; the unit test index files `parts/06x-ut-index-*.txt` (all
seven); Part 8 (`parts/08-import.md`) section 8.9 corpus table; Part 9
(`parts/09-perf.md`); Part 10 (`parts/10-safety.md`) sections 10.7-10.9; Part 4
(`parts/04-modules.md`) section 4.6 invariants.

Write heading `## 12. Testing and acceptance plan` then:
- `### 12.1 Strategy and tooling`: test levels, where each runs (in-page runner groups,
  `tools/selftest.mjs`, `tools/perf.mjs`, manual), gating rules per T section and per
  phase, the no-CI statement, regression policy (every fixed defect gets a test).
- `### 12.2 Unit test index`: one table per module: UT-ID | name (from the index files;
  include every UT line; do not invent new UT IDs).
- `### 12.3 Integration tests (IT-001..)`: table ID | Title | Modules | Setup | Steps |
  Expected | Pass criterion | Automated (yes/no). Cover every item in B 25.2 and the 4.6
  invariants, input->audio, input->scoring, MIDI->playback, MIDI->animation (controllers
  receive scheduled events with correct audio times), recording->save->reload, multitrack
  mixing, dance->scoring, customization->saved appearance, multiplayer sync (loopback
  transport in one page with two client instances), offline operation. At least 40.
- `### 12.4 File-format tests (FT-001..)`: one or more rows per corpus file from 8.9
  (reference file names), plus writer round trips and limits. At least 50.
- `### 12.5 Timing tests (TT-001..)`: scheduled event precision, drift over 10 min loop
  (OfflineAudioContext accelerated), pause/resume no shift, seek reconciliation, loop
  boundary with sustained note, tempo changes, speed changes, render stall injection
  (`timer.stall`) does not shift timeline, background/foreground, calibration applied once,
  dense chord at identical timestamps, event exactly on loop boundary. At least 25.
- `### 12.6 Performance tests (PT-001..)`: from Part 9 budgets, each with scenario and
  threshold. At least 15.
- `### 12.7 Fault-injection tests (FI-001..)`: one per hook in 10.9 and per E 11 minimum
  rule and I 13.1 list, each with expected recovery and data-safety assertion. At least 20.
Index file: one line per test `ID | title`.

## TASK 12b  (file `12b-tests-manual.md`, index `12x-index-b.txt`)

Inputs: BRIEF; spec B 25.5, B 26, E 9, E 13, I 12, P 14, P 18, P 20; Part 1 section 1.6;
Part 7 (`parts/07-ui.md`) screens list; Part 9 device matrix.

Write:
- `### 12.8 Cross-device and browser tests (XT-001..)`: for each of the five browsers and
  for `file://` vs `http(s)`: audio unlock, 4-touch simultaneous pads (OQ-1), IndexedDB,
  download/export, file import, WebGL init and tier, orientation change, background
  return, Web MIDI availability message, WebRTC availability, screen lock. At least 30.
- `### 12.9 Live manual tests (LT-001..)`: columns ID | Area | Device(s) | Setup | Steps |
  Expected | Pass criterion. Cover the P checklist items that cannot be automated (visual
  alignment, audio pops, gestures, readability) and every B 26 acceptance bullet needing a
  human. At least 60.
- `### 12.10 Release-blocking gate`: the E 13 list and B 26.8 delivery list each mapped to
  the tests that must pass (IDs from 12.3-12.9 and AT tables) and the evidence to record.
- `### 12.11 Evidence recording`: where results go (`docs/FINAL-REPORT.md` sections,
  `docs/COMPATIBILITY.md`), the "not measured" rule, and that browser versions and devices
  are recorded.
Index file: one line per test `ID | title`.

## TASK 12c  (file `12c-tests-at-B.md`, index `12x-index-c.txt`)

Inputs: BRIEF; `parts/15x-index-B.txt`; spec part B for context; `parts/06x-ut-index-*.txt`
and `parts/12x-index-a.txt` if present (to reference automated tests by ID).
Write `### 12.12 Acceptance tests for base specification requirements (AT, B)`: a table
with one row per P0 and P1 requirement in the B index: `AT-<R-ID> | R-ID | Procedure |
Pass criterion | Method` where Method is `auto: <UT/IT/FT/TT/PT/FI IDs>` or `manual: LT
<area>` or `review` (for documentation obligations). Procedures must be specific to the
requirement, not generic. Index: one line per AT `AT-ID | R-ID`.

## TASK 12d  (file `12d-tests-at-EIP.md`, index `12x-index-d.txt`)

Same as 12c for the E, I and P indexes (`parts/15x-index-E.txt`, `-I.txt`, `-P.txt`),
heading `### 12.13 Acceptance tests for edge-case, improvement, and polish requirements
(AT, E/I/P)`, three sub-tables.

---------------------------------------------------------------------------------------

## Roadmap tasks (11a-11c)

Inputs: BRIEF; spec B 27 (phases), B 1.1 (the eight mandatory fields), E 12 and I 20
(mandated dedicated sections); all `parts/15x-index-*.txt` (R-IDs with priority and
phase); `parts/06x-ut-index-*.txt`; `parts/12x-index-*.txt`; `parts/13-risks.md` (RISK
IDs); `parts/04-modules.md` (module order); `parts/03-repo.md`; `parts/08-import.md` 8.9;
`parts/09-perf.md`; `parts/10-safety.md`.

Entry format (fixed; every entry has all seven labels; this plus the heading gives the
eight mandatory fields of B 1.1):

```
### T04.03 Voice allocator and note stealing
- Position: Phase 4 "Audio engine", step 3 of 9.
- Purpose: <what is built and the expected outcome in one or two sentences>.
- Covers: R-B11.2-05, R-B11.6-02, R-E2.3-08; modules M-05, M-06.
- Depends on: T04.01, T04.02, T02.04.
- Deliverables: <files, classes/functions, UI, docs, corpus files>.
- Verification: UT-05-03..UT-05-09 pass; IT-004; TT-002; LT-010; AT-R-B11.2-05.
- Open items: <assumptions, risks (RISK-nn), decisions deferred; or "none">.
```

Rules: every R-ID in the index files whose Phase matches your phases must appear in at
least one `Covers:` line (Deferred R-IDs appear in a "Deferred register" entry of the
phase that would own them, with the reason). Every UT/IT/FT/TT/PT/FI/XT/LT ID should be
referenced by at least one entry across the three roadmap parts (12 tests and 15/16
review entries absorb the rest). Steps within a phase follow module load order and
dependency order. Each phase has 6-14 entries. Also write an index file with one line per
entry: `T-ID | title | R-IDs covered (space separated)`.

Mandated dedicated sections (each must be exactly one T entry, titled as given, in the
phase shown):
- Phase 0: "Risk register and severity classification"; "Requirements-to-test
  traceability matrix"; "Quantitative performance targets"; (all three are
  complete-by-this-document: their deliverable is Parts 13, 15, 9 and their re-validation
  at Phase 16).
- Phase 1: "Single-file dependency and packaging budget"; "Accessibility requirements";
  "Automated quality gates and regression testing".
- Phase 2: "Unified musical engine and event architecture"; "Timing, scheduling, and
  drift test plan".
- Phase 3: "Input lifecycle and simultaneous-press tests".
- Phase 4: "Audio lifecycle and recovery matrix"; "Audio fidelity and General MIDI
  coverage strategy".
- Phase 5: "Instrument-specific animation and stage direction"; "Rendering degradation
  and resource-cleanup tests".
- Phase 7: "MIDI parser edge-case corpus"; "Import inspection and automatic chart
  generation"; "Data-driven instruments and extensible import adapters".
- Phase 8: "Four-button mapping and adaptive difficulty"; "Scoring boundary-condition
  tests"; "Onboarding and contextual interface design" (tutorial included).
- Phase 9: "Non-destructive studio editing"; "Recording integrity and project recovery
  tests"; "Storage quota and project migration tests"; "Autosave, recovery, and fault
  injection" (hooks built here; FI execution in Phase 15).
- Phase 10: "Player progression and performance history".
- Phase 11: "Dance-mode gameplay and choreography"; "Dance-chart validation tests".
- Phase 12: "MusicXML and Guitar Pro compatibility matrix".
- Phase 13: "Multiplayer modes and synchronization architecture"; "Multiplayer
  synchronization and security tests".
- Phase 14: "Mobile performance profiles".
- Phase 15: "Browser and standalone-file compatibility matrix"; "Dependency failure and
  offline tests"; "Fault-injection strategy".
- Phase 16: "Final failure-recovery acceptance review"; "Final product-quality acceptance
  review".

### TASK 11a  (file `11a-toc-0-5.md`, index `11x-index-a.txt`)
Write heading `## 11. Implementation roadmap: end-to-end table of contents`, then
`### 11.0 Phase gates` (table: Phase | Title | Entry criteria | Exit criteria | Regression
suite to run | Estimated share of effort percent), then the phases 0-5 with a short
phase preface each (`### Phase N: Title` as a plain level-3 heading line before the T
entries). Phase 0 entries are marked complete-by-this-document except the ones that
create the folder, branch, ledger and status files, which the implementing session does
first.

### TASK 11b  (file `11b-toc-6-10.md`, index `11x-index-b.txt`)
Phases 6-10.

### TASK 11c  (file `11c-toc-11-16.md`, index `11x-index-c.txt`)
Phases 11-16. Phase 16 includes: final build, independent validation of the delivered
file (open from `file://` in each available browser), full acceptance suite, documentation
(`docs/COMPATIBILITY.md`, `docs/FINAL-REPORT.md`, README update), Part 15 Status column
update, license inventory, known issues, launch instructions, relay deployment
instructions, packaging verification.

---------------------------------------------------------------------------------------

## TASK 14  (file `14-release.md`)  heading: `## 14. Release checklist, polish gates, and final report`

Inputs: BRIEF; spec B 26, B 28, E 13, I 19, P 1-22; `parts/11x-index-*.txt`;
`parts/12x-index-*.txt`; `parts/01-scope.md`; `parts/08-import.md` 8.7.

Write:
- 14.1 Delivery checklist (B 26.8, P 18): checkbox list with the evidence required.
- 14.2 Polish gates: for each P section 1-22, a table: checklist item | owning module(s)
  | T section(s) that deliver it | verification (test IDs or LT) | status at v1.0.0
  (Unimplemented). Every P checklist line must appear.
- 14.3 Release-blocking gate summary (pointer to 12.10 with the list restated).
- 14.4 `docs/COMPATIBILITY.md` template (from 8.7).
- 14.5 `docs/FINAL-REPORT.md` template: the 14 items of B 28, each with the fields to fill
  and the rule that implemented, partial, unverified and future work are separated.
- 14.6 Dependency and license inventory template (expected content: no runtime
  dependencies; dev tools list).
- 14.7 Known limitations to publish at v1 (from Part 1.5) with the exact sentences.
- 14.8 Launch and usage instructions template (opening the file, enabling audio, controls,
  importing, saving/exporting, multiplayer setup in both editions).
- 14.9 Relay deployment instructions template.

---------------------------------------------------------------------------------------

## TASK A  (file `A-coverage.md`)  heading: `## Appendix A. Specification coverage map`

Inputs: the spec (all four parts; list every section and subsection number); all
`parts/11x-index-*.txt`; the part files' headings (use Grep for `^## ` and `^### ` in
`parts/`).
Write a table: spec part | section | title | plan sections (Part numbers and subsection
numbers) | T sections. Every numbered section and subsection of B (1.1 ... 29), E (1 ...
13 with subsections), I (1 ... 21 with subsections), P (1 ... 22 with subsections) must
have a row with at least one plan section. Then a short "Gaps" subsection that must say
"none" (if you find a gap, fix it by naming where it is actually covered; if it is truly
uncovered, list it so the critics can route it).

---------------------------------------------------------------------------------------

## CRITIC <X>  (X in B, E, I, P)

You are a coverage critic for spec part X. Read BRIEF; read the spec part X completely;
read `parts/15x-index-X.txt`; read the matching matrix file (`parts/15a-trace-B.md`,
`15b-trace-E.md`, `15c-trace-I.md` or `15d-trace-P.md`); read all `parts/11x-index-*.txt`;
read `parts/12x-index-c.txt` and `12x-index-d.txt`.
Check and report gaps:
1. Every obligation bullet/line/row in spec part X has a matrix row (list missing ones
   with spec section and the text).
2. Every P0/P1 R-ID in the index has an `AT-<R-ID>` in the 12x indexes.
3. Every R-ID appears in at least one T entry's covered list (11x indexes), Deferred ones
   in a Deferred register entry.
4. Rows whose Module or Phase is implausible (e.g. an audio requirement assigned to M-26).
5. Duplicate R-IDs or malformed IDs.
Return JSON `{gaps:[{kind:"missing-row"|"missing-at"|"uncovered"|"wrong-assignment"|
"malformed", ref:"<spec section or R-ID>", detail:"<text>", fix:"<file to change and what
to add>"}], checked:{rows:n, p0p1:n, ats:n, covered:n}}`. Report at most 150 gaps per
round; prefer missing rows first.

## FIXER <X>

You receive a JSON list of gaps for spec part X. Apply every fix: add matrix rows (keeping
the section's numbering contiguous: new rows take the next free number in that section),
add `AT-` rows to the right 12c/12d table and index, add R-IDs to the right T entries'
`Covers:` lines and 11x index lines (choose the T entry by module and phase), correct
assignments. Keep all files ASCII, keep table column counts, append to index files. Do not
remove existing rows. Return JSON `{applied:n, skipped:[{ref, reason}]}`.

---------------------------------------------------------------------------------------

## SKEPTIC <G>  (G in 1..4)

You are a consistency reviewer. Read BRIEF. Read the files of your group:
- G1: `00-front.md 01-scope.md 02-adr.md 03-repo.md 04-modules.md 05-data.md`
- G2: `06a-mod-foundation.md 06b-mod-input.md 06c-mod-parsers.md 06d-mod-project.md`
- G3: `06e-mod-render.md 06f-mod-modes.md 06g-mod-ui.md 07-ui.md 08-import.md`
- G4: `09-perf.md 10-safety.md 11a-toc-0-5.md 11b-toc-6-10.md 11c-toc-11-16.md
  12a-tests-auto.md 12b-tests-manual.md 13-risks.md 14-release.md B-appendices.md
  A-coverage.md`
Find and report: contradictions with BRIEF numbers, names, decisions or vocabulary;
contradictions between files in your group; undecided choices ("could", "either",
"TBD", "to be decided") outside the three OQs; anything described as implemented, done,
verified or measured; non-ASCII characters (grep for bytes > 0x7F); malformed tables
(column count mismatch); missing mandatory subsection labels in Part 6 modules or Part
11 entries; function signatures that conflict between Part 4/5 and Part 6. Return JSON
`{issues:[{file, line, kind, detail, fix}]}` with at most 120 issues, most important
first.

## SKEPTIC-FIXER <G>

You receive a JSON list of issues for your file group. Apply each fix in place with
minimal edits (Edit tool), preserving IDs and table shapes. Return
`{applied:n, skipped:[{file, line, reason}]}`.
