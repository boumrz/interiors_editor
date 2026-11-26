---
title: "InteriorsEditor — Experience Spine"
status: final
date: 2026-07-26
updated: 2026-11-26
product_stage: telegram-mobile
primary_form_factor: portrait-mobile
sources:
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/editor-interaction-and-grid-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - ../../architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/addendum.md
  - ../../sprint-change-proposal-2026-11-21.md
  - ../../../../plans/telegram-mini-app-extension-spec-2026-11-04.md
  - ../../../../contracts/alpha-release-ux-2026-11-01.md
  - ../../../../contracts/alpha-release-ux-followup-2026-11-01.md
  - ../../../specs/spec-tma-furniture-clearance/SPEC.md
  - ../../../specs/spec-tma-furniture-clearance/shared-bottom-sheet.md
  - ../../tma-room-interior-2026-11-26/ux-delta.md
  - ../../../../plans/tma-room-finishes-openings-and-supported-items-2026-11-26.md
  - DESIGN.md
  - mockups/correction-brief-2026-08-30.md
  - https://planner5d.com/interior-design-app
  - https://support.planner5d.com/en/articles/5897736-catalogue-menu-ios
  - https://core.telegram.org/bots/webapps
---

# Foundation

InteriorsEditor — локальный редактор для работы с телефона без CAD-навыков.
Обновление относится к Telegram Mini App на iOS и Android. Главный цикл —
измерил, построил, поставил предмет, проверил в 3D и сохранил. Работу задают
управление одной рукой, безопасные зоны и короткие офлайн-сессии.

DESIGN.md владеет визуальным языком Calm Spatial Studio. Этот документ владеет
информационной архитектурой, поведением, состояниями и доступностью. 2D-план
остаётся канонической истиной; 3D — disposable-проекция для пространственной
проверки.

Визуальная проверка использует условные модели и матовые материалы.
В мобильной TMA пользователь выбирает предусмотренные покрытия пола и
физической стороны стены по FR-64. Отделка общая для обеих расстановок.
A/B относится к меблировке комнаты по FR-62, включая гостей каждой опоры.
Door/Window остаются проёмами на стене. Вариант задаёт конструкцию и рабочую
зону проёма. Остальные границы объёма Alpha закреплены в PRD.

# Information Architecture

| Surface | Как попасть | Назначение |
|---|---|---|
| Host entry | Явный Telegram entry | Проверить host и необходимую identity до доступа к локальной области; ошибки и выход через существующий AppShell. |
| Projects | cold open, Назад из editor | Открыть, создать, переименовать, backup/export или явно удалить локальный Project; условная объединённая directory областей Web/PWA описана в AD-31 ниже. |
| Create Project | Новый проект | Пустой Plan, прямоугольная Room starter или import Portable Backup. |
| Plan | Editor default, План | Каноническая 2D authoring surface: Wall, Opening, placement, measurements. |
| Geometry sheet | Wall/Room/Opening/measurement action | Точный mm input, candidate preview, причины reject и confirm. |
| Room directory | Project menu → Комнаты | Путь из списка для изменения типа, высоты и пола производной комнаты; UI определяет комнату по типу, не редактирует name и не показывает историческое имя на плане. Сохранённое `Room.name` не переписывается при изменении типа/высоты и сохраняется после reopen (FR-16, REL-05). |
| Catalogue | «Добавить» → «Предмет» на плане, «Предмет» в 3D | Поиск, категории и карточки. В Telegram основной путь ведёт к локальным условным предметам. Для ссылочных моделей действуют техническая подготовка и доступный для отмены предпросмотр. |
| Item properties | Выбранный предмет → «Параметры» | На плане напольный предмет открывает «Размеры», «До стен» и «Настройки». У ранее сохранённого настенного предмета доступны штатные параметры привязки. |
| Отделка и профиль | «Стена», «Свойства стены» и параметры «Комнаты» | Профиль нового сегмента, именованные материалы пола и стороны стены, адресный предпросмотр и отмена. |
| Вариант проёма | «Добавить» → «Дверь» / «Окно», параметры действующего проёма | Вариант и применимые поля, со свободным выбором стены на плане или в списке. |
| Опора декора | Каталог → место, параметры выбранного декора | Пол или именованная площадка мебели, выбор уровня и локальных смещений. |
| Расстановки | Напольный предмет или «Помещения» | A/B одной комнаты. Через «Помещения» доступно и в пустой комнате. |
| 3D | 3D | Orbit/pan/zoom, selection AssetInstance, floor placement/rotation и spatial check. |
| Project menu | Header menu | Rename, storage/diagnostics, Portable Backup, update status, confirmed deletion. |
| Resource recovery | Integrity scan | Read-only Project и exact repair/atomic recovery actions. |
| Compatibility | Unsupported WebGL/schema | 2D, export, diagnostics или read-only/exportable fallback. |
| Статистика и оценка | Внизу экрана «Проекты» через ссылку «Настройки статистики» (при доступной оценке — «Статистика и оценка») | Согласие на Яндекс Метрику, его отзыв и добровольная оценка планировки. |

Навигация плоская: Home → Editor → один sheet/detail. Новый sheet заменяет
предыдущий, а не складывается поверх него. Назад закрывает текущий sheet только при отсутствии защищаемой работы; draft,
pending и ошибки обрабатываются по таблице TMA-07 ниже. Назад из editor без
незавершённой работы возвращает в Projects. Plan и 3D — один editor, а не независимые экраны.

# Voice and Tone

Тон — короткий, практический и спокойный. Мы называем наблюдаемое состояние и
следующее безопасное действие; не объясняем внутреннюю архитектуру и не ругаем
пользователя.

| Ситуация | Использовать | Не использовать |
|---|---|---|
| Пустой список | Пока нет проектов | Маркетинговое приветствие |
| Первый Plan | Подписанные действия Комната / Стена / Добавить / Выбор | Обучающие подсказки и tutorial-карусель (REL-02) |
| Durable success | Сохранено | Все изменения синхронизированы |
| Pending durability | Сохраняем… | Готово до pointer swap |
| Persist failure | Не удалось сохранить. Открыта последняя сохранённая версия. | Технический код ошибки |
| Offline | Офлайн — доступные действия выполняются на устройстве | Все функции доступны без подготовки |
| Catalog outage | Каталог временно недоступен. Добавленные предметы останутся доступны. | Проект повреждён |
| Geometry reject | Стена пересекает предмет | INVALID_DIMENSION |
| Recovery | Проект открыт только для чтения: нужно восстановить 2 предмета. | Данные потеряны |
| Permanent delete | Удалить проект? Отменить это нельзя. | Вы уверены? |

Название action — глагол: Поставить, Повторить, Восстановить, Экспортировать
данные для восстановления, Удалить проект. Не использовать восклицания, эмодзи,
советы дня и технические IDs в обычной поверхности.

# Component Patterns

| Component | Поведение |
|---|---|
| AppShell | Сохраняет title, view, selection, writer/recovery/durability state. Не прячет critical status ради чистого canvas. |
| ActionDock | Четыре прежние позиции обычного плана: «Комната», «Стена», «Добавить», «Выбор». Контекст сохраняет выделение или черновик при смене действий. |
| ViewSwitch | Persistent EditorTopBar control: План/3D всегда доступны вне overflow. Переключение не создаёт Command, Revision или history. Room не получает selection. |
| DimensionInput | Allowed signed integer-mm input; applied value, raw draft, unit и конкретная причина reject видимы рядом. |
| GeometryPreview | Origin, returned candidate class, endpoint/Δx/Δz или selected diagonal quadrant — и текстом, и на canvas. UI не меняет PlanProjectionPort policy. |
| SelectionCard | Выбор Wall выделяет тело без автоматической карточки; явные `Свойства` открывают свойства и удаление с подтверждением последствий (FUP-07/09). Wall: `Измерить`, Opening. Floor item: local +Z, move/rotation, variant, properties и delete. Wall item: host-relevant properties, variant, properties и delete. Derived Room не получает card. |
| CatalogueSheet | Поиск, категории, карточки и предварительный выбор предмета. Для нового условного пресета Telegram используется локальный путь до PlacementPreview. Для ссылочной модели сохраняется card → pin + BackupFeasibilityPolicy → cancelable PlacementPreview → confirm → Durable outcome. |
| PlacementPreview | Для floor item — ephemeral result в 2D/3D с host, position, rotation, footprint, collision и reachable cells. Wall item изменяется только через host-specific numeric draft, без свободного world-space drag. Confirm создаёт одну canonical command. |
| Расстояния до стен | В плане Telegram размерные линии следуют за активным черновиком напольного предмета. Те же значения доступны текстом по сторонам в панели размещения или перемещения. Визуальная роль описана в {components.placement-distances}. |
| Палитра предмета | Именованные образцы с текстом и выделением выбранного варианта. Цвет относится к самому предмету. Визуальная роль описана в {components.item-color-swatch}. |
| StatusBanner | Различает offline, control-plane unavailable, persistence error, writer lease и blocking recovery. |
| ConfirmSheet | Project deletion, DiscardSessionHistory, ConflictPreview, RecoveryChangeSet, перенос Opening и безопасная обработка Back/Close. Удаление предмета подтверждается и обратимо через Undo. Удаление стены подтверждает последствия по FUP-09. |
| Object list / Room directory | Accessible DOM alternative для canvas; Room metadata только directory, не canvas-picker. Для `Измерить` list может дать первый или второй named target. |
| Opening sheet | Обычный вход «Добавить» и короткий вход с выбранной подходящей стены. Детали открываются по запросу: тип, стена, ширина, высота, смещение, `sillMm` и допустимый интервал. `sillMm` подписан как `Порог / нижняя отметка, мм` для Door и `Высота подоконника, мм` для Window. Add/edit action остаётся disabled при inline reject; Door не получает open/close/lock semantics. |
| Custom item placeholder | Только Alpha entry: width/depth/height, color и AnchorClass → candidate → canonical AssetInstance. Несовместимый host или limits reject не меняет Durable Revision. |
| Static GLB import | Только Alpha+: preflight bytes/resources → safe preview → declared dimensions/axes/AnchorClass/host → pin/backup → PlacementPreview. Не скрывает reason reject и не распространяется на .gltf/OBJ/FBX/archives. |

**Актуальная Alpha disposition каталога (решение владельца, 4 ноября 2026).**
Владелец отбирает бесплатные или собственные модели вне приложения. Формальный
`AssetUsageGrant`, а также licensing/provenance/declaration/attribution/notice
admission не являются условием Alpha; прежний конфликт источников по этому
вопросу разрешён. Каталог сохраняет техническую проверку ресурсов, hashes,
security, exact pin и `BackupFeasibilityPolicy` до Durable placement. Передача
пользовательских Project, GLB или backup на сервер не разрешена.
Отдельные технические и физические доказательства Telegram остаются открытыми.

## Component Contract Mapping

Каждая строка ниже связывает один visual token object из `DESIGN.md.Components`
с поведением; composition означает, что route не создаёт новый widget.

