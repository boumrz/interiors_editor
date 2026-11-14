---
title: "InteriorsEditor — D-022: рабочий ADR-input для геометрической политики Alpha, revision 3"
date: 2026-08-05
revision: 3
status: draft-working-policy
review_disposition: successor-prepared-after-r2-rejections-awaiting-independent-rereview
canonical: false
architecture_spine_changed: false
memlog_changed: false
implementation_ready: false
readiness: NOT_READY
scope: "Только R3 policy input для exact kernel, selection, metrics, topology maps, Room reconciliation, usable geometry и durable ChangeSet"
supersedes:
  artifact: d-022-geometry-policy-decision-draft-2026-08-05.md
  revision: 2
  sha256: 0bbab7d0771a3a1a78b50ef3a58e3f723d828322cb36ff249c90f9d1f70cd167
  status: frozen-review-evidence-do-not-edit
authority:
  delegated_product_owner_decision: "Реши сам кого назначить, мне нужно, чтобы решения были приняты для продолжения работы"
  limit: "Делегирование выбирает рабочий policy input, но не заменяет evidence, source-owner reconciliation, independent review или final READY"
sources:
  - ARCHITECTURE-SPINE.md
  - .memlog.md
  - domain-model.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../specs/spec-interiors-editor-alpha/performance-budgets.md
  - ../../../specs/spec-interiors-editor-alpha/asset-import-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../implementation-readiness-report-2026-08-05.md
  - ../../sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md
  - ../../evidence/spikes/S-2/work-package.md
  - ../../evidence/spikes/S-2/policy-boundaries.md
review_inputs:
  - reviews/review-current-source-d022-r2-2026-08-05.md
  - reviews/review-d022-exact-geometry-adversarial-r2-2026-08-05.md
  - reviews/review-d022-r2-topology-data-integrity-2026-08-05.md
proposed_architecture_route:
  - "После independent re-review и executable corpus: source-owned update AD-1/AD-6/AD-7, затем SPEC/PRD/UX reconciliation; R3 сам ничего не канонизирует"
---

# D-022 — рабочий пакет решений, revision 3

## 0. Статус, граница полномочий и R3 decision

R3 является новым неканоническим successor. R2 с SHA-256, указанным в
frontmatter, — неизменяемое review evidence: его нельзя переписывать,
перемечать как accepted или использовать как source of truth.

Этот документ не меняет следующие факты:

- официальный readiness recheck от 2026-08-05 остаётся **NOT READY**;
- S-2 остаётся **needs-further-evidence** и его kernel не становится
  production source;
- canonical Plan остаётся integer-mm planar graph; Room, usable polygon,
  mesh, spatial index и metric witnesses — derived;
- Room.heightMm остаётся единственной editable height source;
- physical NFR-15, G-1, S-1/S-3/S-4/S-6, AssetUsageGrant, G-CP-ADR и final
  READY не получают новый статус;
- R3 не authorizes implementation, package manifest, test suite, CI, commit,
  Spine, memlog или canonical-spec change.

### R3 decision in one paragraph

Alpha получает узкий product-owned ExactPlanarKernel V1. Canonical topology
допускает только SafeIntegerMm, но все pre-admission contacts вычисляются
как exact rational. Gesture resolver получает bounded, session-only
fixed-point camera snapshot и pre-ranked RayProbe set; C3 остаётся пустым,
а C4 производит только integer 100-mm endpoints. Room identity берётся из
bounded overlay canonical centerline Z² faces, а не из Q2 usable overlap.
Usable geometry имеет отдельную Q2 simple-polygon predicate. FR-13
сохраняется через bounded ExactMetricV1: exact squared Q2 distance,
algebraic square-root value, exact segment/boundary minimum и единый
interval formatter. Every topology split/merge carries a closed attachment
map, frozen allocation plan, Room seeds/loss acknowledgements and impact
digest through preflight, confirmed command, ChangeSet, replay, undo and redo.

## 1. Non-negotiable representation boundary

| Domain | Values | Persistence rule |
| --- | --- | --- |
| Canonical Plan/Room/placement | SafeIntegerMm, UUID, lossless JSON, canonical resource IDs | Единственный source for Durable Revision/Backup. |
| Exact topology/overlay | BigInt, ExactRationalMm, exact rational area | Ephemeral; no BigInt in Command, Revision, History or Backup. |
| Derived usable/metric | Q2, ExactAreaQ2, ExactRootQ2, metric witness | Ephemeral; formatting/projection can consume it but cannot feed it back. |
| Presentation selection | PresentationSelectionV1 | Current-session-only; no persisted SnapPolicy, camera or pointer state. |

### 1.1 ExactRationalMm

~~~text
ExactRationalMm {
  numerator: BigInt,
  denominator: BigInt > 0
}
normal form:
  gcd(abs(numerator), denominator) = 1
  zero exactly = 0/1
~~~

Equality is structural after normalisation. Ordering uses cross multiplication.
BigInt division is forbidden except gcd/remainder and a proven exact
integer division. Conversion to SafeIntegerMm happens only when denominator
equals 1, then checks safe range and ProjectLimits as BigInt before any
Number conversion.

### 1.2 Q2

~~~text
Q2(a,b,d) = (a + b*sqrt(2)) / d
d > 0
zero = (0,0,1)
otherwise gcd(abs(a), abs(b), d) = 1
~~~

Addition, multiplication and non-zero inverse normalise after each operation:

~~~text
add = (a1*d2 + a2*d1, b1*d2 + b2*d1, d1*d2)
mul = (a1*a2 + 2*b1*b2, a1*b2 + a2*b1, d1*d2)
inv(nonzero) = d*(a - b*sqrt(2)) / (a*a - 2*b*b)
~~~

There is no non-zero integer solution of a*a - 2*b*b = 0. Sign is exact:
b=0 gives sign(a); a=0 gives sign(b); same-sign non-zero terms are obvious;
a>0,b<0 gives sign(a*a - 2*b*b); a<0,b>0 gives
sign(2*b*b - a*a). Comparison x,y is sign(x-y). No Number, epsilon or
approximate sqrt participates in a Q2 branch.

## 2. One reason-status table

Every name below is draft-local until a source owner adopts it. The table
prevents a renderer, UI or test from treating a presentation diagnostic as a
canonical reason code.

