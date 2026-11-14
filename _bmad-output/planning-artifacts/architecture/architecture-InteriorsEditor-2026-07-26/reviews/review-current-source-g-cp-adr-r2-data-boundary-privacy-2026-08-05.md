---
title: "InteriorsEditor — independent G-CP-ADR R2 data-boundary and privacy review"
review_type: current-source-reality-precanonical-control-plane-r2
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../drafts/G-CP-ADR-draft-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 4e6e4248b76d6cc04350be6ff69dbb34232a00a44853cf480267f3b094854f0c
  spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  intake_sha256: bfc899e0dc3b2e4e69850a664812025082d7942a9a47ad6fd51e4fe5c8b78876
  spec_sha256: ce903b5aa4bf3f59efbd08d030dc7c292491315a1280cf1203f3114e517169ed
  catalog_contract_sha256: c3b06f9967630fb1e66754463acb97d5dda9a3209ac1cade418f33e770b8a48c
  project_backup_contract_sha256: 91ecfb9ac4cb7bc21e2e0205442b960713e70a2aaf3384a40645db2fff8d7157
  prd_sha256: 48bd0a416dad0e78ac65d3f616da7ded36500726ff2e0026650d7f93814d47eb
  project_context_sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
  r1_security_review_sha256: 6d85f24fde4b2cacf63505fdf366119c97c91dcd1016c403bae79065518a6a38
  r1_operations_review_sha256: 9741cb6dd9bb920ac6191aaf14b9c47b3dde9223f1d79d5de8ddd2d228a96223
  r1_legal_review_sha256: 8364ba6a53767c49255f157fe779be613474860c70427289a0c01d696e1acb60
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../G-CP-ADR-INTAKE.md
  - ../drafts/G-CP-ADR-security-data-boundary-review-2026-08-05.md
  - ../drafts/G-CP-ADR-operations-recovery-review-2026-08-05.md
  - ../drafts/G-CP-ADR-legal-asset-governance-review-2026-08-05.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../../project-context.md
status: complete
verdict: PASS_FOR_PRECANONICAL_INPUT_ONLY
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Independent read-only R2 review of all declared control-plane data routes; no canonical, memlog, code, test, configuration, evidence or owner-decision mutation"
source_mutations: none
---

# G-CP-ADR R2 — независимая проверка границы данных и приватности

## Вердикт

**`PASS_FOR_PRECANONICAL_INPUT_ONLY`.** R2 можно использовать только как
непринятый вход в последующий source-owned ADR. Он не открывает ни один
пользовательский data path и не выдаёт за принятое ни provider, API, ingress,
storage, identity, human rights decision или evidence. `G-CP-ADR` остаётся
`BLOCKED`, а `G-READY` — `NOT_READY`.

Это не pass для канонического ADR и не разрешение создавать Kotlin-код,
Gradle/SQL/API/объектное хранилище, каталог, CI, секреты или deployment.
Канонический `AD-17` по-прежнему оставляет все эти axes deferred; R2 правильно
сохраняет это ограничение.

## Независимые механические проверки

- Все пять локальных ссылок R2 (`ARCHITECTURE-SPINE`, intake и три R1
  review) разрешаются; все источники из review basis существуют.
- Current-source snapshot выше сверён до вынесения вердикта.
- Штатный `lint_spine.py --workspace` вернул `ok: true` и `0` findings. Это
  подтверждает только синтаксическую целостность Spine, а не принятие R2.

## Что R2 согласует с каноническими границами

`AD-2` допускает remote transport только за application-owned
`CatalogGatewayPort`; `AD-4` и `AD-17` оставляют Project/Revision/History/
Portable Backup и user-pinned bytes local-first. `FR-54`, `NFR-10`, `NFR-13`,
`NFR-21`, `NFR-23`, `NFR-25`, CAP-6/7 и companion catalog/backup contracts
подтверждают ту же границу. R2 не ослабляет ни одну из них:

