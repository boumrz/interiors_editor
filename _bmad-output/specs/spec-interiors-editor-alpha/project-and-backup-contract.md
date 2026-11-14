# Контракт границ Project и Portable Backup

Статус: **provisional до S-1/S-2/S-3/S-6**. Этот companion задаёт один
нормативный владелец warning/hard policy. Числа можно изменить по device
evidence, но реализация не может выбирать их независимо.

# 1. Project Limits Policy

Лимиты защищают мобильную память, время topology, storage и импорт. Reference
scene — performance test, а hard limit — честная граница принимаемых данных.

| Ресурс | Warning | Hard reject |
|---|---:|---:|
| Абсолютная координата `x/z` | 50 000 мм | 100 000 мм |
| Vertex | 300 | 600 |
| WallSegment | 150 | 300 |
| Room | 25 | 50 |
| Opening | 100 | 200 |
| AssetInstance | 120 | 250 |
| Уникальный AssetDefinition в Project | 40 | 100 |
| Referenced portable resource entries | 400 | 900 |
| Один pinned portable resource | 25 MiB | 50 MiB |
| Сумма pinned portable payload bytes | 100 MiB | 180 MiB |
| Upper bound полного `.interiors` container | 120 MiB | 190 MiB |
| Upper bound полного unpacked payload | 200 MiB | 280 MiB |
| Surface/material assignment | 150 | 400 |
| Canonical Project JSON до blobs | 5 MiB | 10 MiB |
| Footprint vertices одного AssetDefinition | 32 | 64 |
| Variant selections одного AssetInstance | 16 | 32 |
| ResourceRefs одного AssetDefinition | 16 | 32 |
| PPJ-A1 lossless JSON AST | — | `AST-R1` в [Portable Backup ingress registry](portable-backup-ingress-registry.md): depth 8; 65,536 value nodes; 49,152 member records; 24,576 array elements; 4 MiB decoded strings; 16 MiB retained metadata; parent-link pointers only |
| Один validated candidate ChangeSet | 1 MiB | 2 MiB |
| Длина одной стены | 30 000 мм | 100 000 мм |
| Минимальная ненулевая длина стены | — | 50 мм |
| Толщина стены | 50–500 мм preferred | 20–1 000 мм |
| Высота Room | 2 000–4 000 мм preferred | 500–10 000 мм |

Warning не меняет данные и предлагает упростить Project/каталог. Hard reject
возвращает stable reason с фактическим и допустимым значением. Любая цепочка
Command проверяет итоговые counts и `BackupFeasibilityPolicy` до Durable
Revision.

Exact bytes каждого referenced catalog/custom resource pin-ятся в user-owned
`AssetBlobStore` до Durable размещения/назначения. Pin создаётся atomically с
recoverable repository-local `PinStagingLease` GC root: он существует между
bytes write и outcome admission, переживает crash/reload и закрывается только
success publication либо доказанного безопасного no-publication cleanup;
потеря fence сама по себе не разрешает удаление. Это не
Project, History, Revision или Portable Backup field. Bytes не являются LRU
cache и не удаляются, пока достижимы из current, recovery, staging,
custom definition, PinStagingLease либо любой Revision в undo/redo-ветках
активной session History. Browse-only/unreferenced catalog cache остаётся
повторно скачиваемым.

До Durable publication проверяется также `SessionRetentionPolicy`: объединение
ресурсов current Project и обеих веток активной History должно помещаться в
те же provisional entry/payload hard limits, что указаны выше. Если новая
команда превысит этот предел только из-за history roots, она отклоняется с
предложением закрыть и заново открыть Project, явно начав новую history
boundary. Новая команда из середины History лишь помечает redo-ветку
кандидатом на замену; она остаётся полностью доступной при reject,
cancel или persistence failure. Branch, её Revision records и resource
manifests атомарно перестают быть History roots только вместе с Durable
publication новой команды. При reload/reopen/history boundary все session
roots освобождаются только после подтверждения читаемости current и recovery
Revision.

### 1.1 Telegram scope: cross-context safety до первой записи

Полный [S2 fencing disposition](../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md)
является обязательной частью AD-4/AD-26 для Telegram scoped runtime, включая
проверки и recovery predicates. До подтверждения **всех** условий первая writable
операция Story 10.2, включая create/import/repair/delete, запрещена; одних signed
identity и локального serialized barrier недостаточно.

- Один `interiors-editor-projects:<scope>` IDB v2 содержит metadata, Project,
  revision, staging, writer/fence, journal, resources и library object stores.
  Под Web Lock versionchange проверяет полный v1 inventory и exact identity
  (`protocolVersion=1`)/uint64 counter до атомарного добавления stores; bad или
  unknown state, blocked/abort/quota не сбрасывают и не удаляют v1. Fresh v0
  создаёт v2 атомарно, но не доказывает восстановление ранее очищенного origin.
  Late upgrade после timeout abort, late success закрывает DB; old v1 client
  отзывает session при versionchange. Обычные counter/fence/receipt/no-publish
  writes требуют проверенной `durability:"strict"` без silent downgrade;
  versionchange не получает вымышленного durability option. Browser/PWA DB и
  существующие adapters/schema остаются неизменными.
- Все contexts одного scope берут единый exclusive Web Lock до lease, stage,
  journal/root, pin/protect, pointer или cleanup и удерживают его до завершения
  задействованных transactions одной scoped DB. Нет `steal`, nested того же lock,
  сети или user input внутри; после них повторно проверяются predicates и bytes.
  Lock unavailable → read-only/ожидание/отказ; он не заменяет durable fence.
