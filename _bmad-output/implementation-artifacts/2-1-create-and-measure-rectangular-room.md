---
baseline_commit: NO_VCS
---

# Story 2.1: Создать, изменить и измерить точную прямоугольную Room

Status: done

## Authority and execution boundary

Product Owner Roman explicitly authorized production implementation before
`BMAD READY` and instructed the team to proceed without repeated prompts. The
priority decision is recorded in
`planning-artifacts/sprint-change-proposal-2026-08-05-2d-3d-priority.md`.
This authorizes this isolated V-02 slice; it does **not** mark `G-READY`,
`G-V01-S3`, `G-S2-topology`, or `G-S4-touch` as passed, and it does not make
the Alpha release-ready.

Story 1.1 remains in `review` pending an independent post-remediation review.
This story must preserve its storage/recovery behavior and must not claim that
the incomplete history/cancel substrate from Story 1.4 exists.

## Story

As a person planning a room on a phone,
I want to enter and change its internal width, depth and ceiling height in
millimetres and immediately see the exact 2D plan and measurements,
so that I can start checking a layout without CAD knowledge.

## Scope and acceptance criteria

This is the owner-prioritised, intentionally narrow implementation of canonical
Story 2.1. The durable rectangle is the only editable plan shape in this
slice; arbitrary/constrained walls, gesture construction, T/X handling,
multiple rooms, undo/redo and complete topology evidence remain in their
planned stories and gates.

1. **Canonical rectangle from exact numeric ingress.**

   **Given** a new or existing empty local Project,
   **when** a user supplies positive SafeInteger decimal lexemes for internal
   width, depth and `Room.heightMm` and confirms the operation,
   **then** the application builds exactly four canonical `Vertex` values and
   four orthogonal `WallSegment` centerlines in integer millimetres plus one
   derived-room metadata record,
   **and** the fixed visible starter thickness is `100 mm`; centerlines lie
   outside the entered finished dimensions by half that thickness, so the
   derived usable inner rectangle is exactly `widthMm × depthMm`.

   **And** the model uses opaque IDs, `xMm`/`zMm` and `thicknessMm` naming;
   `Room.heightMm` is the only persisted editable height. It serializes no SVG,
   mesh, camera, zoom, selection or pixel coordinate.

2. **Validated update is one durable replacement revision.**

   **Given** the Project already contains this rectangular starter,
   **when** the user changes any valid dimension and confirms,
   **then** the same opaque room/wall/vertex identities are updated as one
   validated candidate and a new Revision follows the existing local staging →
   checksum/deserialize validation → atomic current-pointer publication path,
   **and** a failed or invalid command leaves the prior durable dimensions and
   revision readable. No independent browser/UI mutation path is allowed.

   **And** this is not a claim of portable History/undo/cancel: the screen
   shows only the truthful saving/durable/failure state already owned by Story
   1.1.

3. **Exact, accessible 2D measurement projection.**

   **Given** a durable rectangular Room,
   **when** the editor is in Plan mode,
   **then** an SVG Plan projection visibly shows the four walls, a visual grid,
   its finished-inner width/depth dimension labels, area and perimeter, and an
   accessible numeric inspector with all three raw-mm fields and an explicit
   apply control,
   **and** the grid/scale is presentation only: it never rounds, snaps,
   validates or rewrites canonical values.

   **And** `MeasurementFormatPolicy V1` is used: `ru-RU`, integer mm with
   suffix `мм` and area rounded half-up to `0,01 м²`. The first rectangle’s
   derived values must agree across numeric inspector, 2D labels and the later
   3D projection, without formatted values re-entering a Command.

4. **Phone-first safety and observable proof.**

   **Given** a 390×844 mobile-browser emulation,
   **when** the user creates a named Project, creates/edits its rectangle and
   reloads,
   **then** the durable 2D plan and exact dimensions reopen; all critical DOM
   controls remain at least 44×44 CSS px, have labels and work without hover.

   **And** invalid/blank/zero/negative/fractional/exponent/unsafe numeric
   lexemes announce a stable `INVALID_DIMENSION` error and do not create a
   Revision or overwrite the prior plan. Browser tests cover this journey and
   persistence-fault non-regression; pure tests cover geometry, derived
   metrics, formatting, candidate construction and publication ordering.

   **And** `SC-V02` is captured from the running browser and saved under
   `docs/progress/screenshots/`, labelled browser emulation—not physical-device,
   PWA, performance, accessibility or topology-gate proof.

