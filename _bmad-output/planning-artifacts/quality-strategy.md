---
title: "InteriorsEditor Alpha — стратегия качества"
status: draft
artifact_type: quality-strategy
created: 2026-07-26
updated: 2026-08-25
scope: "CAP-1–CAP-11 для Alpha entry; CAP-12 для отдельного Alpha+ gate"
owner_roles:
  - QA/Performance
  - Product Owner
  - Architect
sources:
  - ../specs/spec-interiors-editor-alpha/SPEC.md
  - ../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../specs/spec-interiors-editor-alpha/asset-import-contract.md
  - ../specs/spec-interiors-editor-alpha/performance-budgets.md
  - prds/prd-InteriorsEditor-2026-07-26/prd.md
  - architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - architecture/architecture-InteriorsEditor-2026-07-26/domain-model.md
  - architecture/architecture-InteriorsEditor-2026-07-26/solution-design.md
  - ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - research/technical-feasibility-2026-07-26.md
---

<!-- markdownlint-disable MD013 MD025 -->

# Стратегия качества

## 1. Назначение и границы

Документ определяет, какими доказательствами будущая реализация подтвердит
продуктовые и технические обещания InteriorsEditor. Это план проверки, а не
утверждение, что требования уже выполнены. В текущей pre-implementation фазе
он не разрешает создавать приложение, тестовый harness или fixtures.

Стратегия распространяется на:

- самостоятельно полезную Alpha entry: `CAP-1–CAP-11`, `FR-1–FR-47`
  (кроме retired `FR-20` и `FR-24`) и `FR-54`; `NFR-1–NFR-21` и
  `NFR-23–NFR-26`;
  `NFR-22 = N/A by scope`;
- отдельный Alpha+ gate для `CAP-12`, `FR-48–FR-52`;
- доменную корректность, mobile UX, PWA lifecycle, локальные данные,
  2D/3D-проекции, каталог, доступность, безопасность и производительность.

Стратегия не превращает следующие направления в alpha scope:

- account, remote Project/Revision/History/Portable Backup service, облачную
  синхронизацию и совместное редактирование; узкий Kotlin/PostgreSQL Catalog
  Control Plane по `FR-54`/`AD-17` не является ни одним из этих направлений;
- несколько этажей, произвольные углы и BIM/CAD;
- фотореализм, WebGPU-only путь, AI и AR/LiDAR;
- импорт любых форматов кроме отдельно gated статического GLB.

## 2. Определение качества

Качество Alpha — не количество экранов, моделей или покрытых строк. Продукт
достаточно качественный, если одновременно подтверждены следующие claims:

| Claim | Проверяемое обещание | Основные требования |
| --- | --- | --- |
| QC-1 Exact | Размеры и координаты не меняются между командами, проекциями, сохранением и переносом | CAP-2, CAP-3, CAP-5, NFR-1–NFR-4 |
| QC-2 Atomic | Валидированная команда либо атомарно становится Durable Revision, либо не заменяет current state | CAP-1, CAP-8, NFR-3, NFR-11 |
| QC-3 Recoverable | Последняя Durable Revision переживает kill, quota error, миграцию и безопасное обновление | CAP-1, CAP-9, CAP-10, NFR-10–NFR-13 |
| QC-4 Coherent | 2D, 3D, проёмы, предметы и материалы представляют одну Revision | CAP-3–CAP-7, NFR-4 |
| QC-5 Touch-usable | Основной путь выполняется на телефоне без hover, клавиатуры и помощи разработчика | CAP-2, CAP-6, NFR-17–NFR-20 |
| QC-6 Responsive | Reference scenes остаются управляемыми на утверждённых реальных телефонах | CAP-11, NFR-5–NFR-9, NFR-15 |
| QC-7 Accessible | Критические действия имеют доступную DOM/numeric alternative и понятные состояния | NFR-17–NFR-20 |
| QC-8 Private and bounded | Локальные данные не уходят без consent, а недоверенные входы ограничены и объяснимо отклоняются | CAP-10, CAP-12, NFR-21–NFR-23 |
| QC-9 Useful | Независимый целевой пользователь принимает конкретное решение о планировке | `SM-1`, `SM-2`, UJ-1–UJ-6 |

Ни один claim не считается доказанным по visual snapshot, line coverage,
ручному «пощупал» или одному desktop browser.

## 3. Принципы проверки

1. Тестируется наблюдаемое поведение через публичные доменные, application,
   adapter и пользовательские границы, а не private helpers.
2. Доменная корректность доказывается без DOM и GPU; browser/device tests
   подтверждают интеграцию, но не заменяют domain tests.
3. Fixtures создаются фабриками полных валидных объектов с точечными
   overrides и проходят реальные production schemas.