| Condition | Phase | Status and outcome |
| --- | --- | --- |
| Exact finite-segment duplicate | topology | Existing stable **DUPLICATE_SEGMENT**. |
| Non-integer canonical contact; positive collinear segment overlap | topology | Existing stable **AMBIGUOUS_INTERSECTION** with draft subtypes **NON_INTEGER_CONTACT** and **COLLINEAR_OPEN_OVERLAP**. |
| Coordinate/value out of ProjectLimits | topology/seed | Existing stable **PROJECT_BOUNDS_EXCEEDED**. |
| Invalid/ambiguous survivor graph or missing required survivor map | Room | Existing stable **ROOM_IDENTITY_AMBIGUOUS**. |
| Q2 thickness step, backtrack, miter cap, face hole or non-simple usable polygon | usable | Existing stable **USABLE_POLYGON_COLLAPSED** with the named draft subtype. |
| Resolved wall side/basis is not identical | host | Existing stable **ANCHOR_REHOST_AMBIGUOUS**. |
| Valid Room ID but CeilingPlacement cannot remain on usable surface | host | Existing stable **HOST_SURFACE_REMOVED**. |
| Exact bounded phase exceeds its declared count/bit/iteration cap | all exact phases | Proposed stable **GEOMETRY_EXACT_LIMIT** with mandatory phase subtype from §3. |
| Partition map absent/extra/stale/invalid | topology host transfer | Proposed stable **PARTITION_ATTACHMENT_MAP_INVALID**. |
| Merge precondition/map invalid | topology host transfer | Proposed stable **MERGE_PRECONDITION_FAILED** or **MERGE_ATTACHMENT_MAP_INVALID**. |
| Automatic reverse/diagonal/unknown-basis rebase | host transfer | Proposed stable **HOST_REBASE_UNSUPPORTED**. |
| Missing/mismatched NewRoomSeedV1 | Room | Proposed stable **ROOM_SEED_REQUIRED**. |
| Missing/stale/mismatched RoomLossAcknowledgementV1 | Room | Proposed stable **ROOM_LOSS_ACK_INVALID**. |
| Allocation plan incomplete, colliding or not matching output | ChangeSet | Proposed stable **ALLOCATION_PLAN_INVALID**. |
| Confirmed impact digest differs from recomputed impact | confirmation | Proposed stable **IMPACT_DIGEST_MISMATCH**. |
| Pointer/camera cannot form a bounded snapshot | UI only | Draft-only **CANDIDATE_UNDETERMINED / SNAPSHOT_OUT_OF_RANGE**; no Command exists. |
| Complete eight-direction RayProbe enumeration exceeds its cap | UI only | Draft-only **CANDIDATE_UNDETERMINED / RAY_PROBE_LIMIT**; no Command exists. |
| Winning RayProbe is non-integral or collinear-overlap | UI only | Draft-only **CANDIDATE_UNDETERMINED / NON_INTEGER_RAY_CONTACT** or **COLLINEAR_RAY_BLOCKER**; no C4 fallback. |
| C4 endpoint violates ProjectLimits | UI only | Draft-only **CANDIDATE_UNDETERMINED / C4_OUT_OF_PROJECT_BOUNDS**; no Command and no alternative ray or smaller k. |

There is deliberately no **MEASUREMENT_UNSUPPORTED** outcome in R3. Healthy
Alpha catalog/item boundaries must be ExactMetricV1-ready; a corrupt or
over-limit metric request gets the declared exact limit outcome, never an
unowned product-scope reduction.

## 3. ExactLimitsV1 — bounded, phase-specific and order-independent

ExactLimitsV1 is a versioned proposed product policy, not a geometry-library
default. Every cap is checked before allocating its bounded output collection.
Enumeration always has a canonical complete pass; a limit result cannot depend
on which library pair happened to be visited first.

| Phase subtype | Inputs/count definition | Working Alpha cap | Deterministic procedure/outcome |
| --- | --- | ---:| --- |
| PresentationSnapshot | absolute relative CSS-U coordinate, panU and scaleNumerator bits | 40, 40, 32 bits; inverse numerator/denominator 256 bits | Validate before inverse transform; UI-only SNAPSHOT_OUT_OF_RANGE. |
| RayProbe | complete pre-ranked direction×current-WallSegment set, including NoProbe | 8×n ≤ 2,400; n ≤ current ProjectLimits hard 300 | Count 8×n before probe materialisation, using the same sorted segment list; otherwise UI-only CANDIDATE_UNDETERMINED/RAY_PROBE_LIMIT. |
| ContactPairTests | unordered affected segment pairs after sorted affected-ID set | 45,150 | Precompute n*(n-1)/2; reject GEOMETRY_EXACT_LIMIT/CONTACT_PAIR_TESTS before pair enumeration if over cap. |
| ContactGroups | distinct exact coordinate groups after a counting pass | 1,024 | Count all canonical pairs first; no partition allocation until count is within cap. |
| PartitionPoints | distinct interior contact groups on one segment | 300 | Group first, then count per stored segment; reject GEOMETRY_EXACT_LIMIT/PARTITION_POINTS. |
| OverlayEdges/Vertices/Cells | old+new directed centerline edges; rational arrangement vertices; bounded cells | 1,200 / 8,192 / 4,096 | Count each completed sorted phase before materialising its next phase; reject GEOMETRY_EXACT_LIMIT/CENTERLINE_OVERLAY. |
| Q2 usable | Q2 operand bits; derived vertices per face; non-adjacent edge tests | 256 / 600 / 179,700 | Canonical cyclic edge order and complete count pass; reject GEOMETRY_EXACT_LIMIT/USABLE_Q2. |
| Metric | edges per selected boundary; candidate pair tests; formatter refinements/index/intermediate bits | 64 / 4,096 / 128 refinements, 288 index bits, 640 intermediate bits | Validate metric-ready boundary and cap before witness/formatter output; GEOMETRY_EXACT_LIMIT/METRIC. |
| Host maps/ChangeSet | attachment-map entries; new-output identities; serialized ChangeSet bytes | 1,200 / 1,200 / current 2 MiB hard limit | Count canonical extractors and allocation plan before validation; GEOMETRY_EXACT_LIMIT/CHANGESET. |

For every phase with a pair list, the list is sorted by the canonical
geometric key followed by stable ID bytes only as a final disambiguator.
Counting pass and materialisation pass consume the same list. A threshold
exceedance is therefore invariant under library iteration order.

## 4. Total exact contacts, RayProbe and partition order

### 4.1 Finite canonical segment classifier

All input segments are non-zero canonical integer segments. For P→Q and R→S,
let r=Q-P, s=S-R and:

~~~text
D  = cross(r,s)
Nt = cross(R-P,s)
Nu = cross(R-P,r)
~~~

If D<0, negate D, Nt and Nu before every comparison. For D>0, the closed
finite segments meet exactly when 0≤Nt≤D and 0≤Nu≤D. The contact is
constructed, never truncated:

~~~text
x = ExactRationalMm(Px*D + rx*Nt, D).normalise()
z = ExactRationalMm(Pz*D + rz*Nt, D).normalise()
~~~

The required integer admission gate from §1 occurs only after this result.
An otherwise valid contact with either denominator not equal to 1 rejects the
whole topology candidate as AMBIGUOUS_INTERSECTION/NON_INTEGER_CONTACT.

For D=0, the following classifier is total and precedes a generic
collinear-overlap result:

1. If the unordered endpoint-coordinate set of P→Q equals that of R→S,
   including reverse orientation, return existing **DUPLICATE_SEGMENT**.
2. If cross(R-P,r) is non-zero, the segments are parallel/non-collinear and
   have no contact.
3. Otherwise choose projection axis x when Px≠Qx, else z. Let
   tau(X)=(Xaxis-Paxis)/(Qaxis-Paxis) as ExactRationalMm. Normalise the
   closed intervals [0,1] and [min(tau(R),tau(S)), max(tau(R),tau(S))].
4. If their intersection is empty, there is no contact. If it is one point,
   that coordinate is the one existing shared endpoint and is grouped to the
   existing Vertex. If it contains a positive open interval, reject the
   whole candidate as AMBIGUOUS_INTERSECTION/COLLINEAR_OPEN_OVERLAP.

No zero-length segment reaches this classifier. Duplicate precedes overlap,
so reversed/equal input cannot acquire a library-dependent overlap reason.

### 4.2 Grouping and per-segment parameter

Pair-local Nt/D is never used as a global sort key. Contacts first group by
their exact coordinate. For every affected stored segment A→B and each group C
on it, define:

~~~text
segmentParameter(A→B,C):
  use x if Ax != Bx, otherwise z
  (Caxis - Aaxis) / (Baxis - Aaxis), as ExactRationalMm
~~~

For each segment independently, retain only distinct interior parameters
strictly between 0 and 1, sort by parameter using cross multiplication, then
by exact coordinate x,z. Every non-zero consecutive piece is constructed in
the same detached candidate. This holds for proposed and existing segments,
for stored forward/reverse direction, T at a junction, and multiple X/T
contacts on one segment.

