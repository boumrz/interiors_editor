---
title: Sprint Change Proposal — Alpha governance, Portable Backup baseline and procedural greyboxes
date: 2026-08-06
status: approved-by-product-owner-standing-authorization
mode: batch
scope: moderate-direct-adjustment-with-deferred-external-evidence
---

# Sprint Change Proposal — ownership, backup и greybox Alpha

## 1. Trigger and evidence

Владелец продукта уточнил, что Роман Желтов единолично принимает все
проектные решения; внешние 3D-catalog assets пока не нужны, а первая
используемая Alpha должна работать на собственных простых геометрических
placeholder. Реальные наблюдения с пользователями должны начаться после
feature-complete внутренней Alpha.

Триггер затрагивает два ранее открытых product phase blockers PRD:
самодостаточный Portable Backup/limits/reminder и catalog licensing/provenance
ownership. Существующий `project-and-backup-contract.md` уже задаёт
provisional, проверяемые limits; отсутствие решения было не отсутствием
технической модели, а отсутствием owner approval.

## 2. Checklist and impact

| Item | Status | Outcome |
|---|---|---|
| 1.1–1.3 Trigger / evidence | Done | Product owner statement and the canonical backup contract are sufficient. |
| 2.1–2.5 Epic impact | Done | Epics 5, 6 and 8 retain their external-catalog paths; no Epic is removed or reordered. The procedural set is an internal Alpha fixture, not a replacement catalog Epic. |
| 3.1 PRD | Done | Resolve the two product decisions; keep external evidence gates explicit. |
| 3.2 Architecture | Done | No change to local-first/catalog boundary; procedural placeholders remain domain/renderer projections, not catalog bytes. |
| 3.3 UX | Done | Existing Parametric Placeholder path is the Alpha initial content. Catalog, notices and resource-recovery UX stay deferred until external assets enter scope. |
| 3.4 Evidence | Action-needed | `G-1`, S-1/S-2/S-3/S-4/S-6 and physical device evidence remain open; their independence requirements cannot be waived by one owner. |
| 4.1 Direct adjustment | Viable | Moderate documentation and fixture adjustment, low code coupling, medium delivery risk until evidence closes. |
| 4.2 Rollback | Not viable | No completed user-value slice needs rollback. |
| 4.3 MVP review | Viable only as an internal-alpha sequencing decision | External catalog and public-release claims are deferred; core plan/3D editing remains in scope. |
| 4.4 Selected path | Done | Direct adjustment plus a written implementation waiver and deferred external evidence. |

## 3. Approved decisions

1. **Backup:** `.interiors` is the self-contained ZIP-shaped Portable Backup
   defined by `project-and-backup-contract.md`. The current provisional table
   is the implementation baseline: its warning thresholds trigger a visible,
   non-blocking reminder; hard thresholds reject with stable reason codes.
   There is no silent trimming and no URL-only backup. Changes require device
   evidence and a new owner decision.
2. **Accountability:** Roman Zheltov is the sole accountable decision maker for
   Alpha Product, UX, Architecture, Asset/Provenance, research and operational
   priorities. This decision records governance; it does not falsely label a
   self-review as independent evidence or confer rights to third-party assets.
3. **Initial content:** the internal Alpha may provide code-authored
   procedural greyboxes for table, chair, bed, door, walls, floor, window,
   bedside table, dresser and wardrobe. They are Parametric Placeholder style
   content, not a remote or third-party asset catalog. No external source
   model/texture is included, pinned or exported as catalog bytes.
4. **Research:** representative consent-backed UJ-1–UJ-6 sessions move after
   feature-complete internal Alpha. They remain mandatory before a formal
   `READY`/public Alpha claim; browser tests and screenshots remain only
   supplementary regression evidence.

## 4. Artifact changes and handoff

- **PRD:** records the four decisions and removes the product-decision
  questions from the phase-blocker list.
- **Project context and waiver:** record that procedural greyboxes are allowed
  implementation content and reiterate the independent-evidence boundary.
- **Developer:** implements greyboxes only through the existing parametric
  item/renderer boundaries; no Catalog Control Plane or third-party asset
  dependency is introduced.
- **Roman:** later supplies or appoints independent reviewers/participants and
  device-lab access when the product reaches feature-complete internal Alpha.

## 5. Success criteria

1. The running editor can create and render the listed procedural items
   without network or third-party asset files.
2. The `.interiors` implementation follows the adopted contract rather than
   silently choosing different limits or external references.
3. Formal readiness is re-run only after genuine independent research,
   evidence packages and physical-device traces exist.

## 6. Approval and workflow completion

The Product Owner’s standing written authorization plus the explicit statements
in this conversation approve this batch proposal. Scope is **moderate direct
adjustment**. The development handoff is active; no commit is authorized.
