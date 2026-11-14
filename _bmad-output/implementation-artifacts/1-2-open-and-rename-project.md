---
baseline_commit: NO_VCS
---

# Story 1.2: Найти, открыть и переименовать свой Project

Status: done

## Authority, dependency and delivery boundary

**Execution authorization.** Product Owner Roman wrote in this task on
2026-08-05: «Я, владелец продукта, разрешаю начать production‑реализацию до
BMAD READY; недостающие evidence‑gates закрыть в процессе.» This explicit
waiver permits this production slice, but does **not** turn `G-READY`,
`G-V01-S3`, `G-WEB-AD16`, Kotlin/PostgreSQL `G-CP-ADR`, any physical NFR-15
row, or release readiness into PASS claims.

This context may be prepared while Story 1.1 is in independent review, but
**implementation may start only after Story 1.1 has left `review` with its
post-remediation result independently accepted.** That review was accepted on
2026-08-22 and Story 1.1 is `done`: its P0/P1 remediation publishes a pointer
and removes matching staging in one transaction, maps a dangling pointer to
recovery rather than empty, and has final local quality evidence. The 1.2
owner must re-read that accepted review record before editing; do not recreate
or silently absorb its remediation as unrelated work.

This is the next vertical slice in the same root-owned production app. It must
not import, adapt, serve, re-export, copy or use `src/poc/**`, `tests/poc/**`,
`docs/poc/**`, `S-*` sources, prototype configurations, fixture data or
generated POC artefacts. It creates neither `apps/catalog-control-plane` nor a
remote Project API, account, telemetry, sync, PWA worker, asset/blob policy,
backup/import, Trash, duplicate, writer takeover, geometry or renderer.

## Story

Как пользователь,
я хочу видеть свои локальные Projects, открыть нужный и изменить его название,
чтобы быстро вернуться к правильному варианту планировки.

## Trace and scope

- Product: `CAP-1`; `FR-2`; `NFR-3`, `NFR-18`, `NFR-21`, `NFR-24`, `NFR-26`.
- Architecture: `AD-2`, `AD-3`, `AD-4`, `AD-12`; V-01.
- UX: `UX-DR1`, `UX-DR4`, `UX-DR6`, `UX-DR7`, `UX-DR21`.
- Required browser regression added by this story: `PROJECT-E2E-02`.
- User-visible checkpoint: `SC-V01-ProjectList` — running production UI only,
  at the mobile-browser-emulation viewport. It is feedback, not a device,
  PWA, offline, accessibility, storage-safety or NFR-15 certification.
- Deferred intact: explicit draft confirmation/cancel, session History and
  undo/redo (Story 1.4); writer lease/takeover (Story 1.3); duplicate/Trash
  (Epic 8); Portable Backup/import; PWA installation/update; catalogue and
  all backend work.

## Acceptance Criteria

1. **Truthful local Project list.**

   **Given** the browser-local repository is opening,
   **when** the Projects surface renders,
   **then** it exposes a non-colour, accessible `loading` state until the
   query has a result, and afterwards distinguishes all four required
   outcomes:

   - `first-run` / empty: no readable active Durable Project and no detected
     corruption;
   - `populated`: one or more readable active Durable Projects;
   - `corrupted`: a stored pointer/current Revision fails required read,
     checksum or structural validation; it must never become a synthetic empty
     Project;
   - a populated list may retain readable cards while separately announcing a
     non-sensitive corruption/recovery issue for an unreadable record.

   **And** list data is a deterministic projection of *current Durable
   Revisions* only: `projectId`, durable display name, `updatedAt` and current
   `revisionId`. It contains no Project JSON, user paths, checksums, raw
   exception, asset bytes, account data or UI/renderer state. Order readable
   cards by `updatedAt` descending, then opaque `projectId` ascending, so the
   mobile UI and its tests have no browser-record-order dependency.

   **And** every readable card has labelled DOM actions `Открыть <имя>` and
   `Переименовать <имя>` (or an equivalent visible Russian label with the same
   accessible name); neither action depends on hover, a context menu or a
   precision gesture. Controls remain at least 44×44 CSS px and retain the
   existing `AppShell` textual durable/error status path.

