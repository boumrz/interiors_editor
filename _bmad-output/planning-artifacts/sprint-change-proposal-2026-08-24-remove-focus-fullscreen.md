---
document_title: "Sprint Change Proposal — удаление Focus и native fullscreen"
status: approved
date: 2026-08-24
owner: Roman
mode: batch
approval: "Product Owner explicitly approved the complete removal of Focus/fullscreen and documentation synchronization in chat on 2026-08-24."
sources:
  - specs/spec-interiors-editor-alpha/SPEC.md
  - planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
  - planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - planning-artifacts/epics.md
  - planning-artifacts/roadmap-to-alpha.md
  - planning-artifacts/traceability-matrix.md
  - planning-artifacts/quality-strategy.md
  - implementation-artifacts/sprint-status.yaml
---

# Sprint Change Proposal — удаление Focus и native fullscreen

## Решение

Из Alpha полностью исключаются in-app Focus, native fullscreen и все
специальные viewport/fullscreen controls, state, acceptance criteria, E2E и
physical-evidence rows. Обычный phone-first Plan/3D editor остаётся единственной
раскладкой редактора. Это не изменение Project schema, geometry, persistence,
PWA install/update, обычных accessibility требований или device-performance
matrix.

## Причина и доказательство

Product Owner 2026-08-24 подтвердил, что Focus/fullscreen нужно удалить
полностью. На момент решения production code и sprint tracker уже не содержали
входа в Focus/fullscreen, но SPEC, PRD, Architecture Spine, UX, roadmap и
quality gates продолжали требовать эту функцию. Это создавало два несовместимых
определения Alpha и ложный release blocker.

## Impact analysis

| Область | Корректировка |
| --- | --- |
| Capability/requirements | `CAP-5`, `CAP-9` и `CAP-11` сохраняют 2D/3D, PWA и performance; `FR-53` и `NFR-27` retired и не переиспользуются. |
| Architecture | `AD-15` retired; другие `AD-*` не перенумеровываются. AD-16, CAP map и testing boundary больше не ссылаются на Focus. |
| UX | Удаляются `FocusModeControl`, Focus state/flow, fullscreen fallback и связанные accessibility/viewport criteria. Обычный AppShell сохраняет safe-area, keyboard, 44×44 targets и DOM alternatives. |
| Delivery plan | Story `4.5` и Story `8.11` retired; `V-03-Focus` и `V-15-Focus` удалены. Восьмиконтекстная NFR-15 matrix, startup, interaction, thermal и context-recovery evidence остаются. |
| Implementation/evidence | Код уже не содержит Focus/fullscreen controls. Historical readiness/review/evidence records не переписываются; их claims остаются датированными историческими данными. |

## Chosen path

**Direct adjustment / moderate scope correction.** Rollback других completed
vertical slices не нужен: удаляется изолированный UI-only feature и его
evidence, а Plan/3D/PWA semantics продолжают действовать. Риск —
документационный drift; он закрывается одной approved proposal и синхронным
обновлением current sources of truth.

## Implementation handoff and success criteria

1. `bmad-spec` append-only фиксирует решение и re-derives SPEC/его spec-owned
   companions без изменения стабильных `CAP-*`.
2. PRD, Architecture, UX, epics, roadmap, traceability, quality strategy,
   project context и sprint tracker исключают active Focus/fullscreen scope.
3. `FR-53`, `NFR-27`, `AD-15`, stories `4.5`/`8.11` и slices
   `V-03-Focus`/`V-15-Focus` остаются только retired identifiers, не
   переиспользуются и не блокируют Alpha.
4. Восьмиконтекстная NFR-15 device matrix остаётся обязательной для
   WebGL2/startup/interaction/thermal/context-recovery; fullscreen-specific
   manual rows удаляются.
5. Active source inventory не содержит Focus/fullscreen как действующую
   функцию или acceptance gate; исторические artifacts явно остаются вне
   current-source audit.

## Checklist disposition

- [x] Trigger/context: explicit Product Owner scope decision, 2026-08-24.
- [x] Epic impact: Epic 4 and Epic 8 retire only their Focus stories; no new
  epic, dependency or resequencing is required.
- [x] Artifact impact: current PRD, SPEC, Architecture, UX, roadmap,
  traceability, quality strategy, project context and tracker require sync.
- [x] Path evaluation: direct adjustment is low technical risk and avoids
  rollback; broad MVP replan is not needed.
- [x] Approval: Product Owner approval is recorded in this document.
- [x] Handoff: document owners perform the synchronized update; no code,
  external evidence or commit is authorized by this proposal.
