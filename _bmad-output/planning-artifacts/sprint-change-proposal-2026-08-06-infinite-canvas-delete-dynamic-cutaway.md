---
title: Sprint Change Proposal — Infinite Canvas, Reversible Delete and Dynamic 3D Cutaway
date: 2026-08-06
status: approved-by-standing-product-owner-authorization
mode: batch
scope: moderate-direct-adjustment-blocked-by-readiness-gates
supersedes: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06-interactive-layout-cutaway.md
---

# Sprint Change Proposal — бесконечное полотно, обратимое удаление и динамический 3D cutaway

## 1. Issue Summary

### Trigger and evidence

Владелец продукта сообщил, что текущий editor нельзя использовать как
планировщик: grid ограничен границей макета и требует отдельного действия
«Расширить»; Wall и Item нельзя удалить; 3D всегда убирает одни и те же две
стены вместо сторон, ближних к наблюдателю при текущем угле камеры.

Проверенный current-state evidence:

- 2D grid строится только внутри bounds плана, а UI содержит отдельный control
  расширения;
- `expandOrthogonalGrid({ side, amountMm })` умеет только полную внешнюю
  полосу и не представляет drag/marquee target rectangle;
- Story 2.6 и Story 5.4 уже владеют Wall/Item delete, но находятся в backlog;
- `isWallHiddenForCutaway` сейчас скрывает fixed `max-X/max-Z` walls и не
  получает camera state.

### Classification

Это одновременно **новое уточнение продукта** и **исправление неверной
интеракции прототипа**. Оно не меняет Alpha’s canonical integer-mm PlanGraph,
derived Rooms, local-first durability или rule that renderer objects are
disposable projections.

### Standing approval and working mode

Владелец продукта ранее дал прямое письменное разрешение не останавливать
работу на повторных approval prompts и в этом запросе явно потребовал эти
результаты. Поэтому change-control ведётся в **batch** режиме. Настоящий
документ фиксирует выбранные узкие semantics; замечание владельца может
изменить их последующим change-control. Он **не** является waiver для
`G-READY`, topology, renderer, touch или physical-device gates.

## 2. Checklist and Impact Analysis

| Checklist item | Status | Finding |
|---|---|---|
| 1.1 Trigger | Done | Active 2D slice 2.2 and planned Stories 2.6, 4.2, 5.4 revealed the gaps. |
| 1.2 Core problem | Done | Current controls bind workspace to room bounds and use a static renderer cutaway; required editor behaviour is absent. |
| 1.3 Evidence | Done | Source/UI/test evidence listed above; current rendered app and user feedback corroborate it. |
| 2.1–2.4 Epic impact | Done | Adjust existing Epics 2, 4 and 5. No new technical Epic; no existing Epic becomes obsolete. |
| 2.5 Priority/order | Action-needed | The affected Stories stay after their gates; do not promote prototype code ahead of `G-S2`, `G-S4` or `G-S1`. |
| 3.1 PRD | Done | FR-7/11/12/21–25/30 already contain the user-value boundary; no new FR ID is needed. |
| 3.2 Architecture | Action-needed | `PlanProjectionPort` and renderer boundary remain valid, but topology and renderer gate evidence must prove the selected algorithms. |
| 3.3 UX | Action-needed | Add exact infinite-canvas/marquee/delete/cutaway flows and DOM/numeric alternatives. |
| 3.4 Secondary artifacts | Action-needed | Update domain/golden/property corpus and Playwright test plan only after gate entry; screenshot checkpoints remain supplementary. |
| 4.1 Direct adjustment | Viable | Medium implementation scope but high evidence risk; uses existing Epics and invariants. |
| 4.2 Rollback | Not viable | Removing the prototype does not decide geometry/cutaway semantics and would not close gates. |
| 4.3 PRD MVP review | Not viable | These are core editor behaviours, not candidates for silent Alpha deferral. |
| 4.4 Selected path | Done | Direct bounded adjustment, gated by existing S-1/S-2/S-4 evidence. |

## 3. Chosen Product Semantics

### 3.1 Infinite presentation canvas and rectangular draft

1. **No model “expansion” exists.** The Plan canvas is an infinite presentation
   surface around the current PlanGraph. It renders an adaptive visual grid in
   the visible viewport during pan/zoom; grid extents, camera position and
   marquee are transient and never stored in a Project/Revision.
