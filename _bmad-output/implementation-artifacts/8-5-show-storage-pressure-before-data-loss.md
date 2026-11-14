---
baseline_commit: NO_VCS
---

# Story 8.5: Увидеть storage pressure до потери данных

Status: done

## Story

Как пользователь,
я хочу видеть использование и риск хранилища до quota failure,
чтобы успеть безопасно сохранить или упростить Project.

## Minimal Alpha Acceptance Criteria

1. При доступной browser storage estimate приложение показывает warning с
   фактическими usage/quota до следующего изменения: `warning` начинается с
   70%, `critical` — с 90%. Ошибка или отсутствие API остаются честным
   `unavailable`, без выдуманной безопасной ёмкости и без блокировки здорового
   локального Project.
2. Warning/critical предлагают переход к Project export, освобождение только
   повторно загружаемого browse-кэша и явный запрос persistent storage. Grant,
   refusal и unavailable показываются как advisory browser state, а не как
   гарантия против browser/OS eviction или замена Portable Backup.
3. Named `QuotaExceededError` во время atomic publication возвращает
   `PERSISTENCE_QUOTA_EXCEEDED`: candidate не называется сохранённым, предыдущая
   Durable Revision остаётся current, UI показывает retry и Project export, а
   обычные новые mutations остаются заблокированы до retry/recovery.
4. PWA cleanup удаляет только versioned browse cache. App shell, IndexedDB,
   текущий Project, recovery/custom resources, active History и
   `PinStagingLease` roots не затрагиваются; Project снова открывается offline.
5. Phone-browser evidence покрывает critical warning, unavailable estimate,
   persistent-storage refusal и quota-shaped publication failure. Production
   PWA evidence покрывает selective browse-cache cleanup и offline reopen.

## Tasks / Subtasks

- [x] Классифицировать advisory storage estimate с честными boundary states.
- [x] Показать phone-first warning и доступные backup/persistence/cache actions.
- [x] Сохранить предыдущую Durable Revision при quota-shaped publication fault.
- [x] Заблокировать дальнейшие mutations до явного retry/recovery после
      persistence failure.
- [x] Ограничить PWA cleanup повторно скачиваемым browse-кэшем.
- [x] Подтвердить внешний tunnel, production PWA, полную регрессию и focused
      mutation evidence.

## Review Findings

- [x] [P1] Quota failure во время rename теперь удерживает exact candidate и
      исходный CAS base до durable retry, stale base или recovery; новый
      persistable command не может заменить этот candidate.
- [x] [P2] При persistence failure формы свойств Room и действия wall/floor
      Item (move, lock, delete) явно disabled и дополнительно защищены
      handlers; rename-dialog даёт локальный clickable retry.

## Dev Notes

- Trace: `CAP-1`, `CAP-9`; `FR-43`; `NFR-3`, `NFR-11`, `NFR-13`, `NFR-16`,
  `NFR-25`, `NFR-26`; `AD-3`, `AD-4`, `AD-12`, `AD-19`; `UX-DR6`,
  `UX-DR19`, `UX-DR21`, `UX-DR24`, `UX-DR25`, `UX-DR38`; `V-16`; `EV-06`,
  `EV-07`, `EV-08`, `EV-14`, `EV-17`.
- Storage estimate и persistent-storage grant являются advisory signals.
  Browser/OS eviction остаётся внешним риском; самостоятельный Portable Backup
  остаётся единственным переносимым recovery route.
- Реальная искусственно заполненная physical-device quota/eviction matrix
  остаётся release/device evidence, а не дополнительной функцией этой Story.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Storage estimate проходит строгую
  safe-integer проверку; 70%/90% отделяют warning и critical, а missing,
  malformed или rejected estimate отображается как unavailable.
- Phone UI показывает процент использования, прямо предупреждает об advisory
  характере browser protection и сохраняет доступ к Project export. Persistent
  storage запрашивается только явным пользовательским действием; grant, refusal
  и unavailable не выдаются за защиту от внешнего eviction.
