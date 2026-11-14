---
title: "AD-13 current-product ratification review"
date: 2026-08-30
reviewer: "Codex /root/renderer_touch_reassessment"
review_type: "independent architecture review"
reviewed:
  - "../ARCHITECTURE-SPINE.md#AD-13"
  - "../../../prds/prd-InteriorsEditor-2026-07-26/prd.md#NFR-14"
  - "../../../prds/prd-InteriorsEditor-2026-07-26/prd.md#NFR-15"
scope: "Current apps/web renderer boundary and recorded product-owner mobile acceptance"
verdict: "CONCERNS"
high_findings: 1
source_mutations: "review record only"
---

# Independent AD-13 current-product review

## Verdict

**CONCERNS — not ratified as written.** The direct Three.js/WebGL2 choice and
the disposable renderer boundary are present in the current product; NFR-14 is
consistent with that implementation. The product-owner's recorded NFR-15
acceptance is sufficient under the current PRD and is not a blocker for this
review. One high finding remains: AD-13 describes a concrete context-loss test
and recovery protocol that the current source and tests do not implement.

## Confirmed evidence

| Contract | Current evidence | Assessment |
| --- | --- | --- |
| Direct Three.js renderer, no R3F/Babylon alpha dependency | apps/web/src/adapters/renderer/three-webgl2-room-renderer.ts constructs WebGLRenderer; apps/web/package.json declares three and has no React Three Fiber or Babylon dependency. | Pass |
| Disposable adapter boundary | webgl2-room-renderer.ts exposes WebGl2SceneRenderer / RendererFactory; controller owns canvas lifecycle and disposes the renderer. three-webgl2-room-renderer.ts disposes objects, materials, geometries and renderer. | Pass |
| No engine types in canonical domain/application | apps/web/tsconfig.domain.json type-checks src/domain and src/application without DOM types; the current domain type-check passes. | Pass |
| WebGL2 baseline and degraded 2D route (NFR-14) | Controller probes canvas.getContext('webgl2'), handles loss/restoration, retries reduced quality, then emits two-dimensional-fallback. Current targeted renderer tests pass. | Pass |
| Current NFR-15 mobile acceptance | PRD records the product owner's 2026-08-29 acceptance for iPhone 15 Pro Max and Samsung S24 Ultra in browser and installed-PWA contexts; its stated optional independent device matrix is not elevated here. | Pass / accepted product evidence |

The following current checks were independently rerun successfully:

- pnpm --filter @interiors/web run typecheck — domain and web TypeScript checks pass.
- Targeted renderer, 3D scene, and floor-interaction tests — 49/49 pass.
- Browser scenarios for 2D fallback, context recovery, 3D two-finger camera gesture,
  placement/movement, numeric edit cancellation, and selected-target reachability — 9/9 pass.

## High finding

### H1 — AD-13 claims an unimplemented forced-loss protocol

**Contract location:** ARCHITECTURE-SPINE.md, AD-13, lines 454–461.

AD-13 currently requires detection of WEBGL_lose_context, explicit
injection-unavailable classification, a bounded restore timeout/cancellation,
and no-event outcome. No corresponding product source or test exists under
apps/web/src: there is no WEBGL_lose_context probe, injection-unavailable
state, timeout/cancellation mechanism, or no-event result. The current tests
simulate loss and restoration by manually dispatching webglcontextlost and
webglcontextrestored events, while unit tests inject fake port events.

This does **not** invalidate the tested implementation of normal loss ->
standard restore -> reduced-quality retry -> 2D fallback. It does mean the
ratified text would overstate what current code guarantees and how it is
verified.

**Required resolution before AD-13 can be marked ratified as written:**

1. Implement the stated extension-probe, outcome classification, and bounded
   restore protocol with focused tests; **or**
2. Amend AD-13 to the current, demonstrated contract: platform context-loss and
   context-restored events drive the standard/reduced/fallback sequence, and
   deterministic tests inject those events rather than claiming an extension
   force-loss facility.

## Conclusion

The renderer boundary itself is ready to guide implementation. The decision
record is not yet an honest ratification artifact until H1 is resolved. No
additional mobile or accessibility evidence is requested by this review beyond
the NFR-15 acceptance already recorded by the product owner.

## Remediation verdict — 2026-08-30

**PASS — H1 resolved; AD-13 is ratified for the reviewed scope.**

The revised AD-13 lines 454–460 now state only the implemented and tested
contract: canvas `webglcontextlost` / `webglcontextrestored` events, default
loss prevention, disposable renderer disposal, standard recovery,
reduced-quality retry, and explicit 2D fallback. It expressly disclaims the
previously unimplemented `WEBGL_lose_context`, timeout/cancellation, and
synthetic-benchmark protocol.

The targeted renderer controller suite was rerun after the document change:
36/36 tests passed. The scope is therefore fully aligned with NFR-14 and the
accepted NFR-15 product evidence.
