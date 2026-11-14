---
title: "InteriorsEditor — external independent topology/data-integrity review of D-022 revision 3"
review_type: topology-data-integrity-precanonical-r3-external
reviewed: 2026-08-05
reviewer: "Codex /root/d022_changeset_policy_research"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r3-2026-08-05.md
reviewed_snapshot:
  draft_sha256: ef16eb1a15b0face1e92077dff9ca904fa094378a64c10b8752fa48960151773
  architecture_spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  domain_model_sha256: 80eed557aeafaaf97dfef974e3f639efb887b1d28fe50b878722e813913e5395
  geometry_contract_sha256: ca0efcc9126ac8ff92fa76eeafa32ac8dd3d13311d8d66758a68219b52cefbb0
  project_backup_contract_sha256: 91ecfb9ac4cb7bc21e2e0205442b960713e70a2aaf3384a40645db2fff8d7157
  asset_import_contract_sha256: a2515ee47c029516643e33a6c90453a6ebafcbbd1110048ec1dbbd8e1ad99c56
  project_context_sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
review_basis:
  - ../d-022-geometry-policy-decision-draft-r3-2026-08-05.md
  - ../ARCHITECTURE-SPINE.md
  - ../domain-model.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../specs/spec-interiors-editor-alpha/asset-import-contract.md
  - ../../../project-context.md
independence: "No internal review artifact was used as authority or evidence for this verdict."
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "External independent read-only review of the exact R3 SHA: contacts/partitions, Room overlay/seed/loss, holes, host maps/side lifecycle/ceiling resolution, allocation/impact/replay; no draft, canonical, memlog, code, test, configuration or evidence mutation"
source_mutations: "Created only this versioned review artifact."
---