4. Invalid state строится только явно для негативного сценария; он не является
   случайным побочным эффектом неполного fixture.
5. Любой случайный/property test воспроизводим: seed и минимизированный
   counterexample сохраняются вместе с отчётом.
6. Проверяется результат, сохранённая Revision, reason code и пользовательский
   выход; проверка только факта вызова функции не принимается.
7. Визуальные snapshots дополняют семантические assertions, но не определяют
   геометрию, размеры, смежность или доступность.
8. Playwright device emulation проверяет viewport/input, но GPU, память,
   thermal, standalone PWA и OS lifecycle подтверждаются физическими
   устройствами.
9. Flaky test не считается пройденным evidence. Quarantine требует владельца,
   причины, срока и связанного риска.
10. Тестовые данные, traces и diagnostics соблюдают ту же privacy policy, что
    и продукт.

## 4. Слои доказательств

| Слой | Что доказывает | Обязательный выход |
| --- | --- | --- |
| E0 — Traceability | Каждое требование имеет проверяемый путь | CAP/FR/NFR → scenario → test/evidence → gate |
| E1 — Domain examples | Команды и reason codes ведут себя по контракту | Valid, boundary и rejected example для каждой Command |
| E2 — Properties and mutation | Инварианты устойчивы к комбинациям и реалистичным ошибкам | Seeds/counterexamples; mutation report по критичным правилам |
| E3 — Golden corpora | Сложные известные topology/import случаи не регрессируют | Версионированный corpus с ожидаемой семантикой |
| E4 — Contract/adapters | Ports, storage, migration, backup, catalog, Kotlin/PostgreSQL control-plane perimeter, AD-16 web baseline и renderer не расходятся | Contract suites, frozen-toolchain conformance и fault-injection reports |
| E5 — Browser integration | Touch-to-command, DOM controls, canvas и 2D/3D связаны корректно | Browser report на реальных engines |
| E6 — PWA lifecycle | Offline, kill/reopen, update, quota и cache eviction восстанавливаемы | Сценарные логи и checksums Revision |
| E7 — Device/performance/a11y | UX и budgets выдерживаются на утверждённой матрице | Device traces, thermal run, manual a11y protocol |
| E8 — Alpha validation | Целевой участник сам закрывает основной JTBD | Moderated/unmoderated session record без project content |

Нижний слой не заменяет верхний: например, идеальные property tests не
доказывают удобство жеста, а успешная usability-сессия не доказывает
атомарность backup import.

## 5. Матрица capability → минимальный evidence

| Capability | Обязательные доказательства перед заявлением «готово» |
| --- | --- |
| CAP-1 | Project lifecycle examples; autosave transaction contracts; kill-after-each-boundary fault injection; quota/migration recovery; portable backup |
| CAP-2 | Command examples; invariant/property suite; 0°/45°/90° golden plans; touch-to-command browser tests; numeric boundary tests |
| CAP-3 | Face derivation corpus; Room identity split/merge cases; deterministic area/perimeter; metadata reconciliation review |
| CAP-4 | Opening interval boundaries; overlap/reverse-wall cases; Door/Window wall-host validation and shared Plan/3D projection without navigation semantics |
| CAP-5 | Differential 2D/3D projection by Revision; reload equivalence; ItemInstance-picking and no-Room-selection tests; context-loss recovery; 2D fallback |
| CAP-6 | Catalog manifest and `CatalogGatewayPort` contract; dimension/anchor/footprint/format/size/hash checks; Kotlin/PostgreSQL no-Project-data perimeter; pinned-resource + BackupFeasibilityPolicy boundary; outage/retry/cancel, placement/collision and explicit resource-recovery state machine |
| CAP-7 | Declared ItemInstance variant examples; control-plane version/resource/hash contract; offline resource/fallback; save/reopen equality |
| CAP-8 | Apply/undo/redo properties; rejected-command equivalence; gesture grouping; history-boundary fixtures; GC roots for both session branches and SessionRetentionPolicy |
| CAP-9 | Browser and standalone install paths; airplane-mode reopen/edit/save; automatic-worker/startup handshake; capability fallbacks |
| CAP-10 | Every valid boundary Project exports offline; clean-profile round-trip; corrupt/future-version rejection; publish-as-new staging atomicity |
| CAP-11 | RS-1/RS-2 traces on every floor device; resource disposal; context recovery; degradation-ladder assertions; eight required physical NFR-15 traces |
| CAP-12 | Hostile GLB corpus; no-network proof; decoded-limit boundaries; cancel/dispose/quota/backup tests; comprehension UX test |

`CAP-12` не входит в gate первой закрытой Alpha, пока Product Owner явно не
изменит scope.

