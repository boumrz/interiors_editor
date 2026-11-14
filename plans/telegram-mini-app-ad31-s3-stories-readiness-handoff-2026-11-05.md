---
title: "AD-31 S3: Epic 10 handoff для scoped readiness review"
date: 2026-11-05
status: planning-handoff
implementation_readiness: local_ready_per_2026_11_05_report
owner_workflow: bmad-create-epics-and-stories
---

# Handoff: новый browser registered-transfer storage

Это handoff для **scoped implementation** AD-31. [Readiness report](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-11-04.md)
зафиксировал 2026-11-05 LOCAL READY для этого scope; данный документ нового
verdict не создаёт. Это не waiver, implementation DONE, release READY или
physical Telegram acceptance. Один implementation owner выполняет путь
итеративно; реальные тесты/proof не являются условием начала кода, но обязательны
до включения соответствующего writable ingress. Новая browser area сейчас
изолированная/preliminary: ingress, API и UI не включены.

## Владеющие источники и изменённые downstream документы

- [Architecture AD-31 и disposition](../_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/browser-registered-storage-disposition-2026-11-05.md);
  [Spine](../_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md).
- [PRD FR-45/FR-57](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md),
  [SPEC CAP-10](../_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md) и
  [Project/Backup §1.4](../_bmad-output/specs/spec-interiors-editor-alpha/project-and-backup-contract.md).
- [UX EXPERIENCE](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md)
  и [DESIGN](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md).
- [Stories 10.4–10.5 и build/file matrix](../_bmad-output/planning-artifacts/epics.md),
  [roadmap](../_bmad-output/planning-artifacts/roadmap-to-alpha.md),
  [traceability](../_bmad-output/planning-artifacts/traceability-matrix.md) и
  [результат owner workflow](telegram-mini-app-s0-epics-result-2026-11-04.md).

Первоначальное утверждение architecture disposition о необходимости глобальной
raw-ID уникальности до выбора SPEC/PRD читается вместе с последующим FR-45 и
§1.4: источник определил **двух-store precheck плюс scoped identity**, а не
атомарную глобальную uniqueness. Это не приписывает новым проверкам PASS.

## Граница и ценность

Пользователь явно выбирает `Импорт файла для переноса`. Только этот путь создаёт
Project в отдельном anonymous browser-local namespace с собственной DB,
Project/Revision, resources/library, fences, journal/receipt и roots. Общие
editor, domain, application и validation остаются едиными, trusted browser
composition направляет путь; файл, имя, ID и hash не выбирают owner. Прежние
browser DB names/schema/data, History, default create/import/export и policy
сохраняются. Нет fake Telegram identity, сервера или незапрошенного upload.

Import требует нового raw ID, точно отличного от source ID; кандидат проверяется
относительно обеих известных DB, а недоступная проверка закрывает import.
Destination защищает atomic `add`, no-overwrite и no-ABA. Последовательная
проверка двух независимых DB не является межбазной транзакцией: concurrent или
будущий старый producer может создать совпадающий raw ID. Обе записи остаются
раздельными, а trusted `(namespace, raw ProjectId)` сопровождает все операции,
resources, историю и callbacks; unknown owner означает отказ/reselection.

## Обязательный local scope для readiness

- Явный ingress использует bounded strict decode и archive/schema/domain/resource
  validation → actual render smoke → cancel → exact legacy-backup representability
  до новых IDs/pin/staging → общий ImportUseCase и browser feasibility. Ранний
  `PROJECT_BACKUP_ENVELOPE_EXCEEDED` не маркирует valid source повреждённым и не
  перебивает более раннюю validation ошибку. Lowercase hashes недостаточны без
  exact bytes, limits, structured -0, own-undefined/absent и UTF-16 сравнения;
  текущий registered resource preflight 25 MiB сохраняется.
- Новый namespace обеспечивает собственные atomic fence/base/stage/receipt,
  exact pin/root и conditional cleanup, безопасную reconciliation unknown
  commit, coordination двух вкладок и quota/crash/cancel. Directory и capability
  probe не создают DB: existing-only `oldVersion=0` abort-ит upgrade и закрывает
  поздний success. Текущая фактическая absence означает `not-provisioned`,
  история неизвестна; это не healthy empty и не доказанный исторический first-use.
