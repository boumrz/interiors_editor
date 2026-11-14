---
title: "InteriorsEditor — G-CP AD-24 source/rubric review"
review_type: architecture-source-rubric
status: complete
reviewed: 2026-08-26
reviewer: "Codex /root/story56_product"
verdict: CHANGES_REQUIRED
gate_disposition: G_CP_ADR_NOT_CLOSED
readiness: NOT_READY
targets:
  - ../ARCHITECTURE-SPINE.md
  - ../catalog-control-plane-alpha-decision-2026-08-26.md
reviewed_snapshot:
  spine_sha256: 3333f6633ed231019d8f572cad7b48e90ed4061fb851515b35acdb275cf0d712
  decision_sha256: 9728da07a01986c5515cbd3645c56320117e9f23cb81bab93c5951e1f4a79919
  epics_sha256: 5efd873680631c865a151e901af013fe86b8bbd4f16c613c0a71c5b29e103750
  prd_sha256: 5aac12c0cb8bfd7acd0a2baf395287d3ad5befa91a2fb34709cbfea3483c1746
  spec_sha256: 976ebec2f45d7febe79eaa8583bc593d6d4857f78f1cfad0bda4b205fc0a68db
  catalog_contract_sha256: 95d7ed1a23c9df7e20fd62bcfbda1fd2fdd086a2c0693017a42d739bceca7a97
  ux_experience_sha256: 7e04351bedea00325057b07e11fa70b7f644ccf29351c9a229024d1acb63533a
  ux_design_sha256: 8314dba1ac991074a12b9d8226bb1173ed22a6c2ed61195db0152916fa32272a
scope: "Read-only review of AD-24 and its bounded decision against current 2026-08-25 product sources; no source, memlog, code, test or configuration mutation"
source_mutations: none
---

# G-CP AD-24 — source/rubric review

## Вердикт

**`CHANGES_REQUIRED`; `G-CP-ADR` ещё не закрыт.** AD-24 хорошо сохраняет
local-first/no-Project-data perimeter, outage/recovery distinction и
scope-correction от 2026-08-25. Однако три high finding оставляют именно те
точки расхождения, которые bounded ADR должен был закрыть до `V-09-CP`:
нормативный wire/port contract, полный обязательный metadata envelope и
publisher authentication boundary.

Критических находок нет: текущий текст не открывает remote Project/account
path, не возвращает отменённые licensing/provenance/notices и не выдаёт
Playwright за physical `NFR-15`. Но статус
`gate_disposition: internal-implementation-ready` и формулировка Spine о
закрытом bounded design преждевременны до устранения high findings ниже.
`G-READY` остаётся `NOT_READY`; даже исправленный `G-CP-ADR` сам по себе не
разблокирует Story 5.6 без остальных её gates.

## Область и порядок источников

Проверены:

1. current scope correction в `epics.md:37-47`;
2. Story 5.6 и её точные AC в `epics.md:2005-2054`, gate definition в
   `epics.md:642-664` и evidence split в `epics.md:440-453`;
3. PRD `FR-54` в `prd.md:754-781` и `NFR-10`, `NFR-13`, `NFR-21`, `NFR-24`,
   `NFR-26` в `prd.md:804-886`;
4. SPEC `CAP-6`, `CAP-7` и Constraint 6 в `SPEC.md:194-252,366-369`, а также
   `catalog-control-plane-contract.md:14-50`;
5. UX catalog card/variant/outage contracts в `DESIGN.md:185-200` и
   `EXPERIENCE.md:269-299,371-385`;
6. AD-2, AD-4, AD-8, AD-12, AD-14, AD-16, AD-17 и AD-24 в
   `ARCHITECTURE-SPINE.md`, плюс bounded decision;
7. superseded input `plans/catalog-control-plane-decision-input-2026-08-09.md`
   только как historical trace. Его legal sections не имеют текущей authority;
   актуальная техническая auth obligation всё равно прямо сохранена в current
   `epics.md:652`.

