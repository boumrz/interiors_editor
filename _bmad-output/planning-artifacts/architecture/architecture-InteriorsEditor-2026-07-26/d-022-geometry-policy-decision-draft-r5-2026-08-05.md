---
title: "InteriorsEditor — D-022: working exact-geometry policy input, revision 5"
date: 2026-08-05
revision: 5
status: draft
noncanonical: true
canonical: false
architecture_spine_changed: false
memlog_changed: false
implementation_ready: false
readiness: NOT_READY
scope: "Pre-canonical, total policy input for exact selection, planar faces, room/host transfer, metrics and reversible topology ChangeSet"
predecessor:
  artifact: d-022-geometry-policy-decision-draft-r4-2026-08-05.md
  revision: 4
  sha256: 2711b00ee98e1bbf7649cae7ef4d51974c9a1615f9e712cebbcd9d9ab86b321b
  disposition: frozen-rejected-external-review-evidence-do-not-edit
frozen_r4_review_evidence:
  reviews/review-d022-exact-geometry-adversarial-r4-external-2026-08-05.md:
    sha256: a5df5a8d3344c55f90ea4ca07352d44a0832783fa9f57a2bc9cc87de9d0a9683
    verdict: REJECT_FOR_PRECANONICAL_INPUT
  reviews/review-current-source-d022-r4-2026-08-05.md:
    sha256: 57aedd56df40da2698e0d27a4c4b2d469bae2a00c664abbac1f9f261e9781bb2
    verdict: REJECT_FOR_PRECANONICAL_INPUT
  reviews/review-d022-r4-topology-data-integrity-2026-08-05.md:
    sha256: 4866a160c7578ac81baf847c6fda76169af31f8f030566e0444e8610238e9160
    verdict: REJECT_FOR_PRECANONICAL_INPUT
authority:
  delegated_product_owner_decision: "Реши сам кого назначить, мне нужно, чтобы решения были приняты для продолжения работы"
  limit: "Делегирование выбирает только draft policy. Оно не заменяет source-owner reconciliation, executable evidence, independent review, physical evidence или READY."
sources:
  - ARCHITECTURE-SPINE.md
  - .memlog.md
  - domain-model.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../specs/spec-interiors-editor-alpha/performance-budgets.md
  - ../../../specs/spec-interiors-editor-alpha/asset-import-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../implementation-readiness-report-2026-08-05.md
proposed_architecture_route:
  - "Fresh independent review of this exact R5 SHA"
  - "Source-owner reconciliation in Architecture/SPEC/PRD/UX and an explicit decision for every source delta"
  - "Executable corpus and remaining readiness evidence"
  - "Only then a new official readiness assessment; this file authorizes no implementation"
---

# D-022 — working policy package, revision 5

## 0. Status, authority boundary, and deliberate decisions

R5 is a new **non-canonical** successor.  It preserves the R4 file and all
three R4 reviews as frozen evidence at the exact SHA values in frontmatter.
It changes no `AD-*`, SPEC, PRD, UX, `.memlog.md`, production source,
configuration, test, durable Project, readiness or waiver.  `G-READY` remains
**NOT READY**.

The policy makes the following deliberately narrow choices so that an
implementation never fills a durable branch with a library default:

1. canonical Plan remains integer-mm `Vertex → WallSegment`; every rational,
   Q2, camera, face, metric and digest helper below is detached/ephemeral until
   an explicitly complete ChangeSet is confirmed;
2. a Room ID is automatic only when the canonical face fingerprint is byte
   identical.  A changed face can retain an ID only through a confirmed,
   partial-injective `RoomSurvivorMapV3` backed by a complete, side-aware
   `FaceLineageRelationV2`.  There is no overlay, score, area-maximisation,
   nearest-room or auto reattachment route;
3. when R5 cannot prove a transfer, it rejects the candidate or requires an
   explicit seed/loss/rehost/delete action.  It never invents an offset,
   surface, Room property, resource or history result;
4. `NoHolesAlphaV1` rejects a *new candidate* whose derived face set contains
   a hole/nested/contacting ring.  A readable existing/imported hole Project is
   a named exportable read-only compatibility state; it is not migrated,
   simplified or deleted;
5. miter-only usable geometry, C1–C4/RayProbe, the exact metric formatter,
   `YawStepC8V1`, new reason codes, CanonicalBytesV2 and every transfer record
   below are proposed source deltas until their named owners reconcile them.

Nothing in this draft says that a current source was silently changed.  It is a
fully specified candidate policy for an owner/reviewer to accept, alter or
reject as one package.

### 0.1 Scope and non-goals

R5 does not choose a geometry library, browser hit-test, renderer, storage
format, Kotlin transport, PWA target or native-fullscreen behaviour.  It does
not relax the canonical safe-integer ingress boundary.  `BigInt`, `Q2`,
camera values, `CanonicalBytesV2` intermediates, selection and metric witnesses
are never Project JSON, Revision state, History payload, Command payload or
Portable Backup source of truth.  A persisted future schema may reference the
verified canonical bytes/digests specified here only after source adoption.

### 0.2 Exact values and deterministic limits

`ExactRationalMm = { numerator: BigInt, denominator: positive BigInt }` has
one form: positive denominator, gcd-reduced, and zero exactly `{0,1}`.
`Q2 = (a + b*sqrt(2))/d` has `d>0`, gcd-reduced coefficients, and zero exactly
`(0,0,1)`.  Addition/subtraction/multiplication/intersection normalise before
the next allocation.  `SignQ2` uses only integer sign and comparison of
`a²` with `2b²`; float arithmetic is prohibited.

R5 retains R4's bounded policy direction: raw presentation fields are finite
binary64 decoded exactly; presentation inputs are at most 40 bits, scale at
most 32 bits, presentation comparison temporaries at most 640 bits; Plan
face traversal has at most 1,200 darts and 4,096 orbits; Q2 usable geometry
has at most 600 vertices and 179,700 non-adjacent tests; a metric boundary has
at most 64 edges and 4,096 witness pairs; a transfer/ChangeSet has at most
1,200 records (250 ceiling inventory rows) and 2 MiB encoded content.
Every bounded collection is counted from its canonical sorted input before it
is materialised.  A cap result is `GEOMETRY_EXACT_LIMIT/<phase>` and wins
before the semantic operation requiring that allocation.

## 1. One outcome registry and precedence

The table is R5's complete proposed registry.  A `Draft` result creates no
Command, `PendingDurability`, History entry, autosave or canonical projection.
Any other reject leaves the preceding Durable Revision unchanged.

| Condition | Phase | Exact R5 outcome |
| --- | --- | --- |
| Existing Plan invariant | topology | Existing `ZERO_LENGTH`, `DUPLICATE_SEGMENT`, `UNSUPPORTED_DIRECTION`, `SELF_INTERSECTION`, `AMBIGUOUS_INTERSECTION`, `PROJECT_BOUNDS_EXCEEDED`. |
| Exact contact not integral / positive collinear overlap | topology | Existing `AMBIGUOUS_INTERSECTION/NON_INTEGER_CONTACT` or `AMBIGUOUS_INTERSECTION/COLLINEAR_OPEN_OVERLAP`. |
| Active origin absent, stale, not a canonical Vertex/numeric safe-mm origin, or base mismatch | Draft selection | `CANDIDATE_UNDETERMINED/ACTIVE_ORIGIN_STALE_OR_MISSING`. |
| Raw pointer/camera/transform/cap input invalid | Draft selection | `CANDIDATE_UNDETERMINED/SNAPSHOT_OUT_OF_RANGE`. |
| Full `8 × WallSegment` RayProbe set exceeds cap | Draft selection | `CANDIDATE_UNDETERMINED/RAY_PROBE_LIMIT`. |
| Winning RayProbe is non-integral or positive collinear blocker | Draft selection | `CANDIDATE_UNDETERMINED/NON_INTEGER_RAY_CONTACT` or `CANDIDATE_UNDETERMINED/COLLINEAR_RAY_BLOCKER`. |
| C4 inverse delta is below 50 mm | Draft selection | `CANDIDATE_UNDETERMINED/C4_DELTA_BELOW_MINIMUM`. |
| C4 endpoint is out of ProjectLimits | Draft selection | `CANDIDATE_UNDETERMINED/C4_OUT_OF_PROJECT_BOUNDS`. |
| Face orbit has positive area but repeated vertex/dart, non-simple edge contact or invalid side table | Plan face | Proposed `CENTERLINE_FACE_INVALID/NON_SIMPLE_ORBIT`, `REPEATED_DART`, `REPEATED_VERTEX`, `SELF_CONTACT`, or `SIDE_TABLE_INVALID`. |
| Candidate has a hole/nested/contacting ring | Plan face before Room | Proposed `PLAN_HOLE_UNSUPPORTED/HAS_INNER_RING`, `NESTED_RING`, or `TOUCHING_RINGS`. |
| Existing/imported readable Plan contains one of those ring states | compatibility open/import | Proposed read-only `IMPORT_PLAN_HOLE_READ_ONLY`; no migration, edit, autosave replacement or deletion. |
| Q2 run/miter/simple usable failure | usable | Existing `USABLE_POLYGON_COLLAPSED` plus proposed subtype `Q2_COLLINEAR_THICKNESS_STEP`, `Q2_BACKTRACK`, `Q2_MITER_CAP_EXCEEDED`, `Q2_INVERSE_ZERO`, `Q2_ZERO_EDGE`, `Q2_NON_POSITIVE_AREA`, `Q2_ADJACENT_EXTRA_CONTACT`, `Q2_NONADJACENT_VERTEX_TOUCH`, `Q2_NONADJACENT_EDGE_CROSS`, `Q2_NONADJACENT_EDGE_OVERLAP`, or `Q2_REPEATED_NONADJACENT_VERTEX`. |
| Non-canonical/unknown CanonicalBytesV2 form | bytes | Proposed `CANONICAL_BYTES_INVALID`. |
| Missing or invalid changed-face map/relation/seed/loss action | room | Proposed `ROOM_SURVIVOR_MAP_INVALID`, `ROOM_SEED_REQUIRED`, or `ROOM_LOSS_ACK_INVALID`. |
| Unknown hosted kind, missing/extra host row, incompatible basis/span/side or no explicit target | transfer | Proposed `UNKNOWN_WALL_HOST_RECORD_KIND`, `WALL_HOST_RESOLUTION_INVALID`, `PARTITION_ATTACHMENT_CROSSES_CHILD_BOUNDARY`, `MERGE_ATTACHMENT_MAP_INVALID`, `HOST_REBASE_UNSUPPORTED`, or `TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED`. |
| Ceiling inventory/action missing, extra, stale or invalid | host | Existing `HOST_SURFACE_REMOVED` with proposed `CEILING_RESOLUTION_REQUIRED` or `CEILING_RESOLUTION_INVALID`. |
| Context/effect/allocation/policy/patch/inverse/revision mismatch | confirmation/history | Proposed `TOPOLOGY_TRANSFER_CONTEXT_MISMATCH`, `ALLOCATION_PLAN_INVALID`, `IMPACT_DIGEST_MISMATCH`, or `HISTORY_POLICY_UNAVAILABLE`. |
| Metric target is stale/unresolvable, footprint violates metric admission, or exact formatter reaches a cap | metric | Draft `CANDIDATE_UNDETERMINED/MEASUREMENT_SELECTION_UNRESOLVED`; proposed `METRIC_ORIENTATION_INCOMPATIBLE`, `METRIC_FOOTPRINT_INVALID`, or `GEOMETRY_EXACT_LIMIT/METRIC_FORMATTER`. |

