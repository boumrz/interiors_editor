---
title: "G-CP-ADR R2 — external-dependency decision register"
date: "2026-08-05"
status: "advisory-external-owner-register"
canonical: false
review_basis:
  - ../drafts/G-CP-ADR-draft-2026-08-05.md
  - ../G-CP-ADR-INTAKE.md
  - review-current-source-g-cp-adr-r2-data-boundary-privacy-2026-08-05.md
  - review-g-cp-adr-r2-security-adversarial-2026-08-05.md
  - review-g-cp-adr-r2-operations-recovery-2026-08-05.md
  - review-g-cp-adr-r2-legal-asset-governance-2026-08-05.md
  - review-g-cp-adr-r2-architecture-reconciliation-2026-08-05.md
  - ../../../implementation-readiness-report-2026-08-05.md
source_mutations: none
people_assigned: none
external_credentials_or_contracts_created: false
canonical_adoption: blocked
readiness: NOT_READY
implementation_authority: false
---

<!-- markdownlint-disable MD013 -->

# G-CP-ADR R2 — реестр внешних решений и accountable ролей

Это только advisory-регистр для будущего source-owner workflow. Он назначает
**роли решений, а не людей**, не выбирает provider, region, IdP, credentials,
asset rights или физические controls. Его создание не меняет статус R2
`draft_for_independent_review`, `G-CP-ADR: inputs_pending` и
`G-READY: NOT_READY`.

Основа неизменна: `AD-17` допускает только узкий Catalog Control Plane,
а `FR-54`, `NFR-10`, `NFR-13`, `NFR-21` и
[catalog-control-plane contract](../../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md)
оставляют User Project, Revision, session History, Portable Backup и
user-owned pinned bytes strictly local. Любое внешнее решение ниже должно
сохранить эти границы.

## Значение ролей

Каждая роль ниже должна быть принята реальным уполномоченным человеком до
своего решения. Этот документ не назначает Roman, Codex, подрядчика или
provider-аккаунт и не может заменить доверенность, contract, credentials,
внутренний control или physical proof.

| Роль решения | Mandate | Нельзя делегировать только документации |
| --- | --- | --- |
| **Product Boundary Owner** | Принимает ценность remote catalog, budget, допустимый SLA/RTO/RPO и бизнес-границу без расширения к User Project. | Коммерческий договор, риск, availability promise и назначение реального владельца. |
| **Control-Plane Architecture Owner** | Сводит решение с `AD-17`, `CatalogGatewayPort`, contract allowlists и no-Project-data corpus. | Принятие канонического ADR или доказательство provider-backed enforcement. |
| **Backend/Catalog Publication Owner** | Владеет bounded catalog schema, publication state machine, migration/release compatibility и curated ingress design. | Запуск сервиса, публикацию ресурсов, provider credentials или legal approval. |
| **Cloud Security & IAM Authority** | Владеет provider IAM, storage/network/secret/key policy, object immutability и independent security acceptance. | Выбор/настройку реального cloud account, IdP tenant или custody ключей без соответствующей authority. |
| **Identity Security Authority** | Владеет OIDC issuer/JWKS trust profile, operator lifecycle, scopes, revocation/offboarding и break-glass policy. | Фактический issuer/tenant, operator accounts или security credentials. |
| **SRE / Recovery Owner** | Владеет provider/service operation, backup/PITR, measured RTO/RPO, on-call, incident and restore drill. | Обещание SLA, measured RTO/RPO или access to restore controls без real environment. |
| **Privacy & Data Protection Authority** | Владеет telemetry/observability data inventory, legal basis, retention/deletion and provider/subprocessor review. | Утверждение legal basis, DPA, residency or privacy notices без human authority. |
| **Legal Rights Authority** | Владеет human approval of each `AssetUsageGrant`, raw-delivery right, notice obligation, expiry/withdrawal and evidence access. | Лицензионное толкование, grant или distribution right через AI/metadata field. |
| **Asset Steward** | Владеет source/derivative provenance, exact-byte manifest, transformation lineage and notice execution evidence. | Замену rights approval catalogue label, scan or unsigned manifest. |

## Что можно зафиксировать уже сейчас

Следующие пункты можно записать в последующем ADR как inherited/default-deny
constraints. Это **не новые adopted decisions** и не заменяет внешние
evidence.