- В Project-store transaction scope, Project, owner, token, base/current и attempt
  проверяются до stage write/overwrite/delete; revision/attempt/lease IDs не
  перезаписываются, идентичный retry допустим только по точному attempt и metadata.
  Pointer swap атомарно записывает durable receipt с revision/checksum/manifest;
  сравнение только с текущим pointer не доказывает публикацию. Undo/Redo адресует
  уже существующую owned Revision после проверки Project/revision ID, checksum,
  serialized bytes и resource manifest, с новым fenced attempt/receipt; сама
  Revision не перезаписывается и новая semantic Revision не создаётся.
- Scope-local durable uint64 counter выделяет attempt и pin lease ID до каждого
  использования без ABA, включая abort/delete; отсутствующий/повреждённый
  counter существующего scope или переполнение закрывает запись без reset/wrap.
  Fence generation и Project IDs не переиспользуются после release/delete/recreate.
- No-publish фиксируется current owner/fence в той же Project transaction до
  conditional stage cleanup; потеря fence, неполный journal или неясный outcome
  сохраняют staging/journal/bytes и дают recoverable/read-only состояние. Новый
  владелец после явного takeover может adopt полный старый attempt только по
  exact identity и predicates disposition; старый writer не продолжает write.
- Journal root создаётся до записи bytes. После доказанного no-publish удаление
  возможно только при совпадении scope/hash/lease ownership через atomic
  `deletePinnedIfOwned`; второй потребитель обязан атомарно protect/pin exact
  bytes в той же resource-store transaction и проверить hash/size до публикации.
  Повторное чтение не заменяет protect; неопределённый root сохраняется.
  `crypto.subtle.digest` выполняется вне активной IDB transaction: под scope lock
  immutable snapshot хешируется, затем одна transaction повторно проверяет
  identity/version/size, fence/base/journal и выполняет protect/publish/receipt;
  большой ресурс использует проверенный immutable staging root в той же DB.
- Telegram S2 не вводит общий scope-wide GC: user-owned bytes и current,
  recovery, staging, pin и обе active History roots сохраняются консервативно.
  `SessionRetentionPolicy` по-прежнему может отклонить новую команду, но не
  разрушает существующую history. Web/PWA baseline и его checks сохраняются.
  Отсутствие atomic conditional lease release означает stop renewal и expiry,
  а не безусловное удаление или заявление немедленного освобождения.

Disposition перечисляет обязательные two-runtime races, counter/ABA/overflow,
crash/receipt/recovery и browser regression; они пока не являются выполненным
S2 evidence. Standalone identity validator и локальный session barrier не
доказывают интегрированный runtime/storage. Наличие безопасного протокола не
объявляет physical-client isolation или release READY.

### 1.2 Reopen reconciliation текущего schema

При reopen current-schema Project приложение сначала читает последнюю
проверяемую Durable Revision. Узкий repair разрешён только для состояния, где
PlanGraph уже детерминированно даёт bounded Room faces, но persisted Room
metadata пусты и нет `AssetInstance` или `Opening`, для которых понадобилось бы
неявное rehost. Repair materializes derived Room metadata и публикует ровно одну
новую Durable Revision. Если graph невалиден/незамкнут либо есть такие hosts,
последняя читаемая Revision остаётся доступна без silent rewrite.

Один controller coalesces concurrent `open`: они используют одну load/repair
операцию и не могут очистить staging или заменить её current pointer. Это
current-schema reconciliation, не migration V1/V2, не `RecoveryChangeSet` и не
автоматическое удаление данных.

`BackupFeasibilityPolicy` строит полный manifest и консервативный upper bound
container/unpacked bytes и entries. Project hard limits намеренно строже
backup import limits ниже: любой non-corrupt Durable Project, созданный
текущей policy, обязан экспортироваться в complete `.interiors` без network.
Если pin или sizing не прошли, новая ссылка остаётся preview/error и не
публикует Revision; PinStagingLease освобождается only after its no-publication
outcome is crash-safe recorded.

For the PPJ-A1 route, before Durable publication that policy also materializes the canonical PPJ-A1
UTF-8 `project/project.json` member and performs the registry's AST-R1 dry
count without building a full AST. It checks the 10 MiB member cap, all
PPJ-A1 collection hard counts and every AST-R1 capacity. Any excess rejects the
candidate as existing `PROJECT_BACKUP_ENVELOPE_EXCEEDED`; the ordinary rejected
candidate/PinStagingLease cleanup route applies, and no Revision, History or
publication is created. This is a required contract symmetry with import, not
implementation or device-memory evidence.

The PPJ-A1 materialization boundary accepts only strings made of Unicode scalar values.
The exact escaped-surrogate rule, strict UTF-8 decoded-byte charge and canonical
emission are source-owned by the [Portable Backup ingress
registry](portable-backup-ingress-registry.md): a lone UTF-16 surrogate is
rejected by its owning field validation before this preflight, never replaced
while exporting and never made Durable.

Для зарегистрированного V1-wire отдельный codec и его bounded scanner по
[registry](portable-backup-ingress-registry.md) сохраняют разрешённые UTF-16
code units, own-undefined, `-0`, finite yaw и точную форму V1 без изменения
внутреннего serializer/Revision checksum. Immutable resource bytes и полный
manifest включаются в backup; PPJ semanticSnapshot не выдумывается. Existing
current policy и её более строгие лимиты, включая 100 definitions, не меняются.
Формат использует закрытый STORE envelope и conservative bound по AD-30; до
replacement browser exporter нужны worst-case corpus и доказательство FR-44 для
всех non-corrupt Durable Project текущей policy. Читаемые sole-copy за границей
grammar не объявляются corrupt и не теряют прежний recovery/export путь.

### 1.3 Format-specific feasibility для Telegram V1