There is intentionally no `MEASUREMENT_UNSUPPORTED`.  Every admitted Alpha
metric target either has the exact route below or returns its named stale,
admission, selection or limit outcome.

Validation order is fixed: raw ingress → static caps → C1/RayProbe/C4 or
topology contact normalisation → face/ring gate → usable geometry → Room
identity/fields → host inventory/resolution → allocation/resources → complete
forward/inverse impact → confirmation/persistence.  Within a phase, an
operation's required cap check precedes its semantic result.  The first failed
phase wins; unordered map/library iteration is not observable.

## 2. CanonicalBytesV2: closed byte grammar, registry, and digest roots

`CanonicalBytesV2` is a proposed protocol, not JSON.  Its sole purpose is to
make detached preflight, confirmation and replay byte-identical across
implementations.  It never replaces the current portable canonical Project
JSON contract.

### 2.1 Wire grammar

Each encoded root is exactly `49 45 43 42 32` (`IECB2`) followed by one
`Value`.  `u` below is a **minimal unsigned LEB128**: each byte carries seven
low bits; the final byte has bit 7 clear; no leading zero continuation group is
allowed.  A decoder rejects overlong, truncated or non-minimal `u` before
allocating the declared length/count.

| Tag | Value bytes | Canonical rule |
| ---: | --- | --- |
| `00` | none | `Null`; legal only where the registry says `Null`. |
| `01`, `02` | none | Boolean false/true. |
| `03` | `u magnitudeByteLength`, big-endian magnitude | `UInt`; zero has length 0; nonzero has no leading zero. |
| `04` | sign byte `00|01`, `u magnitudeByteLength`, big-endian magnitude | `SInt`; zero is only sign `00`, length `0`; negative zero rejects. |
| `05` | `u byteLength`, raw bytes | `Bytes`; exact byte length is bounded by the containing field. |
| `06` | `u utf8Length`, NFC UTF-8 bytes | `Text`; invalid UTF-8/non-NFC rejects. |
| `07` | exactly 16 bytes | `Uuid`, RFC-4122 network byte order only. |
| `08` | exactly 32 bytes | `Sha256`. |
| `09` | `u count`, then `count` complete `Value`s | Ordered `Array`; registry fixes element type and order. |
| `0A` | `u typeId`, `u fieldCount`, then ascending `u fieldId`, complete `Value` pairs | `Record`; required fields appear exactly once, optional absent fields appear zero times, unknown/duplicate/out-of-order fields reject. |
| `0B` | `u unionId`, `u variantId`, then one `Record` | `Union`; the variant registry fixes the record type. |
| `0C` | `u enumId`, `u memberId` | `Enum`; all enum members are listed in §2.3. |
| `0D` | `u count`, then `count` complete `Value`s | `Set`; elements are strictly ascending by their complete encoded Value bytes, no duplicate. |

`Digest(x) = SHA-256(IECB2 || EncodeValue(x))`.  All `Sha256` values are the
raw 32 bytes, not a text spelling.  Arrays preserve specified order; every
semantic set is `0D`, sorted by full bytes.  No map exists: a map is a `Set` of
the registered key/value record type.  A decoder rejects trailing bytes,
unregistered type/field/union/enum IDs and a value tag not allowed by the
field schema.

### 2.2 Type and field registry (schema `D022-R5/1`)

Every R5 digest input uses only this closed table.  `[]` means ordered array;
`{}` means byte-sorted set; `?` means an absent optional field, never a null
substitute.  Scalar names resolve to the tag in §2.1.  `Id` is `Uuid`,
`Digest` is `Sha256`, `Mm` is canonical safe-integer `SInt`, `Bytes` is tag
`05`, and `Enum(name)` is tag `0C` with that named enum.

