---
id: SPEC-interiors-editor-alpha
title: "InteriorsEditor: спецификация самостоятельно полезной альфы"
status: draft
owner: Roman
updated: 2026-11-22
companions:
  - glossary.md
  - geometry-contract.md
  - topology-corpus-contract.md
  - editor-interaction-and-grid-contract.md
  - asset-import-contract.md
  - performance-budgets.md
  - project-and-backup-contract.md
  - portable-backup-ingress-registry.md
  - ppj-a1-envelope-and-handoff.md
  - catalog-control-plane-contract.md
  - implementation-evidence-2026-08-18.md
  - telegram-platform-and-compatibility-contract.md
  - ../../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/addendum.md
  - ../../../contracts/alpha-release-ux-2026-11-01.md
  - ../../../contracts/alpha-release-ux-followup-2026-11-01.md
  - ../../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md
  - ../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-portable-v1-disposition-2026-11-04.md
  - ../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/browser-registered-storage-disposition-2026-11-05.md
  - ../../project-context.md
sources:
  - ../../planning-artifacts/briefs/brief-InteriorsEditor-2026-07-26/brief.md
  - ../../planning-artifacts/research/market-landscape-2026-07-26.md
---

# Kernel

## Why

На телефоне нет достаточно быстрого и предсказуемого способа проверить,
поместится ли планировка комнаты или небольшой квартиры в реальные размеры,
не переходя к desktop CAD и не жертвуя данными при нестабильной сети.

InteriorsEditor должен закрыть базовую работу планировщика на мобильном
устройстве: точно построить помещение, увидеть его в 3D, разместить реальные по
габаритам предметы и безопасно продолжить позже.

## Кого обслуживает альфа

Человека без CAD-подготовки, который самостоятельно планирует ремонт,
перестановку или оснащение квартиры и работает короткими сессиями на телефоне.
Альфа не заменяет архитектора, BIM/CAD, рабочую документацию и строительные
расчёты.

## Обещание альфы

> Самый быстрый способ точно проверить планировку квартиры прямо на телефоне:
> без установки из магазина, без CAD, в миллиметрах и даже офлайн.

«Самостоятельно полезная альфа» означает, что приглашённый пользователь может
без сопровождения создать один локальный проект с несколькими связанными
комнатами на одном уровне, расставить базовую мебель и оборудование, оценить
результат в 3D, закрыть приложение и восстановить работу. В S0–S7
Web/PWA сохраняется полностью, а Telegram Mini App добавляется на общем ядре;
доступ к одному локальному хранилищу между поверхностями не предполагается.

# Capabilities

## CAP-1. Локальные проекты и восстановление

**Намерение.** Пользователь владеет проектом; приложение не называет изменение
сохранённым до durable commit и само не удаляет Project без подтверждения.
Browser/OS storage остаётся best-effort, поэтому внешний backup обязателен.

**Успех.**

- проект создаётся, именуется, открывается и удаляется локально только после
  явного confirm; удаление окончательно и не имеет промежуточного lifecycle или
  восстановления;
- autosave фиксирует только согласованные доменные ревизии;
- аварийное закрытие восстанавливает последнюю Durable Revision;
- reopen current-schema Project с валидным замкнутым PlanGraph и отсутствующей
  Room metadata детерминированно materializes derived Rooms в одну новую Durable
  Revision, только если нет assets/Openings, требующих host reconciliation;
- пользователь может экспортировать переносимую резервную копию;
- отказ миграции или нехватка квоты не перезаписывает последнюю читаемую копию.
- browser tab и iOS Home Screen context не обещают общий store; между ними
  работает проверяемый export/import handoff.
- отдельный anonymous browser storage для нового registered import допустим по
  AD-31 при сохранении старых данных, owner-addressed операций и полного
  offline backup; неполный список не считается пустым хранилищем.

## CAP-2. Ограниченное редактирование плана

**Намерение.** На сенсорном экране можно строить точный план стенами по сетке,
включая диагонали клетки. В Telegram пользователь видит зазоры до стен при
перемещении предмета.

**Успех.**

- координаты и размеры доменной модели — целые миллиметры;
- 100-mm construction lattice видима внутри usable Room и ведёт ordinary touch
  candidate; её phase позволяет orthogonal 100-mm Wall визуально занять целую
  cell, а zoom меняет лишь major-line density;