[AD-30 format-specific feasibility](../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-portable-v1-disposition-2026-11-04.md)
конкретизирует существующую `BackupFeasibilityPolicy`, не добавляя limit или
capability. Только trusted Telegram composition выбирает зарегистрированный V1
writer и policy adapter после выбора immutable scope, не файл или пользовательский
flag. Writer/exporter и policy получают одно `repository.resources` этого scope;
resource и checksum ports обязательны. Отсутствие policy/encoder/store, неверный
scope или exception → fail closed без PPJ/permissive fallback.

Session-retention wrapper и прямые active callers feasibility, включая
`CreateCustomGlbFloorItemUseCase` после pin, используют один и тот же выбранный
adapter; неподключённый direct caller не обходит policy, его V1 path ограничен.
Browser/PWA default `assessBackupFeasibility` и existing composition сохраняются;
проверка представимости в прежнем exporter относится только к новому выбранному
registered ingress (§1.4). V1 adapter
проверяет тот же exclusively owned immutable
`candidate.project`, что направляется на publication: exact registered V1 wire
и полную domain/Project policy, включая не более 100 definitions. Checksum
internal JSON не удостоверяет равенство `-0`/`0` или own-undefined/absence;
exclusive ownership держится с первого async шага до проверки/publication либо
exact wire-state equality повторно доказывается на commit boundary.

До publication проверяются actual wire/STORE bytes либо доказанная граница
`4096 fixed + 1024 bytes на каждый original resource reference`, 10 MiB Project,
50 MiB/resource, 180 MiB по исходным case-sensitive keys до dedup, 190 MiB
container и 280 MiB unpacked. Каждый key данного scope отдельно разрешается в
pinned exact bytes, с declared length и полными 256 bits SHA; hash aliases
допускают dedup только после byte-for-byte equality и сохраняют original keys.
Browse cache не является root. Действующий 25 MiB custom admission проверяется
отдельно до parse и не заменяется portable technical 50 MiB seam.

Feasibility не является pin или Durable commit и не подменяет
`SessionRetentionPolicy`: existing current/undo/redo roots, exact repair и
явный `DiscardSessionHistory` сохраняются; перед publication AD-26 повторно
проверяет scope/generation, base, fence, exact roots и candidate identity.
Недоступность, race или отказ не меняют Durable Revision/redo; существующие
domain/policy reasons не превращаются в codec success или новые причины.
Предписанные AD-30 tests и physical evidence остаются будущими проверками.

### 1.4 Browser registered ingress: совместимость текущего exporter

Для отдельного явно выбранного browser registered-transfer ingress проверяется
точная представимость в текущем browser Portable Backup до изменения данных.
Порядок: bounded registered decode и archive/schema/domain/resource validation;
actual render smoke проверенных source/resources; проверка cancellation;
read-only проверка представимости; затем штатные ImportUseCase и действующая
browser `BackupFeasibilityPolicy`. Существующий порядок ошибок validation и
отмены сохраняется; unresolved precedence блокирует rollout этого маршрута.

Проверка охватывает все исходные `resourceHash` в форме `^[a-f0-9]{64}$`,
exact resource bytes и ограничения старого backup, а также полное сохранение
structured Project, включая различия `-0`/`0`, own-undefined/absent и UTF-16
code units. Один lowercase hash не доказывает представимость. Оценка будущих
создаваемых IDs и metadata должна консервативно учитывать их влияние на итоговый
candidate и bounds без создания IDs до раннего отказа; если это нельзя доказать,
соответствующий файл не допускается. Финальные действующие resource, domain,
size, feasibility и fenced publication проверки сохраняются.

Непредставимый valid wire получает существующий
`PROJECT_BACKUP_ENVELOPE_EXCEEDED` до выделения IDs, pin, staging или Durable;
пользователь получает объяснение несовместимости с текущим browser backup.
Source и raw keys остаются неизменными. Отказ не объявляет файл или ресурс
повреждённым и не подменяет более раннюю validation ошибку; типизированный
результат ingress должен явно поддерживать этот ранний policy reason.

**Отдельный browser namespace по AD-31.** Только явно выбранный registered
import создаёт Project в дополнительном anonymous browser-local storage с
собственными Project/Revision, resources, leases/fences, attempts/receipts,
pin/GC roots и journal. Доверенная browser composition выбирает namespace;
файл, Project ID и пользовательский flag не выбирают его. Это не Telegram
scope: нельзя подделывать `VerifiedTelegramScope`, signed launch или `tma-v1:`.
Используются общие domain validation/use cases и publication boundary с
отдельными browser adapters, без упрощённой модели и обхода domain/FPC/history.

Names/version/stores **прежних** browser DB, их данные, default policy, команды,
decoder/exporter и History не меняются; global guard, history bypass, migration
или old-writer barrier не вводятся побочно. Старый browser staging и history
protocol остаются отдельным pre-existing risk. Предыдущее предложение писать
новый ingress в старую DB отменено: даже один commit не доказывает отсутствие
ранее выбранного old cleanup. Изоляцию подтверждают inventory и испытания именно
поддерживаемых старых builds и их DB/cleanup; разные DB names не изолируют от
произвольного same-origin кода, общей квоты или origin eviction/clear.

**FR-45 identity и directory.** Существующие записи адресуются доверенным
внутренним `(namespace, raw ProjectId)` во всех действиях, async callbacks,
resources, History и recovery. Совпавшие raw IDs показываются раздельно и
различимо, не сливаются; owner нельзя
угадывать по ID, имени, hash или содержимому файла. Если owner неизвестен,
действие закрыто. Raw ID импортируемого Project обязан точно отличаться от
source ID, даже если source локально отсутствует. Кандидат raw ID до принятия
проверяется относительно существующих Projects обоих известных browser stores:
при совпадении выбирается другой ID, недоступная проверка закрывает import.
В destination атомарное создание Project/Revision исключает overwrite и
повторное использование ID в нарушение no-ABA; конфликт даёт безопасный отказ
или новую попытку. Existing Project не становится target импорта.

