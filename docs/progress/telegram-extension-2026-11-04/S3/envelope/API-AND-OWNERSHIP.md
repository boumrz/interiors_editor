# S3 envelope slice: ownership and API

This is an isolated implementation increment. It is not a declaration of Story 10.4, S3, PPJ, browser rollout, or physical Telegram acceptance.

## New transfer candidates only

- src/adapters/portable-backup/runtime-portable-backup-codec.ts
- src/adapters/portable-backup/runtime-portable-backup-codec.test.ts
- src/adapters/portable-backup/runtime-portable-backup-envelope-limits.test.ts
- stryker.runtime-portable-backup-codec.config.mjs

The previous eight `runtime-v1-*` codec/scanner/test/config files are frozen dependencies, already delivered separately. No existing serializer, PPJ parser/reader, ports, import/export use case, application factory, runtime, UI, manifest, dependency, or owner document is owned or edited by this increment. The original checkout is never used as an execution working directory. Dependencies are read through existing symlinks without installation. All commands and reports belong to `/tmp/interiors-tma-s3-pbj0s6f1/apps/web`.

## Production API

`RuntimePortableBackupCodec<TDomainReason extends string = string>` takes two mandatory constructor arguments: existing `BinaryChecksumPort` and `RuntimePortableProjectValidator<TDomainReason>`. There is no permissive validation default.

The validator receives `(project: RuntimeV1Project, signal: AbortSignal | undefined)` and returns or resolves `{kind:'accepted'} | {kind:'rejected',reasonCode:TDomainReason}`. It must be readonly and perform the current domain/host checks; it may return an extra narrowed `project` field, which the codec does not use or cast. It runs after closed V1/schema and current policy and before any resource digest. An application implementation can accept `unknown` and preserve a closed domain-reason union through constructor inference. The codec never imports an application validator or changes a Project.

`encode({project:unknown, createdAt:string, resources:readonly {resourceHash:string,bytes:Uint8Array}[]}, signal?)` resolves to:

- `encoded`: bytes, `mimeType:'application/zip'`, metadata;
- `rejected`: one exact canonical backup reason below;
- `project-validation-rejected`: the original `TDomainReason`.

`decode(archive:Uint8Array, signal?)` resolves to:

- `decoded`: `schema:'runtime-v1-wire'|'runtime-v1-legacy'`, honest `decodedProject:RuntimeV1Project`, exact project member bytes, separately owned resources retaining exact source hash spellings, metadata;
- either rejection above;
- `requires-ppj-validation`: a nonaccepted PPJ candidate, described below.

Metadata has `sourceProjectId`, `createdAt`, `projectSchemaId`, `projectSchemaVersion`. No generated Project/Revision ID, storage/pin/staging mutation or publication occurs. RuntimeV1Project deliberately preserves widened VariantValue rather than casting to current Project. Root owns current-runtime validation, exact copy/ID remap, fenced publication, port result mapping, and import/export orchestration.

Canonical reason union (12): `BACKUP_SCHEMA_UNREADABLE`, `BACKUP_PROJECT_LIMIT`, `BACKUP_PATH_UNSAFE`, `BACKUP_MANIFEST_INVALID`, `BACKUP_CHECKSUM_MISMATCH`, `BACKUP_RESOURCE_MISSING`, `BACKUP_CANCELLED`, `BACKUP_CONTAINER_UNSUPPORTED`, `BACKUP_CONTAINER_BYTES_LIMIT`, `BACKUP_ENTRY_LIMIT`, `BACKUP_UNPACKED_BYTES_LIMIT`, `BACKUP_COMPRESSION_RATIO`. Unexpected trusted checksum/validator implementation exceptions propagate; they are not relabeled as bad user files.

## Source and dispatch

Read original canonical `portable-backup-ingress-registry.md`, full AD-30 `telegram-portable-v1-disposition-2026-11-04.md`, `project-and-backup-contract.md`, and `ppj-a1-envelope-and-handoff.md`, including its owner correction on common control limits and unselected handoff. The actual observed/registered V1 manifest has exactly ELEVEN keys. No PPJ envelope schema is inferred from that V1 shape.

Wire writer uses runtime-v1-wire@1, exact Project member formatter, eleven-key manifest, closed checksum ledger, lower-digest resource paths, Project-first/sorted resource declarations, exact-spelling sorted mappings, independent exact source key verification before hash-case deduplication, and fixed-date single-disk STORE with ASCII names, known sizes/CRC, no descriptors/ZIP64/extra/comments. Before ZIP allocation it computes exact STORE length and checks caps; after writing it checks actual length. No old serializer is substituted for wire encoding.

Legacy acceptance requires a strictly absent Project root selector, the conservative observed old envelope with lowercase resource keys, closed exact V1 grammar, canonical historical Project bytes, and a positive PPJ-disjoint witness. Empty/ambiguous old files remain rejected with original bytes preserved. Tests show only synthetic old-exporter/old-reader recovery and wire upgrade; they do not prove an available owner recovery path or a physical build/file pair.

Known wire never falls into PPJ or legacy. Unknown wellformed selectors retain size/checksum before unknown-schema rejection and use the unchanged PPJ raw bounds. For the shared alpha selector, bounded nonaccepting lookahead can identify a PPJ candidate only; it does not claim schema acceptance. Early safe paths and control JSON are checked before candidate handoff; all unresolved PPJ boundary checks must be rerun by its validator.

## Honest PPJ handoff

