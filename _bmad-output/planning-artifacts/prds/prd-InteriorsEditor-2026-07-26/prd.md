---
title: PRD — InteriorsEditor Alpha
status: final
created: 2026-07-26
updated: 2026-11-22
working_mode: headless-express
sources:
  - ../../briefs/brief-InteriorsEditor-2026-07-26/brief.md
  - ../../research/market-landscape-2026-07-26.md
  - ../../research/technical-feasibility-2026-07-26.md
  - ../../../../plans/telegram-mini-app-extension-spec-2026-11-04.md
  - ../../../../plans/telegram-mini-app-s0-preflight-2026-11-04.md
  - ../../sprint-change-proposal-2026-11-21.md
canonical_spec: ../../../specs/spec-interiors-editor-alpha/SPEC.md
---

# PRD: InteriorsEditor Alpha

## 0. Document Purpose

Документ определяет пользовательскую ценность, alpha scope, функциональные требования `FR-*` и нефункциональные требования `NFR-*` для phone-first редактора интерьеров в browser, установленной PWA и Telegram Mini App. Он предназначен для владельца продукта, UX, архитектуры, будущих epics/stories и тест-дизайна.

PRD является продуктовым источником требований, но не заменяет канонический [SDD-контракт](../../../specs/spec-interiors-editor-alpha/SPEC.md): `CAP-*` фиксируют компактный машинный контракт, PRD даёт journeys и поведенческую глубину, UX владеет взаимодействием, Architecture Spine — техническими инвариантами. Все неполученные от владельца решения помечены как предположения и перечислены в конце.

## 1. Vision and Problem

InteriorsEditor помогает человеку перед ремонтом или перестановкой быстро ответить на практический вопрос: «работает ли эта планировка в моём реальном пространстве?». Пользователь строит точный план нескольких комнат на телефоне, проверяет размеры и проходы, расставляет предметы и осматривает результат в 3D.

Telegram Mini App — основной продуктовый канал. Первый полезный сеанс помогает человеку самостоятельно набросать комнату, расставить условные предметы, сравнить их габариты и цвета и вернуться к сохранённой планировке. Действующие Web/PWA продолжают обслуживать свои проекты и поддерживаемый перенос по FR-58.

Продукт не становится облегчённым BIM и не соревнуется с крупными платформами по числу моделей, AI или 4K-рендерам. Он оптимизируется под:

- минимальное время до первого полезного плана;
- точность в миллиметрах без CAD-навыков;
- touch-first взаимодействие;
- локальное владение проектом и офлайн-работу;
- устойчивую редактируемость на поддерживаемом телефоне.

## 2. Target User

### 2.1 Primary user

Владелец или арендатор жилья, который самостоятельно обдумывает ремонт, перегородки, расстановку или покупку мебели. Он знает или может измерить основные размеры, постоянно имеет под рукой телефон, не владеет CAD и ценит практическую проверку выше фотореализма.

### 2.2 Jobs To Be Done

- Когда я обдумываю ремонт, я хочу проверить несколько вариантов точного плана до начала работ, чтобы не исправлять дорогие ошибки на объекте.
- Когда я выбираю мебель или технику, я хочу поставить объект реального размера в комнату, чтобы понять, помещается ли он и остаётся ли проход.
- Когда я обсуждаю вариант с близким человеком, я хочу быстро показать понятный 3D-результат и сохранить альтернативу, чтобы не объяснять всё на бумаге.
- Когда связь нестабильна или я нахожусь на объекте, я хочу продолжить работу с уже сохранённым проектом, чтобы сеть не блокировала решение.
- Когда в каталоге нет нужного предмета, я хочу задать его габариты или импортировать допустимую модель, чтобы план не терял практическую ценность.

### 2.3 Non-users for Alpha

- архитекторы и инженеры, которым нужны BIM/IFC, нормы и рабочая документация;
- профессиональные визуализаторы, для которых photoreal output важнее editing speed;
- замерщики и ремонтные организации, которым нужны LiDAR, сметы и отчёты;
- мебельные ритейлеры с SKU, конфигуратором, ценами и корзиной;
- пользователи, которым нужен полноценный desktop CAD или многоэтажный дом.

## 3. Key User Journeys

### UJ-1. Анна проверяет, помещается ли новая кровать

Анна планирует спальню и знает внутренние размеры комнаты. Она открывает PWA на телефоне без регистрации, создаёт прямоугольную комнату числовым вводом, добавляет дверь и окно, выбирает кровать реального размера и размещает её пальцем. Numeric sheet уточняет положение. В 3D Анна видит оставшийся проход и понимает, что исходный вариант слишком тесный. Проект уже сохранён локально.

**Edge case:** во время перемещения кровать выходит за стену. Редактор показывает конфликт, но не теряет исходное валидное положение.

### UJ-2. Михаил моделирует квартиру с диагональной стеной

Михаил начинает с пустого плана, рисует ортогональные стены, затем выбирает
диагональное направление 45° и добавляет диагональный участок. Визуальная
сетка меняет детализацию при масштабе, но не переписывает уже введённые
размеры. Для измеренного off-grid конца Михаил вводит точные целые мм; для
диагонали по желаемой длине до подтверждения видит фактическую квантизованную
длину. Точное T-пересечение и иначе валидное точное X-пересечение атомарно
создают общую Vertex и нужные отрезки стен; замкнутые контуры определяются
как комнаты. Михаил добавляет общую стену, дверь между комнатами и точные
параметры проёма.

**Climax:** он осматривает согласованную 3D-проекцию комнат и проёмов,
подтверждая, что Plan и 3D используют одну и ту же геометрию.

**Edge case:** новый сегмент даёт нецелое/недопустимое пересечение,
самопересекается или создаёт стену нулевой длины. Команда отклоняется с
объяснением, а проект остаётся в последнем Durable состоянии без частичного
разделения стен.

**Edge case:** если во время touch-ввода координатное преобразование стало
неактуальным или временно недоступно, Михаил видит состояние повторного выбора
и сохраняет свой draft. Это не ошибка размера, не Command и не сохранённое
изменение Project.

### UJ-3. Анна сравнивает атмосферу и расстановку

Анна добавляет диван, шкаф, стиральную машину, сантехнику, ковёр, растение и зеркало из representative catalog. Она применяет разрешённый цвет или вариант к мебели, вращает предметы и видит предупреждения о пересечении. Затем отменяет или повторяет сохранённую правку, чтобы сравнить расстановку без создания второго Project.

В Telegram Анна выбирает условные модели по назначению. На плане она перетаскивает шкаф и сразу видит расстояния от его габарита до стен. Она меняет цвет, сравнивает сочетания в 3D и вновь открывает сохранённый проект. После первого сохранённого сценария Анна может сообщить, удалось ли ей собрать планировку, и оценить опыт.

### UJ-4. Сергей продолжает работу без сети

Сергей ранее установил PWA и сохранил проект. На объекте он включает airplane
mode, открывает проект, меняет длину стены и положение техники, закрывает
приложение и возвращается к нему. Последняя Durable Revision восстановлена.
Когда доступна новая версия, активная сессия предлагает reload после durable
save; после автоматической activation при закрытых clients startup handshake
безопасно открывает либо мигрирует Project.

### UJ-5. Ольга добавляет предмет, которого нет в каталоге

В Alpha entry Ольга создаёт параметрический placeholder с шириной, глубиной,
высотой, цветом и AnchorClass. Placeholder участвует в 2D/3D, collision,
autosave и backup как обычный AssetInstance.

**Edge case:** размеры выходят за Project Limits или AnchorClass несовместим с
выбранной поверхностью. Candidate отклоняется, а последняя Durable Revision не
меняется.

### UJ-6. Анна восстанавливает переносимый проект

Анна экспортирует versioned backup, удаляет локальную копию и импортирует backup обратно. Все канонические размеры, комнаты, проёмы, свойства предметов и размещения восстанавливаются без округления. Для поддерживаемой старой версии schema разрешённая миграция создаёт новый валидный документ либо останавливается с recoverable error; неподдерживаемая версия отклоняется.

### UJ-7. Анна переносит проект в Telegram

Анна открывает Mini App онлайн под своим Telegram-аккаунтом и импортирует
поддерживаемый `.interiors`, экспортированный из Web/PWA и сохранённый во внешнем файле. Импорт создаёт
новый локальный Project; исходная копия остаётся доступной. Она изменяет план,
размещает предмет, проверяет 3D и возвращается к последней Durable Revision
после закрытия и повторного открытия. Перенос обратно выполняется явным
экспортом и импортом, без обещания синхронизации. Если локальная выдача файла
недоступна, интерфейс сообщает об этом и не заявляет, что backup сохранён.

### UJ-A1. Ольга импортирует собственный GLB — Alpha+

Ольга выбирает статический GLB. Byte-level preflight до loader показывает
размер, заявленные ресурсы и причину отклонения. После безопасного preview она
подтверждает реальные размеры, оси, AnchorClass и host semantics.

**Edge case:** GLB содержит внешние URI, неизвестное required extension или
превышает decoded budget. Импорт прекращается, Project и ранее сохранённые
assets не меняются.

## 4. Glossary

Укороченный словарь для чтения PRD. Канонические определения находятся в [SPEC glossary](../../../specs/spec-interiors-editor-alpha/glossary.md).

- **Project** — локально сохраняемая модель одного дизайн-варианта.
- **Level** — горизонтальный этаж/уровень Project; Alpha содержит ровно один Level.
- **PlanGraph** — канонический планарный граф из Vertex и Wall.
- **Vertex** — точка PlanGraph с целочисленными координатами `xMm/zMm`.
- **Wall** — центральная reference line между двумя Vertex с толщиной;
  вертикальная высота выводится из соседних Room.
- **WallSegment** — канонический ненулевой участок Wall между двумя Vertex;
  именно к нему привязаны topology change и Opening, а не к 3D mesh.
- **Room** — производная замкнутая грань PlanGraph с устойчивым идентификатором, когда это возможно.
- **Opening** — Door или Window, привязанные к одному Wall через offset и dimensions.
- **CatalogAsset** — оптимизированное versioned определение 3D-объекта с
  техническими metadata, габаритами и hash ресурсов.
- **Catalog Control Plane** — ограниченная серверная граница, публикующая
  versioned catalog metadata/resources и hash;
  она не хранит, не синхронизирует и не восстанавливает пользовательский
  Project.