Проверка независимых stores не является межбазной атомарной гарантией и не
запрещает конкурентному или будущему старому клиенту создать такой же raw ID.
В этом случае scoped identity сохраняет отдельные записи, а open/edit,
writer/takeover, history, recovery, resources, export, подтверждённое delete и
поздние async результаты направляются только выбранному owner. Совпадение не
разрешает слияние, перезапись или обращение к чужой записи; namespace не входит
в domain Project или backup. Глобальная уникальность raw ID не предполагается.

Если один источник недоступен или повреждён, объединённая directory явно
неполна, а не пуста; безопасный доступ к другому источнику сохраняется. Нельзя
автоматически удалить, исправить, пересоздать или переместить данные. Для новых
Projects все open/edit/rename/delete, writer/takeover, pending/retry,
undo/redo/retention, hydration/repair, backup и cleanup используют тот же owner
handle и принадлежащие ему ресурсы; другая область не очищается. Перенос модели
из старой library требует проверки exact bytes/hash/length и нового pin до
Durable mutation, без удаления оригинала.

**Staging и recovery.** CAP-10/FR-45 допускают bounded protected validation в
памяти и recoverable resource pin/journal как staging, если все проверки и
AD-4 crash/recovery guarantees сохранены. Новый scope до первой записи должен
обеспечить collision-safe Project/Revision/attempt/lease, atomic fence и
publication/receipt, exact pinned bytes и roots, conditional cleanup и
reconciliation неизвестного commit; при неизвестном proof или обязательном
lock — fail closed без fallback в legacy. Единая транзакционная область либо
доказанный эквивалент cross-store journal связывает candidate и resources с
конкретной попыткой. Startup/update проверяет оба storage contexts независимо;
неисправность нового не закрывает безопасный прежний путь.

**Bounded fresh-v0 и reopen.** Обычная directory и capability probe не создают
новую DB. Если existing-only probe использует `indexedDB.open`, обнаруженный
`oldVersion=0` abort-ится без оставленной DB; поздний success закрывается. Факт
отсутствия DB сейчас означает `not-provisioned`, история неизвестна, а не
healthy empty или доказанная первая установка. Недоступность не подменяется
отсутствием; доступные legacy Projects продолжают отображаться.

Только явно выбранный registered import после bounded validation, actual smoke,
cancellation и pre-ID representability может создать новую **текущую** область.
Trusted browser composition под тем же exclusive scope lock, что используется
для новых writes/bootstrap/reconciliation, повторно проверяет generation и DB
state. При native `oldVersion=0` и действующей попытке одна versionchange
transaction атомарно создаёт stores, browser identity/protocol marker и counter;
если другая вкладка уже создала DB, выполняется проверенный existing reopen.
Lock не заменяет durable fence. Создание области не доказывает отсутствие
прежних данных, восстановление или невозможность ABA.

Existing DB с отсутствующим/повреждённым или чужим marker, неверным counter,
неожиданной или более новой schema, а также исчезновение ранее подтверждённой
DB в живом context ведут к read-only recovery/отказу: без сброса counter,
пересоздания, догаданного upgrade или fallback в legacy. После подтверждённого
schema commit проверяются identity/counter и publication predicates, затем
выделенный raw ID сверяется с source и обоими известными stores по FR-45.
Если последующий import не опубликован, валидная служебная schema может остаться;
это не `imported`, а пустой её можно назвать только после актуального успешного
чтения и без утверждения об истории. Native versionchange отзывает capability
старого runtime; начатые transactions abort-ятся либо их исход разрешается под
lock и через receipt. Неизвестный post-commit outcome сохраняет roots и требует
reconciliation. Concurrent bootstrap, rollback, origin eviction и anti-ABA
требуют отдельного proof; исходный файл и legacy data не меняются.

**Прежний offline backup.** Каждый non-corrupt Durable Project нового namespace
и каждая последующая допустимая mutation/history transition сохраняют полную
представимость прежним browser codec и exact локально pinned resources по FR-44.
Старое действие backup читает repository/resources владельца Project, а не
глобальный legacy store по raw hash. При необходимости дополнительные проверки
ограничены новым namespace и не ослабляют legacy policy. Старый установленный
client не видит новые Projects как те же локальные записи; проверенный импорт
файла создаёт отдельную копию без синхронизации. UX/rollback и реальные версии
требуют отдельного source и physical evidence.

**Повторный выбор после persist-failed.** Только для этого sealed ingress
допускается приватный restart конкретного pending candidate, если публикация не
активна и pending history transition отсутствует. До выделения новых IDs заново
выполнить registered validation и доказать точное совпадение decoded structured
source, всех resource references и bytes с защищённым proof исходной попытки.
Имя файла, checksum, публичный flag или Project ID не заменяют identity proof;
потеря private capability или невозможность сравнения означает отказ. Это не
открывает другой import, обычный retry, history либо остальные команды через
общий pending guard.

Другой файл, отмена, отказ, исключение или недоступная проверка сохраняют прежний
pending candidate, экран и recovery roots. Заменить pending можно только после
подтверждённого нового Durable outcome либо нового persist-failed candidate из
точно того же source, когда его recovery protection уже обеспечена. При
неизвестном исходе предыдущего commit сначала требуется доказанная reconciliation;
его нельзя считать отказом, начинать новый commit или удалять roots по одному ID.
Пока этот restart не реализован и не проверен, повторный выбор не объявляется
работающим; текущий общий pending guard может вернуть `in-progress`.

