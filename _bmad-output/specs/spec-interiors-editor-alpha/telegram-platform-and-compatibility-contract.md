# Telegram: применимость, локальные границы и совместимость

Статус: контракт S0, не implementation readiness и не evidence физического
запуска. Источники поведения — принятые PRD FR-55–58/NFR-28, UX DESIGN и
EXPERIENCE UXF-8, Architecture AD-25–30; они включены в companions SPEC. При
противоречии старых UI-описаний принятые позднее REL/FUP от 1 ноября имеют
приоритет. Исторический Alpha READY не является Telegram gate.

## Применимость CAP в S0–S7

| CAP | Browser и установленная PWA | Telegram |
|---|---|---|
| 1–6, 8, 10–11 | Сохранить принятый local-first путь, данные и проверки | Тот же принятый доменный результат и безопасность; перенос и физическая приёмка имеют отдельные gates ниже |
| 7 | Принятые item color/variant по FR-33 | Эквивалентный принятый item color/variant; без независимых вариантов Project или surface finishes |
| 9 | Активны установка, update и применимый cold-offline reopen по FR-41/42 | PWA install/worker и cold-offline launch N/A; после online launch — подготовленная offline continuity по CAP-13 |
| 12 | Только принятый Alpha+ static GLB scope | Только при отдельном принятии Alpha+; это расширение его не повышает |
| 13 | Сосуществование и совместимость без зависимости от Telegram | Дополнительная поверхность, FR-55–58 и NFR-28 |

Retired Focus/fullscreen, Walk, PNG, назначение покрытий, independent Project
variants и FBX/ZIP не возвращаются. Ноябрьские REL/FUP сохраняют отсутствие
обучающих подсказок, команды разворота стены, dock-delete и автоматической
панели стены; перенос Opening подтверждается без полей изменения размеров.
Исторические implementation-evidence и NFR-15 не удостоверяют Telegram.

## Host, scope и состояние

- Две отдельные entry/output и стабильные origins используют общие domain,
  application, codecs, renderer и редактор; Telegram SDK находится только в host
  adapter. Browser не зависит от SDK; Telegram не подключает browser entry с
  массовой DEV-очисткой, не регистрирует PWA worker и не удаляет чужие данные,
  caches или output. Неподдержанный host/timeout даёт retry/выход и доступную
  ссылку на Web/PWA, не writable fallback. AD-25 владеет точными границами.
- AD-26 — инженерное **assumption**: Ed25519 проверяет подписанный initData с
  trusted bot/environment, свежестью запуска 300 s и допуском часов 60 s до
  runtime/DB/journal. При ошибке, отсутствии identity или crypto нет общего writable
  namespace. Scope включает Projects/Revisions, library/resources, pin journal,
  staging, history/GC roots, writer/takeover и preferences. A→B→A сохраняет
  доступ A и не раскрывает его B; generation и локальный serialized barrier
  ограничивают позднюю publication, reconciliation и pin cleanup, но не
  синхронизируют разные contexts. Проверенный scope — локальная организация,
  не авторизация, шифрование или защита от владельца устройства/скрипта origin;
  host activation events не удостоверяют аккаунт. Реальное разделение аккаунтов
  и обнаружение смены для конкретного клиента требуют evidence. Identity/initData
  не входят в Project/backup или PII logs. Полный алгоритм — AD-26. Protocol и
  Ed25519 keys документированы Telegram; полный signed positive known-answer
  vector опубликован tma.js maintainers, это не официальный Telegram SDK vector;
  исторический vector проверяется с фиксированными test clocks.
- Telegram scope использует одну IDB v2 `interiors-editor-projects:<scope>`;
  upgrade v1 сохраняет identity/protocolVersion=1 и полный uint64 counter под
  Web Lock, без reset/пересоздания; unknown/corrupt/blocked/late upgrade —
  fail-closed. Browser DB не меняются. Undo/Redo перепривязывает pointer к exact
  owned Revision без её перезаписи, с новым fenced attempt/receipt.