- **AssetInstance** — размещённый в Project экземпляр CatalogAsset или ImportedAsset.
- **AnchorClass** — допустимый тип размещения: floor или wall.
- **SurfaceFinish / Surface address** — retired terminology: назначаемых
  покрытий пола или стен в Alpha нет.
- **Validated Command** — атомарное изменение, создавшее валидный candidate,
  который ещё может ожидать persistence.
- **Durable Revision** — candidate, записанный и опубликованный атомарным
  pointer swap; только он называется saved/committed.
- **Active Gesture** — незавершённое интерактивное действие, ещё не попавшее в history/autosave.
- **Portable Backup** — self-contained versioned bundle с canonical Project и
  exact referenced resources, достаточный для offline restore.
- **Alpha entry** — первая самостоятельно используемая версия базового планировщика.
- **Alpha+** — следующая alpha-итерация, не блокирующая начало тестирования.

## 5. Features and Functional Requirements

### 5.1 Local Project Lifecycle

**Description:** Пользователь получает ценность до регистрации. Project локально создаётся, изменяется, восстанавливается и может быть безопасно удалён. Реализует CAP-1 и CAP-10; поддерживает UJ-1, UJ-3, UJ-4 и UJ-6.

#### FR-1: Create Project

Пользователь может создать Project с рабочим названием и одним пустым Level.

**Consequences:**

- Project получает устойчивый внутренний ID, `schemaVersion`, timestamps и initial valid state.
- В browser/PWA новый Project не требует аккаунта или сети после загрузки app shell. Telegram использует существующую host identity только для локального scope по FR-56; cold launch может требовать сеть.

#### FR-2: List, Open and Rename

Пользователь может увидеть локальные Projects, открыть и переименовать выбранный Project.

**Consequences:**

- Список различает empty, loading, corrupted and populated states.
- Переименование не меняет внутренний ID и не дублирует данные.

#### Retired FR-3: Duplicate Variant

Отменено владельцем продукта 2026-08-25. Alpha не создаёт независимую копию
Project как вариант; сравнение текущих правок происходит через session
undo/redo. Идентификатор `FR-3` не переиспользуется.

#### FR-4: Confirmed Permanent Project Deletion

Пользователь может окончательно удалить Project только после отдельного явного
подтверждения; в Alpha нет промежуточного delete-state или маршрута отмены.

**Consequences:**

- Confirm показывает название и необратимость; cancel не меняет данные.
- Успешное удаление атомарно удаляет Project metadata и принадлежащие ему
  Revision; shared resource bytes освобождаются только отдельным global GC.
- Ошибка или stale writer не оставляет частично удалённые metadata/revisions.

#### FR-5: Autosave and Recovery

Система переводит каждый Validated Command через PendingDurability и
восстанавливает последнюю Durable Revision после закрытия, crash или process
eviction.

**Consequences:**

- Active Gesture не заменяет last valid snapshot.
- Пользователь видит состояния saving/saved/persist-failed/recovery-needed;
  `saved` появляется только после atomic pointer swap.

### 5.2 Plan Creation and Editing

**Description:** Пользователь создаёт геометрически валидный PlanGraph с touch- и numeric-вводом. Реализует CAP-2, CAP-3 и CAP-8; поддерживает UJ-1 и UJ-2.

#### FR-6: Rectangular Room Starter

Пользователь может создать первую прямоугольную Room, указав внутреннюю ширину, глубину и высоту в миллиметрах.

**Consequences:**

- Нулевые, отрицательные и выходящие за Project bounds значения отклоняются до commit.
- Полученный PlanGraph замкнут и создаёт ровно одну Room.
- Wall проходит по centerline; starter смещает её наружу так, чтобы usable
  interior polygon точно соответствовал введённым внутренним размерам.

#### FR-7: Draw Constrained Wall

Пользователь может рисовать Wall пальцем в разрешённых Alpha направлениях:
ортогонально или под 45°.

**Consequences:**

- Preview показывает направление и длину до commit. Базовый 100-mm gesture
  candidate строится от активной начальной точки, а не от глобальной решётки;
  поэтому off-grid Vertex не делает корректную 45° стену невозможной.
- При одинаковых входных данных touch- и доступная numeric/list alternative
  воспроизводимо выбирают один constrained candidate; canvas и DOM не дают
  разных результатов выбора.
- Если преобразование координат для актуального touch-ввода неинвертируемо,
  устарело или временно недоступно, редактор сохраняет DraftCommand и явно
  предлагает повторить выбор. Это transient `SelectionUnavailable`, а не
  `INVALID_DIMENSION`, Command, history/autosave или Durable mutation.
- Визуальная сетка может показывать 100/500/1 000 mm cells в зависимости от
  zoom, но изменение zoom/ячейки не меняет уже подтверждённую геометрию.
- Редактор может предложить допустимый constrained candidate, но подтверждённый
  delta вне ортогонального/45° набора отклоняется, а не скрытно округляется до
  ближайшего угла. Правила eligibility, equal-tie и hysteresis публикуются в
  каноническом interaction/geometry contract и corpus; implementation default
  не вправе выбирать их сам.

#### FR-8: Gesture-first constrained Wall authoring

Пользователь строит и редактирует Wall прямым touch-жестом на Plan. Глобальные
координаты Vertex и Wall не являются пользовательским вводом в Alpha.

**Consequences:**

- Жест показывает проверяемый constrained candidate и требует явного
  подтверждения; conflict объясняется без частичной публикации.
- Каноническая геометрия сохраняет integer-mm endpoints и не преобразуется
  через floating-point metres.
- Touch-кандидат проходит тот же direction/topology validation и snap-policy;
  сетка и preview не создают второй источник истины.
- Для 45° authoritative остаются integer-mm endpoints, вычисленные из
  жестового кандидата; preview показывает фактическую квантизованную длину до
  подтверждения.

#### FR-9: Move and Split Topology

Пользователь может перемещать Vertex и добавлять Wall к существующей Vertex.
При допустимом построении или изменении графа система автоматически разделяет
затронутые Wall segments в необходимых точках контакта. Это следствие
нормализации топологии, а не отдельная обещанная пользователю команда split.

**Consequences:**

- По принятому `REL-08` действие «Разделить стену жестом» отсутствует во всех
  UI-маршрутах. Текущий UI также не предлагает числовой split выбранной стены;
  этот PRD не вводит новую кнопку или иной самостоятельный маршрут split.
  Если такой маршрут будет предложен позже, его продуктовая применимость
  потребует отдельного решения; это не блокирует принятую нормализацию контактов.
  Отсутствие UI-команды не удаляет domain-нормализацию, совместимость сохранённых
  разделённых стен или существующие domain/регрессионные проверки.
- Точное T-пересечение и иначе валидное точное X-пересечение создают одну общую
  Vertex и в одной атомарной операции обновляют все затронутые Wall: для X —
  ровно четыре канонических ненулевых Wall segments.
- Для add/move/delete/split, включая точные T/X, публикуется полное lineage
  затронутых Vertex, Wall и derived Room вместе с forward/inverse corpus
  evidence. Preview, который не был подтверждён либо стал stale, не создаёт
  Durable identity или частичный topology result.
- Нецелое, выходящее за limits, перекрывающееся, self-intersecting или иначе
  невалидное пересечение отклоняется целиком до изменения Project; несвязанные
  участки плана не изменяются.

#### FR-10: Edit Wall Properties

Пользователь может изменить толщину Wall; длина определяется Vertex, а высота
выводится из высоты соседних Room.

**Consequences:**

- Толщина валидируется в миллиметрах.
- Связанные Opening перепроверяются до commit.
- Shared Wall экструзится до максимальной высоты соседних Room; Opening должен
  помещаться в минимальную доступную высоту обеих сторон.

#### FR-11: Remove Geometry

Пользователь может удалить Wall или Vertex, если результирующая операция определена и валидна.

**Consequences:**

- Room может исчезнуть или объединиться с соседней; Room-, host- или
  Opening-конфликт открывает preview с явным выбором пользователя, а не
  завершённый rejected candidate.
- После confirm приложение заново проверяет base Revision и writer fence,
  повторяет discovery/validation и публикует ровно одну полную атомарную
  операцию. Cancel, stale base или потеря fence не создают Command, Revision,
  History или частичный результат.
- Orphaned Opening обрабатывается выбранной в preview полной атомарной
  операцией, а не остаётся повреждённой ссылкой.

#### FR-12: Geometry Validation

Система отклоняет zero-length walls, duplicate segments, запрещённые направления, self-intersections и недопустимые topology transitions.

**Consequences:**

- Ошибка содержит затронутый объект, правило и доступный способ исправления.
- Отклонённая команда не создаёт history entry, autosave, ложный статус
  сохранения или частичную принятую 2D/3D геометрию; последняя Durable Revision
  остаётся текущей и не выдаётся за изменённую.
- `SelectionUnavailable`, stale measurement и ожидающий выбора conflict preview
  являются отдельными transient состояниями, а не invalid geometry result; они
  сохраняют допустимый draft/Project и не могут неявно превратиться в mutation.

#### FR-13: Measurements

Пользователь может выполнить named measurement над одним или двумя выбранными
targets: точкой Plan, centerline Wall, внутренней границей Room или границей
footprint AssetInstance. Он видит длину Wall, внутренние размеры/площадь/
периметр Room и точное расстояние между targets в миллиметрах/квадратных
метрах по документированным правилам округления.

**Consequences:**

- Display rounding не меняет canonical values.
- Measurement привязан к видимым Revision/checksum и опубликованным правилам
  locator/nearest-point/equal-tie. Устаревший результат отбрасывается, не
  сохраняется и показывает явный путь повторного выбора/измерения.
- Диагональная длина, включая квантизованный результат length input, использует
  одну `MeasurementFormatPolicy` в preview, 2D, 3D и export;
  одинаковая canonical geometry не получает разные отображаемые значения.
  Отформатированное значение не становится новым input для изменения геометрии.
- Измерение ширины прохода является геометрическим фактом, а не подтверждением
  строительной нормы или эргономической достаточности.

### 5.3 Rooms, Doors and Windows

**Description:** Room выводится из топологии; Door и Window являются валидными
wall-hosted Opening. Реализует CAP-3 и CAP-4; поддерживает UJ-2.