| Safe now | Почему это безопасно | What still cannot follow |
| --- | --- | --- |
| Неизвестный raw-byte delivery остаётся metadata-only/default-deny. | Это прямо соответствует R2 и исключает вывод права доставки из metadata, backup или private transfer. | Ни origin, ни CDN, ни signed URL, ни cache не могут быть включены без отдельного human-approved per-version scope и enforcement proof. |
| End-user account, cookie/session, User Project/Revision/History/Backup и user-pinned bytes запрещены remote perimeter. | Это inherited `AD-17`/`FR-54` boundary. | Нельзя выбирать “удобный” analytics, support export, upload или recovery path, который нарушает запрет. |
| Роли, dossier shape и negative-corpus obligations могут быть подготовлены до provider selection. | Это planning work, не создающее external state. | Они не доказывают provider IAM, OIDC, retention, restore, rights or availability. |
| `RTO`/`RPO` являются измеряемыми итогами restore drill, а не значениями из презентации provider. | Это исключает ложный recovery claim. | Нельзя записать target как achieved или закрыть operations gate без paired physical restore. |
| Для product analytics сохраняется default `none`; любая telemetry требует отдельного privacy decision. | R2 запрещает analytics по умолчанию и не считает provider logs отсутствующими. | Нельзя считать application logging configuration достаточной privacy policy. |

## Внешний decision register

Статус каждой строки — одна строка решения на дату этого регистра. `Required
external reality` означает, что только реальные credentials, contracts,
provider controls, human approvals or physical evidence могут перевести его
в другой статус.

