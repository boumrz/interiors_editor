---
stepsCompleted: [step-01-document-discovery, step-02-prd-analysis, step-03-epic-coverage-validation, step-04-ux-alignment, step-05-epic-quality-review, step-06-final-assessment]
status: complete
---

# Implementation Readiness Assessment Report

**Date:** 2026-11-04
**Project:** InteriorsEditor

## Document Discovery

Подтверждено координатором 2026-11-04: канонические источники заданы владельцем; исторические drafts и reviews сохранены как provenance, удаление не требуется.

- PRD: `prds/prd-InteriorsEditor-2026-07-26/prd.md`, `addendum.md`.
- UX: `ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md` и `EXPERIENCE.md` — единая пара.
- Architecture: `architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md`.
- Epics: `epics.md`; также `roadmap-to-alpha.md` и `traceability-matrix.md`.
- SPEC: `../specs/spec-interiors-editor-alpha/SPEC.md` и все companions из frontmatter.
- `_bmad-output/project-context.md`, Telegram extension specification, S0 preflight и пять owner workflow result-файлов; REL/FUP и November progress как evidence с границами применимости.
- Root-shaped `sprint-change-proposal-2026-08-16-import-ux-remediation.md` и исторические architecture drafts/reviews не являются заменой выбранных источников. Отсутствующих обязательных типов не обнаружено.

## PRD Analysis

Ниже полная дословная выгрузка разделов требований канонического PRD (включая consequences и applicability), чтобы не потерять смысл при сравнении с epics. FR-20, FR-24 и FR-53 перечислены в таблице как retired; их отдельные headings отсутствуют. FR-48–52 — Alpha+, NFR-22 — N/A в Alpha entry.

### Functional Requirements — текст PRD

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

Пользователь может задать Room name/type и height; геометрические размеры и площадь выводятся из PlanGraph.

**Consequences:**

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
- Он не маскируется под предмет каталога или коммерческий SKU.

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
- Успешный импорт всегда создаёт новый Project ID; existing Project не является
  target атомарной публикации.
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

### 5.11 Telegram Mini App — дополнительная поверхность

#### FR-55: Общий редактор и жизненный цикл Telegram

Telegram предоставляет принятый Alpha entry путь: проекты, план, комнаты и
проёмы, измерения, каталог и floor/wall placement, 2D/3D, undo/redo, Durable
save, recovery и перенос. Одинаковая подтверждённая команда над одинаковым
Project даёт эквивалентный доменный результат во всех поверхностях; host controls
могут различаться. Актуальные UX-контракты 1 ноября сохраняются; Alpha+ и
retired возможности не повышаются в scope.

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
import создаёт новый Project ID и сохраняет исходник, семантику геометрии без
миллиметрового drift, привязки и exact resource hashes; session history не
переносится. Отмена и ошибка не оставляют опасных staging roots.

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


### Non-Functional Requirements — текст PRD

## 6. Cross-Cutting Non-Functional Requirements

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

### Maintainability and observability

- **NFR-24 — Stable contracts:** `CAP-*`, `FR-*`, `NFR-*`, `AD-*` не переиспользуются; breaking schema change повышает version.
- **NFR-25 — Diagnostics:** alpha feedback содержит app/schema/catalog versions, capability tier and non-sensitive error code, но не пользовательский проект.
- **NFR-26 — Testability:** domain/topology тестируются без DOM/GPU; renderer и
  persistence доступны через ports/adapters. Versioned corpus покрывает
  одинаковый selected candidate для canvas/DOM alternative, transform failure,
  T/X, Room holes/lineage, paired measurement, conflict re-entry, item-host
  reconciliation, resource admission/recovery и forward/inverse outcomes;
  соответствующие E2E journeys доказывают пользовательский результат.

### Applicability by release contour

| Requirement | Alpha entry | Alpha+ |
|---|---|---|
| `NFR-1`–`NFR-21` | applicable | applicable |
| `NFR-22` | `N/A by scope`: custom GLB отсутствует | applicable и blocking CAP-12 |
| `NFR-23`–`NFR-26` | applicable | applicable |
| `NFR-28` | applicable для Telegram extension | applicable для Telegram extension |

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

Retired FR-3, FR-20, FR-24, FR-34–37, FR-46, FR-53 и NFR-27 не
восстанавливаются. Существующие общие NFR действуют по назначению; NFR-15 и
NFR-28 имеют отдельные доказательства. CAP-9 и FR-41 остаются активными.


### Additional Requirements и первоначальная оценка

Addendum подтверждает отдельные origins/outputs, no-worker manifest guard, local-only handoff, scope barrier, сохранение старых URLs и отложенный source-owner reconciliation V1/PPJ-A1. Ноябрьский UX-контракт, прежние active и retired IDs сохраняются; physical NFR-28 и реальный bot/origin остаются pending. Содержательность PRD позволяет проверку coverage, но открытый конфликт AssetUsageGrant между AGENTS и PRD/SPEC/AD-14 не является принятым policy решением. Условный альтернативный transfer требует решения owner лишь если физический local handoff окажется невозможен. Сформулированные цели и delegation владельца подтверждают направление и выбранный scope; это не physical acceptance или waiver.

## Epic Coverage Validation

### Coverage Matrix

Тексты FR целиком приведены выше. Сопоставление отражает заявленных владельцев в исторической карте и дополнении Epic 10, а не выполненную реализацию.

