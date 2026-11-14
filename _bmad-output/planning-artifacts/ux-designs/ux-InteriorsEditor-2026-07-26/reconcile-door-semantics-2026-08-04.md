---
title: "UX reconciliation — Door navigation semantics"
status: complete
date: 2026-08-04
owner_workflow: bmad-ux
sources:
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
---

# UX reconciliation — Door navigation semantics

## Change signal

Утверждённый PRD/SPEC/architecture контракт уточнил, что доступность перехода
через Door определяется topology, а не редактируемым состоянием двери. В
`EXPERIENCE.md` прежняя формулировка «доступной двери» могла быть неверно
прочитана как отдельная Door state-machine.

## Reconciled UX contract

- Только valid Door, разрешённая ровно в две derived Room, даёт один derived
  неориентированный Walk transition в `AdjacencyGraph`.
- Такой target всегда доступен в Walk и объявляет комнату назначения.
- Exterior/invalid Door не даёт target/transition; она не визуализируется как
  locked, closed, disabled либо требующая key/access/open-close action.
- Поправка topology остаётся действием Plan; Walk только пересчитывает
  projection после валидной атомарной правки.
- `WalkTransitionTarget` фиксирует визуальный minimum: `{colors.primary}`
  outline + видимый текст назначения, touch target ≥ `44×44 CSS px`.

## Scope and non-changes

Сохранены уже согласованные Focus и Catalog Control Plane outage/recovery
семантики. Это UX-уточнение не создаёт Door lock/access/open-close feature, не
меняет доменную модель и не является implementation/device evidence.

## Local validation

- Проверена согласованность `EXPERIENCE.md` §5.3, UXF-2, state inventory,
  error/recovery и accessibility floor с PRD `FR-17`/`FR-20`/`FR-24`.
- Проверен `DESIGN.md` component inventory и visual contract
  `WalkTransitionTarget`.
- YAML frontmatter обоих spines и этого reconciliation-note должен оставаться
  parseable; production code, Playwright и physical evidence не затрагивались.