## Tasks / Subtasks

- [x] Define the narrow canonical rectangular-room domain (AC: 1, 3)
  - [x] RED: add DOM-free tests for strict SafeInteger lexeme ingress, positive
        dimensions, fixed wall thickness, four distinct vertices/walls,
        centerline/finished-inner relation and stable room identity.
  - [x] GREEN: extend `domain/project.ts`; create pure rectangular-room,
        metrics and measurement-format modules without React, DOM, renderer or
        persistence imports.
  - [x] RED/GREEN: cover width/depth/height updates, exact area/perimeter and
        invalid lexemes with no candidate state mutation.
- [x] Publish a validated current-Project replacement durably (AC: 2)
  - [x] RED: test a generic next-Revisions publication through existing port
        semantics, preserving prior durable revision on failure.
  - [x] GREEN: extend the application repository port/use case/controller only
        as needed; reuse staging/checksum/pointer swap rather than a second
        store or `localStorage` path.
  - [x] Test that first rectangle allocation gets opaque graph/room IDs while
        subsequent dimension updates retain those identities and receive only a
        new opaque Revision ID.
- [x] Compose the phone-first 2D editor (AC: 3, 4)
  - [x] RED: add UI-state tests for the saved empty Project → dimension form →
        saving/durable/error states.
  - [x] GREEN: extend `AppShell` with accessible mm fields, error association,
        a Plan mode workspace and an SVG projection. Keep global CSS limited to
        tokens/reset and use CSS Modules for the editor.
  - [x] Preserve Story 1.1 create, retry and recovery fences. Do not wire React
        directly to IndexedDB, add image mocks, canvas-only input, touch wall
        construction, assets, backend, PWA worker or a 3D engine.
- [x] Add executable 2D evidence (AC: 4)
  - [x] Write `PLAN-E2E-02`: a clean persistent iPhone-13 browser profile
        creates a named Project, makes a 4000×3000×2600 mm room, changes it,
        observes no external Project request, reloads and reads exact durable
        values; invalid input leaves the prior plan intact.
  - [x] Run frozen lock install, lint, typecheck, Rstest, Rspack build,
        Playwright and mutation testing after the source restore completes.
  - [x] Capture/send `SC-V02`; record only observed results in this file.

## Developer guardrails

- **Single geometry truth:** `Level.vertices` and `Level.wallSegments` are the
  canonical graph. `Room` stores only stable user properties/reconciliation
  identity; face, usable rectangle, SVG, dimensions, area, perimeter and later
  mesh are projections. Do not store `innerWidthMm` or `areaMm2` as a second
  mutable truth.
- **Input boundary:** use text controls with numeric input hints; parse the raw
  lexeme before JavaScript number coercion. Accept only
  `^-?(?:0|[1-9][0-9]*)$`, normalise `-0` to `0`, then require a positive safe
  integer. Use `INVALID_DIMENSION` for every invalid dimension in this narrow
  slice. Do not require a 100-mm grid multiple.
- **Fixed thickness scope:** exactly `100 mm`, displayed as read-only starter
  information. It exists solely to fulfill the centreline/inward-offset
  contract for this rectangle; wall-thickness editing is Story 2.5.
- **Geometry scope:** all four walls are orthogonal, non-zero and form one
  simple ring. Never present this narrow validator as the generic topology
  kernel or as evidence for T/X, holes, intersections, source raw JSON ingress
  or `G-S2-topology`.
- **Durability:** a successful validation is `PendingDurability`, not saved.
  Preserve the local current pointer/revision invariant and recovery state. A
  new revision may replace the pointer but must not delete the old readable
  revision as cleanup; history/GC semantics are later work.
