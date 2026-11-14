---
title: "InteriorsEditor — Sprint Change Proposal: узкий spike waiver и reconciliation readiness"
date: 2026-08-04
project: InteriorsEditor
workflow: bmad-correct-course
mode: Batch
decision: Direct Adjustment
status: applied-documentation-only
approval:
  product_owner: Roman
  standing_written_authorization:
    - "Я подтверждаю реализацию по всей документации"
    - "Я полностью всё подтверждаю, не спрашивай меня каждый раз, просто делай, что должен"
supersedes_for_clarification_only:
  - sprint-change-proposal-2026-08-04.md
does_not_modify_historical_record: true
---

# Sprint Change Proposal — waiver границы и reconciliation readiness

## 1. Trigger, issue и режим

После исправления backlog структура readiness всё ещё содержала два опасных
drift-а: `G-READY` смешивал production readiness с возможным spike waiver, а
`QG-0` не делал `S-6` обязательным Alpha evidence gate. Одновременно в
историческом proposal ошибочно назван отсутствующим существующий implementation
plan. Это могло либо преждевременно открыть feature implementation, либо
зафиксировать ложный documentation blocker.

Выбран **Direct Adjustment** в batch mode. Он создаёт строго ограниченный
`W-SPK-2026-08-04`, исправляет только planning gates/quality/ownership и не
меняет PRD-owned `FR/NFR`, SPEC-owned `CAP`, Architecture-owned `AD` или UX.

## 2. Checklist impact analysis

| Checklist area | Status | Finding / resolution |
| --- | --- | --- |
| 1. Trigger and evidence | [x] Done | `NOT READY` readiness, existing gate ambiguity and verified path inspection are concrete evidence. |
| 2. Epic impact | [x] Done | `G-READY` is narrowed; new `G-SPIKE-W-001` is added and unlocks no V Story. |
| 3. Artifact conflicts | [x] Done | `epics.md`, `quality-strategy.md`, roadmap and implementation plan need reconciliation; PRD/SPEC/Architecture/UX do not. |
| 4. Direct adjustment | [x] Viable | Low documentation effort, high prevention value; no rollback or MVP reduction is needed. |
| 5. Handoff | [!] Action-needed | Architecture-owned ADR/register reconciliation is routed as formal follow-up, not fabricated here. |
| 6. Approval | [x] Done | Roman's standing written authorization is recorded in frontmatter; no interactive menu pause is used. |

## 3. Applied change set

| Artifact | Old state | Direct adjustment | Rationale |
| --- | --- | --- | --- |
| `epics.md` | `G-READY` accepted an unspecified waiver alternative | `G-READY` now requires only final official BMAD `READY`; it unlocks the production bootstrap/V-01+ boundary only with their own gates | A waiver must never silently act as release readiness. |
| `epics.md` | no dedicated experimental-only gate | `G-SPIKE-W-001` names the active waiver, exact `W-SPK-2026-08-04` paths and a zero-V-story unlock | Evidence work stays disposable and cannot become feature work. |
| `epics.md` | implementation/evidence owners were implicit | a 5-spike/20-slice ownership and independent-review registry is added | Every future work item has an explicit assignment slot without inventing people. |
| `quality-strategy.md` | QG-0 required S-1–S-4 but not S-6 | QG-0 requires S-6 `PASS`, `ADR-006`, versioned manifest, full human-approved grant, ledger/notices, corpus and device traces | Catalog provenance/portability is an Alpha blocker, not a later optional check. |
| roadmap and implementation plan | broad `READY or waiver` wording could be read as a production exception | both now distinguish final `READY` for bootstrap/`V-*` from the evidence-only W-SPK waiver | No current planning document gives a waiver a product-delivery meaning. |
| historical proposal | said `_bmad-output/plans/alpha-implementation-plan.md` was missing | historical file remains unchanged; this addendum records the claim as false | Historical records must not be rewritten. |

