---
title: 'CurrentProject RecoveryChangeSet для сломанных custom GLB'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-interiors-editor-alpha/project-and-backup-contract.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="Product Owner pre-authorised autonomous roadmap continuation in the 2026-08-18 conversation and active implementation waiver">

## Intent

**Problem:** Если точных исходных GLB больше нет, current V1 Project остаётся
read-only `recovery-needed`: уже реализованный exact-byte repair не может
вернуть пользователя к работе. Обычное удаление предмета недоступно в этом
состоянии и оставляет `assetDefinitionRefs`, поэтому не устраняет missing hash.

**Approach:** Добавить явный подтверждённый recovery-only путь «удалить все
недоступные модели» для current V1 Project. Он использует captured durable
snapshot, повторно проверяет неизменный unresolved set, удаляет все связанные
custom definitions и их instances из одного candidate и публикует ровно одну
fenced/CAS Durable Revision.

## Boundaries & Constraints

**Always:** Работать только для current V1 `recovery-needed`, где local
resource store и SHA-256 verifier действительно выполнили integrity scan.
Удалять в candidate все `assetDefinitionRefs` с каждым revalidated unresolved
hash и все `assetInstances`, которые ссылаются на их IDs; сохранять built-in и
healthy custom instances. Перед publish набор hashes обязан совпасть с
captured snapshot; `publishNextRevision` обязан получить exact base revision,
а stale base/fence/persist failure оставляет Project и recovery state прежними.
Success очищает session history boundary, не добавляет повреждённую revision в
Undo и затем повторно открывает ту же Project card для integrity verification.
Это current-project removal path `CAP-1`, `CAP-8`, `CAP-9`, `FR-38`, `FR-43`,
`FR-47`, `NFR-11`–`NFR-13`, `AD-9` и `AD-10`.

**Ask First:** Замена broken model Parametric Placeholder или finish default,
удаление actual content-addressed blob, GC/root inventory, `SessionHistory` /
`Both` scope, `DiscardSessionHistory`, Portable Backup schema/import/export,
remote/catalog recovery, V2 support или visual redesign.

**Never:** Не принимать пользовательский subset hashes, не делать обычный
`publish`, не создавать несколько revisions или partial candidate, не
перезаписывать healthy bytes, не удалять shared resource store, не разблокировать
ordinary edit/undo/redo до verified reopen и не объявлять этот узкий removal
path полной реализацией history/backup `RecoveryChangeSet`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Confirm all current broken models | Verified current V1 snapshot, hashes A/B, instances and/or unused definitions | One next Revision removes definitions A/B and every dependent instance, then same card reopens `saved`. | New session history boundary; blobs untouched. |
| Healthy and built-in survivors | Candidate also contains healthy definition C and built-in items | C and its instances plus built-in items persist unchanged. | Candidate preserves valid domain links. |
| Scan or snapshot changed | Store/verifier unavailable, hashes differ, dangling link, no unresolved custom definition | No ID/checksum/repository publish occurs. | Remain `recovery-needed`; reload/reconfirm is required. |
| CAS/fence/persistence failure or cancel | Stale base, lost writer fence, repository reject, no explicit confirm | No new pointer/revision/Undo entry. | Recovery remains visible; no generic retry publishes stale candidate. |

</frozen-after-approval>

## Code Map