## 6. Domain, geometry и history

### 6.1 Example suite

Для каждой Command из доменной модели нужны:

- один минимальный valid example;
- нижняя граница, точная граница и значение сразу за границей;
- каждый заявленный stable reason code;
- наблюдаемая Revision до/после;
- inverse/undo и redo;
- projection invalidation scope;
- доказательство, что unrelated entities не изменились.

Минимальные семейства ошибок:

`ZERO_LENGTH`, `DUPLICATE_SEGMENT`, `UNSUPPORTED_DIRECTION`,
`SELF_INTERSECTION`, `AMBIGUOUS_INTERSECTION`, `OPENING_OUT_OF_BOUNDS`,
`OPENING_OVERLAP`, `ROOM_IDENTITY_AMBIGUOUS`, `PROJECT_BOUNDS_EXCEEDED`,
`INVALID_DIMENSION`.

Локализованный текст может меняться; stable reason code, затронутый объект и
безопасное следующее действие остаются проверяемым контрактом.

### 6.2 Property и metamorphic suite

После фиксации topology policy обязательны свойства:

- `undo(apply(command, state))` семантически равен исходному state;
- `redo(undo(acceptedCommand))` равен принятой Revision;
- rejected Command не меняет Revision, history и autosave payload;
- serialize → deserialize и backup export → import дают 0 мм semantic drift;
- одна и та же versioned модель создаёт одинаковые Face и material assignments
  независимо от порядка unordered collections;
- snap идемпотентен;
- направление Wall в Durable Revision принадлежит утверждённому набору;
- пересечение представлено общей Vertex либо отклонено по утверждённой policy;
- bounded Face имеет положительную площадь и нормализованный обход;
- Opening принадлежит ровно одной WallSegment и лежит в usable interval;
- reverse canonical orientation преобразует offset без физического сдвига;
- локальная команда не меняет несвязанный subgraph;
- преобразование мм → renderer metres никогда не становится обратным source of
  truth;
- последовательность случайных допустимых команд сохраняет все Plan
  invariants;
- повторная миграция подчиняется зафиксированной idempotence policy.

Для арифметики и условий тесты обязаны различать реалистичные мутации:

- `+ ↔ -`, `* ↔ /` на длинах, offsets, площадях и преобразовании единиц;
- `< ↔ <=`, `> ↔ >=` на project, opening, asset и quota limits;
- `&& ↔ ||` в составной валидации;
- удалённый split, cleanup, journal commit или resource disposal;
- `min ↔ max`, перевёрнутый порядок и удалённую нормализацию.

Используются неидентичные значения; для порога проверяются «на 1 мм меньше»,
«ровно» и «на 1 мм больше». Mutation score сам по себе не является KPI:
блокируют surviving/no-coverage mutants, способные изменить геометрию,
ревизию, миграцию, privacy или resource limit. Equivalent mutant получает
письменное обоснование.

### 6.3 Golden geometry corpus

Corpus версионируется как данные, а не как snapshots внутренней структуры.
Каждый case содержит входную schema version, команды или Project, ожидаемые
entity IDs/relationships, размеры, rooms, reason codes и семантический hash.

Минимальный набор:

| Fixture family | Обязательные случаи |
| --- | --- |
| `GP-RECT` | пустой план, один прямоугольник, shared wall, open contour |
| `GP-DIAG` | 45° segment, диагональное замыкание, диагонали с integer endpoints, правило округления |
| `GP-JUNCTION` | L-, T- и X-junction; почти совпавшие точки; backtracking; overlap |
| `GP-ROOM` | concave face, split, merge, ambiguous identity, сохранение finishes |
| `GP-OPENING` | проём у обоих краёв, reverse wall, overlap, resize, укорочение стены |
| `GP-DELETE` | удаление стены, исчезновение Room, объединение Room, orphan prevention |
| `GP-LIMIT` | minimum dimensions, project bounds, большое число валидных entities |

До owner approval endpoint-правила диагонали и решений по X-intersection, Room
reconciliation и Opening fit соответствующие fixtures имеют статус
`pending-decision`, а не случайно закрепляют поведение выбранной библиотеки.

## 7. Persistence, backup и migrations

Проверяется recovery protocol целиком:

1. Command и все domain invariants валидированы;
2. candidate помечен `PendingDurability`, но не `saved`;
3. staging Revision записана;
4. checksum и schema validation выполнены;
5. current pointer переключён атомарно и Revision помечена `Durable`;
6. HistoryEntry опубликован, journal очищен;
7. retention не удалил последнюю читаемую копию.

Обязательные сценарии:

