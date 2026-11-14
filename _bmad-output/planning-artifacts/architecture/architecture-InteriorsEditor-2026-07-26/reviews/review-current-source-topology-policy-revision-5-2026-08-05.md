---
title: "InteriorsEditor — final current-source/reality re-review: D-011…D-013, revision 5"
review_type: current-source-reality
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../topology-policy-reconciliation-draft-2026-08-05.md
artifact_revision: 5
previous_reviews:
  - review-current-source-topology-policy-2026-08-05.md
  - review-current-source-topology-policy-revision-4-2026-08-05.md
  - review-topology-policy-adversarial-r4-2026-08-05.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
readiness: NOT_READY
scope: "read-only final pre-canonical current-source review; no canonical source, Spine, memlog, prototype, or implementation mutation"
source_mutations: none
---

# Final current-source/reality re-review — revision 5

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT`; `NOT_READY` remains unchanged.**

Revision 5 correctly closes the earlier raw-JSON rounding, global-lattice,
over-broad SnapPolicy-lifecycle, persistence-failure, and basic multi-X gaps.
It is substantially closer to a clean owner-workflow input, and it makes no
false S-2, device, production, or readiness claim.

Two remaining current-source conflicts prevent its use to redistill AD-7:

1. it permits an "equivalent non-JSON canonical serialization grammar", while
   the current Spine fixes JSON metadata and the Portable Backup contract makes
   `project/project.json` mandatory; and
2. its contact partitioning omits the singular case where the **interior of a
   proposed segment** passes exactly through an already existing Vertex. That
   can leave a non-shared vertex on an accepted WallSegment or let units choose
   inconsistent split-versus-reject behaviour.

The result is only a disposition of this non-canonical draft. It does not alter
AD-7, PRD, SPEC, the Geometry Contract, `G-READY`, S-2, device gates, or
implementation authorization.

## Method and evidence

Read-only comparison included revision 5; R1/R4 current-source reviews; the
R4 adversarial review; current SPEC and relevant companions; PRD; UX;
Architecture Spine and its domain/solution companions; project context;
delegated change proposal including §4.2.1; and S-2 evidence boundaries.

Mechanical checks were read-only:

- The proposed `SafeIntegerMm` grammar accepts canonical integer tokens
  (including raw `-0` for subsequent normalization) and rejects decimal,
  exponent, leading-zero, signed-plus and whitespace forms.
- Origin `(125, 0)` plus an NE relative candidate with `k = 3` gives
  `(425, 300)`, preserving the equal `300 mm` deltas required for 45°.
- The exact predicate passed for every positive `L = 1…100000`.
- The Architecture Spine linter returned `ok: true`, `0` findings.

## Closure of earlier findings

| Earlier concern | Revision-5 result | Assessment |
| --- | --- | --- |
| R1 `CS-TP-01`; R4-CS-01 raw fractional JSON | The raw JSON lexer is now retained and validated before `JSON.parse`/reviver coercion, while `Number.isSafeInteger` is only a final guard. Raw-byte fixtures are required. | **Closed in the proposed text.** This is the correct shape for a JSON import boundary. |
| R1 `CS-TP-02` scalar/sign | `k × d`, positive scalar, eight directions, explicit quadrant and no pointer-history direction inference remain explicit. | **Closed.** |
| R1 `CS-TP-03` X routing | Mandatory T, delegated valid exact X and remaining PRD/SPEC/Architecture reconciliation are explicit. | **Closed as pre-canonical source routing.** |
| R1 `CS-TP-04`; R4-CS-02 policy lifecycle | The draft now uses the existing `SnapPolicy` term as construction-only state, with no policy version, registry, History, Backup, migration or ReleaseManifest extension. Resolved endpoints are never re-normalized. | **Closed.** This follows the minimal route recommended in the R4 adversarial review and stays within AD-7/AD-11 boundaries. |
| R4-CS-03 reason ownership | `SERIALIZATION_INVALID` is no longer asserted as canonical. `bmad-spec` is explicitly assigned the geometry/backup reason mapping. | **Closed as routing.** No S-2 reason code is silently promoted. |
| R4 AD-3 persistence failure | Rejection, stale worker discard and post-validation persistence failure are separated. The latter retains only pending retry/recovery-export state and fences the next mutation. | **Closed.** It matches AD-3, AD-12 and the UX storage state. |
| R4 multi-X | Revision 5 adds one-Vertex-per-distinct-coordinate and all-affected-segment partitioning for accepted multiple interior crossings. | **Materially improved, but incomplete for the singular proposed-interior/existing-Vertex contact; see R5-CS-02.** |

## What is now correctly bounded

- The relative 100-mm candidate exactly matches delegated clarification §4.2.1:
  it is constructed from the active gesture origin, not a global lattice;
  off-grid numeric endpoints remain precise and visual zoom does not mutate a
  Project.
- `SnapPolicy` is no longer an invented persisted protocol. A current-session
  `DraftCommand` is not portable/replayable, and the existing AD-11 update
  rules, not a new policy migration scheme, govern reload.
- The AD-3 branches are correctly distinct: reject never reaches
  `PendingDurability`; post-validation persistence failure keeps the prior
  Durable Revision/History current and only retains its fenced pending
  candidate/journal for retry or recovery export; stale worker output is
  discarded under AD-12.
- The lossless grammar, bound checks and ephemeral-only `BigInt` preserve the
  integer-mm / plain-serializable-value rule. The draft correctly leaves the
  stable import reason to the SPEC/backup owner instead of inventing it.
- Direction, diagonal formula, X/T source routing and one measurement-format
  seam remain aligned with FR-8, FR-9, FR-13 and the delegated working policy.

## Blocking findings

### R5-CS-01 — High: an unapproved non-JSON canonical serialization alternative conflicts with current sources

**Evidence.** Draft lines 94–103 state that an "equivalent non-JSON canonical
serialization grammar" may be used. The adopted Spine convention says
`JSON metadata + addressed blobs`, and the Project-and-Backup Contract calls
its logical structure mandatory and requires `project/project.json` inside
every `.interiors` bundle. AD-4 further requires a staged self-contained
Portable Backup import.

The proposed lexer is necessary, but it cannot grant a second canonical wire
format through an AD-7 geometry amendment. At best, a future internal adapter
could be a separately owned AD-4/storage decision; it cannot replace or alter
the current Portable Backup representation by implication.

**Required closure.** Remove the alternative from this delta, or narrowly say
that the mandatory Portable Backup remains JSON (`project/project.json`) and
that any later non-JSON *internal* repository encoding needs an explicit
AD-4/Project-and-Backup owner decision and the same lossless boundary. Do not
call it a second canonical serialization grammar here.

### R5-CS-02 — High: one exact contact class remains outside the partition rule

**Evidence.** Draft lines 181–198 cover:

- a proposed endpoint equal to an existing endpoint;
- a proposed endpoint on a WallSegment interior (T);
- a single interior/interior X; and
- multiple exact interior crossings.

They do not state the singular inverse contact: an **interior point of the
proposed WallSegment** coincides with an existing Vertex that is an endpoint of
one or more existing WallSegments. It is not endpoint equality, not an
endpoint/interior T, not an interior/interior X, and it is not necessarily a
*multiple* crossing.

For example, a valid existing L-junction has `Vertex (100, 0)` with walls
`(0,0)→(100,0)` and `(100,0)→(100,100)`. A legal 45° numeric candidate
`(0,-100)→(200,100)` has `(100,0)` in its interior. If accepted, the proposed
segment must be partitioned at that existing Vertex; otherwise it geometrically
crosses the node without sharing it, violating Geometry Contract §3's planar
graph invariant. One implementation can split it, another can reject it, and
another can accidentally retain an invalid unsplit segment.

**Required closure.** Replace the case list with one total exact-contact rule:
group every exact candidate/existing contact by coordinate, including
endpoint/endpoint, endpoint/interior, candidate-interior/existing-Vertex and
interior/interior contacts; reuse the one existing Vertex or create one shared
Vertex; then atomically partition every incident candidate/affected
WallSegment at all distinct contacts for an accepted candidate. If the product
owner instead wants to reject this contact class, that must be an explicit
policy reconciled with FR-9; no unit may accept it unsplit. Add both singular
and multiple existing-Vertex pass-through fixtures, including a junction with
several incident Walls.

## Required owner workflows and gates

1. Correct R5-CS-01 and R5-CS-02 in a new non-canonical revision and obtain
   fresh current-source, adversarial lower-level and topology/data-integrity
   re-reviews. No earlier review substitutes for the corrected text.
2. Once that input is accepted, run a fresh `bmad-architecture` **update**:
   append via `_bmad/scripts/memlog.py`, preserve AD-7's ID, re-distill the
   Spine, run lint/rubric and re-run all three reviewer lenses against the
   distilled result.
3. Route owner changes through `bmad-spec` (mandatory JSON/backup grammar and
   serialization/import reason), `bmad-prd` (FR-9 wording) and `bmad-ux`
   (gesture/numeric contact feedback and measurement). Update project context
   only after canonical adoption.
4. Produce independent corpus evidence for the raw JSON ingress boundary,
   relative snap, every exact-contact class including the new pass-through
   cases, atomic/no-partial outcomes, and all retained open policy seams.
   S-2 remains `needs-further-evidence`; its disposable code is not promoted.
5. Broader readiness remains blocked by terminal spike evidence, `G-1`,
   `G-CP-ADR`, human AssetUsageGrants, eight physical `NFR-15` traces and a
   final independent `READY` verdict.

No root scaffold, production code, production test/configuration, release
claim or commit is authorized by this review.
