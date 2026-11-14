---
baseline_commit: NO_VCS
---

# Story 4.1: Переключить одну Durable Revision между Plan и 3D

Status: done

## Authority and boundary

The Product Owner prioritised usable 2D/3D editing under the standing written
production waiver. This Story follows the explicitly approved order in
`planning-artifacts/sprint-change-proposal-2026-08-05-2d-3d-priority.md`.
`G-S1-renderer` remains closed: AD-13 has not selected Three/R3F or Babylon,
there is no renderer ADR/comparison, and no physical-device claim is allowed.

Story 2.1 currently supplies a constrained single-room, integer-mm PlanGraph
and durable replacement Revision. This Story must consume it as read-only
projection data; it may not add a second geometry model, serialize a mesh or
camera, or make a mode switch a command/revision/history event.

## Story

As a person planning a room on a phone,
I want to switch the same saved plan between exact 2D and real 3D,
so that I can understand the space without creating a second project version.

## Acceptance criteria

1. **One canonical Revision, two disposable projections.**

   **Given** a durable rectangular Room from Story 2.1,
   **when** the user selects the Plan/3D switcher,
   **then** the active view changes without calling a domain command,
   changing canonical `Project`, revision ID, metrics, selection or durable
   status,
   **and** both Plan and 3D show the same finished-inner width/depth/height.

2. **Actual WebGL2 baseline with no framework decision.**

   **Given** WebGL2 can be acquired from an HTML canvas,
   **when** 3D opens,
   **then** a small disposable adapter renders the canonical room as a
   perspective floor plus four wall volumes using `1000 mm = 1 scene metre`,
   from no DOM/React/renderer types in the domain,
   **and** render state/camera/program/buffers are disposed on view change or
   unmount. No Three/R3F/Babylon package is added by this story.

3. **Truthful compatibility and recovery state.**

   **Given** WebGL2 is unavailable, initialization throws, or context is lost,
   **when** the user chooses 3D,
   **then** the application exposes an accessible explanation and retry path;
   2D and numeric inspector remain available, and it never substitutes an
   empty scene for canonical data. `webglcontextlost` prevents default and
   disposes transient state; `webglcontextrestored` is a retry opportunity.

4. **Mobile proof without overclaim.**

   **Given** the current phone browser emulation,
   **when** the user creates and sizes a room, opens 3D, returns to Plan and
   reloads,
   **then** Playwright observes a WebGL2 canvas or compatibility state, exact
   accessible dimensions in both modes, no new revision on switching and a
   retained durable plan after reload.

   **And** `SC-V03` comes from the running browser under
   `docs/progress/screenshots/` and is labelled browser emulation, never a
   physical NFR-15, performance/thermal or renderer-gate PASS.

## Tasks / Subtasks

- [x] Define a pure renderer projection seam (AC: 1, 2)
  - [x] RED: test that the rectangular projection converts integer mm to scene
        metres, derives the expected floor/wall dimensions and contains no
        persistence/UI state.
  - [x] GREEN: add domain-independent render input values under
        `adapters/renderer/`; do not import renderer types into domain.
  - [x] Implement WebGL2 projection and lifecycle (AC: 2, 3)
  - [x] RED: test the WebGL2 capability/lifecycle controller with a fakeable
        canvas/context port: unavailable, init failure, context loss, restore,
        dispose and retry.
  - [x] GREEN: write a low-level WebGL2 adapter for the one-room reference
        scene. It must render on demand, use a fixed initial camera only as
        transient state and free buffers/programs on disposal.
- [x] Compose accessible Plan/3D UI and browser evidence (AC: 1, 3, 4)
  - [x] RED: extend the browser scenario for Plan → 3D → Plan revision parity
        and compatibility fallback; use controlled test seams, not user-agent
        claims.
  - [x] GREEN: add 3D mode to `AppShell`, a visible active-mode control,
        dimensions/list alternative, retry control and CSS Module layout that
        keeps critical DOM controls ≥44px.
- [x] Run lint/typecheck/Rstest/Rspack/Playwright/mutation evidence only
        after every generated mutation source is restored; capture `SC-V03`.

## Review Findings

