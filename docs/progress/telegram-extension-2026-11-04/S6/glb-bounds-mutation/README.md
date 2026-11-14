# Bounded local GLB reader verification

Frozen helper source SHA256: `41c102121c4e4ca2c4244b9307d29283bbcc77b1dffcf27fa2d8df8c855c7032`. Original source was never edited. Only an isolated copy was instrumented and restored.

- Baseline: root five behavior cases plus an independent active-mutant namespace assertion, all six passed.
- Historical M1 fullfile: 47 total, 46 killed, 0 timeout, 1 survivor, 97.87%.
- Survivor #26 (`size < 0` → `size <= 0`): exact manual RED exits 1 on the added zero-byte case; original restored.
- Final M2 fullfile: 47 total, 47 killed, 0 timeout, 0 survivor, 100%. Actual test command executes 11 cases; Stryker command runner displays one command as one test.
- Scoped TypeScript check and lint of the proof test pass. Broader snapshot TypeScript was not a passing gate: missing adjacent catalog fixture copies and a captured in-progress AppShell rejected-state property mismatch are retained in `typecheck.log`. No full root gate claim.

New behavior vectors: zero-byte File versus no selection, all valid repair members in order, invalid final metadata before any read, incorrect second file length stops subsequent reads, local read exception stops subsequent reads without partial result. Original 25/50/180 MiB and 900-entry boundaries remain tested. No production policy changes, memory limits widened, parser fallback, native device acceptance, Web/PWA regression, or SDK score claimed.

Only four proof files in `manifest.json` are offered for root integration. The test expects original base SHA82f274…; helper SHA41c102… remains unchanged. The scoped tsc config is verification-only. Root owns actual AppShell/native integration and all Web/PWA regression checks.