| FR | Требование (заголовок PRD) | Owner Epic / статус |
|---|---|---|
| FR-1 | Create Project | Epic 1 — локальный Project с initial valid state.; сохранение/applicability в Epic 10 |
| FR-2 | List, Open and Rename | Epic 1 — список, открытие и переименование локального Project.; сохранение/applicability в Epic 10 |
| FR-4 | Confirmed Permanent Project Deletion | Epic 8 — explicit confirmed permanent Project deletion после V-12.; сохранение/applicability в Epic 10 |
| FR-5 | Autosave and Recovery | Epic 1 — Durable autosave и recovery последней Revision.; сохранение/applicability в Epic 10 |
| FR-6 | Rectangular Room Starter | Epic 2 — прямоугольная Room по внутренним размерам в мм.; сохранение/applicability в Epic 10 |
| FR-7 | Draw Constrained Wall | Epic 2 — constrained drawing Wall.; сохранение/applicability в Epic 10 |
| FR-8 | Gesture-first constrained Wall authoring | Epic 2 — gesture-first constrained Wall authoring without global coordinate input.; сохранение/applicability в Epic 10 |
| FR-9 | Move and Split Topology | Epic 2 — move/split topology.; сохранение/applicability в Epic 10 |
| FR-10 | Edit Wall Properties | Epic 2 — Wall thickness и derived height.; сохранение/applicability в Epic 10 |
| FR-11 | Remove Geometry | Epic 2 — валидное удаление geometry.; сохранение/applicability в Epic 10 |
| FR-12 | Geometry Validation | Epic 2 — geometry validation и explainable rejection.; сохранение/applicability в Epic 10 |
| FR-13 | Measurements | Epic 2 — exact measurements canonical plan targets; Epic 5/V-10 — тот же measurement contract для границ AssetInstance footprint.; сохранение/applicability в Epic 10 |
| FR-14 | Derive Closed Rooms | Epic 3 — derive closed Room.; сохранение/applicability в Epic 10 |
| FR-15 | Preserve Room Identity | Epic 3 — preserve Room identity.; сохранение/applicability в Epic 10 |
| FR-16 | Edit Room Parameters | Epic 3 — Room name/type/height parameters.; сохранение/applicability в Epic 10 |
| FR-17 | Add Door | Epic 3 — add Door.; сохранение/applicability в Epic 10 |
| FR-18 | Add Window | Epic 3 — add Window.; сохранение/applicability в Epic 10 |
| FR-19 | Edit and Remove Opening | Epic 3 — edit/remove Opening после Wall change.; сохранение/applicability в Epic 10 |
| FR-21 | Switch View | Epic 4 — switch Plan and 3D views.; сохранение/applicability в Epic 10 |
| FR-22 | Deterministic 3D Projection | Epic 4 — deterministic 3D projection.; сохранение/applicability в Epic 10 |
| FR-23 | Inspect 3D | Epic 4/V-03 — inspect/camera без выбора Room surface; Epic 5/V-10 — выбор размещённого AssetInstance через accessible selection contract.; сохранение/applicability в Epic 10 |
| FR-25 | Adaptive Quality | Epic 4 — adaptive rendering quality.; сохранение/applicability в Epic 10 |
| FR-26 | Browse Catalog Categories | Epic 5 — browse catalog categories and states.; сохранение/applicability в Epic 10 |
| FR-27 | Search and Filter | Epic 5 — search and filter catalog.; сохранение/applicability в Epic 10 |
| FR-28 | Place Item | Epic 5 — anchored, backup-ready Item placement.; сохранение/applicability в Epic 10 |
| FR-29 | Transform Item | Epic 5 — transform Item with numeric precision.; сохранение/applicability в Epic 10 |
| FR-30 | Item Actions | Epic 5 — duplicate, lock, unlock and delete Item.; сохранение/applicability в Epic 10 |
| FR-31 | Collision and Clearance Feedback | Epic 5 — collision and clearance feedback.; сохранение/applicability в Epic 10 |
| FR-32 | Parametric Placeholder | Epic 5 — Parametric Placeholder.; сохранение/applicability в Epic 10 |
| FR-33 | Apply Item Color or Variant | Epic 6 — allowed Item color/material variant.; сохранение/applicability в Epic 10 |
| FR-38 | Undo and Redo | Epic 1/V-01 — обязательный durable-command/history substrate; Epic 7 — resource-sensitive retention/recovery hardening.; сохранение/applicability в Epic 10 |
| FR-39 | Cancel Active Gesture | Epic 1/V-01 — базовая отмена DraftCommand; Epic 7 — cross-journey cancel regression coverage.; сохранение/applicability в Epic 10 |
| FR-40 | Explain Invalid Operation | Epic 1/V-01 — stable reject/reason substrate; Epic 7 — cross-journey explainability regression coverage.; сохранение/applicability в Epic 10 |
| FR-41 | Installable PWA | Epic 8 — installable PWA and iOS local-context handoff.; сохранение/applicability в Epic 10 |
| FR-42 | Offline Reopen and Edit | Epic 8 — offline reopen and edit.; сохранение/applicability в Epic 10 |
| FR-43 | Storage Health | Epic 8 — storage health and quota safety.; сохранение/applicability в Epic 10 |
| FR-44 | Portable Backup Export | Epic 8 — Portable Backup export.; сохранение/applicability в Epic 10 |
| FR-45 | Portable Backup Import | Epic 8 — staged Portable Backup import.; сохранение/applicability в Epic 10 |
| FR-47 | Coordinated App Update | Epic 8 — coordinated app update.; сохранение/applicability в Epic 10 |
| FR-48 | Select Static GLB | Epic 9 — select static GLB (Alpha+). |
| FR-49 | Preflight Resource Policy | Epic 9 — GLB preflight resource policy (Alpha+). |
| FR-50 | Preview and Classify | Epic 9 — GLB preview and classification (Alpha+). |
| FR-51 | Reject Unsafe or Unsupported Asset | Epic 9 — reject unsafe/unsupported GLB (Alpha+). |
| FR-52 | Persist Imported Asset | Epic 9 — persist imported asset by hash (Alpha+). |
| FR-54 | Ограниченная роль Catalog Control Plane | Epic 5 — versioned catalog metadata/resources/hash perimeter и доступный browse/ retry/cancel flow без remote Project ownership; Epic 8 подтверждает, что fully pinned local Project продолжает offline работу при недоступном сервисе.; сохранение/applicability в Epic 10 |
| FR-55 | Общий редактор и жизненный цикл Telegram | Epic 10, Telegram S0 coverage map |
| FR-56 | Локальная область аккаунта Telegram | Epic 10, Telegram S0 coverage map |
| FR-57 | Проверяемый перенос между поверхностями | Epic 10, Telegram S0 coverage map |
| FR-58 | Сосуществование и совместимость выпусков | Epic 10, Telegram S0 coverage map |

### Missing Requirements и статистика

49/49 действующих FR имеют заявленного Epic owner: 44 Alpha entry с Telegram, 5 Alpha+ — Epic 9. Девять retired ID не восстановлены в карте. FR без owner по заявленной карте: нет. Это трассировка планирования, не доказательство acceptance или отсутствия противоречий.

**Source hygiene:** исторический исходный inventory ошибочно описывает FR-3 как active duplicate и содержит устаревшие формулировки (например, FR-17 и ранняя FR-7); актуальная карта маркирует FR-3/20/24/34–37/46/53 retired, а reconciliation явно отдаёт приоритет PRD/SPEC/Spine и добавление S0 сохраняет их. Контекст нельзя читать как повторное включение retired scope. Владелец epics должен устранить двусмысленность при следующем разрешённом source workflow, не меняя историю/IDs. Конфликт policy grants выходит за рамки формального наличия FR owner.

## UX Alignment Assessment

### UX Document Status

Найдены DESIGN.md + EXPERIENCE.md как единая действующая пара; UXF-8 реализует UJ-7, UXF-7 retired. Поддержка сохранения существующих REL-01–18/FUP-01–09 и новые host states прослеживаются в UX и Epic 10; новые visual/physical proof не представлены.

### Alignment Issues

- PRD FR-16 обещает редактирование Room name, а REL-05 и EXPERIENCE.md исключают поле и сохраняют историческое name; FR-9 обещает split Wall, а REL-08 исключает жестовый split. Последнее может быть ограничением способа, но доступный путь исполнения FR-9 требует проверки. Ноябрьские контракты и UX не владеют FR: владельцу PRD и UX нужна явная reconciliation применимости, а не молчаливое переписывание FR или регрессия REL. Это унаследованная межисточниковая неоднозначность для затронутой пользовательской parity, а не доказанный blocker извлечения browser host boundary без UI изменений.
- UX-пара и PRD согласуют наиболее защитный Back/Close, сохранение draft, pending/failure/recovery, viewport, 360 px/200% и независимое physical evidence; AD-25–29 описывают необходимые seams, контроль lifecycle, scopes и fail-closed delivery. Readiness использования на реальных клиентах ещё не доказана.

### Warnings

UXF-8 и TMA-07 — specification, не физический Telegram acceptance. Исторические mocks и NFR-15 нельзя приравнять к NFR-28. AD-26 явно не гарантирует обнаружение незаметной смены аккаунта в живом runtime; отсутствующее physical isolation evidence блокирует writable release соответствующего клиента. Внешний handoff — только реальный файл и повторный import; альтернативу при невозможности выбирает owner отдельно.

## Epic Quality Review

### Epic и зависимости

Epic 1–9 построены вокруг пользовательских результатов, Epic 9 остаётся Alpha+. Epic 10 — пользовательский результат совместного редактора, а не отдельная инфраструктурная фаза; базовое приложение уже существует, поэтому greenfield starter/новая базовая схема не нужны. S1 сохраняет действующую ценность Web/PWA; 10.2–10.3 добавляют scoped runtime; 10.4–10.5 — отдельная ветка, ожидающая source-owner disposition; 10.6–10.12 зависят от scoped runtime и своих предшественников, но не от формата S3; 10.13–10.14 проверяют оба output и rollback, 10.15 агрегирует результаты и не подменяет полную приёмку. Stories 10.1–10.15 включают actor, production path, минимальную ценность, BDD-проверки, ошибки и будущие regression/mutation evidence.

### Критическое замечание — порядок защит S2

Story 10.2 уже допускает writable create/save/reopen при signed identity и scope, а явные acceptance tests serialized barrier, generation teardown и гонок commit/journal/GC вынесены в 10.3. AD-26 связывает **все** эти защиты с каждым writable runtime и не разрешает промежуточное unsafe состояние. Текст 10.2 ссылается на AD-26 целиком, однако её собственные AC/evidence не доказывают barrier; 10.3 названа следующей историей. Это скрытая forward-зависимость и небезопасная точка завершения 10.2, если её выполнить буквально отдельно. Владелец epics должен перенести необходимую реализацию и tests barrier/fencing в 10.2 до первой записи либо явно запретить writable путь до совместной поставки 10.2 + 10.3; не считать первую story завершённой как writable до доказательства полного AD-26. Это не требует изменений Story 10.1 или выдуманного технического решения.

### Существенные вопросы владельцев

