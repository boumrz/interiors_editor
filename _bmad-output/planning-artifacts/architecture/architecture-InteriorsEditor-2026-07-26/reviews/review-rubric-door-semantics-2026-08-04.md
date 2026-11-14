---
title: "InteriorsEditor Alpha — rubric review: Door semantics"
review_type: architecture-rubric-door-semantics
reviewed: 2026-08-04
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewer: "independent rubric walker"
status: complete
verdict: pass-with-follow-up
scope: "good-spine rubric pass for the current AD-6 Door/Walk delta, including the canonical AdjacencyGraph remediation"
---

# Rubric review: Door semantics

## Verdict

**PASS WITH FOLLOW-UP.** AD-6 now fixes the real lower-level divergence:
whether a Door is a manual navigation object, a visual portal, or a derived
topology consequence. Its Rule makes one resulting path enforceable across
domain, persistence, Walk, renderer, UI and API. The canonical-term remediation
also prevents `RoomGraph` from becoming a second type or public mapping while
the upstream PRD wording is corrected.

No Critical or High finding is open. Two traceability/editorial follow-ups are
below; neither changes the valid Alpha Door semantics or grants implementation
readiness.

## Rubric results

| Good-spine dimension | Result | Evidence |
| --- | --- | --- |
| Real divergence point is fixed | Pass | AD-6 makes topology/validity the only source of a Walk transition, not a Door property, mesh, renderer, or UI action. |
| `Binds` / `Prevents` / `Rule` are enforceable | Follow-up | The Rule is concrete and the `Prevents` clause names the prior forks; its `Binds` list misses one requirement directly governed by the Rule (RDS-DOOR-01). |
| Mutation and projection boundary | Pass | AD-3 requires an atomic complete ChangeSet; the domain projection rederives adjacency only after validation and Room reconciliation, and WalkEdge is neither serializable nor command-editable. |
| Negative cases are complete | Pass | `Window`, exterior, invalid, unresolved/ambiguous Door, access state, and swing/hinge influence are all ruled out in AD-6 and both architecture projections. |
| Companion/source consistency | Follow-up | PRD/SPEC/geometry/domain/solution agree on behavior. `RoomGraph` remains in PRD/epic product wording but AD-6 contains it as a pending editorial correction rather than allowing a technical fork (RDS-DOOR-02). |
| Deferred hygiene | Pass | Visual swing/hinge is deliberately a non-semantic visual decision; room matching, split/merge and geometry mechanics remain owned by the existing S-2/geometry-policy boundary, not silently invented here. |
| Current-tech truthfulness | Pass | The Door delta is source-derived and introduces no technology, version, device, API, or deployment claim requiring web verification. |
| Architecture breadth/non-regression | Pass | CAP-3/CAP-4 map through AD-6/AD-7; AD-16 and AD-17 retain their web-toolchain and narrow Catalog Control Plane boundaries without taking ownership of Door/Project state. |

The deterministic Spine lint completed with zero findings.

## Findings

### RDS-DOOR-01 — AD-6 omits FR-18 from direct `Binds`

**Severity:** Medium — clear architecture traceability fix.

**Evidence.** AD-6 explicitly decides that a `Window` creates neither
`WalkEdge` nor a transition. That is the direct negative outcome of PRD
`FR-18`, but AD-6 currently binds `FR-17`, `FR-19`, `FR-20`, and `FR-24` only.
`CAP-4` covers it broadly, yet lower-level traceability and story/test mapping
can reasonably follow the explicit FR list.

**Clear fix.** Add `FR-18` to AD-6's `Binds` line. No Rule, type, or product
behavior should change.

### RDS-DOOR-02 — Canonical naming still needs its source-owner editorial close

**Severity:** Low — explicit upstream terminology follow-up.

**Evidence.** Current SPEC glossary, geometry contract, AD-6 and its
projections consistently use `AdjacencyGraph`; the current PRD and some
downstream roadmap wording still use `RoomGraph`. AD-6 correctly makes this a
pending PRD editorial correction and forbids an implementation alias/public
API mapping, so it is not a semantic contradiction.

**Clear closure.** The PRD owner performs the source-owned terminology update,
then downstream planning language is refreshed without creating a second graph
or changing any stable behavior/identifier.

## Boundary retained

This rubric review changed no main architecture document. It does not mark the
project `READY`, relax the S-2 topology gate, or substitute documentation for
the required future domain and Playwright evidence.

## Fix recheck

**2026-08-04 — RDS-DOOR-01 closed.** Current AD-6 `Binds` now contains
`FR-17`, `FR-18`, `FR-19`, `FR-20`, and `FR-24`; the Window/no-transition rule
therefore has direct requirement traceability.

`RDS-DOOR-02` remains a source-owner editorial task: PRD/roadmap terminology
must eventually replace `RoomGraph` with the canonical `AdjacencyGraph`. AD-6
already prohibits a second type, alias, or public mapping, so this is not an
open architecture contradiction. **Recheck verdict: PASS for the architecture
Door delta, with the tracked upstream editorial follow-up retained.**
