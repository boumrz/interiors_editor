---
baseline_commit: NO_VCS
---

# Story 3.4: Сохранить либо безопасно изменить Opening при правке Wall

Status: done

## Story

Как пользователь,
я хочу переместить, изменить или удалить Opening и видеть последствия изменения
его Wall до сохранения,
чтобы не оставить в проекте повреждённую ссылку или невозможный проём.

## Minimal Alpha Acceptance Criteria

1. Existing Door/Window открывает cancellable draft для width, height,
   sill/threshold и Door swing side. Offset меняется прямым touch handle только
   вдоль текущего stable host. Invalid input и cancel не создают Revision,
   History или autosave; valid confirm публикует одну обратимую Durable command.
2. Поддерживаемый Wall split однозначно сохраняет Opening на lineage-compatible
   successor и пересчитывает internal offset. Если split пересекает Opening,
   либо host Wall удаляется, до mutation показывается `ConflictPreview` с точным
   affected Opening и явными delete/cancel outcomes; orphan или silent rehost
   невозможны.
3. Понижение `Room.heightMm`, нарушающее min adjacent host height, показывает
   отдельный conflict preview для каждого affected Opening. Пользователь явно
   выбирает допустимый resize или delete для каждого проёма либо отменяет весь
   candidate; Room-поля заморожены до завершения preview.
4. Confirm повторно проверяет fresh base Revision, writer fence, topology,
   host interval и height policy и только затем публикует Room/Wall/Opening как
   один complete candidate. Cancel, stale base, lock loss, invalid resolution
   и persistence failure не оставляют partial effect.
5. Plan и disposable 3D строят Door/Window из одной canonical Revision.
   Alpha не вводит cross-wall arbitrary drag/rehome, navigation edge, access,
   lock/key или open-close state: поддерживаемый host либо однозначно сохраняется,
   либо пользователь получает явный conflict outcome.
6. Browser evidence объединяет direct Opening edit/delete, Wall split preserve,
   Wall split/delete conflict re-entry и Room-height resize/delete/cancel flow.

## Tasks / Subtasks

- [x] Дать existing Door/Window один cancellable numeric draft и direct offset
      handle без промежуточной Durable mutation.
- [x] Сохранить Opening и stable host lineage при однозначном Wall split.
- [x] Показать точный delete/cancel preview при пересечении split или удалении
      host Wall.
- [x] Провести снижение Room height через allocation-free Opening preview.
- [x] Добавить phone-first resize/delete/cancel re-entry и заморозить исходный
      candidate на время выбора.
- [x] Подтвердить fresh revalidation, atomic publish, reload и Plan/3D projection
      через mobile-browser E2E и внешний tunnel.

## Review Findings

- [x] [Review][Test] Прямое touch-перемещение Door и смена swing side
      проверяли лишь визуальный статус сохранения. `PLAN-E2E-04B` теперь
      доказывает, что cancel не создаёт Revision, а handle move, смена swing
      side и подтверждённая правка создают ровно по одной Durable Revision.
- [x] [Review][AC-1] Inline width input и кнопка смены Door swing side в
      inspector публиковали Durable-команды до confirm и обходили cancellable
      draft. Inspector теперь показывает эти свойства только для чтения и
      открывает единый draft; `PLAN-E2E-04B` доказывает, что cancel не меняет
      ни ширину, ни swing side, а один confirm публикует их вместе.

## Dev Notes

- Trace: `CAP-4`, `CAP-8`; `FR-19`; cross-cutting `FR-10`, `FR-11`, `FR-38`,
  `FR-39`, `FR-40`; `NFR-1`, `NFR-3`, `NFR-4`, `NFR-26`; `AD-1`, `AD-3`,
  `AD-6`, `AD-7`, `AD-12`, `AD-19`; `V-07`; `RECONCILIATION-E2E-01`.
- Minimal Alpha relocation policy does not expose arbitrary cross-wall rehome.
  Supported topology routes preserve the only valid lineage host; ambiguous or
  destructive routes remain explicit resize/delete/cancel conflict outcomes.