2. **Open exactly the selected Durable Revision.**

   **Given** a readable card in the populated list,
   **when** the user chooses its explicit open action,
   **then** application code asks `ProjectRepositoryPort` for that exact
   `ProjectId` and obtains its current Durable Revision after validating the
   pointer, canonical serialized Project and checksum,
   **and** the existing post-create Project surface displays the selected
   Project name and Revision ID without creating a Revision, changing another
   Project, or treating UI state as canonical Project data.

   **Given** an identifier is absent, its current pointer is dangling, its
   record/revision cannot deserialize, its Project identity/schema mismatches,
   or its checksum is invalid,
   **when** the user opens or lists it,
   **then** it has a recoverable `corrupted`/`recovery-needed` outcome with a
   stable non-sensitive reason code (retain the existing
   `PERSISTENCE_CORRUPT` family unless an accepted source-owned registry says
   otherwise), never an empty or newly created Project,
   **and** healthy Projects remain openable. No repair, delete, migration,
   implicit re-save, remote fetch or information-revealing diagnostic is
   attempted in this story.

3. **Rename is one fenced Durable Revision, never a clone.**

   **Given** an opened readable Project and a non-empty supplied name,
   **when** the user explicitly submits `Сохранить название`,
   **then** a pure application `RenameProject` path reuses the existing
   `validateProjectName` policy, preserves the opaque `ProjectId`, `createdAt`,
   one Level and every untouched canonical field, and changes only the
   canonical `name` and injected `updatedAt` before serializing a new candidate
   Revision with a new opaque `RevisionId`.

   **And** the command/candidate carries the selected `projectId` and the
   current `baseRevisionId`. Publication follows the already-established
   `PendingDurability` path — staging write, checksum + deserialize validation,
   then one atomic pointer compare-and-swap/publication — and labels the new
   name `saved` only after that operation succeeds. A stale base is rejected;
   silent last-writer-wins is forbidden even before Story 1.3 supplies the
   complete multi-context takeover UX.

   **Given** blank/whitespace input, validation rejection, stale base,
   staging/checksum/pointer failure or an interrupted persistence boundary,
   **when** the rename attempt finishes or the app reopens,
   **then** the former Durable name/current Revision remains visible and
   readable, the proposed name is not mislabelled as saved, the user receives
   a field-associated explanation plus safe retry/back action, and no second
   Project, cloned data, partial Revision, history entry or silent mutation is
   created.

   Story 1.2 provides the named `RenameProject` Command/use-case and its
   durable boundary, but does **not** claim the full reusable
   Confirm/Cancel/Undo/Redo/session-History product behavior. Story 1.4 owns
   that interaction and history substrate. The implementation must therefore
   leave a small, typed `baseRevisionId`/publication seam for 1.3/1.4 instead
   of inventing a parallel direct UI-to-IndexedDB write route.

4. **Phone-first, accessible navigation and editing.**

   **Given** first-run, populated, selected, renaming, saving, persist-failed
   or corrupted/recovery-needed state on a 360 CSS-px portrait viewport,
   **when** the user navigates between the Projects surface and the selected
   Project surface,
   **then** there is a labelled way back to `Проекты`, a visible primary
   `Новый проект` path only where it is truthful, and a non-modal/accessible
   rename field or dialog with explicit Save and Cancel/Back controls.

   **And** focus moves to the Project-list heading after returning, to the
   rename heading/field when editing, and to a field-associated alert after
   validation failure; the active input and confirmation remain usable under
   mobile keyboard/visual-viewport changes. Preserve the existing first-use
   local-storage/mm explanation and dismissible/reopenable tips.

   **And** component/page styling remains CSS Modules; global CSS stays a
   reset, tokens and AppShell-wide platform constraints. Reuse/align the
   source UX tokens and existing AppShell affordances rather than adding a
   second visual system or replacing the shell wholesale.

