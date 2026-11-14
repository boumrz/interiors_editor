# Registered browser ingress and optional RecoveryDraft writer — GREEN handoff

Implementation owner: /root/baseline_audit. Changes were made only in `/tmp/interiors-tma-registered-transfer-xnkbxhq1/apps/web`; original checkout, application ports, codecs, runtime host, UI, package/lock/build configuration and existing recovery tests were not edited by this owner.

The immutable `handoff/` contains three production files, the changed shared-controller tests and one new browser-production composition test. `frozen-handoff-sha256.json` records exact SHA-256, size and original-baseline checks before transfer. 558 of 562 existing snapshot files remain byte-identical; four existing owned files changed and one test file was added.

## API and behavior

- `controller.importRegisteredPortableBackup(bytes, {onStatus?, signal?})` selects only the explicitly injected registered importer. It shares the default import's publication guard, callback handling, state publication and failure cleanup; it never retries another decoder.
- `SharedProjectControllerDependencies.portable.registeredTransfer?` contains only the additional `decoder` and `smoke`. Both import use cases receive the same actual publication repository, resources, pin journal, IDs, checksums, clock and serializer.
- Browser production composition adds this route. Existing Fflate encoder/exporter/default decoder/smoke and recovery defaults remain in place. The additional registered route does not inject `registered.feasibility`; the existing browser publication policy can still refuse a candidate.
- `portable.recoveryWriter?` uses the existing archive-writer port. When explicitly supplied, `importRecoveryDraft` packages the successfully decoded current-format draft object, exact decoded resources and revision timestamp through that writer before normal verified new-Project import. No writer means the existing legacy packaging remains. Writer refusal retains its canonical reason; writer unavailability returns `not-ready` with no old-encoder fallback. This is an internal import step, not a relabeling of an unpublished file as a complete backup.
- `controller.exportProjectTransfer(projectId?, {signal?})` forwards the live signal after the durable-source load to the actual injected formatter. Local structural `ProjectTransferExporter` permits its second optional argument; existing one-argument browser exporter remains assignable. No core exporter change or invented cancellation guarantee was added.

## Executed evidence

- `red-explicit-route.log`: explicit method absent; owner write/publication was not guessed.
- `red-production-wiring.log`: actual browser production composition returned `not-ready` before the registered decoder was added.
- `red-recovery-export.log`: optional recovery writer was ignored and empty draft failed with `BACKUP_SCHEMA_UNREADABLE`; export did not forward cancellation.
- Targeted GREEN: actual registered wire codec, real SHA-256, fenced memory repository, exact resource/pin paths, new identity, old import/export, PPJ unavailable without fallback, unknown schema, cancellation, shared busy guard, decoder throw cleanup, browser feasibility refusal preserving the lone UTF-16 string, empty RecoveryDraft wire roundtrip, writer refusal/unavailability, and actual runtime formatter cancellation after asynchronous source load.
- Full unit GREEN: 170 files, 2613 tests, zero failed/skipped.
- App and domain type checks PASS. Lint: 405 files, no warnings.

## Remaining verification

Mutation is running in a separate source copy recorded in `mutation-workspace.json`; the handoff is functionally GREEN but does not yet claim final mutation acceptance. Browser/TMA UI integration, real-device delivery/import matrix, release regression and full PPJ validation remain owned by the parent integration scope. No physical Telegram proof or NFR-28 conclusion is implied by these unit checks.