- До первой writable S2 операции Story 10.2 обязательны все cross-context guards
  [S2 disposition](../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md):
  scope Web Lock, атомарный owner/fence/base/attempt stage, durable receipt,
  monotonic counter/ID, no-publish и conditional cleanup, atomic protect/pin и
  takeover/recovery. При отсутствующем guard/lock или неизвестном исходе — без
  unsafe записи и с сохранением roots/bytes. Scope-wide general GC сейчас нет,
  для S2 он не вводится; SessionRetentionPolicy и History roots сохраняются.
  Новый standalone validator/barrier не является интегрированным runtime/storage,
  полной S2 проверкой или physical-client evidence.
- Back/Close следует матрице UXF-8 с приоритетом самой защитной строки: панель
  без draft закрывается; для draft/ConflictPreview предлагаются продолжение или
  явная отмена, отмена выхода сохраняет draft, selection и focus. Жест не
  подтверждается автоматически. PendingDurability ждёт outcome при
  управляемом выходе; persist-failed сохраняет точный candidate и retry/recovery-
  export, отказ от candidate требует явного подтверждения. Recovery не удаляет
  и не чинит Project автоматически. Внезапное закрытие не считается
  предотвратимым; восстанавливается последняя Durable Revision. Host swipes
  ограничиваются только когда нужно и возвращаются при выходе.
- Background/resume, theme, keyboard, safe-area и viewport не создают команды;
  устаревший screen↔plan transform нельзя публиковать, возвращение проверяет
  base и writer fence. Renderer dispose/context loss не меняет Project.
  Необходимые действия и активное поле доступны при 360 CSS px/200% текста.
- После online запуска offline доступен только реально подготовленный editor,
  нужный 2D/3D lazy module, codec и exact pinned resources. Отсутствие каждого
  компонента обозначается отдельно; outage unpinned каталога не делает здоровый
  Project read-only. Не обещать cold offline Telegram или общий storage с PWA.

## Доставка и возврат

AD-28 сохраняет ReleaseManifest/schema handshake независимо от service worker:
`writable`, `read-only-exportable`, `migration-in-progress`; несовместимость,
недоступный manifest или ошибка migration не разрешает небезопасную запись.
До переключения проверяется полнота immutable assets, прежние URL/lazy chunks
остаются доступными открытым поддерживаемым клиентам при release и rollback
до отдельного безопасного retirement-решения; budget считается по текущему
shell. На каждом origin `/catalog-api` остаётся catalog-only, без credentials и
с прежними hash/range/pin/cancel guards. В S0–S7 Web/PWA, её install/offline,
update, пользовательские данные и проверки сохраняются. Удаление browser-owned
оболочки возможно только после проверки владельцем Telegram, применимых
критериев, внешних backups/переноса, решения о доступе к старым данным,
проверенного rollback и отдельного retirement gate. Origin change не переносит
IndexedDB; общего core, browser APIs и user data удаление не предполагает.

## Строгий перенос и граница S3

FR-57 и AD-29 требуют явный перенос реального внешнего файла в обоих
направлениях, проверку размера до полного чтения, отмену/retry, exact resource
hashes и семантику без mm drift. Полный staged import публикуется с новым
Project ID, не меняя source или существующие Projects; History не переносится.
Подготовка bytes, попытка передачи и доказанный внешний roundtrip — отдельные
состояния. `downloadFile` требует HTTPS, не `blob:`; вызов не доказывает выдачу.
Upload Project/GLB/backup и bot delivery не разрешены.

### Telegram: стандартный импорт файла

