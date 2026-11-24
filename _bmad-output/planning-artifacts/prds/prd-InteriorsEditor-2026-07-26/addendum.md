---
title: PRD Addendum — InteriorsEditor Alpha
status: draft
created: 2026-07-26
updated: 2026-11-23
---

# PRD Addendum

## Why Alpha Is Split into Entry and Alpha+

Владелец продукта определил alpha как самостоятельно используемый продукт, закрывающий базовую потребность планировки. Custom import полезен, но не является обязательным для этого определения и несёт отдельные memory/security/asset-persistence риски. Поэтому:

- **Alpha entry** доказывает core planning loop;
- **Alpha+** добавляет constrained GLB import после evidence spike;
- readiness для Alpha entry не блокируется import, если Parametric Placeholder позволяет проверить реальный размер отсутствующего объекта.

Если интервью покажут, что собственная модель является главным entry requirement, это решение пересматривается через PRD update → bmad-spec re-derive → architecture/roadmap update.

## Approved Geometry Interaction Baseline — D-011…D-013

Следующее — утверждённое продуктовое поведение, отражённое в `FR-7`–`FR-13`
после канонического принятия `AD-7`. Это не выбирает geometry kernel и не
заменяет SPEC/Architecture contract.

- «Гридфинити» означает бесконечную editor grid, а не Gridfinity storage.
- Базовый touch candidate строится с шагом 100 mm от active gesture origin;
  он не создаёт persisted global-coordinate lattice.
- Визуальная grid может показывать 100/500/1 000 mm cells по zoom, но не
  переписывает канонические координаты или уже подтверждённый Plan.
- Разрешены четыре ортогональные и четыре 45° diagonal directions. Exact
  numeric input допускает любой integer-mm off-grid endpoint/delta, если он
  проходит те же direction и complete geometry invariants.
- Для length-only diagonal пользователь выбирает quadrant; integer endpoints
  используют `n = round(L / √2)`, а preview раскрывает actual quantized value
  до подтверждения.
- Иначе валидное exact X, как и exact T, атомарно образует одну общую Vertex и
  необходимые non-zero Wall segments; invalid contact не создаёт partial Plan.
- Preview, 2D, 3D и export должны показывать диагональ через одну общую
  product formatting policy; formatted value не является geometry input.

Продуктовые outcomes `D22-01`…`D22-10` теперь принадлежат PRD: touch/numeric
selection должен быть воспроизводимым, conflict проходит preview → явный выбор
→ revalidation, допустимые holes сохраняются, а stale/отменённый результат не
становится mutation. Канонические owner-документы ещё должны опубликовать
точные contract/corpus evidence. Выбор geometry kernel/library, transport и
implementation остаётся вне PRD; никакой library default не заменяет
опубликованные правила eligibility, equal-tie, hysteresis и formatting.

## Still-Provisional Numeric Defaults

Эти defaults не являются утверждённым requirement и требуют подтверждения на
реальных планах до stories:

- renderer conversion: `1 m = 1000 mm`;
- wall thickness default: `100 mm`;
- room height default: `2700 mm`.

## Approved Device Acceptance Boundary

Историческая восьмиконтекстная матрица заменена решением владельца от
2026-08-29: `NFR-15` фиксирует уже выполненную функциональную проверку двух
телефонов в browser/PWA, без quantitative performance/thermal release gate.
Для Telegram требуется отдельная физическая evidence по `NFR-28`; прежняя
проверка и эмуляция её не подменяют.

## Catalog Acceptance

Каталог считается достаточным не по числу моделей, а если alpha usability corpus можно выполнить без custom import:

- спальня;
- гостиная;
- кухня/обеденная зона;
- ванная;
- бытовая техника;
- электронная техника;
- освещение;
- ковры, зеркала, картины и растения.

Каждая модель проходит технический asset contract: format/size/hash, exact pin
и backup feasibility. Владелец продукта заранее отбирает бесплатные или
созданные им модели; branded product, цена и availability не обещаются.