- Только явно выбранный registered import после bounded validation, actual smoke,
  cancel и representability до IDs может выполнить bounded fresh-v0 под тем же
  exclusive scope Web Lock. Trusted composition повторно проверяет generation и
  DB state; native versionchange атомарно создаёт stores/keyPaths, browser
  identity/protocol marker и counter. Конкурентно созданная DB проходит existing
  reopen, не повторный init. Это создание текущей области не доказывает отсутствие
  прежних или восстановление утраченных данных; если последующий import не
  опубликован, валидная служебная schema может остаться без Project, не `imported`.
- Existing corrupt/foreign/missing marker/counter, unknown ownership или future
  schema дают read-only/recovery без reset/fallback. Если ранее подтверждённая DB,
  marker или counter исчезли в живом context, generation окончательно отзывается:
  старые callbacks/attempts не получают новую capability и не делают silent
  recreation. In-flight transactions abort/drain под lock; blocked/timeout/revoke
  обрабатывают поздний upgrade/success, а unknown commit разрешается по receipt.
  Valid-present rollback проверяется в ограниченной модели живых кооперирующихся
  contexts, при недоказанном lifecycle — fail closed. Внешний origin clear/eviction
  может быть неотличим от fresh-v0: нет обещания исторического восстановления или
  математической глобальной never-reuse. При отсутствии proof/lock запись закрыта
  без fallback в legacy; случайная epoch не доказывает non-reuse. Общий GC не
  вводится.
- Directory различает и озвучивает обе копии, одинаковые IDs/названия, unknown
  owner и каждую ветвь частичной недоступности. Неполный список не объявляется
  пустым; доступный scope продолжает безопасную работу. Нет auto-reset, delete,
  repair или миграции; общая origin eviction/quota и same-origin scripts не
  считаются изолированными по имени DB.
- Exact owner и generation связывают open/create/rename/edit/delete, writer/
  takeover, commands, undo/redo/SessionRetention, pending/retry, recovery/repair,
  resource hydration/library/copy/pin, оба exports и late async results после
  переключения. Копирование ресурса между library — только verified bytes/hash/
  length и новый scoped pin/policy; source и чужие roots сохраняются.
- Каждый healthy Durable Project нового namespace и все последующие допустимые
  edits/history поддерживают полный прежний offline FR-44 backup из resources
  своего owner. Дополнительный registered export отдельный; старые PWA не видят
  новую локальную область, а проверенный старый decoder импортирует лишь отдельную
  копию. Обновлённый client объясняет границу до rollback, не обещая sync.
- Повторный выбор persist-failed source разрешён только sealed ingress: при
  отсутствии активной publication и pending history, после registered validation
  и private exact comparison decoded source, всех refs и bytes **до новых IDs**.
  Другой файл, cancel/error, missing proof или unknown прежний commit сохраняют
  candidate/экран/roots; unknown commit сначала требует reconciliation. Пока путь
  не реализован и не проверен, не заявлять его работающим.

## План доказательств до включения, не существующий PASS

Один owner проводит RED → GREEN и required mutation с native IDB и двумя browser
contexts: collisions source/raw и каждой DB, concurrent/future legacy producer,
atomic no-overwrite, существующий-only probe без создания, explicit validated
fresh-v0, concurrent existing reopen, corrupt/foreign marker/counter и known loss
с окончательным revoke generation; rollback/eviction без ложных заявлений об
истории, blocked/timeout и поздние upgrade/success, versionchange/forced close,
abort/drain in-flight transactions под lock, cancel после lock grant и unknown
commit/receipt; fence/takeover/quota/crash; exact current/undo/redo roots. Отдельно проверяются
все команды/экспорты/resources/repair и delayed callbacks после switch, оба
варианта частичного отказа, same/different-source reselect и отсутствие новых IDs
до proof. Сценарий с реальным GLB/SHA проходит pin → reopen → edit → undo/redo →
старый offline backup → допустимый legacy reimport с exact geometry/host/bytes;
проверяются -0/undefined/UTF-16, aliases, limits и ранний refusal.

Обязательны inventory поддерживаемых старых builds и их DB/cleanup, unchanged
old-PWA corpus/import/export/history, update/rollback и сохранение immutable
assets. Реальные build/file pairs, external handoff и physical iOS/Android
NFR-28 остаются отдельными release evidence. Локальное implementation READY не
является более широким release READY или физической приёмкой.
