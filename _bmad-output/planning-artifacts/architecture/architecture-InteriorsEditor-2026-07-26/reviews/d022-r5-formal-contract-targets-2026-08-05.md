---
title: "InteriorsEditor — D-022 R5 formal contract targets"
date: 2026-08-05
status: advisory-noncanonical
canonical: false
implementation_ready: false
readiness: NOT_READY
purpose: "Closed technical targets for a new R5 successor; not an ADR, source reconciliation, corpus, or implementation authorization."
reviewed_r4:
  artifact: ../d-022-geometry-policy-decision-draft-r4-2026-08-05.md
  sha256: 2711b00ee98e1bbf7649cae7ef4d51974c9a1615f9e712cebbcd9d9ab86b321b
review_inputs:
  - review-d022-exact-geometry-adversarial-r4-external-2026-08-05.md
  - review-d022-r4-topology-data-integrity-2026-08-05.md
  - review-current-source-d022-r4-2026-08-05.md
architecture_spine_changed: false
memlog_changed: false
---

# R5 formal contract targets

## Status and use

This is advisory, noncanonical input for the author of a new D-022 R5. R4 and
its reviews remain frozen evidence and must not be edited. Nothing here changes
AD-*, CAP-*, FR-*, NFR-*, UX, the JSON backup format, reason-code authority, or
readiness. R5 must keep every source delta proposed and route it after a fresh
review.

The target is one total detached transition. A missing row, unknown enum,
unregistered field, stale digest, or incomplete inventory rejects before
PendingDurability; it never selects a library/default behaviour.

| R4 rejection area | R5 section that closes it |
| --- | --- |
| EXT-01/02, CSR-01/03 | 1 |
| EXT-03, CSR-02 | 2 |
| EXT-04, TDI-01/02 | 3 |
| EXT-05 | 4 |
| EXT-06, TDI-03/04/05/06 | 5 |
| EXT-07/08/09 | 6 |
| EXT-10/11, TDI-07/08/09/10 | 7 |
| EXT-12, TDI-11/12/13 | 8 |

## 1. Presentation units and total C1–C4

Use one unit system everywhere:

~~~text
U = 1/256 CSS px
Z = 2^16
relativeXU = roundHalfToEven((clientX - rectLeft) * 256)
relativeYU = roundHalfToEven((clientY - rectTop) * 256)
panXU      = roundHalfToEven(rawPanXCss * 256)
panYU      = roundHalfToEven(rawPanYCss * 256)
scaleCssUNumerator =
  roundHalfToEven(rawScaleCssPerMm * 256 * Z)  // CSS-U * Z / mm
scaleDenominator = Z
~~~

scaleCssUNumerator is strictly positive after quantisation. Its identifier,
cap units and fixtures use CSS-U, not CSS px. Forward projection is:

~~~text
screenXU = panXU + xMm*scaleCssUNumerator/Z
screenYU = panYU - zMm*scaleCssUNumerator/Z
q = scaleCssUNumerator
dxNumerator = (relativeXU - panXU)*Z - originXmm*q
dzNumerator = (panYU - relativeYU)*Z - originZmm*q
~~~

For exact witness W = (xNum/d, zNum/d), d positive:

~~~text
sx = xNum*q - d*(relativeXU-panXU)*Z
sy = d*(panYU-relativeYU)*Z - zNum*q
screenDistanceSq = (sx^2 + sy^2) / (d*Z)^2
~~~

The hit square H_U compares abs(sx), abs(sy) with H_U*d*Z. No DPR, zoom or
renderer conversion is added after ingress.

C1 is selected before RayProbe using the complete key:

~~~text
C1Key = (
  screenDistanceSq ascending,
  vertex.xMm ascending,
  vertex.zMm ascending,
  CanonicalBytesV2(ExistingVertex { vertexId }) ascending
)
~~~

Thus an eligible C1 always pre-empts C2/C3/C4. C2 retains its own documented
RayProbe key; there is no cross-class equal-hit fallback.

