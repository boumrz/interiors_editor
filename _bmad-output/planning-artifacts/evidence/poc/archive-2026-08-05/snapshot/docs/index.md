---
title: "InteriorsEditor — documentation index"
status: planning
updated: 2026-08-04
---

# Документация InteriorsEditor

Это единая человеческая точка входа в документацию проекта. Здесь находятся
навигация и будущие curated-views; канонические BMAD-файлы пока остаются в
`_bmad-output/` как проверяемое provenance, а не как исходный код приложения.

## Актуальные источники истины

| Область | Канонический источник |
| --- | --- |
| Product / `FR-*` / `NFR-*` | [`PRD`](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md) |
| Stable capabilities | [`SPEC`](../_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md) |
| Архитектурные инварианты | [`Architecture Spine`](../_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md) |
| Delivery slices и traceability | [`Epics and stories`](../_bmad-output/planning-artifacts/epics.md) |
| Правила для будущих agents | [`Project context`](../_bmad-output/project-context.md) |
| Текущая авторизация | [`Implementation readiness`](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-04-final-recheck.md) и [factual update](../_bmad-output/planning-artifacts/implementation-readiness-post-assessment-update-2026-08-04.md) |
| Временный root POC scope | [`W-POC-2026-08-04`](../_bmad-output/planning-artifacts/root-phone-poc-waiver-2026-08-04.md) — не production/release authorization |

### Обязательные companions SPEC

- [`Glossary`](../_bmad-output/specs/spec-interiors-editor-alpha/glossary.md) —
  единый язык домена.
- [`Geometry contract`](../_bmad-output/specs/spec-interiors-editor-alpha/geometry-contract.md)
  — планарная геометрия и topology invariants.
- [`Asset import contract`](../_bmad-output/specs/spec-interiors-editor-alpha/asset-import-contract.md)
  — GLB preflight и metadata.
- [`Performance budgets`](../_bmad-output/specs/spec-interiors-editor-alpha/performance-budgets.md)
  — mobile budgets и evidence protocol.
- [`Project and backup contract`](../_bmad-output/specs/spec-interiors-editor-alpha/project-and-backup-contract.md)
  — durable revisions, history, recovery и backup.
- [`Catalog Control Plane contract`](../_bmad-output/specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md)
  — граница Kotlin/PostgreSQL perimeter.
- [`UX DESIGN`](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md)
  и [`UX EXPERIENCE`](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md)
  — visual и interaction contracts.

## Локальная навигация

- [`BMAD integration`](BMAD-INTEGRATION.md) — operating rules и lifecycle.
- [`Git governance`](GIT-GOVERNANCE.md) — worktree, ownership и commit rules.
- [`Repository overview`](../README.md) — краткий текущий статус и planned
  root delivery.
- [`Phone editor POC`](poc/README.md) — локальный walkthrough и проверки для
  ограниченного W-POC-2026-08-04.
- [`POC handoff evidence`](../_bmad-output/planning-artifacts/evidence/poc/phone-editor-poc-handoff-2026-08-04.md)
  — воспроизводимый snapshot, пока ожидающий owner review.

## Правило delivery layout

Финальный продукт — единая доставка из корня репозитория, не S-* прототип.
Production source, manifests, build configuration, tests и runtime assets
принадлежат planned root delivery (`apps/web` и
`apps/catalog-control-plane` внутри корня). Создавать или изменять evidence
spike можно только в точных путях, названных waiver `W-SPK-2026-08-04`:
имя `S-*` само по себе не даёт авторизации. Такие experiments никогда не
переносятся копированием кода.

Внутренний [`_bmad-output index`](../_bmad-output/INDEX.md) остаётся
историческим provenance-каталогом. Физически переносить его документы в
`docs/` можно только после утверждённых path mapping, ownership и
authority-switch с проверкой всех ссылок и стабильных ID.