Telegram registered V1 policy сохраняет raw case-sensitive keys и проверяет
все 256 bits и exact bytes alias; browser ограничение не переносится в общий
helper или Telegram adapter. Старый browser decoder не становится V1-wire
decoder. Замена browser exporter всё ещё требует доказанной backup-ready
представимости **всех** non-corrupt Durable Projects; дополнительный registered
browser export имеет отдельные UX/Architecture dispositions и readiness gate.
FR-44 для всех данных
и FR-57 physical roundtrip здесь не объявляются доказанными: матрица ограничена
конкретными представимыми и проверенными файлами.

Evidence до допуска: реальный GLB/SHA, uppercase/mixed-case и aliases; `-0`,
own-undefined, UTF-16 и граничные размеры; validation/smoke/cancel precedence;
ранний отказ до IDs/pin/staging с неизменным source; для принятого lowercase
fixture старый export/reimport с exact contents/resources; старые Web/PWA
regressions, existing history и TMA aliases без изменений. Один изолированный
probe уже показал uppercase defect; ни новые проверки, ни physical roundtrip
этим контрактом не пройдены.

До writable scope нужны также actual IDB crash/quota/receipt, concurrent
bootstrap, probe без создания DB, explicit fresh-v0, invalid marker/schema,
blocked/cancel и поздние upgrade/success, ранее известная потеря DB, stale
fence/takeover, forced raw ID collisions между
DB и гонки с поддерживаемыми старыми cleanup/builds; exact current/undo/redo
roots и no-overwrite проверяются в обоих outcomes. Нужны reopen → edit →
undo/redo → прежний offline backup → допустимый legacy reimport с реальным GLB,
а также incomplete directory, switch/async routing, resource copy, старые PWA,
update/rollback и iOS/Android evidence по AD-31. Для повторного выбора проверить
same-source успех и повторный failure, другой файл, отмену, исключение,
недоступный proof, активную publication и history transition, сохранность
экрана/roots и отсутствие новых IDs до proof. Это будущие проверки.

AD-31 требует source/UX/story reconciliation и отдельного применимого readiness
gate; прежний узкий S3 READY не оценивал новый storage. Ни этот SPEC, ни
архитектурное направление не являются разрешением rollout, physical acceptance
или доказательством реализации.

Stable Project-side reasons:

- `PROJECT_RESOURCE_PIN_FAILED`;
- `PROJECT_RESOURCE_ENTRY_LIMIT`;
- `PROJECT_RESOURCE_BYTES_LIMIT`;
- `PROJECT_BACKUP_ENVELOPE_EXCEEDED`;
- `PROJECT_HISTORY_RESOURCE_LIMIT`;
- `PROJECT_REFERENCED_RESOURCE_MISSING`;
- `PROJECT_REFERENCED_RESOURCE_CORRUPT`.

Значения входят в versioned `ProjectLimitsPolicy`. Более новая версия может
читать старый Project сверх нового warning, но не должна молча обрезать его.
Hard limit для нового Project/Command и policy миграции различаются.

# 2. Формат Portable Backup

Рабочее расширение: `.interiors`. Конкретная ZIP-библиотека не фиксируется, но
логическая структура и trust boundary обязательны:

```text
manifest.json
project/project.json
catalog/<hash>.asset
catalog/<hash>.texture
custom/<hash>.glb
checksums.json
```

`.interiors` — расширение и container, а не дополнительная directory в этой
logical structure. Единственный canonical Project JSON member — именно
`project/project.json` внутри bundle. `./project/project.json`,
`.interiors/project/project.json`, duplicate normalized path или иной alias не
являются допустимыми source of truth и отклоняются path allowlist до Project
deserialization.

Для PPJ-A1 ниже перечислены утверждённые группы содержимого, но **не полная
закрытая wire schema** manifest/ledger или resource bindings. Отсутствующие
поля и незавершённая техническая семантика `proofRef` описаны в [PPJ envelope и handoff](ppj-a1-envelope-and-handoff.md);
без их разрешения полная PPJ acceptance не заявляется. Для PPJ-A1 `manifest.json`
содержит:

- backup format/schema version;
- `projectSchemaId`, positive-integer `projectSchemaVersion` и
  `canonicalProjectPath: "project/project.json"`; эти значения обязаны
  совпасть с root `projectSchemaId`/`schemaVersion` выбранного Project JSON;
- `sourceProjectId`, который точно совпадает с root `projectId`, только для
  source-project correlation и не для reuse при import;
- createdAt/app build/catalog versions;
- список entries с bytes, decoded bytes, media type и SHA-256;
- технические resource descriptors, media type, bytes и SHA-256;
- политику полноты `complete`;
- required capabilities;
- общее число сущностей и ресурсов.

## 2.1 Lossless geometry JSON ingress

После проверки path, size и checksum importer выбирает ровно один путь по
manifest/root selector или зарегистрированному отсутствию root selector и
применяет [Portable Backup ingress registry](portable-backup-ingress-registry.md).
PPJ-A1, V1-wire и V1-legacy имеют закрытые раздельные grammar; bare version и
inferred object shape не являются selector. Для каждого зарегистрированного
geometry field decoder сохраняет raw JSON numeric lexeme и проверяет
`^-?(?:0|[1-9][0-9]*)$` **до** host IEEE `Number` coercion. Обычный
`JSON.parse`/reviver после coercion не может быть acceptance boundary, потому
что уже не способен отличить raw decimal/exponent от округлённого number.

