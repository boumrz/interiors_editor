---
title: "D-022 R6 — advisory preflight: CB3 registry closure and outcome ownership"
date: 2026-08-05
kind: advisory-preflight
authority: advisory-only
scope: "CB3 type/reference/digest grammar and outcome/reason ownership only"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r6-2026-08-05.md
reviewed_sha256: 276a7c7224c5b33a2554fbc7b34811a85178e6d9b7a6ae6e65230e61fc3bb6fa
sources_consulted:
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../ARCHITECTURE-SPINE.md
  - ../../../../project-context.md
---

# D-022 R6 — advisory preflight registry/outcome closure

Проверен ровно указанный SHA-256 R6. Это узкий статический advisory по CB3 и
таблице outcomes; он не является решением о принятии, отклонении или readiness.
Все literal-идентификаторы `D022_R6_*`, найденные в тексте этого SHA, уже
присутствуют в §1; ниже не повторяются устранённые omissions из прежних
ревизий.

## Явно отделённые source deltas

R6 явно маркирует как неканонические и направляет к владельцам: miter-only
вместо текущего deterministic bevel (`§5.4`, `§8`), reject-only cross-root
rehost вместо текущего orphan/rehost preview (`§6.3`, `§8`), а также
разграничение selection, preflight resource issue и current/history-only
recovery (`§1`, `§7.5`). Они требуют последующего source-owner решения, но не
учтены ниже как неописанные registry defects.

## Точные устранимые gaps

### R6-REG-01 — CB3 Value пока не задаёт самоделимитирующийся wire format

В `§3.1` перечислены теги и сказано, что lengths/IDs используют ULEB128, но не
задан байтовый layout каждого Value. В частности, для `UInt`/`SInt` не указан
length prefix magnitude, а для `Bytes`, `Text`, `Array`, `Record`, `Union`,
`Enum` и `Set` не заданы точная последовательность tag/count-or-length/child
values. Из одних правил в строках 249–266 невозможно единственным образом
распарсить границу вложенного значения. Кроме того, `§3.3` говорит лишь, что
union variants «appear in variant-ID order» (строки 360–364), но не фиксирует
число `variantId` и соответствующий record type для шести unions.

Действие: добавить нормативную EBNF либо побайтовую таблицу `EncodeValue` для
всех тегов, включая расположение каждого ULEB128, length/count, пустые
значения, максимальное допустимое представление и ошибку переполнения. Для
каждого union явно закрепить `variantId` (например, 1..N в показанном порядке)
и его единственный record `typeId`; не оставлять это выводимым из prose.

### R6-REG-02 — semantic/content refs и source schemas ещё не имеют закрытого реестра

`TypedContentRefV2` разрешает Text `schemaId` как «registered CB3 type or named
source canonical record grammar» (`§3.2`, строки 288–292), а
`SourceCanonicalRecordRefV2` добавляет serializer ID и source schema ID (строка
434). В R6 нет таблицы допустимых комбинаций `role × schemaId × serializer ×
source-schema-version × decoder`, поэтому эти Text-поля остаются семантическим
escape hatch. Аналогично поля, названные `… ref`, не имеют отдельного закрытого
wire-типа: `RootKind` перечислен в enum registry (строка 463), но не
используется как record/field grammar и не покрывает все живые roots. Это
оставляет неустановленными тип, digest equation и representation множества
references в registry.

Это особенно видно у `ResourceAdmissionV3`: его grant/notice/backup refs
заявлены в строках 422 и 1365–1376, однако существующие `SourceRecordRole`
охватывают только шесть ролей и не закрепляют source grammar для grant, notice,
parser/security verdict и `BackupFeasibilityPolicy` evidence. Также строка 330
неточно говорит, что material-table *row* byte-identical `TypedContentRefV2`
payload: row содержит role/schema/digest сверх самих payload bytes.

Действие: добавить два конечных реестра:

- `SchemaSerializerRegistryV1`: одна строка на допустимый `TypedContentRefV2`
  payload с role, schemaId, serializer ID, source schema/version, exact decoder
  и type/digest rule; добавить resource/grant/notice/policy-evidence roles либо
  отдельные зарегистрированные CB3 records.
- `RootRefV1` (либо эквивалентную точную аннотацию каждого поля): root kind,
  expected type/schema и digest/inline representation. Согласовать `RootKind`
  с полным набором roots и назвать одинаково `FaceKeyV4.faceDigest` и
  `PlanPoint.faceKeyDigest`.

