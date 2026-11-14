---
title: "InteriorsEditor — G-CP AD-24 source/rubric remediation re-review R2"
review_type: architecture-source-rubric-r2
status: complete
reviewed: 2026-08-26
reviewer: "Codex /root/story56_product"
prior_review: review-g-cp-ad24-source-rubric-2026-08-26.md
verdict: CHANGES_REQUIRED
gate_disposition: G_CP_ADR_NOT_CLOSED
readiness: NOT_READY
targets:
  - ../ARCHITECTURE-SPINE.md
  - ../catalog-control-plane-alpha-decision-2026-08-26.md
  - ../../../../../contracts/catalog-control-plane/catalog-envelope-v1.schema.json
reviewed_snapshot:
  spine_sha256: 2c695aae325c3c90d12ba4629fc434a22ce71b87867434665d1dcab03153bcc6
  decision_sha256: 8b8fd9e7f5dfe06b857714bc7695e5411db72997e9b51c02cccb6b9f552bd0cd
  envelope_schema_sha256: 02df29d2bb85cfcadd1213ff6e9674ce7b7c8b9c9b7cfa8ff1eb67c8b6daf070
  epics_sha256: 5efd873680631c865a151e901af013fe86b8bbd4f16c613c0a71c5b29e103750
  prd_sha256: 5aac12c0cb8bfd7acd0a2baf395287d3ad5befa91a2fb34709cbfea3483c1746
  spec_sha256: 976ebec2f45d7febe79eaa8583bc593d6d4857f78f1cfad0bda4b205fc0a68db
  catalog_contract_sha256: 95d7ed1a23c9df7e20fd62bcfbda1fd2fdd086a2c0693017a42d739bceca7a97
scope: "Read-only re-review of SR-01..05 and remediated AD-24/schema/Spine against current 2026-08-25 Story 5.6 sources"
source_mutations: none
---

# G-CP AD-24 — source/rubric remediation re-review R2

## Вердикт

**`CHANGES_REQUIRED`; `G-CP-ADR` пока не закрыт.** Remediation существенно
улучшила decision: exact port algebra, shared versioned JSON Schema, mandatory
front/footprint/variant metadata, publisher credentials, stronger Project-state
evidence и reproducible toolchain rules теперь существуют. `SR-03`, `SR-04` и
`SR-05` закрыты; `SR-01` и `SR-02` закрыты лишь частично.

Остались два high source/architecture blocker:

1. normative envelope с произвольными variant/slot/resource relations нельзя
   представить в заявленном PostgreSQL allowlist без запрещённого JSON либо
   неназванных relation tables; одновременно triggers требуются и запрещаются;
2. JSON Schema не фиксирует resource roles и допускает PNG как основной model,
   GLB как thumbnail и неоднозначные variant resources; item color/variant
   semantics CAP-7 также сведены только к обязательному resource replacement.

Критических находок нет: no-Project-data perimeter, outage/recovery distinction,
scope correction 2026-08-25 и отсутствие ложного `READY`/physical-device claim
сохранены. Но `gate_disposition: internal-implementation-ready` остаётся
преждевременным, пока contract/schema/database model не станут взаимно
реализуемыми.

## Механические проверки

```text
jq empty contracts/catalog-control-plane/catalog-envelope-v1.schema.json
ok

lint_spine.py --workspace architecture-InteriorsEditor-2026-07-26
ok: true; total_findings: 0
```

Schema синтаксически является JSON, а Spine проходит structural lint. Эти
проверки не доказывают semantic consistency между wire schema и PostgreSQL.

## Повторная проверка `SR-01…05`

