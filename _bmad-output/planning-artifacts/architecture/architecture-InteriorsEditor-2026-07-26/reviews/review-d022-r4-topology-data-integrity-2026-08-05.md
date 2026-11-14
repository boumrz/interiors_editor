---
title: "InteriorsEditor — external independent topology/data-integrity review of D-022 revision 4"
date: 2026-08-05
review_type: topology-data-integrity-precanonical-r4-external
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r4-2026-08-05.md
reviewed_sha256: 2711b00ee98e1bbf7649cae7ef4d51974c9a1615f9e712cebbcd9d9ab86b321b
review_scope:
  - Plan face derivation and NoHolesAlphaV1 gate
  - Room lineage, survivor maps, seeds and loss acknowledgement
  - wall/floor/ceiling host and surface lifecycle
  - topology-transfer context, impact binding, replay and undo
independence: "This verdict uses the frozen R4 artifact and current source-of-truth documents only. No earlier or internal review artifact was used as authority or evidence."
verdict: REJECT_FOR_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
---

# Independent topology/data-integrity review — D-022 R4

## Verdict

`REJECT_FOR_PRECANONICAL_INPUT`. R4 closes several previously visible design
directions, but its face traversal, transfer commitments and reversible
ChangeSet still do not specify one total, serializable state transition. It
must not enter source-owner reconciliation or executable implementation as a
precanonical policy input in this form.

## Review basis

The reviewed bytes are exactly SHA-256
`2711b00ee98e1bbf7649cae7ef4d51974c9a1615f9e712cebbcd9d9ab86b321b` of
`d-022-geometry-policy-decision-draft-r4-2026-08-05.md`. The review compared
that artifact with the current SPEC, Geometry Contract, Project/Backup
Contract, Domain Model, Architecture Spine, PRD and Project Context. Earlier
review reports were deliberately not consulted.

## Findings

- `D022-R4-TDI-01 — §3.1 does not define a total planar-face traversal.` A
  sorted directed-edge iteration is not a successor rule for a directed dart.
  At a T/X junction, a vertex of degree greater than two, a bridge, a dangling
  wall, or a repeated boundary walk, the policy does not say which incident
  edge is next, how a bridge is consumed, or how the unbounded face is
  identified. Those inputs are allowed by the canonical Plan rules, and they
  can yield different bounded cycles before `FaceRingClassificationV1` runs.
  Define a non-persistent `PlanFaceTraversalV1` with exact angular ordering,
  successor/turn rule, outer-face selection, bridge/repeated-dart treatment
  and bounded-output ordering; pin it with T/X, junction, bridge and open-tail
  fixtures.

- `D022-R4-TDI-02 — the NoHolesAlphaV1 classifier has no canonical ring-set or
  containment construction.` §3.1 normalizes every cycle to CCW and then says
  that a “bounded component” is classified, but never defines which cycles
  belong to the same component, their parent/containment relation, depth
  parity, an exact interior witness, or the resolution of a shared vertex/edge
  before the `TouchingRings` decision. Consequently nested closed loops can be
  interpreted either as independent `SingleOuter` faces or as a hole, while
  `DisconnectedOuter` has no distinct structural encoding. Introduce a closed
  `FaceRingSetV1` derived from the traversal with sorted ring membership,
  parent/depth, exact containment witness and contact classification; emit a
  `CenterlineFaceKeyV2` only after that one structure passes the hole gate.

- `D022-R4-TDI-03 — FaceLineageRelationV1 accepts a non-empty shared-root
  witness, not a direct face lineage.` Its eligibility test requires only that
  every listed tuple reconstruct and that the list is non-empty. The tuple has
  no oriented face-side, source/target root interval, or coverage requirement
  for either boundary. A changed face on the opposite side of one retained wall
  can therefore supply one reconstructible root occurrence and become eligible
  to receive an unrelated Room ID, name and finishes after user confirmation.
  Replace this with a closed, side-aware root-occurrence relation and an exact
  coverage rule for the predecessor and successor boundary multisets; a map
  must reference that whole proof, not a single common root.