- [x] [Review][P1] Production `three` usage chose a renderer framework before
      the AD-13 renderer decision, versioned corpus and independent review.
      The Alpha 3D path is now raw WebGL2 only: opaque custom-GLB metadata
      cannot select or restart another renderer, and the canonical-dimension
      greybox remains available while GLB material rendering is deferred.
      This does not select an AD-13 renderer or pass `G-S1-renderer`.
- [x] [Review][P2] `SC-V03` sidecar records its hash, running
      browser-emulation scenario/viewport and explicit non-physical,
      non-performance and non-renderer-gate wording:
      [`SC-V03-webgl2-3d-mobile-browser-2026-08-05.md`](../../docs/progress/screenshots/SC-V03-webgl2-3d-mobile-browser-2026-08-05.md).
- [x] [Review][Test] Lifecycle coverage emitted `webglcontextlost` but did
      not prove its required `preventDefault()` call. The fake canvas now
      records the call and the context-loss/recovery scenario asserts it
      exactly once while retaining the existing disposal and recovery checks.
- [x] [Review][AC-1] 3D metrics used the exterior Vertex envelope (4100 ×
      3100 mm for a 4000 × 3000 mm finished Room), while Plan and the WebGL
      projection used finished-inner dimensions. The 3D panel now prefers the
      same derived rectangular metrics and falls back to the general Plan
      envelope only when those metrics are unavailable; `PLAN-E2E-02` asserts
      4000 × 3000 × 2600 mm after the view switch.

## Developer guardrails

- `Project`/`Level`/`Room` are canonical only in `domain`; pure projection
  input and all WebGL objects must stay outside it.
- 3D makes no dimensions editable. Width/depth/height come from the same
  `deriveRectangularRoomMetrics` projection as Plan. One metre equals 1000 mm.
- WebGL2 is requested only when 3D is selected. It is not a WebGPU claim and
  must not block project authoring or reopen.
- Use a tested `WebGlCanvasPort`/adapter seam. Browser `canvas`, shader,
  buffer and event details never leak into React model or domain modules.
- `contextlost` and `contextrestored` are a transient renderer condition:
  they never change Project/Revision/history. Program or buffer allocation
  never occurs in persistent state.
- Explicitly defer orbit/pan/zoom/surface picking (Story 4.2), Walk, adaptive
  quality evidence (4.4), assets and WebGL engine selection ADR.

## Expected file layout

```text
apps/web/src/
  adapters/renderer/
    rectangular-room-projection.ts      # NEW pure renderer input
    webgl2-room-renderer.ts             # NEW WebGL2 disposable adapter
    webgl2-room-renderer.test.ts        # NEW lifecycle seam tests
  ui/
    RoomScene3d.tsx                     # NEW canvas composition
    AppShell.tsx                        # UPDATE mode/switch/fallback
    AppShell.module.css                 # UPDATE
  tests/browser/
    plan-e2e.spec.ts                    # UPDATE Plan/3D parity
```

## References

