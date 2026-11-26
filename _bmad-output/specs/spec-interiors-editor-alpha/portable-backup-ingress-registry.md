# Реестр ingress для Portable Backup

Статус: **source-owned contract; evidence и реализация ещё не приняты**.
Этот companion владеет выбором схемы `project/project.json`, raw-byte
traversal, реестром геометрических чисел и классификацией legacy fixture. Он
не выбирает storage substrate, не доказывает importer и не меняет границу
atomic publication.

# 1. Source-owned registry и single dispatch — 2026-11-04

Эта версия SPEC регистрирует три **контрактные** строки. Их регистрация не
доказывает runtime implementation, совместимость конкретных файлов, S3 READY
или physical acceptance. Полная closed V1 grammar, scanner, envelope,
resource bindings, numeric/UTF-16/undefined rules, bounds и error map входят в
этот контракт через adopted [AD-30 disposition](../../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-portable-v1-disposition-2026-11-04.md)
(разделы «Три закрытые строки выбора» — «Порядок, reasons и atomic publication»).
Это фиксированная source-owned grammar, а не extensible ссылка на текущий код.
Позднейшие селекторы AD-35, AD-36, AD-40 и AD-43 определены отдельными строками
в конце документа и сохраняют границы этого раздела.

| Manifest pair | Root Project selector | Контрактный маршрут |
|---|---|---|
| `interiors.project/alpha-1@1` | exact тот же selector и raw version `1` | неизменный PPJ-A1 по §§2–5; без V1 fallback |
| `interiors.project/alpha-1@1` | ключ `projectSchemaId` **отсутствует**, raw version `1` | только closed `V1-legacy`: точные исторические canonical bytes и PPJ-disjoint witness, затем полная проверка и copy-on-write import |
| `interiors.project/runtime-v1-wire@1` | exact тот же selector и raw version `1` | только `V1-wire`, с полным exact V1, validation и copy-on-write import |

В обоих V1 путях canonical member — `project/project.json`, manifest source ID
и root Project ID точно совпадают как V1 UTF-16 code units. Null, duplicate,
wrong selector, несовпадение pair/source ID, незарегистрированная версия или
отсутствие legacy witness дают `BACKUP_SCHEMA_UNREADABLE` на стадии dispatch;
malformed manifest — `BACKUP_MANIFEST_INVALID`. Bare version или форма файла не
разрешают поиск другого decoder; PPJ, legacy и wire никогда не fallback друг в
друга. Отсутствие root selector и checksum не доказывают происхождение.

Для V1-legacy хотя бы один validated record обязан содержать один из exact
witness: item `anchorClass=floor|wall`; definition `format=glb` и `resourceHash`;
Room с обычным `type`; Room без обязательного PPJ `name`; Room с
`faceFingerprint`, не являющимся lowercase SHA-256 из 64 hex. Иначе вход
консервативно ambiguous и отклоняется с сохранением исходных bytes. Пустой старый
V1 может попасть в эту группу. Old-build→new-wire transfer является лишь
кандидатом recovery до доказательства на конкретном файле и клиентах; sole-copy
без проверенного пути нельзя объявлять восстановленной или повреждённой.

Для V1-wire только зарегистрированные V1String pointers принимают UTF-16 wrapper
`{"utf16be":...}` для lone surrogate и optional pointers — closed marker
`{"undefined":true}` для own-undefined; точные правила и canonical base64url
в adopted grammar. Числовой raw `-0` сохраняется на разрешённых V1 pointers,
`yawRadians` — finite exact binary64, `0.5` допустим; `yawStep` не подставляется
через округление. Старый JSON `0` не доказывает прежний знак. PPJ по-прежнему
использует собственный scalar-only AST-R1 и canonical `-0→0`; V1 scanner не
меняет PPJ grammar, limits либо reason order. Точный V1 object передаётся из
проверенного durable candidate, а revision string/checksum и IDB не меняются.

PPJ Project schema и registered selector не делают PPJ envelope полным: exact
manifest/ledger grammar, resourceRefs/contentHash bindings и proofRef остаются
открытыми source-owned вопросами. [PPJ envelope и handoff](ppj-a1-envelope-and-handoff.md)
перечисляет уже утверждённые факты, недостающее и допустимую передачу без
принятия Project; V1 manifest shape не подменяет PPJ.

## 1.1 Общий порядок

Safe raw path/container → bounded manifest/ledger syntax и bindings (без раннего
отказа только из-за синтаксически корректного неизвестного selector) → 10 MiB
Project member guard → checksum → bounded non-accepting selector scan → строго
один format-specific parser → selector/root/source identity → closed grammar и
raw lexemes → действующие policy limits → domain/host/resources → fenced atomic
copy-on-write publish. До checksum и size неизвестный selector не перебивает их
ошибки. PPJ или неопределённый маршрут применяет существующий PPJ AST-R1 и его
порядок ошибок; только строго отсутствующий root selector в старом manifest
может использовать отдельный bounded V1 scanner и witness. Duplicate selector,
malformed JSON и более ранний capacity failure не обходятся lookahead. Тот же
routing contract применяется к import и exact-resource repair from backup;
repair не подменяет `RecoveryChangeSet` и не создаёт Project. Recovery export
pending candidate не называется complete backup.

Структурная граница V1 допускает до 250 definitions, но не ослабляет более
строгий существующий ProjectLimitsPolicy (100 уникальных definitions для текущей
policy), resource 50 MiB, сумму 180 MiB и полный archive 190 MiB. Архитектурные
bounds и STORE writer подлежат независимому worst-case corpus до rollout. Перед
заменой browser exporter доказать exact export всех non-corrupt Durable Project
текущей policy по FR-44/NFR-13; иначе старый путь остаётся доступным и source
owner разрешает любые читаемые sole-copy вне представимой grammar.

## 1.1.1 PPJ handoff не является acceptance

Независимый V1 codec вправе передать PPJ candidate полному PPJ validator только
как immutable bounded raw handoff; prior errors сохраняют исходный порядок.
Lookahead до проверенного manifest/checksum/PPJ AST — tentative routing, не
завершённый single-dispatch или checksum verification. Если V1 control scanner
упирается в собственные structural caps, а PPJ контрольные пределы для такого
содержимого source-owned не определены, `requires-ppj-validation` сохраняет
bounded immutable archive/control bytes и непроверенные boundaries; такая
capacity сама по себе не является PPJ fault. Общие container/path/manifest-byte
limits и действительно установленные более ранние ошибки сохраняются. Даже после доказанных
ранних checks handoff не является accepted Project, не pin-ит resources и не
публикует Revision. При отсутствии полного PPJ validator/mapper честно сообщить
недоступность проверки, сохранить source и не возвращать V1 fallback или ложную
schema error только из-за отсутствия реализации. Подробности —
[PPJ envelope и handoff](ppj-a1-envelope-and-handoff.md).

## 1.2 PPJ-A1 selector (только PPJ)

