---
title: 'Честная доступность bytes в библиотеке «Кастомное»'
type: 'bugfix'
created: '2026-08-18'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/spec-interiors-editor-alpha/asset-import-contract.md'
  - '{project-root}/_bmad-output/specs/spec-interiors-editor-alpha/project-and-backup-contract.md'
---

<frozen-after-approval reason="owner pre-authorised continued implementation in 2026-08-18 conversation and active implementation waiver">

## Intent

**Problem:** Карточка из device-local «Кастомное», если её immutable GLB bytes были удалены или повреждены вне Project, остаётся disabled с текстом бесконечной загрузки. Пользователь не понимает, что ожидание не восстановит модель; в худшем случае непроверенные bytes попадают в renderer и воспроизводят симптом чёрной/неразмещаемой модели.

**Approach:** При чтении local library отличать loading, verified-ready и unavailable. Карточка остаётся видимой как metadata, но недоступный ресурс честно требует заново импортировать исходный GLB. Повторный подтверждённый import того же exact hash восстанавливает ready-state без Project mutation.

## Boundaries & Constraints

**Always:** Проверять stored bytes до готовности карточки тем же static-GLB preflight и SHA-256 address, не выполнять сетевые запросы, не создавать Project/Revision/History на library read, reject или повторный import до подтверждённой постановки. Сохранять available card/renderer route без изменения visual design.

**Ask First:** Новая политика удаления library metadata, глобальный GC, auto-repair из сети, ResourceRecoveryChangeSet либо Portable Backup/PPJ-A1 не входят в этот slice.

**Never:** Не называть библиотеку backup, не скрывать/удалять Project reference, не подставлять другой asset, не разрешать placement unavailable bytes и не менять accepted CAP-12 static-GLB boundary.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Ready | Library definition + existing well-formed bytes with matching SHA-256 | Card shows renderer preview and remains placeable. | N/A |
| Missing | Library definition, no bytes in IndexedDB | Card stays visible but disabled and explains that source GLB must be imported again. | No Project effect. |
| Corrupt | Bytes fail static GLB preflight or checksum differs from address | Same terminal unavailable state; bytes never reach preview/placement. | No network or silent substitute. |
| Re-import | User confirms original exact GLB after unavailable state | Existing library definition remains canonical; resource is rewritten and card becomes ready. | No Project revision until placement confirm. |

</frozen-after-approval>

## Code Map

- `apps/web/src/ui/AppShell.tsx` -- loads local custom resources, renders cards and starts placement.
- `apps/web/src/application/register-custom-glb-library-asset.ts` -- verifies and stores a confirmed exact GLB without Project mutation.
- `apps/web/src/adapters/persistence/indexeddb-custom-asset-resource-store.ts` -- atomic library/resource storage keyed by resource hash.
- `apps/web/tests/browser/project-e2e.spec.ts` -- persistent-phone regression harness and IndexedDB fault helpers.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/ui/AppShell.tsx` -- model explicit resource availability, verify local bytes before preview or placement, and refresh state after exact re-import -- avoids an infinite loading lie and renderer input of corrupt bytes.
- [x] `apps/web/tests/browser/project-e2e.spec.ts` -- simulate loss of a library-only resource, assert unavailable UX/no placement, then re-import exact bytes and assert preview-ready recovery -- proves user-visible safety and repair route.
- [x] `_bmad-output/specs/spec-interiors-editor-alpha/implementation-evidence-2026-08-18.md` and roadmap -- record the bounded evidence without upgrading it to Portable Backup or full ResourceRecoveryRequired.

**Acceptance Criteria:**
- Given a healthy shared Custom card, when a new Project opens the library, then it remains previewable and placeable.
- Given missing, malformed or hash-mismatched library bytes, when the card is loaded, then it is visibly unavailable, cannot start placement and creates no Project revision.
- Given unavailable metadata and a confirmed original exact GLB, when import succeeds, then its existing card becomes ready locally and the current Project remains unchanged until explicit placement.

### Review Findings

- [x] [Review][Patch] Stale direct-import completion can replace a newer chosen model and start its placement [apps/web/src/ui/AppShell.tsx:3993]
- [x] [Review][Patch] Late library hydration can discard a just-registered Custom card in the current UI state [apps/web/src/ui/AppShell.tsx:2997]
- [x] [Review][Patch] Direct exact re-import does not reuse a same-hash active-Project definition [apps/web/src/ui/AppShell.tsx:4012]
- [x] [Review][Patch] Malformed library bytes have no explicit browser regression assertion [apps/web/tests/browser/project-e2e.spec.ts:802]

## Spec Change Log

## Design Notes

The ready bit belongs to the ephemeral library presentation state, not to the Project schema. Project-owned references remain governed by the stronger controller open integrity check; this slice makes the separate shared-library read path equally honest without pretending that it repairs a Durable Project.

## Verification

**Commands:**
- `pnpm --filter web test -- --run apps/web/tests/browser/project-e2e.spec.ts` -- targeted persistent-phone regression succeeds.
- `pnpm lint && pnpm typecheck && pnpm --filter web build` -- static and production checks succeed.
- `pnpm --filter web test` -- full web suite succeeds.
- targeted Stryker command for changed availability logic -- all meaningful mutations are killed or documented.
