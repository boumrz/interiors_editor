Current final row-spacing evidence: [lane-fix/README.md](lane-fix/README.md). The earlier 23-test / 359-mutant snapshot below is preserved as historical evidence.

# DrawingDimensions-RU delivery, 2026-10-25

23 public-API behavior tests pass. Initial RED was a missing module; subsequent GREEN covers axes/clear/outer references, chain sums, signed/reversed geometry, odd dimensions, actual butt-cap witnesses, concavity, legacy thickness, deterministic ordering, read-only input and exact data-budget edges. TypeScript web project check and scoped Biome lint pass.

Stryker ran against an isolated source copy with direct pinned Node 24.19.0, never against shared source and never using pnpm exec/install inside the copy. Full final report: 332 killed, 1 timeout, 26 survived, 0 no-coverage, 0 errors; score 92.76%. Strengthened tests observably killed 18 manually reproduced survivors from the initial run. Source SHA is recorded before/after restoration.

24 surviving variants are equivalent within the published API contract or the real domain-resolver postconditions. Two comparator variants (356, 358) remain observationally indistinguishable in the pinned Node/V8 harness; portable equivalence across browser sort engines is **not** claimed. They are explicitly retained as a harness limitation. Original production comparator is a proper three-way comparator; no production defect was found from these variants. See survivor-triage.json for individual evidence, not a blanket 100% claim.

Tests and mutation reports cover the pure data projection. Screen layout, text collision policy, pointer transparency, zoom/pan and PWA behavior remain in the root-owned browser verification scope. Research and applicability limits are documented in docs/research/DRAWING-DIMENSIONS-RU-2026-10-25.md.