#### FR-14: Derive Closed Rooms

Система определяет Room из замкнутых граней PlanGraph и обновляет их после каждого topology commit.

**Consequences:**

- Open contours не считаются Room.
- Room с неположительной площадью не создаётся.
- Валидная Room face состоит из одной простой outer ring и нуля или более
  простых, строго вложенных, некасающихся void rings; holes сохраняются, а
  usable polygon остаётся производным результатом этой face. Repeated bounded
  walk, touching/nested rings и non-simple component не образуют Room и не
  меняют Project частично; допустимые повторения на unbounded exterior не
  запрещаются этим правилом.

#### FR-15: Preserve Room Identity

При валидном локальном изменении границы система сохраняет `roomId`, название
и height Room, когда complete discovery даёт однозначное semantic
lineage. Валидная `AddWall`-команда, делящая Room, является специальным
детерминированным случаем: каждый successor получает exact `heightMm`
predecessor без выбора пользователем recipient Room metadata.

**Consequences:**

- Алгоритм matching, включая split/merge/new root, документирован и покрыт
  forward/inverse fixtures.
- При valid wall-induced split пользователь не выбирает successor для
  `roomId`, name, type, height или history: команда сразу создаёт successors,
  наследующие predecessor `heightMm`. Имя и другая не-height metadata не
  распределяются пользовательским выбором.
- Merge и unresolved Opening/asset/surface-host consequence по-прежнему сначала
  показывают `ConflictPreview` и разрешают только безопасный outcome. Confirm
  заново проверяет base Revision и writer fence, повторяет discovery/validation
  и лишь после этого публикует один complete result; cancel, stale base и fence
  loss не создают mutation.

#### FR-16: Edit Room Parameters

Пользователь может изменить тип и высоту Room; геометрические размеры и площадь
выводятся из PlanGraph. По принятому `REL-05` UI идентифицирует помещения по
типу, не предлагает редактирование имени и не показывает историческое имя на
плане. Сохранённое `Room.name` остаётся для совместимости и не переписывается
при изменении типа или высоты.

**Consequences:**

- Сохранение и повторное открытие Project сохраняют имеющееся `Room.name`;
  отсутствие поля ввода не удаляет сохранённые данные и не меняет schema.
- PRD не обещает независимые width/depth для непрямоугольной Room.
- Room height — единственный пользовательский источник высоты помещения и
  влияет на производную высоту Wall.

#### FR-17: Add Door

Пользователь может добавить Door на Wall, задав width, height, sill/threshold policy и offset.

**Consequences:**

- Door полностью лежит внутри допустимого интервала Wall и не пересекает другой Opening.
- Door находится на Wall, граничащей либо с ровно двумя derived Room, либо с
  Room и Exterior.
- Door не создаёт navigation edge или переход между Room; это не отдельное
  редактируемое состояние Door.

#### FR-18: Add Window

Пользователь может добавить Window на Wall, задав width, height, sill height и offset.

**Consequences:**

- 2D и 3D используют одинаковые параметры Opening.

#### FR-19: Edit and Remove Opening

Пользователь может численно или touch-жестом переместить, изменить и удалить Opening.

**Consequences:**

- Если edit Wall меняет допустимость Opening, UI показывает
  `ConflictPreview/AwaitingUserOutcome` для resize, relocation или delete, а
  не меняет offset/host молча. После confirm он заново проверяет base Revision
  и writer fence, повторяет validation и публикует один complete result;
  cancel, stale base или fence loss не создают Command, Revision или History.

### 5.4 Synchronized 2D and 3D

**Description:** 2D plan и 3D scene — представления одной доменной модели.
Реализует CAP-5 и CAP-11; поддерживает UJ-1–UJ-4.

#### FR-21: Switch View

Пользователь может переключаться между Plan View и 3D View без потери
selection интерактивного Wall или AssetInstance, PendingDurability status или
camera-independent domain data. Derived Room не получает selection state.

#### FR-22: Deterministic 3D Projection

Система процедурно строит стены, проёмы и полы из одного Project state.

**Consequences:**

- Reload одной версии Project создаёт семантически тот же 3D result.
- Renderer objects не сериализуются как источник истины.

#### FR-23: Inspect 3D

Пользователь может orbit/pan/zoom сцену и выбрать AssetInstance, когда он
присутствует. Room surface в Alpha display-only: её tap/picking не открывает
room picker, property surface или selection state.

**Consequences:**

- Gesture contract разделяет camera navigation и object transform.
- Выбор AssetInstance синхронизируется с доступной numeric/property surface;
  Room в Alpha остаётся display-only и не возвращает выбор на 2D/3D canvas.

#### FR-25: Adaptive Quality

Система изменяет pixel ratio, shadows, effects и LOD при снижении runtime performance, не меняя Project.

**Consequences:**

- Quality transition не блокирует touch editing.
- Пользователь может увидеть текущий compatibility/quality tier в diagnostics.

### 5.5 Catalog and Item Placement

**Description:** Небольшой representative catalog закрывает типовые проверки размеров и проходов. Реализует CAP-6; поддерживает UJ-1 и UJ-3.

#### FR-26: Browse Catalog Categories

Пользователь может открыть категории furniture, plumbing, appliances/electronics, lighting и accessories.

**Consequences:**

- Каталог различает отсутствие доступа к Catalog Control Plane от ошибки или
  отсутствия локального cached/pinned resource; ни одно из этих состояний не
  является ошибкой существующего Project.
- В Telegram каталог новых предметов доступен локально по FR-60. Статус
  внешнего каталога относится к тем сценариям, которые используют его ресурсы.
- Alpha catalog не обещает branded SKU или коммерческую доступность.

#### FR-27: Search and Filter

Пользователь может найти asset по названию/категории и отфильтровать по AnchorClass или основным габаритам.

#### FR-28: Place Item

Пользователь может разместить AssetInstance только на совместимой поверхности согласно AnchorClass.

**Consequences:**

- Floor item не размещается на Wall без явной совместимости asset.
- Preview отличает valid, warning and invalid placement.
- Wall item хранит host surface и локальные координаты; topology change
  не оставляет его в воздухе без rehost/delete/orphan preview. Перенос между
  anchor/root допустим только при compatible asset metadata и явном выборе;
  confirm повторно проверяет base Revision и writer fence, а cancel/stale/fence
  loss не создаёт Durable placement.
- Confirm сначала pin-ит exact referenced bytes и проверяет complete-backup
  envelope; без `offline-ready/backup-ready` AssetInstance не становится
  Durable.
- В Alpha нет license/provenance/grant/declaration/attribution/notice admission:
  владелец продукта добавляет только бесплатные или самостоятельно созданные
  модели вне приложения. Это не отменяет технический exact pin и
  backup-feasibility до Durable reference. Reject, cancel, crash recovery или
  fence loss не оставляют частично опубликованное размещение.

#### FR-29: Transform Item

Пользователь может переместить, вращать и, если AssetDefinition разрешает, менять габариты AssetInstance.

**Consequences:**

- Numeric sheet даёт точный ввод position/dimensions/rotation.
- Fixed-size SKU не растягивается, если asset metadata это запрещает.

В Telegram кольцо напольного предмета видно в 2D и над сценой 3D.
Поворот жестом меняется плавно, а поле принимает значение до 0,001°.
Функция записи точного угла требует совместимого читателя, резервного
копирования без округления и проверенного пути отката по FR-44/45/57/58.

#### FR-30: Item Actions

Пользователь может duplicate, lock/unlock and delete AssetInstance.

**Consequences:**

- Locked item не меняется случайным gesture, но остаётся доступным для explicit unlock.
- Каждое действие участвует в undo/redo.

#### FR-31: Collision and Clearance Feedback

Система показывает пересечение footprint и заданных clearance zones с Wall, Opening или другими AssetInstance.

**Consequences:**

- Alpha выдаёт warning, а не утверждает соблюдение строительных норм.
- Warning не изменяет Project автоматически.

#### FR-32: Parametric Placeholder

Пользователь может создать простой box item с name, width, depth, height, color and AnchorClass.

**Consequences:**

- Placeholder участвует в collision, save, export и 3D.
- Созданный пользователем placeholder обозначен как собственный предмет и
  отличается от готового пресета каталога и коммерческого SKU.

### 5.6 Colors and Item Variants

**Description:** Пользователь может менять только разрешённый цвет или variant
самого предмета, не получая обещание фотореализма. Реализует CAP-7; поддерживает UJ-3.

#### FR-33: Apply Item Color or Variant

Пользователь может применить разрешённый color/material variant к отмеченным recolorable slots AssetInstance.

**Consequences:**

- Неразрешённые slots не перекрашиваются.
- Variant сохраняется как domain reference, а не renderer material object.

#### Retired FR-34: Apply Floor Finish

Отменено владельцем продукта 2026-08-25. В Alpha нет preset/material picker,
`Floor(RoomId)` assignment или иной функции покрытия пола. Идентификатор не
переиспользуется.

#### Retired FR-35: Apply Wall Finish

Отменено владельцем продукта 2026-08-25. В Alpha нет `WallSide` assignment,
finish picker или иной функции покрытия стен. Идентификатор не переиспользуется.

#### Retired FR-36: Ceiling Finish

Отменено владельцем продукта 2026-08-24. Потолочные покрытия, потолочная
поверхность и любые потолочные предметы исключены из Alpha; идентификатор
`FR-36` не переиспользуется. `Room.heightMm` остаётся только высотой помещения
и источником производной высоты стен.

#### Retired FR-37: Finish Offline Availability

Отменено владельцем продукта 2026-08-25 вместе с покрытиями пола и стен.
Technical pin, hash, backup feasibility и recovery остаются обязательными для
размещённых моделей, но не создают surface-finish scope. Идентификатор не
переиспользуется.

### 5.7 Safe Editing History

**Description:** Любое редактирование обратимо на уровне доменных команд. Реализует CAP-8; поддерживает все editing journeys.

#### FR-38: Undo and Redo

Пользователь может undo/redo каждый Durable Command в текущей session history
boundary.

**Consequences:**

- Undo восстанавливает валидный Project, включая derived Rooms.
- Новая команда после undo очищает redo branch по документированной policy.
- Resource hashes всех Revision обеих session-веток защищены от GC; новая
  команда заранее проходит `SessionRetentionPolicy` и не может принять
  необратимый history entry.
