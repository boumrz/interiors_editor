---
title: "Implementation Readiness Assessment Report"
date: 2026-08-22
project: "InteriorsEditor"
status: superseded
superseded_by: "sprint-change-proposal-2026-08-22-remove-room-walk.md"
stepsCompleted:
  - document-discovery
  - prd-analysis
  - epic-coverage-validation
  - ux-alignment
  - epic-quality-review
  - final-assessment
documentsIncluded:
  prd:
    - "_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md"
  ux:
    - "_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md"
    - "_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md"
  architecture:
    - "_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md"
  epics:
    - "_bmad-output/planning-artifacts/epics.md"
ownerConfirmation: "C — 2026-08-22"
---

# Implementation Readiness Assessment Report

> Superseded on 2026-08-22: the Product Owner removed Room Walk from Alpha.
> This assessment is retained as historical readiness evidence only; the current
> product contract is the approved sprint-change proposal and its synchronized
> PRD/SPEC/Architecture/UX/roadmap artifacts.

**Date:** 2026-08-22  
**Project:** InteriorsEditor

## Document Discovery

| Document type | Selected source | Discovery result |
| --- | --- | --- |
| PRD | `prds/prd-InteriorsEditor-2026-07-26/prd.md` | One whole document; no sharded duplicate found. |
| UX design | `ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md`, `EXPERIENCE.md` | One sharded document set; no whole-document duplicate found. |
| Architecture | `architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md` | One whole document; no sharded duplicate found. |
| Epics and stories | `epics.md` | One whole document; no sharded duplicate found. |

The owner confirmed this document set for assessment on 2026-08-22. Historical
POC archives and evidence spikes remain out of scope as product implementation
sources.

## PRD Analysis

### Functional Requirements

The following is the complete source extraction from the approved PRD; it is kept
verbatim rather than reduced to a summary for later coverage validation.

#### FR-1: Create Project

Пользователь может создать Project с рабочим названием и одним пустым Level.

**Consequences:**

- Project получает устойчивый внутренний ID, `schemaVersion`, timestamps и initial valid state.
- Новый Project не требует аккаунта или сети после загрузки app shell.

#### FR-2: List, Open and Rename

Пользователь может увидеть локальные Projects, открыть и переименовать выбранный Project.

**Consequences:**

- Список различает empty, loading, corrupted and populated states.
- Переименование не меняет внутренний ID и не дублирует данные.

#### FR-3: Duplicate Variant

Пользователь может создать независимую копию Project как новый вариант.

**Consequences:**

- Копия получает новый ID и сохраняет все размеры и asset references.
- Будущие изменения копии не меняют исходный Project.

#### FR-4: Delete With Recovery Boundary

Пользователь может переместить Project в локальную Trash, восстановить его или
удалить permanently после отдельного подтверждения.

**Consequences:**

- Trash не очищается автоматически; storage-pressure UX может предложить
  пользователю очистить её.
- Permanent delete показывает название и необратимость.
- Ошибка удаления не оставляет частично удалённые metadata/assets.

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

#### FR-8: Exact Numeric Wall Input

Пользователь может задать точную координату Vertex или желаемую длину Wall в
миллиметрах.

**Consequences:**

- Применение значения либо создаёт валидный constrained segment, либо объясняет конфликт.
- Ввод не преобразует канонический размер через floating-point metres.
- Числовой ввод принимает off-grid integer-mm endpoint/delta, если он
  удовлетворяет тем же direction и полным геометрическим инвариантам; он не
  обязан быть кратным 100 mm и не обходит validation.
- Один и тот же допустимый endpoint/delta даёт одинаковый constrained result
  при numeric- и touch-вводе; временная недоступность touch-преобразования не
  меняет numeric value, current draft или Durable Project.
- Для 45° авторитетны integer-mm endpoints. При вводе только желаемой
  диагональной длины пользователь явно выбирает quadrant; `n = round(L / √2)`
  определяет одинаковые по модулю signed deltas, а preview показывает
  квантизованную фактическую длину до подтверждения.

#### FR-9: Move and Split Topology

Пользователь может перемещать Vertex, разделять Wall и добавлять Wall к существующей Vertex.

**Consequences:**

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
выводится из ceiling height соседних Room.

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
footprint ItemInstance. Он видит длину Wall, внутренние размеры/площадь/
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

**Description:** Room выводится из топологии; Door и Window являются валидными Opening. Валидная межкомнатная Door формирует производный `AdjacencyGraph`. Реализует CAP-3 и CAP-4; поддерживает UJ-2.

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

При валидном локальном изменении границы система сохраняет `roomId`, название,
height и finishes Room, когда complete discovery даёт однозначное semantic
lineage.

**Consequences:**

- Алгоритм matching, включая split/merge/new root, документирован и покрыт
  forward/inverse fixtures.
- При неоднозначном split/merge пользователь сначала видит `ConflictPreview`,
  затем выбирает исход metadata. Confirm заново проверяет base Revision и
  writer fence, повторяет discovery/validation и лишь после этого публикует
  один complete result; cancel, stale base и fence loss не распределяют name,
  height или finishes молча и не создают mutation.

#### FR-16: Edit Room Parameters

Пользователь может задать Room name/type и ceiling height; геометрические размеры и площадь выводятся из PlanGraph.

**Consequences:**

