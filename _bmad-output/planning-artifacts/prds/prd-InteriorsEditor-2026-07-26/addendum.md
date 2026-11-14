---
title: PRD Addendum — InteriorsEditor Alpha
status: draft
created: 2026-07-26
updated: 2026-11-04
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
