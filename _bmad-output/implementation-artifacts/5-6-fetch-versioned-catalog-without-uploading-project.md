# Story 5.6: Получить versioned catalog, не отдавая Project сервису

Status: done

## Story

Как пользователь,
я хочу видеть curated catalog без передачи своего Project на сервер,
чтобы пользоваться актуальными предметами и при этом сохранить local-first
владение планом.

## Execution Authority and Gate Disposition

- `G-READY` остаётся `NOT_READY`; этот story-файл не делает release claim.
- Действующие Product Owner waivers разрешают Alpha implementation и
  catalog-control-plane contract evidence, но не commit, public-production,
  physical-device, SLA/Security/Operations или independent-human claims.
- AD-24 / `G-CP-ADR` принимает только bounded internal-Alpha design: локальный
  read-only Kotlin/PostgreSQL catalog за same-origin proxy, без runtime publish
  API, аккаунта, cloud/IAM/CDN и любых Project data.
- `G-S6-catalog` и public-release `G-CP-ADR` evidence не считаются PASS от
  выполнения этой story; реальный Kotlin/PostgreSQL vertical slice обязателен.

## Traceability

- CAP-6, CAP-7, CAP-9.
- FR-54; cross-cutting FR-26, FR-28, FR-42.
- NFR-10, NFR-13, NFR-21, NFR-24, NFR-26.
- AD-2, AD-4, AD-12, AD-14, AD-16, AD-17, AD-24.
- UX-DR6, UX-DR9, UX-DR17, UX-DR21, UX-DR35.
- V-09-CP; EV-10, EV-11, EV-13, EV-14, EV-17, EV-19.
- Screenshot checkpoint `SC-V09-CP` is browser evidence only.

## Acceptance Criteria

1. **Given** Catalog Control Plane публикует approved versioned catalog
   envelope с metadata/resource descriptors-or-bytes и content hash, **when**
   пользователь открывает карточку через web catalog adapter, **then**
   приложение получает catalogue data только через `CatalogGatewayPort` и
   показывает version/resource metadata, необходимые до preview/placement,
   **and** boundary/contract evidence подтверждает, что perimeter не принимает,
   не хранит и не синхронизирует Project, Revision, session History, Portable
   Backup, account identity или user-owned pinned blobs.

2. **Playwright `CATALOG-E2E-02` — published catalog and outage boundary.**
   **Given** controlled mobile fixtures для versioned publication и service
   outage, **when** пользователь открывает approved asset, затем повторяет flow
   при unavailable service, **then** approved card показывает declared
   metadata/resource state, а outage даёт accessible retry/cancel и оставляет
   local Project state неизменным, **and** fake-gateway browser evidence
   остаётся отдельно от Kotlin/PostgreSQL contract tests; ни один browser run
   не является physical NFR-15 evidence.

3. **Given** integrity scan не находил missing/corrupt referenced hash,
   **when** remote service unavailable, **then** UI не показывает
   `ResourceRecoveryRequired` и не делает Project read-only, **and** только
   отдельно detected missing/corrupt exact bytes могут начать blocking recovery
   flow из Story 8.6.

## Tasks / Subtasks

- [x] Task 1 — Зафиксировать backend contract через RED-тесты (AC: 1, 3)
  - [x] Bootstrap independent Gradle/Kotlin root with the AD-24 pinned stack.
  - [x] Add failing Ktor contract tests for the closed route/method/body
        allowlist, versioned envelope, ETag/cache and byte-range behavior.
  - [x] Add failing PostgreSQL 18.4 integration tests for normalized schema,
        atomic publication, exact bytes and SELECT-only runtime role.
  - [x] Add negative corpus proving prohibited Project/account/history/backup
        shapes cannot enter endpoint, schema, log or cache seams.

- [x] Task 2 — Реализовать минимальный Kotlin/PostgreSQL control plane (AC: 1)
  - [x] Flyway migrations for immutable publication, asset and resource tables.
  - [x] Separate source-manifest seed command and read-only runtime repository.
  - [x] Ktor current/version/resource routes with strong hash/ETag and one-range
        delivery; no runtime publish/upload/admin endpoint.
  - [x] Seed current eight curated GLBs atomically with declared metadata.

