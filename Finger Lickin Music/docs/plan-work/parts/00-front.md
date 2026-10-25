## 0. How to use this plan

### 0.1 Plan identity

| Item | Value |
|---|---|
| Plan version | 1.0.0 |
| Plan date | 2026-10-25 |
| Document | `Finger Lickin Music/docs/IMPLEMENTATION-PLAN.md` (this file) |
| Repository | `s070s/HTML-Games`; folder `Finger Lickin Music/` at the repository root, next to `Beat Em Up/`, `ClassTimeKiller/`, `Mech Flight Sim/` |
| Shipped file | `Finger Lickin Music/FingerLickinMusic.html` (players open this file; no build step is needed to play) |
| Test build | `Finger Lickin Music/FingerLickinMusic.test.html` (gitignored; written by `node tools/build.mjs`; contains the self-test modules) |
| Specification copy | `Finger Lickin Music/docs/SPECIFICATION.txt`, 3,193 lines, the four specification parts concatenated in order |
| Development ledger | `Finger Lickin Music/docs/LEDGER.md` (ADR-16; template in Appendix D) |
| Live status | `Finger Lickin Music/docs/STATUS.md` (structure in 0.7; template in Appendix D) |
| Implementation status at version 1.0.0 | Nothing is implemented. Every requirement in Part 15 is Unimplemented or Deferred. |

Specification parts covered, with their line ranges inside `docs/SPECIFICATION.txt`:

| Code | Title | Version | Lines | Sections |
|---|---|---|---|---|
| B | Complete Product Requirements and Technical Specification (base) | FLM-1.0 | 1-1894 | 1-29 |
| E | Edge Cases and Critical Failure Modes | FLM-1.1.0, dated 2026-10-23 | 1896-2253 | 1-13 |
| I | Essential Product Improvements | FLM-1.2.0, dated 2026-10-23 | 2256-2699 | 1-21 |
| P | Complete Maximum-Polish Checklist | FLM-1.3.0, dated 2026-10-23 | 2705-3193 | 1-22 |

Citation form used in every part of this plan: part code, one space, section number, for
example `B 7.3`, `E 2.3`, `I 5.1`, `P 6.3`. Line numbers above let the reader open the spec
copy at the right place; sections are cited, lines are not.

Plan versioning: the implementing session may raise only the patch number (1.0.x) and only
for corrections that do not change an ADR, a module boundary, a data model name, or the T
section list. Any such correction is recorded in the LEDGER "Decisions" section and, when a
requirement row is affected, in Part 15 (B 27 last paragraph: the roadmap changes only through
documented changes to the traceability matrix and the plan). Minor and major changes are the
owner's decision and are not made by the implementing session.

### 0.2 What this document is and is not

This document is:

- The complete, decided design of Finger Lickin Music: architecture decisions (Part 2),
  repository layout and tooling (Part 3), module map and interfaces (Part 4), data model and
  serialization (Part 5), normative module designs with algorithms and unit tests (Part 6),
  user interface (Part 7), import and export strategy (Part 8), performance budgets (Part 9),
  security, privacy, accessibility and failure recovery (Part 10).
- An executable roadmap: Part 11 lists every T section in dependency order with entry
  criteria, deliverables, verification and exit criteria; Part 12 lists every test; Part 13
  the risks; Part 14 the release checklist and final report; Part 15 the traceability matrix.
  Together these are the thirteen planning artifacts of B 1.2 and the end-to-end table of
  contents of B 1.1, and they satisfy the additions demanded by E 12 and I 20.
- The single source of truth for names: modules, types, fields, events, screens, status
  words. Where the specification is silent or allows alternatives, this plan has chosen, and
  the choice is final for version 1.0.0 except the three open questions in Part 2.19.

This document is not:

- A status report. At version 1.0.0 nothing is implemented, built, verified, tested or
  measured, and no sentence in it claims otherwise. Results are recorded later in
  `docs/STATUS.md`, `docs/LEDGER.md` and `docs/FINAL-REPORT.md`.
- A replacement for the specification. The spec says what; this plan says how. When the two
  appear to disagree, follow the plan where it records a decision with a reason (an ADR in
  Part 2 or an item in Part 1.5), otherwise follow the spec and record the discrepancy in the
  LEDGER "Open issues" section.
