---
baseline_commit: NO_VCS
---

# Story 8.8: Экспортировать self-contained Portable Backup

Status: done

## Story

Как пользователь,
я хочу вынести healthy Project в Portable Backup,
чтобы не быть запертым в одном browser profile или iOS context.

## Minimal Alpha Acceptance Criteria

1. Единственное видимое действие экспорта всегда создаёт versioned
   `.interiors` Portable Backup — и для resource-free Project, и для Project с
   pinned asset resources. Более узкий JSON interchange не подменяет backup.
2. Bundle содержит canonical Project, schema/manifest, SHA-256 ledger и все
   exact referenced catalog/custom GLB bytes. Ресурсы читаются только из
   durable local store, повторно проверяются по byte length/hash и записываются
   в детерминированном порядке; session Undo/Redo History не включается.
3. Healthy fully pinned Project экспортируется при отключённой сети без HTTP
   fetch. Полученный файл импортируется в отдельный local Project после
   удаления исходных resource bytes, что доказывает self-contained envelope.
4. Missing/corrupt/unverified resource, неподдерживаемая schema, I/O или
   encoding/download failure возвращают recoverable отказ. Неполный файл не
   получает `kind: ready` и не называется Portable Backup.
5. Общий pre-publication resource envelope отклоняет prospective mutation до
   Durable publish, если current + Undo/Redo roots + candidate превышают Alpha
   entry/byte limits. Текущая Durable Revision и её offline exportability не
   меняются.
6. Phone-browser evidence покрывает resource-free и exact-resource exports,
   named `CATALOG-E2E-05`, no-fetch/offline restore и полный regression suite.
   Physical iOS/Android PWA matrix остаётся отдельным release gate.

## Tasks / Subtasks

- [x] Всегда направлять видимый Project export в `.interiors` encoder.
- [x] Включать canonical Project, manifest/checksums и exact local resources.
- [x] Повторно проверять SHA-256/byte length и fail closed без partial output.
- [x] Исключить session History из Portable Backup source contract.
- [x] Сохранить pre-publication resource-envelope admission.
- [x] Подтвердить offline/no-fetch export → delete source bytes → import.
- [x] Подтвердить внешний tunnel, полный browser/PWA gate и focused mutation.

## Dev Notes

- Trace: `CAP-6`, `CAP-10`; `FR-44`; cross-cutting `FR-3`, `FR-5`, `FR-37`,
  `FR-54`; `NFR-1`, `NFR-3`, `NFR-4`, `NFR-10`, `NFR-12`, `NFR-13`,
  `NFR-21`, `NFR-24`, `NFR-26`; `AD-2`, `AD-3`, `AD-4`, `AD-11`, `AD-12`,
  `AD-14`, `AD-17`, `AD-19`; `UX-DR19`, `UX-DR21`, `UX-DR24`, `UX-DR25`,
  `UX-DR28`, `UX-DR35`, `UX-DR38`; `V-17`; `EV-06`, `EV-07`, `EV-09`,
  `EV-10`, `EV-14`, `EV-17`.
- Remote Catalog Control Plane остаётся backlog Story 5.6. Этот Alpha-срез
  использует тот же production local-pin boundary и доказывает отсутствие
  remote fetch; он не симулирует незавершённый backend.
- Portable Backup import/staging/future-schema UX принадлежит Story 8.9.
  Physical device transfer остаётся release evidence, а не незакрытой функцией
  export Story.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Видимый export route больше не
  предпочитает `.interiors.json`: любой healthy Durable Project проходит через
  `ExportPortableBackupUseCase` и получает `.interiors`, даже если у него нет
  resource references. Отдельный JSON use case сохранён как узкий interchange
  API, но не может молча подменить пользовательский backup.
- Export сериализует canonical Project и создаёт `manifest.json`,
  `checksums.json` и `project/project.json`. Каждый referenced GLB берётся из
  exact local hash-addressed store, сверяется по safe byte length и SHA-256,
  копируется в archive и сортируется по immutable hash. Candidate не содержит
  controller-owned Undo/Redo stacks, поэтому portable artifact не переносит
  session History.
- Missing bytes/store/verifier, mismatched length/hash, duplicate/invalid
  descriptor и unsupported schema завершаются fail-closed до `ready`. UI
  показывает recoverable error, а Blob создаётся только из успешного complete
  byte envelope.
- `SessionRetentionProjectRepository` сохраняет общий Alpha resource envelope
  для current + Undo/Redo + prospective command и возвращает
  `PROJECT_HISTORY_RESOURCE_LIMIT` до publication; existing roots не
  отбрасываются ради новой mutation.
- `PROJECT-E2E-03C` offline экспортирует resource-free Project именно как
  `.interiors` и импортирует отдельную копию. Named `CATALOG-E2E-05 /
  PROJECT-E2E-03D` отключает network, фиксирует ноль HTTP requests, экспортирует
  pinned GLB, удаляет исходные resource bytes и восстанавливает второй healthy
  Project только из downloaded bundle.
- External iPhone-13 browser evidence: оба backup-сценария прошли 2/2 через
  действующий Cloudflare tunnel. Полный local mobile-browser regression прошёл
  142/142; два stale selector expectations для уже именованных color variants
  и верхнеуровневых catalog categories были актуализированы и подтверждены в
  итоговом чистом прогоне.
- Focused mutation: portable-backup envelope 52/52 killed (100%); единый
  visible route 7/7 killed (100%). Final evidence: 1345/1345 Rstest,
  warning-free 250-file Biome lint, обе TypeScript-конфигурации, production
  Rspack build и 5/5 production PWA E2E.
- **Acceptance closure — 2026-08-28.** Независимая приёмка приняла все шесть
  Minimal Alpha AC: единственный visible route выпускает только `.interiors`;
  canonical Project, manifest, SHA-256 ledger и exact bytes проверяются до
  encoder; current/Undo/Redo/prospective envelope ограничивает publication до
  Durable boundary. Current evidence: 1,611/1,611 Rstest, clean 264-file
  Biome, обе TypeScript-конфигурации, production build, 5/5 production PWA и
  `PROJECT-E2E-03C`/`CATALOG-E2E-05` 2/2. Production source этой Story в
  acceptance checkpoint не менялся, поэтому existing focused mutation evidence
  остаётся применимым.

### File List

- `_bmad-output/implementation-artifacts/8-8-export-self-contained-portable-backup.md`
- `apps/web/src/application/export-portable-backup.ts`
- `apps/web/src/application/export-portable-backup.test.ts`
- `apps/web/src/application/session-retention-policy.ts`
- `apps/web/src/application/session-retention-policy.test.ts`
- `apps/web/src/application/session-retention-project-repository.ts`
- `apps/web/src/app/production-app.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/tests/browser/project-e2e.spec.ts`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `apps/web/stryker.portable-backup-export.config.mjs`
- `apps/web/stryker.portable-backup-visible-route.config.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-26: Closed the minimal Alpha self-contained offline export path and
  moved Story 8.8 to `review`.
- 2026-08-28: Independent AC audit accepted Story 8.8; moved to `done`.