| Маршрут | Проверенное правило R2 | Результат для precanonical input |
| --- | --- | --- |
| Browser → public metadata | Только immutable catalog metadata/descriptor/hash, безопасная provenance/grant/notice summary; без body, cookie, session, Project-derived selector, browser key или raw bytes. | **Pass.** Metadata не превращается в право доставки byte. |
| Browser/CDN/proxy → raw byte | Только exact catalog-owned byte, связанный с descriptor/hash/media и отдельным per-version delivery scope; redirect, signed URL, range, cache и error route названы delivery surfaces. | **Pass с gate.** По умолчанию delivery отсутствует; private-transfer/Portable Backup right не выводится как public right. |
| Operator/publication ingress | Operator route принимает bounded dossier/release record, а не generic binary/user file; browser/multipart/presigned upload, backup import, arbitrary URL fetch и generic proxy прямо запрещены. | **Pass с gate.** Единственный разрешаемый curated-byte ingress намеренно ещё не выбран и поэтому не может быть реализован. |
| `CatalogGatewayPort` → local Project | Remote response не является Durable Project state; local exact-byte pinning и `BackupFeasibilityPolicy` остаются решающими. | **Pass.** Не появляется удалённый Project/Revision/history/backup path. |
| PostgreSQL, migrations, queues | Выделенный catalog-only scope; Project/document/queue/audit escape hatches, migration seeds и failed-migration artifacts запрещены и требуют negative corpus. | **Pass с gate.** Schema/roles ещё не выбраны. |
| Object store/CDN/object metadata | Private dedicated catalog-only bucket/recovery namespace, separate identities, no public bucket/List/Write/Delete, no user pin/backup/recovery namespace; tags and error/cache paths входят в deny surface. | **Pass с gate.** Provider/IAM proof ещё обязателен. |
| Logs, diagnostics, telemetry, provider/support exports | Application logs ограничены fixed reason/build/route/server correlation/outcome; bodies, tokens, Project, byte, path/name, IP/referrer и user identifiers запрещены. Provider collection не объявлена отсутствующей и остаётся inventory/retention blocker. | **Pass с gate.** Это не ошибочно выдаётся за реализованную privacy policy. |
| Catalog backup/restore | Только paired catalog PostgreSQL + exact catalog-object restore в isolated non-public target; не Portable Backup и не Project recovery. | **Pass с gate.** Partial restore — failure, а не допустимый fallback. |
| Outage, local repair и failure paths | Есть только `control-plane-unavailable`/`unpinned-download-unavailable`; healthy pinned Project продолжает local edit/save/history/backup. Network byte становится repair только после local exact validation. | **Pass.** Совпадает с catalog-control-plane и Project/Backup contracts. |

Особенно важно: R2 сохраняет различие между curated catalog-owned byte и
user-owned pinned byte. Оно не размывается ни объектным recovery namespace,
ни операционным restore, ни delivery cache, ни локальным repair flow.

## Устранённые риски R1

| R1 concern | R2 disposition | Проверка |
| --- | --- | --- |
| Публичная metadata могла неявно открыть raw 3D bytes. | Added separate immutable delivery scope; raw delivery is default-deny and all redirects/CDN/ranges/cache paths fall under it. | **Remediated as a policy input.** |
| Неопределённый ingestion мог стать generic upload/backup path. | Curated ingress is explicitly unselected, while every generic/user/browser/URL/backup alternative is prohibited before temp storage, queue, object metadata or log. | **Remediated as a fail-closed input.** |
| Indirect data copies through migration, restore, diagnostics or provider paths were only prose. | R2 names DB/migration/queue/object/backup/restore/telemetry/provider/support routes and makes a negative corpus and field inventory prerequisites. | **Remediated as a reviewable gate, not as evidence.** |
| Asset right for public raw delivery could be inferred from private backup/transfer. | Publication dossier separates delivery exposure from runtime/backup/rendered policies and stops default raw delivery. | **Substantially remediated; the legal binding below still must be explicit.** |

## Mandatory blockers before canonical adoption

These are not attempts to make the human decisions in this review. They are
the concrete evidence/owner conditions that must remain open until satisfied.

### GCP-R2-DB-01 — Bind delivery scope to rights evidence, not merely an operator field

**Evidence.** The canonical `AssetUsageGrant` expressly covers runtime,
private backup/transfer and rendered-output policies, and says public source
3D-byte distribution is not implied. R2 correctly adds a separate
per-version delivery scope, but its dossier table calls for “explicit human
approval” without making the legal evidence binding mechanically explicit.

