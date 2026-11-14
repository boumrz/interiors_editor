---
title: "G-CP-ADR — decision intake"
status: inputs_pending
date: 2026-08-04
parent_spine: ARCHITECTURE-SPINE.md
gate: G-CP-ADR
closes_gate: false
authoring_workflow: bmad-architecture
---

# G-CP-ADR — decision intake

## Назначение

Этот документ подготавливает только входные данные для будущего bounded ADR
перед `V-09-CP`. Он **не является принятым ADR**, не закрывает `G-CP-ADR` и
не разрешает Kotlin-код, PostgreSQL schema, API, deployment или production
catalog.

## Inherited invariants

Из `AD-17`, `FR-54`, `NFR-10`, `NFR-13` и `NFR-21` будущий ADR обязан
сохранить следующие границы:

| Разрешено только Control Plane | Всегда запрещено Control Plane |
| --- | --- |
| versioned catalog metadata и resource descriptors/bytes; content version/hash; provenance; `AssetUsageGrant`; required notices | account identity; User Project; Revision; session History; Portable Backup; user-owned pinned bytes; remote sync/collaboration; recovery ownership |

- Web обращается к remote perimeter только через `CatalogGatewayPort`.
- Outage создаёт только `control-plane-unavailable` или
  `unpinned-download-unavailable`; он не создаёт `ResourceRecoveryRequired` и
  не блокирует healthy local Project.
- Любая placement/material mutation становится Durable только после local
  exact-byte pinning и `BackupFeasibilityPolicy`.
- Kotlin `2.4.10` и PostgreSQL `18.4` уже adopted как language/data-store
  baseline; этот intake не выбирает поверх них framework или toolchain.

## Transport-neutral logical contract

Будущее решение должно описать conformance без преждевременного endpoint,
JSON/OpenAPI, SQL-schema или delivery-topology выбора:

1. Publisher/operator может публиковать только versioned catalog entry с
   identity/version, content hash, provenance, grant и required notices.
2. Client может получить catalog metadata, exact version descriptor и
   разрешённый resource candidate через `CatalogGatewayPort`.
3. Client local adapter проверяет exact bytes и policy до pinning; remote
   response сам по себе не является Durable Project state.
4. Contract/integration evidence доказывает отказ от любого Project-data path,
   включая ошибочные payload, migration и operator flows.

## Решения, которые ещё нельзя выбирать молча

| Axis | Accountable decision owner | Must preserve | Required evidence | Status |
| --- | --- | --- | --- | --- |
| Kotlin build/test boundary | Architecture + designated backend/catalog owner | Kotlin tests не запускаются JavaScript runner; isolated control-plane root | reproducible build/test command and contract-test boundary | `PENDING` |
| API/transport | Architecture + backend/catalog owner | `CatalogGatewayPort`, no account/Project data | contract tests for normal, malformed and prohibited requests | `PENDING` |
| Resource-byte delivery | Architecture + backend/catalog owner | exact hash/provenance; local pinning remains decisive | integrity, outage/retry/cancel and no-Project-data traces | `PENDING` |
| PostgreSQL schema/operations | Architecture + backend/catalog owner + ops owner | catalog/provenance only; version/migration/recovery boundary | schema/migration/integration evidence and backup/restore operation policy | `PENDING` |
| Publisher/operator authentication | Security/ops/product owner | no end-user account identity or Project linkage | authorization/audit/negative-access evidence | `PENDING` |
| Asset rights/provenance | Product + Legal/Asset steward | full human `AssetUsageGrant` and notice placement | named human approver, ledger and sample/corpus provenance | `PENDING` |
| Hosting/SLA/telemetry/retention | Product + security/ops owner | no implicit vendor, privacy or retention promise | explicit operational/privacy decision | `PENDING` |

## Definition of Done for the future adopted ADR

`G-CP-ADR` may become `PASS` only when one adopted ADR selects the pending axes
above and supplies all of the following:

- reproducible Kotlin build/test boundary;
- API/transport and resource-delivery choice with `CatalogGatewayPort`
  conformance contract;
- PostgreSQL schema, migration and operations/backup boundary;
- publisher/operator authentication decision;
- Kotlin/PostgreSQL contract, migration and integration evidence, including
  negative proof that no request or persistence path accepts Project data;
- named human provenance/`AssetUsageGrant` authority and its evidence path.

Until then, `V-09-CP` and Story 5.6 remain blocked. `V-01` web bootstrap is
not blocked by this intake; it remains separately governed by `G-READY`,
`G-V01-S3` and `G-WEB-AD16`.