For C4, first set mNumerator = max(abs(dxNumerator), abs(dzNumerator)).
Before selecting a direction return draft-only
CANDIDATE_UNDETERMINED/C4_DELTA_BELOW_MINIMUM iff mNumerator < 50*q.
Otherwise compare the eight fixed directions by n_d^2 / norm2(d), where
n_d = dxNumerator*d.x + dzNumerator*d.z and n_d > 0; an exact tie uses the
fixed direction ordinal. Choose positive integer k minimising:

~~~text
abs(mNumerator - 100*q*k), k >= 1
~~~

An equal minimum chooses lower k; endpoint is origin + 100*k*d. Out-of-bounds
is C4_OUT_OF_PROJECT_BOUNDS without a retry. Missing/stale origin is
ACTIVE_ORIGIN_STALE_OR_MISSING. These are proposed Geometry/UX reasons.

| Golden fixture | Expected result |
| --- | --- |
| SEL-CSSU-1px-per-mm-100px | 100 CSS px gives dx = 100 mm and C4 k = 1, never 256. |
| SEL-C1-dense-junction-key | Selects first complete C1 key. |
| SEL-C4-zero-and-49mm | Named below-minimum Draft before direction rank. |
| SEL-C4-50mm-and-150mm-ties | 50 mm gives k = 1; 150 mm picks lower k = 1. |
| SEL-stale-origin | Named Draft; no candidate or mutation. |

## 2. CanonicalBytesV2 and a complete registry

Do not patch or reinterpret CanonicalBytesV1. If R5 needs the repaired
proposal, call it CanonicalBytesV2 and include a frozen registry CB2-R1 in R5
or exactly one hash-pinned companion. A digest is invalid unless every type,
field, variant, enum member and sorting rule is registered.

All u values below are minimal unsigned LEB128: zero is one 00 byte and a
nonzero value has no redundant zero terminal group.

~~~text
Document = 49 45 43 42 32 + u(rootTypeId) + Value
Value =
  00 + u(value)                                      UInt
| 01 + sign(00|01) + u(magnitude)                    SInt; zero only 01 00 00
| 02 + u(byteLength) + bytes                         Bytes
| 03 + u(byteLength) + strict-NFC-UTF8 bytes         Text
| 04 + sixteen RFC-4122 network-order bytes          UUID
| 05 + u(count) + Value[count]                       Array
| 06 + u(count) + Value[count]                       Set; strict encoded-byte order
| 07 + u(recordTypeId) + u(fieldCount)
       + (u(fieldId) + Value)[fieldCount]            Record; strict fieldId order
| 08 + u(unionId) + u(variantId) + Record             Union
| 09 + u(enumId) + u(memberId)                        Enum
| 0A + SInt(numerator) + UInt(denominator)           ExactRationalMm
| 0B + SInt(a) + SInt(b) + UInt(d)                   Q2
~~~

Record rejects unknown, missing-required or duplicate fields and a value of
the wrong declared type. Optional means field absent; explicit unset is a
registered union variant. Text that is not valid NFC is rejected, not silently
normalised. Set order compares full encoded Value bytes. ExactRationalMm and
Q2 reject non-normal forms. Decoder consumes one Document exactly; trailing
bytes reject. SHA-256 covers the whole Document.

CB2-R1 must give fixed type IDs and field IDs for all nested records used by
the impact. At minimum, R5 must define these exact record fields:

| Record | Required numeric fields |
| --- | --- |
| TopologyInputContextV2 | 1 projectId, 2 baseRevisionId, 3 baseProjectDigest, 4 policyBundleDigest, 5 normalizedEffect, 6 sourceInventoryDigest |
| ResolvedTransferCommitmentV2 | 1 inputContextDigest, 2 allocationPlan, 3 roomRoutes, 4 hostResolutions, 5 forwardPatchSet, 6 inversePatchSet |
| FaceLineageRelationV2 | 1 oldRoomId, 2 oldFaceKey, 3 newFaceKey, 4 expectedOccurrenceRows, 5 inputContextDigest |
| RoomSurvivorMapV3 | 1 predecessorRoomId, 2 predecessorFaceKey, 3 successorFaceKey, 4 lineageDigest, 5 inputContextDigest |
| NewRoomSeedV3 | 1 successorFaceKey, 2 allocatedRoomId, 3 core, 4 floorValueOrUnset, 5 ceilingValueOrUnset, 6 resourceCommitments |
| RoomLossAcknowledgementV3 | 1 sourceRoomId, 2 sourceFaceKey, 3 fieldClass, 4 beforeProjection, 5 dispositions, 6 targetSlots, 7 afterProjection |
| WallHostResolutionV2 | 1 sourceRecordKey, 2 sourceBasis, 3 sourceSpan, 4 sourcePhysicalSide, 5 action, 6 target, 7 inverse, 8 inputContextDigest |
| CeilingHostResolutionV2 | 1 assetInstanceId, 2 preSlot, 3 postSlot, 4 action, 5 inverse |
| DirectionalTransitionV2 | 1 fromRevision, 2 fromProjectDigest, 3 toRevision, 4 toProjectDigest, 5 historicPolicy, 6 inputContext, 7 resolvedCommitment, 8 patchSetDigest |
| PreflightImpactContentV2 | 1 forwardTransition, 2 reverseTransition, 3 allocationPlan, 4 resourceCommitments, 5 confirmationScope |

The registry must also declare every nested policy, effect/occurrence/interval,
surface address, assignment value, resource/notice commitment, patch,
allocation purpose, action, inverse, enum and union member. “Same as current
object” and “explicit mutations” are not legal registry entries.

Required goldens are CB2-Impact-full, CB2-Lineage-all-row-kinds,
CB2-Seed-value-vs-unset, CB2-Host-every-action and CB2-NFC-and-varint-reject.
Each pins complete bytes plus SHA-256 and a stable invalid-bytes outcome. This
wire proposal needs source-owner reconciliation before use for persisted
Commands or portable format.

## 3. PlanFaceTraversalV1 and ring sets

Use deterministic half-edge traversal over the normalized integer Plan; no
library chooses a successor.

1. Derive nonpersistent canonical Wall orientation by endpoint coordinate
   (x,z) ascending, then Wall ID. Create Forward and Reverse darts.
2. At every vertex sort outgoing darts CCW by fixed direction ordinal:
   (1,0), (1,1), (0,1), (-1,1), (-1,0), (-1,-1), (0,-1), (1,-1), then
   Wall ID. For dart u to v, successor is the dart immediately clockwise
   (predecessor in that CCW list) of v to u.
3. Visit each unvisited dart in (origin, destination, Wall ID, direction)
   order until it returns to start. The successor permutation owns every dart
   exactly once.
4. Repeatedly remove the lexicographically least cyclic adjacent pair
   (d, twin(d)) until none remains. Empty or fewer-than-three result is a
   bridge/open-tail walk and yields no ring. A remaining repeated undirected
   edge or nonterminal repeated vertex rejects
   CENTERLINE_FACE_NON_SIMPLE.
5. Compute exact integer twice-area. Zero rejects
   CENTERLINE_FACE_ZERO_AREA. Positive walks are outer candidates; negative
   walks are boundary candidates. Preserve dart direction for host-side proof;
   rotate CCW coordinates only for the canonical ring key.

Construct FaceRingSetV1 before Room derivation. First compare all ring-edge
pairs exactly. Any shared point/edge/crossing is
PLAN_HOLE_UNSUPPORTED/TOUCHING_RINGS. Otherwise use the least canonical vertex
as a strict-winding witness. Parent is the strictly containing ring with least
absolute twice-area; no parent belongs to exterior. Each positive outer owns
its direct negative children. A negative child is HAS_INNER_RING, containment
deeper than one is NESTED_RING, and independent parentless positive outers are
DISCONNECTED_OUTER and valid.

For proposed NoHolesAlphaV1, HAS_INNER_RING, NESTED_RING and TOUCHING_RINGS
reject the full candidate before a FaceKey, Room, host or seed exists. Imported
holes remain explicit read-only/export-compatible proposed policy, not a
silent migration.