| typeId / unionId | Record or union type | Required fields / variants |
| ---: | --- | --- |
| 1 | `R5ImpactEnvelopeV1` | `1:schemaVersion UInt, 2:context SingletonContextV2, 3:effect NormalizedTopologyEffectV2, 4:faceSet {FaceKeyV3}, 5:survivorMaps {RoomSurvivorMapV3}, 6:lineageRelations {FaceLineageRelationV2}, 7:newSeeds {NewRoomSeedV3}, 8:fieldDispositions {FieldDispositionV2}, 9:lossAcks {RoomLossAcknowledgementV3}, 10:wallHosts WallHostResolutionSetV2, 11:ceilingInventory CeilingInventoryV2, 12:ceilingResolutions {CeilingResolutionV2}, 13:allocation AllocationPlanV3, 14:resources {ResourcePreflightV2}, 15:forward ForwardPatchSetV3, 16:inverse InversePatchSetV3, 17:history HistoryCommitmentV2` |
| 2 | `SingletonContextV2` | `1:projectId Id, 2:baseRevisionId Id, 3:baseStateDigest Digest, 4:effectInputDigest Digest, 5:policy PolicyBundleRefV2, 6:sourceWallInventoryDigest Digest, 7:preHostInventoryDigest Digest, 8:preRoomFaceInventoryDigest Digest` |
| 3 | `PolicyBundleRefV2` | `1:policyBundleId Text, 2:policyVersion UInt, 3:immutablePolicyBytes Bytes, 4:policyDigest Digest` |
| 4 | `NormalizedTopologyEffectV2` | `1:kind Enum(TopologyEffectKind), 2:baseRevisionId Id, 3:intentDigest Digest, 4:sourceWalls {WallSnapshotV1}, 5:outputWalls {WallSnapshotV1}, 6:contactGroups {ContactGroupV1}` |
| 5 | `WallSnapshotV1` | `1:wallSegmentId Id, 2:canonicalStart PointMmV1, 3:canonicalEnd PointMmV1, 4:thicknessMm Mm, 5:rootOccurrences {RootWallIntervalV2}` |
| 6 | `PointMmV1` | `1:xMm Mm, 2:zMm Mm` |
| 7 | `RootWallIntervalV2` | `1:rootWallId Id, 2:rootStart RationalV1, 3:rootEnd RationalV1, 4:currentWallId Id, 5:currentStart RationalV1, 6:currentEnd RationalV1, 7:orientationParity Enum(OrientationParity)` |
| 8 | `RationalV1` | `1:numerator SInt, 2:denominator UInt` |
| 9 | `ContactGroupV1` | `1:point PointMmV1, 2:affectedWallIds {Id}, 3:partitionParameters {WallParameterV1}` |
| 10 | `WallParameterV1` | `1:wallSegmentId Id, 2:parameter RationalV1` |
| 11 | `FaceKeyV3` | `1:ccwVertices [PointMmV1], 2:boundaryOccurrences [FaceBoundaryOccurrenceV2]` |
| 12 | `FaceBoundaryOccurrenceV2` | `1:boundaryOrdinal UInt, 2:wallSegmentId Id, 3:rootWallId Id, 4:rootStart RationalV1, 5:rootEnd RationalV1, 6:physicalSide Enum(PhysicalSide), 7:orientationParity Enum(OrientationParity)` |
| 13 | `RoomSurvivorMapV3` | `1:predecessorRoomId Id, 2:predecessorFaceDigest Digest, 3:successorFaceDigest Digest, 4:lineageDigest Digest, 5:contextDigest Digest` |
| 14 | `FaceLineageRelationV2` | `1:predecessorRoomId Id, 2:predecessorFaceDigest Digest, 3:successorFaceDigest Digest, 4:transition Enum(FaceTransitionKind), 5:oldOccurrences {FaceBoundaryOccurrenceV2}, 6:newOccurrences {FaceBoundaryOccurrenceV2}, 7:correspondences {RootOccurrenceCorrespondenceV2}, 8:contextDigest Digest` |
| union 1 | `SeedValueV1` | `1:ExplicitValue(record type 17), 2:ExplicitUnset(record type 38)` |
| union 2 | `RootOccurrenceCorrespondenceV2` | `1:RetainedRootOccurrenceV1(type 40), 2:RemovedRootOccurrenceV1(type 41), 3:CreatedRootOccurrenceV1(type 42)` |
| 16 | `NewRoomSeedV3` | `1:successorFaceDigest Digest, 2:allocatedRoomId Id, 3:name SeedValueV1, 4:type SeedValueV1, 5:metadata SeedValueV1, 6:heightMm Mm, 7:floorAssignment SeedValueV1, 8:ceilingAssignment SeedValueV1, 9:resourceBindings {ResourceBindingV1}` |
| 17 | `SeedValuePayloadV1` | `1:valueSchema Enum(SeedValueSchema), 2:valueBytes Bytes, 3:valueDigest Digest` |
| 18 | `ResourceBindingV1` | `1:semanticSlot Text, 2:resourceHash Digest, 3:mediaType Text, 4:assetUsageGrantId Text, 5:noticeDigest Digest, 6:backupFeasibilityDigest Digest` |
| 19 | `FieldDispositionV2` | `1:sourceRoomId Id, 2:fieldClass Enum(RoomFieldClass), 3:sourceProjectionDigest Digest, 4:action Enum(FieldAction), 5:targetSlots {TargetSlotV2}, 6:forwardValueDigest Digest, 7:inverseValueDigest Digest` |
| 20 | `TargetSlotV2` | `1:slotKind Enum(TargetSlotKind), 2:roomId Id?, 3:surface SurfaceAddressV2?, 4:valueDigest Digest?, 5:postProjectionDigest Digest?` |
| 21 | `RoomLossAcknowledgementV3` | `1:sourceRoomId Id, 2:sourceFaceDigest Digest, 3:fieldClass Enum(RoomFieldClass), 4:sourceProjectionDigest Digest, 5:disposition Enum(LossDisposition), 6:targetSlots {TargetSlotV2}, 7:forwardProjectionDigest Digest, 8:inverseProjectionDigest Digest` |
| 22 | `SurfaceAddressV2` | `1:kind Enum(SurfaceKind), 2:wallSegmentId Id?, 3:roomId Id?, 4:physicalSide Enum(PhysicalSide)?` |
| 23 | `WallHostResolutionSetV2` | `1:contextDigest Digest, 2:sourceInventoryDigest Digest, 3:rows {WallHostResolutionV2}, 4:targetInventoryDigest Digest` |
| 24 | `WallHostResolutionV2` | `1:source HostRecordV2, 2:action Enum(WallHostAction), 3:targets [HostRecordV2], 4:inverseSources [HostRecordV2], 5:contextDigest Digest, 6:proof WallSideProofV2` |
| 25 | `HostRecordV2` | `1:recordKey Digest, 2:kind Enum(WallHostKind), 3:wallSegmentId Id, 4:physicalSide Enum(PhysicalSide), 5:localStart ParameterQ2V1?, 6:localEnd ParameterQ2V1?, 7:elevationMm Mm?, 8:normalOffsetMm Mm?, 9:surface SurfaceAddressV2?, 10:valueDigest Digest?, 11:assetInstanceId Id?, 12:openingId Id?` |
| 26 | `WallSideProofV2` | `1:source TargetSideV2, 2:target TargetSideV2, 3:sourceOccurrenceDigest Digest?, 4:sourceExteriorOrbitDigest Digest?, 5:targetOccurrenceDigest Digest?, 6:targetExteriorOrbitDigest Digest?, 7:orientationParity Enum(OrientationParity), 8:wallSideTableDigest Digest` |
| 27 | `CeilingInventoryV2` | `1:contextDigest Digest, 2:baseSlots {CeilingSlotV2}, 3:explicitPostTargets {CeilingSlotV2}` |
| 28 | `CeilingSlotV2` | `1:assetInstanceId Id, 2:prePlacementDigest Digest?, 3:declaredPostPlacementDigest Digest?, 4:preKind Enum(PlacementKind)?, 5:postKind Enum(PlacementKind)?` |
| 29 | `CeilingResolutionV2` | `1:assetInstanceId Id, 2:inventoryDigest Digest, 3:action Enum(CeilingAction), 4:targetPlacementDigest Digest?, 5:deleteAcknowledgementDigest Digest?, 6:inversePlacementDigest Digest?` |
| 30 | `AllocationPlanV3` | `1:baseRevisionId Id, 2:purposes {AllocationEntryV1}, 3:expectedOutputKeys {Digest}` |
| 31 | `AllocationEntryV1` | `1:purposeBytes Bytes, 2:allocatedId Id` |
| 32 | `ResourcePreflightV2` | `1:semanticSlot Text, 2:binding ResourceBindingV1, 3:pinResultDigest Digest, 4:backupResultDigest Digest` |
| 33 | `ForwardPatchSetV3` | `1:fromStateDigest Digest, 2:toStateDigest Digest, 3:patches {PatchV2}, 4:resourceCommitments {ResourcePreflightV2}, 5:noticeCommitments {Digest}` |
| 34 | `InversePatchSetV3` | `1:fromStateDigest Digest, 2:toStateDigest Digest, 3:patches {PatchV2}, 4:resourceCommitments {ResourcePreflightV2}, 5:noticeCommitments {Digest}` |
| 35 | `PatchV2` | `1:entityKind Enum(EntityKind), 2:entityId Id, 3:beforeBytes Digest, 4:afterBytes Digest, 5:operation Enum(PatchOperation)` |
| 36 | `HistoryCommitmentV2` | `1:forwardFromRevisionId Id, 2:forwardToRevisionId Id, 3:forwardFromStateDigest Digest, 4:forwardToStateDigest Digest, 5:reverseFromRevisionId Id, 6:reverseToRevisionId Id, 7:reverseFromStateDigest Digest, 8:reverseToStateDigest Digest, 9:policy PolicyBundleRefV2, 10:retainedResourceDigest Digest` |
| 37 | `TargetSideV2` | `1:kind Enum(TargetSideKind), 2:roomId Id?, 3:faceDigest Digest?, 4:physicalSide Enum(PhysicalSide)` |
| 38 | `ExplicitUnsetV1` | `1:unsetMarker Enum(UnsetMarker)` |
| 39 | `RoomFieldProjectionV1` | `1:roomId Id, 2:fieldClass Enum(RoomFieldClass), 3:faceDigest Digest?, 4:slots {TargetSlotV2}, 5:valueDigest Digest` |
| 40 | `RetainedRootOccurrenceV1` | `1:oldOrdinal UInt, 2:newOrdinal UInt, 3:rootWallId Id, 4:rootAtomStart RationalV1, 5:rootAtomEnd RationalV1, 6:physicalSide Enum(PhysicalSide), 7:transition Enum(FaceTransitionKind)` |
| 41 | `RemovedRootOccurrenceV1` | `1:oldOrdinal UInt, 2:rootWallId Id, 3:rootAtomStart RationalV1, 4:rootAtomEnd RationalV1, 5:physicalSide Enum(PhysicalSide), 6:transition Enum(FaceTransitionKind)` |
| 42 | `CreatedRootOccurrenceV1` | `1:newOrdinal UInt, 2:rootWallId Id, 3:rootAtomStart RationalV1, 4:rootAtomEnd RationalV1, 5:physicalSide Enum(PhysicalSide), 6:transition Enum(FaceTransitionKind)` |
| 43 | `ParameterQ2V1` | `1:a SInt, 2:b SInt, 3:d UInt` (normalised dimensionless Q2 in `[0,1]`) |
| 44 | `SourceHostInventoryV2` | `1:records {HostRecordV2}` |
| 45 | `WallSideFaceTableV1` | `1:rows {WallSideFaceRowV1}` |
| 46 | `WallSideFaceRowV1` | `1:wallSegmentId Id, 2:physicalSide Enum(PhysicalSide), 3:target FaceSideTargetV1` |
| union 3 | `FaceSideTargetV1` | `1:FaceTargetV1(type 47), 2:ExteriorFaceTargetV1(type 48)` |
| 47 | `FaceTargetV1` | `1:faceDigest Digest, 2:boundaryOccurrenceDigest Digest` |
| 48 | `ExteriorFaceTargetV1` | `1:physicalSide Enum(PhysicalSide), 2:exteriorOrbitDigest Digest` |
| 49 | `RoomFaceInventoryV1` | `1:rooms {RoomFaceInventoryEntryV1}, 2:wallSideFaceTable WallSideFaceTableV1` |
| 50 | `RoomFaceInventoryEntryV1` | `1:roomId Id, 2:faceDigest Digest` |

`SeedValueV1` is a union, not a prose shorthand: `unionId 1`, variants
`1:ExplicitValue(record type 17)` and `2:ExplicitUnset(record type 38)`. Type
38 `ExplicitUnsetV1` has one required field `1:unsetMarker Enum(UnsetMarker)`
whose only member is `1:ExplicitUnset`. `RootOccurrenceCorrespondenceV2` is
the closed `unionId 2` in the registry table: a Retained row has both ordinals,
a Removed row has only old, and a Created row has only new. No zero ordinal or
optional-record convention represents absence. `TargetSlotV2` validates field
presence by `slotKind`: `RemovedNoSuccessor` has no optional fields;
`RoomField`, `Floor`, `Ceiling` require `roomId` and `valueDigest`;
`WallSide` requires `surface` and `valueDigest`; `NewSeed` requires `roomId`,
`valueDigest` and `postProjectionDigest`.  `TargetSideV2` validates that
`RoomTarget` has `roomId+faceDigest`, and `ExteriorTarget` has neither.
For each `WallSideProofV2.source` and `.target`, a `RoomTarget` requires its
matching occurrence digest and forbids its exterior-orbit digest; an
`ExteriorTarget` does the reverse. This is a tagged absence, not a
null/missing-face convention.

`ParameterQ2V1` is the Q2 normal form from §0: `d>0`, coefficients are
gcd-reduced, zero is exactly `(0,0,1)`, and the represented value is in the
closed unit interval. `SourceHostInventoryV2` and `RoomFaceInventoryV1` are
the exact roots of `preHostInventoryDigest` and `preRoomFaceInventoryDigest`.
Before Room identity, `WallSideFaceTableV1` uses its distinct `FaceSideTargetV1`
union; after identity, `WallSideProofV2` uses `TargetSideV2`. This prevents a
Room ID from entering a pre-identity digest.

`CanonicalBytesV2` is the protocol name, not a record type. The named
calculation-local forms in §§3–5 (`CameraSnapshotV2`, `CameraDeltaV2`,
`ScreenDistanceSqV2`, `C1KeyV1`, `PlanFaceTraversalV1`, `FaceRingSetV1`,
`FaceRunV1`, `Q2SegmentContactV1`, `LocalWallBasisV2`,
`MeasurementFormatPolicyV3`, `NoHolesAlphaV1` and `YawStepC8V1`) are
algorithms or bounded witnesses, not CanonicalBytesV2 values or digest roots.
If a future owner makes one durable evidence, it must first allocate a closed
registry row and byte vector; it may not be hashed as an unregistered named
structure.

### 2.3 Closed enum registry

