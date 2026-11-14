---
baseline_commit: NO_VCS
---

# Story 1.1: Инициализировать единый web-root и создать Durable Project

Status: done

## Authority and delivery boundary

**Execution authorization.** Product Owner Roman wrote in this task on
2026-08-05: «Я, владелец продукта, разрешаю начать production‑реализацию до
BMAD READY; недостающие evidence‑gates закрыть в процессе.» This is the
explicit production waiver for this story. It permits the production work
below, but does **not** claim `G-READY`, `G-V01-S3`, `G-WEB-AD16`, any
physical-device NFR-15 row, or release readiness as passed. The implementation
must record the outstanding evidence honestly and close it through its normal
owner/review path.

This is the first production vertical slice in the single repository root.
It replaces the runtime entry surface of the retired POC only after a
controlled POC closure/archive step; it must not copy, import, re-export,
symlink, serve, or adapt POC or `S-*` prototype source, tests, configuration,
bundles, fixtures, lockfiles, or generated artefacts as production code.

## Story

As a person opening the application for the first time,
I want to create a locally stored Project with a name and immediately see that
its initial revision is saved,
so that I can begin planning without an account and without losing my work at
the first close/reopen boundary.

## Trace and scope

- Product: `CAP-1`; `FR-1`, `FR-5`; `NFR-3`, `NFR-10`, `NFR-11`, `NFR-24`,
  `NFR-26`.
- Architecture: `AD-2`, `AD-3`, `AD-4`, `AD-12`, `AD-16`; V-01.
- UX: `UX-DR1`, `UX-DR2`, `UX-DR6`, `UX-DR15`, `UX-DR19`, `UX-DR24`,
  `UX-DR29`; screenshot checkpoint `SC-V01`.
- Required browser scenario: `PROJECT-E2E-01`.
- Explicitly deferred: project list/rename (1.2), writer takeover (1.3),
  undo/redo/cancel (1.4), geometry, renderer/3D, PWA worker/install flow,
  assets/catalog/backup, and all Kotlin/PostgreSQL implementation. The control
  plane must not be created or selected by this story.

## Acceptance Criteria

1. **Controlled retirement of the POC before the new entry point.**

   **Given** `apps/web` currently contains the bounded W-POC phone demo and
   its 2026-08-04 handoff declares it non-production,
   **when** this story starts implementation,
   **then** the owner first creates a non-runtime POC closure/archive record
   under `_bmad-output/planning-artifacts/evidence/poc/` that preserves the
   existing handoff and its source/screenshot hashes, records the archive
   manifest and marks the POC retired from the runtime,
   **and** only byte-for-byte evidence copies (never `node_modules`, `dist`,
   reports, caches or generated bundles) may live in that archive.

   **And** production `apps/web` contains a new composition root and new test
   baseline; it has no import/reference to `src/poc/**`, `tests/poc/**`,
   W-POC labels, demo state, `POC · demo data · not saved`, or the archived
   evidence. Existing POC configurations, `main.tsx`, package scripts and
   test directory are POC-bound UPDATE files: replace/reconfigure them for
   production only after preserving the evidence, rather than treating them
   as a template. Never copy code from the deleted S-3 synthetic durability
   prototype either; its `PAUSED` report is design evidence only.

2. **One fresh, root-owned web toolchain.**

   **Given** the production waiver and the completed POC entry separation,
   **when** the web seed is created,
   **then** its documented source is exactly `create-rspack@2.1.8` with the
   `react-ts` template on Node `24.19.0` LTS and pnpm `11.20.0`, and the
   resulting root is `apps/web` inside this repository (never `S-*` or a
   second application repository).

   **And** it has one committed `pnpm-lock.yaml`, no second JavaScript
   lockfile, no `latest` range, no unpinned host-Node execution, no Vite or
   Vitest. Pins are React/React DOM `19.2.8`, TypeScript `7.0.2`,
   `@rspack/core`/`@rspack/cli` `2.1.8`, `@rstest/core`/
   `@rstest/adapter-rspack` `0.11.5`, and `@playwright/test` `1.62.1`.
   CSS component/page files use `*.module.css`; global CSS is restricted to
   reset, tokens and AppShell-wide platform constraints.

   **And** Rstest extends the same Rspack-facing configuration through
   `@rstest/adapter-rspack`, while Playwright runs against that same
   `apps/web` build. Kotlin tests are not placed in the JS runner and
   `apps/catalog-control-plane` remains an unopened AD-17 boundary.

