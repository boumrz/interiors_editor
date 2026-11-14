---
title: "Independent exact-geometry review — D-022 R7"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r7-2026-08-05.md
reviewed_revision: R7
reviewed_sha256: 026b4bc9e524ecc2cb8895eb7345d00c667f63b88a9490a957042c2bdceca3ac
review_date: 2026-08-05
scope: "Independent precanonical review: eligibility C1–C4, topology/lineage/rooms, faces/holes, usable geometry, metrics, durable boundary, fixtures, and canonical-source alignment"
verdict: NOT_READY
---

# Independent exact-geometry review — D-022 R7

## Integrity and review boundary

- The SHA-256 of the reviewed frozen R7 artifact is exactly
  `026b4bc9e524ecc2cb8895eb7345d00c667f63b88a9490a957042c2bdceca3ac`.
- Every frozen canonical-source hash in R7 frontmatter matches the current
  workspace: SPEC, all listed companions, PRD, Architecture Spine,
  `domain-model.md`, `solution-design.md`, UX `DESIGN.md`/`EXPERIENCE.md`, and
  project context.
- This review evaluated R7 against those current canonical sources only. It
  makes no acceptance finding about predecessor drafts or other review/advisory
  artifacts.

## Precanonical verdict

**NOT_READY — do not canonize or implement from R7.**

R7 correctly keeps rational/Q2 math, exact selection, metric intermediates,
derived faces and worker-local values outside Project, Command, ChangeSet,
History, Portable Backup and Durable Revision. Its no-reservation discovery
order, opaque-string `IdPort` treatment, complete-candidate durability fence,
and preservation of the source miter-then-bevel rule are materially aligned
with the present baseline.

That is not sufficient for canonical adoption. The four findings below leave
observable geometry outcomes either untestable or not source-owned. `P1` means
"blocks canonical adoption/readiness"; it does not assert that a document
already labelled `NOT_READY` has claimed implementation authorization.

## Findings

### P1 — C1–C4 remains non-reproducible as a corpus seam

**Evidence.** R7 §2.3 makes C1/C2 eligibility depend on a projected CSS point
inside a closed `HitSquare`, and C3 on inverse-pointer coordinates. But §2.2
explicitly excludes the active screen-to-plan transform from
`SelectionRequestV1`; it is only an invocation-local callback. R7 §9 requires
fixtures to name canonical input and an expected outcome, while its selection
fixtures do not supply a transform/fake projection contract. SO-R7-01 names
tolerance, ties, hysteresis, T/X continuity and C3/C4 interaction, but not the
reproducible transform seam needed to evaluate those rules.

This is also required by the adopted boundaries: AD-12 requires geometry to be
testable without UI, and UX `EXPERIENCE.md` §5.1.1 requires canvas and the DOM
surface to expose the same selected candidate. A private browser callback is
not enough evidence that the two surfaces choose the same C1/C2/C3/C4 result.

**Impact.** No source-owned corpus can deterministically prove the closed
boundary predicate, inverse-coordinate C3 branch, or a `DraftCommand` result
across viewport/transform changes. A library or UI implementation can still
decide a material part of eligibility incidentally.

**Required before adoption.** Extend the source-owned D-022 policy with a
non-durable, fakeable transform/projection seam: coordinate convention,
forward and inverse behaviour, non-invertible result, precision boundary, and
fixture input. Add vectors for each closed-square edge/corner, equal candidates
within a class, C3-versus-C4, `k` and hysteresis boundaries, and T/X continuity.
The seam must be adopted by the Geometry Contract and UX, not serialized into
the Project or treated as a library default.

### P1 — Face components, holes, and bounded repeated walks have no source-owned outcome

**Evidence.** R7 §3.3 adds that every bounded face proposed as a Room is
`simple` and that a repeat in a bounded face is invalid, but the current
Geometry Contract §3 only requires that a derived bounded Face is
non-self-intersecting. Its minimal `Face { centerlineBoundary[] }` model and
§7 do not define multiple boundary components, holes, repeated-dart walks, or
the usable-polygon/Room result for them. Conversely, `domain-model.md` §12
explicitly requires golden plans covering holes.

R7 then says holes and multiple bounded faces use "ordinary" source rules.
There is no such current rule to apply, no dedicated reconciliation-register
row, and the §9 fixture row does not give an expected Room/usable-geometry
outcome. It therefore cannot establish whether a hole is supported, rejected,
or represented as a room boundary component.

**Impact.** A valid planar embedding with an exterior articulation, an interior
bridge/repeated bounded walk, or a hole can receive incompatible Room,
fingerprint, usable-polygon, surface-address and validation results. This is a
topology and durable-identity risk, not merely a rendering choice.

**Required before adoption.** A Geometry Contract/domain-model owner must
define the accepted face-component model (including explicit out-of-scope
rejection, if that is the product decision), traversal/repetition semantics,
Room and usable-polygon derivation, fingerprint behaviour, and stable rejection
reason where applicable. Add a reconciliation row and corpus vectors for
exterior articulation, bounded repeated walk, disconnected/nested cycles,
hole-with-offset and collapse, multiple Rooms, and no-partial-mutation rejects.