| Prior finding | R2 | Проверка remediation |
| --- | --- | --- |
| `SR-01` — нет нормативного wire schema и exact port algebra | **PARTIAL** | Decision `:63-169` теперь определяет shared schema/corpus, exact operations, result unions, cancel race, HTTP status/header/range mapping и bounded decoding. Но schema допускает несовместимые media roles, а storage model не способен однозначно materialize её variant relations; см. R2-01/02. |
| `SR-02` — envelope не покрывает CAP-6/CAP-7 metadata | **PARTIAL** | Section/category registry, `positive-z`, dimensions, rectangle footprint и `variantSlots` добавлены (`decision:87-94`, schema `:93-162`). Однако variant model не задаёт role/target изменяемого resource и требует resource даже для варианта, которому CAP-7 разрешает не иметь отдельного ресурса; см. R2-02. |
| `SR-03` — publisher authentication deferred | **CLOSED** | Local one-shot publisher, отдельные username/password environment inputs, distinct runtime credentials и negative authority tests выбраны в `decision:222-228`; AD-17 теперь прямо называет seed-publisher auth (`Spine:578-583`). Public IAM/operator API остаются корректно deferred. |
| `SR-04` — E2E проверяет только Revision count | **CLOSED** | `decision:284-290` требует semantic digest, current Revision id, Revision count, writer access, отсутствие pending publication/recovery/read-only, плюс fully pinned open/edit/publish/undo/redo/backup during outage. |
| `SR-05` — toolchain closure | **CLOSED FOR INTERNAL ALPHA** | Wrapper URL/SHA, dependency locks/checksums, JVM toolchain/target, recorded JDK build, PIT Gradle plugin/engine/JUnit adapter и renewal rule добавлены (`decision:37-61`). Independent technology R2 дал `PASS_INTERNAL_ALPHA_TECH_GATE`; фактические Gradle/PIT/Postgres runs остаются executable evidence, не architecture claim. |

## High findings

### GCP-AD24-SR-R2-01 — Envelope data model не помещается в закрытый PostgreSQL allowlist

**Severity:** High — blocks `G-CP-ADR` closure.

**Evidence.** Normative schema разрешает до 256 assets, у каждого до 16
`variantSlots`, у slot до 32 variants, а у variant до 8 resource descriptors
(`catalog-envelope-v1.schema.json:16-20,63-91,93-162`). Decision при этом
разрешает только четыре catalog tables — `catalog_publication`, `catalog_asset`,
`catalog_resource`, `catalog_current` — плюс Flyway history, запрещает
`json`/`jsonb`/free-form payload и любой иной table/view/function/sequence
(`decision:185-204`).

В таком allowlist отсутствуют relations для:

- asset → base/thumbnail resource;
- asset → variant slot;
- slot → variant;
- variant → changed resource.

Хранить bounded arrays в `catalog_asset` как JSON запрещено; flattening
variable slot/variant/resource cardinality в одну asset row не является
заявленной normalized model и оставляет producer/runtime units свободными
выбрать несовместимые layouts.

Есть и прямое противоречие: allowlist запрещает любую function (`:192-194`),
но prior rows объявлены immutable «by grants and triggers» (`:217`). В
PostgreSQL обычный trigger требует trigger function. Следовательно, выбранный
DDL contract невозможно реализовать буквально.

**Required fix.** Зафиксировать минимальный normalized relational shape и
расширить exact audit allowlist как минимум association/variant relations с
PK/FK/unique/cardinality constraints; либо осознанно изменить storage strategy,
не ослабляя запрет free-form/Project-bearing payload. Затем выбрать один
реализуемый immutability mechanism: grants/constraints либо явно разрешённые
named trigger functions/triggers. Shared publication/reconstruction tests должны
доказать lossless schema → rows → byte-identical canonical envelope round-trip,
shared hashes и all variant cardinalities.

### GCP-AD24-SR-R2-02 — Normative schema допускает неверные resource roles и не задаёт применимый CAP-7 variant

**Severity:** High — blocks shared web/Kotlin contract.

**Evidence.** `$defs.resource` допускает оба media types
`model/gltf-binary` и `image/png` (`schema:47-61`). Тот же generic definition
используется без refinement для:

- обязательного asset `resource` (`:155`), поэтому schema принимает PNG вместо
  единственного GLB;
- optional `thumbnail` (`:156`), поэтому schema принимает GLB thumbnail;
- variant `resources` (`:63-75`), где до восьми одинаковых или разнотипных
  descriptors не имеют `role`, target или replacement semantics.

Это противоречит decision `:87-90` («one exact GLB», optional exact PNG,
variant declares resources it changes) и rule `:151-153` о reject wrong media
types. Kotlin и TypeScript, полагающиеся на названную normative schema, могут
принять envelope, который другой semantic validator отклоняет, либо по-разному
выбрать один из нескольких GLB/PNG variant resources.