Стандартный пользовательский file-transfer ingress Telegram принимает только
зарегистрированный Portable Backup через strict envelope/witness dispatch и
соответствующий scoped import use case. Signature, расширение или отказ не
переключают его на старый `ImportLocalProjectJsonUseCase` или decoder вне
зарегистрированного single-dispatch: non-ZIP/JSON не является отдельным Telegram
ingress и получает честный
неподдерживаемый/ошибочный outcome без создания Project. Ранние source-owned
container/size/checksum errors и PPJ nonaccepting handoff сохраняют свой порядок.
Все обычные transfer-входы, повтор и host callback используют ту же host-boundary policy;
доверенная runtime composition выбирает decoder, не содержимое файла.

`RecoveryDraft` — отдельный явно выбранный recovery route с собственными
валидацией и safety fences. Он не вызывается как fallback стандартного импорта
и не называется complete Portable Backup. Web/PWA сохраняет существующий
обычный JSON + archive transfer route и его проверки, а также ранее отдельно
выбранный registered-transfer ingress. Точный UI и ошибки не обещают общность
storage или автоматическую совместимость файла.

Это применимость FR-55/57: поддерживаемый `.interiors` и эквивалентные доменные
команды сохраняются; отсутствие Telegram JSON route не разрешает переименовать
неоднозначный current backup в неподдерживаемый и объявить FR-57 выполненным.
Пустой Project, реальные файлы обеих сторон, новый ID и физический roundtrip
остаются evidence gates. Этот контракт не утверждает, что runtime/UI уже
переключены или что физическая приёмка пройдена.

[Portable Backup ingress registry](portable-backup-ingress-registry.md)
регистрирует PPJ-A1, `interiors.project/runtime-v1-wire@1` и точный
`V1-legacy` с обязательными byte-equality и PPJ-disjoint witness, применяя
closed [AD-30 grammar](../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-portable-v1-disposition-2026-11-04.md).
Это нормативный форматный контракт, не доказательство работающего decoder или
совместимости реальных файлов. PPJ manifest/ledger/resource binding и семантика
`proofRef` не имеют полной закрытой schema; см.
[PPJ envelope и handoff](ppj-a1-envelope-and-handoff.md). PPJ candidate можно
передать полному validator только без acceptance и без V1 fallback. PPJ scalar parser, raw geometry и error precedence
не ослабляются; V1 scanner сохраняет разрешённые UTF-16 code units, own-undefined,
finite yaw, `-0`, variant arrays и hash spelling без подмены старого serializer,
IDB или checksums. Current ProjectLimitsPolicy и FR-44 сохраняются.

| Producer → consumer | Контракт и фактическое состояние |
|---|---|
| Старый Web/PWA → старый Web/PWA | Runtime V1 envelope; синтетический baseline не доказывает пользовательские физические файлы. |
| Старый Web/PWA/S1 → будущий Web/PWA/TMA | Строгий V1-legacy только с witness и полным validation; ambiguous/unreadable source сохраняется, совместимость реальных файлов ещё pending. |
| Будущий Web/PWA ↔ TMA | Дополнительный browser V1-wire export; exact fields/resources, новый Project ID только при импорте; browser ingress использует отдельный anonymous namespace AD-31 и принимает только доказанно представимые прежним backup файлы. Readiness, implementation, file corpus и внешний iOS/Android roundtrip pending. |
| Новый wire → старый Web/PWA | Старый decoder не поддерживает новый selector; обновление требуется, реальная client pair не проверена. |
| PPJ-A1 → будущий client | Только полный strict PPJ staged ingress и полностью lossless mapping; mapper/corpus pending, PPJ не тождественен V1. |
| Новый browser registered namespace → старый installed Web/PWA | Старый клиент не видит новые локальные Projects; проверенный совместимый legacy backup может импортироваться как отдельная копия. Нет sync; version/rollback UX и фактические файлы pending. |

### Выбранный пользователем browser transfer ingress

В рамках FR-45/FR-57, CAP-10/13 и TMA-12 допускается отдельный **явно
выбранный пользователем registered-transfer ingress** Web/PWA для обратного
TMA → Web/PWA файла до замены browser exporter. Он использует общий
ImportUseCase и строго зарегистрированный V1 codec в выделенном route: без
переключения на него по содержимому файла как permissive fallback и без
изменения прежних import/export действий, browser decoder, действующих Web/PWA
данных или проверок. Его успешный импорт создаёт только новый Project ID после
полного validation и fenced atomic publication.