- visual grid, её phase и SnapPolicy — только construction/presentation:
  они не persist-ятся и не переписывают каноническую геометрию; exact numeric
  endpoint/delta может быть вне сетки и явно остаётся exact non-grid;
- touch-кандидат строится от активной начальной точки с шагом `100 mm`, а
  valid integer-mm numeric endpoint/delta может быть вне этой сетки, но проходит
  тот же полный путь topology validation;
- один ephemeral fakeable `PlanProjectionPort` даёт воспроизводимый
  screen↔plan candidate; non-invertible/stale result сохраняет draft как
  `SelectionUnavailable` с retry/numeric path и не становится ошибкой размера
  или доменной мутацией;
- стена создаётся прямой с допустимым направлением, preview и точным размером;
- wall gesture начинается только явным non-zero drag либо точным numeric intent:
  tap/long-press отменённого черновика не выбирает направление по умолчанию и
  не создаёт ни сегмент, ни Revision;
- explicit valid segment может начинаться в свободной области PlanGraph, в том
  числе вне текущих Room; новая Room возникает только из derived closed Face;
- выбранный `WallSegment` может быть удалён независимо от того, замыкает ли он
  Face: получившиеся Room/Opening/surface/asset последствия проходят полный
  validation либо `ConflictPreview`, а не получают blanket-ban внешней стены;
- candidate wall body не пересекает retained rotated FloorPlacement footprint:
  `WALL_ITEM_COLLISION` оставляет base state и allocation intent пустыми, без
  silent move/delete/rehost предмета;
- length-only 45° ввод требует quadrant и до подтверждения показывает выбранный
  signed integer delta и фактическую quantized длину; supplied endpoint/delta
  сохраняет свои signs;
- точные T и иначе валидные X/junction contacts нормализуются в один
  атомарный Plan change с общей Vertex и необходимыми non-zero WallSegment;
  отдельного жестового или числового UI-маршрута split стены нет (FR-9, REL-08);
- перемещение вершины/стены либо атомарно создаёт допустимый план, либо не
  меняет модель;
- система не сохраняет нулевые, дублирующиеся, самопересекающиеся или
  неоднозначные сегменты;
- topology command доказывает accepted/reject/transient и inverse/no-mutation
  outcomes против versioned contract
  [TCC-A1](topology-corpus-contract.md), а не против legacy codec;
- масштаб и визуальная сетка не меняют геометрию;
- FR-59 показывает в Telegram до четырёх обновляемых расстояний от границы
  повёрнутого черновика напольного предмета до внутренней границы той же
  комнаты. Расстояния читаются в мм и вычисляются по принятой производной
  геометрии. Правила черновика и доступности задаёт
  [контракт редактора](editor-interaction-and-grid-contract.md).

Черновик напольного предмета в Telegram допускает точные расстояния в мм.
Один контакт редактирует предмет, два контакта управляют планом и сохраняют
позу предмета перед жестом. См. контракт редактора.

## CAP-3. Комнаты и параметры

**Намерение.** Замкнутые области становятся устойчивыми комнатами, которым
можно задавать человекочитаемые и физические свойства.

**Успех.**

- комнаты выводятся из граней плана детерминированно, включая valid void rings;
- повторное открытие не создаёт две конкурирующие repair-публикации: один
  controller coalesces concurrent open и сохраняет только согласованный
  Room-reconciliation результат;
- изменение границы с one-to-one lineage сохраняет свойства комнаты, если её
  идентичность можно однозначно сопоставить;
- валидная `AddWall`-команда, делящая Room, сразу materializes derived
  successor Rooms: каждый наследует точный `heightMm` своего predecessor;
  пользователь не выбирает левую/правую Room, `roomId`, имя, type или history;
- merge либо unresolved host/Opening/surface/asset ambiguity показывают preview
  и требуют явный безопасный выбор с fresh base/fence revalidation до
  allocation/complete candidate;
- пользователь изменяет тип комнаты и её высоту в мм; UI идентифицирует Room
  по типу, не предлагает редактировать имя и не показывает историческое имя
  на плане (FR-16, REL-05); сохранённое `Room.name` остаётся для совместимости,
  не переписывается при изменении типа/высоты и сохраняется при reopen;