- `D022-R4-TDI-04 — the required context digest is circular with the selected
  survivor route.` `RoomSurvivorMapV2` must carry a
  `TopologyTransferContextDigestV1`; that digest includes frozen allocation
  purposes/output IDs; and `FrozenAllocationPlanV2` explicitly includes the
  selected survivor route and field mutation. The map choice determines whether
  a changed face reuses an ID or requires a seeded Room/allocation, so the
  digest needed to validate the map depends on the map being validated. Define
  a map-independent input-context digest first, then a resolved-transfer
  commitment that may include allocation and maps. No record may contain a
  digest whose own inputs depend on that record’s acceptance.

- `D022-R4-TDI-05 — NewRoomSeedV2 is not a closed serializable assignment
  payload.` `initialFloorAssignment` and `initialCeilingAssignment` name
  `ExplicitValue | ExplicitUnset`, but `ExplicitValue` has no value, value
  schema, resource/reference bytes, pin/notice commitment or field ID. The
  `type` and metadata entries are similarly descriptive rather than registered
  canonical union/record values. Thus two different seeded finishes cannot be
  proven distinct in `CanonicalBytesV1`, nor can the resource policy validate
  the seed before the host transition. Give every seed field an exact tagged
  value-or-unset encoding and bind referenced resources to the corresponding
  preflight commitment.

- `D022-R4-TDI-06 — RoomLossAcknowledgementV2 cannot establish the stated
  coverage or inverse.` The prose says acknowledgements are sorted by
  `(sourceRoomId, fieldClassOrdinal)`, but the described record does not carry
  either key, a source face/base identity, or a closed target-slot list. Its
  single “relevant successor” also cannot describe a source value explicitly
  copied into multiple new seeds or cloned wall-side assignments. As a result,
  the validator cannot prove the promised eight-class cardinality, distinguish
  removal from transfer, or reconstruct the inverse from the acknowledgement
  bytes. Define per-source/per-class records with the sort keys in their wire
  shape, complete base and post projections, and a sorted list of explicit
  target slots/dispositions.

- `D022-R4-TDI-07 — host transfer is undefined when a WallSegment keeps its ID
  but its geometry changes.` `NormalizedTopologyEffectV1` includes
  `MoveVertex`, `MoveWallSegment` and `ChangeWallThickness`, while §§6.2–6.3
  only define interval transfer for partition/merge and side-address mapping.
  A retained wall can be shortened, moved or made thicker with an Opening or
  WallPlacement whose old interval no longer fits; a side address alone does
  not validate or rehost its offset/elevation/normal basis. The current
  Geometry Contract explicitly leaves wall-length host policy to D-022. Add a
  total same-ID attachment resolution for every extracted Opening and
  WallPlacement, with a fixed preserve/rebase/rehost/reject outcome and exact
  inverse before host validation.

- `D022-R4-TDI-08 — WallSideResolutionV1 cannot encode a normal exterior
  target.` The declared record mandates `candidateFaceKey` while allowing
  `targetRoomId | ExteriorSide`. A valid exterior/interior wall side has no
  candidate face key for its exterior endpoint, and no tagged absence or
  exterior-face representation is defined. This makes an ordinary exterior
  wall-side assignment or WallPlacement impossible to serialize and invert
  despite the policy allowing it. Split the target into closed
  `RoomTarget { roomId, faceKey }` and `ExteriorTarget { physical-side proof }`
  variants and define both inverse forms.

- `D022-R4-TDI-09 — Wall-side resolutions are not a total host-record set.`
  “For every surviving/changing wall-side address” does not define the source
  universe, cardinality, set digest, record key, asset ID or action for a
  disappearing/moved hosted record. A collection can contain a sound material
  address proof while omitting a WallPlacement on the same address, or vice
  versa, with no specified extra/missing detection. Define a complete
  `WallHostResolutionSetV1` keyed by every extracted base/candidate
  WallPlacement and WallSideAssignment, and bind it to the partition/merge
  maps, FieldDispositionV1 records, target placements and inverses.