- Permission to omit. Priorities P0, P1, P2 define sequencing, not permission to omit
  requested functionality silently (B 4.1).
- Finished code. Algorithms are given as pseudocode or numbered steps and signatures are
  exact; the implementing session writes the code.

### 0.3 Reading order

1. Read Part 0 (this part) completely, then Parts 1, 2, 3, 4 and 5 completely, then Parts 9
   and 10 completely, before writing any code. These parts fix the names, the numbers, the
   module boundaries, the clock rules and the recovery rules that every module depends on.
2. Read Appendix D (templates) when performing 0.4 step 3, and Appendix C (prohibited
   mistakes and their guards) together with the 0.5 checklist at every phase gate. Use
   Appendix B (glossary) whenever a term is unclear.
3. Read the Part 6 module design for a module (`6.N M-NN`) immediately before implementing
   that module, in full, including its unit test table; it is normative. Do not read all of
   Part 6 up front; it is long and the details must be fresh when the code is written.
4. Execute Part 11 in T order. Each T section names the Part 6 sections, Part 7 screens,
   Part 8 tables, Part 12 tests and Part 15 requirement rows it covers; read those when the T
   section directs. Parts 7, 8, 12, 13, 14 and 15 are reference material consulted this way,
   not read front to back.
5. Re-read Part 0 sections 0.4 to 0.7 at the start of every session (fresh or resumed) and at
   every phase gate.

### 0.4 One-session execution procedure

The procedure assumes one session that runs from Phase 01 to Phase 16. It is written so that
a cut-off at any point loses at most one T section of ledger information, and so that a fresh
session can continue from Part 0 and the LEDGER alone.

Step 0. Preconditions. The working directory is the repository root (the directory that
contains `.git/` and `Finger Lickin Music/`). The folder already contains `docs/` with this
plan and the specification copy, and `README.md`, committed by the planning session. Check:

```text
cd <repository root>
git status --porcelain                 # must print nothing (clean tree)
node --version                         # must print v22 or newer
test -f "Finger Lickin Music/docs/IMPLEMENTATION-PLAN.md" && test -f "Finger Lickin Music/docs/SPECIFICATION.txt" && echo OK
```

If any check fails, stop and report; the plan cannot be executed without the specification
copy, a clean tree, or Node 22.

Step 1. Create the implementation branch from the commit that contains this plan (normally
`main` after the owner merges the planning branch; otherwise the planning branch itself):

```text
git checkout -b flm-implementation
```

Step 2. Create the source folders and add the test-build ignore line (Part 3.10):

```text
cd "Finger Lickin Music"
mkdir -p src tools server test-corpus docs
printf '\n# Finger Lickin Music test build (tools/build.mjs writes it next to the game)\nFinger Lickin Music/FingerLickinMusic.test.html\n' >> ../.gitignore
```

Step 3. Create `docs/LEDGER.md` and `docs/STATUS.md` from the Appendix D templates. The first
LEDGER entry records: the date; "Phase 00: planning artifacts satisfied by
IMPLEMENTATION-PLAN.md 1.0.0"; the result of validating the plan against the specification
during the 0.3 reading (any inconsistency found and how it was resolved); the environment
assumptions of 0.10 as confirmed or refuted by the Step 0 checks; and the line `RESUME: T01.01`.
STATUS.md starts with every requirement row Unimplemented or Deferred exactly as Part 15 lists
them (0.7). Commit the two documents:

```text
git add docs/LEDGER.md docs/STATUS.md ../.gitignore
git commit -m "Finger Lickin Music docs: start implementation ledger and status"
```

Step 4. For each T section of Part 11, in order:

1. Read the T section. Confirm every dependency it lists is marked done in STATUS.md section
   2 or in the LEDGER; if not, stop and resolve the ordering (record it in the LEDGER).
2. Read the Part 6 module section(s), Part 7 screen(s), Part 8 table(s) and Part 5 types the
   T section names.
3. If this is the first T section of a phase, re-read the 0.5 checklist and Appendix C.
4. Implement exactly the deliverables the T section names: the files, functions, screens,
   tests and documents, with the names given in Parts 4, 5 and 6. Do not implement
   deliverables of later T sections early.
5. Build. Until `tools/build.mjs` exists (it is created in Phase 01), the build step is
   `node --check src/<file>.js` for every new or changed source file. Afterwards:

