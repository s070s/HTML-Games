# IRON HORIZON Living World - ledger

_This file is the only live state of this program. The plan is `living-world.plan.md`; the spec is the owner's pasted "IRON HORIZON — Living World expansion program" prompt, dated 2026-10-22._

- Entries are newest first, and every entry ends with a RESUME line.
- Statuses: todo, in-progress, in-review, done (SHAs), merged->OWNER_ID, dropped (D-row), stale, wrong (evidence), blocked (owner).
- Timestamps come from `date`, in local time, with the zone stated.

_To resume:_
1. Read the newest entry and its RESUME line.
2. Check it against git with `git log --oneline -10`, `git status --short`, `git worktree list`, and the list of running tasks.
3. Take a usage reading before launching anything.
4. Write an entry with what you found, then continue without asking.

_Hand-off: print a self-contained block in chat (standing rules, state with SHAs, next step) and copy it here._

## Entries

- 2026-10-22 20:17 GTBDT. Plan approved, P1 started (deadline 8 agent h → 2026-10-23 04:17 GTBDT).
  - P1.0 is in progress.
  - Usage: 5h 11% (resets 23:39 GTBDT) / weekly 30%.
  - OWNER (20:1x, verbatim): "Ok" -> interpreted as: the plan is approved as written, so start P1.
  - RESUME: P1.0 → P1.1 → P1.2 → P1.3 → P1.4 → P1.5 → P1.6 → P1 gate → push.
    - Constraints: same as the entry below.

- 2026-10-22 20:01 GTBDT. Program set up. The plan and ledger were written in `Mech Flight Sim/docs/`.
  - Code mapped by 3 read-only research agents covering terrain, maps and environment; platforms, collisions, collapse and AI; and controls, saves and netcode.
  - Owner answers were recorded as D1-D12. Delegated decisions are D13-D31.
  - Baseline bench (synced frame time, High, 1920x1080, hidden pane, emulated viewport), as avg / p95 / max ms: skirmish large ashfall seed 11 = 4.21 / 5.20 / 25.9 (the readPixels-synced run). Earlier `gl.finish` runs gave about 1 ms, so `gl.finish` does not sync in this browser; use readPixels.
  - Self-test at base `4948af7`: 1301 checks, all green, as of the civilians commit `7fa3c3c`.
  - In flight: nothing.
  - Worktree: `.claude/worktrees/living-world`, branch `worktree-living-world` at `4948af7`, with no code changes. `.claude/launch.json` exists in the worktree (port 8766), is untracked, and is never committed.
  - Usage: not read yet; read it before P1 starts.
  - OWNER (19:5x, verbatim answers):
    - "One file (Recommended)"
    - "30 plant species (Recommended)"
    - "30 species, biome mix (Recommended)"
    - "Hangar choice (Recommended)"
    - "Infantry armed, civilian not (Recommended)"
    - "Local scenery (Recommended)"
    - "Plus 1 mission each"
    - "On foot + mechs (Recommended)"
    - "Approve list (Recommended)"
    - "120 fps on High on this pc"
    - "Mech Flight Sim/docs/ (Recommended)"
    - "72 h, per phase (Recommended)"
    - Interpreted as D1-D12. The fps floor is a p95 synced frame of 8.33 ms or less at High and 1080p.
  - OWNER (program prompt): "Work in a new worktree to not get stuck from the other session running alongside this one". Interpreted as: all work goes in `worktree-living-world`, and `origin/main` is merged in with the sync tool before each push.
  - RESUME: wait for the owner to approve the plan. Then P1.0 → P1.1 → P1.2 → P1.3 → P1.4 → P1.5 → P1.6 → P1 gate (§4.0) → push to main.
    - Constraints:
      - No implementation before approval.
      - No AI attribution.
      - Agents set model and effort; review is Opus + high.
      - Never `cd` to the main checkout; never use bare `git stash`.
      - Deadline 72 h of agent time (P1 8 h).

## Usage log

| Local time | 5-hour % | Weekly % | Note (what ran; reset times) |
|---|---|---|---|
| 2026-10-22 20:01 | - | - | not read yet |

## Phases

| Phase | Deadline (agent h) | Started | Pushed | Result |
|---|---|---|---|---|
| P1 | 8 | - | - | todo |
| P2 | 10 | - | - | todo |
| P3 | 6 | - | - | todo |
| P4 | 14 | - | - | todo |
| P5 | 8 | - | - | todo |
| P6 | 12 | - | - | todo |
| P7 | 8 | - | - | todo |
| P8 | 6 | - | - | todo |

## Bench (p95 ms, High 1920x1080, readPixels-synced)

| When | Commit | Scene | avg | p95 | max |
|---|---|---|---|---|---|
| 2026-10-22 19:58 | 4948af7 | skirmish large ashfall s11 (single run, no untimed warm frames) | 4.21 | 5.20 | 25.9 |
| 2026-10-22 20:35 | P1.0 | sk-ashfall (median of 3; `__IH.bench()`) | 3.79 | 4.6 | 7.3 |
| 2026-10-22 20:35 | P1.0 | sk-verdant | 2.59 | 3.0 | 6.5 |
| 2026-10-22 20:35 | P1.0 | sk-frost | 2.99 | 3.4 | 4.5 |
| 2026-10-22 20:35 | P1.0 | air-ashfall | 3.02 | 3.6 | 7.6 |

The program baseline is the 20:35 row set. Single runs vary 2-3x because other programs share the PC, so gates compare medians of 3.

## Held work

| Branch / worktree | Tip SHA | State | How to finish |
|---|---|---|---|
| worktree-living-world | 4948af7 | no changes | start P1 after approval |

## Estimate

72 h of agent time in 8 phases (D12). Points per unit will be measured after P1 and P2.