- [x] Task 3 — Зафиксировать web boundary через RED-тесты (AC: 1–3)
  - [x] Add application-owned `CatalogGatewayPort` types and decoder tests.
  - [x] Add HTTP adapter tests for invalid envelope, cancel, control-plane outage,
        unpinned-resource outage and hash/size mismatch.
  - [x] Add AppShell behavior tests for version/resource state and accessible
        retry/cancel without Project/read-only/recovery mutation.

- [x] Task 4 — Интегрировать gateway и phone UI (AC: 1–3)
  - [x] Compose the HTTP gateway outside UI and move direct resource fetch
        behind it; keep local pin/preflight decisive.
  - [x] Load catalog publication on open and show catalog version, abbreviated
        hash, byte size and resource state before placement.
  - [x] Preserve local Custom catalog during service outage and provide labelled
        retry and close/cancel actions.
  - [x] Add Rspack same-origin `/catalog-api` proxy without a second phone
        tunnel or credentialed CORS mode.

- [x] Task 5 — Executable evidence and handoff (AC: 1–3)
  - [x] Pass focused Kotlin tests, PostgreSQL integration and PIT scope.
  - [x] Pass focused web tests/mutation and `CATALOG-E2E-02` fake-gateway UI.
  - [x] Run real Kotlin/PostgreSQL smoke through the same HTTP adapter.
  - [x] Run full web regression/build, capture `SC-V09-CP`, keep/restart the
        phone tunnel and update sprint/roadmap metrics.

### Review Findings

- [x] [Review][Patch] Reject trailing JSON documents before envelope materialization [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogEnvelope.kt:68]
- [x] [Review][Patch] Validate prohibited metadata requests before any repository access [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogHttp.kt:43]
- [x] [Review][Patch] Return the exact bodyless `405`/`Allow`/`no-store` contract for every unsupported method [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogHttp.kt:39]
- [x] [Review][Patch] Reject repeated or combined `Accept`, `If-None-Match` and `Range` headers [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogHttp.kt:80]
- [x] [Review][Patch] Reject malformed Unicode labels without lossy replacement [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogEnvelope.kt:200]
- [x] [Review][Patch] Check mapped resource size before allocating the file contents [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogSeed.kt:94]
- [x] [Review][Patch] Reject NUL-padded GLB JSON chunks outside the adopted static profile [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogMediaValidator.kt:132]
- [x] [Review][Patch] Reserve the literal `current` so every accepted catalog version has an immutable address [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogEnvelope.kt:87]
- [x] [Review][Patch] Revoke default database `PUBLIC` privileges and prove runtime cannot create temporary storage [contracts/catalog-control-plane/catalog-operator-bootstrap-v1.sql:10]
- [x] [Review][Patch] Verify the runtime PostgreSQL identity and effective SELECT-only privilege matrix at startup [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogControlPlane.kt:46]
- [x] [Review][Patch] Require successful Flyway validation for the same build before `catalogRun` [apps/catalog-control-plane/build.gradle.kts:65]
- [x] [Review][Patch] Refuse startup when current publication rows/resources are incomplete or inconsistent [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/CatalogControlPlane.kt:55]
- [x] [Review][Patch] Avoid loading complete resource blobs for HEAD, conditional and bounded range decisions [apps/catalog-control-plane/src/main/kotlin/dev/interiors/catalog/JdbcCatalogRepository.kt:31]
- [x] [Review][Patch] Expand the shared negative corpus across Project/Revision/History/Backup/account request shapes [contracts/catalog-control-plane/fixtures/http-cases.json:3]
- [x] [Review][Patch] Expand PIT beyond the envelope decoder to the claimed HTTP/media/publisher/repository scope [apps/catalog-control-plane/build.gradle.kts:74]
- [x] [Review][Patch] Add Gradle dependency checksum verification required by AD-24 [apps/catalog-control-plane/gradle:1]

