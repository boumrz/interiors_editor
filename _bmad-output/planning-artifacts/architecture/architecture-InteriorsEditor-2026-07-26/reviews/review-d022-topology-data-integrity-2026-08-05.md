---
title: "InteriorsEditor — independent D-022 topology/data-integrity review"
review_type: topology-data-integrity
reviewed: 2026-08-05
reviewer: "Codex /root/architecture_topology_review"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-2026-08-05.md
artifact_status: noncanonical-draft-working-policy
verdict: REJECT_FOR_PRECANONICAL_INPUT
readiness: NOT_READY
scope: "Read-only D-022 policy review of kernel, selection, topology, Room, Opening and usable-polygon semantics; no draft, canonical, source, code, test, configuration or evidence mutation"
source_mutations: none
---

# Независимый D-022 topology/data-integrity review

## Вердикт

**`REJECT_FOR_PRECANONICAL_INPUT`; `NOT_READY` остаётся без изменений.**

Draft correctly preserves the noncanonical/evidence boundary and makes several
sound conservative choices. It cannot yet become the next architecture input,
because its usable-polygon algorithm is undefined for a valid, mandatory
topology shape, and its manual-merge admission rule leaves a host/data
equivalence predicate to implementation judgment. Either gap lets two valid
lower-level implementations derive different Rooms, usable geometry or
attachment outcomes from the same Durable Plan.

This does not reject the delegated direction itself. It rejects only this
revision as a sufficiently complete pre-canonical decision input. No product
code, readiness status or S-2 evidence status changes through this review.

## Basis and mechanical checks

The comparison covered the current Spine AD-1/AD-3/AD-6/AD-7/AD-12 and memlog;
SPEC plus Geometry, Glossary and Project/Backup companions; PRD FR-7–FR-19 and
NFR-1–NFR-5/NFR-17/NFR-19/NFR-26; both UX contracts; the delegated policy
packet; the 2026-08-05 readiness report; and S-2 work-package, policy-boundary
and independent-integrity reports.

- Every source path declared by the draft resolves; the unchanged Spine linter
  returns `ok: true`, `0` findings.
- S-2 remains `needs-further-evidence`. Its own boundary explicitly says it
  does **not** establish general usable-polygon, Room reconciliation, Opening
  relocation, tolerance or device behavior; it cannot validate this custom
  exact kernel by implication.
- The draft accurately remains `canonical: false`, `implementation_ready:
  false` and `NOT_READY`; it makes no false device, production, S-2-terminal or
  `READY` claim.

## Blocking findings

### D022-TOPO-01 — P1: exact usable-polygon join is undefined for mandatory collinear face runs

**Evidence.** Draft §8 (lines 294–305) instructs the kernel to construct a
`Q(√2)` miter intersection for every adjacent pair of offset lines, then
choose miter or bevel by its distance limit. It contains no branch for
parallel/coincident offset lines and its required corpus (line 333) covers
convex/reflex pairs but not a straight (`0°`) boundary run.

This is not an exotic input. AD-7 and Geometry Contract §6 require an exact T
to split the crossed WallSegment. A Room boundary can therefore contain
`A→J` and `J→B` as consecutive collinear segments after a valid T split, while
manual merge is deliberately not automatic. With equal thickness their inward
offset lines coincide; with a permitted thickness change they are parallel but
distinct. In both cases their line determinant is zero, so there is no unique
miter intersection. The proposed bevel rule also cannot run, because it starts
only after an existing miter is found and measured.

This can make a valid atomic T cause an implementation to skip the junction,
reject it, invent a float fallback, or choose a different step/bevel. The
consequence reaches usable area/perimeter, face fingerprint, exact Room overlap
and Opening/host validation, directly violating the same-Revision determinism
required by NFR-4.

**Required correction.** Add an explicit exact `FaceBoundaryNormalization` /
zero-turn rule before miter/bevel evaluation:

1. collapse a maximal consecutive collinear same-offset run only in the
   **derived** face boundary (without merging canonical WallSegments or losing
   their topology/host lineage);
2. define a deterministic, exact policy for a collinear thickness step
   (named step/bridge geometry, or a documented whole-candidate rejection),
   and separately reject/normalise backtracking/180° degeneracy before a miter
   call; and
3. add golden/property cases for same-thickness T-split runs, collinear
   thickness-step runs, cardinal/diagonal variants, retained Room identity,
   exact area/perimeter, miter-limit boundaries and no projection feedback.

No code may call the miter branch when the offset-line determinant is zero.

### D022-MERGE-02 — P1: `semantic-equivalent` attachment admission is not a deterministic host rule

**Evidence.** Draft §5 (lines 210–232) allows manual merge when side finishes,
material host and wall-local attachments are either `semantic-equivalent` or
have an exact lineage mapping. The former term has no equality predicate,
normalization, side-address rule, offset/orientation rule or required mapping
payload. The current Geometry Contract instead requires stable wall-side
addresses and unambiguous lineage for split/merge host transfer.

