---
title: "InteriorsEditor — external adversarial exact-geometry review of D-022 R4"
review_type: adversarial-exact-geometry-precanonical-r4-external
reviewed: 2026-08-05
reviewer: "Codex /root/d022_exact_geometry_research"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r4-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 2711b00ee98e1bbf7649cae7ef4d51974c9a1615f9e712cebbcd9d9ab86b321b
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../../project-context.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "External read-only adversarial review of only the declared R4 SHA. It attacks rational/Q2/C1–C4/RayProbe, formatter/metric, canonical bytes, face normalization, transfer and resource outcomes for totality. It does not rely on prior or internal PASS dispositions and changes no draft, canonical source, memlog, code, test, configuration or evidence."
source_mutations: "Created this independent review artifact only."
---

# Verdict

**`REJECT_FOR_PRECANONICAL_INPUT`; `G-READY` remains `NOT_READY`.**

R4 fixes several real R3 defects: it gives `CameraDeltaV1` a separate type,
defines finite raw-camera ingress, removes the unworkable old/new overlay,
names a C8 rotation group, defines winding branches, and introduces a useful
canonical-byte direction.  Those improvements are not enough for an exact
kernel policy.  Several algorithms that R4 calls total remain underspecified,
and a few have open escape hatches that would let an implementation choose its
own durable outcome.

This rejection is confined to the stated noncanonical R4 SHA.  It neither
changes the Architecture Spine nor invalidates the existing source contracts,
and it does not authorize implementation, test bootstrap, CI, a commit or a
readiness claim.

## Checks that passed this review

- The reviewed document hashes to the exact SHA declared above.
- The separate `CameraDeltaV1` correctly avoids treating an unreduced shared
  C4 denominator as a normal `ExactRationalMm`.
- `RawSnapshotIngressV1` now names non-finite values, raw `-0`, transform
  rejection, post-quantization positive scale and an ordered Draft outcome.
- The R4 removal of the rational old/new overlay is coherent with its new
  explicit changed-face map policy; it no longer pretends coincident old/new
  boundaries can be sent through a topology-overlap rejection classifier.
- The exact formatter has a materially stronger initial enclosure than R3,
  and `YawStepC8V1` correctly distinguishes rotations from dihedral
  reflections.  Both still need the missing details below.

## Findings

- **D022-R4-EXT-01 — C1 still has no winner-selection order.**  §2.3 says a
  C1 is any canonical Vertex inside the closed hit square, but gives no rank
  among two or more such vertices.  The later `SourceTupleV2` sentence only
  says what to use for “equal hits”; it does not state C1's primary
  `ScreenDistanceSqV1`, coordinate and source-key comparison, nor whether its
  ordering is the same as C2.  On a dense junction, two implementations can
  choose different existing vertices before RayProbe is even considered.
  Define one complete C1 candidate key and make the C1/C2 class handoff and
  tie order explicit.

- **D022-R4-EXT-02 — C4's scalar used for quantization is unnamed and the
  zero-delta control order is incomplete.**  R4 defines
  `m=max(abs(dxNumerator),abs(dzNumerator))/q`, then chooses `k` using
  `abs(mNumerator-100*q*k)`, but never defines `mNumerator`.  It also ranks
  directions with `n_d>0` before saying that `m<50` returns a Draft; at zero
  delta there is no direction to rank.  Name the integer numerator exactly,
  require the `m<50` branch before direction selection, and give the exact
  C4 result for every zero/threshold/tie case.  A variable that is only
  inferable from prose is not a total exact construction rule.

- **D022-R4-EXT-03 — `CanonicalBytesV1` is not yet an encodable wire grammar.**
  §1.4 names canonical values, but leaves the encoding of Record field IDs,
  Array counts, byte lengths, Union IDs/variant IDs and nested value framing
  unstated.  “field count + numeric fieldId/value pairs” is not a byte rule;
  implementers can choose different varint encodings or nesting delimiters.
  It also does not publish the field-ID/union registry for the actual
  `ImpactContentV1`, maps, seeds, context and purpose records it claims can be
  hashed.  Specify every integer encoding and a closed schema registry, then
  publish full—not merely fragmentary—golden bytes/digests for each digest
  input.  Until then a byte-equal preflight/replay assertion is not portable.

- **D022-R4-EXT-04 — Face traversal is asserted rather than specified.**
  §3.1 says the validator enumerates bounded centerline cycles in “sorted
  directed edge order”, but that does not say how a half-edge chooses its next
  outgoing edge at a T, X or higher-degree vertex, how the exterior cycle is
  recognized, or how duplicate directed traversals are eliminated.  These are
  precisely the steps that produce `SingleOuter`, `HasInnerRing`,
  `NestedRing` and `TouchingRings`.  Define a complete integer planar
  half-edge successor/turn-order algorithm, bounded cycle ownership and the
  classification relationship among components; a geometry library cannot
  supply it by default.

- **D022-R4-EXT-05 — R4 regresses the exact miter construction to prose.**
  §3.2 says to offset by half-thickness in Q2, intersect adjacent lines and
  reject an excessive miter, but no longer defines the cardinal/diagonal offset
  formula, same-direction/thickness-step treatment, line-intersection formula,
  cap comparison or exact miter-cap value.  The simple-polygon predicate can
  only validate a ring after these missing points exist.  Restore a bounded
  Q2 construction for every permitted eight-direction pair, including zero
  determinant, duplicate/collinear run, thickness step, backtrack and the
  precise cap/equality outcome.