- `D022-R4-TDI-10 — AffectedCeilingPlacementSetV1 is defined from a candidate
  that its own resolutions must create.` The set is the union of ceiling
  placements in the base and detached candidate Project, but each
  `CeilingHostResolutionV1` chooses Keep/Move/Delete and therefore determines
  that candidate’s ceiling placements and their digest. A moved asset must be
  in the set before the action carrying that set digest can be validated. The
  policy also lacks an explicit pre-only/post-only row for an AssetInstance
  whose placement kind changes. Define a pre-resolution inventory from base
  asset IDs plus explicit command targets, give it deterministic pre/post slots,
  derive exactly one action per slot, and only then construct the candidate and
  final affected-set digest.

- `D022-R4-TDI-11 — TopologyTransferContextDigestV1 is neither a closed
  singleton nor a project-content fence.` §6.1 says there is one context, yet
  `PreflightImpactContentV1` contains `TopologyTransferContextDigestV1[]` with
  no cardinality/order/equality rule. Its advertised inputs include a
  `baseRevisionId` but omit the `projectId` required by the current
  CommandEnvelope and a canonical digest of the base Project state. A revision
  ID is not specified as a cross-project content hash, so a map can be replayed
  against a same-looking clone or an incorrectly reconstructed base. Require
  one named context record with `projectId`, exact base-state digest, effect
  digest and policy-bundle digest, and require every map/relation/resolution to
  reference that same singleton byte-for-byte.

- `D022-R4-TDI-12 — the confirmed impact does not bind the actual forward and
  inverse mutation.` The purportedly complete impact content contains open
  placeholders for “explicit Opening/adjacency/property mutations” and
  “resource pin and BackupFeasibility commitments”, while the forward canonical
  record changes and `InverseChangeSetV2` first appear after confirmation in
  `ValidatedChangeSetV2`. The displayed impact digest can therefore remain
  unchanged while a later implementation selects different record patches,
  resource references or undo bytes. Put closed, sorted forward and inverse
  patch sets (or their immutable canonical digests when exactly derived) inside
  `PreflightImpactContentV1` before confirmation, including all referenced
  resource hashes and notice/policy commitments.

- `D022-R4-TDI-13 — replay and undo have no directional revision/context or
  retained policy contract.` A forward impact is fenced to its pre-command
  `baseRevisionId`; undo runs from the post-command Revision, but R4 defines no
  reverse base/target digest, reverse topology effect/context or inverse
  allocation restoration rule. “Re-run ... policy version/base fence” is
  consequently either guaranteed to reject undo or has an unspecified bypass.
  In addition, `policyBundleId` is a name rather than immutable retained policy
  bytes/digest, so an app/policy update can make an already Durable history
  entry non-reversible. Define directional from/to Revision digests, forward
  and reverse context commitments, exact restoration allocations, and a pinned
  policy-bundle digest/availability rule that preserves existing session
  history or exposes the explicit recovery boundary required by the source
  contracts.

## Required evidence before another independent review

- A compact executable corpus must cover the face-walker and ring-set cases:
  T/X/degree-greater-than-two vertices, bridges/open tails, nested loops,
  touching rings and independently closed rooms.
- Fixtures must demonstrate rejected weak one-root lineage, valid side-aware
  lineage, map-independent context construction, seed/loss byte identity and
  every missing/extra record outcome.
- Host fixtures must cover same-ID wall shortening/move/thickness changes,
  exterior/interior and exterior/exterior sides, complete wall-host coverage,
  ceiling Keep/Move/Delete plus placement-kind transitions, and exact inverses.
- Replay fixtures must prove forward persistence/retry, undo and redo against
  directional Revision/context/policy commitments, with unchanged prior Durable
  state on every rejection.
