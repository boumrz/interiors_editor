# S3 exact resource SHA-bit comparison handoff — 2026-11-04

Only the agreed six files were edited/created in an isolated copy. No edits to original checkout, ports.ts, ProjectController, import/export use cases, repository, AppShell, shared factory, smoke, GLB policy, manifests/config/dependencies, servers or commits.

Workspace: `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-resource-hash-2d_k50x3/apps/web`.
Frozen six-file handoff tree: `/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-resource-hash-handoff-x87q82z9` (contains SHA256.json, mutation-summary.json).
Review diff: `/tmp/interiors-tma-resource-hash-review.diff`.

## API and behavior

New pure `src/domain/resource-hash.ts` exports:

- `isSha256ResourceHash(value: string): boolean`: exactly 64 ASCII hex.
- `sameSha256ResourceHashBits(expected: string, actual: string): boolean`: validates both strings and compares every decoded byte (all 256 bits), retaining caller keys/spelling unchanged. This is resource-only, not a Revision-checksum compatibility rule.

`application/backup-feasibility-policy.ts` checks the resource-key grammar before exact-key I/O and compares the computed binary-resource SHA using the helper. Each lower/upper/mixed original key is independently read and verified. Metadata-only historical feasibility without resource ports stays unchanged, including its opaque test declarations; Revision checksums are not revalidated or reinterpreted. Existing envelope counts/byte limits and errors stay unchanged.

`app/project-recovery.ts` accepts strict mixed-case resource keys at export instead of the former lowercase-only check, uses bit comparison only at resource digest checks in export/decode, and retains independent exact-key reads, byte-length checks, raw candidate keys, completeness/missing-key reporting, cancellation, recovery-projection exact-key addressing and existing draft grammar. Revision checksum comparison stays literal, with no 64-hex requirement. No key folding, fuzzy lookup, alias dedup, overwrite, storage mutation or new asset admission was added. Existing JSON recovery-draft representation limits are unchanged; this is not a new V1-wire codec or a full portability proof.

AD30 and the full technical-GLB section 96–108 were read. This resource-only change does not change default browser/custom 25 MiB, add GLB/decode/render permissions, or establish the full registered alias pipeline through publication/reopen/hydration/export/repair. Those root-owned paths remain separate work.

## TDD and checks

- Helper RED: `/tmp/interiors-tma-resource-hash-helper-red.log` (missing module); GREEN: helper-green.log.
- Feasibility RED: `/tmp/interiors-tma-resource-hash-feasibility-red.log` (2 new failures/3 PASS); GREEN includes existing SessionRetention repository tests.
- Recovery RED: `/tmp/interiors-tma-resource-hash-recovery-red.log` (3 new failures/21 PASS).
- Surviving decoded-length guard reproduced RED: `/tmp/interiors-tma-resource-hash-length-red.log`. A malicious draft had correct SHA for its bytes and exactly the declared base64 character count, but decoded bytes were +1/+2 long. The new test distinguishes exact decoded length from hash/encoded-length validation; production guard already rejected it.
- Final `/tmp/interiors-tma-resource-hash-final-green.log`: **43/43 PASS** across helper, feasibility, recovery and existing SessionRetention repository tests.
- Final strict scoped TypeScript PASS: `/tmp/interiors-tma-resource-hash-final-types.log`.
- Final scoped Biome lint PASS: `/tmp/interiors-tma-resource-hash-final-lint.log`; formatting restricted to owned files.
- Pinned Node24.19.0/pnpm11.20.0, existing Rstest config, one worker. No dependency/config edits.

Native Web Crypto tests verify all original lower/upper/mixed aliases independently; missing, corrupt and wrong-length aliases cannot borrow healthy case copies. Malformed expected/computed digest forms and every one of the 256 changed digest bits are rejected. Recovery roundtrip preserves exact original keys and an opaque Revision checksum; a different-case Revision checksum remains rejected. Aggregate feasibility counts original case keys before any archive dedup and refuses >180 MiB before resource reads. The existing snapshot test now races digest entry against early completion so rejected mutants fail promptly instead of hanging.

## Meaningful mutation scope and exhaustive survivors

Installed Stryker9.6.1 command runner; full new helper, feasibility exact pinned-resource function, and narrowly changed recovery resource conditions. Explicit ranges: helper all; backup-feasibility-policy.ts:102–125; project-recovery.ts:147,166–173,242–250,270–281. Unchanged recovery parser, JSON/base64 writers, geometry and all other policy functions are outside this targeted mutation scope.

Initial report `reports/mutation/resource-hash-pipeline-initial.json`: 90 total,87 Killed,0 Timeout,3 Survived. Added the meaningful decoded-length vector above.

Final `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-resource-hash-2d_k50x3/apps/web/reports/mutation/resource-hash-pipeline-final.json`: **90 total,88 Killed,0 Timeout,2 Survived,0 NoCoverage,0 errors (97.78%)**. Pure helper **26/26 Killed**. Final log: `/tmp/interiors-tma-resource-hash-mutation-final.log`.

- Recovery ID28, line248: makes the second duplicate-definition length predicate always true, rejecting a repeated exact resource key even at equal length. This changes behavior for manually constructed invalid source candidates; it is not globally equivalent. Registered V1 `isAssetDefinitionRefs` forbids duplicate exact raw hashes, so an admitted Project cannot reach that repeated-key branch. Different-case aliases remain distinct and have positive/negative coverage. Existing contradictory duplicate-length refusal remains tested. No invalid duplicate-key Project was adopted as a desired successful product case.
- Feasibility ID62, lines122–124: removes `return false` from the private catch, yielding undefined. The sole caller is `!(await hasExactPinnedResources(...))`, which rejects both values identically; both read/hash exceptions have public negative tests. This is bounded call-graph equivalence, not a claim that false and undefined are interchangeable APIs.

## SHA handoff

- `src/domain/resource-hash.ts`: `fa0c023f2c0417d24e4ccae823b30c4fb027a61fdcf2eee60d6a2e0be159f480`
- `src/domain/resource-hash.test.ts`: `fe7163aade1cd366bd405a24305d06a6c7ea47462a8cc6bbb458a36fa9815536`
- `src/application/backup-feasibility-policy.ts`: `2d35ea61458f319856f5e0c905f9fbcb5b2d3816d4e0a263d6eb7bb68d7aa492`
- `src/application/backup-feasibility-policy.test.ts`: `975ed895972a509210754690d67c2fa2219a1069d8c630e65f66eab32556aae2`
- `src/app/project-recovery.ts`: `b38675c9201fda8c6c2d9812c183b079a096a93a32ce80fecd1e98714a7a72d8`
- `src/app/project-recovery.test.ts`: `72f750cdc5d7e124ec40d64a367c7a815df26cfd1d58f50a6e0c236f94081b94`

All six source hashes matched their pre-mutation snapshots after Stryker restoration. Root remains sole original integration owner. Copy only the six named files after review.