## Approved Alpha Catalog Control-Plane Boundary

Владелец продукта утвердил Kotlin/PostgreSQL как реализацию **узкого**
Catalog Control Plane Alpha. Это техническое решение поддерживает продуктовую
границу `FR-54`, `NFR-10` и `NFR-21`, а не добавляет облачный контур для
пользовательских проектов.

Разрешённая роль control plane:

- публиковать и отдавать versioned catalog metadata/resources;
- нести content version/hash и resource descriptors для curated catalog
  resources.

Владелец 2026-11-04 подтвердил действующее правило PRD/SPEC и обновление AGENTS:
формальные лицензирование, provenance, `AssetUsageGrant`,
`assetUsageDeclaration`, attribution, notices и rendered-output rights не
являются Alpha admission gate; владелец отбирает бесплатные или собственные
модели вне приложения. Прежний конфликт источников разрешён. Сохраняются
техническая validation ресурсов, security, hashes, exact pin и backup feasibility;
серверная передача Projects и пользовательских файлов без отдельного
согласования не разрешена.

Из этого решения намеренно исключены account identity, remote Project sync,
collaboration, а также server-side приём, хранение, восстановление или
портирование User Project, Revision, session History и Portable Backup. PRD
не определяет API, transport, physical resource distribution, hosting, SLA,
telemetry или retention policy этой реализации.

Продуктовое следствие: доступность сервиса нужна только для поиска или
получения ещё не pinned catalog resource. Когда exact referenced bytes уже
pinned в local user-owned storage, existing Project можно открыть,
редактировать, durable-save, вести local undo/redo и экспортировать в
Portable Backup без сервиса. Недоступность control plane не должна выдавать
существующий Project за remote/recovery error.

Downstream handoff: текущие SPEC Constraint 6 и Architecture Spine wording
«backend отсутствует в alpha runtime» больше не описывают этот ограниченный
catalog boundary. Их владельцы должны выполнить source-derived
`bmad-spec`, затем `bmad-architecture` и downstream epics reconciliation; эта
PRD-only update их не редактирует.

## Import Limits to Calibrate

Стартовый диапазон для spike, не финальный contract:

- GLB `≤20–25 MiB`;
- `≤250k` triangles;
- `≤500k` vertices;
- `≤128` nodes;
- `≤32` primitives;
- `≤16` materials;
- `≤8` textures;
- texture `≤2048×2048`;
- total texture pixels `≤8 MP`;
- estimated decoded texture memory `≤48 MiB`;
- bounding box axis `≤20 000 mm`.

Финальные hard limits попадают в [asset import contract](../../../specs/spec-interiors-editor-alpha/asset-import-contract.md) только после измерений.

## UX Research Questions

- Понимает ли пользователь разницу между Plan и 3D Edit modes?
- Какой жест рисования Wall вызывает меньше accidental pan?
- Нужен ли отдельный rectangular starter или wall-first flow достаточен?
- Понятен ли Door как переход либо нужен Room switcher?
- Как пользователь хочет вводить точную позицию ItemInstance?
- Достаточно ли warning для collision или часть конфликтов должна блокировать placement?
- Как сообщить о quality degradation без ощущения поломки?
- Где находится безопасный update/reload момент в короткой мобильной сессии?

## Rejected Early Directions

- **Fork legacy Blueprint3D:** отвергнуто как foundation из-за устаревшего стека и незавершённых mobile/multi-room/import аспектов; допустим как reference.
- **WebGPU-only:** отвергнуто для alpha из-за device coverage.
- **Catalog-first strategy:** отвергнуто; контент не должен задерживать geometry walking skeleton.
- **Cloud account first:** отвергнуто; противоречит проверяемой local-first differentiation.
- **Photoreal rendering in alpha:** отвергнуто; ухудшает time/performance focus.
- **Полноценная physics collision:** отвергнуто; 2D footprint + height range достаточно для планировщика.

## Telegram: delivery и transport handoff — 2026-11-04

