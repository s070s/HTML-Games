# P17-10 style-pair runner (scratch copy, delete with the park folder)

The scripts expect to live in `/tmp/claude/bp1710b` (Windows `%TEMP%\claude\bp1710b`): copy this folder there first.

- Extract the game: `node extract.js "<worktree>/Beat Em Up/breakpoint.html" game.js`
- All four difficulties, N per pair, from a seed: `GAME=game.js ./all4.sh <tag> 20 201 [easy normal hard expert]` (background job; writes `sum-<tag>.txt` and `out-<tag>-<diff>.json` in the final-normal.json shape; heavy slots via heavy.mjs).
- One style against the other 15: `./dd.sh <tag> <style> 20 1 [prelude.js]`; preludes use `lib.js` (`setStrings`, `setAiw`, `setSkin`, `setRow`, `setDef`) to try changes without editing the html. The kept preludes are the last probe per style (b15 bjj, c5 capoeira, x6 wrestler, j2 judo, e3 boxer, r2 brawler, k2 krav maga).
- `tables.js` prints a style's tables, `rows.js` the frame-data bands.
- `pass1.patch`: the reverted pass-1 edits (wrestler Sway + trips, BJJ short table + sweeps, Capoeira, Brawler, Judo, Boxer weights); `git apply` it, then fix the 5 unexplained test failures listed in `../progress.md`.
- Final numbers: `./all4.sh final 40 1001`.
