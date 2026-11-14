---
title: "InteriorsEditor — adversarial review: Door semantics"
review_type: adversarial-door-semantics
reviewed: 2026-08-04
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewer: "independent adversarial reviewer"
status: complete
verdict: pass
scope: "attempted incompatible lower-level implementations of the current AD-6 Door delta and its domain/solution projections"
---

# Adversarial review: Door semantics

## Verdict

**PASS.** No incompatible implementation found can preserve the current
AD-6/domain/solution contract while giving a different Alpha Door outcome.
The canonical-term remediation closes the only previously plausible type/API
fork: `AdjacencyGraph` is the sole canonical term; legacy PRD wording
`RoomGraph` cannot become an alias, persisted type, or public API name.

No Critical, High, Medium, or Low finding is open from this lens. This is a
review of the architecture delta, not evidence that a future implementation,
test suite, or readiness gate has passed.

## Method

Tried to construct lower-level designs that would look compatible locally but
would diverge at a boundary. The review read current AD-6, AD-3/AD-7/AD-12,
AD-16/AD-17, `domain-model.md`, `solution-design.md`, the current PRD Door
rules, SPEC CAP-4/glossary/geometry contract, and `project-context.md`.
`lint_spine.py` also completed with zero findings.

## Adversarial implementation matrix

| Attempted incompatible implementation | Why it is rejected by the current contract | Result |
| --- | --- | --- |
| `AddOpening` creates a manually stored edge or a Door `isPassable` flag. | AD-6 and the domain negative invariants forbid editable Door access state and separately serialized/command-edited `WalkEdge`. | Blocked |
| `MoveOpening` or `ResizeOpening` preserves a stale prior edge after the Door no longer fits or no longer has two Rooms. | A Command validates the complete candidate atomically; adjacency is rederived only after Opening validation and Room reconciliation; its ChangeSet explicitly invalidates derived adjacency. | Blocked |
| `DeleteOpening` removes graphics but leaves an independently persisted navigation edge. | `WalkEdge` is not serializable and Walk consumes only the re-created `AdjacencyGraph`; no separate delete/edit command exists for it. | Blocked |
| A wall split/merge or ambiguous Room match selects an old Room ID and keeps traversal active during preview. | `Room` reconciliation must reach an explicit outcome; a Door with unresolved/ambiguous adjacency creates no edge/transition. The graph is derived after reconciliation, not from historical IDs. | Blocked |
| A `Window`, exterior Door, or invalid Door is treated as an ordinary portal by the renderer. | AD-6 and both projections enumerate every negative case; the solution design forbids the renderer/UI from building adjacency. | Blocked |
| Restore/import serializes `WalkEdge`, then skips recomputation. | The canonical Project carries Opening/topology, not the derived graph; the domain explicitly prohibits serializing `WalkEdge`, and revision validation rebuilds projections. | Blocked |
| A UI/API exposes `locked`, `open`, `hasKey`, `canTraverse`, or an equivalent access DTO outside the Door entity. | AD-6 forbids these fields/commands in Door, domain ports, API, and UI; SPEC and domain negative invariants repeat the entire prohibited state family. | Blocked |
| A swing/hinge animation changes whether Walk is allowed. | Swing/hinge remains an unresolved visual projection and is explicitly forbidden from changing traversal semantics. | Blocked |
| A module calls its public graph `RoomGraph`, stores a second type, or maps it separately from `AdjacencyGraph`. | The amended AD-6 makes `AdjacencyGraph` canonical and expressly rejects `RoomGraph` as a second persisted type, alias, or public API name. | Blocked |

## Mutation and test seams retained

The current architecture still requires, rather than merely suggests:

- `AddOpening`, `MoveOpening`, `ResizeOpening`, and `DeleteOpening` each have
  valid/invalid, inverse/undo, serialization, projection-invalidation,
  property-chain, and migration coverage;
- topology corpus covers one derived edge for a valid interior Door, none for
  exterior/invalid Doors, split/merge/Room ambiguity, and absence of a Door
  access state;
- deterministic worker and stale-base-revision rejection prevent late
  projection results from reintroducing an obsolete edge;
- renderer/browser tests validate integration but do not substitute for the
  pure domain assertions.

Those are required future test obligations, not a statement that any such
tests already exist outside the narrowly authorized spikes.

## AD-16 / AD-17 non-regression check

The Door delta does not widen either later boundary:

- AD-16 remains the unified-root React/TypeScript/Rspack/Rstest/CSS Modules
  toolchain and Playwright boundary; Door semantics add no toolchain, device,
  or readiness claim.
- AD-17 remains a catalog/provenance-only Kotlin/PostgreSQL perimeter; neither
  `Door`, `AdjacencyGraph`, Project topology, Revision, nor Walk state crosses
  into it.

No architecture main document was modified by this review.
