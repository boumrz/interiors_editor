---
title: "S-2 measurement/projections and legacy/ingress detached assessment"
date: 2026-08-30
status: final
gate: G-S2-topology
verdict: NOT_PASS
authority: bounded readiness evidence spike waiver W-READY-2026-08-30
reviewer: Roman Zheltov (appointed; outcome not recorded by this evidence package)
---

# Result: NOT PASS

The package has preserved six raw candidate inputs, their SHA-256 identities
and current supporting-test output.  It cannot turn them into source-valid
TCC-A1 fixtures because the only adopted runner lacks both outcome protocols.
This is a bounded evidence finding; no product source, source contract or
shared manifest was edited.

| Family | Raw candidate IDs | Current observation | TCC-A1 disposition |
| --- | --- | --- | --- |
| Measurement/projections | `TCC-A1-MEASURE-001..003` | direct Distance, stale rejection and formatting tests pass | `not-executable-as-tcc-a1` |
| Legacy/ingress boundary | `TCC-A1-LEGACY-001..003` | historical V1→V2 and PPJ parser tests pass | `not-executable-as-tcc-a1` |

The immutable candidate manifest is
[measurement-legacy-detached-manifest-2026-08-30.json](../../../../../../implementation-artifacts/spikes/W-READY-2026-08-30/S-2/measurement-legacy/fixtures/measurement-legacy-detached-manifest-2026-08-30.json).
It intentionally gives a supporting expected observation only where current
code has one; it does not invent an `accepted`, `rejected`, `transient` or
legacy-classification outcome that the adopted executor cannot produce.

## Exact blocker

`apps/web/src/domain/tcc-a1-corpus-runner.ts` declares only
`executorRole: domain-kernel`; its outcomes permit four geometry rejections and
three materialization transients.  The TCC-A1 contract requires an outcome for
measurement/projection observations and a separate `legacy-classifier` role.
No raw V1/V2 grammar exists in the source-owned registry.  Therefore a
detached duplicate executor would create a second authority, and treating the
historical `migrateProjectV1ToV2` object transformation as a current raw-byte
classifier would violate TCC-A1 §4.

The recorded RED command/output is
[red-executor-output-2026-08-30.json](red-executor-output-2026-08-30.json).
The supporting current-product test execution is
[supporting-executor-output-2026-08-30.md](supporting-executor-output-2026-08-30.md).

## Missing measurement/projection vectors

The current candidates and supporting tests do **not** supply these required
TCC-A1 vectors:

1. exact nearest/tie selection with a stable candidate sort key;
2. one TCC-observable bound pair result, including unchanged base/allocation on
   stale or unavailable target;
3. one proof that the exact same `MeasurementFormatPolicy` output reaches
   Preview, Plan 2D, 3D and export; and
4. canvas and numeric entry paths producing the same semantic intent.

## Missing legacy/ingress vectors

The product has no executable source-TCC evidence for:

1. closed V1 and V2 raw grammar and byte-preserving decoder;
2. `legacy-v1-readable`, `legacy-v2-readable`, `legacy-unmappable` and
   `legacy-unreadable` classification matrix;
3. valid current-envelope, checksum-valid, AST-R1-admitted legacy selector
   with `BACKUP_SCHEMA_UNREADABLE` precedence; and
4. no-migration, no-pin, no-ID, no-Revision and no-Project-publication proof
   for every legacy/earlier-ingress failure.

## Command/lifecycle vectors absent from seed manifests

The seed manifests execute just two empty/initial-wall routes.  Their only
lifecycle rows are `TCC-A1-INITIAL-WALL-006` cancellation,
`...-007` stale-base and `...-008` lost-fence.  The current source manifest
already records `every topology command`, `no-intent draft`,
`deletion/host conflict preview/cancel/stale` and `Revision/History no-effect
matrix` as missing.  TCC-A1 §3 further makes these minimum gaps explicit:

1. no-intent tap/draft with exact base and empty allocation;
2. valid deletion of interior, exterior and face-closing wall segments;
3. face-opening/deletion and Opening/host conflict-preview, cancel and stale
   re-entry;
4. `WALL_ITEM_COLLISION` against a rotated retained floor footprint; and
5. allocation intent, inverse-to-base and zero partial ChangeSet/Revision/
   History effect for every topology command, rather than just initial-wall
   materialization.

None can be closed with physical-device confirmation or asset-rights consent:
they require an adopted TCC-A1 executor/corpus and independent review of the
immutable outputs.
