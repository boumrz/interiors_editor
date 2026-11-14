# S3 isolated Project-member slice

Implemented the registered runtime-v1-wire Project writer/reader, conservative legacy reader and bounded V1-only raw scanner in two new production modules. Source clocks/IDs, own undefined versus absence, negative zero, UTF-16 wrappers, exact nested variants, array order and nested record key order are preserved. Root/level writing follows the fixed historical order. The source model, internal serializer/checksum, PPJ, ZIP, storage, runtime and UI were not changed.

The legacy path requires full closed grammar, exact historical canonical byte equality and one registered PPJ-disjoint witness. It rejects ambiguous empty/no-witness shapes, trailing bytes, alternate root order and wrappers. This does not authenticate a producer or establish recovery for sole-copy files.

Verification on Node 24.19.0 with actual pnpm 11.20.0:

- Full snapshot unit suite: 153 files, 2274 tests pass, zero skips.
- New slice: five test files, 199 tests.
- Full lint: 366 files pass.
- App and domain TypeScript projects pass.
- All 509 existing snapshot files retain their baseline SHA-256 hashes.
- Full initial and seven focused automated Stryker reports are retained. Survivor interpretation and explicit limitations are in mutation-triage.json and API-and-source-ownership.md; there is no invented fresh full-scope score.

Four executable maximum Project corpora include all collection caps, strings of 256 units, wrappers, optional markers, negative zero and five nested variant arrays. The largest encoded Project is 6,333,970 bytes; maximum measured decoded charge is 6,142,009 bytes and metadata charge 7,851,328 bytes. All remain below the adopted conservative bounds. Independent raw corpora exercise inclusive 10MiB bytes, depth 8, 65536 nodes, 49152 members, 24576 array elements, pointer 128 bytes, token 64 bytes, exact 8MiB decoded charge and exact 16MiB metadata, plus the first rejected value. The per-string charge boundary advances in multiples of three.

Error precedence has explicit RED/GREEN evidence for numeric grammar at capacity and early invalid wrappers followed by raw capacity. Valid wrapper admission still rejects the exact 5754th maximum wrapper before later syntax or EOF, so capacity cannot be downgraded to a pending schema failure.

Only the eight new files in transfer-inventory.json should be copied for root review/integration. Reports are evidence, not application modules. No files were automatically copied to the original checkout, no commits were made, and no user files were uploaded. Archive binding, checksum dispatch, domain/host/resource/policy checks, publication/reopen and physical client acceptance remain separate parent-owned work.