- V1/PPJ-A1 имеют один selector при разных формах, нормативный staged ingress не включён в production path. Истории 10.4–10.5 корректно ставят source-owner disposition и реальные файлы до S3; до решения эти stories не готовы к реализации и нельзя ослабить decoder/округлить/скрытно мигрировать. Конкретная зависимость не относится к изолированной 10.1.
- AGENTS требует human-approved AssetUsageGrant для alpha catalog resources; FR-28/44, SPEC и AD-14 явно исключают grant admission. Обе инструкции нельзя одновременно удовлетворить как единую policy без решения владельцев источников. Истории 10.8/10.9 и resource-backed variant admission, каталоговый release и acceptance c реальными моделями не могут заявить admission/release прошедшими без применимого human-approved grant и reconciliation policy. 10.4/10.5 при вводе новых catalog references и физический roundtrip с реальными ресурсами также зависят от соответствующей disposition; проверка уже pinned данных не отменяет необходимости определить применимость. Browser-only 10.1 не вводит новые assets, не меняет admission и не выполняет release; конфликт не блокирует её изолированный scope.
- PRD FR-16 и REL-05/UX расходятся в редактировании имени, а совместимость FR-9 с REL-08 требует явно проверить доступный split. Владелец PRD/UX должен сверить parity scope до принятия затронутой функциональности в 10.6; существующие реализации и ноябрьские UX маршруты не менять в этом review.

### Прочие замечания

Stories 10.2, 10.6, 10.8, 10.12 и 10.15 достаточно широки для нескольких последовательных RED/GREEN циклов у одного владельца; при выполнении разбивать на безопасные вертикальные инкременты без пересечения safety boundary и не переносить обязательные guards на поздний slice. 10.11 указывает regression 10.10, хотя dependency перечисляет 10.2/10.3/10.7: если идти не по порядку, фиксировать 10.10 как pending regression, а не как существующий PASS. Исторический inventory Epic 1–9 содержит устаревшие утверждения; действующие владельцы и актуальная coverage map имеют приоритет. Это документные замечания, а не самостоятельные подтверждения прошлой реализации.

### Точность evidence

16 TMA и 13 TMA-AC привязаны к будущим story/test paths, 12 UX-TMA — к work items. 2030 baseline tests и старые browser/PWA данные не проверяют Telegram. Bot/origins, signed launch и Ed25519 capability, physical client/account isolation, iOS/Android NFR-28, file reselect, фактические release/rollback остаются pending; они являются gates соответствующих acceptance/release, а их отсутствие само по себе не означает непригодность не зависящего от них browser-only S1.

## Summary and Recommendations

### Overall Readiness Status — NEEDS_WORK

**Оценка:** 2026-11-04, независимая документная оценка BMAD для всего Epic 10. Весь Epic 10 не готов к безусловному началу всех историй: AD-26 требует снятия неясности границы первой записи 10.2/10.3, S3 заблокирован format source-owner disposition, а политика asset admission и применимость grant остаются в прямом конфликте. Дополнительно унаследованные FR-16/REL-05 и FR-9/REL-08 требуют source-owner сверки затронутой parity. Данное NEEDS_WORK не означает, что каждый независимый срез обязан ждать все остальные; оно не является отказом физической приёмки, которая пока не проводилась.

### Отдельный verdict для S1 / Story 10.1 — READY, узкий технический scope

Планирование независимого **browser host-boundary extraction** достаточно определено для технического implementation-readiness: существующий entry и browser host на общем editor/runtime, прежние stores и data, эквивалентный domain/durable outcome, отсутствие Telegram зависимости, сохранение install/offline/update и существующего worker, изолированные проверки. Его acceptance не требует решения формата, admission новых assets, Telegram identity или физической проверки Telegram. S1 не меняет schema и имена storage, worker, backup, catalog admission, текущие UI и UX routes; не создаёт Telegram target, не переносит данные, не удаляет Web/PWA и не выполняет выпуск. Любое расширение этих границ требует отдельной оценки.

**Применимость owner approval к строго S1 — условие выполнено в пределах порученного scope.** На дополнительную сверку предоставлено дословное поручение владельца: «Начни с S0: проверь актуальное состояние проекта, согласуй документы и пройди предусмотренную проектом проверку готовности. Затем выполняй реализацию небольшими проверяемыми этапами. Рутинные инженерные решения принимай самостоятельно». Оно также требует сохранять данные и проверки Web/PWA и запрещает коммиты без отдельного разрешения. Прочитанная исходная спецификация уже определяет результат, путь и проверки S1; Story 10.1 конкретизирует этот прежний scope и защиту действующего preview без нового product/policy решения. Владелец поручил согласовать документы и продолжить малыми этапами после gate; координатор проверял выбор источников и критерии в рамках этого делегирования. В этой ограниченной части исходное поручение и выполненное делегированное согласование удовлетворяют отдельному условию утверждения planning package; применимый `READY` дан выше. Следовательно, после проверки неизменности этого scope S1 может начаться без повторного owner sign-off. Это оценка применимости выраженного поручения и делегирования, а не вымышленная цитата об утверждении итогового Epic 10, не blanket approval, не waiver и не physical acceptance.

**Исправление оценки:** первоначальная версия данного отчёта ошибочно требовала дополнительное подтверждение пакета S1, исходя из неполной формулировки поручения. После получения его точного текста и повторного сравнения S1 со спецификацией этот вывод отменён только для названного scope. Общий Epic 10 остаётся `NEEDS_WORK`; неразрешённые решения, release/physical gates, no-upload и запрет коммитов сохраняются.

### Critical Issues Requiring Action

1. **Epic/story owner — S2 до writable 10.2:** подтвердить полный AD-26 barrier/generation/teardown/fence и controlled races как часть первой writable поставки либо объединить 10.2/10.3 с явным запретом промежуточной записи. Проверить commit, journal и scope-wide GC; не приписывать identity checks только следующей story.
2. **SPEC/format owner — перед 10.4/10.5:** разрешить collision V1/PPJ-A1 и неподключённый ingress, специфицировать закрытые селекторы и grammar, зарегистрированную compatibility или явно санкционированную migration, error precedence и реальную build/schema/file matrix. Сохранять exact bytes, strict decoder и исходные данные; не округлять и не silently migrate.
3. **Product/source owners — перед зависимым admission/release:** согласовать AGENTS и PRD/SPEC/AD-14 по human-approved AssetUsageGrant, включая покрытие применимых использований и notices. До этого не объявлять реальную каталоговую admission/Telegram release принятыми; отдельно установить применимость к импортируемым существующим ресурсам. Эта оценка не изменяет licensing policy.
4. **PRD/UX owners — до parity затронутых routes:** согласовать FR-16 name с REL-05 и проверить, остаётся ли предусмотренный FR-9 split доступен при запрете жеста REL-08. Сохранить ноябрьские результаты; ни один документ не переписан этой оценкой.

### Evidence и release gates

Зафиксированный координатором preflight: architecture 15/15 + graph, lint 345 файлов, обе typecheck-конфигурации, 143 файла/2030 тестов, без пропусков; это baseline и не новая проверка текущего workflow. Hash audit 547 файлов выявил только изменение документа apps/web/README.md; non-document changes 0. Ноябрьские browser/PWA/catalog результаты относятся к своим датам, builds и контекстам; не являются Telegram acceptance. Новый build, browser/PWA, mutation, backend и physical tests здесь не запускались.

Реальные bot, стабильные HTTPS origins, signed launch/Ed25519 capability, физическое разделение аккаунтов, lifecycle/storage и NFR-28 на iOS/Android, реальный внешний файл и reselect в обоих направлениях, deployment/rollback ещё pending. Identity/scope проверяются до runtime/DB/journal/GC, без общего writable fallback; activation не удостоверяет аккаунт. Нет доказанной client isolation — нет writable release соответствующего клиента. 10.13/10.14 должны проверять manifest именно загруженной оболочки без worker, old-worker и immutable lazy URLs после release/rollback. File preparation/click не доказывает внешний backup; upload/бот/sync не разрешены. Если local handoff фактически невозможен, owner отдельно выбирает альтернативу и privacy/retention.

Существующий preview 4175 читает apps/web/dist и использует действующий cloudflared; любые будущие сборки и прогоны — изолированные outputs/origins с сохранением процессов, dist и retained chunks. S0–S7 сохраняют Web/PWA, данные и проверки. Будущий Telegram-only retirement возможен только после owner verification, доступа к старым данным и доказанного переноса/rollback и отдельного решения.

### Final Note

Обнаружены четыре группы существенных вопросов: S2 safety sequencing, формат S3, конфликт licensing и унаследованная UX/PRD parity. Они возвращены в этот отчёт владельцам источников; ни один canonical документ не исправлялся. Исторический READY 2026-08-30 сохраняет прежний scope. Данный verdict не является физической приёмкой, публикацией, изменением policy или waiver.

### Дополнение перед завершением — проверка S1 и источника