| Component | Visual token object | Behaviour owner |
|---|---|---|
| AppShell | `app-shell` | Project/view/selection/durability state; never hides critical status. |
| ProjectCard | `project-card` | Opens Project; destructive actions live only in Project menu. |
| EditorTopBar + ViewSwitch | `editor-top-bar`, `view-switch` | View switch only; no Command or Revision. |
| ActionDock + UndoRedo | `action-dock`, `undo-redo` | Четыре позиции обычного плана и раздельные зоны истории и масштаба. |
| BottomSheet + ConfirmSheet | `bottom-sheet`, `confirm-sheet` | Одна верхняя активная шторка. Дочернее подтверждение временно замещает содержимое и восстанавливает фокус при отмене. |
| DimensionInput + GeometryPreview | `dimension-input`, `geometry-preview` | Exact mm draft, candidate/reject text and numeric route. |
| CatalogueSheet + CatalogueCard | `catalogue-sheet`, `catalogue-card` | Composition: browse → technical admission; no Durable item from card. |
| PlacementPreview | `placement-preview` | Composition: ephemeral host/footprint/collision then one confirm. |
| SelectionCard | `selection-card` | Wall/Item actions, including `Измерить` and item-property route. |
| Object list / Room directory | `object-list-room-directory` | DOM target selection and Room metadata route. |
| Opening sheet | `opening-sheet` | Composition: kind/host/width/height/offset/`sillMm`/interval, inline validation and ConflictPreview; no Door lifecycle. |
| Custom item placeholder | `custom-item-placeholder` | Composition: parameters → candidate → AssetInstance. |
| Static GLB import | `static-glb-import` | Composition: Alpha+ preflight → safe preview → pin/backup. |
| Measurement card | `measurement-card` | One/two-target revision-bound result; stale result reselects, never mutates. |
| StatusBanner | `status-banner` | Nonblocking offline/control-plane state only; not recovery or persist failure. |

# State Patterns

| Состояние | Видимое правило и действие |
|---|---|
| Local cold open | Browser/PWA: layout-matched skeleton, network не блокирует подготовленный local Project; Telegram: сначала host entry и при необходимости онлайн-запуск. |
| Empty Projects | Одна action Новый проект; import Portable Backup secondary. |
| Empty Plan | Футер «Комната», «Стена», «Добавить», «Выбор» без обучающей подсказки (REL-02). |
| Opening draft | После compatible Wall: kind, host, width/height/offset/`sillMm` в мм, допустимый interval и `Добавить / Отмена`; никакой Door state. |
| Catalogue card admission | До pin/backup: только preparation progress/cancel; failure даёт retry/cancel внутри catalog, healthy Project остаётся editable. |
| PlacementPreview | `Предпросмотр — не сохранено`, host/footprint/collision/front marker и `Поставить / Отмена`; only confirm starts one canonical command. |
| DraftCommand | Session-only preview; исправить или отменить; не saved и не history. |
| SelectionUnavailable | Сохраняет origin/raw draft; повторить, pan/zoom и numeric route. Не превращается в Rejected. |
| Rejected | Причина привязана к field/preview; последний Durable Plan не меняется. Нет history/autosave/PendingDurability. |
| ConflictPreview | Показывает affected Room/Opening/host и разрешённые safety outcomes; confirm rechecks base и writer fence. Valid split сразу наследует heightMm. |
| PendingDurability | Header: Сохраняем…; следующий mutating commit fenced; прежняя Durable Revision видима. |
| Durable | Только после atomic pointer swap — Сохранено и History entry. |
| Persist failure | Последняя сохранённая версия, `Повторить сохранение` и `Экспортировать данные для восстановления`; mutating commit fenced. |
| Offline | Неблокирующая строка; local edit, pinned assets, history и backup доступны для подготовленного пути, с оговорками Telegram ниже. |
| control-plane-unavailable | Browse/download unpinned resource недоступны, есть retry/cancel; healthy Project не read-only. |
| unpinned-download-unavailable | Card не создаёт Durable AssetInstance; preview остаётся cancelable. |
| Storage warning / reject | Backup или лёгкий asset; hard reject не удаляет Project/history молча. |
| ResourceRecoveryRequired | Блокирующая read-only surface: exact repair, один atomic recovery, diagnostics и confirmed deletion; обычные edit/undo/redo скрыты. |
| History-only resource issue | Current Project здоров; доступен exact repair или confirm Начать новую историю. |
| Locked AssetInstance | Item остаётся видимым и selectable; drag/rotate не начинают preview. `Разблокировать` в Item properties — одна reversible command. |
| Measurement stale | Revision/checksum больше не совпадают: value скрыт, `Выбрать заново` возвращает к первому target; measurement не создаёт history. |
| Расстояние недоступно (Telegram) | Убирается соответствующая направляющая и её значение. При пересечении стены показывается существующая причина конфликта. Когда привязка черновика к комнате не определена, набор направляющих скрывается целиком. |
| Ссылочная модель готовится в 3D | Сцена остаётся доступной. Предпросмотр сохраняет габариты и положение. После готовности сохраняются камера, масштаб и режим скрытия стен. Пока подготовка не завершена, подтверждение недоступно, отмена доступна. |
| Статистика выключена или не отвечает (Telegram) | Projects, Plan, 3D и сохранение доступны. Если пользователь сам отправил оценку и отправка не подтверждена, панель сохраняет выбранные ответы до ухода и предлагает `Повторить` или `Закрыть`. |
| Writer lost | Второй context read-only; explicit takeover объясняет последствия. |
| WebGL recovery | Recreate из canonical state → reduced quality → 2D fallback; Project, Draft и History не теряются. |
| PWA update | Reload предлагается после Durable Revision; startup — writable, read-only/exportable или migration-in-progress. |

## Surface × State Matrix

| Surface | Начальное / пустое | Draft / transient | Failure | Продолжение |
|---|---|---|---|---|
| Host entry (Telegram) | host/identity/compatibility check | bounded SDK wait | invalid/unsupported host, missing identity, timeout | retry/exit, настроенные ссылки на Telegram и Web/PWA; без доступа к чужому scope |
| Projects | skeleton, empty list или ProjectCard | Create Project | migration/open issue | Новый проект, import или открыть читаемый Project |
| Create Project | name + пустой Plan/rectangular starter/import choice | starter geometry draft | invalid name/input/import route | Создать, исправить или Назад в Projects |
| Plan | Empty Plan или Durable Revision | wall/Opening/PlacementPreview | reject, SelectionUnavailable, ConflictPreview | numeric route, исправить, отменить или подтвердить одну command |
| Geometry sheet | applied value + exact unit | raw mm draft/candidate | inline reject or stale projection | apply, reselect or Back to Plan draft |
| Room directory | derived Room rows | правка типа, высоты или пола | invalid property or lineage conflict | save one command or Back to Plan; no canvas Room picker |
| Отделка, профиль и вариант проёма | Действующее значение | Выбор и адресный предпросмотр | Недопустимое положение, конфликт с соседом или несовместимое объединение | Исправить, отменить или сохранить одной командой |
| Опора декора | Выбран пол или имеющаяся опора | Именованная площадка, уровень, точный ввод | Площадка недоступна, занята или заблокирован затронутый экземпляр | Исправить место, явно сменить цель или отменить |
| Catalogue | categories/cards | pin + backup preparation | control-plane/unpinned-download unavailable | retry/cancel; Project не становится read-only |
| Item properties | selected AssetInstance values | floor position/rotation либо wall offset/elevation/normal offset/orientation, size/variant/lock/duplicate draft | invalid metadata/locked gesture | confirm one command, unlock or Back to selection |
| 3D | disposable projection canonical Plan | camera/cutaway/floor PlacementPreview | WebGL recovery | wall item opens numeric properties; reduced quality или 2D fallback без domain mutation |
| Статистика и оценка (Telegram) | Статистика выключена до выбора | Явный выбор согласия или черновик оценки | Провайдер недоступен | Редактирование доступно, Back закрывает панель и возвращает фокус к открывшему действию |
| Project menu | project actions | rename/delete/export choice | writer or export issue | back to editor/Projects; delete only via ConfirmSheet |
| Project lifecycle | Durable/Offline | PendingDurability | persist failure, writer lost | retry save/recovery export или explicit takeover |
| Resource recovery | integrity scan | exact repair verification | ResourceRecoveryRequired | exact repair или atomic RecoveryChangeSet; иначе read-only |
| Backup / import | export/import choice | staging validation | schema or integrity reject | сохранить исходный Project, показать recoverable reason |
| Compatibility | capability/schema diagnostic | 2D/export fallback transition | unsupported API/schema | diagnostics, export or read-only route; no silent data loss |
| Custom GLB (Alpha+) | file choice | byte preflight/safe preview | unsupported/unsafe/reject | исправить asset или отменить; Project не меняется |

# Interaction Primitives

- Tap выбирает Wall/AssetInstance или labelled DOM control. Tap derived Room или
  пустого canvas не создаёт Room selection.
- «Выбор» объединяет выбор и перемещение. Drag selected **floor** AssetInstance создаёт
  PlacementPreview; wall-hosted AssetInstance не получает свободный drag, а
  открывает numeric properties для offset/elevation/normal offset/orientation.
  Long-press/drag пустого canvas панорамирует; второй pointer принадлежит
  pinch/pan. Доступность не зависит только от long-press.
- Wall начинается только explicit pointer-down → non-zero drag либо complete
  exact numeric intent. Обычный tap заканчивает draft без candidate,
  allocation, Command, Revision или History.
- Прямоугольная комната формирует один dotted wall-loop candidate; это не
  вторая editable geometry truth.
- Отдельного split-маршрута для выбранной стены нет: ни жестового, ни
  числового. Перемещение Vertex и добавление Wall к существующей Vertex
  остаются доступными; допустимые T/X и другие контакты автоматически
  нормализуются с необходимым разбиением сегментов и полной проверкой графа.
  Это не удаляет domain-операции и совместимость сохранённых стен (FR-9, REL-08).
- «Дверь» и «Окно» доступны до выбора стены. Подходящую опору выбирают на
  плане или в доступном списке. У уже выбранной стены сохраняется короткий путь.
- `Измерить` открывается из SelectionCard Wall либо Object list. Пользователь
  выбирает один или два named target (Plan point, Wall centerline, Room inner
  boundary или AssetInstance footprint); value revision-bound и stale outcome
  даёт только `Выбрать заново`, никогда не Command.
- Plan и 3D разделяют selection Wall/AssetInstance. Camera orbit/pan/zoom и
  Auto cutaway transient; они не меняют domain transform.
- 2D и 3D move/rotate floor AssetInstance применяют одну placement
  command/inverse. Front marker всегда отражает один yawStep/local +Z.
  WallPlacement меняется только через свою host-specific numeric command; ни
  один gesture не выполняет silent cross-anchor transfer.
- «Дублировать» доступно сразу после выбора напольного предмета. Вкладка
  «Настройки» содержит его же, блокировку и подтверждаемое удаление.
  Блокировка защищает предмет от жестов.
- Undo/redo объясняет следующую command. SessionRetentionPolicy отклоняет
  command до mutation, а не молча обрывает redo/history.

# Accessibility Floor