| enumId | enum | members in memberId order |
| ---: | --- | --- |
| 1 | `TopologyEffectKind` | `1:AddWallSegment, 2:MoveVertex, 3:MoveWallSegment, 4:DeleteWallSegment, 5:SplitWallSegment, 6:MergeCollinearSegments, 7:ChangeWallThickness` |
| 2 | `OrientationParity` | `1:SameAsRoot, 2:ReversedFromRoot` |
| 3 | `PhysicalSide` | `1:Left, 2:Right` |
| 4 | `FaceTransitionKind` | `1:MoveWithinSameBoundary, 2:AddBoundarySegment, 3:DeleteBoundarySegment, 4:SplitBoundarySegment, 5:MergeBoundarySegments, 6:ThicknessOnly` |
| 5 | `OccurrenceRelationKind` | `1:Retained, 2:Removed, 3:Created` |
| 6 | `SeedValueSchema` | `1:Utf8Name, 2:RoomType, 3:MetadataRecord, 4:SurfaceAssignment` |
| 7 | `RoomFieldClass` | `1:IdentityAndFace, 2:CoreName, 3:CoreType, 4:CoreMetadata, 5:RoomHeight, 6:FloorAssignment, 7:CeilingAssignment, 8:WallSideAssignmentSet` |
| 8 | `FieldAction` | `1:RetainSameKey, 2:SetExplicitTarget, 3:RemoveAcknowledged` |
| 9 | `TargetSlotKind` | `1:RemovedNoSuccessor, 2:RoomField, 3:Floor, 4:Ceiling, 5:WallSide, 6:NewSeed` |
| 10 | `LossDisposition` | `1:Removed, 2:Transferred, 3:ClonedExplicitly, 4:ReplacedExplicitly` |
| 11 | `SurfaceKind` | `1:Floor, 2:Ceiling, 3:WallSide` |
| 12 | `WallHostKind` | `1:Opening, 2:WallPlacement, 3:WallSideAssignment` |
| 13 | `WallHostAction` | `1:KeepExact, 2:TransferContainedChild, 3:CloneFullSide, 4:CoalesceEqualFullSide, 5:MoveExplicit, 6:DeleteExplicit` |
| 14 | `TargetSideKind` | `1:RoomTarget, 2:ExteriorTarget` |
| 15 | `PlacementKind` | `1:Floor, 2:Wall, 3:Ceiling, 4:Absent` |
| 16 | `CeilingAction` | `1:Keep, 2:MoveAsset, 3:DeleteAsset, 4:ChangePlacementKind, 5:CreateAsset` |
| 17 | `EntityKind` | `1:Vertex, 2:WallSegment, 3:Room, 4:Opening, 5:AssetInstance, 6:SurfaceAssignment, 7:AssetDefinitionRef` |
| 18 | `PatchOperation` | `1:Add, 2:Replace, 3:Remove` |
| 19 | `UnsetMarker` | `1:ExplicitUnset` |

No enum has an implicit "other" member.  The only legal `Null` field is none
in this registry; an absence is represented by an omitted optional field.

### 2.4 Byte conformance vectors

The following are full byte vectors (spaces are presentation only) and their
SHA-256 over every shown byte, including `IECB2`.  They pin byte framing before
any production schema exists.

| Vector | Full bytes | SHA-256 |
| --- | --- | --- |
| `UInt(2)` root | `49 45 43 42 32 03 01 02` | `37006cbf7736681c929fc0b07460e3780200a487f57c481c8ee4ba32a5f01ad8` |
| `SInt(-1)` root | `49 45 43 42 32 04 01 01 01` | `480b44691f497b99fdca98a23854f9358aea0f981b6c4fafbff886d9a4ac7301` |
| empty `Set` root | `49 45 43 42 32 0D 00` | `aa51764f5fb4abde0a77fe0fff141f7024a10372d047c881e333969152385a35` |
| `ExplicitUnset` union root | `49 45 43 42 32 0B 01 02 0A 26 01 01 0C 13 01` | `b30dcd8570b681baa913d8280d17c6bd6146917639dc515c1e5d3a8307d4ca42` |

Before adoption, the executable corpus in §11 must add full valid
`R5ImpactEnvelopeV1` vectors for every union/enum branch, including the digest
of context, forward/inverse patch set and final ChangeSet.  This is evidence
required by R5, not a claim that those tests already exist.

## 3. Total presentation ingress, C1–C4 and closed selection

### 3.1 One internally consistent CSS-U camera

The selection canvas must have `computedCanvasTransform == none` and default
transform origin.  Raw fields are read in this field order:

```text
clientX, clientY, canvasRect.left, canvasRect.top,
rawPanXCss, rawPanYCss, rawScaleCssPerMm
```

Each must be a finite binary64.  `-0` is canonicalised to `+0`, then decoded
losslessly to a rational before any `BigInt` operation.  The first non-finite,
out-of-cap or transformed input returns
`CANDIDATE_UNDETERMINED/SNAPSHOT_OUT_OF_RANGE`.

R5 uses the following units everywhere:

```text
U = 1 / 256 CSS px
Z = 2^16
H_U = 5632                         // closed 22 CSS-px hit half-width

relativeXU = roundHalfToEven((clientX - rect.left) / U)
relativeYU = roundHalfToEven((clientY - rect.top) / U)
panXU      = roundHalfToEven(rawPanXCss / U)
panYU      = roundHalfToEven(rawPanYCss / U)
scaleNumerator = roundHalfToEven(rawScaleCssPerMm * 256 * Z)
```

`scaleNumerator` has unit `CSS-U × Z / mm`, is positive, and is stored with
no denominator.  A finite positive raw scale that rounds to zero fails before
inverse projection.  Define:

```text
pointerXUZ = (relativeXU - panXU) * Z
pointerYUZ = (relativeYU - panYU) * Z

CameraSnapshotV2 {
  panXU, panYU, scaleNumerator, cssTransform: IdentityOnly
}

CameraDeltaV2 {
  dxNumerator = pointerXUZ - originXmm * scaleNumerator
  dzNumerator = -pointerYUZ - originZmm * scaleNumerator
  denominator = scaleNumerator
}
```

`CameraDeltaV2` represents the pointer's inverse-projected displacement from
the immutable active origin `P=(originXmm,originZmm)`.  It deliberately keeps
one common denominator and is not itself `ExactRationalMm`.  For any world
witness `W=(xNum/d,zNum/d)` where `d>0`, the sole C1/RayProbe screen equation
is:

```text
sx = xNum * scaleNumerator - d * pointerXUZ
sy = -zNum * scaleNumerator - d * pointerYUZ
ScreenDistanceSqV2(W) = (sx^2 + sy^2) / (d * Z)^2       // CSS-U^2
```

`W` is inside the closed hit square exactly when
`abs(sx) <= d*Z*H_U` and `abs(sy) <= d*Z*H_U`.  Thus at one CSS px/mm,
zero pan and origin `(0,0)`, a pointer 100 CSS px right has
`relativeXU=25,600`, `scaleNumerator=16,777,216`, and inverse x delta exactly
100 mm—not 25,600 mm.  No DPR, page zoom, renderer transform or browser
pixel hit-test changes this policy.

An `activeOrigin` must be an existing Vertex of the stated base Revision or an
explicit in-limit `SafeIntegerMm` pair that is part of the current gesture.  It
is checked before `CameraDeltaV2`; missing/stale/mismatched origin is exactly
`ACTIVE_ORIGIN_STALE_OR_MISSING`, never a nearest-vertex fallback.

### 3.2 Candidate classes and C1's complete winner key

The ordered construction is C1 → RayProbe/C2 → C3 (empty in Alpha) → C4.
When a class yields a result, no later class is evaluated.  This removes any
cross-class score comparison.

`C1` enumerates every canonical Vertex in the closed square from §3.1, sorted
by the following *complete* ascending key:

```text
C1KeyV1 = (
  classOrdinal = 1,
  screenDistanceNumerator = sx^2 + sy^2,
  worldXmm,
  worldZmm,
  canonicalVertexIdBytes
)
```

All C1 candidates have denominator `Z²`, so the numerator alone is comparable.
`worldXmm/worldZmm` are signed integer order and `canonicalVertexIdBytes` is
the final opaque tie-breaker.  Coordinate uniqueness is still a Plan invariant;
the ID field makes malformed-input rejection deterministic rather than allowing
collection order to decide it.  C1 returns the unique least key whenever the
set is non-empty.  Only an empty C1 set permits RayProbe.

For C2 and metric visible-feature selection, the generic exact key is
`(classOrdinal, squaredDistanceNumerator, squaredDistanceDenominator,
witnessCoordinates, fixedDirectionOrdinal, sortedHostKeyBytes, sourceKeyBytes)`.
Fractions compare by cross multiplication under the presentation cap.  All
tuple fields are present; no hash-map/insertion/DOM order is observable.

### 3.3 Bounded RayProbe and C2

The fixed clockwise direction list is:

```text
D0=(0,1), D1=(1,1), D2=(1,0), D3=(1,-1),
D4=(0,-1), D5=(-1,-1), D6=(-1,0), D7=(-1,1)
```

Let `S` be all WallSegments sorted by canonical endpoint pair, then stable ID
bytes.  Count `8*|S|` before creating a probe; a breach returns `RAY_PROBE_LIMIT`.
For `P + λd` and segment `R→T`, calculate exactly:

```text
D       = cross(d, T-R)
Nlambda = cross(R-P, T-R)
Nmu     = cross(R-P, d)
```

If `D != 0`, normalise `λ=Nlambda/D` and `μ=Nmu/D`; the finite positive ray
contact condition is `λ>0` and `0<=μ<=1`.  An integral coordinate is a C2
candidate; a non-integral coordinate is a blocker.  If `D=0`, use the fixed
nonzero component of `d` to derive the segment's exact λ interval.  A disjoint
or parallel-noncollinear interval is `NoProbe`; a singleton λ>0 is handled as
the same finite contact; λ=0 belongs only to C1; a positive collinear interval
is a `CollinearOverlapBlocker` when its exact closest point is in the closed
hit square.  Its closest parameter is exactly
`clamp((dxNumerator*d.x + dzNumerator*d.z)/(q*norm2(d)), interval)`; no float
projection or screen approximation supplies the clamp.

Group rows by canonical point or interval bytes and choose the least generic
key.  At equal screen distance, blocker kind order is
`NonIntegerContactBlocker < CollinearOverlapBlocker < IntegralContact`; a
winning blocker returns its named Draft and suppresses C2/C3/C4.  C3 has the
closed empty generator set in Alpha, so it always proceeds to C4.

### 3.4 C4: threshold before direction, exact multiplier, no fallback

Let `q = CameraDeltaV2.denominator` and define the previously unnamed integer:

```text
mNumerator = max(abs(dxNumerator), abs(dzNumerator))
```

The **first C4 operation** is the strict test
`mNumerator < 50*q`.  If true, return
`CANDIDATE_UNDETERMINED/C4_DELTA_BELOW_MINIMUM`; do not rank directions.  It
also covers exactly zero delta.  If false, rank only directions with

```text
n_d = dxNumerator*d.x + dzNumerator*d.z > 0
score(d) = n_d^2 / norm2(d)
```

Compare scores by positive-denominator cross multiplication and break equality
by the fixed direction ordinal.  At least one `n_d` is positive after the
threshold; otherwise the input is invalid and returns the same below-minimum
Draft, not an unhandled empty set.

Choose `k` as the nearest positive integer to `mNumerator/(100*q)` as follows:

```text
unit = 100*q
a = floor(mNumerator / unit)
r = mNumerator mod unit
lower = max(1, a)
upper = a + 1
if 2*r < unit: k = lower
if 2*r > unit: k = upper
if 2*r = unit: k = lower       // lower positive integer wins the exact tie
```

At `mNumerator=50*q`, `k=1`; at 0 no direction exists because the earlier
Draft branch already returned.  The only C4 endpoint is
`P + 100*k*chosenDirection`.  It either passes ordinary ProjectLimits and
enters the common topology path, or returns `C4_OUT_OF_PROJECT_BOUNDS`.
There is no smaller-k retry, alternate direction, hysteresis or approximate
screen-space fallback.

### 3.5 Closed measurement target language

Selection is session-only.  A target is exactly one of:

```text
PlanPoint = ExistingVertex { vertexId }
          | UsableVertex { roomId, faceDigest, vertexOrdinal }
          | AssetFootprintVertex { assetInstanceId, footprintDigest, vertexOrdinal }
          | ExactNumericMm { xMm, zMm }

MetricBoundary = MetricEdge { source: WallCenterline | UsableBoundary | AssetFootprint,
                              sourceId, faceOrFootprintDigest, edgeOrdinal }
               | MetricWholeBoundary { source: UsableBoundary | AssetFootprint,
                                        sourceId, faceOrFootprintDigest }
```

`MetricEdge` expands to exactly one oriented segment. `MetricWholeBoundary`
expands to every segment of that named current ring in canonical edge ordinal
order; it cannot name a Wall because a Wall centerline is already one segment.
The target tag is part of the source key, so an edge is never silently treated
as the whole ring.  A stale digest, missing ordinal, non-admitted footprint or
touch with no visible/exact source returns `MEASUREMENT_SELECTION_UNRESOLVED`.

## 4. Integer planar faces, ring sets and the no-holes gate

### 4.1 `PlanFaceTraversalV1`: exact darts, turns and exterior

Traversal begins only after the existing total exact-contact normalisation has
produced a finite integer Plan with no zero segment, duplicate, positive
collinear overlap or unsplit contact.  It is not an old/new overlay and does
not call an unspecified computational-geometry face extractor.

1. For each WallSegment choose a **canonical physical orientation** from the
   lexicographically smaller endpoint `(xMm,zMm,vertexIdBytes)` to the larger.
   It produces two darts `Forward` and `Reverse`.  A dart has a `tail`, `head`,
   `wallSegmentId`, `parity` and one C8 direction.
2. At every vertex, list outgoing darts in ascending CCW direction order
   `E, NE, N, NW, W, SW, S, SE`.  Two non-twin outgoing darts with the same
   direction are a rejected collinear Plan condition; the twin/segment ID is
   retained as a defensive final sort key only after that invariant check.
3. The successor of dart `d: A→B` is the outgoing dart at `B` immediately
   **clockwise** from `twin(d)`—the predecessor of `twin(d)` in that vertex's
   cyclic CCW list.  This is the unique turn which keeps the same planar face
   on the left of the walk.  At degree one it is `twin(d)`.
4. Apply successor from every lexicographically sorted unvisited dart until it
   returns to the start.  Successor is a permutation of the finite dart set;
   reaching an already visited different dart is `REPEATED_DART`, never an
   implicit break.  Store every orbit once, keyed by its lexicographically
   least `(tail,head,wallSegmentId,parity)` cyclic rotation.
5. For its **ring reduction only**, repeatedly remove the lexicographically
   least cyclic adjacent pair `(d,twin(d))` until none remains.  Keep the
   unreduced orbit for the physical-side table.  An empty/reduced walk of fewer
   than three darts is `ExteriorBridgeOrOpenTail`, never a ring or Room.
6. Compute each remaining reduced orbit's integer signed twice-area by shoelace. A positive
   simple orbit is a left-bounded CCW ring candidate. A negative simple orbit
   is a clockwise boundary of the unbounded/holed side. Any remaining
   zero-area orbit rejects as `CENTERLINE_FACE_INVALID/NON_SIMPLE_ORBIT`.
7. A positive/negative orbit is simple only when it has at least three
   distinct vertices, repeats no vertex other than closure, and every
   non-adjacent integer edge pair is disjoint.  A positive non-simple orbit
   rejects the entire candidate with the exact subtype in §1.  A negative
   non-simple orbit belongs only to the exterior union if it contains a bridge
   pair; otherwise it rejects for the same subtype.  This preserves valid open
   tails and bridges without pretending that they are Rooms.

The **exterior** is the named union of: all negative simple orbit sides with no
strictly containing positive ring (§4.2), all bridge/open-tail orbits, and any
side not represented by a valid bounded Room face.  It is not a synthetic
Room/Face key, and it carries no candidate Room ID.

### 4.2 `FaceRingSetV1`: containment, witness, parent and contact

Every simple ring is normalised to CCW and rotated to the least cyclic sequence
of `(vertex coordinate,next coordinate,wall ID)`.  The following exact
construction makes hole classification independent of a geometry library.

**Strict interior witness.**  For a simple ring, sort its distinct vertex
`z` values.  For every consecutive pair `(z_i,z_{i+1})`, form the rational
scanline `z=(z_i+z_{i+1})/2`.  Intersect it with all non-horizontal ring edges
using the half-open rule `minZ <= z < maxZ`; sort the rational x intersections.
Each even/odd adjacent pair bounds an open interior interval.  Select the
least `(z, intervalIndex)` with a non-empty interval and use its rational
midpoint.  A simple nonzero ring must produce one; otherwise it is
`NON_SIMPLE_ORBIT`.  This witness is strictly interior, never a vertex/edge.

For two non-equivalent rings A and B, `A contains B` iff every B vertex is
strictly inside A under the half-open winding predicate, no B edge contacts an
A edge, and `Witness(B)` is strictly inside A. A boundary contact is exactly
an equal vertex, a point touch, an edge cross or a positive collinear overlap.
Two rings are `TwinBoundary` only when their complete canonical cyclic
coordinate/wall sequence is byte equal after reversal; that pair represents
the two sides of one physical boundary and is excluded from contact testing.

`NestedCandidate(A,B)` holds only when `Witness(B)` is strictly inside A or on
A's boundary. A non-twin boundary contact is `TouchingRings` **only** for such
a nested candidate. A contact between two independently adjacent Plan faces
whose witnesses lie on opposite sides of their shared wall is ordinary planar
adjacency and is not a hole/contact ring. This distinction is essential for
valid multi-room Plans.

`FaceRingSetV1` is built in this order:

1. keep all positive simple orbits as `outer` rings and all negative simple
   orbits as `opposite` rings;
2. for each opposite ring, find the set of positive outers that contain it;
   it has no parent when the set is empty, otherwise its parent is the
   containing outer with the least absolute twice-area, then least canonical
   ring bytes;
3. assign depth 0 to parentless positive outer rings; the depth of a contained
   opposite ring is parent depth + 1.  A positive outer strictly contained by
   a different positive outer is marked `NestedRing` even if its twin is also
   a hole boundary;
4. any non-twin boundary contact in a `NestedCandidate` pair is
   `TouchingRings`; any positive outer with one or more assigned opposite
   children is `HasInnerRing`; independent
   depth-0 positive outers with no children are `DisconnectedOuter` and each
   becomes a separate valid face;
5. output face sets sorted by their outer canonical ring bytes; within a face,
   holes are sorted by their canonical ring bytes.

`NoHolesAlphaV1` rejects any candidate with `HasInnerRing`, `NestedRing` or
`TouchingRings`, before `FaceKeyV3`, Room identity, usable offsets, host
resolution or allocation.  A valid Alpha face is therefore exactly one simple
positive outer ring with no child hole.  This is an explicit proposed delta:
the current Geometry Contract mentions hole goldens and miter-then-bevel; it
must be reconciled by its owner rather than overwritten here.

### 4.3 Face key and complete side table

For each valid one-ring face construct `FaceKeyV3` (type 11) from its ordered
CCW boundary.  Every boundary item is a `FaceBoundaryOccurrenceV2` containing
the root wall, exact root interval, current segment, physical side and
orientation parity.  Its digest is the `faceFingerprint`.

Build `WallSideFaceTableV1` **before** Room ID resolution.  For each Wall's
canonical orientation `A→B`:

```text
physical Left  = face to the left of its Forward dart
physical Right = face to the left of its Reverse dart
```

The traversal orbit records the face left of every dart. Before Room identity,
a valid Alpha face becomes `FaceTargetV1 { faceDigest,
boundaryOccurrenceDigest }`; an exterior/bridge/hole/unbounded side becomes
`ExteriorFaceTargetV1 { physicalSide, exteriorOrbitDigest }`. They are the
closed `FaceSideTargetV1` union, not a missing Room ID. There are exactly two
`WallSideFaceRowV1` rows per current Wall, sorted `(wallSegmentId, Left|Right)`,
and exactly one target per row. Missing, duplicate or invalid rows reject as
`SIDE_TABLE_INVALID`. A table has no nearest polygon, lexical Room ID or
renderer inference path.

After Room identity resolution (§7), replace each `FaceTarget` with
`RoomTarget { roomId, faceDigest }`.  The exterior remains the distinct
`ExteriorTarget { physicalSideProof }` union variant; it has no fabricated
`candidateFaceKey`. Thus an ordinary interior/exterior wall side is fully
serializable, while a host on a wall whose two physical sides are both exterior
is rejected by the host policy in §7.

## 5. Q2 usable geometry and exact metrics

### 5.1 Miter-only usable polygon with exact run and cap rules

For each valid CCW centerline face, interior is left of each edge.  First make
`FaceRunV1` cyclically:

* consecutive equal oriented directions and equal thickness collapse into one
  derived run while retaining the complete ordered source occurrence list;
* equal direction with different thickness rejects
  `USABLE_POLYGON_COLLAPSED/Q2_COLLINEAR_THICKNESS_STEP`;
* opposite direction/180-degree turn rejects `Q2_BACKTRACK`;
* no zero determinant reaches a miter calculation.

For a run `A→B`, let `(ux,uz)` be its permitted C8 direction and `t` its
integer thickness.  Its inward offset is exactly:

```text
cardinal (ux*uz = 0): o = t/2 * (-uz, ux)
diagonal (abs(ux)=abs(uz)=1): o = t*sqrt(2)/4 * (-uz, ux)
```

All offset endpoints are Q2.  For adjacent runs `A→B` and `B→C`, let
`p=A+oPrev`, `q=B+oNext`, `u=B-A`, `v=C-B`, and `D=cross(u,v)`.  `D` is a
nonzero integer after run normalisation.  The only join is:

```text
lambda = cross(q-p, v) / D
miter = p + lambda*u
```

It is accepted iff the exact Q2 miter-cap comparison holds:

```text
distanceSquared(miter, B) <= (2*max(tPrev,tNext))^2
```

Equality uses the miter; strict excess rejects `Q2_MITER_CAP_EXCEEDED`.
There is no bevel fallback.  The proposed miter-only rule remains a material
source delta from the current miter-then-bevel contract.

Remove adjacent duplicate miter vertices, reject zero edges, and accept the
derived ring only if it has at least three edges, positive Q2 shoelace area,
adjacent edges share only their intended endpoint, and every non-adjacent pair
is disjoint.  `Q2SegmentContactV1` uses exact orientation plus closed interval
comparison: `Disjoint | SinglePoint | PositiveCollinearOverlap`.  A point is
strictly inside a simple Q2 ring only after boundary rejection, using the
half-open winding rules `Az<=Pz<Bz`/`Bz<=Pz<Az` and exact orientation.  No
float epsilon, mesh or generic polygon default is allowed.

### 5.2 Normalised metric footprints and C8 orientation

At catalog/definition admission, a metric-ready footprint is converted once to
an exact local Q2 ring.  It must have 3–64 finite vertices, nonzero edges,
positive area, no self-contact and **CCW** winding.  A clockwise simple input
is reversed before digesting; a non-simple/zero input rejects
`METRIC_FOOTPRINT_INVALID`.  Its `footprintDigest` is the digest of that
normalised CCW sequence, declared anchor basis and permitted yaw policy.

The same normalised ring and digest are used for metric extraction, floor/ceiling
strict-containment and wall host validation.  A metric path cannot accept a
CW asset which a host path later rejects.

`YawStepC8V1 = 0..7` is rotations only, modulo eight: `R(x,z)=((x-z)*sqrt(2)/2,
(x+z)*sqrt(2)/2)`, applied `k` times, followed by integer-mm translation.
Reflection, negative scale and arbitrary yaw are excluded.  This is a proposed
catalog/placement source delta; a legacy asset receives
`METRIC_ORIENTATION_INCOMPATIBLE`, never a float bounding-box approximation or
`MEASUREMENT_UNSUPPORTED`.

### 5.3 Exact metric witness and boundary expansion

Each `MetricBoundary` from §3.5 expands to a finite canonical segment list.
Canonicalise the two target source keys before enumeration.  For every
point/point, point/boundary or boundary/boundary pair enumerate only: exact
intersection/overlap; endpoint on finite segment; strict interior orthogonal
projection; and endpoint pair.  All Q2 dot/cross/range operations are exact.

The least candidate key is:

```text
(squaredDistanceQ2, kindOrdinal[Zero=0, EndpointOn=1,
 InteriorProjection=2, EndpointPair=3], orderedFeatureRefs,
 orderedWitnessPoints, leftTargetKey, rightTargetKey)
```

The tag `MetricEdge` versus `MetricWholeBoundary` is included in target keys,
feature refs and every witness.  A minimum distance and formatting result is
therefore stable even when only one edge versus the whole object boundary was
selected.

### 5.4 Formatter: direct equality at a decimal half-cell

`MeasurementFormatPolicyV3` accepts either `RootQ2 { squaredMm2:q }` (a
distance whose display value is `sqrt(q)`) or `DirectQ2 { value, unitScale }`
(usable perimeter or area already represented as a Q2 scalar).  It never uses
`Number`, `Math.sqrt`, `Intl` or locale rounding. Unit conversion is an exact
decimal scale `c`: `1` for mm length/perimeter and `1/1_000_000` for area m².
With `f` fixed fraction digits, a candidate printed integer `n` represents
`n/(10^f)` in display units. Its half-cell boundaries are:

```text
L(n) = (2*n-1) / (2*10^f)
U(n) = (2*n+1) / (2*10^f)
```

For `RootQ2`, compare `sqrt(q)*c` with either nonnegative rational boundary
`h=p/s` by comparing `q*c²*s²` to `p²` using `SignQ2`. For `DirectQ2`, compare
`value*c*s` directly with `p`. For a negative lower boundary, either value is
strictly above it. These comparisons decide below/equal/above without waiting
for binary bisection. Choose the unique cell under half-open intervals
`(L(n),U(n))`; when exactly on a shared half, choose the even `n`.
`exactAtPrintedPrecision` is true iff `q*c²*(10^f)^2 = n²` for `RootQ2`, or
`value*c*(10^f)=n` for `DirectQ2`; it is not an interval heuristic.

R5 fixes `Length/Perimeter` as millimetres with 2 fraction digits and `Area`
as square metres with 3.  The returned ASCII decimal token plus quantity/unit
is the one datum shared by Preview, 2D, 3D and export; localisation may add
labels but cannot recompute it.  Bounded interval refinement is permitted only
to find a candidate `n`; the direct comparison above decides all boundaries.
If the cap is reached first, return `GEOMETRY_EXACT_LIMIT/METRIC_FORMATTER`.

## 6. Room identity without changed-face automation

### 6.1 Map-independent input context and topology skeleton

The immutable `SingletonContextV2` is constructed **once** after detached
integer contact normalisation and `PlanFaceTraversalV1`, but before any map,
seed, Room allocation, field disposition, host resolution, resource check or
confirmed output is accepted. Its digest is over exactly its type-2 bytes.

Its `effectInputDigest` is the digest of a `NormalizedTopologyEffectV2` whose
input is limited to: base command intent; base wall snapshots/root intervals;
contact groups; and the topology-only output Wall/Vertex identity reservation
that is fixed by the command before Room choices. It contains no Room ID,
survivor map, seed, field mutation, host target, allocation purpose for a
Room/asset, resource commitment, impact or inverse. `preHostInventoryDigest`
is `Digest(SourceHostInventoryV2)` extracted from the base Project only;
`preRoomFaceInventoryDigest` is `Digest(RoomFaceInventoryV1)` over the base
derived face/Room set and its complete pre-identity `WallSideFaceTableV1`.

This ordering is mandatory:

```text
base Project + fenced command + immutable policy
  -> topology skeleton/effect + FaceKeyV3 + base inventories
  -> SingletonContextV2 digest
  -> confirmed map/seed/loss/host/ceiling choices
  -> complete allocation plan + forward/inverse patches
  -> R5ImpactEnvelopeV1 digest
```

No record contains its own digest. A phrase such as `FaceDigest`,
`ContextDigest`, `EffectDigest`, `AllocationDigest`, `InventoryDigest` or
`PatchSetDigest` means the SHA-256 of the separately encoded record *without*
a field for that same digest. This prevents an allocation/map/context self-cycle.
Every relation/map/host/ceiling row below contains exactly the same
`ContextDigest`; a missing, duplicated or unequal context reference is
`TOPOLOGY_TRANSFER_CONTEXT_MISMATCH`.

The context also fences one `projectId`, base Revision and `baseStateDigest`.
The application writer lease/fencing token is checked alongside it, but is not
placed in user Project data. A same-looking clone, stale revision, different
writer or changed immutable policy cannot replay the context.

### 6.2 Complete side-aware lineage relation

For each proposed changed-face retention, derive an expected relation from the
old and new `FaceKeyV3` occurrence sets—not from a supplied partial witness.
For each `(rootWallId, rootPhysicalSide)`, take all old/new root interval
endpoints, sort/deduplicate them as exact rationals, and partition their union
into nonzero **atomic root intervals**. For each atom, read its owner on each
side from the face occurrences:

```text
Retained: old and new occurrence cover the atom
Removed:  old occurrence covers it, new does not
Created:  new occurrence covers it, old does not
```

An atom with multiple old or multiple new owners, an interval outside a
declared root occurrence, mismatched root physical side, zero interval or
unexplainable topology effect rejects the relation. The supplied set must be
byte-equal to the complete expected sorted set; it may not omit inconvenient
predecessor/successor boundary portions. Every old and every new boundary
occurrence is covered by the union of its atom rows, with no gap or overlap.
Each `RootOccurrenceCorrespondenceV2` uses `Retained` with both ordinals,
`Removed` with only `oldOrdinal`, or `Created` with only `newOrdinal`; the
required/absent fields are enforced by its union-kind registry, not inferred
from a zero ordinal.

`FaceTransitionKind` is selected only from `NormalizedTopologyEffectV2.kind`:

| Effect | relation transition |
| --- | --- |
| `AddWallSegment` | `AddBoundarySegment` |
| `MoveVertex` or `MoveWallSegment` | `MoveWithinSameBoundary` |
| `DeleteWallSegment` | `DeleteBoundarySegment` |
| `SplitWallSegment` | `SplitBoundarySegment` |
| `MergeCollinearSegments` | `MergeBoundarySegments` |
| `ChangeWallThickness` | `ThicknessOnly` |

`UnchangedFingerprint` is an automatic route and never a changed-face map.
There is no catch-all/replaced/unknown transition. A valid changed-face
relation has at least one `Retained` atom and has complete old/new coverage;
otherwise it cannot preserve an ID. It proves eligibility only, not a chosen
survivor.

### 6.3 Identity routes and `RoomSurvivorMapV3`

After the no-holes gate, exactly one route applies to each successor face:

| Condition | Required route |
| --- | --- |
| Exactly one predecessor has byte-identical `FaceKeyV3` digest | automatic retain of the same Room ID. |
| Different face digest and one valid confirmed map entry | retain the mapped predecessor Room ID. |
| Different face digest and no map entry | new allocated Room ID and one complete `NewRoomSeedV3`. |
| Map entry missing relation/context, references an unchanged face, is stale, duplicates a predecessor/successor, or disagrees with the expected relation | reject `ROOM_SURVIVOR_MAP_INVALID`. |

The sorted map is partial-injective in both dimensions and is keyed by
successor face digest. Its relation digest is recomputed from the complete
relation in §6.2 and its context digest must equal the singleton. A map is
never inferred from geometry, overlap, score, area, name, ID ordering,
proximity or renderer state. Map absence is intentional and must be shown as a
seed/loss route before confirmation; a supplied but invalid map is a reject,
not a silent downgrade.

This automatic-unchanged-only decision is an explicit proposed reconciliation
of the still-open FR-15/Geometry Contract matching rule. It does not claim to
have changed those sources.

### 6.4 Closed seeds, fields and loss acknowledgements

