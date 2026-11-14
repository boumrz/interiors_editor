# Reconciliation — Door navigation semantics (2026-08-04)

## Change signal

Readiness review found that `passable`/`locked` Door behavior was expressed in
epics without a complete product-source decision. The requested conservative
Alpha rule is: a Door that passes existing validity/topology rules is an
interior, passable Walk connection; Alpha does not introduce a locked-door
state or interaction.

## Source extraction and outcome

| Input | Relevant finding | Reconciliation |
| --- | --- | --- |
| `prd.md` before this update | `FR-17` defined a valid Door and its adjacency; `FR-20` nevertheless mentioned a `Locked` Door without defining a state, actor or interaction. | `FR-17`, `FR-20` and `FR-24` now define the same topology-derived rule. |
| `addendum.md` | It asks whether Door-as-transition is understandable, but contains no product decision for locks, keys or open/close behavior. | No new feature was inferred from the research question. |
| `.memlog.md` before this update | No approved decision defined a locked Door. | The absence is recorded as assumption `A-9` and in the append-only memlog. |
| Caller change signal | Explicitly prohibits inventing access control, keys, arbitrary traversal or external navigation. | The PRD makes those behaviors explicit non-goals; exterior and invalid Doors never transition. |

## Resulting PRD contract

1. A Door valid under `FR-17`/`FR-19` and connecting two `Room` instances
   creates a passable interior `RoomGraph` edge for `Walk Mode`.
2. Passability derives from topology and validity; Alpha has no separately
   editable `locked` state for Door.
3. A Door to `Exterior` or an invalid Door creates no Walk transition.
4. Access control, keys, locking/unlocking and open/close interaction are
   outside Alpha scope.

## Downstream reconciliation required (not edited in this PRD-only run)

- `epics.md` still says `locked`/`explicit passable state` at its FR inventory
  and Epic 4/Stories 3.4 and 4.3. A fresh
  `bmad-create-epics-and-stories` update must replace those with the PRD rule
  before the next readiness assessment.
- `SPEC.md` CAP-4 and Architecture `AD-6` are compatible but less explicit.
  A source-derived `bmad-spec` update should carry the exact CAP-level
  terminology, then Architecture can reconcile only if the derived contract
  changes its boundary.
- UX has no conflicting `locked`-Door wording in the source scan. It should
  consume the final PRD/SPEC rule before a Walk affordance is specified.

## Stable identifiers

No `FR-*` or `NFR-*` identifier was added, renumbered or reused. The decision
is owned by the existing `FR-17`, `FR-20` and `FR-24` requirements.
