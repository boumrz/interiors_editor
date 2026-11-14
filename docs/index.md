---
title: "InteriorsEditor — документация проекта"
status: active
updated: 2026-10-24
---

# Документация InteriorsEditor

Внутренняя Alpha содержит 35 закрытых активных историй и итоговый
implementation-readiness **READY от 30 августа 2026**. Это разрешение
разрабатывать продукт; пользовательское исследование и публичные операции
имеют отдельные критерии.

## Продолжение работы

- [Отчет проверки 24 октября](progress/PROJECT-RESUME-2026-10-24.md).
- [План исполнения рекомендаций](../plans/project-continuation-2026-10-24.md).
- [Сентябрьский редизайн и оставшиеся срезы](../plans/calm-spatial-redesign-p0-2026-08-31.md#remaining-work--reconciled-2026-09-05).
- [Запуск на телефоне и выпуск](operations/PHONE-AND-RELEASE-RUNBOOK.md).
- [Пользовательская проверка Alpha](validation/ALPHA-USABILITY-PROTOCOL.md).
- [Автоматические проверки](../.github/workflows/verify.yml).

## Актуальные источники истины

| Область | Источник |
| --- | --- |
| `FR-*` / `NFR-*` | [PRD](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md) |
| `CAP-*` и companions | [SPEC](../_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md) |
| `AD-*` | [Architecture Spine](../_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md) |
| Stories и traceability | [Epics](../_bmad-output/planning-artifacts/epics.md), [sprint status](../_bmad-output/implementation-artifacts/sprint-status.yaml) |
| Implementation readiness | [Финальный READY 30 августа](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-30.md#final-verdict--2026-08-30) |
| Закрытие технических гейтов | [Текущее решение](../_bmad-output/planning-artifacts/evidence/current-product-gates-2026-08-30.md), [terminal human review](../_bmad-output/planning-artifacts/evidence/readiness-collection-2026-08-09/terminal-human-review-2026-08-30.md) |
| Инструкции агентам | [AGENTS](../AGENTS.md), [Project context](../_bmad-output/project-context.md) |
| Визуальный и interaction договор | [DESIGN](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md), [EXPERIENCE](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md) |

В readiness, roadmap и evidence сохранены исторические `NOT_READY`, проценты
и прежние device matrices. Они не отменяют финальный READY и принятое NFR-15
решение двухустройственной функциональной проверки. Устаревшие фразы в
Architecture Deferred и Project context согласуются владельцем источника;
рабочий план не переписывает их автоматически.

### Обязательные companions SPEC

- [Glossary](../_bmad-output/specs/spec-interiors-editor-alpha/glossary.md).
- [Geometry](../_bmad-output/specs/spec-interiors-editor-alpha/geometry-contract.md),
  [Topology corpus](../_bmad-output/specs/spec-interiors-editor-alpha/topology-corpus-contract.md),
  [Editor interaction and grid](../_bmad-output/specs/spec-interiors-editor-alpha/editor-interaction-and-grid-contract.md).
- [Asset import](../_bmad-output/specs/spec-interiors-editor-alpha/asset-import-contract.md),
  [Performance and accepted devices](../_bmad-output/specs/spec-interiors-editor-alpha/performance-budgets.md).
- [Project and backup](../_bmad-output/specs/spec-interiors-editor-alpha/project-and-backup-contract.md),
  [Portable backup ingress](../_bmad-output/specs/spec-interiors-editor-alpha/portable-backup-ingress-registry.md).
- [Catalog control plane](../_bmad-output/specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md).
- [Историческое evidence 18 августа](../_bmad-output/specs/spec-interiors-editor-alpha/implementation-evidence-2026-08-18.md).
- DESIGN, EXPERIENCE, Architecture Spine и Project context из таблицы выше.

Полный список companions принадлежит frontmatter SPEC; он имеет приоритет
перед этой навигацией. Перевыводить SPEC вправе только `bmad-spec`.

## Правила сопровождения

[BMAD integration](BMAD-INTEGRATION.md) описывает workflow,
[Git governance](GIT-GOVERNANCE.md) — ownership и коммиты. Каждый BMAD workflow
выполняется в свежем чате. Installer-owned `_bmad` и `.agents/skills` не
редактируются; `.memlog.md` изменяются только `_bmad/scripts/memlog.py`.

Архивные [phone POC](poc/README.md) и spike evidence остаются историей;
продукт находится в `apps/web` и `apps/catalog-control-plane`.
Перемещение канонических документов из `_bmad-output` требует утвержденного
path mapping, смены authority и проверки ссылок/стабильных ID.

AGENTS все еще требует human-approved `AssetUsageGrant`, хотя часть scope
документов исключает legal admission из Alpha. До source-owner reconciliation
действующие AGENTS сохраняют силу; текущие self-authored каталоговые ресурсы
имеют grant в S6 closure. Произвольные сторонние ресурсы этим не разрешены.

- [Доработка и запуск на телефоне, 24 октября 2026](progress/DELIVERY-2026-10-24.md).
