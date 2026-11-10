# P17-10 style-pair balance: progress (2026-11-10, parked by the coordinator: the PC is shutting down)

Method: the P14-01 method (16 move styles on KAI's body with their default defense, AI vs AI, Warehouse, `SimRunner.run`, evenDamage, 60 s timer, 2 wins, 136 pairs, seats swapped on even seeds). Pooled rate of a style = mean over its 15 non-mirror pairs. Bands: 35-65 % at Easy and Normal, 40-60 % at Hard and Expert. Runner: `runner/` (README there; copy to `/tmp/claude/bp1710b`; `tbl.js <tag>` prints the pooled table, `pairrow.js <tag> <style>` a style's 15 pairs, `runprobes.sh` the one-style probes). One standard deviation: about 2.4 points per style at N=40 (about 3 at N=20), about 8 points per pair at N=40.

## Commits on the branch (all on `bp-p17-10-styles`)

- 54ef2d4 pass 1 (the reverted helper patch plus the test fixes below)
- 5f30a38 pass 2, 4d18fad pass 3 (see "Changes per style")

## The 5 tests that failed after pass 1 (causes)

- "Styles: all 16 styles exist ... Sway styles must be 7": Wrestling moved to Sway; count now 8 (test updated, legitimate).
- "Styles: random fighters keep their seeds": not fight-driven. The seeded creator fighters of seeds 5, 42, 777, 31337 are Wrestlers and their `defense` field follows the style default (now Sway). The test writes that field back to Block for Wrestlers, like it already does for name and glow; the hashes are unchanged.
- Falling (CPU ledge): the foe's CPU now strikes fighter 0 off the ledge now and then (fails at the branch head 3e3a2c0 too, so it is the new style tables, not pass 1): a second fall event. The test now counts the fall events of the knocked-off foe only.
- Brawl camera (rooftop seed 9, 71 ticks hidden, limit 54): also failing at 3e3a2c0. Enemy positions changed; no existing occlusion pose cleared a thin screen with three enemies round it. Two steep tries appended to `CAMERA_OCCLUSION_TRIES` (`[0.5, 1.0, 1]`, `[-0.5, 1.0, 1]`); they are reached only where every older try failed. All 8 Brawl camera tests pass.
- P18-13 CPU uses the new posts (garage): also failing at 3e3a2c0. The Garage hydrant is struck in about 1 CPU fight in 40 (seeds 6 and 18 of 80 on main, seed 62 now); 20 seeds were luck. Seed budget 80 (test constant `CPU_POST_SEEDS`).
- Hazards (P8-03) bait test (club, mean +11 per match, 2.9 SE at 12 seeds): STILL FAILING, also at 3e3a2c0. Cause: a 12-seed paired test with a 2 SE bar on 8 levels is marginal; with 48 seeds main itself shows the same small bait cost on Construction (+5 per match, 2.5 SE). The fix is in the AI bait chance (shared engine), not in a style: left alone.

## Changes per style (data only; shared engine rules, goons, levels untouched)

- Wrestling: default defense Sway; Ankle Trip (foot sweep skin) and Single-Leg Trip in its table.
- BJJ: short two-step table, foot sweep and body jab skins, weights foot sweep 1.6 / guard kick 0.7.
- Capoeira: weights Bencao 0.7, acrobatic rows 1.3; blockstun 15 and hitstun +1 on Armada, Au Batido, Bananeira.
- Judo: collar 1.8, foot sweep 0.5. Brawler: jab 1.15, cross and hook 1.1.
- Krav Maga: Stomp Kick skin reach 1.35 (the 1.65 row was the cause; it is a cliff: 1.45 gave 61/69 at Hard/Expert, 1.3 gave 52/50); Jab then Hammer Fist replaces Jab then Stomp (PK); Uppercut third step at KKK, Gut Punch at cKKK. Sway default would have made it 85-91 %.
- Hapkido: Palm Strike 6 frames startup (the lever: one frame moves Hard +31, Expert +25), recovery 13, reach 1.1 (reach moves Hard only).
- Boxer: Bob and Weave Hook startup 8 / recovery 17 / reach 1.35; Body Hook startup 6 / recovery 13 / reach 1.4; no jab or cross weight. Sway floors for the Body Hook (longest Mid strike now).
- Sambo: boot and leg pick weights 1.15 (1.3 gave 37 at Hard, 1.0 gave 58-62). MMA: overhand and superman 1.6. Taekwondo: Ap Chagi skin reach 1.55. Kickboxing: heavy kick weights 1.3, switch kick and backfist 1.0.
- Test floors: Krav Parry Strike torso 0.21 on the slip side (the Stomp Kick got shorter than it).