Each new successor Room has exactly one `NewRoomSeedV3` before height-dependent
Opening, adjacency or host validation. Its name/type/metadata/floor/ceiling
fields are each a `SeedValueV1` union: either a registered explicit payload
with bytes+digest or the one-value semantic `ExplicitUnset`. `heightMm` is
always explicit, lossless and inside current ProjectLimits. No Level default,
predecessor suggestion, renderer value, UI placeholder or implementation
default can fill a seed.

Every explicit seed resource value has a `ResourceBindingV1` for its exact
semantic slot: pinned content hash, media type, AssetUsageGrant identity,
notice digest and BackupFeasibility result. The binding is checked before the
seed becomes part of a complete ChangeSet. A catalog outage never substitutes
for local pinning; unavailable bytes remain a preview/catalog condition.

The eight `RoomFieldClass` members in §2.3 form a closed matrix. For every
base Room/class, preflight emits exactly one of:

* `RetainSameKey` with identical source/target semantic key and forward/inverse
  value digest;
* `SetExplicitTarget` with all target slots and forward/inverse value digest;
* `RemoveAcknowledged` with a matching `RoomLossAcknowledgementV3`.

`IdentityAndFace` is system-derived but still participates: unchanged/mapped
identity replaces only its derived face key; a new Room seed owns its new ID;
a removed predecessor identity receives an acknowledgement. Floor, ceiling and
wall-side assignment values are not hidden fields of `RoomCore`.

`RoomLossAcknowledgementV3` has one row per `(sourceRoomId, fieldClass)`,
sorted by that full key. It carries the source face/projection digest, closed
disposition, every explicit target slot, complete forward digest and complete
inverse digest. Its target slots cover all dispositions: removal with no
successor, one transfer, explicitly confirmed clone, or explicitly confirmed
replacement. For a lost Room it has exactly eight rows; for a retained Room it
has one row for each destructive/explicitly replaced class. The union of all
slot keys must equal the candidate post-state slots for that source class.
Missing, duplicate, extra, stale, gap, value-equal-but-unrecorded or
inverse-incomplete acknowledgement is `ROOM_LOSS_ACK_INVALID`.

Its three projection digests are non-recursive: each is the digest of a closed
`RoomFieldProjectionV1` containing only Room/field identity, optional face,
sorted slots and value digest. The acknowledgement record itself is not an
input to a projection digest or its own forward/inverse digest.

No field is silently distributed to a split/merge child. In particular,
`Room.heightMm` remains the sole editable height source and cannot be seeded
from an exterior projection/default.

## 7. Total topology-host transfer

### 7.1 Pre-resolution host inventory and local basis

Before map/target acceptance, derive `SourceHostInventoryV2` from the fenced
base Project. It contains one `HostRecordV2`, sorted by `recordKey`, for every
existing `Opening`, `WallPlacement` and `WallSideAssignment`. Its digest is the
context's `preHostInventoryDigest`. An unknown/unversioned host kind is
`UNKNOWN_WALL_HOST_RECORD_KIND` before any transfer branch.

For an Opening or WallPlacement, the source has a nonzero closed-local span
`0 <= start < end <= 1` along its wall's canonical physical orientation. Both
endpoints are normalised `ParameterQ2V1`, reconstructed from canonical host
bytes; point anchors are never widened. Let `V=B-A` and
`L2=V.x^2+V.z^2` for the canonical wall endpoints. For an Opening with
canonical physical along-wall `offsetMm` and `widthMm`, its span is exactly
`[offsetMm/sqrt(L2), (offsetMm+widthMm)/sqrt(L2)]`. For a WallPlacement, take
the minimum and maximum of `dot(X-A,V)/L2` over every canonical transformed
footprint boundary vertex `X`. Cardinal walls therefore yield rational values;
45-degree walls yield exact Q2 values. A missing, zero-width, out-of-range or
otherwise non-normalisable span rejects `HOST_REBASE_UNSUPPORTED` before a
transfer route. Elevation, normal offset, orientation and asset/opening
identity are part of the record key. A WallSideAssignment has no interval; it
has complete `SurfaceAddressV2` and value bytes/digest.

`LocalWallBasisV2` is derived from the canonical endpoint order, its physical
side, root interval and orientation parity. A source record's root physical
side is:

```text
rootSide = sourceSide when parity = SameAsRoot
         = opposite(sourceSide) when parity = ReversedFromRoot
```

The target side is valid only when its derived root side is the same. This
calculation plus the complete `WallSideFaceTableV1` evidence forms
`WallSideProofV2`; proximity, current polygon order, a Room name or a renderer
normal cannot prove a target.

### 7.2 One closed resolution row for every host

`WallHostResolutionSetV2.rows` contains **exactly one** row for every source
inventory record and no row for any other key. Its target records, sorted by
their full `recordKey`, must equal the entire candidate post-topology wall-host
inventory byte-for-byte. Thus missing source rows, duplicate rows, an omitted
WallPlacement alongside a material address, orphan target rows, extra target
records, mismatched source inventory digest or a target set mismatch reject
`WALL_HOST_RESOLUTION_INVALID`.

The target side is a closed union:

```text
RoomTarget     { roomId, faceDigest, physicalSide }
ExteriorTarget { physicalSide, WallSideProofV2 }
```

It is carried in the proof, not overloaded into a missing `candidateFaceKey`.
The current persistent semantic `SurfaceAddress` remains
`WallSide(WallSegmentId, AdjacentRoomId | ExteriorSide)`; physical left/right
is validation evidence. A wall with both physical sides `ExteriorTarget` may
exist, but any `WallPlacement` or `WallSideAssignment` on it rejects
`TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED`, preventing two values from collapsing
onto the one canonical `ExteriorSide` token.

### 7.3 Same-ID geometry, partition and merge disposition

R5 selects reject/explicit action rather than an automatic rebase:

* `KeepExact` is legal only when the source and target WallSnapshot bytes are
  identical and the complete host record bytes are identical except for a
  recomputed equal proof. It is the only automatic action.
* When a WallSegment keeps its ID but any endpoint, canonical orientation or
  thickness differs, every Opening and WallPlacement on it requires either
  `MoveExplicit` with a complete target HostRecord and inverse source, or
  `DeleteExplicit` with a user acknowledgement and inverse restore. No
  preserved absolute/relative offset, elevation, normal offset or orientation
  is inferred. A WallSideAssignment can retain only if its semantic address,
  value and derived root-side proof are byte-identical; otherwise it also needs
  an explicit target/disposition.
* For a split, a source Opening/WallPlacement may use
  `TransferContainedChild` only when exactly one child occupies source-root
  interval `[a,b]` and source span `[s,e]` satisfies `a <= s < e <= b`. The
  root endpoints are embedded in `ParameterQ2V1` as `(r.numerator,0,
  r.denominator)` before comparison; all four values and the derived child-local
  span `[(s-a)/(b-a), (e-a)/(b-a)]` are normalised Q2. Derived canonical host
  bytes must be integral/valid without rounding; otherwise reject
  `HOST_REBASE_UNSUPPORTED`. A span crossing a child boundary always rejects
  `PARTITION_ATTACHMENT_CROSSES_CHILD_BOUNDARY`; R5 has no interval split rule.
* A full-side assignment may use `CloneFullSide` only when the target list is
  the complete proven set of child sides covering the same root side, every
  target has the exact same value/resource commitment, and the inverse is the
  one explicit collapse to the source record. It may not clone an Opening or
  WallPlacement.
* `CoalesceEqualFullSide` is the only automatic merge action and is legal only
  for a contiguous same-root, same-thickness, same-parity side set whose values
  and resource commitments are byte-identical. Every other merge of an
  Opening, WallPlacement or unequal/singleton side value requires an explicit
  move/delete operation or rejects `MERGE_ATTACHMENT_MAP_INVALID`.

Reverse, diagonal, unknown-basis, rounded or nearest-host rebase is never
implicit. Every accepted row carries a complete target list and exact inverse
source list before confirmation.

### 7.4 Ceiling inventory without candidate circularity

`CeilingInventoryV2` is built **before** ceiling resolutions from two finite
inputs only: every base `AssetInstanceId` whose pre-placement kind is Ceiling,
and every explicit post-topology target `AssetInstanceId` declared in a
confirmed host action/field disposition. For each ID it stores its pre slot if
any and its declared post slot if any, including `PlacementKind` values. It is
sorted by ID and has no dependence on a candidate that its own action will
create.

Each inventory slot receives exactly one `CeilingResolutionV2`:

* `Keep` requires same Ceiling host Room, usable polygon/height and exact
  footprint containment after identity resolution;
* `MoveAsset` contains a complete explicit target CeilingPlacement and inverse;
* `DeleteAsset` contains user acknowledgement and inverse placement;
* `ChangePlacementKind` contains complete explicit target placement (Floor or
  Wall) and inverse CeilingPlacement.
* `CreateAsset` is legal only for an explicit post target; it carries a
  complete inverse removal and can never be inferred from a changed Room.

Missing, duplicate, extra, pre-only/post-only ambiguous or stale action is
`CEILING_RESOLUTION_REQUIRED`/`CEILING_RESOLUTION_INVALID`. No nearest Room,
implicit room-ID reuse or circular base∪candidate enumeration is allowed.

## 8. Allocation, complete impact, confirmation and directional history

### 8.1 Allocation only after semantic routes are fixed

`AllocationPlanV3` is built after the singleton context, face set, changed-face
maps/seeds/loss rows, host rows and ceiling actions are fully selected. It
contains one stable semantic `purposeBytes → allocatedId` entry for every new
Vertex/Wall produced by the topology skeleton, new Room seed, explicit host
target, clone/coalesce target and explicit field mutation. Purposes are byte
sorted; IDs are unique and do not collide with the base Project. The expected
output key set is derived from the selected records and must be exactly equal
to the candidate output key set.

No allocation purpose enters `SingletonContextV2`, and no map/seed has a
hidden allocation. Thus a changed-face decision can affect allocation only
after it is confirmed; it cannot change the context digest needed to validate
that decision. Missing/extra/colliding purposes or output keys reject
`ALLOCATION_PLAN_INVALID` before any candidate is durable.

### 8.2 Closed `R5ImpactEnvelopeV1`

`R5ImpactEnvelopeV1` (type 1) is the complete user-confirmable preflight
content. It includes the singleton context; topology effect; every valid face
key; every map/relation/seed/field/loss/host/ceiling record; allocation;
resource and notice commitments; and **both** complete patch sets.  It has no
`impactDigest` field.  `impactDigest = Digest(envelope)` is calculated only
after the whole record validates.