- **Formatting/projections:** exact internal calculations are in mm/mm². The
  2D grid scale and SVG viewBox cannot feed a command. Implement V1 text in
  one pure formatter so the later 3D adapter can consume it.
- **Layering:** `domain` is DOM-free; `application` depends on domain ports;
  concrete IndexedDB/browser objects live under `adapters`/`app`; React only
  talks to the controller. Never import POC/spike code or use it as production
  source.
- **No false device/renderer claim:** mobile Playwright and SC-V02 are browser
  evidence only. Story 4.1 must request a real `webgl2` context, handle its
  unavailability/loss and stay behind a projection adapter.

## Expected file layout

```text
apps/web/src/
  domain/
    project.ts                         # UPDATE canonical graph value types
    rectangular-room.ts                # NEW pure build/validate/update
    room-metrics.ts                    # NEW derived usable metrics/format
  application/
    configure-rectangular-room.ts      # NEW use case
    ports.ts                            # UPDATE generic candidate publication
  app/
    project-controller.ts              # UPDATE observable editor state
    production-app.ts                  # UPDATE composition only
  adapters/persistence/
    durable-project-repository.ts      # UPDATE/reuse one publication protocol
  ui/
    AppShell.tsx                       # UPDATE form + SVG projection
    AppShell.module.css                # UPDATE phone editor CSS module
  tests/browser/
    plan-e2e.spec.ts                   # NEW Playwright journey
```

## Source intelligence

- Story 1.1 established the only production local path. It has a `NO_VCS`
  baseline, is still in `review`, and its post-remediation local gate observed
  Biome lint, 14/14 Rstest, 3/3 Playwright and 46/46 scoped mutants killed.
  Preserve the recovery fence and immediate controller single-flight guard.
- Current `Project` serializes an empty `Level`; `DurableProjectRepository`
  already performs staging → read/checksum → atomic pointer publication; the
  IndexedDB adapter writes pointer and staging removal in one transaction.
  Generalise that capability rather than copying persistence code.
- The public geometry contract requires centerline walls and a deterministic
  inward finished-inner rectangle. `geometry-contract.md §7` specifically
  states that a rectangular starter with inner `W×D` has a usable polygon
  `W×D`.
- AD-13 is still `PROPOSED`; add no Three/R3F/Babylon dependency in this story.
  The following 3D story will use `canvas.getContext('webgl2')`, a compatibility
  state and `webglcontextlost` handling. Khronos defines WebGL2 as a canvas
  context aligned to OpenGL ES 3.0; the WebGL context-loss event must be
  handled as a real recovery condition.

## References

