# Floor-placement adversarial review r2 — 2026-08-05

**Verdict: BLOCKER**

- The narrowed contracts consistently make `roomId` the FloorPlacement host, and the requested search finds no `levelId` inside `FloorPlacement` in either mutable architecture document. A separate `levelId` is therefore not required to resolve a unique Room host.
- They nevertheless require FloorPlacement to retain `xMm`/`zMm` as “local coordinates of its host surface,” but define neither a canonical room-local origin nor axes (nor a deterministic conversion from the derived usable polygon).
- Implementation A can use the derived face centroid with project-plane axes as the room-local frame; implementation B can use the usable-polygon AABB minimum with those same axes. Both preserve integer millimetres, `roomId`, compatible-host validation, and every stated one-to-one lineage/conflict rule.
- The identical durable value `{ roomId, xMm, zMm }` resolves to different physical locations under A and B. During a compatible topology edit each implementation can also legitimately re-express the point in its own recomputed frame, yielding divergent reconciled revisions without a conflict preview.
- Reconcile by specifying a canonical `FloorPlacement` coordinate frame (origin, axes, and its derived geometry input), plus whether topology reconciliation preserves the same host-local coordinates or the projected physical point. The `roomId`-only host address can remain unchanged.
