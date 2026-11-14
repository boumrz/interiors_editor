---
baseline_commit: NO_VCS
---

# Story 5.3: Разместить wall item без потери host address

Status: done

## Story

Как пользователь,
я хочу разместить совместимый Item на Wall и сохранить его адрес после
поддерживаемых изменений плана,
чтобы объект не смещался и не исчезал без явного решения.

## Minimal Alpha Acceptance Criteria

1. Выбор Wall и локального параметрического wall panel открывает phone-friendly
   preview с integer-mm dimensions, elevation/offset и semantic side. Cancel
   остаётся transient; confirm публикует одну Durable command.
2. Durable `WallPlacement` хранит stable Item ID, `wallSegmentId`, semantic
   side и integer-mm local address. Renderer/world transforms не принимаются и
   не становятся источником Project state.
3. Host bounds, Wall openings и другие panels валидируются до ID/revision
   allocation. Invalid, cancelled, stale, fenced или failed publication не
   создаёт Item, History entry либо partial Durable Revision.
4. Поддерживаемые Wall reverse, split, T/X contact и inline-merge с одним
   lineage-compatible host детерминированно сохраняют physical side/local
   offset. Reloaded Plan и 3D проецируют тот же canonical address.
5. Если split или delete разрушает либо делает host неоднозначным, UI точно
   перечисляет affected Items и показывает явный atomic remove/cancel outcome.
   Confirm повторно проверяет current base/fence и affected host set; stale
   preview не публикуется.
6. Alpha wall panel является resource-free local parametric asset. Будущий
   model-backed/catalog wall candidate не может обойти общую exact-resource
   pin/`BackupFeasibilityPolicy` boundary; текущий Alpha UI не создаёт такой
   unpinned durable candidate.
7. Named phone-browser evidence покрывает placement, reload, semantic side,
   reverse, split/T/X/merge rehost и destructive split/delete outcomes.

## Tasks / Subtasks

- [x] Сохранить wall-local integer-mm placement без renderer transforms.
- [x] Добавить phone preview, confirm/cancel и редактируемый semantic side.
- [x] Валидировать Wall bounds, openings и Item collisions до publication.
- [x] Реализовать deterministic rehost для reverse/split/T/X/inline merge.
- [x] Реализовать explicit atomic consequence для split/delete host conflict.
- [x] Повторно проверять current snapshot/fence и affected IDs на confirm.
- [x] Подтвердить reload, Plan/3D projection и focused mutation/browser gates.

## Review Findings

- [x] [Review][Test] Wall-panel preview в lineage-сценарии сразу
      подтверждался. `RECONCILIATION-E2E-02A` теперь сначала отменяет
      preview и доказывает отсутствие Item/Revision, затем повторяет preview
      и проверяет существующий durable split-rehost flow.
- [x] [Review][P1] `CreateParametricWallItem` публикует candidate только через
      exact-base CAS. Stale panel preview возвращает `stale-base` и не может
      перезаписать более новую Durable Revision.
- [x] [Review][P1] Destructive split-host confirmation несёт
      `previewRevisionId`; controller отказывает stale preview до use case, а
      UI очищает устаревший draft вместо публикации другого состояния.
- [x] [Review][P1] Host-conflict UI показывает не только количество, но и
      точный список затронутых Item ID и labels.
- [x] [Review][P1] Phone browser evidence для Wall reverse проверяет
      сохранение panel side/offset, stable wall identity и reload parity.

## Dev Notes

- Trace: `CAP-6`, `CAP-8`; `FR-28`; cross-scope `FR-9`, `FR-11`, `FR-15`,
  `FR-38`–`FR-40`; `NFR-1`, `NFR-3`, `NFR-4`, `NFR-13`, `NFR-17`–`NFR-19`,
  `NFR-24`, `NFR-26`; `AD-1`, `AD-3`, `AD-8`, `AD-12`, `AD-14`, `AD-19`;
  `V-09`; `EV-04`, `EV-06`, `EV-10`, `EV-11`, `EV-13`, `EV-17`.
