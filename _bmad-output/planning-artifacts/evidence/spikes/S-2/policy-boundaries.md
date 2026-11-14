---
title: "S-2 topology candidate — policy boundaries and negative evidence"
spike_id: S-2
status: pending-policy-decision
owner: "Codex /root/spike_s2_topology"
reviewer: "Codex /root"
---

# S-2 topology candidate — policy boundaries

## Authority boundary

This document records experimental observations. It is **not** an ADR, does
not amend the Geometry Contract, PRD, SPEC or Architecture Spine, and does not
adopt a product rule. `ADR-002-coordinate-and-topology-model.md` may only be
created or updated by a fresh `bmad-architecture` workflow after an authorized
decision and independent review.

## Candidate behavior made executable

| Topic | Candidate behavior exercised | Evidence status |
| --- | --- | --- |
| Coordinate representation | Safe integer millimetres; prototype rejects fractional/out-of-bounds coordinate inputs | deterministic in this runtime; not an adopted numeric policy |
| Direction set | Axis-aligned and ±45° segments only | deterministic validation candidate |
| T intersection | Split at an exact integer-mm interior point; a persisted unsplit T/X remains invalid even with a stray Vertex at that coordinate | candidate planar-graph integrity behavior |
| X intersection | Caller must explicitly select `reject` or `split`; non-integer crossing is rejected; a persisted unsplit X is invalid | deliberately prevents an implicit library default |
| Merge | No automatic merge; a `manual-only` merge may not leave a branch on a newly unsplit wall | candidate UI/domain boundary, not an approved workflow |
| Face derivation | Bounded centerline graph faces and stable geometric fingerprints | topology candidate, not full usable-polygon derivation |
| Room identity | Carry ID only for exactly one prior room and exactly one next face with identical fingerprint; otherwise ambiguity | safe negative default, not reconciliation policy |
| Opening fit | Candidate wall height is `max(adjacent Room heights)`; opening height limit is `min`; tested interval fit | derived-rule candidate only |

## Decisions intentionally left open

| Required decision | Why the prototype cannot decide it | Required owner/path |
| --- | --- | --- |
| Grid, snapping and tolerance | The experiment accepts exact integers only; it does not establish user-facing tolerance, snapping UX, or measurement/display rounding | Product + UX + Architecture, then `bmad-architecture` |
| 45° quantization | Exact diagonals are accepted; the valid conversion/rounding rule for near-diagonal user input is untested and unapproved | Product + UX + Architecture |
| X policy | Both explicit `reject` and `split` candidates work, but no authority chose default behavior, warnings, confirmation or conflict-resolution UX | Product + UX + Architecture |
| T/split semantics | Candidate IDs and pieces are deterministic only within the prototype; endpoint/interior placement, selected-object continuity and command history semantics are not adopted | Product + UX + Architecture |
| Merge policy | `manual-only` is a safety candidate, not a decision on automatic simplification, confirmation, identity and metadata transfer | Product + UX + Architecture |
| Room reconciliation | Exact fingerprint matching is intentionally conservative; it provides no overlap, lineage, metadata inheritance, label transfer or user-resolution policy | Product + UX + Architecture |
| Opening relocation | The prototype tests fit only. It implements no wall edit/delete relocation, repair, clearance or host-address migration policy | Product + UX + Architecture |
| Usable polygon | Rectangle metrics and centerline faces are not a general inward offset/miter/bevel algorithm, especially with mixed wall thickness or diagonal boundaries | Architecture + geometry policy owner |
| Wall/Room height rules | The max/min calculation is a candidate fixture only; exterior-wall default height, openings, door adjacency and 3D projection are not resolved | Product + Architecture |

## Negative results and exclusions

- A 999-mm diagonal X crossing would require `(499.5, 499.5)` mm and is
  rejected instead of silently rounding. This documents a policy gap; it is
  not a final rounding answer.
- Collinear interior overlap is rejected. The experiment does not establish a
  user repair flow for overlap, join cleanup or edit recovery.
- An exact persisted T/X with only a standalone Vertex at the crossing is
  rejected: every crossed WallSegment must be split to reference the junction.
  This verifies graph integrity, not a user-facing split/repair policy.
- A malformed or fractional in-memory Revision is rejected at the public
  command boundary before `BigInt` intersection arithmetic. This verifies a
  stable prototype error boundary, not persistence/recovery behavior.
- A divider creates two face candidates and yields `ROOM_IDENTITY_AMBIGUOUS`;
  no metadata is silently moved. This avoids data loss in the experiment but
  leaves the intended product workflow open.
- Uniform rectangle usable dimensions are demonstrated. Mixed thickness and
  non-rectangular faces deliberately do not receive a claimed usable-polygon
  result.
- Undo is an in-memory immutable prior Revision snapshot, not durable publish,
  portable history, session retention, recovery or storage behavior.
- The prototype has no external geometry-library comparison and cannot make a
  library implementation choice.

## Scope exclusions

The following are outside S-2 and remain unverified: browser/engine variance;
iOS Safari and Android Chrome behavior; PWA lifecycle; Playwright application
flows; 3D projection; WebGL/WebGPU; touch interaction; frame/performance
budgets; persistence, recovery, backup and one-writer fencing; assets;
catalog/provenance; real Project data; and physical-device evidence.

## Consequence

These unresolved decisions preclude a terminal conclusion. The executable
corpus is a reusable evidence input only after the independent reviewer
confirms it; it must not be treated as a production specification or source
module.