- PRD не обещает независимые width/depth для непрямоугольной Room.
- Room height — единственный пользовательский источник потолка и влияет на
  производные wall/ceiling surfaces.

#### FR-17: Add Door

Пользователь может добавить Door на Wall, задав width, height, sill/threshold policy и offset.

**Consequences:**

- Door полностью лежит внутри допустимого интервала Wall и не пересекает другой Opening.
- Door находится на Wall, граничащей либо с ровно двумя derived Room, либо с
  Room и Exterior.
- Валидная межкомнатная Door на Wall, граничащей ровно с двумя derived Room,
  всегда создаёт один derived `Walk edge` в `AdjacencyGraph` для Walk Mode;
  это следствие topology/validity, а не отдельное редактируемое состояние
  Door.

#### FR-18: Add Window

Пользователь может добавить Window на Wall, задав width, height, sill height и offset.

**Consequences:**

- Window не создаёт `Walk edge` в `AdjacencyGraph` и не даёт transition.
- 2D и 3D используют одинаковые параметры Opening.

#### FR-19: Edit and Remove Opening

Пользователь может численно или touch-жестом переместить, изменить и удалить Opening.

**Consequences:**

- Если edit Wall меняет допустимость Opening, UI показывает
  `ConflictPreview/AwaitingUserOutcome` для resize, relocation или delete, а
  не меняет offset/host молча. После confirm он заново проверяет base Revision
  и writer fence, повторяет validation и публикует один complete result;
  cancel, stale base или fence loss не создают Command, Revision или History.

#### FR-20: Navigate Through Door

В 3D пользователь может активировать валидную межкомнатную Door и перейти в
связанную с ней соседнюю Room.

**Consequences:**

- В Alpha валидная межкомнатная Door на Wall, граничащей ровно с двумя derived
  Room, всегда создаёт один derived `Walk edge` в `AdjacencyGraph` и является
  проходимой; доступность перехода выводится из topology/validity, а не из
  отдельного состояния Door.
- Exterior Door, невалидная Door и Door без ровно двух derived Room не создают
  `Walk edge` и не дают transition.
- Access control, ключи, отдельные `passable`/`locked` или lock/unlock state,
  а также open/close interaction Door не являются alpha behavior.

### 5.4 Synchronized 2D and 3D

**Description:** 2D plan и 3D scene — представления одной доменной модели.
Реализует CAP-5 и CAP-11; поддерживает UJ-1–UJ-4.

#### FR-21: Switch View

Пользователь может переключаться между Plan View и 3D View без потери
selection, PendingDurability status или camera-independent domain data.

#### FR-22: Deterministic 3D Projection

Система процедурно строит стены, проёмы, полы и потолки из одного Project state.

**Consequences:**

- Reload одной версии Project создаёт семантически тот же 3D result.
- Renderer objects не сериализуются как источник истины.

#### FR-23: Inspect 3D

Пользователь может orbit/pan/zoom сцену и выбрать Room surface или ItemInstance.

**Consequences:**

- Gesture contract разделяет camera navigation и object transform.
- Выбор синхронизируется с доступной numeric/property surface.

#### FR-24: Walk Mode

Пользователь может войти в read-only first-person inspect mode, менять
направление взгляда, переходить в соседнюю Room через валидную межкомнатную
Door и выйти
обратно в edit mode.

**Consequences:**

- Alpha не обещает свободную физическую ходьбу или collision-controlled
  locomotion внутри Room.
- Camera имеет понятный reset и не сохраняется как domain geometry.
- Reduced-motion preference отключает необязательную анимацию перехода.

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
- Alpha catalog не обещает branded SKU или коммерческую доступность.

#### FR-27: Search and Filter

Пользователь может найти asset по названию/категории и отфильтровать по AnchorClass или основным габаритам.

#### FR-28: Place Item

Пользователь может разместить ItemInstance только на совместимой поверхности согласно AnchorClass.

**Consequences:**

- Floor item не размещается на Wall без явной совместимости asset.
- Preview отличает valid, warning and invalid placement.
- Wall/Ceiling item хранит host surface и локальные координаты; topology change
  не оставляет его в воздухе без rehost/delete/orphan preview. Перенос между
  anchor/root допустим только при compatible asset metadata и явном выборе;
  confirm повторно проверяет base Revision и writer fence, а cancel/stale/fence
  loss не создаёт Durable placement.
- Confirm сначала pin-ит exact referenced bytes и проверяет complete-backup
  envelope; без `offline-ready/backup-ready` AssetInstance не становится
  Durable.
- CatalogAsset без полного AssetUsageGrant для in-app render/thumbnails,
  model/subresources, optimization/transcoding, `.interiors`, private
  3D-resource transfer, rendered PNG download/share и placement notices не
  может быть размещён в Alpha, даже если доступен для preview.
- ImportedAsset в Alpha+ подтверждает исходный `assetUsageDeclaration` вместо
  Catalog `AssetUsageGrant`; оба proof route требуют exact pin и
  backup-feasibility до Durable reference. Reject, cancel, crash recovery или
  fence loss не оставляют частично опубликованное размещение.

#### FR-29: Transform Item

Пользователь может переместить, вращать и, если AssetDefinition разрешает, менять габариты ItemInstance.

**Consequences:**

- Numeric sheet даёт точный ввод position/dimensions/rotation.
- Fixed-size SKU не растягивается, если asset metadata это запрещает.