По AD-31 destination — отдельный anonymous browser namespace с собственными
ресурсами и recovery, не Telegram identity и не изменение старой DB. Общая
directory и все операции адресуют Project по доверенной паре namespace/raw ID;
raw ID при импорте отличается от source ID и до принятия проверяется по обоим
известным stores. Позднее совпадение между stores не сливает разные записи.
Частичная недоступность не скрывает и не удаляет прежние Projects. Прежний
offline browser backup с собственными exact pinned resources обязателен и после
дальнейших изменений. Старые PWA не видят новую область; отдельная копия через
проверенный файл не является sync. Details и условия допуска — в §1.4 и AD-31;
UX, отдельный scoped readiness и реальные update/rollback evidence ещё нужны.

Это выбор маршрута, не выбор trusted feasibility policy из файла. Только этот
новый browser ingress до IDs и staging проверяет точную представимость в прежнем
backup; неподходящий valid wire отклоняется с сохранением source и raw keys.
Действующий browser default и другие команды не меняются. Если любой из
обязательных browser checks не проходит, такой V1 snapshot нельзя объявить
совместимым или протолкнуть через обход. Порядок и ограничения — в
[Project/Backup contract](project-and-backup-contract.md) §1.4. Architecture AD-30 определяет
format-specific policy именно для trusted Telegram composition; расширение её
выбора на browser требует отдельного source-owned решения, если без него
нельзя безопасно поддержать нужный snapshot. PPJ требует полного validator и
lossless mapper либо остаётся непринятым handoff; producer authenticity не
выводится из selector/checksum. Существующие действия и требование явного выбора
сохраняются; новое UI-размещение и его семантика требуют согласования UX owner.
Этот технический маршрут сам по себе не
подтверждает целевую платформу, file roundtrip или любую compatibility matrix.

### Дополнительный browser export для переноса

В рамках CAP-10/13, FR-45/57 и S3 общего versioned codec допускается отдельное
явно выбранное действие Web/PWA для создания registered V1-wire файла, в том
числе пустого Project, рядом с сохраняемым прежним backup. UX определил название
`Экспорт файла для переноса` и размещение в действиях Projects и меню editor;
Architecture AD-30 допускает отдельную trusted browser composition. Применимый
readiness gate остаётся отдельным условием реализации и поставки; наличие этих
решений само по себе не объявляет действие доступным.

Действие читает согласованный snapshot выбранной Durable Revision и exact pinned
resources локального browser context, проверяя checksum, domain, limits, resource
bytes и actual render smoke; формирование и выдача файла не меняют Project,
Revision, History или raw keys, не создают новый Project ID и не отправляют данные
на сервер. Потеря snapshot/resources, отказ или отмена сохраняют исходные данные
и не объявляются успехом. Непредставимый reader/Project безопасно отклоняется;
этот export не объявляется поддержкой всех исторических healthy V1 Projects.
Проверить защиту snapshot/resources от подмены и удаления на время операции.
При несохранённой работе экспортируемая Durable Revision не выдаётся за новый
candidate. Проверить принадлежность фактического structured snapshot выбранному
Project: internal JSON/checksum и in-memory current сами по себе не различают
`-0`/`0` и own-undefined/absent. Чтение ресурса само по себе не доказывает pin:
каждый raw key требует проверки root, bytes, длины и полных 256 bits SHA, а его
lifetime должен исключать гонки с cleanup, удалением и takeover.

Действующий registered resource preflight ограничен 25 MiB, независимо от
50-MiB portable envelope. Roomless smoke не доказывает GPU render; текущий
синхронный ZIP не доказывает мгновенную отмену внутри операции или допустимый
peak memory на телефоне. Эти свойства требуют отдельного evidence; cancellation
не выдаётся за готовый файл, исходные данные сохраняются.

