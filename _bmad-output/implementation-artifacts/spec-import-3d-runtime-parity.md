---
title: 'Единый runtime-декод GLB для preview и 3D-сцены'
type: 'bugfix'
created: '2026-08-18'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/spec-interiors-editor-alpha/asset-import-contract.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="owner pre-authorised autonomous roadmap continuation in the 2026-08-18 conversation and active implementation waiver">

## Intent

**Problem:** Один и тот же self-contained GLB попадает в isolated preview и в 3D-сцену через разные `GLTFLoader` lifecycle. Только сцена materialize-ит `ImageBitmap` texture sources для мобильного GPU, из-за чего успешный preview не доказывает, что на плане предмет получит те же material/texture bindings; parser failure также сейчас молча оставляет greybox-проекцию.

**Approach:** Вынести local-only GLB runtime decode, проверку non-empty bounds и mobile-safe texture-source materialization в один UI renderer helper. И preview, и 3D cache обязаны пользоваться им; неготовый/неоткрывшийся resource остаётся без custom renderer root, с явным transient status в 3D, без Project mutation.

## Boundaries & Constraints

**Always:** Сохранять `CAP-12` static self-contained GLB boundary, byte-level preflight/SHA admission и deny-network loader base URL. Renderer root остаётся disposable projection (`AD-9`, `AD-10`); disposal освобождает textures/ImageBitmap. Тестировать happy path, malformed/empty runtime root и error path до production change.

**Ask First:** Любое изменение accepted formats, GLB security limits/extension allowlist, Persistent Project schema, GC/repair policy, Portable Backup или visual redesign.

**Never:** Не выполнять network fetch, не создавать/менять Project Revision при renderer decode error, не выдавать experimental FBX/ZIP за CAP-12, не заявлять pixel-perfect visual acceptance или completion полного `IMP-02`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Textured GLB | Preflighted bytes with finite non-empty scene bounds | Preview and 3D receive roots after the same texture materialization. | No Project effect. |
| Runtime parser rejects | Validly admitted bytes fail `GLTFLoader` runtime parse | No custom root is rendered; 3D announces resource unavailable. | Existing Project/History unchanged. |
| Empty runtime root | Parser returns zero-sized scene | Treated as unavailable before preview/scene placement root. | Disposed safely; no substitute asset. |
| Renderer recreation | Cached model survives renderer recreation within component lifetime | Canvas-backed texture sources remain usable for re-upload. | Cache disposal releases owned resources on unmount. |

</frozen-after-approval>

## Code Map

- `apps/web/src/ui/custom-glb-runtime-loader.ts` -- shared local GLTF decode, texture materialization and bounds admission.
- `apps/web/src/ui/CustomGlbPreview.tsx` -- isolated preview consumes the shared runtime result.
- `apps/web/src/ui/RoomScene3d.tsx` -- custom scene cache consumes the same runtime result and reports unavailable assets.
- `apps/web/src/ui/custom-glb-runtime-loader.test.tsx` -- unit behaviour for texture-bearing, empty and failed runtime decode.
- `apps/web/src/ui/RoomScene3d.test.tsx` -- static UI contract for 3D resource status.

## Tasks & Acceptance

**Execution:**
- [x] Add a single UI-only runtime loader with injectable parser seam; materialize all GLB texture sources before either renderer owns the root, validate finite positive bounds and preserve loader failure as `undefined`.
- [x] Replace duplicate `GLTFLoader` calls in preview and 3D scene with this loader; retain renderer cache/disposal ownership and surface an accessible transient unavailable status when a scene resource cannot decode.
- [x] Add RED→GREEN unit tests for material-bearing root preparation, invalid/failed decode and 3D status; add a browser regression that a custom resource selected for a 3D scene reaches the custom renderer route rather than only the catalog preview.
- [x] Record bounded evidence in roadmap/evidence after checks; keep full backup/reopen visual acceptance open.

**Acceptance Criteria:**
- Given valid textured custom GLB bytes, when preview and 3D initialise, then both use the same shared decode preparation and no renderer branch skips texture-source materialization.
- Given runtime decode failure or empty bounds, when the 3D scene opens, then no custom root is used, the user receives a truthful transient state, and no Project mutation occurs.
- Given the 3D renderer is recreated from current domain projection, when the same custom GLB remains referenced, then its safe texture source remains suitable for re-upload and the durable Project is unchanged.

## Spec Change Log

## Design Notes

The common helper belongs to `ui`: it imports Three.js/DOM and must not leak into domain/application. Byte validation and hashes remain their existing application boundary; this helper only makes two disposable renderer projections agree about an already admitted immutable resource.

## Review Findings

- [x] `[Review][patch]` Materialization now fails closed: an unavailable canvas or failed copy disposes the temporary root instead of passing a potentially detached `ImageBitmap` into WebGL.
- [x] `[Review][patch]` Distinct Three textures that alias one decoded image receive the same canvas copy before that source is closed, preventing one material map from becoming black during 3D upload.
- [x] `[Review][patch]` The asynchronous local-resource verification state is propagated from the shell. An absent in-flight byte read is loading, not a terminal re-import error; active 3D decode has a visible `role=status` message.
- [x] `[Review][patch]` Malformed/defaultless GLTF scene results and failed bounds calculation remain outside both renderer branches and dispose any temporary root.

## Verification

**Commands:**
- `pnpm --filter web test -- --run src/ui/custom-glb-runtime-loader.test.tsx src/ui/glb-texture-materialization.test.tsx src/ui/RoomScene3d.test.tsx` -- RED→GREEN; 1,049 tests green on Node 24.19.0.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 pnpm exec playwright test --config playwright.config.mjs --grep "PROJECT-E2E-04G"` -- custom GLB reaches the custom 3D renderer route; green.
- `pnpm --filter web lint && pnpm --filter web typecheck && pnpm --filter web build` -- green.
- Full Playwright mobile browser suite: 84 green; production PWA suite: 3 green (separate temporary port because 4175 was occupied).
- Targeted mutation: `custom-glb-runtime-loader.ts` 56 killed / 2 survived / 3 timeout of 61; `glb-texture-materialization.ts` 79 killed / 6 survived of 85. The survivors are equivalent defensive forms (the enclosing safe-error path preserves the same unavailable result); both scores exceed the configured 80% high threshold.

This evidence proves common local runtime preparation and branch/status behavior. It does **not** prove pixel-identical output on a physical device, renderer context-loss/recreation with a real textured fixture, or the full clean-profile Portable Backup/reopen roundtrip required to close `IMP-02`.
