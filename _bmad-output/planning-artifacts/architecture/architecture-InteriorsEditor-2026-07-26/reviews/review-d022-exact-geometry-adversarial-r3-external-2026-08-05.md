---
title: "InteriorsEditor — external adversarial exact-geometry review of D-022 R3"
review_type: adversarial-exact-geometry-precanonical-r3-external
reviewed: 2026-08-05
reviewer: "Codex /root/d022_exact_geometry_research"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r3-2026-08-05.md
reviewed_snapshot:
  draft_sha256: ef16eb1a15b0face1e92077dff9ca904fa094378a64c10b8752fa48960151773
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
scope: "External read-only adversarial review of only the declared R3 SHA. It attacks rational/Q2 arithmetic, phase limits, camera/C1–C4/RayProbe, metric/formatter and algorithmic totality; it does not rely on an internal PASS and changes no draft, canonical source, memlog, code, test, configuration or evidence."
source_mutations: "Created this independent review artifact only."
---

# Verdict

**`REJECT_FOR_PRECANONICAL_INPUT`; `G-READY` remains `NOT_READY`.**

R3 is a substantial improvement over the rejected R2 input: it separates
non-integral RayProbe blockers from C2, supplies a finite-segment collinear
classifier, makes a fixed-point camera direction more concrete, restores an
exact metric route, and names Q2 simple-polygon and centerline-overlay work.
Those are useful directions, not yet one total policy that two independent
implementations can execute identically.

The blockers below occur in the proposed kernel itself, rather than merely in
the still-required executable corpus or source-owner adoption route.  In
particular, R3 has an internal rational representation conflict, leaves the
RayProbe coordinate system undefined, and cannot construct its own old/new
face overlay when a boundary is unchanged.  It must therefore not advance to
the source-owning architecture update in its present form.  This verdict is
only about this noncanonical R3 SHA: it does not modify an `AD-*`, invalidate
the existing project sources, or authorize implementation.

## Checks that passed this review

- The reviewed file hashes to the exact SHA declared above.
- R3 preserves the integer-mm canonical boundary and keeps `BigInt`, exact
  rationals, Q2, metric witnesses, pointer state and camera state outside
  Project/Revision/History/Portable Backup.
- The finite canonical segment rule now explicitly gives duplicate precedence,
  exact integer admission and per-segment contact parameters; it materially
  addresses several R2 problems.
- Rejecting a 45-degree bevel rather than pretending its chord is always in
  `Q(√2)` is mathematically honest.  The document also correctly labels that
  as a proposed source reconciliation, not an adopted Geometry Contract rule.
- The document continues to say that a corpus, source-owner reconciliation,
  physical evidence and formal readiness are independent gates.  Nothing in
  this review treats a well-written draft as that evidence.

## Findings

- **D022-R3-EXT-01 — C4 contradicts the sole rational representation it
  declares.**  Section 1.1 requires every `ExactRationalMm` to be reduced,
  while §4.5 requires `vx` and `vz` to retain one *unreduced* common
  denominator `q = scaleNumerator` and then uses their numerators for C4.
  Reducing either component destroys that common-denominator invariant; keeping
  it violates the stated normal form.  No distinct presentation-only pair type
  is defined.  Define a separate bounded `CameraDeltaV1` with two integer
  numerators and one explicit positive denominator, then state exactly when it
  may be converted to an `ExactRationalMm`.  C4 must operate on that type, not
  on an ambiguous exception to the exact-arithmetic rule.

- **D022-R3-EXT-02 — RayProbe has no total coordinate origin or pointer
  witness.**  The ray formula in §4.4 uses `P + lambda*d`, the collinear branch
  uses `worldPointerDelta`, and ranking uses “exact screen-distance-squared”,
  but none of `P`, `worldPointerDelta`, the point being compared with a
  candidate, or the screen-distance formula is defined in
  `PresentationSelectionV1`.  `relativeXU` appears later in C4 only.  Choosing
  the active gesture origin, an inverse-projected pointer, or another point as
  `P` changes both the selected wall and whether a collinear blocker suppresses
  C4.  Define one immutable selection snapshot containing active origin,
  relative pointer coordinate, inverse-projected pointer delta and the exact
  squared screen-distance expression used by C1 and every RayProbe branch.

