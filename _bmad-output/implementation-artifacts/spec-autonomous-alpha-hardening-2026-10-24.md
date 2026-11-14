---
title: Автономная доработка Alpha после аудита
type: feature
created: 2026-10-24
status: done
baseline_commit: NO_COMMITS
review_loop_iteration: 0
context:
  - docs/progress/PROJECT-RESUME-2026-10-24.md
  - _bmad-output/project-context.md
---

<frozen-after-approval reason="Владелец прямо поручил выполнить все рекомендации без дополнительных вопросов 24 октября 2026">

## Intent

**Problem:** Рабочая Alpha имеет обнаруженные дефекты каталога и локального запуска, незавершенные recovery маршруты, устаревшие мобильные диалоги и слишком крупный composition/UI модуль. После перерыва владелец хочет проверить доработанный продукт на телефоне.

**Approach:** Выполнить последовательные проверяемые срезы каталога, mobile UX, recovery и сопровождения. Подготовить воспроизводимый запуск, release runbook и самостоятельную пользовательскую проверку. По каждому срезу сохранять фактическое evidence; реальную приемку телефоном выполняет владелец после поставки.

## Boundaries and Constraints

**Always:** CAP/FR/NFR/AD владельцы остаются прежними; канонический SPEC не перегенерируется. Integer mm, derived Rooms, local-first atomic durability, writer fencing, exact pinned bytes, self-contained backup и session history сохраняются. Каждый кодовый срез следует RED/GREEN и scoped mutation. Один writer на модуль. Исходная копия сохранена вне репозитория.

**Human authorization:** Пользователь разрешил все направления рекомендаций и прямо отменил дополнительные вопросы. Коммиты, платные услуги и фиктивная приемка другими людьми не разрешены. Недоступные аккаунты/домен не выдумываются; подготовка эксплуатации должна оставлять приложение запускаемым локально и по текущему HTTPS.

**Never:** Нет silent deletion, перезаписи существующего проекта импортом, выдачи pending draft за Durable/Portable Backup, отключения dependency verification или массового удаления по Fallow. Нельзя выдать browser emulation за physical acceptance либо расширить Alpha на снятые finishes/Focus/cloud возможности.

## I/O and Edge Cases

| Scenario | State and trigger | Observable result |
| --- | --- | --- |
| Catalog download | Чистая сборка, маленький или большой GLB, Range/HEAD | Все объявленные exact resources доступны, корректные диапазоны; ошибки без публикации |
| Wall asset | Проверенный catalog wall asset и compatible Wall | Wall host сохраняется в placement, reopen и backup; floor placement не подставляется |
| Mobile dialogs | Rename/restart/color, клавиатура, 200%, короткий viewport | Доступные modal controls, focus isolation/return, busy/error/retry; отмена не создает Revision |
| Recovery export | Неопубликованный candidate либо writer copy | Отдельный честно названный versioned recovery artifact, current Durable не меняется |
| Exact repair | Portable Backup с нужными точными bytes | Только verified repair, включая history; нет новой геометрии/Revision от byte repair |
| Read-only | Валидный current с missing resources | Проверенная безопасная projection, явный read-only, нет editable fallback |
| Regression | Все завершенные срезы вместе | Green lint/types/domain/browser/PWA и подтвержденные scoped mutations |

</frozen-after-approval>

## Code Map

- `apps/web/scripts/serve-pwa-e2e.mjs`, `rspack.config.mjs` — HTTP и полная упаковка ресурсов.
- `apps/catalog-control-plane` — verified dependencies, backend test/run path.
- `apps/web/src/domain/custom-glb-asset.ts`, `application/create-custom-glb-floor-item.ts` — GLB placement/pin boundary.
- `apps/web/src/app/project-controller.ts`, recovery application/adapters — pending export, exact repair, read-only.
- `apps/web/src/ui/AppShell.tsx`, dialog modules и CSS — пользовательские маршруты и extraction.
- `README.md`, `docs/index.md`, runbooks и CI — воспроизводимая разработка и дальнейшая приемка.

## Tasks and Acceptance