- hard close до, во время и после каждой стадии;
- 100 последовательных Commands с kill между любыми двумя boundaries;
- заполнение quota перед staging и перед publication;
- повреждённые metadata, snapshot, checksum и blob reference;
- миграция с каждой поддерживаемой предыдущей schema version;
- повторный запуск прерванной миграции;
- unknown future schema: безопасный read-only/export либо объяснимый отказ;
- backup с дубликатами IDs/hash, отсутствующим manifest, лишними полями,
  некорректными единицами и oversized payload;
- import в staging не изменяет существующий Project до полного успеха;
- app-controlled cache eviction удаляет только unreferenced browse resources,
  не pinned Project resources;
- forced GC между delete/undo/redo не удаляет hashes ни одной активной history
  ветки; новая команда после undo освобождает отброшенную ветку только после
  Durable publication;
- current+undo+redo resource boundary отклоняет новую команду до mutation;
- missing/corrupt hash переводит Project в read-only recovery; local,
  backup-supplied и exact-network repair проверяются по hash, а один атомарный
  RecoveryChangeSet обязан убрать все unresolved references;
- history-only corrupt hash проверяет exact repair и confirm/cancel
  `DiscardSessionHistory`; без подтверждения обе ветки остаются;
- history-only corrupt hash не блокирует complete backup healthy current и не
  добавляет session History в bundle;
- backup RS-2 в чистом offline profile возвращает тот же semantic hash и exact
  referenced catalog/custom resources.

Migration fixture неизменяем после релиза соответствующей schema. Изменение
ожидаемого результата требует отдельного migration decision, а не обновления
snapshot «чтобы тест прошёл».

## 8. Projection и renderer

### 8.1 Семантические проверки

- 2D и 3D получают один `revisionId`;
- walls, openings, Room surfaces, ItemInstances и material assignments
  совпадают по доменным IDs и размерам;
- view/camera change не создаёт Command;
- reload той же Revision воспроизводит семантически ту же сцену;
- missing asset создаёт стабильный диагностируемый placeholder;
- downgrade quality не меняет Project serialization;
- picking ItemInstance выбирает ожидаемый domain ID, а не runtime mesh как
  источник данных; касание Room surface не создаёт selection или property UI.

Geometric mesh snapshots допустимы для junction artefacts, normals и UV, но
истина проверяется через доменные размеры и relationships.

### 8.2 Lifecycle и fault injection

Проверяются:

- WebGL context lost/restored;
- повторный context loss и переход в low-quality/2D-only;
- открыть/закрыть Project десять раз без монотонного resource growth;
- background/foreground пять раз без удвоения scene resources;
- worker crash, timeout и cancel;
- отмена progressive asset hydration;
- dispose Object URL, ImageBitmap, geometry, material, texture и worker;
- renderer failure не блокирует backup и diagnostics.

Выбор Three.js/R3F или Babylon подтверждается одним и тем же fixture,
взаимодействиями и измерениями. Разные сцены не являются честным сравнением.

## 9. Browser, touch и UX states

Browser tests используют реальные rendering engines и проверяют действие
пользователя через видимые controls:

- tap/drag threshold и отсутствие случайного превращения tap в drag;
- один палец и два пальца не смешивают selection, geometry и camera;
- DraftCommand не попадает в history/autosave;
- cancel gesture возвращает последнюю valid Revision;
- numeric sheet остаётся доступным при открытой клавиатуре;
- bottom sheet не перехватывает жест холста за своей границей;
- точный ввод сообщает единицу `мм` и сохраняет предыдущее valid value при
  ошибке;
- undo/redo называет следующую Command и корректно disabled;
- Door/Window проходят wall-host validation и получают согласованную Plan/3D
  projection без navigation edge/transition или lock/access/key/open-close UI
  либо state;
- системный back/refresh/standalone reopen не создаёт silent loss.

Для каждой поверхности из UX inventory проверяются обязательные состояния:

- loading, first-use/empty, populated;
- valid, draft/dirty, invalid/rejected;
- offline cached и offline unavailable;
- storage-risk, recovery/read-only;
- missing asset и context lost;
- update available/deferred/safe-to-apply;
- success, failure, cancellation и retry;
- stale selection/object removed.

Каждое error state должно отвечать на три вопроса: что случилось, что
сохранено, что пользователь может сделать сейчас.

## 10. PWA и offline matrix

Минимальные сценарии выполняются в browser tab и standalone, если платформа
поддерживает установку:

1. первый online load → создание Project → закрытие → warm offline start;
2. airplane mode → open → edit до `Durable` → hard close → reopen;
3. uncached catalog asset offline → placeholder без потери ItemInstance;
4. update найден во время Active Gesture → active UI не подменяется;
5. automatic worker activation/startup → ReleaseManifest handshake →
   idempotent migration/read-only recovery → reopen;