- WCAG 2.2 AA для текста, contrast, focus и controls; видимый focus ring
  использует {colors.focus-ring}.
- DOM target не меньше 44×44 CSS px, предпочтительно 48×48; fixed controls
  учитывают safe-area и keyboard visual viewport.
- Text zoom до 200% не убирает primary action, durability или способ отменить
  draft; label не становится непонятной icon-only кнопкой.
- Canvas не единственный путь: Object list/Room directory, DimensionInput,
  state text и confirm доступны DOM/assistive technology.
- Candidate, origin, endpoint/Δx/Δz, quadrant, lifecycle и error связаны с
  полем accessible text; screen reader получает изменение один раз.
- Статус не основан только на цвете: selected/rejected/blocked различаются
  outline, text и семантически именованной иконкой.
- Фокус возвращается в initiating control после sheet/dialog или доступный
  fallback. Esc и Back обрабатывают верхний context с приоритетом защиты draft
  и сохранения; modal stack глубже одного уровня запрещён.
- Reduced motion отключает decorative transitions, camera inertia и
  несущественную cutaway animation; haptic — только дополнительный канал.

Формальное доказательство этих требований не создаётся документным workflow.
Прежняя browser/PWA проверка не подтверждает Telegram: для него необходима
отдельная физическая проверка по NFR-28; QA включает 360 px, 200% текста,
клавиатуру, safe area, контраст, DOM alternatives и reduced motion.

# Responsive & Platform

Phone portrait — primary. Plan и 3D используют оставшийся visual viewport, не
фиксированную CSS-высоту. Header, ActionDock и sheet имеют safe-area padding;
клавиатура поднимает sheet, не скрывая confirm/input.

iOS Safari и Home Screen PWA считаются разными local contexts. Install-help
говорит: В браузере и на экране «Домой» проекты могут храниться отдельно.
Перенесите проект резервной копией. Никакая подсказка не обещает sync.

## Ноябрьские уточнения существующих поверхностей

REL/FUP имеют приоритет над старыми референсами: без обучающих подсказок,
односторонних декоративных акцентных полос, разворота стены и удаления в dock.
Тело выбранной стены выделяется без автоматической плашки; её свойства и
удаление с подтверждением последствий открываются явно. Короткий tap по пустому
холсту снимает выбор и связанные свойства без Revision; pan/pinch не tap.
Перемещение Door/Window подтверждается или отменяется модально без повторного
редактирования размеров; cancel, второй pointer, Escape, stale base или потеря
fence не публикуют изменение. Если уже подтверждённая запись не удалась, точный
candidate переходит в persist-failed recovery, без повторной модалки переноса.
Меню открывается поверх редактора, удерживает контекст и не сдвигает canvas;
ошибка каталога остаётся внутри каталога с Retry, а закрытие отменяет запрос и
поздний ответ не открывает его повторно (REL-11, FUP-03–09).

## Telegram Mini App — host и локальная область

Расширение FR-55–58 добавляет Telegram к Web/PWA на общем редакторе. На S0–S7
прежние browser entry, установка, offline reopen, обновление, данные и проверки
сохраняются; Telegram не требуется для браузерного пользователя. Возможное
удаление только browser/PWA оболочки — после проверки владельцем, доказанного
переноса и восстановления старых данных, rollback и отдельного retirement gate.
Это не разрешение на удаление. Telegram cold launch может требовать сеть;
разные browser, Home Screen, Telegram-клиенты и устройства не обещают общую
базу или синхронизацию. Не вводить скрытую отправку Project, GLB или backup
на сервер/боту. FR-55–58/NFR-28 — исходные требования, а не новая приёмка.

### Вход и scope

| Состояние | Видимое поведение и безопасный следующий шаг |
|---|---|
| Явный Telegram entry, проверка | AppShell показывает загрузку host/identity и проверку совместимости; scope выбирается до создания runtime, открытия или миграции хранилищ и cleanup. Само наличие SDK-объекта не подтверждает host. |
| Вне host / неподдерживаемый host | Объяснить, что этот вход предназначен для Telegram; показать `Открыть в Telegram`, `Открыть Web/PWA` и `Выйти`. Рабочая Web/PWA-ссылка обязательна в deploy-конфигурации; реальные адреса не выдумывать. |
| Invalid host или identity; обязательная identity отсутствует | Показать, что безопасно открыть проекты не удалось; `Повторить` и `Выйти`, доступная Web-ссылка. Общий writable fallback запрещён. |
| SDK недоступен / timeout | Ограниченное ожидание заканчивается ошибкой, `Повторить` и `Выйти`; нет бесконечного spinner или записи. |
| Несовместимая/недоступная версия или миграция | Состояния writable, read-only/exportable и migration-in-progress остаются различимыми; ошибка не разрешает запись, доступные recovery/export и обновление объясняются. Отсутствие PWA worker не отменяет проверку. |
| Смена A → B → A | До открытия B остановить A; B не видит Projects A. При возврате в A доступны его данные. Отменённые или поздние import/download/repair и cleanup A отвергаются по scope/generation и не публикуются в B или повторно открытом A. Ни один scope не удаляется автоматически. |

Один immutable scope на runtime охватывает Projects/ревизии, ресурсы и библиотеку,
staging, history/GC roots, writer/takeover и project preferences. Scope —
локальная организация, не серверная авторизация; identity и initData не входят
в Project или Portable Backup. Реальный trust design — зависимость архитектуры.

### Back и Close — TMA-07

Один обработчик получает in-app Back и Telegram Back; приоритет — сохранность
работы. При нескольких состояниях применяется наиболее защитная строка.

| Состояние | Back внутри приложения | Попытка Close host |
|---|---|---|
| Панель без draft | Закрыть верхнюю панель, вернуть focus на инициатор или доступный fallback; остаться в редакторе. | Допустимо, если нет другой несохранённой работы. |
| Draft / незавершённый ввод / ConflictPreview | Предложить `Продолжить` или явно `Отменить правку`. Отмена диалога выхода сохраняет тот же draft, selection и focus; отмена самой правки не создаёт Revision. | Предупредить о несохранённой работе, если host умеет; не подтверждать draft. |
| PendingDurability | Показать `Сохраняем…`, управляемый выход отложить до результата публикации; успех переводит в Durable, ошибка — в persist-failed. | По возможности предупредить; принудительное закрытие не считается предотвращённым, при reopen действует atomic recovery последней Durable Revision. |
| Persist-failed | Оставить точный candidate и `Повторить сохранение` / `Экспортировать данные для восстановления`; явно показать несохранённое. Отказ от candidate — только через явное подтверждённое действие с предупреждением потери. | Не обещать сохранение; при доступности предупредить, сохранить предусмотренный recovery path. |
| Read-only recovery | Закрыть панель или вернуться в Projects без автоматического repair/delete. | Допустимо без автоматического изменения Project. |
| Durable editor без draft | Вернуться в Projects. | Допустимо. |
| Projects без активной операции | Закрыть Mini App только по явному Back пользователя. | Допустимо. |

Отмена подтверждения выхода не вызывает Back повторно и не запускает второй
handler; модальный контекст удерживает focus и возвращает его после закрытия.
Системное принудительное закрытие не гарантированно блокируется. Browser/PWA
сохраняют привычный Back. Конфликтующие host swipes ограничиваются лишь пока
нужно для редактора и восстанавливаются при выходе; отдельный DOM control
всегда доступен, host button не является единственным confirm/cancel/recovery.

### Lifecycle, layout и доступность

Host theme отображается через существующие semantic tokens {colors.background},
{colors.surface}, {colors.text}, {colors.focus-ring}; контраст плана, размеров и
focus сохраняется. Theme, rotation, viewport, keyboard, foreground/background и
WebGL loss не создают Command или Revision. Insets вычисляются по фактически
доступной области host и системы без двойного сложения перекрывающихся зон;
при 360 CSS px и 200% текста видны статус, основное действие, отмена и активное
поле. Sheet прокручивается, focus и draft сохраняются при клавиатуре; DOM/list
альтернативы, ≥44 px targets и reduced motion остаются доступными.

Viewport/keyboard change делает прежний screen→plan transform stale: активный
жест не подтверждается по старым координатам; при недоступной актуальной
проекции — SelectionUnavailable с retry/numeric/cancel без domain mutation.
Второй pointer отменяет незавершённое построение/перемещение перед pinch, не
подтверждая draft; после отмены новый gesture работает. При возврате из фона
проверяются writer fence, base Revision и актуальность работы; потеря fence
отбрасывает неподтверждённый gesture, не воскрешает его при возврате права.
Renderer восстанавливается из модели либо предлагает 2D fallback. Подписки и
host gestures восстанавливаются без повторных команд/обработчиков.

### Сеть, подготовка и файлы

| Состояние | Поведение |
|---|---|
| Telegram онлайн, до готовности | Показывать подготовку отдельно по реально доступному режиму: необходимые editor/2D/3D lazy modules, codecs и exact referenced resources. Первый экран не означает offline readiness. |
| Обрыв до готовности | Объяснить, какой режим/ресурс ещё недоступен; предложить повтор при сети, сохранить доступные локальные действия. Не загруженный resource не становится Durable. |
| Обрыв после готовности соответствующего пути | Локальные edit, atomic Durable save и session undo/redo продолжаются при доступности подготовленных модулей и exact ресурсов; catalog download новых ресурсов отдельно недоступен, healthy Project не становится recovery. |
| Файл готовится | Отдельно показывать подготовку complete Portable Backup из Durable Project и exact ресурсов; progress/cancel не утверждают внешнее сохранение. |
| Передача системному действию | `Передача файла…`; успешный вызов или открытие picker не доказывает внешнее сохранение. Если результат внешнего сохранения неизвестен — `Проверьте файл вне приложения`, предложить повтор и импорт. |
| Отмена / ошибка / неподдерживаемая локальная выдача | Честно сообщить `Отменено` / `Не удалось передать` / `На этом устройстве способ недоступен`; повтор или выход без изменения Project. Не заменять способ скрытым upload. |
| Внешне проверен | Только фактическое сохранение конкретного файла вне WebView и его повторный выбор/успешный импорт на целевом клиенте подтверждают handoff; UI заявляет это лишь при установленном факте, не по API callback. |
| Recovery export | `Экспортировать данные для восстановления` несохранённого candidate; не называть complete Portable Backup и не показывать `Сохранено` для candidate. |
| Import | Выбор файла, проверка размера до чтения, staged schema/integrity/resource validation, cancel/error; unsupported/corrupt/truncated/oversized не создают Project. Успех атомарно создаёт новый ID, исходник остаётся; session history не переносится. Совместимость конкретных версий требует проверки настоящих файлов. |

**AD-31: объединённый список локальных Projects — UX-диспозиция.** Новая
browser-область предлагается только для явно выбранного registered-transfer
import. Её доступность требует согласования SPEC, решения по FR-45 и отдельного
применимого readiness gate; AD-31 и этот документ не означают выпуск. Обычное
создание и прежний import остаются в старой области. Прежние данные, действия,
export codec, проверки, History и данные Telegram не переносятся автоматически.