- Room height является единственным пользовательским источником высоты
  помещения и производной высоты стен;
- площадь и периметр вычисляются, а не редактируются как независимые значения;
- парные revision-bound measurements покрывают длину/площадь/периметр и
  distance между точками или границами; stale result требует reselection,
  а один metric format совпадает в Preview/2D/3D/export;
- альфа поддерживает один уровень с несколькими комнатами.
- valid multi-room derived Plan даёт один и тот же набор room faces для 2D и
  disposable 3D projection; визуальный адаптер не может быть причиной потери
  валидной комнаты или недоступности переключателя 3D.

## CAP-4. Проёмы

**Намерение.** Двери и окна принадлежат стенам, соблюдают размеры и остаются
геометрически согласованными при изменениях плана.

**Успех.**

- проём имеет позицию на сегменте, ширину и высоту в мм;
- проёмы не выходят за стену и не перекрываются недопустимым образом;
- ActionDock даёт `Добавить проём` только после Wall selection; sheet предлагает
  `Дверь` или `Окно`, а межкомнатная Door,
  exterior entrance и Window используют один wall-hosted `Opening` route;
- удаление или изменение Wall/Opening автоматически сохраняет host только при
  единственном valid lineage; иначе preview предлагает подтверждённый rehome,
  delete или cancel без частичного перехода.

## CAP-5. Синхронные 2D и 3D

**Намерение.** 2D-план является канонической моделью, а 3D — всегда
воспроизводимой проекцией того же состояния.

**Успех.**

- подтверждённая команда приводит к согласованным 2D и 3D;
- переключение вида не создаёт доменную мутацию;
- Plan 2D/3D ViewSwitch в EditorTopBar и active ActionDock доступны вне
  overflow-меню и сохраняют одну Selection только для интерактивных Wall и
  AssetInstance; derived Room в обоих видах является display-only, не создаёт
  Selection, picker или property panel. Нижний ActionDock имеет один явный
  `Рука и выбор` control и не более трёх context actions; duplicate `Опции`
  submenu не существует. Этот control выбирает интерактивный объект и
  панорамирует пустой холст/поверхность Room; renderer gesture не владеет
  Project transform;
- потеря WebGL-контекста не повреждает проект и допускает пересоздание сцены;
- размеры, проёмы, предметы и разрешённые варианты предметов после reload
  совпадают;
- неподдерживаемое 3D не блокирует экспорт и диагностический доступ к проекту.

## CAP-6. Каталог и размещение

**Намерение.** Пользователь проверяет планировку на предметах с реальными
габаритами, не моделируя их самостоятельно.

**Успех.**

- каталог охватывает мебель, сантехнику, технику, свет и аксессуары;
- карточка до добавления показывает габариты, категорию, local front direction
  и честный renderer-family preview на neutral floor;
- Catalog Control Plane может публиковать versioned metadata/resources и
  hashes, но не принимает и не хранит
  Project, Revision, History или Portable Backup;
- экземпляр ссылается на неизменяемое определение ассета и хранит свою
  anchor-specific placement;
- предмет можно выбрать, переместить, повернуть, удалить и восстановить через
  undo;
- `yawStep` — единственный authority направления: 2D front marker и 3D
  silhouette/transform показывают одинаковую local `+Z` ориентацию;
- floor/wall placement адресует устойчивый host и предсказуемо реагирует на
  topology change; cross-anchor transfer требует compatibility и
  подтверждённой re-entry;
- Alpha не содержит назначаемых пользователем покрытий пола или стен:
  нейтральный пол и стены являются только display-проекцией геометрии.
- footprint и конфликт размещения видны в 2D;
- 2D и 3D move/rotate показывают один grid-snapped PlacementPreview с
  reachable cells и проходят один canonical command/inverse route;
- новое размещение становится Durable только после pin exact resource bytes в
  user-owned blob store и прохождения BackupFeasibilityPolicy;
- Alpha не моделирует licensing, provenance, grant/declaration, attribution
  или notice: владелец продукта поставляет только бесплатные или
  самостоятельно созданные модели вне приложения; catalog и custom resources
  проходят одинаковые technical preflight, pin и backup policy;
