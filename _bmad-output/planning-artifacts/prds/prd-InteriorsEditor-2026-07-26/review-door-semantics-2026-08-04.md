# PRD Quality Review — Door semantics update (2026-08-04)

**Scope:** reviewer-gate delta pass for the Door navigation clarification in
`prd.md`. The pre-existing full review remains in `review-rubric.md`; this
review applies the same rubric to the changed contract and its downstream
handoffs. It was run sequentially because no independent agent slot was
available during the headless update.

## Overall verdict

The delta is decision-ready: `FR-17`, `FR-20` and `FR-24` now express one
testable rule and explicitly reject an unsupported locked-door feature. It is
safe to retain as the product source, but downstream epics still contradict it
until their owner completes the required reconciliation.

## Decision-readiness — strong

The choice is explicit: valid inter-room Door means a Walk edge; `Exterior`
and invalid Door mean no transition. `FR-20` also puts the rejected access
control behavior beside the requirement rather than leaving it implied.

## Substance over theater — strong

The update removes an undefined word instead of adding a speculative feature.
It makes the existing UJ-2 climax and CAP-4 intent operational without adding
credentials, keys, arbitrary traversal or navigation outside the Project.

## Strategic coherence — strong

Topology remains the single source for Room connectivity, consistent with the
phone-first planning thesis and the existing one-level, read-only Walk scope.

## Done-ness clarity — strong

The positive and negative conditions are directly testable: valid/inter-room
transitions work; exterior/invalid transitions do not; no Door state can be
edited to change that result.

## Scope honesty — strong

The non-goal list and `A-9` make the product inference visible. A later
access-control decision must be a separately approved requirement, not an
implementation interpretation of `Door`.

## Downstream usability — adequate

The PRD terminology is internally consistent and IDs remain stable. The
existing epic text nevertheless retains `locked` and `explicit passable state`,
which could lead a story owner to implement a contradicted behavior.

### Findings

- **high** Reconcile epic Door state language (`epics.md`, FR inventory, Epic
  4, Stories 3.4 and 4.3) — it still defines `locked`/explicit passability,
  while the PRD now makes passability topology-derived and excludes locking.
  *Fix:* run the owning `bmad-create-epics-and-stories` update before the next
  readiness gate.

## Shape fit — strong

For a chain-top consumer PRD, a concise rule in existing FRs plus an explicit
non-goal is more useful than a new technical state model or a duplicate
requirement.

## Editorial checks

- **Structural pass:** no new section is needed; the rule belongs in the
  existing Door/Walk requirements, the scope boundary, and the assumptions
  index. No cut, move or merge is recommended.
- **Prose pass:** no editorial issue that impedes comprehension was found in
  the changed passages. English domain terms intentionally remain consistent
  with the PRD glossary and the surrounding document.

## Mechanical notes

- Requirement definitions remain exactly `FR-1` through `FR-53` and
  `NFR-1` through `NFR-27`; no identifier was renumbered or reused.
- `A-9` round-trips the one conservative inference used by this update.
- The append-only `.memlog.md` contains the assumption and the applied change.