### 4.3 PresentationSelectionV1 and bounded camera ingress

Presentation has no geometric tolerance. It only decides which already exact
candidate to send into the zero-tolerance domain path.

~~~text
U = 1/256 CSS px
Z = 2^16
H_U = 22 CSS px / U = 5632

CameraSnapshotV1 {
  schemaVersion: 1,
  panXU: signed integer,
  panYU: signed integer,
  scaleNumerator: positive integer,
  scaleDenominator: Z,
  cssTransform: IdentityOnly
}

screenXU = panXU + xMm*scaleNumerator/Z
screenYU = panYU - zMm*scaleNumerator/Z
~~~

PointerEvent clientX/clientY, canvasRect.left/top and pan ingress are decoded
separately as IEEE-754 binary64 rationals. Given raw CSS-pixel pan inputs
`rawPanXCss` and `rawPanYCss`, snapshot construction is exactly
`panXU = roundHalfToEven(rawPanXCss / U)` and
`panYU = roundHalfToEven(rawPanYCss / U)`; truncation, device-pixel conversion
and preservation of an unquantised pan are forbidden. Relative canvas
coordinate is the rational subtraction of client and rect values, followed by
round-half-to-even to U. Raw scale is converted to screen-units-per-mm,
multiplied by Z and round-half-to-even converted to scaleNumerator. Every CSS
transform, including axis scale, reflection, rotation, skew and non-default
transform origin, is prohibited for the Alpha canvas; page zoom/DPR/visual
viewport remain sampled only through the raw inputs above.

PresentationSnapshot limits in §3 apply before inverse projection. On a
failure there is only UI DraftCommand/CANDIDATE_UNDETERMINED; no partly
computed candidate is allowed. Focus, resize, orientation, viewport or DPR
change preserves an existing Draft and cannot recalculate it.

### 4.4 C1, pre-ranked RayProbe, C3 and C4

The 44×44 CSS-px square is a proposed canvas-selection policy aligned with,
not derived from, NFR-17. A finite candidate is hit only when both exact
screen-coordinate differences are within H_U.

| Result class | Construction | Handoff |
| --- | --- | --- |
| C1 ExactExistingVertex | canonical Vertex inside the closed hit square | If no C1 winner, resolve RayProbe. |
| RayProbe pre-class | all exact ray/segment probes, including integral candidate and blocker outcomes | Its winner yields C2 or blocked Draft. |
| C2 ExactRayContact | only an integral RayProbe winner | If no RayProbe winner, proceed to C3. |
| C3 ExactConstrainedTarget | named extension point; generator set is empty in Alpha | Always proceed to C4. |
| C4 OriginGrid100 | exact active-origin fallback below | If invalid, remain Draft. |

Let `S` be every current WallSegment sorted once by normalised endpoint pair.
For each of eight directions in fixed clockwise order and each member of `S`,
build exactly one RayProbe, including `NoProbe`. The complete bounded set has
cardinality `8×|S|`; it is counted before materialisation and must satisfy the
RayProbe ExactLimitsV1 row in §3 (therefore at most 2,400 under the current
hard 300-WallSegment ProjectLimits). A breach returns the named UI-only
`CANDIDATE_UNDETERMINED / RAY_PROBE_LIMIT` result before any partial ranking.
The same sorted `direction×S` list is then materialised and pre-ranked. A
probe has an exact witness position, screen-distance-squared, direction,
normalised host endpoint pair and one of:

~~~text
IntegralContact
NonIntegerContactBlocker
CollinearOverlapBlocker
NoProbe
~~~

For D≠0 ray P+lambda*d against R→S uses:

~~~text
D       = cross(d, S-R)
Nlambda = cross(R-P, S-R)
Nmu     = cross(R-P, d)
lambda  = ExactRationalMm(Nlambda,D).normalise()
mu      = ExactRationalMm(Nmu,D).normalise()
~~~

After D sign normalisation, a finite probe needs lambda>0 and 0≤mu≤1. It has
no artificial finite ray endpoint. A hit integral position is
IntegralContact; a hit non-integral position is NonIntegerContactBlocker.

For D=0, use the same deterministic projection axis as §4.1 to classify the
finite segment's lambda interval against the positive ray interval (0,+∞).
Parallel non-collinear/disjoint input is NoProbe. A singleton lambda>0 is a
finite endpoint probe; lambda=0 delegates only to C1 and is otherwise NoProbe.
A positive interval uses the exact closest point to pointer:

~~~text
lambdaWitness = clamp(dot(worldPointerDelta,d)/norm2(d), interval)
~~~

If that witness hits the square, it is CollinearOverlapBlocker; otherwise
NoProbe. Thus a collinear ray cannot silently fall through into a C4 endpoint
that overlaps an existing wall.

All hit probes are grouped by exact witness coordinate/interval key, then
pre-ranked by:

1. minimum exact screen-distance-squared;
2. blocker precedence NonIntegerContactBlocker, CollinearOverlapBlocker,
   IntegralContact;
3. exact witness x,z or normalised interval endpoints;
4. fixed direction order;
5. canonical normalised host endpoint pair.

If the winning group contains a blocker, resolver returns the named
draft-only blocked outcome and suppresses C2/C3/C4. If it contains
IntegralContact, that one coordinate group is C2. This separates C2
membership from blocker precedence.

### 4.5 Total presentation ties and denominator-complete C4

C1/C2 ties sort by exact screen-distance-squared, then coordinate x,z, then
SourceTupleV1. The tuple is serializable in preflight but never canonical
Project state:

~~~text
ExistingVertex:
  (kind=0, coordinate, endpointPairs=[], contributingPairs=[])
SegmentEndpoint:
  (kind=1, coordinate, endpointPairs=sorted(normalise(start,end)), contributingPairs=...)
InteriorRayContact:
  (kind=2, coordinate, endpointPairs=sorted(normalise(start,end)), contributingPairs=...)
~~~

An endpoint pair is lexicographic min(start coordinate), max(end coordinate);
contributing pairs are sorted lexicographically. The empty arrays for C1 are
part of the tuple, so iteration order and opaque vertex IDs cannot decide a
tie.

Keep the inverse-camera world delta with one unreduced positive denominator
q=scaleNumerator:

~~~text
vx = ((relativeXU-panXU)*Z - originXmm*scaleNumerator) / q
vz = ((panYU-relativeYU)*Z - originZmm*scaleNumerator) / q
n_d = numerator(vx)*d.x + numerator(vz)*d.z
~~~

Among directions with n_d>0, C4 compares the complete rational scores by:

~~~text
n_a^2 * norm2(d_b)  ?  n_b^2 * norm2(d_a)
~~~

The shared q² cancels only because it is preserved explicitly; norm2 is 1
or 2. A general independently-normalised implementation must compare
p_a²*q_b²*norm2(d_b) with p_b²*q_a²*norm2(d_a). Exact equality uses the fixed
clockwise order.

Let m=max(abs(numerator(vx)),abs(numerator(vz)))/q. If m<50 mm, result is
DraftCommand/CANDIDATE_UNDETERMINED. Otherwise choose positive k from the two
integers surrounding m/100 by comparing:

~~~text
abs(mNumerator - 100*q*k)
~~~

and choose the smaller positive k on equality. Therefore 50 mm gives k=1 and
150 mm gives k=1. C4 endpoint equals origin + 100*k*d. If it violates
ProjectLimits, resolver returns exactly the UI-only
`CANDIDATE_UNDETERMINED / C4_OUT_OF_PROJECT_BOUNDS` result: it creates no
Command and is not replaced by a smaller k or another ray. Candidate
hysteresis is exactly zero.