| ID / blocker | Accountable decision role | Решение, которое эта роль обязана принять | Required external reality | Exact acceptance evidence | Decision status now |
| --- | --- | --- | --- | --- | --- |
| `EXT-01` Provider, region and copy inventory<br>Ops-01 | **Product Boundary Owner**; mandatory consultation: SRE/Recovery, Cloud Security, Privacy and Legal. | Один provider/service-plan boundary, allowed regions/residency, permitted replicas/caches/support processors and deletion authority. | Authorised provider organisation/account, commercial and data-processing terms, named jurisdiction and actual service topology. | Approved service/region decision; complete copy inventory for PostgreSQL primary, backups/WAL, object versions/recovery, CDN/WAF, DNS/HTTP egress, access/audit logs, APM/crash/support exports; subprocessor and retention/deletion record; independent review that no unapproved secondary copy exists. | **BLOCKED — human commercial, legal and provider selection pending.** |
| `EXT-02` IAM, object storage and immutability<br>Ops-03/04/08; Sec-04/11 | **Cloud Security & IAM Authority**; implementation input from Backend/Catalog Publication Owner and SRE/Recovery Owner. | Dedicated catalog-only storage/database/recovery scopes; least-privilege roles; non-public data plane; immutable-object/lifecycle/delete policy and key custody. | A real provider account/project, provider IAM identities, network controls, key/secret custody and storage feature selection. | Redacted provider policy exports and inventory for ingest, runtime-read, backup, restore and operations principals; live allow/deny captures for read/create/overwrite/delete/list/lifecycle/restore; direct-origin and public-policy denial; object-version/retention tests; proof that no role can touch user-pinned, Project or backup namespaces. | **BLOCKED — provider-backed IAM and physical controls required.** |
| `EXT-03` OIDC, JWKS and operator lifecycle<br>Sec-06/07/08 | **Identity Security Authority**; consultation: Cloud Security, SRE and Backend/Catalog Publication Owner. | Exact issuer/tenant/audience/authorized-party profile; scoped publication/withdrawal transitions; JWKS trust/egress, cache/refresh, rotation, revocation/offboarding and break-glass rules. | An approved IdP/tenant, issuer contract/configuration, authorised operator population and controlled secret/key custody. | Versioned trust profile without secrets; evidence for issuer, audience, `azp`, algorithm/key type, unknown `kid`, expiry/not-before, time skew, key rotation, revocation, replay and wrong scope/state denial; minimised `operatorAuthorityRef` retention/access/deletion proof; fail-closed JWKS outage capture. | **BLOCKED — real IdP trust root and operator authority required.** |
| `EXT-04` Curated ingress and publication state machine<br>Sec-05; Ops-09/10; DB-02 | **Backend/Catalog Publication Owner**; mandatory security acceptance by Cloud Security & IAM Authority and rights gate by Legal Rights Authority. | One bounded non-browser ingress, quarantine/validation/transform order, DB-to-object release states, idempotency, retry, orphan cleanup and withdrawal transition. | An isolated ingestion environment, source/supplier allowlist, storage/queue policy, real workload identities and approved source-resource corpus. | State-machine specification and negative corpus; physical pipeline captures showing no browser upload, multipart user upload, arbitrary URL fetch, backup import or generic proxy; size/media/hash/derivative validation before publication; temp/queue/dead-letter logging and egress inspection; immutable release attestation binding byte, dossier, object and DB state. | **DESIGN MAY BE PREPARED; enforcement is BLOCKED on provider controls and human rights corpus.** |
| `EXT-05` Per-version raw-byte delivery and cache enforcement<br>DB-01; Sec-01/02/03; Ops-02 | **Legal Rights Authority** owns whether a representation may be delivered; **Cloud Security & IAM Authority** owns enforcement acceptance. | For each exact byte/representation, decide metadata-only or a legally linked delivery scope, including channel, expiry, withdrawal and required notice treatment; select one enforcement locus and cache revocation semantics. | A human rights decision for each asset/subresource, a selected delivery plane, and provider/CDN/cache controls capable of enforcing the decision. | Immutable mapping of exact catalog version/hash/media to `AssetUsageGrant`, named legal evidence reference, exposure/channel, validity/expiry/withdrawal and notice decision; provider/browser captures for metadata, GET, HEAD, range, conditional, redirect, cache, error and purge; no raw byte or capability URL without an active mapping. | **METADATA-ONLY DEFAULT — human rights and technical enforcement are both pending.** |
| `EXT-06` Paired recovery, RPO and RTO<br>Ops-06/07; DB-04 | **SRE / Recovery Owner**; Product Boundary Owner accepts the resulting service objective, not a prefilled number. | Catalog-only backup/PITR topology, common recovery watermark, withdrawal/expiry reconciliation and measured RPO/RTO commitment. | Actual backup retention, recovery account/key access, isolated restore environment and provider-supported PostgreSQL-plus-object recovery path. | Witnessed paired restore drill to non-public isolated target; recovery manifest binds database point, immutable release records and exact object-version inventory; descriptor/hash/media/provenance/grant/delivery/notice and no-Project-data verification; withdrawal ledger replay; measured RPO/RTO, tool/build/version, actor role, cleanup and key-availability record. | **BLOCKED — measured physical restore evidence required; no RTO/RPO claim now.** |
| `EXT-07` SRE/on-call, incident and availability commitment<br>Ops-11/12 | **SRE / Recovery Owner**; Product Boundary Owner approves any external availability promise. | On-call and escalation model, incident severity/runbook, privacy-safe support-export route, rate/abuse response and any catalog SLA/SLO. | A real operating organisation, support/escalation capability, provider support plan, monitoring/alerting account and explicit budget/availability decision. | Human-approved role coverage and escalation path; incident and break-glass runbooks; monitored alert ownership; controlled incident exercise for outage, throttling, partial-byte, auth failure and restore; evidence that visible client outcome stays only in catalog-unavailable states and that no runbook uses Project/user data. | **ROLE DEFINED; operational assignment and physical exercise are pending.** |
| `EXT-08` AssetUsageGrant, provenance and notices<br>LG-01 through LG-08 | **Legal Rights Authority** for rights; **Asset Steward** for exact-byte provenance; Product Boundary Owner for published catalog scope. | Appointment/authority matrix; each asset/subresource/derivative's provenance, full `AssetUsageGrant`, transformations, notices, delivery scope, expiry/withdrawal and controlled evidence access. | Named human approvers with authority, actual licence/contract/provenance records and resource-specific corpus. | Per-version immutable dossier: acquisition chain; every source/model/texture/subresource/derived hash/media; runtime, private-backup and rendered-output policies; named reviewer/evidence/validity/withdrawal record; derivative manifest; notice-placement matrix; public-metadata allowlist; release and withdrawal/correction record. Forbidden, unknown, expired and withdrawn fixtures must deny publication and durable placement. | **BLOCKED — cannot be decided, approved or simulated by AI.** |
| `EXT-09` Privacy, telemetry, observability and retention<br>DB-03; Sec-12; Ops-11 | **Privacy & Data Protection Authority**; mandatory consultation: Product Boundary, Cloud Security and SRE/Recovery. | Field-level allowlist, lawful basis, collector/subprocessor scope, retention/deletion, access controls, support-export and incident-data minimisation. | Legal/privacy authority, provider collector inventory/DPA or equivalent terms, selected observability/support systems and actual retention/deletion controls. | End-to-end data-flow and field inventory across proxy/CDN/WAF, service, DB, object store, APM, crash, metrics, alerts, DNS/HTTP egress, provider logs and support exports; redacted normal/auth/error/timeout/restore captures; proof of body/token/raw-claim/Project/byte/path/IP/referrer exclusion; retention/deletion and access evidence. | **NO PRODUCT ANALYTICS DEFAULT; external privacy and provider-log decision pending.** |
| `EXT-10` Supply chain, CI and secret/key custody<br>Sec-10/11; Ops-05 | **Cloud Security & IAM Authority**; delivery design from Backend/Catalog Publication Owner. | CI trust model, approved source/repository/dependency/image set, artifact promotion, secret/key inventory, rotation/revocation and migration/release compatibility. | Chosen CI system/runners, protected organisation/repositories, signing/attestation capability, secret manager and provider workload identities. | Clean reproducible Gradle/JDK/dependency build; wrapper/JDK/container/dependency digests, SBOM/provenance, repository allowlist and patch policy; CI permission review showing untrusted work lacks credentials; secret/key inventory and rotation exercise; migration/current-prior image compatibility, failed-migration and forward-fix restore rehearsal. | **CANDIDATE CONSTRAINTS EXIST; real CI, credentials and custody evidence are pending.** |