#### FR-30: Item Actions

Пользователь может duplicate, lock/unlock and delete ItemInstance.

**Consequences:**

- Locked item не меняется случайным gesture, но остаётся доступным для explicit unlock.
- Каждое действие участвует в undo/redo.

#### FR-31: Collision and Clearance Feedback

Система показывает пересечение footprint и заданных clearance zones с Wall, Opening или другими ItemInstance.

**Consequences:**

- Alpha выдаёт warning, а не утверждает соблюдение строительных норм.
- Warning не изменяет Project автоматически.

#### FR-32: Parametric Placeholder

Пользователь может создать простой box item с name, width, depth, height, color and AnchorClass.

**Consequences:**

- Placeholder участвует в collision, save, export и 3D.
- Он не маскируется под предмет каталога или коммерческий SKU.

### 5.6 Colors and Surface Finishes

**Description:** Пользователь проверяет сочетание материалов, не получая обещание фотореализма. Реализует CAP-7; поддерживает UJ-3.

#### FR-33: Apply Item Color or Variant

Пользователь может применить разрешённый color/material variant к отмеченным recolorable slots ItemInstance.

**Consequences:**

- Неразрешённые slots не перекрашиваются.
- Variant сохраняется как domain reference, а не renderer material object.

#### FR-34: Apply Floor Finish

Пользователь может применить один preset SurfaceFinish к floor surface выбранной Room.

**Consequences:**

- Floor finish имеет устойчивый адрес `Floor(RoomId)` и входит в тот же
  reconciliation inventory, что и ItemInstance.

#### FR-35: Apply Wall Finish

Пользователь может применить preset SurfaceFinish независимо к доступной стороне Wall.

**Consequences:**

- Общая Wall может иметь разные finishes со стороны двух Room.
- Сторона исчерпывающе адресуется
  `WallSide(WallSegmentId, adjacent Room|Exterior)` и сохраняет смысл при
  reverse/split; incompatible rehome/delete/orphan требует preview, явного
  выбора и revalidation, а не silent reassignment.

#### FR-36: Apply Ceiling Finish

Пользователь может применить preset SurfaceFinish к ceiling surface выбранной Room.

**Consequences:**

- Ceiling finish имеет устойчивый адрес `Ceiling(RoomId)` и входит в тот же
  reconciliation inventory, что и ItemInstance и floor/wall finishes.

#### FR-37: Finish Offline Availability

Exact referenced runtime bytes используемых finishes pin-ятся и входят в backup
envelope до Durable assignment. При повторном открытии renderer использует их
offline либо строит явно обозначенный deterministic low-fidelity projection, не
теряя referenced resource. Catalog finish проходит полный `AssetUsageGrant` и
обязательное размещение notice; custom finish в Alpha+ проходит свой исходный
`assetUsageDeclaration`. Для обоих route failed/cancelled/stale admission не
создаёт Durable assignment.

### 5.7 Safe Editing History

**Description:** Любое редактирование обратимо на уровне доменных команд. Реализует CAP-8; поддерживает все editing journeys.

#### FR-38: Undo and Redo

Пользователь может undo/redo каждый Durable Command в текущей session history
boundary.

**Consequences:**

- Undo восстанавливает валидный Project, включая derived rooms and adjacency.
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

После первого успешного открытия app shell и Project пользователь может в airplane mode открыть Project, изменить PlanGraph с локально доступными assets и сохранить его.

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
- Backup manifest включает resource provenance, license/attribution ledger и
  обязательные notices. Для CatalogAsset он содержит human-approved
  `AssetUsageGrant` полного заявленного scope; для ImportedAsset Alpha+ — его
  исходный `assetUsageDeclaration`. Эти proof route не взаимозаменяемы.
- Неполный semantic export не называется Portable Backup.
- Каждый non-corrupt Durable Project, созданный текущей limits policy,
  экспортируется без network; Project mutation не может превысить более
  строгий exportable envelope.

#### FR-45: Portable Backup Import

Пользователь может импортировать совместимый Portable Backup с validation, migration и atomic commit.

**Consequences:**

- Неудачная миграция не перезаписывает существующий Project.
- Успешный импорт всегда создаёт новый Project ID; existing Project не является
  target атомарной публикации.
- Unknown future schema получает понятное сообщение.
- Container/unpacked bytes, paths, entries, entity counts и checksums
  проверяются в staging по Project/Backup contract.

#### FR-46: PNG Snapshot

Пользователь может сохранить или вызвать системный share для PNG-снимка выбранного Plan/3D view.

**Consequences:**

- Catalog AssetUsageGrant явно разрешает создание и user-controlled
  distribution rendered output.
- Если notice обязан сопровождать отделённый output, export compositor
  включает читаемую атрибуцию в сам PNG; metadata-only notice недостаточен.
- Asset с forbidden/unknown rendered-output policy не входит в Alpha catalog.

#### FR-47: Coordinated App Update

Активный editor предлагает reload только после Durable Revision. Корректность
не зависит от удержания waiting worker: каждый startup проверяет совместимость
shell/worker/Project/catalog schema и выполняет recoverable migration.

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
- До Durable reference ImportedAsset имеет подтверждённый исходный
  `assetUsageDeclaration`, exact pin и complete-backup feasibility. Отказ,
  cancel, fence loss или crash recovery не делают staging resource частью
  Project, Revision, History или Portable Backup.