## Final runs (N=40 per pair, 136 pairs)

Run 1 (seeds 1001-1040, build of commit 5f30a38, before pass 3), files `run1-final-<diff>.json`:

| Style | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| boxer | 53.2 | 45.0 | 50.0 | 31.2 * |
| karateka | 44.2 | 47.8 | 45.0 | 49.2 |
| judoka | 40.2 | 42.5 | 52.3 | 52.0 |
| capoeira | 67.0 * | 51.7 | 41.5 ~ | 44.3 |
| muaythai | 57.7 | 50.0 | 54.0 | 55.7 |
| sambo | 55.0 | 51.8 | 61.8 * | 58.5 ~ |
| hapkido | 49.5 | 58.2 | 59.7 ~ | 41.2 ~ |
| kravmaga | 48.0 | 55.0 | 48.0 | 59.7 ~ |
| kickboxer | 57.3 | 52.0 | 46.8 | 39.7 * |
| wrestler | 39.8 | 47.0 | 47.3 | 48.2 |
| brawler | 49.5 | 45.0 | 46.3 | 56.5 |
| wingchun | 56.0 | 53.8 | 47.2 | 43.3 |
| taekwondo | 57.2 | 51.0 | 45.7 | 60.0 ~ |
| bjj | 39.3 | 46.2 | 60.0 ~ | 58.7 ~ |
| kali | 38.3 | 47.8 | 54.7 | 53.0 |
| mma | 47.8 | 55.2 | 39.7 * | 49.0 |

(* out of band, ~ within 3 points of an edge.) Pairs more than 12 points past the band: none at Normal; a few at Easy (capoeira|bjj 88, kickboxer|bjj 78, kickboxer|hapkido 80) and many at Hard and Expert (strongest: judoka|capoeira 98, wrestler|capoeira 95, wrestler|capoeira 85 at Hard, brawler|bjj 80, bjj|hapkido 80, boxer|capoeira 78); with 136 pairs at N=40 (8 points each) a dozen of them are noise, the Capoeira-against-grapplers ones repeat in every run.

Run 2 (seeds 2001-2040, build of commit 4d18fad = current branch head, pass 3 in) is the real final, only half done: `final-easy.json` and `final-normal.json` (replace the old two). Pooled:

- Easy: boxer 51.3, karateka 50.3, judoka 42.5, capoeira 64.2 (edge), muaythai 59.0, sambo 48.8, hapkido 47.8, kravmaga 47.5, kickboxer 58.8, wrestler 38.0, brawler 49.2, wingchun 58.2, taekwondo 53.7, bjj 35.0 (edge), kali 46.8, mma 48.8. All in band; pairs out: capoeira|bjj 88, wingchun|bjj 80, kickboxer|wrestler 78.
- Normal: boxer 49.3, karateka 46.0, judoka 43.7, capoeira 51.2, muaythai 52.8, sambo 55.0, hapkido 57.0, kravmaga 49.2, kickboxer 55.0, wrestler 46.3, brawler 43.2, wingchun 52.8, taekwondo 54.0, bjj 47.7, kali 43.7, mma 53.2. All in band.
- Hard and Expert of run 2: NOT run (the Hard run was killed at the shutdown). Pass 3 was aimed at the run-1 outliers at Hard and Expert (Boxer Expert 31, Kickboxer Expert 40, Sambo Hard 62, MMA Hard 40); probes on seeds 501-520 predicted Boxer 59/49, Sambo 51/56, MMA 49/47, Kickboxer 47/43 (Hard/Expert).

## Full headless suite

Not run (the scoped run, `--affected --also "Styles|Hit check|Calm poses|Sway|Falling|Brawl camera|P18-13 CPU uses"`, 740 s, at the branch head: 630 of 655 pass; 17 known headless limits; 8 failures: the 7 fingerprint tests of appendix.md "Failing fingerprint tests" (Body, Weapons, N fighters, Accessibility, Levels, Balance, Effect settings) and the Hazards bait test above).

## Next

1. `./all4.sh final3 40 3001` (or Hard and Expert only: `./all4.sh final3 40 3001 hard expert`) with `GAME=` the extract of the branch head; write `final-hard.json` and `final-expert.json` (and replace the two files above if the whole run is repeated); update the table here.
2. If a style is still out: Capoeira Easy (about 66, its weights raise Hard and Expert by 10-20 so they cannot go down), Boxer Hard (probe e12 gave 59), Hapkido Expert (41 near edge) are the likely ones.
3. Full suite once (`node ~/.claude/scripts/heavy.mjs -- node tools/run-tests.js` from `Beat Em Up/`, about 11-40 min depending on the load), list failures with causes, fill `@@BALANCE@@` of appendix.md, commit.