- [Epic 2 / Story 2.1](../planning-artifacts/epics.md#story-21-создать-и-измерить-точную-прямоугольную-room)
- [PRD FR-6, FR-13, NFR-1–4, 17–19, 26](../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md)
- [SPEC CAP-2, CAP-3 and CAP-8](../specs/spec-interiors-editor-alpha/SPEC.md)
- [Geometry contract §§1–3, 7–8](../specs/spec-interiors-editor-alpha/geometry-contract.md)
- [Architecture AD-1, AD-2, AD-3, AD-5, AD-7, AD-12](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md)
- [UX design/experience, editor, numeric alternative and state rules](../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md)
- [Project Context](../project-context.md)
- [Khronos WebGL 2.0 specification](https://registry.khronos.org/webgl/specs/latest/2.0/)
- [MDN WebGL context-loss event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- `bmad-correct-course`, `bmad-create-story` and `bmad-dev-story` workflow
  context loaded 2026-08-05; standing owner authority selected Batch mode.
- Relevant SPEC companions, PRD, Architecture Spine, UX documents, project
  context and all current production UPDATE files were inspected before code.
- Current multi-agent capacity is exhausted, so an independent implementation
  review is queued rather than simulated.
- 2026-08-22: independent adversarial review found and then re-accepted the
  AC-3/AC-4 remediation; the reviewer did not modify implementation files.

### Completion Notes List

- Comprehensive Story 2.1 context created for the owner-prioritised 2D first
  room.
- Implemented strict raw-mm rectangular-room ingress and a canonical four
  Vertex/four WallSegment graph with fixed visible `100 mm` starter thickness.
  A `Room.heightMm` record is the sole editable height; area/perimeter and
  2D/SVG labels are derived from the graph.
- The generic local repository publication port now persists a validated next
  Revision through the existing staging/checksum/atomic-pointer path. A failed
  replacement retains the previous Durable Revision; first allocation gets
  opaque graph/Room IDs and dimension changes retain them.
- Built the phone-first Plan 2D editor with labelled numeric controls,
  `INVALID_DIMENSION` error association, visual-only SVG grid, exact
  measurements and durable status. It opens as the current Project state after
  reload; no touch-wall editor, History, asset, backend or PWA scope was added.
- Observed post-implementation evidence: Biome lint; TypeScript/domain
  typecheck; 47/47 Rstest; Rspack production build; 4/4 mobile browser
  Playwright scenarios; `SC-V02` browser-emulation capture.
- Scoped Stryker command completed with 235/305 mutants killed (77.05%) and
  70 survived, concentrated in defensive rectangular-graph guards. The command
  itself passes, but the survivors are an explicit test-strength debt for
  independent review; this does not claim 100% mutation coverage or a passed
  readiness gate.
- 2026-08-22 remediation: a repeat independent audit found four actual gaps:
  no visible perimeter, an incomplete width/depth-only auto-save inspector,
  incomplete browser negative/fault coverage, and a stale SC-V02. The editor
  now has one raw-mm width/depth/height inspector with explicit `Применить
  размеры`; it publishes one candidate only on that action. The derived
  perimeter is visible in both the SVG and inspector. `PLAN-E2E-02` now covers
  blank/zero/negative/fractional/exponent/unsafe ingress and a before-pointer
  persistence failure followed by durable reopen. The independent repeat
  review accepted all remediation.
- Evidence after remediation: 1,094/1,094 Rstest; Biome lint; both TypeScript
  checks; production Rspack build; 91/91 mobile-browser Playwright and 3/3
  production-PWA Playwright. Targeted `room-measurement.ts` mutation ran after
  source restoration: 35/40 killed (87.5%), 5 survived. The score clears the
  configured quality band but its survivors remain an explicit test-strength
  debt, not a release-readiness claim. SC-V02 was recaptured from the
  production build as browser-emulation evidence.

### File List

- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-05-2d-3d-priority.md`
- `_bmad-output/implementation-artifacts/2-1-create-and-measure-rectangular-room.md`
- `apps/web/src/domain/project.ts`
- `apps/web/src/domain/rectangular-room.ts`, `measurement-format.ts`
- `apps/web/src/application/ports.ts`, `create-project.ts`, `configure-rectangular-room.ts`
- `apps/web/src/app/project-controller.ts`, `production-app.ts`
- `apps/web/src/adapters/persistence/durable-project-repository.ts`
- `apps/web/src/ui/AppShell.tsx`, `AppShell.module.css`
- `apps/web/src/ui/room-measurement.ts`, `room-measurement.test.tsx`
- `apps/web/src/domain/*.test.ts`, `apps/web/src/application/*.test.ts`,
  `apps/web/src/app/project-controller.test.ts`,
  `apps/web/src/adapters/persistence/durable-project-repository.test.ts`
- `apps/web/tests/browser/plan-e2e.spec.ts`,
  `editor-workspace-e2e.spec.ts`, `pwa-e2e.spec.ts`
- `docs/progress/screenshots/SC-V02-editable-2d-mobile-browser-2026-08-05.png`,
  `SC-V02-editable-2d-mobile-browser-2026-08-22.png`,
  `SC-V02-editable-2d-mobile-browser-2026-08-22.md`

## Change Log

- 2026-08-05: Created the Story 2.1 delivery context and started the isolated
  2D priority vertical slice under the Product Owner waiver.
- 2026-08-05: Implemented the complete narrow 2D rectangle vertical slice;
  verified it locally and moved it to independent review.
- 2026-08-22: Remediated independent-review findings, recaptured SC-V02 and
  accepted the story after repeat independent review.