## 4. Verified implementation-plan link

The current relative link in
`_bmad-output/planning-artifacts/roadmap-to-alpha.md` is
`../../plans/alpha-implementation-plan.md`. Resolved from the roadmap directory,
it is the existing file:

`/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/plans/alpha-implementation-plan.md`

Therefore the roadmap link is **resolved, not missing**. The false historical
caveat remains untouched in `sprint-change-proposal-2026-08-04.md`; the current
epics documentation is corrected to remove the false open finding.

## 5. Waiver security boundary

The complete authoritative boundary is
`spike-only-waiver-2026-08-04.md`. In short, it permits only isolated
prototype source/manifests/tests, synthetic fixtures, Playwright experiment
flows and separately human-approved sample assets under
`_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-{1,2,3,4,6}/`,
with evidence only under `_bmad-output/planning-artifacts/evidence/spikes/S-*/`.

It expressly forbids root source/package/test/build/CI configuration, production
PWA/deployment, V Stories/features, production catalog, real user-data
migration, publishing and commits. It expires at the earliest new official
BMAD readiness verdict = `READY`, terminal status for all five permitted spikes,
or `2026-08-18T23:59:59+03:00`; a `NOT READY`/`NEEDS WORK` recheck does not
terminate it. Any extension needs a new waiver.

## 6. ADR namespace reconciliation — formal follow-up, no fabricated ADR

The following are canonical **planned** paths and names. They are not present
ADRs, and no decision is claimed as adopted by this proposal:

| Spike | Canonical planned ADR path |
| --- | --- |
| S-1 | `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/decisions/ADR-001-renderer-and-react-binding.md` |
| S-2 | `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/decisions/ADR-002-coordinate-and-topology-model.md` |
| S-3 | `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/decisions/ADR-003-persistence-and-recovery.md` |
| S-5 (Alpha+) | `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/decisions/ADR-004-glb-policy-and-budgets.md` |
| S-4 | `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/decisions/ADR-005-mobile-interaction-model.md` |
| S-6 | `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/decisions/ADR-006-catalog-pipeline-and-provenance.md` |

**H-ADR-2026-08-04 (required follow-up):** after terminal spike evidence, run a
fresh `bmad-architecture` update. That owning workflow creates/updates only the
ADR records actually supported by evidence, updates Architecture references and
the decision register as appropriate, and appends the architecture memlog only
through `_bmad/scripts/memlog.py`. This `bmad-correct-course` pass does not edit
`decision-register.md`, Architecture, or any `.memlog.md`; direct editing here
would violate artifact ownership and could fabricate an ADR.

## 7. Handoff and remaining blockers

| Recipient / owner | Required next result | Still blocks |
| --- | --- | --- |
| Product Owner Roman | assign an accountable owner and an independent reviewer before each work package starts | every unassigned spike/slice remains `NOT ENTERED` |
| Human AssetUsageGrant approver — `PENDING`, cannot be AI-assigned | full S-6 grant for any claimed catalog asset and subresource | S-6 `PASS`, catalog/PNG/backup claims |
| Physical-device evidence owner — unassigned | NFR-15 traces on the required physical contexts | S-1/S-3/S-4/S-6 final evidence and Alpha claim |
| `bmad-architecture` owner/workflow | evidence-backed ADR-001/002/003/005/006 and register reconciliation | dependent adopted architectural decisions |
| Independent `bmad-check-implementation-readiness` workflow | fresh official verdict after this adjustment | `G-READY`; no production bootstrap or V Story before `READY` |

The waiver does not waive `G-1` user research, physical real-device evidence,
human `AssetUsageGrant`, or final readiness.

## 8. Completion record

This correction changes documentation only. No application code, package,
test, configuration, asset, deployment artifact, prototype directory or commit
was created by this workflow. The terminal handoff remains an independent
readiness recheck; its verdict is not pre-decided by this waiver.
