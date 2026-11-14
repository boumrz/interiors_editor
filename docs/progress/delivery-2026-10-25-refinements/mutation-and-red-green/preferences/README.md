# Dimension visibility helper — 2026-10-25

Only the two assigned repository files were created. The module imports a type only and uses injected read/write callbacks; it does not touch window, localStorage, Project, Revision or resources.

RED: the test file was added first and failed because the helper module was absent (`red.log`). GREEN: 17/17 tests, with all 32 checkbox combinations in the roundtrip case, independent filtering for each of the five kinds, exact 2047/2048/2049 string boundaries, strict v1 validation, fresh internal-only defaults, all-off retention, stable annotation identity/order/value, exact writes and throwing storage callbacks. Web type checking and scoped Biome lint pass.

Stryker ran against a fresh isolated source copy with direct pinned Node 24.19.0, one worker, no install and no mutation of shared source. 73 mutants: **69 killed, 0 timeout, 4 survived, 0 no-coverage, 0 errors; score 94.52%**, above the requested 70% break threshold. The four survivors only weaken the private object guard; exact envelope/version/own-boolean-field checks or the parser catch still return the same public result for every JSON value. Individual proofs are in `survivor-triage.json`.

Source SHA256: fe1d46cf5e07bd370bef54a33e8d7dc851ac0786d864ec36dc8b96f962099648 (matches restored snapshot). Test SHA256: 5111c35ac250ac8d45472c561ec92bfd8fecbbfe2fa60311b6a994b3e5ac4783. The exact isolated cwd, config and hashes are recorded in `snapshot-manifest.json`.
