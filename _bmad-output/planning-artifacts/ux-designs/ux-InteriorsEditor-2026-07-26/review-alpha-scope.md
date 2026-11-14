---
title: "Независимая UX-проверка: Alpha scope и interaction contracts"
status: completed
reviewed: 2026-08-30
reviewer: independent-alpha-scope-review
reviewed_artifacts:
  - DESIGN.md
  - EXPERIENCE.md
  - mockups/calm-spatial-studio-foundations-2026-08-29.png
  - mockups/calm-spatial-studio-workspace-2026-08-29.png
sources_checked:
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/editor-interaction-and-grid-contract.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - ../../project-context.md
---

# Результат

Визуальное направление **Calm Spatial Studio** совместимо с phone-first и
canvas-first Alpha. Однако пакет нельзя считать согласованным с Alpha
контрактами до устранения двух возвращённых retired scope и ряда неописанных
переходов между preview, durability, catalog и recovery. Этот отчёт ничего не
меняет в источниках истины, UX-документах и макетах.

Шкала: **Blocker** — возвращает запрещённый Alpha scope; **High** — может
привести к иной доменной семантике, ложному сохранению или недостижимому
обязательному сценарию; **Medium** — обязательный путь не достаточно задан для
реализации и проверки.

## Findings

### AXS-01 — Blocker — `Фокус` всё ещё является частью ToolRail

**Где:** `editor-interaction-and-grid-contract.md:105–112` перечисляет
`Фокус` среди постоянных команд ToolRail.

**Проблема:** `EXPERIENCE.md:34–38` и `:174–185`, PRD non-goals и
AD-15 запрещают in-app Focus, native fullscreen и специальные
fullscreen/viewport controls. Source companion, на который ссылается
`EXPERIENCE.md`, тем самым снова авторизует retired capability. Это не может
быть оставлено как «старое название» в контракте реализации.

**Исправление:** владелец interaction companion должен убрать `Фокус` и любые
связанные состояния/acceptance evidence, явно зафиксировав обычный Plan/3D
AppShell без Focus controller или fullscreen route. После этого синхронизировать
именованный состав ActionDock/ToolRail во всех UX-артефактах.

### AXS-02 — Blocker — companion требует retired Room finish override

**Где:** `editor-interaction-and-grid-contract.md:133–134`, acceptance item 5:
«one-Room finish override».

**Проблема:** это прямо возвращает retired FR-34–FR-37. SPEC CAP-6/CAP-7,
PRD и AD-8 требуют neutral room projection без `Floor(RoomId)`, `WallSide`,
resource, picker и durable assignment. Нельзя одновременно проверять
per-room finish override и заявлять, что такого доменного маршрута нет.

**Исправление:** заменить item 5 на проверку единой нейтральной display-
проекции derived Room, которая не создаёт assignment, ресурс или команду.
Удалить из companion терминологию finish override; material/variant остаётся
только свойством разрешённого `ItemInstance`.

### AXS-03 — High — 3D-макет визуально выдаёт покрытия Room за Alpha-данные

**Где:** `mockups/calm-spatial-studio-workspace-2026-08-29.png`, центральный
экран 3D: деревянный пол кухни/гостиной и отдельная плитка ванной.

**Проблема:** два различающихся покрытия пола читаются как назначенные
`Floor(Room)` finishes, хотя `DESIGN.md:165–169` и `EXPERIENCE.md:34–38`
исключают finishes, а canonical contract допускает лишь нейтральный пол и
стены как disposable projection. Даже при отсутствии picker-а такой референс
заставит реализацию и пользователя предположить несуществующие данные.

**Исправление:** перерисовать пол и стены в нейтральной единой подаче без
per-room texture/material distinction. Детализация и варианты допустимы у
предметов, но не у поверхности derived Room.

### AXS-04 — High — два несовместимых контракта постоянных инструментов

**Где:** `DESIGN.md:171–176`, `EXPERIENCE.md:88–97` и
`editor-interaction-and-grid-contract.md:105–116`.

**Проблема:** UX вводит контекстный ActionDock максимум на три действия и
overflow лишь для редких project actions; companion задаёт постоянный
вертикальный ToolRail с конкретным набором view/tool/history controls. Не
определено, является ли ActionDock заменой ToolRail, как постоянно доступны
`Стена`, `Предметы`, `Undo/Redo`, и где располагается disabled `Дверь/окно`.
При такой развилке реализация не сможет доказать требование CAP-4/CAP-5 о
доступном вне overflow переключателе вида и активном ToolRail.

**Исправление:** source-owning interaction contract должен описать одну
модель: например, постоянные ViewSwitch + «Рука и выбор» + undo/redo, а
ActionDock — контекстные команды. Для каждого элемента указать visible,
disabled и overflow placement. Затем обновить макеты так, чтобы они показывали
ровно эту модель, а не её третью, icon-only версию.