- [x] Каталог после clean build: short/full/ranged resources, правильные labels и wall placement, save/reopen/backup.
- [x] Backend verification проходит с reviewed checksums и реальным PostgreSQL baseline; отдельный понятный запуск.
- [x] Rename/Restart/color используют доступные modal flows и помещаются на коротком телефоне с 200% текстом.
- [x] Header/dock/toast/camera не перекрывают critical actions.
- [x] Pending recovery export, exact backup/history repair, verified read-only projection подключены к UI.
- [x] Связанные UI flows вынесены из AppShell; повторная публикация и renderer cycle сокращены без изменения поведения.
- [x] Legacy orientation совместимость и Alpha+ library validation/cancel/reuse/transfer проверены; неподтвержденные миграции не запускаются.
- [x] README/index, release/usability runbooks и воспроизводимые web/backend checks актуальны.
- [x] Итоговая regression, независимый review, запуск HTTPS и отчет завершены.

Given рабочий локальный проект, when пользователь повторяет основной phone flow после доработок, then точные размеры, предметы и Durable Revision сохраняются между Plan/3D, offline/reopen и `.interiors` transfer.

## Verification

Закрепленный launcher Node 24.19.0 / pnpm 11.20.0; Rstest, Biome, обе TS конфигурации, clean production build, server behavior tests, полный Playwright + production PWA, Gradle/PostgreSQL tests. Scoped mutation runs выполнены в независимых временных копиях после source freeze; inPlace никогда не инструментировал оригинальный source. Последовательная воспроизводимая команда `test:mutation:hardening` доступна для отдельного запуска без конкурентных изменений. Коммиты не создаются.

## Suggested Review Order

**Надежность сохранения**

- Контроллер различает неопубликованную правку, текущую версию и повреждение истории.
  [project-controller.ts:789](../../apps/web/src/app/project-controller.ts#L789)

- Отдельный формат проверяет версию, структуру, checksum, лимиты и точные ресурсы.
  [project-recovery.ts:45](../../apps/web/src/app/project-recovery.ts#L45)

- Недоказанные staging roots сохраняются при запуске другого окна.
  [pin-staging-lease-coordinator.ts:110](../../apps/web/src/adapters/persistence/pin-staging-lease-coordinator.ts#L110)

- Повторное использование ресурса атомарно снимает исключительное владение staged bytes.
  [indexeddb-custom-asset-resource-store.ts:125](../../apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.ts#L125)

**Предметы и мобильный интерфейс**

- Настенная GLB регистрируется вместе со стабильной привязкой к стене.
  [custom-glb-asset.ts:73](../../apps/web/src/domain/custom-glb-asset.ts#L73)

- Постановка каталожной модели выбирает соответствующий floor или wall flow.
  [AppShell.tsx:3614](../../apps/web/src/ui/AppShell.tsx#L3614)

- Native dialog удерживает фокус и сохраняет ошибки внутри переименования.
  [RenameProjectDialog.tsx:5](../../apps/web/src/ui/RenameProjectDialog.tsx#L5)

**Сопровождение и проверки**

- PlanProjection вынесен без новой геометрии или изменения жестов.
  [PlanProjection.tsx:78](../../apps/web/src/ui/PlanProjection.tsx#L78)

- Общие команды используют единый atomic publish pipeline.
  [project-mutation-publication.ts:31](../../apps/web/src/application/project-mutation-publication.ts#L31)

- Проверка compiler API запрещает нарушения границ и runtime renderer cycles.
  [check-boundaries.mjs:27](../../scripts/check-boundaries.mjs#L27)

- Browser regression защищает размещенную модель при удалении карточки каталога.
  [library-render-regression-e2e.spec.ts:4](../../apps/web/tests/browser/library-render-regression-e2e.spec.ts#L4)

- CI проверяет web/backend, а ручной запуск выбирает mutation scope.
  [verify.yml:3](../../.github/workflows/verify.yml#L3)

## Final Verification

Полный browser: 213/213 с live catalog; production PWA: 9/9; unit: 1834/1834 в 133 файлах; delivery: 48/48; boundaries: 15/15 + production PASS; обе TS конфигурации, lint, build, actionlint PASS. Backend 39/39, 7 integration на PostgreSQL 18.4. Восемь scoped mutation результатов ≥80%; raw reports/timeout/survivors сохранены раздельно. Подробности и внешние критерии: [отчет о поставке](../../docs/progress/DELIVERY-2026-10-24.md).

Review triage: patch — межоконная защита shared pins, асинхронный snapshot bytes, навигация во время ремонта, stale color error, видимость placed GLB после tombstone, стабильность recovery projection, повторная диагностика current/history. Все подтвержденные замечания исправлены; intent gap и bad spec не обнаружены. Временный hostname, physical acceptance, global orphan GC и полный Epic 9 не объявлены завершенными. Коммитов и push нет.