Кроме того, каждый variant обязан иметь `minItems: 1` resources (`schema:66-75`).
SPEC CAP-7 требует отдельный exact resource **когда** вариант его требует
(`SPEC.md:244-252`), а PRD/UX сохраняют color/variant option, которое может быть
metadata-only. В schema нет discriminant или renderer-neutral value для такого
варианта; отсутствует и точная связь option с изменяемым recolorable slot.

**Required fix.** Разделить `$defs` на role-specific descriptors: exact GLB
model, exact PNG thumbnail и discriminated variant effect. Variant option должен
однозначно называть slot/target и быть либо metadata/value variant без нового
resource, либо typed replacement с закрытым role/cardinality. Duplicate/ordering
rules и positive/negative fixtures должны одинаково применяться schema-aware
Kotlin validator, TypeScript decoder, fake gateway и real smoke.

## Medium findings

### GCP-AD24-SR-R2-03 — Canonical lexical rules не полностью выражены общей schema

**Severity:** Medium — fix with the schema reconciliation.

Decision требует label в NFC и не более 240 UTF-8 bytes (`:75`), тогда как
schema проверяет только JSON Schema `minLength/maxLength` (`schema:37-41`).
`publishedAt` должен соответствовать общей Spine convention ISO 8601 UTC
(`Spine:806`), но `format: date-time` принимает и non-UTC offsets
(`schema:11-15`). Эти формы могут быть семантически эквивалентны, но давать
разные exact canonical bytes/ETags.

**Required fix.** Либо выразить UTC lexical grammar/schema constraints прямо,
а NFC/UTF-8 byte limit — обязательным named pre-schema validator contract, либо
сослаться на один shared semantic-validation profile. Fixtures должны включать
non-NFC labels, multi-byte over-limit labels и equivalent non-`Z` timestamps.

### GCP-AD24-SR-R2-04 — Valid current publication всё ещё может быть пустым

**Severity:** Medium — acceptance/corpus clarification.

`assets` имеет `maxItems: 256`, но не `minItems` (`schema:16-20`). Поэтому
«exactly one complete current publication» из `decision:218-220` может быть
пустым, хотя Story 5.6 E2E открывает approved asset, FR-26 требует representative
catalog sections, а required evidence ожидает front/variant/resource metadata.

**Required fix.** Для Alpha contract задать `minItems: 1` либо отдельное
явное состояние empty publication с UX/outcome semantics. Empty envelope не
должен молча считаться тем же successful catalog, что approved publication.

## Подтверждённые свойства R2

- Current 2026-08-25 legal scope соблюдён: licensing/provenance/grants/notices не
  вернулись в schema, DB или evidence.
- Exact category/front/footprint/dimensions fields закрывают прежний CAP-6 gap.
- Resource URL больше не приходит из JSON: adapter выводит fixed same-origin
  hash route и запрещает redirects/credentials.
- Port outcomes, cancel linearization, integrity order и recovery handoff теперь
  достаточно точны для adapter tests после исправления schema.
- Publisher/runtime/migration privileges разделены; browser не получает
  credentials или publication authority.
- E2E fake, real proxy smoke и Kotlin/PostgreSQL evidence разведены, но обязаны
  использовать один shared corpus.
- Outage никогда не выбирает Project recovery; existing recovery не очищается
  до complete atomic local repair.
- Internal loopback operations, public deferrals и `G-READY = NOT_READY`
  сформулированы без release overclaim.

## Gate disposition

До исправления `GCP-AD24-SR-R2-01` и `R2-02`:

- source/rubric gate остаётся `CHANGES_REQUIRED`;
- нельзя считать PostgreSQL migration/schema и web/Kotlin contract независимо
  реализуемыми по одному decision;
- закрытые `SR-03…05` повторно открывать не требуется;
- исправление не требует возврата legal/licensing scope, account service,
  public cloud/IAM/CDN или remote Project data.

После remediation нужен targeted R3: schema syntax + shared semantic fixtures,
lossless normalized DB round-trip, media/variant role corpus и architecture
lint against exact new hashes. Даже R3 PASS не заменит фактические executable
tests, `G-S6-catalog`, остальные V-09 dependencies, physical `NFR-15` или общий
`G-READY` verdict.
