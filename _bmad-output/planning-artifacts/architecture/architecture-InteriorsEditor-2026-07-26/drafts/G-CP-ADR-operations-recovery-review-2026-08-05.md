---
title: "G-CP-ADR — independent operations and recovery review"
status: independent_review_complete
reviewed_artifact: G-CP-ADR-draft-2026-08-05.md
review_date: 2026-08-05
review_scope: "reproducible backend build, migration/release safety, operations, restore/PITR, object-store immutability and local-first data boundary"
disposition: ACCEPT_AS_PRECANONICAL_INPUT_ONLY
canonical_adoption: BLOCKED
gate: G-CP-ADR
closes_gate: false
implementation_authority: false
---

# Независимая operations/recovery-проверка G-CP-ADR

## Вердикт

**Принять только как предварительный, неканонический вход в ADR. Не принимать
его как каноническое решение и не начинать реализацию.**

Направление `Gradle Wrapper 8.10.2 + JDK 21 + Kotlin 2.4.10 + Ktor 3.5.1 +
PostgreSQL 18.4 + Flyway 13.0.0` является технически правдоподобным входом для
изолированного Catalog Control Plane. Оно не является воспроизводимой build- и
operating-конфигурацией, пока не выбраны и не проверены точные дистрибутивы,
поставщик, регион, data-plane policies, restore boundary и accountable owners.

Черновик корректно сохраняет принципиальную границу AD-2/AD-4/AD-14/AD-17:
remote perimeter публикует только curated catalog/provenance, а user-owned
Project остаётся local-first. Однако сам текст не может доказать, что эта
граница сохранится в backup/restore, object storage, logs, migration failures,
release rollback или косвенных operational каналах.

`G-CP-ADR` остаётся blocked, `G-READY` остаётся `NOT_READY`. Этот review не
разрешает Kotlin-код, Gradle Wrapper, PostgreSQL schema, API, storage, provider
account, secrets, CI, deployment, catalog corpus или commit.

## Проверенные источники

- `ARCHITECTURE-SPINE.md`, особенно AD-2, AD-4, AD-11, AD-12, AD-14, AD-16 и
  AD-17;
- `G-CP-ADR-INTAKE.md` и reviewed noncanonical draft;
- `SPEC.md` и все его companions, прежде всего catalog и
  Project/Portable Backup contracts;
- `prd.md`, addendum, UX contracts и `project-context.md`, включая FR-42,
  FR-44–FR-47, FR-54, NFR-10–NFR-13, NFR-21, NFR-23 и NFR-25;
