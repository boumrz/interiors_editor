---
title: InteriorsEditor Project Context
project_name: InteriorsEditor
user_name: Roman
status: complete
created: 2026-07-26
updated: 2026-11-05
date: 2026-11-05
optimized_for_llm: true
sections_completed:
  - phase-and-workflow
  - stack-and-layout
  - domain-and-state
  - storage-and-control-plane
  - platform-and-pwa
  - testing-and-evidence
  - naming-and-boundaries
sources:
  - specs/spec-interiors-editor-alpha/SPEC.md
  - planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
---

# Project Context

Краткая конституция для будущих AI-агентов. Детали и решения принадлежат SPEC
и Architecture Spine; этот файл фиксирует правила, которые легко нарушить.

## Phase and workflow gate

- Существующий Web/PWA Alpha реализован; его финальный исторический gate
  `READY` датирован 2026-08-30. Для Telegram extension Epic 10 имеет отдельный
  verdict `NEEDS_WORK`; узкий browser-only S1 / Story 10.1 получил `READY` и
  реализован, evidence — `docs/progress/telegram-extension-2026-11-04/S1/README.md`.
  Локальные S2–S7 срезы и AD-31 имеют свои применимые planning READY, см.
  `plans/telegram-mini-app-s0-readiness-result-2026-11-04.md`. Отдельный Telegram
  entry/runtime реализован и проверяется в изолированных локальных прогонах;
  текущие Web336/PWA10 и Telegram функциональные результаты записаны в
  `docs/progress/telegram-extension-2026-11-04/current-status.md`. Полные текущие
  mutation/review gates хранилищ ещё выполняются. Metadata-only evidence не
  заменяет полный AD-26 fencing/receipt protocol. Новый browser registered
  ingress в основном entry остаётся выключенным до AD-31 implementation proof
  и регресса прежнего Web/PWA. Физическая Telegram-приёмка и writable rollout
  не разрешены этими локальными результатами; Epic 10/release не READY.
  Для каждого следующего scope до применимого `READY` и согласованного planning
  package либо явного written
  waiver не создавать новый extension production code/package/build/test/
  deployment. Исторический Alpha READY не разрешает Telegram implementation.
- Candidate stack не означает установленный stack. Не добавлять зависимости,
  конфигурацию, framework/build/transport решения или версии сверх AD-16/AD-17
  до разрешённого vertical slice.
- Один implementation owner владеет vertical slice; независимый reviewer
  проверяет spec/architecture/test evidence. Не делать commit без явного
  одобрения владельца продукта.
- Документация живёт в `_bmad-output`, существующий application root — `apps`;
  historical seed и checkpoint evidence не заменяют фактическое дерево и
  актуальные решения владельцев источников.

## Existing unified root and stack

- Единый корень содержит `apps/web` и `apps/catalog-control-plane`;
  JavaScript workspace охватывает только `apps/web`. Этот каталог содержит
  общее ядро редактора и не является целиком удаляемой browser-оболочкой.
- `apps/web`: React `19.2.8` + TypeScript `7.0.2` + Rspack `2.1.8`;
  `@rspack/core` и `@rspack/cli` pinned по AD-16. CSS компонента или страницы
  хранится в `*.module.css`; global CSS ограничен reset, tokens и AppShell-wide
  platform constraints.
- Node.js `24.19.0` LTS и pnpm `11.20.0` — bootstrap baseline. Использовать
  один committed `pnpm-lock.yaml`; `latest`, второй JS lockfile и unpinned host
  Node запрещены.
- `apps/catalog-control-plane` — Kotlin `2.4.10` + PostgreSQL `18.4` только
  для каталога; Ktor/Netty, Gradle/JDK и внутренний delivery закреплены AD-24.
  Публичные hosting/IAM/SLA не считаются выбранными по наличию временного tunnel.

## Domain and state

- Каноническая геометрия — integer millimetres. План — planar graph
  `Vertex → WallSegment`; `Room` — derived face, а usable polygon, area и
  perimeter — пересоздаваемые projections. Не хранить две изменяемые истины.
- `Room.heightMm` — единственный editable height source. `Opening` принадлежит
  одной стене; Door и Window не создают navigation edge/transition и не имеют
  отдельной lock/access/open-close модели Alpha.
- Domain/application не импортируют React, renderer, DOM, browser storage,
  service-worker или network client. Использовать typed ports и plain
  serializable values; `domain → infrastructure/UI`,
  `application → concrete adapter` и `UI → persistence adapter` запрещены.