## 5. Q2 usable polygon — normalisation, joins and simple predicate

### 5.1 Derived face normalisation and miter-only boundary

R3 Alpha permits only one outer ring per bounded Room face. A face with an
inner boundary/hole rejects before usable derivation as
USABLE_POLYGON_COLLAPSED/FACE_HOLE_UNSUPPORTED; this avoids silently using a
single-ring predicate on a polygon set. For a cyclic CCW centerline face,
interior is left. Before every offset join, FaceBoundaryNormalizationV1 runs
in cyclic order:

1. A maximal same-direction, equal-thickness, same-offset run collapses only
   in the derived boundary. It retains the complete ordered source wall
   lineage; canonical WallSegments never merge.
2. A same-direction thickness step rejects as
   USABLE_POLYGON_COLLAPSED/THICKNESS_STEP.
3. A reverse/backtracking/180-degree pair rejects as
   USABLE_POLYGON_COLLAPSED/BACKTRACKING.
4. No zero determinant reaches the miter calculation.

For cardinal stored direction u the inward offset is
t/2*(-uz,ux). For a diagonal direction it is
t*sqrt(2)/4*(-uz,ux). All resulting points are Q2. With non-zero determinant,
the only Alpha join is:

~~~text
p = Aprev + uprev *
    cross(Anext-Aprev, unext) / cross(uprev,unext)
~~~

It is accepted only if both exact Q2 squared comparisons hold:

~~~text
distanceSquared(p,Aprev) <= (2*max(tprev,tnext))^2
distanceSquared(p,Anext) <= (2*max(tprev,tnext))^2
~~~

Equality uses miter. Cap exceedance rejects as
USABLE_POLYGON_COLLAPSED/MITER_CAP. There is no bevel in R3 Alpha policy:
a 45-degree bevel chord can have a length outside Q2. This is a proposed
material reconciliation against the current source miter-then-bevel wording,
not a claim that R3 has changed it.

### 5.2 Q2SegmentContactV1

Usable validity cannot call a float polygon library. For Q2 points A,B,C:

~~~text
orientationQ2(A,B,C) = sign(cross(B-A,C-A))
~~~

For non-zero Q2 segments A→B and C→D:

1. If the line determinant is non-zero, construct exact Q2 line parameters
   t=cross(C-A,D-C)/cross(B-A,D-C) and
   u=cross(C-A,B-A)/cross(B-A,D-C) through Q2
   add/multiply/inverse and compare both against 0 and 1. A point contact is
   then exact Q2.
2. If determinant is zero but orientation(A,B,C) is non-zero, the segments are
   disjoint parallel.
3. If collinear, choose x when Ax≠Bx, otherwise z; normalise the two closed
   Q2 parameter intervals in that coordinate. Classify disjoint, one point
   touch or positive interval overlap exactly.

No denominator is rounded. The classifier returns one of:

~~~text
Disjoint
SinglePoint(pointQ2)
PositiveCollinearOverlap(intervalQ2)
~~~

### 5.3 SimplePolygonQ2V1 acceptance

A derived usable ring is accepted only when all conditions hold:

1. It contains at least three non-zero edges and positive shoelace Q2 area.
2. Adjacent edges share exactly their one intended ring vertex; an adjacent
   repeated miter point, overlap or any additional contact rejects.
3. Non-adjacent edges are Disjoint; a touch, crossing or positive collinear
   overlap rejects.
4. No non-adjacent vertices are equal, and the closing pair follows the same
   adjacent rule.
5. Every Q2 operation and complete non-adjacent pair count remains inside
   USABLE_Q2 limits in §3.

All failures use USABLE_POLYGON_COLLAPSED with a stable draft subtype
REPEATED_VERTEX, ADJACENT_DEGENERACY, NON_ADJACENT_TOUCH,
SELF_INTERSECTION or COLLINEAR_OVERLAP. This predicate is separate from Room
identity scoring in §7.

StrictInteriorQ2(point, simple ring) is exact. First test point-on-edge:
orientationQ2(A,B,point)=0 and point lies in both closed Q2 coordinate
intervals of A→B means Boundary. Otherwise apply the directed half-open
winding rule (Az≤Pz<Bz) or (Bz≤Pz<Az), using orientationQ2(A,B,point) to
add/subtract one. Non-zero winding is Interior; zero is Exterior. No float
point-in-polygon routine is permitted.

Area is abs(shoelace(Q2))/2. A miter-only cardinal edge contributes
abs(delta); a diagonal edge contributes sqrt(2)*abs(deltaX), so usable
perimeter is ExactLengthQ2. No projection approximation feeds these values
back into Plan, Room, host or persistence.

## 6. ExactMetricV1 — retain FR-13 without float or scope reduction

### 6.1 Metric-ready targets

Every Alpha FR-13 target resolves to one of these ephemeral exact extractors,
never a screen coordinate, mesh, render bounding box or approximate physics
shape:

~~~text
MetricPointQ2V1       { sourceKey, x: Q2, z: Q2 }
MetricSegmentQ2V1     { segmentKey, a: MetricPointQ2V1, b: MetricPointQ2V1 }
MetricBoundaryQ2V1    { boundaryKey, segments: sorted MetricSegmentQ2V1[] }
MeasurementTargetV1   =
  PlanPoint | WallCenterlineSegment | UsableRoomBoundaryEdge |
  ItemFootprintBoundary
~~~

ItemFootprintBoundary is the declared canonical footprint, not a render mesh.
R3 proposes Alpha catalog admission require a metric-ready local integer
footprint with at most 64 edges and a D8 rotation/host-basis transform
(yaw steps that are multiples of 45 degrees) that derives Q2 vertices.
Arbitrary-angle/non-static catalog geometry has no
healthy Alpha admission path until a new source-owned metric version exists;
there is no runtime nearest/bounding-box fallback. The selected room boundary,
wall, bed footprint and all other admitted item boundaries therefore retain a
total exact route.

### 6.2 Exact distance and witness

~~~text
ExactMetricDistanceV1 {
  schemaVersion: 1,
  kind: sqrt-q2-mm,
  radicandMm2: non-negative Q2
}
ExactRootQ2 = sqrt(radicandMm2), symbolic and never coerced into Q2/Number
~~~

For points P,Q, squared distance is:

~~~text
sq(P,Q) = (Px-Qx)^2 + (Pz-Qz)^2 in Q2
~~~

For P and non-zero closed segment A→B, let d=B-A, den=dot(d,d)>0 and
n=dot(P-A,d). If n≤0 choose A; if n≥den choose B; otherwise choose
T=A+d*(n/den). The result is sq(P,T), exact Q2 and non-negative; no numeric
clamp occurs.

Two closed segments have distance zero when Q2SegmentContactV1 finds any
contact or overlap. Otherwise evaluate A→CD, B→CD, C→AB and D→AB, then take
the exact Q2 minimum. Boundary distance enumerates the sorted finite segment
pair set and compares squared values because sqrt is monotonic.

Witness ties are deterministic. Segment key is:

~~~text
(target-kind rank, target UUID bytes, ring/edge ordinal,
 minEndpointQ2, maxEndpointQ2)
~~~

After the exact radicand, witness key is:

~~~text
(leftSegmentKey, rightSegmentKey,
 featureRank(contact,leftStart,leftEnd,rightStart,rightEnd),
 leftWitnessX,leftWitnessZ,rightWitnessX,rightWitnessZ)
~~~

Reversing input endpoints or swapping operands cannot change radicand or
formatted text. The witness is ephemeral read-model data.

### 6.3 Quantities, units and the one bounded formatter

~~~text
MetricQuantityV1 =
  LengthQ2Mm | DistanceSqrtQ2Mm | AreaQ2Mm2

