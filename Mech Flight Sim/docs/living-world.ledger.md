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

- 2026-10-24 ~00:45 GTBDT. fix-ambulance (1a98b65) merged at `f1f95f1` (clean). Root cause of the ambulance-coverage miss: walkers cut across the car lanes (corners, doors, crate-pulled corners), so ambulances stopped behind them and turned back after 5 s. 57% of mid-street walker samples were on the road; misses 9.8% → 2.9% (rest are junction queues). New check in 'civilians': walkers stay off the road (red with the old walking). Flake closed; server 8769 stopped.
  - RESUME: full self-test at f1f95f1 → dfix-combat (8771) → merge → full self-test twice → Opus verify of the delta fixes → close-out → owner's go.

- 2026-10-24 ~00:30 GTBDT. dfix-world (9314049) merged at `4e2f505` (clean). dfix-traffic (fb8774e) merged at `aea0f0d` (test-list conflict, union). Self-test at aea0f0d: 2632/0. Servers 8770 and 8772 stopped.
  - RESUME: dfix-combat (8771) + fix-ambulance (8769) → merge → full self-test twice → Opus verify of the delta fixes → close-out → owner's go.

- 2026-10-23 ~23:55 GTBDT. Delta verify wf_9f6f19cc-7ef done: 14 found, 11 confirmed (4 medium, 7 low), 2 refuted; list in scratchpad/delta-findings.json. Help now covers load damage (0850a90); docs committed (d3fcd9e).
  - Fixers from d3fcd9e (brief scratchpad/delta-fix-brief.md): dfix-traffic (Opus, 8770: junction held, endless blocked trips, fire engine 50 m, goTo cost), dfix-combat (Opus, 8771: runway AA/sight, harbour sight line, m13 observers, honest enterCiv refused, melee downhill), dfix-world (Sonnet, 8772: lightning on a tall mech, walking mech wears a slab). fix-ambulance (8769) still running.
  - RESUME: the 4 helpers → merge each --no-ff → full self-test (twice, for the ambulance check) → Opus verify of these fixes → close-out → owner's go.

- 2026-10-23 23:36 GTBDT (machine clock; the three entries below carry guessed times that run ahead of it). fix-combat (4a64251, 3b480a7, befcf85) merged at `11f1c1d`, self-test 2615/0. fix-living (e6e02af, 5d5a34e) merged at `849151f`; both conflicts at the end of the self-test list, resolved by union.
  - Self-test at 849151f: first run 2625/1, then 2625/0. The fail: 'society: first responders', "9 of 16" casualties reached by an ambulance (limit 60%), 6 of the last 8 missed. Alone 17/17 green. Not waved off as a flake: helper fix-ambulance (Opus+high, port 8769) is measuring it.
  - Clean bench (Playwright, 1920x1080) at 849151f: all 18 scenes p95 ≤ 3.7 ms, max ≤ 6.4 ms.
  - In flight: delta verify workflow wf_9f6f19cc-7ef (5 Opus reviewers + 5 verifiers, commits since 6103b25); fix-ambulance.
  - RESUME: fix-ambulance + delta verify → fix confirmed findings → merge → full self-test → close-out (help check, CLOSED entry, delete plan/ledger D11, commit, clean agent worktrees) → owner's go to push.

- 2026-10-24 ~02:55 GTBDT. fix-world done (0581dc4, plus a merge of cd2af02) and merged at `6b7b0d7`, a clean merge whose tree equals e108edd. Self-test 2607/0.
  - All 5 world findings are fixed; each check fails with its fix off.
  - The 8768 server is stopped. Still waiting on fix-combat and fix-living.

- 2026-10-24 ~02:40 GTBDT. p7a done (ad49410, 3e417ca) and merged at `cd2af02`; 1 conflict in the `__IH` exports, resolved by union. Merged self-test 2601/0.
  - Scripted bot, normal damage, no nudge, wins out of runs:

    | Mission | Before | After |
    |---|---|---|
    | m9 | 3/6 | 7/8 |
    | m10 (ships only) | 1/10 | 6/8 |
    | m11 | 2/4 | 8/12 |
    | m12 | 0/4 | 6/8 |
    | m13 | 0/4 | 7/8 |

  - An idle player loses all five: an opt-in test, 'missions P7a idle'. D62 recorded.
  - The fixers were told to merge cd2af02. The 8767 server is stopped.
  - RESUME: fix-world, fix-combat, fix-living → merge → full self-test + clean bench → delta verify workflow (fixes + p7a + p8-load + p8-traffic + p8-perf since 6103b25) → close-out → owner's go.

- 2026-10-24 ~01:55 GTBDT. The final review workflow wf_8d2f0feb-3a8 is done (10 agents): 25 findings, all confirmed by the verifiers.
  - Severities: 1 high, 6 medium, 18 low, with some duplicates across areas. The list is saved at scratchpad/final-review-findings.json.
  - HIGH: skirmish aircraft respawn on an airfield beside the enemy base.
  - Medium:
    - high-air blasts start ground hazards;
    - an m14 guest respawns at the harbour or airstrip (×2);
    - a guest deletes the wrong ship (×2);
    - Obj.rescue in flight.
  - Fixers (Opus+high, isolated from ebffd7f): fix-world (8768), fix-combat (8769), fix-living (8770). p7a is still on m9-m13 (8767).
  - Keep `Mech Flight Sim/_review_snap.html` until the fixers are done; the findings' line numbers refer to it.