Read-only review координатора уточнил неисполненный план S1: импорт `editor-app.tsx` создаёт runtime на уровне модуля; создание использует sessionStorage для writer owner и включает dev global seam, а IDB открывается лениво. Следовательно, будущий RED должен проверять side effects и ровно один runtime при StrictMode; бездумный импорт нельзя считать чистой границей. Это не утверждение о выполненной проверке. `PWA-E2E-03` регистрирует тот же worker с query-параметром, поэтому сам по себе не доказывает upgrade с прежнего build `ccdd13662cdca379`. Для Story 10.1 AC3 необходимо сохранить старый shell/worker и проверить переход на candidate с сохранёнными данными на отдельном origin. Возможны отдельный `--output-path` и временный layout для preview; их работоспособность в этом workflow не испытывалась. Два этих пункта — условия доказательства S1, не Telegram acceptance.

Координатор сообщил о параллельной ненормативной source-owner correction в SPEC Verification map. Строка повторно прочитана после изменения: она теперь фиксирует обновлённые Epic 10, roadmap и traceability и не предполагает readiness verdict. Это factual delta, не изменение CAP/гейта; отчёт оценивает актуальную строку. Переданы 19 существующих companion paths; их существование проверено.

По прямому поручению не запускать новые owner workflows отдельный `bmad-help` после завершения данного workflow не запускался. Customization `workflow.on_complete` разрешён и пуст.


## Повторная оценка после source-owner исправлений — 2026-11-04

Эта независимая повторная оценка дополняет, а не переписывает начальный снимок: извлечения PRD, findings и прежний verdict выше сохраняются как история на момент первой проверки. Текущий общий verdict **Epic 10 — NEEDS_WORK**; применимые узкие verdicts приведены ниже. Отдельные source-owner workflows в этой повторной оценке не запускались.

### Перепроверка исправлений

- **S2 safety sequencing — закрыто в планировании.** Актуальная Story 10.2, AC 4 и 9–13, требует до первой writable операции strict Ed25519/bootstrap и scope, generation, serialized barrier, teardown, writer fencing, journal и scope-wide GC; controlled commit/journal/GC и late-result races входят в RED→GREEN до первого publish. Story 10.3 расширяет уже поставленную защиту, а не откладывает её. Это спецификация предстоящих работ, не факт их выполнения. AD-28 требует также проверить manifest на соответствие **фактически загруженному shell до первой записи**: 10.13 явно описывает mismatch, но S2 обязан выполнить этот guard сразу, не переносить его на S7.
- **FR-9/REL-08 и FR-16/REL-05 — исходные противоречия устранены владельцами.** PRD, UX и SPEC/CAP-2/3 согласуют автоматическую нормализацию допустимых контактов без отдельного UI split, type/height без редактирования и показа исторического имени на плане, с сохранением `Room.name` после reopen. SPEC result фиксирует завершение его reconciliation. Строки в epics/roadmap/traceability и epics-result о ещё неподтверждённом завершении SPEC — устаревший промежуточный снимок, не новый источник противоречия; их владельцу передано обновление. В project-context остаётся неоднозначная фраза об отсутствии `metadata/surface-finish flow`: применимые PRD/SPEC/UX явно сохраняют non-canvas Room type/height, и эту фразу нельзя использовать как запрет этого маршрута. Рекомендуется уточнить краткий context у его владельца; это не возвращает прежний source conflict и не добавляет canvas selection.

### S1 — выполненный browser prerequisite и границы evidence

Прочитаны результаты `docs/progress/telegram-extension-2026-11-04/S1/` и независимый read-only обзор. Записаны 145 unit-файлов / **2044/2044**, архитектура **15/15 + graph**, lint **350** и обе конфигурации TypeScript; изолированная сборка `d38550c8f379120a` и browser **6/6**, PWA **10/10**, отдельный старый worker `ccdd13662cdca379` → candidate с сохранённым Project и offline reopen **1/1**. Это данные сохранённых логов, не новые прогоны readiness. Сначала `typecheck-final.log` завершился ошибками временного TypeScript upgrade-теста; после перевода теста в `.mjs` последующий `typecheck-verified.log` прошёл. `build-comparison.json` фиксирует startup +7 bytes и `liveOutputUnchanged: true`; сама эта оценка не пересчитывала live hashes. В каталоге S1 не обнаружена ведомость SHA-256 исходников, связывающая все ранние build/PWA/unit прогоны с финальным снимком после mutation-run; поэтому нельзя независимо утверждать идентичность исходников всех этих прогонов по данному набору evidence.

Mutation **97,67%** относится только к `browser-editor-app.tsx`: 40 killed, **2 timeout**, 1 survivor, который triage описывает как эквивалентный пустой catch. Не считать timeout автоматически доказанными killed и не переносить score на проект в целом. Испытание реального old-worker upgrade подтверждает соответствующий S1 path, но не доказывает отдельную S7 загрузку ранее не загруженного lazy URL после **release и rollback**: старый editor был уже загружен, rollback в этом тесте не выполнялся. Это остаётся будущим evidence Story 10.14. Эмуляция браузера не является physical Telegram evidence.

### Применимые verdicts и зависимости

| Scope | Verdict | Точная применимость |
|---|---|---|
| S2 / 10.2 | **READY** для локальной инженерной реализации | Можно начать после этого recheck в рамках исходного поручения: test-signed identity/vectors, отдельная host composition и полный локальный scoped storage path. До первой записи реализовать и доказать все AD-26 guards/races и shell-bound manifest; без identity/crypto/freshness/manifest нет общего writable fallback. Не вводить новый catalog resource admission и не выпускать target. Production bot/origins и physical client isolation — последующие gates, не подменяются fake. |
| S2 / 10.3 | **READY** для планирования и последовательной реализации | Начинать зависимый slice после завершения и доказательства защит 10.2; A→B→A, поздние операции, два writer и scope-wide roots дополнительно проверяются. Реальный writable release конкретного клиента запрещён до physical isolation evidence. |
| S4 / 10.6–10.7 | **READY** для планирования; реализация после prerequisites | Нужны реализованные и проверенные 10.2–10.3; 10.7 также использует 10.6. FR-9/16 применять по актуальным PRD/SPEC/UX, REL/FUP и AC 7; проверить viewport/keyboard, draft/Back, pinching и browser regression. S3 format disposition не является зависимостью. Device evidence отдельно pending. |
| S6 / 10.10–10.12 | **READY** для независимого локального Plan-only scope после prerequisites; полный S6 ещё не готов к завершению | 10.10 Plan path требует 10.2–10.3 и 10.6, готовность модулей/codec/resources и PWA cold-offline regression; полноценный item path требует 10.8–10.9. 10.11 требует 10.2–10.3 и 10.7, плюс заявленную regression 10.10; 10.12 требует 10.3/10.11 и regression 10.10. Quota, exact repair/atomic RecoveryChangeSet, history-only explicit discard, GC roots, fence и late races нельзя откладывать за удобный happy path. Выполнение без S5 не закрывает всю Story 10.10 или весь S6. |
| Локальная S7 / 10.13–10.14 | **READY** для планирования и изолированной инженерной репетиции после prerequisites | 10.13 требует 10.1–10.3 и существующего второго target; 10.14 — завершённую 10.13 и локальные release sets. Проверять shell-bound manifest даже без worker, old worker, отсутствие чужих cleanup и atomic switch/rollback с retained immutable lazy URLs у старого клиента. Нельзя перезаписывать live dist/preview или публиковать. |
| S7 / 10.15 | **NEEDS_WORK** для полного результата; частичный локальный runbook/evidence допустим после соответствующих проверок | Полный локальный итог зависит от 10.1–10.3 и 10.6–10.14, в том числе 10.8–10.9; полная transfer acceptance дополнительно от 10.4–10.5, format disposition и реальных внешних файлов. Pending нельзя именовать PASS; fake не заменяет NFR-28. |

В этих узких scopes действует уже подтверждённое поручение владельца: согласовать документы, провести gate и реализовывать небольшими проверяемыми этапами с самостоятельными рутинными решениями. Оно не разрешает изменение privacy/product policy, серверную отправку, физическую приёмку от имени владельца, публикацию, коммит или retirement. Все реальные prerequisites, TDD, необходимые mutation/type/lint/architecture/browser/PWA проверки и один implementation owner остаются обязательны.

### Открытые source и external gates