Одновременно исправить правило material table на: `row.payloadBytes` равны
payload bytes `TypedContentRefV2`, а `(role, schemaId, payloadDigest,
payloadBytes)` совпадает с единственной строкой.

### R6-REG-03 — named session values заявлены, но не имеют полной детерминированной grammar

R6 называет `CameraDeltaV3`, `FaceRunV2`, `OverlapWitnessV1` и metric
target/format result закрытыми detached session-calculation values (`§3.3`,
строки 441–446). Однако `FaceRunV2` определён только как cyclic run с массивом
occurrences (`§5.4`, строки 827–838), `OverlapWitnessV1` — только как point и
два parameters (`§5.6`, строки 972–975), а `PlanPoint`/`MetricBoundary` говорят,
что tags входят в target bytes, не закрепляя tag numbers, field order и exact
encoding (`§5.6`, строки 925–945). Format result также не имеет named record и
field grammar.

Действие: для каждого из этих versioned session values добавить closed
non-persistent codec/struct table с discriminator IDs, полями, порядком,
числовой нормализацией и сравнением bytes; либо убрать versioned type/«target
bytes» claim и запретить использование значений как межслойных bytes. Первый
вариант нужен, если selection/metric outputs сравниваются, логируются или
передаются между UI/application boundary.

### R6-OUT-01 — §1 задаёт draft effects, но не даёт по-исходному stable-code/owner crosswalk

§1 корректно помечает все D022 names как proposed и описывает их draft effect,
а строка 1439 `§8` направляет «every R6 diagnostic/state» сразу к нескольким
источникам. Это routing list, не решение для отдельного outcome: нет строки,
которая сопоставляет каждый emitted symbol с текущим stable `ReasonCode`/state
(либо с явно требуемым новым code), одним владельцем решения, source artifact,
payload/witness и пользовательским/import/export effect. Например,
`D022_R6_RESOURCE_ADMISSION_INVALID` агрегирует pin, limits, backup,
grant/notice и parser conditions, хотя current Project contract имеет отдельные
stable reasons, включая `PROJECT_HISTORY_RESOURCE_LIMIT`.

Есть также два неверных locator: `§0.1` (строка 100) и
`proposed_architecture_route` (строка 52) ссылаются на reconciliation в §9,
тогда как source-delta register находится в §8; §9 — frozen R5 disposition.

Действие: добавить в §8 или отдельный companion один row на каждый §1 outcome
(включая оба existing `ResourceRecoveryRequired` states) с колонками:
`R6 symbol`, `current stable symbol or “new-code decision required”`, `single
decision owner`, `source clause`, `phase`, `state/durability/history effect`,
`structured witness`, `localized UX key`, `import/export behaviour`. Разбить
resource-admission row на source-stable outcomes и внешние catalog states там,
где это предусмотрено current source. Исправить оба locator на §8 либо
перенести реестр в §9.

### R6-OUT-02 — два current-source выходa после/вокруг candidate отсутствуют из §1

Собственный pipeline R6 проходит `PendingDurability → staging/checksum/pointer
publication → Durable Revision + HistoryEntry` (строки 530–535), но §1 не
содержит outcome для post-validation persistence failure. Current Geometry
Contract (`geometry-contract.md:165`) и AD-3 (`ARCHITECTURE-SPINE.md:108`)
фиксируют иной effect: previous Durable Revision/History остаются current,
candidate/journal доступен только для retry/recovery export, а следующий
mutating commit fenced.

Также `§7.3` R6 говорит, что новая команда может быть остановлена
`SessionRetentionPolicy` (строки 1348–1353), но §1 не отражает stable
`PROJECT_HISTORY_RESOURCE_LIMIT`, его retry guidance и effect на redo branch.
Current Project/Backup contract требует именно этот stable reason и сохраняет
redo roots при reject/cancel/persistence failure
(`project-and-backup-contract.md:44–72`).

Действие: добавить в §1 отдельные current-source rows для persistence failure и
`PROJECT_HISTORY_RESOURCE_LIMIT` до durable publication. Зафиксировать для
каждого: является ли candidate/journal retained, состояние current Durable
Revision и History/redo, доступность retry/recovery export, fence следующей
mutating command, а также import/export/UI surface. Эти rows должны ссылаться
на stable owners/codes, а не получать новый D022 code.

## Повторяемая проверка после правок

Перед следующей независимой проверкой сверить: (1) каждый `ref`, digest и
`schemaId` с одним закрытым grammar/registry row; (2) все discriminators с
явными numeric IDs; (3) каждый §1 outcome с одним stable-code/owner/effect
crosswalk row; (4) оба post-candidate failure paths с current-source semantics.