```text
node tools/build.mjs
```

   The build must exit 0. A size warning (above 1.5 MB) is recorded in the LEDGER; a size
   failure (above 2.5 MB) blocks the section until resolved.

6. Run the self-test groups named in the T section's Verification. Until `tools/selftest.mjs`
   exists (Phase 01), verification is `node --check` plus opening `src/shell.html` as
   described in the T section. Afterwards, for each named group `<g>`:

```text
node tools/selftest.mjs --group <g>
```

   Every named group must pass. A failing test is fixed before the section is marked done;
   a test that cannot run in this environment (needs a real device, another browser, a
   network) is recorded in STATUS.md with the reason, and the requirement stays Partial.

7. Update STATUS.md: set the status of every R-ID the T section covers (rules in 0.7), update
   the header lines and section 2, add any placeholder or limitation to section 5.
8. Update the LEDGER: at minimum rewrite the `RESUME:` line of the current entry to name the
   next T section; add decisions and assumptions made during the section.

Step 5. At each phase gate (after the last T section of a phase):

1. Run the full regression suite and, when Part 11 says so for the phase, the performance
   scenarios:

```text
node tools/build.mjs
node tools/selftest.mjs --all
node tools/perf.mjs
```

   `--all` must pass completely (B 1.4: preserve all previously accepted functionality). A
   regression found here is fixed before the gate commit.
2. Re-read the 0.5 checklist and tick every box in the LEDGER entry; walk Appendix C; re-read
   the Part 13 risk register and update the status of risks the phase retires (13.3).
3. Write the full LEDGER entry for the phase using the Appendix D entry format and the phase
   gate checklist, ending with `RESUME: T<next phase>.01`.
4. Update STATUS.md sections 1 to 7 and the header.
5. Commit code and documents together, one commit per gate, message in plain words:

```text
cd <repository root>
git add -A -- "Finger Lickin Music" .gitignore
git commit -m "Finger Lickin Music: Phase 01 - application shell, build tool, self-test runner"
```

   Replace the phase number and description. Documents-only commits (a ledger checkpoint
   before a pause, a plan patch) use the prefix `Finger Lickin Music docs: `.
6. Never push. Pushing happens only when the owner says so for that job
   (`.claude/project-profile.md`). Record "push pending owner approval" in the LEDGER
   "Owner actions" section.

Step 6. When context runs low. Triggers: a harness warning about context, a compaction
notice, or the session noticing it cannot recall a Part 4 or Part 5 definition without
re-reading. Then, in this order and nothing else:

1. Finish only the verification of the current T section (do not start another).
2. Write the LEDGER entry with the `RESUME:` line naming the next T section (or the current
   one, if its verification did not pass, with the failing test names).
3. Update STATUS.md header lines.
4. Commit everything so no work is lost. If the commit is not at a phase gate, mark it:

```text
git add -A -- "Finger Lickin Music" .gitignore
git commit -m "Finger Lickin Music: WIP T05.03 (paused, not a phase gate)"
```

5. Stop. Do not push.

Step 7. Resuming in a fresh session:

1. Read Part 0 completely, then the top LEDGER entry, then STATUS.md.
2. Complete the 0.3 reading order (Parts 1-5, 9, 10) before touching code.
3. Rebuild and run the full suite to confirm the recorded state:

```text
cd "Finger Lickin Music"
node tools/build.mjs
node tools/selftest.mjs --all
```

   If the result differs from the LEDGER, fix or record the difference first.
4. Continue at the T section named by `RESUME:`.

Step 8. Finishing. Phase 16 produces the final `FingerLickinMusic.html`, `docs/COMPATIBILITY.md`
(Part 8.7, written in Phase 12 and finalized here), `docs/FINAL-REPORT.md` (Part 14), the
final STATUS.md, and the Part 15 Status column update (0.7). The last commit is
`Finger Lickin Music: Phase 16 - packaging and final delivery`. The LEDGER's final entry ends
with `RESUME: none (delivered)` and lists the owner actions that remain (push, merge, device
tests the environment could not run, licence choice per Part 10.3).

### 0.5 Implementation discipline checklist

The implementing session re-reads this list at the start of every phase and ticks each box
in the phase-gate LEDGER entry. A box that cannot be ticked blocks the gate until it can, or
the reason is recorded in STATUS.md with the affected requirements.

From B 1.4:

- [ ] The T sections of Part 11 are followed in dependency order; no T section starts before
      the sections it depends on are done.
- [ ] Traceability is maintained: every T section names its R-IDs, every test is registered
      in its self-test group, and STATUS.md is updated after every T section.
- [ ] The smallest independently testable subsystem is implemented first (within a phase,
      modules in M-number order; within a module, the public API before the screens).
- [ ] Each subsystem is validated (its self-test group passes) before the next is integrated.
- [ ] Previously accepted functionality is preserved when shared systems change:
      `node tools/selftest.mjs --all` passes at every phase gate and any regression is fixed
      before the gate commit.
- [ ] STATUS.md is the continuously updated list of Implemented, Partial, Blocked,
      Unimplemented and Deferred requirements.
- [ ] No feature is reported complete merely because its UI exists; Implemented requires the
      tests named in Part 15 to pass.
- [ ] No placeholder behavior stands in for a required functional system without the
      limitation being documented in STATUS.md section 5 and disclosed in the UI where the
      user meets it.
- [ ] No claim of file-format compatibility, multiplayer synchronization, offline operation
      or performance targets is made without recorded verification (FT, IT, XT, PT evidence
      named in the LEDGER).
- [ ] A requirement that conflicts with the single-file constraint is recorded as a conflict
      with the smallest acceptable exception before proceeding (LEDGER "Decisions"; the
      exceptions already adopted are in Part 2.18).

From E 10, the fifteen prohibited mistakes, as guards:

- [ ] No single global state object: each module keeps its state behind its own namespace,
      and modules communicate only through public APIs and the event bus (Part 4.6).
- [ ] Rendering time is never musical time: musical position comes from
      `Transport.positionAt(audioCtx.currentTime)`, never from frame counts (ADR-05).
- [ ] MIDI is never treated as audio: MIDI events drive `FLM.Instruments`; audio files become
      audio tracks only and never note data (ADR-06).
- [ ] No instrument is treated as monophonic: polyphony is preserved in the model, the
      synthesizer, the charts and the visualization.
- [ ] No generic animation for every instrument: per-instrument controllers in M-20 drive the
      gestures; abstract visualizers cover the rest.
- [ ] Four buttons are never assumed to represent every arrangement without loss: the
      `ChartGenerator` reports omitted source events and the source is never deleted.
- [ ] Browser storage is never the only backup: Export is the real backup and every
      "Save failed" dialog offers it (ADR-08).
- [ ] The timeline protocol (Part 5.16, M-24 clock sync) is defined before any multiplayer
      code is written, and Phase 13 implements that protocol, not a new one.
- [ ] Not all assets load at startup: instrument patches compile on first use, content expands
      lazily, progress is reported only for measurable steps (Part 9.4).
- [ ] No dependency without a packaging strategy: zero runtime dependencies (ADR-02); the
      shipped file works from `file://` with no network.
- [ ] No format support claimed from one sample: every claim rests on the corpus of Part 8.9
      and its FT tests.
- [ ] UI completion is never feature completion: every feature has functional tests.
- [ ] Every mode transition cleans up: `FLM.Modes.assertClean()` reports zero leaks after
      every leave (Part 4.7).
- [ ] Fidelity never degrades silently: tier changes, synthesized (not sampled) instruments,
      fallbacks and unsupported features are visible in the UI and documented.
- [ ] No subsystem is left untested until the end: each T section ends with its named tests
      passing.

Added by this plan:

- [ ] Every placeholder or limitation is documented in STATUS.md section 5 with the exact UI
      text that discloses it.
- [ ] Nothing is described as done, verified, tested or measured without a recorded run: the
      LEDGER names the command and its result.
- [ ] Every assumption is recorded in the LEDGER "Assumptions" section (0.6).
- [ ] The LEDGER `RESUME:` line is current before any pause.
- [ ] Only the names fixed in Parts 4 and 5 are used for modules, namespaces, types, fields,
      events, screens, transport states and modes; no synonyms.
- [ ] New files are UTF-8 with BOM, LF endings, ASCII content (ADR-09; 0.9).

### 0.6 Autonomy and assumptions

- Authorization. The owner has explicitly authorized autonomous execution, so the B 1.3
  autonomous path applies: the implementing session does not wait for approval of the
  planning artifacts (they are this document). Its first act is the 0.3 reading, during which
  it validates the plan against the specification and records the outcome in the first LEDGER
  entry (0.4 step 3).