- Named quota fault классифицируется отдельно от обычного write failure.
  Staged candidate не заменяет current pointer, состояние становится
  `persist-failed`, retry/export видимы, а editor mutation controls закрыты до
  восстановления публикации. Повторное открытие подтверждает прежние durable
  dimensions.
- Service worker адресует app-shell и browse cache раздельно. Cleanup message
  удаляет только browse cache; IndexedDB и все domain/history/resource roots не
  входят в эту операцию. Production PWA после cleanup открывает текущий Project
  offline.
- External iPhone-13 browser evidence: 4/4 сценария прошли через действующий
  Cloudflare tunnel. Production PWA: `PWA-E2E-05` прошёл 1/1.
- Focused mutation: storage-pressure 42/43 killed (97.67%; один эквивалентный
  `typeof` guard перед `Number.isSafeInteger`) и quota-persistence 64/66 killed
  (96.97%; два эквивалентных object/null guard перед named-error check). UI
  quota copy — 24/24 killed, 100%.
- Final evidence: 1342/1342 Rstest, warning-free 250-file Biome lint, обе
  TypeScript-конфигурации и production Rspack build.
- **PWA-harness review patch — 2026-08-28.** Production PWA scenarios no
  longer depend implicitly on a manually started `127.0.0.1:4174` service.
  Their local server supplies the same immutable versioned catalog envelope and
  resource map as the browser fake, while `INTERIORS_PWA_CATALOG_ORIGIN`
  remains an explicit route for a live control-plane run. `PWA-E2E-01`–`05`
  pass 5/5. This is synthetic PWA evidence only; it neither replaces the
  Kotlin/PostgreSQL integration test nor advances physical-device storage and
  eviction evidence.
- **Acceptance closure — 2026-08-28.** Независимый аудит принял все пять
  Minimal Alpha AC. Quota failure внутри rename оставляет прежнюю Durable
  Revision current, удерживает exact candidate с expected-base revision и
  повторяет его только через CAS publication. Пока candidate не resolved,
  обычные Project mutations заблокированы; local retry внутри rename-dialog
  остаётся доступен на телефоне.
- Phone regressions покрывают quota → unchanged durable name → local retry →
  reopen, а также disabled Room-property fields и save action до retry.
  Wall/floor Item move/lock/delete actions блокируются и в UI, и в handlers.
  Final evidence: 1,611/1,611 Rstest, clean 264-file Biome lint, обе
  TypeScript-конфигурации, production Rspack build, 5/5 production PWA E2E;
  targeted quota phone scenarios 2/2. Full 156-scenario mobile run дал 153
  pass, 1 expected skip и два unrelated 3D timeouts; оба изолированных rerun
  прошли 2/2. Focused mutation: rename acceptance 8/9 killed (один
  эквивалентный late lease-outcome path), retry CAS branch 18/24 killed;
  survivors не меняют покрытый public outcome.

### File List

- `_bmad-output/implementation-artifacts/8-5-show-storage-pressure-before-data-loss.md`
- `apps/web/src/application/storage-pressure.ts`
- `apps/web/src/application/storage-pressure.test.ts`
- `apps/web/src/application/ports.ts`
- `apps/web/src/app/browser-ports.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/adapters/persistence/durable-project-repository.ts`
- `apps/web/src/adapters/persistence/durable-project-repository.test.ts`
- `apps/web/src/main.tsx`
- `apps/web/scripts/serve-pwa-e2e.mjs`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.module.css`
- `apps/web/src/ui/AppShell.test.tsx`
- `apps/web/public/sw.template.js`
- `apps/web/tests/browser/project-e2e.spec.ts`
- `apps/web/tests/browser/plan-e2e.spec.ts`
- `apps/web/tests/browser/pwa-e2e.spec.ts`
- `apps/web/stryker.storage-pressure.config.mjs`
- `apps/web/stryker.quota-persistence.config.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-26: Confirmed the minimal Alpha storage-pressure flow and moved Story
  8.5 to `review`.
- 2026-08-28: Made the controlled PWA catalog fixture self-contained; Story
  remains in `review`.
- 2026-08-28: Resolved independent P1/P2 findings and accepted Story 8.5 as
  `done`.