| Поле | Manifest | Корень `project/project.json` | Требование |
|---|---|---|---|
| Schema ID | `projectSchemaId` | `projectSchemaId` | Ровно `interiors.project/alpha-1` |
| Version | `projectSchemaVersion` | `schemaVersion` | Ровно positive integer `1` |
| Canonical member | `canonicalProjectPath` | — | Ровно `project/project.json` |
| Source Project identity | `sourceProjectId` | `projectId` | Ровно один opaque source ID; import не reuse-ит его |

Обе PPJ schema-пары совпадают точно; нижеследующие §§2–5 описывают PPJ-A1,
если не сказано иное. Новая V1 строка не изменяет эти правила.

# 2. Закрытый snapshot PPJ-A1

`interiors.project/alpha-1` — только canonical current-state snapshot. Он
содержит metadata Project, один `level`, его `vertices`, `wallSegments`,
`rooms`, `openings`, `assetInstances`, asset-definition references, selected
variants и surface assignments. Каждый record принимает только
зарегистрированные ниже keys; duplicate JSON key, unknown key, неверный JSON
type или отсутствующий required key делает Project schema unreadable.
Unordered collections canonical serializer сортирует по opaque ID; array order
не является topology authority. Это portable materialization, а не требование к
внутреннему repository encoding: например, implementation может хранить
Openings рядом со WallSegment, но PPJ-A1 всегда materializes `/level/openings`.