Consequently one implementation can call two equal-looking material presets
equivalent and silently attach them to a new host, while another rejects; a
third can preserve a WallPlacement but invert its `AdjacentRoomId|ExteriorSide`
meaning. The sentence “reject if not proved” is safe only after “proved” is
defined; it cannot itself make an unspecified predicate deterministic.

**Required correction.** Replace the informal alternative with a stable
admission contract. At minimum, define an exact normalised equality predicate
for every canonical payload that may survive a merge, plus a complete explicit
`MergeAttachmentMap` for old `WallSegmentId`/side/local interval to new host
address, orientation and integer offset. If a field is absent, reversed,
ambiguous or not byte/semantic-equal under that named predicate, reject the
whole command. Extend the corpus with same-looking-but-different side,
finish/material, Opening, WallPlacement and assignment cases—not only the
existing incompatible/branch/overlap negatives.

## Important corrections required with the next revision

### D022-ROOM-03 — High: explicit survivor mapping needs a formally bounded relation

The mutual-unique-maximum rule is safe, but §6 then says an equal split/merge
uses a “one-to-one explicit survivor mapping” without defining whether it
overrides the tie, which candidate pairs are selectable, or how a many-old to
one-new merge selects exactly one retained predecessor. A UI can otherwise
either reject every tie or accept a mapping outside positive exact-overlap plus
lineage.

Define a serializable partial injective `RoomSurvivorMap`: each entry must be
one eligible positive-overlap/lineage pair, a successor accepts at most one
predecessor, unmapped predecessors lose ID/properties under the stated preview,
and the mapping is the only explicit tie override. Test equal split, equal
merge, competing predecessors, invalid map, cancel and replay.

### D022-HIT-04 — Medium: 44 CSS-px canvas selection is a new policy, not a consequence of NFR-17 alone

NFR-17 mandates a floor for interactive **DOM targets**. Draft lines 122–125
call a 44×44 CSS-px canvas hit square a consequence of that requirement. It is
a plausible D-022 working policy and the numeric alternative/zero domain
tolerance are sound, but the wording overstates its source authority.

State that the hit square is a proposed canvas-selection policy *aligned with*
the touch floor, not derived from it. Retain the required G-1 and physical
phone validation, and add CSS page zoom/visual-viewport, dense-overlap and
pointer-event-coordinate fixtures to the presentation corpus.

## What is sound in the draft

| Area | Assessment |
| --- | --- |
| `BigInt` + `Q(√2)` direction | **Conditionally sound.** A diagonal normal offset cannot in general be represented in integer/half-mm fixed point, and the draft correctly keeps exact intermediates ephemeral. Before adoption the corpus must additionally define/test `Q(√2)` normal form, exact equality/order/sign, zero determinant, coefficient/resource bounds at ProjectLimits and mobile NFR-5 stress; S-2 does not supply this evidence. |
| Zero domain tolerance and selection boundary | **Sound policy shape.** Presentation may select an already exact candidate, but no near pointer becomes a persisted vertex/contact; numeric input still takes the same exact topology path. |
| Tie, ray, `k`, hysteresis | **Sound as working input.** Class priority, coordinate/source tie-break, fixed angular-bisector order, lower half-step and `k > 0` remove hidden pointer-history/library defaults. Zero hysteresis remains a usability hypothesis requiring the listed evidence. |
| T/X continuity | **Sound.** It preserves AD-7 total contact grouping, complete partition and no arbitrary child-wall selection; selection stays non-domain UI state. |
| Opening and diagonal-host safety | **Sound conservative direction.** Absolute offset from stable canonical start, no clamp, explicit axis lineage map and prohibition of diagonal offset-bearing rebase prevent silent orphan/world-space repair. The source-owner corpus must cover reverse orientation, fit boundary and every host type. |
| Measurement seam and readiness claims | **Sound.** One exact-input formatter seam is retained while locale/precision stays source-owned; the document neither promotes S-2 nor changes any readiness/device/legal gate. |

## Required evidence after the two blockers are corrected

In addition to the draft’s current table, the source-owned corpus needs:

- exact field arithmetic tests for canonical `Q(√2)` reduction, equality/order
  and sign near zero without `Number`, determinant-zero behavior and bounded
  coefficient growth under maximum allowed topology;
- full ProjectLimits stress/reference-device measurements for contact grouping,
  face derivation, usable-polygon/overlap and cancellation/response boundaries;
- derived-boundary zero-turn, collinear thickness-step and branch/T-split
  suites; and
- user/device evidence that the proposed zero-hysteresis 44-px selection can
  be used without unintended candidate choice, alongside the required numeric
  alternative.

Only after those corrections, independent re-review, source-owner
reconciliation and corpus evidence may a `bmad-architecture` update consider
AD-1/AD-6/AD-7 changes. The broader `G-READY` remains `NOT_READY` regardless.
