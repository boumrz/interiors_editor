---
baseline_commit: NO_VCS
---

# Story 8.9: Импортировать backup атомарно как новый Project

Status: done

## Story

Как пользователь,
я хочу восстановить compatible Portable Backup без риска существующему проекту,
чтобы безопасно перенести работу между local contexts.

## Minimal Alpha Acceptance Criteria

1. Выбор `.interiors` запускает bounded ZIP/path/count/bytes/checksum/schema/
   domain/resource validation с видимыми стадиями и прогрессом. Пользователь
   может отменить импорт с телефона; операция останавливается без нового
   Project и компенсирует каждый resource, впервые записанный этой операцией.
2. Exact resource bytes сначала попадают в local staging boundary. До выдачи
   нового Project ID и Durable publication отдельный smoke-check перечитывает
   их из local store, повторно сверяет byte length/SHA-256/GLB preflight и
   строит 2D/3D projection из canonical integer-mm geometry.
3. Corrupt, oversized, path-unsafe, checksum-invalid и unknown-future schema
   получают различимые recoverable состояния. Любой validation, smoke,
   cancellation или persistence failure оставляет существующие Projects
   неизменными и не публикует partial Project manifest.
4. Только полностью прошедший staged candidate атомарно публикуется под новым
   Project ID. Canonical geometry, Room metadata, resource hashes и exact bytes
   сохраняются без semantic/mm drift; импортированный Project открывается
   offline в Plan и 3D.
5. Phone-browser evidence покрывает resource-free и pinned-GLB backup,
   corrupt rejection и cancellation. Physical iOS/Android transfer matrix и
   crash/reload orphan-byte reclamation остаются release evidence/hardening и
   не могут превратить staged bytes в Durable Project.

## Tasks / Subtasks

- [x] Добавить стабильные cancellation/future-schema/limit decoder outcomes.
- [x] Показать пользователю validation/staging/render progress и cancel action.
- [x] Вести operation-local compensation journal для новых staged resources.
- [x] Перечитать и проверить staged resources до Project publication.
- [x] Выполнить canonical 2D/3D smoke до выделения нового Project ID.
- [x] Сохранить atomic publication и exact geometry/resource identity.
- [x] Подтвердить corrupt/cancel/offline restore в phone-browser сценариях.
- [x] Подтвердить focused mutation и полный regression gate.

## Review Findings

- [x] [P1] Cancellation, поступившая во время checksum после render smoke,
  повторно проверяется до `saving`/publish, возвращает
  `PORTABLE_BACKUP_CANCELLED` и компенсирует только operation-local staged
  resources.

## Dev Notes

- Trace: `CAP-10`; `FR-45`; `NFR-1`, `NFR-3`, `NFR-4`, `NFR-12`,
  `NFR-13`, `NFR-18`, `NFR-21`, `NFR-24`, `NFR-26`; `AD-2`, `AD-3`,
  `AD-4`, `AD-11`, `AD-12`, `AD-14`, `AD-19`; `UX-DR19`, `UX-DR21`,
  `UX-DR24`, `UX-DR25`, `UX-DR28`, `UX-DR30`, `UX-DR38`; `V-17`;
  `EV-07`, `EV-09`, `EV-13`, `EV-17`.
- Alpha импортирует текущий versioned PPJ-A1/V1 envelope. Future schema не
  мигрируется догадкой: UI просит открыть файл в более новой версии и
  подтверждает, что существующие Projects не изменены.
- Cleanup journal намеренно ограничен одной живой import operation. Reload в
  момент staging может оставить только неадресуемые orphan bytes; Project ID,
  revision и manifest ещё не существуют. Их persistent GC относится к
  storage hardening/release gate, а не к минимальному atomic-import path.
