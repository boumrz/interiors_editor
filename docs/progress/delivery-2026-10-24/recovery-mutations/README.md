# Recovery and resource mutation verification

Observed on 2026-10-24 with Node 24.19.0, pnpm 11.20.0, Rstest 0.11.5 and Stryker 9.6.1. All mutation runs used independent real source copies; the shared checkout was never instrumented. Source SHA-256 manifests and losslessly compressed original JSON reports accompany [summary.json](summary.json). Both compressed and original report hashes are recorded; `gzip -dc final-codec-report.json.gz` recovers the exact JSON bytes.

| Final separate run | Killed | Timeout | Survived | Raw score |
| --- | ---: | ---: | ---: | ---: |
| Recovery codec | 399 | 1 | 90 | 81.63% |
| Controller recovery methods | 294 | 0 | 45 | 86.73% |
| Resource store, pin reconciliation, library registration | 146 | 0 | 8 | 94.81% |
| GLB/backup publication and restart | 95 | 0 | 8 | 92.23% |

Every run passed its configured 80% threshold. These are separate scopes, with different test snapshots. There is no combined whole-package score or claim of 100% coverage. Timeouts remain timeouts and survivors remain survivors.

After the final full codec run, five useful test gaps were strengthened: missing embedded resources despite a complete flag, an individual 51 MiB resource declaration, same-length whitespace in padded base64, caller buffer changes during asynchronous verification, and excessive object nesting. Six exact prior surviving mutations were then recreated in a fresh isolated copy. The unchanged source passed; all six mutated copies failed the new tests. [The individual logs and replacement metadata](codec-survivor-regressions/results.json) record this supplementary evidence. The observed full codec score remains 81.63%.

Final ordinary verification passed: 1,834 tests in 133 files, both TypeScript configurations, full `src tests` lint, and five scope-resolver tests. The public-flow regression for history corruption followed by current corruption fails before the one-line diagnostic reset and passes afterwards through single-file, batch and Portable Backup repair. It also verifies that repairing the current model restores the separate history issue, then exact history repair permits Undo back to the original revision.

## Repeating the focused scopes

Run from `apps/web` with the pinned runtime, using the corresponding file:

```sh
node ./node_modules/@stryker-mutator/core/bin/stryker.js run stryker.recovery-codec.config.mjs
node ./node_modules/@stryker-mutator/core/bin/stryker.js run stryker.recovery-controller.config.mjs
node ./node_modules/@stryker-mutator/core/bin/stryker.js run stryker.recovery-resources.config.mjs
node ./node_modules/@stryker-mutator/core/bin/stryker.js run stryker.recovery-publication.config.mjs
```

The TypeScript 7 harness uses Stryker `inPlace`. Use a disposable source copy when another process or agent may edit the checkout. Each scope resolves unique source anchors at load time, so inserted lines cannot silently move the mutation target. Missing or duplicate anchors and nonexistent test filters cause an immediate error. Registration tests are in `create-custom-glb-floor-item.test.ts`; no separate nonexistent registration test file is credited.

## Limits retained in the delivery

- Unknown and superseded staging roots remain protected. Global orphan resource collection still needs a proof covering live writers, every durable Project, history and library roots.
- Recovery restoration supports the current V1 Project format. Unsupported V2 recovery export is rejected. A draft that explicitly lacks resources preserves pending work but cannot be restored as a complete backup.
- Remaining codec survivors are not all proven equivalent. Some change rejection timing or reason codes. The JSON string-budget boundary above 66.7 MiB remains an explicit future test gap because of its memory cost.
- Several copies in the IndexedDB adapter are redundant under IndexedDB structured cloning; the raw survivors are still reported. No failing production scenario was demonstrated for them.
- Catalog-card removal preserves Project/history resources and a durable suppression tombstone. Removing by asset identifier assumes unique identifiers across imported cards; a hash-addressed API would remove that ambiguity.
- These checks do not establish physical-device performance or PWA acceptance on a real phone.
