# Канонический глоссарий

Этот глоссарий определяет язык спецификации, кода, тестов и интерфейса.
Синонимы допустимы в пользовательском тексте, но не должны порождать вторую
доменную сущность.

| Термин | Каноническое определение | Не означает |
|---|---|---|
| Project | Версионируемый корень одного локального плана и его ассетов в состоянии Active | аккаунт, облачную папку |
| Revision | Целостный сериализованный результат валидированных Command; публикуется как current только после состояния Durable | произвольный autosave в середине drag |
| PendingDurability | Валидированная candidate Revision, запись которой ещё не подтверждена repository | saved/committed state |
| Durable Revision | Revision, staging-write, checksum и atomic pointer swap которой успешно завершены | гарантию против внешнего удаления browser storage |
| Level | Единая горизонтальная плоскость пола с набором стен и комнат | этаж здания с лестничной моделью |
| Plan | Канонический 2D planar graph уровня | изображение, 3D-сцена |
| PlanGraph kernel | Domain-owned constrained kernel, который единолично применяет `SafeIntegerMm` ingress, допустимые направления, topology, derived Face/usable geometry, lineage, allocation intent/inverse и stable reason outcomes | renderer, geometry library или legacy fixture как второй authority |
| Test-only geometry oracle/fixture adapter | Immutable adapter для differential/golden corpus против результата `PlanGraph kernel` | ID allocation, Command/publication path, reason-code authority или canonical mutation |
| SafeIntegerMm | Signed safe integer в миллиметрах, прошедший lossless raw-lexeme ingress и final safe-integer guard | float, unitless Number или persisted `BigInt` |
| Vertex | Узел плана с координатами `x,z` типа `SafeIntegerMm` | Three.js Vector3 |
| WallSegment | Ориентированная центральная reference line между двумя различными Vertex; толщина распределена по сторонам | готовый 3D mesh или внутренняя грань стены |
| Face | Замкнутая ограниченная область planar graph | пользовательская комната до сопоставления |
| Room | Идентифицированная Face с единственной пользовательской высотой и производным usable polygon по внутренним чистовым поверхностям | любой визуально замкнутый mesh или независимый редактируемый polygon |
| Opening | Параметрический вырез, привязанный к WallSegment | свободно стоящая модель двери |
| Door | Opening с kind `Door`, принадлежащий WallSegment и проходящий обычную геометрическую/host validation | независимые `passable`/`locked`/access/key/open/close state, navigation edge или телепорт без связи со стеной |
| Window | Opening с kind `Window`, принадлежащий WallSegment и проходящий обычную геометрическую/host validation | прозрачная текстура стены |
| AssetDefinition | Неизменяемые метаданные и ресурсы типового предмета | размещённый предмет |
| AssetInstance | Экземпляр AssetDefinition с anchor-specific placement и разрешёнными вариантами | копия всего бинарного файла или устаревший UX/PRD-синоним `ItemInstance` |
| Footprint | 2D-проекция занимаемой предметом области на пол | визуальная тень |
| Anchor | Семантический класс размещения: floor или wall | координата камеры |
| Placement | Discriminated `FloorPlacement` или `WallPlacement` с host и локальными координатами | свободная renderer transform без хозяина |
| SurfaceAddress | Стабильный доменный адрес пола, стороны стены или material slot предмета | индекс произвольного triangle |
| Surface | Адресуемая через SurfaceAddress часть комнаты/предмета для материала | произвольный triangle |
| MaterialPreset | Проверенный набор визуальных параметров и текстур | строительная спецификация материала |
| Command | Атомарное намерение изменить Project; только его validated complete ChangeSet может перейти к durability | pointer event или setter |
| Validated ChangeSet | Полный candidate после parse/normalization/topology/Plan/Room/Opening/host validation; единственный вход в `PendingDurability` | Durable Revision, пока staging/pointer swap не завершились |
| DraftCommand | Неподтверждённый current-session-only preview, не входящий в Revision или Portable Backup | частично сохранённая команда или portable history |
| History | Сессионная undo/redo-цепочка только Durable Command; обе ветки удерживают свои Revision/resource manifests как GC roots и не входят в Portable Backup | бесконечный или cross-device event log |
| SessionRetentionPolicy | Предварительная проверка общего entry/bytes envelope current + undo + redo до принятия новой Durable Command | молчаливую обрезку уже обещанного redo |
| Canonical model | Независимое от UI/renderer состояние проекта | scene graph |
| Projection | Воспроизводимое 2D/3D-представление canonical model | второй источник истины |
| Grid | Infinite visual construction lattice с постоянной 100-mm minor-cell и zoom-dependent major-lines; presentation phase может совместить edges orthogonal 100-mm Wall с minor cell | persisted global-coordinate lattice или правило привязки само по себе |
| Snap policy | Construction-only candidate-selection policy для gesture; config/identity не persist-ится | durable geometry, Portable Backup или library default для D-022 |
| EditorTopBar | Persistent header editor-а: Back, Project title, durability status и Plan 2D/3D ViewSwitch; view switch не создаёт Command или Revision | overflow-only navigation или вторая command rail |
| ActionDock | Нижняя safe-edge DOM-панель команд. Один режим выбора и панорамирования («Выбор» в TMA, `Рука и выбор` в исторической Web/PWA) и до трёх контекстных действий. ViewSwitch принадлежит EditorTopBar | второй вертикальный rail, header-only overflow menu или набор hotkeys без touch alternative |
| PlacementPreview | Ephemeral projection выбранного placement с host, grid position, rotation, footprint, collision и reachable cells до canonical command confirmation | durable AssetInstance transform, History entry или persisted collision cache |
| Neutral room projection | Display-only default tone/material for derived floor and walls; it is not a user-managed resource or durable assignment | новая Room metadata, `SurfaceAssignment` или source geometry |
| DimensionLayoutPolicy | Revision-bound presentation rule, размещающая dimension label внутри object только без collision, иначе снаружи с tick/leader | изменение measured geometry, perimeter или area |
| Constraint direction | Разрешённое направление сегмента | автоматически исправленный план |
| MeasurementFormatPolicy | Один product-owned seam, который форматирует Preview, 2D, 3D и export из одинакового exact squared length | locale/precision default отдельного renderer-а или formatted geometry input |
| Legacy topology/Project V1/V2 fixture | Pre-canonical bytes, которые TCC-A1 классифицирует как readable, unmappable или unreadable; current ordinary import получает `BACKUP_SCHEMA_UNREADABLE` только внутри otherwise valid, checksum-valid, AST-R1-admitted current envelope, иначе сохраняется ранний `BACKUP_*` reason. Fixture допускает лишь original-byte diagnostic/export handoff; `RecoveryChangeSet` его не преобразует | `MeasurementFormatPolicy V1`, canonical Project schema, automatic migration, pin/ID/Revision/Project publication, recovered Project, production handoff или source of topology authority |
| TCC-A1 topology corpus | Source-owned versioned manifest golden/property/hostile topology fixtures, legacy classification и deterministic accepted/reject/transient/no-mutation expectations for adopted domain-owned PlanGraph | implementation proof by itself, selected external geometry runtime, new stable reason-code union или `READY` verdict |
| Valid plan | Plan, удовлетворяющий всем геометрическим инвариантам | план без бытовых неудобств |
| Collision | Обнаруженное пространственное пересечение footprints/объёмов | всегда блокирующая ошибка |
| Reference scene | Версионируемый проект для performance-сравнения | красивый demo без фиксированного состава |
| Portable backup | Самодостаточный versioned `.interiors` bundle с зарегистрированным PPJ-A1, V1-wire или witness-qualified V1-legacy Project в mandatory `project/project.json`, exact referenced resources, checksums и применимыми limits | screenshot, semantic report, alias пути, implicit legacy promotion или список CDN-ссылок вместо bytes |
| Portable Project schema registry | Source-owned closed selector/legacy witness, format-specific Project grammar и bounded parser, raw traversal и reason precedence для `project/project.json`; PPJ AST-R1 остаётся неизменным | internal repository encoding, inferred object shape, bare schemaVersion или доказанная production compatibility |
| Catalog Control Plane | Ограниченная серверная граница для versioned catalog metadata/resources и hashes | account, User Project/Revision/History/Backup service, sync или collaboration |
| Offline-ready / backup-ready resource | Exact referenced runtime bytes, pinned в user-owned blob store и учтённые BackupFeasibilityPolicy | browse cache, authoring source или одна metadata-карточка |
| Resource issue | `Missing`, `HashMismatch`, `MediaInvalid`, `DecodeInvalid` либо `PortabilityMetadataMissing` для referenced resource | допустимый low-quality LOD |
| ResourceRecoveryRequired | Read-only состояние с unresolved Resource issue; edits/undo/redo заблокированы, backup — только при scope `CurrentProject \| Both`, но доступен для verified healthy current при history-only issue | потерю canonical geometry или автоматическое удаление предмета |
| RecoveryChangeSet | Один staged набор удаления/безресурсной замены всех unresolved references, публикуемый только как полностью valid и backup-ready Durable Revision | частичную repair Revision |
| DiscardSessionHistory | Явно подтверждённый сброс обеих session History-веток для выхода из history-only resource recovery при healthy current Project | автоматическое исчезновение undo/redo или Project Revision |
| Confirmed Project deletion | Явно подтверждённое окончательное удаление Project и его owned Revision; общие resource bytes позднее оценивает global GC | промежуточный recovery state, undo или автоматическое удаление Project |
| Local context | Изолированное browser/standalone хранилище; на iOS Safari и Home Screen могут быть разными контекстами | синхронизированный аккаунт |
| App shell | Минимальный набор PWA для запуска UI | весь каталог и все 3D-ассеты |
| Alpha | Самостоятельно полезный продукт по CAP-1–CAP-11 | публичный production |
| Alpha+ | Следующий слой риска, включая CAP-12 GLB | обязательная часть Alpha без решения владельца |

## Единицы

- длина доменной модели: целый миллиметр (`mm`);
- площадь: вычисляется из мм², отображается в м² с явным округлением;
- угол: хранится в целочисленном дискретном представлении, формат уточняет
  geometry contract;
- renderer: адаптер переводит `1000 mm` в `1 scene metre`;
- размер файла: байты; пользовательский интерфейс может показывать MiB.

## Запрещённые неоднозначности

- `room` нельзя использовать для незамкнутого набора стен;
- `model` без уточнения означает canonical model, не glTF;
- `save`/`saved` означает только достигнутую `Durable Revision`;
- `offline` не означает, что никогда не использованный asset уже закэширован;
- `3D import` в текущей спецификации означает только GLB по контракту Alpha+.