- **D022-R4-EXT-06 — Direct room lineage is not a complete eligibility
  relation.**  `FaceLineageRelationV1` exists when every *listed* root
  occurrence tuple is reconstructible and the list is nonempty, but it does
  not require the list to be an exhaustive, duplicate-free correspondence of
  all old/new boundary occurrences.  `effectTransitionKind` also has no closed
  enum or construction rule for each topology command.  A caller can therefore
  submit one true shared-root tuple while omitting conflicting/missing boundary
  lineage and preserve a Room ID through a changed Face.  Define the expected
  tuple set from the normalized effect, exact cardinality/equality rules and a
  closed transition enum before accepting a `RoomSurvivorMapV2` entry.

- **D022-R4-EXT-07 — Metric-ready footprint orientation is inconsistent across
  the policy.**  §4.1 admits an asset footprint that is finite, ordered and
  simple, but does not require or normalize its winding.  §3.2 later requires
  a ceiling/floor footprint to be CCW before strict containment.  C8 rotations
  preserve a CW winding, so the same otherwise metric-ready asset can be
  accepted for measurement yet fail every host validation depending on its
  catalog serialization.  Require canonical CCW footprint normalization (or a
  named admission rejection) before both metric extraction and host checks,
  with an exact footprint digest after normalization.

- **D022-R4-EXT-08 — The half-even formatter cannot prove decimal boundary
  equality.**  §4.3 says a value exactly at a half chooses the even digit, but
  gives only bisection until an interval lies in one rounding cell.  A rational
  exact root such as a non-dyadic decimal can remain straddled by binary
  midpoints forever; to distinguish it from a half-cell boundary the formatter
  must compare the exact Q2/squared value directly with the rational decimal
  boundary.  No such comparison, half-open cell convention or rule for
  `exactAtPrintedPrecision` is defined.  Add a direct exact boundary test and
  precise Boolean semantics, with below/equal/above fixtures for every unit
  conversion.

- **D022-R4-EXT-09 — The metric candidate language does not state whether a
  selected boundary means one edge or the complete boundary.**
  `MetricBoundaryV2` carries `edgeOrdinal` for usable and asset boundaries,
  while FR-13 promises distance between selected points/boundaries.  §4.2
  describes point/boundary and boundary/boundary candidate sets as though a
  boundary can contain multiple segments, but no value type represents that
  whole ordered segment set or states that selection intentionally narrows to
  one edge.  This changes both the minimum and witness.  Define a closed
  `MetricBoundary` expansion (whole ring versus named edge) and use it
  consistently in selection keys, pair counts and formatting evidence.

- **D022-R4-EXT-10 — Partition transfer keeps an undefined implementation
  escape hatch.**  §6.2 rejects a crossing Opening/WallPlacement interval
  “unless an explicitly supported deterministic split rule” produces children,
  but R4 defines no such rule, its trigger or its inverse.  It also gives no
  exact conversion from a source local interval/offset to the child-local
  interval when a contained host is retained.  This is not a closed V2 map:
  different adapters can reject, split or relocate the same hosted record.
  Either forbid all crossing intervals in V2 and state the child-offset
  formula, or name the only split rule, its output IDs, resource checks and
  exact inverse.

- **D022-R4-EXT-11 — Wall-side proof lacks a total face-side and address-set
  derivation.**  `WallSideResolutionV1` refers to a physical-side proof built
  from “face-side occurrence”, but neither §3's face traversal nor §6 defines
  how that occurrence maps a directed wall half-edge to `Left|Right`, how all
  affected source/target addresses are enumerated, or how a multi-junction is
  rejected before a map is accepted.  The no-two-exterior safeguard does not
  fill this gap.  Define the exact bounded address-set extractor and physical
  side predicate for unchanged, split, merge, reversed and unclosed cases;
  otherwise a same wall ID with a changed Room can acquire divergent material
  or host assignments.

- **D022-R4-EXT-12 — Replay/undo policy fencing can break existing session
  history.**  §7.1 rejects a changed ProjectLimits/policy bundle before a new
  durable mutation, while §7.3 says replay, undo and redo re-run a policy
  version/base fence without saying whether they use the historical bundle
  recorded by the ChangeSet, a compatible migrated bundle, or the current
  policy.  The project invariant forbids a new policy or retention check from
  silently breaking an existing undo/redo entry.  Specify historic policy
  lookup/migration and redo/undo base semantics, including the stable result
  when the recorded policy is unavailable; do not leave a current-policy
  default to invalidate a valid history resource.

## Remaining global blockers

- R4 deliberately proposes source deltas for holes, changed-face Room ID
  preservation, miter-only usable polygons, C1–C4/RayProbe policy, C8 catalog
  admission, reason codes and the complete map/digest schema.  Architecture,
  SPEC, PRD and UX owners must reconcile them; this review does not do so.
- The promised executable corpus still does not exist.  It must cover the
  repaired C1/C4 ordering, full byte-record grammar, half-edge traversal,
  miter construction, complete lineage correspondence, whole-boundary metrics,
  host interval transformations and historic undo/redo policy cases.
- Physical NFR-15, G-1, S-2 and all other readiness gates remain open.  No
  internal or external review alone is evidence of an implemented kernel.
