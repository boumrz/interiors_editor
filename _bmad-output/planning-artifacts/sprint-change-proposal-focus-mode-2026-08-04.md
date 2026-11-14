---
title: "InteriorsEditor — Sprint Change Proposal: phone Focus mode"
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
  new_requirement: "должна быть возможность открыть редактор на весь экран телефона, чтобы ничего не мешалось при проектировании"
---

# Sprint Change Proposal — phone Focus mode

## 1. Trigger и граница решения

Product Owner добавил обязательный phone-first сценарий: редактор должен
отдавать проектированию максимум доступного экрана. Проверка первичных
platform sources показала, что нативный Fullscreen API зависит от capability,
direct user activation и решения user agent, а standalone PWA не даёт
безусловной гарантии отсутствия system/browser UI. Поэтому утверждённый
продуктовый результат — всегда доступный in-app Focus с progressive native
enhancement, а не ложное compatibility promise.

Это **Direct Adjustment** требований, UX, SPEC и backlog. Он не меняет
каноническую геометрию, Durable Revision, writer fencing, storage policy или
архитектурные `AD-*`. Никакая часть adjustment не даёт production bootstrap
до final BMAD `READY` и не расширяет `W-SPK-2026-08-04`.

## 2. Принятый контракт

1. Focus — временная AppShell/UI-раскладка для Plan, 3D и Walk: он скрывает
   только некритичные in-app панели и не создаёт Command, Revision, history
   entry, persisted mutation или writer-lease change.
2. Явный labelled exit, truthful durable/error/recovery status, mode/tool и
   применимые cancel/undo/redo остаются достижимыми в safe usable viewport;
   blocking recovery/confirmation/error имеет приоритет.
3. Native fullscreen вызывается только в том же direct user action после
   probe. Rejection, unsupported path и external user-agent exit сохраняют
   usable in-app Focus; standalone PWA используется когда доступна, но не
   обещает контроль browser/system chrome.
4. Playwright обязателен после каждого изменения для controlled success,
   rejection/unsupported, external exit, preserved state, safe-area/
   VisualViewport/keyboard и accessibility rails. Он не заменяет восемь
   physical `NFR-15` rows, RS-2 или thermal evidence.

## 3. Applied source-of-truth changes

| Owner | Artifact | Adjustment |
| --- | --- | --- |
| PRD | `prds/prd-InteriorsEditor-2026-07-26/prd.md` | `FR-53`, `NFR-27` и восемь manual Focus rows в `NFR-15`; primary-source boundary. |
| UX | `ux-designs/ux-InteriorsEditor-2026-07-26/{DESIGN,EXPERIENCE}.md` | Focus control/overlay, six states, UXF-7, safe viewport and accessibility contract. |
| SPEC | `spec-interiors-editor-alpha/{SPEC,glossary,performance-budgets}.md` | Existing CAP-5/CAP-9/CAP-11 trace; no new CAP and no compatibility claim. |
| Epics | `epics.md` | `V-08-Focus` / Story 4.5 and `V-15-Focus` / Story 8.11 with named Playwright and physical evidence. |
| Traceability | `traceability-matrix.md` | `FR-53`/`NFR-27`/`UXF-7`, Focus slices and `EV-18` mapped; coverage is `53/53` FR and `27/27` NFR, still planned rather than implementation proof. |
| Change control | roadmap, quality strategy and alpha implementation plan | This proposal reconciles ordering, release gates and quality checks below. |

## 4. Roadmap, quality и execution impact

- `V-08-Focus` enters after usable Plan/3D/Walk and is limited to in-app Focus
  plus browser E2E; it does not certify native fullscreen.
- `V-15-Focus` enters only after the PWA slice and gathers browser/standalone
  behavior plus the eight physical Focus rows. It cannot make the release
  matrix PASS by itself.
- The same Focus states are added to PWA, accessibility, device and quality
  gates. Any missing Focus E2E or physical row is `PAUSED` evidence, not a
  workaround.
- Architecture update remains deferred to the formal evidence-backed
  `bmad-architecture` handoff in the existing waiver/change-control package;
  this proposal does not invent `AD-15` or an ADR before the supporting
  platform evidence exists.

## 5. Non-resolution and next gates

This change does not resolve `G-1` user research, S-1/S-2/S-3/S-4/S-6 spike
evidence, physical-device availability, human AssetUsageGrant or final
readiness. In particular, the independently reviewed S-2 and S-3 prototypes
still require further evidence; no Focus work may treat their green local tests
as a dependency waiver.

The next permitted implementation action remains an isolated, assigned,
reviewed spike under its existing waiver boundary or a future `V-*` only after
official `READY`. No application source, package, test configuration, PWA,
deployment artifact or commit is created by this documentation adjustment.
