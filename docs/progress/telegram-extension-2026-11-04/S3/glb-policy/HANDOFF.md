# S3 bounded GLB technical seam handoff — 2026-11-04

Implemented only the four assigned existing files in an isolated copy. The original checkout, dependencies, manifests, build/deployment configuration and product entry points were not edited. No commit, upload, server, catalog/library admission change or renderer integration.

Workspace: `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-portable-glb-js5f1uew/apps/web`.
Frozen review/copy tree: `/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-portable-glb-handoff-vhwb2b7a` (four source files plus SHA256.json and mutation-summary.json).
Review diff: `/tmp/interiors-tma-portable-glb-review-final.diff`.

## API and preserved behavior

- `createStaticGlbResourcePreflight({ maximumInputBytes })` captures a positive safe integer not above 50 MiB and returns the same existing static GLB checks with that explicit byte cap. Invalid trusted configuration throws RangeError. The public `preflightStaticGlbImport(bytes)` still uses hard 25 MiB before parsing; all deeper parser, URI/static-scene/extension, geometry and texture security helpers are unchanged.
- `PortableBackupReadRenderSmokeCheck` accepts optional trusted `resourcePolicy: { maximumInputBytes, hashComparison: "sha256-bits" }`. Without it, existing browser/PWA behavior remains 25 MiB and raw string digest comparison. The explicit mode checks all supplied original-key profile metadata (per-resource maximum, 180 MiB sum, 900 entries) before the first byte snapshot/hash, retains case-sensitive keys, and checks each referenced key independently using strict 64 ASCII hex and all 256 SHA bits. Project/source bytes are not normalized or modified.

Architecture read in full: `telegram-portable-v1-disposition-2026-11-04.md` §“Техническая GLB-проверка и действующая admission policy” lines 96–108 and updated AD-30. This seam is a technical resource preflight only. A 50 MiB success is not custom admission, decoded/GPU/no-network/device proof, or permission for Durable publication. New/untrusted custom admission remains subject to applicable 25 MiB until source-owner clarification; exact repair also retains the applicable security policy. Mandatory registered-route selection, all applicable pre-parse guards, alias pipeline/reopen/hydration/export/repair and device/memory evidence remain integration work owned by root.

## TDD and verification

- `/tmp/interiors-tma-portable-glb-domain-red.log`: initial factory absent, new behavior RED (4 failures, old 13 tests PASS).
- `/tmp/interiors-tma-portable-glb-smoke-red.log`: explicit policy not implemented, new behavior RED (5 failures, 11 PASS).
- `/tmp/interiors-tma-portable-glb-survivor-red.log`: recreated duplicate-key and strict-180-boundary mutants; both new assertions RED before restoring production.
- `/tmp/interiors-tma-portable-glb-early-rejection-red.log`: recreated always-reject preflight; snapshot test now fails immediately on completed-before-hash rather than hanging.
- `/tmp/interiors-tma-portable-glb-final-green.log`: 61/61 PASS across static GLB, portable smoke, existing catalog-media and existing custom-GLB application tests, serialized one Rstest worker. Final mutation dry run repeats the same suite successfully.
- `/tmp/interiors-tma-portable-glb-final-types.log`: strict scoped TypeScript PASS, four owned files plus resolved dependencies.
- `/tmp/interiors-tma-portable-glb-final-lint.log`: scoped Biome lint PASS. Formatting was restricted to owned four files.
- Node 24.19.0 / pnpm 11.20.0 pinned. No test framework/config/dependency changes. Missing copied monorepo media fixtures were supplied by a read-only `contracts` symlink in the isolated root.

Boundary/security coverage: valid aligned GLBs at exact 25 MiB, 25 MiB+4 and 50 MiB; +1 guards before malformed parsing (a valid GLB must be 4-byte aligned); default/catalog remain 25 MiB. Explicit profile >50/180/900 refuses before any slice/hash. Exact 180 MiB original-key alias profile remains accepted by the technical check before dedup. URI/data URI, malformed/future GLB, animation/skin/camera, unsupported extensions and existing node/primitive/material/texture/geometry/pixel limits remain checked across all policy modes. Native Web Crypto SHA tests cover lower/upper aliases independently, missing aliases, corrupted bytes, malformed/changed digest bits and preservation of original keys. Large boundary tests use injected deterministic checksum ports; they do not claim physical decode/render/security of large GLBs. Cold profile has no pinned-store dependency, snapshots bytes across a delayed hash and retains no resources for the next call.

## Mutation evidence and exhaustive survivor disposition

Initial report: `reports/mutation/portable-glb-policy-initial.json`: 191 total, 169 Killed, 17 Timeout, 5 Survived. Timeouts were a test wait defect: snapshot test waited only for a digest that rejected preflight never invokes. It now races digest entry against operation completion; no production workaround. Exact-key duplicate rejection was previously masked by a missing-alias refusal; the new vector uses a complete one-reference Project. Added a real exact-180-MiB original-key alias profile.

Final report: `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-portable-glb-js5f1uew/apps/web/reports/mutation/portable-glb-policy-final.json`.
Final log: `/tmp/interiors-tma-portable-glb-mutation-final.log`.
Final 191 mutants: **188 Killed, 0 Timeout, 3 Survived, 0 NoCoverage, 0 errors (98.43%)**. Scope is `static-glb-import.ts:1-125` (entry/policy/shared checks) and all smoke.ts; unchanged deep GLB parser/image helpers were exercised by the test suite but not newly mutation-tested.

- Smoke ID14 (line52), domain ID127 (line67): only RangeError diagnostic wording becomes empty. Public behavior/type and rejection timing remain asserted; wording is not a stable contract. No wording-only test added.
- Smoke ID64 (line116): `resources.length > 900` becomes `>= 900`. This changes behavior for an arbitrary externally constructed 900-entry profile, so it is not globally equivalent. The registered V1 route applies at most 100 asset definitions and exact resource linkage before smoke; an admitted profile cannot reach 900 keys. The over-900 fail-before-copy defense is tested. No artificial successful Project with hundreds of extra unreferenced bytes was adopted as product behavior. This bounded applicability remains explicit.

Independent read-only review by contract_audit of frozen two production files found no confirmed new bounded bug. No full Telegram readiness or end-to-end portability claim.

## Exact handoff hashes

- `src/domain/static-glb-import.ts`: `ed055865178a1f166952784093cef8391e2ae5e1e0de356adffe971388b9107f`
- `src/domain/static-glb-import.test.ts`: `3dbb7b466c83a62c7e23300f0352fb7308e6ab89aa1cd3a1bdc0f6fd111840bf`
- `src/adapters/portable-backup/portable-backup-read-render-smoke.ts`: `4d6546dd195e967cabbd73aa630c842391f61aa06d9dd6d460eb865db61bfe14`
- `src/adapters/portable-backup/portable-backup-read-render-smoke.test.ts`: `0f6f0a387ca3eba80755fb2febef71053e07a686e526374d505b874b51ce3618`

All four hashes matched the pre-mutation snapshot after final Stryker restoration. Root remains the sole owner of original checkout integration; copy only these four files after review.
