---
baseline_commit: NO_VCS
---

# Story 8.6: Восстановить Project после resource-integrity failure

Status: done

## Story

Как пользователь,
я хочу безопасно восстановить точный ресурс либо выполнить полный repair,
чтобы повреждённый asset не превратился в скрытую потерю данных.

## Minimal Alpha Acceptance Criteria

1. Project с отсутствующими либо повреждёнными exact custom GLB bytes
   открывается только как явный read-only `ResourceRecoveryRequired`:
   небезопасные модели не попадают в renderer, обычное редактирование и
   session History заблокированы, а экран восстановления не выглядит как
   пустой первый запуск.
2. Недоступность catalog resource route не заменяет resource-integrity failure
   сетевой ошибкой. Controlled phone-browser fixture `CATALOG-E2E-04` получает
   одинаковое блокирующее recovery-состояние до и после catalog outage.
3. Exact repair принимает только полный one-to-one набор исходных GLB с
   ожидаемыми SHA-256. Неполный, duplicate или чужой набор не пишет ни одного
   ресурса. Полный набор записывается одной IndexedDB-транзакцией, затем весь
   Project проходит повторную integrity-проверку; Project Revision и History
   не меняются.
4. Если exact bytes недоступны, пользователь видит число затронутых definitions
   и placements. Cancel сохраняет current Durable Revision. Fresh confirm
   повторно проверяет unresolved hash set и публикует удаление всех
   недоступных references одним `RecoveryChangeSet` ровно в одной следующей
   Durable Revision.
5. Ошибка hash/store/reopen, stale recovery, writer-fence loss и конкурирующий
   repair fail closed: partial success не показывается и не становится current.
   Cross-store persistent `PinStagingLease` reconciliation и physical
   forced-GC/crash corpus остаются release-hardening evidence, а не расширяют
   утверждённую функциональную Minimal Alpha границу.
6. Named `RECOVERY-E2E-01` наблюдаемо различает cancel, exact repair и complete
   RecoveryChangeSet по current revision ID и общему числу Durable Revision.

## Tasks / Subtasks

- [x] Проверять referenced custom-resource bytes до выдачи writer lease.
- [x] Показывать явный read-only recovery screen и блокировать unsafe actions.
- [x] Принимать полный exact GLB hash set атомарно без Project Revision.
- [x] Отклонять partial/duplicate/unexpected repair без resource mutation.
- [x] Реализовать explicit confirm/cancel полного removal RecoveryChangeSet.
- [x] Повторно проверять current hash set/fence до одной atomic publication.
- [x] Добавить канонические `CATALOG-E2E-04` и `RECOVERY-E2E-01` fixtures.
- [x] Подтвердить full regression, focused mutation и внешний phone tunnel.

## Dev Notes

- Trace: `CAP-1`, `CAP-6`, `CAP-8`, `CAP-9`; `FR-43`; cross-cutting `FR-37`,
  `FR-38`, `FR-44`, `FR-45`, `FR-54`; `NFR-3`, `NFR-10`, `NFR-11`, `NFR-12`,
  `NFR-13`, `NFR-16`, `NFR-21`, `NFR-26`; `AD-3`, `AD-4`, `AD-12`, `AD-14`,
  `AD-17`, `AD-19`; `V-16`; `EV-06`, `EV-07`, `EV-08`, `EV-09`, `EV-17`.
- Remote versioned Catalog Control Plane остаётся отдельной Story 5.6.
  `CATALOG-E2E-04` здесь доказывает только separation: controlled `/catalog/**`
  outage не делает corrupted current resource допустимым и не требуется для
  local exact repair.
- Exact repair восстанавливает bytes текущей Revision и поэтому сам не является
  Project command. RecoveryChangeSet меняет canonical Project и проходит
  обычную fenced atomic publication boundary.
- История-only corruption и `DiscardSessionHistory` принадлежат Story 7.1 и не
  смешиваются с current Project recovery.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Existing production path уже
  обнаруживает missing/hash-mismatched referenced custom GLB до writer mode,
  удерживает Project read-only, не передаёт corrupt bytes в 3D и предоставляет
  два честных исхода: exact-byte repair либо один confirmed RecoveryChangeSet.
- Exact multi-resource repair проверяет полный distinct hash set до storage,
  копирует bytes на boundary, выполняет один atomic batch write и повторно
  открывает ту же Project card через общий integrity path. Неполный набор в
  browser fixture оставляет resource store пустым, revision ID и revision count
  неизменными; полный exact набор восстанавливает writable editor с теми же
  placements и без новой Revision.
- RecoveryChangeSet fixture сначала отменяет destructive outcome и доказывает
  неизменные current revision ID/count. Повторный fresh confirm удаляет все
  unresolved definitions/placements, возвращает writable editor и увеличивает
  Durable Revision count ровно на один.
- `CATALOG-E2E-04` сравнивает visible diagnostic при доступном приложении и
  при принудительном отказе `/catalog/**`; состояние остаётся тем же
  `ResourceRecoveryRequired`, а exact local repair работает без catalog route.
- Final evidence: 1385/1385 full Rstest, warning-free 252-file Biome, обе
  TypeScript-конфигурации и production Rspack build. Два canonical recovery
  сценария прошли 2/2 локально и 2/2 через внешний tunnel на iPhone 13
  emulation. Existing unchanged mutation reports: recovery diagnostic 10/10
  killed (100%), exact controller recovery 135/162 (83.33%), atomic IndexedDB
  batch 4/5 (80%) и RecoveryChangeSet 91/111 (81.98%).
- Production source в closure checkpoint не менялся: закрыт отсутствовавший
  канонический end-to-end acceptance proof и reconciled story status.
- **Acceptance closure — 2026-08-28.** Независимая приёмка приняла все шесть
  Minimal Alpha AC: open-time length/SHA-256 scan переводит current Project в
  read-only recovery до normal editor state; exact repair проверяет полный
  hash set перед одной IndexedDB-транзакцией и затем повторно открывает Project;
  RecoveryChangeSet повторно проверяет captured unresolved set и fenced CAS.
  Текущие evidence: 1,611/1,611 Rstest, clean 264-file Biome,
  обе TypeScript-конфигурации, production build и canonical phone scenarios
  `CATALOG-E2E-04`/`RECOVERY-E2E-01` 2/2. Existing focused mutation reports
  остаются применимыми, поскольку production source этой Story не менялся.

### File List

- `_bmad-output/implementation-artifacts/8-6-recover-project-from-resource-integrity-failure.md`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/application/ports.ts`
- `apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.ts`
- `apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.test.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.test.tsx`
- `apps/web/tests/browser/project-e2e.spec.ts`
- `apps/web/stryker.custom-resource-recovery.config.mjs`
- `apps/web/stryker.indexeddb-custom-resource-batch.config.mjs`
- `apps/web/stryker.recovery-changeset.config.mjs`
- `apps/web/stryker.resource-recovery-diagnostic.config.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-26: Added canonical `CATALOG-E2E-04`/`RECOVERY-E2E-01` observable
  outcomes, reconciled the delivered Minimal Alpha recovery boundary and moved
  Story 8.6 to `review`.
- 2026-08-28: Independent AC audit accepted Story 8.6; moved to `done`.