- После undo redo-resources освобождаются только после Durable publication
  заменившей ветку команды.
- Corrupt/missing hash, достижимый только из History, требует exact repair либо
  явного `DiscardSessionHistory` при доказанно healthy current Project;
  автоматический сброс истории запрещён. Discard требует подтверждения,
  атомарно удаляет обе history branches без Project Revision и показывает новую
  history boundary.
- Reload/reopen, recovery, migration, duplicate и backup import начинают
  видимую новую history boundary; backup не переносит session history.

#### FR-39: Cancel Active Gesture

Пользователь может отменить Active Gesture без создания history entry или autosave mutation.

#### FR-40: Explain Invalid Operation

При отклонении команды система объясняет, какое правило нарушено, сохраняет предыдущее valid state и предлагает доступное действие.

### 5.8 PWA, Offline and Portability

**Description:** Project остаётся полезным при нестабильной сети и принадлежит пользователю. Реализует CAP-1, CAP-9 и CAP-10; поддерживает UJ-4 и UJ-6.

#### FR-41: Installable PWA

На поддерживаемой платформе пользователь может установить PWA и запустить её в standalone mode.

**Consequences:**

- Неустановленная browser version сохраняет core authoring behavior.
- Unsupported WebGL 2 получает compatibility screen.
- На iOS browser и Home Screen app являются разными local contexts; install
  help объясняет это до первого Project, а существующий Project переносится
  через Portable Backup.

#### FR-42: Offline Reopen and Edit

Для browser/PWA после первого успешного открытия app shell и Project пользователь может в airplane mode открыть Project, изменить PlanGraph с локально доступными assets и сохранить его. Telegram cold launch может требовать сеть; работа после подготовки описана в FR-55.

**Consequences:**

- Если все exact referenced resources Project уже pinned локально, отсутствие
  Catalog Control Plane не блокирует open, edit, Durable save, local undo/redo
  или Portable Backup export существующего Project.

#### FR-43: Storage Health

Система показывает storage usage/pressure, запрашивает persistence где доступно и обрабатывает quota exhaustion без silent data loss.

**Consequences:**

- LRU cleanup касается только повторно скачиваемого cache.
- Приложение автоматически не удаляет пользовательские Projects, но честно
  сообщает, что browser/OS может очистить origin storage.
- Persistence request/status и напоминание о внешнем backup доступны, но не
  выдаются за гарантию.

#### FR-44: Portable Backup Export

Пользователь может экспортировать versioned Portable Backup, достаточный для восстановления Project.

**Consequences:**

- Backup содержит manifest/schema version и integrity metadata.
- Backup всегда включает exact referenced catalog resources; после Alpha+
  также включает необходимые imported assets.
- Backup manifest включает технические resource descriptors, hashes и
  integrity metadata. License/provenance ledger, grants, declarations,
  attribution и notices в Alpha не сохраняются и не проверяются.
- Неполный semantic export не называется Portable Backup.
- Каждый non-corrupt Durable Project, созданный текущей limits policy,
  экспортируется без network; Project mutation не может превысить более
  строгий exportable envelope.

#### FR-45: Portable Backup Import

Пользователь может импортировать совместимый Portable Backup с validation, migration и atomic commit.

**Consequences:**

- Неудачная миграция не перезаписывает существующий Project.
- Успешный импорт всегда создаёт новый raw Project ID, отличный от source ID
  даже при отсутствии source Project в локальных stores; сравнение сохраняет
  точную строку source ID без нормализации. Existing Project не является target
  атомарной публикации. Внутри destination
  storage ID новой записи не совпадает с занятым ID и не переиспользует ID в
  нарушение действующего no-ABA контракта. Создание Project и Revision защищено
  атомарной проверкой отсутствия записи; collision не перезаписывает существующие
  Projects, revisions или ресурсы и требует безопасного отказа либо новой
  попытки с другим ID.
- Если одна browser directory показывает Projects из нескольких локальных
  storage namespaces, идентичность локальной записи и адрес всех её операций —
  доверенная пара `(storage namespace, raw Project ID)`. Два Project с одинаковым
  raw ID в разных namespaces остаются разными копиями: UI показывает их
  раздельно и различимо, а open/edit, writer fence/takeover, history, recovery,
  resources, export, подтверждённое delete и поздние асинхронные результаты
  направляются только выбранному владельцу. Если владелец записи не определён,
  операция не выполняется. Недоступный store обозначается как неизвестный или
  недоступный, а не пустой; доступный store продолжает безопасную работу. Это не
  объединяет данные, не создаёт синхронизацию и не помещает storage namespace
  в Project или backup. FR-44 действует для каждого healthy Durable Project
  обоих stores; resources/undo/redo roots одного store не очищаются другим.
- Для нового явно выбранного browser registered import кандидат raw ID до
  принятия проверяется относительно существующих Projects обоих известных
  browser stores; совпадение требует другого ID, а недоступная проверка не
  разрешает import с неизвестным результатом. Эта проверка не атомарна между
  независимыми stores и не обещает, что одновременно работающий или будущий
  старый клиент не создаст тот же raw ID. Такое совпадение обрабатывается через
  scoped identity и никогда не разрешает слияние, перезапись или доступ к чужой
  записи. Прежние browser routes и их данные сохраняются.
- Unknown future schema получает понятное сообщение.
- Container/unpacked bytes, paths, entries, entity counts и checksums
  проверяются в staging по Project/Backup contract.

#### Retired FR-46: PNG Snapshot

Отменено владельцем продукта 2026-08-25. Alpha не создаёт, не скачивает и не
отправляет PNG Plan/3D view; переносом Project остаётся Portable Backup или
обычный экспорт Project. Идентификатор не переиспользуется.

#### FR-47: Coordinated App Update

Активный editor предлагает reload только после Durable Revision. Корректность
не зависит от удержания waiting worker: каждый startup проверяет совместимость
shell/Project/catalog schema и выполняет recoverable migration. Browser/PWA
дополнительно проверяют применимый worker; Telegram выполняет проверку без worker
по FR-58.

### 5.9 Experimental Custom GLB Import — Alpha+

**Description:** Пользовательская модель допускается только как строго
ограниченный статический asset. Реализует CAP-12; поддерживает UJ-A1.

#### FR-48: Select Static GLB

Пользователь может выбрать один локальный `.glb` файл; `.gltf`, OBJ, FBX и архивы отклоняются в Alpha+.

#### FR-49: Preflight Resource Policy

До любого general-purpose loader система byte-level проверяет format/version,
JSON chunk, external/data URI, required extensions и declared resources; затем
по стадиям проверяет nodes, meshes, primitives, triangles, vertices, materials,
textures, decoded memory estimate and bounding box.

**Consequences:**

- Compressed file size не является единственной проверкой.
- Проверка имеет cancel/timeout и не блокирует editor indefinitely.
- Loader использует deny-all resource resolver; Worker не считается hard
  memory sandbox.

#### FR-50: Preview and Classify

После успешного preflight пользователь видит изолированный preview, подтверждает реальные dimensions in mm, pivot/orientation, AnchorClass and recolorable slots.

#### FR-51: Reject Unsafe or Unsupported Asset

Система отклоняет unknown required extension, external/network URI, animation, skin, morph target, camera, light, invalid metadata и превышение любого hard budget.

**Consequences:**

- Ошибка называет фактическое значение, limit и следующий шаг.
- Отклонение не оставляет partially persisted blob.

#### FR-52: Persist Imported Asset

Подтверждённый ImportedAsset получает internal ID, content hash, validated metadata and local blob reference.

**Consequences:**

- Reuse одного hash не дублирует binary без необходимости.
- Удаление последней ссылки освобождает storage и GPU resources по policy.
- До Durable reference ImportedAsset проходит технические exact pin и
  complete-backup feasibility. Отказ, cancel, fence loss или crash recovery не
  делают staging resource частью Project, Revision, History или Portable Backup.

### 5.10 Catalog Control Plane boundary

**Description:** Alpha может получать curated catalog metadata/resources через
ограниченный Catalog Control Plane, не меняя local-first владение Project.
Реализует CAP-6 и CAP-7; поддерживает UJ-3 и UJ-4.

#### FR-54: Ограниченная роль Catalog Control Plane

Система может использовать Catalog Control Plane только для публикации и
получения versioned catalog metadata/resources и hashes. Он не является
пользовательским Project-сервисом и не выполняет legal/licensing workflow.

**Consequences:**

- Техническая реализация этой product boundary зафиксирована в addendum;
  `FR-54` не определяет API, transport, physical resource distribution,
  hosting, SLA или retention policy.
- Catalog Control Plane не создаёт пользовательскую account identity и не
  принимает, не хранит,
  не синхронизирует и не восстанавливает User Project, Revision, session
  History или Portable Backup.
- После pin exact referenced bytes existing local Project остаётся usable без
  сервиса: его можно открыть, редактировать, сохранить, отменить/повторить
  local history и экспортировать как Portable Backup. Недоступность сервиса
  может затронуть только поиск или получение ещё не pinned catalog resource и
  не переводит существующий Project в `ResourceRecoveryRequired`: это
  состояние означает missing/corrupt referenced resource, а не недоступность
  сервиса.

### 5.11 Telegram Mini App — основной продуктовый канал

#### FR-55: Общий редактор и жизненный цикл Telegram

Политика и лицензия доступны до редактирования и из настроек. Новая редакция действует с первого публичного распространения этой версии и требует самостоятельного акцепта. При отказе пользователь может просмотреть и выгрузить свои сохранённые проекты поддерживаемым способом. [Условия выпуска](../../sprint-change-proposal-2026-11-22-public-candidate.md)

Telegram предоставляет принятый Alpha entry путь: проекты, план, комнаты и
проёмы, измерения, каталог и floor/wall placement, 2D/3D, undo/redo, Durable
save, recovery и перенос. Одинаковая подтверждённая команда над одинаковым
Project даёт эквивалентный доменный результат во всех поверхностях; host controls
могут различаться. Актуальные UX-контракты 1 ноября сохраняются; Alpha+ и
retired возможности не повышаются в scope.