- Canonical geometry remains an integer-mm planar graph. Wall panel state is a
  domain address; every WebGL object is a disposable projection.
- General multi-X chains, every post-closure diagonal lineage permutation and
  the complete physical-device topology corpus remain release gates. They do
  not expand this Product Owner-approved minimal wall-item slice.
- Ceiling-item scope and licensing/grant evidence were retired from Alpha by
  Product Owner decisions dated 2026-08-24 and 2026-08-25.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Closure audit confirms the complete
  user walking skeleton already exists in production: phone placement stores
  only a stable wall-local integer-mm address; Plan/3D/reload use that address;
  supported reverse/split/T/X/merge edits deterministically retain it; a cut or
  deleted host requires one explicit atomic destructive outcome or cancel.
- `ResolveWallSplitHostConflictUseCase` and Wall deletion rerun discovery and
  compare the exact affected ID set against the current candidate before the
  repository performs one fenced atomic publication. Stale preview, lock loss,
  cancellation and persistence failure cannot leave a partial wall Item.
- Final evidence: 179/179 focused Rstest, 1385/1385 full Rstest, warning-free
  252-file Biome, both TypeScript configurations and production Rspack build.
  Ten related iPhone-13 browser scenarios passed locally and the same 10/10
  passed through the external phone tunnel.
- Existing unchanged source mutation reports remain green: split rehost 90.0%
  (45/50), split conflict 100% (85/85), delete conflict 90.48% (38/42), merge
  rehost 100% (9/9), reverse 100% (38/38) and local move 100% (88/88).
- No production source changed during this closure checkpoint; the iteration
  reconciled the already-delivered minimal Alpha boundary and its evidence.
- **Review evidence — 2026-08-28.** `RECONCILIATION-E2E-02A` now proves a
  cancelled wall-panel preview leaves no Item or Durable Revision before the
  confirmed placement and rehost path. Its focused phone browser run passes
  (1/1).
- **Acceptance closure — 2026-08-28.** Independent повторная приёмка приняла
  все семь Minimal Alpha AC. Wall-panel publication теперь использует
  `publishNextRevision(candidate, baseRevisionId)`; stale candidate не
  перезаписывает current Durable Revision. Split-conflict confirmation связан
  с preview Revision, отображает exact affected Items и fail-closed очищает
  устаревший preview. Phone reverse сохраняет semantic side и local offset
  после reload.
- Final evidence for this closure: RED-проверка двух stale-path regressions,
  затем 244/244 focused Rstest; 1602/1602 full Rstest; Biome lint (264 files),
  обе TypeScript-конфигурации, production build и полный browser/PWA E2E
  прошли. Focused Stryker для publication boundary: 18/18 killed (100%).

### File List

- `_bmad-output/implementation-artifacts/5-3-place-wall-item-with-stable-host.md`
- `apps/web/src/domain/parametric-wall-item.ts`
- `apps/web/src/domain/parametric-wall-item.test.ts`
- `apps/web/src/domain/general-wall-project.ts`
- `apps/web/src/domain/general-wall-project.test.ts`
- `apps/web/src/application/create-parametric-wall-item.ts`
- `apps/web/src/application/create-parametric-wall-item.test.ts`
- `apps/web/src/application/move-parametric-wall-item.ts`
- `apps/web/src/application/move-parametric-wall-item.test.ts`
- `apps/web/src/application/general-wall-project-mutations.ts`
- `apps/web/src/application/general-wall-project-mutations.test.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-28: Closed all seven Minimal Alpha acceptance criteria after
  independent repeat acceptance; Story moved from `review` to `done`.
- 2026-08-28: Added direct cancel evidence for transient wall-panel placement;
  Story remains in `review`.
- 2026-08-26: Created the missing implementation artifact, reconciled the
  delivered minimal Alpha acceptance boundary and moved Story 5.3 to `review`.