После допуска обновлённый Web/PWA независимо читает обе локальные области и
показывает Projects одним списком. Каждая карточка указывает понятную метку:
`На этом устройстве · обычное хранилище` или `На этом устройстве · хранилище
для переноса`; метка видна и озвучивается вместе с названием. При одинаковых
названиях дополнительно показывается доступная различающая метаинформация,
например дата, а если её недостаточно — отдельное видимое и озвучиваемое
обозначение копии. Карточки никогда не сливаются. Это две локальные области,
а не аккаунты, синхронизация, гарантированная долговечность или защита от
очистки данных браузера; origin eviction и общая квота могут затронуть обе.

За карточкой закреплён непрозрачный доверенный адрес `(storage namespace,
raw ProjectId)`; он не извлекается из имени, hash, ID-префикса или данных
файла. Даже совпадающий raw ID не переносит операцию на другую карточку. Open,
rename, edit, history, writer/takeover, retry/recovery, export, delete и поздний
асинхронный результат сохраняют адрес выбранной копии; если owner определить
нельзя, действие не выполняется и предлагается повторить выбор. UI не раскрывает
технический ID как единственный способ различить Projects. Новый ID import и
отсутствие overwrite во всех областях остаются отдельным source/evidence gate:
одной составной карточки для выполнения FR-45 недостаточно.

| Состояние | Поведение |
|---|---|
| Обе существующие области читаются | Показать обе группы карточек с метками; обычные действия над прежними Projects не меняются. Empty state допустим только когда актуальное чтение подтверждает отсутствие записей в обеих областях; о прежних данных это ничего не доказывает. |
| Одна область недоступна, занята или несовместима | Показать доступные карточки и понятное `Часть проектов сейчас недоступна` с меткой области и `Повторить`; не называть её пустой или удалённой. Другая область продолжает безопасные действия по своим правилам. Не переносить данные, не очищать и не ремонтировать автоматически. |
| Новый scope не может гарантировать запись или owner не подтверждён | Показать доступный read-only/recovery путь либо отказ действия с понятной причиной; без переключения на прежнее хранилище и без изменения другой копии. Старые Projects остаются доступны в своих безопасных режимах. |
| Новая DB фактически сейчас отсутствует (`not-provisioned`, история неизвестна) | Показать доступные прежние Projects и `Хранилище для переноса сейчас не создано`; не называть новую область здоровой и пустой и не утверждать, что Projects никогда не существовали или восстановлены. Обычное открытие списка и probe не создают DB. |
| Явный registered import при фактическом отсутствии DB | После успешных проверок файла, smoke, проверки отмены и представимости до выделения ID возможен разрешённый bootstrap текущей области под общим exclusive scope lock. Это отдельное создание по выбранному import, не silent recreate; если другая вкладка уже создала DB, её сначала проверяют как существующую. Import не объявляется успешным до подтверждённой публикации. |
| Existing state неизвестен, metadata повреждена/чужая или ранее подтверждённая DB пропала в живом context | `Не удалось проверить хранилище для переноса`; только read-only/recovery либо отказ. Не считать отсутствие доказанным, не сбрасывать counter, не пересоздавать и не переключаться на старый repository. Обычная область доступна при успешной собственной проверке. |
| Bootstrap завершён, import отменён или отклонён до публикации | Валидная служебная область может остаться; не удалять её и не заявлять импортированным Project. Её можно назвать пустой только после успешного актуального чтения записей, без утверждения о прошлом; повторный явный import снова проходит проверки. |
| Исход операции после возможной публикации неизвестен | `Проверяем результат импорта…`; сохранить источники и необходимые ресурсы до receipt-based reconciliation. Отмена или ошибка после возможного commit не доказывает отсутствие Project; не показывать ни успех, ни подтверждённую отмену до выяснения. |
| Offline / startup / update / rollback | Отдельно проверяются доступность кода, версии, данные и возможность записи каждой области. Для недоступной части показать ограничение и доступные безопасные действия; наличие shell или одной области не доказывает готовность другой. Не обещать перенос или синхронизацию при обновлении. |

Новая область имеет собственную библиотеку и ресурсы. Каталог проекта показывает
только доступные ресурсы его области; модель, существующую лишь в другой
локальной библиотеке, не подставляют молча по hash. Если согласованный маршрут
явно предлагает её копировать, подготовка проверяет исходные bytes/hash/length,
собственный pin и feasibility до Durable placement; cancel/error не меняют
Project и не удаляют исходный ресурс. Другой области и её undo/redo roots такая
операция не очищает.

Для Project новой области обычное `Создать резервную копию` использует именно
ресурсы выбранного Project и прежний browser codec; до допуска нужно доказать
полный offline backup каждого non-corrupt Durable Project и сохранение этой
гарантии для последующих edits/history. Дополнительный `Экспорт файла для
переноса` остаётся отдельным действием, также использует ресурсы выбранной
области и не заменяет прежний backup. Не утверждать поддержку файла до
фактического evidence, не менять старый codec и не использовать чужой store по
совпавшему hash.

До перехода на старую установленную PWA или rollback новая версия объясняет:
`Проекты из хранилища для переноса не отображаются в старой версии`. Если для
конкретной пары версий проверены внешний legacy `.interiors` и его импорт,
предложить явно создать файл и импортировать его в старой версии как отдельную
копию; исходник и session history не перемещаются и не синхронизируются. Без
такой проверки путь обозначается как неподтверждённый, без утверждения потери
проекта. Старый клиент нельзя заставить показать это предупреждение задним
числом. Раздельность browser/iOS Home Screen storage сохраняется; облака и
передачи Project, моделей или backup на сервер нет.

**S3: дополнительный путь импорта в Web/PWA — UX-диспозиция.** Прежние
`Импорт` и `Создать резервную копию`, browser exporter и их действующие проверки
сохраняются до полного доказательства FR-44; этот вариант не заменяет их. Если
SPEC-owner подтвердит допустимость registered-transfer ingress и применимый gate
разрешит поставку, рядом с прежним импортом в Projects доступно отдельное явное
действие `Импорт файла для переноса`. Оно открывает существующий выбор локального
`.interiors`, в том числе файла, вынесенного из Telegram. Название объясняет
назначение, но не удостоверяет происхождение файла и не обещает синхронизацию.
До выполнения этих условий действие не объявляется доступным пользователю.

| Исход дополнительного импорта | Поведение |
|---|---|
| Явно выбранный registered-transfer формат распознан и полностью проверен | В отдельной browser-области через общий ImportUseCase и проверенную представимость для прежнего browser backup: staged validation и атомарная публикация создают новый Project ID; существующие Projects и исходный файл не перезаписываются. Отмена не публикует Project. До решения и доказательства требования FR-45 между областями этот маршрут не допускается. |
| Кандидат PPJ, полная проверка недоступна | `Проверка этого файла сейчас недоступна`. Сохранить исходный файл и существующие Projects; не объявлять проверку успешной или файл повреждённым, не начинать импорт до доступности полной проверки. |
| Неоднозначный legacy-файл | `Не удалось безопасно определить формат файла`. Явно отказать без публикации, сохранить исходный файл и показать только действительно проверенный путь восстановления, если он существует. |
| Неподдерживаемый, повреждённый или отклонённый файл | Показать установленную причину и возможность отмены; сохранить исходный файл и Projects. Нет перехода к другому decoder после отказа или автоматического угадывания формата. |

Строгий выбранный ingress не ослабляет зарегистрированную грамматику и использует
тот же ImportUseCase, а не второй путь записи. Успешная integrity-проверка не
доказывает подлинность источника. Старый browser decoder не читает новый
`runtime-v1-wire`; старый импорт сам по себе не подтверждает этот обратный путь.
Доступность дополнительного действия и совместимость конкретных сборок не
утверждаются до решений владельцев и доказательств. Отказ неоднозначному файлу
сам по себе не закрывает FR-57 и не доказывает восстановление.

**S3: дополнительный экспорт Web/PWA — UX-диспозиция, ожидает source и
readiness.** После согласования SPEC/Architecture и применимого gate рядом с
прежним экспортом в действиях конкретного Project в списке Projects и в меню
открытого editor предлагается отдельное явное действие `Экспорт файла для
переноса`. До этого оно не считается доступным. Оно готовит локальный
`.interiors` для переноса, включая пустой Project; старые экспорт, импорт,
browser decoder, default feasibility policy, History, база и проверки остаются.
Ни наличие действия, ни проверка одного файла не закрывают FR-44 для замены
старого exporter или для всех читаемых исторических проектов.

| Состояние дополнительного экспорта | Видимое поведение |
|---|---|
| Подготовка | `Готовим файл для переноса…`; действие читает проверенный Durable Project и его точно закреплённые локальные ресурсы, проверяет checksum, domain/limits и применимый smoke. Экспорт не создаёт Project ID, Command или Revision, не меняет History, Project или исходные resource keys. Нет сетевой передачи файлов. |
| Успешная подготовка | Предложить локальную выдачу файла через существующий системный путь; вызов выдачи ещё не доказывает сохранение вне приложения. Внешний файл и совместимость проверяются повторным выбором и импортом. |
| Непредставимый Project или reader | `Не удалось подготовить этот проект для переноса в текущем формате`. Сохранить Project и ресурсы; не называть их повреждёнными только из-за непредставимости. Прежний экспорт остаётся доступным, но его успешность или совместимость не обещаются без конкретной проверки. |
| Отмена / ошибка подготовки или выдачи | Явно показать отмену либо установленную ошибку и предложить повтор/выход; Project, история и ранее сохранённые файлы не меняются. Частичный результат не называется готовой резервной копией. |

При разрешённой реализации дополнительного действия доверенная browser
composition явно выбирает зарегистрированный V1 writer через
`ExportRuntimePortableBackupUseCase`, использует фактические browser pinned
resources и checksum, readonly domain/limits и применимый smoke. Запрещены
переписывание raw keys, числовая нормализация и отправка на сервер. Для пустого,
комнатного и содержащего модели Project заявлять strict TMA ingress только для
конкретных проверенных wire-файлов; fallback между decoder не допускается.
Обратный registered Web ingress сохраняет точную проверку представимости старым
browser exporter и действующую browser feasibility policy. Права на изменение
этих source contracts принадлежат SPEC/Architecture, не UX.

Для конкретного наблюдаемого ambiguous empty legacy-файла рассматривается
условный явный путь: импорт старым Web → новый registered export → строгий
TMA import, с сохранением исходного файла. Старый Web import создаёт отдельный
Project ID; export не создаёт новый ID, следующий import создаёт свой. Нельзя
предлагать этот путь как доступное восстановление, пока реальные версии,
сохранение и повторный выбор внешнего файла, нативный handoff и результат в
обоих origins не доказаны. Это не свидетельство подлинности источника и не
универсальное принятие legacy; при отсутствии proof результат остаётся
неподтверждённым, исходный файл сохраняется.

Физический roundtrip Web/PWA ↔ Telegram на iOS и Android и необходимые exact
resources/hash/0 мм drift остаются NFR-28/FR-57 evidence, не результатом этого
документа. Если локальная выдача невозможна, зависимая приёмка остаётся открытой
до отдельного решения владельца; автоматический upload не разрешён.

## Планировка и пилот Telegram Mini App

