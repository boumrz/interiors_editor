---
document_title: "Sprint Change Proposal — исключение лицензирования из Alpha"
status: approved
date: 2026-08-25
owner: Roman Zheltov
mode: batch
approval: "Product Owner explicitly requested removal of licensing from all pre-Alpha/Alpha slices in chat on 2026-08-25."
sources:
  - specs/spec-interiors-editor-alpha/SPEC.md
  - planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
  - planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - planning-artifacts/roadmap-to-alpha.md
  - implementation-artifacts/sprint-status.yaml
---

# Sprint Change Proposal — исключение лицензирования из Alpha

## Решение

Alpha не включает лицензирование как продуктовую функцию или release gate.
Из текущего Alpha scope удаляются `AssetUsageGrant`,
`assetUsageDeclaration`, legal/provenance admission, attribution/notices,
license ledger и rendered-output rights checks. Владелец продукта использует
только заведомо бесплатные либо самостоятельно созданные модели вне workflow
приложения; приложение не собирает и не проверяет юридические доказательства.

Это не ослабляет техническую надёжность ресурса: точные bytes, hash, локальный
pin, `BackupFeasibilityPolicy`, self-contained backup и recovery при missing/
corrupt resource остаются обязательными до Durable reference.

## Причина и доказательство

Product Owner сообщил, что модели для Alpha будут либо абсолютно бесплатными,
либо создаваться в нужных форматах. Поэтому прежние правовые proof routes
создают лишние stories, UI и readiness blockers, не давая ценности пользователю
планировщика. Текущая документация противоречит этой границе: она требует
AssetUsageGrant/declaration при placement, backup и PNG, а также notices и
лицензионный ledger.

## Impact analysis

| Область | Корректировка |
| --- | --- |
| PRD / SPEC | Удалить legal admission, notices, attribution и rights из CatalogAsset, ImportedAsset, placement, backup, PNG и Catalog Control Plane; сохранить resource hash/pin/backup/recovery. |
| Architecture | AD-14/AD-17 и solution design передают только технический versioned descriptor/resource/hash; legal provenance/grant/notice не являются полем порта или gate. |
| UX | Карточка и flow не показывают license/source, grant/declaration или attribution. Пользователь видит только название, габариты, совместимость и техническую readiness. |
| Delivery plan | Лицензионные части Story 5.6 и V-09-CP, а также legal/provenance/notice часть Story 8.10 снимаются. Оставшиеся технические catalog/pin/backup проверки не отменяются. |
| Historic evidence | Датированные legal/review/evidence artifacts не переписываются; они не являются действующим Alpha contract. |

## Chosen path

**Direct adjustment / moderate scope correction.** Новая эпика и rollback
готового технического pin/backup кода не требуются. Документируются retired
legal slices и синхронно обновляются владельцы источников истины. Риск —
смешать пользовательское решение с отказом от integrity; он снят явным
сохранением hash/pin/backup/recovery требований.

## Implementation handoff and success criteria

1. `bmad-spec` re-derives SPEC и spec-owned companions без `AssetUsageGrant`,
   declaration, notices, attribution и license ledger.
2. PRD, Architecture, UX, roadmap, sprint tracker и project context больше не
   содержат licensing как active Alpha feature, acceptance criterion или gate.
3. Карточка/placement/import/backup/PNG не требуют юридических полей и не
   показывают notice; они по-прежнему reject only технически неполный,
   unavailable или non-backup-ready resource.
4. `CatalogGatewayPort` при необходимости остаётся catalog-only и передаёт
   versioned resource metadata/bytes/hashes, никогда User Project data.
5. Исторические документы не меняются; active-source audit не находит
   `AssetUsageGrant`, `assetUsageDeclaration`, legal attribution или notice как
   Alpha requirement.

## Checklist disposition

- [x] Trigger/context: прямое решение Product Owner, 2026-08-25.
- [x] Epic impact: затронуты catalog/import/export slices; новая эпика не нужна.
- [x] Artifact impact: PRD, SPEC, Architecture, UX, roadmap, tracker и context
  синхронизируются; dated evidence остаётся historical.
- [x] Path evaluation: direct adjustment — низкий технический риск, rollback
  pin/backup не нужен; сокращение scope поддерживает Alpha timeline.
- [x] Approval: решение пользователя записано в frontmatter и source memlogs.
- [x] Handoff: document owners применяют scope correction; отдельный legal
  workflow и commit этим proposal не авторизуются.