5. **TDD evidence, browser proof and no false claims.**

   **Given** implementation begins after the accepted Story 1.1 gate,
   **when** every code change is made,
   **then** it follows RED → GREEN → REFACTOR and leaves the pinned root Biome
   lint, typecheck, Rstest, Rspack build, Playwright and production mutation
   command green. Biome `2.5.7` is the TypeScript-7-compatible static lint
   harness; do not replace it or change the toolchain in this feature slice.

   **And** DOM-free Rstest tests cover: deterministic summary order; empty,
   loaded, mixed-readable/corrupt and corrupt-only query outcomes; exact
   Project selection; project-name trim/reject; rename preservation of opaque
   ID and untouched Project fields; newly injected timestamp/revision ID;
   base-revision rejection; `saving → saved` ordering; publication failure;
   restart/recovery with the prior Durable Revision; and the invariant that
   cleanup never deletes a Revision referenced by the current pointer.

   **And** adapter contract tests use a multi-Project fake/store, exercising
   `list`, `load(projectId)`, pointer compare-and-swap and deliberately
   dangling/checksum-invalid records. They prove `empty` is returned only when
   there is genuinely no pointer and no corruption, and that a failed rename
   leaves the prior Durable Revision intact. Browser tests complement rather
   than replace these port/domain tests.

   **And** Playwright `PROJECT-E2E-02` uses a clean persistent mobile-browser
   profile to create two locally stored Projects through visible controls,
   return to `Проекты`, open each by its card, rename one, observe saving before
   the durable name, reload/reopen, and verify the same opaque Project ID has
   the new name while the other Project remains distinct. It additionally uses
   a controlled production test seam to prove a failed rename does not change
   the old durable card/name and a corrupt/dangling record is visible as a
   recovery state, not an empty list. It must observe no external Project
   request. Browser emulation remains labelled as such.

   **And** after the user-visible result, capture and send
   `SC-V01-ProjectList` from the actually running app (scenario, build/revision
   and emulated viewport recorded alongside it) without stopping follow-on
   work. It does not certify physical iPhone/Samsung, installed PWA, native
   performance/thermal behavior or release readiness.

## Tasks / Subtasks

- [x] Preflight the accepted previous slice (AC: all)
  - [x] Confirm Story 1.1 is `done`, read its independent review/remediation
        and re-read every UPDATE file below. Do not start code work while the
        predecessor remains in `review` or its pointer/recovery bug is open.
  - [x] Verify the W-POC archive remains non-runtime and production imports do
        not reference POC/S-* paths.
- [x] Specify pure projections and the rename candidate with RED tests (AC: 1–3)
  - [x] Add domain/application tests before implementation for summary order,
        selected current Revision, pure rename, current/base identity and all
        reject/persist-failure outcomes.
  - [ ] Keep DOM, React, IndexedDB, renderer, service worker and network out
        of `src/domain` and `src/application`.
- [x] Extend the local repository through application-owned ports (AC: 1–3)
  - [x] Add typed list/load-by-`ProjectId`/publish-next-revision operations;
        use the current pointer transaction to compare expected base Revision
        and atomically publish the new pointer.
  - [ ] Preserve recovery semantics from 1.1; never remove a staged/current
        Revision merely because cleanup is retried after pointer publication.
  - [ ] Do not add writer-takeover UI, a remote adapter, backup, migration,
        duplicate, Trash or blobs.
- [x] Compose the Projects and rename experience (AC: 1–4)
  - [x] Extend `ProjectController`/composition root, never let React call an
        IndexedDB adapter directly.
  - [ ] Add the projects list, selected-project return path and accessible
        rename surface using CSS Modules, status text and mobile controls.
  - [ ] Preserve first-create/retry/recover behavior established by Story 1.1.