6. quota warning → очистка только unreferenced browse cache → backup → retry;
7. browser storage eviction simulation → честное recovery message/backup path;
8. share API отсутствует → Portable Backup доступен как обычное скачивание;
9. capability отсутствует → documented fallback, а не user-agent guess;
10. WebGL2 отсутствует → compatibility state с сохранением доступа к данным.
11. iOS Safari ↔ Home Screen не предполагают общее storage: backup handoff
    восстанавливается в чистом offline context.
12. второй tab/context получает read-only, stale fencing token не публикует
    Revision, explicit takeover создаёт одного writer.
13. Catalog Control Plane outage: browse/search либо download ещё не pinned
    resource показывает labelled retry/cancel; fully pinned healthy Project
    продолжает open/edit/Durable save/local undo-redo/Portable Backup и не
    становится `ResourceRecoveryRequired`.
15. Actual missing/corrupt exact referenced resource остаётся
    `ResourceRecoveryRequired` при reachable и unreachable Catalog Control
    Plane; тесты не подменяют это состояние обычной service outage.

Browser automation не может доказать фактическое поведение iOS Home Screen,
OS process eviction, storage pressure и thermal; эти случаи повторяются
вручную на floor devices.

## 11. Performance и реальные устройства

### 11.1 Reference scenes

- `RS-1` — первая комната, Door, Window, 15 ItemInstances и нейтральная
  проекция пола/стен;
- `RS-2` — небольшая квартира Alpha;
- `RS-3` — честный hard-limit/failure case, не обещание плавной работы.

Fixture version, catalog version и сценарий взаимодействия фиксируются.
Изменение сцены требует новой версии и причины; иначе тренд недостоверен.

### 11.2 Выровненный контракт и drift monitoring

**Resolved 2026-07-26.** PRD `NFR-5/NFR-6/NFR-7` и
`performance-budgets.md` теперь задают один provisional контракт:

- `RS-2`: 6 Room, 60 ItemInstances, 750k visible triangles, 250 draw calls и
  128 MiB estimated GPU resources;
- active manipulation: p95 frame time ≤33.3 ms и не более 5% кадров дольше
  50 ms;
- first editable empty room: cold ≤3 s, warm offline ≤1.5 s.

Выравнивание устраняет документальное расхождение, но не подтверждает бюджеты
на реальных устройствах: это остаётся задачей renderer/performance spike.

Drift guard:

1. RS-2 имеет одну versioned fixture и одинаковое описание в PRD/companion.
2. Любое изменение состава, percentile, startup target или условий измерения
   обновляет оба документа и traceability одной change-записью.
3. Performance report всегда указывает build, fixture и device version.
4. При повторном расхождении PASS приостанавливается до reconciliation; текущее
   состояние не является blocker.

### 11.3 Метод измерения

- production-like build и одинаковый versioned fixture;
- минимум 20 повторов startup и 5 интерактивных сессий;
- cold/warm cache и browser/standalone разделены;
- p50/p75/p95, long tasks и frame-time distribution сохраняются;
- battery, thermal, network, OS и browser version записаны;
- trace привязан к build/commit, schema, catalog и fixture version;
- регрессия ключевой метрики более 10% требует объяснения;
- lab test дополняется, но не заменяет real-device run;
- steady-state render-on-demand проверяется отдельно от активного drag;
- 10–15-минутный thermal run проверяет input, context, degradation и recovery.

PRD `NFR-15` теперь задаёт конкретную matrix из восьми физических contexts:
iPhone 13 mini и iPhone 17 в Safari tab/Home Screen PWA, Galaxy A53 5G и
Galaxy S26 в Chrome tab/standalone PWA. Это снимает выбор matrix как открытое
решение, но не заменяет physical-device availability, актуальные trace и
renewal protocol: отсутствие хотя бы одного required NFR-15 trace оставляет
соответствующий evidence gate `PAUSED`.

## 12. Accessibility

Автоматические проверки покрывают семантику DOM, имена, роли, contrast,
focusable controls и часть WCAG 2.2 AA. Ручные проверки обязательны для:

- VoiceOver на поддерживаемом iPhone;
- TalkBack на floor/typical Android;
- системного текста и browser zoom до 200%;
- portrait, landscape, safe areas и открытой экранной клавиатуры;
- reduced motion;
- high contrast и состояния, не передаваемые только цветом;
- touch target не меньше 44×44 CSS px;
- focus после validation error, dialog, bottom sheet и update banner;
- списка/numeric alternative для критичных canvas-действий;
- проверки смежности без обязательного 3D-walkthrough.

Полная keyboard parity desktop пока является открытым продуктовым решением.
Она не подменяет обязательную доступность DOM controls на телефоне. Любое
исключение из WCAG получает owner, rationale, обходной путь и срок пересмотра.