2. The old separately labelled **«Расширить»** action is removed. A user may
   draw a constrained Wall anywhere on the visible canvas under the existing
   `PlanProjectionPort` contract.
3. The new named **«Прямоугольная комната»** tool is not an “expand” button.
   Dragging from an origin to a second point previews a dotted, axis-aligned
   rectangle on the canvas. Numeric entry offers the same origin, width and
   depth route. It creates one candidate rectangular wall loop in integer mm.
4. The rectangle may be detached or share complete endpoints/edges with the
   existing PlanGraph. Exact contacts are normalized by the normal topology
   contract. Partial collinear overlap, self-intersection, unsupported
   diagonal/connection and invalid/ambiguous face outcomes are rejected with a
   reason, no mutation and a path to draw Walls individually.
5. The rectangle is **not** a mutable grid cell or an implicit resize of an
   existing Room. It is a single previewed topology command. Cancel, stale
   base, lost writer fence or rejected geometry produces no Command, Revision,
   History entry or autosave change. Valid confirmation uses the normal fresh
   validation/durability path and remains undoable.

This chosen boundary gives the requested draw.io-like free workspace and a
dotted target rectangle without inventing a second grid geometry model or
silently claiming support for arbitrary partial-overlap topology.

### 3.2 Wall deletion

After selecting a Wall, the contextual action surface contains **«Удалить
стену»**; the selected-object list supplies the same action without a canvas
gesture. Before commit it previews affected Rooms, Openings and hosted Items.
An ordinary valid deletion is confirmed as exactly one reversible Durable
command; it performs fresh base/writer-fence revalidation. Cancel, stale,
invalid or conflict outcome leaves the current Durable Revision intact. An
unresolvable Opening/host effect uses the existing explicit conflict route.

### 3.3 Item deletion

After selecting an ItemInstance in Plan, 3D or the accessible list, the action
surface contains **«Удалить предмет»**. It makes exactly one reversible Durable
command and is restored through undo/redo; it is not an irreversible confirm
dialog. The resource manifest and current/undo/redo GC roots change only via
the normal complete publish/retention policy. A locked Item requires explicit
unlock before delete.

### 3.4 Camera-relative 3D cutaway

In 3D Edit, cutaway is a pure renderer projection state, never domain data.
For each exterior Wall side the renderer derives the outward normal and the
camera-to-plan-centre direction. It hides a near exterior side when their dot
product crosses the enter threshold and restores it only after a lower exit
threshold (hysteresis). Thus near walls disappear and far/exterior and all
interior walls remain visible; rotating around the model recomputes this result
without mutation. The exact threshold/precision and camera-inside fallback are
chosen and evidenced by `G-S1-renderer`; cutaway defaults to Auto and an
accessible **«Показать все стены»** view control remains available.

Context loss/recovery rebuilds the same projection from canonical Revision and
current transient camera state. Camera orbit, cutaway and view preset do not
create Command, Revision, History or saved renderer state.

## 4. Detailed Change Proposals

### 4.1 Epic 2 / Story 2.2 and Story 2.6

**OLD:** Story 2.2 describes one constrained Wall; Story 2.6 describes delete
preview only at a generic level. The implementation proposal mentions a finite
grid outer-strip expansion.

**NEW:**

- Story 2.2 gains an infinite presentation canvas and `Прямоугольная комната`
  draft acceptance criteria from §3.1, including numeric/list alternative and
  planned `PLAN-E2E-03`.
- Story 2.6 gains the selected-Wall/list affordance and the complete affected
  Room/Opening/Item-host preview, fresh revalidation and undo/redo criteria
  from §3.2; its corpus/e2e ID is `PLAN-E2E-04`.
- The former outer-strip-only prototype is expressly not the user-facing
  definition of expansion.

**Trace:** CAP-2, CAP-3, CAP-8; FR-7, FR-8, FR-11–FR-13, FR-38–FR-40;
NFR-1–NFR-5, NFR-17–NFR-20, NFR-26; EV-03, EV-04, EV-06, EV-13, EV-17.

### 4.2 Epic 4 / Story 4.2

**OLD:** Story 4.2 supports camera orbit/pan/zoom and Room-surface selection;
the prototype hard-codes two omitted walls.

