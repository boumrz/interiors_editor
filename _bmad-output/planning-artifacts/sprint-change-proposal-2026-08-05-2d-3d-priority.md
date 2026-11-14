# Sprint Change Proposal — editable 2D/3D priority

**Date:** 2026-08-05  
**Status:** approved by standing Product Owner implementation waiver  
**Decision mode:** Batch; no additional approval prompt is required.

## Trigger

The Product Owner has explicitly reprioritised the first tangible outcome: a
person must be able to edit a plan in 2D and inspect that same plan in 3D. The
existing durable-project substrate is useful but, by itself, is not a usable
planning product.

This document records a delivery-order change. It does **not** change the
product contracts owned by the PRD, SPEC, UX, or Architecture Spine.

## Evidence and boundary

- Story 1.1 has a locally verified durable Project creation slice, but remains
  in `review` pending a post-remediation independent re-review.
- `G-S2-topology`, `G-S4-touch`, and `G-S1-renderer` remain closed. The
  implementation-readiness verdict remains `NOT READY`.
- The Product Owner's written authorization permits production implementation
  while the missing evidence gates are closed in parallel. It is a waiver to
  begin work, not a claim that any gate is passed or that Alpha is releasable.
- The canonical contracts remain binding: integer-mm PlanGraph, `Room.heightMm`
  as the only editable height, disposable 2D/3D projections, WebGL2 baseline,
  numeric alternatives, durable publication, and no renderer-owned geometry.

## Approved delivery order

1. Create the narrowly scoped V-02 first-room vertical slice from Story 2.1:
   enter valid internal width/depth/height in millimetres, construct a canonical
   rectangular PlanGraph, publish it durably, and show exact 2D dimensions.
2. Immediately build the V-03 projection slice from Story 4.1 over that exact
   same Durable Revision: Plan/3D switching, real WebGL2 compatibility and
   recovery states, and no serialized mesh/camera state.
3. Continue the planned constrained-wall, topology, touch, history and
   renderer evidence work to grow this first room into the full Alpha editor.
4. Story 1.2 stays `ready-for-dev`, but is temporarily lower priority. Its
   safety requirements are not discarded; it is not represented as complete.

## Implementation approach

The first visible editor is deliberately a thin vertical slice, not an image
mock or a parallel geometry model:

- `Project.level.vertices` and `Project.level.wallSegments` become the single
  editable canonical state for the first rectangular room.
- The starter uses a visible fixed `100 mm` wall thickness. It is a narrow
  V-02 slice invariant needed to derive finished inner dimensions, not a new
  user-editable wall-thickness policy; Story 2.5 remains its owner.
- A validated edit creates a new candidate Revision and uses the existing
  durable staging/checksum/pointer-swap boundary. Rejection leaves the prior
  Revision intact.
- The 2D screen is an SVG projection with a numeric DOM control surface; visual
  scale never alters millimetres.
- The 3D screen is a disposable low-level WebGL2 adapter behind a projection
  seam. It does not select Three/R3F or Babylon.js, so AD-13 and
  `G-S1-renderer` remain honestly open.
- Playwright covers the mobile creation, 2D edit, persisted reopen, Plan/3D
  switch, and WebGL2-unavailable fallback journeys. Unit tests cover the
  geometry and durable application seam without DOM or GPU.

## Required follow-up evidence

- Independent re-review of Story 1.1 after its remediation.
- A versioned geometry/topology corpus and touch evidence sufficient to close
  `G-S2-topology` / `G-S4-touch`; this first rectangle is not a substitute.
- Renderer ADR/comparison, lifecycle/context-loss and physical-device traces
  before `G-S1-renderer` can pass.
- Full implementation-readiness reassessment before an Alpha readiness claim.

## Ownership and communication

`/root` is the single implementation owner for the isolated V-02/V-03 slice.
An independent review is required before a story is marked `done`; it is queued
until a review slot is available. No commit is authorized by this proposal.

The product owner requested small screenshots after material visual milestones;
they will be saved under `docs/progress/screenshots/` and labelled as browser
emulation unless a physical-device trace was actually collected.
