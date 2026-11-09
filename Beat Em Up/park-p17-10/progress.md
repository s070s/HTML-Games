# P17-10 style-pair balance: progress (2026-11-09, helper stopped by the owner's usage line)

Method: the P14-01 method (16 move styles on KAI's body with their default defense, AI vs AI, Warehouse, `SimRunner.run`, evenDamage, 60 s timer, 2 wins, 136 pairs, seats swapped on even seeds). Pooled rate of a style = mean over its 15 non-mirror pairs. N = 20 matches per pair (about 300 per style, one standard deviation about 3 points). Bands: 35-65 % at Easy and Normal, 40-60 % at Hard and Expert. These are tuning numbers, not the final N=40 numbers on fresh seeds 1001+ (not run yet).

## Base (branch before this pass, commit c227bd2), seeds 1-20

| Style | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| boxer | 52.0 | 33.0 | 42.3 | 39.0 |
| karateka | 53.3 | 52.7 | 51.0 | 59.0 |
| judoka | 44.7 | 52.0 | 67.0 | 58.7 |
| capoeira | 69.0 | 49.7 | 32.3 | 28.0 |
| muaythai | 58.0 | 54.7 | 61.7 | 62.3 |
| sambo | 54.0 | 60.3 | 46.7 | 48.7 |
| hapkido | 47.3 | 60.7 | 46.7 | 39.3 |
| kravmaga | 52.7 | 60.3 | 75.7 | 71.3 |
| kickboxer | 56.0 | 60.7 | 52.3 | 49.7 |
| wrestler | 30.0 | 16.3 | 10.7 | 10.3 |
| brawler | 51.3 | 47.3 | 67.3 | 72.7 |
| wingchun | 53.3 | 59.7 | 60.0 | 62.0 |
| taekwondo | 50.0 | 58.0 | 56.0 | 58.0 |
| bjj | 32.0 | 25.0 | 19.0 | 27.0 |
| kali | 40.7 | 51.7 | 59.3 | 58.0 |
| mma | 55.7 | 58.0 | 52.0 | 56.0 |

## Pass 1 (edits reverted, not committed; the patch is /tmp/claude/bp1710b/pass1.patch, apply with `git apply`)

Changes in the patch: Wrestling default defense Sway (tests: STYLE_WANT, wantByStyle, the two presets DMITRI and KELSEY added to the override list), Wrestling table (Ankle Trip foot_sweep skin at K1, Single-Leg Trip at KK); BJJ becomes a short-string style (two steps, test `short` list extended) with foot_sweep and body_jab skins and aiw foot_sweep 1.6 / guard_kick 0.7; Capoeira aiw (Bencao 0.7, others 1.3) and blockstun 15 / hitstun +1 on Armada, Au Batido, Bananeira; Brawler aiw 1.3 to 1.1; Judo aiw collar 1.8 / foot sweep 0.5; Boxer aiw jab and cross 1.15.
Scoped test run (`--affected --also "Styles|Hit check|Calm poses|Sway"`, 735 s): 625 of 655 passed, 17 known headless limits, 13 other failures: the expected fingerprint ones (N fighters, Accessibility, Levels, Balance, Effect settings, Body, Weapons) plus 5 that are not on the appendix list and were not looked at: "Styles: all 16 styles exist ... Sway styles must be 7" (a second Sway count, to update to 8), "Styles: random fighters keep their seeds" (seeds 5, 42, 777, 31337 changed), Falling (CPU ledge), Brawl camera (rooftop), P18-13 (CPU uses new posts, garage), Hazards (P8-03 bait, club). Because of these the edits were not committed.

Easy only of this build, seeds 201-220:

boxer 51.0, karateka 46.7, judoka 39.7, capoeira 69.0 (out), muaythai 58.7, sambo 54.3, hapkido 48.7, kravmaga 49.3, kickboxer 54.0, wrestler 37.0, brawler 52.7, wingchun 53.7, taekwondo 53.0, bjj 37.7, kali 45.3, mma 49.3. Normal, Hard and Expert of this build were not measured.

## Per-style probes of the pass-1 changes (one style against the other 15, N=20 per pair, seeds 1-20, base field), win rate Easy / Normal / Hard / Expert

- wrestler Sway default + table with Ankle Trip at K1 and Single-Leg Trip at KK: 40 / 49 / 54 / 46 (Block default with the same table: 41 / 51 / 23 / 26)
- bjj short table + foot sweep weighted 1.6, Guard Kick 0.7: 43 / 46 / 53 / 55
- capoeira Bencao weight 0.7, acrobatic rows 1.3, safer blockstun: 66 / 56 / 48 / 50
- brawler jab, cross, hook weights 1.0 / 1.15 / 1.3: Hard 38 / 54 / 67, Expert 48 / 61 / 73 (pass 1 uses 1.1)
- judoka collar 1.8, foot sweep 0.5: 44 / 47 / 60 / 59
- boxer jab and cross weight 1.3 (pass 1 uses 1.15): 53 / 38 / 64 / 47
- kravmaga: the Stomp or low-kick weights do not move it (51-58 / 60-65 / 71-74 / 71-80); not solved

## What is left

Kravmaga (Hard and Expert 71-76 %), Muay Thai and Wing Chun (about 62 % at Hard and Expert), Hapkido Expert (39), Capoeira Easy (66-69), Boxer Normal (33-38), then the full four-difficulty run of the pass-1 build, the final N=40 runs on seeds 1001+ and `final-<diff>.json`.