MeasurementFormatPolicyV1 {
  schemaVersion: 1,
  length: { unit: mm, fractionDigits: 2 },
  area: { unit: m², fractionDigits: 3 },
  rounding: nearest-half-even,
  notation: fixed
}
~~~

Lengths always remain mm; area converts exactly by 1/1,000,000 before
formatting. The shared port returns structured fixed digits, decimal scale,
unit and approximate flag to Preview, 2D, 3D, DOM and export. Localization may
alter only separator/spacing, never numeric precision or rounding.
approximate=true exactly when the exact value differs from the rendered grid
point; formatted text never becomes geometry input.

For a Q2 value, construct rational sqrt(2) brackets:

~~~text
l_k = floor_sqrt(2^(2k+1)) / 2^k
u_k = (floor_sqrt(2^(2k+1))+1) / 2^k
l_k < sqrt(2) < u_k
~~~

Substitute l/u according to the coefficient sign. For sqrt(q), maintain
rational lo²≤q<hi² and bisect using exact Q2 comparison. If the certified
interval lies wholly inside one rounding cell, output that cell. At the
128-refinement cap, determine the exact boundary instead of using a float:
for quantum g=10^-p, find n=floor(value/g) by bounded rational-grid binary
search with at most 288 index bits, then compare value to h=(n+1/2)g. Q2
compares h directly; sqrt(Q2) compares radicand with h². Below h rounds down,
above rounds up, equality takes the even final index. Exact equality with n*g
determines the approximate flag.

Any count, component, refinement or index breach returns proposed
GEOMETRY_EXACT_LIMIT/METRIC before a partial formatted result. It is a bounded
failure contract, not MEASUREMENT_UNSUPPORTED and not a mutation of Project
state.

## 7. Room identity from bounded centerline overlay

### 7.1 CenterlineFaceKeyV1 and exact overlay

Room survivor score never uses Q2 usable-polygon boolean or its area. It uses
an exact overlay of the old and candidate **centerline Z² face boundaries**.
Old/candidate face input edges have integer endpoints; overlay-only
intersections may be ExactRationalMm and remain ephemeral.

Each bounded face receives CenterlineFaceKeyV1:

~~~text
{
  levelId,
  normalizedCCWDirectedCenterlineOuterBoundary,
  innerBoundaryCount: 0,
  boundaryRootWallLineageDigest
}
~~~

The boundary rotates to its lexicographically least directed coordinate-edge
tuple; reversing a ring or library face enumeration cannot change the key.
Each candidate wall piece carries a sorted immutable root WallSegment lineage.
Every topology command produces NormalizedTopologyEffectV1:

~~~text
{
  kind:
    AddWallSegment | MoveVertex | MoveWallSegment | DeleteWallSegment |
    SplitWallSegment | MergeCollinearSegments,
  sorted sourceRootWallIds,
  sorted outputWallLineageAndFrozenIds,
  removedWallIds,
  normalized command geometry digest
}
~~~

FaceLineageV1 exists only when old/new faces share at least one root wall
lineage through this exhaustive topology effect. Its digest includes sorted
old/new root sets and NormalizedTopologyEffectV1 digest; no command kind falls
through to an unspecified lineage rule.

CenterlineOverlayV1 is a bounded exact arrangement:

1. Collect old and candidate directed face edges, sort by
   snapshot(old,new), CenterlineFaceKeyV1, local edge ordinal and normalised
   endpoint pair.
2. Use §4 exact segment contact, but retain rational overlay contacts rather
   than applying integer admission. Split every edge at its own exact
   segmentParameter, create the rational DCEL half-edge graph, and order
   outgoing half-edges by exact quadrant/cross comparison.
3. Derive bounded arrangement cells. A cell receives a deterministic rational
   witness: choose the lexicographically first non-zero vertical strip between
   consecutive rational x values, then the lexicographically first open
   z interval in that strip and its midpoint. The exact winding test of every
   old/new centerline ring runs at this witness.
4. Sum the signed rational shoelace areas of all cells whose witness is
   strictly inside old face O and candidate face N. This is
   OverlayAreaQ(O,N), an ExactRationalAreaMm2.

Winding on a witness never sees a boundary. A malformed/unbounded/DCEL count
or ambiguous cell construction fails under CENTERLINE_OVERLAY limits in §3;
there is no Q2/float clipping fallback. A hole face is rejected before this
overlay, so every labelled face is the one-ring set defined by its outer
boundary.

### 7.2 Survivor graph and deterministic reduction

Build a bipartite graph G=(OldRooms, CandidateFaces, E). Edge (O,N) exists
only when:

1. OverlayAreaQ(O,N) is strictly positive; and
2. FaceLineageV1(O,N) exists in this topology candidate.

Each edge stores its exact rational score only ephemerally. The serializable
RoomScoreGraphDigestV1 is SHA-256 of canonical bytes for:

~~~text
schemaVersion, baseRevisionId,
sorted old Room IDs and old CenterlineFaceKeyV1,
sorted candidate CenterlineFaceKeyV1,
sorted edges (old ID, candidate key, exact score numerator/denominator,
              FaceLineageV1 digest),
sorted auto matches and residual tie graph
~~~

The digest never puts BigInt in Project state; it binds the confirmed graph.
Reduction is total:

1. For each endpoint calculate its exact maximum incident score in the full
   graph. An edge is an auto match only when it is the unique maximum for
   both endpoints.
2. Freeze all auto matches and remove their endpoints and incident edges.
3. On residual G, recompute endpoint maxima. A tie-eligible edge equals the
   residual maximum for both endpoints and belongs to an equal-maximum set of
   size at least two on one endpoint.
4. RoomSurvivorMapV1 may contain only a sorted partial injective matching of
   these tie-eligible edges. It cannot displace auto matches or select a
   lower-score/consumed edge.

~~~text
RoomSurvivorMapV1 entry {
  predecessorRoomId,
  successorCenterlineFaceKey,
  roomScoreGraphDigest
}
~~~

The validator recomputes G and accepts the map only when every entry and the
same digest survive steps 1–4. Missing mapping for a desired tie does not
pick lexicographically; it creates a new/unmapped successor under §7.3.

### 7.3 Explicit NewRoomSeedV1 eliminates a hidden height default

There is no Level default height in R3. Every candidate face without a
surviving Room ID requires one sorted seed before Opening, adjacency, wall
height, CeilingPlacement or final ChangeSet validation:

~~~text
NewRoomSeedV1 {
  successorCenterlineFaceKey,
  allocatedRoomId,
  heightMm: lossless explicit SafeIntegerMm,
  initialRoomCoreProperties: {
    name: unset,
    type: unset,
    metadata: empty
  }
}
~~~

For reconciliation, a Room record is split conceptually into RoomCoreV1
(identity, face key, name/type/metadata/height and non-wall fields) and
WallSideAssignmentValue entries. The latter are extracted by §8 before the
core property matrix; they never silently transfer merely because a Room ID
survives.

Preflight derives exactly the required successor face keys and may suggest a
height copied from one predecessor for a pure split, but the confirmed command
must carry an explicit valid integer heightMm for every seed. It may not
implicitly accept a suggestion, a Level field or a UI default. Missing,
extra, stale, duplicate or invalid seeds reject as ROOM_SEED_REQUIRED.
heightMm also passes the current ProjectLimits Room-height range before any
Opening, adjacency or host validation.

| Candidate outcome | ID/properties before validation |
| --- | --- |
| Unchanged face fingerprint | Same Room ID and complete existing RoomCoreV1. |
| Auto/tie-map survivor | Same Room ID and complete predecessor RoomCoreV1, including heightMm. |
| Every non-survivor/new/unmapped/mixed successor | New allocated Room ID plus exactly one NewRoomSeedV1; no inherited height unless it was explicitly supplied in that seed. |
| Explicit SetRoomProperties bundled atomically | Applies to the named resolved record before host/Opening validation and is included in impact digest. |