- [x] Prove the complete observable behavior (AC: 5)
  - [x] Add `PROJECT-E2E-02`, use production-only controlled seams and
        persistent profiles; do not reuse POC browser tests or fixtures.
  - [x] Run frozen-lock install, typecheck, Rstest, Rspack build, Playwright
        and scoped mutation tests with the pinned Node/pnpm launcher. Inspect
        results; record exact counts and any unavailable lint harness without
        calling it green.
  - [x] Capture and send the running `SC-V01-ProjectList` checkpoint and
        update this story's Dev Agent Record only with observed evidence.

## Developer guardrails

- **Existing production code is UPDATE, not a template to bypass.** Read
  `project-controller.ts`, `production-app.ts`, `ports.ts`,
  `durable-project-repository.ts`, `indexeddb-versioned-project-store.ts`,
  `publication-fault-controller.ts`, `AppShell.tsx` and their tests completely
  before changing them. Story 1.1 already owns first creation, the first-run
  UI, current repository recovery and the test/config root; preserve those
  behaviors while extending them.
- **Single durable truth.** `Project`/`Revision` are canonical. List cards,
  selected Project, form text, saving/status values and React state are
  projections. A validated rename is not saved until checksum and atomic
  pointer publication succeed. No UI value, pointer event, temporary form
  state, `ChangeSet` or inverse is independently durable.
- **No hidden data loss.** Never turn a dangling/corrupt record into an empty
  state, overwrite it by creating a new Project, clear a current Revision as
  staging cleanup, overwrite the old name after a failed attempt, or drop a
  readable Project because another record is corrupt. Error UI has a stable,
  localizable reason and a safe path; it exposes no raw storage exception,
  local path, Project JSON or user content.
- **Fencing is a seam, not a Story 1.3 claim.** Rename must reject a stale
  `baseRevisionId`; it must not implement `writerLeases`, claim multi-context
  protection or introduce last-write-wins. Story 1.3 will provide explicit
  writer ownership/takeover and can extend the same typed publication port.
- **History is not portable and is not faked.** Do not store an independent
  ChangeSet/inverse, add a fake undo button or call a rename history complete.
  Story 1.4 owns complete user confirmation/cancel/History behavior; preserve
  a small named Rename command/use-case and durable base for it to use.
- **Bounded privacy/local-first scope.** No fetch/API client, account,
  telemetry, remote Project data, Kotlin endpoint, PostgreSQL schema, Catalog
  Gateway, asset pin, OPFS/Blob decision, PWA worker or network requirement.
  Browser and Home Screen remain different local contexts; do not promise
  transfer without later Portable Backup stories.
- **Names and contracts.** Code identifiers use English glossary terms;
  localized Russian UI owns wording. IDs remain opaque strings from `IdPort`;
  timestamps come from `ClockPort`; schemaVersion stays explicit; reason codes
  are discriminated/stable. Do not invent geometry, room, asset or backend
  semantics in this slice.
- **Evidence boundary.** Rstest covers domain/application/adapter seams;
  Playwright proves browser behavior. Neither the screenshot nor browser
  emulation proves real-device performance, PWA/offline certification or the
  remaining readiness gates.

## Required file layout

Production modifications stay inside the unified root. Expected paths (the
accepted Story 1.1 review may alter exact names, but not the layer boundary):

```text
apps/web/
  src/
    domain/
      project.ts                         # UPDATE only if values need an explicit summary-safe type
      project-name-policy.ts             # UPDATE/reuse; no duplicate name validator
      rename-project.ts                  # NEW pure canonical rename policy
    application/
      ports.ts                           # UPDATE: typed list/load/publish-next ports
      rename-project.ts                  # NEW RenameProject use case / candidate creation
    adapters/persistence/
      durable-project-repository.ts      # UPDATE: query, CAS publication and safe recovery
      indexeddb-versioned-project-store.ts # UPDATE: all current pointers, exact lookup/CAS
      publication-fault-controller.ts    # UPDATE only for controlled production test seams
    app/
      project-controller.ts              # UPDATE: list/open/rename screen orchestration
      production-app.ts                  # UPDATE: compose the extended ports
    ui/
      AppShell.tsx                       # UPDATE: Projects/list/rename screens
      AppShell.module.css                # UPDATE: CSS-Module styles for the touched UI
  tests/browser/
    project-e2e.spec.ts                  # UPDATE with PROJECT-E2E-02, or add a focused sibling
  src/**/**/*.test.ts                    # NEW/UPDATE colocated Rstest coverage
docs/progress/
  WEB-PROJECT-LIFECYCLE-02-2026-08-05.md # NEW observed evidence only
  screenshots/
    SC-V01-project-list-mobile-browser-2026-08-05.{md,png} # NEW real running checkpoint
```

