---
title: "Telegram Mini App — S0 preflight и пакет согласования"
date: 2026-11-04
owner: Roman
status: owner-workflows-complete-remediation-in-progress
implementation_readiness: epic-10-needs-work-s1-ready-s2-local-ready
canonical_spec_changed: true
application_code_changed: false
---

# S0: фактический baseline и согласование Telegram-расширения

Шесть S0 owner workflows завершены; замечания общего Epic 10 устраняются по
принадлежности источников. Это preflight и история исходного baseline, а
официальный verdict находится в [BMAD readiness report](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-11-04.md):
Epic 10 `NEEDS_WORK`, независимый S1 / Story 10.1 `READY`.
Сам S0 не менял application code/config/tests/data. После применимого gate
отдельно реализован и проверен [S1](../docs/progress/telegram-extension-2026-11-04/S1/README.md).
Коммитов, выпуска и удаления Web/PWA нет.

## Направление владельца

Последнее указание 4 ноября: сначала сохранить работающие Web/PWA и добавить
Telegram на общем ядре, дать владельцу проверить работоспособность, подготовить
последующий переход на Telegram-only. Само удаление сейчас не выполняется.
Направление внесено в [задание](telegram-mini-app-extension-spec-2026-11-04.md),
включая отдельный retirement gate в разделе 15. Ближайшая поставка — S0–S7
с сохранением Web/PWA; будущий retirement не отменяет их текущие требования.

Облачная синхронизация, передача Project/GLB/backup на сервер, автоматическая
отправка боту и коммиты не разрешены этим направлением.

## Прочитанные источники

Команда полностью прочитала исходную Telegram-спецификацию, PRD, SPEC и все
14 путей из его `companions`: 17 уникальных файлов, 6 135 строк до текущей
правки задания. Architecture Spine и project-context входят в companions.

- [AGENTS](../AGENTS.md), [BMAD integration](../docs/BMAD-INTEGRATION.md),
  установленные manifest/skill-manifest и относящиеся к S0 инструкции skills;
- [SPEC](../_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md);
- все companions: glossary, geometry, topology corpus, editor interaction/grid,
  asset import, performance, project/backup, portable ingress registry,
  catalog control plane, implementation evidence 18 августа, UX DESIGN,
  UX EXPERIENCE, Architecture Spine и project-context;
- [PRD](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md);
- [release UX](../contracts/alpha-release-ux-2026-11-01.md) и
  [follow-up UX](../contracts/alpha-release-ux-followup-2026-11-01.md);
- [доставка 1 ноября](../docs/progress/delivery-2026-11-01-followup/README.md)
  и [каталог 2 ноября](../docs/progress/catalog-recheck-2026-11-02/README.md);
- README, текущие scripts/configuration, исторический final readiness
  30 августа и ограниченные implementation/evidence waivers.

Read-heavy аудит разделён между независимыми агентами; canonical artifacts
никто параллельно не редактировал. Сохранённые отчёты прочитаны как история,
а свежие результаты приведены отдельно ниже.

## Фактическое состояние

- Реализован один target `apps/web`: React 19.2.8, TypeScript 7.0.2,
  Rspack 2.1.8, CSS Modules, Three.js/WebGL2. Telegram target/adapter отсутствует.
- `apps/catalog-control-plane` — Kotlin/Ktor/PostgreSQL, только каталог.
- Реализованы Project/durability/fencing, integer-mm PlanGraph, стены
  0°/45°/90°, rooms/openings, floor/wall placement, 2D/3D, session undo/redo,
  recovery, Web/PWA/offline и `.interiors`.
- Alpha Epics 1–8 приняты в историческом трекере; Epic 9 custom GLB остаётся
  Alpha+: две истории `in-progress`, одна `backlog`. FBX/ZIP не повышается
  из эксперимента в принятый контракт. PNG, Focus/fullscreen, Walk, finishes
  и независимые варианты проекта не возвращаются в scope.
- Действующий исторический финальный verdict 30 августа — `READY`; прежние
  `NOT_READY` внутри того же отчёта являются историей. Он не оценивает Telegram.
- Существующая локальная сборка `ccdd13662cdca379` заявляет schema version 1
  readable/writable для Project/assets/catalog. Это чтение готового manifest,
  а не новая сборка или доказательство всех контрактов.
- Git не содержит tracked-файлов: `git ls-files` вернул 0. Существующие untracked
  файлы сохранены; clean/reset/stage/commit не выполнялись.