Required goldens: FACE-square, FACE-T-tail-bridge-elided, FACE-X-normalized,
FACE-degree-4-turn, FACE-open-tail, FACE-two-independent-outers,
FACE-inner-loop, FACE-nested-loop and FACE-touching-vertex-or-edge. Each pins
dart successors, reduced walks, ring-set bytes and exact outcome.

FACE-square and FACE-X-normalized produce sorted SingleOuter keys;
FACE-T-tail-bridge-elided produces the same outer key as its tail-free plan;
FACE-open-tail produces no Room ring; FACE-two-independent-outers produces two
sorted valid outers; FACE-inner-loop and FACE-nested-loop reject before Room
work with HAS_INNER_RING and NESTED_RING respectively; the touching fixture
rejects with TOUCHING_RINGS.

## 4. Exact Q2 miter construction

For CCW centerline boundary, interior is left. For permitted unit direction u,
inward offset is thicknessMm * (-u.z,u.x)/2. Exact cases:

| u | offset o |
| --- | --- |
| (1,0) | (0,t/2) |
| (0,1) | (-t/2,0) |
| (-1,0) | (0,-t/2) |
| (0,-1) | (t/2,0) |
| (1,1) | (-t√2/4,t√2/4) |
| (-1,1) | (-t√2/4,-t√2/4) |
| (-1,-1) | (t√2/4,-t√2/4) |
| (1,-1) | (t√2/4,t√2/4) |

Collapse adjacent same-direction equal-thickness runs while retaining root
occurrences. Same-direction unequal-thickness runs reject
USABLE_POLYGON_COLLAPSED/Q2_THICKNESS_STEP_UNSUPPORTED; opposite collinear
runs reject Q2_BACKTRACK. For remaining lines at joint B:

~~~text
L_i(s) = B + o_i + s*u_i
den = cross(u_i,u_next)
s = cross(o_next-o_i, u_next) / den
J = B + o_i + s*u_i
~~~

den = 0 rejects Q2_INVERSE_ZERO. All arithmetic is normalised Q2 under caps.
With T = max(t_i,t_next), accept iff |J-B|² <= (2*T)²; equality accepts and
greater rejects Q2_MITER_CAP_EXCEEDED. Then run the full Q2 simple-polygon
predicate. Miter-only rather than current miter-then-bevel is a material
Geometry/PRD/UX reconciliation item.

Required goldens: MITER-cardinal-odd-thickness, MITER-diagonal-odd,
MITER-run-collapse, MITER-thickness-step-reject, MITER-backtrack,
MITER-cap-equality, MITER-cap-plus-one and MITER-self-contact.

The first three yield byte-pinned Q2 rings; thickness-step and backtrack return
their named subtypes; cap-equality accepts; cap-plus-one returns
Q2_MITER_CAP_EXCEEDED; self-contact returns the corresponding simple-polygon
subtype with no derived Room.

## 5. Complete lineage, seeds and noncircular context

Build TopologyInputContextV2 before map choice, allocation, seed, host
resolution or impact confirmation. It contains project ID, base revision ID,
exact base Project digest, historic policy-bundle digest, normalised effect and
complete source inventory. Every lineage/map/host row references this one
singleton digest. Only afterwards may ResolvedTransferCommitmentV2 bind
allocations, selected routes and forward/inverse patches. No digest includes a
record whose own acceptance depends on that digest.

For a specific old/new Face pair derive sorted boundary lists:

~~~text
Occurrence = {
  faceKey, boundaryOrdinal, rootWallId, rootSpanStart, rootSpanEnd,
  currentWallId, physicalSide, traversalParity
}
~~~

Generate the expected FaceLineageRelationV2, never accept a caller-selected
partial list:

- one SharedSpan for every old/new occurrence pair with same rootWallId,
  physical side and positive exact root-span overlap;
- RemovedOccurrence for each old row with no SharedSpan;
- AddedOccurrence for each new row with no SharedSpan;
- transition derived only from normalized effect:
  Retained, Partitioned, Coalesced, Moved, ThicknessChanged, Added or Removed.

Rows include both occurrence keys, exact overlap when shared and transition.
Supplied rows must byte-equal the complete sorted expected set: no missing,
duplicate, extra or one-root witness. A map is still user choice, never score.