Do not create production modules under `S-*`, `_bmad-output`, `docs/poc`,
`src/poc`, `tests/poc`, a new repository or `apps/catalog-control-plane`. Do
not alter the root lockfile/dependency versions, Rspack/Rstest/Playwright
configuration, runtime pin scripts or package manager merely for this feature;
an unpinned lint/library/toolchain addition is out of scope.

## Previous-story intelligence and current implementation facts

- Story 1.1 is the first production implementation, currently recorded as
  `review` pending independent re-acceptance; it replaced the POC runtime only
  after a non-runtime, SHA-verified POC closure archive. It has no Git baseline
  (`main` has no commits and the tree is untracked), so there is no commit
  history to infer a different pattern from.
- Its production source is already React `19.2.8` + TypeScript `7.0.2` +
  Rspack `2.1.8`, Rstest `0.11.5` with the Rspack adapter and Playwright
  `1.62.1` and Biome `2.5.7`; run it via Node `24.19.0` / pnpm `11.20.0`
  exactly as exposed by root scripts. Its post-remediation gate produced lint,
  14/14 Rstest, 3/3 Playwright and 46/46 killed production mutants; rerun, do
  not inherit those counts as evidence for 1.2.
- Existing `ProjectController.open()` asks only `loadCurrent()` and renders one
  saved Project; it cannot list or select by ID. The current IndexedDB adapter
  reads the first `projects` record (`getAll()[0]`) and therefore cannot be
  reused unchanged for a multi-Project list/open implementation. Move all such
  work behind application-owned repository operations.
- The initial persistence review found a pointer/staging crash window and a
  dangling-pointer-as-empty defect. Story 1.1 remediated both before this
  context was refreshed: pointer/staging is one transaction and a dangling
  pointer is recovery-needed. Independent re-acceptance remains a hard
  prerequisite; 1.2 tests must preserve those repaired semantics in the
  multi-Project paths.
- Existing creation is DOM-free through `CreateProjectUseCase`, `ClockPort`,
  `IdPort`, canonical serializer/checksum and `ProjectRepositoryPort`; name
  validation already trims and emits `PROJECT_NAME_REQUIRED`. Reuse these seams
  rather than adding React-local validation or browser adapter calls in the UI.
- Story 1.1 selected Biome `2.5.7`. The quality command is the pinned root
  `pnpm run verify` (lint → typecheck → Rstest → Rspack build → Playwright →
  mutation); use the documented `npx --yes --package=node@24.19.0
  --package=pnpm@11.20.0` launcher for all commands.

## Technical and test guidance

- Model a summary as a query projection, not a second persisted canonical
  Project representation. Repository metadata may index display name/current
  revision for lookup, but `open(projectId)` validates the actual referenced
  revision and canonical serialized Project before declaring it Durable.
- Use an application-owned `ProjectRepositoryPort` operation for the complete
  candidate, expected base Revision and result. The concrete IndexedDB adapter
  is the only place that opens transactions/uses `window`; `domain` and
  `application` continue to compile under `tsconfig.domain.json` without DOM
  libraries.
- A user submit is the explicit confirmation for this bounded name-only
  command. Save controls must be disabled/labelled while `PendingDurability`;
  failure preserves the input/candidate only for the existing retry/recovery
  path and never lets a second mutation start. Do not substitute a debounced
  autosave for publication.