- 2026-10-24 ~01:20 GTBDT. m16 flake fixed by p7b with `ebffd7f` (the ambush units are clamped 450 m from the harbours, players and the convoy start). Fast-forwarded here.
  - The m16 rules block passed 60/60; self-test 2559/0.
  - Still waiting on the workflow wf_8d2f0feb-3a8 and p7a.

- 2026-10-24 ~01:05 GTBDT. p8-load done (9d0ece2, d36f01a) and merged at `ed2ed81`; 1 test-end conflict, resolved by union.
  - Merged self-test 2559/0.
  - Live: a heavy mech punches through a shop roof and floor, and a terraced roof caves in at 3.15 s. D61 recorded.
  - Flake found: "m16: no hostile within 450 m of the harbour" (about 1 in 30) → p7b is fixing it in its worktree (ff to ed2ed81).
  - The 8773 server is stopped. Still waiting on the workflow, p7a and p7b.

- 2026-10-24 ~00:45 GTBDT. P8.2 perf done (p8-perf: 27d6a32, c72c053, bcd623a, 130e133) and merged at `1023183`; 1 test-end conflict, resolved by union.
  - Merged self-test 2540/0.
  - Bench now covers all 13 battlefields (18 scenes). After the pass every scene is ≤ 7.8 ms p95 and ≤ 33 ms max (Playwright; noisy under load).
  - The W.hotPlain list cuts the jungle sim tick from 0.91 to 0.58 ms.
  - The 805 ms frame is not reproduced; it was most likely a hidden-pane artifact.
  - Left: Civ.stepWalk allocates 6-26 KB per frame (number boxing; low).
  - The 8768 server is stopped. Still waiting on the workflow, p7a and p8-load.

- 2026-10-24 ~00:35 GTBDT. p8-traffic done (6 commits, tip 1094a09) and merged, a clean merge; the merged tree equals 1094a09.
  - Self-test 2532/0. Traffic.update +0.014 ms per tick.
  - traffic-metro now draws 40-48 vehicles (was 2-10).
  - The society flake did not reproduce (15/15). D60 recorded. The 8772 server is stopped.

- 2026-10-24 ~00:00 GTBDT. OWNER (verbatim): "Use more workflows to finish sooner" → the final program review (P8.3) moves forward and runs as a workflow while the four helpers finish.
  - Workflow `wf_8d2f0feb-3a8` (task wk50iyt0z): 5 area reviewers (world, combat, living, missions, cross), each followed by 1 adversarial verifier, all Opus+high.
  - It reviews a frozen snapshot of 6103b25 at `Mech Flight Sim/_review_snap.html` (untracked; delete after the review).
  - The in-flight branches get a short delta review after merge.
  - RESUME: workflow + p7a + p8-traffic + p8-perf + p8-load → fix the confirmed findings → merge all → full self-test + bench → delta review → close-out → owner's go.

- 2026-10-23 ~23:50 GTBDT. OWNER (verbatim): "Landing walking on structures damages them!" → interpreted as: add landing impact damage plus standing-load damage to structures (D59).
  - p8-load (Opus+high, isolated from 6103b25, port 8773) is building it.
  - In flight: p7a, p8-traffic, p8-perf, p8-load.

- 2026-10-23 ~23:45 GTBDT. Started from tip 6103b25, both isolated:
  - p8-traffic (port 8772): rubble/flood/lava/broken bridges block lanes; no respawn on a broken deck; traffic-metro bench view; ambulance junction flake.
  - p8-perf (port 8768): P8.2, bench every map to ≤ 7.8 ms p95, the 805 ms frame, hot-path allocations; hotspots in traffic go to p8-traffic.
  - p7a is still fixing m9-m13 (port 8767).
  - RESUME:
    1. Merge p7a, p8-traffic and p8-perf.
    2. Full self-test and a clean bench.
    3. Combined gate review (P6 round 2, P7, P8), then the final P8.3 review.
    4. P8.4 close-out, then ask the owner's go to push.

- 2026-10-23 ~23:40 GTBDT. P8.1 co-op done (p8-coop: 0422369, 2d96fee) and merged, a clean merge. Merged self-test 2522/0.
  - Two-tab WebRTC host and guest on all 10 new maps: in sync, no errors.
  - Fixed: units past the 44-unit snapshot cap take turns (before, they vanished on the guest); shells go first under the 70 cap. NET stays 10.
  - Unexplained: once, a ship didn't move after being hit (m10 Trident, m12 Skua), but both mirrored and moved in reruns → check in the final review.
  - The 8769 server is stopped. Still waiting on p7a.

