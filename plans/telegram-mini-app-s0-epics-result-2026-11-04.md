---
title: "S0 Telegram Mini App — результат Epics and Stories"
date: 2026-11-04
workflow: bmad-create-epics-and-stories
status: complete
implementation_readiness: assessed_needs_work_for_epic_10
---

# Результат

В существующий backlog добавлен Epic 10 с 15 вертикальными stories 10.1–10.15.
Исторические Epic 1–9, Story IDs и принятая история сохранены; новый scaffold,
story implementation files и application/build/test/config artifacts не создавались.
Web/PWA, его данные и проверки сохраняются на S0–S7; удаление browser-owned частей
остаётся отдельным отложенным решением после owner check и retirement gate.

## Изменённые файлы

- [Epics и stories](../_bmad-output/planning-artifacts/epics.md): extraction,
  Epic 10, Stories 10.1–10.15, TMA/acceptance coverage и финальная document audit.
- [Roadmap](../_bmad-output/planning-artifacts/roadmap-to-alpha.md): additive
  S0–S7 с CAP/FR/NFR/AD, story dependencies и ожидаемым evidence.
- [Traceability](../_bmad-output/planning-artifacts/traceability-matrix.md):
  FR-55–58/NFR-28/UX и все TMA-01–16/TMA-AC-01–13 связаны с каноническими
  источниками, stories и будущими доказательствами.
- Этот результат. `.memlog.md` не изменялся.

## Покрытие и проверка

S1 — 10.1; S2 — 10.2–10.3; S3 — 10.4–10.5; S4 — 10.6–10.7;
S5 — 10.8–10.9; S6 — 10.10–10.12; S7 — 10.13–10.15. Каждая story содержит
actor/trigger/outcome, production path, минимальную ценность, одного owner,
AC, RED→GREEN, required mutation и regression. Структурно проверены 15 IDs,
16 TMA, 13 TMA-AC, 12 UX и 8 roadmap этапов; файловые ссылки roadmap/матрицы
разрешаются. Покрытие — план, не evidence выполненного продукта.

Фактические application tests, build, mutation, physical Telegram checks и
публикация не выполнялись. Historical READY и существующие baseline tests не
являются acceptance Telegram. Действующий preview, процессы и live dist не
изменялись; будущие проверки изолируют outputs и сохраняют retained chunks.

## Остаются открытыми

1. [Отчёт readiness 2026-11-04](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-11-04.md) зафиксировал `NEEDS_WORK` для всего Epic 10 и отдельный узкий технический `READY` для S1 / Story 10.1 с принятой применимостью owner-поручения в границах отчёта. Коррекция S2 не является новым verdict; применимые approval/readiness либо waiver необходимы для прочего implementation.
2. SPEC зарегистрировал selectors и закрытые PPJ/V1 routes. Исторический
   source-registration blocker снят; engineering при применимом gate выполняет
   implementation, worst-case и legacy recovery proof. Реальные build/files и
   physical transfer остаются gates совместимости и приёмки, не требованием
   готового доказательства до начала кода.
3. Прежний licensing source conflict разрешён владельцем 2026-11-04: AGENTS
   согласован с PRD/SPEC/AD-14, формальный AssetUsageGrant и licensing admission
   не являются Alpha gate. Владелец выбирает бесплатные/собственные модели вне
   приложения; технические проверки ресурсов и pin остаются обязательными.
4. Реальные bot, стабильные HTTPS origins, client identity/Ed25519, account
   isolation, lifecycle/storage, физические iOS/Android, внешний файл/reselect
   в обоих направлениях и release/rollback evidence — pending. Если local
   handoff фактически невозможен, только Product Owner отдельно выбирает
   alternative/privacy/retention; скрытый upload или bot delivery не разрешены.
5. Системы выпуска, внешняя публикация и возможный Web/PWA retirement — отдельные
   действия и решения; readiness, physical acceptance и owner verification не
   смешиваются.


## Коррекция после readiness review — завершена

