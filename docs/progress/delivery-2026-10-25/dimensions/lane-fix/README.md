# Final dimension row separation — 2026-10-25

A top Door chain occupied row 0, its wall axis moved to row 1, and the overall width still occupied row 1. The two numeric annotations therefore shared a line. The same issue affected the left side.

The overall annotation now uses **1 + the maximum wall-axis row on its own preferred side**. A top opening produces chain 0 → wall 1 → overall 2; the left overall remains 1. Bottom/right openings do not inflate the top/left overall rows. A rectangle without openings keeps its previous overall row 1. Geometry, IDs, labels, units and public API are unchanged.

## Verification

- Four directional behavior cases added. **RED: 2 failures / 27 tests** (top and left); **GREEN: 27/27**, no skipped tests.
- Web type check and scoped lint pass.
- Fresh whole-file Stryker run in an isolated temporary copy, direct Node 24.19.0, one worker, no install and no mutation of shared source: **372 mutants; 344 killed, 1 timeout, 27 survived, 0 no-coverage, 0 errors; score 92.74%** (configured break threshold 80).
- The preferred-side / row calculation on lines 137–138 has **18 killed / 1 proven contract-equivalent survivor**. The new survivor removes only the wall-kind predicate: admitted opening/pier rows are all 0 and cannot change a maximum already seeded with 0. Side filtering, row arithmetic and lane extraction mutants are killed.
- Compared with the preserved historical 359-mutant report: **+13 mutants, +12 killed, +1 equivalent survivor, unchanged timeout count**.
- All 26 historical survivors were matched by function, original code and replacement to the previous individual triage. There are now 25 contract/resolver equivalents and the same two comparator variants observationally indistinguishable in pinned Node/V8. **Portable comparator equivalence is still not claimed**; no score-gaming production change was made.

Exact results are in `summary.json`, the full report and the per-survivor triage. The original and restored snapshot source hashes match: `5f42c5789b9584524e94a2eb8b051fc365206bf7f54fac5895134d8cc4fd8d94`. Test hash: `02429b546436e873af5af13ee260ddda2c35cc63f3583a8c551642365dad7710`.

The parent delivery directory retains the earlier 23-test / 359-mutant evidence as history. Browser row separation and the production PWA rebuild are verified by the root owner against this frozen helper.