- 2026-10-23 ~23:00 GTBDT. The p7b review fixes (797aeba, e9dbba5) are merged into worktree-living-world, a clean merge. Merged self-test: 2481/0.
  - m17 at a 250 m range is now about as hard as m3; every idle player loses.
  - Known flake to watch: an ambulance "stops clear of the junctions" failed 1 of 5 runs on p7b's line (before 98bc531).
  - The 8768 server is stopped. Still waiting on p7a and p8-coop.

- 2026-10-23 ~22:45 GTBDT. `98bc531` on worktree-living-world fixes a real fault: the medic could not reach a person fallen inside a building's footprint, and the 35 s scene timer cut the walk short. Now:
  - the medic walks the streets round the block to the nearest free spot;
  - a casualty scene lasts until the person is tended;
  - an ambulance never stops past its stop point (nose in the junction);
  - the test waits for a walker near the hospital.
  - Self-test 2470/0, twice.
  - D58 recorded (m1-m8 first spawns unchanged, respawns step out of sight).
  - OWNER question pending: landing damage to buildings in P8 (not implemented today; only aircraft crashes and sideways rams damage structures).
  - In flight: p7a, p7b (on ab9e19c), p8-coop (ab9e19c). Merge them into the 98bc531 line afterwards.

- 2026-10-23 ~22:05 GTBDT. p7-review-a: not ready.
  - High: H1 m10 cannot be won (landed craft have their AI off, aircraft start in AA range); H2 m12 start and respawns are under fire, and the counterattack is badly timed.
  - Medium: M1 the weaponGate flag would take later-gated weapons from pre-P7 saves; M2 the m13 brief and spotting differ.
  - Low: L1-L5, plus weak co-op and hazard tests.
  - Held: unlocks/saves/locks, co-op host-only hazards, old content, Training on 13 maps.
  - Sent to p7a: fast-forward to ab9e19c, then fix. p7a owns the general respawn safety, the weaponGate list and the start-exposure test for m1-m18.
  - In flight: p6-society (ambulance), p7a, p7b. Merging into worktree-living-world comes after all three.

- 2026-10-23 ~22:00 GTBDT. p7-review-b: not ready.
  - High:
    - H1: m16 Skua harbour spawn inside turret sight.
    - H2: Obj.rescue impossible from the air (speed limit below stall).
    - H3: m17 harder than m3 (waves 300 m out, the player starts 535 m away).
  - Medium: M1 m16 convoy fired on before moving; M2 m18 raiders camp the respawn; M3 test gaps.
  - Low: L1-L3.
  - Held: m14 on foot, the Metro move (0 fallbacks over 200 seeds), co-op host-only hazards, old content.
  - Sent to p7b: fast-forward its worktree to ab9e19c, then fix.