## 13. Catalog и asset pipeline

Каждый публикуемый catalog manifest проходит gate:

- schema, stable ID, category и доступное название;
- физические width/depth/height, units, footprint и AnchorClass;
- bounding box, pivot/orientation и placement smoke test;
- triangle, draw-call, material, texture и decoded-resource budgets;
- отсутствие external URI и неожиданных network requests;
- deterministic content hash;
- технический manifest resource bytes: формат, size, content hash, exact
  pinned reference и BackupFeasibilityPolicy;
- recovery и backup round-trip проверяют, что exact resource bytes доступны
  без сети; licensing, provenance, grant, declaration, attribution, notice и
  rendered-output policy не являются Alpha gate либо manifest field;
- thumbnail/fallback и offline cache tier;
- recolorable slots и допустимая resize policy;
- load/place/remove/dispose и missing-resource placeholder.

Catalog coverage оценивается по UJ-3 и функциональным классам, а не только
числом 100–150. Broken или юридически непрозрачный asset не может попасть в
manifest ради выполнения количественной цели.

### 13.1 AD-16 web baseline (`G-WEB-AD16`)

`G-WEB-AD16` — отдельный planning/conformance gate для adopted web boundary,
а не часть `G-CP-ADR`. До `V-01` он фиксирует один planned `apps/web` root,
Node `24.19.0` LTS, `pnpm@11.20.0`, один frozen `pnpm-lock.yaml`, React
`19.2.8`, TypeScript `7.0.2`, `@rspack/core`/`@rspack/cli` `2.1.8`, CSS
Modules, `@rstest/core`/`@rstest/adapter-rspack` `0.11.5` и
`@playwright/test` `1.62.1`. Он запрещает второй JavaScript lockfile, Vite/
Vitest substitution и назначение Kotlin tests JavaScript runner.

После final `READY`, только в Story 1.1, `WEB-BOOTSTRAP-01` обязан оставить
reproducible evidence: frozen-lock install, Rspack production build, Rstest
run для TypeScript domain/application/DOM-independent seam и Playwright
browser smoke против того же `apps/web` configuration. До разрешённого
scaffold этот runtime result честно имеет статус `NOT EXECUTED`; наличие
документированного `G-WEB-AD16` не означает, что build уже green и не
разблокирует production code само по себе.

### 13.2 Catalog Control Plane perimeter (`FR-54`, `AD-17`)

До `V-09-CP` отдельный `G-CP-ADR` фиксирует воспроизводимый Kotlin build/test
boundary, API/transport и resource-delivery choice, PostgreSQL schema/operations
boundary и publisher/operator authentication. Его contract/integration suites
проверяют, что service принимает и публикует только versioned catalog metadata/
resources и hashes; он не принимает,
не хранит и не синхронизирует account identity, User Project, Revision, session
History, Portable Backup или user-owned pinned bytes.

Browser Playwright scenarios `CATALOG-E2E-01`–`05` проверяют видимый
`CatalogGatewayPort` outcome, retry/cancel и local continuity. Они не заменяют
Kotlin/PostgreSQL contract, migration and integration tests и не подтверждают
availability, device performance или absence of server-side user data сами по
себе. `@rstest/core` применяется только к TypeScript domain/application и
DOM-independent UI-state seams; Kotlin tests выбираются и запускаются только
после `G-CP-ADR`.

## 14. GLB Alpha+ quality gate

Проверка custom GLB изолирована от Alpha entry. Corpus содержит:

- минимальный valid self-contained GLB;
- каждую границу bytes/triangles/vertices/nodes/materials/textures;
- значение ровно на hard limit и сразу выше;
- malformed header/chunk/JSON/buffer;
- external URI, data URI policy, unknown required extension;
- animation, skin, morph target, camera и light;
- oversized decoded texture и малый compressed memory bomb;
- Draco/Meshopt/KTX2 до и после окончательного allowlist decision;
- неверные axes, scale, normals, footprint и pivot;
- cancel/timeout/worker crash на каждой pipeline stage;
- repeated import/delete и quota exhaustion;
- backup round-trip с deduplication по hash.

Обязательные assertions:

- preview не инициирует network request;
- rejected/cancelled asset не оставляет Project mutation, blob, Object URL,
  worker или GPU resource;
- custom resource format/size/hash, exact pin и backup round-trip проходят те
  же технические проверки, что и catalog resource;
- сообщение показывает безопасные actual/limit и следующий шаг;
- filename/path/binary/texture не попадает в telemetry;
- пользователь в UX-тесте понимает причину отказа;
- provisional hard limits заменены измеренными значениями на floor devices.

## 15. Security и privacy verification