- первичные технические источники, сверенные 2026-08-05: [Gradle Wrapper and
  checksum verification](https://docs.gradle.org/current/userguide/gradle_wrapper.html),
  [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html),
  [Kotlin 2.4.10 release](https://kotlinlang.org/docs/releases.html),
  [Ktor releases](https://ktor.io/docs/releases.html), [Flyway
  validate](https://documentation.red-gate.com/flyway/reference/commands/validate),
  [PostgreSQL backup and restore](https://www.postgresql.org/docs/18/backup.html),
  [pg_basebackup](https://www.postgresql.org/docs/18/app-pgbasebackup.html) и
  [S3 Object Lock semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html).

Последние ссылки уточняют свойства технологий; они не выбирают AWS, регион или
иной provider для продукта.

## Что годится сохранить в следующем ADR

1. **Две build boundaries.** Kotlin тестируется и собирается Gradle-ом, а не
   JavaScript runner; `pnpm` по-прежнему владеет только web workspace. JDK 21
   совместим с Gradle 8.10.2 как toolchain и runtime direction, а текущие
   Kotlin/Ktor pins выглядят согласованными на дату review.
2. **Local-first outage semantics.** Catalog outage остаётся только
   `control-plane-unavailable` или `unpinned-download-unavailable`; он не
   делает healthy fully-pinned Project read-only и не подменяет local
   exact-byte/recovery path.
3. **Intentional absence of user-data surfaces.** Draft не пытается
   реализовать account, sync, browser backup or Project recovery через
   Kotlin/PostgreSQL.
4. **Forward migration direction.** Versioned migrations, `validate` before
   deploy и запрет production `clean`/`repair` — правильная starting point.
   Но `validate` проверяет applied/resolved migrations and checksums; оно не
   доказывает безопасную схему, restore или compatibility release.
5. **Private catalog-owned bytes.** Разделение immutable catalog source bytes
   и user-owned local pinned bytes является обязательным и правильно сохранено
   в candidate.

## Blocking conditions для канонического ADR

### OPR-1 — Provider, region, residency и ownership ещё не приняты

"Single region", "managed PostgreSQL" и "S3-compatible" описывают форму, но
не операционное решение. До adoption должны быть названы provider, region,
residency/legal basis, network/DNS/TLS boundary, managed-service plans,
subprocessors, incident owner, deletion/retention authority, RPO/RTO и support
escalation. Все copies — database snapshots/WAL, object versions, replicas,
CDN/cache, audit/log exports и restore environment — должны попасть в тот же
data inventory.

Нельзя молча добавить cross-region replication, global CDN, support export or
provider backup, если он меняет residency or retention. Если replica нужна,
она требует отдельного named decision and evidence; "single region" сам по
себе не делает копии локальными или безопасными.

### OPR-2 — Backup/restore может незаметно расширить data boundary

PostgreSQL physical base backup and WAL/PITR are cluster-level mechanisms:
`pg_basebackup` создаёт backup всего database cluster, а не отдельной
database/object. Поэтому catalog control plane не может делить application
PostgreSQL cluster, backup account, restore target or object bucket с current
или future User Project service, user upload, portable backup, generic media
or support export.

Перед adoption нужно выбрать и доказать одно изолированное scope:

- dedicated catalog-only PostgreSQL instance/cluster, database roles and
  backup/restore path;
- dedicated catalog-owned object bucket/container and backup namespace;
- isolated, non-public restore environment with separately scoped credentials;
- catalog-only data inventory checked before backup, after restore and before
  any restored service becomes reachable.

The check must reject Project JSON/geometry, Revision/History/Command,
`.interiors`, user-pin/blob keys, browser storage metadata, screenshots,
generic upload payloads and Project-shaped audit/log fields. A provider
snapshot that happens to be encrypted is not proof of this boundary.

### OPR-3 — PITR and restore drill need a recoverable catalog-only contract

"Daily backup + WAL/PITR + witnessed restore drill" is insufficient without a
runbook and success predicates. An adopted ADR must define:

- accountable operations owner and measurable catalog-only RPO/RTO;
- base backup/WAL retention, integrity verification and key availability;
- a paired restore of PostgreSQL **and** catalog-owned object bytes, so a
  restored published descriptor cannot reference a missing/wrong object;
- restore to an isolated environment, schema/version allowlist, object
  inventory, hash/provenance/grant/notice verification and negative
  Project-data corpus before exposure;
- safe handling of failed or partial restore and the decision that a catalog
  restore is never user Project/Portable Backup recovery;
- evidence recording actual timestamps, tools/builds, actor roles, observed
  RPO/RTO and cleanup/deletion of the drill environment.

PostgreSQL documents that PITR requires a base backup plus an uninterrupted
archive of WAL; a logical dump is not a substitute for continuous archival.
The drill must prove the selected managed service implements the promised
equivalent, rather than cite a provider feature page.

### OPR-4 — "S3-compatible" and hash-shaped keys do not prove immutability

The candidate must not treat a content hash in an object key as WORM behavior.
In S3, versioning, Object Lock, retention modes, delete markers and IAM are
separate controls; Object Lock itself is provider-specific and acts on object
versions. A future ADR must select and test a provider-specific immutable
catalog-object policy, including:

- explicit hash algorithm/encoding, exact byte length and media type in an
  immutable catalog descriptor;
- create-only/conditional write, no overwrite-in-place, and an immutable
  publish record binding hash, provenance snapshot, AssetUsageGrant snapshot
  and required notices;
- separate least-privilege principals for ingestion, service read, backup,
  restore and operations; runtime reads cannot list/write/delete, and public
  clients cannot List/Write/Delete or receive generic pre-signed upload;
- no object metadata, tags, cache keys, error page or redirect that carries a
  prohibited Project-shaped/user value;
- explicit retention, withdrawal and deletion semantics. Withdrawal may change
  catalog publication state but must not mutate a formerly published byte into
  a different byte or turn catalog storage into local user recovery storage.

The evidence must include allow/deny integration tests against the selected
provider. A local emulator or an abstract interface cannot prove real IAM,
versioning, lifecycle or object-lock behavior.

### OPR-5 — Curated byte ingestion is a missing security-critical state machine

The draft rightly rejects browser/multipart/generic upload, but has not selected
the only allowed ingress. Before any implementation, a bounded
publisher-controlled pipeline must state how it obtains curated
catalog-owned bytes and must bind, before publication, all of:

`catalog identity + immutable version + exact bytes/hash/size/media +
provenance + complete human AssetUsageGrant + required notices`.

It must specify validation order, temporary storage/queue/dead-letter policy,
orphan-byte cleanup, idempotency/replay behavior, failure compensation and the
atomic boundary between object write and PostgreSQL publication. Temporary
storage, asynchronous jobs, object metadata and cleanup logs are ingress/egress
seams too; they must reject forbidden values before persistence or provider
diagnostics. An arbitrary URL fetch, generic operator blob, backup import or
user-selected file is not an acceptable shortcut.

### OPR-6 — Migration and release rollback safety are not yet executable

Forward-only Flyway migrations and `flywayValidate` are useful, but validation
alone does not protect data or support deployment rollback. The later ADR must
include:

- exact Wrapper distribution checksum, Wrapper JAR verification, JDK vendor/
  build digest, dependency/plugin checksum verification, repository allowlist,
  artifact/image digest and SBOM/vulnerability response policy;
- an isolated Gradle-only build/test command that runs on a clean runner and
  proves no host JDK, JavaScript runner, dynamic version or unreviewed
  repository is used;
- migration-only DB principal, application runtime principals with no DDL,
  separate restore principal, migration serialization/lock and schema
  allowlist inspection after every migration;
- expand/contract compatibility plan for service versions and database schema,
  including a failed migration and a previous application image; no automatic
  `repair`, `clean`, destructive down migration or prod schema mutation from a
  request path;
- an explicit rollback rule: a previous service image is allowed only if its
  schema contract remains compatible. Otherwise rollback is a catalog-only
  restore/forward-fix operation under the recovery runbook, never a generic
  reverse migration.

This also preserves AD-11's broader immutable-artifact/rollback principle
without applying web PWA rollback mechanisms to local user data.

### OPR-7 — Observability and retention need an enforceable data inventory

The proposed 14-day operational log and 365-day minimal publication audit are
reasonable placeholders, not an adopted privacy policy. Before adoption,
Security/Operations and Product must define field-level allowlists, collection
points, storage locations, access, retention/deletion proof and legal basis for
every reverse proxy, load balancer, WAF/CDN, Ktor logger, database log,
object-store audit, trace/APM, crash reporter, metric, alert, DNS/HTTP egress
and support-export path.

In particular, provider access logs may naturally collect IP address, URL or
headers even when application code does not. The product cannot claim such data
does not exist by assertion. It must either disable/minimise and control the
surface or document the strictly governed unavoidable metadata. Correlation IDs
must be server-generated and bounded; request body, cookies, bearer tokens,
raw OIDC claims, object paths, catalog byte content, file names, Project data
and client-provided tracing headers are prohibited from application-level
diagnostics. Operator audit identity is allowed only as minimised external
authorization evidence, not as a product user/profile or Project linkage.

### OPR-8 — Human/identity/secrets gates are correctly open and must remain so

No technical selection can substitute for the following named approvals:

- provider/region/residency, network, backup/restore, retention/deletion and
  incident ownership — Operations + Security + Product/Legal;
- OIDC issuer/tenant/audience, JWKS discovery/egress, key rotation, operator
  lifecycle/revocation, scope matrix and break-glass — Security + Operations;
- secret manager, encryption/key custody and rotation — Security + Operations;
- curated catalog-byte ingestion/publishing owner — Backend/catalog owner +
  Security + Asset steward;
- actual resource-by-resource provenance, grant and notice corpus — named
  Legal/Asset steward.

These gates must remain explicit even if an automated test suite is green. An
external OIDC operator principal must never be promoted into end-user account
identity, cookie session or a User Project relationship.

## Minimum evidence required before a later adoption review

| Area | Required reproducible proof | Boundary assertion |
| --- | --- | --- |
| Build | Clean Gradle-only build/test from frozen Wrapper, JDK and dependency inputs; checksums and generated SBOM/image digest reviewed | No `pnpm`/host JDK/cross-build shortcut and no secret-bearing build output |
| Migrations | Empty + previous-version DB migration, failed migration and compatibility suite; post-migration schema/privilege allowlist | PostgreSQL has catalog/provenance only; no document/queue/audit escape hatch for Project data |
| Ingress/publication | Positive immutable publication plus negative request, queue, temporary-object and log corpus | Catalog byte becomes publishable only with exact hash/provenance/grant/notices; no generic/user upload |
| Object storage | Provider-backed IAM/policy inspection and allow/deny tests for create/read/overwrite/delete/list/lifecycle/restore | Only catalog-owned immutable bytes exist; no user pin, backup or recovery namespace |
| Restore/PITR | Witnessed paired DB+object restore to isolated target, verified with catalog inventory and negative corpus | Restore is catalog-only and never produces User Project recovery/sync |
| Deploy/rollback | Immutable service artifact, migration sequencing, previous-image compatibility and failed-release runbook | Rollback does not mutate, erase or accept User Project data |
| Observability | End-to-end capture of normal/error/auth/timeout paths plus retention/deletion evidence | No Project, backup, bytes, token, file/path or unapproved user metadata enters logs/telemetry/export |
| Client outage | `CatalogGatewayPort` contract/browser evidence for DNS/timeout/5xx/partial bytes and local exact-byte verification | Fully pinned Project remains local and usable; outage never becomes `ResourceRecoveryRequired` |

## Disposition for the next architecture workflow

Keep this draft and its explicit open decisions as a pre-canonical packet. The
next bounded `bmad-architecture` adoption attempt must incorporate the findings
above, name every accountable human owner, attach evidence rather than intent,
and run the normal independent Security, data-boundary/privacy, operations/
recovery, legal/asset and architecture reconciliation gates.

Until then, `G-CP-ADR` is not passable and no backend implementation may be
inferred from this review.