В Telegram человек без опыта CAD открывает проект на телефоне, расставляет
условные предметы по размерам, сравнивает их цвета в 3D и возвращается к
сохранённой расстановке. Локальные проекты Web/PWA сохраняют прежние пути
каталога, измерения, сохранения и переноса. Ноябрьские требования уточняют
поведение Telegram по FR-59–61.

### Расстояния до стен в плане — FR-59 / AD-32

- Размеры показываются автоматически, пока пользователь размещает или
  перемещает напольный предмет в плане. Перемещение, поворот и точный ввод
  обновляют показания из текущего черновика. Статический выбор предмета
  оставляет доступным обычное `Измерить`.
- Четыре направления идут вдоль осей X и Z плана. Линия начинается на краю
  повёрнутого контура предмета и заканчивается у первой встреченной внутренней
  грани комнаты в том же направлении. Используется доступный контур комнаты,
  включая границы ниш и диагонали, представленные принятой производной
  геометрией. Неподдерживаемые в V1 отверстия и вложенные контуры не дают
  основания для направляющих.
  Проём в стене не переводит направляющую в соседнюю комнату. При отсутствии
  надёжного пересечения расстояние за эту сторону скрывается. Касание даёт
  `0 мм`, пересечение показывает существующую подсказку о конфликте.
- Для прямой комнаты `4000 × 3000 мм`, предмета `1000 × 500 мм` с центром в
  `1000 мм` от левой и верхней стен показания слева, справа, сверху и снизу
  составляют `500`, `2500`, `750` и `1750 мм`. Масштаб и панорамирование
  меняют расположение линий на экране. Значения в миллиметрах остаются точными
  по принятой политике форматирования размеров.
- Панель показывает те же доступные значения с подписями `Слева`, `Справа`,
  `Сверху`, `Снизу`. Программа чтения с экрана считывает обновлённое значение
  по запросу и после завершённого шага ввода, без объявления каждого кадра
  перетаскивания. Линии пропускают касания к элементам плана. При нехватке
  места числовые подписи остаются доступны в панели. Приёмка проверяет ниши,
  диагонали, поворот 45°, смену комнаты и два масштаба. Отдельная проверка
  подтверждает отсутствие ложных расстояний у отвергнутых контуров с
  отверстиями и вложенностью.
- Отмена, подтверждение, переход в 3D и потеря действительного черновика
  скрывают направляющие. Они не меняют проект, историю, резервную копию и
  состояние сохранения. Окна, двери и настенные предметы используют свои
  существующие привязки и размеры.

### Условные предметы и палитра — FR-60 / AD-33

- На плане `Добавить → Предмет`, в 3D `Предмет` открывают каталог собственных условных форм в Telegram. Поиск и
  категории ведут к мебели, сантехнике, технике, свету и аксессуарам. Карточка
  показывает понятное название типа, силуэт, габариты в мм и напольную привязку. Применимые «Мои модели», ввод размеров
  и импорт GLB используют те же правила напольного размещения и закрепления.
  Старые настенные предметы сохраняют поддерживаемое редактирование и перенос.
- Выбор локального пресета доступен в подготовленном редакторе при отключённой
  сети и недоступном Catalog Control Plane. Карточка открывает предпросмотр.
  В плане читаются контур и направление, в 3D видны те же габариты и цвет.
  Подтверждение проходит штатный путь сохранения. Пустой результат поиска
  возвращается к списку через `Очистить поиск`.
- В свойствах предмета доступны именованные варианты цвета. Каждый образец
  имеет подпись, состояние выбора и видимую обводку. Цвет отображается в
  доступных проекциях и сохраняется после подтверждения. Отмена сохраняет
  прежний цвет. Undo, redo, повторное открытие и перенос сохраняют смысл
  варианта. Подтверждённые коды цветовых систем могут сопровождать имя
  оттенка. Подпись к палитре объясняет, что цвет на экране ориентировочный.
- Ранее размещённые GLB и смешанные проекты открываются с исходными размерами,
  привязками и ресурсами. При установленном отсутствии или повреждении GLB
  применяются существующие действия восстановления. Каталог условных форм
  не подменяет данные ранее сохранённых экземпляров и их резервных копий.

### 3D во время подготовки модели — FR-21–23/25/28/55

При медленной подготовке ссылочной модели предыдущее состояние комнаты остаётся
на экране, а предпросмотр занимает конечную позицию и габариты. Видимое
состояние подготовки сохраняет `Отменить`. Замена временной формы готовой
моделью не сбрасывает масштаб, камеру, скрытие стен и выбранную позицию. Сбой
загрузки даёт повтор или отмену. Потеря WebGL возвращает временную сцену из
данных проекта либо предлагает доступный план. Доступность проверяется при
холодном, медленном и тёплом открытии 3D.

### Добровольная статистика и оценка — FR-61 / NFR-29 / AD-34

**Путь новой версии.** Пользователь читает действующую политику и лицензию перед началом работы, принимает эту редакцию либо просматривает и выгружает существующий проект. Основной счётчик открытий по умолчанию включён. Его можно выключить до входа или позднее в настройках. Для подсчёта повторных открытий с устройства нужен отдельный явный выбор. Отказ и закрытие оставляют редактор доступным. Отзыв и новое согласие начинают новый местный отсчёт. Текст на первом экране кратко объясняет пользу статистики и сохранность файлов, планов и Telegram ID. Подробности о двух суточных итогах и технической видимости IP доступны по ссылке. «Назад» возвращает к месту вызова и прежнему фокусу. [Условия выпуска](../../sprint-change-proposal-2026-11-22-public-candidate.md)

**Исторический пилот с SDK и оценками.** Следующие сценарии относятся к прежнему выпуску.

- Внизу экрана «Проекты» ссылка «Настройки статистики» раскрывает строку
  «Статистика использования» с переключателем и коротким пояснением о Яндекс
  Метрике. Подробности о данных и хранении раскрываются отдельно. Переключатель
  изначально выключен. Включение разрешает отправку, выключение отзывает согласие.
  Закрытие раздела сохраняет выбор. Отзыв прекращает
  новые отправки и сбрасывает ожидающие события. Выбор не прерывает открытие
  и сохранение проектов.
- Пока согласия нет, счётчик и его запросы отсутствуют. Включённая статистика
  считает запуск и возвращаемость только в пределах согласившейся аудитории.
  Для пользовательских действий берутся только подтверждённые результаты и
  разрешённые параметры. Короткий код источника пилота определяется из
  проверенного поля запуска по списку разрешённых значений. Частные данные
  проекта и Telegram не передаются.
- При включённой статистике после первого сохранённого сценария может
  появиться ненавязчивое `Оценить` в Projects. Его также можно открыть вручную
  из панели. Вопрос `Удалось собрать планировку?` даёт ответы `Да` и `Нет`.
  Удовлетворённость оценивается по шкале от 1 `Очень неудобно` до 5 `Очень
  удобно`. Подписанные варианты доступны с клавиатуры и через программу чтения
  с экрана в порядке чтения.
  Отправка требует явного действия `Отправить`. `Пропустить` или Back закрывает
  приглашение без записи оценки. Сценарий с выключенной статистикой показывает
  выбор согласия только по явному запросу об отправке оценки.
- Панель не появляется над правкой, подтверждением или восстановлением.
  Текстовый отзыв доступен как отдельное добровольное действие при наличии
  настроенного канала. В счётчик поступают только выбранная оценка и ответ
  на вопрос о завершении планировки. Эти ответы отделены от статистики действий.

# Inspiration & Anti-patterns

- **Planner 5D — перенимаем:** быстрый 2D/3D loop, каталожный entry point,
  крупный canvas и понятное размещение предмета.
- **Planner 5D — не переносим:** subscription/commerce framing, tool-density,
  AI scan, AR, фоторендеры, чужой каталог и desktop-toolbar.
- **Telegram Mini Apps — перенимаем:** compact header, list rows, dynamic theme,
  safe areas, responsive mobile-first behavior и labelled inputs.
- **Telegram Mini Apps — не переносим:** cloud storage, host button
  как единственный critical control или визуальную копию бренда.
- **Отвергается:** carousels, gamification, badge clutter, длинный onboarding,
  hover-only affordances, modal stack > 1 и generic error dialogs.

# Product Invariants Mapping

| UX rule | Защищаемые contracts |
|---|---|
| Exact mm input, candidate text, no visual-grid authority | CAP-2/3, FR-6–13, NFR-1–4, AD-1/AD-7/AD-20 |
| Геометрия Room производная; пол, тип и высота через параметры комнаты | CAP-3/5, FR-14–16/64, AD-1/6/41 |
| Wall-hosted Opening, no Door transition/access state | CAP-4, FR-17–19, AD-6/AD-22 |
| Plan/3D share selection; camera disposable | CAP-5, FR-21–25, AD-5/AD-10/AD-23 |
| PlacementPreview before canonical command, same +Z | CAP-6/8, FR-28–31/38–40, AD-3/AD-8/AD-23 |
| Pin/backup progress before durable item | CAP-6/7/10, FR-28/33/44, AD-4/AD-14 |
| Explicit durability, recovery, history and writer state | CAP-1/8/10, FR-5/38/43–47, NFR-3/10–13, AD-3/AD-4/AD-11 |
| Catalog outage distinct from resource recovery | CAP-6/9, FR-26/42/54, NFR-10/13/21, AD-14/AD-17 |
| Safe-area, DOM alternative, reduced motion | NFR-17–20, AD-12/AD-16 |
| Telegram host, scoped storage, handoff и lifecycle | CAP-1/8–11, FR-41–45/47/55–58, NFR-10/17–20/28, AD-3/4/9/11/13/16 |
| Расстояния черновика в Telegram | CAP-2/6/13, FR-13/29/59, NFR-17–19/26, AD-1/20/32 |
| Условные предметы, палитра и сохранность ресурсов | CAP-6/7/10/13, FR-26–33/44/60, NFR-3/10/13, AD-4/8/14/33 |
| Добровольная статистика и оценка в Telegram | CAP-13, FR-61, NFR-21/23/25/29, AD-34 |
| Browser merged directory и изолированный transfer storage | CAP-1/8–10/13, FR-44/45/47/57/58, NFR-10/13, AD-4/25/30/31; applicability и evidence pending |
| Смешанная толщина, покрытия, варианты проёмов | CAP-2–5/8/13/14, FR-63–65, AD-41/43 |
| Именованная площадка, комплект опоры и гостей, локальный перенос | CAP-5–8/10/13/14, FR-66–67, AD-40/42/43 |
| История снятых возможностей Alpha | Retired FR-34–37/46/53, NFR-21. Покрытия мобильной TMA регулируются FR-64. |

# Key Flows

Все flows ниже закрывают PRD journeys `UJ-1`–`UJ-7` и `UJ-A1`. Визуальные
композиции следуют [brief исправлений](mockups/correction-brief-2026-08-30.md);
при конфликте этот spine и DESIGN.md важнее референсного PNG.

## UXF-1 / UJ-1 — Анна проверяет кровать

1. Анна открывает PWA без регистрации, выбирает `Новый проект` и starter
   `Комната`.