1. **S3 / Stories 10.4–10.5 — NEEDS_WORK:** source-owner disposition V1/PPJ-A1 selector collision и неподключённого нормативного ingress, зарегистрированные форматы/совместимость и реальные build/schema files до реализации зависимого переноса. Нельзя ослабить decoder, округлить, молча мигрировать или выдавать label за соответствие.
2. **Зависимая catalog admission / Stories 10.8–10.9 и resource-backed variants — NEEDS_WORK:** AGENTS требует human-approved AssetUsageGrant; PRD/SPEC/AD-14 исключают такой Alpha admission. Ответ владельца ещё не получен, этот recheck не выбирает policy. Никаких новых referenced catalog assets или зависимого release/physical acceptance до соответствующей source-owner disposition и применимого требования к grant. Проверка существующего pinned Project не доказывает права новых admissions.
3. Реальные bot/stable HTTPS origins, signed launch/Ed25519 в целевых клиентах, physical account isolation, NFR-28 iOS/Android, external save/reselect в обоих направлениях и release/rollback остаются pending; отсутствие этого evidence не переписывается в дефект планирования локального S2. При физической невозможности локального handoff только владелец отдельно определяет альтернативу и privacy/retention; upload/бот/sync не разрешены.
4. Web/PWA, его данные, действующий preview 4175/dist, процессы и retained chunks сохраняются. Удаление Web/PWA возможно лишь после owner verification, доступа к старым данным, доказанных переноса и rollback и отдельного retirement decision.


## Итоговый recheck S2 после fencing disposition — 2026-11-04

### Verdicts и текущее состояние

- **Весь Epic 10 — NEEDS_WORK.** Уточнение S2 не разрешает S3, catalog admission, physical acceptance или release.
- **S2 / Story 10.2 — READY для локальной реализации уточнённого контракта AD-26**, а не для объявления Story выполненной. Исходное поручение владельца покрывает этот инженерный scope с соблюдением опубликованных ограничений. Весь protocol и его evidence обязательны до первой writable create/import/repair/delete/publish; конкретный неподключённый следующий срез описан ниже. **Story 10.3 — READY к последовательной реализации после выполненной и проверенной 10.2**, а не отложенное место обязательной защиты.
- **Текущее выполнение S2 — PARTIAL:** два изолированных компонента (signed-launch validator и runtime-local session queue) существуют; они не подключены к entry, runtime или IndexedDB и не дают writable Telegram path. Это не S2 PASS, не доказательство реального межконтекстного lock/fence или physical identity.
- **S3 / 10.4–10.5 — NEEDS_WORK.** AD-30 существует как архитектурная disposition; `runtime-v1-wire` и legacy branch не зарегистрированы в SPEC, closed grammar/dispatch и полный corpus отсутствуют. FR-57 допускает отказ от неоднозначного файла с сохранением bytes, но не объявляет неподдерживаемым current empty V1 и не закрывает перенос. Наличие старого Web/PWA не доказывает recovery: требуются конкретные old context/build → восстановление → новый exact export и подтверждение обоих направлений. Единственная неоднозначная копия без проверенного пути требует адресного решения owner до соответствующей acceptance. Также открыты точное представление `-0`, FR-44 envelope всех healthy Durable V1 и сохранение PPJ limits/error precedence. Не менять исходные IDB/Revision/checksums и не ослаблять decoder, округлять или скрытно мигрировать.
- **S4, локальный Plan-only S6 и локальные 10.13–10.14:** прежний ограниченный planning READY остаётся с фактическими prerequisites из предыдущего recheck; реализация S4/S6 ждёт реализованных и проверенных 10.2–10.3, а 10.13 дополнительно второго target. Полный item path и 10.15 зависят от отдельных историй и открытых gates. Никакой physical/release verdict не присвоен.

### Source-owner recheck

Architecture Spine AD-26, полный `telegram-s2-fencing-disposition-2026-11-04.md`, SPEC и оба применимых companion согласованы; disposition включён в 21 companion SPEC. Финальный epics result имеет `status: complete`, а Story 10.2 AC 10–19, roadmap и traceability относят полный protocol к первой writable операции. Независимый read-only review подтвердил это сопоставление; source documents в данном recheck не менялись. Прежний browser baseline не является доказательством safety: `recover()` удаляет staging без надлежащего owner/fence predicate, stage/cleanup и pin journal не выполняют весь требуемый protocol. Runtime-local queue не синхронизирует другие contexts. Общий scope-wide GC/root inventory в baseline отсутствует; S2 его не вводит и не имитирует. Сохранение bytes/roots не отменяет SessionRetentionPolicy.

### Следующая конкретная безопасная граница

Добавлять изолированно и последовательно, через RED→GREEN, **scoped persistence substrate**, пока Telegram entry/runtime не имеют writable подключения: проверку доступности exclusive scope Web Lock без fallback и nested/steal; атомарный persisted uint64 counter/marker без ABA и fail-closed при missing/corrupt/overflow; в дальнейшем атомарные owner/fence/base/attempt predicates и no-overwrite stage/Revision, immutable journal и durable receipt вместе с pointer swap, `no-publish`/conditional cleanup, atomic pin/protect и безопасные takeover/adoption. Незавершённые/неизвестные исходы сохраняют stage, journal и bytes; прежний browser bulk `recover()` не используется для Telegram. Test databases/contexts и output изолированы; никаких операций над пользовательскими данными или подключения к live preview. Шаги можно разделить на меньшие проверяемые единицы, но нельзя включать первую запись, пока **весь** принятый протокол, shell-bound manifest и обязательный двух-runtime race corpus не реализованы и не проходят. Этот verdict не означает, что все эти механизмы уже существуют.

### Проверенные S1/S2 evidence

По `docs/progress/telegram-extension-2026-11-04/S2/README.md` и журналам: **2060/2060 unit, 147 файлов**, обе TS-конфигурации PASS, lint **354** без предупреждений, architecture **15/15 + graph**; проверка race trusted configuration имела отдельные RED/GREEN. Identity mutation **96,59%: 198 killed, 7 survived, 0 timeout**. Session queue **100% detected: 7 killed, 7 timeout**, причём timeout обозначают обнаруженное зависание, не 14 assertion kills. Эти результаты не доказывают storage protocol; browser/PWA и build в этом S2 не повторялись, physical Telegram не выполнялся. Сам readiness recheck тесты не запускал.

S1 `source-evidence-inventory.json` — post-check снимок, не восстановленные hashes каждого ранее выполненного прогона. Независимая read-only сверка нашла **468/468 source и 22/22 evidence hashes** совпадающими с текущими файлами; действующий `apps/web/dist` сейчас совпадает с сохранённым прежним output **60/60 файлов**, без лишних. Это не устраняет историческую границу привязки ранних отдельных прогонов к единому снимку. Old-worker upgrade S1 не доказывает S7 ещё не загруженный lazy URL после release и rollback.

### Остальные gates

Конфликт `AssetUsageGrant` между AGENTS и PRD/SPEC/AD-14 не разрешён: owner ещё не ответил, поэтому новая referenced catalog admission и зависимая acceptance/release остаются заблокированы. Реальный bot/stable HTTPS, Web Lock/Ed25519 и account isolation на физических клиентах, NFR-28 iOS/Android и внешний file roundtrip, release/rollback остаются pending; test fixture и fake их не заменяют. Нет разрешения на upload, публикацию или коммит. Web/PWA, его данные, исходный preview 4175 и retained chunks сохраняются; retirement — отдельное решение после owner verification и доказанного переноса/rollback.


## Повторная оценка зарегистрированного AD-26 / AD-30 — 2026-11-04

### Текущие применимые verdicts

| Scope | Verdict | Применимость и зависимые условия |
|---|---|---|
| Epic 10 целиком | **NEEDS_WORK** | Открыт источник AssetUsageGrant до зависимого catalog admission/release, ещё нет полного S2, доказательств S3, NFR-28 или выпуска. Это не запрещает независимые локальные части ниже. |
| S2 / Story 10.2 | **READY для локальной реализации** | Актуальный source-owned AD-26 фиксирует единый scoped IDB v2 и полный fencing protocol. Продолжать TDD, deterministic races и интеграцию; реализация не является завершённой. До первой writable операции обязательны production composition, все guards и полный AD-26 corpus, включая shell-bound manifest. Test evidence не требуется заранее как разрешение начать его создание. |
| S2 / Story 10.3 | **READY для планирования и последующей локальной реализации** | Зависит от завершённого и проверенного 10.2; расширяет A→B→A, edge и physical evidence, не откладывает защиту первой записи. |
| S3 / 10.4 | **READY для локальной реализации codec/scanner, proof и recovery fixtures** | PPJ-A1, V1-wire и ограниченный V1-legacy зарегистрированы; отсутствие созданных тестов/proof сейчас не блокирует их реализацию. End-to-end Telegram publication зависит от готового S2. Испытания используют synthetic/local fixtures; новая зависимая catalog admission и release ждут решения licensing. |
| S3 / 10.5 | **READY для локального планирования/реализации независимых file seams и доказательств** | Полный production path и завершение story зависят от 10.4, готового scoped runtime и доказанного file handoff; подготовка и тесты не требуют заранее доказанной совместимости или физических результатов. |
| S4, S6, local S7 | **Ранее выданные ограниченные planning READY сохраняются** | S4 ждёт реализованных/проверенных 10.2–10.3; S6 Plan path — S2 и 10.6, item path — также 10.8–10.9; local 10.13/10.14 — S2, второй target и свои dependencies. Полный 10.15 зависит от результатов 10.6–10.14 и отдельно S3/physical для transfer. |

