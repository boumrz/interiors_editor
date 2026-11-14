# Внутренний индекс BMAD provenance

> Curated human-facing navigation starts at
> [`docs/index.md`](../docs/index.md). This file remains an internal historical
> BMAD artifact catalogue and may contain dated snapshot statuses; canonical
> current readiness and source links are listed in that documentation index.

# Индекс продуктовых артефактов

Дата среза: `2026-07-26`.

## Analysis

| Артефакт | Роль | Статус |
| --- | --- | --- |
| [Product Brief](planning-artifacts/briefs/brief-InteriorsEditor-2026-07-26/brief.md) | Короткое стратегическое видение | Draft for owner review |
| [Brief Addendum](planning-artifacts/briefs/brief-InteriorsEditor-2026-07-26/addendum.md) | Гипотезы, границы и контекст | Draft |
| [Рынок и аналоги](planning-artifacts/research/market-landscape-2026-07-26.md) | Конкуренты, JTBD, позиционирование | Research complete |
| [Техническая реализуемость](planning-artifacts/research/technical-feasibility-2026-07-26.md) | 3D/PWA/geometry/import feasibility | Research complete |
| [Агентная модель и skills](planning-artifacts/research/agent-system-and-skills-2026-07-26.md) | Single/multi-agent и инструментарий | Research complete |

## Planning

| Артефакт | Роль | Статус |
| --- | --- | --- |
| [PRD](planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md) | Пользователи, journeys, `FR-*`, `NFR-*`, scope | Draft for owner review |
| [PRD Addendum](planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/addendum.md) | Технические гипотезы и варианты | Draft |
| [DESIGN.md](planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md) | Визуальная система и токены | Partial; brand decision pending |
| [EXPERIENCE.md](planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md) | IA, gestures, states, flows, accessibility | Draft for usability validation |
| [Roadmap до alpha](planning-artifacts/roadmap-to-alpha.md) | Gate-based последовательность продукта | Draft |
| [Decision Register](planning-artifacts/decision-register.md) | Принятые, предлагаемые, spike и deferred решения | Active |
| [Traceability Matrix](planning-artifacts/traceability-matrix.md) | `CAP → FR/NFR → slice → evidence` | Draft |
| [Quality Strategy](planning-artifacts/quality-strategy.md) | Тесты, устройства, performance evidence | Draft |
| [Risk Register](planning-artifacts/risk-register.md) | Риски, сигналы и способы снижения | Active |

## Canonical SDD contract

| Артефакт | Роль |
| --- | --- |
| [SPEC.md](specs/spec-interiors-editor-alpha/SPEC.md) | Каноническое ядро `Why / CAP / Constraints / Non-goals / Success` |
| [Glossary](specs/spec-interiors-editor-alpha/glossary.md) | Единый язык домена |
| [Geometry Contract](specs/spec-interiors-editor-alpha/geometry-contract.md) | Геометрия, топология и инварианты |
| [Asset Import Contract](specs/spec-interiors-editor-alpha/asset-import-contract.md) | GLB preflight и asset metadata |
| [Performance Budgets](specs/spec-interiors-editor-alpha/performance-budgets.md) | Измеримые мобильные бюджеты |
| [Project & Backup Contract](specs/spec-interiors-editor-alpha/project-and-backup-contract.md) | Project limits, History/GC, resource recovery, license notices и самодостаточный `.interiors` |

`SPEC.md` является производным артефактом и обновляется только workflow `bmad-spec`; его `.memlog.md` — каноническая append-only память.

## Solutioning

| Артефакт | Роль | Статус |
| --- | --- | --- |
| [Architecture Spine](planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md) | Инварианты `AD-*` | Partial pending spikes |
| [Solution Design](planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/solution-design.md) | Развёрнутая техническая картина | Draft |
| [Domain Model](planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/domain-model.md) | Сущности, команды и state model | Draft |
| [Architecture Review Disposition](planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/reviews/review-disposition.md) | Сводка трёх независимых review и остаточных gates | `CONCERNS` |
| [Vertical Slice Plan](../plans/alpha-implementation-plan.md) | Будущий план работ по observable value | Active plan, implementation not started |
| [Readiness Precheck](planning-artifacts/implementation-readiness-precheck-2026-07-26.md) | Предварительный gate | `CONCERNS` |
| [Document Validation Report](planning-artifacts/document-validation-report-2026-07-26.md) | Lint, links, IDs, trace и финальный consistency-аудит | `PASS` по структуре, не readiness |

Финальные BMAD epics/stories намеренно не создавались: официальный workflow требует интерактивного подтверждения PRD, UX и архитектуры. После решений владельца нужно запустить `bmad-create-epics-and-stories`, затем `bmad-check-implementation-readiness`.

## Long-term project knowledge

- [BMAD Integration Guide](../docs/BMAD-INTEGRATION.md)
- [Project Context](project-context.md)
- [Project Agent Rules](../AGENTS.md)