2. В Geometry sheet она вводит внутреннюю ширину, глубину и высоту в `мм`.
   Предпросмотр остаётся draft до `Создать`.
3. После Durable Revision Plan показывает derived Room. Анна выбирает Wall и
   через `Добавить проём` последовательно добавляет Door и Window с
   width/height/offset и соответствующим `sillMm`.
4. В CatalogueSheet она выбирает кровать, ждёт pin + backup preparation и
   получает `Предпросмотр — не сохранено` с footprint и проходом.
5. В numeric sheet она уточняет position кровати в `мм`; preview валидирует
   тот же host, footprint и clearance, не создавая command.
6. Она подтверждает `Поставить`, ждёт `Сохраняем…` и переключается в `3D`.
7. **Climax:** тот же предмет в 3D показывает, что проход слишком узок; Анна
   принимает решение до покупки, а header уже показывает `Сохранено`.

Failure: при попытке вытащить кровать за границу или в collision preview
показывает причину и сохраняет последнее валидное положение; Project и history
не получают новую command.

## UXF-2 / UJ-2 — Михаил строит диагональную стену

1. Михаил начинает с Empty Plan и создаёт несколько orthogonal Wall через
   explicit non-zero drags.
2. Для диагонали он открывает numeric route, выбирает 45° quadrant и видит
   origin, returned candidate class и signed `Δx/Δz`.
3. Измеренный конец не совпадает с grid: он вводит точные integer `мм`.
   Интерфейс помечает значение как exact non-grid, а не исправляет его.
4. На T/X contact preview перечисляет последствия до одного confirm.
5. Valid topology публикуется одной Durable Revision; новая derived Room
   появляется сразу с унаследованным `heightMm`, без выбора «левой» или
   «правой» Room. Михаил добавляет Opening после selection Wall с
   width/height/offset и `sillMm`.
6. **Climax:** он переключается в `3D` и видит те же Wall и Opening как в
   Plan; view change не создаёт вторую mutation.

Failure: stale/non-invertible projection сохраняет raw draft в
`SelectionUnavailable` с `Повторить`, pan/zoom и numeric route. Wrong direction,
overlap или rejected candidate не создают Command, Revision или History.

## UXF-3 / UJ-3 — Анна сравнивает расстановку

1. Анна открывает `Предмет` и выбирает диван, шкаф, технику, сантехнику, ковёр,
   растение или зеркало из representative catalog либо готовых внутренних
   placeholder.
2. Каждый asset проходит preparation → cancelable PlacementPreview →
   `Поставить` → Durable status. В 2D и 3D видны одинаковые footprint,
   selection outline и front marker `+Z`.
3. У выбранного AssetInstance она меняет только объявленный вариант/цвет и
   поворачивает предмет через одну placement command; пол и стены остаются
   нейтральными display-projections.
4. Collision не допускает commit и объясняется рядом с preview.
5. **Climax:** Анна нажимает `Undo`, затем `Redo` и мгновенно сравнивает две
   сохранённые расстановки в том же Project — без дубликата Project и без
   потери exact placement.

Failure: при session retention reject следующая command не начинается; UI
сохраняет существующую историю и предлагает безопасный путь, а не обрывает
undo/redo молча.

## UXF-4 / UJ-4 — Сергей продолжает без сети

1. Сергей открывает ранее установленную PWA в airplane mode и выбирает
   сохранённый Project.
2. Неблокирующий StatusBanner говорит `Офлайн — работаем на устройстве`;
   Plan, pinned assets, undo/redo и backup остаются доступны в подготовленной PWA.
3. Он меняет length Wall и положение техники. Header показывает
   `Сохраняем…` только в pending durability.
4. **Climax:** после atomic publication появляется `Сохранено`; Сергей
   закрывает приложение и повторно открывает ту же Durable Revision.
5. Когда доступно обновление PWA, reload предлагается только после Durable
   boundary и не прерывает draft/active session.

Failure: post-validation persist failure — отдельный blocking sheet
`Не удалось сохранить изменение`: последняя Durable Revision не изменена,
доступны `Повторить сохранение` и recovery export. Это не выглядит как catalog
outage и не обещает, что pending candidate уже сохранён.

## UXF-5 / UJ-5 — Ольга создаёт отсутствующий предмет

1. Ольга открывает route `Свой предмет` из catalogue и выбирает
   `Параметрический placeholder`.
2. Она вводит width, depth, height, color и AnchorClass; sheet показывает
   candidate, compatible host и единицы `мм`.
3. После validation появляется PlacementPreview, а `Поставить` остаётся
   единственным переходом к canonical AssetInstance.
4. **Climax:** предмет сразу участвует в 2D/3D, collision, autosave и backup
   так же, как разрешённый AssetInstance, и его можно проверить рядом с мебелью.

Failure: выход за Project Limits или incompatible AnchorClass даёт inline
reason; последняя Durable Revision не меняется, а исходный draft можно
исправить или отменить.

## UXF-6 / UJ-6 — Анна переносит проект между contexts

1. В Safari Анна открывает Project menu и выбирает `Создать резервную копию`.
2. Export собирает versioned self-contained backup с canonical Project и exact
   referenced resources; network не обязателен для healthy Durable Project.
3. В Home Screen PWA она выбирает `Импорт`, проходит staged validation и видит
   progress/recoverable reason до publication.
4. **Climax:** import создаёт новый Project ID с теми же точными размерами,
   derived Rooms, Openings, AssetInstances и resources; Анна продолжает его
   локально без обещания общего browser storage или account sync.

Failure: старая schema или integrity issue не перезаписывает исходный Project:
import останавливается с recoverable error и route к исходному backup.

Исторический `UXF-7` относился к retired Focus и не переиспользуется.

## UXF-8 / UJ-7 — Анна переносит проект в Telegram

1. Анна явно экспортирует подготовленный Portable Backup из Web/PWA и сохраняет
   внешний файл; для нового зарегистрированного wire использует дополнительный
   экспорт только после его допуска и поставки. Исходный Project остаётся в
   прежнем контексте; старый ambiguous empty legacy сам по себе не доказывает
   возможность строгого Telegram import.
2. Онлайн открывает Telegram entry. После проверки host, identity и совместимости
   видит Projects своей локальной области; никакой синхронизации не обещается.
3. Выбирает файл для импорта; staged validation проверяет формат и ресурсы.
4. **Climax:** успешная атомарная публикация создаёт новый Project с теми же
   размерами, привязками и exact ресурсами; исходная копия не перезаписывается.
5. Анна изменяет план, размещает подготовленный предмет, проверяет результат в
   3D и дожидается `Сохранено`. Она закрывает и открывает Project, возвращаясь к
   последней Durable Revision.
6. При доступном локальном handoff она выносит backup обратно в Web/PWA;
   после допуска и поставки дополнительного маршрута выбирает `Импорт файла
   для переноса` и проверяет внешнюю копию повторным импортом. До этого
   совместимость нового wire-файла со старым browser import не обещается.

Failure: invalid host/identity или SDK timeout дают retry/выход и Web-ссылку;
неподдерживаемый файл, отмена, ошибка или недоступная выдача не создают частичный
Project и не утверждают успешный backup. Без физического roundtrip путь остаётся
планом, не подтверждённой совместимостью.

## UXF-9 / UJ-1 и UJ-3 — Анна проверяет расстановку в Telegram

1. Анна открывает Telegram Mini App и создаёт комнату с внутренними размерами.
2. Через `Добавить → Предмет` она выбирает условный шкаф и перемещает его в плане. Размерные
   линии показывают зазоры до стен, а точные значения доступны в панели.
3. Она подтверждает размещение, выбирает цвет шкафа в его свойствах и
   добавляет стул другого цвета. Оба предмета сохраняются в проекте.
4. В `3D` Анна сравнивает габариты и цвета. Затем возвращается к списку и
   открывает ту же расстановку с последней сохранённой версией.
5. При желании Анна разрешает статистику и отвечает, удалось ли собрать
   планировку и насколько удобным был редактор. Редактирование доступно при
   любом выборе.

## UXF-A1 / UJ-A1 — Ольга импортирует static GLB (Alpha+)

1. Только при включённом Alpha+ Ольга выбирает один локальный `.glb`; `.gltf`,
   OBJ, FBX и archives отклоняются до loader.
2. Byte-level preflight показывает размер, заявленные resources и понятную
   причину reject; Project в этот момент не меняется.
3. Safe preview просит подтвердить реальные dimensions, axes, AnchorClass и
   host semantics, после чего применяет тот же pin + backup route, что и catalog
   resource.
4. **Climax:** только после успешной подготовки Ольга получает
   PlacementPreview и может подтвердить один Durable AssetInstance в 2D и 3D.

Failure: unsupported, unsafe или oversized file остаётся вне Project и не
попадает в history/backup. Cancel на любом preflight/preview шаге возвращает в
catalogue без mutation.

## Расстановка и шторки, 22 ноября

На плане Telegram один контакт изменяет черновик, второй возвращает
позу перед жестом и передаёт управление масштабу и сдвигу плана.
Переход между видами сохраняет черновик и поддерживаемую привязку. Цвет
доступен в 3D. Разблокированный напольный предмет имеет видимое кольцо и
путь к точному углу в обоих видах. Поля зазоров применяют значения в мм
по правилам FR-59 и AD-32. В модальных панелях Tab обходит доступные
контролы, крестик и Escape закрывают чистую верхнюю панель с возвратом
фокуса. Telegram Back учитывает состояние черновика и сохранения.
«Помещения» сохраняют выбор типа и высоты по FR-16.
[Критерии приёмки](../../sprint-change-proposal-2026-11-22-mobile-editor-finish.md).

В Telegram модальные формы открываются по геометрии «Размеров» от нижнего
края. Фон затемнён и исключён из ввода. При уменьшении доступной высоты
сохраняются прокрутка, доступ к закрытию и действиям. Системное уменьшение
движения отменяет анимацию входа. Черновики с жестами содержат панель у
нижнего края и оставляют холст интерактивным. [Критерии геометрии](../../../implementation-artifacts/tma-sheet-visual-alignment-2026-11-22.md)

## Мобильная TMA · сценарии 23 ноября

### Общая шторка и фокус

Одна нижняя оболочка определяет шапку, доступную высоту, прокрутку,
безопасные зоны, клавиатуру и фокус. Форма «Изменить окно» задаёт
компоновку «Добавить», каталога и свойств стены или предмета. Вертикальный
жест прокручивает содержимое внутри шторки. Карточка под начавшейся
прокруткой остаётся доступной после завершения жеста. Короткие подтверждения
сохраняют текущие кнопки и политику доступа к холсту. При смене вкладки,
повороте экрана и появлении клавиатуры сохраняются значения, каретка и выбор.
Нижние действия доступны прокруткой.

Модальный режим исключает фон из касаний и из порядка фокуса. Цикл Tab
остаётся внутри верхнего уровня. В панелях точной правки, которым нужен
план, сохраняются доступ к холсту и навигация двумя контактами. Дочерняя
форма получает фокус и приостанавливает родительскую. После отмены
восстанавливаются элемент вызова, ввод и каретка. Если элемент исчез,
выбирается ближайший доступный смысловой контроль, затем шапка редактора.
Двойное событие Back не обрабатывает два уровня.