Владелец прямо поручил продолжать до полной реализации небольшими проверяемыми этапами и делегировал рутинные инженерные решения. При выполнении этих применимых gates, prerequisites и TDD нет основания останавливаться на каждом срезе ради повторного рутинного подтверждения. Это не human physical acceptance, не waiver, не разрешение на облачную передачу, публикацию, коммит или retirement.

### Независимая сверка source package

`AD-26`, полный `telegram-s2-fencing-disposition-2026-11-04.md`, `project-and-backup-contract.md`, platform companion и финальные Stories 10.2–10.3 согласуют одну `interiors-editor-projects:<scope>` IndexedDB v2. Metadata-only v1 → v2 выполняется атомарно под Web Lock с сохранением identity/`protocolVersion=1` и существующего uint64 counter; неизвестные данные, corrupt metadata, blocked/late callbacks, abort/quota не приводят к reset. Fresh v0 не доказывает восстановление внешне очищенного origin. Обычные writes требуют проверенной strict durability; versionchange не получает вымышленного durability option. До первой записи — atomic fence/base/stage/prepared/receipt/pin/pointer/no-publish и conditional cleanup, scope lock и generation; async hash вне IDB transaction с повторной проверкой identity/version/size/fence/base. Undo/Redo атомарно адресует exact owned Revision с новым attempt/receipt без overwrite или новой semantic Revision. Общий GC не вводится, старый browser bulk `recover()` к Telegram не подключается, bytes/roots сохраняются; SessionRetentionPolicy остаётся обязательной.

SPEC registry теперь явно регистрирует PPJ-A1, закрытый `runtime-v1-wire@1` и V1-legacy только с historical byte equality и PPJ-disjoint witness, а полную grammar и bounds принимает через source-owned AD-30 disposition. Stories 10.4–10.5 и матрица описывают single dispatch без fallback, PPJ error precedence, exact `-0`/finite `0.5`, UTF-16, own-undefined, bounded variants, resource aliases, exact-repair, no-overwrite и proof. Необходимость исполнить worst-case corpus и проверить recovery/file pairs **до rollout/compatibility claim**, а не до начала разработки, прямо отражена в stories. Два независимых read-only обзора не выявили нового блокирующего пробела в конкретизации локального implementation scope.

Старые статусные слова в CAP-10 SPEC о ещё открытой source-owner disposition, AD-29 и вводной старой версии AD-30 companion отстают от зарегистрированной строки реестра; последняя версия SPEC result и активный registry подтверждают регистрацию. Это handoff владельцам для уборки status wording без ручного изменения canonical sources в readiness. Открытые доказательства и совместимость при этом остаются открытыми. `project-context` уже отдельно называет сохранённый Room type/height path; общую историческую фразу metadata не использовать как запрет этого route.

### Следующая разрешённая работа и реальные границы

Продолжить в рамках текущего implementation owner: завершить single-DB fenced publication и durable receipt/no-publish, exact owned-history pointer, resource pin/protect и recovery, далее полный native двухконтекстный race/crash/takeover/upgrade corpus и необходимые mutation/regression проверки. Рабочую запись Telegram не подключать до полного AD-26 corpus и shell-bound manifest, при отсутствии lock/durability или неизвестном исходе — fail closed с сохранением данных. Параллельно допустимо реализовать зарегистрированный S3 parser/codec и исполняемый worst-case/legacy recovery corpus на изолированных локальных fixtures; production publication выполняется только через доказанный S2 path, прежний browser export/recovery сохраняется до доказательства FR-44/NFR-13 для **всех** non-corrupt Durable Projects текущей policy, а не лишь более узкого определения healthy в V1 grammar.

Старый empty legacy без witness отклоняется консервативно с исходными bytes; старый Web/PWA сам по себе не доказывает recovery. Проверить конкретный old build → тот же local context → безопасное обновление → новый exact export. Для единственной читаемой копии без доказанного пути, в том числе вне closed grammar/non-index array properties, не объявлять файл corrupt; если проверка установит невозможность восстановления, тогда owner решает адресный FR-57 вопрос. Пока не выполнены worst-case/exportability proof, конкретные file/build evidence и physical iOS/Android roundtrip, не заменять старый exporter и не заявлять полную совместимость или приёмку. PPJ mapper и старый client support нового selector не предполагаются.

Ответ owner по конфликту AGENTS vs PRD/SPEC/AD-14 относительно human-approved AssetUsageGrant ещё не получен. До disposition не объявлять применимую новую catalog-resource admission/release пройденной; разрешение локальных synthetic proof не меняет policy. Реальные bot/HTTPS, наличие Web Lock/strict durability и безопасное разделение аккаунтов на целевых WebViews, NFR-28, двусторонний внешний handoff, release/rollback и отдельный retirement gate остаются pending. Нет upload/cloud; Web/PWA, данные, active preview/dist, retained chunks и проверки сохраняются; commit только по явному отдельному разрешению владельца.

### Фактическое evidence на момент recheck

Source owners сообщают о bounded v2 foundation: сохранённый лог фиксирует **26/26 native** и отдельный предыдущий unit run **2072/2072** до последующего усиления тестов. Это не production Telegram repository/entry и не полный AD-26 corpus. Mutation публикационного core (210 raw, 90,95%) выявил пробелы тестов; по сообщению исполнителя они исправляются, итоговый актуальный результат не заявляется до завершения rerun/triage. Новые изменения общего publication path требуют свежего Web/PWA regression перед закрытием соответствующего slice. Исторические S1 evidence и ранее выполненные S2 проверки сохраняют свои даты и области применимости; в этом readiness recheck application tests, build, physical проверки и публикация не выполнялись.


## Решение владельца по каталожной политике — актуальная disposition 2026-11-04

Владелец прямо решил: «Сохранить правило PRD/SPEC без формального AssetUsageGrant и обновить AGENTS». Актуальный `AGENTS.md` и `project-context.md` приведены к этому решению: владелец вне приложения выбирает бесплатные или созданные им модели; formal `AssetUsageGrant` и licensing/provenance/declaration/attribution/notice admission не являются Alpha gate. **Прежний source conflict разрешён; licensing blocker снят.** Исторические записи выше отражают известное на момент прежних оценок и не изменяются.

**Применимость:** локальное планирование каталожных Stories 10.8–10.9 имеет **READY** в принятом scope, с обычными техническими prerequisites: 10.8 — реализованные и проверенные 10.2–10.3 и Plan path; 10.9 — 10.2–10.3, 10.6 и 10.8. Независимые проверки и безопасные preparation slices допустимы по мере готовности их зависимостей. Истории не объявляются реализованными или принятыми. Упоминания неразрешённого licensing conflict в существующих epics/roadmap и других owner-документах — устаревшие status snapshots; их необходимо читать с учётом указанного решения, а readiness workflow не переписывает чужие canonical sources.

Требования к format/size/hash, security, exact bytes, pinning и `BackupFeasibilityPolicy` до Durable mutation или resource-backed variant сохраняются, как и fencing, history/GC roots и recovery. Это решение не подтверждает качество моделей, фактическую проверку Telegram или совместимость файлов и не разрешает отправку пользовательских Project/GLB/backup на сервер, cloud sync, публикацию, коммит или удаление Web/PWA.

Общий **Epic 10 остаётся NEEDS_WORK по незавершённой реализации и соответствующим evidence/release gates**: в частности S2 publication и полный race corpus, S3 worst-case/FR-44 и конкретные file/recovery proofs, реальные bot/HTTPS, physical account isolation/NFR-28 и внешний двусторонний handoff, release/rollback и отдельно gated retirement. Это не новое требование завершить будущие tests до начала разрешённой локальной реализации. Узкие локальные READY для S2/S3 и предыдущие зависимости S4/S6/S7 сохраняются; item path S6 и full 10.15 по-прежнему зависят от завершённых технических stories, но не от formal grant.

Этот статус фиксирует прямое owner-решение; не является физической приёмкой или новым test result. Application tests, сборки, исходники и canonical owner artifacts в этой правке readiness не изменялись.


## Техническое обновление S2: native storage и UI — 2026-11-04

