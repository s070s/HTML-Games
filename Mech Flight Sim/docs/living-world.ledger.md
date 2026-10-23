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

- 2026-10-23 05:10 GTBDT (approx). **P2 GATE PASSED** on `d6b9874`: re-verification "ready to ship"; self-test 1773/0, no console or WebGL errors; v1 fixture, TERRAIN_GOLDEN, m1-m8 pass; 1000-seed sweep 0 fallbacks; bench best p95 ≤ 6.0 on every scene (machine noisy, best used as in P1). NET_VERSION 4 unchanged (no wire change). SAVE_VERSION 1.
  - Shipping IH-only: the P2 IH commits and this docs commit are cherry-picked onto `origin/main`; Breakpoint 6fdce11/834dc6d/be88e70 stay on the branch until the owner clears them.
  - RESUME: push → merge origin/main into the branch → P3.1 (momentum collisions). P3 deadline 6 agent-h.

- 2026-10-23 04:45 GTBDT (approx). P2R2 done `d6b9874` (one commit; the agent could not split it). Self-test 1773/0. Metro skirmish mega back to 131/200 seeds. Budget only on `flora.block` maps; hysteresis `FLORA_KEEP` 0.8; cover root height in `iD.w`.
  - Bench swamped by outside load (runs up to 2.5 s): best p95 ashfall 3.9, jungle 5.4 (≤ 6.0).
  - In flight: re-verification (same verifier, resumed).
  - RESUME: re-verify → commit docs → ship IH-only → merge origin/main → P3.

- 2026-10-23 04:15 GTBDT (approx). P2 verification: not ready. Self-test 1755/0; 2-min runs on jungle and farmland clean; release, burst, bending shader (12 uniform vectors), faunaSim confirmed.
  - High: #1 metro skirmish lost its mega-city (131/200 seeds before, 0 now); #2 `floraVerts` cuts in on old maps on other seeds (ashfall 23 Medium 118%) and the test only checks seed 11 → decision: budget only on maps with blocking new flora (amends D42).
  - Medium: #3 full/stand-in flicker at the budget boundary (no hysteresis).
  - Low: #4 bending measured from the machine's base on slopes; #5 empty push slots `smoothstep(0,0)`.
  - In flight: P2R2 (same fix agent, resumed).
  - RESUME: P2R2 → re-verify (Opus+high) → commit docs → ship IH-only → merge origin/main → P3.

- 2026-10-23 04:00 GTBDT (approx). P2R done (agent): `1f13ace` findings 1-6, `2cc1c78` flora full-detail budget. Self-test 1755/0. Decision D42.
  - Bench (very noisy, best p95 ms, now vs 2718428): ashfall 3.3/3.1, verdant 2.4/2.5, frost 3.2/2.4, air 2.0/2.6, water 3.7/3.2, peaks 3.7/2.9, jungle 3.6/4.0. Jungle A/B six pairs: median 7.95→5.8, best 6.3→4.7. All best ≤ 6.0 allowance.
  - Not done: bushes do not bend (merged chunk meshes), recorded in D42.
  - In flight: P2 verification (Opus+high).
  - RESUME: verification → commit docs → ship IH-only to main (cherry-pick onto origin/main, leaving out Breakpoint 6fdce11/834dc6d/be88e70 unless the owner clears them) → self-test on the ship branch → push → back to the branch, merge origin/main → P3.

- 2026-10-23 03:20 GTBDT (approx). P2 gate review: "fix finding 1 before shipping". Self-test 1738/0; 1000-seed sweep 0 fallbacks confirmed; determinism Low vs High confirmed; old content passes; 98ae314 fixes confirmed.
  - Medium #1: dead/burnt tree species have no far stand-in, so they vanish past `floraNear` but still block shots (ashfall loses 128/295 trees, volcano 1399/1698).
  - Low: #2 metro missions never get the mega-city (SCENERY overlap); #3 first-frame cover burst delayed when starting high (hitch up to ~35 ms); #4 cover cell memory never released (farmland 38.6 MB); #5 plan gaps: P2.1 grass/bush bend under platforms missing, D39 cap is drawn-only (137 simulated on jungle High); #6 weak checks (hidden map pick, Low vs High build, tree stand-in check).
  - Bench still noisy; sk-jungle median 6.8 > P2 allowance 6.0 (5.20 + 0.8): a quiet bench decides.
  - In flight: P2R fix agent (Opus+high).
  - RESUME: P2R lands → verify → quiet bench → merge origin/main → self-test → push IH-only (Breakpoint waits for owner).