- Добавление и изменение двери или окна, размещение, перемещение и поворот
  предмета в Plan или 3D достигают Durable save по FR-5, FR-17–19 и FR-28–29.
  Отмена и повторный выбор без подтверждённой правки оставляют Revision прежней.
  Ошибка или прерывание проверки ресурсов возвращают состояние проверки с
  возможностью повтора. Пока результат неизвестен, публикация правок и действия
  по удалению в recovery недоступны. Восстановление требует подтверждённого
  отсутствия ресурса либо несовпадения размера или SHA-256. Наличие проблемы
  только в истории определяется отдельно от состояния текущего Project по NFR-13.
- При медленной, первой и повторной загрузке модели предпросмотр в 3D сохраняет
  габариты и положение предмета. Готовая модель появляется с той же камерой,
  масштабом, режимом отсечения и без промежуточного исчезновения геометрии
  комнаты. Изменение качества по FR-25 сохраняет точность плана и доступность
  управления. Ошибка загрузки одного ресурса даёт понятный статус и позволяет
  отменить активную постановку.
- После онлайн-запуска и подготовки нужных модулей редактора, 2D/3D, codecs и exact referenced resources
  потеря сети не блокирует доступные local edit, Durable save и undo/redo.
  До подготовки недоступный режим обозначен явно; не загруженный resource не
  становится Durable. PWA cold offline reopen по FR-42 сохраняется.
- Back сначала безопасно обрабатывает верхнюю панель или незавершённый draft,
  затем возвращает к списку Projects; из списка закрытие происходит по явному
  действию. Отмена подтверждения выхода сохраняет тот же draft и selection; явная отмена самой правки её отбрасывает без Revision. Ни одно действие не подтверждает команду.
  При PendingDurability управляемый выход ждёт результата; persist-failed
  сохраняет retry/recovery-export и явно отмечает несохранённое. Read-only
  recovery не исправляет и не удаляет Project автоматически. Предупреждение о
  Close используется при доступности host; внезапное закрытие не считается
  предотвратимым и восстанавливается через атомарный recovery. Конфликтующие
  host swipes ограничиваются только в необходимом состоянии и восстанавливаются
  при выходе; pan/pinch/drag не должны случайно закрывать host или подтверждать
  команду, второй pointer не подтверждает draft.
- Фон, возврат, смена viewport/клавиатуры, theme и потеря renderer не создают
  команду сами по себе. Устаревший screen-to-plan transform не публикует
  геометрию; возврат перепроверяет writer fence и базовую Revision. При
  неподдерживаемом host, SDK timeout или недоступной capability показывается
  честный retry/выход или доступный fallback, без записи в общий namespace;
  вне поддержанного Telegram host предлагается переход в Telegram и доступная
  ссылка на Web/PWA. При потере WebGL сохраняется модель и доступен безопасный
  2D/recovery путь, когда capability это позволяет.
- Доступность по NFR-17–20 сохраняется, в том числе при 360 CSS px и 200%
  текста: видны статус сохранения, основное действие, отмена и активное поле.
  Системные safe areas и клавиатура не перекрывают необходимые controls.

#### FR-56: Локальная область аккаунта Telegram

Project остаётся локальным для конкретного клиентского storage context. До
создания runtime, открытия/миграции хранилищ и cleanup выбирается единый
неизменяемый на срок runtime account scope. Он охватывает Project/Revision,
resources и локальную библиотеку, staging, history/GC roots, writer/takeover и project preferences.
Browser/PWA данные и их имена не меняются автоматически; общий storage между
browser, установленной PWA, Telegram-клиентами и устройствами не предполагается.

При A → B → A B не видит Projects A, а возврат к A восстанавливает доступ к его
данным; поздняя работа A не публикуется и не очищает данные B. При отсутствии
необходимой identity общий writable fallback запрещён. Scope организует
локальные данные, не является серверной авторизацией или защитой от владельца
скомпрометированного устройства. Telegram user/bot identity и initData не входят в Project или
Portable Backup; автоматической синхронизации нет.

#### FR-57: Проверяемый перенос между поверхностями

Поддерживаемый `.interiors` переносится Web/PWA → Telegram и обратно как
реальный внешний файл с явными export/import. Проверяемые schema/build versions
публикуются; неподдерживаемый, повреждённый, обрезанный или слишком большой
файл отклоняется до публикации без изменения существующих Projects. Успешный
import создаёт новый raw Project ID и отдельную локальную запись по правилам
FR-45 и сохраняет исходник, семантику геометрии без
миллиметрового drift, привязки и exact resource hashes; session history не
переносится. Отмена и ошибка не оставляют опасных staging roots.

Проверка поддерживаемой текущей версии включает пустой Project и реальные
файлы в обоих направлениях. Неоднозначный файл не публикуется по догадке:
исходный файл сохраняется, а ограничение и доступный путь сообщаются явно.
Доступность прежнего Web/PWA сама по себе не доказывает восстановление или
повторный экспорт: обходной путь можно заявить только после проверки конкретной
пары версий, исходного контекста и полного переноса. Если доступна только
неоднозначная копия файла и проверенного пути нет, восстановление остаётся
неподтверждённым; нельзя закрыть приёмку затронутой совместимости одним отказом
или переименованием существующего current-файла в неподдерживаемый.

Выдача файла подтверждается фактическим внешним сохранением и повторным выбором
для импорта на целевом клиенте, а не только вызовом API. Недоступный, отменённый
или не подтверждённый способ явно сообщается; recovery-export непубликованного
candidate не называется полным Portable Backup. Без доказанной локальной выдачи
полная Telegram-приёмка переноса не пройдена. Передача Project, GLB или backup
на сервер и автоматическая отправка боту требуют отдельного согласования.

#### FR-58: Сосуществование и совместимость выпусков

Web/PWA сохраняют независимый запуск, данные, установку, offline и обновление;
доступность Telegram не является их условием. Telegram и Web/PWA используют
совместимые проверки версии и состояния данных при запуске и обновлении, включая
writable, read-only/exportable и migration-in-progress; отсутствие worker у
Telegram не отключает проверки. Несовместимая или недоступная версия и ошибка
миграции не разрешают небезопасную запись и сохраняют доступный recovery/export.

При выпуске и откате открытые поддерживаемые клиенты сохраняют доступ к нужным
ресурсам; обновление Telegram не принуждает активную PWA к reload. Во время
S0–S7 browser/PWA продолжают работать. Последующий Telegram-only переход
возможен только после проверки владельцем Telegram, выполнения применимых
критериев включая внешний backup на iOS/Android, решения о доступе к старым
локальным данным, проверенного переноса и rollback и отдельного допуска к
удалению. До этого старые Projects и единственные исходные копии не удаляются.

#### FR-59. Расстояния от напольного предмета до стен в Telegram

При постановке или перемещении напольного предмета на плане пользователь видит
обновляемые расстояния слева, справа, сверху и снизу. Каждое измерение идёт
вдоль оси плана через центр предмета. Отсчёт начинается на фактической границе
его повёрнутого габарита и заканчивается на первой внутренней границе той же
комнаты в этом направлении. Ниши, диагонали и внутренние границы учитываются,
когда их предоставляет действующая проекция допустимой комнаты. FR-59 не меняет
допуск топологии и скрывает размеры для неподтверждённого контура. Значения
выводятся в миллиметрах по FR-13 и доступны текстом, в том числе на узком экране.

- Если у луча есть подходящая граница, показывается измерение для этого
  направления. Точное касание даёт `0 мм`. Пересечение стены в направлении
  измерения даёт подсказку о конфликте по FR-31. Когда комнату определить
  невозможно, направляющие скрываются.
- Перетаскивание и поворот меняют направляющие вместе с черновиком. Масштаб и
  панорамирование меняют отображение, расстояния в миллиметрах сохраняются.
  Отмена, завершение, смена вида и потеря валидного черновика скрывают размеры.
  Направляющие существуют только во время редактирования. Измерения дверей,
  окон и настенных предметов используют действующие привязки.
- Контрольный случай. Для внутренней комнаты `4000 × 3000 мм`, предмета
  `1000 × 500 мм` без поворота и его центра в `1000 мм` от левой и верхней стен
  значения слева, справа, сверху и снизу составляют `500`, `2500`, `750` и
  `1750 мм` соответственно.

Связь с CAP-2, CAP-6, CAP-13 и AD-32.

**Уточнение 22 ноября.** Четыре расстояния доступны для точного ввода в
черновике и параметрах напольного предмета. Значение в миллиметрах изменяет
одну координату в текущей комнате, а остальные три пересчитываются.
Недостижимое значение оставляет последнюю допустимую позицию. Два контакта на
холсте сдвигают или масштабируют план, сохраняя положение и угол предмета.

#### FR-60. Каталог условных предметов и палитра в Telegram

Пользователь выбирает новые предметы из локального каталога условных моделей
с узнаваемыми габаритами и формой. Набор покрывает мебель, сантехнику, технику,
светильники и аксессуары в поддерживаемых категориях размещения. Для каждого
пресета заданы категория, размеры и совместимая напольная или настенная опора.
После подготовки редактора каталог доступен для выбора и размещения без
подключения к внешнему каталогу.

- Пользователь видит габарит на плане и силуэт в 3D, уточняет размеры и выбирает
  цвет по названию и образцу. Оттенок сохраняется с предметом, виден в редакторе
  после открытия и переносится с проектом. Размещение, размер и цвет участвуют
  в общем Undo/Redo и Durable save. Покупательские артикулы, фото, текстуры и
  копии конкретных товарных форм исключены. Для публикуемого кода оттенка
  указываются система и проверяемый источник. Экранный образец помогает сравнить
  сочетания. Цвет материала подбирают по физическому образцу.
- После обновления Telegram открывает, изменяет и экспортирует ранее
  поддерживаемые GLB, смешанные проекты и их Portable Backups по FR-44, FR-45 и
  FR-57. Точные ссылки, байты и привязки существующих ресурсов сохраняются.
  Поисковые сценарии Web/PWA и проверка отсутствующих ресурсов продолжают
  действовать по FR-26–33, FR-54, FR-58 и NFR-13.

Связь с CAP-6, CAP-7, CAP-10, CAP-13 и AD-33.

**Уточнение 22 ноября.** В Telegram выбор цвета предмета выполняется в 3D,
в том числе для ранее размещённого поддерживаемого настенного предмета.
Переход между видами сохраняет доступный черновик, угол и оттенок.

#### FR-61. Добровольная аналитика и оценка в Telegram