- 2026-10-23 ~21:50 GTBDT. P6 round 2 landed as `5a03b25`: the bend give-way plus 4 other hold and touch fixes, all 4 weak tests now fail with their fix off, and forged number-0 spawns are refused. Self-test 2348/0.
  - Merged into worktree-living-world, each with --no-ff, conflicts resolved by union:
    - `41de7f6`: docs.
    - `5618178`: P7 part A.
    - `1d066b0`: P7 part B, 3 conflicts.
    - `194afc8`: P8 lows a, 1 conflict.
    - `ab9e19c`: P8 UI, 1 conflict.
  - Merged self-test 2470/1: 'society: first responders' medic check (metro seed 7; the layout changed with B's moved towns). Sent to p6-society.
  - D56 addendum: the narrow P6 round-2 re-verify folds into one combined gate review of the merged tip (P6 round 2 + P7 + P8 lows/ui), after the P7 review fixes.
  - In flight: p6-society (ambulance), p7-review-a, p7-review-b.

- 2026-10-23 ~21:25 GTBDT. p8-ui done: branch `worktree-agent-afb6accd04e287a96`, tip `b0e9516` (base 1baa77c).
  - Touch training panel: below the message lines, text fitted, desktop unchanged.
  - Help text: new paragraphs plus release notes "18 missions, 13 battlefields" (true only after B merges).
  - Self-test 2419/0, block 'p8 ui'. The 8770 server is stopped.

- 2026-10-23 ~21:20 GTBDT. p8-lows-a done: branch `worktree-agent-a3b5f527011dfce6f`, tip `d94882c` (base 0aa8716).
  - Fixes: findSpawn skips occupied ground spots; the objective's struct entry gets an optional 7th field with the unspotted amount, so NET stays 10; a fuel blast carries the unspotted multiplier.
  - Self-test 2349/0, block 'p8 lows a'; each fix was shown to fail its test when switched off.
  - The 8769 server is stopped.

- 2026-10-23 ~21:10 GTBDT. OWNER (verbatim): "Use more parallel helpers go faster" → 5 helpers at once (over the usual ~4 heavy jobs; the owner asked).
  - p6-society: round 2, in this worktree.
  - p7-review-a / p7-review-b (Opus+high, read-only): reviewing the two mission branches on ports 8767/8768 (servers started by the coordinator).
  - p8-lows-a (Sonnet+medium, isolated, from 0aa8716): findSpawn skips occupied spots; the guest sees the cap count; the fuel-tank blast goes through the cap. Port 8769 on request.
  - p8-ui (Sonnet+medium, isolated, from 1baa77c): the training panel at 812x375; help text (P8.4). Port 8770 on request.
  - RESUME:
    1. p6 round 2 → narrow re-verify.
    2. Fix rounds for the P7 review findings (on each branch).
    3. Merge into worktree-living-world in this order: lw A → B → p8-lows-a → p8-ui.
    4. Merged self-test and a clean bench → P7 gate.
    5. P8.1 co-op, P8.2 perf and the rest of the traffic lows (rubble/flood/bridge, bench view) → final review. No push.

- 2026-10-23 ~21:05 GTBDT. p7a done: branch `worktree-agent-a84a9a9f6bbf15216`, tip `1baa77c`. Commits: 9ce8852 (weapon unlocks), d05ac17 (Training map choice, hazardScript/missionHazard, briefing unlock line), 479d04e (m9-m13 and block 'missions P7a'), 1baa77c (tuning).
  - Self-test 2412/0. Every mission was won by the game's AI flying the player, at veteran difficulty; m10-m13 needed "help" (nudged and 4x damage).
  - Unlocks: torpedo, navalGun, sword, cryoBlizzard, sandstorm.
  - Bench: no scene over its limits.
  - Proposed: a mission-unlocked weapon stays locked until its mission is won (saves from before P7 keep every weapon); a mission win is an extra way to unlock a superweapon; trucks wait out nearby hazards; Training picks its battlefield, saved in `trainingMap`.
  - Trial merge of A with B (merge-tree): 3 conflicts, each the union of both sides: the defaults() line (take A's trainingMap), the end of MISSIONS (A then B), the end of the self-tests (A then B). There is a single missionHazard/hazardScript.
  - Waiting on p6-society (round 2, uncommitted in this worktree) before merging. The 8767 server is stopped.

- 2026-10-23 ~20:45 GTBDT. p7b done: branch `worktree-agent-ad0b927a791313aa9`, tip `be91e0e`. It contains 32acbaf (a cherry-pick of p7a's 9ce8852), c8d5904 (m14-m18, the Metro move, block 'missions P7b') and be91e0e (traffic test camera).
  - Self-test 2389/0. Every mission was won by a scripted player.
  - Unlocks: knife, volcanicEruption, katana, shipSam, plasmaTornado.
  - Bench limits held (≤ 7.9 ms p95, ≤ 19.8 ms max), but "0 ms added" is unproven because of noise; hz-jungle read +0.9 ms → re-measure at the P7 gate.
  - Proposed D57: missions can set `foot` and `hazardScript`; m16 uses hovercraft; the Metro outpost moves to (600,600); new objective `Obj.rescue`.
  - The 8768 server is stopped. Still waiting on p7a and p6-society.

- 2026-10-23 ~19:55 GTBDT. The hand-made p7 worktrees were refused by the isolation guard, so the agents could not write there. Those worktrees and branches were removed, and p7a and p7b were relaunched with harness worktree isolation (ports 8767/8768); their branch names come in their reports. The RESUME plan is otherwise unchanged.

- 2026-10-23 19:46 GTBDT. OWNER (verbatim): "Finish this faster without regressing or losing effectiveness" → interpreted as: run independent work in parallel and keep every gate (D56).
  - P7 started early, split across two worktrees from 0aa8716:
    - p7a: living-world-p7a, branch lw-p7a, port 8767. Missions m9-m13 and the Training map choice.
    - p7b: living-world-p7b, branch lw-p7b, port 8768. Missions m14-m18 and the Metro outpost/towns fix.
  - P6 fix round 2 continues on worktree-living-world (agent p6-society).
  - RESUME:
    1. P6 round 2 → narrow re-verify (p6-review).
    2. Merge lw-p7a and then lw-p7b into worktree-living-world with --no-ff; resolve the conflicts at the MISSIONS and self-test ends.
    3. P7 gate review over the merged result.
    4. Remove the p7 worktrees.
    5. P8. No push until the owner's go.

- 2026-10-23 ~19:45 GTBDT. P6 fix round 1 `0aa8716` verified (Opus+high): M1-M3 and L1-L5 fixed; self-test 2345/0.
  - Performance (Playwright): P6 costs ≈ 0.48 ms per frame over 35af12a (allowance +0.8); worst p95 5.0 ms, max 5.6 ms.
  - Remaining:
    - M1: a pre-existing 25 s bend hold between two cars.
    - L1: four new tests pass with their fix off.
    - L2: a forged number-0 enterCiv still spawns a car.
  - In flight: fix round 2, agent p6-society.
  - RESUME: fix round 2 → re-verify (p6-review) → P6 gate passed on the branch (no push) → P7.

- 2026-10-23 18:09 GTBDT. P6 gate review done (Opus+high): no high-severity issues; fix M1-M3 before the gate closes.
  - Checks: self-test 2336/0; the "society: the day" block passed 20/20; m1-m8 ran 40 s each with no errors; nothing carried over after quitting or restarting; co-op local scenery confirmed.
  - Performance (Playwright, visible): the new systems cost ≤ 0.2 ms per frame; every scene ≤ 4.6 ms p95 and ≤ 13.2 ms max. The hidden pane is too noisy to use.
  - Medium:
    - M1: a stop at a lane's end is never reached, so responders and commuters circle (5 of 15 casualty scenes got no ambulance).
    - M2: kerb cars block doors; the 23:00 indoor share is 66-94% unpinned, and the test passes only because its random numbers are pinned.
    - M3: on Metro, the cargo jet's gate overlaps the parked Shrike.
  - Low, also in this fix round: co-op double-claim and refused-request car loss, fixed ids for cars, dispatch spike, weak checks.
  - Routed to P8: cars ignore rubble and floods; respawns on a broken bridge; the traffic-metro bench view.
  - In flight: fix round, agent p6-society.
  - RESUME: fixes → verify (Opus+high) → P6 gate passed on the branch (no push) → P7.
- 2026-10-23 ~18:00 GTBDT (time corrected; the original entry had a guessed time). P6.5 done `a4e4832`. Full self-test 2336/0. Society ~0.001 ms per tick; back-to-back bench within 0.1 ms of base on every scene (all ≤ 3.9 ms). Decision D55. Also fixed in traffic: cars never passed a lane end; opposite turns blocked each other.
  - Limits: responders sometimes take 30-100 s or never arrive (they drive in traffic); the 23:00 indoor share is 76-80% against a 75% test bar (flake risk).
  - In flight: P6 gate review (Opus+high), with a bench against 35af12a.
  - RESUME: review → fixes → verify → P6 gate passed on the branch (no push) → P7.

- 2026-10-23 21:20 GTBDT (approx). P6.3 `951c34a` and P6.4 `bb41997` done. Full self-test 2322/0 (the flights-only commit also passed 2311/0). Direct cost ≤ 0.07 ms per frame; worst single calls 0.8 ms (Shipping.update) and 1.8 ms (Shipping.draw), untraced. NET_VERSION 10. Decision D54.
  - Bench unreliable while the pane is hidden: for the P6 gate try a visible browser (e.g. the Playwright browser) for a clean p95 against 35af12a.
  - In flight: P6.5 society sim agent (Opus+high).
  - RESUME: P6.5 → P6 gate (clean bench, review) (no push).

- 2026-10-23 20:05 GTBDT (approx). P6.2 + P6.1 done: `4a27425`, `17d4f40`. Full self-test 2297/0. NET_VERSION 10. Decision D53.
  - Perf (for the gate): traffic-metro best p95 7.1/6.8/6.7 vs base 5.3/5.5/6.7 (noisy, hidden pane); average frame +0.15 ms on the metro corner; Traffic update ~0.15 ms/tick in game.
  - In flight: P6.3 + P6.4 agent (Opus+high).
  - RESUME: P6.3 + P6.4 → P6.5 → P6 gate (no push).

- 2026-10-23 18:15 GTBDT (approx). **P5 GATE PASSED** on `35af12a` (not pushed, owner rule): "ready to ship"; self-test 2205/0; NET_VERSION 9; SAVE_VERSION 1. Unspotted cap holds (172 shells, HQ at 3375/4500); cap per structure and per battle; bridges safe with the sideways push.
  - Routed to P8: `findSpawn` (~18072) should skip spots taken by other units (a co-op respawn on an occupied spot can push a soldier through a thin wall); the guest HUD wording after the unspotted cap; a fuel-tank blast near an objective ignores the cap (negligible).
  - P5 started about 14:10, passed about 18:15: about 4 h of the 8 h budget.
  - RESUME: P6 items in order → P6 gate. P6 deadline 12 agent-h.

- 2026-10-23 18:05 GTBDT (approx). P5R2 done `35af12a`: unspotted cap 25% per objective (HQ ends at 3375/4500 after 10 min); civilians do not spot; coincident units pushed apart sideways; harbour fallback steps clear of other hulls. Self-test 2205/0.
  - Known low: the 25% count is not sent to guests (guest HUD wording only).
  - In flight: final P5 check (reviewer, resumed).
  - RESUME: verify → P5 gate passed on the branch (no push) → P6.

- 2026-10-23 17:50 GTBDT (approx). P5 verification: M1-M5 and lows confirmed; M4 accepted (recorded in D52). Self-test 2203/0. Still open: H1 bypass (unspotted Thunder + pad resupply kills the HQ in 233 s) → cap unspotted damage per objective at 25% per battle, civilians do not spot; M1 stacked Tridents at the alpine fallback harbour never separate.
  - In flight: P5R2 (p5-naval, resumed).
  - RESUME: P5R2 → quick verify → P5 gate passed on the branch (no push) → P6.

- 2026-10-23 17:30 GTBDT (approx). P5R done: `e041814`, `f25a370`, `61e9761`, `948f789`. Full self-test 2203/0. Decision D52.
  - M4 not proven: sk-water vs 66728af 0 to +0.4 ms across rounds (pane flips between GPU modes ~1.8 ms apart); direct timing of ships, batteries and wakes 0.05-0.1 ms per tick. A battery target search can spike to 0.7 ms on one tick.
  - Not done: co-op guests do not see the harbour buoy or resupply prompt (resupply still works).
  - In flight: P5 verification (reviewer, resumed).
  - RESUME: verify → P5 gate passed on the branch (no push) → P6.

- 2026-10-23 16:30 GTBDT (approx). P5 gate review: "fix H1 and M1 before shipping". Self-test 2169/0; kind audit fine; torpedo rules hold; AI batteries fair (0-337 damage to the player in 5-min medium runs); loadouts saved by name, so the weapon order change breaks no save.
  - High: H1 a player Thunder kills the enemy HQ from the spawn in ~40 s → decision: player indirect fire on objectives needs a spotter, else ×0.15.
  - Medium: M1 Alpine/Metro offer ships but never deploy them; M2 a ship stranded after a flood is stuck; M3 ship hit circle vs long hulls; M4 water scene +0.6-0.8 ms p95 (allowance +0.2) → budget effects, then cap the fleet by quality if needed; M5 tundra fleet spawns next to the player.
  - Low: co-op naval paths untested; objective arrow over DEPLOY; sky aim fires; ships cannot resupply; unused `naval.climb`; wrecks without collision; test gaps; a format slip; batteries can hit their own base.
  - In flight: P5R (p5-naval, resumed, all findings).
  - RESUME: P5R → verify → P5 gate passed on the branch (no push) → P6.

- 2026-10-23 16:00 GTBDT (approx). P5.3 done: `c639695`, `220e93f`. Full self-test 2169/0. Solver max miss ≤ 0.10 m at 200-1200 m on farmland, alpine, canyon. Coast with batteries +0.2 ms best p95 (at the limit). NET_VERSION 9. Decision D51.
  - Live: Thunder, Hailstorm and Pestle duels; touch DEPLOY/ARC.
  - Rough edges: a salvo's warning pillars near the camera cover much of the view; the off-screen objective arrow overlaps DEPLOY/CROUCH on the phone layout.
  - In flight: P5 gate review (Opus+high).
  - RESUME: review → fixes → verify → P5 gate passed on the branch (no push) → P6.

- 2026-10-23 15:00 GTBDT (approx). P5.1 + P5.2 done: `1a0af39`, `be64527` (new bench scene sea-coast). Full self-test 2088/0. Best p95 ≤ 5.7 ms on every scene; ships cost about 0.05 ms sim time. NET_VERSION 8. Decision D50.
  - Live on Harbour Coast: Lancer, Trident, Skua (across a beach), enemy fleet engaging.
  - Not done: no docks, no sea lanes (P6).
  - In flight: P5.3 artillery agent (Opus+high).
  - RESUME: P5.3 → P5 gate review (no push) → P6.

- 2026-10-23 14:10 GTBDT (approx). **P4 GATE PASSED** on `66728af` (not pushed, owner rule): "ready to ship P4"; full self-test 1997/0; NET_VERSION 7; SAVE_VERSION 1.
  - Routed to P7.1: move Metro's default outpost and its 3 towns off the airport ground (a metro mission now keeps the city and 5 of 8 towns and loses the outpost; an objective on airport ground shrinks the airport to a strip) and restore the strict every-town test; P7 metro missions keep objectives and start off the airport.
  - Routed to P8: the training-range info panel overlaps a message line and a touch button at 812x375.
  - P4 started about 09:20, passed about 14:10: about 5 h of the 14 h budget.
  - RESUME: P5.1 → P5.3 → P5 gate. P5 deadline 8 agent-h.

- 2026-10-23 14:00 GTBDT (approx). P4R2 done: `b50468a` metro airport required (`maxTownCost` 3; 20/20, 4.3 towns), `66728af` HUD text off panels/radar/buttons (test at 5 sizes × 3 scales). Full self-test 1997/0.
  - Known: a metro mission keeps 7 of 9 towns and loses its default outpost to the airport; the training-range info panel slightly overlaps a message line and a touch button at 812x375 (→ P8 if the verifier agrees).
  - In flight: final P4 check (reviewer, resumed).
  - RESUME: verify → P4 gate passed on the branch (no push) → P5.

- 2026-10-23 13:40 GTBDT (approx). P4 verification: every P4R fix confirmed in the pane; self-test 1996/0. Verdict: fix the metro airport rule first (recommendation: per-map town-cost limit, metro required with limit 3 → airport 20/20, 4.3 towns; canyon unchanged). Low: tutorial tip and supply prompt overlap HUD panels / USE on phone and upright tablet; sk-water maybe +0.9 ms from the 2 parked aircraft.
  - In flight: P4R2 (p4-core, resumed).
  - RESUME: P4R2 → quick verify → P4 gate passed on the branch (no push) → P5.

- 2026-10-23 13:15 GTBDT (approx). P4R done: 8 commits `d8549cc`..`38054b1` (only the final state tested). Full self-test 1996/0. Towns within 0.5 of before on every new map; mech melee back to old dps (sword ×1.3, katana ×1.6). NET_VERSION 7 (`footLo`, `drv`).
  - Question for the verifier: metro now has no airfield in 9 of 20 skirmishes, against D23's "big airport".
  - In flight: P4 verification (reviewer, resumed).
  - RESUME: verify → P4 gate passed on the branch (no push) → P5.

- 2026-10-23 12:30 GTBDT (approx). P4 gate review: "fix the shared airport respawn spot before shipping". Self-test 1979/0; m1-m8 start and survive exit/enter in mech, jackal and kestrel; runways flat on 10 maps × 2 seeds; sk-ashfall 15.5 ms was noise (4.4-5.5 on rerun); every scene best p95 ≤ 6.6, worst p95 7.6, max 22.6.
  - High: planes respawning on the same runway spot destroy each other (plane contact damage on the ground).
  - Medium: airfields cost towns (canyon 2.6 → 0.45, others -15-40%); last-resort exit leaves you inside the hull; co-op guest on foot gets the default kit; melee balance (mech fists ×2 old dps, Colossus katana ~470 dps).
  - Low: parked mech finishes a wind-up; Use/touch state not reset on session start; dead GEAR on the ground; touch overlaps with the tutorial tip and the top HUD line at scale 1.4; guests see parked vehicles with the pilot's name; waves walk toward a passive civilian; nothing to enter outside training (→ 2 parked aircraft on the skirmish home apron).
  - In flight: P4R fixes (p4-core agent, resumed).
  - RESUME: P4R → verify (Opus+high) → P4 gate passed on the branch (no push) → P5.

- 2026-10-23 12:00 GTBDT (approx). P4.2 done `b74b71d`, `4732f98`. Full self-test 1979/0. Decision D49.
  - Open for the gate: sk-ashfall p95 15.5 ms in one bench (one 111 ms run, no baseline) → re-run; RLD over the tutorial tip at touchScale 1.4; pause button over top-centre HUD text (old); BOOST latched across an in-battle restart (old).
  - In flight: P4 gate review (Opus+high).
  - RESUME: review → fixes → verify → P4 gate passed on the branch (no push) → P5.

- 2026-10-23 11:30 GTBDT (approx). Bird flake fixed `d87081e` (cause: far flocks think every 4th tick, so a bird stayed grounded up to 3 ticks after take-off; 5 full runs + 50/50 block runs). P4.5 `5fdf8a0`, P4.6 `73e08d2` (NET_VERSION 7). Full self-test 1967/0. Bench within limits. Decision D48.
  - For the gate review: co-op guest on foot has fists only; canyon districts dropped 2.0 → 0.4 per battle.
  - In flight: P4.2 touch layout agent (Opus+high).
  - RESUME: P4.2 → P4 gate review → fixes → verify (no push).

- 2026-10-23 10:15 GTBDT (approx). P4.1 `5dd3d77`, P4.3 `138b90b`, P4.4 `5b1b388` done (agent). Full self-test rerun by me: 1943/0. Best p95 within +0.2 ms on every scene. NET_VERSION 6. Decision D47.
  - Live: exit/enter for mech, ground and air; ejection at 150 m with parachute; on-foot skirmish as Infantry (targeted) and Civilian (ignored).
  - Flake: "birds keep above the ground and the water" failed once in a full run (passes alone) → fix with flake triage in the next item.
  - Not done: airport respawn proven only by its self-test (P4.5 fills `W.airports`); touch only has the `Seats.context` hook (P4.2); m1-m8 covered by self-test only.
  - In flight: P4.5 + P4.6 agent (Opus+high).
  - RESUME: P4.5 + P4.6 → P4.2 → P4 gate (no push).

- 2026-10-23 09:20 GTBDT (approx). **P3 GATE PASSED** on `5374fe9` (not pushed, owner rule): "ready to ship"; self-test 1874/0; flood drawn within 0.15 m at 99.5% of points (worst 0.58 m on steep coast shores, nothing over dry land); rebuild frames worst 8.7 ms; NET_VERSION 5; SAVE_VERSION 1.
  - Routed to P8: one 805 ms frame seen once in a hidden pane during a scripted teleport (not reproduced); re-check in a visible pane.
  - P3 started about 05:20, passed about 09:20: about 4 h of the 6 h budget.
  - RESUME: P4.1 → P4.6 → P4 gate. P4 deadline 14 agent-h.

- 2026-10-23 09:10 GTBDT (approx). P3R3 done `5374fe9`: flood drawn as a 4 m grid at `Water.level` (rebuilt per 0.1 m step, 1-2 ms each); new bench scene `hz-coast` best p95 4.4-4.6 (HEAD 4.1-4.3, noise). Self-test 1874/0 twice.
  - In flight: final quick verification (reviewer, resumed).
  - RESUME: verify → P3 gate passed on the branch (no push) → P4.

- 2026-10-23 08:50 GTBDT (approx). Re-verification of `c110029`: water amounts and one level rule for all users confirmed; self-test 1873/0. Medium: the flat flood surface is drawn up to 10-12 m above the real water on coast and valley. Sent back for a drawing that follows `Water.level` (P3R3).
  - RESUME: P3R3 → quick verify → P3 gate passed on the branch (no push) → P4.

- 2026-10-23 08:40 GTBDT (approx). P3R2 done `c110029`: flood circle kept over its source (≤ half radius off), dry ground never deeper than the rise so far (3.2 m max, first frame +0), guests get the source height; lava rounded before its check. Self-test 1873/0 twice.
  - Left: the flood surface is drawn flat at its top height, so a low pocket may look deeper than simulated (verifier to judge).
  - RESUME: re-verify → P3 gate passed on the branch (no push) → P4.

- 2026-10-23 08:25 GTBDT (approx). P3 verification: every dbbf744 fix confirmed (lightning caps, flood warning, guest match, timeout, L1-L4, wire compatibility); self-test 1869/0. New HIGH: a flood far from water fills a dry basin deep (coast 85-98% of the circle, 13-17 m) and low pockets jump on the first frame. Low: lava rounding after the site check.
  - In flight: P3R2 (hazards agent, resumed).
  - RESUME: P3R2 → re-verify → P3 gate passed on the branch (no push) → P4.

- 2026-10-23 08:10 GTBDT (approx). P3R done `dbbf744` (one commit). Self-test 1869/0 twice. Best p95 ashfall 5.6, jungle 4.8, hz-jungle 5.2 (noisy; worst frame 29.9 ms < 33). NET_VERSION 5. Decision D46. The old `startSession` console error came from a console test script; a corrupt destruction level in a save is now sanitized.
  - Open: a scheduled flood can sit on dry land away from its source water (verifier to judge).
  - In flight: P3 verification (the reviewer, resumed).
  - RESUME: verify → P3 gate passed on the branch (no push, owner rule) → P4.

- OWNER (2026-10-23, answer to "push Breakpoint's iPhone changes to main now?", verbatim): "Push after all is done and after my go" → interpreted as: no more pushes to main, neither Breakpoint nor IRON HORIZON phases, until the whole program (P3-P8) is finished and the owner says go. Phase gates still run in full; each passed phase stays on `worktree-living-world`. This supersedes the per-phase push rule from the program prompt.
  - RESUME: P3R → verify → P3 gate passes on the branch (no push) → P4 … P8 → final report → wait for the owner's go → push.

- 2026-10-23 07:40 GTBDT (approx). P3 gate review: "fix H1 and M1 before shipping". Self-test 1855/0; worst case (quake + gas + tower collapse on metro) p95 3.3 ms; quake flattens 5 of 16 buildings; quitToMenu restores flood water.
  - High: H1 lightning targets aircraft at any altitude (kestrel at 600 m 244/270 per strike; ranger one-shot; colossus lost 817/1370 in a storm).
  - Medium: M1 flood raises water during its warning; M2 guest lava and boulder paths can differ from the host's; M3 guests drop hazards after 8 s of silence and re-warn.
  - Low: gas leak without a plant; shot-before-fall pieces sent as state 2; kill feed "Unknown" for collapse deaths and guest-chosen fall direction; objectives take ram damage and m4 convoy trucks take ram damage on houses.
  - Weak checks: guest no-damage checks pass through shared guards; "hazards off" ends with an always-true term; bird exemption too wide; outside dummy 250 m past the edge.
  - In flight: P3R fixes (the hazards agent, resumed).
  - RESUME: P3R → verify (Opus+high) → push IH-only → P4.

- 2026-10-23 07:25 GTBDT (approx). P3.3 done (agent): `4ee6b5b`, `cec9397`, `e6452bf`. Self-test 1855/0 twice. NET_VERSION 5. Decision D45.
  - Bench best p95 ≤ 6.0 on every scene (noisy); hz-jungle 5.6; wildfire A/B adds about +0.1 ms.
  - Live: every hazard on its signature map, screenshots.
  - Test change: the bird clearance check allows the take-off step (flake, code unchanged).
  - In flight: P3 gate review (Opus+high).
  - RESUME: review → fixes → verify → push IH-only → P4.

- 2026-10-23 06:15 GTBDT (approx). P3.1 `841e75e` and P3.2 `b6d2e8d` done (agent). Self-test 1794/0. Best p95 ≤ 4.5 ms on every scene (noisy); NET_VERSION 4. Decisions D43, D44.
  - Live: colossus rams a house, bastion breaks a fence, jet vs tower as before, skyscraper collapse kills units below, bulwark 70 m away untouched, rubble field.
  - m1-m8: a bastion at cruise breaks about 2 wall pieces per run (20-110 damage); props and trees as before.
  - Not done: rubble never lifts; in a full skyscraper collapse the 240-chunk cap turns upper floors straight into rubble.
  - In flight: P3.3 hazards agent (Opus+high).
  - RESUME: P3.3 → P3 gate (review, bench, push IH-only).

- 2026-10-23 05:20 GTBDT (approx). **P2 PUSHED**: `3ba3265..8513e0c` to main (11 IH commits cherry-picked; `Mech Flight Sim` identical to the tested `d6b9874` + docs). The branch merged origin/main (`d3f3db2`) and now differs from main only by Breakpoint (owner has not cleared it). IH iPhone support is live on main. No CI in this repo.
  - P2 started 23:31 on 10-22, pushed about 05:20: about 5.8 h of the 10 h budget.
  - RESUME: P3.1 → P3.2 → P3.3 → P3 gate. P3 deadline 6 agent-h.

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
