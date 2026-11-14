---
baseline_commit: NO_VCS
---

# Story 2.6: Удалить Wall или Vertex с preview последствий

Status: done

## Story

Как пользователь,
я хочу увидеть последствия удаления до commit,
чтобы не сломать план случайным действием.

## Minimal Alpha Acceptance Criteria

1. Выбранная на canvas Wall предоставляет действие `Удалить стену`, а
   поддерживаемая redundant inline Vertex — однозначное действие `Удалить
   вершину` из панели выбранной Wall.
2. Любое удаление сначала открывает transient consequence preview. Для простой
   Wall он явно сообщает, что Rooms, Openings и Items не затрагиваются; для
   destructive outcome перечисляет точные affected Room/Opening/Item IDs и
   необходимые delete/merge choices. Vertex preview объясняет допустимое
   объединение двух прямых частей.
3. Cancel не меняет Project, History или локальное сохранение. Confirm повторно
   проверяет current Durable Revision и writer fence, выполняет discovery и
   публикует ровно один atomic reversible Durable command.
4. При объединении Rooms пользователь обязан выбрать predecessor, чьи
   ID/name/type/height/history сохранятся. Hosted Opening/floor or wall Item
   удаляется только как явно показанная часть того же atomic outcome.
5. Удаление redundant inline Vertex сохраняет durable ID первой Wall piece и
   корректно rehost-ит допустимый wall Item; corner/junction, unequal thickness,
   non-collinear pieces и Opening host отклоняются без partial state.
6. Missing/stale/invalid target, изменившийся consequence set или потерянный
   writer fence сохраняют последнюю Durable Revision и дают понятный reason.
   Подтверждённый result переживает reload и остаётся canonical PlanGraph для
   Plan/3D.

## Tasks / Subtasks

- [x] Реализовать selected-Wall и eligible redundant-Vertex delete actions.
- [x] Показывать consequence preview и cancel до любой Wall/Vertex публикации.
- [x] Перечислять affected Rooms, Openings и floor/wall Items и требовать явный
      Room metadata choice при merge.
- [x] Повторно проверять fresh base/fence и публиковать один atomic outcome.
- [x] Сохранить stable Wall ID и rehost допустимого wall Item при inline-Vertex
      merge.
- [x] Отклонять stale/invalid/non-deletable topology без Revision или dangling
      reference.
- [x] Доказать phone selection, cancel, confirm, reload и host outcomes через
      focused automated evidence.

### Review Findings

- [x] [Review][Patch] Room-only deletion must open destructive consequence preview [apps/web/src/domain/general-wall-project.ts:624]
- [x] [Review][Patch] Unequal Room heights must be resolved by explicit predecessor choice [apps/web/src/domain/general-wall-project.ts:2625]
- [x] [Review][Patch] Redundant inline Vertex deletion must support alpha 45-degree Walls [apps/web/src/domain/general-wall-project.ts:1685]
- [x] [Review][Patch] Inline-Vertex merge must preserve the physical host of Items on a reversed surviving Wall [apps/web/src/domain/general-wall-project.ts:1667]
- [x] [Review][Patch] Inline-Vertex deletion must preserve unchanged polygonal Rooms [apps/web/src/domain/general-wall-project.ts:1535]
- [x] [Review][Patch] Wall deletion must rehost valid Opening and wall-Item hosts affected by canonical coalescing [apps/web/src/domain/general-wall-project.ts:559]
- [x] [Review][Patch] Wall and Vertex deletion confirmation must CAS against the previewed Durable Revision [apps/web/src/application/general-wall-project-mutations.ts:378]
- [x] [Review][Patch] Direct domain wall deletion must not choose merged Room metadata without an explicit predecessor [apps/web/src/domain/general-wall-project.ts:2925]
- [x] [Review][Patch] Floor-Item consequence discovery and rehost must use exact Room lineage instead of an axis-aligned footprint approximation [apps/web/src/domain/general-wall-project.ts:2655]
- [x] [Review][Patch] Destructive preview must list exact affected Room, Opening and Item IDs and disambiguate Room predecessor metadata.
- [x] [Review][Patch] Preview must bind its exact Durable Revision, reload current state after CAS rejection and close across navigation/history/takeover/restart.
- [x] [Review][Patch] Vertex actions must distinguish both eligible endpoints and disclose affected wall-Item identities.
- [x] [Review][Patch] Wall/Vertex consequence panels must receive accessible focus and remain scrollable on a phone viewport.