Для PPJ-A1 registered millimetre fields принимают только signed `SafeIntegerMm`; registered
RotationStep V1 fields принимают `SafeIntegerOrdinal` `0..7` из referenced
asset snapshot set. `Number.isSafeInteger(...)` — final runtime guard, а не
замена raw validation. Raw `-0` normalizes to canonical `0` до length/delta
classification и следующий export serializes `0`. `BigInt`, rational
predicates/intersections и `2×mm` intermediates могут использоваться лишь
transiently в exact geometry arithmetic и не появляются в JSON, Project,
Revision, History, Command payload или Portable Backup. Failed raw-token
PPJ validation within admitted AST-R1 capacity останавливает import before
migration/domain construction with `BACKUP_SCHEMA_UNREADABLE`; an AST-R1 cap or
valid integer value beyond current Project limits uses `BACKUP_PROJECT_LIMIT`.
PPJ-A1 — snapshot-only: его serialized
geometry Command registry intentionally empty, а `Command`, history,
`ChangeSet`/`inverse` и derived/transient fields schema-unreadable. Эта raw
boundary передаёт только valid values domain-owned `PlanGraph` kernel; geometry
library не получает здесь acceptance или reason-code authority. This boundary
does not allocate a new serialization reason code.

Portable Backup **всегда self-contained**: он включает зарегистрированный
Project snapshot и exact bytes каждого referenced catalog/custom resource.
PPJ-A1 включает semantic snapshot; V1-wire сохраняет exact V1 metadata и не
изготавливает отсутствующий PPJ semanticSnapshot. Session undo/redo не включается. Если полный bundle создать нельзя,
операция завершается ошибкой; неполный результат может существовать только под
другим названием «semantic report» и не предлагается как backup.
Для non-corrupt Durable Project текущей policy такая ошибка означает
environmental I/O/quota/corruption fault и recovery path, а не допустимый
неэкспортируемый scope.

Catalog и custom resource могут стать `offline-ready/backup-ready` только
после local size/media/hash validation, exact pin и
`BackupFeasibilityPolicy`. Alpha не хранит AssetUsageGrant, custom declaration,
license/provenance ledger, attribution или notices и не использует их для
placement или backup. Владелец продукта поставляет только бесплатные или
self-authored модели вне application workflow.

# 3. Предварительные backup limits

| Ресурс | Warning | Hard reject |
|---|---:|---:|
| Container bytes | 100 MiB | 200 MiB |
| Суммарные unpacked bytes | 200 MiB | 300 MiB |
| Entries | 500 | 1 000 |
| Один entry | 50 MiB | 100 MiB |
| Path depth | 4 | 8 |
| Manifest bytes | 512 KiB | 1 MiB (`BACKUP_MANIFEST_INVALID` after earlier container/path/entry guards) |
| Project JSON bytes | 5 MiB | 10 MiB |
| Compression ratio одного entry | 20:1 | 50:1 |

Поддерживается allowlist container methods, первоначально store/deflate.
Symlink, absolute path, `..`, duplicate normalized path, encrypted entry,
executable/script media type и неизвестный required feature отклоняются.

# 4. Import pipeline

На Telegram стандартный file-transfer ingress использует только
зарегистрированный Portable Backup decoder с полным single-dispatch; non-ZIP
не переключается на обычный resource-free JSON importer. `RecoveryDraft` остаётся
отдельной явно выбранной recovery операцией, не fallback и не complete backup.
Прежний Web/PWA JSON + archive route и его проверки сохраняются. Применимость,
PPJ handoff и acceptance evidence — в [platform contract](telegram-platform-and-compatibility-contract.md).

Схема ниже описывает PPJ-A1; V1-legacy/V1-wire используют тот же порядок
ранних path/size/checksum границ, но собственный bounded scanner и single
dispatch по registry, не PPJ parser или fallback.

```text
select
→ container header/central-directory limits
→ normalized path allowlist
→ manifest schema, declared bytes/counts and schema-pair declaration
→ bounded canonical-Project-byte guard + staged incremental checksum
→ bounded AST-R1 lossless JSON AST после successful checksum (parent/source-span pointer link + raw numeric lexeme; diagnostic pointer on demand)
→ manifest/root registry dispatch and closed Project shape walk
→ registered geometry lexical/safe-integer validation before coercion
→ schema-valid counts/values versus Project Limits
→ registered copy-on-write migration when a future registry row requires it
→ full domain validation
→ resource validation
→ clean-profile render/read smoke check
→ atomic publish as a new Project ID
```

Импорт никогда не перезаписывает существующий Project. Conflict имени
разрешается после валидации. Staging имеет progress, cancellation и cleanup
journal; reload после cancel/crash удаляет только недостижимый staging. Exact
ordering, pointer registry и reason precedence принадлежат
[Portable Backup ingress registry](portable-backup-ingress-registry.md): later
stage не маскирует earlier failure и failure никогда не запускает migration,
pin, ID allocation, Revision или publication.

### 4.1 Legacy topology/Project V1/V2 boundary

Зарегистрированный AD-30 portable V1-legacy с полным closed decode и PPJ-disjoint
witness является узким исключением из исторической quarantine ниже; он не
становится V1/V2 topology fixture, PPJ mapping или implicit migration. Все
прочие legacy fixtures остаются под TCC-A1.

Legacy topology/Project V1/V2 fixtures (не `MeasurementFormatPolicy V1`) —
quarantine characterization evidence, а не canonical backup registry или
supported automatic import/migration/handoff path. Их only source-owned
classification и future migration admission определяет
[TCC-A1](topology-corpus-contract.md). Для исторических TCC-A1 fixtures вне зарегистрированного portable V1-legacy route, V1-like/V2-like/unregistered-future
bytes классифицируются только как `legacy-unreadable`; readable, unmappable и
assessment outcomes не выдумываются. Portable submatrix сохраняет
reason precedence [Portable Backup ingress registry](portable-backup-ingress-registry.md):
ordinary import получает `BACKUP_SCHEMA_UNREADABLE` только внутри otherwise
valid, checksum-valid, AST-R1-admitted current envelope; без этого envelope
сохраняется ранний container/path/manifest/checksum/AST-capacity reason. Corpus
может сохранить только fixture bytes/hash и diagnostic result. Ни migration,
pin, ID allocation, Durable Revision, Project publication или production
handoff не допустимы. `RecoveryChangeSet` ремонтирует resources только current
Project и никогда не служит legacy migration. Это не ограничивает PPJ-A1 user
Portable Backup export/import handoff, который остаётся governed sections 2–4.

