---
title: "InteriorsEditor — adversarial exact-geometry review of D-022 revision 2"
review_type: adversarial-exact-geometry-precanonical
reviewed: 2026-08-05
reviewer: "Codex /root/d022_exact_geometry_research"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 0bbab7d0771a3a1a78b50ef3a58e3f723d828322cb36ff249c90f9d1f70cd167
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../evidence/spikes/S-2/work-package.md
  - ../../../evidence/spikes/S-2/policy-boundaries.md
  - review-current-source-d-022-geometry-policy-2026-08-05.md
  - review-d022-adversarial-geometry-policy-2026-08-05.md
  - review-d022-topology-data-integrity-2026-08-05.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Read-only adversarial review of rational contacts, Q2, fixed-point selection, C1–C4, ties and resource bounds at the stated SHA; no draft, canonical source, memlog, code, test, configuration or evidence mutation"
source_mutations: "Created this independent review artifact only."
---

# Verdict

**`REJECT_FOR_PRECANONICAL_INPUT`; `G-READY` remains `NOT_READY`.**

Revision 2 materially improves the previous working input: it removes the
truncating-`BigInt` wording, makes the screen-relative pointer boundary more
concrete, limits usable geometry to miter-only `Q(√2)`, and correctly excludes
45-degree rotation invariance of the integer-mm lattice.  Those are sound
directions, not a complete lower-level contract yet.

The findings below still let two conforming implementations choose a different
candidate, rejection reason, contact order, resource outcome, usable polygon
or Room identity from the same inputs.  Therefore this revision must not enter
the source-owning architecture update until corrected and independently
re-reviewed.  This verdict concerns only the noncanonical D-022 input; it does
not promote or invalidate S-2, alter an `AD-*`, or change any implementation
or readiness gate.

## Checks that passed this review

- The reviewed file hashes exactly to the SHA declared in this review.
- `ExactRationalMm` now has a positive denominator, explicit normalisation and
  integer-only admission before canonical `SafeIntegerMm` conversion.
- The miter-only narrowing correctly avoids falsely representing a 45-degree
  bevel chord as a `Q(√2)` perimeter term.
- The document preserves the canonical integer-mm/ephemeral-arithmetic
  boundary and does not claim that a browser, S-2, a renderer, a device run or
  the working draft establishes `READY`.

## Findings

- **D022-EXACT-R2-01 — C2 has mutually incompatible membership rules.**
  Section 3.1 says C2 contains only an exact *integer-mm* result, while
  section 3.2 ranks an exact hit group and can make a *non-integer* group the
  winner that blocks C4.  If non-integer contacts are excluded before C2
  ranking, they cannot win; if included, they violate the table's generator
  rule.  Define a separate pre-ranked `RayProbe` set containing integral
  candidates and non-integral blockers, then state exactly how a blocker
  competes with an integral C2 candidate and C4.

- **D022-EXACT-R2-02 — A collinear ray/segment has no stated C2 outcome.**
  Section 3.2 requires `D != 0`, but an active allowed ray can be collinear
  with an existing segment.  The input does not say whether an endpoint on
  that ray is delegated to C1, whether an interior target becomes a blocked
  Draft, or whether C4 is allowed to construct a later overlap.  Give the
  exact `D = 0` ray policy, including shared-endpoint, disjoint and
  positive-overlap branches, rather than leaving a geometry-library or UI
  default to supply it.

- **D022-EXACT-R2-03 — Finite-segment collinear classification lacks a stable
  algorithm and duplicate precedence.**  Section 1.2 names a positive open
  overlap but does not specify the exact projected-parameter comparison, the
  non-zero component selection, or the outcome for a reversed/equal duplicate.
  The Geometry Contract separately requires orientation-independent duplicate
  detection.  State that duplicate detection precedes overlap classification,
  then give the integer/rational interval algorithm for disjoint, one shared
  endpoint and positive overlap.

- **D022-EXACT-R2-04 — `Nt/D` is not a total partition sort key.**  The
  parameter in section 1.2 belongs to the first segment of one intersection
  pair.  A multi-contact ChangeSet must sort contacts independently along every
  affected proposed and existing segment; pair-local `Nt/D` can denote the
  wrong segment and is not comparable across pairs.  Define a normalized
  `segmentParameter(segment, contact)` for every affected segment and require
  grouping before that per-segment sort.

- **D022-EXACT-R2-05 — The fixed-point camera has no deterministic pan
  ingress and admits an unmodelled CSS transform.**  Section 2 defines how raw
  pointer coordinates and scale are quantised, but not how `panXU`/`panYU` are
  produced.  It rejects only a *non-axis* CSS transform, leaving an
  axis-aligned CSS scale/reflection that changes pointer-to-canvas mapping but
  is absent from the projection formula.  Specify pan's binary64-rational
  conversion and either prohibit every CSS transform or include its full
  rational affine mapping in `CameraSnapshotV1`.