## Required sequencing and hand-offs

1. **Product Boundary Owner** fills `EXT-01` first; a provider/region/copy
   inventory makes the concrete IAM, privacy and recovery evidence possible.
2. **Legal Rights Authority + Asset Steward** fill `EXT-08` in parallel with
   `EXT-01`; without a per-version rights corpus, `EXT-05` remains
   metadata-only even if a provider is selected.
3. **Cloud Security & IAM Authority** and **Identity Security Authority** then
   close `EXT-02`, `EXT-03`, `EXT-05` enforcement and `EXT-10` against the
   selected external systems.
4. **Backend/Catalog Publication Owner** defines `EXT-04` only within those
   controls; implementation is still prohibited until the future adopted ADR
   and readiness path authorize it.
5. **SRE / Recovery Owner** runs `EXT-06` and `EXT-07` only in the selected
   real environment; placeholder RTO/RPO, local Docker and provider marketing
   are not substitute evidence.
6. **Privacy & Data Protection Authority** signs off `EXT-09` after every
   collector, provider copy and support-export route is known.
7. A source-owner ADR may be considered only after fresh independent security,
   data-boundary/privacy, operations/recovery, legal/asset-governance and
   architecture-reconciliation reviews evaluate the concrete evidence.

## Evidence integrity rules

- Store credentials, JWTs, private contracts, licences and personal contact
  data in their approved controlled systems, never in this register or a
  canonical ADR repository artifact.
- Evidence references may contain opaque IDs/hashes, redacted exports and
  approved locations, but must be sufficient for the appointed human reviewer
  to inspect the original authority.
- A provider configuration screen, successful local emulator, test framework
  result, or AI assertion cannot close an external-control blocker on its own.
- No asset is publishable or placeable as an Alpha `CatalogAsset` until the
  human `AssetUsageGrant` covers its full required scope and local
  `BackupFeasibilityPolicy` succeeds; this stays true even where raw-byte
  delivery remains intentionally unavailable.

## Non-adoption statement

This register does not select a vendor, sign a contract, appoint a person,
create an account, allocate credentials, make an SLA, measure RTO/RPO, approve
an asset, authorise raw-byte delivery, implement a Kotlin service, or close a
review/gate. It is a role-and-evidence handoff only. `G-CP-ADR` remains
`inputs_pending`, `G-READY` remains `NOT_READY`, and `V-09-CP`/Story 5.6
remain blocked.