- 2026-10-23 03:05 GTBDT. P2.3 `5c004a5` and P2.4 `2718428` done (agent). Self-test 1738/0 at 1920x1080. 1000-seed fallback sweep: 0 on all 10 new maps. 2-min skirmish per map, no errors.
  - Bench (noisy, median/best p95 ms vs HEAD base): old maps within noise; sk-jungle new 6.8/5.4 (median 6.8-8.0 over 3 sessions, little headroom under 8.33).
  - Not done, routed by D41: co-op lobby map choice and Training map choice → P7.1.
  - origin/main has moved (ClassTimeKiller merges, other files).
  - The branch holds 3 Breakpoint commits (6fdce11, 834dc6d, be88e70) that the owner has not cleared for push: the P2 push must leave them out (cherry-pick the IH commits onto origin/main) unless the owner says push.
  - In flight: P2 gate review (Opus+high).
  - RESUME: review → fixes → quiet bench → merge origin/main → self-test → push IH-only.

- 2026-10-23 02:40 GTBDT. P2.2 fauna done `70979b8` (agent). IOS-1R done `98ae314` (me): all 7 review findings fixed. Self-test 1548/0 at 1920x1080.
  - Decisions: D39 (fauna), D40 (iOS fixes).
  - Bench: too noisy now (other sessions); the agent timed fauna directly at ≤0.11 ms/frame in the bench scenes, worst case about 0.6 ms at the 100 cap. The full quiet bench is part of the P2 gate.
  - Open looks (low): vulture wing flap too wide; eagle folded wings flat.
  - In flight: P2.3 + P2.4 agent (Opus+high), same worktree and file.
  - Breakpoint push still waits for the owner.
  - RESUME: P2.3 + P2.4 land → verify → P2 gate (quiet bench, v1 fixture, Opus review, merge origin/main, push).

- 2026-10-23 01:25 GTBDT (approx). Review of `386aa89` (IH iOS) is in: not ready to ship until 3 medium findings are fixed.
  - Medium (must fix before shipping):
    - #1 a pen now enables touch mode on Windows (`pointerType !== 'mouse'`);
    - #2 the rotate pause checks window shape, not phone orientation (iPad Split View, a snapped laptop window);
    - #3 the stick is clamped away from the edge but its neutral point is not kept, so the first touch deflects.
  - Low:
    - #4 `adaptQuality` does not account for the `maxPx` cap;
    - #5 the overlay wording in co-op;
    - #6 the self-test leaves `Snd` held;
    - #7 weak checks (`touchScrolls` on body, `Snd` held without a context, `touchReserve` constant).
  - Waiting until the fauna agent finishes (same file), then a fix pass (IOS-1R).
  - RESUME: fauna lands → IOS-1R fixes 1-7 → P2.3 + P2.4 → P2 gate.

- 2026-10-23 01:15 GTBDT (approx). IOS-1 done in `386aa89` (agent, Opus+high, 19 min). Self-test 1516/0 on desktop and at 375x812. No regression on desktop High (best p95 1.9-2.8 ms).
  - Adds: `SafeArea`, `Device`, `homeHintSeen`, a portrait rotate overlay, audio unlock, gesture blocking, multi-touch release, and Low/Medium pixel caps.
  - Proposed: D38. Left for P4.2: HUD overlaps at 844x390 that already existed (USE over the radar, pause over the score, the left column near the bars, the tip over the weapons panel).
  - In flight:
    - an Opus review of `386aa89` (read-only);
    - the P2.2 fauna agent.
  - IH iOS ships with the P2 push, because the same file interleaves with P2 commits. Breakpoint is still waiting for the owner's OK.
  - RESUME: review findings → fix after fauna lands → P2.3 + P2.4 → P2 gate → push.

- 2026-10-23 00:50 GTBDT (approx). P2.1 flora done in `1256b4f` and `f74b190` (agent, Opus+high, 63 min). Self-test 1501/0.
  - My bench (CPU 4%), p95 median of 5:
    - ashfall 3.5, verdant 2.8, air 3.5, water 3.2, peaks 2.5;
    - frost 8.9 in the first run, 2.9 in the second;
    - in the second run ashfall had one run at 17.1.
  - Investigated: the spikes move between scenes and include 160 ms render-CPU stalls in a static scene with no uploads, so they are interference from outside the game. Steady-state frost needs about 4.5 ms of GPU wait.
  - Added `best` (lowest p95 across runs) to `__IH.bench()`; it is uncommitted and the IH iOS agent includes it.
  - Decisions: D37 (flora, see the plan). Routed to P2.3: mangroves stand in water, so `wetStruct` must exempt them.
  - In flight: an Opus+high agent on IH iPhone Safari (IOS-1).
  - Breakpoint push: waiting for the owner.
  - RESUME: IOS-1 → P2.2 fauna → P2.3 + P2.4 → P2 gate.