- Make test fixtures deterministic with fake IDs, clocks, checksums and a
  multi-record memory store. Browser corruption/failure proof must use the
  existing production-only `__INTERIORS_TEST_SEAM__` pattern, gated out of the
  production build; no hidden network/test endpoint is allowed.
- Keep production mutation scope focused on the expanded pure
  `src/domain/**/*.ts` and `src/application/**/*.ts`; add tests that kill
  name, base-revision, ordering and failure-path mutants rather than lowering
  thresholds or excluding new source.

## References

- [Epic 1 / Story 1.2](../planning-artifacts/epics.md#story-12-найти-открыть-и-переименовать-свой-project)
- [PRD FR-2](../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md#51-local-project-lifecycle)
- [PRD NFR-3, NFR-18, NFR-21, NFR-24 and NFR-26](../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md#6-cross-cutting-non-functional-requirements)
- [SPEC CAP-1 and constraints](../specs/spec-interiors-editor-alpha/SPEC.md#capabilities)
- [Project/Backup durable publication and recovery contract](../specs/spec-interiors-editor-alpha/project-and-backup-contract.md)
- [Glossary: Project, Revision, PendingDurability and Durable Revision](../specs/spec-interiors-editor-alpha/glossary.md)
- [Architecture AD-2, AD-3, AD-4 and AD-12](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md)
- [Architecture Domain Model: RenameProject, CommandEnvelope and Revision/History](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/domain-model.md#4-commands)
- [Architecture solution design: state and persistence](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/solution-design.md#6-state-model)
- [UX information architecture, AppShell and mobile layout](../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md)
- [UX screen inventory, storage/error and accessibility states](../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md)
- [Project Context](../project-context.md)
- [Story 1.1 implementation and review precondition](1-1-bootstrap-web-root-and-durable-project.md)
- Official [Rstest Rspack adapter guide](https://rstest.rs/guide/integration/rspack) — retain one shared Rspack-facing test configuration.
- Official [IndexedDB API specification](https://w3c.github.io/IndexedDB/) — records/indexes and transactions support local deterministic query/publish operations; application safety still comes from the project-level validation and pointer protocol above.

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- 2026-08-15: Product Owner confirmed the base editor on real Samsung S24
  Ultra and iPhone hardware. This begins the local-project lifecycle slice
  under the active implementation/readiness waivers; it is product feedback,
  not independent NFR-15 or installed-PWA evidence.
- Fresh `bmad-create-story` workflow, 2026-08-05.
- Read the canonical SPEC and project/backup companion, PRD, Architecture
  Spine/companions, UX, project context, complete Epic 1 and all current Story
  1.1 production source/test/configuration paths.
- Checked Git intelligence: repository has no commits and zero tracked files;
  no historical production diff is available.
- Read current official Rstest/Rspack and IndexedDB documentation; no new
  library or version is selected by this story.
- Story 1.1 P0/P1 remediation passed its local gate; independent re-acceptance
  remains the execution precondition and is not marked complete.
- 2026-08-22 — re-read the accepted Story 1.1 post-remediation record after
  its status moved to `done`; a production source scan found no POC/S-* runtime
  imports. Re-ran 1,091/1,091 Rstest tests, Biome lint, TypeScript, Rspack
  production build, 89/89 mobile-browser E2E and 3/3 production-PWA E2E.
  Captured the required fresh-profile directory checkpoint from the production
  build at iPhone-13 browser emulation. This is evidence for review, not a
  release or physical-device claim.
- 2026-08-22 — independent review initially found five HIGH findings: implicit
  durable repair on open, missing v1 structural validation, out-of-order card
  opening, missing focus targets, and incomplete `PROJECT-E2E-02` proof.
  RED tests were added first; remediation then passed 1,093/1,093 Rstest,
  Biome lint, TypeScript, 91/91 mobile-browser E2E, 3/3 production-PWA E2E
  and a second independent acceptance review (97 focused unit, 4/4
  `PROJECT-E2E-02`).
- 2026-08-22 — scoped Stryker completed with 330 killed / 641 total mutations
  (51.48%). The command exited successfully and restored its source backup,
  but 311 surviving mutations in the pre-existing broad JSON-transfer module
  remain a test-strength debt; this record does not describe that score as a
  strong mutation-coverage claim.
- 2026-08-15 — RED→GREEN evidence: `rename-project` began with missing-module
  failures; repository CAS began with `publishNextRevision is not a function`;
  controller began with `controller.renameProject is not a function`; browser
  lifecycle began without a labelled rename action. All are now covered.
- 2026-08-15 — observed quality gate: Biome 2.5.7 (157 files), TypeScript
  runtime + production/domain type checks, Rstest 904/904, Rspack production
  build, and Playwright/PWA suites passed locally. The generic full Stryker
  command mutates 12,625 unrelated variants and was stopped before completion.
  A focused in-place rerun with `maxTestRunnerReuse=1` killed 9/9 domain and
  27/27 application rename mutants; the intermediate reuse-0 command-runner
  result (0/36) is rejected as cache-invalid evidence.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Product Owner’s explicit production waiver is recorded without converting any
  remaining evidence gate to PASS.
- Story 1.2 is ready for implementation planning, but its code execution is
  deliberately fenced by accepted Story 1.1 post-remediation review.
- Implemented a deterministic local Project directory, exact selected revision
  opening, and a fenced exact-base rename publication. A stale base or failed
  publication preserves the prior Durable name and never creates a clone.
- Added mobile-accessible labelled list actions, current Project identity,
  explicit rename Save/Cancel controls, and `PROJECT-E2E-02` coverage for two
  independent Projects and a durable rename. The predecessor review and
  running checkpoint are now recorded; the story moved to independent review.
- Removed an unsafe legacy open-time Room reconciliation path: opening a card
  now renders only its exact current Durable Revision and does not publish a
  repair. A monotonic request token preserves the last user-selected card
  under racing loads. Persisted v1 records receive structural validation before
  becoming a list card; accessible focus reaches the project heading after
  return and the associated rename error after validation failure. Browser
  proof now reopens renamed cards with their same opaque IDs and retains
  healthy cards beside a dangling pointer. Independent re-review accepted all
  five original HIGH findings, so Story 1.2 is done.

### File List

- `_bmad-output/implementation-artifacts/1-2-open-and-rename-project.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/src/application/ports.ts`
- `apps/web/src/domain/project-json-transfer.ts`
- `apps/web/src/domain/rename-project.ts`
- `apps/web/src/domain/rename-project.test.ts`
- `apps/web/src/application/rename-project.ts`
- `apps/web/src/application/rename-project.test.ts`
- `apps/web/src/adapters/persistence/durable-project-repository.ts`
- `apps/web/src/adapters/persistence/durable-project-repository.test.ts`
- `apps/web/src/adapters/persistence/indexeddb-versioned-project-store.ts`
- `apps/web/src/adapters/persistence/fenced-project-repository.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/app/production-app.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.module.css`
- `apps/web/tests/browser/project-e2e.spec.ts`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `docs/progress/screenshots/SC-V01-project-list-mobile-browser-2026-08-22.{md,png}`

### Change Log

- 2026-08-05 — Created Story 1.2 implementation context; no application code,
  build configuration, test, dependency or runtime artifact was changed.
- 2026-08-15 — Implemented local Project directory, exact selected opening and
  atomic exact-base renaming; recorded observed local automated evidence and
  the still-open mutation/checkpoint evidence boundary.
- 2026-08-22 — Accepted the Story 1.1 predecessor review, recorded the
  production directory checkpoint and moved Story 1.2 to independent review.
- 2026-08-22 — Remediated and independently re-accepted five Story 1.2 HIGH
  findings; marked done with updated regression evidence and an explicit
  mutation-coverage debt.