- [Epic 4 / Story 4.1](../planning-artifacts/epics.md#story-41-переключить-одну-durable-revision-между-plan-и-3d)
- [SPEC CAP-5](../specs/spec-interiors-editor-alpha/SPEC.md)
- [Geometry contract §8](../specs/spec-interiors-editor-alpha/geometry-contract.md)
- [Architecture AD-1, AD-2, AD-5, AD-10, AD-12, AD-13](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md)
- [Khronos WebGL 2.0 specification](https://registry.khronos.org/webgl/specs/latest/2.0/)
- [MDN `webglcontextlost`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Completion Notes List

- Story context created for the owner-prioritised WebGL2 projection. No
  renderer evidence gate or production completion is claimed.
- Added pure mm→metres rectangular projection values and a disposable raw
  WebGL2 renderer that renders a floor and four wall volumes once per entry.
  Domain values do not import canvas/WebGL types, mesh, shader, program or
  camera state.
- Added a fakeable lifecycle controller covering unavailable WebGL2,
  initialization failure, context loss, restored retry and disposal. Context
  loss is a renderer-only state and never changes the Project/Revision.
- Added Plan 2D/3D switching to the mobile editor. The same numeric accessible
  measurements remain visible in 3D; mode changes preserve revision. Browser
  tests cover actual WebGL2 canvas path and a controlled `webgl2` unavailable
  simulation that leaves Plan 2D usable.
- **Review evidence — 2026-08-28.** Strengthened the WebGL lifecycle seam so
  the context-loss test now proves `preventDefault()` is called exactly once,
  in addition to renderer disposal and restore. Focused Rstest passes (31/31).
- **AC-1 review patch — 2026-08-28.** Corrected the 3D metric display to
  consume the Plan's finished-inner rectangular measurements rather than wall
  exterior bounds. The browser acceptance scenario was RED at 4100 × 3100 mm
  and passes with 4000 × 3000 × 2600 mm; lint and both TypeScript checks pass.
- **P2 review patch — 2026-08-28.** The SC-V03 sidecar binds the existing PNG
  to its SHA-256, current canonical browser-emulation trace and viewport. It
  explicitly excludes physical-device, performance/thermal,
  renderer-selection/corpus and renderer-gate claims. Story 4.1 then remained
  in `review` pending raw-baseline remediation for P1; AD-13 was unaffected.
- **Independent P2 acceptance — 2026-08-28.** An independent check resolved
  the Story link to the sidecar, recomputed the recorded SHA-256 against the
  PNG and confirmed the named `PLAN-E2E-02` / iPhone 13 `390 × 844` emulation
  context and all evidence-limit wording. P2 is accepted; P1 remains open.
- **P1 review patch and independent acceptance — 2026-08-28.** The production
  Alpha path no longer imports or selects Three: `webgl2-room-renderer` is a
  raw WebGL2 adapter, `RoomScene3d` neither parses nor passes `Object3D`, and
  opaque custom-GLB readiness metadata leaves the canonical-dimension greybox
  in place without publishing a Project mutation. TDD began with three
  focused RED failures and finished with 41 focused GREEN checks; the full
  suite is 1,613/1,613 Rstest. Typecheck, Biome lint and production Rspack
  build are clean; `PLAN-E2E-02` and `EDITOR-E2E-04C-1` pass in mobile browser
  emulation. Selected raw-renderer mutation evidence killed 168/252 mutants;
  83 survived and one timed out, so this is recorded as bounded regression
  evidence rather than a clean mutation result. Independent acceptance
  confirmed the raw-only chain and the continued non-passing status of
  AD-13/`G-S1-renderer`.
- Observed evidence is the same green 47/47 Rstest, Rspack build and 4/4
  mobile Playwright suite noted in Story 2.1. Stryker's configured scope is
  domain/application, not renderer/UI; its 235/305 (77.05%) result is recorded
  in Story 2.1 and does not close `G-S1-renderer`.

### File List

- `_bmad-output/implementation-artifacts/4-1-switch-durable-revision-between-plan-and-3d.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/src/adapters/renderer/rectangular-room-projection.ts`
- `apps/web/src/adapters/renderer/webgl2-room-renderer.ts`
- `apps/web/src/adapters/renderer/rectangular-room-projection.test.ts`
- `apps/web/src/adapters/renderer/webgl2-room-renderer.test.ts`
- `apps/web/stryker.raw-webgl2-baseline.config.mjs`
- `apps/web/src/ui/RoomScene3d.tsx`, `AppShell.tsx`, `AppShell.module.css`
- `apps/web/tests/browser/plan-e2e.spec.ts`
- `docs/progress/screenshots/SC-V03-webgl2-3d-mobile-browser-2026-08-05.png`
- `docs/progress/screenshots/SC-V03-webgl2-3d-mobile-browser-2026-08-05.md`

## Change Log

- 2026-08-28: Added explicit context-loss cancellation evidence; Story remains
  in `review` pending independent final acceptance and renderer gate evidence.
- 2026-08-28: Closed the finished-inner 3D metric review finding without
  changing the canonical Project, renderer-gate status or physical-device
  claim.
- 2026-08-28: Resolved review P2 with a checksummed SC-V03 browser-emulation
  sidecar; Story then remained in `review` for raw-baseline P1 remediation,
  without an AD-13 renderer decision.
- 2026-08-28: Resolved P1 and independently accepted the raw-WebGL2 Alpha
  baseline. Story 4.1 is `done`; AD-13, `G-S1-renderer`, physical-device,
  performance/thermal and GLB-PBR evidence remain outside this closure.
- 2026-08-05: Started the V-03 implementation context under the Product Owner
  priority change.
- 2026-08-05: Implemented the constrained WebGL2 V-03 projection and moved it
  to independent review; `G-S1-renderer` remains closed.
