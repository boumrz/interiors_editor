---
title: "G-S2 Contacts / Faces / Lineage: detached TCC-A1 execution disposition"
date: 2026-08-30
status: final
gate: G-S2-topology
scope: "W-READY-2026-08-30 / S-2; contacts-and-plan-invariants, faces-and-usable-geometry, lineage-and-hosts"
verdict: NOT_PASS
---

# Detached execution disposition

## RED

The source audit manifest was checked before a new fixture was written. It
reported all three requested families as `not-executable-as-tcc-a1`:

```text
RED TCC-A1 family completeness: contacts-and-plan-invariants:not-executable-as-tcc-a1, faces-and-usable-geometry:not-executable-as-tcc-a1, lineage-and-hosts:not-executable-as-tcc-a1
```

The first detached test also failed intentionally because the fixture manifest
did not yet exist (`ENOENT`); this records that the later hash assertions were
not a green test retrofitted to an existing artifact.

## Immutable raw-input record

The three raw fixtures and SHA-256 values are declared in
`_bmad-output/implementation-artifacts/spikes/W-READY-2026-08-30/S-2/contacts-lineage/fixtures/contacts-lineage.tcc-a1.json`.

| Fixture | Family | Expected semantic outcome | SHA-256 | Executor disposition |
| --- | --- | --- | --- | --- |
| `TCC-A1-CONTACTS-001` | exact T contact | one shared Vertex; non-zero split pieces | `0919e955fc321a70bd326d236943418f22dfc5122ea37f8fffe637f004fa2eff` | `BLOCKED_UNSUPPORTED_TCC_A1_OUTCOME` |
| `TCC-A1-FACES-001` | nested rings | `AMBIGUOUS_BOUNDED_WALK` with no Room | `a80ca6557bb509a9361ed2e3c6f6a7c6e0a2a0e0fa058fee92b8af6d786e8390` | `BLOCKED_UNSUPPORTED_TCC_A1_OUTCOME` |
| `TCC-A1-LINEAGE-001` | valid Room split | two successors inherit `heightMm=2600` | `d4d9b87f938e18edce0f6fa5ce136a44bd2db93fedcea8a547c952117fb76e31` | `BLOCKED_UNSUPPORTED_TCC_A1_OUTCOME` |

The detached manifest validator passed after the fixtures were added: 1/1.
It verifies raw-byte length, SHA-256 and the blocked disposition; it does not
claim to execute the three semantic outcomes.

## Supporting current-kernel output

The read-only current-kernel command below passed 194/194 tests:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs \
  src/domain/add-wall-segment.test.ts \
  src/domain/derive-plan-faces.test.ts \
  src/domain/general-wall-project.test.ts
```

It includes existing supporting checks for exact T/X normalization, fractional
contact rejection, overlap and short-wall no-allocation, exterior/multi-face
derivation and nested-ring rejection, Room split height inheritance, merge
preview/re-entry, and Opening/wall-item host paths. This result is supporting
regression evidence only, because it is not the declared TCC-A1 executor run.

## Hard blocker

`apps/web/src/domain/tcc-a1-corpus-runner.ts` hashes and validates generic
fixture declarations, but its discriminated outcome contract supports only:

- stable rejects `INVALID_DIMENSION`, `PROJECT_BOUNDS_EXCEEDED`,
  `UNSUPPORTED_DIRECTION`, `ZERO_LENGTH`;
- materialization transients `cancelled`, `stale-base`, `lost-fence`; and
- AD-21's initial-wall accepted adapter.

It has no adopted outcome adapter for `addWallSegment`,
`deriveBoundedOrthogonalFaces`, or `addGeneralWallToProject`, and no means to
observe their canonical post-state digest, allocation intent, inverse and host
effects. Extending that runner or its outcome contract would change
`apps/web/src/domain/**`, which the active waiver explicitly forbids. A new
spike-local runner would be a second topology authority and cannot be called
the adopted TCC-A1 executor.

Therefore these raw fixtures must remain `NOT_PASS`; changing their status to
executed or using the 194 green regression tests as a substitute would violate
TCC-A1 sections 1, 2 and 6.