Этот раздел передаёт решения доставки и границы реализации в последующие
владеющие workflows. Пользовательские результаты и применимость принадлежат
FR-55–58 и NFR-28; эти механизмы не переопределяют SPEC или Spine.

- Два entry и раздельных output используют общее domain/application ядро,
  codecs, renderer и компоненты. Telegram host API остаётся на UI/composition
  boundary; browser entry не зависит от Telegram SDK или initData. Общий код
  не копируется ради второго продукта; browser-owned install/worker и tests
  выделяются так, чтобы будущий retirement был отдельно обратимым.
- Рабочее направление — отдельный стабильный Telegram origin и прежний стабильный
  Web/PWA origin; локальные порты допустимы для разработки. Бот, реальные
  домены и provider ещё не назначены. Раздельные origin — разные storage
  contexts, не перенос IndexedDB. Если будет предложен общий origin, до его
  выбора требуется доказать совместимость со старым root-scoped worker, его
  navigation fallback, chunks, cache и catalog; смены scope нового worker мало.
- Telegram не регистрирует PWA worker, не выполняет массовое unregister или
  очистку caches/IndexedDB. Сборки/очистка outputs не повреждают друг друга;
  отсутствующий JS/API/manifest не выдаётся как успешный browser HTML.
  ReleaseManifest доставляется и проверяется без обязательного worker; PWA
  handshake/update остаётся действующим. Immutable URLs открытых клиентов и
  lazy modules сохраняются на срок, установленный release policy, включая
  rollback; нельзя расширять writable schema range ради запуска.
- Catalog остаётся catalog-only: оба target используют общие integrity, range,
  cancellation и pin-before-publish правила. Реальная доставка metadata и
  ресурсов через proxy/CORS решается отдельно; Telegram credentials не
  добавляются ко всем запросам и пользовательские файлы не поступают в catalog.
- Account scope выбирается до всех DB/runtime adapters; teardown и generation
  guards защищают от поздних import/download/repair и GC результатов старого
  scope. Способ установления identity/trust определяется до writable S2; это
  не серверная проверка доступа. initData, bot token и персональные данные не
  попадают в Project, backup или диагностические логи.
- Внешний локальный file handoff и выбор файла проверяются на физических iOS и
  Android. До полного чтения проверяются размер и применимые resource limits;
  фактические current-format файлы проверяют обе стороны строгого roundtrip.
  Наблюдаемое расхождение Export V1/PPJ-A1 требует source-owner reconciliation:
  не объявлять поддержку неиспытанных схем, не округлять и не включать скрытую
  legacy migration. Серверный transfer требует отдельного решения владельца.
- Runbook и release evidence должны назвать реальные target/build/schema,
  supported versions, client/OS, catalog delivery и независимый Telegram
  rollback. Результаты preflight — baseline существующего кода, а не новый
  readiness verdict, физическое Telegram evidence или подтверждение TMA-AC.

Downstream: `bmad-ux` определяет конкретные state/Back/Close/viewport flows,
`bmad-architecture` — границы и delivery, `bmad-spec` пере-выводит CAP и
companions, stories связывают критерии и новый readiness оценивает расширение.
Прежний конфликт AGENTS с PRD/SPEC/AD-14 по AssetUsageGrant разрешён решением
владельца от 2026-11-04; это не заменяет оставшиеся технические проверки,
readiness gates или физическое Telegram evidence.

## Мобильная TMA от 23 ноября — передача в UX и архитектуру

Сначала UX прорабатывает общий компонент нижней шторки, вход в проёмы и
параметры мебели. Затем раскрытие каталога, ракурс «Авто» в 3D, прямое
дублирование и живой замер. Для A/B требуется самостоятельный сценарий
сравнения и восстановления. [Пакет требований](../../../specs/spec-tma-furniture-clearance/SPEC.md)

### Макеты для UX