NewRoomSeedV3 uses registered ValueOrUnset; Value carries complete canonical
value bytes and exact resource/notice commitment. RoomLossAcknowledgementV3 has
one row per (sourceRoomId, fieldClass), complete pre/post projection and sorted
target slots or RemovedNoSuccessor, sufficient for inverse. It cannot use
descriptive ExplicitValue, “relevant successor”, or default inheritance.

Required goldens: LIN-one-root-insufficient, LIN-complete-partition,
LIN-added-and-removed-coverage, LIN-context-before-map,
LIN-seed-value-unset-distinct and LIN-loss-eight-classes.

The one-root fixture rejects a map; complete-partition accepts only its full
row set; added/removed rejects any omitted row; context-before-map proves a
map-independent input digest; value/unset has distinct bytes; eight-classes
rejects every missing, duplicate or wrong-slot acknowledgement.

## 6. Metric targets, orientation and rounding

At metric catalog admission, reject footprint with fewer than three points,
zero area, self-contact or non-simple edges. Otherwise reverse CW input,
rotate to least lexicographic CCW Q2 sequence and hash that sequence as
metricFootprintDigest. C8 rotations preserve the winding convention. This
remains a catalog/placement source delta.

~~~text
MetricBoundaryV3 =
  WallCenterlineEdge { wallSegmentId }
| UsableEdge { roomId, faceKey, edgeOrdinal }
| UsableWholeBoundary { roomId, faceKey }
| AssetFootprintEdge { assetInstanceId, metricFootprintDigest, edgeOrdinal }
| AssetFootprintWholeBoundary { assetInstanceId, metricFootprintDigest }
~~~

Edge expands to one segment; WholeBoundary expands to every ordered segment of
the one Alpha ring. Candidate counts, witnesses and caps use expanded lists.
The source key visibly distinguishes Edge from WholeBoundary.

For decimal grid delta in native units, use interval only to locate adjacent
integer cells. Resolve boundaries directly: for length compare exact squared
q with ((n+1/2)*delta)^2 in Q2; for area/perimeter compare exact Q2 value with
(n+1/2)*delta. Equality selects the even neighbour. exactAtPrintedPrecision
is true iff q equals (n*delta)^2 for length, or value equals n*delta otherwise.
Never use interval refinement to decide equality.

Required goldens: METRIC-CW-normalized-CCW, METRIC-whole-vs-edge-minimum,
FMT-length-below-half, FMT-length-half-even, FMT-length-half-odd,
FMT-length-above-half, FMT-area-half-even and
FMT-exactAtPrintedPrecision-false.

CW normalisation produces the same CCW digest as equivalent CCW input; the
whole-boundary fixture proves a different minimum from a selected edge; each
formatter fixture pins the stated lower/even/odd/upper decimal result, while
the final fixture returns false despite a valid rounded display.

## 7. Exact host inventories and transfers

Derive nonpersistent canonical wall basis from coordinate-ordered endpoints.
Represent every Opening/WallPlacement footprint span as closed root-parameter
interval [a,b], where 0 <= a < b <= 1, plus physical Left or Right. A point
anchor without derivable nonzero span rejects; it is never silently widened.

For partition child interval [c,d], one-to-one transfer requires
c <= a < b <= d. Child-local span is:

~~~text
[(a-c)/(d-c), (b-c)/(d-c)]
~~~

All values are normalised exact rationals. Partial overlap rejects
PARTITION_ATTACHMENT_CROSSES_CHILD_BOUNDARY. R5 V2 defines no child-split
escape hatch. Same-ID wall gets one explicit action per extracted record:
KeepExact, ReplaceExplicit with complete target, or DeleteAcknowledged, plus
exact inverse. Changed length, position, thickness or basis does not preserve
an attachment solely because Wall ID survives.