Крестик, «Назад» Telegram или редактора и Escape
проходят одну проверку. Чистая панель закрывается сразу. При черновике
доступны возврат к правке и явная отмена. При ожидающей записи панель ждёт
исхода; фокус остаётся на доступном статусе. При установленном сбое остаются
текст результата, повтор и применимый путь выгрузки для восстановления.
Отмена дочернего предупреждения не отбрасывает родительский черновик.

| Вход и содержимое | Режим и холст | Начальный фокус → возврат |
| --- | --- | --- |
| План → «Добавить» и выбор вида проёма от стены | Неподвижная модальная; переход к выбору места освобождает холст | Первая строка или выбранный тип → «Добавить» или действие выбранной стены |
| Указать стену через список; свойства, создание и редактирование двери или окна | Список и подробные параметры модальны; компактное позиционирование и подтверждение оставляют план | Подходящая стена или заголовок параметров → «Выбрать стену», «Параметры» или вызвавшая стена |
| «Помещения», свойства стены, точная длина, перемещение вершины, точный ввод плана, фильтр «Размеры» | Длинные списки и формы прокручиваются; ввод с интерактивным черновиком сохраняет холст, модальные настройки блокируют его | Заголовок, выбранная строка или первое поле → вызвавшая кнопка, стена или план |
| Каталог, «Мои модели», импорт GLB, «По размерам», просмотр модели и ошибка подготовки | Неподвижная модальная, единая область прокрутки карточек; подготовка и ошибка остаются в этой оболочке | Заголовок или текущая карточка → «Предмет», исходная карточка или действие каталога |
| Параметры напольного предмета и поддерживаемые параметры старого настенного предмета | Неподвижная; все вкладки открыты снизу поверх холста. «Свойства стены» используют ту же оболочку | Активная вкладка или заголовок → действие «Параметры» предмета |
| Черновик предмета в 2D/3D, копия, закреплённые снизу действия режима построения | Компактная, холст доступен, статическое подтверждение без ручки | Контроль режима, если вызван кнопкой → предмет, проём или вызвавшее действие |
| 3D-палитра, вариант, фильтр, меню редактора «Ещё», выбор типа помещения | Верхняя модальная форма; состояние родительской поверхности сохраняется | Текущий выбор или заголовок → вызвавшее действие, для палитры «Цвет» |
| Настройки, вложенная «Статистика», переименование из редактора и списка проектов, настройки в режиме чтения | Модальные формы; фон неактивен | Заголовок, текущий переключатель или поле имени → настройки, кнопка карточки или меню |
| Удаление предмета/проекта, перезапуск, потеря черновика, последствия стены, точное ресурсное восстановление, удаление повреждённой истории, нижние предупреждения и отказы | Неподвижное подтверждение или прокручиваемые последствия; модальный приоритет и защита записи | «Отмена»/безопасное действие → прежнее действие и ввод; после успешного удаления ближайший оставшийся элемент |
| A/B, создание, переименование, удаление варианта и предупреждение конфликта | Верхнее содержимое общей оболочки, при сравнении холст доступен после выхода из списка | Текущая расстановка/поле имени; при удалении «Отмена» → «Расстановки» или активный набор |

В инвентаризацию входят шторки из режима чтения и редкие ветки ошибки.
Штатные полноэкранные списки, создание проекта и чтение документов имеют
собственную навигацию. Клавиатура, системный выбор и выдача файла управляются
ОС. Реализация подтверждает все входы по реестру компонентов и модель
единственной оболочки. [Исходный реестр](../../../specs/spec-tma-furniture-clearance/shared-bottom-sheet.md) · [Аудит текущей TMA](../../../implementation-artifacts/tma-sheet-visual-alignment-2026-11-22.md)

### Анна ставит дверь, когда стена ещё не выбрана

1. На обычном плане Анна нажимает «Добавить» в третьей позиции. Порядок
   DOM и чтения совпадает с визуальным: «Комната», «Стена», «Добавить»,
   «Выбор». Последняя кнопка озвучивается как «Выбор и перемещение» и
   сообщает активное состояние.
2. Анна выбирает «Дверь» или «Окно». «Предмет» из этой же шторки открывает
   каталог. При пустом плане после выбора типа доступно «Нарисовать стену».
   При наличии стен холст освобождается, подходящие стены подсвечены, текст
   называет выбранный тип. «Выбрать стену» открывает доступный список с
   именами и положением стен плюс точным вводом смещения. Подходящая уже
   выбранная стена даёт сокращённый маршрут к месту. Неверная стена или
   участок объясняют причину и оставляют возможность выбрать другое место.
   До появления черновика Back возвращает фокус на выбранную строку
   «Дверь» или «Окно».
3. Анна указывает место. **Результат:** на плане видны оба края одного
   черновика, в том числе при движении вдоль нижней или правой стены.
   Во время жеста подробная форма не закрывает проём. После отпускания
   видны «Отменить», «Подтвердить» и доступ к «Параметрам». Параметры
   включают ширину, высоту, смещение, порог/подоконник и поддерживаемые
   настройки двери, включая стороны и петлю. «Подтвердить» публикует одну
   валидированную команду. Back проходит защиту; отмена возвращает прежнюю
   ревизию и фокус на вызвавший элемент. Для сохранённого окна в форме
   «Изменить окно» Анна меняет ширину и высоту. Смещение и отметка
   подоконника сохраняют точные значения из ревизии. Новые окна получают
   подоконник на 900 мм. Для сохранённых одинаковых окон с разными
   отметками в этой форме доступно «Выровнять окна». Применение выравнивает
   нижние края и добавляет одну запись Undo.
4. Анна перетаскивает ранее сохранённое окно или дверь. Размер движется
   вместе с двумя краями. При отпускании на допустимой позиции изменение
   сохраняется сразу. Undo возвращает исходную позицию.

### Анна уточняет параметры кровати

«Размеры» — первая вкладка. Ширина, глубина и высота вводятся в мм у
изменяемых предметов. Потеря фокуса сохраняет введённое число. У фиксированных моделей те же данные доступны для
чтения. «До стен» показывает «Слева», «Справа», «Сверху», «Снизу». Фокус
выделяет соответствующую направляющую. Потеря фокуса применяет отступ,
остальные три значения пересчитываются. Если расстояние недоступно, поле
показывает прочерк с причиной. При ошибке сохраняются последний допустимый
черновик и введённый текст с сообщением рядом. Проверка: 1950 → 1850 мм
слева, 415 → 515 мм справа, сверху 650 мм, снизу 1315 мм, габариты
1600 × 2000 × 500 мм. Отдельно изменить ширину до 1700 мм и проверить reopen.

«Настройки» сразу показывают «Дублировать», «Заблокировать» /
«Разблокировать» и «Удалить предмет». Заблокированный предмет можно
дублировать; копия разблокирована. Удаление заблокированного предмета
недоступно, в режиме чтения недоступна запись. Удаление требует отдельного
подтверждения. Отмена возвращает фокус к «Удалить предмет» в «Настройках».
Прямое дублирование сразу после выбора предмета остаётся на плане и в 3D.

Шапка, положение у нижнего края и модальный слой общие для всех
вкладок. Поля и ошибки сохраняются при смене вкладки. Палитру Анна
открывает из выбранного предмета в 3D.

При пересечении с другой мебелью редактор показывает конфликт. Если Анна
отпускает предмет в конфликтной позиции, предмет возвращается в сохранённое
положение. Для нового предмета в конфликтной позиции подтверждение
недоступно. Точный ввод, поворот и числовой отступ действуют по тому же
правилу. Сохранённое до обновления пересечение можно устранить переносом
на свободное место.

### Каталог, история и 3D

- Группы Undo/Redo и масштаба имеют раздельную геометрию и фокус. В узком
  или коротком вьюпорте группы могут оказаться на разных высотах. Двухпальцевый
  жест управляет холстом, кнопки остаются доступной альтернативой.
- Панель вращения размещается в свободной области плана над карточкой
  «Параметры». Проверяются первое выделение, смена предмета, масштаб,
  короткое окно и изменение высоты из-за клавиатуры.
- Высокая неподвижная шторка каталога сразу показывает прокручиваемую
  сетку. Компактные фильтры и поиск остаются доступны. Импорт собственного
  GLB находится во вкладке «Мои модели». Карточка под начавшейся прокруткой не запускает постановку. Поиск с открытой
  клавиатурой сохраняет доступ к последнему результату, очистке и закрытию.
  Предлагаемая UX-цель по PRD при обычном тексте и закрытой клавиатуре:
  минимум 60% видимой высоты шторки под сетку и два полных ряда при
  наличии четырёх моделей на 360 × 800 и 390 × 844 CSS px. При 200% цель
  проверки — читаемость и доступ ко всем результатам и действиям.
- «Авто» делит обход на восемь секторов по 45°. Четыре фронтальных сектора
  скрывают одну переднюю фасадную сторону, четыре угловых — две соседние,
  на прямоугольнике. Для ступенчатого контура открываются все видимые
  передние участки в направлении сектора. Проёмы и отделка следуют за
  видимостью опорной стены. Дальние и внутренние стены сохраняются.
  При границе ±22,5° сохраняется прежний сектор, а без предыдущего
  применяется стабильный выбор. В обе стороны переход устойчив к малым
  колебаниям. «Все стены» восстанавливает полную сцену с той же камерой,
  целью, масштабом и выбором. Проверка повторяет ракурс на прямоугольнике,
  разбитом фасаде с проёмом, Г-образной комнате, диагонали и плане с двумя
  комнатами.
- «Дублировать» сразу открывает черновик в текущем виде. Сохраняются
  размер, цвет, точный угол и привязка к ресурсу источника; у копии новое
  положение и состояние выбора. Подтверждение добавляет один предмет.
  Отмена, повторный выбор, нехватка места и отсутствие права записи
  не меняют источник. Отдельно пройти 2D и 3D со стулом цвета «Орех»
  под углом 37,5°.
- План показывает расстояния от напольного предмета до стен. Точный
  ввод отступа и проверка пересечения стен остаются доступны при работе
  с планом.

### Анна сравнивает две расстановки спальни

1. Анна открывает «Расстановки» из выбранного предмета или «Помещений» и
   видит название комнаты и текущий набор. Сохранённая мебель образует A.
   «Создать вариант B» берёт последнюю сохранённую меблировку, создаёт B и
   открывает его. Для пустой комнаты доступны два пустых набора. Повторное
   действие ограничено двумя вариантами, оба имени доступны для изменения.
2. Анна сдвигает шкаф, дублирует стул и переключает A/B. **Результат:** 2D
   сохраняет положение и масштаб, 3D сохраняет ракурс и масштаб. Видны
   активные предметы каждой комнаты, общая геометрия и прежние настенные
   предметы. Выбор скрытого предмета снимается. В черновике
   доступны завершение, явная отмена и возврат к правке. При ожидающей
   записи переключение ждёт исхода. Выбор видимого набора относится к
   просмотру; при отсутствии локального предпочтения открывается первая
   существующая расстановка. Возврат к последнему выбору на этом же
   устройстве проверяется как UX-гипотеза.