- неожиданно missing resource существующего Project заменяется
  диагностируемым placeholder и переводит Project в read-only
  `ResourceRecoveryRequired`, а не исчезает;
- выход из recovery возможен только через verified exact-byte restore либо
  один атомарный RecoveryChangeSet, после которого unresolved references нет.
- недоступность Catalog Control Plane затрагивает только browse/download ещё
  не pinned resource: Project со всеми pinned exact resources остаётся
  доступен для open, edit, Durable save, local undo/redo и Portable Backup;
  это не `ResourceRecoveryRequired`;
- FR-60 открывает в Telegram локальный каталог собственных условных пресетов
  с напольной или настенной опорой. В подготовленном редакторе доступны
  поиск, выбор, предпросмотр и размещение без внешнего каталога. Действующий
  параметрический путь сохраняет размеры, привязку, цвет и историю.
  Ранее сохранённые GLB и смешанные проекты сохраняют exact bytes, параметры,
  восстановление и Portable Backup. См. [контракт редактора](editor-interaction-and-grid-contract.md).

Кольцо напольного предмета доступно в 2D и 3D. В Telegram управление цветом
выполняется в 3D. Разблокировка записи произвольного угла зависит от точной
совместимости проекта и Portable Backup.

## CAP-7. Варианты предметов

**Намерение.** Пользователь сравнивает разрешённые цветовые и иные варианты
предметов, не меняя их габарит, привязку и геометрию помещения.

**Успех.**

- изменить можно только явно объявленный вариант `AssetInstance`;
- в Telegram именованные образцы FR-60 используют допустимые пары `colorVariantId`
  и `color` действующего V1, которые сохраняют смысл после Undo/Redo, открытия
  проекта или переноса;
- изменение варианта — одна обратимая команда и не меняет footprint, host или
  геометрию помещения;
- exact referenced runtime resource pin-ится и проходит BackupFeasibilityPolicy до Durable
  публикации, когда вариант требует отдельный ресурс;
- renderer может использовать детерминированный low-fidelity fallback, не
  удаляя pinned source resource;
- Alpha не создаёт legal/attribution metadata; техническая пригодность
  catalog resource определяется exact bytes, hash, pin и backup feasibility.
- `SurfaceAssignment`, `Floor(Room)` и `WallSide` не являются пользовательской
  моделью: нейтральная визуализация пола и стен не создаёт durable assignment.

## CAP-8. Безопасная история изменений

**Намерение.** Пользователь экспериментирует без страха повредить план.

**Успех.**

- только валидированный complete ChangeSet может войти в
  `PendingDurability`; parsing/normalization/topology/validation reject не
  создаёт `PendingDurability`, History entry, autosave или canonical projection;
- каждое подтверждённое пользовательское намерение, прошедшее validation,
  публикуется как одна атомарная Command;
- только Durable Revision попадает в undo/redo и считается saved;
- undo/redo текущей сессии восстанавливает полное согласованное состояние;
- exact resource hashes всех Revision в undo- и redo-ветках являются GC roots;
  `SessionRetentionPolicy` отклоняет новую команду до mutation, если сохранить
  обратимость в пределах мобильного storage нельзя;
- history-only resource corruption не обрезает redo молча: пользователь
  восстанавливает exact bytes либо явно подтверждает
  `DiscardSessionHistory`, если current Project healthy;
- недопустимая команда не оставляет частичных изменений;
- post-validation persistence failure остаётся отдельным состоянием: current
  Durable Revision и History не меняются, pending candidate доступен только
  для retry/recovery export, а следующий mutating commit fenced;
- autosave не разрывает границу команды;
- reload/reopen, миграция, recovery и import начинают видимую новую
  границу session history.
- ChangeSet/inverse остаются semantic candidate inputs, а Durable Revision и
  HistoryEntry появляются только после atomic publication; pin staging roots
  переживают crash/GC до этого outcome.

## CAP-9. Устанавливаемая offline PWA — Browser/PWA

**Намерение.** Основной сценарий работает на поддерживаемом телефоне в браузере
и standalone без обязательной сети.

**Успех.**