Ноябрьский UX сохраняется: свойства стены открываются явно, нет разворота
стены и dock-delete, выделяется тело стены; перенос проёма имеет подтверждение
без редактирования размеров; нет боковых акцентных полос и старых подсказок.

## Свежие проверки 4 ноября

Выполнены из корня через существующие npm scripts, запускающие закреплённые
Node 24.19.0 и pnpm 11.20.0. Зависимости и runner не менялись.

| Команда | Фактический результат |
| --- | --- |
| `npm run check:architecture` | PASS: 15/15 проверок плюс production boundary/import graph |
| `npm run lint` | PASS: 345 файлов, без исправлений |
| `npm run typecheck` | PASS: обе существующие TypeScript конфигурации |
| `npm test` | PASS: 143 файла, 2030/2030 тестов, 0 skipped/todo |

Это baseline, а не приёмка Telegram. Build, полный browser/PWA, backend,
mutation, физические Telegram iOS/Android и внешняя публикация в этом срезе
не выполнялись. Исторические 333 browser/10 PWA/39 backend не объявляются
сегодняшним прогоном. После изменения соответствующего пути нужны его RED,
GREEN, required mutation и применимый browser/PWA regression.

Перед официальным readiness выполнена сверка SHA-256 547 исходных файлов
apps/contracts/scripts/CI/package с началом S0. Единственное изменение в этом
наборе — `apps/web/README.md`; non-document changes: **0**. Существующие тесты,
код, конфигурация и точные каталожные ресурсы не менялись.

Baseline готового `dist` build `ccdd13662cdca379`, измеренный по текущему
`index.html` и `sw.js APP_SHELL`, без пересборки: startup JS 197 173 bytes +
CSS 760 bytes = **197 933 bytes**; текущие JS/CSS shell resources — 28 файлов,
**1 737 498 bytes**. Из них editor JS 681 725, editor CSS 116 177 и Three.js
719 484 bytes. Это raw artifact bytes, не network/gesture timing. В output
сохранены семь старых chunks; они исключены из суммы текущего release и
сохраняются для уже открытых клиентов.

## Карта затронутых границ

| Путь | Наблюдение | Минимальное направление |
| --- | --- | --- |
| `apps/web/src/main.tsx` | Install/update, root worker; DEV массово удаляет workers/caches | Оставить browser-owned entry; не подключать cleanup в Telegram |
| `apps/web/src/app/editor-app.tsx` | Module singleton создаёт runtime до выбора host/scope | Передавать уже выбранный runtime; избежать второго discarded controller |
| `apps/web/src/app/production-app.ts` | Store/resource/journal/writer hardwired | Один immutable scope до создания всех adapters |
| `apps/web/src/app/browser-ports.ts` | sessionStorage writer/takeover keys | Browser defaults неизменны; отдельные Telegram keys |
| `apps/web/src/adapters/persistence/indexeddb-*.ts` | Project DB, resource DB и journal связаны разными точками создания | Scope охватывает все базы, staging, history/GC roots и writer lifetime |
| `apps/web/src/ui/AppShell.tsx` | Preferences, lifecycle, import/export, navigation в большом файле | Только нужные host seams; без переписи всего UI |
| `apps/web/src/ui/PlanProjection.tsx` | Screen/plan transform и gestures | Stale viewport/keyboard transform не публикуется |
| `apps/web/rspack.config.mjs` | `clean:true`, root paths, manifest+SW coupled | Второй entry/output; ReleaseManifest без обязательного SW |
| `apps/web/public/sw.template.js` | Root scope и общие prefixes | Существующий PWA worker сохранить; отдельный origin Mini App |
| `apps/web/src/application/*portable-backup*` | Общий codec/staging | Фактические current-file roundtrips до обещания совместимости |
| Catalog gateway/backend | `/catalog-api`, credentials omit; Cookie/Authorization rejected | Proxy/CORS доставки отдельного origin без Project upload и TG token |

Дополнительная read-only проверка доставки: живой preview на `127.0.0.1:4175`
работает с cwd `apps/web` и читает его `dist`; процесс cloudflared также
работает. Обычный build с `clean:true` способен изменить текущую телефонную
версию. После допуска новые build/browser/PWA проверки должны использовать
изолированные output/preview, сохраняя live dist, retained chunks и процессы.
Это не новая публикация и не разрешение остановить существующий запуск.