В текущем выпуске учитываются две московские суточные суммы. Общий подсчёт по умолчанию включён, его можно выключить до первого входа и в настройках. Повторные входы с устройства считаются отдельно после явного разрешения новой редакции. Первый проверенный вход при таком разрешении устанавливает локальную базу, следующий самостоятельный вход в ту же область может добавить один повтор. Повторный рендер одного входа события не создаёт. Отзыв очищает базу, новое разрешение начинает отсчёт заново. Для возвратов действует первый из сроков окончания исследования, отзыва и 1 апреля 2027 года в 00:00 МСК. Новый выпуск не считает уникальных пользователей между устройствами. Ранее собранные сведения сохраняют собственные условия обработки. [Условия выпуска](../../sprint-change-proposal-2026-11-22-public-candidate.md)

Шторка «Статистика» использует общий заголовок и крестик закрытия.
Настройки отображают основной переключатель и отдельное разрешение на
подсчёт повторов. Включение общего счётчика не разрешает учёт повторов.

**Прежний пилот с браузерным SDK.** Следующие цели и события относятся к ранее описанной интеграции.

Пользователь может разрешить измерение использования через Яндекс Метрику,
продолжить без аналитики и отозвать согласие в TMA. После проверенного запуска
и согласия учитываются посетители, визиты и возвращаемость в рамках этой
аудитории. Для пилота измеряются прохождение первого сценария, сохранение,
стабильность и добровольная оценка. Приложение работает при отказе или
недоступности сервиса согласно NFR-29.

| Цель | Измеряемое действие |
|---|---|
| `tma_open` | Проверенный запуск после согласия. |
| `project_created`, `room_created`, `item_placed`, `item_color_changed` | Успешное Durable создание проекта, создание комнаты, размещение предмета или изменение цвета соответственно. |
| `view_3d_opened`, `project_reopened` | 3D доступен для просмотра или пользователь вновь открыл проект. |
| `editor_recovery_shown`, `editor_save_failed` | Появилось соответствующее состояние. Допустимы версия сборки и утверждённый код причины. Повторный рендер событие не дублирует. |
| `feedback_rating` | Добровольные ответы «Удалось ли собрать планировку?» и оценка от 1 до 5 после первого сохранённого сценария или по кнопке «Оценить». Пользователь может пропустить опрос. |

Источник приглашения определяется ограниченным набором кодов проверенного
Telegram-запуска. Неизвестный или отсутствующий код учитывается только общей
категорией. Фактическое завершение сценария и самооценка анализируются отдельно.
Добровольный текстовый отзыв доступен через отдельный канал обратной связи.

Связь с CAP-13 и AD-34.

## 6. Cross-Cutting Non-Functional Requirements

**NFR-29, действующая серверная схема.** Для каждого разрешённого вида счётчика в проверенном редактируемом TMA допускается максимум один пустой POST за вход. Неопределённое локальное решение исключает отправку соответствующего события. На устройстве отдельно от проекта и резервной копии хранятся версия и дата решений и минимальные признаки выбора и базового входа. Квитанции, идентификаторы, Telegram ID и содержимое проекта службе не передаются. Служба хранит московский день и два итога, доставляет в Метрику только суточные суммы с общими служебными параметрами отчёта. Сеть видит технический IP при соединении. Проверяются границы журналирования и остановка прежних клиентских маршрутов и старого SDK. [Условия выпуска](../../sprint-change-proposal-2026-11-22-public-candidate.md)

### Geometry and correctness

- **NFR-1 — Canonical precision:** все persisted coordinates, dimensions and offsets — целые миллиметры; save/reopen и backup roundtrip дают 0 мм semantic drift.
- **NFR-2 — Projection boundary:** renderer использует metres только после явного conversion at adapter boundary; обратное преобразование не владеет domain state.
- **NFR-3 — Atomic validity:** failed command оставляет Project
  byte/semantically equivalent предыдущей Durable Revision; validated candidate
  не называется saved до persistence pointer swap. Transient selection/stale
  measurement, отменённый conflict choice и stale/fence-lost re-entry не могут
  стать Command, History или silent mutation.
- **NFR-4 — Determinism:** одинаковый versioned Project и catalog versions
  создают одинаковую topology и resource-backed `AssetVariant` selections.

### Performance and resource use

- **NFR-5 — Gesture responsiveness:** в принятых физических проверках `NFR-15` 3D-навигация и манипуляция предметом остаются функциональными. Количественные frame-time и main-thread измерения — инженерская диагностика, но не alpha gate.
- **NFR-6 — Reference scene:** provisional alpha benchmark — до 6 Room, 60 AssetInstance, 750k visible triangles, 250 draw calls и 128 MiB estimated GPU resources; точные limits подтверждаются spikes.
- **NFR-7 — Startup:** на принятых устройствах пользователь может открыть приложение и начать обычное локальное редактирование. Cold/warm timing thresholds и повторные прогоны остаются диагностическими, не release-критерием Alpha.
- **NFR-8 — 3D recovery:** автоматизированная регрессия обязана восстанавливать тот же Project после forced WebGL context loss без reload; отдельный 15-minute thermal run не требуется для Alpha. Adaptive tier может снижаться, не меняя Durable data.
- **NFR-9 — Demand rendering:** вне animation/gesture scene не обязана непрерывно рендериться.

### Reliability and data durability

- **NFR-10 — Offline core:** core editing не зависит от Background Sync,
  доступности Catalog Control Plane или удалённого сохранения User Project.
  После pin всех exact referenced resources existing local Project можно
  открыть, изменить, Durable save, провести через local undo/redo и
  экспортировать без сервиса.
- **NFR-11 — Recovery:** abrupt termination в любой момент восстанавливает
  последнюю Durable Revision; recovery evidence покрывается automated и device
  tests на каждой границе staging/pointer swap.
- **NFR-12 — Migration:** каждая schema migration имеет fixtures previous versions, idempotence policy и rollback/backup boundary.
- **NFR-13 — Storage pressure:** приложение само не удаляет Project при quota
  error и даёт recoverable UX/backup path; browser/OS origin eviction считается
  внешним риском и проверяется restore из Portable Backup. Любая non-corrupt
  Durable Revision текущей policy остаётся внутри complete-backup envelope.
  Missing/corrupt referenced hash переводит Project в read-only
  `ResourceRecoveryRequired`: обычные edits/undo/redo заблокированы до
  verified exact-byte restore либо атомарного RecoveryChangeSet без unresolved
  references. Для issue только в session History допустим лишь exact repair
  либо явно подтверждённый `DiscardSessionHistory` при healthy current Project.
  `DiscardSessionHistory` сначала доказывает health current Project, затем
  атомарно удаляет обе session branches без Project Revision, показывает новую
  boundary и никогда не выполняется автоматически. complete backup healthy
  current остаётся доступен и не переносит History.

### Compatibility