3. Анна переименовывает B. Удаление отдельно называет комнату, удаляемый
   и остающийся набор. Последний набор защищён. При удалении активной
   расстановки открывается оставшаяся. Запись, переименование, мебельные
   правки и удаление входят в одну историю. Undo/Redo скрытой правки
   называет расстановку и предлагает её посмотреть. Общие стены и
   проёмы валидируются с мебелью обеих расстановок, конфликт указывает
   комнату, вариант и предмет. Неоднозначное объединение двух комнат с
   A/B в каждой сохраняет исходное состояние и объясняет отказ.
4. После reopen или импорта одного .interiors обе расстановки, их имена и
   все точные ресурсы доступны. Чтение старого файла показывает A и
   сохраняет угол, цвет, размеры и привязки; просмотр не инициирует запись.
   Защита скрытого ресурса, его повреждение, нехватка места, отказ записи
   и откат проверяются по FR-62. Несовместимый читатель даёт безопасный
   отказ, а совместимая сборка отката восстанавливает оба набора.
   Перед включением записи требуется реальный внешний перенос iOS → Android
   и Android → iOS, включая совместимую сборку отката.
   [Проверки переноса и восстановления](../../../specs/spec-tma-furniture-clearance/room-layouts-and-item-copies.md)

### Матрица проверки и источники решений

| Сценарий | Трассировка | Приёмка |
| --- | --- | --- |
| Футер, проёмы и одна оболочка | CAP-2/4/6/8/13 · FR-17–19/26/38/39/55 · AD-3/6/7/25/27/36 | Сравнить высоту и центры с текущей сборкой на 320/360/390 CSS px. Поставить оба типа без выбора и с выбранной стеной; пройти все входы, подтверждение, Back и возврат фокуса. |
| Параметры, цвет, каталог, копия и история | CAP-2/6/7/8/13 · FR-26/28–30/38/39/55/59/60 · AD-3/8/25/32/33/35 | Пройти вкладки, ввод, невалидное значение, палитру, скрытый край карточек, блокировку, отмену и повторное открытие. Проверить копию в каждом виде. |
| «Авто» и отступы до стен | CAP-2/3/5/6/8/13 · FR-13/23/29/31/39/55/59 · AD-1/3/7/8/25/32/35 | Зафиксировать восемь секторов в двух направлениях и неизменную камеру. Независимо проверить четыре отступа и их пересчёт после ввода. |
| A/B | CAP-1/3/5/6/8/10/13, предлагаемый CAP-14 · FR-5/14/15/28–30/38/39/43–45/55–58/62 · NFR-1/3/10–13/21/24 · AD-1/3/4/6/8/25–30/35 | Старый файл, две расстановки, скрытый ресурс, разделение и конфликт общей правки, история, одна резервная копия, совместимый откат и обе физические ОС. |

Для каждой строки применяются NFR-17–20/26/28. В обеих темах пройти узкий портрет
и короткий ландшафт, штатный текст и 200%, экранную клавиатуру и безопасные
зоны с четырёх сторон. Проверить цели от 44 × 44 CSS px, видимый фокус,
озвучивание имени/состояния/ошибки, сокращение анимации, порядок Tab и Back,
кнопочную альтернативу свайпу, список вместо выбора на холсте, отмену и
защиту черновика. Playwright MCP фиксирует сборку и результаты в мобильном
контуре TMA. Физическая приёмка фиксирует модель телефона, ОС и версию
Telegram по NFR-28; проверки симулятора учитываются отдельно.

Анкеты № 1–6 о прежнем ремонте описывают пять конкретных случаев, пять
выборов из альтернатив, два прямых сравнения компоновки и четыре обсуждения.
Они обосновывают проверку пользы замера. № 7 описывает работу с редактором;
Android подтверждён для каталога, устройство остальных эпизодов неизвестно.
Запрос о параметрах кровати исходит от другого пользователя Android.
Дублирование и две сохраняемые расстановки добавлены владельцем. Показ
размера близкому человеку остаётся следующей гипотезой на подготовленных
изображениях; публикация изображений и ссылок требует отдельного решения,
FR-46 снят. Правый столбец параметров остаётся предметом исследования.
Фон, цены, вместимость, полки, электрика и материалы остаются вне пакета.
[Классификация наблюдений](../../../specs/spec-tma-furniture-clearance/interview-findings.md)

Для Architecture остаются версия формата A/B и совместимый путь чтения,
записи и отката, привязка обеих мебельных групп при изменении топологии,
защита скрытых ресурсов и межклиентский roundtrip. В UX остаётся проверка
возврата к последнему показанному варианту на том же устройстве. До
закрепления идентификатора в канонической SPEC CAP-14 остаётся предлагаемым.

## Анна обустраивает гостиную в Telegram · FR-63–67

1. **Стена.** В инструменте Анна задаёт профиль очередного сегмента и
   доводит его до конца штатным жестом или точным вводом. При входе
   выбрана «Перегородка». В текущей серии следующий сегмент наследует
   выбор. Прямоугольный стартер остаётся однопрофильным. Свойства дают
   фактические миллиметры и роль. Split наследует оба параметра и отделку
   физической стороны. Команда объединения, теряющая границу профиля,
   толщины или отделки, отклоняется с объяснением. Приёмка даёт единый
   стык для прямого участка, 90° и 45°, полезный контур и нулевой
   допустимый зазор от внутренней грани. Общие команды проверяют мебель
   обоих вариантов, включая зафиксированные экземпляры.
2. **Пол и отделка стороны.** Анна выбирает деталь в параметрах нужной
   комнаты или «Свойствах стены». «По умолчанию» возвращает тематический
   материал. При выборе стороны видны её положение и примыкающая комната
   или наружная сторона. План выделяет конкретную грань, 3D показывает
   её покрытие. Для скрытой грани работают «План» и «Все стены» с тем же
   выбором. Разворот сохраняет покрытие на физической стороне. Две стороны
   общей стены независимы. Split комнаты передаёт пол обеим частям с
   прежней пространственной фазой. Merge с разными полами предлагает
   выбрать одну из двух отделок или отменить всю правку. Примерка
   обратима, подтверждение создаёт одну запись.
3. **Дверь или окно.** «Добавить» оставляет прежние входы по типу проёма.
   После выбора стены/позиции подробные параметры показывают вариант
   и только его поля. Глухая и остеклённая распашные двери сохраняют
   четыре комбинации петель и стороны. При переходе на раздвижную
   сохраняется сторона прежнего распахивания и явно выбирается направление.
   При обратном переходе видны соответствующая сторона и редактируемая
   петля у начала сегмента. Undo возвращает исходную конфигурацию.
   Сдвиг длиной в ширину проёма проверяется на одном хосте. При split за
   пределы одного хоста правка отклоняется. Отказ отличает край стены,
   соседний проём и препятствие, в том числе в скрытом варианте. При
   обратной последовательности проверяется попытка сдвинуть препятствие
   к существующей двери. Явно выбранное число секций окна переживает
   изменение ширины. Старое окно читает автоделение до первого выбора
   одной или двух секций.
4. **Декор.** Анна выбирает кашпо или карточку настольной лампы, книги,
   вазы. Цель «На полу» сохраняется при касании столешницы и показывает
   возможность явного переключения. При выборе мебели 3D показывает
   площадку, подпись опоры и фактическую позу. Недоступная цель
   объясняется без автоматического перемещения на пол. В плане и 3D
   список различает совпавшие по проекции уровни снизу вверх, называет
   экземпляр и выделяет строку текущего уровня. Поля дают точные
   локальные смещения и относительный угол. Вычисленная высота основания
   доступна для чтения. Смена вида переносит тот же черновик.
5. **Проверка площадки.** Верх стола, письменного и журнального столов,
   тумбочки, комода и тумбы под телевизор принимает разрешённый декор.
   У стеллажа пять именованных уровней снизу вверх, в том числе верх
   с просветом до потолка. Основание целиком лежит в рабочем контуре.
   Касание границ допустимо при свободных внутренних объёмах. Отказ
   называет недостающий просвет, препятствие или выход за край. Для
   обычной напольной мебели действуют штатные проверки. Совпадающая
   проекция гостей разных уровней допустима при свободных объёмах.
   Стул и пользовательский GLB не принимают декор. Для старого
   параметрического экземпляра без подтверждённого шаблона доступно
   обратимое явное назначение встроенного шаблона при сохранении позы,
   размеров и цвета.
6. **Комплект и история.** Перемещение, поворот и resize опоры показывают
   гостей в вычисленной позе. Локальные смещения в мм сохраняются при
   resize. Конфликт или замок любого затронутого экземпляра отклоняет
   изменение комплекта. «Переставить предметы» показывает список
   гостей и поочерёдный выбор свободных мест, «Удалить вместе» —
   явное подтверждение состава. Удаление и перестановки публикуются
   одной командой, отмена оставляет прежние связи. Самостоятельная
   копия и копия комплекта начинаются разблокированным черновиком.
   Копирование A/B наследует замки и переназначает связи к собственным
   новым ID. При переключении скрытые гости уходят из выбора, камера
   и масштаб сохраняются. Оба набора используют общую отделку.
7. **Локальный перенос.** Анна открывает штатно экспортированный файл
   «Гостиная с читальным уголком.interiors», импортирует его в чистый
   профиль и повторно открывает новый локальный проект. Простое открытие
   прежней записи сохраняет её вид и ревизию. Несовместимый формат и
   повреждённая опора дают явный отказ с сохранением прежнего проекта.
   Перенос обоих наборов включает связи декора и исходные байты точных
   ресурсов. На импортированной копии Анна поворачивает тумбочку с кашпо,
   пробует стул, сравнивает плитку с дубом, меняет одну сторону и вариант
   западной двери, затем через Undo возвращает авторскую расстановку.

Первая проверка показывает пригодность места в фактической позе.
На тумбочке 500 × 400 × 600 мм при X +40 мм кашпо имеет основание на
600 мм, верх на 1050 мм. В авторской комнате его центр (4160, 3750)
переходит в (4200, 3790) после +90°. Книги на соседних полках доступны
раздельно при одинаковых координатах на плане. Для второй снизу полки
используется 598 мм по правилу общего округления. Поворот или
отказ проверяются также после импорта.

В проверке состояния выделяются короткая и длинная шторки, доступ
к холсту в черновике, фокус после выбора уровня и отмены, невозможность
повторного подтверждения при записи, текст ошибки и её устранение.
Подтверждение, отмена и касание проверяются при ширине 320–390 CSS px,
тексте 200%, RU/EN, обеих темах, клавиатуре, обычном и резервном
рендерерах. В артефактах отдельно отмечаются мобильная эмуляция,
фактический Telegram на телефоне и контрольный широкий viewport.
[Принятые состояния и доказательства](../../tma-room-interior-2026-11-26/ux-delta.md) ·
[Порядок приёмки и исходная планировка](../../../../plans/tma-room-finishes-openings-and-supported-items-2026-11-26.md#6-финальная-планировка-которую-sol-создаёт-самостоятельно)