### 5.10 Режим «Фокус» на телефоне

**Description:** Режим «Фокус» даёт phone-first editor максимум доступного
app viewport без изменения доменной модели. Реализует CAP-5 и CAP-9; применим
к Plan View, 3D View и Walk Mode.

#### FR-53: Режим «Фокус» на телефоне

В Plan View, 3D View или Walk Mode пользователь по явному control может
войти в режим «Фокус» и выйти из него. Режим отдаёт editor максимум доступного
**app viewport**, скрывая некритичную in-app navigation и панели, чтобы они не
мешали проектированию.

**Consequences:**

- Вход и выход сохраняют активный Project, selection, текущие view/mode/tool,
  draft и семантику Active Gesture, а также pending/durable status. Они не
  создают domain Command, Durable Revision или history entry, не выполняют
  persisted Project mutation и не меняют writer lease/fencing state.
- В режиме «Фокус» остаются явно достижимыми: выход, текущий mode/tool,
  применимые undo/redo и cancel Active Gesture, а также
  `saving`/`saved`/`persist-failed`, offline, read-only и recovery status.
  Эти статусы и controls не полагаются только на цвет, имеют DOM-target не
  менее 44×44 CSS px и не перекрываются keyboard, safe area или canvas.
- Режим «Фокус» никогда не скрывает и не обходит recovery, confirmation,
  blocking error или modal action, необходимый для корректности; такой
  blocking state получает приоритет над компактной раскладкой.
- Native `Element.requestFullscreen()` является только progressive
  enhancement: его можно вызывать лишь из того же прямого user activation
  после capability probe. UI наблюдает `fullscreenchange` и
  `fullscreenerror`; rejection, отсутствие capability или выход из native
  fullscreen по решению user agent сохраняют доступную in-app Focus layout,
  а не возвращают скрытно обычные панели.
- В установленной PWA используется standalone context, если платформа его
  предоставляет, но тот же in-app Focus control и fallback обязательны. В
  browser context продукт не обещает убрать browser или system chrome.

### 5.11 Catalog Control Plane и provenance boundary

**Description:** Alpha может получать curated catalog metadata/resources через
ограниченный Catalog Control Plane, не меняя local-first владение Project.
Реализует CAP-6 и CAP-7; поддерживает UJ-3 и UJ-4.

#### FR-54: Ограниченная роль Catalog Control Plane

Система может использовать Catalog Control Plane только для публикации и
получения versioned catalog metadata/resources с provenance,
AssetUsageGrant и required notices. Он не является пользовательским
Project-сервисом.

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


## Source NFR extraction

- **NFR-1 — Canonical precision:** все persisted coordinates, dimensions and offsets — целые миллиметры; save/reopen и backup roundtrip дают 0 мм semantic drift.
- **NFR-2 — Projection boundary:** renderer использует metres только после явного conversion at adapter boundary; обратное преобразование не владеет domain state.
- **NFR-3 — Atomic validity:** failed command оставляет Project
  byte/semantically equivalent предыдущей Durable Revision; validated candidate
  не называется saved до persistence pointer swap. Transient selection/stale
  measurement, отменённый conflict choice и stale/fence-lost re-entry не могут
  стать Command, History или silent mutation.
- **NFR-4 — Determinism:** одинаковый versioned Project и catalog versions создают одинаковую topology, `AdjacencyGraph` и material assignments.

### Performance and resource use