Для разработки — отдельные порты; для выпуска — отдельный стабильный origin
Telegram при сохранении действующего Web/PWA origin. Реальные домены/бот не
выдумываются. Общее ядро остаётся в существующем workspace; отдельное приложение
с копией редактора не нужно.

## Конкретный пакет правок документов-владельцев

Порядок ниже сохраняет ownership. Это предлагаемые изменения для следующих
workflow, а не молчаливые изменения canonical sources.

| Workflow / документ | Содержание изменения | Сохраняемые требования |
| --- | --- | --- |
| `bmad-prd` / PRD | Матрица browser / installed PWA / Telegram; локальный account scope, online cold launch только Telegram; readiness/device evidence отдельно; deferred retirement | FR-1/2/4/5/41–45/47/54; NFR-1/10–26; CAP-9 остаётся активной |
| `bmad-ux` / DESIGN + EXPERIENCE | Future Telegram становится текущим расширением; Back/Close matrix из TMA-07, draft/pending/failure/recovery, theme/viewport/keyboard, account/file states | Ноябрьские REL/FUP и привычный Web/PWA Back; без retired fullscreen |
| `bmad-architecture` / Spine | Два entry/output, отдельный origin, scoped runtime до DB open, teardown/generation guards, no-worker manifest handshake, file adapter, catalog delivery | AD-1–4/7/9–14/16–17/20–24, renderer disposable, catalog-only backend |
| `bmad-spec` / SPEC + companions | Derive после upstream updates; platform applicability, сохранение CAP IDs и новых принятых companions | CAP-1–11; CAP-12 только в принятом Alpha+ scope |
| `bmad-create-epics-and-stories` / downstream | Тонкие S1–S7, TMA ↔ CAP/FR/NFR/AD ↔ проверки; retirement отдельно после owner check | Без перенумерации и без нового поведения из roadmap |
| `bmad-check-implementation-readiness` | Новая оценка именно расширения по согласованному пакету | Исторический READY не переименовывается и не подменяет gate |

После владельческих изменений кратко синхронизировать `project-context.md`,
фактический phase в `AGENTS.md`/BMAD integration и устаревший `apps/web/README.md`.
Исторические отрицательные отчёты и checkpoint evidence не переписывать.
Владельцы назначили FR-55–58/NFR-28, AD-25–29 и CAP-13;
retired FR-53/NFR-27 и UXF-7 не переиспользуются.

## Трассировка задания и будущих доказательств

| TMA | Canonical anchor | Этап / проверка |
| --- | --- | --- |
| 01 | CAP-2–8/11, AD-2/3/13 | S1: общий доменный результат, SDK/browser запреты в ядре |
| 02 | CAP-1/9, FR-41, AD-16 | S1/S2: независимый browser entry; invalid host/SDK timeout без записи |
| 03 | CAP-9, FR-41, AD-11/16 | S1/S7: старый root worker, два output, immutable chunks, без cross-cleanup |
| 04 | CAP-1/10, FR-47, NFR-24–26 | S1/S2/S7: manifest handshake без SW, несовместимая схема, старый клиент |
| 05 | CAP-2–8/11, FR-6–19/21–23/25–33/38–40 | S2/S4/S5: одинаковые команды/геометрия, save/reopen и fallback |
| 06 | CAP-11, NFR-16–20, AD-10/13 | S4: 360px/200% текста, theme/safe area/keyboard без mutation |
| 07 | CAP-2/8, AD-3/7/10 | S4: Back во всех состояниях, второй pointer, stale transform |
| 08 | CAP-1/5/8, AD-3/4/12/13 | S2/S5/S6: фон/kill/fence/WebGL, dispose без дублирования |
| 09 | CAP-9/11, FR-42/43, AD-11 | S6: сеть до/после подготовки lazy modules/resources; отдельный PWA cold offline |
| 10 | CAP-1/8/10, FR-1/2/4/5, AD-4 | S2: A→B→A, late result/GC, неизменный browser namespace |
| 11 | CAP-1/8/10, NFR-11–13, AD-3/9 | S6: quota/crash/resource repair/history roots без потери durable |
| 12 | CAP-10, FR-44/45, NFR-1/12/21 | S3: оба направления current backup, новый ID, 0 mm drift, exact hashes |
| 13 | CAP-10, FR-44/45, AD-9 | S3: file size до чтения, cancel/retry, внешний файл и повторный import на устройствах |
| 14 | CAP-1/9, NFR-21–23, AD-2/4 | S2: host/identity trust design без сервера Project, токенов и PII logs |
| 15 | CAP-6/7, FR-26–28/33/54, AD-14/17/24 | S5: реальные floor/wall bytes, pin/hash/range/cancel/outage на двух target |
| 16 | NFR-21–26, AD-16/17/24 | S7: runbook, versions/reasons без содержимого, отдельный rollback |