### AXS-05 — High — подтверждение каталожного предмета не показывает
`offline-ready/backup-ready` boundary

**Где:** `mockups/calm-spatial-studio-workspace-2026-08-29.png`, левый экран
Catalogue; `DESIGN.md:193–197`; `EXPERIENCE.md:94–95, 114–116, 228–234`.

**Проблема:** на макете доступна кнопка `Поставить`, но нет состояния exact
pin/hash/backup feasibility у карточки или preview. Текст документа упоминает
technical readiness, однако не задаёт, когда кнопка disabled, когда она
становится commit intent и какой статус остаётся после confirm. Это позволяет
превратить preview или metadata-only card в будто бы сохранённый AssetInstance,
что нарушает CAP-6, FR-28 и AD-14: Durable placement возможен только после
exact pin и `BackupFeasibilityPolicy`.

**Исправление:** на reference surface явно показать как минимум
`metadata-ready/loading`, `offline-ready/backup-ready` и
`unpinned-download-unavailable`. До ready доступен только cancel/retry; после
ready `Поставить` создаёт pending command, а `Сохранено` появляется лишь после
Durable Revision. Не называть browse cache или один preview офлайн-доступным.

### AXS-06 — High — offline, catalog retry и persistence failure слиты в один
визуальный паттерн

**Где:** `mockups/calm-spatial-studio-workspace-2026-08-29.png`, правый экран:
«Офлайн — проект работает» с кнопкой `Повторить`; `EXPERIENCE.md:73–77,
113–116`.

**Проблема:** healthy Project в offline — неблокирующее локальное состояние и
не имеет само по себе операции retry. `Повторить` принадлежит только failed
pin/download либо persist failure, которые имеют разные последствия: outage
не делает Project read-only, а post-validation persistence failure оставляет
старую Durable Revision и fences следующую mutation. Общая карточка создаёт
ложное впечатление, что проекту для работы нужно восстановить соединение.

**Исправление:** разделить reference states: (1) компактный offline banner без
CTA; (2) catalog `control-plane-unavailable` / `unpinned-download-unavailable`
с retry+cancel рядом с конкретным preview; (3) persist failure с прежней
Durable Revision, точным retry/recovery-export path и fenced mutation. Не
показывать их одновременно как один Project error.

### AXS-07 — High — поворот предмета выглядит как немедленная мутация, а не
как `PlacementPreview`

**Где:** `DESIGN.md:171–175, 199–201`; центральный экран
`calm-spatial-studio-workspace-2026-08-29.png` с иконкой поворота в
SelectionCard.

**Проблема:** ActionDock предлагает `Повернуть`, а макет показывает доступную
icon-only команду без отдельного preview/confirm/cancel. Между тем CAP-6,
editor companion §1 и AD-23 требуют единого grid-snapped PlacementPreview для
2D и 3D move/rotate: host, yawStep, rotated footprint, collision, reachable
cells, затем одна canonical command/inverse route. Прямой UI-setter разрушит
общую 2D/3D ownership boundary и может обойти cancel/fence/durability путь.

**Исправление:** обозначить действие как вход в `PlacementPreview`; в нём
показывать `+Z` front marker, дискретный yawStep, итоговый footprint/collision
и `Поставить / Отмена`. Один и тот же state должен быть доступен в 2D и 3D;
после confirm — `Сохраняем…`, затем `Сохранено` только после pointer swap.

### AXS-08 — High — обязательный Opening route не задан до implementable UI

**Где:** `DESIGN.md:171–176`; `EXPERIENCE.md:46–48, 93, 131–137, 219–227`;
оба набора mockups.

**Проблема:** документы правильно говорят «Дверь/Окно только после Wall
selection», но нет reference screen либо полевого контракта для width, height,
offset и sill/threshold policy, compatible Wall, clearance, invalid overlap и
`ConflictPreview` после изменения host Wall. В макете есть неименованная
кнопка `+`, поэтому невозможно подтвердить, что открытие недоступно без
compatible Wall и не трактуется как navigation/open-close Door.

**Исправление:** добавить обязательную surface `Wall selected → Opening
preview → confirm/rejection/conflict`. Показывать wall host и mm-поля,
disabled control до Wall selection, только wall-hosted semantics и безопасные
rehome/delete/cancel outcomes с fresh base/fence revalidation. Не добавлять
swing/open/lock/navigation controls.

### AXS-09 — Medium — макет wall draft не доказывает обязательный exact input
route

**Где:** `mockups/calm-spatial-studio-foundations-2026-08-29.png`, правый
экран `Стена`; `DESIGN.md:185–189`; `EXPERIENCE.md:91–92, 107–110`.

