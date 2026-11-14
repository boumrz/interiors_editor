---
title: "InteriorsEditor — current-source/reality re-review: D-011…D-013, revision 6"
review_type: current-source-reality
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../topology-policy-reconciliation-draft-2026-08-05.md
artifact_revision: 6
previous_reviews:
  - review-current-source-topology-policy-2026-08-05.md
  - review-current-source-topology-policy-revision-4-2026-08-05.md
  - review-current-source-topology-policy-revision-5-2026-08-05.md
  - review-topology-policy-adversarial-r5-2026-08-05.md
  - review-topology-data-integrity-r5-2026-08-05.md
status: complete
verdict: ACCEPTABLE_AS_PRECANONICAL_INPUT
readiness: NOT_READY
scope: "read-only revision-6 current-source/reality review; no canonical source, Spine, memlog, prototype, application, test, or configuration mutation"
source_mutations: none
---

# Current-source/reality re-review — revision 6

## Verdict

**`ACCEPTABLE_AS_PRECANONICAL_INPUT`; implementation readiness remains
`NOT_READY`.**

Revision 6 closes both blockers in the revision-5 current-source review
without presenting its candidate wording as already adopted.  It is now a
sound input to the source-owning `bmad-architecture` update.  This is not an
approval to edit AD-7 directly, implement the proposal, promote S-2, or treat
the current PRD/SPEC/UX conflict around X intersections as resolved.

In particular, the revision now does all of the following within the current
authority boundary:

- keeps canonical Project metadata as JSON and binds Portable Backup to the
  mandatory `project/project.json` member inside the `.interiors` bundle;
- makes the lossless raw-token check a schema-aware operation *inside* that
  JSON representation, rather than a new canonical serialization format;
- normalizes every exact candidate/Plan contact, including a proposed
  WallSegment interior that passes through an existing Vertex; and
- makes diagonal preview signs derive from the selected direction instead of
  showing an unbound `±n × ±n` placeholder.

The verdict only permits the documented next planning workflow.  `G-READY`,
the current Spine, every source of truth, and all implementation restrictions
remain unchanged.

## Review basis and read-only checks

The comparison covered revision 6, all prior R1/R4/R5 current-source findings,
the accepted R5 adversarial and topology/data-integrity reports, Architecture
Spine AD-3, AD-4, AD-7 and AD-12 plus its serialization convention, the
Geometry Contract §§1 and 3–6, the Project-and-Backup Contract, glossary,
domain/solution companions, PRD FR-6…FR-13 and NFR-1/NFR-3/NFR-4, UX
durability behavior, delegated proposal §§4.2, 4.2.1 and 4.3.1, and S-2's
non-terminal evidence boundary.

Read-only mechanical checks completed for this review:

- `^-?(?:0|[1-9][0-9]*)$` accepts canonical signed-integer tokens including
  raw `-0`, and rejects plus, leading-zero, decimal, exponent, whitespace and
  non-finite forms.  The counterexample
  `99999.000000000000001` still becomes safe integer `99999` under ordinary
  `JSON.parse`, which confirms why the revision correctly requires raw-token
  validation *before* host-number materialization.
- The exact integer nearest-diagonal predicate
  `(2n − 1)² < 2L² < (2n + 1)²` held for every positive integer
  `L = 1…100000`; sample `L = 1000` produces `n = 707`.
- An off-grid active origin `(125, 0)` with `k = 3` and NE direction produces
  `(425, 300)`, confirming the proposed relative construction rather than a
  global 100-mm lattice.
- The R5 counterexample, proposed `(0,-100) → (200,100)` through existing
  Vertex `(100,0)`, is a strict proposed-segment-interior contact and is now
  explicitly included by the revision-6 grouping rule.
- `lint_spine.py` returned `ok: true` with `0` findings for the unchanged
  current Spine.  That is a mechanical consistency check only, not canonical
  adoption of this draft.

## Closure of earlier findings

| Earlier finding / carry-forward | Revision-6 evidence | Assessment |
| --- | --- | --- |
| R1 `CS-TP-01`; R4-CS-01 raw fractional JSON ingress | Proposed AD-7 wording requires the persistence/import decoder to retain and validate the raw JSON numeric lexeme at each relevant schema field before IEEE-number materialization; `Number.isSafeInteger` is only the final runtime guard. | **Closed.** It prevents ordinary `JSON.parse` rounding from serving as proof that a stored value was an integer. |
| R1 `CS-TP-02` scalar/sign handling | The rule retains `delta = k × d`, `k > 0`, all eight unit directions, explicit quadrant for a length-only diagonal, and preservation of exact endpoint signs. | **Closed.** |
| R1 `CS-TP-03` X routing | The delegated valid exact-X working default is explicit, while PRD/SPEC/Architecture owner reconciliation remains a prerequisite before canonical adoption. | **Closed as pre-canonical routing only.** The draft does not falsely say that FR-9 and Geometry Contract §6 already agree. |
| R1 `CS-TP-04`; R4-CS-02 policy lifecycle | The existing `SnapPolicy` remains construction-only; it has no registry, policy-version payload, ReleaseManifest mapping, persistence or migration claim. Resolved endpoints are never re-normalized. | **Closed.** This is compatible with session-only `DraftCommand`, AD-11 and the Portable-Backup exclusion of History. |
| R4-CS-03 reason-code ownership | No prototype `SERIALIZATION_INVALID` code is promoted. The serialization/import reason remains for `bmad-spec` and the Project/Backup owner to select. | **Closed as source routing.** |
| R4 durability/stale-worker boundary | Rejection, post-`Validated` persistence failure and stale worker discard remain separate branches, matching AD-3, AD-12, the glossary and UX storage behavior. | **Closed.** |
| R5-CS-01 non-JSON canonical alternative | The draft now says that the raw-token decoder runs within canonical JSON, keeps mandatory `.interiors` `project/project.json`, and says a non-JSON internal repository encoding cannot become an alternate canonical format through this delta. | **Closed.** This agrees with the Spine's `JSON metadata + addressed blobs` convention and the mandatory Portable Backup structure. |
| R5-CS-02 candidate-interior / existing-Vertex contact | The complete case list now names candidate-interior/existing-Vertex, including a multi-Wall junction. It groups every exact contact coordinate, reuses/creates one Vertex, and partitions every proposed or existing segment whose interior contains the coordinate. | **Closed.** A singular pass-through must partition the proposed segment; it cannot be accepted as an unsplit planar-graph violation. |
| R5 topology/data-integrity signed-preview carry-forward | Given selected `d`, the endpoint is `start + n × d`; preview shows the selected signed `deltaXmm × deltaZmm`, for example `+707 × -707 mm`, rather than generic signs. | **Closed.** The common `MeasurementFormatPolicy` still receives exact `2n²`; its locale/precision remains source-owned. |