- `Room.heightMm` remains the sole editable room-height source. Opening fit uses
  the lower adjacent Room height, while Wall render height remains derived from
  the higher adjacent Room.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Cumulative Story 3.4 behavior now
  covers direct Door/Window resize and deletion, touch offset movement,
  unambiguous split preservation, split-through/delete-host conflict re-entry
  and Room-height reconciliation without ever materializing an orphaned
  Opening.
- Added the missing phone UI for Room-height conflicts to the existing
  `UpdateRoomProperties` preview/resolve use case. The dialog lists each exact
  affected Opening and requires resize or delete for every item before confirm.
  Cancel restores prior durable fields; confirm revalidates and publishes the
  Room plus all Opening resolutions in one revision. While preview is open,
  name/type/height are disabled so the visible candidate cannot diverge from
  the candidate being confirmed.
- `RECONCILIATION-E2E-01R` uses a Window with 900-mm sill: lowering the Room
  from 2600 to 2000 mm offers exact height 1100 mm, proves preview/cancel create
  no revision, then proves resize and a later delete each create exactly one
  atomic revision. A manual `height - sill` → `height + sill` mutant was rejected
  by the canonical domain and killed by the E2E; production arithmetic was
  restored before the green run.
- Final local evidence: 1339/1339 Rstest, 249-file Biome lint, both TypeScript
  configs, production build and 5/5 production PWA E2E. The related iPhone-13
  browser corpus covers
  `EDITOR-E2E-02Y`, `PLAN-E2E-04Z`, `PLAN-E2E-04AA`,
  `RECONCILIATION-E2E-01`, `ROOM-E2E-01` and `RECONCILIATION-E2E-01R` through
  the external tunnel. Two legacy 3D assertions now allow 15 seconds for the
  Cloudflare-served lazy chunk after traces showed the correct loading state.
- **Review evidence — 2026-08-28.** Strengthened `PLAN-E2E-04B` to count
  Durable Revisions across the direct Door paths: cancelling a draft leaves
  the count unchanged; the touch handle, swing-side change and submitted
  width each add exactly one. The focused phone browser run passes (1/1).
- **AC-1 review patch — 2026-08-28.** Removed the direct durable inspector
  routes for Door width and swing side. Those values remain visible in the
  inspector but may change only in the cancellable Opening draft; the focused
  browser corpus covers cancel and the single combined durable confirmation.

### File List

- `_bmad-output/implementation-artifacts/3-4-preserve-or-safely-change-opening-after-wall-edit.md`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/application/general-wall-project-mutations.ts`
- `apps/web/src/application/general-wall-project-mutations.test.ts`
- `apps/web/src/application/update-room-properties.ts`
- `apps/web/src/application/update-room-properties.test.ts`
- `apps/web/src/domain/general-wall-project.ts`
- `apps/web/src/domain/general-wall-project.test.ts`
- `apps/web/src/domain/update-room-properties.ts`
- `apps/web/src/domain/update-room-properties.test.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.module.css`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-28: Independent final acceptance accepted all six Minimal Alpha AC.
  The remediated Opening and Room-height publish paths use exact-base CAS and
  return `stale-base` without a Durable Revision or History entry. Evidence is
  1,590/1,590 Rstest, 61/61 scoped mutation kills, Biome lint, both TypeScript
  configurations, production build, 154 passed mobile-browser scenarios (one
  environment-skipped live-catalog test) and 5/5 production-PWA scenarios.
  Physical-device and release gates remain separate and are not claimed here.
- 2026-08-28: Added revision-cardinality assertions to direct Door edit
  evidence; Story remains in `review` pending independent final acceptance.
- 2026-08-28: Closed the AC-1 review finding by routing all durable Opening
  property changes through its cancellable draft; direct touch offset remains
  the supported exception.
- 2026-08-26: Completed the minimal Alpha Opening reconciliation surface,
  froze Room candidate fields during conflict re-entry and moved Story 3.4 to
  `review`.