Успешно сформированный файл должен быть однозначным registered V1-wire и пройти
обычный strict TMA ingress без fallback; проверяется фактический writer, а не
только selector. Существующий runtime export use case является кандидатом для
переиспользования, не доказательством browser integration. Прежние Web export,
import, default policy, History и DB остаются; обратный browser ingress
сохраняет exact legacy representability и прежнюю policy. Отдельное действие не
закрывает FR-44 gate замены старого exporter, FR-57 или NFR-28.

Для конкретного наблюдённого old-Web empty legacy файла возможен кандидат
recovery: явно импортировать его в старый Web как новый локальный Project,
затем выбрать новый registered export и strict TMA import. Исходный файл должен
сохраниться; восстановление заявляется только после проверки конкретных файла,
версий и реальных клиентов с полным сравнением данных. Это не доказывает
authenticity либо универсальную promotion всех ambiguous legacy файлов.

До утверждения совместимости проверить созданные actual browser writer файлы
для empty, room и объектов с реальными GLB/resources: strict TMA import, точные
geometry/metadata/hosts/bytes, новый ID при импорте и отсутствие изменений
browser Project/Revision/history/checksum. Отдельно нужны unsupported source,
missing/corrupt resource, отмена, конфликт snapshot/resource, прежние browser
regressions и реальный внешний handoff на применимых iOS/Android клиентах.

Добавление strict import route не является заменой browser exporter. Она
запрещена до доказанной backup-ready представимости **всех** non-corrupt Durable
Projects действующей policy, включая читаемые sole-copy вне текущей wire grammar
и non-index array properties; одного успеха представимого подмножества мало.
Старые export/recovery и исходные данные сохраняются, пока gate не выполнен.

Старый empty V1 без witness отклоняется без изменения файла. Старый build не
доказывает recovery автоматически: для конкретной sole-copy требуется доказать
путь через изолированный старый build, безопасный upgrade того же local context,
новый wire и полное сравнение geometry/metadata/hosts/resources и source hash.
До этого recovery и соответствующая приёмка pending; если путь невозможен,
Product Owner решает условия ограничения FR-57. Читаемые sole-copy за пределами
closed V1 grammar также не объявляются corrupt и не отбрасываются.

Предварительная граница legacy bytes `0` не позволяет восстановить знак ранее
сохранённого `-0`. Новый wire сохраняет различимый `-0` и own-undefined в
structured-clone snapshot; он не переписывает исходные Revision/checksum.
Перед заменой старого browser exporter нужны proof применимости FR-44 ко всем
non-corrupt Durable Projects действующей policy, исполняемый worst-case corpus,
file/build matrix и безопасный rollback. Пока proof отсутствует, старый export и
recovery сохраняются. Если local handoff невозможен, только отдельное решение
Product Owner выбирает альтернативу и её privacy/retention.

## Открытые границы

Владелец 2026-11-04 разрешил прежний licensing source conflict: AGENTS согласован
с PRD/SPEC/AD-14, formal AssetUsageGrant/licensing/provenance/declaration/
attribution/notice admission не является Alpha gate; бесплатные или свои модели
отбираются владельцем вне приложения. Exact resource/security/hash/pin и запрет
upload пользовательских Projects/files сохраняются. AD-26/28/29/30 —
архитектурные assumptions. Реальные bot/origins, signed identity/Ed25519,
разделение аккаунтов, lifecycle/storage, release/rollback и physical iOS/Android
roundtrips остаются pending. S1 отдельно verified; metadata substrate и локальные
checks не доказывают полную S2 publication или physical-client isolation. NFR-28
требует физический путь на iPhone 15 Pro Max и Samsung S24 Ultra либо согласованной
замене, с версиями OS/Telegram и внешним повторным импортом; fake его не заменяет.