- app shell запускается после успешного первого посещения offline;
- уже использованные базовые ассеты доступны offline;
- установка не обязательна для первого полезного результата;
- обновление service worker не прерывает активную несохранённую сессию;
- capability detection даёт понятный fallback для platform APIs.
- install UX не зависит от автоматического prompt и объясняет отдельный local
  context iOS Home Screen до создания проекта.

## CAP-10. Переносимость проекта

**Намерение.** Пользователь может вынести полный проект за пределы browser
storage и открыть его в другом локальном контексте.

**Успех.**

- переносимый backup self-contained: содержит canonical Project, semantic
  metadata и exact referenced catalog/custom resources;
- backup содержит версию схемы, контроль целостности и технические resource
  descriptors/hashes; применимые лимиты проверяются по зарегистрированному формату;
- каждый non-corrupt Durable Project текущей policy экспортируется без сети;
- импорт backup полностью валидируется в защищённом staging и атомарно
  публикуется как отдельный Project с raw ID, отличным от source ID;
  существующий Project никогда не перезаписывается. При нескольких локальных
  namespaces идентичность записи включает namespace; правила проверки ID,
  staging и recovery нового browser ingress — в Project/Backup contract §1.4;
- `project/project.json` проходит closed raw-byte registry и выбранный bounded
  parser до domain construction: PPJ-A1, точный V1-wire или V1-legacy с
  обязательным disjoint witness. PPJ AST-R1 и его порядок ошибок не меняются;
  остальные V1/V2 fixtures остаются в [TCC-A1](topology-corpus-contract.md)
  без implicit promotion или migration;
- явно выбранный пользователем Web/PWA registered-transfer ingress может
  импортировать поддерживаемый V1-wire через общий strict use case, сохраняя
  прежние browser import/export действия и проверки; до изменения данных этот
  маршрут отклоняет файлы, точная представимость которых прежним exporter не
  доказана. Browser default policy и существующая History не меняются. Без всех
  policy/resource checks совместимость файла не заявляется;
- для S3 допускается дополнительный явно выбранный Web/PWA export в
  registered V1-wire, включая пустой Project, без замены прежнего backup;
  UX и Architecture определили действие и его размещение; применимый gate и
  доказательство фактического переноса остаются отдельными условиями;
- формат проекта и подтверждённая матрица совместимости документированы;
  source-owner disposition и доказательства до S3 остаются открытыми: наличие
  одинакового schema label у baseline и PPJ-A1 не доказывает их совместимость.
  См. [платформенный контракт](telegram-platform-and-compatibility-contract.md).

## CAP-11. Адаптивная производительность

**Намерение.** Продукт остаётся управляемым на целевом мобильном устройстве,
снижая визуальное качество раньше, чем точность доменной модели.

**Успех.**

- Product Owner подтвердил `NFR-15` functional-путь на iPhone 15 Pro Max и
  Samsung S24 Ultra в browser и installed-PWA contexts;
- рендеринг по требованию прекращает постоянную нагрузку в статике;
- деградация снижает DPR, тени, качество текстур и детали, но не мм и topology;
- тяжёлые вычисления дают видимый progress/cancel, когда это требуется;
- при подготовке ссылочной модели в 3D Telegram сохраняются сцена, камера и
  положение предпросмотра. Запрос можно отменить, а при сбое доступен штатный
  путь повтора или восстановления. Холодная, медленная и тёплая загрузка
  проверяются по [контракту редактора](editor-interaction-and-grid-contract.md);
- WebGL2 — базовый контракт альфы, WebGPU не требуется; capability fallback
  остаётся для неподдерживаемого API;
- после каждого изменения green Playwright regression обязателен для
  browser/mobile/PWA/offline flows; аппаратный benchmarking остаётся
  необязательной инженерской диагностикой.

## CAP-12. Ограниченный импорт GLB — Alpha+

**Намерение.** Пользователь добавляет собственный предмет, не подвергая проект
неограниченному файлу и сложной цепочке форматов.

**Успех.**

- принимается только self-contained GLB;
- до включения в проект проверяются размер файла, декодированная геометрия,
  текстуры, материалы, анимации и внешние ссылки;