## Focused current-source assessment

### JSON stays the canonical boundary

The corrected text is precise enough for the R5-CS-01 boundary.  It does not
pretend that a regex is a replacement wire format or that an ordinary parsed
JavaScript number preserves its original lexeme.  Instead, it requires a
schema-aware raw-token decoder at the relevant JSON fields, then admits a
typed number only via the validated `SafeIntegerMm` constructor.

That direction is compatible with:

- the Spine's explicit `schemaVersion` and `JSON metadata + addressed blobs`
  serialization convention;
- AD-4's staged, self-contained Portable Backup import; and
- the Project-and-Backup Contract's mandatory logical `.interiors` structure,
  whose canonical Project member is `project/project.json`.

The draft also correctly leaves the stable reason mapping to its actual
owners.  It makes no unsupported claim that S-2's in-memory
`SERIALIZATION_INVALID` result is already a product reason code.  Raw-byte
fixtures remain required before any canonical adoption.

### Total exact-contact grouping preserves the planar graph

Geometry Contract §3 permits a segment intersection only at a shared Vertex
and requires deterministic split or rejection; §6 already makes T splitting
mandatory.  Revision 6 now makes this total for the candidate path:

1. It groups every exact candidate/Plan contact by coordinate: endpoint with
   existing Vertex, endpoint with existing segment interior, candidate interior
   with existing Vertex, and interior with interior.
2. It reuses the one pre-existing Vertex at that coordinate or creates one
   common Vertex.
3. It atomically partitions every affected segment whose **interior** contains
   a grouped coordinate, ordered into distinct consecutive endpoint pairs.
4. Any resulting zero/duplicate/too-short/overlapping/self-intersecting or
   otherwise invalid Plan rejects as one detached candidate before Command or
   Revision mutation.

The previously missing R5 singular inverse case follows directly: a candidate
interior through an existing junction has that coordinate in the proposed
segment's interior, so the proposed segment is partitioned at the existing
Vertex.  Existing incident segments need not be split when the contact is
already their endpoint.  This preserves the planar-graph invariant while
still allowing a whole-candidate reject when another invariant fails.

### Signed diagonal preview is bounded, not a new measurement policy

The revised wording binds sign to the selected direction and keeps magnitude
normalization separate.  This matches Geometry Contract §1's authoritative
integer endpoints and signed `Δx × Δz` preview, PRD FR-8's quantised preview,
and FR-13's requirement for one diagonal representation across surfaces and
export.  By routing approximate rendered diagonal text through the existing
proposed `MeasurementFormatPolicy` from the same exact squared length, it does
not decide locale, precision, or a renderer-specific rounding rule.

## Scope and claim check

No new scope or unsupported success claim was found.  Revision 6 explicitly:

- remains `canonical: false`, `implementation_ready: false` and `NOT_READY`;
- retains S-2 as `needs-further-evidence` and treats its 43/43 corpus as
  bounded disposable evidence, not a selected production kernel or device
  proof;
- leaves kernel choice, tolerance, ties, visual-grid hysteresis, merge/Room/
  opening reconciliation and usable-polygon policy open under `D-022` or their
  owners;
- neither claims a physical/mobile result nor changes `NFR-15` evidence;
- introduces no new stable serialization reason, stored snap-policy protocol,
  alternate portable format, root scaffold, product test/configuration or
  production authorization; and
- keeps the proposed valid-X default narrowly contingent on the source-owner
  reconciliation that FR-9 still requires.

## Required next gate

Acceptance is intentionally narrow.  Before any implementation or readiness
change, the owner workflow must still:

1. run a fresh `bmad-architecture` **update**, append approved decisions only
   through `_bmad/scripts/memlog.py`, retain AD-7's ID, and re-distill the
   Spine;
2. route the JSON lexical/serialization-reason wording through `bmad-spec` and
   the Project/Backup owner; reconcile the valid-X consequence across
   `bmad-architecture`, `bmad-prd` and `bmad-spec`; and route interaction and
   measurement feedback through `bmad-ux`;
3. add independent raw-byte JSON, relative-snap, all exact-contact (including
   singular/multi-junction pass-through), atomicity and signed-preview corpus
   evidence without promoting S-2 implementation code; and
4. run lint/rubric and fresh current-source, adversarial and topology/data-
   integrity reviews against the **distilled canonical Spine**.

All broader gates remain: terminal evidence where required, `G-1`,
`G-CP-ADR`, human AssetUsageGrants, the physical `NFR-15` traces, and the final
independent `READY` decision.  This review changed none of them.