# D-022 revision 3 — external topology/data-integrity review

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT` for the reviewed R3 SHA.** `NOT_READY`
remains unchanged.

R3 materially improves the R2 direction. In particular, its finite-segment
classifier, per-segment partition order, explicit Room seeds, one-to-many host
maps, frozen allocation plan and confirmed-impact boundary are the right kinds
of controls. It also correctly leaves canonical/source-owner reconciliation
open.

The document nevertheless is not yet a total, reversible lower-level policy.
An unchanged old/candidate room boundary triggers the same collinear-overlap
case that the topology kernel rejects, and several Room/host fields still lack
an exhaustive lifecycle. Those failures can prevent normal reconciliation or
let two implementations retain, remove or address different durable values.
They must be corrected in a successor draft before the owner workflow may use
it as an architecture input.

This disposition concerns only the noncanonical R3 policy input. It changes no
`AD-*`, SPEC/PRD/UX source, reason registry, evidence state, implementation
authority, R3 file or readiness gate.

## What passes this review

| Boundary | Assessment |
| --- | --- |
| Integer canonical topology | **Pass in direction.** The draft keeps contacts rational until integer admission, groups before partition and constructs every affected segment in stored-direction order. |
| No implicit wall-host repair | **Pass in direction.** Explicit split/merge maps, physical intervals and a no-reverse/no-diagonal automatic-rebase rule are substantially safer than an implicit nearest-host rule. |
| Room-height default removal | **Pass in direction.** A new/unmapped face needs an explicit seed before height-dependent Opening/adjacency/host validation. |
| Ceiling action model | **Pass in direction.** `Keep | MoveAsset | DeleteAsset` is confirmed, impact-bound and reversible rather than silently nearest-room rehosted. |
| Durable consequence binding | **Pass in direction.** Frozen IDs, full ChangeSet/inverse and rejection before `PendingDurability` preserve the AD-3 lifecycle shape. |

## Named blockers and concrete correction clauses

- **D022-R3-TDI-01 — Centerline overlay reuses a topology classifier that
  rejects ordinary unchanged boundaries.** Section 7.1 says overlay uses §4
  contacts. Section 4.1 classifies a positive collinear open interval as a
  whole-candidate topology rejection. Yet a normal edit that moves one side of
  a rectangular room leaves the other old/candidate boundary edges coincident
  over positive intervals. “Retain rational overlay contacts” removes only the
  integer-admission gate; it does not replace the overlap outcome. Define a
  separate `OverlaySegmentContactV1` that represents a labelled
  `CoincidentInterval` rather than a topology error, splits both edges at its
  exact endpoints and preserves source multiplicity. Only Plan topology
  normalization may reject a collinear wall overlap. Add unchanged-rectangle,
  one-wall move, shared full/partial edge and reverse-ring overlay cases.

- **D022-R3-TDI-02 — The rational DCEL has no total ordering/ownership rule for
  coincident or collinear half-edges.** Quadrant/cross ordering is insufficient
  when two outgoing overlay half-edges have the same direction: cross is zero,
  and source snapshot, ring membership, interval multiplicity and traversal
  ownership can decide a different face/cell in different implementations.
  Define a canonical half-edge equivalence and tie tuple (snapshot, face key,
  ring/edge ordinal, interval parameter, direction and source label), plus the
  exact policy for coincident arcs, opposite arcs, zero-area cycles and cell
  boundary ownership. The overlay corpus must prove stable cells/areas for
  equal, partially coincident and endpoint-touching old/new boundaries.

- **D022-R3-TDI-03 — Hole rejection is not a total Plan/Room lifecycle policy.**
  R3 rejects a face with an inner boundary before usable derivation, but does
  not define DCEL hole detection/classification, whether the whole topology
  command rejects, or how an existing/imported valid Plan containing a hole is
  opened, migrated, exported and reconciled. The current domain test model
  explicitly includes hole golden plans. Define `FaceRingClassificationV1` for
  outer/inner/nested/touching/disconnected rings and an explicit Alpha action:
  whole candidate rejection before Room overlay, a bounded supported annulus
  model, or a named migration/read-only rule. Do not leave a valid persisted
  graph to fail later as an unspecified usable-polygon error.

- **D022-R3-TDI-04 — Exact limits do not bound rational topology/overlay
  operand growth.** `ExactLimitsV1` bounds contact counts and overlay
  edges/vertices/cells, but its ContactPair/ContactGroup/Overlay rows give no
  numerator, denominator, cross-product, rational-area or gcd bit limit. Near
  parallel edges can remain within all count caps while creating oversized
  rational intermediates on a phone. Add phase-specific rational operand and
  intermediate bit caps, check them before allocating the next value and bind a
  single `GEOMETRY_EXACT_LIMIT` subtype. Include pathological near-parallel
  topology and overlay fixtures that hit every bit boundary independently of
  collection counts.

- **D022-R3-TDI-05 — Q2 inverse does not fully specify its own positive-
  denominator normal form.** Q2 requires `d > 0`, but the stated inverse uses
  `d * (a - b√2) / (a² - 2b²)`. For example, the inverse of `Q2(0,1,1)` first
  has a negative denominator. “Normalise” is used but no sign-transfer rule is
  defined. This affects miter, Q2 contact, strict containment and ceiling
  validation. Define normalisation mechanically: when the denominator is
  negative, negate both coefficients and denominator before gcd reduction;
  define zero and post-operation bit checks, and require every Q2 operation to
  return that form. Add inverse cases on both signs of `a² - 2b²`.

- **D022-R3-TDI-06 — Room surface-assignment carry is not closed outside
  `WallSide`.** The canonical Room owns `surfaceAssignments` at
  `Floor(RoomId)`, `Ceiling(RoomId)` and `WallSide(...)`. R3 explicitly extracts
  only WallSide values; `RoomCoreV1` says merely “non-wall fields,” while
  `NewRoomSeedV1` names only name/type/metadata. A split, merge or seeded Room
  therefore has no stated keep/clear/clone/loss rule for floor and ceiling
  material values. Define a closed `RoomRecordFieldClassV1` plus a complete
  matrix for core, floor, ceiling and wall-side assignments. Every source value
  must have an explicit target/default/removal and inverse; a seed must state
  only the permitted initial values. Include these values in loss acknowledgements
  and exact `SurfaceAddress` ChangeSet keys.

- **D022-R3-TDI-07 — `RoomLossAcknowledgementV1` still permits subjective field
  coverage.** `carryClassOrFieldSet`, `normalizedBeforeDigest` and
  `normalizedAfterDigest` have no closed vocabulary, projection or digest
  encoding. One implementation can acknowledge Room core only while another
  includes a floor/ceiling assignment or future field. Define a sorted,
  versioned field-class enum; one canonical record projection per class; whether
  generated IDs, face keys and explicit bundled mutations are included; and
  exact one-ack cardinality for each loss outcome. Test a merge loser, pure
  split child, explicit property mutation, value-equal/default field and every
  surface-address class.

- **D022-R3-TDI-08 — “Every affected CeilingPlacement” is not an enumerable
  coverage rule.** R3 requires a resolution for every affected ceiling asset,
  but never defines the exact affected set or includes its extractor/digest in
  the impact. A command can omit a placement whose surviving Room changes usable
  boundary, height or footprint validity. Define a sorted
  `AffectedCeilingPlacementSetV1` derived from all pre/post Room IDs, usable
  polygons, heights and candidate placement references; require each member
  exactly once in `CeilingHostResolutionV1[]`, and reject missing/extra/stale
  actions. Test unchanged hosts, same-ID geometry loss, Room-ID loss, explicit
  move and delete/undo.

- **D022-R3-TDI-09 — Wall-side lifecycle is undefined when a wall survives but
  its adjacent Room identity changes.** Partition/merge maps cover changed wall
  IDs, while §8.4 only says an old `AdjacentRoomId` must “resolve through §7.”
  It does not define a serializable mapping from a losing old Room to a
  particular seeded/surviving target Room on the same physical side for a
  `MoveVertex`/`MoveWallSegment` that retains `WallSegmentId`. Define
  `WallSideResolutionV1` with source address, candidate face key, target Room
  ID/address, survivor-or-explicit-rehost provenance and physical-side proof.
  If that proof is absent, reject rather than treating geometric proximity as a
  replacement Room ID.

- **D022-R3-TDI-10 — `ExteriorSide` cannot distinguish two exterior physical
  sides in the asserted closed host model.** The canonical persistent key is
  `WallSide(WallSegmentId, AdjacentRoomId | ExteriorSide)`. R3 carries
  `normalSign` only in `LocalBasisV1`, then emits the same `SurfaceAddress` key.
  A detached/bridge wall with exterior on both sides can therefore have two
  different physical sides collapse into one address; clone/coalesce/inverse
  rules cannot recover which material or WallPlacement side was meant. Either
  version the persistent exterior address with a stable physical-side token, or
  reject WallSideAssignment/WallPlacement on a two-exterior-side wall in Alpha.
  Include standalone, bridge, exterior/interior and reverse/undo fixtures.

- **D022-R3-TDI-11 — `sourceTopologyDigest` is used as a stale-map guard without
  a canonical definition.** Both attachment maps contain it, but R3 defines
  only a separate `NormalizedTopologyEffectV1` with a geometry digest. It does
  not state which base fields, source walls/orientations/thicknesses, contact
  groups, frozen child IDs, host extractor results and Room-side inputs are
  serialised into `sourceTopologyDigest`. Define one canonical
  `TopologyTransferContextDigestV1` and require every map to carry it. The
  recomputation must reject a map from an equal-looking but different base host
  state before any target output is accepted.

- **D022-R3-TDI-12 — `impactDigest` is self-referential as written.**
  `PreflightImpactV1` lists `impactDigest` as a field, then defines it as the
  SHA-256 of canonical serialization of “all fields above.” Including itself
  has no total construction; excluding it is an unstated implementation choice.
  Split this into `PreflightImpactContentV1` and an envelope
  `{ content, impactDigest }`, hash only the fully specified content, and
  include a versioned policy-bundle/serialization identifier in that content.
  The replay corpus must assert digest equality across serialization, retry,
  stale base, policy-version mismatch, undo and redo.

## Required re-review evidence

Before a corrected successor can be assessed for source-owner adoption, the
executable corpus must demonstrate:

- a coincident-edge-safe rational overlay and deterministic labelled DCEL;
- a defined hole lifecycle and closed Room core/floor/ceiling/wall-side carry
  matrix;
- complete affected-ceiling and same-wall/changed-Room side resolution maps;
- exact rational/Q2 normal forms and bit-bound failures; and
- non-recursive impact serialization plus exact replay/undo/redo of every
  allocation, `SurfaceAddress`, resource reference and acknowledgment.

Only a corrected draft and fresh independent review can change this
precanonical verdict. Canonical adoption and the broader readiness gate remain
blocked in all cases.
