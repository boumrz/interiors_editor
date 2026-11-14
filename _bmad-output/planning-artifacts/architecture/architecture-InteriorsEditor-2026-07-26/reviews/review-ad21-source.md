# AD-21 final source re-review

Date: 2026-08-10  
Scope: read-only review of the current AD-21, Domain Model and Solution Design
against the Architecture Spine, Geometry, Project/Backup and TCC-A1.

## Verdict: PASS — no P0/P1/P2 in the reviewed scope

The prior three source-bound findings are resolved:

- `MaterializationPermit` binds project, base revision/checksum/graph digest,
  intent, limits, fence and cancellation; `consumeIfCurrent` is the one
  conditional atomic linearization point, with cancel → stale → lost-fence
  precedence and no-reservation outcomes
  ([AD-21, lines 725–738](../ARCHITECTURE-SPINE.md#L725)).
- `InitialWallLimits` is an immutable projection of the source-owned
  `ProjectLimitsPolicy`; its rederived hash must match intent, graph and permit
  before permit consumption ([domain model, lines 299–307](../domain-model.md#L299)).
  Missing, unknown or mismatched snapshots are private pre-permit outcomes, so
  they neither invent a stable geometry reason nor allocate an ID.
- IWM-D1 now applies only to candidate-private structural digests; the
  prevalidated AD-3 `baseRevisionChecksum` is explicitly excluded and remains
  an opaque current-Revision comparison value
  ([domain model, lines 309–328](../domain-model.md#L309)).

The deterministic allocation tuple/order, failure containment, exact
digest-guarded inverse, no-alias rule and AD-21-specific TCC-A1 corpus vectors
are explicit ([AD-21, lines 741–764](../ARCHITECTURE-SPINE.md#L741)). The route
does not create a Project, Revision, History, writer state, resource root or
publication-visible identity; V1/V2, UI, renderer, storage and an oracle remain
outside its dependency and authority boundary.

## Boundary statement

This is a source-consistency pass for the bounded first-wall route only. It is
not corpus evidence, implementation evidence, a formal readiness assessment or
a `READY` verdict. The general `AddWallSegment`, contacts/T/X, non-empty plans,
faces, Room/Opening/host reconciliation, durability and all broader readiness
gates remain deferred.