- **D022-R3-EXT-03 — Camera ingress is still not a total finite-value
  boundary.**  R3 calls raw `clientX`, DOMRect, pan and scale values
  IEEE-754-binary64 rationals, although `NaN` and infinities are not rationals.
  It also does not state the outcome for raw negative zero, a finite positive
  scale that rounds to zero `scaleNumerator`, or an invalid field before the
  arithmetic/bits check.  These cases cannot be delegated to JavaScript or a
  browser event default while claiming a deterministic snapshot.  State the
  finite-only/raw-`-0` rule, positivity check after quantization, evaluation
  order and the single `SNAPSHOT_OUT_OF_RANGE` result before any `BigInt`
  conversion.

- **D022-R3-EXT-04 — ExactLimitsV1 does not bound the arithmetic that its
  limit outcomes promise to bound.**  §3 caps counts, Q2 operands and metric
  intermediates, but supplies no numerator/denominator/intermediate-bit limit
  for `ExactRationalMm` contacts, rational overlay vertices, DCEL witnesses or
  rational area sums.  The Q2 row also caps an operand but not the products,
  inverses, determinants and shoelace intermediates that can be wider before a
  post-operation check.  Count limits do not bound denominator growth or the
  cost of a common rational calculation.  Define phase-specific operand and
  temporary bit limits, check points before allocation/operation, and a stable
  precedence between an exact-limit failure and another discovered invalid
  contact.  Otherwise two traversals can return different reason codes or one
  can exceed the advertised resource ceiling first.

- **D022-R3-EXT-05 — The centerline overlay cannot process an unchanged
  boundary.**  §7.1 says to reuse §4 contact classification while retaining
  rational contacts instead of applying integer admission.  That only waives
  the integer gate.  The §4 classifier returns `DUPLICATE_SEGMENT` for equal
  old/new edges and rejects positive collinear overlap, yet an unchanged Room
  necessarily has coincident old and candidate boundary edges.  There is no
  overlay-specific treatment for coincident or partially coincident labelled
  edges, so a normal no-op/nearby edit can fail before it has cells to score.
  Define an arrangement classifier that preserves old/new edge multiplicity,
  splits partial overlaps at exact interval endpoints and states how coincident
  directed half-edges contribute to winding; it must not inherit topology
  rejection semantics.

- **D022-R3-EXT-06 — `CenterlineOverlayV1` does not define a total cell/area
  construction.**  “Derive bounded arrangement cells” and “sum signed
  shoelace areas” omit the DCEL face-cycle rule, orientation normalization,
  exterior handling, zero-area cycle handling and the result for a cell with
  more than one boundary cycle.  Rejecting a hole in the *input* Room does not
  remove holes or coincident boundaries created by the old/new arrangement.
  Without an explicit CCW bounded-cell representation and an absolute/signed
  area convention, the same overlay can produce a negative, duplicated or
  absent `OverlayAreaQ`, changing survivor maxima.  Give a closed
  arrangement-face extraction and rational-area algorithm, including all
  degeneracy and limit outcomes.

- **D022-R3-EXT-07 — `StrictInteriorQ2` leaves the decisive winding branches
  to the implementation.**  §5.3 says to use the half-open z rule and
  `orientationQ2` “to add/subtract one”, but never defines which upward or
  downward crossing and which orientation sign increments or decrements the
  winding number.  A ceiling-host `Keep` is accepted or rejected by this
  predicate, so this is not merely a display detail.  State the four exact
  branch conditions, treatment of a vertex hit after the earlier boundary
  test, and the required simple/non-zero footprint precondition.  No generic
  point-in-polygon routine may supply the missing branches.

- **D022-R3-EXT-08 — The claimed deterministic metric witness still has an
  unspecified tie function.**  §6.2 orders witnesses using
  `featureRank(contact,leftStart,leftEnd,rightStart,rightEnd)`, but does not
  define its values, how an overlap versus endpoint/interior case is encoded,
  or how the pair list is normalized when operands and endpoints are reversed.
  Thus equal-radicand distances can expose different witness locations/feature
  labels despite the statement that reversal cannot change the result.  Define
  a complete feature enum/rank, canonical left/right operand order and
  endpoint normalization before the witness key; include all zero-distance and
  symmetric cases in the corpus.