- **D022-EXACT-R2-06 — Presentation arithmetic has no bounded snapshot
  domain.**  `scaleNumerator`, pan and the inverse transform that produces
  `v` are unbounded, while the 256-bit limit is stated for generic exact
  intermediates without saying that it covers snapshot construction and
  inversion.  A tiny positive scale or extreme pan can make resolver operands
  exceed the budget before a candidate exists.  Add versioned min/max scale,
  pan and screen-coordinate bounds, their exact pre-allocation checks, and the
  deterministic `CANDIDATE_UNDETERMINED` outcome.

- **D022-EXACT-R2-07 — The advertised tie key is not actually total.**  The
  third key is “ordered canonical endpoint-coordinate pairs”, but it does not
  define the order of each endpoint pair, the order of multiple contributing
  segments, or the empty key for `ExistingVertex`.  These omissions matter
  precisely when screen distance and coordinate tie.  Define one serializable
  tuple per source kind, including lexicographic pair normalization and a
  deterministic empty payload for C1.

- **D022-EXACT-R2-08 — Usable-polygon validity still delegates an exact
  predicate.**  Section 8 rejects self-intersection, repeated edge and
  collapse, but gives no exact `Q2` segment-intersection/orientation procedure
  for non-adjacent usable edges, nor a rule for a touch, overlap or adjacent
  repeated miter vertex.  A float polygon library can therefore re-enter at
  the exact point the draft says it cannot.  Define the `Q2` orientation,
  segment-contact and simple-polygon acceptance/rejection rules, subject to
  the same arithmetic limits.

- **D022-EXACT-R2-09 — Room identity relies on an unspecified exact polygon
  boolean.**  Section 6 selects survivors by strictly positive exact usable-area
  overlap, but neither the `Q2` section nor the resource limits define polygon
  intersection, clipping, handling of concave faces, or the representation and
  comparison of the resulting overlap area.  This is not supplied by shoelace
  area of one polygon.  Either specify a bounded exact `Q2` overlap algorithm
  and corpus, or narrow Alpha identity to lineage plus explicit
  `RoomSurvivorMap` rather than claiming an exact maximum.

- **D022-EXACT-R2-10 — The metric narrowing contradicts the current product
  requirement without a declared reconciliation.**  Section 8 returns
  `MEASUREMENT_UNSUPPORTED` for generic point/boundary distance, while PRD
  FR-13 requires that exact distance.  The draft does not mark this as a
  proposed Alpha scope change, name the conflicting source owner, or provide a
  fallback accepted by FR-13.  Do not treat this new reason as adopted until
  `bmad-prd`/`bmad-spec` either retain an exact bounded representation or
  explicitly narrow the requirement.

- **D022-EXACT-R2-11 — Exact formatting remains an incomplete algorithmic
  boundary.**  “Refine rational bounds for `√2` to one source-owned rounding
  result” lacks the unit conversion, requested decimal precision, rounding
  mode, tie behaviour for rational values, termination/resource cap and stable
  failure result.  The existing source may defer locale and precision, but it
  does not permit 2D, 3D and export to implement different convergence rules.
  Define a bounded formatter input/output contract or keep formatting
  explicitly outside this input rather than calling the metric boundary total.

- **D022-EXACT-R2-12 — The resource limits do not define what is counted or
  make overflow order-independent.**  `maxCandidateContacts` can mean raw
  pair hits, coordinate groups, pending partitions or ray probes; likewise a
  “derived boundary vertex” can be an offset anchor, miter, or post-validation
  polygon vertex.  “Stop enumeration at first overflow” is order-dependent
  unless enumeration has a specified canonical order, and it can conceal a
  contact that another implementation sees first.  Define counted entities,
  canonical enumeration order and the exact point at which
  `GEOMETRY_EXACT_LIMIT` rejects the whole detached candidate.

## Remaining global blockers

- The required versioned corpus in section 10 does not yet exist; S-2 remains
  `needs-further-evidence` and cannot substitute for the exact rational/Q2,
  usable-overlap, selection and resource suites listed above.
- The Geometry Contract still specifies a miter followed by deterministic
  bevel, while this working input intentionally rejects bevel.  A
  source-owning SPEC reconciliation is required before either statement can
  govern an implementation.
- PRD/SPEC/UX ownership must reconcile C1–C4 wording, metric scope, reason
  mappings, formatting and visible blocked-Draft behaviour after this review.
- Independent corpus review, the fresh architecture workflow, G-1, physical
  NFR-15 evidence, the other spike gates, AssetUsageGrant, G-CP-ADR and the
  official implementation-readiness gate remain open.  Nothing in this review
  authorizes root implementation or changes `G-READY`.
