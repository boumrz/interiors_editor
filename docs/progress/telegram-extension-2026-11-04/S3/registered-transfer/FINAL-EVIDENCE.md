# Final implementation handoff: explicit registered import and recovery formatter

The narrow implementation is ready for review and transfer from `handoff-v2/`. It is not an overall S3 or browser backup-readiness approval: the confirmed uppercase-resource browser roundtrip blocker below remains open in the parent integration scope.

## Files and ownership

`final-handoff-sha256.json` records the complete five-file manifest. Three production files are byte-identical to the earlier functional GREEN handoff; only the two test files were strengthened after mutation. Four existing owned files changed, one new test was added, and 558 of the 562 baseline existing files are byte-identical. Existing `project-controller-recovery.test.ts`, all application/domain ports and validators, codecs, PPJ, host runtime/UI, manifest/lock/build configuration and original checkout were not edited by this owner. No commit was made.

## Delivered behavior

- Explicit `controller.importRegisteredPortableBackup(bytes, {onStatus?, signal?})`; no decoder fallback, file-name inference or default browser route replacement.
- Optional shared `portable.registeredTransfer: {decoder, smoke}` composed through the same actual repository/resources/pin/IDs/checksums/clock and ordinary ImportPortableBackupUseCase.
- Browser production adds only that extra decoder/smoke. Old default Fflate exporter/encoder/import and old browser feasibility remain in place.
- Optional `portable.recoveryWriter` uses the existing exact-object archive writer for current-format decoded RecoveryDraft data, then the normal verified new-Project import. Writer absence retains legacy packaging. Canonical writer refusal is preserved; unavailability is `not-ready` and never falls back. Original unpublished file bytes stay distinct from the internally prepared transfer archive.
- `controller.exportProjectTransfer(projectId?, {signal?})` forwards the live signal after the asynchronous durable-source read. A local structural ProjectTransferExporter accepts the additional optional parameter; old one-argument browser exporter stays assignable and unchanged.

## Executed checks

- RED evidence: explicit method missing, production route unconfigured, empty draft legacy→registered incompatibility, and export signal not forwarded.
- Full final unit suite: 170 files / 2617 tests / zero failed or skipped PASS.
- App/domain type checks PASS; lint405 clean; pinned runtime Node24.19.0 and pnpm11.20.0 check PASS.
- Mutation in a separate snapshot: initial146 total /120 killed /26 survived /82.19%; after behavioral test strengthening the same146 total /137 killed /9 survived /93.84%, zero uncovered/timeouts/errors, existing break80 PASS.
- Additional tests cover the actual browser SHA port, pre-cancel no-progress behavior, cancellation between verified decode and its caller continuation, optional status callback without a signal, no late second import, old encoder exception/refusal reasons, exact uppercase RecoveryDraft resource spelling, real runtime formatter cancellation after source load, and retained old browser policy failure.
- `mutation-survivor-triage.json` maps every remaining survivor to exact locations. Four V1 guard mutants are unreachable after the direct current-format decoder; three encoder-fallback mutants are ruled out by captured initial readiness; two canceled-kind mutants are redundant for real monotonic cancellation. No equivalence claim is made for an arbitrary nonmonotonic structural signal getter.
- Mutation restored its separate source copy; every production SHA matches the frozen handoff. The original live dist/origin/processes were untouched.

## Confirmed integration blocker

A separate failing real-code probe imports valid runtime-v1-wire data with an uppercase original resource hash through the additional browser route, publishes Durable with exact bytes under that raw key, then the unchanged legacy browser exporter returns PORTABLE_BACKUP_RESOURCES_UNAVAILABLE. `KNOWN-BROWSER-ROUNDTRIP-BLOCKER.md`, `browser-alias-probe-exact.log` and the separate probe workspace record the evidence. The parent owns the source/admission/export route reconciliation. No normalization, fallback, policy override or false passing assertion was added here.

UI integration, real Telegram/device delivery and import matrix, NFR-28 and full PPJ validation remain outside this narrow unit implementation. The method and composition tests alone do not waive those gates.