Детерминированный architecture lint выполнен первым:

```text
lint_spine.py --workspace architecture-InteriorsEditor-2026-07-26
ok: true; total_findings: 0
```

Это подтверждает механическую форму Spine, но не закрывает semantic/source
findings.

## Результат good-spine rubric

| Проверка | Результат | Основание |
| --- | --- | --- |
| Реальные divergence points закрыты | **FAIL** | HTTP routes выбраны, но exact JSON/wire grammar и application-owned port algebra не зафиксированы; web и Kotlin units могут выбрать несовместимые формы. |
| Rule исполним и предотвращает заявленное divergence | **FAIL** | AD-24 обещает предотвращать incompatible catalog versions, но prose-only envelope с unknown-field rejection не определяет exact allowed fields/types/bounds. |
| Story 5.6 / FR-54 покрыты | **PARTIAL** | No-Project-data, outage и recovery semantics покрыты; metadata contract и publisher-auth gate неполны. |
| SPEC / UX coverage | **FAIL** | Closed asset envelope не содержит обязательные local front direction и available variant declarations, хотя AD-24 bind-ит CAP-6/CAP-7. |
| Parent ADs не ослаблены | **PASS** | AD-2/4/14/17 local-first, exact pin и `CatalogGatewayPort` boundary сохранены. |
| Deferred hygiene | **PARTIAL** | Public provider/IAM/SLA/retention корректно deferred; publisher authentication ошибочно deferred при существующем seed publisher и current gate obligation. |
| Operational envelope | **PASS для internal Alpha** | Локальный PostgreSQL/service, single tunnel, rebuild-from-seed recovery и отсутствие public SLA/RPO/RTO заявлены честно; public operations явно deferred. |
| Scope correction 2026-08-25 | **PASS** | Licensing/provenance/grants/notices отсутствуют в contract, schema и evidence; технические format/size/hash, pin/backup boundaries сохранены. |
| Tool versions / external reality | **PASS WITH FOLLOW-UP** | Названные Kotlin 2.4.10, Ktor 3.5.2, PostgreSQL 18.4, pgJDBC 42.7.13, HikariCP 7.0.2, Flyway 13.3.0, Testcontainers 2.0.5 и PIT 1.25.8 существуют. Gradle 9.5.0 существует, но на дату review уже не current patch/release; выбор допустим только как осознанный pin с wrapper checksum и renewal policy. |
| False readiness/device claims | **PASS** | Decision и Spine сохраняют `G-READY = NOT_READY`, не заявляют public release и не считают browser E2E physical `NFR-15`. |

## High findings

### GCP-AD24-SR-01 — Нет нормативного versioned wire schema и exact `CatalogGatewayPort` algebra

**Severity:** High — blocks `G-CP-ADR` closure.

**Evidence.** Decision выбирает routes (`:55-58`), перечисляет смысл полей
envelope (`:66-77`) и утверждает, что unknown fields делают весь envelope
invalid. Но он не фиксирует exact JSON field names/nesting, type grammar,
catalog/schema version grammar, enum registries, ordering/canonicalization,
concrete bounds, thumbnail/resource descriptor shape либо однозначную mapping
HTTP status → port outcome. Даже malformed input может вернуть один из двух
невыбранных результатов `400` или `404` (`:63-64`). Раздел
`CatalogGatewayPort` фактически задаёт только пять outcome labels (`:133-146`),
но не операции, request/response values и discriminated payloads.

**Почему это блокирует.** Story 5.6 требует, чтобы web получал данные только
через один port, NFR-24 требует stable versioned contracts, а AD-24 заявляет
предотвращение incompatible catalog versions. Два units — Kotlin producer и
web adapter — могут выполнить текущую prose-формулировку, но выбрать разные
field names, bounds, enums и error mapping. `unknown fields = reject` делает
этот пробел ещё опаснее: каждая сторона может корректно отклонить output другой.
`CATALOG-E2E-02` с fake и real Kotlin smoke не доказывает «тот же контракт»,
если у них нет общего нормативного schema/corpus.

