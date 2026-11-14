---
title: "InteriorsEditor — current-source review: Door semantics"
review_type: current-source-door-semantics
reviewed: 2026-08-04
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewer: "independent current-source reviewer"
status: complete
verdict: pass-with-follow-up
scope: "read-only reconciliation of AD-6 and its architecture projections with the current product and specification sources"
---

# Current-source review: Door semantics

## Verdict

**PASS WITH FOLLOW-UP.** `AD-6`, `domain-model.md`, and
`solution-design.md` now carry the same executable Alpha rule as the current
PRD and SPEC: only a valid `Door` on a `WallSegment` adjacent to exactly two
resolved/derived `Room` instances produces one undirected, topology-derived
`WalkEdge`; exterior, invalid, or not-exactly-two-room Doors produce neither
an edge nor a transition. `WalkEdge` is derived rather than serialized or
command-edited, and no Door `passable`, `locked`, access, key, lock/unlock, or
open/close state remains in the domain, ports/API, or UI.

No Critical or High source contradiction was found. The single follow-up is a
non-semantic name mismatch between the PRD's `RoomGraph` and the canonical
SPEC/architecture term `AdjacencyGraph`; it should be reconciled before a
story or API type is named from the PRD alone.

This is a source-derived review only. AD-6's delta contains no current
technology or version assertion, so web/version research was neither needed
nor performed. No architecture main artifact, including AD-16 or AD-17, was
edited.

## Sources and method

Read the current authoritative sources at the review snapshot:

- `prd.md`: `FR-17`, `FR-19`, `FR-20`, and `FR-24`;
- `reconcile-door-semantics-2026-08-04.md`;
- `SPEC.md` CAP-4 and its Alpha constraint, plus `glossary.md` and
  `geometry-contract.md`;
- `project-context.md` domain/state rules;
- `ARCHITECTURE-SPINE.md` AD-6, then its projections in `domain-model.md` and
  `solution-design.md`.

The deterministic architecture lint also passed with zero findings:
`lint_spine.py --workspace .../architecture-InteriorsEditor-2026-07-26`.

## Rule-by-rule reconciliation

| Required source rule | Architecture evidence | Result |
| --- | --- | --- |
| A valid Door connects a Wall to exactly two derived/resolved Rooms. | AD-6 requires a valid `Door` on a `WallSegment` adjacent to exactly two resolved Room; the solution projection fixes the sequence `validated Plan + Opening → Faces → reconciled Rooms → Door`. | Pass |
| That Door deterministically yields one non-oriented Walk connection. | AD-6 says one undirected `WalkEdge`; `domain-model.md` defines `WalkEdge { openingId, roomAId, roomBId }`; `solution-design.md` repeats one undirected edge. | Pass |
| Walk consumes only this derived topology result, never mesh or an independently mutable Door property. | AD-6 forbids a separately serialized/editable edge; the domain projection makes `AdjacencyGraph` derived; the solution projection prohibits renderer/UI construction. | Pass |
| `Window`, exterior Door, invalid Door, and a Door without exactly two Rooms do not transition. | All three architecture artifacts enumerate the negative cases and prohibit both edge and transition. | Pass |
| Alpha has no passability/lock/access/key/open-close behavior. | AD-6 forbids fields and commands across Door, ports, API and UI; both projections repeat the complete exclusion. | Pass |
| Opening edits preserve a valid result or reject atomically, so adjacency cannot become partial state. | AD-6 places adjacency after Room reconciliation and Opening validation; the geometry contract and domain ChangeSet keep derivation/recomputation outside a separately persisted state. | Pass |

## Follow-up

### CS-DOOR-01 — Normalize the graph name before type/API/story implementation

**Severity:** Medium — source terminology follow-up, not a semantic or
readiness waiver.

**Evidence.** The PRD glossary and `FR-17`/`FR-18` call the derived Room
connectivity graph `RoomGraph`. The current SPEC CAP-4, SPEC glossary,
geometry contract, AD-6, and both architecture projections call the same
derived graph `AdjacencyGraph`. They agree on its content and negative cases,
but two public names can yield two independently built types or an unnecessary
mapping layer.

**Clear closure.** The PRD owner should either adopt `AdjacencyGraph` as the
canonical glossary term or explicitly declare `RoomGraph` a product-language
alias. The architecture and SPEC should then retain one canonical domain type.
This review does not make that upstream ownership change.

## Retained boundaries

- A later door swing/hinge visualization may not affect Walk semantics.
- Door access control, keys, lock/unlock, and open/close need a new approved
  product requirement; they cannot be inferred by an implementation owner.
- The rule does not authorize a production implementation or alter the
  project's independent implementation-readiness gate.