- импорт статичен, выполняется с отменой и изолирован от канонической модели;
- пользователь подтверждает габариты, ось вверх, footprint и точку опоры;
- отказ не оставляет частичный ассет и объясняет нарушенный лимит.

## CAP-13. Telegram Mini App на общем локальном редакторе

**Намерение.** Пользователь читает условия до начала работы в Telegram, безопасно
продолжает локальную работу в своей области и отдельно решает, участвовать ли
в подсчёте повторного использования на этом устройстве. Общий подсчёт открытий
можно отключить до входа. Web/PWA сохраняется для совместимости.

**Успех.** Поддержанный подписанный запуск выбирает изолированный scope до
открытия хранилищ; принятые действия дают эквивалентные доменные результаты.
Back, Close, lifecycle и viewport безопасно обрабатывают draft, pending и
последнюю Durable Revision; первая writable S2 операция возможна только после
полного cross-context fencing/receipt/pin протокола AD-4/AD-26, а неопределённые
записи и bytes сохраняются. После online запуска и подготовки нужных компонентов работа
может продолжаться без сети. Ошибки host/identity и неподготовленные ресурсы
показывают честное состояние без общего writable fallback. Стандартный Telegram
импорт использует зарегистрированный Portable Backup route без non-ZIP JSON
fallback; отдельный явно выбранный RecoveryDraft остаётся recovery. Двусторонний перенос
внешним `.interiors` подчинён CAP-10 и его открытому gate. Три документа доступны
до входа и в настройках. Обычная сборка предъявляет самостоятельную редакцию с
первого публичного распространения этой версии. Новые правки требуют явного
акцепта её точного текста. При отказе владелец проверенной области видит прежние проекты и
может экспортировать здоровые в пределах возможностей сборки. Отказ от участия
в исследовании сохраняет доступ к редактированию, сохранению и экспорту.
FR-55–61, NFR-21/28/29, UXF-8/9 и AD-25–34 конкретизированы в
[платформенном контракте](telegram-platform-and-compatibility-contract.md).

# Constraints

1. Продукт mobile-first: Web/PWA и дополнительный Telegram Mini App разделяют ядро; desktop не определяет UX. CAP-9 и FR-41 сохраняются для Web/PWA. Новая реализация Telegram требует согласования planning package и нового применимого READY либо отдельного письменного waiver.
2. Доменная геометрия хранится целыми миллиметрами; lossless ingress canonical
   Project JSON валидирует raw numeric lexeme до host-number coercion по
   closed registry и format-specific bounded envelope (PPJ AST-R1 либо V1 scanner)
   [portable-backup-ingress-registry.md](portable-backup-ingress-registry.md),
   а renderer может использовать метры только на адаптерной границе.
3. Каноническое состояние не принадлежит Three.js/Babylon, React или GPU.
4. Альфа — один уровень; многоэтажность, лестницы и кровля вне scope.
5. Допустимые направления стен — ровно восемь cardinal/45° directions;
   недопустимый delta отклоняется, а не исправляется nearest-angle rounding.
6. Browser/PWA local-first сценарии не требуют аккаунта или сети; Telegram требует проверенный локальный account scope и может требовать сеть для cold launch. Catalog Control
   Plane допустим только для metadata/resources и hashes; он не является
   backend для пользовательского Project, а его недоступность не создаёт
   recovery/read-only state.
7. 3D альфы ориентирован на пространственную проверку, не на фотореализм.
8. В Alpha отсутствует юридический контроль моделей: content selection
   ограничен бесплатными или self-authored моделями владельца продукта вне
   приложения.
9. Любая мутация топологии, предмета или материала проходит через команду.
10. `NFR-15` для Alpha — уже выполненная функциональная проверка Product Owner
    на iPhone 15 Pro Max и Samsung S24 Ultra; нет отдельной exact-device,
    thermal, RS-2 или независимой-review release gate.
11. Door semantics Alpha ограничены wall-hosted Opening: состояния `passable`,
    `locked`, access control, key, lock/unlock и open/close не существуют в
    домене, UI или API, как и navigation edge/transition между Room.
12. Visual grid, её phase, zoom, construction-only `SnapPolicy`, направляющие
    FR-59 и live `DraftCommand` не входят в Project, Revision, History,
    persisted Command или Portable Backup;
    Durable Revision хранит только resolved integer endpoints и не
    re-normalizes later policy.
