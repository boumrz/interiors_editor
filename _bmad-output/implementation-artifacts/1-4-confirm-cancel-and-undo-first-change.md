---
baseline_commit: NO_VCS
---

# Story 1.4: Подтвердить, отменить или вернуть первую правку Project

Status: done

## Story

Как пользователь, я хочу безопасно подтвердить, отменить или вернуть первую
правку Project, чтобы дальнейшее рисование комнаты не стало первым местом, где
приложение учится обращаться с моими данными.

## Acceptance Criteria

1. Неподтверждённая или отменённая правка остаётся preview: Durable Revision,
   autosave и session History не меняются; cancel доступен через DOM-control.
2. Подтверждённая valid Command показывает `saving` до successful atomic
   publication и создаёт ровно одну Durable Revision и HistoryEntry после неё.
3. После первой Durable правки undo, затем redo возвращают canonical Project
   между точными Durable Revision; renderer/UI не являются источником истины.
4. До mutation/publication `SessionRetentionPolicy` отклоняет превышение
   history entry/resource envelope с `PROJECT_HISTORY_RESOURCE_LIMIT`, не
   меняя current, undo/redo, revision records, manifests или GC roots.
5. Validation/persistence reject оставляет prior Durable Revision и History
   доступными и даёт safe retry/cancel explanation без partial history entry.

## Tasks / Subtasks

- [x] Сделать `RenameProject` первой undoable durable-правкой (AC: 1–3, 5)
  - [x] RED: добавить controller/browser доказательства cancel → no revision/
        history и rename → durable undo → durable redo.
  - [x] GREEN: после успешной CAS/pointer publication маршрутизировать rename
        через существующий `completeForwardPublication`; stale/persist failure
        не очищают и не создают history.
  - [x] Запустить focused, full unit/browser/PWA, typecheck, lint, build и
        required mutation evidence.
- [x] Ввести общий `SessionRetentionPolicy` admission для **каждой** mutation
      (AC: 4)
  - [x] Не публиковать candidate, пока объединение current/undo/redo/prospective
        Revision resource roots не проходит policy; не удалять redo до publish.
  - [x] Добавить stable reason, UI explanation и tests для entry/bytes limits.
- [x] Завершить общую Cancel/invalid/persistence UX и evidence (AC: 1, 5)
  - [x] Проверить DOM/touch parity, retry/recovery and visible history boundary.
  - [x] При `PROJECT_HISTORY_RESOURCE_LIMIT` не предлагать бесполезный retry:
        UI объясняет сохранность durable Project и предлагает explicit reopen
        для новой session-history boundary.
  - [x] Провести независимый review Increment A: successful rename, stale-base
        и persistence failure не получают или не теряют session history.
  - [x] Добавить `SC-V01` evidence; не выдавать browser emulation за
        physical-device certification.

## Dev Notes

### Increment A scope

- This increment owns only the first task: the existing rename form cancel is
  a local preview reset and must remain controller-free; successful rename must
  acquire an undo entry only after its `publishNextRevision` result is durable.
- Reuse `ProjectController.completeForwardPublication` and existing durable
  `undo`/`redo` travel. Do not create a parallel History store, serialize a UI
  action, or change `RenameProject` CAS semantics.
- `acceptRenameStatus` currently special-cases successful rename and deliberately
  bypasses history. Its stale-base and persist-failed paths must preserve the
  prior durable candidate and the existing stacks.
- `SessionRetentionPolicy`, resource GC roots and history-only repair are
  intentionally deferred from Increment A. Increment B now applies the shared
  publication-boundary admission seam to every production mutation use case;
  AC 4 is complete, but do not mark Story 1.4 done until its remaining
  cancel/invalid/persistence UX evidence is complete.
- No new dependency, remote storage, PWA worker, catalog, backup policy,
  migration, writer-takeover, geometry change or renderer state belongs here.

### Relevant source files

- `apps/web/src/app/project-controller.ts` — session stacks, publication and
  the rename status adapter.
- `apps/web/src/app/project-controller.test.ts` — controller behavior through
  durable repository fakes.
- `apps/web/src/ui/AppShell.tsx` and `.test.tsx` — rename draft cancellation
  and accessible undo/redo controls; preserve touch/DOM controls.
- `apps/web/tests/browser/project-e2e.spec.ts` — phone-browser user
  flow; do not replace domain/controller proof with E2E.

### Constraints

- Domain/application retain no React, DOM, renderer, IndexedDB, service-worker
  or network imports. A validated mutation is not saved: only successful atomic
  publication creates a Durable Revision and session history entry.
- Undo/redo are active-session resources only. Reload/open/recovery/import/
  duplicate start a visible boundary. No commit without explicit owner approval.
- Use Node `24.19.0`, pnpm `11.20.0`, Rstest, Playwright, Biome and the
  project mutation harness. Stryker's command-runner result must be treated
  critically; preserve direct RED/GREEN evidence when it cannot observe TS
  mutations.

### References