- Каждая mutation — атомарная Command: validated candidate сначала
  `PendingDurability`; только staging write + checksum + atomic pointer swap
  создают `Durable Revision` и HistoryEntry. Draft gesture не попадает в
  history; rejected command не меняет Project.
- 2D/3D runtime objects disposable projections. WebGL 2 — alpha baseline;
  WebGPU только progressive enhancement. Render-on-demand и adaptive quality
  никогда не меняют canonical geometry, accuracy или history.
- Derived Room surfaces в Plan и 3D display-only: они не имеют selection state,
  picker или property panel; tap по Room не создаёт mutation/history. Alpha не
  содержит metadata/surface-finish flow и не возвращает canvas-based Room
  selection.
- По принятым REL-05/FR-16 редактор меняет тип и высоту Room; persisted
  `Room.name` сохраняется для совместимости, name-edit UI не возвращается.
  FR-9/REL-08 сохраняют автоматическое точное T/X splitting при topology
  commands; отдельного split-жеста Alpha нет.

## Local data and Catalog Control Plane boundary

- User Project, Revision, session History, Portable Backup и exact pinned
  asset bytes строго local-first. Browser/iOS Home Screen — отдельные local
  contexts; перенос делается self-contained backup, не общей storage зоной.
- Project writer lease fences одну writable context. Project удаляется только
  после явного confirm и окончательно; промежуточного delete-state и undo-route
  в Alpha нет, а user
  projects никогда не удаляются автоматически.
- Каждая referenced resource должна быть pinned по exact bytes и пройти
  `BackupFeasibilityPolicy` до Durable placement/resource-backed
  `AssetVariant` selection. Undo и
  redo resources остаются GC roots по `SessionRetentionPolicy`.
- Missing/corrupt referenced bytes переводят Project в read-only
  `ResourceRecoveryRequired`; выход — only verified exact-byte repair либо
  один полный atomic `RecoveryChangeSet`. History-only corruption допускает
  лишь explicit `DiscardSessionHistory` при healthy current Project.
- Kotlin/PostgreSQL Catalog Control Plane публикует только versioned catalog
  metadata/resources и hashes. Лицензирование, provenance, `AssetUsageGrant`,
  `assetUsageDeclaration`, attribution и notices не являются Alpha данными
  либо gate. Он никогда не принимает, не хранит, не синхронизирует и не
  восстанавливает Project/Revision/History/Backup или user-owned pinned blobs.
- Remote access идёт только через `CatalogGatewayPort`. Outage допускает только
  non-blocking `control-plane-unavailable` или
  `unpinned-download-unavailable`: fully pinned local Project продолжает
  open/edit/Durable save/local undo-redo/export. Outage сам по себе не создаёт
  `ResourceRecoveryRequired`; proposed placement остаётся cancelable и не
  становится Durable до local pin + policy pass.
- Alpha owner использует только бесплатные либо созданные им модели; это
  операционный отбор вне приложения. Любой catalog/custom resource внутри
  продукта проходит AD-14/S-6 technical format/size/hash/pin/backup route.
- Роман Желтов — единственный accountable product decision owner Alpha, но
  required independent reviewer и participant evidence нельзя заменить его
  self-review.

## Mobile PWA

- Phone-first Web/PWA сохраняется в S0–S7 наряду с новым Telegram target;
  desktop authoring не задаёт Alpha UX.
  `NFR-15` закрыт Product Owner functional-проверкой на iPhone 15 Pro Max и
  Samsung S24 Ultra в browser/PWA contexts. Exact-device matrix, thermal и
  quantitative performance certification не являются Alpha gate.

## Telegram extension — CAP-13 / FR-55–58 / AD-25–29

- Уточнённый S2 fencing disposition — обязательный companion SPEC: scope Web
  Lock, atomic fenced stage/pointer/receipt, no-ABA IDs, conditional no-publish
  и pin cleanup, conservative retention при неопределённости. Runtime-local
  queue недостаточна; старый browser recover к Telegram не подключать.
  Общего scope-wide GC в baseline нет и в S2 он не вводится. Session roots
  одного controller не доказывают root inventory остальных contexts.
- AD-30 — предложенная wire/legacy disposition, не активная регистрация формата.
  PPJ-A1 остаётся строгим; S3 ждёт закрытых versioned tables и exact compatibility
  решения/evidence. Internal serializer, DB names/schema и прежние revision
  bytes/checksums не заменяются ради нового portable wire.

