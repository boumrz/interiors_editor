# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-current-project-recovery-changeset.md`
  summary: Add a shared custom-resource writer lease or a joint resource-manifest/publication transaction so an external context cannot repair or evict a resource between recovery revalidation and the Project CAS pointer swap.
  evidence: The current local resource store and fenced Project repository use separate persistence boundaries; this slice serializes repair and removal within one controller, but cannot atomically coordinate another context's resource-store write.

- source_spec: `_bmad-output/implementation-artifacts/spec-current-project-recovery-changeset.md`
  summary: Define semantic GLB admission and recovery validation beyond exact byte length and SHA-256 equality.
  evidence: A hash-valid GLB can still be unsupported or fail decoder/rendering validation, while current recovery integrity intentionally verifies only the immutable content address.

## Deferred from: code review of 2-2-draw-constrained-wall-with-touch-or-numeric-input.md (2026-08-27)

- Adopt the complete revision-bound `PlanProjectionPort` hit-square, stable tie, hold-hysteresis, stale projection and non-invertible retry corpus beyond the Product Owner-approved minimal gesture slice.
- Reconcile the historical general-topology and accepted collinear-extension behavior with the source-owned TCC-A1 adoption gate without silently changing current Project semantics.
- Migrate the historical geometry reason-code union to the canonical `INVALID_DIMENSION`, `ZERO_LENGTH` and `PROJECT_BOUNDS_EXCEEDED` vocabulary as a compatibility-aware contract change.
- Replace incremental `IdPort` consumption with one complete allocation reservation/consume-or-retire boundary.
- Retire the explicitly fixture-only V2 publication route, or harden its base candidate/revision coherence and stale-revision outcomes before any future production use.

## Deferred from: code review of 2-3-move-vertex-without-breaking-plan-graph.md (2026-08-27)

- Move the shared general mutation publication path from controller-only serialization plus writer fencing to an explicit exact-base revision CAS. This is pre-existing across mutation use cases and belongs to the common AD-3/AD-4 publication boundary rather than the Minimal Alpha direct-move patch.

## Deferred from: code review of 2-4-join-or-split-wall-at-shared-vertex.md (2026-08-27)

- Move the shared general mutation publication path to an explicit exact-base Revision CAS; this is already tracked from Story 2.3 and is not specific to join/split.
- Replace the pre-adoption matching fixture executor with a versioned TCC-A1 runner wired to production PlanGraph commands as a topology/release gate beyond the approved Minimal Alpha story slice.
- Replace incremental `IdPort` calls with one validated atomic reservation/consume-or-retire boundary shared by topology and Room identity materialization.

## Deferred from: code review of 2-5-change-wall-thickness-without-replacing-room-height.md (2026-08-27)

- Move the shared general PlanGraph mutation route from the schema-V1 controller boundary to the fully adopted domain-owned command/publication boundary. This is a repository-wide pre-existing migration rather than a Story 2.5 thickness behavior patch.

## Deferred from: code review of 3-1-derive-stable-rooms-from-closed-topology.md (2026-08-28)

- Preserve half-square-millimetre centerline areas in `DerivedOrthogonalFace`, or remove that unused projection, before it gains a production consumer. Current user-visible Room area and perimeter are derived separately from the usable polygon, so this is not a Story 3.1 acceptance regression.
