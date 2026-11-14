---
baseline_commit: NO_VCS
---

# Story 5.1: Найти подходящий предмет в понятном каталоге

Status: done

## Story

Как пользователь,
я хочу просматривать категории и искать предмет по габаритам или способу
крепления,
чтобы выбрать реальный объект для проверки своей планировки.

## Minimal Alpha Acceptance Criteria

1. Phone catalog всегда показывает Alpha-категории «Мебель», «Сантехника»,
   «Техника и электроника», «Освещение» и «Аксессуары». Локальная мебель
   доступна сразу; ещё не наполненная категория показывает собственное честное
   empty state и не создаёт выдуманный asset или branded SKU.
2. Доступный без canvas поиск использует только локальный declared index и
   фильтрует по canonical name, Alpha category, furniture subtype,
   `AnchorClass` и основным integer-mm dimensions. Accessible result count и
   empty state соответствуют фактически видимым карточкам.
3. Карточка показывает renderer-derived preview либо компактный fallback,
   canonical name, Alpha category, physical dimensions, способ крепления,
   наличие вариантов и текущую локальную готовность. Отказ thumbnail не
   блокирует выбор технически доступной модели.
4. Выбор bundled GLB допускает явные loading, ready и unavailable состояния.
   Loading остаётся actionable; stalled request ограничен по времени;
   unavailable даёт labelled retry и close/cancel. Ни browse, ни download,
   failure, retry или cancel не создают `AssetInstance`, Revision или read-only
   состояние здорового Project.
5. Успешная техническая подготовка отдаёт выбранное определение в отдельный
   placement flow. Exact pin, `BackupFeasibilityPolicy` и Durable publication
   остаются границей Story 5.2; versioned remote Catalog Control Plane и его
   `G-CP-ADR` остаются отдельной Story 5.6 и не блокируют локальную Story 5.1.
6. Phone-browser evidence объединяет browse/search/category/empty state,
   loading-to-placement, unavailable retry/cancel и failed-thumbnail fallback;
   production PWA отдельно доказывает безопасный range passthrough без partial
   Cache Storage entry.

## Tasks / Subtasks

- [x] Показать полную Alpha-таксономию и честные empty states ненаполненных
      категорий.
- [x] Сохранить доступный локальный поиск по name, category, anchor и
      dimensions.
- [x] Показывать physical metadata, variants и readiness на каждой карточке.
- [x] Сохранить renderer-derived preview и readable thumbnail fallback.
- [x] Провести loading/unavailable/retry/cancel без скрытой Project mutation.
- [x] Подтвердить весь минимальный сценарий через mobile browser, внешний
      tunnel и production PWA.

## Review Findings

- [x] [Review][Test] Недоступность выбранного GLB проверялась только по
      отсутствию `AssetInstance`. `CATALOG-E2E-01C` теперь также доказывает,
      что resource failure и последующий retry/cancel не создают Durable
      Revision и не переводят healthy Project в recovery/read-only route.
- [x] [Review][P1] Локальная мебель больше не исчезает при недоступности
      Catalog Control Plane: `AppShell` сначала показывает локально объявленные
      карточки, а валидная удалённая публикация только заменяет их. Phone E2E
      подтверждает browse, search и начало placement при `503` publication.
- [x] [Review][P2] Каждая карточка явно показывает текущую готовность ресурса
      («Готово к загрузке», «Модель загружается», «Готово локально» или
      «Модель недоступна»), а thumbnail fallback не меняет техническую
      доступность модели.
- [x] [Review][P1] Local ranged GLB loader получил общий deadline для headers
      и полного body, а supplied overlay `AbortSignal` проходит до каждого
      range request. Header-first/body-stall, cancel-before/start и
      post-completion cleanup покрыты отдельными regression tests.

## Dev Notes

- Trace: `CAP-6`, `CAP-9`; `FR-26`, `FR-27`; `NFR-6`, `NFR-10`, `NFR-17`,
  `NFR-18`, `NFR-21`, `NFR-24`, `NFR-26`; `AD-2`, `AD-8`, `AD-12`, `AD-14`;
  `UX-DR4`, `UX-DR5`, `UX-DR6`, `UX-DR9`, `UX-DR17`, `UX-DR21`, `UX-DR30`,
  `UX-DR35`; `V-09`; `CATALOG-E2E-01`.