3. **A valid first local Project has one durable initial Revision.**

   **Given** a person has loaded the app shell in a clean browser profile and
   does not have an account or network access,
   **when** they enter a non-empty working name and explicitly confirm create,
   **then** a pure `CreateProject` application use case creates one
   serializable Project with opaque stable `ProjectId`, `schemaVersion`,
   `createdAt`/`updatedAt` from `ClockPort`, one distinct empty `LevelId`, and
   a valid empty one-Level domain state.

   **And** IDs and time come from fakeable ports; the domain contains no React,
   DOM, browser-storage, renderer, service-worker, network or concrete
   adapter imports. No mesh, camera, UI state, demo data, account data or
   remote Project data is serialized. A blank/whitespace name is rejected by
   the pure name policy with a stable, localized UI reason and creates no
   Project or persistence record.

4. **Truthful durability boundary and recovery.**

   **Given** a valid initial candidate is ready to persist,
   **when** the repository adapter performs the initial publication,
   **then** it follows `validate → PendingDurability/saving → staging write →
   checksum/deserialize validation → atomic current-pointer publication →
   Durable Revision`, and only the final state is labelled `saved`/`durable`.

   **And** the repository is reached only through application-owned ports;
   the browser adapter must keep Project metadata/revisions local, use a
   versioned schema, and expose fault/restart seams. It must not choose a
   remote save path, Background Sync dependency, Catalog Gateway, user-data
   backend, blob/OPFS policy, or an independently durable ChangeSet.

   **Given** staging, checksum, or pointer publication fails, or the process
   is interrupted at a persistence boundary,
   **when** the app reloads/reopens,
   **then** there is either no created Project or the last readable Durable
   Revision, never a partial Project called saved; the UI shows an accessible
   `persist-failed` or `recovery-needed` state with retry/recovery action and
   fences further mutating publication until resolved.

5. **Phone-first first-run UI, not a demo.**

   **Given** first-run/empty, saving, durable, persist-failed, or recovery
   state,
   **when** the AppShell renders on a 360 CSS-px portrait phone viewport,
   **then** it provides a labelled Project-name field and an explicit create
   control, a text-plus-semantic (not colour-only) status, and first-use
   guidance that explains millimetres and local storage.

   **And** build/dimension/3D tips are dismissible and reopenable; a demo does
   not replace creating a personal Project. Text uses the working design
   tokens, critical controls are at least 44×44 CSS px, no hover is required,
   focus/validation announcements are associated with the field, and zoomed
   text remains actionable.

6. **Executable proof, screenshots and no overclaim.**

   **Given** the fresh production application is implemented,
   **when** its quality gate runs,
   **then** `WEB-BOOTSTRAP-01` records frozen-lock install, typecheck, Rspack
   production build, Rstest and Playwright against the new `apps/web` only.
   Add a fresh production mutation configuration/test command scoped to the
   new pure domain/application code; do not reuse the POC Stryker config or
   claim its results. All configured type, unit, mutation and browser checks
   must be green after every code change.

   **And** Rstest covers, with ports/fakes, valid creation, trimmed-blank
   rejection, IDs/timestamps, empty-Level invariants, deterministic canonical
   serialization, `PendingDurability` ordering, fault boundaries, recovery of
   the last Durable Revision and absence of partial history/Project state.
   Browser tests do not substitute for these domain/contract tests.

   **And** named Playwright `PROJECT-E2E-01` uses a clean persistent mobile
   browser profile: it loads the production shell without account, creates a
   valid Project through visible controls, observes saving before durable
   saved, reloads/reopens and reads the same initial Durable Revision. It also
   proves blank-name rejection and a controlled publication fault leaves no
   false saved state. Use a mobile browser viewport/touch baseline and label
   it browser emulation, not physical iPhone/Samsung/PWA certification.

   **And** after the user-visible result, capture and send `SC-V01`: a small
   screenshot of the actually running production app, annotated with build or
   revision, viewport/device-emulation, scenario and visible durable state.
   The team continues to the next safe slice after sending it; the screenshot
   is feedback only, never proof of data safety, PWA/offline, accessibility or
   NFR-15 device performance.