- `apps/web/src/domain/recover-unresolved-custom-glb-references.ts` — pure V1 transform removes all broken definition/instance links atomically in memory.
- `apps/web/src/application/recover-unresolved-custom-glb-references.ts` — builds one checksummed next revision through `ProjectRevisionPublicationPort` CAS seam.
- `apps/web/src/app/project-controller.ts` — retains verified recovery snapshot, serializes repair/removal, revalidates it, preserves recovery on lease loss, and reports an unsuccessful integrity reopen without exposing writable state.
- `apps/web/src/app/production-app.ts` — composes the recovery use case into the canonical V1 runtime route.
- `apps/web/src/ui/AppShell.tsx` — recovery-only diagnostic count and explicit confirmation/action; normal editor controls remain unavailable.
- `apps/web/src/domain/recover-unresolved-custom-glb-references.test.ts`, `apps/web/src/application/recover-unresolved-custom-glb-references.test.ts`, `apps/web/src/app/project-controller.test.ts`, `apps/web/src/ui/AppShell.test.tsx` — RED→GREEN proof of transform, CAS failure, snapshot drift, history boundary and recovery UI.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/domain/recover-unresolved-custom-glb-references.ts` and its test — immutable all-or-nothing reference removal, including duplicate hashes, unused definitions, dependent instances and malformed-link fail-closed validation.
- [x] `apps/web/src/application/recover-unresolved-custom-glb-references.ts` and its test — exactly one checksummed `publishNextRevision` from the captured base with durable/stale/persist outcomes and no candidate retry.
- [x] `apps/web/src/app/project-controller.ts`, `apps/web/src/app/production-app.ts`, and tests — verifiable V1 snapshot, unchanged-hash comparison, fenced recovery, recovery-state lease handling, serialized repair/removal, session boundary, and verified same-card reopen.
- [x] `apps/web/src/ui/AppShell.tsx` and test — explicit destructive confirmation, affected-instance count, actionable errors, stale-confirmation reset, and recovery-state writer takeover; exact-GLB repair remains intact.
- [x] `apps/web/tests/browser/project-e2e.spec.ts` — phone emulation proves confirmed removal returns a writable Project with one new revision and no custom item.
- [x] Record targeted/full tests, type/lint/build, targeted browser regression and focused mutation evidence; document retained history/backup and shared-store gaps truthfully.

**Acceptance Criteria:**
- Given a verified current V1 Project has any number of missing/corrupt custom GLB definitions, when the user explicitly confirms removal, then every dependent item and unresolved definition disappears in one CAS/fenced Durable Revision and the same Project is writable only after a successful integrity reopen.
- Given a healthy custom definition or built-in item shares the Project, when the recovery publishes, then it remains unchanged and no resource blob is deleted.
- Given hash verification, recovery snapshot, domain links, base revision, writer fence or persistence is invalid, when removal is attempted, then no new revision, pointer swap, ordinary Undo entry or partial cleanup occurs.
- Given recovery succeeds, when the Project returns to `saved`, then the prior corrupted revision is not undoable in the new session boundary.

## Spec Change Log

## Design Notes

The transform is deliberately deletion-only. Removing a reference strictly
reduces the current resource manifest, so it cannot introduce a new missing
resource or make the current custom-resource backup envelope larger. It is not
used for `SessionHistory`/`Both`: those scopes require the separately governed
history repair route. Resource bytes outlive this action because shared local
library/other-Project roots are not enumerable by this slice. The controller
serializes exact repair and deletion within one app context; a joint
shared-resource-store/Project-pointer transaction across contexts is deferred
in `deferred-work.md` rather than being represented as full global atomicity.

## Verification

**Evidence:**
- Targeted domain/application/controller/UI suite: 66 passed.
- Full web suite: 97 files, 1,070 passed.
- `typecheck`, `lint`, production build: passed.
- `PROJECT-E2E-04D` iPhone 13 emulation: passed; confirmed removal creates a new revision, removes the custom item, and returns a writable editor.
- Focused Stryker domain/application plus irreversible controller hash-set guard: 91 killed / 20 survived (81.98%, threshold 80%). Direct controller and browser tests cover recovery orchestration branches.
- Independent blind and edge-case review completed; malformed reference graph, local repair/delete race, failed integrity reopen, and stale confirmation were patched. Shared-store cross-context atomicity and semantic GLB validation are explicitly deferred.

## Suggested Review Order

**Recovery boundary**

- Capture, validate and publish only the exact current V1 recovery snapshot.
  [project-controller.ts:522](../../apps/web/src/app/project-controller.ts#L522)

- Reject malformed links before any destructive transformation.
  [recover-unresolved-custom-glb-references.ts:25](../../apps/web/src/domain/recover-unresolved-custom-glb-references.ts#L25)

- Build a single checksummed CAS candidate from the accepted transform.
  [recover-unresolved-custom-glb-references.ts:47](../../apps/web/src/application/recover-unresolved-custom-glb-references.ts#L47)

**Runtime wiring and recovery UI**

- Compose the use case only in the canonical production path.
  [production-app.ts:253](../../apps/web/src/app/production-app.ts#L253)

- Require a second explicit confirmation and close it on any refreshed outcome.
  [AppShell.tsx:3562](../../apps/web/src/ui/AppShell.tsx#L3562)

**Evidence**

- Exercise confirmed phone recovery through durable reopen and writable editor state.
  [project-e2e.spec.ts:782](../../apps/web/tests/browser/project-e2e.spec.ts#L782)

- Mutate the data transform and irreversible hash-set guard at the configured threshold.
  [stryker.recovery-changeset.config.mjs:1](../../apps/web/stryker.recovery-changeset.config.mjs#L1)