- Assumptions register. Every assumption the session makes, about the environment, a browser
  behavior, a spec reading, or a missing detail, is written to the LEDGER "Assumptions"
  section as one line containing: the assumption, why it was needed, how it will be verified,
  and its state (open, confirmed, refuted). A refuted assumption triggers a LEDGER
  "Decisions" line stating what changed.
- No omission because of difficulty. If a requirement cannot be completed, its STATUS.md
  status becomes Blocked with the reason and what would unblock it. The session never
  relabels a requirement Deferred on its own; Deferred is reserved for the items Part 1.5
  lists and for new deferrals the owner approves, each recorded in the LEDGER.
- Single-file conflicts. When a requirement conflicts with the single-file constraint, the
  session records the conflict and the smallest acceptable exception in the LEDGER
  "Decisions" section and STATUS.md section 5, and discloses it on SCR-About through the
  Part 7.11 text catalog (B 1.4 last bullet, B 5.4). The exceptions already adopted are in
  Part 2.18: manual-signaling WebRTC, the optional public STUN server, the optional relay
  server, and Web MIDI only in secure contexts.
- Open questions. Only OQ-1, OQ-2 and OQ-3 (Part 2.19) remain open, each with its fallback
  already decided. The session selects the fallback when the corresponding test fails and
  records the selection in the LEDGER; it does not reopen any other decision.
- Owner actions. The session cannot push, merge, run tests on physical devices or in Firefox,
  Safari, iOS or Android, or choose the game's licence (Part 10.3). It lists each such item
  in the LEDGER "Owner actions" section and in the final report (Part 14) and never presents
  the missing result as obtained.

### 0.7 Status tracking

