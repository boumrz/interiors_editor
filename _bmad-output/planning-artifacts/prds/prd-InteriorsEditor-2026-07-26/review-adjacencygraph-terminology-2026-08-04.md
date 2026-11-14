---
title: "Review — AdjacencyGraph terminology and Door semantics"
date: 2026-08-04
scope: "Targeted independent validation of prd.md only"
prd_sha256: "221fe38468a3e320b05111b790752be76a1df21bf635ece4d810c9c1654c551c"
verdict: PASS
---

# Review — AdjacencyGraph terminology and Door semantics

## Verdict

**PASS.** The reviewed PRD uses the canonical `AdjacencyGraph` term and
preserves the topology-derived Alpha Door rule. No source PRD, addendum, or
memlog artifact was changed by this review.

## Targeted checks

| Check | Result | Evidence in `prd.md` |
| --- | --- | --- |
| `RoomGraph` occurs zero times | PASS | Exact-string search returned 0 occurrences. |
| `AdjacencyGraph` is used consistently | PASS | Glossary (121); §5.3 (293); FR-17 (333); FR-18 (343); FR-20 (362); NFR-4 (772); resolved decision (1017); A-9 (1055). |
| Door semantics exactly preserve the canonical rule | PASS | FR-17 and FR-20 make the one derived `Walk edge` conditional on a valid Door on a Wall adjacent to exactly two derived Room. FR-20 explicitly gives exterior, invalid, and no-two-Room Doors neither edge nor transition, and excludes `passable`, `locked`, access control, key, lock/unlock, and open/close Door behavior. |
| FR-30 ItemInstance lock/unlock remains separate | PASS | FR-30 still applies `lock/unlock` only to `ItemInstance` (469–473); it does not introduce Door state. |

## Canonical cross-check

The PRD result agrees with SPEC glossary, SPEC CAP-4, geometry contract §8,
and Architecture AD-6: `AdjacencyGraph` is derived after Room reconciliation
and Opening validation; it is not an independently persisted Door-state graph.

## Scope note

AD-6 still contains a historical phrase describing `RoomGraph` in the PRD as a
pending editorial correction. The PRD correction is now complete; this is an
architecture-owned editorial follow-up, not a PRD terminology failure.