Реальное замечание S2 исправлено в Stories 10.2–10.3 и синхронизировано с
roadmap/traceability: immutable scope, generation, serialized barrier, teardown,
межконтекстный fence, journal/GC coordination и controlled races обязательны
**в 10.2 до первого writable publish**. Story 10.3 расширяет A→B→A, edge cases и
physical client release evidence и не поставляет обязательные guards задним
числом. RED→GREEN и required mutation проверяют commit/journal/GC, поздние async
results, A→B→A и сохранность roots/scopes; никакие проверки ещё не выполнены.

PRD owner согласовал FR-16 / REL-05 и FR-9 / REL-08: type/height сохраняют
историческое Room.name, отдельный split UI не обещается, контакты нормализуются.
SPEC-owner подтвердил reconciliation CAP-2/3. Project-context называет type/height
route, но общая фраза о metadata требует уточнения; применимый readiness recheck
остаётся отдельным до принятия затронутой parity Story 10.6. S1 позже выполнен и проверен на отдельном origin со старым shell/worker:
[фактический отчёт S1](../docs/progress/telegram-extension-2026-11-04/S1/README.md).
Два mutation timeout и граница привязки всех прогонов к снимку исходников описаны
в readiness result; это не evidence полного S2 или S7 lazy rollback. На момент
этой исторической записи licensing conflict был открыт; позднее владелец его
разрешил. Format evidence, устройства, local external handoff, отдельные release
и retirement decisions не закрыты.
Отчёт readiness и источники-владельцы в этом исправлении не изменялись.


## Source-owner S2/S3 remediation — исторический снимок до итоговой регистрации

SPEC-owner завершил source reconciliation и принял полный [S2 fencing
disposition](../_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md)
в companions. Story 10.2 теперь требует до первого writable create/import/repair/
delete scope Web Lock, атомарные fenced stage/pointer/receipt, монотонные uint64
no-ABA IDs, no-publish/conditional cleanup, atomic resource protect/pin, safe
takeover/adoption и conservative retention при неясном результате. Старый browser
bulk `recover()` не запускается для Telegram. Общего GC в baseline нет, S2 его
не создаёт: сохраняются bytes/roots и проверяются реальные exclusive pin cleanup
и reconciliation; SessionRetentionPolicy не отменена. Полный source race corpus
перечислен в Story 10.2 и остаётся обязательным. Story 10.3 расширяет A→B→A и
physical evidence, не откладывает guards до поздней истории.

Источники identity различаются: официальный Telegram задаёт Ed25519 protocol и
keys; Telegram-signed positive vector опубликован независимыми tma.js maintainers,
не официальным SDK. Fixed test clock для старого fixture не отключает production
freshness. На текущем срезе имеются standalone validator и session queue, но не
Telegram runtime/storage и не S2 PASS. [Проверенный S1](../docs/progress/telegram-extension-2026-11-04/S1/README.md)
не заменяет S2 или полную Telegram acceptance.

**Исторический статус на момент этой записи:** AD-30 ещё не был зарегистрирован
SPEC; ниже приведено последующее итоговое обновление. Истории 10.4–10.5 дополнены требованиями
FR-57: ambiguous empty V1 не угадывается, source bytes сохраняются; наличие
старой Web/PWA не доказывает восстановление. Нужны проверка конкретных old
context/build → восстановление → новый exact export, полная wire grammar/
routing, решение `-0`, реальные файлы и физический roundtrip. Единственная
неоднозначная копия без проверенного пути требует адресного решения owner до
зависимой acceptance. Нельзя переписать IDB, Revision или checksums, ухудшить
PPJ limits/error precedence или заменить старый export/recovery без доказанного
FR-44 envelope для всех non-corrupt Durable Projects.

На момент этого исторического снимка licensing conflict оставался открыт; позже
он разрешён владельцем. Реальные bot/origins, физическая client/account isolation,
NFR-28 и внешний file handoff, release/rollback и отдельный retirement gate
остаются отдельными условиями. Новое source disposition и этот downstream update требуют независимого
применимого readiness recheck; никаких новых READY, physical approval, кода,
тестового прогона, сборки, commit или публикации в этом workflow нет.


## Итоговое обновление AD-26 / AD-30 для readiness owner