## Dev Notes

- Trace: `CAP-2`, `CAP-3`, `CAP-8`; `FR-11`, `FR-12`, `FR-38`–`FR-40`;
  `NFR-1`, `NFR-3`, `NFR-4`, `NFR-26`; `AD-1`, `AD-2`, `AD-3`, `AD-6`,
  `AD-7`, `AD-12`, `AD-19`; `V-05`.
- Canonical deletion works only over the integer-mm PlanGraph. Preview/UI state
  is disposable; only the confirmed fenced publication becomes a Revision.
- General arbitrary junction deletion, automatic rehome to unrelated hosts and
  the complete S-2/physical-device/independent-review corpus remain separate
  topology and release gates, not hidden extensions of this minimal story.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Existing domain/application paths
  already covered exact Room/Opening/Item discovery, stale-set rejection,
  explicit Room metadata retention, atomic Wall deletion and safe redundant
  inline-Vertex merge. The closure audit found two user-facing gaps: the Vertex
  action did not use the story label, and a Wall without dependent hosts was
  deleted immediately. RED-first mobile scenarios now require `Удалить
  вершину` and require every Wall deletion to expose preview/cancel before
  confirm. Production UI implements both without changing canonical geometry.
- Final focused evidence is 194/194 Rstest checks across domain, application,
  controller and AppShell, plus 8/8 iPhone-13 browser-emulation scenarios in one
  clean run through the external Cloudflare tunnel. Changed-file Biome, both
  TypeScript configurations and production Rspack build pass.
- Before the final clean run, Cloudflare exceeded one 5-second 3D lazy-load
  assertion and exposed the valid catalog state `Загрузить и разместить` while
  the old helper waited only for the ready-state label. The 3D scenario passed
  after warm-up; the helper now accepts both product states and waits for the
  asynchronous catalog close. No geometry behavior was relaxed. Automated
  Stryker scope excludes UI; the two preserved RED runs are the direct
  behavioral mutation evidence for these UI changes, and no numeric mutation
  score is claimed.
- **Independent review closure — 2026-08-28.** Three read-only review layers
  found stale-preview, exact-ID, diagonal-Vertex, Room-lineage and host-rehome
  gaps. All accepted findings are patched. Confirmation is now bound to the
  previewed Revision, CAS rejection reloads the actual Durable base, exact
  affected IDs and Room predecessor metadata are visible, and phone panels are
  focused and scrollable. Final evidence: 1540/1540 Rstest, both TypeScript
  configurations, clean 259-file Biome lint, production Rspack build, 150/150
  ordinary mobile scenarios plus one environment-skipped live catalog test,
  5/5 production PWA scenarios and 84.00% focused mutation (147/175).

### File List

- `_bmad-output/implementation-artifacts/2-6-delete-wall-or-vertex-with-consequence-preview.md`
- `apps/web/src/domain/general-wall-project.ts`
- `apps/web/src/domain/general-wall-project.test.ts`
- `apps/web/src/application/general-wall-project-mutations.ts`
- `apps/web/src/application/general-wall-project-mutations.test.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.module.css`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `apps/web/stryker.story-2-6-review.config.mjs`

### Change Log

- 2026-08-26: Created the missing implementation artifact, completed universal
  Wall/Vertex consequence preview, aligned the Vertex action label and moved
  Story 2.6 to `review`.
- 2026-08-28: Applied every accepted independent-review patch, completed full
  unit/browser/PWA/mutation gates and moved Story 2.6 to `done`.
