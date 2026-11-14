# FloorPlacement contract reconciliation — independent review R2

**Date:** 2026-08-05  
**Scope:** Canonical `geometry-contract.md` §9 against `ARCHITECTURE-SPINE.md`
AD-8 and `domain-model.md` placement model. The review also inventories
`levelId` in non-review Markdown architecture sources. It does not change any
source artifact.

## Verdict: PASS — canonical architecture is reconciled

The architecture now fully carries the canonical floor-placement contract. No
blocking mismatch remains between the canonical geometry contract, AD-8, and
the domain model.

| Contract obligation | Canonical geometry §9 | Architecture evidence | Result |
| --- | --- | --- | --- |
| Exact floor shape | `FloorPlacement { roomId, xMm, zMm, elevationMm, yawStep }` | `domain-model.md` declares the identical discriminated-union member set. | PASS |
| Stable compatible host | Floor belongs to a concrete Room. | AD-8 says floor/ceiling placement address a concrete Room; the domain model requires `roomId` to resolve to a compatible host. | PASS |
| Safe topology reconciliation | Automatic transfer is only one-to-one, compatible, same-root; every other host outcome uses `ConflictPreview`, explicit rehome/delete/orphan, and fresh base/fence validation. | AD-8 and the domain model state the same allowed transfer, explicit alternatives, and no silent/partial commit rule. | PASS |
| Separate finish model | `SurfaceAssignment` is not an asset placement and uses `Floor(RoomId)`, `Ceiling(RoomId)`, or `WallSide(...)`. | AD-8 and the domain model retain the same separation. | PASS |

The spine intentionally binds the invariant rather than repeating every field
name; the architecture-owned domain model provides the exact canonical
serialized semantic shape. Together they form one unambiguous architecture
contract.

## `levelId` inventory and disposition

There is no `levelId` field in the current `FloorPlacement` architecture
model. A scoped scan of all Markdown architecture sources outside `reviews/`
found four occurrences:

| File | Location | Assessment |
| --- | --- | --- |
| `domain-model.md` | `LevelId` entity identifier | Compatible: this is the Project's single Level identity, not a floor-placement field. |
| `d-022-geometry-policy-decision-draft-r3-2026-08-05.md` | face/fingerprint input `levelId` | Compatible with Level/face identity; not a floor-placement host. |
| `d-022-geometry-policy-decision-draft-r6-2026-08-05.md` | `FloorPlacement { levelId, xMm, zMm, elevationMm, yawStep }` | Incompatible historical wording. R7 marks R6 as frozen rejected external-review evidence; it is noncanonical and must not drive implementation. |
| `d-022-geometry-policy-decision-draft-r7-2026-08-05.md` | `existing-floor-host … levelId` in `HostOrigin` | Incompatible historical floor-host notation. R8 marks R7 rejected external-review evidence; it is noncanonical and must not drive implementation. |

The two incompatible hits are confined to frozen, superseded noncanonical
draft evidence. They are a documentation-search hygiene risk only, not a
canonical architecture conflict. Do not edit those frozen artifacts; any
future source lookup should prefer geometry §9, AD-8, and `domain-model.md`.

## Checks performed

- Read canonical Geometry Contract §9 and the current AD-8/domain placement
  passages directly.
- Ran `lint_spine.py` for the architecture workspace: **0 findings**.
- Searched all non-review Markdown architecture sources for `levelId` and
  classified each occurrence by semantic role and artifact authority.

## Gate decision

Accept the R2 reconciliation for the canonical placement contract. No
architecture-source correction is required by this gate. The frozen
noncanonical D-022 records should remain preserved as review evidence and
excluded from canonical implementation inputs.