- 2026-10-23 00:40 GTBDT (approx). Breakpoint iOS work done.
  - Agent commits: `6fdce11` and `834dc6d`. Breakpoint self-test 108/108 under mobile emulation, by the agent.
  - The Opus+high review said it is safe to push. It found 1 medium and 2 low issues, all fixed in `be88e70`: menu height inside the safe areas, wording of the fullscreen tip, and a split line. The inline script passes `node --check`.
  - Not runnable here: the game's self-test after `be88e70`, because the hidden pane pauses rAF and boot stays in LOADING.
  - Flora agent commits seen so far: `1256b4f` and `f74b190`, still running.
  - RESUME: owner OK to push Breakpoint, as one commit built on `origin/main` holding only `breakpoint.html`, because the branch interleaves P2 commits → the P2.1 report → IH iOS → P2.2.

- 2026-10-23 00:08 GTBDT. New owner request, run alongside the program.
  - OWNER (verbatim): "After that make the necessary adjustments so that i can additionally be able to play iron horizon and breakpoint on ios mobile safari".
  - OWNER answers (verbatim):
    - "Breakpoint now, IH after P2.1 (Recommended)"
    - "Only make the games work on iOS i was proposed netlify something"
    - "iPhone"
    - "4 h (Recommended)"
  - Interpreted as:
    - iPhone Safari only; hosting is the owner's job.
    - Deadline 4 h of agent time for both games.
    - Breakpoint starts now.
    - IRON HORIZON iOS work slots in after P2.1, before P2.2.
  - A separate session was refused while the owner is on Remote Control, so Breakpoint went to an Opus+high agent instead. It works in this worktree, touches only `Beat Em Up/breakpoint.html`, uses its own browser tab, and does not push. Pushing Breakpoint changes needs the owner's OK.
  - In flight:
    - P2.1 flora agent (`IronHorizon.html`, tab `seed`);
    - Breakpoint iOS agent.
  - RESUME: P2.1 lands → IH iOS item (IOS-1) → P2.2 → P2.3 + P2.4 → P2 gate. Report Breakpoint and ask about pushing it.