After Room core IDs/records resolve, §8 maps explicitly remove each source
WallSideAssignmentValue and create each target address-keyed value. Only then
does the candidate assemble the final normalized Room record commitment and
before/after loss digests. Wall-side values are acknowledged by their map and
inverse, not silently carried through a RoomCoreV1 acknowledgement.

### 7.4 Bound loss acknowledgement and CeilingPlacement predicate

Every predecessor that loses an ID or field transfer has a sorted
RoomLossAcknowledgementV1:

~~~text
{
  losingRoomId,
  carryClassOrFieldSet,
  normalizedBeforeDigest,
  resolvedOutcome:
    RetainedSuccessor(successorCenterlineFaceKey) |
    NewRoomSeed(successorCenterlineFaceKey, allocatedRoomId) |
    RemovedNoSuccessor,
  normalizedAfterDigest
}
~~~

The validator recomputes the full before/after records, requires one exact
acknowledgement for every loss and rejects missing, duplicate, stale or
mismatched acknowledgement as ROOM_LOSS_ACK_INVALID. A generic “data loss
confirmed” bit cannot substitute for this map.

CeilingHostResolutionV1 is required for every affected CeilingPlacement:

~~~text
{
  assetInstanceId,
  action:
    Keep |
    MoveAsset { complete explicit targetPlacement } |
    DeleteAsset { explicit user acknowledgement }
}
~~~

It is confirmed, impact-digested, put in ChangeSet and has an explicit inverse.
MoveAsset runs its normal full placement/host validation; DeleteAsset restores
the exact asset in the inverse. Keep is valid only after its Room record is
resolved and the Q2 usable polygon passes §5. Its exact predicate requires:

1. same surviving Room ID;
2. 0≤dropMm and dropMm+assetHeightMm≤Room.heightMm;
3. every footprint vertex is StrictInteriorQ2, and every footprint edge is
   Disjoint from every usable-boundary edge. For a non-zero simple footprint
   this is the exact strict-containment predicate; contact, crossing or
   overlap is failure.

Point footprints use the same strict-inside predicate. There is no nearest-room
rehost. An invalid Keep with no valid explicit MoveAsset/DeleteAsset rejects
the whole candidate as HOST_SURFACE_REMOVED before ChangeSet creation. A
successful ChangeSet records only its resolved Keep/Move/Delete action, never
a contradictory “rejected/retained” host result.

## 8. Closed wall-host transfer contract

### 8.1 WallHostedRecordKindV1 and extractor

R3 closes the V1 wall-host surface. A record outside this enum makes a
topology split/merge reject until a future source-owned schema version adds an
extractor.

| Kind | Canonical source/key | Identity/output rule |
| --- | --- | --- |
| OpeningEntity | Opening by OpeningId with WallSegmentId | Entity identity stays the same; it has no wall side. |
| WallPlacementEntity | AssetInstance by AssetInstanceId with WallPlacement | Entity identity stays the same only under an identical local basis. |
| WallSideAssignmentValue | Room surface assignment at SurfaceAddress WallSide(WallSegmentId, AdjacentRoomId or ExteriorSide) | Address-keyed value, not an entity; output identity is its exact target SurfaceAddress. |

WallHostRecordExtractorV1 emits, for every kind:

~~~text
{
  sourceKind,
  sourceKey,
  canonicalPayloadDigest,
  sourceWallSegmentId,
  physicalIntervalMm,
  localBasis,
  referencedResourceDigest
}
~~~

Opening interval is [leadingOffset, leadingOffset+width]. WallPlacement is
never a zero-width anchor fallback. Its AssetDefinition must declare
WallHostFootprintV1; transform the local footprint/anchor by its exact
orientation into wall tangent coordinates and use:

~~~text
[offsetMm + min(tangent projections),
 offsetMm + max(tangent projections)]
~~~

Both bounds must be finite SafeIntegerMm. Otherwise automatic transfer rejects
as HOST_REBASE_UNSUPPORTED. A full WallSideAssignmentValue interval is
[0, wallLength].

LocalBasisV1 is:

~~~text
{
  storedTangent: ordered start-to-end wall direction,
  resolvedPhysicalSide: AdjacentRoomId | ExteriorSide,
  normalSign,
  normalOffsetMm,
  orientationTransform: IdentityOnly
}
~~~

For WallPlacement, all fields above plus placement orientation are preserved
exactly. A renderer transform cannot infer a side, flip normal sign or rotate
the asset during a topology command.

### 8.2 PartitionAttachmentMapV1

Every explicit SplitWallSegment and every automatic T/X partition that splits
a source wall requires one supplied-and-recomputed map:

~~~text
PartitionAttachmentMapV1 {
  schemaVersion: 1,
  sourceTopologyDigest,
  entries: sorted [{
    source: WallHostRecordExtractorV1,
    outputs: sorted TargetHostV1[],
    transferRule: PreserveOne | CloneFullSideToLineageChildren,
    inverseRule: RestoreOne | CollapseLineageChildrenToSource
  }]
}

TargetHostV1 {
  outputKeyOrId,
  targetWallSegmentId,
  targetPhysicalIntervalMm,
  targetLocalBasis,
  outputCanonicalPayloadDigest
}
~~~

Every extracted source record occurs in exactly one entry. Every target output
occurs in exactly one entry. Source and target payload/resource digests are
rechecked against the candidate; absent, extra, stale or ambiguous entries
reject as PARTITION_ATTACHMENT_MAP_INVALID.

Rules are total:

1. OpeningEntity and WallPlacementEntity have exactly one output, preserve
   their ID and full physical interval, and may move only to one
   same-orientation **axis** child that contains the closed interval. If child
   starts at old local coordinate s, target offset is source offset-s.
   Boundary equality is permitted only when the entire closed span remains in
   that one child; a span crossing a split point rejects.
2. WallPlacement output must retain LocalBasisV1 exactly after Room resolution:
   same stored tangent, same physical side, same normal sign/normalOffset and
   IdentityOnly orientation transform. Any mismatch rejects as
   ANCHOR_REHOST_AMBIGUOUS; diagonal/reverse automatic transfer rejects as
   HOST_REBASE_UNSUPPORTED.
3. A full-side WallSideAssignmentValue may have one output for every lineage
   child, all with identical canonical payload and independently resolved
   target SurfaceAddress. This explicit 1→n clone is the only cloning rule.
   Partial/non-uniform side assignments reject in V1.
4. The inverseRule explicitly deletes every cloned target address/value and
   restores the one original source address/value. No inferred undo merge is
   allowed.

Each output runs resource-pin, BackupFeasibilityPolicy and SessionRetentionPolicy
validation before durability. Thus a material/asset transfer cannot create an
unbacked host record.

### 8.3 Manual merge and MergeAttachmentMapV1

MergeCollinearSegments is an explicit user command only, never normalizer
cleanup. Its input is a same-direction ordered **axis** chain:

~~~text
A.end = J = B.start
degree(J) = 2
no branch, no overlap
equal thickness
same stored tangent orientation
~~~

R3 permits MergeCollinearSegments only for the axis-chain precondition above.
Every diagonal or reverse merge, including a bare wall, rejects as
MERGE_PRECONDITION_FAILED. This is an intentional Alpha narrowing, not an
implicit empty-map exception.

MergeAttachmentMapV1 uses the same closed extractor and target structure as
PartitionAttachmentMapV1:

~~~text
MergeAttachmentMapV1 {
  schemaVersion: 1,
  sourceTopologyDigest,
  entries: sorted [{
    source: WallHostRecordExtractorV1,
    output: TargetHostV1,
    transferRule: PreserveOne | CoalesceEqualFullSide,
    inverseRule: RestoreOne | ExpandTargetToSources,
    coalesceGroup: optional {
      targetOutputKey,
      sortedSourceKeys
    }
  }]
}
~~~

It includes every source record exactly once and:

~~~text
for source on A:
  target interval = source interval
  tangent translation = 0
for source on B:
  target interval = translate(source interval, length(A))
  tangent translation = length(A)
same LocalBasisV1 only
targetWallSegmentId = frozen merged wall ID
~~~

Opening/WallPlacement entities retain their exact ID only when their full
physical interval and basis meet this formula; PreserveOne/RestoreOne applies
only to those entity kinds. WallSideAssignmentValue has one total matrix per
resolved target physical side:

| Source full-side values on A/B | Target value |
| --- | --- |
| 0 | 0; no target assignment is created. |
| 2 with byte-normalised equal canonical payload | 1 CoalesceEqualFullSide output. |
| 1, 2 unequal, or another cardinality | Whole merge rejects as MERGE_ATTACHMENT_MAP_INVALID. |

The permitted two-value coalesce targets the one resolved address key:

~~~text
SurfaceAddress WallSide(mergedWallId, resolvedAdjacentRoomId | ExteriorSide)
~~~

Its inverse deletes that one target value and restores both exact source
address-keyed values. There is no “semantic-equivalent”, visual equality or
arbitrary surviving source record. Different/missing payload, output key,
interval, side, resource digest or inverse rejects as
MERGE_ATTACHMENT_MAP_INVALID.

CoalesceEqualFullSide is valid only for exactly two source address-keyed
values with one shared targetOutputKey and one matching sortedSourceKeys list.
All other WallSideAssignmentValue cardinalities reject. This makes the n→1
identity and inverse cardinality explicit.

### 8.4 Opening and side semantics

Opening.offsetMm is the integer leading-edge offset from the stored canonical
start to stored canonical end of its host wall; it is neither a percent nor a
world coordinate.

| Operation | R3 semantics |
| --- | --- |
| MoveVertex or MoveWallSegment with same WallSegmentId and stored order | Retain existing opening offset, then revalidate whole interval. No clamp/recenter. |
| MoveOpening | Command carries explicit target host and explicit new leading-edge offset. It is a deliberate placement operation, not automatic rebase. |
| ResizeOpening | Retains leading edge unless explicit replacement offset is supplied, then validates width/height/sill. |
| T/X or SplitWallSegment | Use PartitionAttachmentMapV1 only. |
| Axis merge | Use MergeAttachmentMapV1 only. |
| Reverse/diagonal automatic rebase | Reject HOST_REBASE_UNSUPPORTED. |
| Delete host with a V1 hosted record | Reject atomically; user must execute an explicit valid remove/move path first. |

Before any WallSideAssignmentValue or WallPlacement target is accepted, its old
AdjacentRoomId must resolve through §7 to exactly one Room on the same physical
side. ExteriorSide remains only ExteriorSide on that same physical side.
There is no nearest/lexical side substitution.

## 9. Frozen allocation, impact binding and durable lifecycle

### 9.1 FrozenAllocationPlanV1

No kernel-local random allocator may decide a durable output. Preflight carries
a caller-supplied, immutable, sorted plan; the confirmed command repeats it
verbatim:

~~~text
FrozenAllocationPlanV1 {
  schemaVersion: 1,
  allocations: sorted [{
    kind:
      NewVertex | PartitionWallPiece | MergedWall | NewRoom |
      NewEntityOutput,
    purposeKey,
    opaqueId
  }]
}
~~~

Purpose key is canonical and stable: type rank plus contact coordinate,
source-wall ID/segment parameter, CenterlineFaceKeyV1 or target host key as
appropriate. All opaque IDs must be unique, valid and absent from base
Revision. The plan must contain exactly every new entity output and no unused
entry. Address-keyed WallSideAssignmentValue outputs use their deterministic
SurfaceAddress rather than inventing an entity ID.

Every contact group, partition piece, merged wall, seeded Room and cloned
entity output refers to this plan. Forward replay reuses the same plan; undo
uses the stored inverse; redo reuses the original forward ChangeSet and IDs.

### 9.2 PreflightImpactV1 and confirmed command

Preflight is isolated and ephemeral. It can show candidate geometry,
Room/attachment consequences and seed forms, but creates no Command, ChangeSet,
PendingDurability, History, autosave or canonical projection.

It produces PreflightImpactV1 with:

~~~text
{
  schemaVersion,
  baseRevisionId,
  normalizedTopologyIntent,
  FrozenAllocationPlanV1,
  RoomScoreGraphDigestV1,
  RoomSurvivorMapV1,
  NewRoomSeedV1[],
  RoomLossAcknowledgementV1[],
  CeilingHostResolutionV1[],
  PartitionAttachmentMapV1[],
  MergeAttachmentMapV1?,
  resolvedRoomRecordCommitment,
  resourcePinAndBackupCommitment,
  exact output host keys,
  impactDigest
}
~~~

impactDigest is SHA-256 of the canonical byte serialization of all fields
above. It contains neither pointer/camera state nor BigInt. The user confirms
this exact impact, not a generic preview.

The confirmed Command carries baseRevisionId, the same complete impact payload
and impactDigest. After the base-revision fence, domain rebuilds the detached
candidate, recomputes all maps, score graph, seeds, acknowledgements,
allocations, resolved records and resource commitments, then byte-compares the
recomputed canonical impact serialization. A mismatch rejects as
IMPACT_DIGEST_MISMATCH before PendingDurability.

Resolved room records are a checked commitment, not a way for UI to choose an
arbitrary height/name/finish. §7 matrix and an explicitly declared bundled
SetRoomProperties mutation are authoritative; any other supplied record
difference rejects.

### 9.3 Complete ChangeSet and inverse

Only a fully validated candidate creates a ChangeSet. It contains:

~~~text
{
  forwardTopologyAndCanonicalRecordChanges,
  FrozenAllocationPlanV1,
  impactDigest,
  RoomScoreGraphDigestV1,
  RoomSurvivorMapV1,
  NewRoomSeedV1[],
  RoomLossAcknowledgementV1[],
  CeilingHostResolutionV1[],
  PartitionAttachmentMapV1[],
  MergeAttachmentMapV1?,
  exact affected entity IDs and SurfaceAddress keys,
  resource pin/backup results,
  explicit inverseChangeSet
}
~~~

The inverse restores source records, source IDs and the 1→n/n→1 attachment
effects specified by the maps. It does not rerun a new geometry library or
allocate new IDs. Serialization → replay → undo → redo must restore
byte-identical Project IDs, host addresses, maps and current Durable Revision.

Cancel, stale base, failed exact limit, invalid map/seed/ack/allocation/digest,
validation failure or persistence failure leaves the prior Durable Revision
byte-identical. Persistence failure is distinct from validation failure and
does not masquerade as a rejected geometry rule.

## 10. Required executable corpus before canonical adoption

The following is a source-owned, versioned evidence requirement. S-2,
Playwright emulation, a screenshot or a geometry-library default cannot replace
it.