**Required fix.** Принять и сослаться из decision на один language-neutral
versioned contract: exact OpenAPI/JSON Schema либо эквивалентную закрытую
грамматику, plus shared golden/negative fixtures. Он должен фиксировать exact
route/status/header/body contract, canonical envelope and resource descriptor,
bounds/enums/order/versioning, and the application-owned port operations with
typed success/outage/cancel/integrity payloads. Kotlin contract tests, web
decoder tests, fake gateway и real smoke должны потреблять один corpus.

### GCP-AD24-SR-02 — Closed envelope не покрывает обязательную CAP-6/CAP-7/UX metadata

**Severity:** High — blocks source reconciliation.

**Evidence.** Decision утверждает, что каждый asset объявляет **только** поля из
`:69-73`: id, label, section/category, anchor class, dimensions, optional
thumbnail и один GLB descriptor. При этом:

- SPEC CAP-6 требует до добавления показывать `local front direction`
  (`SPEC.md:201-203`);
- AD-8 требует immutable AssetDefinition с footprint, anchors и variants
  (`ARCHITECTURE-SPINE.md:336-353`);
- SPEC CAP-7 требует явно объявленные variant options и отдельные exact resources
  (`SPEC.md:237-252`);
- UX ObjectCard требует preview, canonical name, category, real dimensions,
  available variants и technical readiness (`DESIGN.md:185-190`);
- AD-24 напрямую bind-ит CAP-6 и CAP-7 (`ARCHITECTURE-SPINE.md:774-777`).

Также `category` не ограничена обязательным FR-26 registry, а `thumbnail
descriptor where present` не определён по форме. Текущий closed allowlist не
может законно передать front direction, footprint/variant declarations и их
resource links: добавление этих полей будет `invalid-envelope`.

**Required fix.** Согласовать минимальный Alpha `CatalogAssetDefinition`
allowlist с CAP-6/CAP-7/AD-8/UX: canonical category enum/registry, local front
direction, footprint/anchor metadata, explicit variant/slot options and every
required hash-addressed resource descriptor. Retired floor/wall finish или
legal fields добавлять нельзя. После этого обновить shared positive/negative
corpus и UI-visible metadata assertions.

### GCP-AD24-SR-03 — Publisher authentication boundary не выбран, хотя publication существует

**Severity:** High — blocks the exact current `G-CP-ADR` gate.

**Evidence.** Current gate требует, чтобы bounded ADR фиксировал
`publisher/operator authentication` (`epics.md:652`), а Story 5.6 говорит, что
account model должен быть заранее ограниченно решён (`epics.md:2013-2016`).
Decision удаляет runtime publication HTTP endpoint, но всё равно создаёт
отдельный seed publisher с migration/publication DB role (`:90-107`). Он не
выбирает, как эта команда аутентифицируется к PostgreSQL, откуда получает
credential, как runtime service технически не может его получить и как
отличается authorisation migration от publication. Затем `operator
authentication` объявляется отсутствующим/release-deferred (`:166-172`).

**Почему это блокирует.** Отсутствие HTTP admin endpoint — хороший reduction,
но не отсутствие publisher identity/authentication surface. Разные
implementations могут использовать peer/trust/password/shared runtime secret и
получить несовместимые либо небезопасные boundaries; SELECT-only runtime claim
остаётся не полностью доказуемым.

**Required fix.** Явно принять minimal internal-Alpha auth decision: no end-user
or runtime operator account; seed publisher uses one named, non-browser,
non-runtime credential mechanism and separate least-privilege DB role; define
credential injection/lifetime and a negative test that runtime/browser cannot
obtain publication/migration authority. Public IAM/operator API остаются
release-deferred и не должны расширять AD-17.