## Dev Notes

### Architecture and data boundary

- `apps/web` remains the only owner of User Project, Revision, session History,
  Portable Backup, writer fencing, recovery and user-owned pinned bytes.
- `CatalogGatewayPort` carries catalog identifiers/descriptors/bytes and typed
  availability/cancel/integrity outcomes only. Transport/SQL types do not enter
  domain or Project serialization.
- Service outage is catalog state. It cannot choose Project recovery, writer
  access or read-only mode.
- Browse/cache bytes are not pinned Project resources. Existing local
  preflight, SHA-256, pin and `BackupFeasibilityPolicy` remain decisive before
  a Durable item mutation.

### Selected backend contract

- Gradle Wrapper 9.5.0, Kotlin 2.4.10, JDK 17, Ktor 3.5.2/Netty,
  PostgreSQL 18.4, pgJDBC 42.7.13, HikariCP 7.0.2, Flyway 13.3.0,
  Testcontainers 2.0.5 and PIT 1.25.8.
- Routes are limited to `GET /catalog-api/v1/catalogs/current`,
  `GET /catalog-api/v1/catalogs/{catalogVersion}` and
  `GET|HEAD /catalog-api/v1/resources/sha256/{hash}`.
- PostgreSQL tables are normalized and catalog-only, with exact `bytea`
  resources; no JSON/JSONB or generic payload escape field.
- Publication is a separate deterministic seed command. Runtime is read-only.

### Existing code seams

- `apps/web/src/ui/preloaded-glb-catalog.ts` owns the current eight-card
  metadata and should become a contract projection/filter, not remote state.
- `apps/web/src/ui/preloaded-glb-resource.ts` already implements bounded
  contiguous ranges and timeout; reuse its behavior behind the gateway adapter.
- `apps/web/src/ui/AppShell.tsx` currently fetches GLB bytes directly and says
  “готово локально” before the byte is actually ready; Story 5.6 replaces that
  path with truthful gateway/resource state.
- `apps/web/src/application/ports.ts` has no `CatalogGatewayPort` yet.
- `apps/web/src/app/editor-app.tsx` is the production composition seam.
- Browser catalog scenarios live in
  `apps/web/tests/browser/editor-workspace-e2e.spec.ts`.

### TDD and testing

- Follow RED → GREEN → MUTATE → KILL → REFACTOR. No production path is added
  before its focused failing behavior test.
- Kotlin tests are Gradle-owned and use exact PostgreSQL 18.4 for database
  evidence; H2 is not accepted as PostgreSQL evidence.
- Browser fake gateway proves deterministic UX only. A separate real-service
  smoke is required before review.
- Mutation scope targets validators, range parsing, cache/header policy and
  repository mapping; generated/coroutine glue may be excluded explicitly.
- No commit without explicit Product Owner approval.

### Project Structure Notes

- New backend root: `apps/catalog-control-plane` with independent Gradle
  wrapper/build, `src/main`, `src/test`, migrations and source manifest.
- New web adapter: `apps/web/src/adapters/catalog`; application contract remains
  under `apps/web/src/application`.
- `pnpm-workspace.yaml` may continue to discover `apps/*`, but JavaScript root
  scripts must never treat the Kotlin root as a JavaScript package.