Сохранённый Chromium-прогон текущего набора storage-сценариев `S2/inverse-pin/root-native-green.log` содержит **124/124 PASS**; отдельный root native UI-прогон `S2/ui/root-native-ui-green.log` содержит **5/5 PASS**. Последний использует реальный общий EditorApp/AppShell и scoped runtime: создание/сохранение/reopen, A→B→A с preferences и сохранением browser data, загрузку точного локально закреплённого GLB и 3D, подготовку ZIP как локального File и повторный выбор для import в новый Project ID. В этих сценариях verified scope и loaded capsule заданы test fixtures; подписанный launch проверяется отдельно, `share` является контролируемой test stub. Это не проверка настоящего Telegram bot/account, OS file handoff, физического внешнего файла или NFR-28. Тест local File/reselect не подтверждает S3 worst-case, реальную build/file compatibility и полный физический перенос.

Private runtime теперь подключён к общему редактору в указанном тестовом пути; прежние описания выше о **двух неподключённых компонентах** относятся к историческому checkpoint и не описывают текущий тестовый путь. Новый production entry/build target находится в разработке: успешные fixture-пути не подтверждают работающий signed launch через реального бота. Записанные 124 прохода — evidence для выполненного набора на указанном снимке, не отдельное доказательство physical WebView isolation, OS-crash durability или всех последующих изменений. По сообщению координатора активный preview/dist по-прежнему совпадает с сохранёнными 60 файлами; эта оценка не пересчитывала hashes и не запускала тесты.

Выполнение S2 продвинулось, но **Story 10.2/10.3 и Epic 10 не объявляются завершёнными или release READY**: нужны завершённый target/entry, применимые проверки production composition и текущего source snapshot, расследование и окончательная оценка требуемых mutation checks, browser/PWA regression после общих изменений, а также отдельные реальные client/account/NFR-28 gates. Идёт focused mutation на новых guards; исторический полный прогон 2420 mutants относится к другому снимку, и актуальный объединённый score здесь не заявляется. Существующее разрешение локальной реализации S2/S3 и technical prerequisites остаются в силе.

S4 может продолжать изолированную подготовку UI/ports и RED-проверки, не включающие неподтверждённые действия и не объявляющие Story DONE; зависимые законченные production paths требуют S2/entry и своих проверок. Технические правила exact pin/hash, feasibility и сохранения данных остаются обязательными; formal grant не требуется по последнему решению владельца. Нет разрешения на upload/cloud, внешнюю публикацию или commit; Web/PWA и live preview сохраняются.


## Consistency/readiness: отдельный Web/PWA export — 2026-11-05

### Вердикт — READY для ограниченной локальной реализации и проверки

UX `EXPERIENCE.md`, SPEC `CAP-10` и platform companion, Architecture `AD-30` и disposition согласуют отдельное явно выбранное действие **«Экспорт файла для переноса»** в действиях конкретного Project в списке и в меню редактора. Оно создаёт registered V1-wire из representable Durable Project, включая пустой; прежний browser export/import, default feasibility policy, History, schema/stores и данные сохраняются. Владелец уже указал это действие; дополнительное рутинное подтверждение не требуется. Этот узкий `READY` разрешает выполнить реализацию и RED→GREEN проверки, не утверждает доступность безопасного production path, завершение Stories 10.4–10.5, физический handoff или rollout. Новое действие не требует автоматически допускать обратный browser ingress.

**Явная трассировка:** CAP-1/10/13; FR-5/44/45/57/58; NFR-1/3/10–13/21/24/26/28; AD-3/4/14/25/29/30; UXF-5/8 и два входа EXPERIENCE. Эпик 10 содержит общий transfer path, но детализированные оба входа этого нового read-only действия пока явно не обозначены в epics/roadmap/traceability. Передать владельцу backlog для последующего additive trace; этот отчёт фиксирует конкретный ограниченный scope и acceptance для локальной работы, не меняет чужие артефакты и не объявляет весь S3 готовым.

### Обязательные проверки до включения действия

1. Browser composition выбирает отдельный registered writer для конкретного выбранного Project/Revision и использует именно browser repository и pinned resources. Доказать принадлежность **фактического structured snapshot** выбранной Durable Revision и согласованность pointer/Revision; in-memory `current` и совпавшие JSON/checksum недостаточны для `-0`/`0`, own-undefined и иных structured различий. До async boundary получить exclusive immutable ownership или доказать exact structured identity; при неподтверждённом происхождении/read race безопасно отказать. Из-за старого browser writer `revisions.put` одной транзакционной выборки недостаточно без доказательства durable provenance и защиты от старых конкурентных writers.
2. Защитить lifetime snapshot и ресурсов от concurrent edit/delete/cleanup/takeover. Для каждого exact raw key, включая отдельно каждый alias, доказать pin/root, length, все 256 бит SHA и фактические bytes; `resources.read`, browse cache или remote URL не заменяют проверку. Если гарантии недоступны, сохранить source и отказать, не производить частичный/ложно успешный файл.
3. Выполнять действующие domain/format/size/security и applicable smoke проверки; 25 MiB registered resource preflight не расширяется 50 MiB portable envelope. Не выдавать roomless/2D smoke за GPU-render evidence. `zipSync` синхронен: отмена и ограниченная память должны быть честно описаны и проверены, без обещания немедленной отмены внутри sync этапа. Непредставимые snapshot/reader, включая non-index свойства, дают безопасный отказ, не диагноз corruption; исключение verifier не приравнивается к повреждённому Project.
4. В обоих UI входах проверить подготовку, cancel/error, pending/draft и persist-failed: экспортируется только обозначенная Durable Revision, незаписанный candidate остаётся отдельным recovery export. Нет изменения Project/Revision/History/raw keys, генерации Project ID, DB upgrade, скрытой сети или изменения default policy. Подготовка bytes/callback/picker не подтверждает сохранение внешнего файла.
5. Для empty/open plan, Room и actual pinned GLB, aliases, missing/corrupt/unpinned resources, >25 MiB, checksum mismatch, concurrency, cancel/exception и source unchanged доказать actual registered writer → strict TMA decoder без fallback. Отдельно проверить прежний export, browser/PWA paths и old worker. Доказывать конкретный результат local tests; physical iOS/Android external save/reselect и память на целевых устройствах остаются отдельными evidence. Успешный экспорт не доказывает универсальную двустороннюю совместимость, замену прежнего exporter по FR-44, NFR-28 или compatibility конкретных версий.

### Browser ingress P1 остаётся OPEN

Архитектурный adversarial review указывает, что новый registered browser ingress уже подключён в рассматриваемой trial composition; нельзя предполагать, что он автоматически отключён или защищён. В изолированном probe UPPER-key GLB был опубликован Durable, после чего прежний export отказал `PORTABLE_BACKUP_RESOURCES_UNAVAILABLE`; это воспроизведённый test finding, не утверждение о повреждении реальных пользователей. Отдельный P1 no-overwrite остаётся без proof: существующие browser `revisions.put`/`staging.put` могут затронуть чужие записи до отказа по pointer/fence. Проверка случайного UUID или ранняя проверка вне транзакции не доказывает безопасность. Доверенный ingress должен иметь exact legacy representability до ID/staging и проверенный atomic no-overwrite/collision protocol с учётом старых writers и retry, либо оставаться закрытым. Упомянутый opt-in guard ещё не считается реализованным, reviewed или доказанным; никакого database upgrade или blanket изменения старого history protocol этот verdict не разрешает.

Read-only export не снимает и не зависит автоматически от закрытия **обратного ingress** P1, но собственное provenance/lifetime proof старого writer обязательно. Цепочка старый ambiguous empty file → old importer → тот же context → новый wire → физический strict TMA import остаётся лишь кандидатом до конкретных file/source hash, build/context и reselect evidence. При отсутствии проверенного пути для единственной копии не объявлять её corrupt и не приписывать согласие владельца.

### S4 и evidence

`docs/progress/telegram-extension-2026-11-04/S4/host-back-plan-integration-green-final.log` содержит **5/5** Chromium TMA-UI-08–12: сохранение raw rename/caret и raw angle, room fields, закрытие чистой панели и отмена drag перед queued pointerup. Предыдущий запуск имел 3 PASS / 2 FAIL; финальный 5/5 — повтор, не пять физических Telegram-проверок. Используются test host bridge/scoped fixtures; эти результаты не подтверждают production SDK Back, scene/full S4 или физическое устройство. `AppShell.tsx` и файл UI-тестов имеют время изменения позже этого GREEN, а отдельной ведомости SHA именно для данного root-прогона не обнаружено: нельзя выдавать 5/5 за проверку текущего source head. Нужен повтор на замороженном снимке либо доказанная связь hashes. Новые tests в readiness не запускались.

