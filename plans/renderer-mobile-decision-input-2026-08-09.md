---
title: Renderer and Mobile Interaction Decision Input
date: 2026-08-09
status: pre-canonical-input
target_workflow: bmad-architecture update
---

# Renderer and Mobile Interaction Decision Input

## Purpose and authority boundary

This is input to the fresh Architecture update required by `G-S1-renderer`
and `G-S4-touch`. It does not adopt a renderer, certify WebGL2 on a device or
turn browser emulation into participant evidence.

## Already binding

- WebGL2 is the Alpha baseline; WebGPU is progressive enhancement only.
- The canonical Project is not a renderer scene. Meshes, camera, cutaway,
  quality tier and context state are disposable projection state.
- Static scenes render on demand; quality degradation cannot alter integer-mm
  geometry or durable objects.
- Initial local authoring must stay a separate lazy boundary from renderer,
  catalog and optional PWA work.

## Decisions required

1. Select the renderer implementation behind the existing projection/renderer
   ports after equivalent RS-1/RS-2 comparison.
2. Define context-loss detection, disposal/recreate, no-revision-loss recovery,
   repeated-failure low-quality/2D fallback and diagnostic fields.
3. Define the renderer's camera-relative cutaway sector fixtures without
   persisting camera/cutaway state.
4. Bind the one/two-finger, numeric/list alternative, accessibility target,
   safe-area, keyboard and reduced-motion contracts to the same semantic
   topology command path.

## Candidate evaluation rule

Three.js/React Three Fiber and Babylon.js remain candidates, not adopted
dependencies. Each must receive the same build, RS-1/RS-2 fixture, WebGL2
probe, context-loss/recreate/dispose sequence, render-on-demand measurement,
memory proxy and cutaway fixture. The selected library may not leak types into
domain entities or persistence.

## Required internal corpus

- Projection fixtures: multi-room walls/floors/items, camera sectors and
  transient `Авто cutaway`/`Показать все стены` behavior.
- Lifecycle fixtures: normal init, unsupported WebGL2, one forced context loss,
  repeated loss, dispose/open cycles and recovery from canonical Project state.
- Interaction fixtures: one/two-finger handling, numeric parity, target labels
  and sizes, safe-area/keyboard/reduced-motion state and every
  stable error reason.
- Build evidence: actionable local initial screen, renderer chunk requested
  only on 3D entry, no catalog/texture eager load.

## External evidence still required

Real iPhone/Samsung RS-2 frame distribution, memory/thermal behavior, native
real safe-area/keyboard behavior and observed participant
gesture/numeric usability are separate physical/participant evidence. A green
Playwright run is only a prerequisite.