Candidate result has `stage:'candidate'`, `checksumVerified:false`, an accurate subset of four checked stage names (`container-index`, `raw-paths`, `bounded-control-json`, `common-selector-header`), remaining check names, optional selector-header metadata without invented createdAt, declared Project byte length, safe indexed control-entry path/length metadata, immutable retained archive and optional already-read manifest/checksum-ledger snapshots. Each `.read()` returns a fresh byte copy. The archive retains the exact Project member. No checksum, PPJ AST/closed schema/domain/resource, full dispatch, or mapper success is claimed.

The common source-owned manifest hard limit is 1 MiB for every format; exceeding it returns BACKUP_MANIFEST_INVALID before opening that entry. The ledger has no separate registered byte cap. A tentative ledger exceeding the bounded 1 MiB local read strategy returns an UNSELECTED candidate without inflating it, only after the bounded manifest has been read and its proven generic syntax/shape faults handled. This is unavailable validation, not a ledger size rejection. A V1-only structural control-parser capacity fault also returns an unselected candidate, no fabricated metadata, and any control bytes already read; remaining checks include control read/source-owned bounds, JSON/common-header and route identification. These V1 Project AST bounds are not imposed as PPJ acceptance. Proven malformed raw control syntax/encoding/duplicates still returns the manifest fault. The full validator must reopen the immutable archive and establish its own early source-owned boundary before routing/acceptance.

The canonical companion explicitly leaves PPJ manifest/ledger/resource/proof bindings unfinished. Root must report unavailable validation/import while preserving the source if the full PPJ validator/mapper is absent; it must never convert this candidate to accepted, classify missing implementation as schema-invalid, or try V1 on PPJ failure. Oversize shared-selector candidates retain unchecked early PPJ gates instead of inventing a BACKUP_PROJECT_LIMIT after an unproven manifest boundary.

## Resource/security integration boundary

This codec proves exact resource keys, lengths, digest bits, alias byte equality, and archive integrity. It does not claim GLB/media/security/render acceptance. Root must perform those source-owned checks before publication without reducing the portable 50 MiB per-resource limit or changing current experimental import policy.

Existing `domain/static-glb-import.ts` hardcodes a 25 MiB limit at line 5 and exports `preflightStaticGlbImport(bytes)` without a policy parameter; parse/security helpers are private. `catalog-media-validator.ts` calls that same import preflight. `portable-backup-read-render-smoke.ts` also calls it and compares textual digest strings (uppercase aliases fail there). Therefore those existing APIs cannot be silently reused as a complete portable 50 MiB/hash-bit acceptance seam. No global custom-import limit changed here.

## Verification limits

The full STORE proof uses all current admissible 100 definitions, 600 vertices, 300 walls, 50 rooms, 200 openings, 250 items, exact 180 MiB resource bytes, and an exact 50 MiB entry. It includes maximum escaped identifiers, lone-UTF16 Project ID wrapper, own undefined, negative zero and nested VariantValue. Its artificial Plan is a grammar/size corpus with an explicitly accepted test validator, not a domain-valid Project or human-approved catalog asset. The earlier frozen member proof separately covers the structural 250-definition maximum, UTF16/undefined/variant families and independent AST capacities. Current policy rejects 101 definitions.

The test independently reads ZIP central/local headers, ASCII names, STORE methods, sizes, CRC32, absent extra/comments/descriptors, exact predicted length, then decodes and rehashes every resource and compares the Project. This proves executable capacity/integrity, not phone memory/time or NFR-28. The existing indexed ZIP reader and this codec take bounded snapshots; physical heap/streaming requirements and iOS/Android file handoff remain separate acceptance evidence.

## Executed full STORE metrics

`store-proof-metrics.json` records 103 entries, 193,853,020 unpacked bytes, 193,875,964 container bytes, 39,677 manifest bytes, 5,053,220 Project member bytes, 188,743,680 resource bytes and a largest entry of 52,428,800 bytes. Exact member metrics: 13,267 nodes, 10,516 members, 2,750 elements, depth 8, 2,619,969 decoded charge and 3,859,993 metadata charge. The independent encode/read/decode/re-hash proof passed, preserving the artificial source exactly.

## Cancellation integration

The codec and mandatory validator API honestly use native AbortSignal. The unchanged indexed PPJ entry port requires native AbortSignal, and its deflate reader polls it after internal event-loop yields while iterator.next() is pending. Root owns the concrete application adapter from CancellationSignalPort: preserve real native-signal fastpath; for plain structural signals use a live owned native-controller bridge with scoped polling during internal yields and finally cleanup, not a cast or one-time snapshot. No PPJ signal contract or staged-member event semantics changed here.

The source-owner control-bound clarification was applied through a fresh RED/GREEN increment after the last full mutation report. The full report therefore describes the pre-clarification candidate branch; focused mutation of every changed control line and related remaining-check labels supplies current-source evidence, without claiming a new whole-file score. Separate focused real-byte tests cover archive preallocation, provided-source byte caps, and current archive/resource policy.

Source owner subsequently confirmed BACKUP_MANIFEST_INVALID for the common >1 MiB manifest guard. Root also owns the distinct new-untrusted-custom-backup 25 MiB admission boundary before parse; the technical envelope 50 MiB cap does not authorize new 50 MiB custom admission. Root has a separately delivered GLB validation extraction; the baseline API observations above are not a claim that no current original-checkout seam exists. This isolated codec remains technical integrity only.

Final source fix: backupCreatedAt is snapshotted before the first asynchronous callback, so a mutable caller alias cannot change an already validated timestamp into an invalid self-unreadable archive. Fresh RED/GREEN logs prove the race and fix. Production is frozen at the SHA in transfer-new-files-sha256.json. No more in-place mutation or edits are scheduled.
