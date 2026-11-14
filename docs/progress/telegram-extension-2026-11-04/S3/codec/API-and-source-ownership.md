# Isolated S3 V1 Project codec

Implementation owner: baseline_audit. Location: `/tmp/interiors-tma-s3-pbj0s6f1/apps/web` only. These are new standalone files for parent review; they have not been copied into the original checkout, committed, wired to a runtime, or accepted as a complete S3 rollout.

Source contract read from the original checkout:

- `_bmad-output/specs/spec-interiors-editor-alpha/portable-backup-ingress-registry.md`, registered V1 routes and AD-30 adoption.
- `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-portable-v1-disposition-2026-11-04.md`, entire disposition, especially closed record grammar, exact-value rules, bounded scanner and conservative legacy witness.

No source-owner documents, package manifests, locks, internal Project serializer, PPJ grammar/parser, ZIP codec, ports, runtime, UI, DB or existing tests/config were edited. The one new Stryker configuration targets only the two new production modules. Existing-file SHA-256 comparison is in `existing-files-integrity.json`.

## APIs

`runtime-v1-wire.ts` exports:

- `encodeRuntimeV1Project(project: unknown): RuntimeV1EncodeResult` — `encoded` contains bytes and scanner metrics; invalid or unsupported snapshots return `rejected`.
- `decodeRuntimeV1Project(bytes: Uint8Array): RuntimeV1DecodeResult` — only the exact registered wire selector; returns `decoded` with the exact validated V1 snapshot and metrics.
- `decodeRuntimeV1LegacyProject(bytes: Uint8Array): RuntimeV1DecodeResult` — selector must be absent; full closed V1 decode, exact historical canonical byte equality and a registered PPJ-disjoint witness are all required. No fallback or provenance claim.
- `RuntimeV1Project`, `RuntimeV1VariantValue`, result unions and `RUNTIME_V1_SCHEMA_ID`.

`RuntimeV1Project` intentionally widens only `colorVariantId` to a closed recursive singleton-array variant value. It does not pretend to be the narrower current domain `Project` interface. All other registered values preserve own optional-undefined presence, negative zero, UTF-16 code units, array order and nested record key order. Root and level writer order matches the historical serializer. Decoder performs no sorting, trimming, case folding, yaw rounding, clock generation, ID generation or resource access.

`runtime-v1-raw-scanner.ts` exports the separate `scanRuntimeV1Json` non-accepting scanner, bounded node/parent/source spans, `runtimeV1Pointer`, metrics and exact UTF-16 wrapper helpers. A scanned JSON document is not an accepted Project. No `JSON.parse` or PPJ parser is used. Raw UTF-8/syntax and duplicate events are checked while traversing; earlier capacity failure is preserved. Invalid wrapper schema is held pending until raw traversal completes, while valid wrapper decoded charge is admitted immediately. Capacity errors are never swallowed as pending schema errors. Shape, base64 syntax/size and pad bits are checked before bounded UTF-16 semantic inspection; no invalid Project is materialized.

Both codec failure branches use only `BACKUP_SCHEMA_UNREADABLE` and `BACKUP_PROJECT_LIMIT`.

## Integration boundary retained by parent

Parent owns safe container paths and sizes, manifest/ledger bounded syntax and exact bindings, Project checksum before scanning/dispatch, root/manifest source ID equality, single dispatch including PPJ, complete downstream policy/domain/topology/host/resource validation, STORE ZIP envelope, hash alias resource handling, copy-on-write publication and reopen checks. These Project-member APIs do not establish any of those facts. They do not publish or modify data. Existing browser export remains available until the separate rollout gate.

The maximum corpora are synthetic Project-member proofs, not user file compatibility or physical device evidence. Definition byteLength may reach the structural MAX_SAFE_INTEGER bound in the corpus; the stricter resource policy remains a downstream rejection before publication. Ambiguous legacy is rejected with source bytes untouched. Sole-copy recovery and physical Telegram/Web/PWA compatibility are not claimed.

## Reproducible checks

Use actual Node 24.19.0 and pnpm 11.20.0. In this snapshot dependencies are a read-only-in-practice symlink; `pnpm --config.verifyDepsBeforeRun=false exec ...` prevents pnpm's workspace-path dependency verification from attempting an install. No install is needed or allowed for this slice.

- `pnpm --config.verifyDepsBeforeRun=false exec rstest run --config rstest.config.mjs` (full snapshot suite).
- Add `--reporter verbose --silent false` for the worst-case metrics records, captured in `worst-case-metrics.log` and extracted into `worst-case-metrics.json`.
- `pnpm --config.verifyDepsBeforeRun=false exec tsc --noEmit -p tsconfig.json`
- `pnpm --config.verifyDepsBeforeRun=false exec biome lint src/adapters/portable-backup/runtime-v1-*`
- `pnpm --config.verifyDepsBeforeRun=false exec stryker run stryker.runtime-v1-wire.config.mjs`

RED evidence: `red.log`, `red-numeric-event.log`, `red-writer-boundary.log`. GREEN, lint, typecheck and mutation evidence are kept separately. An initial Stryker dry run without actual pnpm failed the existing runtime user-agent check, made no acceptance claim and restored its files. A serial run was explicitly interrupted to restart the full scope with four isolated command-runner workers; it is not a completed mutation result.

Additional RED evidence is in `red-leading-zero.log` and `red-wrapper-stage-order.log`. The final full snapshot result is 153 files / 2274 passing tests / zero skipped; the five new test files contribute 199 tests. Full lint checks 366 files; both app and domain TypeScript projects pass. Final SHA-256 comparison confirms all 509 pre-existing snapshot files unchanged, including package/config/PPJ/internal serializer files. `transfer-inventory.json` lists exactly the eight new code/test/config files with their hashes; reports are separate evidence.

The full initial Stryker run generated 1363 mutants (1070 killed, 21 timeouts, 272 survived). Strengthened tests and focused subsequent runs are preserved individually; `mutation-triage.json` maps surviving identities to the final source and documents equivalence or redundant defenses. It is not presented as a fresh full-scope final mutation score. The two later scanner changes (leading-zero syntax priority and pending wrapper schema/pad bits) were explicitly replayed in targeted scopes. The final capacity-catch scope kills all seven mutants. Remaining source-allocation optimizations are retained production defenses; their exact early allocation timing for every unsupported JS input is not independently mutation-proven. Closed valid Project bounds, raw scanner caps and final closed validation are proved separately; no 100% mutation/coverage gate is invented.

The first focused column-range pass used report columns as if they were CLI columns. Stryker CLI columns are zero-based; report columns are one-based. `mutation-missing.json` rechecks all missed original survivor ranges with corrected columns; the scope audit found zero uncovered original survivors. The captured historic configuration is `mutation-scope-config-history.txt`. The final small configuration defaults to both complete new production modules; `S3_MUTATE` (comma-separated ranges) and `S3_MUTATION_REPORT` reproduce focused scopes without changing the default.

No build, browser server, live preview, physical device acceptance, archive-envelope integration or final S3-wide READY is claimed. Those remain with the parent implementation owner. There is no unresolved codec behavior blocker identified by this slice; the wider integration and physical evidence remain outstanding.
