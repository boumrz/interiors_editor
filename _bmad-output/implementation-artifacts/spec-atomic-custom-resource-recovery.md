---
title: 'Атомарное восстановление всех custom GLB ресурсов проекта'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-interiors-editor-alpha/project-and-backup-contract.md'
  - '{project-root}/_bmad-output/specs/spec-interiors-editor-alpha/portable-backup-ingress-registry.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="Product Owner pre-authorised autonomous roadmap continuation in the 2026-08-18 conversation and active implementation waiver">

## Intent

**Problem:** Текущий recovery принимает только один выбранный GLB. Если в Durable Project отсутствует несколько pinned custom-resources, пользователь восстанавливает их по одному, а ошибка записи между файлами может оставить непонятное частичное состояние. Это не соответствует требованию одного atomic `RecoveryChangeSet`, после которого нет unresolved references.

**Approach:** Добавить один batch recovery путь: пользователь выбирает все исходные GLB, controller проверяет exact hashes против зафиксированного recovery-набора и передаёт полный набор в одну атомарную запись ресурса. Только после успешной записи снова открывается текущая Durable Revision; Project/Revision/History не меняются.

## Boundaries & Constraints

**Always:** Работать только для current V1 Project в активном `recovery-needed`; вычислять только unresolved distinct SHA-256, требовать ровно один valid byte payload на каждый из них и отклонять duplicate, unexpected или missing hash до storage mutation. Уже exact local bytes не перезаписываются. Каждый byte view копируется до store boundary. Один IndexedDB transaction покрывает полный batch. После recovery controller заново выполняет обычную integrity verification той же Project card и сохраняет read-only состояние, если она не прошла. Это `CAP-1`, `CAP-6`, `CAP-8`, `CAP-10`, `FR-43`, `FR-47`, `AD-9` и `AD-10`.

**Ask First:** Изменение формата `.interiors`, schema Project/Revision, поддерживаемых import formats, GC/delete policy, history repair/`DiscardSessionHistory`, CatalogAsset grant/provenance или visual redesign.

**Never:** Не принимать приблизительно похожий GLB; не публиковать Revision, не очищать History, не чинить legacy/V2, не делать пофайловую частичную запись, не загружать сетью и не считать этот срез реализацией полного Portable Backup import/export.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Полный набор | recovery зафиксировал unresolved hashes A и B; выбраны exact bytes A и B | Один batch write, integrity reopen той же card → `saved`. | Project/Revision/History сохранены. |
| Неполный или чужой набор | отсутствует B, duplicate A, уже healthy hash или hash X | `RESOURCE_HASH_MISMATCH`; storage не вызывается. | Экран остаётся `recovery-needed`. |
| Атомарная запись падает | Batch store rejects | Ни один resource не считается repaired; повторное открытие не начинается. | Экран остаётся `recovery-needed`; existing durable bytes не перезаписываются приложением. |
| После записи всё ещё нет exact resource | store/app verification не подтверждает complete set | `repaired`; writer не выдаётся. | Явная подсказка выбрать недостающие exact GLB. |

</frozen-after-approval>

## Code Map