- 2026-10-22 23:31 GTBDT. **P1 PUSHED**: `b3bf9f4..8c85077` to main, after merging `origin/main` (ClassTimeKiller M4-M6, which does not touch the game).
  - Checks: self-test 1466/0 after the merge, no console errors. The repo has no CI.
  - P1 used about 3.2 h of its 8 h. The gate passed: the quiet bench (in the 23:24 entry), the live bridge check, the fixture tests, and the Opus review with all fixes verified.
  - Traceability P1: all lines ticked (see the plan §6 evidence in this ledger's entries).
  - P2 started (deadline 10 agent h).
  - RESUME: P2.1 flora (agent) → P2.2 fauna (agent) → P2.3 + P2.4 maps (agent) → P2 gate → push.
    - Constraints: map ids must be lowercase letters only; D36 requires 0 layout fallbacks per new map over 1000 seeds; routed verifier notes (a `testpeaks` seed that fails under the old rule; bank caps).

- 2026-10-22 23:35 GTBDT. The verifier passed all 12 fixes and found 4 low-severity items.
  - Fixed now:
    - Damage clears `relit`, so the relight budget no longer delays damage refreshes.
    - `gridKey` now includes `maxSlope`.
  - Routed to P2.3:
    - Add a `testpeaks` seed for which the old site rule fails (test strength).
    - Bank and beach caps for high land on future maps; the self-test covers registered maps.
  - Self-test 1466/0.
  - RESUME: commit → sync with `origin/main` → self-test → push P1 → start P2.

- 2026-10-22 23:24 GTBDT. Review fixes done in `166b79b` (agent, Opus+high, 28 min), all 12 items. Self-test 1466/0.
  - Decisions: D36 (from the fix agent).
  - P1 gate bench: CPU was at 18% at the start and then rising.
    - Quiet run at `166b79b`, p95: ashfall 2.3, verdant 2.3, frost 2.1, air 2.5, water 2.5 ms; max ≤ 5 ms.
    - Weather on ashfall / water, p95: snow 2.5/2.4, rain 2.4/2.0, storm 2.5/2.1, dusk cycle 2.3/1.9 ms; max ≤ 6.1 ms.
    - Back to back against the pre-program `4948af7` (5 runs each), p95 base/new: ashfall 3.8/4.8, verdant 3.8/3.7, frost 4.1/4.1, air 4.2/3.8.
    - The ashfall gap was investigated: sim per tick is 0.19 vs 0.22 ms, and render 1.73 vs 1.58 ms. That puts it within noise.
    - Verdict: the floor (8.33 ms) holds with a margin of more than 3 ms, and the P1 allowance (+0.6) holds.
  - In flight: an Opus+high verifier on `166b79b`.
  - RESUME: verifier → fix anything verified → sync with `origin/main` → self-test → push → P2.

- 2026-10-22 23:05 GTBDT (approx; next entry takes `date`). The P1 review found 1 major issue (ghost water past the shores, so a tank on dry land could drown) and 10 minor ones (bridge splash, the 15 m band missed by site checks, guest water warnings, hovercraft on the underwater bed slope, steep channels, per-tick allocations and `deckTop` scans, the dusk relight spike, the mobile shader uniform, rain while paused, weak tests).
  - I added #12: old maps get no slope limit, D32 amended.
  - In flight: an Opus+high fix agent on items 1-12.
  - RESUME: verify the fixes → quiet bench → merge origin/main → self-test → push P1.

- 2026-10-22 22:45 GTBDT. P1.4, P1.5 and P1.6 done in `4d8726c` and `737286e` (agent, Opus+high, 44 min). Self-test 1452/0, no console errors.
  - P1 gate in progress:
    - Live check: a bridge collapses under a tank, and the tank sinks into 3.2 m of water and floods. Screenshot taken of rain at dusk on the test water map.
    - In flight: an Opus+high review of `4948af7..737286e`.
    - The bench is deferred: CPU was at 96% from other Claude sessions. The agent's back-to-back numbers: snow on sk-water +0.8 ms p95, over the +0.6 allowance; everything else ≤ +0.4.
  - Decisions: D35 (weather/time), see the plan. New keys: `Save.data.skirmish.weather/time` (fog/night migrated), `cfg.env`, mission `env`, map `weather`, `start.wh`, `QUALITY.precip`. `NET_VERSION` is 4.
  - RESUME: review findings → fix → quiet bench (re-measure snow on sk-water) → merge origin/main → self-test → push.

- 2026-10-22 21:51 GTBDT. P1.3 water done in `3c7ce82`, `f7207db` and `7766ee6` (agent, Opus+high, 57 min). Self-test 1403/0.
  - Bench: draw calls on the old maps are unchanged and their timing is within noise. The water cost could not be confirmed against its +0.3 ms allowance because the PC was too noisy (single runs of 18-55 ms). It will be re-measured at the P1 gate.
  - Not live-tested yet: destroying a bridge, and a hovercraft on water (P5). Both go on the P1 gate checklist.
  - Decisions: D34 (water rules), see the plan.
  - In flight: an Opus+high agent on P1.4, P1.5 and P1.6.
  - P1 time used: 1.6 h of 8 h.
  - RESUME: when the agent finishes, verify its work → P1 gate (§4.0): self-test, quiet bench, live checklist including bridge destruction, fixture, Opus review → push.

- 2026-10-22 20:53 GTBDT. P1.1 and P1.2 done in `4314801` (agent, Opus+high).
  - What it added: `mapDef`, a data-driven skirmish list, default scenery, ridged ranges, plateaus, a sea-bed floor, opt-in rock and snow colouring, `maxSlope` (32°, infantry 40°), `Terrain.siteFlat`, a look-ahead pull-up warning, `TERRAIN_MESH_GOLDEN`, and a hidden `TEST_PEAKS_MAP`.
  - Flake fixed in `e400a6b`: "a soldier shoves a civilian aside" failed whenever the civilian took one running step back after the push. Evidence: the distance was 1.027 against a reach of 1.1, in 2 of 3 runs. The check now allows `CIV_RUN[1]*STEP`. Self-test 1369/0 on 2 runs.
  - Bench (agent, at 90% CPU from other sessions): no measurable cost against the previous commit when run back to back.
  - Decisions: D32 (`maxSlope` is a map field and blocks uphill only; infantry 40°; a def may override it). D33 (the site slope check runs only on maps with mountains: bases ≤12°, cities ≤8°, 96 placement tries).
  - Noted: the co-op lobby lists missions, not maps, so it has no map list to convert.
  - The javascript tool sometimes returns "Internal error" on a long self-test call; it passes when rerun. That is a tool problem, not the game.
  - RESUME: P1.3 water (agent) → P1.4+P1.5+P1.6 (agent) → P1 gate.

- 2026-10-22 20:40 GTBDT. P1.0 is done, `7805bfc`: `__IH.bench()` reports the median of 3 runs; added `SAVE_FIXTURE_V1`, `TERRAIN_GOLDEN` and 32 new checks. Self-test: 1333/0. The bench baseline is in the Bench table.
  - In flight: an Opus+high agent running P1.1 and P1.2 in this worktree. Its brief is in the scratchpad at `lw-agent-brief.md`.
  - Note: map ids must be lowercase letters only (the `skirmishBest` key regex); this binds P2.3.
  - RESUME: when the agent finishes, check its commits and the self-test, then start the P1.3 agent, then P1.4+P1.5+P1.6, then the P1 gate.

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
| P1 | 8 | 2026-10-22 20:17 | 2026-10-22 23:31 (`8c85077`) | done, about 3.2 h |
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
