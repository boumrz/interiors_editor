---
baseline_commit: NO_VCS
---

# Story 3.2: Назвать, типизировать и задать высоту Room

Status: done

## Story

Как пользователь,
я хочу задать помещению имя, тип и высоту,
чтобы план отражал реальное назначение комнат и их физические свойства.

## Minimal Alpha Acceptance Criteria

1. Отдельный non-canvas flow «Помещения» перечисляет только текущие derived
   Rooms и адресует выбранную запись по stable `roomId`. Касание Room на Plan
   или в 3D не создаёт selection, picker, property panel, Revision или History.
2. Property form редактирует только user metadata `name`, closed Alpha
   `Room.type` и integer `heightMm` 500–10 000 мм. Area, perimeter, width и
   depth остаются derived из canonical PlanGraph и не становятся полями формы.
3. Valid submit публикует все три свойства одной Durable command. Изменённые
   metadata и Room label переживают reload, а Plan/3D снова строятся из той же
   canonical Revision.
4. `Room.heightMm` остаётся единственным editable источником высоты Room.
   Высота Wall вычисляется из adjacent Rooms; отдельного wall-height editor нет.
5. Golden `shared-wall-height-opening-min` с Room 2400/2700 мм выводит shared
   Wall 2700 мм в domain и disposable 3D, а Opening-host policy использует
   нижнюю допустимую высоту 2400 мм.
6. Missing, invalid или rejected value сохраняет прежние durable metadata,
   возвращает поля к prior valid values, объявляет понятную причину через
   assistive technology и не создаёт autosave/Revision/History.

## Tasks / Subtasks

- [x] Сохранить существующий запрет Room selection на Plan и в 3D.
- [x] Добавить отдельный phone-first каталог derived Rooms без третьего ряда в
      ToolRail.
- [x] Адресовать выбранную Room по stable `roomId` и показать form name/type/
      height без geometry fields.
- [x] Опубликовать valid metadata одной существующей canonical command.
- [x] Возвращать invalid/rejected форму к prior valid metadata без Revision.
- [x] Проверить вторую из двух Rooms, reload, Plan label и 3D height через
      внешний phone tunnel.
- [x] Зафиксировать exact 2400/2700 shared-Wall golden в domain и renderer.

## Review Findings

- [x] [Review][Test] `EDITOR-E2E-03D` открывал 3D, но не выполнял касание
      сцены и поэтому не доказывал отсутствие 3D Room selection/picker/panel
      или Durable Revision. Сценарий усилен реальным касанием canvas и
      утверждениями для всех этих отсутствующих поверхностей.
- [x] [Review][Accessibility] Модальный каталог «Помещения» объявлял
      `aria-modal`, но Tab/Shift+Tab мог покинуть его и сфокусировать Plan под
      открытым диалогом. Циклическая граница первого/последнего enabled control
      теперь удерживает клавиатурный фокус внутри каталога; `ROOM-E2E-01A`
      покрывает оба направления.

## Dev Notes

- Trace: `CAP-3`; `FR-16`; `NFR-1`, `NFR-3`, `NFR-4`, `NFR-17`, `NFR-18`,
  `NFR-19`, `NFR-26`; `AD-1`, `AD-3`, `AD-6`, `AD-12`; `V-06`.
- Product Owner decision from 2026-08-22 remains authoritative: Room surfaces
  are display-only and never become an editor selection route. The new entry
  is a separate non-canvas action.
- Canonical geometry remains integer millimetres in PlanGraph. The Room form
  cannot accept width/depth, area, perimeter or Wall height.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Added a separate mobile
  «Помещения» dialog reachable from the plan without changing the compact
  two-row ToolRail. It lists current derived Rooms, chooses one stable
  `roomId`, edits only name/type/height and uses the already-fenced
  `UpdateRoomPropertiesUseCase` for exactly one durable publication.
- Invalid 499-mm input is announced, restores the prior 2600-mm field and
  creates no Revision. The browser scenario then changes the second of two
  Rooms to `Кухня / kitchen / 2800`, proves the first remains untouched,
  reloads the metadata and opens the updated 3D projection. The existing
  no-selection scenario confirms a real Plan Room tap and 3D view still expose
  no Room selection or accidental command.
- Renamed the exact domain and renderer golden coverage to
  `shared-wall-height-opening-min` and set its adjacent heights to 2400/2700
  mm. The shared wall derives 2700 mm in Plan and 2.7 m in disposable 3D;
  existing Opening tests prove the separate 2400-mm minimum host boundary.
- Final evidence: 1339/1339 Rstest, 249-file Biome, both TypeScript configs,
  production build, 3/3 adjacent iPhone-13 browser-emulation scenarios and a
  final isolated ROOM-E2E pass through the external tunnel. Stryker excludes
  TSX by repository policy, so a manual stable-room-address mutant was applied:
  forcing the first `roomId` made the E2E fail on the untouched-first-Room
  assertion; the mutant was then restored and the scenario passed.
- **Review evidence — 2026-08-28.** `EDITOR-E2E-03D` now taps the rendered
  3D canvas after the equivalent Plan interaction and proves that neither
  interaction exposes a Room selection/picker/property panel or adds a
  Durable Revision. Its focused mobile browser run passes (1/1).
- **Accessibility review patch — 2026-08-28.** The modal Room directory now
  cycles keyboard focus between its first and last enabled controls. The new
  focused `ROOM-E2E-01A` was RED before the patch and passes with the existing
  Room metadata and display-only Room-tap scenarios (3/3). Manual mutations
  of the Shift boundary and the forward focus target each make the scenario
  fail and were restored.

### File List

- `_bmad-output/implementation-artifacts/3-2-name-type-and-set-room-height.md`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.module.css`
- `apps/web/src/domain/derived-orthogonal-plan-faces.test.ts`
- `apps/web/src/adapters/renderer/rectangular-room-projection.test.ts`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-28: Independent acceptance reviewed all six Minimal Alpha AC and
  accepted Story 3.2. The acceptance records the current 1,584/1,584 Rstest,
  Biome lint, both TypeScript configurations and production build as local
  quality evidence; physical-device and release gates remain separate and are
  not claimed by this story.
- 2026-08-28: Strengthened the direct Room-tap acceptance evidence: the same
  mobile scenario now taps both Plan and rendered 3D surfaces and proves no
  selection route, property UI, picker or Durable Revision is created.
- 2026-08-28: Closed the keyboard focus-containment review finding for the
  modal «Помещения» directory without changing its room metadata or durability
  contract.
- 2026-08-26: Added the approved separate non-canvas Room metadata flow,
  strengthened exact shared-height golden evidence and moved Story 3.2 to
  `review`.