The left face of canonical forward dart is physical Left; its twin’s left face
is physical Right. Build sorted complete WallHostInventoryV2 over every base
and candidate Opening, WallPlacement and WallSideAssignment, keyed by
kind/ID/source address/physical side. Exactly one resolution per pre/post slot;
missing or extra row rejects. Exterior uses closed ExteriorTarget with
physicalSide and exteriorProof, not missing candidateFaceKey. A two-exterior
wall still cannot host WallPlacement/WallSideAssignment because current
ExteriorSide has one persistent token.

Build ceiling inventory before candidate construction from every base
CeilingPlacement asset ID plus each command-intended post placement or
placement-kind transition. Each ID gets exactly one Keep, MoveExplicit,
DeleteAcknowledged or CreateExplicit action and inverse. Candidate ceiling
digest is derived only after those actions validate.

Required goldens: HOST-contained-child-transform, HOST-crossing-span-reject,
HOST-same-id-shortened-replace-or-delete, HOST-exterior-interior,
HOST-two-exterior-reject, HOST-wall-inventory-missing-row,
HOST-ceiling-kind-transition and HOST-ceiling-inverse.

The contained fixture pins the displayed rational child interval; crossing
returns PARTITION_ATTACHMENT_CROSSES_CHILD_BOUNDARY; a shortened same-ID wall
cannot KeepExact; exterior/interior yields a serializable ExteriorTarget;
two-exterior and missing-row reject; both ceiling fixtures pin a reversible
pre/post action set.

## 8. Directional durable history

Every durable transition pins retained immutable PolicyBundleSnapshotV2: full
canonical bytes plus SHA-256, not a policy name/version. Preflight contains
closed sorted forward and inverse patch sets, allocation restoration, exact
resources/notices and their digests before confirmation. There are no later
“explicit mutations” placeholders.

~~~text
forward: base revision + base Project digest -> candidate revision + candidate Project digest
reverse: candidate revision + candidate Project digest -> base revision + base Project digest
~~~

Both directions bind the same historic policy snapshot, input-context digest,
resolved transfer commitment and allocated IDs; each binds its own exact patch
set. Undo applies only a direction whose current revision and Project digest
equal its from fence. Redo applies original forward under the same rule.

Replay/undo/redo decode and use recorded historic policy, or a verified
byte-preserving compatible representation; never default to current policy.
If the bundle is unavailable/corrupt, preserve the entry and use the existing
history-only integrity boundary: no silent truncation or mutation, only exact
repair or explicit DiscardSessionHistory when current Project is healthy.
SessionRetentionPolicy applies only before a new command.

Required goldens: HIST-forward-retry, HIST-undo-direction-fence,
HIST-redo-direction-fence, HIST-policy-upgrade-uses-pinned-bundle,
HIST-policy-missing-preserves-entry and HIST-forward-inverse-impact-bound.

Retry preserves the prior Durable Revision on failure; undo and redo reject a
wrong directional from-fence; an upgrade still replays the recorded bytes;
missing policy disables history without removing it; and changing any forward
or inverse patch changes the pre-confirmation impact digest.

## 9. Owner reconciliation after fresh R5 review

| Proposed R5 rule | Owner route required |
| --- | --- |
| No-holes candidate/import compatibility and face reasons | SPEC Geometry Contract, PRD test model, UX recovery, Architecture AD-7 |
| C1–C4 draft reasons and mobile selection | Geometry Contract, UX, PRD |
| Miter-only, Q2 cap and usable failures | Geometry Contract, PRD, UX |
| Explicit changed-face survivor/loss policy | Geometry Contract, Domain Model, PRD FR-15, UX confirmation |
| CB2 registry/digest transition | Architecture and SPEC/backup owner; never silently replaces canonical Project JSON |
| C8 footprint admission and metric precision | Catalog/asset contract, Geometry Contract, PRD, UX |
| Wall/ceiling host transfer and exterior representation | Geometry Contract, Domain Model, UX |
| Historic policy retention and directional undo/redo | Domain Model, Project/Backup Contract, Architecture AD-3/AD-4 |

R5 remains NOT_READY until a fresh independent review, source-owner adoption,
an executable corpus for every fixture above, and existing readiness gates
complete. This document authorizes none of code, test bootstrap, CI,
deployment, commit or production claim.