Threat-driven проверки охватывают:

- schema fuzzing Project/backup/catalog/GLB metadata;
- text escaping для Project name, filename и asset metadata;
- CSP и отсутствие неожиданных origins;
- integrity/hash validation manifests и backups;
- запрет external fetch из импортируемого asset;
- decoded-resource limits, timeout, cancellation и worker isolation;
- stale service worker/schema mismatch;
- отсутствие Project geometry, screenshot, binary, filename и полного пути в
  logs, diagnostics и analytics;
- явный consent и opt-out до внешней telemetry;
- безопасный diagnostic export с allowlist полей.

Security test не использует реальные пользовательские проекты. Hostile corpus
содержит синтетические или юридически допустимые данные.

## 16. Observability без нарушения приватности

### 16.1 Диагностический envelope

Допустимый локальный/consented envelope:

```text
buildId
schemaVersion
catalogVersion
fixtureVersion, только в тестовой среде
platform capability tier
renderer quality tier
stable reasonCode
operation kind без payload
duration bucket / frame distribution
recovery outcome
consent state
```

Запрещены:

- координаты, размеры и topology пользовательского Project;
- screenshot, GLB bytes, texture или serialized backup;
- Project/Room names и filename;
- filesystem path, arbitrary metadata и free-form exception payload без
  очистки;
- fingerprinting beyond the approved capability tier.

### 16.2 Доказательные события

Для Alpha полезны агрегаты:

- task started/completed для UJ без содержимого проекта;
- Durable/rejected command по kind/reason;
- recovery attempted/succeeded;
- offline open/edit/save outcome;
- backup export/import outcome;
- renderer context loss/recovery;
- quality tier transition;
- storage warning;
- performance distributions.

Внешний сбор включается только после privacy/consent decision. До этого те же
события могут жить локально в тестовой сборке и экспортироваться участником
явно.

## 17. Defect severity и triage

| Severity | Определение | Примеры | Gate |
| --- | --- | --- | --- |
| SEV-0 Stop | Потеря/повреждение Project, privacy/security breach или необратимое неверное физическое решение без предупреждения | silent drift, backup перезаписал проект, внешний fetch GLB, утечка geometry | Немедленная остановка кандидата; 0 открытых |
| SEV-1 Critical | Основной journey невозможен, crash/OOM, unrecovered context, неверная topology/history | Opening нарушает host validation, undo создаёт invalid plan, offline reopen не работает | Блокирует Alpha; 0 открытых |
| SEV-2 Major | Journey завершается только с заметным обходом или нарушена заявленная NFR на части support matrix | частый mis-tap, asset исчезает без placeholder, a11y path неполон | Блокирует по умолчанию; только явный waiver с owner/сроком |
| SEV-3 Minor | Локальный визуальный/текстовый дефект без потери данных, точности и доступного действия | некритичный layout или неточный неконтрактный текст | Допустим в закрытой Alpha с backlog owner |

Повторяемость не снижает severity data-loss/security дефекта. Flaky SEV-0/1
scenario считается неразрешённым, пока причина не найдена.

## 18. Quality gates

### QG-0 — Definition/readiness, до feature implementation

Обязательны:

- для production bootstrap и любого `V-*`: финальный официальный BMAD
  readiness `READY`; `W-SPK-2026-08-04` является только evidence-spike
  exception и не удовлетворяет этому пункту;
- утверждены grid/snap/rounding, X/T-intersection, Room reconciliation,
  Opening fit и collision policies;
- утверждена конкретная device/OS/browser matrix;
- versioned RS-1/RS-2 совпадают с выровненными `NFR-5/NFR-6/NFR-7`, а
  provisional budgets подтверждены либо синхронно изменены по spike evidence;
- назначены content owner и minimum catalog matrix; owner отбирает бесплатные
  или созданные им модели вне приложения;
- завершены и зафиксированы с `PASS` S-1 Renderer, S-2 Topology, S-3
  Storage/PWA, S-4 Touch **и S-6 Asset catalog pipeline**;
- S-1/S-2/S-3/S-4 оставили evidence-backed ADR-001/ADR-002/ADR-003/ADR-005,
  corpus/fixture и измеримый exit report;
- S-6 оставил evidence-backed **ADR-006**, versioned sample manifest с
  format/size/hash, exact pin/backup corpus и raw device traces; отсутствие
  любого из этих технических результатов не может быть замаскировано preview,
  sample asset или waiver;
- до `V-09-CP` отдельно принят `G-CP-ADR`: Kotlin build/test boundary,
  API/transport/resource delivery, PostgreSQL schema/operations и
  publisher/operator authentication воспроизводимы и не расширяют AD-17 до
  account/Project/sync/backup service;