- **NFR-14 — Rendering baseline:** WebGL 2 обязателен для alpha; WebGPU является feature flag/progressive enhancement и не меняет semantics.
- **NFR-15 — Device functional acceptance:** для Alpha достаточно подтверждённой владельцем продукта проверки на **iPhone 15 Pro Max** и **Samsung S24 Ultra** в доступных browser и installed-PWA contexts. Проверяются создание, reopen и локальное сохранение Project, 2D/3D navigation, постановка/перемещение/дискретное вращение предмета, а также безопасное обновление PWA. Эта проверка уже пройдена 2026-08-29; она не является hardware benchmark или обещанием производительности для всех телефонов.

  Exact model matrix, OS/browser baselines, независимый reviewer, 20 cold/warm starts, RS-2 frame-time distribution и 15-minute thermal run не требуются для Alpha. Они могут собираться как добровольная инженерская диагностика, но не блокируют release. Desktop и emulator остаются вспомогательной development surface, а capability-based fallback `NFR-16` сохраняется для любого устройства.

  **Historical source trace (superseded 2026-08-29).** Следующие ссылки документируют снятую матрицу и не создают Alpha-требование.

  **Source trace.** Профили сверены с первичными vendor sources: [iPhone 13 mini](https://support.apple.com/en-lamr/111873), [iPhone 17](https://support.apple.com/en-us/125089), [Apple iOS](https://www.apple.com/uk/os/ios/) и [Apple iOS 26 updates](https://support.apple.com/en-us/123075); [Apple WWDC23: Home Screen storage](https://developer.apple.com/videos/play/wwdc2023/10120/?time=253); [Galaxy A53 SKU](https://www.samsung.com/ro/support/model/SM-A536BZKNEUE/), [Galaxy A53 specifications](https://news.samsung.com/us/new-galaxy-a53-5g-awesome-technology), [Galaxy A53 Exynos 1280](https://news.samsung.com/in/samsung-launches-galaxy-a53-5g-with-64mp-ois-camera-and-5nm-processor-announces-exciting-pre-book-offers), [One UI 8 / Android 16](https://www.samsung.com/co/support/one-ui-8-android-16/), [Galaxy S26 SKU record](https://images.samsung.com/is/content/samsung/p6/common/energylabel/s2602/common-energylabel-sm-s942blbgeue-productfiche.pdf), [Galaxy S26 specifications](https://news.samsung.com/us/samsung-unveils-galaxy-s26-series-most-intuitive-galaxy-ai-phone-yet), [Chrome for Android 150.0.7871.114](https://chromereleases.googleblog.com/2026/07/chrome-for-android-update.html). Exact regional firmware and browser patch remain measured evidence, not inferred support promises.
- **NFR-16 — Capability detection:** renderer, storage and installability определяются по capabilities, а не только user-agent.
- **NFR-28 — Telegram physical evidence:** до заявления готовности Telegram фактически проверить iOS и Android: create → edit → catalog placement → 3D → Durable save → close → reopen; Back/Close, keyboard/safe area и offline после подготовки; внешний export и повторный import в обоих направлениях. Использовать iPhone 15 Pro Max и Samsung S24 Ultra либо явно согласованную замену, записать устройство, OS и версию Telegram. Реальные floor- и wall-модели проходят placement и reopen в обеих поверхностях с exact pin/hash. Эмулятор/bridge fake не заменяет физическую проверку; отсутствие доступа остаётся pending. Историческая проверка NFR-15 не доказывает Telegram.
  Для ноябрьских срезов также записать точную сборку TMA и проверить
  добавление и изменение двери и окна, размещение шкафа, выбор, перемещение
  стула после приближения и повороты предмета в Plan и 3D. Включить фон и
  возврат, смену вида, повторное открытие, работу новых направляющих и
  локальных пресетов, применение цвета и доступность редактора после отказа
  от аналитики.

### Accessibility and interaction

- **NFR-17 — Touch floor:** интерактивные DOM-targets не меньше 44×44 CSS px, учитывают safe areas и не зависят от hover.
- **NFR-18 — Accessible controls:** DOM controls, forms, dialogs and navigation соответствуют WCAG 2.2 AA; validation связана с полем и озвучивается assistive tech.
- **NFR-19 — Accessible alternative:** критическое действие 3D/touch имеет
  доступный DOM/list alternative там, где canvas сам по себе недоступен; это
  не требует прямого ввода глобальных координат.
- **NFR-20 — Motion:** reduced-motion preference убирает необязательную camera animation.

### Security and privacy

- **NFR-21 — Local privacy:** без отдельного явного согласования Project, Portable Backup, geometry, screenshots
  и ImportedAssets/GLB не отправляются во внешнюю систему; Telegram-интеграция
  сама по себе такого согласования не даёт. Catalog Control Plane
  не создаёт пользовательскую account identity и не принимает, не хранит, не
  синхронизирует и не восстанавливает Project, Revision, session History или
  Portable Backup.
- **NFR-22 — Import isolation (Alpha+):** untrusted GLB проходит byte-level
  deny-network preflight, allowlist и staged resource limits; metadata не
  интерпретируется как HTML; Worker не считается hard memory sandbox.
- **NFR-23 — Telemetry minimization:** analytics, если включены, не содержат plan geometry, asset binary, file names or screenshots; opt-out определён до public alpha.
- **NFR-29 — Граница прежнего браузерного SDK:** до явного согласия приложение
  не загружает код провайдера, не обращается к нему и не создаёт
  идентификаторы аналитики. После отзыва согласия дальнейшая отправка
  прекращается. Приложение передаёт только согласованные имена событий из
  FR-61 и разрешённые скалярные параметры. Вебвизор, запись форм, карты кликов
  и автоматическая передача реальных URL и referrer выключены. Содержимое
  проектов, резервные копии, геометрия, названия, файлы, кадры редактора,
  исходные ошибки и stack trace, текстовые отзывы, идентификаторы аккаунта
  и исходные данные запуска исключены из аналитики. В события не входят
  реальные query, hash и referrer либо неизвестные значения входных параметров.
  Отказ, отсутствие сети и блокировка провайдера сохраняют доступ
  к редактированию, сохранению, повторному открытию и экспорту. Применимость
  ограничена Telegram Mini App. Связь с CAP-13 и AD-34.

### Maintainability and observability

- **NFR-24 — Stable contracts:** `CAP-*`, `FR-*`, `NFR-*`, `AD-*` не переиспользуются; breaking schema change повышает version.
- **NFR-25 — Diagnostics:** alpha feedback содержит app/schema/catalog versions, capability tier and non-sensitive error code, но не пользовательский проект.
- **NFR-26 — Testability:** domain/topology тестируются без DOM/GPU; renderer и
  persistence доступны через ports/adapters. Versioned corpus покрывает
  одинаковый selected candidate для canvas/DOM alternative, transform failure,
  T/X, Room holes/lineage, paired measurement, conflict re-entry, item-host
  reconciliation, resource admission/recovery и forward/inverse outcomes;
  соответствующие E2E journeys доказывают пользовательский результат.
  Браузерная приёмка каждого инкремента Telegram выполняется через Playwright
  MCP с записью проверенной сборки, сценария и результата.

### Applicability by release contour

| Requirement | Alpha entry | Alpha+ |
|---|---|---|
| `NFR-1`–`NFR-21` | applicable | applicable |
| `NFR-22` | `N/A by scope`: custom GLB отсутствует | applicable и blocking CAP-12 |
| `NFR-23`–`NFR-26` | applicable | applicable |
| `NFR-28`, `NFR-29` | applicable для Telegram extension | applicable для Telegram extension |

`N/A` является явным scope result, а не выполненным требованием. Если CAP-12
повышается в Alpha entry, NFR-22 автоматически становится blocking.

### Применимость поверхностей в S0–S7

| Требование | Browser | Installed PWA | Telegram Mini App |
|---|---|---|---|
| Alpha entry FR-1–2, 4–19, 21–23, 25–33, 38–40, 43–45, 47, 54 и применимые NFR | Да | Да | Да, эквивалентный domain outcome; FR-55–58 |
| FR-41 установка и PWA update/worker | Browser поддерживает install flow | Да | N/A: host не PWA; schema compatibility обязательна по FR-58 |
| FR-42 cold offline reopen после подготовки | Да, где поддержан существующим контуром | Да | N/A при cold launch; online launch и дальнейшая локальная работа по FR-55 |
| NFR-15 историческое physical evidence | Исторический browser/PWA контур | Исторический browser/PWA контур | Не переносится; отдельное NFR-28 pending |
| FR-48–52 / NFR-22 | Только когда принят Alpha+ | Только когда принят Alpha+ | Только когда принят Alpha+; этот update не повышает scope |
| FR-55–58 и NFR-28 | Сохранение и совместимость с Telegram | Сохранение и совместимость с Telegram | Применимо к расширению; physical evidence pending |
| FR-59–61 и NFR-29 | Проверка совместимости по FR-58 | Проверка совместимости по FR-58 | Срезы Telegram. Требуют применимого implementation-readiness и приёмки. |

Retired FR-3, FR-20, FR-24, FR-34–37, FR-46, FR-53 и NFR-27 не
восстанавливаются. Существующие общие NFR действуют по назначению; NFR-15 и
NFR-28 имеют отдельные доказательства. CAP-9 и FR-41 остаются активными.

## 7. Alpha Scope

### 7.1 Alpha entry — required

- FR-1–FR-47, кроме retired `FR-3`, `FR-20`, `FR-24`, `FR-34`–`FR-37` и
  `FR-46`, и FR-54–FR-58, кроме функций,
  явно отмеченных как Alpha+.
- Один Level, несколько связанных Room.
- Manual touch authoring; 0°/45°/90°.
- Representative generic catalog и Parametric Placeholder.
- Catalog control plane только для metadata/resources и hashes; User Project
  и его durable history/backup остаются local.
- Local-first autosave, offline reopen и backup.
- Реальные iOS/Android usability/performance tests.
- Все Alpha-applicable NFR; `NFR-22` явно `N/A by scope`.
- Для пилота Telegram применяются FR-59–61 и NFR-29 после прохождения
  implementation-readiness для каждого среза. Допуск к пилоту требует
  физической приёмки по NFR-28 и проверки соответствующих изменений. Участие
  пользователя в аналитике остаётся добровольным.

### 7.2 Alpha+ — does not block first testers

- FR-48–FR-52 custom GLB import.
- Более богатое variant comparison.
- Favorites and catalog expansion.
- View-only cloud link — отдельное future decision; Alpha Catalog Control Plane
  его не предоставляет.

### 7.3 Explicit Non-Goals

- LiDAR/AR room scanning и floor-plan image recognition.
- AI restyle, autofurnish, generative assets.
- Photorealistic/4K/360° rendering.
- Multi-level, stairs, roof, outdoor and landscape.
- Curved walls, arbitrary-angle walls and structural calculations.
- BIM/IFC/DWG/CAD export and building-code compliance.
- Серверные пользовательские accounts, remote Project sync/collaboration, comments, organization
  accounts и server-side storage/recovery User Project, Revision, session
  History или Portable Backup.
- Estimates, BOM, pricing, retailer cart and branded SKU catalog.
- Universal 3D import beyond constrained GLB.
- Потолочные предметы, освещение, поверхности, покрытия и отдельный
  `CeilingPlacement`.
- Назначение покрытий пола и стен, независимые варианты Project и PNG download/share.
- Desktop-first authoring parity.
- Door access control, keys и open/close interaction.
- In-app Focus, native fullscreen и fullscreen-specific viewport controls.

## 8. Success Metrics

Все targets ниже provisional и требуют подтверждения владельцем продукта.

### Primary

- **SM-1 — Core task completion:** ≥80% целевых участников без помощи завершают UJ-2 и representative furnishing flow за ≤15 минут. Валидирует FR-6–FR-33, кроме retired требований.
- **SM-2 — Decision outcome:** ≥70% участников после сессии называют конкретное решение или обнаруженную проблему планировки. Валидирует product vision.

### Quality

- **SM-3 — Exact roundtrip:** 100% golden projects проходят save/reopen/backup import без 1 мм drift. Валидирует NFR-1–NFR-4.
- **SM-4 — Offline continuity:** 100% применимых browser/PWA reference-device runs выполняют cold open/edit/save in airplane mode после initial setup; Telegram проверяет local edit/save после подготовки по FR-55. Валидирует FR-42, FR-55 и NFR-10.
- **SM-5 — Reference-scene usability:** Product Owner подтверждает обычный 3D-путь на iPhone 15 Pro Max и Samsung S24 Ultra; automated recovery regression сохраняет Project после forced context loss. Валидирует NFR-5–NFR-9 и NFR-15.
- **SM-6 — Recovery:** fault-injection до/после каждой persistence boundary
  восстанавливает последнюю Durable Revision. Валидирует FR-5 и NFR-11.

Для пилота Telegram отдельно наблюдаются доля завершивших первый сценарий,
возврат на следующий день или неделю, частота recovery/save failure и
распределение добровольных оценок. Аналитика описывает только согласившуюся
аудиторию. Пользовательские интервью и отзывы помогают проверить результат за
пределами этой выборки. Связь с FR-61 и NFR-29.

### Counter-metrics

- **SM-C1:** не оптимизировать количество catalog assets ценой first-load, memory or usefulness.
- **SM-C2:** не максимизировать session duration; более короткое время до решения лучше.
- **SM-C3:** не улучшать visual fidelity ценой touch latency или device coverage.
- **SM-C4:** не измерять успех количеством созданных Projects без evidence полезного решения.

## 9. Dependencies and Preconditions

- Полное принятие D22-01…D22-10 всеми каноническими владельцами и versioned
  fixture corpus для selection, geometry, reconciliation, resource и recovery
  outcomes.
- Representative free/self-authored asset set и технический catalog manifest.
- Renderer/topology/offline/import/touch spikes.
- Functional-проверка владельца на iPhone 15 Pro Max и Samsung S24 Ultra (выполнена 2026-08-29).
- Portable project schema и fixture corpus до UI expansion.
- Для пилота Telegram проверить управляемый владельцем счётчик, согласие,
  прекращение отправки при отзыве и приём контролируемого тестового события
  по FR-61 и NFR-29. Аналитика за пределами этого среза требует собственного
  продуктового решения.
- Инициализированный Git repository и безопасный branching/worktree workflow.

## 10. Open Questions

### Telegram: источники и условия следующих решений

- **Условный выбор владельца:** если проверенная локальная выдача backup на
  целевом Telegram-клиенте невозможна, владелец решает отдельным соглашением,
  допустим ли иной способ и его privacy/retention. До решения не передавать
  Project/GLB/backup на сервер; блокируется полная приёмка переноса, а не все
  независимые работы расширения. Ответственный — Product Owner; момент —
  после физической проверки локальной выдачи.
- **Условный вопрос совместимости backup:** если проверка подтвердит, что
  корректный файл прежнего поставляемого формата неоднозначен и проверенного
  пути через прежний контекст и новый export нет, должен ли продукт гарантировать
  восстановление такой единственной копии или владелец принимает ограничение и
  условия его пересмотра? До решения не угадывать формат и не заявлять
  восстановление; вопрос относится к затронутым файлам и приёмке переноса, а не
  ко всем независимым срезам расширения.
- Identity/trust design до writable runtime, фактическая совместимость схем и
  реальные bot/origin/устройства — зависимые инженерные решения и evidence;
  не считать их полученными. Исторический READY 30 августа и preflight baseline
  не оценивают это расширение; требуется применимый readiness или waiver.

### Product phase blockers

Для исходной внутренней Alpha неразрешённых продуктовых решений после решения владельца
от 2026-08-06 не осталось. Это не означает прохождение implementation-readiness
или release gates: исследования, независимые review и physical-device evidence
остаются отдельными фактическими условиями.

### Resolved in this update

- **Telegram Mini App, 2026-11-21.** Владелец утвердил приоритет критических
  регрессий, направляющие до стен, переход к условным предметам и добровольную
  Метрику. FR-55 и FR-59–61 фиксируют поведение. NFR-29 задаёт границу сбора
  данных. Применимый implementation-readiness и доказательства работы на
  физических клиентах фиксируются отдельно.

- **Alpha catalog licensing (2026-11-04):** владелец подтвердил действующее
  правило PRD/SPEC без формального `AssetUsageGrant` и поручил обновить AGENTS;
  прежний конфликт источников разрешён. Владелец отбирает бесплатные или
  собственные модели вне приложения; formal licensing/provenance/declaration/
  attribution/notice admission не является Alpha gate. По FR-28/FR-44 и NFR-21
  сохраняются техническая validation ресурсов, security, hashes, exact pin,
  backup feasibility и запрет серверной передачи пользовательских Projects и
  файлов без отдельного согласования. Это не подтверждает physical Telegram
  acceptance и не закрывает оставшиеся технические и readiness зависимости.
- **Portable Backup, limits и ownership (2026-08-06):** Роман Желтов как
  единственный Product Owner утвердил self-contained `.interiors` container,
  описанный в `project-and-backup-contract.md`: canonical
  `project/project.json`, versioned manifest, checksums и exact referenced
  resource bytes, без external URL как source of truth. Временной Alpha
  baseline — текущая таблица `ProjectLimitsPolicy` и backup-import limits этого
  контракта; UI показывает non-blocking warning при пересечении warning
  threshold и возвращает stable hard-reject reason при hard limit, не обрезая
  данные молча. Любое изменение чисел требует последующего evidence на
  физических устройствах и отдельного product decision.
- **Единый accountable owner (2026-08-06):** Роман Желтов принимает все
  продуктовые решения Alpha и несёт ответственность за Product, UX,
  Architecture, Asset/Content, research и operations decisions внутри
  проекта. Это не превращает self-review в независимое evidence: там, где
  gate требует независимого reviewer или участника исследования, необходим
  отдельный человек и его наблюдаемые материалы.
- **Содержимое внутренней Alpha (историческая запись 2026-08-06):** это решение фиксирует тогдашний baseline, не утверждает состояние каталога на 2026-11-04; последующие catalog evidence и действующий scope требуют отдельной reconciliation владельцем content policy. Тогда до отдельного решения о
  внешнем каталоге продукт использует только code-authored procedural
  greybox/Parametric Placeholder: стол, стул, кровать, дверь, стены, пол,
  окно, тумбочка, комод и шкаф. Эти объекты не являются remote
  `CatalogVersion`, не содержат сторонних model/texture bytes и не заявляют
  коммерческий SKU; поэтому их placement не подменяет будущий
  pin/backup path для внешнего каталога. Kotlin/PostgreSQL
  Catalog Control Plane и S-6 evidence остаются отложенными, но не отменены.
- **Research sequencing (2026-08-06):** consent-backed наблюдения UJ-1–UJ-6
  выполняются после feature-complete внутренней Alpha. До их фактического
  завершения продукт не делает public/release claim. Они не изменяют
  `G-READY` и не разрешают production implementation до официального verdict
  `READY`. Written waiver может разрешить только именованный ограниченный
  disposable evidence-spike в точно утверждённых paths; он не разрешает
  production root/scaffold, `V-*` story, feature path, commit или
  promotion/reuse spike code.

- **Device acceptance (2026-08-29):** Product Owner отменил ранее утверждённую восьмиконтекстную performance matrix. `NFR-15` фиксирует достаточную уже выполненную функциональную проверку iPhone 15 Pro Max и Samsung S24 Ultra в browser/PWA contexts; quantitative performance/thermal certification не входит в Alpha.
- **Focus/fullscreen (retired 2026-08-24):** in-app Focus, native fullscreen
  и связанные controls/evidence исключены из Alpha. `FR-53` и `NFR-27`
  retired и не переиспользуются; `NFR-15` сохраняет только двухустройственную
  functional-проверку без fullscreen-specific rows.
- **Ceiling scope (retired 2026-08-24):** потолочная поверхность, потолочные
  предметы/свет, покрытия и `CeilingPlacement` исключены из Alpha. `FR-36`
  retired и не переиспользуется; `Room.heightMm` остаётся высотой помещения и
  source производной высоты стен.
- **Door navigation semantics (2026-08-04, superseded 2026-08-22):** Walk,
  navigation edge и Door transition удалены из Alpha. Door остаётся wall-hosted
  Opening без `passable`/`locked`, access control, keys или open/close state.
- **Catalog Control Plane (2026-08-04, revised 2026-08-25):** владелец утвердил
  Kotlin/PostgreSQL только как ограниченный control plane catalog metadata/
  resources и hashes. Это не меняет no-account local Project model: нет
  remote Project/Revision/history/backup, sync или collaboration, а Project с
  pinned exact resources остаётся usable при недоступном сервисе.
- **Constrained geometry and exact intersections (2026-08-05):** delegated
  `D-011`/`D-012`/`D-013` are now reflected in adopted `AD-7`: the editor grid
  is infinite presentation, not persisted Gridfinity storage; touch uses a
  100-mm candidate relative to the active origin; visual 100/500/1 000-mm
  cells never rewrite geometry; touch candidates retain integer-mm endpoints;
  and a 45° touch candidate previews its integer-endpoint quantisation. An otherwise
  valid exact X, like an exact T, atomically creates one shared Vertex and the
  necessary non-zero Wall segments. Само решение D-011/D-012/D-013 не
  определяло `D-022`; его product outcomes ниже приняты отдельной записью,
  а точный contract/corpus остаётся работой других canonical owners.
- **D-022 product outcomes (2026-08-05, revised 2026-08-23):** packages
  D22-01…D22-10 приняты в PRD: воспроизводимый touch selection с transient
  retry, valid Room
  holes, revision-bound paired measurement, preview → choice → revalidate для
  Room/Opening/item-host conflicts, T/X и lineage evidence, техническая
  проверка catalog/custom resources, fenced recovery
  и explicit history discard без silent mutation. Это PRD adoption не выбирает
  библиотеку/transport и не является `READY`. Прежние licensing proof routes
  отменены решением владельца от 2026-08-25 и не восстановлены решением от
  2026-11-04; SPEC, Architecture и UX обязаны
  принять свои части и corpus до следующей readiness assessment.

### Should resolve before public alpha

3. Язык UI, география и metric-only policy.
4. Нужна ли аналитика за пределами Telegram-пилота и какие события допустимы?
5. Должен ли desktop показывать read-only, unsupported message или best-effort editor?
6. Custom GLB обязателен до first external testers или остаётся Alpha+?
7. Какие значения hard limits импорта подтверждены на reference phones?
8. Нужен ли view-only sharing раньше account/cloud sync?
9. Какова бесплатная модель и что никогда не будет paywalled?

### Later

12. LiDAR/AR, image tracing and AI roadmap.
13. Multi-floor and arbitrary-angle demand.
14. Manufacturer catalog and commerce strategy.

## 11. Assumptions Index

- **A-1 — resolved/retired (2026-08-05, revised 2026-08-23):** Gridfinity
  означает бесконечную constraint grid редактора, а не стандарт модульного
  хранения; утверждённое поведение сетки и touch-кандидата задано в
  `FR-7`/`FR-8`.
- **A-2:** Alpha содержит один Level.
- **A-3 (revised 2026-08-23):** Manual touch entry достаточно для проверки
  основного JTBD; прямой ввод глобальных координат исключён из Alpha.
- **A-4:** Для действующего Web/PWA representative catalog порядка 100–150
  generic assets плюс Parametric Placeholder достаточен. Для нового набора
  Telegram применяются категории и свойства FR-60.
- **A-5:** Static GLB import не блокирует Alpha entry.
- **A-6:** WebGL 2 покрывает выбранный alpha device floor.
- **A-7:** Cloud account, sync and collaboration не требуются для первого полезного продукта.
- **A-8:** Рабочее название InteriorsEditor не является утверждённым брендом.
- **A-9 (superseded 2026-08-22):** Walk, Door navigation edge и transition
  исключены из Alpha; Door остаётся валидируемым wall-hosted Opening без
  access/open-close state.