Макеты передают согласованные состояния, порядок действий и требования к
компоновке. Для визуального исполнения использовать компоненты, типографику,
цвета, отступы и формы текущей TMA в обеих темах. Сверять новые состояния на
одной ширине с выпущенным интерфейсом. [Действующая шторка, светлая тема](../../evidence/tma-sheet-visual-alignment-2026-11-22/ios-item-properties.png) · [Действующий редактор, тёмная тема](../../evidence/tma-item-panels-2026-11-22/inspector-ios-dark.png)

- [Футер и шторка «Добавить»](../../../specs/spec-tma-furniture-clearance/mockups/plan-add-sheet-stacked.png).
  Слева обычный 2D-план, справа сразу видны три действия. Этот файл задаёт
  актуальные иконки, подписи и вход в проёмы.
- [Параметры кровати](../../../specs/spec-tma-furniture-clearance/mockups/item-parameters.png).
  Макет иллюстрирует поля точного ввода в первых двух вкладках. «Размеры»
  меняют ширину, глубину и высоту, а четыре редактируемых поля «До стен»
  меняют положение на 2D-плане. При фокусе поля отступа проверить видимость
  направляющей и самого предмета. Для контрольной кровати левый отступ
  1950 → 1850 мм даёт справа 415 → 515 мм с прежними габаритами.
  Смена содержимого сохраняет шапку с названием предмета, крестик справа и
  центральную полоску подвижной шторки. Утверждённая третья вкладка «Настройки»
  сразу показывает «Дублировать», «Заблокировать» / «Разблокировать» и
  «Удалить предмет». Для дублирования доступен прямой вход из выбора предмета
  в 2D и 3D по FR-30. Показать отдельное подтверждение удаления и возврат
  к действию во вкладке «Настройки» при отмене.
  Сразу под разделителем внизу на всех вкладках видно действие «Цвет»
  с названием и образцом оттенка. Вход сохраняет действующую палитру 3D
  и текущий черновик по FR-60.
- [Подтверждение двери](../../../specs/spec-tma-furniture-clearance/mockups/doors-and-windows.png).
  В правом кадре видно положение двери после перемещения. Актуальный выбор
  типа показан в шторке «Добавить» из первого макета.

### Решения и проверки для следующих этапов

- `bmad-ux` с `design-taste-frontend` сверяет старый ActionDock, правила
  шторок, каталога и временного сравнения через Undo/Redo с мобильными FR.
  Нужны состояния холста при выборе стены и движении двери у нижней и правой
  стен, каталог до и после разворота и с клавиатурой, одинаковый угол в 3D
  в «Авто» и «Все стены», копия в обоих видах, замер пары и сравнение A/B.
  В инвентаризации шторок указать вход, содержимое, высоту, доступность холста,
  маршруты «Назад» и точку возврата фокуса для каждого входа.
  [Контракт шторки](../../../specs/spec-tma-furniture-clearance/shared-bottom-sheet.md)
- Для контрольной спальни 800 → 600 мм относится к двум положениям одного
  черновика. Тесты повёрнутых контуров проверяют 500 мм при 90° и 497 мм при
  37,5°, равные минимумы, касание, пересечение и препятствие. Отдельный
  сценарий FR-62 проверяет две сохранённые расстановки даже без средства замера.
  [Приёмка замера](../../../specs/spec-tma-furniture-clearance/acceptance-scenarios.md)
- Архитектура должна проверить повторное использование геометрии для замера
  в черновике, границы плавного переключения сектора, согласованность точных
  углов и опор копии в 2D и 3D. Для контрольного GLB копия использует уже
  закреплённые байты и работает после подготовки с отключённой сетью.
- Для FR-62 архитектура выбирает версионирование, идентичность экземпляров,
  привязку наборов при однозначном изменении топологии и границы безопасной
  записи. Проверки включают старый проект и резервную копию, ресурс только в
  скрытом B, сбой или повтор команды, потерю права записи, перенос на каждую
  ОС и совместимый откат. Правила точного угла и стороны петель продолжают
  действовать по AD-35/36. [Сценарии A/B](../../../specs/spec-tma-furniture-clearance/room-layouts-and-item-copies.md)

