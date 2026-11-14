---
baseline_commit: NO_VCS
---

# Story 8.4: Открыть и сохранить existing Project в airplane mode

Status: done

## Story

Как пользователь,
я хочу reopen, edit и save уже созданный Project без сети,
чтобы работа на объекте не зависела от соединения.

## Minimal Alpha Acceptance Criteria

1. После первого online запуска production PWA кэширует versioned app shell.
   Existing healthy Project и exact уже pinned catalog/custom resources читаются
   из локальных stores без скрытого network fetch.
2. При отключённой сети пользователь открывает тот же Project в 2D и 3D,
   выполняет valid edit через обычную atomic publication boundary и видит
   состояние «Сохранено локально».
3. Offline Undo/Redo восстанавливают согласованные Durable Revisions. После
   закрытия browser process новый offline startup открывает последнюю Durable
   Revision с той же integer-mm geometry и pinned Item.
4. Сохранившаяся writer lease не обходится при перезапуске: новый process
   сначала остаётся read-only, затем только явный takeover возвращает право
   редактирования и не меняет Project Revision.
5. Never-downloaded catalog resource остаётся честно unavailable с retry/cancel;
   placeholder не называется exact моделью, Project не меняется и не переходит
   в `ResourceRecoveryRequired`.
6. Production PWA evidence покрывает online pin → offline reopen/edit →
   Undo/Redo → process restart → offline reopen. Обычный phone-browser evidence
   покрывает unavailable resource. Physical-device matrix остаётся отдельным
   release gate.

## Tasks / Subtasks

- [x] Кэшировать полный versioned app shell после первого online запуска.
- [x] Открывать healthy Project и pinned GLB из локальных stores offline.
- [x] Публиковать valid offline edit через обычную Durable boundary.
- [x] Сохранить offline Undo/Redo и последнюю Revision после process restart.
- [x] Сохранить явный writer takeover после нового context startup.
- [x] Показать retry/cancel без Project mutation для never-downloaded модели.
- [x] Подтвердить production PWA, внешний phone-browser и полный quality gate.

## Review Findings

- [x] [P1] После offline restart read-only context мог автоматически получить
  истёкший чужой writer lease через heartbeat/reload. `sessionStorage`-scoped
  requirement gate сохраняет observed foreign lease на reload и блокирует все
  publication paths до явного подтверждённого takeover.

## Dev Notes

- Trace: `CAP-1`, `CAP-6`, `CAP-9`; `FR-41`, `FR-42`; cross-cutting `FR-54`;
  `NFR-3`, `NFR-7`, `NFR-10`, `NFR-11`, `NFR-14`, `NFR-15`, `NFR-16`,
  `NFR-21`, `NFR-26`; `AD-3`, `AD-4`, `AD-5`, `AD-11`, `AD-14`, `AD-17`;
  `UX-DR6`, `UX-DR19`, `UX-DR21`, `UX-DR28`, `UX-DR31`, `UX-DR35`;
  `V-15`; `EV-07`, `EV-08`, `EV-12`, `EV-17`.
- Remote Catalog Control Plane остаётся отдельной backlog Story 5.6. Этот
  минимальный Alpha-срез доказывает локальный curated catalog и уже pinned
  exact bytes; он не симулирует незавершённый remote service.
- Browser/PWA automation не заменяет iOS Safari/Home Screen и Android Chrome
  standalone traces из physical-device matrix.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** `PWA-E2E-02` теперь начинает с
  production build, ждёт controlling Service Worker, создаёт Project и
  загружает/публикует exact pinned каталоговую кровать через production
  IndexedDB boundaries.
- После network disable тот же context перезагружает cached shell, читает
  Project, Item и 3D locally, меняет ширину 4000 → 4300 мм, затем выполняет
  offline Undo/Redo. Каждая операция возвращается в «Сохранено локально».
- Browser process закрывается полностью и запускается снова с тем же profile
  уже offline. Project открывается с 4300 мм и тем же Item. Старый writer fence
  честно удерживает новый context read-only; явный takeover снимает fence, после
  чего 3D projection снова строится из restored domain state.
- Первый усиленный rerun был RED: сохранённые данные уже читались корректно,
  но тест пытался нажать 3D сквозь ожидаемый writer-conflict overlay. GREEN
  учитывает обязательный explicit takeover, не ослабляя fencing policy.
- `CATALOG-E2E-01C` через внешний iPhone-13 tunnel подтверждает, что
  never-downloaded GLB offline остаётся non-durable unavailable с retry/cancel,
  а после возврата сети его можно подготовить без предыдущей partial mutation.
- Focused loader mutation повторил существующий baseline 105/118 killed,
  89.83%. Двенадцать survivors относятся к invalid online `Content-Range`
  admission branches и не входят в healthy/already-pinned precondition этой
  Story; отдельный catalog hardening не был добавлен в срез.
- Final evidence: 1342/1342 Rstest, warning-free 250-file Biome lint, обе
  TypeScript-конфигурации, production Rspack build, 5/5 production PWA E2E и
  1/1 связанный phone-browser scenario через внешний tunnel.
- **Acceptance closure — 2026-08-28.** Независимый повторный аудит принял все
  шесть AC. Reload-stable `WriterTakeoverRequirementStorePort` передаётся в
  production fenced repository через context-local `sessionStorage`: после
  observed foreign writer expiry и обычный reload остаются read-only, включая
  direct publication path; только confirmed takeover очищает gate, затем
  перечитывает Durable Revision, не меняя её сам по себе.
- Final closure evidence: RED regression для отсутствующего reload-stable
  requirement, затем 1,607/1,607 Rstest, clean 264-file Biome lint, обе
  TypeScript-конфигурации, production Rspack build, 5/5 production PWA E2E
  (включая `expiry → reload → read-only → confirmed takeover`) и 1/1
  writer-lease phone-browser scenario. Focused mutation: 31/31 fenced
  repository и 13/13 browser requirement gate killed (100%).

### File List

- `_bmad-output/implementation-artifacts/8-4-open-and-save-existing-project-in-airplane-mode.md`
- `apps/web/public/sw.template.js`
- `apps/web/rspack.config.mjs`
- `apps/web/src/main.tsx`
- `apps/web/src/app/browser-ports.ts`
- `apps/web/src/app/browser-ports.test.ts`
- `apps/web/src/app/production-app.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/adapters/persistence/durable-project-repository.ts`
- `apps/web/src/adapters/persistence/durable-project-repository.test.ts`
- `apps/web/src/adapters/persistence/fenced-project-repository.ts`
- `apps/web/src/adapters/persistence/indexeddb-versioned-project-store.ts`
- `apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.ts`
- `apps/web/src/ui/preloaded-glb-resource.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/tests/browser/pwa-e2e.spec.ts`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `apps/web/stryker.preloaded-glb-resource.config.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-26: Closed the minimal Alpha offline reopen/edit/restart path and
  moved Story 8.4 to `review`.
- 2026-08-28: Fixed the independently found AC4 P1, added reload-stable writer
  takeover enforcement and accepted the Story as `done`.