- [Epic 1 / Story 1.4](../planning-artifacts/epics.md#story-14-подтвердить-отменить-или-вернуть-первую-правку-project)
- [PRD FR-5, FR-38–FR-40](../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md#57-safe-editing-history)
- [SPEC CAP-8](../specs/spec-interiors-editor-alpha/SPEC.md#cap-8-безопасная-история-изменений)
- [Project and Backup contract §1](../specs/spec-interiors-editor-alpha/project-and-backup-contract.md#1-project-limits-policy)
- [Architecture AD-2–AD-4, AD-12](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md)

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- 2026-08-22: Story tracker already marked 1.4 `in-progress`, but had no
  dedicated context file. Existing controller has durable stack travel; rename
  alone intentionally bypasses it. No `SessionRetentionPolicy` exists yet.

### Completion Notes List

- 2026-08-22 Increment A completed: a successful rename now uses the existing
  forward-publication completion path, so its previous Durable Revision enters
  the active session undo stack only after publication is durable. Stale-base
  and persistence-failure paths retain the previous Project and history.
- RED confirmed the former gap (`canUndo: false` after rename); GREEN is covered
  by controller tests for saving → durable rename → undo → redo and stale
  rename, plus phone E2E for rename-draft cancel without a revision and
  rename → undo → redo.
- Independent review found no implementation regression and prompted an added
  proof that stale-base and persistence failure preserve both already-populated
  undo and redo branches.
- Quality: 1,101/1,101 Rstest; TypeScript app/domain checks; Biome (220 files);
  production Rspack build; 90 mobile-browser Playwright and PWA regression all
  passed. Scoped Stryker: 19/21 killed (90.48%); the two surviving mutants are
  the pre-existing writer-lease-loss branch outside this increment.
- 2026-08-22 Increment B completed: `SessionRetentionProjectRepository` gates
  every production `publish` / `publishNextRevision` using immutable
  current+undo+redo+prospective roots. It deduplicates resource hashes,
  conservatively retains a conflicting largest byte length, preserves redo
  until the controller completes a durable branch replacement, and leaves
  create/import/duplicate as explicit new-Project boundaries. A recovery
  candidate is also a root while the Project is read-only, so RecoveryChangeSet
  CAS cannot bypass admission. `PROJECT_HISTORY_RESOURCE_LIMIT` reaches both
  command result and visible UI copy with the explicit close/reopen path.
- Evidence: 1,101/1,101 final Rstest; both TypeScript configs; Biome (220 files); production
  Rspack build; full mobile-browser and PWA Playwright regression passed.
  Focused Stryker for the two new modules killed 50/50 mutants (100%); the
  broad pre-existing 73-file Stryker config was intentionally stopped after
  its successful dry run because its command-runner would take many hours.
- Independent review found one recovery-path bypass, which was fixed and
  re-reviewed clean.
- 2026-08-22: closed the remaining Story 1.4 user-visible evidence: the
  independent review rechecked recovery admission and the explicit
  close/reopen history boundary; `SC-V01` now records cancel → durable rename
  → undo at a 390×664 browser-emulation viewport, explicitly without claiming
  physical-device certification.

### File List

- `_bmad-output/implementation-artifacts/1-4-confirm-cancel-and-undo-first-change.md` (new)
- `apps/web/src/app/project-controller.ts` (modified)
- `apps/web/src/app/project-controller.test.ts` (modified)
- `apps/web/tests/browser/project-e2e.spec.ts` (modified)
- `apps/web/src/application/ports.ts` (modified)
- `apps/web/src/application/session-retention-policy.ts` (new)
- `apps/web/src/application/session-retention-policy.test.ts` (new)
- `apps/web/src/application/session-retention-project-repository.ts` (new)
- `apps/web/src/application/session-retention-project-repository.test.ts` (new)
- `apps/web/src/application/*.ts` (modified: shared failure reason propagation)
- `apps/web/src/app/production-app.ts` (modified)
- `apps/web/src/ui/AppShell.tsx` and `.test.tsx` (modified)
- `apps/web/stryker-session-retention.config.mjs` (new)
- `docs/progress/screenshots/SC-V01-project-history-browser-2026-08-22.md`
  (new; capture stored under `output/playwright/`)

### Change Log

- 2026-08-22: reconstructed Story 1.4 implementation context and split the
  existing scope into the safe rename-history increment and the required later
  general retention admission slice.
- 2026-08-22: completed Increment A — durable rename participates in active
  session undo/redo; cancel, stale and persistence-failure paths remain
  history-safe.
- 2026-08-22: completed Increment B — all production mutation publications,
  including RecoveryChangeSet CAS, pass shared SessionRetentionPolicy admission
  before the durable adapter. The reason and explicit new-history guidance are
  visible to the user; targeted mutation evidence is 100%.
- 2026-08-22: closed Story 1.4 completion evidence with the `SC-V01`
  browser-emulation checkpoint; its text explicitly preserves the separate
  physical-device gate.
- 2026-08-22: independent review is clean and every acceptance task has
  evidence; the story and sprint tracker are therefore marked `done`.