TMA-AC-01–13 пока **не оценены для реализации Telegram**. Unit baseline
показывает сохранность текущих проверок, но не закрывает эти критерии.

## Обнаруженные конфликты и зависимости

1. Planning-only формулировки в AGENTS, project-context и BMAD integration
   противоречили фактическому коду и final READY 30 августа. Phase facts в
   AGENTS/BMAD integration и app README уточнены координатором; настоящий
   gate расширения сохранён. После SPEC project-context также конденсирован
   по новым owner-документам без новых требований или licensing-решения.
2. AGENTS требует human-approved `AssetUsageGrant`, а действующие PRD/SPEC/
   AD-14/catalog companion исключают legal/grant admission. Конфликт передан
   владельцу этим отчётом; Telegram-задача не меняет ни одну licensing policy.
   Readiness должен явно оценить применимость этого конфликта, не скрыть его.
3. Исторический `implementation-evidence-2026-08-18.md` содержит superseded
   performance/Focus/grants условия. Использовать текущие принятые решения,
   не выдавать checkpoint за новый gate.
4. Export V1 и canonical serializer фактически отличаются от нормативного
   PPJ-A1: root `projectSchemaId` и numeric representation. S3 должен доказать
   current-schema compatibility настоящими файлами; permissive legacy parsing,
   округление и скрытая promotion не допускаются.