**Проблема:** на экране видны только `3200 мм` и undo/redo. Отсутствуют origin,
endpoint/`Δx/Δz` либо quadrant, candidate class, подтверждение/отмена и inline
reason. Поэтому он не подтверждает равный touch/numeric preflight, 45° input,
`SelectionUnavailable` или отсутствие ложной Durable mutation при reject —
хотя документация именно это обещает.

**Исправление:** дополнить этот reference экран и его подпись DOM-visible
candidate metadata, status `DraftCommand`, `Подтвердить / Отмена`, off-grid
label и наглядным reject/retry вариантом. Размер сам по себе не является
достаточной спецификацией exact wall route.

### AXS-10 — Medium — у измерений нет точки входа в навигации и ActionDock

**Где:** `EXPERIENCE.md:46–47` обещает measurement action, но
`DESIGN.md:171–176` и `EXPERIENCE.md:88–98, 124–142` не дают ему действия,
control или DOM alternative; обязательные reference surfaces в
`DESIGN.md:209–218` также его не содержат.

**Проблема:** FR-13/CAP-3 требует revision-bound measurement одного/двух
targets, rereselect при stale result и единый format в preview/2D/3D/export.
Без entry point пользователь и реализация будут либо использовать Room picker
(запрещён для derived Room), либо изобретут внеплановый режим.

**Исправление:** определить labelled `Измерить` entry point и DOM/list
alternative, допустимые targets, stale/reselect состояние и представление
результата. Добавить это в ActionDock/ToolRail reconciliation и отдельный
reference screen без превращения измерения в mutation.

### AXS-11 — Medium — UX не покрывает обязательные duplicate и lock/unlock
предмета

**Где:** PRD FR-30; `DESIGN.md:173–175, 199–201`; `EXPERIENCE.md:93–98`.

**Проблема:** PRD требует duplicate, lock/unlock и delete `ItemInstance`, но
SelectionCard/ActionDock фиксируют только rotate, properties и delete. В UX
даже не определено состояние locked и доступный путь unlock; overflow объявлен
местом только для редких Project actions. Это оставляет обязательную функцию
без discoverable и assistive-tech пути.

**Исправление:** явно расположить duplicate и lock/unlock в item property
sheet либо в названном item overflow, указать visible locked state и то, что
explicit unlock — обратимая Command. Не смешивать lock предмета с запрещённой
Door access-control семантикой.

### AXS-12 — Medium — «Сделать копию» не является однозначным Portable Backup

**Где:** `mockups/calm-spatial-studio-workspace-2026-08-29.png`, state
«Мало места»; `EXPERIENCE.md:80–81, 113, 117, 250–259`.

**Проблема:** формулировка похожа на создание второй копии Project, а
Duplicate Project retired в FR-3. При storage pressure пользователю нужен
self-contained versioned `.interiors` Portable Backup с exact resources, а не
внутренняя копия или неясный export. В persist failure pending candidate может
быть доступен лишь для отдельного retry/recovery export; нельзя выдавать это
за обычную durable backup текущего Project.

**Исправление:** переименовать CTA в `Создать резервную копию` или
`Экспортировать резервную копию` и рядом показать, что bundle self-contained.
Для persist failure отдельно назвать, что экспортируется: последняя Durable
Revision или recovery export pending candidate; для `CurrentProject|Both`
recovery Portable Backup вообще недоступен до repair.

### AXS-13 — Medium — дуги дверей на plan-макете не оговаривают отсутствие
Door state

**Где:** `mockups/calm-spatial-studio-foundations-2026-08-29.png`, правый
Plan screen; door openings показаны с дугами распахивания.

**Проблема:** AD-6 специально оставляет visual swing/hinge невыбранным и
запрещает ему менять geometry/host semantics; в Alpha нет `open/close`, lock,
key, passable или navigation state Door. Без подписи и отдельного Opening
контракта дуга выглядит как сохранённое направление/состояние двери и
противоречит этому ограничению.

**Исправление:** либо использовать нейтральный маркер Opening, либо явно
пометить дугу как неизменяемую условную графику без property, picker или
команды. Она не должна иметь persistent orientation/state, влиять на проход,
навигацию или 3D transform.

## Положительно подтверждено

- `EXPERIENCE.md` верно удерживает 2D как canonical state, а 3D — как
  disposable projection; derived Room не получает canvas selection.
- Pending/Durable/reject, local-first, iOS browser/Home Screen split и
  `ResourceRecoveryRequired` в тексте в целом различены правильно.
- Telegram оставлен будущим presentation adapter без identity, remote Project
  storage или единственного critical host button.

## Required reconciliation order

1. Сначала исправить source-owning `editor-interaction-and-grid-contract.md`
   для retired Focus и finishes, затем согласовать его с ActionDock.
2. После этого обновить статические reference surfaces для neutral Room,
   catalog readiness, offline/persist/recovery и Opening/measurement routes.
3. Только затем отмечать UX-пакет как согласованный и передавать его на
   implementation-readiness проверку.
