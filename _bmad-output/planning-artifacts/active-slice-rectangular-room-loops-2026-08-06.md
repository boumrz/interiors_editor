# Active implementation slice: rectangular room loops

**Status:** Active  
**Authority:** Roman Zheltov, sole product owner. Blanket implementation approval recorded in this thread; no per-slice approval is required.  
**Scope source:** `CAP-2`, `CAP-3`, `FR-16`, `FR-18`, `FR-21`, `FR-22`, `NFR-15`.

## Goal

A phone user can drag a grid-snapped, detached rectangular room on the free 2D canvas and receive one durable PlanGraph update that remains usable for 2D, WebGL2 3D, and floor-item placement after reload. The canonical domain accepts any valid integer-millimetre geometry; snapping is a gesture aid, not a persistence constraint.

## Acceptance criteria

- A valid integer-millimetre, grid-snapped detached rectangle creates exactly one new Room face, its four boundary walls and its vertices through the production controller/publication path.
- A candidate that overlaps or touches an existing room, has no area, is too narrow for wall thickness, or is off the project coordinate limit is rejected without allocating IDs or publishing a revision.
- Existing Room and wall identities remain stable where their geometry is unchanged; the new Room is independently hostable by a floor item.
- A new loop inherits the existing project’s current editable room height for this slice; per-room height editing is deliberately deferred.
- The 2D renderer displays separate floor faces rather than filling the bounding box between disconnected rooms; the WebGL2 projection displays separate floors and all canonical walls.
- Mobile Playwright proves create → draw detached room → durable save → reload → both rooms and the added room’s item remain present. Cancel and invalid drafts create no durable revision.
- Typecheck, lint, Rstest, production build, focused mutation check and full Playwright suite pass before this slice is reported complete.

## TDD increments

1. RED: domain behaviour for adding/rejecting an immutable rectangular loop and recovering exact usable bounds.
2. GREEN: canonical rectangle-face projection and deterministic vertex/wall rebuilding.
3. RED: application/controller publication path; prove a rejection does not publish.
4. GREEN: use case wiring and UI draft routing.
5. RED/GREEN: 2D and WebGL2 projections plus mobile browser end-to-end durability.
6. MUTATE/KILL/REFACTOR: target the new domain/use-case code, then run all quality gates.

## Explicitly deferred from this slice

- 45-degree walls, arbitrary free wall chains, T/X joins and wall movement.
- Door/window opening topology and 3D editing of objects.
- Partial-edge attachment and room merge/delete consequences; these are the next topology slice after detached-loop durability is proven.
- PWA install/offline evidence and physical-device performance evidence.