5. Выдача blob-anchor не доказывает внешний backup. [Официальный Telegram API](https://core.telegram.org/bots/webapps#downloadfileparams)
   требует HTTPS URL для `downloadFile`; [host events](https://core.telegram.org/api/web-events)
   не доказывают физическое сохранение локального файла. Оба источника открыты
   4 ноября. Нет разрешения решать проблему скрытым upload.
6. Identity/trust design до writable S2; scope — организация локальных данных,
   не server authorization. Missing identity не открывает общий writable fallback.
7. Реальные bot/HTTPS/origin и доступ к iOS/Android нужны только для зависимого
   запуска/physical evidence. Они не заменяются bridge fake и не блокируют
   независимую локальную работу после действующего planning gate.

## Как подготовить последующее удаление Web/PWA

Фактический [retirement inventory](web-pwa-retirement-inventory-2026-11-04.md)
перечисляет конкретные кандидаты, смешанные обязанности и сохраняемое ядро.
S1 выделил первую browser-owned composition границу; удаление не разрешено.

Во время S1–S7 обозначить browser-owned composition/install/SW/manifests/build
и отдельные PWA delivery tests, оставляя их работающими. Общие domain,
application, codecs, persistence, renderer, UI, каталог и их тесты сохраняются
для Telegram; имя папки `apps/web` не означает, что её можно удалить целиком.

До удаления нужны: приёмка Telegram владельцем, соответствующие TMA-AC,
проверенные внешние backups/перенос прежних данных, решение о доступе старых
пользователей к своим local contexts, rollback и явный допуск к retirement.
Смена origin не переносит IndexedDB. Удаление старого frontend не имеет права
запускать remote/local wipe, удалять пользовательские проекты или внезапно
обрывать доступ к единственной исходной копии. До retirement gate PWA tests
не удаляются и budgets не ослабляются.

Общие browser API crypto/UUID/time/IndexedDB и release handshake всё ещё нужны
Telegram WebView. Их нельзя удалить вместе с PWA. Сигналы безопасности draft
`onPwaUpdateSafetyChange` в 2D/3D тоже выражают общую несохранённую работу и
должны остаться доступными host Close даже при последующем переименовании.

## Процедурная граница следующего действия

[BMAD integration](../docs/BMAD-INTEGRATION.md#рабочая-модель-document-only)
требует: «Каждый workflow выполняется в новой отдельной задаче/чате».
Раздел 13 задания повторяет свежий чат и запрещает создавать пользовательские
чаты автоматически без поручения. Поэтому ни один из шести owner workflows
выше в этом чате не запускался; read-only subagents не выдаются за эти workflows.

4 ноября владелец явно ответил: «Разрешаю создать и вести шесть отдельных
BMAD-чатов». Процедурное разрешение получено; повторно запрашивать его не нужно.
Оно касается организации workflow, не является waiver readiness/данных/privacy
и не подразумевает коммит. До нового READY или отдельного допустимого written
waiver новая application code реализация не начинается.

| Порядок | Workflow | Чат | Состояние |
| --- | --- | --- | --- |
| 1 | PRD update | `01a1a606-b565-7d33-b570-027599a9b531` | Финализирован; FR-55–58/NFR-28, [результат](telegram-mini-app-s0-prd-result-2026-11-04.md); source conflict и условный file-transfer выбор открыты |
| 2 | UX update | `01a1a60c-0805-7e33-a108-e137519db6fc` | Финализирован; UXF-8, [результат](telegram-mini-app-s0-ux-result-2026-11-04.md); реальные host/file/device evidence pending |
| 3 | Architecture update | `01a1a612-555c-75c3-a383-1f3dfdadf170` | Финализирован; AD-25–29, S2 fencing disposition и AD-30 proposal, [результат](telegram-mini-app-s0-architecture-result-2026-11-04.md); S3 registration/physical evidence открыты |
| 4 | SPEC derive | `01a1a619-eadb-7470-8caa-e48d46425547` | Завершён; CAP-13 + platform companion, [результат](telegram-mini-app-s0-spec-result-2026-11-04.md); S3 format disposition открыта |
| 5 | Epics/stories update | `01a1a621-1e44-7ef1-bee5-9d5183e8f079` | Завершён; Epic 10 / Stories 10.1–10.15, [результат](telegram-mini-app-s0-epics-result-2026-11-04.md); TMA/AC coverage, roadmap и traceability синхронизированы |
| 6 | Implementation readiness | `01a1a63b-6359-7953-8162-3cf6fb1fd1ea` | Завершён с повторной оценкой: Epic 10 NEEDS_WORK; S1 READY/verified; локальная реализация полного уточнённого S2 READY, фактически пока partial. [Результат и применимость остальных scopes](telegram-mini-app-s0-readiness-result-2026-11-04.md) |

## Текущее продолжение после S0

S1 выполнен в узкой browser-only границе: общий editor импортируется без
создания browser writer/runtime; browser wrapper сохраняет прежний lifetime и
startup. Свежие 2044 unit, оба typecheck, lint 350, architecture 15 + graph,
isolated build, 6 dev browser + 10 PWA + 1 old-worker upgrade и mutation 97.67%
описаны в [S1 evidence](../docs/progress/telegram-extension-2026-11-04/S1/README.md).
Live preview/dist не менялись. Это не приёмка Telegram.

После первоначального NEEDS_WORK owner workflows уточнили всю AD-26 защиту
перед первой записью Story 10.2 и согласовали FR-16/REL-05, FR-9/REL-08.
Readiness owner завершил повторную оценку этих исправлений. S3 format disposition и
конфликт human-approved AssetUsageGrant остаются открытыми; licensing вопрос
отправлен владельцу, ответа пока нет. Зависимые работы не получают разрешения
из одного S1 READY. Физические bot/client/file/release evidence остаются pending.

После локального planning READY начат [S2](../docs/progress/telegram-extension-2026-11-04/S2/README.md):
signed-launch validator и runtime session queue проверены изолированно. Общий
unit suite — 2060/2060; TS, lint357 и architecture PASS. Telegram entry/runtime
не подключены и запись Project не включена. Новая фактическая сверка
выявила неполный baseline staging/journal protocol и отсутствие general GC;
Architecture и SPEC закрепили S2 fencing disposition с межконтекстным Web Lock,
атомарными predicates/receipt и conservative retention. Epic/readiness owner
согласовали уточнённый пакет; локальная реализация полного S2 имеет READY.
Это не полный S2 PASS.

Следующий bounded S2 increment добавил отдельный scoped metadata store и
устойчивые uint64 operation IDs под Web Lock со strict IDB durability. 18 native
browser cases проходят. Full-file browser mutation: 218 mutants, 77.52%; все49
survivors разобраны, девять значимых test gaps обнаружены двумя адресными
follow-up после усиления tests. Это не новый полный mutation score. Substrate
проверяется test-only entry, не подключён к product entry/Project save и не
заменяет весь publication/receipt/resource protocol. Актуальные evidence и
ограничения — в S2 отчёте выше.