Каждая PPJ-A1 JSON string — последовательность Unicode scalar values, а не
host-language UTF-16 code units. Canonical serializer кодирует scalar values
strict UTF-8: `"`, `\` и C0 control values получает необходимый JSON escape
(`\u00xx` для control с lowercase hex), все остальные scalar values выходят
как direct UTF-8; он не сериализует surrogate `\uXXXX` form. Поэтому
in-memory string с lone surrogate не является PPJ-A1-materializable и должна
быть отклонена owning field validation до `BackupFeasibilityPolicy`, Durable
Revision или export — без replacement character, CESU-8 или WTF-8 fallback.

| JSON Pointer | Required keys | Допустимые nested collections |
|---|---|---|
| `/` | `projectSchemaId`, `schemaVersion`, `projectId`, `name`, `createdAt`, `updatedAt`, `lifecycle`, `level`, `assetInstances`, `assetDefinitionRefs` | только named keys этого table |
| `/level` | `levelId`, `vertices`, `wallSegments`, `rooms`, `openings` | эти четыре arrays |
| `/level/vertices/*` | `vertexId`, `xMm`, `zMm` | `/level/vertices` is canonically sorted by `vertexId`; current ProjectLimits count is 300 warning / 600 hard |
| `/level/wallSegments/*` | `wallSegmentId`, `startVertexId`, `endVertexId`, `thicknessMm` | — |
| `/level/rooms/*` | `roomId`, `faceFingerprint`, `name`, `heightMm` | — |
| `/level/openings/*` | `openingId`, `wallSegmentId`, `offsetMm`, `widthMm`, `heightMm`, `sillMm`, `kind` | — |
| `/assetInstances/*` | `assetInstanceId`, `assetDefinitionId`, `placement`, `instanceDimensionsMm`, `variantSelections` | one discriminated `placement` record, exact current dimensions and sorted variant-selection array |
| `/assetInstances/*/instanceDimensionsMm` | `widthMm`, `depthMm`, `heightMm` | current resolved physical dimensions under referenced `resizePolicy` |
| `/assetInstances/*/placement` | `kind` plus exactly the branch keys below | `floor` or `wall` branch only |
| `/assetInstances/*/placement` when `kind = floor` | `kind`, `roomId`, `xMm`, `zMm`, `elevationMm`, `yawStep` | — |
| `/assetInstances/*/placement` when `kind = wall` | `kind`, `wallSegmentId`, exactly one of `adjacentRoomId` / `exteriorSide`, `offsetMm`, `elevationMm`, `normalOffsetMm`, `orientation` | — |
| `/assetInstances/*/variantSelections/*` | `variantKey`, `optionId` | opaque strings; strictly bytewise ascending distinct `variantKey`; current ProjectLimits count is 16 warning / 32 hard per AssetInstance |
| `/assetDefinitionRefs/*` | `assetDefinitionId`, `source`, `semanticSnapshot`, `contentHash`, `resourceRefs`, `proofRef` | `resourceRefs` is a strictly bytewise ascending distinct opaque-string array; current ProjectLimits count is 16 warning / 32 hard per AssetDefinition |
| `/assetDefinitionRefs/*/semanticSnapshot` | `dimensionsMm`, `footprintMm`, `allowedPlacementKinds`, `floorYawSteps`, `wallOrientations`, `resizePolicy` | embedded PPJ-A1 AssetDefinition snapshot, not a second resource schema |
| `/assetDefinitionRefs/*/semanticSnapshot/dimensionsMm` | `widthMm`, `depthMm`, `heightMm` | — |
| `/assetDefinitionRefs/*/semanticSnapshot/footprintMm` | `frame`, `vertices` | `frame = asset-local-floor-mm-v1`; canonical ordered vertices |
| `/assetDefinitionRefs/*/semanticSnapshot/footprintMm/vertices/*` | `xMm`, `zMm` | current ProjectLimits count is 32 warning / 64 hard per AssetDefinition |
| `/assetDefinitionRefs/*/semanticSnapshot/resizePolicy` when `kind = fixed` | `kind` | current instance dimensions must exactly equal `dimensionsMm` |
| `/assetDefinitionRefs/*/semanticSnapshot/resizePolicy` when `kind = uniform` or `perAxis` | `kind`, `minDimensionsMm`, `maxDimensionsMm` | both nested records have exactly `widthMm`, `depthMm`, `heightMm` |

Таблица закрыта: PPJ-A1 не имеет extension bag, alternate spelling или
неявного optional member. Следующая scalar/discriminator table — часть этой
wire grammar; нарушение JSON type, literal, string form или ordering —
`BACKUP_SCHEMA_UNREADABLE`, а не поздняя domain normalisation.

| Поле/группа | Wire form | Schema-stage rule |
|---|---|---|
| Opaque ID (`*Id`, `proofRef`, `resourceRefs/*`, `variantKey`, `optionId`) | ASCII string `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$` | exact bytewise equality; no Unicode/case fold |
| `contentHash` | lowercase SHA-256 string `^[0-9a-f]{64}$` | exact referenced manifest/resource hash must resolve later |
| `faceFingerprint` | lowercase SHA-256 string `^[0-9a-f]{64}$` | hash of rederived normalized Face data; mismatch is unreadable |
| `name` | valid UTF-8 string, 1–256 Unicode scalar values, no C0/C1 control | no trim/normalisation |
| `createdAt`, `updatedAt` | RFC 3339 UTC string `YYYY-MM-DDTHH:mm:ss(?:\.[0-9]{1,9})?Z` | calendar-valid; no local offset; chronology is later domain validation |
| `/schemaVersion` | JSON number with raw lexeme exactly `1` | PPJ-A1 selector only; `-0`, string and decimal are unreadable |
| `lifecycle` | string `active` | exact case-sensitive literal; любой иной lifecycle unreadable |
| Opening `kind` | string `Door` or `Window` | exact case-sensitive literal |
| AssetDefinitionRef `source` | string `CatalogVersion` or `CustomAssetId` | exact case-sensitive literal; PPJ envelope/resource binding remains source-owned and unresolved; no Alpha legal/grant admission gate |
| placement `kind` | string `floor` or `wall` | must match its declared branch; placement kind must belong to the referenced asset snapshot `allowedPlacementKinds` |
| `exteriorSide` | JSON boolean `true` | mutually exclusive with `adjacentRoomId`; no `false`/string/null form |
| `semanticSnapshot/footprintMm/frame` | string `asset-local-floor-mm-v1` | vertices are x/z around the confirmed local placement anchor `(0,0)` |
| `allowedPlacementKinds` | nonempty sorted set of literals `floor < wall` | no duplicate; matching rotation set is nonempty and every non-allowed kind has an empty set |
| `floorYawSteps`, `wallOrientations` | strictly ascending distinct arrays, each ordinal `0..7` | RotationStep V1: `n` is `n × 45°` positive right-hand around +Y from asset-local +Z to plan +Z; each matching placement ordinal must be a member |
| `resizePolicy.kind` | string `fixed`, `uniform` or `perAxis` | `fixed` forbids size change; `uniform` preserves exact base width:depth:height ratio; `perAxis` permits independently bounded dimensions only because policy explicitly declares it |

`faceFingerprint` заново выводится и проверяется из PlanGraph: это binding Room
metadata, но не второй editable authority для Face. `projectId` — provenance
source snapshot; import никогда не reuse-ит его как ID опубликованного нового
Project. `semanticSnapshot` находится в PPJ-A1 именно потому, что его
dimensions/footprint нужны placement/collision; binary model/texture остаются
отдельными exact bundle resources.

Canonical serializer orders every unordered array by the following key; parser
requires the same strict order rather than silently sorting an input:

| Array | Canonical order |
|---|---|
| `vertices`, `wallSegments`, `rooms`, `openings`, `assetInstances`, `assetDefinitionRefs` | bytewise `vertexId`, `wallSegmentId`, `roomId`, `openingId`, `assetInstanceId`, `assetDefinitionId` respectively |
| `variantSelections` | strictly bytewise ascending distinct `variantKey` |
| `resourceRefs` | strictly bytewise ascending distinct opaque ID |
| `allowedPlacementKinds` | fixed enum order `floor < wall` |
| rotation-policy arrays | increasing mathematical integer value, no duplicate |
| `footprintMm.vertices` | counter-clockwise ring, rotated so its lexicographically least `(xMm,zMm)` vertex is first; no repeated terminal vertex |

## 2.1 FaceFingerprint FP-A1

`faceFingerprint` is the lowercase SHA-256 digest of this exact UTF-8 byte
preimage, calculated from the rederived bounded Face after every listed Plan
coordinate has passed the raw schema boundary:

1. Write every ring vertex as its canonical integer pair `xMm,zMm` in base-10,
   without `+`, whitespace, decimal/exponent form or a repeated terminal
   vertex.
2. Orient the outer ring counter-clockwise and each void ring clockwise; rotate
   every ring so its lexicographically least `(xMm,zMm)` pair (compare `xMm`,
   then `zMm` as mathematical integers) is first.
3. Serialize as ASCII with no newline or spaces:
   `FP-A1|outer=x,z;x,z|void=x,z;x,z|void=x,z;x,z`. A Face without void uses
   only the `outer` segment. Sort complete `void=` segments bytewise before
   appending them.

The digest is a Room-metadata binding, not persisted Face geometry. A valid
wire-format digest that does not equal the rederived FP-A1 digest is
`BACKUP_SCHEMA_UNREADABLE` before migration/publication; deriving it is
read-only validation, not a Project candidate or a second authority.

## 2.2 Asset resize and placement bindings

`instanceDimensionsMm` is current resolved ItemInstance state, never a free
renderer scale. For `resizePolicy.fixed` it equals snapshot `dimensionsMm`.
For `uniform`, every dimension lies within its explicit min/max pair and exact
cross-products preserve base width:depth:height ratio. For `perAxis`, each
dimension lies within its explicit corresponding min/max pair; non-uniform
change is valid only for this explicitly declared policy.

Collision/host validation derives the current local footprint without float or
rounding. For every base snapshot vertex `(x,z)`, calculate
`x' = x × instanceWidthMm / baseWidthMm` and
`z' = z × instanceDepthMm / baseDepthMm` with ephemeral exact integer
arithmetic. Both divisions must produce a `SafeIntegerMm`; otherwise the input
is schema-unreadable. Fixed dimensions yield the unchanged snapshot footprint.
The resulting ordered ring, not a renderer scale, is the footprint consumed by
collision and host validation.

Every `FloorPlacement` must reference a derived Room, and every `WallPlacement`
must reference an existing wall plus its compatible adjacent Room or exterior
side. These are read-only post-PlanGraph bindings: an invalid Plan itself
retains its stable domain reason, while a valid Plan with an incompatible item
host is `BACKUP_SCHEMA_UNREADABLE` before migration/publication.

В этом schema нет derived `Face`, usable polygon, mesh, spatial index,
renderer/camera state, `SnapPolicy`,
`DraftCommand`, measurement, writer lease, staging/pin root, `revisionMetadata`,
session History, `Command`, `commands`, `commandEnvelope`, `ChangeSet` или
`inverse`.
Появление любого из этих keys на любом schema-registered record отклоняется
как `BACKUP_SCHEMA_UNREADABLE`. Portable Backup не переносит history, поэтому
serialized geometry Command payload в PPJ-A1 имеет **пустой реестр**: он не
допустим ни в root, ни в nested record.

Будущий schema, который захочет переносить semantic Commands, обязан до
регистрации назвать отдельный Command schema ID, полный discriminator/pointer
registry каждого payload, inverse boundary и no-history scope. До такой строки
никакой Command payload не проходит raw traversal и не может быть silently
interpreted как snapshot data.

## 2.3 Current PPJ-A1 collection limits and Durable symmetry

The following are current `ProjectLimitsPolicy` counts, not optional serializer
hints. They are checked only after the closed PPJ-A1 shape has passed, so a
schema-valid count above its hard value is `BACKUP_PROJECT_LIMIT`; warning never
rewrites, trims or normalizes input.

| Collection | Warning | Hard reject | Canonical rule |
|---|---:|---:|---|
| `/level/vertices` | 300 | 600 | strictly bytewise ascending distinct `vertexId` |
| `/assetDefinitionRefs/*/semanticSnapshot/footprintMm/vertices` | 32 | 64 per AssetDefinition | one canonical simple CCW local ring |
| `/assetInstances/*/variantSelections` | 16 | 32 per AssetInstance | strictly bytewise ascending distinct `variantKey` |
| `/assetDefinitionRefs/*/resourceRefs` | 16 | 32 per AssetDefinition | strictly bytewise ascending distinct opaque ID; existing 900 unique portable-entry hard limit still applies separately |

Before a PPJ-A1 candidate becomes Durable,
`BackupFeasibilityPolicy` materializes its canonical UTF-8 Project member and
runs the same AST-R1 dry count without building a full AST. It checks the 10 MiB
member limit, every table above and every AST-R1 cap. Any excess rejects the
candidate with existing `PROJECT_BACKUP_ENVELOPE_EXCEEDED`; the ordinary rejected
candidate/staging cleanup path applies and no Revision, History or publication
is created. This symmetric preflight is a contract requirement, not a claim of
an implemented serializer or evidence run.

# 3. GeometryFieldRegistry PPJ-A1

`SafeIntegerMm` означает raw lexeme
`^-?(?:0|[1-9][0-9]*)$`, затем final `Number.isSafeInteger`; `-0` становится
canonical `0` только после lexical acceptance. `SafeIntegerOrdinal` проходит
тот же lexical/safe-integer boundary, но не является миллиметром. Его
semantic range проверяет выбранная schema/domain rule, а не renderer; для
PPJ-A1 RotationStep V1 registered range — ровно `0..7`.

| JSON Pointer pattern | Значение | Type | Следующая проверка |
|---|---|---|---|
| `/level/vertices/*/xMm`, `/level/vertices/*/zMm` | координата Vertex | `SafeIntegerMm` | Project coordinate limit, затем PlanGraph |
| `/level/wallSegments/*/thicknessMm` | толщина centerline WallSegment | `SafeIntegerMm` | Project thickness limit, затем PlanGraph |
| `/level/rooms/*/heightMm` | единственная editable высота Room | `SafeIntegerMm` | Project room-height limit |
| `/level/openings/*/offsetMm` | offset Opening вдоль host WallSegment | `SafeIntegerMm` | Project limit, затем usable interval |
| `/level/openings/*/widthMm`, `/level/openings/*/heightMm`, `/level/openings/*/sillMm` | dimensions Opening | `SafeIntegerMm` | Project limit, затем Opening invariant |
| `/assetInstances/*/placement/xMm`, `/assetInstances/*/placement/zMm`, `/assetInstances/*/placement/elevationMm` при `kind = floor` | FloorPlacement в едином plan frame | `SafeIntegerMm` | host/placement validation |
| `/assetInstances/*/placement/yawStep` при `kind = floor` | discrete floor rotation | `SafeIntegerOrdinal` | asset placement rule |
| `/assetInstances/*/placement/offsetMm`, `/assetInstances/*/placement/elevationMm`, `/assetInstances/*/placement/normalOffsetMm` при `kind = wall` | WallPlacement coordinates | `SafeIntegerMm` | host/placement validation |
| `/assetInstances/*/placement/orientation` при `kind = wall` | discrete wall orientation | `SafeIntegerOrdinal` | asset placement rule |
| `/assetInstances/*/instanceDimensionsMm/widthMm`, `/assetInstances/*/instanceDimensionsMm/depthMm`, `/assetInstances/*/instanceDimensionsMm/heightMm` | current resolved AssetInstance dimensions | `SafeIntegerMm` | positive and compliant with referenced fixed/uniform/perAxis `resizePolicy`; exact local-footprint division must have no remainder |
| `/assetDefinitionRefs/*/semanticSnapshot/dimensionsMm/widthMm`, `/assetDefinitionRefs/*/semanticSnapshot/dimensionsMm/depthMm`, `/assetDefinitionRefs/*/semanticSnapshot/dimensionsMm/heightMm` | canonical physical dimensions AssetDefinition | `SafeIntegerMm` | positive AssetDefinition snapshot schema rule before placement/collision use |
| `/assetDefinitionRefs/*/semanticSnapshot/footprintMm/vertices/*/xMm`, `/assetDefinitionRefs/*/semanticSnapshot/footprintMm/vertices/*/zMm` | vertex local floor footprint around anchor `(0,0)` | `SafeIntegerMm` | nonempty simple CCW polygon, no repeated closing vertex, before placement/collision use |
| `/assetDefinitionRefs/*/semanticSnapshot/floorYawSteps/*`, `/assetDefinitionRefs/*/semanticSnapshot/wallOrientations/*`, `/assetDefinitionRefs/*/semanticSnapshot/ceilingYawSteps/*` | allowed discrete orientation policy | `SafeIntegerOrdinal` | strict ascending subset of `0..7`; matching placement must be member |
| `/assetDefinitionRefs/*/semanticSnapshot/resizePolicy/minDimensionsMm/widthMm`, `/assetDefinitionRefs/*/semanticSnapshot/resizePolicy/minDimensionsMm/depthMm`, `/assetDefinitionRefs/*/semanticSnapshot/resizePolicy/minDimensionsMm/heightMm`, `/assetDefinitionRefs/*/semanticSnapshot/resizePolicy/maxDimensionsMm/widthMm`, `/assetDefinitionRefs/*/semanticSnapshot/resizePolicy/maxDimensionsMm/depthMm`, `/assetDefinitionRefs/*/semanticSnapshot/resizePolicy/maxDimensionsMm/heightMm` when `kind = uniform|perAxis` | explicit resizable range | `SafeIntegerMm` | positive and min ≤ max per axis; `uniform` preserves exact base proportions |

`assetDefinitionRefs` в PPJ-A1 содержат opaque ID/hash/proof, embedded semantic
snapshot geometry и resource references. Dimensions/footprint/rotation policy
не могут быть hidden behind opaque reference: их raw numbers проходят эту
таблицу до asset/placement construction. Exact binary/texture bytes остаются в
versioned bundle resource entry; эти bytes не заменяют snapshot geometry.
Parametric asset geometry, если позднее станет additional Project JSON state,
требует новой строки реестра до import support.

Единственное разрешённое non-geometry JSON number в PPJ-A1 — root
`/schemaVersion`, который по §1 имеет raw value `1`; он не использует
`SafeIntegerMm` rule. Любой иной JSON number, отсутствующий в этой таблице,
нечитаем для schema.

В PPJ-A1 нет зарегистрированных pointer для serialized geometry Command. Это
намеренное покрытие, а не omission: raw parser отклоняет command container до
попытки прочитать payload.

# 4. Raw-byte and schema-aware traversal

## 4.1 Archive entry path wire grammar

До любого manifest decode importer читает raw central-directory filename bytes.
Имя должно состоять только из printable ASCII и **ровно** совпасть с одним из
следующих case-sensitive byte patterns:

```text
manifest.json
checksums.json
project/project.json
catalog/[0-9a-f]{64}.asset
catalog/[0-9a-f]{64}.texture
custom/[0-9a-f]{64}.glb
```

Нет CP437/UTF-8 fallback, Unicode/case normalization, percent decoding,
separator conversion или implicit directory entry. Поэтому NUL/control/non-ASCII
byte, `\`, leading/trailing slash, empty/`.`/`..` segment, repeated slash,
uppercase hash, absolute path, alias и любой unlisted path не проходят grammar.
Каждая raw byte string допустима ровно один раз; `catalog`/`custom` member
дополнительно обязан появиться ровно один раз в `manifest.entries`. Этот
exact-byte grammar определяет `BACKUP_PATH_UNSAFE`, а не ZIP library result.

## 4.2 PPJ-A1 lossless AST resource envelope (AST-R1)

The 10 MiB member cap bounds input bytes, not the allocation induced by a
lossless JSON tree. `AST-R1` is the source-owned hard envelope for the current
PPJ-A1 row. It is an ingress resource guard, not a claim that a browser heap,
worker or importer has been measured or accepted.

| Resource counted while parsing `project/project.json` | AST-R1 hard cap | Exact counting rule |
|---|---:|---|
| Container nesting | 8 | An object or array increments depth; the root container is depth 1. Scalars do not increment it. The deepest current PPJ-A1 container path is 7. |
| JSON value nodes | 65,536 | Every object, array and scalar value, including the root, counts once; an object-member name is not a value node. |
| Object-member records | 49,152 aggregate; 32 in one object | A member record includes its decoded-name reference, duplicate-key lookup entry and child-value edge (or its one pending edge). Decoded-name bytes count only in `decodedStringBytes`; a member record is not a pointer-link record. |
| Array elements | 24,576 aggregate; 1,024 in one array | Every array value edge counts once, regardless of its JSON type. |
| Pointer-link records | one per value node | Exactly one `pointerLinks` record and its 16-byte formula term exist only when a value node is retained, including the root. A node retains a parent link and source-span/index segment into the already bounded staged member; a pending object member has no pointer-link record. Full RFC 6901 pointer strings are never copied per node. |
| Reconstructed JSON Pointer | 128 UTF-8 bytes | The root pointer is the zero-byte empty pointer. A diagnostic pointer is reconstructed on demand from parent links with RFC 6901 escaping of decoded member names and decimal array indices. On a completed unique object-member name, the prospective pointer of its child is checked without allocating a pointer-link record; a pointer above 128 bytes exceeds AST-R1 before colon/value. |
| Decoded JSON-string UTF-8 bytes | 4 MiB aggregate; 4 KiB for one string | Includes object-member names and scalar string values as completed decoded Unicode scalar values, not their raw spelling and not syntax whitespace. Charge each scalar's strict UTF-8 width: 1 byte (`U+0000..U+007F`), 2 (`U+0080..U+07FF`), 3 (`U+0800..U+FFFF`, excluding surrogates), or 4 (`U+10000..U+10FFFF`). A valid escaped UTF-16 surrogate pair charges exactly 4 bytes; its 12 raw ASCII escape bytes do not add a second charge. |
| Raw numeric-token bytes | 64 for one token | ASCII bytes from the first numeric character through the final numeric character are retained as the raw lexeme. |
| Retained AST metadata | 16 MiB | The implementation-independent charge is exactly `48 × valueNodes + 32 × memberRecords + 8 × arrayElements + 16 × pointerLinks + decodedStringBytes + rawNumericLexemeBytes + 8,320` bytes, where a member charge includes its duplicate-key lookup entry and `8,320 = 8 KiB` parser state plus the one 128-byte diagnostic-pointer buffer. The bounded staged member is retained at most once as raw backing storage and is not part of this charge; no host JSON object graph or copied full-pointer/string representation can bypass it. |

The parser validates UTF-8, JSON token syntax and decoded-string scalar
well-formedness incrementally per raw byte/chunk without retaining an unbounded
token or pointer. Raw UTF-8 must decode to Unicode scalar values. A JSON
`\uXXXX` escape first decodes one UTF-16 code unit: `D800..DBFF` must be
immediately followed by a complete `\uDC00..\uDFFF` escape, and
`DC00..DFFF` cannot appear without that high half. The paired code units emit
one scalar `U+10000..U+10FFFF`; an unresolved high half is a fixed pending
parser state, contributes zero decoded-string bytes and cannot reserve a
pointer/member/value record. The first raw byte that proves the pair impossible
(including the closing quote after a high half) rejects the string; a lone low
half rejects when its escape completes. Neither failure substitutes `U+FFFD`
nor emits CESU-8/WTF-8. A malformed raw UTF-8/JSON byte, an impossible
surrogate pair, or a duplicate completed member name is
`BACKUP_SCHEMA_UNREADABLE` before any capacity check caused by that same parser
event. Only after a complete scalar is well formed does its 1/2/3/4-byte
decoded-string charge apply; a syntactically and scalar-valid continuation that
then crosses a string/numeric-token cap stops immediately as
`BACKUP_PROJECT_LIMIT`.
When a decoded object-member name completes, the parser first performs
duplicate-key lookup. A duplicate name is `BACKUP_SCHEMA_UNREADABLE` before
the same completed name's prospective-pointer or pending-member capacity check.
For a unique name, it computes the prospective RFC 6901 pointer of that
member's child without allocating a pointer-link record, checks the 128-byte
pointer cap, then atomically checks and reserves exactly one pending member
record (`memberRecords += 1` and its 32-byte formula term). The reservation
does not increment `valueNodes` or `pointerLinks`, and does not add the
16-byte pointer-link term. Thus a unique root name of 128 decoded ASCII bytes
has the 129-byte prospective pointer `/` + name and is
`BACKUP_PROJECT_LIMIT` at its valid closing quote, before a colon, value or
EOF is read. Incremental string/numeric and aggregate decoded-string charge
are checked while their bytes arrive, so an earlier string/metadata cap is
`BACKUP_PROJECT_LIMIT` even if the eventual name would duplicate. Only at the
child's ordinary syntactically valid AST-retention event does the parser perform
its own depth/node/array/pointer/metadata check and add its value node and one
pointer-link record (the 48- and 16-byte terms) before retention. If a
missing/invalid colon or value is reached without an earlier capacity failure,
it is ordinary raw JSON syntax and `BACKUP_SCHEMA_UNREADABLE`; no pointer-link
was charged for that pending member. A valid next container/value that alone
crosses one of those caps is `BACKUP_PROJECT_LIMIT`. No outcome reaches
closed-shape traversal after an AST-R1 resource failure, or schema/domain/
migration/publication after either AST-R1 or raw syntax/duplicate failure.

## 4.3 PPJ-A1 traversal order

Importer выполняет этот порядок; поздняя стадия не может переклассифицировать
ранний failure или вызвать migration/publish после него:

1. Прочитать bounded container header/central directory, применить существующие
   container/entry/compression guards и path grammar §4.1 до decompression.
2. Прочитать bounded `manifest.json`. Missing/malformed/wrong-type
   `canonicalProjectPath`, wrong literal кроме `project/project.json`,
   malformed `projectSchemaId`, non-positive/non-integer `projectSchemaVersion`
   или malformed `sourceProjectId` — `BACKUP_MANIFEST_INVALID`;
   syntactically valid but unregistered schema pair остаётся candidate для
   `BACKUP_SCHEMA_UNREADABLE` после dispatch.
3. Incrementally stage exact canonical Project member. После successful path и
   generic container/entry checks declared или streamed Project JSON size больше
   10 MiB немедленно останавливает read как `BACKUP_PROJECT_LIMIT`, без
   checksum/AST/schema walk. Только bounded member проходит checksum before
   Project JSON acceptance.
4. После checksum построить AST-R1-bounded lossless JSON AST из raw UTF-8
   bytes. Для каждого value AST хранит parent/source-span pointer link и numeric
   lexeme; full JSON Pointer reconstructs only on demand within its bounded
   diagnostic buffer. Duplicate object key отклоняется. Normal `JSON.parse`
   result или reviver не является acceptance boundary.
5. Прочитать из AST только root schema discriminator и `projectId`, потребовать
   совпадение manifest/root schema pair и source Project identity, затем dispatch
   в этот registry. Bare V1/V2 number, inferred object shape или application
   codec не выбирает schema.
6. Обойти closed registered shape. В каждом GeometryFieldRegistry pointer
   проверить lexeme и safe integer до host-number coercion; любой другой number
   отклонить, если selected schema явно не регистрирует его type.
7. Применить remaining `ProjectLimitsPolicy` только к schema-valid values и
   counts.
8. Выполнить read-only bounded PlanGraph derivation. Невалидный Plan сохраняет
   свой stable domain reason. Только для valid Plan сверить FP-A1, item-host
   bindings и exact resizable-footprint relation; их mismatch —
   `BACKUP_SCHEMA_UNREADABLE`, без candidate/ID/Revision.
9. Если registered row этого требует, выполнить copy-on-write migration, full
   domain/resource validation, clean-profile smoke и atomic new-Project
   publication.

For PPJ-A1 step 9 has no migration handler. `-0` canonicalizes to `0` for
registered geometry only; `schemaVersion` is a positive ordinal and `-0` is
not a valid version. No stage allocates IDs, pins bytes, creates a Revision or
changes an existing Project before the final successful publication.

# 5. Canonical ingress reason precedence

Existing reason codes remain the owner-visible outcome. The following table
defines the PPJ boundary without allocating a new code; V1 uses the same earlier
container/size/checksum precedence and the format-specific scanner in §1.1.
The 1 MiB manifest-specific limit is not Project AST-R1 and does not apply to
`checksums.json`: a ledger above 1 MiB remains subject to its existing generic
entry/container guards, and V1-only scanner capacity cannot reject a PPJ
candidate. Streamed checks stop when this manifest limit is crossed; they do not
replace an independently established earlier container/path/read/cancel fault.

| First failing boundary | Canonical reason | Required precedence |
|---|---|---|
| Raw archive filename violates §4.1 or is duplicate, including `.interiors/project/project.json` | `BACKUP_PATH_UNSAFE` | Before manifest/project decode and every PPJ limit/schema check |
| Declared or streamed uncompressed `manifest.json` size exceeds 1 MiB | `BACKUP_MANIFEST_INVALID` | After earlier container/raw-path/entry faults, at the manifest boundary before full manifest read/parse, Project-member size/checksum or PPJ handoff; exactly 1 MiB is within this size limit. A prior fault retains precedence. |
| A syntactically valid `catalog`/`custom` entry is absent from valid `manifest.entries` | `BACKUP_PATH_UNSAFE` | After valid manifest, before Project-member staging and every PPJ schema check |
| Missing, unreadable, wrong-type or wrong-literal `canonicalProjectPath`, malformed `projectSchemaId`/`sourceProjectId`, or non-positive/non-integer `projectSchemaVersion` | `BACKUP_MANIFEST_INVALID` | After safe raw paths, before Project-member staging and schema dispatch |
| Declared or streamed canonical Project JSON exceeds 10 MiB | `BACKUP_PROJECT_LIMIT` | Bounded pre-AST exception: after safe path/container-entry checks, before checksum/schema/raw JSON traversal |
| Checksum mismatch of the bounded canonical Project member | `BACKUP_CHECKSUM_MISMATCH` | After the 10 MiB member guard; before every AST-R1/UTF-8/JSON/schema traversal |
| A syntactically valid next byte/member/value would exceed AST-R1 depth/node/member/array/pointer/string/numeric-token/metadata capacity | `BACKUP_PROJECT_LIMIT` | After successful bounded checksum, before closed-shape traversal and every remaining Project limit; malformed raw UTF-8/JSON, an impossible escaped surrogate pair, or a duplicate key at the same completed decoded member name wins as `BACKUP_SCHEMA_UNREADABLE` |
| Unreadable UTF-8/JSON or decoded-string scalar sequence (including a lone escaped UTF-16 surrogate), duplicate key admitted within AST-R1 capacity, valid-manifest/root schema-pair or source-ID mismatch, syntactically valid unregistered schema, unknown/disallowed field, wrong JSON type, forbidden transient/Command field, invalid raw lexeme or non-safe registered number | `BACKUP_SCHEMA_UNREADABLE` | After bounded checksum and AST-R1, before remaining Project limits and read-only PlanGraph binding validation |
| Schema-valid safe value or entity/reference count that exceeds remaining current `ProjectLimitsPolicy` | `BACKUP_PROJECT_LIMIT` | Only after the previous schema boundary; before PlanGraph binding/migration/publish |
| Valid PlanGraph but FP-A1 mismatch, incompatible item host, or non-integral/invalid resizable-footprint relation | `BACKUP_SCHEMA_UNREADABLE` | After remaining Project limits and read-only PlanGraph derivation; before migration/candidate/publication |

Container, unpacked-byte, entry, compression, checksum, missing resource,
cancellation and quota faults retain their existing distinct `BACKUP_*` reason.
The 10 MiB Project JSON guard and AST-R1 are the documented pre-shape resource
exceptions within `ProjectLimitsPolicy`; neither proves an importer-safe memory
profile. A later PlanGraph/domain invariant failure keeps its source-owned
stable reason and cannot be relabelled as one of this trio.

# 6. V1/V2 classification, migration and handoff boundary

Legacy topology/Project V1/V2 means only the pre-canonical characterization
fixture family; it never includes `MeasurementFormatPolicy V1`. Its canonical
classification, diagnostic handoff, future migration admission and recovery
boundary are [TCC-A1](topology-corpus-contract.md). This registry owns only
Portable Backup reason precedence.

| Portable input condition | Current handling | Forbidden effect |
|---|---|---|
| Registered PPJ-A1 | Full raw/schema/limits/domain/resource staged import; new Project ID only after successful publication | Overwrite of an existing Project |
| Registered future schema explicitly marked inspect-only by a later registry row | Header/original-byte inspection only; no reserialization | Current Project view, migration or publish unless that row later changes status |
| Unregistered V1/V2 fixture outside the exact AD-30 V1-legacy route inside otherwise valid, checksum-valid, AST-R1-admitted current envelope | `BACKUP_SCHEMA_UNREADABLE` after safe path/checksum/AST boundary; optional corpus records only bytes/hash and TCC-A1 class | Migration, pin, ID allocation, Revision, Project publication or user restore |
| Legacy-looking input with an earlier container/path/manifest/checksum/AST-capacity failure | That first existing `BACKUP_*` reason wins | Shape inference, fallback decoder or durable publication |

The corpus classifier does not reclassify an ordinary import failure and does
not create a Project, migration, resource pin or recovery. `RecoveryChangeSet`
repairs resources only of an already current Project and can never serve as a
legacy schema migration. A future registered legacy row still requires every
TCC-A1 migration condition plus the normal PPJ-A1 schema/limits/domain/resource
publication path.

# 7. Required evidence before a raw-backup slice can claim completion

- one fixture for every registry pointer and each repeated/discriminated
  placement, resize-policy, AssetDefinition snapshot and surface-address branch;
- decimal, exponent, sign, whitespace, string, null, boolean, array, object,
  unsafe integer, `-0`, coordinate/limit boundary, duplicate-key, scalar enum,
  timestamp, opaque-ID/hash and ordering cases;
- malformed selector manifest versus valid-but-unregistered/mismatched
  manifest/root schema/source-ID vectors; `>10 MiB` malformed Project JSON must
  prove the pre-AST `BACKUP_PROJECT_LIMIT` outcome;
- AST-R1 boundary vectors for depth, node/member/array count, pointer bytes,
  decoded-string bytes, retained-metadata bytes and numeric-token bytes,
  including a syntax/duplicate-key fault before versus at the cap-crossing byte;
- decoded-string vectors for raw UTF-8 scalar widths, JSON short escapes,
  BMP `\uXXXX`, valid escaped surrogate pairs (4 decoded UTF-8 bytes) and
  lone high/lone low/non-immediate-pair cases; each proves zero charge for an
  unresolved half, `BACKUP_SCHEMA_UNREADABLE` before a same-event capacity
  failure, and canonical export without replacement/CESU-8/WTF-8;
- one accepted all-hard-count PPJ-A1 dry-count/formula vector, one
  just-over-each independently reachable structural-cap vector, and cancel/crash
  cleanup vectors at an AST-R1 boundary;
- FP-A1 known-answer vectors, valid-Plan fingerprint mismatch, invalid-Plan plus
  stale fingerprint precedence, parent/global SurfaceAddress conflict and
  duplicate vectors;
- fixed/uniform/perAxis resize vectors: min/max, exact-ratio, allowed rotation,
  non-integral footprint quotient and the same pre-Durable admission outcome;
- every raw filename-byte/ASCII/case/Unicode/NUL/control, path alias/traversal/
  duplicate/backslash-normalization and manifest-unlisted-entry vector;
- forbidden Command/history/derived-field vectors;
- zero-mm semantic round trip, staged cancellation/crash/no-overwrite/new-ID
  vectors and reason-precedence assertions;
- TCC-A1 current PPJ-A1 versus V1-like/V2-like/unregistered-future
  `legacy-unreadable` vectors proving original-byte handoff and no migration,
  pin, ID allocation or publication; readable/unmappable/assessment vectors
  enter only with a later registered raw grammar/decoder; and
- future-schema inspection behavior without a current-Project/release claim.

Additionally, the registered V1 routes require every format-specific corpus,
witness, UTF-16/undefined/-0/variant, checksum/size precedence, exact resource,
copy-on-write and recovery vector in the adopted AD-30 disposition. Registration
does not establish that corpus or implementation has passed.

This registry defines what evidence must prove. It does not assert that the
importer, corpus, physical lifecycle/quota handoff, independent review or
implementation-readiness gate has passed.

## Runtime V1 floor yaw, AD-35

Пара (`interiors.project/runtime-v1-floor-yaw`, `1`) отдельно зарегистрирована
для Project member со свободным поворотом. Остальные поля, пределы, resource
mapping, checksum и порядок допуска остаются действующими по Runtime V1
wire. Единственная дополнительная величина — floor `yawMilliDeg`, raw
целый лексемный диапазон 0..359999, взаимоисключающий с legacy yaw fields.
Manifest и root обязаны ссылаться на один селектор. Canonical writer выбирает
новую пару только при наличии поля. PPJ-A1 и прежние Runtime selectors поле
не принимают. Точный writer и decoder отката проверяются до активации C.

## Runtime V1 door hinge, AD-36

Пара (`interiors.project/runtime-v1-door-hinge`, `1`) применяется, если
хотя бы у одной двери присутствует каноническое поле `hingeEnd: "end"`.
Отсутствие поля у двери означает петли в начале её интервала. У окна
поле недопустимо. В рамках этого селектора разрешён канонический
`yawMilliDeg` для напольного предмета по AD-35. Манифест и Project member
указывают один селектор. Размеры, checksum, ресурсы и допуск к импорту
следуют протоколу Runtime V1. В Telegram запись из этого архива допускается
в хранилище версии 4. Для проектов со всеми петлями в начале writer
выбирает прежний селектор в зависимости от наличия точного угла.

## Runtime V1 расстановки комнаты, AD-40

Пара (`interiors.project/runtime-v1-room-layouts`, `1`) разрешает поля
угла и петель из AD-35/36 и требует хотя бы одну явную комнатную расстановку.
Корневой `roomLayouts` содержит записи с точными ключами `layoutId`,
`roomId`, `slot` и `name`. Слот принимает `A` или `B`, имя проходит
действующие правила длины и канонизации. Идентификатор расстановки уникален
в Project, комната существует, каждый слот используется в ней один раз.
Поле `roomLayoutId` принимается только у напольного экземпляра комнаты
с явными расстановками и обязательно у каждого такого экземпляра. В комнатах
без явных записей допустим неявный A. Настенные экземпляры общие. Активный
слот относится к состоянию просмотра. Лимиты, точный resource ledger,
проверка домена и восстановление охватывают оба набора. Записываемый импорт
требует Telegram IDB 5 или следующую зарегистрированную версию, сохраняющую
эти возможности. Старый `runtime-v1-door-hinge` и остальные меньшие
селекторы остаются доступными для записей без явной расстановки по их правилам.

## Runtime V1 интерьер, AD-43

Пара (`interiors.project/runtime-v1-interior-details`, `1`) применяется
к снимку с хотя бы одним значимым полем расширения из таблицы. Она включает
действующие ветви Runtime V1 wire, точные углы и петли по AD-35/36,
принадлежность A/B по AD-40. `projectSchemaId` и `schemaVersion` корня
совпадают с `projectSchemaId` и `projectSchemaVersion` манифеста. Локальный
дискриминатор `interiorSchemaVersion` принадлежит строке локальной ревизии.
Переносимый снимок использует селектор реестра, а этот локальный ключ в
переносимом снимке отклоняется как неизвестный.

Закрытые ключи действующих ветвей, правила V1 UTF-16, own-undefined, raw `-0`,
геометрических чисел и точных ресурсов продолжают действовать по исходным
адресам. Добавляемые ключи и разрешённые сочетания перечислены ниже.
Неизвестный либо повторяющийся ключ, неподдерживаемая версия или комбинация
отклоняются. Неявная отделка кодируется отсутствием свойства. Writer
опускает пустой `sideFinishes`. Каноническая запись сторон содержит хотя бы
одну сторону.

| Адрес | Закрытые данные расширения |
| --- | --- |
| `level.rooms[*].floorFinish` | Пара `{presetId, version}`. Ключи V1 `light-oak`, `matte-floor-tile`, `plain-floor`, версия 1. |
| `level.wallSegments[*].profile` | `partition` или `bearing`. Действительное значение по-прежнему в `thicknessMm`, у старых стен классификация отсутствует. |
| `level.wallSegments[*].sideFinishes` | Ключи `left` и/или `right`, каждый содержит `{presetId, version}`. V1 `warm-white-paint`, `sand-paint`, `muted-green-paint`, `neutral-wall-tile`. Физическая сторона задаётся AD-41. |
| `level.openings[*]`, Door | Отсутствие варианта означает глухую распашную дверь. `variant: "glazed-swing"` использует прежние `swingSide` и `hingeEnd`. `variant: "sliding"` требует `slideSide: "left"\|"right"` и `slideDirection: "toward-start"\|"toward-end"`. В раздвижной ветви поля петель и распахивания отсутствуют. Смена обратно на глухую убирает вариант и поля сдвига. |
| `level.openings[*]`, Window | `sections: 1\|2` задаёт явное число секций. Отсутствие сохраняет legacy автоделение. Поля двери отклоняются. |
| Напольный встроенный экземпляр | `catalogPreset?: {presetId, version}`. Версия 1 означает явный зарегистрированный встроенный пресет TMA. Реестр объединяет 30 существующих ID и `table-lamp`, `book`, `vase`. Наличие `assetDefinitionId` исключает эту пару. Метка продолжает служить отображаемым значением. |
| `assetInstances[*]`, гость на опоре | `anchorClass: "support"`, обязательные поля `assetInstanceId`, `label`, `widthMm`, `depthMm`, `heightMm`, `color`, `catalogPreset`, `supportAssetInstanceId`, `supportSurfaceKey`, `offsetXMm`, `offsetZMm`, `relativeYawMilliDeg`, `context`. Допускаются `colorVariantId` и `locked: true` по прежним правилам. Ключи гостей `planter`, `table-lamp`, `book`, `vase`. Мировые X/Z, абсолютный угол, производимая отметка основания и `assetDefinitionId` в ветви отсутствуют. |
| Проверочный `context` гостя | Обязательный `roomId`. Ключ `layoutId` обязателен для явно записанной расстановки и отсутствует для неявной A. При чтении должны совпадать с разрешённой опорой. Записываются из опоры при сериализации, отдельного редактируемого адреса в домене нет. Это выявляет ссылку на другую комнату/расстановку при подмене только Host ID. |
| Ключ версии площадки | `top` у `table`, `desk`, `coffee-table`, `bedside-table`, `dresser`, `tv-stand`. У `open-shelf` — `shelf-1` … `shelf-5` снизу вверх, включая верхнюю площадку с просветом до потолка. Версия определяется парой на опоре. Новая несовместимая геометрия требует новой версии и согласованной доменной мутации. |

Добавляемые числа принимают канонические целые лексемы. Версии равны 1,
секции 1 или 2, относительный угол находится в диапазоне 0..359999
тысячных градуса, смещения используют знаковые целые миллиметры в пределах
политики координат. Новые поля не принимают дроби, экспоненты и `-0`.
Разрешённые пресеты, ключи площадок и коды вариантов проверяются до
публикации. Разрешённая опора является встроенным напольным экземпляром
поддерживаемой версии. Сверяются все ссылки, полный footprint, свободный
объём, потолок и принадлежность каждой расстановке. Неполный, циклический
или несогласованный граф отклоняется до выделения ID и pin.

Выбор writer идёт по наличию данных в проверенном снимке. Интерьерные поля
требуют интерьерной пары. При их отсутствии применяются, по убыванию,
требования A/B, дальних петель, точного угла и базового Runtime V1 wire.
Writer, feasibility, decoder и read-render smoke используют эту матрицу.
Предшествующий формат допустим при точной представимости всех полей.
Установка нового selector без его определяющих данных не заменяет этот выбор.

Для записываемого импорта интерьерной пары требуется Telegram IDB 6 или 7 и
соответствующая возможность writer. Читатель, знающий пару, при
недопущенной версии IDB возвращает `PORTABLE_BACKUP_FUTURE_SCHEMA` до
создания нового Project, pin, Revision и смены указателя. Для читателя без
зарегистрированной пары действует прежний `BACKUP_SCHEMA_UNREADABLE`
и установленный порядок более ранних ошибок. Импорт идёт через существующий
fenced copy-on-write. Внутренние ID стен, проёмов, опор и гостей сохраняются
в новом Project с новым ID. Ресурсы наследуют точные хеши и байты.
Exact-resource repair применяет тот же single dispatch и проверку ресурсов,
без публикации входного Project. Android handoff получает тот же готовый
архив через действующий защищённый путь.

## Runtime V1 свой цвет стены

Пара (`interiors.project/runtime-v1-wall-colors`, `1`) расширяет интерьерную пару
и требует хотя бы один свой цвет стены. Запись физической стороны стены
может содержать только `{color, version}` с шестью строчными шестнадцатеричными
цифрами после `#` и целой лексемой `2` в поле `version`. Обычные пресеты
сохраняют свою грамматику. Writer выбирает эту пару только для снимков
со своим цветом. Local Project использует маркер `interiorSchemaVersion: 2`
при наличии такого цвета. Переносимый Project использует селектор пары.

Записываемый импорт требует Telegram IndexedDB 7. Читатель проверяет
совпадение селектора манифеста и Project до публикации. Совместимая сборка
читает IndexedDB 7 и сохраняет оба набора расстановок, значения цвета и
точные ресурсы. [Допуск реализации](../../planning-artifacts/implementation-readiness-tma-wall-colors-2026-11-26.md)

Векторы расширения проверяют несовпадения manifest/root, поля чужой ветви,
незарегистрированную версию пресета, cross-room и cross-layout witness,
гостя вместо опоры, duplicate ID, цикл, unknown surface, границы угол/мм
и неизменность прежнего Project при отказе или квоте. Матрица подтверждает
двоичный GLB и связи скрытого набора, выбор прежнего селектора и точный
перенос из новой ревизии обратно в совместимую сборку. Регистрация фиксирует
контракт и предполагает отдельную проверку реализации.