## Tasks / Subtasks

- [x] Close and archive the POC without promoting it (AC: 1)
  - [x] Inspect the current W-POC handoff and hash inventory before changing
        any POC-bound runtime path; preserve byte-for-byte source evidence in
        the named non-runtime archive and write the closure manifest.
  - [x] Make the runtime entry/test/config surface production-only; assert
        that production dependency graph/source scans contain no POC or S-3
        import/reference.
- [x] Bootstrap the production web root from the adopted seed (AC: 2)
  - [x] Rebuild `apps/web` configuration/scripts as a fresh Rspack React TS
        app while preserving one frozen root lockfile and the runtime guard.
  - [x] Add `tsconfig.domain.json` so domain compiles without DOM libraries;
        configure Rstest through the Rspack adapter and Playwright for the
        production browser suite.
- [x] Implement the local durable-project vertical seam TDD-first (AC: 3, 4)
  - [x] RED: add pure domain/application tests with fake Clock, ID, canonical
        serializer/checksum and ProjectRepository ports.
  - [x] GREEN: create the Project/Level/Revision values, `CreateProject` use
        case, validation and revision coordinator; use only serializable
        values and stable reason codes.
  - [x] GREEN: implement the local persistence adapter’s staging/checksum/
        pointer protocol and restart/fault seams; do not import S-3 code or
        decide future asset-blob storage.
  - [x] REFACTOR: enforce `adapters → application → domain`, and retain no
        alternate UI/persistence mutation path.
- [x] Implement the accessible phone first-run shell (AC: 5)
  - [x] Compose ports in `src/app`, render AppShell/project creation UI in
        `src/ui`, and style with CSS Modules plus minimal global tokens/reset.
  - [x] Cover saving/durable/persist-failed/recovery status and field
        validation as text and accessible semantics, not a coloured badge.
- [x] Establish repeatable production evidence (AC: 6)
  - [x] Add Rstest/adapter tests, local browser adapter contract tests and
        fresh mutation command/configuration for production sources.
  - [x] Add `PROJECT-E2E-01` against the production app; include controlled
        persistence fault and persistent-profile reopen.
  - [x] Run the complete gate, inspect the build, create `SC-V01`, report it
        as browser-emulation feedback, and update the story’s Dev Agent Record.

## Developer guardrails

- **POC and spike quarantine:** the existing POC is a source-controlled
  synthetic demo with no durable storage; it is neither a code base nor a
  visual/runtime fixture to evolve. S-3 is a PAUSED synthetic desktop evidence
  prototype whose code was cleaned up; its reports explain required fault
  classes only. Reimplement production behaviour from the contracts with TDD.
- **Single truth:** Project/Revision are canonical durable values. `saving`,
  `saved`, creation-form text, selection and all renderer/UI state are
  projections. A Validated candidate is not saved; a ChangeSet/inverse is not
  independently durable.
- **Local-first only:** no account, fetch/API/client, telemetry, cloud sync,
  Kotlin endpoint, PostgreSQL schema, Catalog Gateway or remote user data is
  introduced. The current empty Project has no referenced asset bytes, so this
  story must not silently decide IndexedDB-Blob versus OPFS, pinning or backup.
- **Writer scope:** create the port/schema seam needed for fenced publication,
  but do not represent Story 1.3 takeover/read-only multi-context UX as done.
  A stale/faulted publication must be rejected rather than last-writer-wins.
- **User-data safety:** no automatic delete, migration, backup/import, undo,
  redo, asset GC or service-worker update flow is introduced as a shortcut.
  Those have later dedicated Stories/contracts.
- **Naming:** code identifiers use English SPEC glossary terms; IDs are opaque;
  units use explicit suffixes. Localized Russian UI owns wording, while reason
  codes stay stable.
- **No false mobile claim:** emulation/screenshot proves only browser UI
  regression. It cannot say "supported iPhone/Samsung", offline PWA,
  performance or thermal certification.

## Required file layout

New production code belongs only to the unified root’s `apps/web` structure:

```text
apps/web/
  src/
    domain/                 # Project/Level/Revision values and pure policies
    application/            # CreateProject, coordinator and owned ports
    adapters/persistence/   # browser-local repository implementation
    ui/                     # AppShell, create screen/status, *.module.css
    app/                    # composition root; the only concrete wiring
    main.tsx                # production entry, not POC entry
  tests/
    fixtures/
    browser/                # Playwright production scenarios
  tsconfig.domain.json
  rspack.config.*
  rstest.config.*
  playwright.config.*
```

Expected UPDATE files are the existing POC-bound root/workspace manifests,
`apps/web` manifests/configurations/public shell/`main.tsx`, README and POC
documentation/evidence closure. Expected NEW production paths are the folders
above and the fresh test/mutation configuration. `apps/catalog-control-plane`
is not created by this story. Never place production modules under `S-*`,
`_bmad-output`, `docs/poc`, `src/poc`, or `tests/poc`.

## Source intelligence

- The repository has no Git commits; there is no historical production coding
  pattern to inherit. All current files are untracked. Treat the POC as an
  audited historical artefact, not as a previous Story implementation.
- The current POC imports `PocApp` from `apps/web/src/main.tsx`, keeps all
  state in a React reducer and explicitly resets it on reload. Its current
  Rspack/Rstest/Playwright/Stryker files target `src/poc`/`tests/poc`; they
  cannot establish production durability or test coverage.
- Official Rstest guidance confirms `@rstest/adapter-rspack` reuses the Rspack
  configuration rather than duplicating build transforms. See
  <https://rstest.rs/guide/integration/rspack>. Official Rspack quick-start
  documents the `create-rspack` template flow:
  <https://www.rspack.dev/guide/start/quick-start>.

## References

