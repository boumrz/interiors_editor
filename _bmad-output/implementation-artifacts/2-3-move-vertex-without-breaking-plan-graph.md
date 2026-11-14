---
baseline_commit: NO_VCS
---

# Story 2.3: Переместить Vertex без нарушения PlanGraph

Status: done

## Story

Как пользователь,
я хочу переместить вершину или связанную стену прямо на плане телефона,
чтобы исправить геометрию без пересборки помещения.

## Minimal Alpha Acceptance Criteria

1. Выбранная поддерживаемая Wall показывает доступные touch-handles вершины
   поверх wall hit-area; действие не требует прямого ввода глобальных координат.
2. Gesture проецируется на единственную безопасную ось, сохраняющую направления
   0/45/90°, и выдаёт integer-mm candidate без изменения текущего Project.
3. Preview остаётся transient. Cancel не создаёт Revision; confirm передаёт
   один `MoveVertex`/`MoveWall` intent через общий topology validator и atomic
   durable publication.
4. Поддерживаемый closed-Room corner сохраняет Room identity и `heightMm`;
   detached cardinal/45-degree endpoint и связанная Wall сохраняют unrelated
   graph state. После reload Plan и 3D получают тот же canonical PlanGraph.
5. Invalid direction, unchanged/out-of-bounds point, unusable Room collapse и
   unresolved Item/Opening host отклоняются до публикации со stable reason;
   source Project остаётся неизменным. Неподдерживаемые junction/mixed-axis
   handles не предлагаются как рабочий жест.
6. Focused domain/application/UI tests и mobile-browser E2E доказывают direct
   touch, cancel, one-revision confirm, rejection safety и reopen behavior.

## Tasks / Subtasks

- [x] Реализовать canonical `MoveGeneralVertex` validation и durable use case.
- [x] Добавить direct-touch handle, constrained preview и explicit
      confirm/cancel для поддерживаемой вершины.
- [x] Поддержать detached cardinal/45-degree endpoint и equal-leg closed-Room
      corner без arbitrary-angle approximation.
- [x] Поддержать прямой touch-перенос выбранной cardinal/45-degree Wall по её
      безопасной нормали.
- [x] Удалить из Alpha UI прямой numeric/global-coordinate path по решению
      Product Owner; integer-mm geometry остаётся внутренним контрактом.
- [x] Доказать non-durable cancel/reject, atomic confirm, Room metadata
      continuity, reload и 3D projection.

### Review Findings

- [x] [Review][Patch] Не допускать WallSegment короче минимально разрешённой длины после `MoveVertex` [`apps/web/src/domain/general-wall-project.ts:1280`]
- [x] [Review][Patch] Перепроверять каждый wall-hosted Item после изменения длины или геометрии его Wall [`apps/web/src/domain/general-wall-project.ts:1298`]
- [x] [Review][Patch] Проверять rotated floor footprint и новое тело перемещённых стен против фактического usable Room, включая polygonal Room [`apps/web/src/domain/general-wall-project.ts:1213`]
- [x] [Review][Patch] Привязать transient move-draft к текущей Project revision и сбрасывать его после undo/redo либо другой durable publication [`apps/web/src/ui/AppShell.tsx:1394`]
- [x] [Review][Patch] Не показывать перенос cardinal Wall, который домен гарантированно отклонит из-за collinear-соседа [`apps/web/src/ui/AppShell.tsx:5194`]
- [x] [Review][Patch] Квантизовать touch-перенос Vertex/Wall по origin-relative шагу 100 мм вместо случайного округления до 1 мм [`apps/web/src/ui/wall-vertex-move.ts:105`]
- [x] [Review][Patch] Увеличить touch-target Vertex handle до минимальных 44 CSS px независимо от zoom [`apps/web/src/ui/AppShell.tsx:3716`]
- [x] [Review][Patch] Добавить настоящий touch E2E и точную reopen-проверку canonical moved geometry вместо mouse-only drag и поверхностного 3D smoke [`apps/web/tests/browser/editor-workspace-e2e.spec.ts:1784`]
- [x] [Review][Defer] Перевести общий mutation publication path на exact-base revision CAS [`apps/web/src/application/general-wall-project-mutations.ts:326`] — deferred, pre-existing; текущий controller сериализует команды, а writer fence закрывает межконтекстную запись, поэтому это общий AD-3/AD-4 hardening, а не локальный blocker Story 2.3.