`ForwardPatchSetV3` and `InversePatchSetV3` are closed sets of `PatchV2` rows.
Each row names entity kind/ID, before and after canonical-record digests and
`Add|Replace|Remove`.  The forward set transforms exactly
`fromStateDigest → toStateDigest`; inverse does exactly the reverse.  The
validator reconstructs the detached candidate and checks that all and only
those canonical records, resource pins, BackupFeasibility results,
AssetUsageGrant IDs and notice commitments occur.  Phrases such as "explicit
Opening mutation", "resource result" or "later inverse" are not legal
placeholders in this envelope.

Every `ResourcePreflightV2` binds the semantic slot to the exact local pinned
hash, media policy, grant/notice data and successful backup result. A new
asset/finish cannot become Durable if any byte is unpinned, ungranted,
unnoticed or fails backup feasibility. This does not make the Catalog Control
Plane a Project owner and does not alter recovery semantics.

At confirmation and immediately before `PendingDurability`, recompute from the
same fenced Project/base Revision/policy/writer lease: topology skeleton,
context, face/ring state, selected commitments, allocation, every patch and
the envelope digest. Any byte or output mismatch returns
`IMPACT_DIGEST_MISMATCH`; it creates no partial Project mutation. Persistence
failure after a valid candidate retains the preceding Durable Revision and
follows the existing retry/recovery boundary.

### 8.3 Directional transitions and retained policy

`HistoryCommitmentV2` binds two complete directional fences:

```text
forward: baseRevisionId + baseStateDigest
      -> candidateRevisionId + candidateStateDigest
reverse: candidateRevisionId + candidateStateDigest
      -> baseRevisionId + baseStateDigest
```

Both directions bind the same immutable `PolicyBundleRefV2` (full policy bytes
plus SHA-256), `SingletonContextV2`, selected allocation IDs and their own
closed forward/reverse patch set.  Undo executes only when the current
Revision/state equal the recorded reverse-from fence; redo executes only when
they equal the original forward-from fence.  Neither recomputes Room survival,
nearest host, current policy nor a new allocation.

The exact immutable policy bytes are retained as an active History resource
root for as long as its entry exists.  If they are unavailable/corrupt or no
longer parse to their recorded digest, undo/redo returns
`HISTORY_POLICY_UNAVAILABLE`, does not mutate the Project and does not delete,
rewrite or skip the entry.  The only resolution is exact repair or the existing
explicit `DiscardSessionHistory` action while the current Project is healthy.
`SessionRetentionPolicy` may reject a **new** command before preflight; it can
never silently break an existing undo/redo entry.

This historic-policy retention is an explicit proposed source/schema extension
that must be reconciled with Domain Model, Project/Backup Contract and AD-3/4.
It deliberately preserves the current no-silent-history-loss invariant.

## 9. Required frozen-source deltas and owner route

The following are explicit proposals, not hidden adoption:

| R5 proposal | Current owner route before canonical use |
| --- | --- |
| `NoHolesAlphaV1`, imported-hole read-only state, face reasons | SPEC Geometry Contract/Project-Backup, PRD test model, UX recovery, Architecture AD-7. |
| C1–C4 units, draft reasons, RayProbe and selection ties | Geometry Contract, PRD FR-7/8/13, UX candidate/error flow. |
| miter-only Q2 join/cap and usable subtypes | Geometry Contract, PRD, UX. |
| automatic unchanged-only Room identity and explicit changed-face map/seed/loss | Geometry Contract, Domain Model, PRD FR-15/16, UX confirmation. |
| `CanonicalBytesV2` internal digest/ChangeSet registry | Architecture + SPEC/backup owner; it must remain subordinate to canonical `project/project.json`. |
| CCW metric footprint, C8 yaw and formatter precision | catalog/asset contract, Geometry Contract, PRD FR-13/29, UX. |
| host/ceiling transfer records and exterior proof | Geometry Contract, Domain Model, PRD FR-19/35–38, UX. |
| retained historic policy bytes/directional replay | Domain Model, Project/Backup Contract, Architecture AD-3/4. |

The source-owner advisory
`reviews/d022-r5-source-owner-reconciliation-targets-2026-08-05.md`
(`86208e8a933cfa2688d328336af84ec580548894c9a0ac171e4eadef305be9fc`)
was used only to make these deltas explicit. It is not an authority change.

## 10. R4 finding disposition matrix

This traceability matrix maps every blocker handed to R5 to one concrete policy
section. It does not reverse the frozen `REJECT` verdicts or claim a new review.

| # | R4 blocker | R5 exact section |
| ---: | --- | --- |
| 1 | C1 complete winner key and coherent CSS-U units | §§3.1–3.2 |
| 2 | C4 `mNumerator`, zero/threshold/direction order | §3.4 |
| 3 | closed CanonicalBytes grammar and schema registry | §§2.1–2.4 |
| 4 | deterministic planar dart/face traversal | §4.1 |
| 5 | ring containment/parent/depth/witness/contact/no-holes | §4.2 |
| 6 | cardinal/diagonal offsets, runs, miter/cap | §5.1 |
| 7 | exhaustive side-aware old/new face lineage | §6.2 |
| 8 | Plan-derived wall side/exterior proof | §§4.3, 7.1–7.2 |
| 9 | same CCW-normalised asset footprint for metric and host | §5.2 |
| 10 | exact formatter boundary equality and Edge vs WholeBoundary | §§3.5, 5.3–5.4 |
| 11 | child-local interval formula and crossing rejection | §7.3 |
| 12 | same-ID changed-wall Opening/WallPlacement transfer | §7.3 |
| 13 | complete WallHostResolutionSet keyed by every pre-host | §7.2 |
| 14 | pre-resolution ceiling inventory and placement-kind action | §7.4 |
| 15 | map-independent context before resolved commitment | §6.1 |
| 16 | closed NewRoomSeed fields and resource preflight | §6.4 |
| 17 | loss acknowledgement source/class/slots/inverse | §6.4 |
| 18 | one Project/base/effect/policy context fence | §6.1 |
| 19 | impact binds full forward/inverse/resource/notice commitments before confirm | §8.2 |
| 20 | directional revision/context and immutable historic policy | §8.3 |
| 21 | stale origin, C4 below-minimum and non-simple outcome registry | §1 and §§3.1, 3.4, 4.1 |
| 22 | no silent destruction of an existing undo/redo entry | §8.3 |
| 23 | C1/C4 corpus and exact witness assumptions | §11 |
| 24 | byte-level grammar golden/digest requirements | §§2.4, 11 |
| 25 | no undefined circular allocation/map relation | §§6.1, 8.1 |
| 26 | no automatic changed-face Room ID attachment | §6.3 |
| 27 | retain an exact FR-13 path without `MEASUREMENT_UNSUPPORTED` | §§1, 3.5, 5.2–5.4 |
| 28 | explicit marking/routing of all material source deltas | §§0, 9 |

## 11. Required executable-evidence fixture matrix

This is a **required future corpus**, not evidence that a test suite exists.
Each fixture must pin its complete input bytes, result/diagnostic, every
relevant canonical digest, forward/inverse result and the unchanged prior
Durable Revision on rejection.

| Fixture family | Minimum named cases | Mandatory proof |
| --- | --- | --- |
| Presentation/C1/C4 | `SEL-CSSU-1px-per-mm-100px`, `SEL-C1-dense-junction-key`, `SEL-C4-zero-and-49mm`, `SEL-C4-50mm-and-150mm-ties`, `SEL-stale-origin`, one non-finite/transform/cap case | `100 CSS px → 100 mm`, C1 full tie key, below-minimum before direction, lower-k half tie, no stale-origin fallback. |
| RayProbe | all eight directions; integral/non-integral/parallel singleton/positive collinear; C1 preemption; `8*n` cap | complete ordered row set, blocker precedence, no partial C2/C4 fallback. |
| CanonicalBytesV2 | `CB2-Impact-full`, `CB2-Lineage-all-row-kinds`, `CB2-Seed-value-vs-unset`, `CB2-Host-every-action`, `CB2-NFC-and-varint-reject`, every enum/optional/set-order branch | full bytes + SHA-256 for each valid vector; malformed/non-NFC/overlong/unknown/duplicate/trailing rejects `CANONICAL_BYTES_INVALID`. |
| Plan faces/rings | square; T-tail bridge; normalised X; degree-4 turn; open tail; two independent outers; inner loop; nested loop; touching vertex and edge | every dart successor, bridge reduction, exterior/side table, face keys and exact ring outcome before Room work. |
| Q2 usable | odd cardinal/diagonal; run collapse; thickness step; backtrack; cap equality/above; each Q2 contact/simple-polygon subtype | byte-pinned Q2 ring or named reject with no derived Room. |
| Metric | CW→CCW normalisation; C8 all steps/no reflection; edge vs whole boundary minimum; point/wall/usable/asset cases; below/equal-even/equal-odd/above half; `exactAtPrintedPrecision` false | source-key distinction, stable witness/reversal tie, direct exact half-cell comparison and one Preview/2D/3D/export token. |
| Lineage/Rooms | one-root insufficient; complete partition; added/removed atoms; context-before-map; unchanged auto-only; map injectivity; explicit seed value/unset; loss eight classes | full old/new atom coverage; no changed-face auto attachment; every field carries forward/inverse/loss evidence. |
| Wall hosts | contained child formula; crossing span; same-ID shortened/moved/thickened; explicit move/delete; clone/coalesce; exterior/interior; two exterior; missing/extra inventory row | exact child interval, complete host set, physical-side proof, resource commitment and inverse. |
| Ceiling | Keep/Move/Delete/Create/placement-kind change; pre-only/post-only; same-ID Room usable change | pre-resolution inventory is complete and one reversible action exists per slot. |
| Impact/history | stale Project/base/writer/policy; allocation collision/missing output; altered patch/resource/notice; persistence failure; retry; undo/redo direction fences; policy upgrade/missing | confirmation digest includes both patch directions; historic policy is used; missing policy preserves entry; prior Durable Revision survives every reject/failure. |

The formal contract advisory
`reviews/d022-r5-formal-contract-targets-2026-08-05.md`
(`7cda7d7887418d756d00eccea408c49a82bd55c77d29745e38823b6716c04ad2`)
informed this matrix. It remains advisory evidence, not a canonical source or
test result.

## 12. Non-adoption statement

R5 remains a pre-canonical draft. Before any source-owner reconciliation or
implementation, it requires a fresh independent current-source, exact-geometry
and topology/data-integrity review of this exact R5 SHA, then the corpus above
and every existing readiness gate. It does not authorize a package manifest,
production application source, Kotlin service, test bootstrap, CI, deployment,
commit, physical-device claim or a `READY` verdict.
