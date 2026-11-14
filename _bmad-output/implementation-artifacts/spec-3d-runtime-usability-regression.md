---
title: 'Рабочий 3D: реальные GLB-модели и предсказуемые жесты'
type: 'bugfix'
created: '2026-08-29'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/spec-interiors-editor-alpha/asset-import-contract.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-approved restoration of usable 3D workspace — do not modify unless human renegotiates">

## Intent

**Problem:** В 3D валидный и уже pinned GLB отображается только процедурным габаритным блоком, хотя байты успешно скачиваются и проходят проверку. Одновременно действия камеры и предметов зависят от неочевидной точки касания и скрытого подтверждения, из-за чего пользователь не может надёжно осмотреть или переставить интерьер.

**Approach:** Восстановить одну disposable WebGL2-проекцию комнаты, которая показывает валидную GLB-модель в канонических габаритах, а также сделать режимы камеры и предмета явно доступными и проверить их на реальном мобильном браузерном пути через публичный туннель.

## Boundaries & Constraints

**Always:** Сохранить canonical Project и integer-mm геометрию неизменными; GLB bytes проходят существующие preflight, hash, pin и backup-policy до durable placement. Engine objects, загрузка и камеры остаются disposable UI/renderer projection; decoder error не создаёт Revision и честно оставляет fallback-габарит с доступным повтором. WebGL2 остаётся alpha baseline, а текущие контекст-loss/disposal guarantees не ослабляются.

**Ask First:** Новый формат ресурса, изменение security/size limits GLB, Project schema, durable storage/backup policy, ресурсные лицензии либо выбор иной 3D-платформы.

**Never:** Не загружать сетевые bytes из renderer, не сериализовать Three.js/WebGL objects, не обходить exact-byte validation, не делать предмет или камеру автоматически durable без явного confirm, не заявлять physical-device certification на основании эмулятора.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid placed GLB | Resource is verified and an item references its definition | The 3D room draws the decoded model, positioned, rotated and scaled to the item's canonical bounds. | Geometry fallback remains available until the runtime model is ready. |
| Runtime unavailable | Bytes are missing, corrupt, or runtime decoding fails | The item stays visible as its exact greybox; status identifies the unavailable model. | No Project, History, or pinned bytes change; retry/re-import route remains truthful. |
| Camera inspection | User drags free 3D canvas or uses two-finger gesture | Free one-finger drag orbits; two-finger gesture zooms and pans without selecting/moving an item or creating a Revision. | Gestures are released on cancel/context loss. |
| Item manipulation | User selects an item, then drags or uses its rotation control | Move/rotation preview follows the gesture and becomes durable only after the existing explicit confirm. | Cancel restores the durable pose; no camera gesture is swallowed by an inactive control. |

</frozen-after-approval>

## Code Map

- `apps/web/src/adapters/renderer/rectangular-room-projection.ts` -- maps canonical item addresses and bounds to disposable scene data.
- `apps/web/src/adapters/renderer/webgl2-room-renderer.ts` -- current raw WebGL2 room renderer, which presently ignores `customGlbModels` and draws greyboxes.
- `apps/web/src/ui/RoomScene3d.tsx` -- owns camera, pointer routing, renderer lifecycle and user-visible 3D status.
- `apps/web/src/ui/custom-glb-runtime-loader.ts` -- safe local decoder, materialization and bounds validation for already-admitted bytes.
- `apps/web/src/ui/CustomGlbPreview.tsx` -- working isolated Three-based GLB preview whose lifecycle informs the room integration.
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts` -- iPhone-emulated end-to-end coverage for camera and item gestures.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/ui/RoomScene3d.tsx` and renderer integration -- render verified GLB roots in the room from local resource bytes, preserve lifecycle/disposal and expose loading, ready and fallback states.
- [x] `apps/web/src/ui/RoomScene3d.tsx` -- make camera-orbit, two-finger pan/zoom, item select/move and rotation target routing unambiguous while keeping durable confirmation semantics.
- [x] `apps/web/src/ui/*.test.tsx` and `apps/web/tests/browser/editor-workspace-e2e.spec.ts` -- add failing regression coverage for the rendered GLB route, all camera gestures and direct item manipulation, including failure/cancel boundaries.
- [x] `apps/web/src/adapters/renderer/*.test.ts` -- prove the raw fallback is used only while no valid runtime model exists and renderer disposal remains safe.