- до `V-01` `G-WEB-AD16` отдельно фиксирует только adopted web stack; после
  final `READY` внутри Story 1.1/V-01 `WEB-BOOTSTRAP-01` оставляет exact
  runtime evidence. Этот gate не включает Kotlin/PostgreSQL decisions и не
  заменяет final `READY`;
- CAP/FR/NFR/AD traceability не содержит orphaned Alpha requirement.

### QG-1 — На каждый vertical slice

1. Actor/trigger/outcome и acceptance criteria согласованы.
2. RED test падает по ожидаемой бизнес-причине.
3. GREEN проходит через публичную границу.
4. Boundary, negative path и fault path покрыты.
5. Mutation scan выполнен; worthwhile survivors killed или обоснованы.
6. Affected golden/contract/browser suites проходят.
7. Diagnostics/privacy assertions добавлены, если возникает новое событие.
8. Refactor не меняет observable behavior; evidence повторно пройден.
9. При затронутом catalog path applicable named `CATALOG-E2E-01`–`05` green;
    TypeScript browser tests не подменяют обязательные Kotlin/PostgreSQL
    contract/integration evidence после `G-CP-ADR`.
10. При `V-01` или изменении AD-16 boundary `WEB-BOOTSTRAP-01` подтверждает
    один frozen web lockfile, Rspack/Rstest/Playwright boundary и отсутствие
    Kotlin test execution в JavaScript runner.

### QG-2 — Candidate integration

- typecheck, lint и все deterministic suites проходят;
- нет запрещённого dependency direction;
- changed high-risk domain/storage/import code проходит mutation gate;
- migrations от всех поддерживаемых schema versions проходят;
- browser matrix и offline/update/recovery scenarios зелёные;
- catalog manifest gate зелёный;
- applicable `CATALOG-E2E-01`–`05` зелёные; `V-09-CP` additionally leaves its
  ADR-selected Kotlin/PostgreSQL contract, schema and integration suite green
  without accepting/storing user Project data;
- отсутствуют undocumented skips и бесхозные quarantine;
- traceability указывает build, fixture и evidence.

### QG-3 — Закрытая Alpha entry

- `CAP-1–CAP-11` имеют evidence из требуемых слоёв;
- 0 открытых SEV-0/SEV-1; SEV-2 только по явному ограниченному waiver;
- `SM-3–SM-6` подтверждены на утверждённых fixtures/devices;
- real-device performance укладывается в reconciled budgets;
- VoiceOver/TalkBack, zoom 200%, reduced motion и touch floor проверены;
- airplane-mode, hard close, quota, update и backup round-trip пройдены;
- catalog technical audit не содержит resource без format/size/hash,
  exact pin, backup readiness либо recovery state;
- Catalog Control Plane contract audit подтверждает `FR-54` perimeter и
  distinguishes service outage from actual `ResourceRecoveryRequired`;
- независимые целевые участники выполняют UJ-1–UJ-6; `SM-1/SM-2` измерены по
  согласованному research protocol;
- limitation list доступен тестерам и не маскирует unsupported capability.

### QG-4 — Alpha+ custom GLB

Помимо `QG-3` обязательны все пункты verification gate из
`asset-import-contract.md`, подтверждённые hard limits, hostile corpus,
memory/thermal runs, no-network proof и 0 открытых SEV-0/SEV-1 в import path.

## 19. Evidence package

Каждый candidate получает неизменяемый пакет:

- build/commit identifier;
- schema, catalog и fixture versions;
- traceability snapshot;
- deterministic test, mutation и migration reports;
- browser/PWA matrix;
- device models, OS/browser versions и capability tiers;
- RS-1/RS-2 traces и thermal protocol;
- accessibility automation и manual checklist;
- catalog technical manifest and pin/backup report;
- defect list и waivers;
- usability summary без пользовательского Project content;
- известные ограничения и rollback/recovery notes.

Отчёт без версии build, fixture и устройства не является evidence.

## 20. Открытые решения

До окончательного quality gate владелец должен подтвердить:

1. доступ к определённым NFR-15 физическим contexts и актуальные complete
   device traces по их renewal protocol;
2. grid/snap step, off-grid numeric policy и утверждение endpoint-правила
   диагонали;
3. X-intersection, Room split/merge и Opening fit policies;
4. blocking/warning collision semantics;
5. Alpha telemetry consent и допустимые агрегаты;
6. minimum catalog coverage и legal owner;
7. provisional Project/backup limits, reminder UX и session-history boundary;
8. полноту desktop keyboard support;
9. остаётся ли CAP-12 в Alpha+.

До решения соответствующие тесты помечаются `pending-decision`; они не
закрепляют случайное поведение прототипа как продуктовый контракт.