# 5. Stable errors

- `BACKUP_CONTAINER_UNSUPPORTED`;
- `BACKUP_CONTAINER_BYTES_LIMIT`;
- `BACKUP_UNPACKED_BYTES_LIMIT`;
- `BACKUP_ENTRY_LIMIT`;
- `BACKUP_PATH_UNSAFE`;
- `BACKUP_COMPRESSION_RATIO`;
- `BACKUP_MANIFEST_INVALID`;
- `BACKUP_CHECKSUM_MISMATCH`;
- `BACKUP_PROJECT_LIMIT`;
- `BACKUP_SCHEMA_UNREADABLE`;
- `BACKUP_RESOURCE_MISSING`;
- `BACKUP_CANCELLED`;
- `BACKUP_STORAGE_QUOTA`.

Reason precedence для этой границы фиксирована
[Portable Backup ingress registry](portable-backup-ingress-registry.md):
`BACKUP_PATH_UNSAFE` covers an unlisted, alias, duplicate or otherwise
non-canonical normalized entry path, including `.interiors/project/project.json`,
before manifest/Project decode. Missing/malformed manifest selector fields use
`BACKUP_MANIFEST_INVALID`. Declared or streamed uncompressed `manifest.json`
>1 MiB uses this same existing reason at the manifest boundary, before full
control read/parse or any Project-member size/checksum/PPJ handoff; exactly
1 MiB does not exceed the limit. Earlier container/path/entry/read/cancel faults
retain precedence. This guard is not a ledger limit or Project AST-R1 limit.
A well-formed manifest/root schema or source-ID
mismatch uses `BACKUP_SCHEMA_UNREADABLE`. The 10 MiB canonical Project JSON
hard guard is the pre-checksum `BACKUP_PROJECT_LIMIT` exception: it wins after
safe path/container-entry guards even if the bounded member would later be
malformed. After a successful checksum, an AST-R1
depth/node/member/array/pointer/string/numeric-token/metadata cap is the second
pre-shape `BACKUP_PROJECT_LIMIT` boundary; the registry fixes its parser-event
order against UTF-8/JSON and duplicate-key failure. После этого unreadable
UTF-8/JSON, duplicate JSON key within admitted AST-R1 capacity, unsupported
schema, closed-shape failure, forbidden Command/transient field или invalid raw
registered number use `BACKUP_SCHEMA_UNREADABLE` before coercion/migration.
Только then schema-valid safe values/counts beyond remaining
`ProjectLimitsPolicy` use `BACKUP_PROJECT_LIMIT`. Container, checksum and
resource boundaries retain their existing distinct `BACKUP_*` reason. После
remaining limits read-only PlanGraph binding с valid Plan maps FP-A1,
SurfaceAddress или resizable-footprint mismatch к `BACKUP_SCHEMA_UNREADABLE`;
сам invalid Plan сохраняет свой stable domain reason. None of this trio exposes
a raw conversion exception or reaches atomic publish.

# 6. Catalog retention и resource recovery

Browse-only catalog cache может быть очищен. Referenced resource не относится
к LRU: его exact bytes pinned в user-owned blob store. Если существующий
Project обнаруживает missing/corrupt pinned bytes из-за внешнего eviction или
повреждения, он открывается с placeholder в состоянии
`ResourceRecoveryRequired`.

Недоступность Catalog Control Plane сама по себе не является `Resource issue`:
она может сделать недоступными browse/search или exact bytes ещё не pinned
catalog resource, но не переводит healthy Project в `ResourceRecoveryRequired`
и не блокирует его local open/edit/Durable save/undo/redo/Portable Backup.
Control Plane может быть источником exact-byte repair только после того, как
integrity scan уже обнаружил missing/corrupt referenced hash; полученные bytes
по-прежнему проходят size/media/hash validation.

Integrity scan проверяет resource manifests current Project и обеих веток
активной History. Resource issue — discriminated value:
`Missing | HashMismatch | MediaInvalid | DecodeInvalid |
PortabilityMetadataMissing`. Он хранит scope
`CurrentProject | SessionHistory | Both`, expected hash/media, безопасные
actual поля, affected semantic references и stable reason; corrupted bytes
никогда не подставляются renderer-у как fallback.

State machine:

```text
Healthy
  → integrity scan found missing/corrupt referenced hash
ResourceRecoveryRequired (read-only domain editing)
  → exact-byte restore attempts / staged RecoveryChangeSet
Repairing
  → every referenced hash verified + policy passes
Healthy (new visible history boundary)
Repairing
  → unresolved/rejected/cancelled
ResourceRecoveryRequired
ResourceRecoveryRequired (history-only issue)
  → explicit DiscardSessionHistory
Healthy (new visible history boundary)
```

В `ResourceRecoveryRequired` обычные domain Commands, включая undo/redo,
запрещены. Доступны read-only 2D, диагностируемые placeholders в 3D,
диагностический semantic report, explicit confirmed Project deletion, complete backup
verified healthy current при history-only scope и только следующие recovery
actions:

1. найти exact hash в другом локальном content-addressed root;
2. извлечь exact entry из выбранного complete `.interiors` в staging, не
   импортируя и не перезаписывая Project;