| Area | Minimum executable evidence |
| --- | --- |
| Rational contacts | ExactRational normal form; 999-mm half X; negative/bounds contacts; duplicate-before-overlap; finite collinear reversed/equal, endpoint, gap and positive-overlap cases; no BigInt truncation. |
| Partition order | Group-before-sort; segmentParameter on every affected segment; multiple contacts on proposed/existing forward/reverse walls; T at junction; X plus another contact; one atomic piece/ID result. |
| Presentation/RayProbe | Binary64 client/rect/pan/scale ingress, explicit pan round-half-even and no truncation; identity-CSS-transform enforcement; snapshot and complete 8×n probe caps; C1 tuple empty key; every C2 probe kind; finite/collinear D=0 branches; blocker precedence; C3 empty; all C4 threshold/tie, non-unit scale denominator and out-of-ProjectLimits Draft cases. |
| Q2 usable | Q2 normal form/sign/order/inverse; zero-turn collapse; thickness step/backtrack; face-hole rejection; convex/reflex miter below/equal/above cap; exact Q2 segment contact; all simple-polygon rejection kinds; no projection feedback. |
| ExactMetricV1 | Point-point, point-boundary, boundary-boundary; interior projection, cross/touch/overlap/gap; Q2 diagonal/item footprint examples; root radicand, witness/reversal/symmetry ties; room area/perimeter goldens. |
| Formatter | Shared Preview/2D/3D/export structured token; mm/m² conversion; fixed precision; exact decimal/approximate flag; half-even ties; interval early/cap path; no Intl/float rounding; every metric cap below/at/above. |
| Centerline Room graph | Bounded rational overlay; concave/changed faces; face-hole rejection; graph exact scores, lineage for every topology command kind, auto/reduced ties, invalid lower-score map, score digest mismatch, pure/mixed/no-predecessor seeds and explicit heights. |
| Room loss/ceiling | Multiple loss acknowledgements, stale before/after digest, explicit property mutation, height-sensitive Opening/adjacency, same-ID but footprint outside usable polygon, drop/height, explicit Keep/MoveAsset/DeleteAsset resolution, inverse and no-nearest-room outcomes. |
| Attachment maps | Closed V1 extractor coverage; Opening vs WallPlacement vs address-keyed side value; asset physical span and boundary-touch/crossing; local basis/side/orientation; Room-core-versus-side assembly; full-side 1→n clone and inverse; merge side 0→0/2-equal→1 and singleton/unequal rejection; reverse/diagonal/unknown-kind rejects; resources/backups retained. |
| ChangeSet/replay | Frozen allocations, output-ID collision/missing/extra; impact digest stale/mismatch; serialize/replay/undo/redo exact IDs/keys/maps; stale base, map/ack/seed/digest failure, persistence failure and SessionRetention/2-MiB limits leave Durable Revision unchanged. |
| Invariance/device | Integer translation, reflection, endpoint reversal and 90-degree rotation; all four diagonal quadrants; explicitly no 45-degree rotation invariance; ProjectLimits stress and G-1/physical-phone validation of 44-px zero-hysteresis policy. |

## 11. R2 rejection finding disposition

This is a traceability aid for the next independent review. It states where R3
addresses a finding; it does not convert any rejection into acceptance.

| R2 finding | R3 disposition |
| --- | --- |
| D022-R2-01: FR-13 metric removed | §6 retains exact point/boundary metrics and formatter. |
| D022-R2-02: hidden Level height | §7.3 requires explicit NewRoomSeedV1 height for every new/unmapped face. |
| D022-R2-03: incomplete reasons/limits | §§2–3 give one status table and phase-specific count/limit outcomes. |
| D022-R2-04: incomplete rational C4 score | §4.5 preserves common inverse denominator and gives full cross-product comparison. |
| D022-EXACT-R2-01: contradictory C2/noninteger membership | §4.4 separates pre-ranked RayProbe blockers from integral C2. |
| D022-EXACT-R2-02: collinear ray undefined | §4.4 gives D=0 finite ray interval branches and blocker behavior. |
| D022-EXACT-R2-03: finite collinear predicate/duplicate | §4.1 defines duplicate precedence and projection-interval classifier. |
| D022-EXACT-R2-04: pair-local contact order | §4.2 defines per-segment parameter sorting after grouping. |
| D022-EXACT-R2-05: pan/CSS-transform ingress | §4.3 quantises pan and prohibits every CSS transform. |
| D022-EXACT-R2-06: unbounded presentation snapshot | §§3 and 4.3 define snapshot bounds and pre-inverse Draft outcome. |
| D022-EXACT-R2-07: incomplete source tie key | §4.5 defines SourceTupleV1, pair ordering and C1 empty payload. |
| D022-EXACT-R2-08: Q2 simple predicate absent | §§5.2–§5.3 define Q2 contact and exact simple-ring acceptance. |
| D022-EXACT-R2-09: Room requires unspecified Q2 boolean | §7 uses bounded rational centerline overlay/lineage only. |
| D022-EXACT-R2-10: FR-13 scope contradiction | §6 retains the FR-13 metric path; no unsupported reason exists. |
| D022-EXACT-R2-11: formatter lacks total policy | §6.3 defines units, precision, half-even, intervals, cap and failure. |
| D022-EXACT-R2-12: order-dependent resource caps | §3 defines counts, canonical passes and per-phase outcomes. |
| D022-R2-TDI-01: collinear finite classifier | §4.1. |
| D022-R2-TDI-02: partition ordering | §4.2. |
| D022-R2-TDI-03: automatic split has no map | §8.2 requires PartitionAttachmentMapV1 for all explicit/automatic splits. |
| D022-R2-TDI-04: merge enum/output/inverse open | §§8.1 and 8.3 close V1 enum, output key and inverse. |
| D022-R2-TDI-05: WallPlacement treated as point | §8.1 derives occupied physical span from asset footprint/anchor. |
| D022-R2-TDI-06: survivor tie relation partial | §7.2 defines graph, maxima reduction, eligibility and digest. |
| D022-R2-TDI-07: generic loss acknowledgement | §7.4 binds each loss to before/after outcome digests. |
| D022-R2-TDI-08: ceiling checks identity only | §7.4 adds exact usable-polygon footprint/height predicate plus confirmed Keep/MoveAsset/DeleteAsset resolution. |
| D022-R2-TDI-09: full-side clone inverse missing | §8.2 names 1→n outputs and CollapseLineageChildrenToSource inverse. |
| D022-R2-TDI-10: WallPlacement basis not preserved | §§8.1–8.2 bind tangent/side/normal/orientation identity. |
| D022-R2-TDI-11: output IDs not frozen | §9.1 defines FrozenAllocationPlanV1 and replay semantics. |
| D022-R2-TDI-12: preflight not consequence-bound | §§9.2–9.3 bind impact digest, ChangeSet and inverse; §10 demands replay tests. |

## 12. Canonical adoption route and retained blockers

R3 deliberately proposes source deltas that only their owners may accept:

- miter-only rather than current miter-then-bevel usable policy;
- C3-empty/RayProbe presentation semantics;
- ExactMetricV1 catalog D8 footprint/admission and formatter precision/locale;
- centerline overlay Room scoring, explicit Room seeds and loss maps;
- the proposed stable reason codes/limits and the frozen map/impact payload.

Required route:

1. Fresh independent current-source, exact-geometry and topology/data-integrity
   reviews assess this exact R3 SHA and the finding disposition table.
2. A completed source-owned executable corpus and physical/device evidence
   establishes the proposed limits, metrics and touch policy.
3. A fresh bmad-architecture update, using the prescribed memlog workflow,
   may reconcile affected ADs only after that review.
4. bmad-spec, bmad-prd and bmad-ux reconcile Geometry Contract, FR-13,
   reason registry, catalog footprint/formatting constraints and visible
   confirmations. Traceability/readiness are then rechecked.

Until every step succeeds, R3 is a decision input only. It does not authorize
source promotion from S-2, root implementation, tests/CI, a commit or a claim
of READY.