- **NFR-5 — Gesture responsiveness:** в каждом физическом контексте `NFR-15` main-thread block во время gesture не превышает 50 ms; p95 frame time во время drag — не более 33,3 ms, а кадров длиннее 50 ms — не более 5% измерительной сессии.
- **NFR-6 — Reference scene:** provisional alpha benchmark — до 6 Room, 60 ItemInstance, 750k visible triangles, 250 draw calls и 128 MiB estimated GPU resources; точные limits подтверждаются spikes.
- **NFR-7 — Startup:** в protocol `NFR-15` first editable empty room открывается за ≤3 s при cold-online start и за ≤1,5 s при warm-offline start.
- **NFR-8 — Thermal stability:** 15-minute editing run по protocol `NFR-15` не приводит к crash, unexpected WebGL context loss, потере input, потере Durable Revision или неконтролируемому падению качества; отдельно проверенный forced context-loss path обязан восстановить тот же Project без reload. Adaptive tier может снижаться.
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
- **NFR-15 — Device acceptance matrix:** performance certification Alpha возможна только после PASS на всех восьми ниже названных **физических** contexts. Это утверждённая интерпретация «телефоны, выпущенные в 2021+ включительно»; desktop browser остаётся development surface и не является alpha UX acceptance surface.

  | Профиль | Физический телефон и зафиксированные vendor characteristics | OS/browser baseline | Два обязательных contexts |
  |---|---|---|---|
  | Floor iOS | iPhone 13 mini (2021), A15 Bionic, 4-core GPU; Apple не публикует RAM, поэтому значение намеренно не указывается | iOS 26.5.x; фактический iOS/Safari/WebKit patch обязателен в trace | Safari tab; установленная Home Screen PWA в standalone mode |
  | Current iOS | iPhone 17 (2025), A19, 5-core GPU; RAM намеренно не указывается по той же причине | iOS 26.5.x; фактический iOS/Safari/WebKit patch обязателен в trace | Safari tab; установленная Home Screen PWA в standalone mode |
  | Floor Android | Galaxy A53 5G `SM-A536B/DS`, 128 GB / 6 GB RAM, Exynos 1280 | Android 16 / One UI 8; Chrome Android 150.0.7871.114 baseline, фактический browser/OS patch обязателен в trace | Chrome Android tab; установленная standalone PWA |
  | Current Android | Galaxy S26 `SM-S942B/DS`, 256 GB / 12 GB RAM | Android 16 / One UI 8.5; Chrome Android 150.0.7871.114 baseline, фактический browser/OS patch обязателен в trace | Chrome Android tab; установленная standalone PWA |

  Safari tab и iOS Home Screen PWA считаются разными evidence contexts: Apple документирует у Home Screen web apps отдельные cookies и storage. Для iPhone в matrix фиксируется именно модель и наблюдаемый OS/WebKit build, а не неофициальная оценка памяти.

  **Обязательный real-device protocol.** Для каждого из восьми contexts команда использует production-like build и сохраняет trace с `commit`/build, schema и version RS-1/RS-2, model/SKU или инвентарным ID, фактическими OS/browser builds, результатом WebGL2 probe, PWA context, battery level/saver state, thermal state и network profile.

  1. Выполняются 20 независимых cold-online starts и 20 независимых warm-offline starts; cold и warm caches/storage не смешиваются. Online phase использует одинаковый settled Wi-Fi profile, offline phase — явно отключённую сеть после успешного initial online load.
  2. Выполняются не менее пяти scripted RS-2 interaction sessions с сохранением main-thread, frame-time и long-frame distribution.
  3. Выполняется отдельный 15-minute thermal run. Перед всеми измерениями телефон держится на 60–80% battery, Battery Saver/Low Power Mode выключен, зарядка отключена, устройство достигло стабильного thermal state; Wi-Fi profile одинаков для сопоставимых online runs.
  4. Release PASS на context требует WebGL2 probe, cold-online ≤3 s, warm-offline ≤1,5 s, main-thread ≤50 ms, p95 drag frame time ≤33,3 ms, ≤5% frames >50 ms, а также отсутствия crash, unexpected WebGL context loss, потери input или потери Durable Revision. Отдельно проверенный forced context-loss path должен восстановить тот же Project без reload; failure этого recovery check — FAIL.
  5. PASS всего release существует только при PASS каждого из восьми contexts. Emulator, desktop result и 2D-only fallback не заменяют PASS ни одного context. После **каждого** изменения обязателен green Playwright regression для browser/mobile/PWA/offline flows, включая applicable focus flows `NFR-27`, однако Playwright не заменяет физические Safari/Home Screen, Android PWA, thermal или frame-time traces.

  **Обязательные manual evidence rows для режима «Фокус».** В дополнение к
  performance trace для каждого из восьми contexts заполняется одна физическая
  строка. Она фиксирует фактический fullscreen capability probe и результат
  прямого пользовательского запроса (`success`, `rejected`, `unsupported`), а
  при `success` — наблюдаемый `fullscreenchange` после user-agent exit. Это
  наблюдаемое evidence, а не заявка на совместимость. Во всех строках вручную
  проверяются: вход/явный выход; сохранение Project, selection, view/mode,
  Active Gesture и durable/pending status; usable layout при visual viewport,
  safe areas и keyboard; видимые ≥44×44 CSS px critical controls; и
  discoverable non-color-only offline/read-only/recovery/persist-failed state.

  | Физический телефон | Context | Native fullscreen evidence | In-app Focus evidence |
  |---|---|---|---|
  | iPhone 13 mini | Safari tab | Обязательный фактический probe/result | Обязательная manual проверка полного набора выше |
  | iPhone 13 mini | Home Screen PWA | Обязательный фактический probe/result | Обязательная manual проверка полного набора выше |
  | iPhone 17 | Safari tab | Обязательный фактический probe/result | Обязательная manual проверка полного набора выше |
  | iPhone 17 | Home Screen PWA | Обязательный фактический probe/result | Обязательная manual проверка полного набора выше |
  | Galaxy A53 5G `SM-A536B/DS` | Chrome Android tab | Обязательный фактический probe/result | Обязательная manual проверка полного набора выше |
  | Galaxy A53 5G `SM-A536B/DS` | установленная standalone PWA | Обязательный фактический probe/result | Обязательная manual проверка полного набора выше |
  | Galaxy S26 `SM-S942B/DS` | Chrome Android tab | Обязательный фактический probe/result | Обязательная manual проверка полного набора выше |
  | Galaxy S26 `SM-S942B/DS` | установленная standalone PWA | Обязательный фактический probe/result | Обязательная manual проверка полного набора выше |

  Устройство вне matrix получает capability-based fallback согласно `NFR-16`, но не получает performance certification. Samsung Internet проходит только functional smoke и не является самостоятельным performance gate. Любой новый OS/browser patch или назначение другой физической модели в Current iOS/Android profile требует renewed device trace по этому protocol до новой release claim; изменение самой matrix проходит отдельный `bmad-prd` update.

  **Source trace.** Профили сверены с первичными vendor sources: [iPhone 13 mini](https://support.apple.com/en-lamr/111873), [iPhone 17](https://support.apple.com/en-us/125089), [Apple iOS](https://www.apple.com/uk/os/ios/) и [Apple iOS 26 updates](https://support.apple.com/en-us/123075); [Apple WWDC23: Home Screen storage](https://developer.apple.com/videos/play/wwdc2023/10120/?time=253); [Galaxy A53 SKU](https://www.samsung.com/ro/support/model/SM-A536BZKNEUE/), [Galaxy A53 specifications](https://news.samsung.com/us/new-galaxy-a53-5g-awesome-technology), [Galaxy A53 Exynos 1280](https://news.samsung.com/in/samsung-launches-galaxy-a53-5g-with-64mp-ois-camera-and-5nm-processor-announces-exciting-pre-book-offers), [One UI 8 / Android 16](https://www.samsung.com/co/support/one-ui-8-android-16/), [Galaxy S26 SKU record](https://images.samsung.com/is/content/samsung/p6/common/energylabel/s2602/common-energylabel-sm-s942blbgeue-productfiche.pdf), [Galaxy S26 specifications](https://news.samsung.com/us/samsung-unveils-galaxy-s26-series-most-intuitive-galaxy-ai-phone-yet), [Chrome for Android 150.0.7871.114](https://chromereleases.googleblog.com/2026/07/chrome-for-android-update.html). Exact regional firmware and browser patch remain measured evidence, not inferred support promises.
- **NFR-16 — Capability detection:** renderer, storage and installability определяются по capabilities, а не только user-agent.

### Accessibility and interaction

- **NFR-17 — Touch floor:** интерактивные DOM-targets не меньше 44×44 CSS px, учитывают safe areas и не зависят от hover.
- **NFR-18 — Accessible controls:** DOM controls, forms, dialogs and navigation соответствуют WCAG 2.2 AA; validation связана с полем и озвучивается assistive tech.
- **NFR-19 — Numeric alternative:** критическое действие 3D/touch имеет доступную numeric/list alternative там, где canvas сам по себе недоступен.
- **NFR-20 — Motion:** reduced-motion preference убирает необязательную camera/transition animation.

### Security and privacy

- **NFR-21 — Local privacy:** без явного consent Project geometry, screenshots
  and ImportedAssets не отправляются во внешнюю систему. Catalog Control Plane
  не создаёт пользовательскую account identity и не принимает, не хранит, не
  синхронизирует и не восстанавливает Project, Revision, session History или
  Portable Backup.
- **NFR-22 — Import isolation (Alpha+):** untrusted GLB проходит byte-level
  deny-network preflight, allowlist и staged resource limits; metadata не
  интерпретируется как HTML; Worker не считается hard memory sandbox.
- **NFR-23 — Telemetry minimization:** analytics, если включены, не содержат plan geometry, asset binary, file names or screenshots; opt-out определён до public alpha.

### Maintainability and observability

- **NFR-24 — Stable contracts:** `CAP-*`, `FR-*`, `NFR-*`, `AD-*` не переиспользуются; breaking schema change повышает version.
- **NFR-25 — Diagnostics:** alpha feedback содержит app/schema/catalog versions, capability tier and non-sensitive error code, но не пользовательский проект.
- **NFR-26 — Testability:** domain/topology тестируются без DOM/GPU; renderer и
  persistence доступны через ports/adapters. Versioned corpus покрывает
  одинаковый selected candidate для canvas/DOM alternative, transform failure,
  T/X, Room holes/lineage, paired measurement, conflict re-entry, host/finish
  reconciliation, resource admission/recovery и forward/inverse outcomes;
  соответствующие E2E journeys доказывают пользовательский результат.

### Режим «Фокус» и устойчивый viewport

- **NFR-27 — Capability-first Focus viewport:** режим «Фокус» рассчитывает
  usable app viewport capability-first и устойчиво переживает изменение
  `visualViewport`, keyboard и orientation. Важный UI использует fallback и
  padding для `env(safe-area-inset-*)`; выход, critical tool/mode, undo/redo,
  cancel и truthful durable/error/recovery status остаются видимыми,
  достижимыми и не полагаются только на цвет. Native fullscreen запрашивается
  безопасно только из прямого user gesture после probe; `fullscreenchange`,
  `fullscreenerror`, rejection и произвольный user-agent exit не оставляют UI
  в ложном native state и не отключают in-app Focus layout. Standalone PWA
  используется, когда её предоставляет платформа, но не отменяет fallback и
  не служит обещанием убрать browser/system chrome.

  Обязательны Playwright mobile-browser E2E: supported-native success
  simulation из user action; native rejection и unsupported fallback;
  entry/explicit exit и user-agent `fullscreenchange` exit; сохранение state;
  responsive layout при safe-area/keyboard/visual-viewport изменениях; и
  наличие критичных status/exit controls. Если runner не может вызвать
  native API, test harness обязан контролируемо симулировать success/error
  paths, не выдавая simulation за device support. После каждого изменения
  эти E2E остаются green; они не заменяют восемь manual physical rows
  `NFR-15`.

  **Ограниченный source trace.** [WHATWG Fullscreen API
  Standard](https://fullscreen.spec.whatwg.org/) определяет
  `requestFullscreen()`, transient user activation, `fullscreenchange` /
  `fullscreenerror` и право user agent завершить session. [Apple Configuring
  Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
  документирует Home Screen standalone context и его отличия от Safari chrome.
  [WebKit: Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
  документирует `viewport-fit=cover`, `env(safe-area-inset-*)` и необходимость
  fallback. Эти источники не являются заявлением о конкретной совместимости
  какого-либо context из `NFR-15`; её подтверждают только physical traces.

### Applicability by release contour

| Requirement | Alpha entry | Alpha+ |
|---|---|---|
| `NFR-1`–`NFR-21` | applicable | applicable |
| `NFR-22` | `N/A by scope`: custom GLB отсутствует | applicable и blocking CAP-12 |
| `NFR-23`–`NFR-27` | applicable | applicable |

`N/A` является явным scope result, а не выполненным требованием. Если CAP-12
повышается в Alpha entry, NFR-22 автоматически становится blocking.


**Total FRs:** 54. `FR-48`–`FR-52` are explicitly Alpha+; Alpha entry requires
`FR-1`–`FR-47`, `FR-53`, and `FR-54`.

### Non-Functional Requirements

The complete NFR source extraction is included above with the FR extraction.

**Total NFRs:** 27. `NFR-22` is Alpha+ and N/A for Alpha entry; all other NFRs
are applicable to Alpha entry.

### Additional Requirements

- Alpha is one Level, phone-first, local-first, and must remain useful offline.
- Exact resources must be pinned and backup-feasible before a reference becomes
  Durable; browser cache is insufficient.
- The release gate requires PASS on eight physical mobile/PWA contexts under
  `NFR-15`; emulator and desktop evidence cannot substitute for it.
- Pre-public-alpha questions remain for UI language/geography, analytics,
  desktop behavior, Alpha+ GLB scope, import limits, sharing, and monetization.

### PRD Completeness Assessment

The PRD is internally structured, assigns 54 functional and 27 non-functional
requirements, and clearly distinguishes Alpha entry from Alpha+. It contains
explicit acceptance constraints, including physical-device evidence. Its
coverage against UX, architecture, SPEC and epics is assessed in later steps.

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD requirement | Epic coverage | Status |
| --- | --- | --- | --- |
| FR-1 | Create Project | Epic 1 | ✓ Covered |
| FR-2 | List, Open and Rename | Epic 1 | ✓ Covered |
| FR-3 | Duplicate Variant | Epic 8 | ✓ Covered |
| FR-4 | Delete With Recovery Boundary | Epic 8 | ✓ Covered |
| FR-5 | Autosave and Recovery | Epic 1 | ✓ Covered |
| FR-6 | Rectangular Room Starter | Epic 2 | ✓ Covered |
| FR-7 | Draw Constrained Wall | Epic 2 | ✓ Covered |
| FR-8 | Exact Numeric Wall Input | Epic 2 | ✓ Covered |
| FR-9 | Move and Split Topology | Epic 2 | ✓ Covered |
| FR-10 | Edit Wall Properties | Epic 2 | ✓ Covered |
| FR-11 | Remove Geometry | Epic 2 | ✓ Covered |
| FR-12 | Geometry Validation | Epic 2 | ✓ Covered |
| FR-13 | Measurements | Epic 2 | ✓ Covered |
| FR-14 | Derive Closed Rooms | Epic 3 | ✓ Covered |
| FR-15 | Preserve Room Identity | Epic 3 | ✓ Covered |
| FR-16 | Edit Room Parameters | Epic 3 | ✓ Covered |
| FR-17 | Add Door | Epic 3 | ✓ Covered |
| FR-18 | Add Window | Epic 3 | ✓ Covered |
| FR-19 | Edit and Remove Opening | Epic 3 | ✓ Covered |
| FR-20 | Navigate Through Door | Epic 4 | ✓ Covered |
| FR-21 | Switch View | Epic 4 | ✓ Covered |
| FR-22 | Deterministic 3D Projection | Epic 4 | ✓ Covered |
| FR-23 | Inspect 3D | Epic 4 | ✓ Covered |
| FR-24 | Walk Mode | Epic 4 | ✓ Covered |
| FR-25 | Adaptive Quality | Epic 4 | ✓ Covered |
| FR-26 | Browse Catalog Categories | Epic 5 | ✓ Covered |
| FR-27 | Search and Filter | Epic 5 | ✓ Covered |
| FR-28 | Place Item | Epic 5 | ✓ Covered |
| FR-29 | Transform Item | Epic 5 | ✓ Covered |
| FR-30 | Item Actions | Epic 5 | ✓ Covered |
| FR-31 | Collision and Clearance Feedback | Epic 5 | ✓ Covered |
| FR-32 | Parametric Placeholder | Epic 5 | ✓ Covered |
| FR-33 | Apply Item Color or Variant | Epic 6 | ✓ Covered |
| FR-34 | Apply Floor Finish | Epic 6 | ✓ Covered |
| FR-35 | Apply Wall Finish | Epic 6 | ✓ Covered |
| FR-36 | Apply Ceiling Finish | Epic 6 | ✓ Covered |
| FR-37 | Finish Offline Availability | Epic 6 | ✓ Covered |
| FR-38 | Undo and Redo | Epic 1 + Epic 7 | ✓ Covered |
| FR-39 | Cancel Active Gesture | Epic 1 + Epic 7 | ✓ Covered |
| FR-40 | Explain Invalid Operation | Epic 1 + Epic 7 | ✓ Covered |
| FR-41 | Installable PWA | Epic 8 | ✓ Covered |
| FR-42 | Offline Reopen and Edit | Epic 8 | ✓ Covered |
| FR-43 | Storage Health | Epic 8 | ✓ Covered |
| FR-44 | Portable Backup Export | Epic 8 | ✓ Covered |
| FR-45 | Portable Backup Import | Epic 8 | ✓ Covered |
| FR-46 | PNG Snapshot | Epic 8 | ✓ Covered |
| FR-47 | Coordinated App Update | Epic 8 | ✓ Covered |
| FR-48 | Select Static GLB | Epic 9 (Alpha+) | ✓ Covered |
| FR-49 | Preflight Resource Policy | Epic 9 (Alpha+) | ✓ Covered |
| FR-50 | Preview and Classify | Epic 9 (Alpha+) | ✓ Covered |
| FR-51 | Reject Unsafe or Unsupported Asset | Epic 9 (Alpha+) | ✓ Covered |
| FR-52 | Persist Imported Asset | Epic 9 (Alpha+) | ✓ Covered |
| FR-53 | Режим «Фокус» на телефоне | Epic 4 + Epic 8 | ✓ Covered |
| FR-54 | Ограниченная роль Catalog Control Plane | Epic 5 + Epic 8 | ✓ Covered |

### Missing Requirements

No uncovered PRD FR was found. The approved epic coverage map explicitly
assigns all 54 stable FRs. Alpha+ FR-48–FR-52 are intentionally owned by
Epic 9 and do not block Alpha entry.

### Coverage Statistics

- Total PRD FRs: 54
- FRs covered in epics: 54
- Coverage percentage: 100%

The coverage map also assigns cross-epic completion evidence to FR-38–FR-40,
FR-53, and FR-54; this does not remove the named primary owner.

## UX Alignment Assessment

### UX Document Status

Found: `DESIGN.md` (component and responsive-layout specification) and
`EXPERIENCE.md` (journeys, state contracts and acceptance paths).

### Alignment Issues

No source-level contradiction was found in the sampled trace maps. The UX
documents explicitly cover plan/numeric input, durability and recovery states,
2D/3D/Walk, catalog and offline paths, Focus, accessible alternatives and the
physical-device evidence boundary. Architecture decisions AD-1–AD-17 provide
the matching geometry, command, local-first, rendering, testing, Focus,
bootstrap and catalog boundaries.

### Warnings

The UX specification correctly records that browser emulation and screenshots
do not close the eight physical-device rows required by NFR-15. Current sprint
status shows many stories as `in-progress`, `review`, `backlog`, or blocked by
resource and independent-review gates; no UX document can substitute for those
acceptance obligations.

## Epic Quality Review

### Findings

- **No critical structural violation found.** Epics 1–8 describe user outcomes;
  Epic 9 is explicitly isolated as Alpha+.
- **No accidental forward dependency found.** The delivery sequence names
  prerequisite gates and slices; these are deliberate readiness constraints,
  not hidden story dependencies.
- **Greenfield bootstrap is explicit and bounded.** Story 1.1 contains the
  required initial setup as part of delivering a durable local Project, rather
  than presenting infrastructure as an independent product epic.
- **Traceability and testability are strong.** Every story declares requirement
  traces and the inherited E2E/domain/physical-evidence obligations.

### Major readiness concern

The roadmap is structurally ready, but it is not execution-complete: current
statuses include `backlog`, `in-progress`, and `review`; the final acceptance,
independent-review, resource/provenance and physical-device gates are still
open. This is an execution-evidence gap, not an epics-writing defect.

## Summary and Recommendations

### Overall Readiness Status

**NOT READY for Alpha release or a formal production gate.** The latest
official complete verdict remains `NOT_READY` (2026-08-06), and the current
sprint status does not supply the missing final acceptance evidence. The
existing owner-authorized implementation waiver permits the current worktree's
development but does not convert it into a `READY` verdict or release claim.

### Critical Issues Requiring Immediate Action

1. Complete the in-progress and backlog Alpha-entry stories, including their
   named acceptance criteria and required domain/browser evidence.
2. Obtain independent reviews for review-bound stories and evidence packages;
   owner testing is not independent acceptance.
3. Collect the eight physical NFR-15 mobile/PWA traces, including the required
   Focus rows, cold/warm startup, interaction, context-recovery and thermal
   evidence.
4. Close resource/provenance and portability obligations: complete backup
   envelope, exact pin/repair/history semantics, human AssetUsageGrant ledger
   and required notices. Keep control-plane work blocked until `G-CP-ADR` is
   adopted.
5. Re-run this readiness workflow only after those artefacts are evidenced, to
   obtain a fresh formal verdict.

### Recommended Next Steps

1. Use the temporary phone URL to run a focused owner walkthrough and log
   findings against the current in-progress stories; do not treat it as
   physical matrix certification.
2. Take the next lowest unblocked vertical slice through its test and
   independent-review obligations; retain one implementation owner per slice.
3. Arrange access to the named iOS and Android contexts, and collect the
   release evidence using the NFR-15 protocol.
4. Configure a named, authenticated Cloudflare Tunnel with a stable hostname
   if continuous external phone access is required beyond this task.

### Final Note

This assessment found five execution-evidence categories preventing formal
readiness. Requirement coverage and roadmap structure are complete; product
implementation is under a documented owner waiver, but release readiness and
several story acceptances remain open.

**Assessor:** Codex, 2026-08-22
