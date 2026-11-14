---
document_title: "Sprint Change Proposal — удаление прогулки по помещениям"
status: approved
date: 2026-08-22
owner: Roman
mode: batch
approval: "Product Owner explicitly approved full execution in chat on 2026-08-22."
sources:
  - specs/spec-interiors-editor-alpha/SPEC.md
  - planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
  - planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - planning-artifacts/epics.md
  - planning-artifacts/roadmap-to-alpha.md
  - implementation-artifacts/sprint-status.yaml
---

# Sprint Change Proposal — удаление прогулки по помещениям

## Решение

Из Alpha полностью исключается feature «Прогулка по помещениям»: read-only
first-person режим, переход через межкомнатную Door, derived `WalkEdge` /
`AdjacencyGraph`, специальные controls и камеры. Это не временное скрытие UI.

Двери и окна остаются wall-hosted `Opening`: их геометрия, размеры, host
validation, 2D/3D projection и reconciliation после изменения Wall сохраняются.
Derived Rooms, обычный 3D inspect/edit и режим «Фокус» также сохраняются;
«Фокус» применяется только к Plan и 3D.

## Обоснование и классификация

Product Owner 2026-08-22 определил прогулку как полностью ненужную. Изменение
уменьшает alpha scope без потери сценария планировки: пользователь продолжает
создавать комнаты, размещать предметы и осматривать проект в 3D. Это
**moderate scope correction**: затрагивает текущие contracts, Story 4.3 и
изолированную runtime-ветку, но не меняет формат Project или backup.

## Контрактные изменения

| Область | До | После |
| --- | --- | --- |
| CAP-4 / FR-17–19 | Door могла создавать navigation edge | Door/Window — только валидируемые проёмы на Wall |
| FR-20 | transition через Door | удалён |
| FR-24 | first-person Walk Mode | удалён |
| CAP-5 / FR-53 | 2D, 3D, Walk и Focus | 2D, 3D и Focus только для этих двух представлений |
| Architecture | AD-6 и projection создают `AdjacencyGraph` | topology выводит Room/Opening effects без navigation graph |
| Epic 4 | Story 4.3 / V-08 | удалены; 3D inspection/edit остаётся |

Исторические review, старые readiness reports и append-only `.memlog.md` не
переписываются: они остаются evidence ранее принятого scope. Новые текущие
документы ссылаются на это proposal как на supersession.

## Реализация и верификация

1. `bmad-spec` append-only фиксирует решение и re-derives SPEC companions.
2. PRD, Architecture, UX, epics, roadmap, traceability и sprint status удаляют
   promise/план Walk, не удаляя технический термин *bounded face walk*.
3. Удаляются `room-walk-adjacency`, first-person branches в `RoomScene3d`,
   walk-camera renderer path, Walk UI/CSS и их tests/E2E.
4. Полный unit, type, lint, production build, mobile browser/PWA E2E и
   proportional mutation check подтверждают, что 3D inspect и Door/Window
   regression не затронуты.

## Неизменные границы

- Нет схемной миграции: Walk никогда не сериализовался в Project или backup.
- Не удалять face traversal в geometry kernel: это алгоритмический термин, а
  не пользовательская функция.
- Не удалять Door/Window geometry, Opening validation, derived Rooms или
  нормальный orbit/pan/zoom 3D.
- Story 4.3 и `V-08` больше не являются частью alpha definition; их прежняя
  реализация будет удалена, а не перенесена в backlog.
