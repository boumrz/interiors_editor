# Adversarial review — G-V01-S3 storage, recovery, PWA writer fencing

Дата проверки: 2026-08-09  
Объект: `ARCHITECTURE-SPINE.md`, решения AD-4, AD-11 и AD-17  
Линза: independently-built lower units; fenced publication, root/GC,
recovery/history discard, PWA update и remote perimeter  
Статус: reviewer gate input, не verdict implementation readiness

## Вердикт

AD-4 уже правильно закрепляет local-first ownership, Project-scoped records,
same-transaction path и обязательный recoverable journal для разнесённых
stores; AD-11 не полагается на удержание waiting worker; AD-17 оставляет
Catalog Control Plane строго внешним catalog/provenance perimeter. Однако до
архитектурного handoff остаются три load-bearing расхождения: scope fence для
административных/миграционных переходов, commit predicate cross-store journal
и writable-совместимость после PWA update. Без их явной связи два корректных на
вид lower unit могут соответственно resurrect Project, ошибочно завершить
старый journal или выполнить downgrade-write.

Ни один corpus, browser/POC trace, Playwright run или этот review не доказывает
physical lifecycle/quota, iOS/Android update behavior, безопасность,
операционную готовность, legal grants либо implementation readiness. Внешние
evidence остаются external до фактического versioned corpus и независимой
атрибуции.

## Проверяемые независимые единицы

| Единица | Самостоятельная зона | Допустимая, но несовместимая трактовка |
| --- | --- | --- |
| A — `RevisionCoordinator` / repository | Command publication, writer lease, pointer, Revision и History roots | Считать fenced publish только путём Command и отдельно выполнять migration, Trash или recovery administrative action. |
| B — blob/journal/GC adapter | bytes, `PinStagingLease`, journal recovery и reachability GC | После restart решить старый journal по наличию bytes либо pointer, не проверяя generation/base/fence его исходной операции. |
| C — PWA release coordinator | `ReleaseManifest`, SW activation, schema migration и reload UX | Признать старую schema readable и по той же причине writable, либо выбрать rollback/cache lifetime отдельно от migration. |
| D — catalog adapter/control plane | `CatalogGatewayPort`, descriptor, bytes, provenance/grant/notices и cache | Составить placement из metadata одной версии и grant/bytes другой версии, считая наличие hash достаточной связью. |

## Высокий приоритет

### H-1 — Fence должен охватывать все Project-state transitions, а не только Command publish

**Наблюдение.** AD-4 требует same-transaction fence check для staging
Revision/root/pointer swap и отдельно упоминает fenced recovery/history-only
repair. Но Rule не называет единый обязательный путь для explicit takeover,
copy-on-write migration, Trash/restore/permanent delete и journal
reconciliation. Реализация A может честно fence-ить Commands, а другой unit
может после takeover пометить Project Trashed или мигрировать pointer без
проверки того же token/state.

**Атака.** Tab A строит candidate; B выполняет explicit takeover и переносит
Project в Trash либо публикует COW migration; поздний completion A или restart
journal B записывает старый current pointer. Даже без потери blob bytes
получается resurrected/rewound Project, History roots либо recovery status.

**Нужное архитектурное уточнение.** В AD-4 обозначить один
`Project-scoped fenced transition` для каждого перехода, меняющего
accessibility, current pointer, schema/recovery/History/root inventory: обычная
publication, takeover, migration publish/failure handling, recovery,
`DiscardSessionHistory`, Trash/restore/permanent delete и journal completion.
Переход проверяет current Project state и current writer fence в его единой
atomic/journal boundary; stale token не может ни опубликовать, ни resurrect,
ни release roots. Это не выбирает lease timeout, schema journal или storage
substrate.

### H-2 — Cross-store journal нуждается в fence- и base-bound commit predicate

**Наблюдение.** AD-4 требует startup reconciliation ровно к `published` либо
`no-publish` до GC/new write. Но two physical stores могут независимо
интерпретировать «published»: B может ориентироваться только на наличие
candidate bytes, A — только на new pointer. `ProjectId` сам по себе не
связывает журнал с конкретной generation pointer, candidate checksum и fence,
который был действителен при admission.