13. Exact arithmetic, PlanProjectionPort, MeasurementRequest, candidate
    allocation intent, diagnostics и renderer objects — ephemeral projections;
    ChangeSet/inverse не independently durable, а ConflictPreview для
    неразрешённого safety-выбора всегда revalidates current base Revision и
    writer fence before materialization.
14. Newly pinned bytes защищены repository PinStagingLease до atomic
    publication либо recorded cleanup и не становятся Project/History/Backup
    schema; licensing/proof route не является Alpha state или gate.
15. Domain-owned constrained `PlanGraph` kernel — единственный authority для
    `SafeIntegerMm` ingress, 0°/45° directions, exact-contact normalization,
    derived Face/usable geometry, Room/Opening lineage, allocation intent/inverse
    и stable reason outcomes. External geometry engine остаётся immutable
   test-only oracle/fixture; [TCC-A1](topology-corpus-contract.md) фиксирует
   V1/V2 fixture quarantine, diagnostic byte handoff и future migration
   admission. Зарегистрированный portable V1-legacy с disjoint witness —
   отдельный узкий путь, не topology fixture и не fallback decoder. Legacy fixture не может быть
   silently reinterpreted, discarded, promoted или стать production handoff.
16. Обычная сборка по умолчанию считает проверенные входы в редактируемую TMA.
    Пользователь может отключить всю статистику до первого события и в настройках.
    Только отдельное согласие на точную редакцию формы позволяет устройству
    учитывать повторный вход своей проверенной области. В отчёт входят два суточных
    числа без пользовательского кода. Для публичного включения требуется основание
    обработки сетевых сведений. Прежние персональные события имеют отдельную историю.

# Non-goals альфы

- BIM/IFC, DXF/DWG, строительные чертежи и расчёт конструкций;
- несколько этажей, лестницы, сложные крыши и ландшафт;
- AR-сканирование, LiDAR и автоматическое распознавание плана;
- фотореалистичный renderer, ray tracing и WebGPU-only путь;
- совместное редактирование, комментарии, аккаунты и облачная синхронизация;
- server-side хранение, восстановление или синхронизация User Project,
  Revision, session History либо Portable Backup; автоматическая отправка боту; upload Project/GLB/backup;
- сметы, магазины, checkout и рекламный marketplace;
- произвольное моделирование mesh;
- импорт OBJ/FBX/DAE/USDZ в альфе;
- неограниченная пользовательская геометрия;
- access control Door, keys, `passable`/`locked` state, lock/unlock и
  open/close interaction;
- in-app Focus, native fullscreen и специальные fullscreen/viewport controls;
- выбор successor Room при wall-induced split для сохранения `roomId`, имени,
  type, height или history: split автоматически наследует только `heightMm`;
- генеративный AI как необходимая часть основного сценария.

# Success signal

Альфа готова к приглашённым пользователям, когда Product Owner подтвердил
функциональный путь `NFR-15` на iPhone 15 Pro Max и Samsung S24 Ultra, а
автоматизированные проверки сохраняют ту же Durable Revision после аварийных
и WebGL recovery paths. RS-1/RS-2 budgets — инженерская диагностика, а не
release gate для исторической Web/PWA Alpha. Для Telegram отдельно требуются
NFR-28 и применимые release evidence, включая внешний roundtrip на iOS/Android;
историческое принятие не является Telegram READY. CAP-12 не блокирует альфу,
пока владелец продукта явно не повысит её приоритет.

В сценарии пилота FR-59–61 приглашённый пользователь в Telegram создаёт комнату,
уточняет расстановку по зазорам, меняет цвет условного предмета, сверяет 3D и
снова открывает сохранённый проект. Отключение всей статистики
сохраняет весь этот сценарий. Пользователь также может отдельно отозвать
согласие на дополнительную статистику в настройках.
Готовность каждого среза и физическая приёмка проверяются отдельно.

# Assumptions

- Первый пользователь вводит размеры вручную; сканирование не требуется.
- Один проект альфы описывает один уровень небольшой квартиры.
- Действующий Web/PWA representative catalog содержит ориентировочно 100–150
  обобщённых предметов. Для Telegram набор локальных пресетов определяется
  покрытием категорий и привязок FR-60.