### Промпт для отдельного UX-чата

> Выполни `bmad-ux` в режиме update для мобильного InteriorsEditor в Telegram
> на iOS и Android. Примени пользовательский `design-taste-frontend` (taste).
> Планируй сценарии, макеты и приёмку только для мобильной TMA. Упоминания
> Web/PWA в исходных документах используй для исторического контекста и
> совместимости данных, необходимой самой TMA.
> Работай в корне репозитория InteriorsEditor.
> Прочитай `AGENTS.md`, `docs/BMAD-INTEGRATION.md`, обновлённый
> `_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md`,
> `_bmad-output/specs/spec-tma-furniture-clearance/SPEC.md` и все его
> `companions`. Используй макеты для сценариев и компоновки.
> Визуальное исполнение сверяй с текущей TMA в обеих темах. Прочитай действующие
> `DESIGN.md` и `EXPERIENCE.md` в
> `_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/`.
> Обнови эти два Markdown-контракта и зарегистрируй решения штатным memlog.
> Сначала закрепи обычный футер «Комната», «Стена», «Добавить», «Выбор»,
> общий компонент шторок, маршрут выбора типа и стены с подтверждением,
> видимые края проёма и шторку параметров мебели. У закрываемой шторки
> крестик справа в шапке, у подвижной — полоска сверху по центру.
> Для шторки параметров применяй актуальные FR-29/30/59/60, включая случаи
> расхождения с ранними макетами.
> На 2D-плане порядок вкладок «Размеры», «До стен», «Настройки».
> В «Размеры» покажи точный ввод ширины, глубины и высоты в мм. Для моделей
> с фиксированными габаритами значения доступны для чтения. В «До стен»
> покажи четыре редактируемых отступа в мм и выделение направляющей по
> фокусу. В «Настройки» сразу размести «Дублировать», «Заблокировать» или
> «Разблокировать» и «Удалить предмет» с отдельным подтверждением по FR-30.
> Сохрани прямое дублирование из выбора в 2D и 3D. На каждой вкладке
> «Цвет» с образцом оттенка находится сразу под разделителем по FR-60.
> При переключении вкладок и переходе к палитре 3D сохраняй черновик.
> Затем проработай остальные состояния из
> FR-13/23/26/30/38/55/59/60/62 и проверку по NFR-17–20/26/28. Сохрани обе
> темы, доступные альтернативы свайпам и касанию холста, фокус, черновики,
> клавиатуру, безопасные зоны и крупный текст. Обозначь предлагаемую цель
> полезной площади каталога и проверку локального возврата к варианту.
> Передай открытые вопросы версионирования A/B и отката в Architecture.
> После UX согласуются Architecture, каноническая SPEC и истории, затем
> применяется readiness соответствующего среза. Для реализации нужны
> одобрение пакета и `READY` либо явное письменное исключение владельца.
> Для коммита требуется отдельное разрешение.


## Коррекция мобильного редактора от 24 ноября

Владелец уточнил рабочие сценарии после использования релиза от 23 ноября.
Текущие FR-13/19/23/29/55/59/60 и UX-контракт имеют приоритет над
макетами и сценариями исходной передачи выше. Передний силуэт проверяется
на ступенчатом контуре из обращения. Перенос проёма выполняется одним
действием с живым размером и доступным Undo. Вход в создание — «Добавить».
Свойства стены и все вкладки предмета открываются в единой нижней шторке
поверх холста. Потеря фокуса применяет отредактированное число. Выбор цвета
выполняется в 3D. В мобильном интерфейсе доступны отступы до стен.


### Повторная проверка мобильной TMA 24 ноября

Проверка владельцем уточнила FR-31 и поведение нижних шторок. Пересечение
напольной мебели блокирует геометрическую правку до записи. Для «Добавить»,
свойств стены, параметров предмета и каталога эталон — неподвижная форма
«Изменить окно» с внутренней прокруткой. Это решение действует вместо
прежнего требования о раскрытии жестом.
