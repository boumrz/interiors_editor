---
baseline_commit: NO_VCS
---

# Story 2.5: Изменить толщину Wall без подмены Room height

Status: done

## Story

Как пользователь,
я хочу задать толщину Wall в миллиметрах,
чтобы план отражал реальные строительные dimensions.

## Minimal Alpha Acceptance Criteria

1. Пользователь выбирает существующую Wall и подтверждает integer-mm thickness
   в hard product limits. Centerline, endpoints, Wall identity, Room identity и
   `Room.heightMm` остаются canonical; usable polygon, area/perimeter, Plan и 3D
   пересчитываются из одного Project.
2. Нечётная толщина поддерживается exact half-mm derived arithmetic. Значения
   вне preferred range предупреждаются, а не отклоняются; hard-limit,
   too-short Wall, collapsed usable polygon и unresolved Opening/Item host
   отклоняются атомарно с применимым reason/fix и без Durable Revision.
3. Detached/open-plan Wall редактируется по тем же правилам без выдуманной Room;
   наружная/незамкнутая высота остаётся derived default height.
4. Разные допустимые толщины последовательных WallSegment используют
   deterministic offset/join с miter cap и bevel, не меняя centerline Face
   fingerprint.
5. Confirmed edit публикует ровно одну Durable Revision, переживает reload и
   остаётся доступным с phone-first inspector; no-op не создаёт историю.

## Tasks / Subtasks

- [x] Провести существующий selected-Wall thickness edit через domain,
      application, controller, phone inspector и durable publication.
- [x] Сохранить centerline/endpoints, Room ID/height и повторно построить Plan/3D.
- [x] Атомарно отклонять известный rectangular/concave usable collapse.
- [x] Закрыть все Story-local findings независимого code review.
- [x] Пройти focused/full unit, typecheck, lint, build, phone E2E, PWA и mutation
      gates.
- [x] Провести независимый финальный re-review и перевести Story в `done`.

### Review Findings

- [x] [Review][Patch] Принимать весь hard range 20–1000 мм, включая нечётные
      integer-mm значения, и показывать warning только вне preferred 50–500 мм
      [apps/web/src/domain/general-wall-project.ts:3123]
- [x] [Review][Patch] Повторно проверять `wall length > thickness` до
      materialization/publication [apps/web/src/domain/general-wall-project.ts:759]
- [x] [Review][Patch] Разрешить thickness edit для detached/open-plan Wall без
      ложного `ROOM_USABLE_AREA_COLLAPSE` [apps/web/src/domain/general-wall-project.ts:782]
- [x] [Review][Patch] Проверять retained FloorPlacement одновременно против
      expanded wall body и exact recomputed usable polygon, включая concave Face
      [apps/web/src/domain/general-wall-project.ts:775]
- [x] [Review][Patch] Поддержать unequal thickness на последовательных
      collinear WallSegment и canonical miter-cap/bevel joins
      [apps/web/src/domain/derived-orthogonal-plan-faces.ts:765]
- [x] [Review][Patch] Не включать derived thickness/insets в durable
      centerline `faceFingerprint` [apps/web/src/domain/general-wall-project.ts:2894]
- [x] [Review][Patch] Пересчитывать и показывать area/perimeter для polygonal
      usable Room, а не скрывать measurements [apps/web/src/ui/room-measurement.ts:17]
- [x] [Review][Patch] Вернуть canonical thickness/collapse reason codes и
      mutation-neutral reason/fix copy вместо текста про удаление
      [apps/web/src/ui/AppShell.tsx:646]
- [x] [Review][Patch] Очищать stale validation на valid no-op и связывать
      selected-thickness input с `dimension-error` через accessibility state
      [apps/web/src/ui/AppShell.tsx:7477]
- [x] [Review][Patch] Не публиковать meaningless Durable Revision при unchanged
      thickness вне UI guard [apps/web/src/application/general-wall-project-mutations.ts:180]
- [x] [Review][Patch] Усилить phone E2E: centerline/endpoints, Room height,
      polygon measurements, 3D/reload и atomic rejection с unchanged revision
      [apps/web/tests/browser/editor-workspace-e2e.spec.ts:3846]
- [x] [Review][Defer] Перенести общий general PlanGraph mutation route с
      schema-V1 controller boundary на полностью adopted domain-owned boundary
      [apps/web/src/app/project-controller.ts:391] — deferred, pre-existing

## Dev Notes

- Trace: `CAP-2`, `CAP-3`; `FR-10`; `NFR-1`, `NFR-3`, `NFR-4`, `NFR-26`;
  `AD-1`, `AD-2`, `AD-3`, `AD-6`, `AD-7`, `AD-12`, `AD-22`; `V-05`.
- `WallSegment` is a centerline. Thickness is a dimension, not a second geometry
  source. `Room.heightMm` remains the only editable height source.
- Opening-aware validation already exists in the current Project route; future
  Opening topology expansion must not create implicit partial state here.

## Dev Agent Record

### Completion Notes

- **Pre-review evidence — 2026-08-27.** Existing implementation can edit a
  selected 100 mm Wall to 120/200 mm, publish one local revision, preserve
  centerline vertices and Room ID/height, survive reload and update Plan/3D.
  Rectangular and exact concave collapse fixtures reject without mutating the
  source Project.
- **Independent review — 2026-08-27.** Blind, edge-case and acceptance layers
  all completed. Findings were deduplicated and re-rated against current call
  sites and canonical contracts; 11 Story-local patches were accepted, while
  the repository-wide schema-boundary migration is recorded as pre-existing
  deferred work.
- **Final closure — 2026-08-27.** Exact recomputed usable polygons now own the
  retained rotated-item decision; a changed wall cannot expand into another
  Wall's Door/Window, while its own Opening remains valid. Negative/unsafe
  dimensions use `INVALID_DIMENSION`, odd-thickness derived lengths use
  nearest-integer-mm half-up presentation, and the AC2 `wall length > thickness`
  guard remains explicit. Final evidence: 1534/1534 Rstest, clean Biome, both
  TypeScript configurations, production build, 149 passing mobile scenarios
  with the sole live-PostgreSQL environment case skipped, 5/5 PWA, and 81.18%
  focused mutation across 356 mutants. Final re-review has no unresolved
  Story-local finding; the AD-22 schema-boundary migration remains the recorded
  repository-wide deferral.

### File List

- `_bmad-output/implementation-artifacts/2-5-change-wall-thickness-without-replacing-room-height.md`
- `apps/web/src/domain/general-wall-project.ts`
- `apps/web/src/domain/general-wall-project.test.ts`
- `apps/web/src/domain/derived-orthogonal-plan-faces.ts`
- `apps/web/src/domain/derived-orthogonal-plan-faces.test.ts`
- `apps/web/src/domain/parametric-item.ts`
- `apps/web/src/domain/project-json-transfer.ts`
- `apps/web/src/domain/project-json-transfer.test.ts`
- `apps/web/src/domain/measurement-format.ts`
- `apps/web/src/domain/measurement-format.test.ts`
- `apps/web/src/application/general-wall-project-mutations.ts`
- `apps/web/src/application/general-wall-project-mutations.test.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/ui/room-measurement.ts`
- `apps/web/src/ui/room-measurement.test.tsx`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.test.tsx`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `apps/web/stryker.story-2-5-review.config.mjs`

### Change Log

- 2026-08-27: Created the missing implementation artifact and recorded the
  independent Story 2.5 review findings before patching.
- 2026-08-27: Closed the accepted findings, passed final automated evidence and
  independent re-review, and moved Story 2.5 to `done`.
