---
title: "Sprint change proposal — remove Room selection from Plan and 3D"
status: approved
date: 2026-08-22
decision_owner: Roman Zheltov
approval: "Product Owner explicitly approved removal and further development in the 2026-08-22 task."
scope: moderate
affected_capabilities:
  - CAP-3
  - CAP-5
affected_requirements:
  - FR-16
  - FR-21
  - FR-23
  - FR-34
  - FR-36
affected_decisions:
  - AD-1
  - AD-5
  - AD-10
  - AD-12
sources:
  - ../specs/spec-interiors-editor-alpha/SPEC.md
  - prds/prd-InteriorsEditor-2026-07-26/prd.md
  - architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - epics.md
  - roadmap-to-alpha.md
---

# Решение

Удалить из текущей Alpha выбор derived Room в Plan и 3D. В частности,
пользователь больше не видит 3D Room picker/список/сводку/кнопку снятия выбора
и не получает 2D selected-Room property card. Касание поверхности Room не
создаёт selection, Command, Revision или session-history entry.

# Что сохраняется

- `Room` остаётся derived face с устойчивым `roomId`; его usable polygon,
  измерения, высота, SurfaceAddress и 2D/3D projection не удаляются.
- Выбор Wall и ItemInstance остаётся самостоятельной интеракцией. Выбор
  ItemInstance в 3D реализуется только в его собственной Story 5.4/V-10.
- Canonical command `UpdateRoomProperties` и Room metadata остаются совместимыми
  domain/persistence data; этот change не мигрирует и не портит проекты.

# Изменение backlog

- Story 4.2/V-03 теперь покрывает camera orbit/pan/zoom, cutaway и recovery
  без Room-surface selection.
- Story 3.2 сохраняет доменный контракт metadata, но её пользовательский flow
  не возвращается в Plan/3D canvas.
- Stories 6.2–6.3 сохраняют точные `Floor(RoomId)`/`Ceiling(RoomId)` addresses,
  но ожидают отдельный не-canvas маршрут выбора адреса.

# Acceptance для этой итерации

1. В 3D отсутствуют `Помещение 3D`, `Выбрать помещение в 3D`, селектор,
   summary и действие снятия выбора.
2. В 2D отсутствует `Свойства выбранного помещения` и касание Room не открывает
   такую панель.
3. Прямой tap/gesture по Room не меняет durable-revision count и не создаёт
   history entry.
4. Орбита 3D, cutaway, статические Room measurements, Wall/Item interactions и
   projections сохраняют свои независимые контракты.
5. `EDITOR-E2E-03C` и `EDITOR-E2E-03D` закрепляют отсутствие selection
   соответственно в 3D и 2D; `ROOM-E2E-01` остаётся зарезервированным для
   Story 3.1 outer/void/lineage corpus.

# Redesign reservation

Редизайн намеренно **не реализован** в этой итерации: нет новых визуальных
паттернов, компонентов или изменения доменной модели. Когда Product Owner
даст требования, сначала создаётся отдельный UX/redesign scope. Он обязан
сохранить phone-first safe areas, 44px targets, canonical Room/SurfaceAddress,
durable mutation path и эти no-Room-selection regressions; не может неявно
вернуть Room picking на Plan или 3D canvas.