- Collision в альфе предупреждает и визуализирует; не все пересечения обязаны
  жёстко блокироваться.
- Импорт GLB полезен, но безопаснее вынести в Alpha+ после проверки storage и
  renderer.
- AD-26 identity и AD-28/29 release/file решения — инженерные assumptions
  Spine; их наличие не является human approval или physical evidence.

# Open questions

Владелец 2026-11-04 разрешил прежний source conflict: formal AssetUsageGrant
и иные licensing/provenance/admission gates не требуются; AGENTS согласован с
PRD/SPEC/AD-14. Exact resource/security/hash/pin и запрет upload сохраняются.

1. Какой optional external test-only geometry oracle/fixture adapter, его
   version и TCC-A1 corpus revision независимо проверят adopted domain-owned
   `PlanGraph` kernel без подмены policy library default-ом?
2. Должен ли source-owning контракт канонизировать delegated working policy
   `D-014` для collision tiers; это AD-7 обновление не меняет collision scope.
3. Какой минимальный каталог покрывает конкретные alpha-сценарии?
4. Нужны ли сохранённые варианты проекта или достаточно backup + undo?
5. GLB обязателен до закрытой альфы или является Alpha+?
6. Подтверждены ли основание и технические условия обработки сетевых сведений
   для двух суточных показателей, прекращение прежних персональных потоков и
   исполнение запросов о ранее переданных данных у получателей? Условия
   публичного введения закреплены в [платформенном контракте](telegram-platform-and-compatibility-contract.md).
7. Доказан ли exact recovery для неоднозначного old V1 и иных sole-copy вне
   закрытой grammar? Доказаны ли FR-44 exportability всех non-corrupt Durable
   Project текущей policy, worst-case bounds и реальные build/file pairs?
   Если доступный recovery невозможен, Product/source owners решают условное
   ограничение до зависимой приёмки; форматная регистрация не является evidence.
8. Кто и как закроет PPJ manifest/ledger/resource bindings и техническую
   семантику wire-поля `proofRef` без формального licensing/proof gate? До этого
   PPJ handoff не является принятым Project.
9. Доказаны ли signed identity, account separation, lifecycle и внешний файловый
   roundtrip на целевых клиентах; какой отдельный выбор владельца нужен, если
   локальный handoff невозможен?
# Verification map

Трассировка CAP → FR/NFR → slice → evidence находится в
`../../planning-artifacts/traceability-matrix.md`. Ни одна capability не
считается реализованной только по наличию UI: требуется доменная, browser,
offline и, где применимо, device/performance-проверка.

`FR-53` и `NFR-27` retired 2026-08-24 вместе с in-app Focus/native
fullscreen; эти идентификаторы не переиспользуются и не входят в текущую
verification map. `NFR-15` через CAP-11 закрыт Product Owner functional-
проверкой на двух принятых телефонах; Playwright закрепляет обязательную
browser/mobile/PWA/offline регрессию, а detailed performance traces остаются
необязательной диагностикой.

Для CAP-2–CAP-4 и CAP-8 adopted `AD-20` требует versioned corpus
domain-owned `PlanGraph` kernel по
[TCC-A1](topology-corpus-contract.md); optional external engine участвует
только как immutable test-only oracle/fixture и не является canonical topology
authority.

Для Telegram CAP-13 и применимые CAP-1–8/10–11 трассируются к FR-55–58, NFR-28 и AD-25–30; downstream Epic 10, roadmap и traceability обновлены, включая TMA-01–16 и TMA-AC-01–13. Epic 10 оценён NEEDS_WORK, отдельный S1 выполнен; актуальные S2/S3 изменения ожидают независимого readiness recheck. Матрица поверхностей и границы evidence — в платформенном companion.

Для FR-59–61 и NFR-29 применяются AD-32–34. Каждый срез проверяется через
Playwright MCP на изолированном Telegram runtime после изменений. Доказательства
переноса, тача, жизненного цикла и реальной Метрики описаны в соответствующих
компаньонах. Эти обновления SPEC задают критерии для отдельной проверки BMAD
implementation readiness.