- **D022-R3-EXT-09 — The formatter has no initial total enclosure for a
  general `sqrt(Q2)` value.**  §6.3 provides brackets for `sqrt(2)` and says
  to maintain rational `lo² ≤ q < hi²` for `sqrt(q)`, but it never specifies
  how to construct the first finite `lo`/`hi` from an arbitrary non-negative
  Q2 radicand, which magnitude is admitted, or how that construction consumes
  the 288-bit index/640-bit intermediate limits.  Different initial brackets
  can reach different refinement/cap paths.  Define a bounded exact initial
  bracket algorithm, its equality handling, all intermediate limits and the
  precise structured output/approximate comparison for every quantity kind.

- **D022-R3-EXT-10 — “D8 rotation” is not an unambiguous metric transform
  contract.**  §6.1 calls for a “D8 rotation/host-basis transform” and then
  describes yaw steps in multiples of 45 degrees.  `D8` conventionally includes
  reflections, while eight 45-degree yaw rotations are a cyclic rotation set;
  neither the exact allowed `yawStep` enum/modulo representation nor its
  relation to the existing source `yawStep` is stated.  The source currently
  permits rotate actions without this D8 restriction.  Define the exact
  orientation group, no-reflection rule if intended, coordinate transform,
  rounding-free footprint mapping and migration/rejection behavior for an
  existing catalog item.  This proposed Alpha restriction also needs its named
  PRD/SPEC owner reconciliation before it can limit FR-13 targets.

- **D022-R3-EXT-11 — The hash-bound confirmation protocol lacks a canonical
  byte grammar.**  `RoomScoreGraphDigestV1` and `impactDigest` depend on
  “canonical bytes”, but R3 does not define encoding, UTF-8/string
  normalization, UUID byte form, field/array ordering, optional/empty-field
  form, integer representation or the serialization of rational
  numerator/denominator values used inside a graph digest.  A JSON serializer
  default can therefore produce a different digest for one valid map/seed,
  making a preflight falsely stale or allowing non-equivalent payloads to look
  similar in UI.  Specify a versioned canonical encoding and byte fixtures for
  every nested map, tuple, digest and allocation purpose key before claiming
  byte-comparable replay.

- **D022-R3-EXT-12 — Usable-boundary orientation is only a precondition, not
  a deterministic derivation.**  §5.1 begins “for a cyclic CCW centerline
  face, interior is left”, but does not define how a derived face from the
  topology/DCEL is classified as bounded, normalized to CCW, rotated to a
  canonical start or rejected when its signed centerline area is zero.  The
  chosen orientation changes the inward normal and therefore every Q2 miter.
  Specify this integer-centerline normalization before
  `FaceBoundaryNormalizationV1`, including its relation to the overlay face
  order and the exact `USABLE_POLYGON_COLLAPSED` outcome for a degenerate ring.

## Remaining global blockers

- R3 itself records material source deltas: miter-only versus the current
  miter-then-bevel Geometry Contract, the empty-C3/RayProbe presentation model,
  D8 metric/catalog admission, centerline Room scoring, new limit/reason
  codes, and map/impact schemas.  These require the named Architecture, SPEC,
  PRD and UX owner workflow after the policy defects above are repaired.
- The required executable corpus does not exist yet.  In particular it must
  test the corrected common-denominator C4 record, every RayProbe coordinate
  branch, coincident old/new overlay boundaries, arrangement-cell signs,
  winding branches, formatter initial bounds and canonical hash bytes—not only
  the happy-path entries already listed in §10.
- S-2, screenshots, emulation and a self-reported PASS cannot establish the
  exact kernel, NFR-5/NFR-15 behaviour, G-1 or readiness.  The fresh
  independent reviews and source-owner reconciliation remain required after a
  corrected R3 successor exists.
- No conclusion here authorizes a source/canonical/memlog change, root code,
  tests, CI, commit or production claim.