- [Epic 1 / Story 1.1](../planning-artifacts/epics.md#story-11-инициализировать-единый-web-root-и-создать-durable-project)
- [PRD FR-1 and FR-5](../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md#51-local-project-lifecycle)
- [PRD NFR-3, NFR-10, NFR-11, NFR-24 and NFR-26](../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md#6-cross-cutting-non-functional-requirements)
- [SPEC CAP-1 and CAP-8](../specs/spec-interiors-editor-alpha/SPEC.md#capabilities)
- [Project and backup contract §§1, 6–7](../specs/spec-interiors-editor-alpha/project-and-backup-contract.md)
- [Architecture AD-2, AD-3, AD-4, AD-12 and AD-16](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md)
- [Architecture structural seed](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md#structural-seed)
- [Domain model: Project, Command envelope and Revision/history](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/domain-model.md)
- [Solution design: change flow and persistence](../planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/solution-design.md)
- [UX design: AppShell, StatusBanner and first-run layout](../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md)
- [UX experience: onboarding, accessibility and storage states](../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md)
- [W-POC boundary and handoff](../planning-artifacts/root-phone-poc-waiver-2026-08-04.md), [POC handoff evidence](../planning-artifacts/evidence/poc/phone-editor-poc-handoff-2026-08-04.md)
- [S-3 evidence disposition](../planning-artifacts/evidence/spikes/S-3/S-3-terminal-independent-review-2026-08-05.md)
- [Project Context](../project-context.md)

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Fresh `bmad-create-story` workflow, 2026-08-05.
- Audited current POC source/config/tests and S-3 terminal evidence; no prior
  production Story or Git commit exists.
- RED proof: new production Rstest files failed only for absent production
  modules; `PROJECT-E2E-01` failed against the retired POC surface before the
  new composition root was wired.
- Final post-review-remediation quality gate, 2026-08-05: frozen install,
  Biome lint, typecheck, 14/14 Rstest, Rspack production build, 3/3
  Playwright and 46/46 scoped production mutants killed.
- 2026-08-22: independent post-remediation review accepted the five original
  HIGH findings. A final local gate recorded 1,091/1,091 Rstest tests,
  Biome lint, TypeScript, Rspack production build, 89/89 mobile-browser E2E,
  3/3 production-PWA E2E and 97.62% focused mutation score (the sole survivor
  is the equivalent JavaScript-string loop-boundary mutation).

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Product Owner’s explicit production waiver is documented above; it does not
  convert evidence prerequisites into PASS claims.
- Story checklist applied autonomously under the owner’s standing instruction.
- Created a verified non-runtime W-POC snapshot: 25 source/config/test/lock
  files SHA-256 matched their originals before runtime replacement; binary POC
  capture hashes are retained in the closure record.
- Implemented a DOM-free Project/Level/Revision domain and application seam.
  Browser IndexedDB storage follows staging → checksum/deserialize validation
  → atomic pointer publication; an interrupted staging revision is discarded
  on reopen and never receives a saved label.
- Added the phone-first creation UI with explicit saving, durable,
  persist-failed and recovery-needed states, associated name validation,
  44px-plus actions and dismissible/reopenable first-use guidance.
- Captured SC-V01 at 390×664 iPhone-13 browser emulation. It is feedback only,
  not physical-device, PWA/offline, performance or release evidence.
- Independent review remediation, 2026-08-05: fixed the P0 pointer/staging
  crash window by publishing the pointer and deleting its staging record in one
  IndexedDB transaction; repeated restart recovery now preserves a current
  Revision. A dangling pointer is `recovery-needed`, controller publication is
  immediately single-flight, and storage open/recovery errors stay in an
  accessible fenced state. New quality evidence: Biome lint, 14/14 Rstest,
  3/3 mobile Playwright and 46/46 scoped production mutants killed.
- Independent post-remediation review, 2026-08-22: all five original HIGH
  findings were accepted. The finalized persistence boundary also rejects
  cross-Project pointer/revision mismatches, surfaces blocked IndexedDB
  upgrades, invalidates a cached database promise after `versionchange`, and
  preserves an accessible durable-status path. Project names now reject lone
  UTF-16 surrogates; first-run guidance states millimetres and local-only
  storage. This closes Story 1.1 without claiming any outstanding readiness
  or device-certification gate.

### File List

- `package.json`, `README.md`, `docs/poc/README.md`
- `_bmad-output/implementation-artifacts/1-1-bootstrap-web-root-and-durable-project.md`,
  `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/evidence/poc/poc-closure-archive-2026-08-05.md`,
  `_bmad-output/planning-artifacts/evidence/poc/archive-2026-08-05/ARCHIVE-MANIFEST.md`,
  `_bmad-output/planning-artifacts/evidence/poc/archive-2026-08-05/snapshot/**`
  (25 individually SHA-verified non-runtime evidence copies; exact paths are
  listed in `ARCHIVE-MANIFEST.md`)
- `apps/web/package.json`, `apps/web/scripts/check-runtime.mjs`,
  `apps/web/rspack.config.mjs`, `apps/web/rstest.config.mjs`,
  `apps/web/playwright.config.mjs`, `apps/web/stryker.config.mjs`,
  `apps/web/biome.json`,
  `apps/web/tsconfig.json`, `apps/web/tsconfig.domain.json`,
  `apps/web/public/index.html`, `apps/web/README.md`, `apps/web/src/main.tsx`
- `apps/web/src/domain/{project,project-name-policy,initial-project,canonical-serialization}.{ts,test.ts}`
- `apps/web/src/domain/unicode-scalar-values.ts`
- `apps/web/src/application/{ports,create-project}.{ts,test.ts}`
- `apps/web/src/adapters/persistence/{durable-project-repository,indexeddb-versioned-project-store,publication-fault-controller}.{ts,test.ts}`
- `apps/web/src/app/{browser-ports,project-controller,production-app}.ts`
  and `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/ui/{AppShell.tsx,AppShell.module.css,global.css,styles.d.ts}`
- `apps/web/tests/browser/project-e2e.spec.ts`
- `docs/progress/WEB-BOOTSTRAP-01-2026-08-05.md`,
  `docs/progress/screenshots/{.gitkeep,SC-V01-production-durable-mobile-browser-2026-08-05.md,SC-V01-production-durable-mobile-browser-2026-08-05.png}`

### Change Log

- 2026-08-05 — Implemented Story 1.1 under the explicit production waiver;
  production root is ready for independent code review, not release.
- 2026-08-22 — Independent post-remediation review accepted; Story 1.1 is
  marked done with updated automated and browser-emulation evidence.

- `_bmad-output/implementation-artifacts/1-1-bootstrap-web-root-and-durable-project.md`