**Required before adoption.** The selected dossier schema must bind each
delivery scope to the exact byte hash/media/version, exact exposure
(including whether unauthenticated/public delivery is allowed), named Legal
approval/evidence reference, matching immutable grant snapshot, validity,
expiry and withdrawal. A generic publisher approval or grant ID must be
rejected. Any delivery scope that is missing, unknown, expired, withdrawn or
not legally linked to that immutable resource must be metadata-only.

### GCP-R2-DB-02 — Turn the stated deny surface into closed, testable transport and ingress contracts

**Evidence.** R2 intentionally leaves routes, field grammar, headers, media,
range/CORS/cache/content-disposition/error behaviour and curated byte ingress
unselected. That is valid for this input, but it means no implementation can
rely on generic JSON, query/header pass-through, multipart, signed upload,
arbitrary URL fetch, temporary object, queue or dead-letter default.

**Required before adoption.** Named Architecture/backend/Security owners must
adopt a versioned allowlist plus machine-readable negative corpus. It must
exercise ordinary, malformed, rejection, retry, timeout, redirect, range,
cache, error and operator paths, proving prohibited values are rejected
*before* durable DB/object/audit/log/provider-bound writes. Capture tests must
show Project IDs/geometry/placement/history/recovery, backup manifests,
browser-storage keys and client trace values never cross `CatalogGatewayPort`.

### GCP-R2-DB-03 — Make operator identity and audit minimisation an explicit data model

**Evidence.** R2 correctly separates external OIDC operators from product
users and forbids raw tokens/claims in logs. Yet it also permits a minimal
publication audit and leaves issuer, lifecycle, revocation, retention and
provider/support inventory open. Without a closed audit-field rule, an OIDC
`sub`, email/name, claim blob or client header can silently become a durable
account/profile-like record.

**Required before adoption.** Security/Operations must choose a trusted issuer
and a bounded, documented `operatorAuthorityRef` (or equivalent), state
whether it is persisted, define retention/access/deletion and prove that it
cannot link to a Project or create an end-user account/session. The same
field-level inventory must cover proxy/CDN/WAF, Ktor, database, object, APM,
metrics, crash, DNS/HTTP egress, provider and support-export paths.

### GCP-R2-DB-04 — Prove physical isolation, immutability and catalog-only recovery

**Evidence.** R2 prohibits shared clusters/buckets/restore targets and calls
for paired DB+object restore, but provider, IAM, key custody, object-lock/
create-only semantics, region/residency, deletion and actual RPO/RTO remain
open. A hash-shaped object key or local emulator cannot prove those controls.

**Required before adoption.** Named Product/Operations/Security/backend owners
must select the provider and dedicated scopes, inspect allow/deny policies and
run a witnessed paired restore into an isolated non-public environment. The
proof must check descriptor/hash/media/provenance/grant/delivery/notice
consistency and the negative Project-data corpus before any exposure; it must
record cleanup, retention/key availability and measured RPO/RTO.

### GCP-R2-DB-05 — Preserve local-first and rights behaviour under all remote failures

**Evidence.** R2's stated outage mapping matches the canonical catalog and
backup contracts, but no client/server contract evidence yet proves partial
byte, hash/media mismatch, revoked/withdrawn catalog version, cache error or
repair failure cannot mutate Project state or misclassify a healthy Project.

**Required before adoption.** The future contract/browser corpus must prove:
an existing fully pinned Project can edit, publish Durable Revision,
undo/redo and export offline; an unpinned resource stays cancelable; only a
local integrity scan can enter `ResourceRecoveryRequired`; and every network
repair first passes local exact size/media/hash/provenance validation. A
withdrawal may stop new delivery but never rewrites a local pinned byte,
Durable Project or Portable Backup.

## Architecture and readiness conclusion

R2 is a useful bounded candidate precisely because it declines to solve the
human/provider/legal questions by implementation assertion. It preserves the
same narrow remote perimeter as `AD-2`, `AD-4`, `AD-14`, `AD-16` and `AD-17`,
and it keeps the three R1 reviews as requirements rather than approvals.

The next owner workflow must first resolve and evidence the five blockers,
then obtain fresh Security, data-boundary/privacy, operations/recovery,
legal/asset-governance and architecture-reconciliation reviews against the
concrete adopted candidate. Until that happens, no canonical ADR, catalog
publication, raw-byte path, provider decision or implementation/readiness
claim follows from this pass.