**NEW:** Story 4.2 gains the camera-relative exterior cutaway contract from
§3.4: pure classifier, far/interior retention, threshold/hysteresis, Auto and
Show-All view control, context-recovery recomputation, no domain mutation and
`CUTAWAY-E2E-01` plus renderer/golden camera-sector evidence.

**Trace:** CAP-5, CAP-11; FR-21–FR-25; NFR-5, NFR-8, NFR-9, NFR-14,
NFR-16–NFR-20, NFR-26; EV-05, EV-12, EV-13, EV-17.

### 4.3 Epic 5 / Story 5.4

**OLD:** Story 5.4 states that an Item can be deleted through undo but does not
name the interaction/control or manifest-root outcome.

**NEW:** Story 5.4 gains the selected-Item action and resource/history
semantics from §3.3, with `ITEM-E2E-03` and domain/repository tests for
current/undo/redo root consistency.

**Trace:** CAP-6, CAP-8; FR-29, FR-30, FR-38–FR-40; NFR-1, NFR-3–NFR-5,
NFR-17–NFR-20, NFR-26; EV-06, EV-11, EV-12, EV-13, EV-17.

### 4.4 UX and architecture updates

- `EXPERIENCE.md`: add the Plan canvas/free-workspace flow, rectangle-draft,
  deletion states and dynamic cutaway/view control; make every critical action
  reachable through DOM/list/numeric alternatives.
- `DESIGN.md`: replace the phrase that desktop authoring is supported with the
  Alpha phone-first scope; document dotted preview and view-control states.
- Architecture/renderer evidence: retain AD-5’s disposable projection rule;
  amend/adopt the renderer decision only once `G-S1-renderer` can support the
  selected camera-relative classifier.
- Geometry companion: re-derive through `bmad-spec` only after S-2 evidence
  validates the rectangular-loop/topology semantics. No ad-hoc second model is
  permitted.

## 5. Implementation Handoff and Evidence

### Scope classification

**Moderate direct adjustment, blocked.** The change stays within existing
user-value Epics 2, 4 and 5, but implementation cannot begin while `G-READY`,
`G-S2-topology`, `G-S4-touch` and `G-S1-renderer` are unpassed.

### Handoff roles

| Role | Responsibility |
|---|---|
| Product Owner (Roman) | Owns the stated product outcome and may correct the bounded rectangle semantics. |
| Product/UX owner | Incorporates §4.1–4.4 into canonical Epic/UX artifacts after evidence scope is accepted. |
| Geometry evidence owner + independent reviewer | Produces/assesses `G-S2-topology` corpus before 2D topology work. |
| Renderer evidence owner + independent reviewer | Produces/assesses `G-S1-renderer` decision and cutaway/camera recovery evidence. |
| Touch evidence owner + independent reviewer | Validates mobile gestures, alternatives and accessibility for `G-S4-touch`. |
| Implementation owner | After formal READY, executes a single gated vertical slice with TDD, Rstest, Playwright and screenshot checkpoints. |

### Success criteria after lawful gate entry

1. Unit/golden/property corpus proves rectangular candidate validation,
   cancellation/no-mutation, exact contacts, deletion consequences and
   camera-sector/hysteresis classification.
2. Playwright mobile flows cover free pan/zoom grid, rectangle draft/confirm/
   cancel/reject, delete Wall, delete Item and rotate dynamic cutaway.
3. Rstest, lint, type check, build, required mutation checks and Playwright are
   green for the actual slice.
4. `SC-V05`, `SC-V10` and `SC-V03` screenshots show a **real running** build;
   browser emulation is labelled as such and is not represented as physical
   iPhone/Samsung evidence.
5. Release claims wait for the separate NFR-15/V-18/V-19/V-20 device,
   accessibility/privacy and independent-rehearsal evidence.

## 6. Final Review

The change does not reduce Alpha scope, require a new Epic or authorize an
implementation bypass. It replaces an unsafe prototype interpretation with a
testable, bounded direction. `sprint-status.yaml` receives no status mutation:
no new Story ID is created and existing Stories remain gated/backlog according
to their canonical execution conditions.

**Workflow completion:** the issue, impact, selected path, concrete before →
after proposals and handoff are recorded. The Product Owner’s direct request
and standing instruction to proceed without repeated prompts are the recorded
approval for this batch proposal.