`docs/STATUS.md` is the live list demanded by B 1.4 ("a continuously updated list of
implemented, partially implemented, blocked, and unimplemented requirements"). It is updated
after every T section (0.4 step 4.7) and at every phase gate. Its exact structure:

```text
# Finger Lickin Music - STATUS

Plan version: 1.0.0
Updated: <YYYY-MM-DD> (UTC date of the last change to this file)
Current phase: Phase <NN>
Last completed T section: <Tpp.nn or none>
Build: <FingerLickinMusic.html size in bytes, or "not built">
Self-test (--all): <passed>/<total> on <YYYY-MM-DD>, or "not run"
Live and device tests (LT, XT): <count run>/<count defined>, or "not run"

## 1. Counts per specification part

| Part | Rows | Implemented | Partial | Blocked | Unimplemented | Deferred |
|---|---|---|---|---|---|---|
| B (FLM-1.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| E (FLM-1.1.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| I (FLM-1.2.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| P (FLM-1.3.0) | <n> | <n> | <n> | <n> | <n> | <n> |
| Total | <n> | <n> | <n> | <n> | <n> | <n> |

## 2. Phase gates

| Phase | T sections done / total | Gate commit | Gate date | --all result |
|---|---|---|---|---|
| Phase 00 | satisfied by plan 1.0.0 | n/a | 2026-10-25 | n/a |
| Phase 01 | <d> / <t> | <short hash or -> | <date or -> | <passed/total or -> |
| Phase 02 to Phase 16 | one row each with the same five columns | - | - | - |

## 3. Not Implemented, listed individually

| R-ID | Status | Phase | Reason (one line) | Disclosure (screen, doc, or n/a) |
|---|---|---|---|---|

## 4. Not yet reached, summarized per phase

| Phase | Unimplemented rows | Deferred rows |
|---|---|---|

## 5. Placeholders and limitations

| Module or screen | Limitation | Spec ref | Disclosure (exact UI text or document) | Affected R-IDs |
|---|---|---|---|---|

## 6. Known defects

| Defect | Severity | Found in T section | Regression test | State |
|---|---|---|---|---|

## 7. Measurements recorded

| Budget (Part 9.1 row) | Value or "not measured" | Tool and scenario | Date |
|---|---|---|---|
```

Rules:

1. Rows per part equals the row count of the matching Part 15 subsection (15.1 for B, 15.2
   for E, 15.3 for I, 15.4 for P). The five status columns sum to Rows.
2. Section 3 lists individually every requirement that is not Implemented and whose Phase
   has started, plus every Partial, Blocked and Deferred requirement regardless of phase.
   Section 4 summarizes requirements of phases not yet started, so the file stays readable
   while most of the matrix is untouched. A requirement moves from section 4 to section 3
   when its phase starts.
3. Status transitions. Unimplemented -> Partial when code for the requirement exists but not
   every test named in its Part 15 Tests column passes in the latest `--all` run, or when a
   named test cannot run in this environment (reason "awaiting owner device test").
   Partial -> Implemented when every named test passes in the latest `--all` run, and for
   P0 and P1 the `AT-<R-ID>` acceptance test passes. Any status -> Blocked when work cannot
   proceed; the reason names the blocker and what unblocks it. Deferred only as 0.6 allows.
   Implemented -> Partial again if a later `--all` run fails one of its tests (recorded in
   section 6 as a defect).
4. Section 5 is the complete list of placeholders and limitations (B 1.4, E 10 item 14). Each
   row gives the exact disclosure text or names the document that discloses it; "none" is
   not an acceptable disclosure for a limitation the user can meet.
5. Section 6 defects carry severity Critical, High, Medium or Low (Part 13.2 rules) and name
   the regression test added when fixed (I 17 last rule); state is open or fixed.
6. Section 7 holds every Part 9.1 budget with its measured value or "not measured"; values
   measured under software GL in the headless environment are marked "(software GL)".
7. Phase 16 pass: the Part 15 matrix Status column is updated by hand from STATUS.md, row by
   row; afterwards the counts in STATUS.md section 1 must equal the counts of the Part 15
   Status column per part, and the LEDGER final entry records both sets of counts.
8. STATUS.md never says "done" for a phase whose gate commit does not exist.

### 0.8 Definition of completion

The project is complete only when all of the following hold (B 1.5):

1. The final artifact `FingerLickinMusic.html` has been tested against the acceptance
   criteria of B 26 through the Part 12 acceptance tests: every P0 and P1 requirement has its
   `AT-<R-ID>` test and that test passes (B 25.7).
2. Its supported file formats and limitations are documented in `docs/COMPATIBILITY.md`
   (Part 8.7) and on SCR-About, with Supported, Partial, Conversion or Unsupported for every
   format and version (B 3.6, I 6.4).
3. Its desktop and mobile controls work: keyboard, touch, gamepad and optional Web MIDI pass
   their IT tests, and the XT tests the environment allows; the rest are listed as owner
   actions.
4. Its core gameplay systems operate: Quick Play, Instrument Mode, Free Play, Studio, Song
   Library, Import, Dance Mode on the built-in content, verified by IT tests.
5. Its delivery format satisfies the standalone HTML requirement to the extent technically
   possible: one file, zero runtime dependencies, works from `file://`, with the Part 2.18
   exceptions documented (B 5.2 to 5.4).
6. The release-blocking gate in Part 12 section 12.10 (the ten conditions of E 13) has no
   unresolved item.
7. The final report of Part 14 (the fourteen items of B 28) is written to
   `docs/FINAL-REPORT.md` and distinguishes implemented and tested functionality from
   partial functionality, unverified behavior and future work.

A visually convincing mockup, a partial prototype, or a collection of nonfunctional screens
is not an acceptable final implementation (B 1.5). Lower-priority features may be deferred
only when their status is documented in STATUS.md and `docs/FINAL-REPORT.md` and the core
acceptance criteria remain satisfied (E 13).

### 0.9 Conventions

#### 0.9.1 Identifier forms

| ID form | Meaning | Owning part | Example |
|---|---|---|---|
| `R-B<sec>-<nn>` | Requirement from base spec section `<sec>` | Part 15 (traceability) | `R-B7.3-04` |
| `R-E<sec>-<nn>` | Requirement from edge-case spec | Part 15 | `R-E2.3-01` |
| `R-I<sec>-<nn>` | Requirement from improvements spec | Part 15 | `R-I5.1-02` |
| `R-P<sec>-<nn>` | Requirement from polish checklist | Part 15 | `R-P6.3-05` |
| `M-<nn>` | Source module (fixed list in Part 4) | Part 4 | `M-05` |
| `ADR-<nn>` | Architecture decision (fixed list ADR-01..ADR-16) | Part 2 | `ADR-03` |
| `T<pp>.<nn>` | Table-of-contents section, phase `pp` (00-16) | Part 11 | `T04.03` |
| `UT-<MM>-<nn>` | Unit test owned by module MM | Part 6 (module designs) | `UT-05-07` |
| `IT-<nnn>` | Integration test | Part 12 | `IT-014` |
| `FT-<nnn>` | File-format test | Part 12 | `FT-031` |
| `TT-<nnn>` | Timing test | Part 12 | `TT-006` |
| `PT-<nnn>` | Performance test | Part 12 | `PT-003` |
| `XT-<nnn>` | Cross-device/browser test | Part 12 | `XT-010` |
| `FI-<nnn>` | Fault-injection test | Part 12 | `FI-008` |
| `LT-<nnn>` | Live manual test | Part 12 | `LT-022` |
| `AT-<R-ID>` | Acceptance test for requirement R-ID (deterministic name) | Part 12 lists; anyone may reference | `AT-R-B7.3-04` |
| `RISK-<nn>` | Risk register entry | Part 13 | `RISK-07` |
| `SCR-<name>` | UI screen | Part 7 | `SCR-MainMenu` |
| `DLG-<name>` | Dialog | Part 7 | `DLG-SaveFailed` |
| `EVT-<name>` | Event bus topic | Part 4 | `EVT-transport.state` |

An ID is defined in exactly one part (the owning part) and referenced anywhere. Requirement
rows are numbered `-01, -02, ...` within the spec's own section number by walking the spec in
order; every bullet, numbered item, table row or sentence that states an obligation is one
row (Part 15.0 explains the columns). Unit tests are defined inline in Part 6 and compiled
into Part 12; `AT-<R-ID>` exists for every P0 and P1 requirement.

#### 0.9.2 Status vocabulary

Only these five words, capitalized, describe a requirement's state:

| Status | Meaning |
|---|---|
| Implemented | Code exists and every test named for the requirement in Part 15 passes in the latest full run; for P0 and P1 the acceptance test passes. |
| Partial | Code exists but some named test does not pass or cannot run in the environment; the reason is recorded. |
| Blocked | Work cannot proceed; the blocker and what unblocks it are recorded. |
| Unimplemented | No code yet. The state of every requirement at plan version 1.0.0 unless Deferred. |
| Deferred | Intentionally not built in v1 with its rules documented; only the items Part 1.5 lists or the owner approves. |

#### 0.9.3 Compatibility vocabulary

Only these four words describe how a file format or feature is handled:

| Word | Meaning |
|---|---|
| Supported | The format or version imports with the features listed as preserved in the Part 8 tables and the matrix in `docs/COMPATIBILITY.md`, verified by FT tests on the corpus. |
| Partial | The format imports, but listed features are lost or approximated; each loss produces a warning code (Part 8.8) and is listed in the matrix. |
| Conversion | The input is imported through a conversion path into a different representation (audio files become audio tracks; notation becomes events); the conversion and its losses are stated. |
| Unsupported | The format or version is identified by the format identifier and refused with a message naming it (for example GP6/GP7 `.gpx`/`.gp`, SoundFont `.sf2`). |

#### 0.9.4 Priorities (B 4.1)

| Priority | Meaning |
|---|---|
| P0 | Required for a minimally complete product (B 4.2 list). |
| P1 | Required for the full intended product (B 4.3 list). |
| P2 | Advanced features or enhancements that may follow the stable core (B 4.4 list). |

Priorities define sequencing, not permission to omit requested functionality silently.
Part 15 assigns a priority to every row; where the spec does not assign one, Part 15.0 states
the derivation rule used.

#### 0.9.5 Writing and encoding rules for new files (ADR-09)

- Every new text file is UTF-8 with a leading BOM and LF line endings. The repository's
  `.gitattributes` (`* text=auto`) normalizes endings in the repository; the working copy on
  Linux is LF. The build strips per-file BOMs and emits one leading BOM in the output files.
- Content is plain ASCII: no em dashes, en dashes, curly quotes, arrows, bullets other than
  `-`, or box-drawing characters. Use `-` for dashes, `->` for arrows, `"` for quotes.
- JS and HTML source: 2-space indent, `'use strict'` in every module IIFE, semicolons always,
  no transpiling, ES2020 syntax at most (optional chaining and nullish coalescing allowed; no
  decorators, no top-level await, no ES modules in the browser bundle). Node tools in
  `tools/` and `server/` are `.mjs` ES modules using Node built-ins only.
- Source files are `src/shell.html` plus `src/NN-name.js`; load order is file-name order; a
  module references only lower-numbered modules plus the event bus (Part 4.2). Each module
  attaches exactly one namespace object to `FLM` and nothing else to `window`.
- Markdown documents (`docs/*.md`, `README.md`): GitHub tables with a header row and a
  `|---|` separator, every row with the header's column count, no `|` inside cells.
- Commit messages: `Finger Lickin Music: <plain words>` for code (with or without docs),
  `Finger Lickin Music docs: <plain words>` for documents-only commits. Never push without
  the owner's go.

#### 0.9.6 Terminology rule

Use the names in Parts 4 and 5 exactly: module IDs and files (`M-05`, `src/05-audio.js`),
namespaces (`FLM.Audio`), types and fields (`Song`, `Track`, `NoteEvent`, `TempoMap`,
`Chart`, `ChartNote`, `DanceChart`, `DanceStep`, `InputEvent`, `Calibration`,
`CharacterConfig`, `Project`, `RecordingTake`, `NetMessage`), transport states
(`stopped | countin | playing | paused | recording`), mode names (`menu | quickplay |
instrument | freeplay | studio | library | import | dance | multiplayer | customize |
settings | help | about | diagnostics | tutorial | results`), mapping profiles A to F
(B 8.3), difficulty names (instrument charts `beginner, intermediate, advanced, expert`;
dance charts `easy, normal, hard`), judgments (`perfect | great | good | miss`), screen IDs
(`SCR-*`, `DLG-*`), event topics (`EVT-*`), quality tiers (High, Balanced, Low, Abstract),
and the Standalone edition and Online edition (Part 1.4). Do not invent synonyms in code,
documents, UI text or commit messages. Appendix B defines every term of art.

### 0.10 Environment assumptions for the implementing session

| Capability | Expected | Check | If absent |
|---|---|---|---|
| Node | Version 22 or newer (`node --version`; v22.22.0 observed when this plan was written) | `node --version` | Stop and report; no tool in this plan runs on older Node and no install is permitted. |
| Playwright with Chromium | Preinstalled; `require('playwright')` resolves and `chromium.launch()` works | `node -e "require('playwright')"` | Fallback 1: `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })` (on the planning machine this path is a symlink to `/opt/pw-browsers/chromium-<build>/chrome-linux64/chrome`). Fallback 2: start Chromium with `--remote-debugging-port=9222` and attach with `chromium.connectOverCDP('http://127.0.0.1:9222')` (Part 3.4). If none works, self-tests run by opening `FingerLickinMusic.test.html` manually and STATUS.md records "self-test: not run headless". |
| Headless GL | SwiftShader through ANGLE (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`) | Part 3.4 launch flags | WebGL tests still run on software GL; tier selection, frame rate and memory numbers are "(software GL)" in STATUS.md section 7, never presented as device results. |
| Network | None required; CDNs are blocked; no fetch at build, test or run time | n/a | Nothing to do; any tool that needs the network is a plan violation (ADR-02). The relay server for IT tests runs locally on `127.0.0.1` only. |
| npm | No installs; no `package.json`, no `node_modules/` inside `Finger Lickin Music/` | `ls "Finger Lickin Music"` shows neither | Nothing to install; tools use Node built-ins and the preinstalled Playwright resolved as Part 3.4 specifies. |
| Other browsers and devices | Firefox, Safari, iOS Safari, Android Chrome and physical devices are not available to the session | n/a | Their XT and LT tests and the Part 9.2 device matrix rows stay "not measured"; the requirements they verify stay Partial with reason "awaiting owner device test"; no compatibility claim for them is published (Part 1.6). |
| Operating system and shell | Linux, case-sensitive paths, bash; the game folder name contains spaces | n/a | Always quote paths containing `Finger Lickin Music`. |
| Git | Available; working tree clean at start; `.gitattributes` is `* text=auto` | `git status --porcelain` | Stop if the tree is dirty; the session never discards someone else's changes. |
| Disk and time | The build output is under 2.5 MB; a full `--all` self-test run finishes within the timeout policy of Part 3.4 | `node tools/build.mjs` exit code | A timeout is a failing test, recorded as such; the session does not raise timeouts to make a run pass. |