- Remote Catalog Control Plane остаётся backlog Story 5.6. Импорт использует
  exact self-contained bytes и не делает network fetch.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Production import теперь проводит
  Portable Backup через последовательные `validating`, resource-staging,
  read/render-smoke и atomic-saving стадии. Phone UI показывает текущую стадию,
  детерминированный progress и доступную кнопку отмены с touch target 44 px.
- Decoder ограничивает ZIP entry/count/compression/unpacked bytes и allowed
  paths, проверяет manifest/ledger/source binding и exact checksums. Cancellation,
  phone limit и readable future schema возвращают отдельные стабильные исходы;
  повреждённый future-looking manifest остаётся на corrupt path.
- `ImportPortableBackupUseCase` записывает только отсутствующие exact resources,
  фиксирует их hashes в operation-local compensation journal и удаляет их при
  cancellation, smoke failure или publication failure. Уже существующие exact
  immutable bytes не удаляются.
- Pre-publication smoke перечитывает каждый resource из настоящего local store,
  проверяет byte length, GLB preflight и SHA-256, затем восстанавливает 3D scene
  из canonical mm topology, если Project содержит Room. Open drawing без Room
  честно остаётся валидным 2D-only Project.
- Только после успешного smoke выделяются clock/Project ID/revision и вызывается
  atomic repository publication. Tests фиксируют новый ID, неизменную geometry
  и resource hashes, а также отсутствие любых ID/publish calls на отказах.
- Mutation testing заставил удалить дублирующую topology-проверку из smoke и
  усилить матрицу cancel/staging/existing-resource/future-manifest outcomes.
  Focused scores: staged read/render smoke 32/32 killed (100%), import 128/146
  killed (87.67%), decoder 241/293 killed (82.25%).
- Final evidence: 1385/1385 Rstest, warning-free 252-file Biome lint, обе
  TypeScript-конфигурации, production Rspack build, 144/144 local
  mobile-browser E2E, 4/4 связанных import-сценария через внешний tunnel и 5/5
  production PWA E2E.
- **Acceptance closure — 2026-08-28.** Независимый audit обнаружил и после
  TDD-fix повторно принял P1 cancellation race после `checking-render`:
  completed checksum не может провести отменённый import к `saving` или
  publication. Current evidence: 1,612/1,612 Rstest, clean 264-file Biome,
  обе TypeScript-конфигурации, production build, targeted phone import 4/4 и
  production PWA 5/5. Full mobile-browser run записал один несвязанный
  `EDITOR-E2E-04F` WebGL2 timeout; isolated rerun passed 1/1. Focused Stryker
  import: 122/140 killed (87.1%); все mutants новой cancellation branch
  killed, 18 remaining survivors относятся к ранее существовавшим
  staging/exception branches.

### File List

- `_bmad-output/implementation-artifacts/8-9-import-backup-atomically-as-new-project.md`
- `apps/web/src/application/ports.ts`
- `apps/web/src/application/import-portable-backup.ts`
- `apps/web/src/application/import-portable-backup.test.ts`
- `apps/web/src/adapters/portable-backup/fflate-portable-backup-decoder.ts`
- `apps/web/src/adapters/portable-backup/fflate-portable-backup-decoder.test.ts`
- `apps/web/src/adapters/portable-backup/portable-backup-read-render-smoke.ts`
- `apps/web/src/adapters/portable-backup/portable-backup-read-render-smoke.test.ts`
- `apps/web/src/app/production-app.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.module.css`
- `apps/web/src/ui/AppShell.test.tsx`
- `apps/web/tests/browser/project-e2e.spec.ts`
- `apps/web/stryker.portable-backup-import.config.mjs`
- `apps/web/stryker.portable-backup-decoder.config.mjs`
- `apps/web/stryker.portable-backup-smoke.config.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-26: Closed the minimal Alpha atomic Portable Backup import path and
  moved Story 8.9 to `review`.
- 2026-08-28: Fixed and independently accepted the post-smoke cancellation
  race; moved Story 8.9 to `done`.