3. при наличии сети загрузить exact catalog version из разрешённого origin и
   принять bytes только после size/media/hash validation;
4. собрать один `RecoveryChangeSet`, который удаляет все unresolved
   AssetInstance либо заменяет их на безресурсный Parametric Placeholder.
5. если все current Project resources healthy, но issue достижим только из
   session History, явно подтвердить `DiscardSessionHistory`; действие
   атомарно удаляет обе History-ветки, создаёт видимую boundary и освобождает
   их roots без новой Project Revision.

Stable recovery reasons:

- `RESOURCE_RECOVERY_HASH_MISMATCH`;
- `RESOURCE_RECOVERY_MEDIA_UNSUPPORTED`;
- `RESOURCE_RECOVERY_DECODE_LIMIT`;
- `RESOURCE_RECOVERY_SOURCE_UNAVAILABLE`;
- `RESOURCE_RECOVERY_INCOMPLETE`;
- `RESOURCE_RECOVERY_CANCELLED`.

Первые три действия ремонтируют blob store и не создают Project Revision.
`RecoveryChangeSet` не публикуется частями: он может создать ровно одну новую
Durable Revision, только если **после всех** замен нет unresolved references,
пройдены domain invariants, `BackupFeasibilityPolicy` и
`SessionRetentionPolicy`, а current base/fence ещё совпадают с recovery
snapshot. Иначе current Revision остаётся неизменной. `DiscardSessionHistory`
никогда не выполняется автоматически: перед confirm повторно доказывается
healthy current manifest, обе history branches/root inventory удаляются одной
fenced transaction без Project Revision, а cancel оставляет undo/redo и
recovery state без изменений.

Offline UI никогда не обещает сетевое восстановление. Если exact bytes нет
локально, пользователь выбирает complete backup, остаётся в read-only до
появления сети либо атомарно удаляет/заменяет все broken references. Импорт
полного backup по FR-45 всегда создаёт отдельный Project ID и является
альтернативой ремонту, а не overwrite.

Exit criteria `Healthy`: каждый hash из current resource manifest и каждой
сохраняемой active History branch существует и совпадает по
bytes/checksum/media policy соблюдена, Project снова
проходит complete-backup envelope; **либо** current manifest healthy, а
пользователь явно выполнил `DiscardSessionHistory`. После выхода начинается
новая видимая session History boundary. При scope `CurrentProject | Both`
Portable Backup недоступен; неполный export не называется backup. При
history-only issue и verified healthy current Project полный Portable Backup
current остаётся доступен, поскольку session History по контракту в него не
входит; UI явно сообщает эту границу, но не сбрасывает History.

Portable Backup не зависит от CDN retention: exact referenced resources лежат
внутри bundle. После import они проходят тот же size/media/hash и
resource-state pipeline и становятся `offline-ready/backup-ready` до
объявления restore успешным.

Origin storage не считается backup. Полная очистка browser data
восстанавливается только из `.interiors`, сохранённого пользователем во
внешнее доступное место.

# 7. Verification

Приведённые ниже forced-GC vectors относятся к наличию соответствующего GC;
Telegram S2 без general GC вместо этого доказывает консервативное сохранение
roots/bytes и безопасные conditional pin cleanup races по S2 disposition.

- clean browser profile, airplane mode, import → semantic и visual smoke
  без network;
- 0 мм semantic diff для canonical geometry;
- corrupted checksum/path/schema/entry отклоняется до publish;
- raw-byte fixtures cover every pointer and placement branch in
  [Portable Backup ingress registry](portable-backup-ingress-registry.md):
  decimal, exponent, malformed/nonfinite, unsafe, negative-zero and bounds
  values must classify before host-number coercion; the nested
  `.interiors/project/project.json` path rejects rather than becoming an alias;
- registry corpus proves manifest/root schema mismatch, duplicate keys,
  unknown/disallowed members, forbidden Command/history/derived fields, reason
  precedence and no migration/publish after any ingress failure;
- TCC-A1 corpus proves registered current PPJ-A1 versus V1-like/V2-like/
  unregistered-future `legacy-unreadable` classification and original-byte
  handoff; readable/unmappable/assessment rows require a later registered raw
  grammar/decoder. `BACKUP_SCHEMA_UNREADABLE` occurs only for a checksum-valid,
  AST-R1-admitted current envelope, earlier boundary reasons win otherwise,
  and no unregistered legacy fixture can create migration/pin/ID/Revision/Project publication; registered portable V1-legacy follows its own witness and fenced new-ID route;
  `MeasurementFormatPolicy V1` is never legacy Project data;
- AST-R1 boundary corpus proves every independently reachable allocation cap,
  the all-hard-count metadata formula and byte-order precedence against malformed
  UTF-8/JSON and duplicate-key input;
- boundary corpus на каждый warning/hard limit;
- compression/decode bomb не превышает staged policy;
- cancel/kill на каждой стадии оставляет прежние Projects;
- duplicate catalog/custom blobs дедуплицируются по hash после publish;
- recovery/staging/custom-definition и обе активные History-ветки
  защищены от GC;
- pin write → PinStagingLease → admission/publication и reject/cancel/fence
  loss/crash имеют forced-GC vectors с exact root inventory;
- delete → undo → redo сохраняет exact resource при принудительном GC между
  шагами; новая команда после undo освобождает только отброшенную redo-ветку;
- missing/corrupt corpus проверяет каждое recovery action, offline/no-network,
  атомарный `RecoveryChangeSet`, history-only corruption +
  confirm/cancel `DiscardSessionHistory` и невозможность обычного
  редактирования;
- history-only corruption разрешает complete backup healthy current без
  включения или silent discard History;
- backup из Safari импортируется в отдельный iOS Home Screen context.