- Общие domain/application, codecs, renderer и редактор обслуживают две
  оболочки. SDK и `window.Telegram` доступны только host adapter, не ядру;
  browser entry не зависит от Telegram. Отдельные entry/output/origins не
  должны наследовать DEV mass unregister/cache cleanup или повреждать PWA.
- AD-26 фиксирует инженерное assumption: raw signed initData проверяется
  Ed25519 с trusted bot/environment до runtime/DB/GC. Нет identity/crypto —
  нет общего writable fallback. Это локальный namespace, не серверная
  авторизация; bot token и Project upload не требуются и не разрешены.
- Один immutable scope охватывает все stores/resources/library/journal,
  history/GC roots, writer/takeover и preferences. Serialized barrier,
  generation и teardown отвергают поздние операции; старые данные не удаляются.
  Host activation не удостоверяет аккаунт, физическое разделение проверяется
  отдельно до writable release клиента.
- Back/Close и viewport/lifecycle следуют UXF-8 и ноябрьским REL/FUP. Draft
  не подтверждается автоматически; pending/failure/recovery не называются
  saved. Подготовленная offline continuity Telegram отличается от PWA cold
  offline; readiness lazy modules/resources наблюдаема по каждому режиму.
- ReleaseManifest/schema guards нужны и без worker. Immutable release/lazy
  URLs сохраняются без автоматического удаления до безопасного отдельного
  retirement решения по AD-28, включая rollback. Каталог остаётся catalog-only.
- PPJ-A1 и фактический baseline V1 используют конфликтующий selector при разных
  формах. До зависимого S3 нужна source-owner disposition и реальные файлы;
  parser/registry не ослабляются, legacy не promoted/migrated автоматически.
  Это не отдельное разрешение S1: он тоже требует применимого readiness.
- File preparation/click/API не подтверждает внешний backup. NFR-28 требует
  отдельного Telegram iOS/Android evidence и обоих направлений внешнего файла;
  bridge fake и NFR-15 не заменяют его. При невозможности локальной передачи
  альтернативу и privacy/retention отдельно решает владелец; upload запрещён.
- Конечная цель владельца — Telegram-only после его проверки; в S0–S7
  сохраняются Web/PWA, данные и проверки. Retirement требует отдельного допуска,
  доступа к старым данным, проверенного переноса и rollback по FR-58/AD-25.

Решение владельца 2026-11-04: PRD/SPEC/AD-14 сохранены без формального
AssetUsageGrant; AGENTS приведён к этому правилу. Владелец отбирает бесплатные
или собственные модели вне приложения. Технические проверки ресурсов и запрет
передачи пользовательских файлов серверу сохраняются.

## Tests and evidence

- Каждый code change следует TDD и оставляет type/lint/required mutation checks
  green. Geometry, commands, migrations, asset validation и backup тестируются
  без UI через ports/fakes; browser tests не заменяют domain tests.
- `@rstest/core` `0.11.5` + `@rstest/adapter-rspack` `0.11.5` — для TypeScript
  domain/application и DOM-independent UI-state seams с Rspack-facing config.
  Не назначать Kotlin tests JavaScript runner до отдельного backend decision.
- `@playwright/test` `1.62.1` — обязательная browser/mobile/PWA/offline
  regression после каждой доработки. Он дополняет, но не заменяет
  зафиксированную Product Owner physical functional-acceptance `NFR-15`.
- Не представлять functional-проверку двух устройств как универсальный
  hardware benchmark; screenshots/emulation остаются synthetic browser evidence.

## Naming and operational rules

- Пользовательские и продуктовые документы — на русском; code identifiers —
  English terms from SPEC glossary. Не переиспользовать `CAP-*`, `FR-*`,
  `NFR-*`, `AD-*` и не вводить синонимы закреплённых domain terms.
- IDs opaque/branded; units именуются `Mm`, `Mm2`, `Bytes`, `Radians` или
  discrete-angle type. Persistence использует explicit `schemaVersion`;
  mesh/indices не сериализуются как source of truth.
- Errors — stable reason-code discriminated unions; UI локализует их без
  изменения semantics. Logs structured и не содержат asset bytes, file paths
  или user names; telemetry только по consent.
- Новые Product/Architecture решения меняют документ владельцем источника
  истины (PRD/SPEC/Architecture/UX), а `project-context.md` только конденсирует
  уже утверждённое правило.

## Usage

- AI-агент читает этот файл до любой реализации и при сомнении выбирает более
  строгую трактовку SPEC/Architecture.
- Человек обновляет его после утверждённого изменения стека или правила, а не
  вместо owner workflow; периодически убирает ставшие очевидными пункты.