### P1 — Metric state fencing does not define the required measurement operation

**Evidence.** PRD FR-13 requires wall centerline length, Room dimensions/area/
perimeter, and an exact distance between **two selected points or item
boundaries**. R7 §2.4 defines only one `MeasurementTargetSnapshotV1` target at
a time. It has no paired-target/operation request, no point-on-edge locator,
and no semantics for a boundary-to-boundary or point-to-boundary result.

Further, R7 calls `edgeOrdinal` an element of a "source-owned canonical derived
boundary order," but the current Geometry Contract only normalizes boundary
direction and makes a fingerprint independent of traversal start; it does not
publish such an order. SO-R7-04 covers usable rounding and formatter
precision/locale, but not target identity/order or the missing measurement
operation. The §9 metric fixtures likewise do not cover a paired distance.

**Impact.** The revision/checksum stale fence prevents displaying a metric for
the wrong revision, but it cannot deterministically calculate or reselect a
valid FR-13 two-target measurement. Different adapters could choose different
edges/nearest points while claiming the same formatter policy.

**Required before adoption.** Add a source-owned, ephemeral
`MeasurementRequest`/operation contract: paired targets, point/boundary
locators, admissible operations, tie/nearest-point semantics, exact result
units, and a stable derived-boundary locator/order (or a replacement that does
not rely on ordinal order). Keep all of it non-durable. Add corpus cases for
wall, Room inner dimensions/area/perimeter, vertex-to-boundary,
footprint-to-boundary and boundary-to-boundary distances, including stale
revision/checksum discard and one formatter output across Preview/2D/3D/export.

### P2 — The outcome crosswalk mis-cites geometry errors and omits stale-base handling

**Evidence.** R7 §1 attributes `INVALID_DIMENSION`, `ZERO_LENGTH`,
`UNSUPPORTED_DIRECTION` and `PROJECT_BOUNDS_EXCEEDED` to Geometry Contract §8.
That section concerns wall/opening/3D behaviour; the error mapping is in §11,
with constraints also in §§1, 3, 4 and 6. More importantly, R7 §3.1 says to
reject a stale base, while `domain-model.md` §5 requires rejection of every
stale `baseRevisionId` and forbids auto-rebase. The crosswalk only has a
stale-writer-fence row and does not give a source outcome, witness, or UI state
for a stale base held by an otherwise valid writer.

**Impact.** Implementers can conflate a changed base revision with a lost writer
lease, choose an unlisted reason code, or show inconsistent retry behaviour.
This weakens R7's claim that unlisted failures must enter a source union and
corpus before implementation.

**Required before adoption.** Correct the source citations. Have the
domain/application and repository owners publish the stable stale-base outcome
(or an explicit source mapping to an existing outcome), its diagnostics and
UI retry/reselect behaviour, then add race fixtures for a base change before
validation, during detached work, and at the conditional stage/pointer swap.
Do not introduce a private D-022 reason code.

## Required fixture tightening

Even after the source-owner decisions above, R7 §9 needs exact boundary cases
to substantiate its own wording:

- selection: equal C1/C2 ties, class precedence, transform inversion failure,
  C3/C4 boundary, `k` boundaries, hysteresis, and T/X continuity;
- planar faces: an explicit expected result for every holes/multiple-faces
  vector rather than "ordinary rules";
- usable geometry: miter exactly at the cap, just above it, odd thickness
  half-offsets, bevel determinism and collapse;
- metrics: two-target operations and derived-boundary locator stability.

Each must identify the adopted source version, canonical input, expected
transient selection/diagnostic state, and exact durable post-state or explicit
no-mutation outcome, as R7 §9 requires.

## Confirmed source alignment

The following R7 directions are sound as a noncanonical replacement direction:

- C1 → C2 → C3 → C4 class priority, off-grid numeric bypass, and no
  nearest-angle correction preserve Geometry Contract §4 and UX §5.1.1, while
  correctly leaving tolerance/ties/hysteresis unadopted.
- Detached all-contact discovery before `IdPort` allocation, opaque string IDs,
  and no durable pre-reservation do not create a second Project/History schema.
  Room identity and Opening-after-wall policies remain explicitly gated.
- The usable-geometry rule exactly preserves Geometry Contract §7.1: inward
  half-thickness offset, miter, four-half-unit cap, then deterministic bevel.
  It correctly keeps half-mm/rational intermediates and join rounding outside
  durable state.
- The exact/durable boundary matches Geometry Contract §1, AD-7, AD-3 and the
  backup contract: no persisted BigInt/Q2, no private patch/registry/policy
  digest, no partial candidate publication, and no History mutation before
  successful atomic durability.

## Exit condition for a follow-on draft

A successor can seek a new independent review only after the canonical owners
adopt and version the missing selection, face/hole, metric, and stale-base
contracts with the required corpus. It must then update its immutable source
references and demonstrate that no exact intermediate, UI policy or worker
payload has crossed the durable boundary.