- `apps/web/src/application/ports.ts` — расширить custom-resource store одним atomic batch seam.
- `apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.ts` — реализовать batch через один transaction `resources` store.
- `apps/web/src/app/project-controller.ts` — batch hash verification, no-mutation rejection и reopen only after successful atomic store outcome.
- `apps/web/src/ui/AppShell.tsx` — разрешить multiple GLB selection только на recovery surface, показать truthful batch result.
- `apps/web/src/app/project-controller.test.ts` — RED→GREEN controller outcomes, exact bytes and no-partial-write proof.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/project-controller.test.ts` — RED→GREEN tests cover two-resource recovery, missing/duplicate/unexpected payloads, only-unresolved selection, same-card directory reopen, write failure, no-copy boundary, one-resource compatibility and no partial legacy write.
- [x] `apps/web/src/application/ports.ts`, `apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.ts` — atomic batch resource-replacement port and one-transaction implementation; its adapter test proves a single `readwrite` transaction and byte copying.
- [x] `apps/web/src/app/project-controller.ts` — batch repair verifies the complete exact set before storage; legacy one-file repair remains available only for a one-resource set and fails closed for multi-resource recovery.
- [x] `apps/web/src/ui/AppShell.tsx` — recovery file control accepts multiple GLB files and reports success, incomplete verification or safe rejection without claiming durable Project mutation.
- [x] Record targeted/full test, type/lint/build, targeted browser regression and mutation evidence; retain full Portable Backup roundtrip as open.

**Acceptance Criteria:**
- Given a recovery-needed Project with two unresolved custom resources, when the user selects both exact source GLBs, then the resources are written as one batch and the same durable Project reopens writable without a new Revision or History entry.
- Given any selected batch cannot prove an exact one-to-one mapping for the captured references, when recovery is attempted, then no resource write, Project mutation or writer lease occurs.
- Given batch persistence fails or integrity still fails after it, when recovery completes, then the Project remains recovery-needed and no greybox/partial-success state is displayed.

## Spec Change Log

- 2026-08-18 — implementation clarified the compatibility boundary: the
  pre-existing one-file repair may repair exactly one distinct resource, but is
  rejected for a set with several unresolved hashes. This preserves existing
  one-resource recovery while preventing the known bad state of a partial
  multi-resource write; all multi-resource recovery uses `writeReplacingBatch`.
- 2026-08-18 — review found that reopening through the generic directory route
  could strand a successfully repaired card in the project picker. The repair
  now retains its current Project ID and reopens that same card; recovery also
  captures only unresolved hashes, so already exact local resources are never
  requested or overwritten.

## Design Notes

The controller owns matching because its expected resource hashes are captured from the loaded Durable Project. The IndexedDB adapter owns atomicity because only it can place all immutable resource records in one transaction. `open()` remains the sole transition to writable, so the recovery command never becomes a second Project publication path.

## Verification

**Commands:**
- RED: `pnpm --dir apps/web exec rstest run src/app/project-controller.test.ts --testNamePattern 'atomically recovers'` and the UI recovery test both failed before implementation.
- GREEN: targeted controller/UI/adapter tests (53), full suite (95 files, 1,056 tests), `typecheck`, `lint`, and production `build` all pass.
- Browser regression: `PROJECT-E2E-04B` exact recovery on iPhone 13 emulation passes with the multiple-file recovery control. The new two-resource browser scenario is retained as a full-suite regression; unit and adapter evidence provide the deterministic two-resource proof in this checkpoint.
- Mutation: controller recovery scope — 135 killed / 27 survived (83%, threshold 80%); IndexedDB batch scope — 4 killed / 1 survived (80%, threshold 80%). The remaining IndexedDB survivor is equivalent under IndexedDB structured-clone storage: source bytes are cloned by `put` before caller mutation.

## Suggested Review Order

1. Confirm only unresolved hashes and the current Project ID are captured in [project-controller.ts](../../apps/web/src/app/project-controller.ts#L625).
2. Confirm exact one-to-one validation, copied bytes, single batch call, and integrity reopen in [project-controller.ts](../../apps/web/src/app/project-controller.ts#L428).
3. Inspect the optional atomic persistence seam in [ports.ts](../../apps/web/src/application/ports.ts#L36).
4. Verify one IndexedDB `readwrite` transaction in [indexeddb-custom-asset-resource-store.ts](../../apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.ts#L95).
5. Check the recovery-only multiple-file control and truthful error copy in [AppShell.tsx](../../apps/web/src/ui/AppShell.tsx#L3512) and [AppShell.tsx](../../apps/web/src/ui/AppShell.tsx#L4925).
6. Read behavioural proof in [project-controller.test.ts](../../apps/web/src/app/project-controller.test.ts#L371) and transaction proof in [indexeddb-custom-asset-resource-store.test.ts](../../apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.test.ts#L1).