- Current source-owner correction removes licensing, provenance, grants and
  notice data from Alpha. The app remains honest about technical resource
  state and does not claim commercial availability.
- Remote catalog publication is not simulated inside the local UI. `FR-54`,
  `AD-16`, `AD-17` and control-plane outage evidence are owned by Story 5.6.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** The live phone catalog now exposes
  the five required Alpha categories instead of presenting furniture subtypes
  as the top-level taxonomy. Existing curated furniture remains available;
  plumbing, appliances/electronics, lighting and accessories render explicit
  category-specific empty states until real entries are declared.
- Search remains entirely local and now has an accessible name that states its
  real coverage: name, category, attachment and dimensions. It continues to
  recognise furniture subtype and Russian anchor terms such as «хранение» and
  «напольный», and also recognises the Alpha category «мебель».
- Every bundled card now textually exposes «Мебель», floor anchor, no declared
  variants and local readiness beside exact millimetre dimensions. Existing
  renderer-derived images, broken-thumbnail fallback, bounded range loading,
  retry and cancel semantics remain intact.
- The first external run exposed a test assumption, not a product regression:
  Cloudflare could keep a 3-MiB GLB in the valid «Загрузить и разместить» state
  beyond five seconds. Browser assertions now accept the declared loading or
  ready action, while the search-only scenario closes without needlessly
  downloading a model. The final six-scenario catalog corpus passed in one
  clean external-tunnel run.
- TDD was red while `catalogSections` did not exist. Two manual equivalent
  mutants were killed and restored: changing section conjunction to disjunction
  emptied the furniture list, and removing Alpha-category search terms broke
  the «мебель» result. The configured Stryker scope excludes `src/ui`, so no
  automatic percentage is claimed for this UI-only closure.
- Final evidence: 1339/1339 Rstest, 249-file Biome lint, both TypeScript
  configurations, production Rspack build, 6/6 related iPhone-13 browser
  scenarios through the external tunnel and 5/5 production PWA E2E.
- **Review evidence — 2026-08-28.** `CATALOG-E2E-01C` now records the
  Durable Revision count and verifies that neither unavailable-resource state
  nor retry/cancel exposes `Проект требует восстановления`. The focused phone
  browser run passes (1/1).
- **Acceptance closure — 2026-08-28.** Независимая повторная приёмка приняла
  все шесть Minimal Alpha AC. Local furniture остаётся доступной при `503`
  control-plane publication и search «хранение» продолжает использовать только
  declared local index; remote resource request имеет отдельный 15-second
  deadline. Для local range fallback один cancellation/deadline охватывает
  headers и все `arrayBuffer()` reads, поэтому ответ с валидным `206` header и
  зависшим body переходит в retryable unavailable, а закрытие overlay
  отменяет загрузку без Project mutation.
- Final evidence: RED зафиксировал body-stall и caller-cancel defects; затем
  15/15 focused range-loader tests, 48/48 targeted Rstest, 7/7
  `CATALOG-E2E-01*`, `PWA-E2E-04` 1/1, 1598/1598 Rstest, 264-file Biome,
  обе TypeScript configurations, production build и полный `test:e2e` прошли.
  Scoped Stryker для нового cancellation/deadline boundary: 10 killed + 2
  timeout из 14 (85.71%); два survivor-а — эквивалентные `{ once: true }` /
  `{}` listener options, поскольку `AbortSignal` сам эмитит `abort` ровно
  один раз.

### File List

- `_bmad-output/implementation-artifacts/5-1-find-suitable-item-in-catalog.md`
- `apps/web/src/ui/preloaded-glb-catalog.ts`
- `apps/web/src/ui/preloaded-glb-catalog.test.tsx`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/preloaded-glb-resource.ts`
- `apps/web/src/ui/preloaded-glb-resource.test.tsx`
- `apps/web/src/adapters/catalog/http-catalog-gateway.ts`
- `apps/web/src/adapters/catalog/http-catalog-gateway.test.ts`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-28: Closed all independent acceptance findings for local catalog
  fallback, visible per-card readiness and cancellable bounded GLB loading;
  Story moved from `review` to `done`.
- 2026-08-28: Strengthened unavailable-resource non-durability and healthy
  Project recovery evidence; Story remains in `review`.
- 2026-08-26: Completed the minimal Alpha local catalog browse/search/resource
  state surface and moved Story 5.1 to `review`.