**Acceptance Criteria:**
- Given a verified catalog or custom GLB has been placed, when the user opens 3D, then the room shows its actual model with its materials at the durable position, orientation and dimensions rather than only a generic box.
- Given a user opens 3D on phone, when they drag unobstructed canvas, pinch-pan, or interact with a selected item, then each expected camera or item action responds immediately and only item confirmation changes the Durable Revision.
- Given GLB runtime preparation or a WebGL context fails, when the user keeps inspecting the project, then the exact fallback and recovery message are visible, the app stays usable, and durable data is unchanged.

## Design Notes

The repair must share the already-hardened GLB runtime loader rather than introduce a second parser or fetch path. Renderer engine objects are recreated from `RectangularRoomWebGlScene` plus verified local resources; the projection describes the model's stable definition address, while the renderer owns object lifetime and GPU cleanup.

## Verification

**Commands:**
- `pnpm --filter @interiors/web test -- --run src/ui/RoomScene3d.test.tsx src/ui/custom-glb-runtime-loader.test.tsx` -- targeted RED/GREEN and renderer-lifecycle behaviours pass.
- `PLAYWRIGHT_BASE_URL=https://coffee-moderator-healthcare-personally.trycloudflare.com pnpm exec playwright test --config playwright.config.mjs --grep 'EDITOR-E2E-03|ITEM-E2E'` -- mobile browser flow verifies camera and model/item path through the tunnel.
- `pnpm --filter @interiors/web lint && pnpm --filter @interiors/web typecheck && pnpm --filter @interiors/web test` -- static and full regression suites pass.
- `pnpm --filter @interiors/web test:mutation` -- report and resolve changed-code survivors or document equivalent mutations.

## Suggested Review Order

**Reliable 3D entry and verified resource handoff**

- Eagerly loads the 3D route so a tunnel cold start cannot strand the user in a fallback.
  [`AppShell.tsx:97`](../../apps/web/src/ui/AppShell.tsx#L97)

- Passes only byte-verified local resources into the disposable 3D scene.
  [`AppShell.tsx:9433`](../../apps/web/src/ui/AppShell.tsx#L9433)

- Decodes, retries and evicts GLB roots without changing project data.
  [`RoomScene3d.tsx:330`](../../apps/web/src/ui/RoomScene3d.tsx#L330)

- Makes orbit, pinch, select-before-move and cancellation explicit and safe.
  [`RoomScene3d.tsx:785`](../../apps/web/src/ui/RoomScene3d.tsx#L785)

**Disposable Three/WebGL projection**

- Renders local model roots on the existing WebGL2 canvas, preserving lifecycle ownership.
  [`three-webgl2-room-renderer.ts:48`](../../apps/web/src/adapters/renderer/three-webgl2-room-renderer.ts#L48)

- Preserves canonical elevation and exact polygonal room floors in the Three scene.
  [`three-webgl2-room-renderer.ts:218`](../../apps/web/src/adapters/renderer/three-webgl2-room-renderer.ts#L218)

- Carries host class and canonical bounds into the renderer-only item projection.
  [`rectangular-room-projection.ts:33`](../../apps/web/src/adapters/renderer/rectangular-room-projection.ts#L33)

**Regression evidence**

- Covers actual decoded GLB presence, healthy renderer diagnostics and tunnel-safe cleanup.
  [`project-e2e.spec.ts:2715`](../../apps/web/tests/browser/project-e2e.spec.ts#L2715)

- Covers free orbit, two-finger inspection and select-before-move behaviour on a phone viewport.
  [`editor-workspace-e2e.spec.ts:4298`](../../apps/web/tests/browser/editor-workspace-e2e.spec.ts#L4298)

- Proves decoded roots leave the cache when their active resource leaves the scene.
  [`custom-glb-runtime-cache.test.tsx:36`](../../apps/web/src/ui/custom-glb-runtime-cache.test.tsx#L36)