SPEC owner завершил согласование действия и убрал устаревшую фразу о несогласованном AD-30 в §1.4; это не закрывает P1. Product owner решил отбирать бесплатные/собственные модели вне приложения; formal AssetUsageGrant не является Alpha gate, technical checks остаются. Общий Epic 10 **NEEDS_WORK** по незавершённой реализации/evidence; сохранены no upload/cloud, Web/PWA, пользовательские данные, активный preview и запрет коммитов без отдельного разрешения.


**Дополнительная consistency-граница PPJ:** registry §1.1.1 оставляет полный PPJ manifest/ledger/resource binding и `proofRef` на source-owner disposition; пока validator/mapper недоступен, PPJ остаётся неподтверждённым handoff с сохранением source, без ложного acceptance или V1 fallback. Эта граница не блокирует узкий registered V1 export. Отдельное требование UX/source disposition в `project-and-backup-contract.md` §1.4 удовлетворено существующими решениями UX, SPEC и Architecture; их наличие не заменяет integration evidence.


## Scoped implementation readiness AD-31 — 2026-11-05

### Вердикт: READY для локальной реализации описанного AD-31

Это отдельный применимый implementation gate для явно выбранного Web/PWA registered-transfer ingress в новый anonymous browser namespace. Он разрешает реализацию и TDD по согласованному source package; **не является** доказательством реализации, разрешением rollout, waiver или физической приёмкой. Старый узкий S3 READY сам по себе этот namespace не покрывал. Владелец явно поручил новую область и делегировал рутинные решения; дополнительный повторный выбор уже принятого scope не требуется. Код нового storage на момент handoff не заявлен реализованным.

Сверены завершённые PRD FR-45/57, SPEC CAP-10 и `project-and-backup-contract.md` §1.4, UX EXPERIENCE/DESIGN, Architecture AD-31 и `browser-registered-storage-disposition-2026-11-05.md`, Stories 10.4–10.5, roadmap и traceability. Story owner завершил AD-31 handoff, Architecture — обновление scoped identity и bounded fresh-v0, затем SPEC и UX согласовали этот transition. Два независимых read-only recheck подтвердили готовность плана к локальной работе при границах ниже. Заранее готовые IDB race tests, старые device/file results и physical proof не являются предварительным условием начала разработки; они остаются обязательными до соответствующего включения/приёмки.

### Контракт и границы локальной реализации

- Предпочтителен один новый `interiors-editor-browser-registered` IDB с собственной anonymous browser-local identity и stores Project/Revision, resources/library, writer/fence, attempts/receipts/journal и roots. Общие domain/application/editor и validation переиспользуются; host-neutral алгоритмы выносятся через узкие ports, но `VerifiedTelegramScope`, signed launch и `tma-v1:` не подделываются и Telegram entry/AD-26 не ослабляются. Новый scope не является авторизацией или изоляцией от любого same-origin кода, общей квоты либо origin eviction. Legacy DB names/schema/data, старые import/export/default policy и History не меняются.
- До принятия candidate его raw Project ID **точно отличается от source ID** и проверяется по обоим известным доступным stores; недоступная проверка запрещает import. Destination атомарно проверяет отсутствие и создаёт Project/Revision без overwrite и нарушения применимого no-ABA. Последовательный cross-store precheck не является атомарной гарантией глобальной uniqueness: concurrent/future старый producer может создать такой же raw ID. В этом случае две записи сохраняются раздельно и trusted `(namespace, raw ProjectId)` с generation направляет directory, open/edit/rename/delete, writer/takeover, History, pending/retry, recovery/repair, resources/library, оба exports и late async к правильному owner; неизвестный owner означает отказ/reselection. Не требовать недостижимой глобальной уникальности, уже заменённой owner-решением FR-45.
- Bounded registered decode → schema/domain/resource validation → применимый actual smoke → cancel → exact representability прежним browser backup **до новых IDs/pin/staging**. Валидный, но непредставимый файл отклоняется предусмотренным policy reason без подмены более ранней ошибки, без повреждения source/raw keys. Destination отдельно обеспечивает cross-context lock/fence/base, atomic stage/pointer/receipt, conditional no-publish, exact pin/root, unknown-commit reconciliation и сохранение undo/redo; при невозможности проверки — fail-closed без fallback к legacy. Каждый non-corrupt Durable Project новой области и его допустимые последующие edits/history сохраняют полный прежний offline FR-44 backup с ресурсами собственного owner. Cross-scope library copy требует verified bytes/hash/length и собственного pin/policy; исходник и чужие roots не удаляются.
- **Fresh-v0 — в принятой bounded модели:** обычная directory/probe не создаёт DB, а отсутствие сейчас означает `not-provisioned`, история неизвестна, не доказанную первую установку или потерю. Только явный registered import после validation/smoke/cancel/pre-ID representability может под тем же exclusive scope lock и valid generation атомарно создать текущую v0 schema/identity/counter; если конкурент уже создал DB, использовать проверенный existing reopen. Existing corrupt/foreign/missing metadata, future schema, известное исчезновение ранее подтверждённой DB или неизвестный ownership — read-only/recovery, без reset/fallback. Абортированный probe не оставляет DB; blocked/timeout/revoke обрабатывают поздние upgrade/success, in-flight transactions abort/drain под lock и unknown commit разрешается по receipt с сохранением roots. Восстановление старой valid-present DB может не вызвать versionchange: в проверенной модели кооперирующихся живых contexts доказать невозможность действия stale capability/attempt, а при недоказанности — fail-closed. Полный origin clear/eviction и неразличимый rollback не становятся доказательством восстановления данных или математической глобальной never-reuse.
- Merged directory показывает обе области различимо и доступно; partial unavailable не выдаётся за empty, доступная область продолжает безопасную работу. Старый PWA не видит новый namespace: обновлённая версия объясняет границу до rollback, а проверенный файл создаёт отдельную копию, не sync. Startup/manifest/schema/recovery и offline/update проверяются для обоих scopes независимо; одна исправная DB не доказывает вторую.

### До включения и статус P1

До writable ingress/DONE 10.5 обязателен отдельный native IDB двухконтекстный RED→GREEN и required mutation corpus: source-ID equality, precheck каждой DB и unavailable, forced ID/Revision/resource collisions, concurrent/future legacy producer и точные owner routes, quota/crash/commit/receipt, stale fences/takeover, fresh-v0/late callbacks/known loss/valid-present rollback, exact current/undo/redo roots, partial failure каждой области, pending same-source restart и сохранение другого candidate, полный scoped GLB → pin → reopen → edit → undo/redo → прежний offline backup → legacy reimport. Проверить supported old builds/cleanup и сохранение старых путей; при выносе host-neutral кода отдельно проходят прежние Telegram identity/storage/race suites. Исторические 124 Telegram checks не доказывают новый browser adapter.

Предыдущее **P1 no-overwrite для попытки записи в старую browser DB не объявляется CLOSED или исправленным**. AD-31 планирует иной изолированный путь; если старый trial ingress подключён, сам факт нового плана его не отключает и не делает безопасным. Новый route не включать до вышеприведённого локального evidence. Исходный риск legacy `put`/history не объявляется устранённым и не исправляется побочным DB upgrade. Фактическое состояние trial wiring нужно отдельно проверить владельцу реализации.

Story 10.5 AC12 прежними словами объединяет `first-use versus previously provisioned` и anti-ABA; читать это по актуальным SPEC/Architecture/UX как доказательство bounded lifecycle живых кооперирующихся contexts и честного unknown, не как невозможное доказательство first-ever/global never-reuse после полного внешнего clear. Owner stories следует уточнить этот текст и corpus при следующей синхронизации; конкретный допустимый transition и fail-closed предел уже заданы source owners, поэтому эта формулировочная неоднозначность не блокирует локальный TDD. Общие browser presentation preferences следует сохранить без изменения legacy ключей и явно проверить owner routing; не выдавать preferences за Telegram account isolation.

Текущие source contracts и test plan не являются подтверждением old-build inventory, фактического FR-44, реальных файлов, physical iOS/Android, Telegram acceptance или release. NFR-13 origin eviction risk сохраняется, S3 sole-copy и PPJ handoff имеют собственные gates. Product owner уже снял formal AssetUsageGrant gate; technical format/security/hash, pin/FPC и no upload/cloud сохраняются. Web/PWA, старые DB/history/checks, live preview и данные сохраняются; commit только с отдельного разрешения. В этом recheck code/config/tests не изменялись и tests не запускались.