## Medium findings

### GCP-AD24-SR-04 — `CATALOG-E2E-02` проверяет count, а AC требует unchanged Project state

**Severity:** Medium — fix evidence wording before implementation.

Decision требует в E2E неизменный `Durable Revision count` (`:161-164`). Story
5.6 требует неизменный local Project state (`epics.md:2040-2047`), а outage/cancel
может ошибочно изменить current pointer, writer state, selected Project content
или staged Project-bearing state без изменения count. Failure rule `:143-146`
правильный, но evidence слабее правила.

**Required fix.** Assert stable Project semantic digest/current Revision id,
Durable Revision count, writer access/fence, no Project-bearing pending
publication, and no recovery/read-only state before/after retry and cancel.
Browser fake remains separate from Kotlin/PostgreSQL perimeter evidence.

### GCP-AD24-SR-05 — Reproducible toolchain pin нуждается в artifact-level closure

**Severity:** Medium — does not change product scope, but weakens the stated
reproducible build/test boundary.

Gradle Wrapper 9.5.0 is a real release, but by 2026-08-26 official Gradle
releases already include 9.5.1 and 9.7.1. PIT 1.25.8 is real but 1.25.9 already
exists. More importantly, `JDK 17` plus permission for compatible newer local
JDKs (`:37-44`) does not identify vendor/patch/toolchain provisioning, while
the decision claims reproducible Kotlin tests.

**Required fix.** Record why non-latest pins are retained, pin/verify the
Gradle distribution checksum and exact dependency graph, select a reproducible
JDK toolchain policy for CI, and define renewal/security review. This is not a
request to use `latest`.

External reality checked against official project/repository sources on
2026-08-26: Gradle releases, Kotlin releases, Ktor changelog, PostgreSQL 18.4
release notes, Maven Central/official release pages for the remaining JVM
artifacts.

## Подтверждённые сильные стороны

- `FR-54` perimeter соблюдён: routes имеют no-body/no-cookie/no-account shape;
  schema/table/log/cache negative surface запрещает Project, Revision, History,
  Portable Backup и user-pinned data.
- Scope correction 2026-08-25 применён последовательно: legal/licensing,
  provenance, grant, attribution и notice отсутствуют в contract/schema/gates.
- Exact bytes/hash, local verification/pinning и `BackupFeasibilityPolicy`
  остаются application-owned; remote cache не становится user pin.
- Outage и corruption разведены правильно: remote unavailable не выбирает
  `ResourceRecoveryRequired`, а missing/corrupt already-referenced exact byte
  остаётся Story 8.6 recovery trigger.
- PostgreSQL perimeter минимален: normalized catalog-only tables, atomic
  immutable publication, runtime `SELECT` only, rebuild from versioned seed.
- Fake `CatalogGatewayPort` UI evidence отделено от Kotlin/PostgreSQL
  contract/schema/integration evidence; browser run не объявлен physical
  `NFR-15`.
- Public provider/CDN/IAM/SLA/retention/incident-response decisions явно
  отсутствуют и deferred, не превращаясь в скрытые Story 5.6 obligations.

## Gate disposition

До исправления `GCP-AD24-SR-01`–`03`:

- AD-24 не следует считать закрывающим `G-CP-ADR` даже для internal Alpha;
- нельзя начинать два независимо реализуемых web/Kotlin units по этому contract;
- decision остаётся полезным bounded candidate и сохраняет правильный perimeter;
- никакой возврат legal/licensing scope или speculative public cloud design для
  исправления не нужен.

После source fixes нужен повторный независимый gate против exact updated hashes:
mechanical lint, source/rubric reconciliation, backend data-boundary/auth lens и
проверка shared wire/port corpus. Даже PASS этого re-review не заменит
`G-READY`, `G-S6-catalog`, V-09 prerequisites, physical `NFR-15` или фактические
executable tests.