- The same-origin proxy preserves the current one-tunnel phone workflow.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-56`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md#FR-54`]
- [Source: `_bmad-output/specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md#AD-24`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/catalog-control-plane-alpha-decision-2026-08-26.md`]
- [Source: `plans/alpha-implementation-plan.md#V-09-CP`]
- [Source: `plans/catalog-control-plane-decision-input-2026-08-09.md`]
- [Source: `_bmad-output/planning-artifacts/implementation-waiver-2026-08-06.md`]
- [Source: `_bmad-output/planning-artifacts/readiness-evidence-program-waiver-2026-08-09.md`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `gradle -p apps/catalog-control-plane clean test --no-daemon -Dkotlin.incremental=false`
- `gradle -p apps/catalog-control-plane pitest --no-daemon -Dkotlin.incremental=false`
- `pnpm --filter @interiors/web test|lint|typecheck|build`
- `pnpm exec stryker run stryker.catalog.config.mjs`
- Playwright ordinary mobile suite, production PWA suite and live catalog smoke.

### Completion Notes List

- Реализован отдельный Kotlin/Ktor/PostgreSQL 18.4 control plane с тремя
  credentials, Flyway migration/validate, атомарной публикацией 8 assets / 16
  exact resources и SELECT-only runtime; HTTP-периметр не имеет upload/admin,
  account или Project-shaped path/body/storage seam.
- Kotlin исполняет shared envelope/semantic/media/HTTP corpus, проверяет точный
  six-table allowlist, запрет лишних database objects/columns, immutable grants,
  runtime identity/readiness и lossless normalized-row projection. 37/37 tests
  green на exact PostgreSQL. Расширенный PIT scope охватывает HTTP, media,
  publisher, seed и repository: 857/929 lines (92%), 549/867 mutation coverage
  (63%), test strength 549/729 (75%; 528 killed и 21 timeout).
- Web получает publication/resource только через `CatalogGatewayPort`, сверяет
  media type, видимую transport length, SHA-256/ETag и PNG/GLB profile, показывает
  version/hash/bytes и различает unavailable/invalid/cancel без изменения
  Project, read-only или recovery state. Mutation-run нашёл и закрыл реальный
  Gregorian-date defect и расхождение empty `animations` в shared GLB profile;
  итоговый diagnostic scope: 591/849 killed + 3 timeout (69.96%). Оставшиеся
  survivors — преимущественно гиперточные regex/boundary и
  комбинированные PNG guard mutations; обязательные fixtures и расширенные
  boundary cases исполняются, отчёт сохранён для review.
- Final web evidence: 1399/1399 Rstest, warning-free Biome (259 files), обе
  TypeScript configs и production build. Полный mobile run — 148/148,
  production PWA — 5/5; live
  `phone → proxy → Kotlin → PostgreSQL` и все CATALOG scenarios green.
- `SC-V09-CP` сохранён как browser checkpoint. Он не является physical-device,
  availability, security/operations, independent-human или release evidence.
- Все 16 подтверждённых review findings исправлены и повторно проверены; Story
  5.6 переведена в `done`. `G-READY` и release gates остаются `NOT_READY`;
  physical-device/public-production/SLA claim не создавался. Коммит не создавался.

### File List

- `.gitignore`
- `contracts/catalog-control-plane/**`
- `apps/catalog-control-plane/**` (исключая generated `.gradle`, `.kotlin`, `build`)
- `apps/web/src/application/ports.ts`
- `apps/web/src/app/editor-app.tsx`
- `apps/web/src/adapters/catalog/catalog-media-validator.ts`
- `apps/web/src/adapters/catalog/catalog-media-validator.test.ts`
- `apps/web/src/adapters/catalog/http-catalog-gateway.ts`
- `apps/web/src/adapters/catalog/http-catalog-gateway.test.ts`
- `apps/web/src/ui/preloaded-glb-catalog.ts`
- `apps/web/src/ui/preloaded-glb-catalog.test.tsx`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/public/sw.template.js`
- `apps/web/rspack.config.mjs`
- `apps/web/playwright.pwa.config.mjs`
- `apps/web/stryker.catalog.config.mjs`
- `apps/web/scripts/serve-pwa-e2e.mjs`
- `apps/web/tests/browser/catalog-gateway-fake.ts`
- `apps/web/tests/browser/catalog-gateway-fake.spec.ts`
- `apps/web/tests/browser/catalog-control-plane-live-e2e.spec.ts`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `apps/web/tests/browser/project-e2e.spec.ts`
- `apps/web/tests/browser/pwa-e2e.spec.ts`
- `_bmad-output/implementation-artifacts/evidence/story-5-6/sc-v09-cp-catalog.png`
- `_bmad-output/implementation-artifacts/5-6-fetch-versioned-catalog-without-uploading-project.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`
- `plans/alpha-implementation-plan.md`