## Dev Notes

- Trace: `CAP-2`, `CAP-3`, `CAP-8`; `FR-9`, `FR-12`; `NFR-1`–`NFR-5`,
  `NFR-26`; `AD-1`, `AD-2`, `AD-3`, `AD-7`, `AD-12`, `AD-19`; `V-05`.
- Canonical state remains `Project.level.vertices` and `wallSegments` in
  integer millimetres. Gesture coordinates, handles and previews are disposable
  projection state.
- General junction rewrites, Wall split/join lineage and hosted reconciliation
  continue in Stories 2.4, 3.4 and 5.3. Complete S-2/device evidence and
  independent review remain gates, not extra implementation scope for this
  minimal direct-move story.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** The existing production path meets
  the approved walking skeleton: a phone user selects a supported Wall, arms
  direct manipulation, drags an eligible endpoint/corner or the related Wall,
  reviews a constrained integer-mm candidate, and explicitly cancels or
  publishes exactly one Durable Revision. A closed concave Room corner moves
  onto its exact shared 45-degree line while preserving Room ID/height across
  reload and 3D. Unsupported mixed-axis/junction gestures stay unavailable;
  canonical validation rejects invalid/collapsed/host-conflict outcomes without
  changing the source Project.
- Closure rerun: 111/111 focused Rstest checks across domain, application and
  UI; 6/6 iPhone-13 browser-emulation scenarios through the external tunnel.
  The last source-changing closed-corner increment already recorded both
  TypeScript configurations, Biome, production build and 94.44% focused
  mutation evidence. No production code changed in this closure checkpoint.
- **Review closure — 2026-08-27.** All eight accepted patches are implemented.
  MoveVertex/MoveWall now reject segments at or below wall thickness, recheck
  wall/floor Item hosts, rotated and polygonal usable-floor containment, and
  cardinal/45-degree wall-body collisions before publication. Touch candidates
  use an origin-relative 100-mm grid; a 44-CSS-px hit target stays stable across
  zoom, collinear-invalid wall moves stay hidden, and any Project revision
  change discards the transient move draft.
- Final evidence: 153/153 focused and 1491/1491 full Rstest; warning-free Biome
  over 259 files; both TypeScript configurations; production Rspack build;
  148/149 mobile-browser scenarios with the sole live-PostgreSQL scenario
  environment-skipped and zero failures; 5/5 production PWA. Focused Stryker
  killed 237/246 mutants (96.34%; UI 100%); the nine survivors are equivalent
  defensive branches for already-validated graph endpoints or zero-area wall
  bodies. The external phone tunnel returned HTTP 200. No physical-device or
  release-readiness claim is added.

### File List

- `_bmad-output/implementation-artifacts/2-3-move-vertex-without-breaking-plan-graph.md`
- `apps/web/src/domain/general-wall-project.ts`
- `apps/web/src/domain/general-wall-project.test.ts`
- `apps/web/src/domain/parametric-item.ts`
- `apps/web/src/domain/parametric-item.test.ts`
- `apps/web/src/application/general-wall-project-mutations.ts`
- `apps/web/src/application/general-wall-project-mutations.test.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/ui/wall-vertex-move.ts`
- `apps/web/src/ui/wall-vertex-move.test.tsx`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.module.css`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `apps/web/stryker.story-2-3-review.config.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-08-26: Reconciled the already-delivered minimal Alpha path, created the
  missing implementation artifact and moved Story 2.3 to `review` after the
  focused closure rerun passed.
- 2026-08-27: Applied all accepted code-review patches, completed the final
  full regression/mutation evidence and moved Story 2.3 to `done`.