Architecture и SPEC согласовали единый `interiors-editor-projects:<scope>` IDB
v2: atomic upgrade v1 не меняет identity/protocolVersion/counter и abort-ит
unknown/corrupt inventory, blocked/late callbacks не выполняют upgrade вне lock;
обычные writes требуют проверенной strict durability. Полный scoped Web Lock,
prepared/published/no-publish/receipt, atomic resource pin/protect, monotonic
no-ABA IDs и conditional cleanup/recovery обязательны до первой writable операции.
Undo/Redo переводит pointer только на exact owned Revision с новым attempt/receipt,
не переписывая Revision и не создавая новую semantic Revision. Общего GC нет,
Telegram не вызывает browser bulk recover. Stories 10.2–10.3 содержат полный
source corpus, включая upgrade и owned-history races.

SPEC зарегистрировал PPJ-A1, закрытый `runtime-v1-wire@1` и conservative
V1-legacy с historical-byte equality и PPJ-disjoint witness. Stories 10.4–10.5
и build/file matrix покрывают single dispatch, PPJ precedence, -0/UTF-16/
own-undefined, bounded VariantValue, точные ресурсы, source bytes/checksums и
copy-on-write. Реализация и исполняемый worst-case/legacy recovery proof
выполняются после применимого gate; готовый proof не требуется заранее как
условие начала кода. До замены browser exporter/заявления совместимости нужны
proof FR-44/NFR-13, проверка конкретных build/files, old context → upgrade → new
exact export и отдельная физическая приёмка. Если sole-copy без witness не имеет
проверенного recovery path, Product Owner решает адресный FR-57 case; файл не
объявляется corrupt только из-за отсутствия witness.

S1 verified. Bounded S2 v2/queue имеет [26/26 native](../docs/progress/telegram-extension-2026-11-04/S2/storage-v2-composite-green.log)
и [2072/2072 unit](../docs/progress/telegram-extension-2026-11-04/S2/base-bound-unit-green.log)
в ранее выполненных отдельных прогонах; это не полное выполнение publication
protocol, подключение product entry, S2 story PASS или physical Telegram evidence.
Текущий workflow эти тесты не запускал. Общий Epic, bot/origins, physical account
isolation, file roundtrip и release/retirement остаются под своими gates; прежний
licensing conflict разрешён владельцем, формальный grant не требуется; новый READY или human approval не заявляется. При применимом
gate implementation идёт по утверждённому scope без остановки на каждом срезе,
при сохранении safety и внешних ограничений; никакой код в этом workflow не
изменялся.


## Решение владельца о catalog admission — 2026-11-04

Владелец явно выбрал сохранить правило PRD/SPEC/AD-14 без формального
AssetUsageGrant и обновил [AGENTS](../AGENTS.md). Бесплатные или собственные
модели отбираются владельцем вне приложения; licensing/provenance/declaration/
attribution/notice admission не является Alpha gate. Прежний blocker снят;
исторические readiness-отчёты не переписывались.

Технические resource format/size/hash/security validation, exact pin,
BackupFeasibilityPolicy, fencing, сохранность session history и запрет отправки
Project/files на сервер сохраняются. Это решение не доказывает S2/S3, physical
Telegram acceptance, файл roundtrip или release и не присваивает новый READY.

## AD-31 browser registered storage — downstream handoff 2026-11-05

Обновлены Stories 10.4–10.5, build/file matrix, roadmap и traceability по
согласованным PRD FR-45/57, SPEC CAP-10/§1.4, UX и AD-31. Explicit registered
import использует отдельный anonymous browser namespace и полный общий editor
path; прежние browser DB/schema/data/history/default routes не мигрируются.
FR-45 требует raw ID ≠ source и precheck обоих stores, но не обещает глобальную
межбазную атомарность; поздняя коллизия маршрутизируется по доверенной паре
`(namespace, raw ID)`. Все команды, History/resources/recovery/export и partial
failure входят в один scoped implementation gate; отдельный readiness review
ещё нужен. Старый полный offline backup FR-44 сохраняется для каждого healthy
нового Project и последующих допустимых edits/history.

[Конкретный пакет для readiness](telegram-mini-app-ad31-s3-stories-readiness-handoff-2026-11-05.md)
содержит source links, границы, полную матрицу local evidence и разделение
implementation gate и release/physical acceptance. Этот document update не
заявляет READY, результаты тестов, physical acceptance, код или публикацию.