**Атака.** Crash происходит между metadata swap и root-inventory write; затем
explicit takeover создаёт новую revision. Поздняя reconciliation старой записи
видит существующие candidate bytes и завершает её как `published`, повторно
вводя History/root или освобождая resources уже новой ветки. Обратный вариант
ошибочно даёт `no-publish` и GC-ит bytes, достигнутые новой revision.

**Нужное архитектурное уточнение.** Для cross-store path AD-4 должен требовать
один durable journal operation identity с `ProjectId`, expected base/current
generation, candidate Revision/checksum, acquired fence generation и целевым
root manifest. Reconciliation применяет idempotent outcome только по этому
commit predicate и никогда не меняет более новую fenced generation; release
возможен лишь после доказанного `no-publish` и полной недостижимости из
актуального inventory. Формат journal и конкретные IndexedDB/OPFS операции
остаются deferred.

### H-3 — AD-11 не фиксирует writable compatibility после ReleaseManifest handshake

**Наблюдение.** AD-11 перечисляет readable/writable schema в
`ReleaseManifest`, но не требует, чтобы runtime выбрал режим доступа из этой
матрицы и чтобы COW migration шла через AD-4 transition. Поэтому C может
считать «умею прочитать» разрешением изменить старый Project, а другой unit —
считать schema write-only после migration; service-worker/cache policy может
отдельно убрать единственный reader/export path для preserved source.

**Атака.** Новый shell читает old schema, запускает migration; пользователь
отклоняет reload или tab возобновляется с old shell. Один client пишет old
format, второй COW-публикует new format; при failure recovery получает либо
две спорные current lineage, либо source, существующий физически, но без
declared compatible read/export route.

**Нужное архитектурное уточнение.** AD-11 должен обязать handshake
детерминированно выбрать `writable`, `read-only/exportable` или
`migration-in-progress` для пары local Project schema/release capabilities.
Только manifest-authorized writable client может начать migration/publication;
migration сохраняет previous immutable source как AD-4 recovery root до
successful fenced COW outcome, а incompatible/stale client не может write.
Это не назначает service-worker caching strategy, retention period или browser
support policy.

## Средний приоритет

### M-1 — Catalog placement нуждается в immutable versioned descriptor bundle

**Наблюдение.** AD-17 allow-list для `CatalogGatewayPort` сильный, но слова
«versioned identifiers, descriptors/resource bytes, hashes, provenance,
AssetUsageGrant/notices» ещё допускают раздельное склеивание ответов D. Hash
ресурса доказывает exact bytes, но сам по себе не доказывает, что provenance,
grant и required notice относятся к той же версии descriptor.

**Риск.** Local adapter может pin-ить честные bytes, однако собрать Durable
manifest с устаревшим/чужим grant или notice. Это не превращает Control Plane
в Project backend, но нарушает AD-14/AD-17 catalog boundary и backup ledger.

**Автофикс.** Явно назвать admission input immutable `CatalogVersion` (или
равноценный versioned descriptor bundle), который atomically связывает catalog
identifier, resource/subresource hashes, provenance, `AssetUsageGrant` и
notices; local adapter проверяет bundle перед pin. API shape, ETag/cache,
publisher auth и delivery остаются для `G-CP-ADR`.

## Подтверждённые сильные границы

- AD-4 исключает `pointers[0]`/first-staging shortcut и удерживает current,
  recovery, Trash, staging/pin lease, custom definitions и обе session-History
  branches как GC inventory.
- `PinStagingLease`, `SessionRetentionPolicy`, complete
  `RecoveryChangeSet` и explicit `DiscardSessionHistory` уже защищают от
  silent loss history/resources и partial recovery publication.
- AD-11 верно не предполагает, что waiting service worker можно удержать, и
  сохраняет failed migration source readable/exportable до successful COW.
- AD-17 запрещает Project/Revision/History/Backup/user-pinned blobs не только
  в service/PostgreSQL, но и в endpoint, migration, audit log и delivery cache;
  catalog outage не делает healthy local Project read-only.

## Границы review

Это review не выбирает IndexedDB Blob, OPFS или hybrid; lease timeout,
transaction/journal representation, service-worker cache policy, API/transport,
Kotlin framework/build, PostgreSQL operations, publisher identity, hosting,
retention и telemetry остаются deferred/`G-CP-ADR`. Он не изменяет SPEC,
companions, memlog или application code и не заявляет `READY`, release либо
пройденные external evidence.
