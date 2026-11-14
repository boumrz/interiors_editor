---
title: "InteriorsEditor — adversarial review: D-022 geometry-policy decision draft"
review_type: adversarial-geometry-policy
reviewed: 2026-08-05
reviewer: "Codex /root/architecture_adversarial_review"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-2026-08-05.md
artifact_status: noncanonical-draft-working-policy
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../.memlog.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../../implementation-readiness-report-2026-08-05.md
  - ../../../evidence/spikes/S-2/work-package.md
  - ../../../evidence/spikes/S-2/policy-boundaries.md
  - ../../../evidence/spikes/S-2/independent-review-integrity-2026-08-04.md
  - ../../../../project-context.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
readiness: NOT_READY
scope: "Independent read-only adversarial review of the noncanonical D-022 working-policy draft; no draft, source, Spine, memlog, code, test, configuration, or evidence mutation"
source_mutations: none
---

# Adversarial review — D-022 geometry-policy draft

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT`; `G-READY` remains `NOT_READY`.**

The draft correctly keeps S-2 non-terminal, makes the geometry library
non-authoritative, retains a zero-tolerance domain, and explicitly bars a
readiness shortcut.  It is nevertheless not yet a safe input for a canonical
architecture update: the proposed exact kernel has incomplete number domains,
the presentation tie policy can still choose different exact endpoints through
unbound IEEE/camera arithmetic, and valid Plan shapes/host outcomes remain
underspecified.

This rejects only this noncanonical policy revision.  It neither rejects the
delegated product direction nor authorises a source or implementation change.

## Controls and source reality

- All source paths declared by the draft resolve.  The unchanged canonical
  Spine's mechanical lint is `ok: true` with zero findings; that is not
  evidence that this working input is correct or adopted.
- S-2 remains `needs-further-evidence`.  Its own work package and policy
  boundary explicitly exclude general usable-polygon, Room reconciliation,
  Opening relocation, touch and device policy; its disposable TypeScript code
  cannot prove this new kernel.
- The draft's own frontmatter and §10 truthfully retain `canonical: false`,
  `implementation_ready: false` and `NOT_READY`.  No unsupported production,
  physical-device, S-2-terminal or `READY` claim was found.

## P1 blockers

### D022-ADV-01 — `BigInt` is not yet an exact intersection contract

**Evidence.** §1 says canonical intersection/sorting uses `BigInt` (draft
lines 76–92), while the exact-contact outcome requires non-integer contacts to
reject.  `BigInt` is an integer ring, not a field: it does not specify the
rational numerator/denominator representation required before deciding whether
an intersection is integer-mm.  In TypeScript/JavaScript, direct `BigInt`
division truncates.

For example, the allowed diagonal segments `(0,0)→(999,999)` and
`(0,999)→(999,0)` meet at `(999/2,999/2)`.  A `BigInt` quotient can produce
`499` instead of proving the half coordinate and rejecting it.  This is the
same family of non-integer X boundary that S-2 records as policy-sensitive;
AD-7/Geometry Contract require no rounding before the whole candidate reject.

**Required correction.** Define an ephemeral `ExactRationalMm` contact type:
normalised signed numerator/positive denominator, cross-multiplication
comparison and ordering, and an explicit conversion rule that admits a
`SafeIntegerMm` only when each coordinate is exactly integral, safe and within
ProjectLimits.  No division/rounding/`Number` conversion may precede that
test.  Add half-coordinate, negative-coordinate, large cross-product and
ordered multi-contact fixtures.

### D022-ADV-02 — `Q(√2)` is not a total exact geometry/measurement boundary

**Evidence.** §1 defines `Q(√2)` only as `(a + b√2) / d` “reduced
deterministically” (lines 83–88), then §8 relies on it for exact miter limits,
exact area/perimeter and a shared measurement seam (lines 294–318).  The draft
does not define normal form, equality, sign/order, zero-denominator handling,
coefficient bounds or the exact type passed to a perimeter formatter.

This is not merely internal style.  Miter-limit comparison should use a named
**squared** distance in `Q(√2)`; constructing an ordinary Euclidean distance is
not generally closed in that field.  Further, a symmetric bevel at a 45° turn
can contain a chord proportional to `√(2 − √2)`, which is not an element of
`Q(√2)`.  Coordinates can remain in `Q(√2)`, but an exact Room perimeter then
needs a declared symbolic/algebraic length representation (or a proof that the
branch is unreachable).  “Exact measurements remain exact” is otherwise not
an implementable rule for FR-13.

**Required correction.** Specify the total ephemeral arithmetic contract:

1. canonical normal form and exact sign/order/equality for `Q(√2)`, including
   zero/determinant cases and bounded coefficient growth;
2. miter acceptance as a squared-distance inequality, never an IEEE square
   root; and
3. an `ExactLength`/`ExactPerimeter` input model for
   `MeasurementFormatPolicy` (for example a normalised symbolic sum with an
   exact comparison/rounding oracle), or a narrower geometry rule that proves
   all emitted length terms stay in the declared type.

The corpus must then encode these values and expected order/format results;
numeric screenshot equivalence is not sufficient.

### D022-ADV-03 — Presentation tie/`k` policy still delegates discrete semantics to floats

**Evidence.** The draft correctly separates a 44-CSS-px presentation hit from
zero domain tolerance (lines 103–132).  But its winner is based on minimum
*squared screen distance* (lines 145–154), angular deviation of
`pointer − activeOrigin` and exact half-step/bisector ties (lines 158–172),
while the only stated input representation is CSS-pixel coordinates plus a
camera transform (lines 107–111).  Neither `PointerEvent` coordinates nor the
camera transform are quantised or specified as an exact presentation value.

Consequently two browsers/renderers can differ by one IEEE rounding unit around
a distance, angular-bisector or `k + 1/2` boundary; one takes the advertised
tie order while another observes a non-tie and persists a different, otherwise
valid integer endpoint after confirmation.  The fallback cannot be dismissed as
“presentation only”, because the selected endpoint is precisely what reaches
the canonical ChangeSet.  It reintroduces the platform-dependent snapping AD-7
exists to prevent.

**Required correction.** Define a product-owned, current-session-only
presentation numeric boundary before candidate comparison: e.g. a specified
fixed-point CSS coordinate plus a versioned/quantised camera projection, with
integer/rational comparisons for hit eligibility, distance order, ray choice
and half-step `k`.  Also give `contact kind` a total enum order.  If the product
instead accepts device-dependent pointer selection, explicitly narrow that
claim in AD-7/UX rather than presenting the current tie order as deterministic.

### D022-ADV-04 — Usable join remains partial for valid collinear Plan runs

**Evidence.** §8 calls for a miter intersection for every adjacent offset-line
pair (lines 294–305).  A valid exact T necessarily partitions the crossed
segment, and manual merge is deliberately never automatic.  A derived Room
boundary can therefore contain two consecutive collinear segments; equal
thickness yields coincident offsets and a permitted thickness change yields
parallel offsets.  Both have zero determinant, so neither the proposed miter
nor its “miter exceeded” bevel branch exists.

Different implementations can skip the point, reject an otherwise valid
candidate, invent a bridge or use a float fallback.  That changes usable area,
perimeter, overlap matching and Room identity from the same canonical Plan.

**Required correction.** Add an oriented derived-boundary normalisation before
miter evaluation: deterministic collapse of same-offset straight runs without
merging canonical WallSegments/host lineage; an explicit policy for a
collinear thickness step; and a distinct reject/normalise rule for backtracking
or 180° degeneracy.  Test cardinal/diagonal T-split runs, thickness steps,
Room overlap and no projection feedback.  Miter/bevel must never receive a
zero determinant.

### D022-ADV-05 — Manual merge permits an undefined attachment equality

**Evidence.** §5 allows side finishes, material hosts and wall-local
attachments that are “semantic-equivalent” or have an exact lineage map
(lines 210–232).  `semantic-equivalent` has no stable predicate for the
canonical payload, no side-address/reverse rule and no complete output map.
This conflicts with the source requirement that a wall side is addressed by
`(WallSegmentId, AdjacentRoomId|ExteriorSide)` and transfers only through
unambiguous lineage.

One implementation can merge equal-looking but different surface assignments;
another can reject; a third can invert a side while preserving an offset.  None
may silently choose.

**Required correction.** Replace the informal predicate with either strict
normalised canonical equality or a complete serialisable `MergeAttachmentMap`
for every old segment/side/local interval to the new host, including direction,
side and integer offset.  Any absent, reversed, ambiguous or unequal payload
rejects the whole Command.  Add positive and negative fixtures for two
visually similar but semantically distinct finishes, `WallPlacement`, Opening
and surface assignment maps.

## Important high-severity corrections

### D022-ADV-06 — Room survivor/height resolution is not yet a total ChangeSet

The mutual-unique rule is conservative, but §6 does not bound an explicit
survivor mapping to eligible positive-overlap-plus-lineage pairs, nor state
which `heightMm` becomes the merged Room before Opening/Adjacency validation.
“Confirmation of data loss” is not itself a result model.  Since `heightMm` is
the sole editable height and controls wall/opening limits, validation cannot
depend on a later UI choice.

Define a serialisable `RoomSurvivorMap` limited to tied eligible pairs and a
resolved output property set.  For merge it must name the retained Room,
winner's (or explicitly chosen) height and all dropped values *before* the full
validation that creates a complete ChangeSet.  Test invalid maps, equal
split/merge, cancellation, replay, height-sensitive Opening and user refusal.

### D022-ADV-07 — Opening “Resize/Move” ambiguously freezes the operation that FR-19 must permit

§7 says “Resize/Move that preserves the Segment identity retains this offset”
(lines 269–276).  If it means `MoveOpening`, it contradicts FR-19; if it means
a resize/move of the **host Wall**, it is correct but unnamed.  Split/merge
rules need the same distinction for `WallPlacement` and Wall-side addresses.

State explicitly: host-wall geometry edits preserve the existing absolute
opening offset when the host identity/orientation is unchanged; `MoveOpening`
is a separate Command that supplies a new validated offset.  Make the exact
axis rebase map and all failure/reason outcomes part of the candidate, not a
post-validation UI repair.

## Medium corpus and source-scope issues

- The corpus asks for unrestricted “rotate invariance” (line 327).  A 45°
  rotation does **not** preserve the integer-mm lattice: `(1,0)` maps to
  `(√2/2, √2/2)`.  Require translation, reflection, endpoint reversal and
  **90°** rotation invariance, or explicitly restrict any 45° test to a stated
  compatible sublattice.  Otherwise the corpus either fails falsely or admits
  noncanonical coordinates.
- A `44×44 CSS px` canvas hit square is a plausible D-022 choice aligned with
  the touch floor, but NFR-17 mandates that size for interactive **DOM**
  targets, not automatically for canvas geometry.  Keep the sound zero-domain
  separation, change the attribution, and add CSS page zoom,
  `visualViewport`, dense-overlap and raw pointer-coordinate fixtures plus the
  required G-1/physical-phone usability evidence.
- The required corpus must add `Q(√2)` normalisation/equality/sign tests,
  rational half-contact cases, zero-determinant joins, coefficient/resource
  bounds and exact formatting inputs.  S-2's existing integer-only evidence
  cannot substitute for them.

## What passed this lens

- The draft does not silently promote S-2 or a geometry library.
- It keeps `BigInt`, `Q(√2)`, Draft candidate state and projection values out
  of canonical serialisation.
- Its zero-tolerance domain path, exact T/X grouping, no-auto-merge stance,
  conservative diagonal rebase rejection and shared formatting seam are the
  right safety direction once the blockers are made total.
- It makes no readiness, mobile performance or physical-device claim; all such
  evidence remains independently required.

No artifact was changed by this review.
